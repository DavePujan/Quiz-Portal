const router = require("express").Router();
const { createClient } = require("@supabase/supabase-js");
const { auth } = require("../middleware/auth");
const { analyzeCode } = require("../utils/ai");
const { buildWrappedCode } = require("../utils/codeExecution");
const { FEATURES } = require("../config/features");
const { auditQueue } = require("../queues/auditQueue");
const pool = require("../db");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const examBehaviorSessions = new Map();

const BEHAVIOR_WEIGHTS = {
    fullscreen_exit: 20,
    tab_switch: 15,
    window_blur: 10,
    copy_paste: 25,
    devtools_open: 40
};

function getBehaviorKey(userId, quizId) {
    return `${userId}:${quizId}`;
}

function computeRisk(rawScore) {
    const score = Math.min(100, Math.max(0, rawScore));
    if (score < 20) return { score, risk: "Safe" };
    if (score < 50) return { score, risk: "Suspicious" };
    if (score < 80) return { score, risk: "High Risk" };
    return { score, risk: "Cheating" };
}

function isSupabaseNetworkError(err) {
    const text = `${err?.message || ""} ${err?.details || ""}`.toLowerCase();
    return text.includes("enotfound") || text.includes("connecttimeouterror") || text.includes("und_err_connect_timeout") || text.includes("fetch failed");
}

async function ensureAttemptShuffleColumns() {
    await pool.query(`
        ALTER TABLE quiz_attempts
        ADD COLUMN IF NOT EXISTS question_order JSONB DEFAULT '[]'::jsonb;
    `);

    await pool.query(`
        ALTER TABLE quiz_attempts
        ADD COLUMN IF NOT EXISTS option_order JSONB DEFAULT '{}'::jsonb;
    `);
}

async function ensureQuestionFunctionNameColumn() {
    await pool.query(`
        ALTER TABLE questions
        ADD COLUMN IF NOT EXISTS function_name TEXT;
    `);
}

