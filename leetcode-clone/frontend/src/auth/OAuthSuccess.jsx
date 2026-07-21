import { useEffect, useContext } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthContext } from "../context/authStore";

export default function OAuthSuccess() {
    const [searchParams] = useSearchParams();
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();

    useEffect(() => {
        const role = searchParams.get("role");
        const token = searchParams.get("token");

        if (token) {
            localStorage.setItem("token", token);
        }

        if (role) {
            login(role);

            // Redirect based on role
            if (role === 'teacher') setTimeout(() => navigate("/teacher"), 300);
            else if (role === 'admin') setTimeout(() => navigate("/admin"), 300);
            else if (role === 'master_admin') setTimeout(() => navigate("/master"), 300);
            else setTimeout(() => navigate("/student/dashboard"), 300);
        } else {
            navigate("/login");
        }
    }, [searchParams, login, navigate]);

    return (
        <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center text-white font-sans p-4">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-200">Logging you in to QuizPortal...</h2>
            <p className="text-sm text-gray-400 mt-2">Authenticating your account credentials...</p>
        </div>
    );
}
