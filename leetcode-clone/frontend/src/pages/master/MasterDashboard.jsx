import React, { useState, useEffect } from "react";
import {
    getMasterStats,
    getMasterInstitutes,
    createInstitute,
    getMasterAdmins,
    assignAdmin,
    removeAdmin,
    getMasterSettings,
    updateMasterSettings,
    getMasterRequests,
    approveMasterRequest,
    rejectMasterRequest
} from "../../utils/api";

export default function MasterDashboard() {
    const [activeTab, setActiveTab] = useState("overview");
    const [stats, setStats] = useState({
        institutes: 0,
        admins: 0,
        teachers: 0,
        students: 0,
        maintenanceMode: false,
        dbConnected: true,
        redisConnected: false
    });

    const [institutes, setInstitutes] = useState([]);
    const [admins, setAdmins] = useState([]);
    const [requests, setRequests] = useState([]);
    
    // Requests Filter States
    const [reqInstFilter, setReqInstFilter] = useState("all");
    const [reqSearchQuery, setReqSearchQuery] = useState("");
    
    // Form States
    const [newInst, setNewInst] = useState({
        name: "",
        code: "",
        logoUrl: "",
        website: "",
        country: "India",
        state: "",
        city: "",
        timezone: "Asia/Kolkata"
    });
    const [newAdmin, setNewAdmin] = useState({ email: "", name: "", institutionId: "" });
    
    // Status states
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [message, setMessage] = useState({ text: "", type: "" });

    useEffect(() => {
        loadOverview();
    }, []);

    const showMsg = (text, type = "success") => {
        setMessage({ text, type });
        setTimeout(() => setMessage({ text: "", type: "" }), 4000);
    };

    const loadOverview = async () => {
        try {
            setLoading(true);
            const res = await getMasterStats();
            setStats(res.data);
        } catch (err) {
            console.error(err);
            showMsg("Failed to load statistics.", "error");
        } finally {
            setLoading(false);
        }
    };

    const loadInstitutes = async () => {
        try {
            setLoading(true);
            const res = await getMasterInstitutes();
            setInstitutes(res.data);
        } catch (err) {
            console.error(err);
            showMsg("Failed to load institutes.", "error");
        } finally {
            setLoading(false);
        }
    };

    const loadAdmins = async () => {
        try {
            setLoading(true);
            const res = await getMasterAdmins();
            setAdmins(res.data);
        } catch (err) {
            console.error(err);
            showMsg("Failed to load admins list.", "error");
        } finally {
            setLoading(false);
        }
    };

    const loadRequests = async () => {
        try {
            setLoading(true);
            const res = await getMasterRequests();
            setRequests(res.data);
        } catch (err) {
            console.error(err);
            showMsg("Failed to load admin requests.", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        if (tab === "overview") loadOverview();
        if (tab === "institutes") loadInstitutes();
        if (tab === "admins") {
            loadAdmins();
            loadInstitutes(); // Needed for dropdown
        }
        if (tab === "requests") {
            loadRequests();
            loadInstitutes(); // Needed for filtering dropdown
        }
    };

    const handleCreateInstitute = async (e) => {
        e.preventDefault();
        if (!newInst.name || !newInst.code) return showMsg("Name and Code are required.", "error");
        try {
            setActionLoading(true);
            await createInstitute(newInst);
            showMsg(`Institute "${newInst.name}" created successfully with default configurations!`);
            setNewInst({
                name: "",
                code: "",
                logoUrl: "",
                website: "",
                country: "India",
                state: "",
                city: "",
                timezone: "Asia/Kolkata"
            });
            loadInstitutes();
        } catch (err) {
            console.error(err);
            showMsg(err.response?.data?.error || "Failed to create institute.", "error");
        } finally {
            setActionLoading(false);
        }
    };

    const handleAssignAdmin = async (e) => {
        e.preventDefault();
        if (!newAdmin.email || !newAdmin.institutionId) return showMsg("Email and Institution are required.", "error");
        try {
            setActionLoading(true);
            await assignAdmin(newAdmin);
            showMsg(`Admin assigned successfully!`);
            setNewAdmin({ email: "", name: "", institutionId: "" });
            loadAdmins();
        } catch (err) {
            console.error(err);
            showMsg(err.response?.data?.error || "Failed to assign admin.", "error");
        } finally {
            setActionLoading(false);
        }
    };

    const handleRemoveAdmin = async (membershipId) => {
        if (!confirm("Are you sure you want to remove this admin membership?")) return;
        try {
            setActionLoading(true);
            await removeAdmin(membershipId);
            showMsg("Admin membership removed successfully.");
            loadAdmins();
        } catch (err) {
            console.error(err);
            showMsg("Failed to remove admin.", "error");
        } finally {
            setActionLoading(false);
        }
    };

    const toggleMaintenance = async (checked) => {
        try {
            setActionLoading(true);
            await updateMasterSettings({ maintenanceMode: checked });
            setStats(current => ({ ...current, maintenanceMode: checked }));
            showMsg(`Maintenance mode ${checked ? "enabled" : "disabled"}.`);
        } catch (err) {
            console.error(err);
            showMsg("Failed to update maintenance mode.", "error");
        } finally {
            setActionLoading(false);
        }
    };

    const handleApproveRequest = async (email) => {
        try {
            setActionLoading(true);
            await approveMasterRequest(email);
            showMsg("Admin access request approved!");
            loadRequests();
        } catch (err) {
            console.error(err);
            showMsg("Failed to approve request.", "error");
        } finally {
            setActionLoading(false);
        }
    };

    const handleRejectRequest = async (email) => {
        if (!confirm("Are you sure you want to reject and remove this request?")) return;
        try {
            setActionLoading(true);
            await rejectMasterRequest(email);
            showMsg("Admin access request rejected.");
            loadRequests();
        } catch (err) {
            console.error(err);
            showMsg("Failed to reject request.", "error");
        } finally {
            setActionLoading(false);
        }
    };

    const selectedInst = institutes.find(i => String(i.id) === String(newAdmin.institutionId));
    const selectedInstName = selectedInst ? selectedInst.name : "";

    const filteredAdmins = newAdmin.institutionId
        ? admins.filter(adm => String(adm.institution_id) === String(newAdmin.institutionId))
        : [];

    const filteredRequests = requests.filter(req => {
        if (reqInstFilter !== "all" && String(req.institution_id) !== String(reqInstFilter)) return false;
        if (reqSearchQuery.trim()) {
            const query = reqSearchQuery.toLowerCase();
            const nameMatch = req.name?.toLowerCase().includes(query);
            const emailMatch = req.email?.toLowerCase().includes(query);
            if (!nameMatch && !emailMatch) return false;
        }
        return true;
    });

    return (
        <div className="p-6 max-w-7xl mx-auto font-sans text-white">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-gray-800 mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-linear-to-r from-purple-400 to-indigo-500">
                        Master Management Console
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">Configure global settings, add institutions, and manage administrators.</p>
                </div>

                {/* Maintenance Mode Toggle Switch */}
                <div className="bg-[#18181b] border border-gray-800 rounded-xl px-5 py-3 flex items-center justify-between gap-6 shadow-md">
                    <div>
                        <div className="text-sm font-semibold text-white">Global Maintenance Mode</div>
                        <div className="text-xs text-gray-500">Restrict access to Master Admin only</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={stats.maintenanceMode} 
                            disabled={actionLoading}
                            onChange={(e) => toggleMaintenance(e.target.checked)} 
                            className="sr-only peer" 
                        />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                </div>
            </div>

            {/* Notification Toast */}
            {message.text && (
                <div className={`p-4 mb-6 rounded-lg border text-sm flex items-center justify-center transition-all ${
                    message.type === "error" 
                        ? "bg-red-500/10 border-red-500/50 text-red-200" 
                        : "bg-green-500/10 border-green-500/50 text-green-200"
                }`}>
                    {message.text}
                </div>
            )}

            {/* Tab Navigation */}
            <div className="flex border-b border-gray-800 mb-6 gap-2">
                {["overview", "institutes", "admins", "requests"].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => handleTabChange(tab)}
                        className={`px-5 py-3 text-sm font-medium border-b-2 capitalize transition-all ${
                            activeTab === tab 
                                ? "border-purple-500 text-purple-400" 
                                : "border-transparent text-gray-400 hover:text-white"
                        }`}
                    >
                        {tab === "requests" ? "Requests" : tab}
                    </button>
                ))}
            </div>

            {/* Content */}
            {loading && <div className="text-purple-400 text-center py-10 animate-pulse">Loading data...</div>}

            {!loading && activeTab === "overview" && (
                <div className="space-y-8">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="bg-[#18181b] border border-gray-800 p-6 rounded-xl shadow-lg">
                            <div className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-2">Institutions</div>
                            <div className="text-4xl font-extrabold text-white">{stats.institutes}</div>
                            <div className="text-xs text-gray-500 mt-2">Active educational centers</div>
                        </div>
                        <div className="bg-[#18181b] border border-gray-800 p-6 rounded-xl shadow-lg">
                            <div className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-2">System Admins</div>
                            <div className="text-4xl font-extrabold text-white">{stats.admins}</div>
                            <div className="text-xs text-gray-500 mt-2">Local institution administrators</div>
                        </div>
                        <div className="bg-[#18181b] border border-gray-800 p-6 rounded-xl shadow-lg">
                            <div className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-2">Total Instructors</div>
                            <div className="text-4xl font-extrabold text-white">{stats.teachers}</div>
                            <div className="text-xs text-gray-500 mt-2">Faculties building evaluations</div>
                        </div>
                        <div className="bg-[#18181b] border border-gray-800 p-6 rounded-xl shadow-lg">
                            <div className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-2">Total Students</div>
                            <div className="text-4xl font-extrabold text-white">{stats.students}</div>
                            <div className="text-xs text-gray-500 mt-2">Engaged system candidates</div>
                        </div>
                    </div>

                    {/* Infrastructure Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-[#18181b] border border-gray-800 p-6 rounded-xl shadow-lg">
                            <h3 className="text-lg font-bold text-white mb-4">Infrastructure Status</h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between border-b border-gray-800/50 pb-2">
                                    <span className="text-gray-400 text-sm">Postgres Core Database</span>
                                    <span className="text-xs px-2.5 py-1 rounded bg-green-500/10 text-green-400 border border-green-500/30">ONLINE</span>
                                </div>
                                <div className="flex items-center justify-between border-b border-gray-800/50 pb-2">
                                    <span className="text-gray-400 text-sm">Redis Memory Cache</span>
                                    <span className={`text-xs px-2.5 py-1 rounded ${
                                        stats.redisConnected 
                                            ? "bg-green-500/10 text-green-400 border border-green-500/30" 
                                            : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30"
                                    }`}>{stats.redisConnected ? "ONLINE" : "OFFLINE / LOCAL FALLBACK"}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-400 text-sm">Node.js Server Stack</span>
                                    <span className="text-xs px-2.5 py-1 rounded bg-green-500/10 text-green-400 border border-green-500/30">ONLINE (Port 5000)</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-[#18181b] border border-gray-800 p-6 rounded-xl shadow-lg flex flex-col justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-white mb-2">Master Environment</h3>
                                <p className="text-gray-400 text-sm leading-relaxed">
                                    You are authenticated as the system Owner. All changes made in this dashboard reflect system-wide. Local administrators only possess rights bound to their respective institution domains.
                                </p>
                            </div>
                            <div className="text-xs text-purple-400 font-semibold bg-purple-500/5 border border-purple-500/20 p-3 rounded-lg mt-4">
                                System Maintenance mode forces all routes (except Master routes) to render a 503 error, allowing safe infrastructure configuration.
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {!loading && activeTab === "institutes" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Add Form */}
                    <div className="bg-[#18181b] border border-gray-800 p-6 rounded-xl shadow-lg h-fit">
                        <h3 className="text-lg font-bold text-pink-400 mb-4">Add Institution</h3>
                        <form onSubmit={handleCreateInstitute} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Institution Name</label>
                                <input
                                    type="text"
                                    value={newInst.name}
                                    disabled={actionLoading}
                                    onChange={(e) => setNewInst({ ...newInst, name: e.target.value })}
                                    placeholder="e.g. GEC Gandhinagar"
                                    className="input bg-[#27272a] border-gray-800 text-white w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Institution Code (Unique)</label>
                                <input
                                    type="text"
                                    value={newInst.code}
                                    disabled={actionLoading}
                                    onChange={(e) => setNewInst({ ...newInst, code: e.target.value })}
                                    placeholder="e.g. gecg"
                                    className="input bg-[#27272a] border-gray-800 text-white w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Logo URL</label>
                                <input
                                    type="text"
                                    value={newInst.logoUrl}
                                    disabled={actionLoading}
                                    onChange={(e) => setNewInst({ ...newInst, logoUrl: e.target.value })}
                                    placeholder="e.g. https://logo.com/gecg.png"
                                    className="input bg-[#27272a] border-gray-800 text-white w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Website URL</label>
                                <input
                                    type="text"
                                    value={newInst.website}
                                    disabled={actionLoading}
                                    onChange={(e) => setNewInst({ ...newInst, website: e.target.value })}
                                    placeholder="e.g. https://gecg.ac.in"
                                    className="input bg-[#27272a] border-gray-800 text-white w-full"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">City</label>
                                    <input
                                        type="text"
                                        value={newInst.city}
                                        disabled={actionLoading}
                                        onChange={(e) => setNewInst({ ...newInst, city: e.target.value })}
                                        placeholder="e.g. Gandhinagar"
                                        className="input bg-[#27272a] border-gray-800 text-white w-full"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">State</label>
                                    <input
                                        type="text"
                                        value={newInst.state}
                                        disabled={actionLoading}
                                        onChange={(e) => setNewInst({ ...newInst, state: e.target.value })}
                                        placeholder="e.g. Gujarat"
                                        className="input bg-[#27272a] border-gray-800 text-white w-full"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Country</label>
                                    <input
                                        type="text"
                                        value={newInst.country}
                                        disabled={actionLoading}
                                        onChange={(e) => setNewInst({ ...newInst, country: e.target.value })}
                                        placeholder="e.g. India"
                                        className="input bg-[#27272a] border-gray-800 text-white w-full"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Timezone</label>
                                    <input
                                        type="text"
                                        value={newInst.timezone}
                                        disabled={actionLoading}
                                        onChange={(e) => setNewInst({ ...newInst, timezone: e.target.value })}
                                        placeholder="e.g. Asia/Kolkata"
                                        className="input bg-[#27272a] border-gray-800 text-white w-full"
                                    />
                                </div>
                            </div>
                            <button type="submit" disabled={actionLoading} className="btn-primary w-full shadow-lg shadow-purple-500/10">
                                {actionLoading ? "Creating..." : "Create Institution"}
                            </button>
                        </form>
                    </div>

                    {/* Table View */}
                    <div className="bg-[#18181b] border border-gray-800 p-6 rounded-xl shadow-lg lg:col-span-2">
                        <h3 className="text-lg font-bold text-white mb-4">Institutions List</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm border-collapse">
                                <thead>
                                    <tr className="border-b border-gray-800 text-gray-400">
                                        <th className="py-3 px-4">Name</th>
                                        <th className="py-3 px-4">Code</th>
                                        <th className="py-3 px-4">Location</th>
                                        <th className="py-3 px-4">Website</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {institutes.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" className="py-8 text-center text-gray-500">No institutions registered yet.</td>
                                        </tr>
                                    ) : (
                                        institutes.map((inst) => (
                                            <tr key={inst.id} className="border-b border-gray-800/50 hover:bg-white/5 transition-colors">
                                                <td className="py-3 px-4 font-semibold text-white">
                                                    <div className="flex items-center gap-3">
                                                        {inst.logo_url && <img src={inst.logo_url} alt="" className="w-6 h-6 rounded object-contain bg-white/10" />}
                                                        <span>{inst.name}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4"><span className="bg-purple-900/20 text-purple-400 border border-purple-900/30 px-2 py-0.5 rounded text-xs font-mono">{inst.code}</span></td>
                                                <td className="py-3 px-4 text-gray-300">
                                                    {inst.city ? `${inst.city}, ` : ""}{inst.state ? `${inst.state}, ` : ""}{inst.country || "India"}
                                                </td>
                                                <td className="py-3 px-4 text-gray-400 font-mono text-xs">
                                                    {inst.website ? <a href={inst.website} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">{inst.website.replace(/^https?:\/\//, '')}</a> : "—"}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {!loading && activeTab === "admins" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Add Form */}
                    <div className="bg-[#18181b] border border-gray-800 p-6 rounded-xl shadow-lg h-fit">
                        <h3 className="text-lg font-bold text-pink-400 mb-4">Assign Admin Role</h3>
                        <form onSubmit={handleAssignAdmin} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Select Institution</label>
                                <select
                                    value={newAdmin.institutionId}
                                    disabled={actionLoading}
                                    onChange={(e) => setNewAdmin({ ...newAdmin, institutionId: e.target.value })}
                                    className="input bg-[#27272a] border-gray-800 text-white w-full"
                                >
                                    <option value="">Select Institution</option>
                                    {institutes.map((inst) => (
                                        <option key={inst.id} value={inst.id}>{inst.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Admin Email</label>
                                <input
                                    type="email"
                                    value={newAdmin.email}
                                    disabled={actionLoading}
                                    onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                                    placeholder="admin@example.com"
                                    className="input bg-[#27272a] border-gray-800 text-white w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Admin Full Name</label>
                                <input
                                    type="text"
                                    value={newAdmin.name}
                                    disabled={actionLoading}
                                    onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
                                    placeholder="e.g. John Doe"
                                    className="input bg-[#27272a] border-gray-800 text-white w-full"
                                />
                            </div>
                            <button type="submit" disabled={actionLoading} className="btn-primary w-full shadow-lg shadow-purple-500/10">
                                {actionLoading ? "Assigning..." : "Assign Local Admin"}
                            </button>
                        </form>
                    </div>

                    {/* Table View */}
                    <div className="bg-[#18181b] border border-gray-800 p-6 rounded-xl shadow-lg lg:col-span-2">
                        <h3 className="text-lg font-bold text-white mb-4">
                            System Administrators {selectedInstName ? `— ${selectedInstName}` : ""}
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm border-collapse">
                                <thead>
                                    <tr className="border-b border-gray-800 text-gray-400">
                                        <th className="py-3 px-4">Full Name</th>
                                        <th className="py-3 px-4">Email</th>
                                        <th className="py-3 px-4">Institution Bound</th>
                                        <th className="py-3 px-4 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {!newAdmin.institutionId ? (
                                        <tr>
                                            <td colSpan="4" className="py-8 text-center text-gray-500">
                                                Please select an institution on the left to view and manage its administrators.
                                            </td>
                                        </tr>
                                    ) : filteredAdmins.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" className="py-8 text-center text-gray-500">
                                                No administrators mapped to this institution yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredAdmins.map((adm) => (
                                            <tr key={adm.membership_id} className="border-b border-gray-800/50 hover:bg-white/5 transition-colors">
                                                <td className="py-3 px-4 font-semibold text-white">{adm.full_name || "—"}</td>
                                                <td className="py-3 px-4 text-gray-300 font-mono text-xs">{adm.email}</td>
                                                <td className="py-3 px-4 text-purple-400">{adm.institution_name}</td>
                                                <td className="py-3 px-4 text-center">
                                                    <button
                                                        onClick={() => handleRemoveAdmin(adm.membership_id)}
                                                        disabled={actionLoading}
                                                        className="text-xs bg-red-950/20 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-950/30 hover:border-red-500/30 px-3 py-1 rounded transition-colors"
                                                    >
                                                        {actionLoading ? "..." : "Revoke"}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {!loading && activeTab === "requests" && (
                <div className="space-y-6 max-w-4xl mx-auto">
                    {/* Filters Bar */}
                    <div className="flex flex-col md:flex-row gap-4 bg-[#18181b] border border-gray-800 p-6 rounded-xl">
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Filter by Institution</label>
                            <select
                                value={reqInstFilter}
                                onChange={(e) => setReqInstFilter(e.target.value)}
                                className="input bg-[#27272a] border-gray-800 text-white w-full py-3"
                            >
                                <option value="all">All Institutions</option>
                                {institutes.map(inst => (
                                    <option key={inst.id} value={inst.id}>{inst.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Search Name / Email</label>
                            <input
                                type="text"
                                value={reqSearchQuery}
                                onChange={(e) => setReqSearchQuery(e.target.value)}
                                placeholder="Search by name or email..."
                                className="input bg-[#27272a] border-gray-800 text-white w-full py-3"
                            />
                        </div>
                    </div>

                    {/* Table View */}
                    <div className="bg-[#18181b] border border-gray-800 p-6 rounded-xl shadow-lg">
                        <h3 className="text-lg font-bold text-white mb-4">Pending Admin Access Requests</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm border-collapse">
                                <thead>
                                    <tr className="border-b border-gray-800 text-gray-400">
                                        <th className="py-3 px-4">Full Name</th>
                                        <th className="py-3 px-4">Email</th>
                                        <th className="py-3 px-4">Requested Institution</th>
                                        <th className="py-3 px-4 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRequests.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" className="py-8 text-center text-gray-500">No pending admin access requests found.</td>
                                        </tr>
                                    ) : (
                                        filteredRequests.map((req) => (
                                            <tr key={req.id} className="border-b border-gray-800/50 hover:bg-white/5 transition-colors">
                                                <td className="py-3 px-4 font-semibold text-white">{req.name || "—"}</td>
                                                <td className="py-3 px-4 text-gray-300 font-mono text-xs">{req.email}</td>
                                                <td className="py-3 px-4 text-purple-400 font-semibold">{req.institution_name || "—"}</td>
                                                <td className="py-3 px-4 text-center space-x-2">
                                                    <button
                                                        onClick={() => handleApproveRequest(req.email)}
                                                        disabled={actionLoading}
                                                        className="text-xs bg-green-950/20 hover:bg-green-500/20 text-green-400 hover:text-green-300 border border-green-950/30 hover:border-green-500/30 px-3 py-1 rounded transition-colors"
                                                    >
                                                        {actionLoading ? "..." : "Approve"}
                                                    </button>
                                                    <button
                                                        onClick={() => handleRejectRequest(req.email)}
                                                        disabled={actionLoading}
                                                        className="text-xs bg-red-950/20 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-950/30 hover:border-red-500/30 px-3 py-1 rounded transition-colors"
                                                    >
                                                        {actionLoading ? "..." : "Reject"}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
