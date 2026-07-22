import { Navigate } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../context/authStore";

export default function ProtectedRoute({ children, role }) {
    const { token, role: userRole, isAuthReady } = useContext(AuthContext);

    if (!isAuthReady) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center text-white font-sans">
                <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-primary mb-3"></div>
                <span className="text-xs text-gray-400 font-medium tracking-wide">Loading QuizPortal...</span>
            </div>
        );
    }
    if (!token) return <Navigate to="/login" replace />;
    if (role && role !== userRole) {
        const fallback = userRole === "teacher" ? "/teacher" : userRole === "admin" ? "/admin" : "/student/dashboard";
        return <Navigate to={fallback} replace />;
    }

    return children;
}
