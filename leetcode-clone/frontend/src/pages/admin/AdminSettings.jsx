import React, { useState, useEffect } from "react";
import { updateSettings, getSettings } from "../../utils/api";

export default function AdminSettings() {
    const [settings, setSettings] = useState({
        allowRegistrations: true,
        allowTeachers: true,
        maintenanceMode: false
    });

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const res = await getSettings();
            setSettings(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const updateSettingsFn = async () => {
        try {
            await updateSettings(settings);
            alert("Settings Updated");
        } catch (err) {
            console.error("Failed to update settings:", err);
            alert("Failed to update settings: " + (err.response?.data?.error || err.message));
        }
    };

    return (
        <div className="p-6 max-w-2xl">
            <h1 className="text-xl font-semibold mb-4">Platform Settings</h1>

            <label className="block mb-3">
                <input
                    type="checkbox"
                    checked={settings.allowRegistrations}
                    onChange={e =>
                        setSettings({ ...settings, allowRegistrations: e.target.checked })
                    }
                /> Allow New Registrations
            </label>

            <label className="block mb-3">
                <input
                    type="checkbox"
                    checked={settings.allowTeachers}
                    onChange={e =>
                        setSettings({ ...settings, allowTeachers: e.target.checked })
                    }
                /> Allow Teacher Role
            </label>



            <button className="btn-primary mt-4" onClick={updateSettingsFn}>
                Save Settings
            </button>
        </div>
    );
}
