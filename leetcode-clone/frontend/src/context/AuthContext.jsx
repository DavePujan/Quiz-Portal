import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import axios from "axios";
import { AuthContext } from "./authStore";
import { API_BASE_URL } from "../config/api";

export function AuthProvider({ children }) {
    // Actual access token lives in HttpOnly cookie — this is a backward-compatible flag
    // so existing components that check `if (token)` still work without mass refactoring
    const [role, setRole] = useState(localStorage.getItem("role"));
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
    const [isAuthReady, setIsAuthReady] = useState(false);
    const token = role ? true : null; // Derived boolean for compatibility

    const login = (newRole) => {
        // We only track role superficially; actual auth is secure HTTP-Only cookies
        localStorage.setItem("role", newRole);
        setRole(newRole);
    };

    const logout = async () => {
        try {
            // Tell backend to explicitly purge both token cookies
            await axios.post(`${API_BASE_URL}/auth/logout`, {}, { withCredentials: true });
        } catch (e) {
            console.warn("Logout request failed:", e);
        }
        
        localStorage.removeItem("role");
        setRole(null);
        setUser(null);
        setProfile(null);
        window.location.href = "/login";
    };

    useEffect(() => {
        const validateSession = async () => {
            try {
                // If refresh works, session cookies are still valid.
                await axios.post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true });
            } catch {
                // Stale local role can cause redirect loops between /login and protected routes.
                localStorage.removeItem("role");
                setRole(null);
            } finally {
                setIsAuthReady(true);
            }
        };

        validateSession();
    }, []);

    useEffect(() => {
        const fetchProfile = async () => {
            if (!role) {
                setProfile(null);
                return;
            }
            try {
                const res = await axios.get(`${API_BASE_URL}/auth/profile`, { withCredentials: true });
                setProfile(res.data);
            } catch (err) {
                console.error("Failed to fetch detailed profile:", err);
                setProfile(null);
            }
        };

        if (isAuthReady) {
            fetchProfile();
        }
    }, [role, isAuthReady]);

    useEffect(() => {
        if (theme === "light") {
            document.body.classList.add("theme-light");
            document.body.classList.remove("theme-dark");
        } else {
            document.body.classList.remove("theme-light");
            document.body.classList.add("theme-dark");
        }
        localStorage.setItem("theme", theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === "light" ? "dark" : "light");
    };

    useEffect(() => {
        const syncProfile = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;
                
                setUser(user);

                await supabase.from("profiles").upsert({
                    id: user.id,
                    email: user.email,
                    provider: user.app_metadata.provider,
                    role: "student",
                    is_verified: true
                });
            } catch (err) {
                console.warn("Supabase profile sync failed (possibly missing config):", err);
            }
        };

        syncProfile();
        
        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
             setUser(session?.user ?? null);
             // Supabase access_tokens are ignored for our custom backend dual-cookie system
        });

        return () => subscription.unsubscribe();

    }, []);

    return (
        <AuthContext.Provider value={{ token, role, user, profile, setProfile, login, logout, isAuthReady, theme, toggleTheme }}>
            {children}
        </AuthContext.Provider>
    );
}
