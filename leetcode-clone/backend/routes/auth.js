const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User"); // Wrapper
const router = express.Router();
const redisClient = require("../config/redis");
const crypto = require("crypto");

const passport = require("passport");
const REFRESH_SECRET = process.env.REFRESH_SECRET || "refreshsecret123";

const AccessRequest = require("../models/AccessRequest");
const { loginLimiter } = require("../middleware/rateLimiter");

router.post("/login", loginLimiter, async (req, res) => {
    if (!redisClient.isAvailable) {
        res.set("X-Fallback-Mode", "memory");
    }
    const { email, password } = req.body;
    let user = await User.findOne({ email });

    if (!user) {
        // Fallback: Check Supabase
        const { createClient } = require("@supabase/supabase-js");
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        const { data: sbUser } = await supabase.from("profiles").select("*").eq("email", email).single();

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
        const pending = AccessRequest.find(r => r.email === email);
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

    res.json({ role: user.role });
});

const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

router.post("/request-access", async (req, res) => {
    const { email, role, name, provider, department } = req.body;

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
            status: "pending"
        });

        if (error) throw error;

        res.json({ message: "Access request submitted. Please wait for admin approval." });
    } catch (err) {
        console.error("Request Access Error:", err);
        res.status(500).json({ error: err.message });
    }
});

router.post("/refresh", async (req, res) => {
    const token = req.cookies.refreshToken;
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
        res.json({ message: "Refreshed successfully" });
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
            return res.redirect(`http://localhost:5173/login?error=not_found&email=${email}&provider=google`);
        }

        // Success
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: "2h" });
        const refreshToken = jwt.sign({ id: user.id, email: user.email, role: user.role }, REFRESH_SECRET, { expiresIn: "7d" });

        res.cookie("refreshToken", refreshToken, { httpOnly: true, secure: false, sameSite: "strict" });
        res.redirect(`http://localhost:5173/oauth-success?token=${token}&role=${user.role}`);
    })(req, res, next);
});

router.get("/github", passport.authenticate("github", { scope: ["user:email"] }));
router.get("/github/callback", (req, res, next) => {
    passport.authenticate("github", { session: false }, (err, user, info) => {
        if (err) return next(err);
        if (!user) {
            const email = info?.email || "";
            return res.redirect(`http://localhost:5173/login?error=not_found&email=${email}&provider=github`);
        }

        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: "2h" });
        const refreshToken = jwt.sign({ id: user.id, email: user.email, role: user.role }, REFRESH_SECRET, { expiresIn: "7d" });

        res.cookie("refreshToken", refreshToken, { httpOnly: true, secure: false, sameSite: "strict" });
        res.redirect(`http://localhost:5173/oauth-success?token=${token}&role=${user.role}`);
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

module.exports = router;
