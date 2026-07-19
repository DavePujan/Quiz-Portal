const router = require("express").Router();
const pool = require("../db");
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const crypto = require("crypto");
const redisClient = require("../config/redis");

// 1. GET /stats
router.get("/stats", async (req, res) => {
    try {
        const instRes = await pool.query("SELECT COUNT(*) FROM institutions");
        const adminRes = await pool.query("SELECT COUNT(*) FROM institution_memberships WHERE role = 'admin'");
        
        const teacherCountRes = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "teacher");
        const studentCountRes = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student");
        
        // Fetch Maintenance Mode
        let isMaintenanceMode = false;
        let cache = null;
        if (redisClient.isAvailable) {
            try {
                cache = await redisClient.get("settings:maintenanceMode");
            } catch (rErr) {
                console.error("Redis get stats maintenanceMode failed:", rErr);
            }
        }
        if (cache !== null) {
            isMaintenanceMode = JSON.parse(cache);
        } else {
            const { data: mSetting } = await supabase.from("settings").select("value").eq("key", "maintenanceMode").maybeSingle();
            if (mSetting) isMaintenanceMode = mSetting.value;
        }

        res.json({
            institutes: Number(instRes.rows[0].count || 0),
            admins: Number(adminRes.rows[0].count || 0),
            teachers: Number(teacherCountRes.count || 0),
            students: Number(studentCountRes.count || 0),
            maintenanceMode: isMaintenanceMode,
            dbConnected: true,
            redisConnected: redisClient.isAvailable
        });
    } catch (err) {
        console.error("Master Stats Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// 2. GET /institutes
router.get("/institutes", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM institutions ORDER BY name");
        res.json(result.rows);
    } catch (err) {
        console.error("Master Get Institutes Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// 3. POST /institutes
router.post("/institutes", async (req, res) => {
    const { name, code, logoUrl, website, country, state, city, timezone } = req.body;
    if (!name || !code) {
        return res.status(400).json({ error: "Name and Code are required" });
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // 1. Insert Institution
        const result = await client.query(`
            INSERT INTO institutions (name, code, logo_url, website, country, state, city, timezone)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [
            name, 
            code.toLowerCase().trim(), 
            logoUrl || null, 
            website || null, 
            country || "India", 
            state || null, 
            city || null, 
            timezone || "Asia/Kolkata"
        ]);

        const newInst = result.rows[0];
        const instId = newInst.id;

        // 2. Seed Default Academic Session
        const sessionRes = await client.query(`
            INSERT INTO academic_sessions (institution_id, name, start_date, end_date, is_current)
            VALUES ($1, $2, $3, $4, true)
            RETURNING id
        `, [instId, "2026-2027 Academic Year", "2026-06-01", "2027-05-31"]);
        const sessionId = sessionRes.rows[0].id;

        // 3. Seed Default Departments
        const depts = [
            { name: "Computer Engineering", code: "CE" },
            { name: "Information Technology", code: "IT" },
            { name: "Electronics & Communication Engineering", code: "ECE" },
            { name: "Mechanical Engineering", code: "ME" },
            { name: "Civil Engineering", code: "CIVIL" },
            { name: "Electrical Engineering", code: "EE" }
        ];

        for (const dept of depts) {
            await client.query(`
                INSERT INTO departments (institution_id, name, code)
                VALUES ($1, $2, $3)
            `, [instId, dept.name, dept.code]);
        }

        // 4. Seed Default Academic Terms (8 Semesters)
        for (let i = 1; i <= 8; i++) {
            await client.query(`
                INSERT INTO academic_terms (institution_id, session_id, term_number, term_type)
                VALUES ($1, $2, $3, 'semester')
            `, [instId, sessionId, i]);
        }

        await client.query("COMMIT");
        res.status(201).json(newInst);
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("Master Create Institute Error:", err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// 4. GET /admins
router.get("/admins", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                im.id as membership_id,
                im.role as membership_role,
                im.is_active,
                p.id as user_id,
                p.email,
                p.full_name,
                i.id as institution_id,
                i.name as institution_name
            FROM institution_memberships im
            JOIN profiles p ON p.id = im.user_id
            JOIN institutions i ON i.id = im.institution_id
            WHERE im.role = 'admin'
            ORDER BY i.name, p.email
        `);
        res.json(result.rows);
    } catch (err) {
        console.error("Master Get Admins Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// 5. POST /admins
router.post("/admins", async (req, res) => {
    const { email, name, institutionId } = req.body;
    if (!email || !institutionId) {
        return res.status(400).json({ error: "Email and Institution are required" });
    }

    try {
        // Find or create profile
        let { data: profile } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", email.toLowerCase().trim())
            .maybeSingle();

        let userId;
        if (!profile) {
            // Create user profile
            const { data: newProfile, error } = await supabase
                .from("profiles")
                .insert({
                    id: crypto.randomUUID(),
                    email: email.toLowerCase().trim(),
                    full_name: name || null,
                    role: "admin",
                    is_verified: true,
                    created_at: new Date()
                })
                .select("id")
                .single();

            if (error) throw error;
            userId = newProfile.id;
        } else {
            userId = profile.id;
            // Promote role in profile table to admin if not already admin
            await supabase
                .from("profiles")
                .update({ role: "admin" })
                .eq("id", userId);
        }

        // Add to mock model memory if relevant so login succeeds
        const User = require("../models/User");
        let localUser = User.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
        if (!localUser) {
            User.push({
                id: User.length + 1,
                email: email.toLowerCase().trim(),
                password: "$2b$10$DHpOtH1eSROzewp8bQjFt..aSCsvy9GrInyHi6CXZUM8JCm6ROySq", // password
                role: "admin",
                provider: "local",
                isVerified: true
            });
        } else if (localUser.role !== 'admin' && localUser.role !== 'master_admin') {
            localUser.role = 'admin';
        }

        // Insert membership
        const result = await pool.query(`
            INSERT INTO institution_memberships (user_id, institution_id, role, is_active)
            VALUES ($1, $2, 'admin', true)
            ON CONFLICT (user_id, institution_id, role) DO UPDATE SET is_active = true
            RETURNING *
        `, [userId, institutionId]);

        res.status(201).json({ message: "Admin assigned successfully", membership: result.rows[0] });
    } catch (err) {
        console.error("Master Assign Admin Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// 6. DELETE /admins/:membershipId
router.delete("/admins/:membershipId", async (req, res) => {
    const { membershipId } = req.params;
    try {
        const result = await pool.query(`
            DELETE FROM institution_memberships 
            WHERE id = $1
            RETURNING *
        `, [membershipId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Membership not found" });
        }
        res.json({ message: "Admin membership removed successfully" });
    } catch (err) {
        console.error("Master Remove Admin Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// 7. GET /settings
router.get("/settings", async (req, res) => {
    try {
        const { data, error } = await supabase.from("settings").select("*");
        if (error) throw error;

        const settings = {
            maintenanceMode: false
        };

        if (data) {
            data.forEach(item => {
                if (item.key === 'maintenanceMode') settings.maintenanceMode = item.value;
            });
        }
        res.json(settings);
    } catch (err) {
        console.error("Master Get Settings Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// 8. POST /settings
router.post("/settings", async (req, res) => {
    const { maintenanceMode } = req.body;
    try {
        const { error } = await supabase
            .from("settings")
            .upsert({ key: 'maintenanceMode', value: maintenanceMode });

        if (error) throw error;

        // Clear settings cache in Redis
        if (redisClient.isAvailable) {
            try {
                await redisClient.set("settings:maintenanceMode", JSON.stringify(maintenanceMode), "EX", 60);
            } catch (rErr) {
                console.error("Redis set settings:maintenanceMode failed:", rErr);
            }
        }

        res.json({ message: "Global settings updated successfully" });
    } catch (err) {
        console.error("Master Update Settings Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// 9. GET /requests - Fetches pending admin access requests with institute name
router.get("/requests", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT r.*, i.name as institution_name
            FROM access_requests r
            LEFT JOIN institutions i ON r.institution_id = i.id
            WHERE r.status = 'pending' AND r.role = 'admin'
            ORDER BY r.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error("Master Get Requests Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// 10. POST /requests/approve - Approve an admin access request
router.post("/requests/approve", async (req, res) => {
    const { email } = req.body;
    try {
        const { data: reqData, error: fetchError } = await supabase
            .from("access_requests")
            .select("*")
            .eq("email", email)
            .single();

        if (fetchError || !reqData) return res.status(404).json({ error: "Request not found" });

        // Insert/upsert public.profiles
        const { data: existingProfile } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();

        const profileData = {
            id: existingProfile?.id || crypto.randomUUID(),
            email: reqData.email,
            role: "admin",
            provider: reqData.provider,
            full_name: reqData.name || null,
            password: reqData.password || null,
            is_verified: true
        };

        const { error: upsertError } = await supabase
            .from("profiles")
            .upsert(profileData, { onConflict: 'email' });

        if (upsertError) throw upsertError;

        // Auto-assign local admin membership if request has institution_id
        if (reqData.institution_id) {
            await pool.query(`
                INSERT INTO institution_memberships (user_id, institution_id, role)
                VALUES ($1, $2, 'admin')
                ON CONFLICT DO NOTHING
            `, [profileData.id, reqData.institution_id]);
        }

        // Sync to mock model memory for login
        const User = require("../models/User");
        let localUser = User.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
        if (!localUser) {
            User.push({
                id: User.length + 1,
                email: reqData.email,
                password: reqData.password || "$2b$10$DHpOtH1eSROzewp8bQjFt..aSCsvy9GrInyHi6CXZUM8JCm6ROySq", // password
                role: "admin",
                provider: "local",
                isVerified: true
            });
        }

        // Delete the request
        const { error: deleteError } = await supabase
            .from("access_requests")
            .delete()
            .eq("email", email);

        if (deleteError) throw deleteError;

        res.json({ message: "Admin access request approved successfully." });
    } catch (err) {
        console.error("Master Approve Request Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// 11. POST /requests/reject - Reject an admin access request
router.post("/requests/reject", async (req, res) => {
    const { email } = req.body;
    try {
        const { error } = await supabase
            .from("access_requests")
            .delete()
            .eq("email", email);

        if (error) throw error;
        res.json({ message: "Admin access request rejected and removed." });
    } catch (err) {
        console.error("Master Reject Request Error:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
