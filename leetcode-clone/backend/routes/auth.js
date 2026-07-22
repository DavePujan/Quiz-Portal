const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User"); // Wrapper
const router = express.Router();
const redisClient = require("../config/redis");
const crypto = require("crypto");

const passport = require("passport");
const REFRESH_SECRET = process.env.REFRESH_SECRET || "refreshsecret123";
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

const AccessRequest = require("../models/AccessRequest");
const { loginLimiter } = require("../middleware/rateLimiter");

router.post("/login", loginLimiter, async (req, res) => {
    if (!redisClient.isAvailable) {
        res.set("X-Fallback-Mode", "memory");
    }
    const { email, password } = req.body;
    const lowerEmail = (email || "").toLowerCase().trim();

    let user = await User.findOne(u => u.email.toLowerCase() === lowerEmail);

    if (!user) {
        // Fallback: Check Supabase
        const { createClient } = require("@supabase/supabase-js");
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        const { data: sbUser } = await supabase.from("profiles").select("*").ilike("email", lowerEmail).maybeSingle();

        if (sbUser) {
            user = {
                id: sbUser.id,
                email: sbUser.email,
                role: sbUser.role,
                provider: sbUser.provider,
                password: sbUser.password || "", // Likely empty if from Supabase profiles, will fail local auth
                isVerified: true
            };
            User.push(user);
        }
    }

    if (!user) {
        // Check if there is a pending request
        const pending = AccessRequest.find(r => r.email.toLowerCase() === lowerEmail);
        if (pending) {
            return res.status(403).json({ error: "Access request is pending approval by admin." });
        }
        return res.status(404).json({ error: "User not found. Please request access.", requestAccess: true });
    }

    if (user.provider !== "local" && user.provider !== undefined) return res.status(401).json({ error: `Please login with ${user.provider}` });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: "2h" });
    const refreshToken = jwt.sign({ id: user.id, email: user.email, role: user.role }, REFRESH_SECRET, { expiresIn: "7d" });

    const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: process.env.NODE_ENV === "production" ? "none" : "lax" };
    res.cookie("accessToken", token, cookieOptions);
    res.cookie("refreshToken", refreshToken, cookieOptions);

    res.json({
        role: user.role,
        accessToken: token,
        token: token,
        refreshToken: refreshToken
    });
});


const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

router.post("/request-access", async (req, res) => {
    const { email, role, name, provider, department, institutionId } = req.body;

    try {
        // 0. Check Settings
        const { data: settingsData, error: settingsError } = await supabase.from("settings").select("*");

        let allowRegistrations = true;
        let allowTeachers = true;

        if (settingsData) {
            settingsData.forEach(item => {
                if (item.key === 'allowRegistrations') allowRegistrations = item.value;
                if (item.key === 'allowTeachers') allowTeachers = item.value;
            });
        }

        // Logic:
        // 1. If role is 'teacher', allow if allowTeachers is true.
        // 2. If role is NOT 'teacher' (student/admin), allow only if allowRegistrations is true.

        if (role === 'teacher') {
            if (!allowTeachers) {
                return res.status(403).json({ error: "Teacher registrations are currently disabled." });
            }
        } else {
            if (!allowRegistrations) {
                return res.status(403).json({ error: "New student registrations are currently disabled by the admin." });
            }
        }

        // 1. Check if user already exists
        const { data: existingUser } = await supabase.from("profiles").select("id").eq("email", email).single();
        if (existingUser) return res.status(400).json({ error: "User already exists. Please login." });

        // 2. Check if request already pending
        const { data: existingReq } = await supabase.from("access_requests").select("id").eq("email", email).single();
        if (existingReq) return res.status(400).json({ error: "Request already pending." });

        // 3. Hash Password (if provided)
        let hashedPassword = null;
        if (req.body.password) {
            hashedPassword = await bcrypt.hash(req.body.password, 10);
        }

        // 4. Create Request
        const { error } = await supabase.from("access_requests").insert({
            email,
            name: name || null,
            role,
            department: department || null,
            provider: provider || "local",
            password: hashedPassword, // Store hashed password
            status: "pending",
            institution_id: institutionId || null
        });

        if (error) throw error;

        res.json({ message: "Access request submitted. Please wait for admin approval." });
    } catch (err) {
        console.error("Request Access Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// GET /institutions - Public list of registered institutions for the signup dropdown
router.get("/institutions", async (req, res) => {
    try {
        const pool = require("../db");
        const result = await pool.query("SELECT id, name FROM institutions ORDER BY name");
        res.json(result.rows);
    } catch (err) {
        console.error("Public Fetch Institutions Error:", err);
        res.status(500).json({ error: err.message });
    }
});

router.post("/refresh", async (req, res) => {
    const token = req.cookies.refreshToken || req.headers["x-refresh-token"] || req.body.refreshToken;
    if (!token) return res.status(401).json({ error: "No refresh token" });

    try {
        let isBlacklisted = false;
        if (redisClient.isAvailable) {
            const hash = crypto.createHash("sha256").update(token).digest("hex");
            // Intercept Blacklisted Refresh Tokens
            isBlacklisted = await redisClient.get(`bl_${hash}`);
        }
        if (isBlacklisted) return res.status(401).json({ error: "Refresh token blacklisted" });

        const u = jwt.verify(token, REFRESH_SECRET);
        const newAccess = jwt.sign({ id: u.id, email: u.email, role: u.role }, process.env.JWT_SECRET, { expiresIn: "2h" });
        res.cookie("accessToken", newAccess, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: process.env.NODE_ENV === "production" ? "none" : "lax" });
        res.json({
            message: "Refreshed successfully",
            accessToken: newAccess,
            token: newAccess
        });
    } catch (err) {
        res.status(403).json({ error: "Invalid refresh token" });
    }
});


router.post("/forgot-password", async (req, res) => {
    const { email } = req.body;
    // In a real app, verify email exists in DB here.

    // Determining if user exists (Mock check for feedback)
    const user = await User.findOne({ email });
    if (!user) {
        // Security: Don't reveal if user exists, but for dev we might want to know.
        // return res.json({ message: "If this email exists, a reset link has been sent." });
    }

    // Since we don't have email service configured yet:
    console.log(`[Mock Email] Password reset requested for: ${email}`);

    return res.json({
        message: "If an account exists for this email, we have sent a password reset link."
    });
});

// OAuth Routes
router.get("/google", passport.authenticate("google", { scope: ["email", "profile"], prompt: "select_account" }));
router.get("/google/callback", (req, res, next) => {
    passport.authenticate("google", { session: false }, (err, user, info) => {
        if (err) return next(err);
        if (!user) {
            // User not found, redirect to request access with email pre-filled
            // Info contains { message, email, provider }
            const email = info?.email || "";
            return res.redirect(`${CLIENT_URL}/login?error=not_found&email=${email}&provider=google`);
        }

        // Success
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: "2h" });
        const refreshToken = jwt.sign({ id: user.id, email: user.email, role: user.role }, REFRESH_SECRET, { expiresIn: "7d" });

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
        });
        res.redirect(`${CLIENT_URL}/oauth-success?token=${token}&role=${user.role}`);
    })(req, res, next);
});

