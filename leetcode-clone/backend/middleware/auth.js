const jwt = require("jsonwebtoken");

const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const redisClient = require("../config/redis");
const crypto = require("crypto");

// In-memory caching layers to eliminate 95%+ of Redis reads on every HTTP request
const localBlacklistCache = new Map(); // hash -> { isBlacklisted: boolean, expiresAt: number }
let localMaintenanceCache = { isMaintenanceMode: false, expiresAt: 0 };

function getLocalBlacklist(hash) {
    const entry = localBlacklistCache.get(hash);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        localBlacklistCache.delete(hash);
        return null;
    }
    return entry.isBlacklisted;
}

function setLocalBlacklist(hash, isBlacklisted, ttlMs = 60000) {
    localBlacklistCache.set(hash, {
        isBlacklisted,
        expiresAt: Date.now() + ttlMs
    });
}

exports.setLocalBlacklist = setLocalBlacklist;

exports.auth = async (req, res, next) => {
    const token = req.cookies.accessToken || req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    try {
        let isBlacklisted = false;
        let hash = null;

        if (redisClient.isAvailable) {
            hash = crypto.createHash("sha256").update(token).digest("hex");
            req.tokenHash = hash;

            // 1. Check local Node.js memory cache first (0 Redis commands)
            const localResult = getLocalBlacklist(hash);
            if (localResult !== null) {
                isBlacklisted = localResult;
            } else {
                // 2. Cache miss -> query Redis once and cache result locally for 60 seconds
                try {
                    const redisRes = await redisClient.get(`bl_${hash}`);
                    isBlacklisted = Boolean(redisRes);
                    setLocalBlacklist(hash, isBlacklisted, isBlacklisted ? 3600000 : 60000);
                } catch (rErr) {
                    console.error("Redis get blacklist failed in auth middleware:", rErr);
                }
            }
        }

        if (isBlacklisted) return res.status(401).json({ error: "Token expired or blacklisted" });

        req.user = jwt.verify(token, process.env.JWT_SECRET);

        // Check Maintenance Mode with 30s in-memory TTL
        try {
            let isMaintenanceMode = false;

            if (Date.now() < localMaintenanceCache.expiresAt) {
                isMaintenanceMode = localMaintenanceCache.isMaintenanceMode;
            } else {
                let mSettingCache = null;
                if (redisClient.isAvailable) {
                    try {
                        mSettingCache = await redisClient.get("settings:maintenanceMode");
                    } catch (rErr) {
                        console.error("Redis get settings:maintenanceMode failed in auth middleware:", rErr);
                    }
                }

                if (mSettingCache !== null) {
                    isMaintenanceMode = JSON.parse(mSettingCache);
                } else {
                    const { data: mSetting } = await supabase.from("settings").select("value").eq("key", "maintenanceMode").maybeSingle();
                    if (mSetting) isMaintenanceMode = mSetting.value;
                    if (redisClient.isAvailable) {
                        try {
                            await redisClient.set("settings:maintenanceMode", JSON.stringify(isMaintenanceMode), "EX", 60);
                        } catch (rErr) {
                            console.error("Redis set settings:maintenanceMode failed in auth middleware:", rErr);
                        }
                    }
                }

                // Cache in Node memory for 30s
                localMaintenanceCache = {
                    isMaintenanceMode: Boolean(isMaintenanceMode),
                    expiresAt: Date.now() + 30000
                };
            }

            if (isMaintenanceMode === true && req.user.role !== 'master_admin') {
                return res.status(503).json({ error: "System is in maintenance mode." });
            }
        } catch (sErr) {
            console.error("Maintenance check failed, proceeding anyway", sErr);
        }

        next();
    } catch (err) {
        res.status(401).json({ error: "Invalid token" });
    }
};

exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: "Forbidden" });
        }
        next();
    };
};
