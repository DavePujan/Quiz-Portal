const { Queue } = require("bullmq");
const redisClient = require("../config/redis");

const connection = process.env.REDIS_URL
    ? redisClient.duplicateClient()
    : { host: "127.0.0.1", port: 6379 };

const submissionQueue = new Queue("submission-queue", { connection });

module.exports = { submissionQueue, connection };
