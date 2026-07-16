import { useEffect, useContext } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthContext } from "../context/authStore";

export default function OAuthSuccess() {
    const [searchParams] = useSearchParams();
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();

    useEffect(() => {
        const role = searchParams.get("role");

        if (role) {
            login(role);

            // Redirect based on role
            if (role === 'teacher') setTimeout(() => navigate("/teacher"), 500);
            else if (role === 'admin') setTimeout(() => navigate("/admin"), 500);
            else setTimeout(() => navigate("/"), 500);
        } else {
            navigate("/login");
        }
    }, [searchParams, login, navigate]);

    return <div>Logging you in...</div>;
}
