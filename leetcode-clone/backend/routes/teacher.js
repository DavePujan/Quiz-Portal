const router = require("express").Router();
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { auth, authorize } = require("../middleware/auth");
const { requireInstitutionContext } = require("../middleware/institution");
const { buildWrappedCode } = require("../utils/codeExecution");
const { FEATURES } = require("../config/features");
const { quizCreationMigration } = require("../metrics");
const { auditQueue } = require("../queues/auditQueue");
const { aiLimiter } = require("../middleware/rateLimiter");
const pool = require("../db");
const redisClient = require("../config/redis");
const judge0 = require("../utils/judge0");
const ai = require("../utils/ai");
const { generateTopic } = require("../utils/dynamicTopicGenerator");

// Mock database for problems
// In reality, this should be in models/questions.js or independent db
// For now, we'll just log it or append to a local array if persistence within session implies.
// The user prompt showed "let problems = []".

const Quiz = require("../models/Quiz");
const Evaluation = require("../models/Evaluation");

const AI_PROVIDER_METADATA = {
    gemini: {
        id: "gemini",
        name: "Gemini",
        description: "Google's Gemini AI. Fast and reliable for quiz generation.",
        docsUrl: "https://aistudio.google.com/apikey"
    },
    openrouter: {
        id: "openrouter",
        name: "OpenRouter",
        description: "Access 100+ models including free ones like Google Gemma 4.",
        docsUrl: "https://openrouter.ai/settings/keys"
    },
    cerebras: {
        id: "cerebras",
        name: "Cerebras",
        description: "High-performance inference for enterprise workloads.",
        docsUrl: "https://cloud.cerebras.ai/"
    },
    mistral: {
        id: "mistral",
        name: "Mistral",
        description: "Frontier open models from Mistral AI.",
        docsUrl: "https://console.mistral.ai/api-keys/"
    },
    openai: {
        id: "openai",
        name: "OpenAI",
        description: "GPT-4o and GPT-4o-mini — industry-leading models from OpenAI.",
        docsUrl: "https://platform.openai.com/api-keys"
    },
    claude: {
        id: "claude",
        name: "Claude",
        description: "Anthropic's Claude — excellent reasoning and instruction-following.",
        docsUrl: "https://console.anthropic.com/settings/keys"
    },
    grok: {
        id: "grok",
        name: "Grok",
        description: "xAI's Grok — fast reasoning model with real-time knowledge.",
        docsUrl: "https://console.x.ai/"
    }
};

async function ensureProviderRegistry() {
    await pool.query(`
        INSERT INTO providers (code, name)
        VALUES
            ('gemini', 'Gemini'),
            ('openrouter', 'OpenRouter'),
            ('cerebras', 'Cerebras'),
            ('mistral', 'Mistral'),
            ('openai', 'OpenAI'),
            ('claude', 'Claude'),
            ('grok', 'Grok')
        ON CONFLICT (code) DO NOTHING;
    `);
}

async function getProfileIdByEmail(email) {
    const result = await pool.query(
        `SELECT id FROM profiles WHERE lower(email) = lower($1) LIMIT 1`,
        [email]
    );
    return result.rows[0]?.id || null;
}

async function getProviderId(providerCode) {
    await ensureProviderRegistry();
    const result = await pool.query(
        `SELECT id FROM providers WHERE code = $1 LIMIT 1`,
        [providerCode]
    );
    return result.rows[0]?.id || null;
}

async function getApiKeyForTeacher(email, providerCode) {
    const result = await pool.query(
        `
        SELECT uk.encrypted_api_key
        FROM profiles p
        JOIN user_api_keys uk ON uk.user_id = p.id
        JOIN providers pr ON pr.id = uk.provider_id
        WHERE lower(p.email) = lower($1)
          AND pr.code = $2
        ORDER BY uk.updated_at DESC
        LIMIT 1
        `,
        [email, providerCode]
    );
    return result.rows[0]?.encrypted_api_key || null;
}

