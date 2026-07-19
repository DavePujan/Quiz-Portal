const router = require("express").Router();
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const pool = require("../db");
const { auth, authorize } = require("../middleware/auth");
const User = require("../models/User");
const AccessRequest = require("../models/AccessRequest");
const crypto = require("crypto");

router.get("/requests", auth, authorize('admin'), async (req, res) => {
    try {
        console.log("Fetching pending access requests...");
        
        // Fetch approving admin's institution (using email join to bypass mock model integer vs UUID format discrepancy)
        const adminMember = await pool.query(`
            SELECT im.institution_id 
            FROM institution_memberships im
            JOIN profiles p ON p.id = im.user_id
            WHERE LOWER(p.email) = LOWER($1) AND im.role = 'admin' AND im.is_active = true 
            LIMIT 1
        `, [req.user.email]);
        const adminInstId = adminMember.rows[0]?.institution_id;

        let query = supabase
            .from("access_requests")
            .select("*")
            .eq("status", "pending")
            .neq("role", "admin");

        if (adminInstId) {
            query = query.eq("institution_id", adminInstId);
        }

        const { data, error } = await query.order("created_at", { ascending: false });

        if (error) {
            console.error("Supabase Error fetching requests:", error);
            throw error;
        }

        console.log("Pending Requests Found:", data?.length, data);
        res.json(data);
    } catch (err) {
        console.error("Route Error:", err);
        res.status(500).json({ error: err.message });
    }
});

router.post("/approve-request", auth, authorize('admin'), async (req, res) => {
    const { email } = req.body;

    try {
        // 1. Fetch Request
        const { data: reqData, error: fetchError } = await supabase
            .from("access_requests")
            .select("*")
            .eq("email", email)
            .single();

        if (fetchError || !reqData) return res.status(404).json({ error: "Request not found" });

        // 2. Fetch approving admin's institution (using email join to bypass mock model integer vs UUID format discrepancy)
        const adminMember = await pool.query(`
            SELECT im.institution_id 
            FROM institution_memberships im
            JOIN profiles p ON p.id = im.user_id
            WHERE LOWER(p.email) = LOWER($1) AND im.role = 'admin' AND im.is_active = true 
            LIMIT 1
        `, [req.user.email]);
        const adminInstId = adminMember.rows[0]?.institution_id;
        const instId = reqData.institution_id || adminInstId;

        // 3. Resolve department record (if department text is present)
        let departmentRecord = null;
        if (reqData.department) {
            const { data: departments, error: departmentsError } = await supabase
                .from("departments")
                .select("id, code, name");

            if (departmentsError) throw departmentsError;

            const requestedDepartment = String(reqData.department || "").trim().toLowerCase();
            departmentRecord = (departments || []).find((department) =>
                department.code?.toLowerCase() === requestedDepartment ||
                department.name?.toLowerCase() === requestedDepartment
            );
        }

        // 4. Insert/upsert public.profiles (no department_id on profiles table)
        const { data: existingProfile } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();

        const profileData = {
            id: existingProfile?.id || crypto.randomUUID(), // Preserve ID if exists
            email: reqData.email,
            role: reqData.role,
            department: reqData.department, // Transfer department text
            provider: reqData.provider,
            full_name: reqData.name || null, // Transfer name
            password: reqData.password || null, // Transfer hashed password
            is_verified: true
        };

        const { error: upsertError } = await supabase
            .from("profiles")
            .upsert(profileData, { onConflict: 'email' });

        if (upsertError) throw upsertError;

        const profileId = existingProfile?.id || profileData.id;

        // 5. Create institution membership
        if (instId) {
            await pool.query(`
                INSERT INTO institution_memberships (user_id, institution_id, role, department_id, is_active)
                VALUES ($1, $2, $3, $4, true)
                ON CONFLICT DO NOTHING
            `, [profileId, instId, reqData.role, departmentRecord?.id || null]);
        }

        // Sync to mock model memory if relevant so login succeeds
        const User = require("../models/User");
        let localUser = User.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
        if (!localUser) {
            User.push({
                id: User.length + 1,
                email: reqData.email,
                password: reqData.password || "$2b$10$DHpOtH1eSROzewp8bQjFt..aSCsvy9GrInyHi6CXZUM8JCm6ROySq", // password
                role: reqData.role,
                provider: "local",
                isVerified: true
            });
        }

        // 6. Delete Request
        const { error: deleteError } = await supabase
            .from("access_requests")
            .delete()
            .eq("email", email);

        if (deleteError) throw deleteError;

        res.json({ message: "Access request approved & user created." });

    } catch (err) {
        console.error("Approve Request Error:", err);
        res.status(500).json({ error: err.message });
    }
});

