const router = require("express").Router();
const leaderboard = require("../models/Leaderboard"); // Using in-memory array (acting as Mock DB)
const redisClient = require("../config/redis");

router.get("/:questionId", async (req, res) => {
    console.log("Accessing leaderboard for:", req.params.questionId);
    const { questionId } = req.params;
    // Updated namespace for better scalable pattern matching
    const cacheKey = `leaderboard:question:${questionId}`;

    try {
        //  Check Cache First
        let cached = null;
        if (redisClient.isAvailable) {
            cached = await redisClient.get(cacheKey);
        }

        if (cached) {
            console.log("⚡ Serving leaderboard from Redis Cache");
            return res.json(JSON.parse(cached));
        }

        //  If not in cache → Fetch from DB (Simulated via array methods)
        const entries = leaderboard.filter(e => e.questionId === questionId);

        // Sort: Runtime ASC, then Memory ASC (Optimized parsing)
        entries.sort((a, b) => {
            const rA = Number(a.runtime);
            const rB = Number(b.runtime);
            if (rA !== rB) return rA - rB;
            return Number(a.memory) - Number(b.memory);
        });

        const top10 = entries.slice(0, 10);

        //  Store deeply processed result in Redis (Expire in 60s)
        if (redisClient.isAvailable) {
            await redisClient.set(cacheKey, JSON.stringify(top10), "EX", 60);
        }

        res.json(top10);
    } catch (err) {
        console.error("Leaderboard Cache Error:", err.message);
        res.status(500).json({ message: "Error fetching leaderboard" });
    }
});

module.exports = router;
