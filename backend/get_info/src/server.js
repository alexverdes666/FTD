const express = require("express");
const cors = require("cors");
const UserDetector = require("./services/detector");

const app = express();
const PORT = process.env.PORT || 3000;

// CORS Configuration - Allow all origins for maximum compatibility
const corsOptions = {
  origin: true, // Allow all origins
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Forwarded-For",
    "X-Real-IP",
    "CF-Connecting-IP",
    "User-Agent",
    "Accept",
    "Accept-Language",
    "Accept-Encoding",
    "Origin",
    "Referer",
    "Sec-CH-UA",
    "Sec-CH-UA-Mobile",
    "Sec-CH-UA-Platform",
    "Sec-CH-UA-Platform-Version",
    "Sec-CH-UA-Arch",
    "Sec-CH-UA-Bitness",
    "Sec-CH-UA-Model",
    "DNT",
    "Sec-GPC",
    "Sec-Fetch-Site",
    "Sec-Fetch-Mode",
    "Sec-Fetch-Dest",
  ],
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Request Client Hints for more detailed detection
app.use((req, res, next) => {
  res.setHeader(
    "Accept-CH",
    "Sec-CH-UA, Sec-CH-UA-Mobile, Sec-CH-UA-Platform, Sec-CH-UA-Platform-Version, Sec-CH-UA-Arch, Sec-CH-UA-Bitness, Sec-CH-UA-Model, Sec-CH-UA-Full-Version-List, Device-Memory, DPR, Viewport-Width, ECT, RTT, Downlink"
  );
  res.setHeader("Critical-CH", "Sec-CH-UA-Platform");
  next();
});

// Logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.ip;
  console.log(`[${timestamp}] ${req.method} ${req.path} from ${ip}`);
  next();
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "get_info",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Route - Get current user's full detection info
app.get("/api/detect", (req, res) => {
  try {
    const detector = new UserDetector(req);
    const detection = detector.getFullDetection();
    console.log(
      `[SUCCESS] Detection completed for ${detection.ip?.clientIp || "unknown"}`
    );
    res.json(detection);
  } catch (error) {
    console.error("[ERROR] Detection failed:", error.message);
    res.status(500).json({
      error: "Detection failed",
      message: error.message,
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

// Start server
app.listen(PORT, () => {
  console.log("");
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║                                                            ║");
  console.log("║   🔍 USER DETECTION API                                    ║");
  console.log("║                                                            ║");
  console.log(
    `║   Server running on http://localhost:${PORT}                  ║`
  );
  console.log("║                                                            ║");
  console.log("║   Endpoint:                                                ║");
  console.log("║   • GET  /api/detect - Get user detection data             ║");
  console.log("║                                                            ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log("");
});

module.exports = app;
