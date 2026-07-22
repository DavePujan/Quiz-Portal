import React, { useState, useEffect } from "react";
import api from "../../utils/api";
import { FileText, ArrowRight, CheckCircle2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

export default function Evaluations() {
    const navigate = useNavigate();
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchEvaluations() {
            setLoading(true);
            try {
                const response = await api.get("/api/teacher/evaluations");
                setList(response.data || []);
            } catch (error) {
                console.error("Error fetching evaluations:", error);
                setList([]);
            } finally {
                setLoading(false);
            }
        }
        fetchEvaluations();
    }, []);

    return (
        <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6 sm:mb-8">
                <h1 className="text-2xl sm:text-3xl font-extrabold bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-purple-500">
                    Pending Evaluations
                </h1>
                <p className="text-xs sm:text-sm text-gray-400 mt-1">
                    Review and grade student quiz submissions, coding test cases, and AI auto-evaluations.
                </p>
            </div>

            {loading ? (
                <div className="flex justify-center items-center py-16">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            ) : list.length === 0 ? (
                <div className="card p-12 text-center border border-gray-800">
                    <CheckCircle2 className="mx-auto text-green-400 mb-2" size={32} />
                    <p className="text-base font-semibold text-gray-300">All caught up! No pending evaluations.</p>
                    <p className="text-xs text-gray-500 mt-1">Student submissions requiring teacher evaluation will appear here.</p>
                </div>
            ) : (
                <>
                    {/* MOBILE EVALUATION CARD VIEW (Visible on screens < md) */}
                    <div className="block md:hidden space-y-4">
                        {list.map(item => (
                            <div key={item.id} className="card p-4 border border-gray-800 space-y-3 bg-[#0d0d0d]">
                                <div className="flex items-start justify-between gap-3 pb-3 border-b border-gray-800">
                                    <div>
                                        <h3 className="font-bold text-white text-base leading-snug">{item.student}</h3>
                                        <p className="text-xs text-gray-400 font-mono mt-0.5">
                                            Enrollment: {item.enrollmentNo || "N/A"}
                                        </p>
                                    </div>
                                    <span className="px-2.5 py-1 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded text-[10px] uppercase font-bold tracking-wider shrink-0">
                                        {item.status || "PENDING"}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2 text-xs text-gray-300 bg-white/5 p-2.5 rounded-lg border border-white/5">
                                    <FileText size={14} className="text-primary shrink-0" />
                                    <span className="font-medium truncate">{item.quiz}</span>
                                </div>

                                <button
                                    className="btn-primary w-full py-2.5 text-xs font-bold shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2 mt-2"
                                    onClick={() => navigate(`/teacher/evaluation/${item.id}`)}
                                >
                                    <span>Evaluate Submission</span>
                                    <ArrowRight size={14} />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* DESKTOP EVALUATION TABLE VIEW (Visible on screens >= md) */}
                    <div className="hidden md:block card p-0 overflow-hidden border border-gray-800 shadow-xl">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-white/5 border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                                <tr>
                                    <th className="p-4 font-semibold">Student</th>
                                    <th className="p-4 font-semibold">Enrollment No.</th>
                                    <th className="p-4 font-semibold">Quiz</th>
                                    <th className="p-4 font-semibold">Status</th>
                                    <th className="p-4 font-semibold text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/60 font-light text-gray-300">
                                {list.map(item => (
                                    <tr key={item.id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4 text-white font-bold text-sm">{item.student}</td>
                                        <td className="p-4 text-gray-300 font-mono text-xs">{item.enrollmentNo || "-"}</td>
                                        <td className="p-4 text-gray-300 text-sm font-medium">{item.quiz}</td>
                                        <td className="p-4">
                                            <span className="px-2.5 py-1 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded text-xs uppercase font-bold tracking-wider">
                                                {item.status || "PENDING"}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                                className="btn-primary py-1.5 px-4 text-xs font-bold shadow-lg shadow-purple-500/20"
                                                onClick={() => navigate(`/teacher/evaluation/${item.id}`)}
                                            >
                                                Evaluate
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
    );
}
