import { useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { API_BASE_URL } from "../config/api";

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage("");
        setError("");
        setLoading(true);

        try {
            const res = await axios.post(`${API_BASE_URL}/auth/forgot-password`, { email });
            setMessage(res.data.message);
        } catch (err) {
            setError(err.response?.data?.error || "Failed to send reset link");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex justify-center items-center px-4 py-8 md:p-12 min-h-screen bg-background">
            <div className="absolute inset-0 bg-linear-to-br from-purple-900/10 to-blue-900/10 z-0 pointer-events-none"></div>

            <div className="glass w-full max-w-md p-8 rounded-2xl relative z-10 border border-gray-800">
                <h2 className="text-3xl font-bold text-white mb-2 text-center">Forgot Password?</h2>
                <p className="text-gray-400 text-sm mb-8 text-center">Enter your email and we'll send you a link to reset your password.</p>

                {message && <div className="bg-emerald-500/10 border border-emerald-500/50 text-emerald-200 p-3 rounded mb-6 text-sm text-center">{message}</div>}
                {error && <div className="bg-red-500/10 border border-red-500/50 text-red-200 p-3 rounded mb-6 text-sm text-center">{error}</div>}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Email Address</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="input"
                            placeholder="name@example.com"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary w-full flex justify-center items-center gap-2"
                    >
                        {loading ? "Sending..." : "Send Reset Link"}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <Link to="/login" className="text-sm text-gray-400 hover:text-white transition-colors">
                        Back to <span className="text-primary font-bold">Login</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}
