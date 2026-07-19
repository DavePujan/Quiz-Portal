import { useContext } from "react";
import Sidebar from "../components/Sidebar";
import { AuthContext } from "../context/authStore";

export default function DashboardLayout({ children }) {
    const { role } = useContext(AuthContext);

    // Only show sidebar for teacher, admin and master_admin
    const showSidebar = role === "teacher" || role === "admin" || role === "master_admin";

    return (
        <div className="flex h-screen bg-background text-white overflow-hidden">
            {showSidebar && <Sidebar />}

            <main className={`flex-1 overflow-y-auto relative ${showSidebar ? "md:ml-64" : ""}`}>
                {/* 
                    Wrapper for content padding. 
                    We remove the old Navbar from inside here if we want sidebar-only nav, 
                    OR keep the top navbar for mobile/profile actions. 
                    For now, let's look at App.jsx to see how Navbar is used.
                */}
                <div className="min-h-full">
                    {children}
                </div>
            </main>
        </div>
    );
}