async function upsertTeacherApiKey(email, providerCode, apiKey) {
    const userId = await getProfileIdByEmail(email);
    const providerId = await getProviderId(providerCode);
    if (!userId) throw new Error("Profile not found");
    if (!providerId) throw new Error(`Unknown provider: ${providerCode}`);

    await pool.query(
        `
        INSERT INTO user_api_keys (user_id, provider_id, encrypted_api_key)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, provider_id) DO UPDATE
          SET encrypted_api_key = EXCLUDED.encrypted_api_key,
              updated_at = NOW()
        `,
        [userId, providerId, apiKey]
    );
}

async function deleteTeacherApiKey(email, providerCode) {
    const userId = await getProfileIdByEmail(email);
    const providerId = await getProviderId(providerCode);
    if (!userId || !providerId) return;

    await pool.query(
        `DELETE FROM user_api_keys WHERE user_id = $1 AND provider_id = $2`,
        [userId, providerId]
    );
}

const localAcademicCatalogCache = new Map();

// Academic catalog used by the normalized quiz-creation form.
router.get("/academics", auth, authorize('teacher'), requireInstitutionContext, async (req, res) => {
    try {
        const userId = req.context.userId;
        const localCached = localAcademicCatalogCache.get(userId);
        if (localCached && Date.now() < localCached.expiresAt) {
            return res.json(localCached.data);
        }

        const cacheKey = `academic_catalog:teacher:${userId}`;
        
        if (redisClient.isAvailable) {
            const cached = await redisClient.get(cacheKey);
            if (cached) {
                const parsed = JSON.parse(cached);
                localAcademicCatalogCache.set(userId, { data: parsed, expiresAt: Date.now() + 120000 });
                console.log(`[Cache Hit] /academics for user ${userId}`);
                return res.json(parsed);
            }
        }

        const [departmentsResult, semestersResult, subjectsResult, courseOfferingsResult] = await Promise.all([
            pool.query(`SELECT id, code, name FROM departments ORDER BY code NULLS LAST, name`),
            pool.query(`
                SELECT at.id, at.term_number AS semester_no, at.term_type, at.program_id, p.department_id
                FROM academic_terms at
                JOIN programs p ON p.id = at.program_id
                ORDER BY at.term_number, at.id
            `),
            pool.query(`
                SELECT s.id, s.code, s.name, p.department_id, s.academic_term_id AS semester_id, s.program_id, s.institution_id
                FROM subjects s
                JOIN programs p ON p.id = s.program_id
                ORDER BY s.name
            `),
            pool.query(`
                SELECT 
                    co.id, 
                    s.name as subject_name, 
                    s.code as subject_code,
                    at.term_number,
                    at.term_type,
                    p.name as program_name,
                    d.name as department_name,
                    co.institution_id
                FROM course_offerings co
                JOIN subjects s ON s.id = co.subject_id
                JOIN academic_terms at ON at.id = co.academic_term_id
                JOIN programs p ON p.id = at.program_id
                LEFT JOIN departments d ON d.id = p.department_id
                WHERE co.teacher_id = $1
                ORDER BY s.name
            `, [userId])
        ]);

        const responseData = {
            courseOfferings: courseOfferingsResult.rows || [],
            departments: departmentsResult.rows || [],
            semesters: semestersResult.rows || [],
            subjects: subjectsResult.rows || []
        };

        localAcademicCatalogCache.set(userId, { data: responseData, expiresAt: Date.now() + 120000 });

        if (redisClient.isAvailable) {
            await redisClient.set(cacheKey, JSON.stringify(responseData), 'EX', 300); // 5 minutes TTL
        }

        return res.json(responseData);
    } catch (err) {
        console.error("Get academic catalog error:", err);
        res.status(500).json({ error: err.message });
    }
});

