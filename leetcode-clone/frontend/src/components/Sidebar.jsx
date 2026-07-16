import { Link, useLocation } from "react-router-dom";
// import { LayoutDashboard, PlusCircle, FileText, Users, Settings, LogOut, ShieldAlert } from "lucide-react";
import { useContext } from "react";
import { AuthContext } from "../context/authStore";

export default function Sidebar() {
    const { role, logout } = useContext(AuthContext);
    const location = useLocation();

    const isActive = (path) => location.pathname === path;

    const navItemClass = (path) => `
        flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 mb-1
        ${isActive(path)
            ? "bg-primary text-white shadow-lg shadow-primary/25 font-medium"
            : "text-gray-400 hover:bg-white/5 hover:text-white"
        }
    `;

    return (
        <aside className="w-64 h-screen fixed left-0 top-0 bg-[#0a0a0a] border-r border-gray-800 flex-col z-40 hidden md:flex">
            {/* Logo Area */}
            <div className="p-6 border-b border-gray-800/50">
                <Link to="/" className="text-2xl font-bold bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-purple-500 tracking-tight">
                    QuizPortal
                </Link>
                <div className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-semibold">{role} Workspace</div>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 p-4 overflow-y-auto">
                {role === "teacher" && (
                    <>
                        <div className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3 px-2 mt-2">Manage</div>
                        <Link to="/teacher" className={navItemClass("/teacher")}>
                            {/* <LayoutDashboard size={20} /> */}
                            <span>[D] </span>
                            <span>Dashboard</span>
                        </Link>
                        <Link to="/teacher/create-quiz" className={navItemClass("/teacher/create-quiz")}>
                            {/* <PlusCircle size={20} /> */}
                            <span>[+] </span>
                            <span>Create Quiz</span>
                        </Link>
                        <Link to="/teacher/evaluations" className={navItemClass("/teacher/evaluations")}>
                            {/* <FileText size={20} /> */}
                            <span>[E] </span>
                            <span>Evaluations</span>
                        </Link>
                        <Link to="/teacher/settings" className={navItemClass("/teacher/settings")}>
                            {/* <Settings size={20} /> */}
                            <span>[S] </span>
                            <span>Settings</span>
                        </Link>
                    </>
                )}

                {role === "admin" && (
                    <>
                        <div className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3 px-2 mt-2">System</div>
                        <Link to="/admin" className={navItemClass("/admin")}>
                            {/* <LayoutDashboard size={20} /> */}
                            <span>[O] </span>
                            <span>Overview</span>
                        </Link>
                        <Link to="/admin/requests" className={navItemClass("/admin/requests")}>
                            {/* <ShieldAlert size={20} /> */}
                            <span>[R] </span>
                            <span>Access Requests</span>
                        </Link>
                        <Link to="/admin/users" className={navItemClass("/admin/users")}>
                            {/* <Users size={20} /> */}
                            <span>[U] </span>
                            <span>Users</span>
                        </Link>
                        <Link to="/admin/settings" className={navItemClass("/admin/settings")}>
                            {/* <Settings size={20} /> */}
                            <span>[S] </span>
                            <span>Settings</span>
                        </Link>
                    </>
                )}
            </nav>

            {/* User Profile / Logout */}
            <div className="p-4 border-t border-gray-800/50 bg-[#050505]">
                <button
                    onClick={logout}
                    className="flex items-center gap-3 w-full px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20"
                >
                    {/* <LogOut size={20} /> */}
                    <span>Sign Out</span>
                </button>
            </div>
        </aside>
    );
}
