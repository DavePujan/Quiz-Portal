import { Navigate } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../context/authStore";

export default function ProtectedRoute({ children, role }) {
    const { token, role: userRole, isAuthReady } = useContext(AuthContext);

    if (!isAuthReady) return null;
    if (!token) return <Navigate to="/login" replace />;
    if (role && role !== userRole) {
        const fallback = userRole === "teacher" ? "/teacher" : userRole === "admin" ? "/admin" : "/student/dashboard";
        return <Navigate to={fallback} replace />;
    }

    return children;
}
