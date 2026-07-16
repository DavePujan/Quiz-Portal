const { Worker } = require("bullmq");
const { io } = require("socket.io-client");
const { connection } = require("../queues/submission.queue");
const { runBatch, normalizeLanguage, resolveLanguageId } = require("../utils/judge0");
const boilerplates = require("../utils/boilerplates");
const { buildWrappedCode } = require("../utils/codeExecution");
const questions = require("../models/Question");
const leaderboard = require("../models/Leaderboard");
const redisClient = require("../config/redis");

const workerSocket = io(
    process.env.BACKEND_URL || `http://127.0.0.1:${process.env.PORT || 5000}`,
    {
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        timeout: 10000
    }
);

let isConnected = false;

workerSocket.on("connect", () => {
    console.log("Worker connected to socket server");
    isConnected = true;
});

workerSocket.on("disconnect", () => {
    console.log("Worker socket disconnected");
    isConnected = false;
});

workerSocket.on("connect_error", (err) => {
    console.error("Worker socket connection error:", err.message);
    isConnected = false;
});

const emitJobStatus = (jobId, payload) => {
    if (!jobId || !payload || !isConnected) return;
    workerSocket.emit("worker-status", {
        jobId: String(jobId),
        payload: {
            jobId: String(jobId),
            ...payload
        }
    });
};

const shouldEmitProgressCheckpoint = (index, total) => {
    const current = index + 1;
    return current % 5 === 0 || current === total;
};

const evaluateJudgeCase = (result, tc, visibilityLabel) => {
    const statusId = result?.status?.id;
    if (statusId !== 3) {
        return {
            verdict: result?.status?.description || "Judge0 Execution Error",
            debug: {
                input: tc.input,
                output: (result?.stdout || "").trim(),
                expected: String(tc.output).trim(),
                error: result?.stderr || result?.compile_output || null
            }
        };
    }

    if (result?.stderr) {
        return {
            verdict: "Runtime Error",
            debug: {
                input: tc.input,
                output: (result?.stdout || "").trim(),
                expected: String(tc.output).trim(),
                error: result.stderr
            }
        };
    }

    const actual = (result?.stdout || "").trim();
    const expected = String(tc.output).trim();
    console.log({ input: tc.input, stdout: result?.stdout, expected: tc.output });

    if (actual !== expected) {
        return {
            verdict: `Wrong Answer (${visibilityLabel} Case)`,
            debug: {
                input: tc.input,
                output: actual,
                expected,
                error: result?.stderr || null
            }
        };
    }

    return null;
};

