import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import api from "../../utils/api";
import CodeEditor from "../../components/CodeEditor";
import { buildStarterCode } from "../../utils/codeStarter";

const MISTAKE_KEY = "practice-mistakes-v1";
const MASTERED_KEY = "practice-mastered-v1";
const TIMER_PREFIX = "practice-timer-";

const updatePracticeMistakes = (mistakes) => {
  let existing = { subjects: {}, topics: {}, quizzes: {}, updatedAt: null };
  try {
    const raw = localStorage.getItem(MISTAKE_KEY);
    if (raw) existing = { ...existing, ...JSON.parse(raw) };
  } catch { /* ignore */ }

  mistakes.forEach((m) => {
    if (m.subject) existing.subjects[m.subject] = Number(existing.subjects[m.subject] || 0) + 1;
    if (m.topic) existing.topics[m.topic] = Number(existing.topics[m.topic] || 0) + 1;
    if (m.quizId) existing.quizzes[m.quizId] = Number(existing.quizzes[m.quizId] || 0) + 1;
  });

  existing.updatedAt = new Date().toISOString();
  localStorage.setItem(MISTAKE_KEY, JSON.stringify(existing));
};

const markQuizMastered = (quizId) => {
  if (!quizId) return;
  let mastered = {};
  try { const raw = localStorage.getItem(MASTERED_KEY); if (raw) mastered = JSON.parse(raw) || {}; } catch { mastered = {}; }
  mastered[quizId] = { masteredAt: new Date().toISOString() };
  localStorage.setItem(MASTERED_KEY, JSON.stringify(mastered));
};

