const express = require("express");
const cors = require("cors");
const UserDetector = require("./services/detector");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware - Allow all origins for internal service
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["*"],
    credentials: false,
  })
);
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

// Health check endpoint for Render
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "get_info",
    timestamp: new Date().toISOString(),
  });
});

// Root endpoint with service info
app.get("/", (req, res) => {
  res.json({
    service: "User Detection API",
    version: "1.0.0",
    endpoints: {
      detect: "/api/detect",
      health: "/health",
    },
  });
});

// API Route - Get current user's full detection info
app.get("/api/detect", (req, res) => {
  try {
    console.log(
      `[${new Date().toISOString()}] Detection request from IP: ${
        req.headers["x-forwarded-for"] || req.ip
      }`
    );

    const detector = new UserDetector(req);
    const detection = detector.getFullDetection();

    console.log(
      `[${new Date().toISOString()}] Detection successful for IP: ${
        detection.ip?.clientIp
      }`
    );

    res.json(detection);
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Detection error:`,
      error.message
    );
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
