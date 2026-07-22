const { createClient } = require("@supabase/supabase-js");
const pool = require("../db");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const pool = require("../db");

// Fast in-memory TTL cache to eliminate 3-second Supabase REST roundtrips per API request
const institutionContextCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const requireInstitutionContext = async (req, res, next) => {
    try {
        if (!req.user || !req.user.email) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const cacheKey = `${req.user.email}:${req.user.role}`;
        const cached = institutionContextCache.get(cacheKey);

        if (cached && Date.now() < cached.expiresAt) {
            req.context = cached.context;
            return next();
        }

        // Direct high-speed PostgreSQL query joining profiles and institution_memberships
        const result = await pool.query(`
            SELECT 
                p.id AS user_id, 
                im.institution_id, 
                im.role, 
                im.department_id, 
                im.program_id
            FROM profiles p
            LEFT JOIN institution_memberships im 
              ON im.user_id = p.id 
             AND im.is_active = true 
             AND im.role = $2
            WHERE lower(p.email) = lower($1)
            LIMIT 1
        `, [req.user.email, req.user.role || 'teacher']);

        if (result.rowCount === 0) {
            return res.status(401).json({ error: "User profile not found" });
        }

        const row = result.rows[0];

        if (req.user.role !== 'master_admin' && !row.institution_id) {
            return res.status(403).json({ error: "No active institution membership found for user" });
        }

        const context = {
            userId: row.user_id,
            institutionId: row.institution_id || null,
            role: row.role || req.user.role,
            departmentId: row.department_id || null,
            programId: row.program_id || null
        };

        institutionContextCache.set(cacheKey, { context, expiresAt: Date.now() + CACHE_TTL_MS });
        req.context = context;

        next();
    } catch (err) {
        console.error("Institution Middleware Error:", err);
        res.status(500).json({ error: "Internal Server Error resolving context" });
    }
};

module.exports = { requireInstitutionContext };
