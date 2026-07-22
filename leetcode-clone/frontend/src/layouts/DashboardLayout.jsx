import { useContext } from "react";
import Sidebar from "../components/Sidebar";
import { AuthContext } from "../context/authStore";

export default function DashboardLayout({ children }) {
    const { role } = useContext(AuthContext);

    // Only show sidebar/header for teacher, admin and master_admin
    const showSidebar = role === "teacher" || role === "admin" || role === "master_admin";

    return (
        <div className="flex flex-col md:flex-row min-h-screen h-screen bg-background text-white overflow-hidden">
            {showSidebar && <Sidebar />}

            <main className={`flex-1 overflow-y-auto relative w-full ${showSidebar ? "md:ml-64" : ""}`}>
                <div className="min-h-full pb-12">
                    {children}
                </div>
            </main>
        </div>
    );
}