router.get("/dashboard", auth, authorize('admin'), async (req, res) => {
    try {
        const { count: totalUsers } = await supabase
            .from("profiles")
            .select("*", { count: "exact", head: true })
            .neq("role", "master_admin");

        // Active Quizzes (is_active = true)
        const { count: activeQuizzes } = await supabase
            .from("quizzes")
            .select("*", { count: "exact", head: true })
            .eq("is_active", true);

        // History Quizzes (is_active = false)
        const { count: historyQuizzes } = await supabase
            .from("quizzes")
            .select("*", { count: "exact", head: true })
            .eq("is_active", false);

        const { count: pendingRequests } = await supabase.from("audit_logs").select("*", { count: "exact", head: true });

        res.json({
            totalUsers: totalUsers || 0,
            activeQuizzes: activeQuizzes || 0,
            historyQuizzes: historyQuizzes || 0,
            pendingRequests: pendingRequests || 0,
            systemHealth: "Good"
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/users", auth, authorize('admin'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .neq("role", "master_admin");
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch("/promote", auth, authorize('admin'), async (req, res) => {
    const { email, role } = req.body;
    if (!["teacher", "admin", "student"].includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
    }

    // Update Supabase
    const { data, error } = await supabase
        .from("profiles")
        .update({ role: role })
        .eq("email", email)
        .select();

    if (error) return res.status(500).json({ error: error.message });
    if (!data || data.length === 0) return res.status(404).json({ error: "User not found in database" });

    res.json({ message: "Role updated" });
});

router.post("/reject-request", auth, authorize('admin'), async (req, res) => {
    const { email } = req.body;

    try {
        const { error } = await supabase
            .from("access_requests")
            .delete()
            .eq("email", email);

        if (error) throw error;

        res.json({ message: "Access request rejected and removed." });
    } catch (err) {
        console.error("Reject Request Error:", err);
        res.status(500).json({ error: err.message });
    }
});

router.delete("/user", auth, authorize('admin'), async (req, res) => {
    const { email } = req.body;

    try {
        const { error } = await supabase
            .from("profiles")
            .delete()
            .eq("email", email);

        if (error) throw error;

        res.json({ message: "User removed successfully." });
    } catch (err) {
        console.error("Delete User Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Settings Routes
router.get("/settings", auth, authorize('admin'), async (req, res) => {
    try {
        const { data, error } = await supabase.from("settings").select("*");
        if (error) throw error;

        const settings = {
            allowRegistrations: true,
            allowTeachers: true
        };

        if (data) {
            data.forEach(item => {
                if (item.key === 'allowRegistrations') settings.allowRegistrations = item.value;
                if (item.key === 'allowTeachers') settings.allowTeachers = item.value;
            });
        }

        res.json(settings);
    } catch (err) {
        console.error("Get Settings Error:", err);
        res.status(500).json({ error: err.message });
    }
});

router.post("/settings", auth, authorize('admin'), async (req, res) => {
    const { allowRegistrations, allowTeachers } = req.body;

    try {
        const updates = [
            { key: 'allowRegistrations', value: allowRegistrations },
            { key: 'allowTeachers', value: allowTeachers }
        ];

        const { error } = await supabase
            .from("settings")
            .upsert(updates);

        if (error) throw error;

        res.json({ message: "Settings updated successfully" });
    } catch (err) {
        console.error("Update Settings Error:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
