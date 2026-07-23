import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, Layers3, BookOpen, Sparkles, Clock, FileText, ArrowRight, Trophy, RotateCcw, CheckCircle2, CalendarClock } from "lucide-react";
import { useAuth } from "../../context/authStore";
import { getStudentRecommendations, getStudentRecommendationsV2, getTeacherPracticeQuizzes } from "../../utils/api";

const MISTAKE_KEY = "practice-mistakes-v1";
const MASTERED_KEY = "practice-mastered-v1";

const levelClass = (score) => {
  if (score >= 70) return "text-emerald-300 bg-emerald-500/10 border-emerald-500/30";
  if (score >= 45) return "text-amber-300 bg-amber-500/10 border-amber-500/30";
  return "text-red-300 bg-red-500/10 border-red-500/30";
};

const readMistakes = () => {
  try {
    const raw = localStorage.getItem(MISTAKE_KEY);
    if (!raw) return { subjects: {}, topics: {}, quizzes: {} };
    const parsed = JSON.parse(raw);
    return { subjects: parsed.subjects || {}, topics: parsed.topics || {}, quizzes: parsed.quizzes || {} };
  } catch { return { subjects: {}, topics: {}, quizzes: {} }; }
};

const readMastered = () => {
  try {
    const raw = localStorage.getItem(MASTERED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch { return {}; }
};

const formatTimeAgo = (dateStr) => {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

const Practice = () => {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [teacherQuizzes, setTeacherQuizzes] = useState([]);
  const [activeTab, setActiveTab] = useState("weak");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openSubjects, setOpenSubjects] = useState({});
  const [openQuizzes, setOpenQuizzes] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      if (!token) { setLoading(false); return; }
      try {
        const practiceRes = await getTeacherPracticeQuizzes();
        setTeacherQuizzes(practiceRes.data || []);
        const v2 = await getStudentRecommendationsV2("me");
        setData(v2.data || { recommendations: [] });
      } catch {
        try {
          const v1 = await getStudentRecommendations("me");
          setData({
            weakSubjects: v1.data?.weakSubjects || [],
            recommendations: [{ topicId: null, topic: "Weak Subjects", accuracy: 0, difficulty: "medium", quizzes: v1.data?.recommendations || [] }]
          });
        } catch (err) { setError(err?.response?.data?.error || "Failed to fetch recommendations"); }
      } finally { setLoading(false); }
    };
    fetchData();
  }, [token]);

  const { availableQuizzes, attendedQuizzes } = useMemo(() => {
    const available = [], attended = [];
    for (const quiz of teacherQuizzes) {
      (quiz.attempts?.length > 0 ? attended : available).push(quiz);
    }
    return { availableQuizzes: available, attendedQuizzes: attended };
  }, [teacherQuizzes]);

  const subjectTree = useMemo(() => {
    const mistakes = readMistakes();
    const mastered = readMastered();
    const groups = data?.recommendations || [];
    const subjectMap = new Map();

    for (const group of groups) {
      for (const quiz of group.quizzes || []) {
        if (mastered[quiz.id]) continue;
        const subject = quiz.subject || "General";
        if (!subjectMap.has(subject)) subjectMap.set(subject, { subject, weaknessScore: 50, quizzes: new Map() });
        const subjectNode = subjectMap.get(subject);
        if (!subjectNode.quizzes.has(quiz.id)) {
          subjectNode.quizzes.set(quiz.id, { id: quiz.id, title: quiz.title, subject, difficulty: quiz.difficulty || group.difficulty || "medium", reasonTopics: new Set(), priority: 0 });
        }
        const quizNode = subjectNode.quizzes.get(quiz.id);
        if (group.topic) quizNode.reasonTopics.add(group.topic);
      }
    }

    const weakSubjects = data?.weakSubjects || [];
    weakSubjects.forEach((s, idx) => {
      if (!subjectMap.has(s)) subjectMap.set(s, { subject: s, weaknessScore: Math.max(20, 60 - idx * 8), quizzes: new Map() });
    });

    const normalized = Array.from(subjectMap.values()).map((subjectNode) => {
      const quizArr = Array.from(subjectNode.quizzes.values()).map((q) => {
        const subjectPenalty = Number(mistakes.subjects?.[subjectNode.subject] || 0);
        const topicPenalty = Array.from(q.reasonTopics).reduce((sum, t) => sum + Number(mistakes.topics?.[t] || 0), 0);
        const quizPenalty = Number(mistakes.quizzes?.[q.id] || 0);
        return { ...q, reasonTopics: Array.from(q.reasonTopics), priority: subjectPenalty + topicPenalty + quizPenalty };
      });
      quizArr.sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title));
      const weakIdx = weakSubjects.indexOf(subjectNode.subject);
      const baseWeakness = weakIdx >= 0 ? Math.max(20, 70 - weakIdx * 10) : subjectNode.weaknessScore;
      const score = Math.max(0, Math.min(100, baseWeakness - Number(mistakes.subjects?.[subjectNode.subject] || 0) * 2));
      return { subject: subjectNode.subject, weaknessScore: score, quizzes: quizArr };
    });

    normalized.sort((a, b) => a.weaknessScore - b.weaknessScore);
    return normalized.filter((s) => s.quizzes.length > 0);
  }, [data]);

  const toggleSubject = (subject) => setOpenSubjects((prev) => ({ ...prev, [subject]: !prev[subject] }));
  const toggleQuiz = (id) => setOpenQuizzes((prev) => ({ ...prev, [id]: !prev[id] }));

  if (loading) return <div className="p-6 text-white flex justify-center items-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  if (error) return <div className="p-6 text-red-400">{error}</div>;

  const getBestScore = (attempts) => {
    if (!attempts || attempts.length === 0) return null;
    return attempts.reduce((best, a) => (a.score > best.score ? a : best), attempts[0]);
  };

  const renderQuizCard = (quiz, isAttended) => {
    const attempts = quiz.attempts || [];
    const best = getBestScore(attempts);
    const lastAttempt = attempts[0];

    return (
      <div key={quiz.id} className="rounded-xl border border-gray-800 bg-[#0d0d0d] p-4 sm:p-5 flex flex-col justify-between gap-4 hover:border-gray-700 transition-colors">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-white text-sm sm:text-base leading-snug flex-1 min-w-0">{quiz.title}</h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono text-purple-400 bg-purple-500/10 border border-purple-500/20 font-bold shrink-0 uppercase">Practice</span>
          </div>

          {quiz.description && <p className="text-xs text-gray-400 line-clamp-2">{quiz.description}</p>}

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-gray-400">
            {quiz.duration && (
              <span className="flex items-center gap-1 font-semibold text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
                <Clock size={12} /><span>{quiz.duration} min</span>
              </span>
            )}
            {quiz.total_marks > 0 && (
              <span className="flex items-center gap-1 font-mono">
                <Trophy size={12} className="text-amber-400" /><span>{quiz.total_marks} marks</span>
              </span>
            )}
            {quiz.subject && (
              <span className="flex items-center gap-1">
                <FileText size={12} className="text-purple-400" /><span className="truncate max-w-[120px]">{quiz.subject}</span>
              </span>
            )}
            {quiz.creator?.full_name && <span className="text-gray-500 truncate max-w-[140px]">By {quiz.creator.full_name}</span>}
          </div>

          {isAttended && attempts.length > 0 && (
            <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400 font-medium flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-400" />
                  {attempts.length} attempt{attempts.length !== 1 ? "s" : ""}
                </span>
                {lastAttempt?.completed_at && (
                  <span className="text-gray-500 flex items-center gap-1">
                    <CalendarClock size={12} />{formatTimeAgo(lastAttempt.completed_at)}
                  </span>
                )}
              </div>
              {best && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Best:</span>
                  <span className={`text-sm font-bold px-2 py-0.5 rounded-full border ${
                    best.total_marks > 0 && (best.score / best.total_marks) >= 0.7
                      ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/30"
                      : best.total_marks > 0 && (best.score / best.total_marks) >= 0.4
                        ? "text-amber-300 bg-amber-500/10 border-amber-500/30"
                        : "text-red-300 bg-red-500/10 border-red-500/30"
                  }`}>
                    {best.score ?? 0}/{best.total_marks ?? 0}
                  </span>
                  {best.total_marks > 0 && (
                    <span className="text-xs text-gray-500">({((best.score / best.total_marks) * 100).toFixed(0)}%)</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <Link to={`/student/practice/quiz/${quiz.id}`} className="block w-full">
          <button className={`w-full py-2.5 rounded-lg transition-all text-xs font-bold flex items-center justify-center gap-2 ${
            isAttended
              ? "bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30"
              : "bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30"
          }`}>
            {isAttended ? (<><RotateCcw size={14} /><span>Re-attempt Quiz</span></>) : (<><ArrowRight size={14} /><span>Start Practice Quiz</span></>)}
          </button>
        </Link>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 text-white space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-purple-500">Student Practice Portal</h1>
        <p className="text-xs sm:text-sm text-gray-400 mt-1">Time-limited practice with unlimited re-attempts. Sharpen your skills at your own pace.</p>
      </div>

      <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3 sm:p-4 text-xs sm:text-sm text-indigo-100 flex items-start sm:items-center gap-3">
        <Sparkles className="text-indigo-400 shrink-0 mt-0.5 sm:mt-0" size={20} />
        <span>Each practice quiz is time-limited. You can re-attempt as many times as you want — your best score is tracked.</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-gray-800 pb-3">
        <button onClick={() => setActiveTab("weak")} className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === "weak" ? "bg-primary text-white shadow-lg shadow-primary/25" : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"}`}>
          <Sparkles size={16} /><span className="hidden sm:inline">Weak Topics Quiz (AI Adaptive)</span><span className="sm:hidden">AI Adaptive</span>
        </button>
        <button onClick={() => setActiveTab("teacher")} className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === "teacher" ? "bg-purple-600 text-white shadow-lg shadow-purple-600/25" : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"}`}>
          <BookOpen size={16} /><span className="hidden sm:inline">Practice Quizzes (By Teachers)</span><span className="sm:hidden">By Teachers</span>
          <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-white/20 font-mono">{teacherQuizzes.length}</span>
        </button>
      </div>

      {activeTab === "weak" && (
        <>
          {subjectTree.length === 0 ? (
            <div className="card p-8 text-center border border-gray-800"><p className="text-sm font-semibold text-gray-400">You're doing great! No weak areas detected right now.</p></div>
          ) : (
            <div className="space-y-4">
              {subjectTree.map((subjectNode) => {
                const subjectOpen = openSubjects[subjectNode.subject] ?? true;
                const subjectClass = levelClass(subjectNode.weaknessScore);
                return (
                  <div key={subjectNode.subject} className="rounded-xl border border-gray-800 bg-gray-900/80 overflow-hidden">
                    <button onClick={() => toggleSubject(subjectNode.subject)} className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-800/70 transition-colors">
                      <div className="flex items-center gap-3">
                        {subjectOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <div className="text-left">
                          <p className="font-semibold text-base sm:text-lg">{subjectNode.subject}</p>
                          <p className="text-xs text-gray-400">{subjectNode.quizzes.length} recommended quizzes</p>
                        </div>
                      </div>
                      <span className={`text-xs border px-2 py-1 rounded-full ${subjectClass} hidden sm:inline`}>Weakness Score: {subjectNode.weaknessScore}%</span>
                      <span className={`text-xs border px-2 py-1 rounded-full ${subjectClass} sm:hidden`}>{subjectNode.weaknessScore}%</span>
                    </button>
                    {subjectOpen && (
                      <div className="px-4 pb-4 space-y-3">
                        {subjectNode.quizzes.length === 0 ? (
                          <p className="text-sm text-gray-400">No quiz mapped yet for this subject.</p>
                        ) : subjectNode.quizzes.map((quiz) => {
                          const quizOpen = openQuizzes[quiz.id] ?? true;
                          return (
                            <div key={quiz.id} className="rounded-lg border border-gray-800 bg-gray-950/80">
                              <button onClick={() => toggleQuiz(quiz.id)} className="w-full px-3 sm:px-4 py-3 flex items-center justify-between hover:bg-gray-900 transition-colors">
                                <div className="text-left flex-1 min-w-0">
                                  <p className="font-medium text-sm sm:text-base truncate">{quiz.title}</p>
                                  <p className="text-xs text-indigo-300 mt-1 line-clamp-1">Weak in: {quiz.reasonTopics.length > 0 ? quiz.reasonTopics.join(", ") : "core concepts"}</p>
                                </div>
                                <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-2">
                                  <span className="text-[10px] sm:text-[11px] uppercase px-2 py-1 rounded bg-yellow-500/10 text-yellow-300 border border-yellow-500/20 font-bold">{quiz.difficulty}</span>
                                  {quizOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </div>
                              </button>
                              {quizOpen && (
                                <div className="px-3 sm:px-4 pb-4 space-y-3">
                                  <div className="text-sm text-gray-300 flex items-start gap-2">
                                    <Layers3 className="h-4 w-4 mt-0.5 text-indigo-300 shrink-0" />
                                    <span className="line-clamp-2">Topics focus: {quiz.reasonTopics.length > 0 ? quiz.reasonTopics.join(", ") : "Fundamentals"}</span>
                                  </div>
                                  <Link to={`/student/practice/quiz/${quiz.id}`}>
                                    <button className="w-full bg-indigo-600 hover:bg-indigo-700 py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-2">
                                      <span>Start Practice</span><ArrowRight size={14} />
                                    </button>
                                  </Link>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === "teacher" && (
        <div className="space-y-6">
          {teacherQuizzes.length === 0 ? (
            <div className="card p-8 text-center border border-gray-800">
              <BookOpen className="mx-auto text-purple-400 mb-2" size={32} />
              <p className="text-base font-semibold text-gray-300">No Teacher Practice Quizzes Available</p>
              <p className="text-xs text-gray-500 mt-1">Practice quizzes published by your department teachers will appear here.</p>
            </div>
          ) : (
            <>
              {availableQuizzes.length > 0 && (
                <div>
                  <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <BookOpen size={15} className="text-purple-400" />Available Practice Quizzes
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono">{availableQuizzes.length}</span>
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {availableQuizzes.map((quiz) => renderQuizCard(quiz, false))}
                  </div>
                </div>
              )}
              {attendedQuizzes.length > 0 && (
                <div>
                  <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-emerald-400" />Attended Practice Quizzes
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">{attendedQuizzes.length}</span>
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {attendedQuizzes.map((quiz) => renderQuizCard(quiz, true))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Practice;
