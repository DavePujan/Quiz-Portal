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
    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem("theme");
        if (saved) return saved;
        const systemPrefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        const detected = systemPrefersDark ? "dark" : "light";
        localStorage.setItem("theme", detected);
        return detected;
    });
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
        localStorage.removeItem("token");
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        setRole(null);
        setUser(null);
        setProfile(null);
        window.location.href = "/login";
    };

    useEffect(() => {
        const validateSession = async () => {
            const storedToken = localStorage.getItem("accessToken") || localStorage.getItem("token");
            const storedRefreshToken = localStorage.getItem("refreshToken");

            try {
                const headers = {};
                if (storedToken) headers.Authorization = `Bearer ${storedToken}`;
                if (storedRefreshToken) headers["x-refresh-token"] = storedRefreshToken;

                const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken: storedRefreshToken }, {
                    withCredentials: true,
                    headers
                });

                if (res.data?.accessToken || res.data?.token) {
                    const newToken = res.data.accessToken || res.data.token;
                    localStorage.setItem("accessToken", newToken);
                    localStorage.setItem("token", newToken);
                }
            } catch {
                if (!storedToken && !storedRefreshToken) {
                    localStorage.removeItem("role");
                    setRole(null);
                }
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
                const storedToken = localStorage.getItem("accessToken") || localStorage.getItem("token");
                const headers = storedToken ? { Authorization: `Bearer ${storedToken}` } : {};
                const res = await axios.get(`${API_BASE_URL}/auth/profile`, {
                    withCredentials: true,
                    headers
                });
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
        if (!role) return;
        const interval = setInterval(async () => {
            try {
                await axios.get(`${API_BASE_URL}/api/ping`);
            } catch (e) {
                // Ignore silent background ping errors
            }
        }, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [role]);


    useEffect(() => {
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleSystemThemeChange = (e) => {
            if (!localStorage.getItem("theme_user_selected")) {
                const newSystemTheme = e.matches ? "dark" : "light";
                setTheme(newSystemTheme);
            }
        };

        if (mediaQuery?.addEventListener) {
            mediaQuery.addEventListener("change", handleSystemThemeChange);
            return () => mediaQuery.removeEventListener("change", handleSystemThemeChange);
        }
    }, []);

    useEffect(() => {
        localStorage.setItem("theme", theme);
        document.documentElement.classList.remove("theme-light", "theme-dark");
        document.documentElement.classList.add(`theme-${theme}`);
        if (document.body) {
            document.body.classList.remove("theme-light", "theme-dark");
            document.body.classList.add(`theme-${theme}`);
        }
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => {
            const next = prev === "light" ? "dark" : "light";
            localStorage.setItem("theme_user_selected", "true");
            return next;
        });
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