function hashSeed(input) {
    let h = 2166136261;
    for (let i = 0; i < input.length; i += 1) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function seededRandom(seed) {
    let t = seed + 0x6d2b79f5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function deterministicShuffle(items, seedInput) {
    const arr = [...items];
    let seed = hashSeed(seedInput);
    for (let i = arr.length - 1; i > 0; i -= 1) {
        seed += 1;
        const j = Math.floor(seededRandom(seed) * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

async function ensureBehaviorTable() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS exam_behavior_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID,
            quiz_id UUID,
            attempt_id UUID,
            tab_switches INTEGER DEFAULT 0,
            fullscreen_exits INTEGER DEFAULT 0,
            window_blurs INTEGER DEFAULT 0,
            copy_events INTEGER DEFAULT 0,
            devtools_attempts INTEGER DEFAULT 0,
            final_score INTEGER DEFAULT 0,
            risk_level TEXT DEFAULT 'Safe',
            reasons JSONB DEFAULT '[]'::jsonb,
            event_timeline JSONB DEFAULT '[]'::jsonb,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE (user_id, quiz_id, attempt_id)
        );
    `);
}

async function persistBehaviorForAttempt(userId, quizId, attemptId) {
    const sessionKey = getBehaviorKey(userId, quizId);
    const session = examBehaviorSessions.get(sessionKey) || {
        tab_switches: 0,
        fullscreen_exits: 0,
        window_blurs: 0,
        copy_events: 0,
        devtools_attempts: 0,
        reasons: [],
        timeline: []
    };

    const rawScore =
        (session.fullscreen_exits || 0) * BEHAVIOR_WEIGHTS.fullscreen_exit +
        (session.tab_switches || 0) * BEHAVIOR_WEIGHTS.tab_switch +
        (session.window_blurs || 0) * BEHAVIOR_WEIGHTS.window_blur +
        (session.copy_events || 0) * BEHAVIOR_WEIGHTS.copy_paste +
        (session.devtools_attempts || 0) * BEHAVIOR_WEIGHTS.devtools_open;

    const { score, risk } = computeRisk(rawScore);
    await ensureBehaviorTable();

    await pool.query(
        `
            INSERT INTO exam_behavior_logs (
                user_id,
                quiz_id,
                attempt_id,
                tab_switches,
                fullscreen_exits,
                window_blurs,
                copy_events,
                devtools_attempts,
                final_score,
                risk_level,
                reasons,
                event_timeline,
                updated_at
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,NOW())
            ON CONFLICT (user_id, quiz_id, attempt_id)
            DO UPDATE SET
                tab_switches = EXCLUDED.tab_switches,
                fullscreen_exits = EXCLUDED.fullscreen_exits,
                window_blurs = EXCLUDED.window_blurs,
                copy_events = EXCLUDED.copy_events,
                devtools_attempts = EXCLUDED.devtools_attempts,
                final_score = EXCLUDED.final_score,
                risk_level = EXCLUDED.risk_level,
                reasons = EXCLUDED.reasons,
                event_timeline = EXCLUDED.event_timeline,
                updated_at = NOW();
        `,
        [
            userId,
            quizId,
            attemptId,
            session.tab_switches || 0,
            session.fullscreen_exits || 0,
            session.window_blurs || 0,
            session.copy_events || 0,
            session.devtools_attempts || 0,
            score,
            risk,
            JSON.stringify(session.reasons || []),
            JSON.stringify(session.timeline || [])
        ]
    );

    examBehaviorSessions.delete(sessionKey);
    return { score, risk };
}

// Get All Active Quizzes for Students
router.get("/quizzes", auth, async (req, res) => {
    try {
        let query;
        if (FEATURES.NEW_ACADEMIC_MODEL) {
            query = supabase
                .from("quizzes")
                .select("*, course_offering:course_offerings(teacher:profiles!teacher_id(full_name, email))")
                .order("created_at", { ascending: false });
        } else {
            query = supabase
                .from("quizzes")
                .select("*, creator:profiles!created_by(full_name, email)")
                .order("created_at", { ascending: false });
        }

        const { data: quizzes, error } = await query;

        if (error) throw error;

        console.log(`[Student] Fetching quizzes for ${req.user.email} (ID: ${req.user.id})`);
        console.log(`[Student] Found ${quizzes?.length || 0} quizzes`);

        // Fetch correct profile UUID to check attempts (req.user.id is legacy Integer)
        const { data: profile } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", req.user.email)
            .single();

        const userId = profile?.id || req.user.id;

        // Fetch attempt status for each quiz for this user
        const { data: attempts } = await supabase
            .from("quiz_attempts")
            .select("quiz_id, status")
            .eq("user_id", userId);

        // Map attempts for easier lookup
        const attemptMap = {};
        attempts?.forEach(a => {
            attemptMap[a.quiz_id] = a.status;
        });

        let quizzesWithStatus = quizzes.map(q => ({
            ...q,
            status: attemptMap[q.id] || "not_started"
        }));

        // Allow fetching ALL quizzes (for Leaderboard), otherwise default to hiding submitted
        if (req.query.includeAttempted === "true") {
            // Fetching for history/leaderboard: Show everything
            return res.json(quizzesWithStatus);
        } else {
            // Filter logic for Student Dashboard
            const now = new Date(); // Current time

            const upcoming = [];
            const active = [];

            quizzesWithStatus.forEach(q => {
                const isTaken = q.status === "submitted" || q.status === "evaluated";
                if (isTaken) return; // Don't show already taken quizzes

                const manualActive = q.is_active !== false;
                if (!manualActive) return; // Teacher manually stopped it

                const scheduledTime = q.scheduled_at ? new Date(q.scheduled_at) : new Date(q.created_at);
                const durationMs = (q.duration || 60) * 60 * 1000;
                const endTime = new Date(scheduledTime.getTime() + durationMs);

                if (scheduledTime > now) {
                    upcoming.push(q);
                } else if (now >= scheduledTime && now < endTime) {
                    active.push(q);
                }
                // If now >= endTime, it's expired/history (hidden from here)
            });

            console.log(`[Student] Returning ${active.length} active and ${upcoming.length} upcoming quizzes.`);

            res.json({ active, upcoming });
        }
    } catch (err) {
        if (isSupabaseNetworkError(err)) {
            console.error("Fetch Quizzes Error: Supabase unreachable (DNS/timeout)");
            return res.status(503).json({ error: "Database service temporarily unreachable. Please retry in a moment." });
        }
        console.error("Fetch Quizzes Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Get Student Quiz History
router.get("/history", auth, async (req, res) => {
    try {
        // Fetch correct profile UUID
        const { data: profile } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", req.user.email)
            .single();

        const userId = profile?.id || req.user.id;

        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        console.log(`[History] Fetching history for email: ${req.user.email}, Profile ID: ${userId}`);

        if (!userId) {
            console.error("[History] Profile not found for user!");
            return res.json([]);
        }

        const { data: history, error } = await supabase
            .from("quiz_attempts")
            .select(`
                id,
                score,
                completed_at,
                status,
                quiz:quizzes (
                    id,
                    title,
                    subject,
                    total_marks,
                    scheduled_at,
                    created_at
                )
            `)
            .eq("user_id", userId)
            .order("completed_at", { ascending: false });

        if (error) throw error;

        res.json(history);
    } catch (err) {
        if (isSupabaseNetworkError(err)) {
            console.error("Fetch History Error: Supabase unreachable (DNS/timeout)");
            return res.status(503).json({ error: "Database service temporarily unreachable. Please retry in a moment." });
        }
        console.error("Fetch History Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Get Quiz Leaderboard
router.get("/leaderboard", auth, async (req, res) => {
    try {
        const { quizId } = req.query;

        let query = supabase
            .from("quiz_attempts")
            .select(`
                score,
                user:profiles(email),
                quiz:quizzes(title)
            `)
            .order("score", { ascending: false });

        if (quizId) {
            query = query.eq("quiz_id", quizId);
        }

        const { data, error } = await query;
        if (error) throw error;

        // Transform for frontend
        const leaderboard = data.map(row => ({
            username: row.user?.email?.split('@')[0] || "Unknown",
            score: row.score,
            quizTitle: row.quiz?.title,
            // runtime/memory not applicable for general quiz, but keeping structure if needed
        }));

        res.json(leaderboard);
    } catch (err) {
        console.error("Leaderboard Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Get Single Quiz with Questions (for Attempt)
router.get("/quiz/:id", auth, async (req, res) => {
    try {
        const { id } = req.params;

        await ensureAttemptShuffleColumns();
        await ensureQuestionFunctionNameColumn();

        const { data: profile } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", req.user.email)
            .single();
        const userId = profile?.id || req.user.id;

        // Strict one-attempt rule: block if already submitted/evaluated.
        const { data: finalAttempt } = await supabase
            .from("quiz_attempts")
            .select("id, status")
            .eq("user_id", userId)
            .eq("quiz_id", id)
            .in("status", ["submitted", "evaluated"])
            .order("completed_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (finalAttempt) {
            return res.status(403).json({ error: "You have already attempted this quiz." });
        }

        // Resume existing in-progress attempt if available.
        const { data: inProgressAttempt } = await supabase
            .from("quiz_attempts")
            .select("id, status, question_order, option_order")
            .eq("user_id", userId)
            .eq("quiz_id", id)
            .eq("status", "in_progress")
            .order("started_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        let quizQuery;
        if (FEATURES.NEW_ACADEMIC_MODEL) {
            quizQuery = supabase
                .from("quizzes")
                .select("*, course_offering:course_offerings(teacher:profiles!teacher_id(full_name, email))")
                .eq("id", id)
                .single();
        } else {
            quizQuery = supabase
                .from("quizzes")
                .select("*, creator:profiles!created_by(full_name, email)")
                .eq("id", id)
                .single();
        }

        // Fetch Quiz Metadata
        const { data: quiz, error: quizError } = await quizQuery;

        if (quizError) throw quizError;

        // Fetch Questions via Map
        const { data: mapData, error: mapError } = await supabase
            .from("quiz_questions_map")
            .select(`
                question_id,
                weightage,
                question:questions (
                    id, title, type, language, function_name, input_format, output_format, image_url,
                    mcq_options (id, option_text)
                )
            `)
            .eq("quiz_id", id);
        // Note: For Code questions, we DO NOT send hidden testcases. Even public ones might be better hidden until run?
        // Usually we send example testcases. My DB schema has 'testcases' table.
        // Let's fetch public testcases for code questions.

        if (mapError) throw mapError;

        // Fetch Testcases separately or join? Join is deep.
        // Let's just enhance the mapped data.
        const questionsWithDetails = await Promise.all(mapData.map(async (item) => {
            const q = item.question;
            if (q.type === 'code') {
                const { data: visibleTests } = await supabase
                    .from("testcases")
                    .select("input, expected_output")
                    .eq("question_id", q.id)
                    .eq("is_hidden", false);
                q.testCases = visibleTests || [];
            }

            return {
                ...q,
                weightage: item.weightage
            };
        }));

        const canonicalIds = questionsWithDetails.map((q) => q.id);
        const savedOrder = Array.isArray(inProgressAttempt?.question_order)
            ? inProgressAttempt.question_order.map((x) => String(x))
            : [];

        let questionOrder = [];
        const hasValidSavedOrder =
            savedOrder.length === canonicalIds.length &&
            savedOrder.every((qid) => canonicalIds.includes(qid));

        if (hasValidSavedOrder) {
            questionOrder = savedOrder;
        } else {
            questionOrder = deterministicShuffle(
                canonicalIds.map((x) => String(x)),
                `${userId}:${id}`
            );
        }

        // Build/stabilize per-attempt option order for MCQ options.
        const savedOptionOrder = inProgressAttempt?.option_order && typeof inProgressAttempt.option_order === "object"
            ? inProgressAttempt.option_order
            : {};
        const optionOrder = {};

        for (const q of questionsWithDetails) {
            if (q.type !== "mcq" || !Array.isArray(q.mcq_options) || q.mcq_options.length <= 1) {
                continue;
            }

            const optionIds = q.mcq_options.map((o) => String(o.id));
            const saved = Array.isArray(savedOptionOrder[String(q.id)])
                ? savedOptionOrder[String(q.id)].map((x) => String(x))
                : [];

            const hasValidSavedOptions =
                saved.length === optionIds.length &&
                saved.every((oid) => optionIds.includes(oid));

            const finalOrder = hasValidSavedOptions
                ? saved
                : deterministicShuffle(optionIds, `${userId}:${id}:${q.id}:options`);

            optionOrder[String(q.id)] = finalOrder;

            const optionMap = new Map(q.mcq_options.map((o) => [String(o.id), o]));
            q.mcq_options = finalOrder.map((oid) => optionMap.get(String(oid))).filter(Boolean);
        }

        if (inProgressAttempt) {
            await supabase
                .from("quiz_attempts")
                .update({
                    question_order: questionOrder,
                    option_order: optionOrder
                })
                .eq("id", inProgressAttempt.id);
        } else {
            await supabase
                .from("quiz_attempts")
                .insert({
                    user_id: userId,
                    quiz_id: id,
                    status: "in_progress",
                    started_at: new Date(),
                    question_order: questionOrder,
                    option_order: optionOrder
                });
            
            auditQueue.add("quiz_started", {
                userId,
                event: "Quiz Started",
                metadata: { quizId: id }
            }).catch(err => console.error("Failed to enqueue audit event:", err));
        }

        const questionMap = new Map(questionsWithDetails.map((q) => [String(q.id), q]));
        const orderedQuestions = questionOrder
            .map((qid) => questionMap.get(String(qid)))
            .filter(Boolean);

        // Fallback: include any unmatched question IDs at end to avoid data loss.
        const leftovers = questionsWithDetails.filter((q) => !questionOrder.includes(String(q.id)));

        res.json({
            ...quiz,
            randomized: true,
            randomization_note: "Questions and options are randomized for fairness.",
            questions: [...orderedQuestions, ...leftovers]
        });

    } catch (err) {
        console.error("Fetch Single Quiz Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Submit Quiz Attempt
router.post("/quiz/:id/attempt", auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { answers } = req.body; // Array of { questionId, selectedOption, submittedCode }
        const { data: profile } = await supabase.from("profiles").select("id").eq("email", req.user.email).single();
        const userId = profile.id;

        await ensureAttemptShuffleColumns();

        // 1. Start Transaction (Simulated)
        // Block duplicate final submissions
        const { data: existingFinal } = await supabase
            .from("quiz_attempts")
            .select("id, status")
            .eq("user_id", userId)
            .eq("quiz_id", id)
            .in("status", ["submitted", "evaluated"])
            .order("completed_at", { ascending: false })
            .limit(1)
            .maybeSingle();
        if (existingFinal) return res.status(400).json({ error: "Attempt already exists" });

        // Reuse existing in-progress attempt if present (contains question_order).
        const { data: inProgressAttempt } = await supabase
            .from("quiz_attempts")
            .select("id, question_order")
            .eq("user_id", userId)
            .eq("quiz_id", id)
            .eq("status", "in_progress")
            .order("started_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        // Fetch total marks so percentages and ranking are computed correctly.
        const { data: quizMeta, error: quizMetaError } = await supabase
            .from("quizzes")
            .select("total_marks")
            .eq("id", id)
            .single();
        if (quizMetaError) throw quizMetaError;
        const totalMarks = Number(quizMeta?.total_marks || 0);

        let attempt = inProgressAttempt;
        if (!attempt) {
            const { data: createdAttempt, error: attemptError } = await supabase
                .from("quiz_attempts")
                .insert({
                    user_id: userId,
                    quiz_id: id,
                    status: "in_progress",
                    total_marks: totalMarks,
                    started_at: new Date(),
                    completed_at: null,
                    question_order: []
                })
                .select()
                .single();

            if (attemptError) throw attemptError;
            attempt = createdAttempt;
        }

        // 3. Process Answers & Calculate Score (Basic Auto-Eval for MCQ)
        let totalScore = 0;
        const answerInserts = [];

        // Fetch correct answers for grading
        // For efficiency, fetch all questions in quiz
        const { data: quizQuestions } = await supabase
            .from("quiz_questions_map")
            .select(`
                weightage,
                question:questions (
                    id, type,
                    mcq_options (id, option_text, is_correct)
                )
            `)
            .eq("quiz_id", id);

        for (const userAns of answers) {
            const questionData = quizQuestions.find(q => String(q.question.id) === String(userAns.questionId));
            if (!questionData) continue;

            const q = questionData.question;
            const weight = questionData.weightage;
            let isCorrect = false;
            let marks = 0;

            if (q.type === 'mcq') {
                const correctOpt = q.mcq_options.find(o => o.is_correct);
                const selectedOptionId = userAns.selectedOptionId ? String(userAns.selectedOptionId) : null;

                if (selectedOptionId && correctOpt && String(correctOpt.id) === selectedOptionId) {
                    isCorrect = true;
                    marks = weight;
                } else {
                    // Backward compatibility for older clients that send text only.
                    const normalizedCorrect = (correctOpt?.option_text || "").trim().toLowerCase();
                    const normalizedSelected = (userAns.selectedOption || "").trim().toLowerCase();
                    if (correctOpt && normalizedCorrect && normalizedCorrect === normalizedSelected) {
                        isCorrect = true;
                        marks = weight;
                    }
                }
            } else if (q.type === 'code') {
                // TODO: Trigger Judge0 or leave for manual teacher review.
                // Status is 'submitted', Teacher will evaluate.
                // For now, no marks.
            }

            totalScore += marks;

            answerInserts.push({
                attempt_id: attempt.id,
                question_id: q.id,
                selected_option: userAns.selectedOption,
                submitted_code: userAns.submittedCode,
                is_correct: isCorrect,
                marks_awarded: marks
            });
        }

        // 4. Update Attempt Score (keep status as submitted so it appears in teacher evaluations)
        await supabase.from("quiz_attempts").update({ score: totalScore, status: "submitted" }).eq("id", attempt.id);

        // 5. Replace answer details for this attempt (idempotent submit path)
        await supabase.from("quiz_answers").delete().eq("attempt_id", attempt.id);

        // 6. Insert Details
        if (answerInserts.length > 0) {
            await supabase.from("quiz_answers").insert(answerInserts);
        }

        await supabase
            .from("quiz_attempts")
            .update({
                score: totalScore,
                status: "submitted",
                total_marks: totalMarks,
                completed_at: new Date()
            })
            .eq("id", attempt.id);

        let integrity = { score: 0, risk: "Safe" };
        try {
            integrity = await persistBehaviorForAttempt(userId, id, attempt.id);
        } catch (integrityErr) {
            console.error("Integrity log persist failed:", integrityErr.message);
        }

        res.json({
            message: "Quiz submitted successfully",
            score: totalScore,
            attemptId: attempt.id,
            integrity
        });
        
        auditQueue.add("quiz_submitted", {
            userId,
            event: "Quiz Submitted",
            metadata: { quizId: id, attemptId: attempt.id, score: totalScore }
        }).catch(err => console.error("Failed to enqueue audit event:", err));

    } catch (err) {
        console.error("Submit Quiz Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Real exam secure mode event tracking
router.post("/quiz/:id/integrity-event", auth, async (req, res) => {
    try {
        const { id: quizId } = req.params;
        const { event, timestamp, meta } = req.body || {};

        if (!event) {
            return res.status(400).json({ error: "event is required" });
        }

        const { data: profile } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", req.user.email)
            .single();

        const userId = profile?.id || req.user.id;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        // Ignore integrity events after final submission for this user+quiz.
        const { data: submittedAttempt, error: attemptStatusError } = await supabase
            .from("quiz_attempts")
            .select("id, status")
            .eq("user_id", userId)
            .eq("quiz_id", quizId)
            .in("status", ["submitted", "evaluated"])
            .order("completed_at", { ascending: false })
            .limit(1);

        if (attemptStatusError) {
            throw attemptStatusError;
        }

        if (submittedAttempt && submittedAttempt.length > 0) {
            examBehaviorSessions.delete(getBehaviorKey(userId, quizId));
            return res.json({
                ok: true,
                ignored: true,
                reason: "attempt-already-submitted"
            });
        }

        const key = getBehaviorKey(userId, quizId);
        const base = examBehaviorSessions.get(key) || {
            tab_switches: 0,
            fullscreen_exits: 0,
            window_blurs: 0,
            copy_events: 0,
            devtools_attempts: 0,
            reasons: [],
            timeline: []
        };

        if (event === "tab_switch") base.tab_switches += 1;
        if (event === "fullscreen_exit") base.fullscreen_exits += 1;
        if (event === "window_blur") base.window_blurs += 1;
        if (event === "copy_paste") base.copy_events += 1;
        if (event === "devtools_open") base.devtools_attempts += 1;

        const reasonText = `${event}${meta?.details ? `: ${meta.details}` : ""}`;
        base.reasons.push(reasonText);
        base.timeline.push({
            event,
            timestamp: timestamp || Date.now(),
            meta: meta || {}
        });

        const rawScore =
            base.fullscreen_exits * BEHAVIOR_WEIGHTS.fullscreen_exit +
            base.tab_switches * BEHAVIOR_WEIGHTS.tab_switch +
            base.window_blurs * BEHAVIOR_WEIGHTS.window_blur +
            base.copy_events * BEHAVIOR_WEIGHTS.copy_paste +
            base.devtools_attempts * BEHAVIOR_WEIGHTS.devtools_open;
        const { score, risk } = computeRisk(rawScore);

        examBehaviorSessions.set(key, base);

        return res.json({
            ok: true,
            score,
            risk,
            counters: {
                tab_switches: base.tab_switches,
                fullscreen_exits: base.fullscreen_exits,
                window_blurs: base.window_blurs,
                copy_events: base.copy_events,
                devtools_attempts: base.devtools_attempts
            }
        });
    } catch (err) {
        console.error("Integrity event error:", err);
        return res.status(500).json({ error: "Failed to record integrity event" });
    }
});

// Run Code (Test against first test case)
router.post("/quiz/:id/run", auth, async (req, res) => {
    try {
        const { id } = req.params; // quiz id
        const { questionId, code, language } = req.body;

        await ensureQuestionFunctionNameColumn();

        // 1. Fetch Question & First Test Case
        const [{ data: question, error: questionError }, { data: testCases, error }] = await Promise.all([
            supabase
                .from("questions")
                .select("id, title, language, function_name")
                .eq("id", questionId)
                .single(),
            supabase
                .from("testcases")
                .select("input, expected_output")
                .eq("question_id", questionId)
                .order("id", { ascending: true })
                .limit(1)
                .single()
        ]);

        if (questionError) {
            return res.status(404).json({ error: "Question not found" });
        }

        if (error || !testCases) {
            // Fallback if no test cases?
            return res.json({
                status: { description: "No Test Cases Found" },
                stdout: "",
                stderr: "No test cases configured for this question."
            });
        }

        // 2. Prepare execution
        const judge0 = require("../utils/judge0");

        const finalCode = buildWrappedCode(code, language, question.function_name, testCases.input);
        const langId = judge0.resolveLanguageId(language);

        if (!langId) {
            return res.status(400).json({ error: "Language not supported by current Judge0 configuration" });
        }

        // 3. Run on Judge0
        const result = await judge0.run({
            source_code: finalCode,
            language_id: langId,
            stdin: testCases.input, // Pass input! 
            expected_output: testCases.expected_output
        });

        // judge0.run doesn't support 'stdin' in the signature I viewed?
        // Let's double check judge0.js view.
        // judge0.js run function signature: ({ source_code, language_id, expected_output ... })
        // It DOES NOT take stdin in destructuring line 13!
        // I need to update judge0.js to accept stdin or pass it through options.
        // Wait, line 23 sends { ... } to axios. It doesn't include stdin! 
        // I need to fix judge0.js first! 

        // Assuming I fix judge0.js locally or here. 
        // I will first fix judge0.js in next step, but writing this route assuming it works.
        // Actually, I can pass strict object to `run` if I update it.

        res.json({
            ...result,
            input: testCases.input,
            expected: testCases.expected_output
        });

    } catch (err) {
        console.error("Run Code Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Get Detailed Quiz History (Review Mode)
router.get("/history/:attemptId", auth, async (req, res) => {
    try {
        const { attemptId } = req.params;
        const { data: profile } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", req.user.email)
            .single();

        const userId = profile?.id;

        // 1. Verify Attempt ownership
        const { data: attempt, error: attemptError } = await supabase
            .from("quiz_attempts")
            .select(`
                id,
                quiz_id,
                score,
                status,
                started_at,
                completed_at,
                quiz:quizzes (
                    id,
                    title,
                    subject,
                    total_marks
                )
            `)
            .eq("id", attemptId)
            .eq("user_id", userId)
            .single();

        if (attemptError || !attempt) {
            return res.status(404).json({ error: "Attempt not found" });
        }

        // 2. Fetch Questions & Answers
        // We need question details + user's answer + correct answer (for review)
        const { data: answers } = await supabase
            .from("quiz_answers")
            .select(`
                question_id,
                selected_option,
                submitted_code,
                is_correct,
                marks_awarded,
                marks_obtained,
                feedback,
                ai_analysis,
                test_cases_passed,
                total_test_cases,
                question:questions (
                    id, title, type, language, input_format, output_format, weightage,
                    mcq_options (option_text, is_correct)
                )
            `)
            .eq("attempt_id", attemptId);

        if (!answers || answers.length === 0) {
            return res.json({
                ...attempt,
                questions: []
            });
        }

        // 3. Transform Data
        const questions = await Promise.all(answers.map(async (ans) => {
            const q = ans.question || {};
            const options = Array.isArray(q.mcq_options) ? q.mcq_options.map(o => o.option_text) : [];
            const correctOptionIndex = Array.isArray(q.mcq_options) ? q.mcq_options.findIndex(o => o.is_correct) : -1;
            const userOptionIndex = Array.isArray(q.mcq_options) ? q.mcq_options.findIndex(o => o.option_text === ans.selected_option) : -1;
            const marksObtained = Number(ans.marks_awarded ?? ans.marks_obtained ?? 0);
            const marks = Number(q.weightage || 1);

            const difficulty = marks <= 10 ? "easy" : marks <= 20 ? "medium" : "hard";

            let codeReview = null;
            if (q.type === "code") {
                const { data: sampleTests } = await supabase
                    .from("testcases")
                    .select("input, expected_output")
                    .eq("question_id", q.id)
                    .eq("is_hidden", false)
                    .order("id", { ascending: true })
                    .limit(3);

                const existingAi = ans.ai_analysis && typeof ans.ai_analysis === "object"
                    ? ans.ai_analysis
                    : null;

                let generatedAi = null;
                const aiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
                if (!existingAi && ans.submitted_code && aiKey) {
                    generatedAi = await analyzeCode({
                        code: ans.submitted_code,
                        question: q.title,
                        language: q.language || "javascript",
                        input_format: q.input_format,
                        output_format: q.output_format,
                        max_marks: marks,
                        apiKey: aiKey
                    });
                }

                const finalAi = existingAi || generatedAi;

                codeReview = {
                    submittedCode: ans.submitted_code || "",
                    feedback: ans.feedback || finalAi?.feedback || "Code reviewed. Focus on edge cases and output formatting.",
                    suggestions: finalAi?.suggestions || "",
                    logicScore: finalAi?.logic_score,
                    passed: ans.test_cases_passed,
                    total: ans.total_test_cases,
                    sampleTests: sampleTests || []
                };
            }

            return {
                id: q.id,
                title: q.title,
                type: q.type,
                language: q.language,
                difficulty,
                marks,
                marksObtained,
                isCorrect: Boolean(ans.is_correct),
                userAnswer: userOptionIndex,
                userAnswerText: ans.selected_option,
                correctAnswer: correctOptionIndex,
                correctAnswerText: correctOptionIndex >= 0 ? options[correctOptionIndex] : null,
                options,
                codeReview
            };
        }));

        res.json({
            ...attempt,
            questions
        });

    } catch (err) {
        console.error("Detailed History Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Practice quiz payload (untimed, non-persistent)
router.get("/practice/quiz/:id", auth, async (req, res) => {
    try {
        const { id } = req.params;

        await ensureQuestionFunctionNameColumn();

        const quizResult = await pool.query(
            `
                SELECT id, title, COALESCE(subject, 'General') AS subject, COALESCE(total_marks, 0) AS total_marks
                FROM quizzes
                WHERE id = $1
                LIMIT 1;
            `,
            [id]
        );

        if (quizResult.rows.length === 0) {
            return res.status(404).json({ error: "Quiz not found" });
        }

        const questionsResult = await pool.query(
            `
                SELECT
                    q.id,
                    q.title,
                    LOWER(COALESCE(q.type, 'mcq')) AS type,
                    q.language,
                    q.function_name AS "functionName",
                    q.input_format,
                    q.output_format,
                    COALESCE(t.name, 'General') AS topic,
                    COALESCE(qqm.weightage, q.weightage, 1) AS weightage,
                    COALESCE(
                      json_agg(
                        json_build_object(
                          'id', mo.id,
                          'option_text', mo.option_text,
                          'is_correct', mo.is_correct
                        ) ORDER BY mo.id
                      ) FILTER (WHERE mo.id IS NOT NULL),
                      '[]'::json
                    ) AS options
                FROM quiz_questions_map qqm
                JOIN questions q ON q.id = qqm.question_id
                LEFT JOIN topics t ON t.id = q.topic_id
                LEFT JOIN mcq_options mo ON mo.question_id = q.id
                WHERE qqm.quiz_id = $1
                GROUP BY q.id, q.title, q.type, q.language, q.function_name, q.input_format, q.output_format, t.name, qqm.weightage, q.weightage
                ORDER BY q.created_at ASC;
            `,
            [id]
        );

        return res.json({
            mode: "practice",
            timed: false,
            persistent: false,
            quiz: quizResult.rows[0],
            questions: questionsResult.rows
        });
    } catch (err) {
        console.error("Practice quiz fetch error:", err);
        return res.status(500).json({ error: "Failed to load practice quiz" });
    }
});

// AI-only code feedback for practice mode (no persistence)
router.post("/practice/code-feedback", auth, async (req, res) => {
    try {
        const {
            questionText,
            code,
            language,
            input_format,
            output_format,
            max_marks
        } = req.body || {};

        if (!code || !questionText) {
            return res.status(400).json({ error: "questionText and code are required" });
        }

        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            return res.json({
                logicScore: 0,
                isLikelyCorrect: false,
                feedback: "AI key not configured. Code review is unavailable in this environment.",
                suggestions: ""
            });
        }

        const analysis = await analyzeCode({
            code,
            question: questionText,
            language: language || "javascript",
            input_format,
            output_format,
            max_marks: Number(max_marks || 1),
            apiKey
        });

        const logicScore = Number(analysis.logic_score || 0);
        return res.json({
            logicScore,
            isLikelyCorrect: logicScore >= 0.7,
            feedback: analysis.feedback || "",
            suggestions: analysis.suggestions || ""
        });
    } catch (err) {
        console.error("Practice code feedback error:", err);
        return res.status(500).json({ error: "Failed to generate practice code feedback" });
    }
});

module.exports = router;
