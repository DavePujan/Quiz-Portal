
import React, { useState, useEffect, useContext } from "react";
import { Link } from "react-router-dom";
import { Search, RefreshCw, BarChart2 } from "lucide-react";
import { AuthContext } from "../../context/authStore";
import api from "../../utils/api";

const History = () => {
    const { token } = useContext(AuthContext);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const response = await api.get("/api/student/history");
                setHistory(response.data);
            } catch (err) {
                console.error("Error fetching history:", err);
            } finally {
                setLoading(false);
            }
        };

        if (token) fetchHistory();
    }, [token]);

    const formatDate = (dateString) => {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleString();
    };

    return (
        <div className="p-6 md:p-8">
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-purple-500 mb-8">
                History
            </h1>

            {/* Toolbar - Stack on mobile, Row on desktop */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                {/* Search placeholder */}
                <div className="relative w-full md:w-auto">
                    <input
                        type="text"
                        placeholder="Search"
                        className="bg-[#252526] text-white border border-gray-700 px-4 py-2 rounded-md w-full md:w-64 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <Search className="absolute right-3 top-2.5 text-gray-400 w-5 h-5" />
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    <button className="flex-1 md:flex-none justify-center bg-gray-800 hover:bg-gray-700 text-white border border-gray-700 px-4 py-2 rounded flex items-center gap-2 transition-colors">
                        <RefreshCw className="w-4 h-4" /> Refresh
                    </button>
                    <button className="flex-1 md:flex-none justify-center bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex items-center gap-2 transition-colors shadow-lg shadow-green-900/20">
                        <BarChart2 className="w-4 h-4" /> Export
                    </button>
                </div>
            </div>

            {/* Mobile Card View (Visible on small screens) */}
            <div className="md:hidden space-y-4">
                {loading ? (
                    <div className="text-center text-gray-500 py-8">Loading history...</div>
                ) : history.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">No quiz history found.</div>
                ) : (
                    history.map((item, index) => (
                        <div key={item.id} className="bg-[#1e1e1e] p-4 rounded-lg border border-gray-800 shadow-sm">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="font-bold text-lg text-white mb-1">{item.quiz?.title}</h3>
                                    <span className="bg-blue-900/30 text-blue-400 text-xs px-2 py-1 rounded border border-blue-900/50">
                                        {item.quiz?.subject || item.quiz?.department || "General"}
                                    </span>
                                </div>
                                <span className="text-gray-500 text-xs font-mono">#{index + 1}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                                <div>
                                    <span className="block text-gray-500 text-xs uppercase tracking-wider mb-1">Date</span>
                                    <span className="text-gray-300">{formatDate(item.quiz?.scheduled_at || item.quiz?.created_at).split(',')[0]}</span>
                                </div>
                                <div className="text-right">
                                    <span className="block text-gray-500 text-xs uppercase tracking-wider mb-1">Result</span>
                                    <span className="text-white font-bold text-lg">
                                        <span className={item.score >= (item.quiz?.total_marks / 2) ? "text-green-400" : "text-red-400"}>
                                            {item.score !== null ? item.score : "-"}
                                        </span>
                                        <span className="text-gray-500 text-sm"> / {item.quiz?.total_marks || "?"}</span>
                                    </span>
                                </div>
                            </div>

                            {item.status === "in_progress" ? (
                                <button
                                    disabled
                                    className="w-full bg-gray-900 text-gray-500 py-2 rounded flex items-center justify-center gap-2 border border-gray-800 cursor-not-allowed"
                                    title="Analysis is available after submission"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                    Analysis Pending
                                </button>
                            ) : (
                                <Link to={`/student/review/${item.id}`} className="w-full bg-gray-800 hover:bg-gray-700 text-blue-400 py-2 rounded flex items-center justify-center gap-2 transition-colors border border-gray-700">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                    View Analysis
                                </Link>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Desktop Table View (Hidden on small screens) */}
            <div className="hidden md:block card overflow-hidden p-0!">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-[#1e1e1e] text-gray-400 uppercase text-xs font-bold tracking-wider border-b border-gray-800">
                            <tr>
                                <th className="p-4 border-r border-gray-800">Sr no.</th>
                                <th className="p-4 border-r border-gray-800">Quiz Name</th>
                                <th className="p-4 border-r border-gray-800">Subject</th>
                                <th className="p-4 border-r border-gray-800">Date</th>
                                <th className="p-4 border-r border-gray-800">Result</th>
                                <th className="p-4 text-center">Analysis</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm text-gray-300">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-gray-500">Loading history...</td>
                                </tr>
                            ) : history.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-gray-500">No quiz history found.</td>
                                </tr>
                            ) : (
                                history.map((item, index) => (
                                    <tr key={item.id} className="border-b border-gray-800 hover:bg-white/5 transition-colors">
                                        <td className="p-4 border-r border-gray-800 text-gray-500">{index + 1}</td>
                                        <td className="p-4 border-r border-gray-800 font-medium text-blue-400">
                                            {item.quiz?.title}
                                        </td>
                                        <td className="p-4 border-r border-gray-800 text-gray-400">
                                            {item.quiz?.subject || item.quiz?.department || "General"}
                                        </td>
                                        <td className="p-4 border-r border-gray-800 text-gray-400 whitespace-nowrap">
                                            {formatDate(item.quiz?.scheduled_at || item.quiz?.created_at)}
                                        </td>
                                        <td className="p-4 border-r border-gray-800 text-white font-semibold">
                                            <span className={item.score >= (item.quiz?.total_marks / 2) ? "text-green-400" : "text-red-400"}>
                                                {item.score !== null ? item.score : "Pending"}
                                            </span>
                                            <span className="text-gray-600"> / {item.quiz?.total_marks || "?"}</span>
                                        </td>
                                        <td className="p-4 text-center">
                                            {item.status === "in_progress" ? (
                                                <button
                                                    disabled
                                                    title="Analysis available after submission"
                                                    className="text-gray-600 p-2 rounded-full cursor-not-allowed"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                                    </svg>
                                                </button>
                                            ) : (
                                                <Link to={`/student/review/${item.id}`} className="text-blue-400 hover:text-blue-300 transition-colors p-2 hover:bg-blue-500/10 rounded-full inline-flex">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                                    </svg>
                                                </Link>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* Pagination visual only */}
            <div className="flex justify-end mt-6 text-gray-500 text-xs uppercase tracking-widest font-bold">
                Showing 1 to {history.length} of {history.length} entries
            </div>
        </div>
    );
};

export default History;
