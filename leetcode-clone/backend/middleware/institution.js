const { createClient } = require("@supabase/supabase-js");
const pool = require("../db");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const requireInstitutionContext = async (req, res, next) => {
    try {
        if (req.user && req.user.role === 'master_admin') {
            const { data: profile } = await supabase
                .from("profiles")
                .select("id")
                .eq("email", req.user.email)
                .single();

            req.context = {
                userId: profile?.id || req.user.id,
                institutionId: null,
                role: 'master_admin',
                departmentId: null,
                programId: null
            };
            return next();
        }

        // Find profile id
        const { data: profile, error } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", req.user.email)
            .single();

        if (error || !profile) {
            return res.status(401).json({ error: "User profile not found" });
        }

        const userId = profile.id;
        
        // Find active institution membership
        const result = await pool.query(`
            SELECT institution_id, role, department_id, program_id
            FROM institution_memberships
            WHERE user_id = $1
              AND is_active = true
              AND role = $2
            LIMIT 1
        `, [userId, req.user.role]);

        const membership = result.rows[0];

        if (!membership) {
            return res.status(403).json({ error: "No active institution membership found for user" });
        }

        req.context = {
            userId,
            institutionId: membership.institution_id,
            role: membership.role,
            departmentId: membership.department_id,
            programId: membership.program_id
        };

        next();
    } catch (err) {
        console.error("Institution Middleware Error:", err);
        res.status(500).json({ error: "Internal Server Error resolving context" });
    }
};

module.exports = { requireInstitutionContext };
