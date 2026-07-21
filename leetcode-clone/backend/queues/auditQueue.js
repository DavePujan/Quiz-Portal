const { Queue } = require("bullmq");
const Redis = require("ioredis");

const connection = process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
    : { host: "127.0.0.1", port: 6379 };

const auditQueue = new Queue("audit-queue", { connection });

module.exports = { auditQueue, connection };
