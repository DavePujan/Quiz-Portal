import React, { useEffect, useState } from "react";
import api from "../../utils/api";
import { Activity, History, Clock, Users, ArrowRight, StopCircle, BarChart3, Building } from "lucide-react";
import { Link } from "react-router-dom";

export default function TeacherDashboard() {
    const [stats, setStats] = useState({
        active: 0,
        upcoming: 0,
        pending: 0,
        students: 0,
        college: "",
        department: ""
    });

    const [quizzes, setQuizzes] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch Stats
                const statsResponse = await api.get("/api/teacher/dashboard");
                setStats(statsResponse.data || {});

                // Fetch Quizzes
                const quizResponse = await api.get("/api/teacher/quiz");
                setQuizzes(quizResponse.data || []);
            } catch (err) {
                console.error("Error fetching dashboard data:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const endQuiz = async (id) => {
        if (!window.confirm("Are you sure you want to end this quiz?")) return;
        try {
            await api.post(`/api/teacher/quiz/${id}/end`);
            window.location.reload();
        } catch (err) {
            console.error(err);
        }
    };

    const isExpired = (q) => {
        if (!q.duration) return false;
        const startTime = new Date(q.scheduled_at || q.created_at).getTime();
        const endTime = startTime + (q.duration * 60 * 1000);
        return Date.now() > endTime;
    };

    const activeQuizzes = quizzes.filter(q => q.is_active !== false && !isExpired(q));
    const historyQuizzes = quizzes.filter(q => q.is_active === false || isExpired(q));

    return (
        <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
            {/* Title Header */}
            <div className="mb-6 sm:mb-8">
                <h1 className="text-2xl sm:text-3xl font-extrabold bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-purple-500">
                    Teacher Dashboard
                </h1>
                {stats.college ? (
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mt-1 flex flex-wrap items-center gap-2">
                        <span className="flex items-center gap-1"><Building size={12} className="text-gray-500" />{stats.college}</span>
                        <span className="text-gray-600 hidden sm:inline">&bull;</span>
                        <span className="text-primary">{stats.department} Department</span>
                    </p>
                ) : (
                    <p className="text-xs sm:text-sm text-gray-400 mt-1">Overview of your active quizzes, student assessments, and evaluations.</p>
                )}
            </div>

            {/* Stat Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
                <StatCard title="Active Quizzes" value={activeQuizzes.length} icon={<Activity size={22} className="text-green-400" />} color="from-green-500/10 to-emerald-500/10" />
                <StatCard title="Past Quizzes" value={historyQuizzes.length} icon={<History size={22} className="text-purple-400" />} color="from-purple-500/10 to-indigo-500/10" />
                <StatCard title="Pending Evaluations" value={stats.pending || 0} icon={<Clock size={22} className="text-amber-400" />} color="from-amber-500/10 to-orange-500/10" />
                <StatCard title="Total Students" value={stats.students || 0} icon={<Users size={22} className="text-blue-400" />} color="from-blue-500/10 to-cyan-500/10" />
            </div>

            {/* Active Quizzes Section */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                        <Activity size={20} className="text-green-400" />
                        <span>Active Quizzes</span>
                    </h2>
                    <span className="text-xs font-bold text-gray-400 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">
                        {activeQuizzes.length} Active
                    </span>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : activeQuizzes.length === 0 ? (
                    <div className="card p-8 text-center border border-gray-800">
                        <p className="text-sm font-semibold text-gray-400">No active quizzes currently running.</p>
                        <Link to="/teacher/create-quiz" className="inline-flex items-center gap-1.5 text-xs text-primary font-bold mt-2 hover:underline">
                            + Create a new quiz
                        </Link>
                    </div>
                ) : (
                    <>
                        {/* MOBILE ACTIVE QUIZZES CARD VIEW (Visible on screens < md) */}
                        <div className="block md:hidden space-y-3">
                            {activeQuizzes.map(q => (
                                <div key={q.id} className="card p-4 border border-gray-800 space-y-3 bg-[#0d0d0d]">
                                    <div className="flex items-start justify-between gap-3">
                                        <h3 className="font-bold text-white text-base leading-snug">{q.title}</h3>
                                        <span className="px-2 py-0.5 rounded text-[10px] font-mono text-green-400 bg-green-500/10 border border-green-500/20 font-bold shrink-0">
                                            ACTIVE
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-800">
                                        <div className="flex items-center gap-1.5 font-mono">
                                            <Clock size={14} className="text-gray-500" />
                                            <Countdown targetDate={new Date(new Date(q.scheduled_at || q.created_at).getTime() + (q.duration || 60) * 60 * 1000)} />
                                        </div>
                                        <span className="text-gray-500">{new Date(q.created_at).toLocaleDateString()}</span>
                                    </div>

                                    <button
                                        onClick={() => endQuiz(q.id)}
                                        className="w-full flex items-center justify-center gap-2 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors text-xs font-bold mt-2"
                                    >
                                        <StopCircle size={14} />
                                        <span>End Quiz</span>
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* DESKTOP ACTIVE QUIZZES TABLE VIEW (Visible on screens >= md) */}
                        <div className="hidden md:block card overflow-hidden p-0 border border-gray-800 shadow-xl">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-white/5 border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                                    <tr>
                                        <th className="p-4 font-semibold">Title</th>
                                        <th className="p-4 font-semibold">Time Remaining</th>
                                        <th className="p-4 font-semibold">Date Created</th>
                                        <th className="p-4 font-semibold text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800/60 font-light text-gray-300">
                                    {activeQuizzes.map(q => (
                                        <tr key={q.id} className="hover:bg-white/5 transition-colors">
                                            <td className="p-4 font-bold text-white text-sm">{q.title}</td>
                                            <td className="p-4 font-mono text-xs text-primary">
                                                <Countdown targetDate={new Date(new Date(q.scheduled_at || q.created_at).getTime() + (q.duration || 60) * 60 * 1000)} />
                                            </td>
                                            <td className="p-4 text-xs text-gray-400">{new Date(q.created_at).toLocaleDateString()}</td>
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => endQuiz(q.id)}
                                                    className="px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors text-xs font-bold"
                                                >
                                                    End Quiz
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>

            {/* Quiz History Section */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                        <History size={20} className="text-purple-400" />
                        <span>Quiz History</span>
                    </h2>
                    <span className="text-xs font-bold text-gray-400 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">
                        {historyQuizzes.length} Past
                    </span>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : historyQuizzes.length === 0 ? (
                    <div className="card p-8 text-center border border-gray-800">
                        <p className="text-sm font-semibold text-gray-400">No past quiz history available.</p>
                    </div>
                ) : (
                    <>
                        {/* MOBILE QUIZ HISTORY CARD VIEW (Visible on screens < md) */}
                        <div className="block md:hidden space-y-3">
                            {historyQuizzes.map(q => (
                                <div key={q.id} className="card p-4 border border-gray-800 space-y-3 bg-[#0d0d0d]">
                                    <div className="flex items-start justify-between gap-3">
                                        <h3 className="font-bold text-white text-base leading-snug">{q.title}</h3>
                                        <span className="px-2 py-0.5 rounded text-[10px] font-mono text-gray-400 bg-white/5 border border-white/10 shrink-0">
                                            {q.id.slice(0, 8)}...
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-800">
                                        <span>Date: {new Date(q.created_at).toLocaleDateString()}</span>
                                    </div>

                                    <button
                                        onClick={() => window.location.href = `/teacher/quiz/${q.id}/analytics`}
                                        className="w-full flex items-center justify-center gap-2 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-colors text-xs font-bold mt-2"
                                    >
                                        <BarChart3 size={14} />
                                        <span>View Analytics</span>
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* DESKTOP QUIZ HISTORY TABLE VIEW (Visible on screens >= md) */}
                        <div className="hidden md:block card overflow-hidden p-0 border border-gray-800 shadow-xl">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-white/5 border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                                    <tr>
                                        <th className="p-4 font-semibold">Title</th>
                                        <th className="p-4 font-semibold">Quiz Code</th>
                                        <th className="p-4 font-semibold">Date Created</th>
                                        <th className="p-4 font-semibold text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800/60 font-light text-gray-300">
                                    {historyQuizzes.map(q => (
                                        <tr key={q.id} className="hover:bg-white/5 transition-colors">
                                            <td className="p-4 font-medium text-gray-300 text-sm">{q.title}</td>
                                            <td className="p-4 font-mono text-xs text-gray-500">{q.id.slice(0, 8)}...</td>
                                            <td className="p-4 text-xs text-gray-400">{new Date(q.created_at).toLocaleDateString()}</td>
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => window.location.href = `/teacher/quiz/${q.id}/analytics`}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-colors text-xs font-bold ml-auto"
                                                >
                                                    <BarChart3 size={14} />
                                                    <span>View Analysis</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function StatCard({ title, value, icon, color }) {
    return (
        <div className="card p-5 flex flex-col justify-between h-32 relative overflow-hidden group border border-gray-800">
            <div className="flex items-center justify-between z-10">
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">{title}</p>
                <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                    {icon}
                </div>
            </div>
            <div className="z-10 mt-2">
                <p className="text-3xl sm:text-4xl font-extrabold text-white">{value}</p>
            </div>
            <div className={`absolute right-[-20px] bottom-[-20px] w-24 h-24 bg-linear-to-br ${color} rounded-full group-hover:scale-110 transition-transform duration-300`}></div>
        </div>
    );
}

function Countdown({ targetDate }) {
    const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

    function calculateTimeLeft() {
        const difference = +new Date(targetDate) - +new Date();
        if (difference > 0) {
            return {
                hours: Math.floor((difference / (1000 * 60 * 60))),
                minutes: Math.floor((difference / 1000 / 60) % 60),
                seconds: Math.floor((difference / 1000) % 60)
            };
        }
        return null;
    }

    useEffect(() => {
        const timer = setTimeout(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);
        return () => clearTimeout(timer);
    });

    if (!timeLeft) {
        return <span className="text-red-500 font-bold">Ended</span>;
    }

    return (
        <span className="text-xs font-mono text-green-400 font-bold">
            {timeLeft.hours.toString().padStart(2, '0')}:
            {timeLeft.minutes.toString().padStart(2, '0')}:
            {timeLeft.seconds.toString().padStart(2, '0')}
        </span>
    );
}
