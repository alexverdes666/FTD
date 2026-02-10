const express = require("express");
const router = express.Router();
const AgentCheckin = require("../models/AgentCheckin");

/**
 * POST /api/agent-checkin
 *
 * Receives a heartbeat from the FTD Local Agent running on user machines.
 * No authentication required — the agent doesn't have user tokens.
 * Security: entries are keyed by source IP + hostname, auto-expire after 24h.
 */
router.post("/", async (req, res) => {
  try {
    const { hostname, username, platform, ips, agentVersion } = req.body;

    if (!hostname) {
      return res.status(400).json({ error: "hostname is required" });
    }

    // Get the agent's public IP from the request
    const publicIP =
      req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
      req.headers["x-real-ip"] ||
      req.ip ||
      "unknown";

    // Upsert: update if exists, create if not
    await AgentCheckin.findOneAndUpdate(
      { publicIP, hostname },
      {
        publicIP,
        hostname,
        username,
        platform,
        ips,
        agentVersion,
        lastSeenAt: new Date(),
      },
      { upsert: true, new: true }
    );

    res.json({ ok: true });
  } catch (error) {
    console.error("[AgentCheckin] Error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/agent-checkin/lookup?ip=x.x.x.x
 *
 * Internal helper: look up agent checkin data by public IP.
 * Used by device detection middleware. Not exposed to frontend.
 */
router.get("/lookup", async (req, res) => {
  try {
    const { ip } = req.query;
    if (!ip) return res.status(400).json({ error: "ip query param required" });

    const entries = await AgentCheckin.find({ publicIP: ip })
      .sort({ lastSeenAt: -1 })
      .limit(5)
      .lean();

    res.json(entries);
  } catch (error) {
    console.error("[AgentCheckin] Lookup error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
