const express = require("express");
const router = express.Router();
const axios = require("axios");
const Lead = require("../models/Lead");
const sessionSecurity = require("../utils/sessionSecurity");

// Configuration for EC2 GUI Browser service
const EC2_GUI_BROWSER_URL =
  process.env.EC2_GUI_BROWSER_URL || "http://your-ec2-ip:3001";

/**
 * Create a new GUI browser session
 */
router.post("/sessions", async (req, res) => {
  try {
    const { leadId } = req.body;
    const userAgent = req.get("User-Agent");
    const ipAddress = req.ip || req.connection.remoteAddress;

    console.log("🖥️ GUI browser session requested for lead:", leadId);

    // Validate lead exists and user has access
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // Check user permissions
    if (req.user.role === "agent") {
      if (lead.assignedAgent?.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access denied - lead not assigned to you",
        });
      }
    } else if (req.user.role === "affiliate_manager") {
      if (
        lead.assignedAgent?.toString() !== req.user._id.toString() &&
        lead.createdBy?.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "Access denied - lead not assigned to you",
        });
      }
    }

    // Get existing session or create new one
    let sessionData;
    if (lead.hasActiveBrowserSession()) {
      const encryptedSessionData = lead.getCurrentBrowserSession();
      try {
        sessionData = sessionSecurity.decryptSessionData(encryptedSessionData);
        console.log("📋 Using existing session:", sessionData.sessionId);
      } catch (decryptionError) {
        console.error("❌ Session decryption failed:", decryptionError);
        return res.status(500).json({
          success: false,
          message: "Failed to decrypt session data",
        });
      }
    } else {
      // Create new session data
      const sessionId = `gui_session_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // Get device fingerprint if available
      let fingerprintConfig = null;
      let deviceViewport = { width: 1920, height: 1080 };
      let deviceUserAgent =
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

      if (lead.fingerprint) {
        try {
          const fingerprint = await lead.getFingerprint();
          if (fingerprint) {
            deviceViewport = {
              width: fingerprint.screen.availWidth || fingerprint.screen.width,
              height:
                fingerprint.screen.availHeight || fingerprint.screen.height,
            };
            deviceUserAgent = fingerprint.navigator.userAgent;
          }
        } catch (error) {
          console.error("❌ Failed to get fingerprint:", error);
        }
      }

      sessionData = {
        sessionId: sessionId,
        leadId: leadId,
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        userAgent: deviceUserAgent,
        viewport: deviceViewport,
        domain: null,
        leadInfo: {
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.newEmail,
          phone: lead.newPhone,
          country: lead.country,
          countryCode: lead.countryCode,
        },
        metadata: {
          createdAt: new Date(),
          createdBy: req.user._id.toString(),
          userRole: req.user.role,
          ipAddress: ipAddress,
          userAgent: userAgent,
        },
      };

      console.log("🆕 Created new session:", sessionId);
    }

    // Send session data to EC2 GUI Browser service
    try {
      console.log("🚀 Sending session to EC2 GUI Browser service...");

      const response = await axios.post(
        `${EC2_GUI_BROWSER_URL}/sessions`,
        {
          sessionId: sessionData.sessionId,
          leadId: sessionData.leadId,
          cookies: sessionData.cookies,
          localStorage: sessionData.localStorage,
          sessionStorage: sessionData.sessionStorage,
          userAgent: sessionData.userAgent,
          viewport: sessionData.viewport,
          domain: sessionData.domain,
          leadInfo: sessionData.leadInfo,
        },
        {
          timeout: 30000,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.success) {
        console.log("✅ GUI browser session created successfully");

        // Log session access
        sessionSecurity.logSessionAccess({
          sessionId: sessionData.sessionId,
          leadId: leadId,
          userId: req.user._id.toString(),
          userRole: req.user.role,
          action: "gui_browser_session_created",
          ipAddress: ipAddress,
          userAgent: userAgent,
          success: true,
          metadata: {
            sessionStatus: response.data.sessionStatus,
          },
        });

        // Update lead's last access time
        lead.updateSessionAccess(sessionData.sessionId);
        await lead.save();

        res.json({
          success: true,
          message: "GUI browser session created successfully",
          data: {
            sessionId: sessionData.sessionId,
            sessionStatus: response.data.sessionStatus,
            leadInfo: {
              name: `${lead.firstName} ${lead.lastName}`,
              email: lead.newEmail,
            },
            instructions: {
              title: "Access Your GUI Browser Session",
              steps: [
                "The browser session has been created",
                "The browser will open with your lead's session restored",
                "Fill out forms and interact normally",
                "Monitor the session status",
                "Close the session when finished",
              ],
            },
          },
        });
      } else {
        throw new Error(
          response.data.message || "Failed to create GUI browser session"
        );
      }
    } catch (error) {
      console.error(
        "❌ Error communicating with EC2 GUI Browser service:",
        error.message
      );

      // Log failed session creation
      sessionSecurity.logSessionAccess({
        sessionId: sessionData.sessionId,
        leadId: leadId,
        userId: req.user._id.toString(),
        userRole: req.user.role,
        action: "gui_browser_session_failed",
        ipAddress: ipAddress,
        userAgent: userAgent,
        success: false,
        errorMessage: error.message,
      });

      return res.status(500).json({
        success: false,
        message: "Failed to create GUI browser session",
        error: error.message,
        troubleshooting: {
          title: "Troubleshooting Steps",
          steps: [
            "Check if EC2 instance is running",
            "Verify EC2 security groups allow connections",
            "Check EC2_GUI_BROWSER_URL environment variable",
            "Review EC2 instance logs for errors",
          ],
        },
      });
    }
  } catch (error) {
    console.error("❌ Error in GUI browser session creation:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

/**
 * Get status of a GUI browser session
 */
router.get("/sessions/:sessionId/status", async (req, res) => {
  try {
    const { sessionId } = req.params;

    console.log("📊 Checking GUI browser session status:", sessionId);

    const response = await axios.get(
      `${EC2_GUI_BROWSER_URL}/sessions/${sessionId}`,
      {
        timeout: 10000,
      }
    );

    res.json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error("❌ Error checking session status:", error.message);

    if (error.response?.status === 404) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to check session status",
      error: error.message,
    });
  }
});

/**
 * Stop a GUI browser session
 */
router.delete("/sessions/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;

    console.log("🛑 Stopping GUI browser session:", sessionId);

    const response = await axios.delete(
      `${EC2_GUI_BROWSER_URL}/sessions/${sessionId}`,
      {
        timeout: 10000,
      }
    );

    // Log session termination
    sessionSecurity.logSessionAccess({
      sessionId: sessionId,
      leadId: "unknown",
      userId: req.user._id.toString(),
      userRole: req.user.role,
      action: "gui_browser_session_stopped",
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get("User-Agent"),
      success: true,
    });

    res.json({
      success: true,
      message: "GUI browser session stopped successfully",
    });
  } catch (error) {
    console.error("❌ Error stopping session:", error.message);

    if (error.response?.status === 404) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to stop session",
      error: error.message,
    });
  }
});

/**
 * List all active GUI browser sessions
 */
router.get("/sessions", async (req, res) => {
  try {
    console.log("📋 Listing all GUI browser sessions");

    const response = await axios.get(`${EC2_GUI_BROWSER_URL}/sessions`, {
      timeout: 10000,
    });

    res.json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error("❌ Error listing sessions:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to list sessions",
      error: error.message,
    });
  }
});

/**
 * Health check for EC2 GUI Browser service
 */
router.get("/health", async (req, res) => {
  try {
    const response = await axios.get(`${EC2_GUI_BROWSER_URL}/`, {
      timeout: 5000,
    });

    res.json({
      success: true,
      message: "EC2 GUI Browser service is healthy",
      data: response.data,
    });
  } catch (error) {
    console.error(
      "❌ EC2 GUI Browser service health check failed:",
      error.message
    );

    res.status(503).json({
      success: false,
      message: "EC2 GUI Browser service is unavailable",
      error: error.message,
    });
  }
});

module.exports = router;
