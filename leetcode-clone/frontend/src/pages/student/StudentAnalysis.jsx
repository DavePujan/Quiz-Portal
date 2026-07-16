import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/authStore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Loader2, Activity, Target, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getStudentComprehensiveAnalytics } from '../../utils/api';

const StudentAnalysis = () => {
    const { token } = useAuth();
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
               // Assuming user.id is available
                             if(token) {
                                 const res = await getStudentComprehensiveAnalytics("me");
                 setAnalytics(res.data);
               }
            } catch (err) {
                console.error("Error fetching analytics:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchAnalytics();
    }, [token]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (!analytics) {
        return <div className="p-8 text-center">No data available yet. Take a quiz to see your analysis!</div>;
    }

    const {
        overview,
        history = [],
        topicPerformance = [],
        subjectPerformance = [],
        quizWiseAnalysis = [],
        aiInsights = []
    } = analytics;

    return (
        <div className="min-h-screen bg-gray-50 p-6 dark:bg-gray-900">
            <div className="mx-auto max-w-7xl animate-fade-in space-y-8">
                
                {/* Header */}
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Performance Analysis</h1>
                    <p className="text-gray-500 dark:text-gray-400">AI-driven insights into your learning journey.</p>
                </div>

                {/* Score Cards */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-800">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Quizzes</p>
                                <h3 className="mt-2 text-3xl font-bold text-indigo-600 dark:text-indigo-400">{overview.totalQuizzes}</h3>
                            </div>
                            <div className="rounded-full bg-indigo-50 p-3 dark:bg-indigo-900/20">
                                <Activity className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                            </div>
                        </div>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-800">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Average Score</p>
                                <h3 className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">{overview.avgScore}%</h3>
                            </div>
                            <div className="rounded-full bg-emerald-50 p-3 dark:bg-emerald-900/20">
                                <Target className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                    
                    {/* Left Column: Charts */}
                    <div className="space-y-8 lg:col-span-2">
                        
                        {/* Topic Performance */}
                        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-800">
                            <h2 className="mb-6 text-xl font-bold text-gray-900 dark:text-white">Topic Proficiency</h2>
                            <div className="h-80 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={topicPerformance} layout="vertical" margin={{ left: 20 }}>
                                        <XAxis type="number" domain={[0, 100]} hide />
                                        <YAxis dataKey="topic" type="category" width={100} tick={{fill: '#6b7280', fontSize: 12}} />
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }}
                                            cursor={{fill: 'transparent'}}
                                        />
                                        <Bar dataKey="accuracy" radius={[0, 4, 4, 0]}>
                                            {topicPerformance.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.accuracy > 70 ? '#10b981' : entry.accuracy > 40 ? '#f59e0b' : '#ef4444'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-800">
                            <h2 className="mb-6 text-xl font-bold text-gray-900 dark:text-white">Subject Performance</h2>
                            <div className="h-64 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={subjectPerformance}>
                                        <XAxis dataKey="subject" stroke="#9CA3AF" />
                                        <YAxis domain={[0, 100]} stroke="#9CA3AF" />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }}
                                            cursor={{fill: 'transparent'}}
                                        />
                                        <Bar dataKey="avg_score" radius={[4, 4, 0, 0]}>
                                            {subjectPerformance.map((entry, index) => (
                                                <Cell
                                                    key={`subject-cell-${index}`}
                                                    fill={
                                                        Number(entry.avg_score) > 70
                                                            ? '#10b981'
                                                            : Number(entry.avg_score) > 40
                                                            ? '#f59e0b'
                                                            : '#ef4444'
                                                    }
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Recent History */}
                        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-800">
                            <h2 className="mb-6 text-xl font-bold text-gray-900 dark:text-white">Recent Quizzes</h2>
                            <div className="space-y-4">
                                {history.slice(0, 5).map((attempt) => (
                                    <div key={attempt.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-4 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900/50 dark:hover:bg-gray-800">
                                        <div>
                                            <h4 className="font-semibold text-gray-900 dark:text-white">{attempt.quiz_title}</h4>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {new Date(attempt.submitted_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div className="flex items-center space-x-4">
                                            <div className="text-right">
                                                <p className="font-bold text-gray-900 dark:text-white">{attempt.score}/{attempt.total_marks}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">Score</p>
                                            </div>
                                            <Link 
                                                to={`/student/review/${attempt.id}`}
                                                className="flex items-center rounded-lg bg-white px-3 py-2 text-sm font-medium text-indigo-600 shadow-sm transition-all hover:bg-indigo-50 hover:shadow ring-1 ring-gray-200 dark:bg-gray-800 dark:text-indigo-400 dark:ring-gray-700 dark:hover:bg-gray-700"
                                            >
                                                Review
                                                <ArrowRight className="ml-1.5 h-4 w-4" />
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-800">
                            <h2 className="mb-6 text-xl font-bold text-gray-900 dark:text-white">Quiz Performance Breakdown</h2>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="text-gray-400 text-sm border-b border-gray-700">
                                            <th className="py-2">Quiz</th>
                                            <th className="py-2">Subject</th>
                                            <th className="py-2">Score</th>
                                            <th className="py-2">Percentage</th>
                                            <th className="py-2">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {quizWiseAnalysis.map((q) => (
                                            <tr key={`${q.id}-${q.submitted_at}`} className="border-b border-gray-800">
                                                <td className="py-3 text-gray-900 dark:text-white">{q.title}</td>
                                                <td className="py-3 text-gray-500 dark:text-gray-400">{q.subject || 'General'}</td>
                                                <td className="py-3 text-gray-900 dark:text-white">{q.score}/{q.total_marks}</td>
                                                <td className="py-3">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                        Number(q.percentage) > 70
                                                            ? 'bg-green-500/10 text-green-400'
                                                            : Number(q.percentage) > 40
                                                            ? 'bg-yellow-500/10 text-yellow-400'
                                                            : 'bg-red-500/10 text-red-400'
                                                    }`}>
                                                        {q.percentage}%
                                                    </span>
                                                </td>
                                                <td className="py-3 text-gray-500 dark:text-gray-400 text-sm">
                                                    {new Date(q.submitted_at).toLocaleDateString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </div>

                    {/* Right Column: Insights & Recommendations */}
                    <div className="space-y-6 lg:col-span-1">
                        
                        {/* AI Insights */}
                        <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-6 dark:border-indigo-900/30 dark:bg-indigo-900/10">
                            <div className="mb-4 flex items-center space-x-2">
                                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
                                    <Activity className="h-5 w-5" />
                                </span>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">AI Insights</h2>
                            </div>
                            <ul className="space-y-3">
                                {aiInsights.map((insight, idx) => (
                                    <li key={idx} className="flex items-start text-sm text-gray-700 dark:text-gray-300">
                                        <span className="mr-2 mt-1.5 h-1.5 min-w-1.5 w-1.5 rounded-full bg-indigo-500"></span>
                                        {insight}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="rounded-xl bg-linear-to-br from-indigo-600 to-blue-600 p-6 text-white shadow-lg">
                            <h3 className="text-lg font-bold mb-2">Practice Smart</h3>
                            <p className="text-sm text-indigo-100 mb-4">
                                Improve faster by solving quizzes from your weakest subjects and topics.
                            </p>

                            <Link to="/student/practice">
                                <button className="w-full rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20">
                                    View Practice Questions <ArrowRight className="inline w-4 h-4 ml-2" />
                                </button>
                            </Link>
                        </div>

                    </div>

                </div>
            </div>
        </div>
    );
};

export default StudentAnalysis;
