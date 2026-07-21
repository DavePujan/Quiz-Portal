const { Queue } = require("bullmq");
const Redis = require("ioredis");

const formatRedisUrl = (url) => {
    if (!url) return url;
    if (url.includes("upstash.io") && url.startsWith("redis://")) {
        return url.replace("redis://", "rediss://");
    }
    return url;
};

const redisUrl = formatRedisUrl(process.env.REDIS_URL);

const connection = redisUrl
    ? new Redis(redisUrl, { maxRetriesPerRequest: null, tls: redisUrl.startsWith("rediss://") ? { rejectUnauthorized: false } : undefined })
    : { host: "127.0.0.1", port: 6379 };

const submissionQueue = new Queue("submission-queue", { connection });

module.exports = { submissionQueue, connection };
