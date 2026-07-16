const { existsSync } = require("fs");
const { join } = require("path");
const { spawnSync } = require("child_process");

const cwd = process.cwd();
const composeFile = join(cwd, "docker-compose.dev.yml");
const judgeComposeFile = join(cwd, "..", "quiz-evaluator", "docker", "judge0", "docker-compose.yml");
const modelFiles = [
  join(cwd, "model", "model.json"),
  join(cwd, "model", "weights.bin"),
  join(cwd, "model", "vocab.json")
];

function log(msg) {
  console.log(`[dev-bootstrap] ${msg}`);
}

function hasCommand(command) {
  const check = spawnSync(command, ["--version"], {
    stdio: "ignore",
    shell: false,
    windowsHide: true
  });
  return check.status === 0;
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: "pipe",
    encoding: "utf8",
    shell: false,
    windowsHide: true
  });

  if (result.error) {
    log(`Failed to run ${cmd}: ${result.error.message}`);
    return false;
  }

  if (result.stdout && result.stdout.trim()) {
    log(result.stdout.trim());
  }

  if (result.stderr && result.stderr.trim()) {
    log(result.stderr.trim());
  }

  return result.status === 0;
}

function hasDockerComposePlugin() {
  const check = spawnSync("docker", ["compose", "version"], {
    stdio: "ignore",
    shell: false,
    windowsHide: true
  });
  return check.status === 0;
}

function startComposeStack(composePath, services = [], label = "compose stack") {
  if (!existsSync(composePath)) {
    log(`${label} compose file not found at ${composePath}. Skipping.`);
    return;
  }

  const canUseComposePlugin = hasDockerComposePlugin();
  const serviceArgs = Array.isArray(services) ? services.filter(Boolean) : [];

  if (canUseComposePlugin) {
    const args = ["compose", "-f", composePath, "up", "-d", ...serviceArgs];
    const ok = run("docker", args);
    if (!ok) {
      log(`Could not start ${label} with docker compose.`);
    }
    return;
  }

  if (hasCommand("docker-compose")) {
    const args = ["-f", composePath, "up", "-d", ...serviceArgs];
    const ok = run("docker-compose", args);
    if (!ok) {
      log(`Could not start ${label} with docker-compose.`);
    }
    return;
  }

  log(`Neither docker compose plugin nor docker-compose found. Skipping ${label}.`);
}

function startNamedContainers(containerNames) {
  if (!Array.isArray(containerNames) || containerNames.length === 0) return false;

  const result = spawnSync("docker", ["start", ...containerNames], {
    cwd,
    stdio: "pipe",
    encoding: "utf8",
    shell: false,
    windowsHide: true
  });

  if (result.stdout && result.stdout.trim()) {
    log(result.stdout.trim());
  }

  if (result.stderr && result.stderr.trim()) {
    log(result.stderr.trim());
  }

  return result.status === 0;
}

function getExistingContainerNames() {
  const result = spawnSync("docker", ["ps", "-a", "--format", "{{.Names}}"], {
    cwd,
    stdio: "pipe",
    encoding: "utf8",
    shell: false,
    windowsHide: true
  });

  if (result.error || result.status !== 0) {
    return [];
  }

  return (result.stdout || "")
    .split(/\r?\n/)
    .map((name) => name.trim())
    .filter(Boolean);
}

function isPortAlreadyPublished(port) {
  const result = spawnSync("docker", ["ps", "--format", "{{.Names}}||{{.Ports}}"], {
    cwd,
    stdio: "pipe",
    encoding: "utf8",
    shell: false,
    windowsHide: true
  });

  if (result.error || result.status !== 0) {
    return false;
  }

  const marker = `:${port}->`;
  return (result.stdout || "")
    .split(/\r?\n/)
    .some((line) => line.includes(marker));
}

function getContainersPublishingPort(port) {
  const result = spawnSync("docker", ["ps", "--format", "{{.Names}}||{{.Ports}}"], {
    cwd,
    stdio: "pipe",
    encoding: "utf8",
    shell: false,
    windowsHide: true
  });

  if (result.error || result.status !== 0) {
    return [];
  }

  const marker = `:${port}->`;
  return (result.stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.includes(marker))
    .map((line) => line.split("||")[0])
    .filter(Boolean);
}

function ensureModelArtifacts() {
  const missing = modelFiles.filter((filePath) => !existsSync(filePath));
  if (missing.length > 0) {
    log("ML model artifacts are missing. Topic classifier will fall back to default topic.");
    missing.forEach((item) => log(`Missing: ${item}`));
    return;
  }
  log("ML model artifacts found.");
}

function startInfra() {
  if (!existsSync(composeFile)) {
    log("docker-compose.dev.yml not found. Core infra bootstrap will be skipped.");
  }

  if (!hasCommand("docker")) {
    log("Docker not found on PATH. Skipping container bootstrap (Redis/Prometheus/Grafana/Judge0).");
    return;
  }

  const legacyContainerNames = ["quiz-redis", "quiz-prometheus", "quiz-grafana"];
  const existingNames = getExistingContainerNames();
  const pickExisting = (candidates) => candidates.find((name) => existingNames.includes(name));

  const coreSelection = [
    pickExisting(["quiz-redis", "redis"]),
    pickExisting(["quiz-prometheus", "prometheus2", "prometheus"]),
    pickExisting(["quiz-grafana", "grafana"])
  ].filter(Boolean);

  if (coreSelection.length > 0) {
    log(`Detected existing core containers (${coreSelection.join(", ")}). Starting them directly...`);
    const started = startNamedContainers(coreSelection);
    if (!started) {
      log("Could not start one or more selected core containers. Continuing backend startup.");
    }
  }

  // Idempotent: ensure all core services exist and are up even if only a subset was pre-existing.
  startComposeStack(composeFile, ["redis", "prometheus", "grafana"], "core infra");

  if (!existsSync(judgeComposeFile)) {
    log(`Judge0 compose file missing at ${judgeComposeFile}. Skipping Judge0 bootstrap.`);
    return;
  }

  if (isPortAlreadyPublished(2358)) {
    const publishers = getContainersPublishingPort(2358);
    const judgePublishers = publishers.filter((name) => /judge0|api/i.test(name));

    if (judgePublishers.length > 0) {
      log(`Judge0 appears to be running on port 2358 (${judgePublishers.join(", ")}).`);
    } else {
      log(`Port 2358 is occupied by non-Judge0 container(s): ${publishers.join(", ")}. Skipping Judge0 bootstrap.`);
    }
    return;
  }

  log(`Starting Judge0 stack from ${judgeComposeFile}...`);
  // Idempotent: docker compose up -d creates/starts only what is needed.
  startComposeStack(judgeComposeFile, [], "judge0-official");
}

function bootstrap() {
  if (process.env.AUTO_BOOTSTRAP_SERVICES === "false") {
    log("AUTO_BOOTSTRAP_SERVICES=false, skipping infra bootstrap.");
    ensureModelArtifacts();
    return;
  }

  log("Bootstrapping local dev infra...");
  startInfra();
  ensureModelArtifacts();
  log("Bootstrap finished.");
}

try {
  bootstrap();
} catch (error) {
  log(`Bootstrap failed non-fatally: ${error.message}`);
}
