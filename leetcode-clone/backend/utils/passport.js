const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const GitHubStrategy = require("passport-github2").Strategy;
const User = require("../models/User"); // Now wraps the array
const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Helper to sync with Supabase
async function syncToSupabase(user) {
    try {
        // Try to find existing profile to keep UUID if exists
        let { data: existing } = await supabase.from("profiles").select("id").eq("email", user.email).maybeSingle();

        const profile = {
            id: existing ? existing.id : crypto.randomUUID(),
            email: user.email,
            role: user.role,
            provider: user.provider
        };

        // Update local user ID to match Supabase if needed, or just keep them separate.
        // For now, just ensuring the profile exists for Frontend to see.
        const { error } = await supabase.from("profiles").upsert(profile);

        if (error) {
            console.error("[Supabase] Sync Error:", error.message);
        } else {
            console.log(`[Supabase] Synced profile for ${user.email}`);
        }
    } catch (err) {
        console.error("[Supabase] Sync failed (Exception):", err.message);
    }
}

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_ID,
            clientSecret: process.env.GOOGLE_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                const email = profile.emails[0].value;

                // 1. Check if user exists in our valid User list
                let user = await User.findOne({ email });

                if (!user) {
                    // Fallback: Check Supabase (Persistence Layer)
                    const { data: sbUser, error } = await supabase.from("profiles").select("*").eq("email", email).maybeSingle();
                    if (error) console.error(`[Passport] Supabase error:`, error.message);

                    if (sbUser) {
                        // User exists in DB, hydrate in-memory store
                        user = {
                            id: sbUser.id, // Use UUID from SB
                            email: sbUser.email,
                            role: sbUser.role,
                            provider: sbUser.provider,
                            isVerified: true
                        };
                        User.push(user);
                    } else {
                        // Auto-provision new OAuth user as student
                        const name = profile.displayName || email.split("@")[0];
                        const { data: newSbUser } = await supabase.from("profiles").insert({
                            email,
                            name,
                            role: "student",
                            provider: "google",
                            is_verified: true
                        }).select("*").maybeSingle();

                        user = {
                            id: newSbUser?.id || Date.now(),
                            email,
                            role: newSbUser?.role || "student",
                            provider: "google",
                            isVerified: true
                        };
                        User.push(user);
                    }
                }

                done(null, user);
            } catch (err) {
                done(err, null);
            }
        }
    )
);

passport.use(
    new GitHubStrategy(
        {
            clientID: process.env.GITHUB_ID,
            clientSecret: process.env.GITHUB_SECRET,
            callbackURL: process.env.GITHUB_CALLBACK_URL
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                const email = profile.emails?.[0]?.value || `${profile.username}@github.com`;

                // 1. Check if user exists
                let user = await User.findOne({ email });

                if (!user) {
                    // Fallback: Check Supabase
                    const { data: sbUser } = await supabase.from("profiles").select("*").eq("email", email).maybeSingle();

                    if (sbUser) {
                        user = {
                            id: sbUser.id,
                            email: sbUser.email,
                            role: sbUser.role,
                            provider: sbUser.provider,
                            isVerified: true
                        };
                        User.push(user);
                    } else {
                        // Auto-provision new OAuth user as student
                        const name = profile.displayName || profile.username || email.split("@")[0];
                        const { data: newSbUser } = await supabase.from("profiles").insert({
                            email,
                            name,
                            role: "student",
                            provider: "github",
                            is_verified: true
                        }).select("*").maybeSingle();

                        user = {
                            id: newSbUser?.id || Date.now(),
                            email,
                            role: newSbUser?.role || "student",
                            provider: "github",
                            isVerified: true
                        };
                        User.push(user);
                    }
                }

                done(null, user);
            } catch (err) {
                done(err, null);
            }
        }
    )
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));
