const Redis = require('ioredis');
const { EventEmitter } = require('events');

const IS_TEST = process.env.NODE_ENV === 'test';

if (IS_TEST) {
    const mockRedis = new EventEmitter();
    mockRedis.isAvailable = false;
    mockRedis.status = 'end';
    mockRedis.call = async () => {
        throw new Error('Redis disabled in test mode');
    };
    mockRedis.get = async () => null;
    mockRedis.set = async () => 'OK';
    mockRedis.del = async () => 0;
    mockRedis.disconnect = () => { };
    module.exports = mockRedis;
} else {
    const retryStrategy = (times) => {
        // Prevent infinite loops if Redis isn't running locally yet
        const delay = Math.min(times * 50, 2000);
        if (times > 5) {
            console.warn('Could not connect to Redis. Retrying will be capped.');
        }
        return delay;
    };

    const formatRedisUrl = (url) => {
        if (!url) return url;
        if (url.includes("upstash.io") && url.startsWith("redis://")) {
            return url.replace("redis://", "rediss://");
        }
        return url;
    };

    const redisUrl = formatRedisUrl(process.env.REDIS_URL);

    // Gracefully handles raw REDIS_URL string vs configuration object
    const redisClient = redisUrl
        ? new Redis(redisUrl, { retryStrategy, maxRetriesPerRequest: null, tls: redisUrl.startsWith("rediss://") ? { rejectUnauthorized: false } : undefined })
        : new Redis({ host: '127.0.0.1', port: 6379, retryStrategy, maxRetriesPerRequest: null });
    redisClient.isAvailable = false;

    redisClient.on('ready', () => {
        redisClient.isAvailable = true;
        console.log('Redis Ready!');
        const { redisStatus } = require('../metrics');
        if (redisStatus) redisStatus.set(1);
    });

    redisClient.on('error', (err) => {
        redisClient.isAvailable = false;
        if (redisClient.status !== 'reconnecting') {
            console.error('Redis Connection Error:', err.message);
        }
    });

    redisClient.on('end', () => {
        redisClient.isAvailable = false;
        console.warn('Redis Disconnected');
        const { redisStatus } = require('../metrics');
        if (redisStatus) redisStatus.set(0);
    });

    redisClient.duplicateClient = () => {
        const dup = redisClient.duplicate();
        dup.on('error', (err) => {
            if (dup.status !== 'reconnecting') {
                console.error('[Redis Client] Connection Error:', err.message);
            }
        });
        return dup;
    };

    module.exports = redisClient;
}
