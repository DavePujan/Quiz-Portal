const pool = require("../db");
const { classifyQuestion } = require("../utils/topicClassifier");
const { generateTopic } = require("../utils/dynamicTopicGenerator");
const redisClient = require("../config/redis");

const TOPIC_NAME_CACHE = new Map();

async function ensureProfileEnrollmentColumn() {
  await pool.query(`
    ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS enrollment_no TEXT;
  `);
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = String(value).replace(/"/g, '""');
  if (/[",\n]/.test(text)) return `"${text}"`;
  return text;
}

function fileNamePart(value, fallback = "na") {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return cleaned || fallback;
}

function getPerformanceLabel(percentage) {
  const pct = Number(percentage || 0);
  if (pct >= 80) return "Good";
  if (pct >= 50) return "Average";
  return "Needs Improvement";
}

function getIntegrityBand(score) {
  const n = Number(score || 0);
  if (n >= 80) return "Cheating Likely";
  if (n >= 50) return "High Risk";
  if (n >= 20) return "Suspicious";
  return "Safe";
}

// Student visibility for teachers is based on the active institutional
// membership, never on the legacy free-text profiles.department value.
function getTeacherDepartmentScope(req) {
  const scope = req.context;
  if (!scope?.userId || !scope?.institutionId || !scope?.departmentId) {
    const error = new Error("An active teacher department assignment is required.");
    error.status = 403;
    throw error;
  }
  return scope;
}

function sameDepartmentStudentPredicate(profileAlias = "p") {
  return `
    EXISTS (
      SELECT 1
      FROM institution_memberships student_membership
      WHERE student_membership.user_id = ${profileAlias}.id
        AND student_membership.is_active = true
        AND student_membership.role = 'student'
        AND student_membership.institution_id = $3
        AND student_membership.department_id = $2
    )`;
}

async function assertTeacherCanAccessQuiz(quizId, teacherId) {
  const result = await pool.query(`
    SELECT 1
    FROM quizzes q
    LEFT JOIN course_offerings co ON co.id = q.course_offering_id
    WHERE q.id = $1
      AND (co.teacher_id = $2 OR q.created_by = $2)
    LIMIT 1;
  `, [quizId, teacherId]);

  if (result.rowCount === 0) {
    const error = new Error("Quiz not found or access denied.");
    error.status = 404;
    throw error;
  }
}

async function getTopicNameById(topicId) {
  const numericId = Number(topicId);
  if (!Number.isFinite(numericId)) return "Other";

  if (TOPIC_NAME_CACHE.has(numericId)) {
    return TOPIC_NAME_CACHE.get(numericId);
  }

  try {
    const result = await pool.query("SELECT name FROM topics WHERE id = $1 LIMIT 1", [numericId]);
    const name = result.rows[0]?.name || "Other";
    TOPIC_NAME_CACHE.set(numericId, name);
    return name;
  } catch (err) {
    return "Other";
  }
}

async function enrichQuestionsWithAI(questions = []) {
  const enriched = [];

  for (const q of questions) {
    const sourceText = q.title || q.question_title || "";
    let topicId = null;
    let confidence = 0;

    try {
      const ml = await classifyQuestion(sourceText);
      if (ml && Number(ml.confidence) > 0.6) {
        topicId = ml.topicId;
        confidence = Number(ml.confidence);
      } else {
        topicId = await generateTopic(sourceText);
      }
    } catch (err) {
      try {
        topicId = await generateTopic(sourceText);
      } catch (fallbackErr) {
        topicId = null;
      }
    }

    const aiTopicName = topicId !== null ? await getTopicNameById(topicId) : (q.topic || "Other");

    enriched.push({
      ...q,
      ai_topic_id: topicId,
      ai_topic: aiTopicName,
      confidence
    });
  }

  return enriched;
}

function generateAdvancedInsights({ topicPerformance = [], questionDifficulty = [], live = null }) {
  const insights = [];

  const parsedTopics = [...topicPerformance].map((t) => ({
    ...t,
    avg_score: Number(t.avg_score) || 0
  }));
  const parsedQuestions = [...questionDifficulty].map((q) => ({
    ...q,
    accuracy: Number(q.accuracy) || 0,
    confidence: q.confidence === null || q.confidence === undefined ? null : Number(q.confidence)
  }));

  const weakest = [...parsedTopics].sort((a, b) => a.avg_score - b.avg_score)[0];
  if (weakest && weakest.avg_score < 50) {
    insights.push(
      `Critical weakness in "${weakest.topic}" (${weakest.avg_score}%). Students lack conceptual clarity.`
    );
  }

  const inconsistent = parsedTopics.filter((t) => t.avg_score >= 50 && t.avg_score <= 70);
  if (inconsistent.length > 0) {
    insights.push(
      `Inconsistent performance in ${inconsistent.map((t) => t.topic).join(", ")}. Practice needed.`
    );
  }

  const strong = parsedTopics.filter((t) => t.avg_score >= 85);
  if (strong.length > 0) {
    insights.push(`Strong mastery in ${strong.map((t) => t.topic).join(", ")}.`);
  }

  const hardest = [...parsedQuestions].sort((a, b) => a.accuracy - b.accuracy)[0];
  if (hardest && hardest.accuracy < 30) {
    insights.push(
      `Most students failed "${hardest.title}". Consider revising or simplifying this question.`
    );
  }

  const lowConfidenceQuestions = parsedQuestions.filter(
    (q) => q.confidence !== null && q.confidence < 0.5
  );
  if (lowConfidenceQuestions.length > 0) {
    insights.push(
      "Some questions have ambiguous topic classification. Consider reviewing question clarity."
    );
  }

  if (live?.isLive && Number(live?.active || 0) === 0) {
    insights.push("Live quiz is active but no students are currently active.");
  }

  if ((weakest?.avg_score || 0) < 40) {
    insights.push(
      "Recommendation: Conduct a revision session and provide guided problem-solving."
    );
  } else {
    insights.push(
      "Recommendation: Increase difficulty level to challenge students further."
    );
  }

  if (insights.length === 0) {
    insights.push("No significant patterns yet. Collect more attempts for stronger AI insights.");
  }

  return insights;
}

async function resolveStudentProfileId(req, routeId) {
  // For student-facing endpoints, prefer authenticated identity when route uses "me"
  // or when role is student and token identity may be legacy/non-UUID.
  const shouldResolveFromAuth = routeId === "me" || req.user?.role === "student";
  if (!shouldResolveFromAuth) {
    return routeId;
  }

  const email = req.user?.email;
  if (!email) {
    return routeId;
  }

  const profileResult = await pool.query(
    "SELECT id FROM profiles WHERE email = $1 LIMIT 1",
    [email]
  );

  return profileResult.rows[0]?.id || routeId;
}

// ================================
// GET QUIZ ANALYTICS (TEACHER)
// ================================
const getQuizAnalytics = async (req, res) => {
  const { quizId } = req.params;

  try {
    await ensureProfileEnrollmentColumn();
    const scope = getTeacherDepartmentScope(req);
    await assertTeacherCanAccessQuiz(quizId, scope.userId);

    const cacheKey = `analytics:teacher:quiz:${quizId}:institution:${scope.institutionId}:department:${scope.departmentId}:ai-v3`;

    if (redisClient.isAvailable) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
    }

    /* --------------------------------
       0. QUIZ METADATA (for live-only block)
    -------------------------------- */
    const quizMetaQuery = `
      SELECT id, is_active, scheduled_at, duration, subject, department, semester
      FROM quizzes
      WHERE id = $1
      LIMIT 1;
    `;
    const quizMetaResult = await pool.query(quizMetaQuery, [quizId]);
    const quizMeta = quizMetaResult.rows[0] || null;

    const now = new Date();
    const scheduledAt = quizMeta?.scheduled_at ? new Date(quizMeta.scheduled_at) : null;
    const durationMinutes = Number(quizMeta?.duration || 0);
    const endAt = scheduledAt && durationMinutes > 0 ? new Date(scheduledAt.getTime() + durationMinutes * 60 * 1000) : null;
    const isLive = Boolean(
      quizMeta?.is_active &&
      scheduledAt &&
      (!endAt || now <= endAt) &&
      now >= scheduledAt
    );

    /* --------------------------------
       1. OVERVIEW CARDS
       - Now returns avg_score AND avg_percentage
       - Uses total_marks from quiz_attempts
    -------------------------------- */
    const overviewQuery = `
      WITH quiz_marks AS (
        SELECT quiz_id, SUM(COALESCE(weightage, 0)) AS effective_total
        FROM quiz_questions_map
        WHERE quiz_id = $1
        GROUP BY quiz_id
      )
      SELECT
        COUNT(*) AS total_attempts,
        ROUND(AVG(qa.score)::numeric, 2) AS avg_score,
        ROUND(
          AVG(
            CASE
              WHEN COALESCE(NULLIF(qm.effective_total, 0), NULLIF(qa.total_marks, 0), 0) > 0
              THEN (qa.score / COALESCE(NULLIF(qm.effective_total, 0), NULLIF(qa.total_marks, 0))) * 100
              ELSE 0
            END
          )::numeric,
          2
        ) AS avg_percentage,
        ROUND(
          MAX(
            CASE
              WHEN COALESCE(NULLIF(qm.effective_total, 0), NULLIF(qa.total_marks, 0), 0) > 0
              THEN (qa.score / COALESCE(NULLIF(qm.effective_total, 0), NULLIF(qa.total_marks, 0))) * 100
              ELSE 0
            END
          )::numeric,
          2
        ) AS max_percentage,
        ROUND(
          MIN(
            CASE
              WHEN COALESCE(NULLIF(qm.effective_total, 0), NULLIF(qa.total_marks, 0), 0) > 0
              THEN (qa.score / COALESCE(NULLIF(qm.effective_total, 0), NULLIF(qa.total_marks, 0))) * 100
              ELSE 0
            END
          )::numeric,
          2
        ) AS min_percentage
      FROM quiz_attempts qa
      LEFT JOIN quiz_marks qm ON qm.quiz_id = qa.quiz_id
      LEFT JOIN profiles p ON p.id = qa.user_id
      WHERE qa.quiz_id = $1
        AND qa.status IN ('submitted', 'evaluated')
        AND ${sameDepartmentStudentPredicate("p")};
    `;
    const overviewResult = await pool.query(overviewQuery, [quizId, scope.departmentId, scope.institutionId]);

    /* --------------------------------
       2. SCORE DISTRIBUTION (Percentage Based)
       - Buckets: 0, 10, 20... 90, 100
    -------------------------------- */
    const scoreDistQuery = `
      WITH quiz_marks AS (
        SELECT quiz_id, SUM(COALESCE(weightage, 0)) AS effective_total
        FROM quiz_questions_map
        WHERE quiz_id = $1
        GROUP BY quiz_id
      )
      SELECT
        FLOOR((
          CASE
            WHEN COALESCE(NULLIF(qm.effective_total, 0), NULLIF(qa.total_marks, 0), 0) > 0
            THEN (qa.score / COALESCE(NULLIF(qm.effective_total, 0), NULLIF(qa.total_marks, 0))) * 100
            ELSE 0
          END
        ) / 10) * 10 AS bucket,
        COUNT(*) AS students
      FROM quiz_attempts qa
      LEFT JOIN quiz_marks qm ON qm.quiz_id = qa.quiz_id
      LEFT JOIN profiles p ON p.id = qa.user_id
      WHERE qa.quiz_id = $1
        AND qa.status IN ('submitted', 'evaluated')
        AND ${sameDepartmentStudentPredicate("p")}
      GROUP BY bucket
      ORDER BY bucket;
    `;
    const scoreDistResult = await pool.query(scoreDistQuery, [quizId, scope.departmentId, scope.institutionId]);

    // Fill missing buckets for cleaner chart
    const fullBuckets = [];
    const resultMap = {};
    scoreDistResult.rows.forEach(r => resultMap[r.bucket] = parseInt(r.students));

    for (let i = 0; i <= 100; i += 10) {
      fullBuckets.push({
        range: `${i}%-${i + 9}%`, // e.g. "0%-9%", "10%-19%"
        students: resultMap[i] || 0
      });
    }

    /* --------------------------------
       3. QUESTION DIFFICULTY
       - Uses COUNT(DISTINCT attempt_id)
    -------------------------------- */
    const questionDifficultyQuery = `
      SELECT
        q.id,
        q.title,
        q.type,
        COUNT(DISTINCT qa.attempt_id) AS attempts,
        ROUND(
          (SUM(CASE WHEN qa.is_correct THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(DISTINCT qa.attempt_id), 0))::numeric,
          2
        ) AS accuracy
      FROM quiz_answers qa
      JOIN questions q ON q.id = qa.question_id
      WHERE qa.attempt_id IN (
        SELECT qa2.id FROM quiz_attempts qa2
        LEFT JOIN profiles p ON p.id = qa2.user_id
        WHERE qa2.quiz_id = $1
          AND qa2.status IN ('submitted', 'evaluated')
          AND ${sameDepartmentStudentPredicate("p")}
      )
      GROUP BY q.id, q.title, q.type;
    `;
    const questionDifficultyResult = await pool.query(
      questionDifficultyQuery,
      [quizId, scope.departmentId, scope.institutionId]
    );

    const enrichedQuestionDifficulty = await enrichQuestionsWithAI(questionDifficultyResult.rows);

    const weakQuestions = [...enrichedQuestionDifficulty]
      .sort((a, b) => Number(a.accuracy) - Number(b.accuracy))
      .slice(0, 3);

    /* --------------------------------
       3.5 TOP STUDENTS SNAPSHOT
    -------------------------------- */
    const topStudentsQuery = `
      WITH quiz_marks AS (
        SELECT quiz_id, SUM(COALESCE(weightage, 0)) AS effective_total
        FROM quiz_questions_map
        WHERE quiz_id = $1
        GROUP BY quiz_id
      )
      SELECT
        COALESCE(NULLIF(TRIM(p.full_name), ''), p.email, 'Student') AS name,
        p.enrollment_no,
        ROUND(
          (
            CASE
              WHEN COALESCE(NULLIF(qm.effective_total, 0), NULLIF(qa.total_marks, 0), 0) > 0
              THEN (qa.score / COALESCE(NULLIF(qm.effective_total, 0), NULLIF(qa.total_marks, 0))) * 100
              ELSE 0
            END
          )::numeric,
          2
        ) AS score
      FROM quiz_attempts qa
      LEFT JOIN profiles p ON p.id = qa.user_id
      LEFT JOIN quiz_marks qm ON qm.quiz_id = qa.quiz_id
      WHERE qa.quiz_id = $1
        AND qa.status IN ('submitted', 'evaluated')
        AND ${sameDepartmentStudentPredicate("p")}
      ORDER BY score DESC
      LIMIT 5;
    `;
    const topStudentsResult = await pool.query(topStudentsQuery, [quizId, scope.departmentId, scope.institutionId]);

    /* --------------------------------
       3.6 LIVE ACTIVITY (STRICTLY for live quizzes)
    -------------------------------- */
    let liveActivity = null;
    if (isLive) {
      const activeStudentsQuery = `
        SELECT COUNT(DISTINCT qa.user_id) AS active
        FROM quiz_attempts qa
        LEFT JOIN profiles p ON p.id = qa.user_id
        WHERE qa.quiz_id = $1
          AND qa.status IN ('submitted', 'evaluated')
          AND qa.submitted_at >= NOW() - INTERVAL '10 minutes'
          AND ${sameDepartmentStudentPredicate("p")};
      `;

      const recentSubmissionsQuery = `
        SELECT COUNT(*) AS recent_submissions
        FROM quiz_attempts qa
        LEFT JOIN profiles p ON p.id = qa.user_id
        WHERE qa.quiz_id = $1
          AND qa.status IN ('submitted', 'evaluated')
          AND qa.submitted_at >= NOW() - INTERVAL '5 minutes'
          AND ${sameDepartmentStudentPredicate("p")};
      `;

      const avgTimePerQuestionQuery = `
        SELECT
          ROUND(
            AVG(
              CASE
                WHEN ans_cnt.answer_count > 0 AND qa.created_at IS NOT NULL AND qa.submitted_at IS NOT NULL
                THEN EXTRACT(EPOCH FROM (qa.submitted_at - qa.created_at)) / 60.0 / ans_cnt.answer_count
                ELSE NULL
              END
            )::numeric,
            2
          ) AS avg_time
        FROM quiz_attempts qa
        LEFT JOIN profiles p ON p.id = qa.user_id
        LEFT JOIN (
          SELECT attempt_id, COUNT(*) AS answer_count
          FROM quiz_answers
          GROUP BY attempt_id
        ) ans_cnt ON ans_cnt.attempt_id = qa.id
        WHERE qa.quiz_id = $1
          AND qa.status IN ('submitted', 'evaluated')
          AND ${sameDepartmentStudentPredicate("p")};
      `;

      const [activeStudentsResult, recentSubmissionsResult, avgTimePerQuestionResult] = await Promise.all([
        pool.query(activeStudentsQuery, [quizId, scope.departmentId, scope.institutionId]),
        pool.query(recentSubmissionsQuery, [quizId, scope.departmentId, scope.institutionId]),
        pool.query(avgTimePerQuestionQuery, [quizId, scope.departmentId, scope.institutionId])
      ]);

      const avgTimeValue = avgTimePerQuestionResult.rows[0]?.avg_time;
      liveActivity = {
        isLive: true,
        active: Number(activeStudentsResult.rows[0]?.active || 0),
        recent_submissions: Number(recentSubmissionsResult.rows[0]?.recent_submissions || 0),
        avg_time: avgTimeValue !== null && avgTimeValue !== undefined ? `${avgTimeValue} min` : "-"
      };
    }

    /* --------------------------------
       4. DETAILED TOPIC ANALYSIS
       - Hierarchy: Topic -> Questions
       - Includes insights and performance labels
    -------------------------------- */
    // Production-grade topic analysis:
    // 1) use AI-enriched question topics when native topic mapping is weak,
    // 2) compute weighted topic accuracy by attempts,
    // 3) include actionable insight snippets.
    const topicMap = {};
    for (const q of enrichedQuestionDifficulty) {
      const topicName = q.ai_topic || q.topic || "Other";
      const attempts = Number(q.attempts || 0);
      const accuracy = Number(q.accuracy || 0);

      if (!topicMap[topicName]) {
        topicMap[topicName] = {
          topic: topicName,
          questions: [],
          weightedAccuracySum: 0,
          attemptsSum: 0,
          questionCount: 0
        };
      }

      topicMap[topicName].questions.push({
        title: q.title,
        accuracy: Number(accuracy.toFixed(2)),
        attempts
      });
      topicMap[topicName].weightedAccuracySum += accuracy * Math.max(1, attempts);
      topicMap[topicName].attemptsSum += Math.max(1, attempts);
      topicMap[topicName].questionCount += 1;
    }

    const detailedTopicAnalysis = Object.values(topicMap)
      .map((t) => {
        const avgAccuracy = t.attemptsSum > 0 ? t.weightedAccuracySum / t.attemptsSum : 0;

        let performance = "Moderate";
        if (avgAccuracy < 30) performance = "Very Weak";
        else if (avgAccuracy < 50) performance = "Weak";
        else if (avgAccuracy < 70) performance = "Moderate";
        else if (avgAccuracy < 90) performance = "Good";
        else performance = "Excellent";

        const hardest = [...t.questions].sort((a, b) => a.accuracy - b.accuracy)[0];
        const easiest = [...t.questions].sort((a, b) => b.accuracy - a.accuracy)[0];
        const coverage = `${t.questionCount} question${t.questionCount > 1 ? "s" : ""}`;

        let insight = `Coverage: ${coverage}.`;
        if (hardest) {
          insight += ` Hardest item: \"${hardest.title}\" (${hardest.accuracy}%).`;
        }
        if (easiest && easiest.title !== hardest?.title) {
          insight += ` Strongest item: \"${easiest.title}\" (${easiest.accuracy}%).`;
        }

        if (performance === "Very Weak" || performance === "Weak") {
          insight += " Recommend targeted remediation, concept recap, and guided examples.";
        } else if (performance === "Moderate") {
          insight += " Concept familiarity exists; reinforce with mixed-difficulty practice.";
        } else {
          insight += " Topic performance is healthy; introduce challenge questions to deepen mastery.";
        }

        return {
          topic: t.topic,
          avg_score: Number(avgAccuracy.toFixed(2)),
          performance,
          insight,
          questions: t.questions
        };
      })
      .sort((a, b) => Number(b.avg_score) - Number(a.avg_score));

    const aiInsights = generateAdvancedInsights({
      topicPerformance: detailedTopicAnalysis,
      questionDifficulty: enrichedQuestionDifficulty,
      live: liveActivity
    });

    let integrityReport = [];
    try {
      const integrityQuery = `
        SELECT
          COALESCE(NULLIF(TRIM(p.full_name), ''), p.email, 'Student') AS student,
          p.full_name,
          p.enrollment_no,
          p.email,
          l.user_id,
          l.final_score,
          l.risk_level,
          l.tab_switches,
          l.fullscreen_exits,
          l.window_blurs,
          l.copy_events,
          l.devtools_attempts,
          l.reasons,
          l.event_timeline,
          l.updated_at
        FROM exam_behavior_logs l
        LEFT JOIN profiles p ON p.id = l.user_id
        WHERE l.quiz_id = $1
          AND ${sameDepartmentStudentPredicate("p")}
        ORDER BY l.final_score DESC, l.updated_at DESC;
      `;
      const integrityResult = await pool.query(integrityQuery, [quizId, scope.departmentId, scope.institutionId]);
      integrityReport = integrityResult.rows;
    } catch (integrityErr) {
      integrityReport = [];
    }

    const studentReportQuery = `
      WITH quiz_marks AS (
        SELECT quiz_id, SUM(COALESCE(weightage, 0)) AS effective_total
        FROM quiz_questions_map
        WHERE quiz_id = $1
        GROUP BY quiz_id
      ),
      latest_integrity AS (
        SELECT DISTINCT ON (attempt_id)
          attempt_id,
          final_score,
          risk_level
        FROM exam_behavior_logs
        WHERE quiz_id = $1
        ORDER BY attempt_id, updated_at DESC
      )
      SELECT
        qa.id AS attempt_id,
        qa.status,
        qa.started_at,
        qa.completed_at,
        COALESCE(p.enrollment_no, '-') AS enrollment_no,
        COALESCE(NULLIF(TRIM(p.full_name), ''), p.email, 'Student') AS full_name,
        ROUND(
          (
            CASE
              WHEN COALESCE(NULLIF(qm.effective_total, 0), NULLIF(qa.total_marks, 0), NULLIF(q.total_marks, 0), 0) > 0
              THEN qa.score * COALESCE(NULLIF(q.total_marks, 0), NULLIF(qm.effective_total, 0), NULLIF(qa.total_marks, 0), 1)
                / COALESCE(NULLIF(qm.effective_total, 0), NULLIF(qa.total_marks, 0), NULLIF(q.total_marks, 0), 1)
              ELSE qa.score
            END
          )::numeric,
          2
        ) AS marks,
        ROUND(
          COALESCE(NULLIF(q.total_marks, 0), NULLIF(qm.effective_total, 0), NULLIF(qa.total_marks, 0), 0)::numeric,
          2
        ) AS out_of,
        ROUND(
          (
            CASE
              WHEN COALESCE(NULLIF(q.total_marks, 0), NULLIF(qm.effective_total, 0), NULLIF(qa.total_marks, 0), 0) > 0
              THEN (
                (
                  CASE
                    WHEN COALESCE(NULLIF(qm.effective_total, 0), NULLIF(qa.total_marks, 0), NULLIF(q.total_marks, 0), 0) > 0
                    THEN qa.score * COALESCE(NULLIF(q.total_marks, 0), NULLIF(qm.effective_total, 0), NULLIF(qa.total_marks, 0), 1)
                      / COALESCE(NULLIF(qm.effective_total, 0), NULLIF(qa.total_marks, 0), NULLIF(q.total_marks, 0), 1)
                    ELSE qa.score
                  END
                )
                / COALESCE(NULLIF(q.total_marks, 0), NULLIF(qm.effective_total, 0), NULLIF(qa.total_marks, 0), 1)
              ) * 100
              ELSE 0
            END
          )::numeric,
          2
        ) AS percentage,
        COALESCE(li.final_score, 0) AS integrity_score,
        COALESCE(li.risk_level, 'Safe') AS integrity_risk
      FROM quiz_attempts qa
      LEFT JOIN quizzes q ON q.id = qa.quiz_id
      LEFT JOIN profiles p ON p.id = qa.user_id
      LEFT JOIN quiz_marks qm ON qm.quiz_id = qa.quiz_id
      LEFT JOIN latest_integrity li ON li.attempt_id = qa.id
      WHERE qa.quiz_id = $1
        AND qa.status IN ('submitted', 'evaluated')
        AND ${sameDepartmentStudentPredicate("p")}
      ORDER BY percentage DESC, marks DESC;
    `;
    const studentReportResult = await pool.query(studentReportQuery, [quizId, scope.departmentId, scope.institutionId]);

    const studentReport = studentReportResult.rows.map((row) => {
      const pct = Number(row.percentage || 0);
      const startedAt = row.started_at ? new Date(row.started_at) : null;
      const completedAt = row.completed_at ? new Date(row.completed_at) : null;
      const timeTakenSeconds = startedAt && completedAt
        ? Math.max(0, Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000))
        : null;

      return {
        ...row,
        performance: getPerformanceLabel(pct),
        integrity_band: getIntegrityBand(row.integrity_score),
        time_taken_seconds: timeTakenSeconds
      };
    });

    const totalStudents = studentReport.length;
    const avgPct = totalStudents > 0
      ? studentReport.reduce((sum, s) => sum + Number(s.percentage || 0), 0) / totalStudents
      : 0;
    const highestPct = totalStudents > 0
      ? Math.max(...studentReport.map((s) => Number(s.percentage || 0)))
      : 0;
    const lowestPct = totalStudents > 0
      ? Math.min(...studentReport.map((s) => Number(s.percentage || 0)))
      : 0;
    const passRate = totalStudents > 0
      ? (studentReport.filter((s) => Number(s.percentage || 0) >= 50).length * 100) / totalStudents
      : 0;

    const performanceCounts = {
      good: studentReport.filter((s) => s.performance === "Good").length,
      average: studentReport.filter((s) => s.performance === "Average").length,
      needsImprovement: studentReport.filter((s) => s.performance === "Needs Improvement").length
    };

    const integrityCounts = {
      safe: studentReport.filter((s) => s.integrity_band === "Safe").length,
      suspicious: studentReport.filter((s) => s.integrity_band === "Suspicious").length,
      highRisk: studentReport.filter((s) => s.integrity_band === "High Risk").length,
      cheatingLikely: studentReport.filter((s) => s.integrity_band === "Cheating Likely").length
    };

    /* --------------------------------
       FINAL RESPONSE
    -------------------------------- */
    const responseData = {
      quizInfo: {
        subject: quizMeta?.subject || "General",
        department: quizMeta?.department || "-",
        semester: quizMeta?.semester || "-"
      },
      summary: {
        totalStudents,
        averagePercentage: Number(avgPct.toFixed(2)),
        highestPercentage: Number(highestPct.toFixed(2)),
        lowestPercentage: Number(lowestPct.toFixed(2)),
        passRate: Number(passRate.toFixed(2)),
        performanceCounts,
        integrityCounts
      },
      overview: overviewResult.rows[0],
      scoreDistribution: fullBuckets,
      questionDifficulty: enrichedQuestionDifficulty,
      topicPerformance: detailedTopicAnalysis,
      topStudents: topStudentsResult.rows,
      studentReport,
      weakQuestions,
      live: liveActivity,
      aiInsights,
      integrityReport
    };

    if (redisClient.isAvailable) {
      await redisClient.set(cacheKey, JSON.stringify(responseData), "EX", 60);
    }

    return res.json(responseData);

  } catch (error) {
    console.error("Analytics error:", error);
    res.status(error.status || 500).json({ error: error.message || "Failed to fetch analytics" });
  }
};

const exportQuizAnalyticsCsv = async (req, res) => {
  const { quizId } = req.params;

  try {
    await ensureProfileEnrollmentColumn();
    const scope = getTeacherDepartmentScope(req);
    await assertTeacherCanAccessQuiz(quizId, scope.userId);

    const useNewAcademicModel = process.env.USE_NEW_ACADEMIC_MODEL === 'true';
    const quizMetaQuery = useNewAcademicModel
      ? `
        SELECT 
          id, 
          title, 
          COALESCE((SELECT s.name FROM course_offerings co JOIN subjects s ON s.id = co.subject_id WHERE co.id = quizzes.course_offering_id), 'General') AS subject, 
          COALESCE((SELECT d.name FROM course_offerings co JOIN academic_terms at ON at.id = co.academic_term_id JOIN programs p ON p.id = at.program_id JOIN departments d ON d.id = p.department_id WHERE co.id = quizzes.course_offering_id), '-') AS department, 
          COALESCE((SELECT at.term_number::text FROM course_offerings co JOIN academic_terms at ON at.id = co.academic_term_id WHERE co.id = quizzes.course_offering_id), '-') AS semester
        FROM quizzes
        WHERE id = $1
        LIMIT 1;
      `
      : `
        SELECT id, title, COALESCE(subject, 'General') AS subject, COALESCE(department, '-') AS department, COALESCE(semester, '-') AS semester
        FROM quizzes
        WHERE id = $1
        LIMIT 1;
      `;
    const quizMetaResult = await pool.query(quizMetaQuery, [quizId]);
    if (quizMetaResult.rows.length === 0) {
      return res.status(404).json({ error: "Quiz not found" });
    }
    const quizMeta = quizMetaResult.rows[0];

    const exportQuery = `
      WITH quiz_marks AS (
        SELECT quiz_id, SUM(COALESCE(weightage, 0)) AS effective_total
        FROM quiz_questions_map
        WHERE quiz_id = $1
        GROUP BY quiz_id
      ),
      latest_integrity AS (
        SELECT DISTINCT ON (attempt_id)
          attempt_id,
          final_score
        FROM exam_behavior_logs
        WHERE quiz_id = $1
        ORDER BY attempt_id, updated_at DESC
      )
      SELECT
        qa.status,
        qa.started_at,
        qa.completed_at,
        COALESCE(p.enrollment_no, '-') AS enrollment_no,
        COALESCE(NULLIF(TRIM(p.full_name), ''), p.email, 'Student') AS full_name,
        ROUND(
          (
            CASE
              WHEN COALESCE(NULLIF(qm.effective_total, 0), NULLIF(qa.total_marks, 0), NULLIF(q.total_marks, 0), 0) > 0
              THEN qa.score * COALESCE(NULLIF(q.total_marks, 0), NULLIF(qm.effective_total, 0), NULLIF(qa.total_marks, 0), 1)
                / COALESCE(NULLIF(qm.effective_total, 0), NULLIF(qa.total_marks, 0), NULLIF(q.total_marks, 0), 1)
              ELSE qa.score
            END
          )::numeric,
          2
        ) AS marks,
        ROUND(
          COALESCE(NULLIF(q.total_marks, 0), NULLIF(qm.effective_total, 0), NULLIF(qa.total_marks, 0), 0)::numeric,
          2
        ) AS out_of,
        ROUND(
          (
            CASE
              WHEN COALESCE(NULLIF(q.total_marks, 0), NULLIF(qm.effective_total, 0), NULLIF(qa.total_marks, 0), 0) > 0
              THEN (
                (
                  CASE
                    WHEN COALESCE(NULLIF(qm.effective_total, 0), NULLIF(qa.total_marks, 0), NULLIF(q.total_marks, 0), 0) > 0
                    THEN qa.score * COALESCE(NULLIF(q.total_marks, 0), NULLIF(qm.effective_total, 0), NULLIF(qa.total_marks, 0), 1)
                      / COALESCE(NULLIF(qm.effective_total, 0), NULLIF(qa.total_marks, 0), NULLIF(q.total_marks, 0), 1)
                    ELSE qa.score
                  END
                )
                / COALESCE(NULLIF(q.total_marks, 0), NULLIF(qm.effective_total, 0), NULLIF(qa.total_marks, 0), 1)
              ) * 100
              ELSE 0
            END
          )::numeric,
          2
        ) AS percentage,
        COALESCE(li.final_score, 0) AS integrity_score
      FROM quiz_attempts qa
      LEFT JOIN quizzes q ON q.id = qa.quiz_id
      LEFT JOIN profiles p ON p.id = qa.user_id
      LEFT JOIN quiz_marks qm ON qm.quiz_id = qa.quiz_id
      LEFT JOIN latest_integrity li ON li.attempt_id = qa.id
      WHERE qa.quiz_id = $1
        AND qa.status IN ('submitted', 'evaluated')
        AND ${sameDepartmentStudentPredicate("p")}
      ORDER BY percentage DESC, marks DESC;
    `;

    const rowsResult = await pool.query(exportQuery, [quizId, scope.departmentId, scope.institutionId]);

    const lines = [];
    lines.push(`Department,${csvCell(quizMeta.department)}`);
    lines.push(`Semester,${csvCell(quizMeta.semester)}`);
    lines.push(`Subject,${csvCell(quizMeta.subject)}`);
    lines.push("");

    const totalStudents = rowsResult.rows.length;
    const avgPct = totalStudents > 0
      ? rowsResult.rows.reduce((sum, r) => sum + Number(r.percentage || 0), 0) / totalStudents
      : 0;
    const highestPct = totalStudents > 0
      ? Math.max(...rowsResult.rows.map((r) => Number(r.percentage || 0)))
      : 0;
    const lowestPct = totalStudents > 0
      ? Math.min(...rowsResult.rows.map((r) => Number(r.percentage || 0)))
      : 0;
    const passRate = totalStudents > 0
      ? (rowsResult.rows.filter((r) => Number(r.percentage || 0) >= 50).length * 100) / totalStudents
      : 0;

    lines.push(`Total Students,${csvCell(totalStudents)}`);
    lines.push(`Average Percentage,${csvCell(avgPct.toFixed(2) + '%')}`);
    lines.push(`Highest Percentage,${csvCell(highestPct.toFixed(2) + '%')}`);
    lines.push(`Lowest Percentage,${csvCell(lowestPct.toFixed(2) + '%')}`);
    lines.push(`Pass Rate,${csvCell(passRate.toFixed(2) + '%')}`);
    lines.push("");

    lines.push("Enrollment No,Full Name,Marks,Out Of,Percentage,Performance,Integrity Score (0-100),Integrity Risk,Status,Submitted At,Time Taken (min)");

    for (const row of rowsResult.rows) {
      const pct = Number(row.percentage || 0);
      const performance = getPerformanceLabel(pct);
      const integrityBand = getIntegrityBand(row.integrity_score);
      const startedAt = row.started_at ? new Date(row.started_at) : null;
      const completedAt = row.completed_at ? new Date(row.completed_at) : null;
      const timeTakenMinutes = startedAt && completedAt
        ? Math.max(0, (completedAt.getTime() - startedAt.getTime()) / 60000)
        : "";
      lines.push([
        csvCell(row.enrollment_no),
        csvCell(row.full_name),
        csvCell(Number(row.marks || 0)),
        csvCell(Number(row.out_of || 0)),
        csvCell(`${pct.toFixed(2)}%`),
        csvCell(performance),
        csvCell(Number(row.integrity_score || 0)),
        csvCell(integrityBand),
        csvCell(row.status || "submitted"),
        csvCell(row.completed_at ? new Date(row.completed_at).toISOString() : ""),
        csvCell(timeTakenMinutes === "" ? "" : Number(timeTakenMinutes).toFixed(2))
      ].join(","));
    }

    const csv = lines.join("\n");
    const deptPart = fileNamePart(quizMeta.department, "dept");
    const semPart = fileNamePart(quizMeta.semester, "sem");
    const subjectPart = fileNamePart(quizMeta.subject, "subject");
    const titlePart = fileNamePart(quizMeta.title, "quiz");
    const reportName = `${deptPart}-${semPart}-${subjectPart}-${titlePart}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${reportName}"`);
    return res.status(200).send(csv);
  } catch (error) {
    console.error("Analytics export error:", error);
    return res.status(error.status || 500).json({ error: error.message || "Failed to export analytics report" });
  }
};

