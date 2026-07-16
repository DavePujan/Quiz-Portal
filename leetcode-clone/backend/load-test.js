const axios = require('axios');
const { io } = require('socket.io-client');
require('dotenv').config();

const BASE_URL = `http://127.0.0.1:${process.env.PORT || 5000}`;
const TOTAL_SUBMISSIONS = 250;
let completed = 0;
const latencies = [];

const MOCK_TOKEN = "TEST_USER_TOKEN"; // Load test assumes we bypass auth or generate a fake token, but let's mock auth or just test the queue directly if auth is strict.

// Because hitting the API requires a valid JWT token, we will just interact with the BullMQ queue directly to test infrastructure limits, which is the actual bottleneck.
const { submissionQueue } = require('./queues/submission.queue');
const crypto = require('crypto');
const redisClient = require('./config/redis');

async function runLoadTest() {
    console.log(`Starting Concurrency Load Test: ${TOTAL_SUBMISSIONS} submissions...`);
    
    // Clear queue before start
    await submissionQueue.drain();
    
    const startTime = Date.now();
    const jobs = [];
    
    // We will simulate 250 users submitting "add-two" in Python concurrently
    for (let i = 0; i < TOTAL_SUBMISSIONS; i++) {
        const executionId = crypto.randomUUID();
        const code = `
def addTwo(a, b):
    # Artificial small delay to simulate real compute
    import time
    time.sleep(0.01)
    return a + b
`;
        // Push directly to queue to bypass JWT auth for load testing
        const jobPromise = submissionQueue.add("run-code", {
            code,
            language: "python",
            questionId: "add-two",
            userId: "user-" + i,
            mode: "submit",
            executionId
        }, {
            attempts: 1
        });
        jobs.push({ promise: jobPromise, executionId, startTime: Date.now() });
    }
    
    await Promise.all(jobs.map(j => j.promise));
    console.log(`Queued ${TOTAL_SUBMISSIONS} jobs in ${Date.now() - startTime}ms.`);
    
    // Now wait for all to complete
    console.log("Waiting for workers to process...");
    
    return new Promise((resolve) => {
        const interval = setInterval(async () => {
            const waiting = await submissionQueue.getWaitingCount();
            const active = await submissionQueue.getActiveCount();
            const completedCount = await submissionQueue.getCompletedCount();
            const failedCount = await submissionQueue.getFailedCount();
            
            console.log(`Stats: Waiting=${waiting}, Active=${active}, Completed=${completedCount}, Failed=${failedCount}`);
            
            if (waiting === 0 && active === 0) {
                clearInterval(interval);
                const totalTime = Date.now() - startTime;
                console.log(`\n Load Test Finished in ${totalTime}ms!`);
                console.log(`Throughput: ${((TOTAL_SUBMISSIONS / totalTime) * 1000).toFixed(2)} submissions/sec`);
                resolve();
            }
        }, 1000);
    });
}

runLoadTest().then(() => {
    process.exit(0);
}).catch(console.error);
