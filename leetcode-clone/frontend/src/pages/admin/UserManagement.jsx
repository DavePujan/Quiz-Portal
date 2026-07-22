import React, { useEffect, useState } from "react";
import { getUsers, promoteUser, deleteUser } from "../../utils/api";
import { Search, RotateCcw, UserCheck, Shield, ArrowDownRight, Trash2, Mail, Building2 } from "lucide-react";

export default function UserManagement() {
    const [users, setUsers] = useState([]);
    const [roleFilter, setRoleFilter] = useState("all");
    const [deptFilter, setDeptFilter] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);

    const defaultDepartments = [
        "Biomedical Engineering", "Computer Engineering", "Electronics & Communication Engineering",
        "General Department", "Information Technology", "Instrumentation & Control Engineering",
        "Metallurgy Engineering", "Mechanical Engineering", "Civil Engineering",
        "Robotics and Automation Engineering", "Electrical Engineering"
    ];

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = () => {
        setLoading(true);
        getUsers()
            .then(res => setUsers(res.data || []))
            .catch(err => {
                console.error("Failed to fetch users", err);
                setUsers([]);
            })
            .finally(() => setLoading(false));
    };

    const promote = (email, role) => {
        promoteUser(email, role)
            .then(() => fetchUsers())
            .catch(err => alert("Failed to update: " + err.message));
    };

    const removeUser = (email) => {
        if (!confirm(`Are you sure you want to remove access for ${email}? This action is irreversible.`)) return;
        deleteUser(email)
            .then(() => fetchUsers())
            .catch(err => alert("Failed to remove user: " + (err.response?.data?.error || err.message)));
    };

    const handleDemote = (u) => {
        if (u.role === "student") {
            alert("Cannot demote anymore!");
            return;
        }

        let newRole = "student";
        if (u.role === "admin") newRole = "teacher";

        if (confirm(`Demote ${u.email} to ${newRole}?`)) {
            promote(u.email, newRole);
        }
    };

    const allDepartments = Array.from(
        new Set([
            ...defaultDepartments,
            ...users.map(u => u.department).filter(Boolean)
        ])
    ).sort();

    const filteredUsers = users.filter(u => {
        if (roleFilter !== "all" && u.role !== roleFilter) return false;

        if (deptFilter !== "all") {
            if (!u.department) return false;
            const uDept = u.department.trim().toLowerCase();
            const fDept = deptFilter.trim().toLowerCase();
            const matches = uDept === fDept || uDept.includes(fDept) || fDept.includes(uDept);
            if (!matches) return false;
        }

        if (searchTerm.trim()) {
            const term = searchTerm.trim().toLowerCase();
            const nameMatch = (u.full_name || u.name || "").toLowerCase().includes(term);
            const emailMatch = (u.email || "").toLowerCase().includes(term);
            if (!nameMatch && !emailMatch) return false;
        }

        return true;
    });

    const resetFilters = () => {
        setRoleFilter("all");
        setDeptFilter("all");
        setSearchTerm("");
    };

    const getInitials = (name, email) => {
        const str = name || email || "?";
        return str.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    };

    return (
        <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-purple-500">
                        User Management
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-400 mt-1">
                        View, promote, demote, and manage system user permissions across departments.
                    </p>
                </div>
                <div className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-300">
                    Total Listed: <span className="text-primary font-bold">{filteredUsers.length}</span> / {users.length}
                </div>
            </div>

            {/* Filter Controls Bar */}
            <div className="card p-4 sm:p-6 mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Search User</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search by name or email..."
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
                            <option value="admin">Admin</option>
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
            ) : filteredUsers.length === 0 ? (
                <div className="card p-8 text-center border border-gray-800">
                    <p className="text-base font-semibold text-gray-400">No users found matching filters.</p>
                    <p className="text-xs text-gray-600 mt-1">Try adjusting role, department, or search query.</p>
                    <button
                        onClick={resetFilters}
                        className="mt-3 px-4 py-1.5 text-xs bg-primary/20 text-primary border border-primary/30 rounded-lg hover:bg-primary/30 transition-colors font-bold"
                    >
                        Clear Filters
                    </button>
                </div>
            ) : (
                <>
                    {/* MOBILE CARD VIEW (Visible on screens < md) */}
                    <div className="block md:hidden space-y-4">
                        {filteredUsers.map(u => (
                            <div key={u.email} className="card p-4 border border-gray-800 space-y-3 bg-[#0d0d0d]">
                                <div className="flex items-start justify-between gap-3 pb-3 border-b border-gray-800">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center shrink-0 font-bold text-sm text-primary">
                                            {getInitials(u.full_name || u.name, u.email)}
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-bold text-white text-base truncate">{u.full_name || u.name || "N/A"}</h3>
                                            <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                                                <Mail size={12} className="shrink-0 text-gray-500" />
                                                <span className="truncate">{u.email}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider shrink-0 ${
                                        u.role === 'admin' 
                                            ? 'bg-red-500/20 text-red-300 border border-red-500/30' 
                                            : u.role === 'teacher' 
                                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                                                : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                    }`}>
                                        {u.role}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between text-xs text-gray-400">
                                    <span className="flex items-center gap-1.5 text-gray-400 font-medium">
                                        <Building2 size={13} className="text-gray-500" />
                                        <span>{u.department || "General"}</span>
                                    </span>
                                </div>

                                <div className="pt-2 border-t border-gray-800/80 grid grid-cols-2 gap-2">
                                    {u.role !== "teacher" && u.role !== "admin" && (
                                        <button 
                                            onClick={() => promote(u.email, "teacher")} 
                                            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-lg hover:bg-purple-500/20 transition-colors text-xs font-semibold"
                                        >
                                            <UserCheck size={14} />
                                            <span>Make Teacher</span>
                                        </button>
                                    )}
                                    {u.role !== "admin" && (
                                        <button 
                                            onClick={() => promote(u.email, "admin")} 
                                            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors text-xs font-semibold"
                                        >
                                            <Shield size={14} />
                                            <span>Make Admin</span>
                                        </button>
                                    )}

                                    {u.role !== "student" && (
                                        <button 
                                            onClick={() => handleDemote(u)} 
                                            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg hover:bg-amber-500/20 transition-colors text-xs font-semibold"
                                        >
                                            <ArrowDownRight size={14} />
                                            <span>Demote Role</span>
                                        </button>
                                    )}

                                    <button 
                                        onClick={() => removeUser(u.email)} 
                                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors text-xs font-semibold col-span-2 sm:col-span-1"
                                    >
                                        <Trash2 size={14} />
                                        <span>Remove User</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* DESKTOP TABLE VIEW (Visible on screens >= md) */}
                    <div className="hidden md:block card p-0 overflow-hidden border border-gray-800 shadow-xl">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-white/5 border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                                <tr>
                                    <th className="p-4 font-semibold">User Details</th>
                                    <th className="p-4 font-semibold">Role</th>
                                    <th className="p-4 font-semibold">Department</th>
                                    <th className="p-4 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/60 font-light text-gray-300">
                                {filteredUsers.map(u => (
                                    <tr key={u.email} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4">
                                            <div className="font-bold text-white text-sm">{u.full_name || u.name || "N/A"}</div>
                                            <div className="text-xs text-gray-400 font-mono mt-0.5">{u.email}</div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2.5 py-1 rounded-md text-[11px] uppercase font-bold tracking-wider inline-block ${
                                                u.role === 'admin' 
                                                    ? 'bg-red-500/20 text-red-300 border border-red-500/30' 
                                                    : u.role === 'teacher' 
                                                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                                                        : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                            }`}>
                                                {u.role}
                                            </span>
                                        </td>
                                        <td className="p-4 text-xs text-gray-400">
                                            {u.department || "-"}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex flex-wrap justify-end gap-2">
                                                {u.role !== "teacher" && u.role !== "admin" && (
                                                    <button 
                                                        onClick={() => promote(u.email, "teacher")} 
                                                        className="flex items-center gap-1 px-3 py-1.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded hover:bg-purple-500/20 transition-colors text-xs font-semibold"
                                                    >
                                                        <UserCheck size={13} />
                                                        <span>Make Teacher</span>
                                                    </button>
                                                )}
                                                {u.role !== "admin" && (
                                                    <button 
                                                        onClick={() => promote(u.email, "admin")} 
                                                        className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded hover:bg-red-500/20 transition-colors text-xs font-semibold"
                                                    >
                                                        <Shield size={13} />
                                                        <span>Make Admin</span>
                                                    </button>
                                                )}

                                                {u.role !== "student" && (
                                                    <button 
                                                        onClick={() => handleDemote(u)} 
                                                        className="flex items-center gap-1 px-3 py-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded hover:bg-amber-500/20 transition-colors text-xs font-semibold"
                                                    >
                                                        <ArrowDownRight size={13} />
                                                        <span>Demote</span>
                                                    </button>
                                                )}

                                                <button 
                                                    onClick={() => removeUser(u.email)} 
                                                    className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded hover:bg-red-500/20 transition-colors text-xs font-semibold"
                                                >
                                                    <Trash2 size={13} />
                                                    <span>Remove</span>
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
