import React, { useEffect, useState } from "react";
import api from "../../utils/api";
import { Link } from "react-router-dom";
import { Search, RotateCcw, CheckCircle, XCircle, ArrowLeft, Mail, Building2, Calendar } from "lucide-react";

export default function AdminRequests() {
    const [requests, setRequests] = useState([]);
    const [roleFilter, setRoleFilter] = useState("all");
    const [deptFilter, setDeptFilter] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const defaultDepartments = [
        "Biomedical Engineering", "Computer Engineering", "Electronics & Communication Engineering",
        "General Department", "Information Technology", "Instrumentation & Control Engineering",
        "Metallurgy Engineering", "Mechanical Engineering", "Civil Engineering",
        "Robotics and Automation Engineering", "Electrical Engineering"
    ];

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const res = await api.get("/api/admin/requests");
            setRequests(res.data || []);
            setError("");
        } catch (err) {
            console.error("Failed to fetch requests", err);
            setError("Failed to fetch requests: " + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    const approve = async (email) => {
        if (!confirm(`Approve access for ${email}?`)) return;

        try {
            await api.post("/api/admin/approve-request", { email });
            fetchRequests(); // Refresh
        } catch (err) {
            alert("Approval failed: " + (err.response?.data?.error || err.message));
        }
    };

    const reject = async (email) => {
        if (!confirm(`Reject access for ${email}? This will remove the request.`)) return;

        try {
            await api.post("/api/admin/reject-request", { email });
            fetchRequests(); // Refresh
        } catch (err) {
            alert("Rejection failed: " + (err.response?.data?.error || err.message));
        }
    };

    const allDepartments = Array.from(
        new Set([
            ...defaultDepartments,
            ...requests.map(r => r.department).filter(Boolean)
        ])
    ).sort();

    const filteredRequests = requests.filter(req => {
        if (roleFilter !== "all" && req.role !== roleFilter) return false;

        if (deptFilter !== "all") {
            if (!req.department) return false;
            const rDept = req.department.trim().toLowerCase();
            const fDept = deptFilter.trim().toLowerCase();
            if (rDept !== fDept && !rDept.includes(fDept) && !fDept.includes(rDept)) return false;
        }

        if (searchTerm.trim()) {
            const term = searchTerm.trim().toLowerCase();
            const emailMatch = (req.email || "").toLowerCase().includes(term);
            const nameMatch = (req.name || "").toLowerCase().includes(term);
            if (!emailMatch && !nameMatch) return false;
        }

        return true;
    });

    const resetFilters = () => {
        setRoleFilter("all");
        setDeptFilter("all");
        setSearchTerm("");
    };

    return (
        <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-purple-500">
                        Access Requests
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-400 mt-1">
                        Review pending account registration requests submitted by students and teachers.
                    </p>
                </div>
                <Link 
                    to="/admin" 
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold transition-colors border border-gray-700"
                >
                    <ArrowLeft size={14} />
                    <span>Back to Dashboard</span>
                </Link>
            </div>

            {error && <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm mb-6">{error}</div>}

            {/* Filter Controls Bar */}
            <div className="card p-4 sm:p-6 mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Search Request</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search email or name..."
                                className="input pl-9 w-full text-sm"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Filter by Role</label>
                        <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className="input w-full text-sm"
                        >
                            <option value="all">All Roles</option>
                            <option value="teacher">Teacher</option>
                            <option value="student">Student</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Filter by Department</label>
                        <select
                            value={deptFilter}
                            onChange={(e) => setDeptFilter(e.target.value)}
                            className="input w-full text-sm"
                        >
                            <option value="all">All Departments</option>
                            {allDepartments.map(d => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <button
                            onClick={resetFilters}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg border border-gray-700 transition-colors"
                        >
                            <RotateCcw size={14} />
                            <span>Reset Filters</span>
                        </button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center py-16">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            ) : filteredRequests.length === 0 ? (
                <div className="card p-8 text-center border border-gray-800">
                    <p className="text-base font-semibold text-gray-400">No pending access requests match your criteria.</p>
                    <p className="text-xs text-gray-600 mt-1">Check back later or adjust your filters.</p>
                </div>
            ) : (
                <>
                    {/* MOBILE REQUEST CARD VIEW (Visible on screens < md) */}
                    <div className="block md:hidden space-y-4">
                        {filteredRequests.map(req => (
                            <div key={req.id || req.email} className="card p-4 border border-gray-800 space-y-3 bg-[#0d0d0d]">
                                <div className="flex items-start justify-between gap-2 pb-3 border-b border-gray-800">
                                    <div>
                                        <h3 className="font-bold text-white text-base truncate">{req.name || "Access Request"}</h3>
                                        <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
                                            <Mail size={12} className="text-gray-500 shrink-0" />
                                            <span className="truncate">{req.email}</span>
                                        </div>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider shrink-0 ${
                                        req.role === 'teacher' 
                                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                    }`}>
                                        {req.role}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between text-xs text-gray-400">
                                    <span className="flex items-center gap-1">
                                        <Building2 size={12} className="text-gray-500" />
                                        <span>{req.department || "General"}</span>
                                    </span>
                                    <span className="flex items-center gap-1 font-mono text-gray-500">
                                        <Calendar size={12} />
                                        <span>{req.created_at ? new Date(req.created_at).toLocaleDateString() : "Pending"}</span>
                                    </span>
                                </div>

                                <div className="pt-2 border-t border-gray-800 grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => approve(req.email)}
                                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg hover:bg-green-500/20 transition-colors text-xs font-bold"
                                    >
                                        <CheckCircle size={14} />
                                        <span>Approve</span>
                                    </button>
                                    <button
                                        onClick={() => reject(req.email)}
                                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors text-xs font-bold"
                                    >
                                        <XCircle size={14} />
                                        <span>Reject</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* DESKTOP REQUEST TABLE VIEW (Visible on screens >= md) */}
                    <div className="hidden md:block card p-0 overflow-hidden border border-gray-800 shadow-xl">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-white/5 border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                                <tr>
                                    <th className="p-4 font-semibold">Submitted</th>
                                    <th className="p-4 font-semibold">User Details</th>
                                    <th className="p-4 font-semibold">Role Requested</th>
                                    <th className="p-4 font-semibold">Department</th>
                                    <th className="p-4 font-semibold text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/60 font-light text-gray-300">
                                {filteredRequests.map(req => (
                                    <tr key={req.id || req.email} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4 text-gray-400 text-xs font-mono">
                                            {req.created_at ? new Date(req.created_at).toLocaleDateString() : "Pending"}
                                        </td>
                                        <td className="p-4">
                                            <div className="font-bold text-white text-sm">{req.name || "N/A"}</div>
                                            <div className="text-xs text-gray-400 font-mono mt-0.5">{req.email}</div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2.5 py-1 rounded-md text-[11px] uppercase font-bold tracking-wider inline-block ${
                                                req.role === 'teacher' 
                                                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                                                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                            }`}>
                                                {req.role}
                                            </span>
                                        </td>
                                        <td className="p-4 text-xs text-gray-400">{req.department || "-"}</td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => approve(req.email)}
                                                    className="flex items-center gap-1 px-3 py-1.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded hover:bg-green-500/20 transition-colors text-xs font-semibold"
                                                >
                                                    <CheckCircle size={14} />
                                                    <span>Approve</span>
                                                </button>
                                                <button
                                                    onClick={() => reject(req.email)}
                                                    className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded hover:bg-red-500/20 transition-colors text-xs font-semibold"
                                                >
                                                    <XCircle size={14} />
                                                    <span>Reject</span>
                                                </button>
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