const formatLanguageLabel = (language) => {
  const normalized = String(language || "javascript").trim().toLowerCase();
  if (normalized === "js") return "JavaScript";
  if (normalized === "cpp") return "C++";
  if (normalized === "py") return "Python";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const formatTimerDisplay = (seconds) => {
  if (seconds <= 0) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const PracticeQuiz = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [runResults, setRunResults] = useState({});
  const [runLoading, setRunLoading] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const autoSubmittedRef = useRef(false);

  // Load quiz
  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const res = await api.get(`/api/student/practice/quiz/${id}`);
        setPayload(res.data);

        // Timer: use localStorage to persist start time across refreshes
        const durationMin = res.data?.quiz?.duration || 60;
        const timerKey = `${TIMER_PREFIX}${id}`;
        let startTime = Number(localStorage.getItem(timerKey));

        if (!startTime || startTime <= 0) {
          startTime = Date.now();
          localStorage.setItem(timerKey, String(startTime));
        }

        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const totalSec = durationMin * 60;
        setTimeLeft(Math.max(0, totalSec - elapsed));
      } catch (err) {
        setError(err?.response?.data?.error || "Failed to load practice quiz");
      } finally {
        setLoading(false);
      }
    };
    fetchQuiz();
  }, [id]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft === null || submitted || submitting) return;

    if (timeLeft <= 0 && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      handleSubmitPractice(true);
      return;
    }

    const interval = setInterval(() => {
      const timerKey = `${TIMER_PREFIX}${id}`;
      const startTime = Number(localStorage.getItem(timerKey));
      const durationMin = payload?.quiz?.duration || 60;
      const totalSec = durationMin * 60;
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, totalSec - elapsed);
      setTimeLeft(remaining);

      if (remaining <= 0 && !autoSubmittedRef.current) {
        autoSubmittedRef.current = true;
        clearInterval(interval);
        handleSubmitPractice(true);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft, submitted, submitting, payload]);

  const questions = payload?.questions || [];
  const quiz = payload?.quiz;
  const currentQ = questions[currentIndex];
  const starterCode = currentQ?.type === "code" ? buildStarterCode(currentQ.language, currentQ.functionName) : "";
  const isLastQuestion = currentIndex === questions.length - 1;

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const unansweredCount = Math.max(questions.length - answeredCount, 0);

  const setMcqAnswer = (questionId, optionId) => {
    setAnswers((prev) => ({ ...prev, [questionId]: { ...(prev[questionId] || {}), optionId } }));
  };

  const setCodeAnswer = (questionId, code) => {
    setAnswers((prev) => ({ ...prev, [questionId]: { ...(prev[questionId] || {}), code } }));
  };

  const handleRunCode = async () => {
    if (!currentQ || currentQ.type !== "code") return;
    const code = answers[currentQ.id]?.code ?? starterCode;
    if (!code.trim()) {
      setRunResults((prev) => ({ ...prev, [currentQ.id]: { status: { description: "No Code" }, stdout: "", stderr: "Write some code before running." } }));
      return;
    }
    try {
      setRunLoading(true);
      const res = await api.post(`/api/student/quiz/${quiz?.id}/run`, { questionId: currentQ.id, code, language: currentQ.language || "javascript" });
      setRunResults((prev) => ({ ...prev, [currentQ.id]: res.data }));
    } catch (err) {
      setRunResults((prev) => ({ ...prev, [currentQ.id]: { status: { description: "Run Failed" }, stdout: "", stderr: err?.response?.data?.error || "Unable to run code right now." } }));
    } finally { setRunLoading(false); }
  };

  const handleSubmitPractice = useCallback(async (isAutoSubmit = false) => {
    if (submitting || submitted) return;
    setSubmitting(true);

    try {
      // Build answers array for the real submit API
      const apiAnswers = questions.map((q) => {
        const response = answers[q.id] || {};
        const options = Array.isArray(q.options) ? q.options : [];

        if (q.type === "mcq" || (q.type !== "code" && options.length > 0)) {
          const selected = options.find((o) => o.id === response.optionId);
          return {
            questionId: q.id,
            selectedOption: selected?.option_text || "",
            selectedOptionId: response.optionId || null,
            submittedCode: null
          };
        } else {
          return {
            questionId: q.id,
            selectedOption: null,
            selectedOptionId: null,
            submittedCode: response.code || ""
          };
        }
      });

      // Submit via real API (persists to quiz_attempts)
      const submitRes = await api.post(`/api/student/quiz/${quiz?.id}/attempt`, { answers: apiAnswers });
      const serverScore = submitRes.data?.score ?? 0;

      // Build local review for instant feedback
      const review = [];
      const mistakes = [];

      for (const q of questions) {
        const response = answers[q.id] || {};
        const options = Array.isArray(q.options) ? q.options : [];

        if (q.type === "mcq" || (q.type !== "code" && options.length > 0)) {
          const selected = options.find((o) => o.id === response.optionId);
          const correct = options.find((o) => o.is_correct);
          const isCorrect = Boolean(selected && correct && selected.id === correct.id);
          review.push({ questionId: q.id, title: q.title, type: "mcq", subject: quiz?.subject || "General", topic: q.topic || "General", isCorrect, selectedText: selected?.option_text || "Not answered", correctText: correct?.option_text || "N/A" });
          if (!isCorrect) mistakes.push({ quizId: quiz?.id, subject: quiz?.subject || "General", topic: q.topic || "General" });
        } else {
          const submittedCode = response.code || "";
          review.push({ questionId: q.id, title: q.title, type: "code", subject: quiz?.subject || "General", topic: q.topic || "General", isCorrect: false, submittedCode, codeFeedback: { feedback: "Submitted for evaluation.", logicScore: 0 } });
        }
      }

      const total = review.length;
      const correct = review.filter((r) => r.isCorrect).length;
      updatePracticeMistakes(mistakes);

      if (total > 0 && correct === total) markQuizMastered(quiz?.id);

      // Clear timer from localStorage
      localStorage.removeItem(`${TIMER_PREFIX}${id}`);

      setResult({
        total,
        correct,
        serverScore,
        totalMarks: quiz?.total_marks || 0,
        accuracy: total > 0 ? ((correct * 100) / total).toFixed(1) : "0.0",
        review,
        mistakes,
        autoSubmitted: isAutoSubmit
      });
      setSubmitted(true);
    } catch (err) {
      console.error("Practice submit error:", err);
      // If server rejects, still show local results
      setError(err?.response?.data?.error || "Submit failed. Please try again.");
      setSubmitting(false);
    }
  }, [submitting, submitted, questions, answers, quiz, id]);

  if (loading) return <div className="p-4 sm:p-6 text-white flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  if (error && !submitted) return <div className="p-4 sm:p-6 text-red-400">{error}</div>;
  if (!payload) return <div className="p-4 sm:p-6 text-gray-300">No practice quiz data.</div>;

  // Timer urgency classes
  const timerUrgent = timeLeft !== null && timeLeft <= 60;
  const timerWarning = timeLeft !== null && timeLeft <= 300 && !timerUrgent;

  // --- SUBMITTED RESULT VIEW ---
  if (submitted && result) {
    return (
      <div className="p-4 sm:p-6 text-white space-y-6 max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-bold">Practice Summary</h1>
          <Link to="/student/practice" className="text-indigo-300 hover:text-indigo-200 text-sm">← Back to Practice</Link>
        </div>

        {result.autoSubmitted && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200 flex items-center gap-2">
            <AlertTriangle size={18} className="shrink-0" />
            <span>Time's up! Your quiz was auto-submitted.</span>
          </div>
        )}

        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 sm:p-5">
          <p className="text-lg font-semibold">{quiz?.title}</p>
          <div className="flex flex-wrap items-center gap-4 mt-2">
            <p className="text-sm text-gray-400">
              Score: <span className="text-white font-bold">{result.serverScore}/{result.totalMarks}</span>
            </p>
            <p className="text-sm text-gray-400">
              MCQ Accuracy: <span className="text-white font-semibold">{result.accuracy}%</span> ({result.correct}/{result.total})
            </p>
          </div>
          <p className="text-xs text-gray-500 mt-2">This attempt has been saved. You can re-attempt this quiz from the Practice page.</p>
        </div>

        <div className="space-y-4">
          {result.review.map((r, idx) => (
            <div key={r.questionId} className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-sm sm:text-base">Q{idx + 1}. {r.title}</p>
                {r.isCorrect ? (
                  <span className="text-emerald-300 text-xs bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/30 inline-flex items-center gap-1 shrink-0"><CheckCircle className="h-3.5 w-3.5" /> Correct</span>
                ) : (
                  <span className="text-red-300 text-xs bg-red-500/10 px-2 py-1 rounded border border-red-500/30 inline-flex items-center gap-1 shrink-0"><XCircle className="h-3.5 w-3.5" /> Incorrect</span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">Topic: {r.topic}</p>
              {r.type === "mcq" ? (
                <div className="mt-3 text-sm space-y-1">
                  <p>Your answer: <span className="text-indigo-300">{r.selectedText}</span></p>
                  <p>Correct answer: <span className="text-emerald-300">{r.correctText}</span></p>
                </div>
              ) : (
                <div className="mt-3 text-sm space-y-2">
                  <p className="text-gray-300">AI Feedback: {r.codeFeedback?.feedback}</p>
                  {r.codeFeedback?.suggestions ? <p className="text-gray-400">Suggestion: {r.codeFeedback.suggestions}</p> : null}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link to="/student/practice" className="flex-1">
            <button className="w-full py-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-semibold transition-colors">← Back to Practice</button>
          </Link>
          <Link to={`/student/practice/quiz/${id}`} onClick={() => { localStorage.removeItem(`${TIMER_PREFIX}${id}`); }} className="flex-1">
            <button className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-semibold transition-colors">Re-attempt This Quiz</button>
          </Link>
        </div>
      </div>
    );
  }

  // --- ACTIVE QUIZ VIEW ---
  return (
    <div className="p-4 sm:p-6 text-white space-y-4 sm:space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold truncate">Practice: {quiz?.title}</h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">Time-limited. Your attempt is saved when you finish.</p>
        </div>
        <Link to="/student/practice" className="inline-flex items-center text-sm text-indigo-300 hover:text-indigo-200 shrink-0">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Link>
      </div>

      {/* Timer + Progress Bar */}
      <div className={`rounded-xl border p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
        timerUrgent ? "border-red-500/50 bg-red-500/10" : timerWarning ? "border-amber-500/40 bg-amber-500/10" : "border-gray-800 bg-gray-900"
      }`}>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <span className="text-sm">Answered: <span className="font-bold">{answeredCount}/{questions.length}</span></span>
          <span className="text-sm text-gray-400">Subject: {quiz?.subject || "General"}</span>
        </div>
        {timeLeft !== null && (
          <div className={`flex items-center gap-2 text-sm font-mono font-bold ${
            timerUrgent ? "text-red-400 animate-pulse" : timerWarning ? "text-amber-300" : "text-blue-300"
          }`}>
            <Clock size={16} />
            <span>{formatTimerDisplay(timeLeft)}</span>
            {timerUrgent && <span className="text-xs font-sans font-normal text-red-300">Hurry up!</span>}
          </div>
        )}
      </div>

      {/* Question navigation pills (mobile scrollable) */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
        {questions.map((q, idx) => {
          const isAnswered = !!answers[q.id];
          const isCurrent = idx === currentIndex;
          return (
            <button
              key={q.id}
              onClick={() => setCurrentIndex(idx)}
              className={`shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-lg text-xs font-bold transition-all ${
                isCurrent
                  ? "bg-primary text-white shadow-lg shadow-primary/25"
                  : isAnswered
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-white/5 text-gray-400 border border-gray-800 hover:bg-white/10"
              }`}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>

      {/* Current Question */}
      {currentQ && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 sm:p-5 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-500">Question {currentIndex + 1} of {questions.length}</p>
            <p className="text-base sm:text-lg mt-1">{currentQ.title}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-400">
              <span>Topic: {currentQ.topic || "General"}</span>
              {currentQ.type === "code" && (
                <>
                  <span className="px-2 py-0.5 rounded border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 uppercase tracking-wide">
                    {formatLanguageLabel(currentQ.language)}
                  </span>
                  <span className="px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 uppercase tracking-wide">
                    fn: {currentQ.functionName || "solution"}
                  </span>
                </>
              )}
            </div>
          </div>

          {currentQ.type === "code" ? (
            <div className="space-y-3">
              <div className="border border-gray-800 rounded-lg overflow-hidden">
                <CodeEditor
                  language={currentQ.language || "javascript"}
                  code={answers[currentQ.id]?.code ?? starterCode}
                  setCode={(val) => setCodeAnswer(currentQ.id, val || "")}
                  template={starterCode}
                  width="100%"
                  height="360px"
                />
              </div>
              {runResults[currentQ.id] && (
                <div className="rounded-lg border border-gray-800 bg-gray-950 p-3 text-sm space-y-2">
                  <p className="text-gray-300">Status: <span className="text-indigo-300">{runResults[currentQ.id]?.status?.description || "Unknown"}</span></p>
                  {runResults[currentQ.id]?.stdout && <p className="text-emerald-300 whitespace-pre-wrap">Output: {runResults[currentQ.id].stdout}</p>}
                  {runResults[currentQ.id]?.stderr && <p className="text-red-300 whitespace-pre-wrap">Error: {runResults[currentQ.id].stderr}</p>}
                  {runResults[currentQ.id]?.compile_output && <p className="text-red-300 whitespace-pre-wrap">Compile: {runResults[currentQ.id].compile_output}</p>}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {(currentQ.options || []).map((opt, idx) => {
                const selected = answers[currentQ.id]?.optionId === opt.id;
                return (
                  <button
                    key={opt.id || idx}
                    onClick={() => setMcqAnswer(currentQ.id, opt.id)}
                    className={`w-full text-left rounded-lg border p-3 transition-colors text-sm ${selected ? "border-indigo-500 bg-indigo-500/10" : "border-gray-800 bg-gray-950 hover:bg-gray-900"}`}
                  >
                    <span className="text-xs text-gray-400 mr-2">{String.fromCharCode(65 + idx)}.</span>
                    {opt.option_text}
                  </button>
                );
              })}
            </div>
          )}

          {/* Navigation */}
          <div className="flex flex-col sm:flex-row justify-between gap-3 pt-2">
            <button
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
              className="px-4 py-2.5 rounded-lg bg-gray-800 text-sm disabled:opacity-50 transition-colors hover:bg-gray-700 order-2 sm:order-1"
            >
              Previous
            </button>
            <div className="flex items-center gap-2 order-1 sm:order-2">
              {currentQ.type === "code" && (
                <button onClick={handleRunCode} disabled={runLoading} className="flex-1 sm:flex-initial px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-semibold disabled:opacity-60 transition-colors">
                  {runLoading ? "Running..." : "Run Code"}
                </button>
              )}
              {!isLastQuestion ? (
                <button onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))} className="flex-1 sm:flex-initial px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-sm font-semibold transition-colors">
                  Next
                </button>
              ) : (
                <button
                  onClick={() => setShowFinishConfirm(true)}
                  disabled={submitting}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-sm font-semibold transition-colors disabled:opacity-60"
                >
                  {submitting ? "Submitting..." : "Finish Practice"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Finish Confirm Modal */}
      {showFinishConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-5 space-y-4">
            <h2 className="text-lg font-semibold">Finish Practice?</h2>
            <p className="text-sm text-gray-300">
              You have answered {answeredCount}/{questions.length} questions.
              {unansweredCount > 0 ? ` ${unansweredCount} question(s) are still unanswered.` : ""}
            </p>
            {timeLeft !== null && (
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <Clock size={14} /> Time remaining: {formatTimerDisplay(timeLeft)}
              </p>
            )}
            <p className="text-xs text-gray-500">Your attempt will be saved and you can re-attempt later.</p>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowFinishConfirm(false)} className="px-4 py-2 rounded bg-gray-800 hover:bg-gray-700 text-sm transition-colors">
                Keep Going
              </button>
              <button
                onClick={() => { setShowFinishConfirm(false); handleSubmitPractice(); }}
                disabled={submitting}
                className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-sm font-semibold transition-colors disabled:opacity-60"
              >
                {submitting ? "Submitting..." : "Finish & Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PracticeQuiz;
