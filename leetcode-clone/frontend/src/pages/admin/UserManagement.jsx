import React, { useEffect, useState } from "react";
import { getUsers, promoteUser, deleteUser } from "../../utils/api";
import { Search, RotateCcw, UserCheck, Shield, ArrowDownRight, Trash2 } from "lucide-react";

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
            .then(() => {
                fetchUsers();
            })
            .catch(err => alert("Failed to update: " + err.message));
    };

    const removeUser = (email) => {
        if (!confirm(`Are you sure you want to remove access for ${email}? This action is irreversible.`)) return;

        deleteUser(email)
            .then(() => {
                fetchUsers();
            })
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

    // Dynamically collect unique departments from users + default list
    const allDepartments = Array.from(
        new Set([
            ...defaultDepartments,
            ...users.map(u => u.department).filter(Boolean)
        ])
    ).sort();

    // Flexible case-insensitive matching
    const filteredUsers = users.filter(u => {
        // Role match
        if (roleFilter !== "all" && u.role !== roleFilter) return false;

        // Department match (case-insensitive & trimmed)
        if (deptFilter !== "all") {
            if (!u.department) return false;
            const uDept = u.department.trim().toLowerCase();
            const fDept = deptFilter.trim().toLowerCase();
            const matches = uDept === fDept || uDept.includes(fDept) || fDept.includes(uDept);
            if (!matches) return false;
        }

        // Search Keyword match (Name or Email)
        if (searchTerm.trim()) {
            const term = searchTerm.trim().toLowerCase();
            const nameMatch = (u.full_name || "").toLowerCase().includes(term);
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

            {/* Filter Bar */}
            <div className="card p-4 sm:p-6 mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    {/* Search Input */}
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

                    {/* Role Filter */}
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

                    {/* Department Filter */}
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

                    {/* Reset Button */}
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

            {/* Users Table Card */}
            <div className="card p-0 overflow-hidden border border-gray-800 shadow-xl">
                {loading ? (
                    <div className="flex justify-center items-center py-16">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : (
                    <div className="overflow-x-auto w-full">
                        <table className="w-full text-left border-collapse min-w-[700px]">
                            <thead className="bg-white/5 border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                                <tr>
                                    <th className="p-4 font-semibold">User Details</th>
                                    <th className="p-4 font-semibold">Role</th>
                                    <th className="p-4 font-semibold">Department</th>
                                    <th className="p-4 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/60 font-light text-gray-300">
                                {filteredUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="p-8 text-center text-gray-500">
                                            <p className="text-base font-semibold text-gray-400">No users found matching filters.</p>
                                            <p className="text-xs text-gray-600 mt-1">Try resetting or adjusting role, department, or search query.</p>
                                            <button
                                                onClick={resetFilters}
                                                className="mt-3 px-4 py-1.5 text-xs bg-primary/20 text-primary border border-primary/30 rounded-lg hover:bg-primary/30 transition-colors font-bold"
                                            >
                                                Clear Filters
                                            </button>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredUsers.map(u => (
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
                                                <div className="flex flex-wrap justify-end gap-1.5">
                                                    {u.role !== "teacher" && u.role !== "admin" && (
                                                        <button 
                                                            onClick={() => promote(u.email, "teacher")} 
                                                            className="flex items-center gap-1 px-2.5 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded hover:bg-purple-500/20 transition-colors text-xs font-semibold"
                                                            title="Promote to Teacher"
                                                        >
                                                            <UserCheck size={12} />
                                                            <span>Make Teacher</span>
                                                        </button>
                                                    )}
                                                    {u.role !== "admin" && (
                                                        <button 
                                                            onClick={() => promote(u.email, "admin")} 
                                                            className="flex items-center gap-1 px-2.5 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded hover:bg-red-500/20 transition-colors text-xs font-semibold"
                                                            title="Promote to Admin"
                                                        >
                                                            <Shield size={12} />
                                                            <span>Make Admin</span>
                                                        </button>
                                                    )}

                                                    {u.role !== "student" && (
                                                        <button 
                                                            onClick={() => handleDemote(u)} 
                                                            className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded hover:bg-amber-500/20 transition-colors text-xs font-semibold"
                                                            title="Demote Role"
                                                        >
                                                            <ArrowDownRight size={12} />
                                                            <span>Demote</span>
                                                        </button>
                                                    )}

                                                    <button 
                                                        onClick={() => removeUser(u.email)} 
                                                        className="flex items-center gap-1 px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded hover:bg-red-500/20 transition-colors text-xs font-semibold"
                                                        title="Delete User"
                                                    >
                                                        <Trash2 size={12} />
                                                        <span className="hidden sm:inline">Remove</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
