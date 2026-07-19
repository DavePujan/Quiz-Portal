import React, { useEffect, useState } from "react";
import api from "../../utils/api";


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

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch Stats
                const statsResponse = await api.get("/api/teacher/dashboard");
                setStats(statsResponse.data);

                // Fetch Quizzes
                const quizResponse = await api.get("/api/teacher/quiz");
                setQuizzes(quizResponse.data);

            } catch (err) {
                console.error("Error fetching dashboard data:", err);
            }
        };
        fetchData();
    }, []);

    const endQuiz = async (id) => {
        if (!window.confirm("Are you sure you want to end this quiz?")) return;
        try {
            await api.post(`/api/teacher/quiz/${id}/end`);
            // Refresh
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
        <div className="p-6">
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-purple-500 mb-2">Teacher Dashboard</h1>
            {stats.college ? (
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-8 flex items-center gap-2">
                    <span>{stats.college}</span>
                    <span className="text-gray-600">&bull;</span>
                    <span className="text-primary">{stats.department} Department</span>
                </p>
            ) : (
                <div className="h-4 mb-8"></div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard title="Active Quizzes" value={activeQuizzes.length} />
                <StatCard title="Past Quizzes" value={historyQuizzes.length} />
                <StatCard title="Pending Evaluations" value={stats.pending} />
                <StatCard title="Total Students" value={stats.students} />
            </div>

            <h2 className="text-xl font-bold text-white mb-6">Active Quizzes</h2>
            <div className="card overflow-hidden mb-8 p-0">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-white/5 border-b border-gray-800 text-gray-400 text-sm uppercase tracking-wider">
                        <tr>
                            <th className="p-4 font-medium">Title</th>
                            <th className="p-4 font-medium">Time Remaining</th>
                            <th className="p-4 font-medium">Date</th>
                            <th className="p-4 font-medium">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800 font-light text-gray-300">
                        {activeQuizzes.length === 0 ? (
                            <tr><td colSpan="4" className="p-4 text-center text-gray-500">No active quizzes.</td></tr>
                        ) : (
                            activeQuizzes.map(q => (
                                <tr key={q.id} className="hover:bg-white/5 transition-colors">
                                    <td className="p-4">{q.title}</td>
                                    <td className="p-4 font-mono text-xs text-primary">
                                        <Countdown 
                                            targetDate={new Date(new Date(q.scheduled_at || q.created_at).getTime() + (q.duration || 60) * 60 * 1000)}
                                        />
                                    </td>
                                    <td className="p-4 text-sm text-gray-500">{new Date(q.created_at).toLocaleDateString()}</td>
                                    <td className="p-4">
                                        <button
                                            onClick={() => endQuiz(q.id)}
                                            className="px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded hover:bg-red-500/20 transition-colors text-sm"
                                        >
                                            End Quiz
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <h2 className="text-xl font-bold text-white mb-6">Quiz History</h2>
            <div className="card overflow-hidden p-0">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-white/5 border-b border-gray-800 text-gray-400 text-sm uppercase tracking-wider">
                        <tr>
                            <th className="p-4 font-medium">Title</th>
                            <th className="p-4 font-medium">Code</th>
                            <th className="p-4 font-medium">Date</th>
                            <th className="p-4 font-medium">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800 font-light text-gray-300">
                        {historyQuizzes.length === 0 ? (
                            <tr><td colSpan="4" className="p-4 text-center text-gray-500">No past quizzes.</td></tr>
                        ) : (
                            historyQuizzes.map(q => (
                                <tr key={q.id} className="hover:bg-white/5 transition-colors">
                                    <td className="p-4 text-gray-400">{q.title}</td>
                                    <td className="p-4 font-mono text-xs text-gray-600">{q.id.slice(0, 8)}...</td>
                                    <td className="p-4 text-sm text-gray-600">{new Date(q.created_at).toLocaleDateString()}</td>
                                    <td className="p-4">
                                        <button
                                            onClick={() => window.location.href = `/teacher/quiz/${q.id}/analytics`}
                                            className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded hover:bg-blue-500/20 transition-colors text-sm"
                                        >
                                            View Analysis
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function StatCard({ title, value }) {
    return (
        <div className="card flex flex-col justify-between h-32 relative overflow-hidden group">
            <div>
                <p className="text-gray-400 text-sm font-medium uppercase tracking-wider">{title}</p>
                <p className="text-4xl font-extrabold text-white mt-2">{value}</p>
            </div>
            <div className="absolute right-[-20px] bottom-[-20px] w-24 h-24 bg-linear-to-br from-blue-500/10 to-purple-500/10 rounded-full group-hover:scale-110 transition-transform duration-300"></div>
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
        <span className="text-sm font-mono text-green-400">
            {timeLeft.hours.toString().padStart(2, '0')}:
            {timeLeft.minutes.toString().padStart(2, '0')}:
            {timeLeft.seconds.toString().padStart(2, '0')}
        </span>
    );
}
