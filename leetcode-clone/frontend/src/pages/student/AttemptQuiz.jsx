import { useState, useEffect, useContext, useRef } from "react";
import { Play, CheckCircle, XCircle, X } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/authStore";
import CodeEditor from "../../components/CodeEditor";
import api, { runCode } from "../../utils/api";
import { buildStarterCode } from "../../utils/codeStarter";

const AttemptQuiz = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { token } = useContext(AuthContext);

    const [quiz, setQuiz] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Quiz State
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState({});
    const [markedForReview, setMarkedForReview] = useState(new Set());
    const [visited, setVisited] = useState(new Set([0]));
    const [timeLeft, setTimeLeft] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    
    // Run Code State
    const [runResult, setRunResult] = useState(null);
    const [runLoading, setRunLoading] = useState(false);

    // Secure Exam Mode State
    const [secureModeStarted, setSecureModeStarted] = useState(false);
    const [violationCount, setViolationCount] = useState(0);
    const [violationLog, setViolationLog] = useState([]);
    const [behaviorScore, setBehaviorScore] = useState(0);
    const [attemptCompleted, setAttemptCompleted] = useState(false);
    const [previewImage, setPreviewImage] = useState("");
    const autoSubmittedRef = useRef(false);
    const integrityActiveRef = useRef(false);

    // UI State
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const postIntegrityEvent = async (event, details = "") => {
        if (!integrityActiveRef.current) return;
        try {
            const res = await api.post(`/api/student/quiz/${id}/integrity-event`, {
                event,
                timestamp: Date.now(),
                meta: { details }
            });

            if (res?.data?.score !== undefined) {
                setBehaviorScore(Number(res.data.score));
            }
        } catch {
            // silent; exam flow must continue even if analytics event fails
        }
    };

    const flagViolation = async (event, message) => {
        if (!integrityActiveRef.current) return;

        setViolationCount((v) => {
            const next = v + 1;
            if (next >= 3 && !autoSubmittedRef.current) {
                autoSubmittedRef.current = true;
                handleSubmit(true);
            }
            return next;
        });
        setViolationLog((prev) => [...prev.slice(-4), { event, message, at: new Date().toLocaleTimeString() }]);
        await postIntegrityEvent(event, message);
    };

    const startSecureMode = async () => {
        setSecureModeStarted(true);
        integrityActiveRef.current = true;
        try {
            if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
            }
        } catch {
            await flagViolation("fullscreen_exit", "Fullscreen not granted at start");
        }
    };

    const isPracticeMode = window.location.pathname.includes("/practice/");

    // Auto-start secure mode bypass for practice mode
    useEffect(() => {
        if (isPracticeMode && !secureModeStarted) {
            setSecureModeStarted(true);
        }
    }, [isPracticeMode, secureModeStarted]);

    // Fetch Quiz
    useEffect(() => {
        const fetchQuiz = async () => {
            try {
                const endpoint = isPracticeMode 
                    ? `/api/student/practice/quiz/${id}` 
                    : `/api/student/quiz/${id}`;
                const response = await api.get(endpoint);
                const data = response.data;
                const rawQuiz = data.quiz || data;

                const normalizedQuestions = (data.questions || rawQuiz.questions || []).map(q => ({
                    ...q,
                    mcq_options: q.options || q.mcq_options || []
                }));

                const normalizedQuiz = {
                    ...rawQuiz,
                    questions: normalizedQuestions
                };

                setQuiz(normalizedQuiz);

                if (isPracticeMode) {
                    const timerKey = `practice-timer-${id}`;
                    const durationSeconds = (rawQuiz.duration || 60) * 60;
                    let storedStartTime = localStorage.getItem(timerKey);
                    
                    if (!storedStartTime) {
                        storedStartTime = Date.now().toString();
                        localStorage.setItem(timerKey, storedStartTime);
                    }

                    const elapsed = Math.floor((Date.now() - Number(storedStartTime)) / 1000);
                    const remaining = Math.max(0, durationSeconds - elapsed);
                    setTimeLeft(remaining);
                } else {
                    const startTime = rawQuiz.scheduled_at ? new Date(rawQuiz.scheduled_at).getTime() : new Date(rawQuiz.created_at).getTime();
                    const durationMs = (rawQuiz.duration || 60) * 60 * 1000;
                    const endTime = startTime + durationMs;
                    const now = Date.now();
                    const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
                    setTimeLeft(remaining);
                }

            } catch (err) {
                setError(err.response?.data?.error || "Error fetching quiz");
            } finally {
                setLoading(false);
            }
        };
        if (token && id) fetchQuiz();
    }, [token, id, isPracticeMode]);

    // Timer Logic - Sync with Server Time or Practice Persistent Timer
    useEffect(() => {
        if (!quiz) return;

        const intervalId = setInterval(() => {
            if (isPracticeMode) {
                const timerKey = `practice-timer-${id}`;
                const durationSeconds = (quiz.duration || 60) * 60;
                const storedStartTime = localStorage.getItem(timerKey) || Date.now().toString();
                const elapsed = Math.floor((Date.now() - Number(storedStartTime)) / 1000);
                const remaining = Math.max(0, durationSeconds - elapsed);

                setTimeLeft(remaining);

                if (remaining <= 0 && !submitting) {
                    clearInterval(intervalId);
                    handleSubmit(true);
                }
            } else {
                const startTime = quiz.scheduled_at ? new Date(quiz.scheduled_at).getTime() : new Date(quiz.created_at).getTime();
                const durationMs = (quiz.duration || 60) * 60 * 1000;
                const endTime = startTime + durationMs;
                const now = Date.now();
                const remaining = Math.max(0, Math.floor((endTime - now) / 1000));

                setTimeLeft(remaining);

                if (remaining <= 0 && !submitting) {
                    clearInterval(intervalId);
                    handleSubmit(true); // Auto submit
                }
            }
        }, 1000);

        return () => clearInterval(intervalId);
    }, [quiz, submitting, isPracticeMode, id]);

    // Secure exam behavior tracking (real quiz only)
    useEffect(() => {
        if (!quiz || !secureModeStarted || submitting || attemptCompleted) return;

        integrityActiveRef.current = true;

        const onVisibilityChange = () => {
            if (document.hidden) flagViolation("tab_switch", "Tab switched or minimized");
        };

        const onBlur = () => {
            flagViolation("window_blur", "Window lost focus");
        };

        const onFullscreenChange = () => {
            if (!document.fullscreenElement) {
                flagViolation("fullscreen_exit", "Exited fullscreen");
            }
        };

        const onContext = (e) => {
            e.preventDefault();
            flagViolation("copy_paste", "Context menu blocked");
        };

        const onCopy = (e) => {
            e.preventDefault();
            flagViolation("copy_paste", "Copy blocked");
        };

        const onPaste = (e) => {
            e.preventDefault();
            flagViolation("copy_paste", "Paste blocked");
        };

        const onKeydown = (e) => {
            const key = (e.key || "").toLowerCase();
            const blockedDevtools =
                key === "f12" ||
                (e.ctrlKey && e.shiftKey && (key === "i" || key === "j" || key === "c")) ||
                (e.ctrlKey && key === "u");

            const blockedScreenshot = 
                key === "printscreen" ||
                (e.metaKey && e.shiftKey && (key === "s" || key === "3" || key === "4" || key === "5"));

            if (blockedDevtools) {
                e.preventDefault();
                flagViolation("devtools_open", "DevTools shortcut blocked");
            } else if (blockedScreenshot) {
                e.preventDefault();
                flagViolation("screenshot_attempt", "Screenshot shortcut detected");
                // Optional: rapidly hide the body for a moment
                document.body.style.display = "none";
                setTimeout(() => document.body.style.display = "", 500);
            }
        };

        const fullscreenLoop = setInterval(async () => {
            if (!document.fullscreenElement && !submitting) {
                try {
                    await document.documentElement.requestFullscreen();
                } catch {
                    // no-op; violation already tracked via fullscreenchange
                }
            }
        }, 3000);

        document.addEventListener("visibilitychange", onVisibilityChange);
        window.addEventListener("blur", onBlur);
        document.addEventListener("fullscreenchange", onFullscreenChange);
        document.addEventListener("contextmenu", onContext);
        document.addEventListener("copy", onCopy);
        document.addEventListener("paste", onPaste);
        document.addEventListener("keydown", onKeydown);

        return () => {
            integrityActiveRef.current = false;
            clearInterval(fullscreenLoop);
            document.removeEventListener("visibilitychange", onVisibilityChange);
            window.removeEventListener("blur", onBlur);
            document.removeEventListener("fullscreenchange", onFullscreenChange);
            document.removeEventListener("contextmenu", onContext);
            document.removeEventListener("copy", onCopy);
            document.removeEventListener("paste", onPaste);
            document.removeEventListener("keydown", onKeydown);
        };
    }, [quiz, secureModeStarted, submitting, attemptCompleted]);

    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handleQuestionChange = (index) => {
        setCurrentQuestionIndex(index);
        setRunResult(null); // Clear console
        setVisited((prev) => new Set(prev).add(index));
        // On mobile, close sidebar after selection
        if (window.innerWidth < 768) setIsSidebarOpen(false);
    };

    const handleNext = () => {
        if (currentQuestionIndex < quiz.questions.length - 1) {
            handleQuestionChange(currentQuestionIndex + 1);
        }
    };

    const handlePrev = () => {
        if (currentQuestionIndex > 0) {
            handleQuestionChange(currentQuestionIndex - 1);
        }
    };

    const handleSaveAndNext = () => handleNext();

    const handleMarkForReview = () => {
        const qId = quiz.questions[currentQuestionIndex].id;
        setMarkedForReview((prev) => {
            const next = new Set(prev);
            if (next.has(qId)) next.delete(qId);
            else next.add(qId);
            return next;
        });
        handleNext();
    };

    const handleClearResponse = () => {
        const qId = quiz.questions[currentQuestionIndex].id;
        setAnswers((prev) => {
            const next = { ...prev };
            delete next[qId];
            return next;
        });
    };

    const handleOptionSelect = (qId, option) => {
        setAnswers((prev) => {
            const currentSelectedId = prev[qId]?.selectedOptionId;
            // Toggle Logic: If clicking the same option, deselect it (remove from answers)
            if (String(currentSelectedId) === String(option.id)) {
                const next = { ...prev };
                delete next[qId];
                return next;
            }
            // Otherwise select the new option
            return {
                ...prev,
                [qId]: {
                    ...prev[qId],
                    selectedOptionId: option.id,
                    selectedOption: option.option_text,
                    type: 'mcq'
                }
            };
        });
    };

    const handleCodeChange = (qId, code) => {
        setAnswers((prev) => ({
            ...prev,
            [qId]: { ...prev[qId], submittedCode: code, type: 'code' }
        }));
    };

    const handleSubmit = async (auto = false) => {
        if (submitting || attemptCompleted) return;
        if (!auto && !window.confirm("Are you sure you want to submit?")) return;

        integrityActiveRef.current = false;
        setSubmitting(true);
        try {
            const formattedAnswers = Object.entries(answers).map(([qId, val]) => ({
                questionId: qId,
                selectedOptionId: val.selectedOptionId,
                selectedOption: val.selectedOption,
                submittedCode: val.submittedCode
            }));

            const response = await api.post(`/api/student/quiz/${id}/attempt`, { answers: formattedAnswers });
            const data = response.data;
            setAttemptCompleted(true);

            if (isPracticeMode) {
                localStorage.removeItem(`practice-timer-${id}`);
            }

            if (!auto) alert(`Quiz Submitted! Score: ${data.attemptScore ?? data.score ?? 'Evaluated'}`);
            navigate(isPracticeMode ? "/student/practice" : "/");

        } catch (err) {
            console.error(err);
            const errMsg = err.response?.data?.error || "Error submitting quiz";
            if (!auto) alert("Submission Failed: " + errMsg);
        } finally {
            setSubmitting(false);
        }
    };

    const handleRunCode = async () => {
        const qId = quiz.questions[currentQuestionIndex].id;
        const language = quiz.questions[currentQuestionIndex].language || "javascript";
        const currentCode = answers[qId]?.submittedCode ?? starterCode;

        if (!currentCode) {
            alert("Please write some code first!");
            return;
        }

        setRunLoading(true);
        setRunResult(null);

        try {
            const res = await runCode(id, {
                questionId: qId,
                code: currentCode,
                language: language
            });
            setRunResult(res.data);
        } catch (err) {
            console.error(err);
            setRunResult({ status: { description: "Error" }, stderr: "Failed to execute code." });
        } finally {
            setRunLoading(false);
        }
    };

    const getStatusColor = (idx, qId) => {
        const isAnswered = !!answers[qId];
        const isMarked = markedForReview.has(qId);
        const isVisited = visited.has(idx);

        if (isMarked) return "bg-purple-600 text-white border-purple-400";
        if (isAnswered) return "bg-green-600 text-white border-green-400";
        if (isVisited && !isAnswered) return "bg-red-500 text-white border-red-400";
        return "bg-gray-700 text-gray-300 border-gray-600";
    };

    if (loading) return <div className="h-screen flex items-center justify-center text-white">Loading Quiz...</div>;
    if (error) return <div className="h-screen flex items-center justify-center text-red-500 font-bold text-xl">{error}</div>;

    const now = new Date();
    const startTime = quiz.scheduled_at ? new Date(quiz.scheduled_at) : new Date(quiz.created_at);
    // Add small buffer (e.g. 2s) to prevent immediate redirect if clocks are slightly off
    if (!isPracticeMode && now < startTime) return <div className="text-white text-center mt-20">Quiz not started yet.</div>;

    const currentQ = quiz.questions[currentQuestionIndex];
    const starterCode = currentQ?.type === 'code'
        ? buildStarterCode(currentQ.language || "javascript", currentQ.functionName)
        : "";

    return (
        <div className="flex flex-col h-screen bg-[#1e1e1e] text-gray-200 font-sans overflow-hidden">
            {!secureModeStarted && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="max-w-xl w-full rounded-xl border border-indigo-500/30 bg-[#111827] p-6">
                        <h2 className="text-xl font-bold text-white mb-2">Secure Exam Mode</h2>
                        <p className="text-sm text-gray-300 mb-4">
                            This attempt runs in protected mode: fullscreen required, tab switch detection,
                            copy/paste blocked, and integrity monitoring enabled.
                        </p>
                        <ul className="text-xs text-gray-400 space-y-1 mb-5">
                            <li>• 3 violations can auto-submit your exam.</li>
                            <li>• Stay on this tab and keep fullscreen enabled.</li>
                            <li>• All integrity events are logged for teacher review.</li>
                        </ul>
                        <button
                            onClick={startSecureMode}
                            className="w-full py-2.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                        >
                            Start Secure Exam
                        </button>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="h-16 bg-[#252526] border-b border-[#333] flex items-center justify-between px-4 md:px-6 shrink-0 z-20 relative">
                <div className="flex items-center gap-4">
                    {/* Mobile Hamburger to toggle Palette */}
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="md:hidden p-2 text-gray-400 hover:text-white border border-gray-700 rounded"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                    <div className="font-bold text-base md:text-xl text-blue-400 truncate max-w-37.5 md:max-w-none">{quiz.title}</div>
                </div>

                <div className="flex items-center gap-2 bg-black/30 px-3 py-1 md:px-4 md:py-2 rounded-lg border border-gray-700">
                    <span className="text-xs md:text-sm text-gray-400 font-semibold uppercase hidden md:inline">Time Left:</span>
                    <span className={`font-mono text-lg md:text-xl font-bold ${timeLeft < 300 ? 'text-red-500 animate-pulse' : 'text-green-400'}`}>
                        {formatTime(timeLeft)}
                    </span>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden md:block text-right">
                        <div className="text-xs text-gray-400">Integrity Score</div>
                        <div className={`text-sm font-bold ${behaviorScore >= 80 ? 'text-red-400' : behaviorScore >= 50 ? 'text-yellow-400' : 'text-green-400'}`}>{behaviorScore}/100</div>
                    </div>
                    <div className="hidden md:block text-right">
                        <div className="text-xs text-gray-400">Violations</div>
                        <div className={`text-sm font-bold ${violationCount >= 3 ? 'text-red-400' : 'text-yellow-300'}`}>{violationCount}</div>
                    </div>
                    <div className="text-right hidden md:block">
                        <div className="text-sm font-medium text-white">Candidate</div>
                        <div className="text-xs text-gray-400">Student ID: ****</div>
                    </div>
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm md:text-base">
                        S
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex flex-1 overflow-hidden relative">
                {/* Left: Question Area */}
                <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e] w-full">
                    {violationLog.length > 0 && (
                        <div className="mx-4 mt-3 rounded border border-yellow-700/40 bg-yellow-900/20 px-3 py-2 text-xs text-yellow-200">
                            Last integrity event: {violationLog[violationLog.length - 1].message} at {violationLog[violationLog.length - 1].at}
                        </div>
                    )}

                    {/* Header for Question */}
                    <div className="p-3 md:p-4 border-b border-[#333] flex justify-between items-center bg-[#252526]">
                        <div>
                            <h2 className="text-base md:text-lg font-bold text-white">Question {currentQuestionIndex + 1}</h2>
                            {quiz?.randomized && (
                                <p className="text-[11px] text-blue-300 mt-0.5">Questions are randomized for fairness</p>
                            )}
                        </div>
                        <div className="flex gap-4 text-xs md:text-sm font-medium">
                            <span className="text-green-400">+1.0 Marks</span>
                        </div>
                    </div>

                    {/* Scrollable Question Content */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
                        <div className="max-w-4xl mx-auto">
                            <p className="text-base md:text-lg mb-6 leading-relaxed text-gray-100 whitespace-pre-wrap">
                                {currentQ.title}
                            </p>
                            {currentQ.type === 'code' && (
                                <div className="mb-4 flex items-center gap-2 text-xs text-gray-400">
                                    <span className="px-2 py-0.5 rounded border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 uppercase tracking-wide">
                                        Language: {currentQ.language || "javascript"}
                                    </span>
                                    <span className="px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 uppercase tracking-wide">
                                        Function: {currentQ.functionName || "solution"}
                                    </span>
                                </div>
                            )}

                            {currentQ.image_url && (
                                <div className="mb-6">
                                    <img
                                        src={currentQ.image_url}
                                        alt="Reference"
                                        className="max-h-64 rounded-lg border border-gray-700 cursor-zoom-in"
                                        onClick={() => setPreviewImage(currentQ.image_url)}
                                    />
                                    <div className="mt-2 text-xs text-blue-300">Click image to view bigger</div>
                                </div>
                            )}

                            {currentQ.type === 'mcq' && (
                                <div className="space-y-3">
                                    {currentQ.mcq_options.map((opt) => (
                                        <div
                                            key={opt.id}
                                            onClick={() => handleOptionSelect(currentQ.id, opt)}
                                            className={`
                                                flex items-center p-3 md:p-4 rounded-lg cursor-pointer border-2 transition-all
                                                ${String(answers[currentQ.id]?.selectedOptionId) === String(opt.id)
                                                    ? 'border-blue-500 bg-blue-500/10'
                                                    : 'border-[#333] bg-[#2d2d2d] hover:bg-[#333] hover:border-gray-500'}
                                            `}
                                        >
                                            <div className={`
                                                w-5 h-5 min-w-5 rounded-full border mr-3 flex items-center justify-center
                                                ${String(answers[currentQ.id]?.selectedOptionId) === String(opt.id) ? 'border-blue-500' : 'border-gray-500'}
                                            `}>
                                                {String(answers[currentQ.id]?.selectedOptionId) === String(opt.id) && <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
                                            </div>
                                            <span className="text-sm md:text-base text-gray-200">{opt.option_text}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {currentQ.type === 'code' && (
                                <div className="border border-gray-700 rounded-lg overflow-hidden flex flex-col">
                                    <CodeEditor
                                        language={currentQ.language || "javascript"}
                                        code={answers[currentQ.id]?.submittedCode ?? starterCode}
                                        setCode={(val) => handleCodeChange(currentQ.id, val)}
                                        template={starterCode}
                                        width="100%"
                                        lockFirstLine={false}
                                    />
                                    {/* Console / Run Output */}
                                    <div className="border-t border-gray-700 bg-[#1e1e1e]">
                                        <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-gray-700">
                                            <span className="text-xs font-bold uppercase text-gray-400">Console</span>
                                            <button 
                                                onClick={handleRunCode} 
                                                disabled={runLoading}
                                                className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-2 transition-colors ${runLoading ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-600 text-green-400 border border-green-500/30'}`}
                                            >
                                                {runLoading ? (
                                                    <><span className="animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full"></span> Running...</>
                                                ) : (
                                                    <><Play className="w-4 h-4 mr-2 inline" /> Run Code</>
                                                )}
                                            </button>
                                        </div>
                                        
                                        {runResult && (
                                            <div className="p-4 text-sm font-mono max-h-40 overflow-y-auto">
                                                {runResult.status?.description === "Accepted" ? (
                                                    <div className="flex flex-col gap-2">
                                                        <div className="text-green-400 font-bold mb-1 flex items-center"><CheckCircle className="w-4 h-4 mr-2" /> Accepted</div>
                                                        <div><span className="text-gray-500">Input:</span> <code className="text-gray-300">{runResult.input || "-"}</code></div>
                                                        <div><span className="text-gray-500">Output:</span> <code className="text-white">{runResult.stdout?.trim() || "-"}</code></div>
                                                        <div><span className="text-gray-500">Expected:</span> <code className="text-gray-300">{runResult.expected || "-"}</code></div>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col gap-2">
                                                        <div className="text-red-400 font-bold mb-1 flex items-center"><XCircle className="w-4 h-4 mr-2" /> {runResult.status?.description || "Runtime Error"}</div>
                                                        {runResult.stderr ? (
                                                            <pre className="text-red-300 whitespace-pre-wrap bg-red-900/10 p-2 rounded border border-red-500/20">{runResult.stderr}</pre>
                                                        ) : (
                                                            <>
                                                                <div><span className="text-gray-500">Input:</span> <code className="text-gray-300">{runResult.input || "-"}</code></div>
                                                                <div><span className="text-gray-500">Output:</span> <code className="text-white">{runResult.stdout?.trim() || "-"}</code></div>
                                                                <div><span className="text-gray-500">Expected:</span> <code className="text-gray-300">{runResult.expected || "-"}</code></div>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {!runResult && !runLoading && (
                                            <div className="p-4 text-xs text-gray-600 italic">Run code to see output for the first test case.</div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Bottom Action Bar */}
                    <div className="p-3 md:p-4 border-t border-[#333] bg-[#252526] flex flex-col md:flex-row items-center justify-between gap-3 shrink-0">
                        <div className="flex gap-2 w-full md:w-auto">
                            <button
                                onClick={handleMarkForReview}
                                className="flex-1 md:flex-none px-3 py-2 rounded bg-purple-600/20 text-purple-400 border border-purple-600/50 hover:bg-purple-600/30 transition text-xs md:text-sm font-medium whitespace-nowrap"
                            >
                                Mark Review
                            </button>
                            <button
                                onClick={handleClearResponse}
                                className="flex-1 md:flex-none px-3 py-2 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition text-xs md:text-sm font-medium whitespace-nowrap"
                            >
                                Clear
                            </button>
                        </div>

                        <div className="flex gap-2 w-full md:w-auto">
                            <button
                                onClick={handlePrev}
                                disabled={currentQuestionIndex === 0}
                                className="flex-1 md:flex-none px-4 md:px-6 py-2 rounded bg-gray-700 text-white disabled:opacity-50 hover:bg-gray-600 transition text-sm font-medium"
                            >
                                Prev
                            </button>
                            <button
                                onClick={handleSaveAndNext}
                                className="flex-1 md:flex-none px-4 md:px-6 py-2 rounded bg-blue-600 text-white hover:bg-blue-500 transition text-sm font-bold shadow-lg"
                            >
                                {currentQuestionIndex === quiz.questions.length - 1 ? 'Save' : 'Next'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right: Palette Sidebar - Responsive Overlay */}
                <div className={`
                    fixed inset-y-0 right-0 w-80 bg-[#1e1e1e] border-l border-[#333] flex flex-col z-30 transform transition-transform duration-300 ease-in-out
                    ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}
                    md:relative md:translate-x-0 md:flex
                `}>
                    {/* Mobile Close Button */}
                    <div className="md:hidden absolute top-2 right-2">
                        <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-gray-400"><X className="w-5 h-5" /></button>
                    </div>

                    <div className="p-4 border-b border-[#333] bg-[#252526]">
                        <h3 className="font-bold text-white mb-2 pt-2 md:pt-0">Question Palette</h3>
                        <div className="grid grid-cols-2 gap-3 text-sm text-gray-400 font-medium">
                            <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-green-600"></span> Answered</div>
                            <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-red-500"></span> Not Answered</div>
                            <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-purple-600"></span> Review</div>
                            <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-gray-700"></span> Not Visited</div>
                            <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full border-2 border-blue-500"></span> Current</div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4">
                        <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Choose a Question</h4>
                        <div className="grid grid-cols-4 gap-3">
                            {quiz.questions.map((q, idx) => (
                                <button
                                    key={q.id}
                                    onClick={() => handleQuestionChange(idx)}
                                    className={`
                                        aspect-square flex items-center justify-center rounded-lg font-bold text-lg border-2 transition-all shadow-sm
                                        ${getStatusColor(idx, q.id)}
                                        ${currentQuestionIndex === idx ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-[#1e1e1e] border-blue-500' : ''}
                                    `}
                                >
                                    {idx + 1}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="p-4 border-t border-[#333] bg-[#252526]">
                        <button
                            onClick={() => handleSubmit(false)}
                            disabled={submitting}
                            className={`w-full py-3 rounded-lg font-bold text-white shadow-lg transition-transform active:scale-95 ${submitting ? 'bg-gray-600' : 'bg-green-600 hover:bg-green-500'}`}
                        >
                            {submitting ? 'Submitting...' : 'Submit Test'}
                        </button>
                    </div>
                </div>

                {/* Backdrop for mobile */}
                {isSidebarOpen && (
                    <div
                        className="fixed inset-0 bg-black/50 z-20 md:hidden"
                        onClick={() => setIsSidebarOpen(false)}
                    ></div>
                )}

                {previewImage && (
                    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
                        <div className="relative max-w-5xl w-full">
                            <button
                                onClick={() => setPreviewImage("")}
                                className="absolute -top-3 -right-3 h-9 w-9 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold"
                                aria-label="Close image preview"
                            >
                                x
                            </button>
                            <div className="rounded-lg border border-gray-700 bg-[#111827] p-2">
                                <img src={previewImage} alt="Preview" className="w-full max-h-[80vh] object-contain rounded" />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AttemptQuiz;
