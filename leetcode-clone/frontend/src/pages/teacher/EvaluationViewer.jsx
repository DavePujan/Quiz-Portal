import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronDown, AlertCircle, Settings } from "lucide-react";

import api, { getAiProviders } from "../../utils/api";

export default function EvaluationViewer() {
    const { id } = useParams();
    const [submission, setSubmission] = useState(null);
    const [loading, setLoading] = useState(false);
    const [liveSeconds, setLiveSeconds] = useState(null);

    const [providers, setProviders] = useState([]);
    const [selectedProvider, setSelectedProvider] = useState("gemini");
    const [providersLoading, setProvidersLoading] = useState(true);

    const DEFAULT_MODELS = {
        gemini: "gemini-2.5-flash",
        openrouter: "google/gemma-4-31b-it:free",
        cerebras: "gpt-oss-120b",
        mistral: "mistral-small-latest"
    };

    useEffect(() => {
        getAiProviders()
            .then(res => {
                setProviders(res.data.providers);
                const configured = res.data.providers.find(p => p.configured);
                if (configured) setSelectedProvider(configured.id);
            })
            .catch(err => console.error("Provider check failed", err))
            .finally(() => setProvidersLoading(false));
    }, []);

    const currentProvider = providers.find(p => p.id === selectedProvider);
    const isConfigured = currentProvider?.configured ?? false;
    const configuredProviders = providers.filter(p => p.configured);
    const hasConfiguredProviders = configuredProviders.length > 0;

    // Mock getSubmissions
    async function getSubmissions() {
        return api.get(`/api/teacher/evaluation/${id}`);
    }

    useEffect(() => {
        if (!id) return;
        getSubmissions()
            .then(res => {
                // The backend route returns object { ..., answers: [] }
                setSubmission(res.data);
            })
            .catch(() => setSubmission(null));
    }, [id]);

    useEffect(() => {
        if (!submission) return;

        const base = Number(submission.timeTakenSeconds);
        if (!Number.isFinite(base)) {
            setLiveSeconds(null);
            return;
        }

        setLiveSeconds(base);

        // Keep ticking only while submission is not finalized.
        if (submission.completedAt || submission.status === "evaluated") return;

        const timer = setInterval(() => {
            setLiveSeconds((prev) => (Number.isFinite(prev) ? prev + 1 : prev));
        }, 1000);

        return () => clearInterval(timer);
    }, [submission]);

    const formatDuration = (seconds) => {
        if (!Number.isFinite(seconds)) return "-";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    };

    const handleAutoEvaluate = async () => {
        if (!isConfigured) return alert("Please configure an AI provider first.");
        if (!confirm("Run Auto-Evaluation? This will use AI and Judge0 to grade code questions.")) return;
        setLoading(true);
        try {
            const res = await api.post(`/api/teacher/evaluate/${id}`, {
                provider: selectedProvider,
                model: DEFAULT_MODELS[selectedProvider]
            });
            alert("Auto-Evaluation Complete!");
            window.location.reload(); // Refresh to see scores
        } catch (err) {
            console.error(err);
            if (err.response && err.response.data && err.response.data.error) {
                alert("Error: " + err.response.data.error);
            } else {
                alert("Failed to connect to server.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 text-gray-300">
            <h1 className="text-xl font-semibold mb-4 text-white">Answer Evaluation</h1>

            {submission && (
                <div className="bg-[#1e1e1e] shadow rounded p-4 mb-4 border border-gray-700">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <p className="font-semibold text-gray-200">Student: {submission.student}</p>
                            <p className="text-sm text-gray-400">Enrollment No: {submission.enrollmentNo || "-"}</p>
                            <p className="text-sm text-gray-400">Quiz: {submission.quiz}</p>
                            <p className="text-sm text-gray-400">Total Score: {submission.score}</p>
                            <p className="text-sm text-gray-400">Timer: {formatDuration(liveSeconds)}</p>
                            {submission.quizDurationMinutes && (
                                <p className="text-xs text-gray-500">Quiz Duration: {submission.quizDurationMinutes} min</p>
                            )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            {providersLoading ? (
                                <span className="text-sm text-gray-500">Loading AI...</span>
                            ) : (
                                <>
                                    {hasConfiguredProviders ? (
                                        <div className="flex items-center gap-2">
                                            <div className="relative">
                                                <select
                                                    value={selectedProvider}
                                                    onChange={(e) => setSelectedProvider(e.target.value)}
                                                    className="appearance-none bg-[#2a2a2b] border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 cursor-pointer pr-8"
                                                >
                                                    {configuredProviders.map(p => (
                                                        <option key={p.id} value={p.id}>{p.name}</option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                            </div>
                                            <button
                                                onClick={handleAutoEvaluate}
                                                disabled={loading || !isConfigured}
                                                className={`px-4 py-2 rounded text-white font-medium whitespace-nowrap ${loading || !isConfigured ? "bg-gray-600" : "bg-purple-600 hover:bg-purple-700"}`}
                                            >
                                                {loading ? "Evaluating..." : "Auto Evaluate with AI"}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 bg-yellow-900/20 border border-yellow-700/50 px-3 py-2 rounded text-sm text-yellow-200">
                                            <AlertCircle className="w-4 h-4" />
                                            <span>No AI Configured</span>
                                            <Link to="/teacher/settings" className="flex items-center gap-1 ml-2 text-yellow-400 hover:text-yellow-300 underline">
                                                <Settings className="w-4 h-4" /> Settings
                                            </Link>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="rounded border border-indigo-700/40 bg-indigo-900/10 p-3">
                            <p className="text-xs text-gray-400 uppercase tracking-wider">Integrity Score</p>
                            <p className="text-xl font-bold text-white mt-1">
                                {submission.integrity ? `${submission.integrity.score}/100` : "N/A"}
                            </p>
                            <p className="text-xs text-gray-300 mt-1">
                                Risk: {submission.integrity?.risk || "Safe"}
                            </p>
                        </div>

                        <div className="rounded border border-gray-700 bg-[#252526] p-3">
                            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Key Events</p>
                            <p className="text-xs text-gray-300">
                                FS:{submission.integrity?.counters?.fullscreen_exits || 0} | Tab:{submission.integrity?.counters?.tab_switches || 0} | Blur:{submission.integrity?.counters?.window_blurs || 0} | CP:{submission.integrity?.counters?.copy_events || 0} | DT:{submission.integrity?.counters?.devtools_attempts || 0}
                            </p>
                        </div>
                    </div>

                    {submission.answers.map((a, i) => (
                        <div key={i} className="border-t border-gray-700 pt-2 mt-2">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="font-medium text-gray-200">Q{i + 1}: {a.question} <span className="text-gray-500 text-xs ml-2">(Max: {a.maxMarks})</span></span>
                                {a.ai_analysis && <span className="text-xs bg-purple-900/50 text-purple-200 border border-purple-700 px-2 py-0.5 rounded">AI Reviewed</span>}
                            </div>

                            <div className="bg-[#2d2d2d] p-2 rounded mt-1 font-mono text-sm overflow-x-auto text-gray-300 border border-gray-700">
                                <pre>{a.code || a.selectedOption || "No Answer"}</pre>
                            </div>

                            {a.feedback && (
                                <div className="mt-2 bg-blue-900/20 p-3 rounded text-sm text-gray-300 border border-blue-800/50">
                                    <p className="font-semibold text-blue-300 mb-1">AI Feedback:</p>
                                    {a.feedback}
                                    {a.test_cases_passed !== undefined && (
                                        <p className="mt-1 text-xs text-blue-400">
                                            Test Cases: {a.test_cases_passed} / {a.total_test_cases} passed.
                                        </p>
                                    )}
                                </div>
                            )}

                            <div className="flex items-center mt-3 gap-4">
                                <label className="text-sm text-gray-400">
                                    Marks: <input
                                        type="number"
                                        className="border border-gray-600 rounded p-1 w-20 bg-[#2d2d2d] text-white ml-2"
                                        defaultValue={a.marks}
                                        max={a.maxMarks}
                                        min={0}
                                        onChange={(e) => {
                                            let val = parseFloat(e.target.value);
                                            if (val > a.maxMarks) {
                                                val = a.maxMarks;
                                                e.target.value = val;
                                            }
                                            if (val < 0) {
                                                val = 0;
                                                e.target.value = val;
                                            }
                                            a.newMarks = val;
                                        }}
                                    />
                                </label>
                                <label className="flex items-center text-sm gap-2 text-gray-400">
                                    <input
                                        type="checkbox"
                                        defaultChecked={a.isCorrect}
                                        onChange={(e) => a.newIsCorrect = e.target.checked}
                                    />
                                    Correct
                                </label>
                            </div>
                        </div>
                    ))}

                    <button
                        className="btn-primary mt-6 w-full"
                        onClick={async () => {
                            if (!window.confirm("Finalize Evaluation?")) return;

                            // Gather updates
                            const updates = submission.answers.map(a => ({
                                questionId: a.questionId, // Need to ensure backend sends this!
                                marks: a.newMarks !== undefined ? a.newMarks : a.marks,
                                isCorrect: a.newIsCorrect !== undefined ? a.newIsCorrect : a.isCorrect
                            }));

                            try {
                                await api.post(`/api/teacher/evaluation/${id}/finalize`, { marks: updates });
                                alert("Evaluated Successfully!");
                                window.location.href = "/teacher/evaluations";
                            } catch (e) { 
                                console.error(e);
                                alert("Failed to finalize evaluation!");
                            }
                        }}
                    >
                        Finalize & Submit
                    </button>
                </div>
            )}
        </div>
    );
}
