const https = require("https");
const http = require("http");

/**
 * Starts a background keep-alive self-pinger for Render.
 * Sends a GET request every 10 minutes to prevent Render free instance from sleeping.
 */
function startKeepAlive() {
    const rawUrl = process.env.BACKEND_EXTERNAL_URL || "https://quiz-portal-backend-b3uw.onrender.com";
    const targetUrl = `${rawUrl.replace(/\/$/, "")}/health`;

    console.log(`[Keep-Alive] Self-pinger initialized for: ${targetUrl}`);

    // Ping immediately on boot after 10 seconds delay
    setTimeout(() => ping(targetUrl), 10000);

    // Ping every 10 minutes (600,000 ms)
    setInterval(() => ping(targetUrl), 10 * 60 * 1000);
}

function ping(url) {
    try {
        const client = url.startsWith("https") ? https : http;
        const req = client.get(url, (res) => {
            console.log(`[Keep-Alive] Ping to ${url} returned status: ${res.statusCode}`);
        });

        req.on("error", (err) => {
            console.warn(`[Keep-Alive] Ping request failed: ${err.message}`);
        });

        req.end();
    } catch (e) {
        console.warn(`[Keep-Alive] Exception during ping: ${e.message}`);
    }
}

module.exports = { startKeepAlive };