// ================================
// GET STUDENT COMPREHENSIVE ANALYTICS
// ================================
const getStudentComprehensiveAnalytics = async (req, res) => {
  const { studentId } = req.params;

  try {
    const resolvedStudentId = await resolveStudentProfileId(req, studentId);

    const submittedAtColumnCheck = await pool.query(
      `
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'quiz_attempts' AND column_name = 'submitted_at'
        LIMIT 1;
      `
    );
    const submittedAtExpr = submittedAtColumnCheck.rows.length > 0
      ? "qa.submitted_at"
      : "COALESCE(qa.completed_at, qa.started_at)";

    const useNewAcademicModel = process.env.USE_NEW_ACADEMIC_MODEL === 'true';
    const subjectSelect = useNewAcademicModel 
      ? `COALESCE((SELECT s.name FROM course_offerings co JOIN subjects s ON s.id = co.subject_id WHERE co.id = q.course_offering_id), 'General')`
      : `COALESCE(q.subject, 'General')`;

    // 1. Fetch all quiz attempts for this student
    const attemptsQuery = `
          SELECT 
              qa.id,
              qa.quiz_id,
              qa.score,
              COALESCE(qa.total_marks, q.total_marks, 0) AS total_marks,
              ${submittedAtExpr} AS submitted_at,
              q.title as quiz_title,
              ${subjectSelect} AS subject,
              ROUND(
                (
                  CASE
                    WHEN COALESCE(qa.total_marks, q.total_marks, 0) > 0
                    THEN qa.score * 100.0 / COALESCE(qa.total_marks, q.total_marks, 1)
                    ELSE 0
                  END
                )::numeric,
                2
              ) AS percentage
          FROM quiz_attempts qa
          JOIN quizzes q ON q.id = qa.quiz_id
          WHERE qa.user_id = $1 AND qa.status IN ('submitted', 'evaluated')
          ORDER BY ${submittedAtExpr} DESC
      `;
    const attemptsResult = await pool.query(attemptsQuery, [resolvedStudentId]);
    const attempts = attemptsResult.rows;

    // 2. Fetch all answers to analyze topics
    const answersQuery = `
          SELECT 
              q.title as question_text,
              COALESCE(t.name, 'Unclassified') as topic,
              ans.is_correct,
              ans.marks_obtained,
              q.weightage
          FROM quiz_answers ans
          JOIN quiz_attempts qa ON qa.id = ans.attempt_id
          JOIN questions q ON q.id = ans.question_id
          LEFT JOIN topics t ON t.id = q.topic_id
          WHERE qa.user_id = $1 AND qa.status IN ('submitted', 'evaluated')
      `;
        const answersResult = await pool.query(answersQuery, [resolvedStudentId]);
    const topicStats = {};
    let totalQuestions = 0;
    let totalCorrect = 0;

    for (const ans of answersResult.rows) {
      let topic = ans.topic;

      // Use AI topic intelligence if topic is unknown or generic
      if (topic === 'Unclassified' || topic === 'Other') {
        try {
          const ml = await classifyQuestion(ans.question_text || "");
          let inferredTopicId = null;

          if (ml && Number(ml.confidence) > 0.6) {
            inferredTopicId = ml.topicId;
          } else {
            inferredTopicId = await generateTopic(ans.question_text || "");
          }

          topic = await getTopicNameById(inferredTopicId);
        } catch (topicErr) {
          topic = "General";
        }
      }

      if (!topicStats[topic]) {
        topicStats[topic] = { correct: 0, total: 0, marks: 0, totalMarks: 0 };
      }
      topicStats[topic].total++;
      topicStats[topic].totalMarks += ans.weightage;
      if (ans.is_correct) {
        topicStats[topic].correct++;
        totalCorrect++;
      }
      topicStats[topic].marks += ans.marks_obtained;
      totalQuestions++;
    }

    // 3. Prepare Topic Chart Data & Insights
    const topicPerformance = Object.keys(topicStats).map(topic => {
      const stats = topicStats[topic];
      const accuracy = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
      return {
        topic,
        accuracy: Math.round(accuracy),
        questions: stats.total
      };
    });

    // 4. Subject-wise aggregation
    const subjectPerformanceQuery = `
      SELECT
        ${subjectSelect} AS subject,
        ROUND(
          AVG(
            CASE
              WHEN COALESCE(qa.total_marks, q.total_marks, 0) > 0
              THEN qa.score * 100.0 / COALESCE(qa.total_marks, q.total_marks, 1)
              ELSE 0
            END
          )::numeric,
          2
        ) AS avg_score,
        COUNT(*)::int AS attempts
      FROM quiz_attempts qa
      JOIN quizzes q ON q.id = qa.quiz_id
      WHERE qa.user_id = $1
        AND qa.status IN ('submitted', 'evaluated')
      GROUP BY ${subjectSelect}
      ORDER BY avg_score DESC;
    `;
    const subjectPerformanceResult = await pool.query(subjectPerformanceQuery, [resolvedStudentId]);

    // 5. Quiz-wise deep analysis
    const quizWiseAnalysisQuery = `
      SELECT
        q.id,
        q.title,
        ${subjectSelect} AS subject,
        qa.score,
        COALESCE(qa.total_marks, q.total_marks, 0) AS total_marks,
        ROUND(
          (
            CASE
              WHEN COALESCE(qa.total_marks, q.total_marks, 0) > 0
              THEN qa.score * 100.0 / COALESCE(qa.total_marks, q.total_marks, 1)
              ELSE 0
            END
          )::numeric,
          2
        ) AS percentage,
        ${submittedAtExpr} AS submitted_at
      FROM quiz_attempts qa
      JOIN quizzes q ON q.id = qa.quiz_id
      WHERE qa.user_id = $1
        AND qa.status IN ('submitted', 'evaluated')
      ORDER BY ${submittedAtExpr} DESC;
    `;
    const quizWiseAnalysisResult = await pool.query(quizWiseAnalysisQuery, [resolvedStudentId]);

    // Simple AI Insights based on data
    const insights = [];
    const weakTopics = topicPerformance.filter(t => t.accuracy < 50).map(t => t.topic);
    const strongTopics = topicPerformance.filter(t => t.accuracy > 80).map(t => t.topic);

    if (weakTopics.length > 0) {
      insights.push(`Focus needed on: ${weakTopics.slice(0, 3).join(", ")}.`);
    }
    if (strongTopics.length > 0) {
      insights.push(`Great job in: ${strongTopics.slice(0, 3).join(", ")}!`);
    }

    if (subjectPerformanceResult.rows.length > 0) {
      const weakestSubject = [...subjectPerformanceResult.rows]
        .sort((a, b) => Number(a.avg_score) - Number(b.avg_score))[0];
      if (weakestSubject) {
        insights.push(`Your weakest subject is ${weakestSubject.subject}. Focus more on this area.`);
      }
    }

    if (insights.length === 0) insights.push("Keep practicing to generate more insights!");

    res.json({
      overview: {
        totalQuizzes: attempts.length,
        avgScore: attempts.length > 0
          ? Math.round(
              attempts.reduce((a, b) => {
                const score = Number(b.score || 0);
                const marks = Number(b.total_marks || 0);
                return a + (marks > 0 ? (score / marks) * 100 : 0);
              }, 0) / attempts.length
            )
          : 0,
        globalRank: "Top 10%" // Placeholder or calculate real rank
      },
      history: attempts,
      topicPerformance,
      subjectPerformance: subjectPerformanceResult.rows,
      quizWiseAnalysis: quizWiseAnalysisResult.rows,
      aiInsights: insights
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
};

const getStudentRecommendations = async (req, res) => {
  const { userId } = req.params;

  try {
    const resolvedUserId = await resolveStudentProfileId(req, userId);

    const useNewAcademicModel = process.env.USE_NEW_ACADEMIC_MODEL === 'true';
    const subjectSelect = useNewAcademicModel
      ? `COALESCE((SELECT s.name FROM course_offerings co JOIN subjects s ON s.id = co.subject_id WHERE co.id = q.course_offering_id), 'General')`
      : `COALESCE(q.subject, 'General')`;

    const subjectPerformanceQuery = `
      SELECT
        ${subjectSelect} AS subject,
        ROUND(AVG(CASE WHEN qa.total_marks > 0 THEN qa.score * 100.0 / qa.total_marks ELSE 0 END)::numeric, 2) AS avg_score
      FROM quiz_attempts qa
      JOIN quizzes q ON q.id = qa.quiz_id
      WHERE qa.user_id = $1
        AND qa.status IN ('submitted', 'evaluated')
      GROUP BY ${subjectSelect};
    `;
    const subjectRes = await pool.query(subjectPerformanceQuery, [resolvedUserId]);

    if (subjectRes.rows.length === 0) {
      return res.json({ weakSubjects: [], recommendations: [] });
    }

    const weakSubjects = subjectRes.rows
      .filter((s) => Number(s.avg_score) < 60)
      .map((s) => s.subject);

    if (weakSubjects.length === 0) {
      return res.json({ weakSubjects: [], recommendations: [] });
    }

    const recommendationsQuery = `
      SELECT id, title, ${subjectSelect} AS subject
      FROM quizzes q
      WHERE ${subjectSelect} = ANY($1)
        AND q.status IN ('active', 'completed')
        AND (
          NOT EXISTS (
            SELECT 1
            FROM quiz_attempts qa
            WHERE qa.quiz_id = q.id
              AND qa.user_id = $2
              AND qa.status IN ('submitted', 'evaluated')
          )
          OR EXISTS (
            SELECT 1
            FROM quiz_attempts qa
            WHERE qa.quiz_id = q.id
              AND qa.user_id = $2
              AND qa.status IN ('submitted', 'evaluated')
              AND (
                CASE
                  WHEN COALESCE(qa.total_marks, q.total_marks, 0) > 0
                  THEN qa.score * 100.0 / COALESCE(qa.total_marks, q.total_marks, 1)
                  ELSE 0
                END
              ) < 70
          )
        )
      ORDER BY RANDOM()
      LIMIT 10;
    `;
    const quizRes = await pool.query(recommendationsQuery, [weakSubjects, resolvedUserId]);

    // If all weak-subject quizzes are already attempted, still provide practice options.
    let recommendations = quizRes.rows;
    if (recommendations.length === 0) {
      const fallbackQuery = `
        SELECT id, title, ${subjectSelect} AS subject
        FROM quizzes q
        WHERE ${subjectSelect} = ANY($1)
          AND COALESCE(q.is_active, true) = true
          AND (
            NOT EXISTS (
              SELECT 1
              FROM quiz_attempts qa
              WHERE qa.quiz_id = q.id
                AND qa.user_id = $2
                AND qa.status IN ('submitted', 'evaluated')
            )
            OR EXISTS (
              SELECT 1
              FROM quiz_attempts qa
              WHERE qa.quiz_id = q.id
                AND qa.user_id = $2
                AND qa.status IN ('submitted', 'evaluated')
                AND (
                  CASE
                    WHEN COALESCE(qa.total_marks, q.total_marks, 0) > 0
                    THEN qa.score * 100.0 / COALESCE(qa.total_marks, q.total_marks, 1)
                    ELSE 0
                  END
                ) < 70
            )
          )
        ORDER BY RANDOM()
        LIMIT 10;
      `;
      const fallbackRes = await pool.query(fallbackQuery, [weakSubjects, resolvedUserId]);
      recommendations = fallbackRes.rows;
    }

    return res.json({
      weakSubjects,
      recommendations
    });
  } catch (err) {
    console.error("Recommendations error:", err);
    return res.status(500).json({ error: "Failed to fetch recommendations" });
  }
};

const getStudentRecommendationsV2 = async (req, res) => {
  const { userId } = req.params;

  try {
    const resolvedUserId = await resolveStudentProfileId(req, userId);

    const topicPerformanceQuery = `
      SELECT
        q.topic_id,
        COALESCE(t.name, 'Other') AS topic,
        ROUND(AVG(CASE WHEN q.weightage > 0 THEN qa.marks_obtained * 100.0 / q.weightage ELSE 0 END)::numeric, 2) AS accuracy
      FROM quiz_answers qa
      JOIN quiz_attempts a ON a.id = qa.attempt_id
      JOIN questions q ON q.id = qa.question_id
      LEFT JOIN topics t ON t.id = q.topic_id
      WHERE a.user_id = $1
        AND a.status IN ('submitted', 'evaluated')
      GROUP BY q.topic_id, t.name;
    `;
    const topicRes = await pool.query(topicPerformanceQuery, [resolvedUserId]);

    const weakTopics = topicRes.rows
      .filter((t) => t.topic_id && Number(t.accuracy) < 60)
      .map((t) => ({ topicId: t.topic_id, topic: t.topic, accuracy: Number(t.accuracy) }));

    if (weakTopics.length === 0) {
      return res.json({ weakTopics: [], recommendations: [] });
    }

    const hasDifficultyColumnResult = await pool.query(
      `
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'quizzes' AND column_name = 'difficulty'
        LIMIT 1;
      `
    );
    const hasDifficultyColumn = hasDifficultyColumnResult.rows.length > 0;

    const progressByTopicQuery = hasDifficultyColumn
      ? `
          SELECT
            q.topic_id,
            COUNT(*) FILTER (WHERE qu.difficulty = 'easy') AS easy_done,
            COUNT(*) FILTER (WHERE qu.difficulty = 'medium') AS medium_done
          FROM quiz_answers qa
          JOIN quiz_attempts a ON a.id = qa.attempt_id
          JOIN questions q ON q.id = qa.question_id
          JOIN quizzes qu ON qu.id = a.quiz_id
          WHERE a.user_id = $1
            AND a.status IN ('submitted', 'evaluated')
            AND q.topic_id IS NOT NULL
          GROUP BY q.topic_id;
        `
      : `
          SELECT
            q.topic_id,
            COUNT(*) FILTER (WHERE q.weightage <= 10) AS easy_done,
            COUNT(*) FILTER (WHERE q.weightage > 10 AND q.weightage <= 20) AS medium_done
          FROM quiz_answers qa
          JOIN quiz_attempts a ON a.id = qa.attempt_id
          JOIN questions q ON q.id = qa.question_id
          WHERE a.user_id = $1
            AND a.status IN ('submitted', 'evaluated')
            AND q.topic_id IS NOT NULL
          GROUP BY q.topic_id;
        `;

    const progressRes = await pool.query(progressByTopicQuery, [resolvedUserId]);
    const difficultyMap = {};
    progressRes.rows.forEach((row) => {
      const easyDone = Number(row.easy_done || 0);
      const mediumDone = Number(row.medium_done || 0);
      if (easyDone < 2) {
        difficultyMap[row.topic_id] = "easy";
      } else if (mediumDone < 2) {
        difficultyMap[row.topic_id] = "medium";
      } else {
        difficultyMap[row.topic_id] = "hard";
      }
    });

    const recommendations = [];

    const useNewAcademicModel = process.env.USE_NEW_ACADEMIC_MODEL === 'true';
    const subjectSelect = useNewAcademicModel 
      ? `COALESCE((SELECT s.name FROM course_offerings co JOIN subjects s ON s.id = co.subject_id WHERE co.id = qu.course_offering_id), 'General')`
      : `COALESCE(qu.subject, 'General')`;

    for (const weak of weakTopics) {
      const targetDifficulty = difficultyMap[weak.topicId] || "easy";

      const queryWithDifficulty = `
        SELECT *
        FROM (
          SELECT DISTINCT
            qu.id,
            qu.title,
            ${subjectSelect} AS subject,
            ${hasDifficultyColumn ? "COALESCE(qu.difficulty, 'medium')" : "$2::text"} AS difficulty
          FROM quizzes qu
          JOIN quiz_questions_map qqm ON qqm.quiz_id = qu.id
          JOIN questions q ON q.id = qqm.question_id
          WHERE q.topic_id = $1
            AND qu.status IN ('active', 'completed')
            ${hasDifficultyColumn ? "AND COALESCE(qu.difficulty, 'medium') = $2" : ""}
            AND (
              NOT EXISTS (
                SELECT 1
                FROM quiz_attempts a
                WHERE a.quiz_id = qu.id
                  AND a.user_id = $3
                  AND a.status IN ('submitted', 'evaluated')
              )
              OR EXISTS (
                SELECT 1
                FROM quiz_attempts a
                WHERE a.quiz_id = qu.id
                  AND a.user_id = $3
                  AND a.status IN ('submitted', 'evaluated')
                  AND (
                    CASE
                      WHEN COALESCE(a.total_marks, qu.total_marks, 0) > 0
                      THEN a.score * 100.0 / COALESCE(a.total_marks, qu.total_marks, 1)
                      ELSE 0
                    END
                  ) < 70
              )
            )
        ) ranked
        ORDER BY RANDOM()
        LIMIT 3;
      `;

      let quizRes = await pool.query(queryWithDifficulty, [weak.topicId, targetDifficulty, resolvedUserId]);

      if (quizRes.rows.length === 0 && hasDifficultyColumn) {
        const fallbackQuery = `
          SELECT *
          FROM (
            SELECT DISTINCT
              qu.id,
              qu.title,
              ${subjectSelect} AS subject,
              COALESCE(qu.difficulty, 'medium') AS difficulty
            FROM quizzes qu
            JOIN quiz_questions_map qqm ON qqm.quiz_id = qu.id
            JOIN questions q ON q.id = qqm.question_id
            WHERE q.topic_id = $1
              AND qu.status IN ('active', 'completed')
              AND (
                NOT EXISTS (
                  SELECT 1
                  FROM quiz_attempts a
                  WHERE a.quiz_id = qu.id
                    AND a.user_id = $2
                    AND a.status IN ('submitted', 'evaluated')
                )
                OR EXISTS (
                  SELECT 1
                  FROM quiz_attempts a
                  WHERE a.quiz_id = qu.id
                    AND a.user_id = $2
                    AND a.status IN ('submitted', 'evaluated')
                    AND (
                      CASE
                        WHEN COALESCE(a.total_marks, qu.total_marks, 0) > 0
                        THEN a.score * 100.0 / COALESCE(a.total_marks, qu.total_marks, 1)
                        ELSE 0
                      END
                    ) < 70
                )
              )
          ) ranked
          ORDER BY RANDOM()
          LIMIT 3;
        `;
        quizRes = await pool.query(fallbackQuery, [weak.topicId, resolvedUserId]);
      }

      let topicQuizzes = quizRes.rows;

      if (topicQuizzes.length === 0) {
        const broadFallbackQuery = `
          SELECT *
          FROM (
            SELECT DISTINCT
              qu.id,
              qu.title,
              ${subjectSelect} AS subject,
              ${hasDifficultyColumn ? "COALESCE(qu.difficulty, 'medium')" : "$2::text"} AS difficulty
            FROM quizzes qu
            JOIN quiz_questions_map qqm ON qqm.quiz_id = qu.id
            JOIN questions q ON q.id = qqm.question_id
            WHERE q.topic_id = $1
              AND (
                NOT EXISTS (
                  SELECT 1
                  FROM quiz_attempts a
                  WHERE a.quiz_id = qu.id
                    AND a.user_id = $3
                    AND a.status IN ('submitted', 'evaluated')
                )
                OR EXISTS (
                  SELECT 1
                  FROM quiz_attempts a
                  WHERE a.quiz_id = qu.id
                    AND a.user_id = $3
                    AND a.status IN ('submitted', 'evaluated')
                    AND (
                      CASE
                        WHEN COALESCE(a.total_marks, qu.total_marks, 0) > 0
                        THEN a.score * 100.0 / COALESCE(a.total_marks, qu.total_marks, 1)
                        ELSE 0
                      END
                    ) < 70
                )
              )
          ) ranked
          ORDER BY RANDOM()
          LIMIT 3;
        `;
        const broadFallbackRes = await pool.query(broadFallbackQuery, [weak.topicId, targetDifficulty, resolvedUserId]);
        topicQuizzes = broadFallbackRes.rows;
      }

      recommendations.push({
        topicId: weak.topicId,
        topic: weak.topic,
        accuracy: weak.accuracy,
        difficulty: targetDifficulty,
        quizzes: topicQuizzes
      });
    }

    return res.json({
      weakTopics,
      recommendations
    });
  } catch (err) {
    console.error("Recommendations v2 error:", err);
    return res.status(500).json({ error: "Failed smart recommendations" });
  }
};

module.exports = {
  getQuizAnalytics,
  exportQuizAnalyticsCsv,
  getStudentComprehensiveAnalytics,
  getStudentRecommendations,
  getStudentRecommendationsV2
};
