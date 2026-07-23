import React, { useState, useEffect, useContext } from "react";
import { Trophy, Medal, ChevronLeft, ChevronRight, Layers } from "lucide-react";
import { AuthContext } from "../../context/authStore";
import api from "../../utils/api";

const Leaderboard = () => {
    const { token } = useContext(AuthContext);
    const [leaderboard, setLeaderboard] = useState([]);
    const [quizzes, setQuizzes] = useState([]);
    const [selectedQuizId, setSelectedQuizId] = useState("");
    const [loading, setLoading] = useState(false);
    
    // Pagination State
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const limit = 10;

    // Fetch active quizzes for the dropdown
    useEffect(() => {
        const fetchQuizzes = async () => {
            try {
                const response = await api.get("/api/student/quizzes?includeAttempted=true");
                const data = response.data;
                setQuizzes(data);
                if (data.length > 0) setSelectedQuizId(data[0].id);
            } catch (err) {
                console.error("Error fetching quizzes for leaderboard:", err);
            }
        };

        if (token) fetchQuizzes();
    }, [token]);

    // Reset to page 1 when quiz selection changes
    useEffect(() => {
        setPage(1);
    }, [selectedQuizId]);

    // Fetch leaderboard for selected quiz
    useEffect(() => {
        const fetchLeaderboard = async () => {
            if (!selectedQuizId) return;
            try {
                setLoading(true);
                const response = await api.get(`/api/student/leaderboard?quizId=${selectedQuizId}&page=${page}&limit=${limit}`);
                setLeaderboard(response.data.data || []);
                setTotalCount(response.data.totalCount || 0);
            } catch (err) {
                console.error("Error fetching leaderboard:", err);
            } finally {
                setLoading(false);
            }
        };

        if (token && selectedQuizId) fetchLeaderboard();
    }, [token, selectedQuizId, page]);

    const totalPages = Math.ceil(totalCount / limit) || 1;

    return (
        <div className="bg-[#121212] min-h-screen text-white p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold flex items-center bg-clip-text text-transparent bg-linear-to-r from-yellow-400 to-amber-500">
                        <Trophy className="w-8 h-8 text-yellow-500 mr-2 shrink-0" /> Academic Leaderboard
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-400 mt-1">
                        Compare your performance with classmates in your department and semester.
                    </p>
                </div>
            </div>

            <div className="rounded-xl border border-gray-800 bg-[#1d1d1d] p-4 sm:p-5 space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">Select Active Quiz:</label>
                <div className="relative">
                    <select
                        value={selectedQuizId}
                        onChange={(e) => setSelectedQuizId(e.target.value)}
                        className="bg-[#2d2d2d] text-white p-3 rounded-lg border border-gray-700 w-full sm:w-1/2 md:w-1/3 focus:outline-hidden focus:ring-2 focus:ring-yellow-500 text-sm font-medium transition-all"
                    >
                        {quizzes.map(q => (
                            <option key={q.id} value={q.id}>{q.title}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="bg-[#1d1d1d] rounded-xl overflow-hidden border border-gray-800 shadow-xl">
                {/* Traditional Table Wrapper for larger screens, with horizontal scrolling protection */}
                <div className="overflow-x-auto hidden sm:block">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-[#262626] text-gray-400 border-b border-gray-800 text-xs uppercase tracking-wider">
                            <tr>
                                <th className="p-4 font-bold">Rank</th>
                                <th className="p-4 font-bold">User</th>
                                <th className="p-4 font-bold text-right">Score</th>
                                <th className="p-4 font-bold">Quiz Title</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/50">
                            {loading ? (
                                <tr>
                                    <td colSpan="4" className="p-12 text-center text-gray-500">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500 mx-auto"></div>
                                    </td>
                                </tr>
                            ) : leaderboard.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="p-12 text-center text-gray-500 text-sm font-medium">
                                        No attempts recorded yet for this quiz.
                                    </td>
                                </tr>
                            ) : (
                                leaderboard.map((entry, index) => {
                                    const rank = (page - 1) * limit + index + 1;
                                    return (
                                        <tr key={index} className="hover:bg-[#262626]/40 transition-colors">
                                            <td className="p-4 font-semibold text-sm">
                                                {rank === 1 ? (
                                                    <span className="flex items-center gap-1 text-yellow-400 font-bold">
                                                        <Medal className="w-5 h-5" /> 1st
                                                    </span>
                                                ) : rank === 2 ? (
                                                    <span className="flex items-center gap-1 text-gray-300 font-bold">
                                                        <Medal className="w-5 h-5" /> 2nd
                                                    </span>
                                                ) : rank === 3 ? (
                                                    <span className="flex items-center gap-1 text-amber-600 font-bold">
                                                        <Medal className="w-5 h-5" /> 3rd
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400">#{rank}</span>
                                                )}
                                            </td>
                                            <td className="p-4 font-mono text-green-400 text-sm font-semibold">{entry.username}</td>
                                            <td className="p-4 font-extrabold text-right text-base text-yellow-400/90">
                                                {entry.score}
                                                <span className="text-xs text-gray-500 font-normal font-sans ml-1">
                                                    / {entry.total_marks || 100}
                                                </span>
                                            </td>
                                            <td className="p-4 text-sm text-gray-400 font-medium">{entry.quizTitle}</td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Card-based Layout for mobile devices */}
                <div className="sm:hidden divide-y divide-gray-800">
                    {loading ? (
                        <div className="p-12 text-center text-gray-500">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500 mx-auto"></div>
                        </div>
                    ) : leaderboard.length === 0 ? (
                        <div className="p-12 text-center text-gray-500 text-sm font-medium">
                            No attempts recorded yet for this quiz.
                        </div>
                    ) : (
                        leaderboard.map((entry, index) => {
                            const rank = (page - 1) * limit + index + 1;
                            return (
                                <div key={index} className="p-4 flex items-center justify-between gap-3 bg-[#1d1d1d] hover:bg-[#262626]/20 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-[#2a2a2a] flex items-center justify-center font-bold text-xs">
                                            {rank === 1 ? (
                                                <Medal className="w-5 h-5 text-yellow-400" />
                                            ) : rank === 2 ? (
                                                <Medal className="w-5 h-5 text-gray-300" />
                                            ) : rank === 3 ? (
                                                <Medal className="w-5 h-5 text-amber-600" />
                                            ) : (
                                                <span className="text-gray-400">#{rank}</span>
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-mono text-green-400 text-sm font-bold truncate">{entry.username}</p>
                                            <p className="text-xs text-gray-500 truncate mt-0.5">{entry.quizTitle}</p>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className="text-base font-extrabold text-yellow-400">{entry.score}</span>
                                        <span className="text-[10px] text-gray-500 block">/ {entry.total_marks || 100} marks</span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Pagination Controls */}
            {totalCount > limit && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#1d1d1d] rounded-xl p-4 border border-gray-800">
                    <p className="text-xs sm:text-sm text-gray-400 font-medium">
                        Showing <span className="text-white font-bold">{Math.min(totalCount, (page - 1) * limit + 1)}</span> to{" "}
                        <span className="text-white font-bold">{Math.min(totalCount, page * limit)}</span> of{" "}
                        <span className="text-white font-bold">{totalCount}</span> entries
                    </p>
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <button
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={page === 1}
                          className="flex-1 sm:flex-initial flex items-center justify-center gap-1 px-4 py-2 text-xs font-bold rounded-lg border border-gray-700 bg-[#2a2a2a] text-gray-300 disabled:opacity-50 hover:bg-[#333] transition-colors"
                        >
                            <ChevronLeft size={14} /> Previous
                        </button>
                        <span className="text-xs font-semibold px-3 text-gray-400">
                            Page <span className="text-white font-bold">{page}</span> of {totalPages}
                        </span>
                        <button
                          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                          disabled={page === totalPages}
                          className="flex-1 sm:flex-initial flex items-center justify-center gap-1 px-4 py-2 text-xs font-bold rounded-lg border border-gray-700 bg-[#2a2a2a] text-gray-300 disabled:opacity-50 hover:bg-[#333] transition-colors"
                        >
                            Next <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Leaderboard;
