import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, Layers3, BookOpen, Sparkles, Clock, FileText, ArrowRight } from "lucide-react";
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
    return {
      subjects: parsed.subjects || {},
      topics: parsed.topics || {},
      quizzes: parsed.quizzes || {}
    };
  } catch {
    return { subjects: {}, topics: {}, quizzes: {} };
  }
};

const readMastered = () => {
  try {
    const raw = localStorage.getItem(MASTERED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
};

const Practice = () => {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [teacherQuizzes, setTeacherQuizzes] = useState([]);
  const [activeTab, setActiveTab] = useState("weak"); // "weak" or "teacher"
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openSubjects, setOpenSubjects] = useState({});
  const [openQuizzes, setOpenQuizzes] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        // 1. Fetch Teacher Added Practice Quizzes
        const practiceRes = await getTeacherPracticeQuizzes();
        setTeacherQuizzes(practiceRes.data || []);

        // 2. Fetch Weak Topics Recommendations
        const v2 = await getStudentRecommendationsV2("me");
        setData(v2.data || { recommendations: [] });
      } catch {
        try {
          const v1 = await getStudentRecommendations("me");
          setData({
            weakSubjects: v1.data?.weakSubjects || [],
            recommendations: [
              {
                topicId: null,
                topic: "Weak Subjects",
                accuracy: 0,
                difficulty: "medium",
                quizzes: v1.data?.recommendations || []
              }
            ]
          });
        } catch (err) {
          setError(err?.response?.data?.error || "Failed to fetch recommendations");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  const subjectTree = useMemo(() => {
    const mistakes = readMistakes();
    const mastered = readMastered();
    const groups = data?.recommendations || [];

    const subjectMap = new Map();

    for (const group of groups) {
      for (const quiz of group.quizzes || []) {
        if (mastered[quiz.id]) {
          continue;
        }

        const subject = quiz.subject || "General";
        if (!subjectMap.has(subject)) {
          subjectMap.set(subject, {
            subject,
            weaknessScore: 50,
            quizzes: new Map()
          });
        }

        const subjectNode = subjectMap.get(subject);
        const quizId = quiz.id;
        if (!subjectNode.quizzes.has(quizId)) {
          subjectNode.quizzes.set(quizId, {
            id: quiz.id,
            title: quiz.title,
            subject,
            difficulty: quiz.difficulty || group.difficulty || "medium",
            reasonTopics: new Set(),
            priority: 0
          });
        }

        const quizNode = subjectNode.quizzes.get(quizId);
        if (group.topic) quizNode.reasonTopics.add(group.topic);
      }
    }

    const weakSubjects = data?.weakSubjects || [];
    weakSubjects.forEach((s, idx) => {
      if (!subjectMap.has(s)) {
        subjectMap.set(s, {
          subject: s,
          weaknessScore: Math.max(20, 60 - idx * 8),
          quizzes: new Map()
        });
      }
    });

    const normalized = Array.from(subjectMap.values()).map((subjectNode) => {
      const quizArr = Array.from(subjectNode.quizzes.values()).map((q) => {
        const subjectPenalty = Number(mistakes.subjects?.[subjectNode.subject] || 0);
        const topicPenalty = Array.from(q.reasonTopics).reduce(
          (sum, t) => sum + Number(mistakes.topics?.[t] || 0),
          0
        );
        const quizPenalty = Number(mistakes.quizzes?.[q.id] || 0);

        return {
          ...q,
          reasonTopics: Array.from(q.reasonTopics),
          priority: subjectPenalty + topicPenalty + quizPenalty
        };
      });

      quizArr.sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title));

      const weakIdx = weakSubjects.indexOf(subjectNode.subject);
      const baseWeakness = weakIdx >= 0 ? Math.max(20, 70 - weakIdx * 10) : subjectNode.weaknessScore;
      const score = Math.max(0, Math.min(100, baseWeakness - Number(mistakes.subjects?.[subjectNode.subject] || 0) * 2));

      return {
        subject: subjectNode.subject,
        weaknessScore: score,
        quizzes: quizArr
      };
    });

    normalized.sort((a, b) => a.weaknessScore - b.weaknessScore);
    return normalized.filter((s) => s.quizzes.length > 0);
  }, [data]);

  const toggleSubject = (subject) => {
    setOpenSubjects((prev) => ({ ...prev, [subject]: !prev[subject] }));
  };

  const toggleQuiz = (id) => {
    setOpenQuizzes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) return <div className="p-6 text-white flex justify-center items-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  if (error) return <div className="p-6 text-red-400">{error}</div>;

  return (
    <div className="p-4 sm:p-6 text-white space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-purple-500">
          Student Practice Portal
        </h1>
        <p className="text-xs sm:text-sm text-gray-400 mt-1">
          Improve your coding skills with untimed practice quizzes and AI-guided weak topic analysis.
        </p>
      </div>

      {/* Untimed Banner */}
      <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 text-xs sm:text-sm text-indigo-100 flex items-center gap-3">
        <Sparkles className="text-indigo-400 shrink-0" size={20} />
        <span>Practice mode is untimed. Attempts are not saved to official quiz history and do not affect exam scores.</span>
      </div>

      {/* Dual Tab Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-800 pb-3">
        <button
          onClick={() => setActiveTab("weak")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === "weak"
              ? "bg-primary text-white shadow-lg shadow-primary/25"
              : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
          }`}
        >
          <Sparkles size={16} />
          <span>Weak Topics Quiz (AI Adaptive)</span>
        </button>

        <button
          onClick={() => setActiveTab("teacher")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === "teacher"
              ? "bg-purple-600 text-white shadow-lg shadow-purple-600/25"
              : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
          }`}
        >
          <BookOpen size={16} />
          <span>Practice Quizzes (Added by Teachers)</span>
          <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-white/20 font-mono">
            {teacherQuizzes.length}
          </span>
        </button>
      </div>

      {/* TAB 1: WEAK TOPICS QUIZ */}
      {activeTab === "weak" && (
        <>
          {subjectTree.length === 0 ? (
            <div className="card p-8 text-center border border-gray-800">
              <p className="text-sm font-semibold text-gray-400">You're doing great! No weak areas detected right now.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {subjectTree.map((subjectNode) => {
                const subjectOpen = openSubjects[subjectNode.subject] ?? true;
                const subjectClass = levelClass(subjectNode.weaknessScore);

                return (
                  <div key={subjectNode.subject} className="rounded-xl border border-gray-800 bg-gray-900/80 overflow-hidden">
                    <button
                      onClick={() => toggleSubject(subjectNode.subject)}
                      className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-800/70 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {subjectOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <div className="text-left">
                          <p className="font-semibold text-lg">{subjectNode.subject}</p>
                          <p className="text-xs text-gray-400">{subjectNode.quizzes.length} recommended quizzes</p>
                        </div>
                      </div>
                      <span className={`text-xs border px-2 py-1 rounded-full ${subjectClass}`}>
                        Weakness Score: {subjectNode.weaknessScore}%
                      </span>
                    </button>

                    {subjectOpen && (
                      <div className="px-4 pb-4 space-y-3">
                        {subjectNode.quizzes.length === 0 ? (
                          <p className="text-sm text-gray-400">No quiz mapped yet for this subject.</p>
                        ) : (
                          subjectNode.quizzes.map((quiz) => {
                            const quizOpen = openQuizzes[quiz.id] ?? true;
                            return (
                              <div key={quiz.id} className="rounded-lg border border-gray-800 bg-gray-950/80">
                                <button
                                  onClick={() => toggleQuiz(quiz.id)}
                                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-900 transition-colors"
                                >
                                  <div className="text-left">
                                    <p className="font-medium">{quiz.title}</p>
                                    <p className="text-xs text-indigo-300 mt-1">
                                      Recommended because you are weak in {quiz.reasonTopics.length > 0 ? quiz.reasonTopics.join(", ") : "core concepts"}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-[11px] uppercase px-2 py-1 rounded bg-yellow-500/10 text-yellow-300 border border-yellow-500/20 font-bold">
                                      {quiz.difficulty}
                                    </span>
                                    {quizOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                  </div>
                                </button>

                                {quizOpen && (
                                  <div className="px-4 pb-4 space-y-3">
                                    <div className="text-sm text-gray-300 flex items-start gap-2">
                                      <Layers3 className="h-4 w-4 mt-0.5 text-indigo-300" />
                                      <span>
                                        Topics focus: {quiz.reasonTopics.length > 0 ? quiz.reasonTopics.join(", ") : "Fundamentals"}
                                      </span>
                                    </div>
                                    <Link to={`/student/practice/quiz/${quiz.id}`}>
                                      <button className="w-full bg-indigo-600 hover:bg-indigo-700 py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-2">
                                        <span>Start Practice (Untimed)</span>
                                        <ArrowRight size={14} />
                                      </button>
                                    </Link>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* TAB 2: TEACHER ADDED PRACTICE QUIZZES */}
      {activeTab === "teacher" && (
        <div className="space-y-4">
          {teacherQuizzes.length === 0 ? (
            <div className="card p-8 text-center border border-gray-800">
              <BookOpen className="mx-auto text-purple-400 mb-2" size={32} />
              <p className="text-base font-semibold text-gray-300">No Teacher Practice Quizzes Available</p>
              <p className="text-xs text-gray-500 mt-1">Practice quizzes published by your department teachers will appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {teacherQuizzes.map((quiz) => (
                <div key={quiz.id} className="card p-5 border border-gray-800 space-y-4 bg-[#0d0d0d] flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="font-bold text-white text-base leading-snug">{quiz.title}</h3>
                      <span className="px-2.5 py-1 rounded text-[10px] font-mono text-purple-400 bg-purple-500/10 border border-purple-500/20 font-bold shrink-0">
                        PRACTICE
                      </span>
                    </div>

                    {quiz.description && (
                      <p className="text-xs text-gray-400 line-clamp-2 mb-3">{quiz.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 pt-3 border-t border-gray-800/80">
                      {quiz.subject && (
                        <span className="flex items-center gap-1">
                          <FileText size={14} className="text-purple-400" />
                          <span>{quiz.subject}</span>
                        </span>
                      )}
                      {quiz.duration && (
                        <span className="flex items-center gap-1 font-mono">
                          <Clock size={14} className="text-gray-500" />
                          <span>{quiz.duration} mins</span>
                        </span>
                      )}
                      {quiz.creator?.full_name && (
                        <span className="text-gray-500">By {quiz.creator.full_name}</span>
                      )}
                    </div>
                  </div>

                  <Link to={`/student/practice/quiz/${quiz.id}`} className="block w-full">
                    <button className="w-full py-2.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-lg transition-colors text-xs font-bold flex items-center justify-center gap-2 mt-2">
                      <span>Start Practice Quiz</span>
                      <ArrowRight size={14} />
                    </button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Practice;
