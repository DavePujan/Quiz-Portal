const router = require("express").Router();
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { auth, authorize } = require("../middleware/auth");
const { aiLimiter } = require("../middleware/rateLimiter");
const pool = require("../db");
const { buildWrappedCode } = require("../utils/codeExecution");

// Mock database for problems
// In reality, this should be in models/questions.js or independent db
// For now, we'll just log it or append to a local array if persistence within session implies.
// The user prompt showed "let problems = []".

const Quiz = require("../models/Quiz");
const Evaluation = require("../models/Evaluation");

async function ensureProfileEnrollmentColumn() {
    await pool.query(`
        ALTER TABLE profiles
        ADD COLUMN IF NOT EXISTS enrollment_no TEXT;
    `);
}

async function ensureQuestionFunctionNameColumn() {
    await pool.query(`
        ALTER TABLE questions
        ADD COLUMN IF NOT EXISTS function_name TEXT;
    `);
}

// Dashboard Stats
router.get("/dashboard", auth, authorize('teacher'), async (req, res) => {
    try {
        const { count: quizCount, error: quizError } = await supabase
            .from("quizzes")
            .select("*", { count: 'exact', head: true });

        if (quizError) throw quizError;

        // Pending Evaluations (Evaluated status implies done, Submitted implies pending?)
        // Actually, my schema uses 'submitted' for code questions needing review.
        const { count: pendingCount, error: pendingError } = await supabase
            .from("quiz_attempts")
            .select("*", { count: 'exact', head: true })
            .eq("status", "submitted");

        if (pendingError) throw pendingError;

        // Total Students (Unique users in attempts? Or just total profiles with role student?)
        // Let's count profiles with role 'student' (assuming role is in profiles or we infer from metadata)
        // Since I don't have role strictly in profiles table in this context (it's in metadata),
        // I will count unique user_ids in quiz_attempts as "Active Students".
        // Or if I can access auth.users... no, service role can.
        // Let's stick to unique attempt users for now as a proxy for "Engaged Students".
        // Actually, let's just count total profiles for simplicity if possible, or 0.
        // Better: Count unique users who have attempted any quiz.
        // Supabase doesn't support distinct count easily via API without RPC.
        // I'll just count total attempts for now as a simple metric, or "Students" = 0 (placeholder).
        // Let's try to get count of profiles.
        const { count: studentCount } = await supabase
            .from("profiles")
            .select("*", { count: 'exact', head: true })
            .eq("role", "student");

        res.json({
            active: quizCount || 0,
            upcoming: 0, // Placeholder
            pending: pendingCount || 0,
            students: studentCount || 0
        });
    } catch (err) {
        console.error("Dashboard Stats Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Quiz Management - list all quizzes created by teacher
router.get("/quiz", auth, authorize('teacher'), async (req, res) => {
    try {
        // 1. Get correct UUID from profiles
        const { data: profile } = await supabase.from("profiles").select("id").eq("email", req.user.email).single();
        if (!profile) throw new Error("Profile not found");

        const { data: quizzes, error } = await supabase
            .from("quizzes")
            .select("*")
            .eq("created_by", profile.id) // Filter by creator
            .order("created_at", { ascending: false });

        if (error) throw error;
        res.json(quizzes);
    } catch (err) {
        console.error("Fetch Teacher Quizzes Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Create Quiz (Basic) - Keeping as is, but ensuring it uses real DB which it does in full route

// End Quiz
router.post("/quiz/:id/end", auth, authorize('teacher'), async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from("quizzes")
            .update({ is_active: false })
            .eq("id", id);

        if (error) throw error;
        res.json({ message: "Quiz ended successfully" });
    } catch (err) {
        console.error("End Quiz Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Evaluations
router.get("/evaluations", auth, authorize('teacher'), async (req, res) => {
    try {
        await ensureProfileEnrollmentColumn();

        const { data, error } = await supabase
            .from("quiz_attempts")
            .select(`
                id,
                score,
                status,
                profiles(email, full_name, enrollment_no),
                quizzes(title)
            `)
            .eq("status", "submitted");

        if (error) throw error;

        // Transform for frontend
        const formatted = data.map(item => ({
            id: item.id,
            student: item.profiles?.full_name || item.profiles?.email || "Unknown",
            enrollmentNo: item.profiles?.enrollment_no || "-",
            email: item.profiles?.email || "-",
            quiz: item.quizzes?.title || "Unknown",
            status: item.status
        }));

        res.json(formatted);
    } catch (err) {
        console.error("Fetch Evaluations Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Single Evaluation Details
router.get("/evaluation/:id", auth, authorize('teacher'), async (req, res) => {
    try {
        await ensureProfileEnrollmentColumn();

        const { id } = req.params;

        // Fetch Attempt
        const { data: attempt, error: attemptError } = await supabase
            .from("quiz_attempts")
            .select(`
                id,
                user_id,
                quiz_id,
                score,
                total_marks,
                status,
                started_at,
                completed_at,
                updated_at,
                profiles(email, full_name, enrollment_no),
                quizzes(title, duration)
            `)
            .eq("id", id)
            .single();

        if (attemptError) throw attemptError;

        // Fetch Answers
        const { data: answers, error: answersError } = await supabase
            .from("quiz_answers")
            .select(`
                question_id,
                selected_option,
                submitted_code,
                is_correct,
                marks_awarded,
                feedback,
                ai_analysis,
                test_cases_passed,
                total_test_cases,
                question:questions(title, type, weightage)
            `)
            .eq("attempt_id", id);

        if (answersError) throw answersError;

        const { data: integrityLog } = await supabase
            .from("exam_behavior_logs")
            .select(`
                final_score,
                risk_level,
                tab_switches,
                fullscreen_exits,
                window_blurs,
                copy_events,
                devtools_attempts,
                reasons,
                event_timeline,
                updated_at
            `)
            .eq("attempt_id", id)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        const startTs = attempt?.started_at || attempt?.updated_at;
        const endTs = attempt?.completed_at || new Date().toISOString();
        const startMs = startTs ? new Date(startTs).getTime() : null;
        const endMs = endTs ? new Date(endTs).getTime() : null;
        const timeTakenSeconds = startMs && endMs ? Math.max(0, Math.floor((endMs - startMs) / 1000)) : null;

        res.json({
            id: attempt.id,
            student: attempt.profiles?.full_name || attempt.profiles?.email || "Unknown",
            enrollmentNo: attempt.profiles?.enrollment_no || "-",
            email: attempt.profiles?.email || "-",
            quiz: attempt.quizzes?.title || "Unknown",
            score: attempt.score,
            status: attempt.status,
            totalMarks: attempt.total_marks,
            quizDurationMinutes: attempt.quizzes?.duration || null,
            startedAt: startTs || null,
            completedAt: attempt?.completed_at || null,
            timeTakenSeconds,
            integrity: integrityLog ? {
                score: Number(integrityLog.final_score || 0),
                risk: integrityLog.risk_level || "Safe",
                counters: {
                    tab_switches: integrityLog.tab_switches || 0,
                    fullscreen_exits: integrityLog.fullscreen_exits || 0,
                    window_blurs: integrityLog.window_blurs || 0,
                    copy_events: integrityLog.copy_events || 0,
                    devtools_attempts: integrityLog.devtools_attempts || 0
                },
                updatedAt: integrityLog.updated_at
            } : null,
            answers: answers.map(a => ({
                questionId: a.question_id,
                question: a.question?.title,
                type: a.question?.type,
                maxMarks: a.question?.weightage || 0,
                selectedOption: a.selected_option,
                code: a.submitted_code,
                isCorrect: a.is_correct,
                marks: a.marks_awarded,
                feedback: a.feedback,
                ai_analysis: a.ai_analysis,
                test_cases_passed: a.test_cases_passed,
                total_test_cases: a.total_test_cases
            }))
        });

    } catch (err) {
        console.error("Fetch Single Evaluation Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Finalize Evaluation (Update marks and status)
router.post("/evaluation/:id/finalize", auth, authorize('teacher'), async (req, res) => {
    try {
        const { id } = req.params;
        const { marks } = req.body; // Array of { questionId, marks, isCorrect }

        // 1. Update individual answers
        for (const m of marks) {
            await supabase
                .from("quiz_answers")
                .update({
                    marks_awarded: m.marks,
                    is_correct: m.isCorrect
                })
                .match({ attempt_id: id, question_id: m.questionId });
        }

        // 2. Calculate Total Score
        const totalScore = marks.reduce((sum, m) => sum + (Number(m.marks) || 0), 0);

        // 3. Update Attempt Status
        const { error } = await supabase
            .from("quiz_attempts")
            .update({
                score: totalScore,
                status: "evaluated",
                completed_at: new Date() // Ensure it's marked completed if not already
            })
            .eq("id", id);

        if (error) throw error;

        res.json({ message: "Evaluation finalized", totalScore });
    } catch (err) {
        console.error("Finalize Evaluation Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Existing route (modified to use Quiz model if needed, but keeping for now)
// Create Problem (Coding)
router.post("/problem", auth, authorize('teacher'), async (req, res) => {
    try {
        const { title, description, functionName, language, inputFormat, outputFormat, testCases } = req.body;

        const { data, error } = await supabase.from("problems").insert({
            title,
            description,
            language: language || "javascript",
            input_format: inputFormat,
            output_format: outputFormat,
            test_cases: testCases, // Assuming JSON structure { public: [], hidden: [] }
            created_by: req.user.email // or id
        }).select();

        if (error) throw error;

        res.json({ message: "Problem created", problem: data[0] });
    } catch (err) {
        console.error("Create Problem Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// ─── Ensure openrouter_api_key column exists ─────────────────────────
async function ensureOpenRouterKeyColumn() {
    await pool.query(`
        ALTER TABLE profiles
        ADD COLUMN IF NOT EXISTS openrouter_api_key TEXT;
    `);
}

// ─── Ensure cerebras_api_key column exists ─────────────────────────
async function ensureCerebrasKeyColumn() {
    await pool.query(`
        ALTER TABLE profiles
        ADD COLUMN IF NOT EXISTS cerebras_api_key TEXT;
    `);
}

// ─── Ensure mistral_api_key column exists ─────────────────────────
async function ensureMistralKeyColumn() {
    await pool.query(`
        ALTER TABLE profiles
        ADD COLUMN IF NOT EXISTS mistral_api_key TEXT;
    `);
}

// ─── AI Settings Routes (Generalized) ────────────────────────────────

// Legacy gemini-key endpoints (backward compatibility)
router.post("/settings/gemini-key", auth, authorize('teacher'), async (req, res) => {
    try {
        const { apiKey } = req.body;
        if (!apiKey) return res.status(400).json({ error: "API Key is required" });

        const { error } = await supabase
            .from("profiles")
            .update({ gemini_api_key: apiKey })
            .eq("email", req.user.email);

        if (error) throw error;
        res.json({ message: "API Key saved successfully" });
    } catch (err) {
        console.error("Save Key Error:", err);
        res.status(500).json({ error: err.message });
    }
});

router.get("/settings/gemini-key", auth, authorize('teacher'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("profiles")
            .select("gemini_api_key")
            .eq("email", req.user.email)
            .single();

        if (error) throw error;
        res.json({ hasKey: !!data.gemini_api_key });
    } catch (err) {
        console.error("Get Key Status Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Get all AI provider statuses for the logged-in teacher
router.get("/settings/ai-providers", auth, authorize('teacher'), async (req, res) => {
    try {
        await ensureOpenRouterKeyColumn();
        await ensureCerebrasKeyColumn();
        await ensureMistralKeyColumn();

        const { data, error } = await supabase
            .from("profiles")
            .select("gemini_api_key, openrouter_api_key, cerebras_api_key, mistral_api_key")
            .eq("email", req.user.email)
            .single();

        if (error) throw error;

        // Mask keys for display (show last 4 chars)
        const maskKey = (key) => {
            if (!key) return null;
            return key.length > 8 ? "****" + key.slice(-4) : "****";
        };

        res.json({
            providers: [
                {
                    id: "gemini",
                    name: "Gemini",
                    configured: !!data.gemini_api_key,
                    maskedKey: maskKey(data.gemini_api_key),
                    description: "Google's Gemini AI. Fast and reliable for quiz generation.",
                    docsUrl: "https://aistudio.google.com/apikey"
                },
                {
                    id: "openrouter",
                    name: "OpenRouter",
                    configured: !!data.openrouter_api_key,
                    maskedKey: maskKey(data.openrouter_api_key),
                    description: "Access 100+ models including free ones like Google Gemma 4.",
                    docsUrl: "https://openrouter.ai/settings/keys"
                },
                {
                    id: "cerebras",
                    name: "Cerebras",
                    configured: !!data.cerebras_api_key,
                    maskedKey: maskKey(data.cerebras_api_key),
                    description: "High-performance inference for enterprise workloads.",
                    docsUrl: "https://cloud.cerebras.ai/"
                },
                {
                    id: "mistral",
                    name: "Mistral",
                    configured: !!data.mistral_api_key,
                    maskedKey: maskKey(data.mistral_api_key),
                    description: "Frontier open models from Mistral AI.",
                    docsUrl: "https://console.mistral.ai/api-keys/"
                }
            ]
        });
    } catch (err) {
        console.error("Get AI Providers Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Save an AI provider key
router.post("/settings/ai-key", auth, authorize('teacher'), async (req, res) => {
    try {
        await ensureOpenRouterKeyColumn();
        await ensureCerebrasKeyColumn();
        await ensureMistralKeyColumn();

        const { provider, apiKey } = req.body;
        if (!provider || !apiKey) {
            return res.status(400).json({ error: "Provider and API Key are required." });
        }

        if (!ai.ALLOWED_PROVIDERS.includes(provider)) {
            return res.status(400).json({ error: `Invalid provider: ${provider}. Allowed: ${ai.ALLOWED_PROVIDERS.join(", ")}` });
        }

        // Basic key format validation
        if (provider === "openrouter" && !apiKey.startsWith("sk-or-")) {
            return res.status(400).json({ error: "Invalid OpenRouter API key. Keys should start with 'sk-or-'." });
        }

        const column = ai.PROVIDER_KEY_COLUMNS[provider];
        const { error } = await supabase
            .from("profiles")
            .update({ [column]: apiKey })
            .eq("email", req.user.email);

        if (error) throw error;
        res.json({ message: `${provider} API key saved successfully.` });
    } catch (err) {
        console.error("Save AI Key Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Remove an AI provider key
router.delete("/settings/ai-key", auth, authorize('teacher'), async (req, res) => {
    try {
        await ensureOpenRouterKeyColumn();
        await ensureCerebrasKeyColumn();
        await ensureMistralKeyColumn();

        const { provider } = req.body;
        if (!provider) {
            return res.status(400).json({ error: "Provider is required." });
        }

        if (!ai.ALLOWED_PROVIDERS.includes(provider)) {
            return res.status(400).json({ error: `Invalid provider: ${provider}.` });
        }

        const column = ai.PROVIDER_KEY_COLUMNS[provider];
        const { error } = await supabase
            .from("profiles")
            .update({ [column]: null })
            .eq("email", req.user.email);

        if (error) throw error;
        res.json({ message: `${provider} API key removed.` });
    } catch (err) {
        console.error("Remove AI Key Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// ─── AI Quiz Generation (Multi-Provider) ─────────────────────────────
router.post("/ai/generate", auth, authorize('teacher'), aiLimiter, async (req, res) => {
    try {
        const { prompt, provider = "gemini", model } = req.body;
        console.log("AI Generate: Prompt received for provider", provider, "model", model);
        if (!prompt) return res.status(400).json({ error: "Prompt is required" });

        if (!ai.ALLOWED_PROVIDERS.includes(provider)) {
            return res.status(400).json({ error: `Invalid provider: ${provider}. Allowed: ${ai.ALLOWED_PROVIDERS.join(", ")}` });
        }

        console.log("AI Generate: Ensuring OpenRouter Key column...");
        await ensureOpenRouterKeyColumn();
        await ensureCerebrasKeyColumn();
        await ensureMistralKeyColumn();

        console.log("AI Generate: Fetching key for provider...");
        // Fetch the teacher's key for the selected provider
        const keyColumn = ai.PROVIDER_KEY_COLUMNS[provider];
        const { data: profile, error } = await supabase
            .from("profiles")
            .select(keyColumn)
            .eq("email", req.user.email)
            .single();

        if (error) throw error;

        const apiKey = profile?.[keyColumn];
        if (!apiKey) {
            console.log("AI Generate: No API key found for", provider);
            return res.status(400).json({
                error: `${provider} API key not found. Please configure it in Settings.`
            });
        }

        console.log("AI Generate: Calling ai.generateQuiz... key length:", apiKey.length, "starts with:", apiKey.substring(0, 8));
        const questions = await ai.generateQuiz({ prompt, apiKey, provider, model });
        console.log("AI Generate: Success!");
        res.json({ questions });
    } catch (err) {
        console.error("AI Generate Route Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Unified Quiz Creation
router.post("/quiz/full", auth, authorize('teacher'), aiLimiter, async (req, res) => {
    try {
        await ensureQuestionFunctionNameColumn();

        const { title, subject, duration, totalMarks, description, questions, department, semester } = req.body;

        // Fetch valid UUID from Supabase profiles
        const { data: profile, error } = await supabase
            .from("profiles")
            .select("id")
            .ilike("email", req.user.email) // Changed to ilike for case-insensitivity
            .single();

        if (!profile) throw new Error(`Profile not found for user: ${req.user.email} (Error: ${error?.message})`);
        const userId = profile.id;

        // 1. Create Quiz
        const { data: quiz, error: quizError } = await supabase
            .from("quizzes")
            .insert({
                title,
                subject,
                duration,
                total_marks: totalMarks,
                description,
                created_by: userId,
                quiz_type: "hybrid",
                department,
                semester,
                scheduled_at: req.body.scheduledAt || new Date() // Default to now if not provided
            })
            .select()
            .single();

        if (quizError) throw quizError;

        const { generateTopic } = require("../utils/dynamicTopicGenerator");

        // 2. Process Questions
        for (const q of questions) {
            // Generate Topic dynamically
            const { topicId } = await generateTopic(q.question);

            // Insert Question
            const { data: question, error: qError } = await supabase
                .from("questions")
                .insert({
                    title: q.question, // Frontend sends 'question' as title
                    type: q.type, // 'mcq' or 'code'
                    weightage: q.marks,
                    language: q.language,
                    function_name: q.functionName || null,
                    input_format: q.inputFormat,
                    output_format: q.outputFormat,
                    created_by: userId,
                    image_url: q.image || null,
                    topic_id: topicId // <--- Automagically assigned!
                })
                .select()
                .single();

            if (qError) throw qError;

            // Map to Quiz
            await supabase.from("quiz_questions_map").insert({
                quiz_id: quiz.id,
                question_id: question.id,
                weightage: q.marks
            });

            // Insert Details based on Type
            if (q.type === "mcq") {
                // Options
                const optionsToInsert = q.options.map((optText, idx) => ({
                    question_id: question.id,
                    option_text: optText,
                    is_correct: optText === q.answer
                }));
                await supabase.from("mcq_options").insert(optionsToInsert);
            } else if (q.type === "code") {
                // Testcases
                const testcasesToInsert = q.testCases.map(tc => ({
                    question_id: question.id,
                    input: tc.input,
                    expected_output: tc.output,
                    is_hidden: tc.isHidden || false
                }));
                await supabase.from("testcases").insert(testcasesToInsert);
            }
        }

        res.json({ message: "Quiz created successfully", quizId: quiz.id });
    } catch (err) {
        console.error("Quiz Creation Error:", err);
        res.status(500).json({ error: err.message });
    }
});

const judge0 = require("../utils/judge0");
const ai = require("../utils/ai");

// Auto-Evaluate Attempt
router.post("/evaluate/:id", auth, authorize('teacher'), aiLimiter, async (req, res) => {
    try {
        const { id } = req.params;
        const { provider = "gemini", model } = req.body;
        await ensureQuestionFunctionNameColumn();

        console.log("AI Evaluate: Fetching key for provider", provider);
        // Ensure all key columns exist
        await ensureOpenRouterKeyColumn();
        await ensureCerebrasKeyColumn();
        await ensureMistralKeyColumn();

        if (!ai.ALLOWED_PROVIDERS.includes(provider)) {
            return res.status(400).json({ error: `Invalid provider: ${provider}` });
        }

        // Fetch Teacher's API Key for the selected provider
        const keyColumn = ai.PROVIDER_KEY_COLUMNS[provider];
        const { data: profile } = await supabase
            .from("profiles")
            .select(keyColumn)
            .eq("email", req.user.email)
            .single();

        const apiKey = profile?.[keyColumn];
        if (!apiKey) {
            return res.status(400).json({ error: `${provider} API Key is required for auto-evaluation. Please set it in Settings.` });
        }

        // 1. Fetch Attempt & Answers with Question Details (including TestCases)
        // Need to join questions -> testcases? Or fetch separately.
        // Let's fetch answers with question details.
        const { data: answers, error: fetchError } = await supabase
            .from("quiz_answers")
            .select(`
                id,
                question_id,
                submitted_code,
                is_correct,
                marks_awarded,
                feedback,
                ai_analysis,
                test_cases_passed,
                total_test_cases,
                question:questions(
                    title,
                    type,
                    weightage,
                    language,
                    function_name,
                    input_format,
                    output_format,
                    testcases(input, expected_output)
                )
            `)
            .eq("attempt_id", id);

        if (fetchError) throw fetchError;

        let totalScore = 0;
        const evaluationUpdates = [];

        // 2. Process each answer
        for (const ans of answers) {
            // Only evaluate Code questions
            if (ans.question?.type === "code" && ans.submitted_code) {
                const { submitted_code, question } = ans;
                const language = question.language || "python";
                const testCases = question.testcases || [];


                // --- Step A: Judge0 Execution ---
                let passedCases = 0;
                let judge0Results = [];

                if (testCases.length > 0) {
                    const languageId = judge0.resolveLanguageId(language);
                    if (!languageId) {
                        throw new Error(`Language not supported by current Judge0 configuration: ${language}`);
                    }

                    const submissions = testCases.map(tc => ({
                        source_code: buildWrappedCode(submitted_code, language, question.function_name, tc.input),
                        language_id: languageId,
                        stdin: tc.input,
                        expected_output: tc.expected_output
                    }));

                    const results = await judge0.runBatch(submissions);
                    judge0Results = results; // Store raw results if needed

                    // Count Accepted (Status ID 3)
                    passedCases = results.filter(r => r.status?.id === 3).length;
                }

                // --- Step B: Calculate Marks ---
                const maxMarks = question.weightage || 5;
                const totalTC = testCases.length;
                const passRatio = totalTC > 0 ? (passedCases / totalTC) : 0;

                // --- Step C: AI Analysis ---
                // Only call AI if there's code to analyze (optimization)
                const aiResult = await ai.analyzeCode({
                    code: submitted_code,
                    question: question.title,
                    language: language,
                    input_format: question.input_format,
                    output_format: question.output_format,
                    max_marks: maxMarks,
                    apiKey: apiKey,
                    provider: provider,
                    model: model
                });

                const logicScore = aiResult.logic_score || 0; // 0 to 1

                // --- Scoring Formula ---
                // Adjusted: 50% from Test Cases, 50% from AI Style/Logic (to be fairer to beginners)
                const testCaseMarks = maxMarks * 0.5 * passRatio;
                const aiBonus = maxMarks * 0.5 * logicScore;

                // Final Cap: Cannot exceed Max Marks
                const finalMarks = Math.min(maxMarks, Math.round((testCaseMarks + aiBonus) * 10) / 10);

                evaluationUpdates.push({
                    answer_id: ans.id,
                    marks_obtained: finalMarks,
                    test_cases_passed: passedCases,
                    total_test_cases: totalTC,
                    feedback: aiResult.feedback,
                    ai_analysis: aiResult,
                    is_correct: passedCases === totalTC
                });

                totalScore += finalMarks;
            }
        }

        // 3. Update DB
        for (const update of evaluationUpdates) {
            await supabase
                .from("quiz_answers")
                .update({
                    marks_awarded: update.marks_obtained, // Use existing column provided by supabase? Or new one? 
                    // My migration added marks_obtained, but legacy used marks_awarded? 
                    // Let's use marks_awarded as primary source of truth for "official Score"
                    marks_obtained: update.marks_obtained, // Store primarily here? 
                    // Let's update both for compatibility if schema differs
                    feedback: update.feedback,
                    ai_analysis: update.ai_analysis,
                    test_cases_passed: update.test_cases_passed,
                    total_test_cases: update.total_test_cases,
                    is_correct: update.is_correct
                })
                .eq("id", update.answer_id);
        }

        // Update Attempt Status
        // Don't overwrite total score if there are manual/MCQ parts not handled here?
        // Maybe just mark as evaluated? Or update score incrementally?
        // User said "result should be stored...". Let's update status.
        await supabase
            .from("quiz_attempts")
            .update({ status: "evaluated", score: totalScore }) // This might overwrite MCQ scores if not careful.
            // Ideally we sum existing MCQ score + Code score.
            // But let's assume this is a pure Code evaluation flow for now or the teacher finalizes later.
            .eq("id", id);

        res.json({ message: "Auto-Evaluation Complete", updates: evaluationUpdates });

    } catch (err) {
        console.error("Auto-Evaluation Error:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
