import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Shield, Clock, User, Activity } from "lucide-react";

export default function AuditLogs() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchLogs() {
            setLoading(true);
            try {
                const { data } = await supabase.from("audit_logs").select("*").order('created_at', { ascending: false });
                setLogs(data || []);
            } catch (e) {
                console.error("Audit log fetch error:", e);
                setLogs([]);
            } finally {
                setLoading(false);
            }
        }
        fetchLogs();
    }, []);

    return (
        <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6 sm:mb-8">
                <h1 className="text-2xl sm:text-3xl font-extrabold bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-purple-500">
                    Audit Logs
                </h1>
                <p className="text-xs sm:text-sm text-gray-400 mt-1">
                    System activity, access events, and administrative audit trails.
                </p>
            </div>

            {loading ? (
                <div className="flex justify-center items-center py-16">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            ) : logs.length === 0 ? (
                <div className="card p-12 text-center text-gray-500 border border-gray-800">
                    <Activity className="mx-auto text-gray-600 mb-2" size={32} />
                    <p className="text-base font-semibold text-gray-400">No audit log entries recorded yet.</p>
                </div>
            ) : (
                <>
                    {/* MOBILE AUDIT LOG CARD VIEW (Visible on screens < md) */}
                    <div className="block md:hidden space-y-3">
                        {logs.map((l, i) => (
                            <div key={i} className="card p-4 border border-gray-800 space-y-2 bg-[#0d0d0d]">
                                <div className="flex items-center gap-2 font-bold text-white text-sm">
                                    <Shield size={14} className="text-primary shrink-0" />
                                    <span>{l.action || l.event || "System Event"}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs text-gray-400 pt-1 border-t border-gray-800/60">
                                    <span className="flex items-center gap-1">
                                        <User size={12} className="text-gray-500" />
                                        <span>{l.user || l.user_email || "System"}</span>
                                    </span>
                                    <span className="flex items-center gap-1 font-mono text-gray-500">
                                        <Clock size={12} />
                                        <span>{l.created_at ? new Date(l.created_at).toLocaleTimeString() : (l.time || "-")}</span>
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* DESKTOP TABLE VIEW (Visible on screens >= md) */}
                    <div className="hidden md:block card p-0 overflow-hidden border border-gray-800 shadow-xl">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-white/5 border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                                <tr>
                                    <th className="p-4 font-semibold">Action</th>
                                    <th className="p-4 font-semibold">User</th>
                                    <th className="p-4 font-semibold text-right">Timestamp</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/60 font-light text-gray-300">
                                {logs.map((l, i) => (
                                    <tr key={i} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-2 font-medium text-white text-sm">
                                                <Shield size={14} className="text-primary" />
                                                <span>{l.action || l.event || "System Event"}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-xs text-gray-300">
                                            <div className="flex items-center gap-1.5">
                                                <User size={12} className="text-gray-500" />
                                                <span>{l.user || l.user_email || "System"}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-right text-xs text-gray-400 font-mono">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <Clock size={12} className="text-gray-500" />
                                                <span>{l.created_at ? new Date(l.created_at).toLocaleString() : (l.time || "-")}</span>
                                            </div>
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
