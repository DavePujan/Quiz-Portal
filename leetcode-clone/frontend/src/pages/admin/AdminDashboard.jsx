import React, { useEffect, useState } from "react";
import { getAdminStats } from "../../utils/api";
import { Users, Activity, History, AlertCircle, ArrowRight, UserPlus, Shield } from "lucide-react";
import { Link } from "react-router-dom";

export default function AdminDashboard() {
    const [stats, setStats] = useState({
        users: 0,
        quizzes: 0,
        history: 0,
        pendingRoles: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getAdminStats()
            .then(res => {
                setStats({
                    users: res.data.totalUsers || 0,
                    quizzes: res.data.activeQuizzes || 0,
                    history: res.data.historyQuizzes || 0,
                    pendingRoles: res.data.pendingRequests || 0
                });
            })
            .catch(err => console.error("Admin stats error", err))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
            {/* Title Header */}
            <div className="mb-6 sm:mb-8">
                <h1 className="text-2xl sm:text-3xl font-extrabold bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-purple-500">
                    Admin Dashboard
                </h1>
                <p className="text-xs sm:text-sm text-gray-400 mt-1">
                    System health overview, user management, and pending access requests.
                </p>
            </div>

            {/* Stat Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
                <StatCard title="Total Users" value={stats.users} icon={<Users size={22} className="text-blue-400" />} color="from-blue-500/10 to-purple-500/10" />
                <StatCard title="Active Quizzes" value={stats.quizzes} icon={<Activity size={22} className="text-green-400" />} color="from-green-500/10 to-emerald-500/10" />
                <StatCard title="Quiz History" value={stats.history} icon={<History size={22} className="text-purple-400" />} color="from-purple-500/10 to-indigo-500/10" />
                <StatCard title="Pending Requests" value={stats.pendingRoles} icon={<AlertCircle size={22} className="text-amber-400" />} color="from-amber-500/10 to-red-500/10" highlight={stats.pendingRoles > 0} />
            </div>

            {/* Quick Actions Card */}
            <div className="card p-6 border border-gray-800">
                <h2 className="text-lg sm:text-xl font-bold text-white mb-4">Quick Management Actions</h2>
                <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 w-full">
                    <Link
                        to="/admin/requests"
                        className="btn-primary shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 text-sm py-3 px-6 w-full sm:w-auto"
                    >
                        <UserPlus size={18} />
                        <span>Manage Access Requests</span>
                        {stats.pendingRoles > 0 && (
                            <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                                {stats.pendingRoles}
                            </span>
                        )}
                    </Link>
                    <Link
                        to="/admin/users"
                        className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold text-gray-300 border border-gray-700 hover:bg-white/5 hover:text-white transition-colors text-sm w-full sm:w-auto"
                    >
                        <Shield size={18} />
                        <span>Manage Users & Roles</span>
                        <ArrowRight size={16} />
                    </Link>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon, color, highlight }) {
    return (
        <div className={`card p-5 flex flex-col justify-between h-32 relative overflow-hidden group border ${highlight ? 'border-amber-500/40' : 'border-gray-800'}`}>
            <div className="flex items-center justify-between z-10">
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">{title}</p>
                <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                    {icon}
                </div>
            </div>
            <div className="z-10 mt-2">
                <p className="text-3xl sm:text-4xl font-extrabold text-white">{value}</p>
            </div>
            <div className={`absolute -right-5 -bottom-5 w-24 h-24 bg-linear-to-br ${color} rounded-full group-hover:scale-110 transition-transform duration-300`}></div>
        </div>
    );
}
