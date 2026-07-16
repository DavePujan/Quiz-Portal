const normalizeLanguage = (language) => {
  const normalized = String(language || "").trim().toLowerCase();
  if (normalized === "js") return "javascript";
  if (normalized === "py") return "python";
  return normalized;
};

const sanitizeFunctionName = (functionName) => {
  const candidate = String(functionName || "").trim();
  if (!candidate) return "solution";
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(candidate) ? candidate : "solution";
};

export function buildStarterCode(language, functionName) {
  const normalized = normalizeLanguage(language);
  const fn = sanitizeFunctionName(functionName);

  if (normalized === "javascript" || normalized === "js") {
    return `function ${fn}(a, b) {\n\n}`;
  }

  if (normalized === "python" || normalized === "py") {
    return `def ${fn}(a, b):\n    pass`;
  }

  if (normalized === "cpp") {
    return `int ${fn}(int a, int b) {\n\n}`;
  }

  if (normalized === "java") {
    return `public static int ${fn}(int a, int b) {\n\n}`;
  }

  if (normalized === "php") {
    return `function ${fn}($a, $b) {\n\n}`;
  }

  return `function ${fn}(a, b) {\n\n}`;
}