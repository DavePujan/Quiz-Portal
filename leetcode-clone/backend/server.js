require("dotenv").config();
const dns = require("dns");
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder("ipv4first");
}
const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");
const submitRoutes = require("./routes/submit");

const authRoutes = require("./routes/auth");
const teacherRoutes = require("./routes/teacher");
const studentRoutes = require("./routes/student");
const { auth, authorize } = require("./middleware/auth");

const cookieParser = require("cookie-parser");
require("./utils/passport"); // Config passport
const adminRoutes = require("./routes/admin");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || "http://localhost:5173",
        credentials: true
    }
});

const { createAdapter } = require("@socket.io/redis-adapter");
const redisClient = require("./config/redis");
if (redisClient.duplicateClient) {
    const pubClient = redisClient.duplicateClient();
    const subClient = redisClient.duplicateClient();
    io.adapter(createAdapter(pubClient, subClient));
}

app.set("io", io);

io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("join-job", (jobId) => {
        if (!jobId) return;
        socket.join(String(jobId));
    });

    // Worker process pushes updates here; server fans out to job room listeners.
    socket.on("worker-status", ({ jobId, payload }) => {
        if (!jobId || !payload) return;
        io.to(String(jobId)).emit("status", {
            jobId: String(jobId),
            ...payload
        });
    });

    socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
    });
});

app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
    exposedHeaders: ["Content-Disposition"]
})); // Important for cookies and download filename headers
app.use(express.json());
app.use(cookieParser());

app.use("/auth", authRoutes);

// Metrics Collection Middleware - Prometheus
// to track method, route, and status code
const { client, httpRequests } = require("./metrics");
app.use((req, res, next) => {
    res.on("finish", () => {
        httpRequests.inc({
            method: req.method,
            route: req.route?.path || req.url,
            status: res.statusCode,
        });
    });
    next();
});

// /metrics endpoint - Used by Prometheus to scrape metrics
app.get("/metrics", async (req, res) => {
    res.set("Content-Type", client.register.contentType);
    res.end(await client.register.metrics());
});

// Debug Logging
app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url} `);
    next();
});

app.get("/health", (req, res) => res.status(200).send("OK"));

app.use("/api/teacher", auth, authorize('teacher'), teacherRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/master", auth, authorize('master_admin'), require("./routes/master"));
app.use("/api/analytics", require("./routes/analytics"));
app.use("/api", submitRoutes);
app.use("/api/job", require("./routes/job"));

const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger-output.json');

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(`[ERROR] ${err.message}`);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Internal Server Error"
    });
});

if (require.main === module) {
    const PORT = process.env.PORT || 5000;

    server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
            console.error(`Port ${PORT} is already in use. Stop the other backend server instance, then restart.`);
            return;
        }
        console.error("Server startup error:", err.message);
    });

    server.listen(PORT, () => {
        console.log(`Backend running on port ${PORT}`);
    });
}

module.exports = app;
