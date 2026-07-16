
import { useState, useEffect, useContext } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../../context/authStore";
import api from "../../utils/api";

const UpcomingQuizzes = () => {
    const { token } = useContext(AuthContext);
    const [quizzes, setQuizzes] = useState({ active: [], upcoming: [] });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchQuizzes = async () => {
        setRefreshing(true);
        try {
            const response = await api.get("/api/student/quizzes");
            setQuizzes(response.data);
        } catch (err) {
            console.error("Error fetching quizzes:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        if (token) fetchQuizzes();
    }, [token]);

    const handleRefresh = () => {
        fetchQuizzes();
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-purple-500">
                    Student Dashboard
                </h1>
                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg border border-gray-700 transition"
                >
                    <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-40">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            ) : (
                <>
                    {/* Upcoming Quizzes Section */}
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                            Upcoming Quizzes
                        </h2>
                    </div>

                    {(!quizzes.upcoming || quizzes.upcoming.length === 0) ? (
                        <div className="card p-8 text-center border-dashed border-gray-700 bg-transparent opacity-50">
                            <p className="text-gray-500">No upcoming quizzes scheduled.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {quizzes.upcoming?.map(quiz => (
                                <div key={quiz.id} className="card border-gray-800 opacity-75 hover:opacity-100 transition">
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="text-lg font-bold text-gray-300">{quiz.title}</h3>
                                        <span className="bg-yellow-500/10 text-yellow-500 text-xs px-2 py-1 rounded border border-yellow-500/20">
                                            Upcoming
                                        </span>
                                    </div>
                                    <div className="bg-black/30 p-4 rounded-lg mb-4 border border-gray-800">
                                        <span className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Starts At</span>
                                        <span className="text-lg font-mono text-yellow-400">
                                            {new Date(quiz.scheduled_at).toLocaleString()}
                                        </span>
                                    </div>
                                    <button disabled className="w-full py-2 rounded-lg bg-gray-800 text-gray-500 cursor-not-allowed text-sm">
                                        Not Started Yet
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default UpcomingQuizzes;