router.get("/github", passport.authenticate("github", { scope: ["user:email"] }));
router.get("/github/callback", (req, res, next) => {
    passport.authenticate("github", { session: false }, (err, user, info) => {
        if (err) return next(err);
        if (!user) {
            const email = info?.email || "";
            return res.redirect(`${CLIENT_URL}/login?error=not_found&email=${email}&provider=github`);
        }

        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: "2h" });
        const refreshToken = jwt.sign({ id: user.id, email: user.email, role: user.role }, REFRESH_SECRET, { expiresIn: "7d" });

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
        });
        res.redirect(`${CLIENT_URL}/oauth-success?token=${token}&role=${user.role}`);
    })(req, res, next);
});

router.get("/verify", async (req, res) => {
    const user = await User.findOne({ verificationToken: req.query.token });
    if (!user) return res.status(400).send("Invalid token");

    user.isVerified = true;
    user.verificationToken = null;
    // user.save(); // In-memory reference update

    res.send("Email verified successfully! You can close this tab.");
});

router.post("/logout", async (req, res) => {
    const accessToken = req.cookies.accessToken || req.headers.authorization?.split(" ")[1];
    const refreshToken = req.cookies.refreshToken;

    if (redisClient.isAvailable) {
        if (accessToken) {
            const accHash = crypto.createHash("sha256").update(accessToken).digest("hex");
            await redisClient.set(`bl_${accHash}`, "true", "EX", 60 * 60); // Buffer of 1 hour for access tokens
        }
        if (refreshToken) {
            const refHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
            await redisClient.set(`bl_${refHash}`, "true", "EX", 7 * 24 * 60 * 60); // Exact 7-day matching span
        }
    }

    const cookieOptions = { httpOnly: true, expires: new Date(0), secure: process.env.NODE_ENV === "production", sameSite: process.env.NODE_ENV === "production" ? "none" : "lax" };
    res.cookie("accessToken", "", cookieOptions);
    res.cookie("refreshToken", "", cookieOptions);

    res.json({ message: "Logged out successfully" });
});

// GET /auth/profile - Fetch logged-in user profile, college, and department
router.get("/profile", async (req, res) => {
    const token = req.cookies.accessToken || req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    try {
        const u = jwt.verify(token, process.env.JWT_SECRET || "jwtsecret123");
        
        // Fetch profile
        const { data: profile, error } = await supabase
            .from("profiles")
            .select("id, email, full_name, role, department")
            .eq("email", u.email)
            .single();

        if (error || !profile) {
            return res.status(404).json({ error: "Profile not found" });
        }

        // Query active institution membership and department
        const pool = require("../db");
        const orgResult = await pool.query(`
            SELECT 
                i.name as institution_name,
                d.name as department_name
            FROM institution_memberships im
            LEFT JOIN institutions i ON i.id = im.institution_id
            LEFT JOIN departments d ON d.id = im.department_id
            WHERE im.user_id = $1 AND im.is_active = true
            LIMIT 1
        `, [profile.id]);

        const college = orgResult.rows[0]?.institution_name || "QuizPortal Institute";
        const department = orgResult.rows[0]?.department_name || profile.department || "General";

        res.json({
            id: profile.id,
            email: profile.email,
            name: profile.full_name || profile.email.split("@")[0],
            role: profile.role,
            college: college,
            department: department
        });
    } catch (err) {
        console.error("Fetch profile error:", err);
        res.status(401).json({ error: "Invalid or expired token" });
    }
});

module.exports = router;
