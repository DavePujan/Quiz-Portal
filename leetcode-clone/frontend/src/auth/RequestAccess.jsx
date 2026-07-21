import { useState, useEffect } from "react";
import axios from "axios";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import api from "../utils/api";
import { API_BASE_URL } from "../config/api";

export default function RequestAccess() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("student");
    const [department, setDepartment] = useState("");
    const [institutionId, setInstitutionId] = useState("");
    const [provider, setProvider] = useState("local");

    const [institutions, setInstitutions] = useState([]);
    const [msg, setMsg] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        const e = searchParams.get("email");
        const p = searchParams.get("provider");
        if (e) setEmail(e);
        if (p) setProvider(p);

        // Fetch institutions list
        axios.get(`${API_BASE_URL}/auth/institutions`)
            .then(res => setInstitutions(res.data))
            .catch(err => console.error("Error fetching institutions:", err));
    }, [searchParams]);

    async function submit(e) {
        e.preventDefault();
        setMsg("");
        setError("");

        try {
            const res = await axios.post(`${API_BASE_URL}/auth/request-access`, {
                email, name, role, department, provider, password, institutionId
            });
            setMsg(res.data.message);
            // Optionally redirect after some time
            setTimeout(() => navigate("/login"), 3000);
        } catch (err) {
            setError(err.response?.data?.error || "Submission failed");
        }
    }

    return (
        <div className="flex min-h-screen w-full bg-background font-sans overflow-y-auto">
            {/* Left Side - Hero / Branding (Hidden on mobile, Same as Login for consistency) */}
            <div className="hidden lg:flex flex-col justify-center items-center w-1/2 relative bg-[#0a0a0a]">
                <div className="absolute inset-0 bg-linear-to-br from-purple-900/20 to-blue-900/20 z-0"></div>
                <div className="z-10 text-center px-12">
                    <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-linear-to-r from-purple-400 to-blue-500 mb-6 drop-shadow-2xl">
                        Join the Community
                    </h1>
                    <p className="text-xl text-gray-300 font-light leading-relaxed">
                        Request access to start your journey. <br />
                        <span className="text-gray-500 text-sm mt-4 block">Approval required by Administrator.</span>
                    </p>
                </div>
                <div className="absolute top-20 left-20 w-72 h-72 bg-purple-600/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl"></div>
            </div>

            {/* Right Side - Request Form */}
            <div className="flex-1 flex flex-col justify-center items-center p-8 bg-background relative w-full">
                <div className="glass w-full max-w-lg p-10 rounded-2xl relative z-10 border border-gray-800 my-10">
                    <div className="mb-6 text-center">
                        <h2 className="text-3xl font-bold text-white mb-2">Request Access</h2>
                        <p className="text-gray-400 text-sm">Fill in your details to get started</p>
                    </div>

                    {msg && <div className="bg-emerald-500/10 border border-emerald-500/50 text-emerald-200 p-3 rounded mb-6 text-center text-sm">{msg}</div>}
                    {error && <div className="bg-red-500/10 border border-red-500/50 text-red-200 p-3 rounded mb-6 text-center text-sm">{error}</div>}

                    <form onSubmit={submit} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Email</label>
                            <input
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                disabled={!!searchParams.get("email")}
                                required
                                className="input disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Full Name</label>
                            <input
                                value={name}
                                onChange={e => setName(e.target.value)}
                                required
                                className="input"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Password {provider !== 'local' && '(Optional for OAuth)'}</label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Set a secure password"
                                required={provider === 'local'}
                                className="input"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Select Institution</label>
                            <select
                                value={institutionId}
                                onChange={e => setInstitutionId(e.target.value)}
                                required
                                className="input py-3"
                            >
                                <option value="">Select Institution</option>
                                {institutions.map(inst => (
                                    <option key={inst.id} value={inst.id}>{inst.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {role !== 'admin' && (
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Department</label>
                                    <select
                                        value={department}
                                        onChange={e => setDepartment(e.target.value)}
                                        className="input py-3"
                                    >
                                        <option value="">Select Dept</option>
                                        <option value="Biomedical Engineering">Biomedical</option>
                                        <option value="Computer Engineering">Computer</option>
                                        <option value="Electronics & Communication Engineering">ECE</option>
                                        <option value="Information Technology">IT</option>
                                        <option value="Mechanical Engineering">Mechanical</option>
                                        <option value="Civil Engineering">Civil</option>
                                        <option value="Electrical Engineering">Electrical</option>
                                        <option value="General Department">General</option>
                                    </select>
                                </div>
                            )}
                            <div className={`space-y-1 ${role === 'admin' ? 'col-span-2' : ''}`}>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Role</label>
                                <select
                                    value={role}
                                    onChange={e => {
                                        setRole(e.target.value);
                                        if (e.target.value === 'admin') {
                                            setDepartment("");
                                        }
                                    }}
                                    className="input py-3"
                                >
                                    <option value="student">Student</option>
                                    <option value="teacher">Teacher</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                        </div>

                        {provider !== 'local' && (
                            <div className="text-center text-sm text-gray-500 italic">
                                Authenticating via: <span className="font-bold text-white uppercase">{provider}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            className="btn-primary w-full mt-6 shadow-lg shadow-purple-500/20"
                        >
                            Submit Request
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <Link to="/login" className="text-sm text-gray-400 hover:text-white transition-colors">
                            Already have an account? <span className="text-primary font-bold">Log in</span>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
