const jwt = require("jsonwebtoken");

const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const redisClient = require("../config/redis");
const crypto = require("crypto");

exports.auth = async (req, res, next) => {
    const token = req.cookies.accessToken || req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    try {
        let isBlacklisted = false;
        let hash = null;
        if (redisClient.isAvailable) {
            // Crypto hashing for highly optimized memory usage in Redis
            hash = crypto.createHash("sha256").update(token).digest("hex");
            req.tokenHash = hash; // Exposing optimized hash to downstream endpoints
            isBlacklisted = await redisClient.get(`bl_${hash}`);
        }
        if (isBlacklisted) return res.status(401).json({ error: "Token expired or blacklisted" });

        req.user = jwt.verify(token, process.env.JWT_SECRET);

        // Check Maintenance Mode
        try {
            let isMaintenanceMode = false;
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
