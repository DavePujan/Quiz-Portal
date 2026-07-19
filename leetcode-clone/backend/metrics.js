const client = require("prom-client");

// Exposes standard Node.js/V8 metrics (CPU, RAM, Event Loop lag)
if (process.env.NODE_ENV !== "test") {
    client.collectDefaultMetrics();
}

const httpRequests = new client.Counter({
    name: "http_requests_total",
    help: "Total HTTP Requests",
    labelNames: ["method", "route", "status"],
});

const redisStatus = new client.Gauge({
    name: "redis_status",
    help: "Redis availability (1 = up, 0 = down)",
});

const fallbackCounter = new client.Counter({
    name: "rate_limiter_fallback_total",
    help: "Number of times the Graceful circuit breaker bypassed Redis",
});

const quizCreationMigration = new client.Counter({
    name: "quiz_creation_migration_total",
    help: "Total quiz creations tracked during rollout",
    labelNames: ["mode", "schemaVersion"],
});

module.exports = { client, httpRequests, redisStatus, fallbackCounter, quizCreationMigration };