const worker = new Worker(
    "submission-queue",
    async (job) => {
        const { code, language, questionId, userId, mode, executionId } = job.data;
        const isRunOnly = mode === "run";
        const normalizedLanguage = normalizeLanguage(language);
        const q = questions[questionId];
        const languageId = resolveLanguageId(normalizedLanguage, q?.langMap || {});

        console.log(`Processing job ${job.id}: ${normalizedLanguage} submission for Q:${questionId}`);
        console.log("Function Name:", q?.functionName);
        console.log("User Code:", code);

        if (!q) throw new Error("Question not found");
        if (!boilerplates[normalizedLanguage] || !languageId) throw new Error("Language not supported");

        emitJobStatus(job.id, { executionId, status: "Running..." });

        // --- Run Public Test Cases ---
        emitJobStatus(job.id, { executionId, status: "Executing public test cases..." });
        const publicSubmissions = q.testCases.public.map(tc => ({
            source_code: buildWrappedCode(code, normalizedLanguage, q.functionName, tc.input, q.signature),
            language_id: languageId,
            expected_output: tc.output,
            cpu_time_limit: 2,
            memory_limit: 4096000,
            max_processes_and_or_threads: 30
        }));

        const publicResults = await runBatch(publicSubmissions);

        let maxRuntime = 0;
        let maxMemory = 0;

        for (let i = 0; i < publicResults.length; i++) {
            const result = publicResults[i];
            const tc = q.testCases.public[i];
            console.log("STDOUT:", result?.stdout);
            console.log("STDERR:", result?.stderr);
            console.log("COMPILE:", result?.compile_output);

            const caseFailure = evaluateJudgeCase(result, tc, "Public");
            if (caseFailure) {
                emitJobStatus(job.id, {
                    executionId,
                    status: caseFailure.verdict,
                    result: caseFailure
                });
                return caseFailure;
            }

            if (shouldEmitProgressCheckpoint(i, publicResults.length)) {
                emitJobStatus(job.id, {
                    executionId,
                    status: `Public: ${i + 1}/${publicResults.length}`
                });
            }

            maxRuntime = Math.max(maxRuntime, parseFloat(result.time || 0));
            maxMemory = Math.max(maxMemory, result.memory || 0);
        }

        if (isRunOnly) {
            const runResult = {
                verdict: "Public Tests Passed",
                stats: { runtime: maxRuntime, memory: maxMemory }
            };
            emitJobStatus(job.id, {
                executionId,
                status: "Public Tests Passed",
                result: runResult
            });
            return runResult;
        }

        // --- Run Hidden Test Cases ---
        emitJobStatus(job.id, { executionId, status: "Executing hidden test cases..." });
        const hiddenSubmissions = q.testCases.hidden.map(tc => ({
            source_code: buildWrappedCode(code, normalizedLanguage, q.functionName, tc.input, q.signature),
            language_id: languageId,
            expected_output: tc.output,
            cpu_time_limit: 2,
            memory_limit: 4096000,
            max_processes_and_or_threads: 30
        }));

        const hiddenResults = await runBatch(hiddenSubmissions);

        for (let i = 0; i < hiddenResults.length; i++) {
            const result = hiddenResults[i];
            const tc = q.testCases.hidden[i];
            console.log("STDOUT:", result?.stdout);
            console.log("STDERR:", result?.stderr);
            console.log("COMPILE:", result?.compile_output);
            const caseFailure = evaluateJudgeCase(result, tc, "Hidden Test");
            if (caseFailure) {
                const hiddenFailure = { verdict: caseFailure.verdict };
                emitJobStatus(job.id, {
                    executionId,
                    status: caseFailure.verdict,
                    result: hiddenFailure
                });
                return hiddenFailure;
            }

            if (shouldEmitProgressCheckpoint(i, hiddenResults.length)) {
                emitJobStatus(job.id, {
                    executionId,
                    status: `Hidden: ${i + 1}/${hiddenResults.length}`
                });
            }

            maxRuntime = Math.max(maxRuntime, parseFloat(result.time || 0));
            maxMemory = Math.max(maxMemory, result.memory || 0);
        }

        // --- Update Leaderboard ---
        const existingIndex = leaderboard.findIndex(e => e.userId === userId && e.questionId === questionId);
        if (existingIndex !== -1) {
            if (maxRuntime < leaderboard[existingIndex].runtime) {
                leaderboard[existingIndex] = {
                    userId, questionId, language: normalizedLanguage, runtime: maxRuntime, memory: maxMemory, submittedAt: new Date()
                };
                if (redisClient.isAvailable) {
                    await redisClient.del(`leaderboard:question:${questionId}`);
                }
            }
        } else {
            leaderboard.push({
                userId, questionId, language: normalizedLanguage, runtime: maxRuntime, memory: maxMemory, submittedAt: new Date()
            });
            if (redisClient.isAvailable) {
                await redisClient.del(`leaderboard:question:${questionId}`);
            }
        }

        const acceptedResult = {
            verdict: "Accepted",
            stats: { runtime: maxRuntime, memory: maxMemory }
        };
        emitJobStatus(job.id, {
            executionId,
            status: "Accepted ",
            result: acceptedResult
        });
        return acceptedResult;
    },
    {
        connection,
        concurrency: 3 // Process up to 3 jobs simultaneously
    }
);

worker.on("completed", (job, result) => {
    console.log(`Job ${job.id} completed: ${result?.verdict}`);
});

worker.on("failed", (job, err) => {
    console.error(`Job ${job.id} failed:`, err.message);
    emitJobStatus(job?.id, {
        executionId: job?.data?.executionId,
        status: err.message || "Failed",
        result: { verdict: err.message || "Failed" }
    });
});

process.on("SIGINT", () => {
    workerSocket.disconnect();
    process.exit(0);
});

process.on("SIGTERM", () => {
    workerSocket.disconnect();
    process.exit(0);
});

console.log("Submission Worker started and listening for jobs...");

module.exports = worker;