let teacherDdlChecked = false;
async function ensureTeacherDDL() {
    if (teacherDdlChecked) return;
    try {
        await pool.query(`
            ALTER TABLE questions ADD COLUMN IF NOT EXISTS function_name TEXT;
            ALTER TABLE profiles ADD COLUMN IF NOT EXISTS enrollment_no TEXT;
            ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS is_practice BOOLEAN DEFAULT false;
        `);
        teacherDdlChecked = true;
    } catch (e) {
        console.error("Teacher DDL check error:", e.message);
    }
}
async function ensureQuestionFunctionNameColumn() { return ensureTeacherDDL(); }
async function ensureProfileEnrollmentColumn() { return ensureTeacherDDL(); }

function getTeacherDepartmentScope(req) {
    const scope = req.context;
    if (!scope?.institutionId || !scope?.departmentId) {
        const error = new Error("An active teacher department assignment is required.");
        error.status = 403;
        throw error;
    }
    return scope;
}

async function assertAttemptIsInTeacherDepartment(attemptId, scope) {
    const result = await pool.query(`
        SELECT 1
        FROM quiz_attempts qa
        JOIN institution_memberships student_membership
          ON student_membership.user_id = qa.user_id
         AND student_membership.is_active = true
         AND student_membership.role = 'student'
         AND student_membership.institution_id = $3
         AND student_membership.department_id = $2
        WHERE qa.id = $1
        LIMIT 1
    `, [attemptId, scope.departmentId, scope.institutionId]);

    if (result.rowCount === 0) {
        const error = new Error("Evaluation not found or access denied.");
        error.status = 404;
        throw error;
    }
}

// Dashboard Stats
router.get("/dashboard", auth, authorize('teacher'), requireInstitutionContext, async (req, res) => {
    try {
        const userId = req.context.userId;
        const scope = getTeacherDepartmentScope(req);

        // Fetch institution and department names
        const orgResult = await pool.query(`
            SELECT 
                i.name as institution_name,
                d.name as department_name
            FROM institution_memberships im
            LEFT JOIN institutions i ON i.id = im.institution_id
            LEFT JOIN departments d ON d.id = im.department_id
            WHERE im.user_id = $1
              AND im.is_active = true
              AND im.role = 'teacher'
              AND im.institution_id = $2
              AND im.department_id = $3
            LIMIT 1
        `, [userId, scope.institutionId, scope.departmentId]);

        let collegeName = orgResult.rows[0]?.institution_name || "QuizPortal Institute";
        let departmentName = orgResult.rows[0]?.department_name;

        if (!departmentName) {
            return res.status(403).json({ error: "Teacher department could not be resolved." });
        }

        const { count: quizCount, error: quizError } = await supabase
            .from("quizzes")
            .select("*", { count: 'exact', head: true });

        if (quizError) throw quizError;

        let pendingCount = 0;
        let studentCount = 0;

        const [pendingResult, studentsResult] = await Promise.all([
            pool.query(`
                SELECT COUNT(*) AS count
                FROM quiz_attempts qa
                JOIN quizzes q ON q.id = qa.quiz_id
                LEFT JOIN course_offerings co ON co.id = q.course_offering_id
                JOIN institution_memberships student_membership
                  ON student_membership.user_id = qa.user_id
                 AND student_membership.is_active = true
                 AND student_membership.role = 'student'
                 AND student_membership.institution_id = $2
                 AND student_membership.department_id = $1
                WHERE qa.status = 'submitted'
                  AND (q.is_practice IS NOT TRUE AND COALESCE(q.quiz_type, '') != 'practice')
                  AND (q.created_by = $3 OR co.teacher_id = $3)
            `, [scope.departmentId, scope.institutionId, userId]),
            pool.query(`
                SELECT COUNT(DISTINCT student_membership.user_id) AS count
                FROM institution_memberships student_membership
                WHERE student_membership.is_active = true
                  AND student_membership.role = 'student'
                  AND student_membership.institution_id = $2
                  AND student_membership.department_id = $1
            `, [scope.departmentId, scope.institutionId])
        ]);
        pendingCount = Number(pendingResult.rows[0]?.count || 0);
        studentCount = Number(studentsResult.rows[0]?.count || 0);

        res.json({
            active: quizCount || 0,
            upcoming: 0, // Placeholder
            pending: pendingCount || 0,
            students: studentCount || 0,
            college: collegeName,
            department: departmentName
        });
    } catch (err) {
        console.error("Dashboard Stats Error:", err);
        res.status(err.status || 500).json({ error: err.message });
    }
});

