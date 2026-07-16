
import { useState, useEffect, useContext } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../../context/authStore";
import api from "../../utils/api";

const ActiveQuizzes = () => {
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
                    {/* Active Quizzes Section */}
                    <div className="flex justify-between items-end mb-4">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            Active Quizzes
                        </h2>
                    </div>

                    {(!quizzes.active || quizzes.active.length === 0) ? (
                        <div className="card p-8 text-center mb-12 border-dashed border-gray-700 bg-transparent">
                            <p className="text-gray-500">No active quizzes at the moment.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                            {quizzes.active?.map(quiz => (
                                <div key={quiz.id} className="card group hover:border-primary/50 transition-all duration-300">
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="text-xl font-bold text-white group-hover:text-primary transition-colors">{quiz.title}</h3>
                                        <span className="bg-primary/10 text-primary text-xs px-2 py-1 rounded border border-primary/20">
                                            {quiz.department || "General"}
                                        </span>
                                    </div>

                                    <p className="text-gray-400 text-sm mb-6 line-clamp-2">{quiz.description}</p>

                                    <div className="flex items-center justify-between text-xs text-gray-500 mb-6 font-mono">
                                        <div>
                                            <span className="block text-gray-600 mb-1 uppercase tracking-wider">Created by</span>
                                            <span className="text-gray-300">{quiz.creator?.full_name || "Teacher"}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="block text-gray-600 mb-1 uppercase tracking-wider">Duration</span>
                                            <span className="text-gray-300">{quiz.duration} mins</span>
                                        </div>
                                    </div>

                                    <Link
                                        to={`/student/quiz/${quiz.id}`}
                                        className="block w-full text-center bg-linear-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-3 rounded-lg font-medium transition active:scale-95 shadow-lg shadow-green-500/20"
                                    >
                                        Start Quiz
                                    </Link>
                                </div>
                            ))}
                        </div>
                    )}


                </>
            )}
        </div>
    );
};

export default ActiveQuizzes;
