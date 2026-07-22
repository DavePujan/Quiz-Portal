import React, { useState, useEffect } from "react";
import { updateSettings, getSettings } from "../../utils/api";
import { Settings, UserPlus, UserCheck, Wrench, Save, CheckCircle } from "lucide-react";

export default function AdminSettings() {
    const [settings, setSettings] = useState({
        allowRegistrations: true,
        allowTeachers: true,
        maintenanceMode: false
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const res = await getSettings();
            if (res.data) setSettings(res.data);
        } catch (err) {
            console.error("Failed to load settings:", err);
        } finally {
            setLoading(false);
        }
    };

    const updateSettingsFn = async () => {
        setSaving(true);
        setSuccessMsg("");
        try {
            await updateSettings(settings);
            setSuccessMsg("System settings updated successfully!");
            setTimeout(() => setSuccessMsg(""), 4000);
        } catch (err) {
            console.error("Failed to update settings:", err);
            alert("Failed to update settings: " + (err.response?.data?.error || err.message));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 md:p-8 max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-6 sm:mb-8">
                <h1 className="text-2xl sm:text-3xl font-extrabold bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-purple-500">
                    Platform Settings
                </h1>
                <p className="text-xs sm:text-sm text-gray-400 mt-1">
                    Control global user registration permissions, teacher onboarding, and system modes.
                </p>
            </div>

            {successMsg && (
                <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/40 text-green-300 p-4 rounded-xl mb-6 text-sm">
                    <CheckCircle size={18} />
                    <span>{successMsg}</span>
                </div>
            )}

            {/* Settings Card */}
            <div className="card p-6 border border-gray-800 space-y-6">
                {loading ? (
                    <div className="flex justify-center items-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : (
                    <>
                        <div className="flex items-start justify-between p-4 bg-white/5 rounded-xl border border-white/10 transition-colors">
                            <div className="flex items-start gap-3">
                                <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-lg mt-0.5">
                                    <UserPlus size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-base">Allow New Student Registrations</h3>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        When enabled, new students can request access and sign up for accounts.
                                    </p>
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.allowRegistrations}
                                onChange={e => setSettings({ ...settings, allowRegistrations: e.target.checked })}
                                className="w-5 h-5 accent-primary rounded cursor-pointer mt-1"
                            />
                        </div>

                        <div className="flex items-start justify-between p-4 bg-white/5 rounded-xl border border-white/10 transition-colors">
                            <div className="flex items-start gap-3">
                                <div className="p-2.5 bg-purple-500/20 text-purple-400 rounded-lg mt-0.5">
                                    <UserCheck size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-base">Allow Teacher Role Registrations</h3>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        When enabled, users can select and request Teacher account privileges during signup.
                                    </p>
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.allowTeachers}
                                onChange={e => setSettings({ ...settings, allowTeachers: e.target.checked })}
                                className="w-5 h-5 accent-primary rounded cursor-pointer mt-1"
                            />
                        </div>

                        <div className="flex items-start justify-between p-4 bg-white/5 rounded-xl border border-white/10 transition-colors">
                            <div className="flex items-start gap-3">
                                <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-lg mt-0.5">
                                    <Wrench size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-base">Maintenance Mode</h3>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        Temporarily restrict platform access for maintenance updates.
                                    </p>
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={!!settings.maintenanceMode}
                                onChange={e => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                                className="w-5 h-5 accent-amber-500 rounded cursor-pointer mt-1"
                            />
                        </div>

                        <div className="pt-4 border-t border-gray-800 flex justify-end">
                            <button 
                                className="btn-primary flex items-center gap-2 shadow-lg shadow-purple-500/20 px-6 py-3" 
                                onClick={updateSettingsFn}
                                disabled={saving}
                            >
                                <Save size={18} />
                                <span>{saving ? "Saving..." : "Save System Settings"}</span>
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