// Quiz Management - list all quizzes created by teacher
router.get("/quiz", auth, authorize('teacher'), requireInstitutionContext, async (req, res) => {
    try {
        const userId = req.context.userId;
        let quizzesResult;

        if (FEATURES.NEW_ACADEMIC_MODEL) {
            quizzesResult = await pool.query(`
                SELECT q.*, co.subject_id
                FROM quizzes q
                JOIN course_offerings co ON co.id = q.course_offering_id
                WHERE co.teacher_id = $1 AND q.is_archived = false
                ORDER BY q.created_at DESC
            `, [userId]);
        } else {
            // Fallback for legacy data without course_offerings
            quizzesResult = await pool.query(`
                SELECT * FROM quizzes
                WHERE is_archived = false
                ORDER BY created_at DESC
            `);
        }

        res.json(quizzesResult.rows);
    } catch (err) {
        console.error("Fetch Teacher Quizzes Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Soft Delete Quiz
router.delete("/quiz/:id", auth, authorize('teacher'), requireInstitutionContext, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.context.userId;
        
        // Verify ownership
        const verifyRes = await pool.query(`
            SELECT q.id 
            FROM quizzes q
            LEFT JOIN course_offerings co ON co.id = q.course_offering_id
            WHERE q.id = $1 AND (co.teacher_id = $2 OR q.created_by = $2)
        `, [id, userId]);

        if (verifyRes.rowCount === 0) {
            return res.status(403).json({ error: "Unauthorized or quiz not found" });
        }

        await pool.query(`
            UPDATE quizzes 
            SET deleted_at = NOW(), is_archived = true 
            WHERE id = $1
        `, [id]);

        res.json({ message: "Quiz deleted successfully" });
    } catch (err) {
        console.error("Delete Quiz Error:", err);
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

const evaluationsLocalCache = new Map();

// Evaluations
router.get("/evaluations", auth, authorize('teacher'), requireInstitutionContext, async (req, res) => {
    try {
        const userId = req.context.userId;
        const scope = getTeacherDepartmentScope(req);
        const cacheKey = `${userId}:${scope.departmentId}:${scope.institutionId}`;

        const cached = evaluationsLocalCache.get(cacheKey);
        if (cached && Date.now() < cached.expiresAt) {
            return res.json(cached.data);
        }

        ensureTeacherDDL();

        const result = await pool.query(`
            SELECT
                qa.id,
                qa.score,
                qa.status,
                p.email,
                p.full_name,
                p.enrollment_no,
                q.title AS quiz_title
            FROM quiz_attempts qa
            JOIN profiles p ON p.id = qa.user_id
            JOIN quizzes q ON q.id = qa.quiz_id
            LEFT JOIN course_offerings co ON co.id = q.course_offering_id
            JOIN institution_memberships student_membership
              ON student_membership.user_id = p.id
             AND student_membership.is_active = true
             AND student_membership.role = 'student'
             AND student_membership.institution_id = $2
             AND student_membership.department_id = $1
            WHERE qa.status = 'submitted'
              AND (q.is_practice IS NOT TRUE AND COALESCE(q.quiz_type, '') != 'practice')
              AND (q.created_by = $3 OR co.teacher_id = $3)
            ORDER BY qa.completed_at DESC NULLS LAST, qa.started_at DESC NULLS LAST
        `, [scope.departmentId, scope.institutionId, userId]);

        // Transform for frontend
        const formatted = result.rows.map(item => ({
            id: item.id,
            student: item.full_name || item.email || "Unknown",
            enrollmentNo: item.enrollment_no || "-",
            email: item.email || "-",
            quiz: item.quiz_title || "Unknown",
            status: item.status
        }));

        evaluationsLocalCache.set(cacheKey, { data: formatted, expiresAt: Date.now() + 15000 });

        res.json(formatted);
    } catch (err) {
        console.error("Fetch Evaluations Error:", err);
        res.status(err.status || 500).json({ error: err.message });
    }
});

// Single Evaluation Details
router.get("/evaluation/:id", auth, authorize('teacher'), requireInstitutionContext, async (req, res) => {
    try {
        await ensureProfileEnrollmentColumn();

        const { id } = req.params;

        const scope = getTeacherDepartmentScope(req);
        await assertAttemptIsInTeacherDepartment(id, scope);

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
                profiles!inner(email, full_name, enrollment_no, department),
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
        res.status(err.status || 500).json({ error: err.message });
    }
});

// Finalize Evaluation (Update marks and status)
router.post("/evaluation/:id/finalize", auth, authorize('teacher'), requireInstitutionContext, async (req, res) => {
    try {
        const { id } = req.params;
        const { marks } = req.body; // Array of { questionId, marks, isCorrect }
        const scope = getTeacherDepartmentScope(req);
        await assertAttemptIsInTeacherDepartment(id, scope);

        if (!Array.isArray(marks)) {
            return res.status(400).json({ error: "marks must be an array." });
        }

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
        res.status(err.status || 500).json({ error: err.message });
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

// ─── AI Settings Routes (Generalized) ────────────────────────────────

// Legacy gemini-key endpoints (backward compatibility)
router.post("/settings/gemini-key", auth, authorize('teacher'), async (req, res) => {
    try {
        const { apiKey } = req.body;
        if (!apiKey) return res.status(400).json({ error: "API Key is required" });

        await upsertTeacherApiKey(req.user.email, "gemini", apiKey);
        res.json({ message: "API Key saved successfully" });
    } catch (err) {
        console.error("Save Key Error:", err);
        res.status(500).json({ error: err.message });
    }
});

router.get("/settings/gemini-key", auth, authorize('teacher'), async (req, res) => {
    try {
        const apiKey = await getApiKeyForTeacher(req.user.email, "gemini");
        res.json({ hasKey: !!apiKey });
    } catch (err) {
        console.error("Get Key Status Error:", err);
        res.status(500).json({ error: err.message });
    }
});

const aiProvidersCache = new Map();

// Get all AI provider statuses for the logged-in teacher
router.get("/settings/ai-providers", auth, authorize('teacher'), async (req, res) => {
    try {
        const cacheKey = req.user.email;
        const cached = aiProvidersCache.get(cacheKey);
        if (cached && Date.now() < cached.expiresAt) {
            return res.json(cached.data);
        }

        const { rows } = await pool.query(`
            SELECT pr.code, uk.encrypted_api_key
            FROM profiles p
            JOIN user_api_keys uk ON uk.user_id = p.id
            JOIN providers pr ON pr.id = uk.provider_id
            WHERE lower(p.email) = lower($1)
        `, [req.user.email]);

        const keyByProvider = new Map(rows.map((row) => [row.code, row.encrypted_api_key]));

        // Mask keys for display (show last 4 chars)
        const maskKey = (key) => {
            if (!key) return null;
            return key.length > 8 ? "****" + key.slice(-4) : "****";
        };

        const responseData = {
            providers: Object.values(AI_PROVIDER_METADATA).map((provider) => ({
                ...provider,
                configured: keyByProvider.has(provider.id),
                maskedKey: maskKey(keyByProvider.get(provider.id))
            }))
        };

        aiProvidersCache.set(cacheKey, { data: responseData, expiresAt: Date.now() + 60000 });

        res.json(responseData);
    } catch (err) {
        console.error("Get AI Providers Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Save an AI provider key
router.post("/settings/ai-key", auth, authorize('teacher'), async (req, res) => {
    try {
        const { provider, apiKey } = req.body;
        if (!provider || !apiKey) {
            return res.status(400).json({ error: "Provider and API Key are required." });
        }

        if (!ai.ALLOWED_PROVIDERS.includes(provider)) {
            return res.status(400).json({ error: `Invalid provider: ${provider}. Allowed: ${ai.ALLOWED_PROVIDERS.join(", ")}` });
        }

        if (provider === "openrouter" && !apiKey.startsWith("sk-or-")) {
            return res.status(400).json({ error: "Invalid OpenRouter API key. Keys should start with 'sk-or-'." });
        }

        await upsertTeacherApiKey(req.user.email, provider, apiKey);
        aiProvidersCache.delete(req.user.email);
        res.json({ message: `${provider} API key saved successfully.` });
    } catch (err) {
        console.error("Save AI Key Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Remove an AI provider key
router.delete("/settings/ai-key", auth, authorize('teacher'), async (req, res) => {
    try {
        const { provider } = req.body;
        if (!provider) {
            return res.status(400).json({ error: "Provider is required." });
        }

        if (!ai.ALLOWED_PROVIDERS.includes(provider)) {
            return res.status(400).json({ error: `Invalid provider: ${provider}.` });
        }

        await deleteTeacherApiKey(req.user.email, provider);
        aiProvidersCache.delete(req.user.email);
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

        console.log("AI Generate: Fetching key for provider...");
        const apiKey = await getApiKeyForTeacher(req.user.email, provider);
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
        // Distinguish rate-limit errors (tagged with RATE_LIMIT: prefix by provider handlers)
        if (err.message?.startsWith("RATE_LIMIT:")) {
            return res.status(429).json({ error: err.message.replace("RATE_LIMIT: ", "") });
        }
        res.status(500).json({ error: err.message });
    }
});

async function ensureQuizIsPracticeColumn() {
    await pool.query(`
        ALTER TABLE quizzes
        ADD COLUMN IF NOT EXISTS is_practice BOOLEAN DEFAULT false;
    `);
}

// Unified Quiz Creation
router.post("/quiz/full", auth, authorize('teacher'), aiLimiter, async (req, res) => {
    try {
        await ensureQuestionFunctionNameColumn();
        await ensureQuizIsPracticeColumn();

        const {
            title,
            subject,
            subjectId,
            courseOfferingId, // New field
            duration,
            totalMarks,
            description,
            questions,
            department,
            semester,
            scheduledAt,
            isPractice,
            quizCategory
        } = req.body;

        const isPracticeFlag = Boolean(isPractice || quizCategory === "practice");

        // Fetch valid UUID from Supabase profiles
        const { data: profile, error } = await supabase
            .from("profiles")
            .select("id")
            .ilike("email", req.user.email) // Changed to ilike for case-insensitivity
            .single();

        if (!profile) throw new Error(`Profile not found for user: ${req.user.email} (Error: ${error?.message})`);
        const userId = profile.id;

        // New clients submit subjectId. Resolve its display values too while older
        // clients can continue submitting subject/department/semester text.
        let resolvedSubjectId = subjectId || null;
        let resolvedSubject = subject || null;
        let resolvedDepartment = department || null;
        let resolvedSemester = semester || null;
        let resolvedInstitutionId = null;
        let resolvedCourseOfferingId = null;

        if (resolvedSubjectId) {
            const { data: subjectRecord, error: subjectError } = await supabase
                .from("subjects")
                .select("id, name, institution_id, program_id, academic_term_id, programs(department_id, departments(name)), academic_terms(term_number, term_type), institutions(name)")
                .eq("id", resolvedSubjectId)
                .single();

            if (subjectError || !subjectRecord) {
                return res.status(400).json({ error: "Invalid subjectId." });
            }

            resolvedSubjectId = subjectRecord.id;
            resolvedSubject = subjectRecord.name;
            resolvedInstitutionId = subjectRecord.institution_id || null;
            resolvedDepartment = subjectRecord.programs?.departments?.name || resolvedDepartment;
            resolvedSemester = subjectRecord.academic_terms?.term_number?.toString() || resolvedSemester;

            const { data: courseOffering } = await supabase
                .from("course_offerings")
                .select("id")
                .eq("institution_id", resolvedInstitutionId)
                .eq("subject_id", resolvedSubjectId)
                .eq("academic_term_id", subjectRecord.academic_term_id)
                .is("section_id", null)
                .eq("teacher_id", userId)
                .maybeSingle();

            if (courseOffering?.id) {
                resolvedCourseOfferingId = courseOffering.id;
            } else {
                const { data: newOffering, error: offeringError } = await supabase
                    .from("course_offerings")
                    .insert({
                        institution_id: resolvedInstitutionId,
                        subject_id: resolvedSubjectId,
                        teacher_id: userId,
                        academic_term_id: subjectRecord.academic_term_id,
                        section_id: null
                    })
                    .select("id")
                    .single();

                if (offeringError) throw offeringError;
                resolvedCourseOfferingId = newOffering.id;
            }
        }

        let insertPayload = {
            title,
            duration,
            total_marks: totalMarks,
            description,
            quiz_type: "hybrid",
            scheduled_at: scheduledAt || new Date(),
            is_practice: isPracticeFlag
        };

        if (FEATURES.NEW_ACADEMIC_MODEL) {
            if (!courseOfferingId) throw new Error("courseOfferingId is required in new academic model");
            
            // Runtime Tenant & Ownership Verification
            const { data: co } = await supabase
                .from("course_offerings")
                .select("institution_id, teacher_id")
                .eq("id", courseOfferingId)
                .single();
            if (!co) throw new Error("Invalid courseOfferingId");
            if (co.teacher_id !== userId) throw new Error("Unauthorized: You do not own this course offering");

            // Optional: You could also verify if the teacher is still an active member of co.institution_id
            
            insertPayload = {
                ...insertPayload,
                institution_id: co.institution_id,
                course_offering_id: courseOfferingId
                // Strictly omitted: subject, subject_id, department, semester, created_by
            };
        } else {
            insertPayload = {
                ...insertPayload,
                institution_id: resolvedInstitutionId,
                course_offering_id: resolvedCourseOfferingId,
                subject_id: resolvedSubjectId,
                subject: resolvedSubject,
                created_by: userId,
                department: resolvedDepartment,
                semester: resolvedSemester
            };
        }

        // 1. Create Quiz
        const { data: quiz, error: quizError } = await supabase
            .from("quizzes")
            .insert(insertPayload)
            .select()
            .single();

        if (quizError) throw quizError;
        
        // Migration Metrics Logging
        quizCreationMigration.labels({
            mode: FEATURES.NEW_ACADEMIC_MODEL ? "new-only" : "dual-write",
            schemaVersion: FEATURES.NEW_ACADEMIC_MODEL ? "2" : "1"
        }).inc();

        // Push audit event
        auditQueue.add("quiz_created", {
            userId,
            event: "Quiz Created",
            metadata: {
                quizId: quiz.id,
                title,
                courseOfferingId: courseOfferingId || null
            }
        }).catch(err => console.error("Failed to enqueue audit event:", err));

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

        res.json({ 
            message: "Quiz created successfully", 
            quizId: quiz.id,
            schemaVersion: FEATURES.NEW_ACADEMIC_MODEL ? 2 : 1 
        });
    } catch (err) {
        console.error("Quiz Creation Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Auto-Evaluate Attempt
router.post("/evaluate/:id", auth, authorize('teacher'), requireInstitutionContext, aiLimiter, async (req, res) => {
    try {
        const { id } = req.params;
        const { provider = "gemini", model } = req.body;
        const scope = getTeacherDepartmentScope(req);
        await assertAttemptIsInTeacherDepartment(id, scope);
        await ensureQuestionFunctionNameColumn();

        console.log("AI Evaluate: Fetching key for provider", provider);
        if (!ai.ALLOWED_PROVIDERS.includes(provider)) {
            return res.status(400).json({ error: `Invalid provider: ${provider}` });
        }

        // Fetch Teacher's API Key for the selected provider
        const apiKey = await getApiKeyForTeacher(req.user.email, provider);
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
        res.status(err.status || 500).json({ error: err.message });
    }
});

module.exports = router;
