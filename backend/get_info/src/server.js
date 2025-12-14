const express = require("express");
const cors = require("cors");
const UserDetector = require("./services/detector");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
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

// API Route - Get current user's full detection info
app.get("/api/detect", (req, res) => {
  const detector = new UserDetector(req);
  const detection = detector.getFullDetection();
  res.json(detection);
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
