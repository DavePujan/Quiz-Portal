const express = require("express");
const router = express.Router();
const { runBatch, normalizeLanguage, resolveLanguageId } = require("../utils/judge0");
const { buildWrappedCode } = require("../utils/codeExecution");
const questions = require("../models/Question");
const { auth } = require("../middleware/auth");
const leaderboard = require("../models/Leaderboard");
const crypto = require("crypto");
const redisClient = require("../config/redis");
const { submissionQueue } = require("../queues/submission.queue");

// Simple In-Memory Cache (LRU-like but just map for now)
const submissionCache = new Map();

// Mock Problems List
const problemsList = [
    { id: "add-two", title: "Add Two Numbers" },
    { id: "fibonacci", title: "Fibonacci Number" },
    { id: "two-sum", title: "Two Sum" }
];

router.get("/problems", async (req, res) => {
    res.json(problemsList);
});

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

router.post("/submit", auth, async (req, res) => {
    const { code, language, questionId } = req.body;
    const normalizedLanguage = normalizeLanguage(language);
    const q = questions[questionId];
    const languageId = resolveLanguageId(normalizedLanguage, q?.langMap || {});
    const userId = req.user.id;

    if (!q) return res.status(404).json({ verdict: "Question not found" });

    // 1. Security Checks
    if (code.includes("require('fs')") || code.includes("System.exit") || code.includes("window.")) {
        return res.json({ verdict: "Security Violation: Unsafe Code Detected" });
    }

    // 2. Cache Check (Hash: code + lang + question)
    const cacheKey = crypto.createHash("sha256").update(code + normalizedLanguage + questionId).digest("hex");
    if (submissionCache.has(cacheKey)) {
        console.log("⚡ Cache Hit for submission");
        return res.json(submissionCache.get(cacheKey));
    }

    try {
        // Prepare Public Batch
        if (!languageId) {
            return res.json({ verdict: "Language not supported" });
        }

        const publicSubmissions = q.testCases.public.map(tc => ({
            source_code: buildWrappedCode(code, normalizedLanguage, q.functionName, tc.input, q.signature),
            language_id: languageId,
            expected_output: tc.output,
            cpu_time_limit: 2,
            memory_limit: 128000,
            max_processes_and_or_threads: 30
        }));

        // Run Public Batch
        const publicResults = await runBatch(publicSubmissions);

        // Check Public Results
        let maxRuntime = 0;
        let maxMemory = 0;

        for (let i = 0; i < publicResults.length; i++) {
            const result = publicResults[i];
            const tc = q.testCases.public[i];

            const caseFailure = evaluateJudgeCase(result, tc, "Public");
            if (caseFailure) {
                const response = caseFailure;
                submissionCache.set(cacheKey, response);
                return res.json(response);
            }
            maxRuntime = Math.max(maxRuntime, parseFloat(result.time || 0));
            maxMemory = Math.max(maxMemory, result.memory || 0);
        }

        // If Public Passed, Run Hidden
        const hiddenSubmissions = q.testCases.hidden.map(tc => ({
            source_code: buildWrappedCode(code, normalizedLanguage, q.functionName, tc.input, q.signature),
            language_id: languageId,
            expected_output: tc.output,
            cpu_time_limit: 2,
            memory_limit: 128000,
            max_processes_and_or_threads: 30
        }));

        const hiddenResults = await runBatch(hiddenSubmissions);

        for (let i = 0; i < hiddenResults.length; i++) {
            const result = hiddenResults[i];
            const tc = q.testCases.hidden[i];
            const caseFailure = evaluateJudgeCase(result, tc, "Hidden Test");
            if (caseFailure) {
                const response = { verdict: caseFailure.verdict };
                submissionCache.set(cacheKey, response);
                return res.json(response);
            }
            maxRuntime = Math.max(maxRuntime, parseFloat(result.time || 0));
            maxMemory = Math.max(maxMemory, result.memory || 0);
        }

        // Success
        const response = {
            verdict: "Accepted",
            stats: { runtime: maxRuntime, memory: maxMemory }
        };
        submissionCache.set(cacheKey, response);

        // Update Leaderboard
        const existingIndex = leaderboard.findIndex(e => e.userId === userId && e.questionId === questionId);
        if (existingIndex !== -1) {
            if (maxRuntime < leaderboard[existingIndex].runtime) {
                leaderboard[existingIndex] = {
                    userId, questionId, language: normalizedLanguage, runtime: maxRuntime, memory: maxMemory, submittedAt: new Date()
                };
                // STEP 4: Cache validation (Invalidate Redis exactly for this question's leaderboard)
                if (redisClient.isAvailable) {
                    await redisClient.del(`leaderboard:question:${questionId}`);
                }
            }
        } else {
            leaderboard.push({
                userId, questionId, language: normalizedLanguage, runtime: maxRuntime, memory: maxMemory, submittedAt: new Date()
            });
            // STEP 4: Cache Invalidation
            if (redisClient.isAvailable) {
                await redisClient.del(`leaderboard:question:${questionId}`);
            }
        }

        res.json(response);

    } catch (error) {
        console.error(error);
        res.status(500).json({ verdict: "Server Error" });
    }
});

// ========== ASYNC SUBMISSION (BullMQ) ==========
router.post("/submit-async", auth, async (req, res) => {
    const { code, language, questionId, executionId } = req.body;
    const mode = req.query.mode === "run" ? "run" : "submit";
    const normalizedLanguage = normalizeLanguage(language);
    const userId = req.user.id;
    const q = questions[questionId];
    const languageId = resolveLanguageId(normalizedLanguage, q?.langMap || {});

    if (!q) return res.status(404).json({ verdict: "Question not found" });

    // Security Check
    if (code.includes("require('fs')") || code.includes("System.exit") || code.includes("window.")) {
        return res.json({ verdict: "Security Violation: Unsafe Code Detected" });
    }

    // Cache Check
    const cacheKey = crypto.createHash("sha256").update(code + normalizedLanguage + questionId + mode).digest("hex");
    if (submissionCache.has(cacheKey)) {
        console.log("⚡ Cache Hit for submission");
        return res.json({ cached: true, ...submissionCache.get(cacheKey) });
    }

    if (!languageId) {
        return res.json({ verdict: "Language not supported" });
    }

    try {
        const job = await submissionQueue.add("run-code", {
            code, language: normalizedLanguage, questionId, userId, mode, executionId
        }, {
            attempts: 3,
            backoff: { type: "exponential", delay: 2000 }
        });

        res.json({
            message: "Submission queued",
            jobId: job.id
        });
    } catch (err) {
        console.error("Queue Error:", err.message);
        res.status(500).json({ error: "Failed to queue submission. Try the sync endpoint." });
    }
});

module.exports = router;
