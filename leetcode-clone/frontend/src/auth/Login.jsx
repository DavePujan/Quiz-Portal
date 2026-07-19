import { useState, useContext, useEffect } from "react";
import { AuthContext } from "../context/authStore";
import axios from "axios";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
// import { LogIn, Github, Mail } from "lucide-react"; // Removed: Using inline SVGs instead


// Note: Ensure lucide-react is installed or remove icon usage if fails. 
// Assuming lucide-react might not be installed, I will use text or SVGs if needed.
// Checking package.json... lucide-react was NOT in dependencies. 
// I will use simple SVG icons inline to avoid dependency issues for now.

const GoogleIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
);

const GithubIcon = () => (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
);

export default function Login() {
    const { login, role, isAuthReady } = useContext(AuthContext);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // Redirect if already logged in
    useEffect(() => {
        if (!isAuthReady) return;
        if (role) {
            if (role === 'teacher') navigate("/teacher");
            else if (role === 'admin') navigate("/admin");
            else if (role === 'master_admin') navigate("/master");
            else navigate("/student/dashboard");
        }
    }, [role, navigate, isAuthReady]);

    useEffect(() => {
        const r = searchParams.get("role");
        if (r) {
            login(r);
            // Navigation handled by above useEffect when role updates
        }
    }, [searchParams, login]);

    async function submit() {
        try {
            const res = await axios.post("http://localhost:5000/auth/login", {
                email,
                password
            }, { withCredentials: true });

            login(res.data.role);

            if (res.data.role === 'teacher') navigate("/teacher");
            else if (res.data.role === 'admin') navigate("/admin");
            else if (res.data.role === 'master_admin') navigate("/master");
            else navigate("/student/dashboard");

        } catch (err) {
            if (err.response?.data?.requestAccess) {
                setError(<span className="text-sm text-red-300">User not found. <a href="/request-access" className="text-primary hover:underline font-bold">Request Access</a></span>);
            } else {
                setError(err.response?.data?.error || "Login failed");
            }
        }
    }

    return (
        <div className="flex h-screen w-full bg-background font-sans overflow-hidden">
            {/* Left Side - Hero / Branding */}
            <div className="hidden lg:flex flex-col justify-center items-center w-1/2 relative bg-[#0a0a0a]">
                <div className="absolute inset-0 bg-linear-to-br from-blue-900/20 to-purple-900/20 z-0"></div>
                <div className="z-10 text-center px-12">
                    <h1 className="text-6xl font-extrabold text-transparent bg-clip-text bg-linear-to-r from-blue-400 to-purple-500 mb-6 drop-shadow-2xl">
                        QuizPortal
                    </h1>
                    <p className="text-2xl text-gray-300 font-light leading-relaxed">
                        Master your skills. <br /> <span className="text-blue-400 font-medium">Create.</span> <span className="text-purple-400 font-medium">Attempt.</span> <span className="text-green-400 font-medium">Conquer.</span>
                    </p>
                </div>
                {/* Abstract Decorative Circles */}
                <div className="absolute top-20 left-20 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl"></div>
            </div>

            {/* Right Side - Login Form */}
            <div className="flex-1 flex flex-col justify-center items-center p-8 bg-background relative">
                {/* Mobile Gradient Background for touch of color */}
                <div className="lg:hidden absolute inset-0 bg-linear-to-b from-blue-900/10 to-transparent pointer-events-none"></div>

                <div className="glass w-full max-w-md p-10 rounded-2xl relative z-10 border border-gray-800">
                    <div className="mb-8 text-center">
                        <h2 className="text-3xl font-bold text-white mb-2">Welcome Back</h2>
                        <p className="text-gray-400 text-sm">Sign in to your account</p>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/50 text-red-200 p-3 rounded mb-6 text-center text-sm">
                            {error}
                        </div>
                    )}

                    <div className="space-y-5">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Email</label>
                            <input
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="student@example.com"
                                className="input"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="input"
                            />
                        </div>

                        <div className="flex justify-end">
                            <Link to="/forgot-password" className="text-xs text-primary hover:text-white transition-colors">
                                Forgot Password?
                            </Link>
                        </div>

                        <div className="text-center text-sm text-gray-400">
                            New here?{" "}
                            <Link to="/request-access" className="text-primary hover:text-white font-semibold transition-colors">
                                Register
                            </Link>
                        </div>

                        <button
                            type="submit"
                            onClick={submit}
                            className="btn-primary w-full mt-2 shadow-lg shadow-purple-500/20"
                        >
                            Log In
                        </button>
                    </div>

                    <div className="relative my-8">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-700"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-background-layer1 text-gray-500">Or continue with</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => window.location.href = "http://localhost:5000/auth/google"}
                            className="flex items-center justify-center gap-2 bg-[#252526] hover:bg-[#2d2d2d] text-white py-3 rounded-lg border border-gray-700 transition"
                        >
                            <GoogleIcon />
                            <span>Google</span>
                        </button>
                        <button
                            onClick={() => window.location.href = "http://localhost:5000/auth/github"}
                            className="flex items-center justify-center gap-2 bg-[#252526] hover:bg-[#2d2d2d] text-white py-3 rounded-lg border border-gray-700 transition"
                        >
                            <GithubIcon />
                            <span>GitHub</span>
                        </button>
                    </div>

                    <div className="mt-8 text-center text-xs text-gray-600">
                        <p className="mb-2 uppercase tracking-widest font-bold">Demo Credentials</p>
                        <div className="flex justify-center gap-4">
                            <span className="cursor-pointer hover:text-gray-400" onClick={() => { setEmail("teacher@test.com"); setPassword("password"); }}>Teacher</span>
                            <span className="cursor-pointer hover:text-gray-400" onClick={() => { setEmail("student@test.com"); setPassword("password"); }}>Student</span>
                            <span className="cursor-pointer hover:text-gray-400" onClick={() => { setEmail("admin@test.com"); setPassword("password"); }}>Admin</span>
                            <span className="cursor-pointer hover:text-gray-400" onClick={() => { setEmail("master@test.com"); setPassword("password"); }}>Master Admin</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
