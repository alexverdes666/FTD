/**
 * Fingerprint Browser Routes
 * API endpoints for managing browser sessions with fingerprint spoofing
 */

const express = require("express");
const router = express.Router();
const fingerprintBrowserService = require("../services/fingerprintBrowserService");
const browserStreamService = require("../services/browserStreamService");
const Lead = require("../models/Lead");
const sessionSecurity = require("../utils/sessionSecurity");
const { protect, isAdmin, authorize } = require("../middleware/auth");

/**
 * @route   POST /api/fingerprint-browser/sessions
 * @desc    Create a new browser session for a lead
 * @access  Private
 */
router.post("/sessions", protect, async (req, res) => {
  try {
    const { leadId, proxy, headless } = req.body;
    const userId = req.user._id;
    const userAgent = req.get("User-Agent");
    const ipAddress = req.ip || req.connection.remoteAddress;

    console.log("🖥️ Fingerprint browser session requested for lead:", leadId);

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

    // Create browser session
    const session = await fingerprintBrowserService.createSession(leadId, userId, {
      proxy,
      headless,
    });

    // Log session access
    sessionSecurity.logSessionAccess({
      sessionId: session.sessionId,
      leadId: leadId,
      userId: userId.toString(),
      userRole: req.user.role,
      action: "fingerprint_browser_session_created",
      ipAddress: ipAddress,
      userAgent: userAgent,
      success: true,
      metadata: {
        fingerprint: session.fingerprint,
        port: session.port,
      },
    });

    res.json({
      success: true,
      message: "Fingerprint browser session created successfully",
      data: {
        sessionId: session.sessionId,
        port: session.port,
        viewport: session.viewport,
        fingerprint: session.fingerprint,
        leadInfo: session.leadInfo,
        vncUrl: `/api/fingerprint-browser/sessions/${session.sessionId}/vnc`,
        instructions: {
          title: "Browser Session Active",
          steps: [
            "Browser is running with spoofed fingerprint",
            "Use the API to navigate, fill forms, or take screenshots",
            "Connect via VNC for visual interaction",
            "Session will auto-save when closed",
          ],
        },
      },
    });
  } catch (error) {
    console.error("❌ Error creating fingerprint browser session:", error);

    // Log failed session creation
    sessionSecurity.logSessionAccess({
      sessionId: "unknown",
      leadId: req.body.leadId,
      userId: req.user._id.toString(),
      userRole: req.user.role,
      action: "fingerprint_browser_session_failed",
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get("User-Agent"),
      success: false,
      errorMessage: error.message,
    });

    res.status(500).json({
      success: false,
      message: error.message || "Failed to create browser session",
      troubleshooting: {
        title: "Troubleshooting Steps",
        steps: [
          "Check if fingerprint-chromium is installed",
          "Verify DISPLAY environment variable is set",
          "Check system resources (memory/CPU)",
          "Review server logs for details",
        ],
      },
    });
  }
});

/**
 * @route   GET /api/fingerprint-browser/sessions
 * @desc    List all active browser sessions
 * @access  Private (admin only)
 */
router.get("/sessions", protect, isAdmin, async (req, res) => {
  try {
    const sessions = fingerprintBrowserService.getAllSessions();

    res.json({
      success: true,
      data: {
        count: sessions.length,
        sessions,
      },
    });
  } catch (error) {
    console.error("❌ Error listing sessions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to list sessions",
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/fingerprint-browser/sessions/:sessionId
 * @desc    Get session status and info
 * @access  Private
 */
router.get("/sessions/:sessionId", protect, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = fingerprintBrowserService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    res.json({
      success: true,
      data: session,
    });
  } catch (error) {
    console.error("❌ Error getting session:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get session",
      error: error.message,
    });
  }
});

/**
 * @route   DELETE /api/fingerprint-browser/sessions/:sessionId
 * @desc    Close a browser session
 * @access  Private
 */
router.delete("/sessions/:sessionId", protect, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { saveSession = true } = req.query;

    await fingerprintBrowserService.closeSession(sessionId, saveSession === "true" || saveSession === true);

    // Log session termination
    sessionSecurity.logSessionAccess({
      sessionId: sessionId,
      leadId: "unknown",
      userId: req.user._id.toString(),
      userRole: req.user.role,
      action: "fingerprint_browser_session_stopped",
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get("User-Agent"),
      success: true,
    });

    res.json({
      success: true,
      message: "Browser session closed successfully",
    });
  } catch (error) {
    console.error("❌ Error closing session:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to close session",
    });
  }
});

/**
 * @route   POST /api/fingerprint-browser/sessions/:sessionId/navigate
 * @desc    Navigate to a URL
 * @access  Private
 */
router.post("/sessions/:sessionId/navigate", protect, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: "URL is required",
      });
    }

    const result = await fingerprintBrowserService.navigateTo(sessionId, url);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("❌ Error navigating:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to navigate",
    });
  }
});

/**
 * @route   POST /api/fingerprint-browser/sessions/:sessionId/screenshot
 * @desc    Take a screenshot of the current page
 * @access  Private
 */
router.post("/sessions/:sessionId/screenshot", protect, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { type = "jpeg", quality = 80, fullPage = false } = req.body;

    const screenshot = await fingerprintBrowserService.takeScreenshot(sessionId, {
      type,
      quality,
      fullPage,
    });

    res.json({
      success: true,
      data: {
        image: screenshot,
        type,
      },
    });
  } catch (error) {
    console.error("❌ Error taking screenshot:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to take screenshot",
    });
  }
});

/**
 * @route   POST /api/fingerprint-browser/sessions/:sessionId/fill
 * @desc    Fill form fields
 * @access  Private
 */
router.post("/sessions/:sessionId/fill", protect, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { fields } = req.body;

    if (!fields || !Array.isArray(fields)) {
      return res.status(400).json({
        success: false,
        message: "Fields array is required",
      });
    }

    const results = await fingerprintBrowserService.fillForm(sessionId, fields);

    res.json({
      success: true,
      data: {
        results,
        successCount: results.filter(r => r.success).length,
        failCount: results.filter(r => !r.success).length,
      },
    });
  } catch (error) {
    console.error("❌ Error filling form:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fill form",
    });
  }
});

/**
 * @route   POST /api/fingerprint-browser/sessions/:sessionId/click
 * @desc    Click an element
 * @access  Private
 */
router.post("/sessions/:sessionId/click", protect, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { selector, waitForSelector = true, timeout = 5000 } = req.body;

    if (!selector) {
      return res.status(400).json({
        success: false,
        message: "Selector is required",
      });
    }

    const result = await fingerprintBrowserService.click(sessionId, selector, {
      waitForSelector,
      timeout,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("❌ Error clicking:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to click element",
    });
  }
});

/**
 * @route   POST /api/fingerprint-browser/sessions/:sessionId/execute
 * @desc    Execute JavaScript in page context
 * @access  Private
 */
router.post("/sessions/:sessionId/execute", protect, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { script } = req.body;

    if (!script) {
      return res.status(400).json({
        success: false,
        message: "Script is required",
      });
    }

    const result = await fingerprintBrowserService.executeScript(sessionId, script);

    res.json({
      success: true,
      data: {
        result,
      },
    });
  } catch (error) {
    console.error("❌ Error executing script:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to execute script",
    });
  }
});

/**
 * @route   GET /api/fingerprint-browser/sessions/:sessionId/content
 * @desc    Get page HTML content
 * @access  Private
 */
router.get("/sessions/:sessionId/content", protect, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const content = await fingerprintBrowserService.getPageContent(sessionId);

    res.json({
      success: true,
      data: content,
    });
  } catch (error) {
    console.error("❌ Error getting content:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get page content",
    });
  }
});

/**
 * @route   POST /api/fingerprint-browser/sessions/:sessionId/stream/start
 * @desc    Start streaming browser screenshots via Socket.IO
 * @access  Private
 */
router.post("/sessions/:sessionId/stream/start", protect, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { fps = 5, quality = 60 } = req.body;
    const userId = req.user._id.toString();

    const result = browserStreamService.startStream(sessionId, userId, {
      fps: Math.min(fps, 15), // Cap at 15 FPS
      quality: Math.min(quality, 90),
    });

    res.json({
      success: true,
      message: "Stream started successfully",
      data: {
        ...result,
        instructions: {
          title: "Join Stream via Socket.IO",
          steps: [
            `Join room: socket.emit('join_room', '${result.room}')`,
            "Listen for frames: socket.on('browser:frame', (data) => ...)",
            "Frame data includes: { sessionId, image (base64), url, title, timestamp }",
          ],
        },
      },
    });
  } catch (error) {
    console.error("❌ Error starting stream:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to start stream",
    });
  }
});

/**
 * @route   POST /api/fingerprint-browser/sessions/:sessionId/stream/stop
 * @desc    Stop streaming for a browser session
 * @access  Private
 */
router.post("/sessions/:sessionId/stream/stop", protect, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id.toString();

    browserStreamService.removeClient(sessionId, userId);

    res.json({
      success: true,
      message: "Stopped streaming",
    });
  } catch (error) {
    console.error("❌ Error stopping stream:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to stop stream",
    });
  }
});

/**
 * @route   GET /api/fingerprint-browser/sessions/:sessionId/stream/status
 * @desc    Get stream status for a browser session
 * @access  Private
 */
router.get("/sessions/:sessionId/stream/status", protect, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const status = browserStreamService.getStreamStatus(sessionId);

    if (!status) {
      return res.status(404).json({
        success: false,
        message: "No active stream for this session",
      });
    }

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error("❌ Error getting stream status:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get stream status",
    });
  }
});

/**
 * @route   POST /api/fingerprint-browser/sessions/:sessionId/input/mouse
 * @desc    Send mouse event to browser
 * @access  Private
 */
router.post("/sessions/:sessionId/input/mouse", protect, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { type, x, y, button } = req.body;

    if (!type || x === undefined || y === undefined) {
      return res.status(400).json({
        success: false,
        message: "type, x, and y are required",
      });
    }

    const result = await browserStreamService.handleMouseEvent(sessionId, {
      type,
      x,
      y,
      button,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("❌ Error handling mouse event:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to handle mouse event",
    });
  }
});

/**
 * @route   POST /api/fingerprint-browser/sessions/:sessionId/input/keyboard
 * @desc    Send keyboard event to browser
 * @access  Private
 */
router.post("/sessions/:sessionId/input/keyboard", protect, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { type, key, text } = req.body;

    if (!type) {
      return res.status(400).json({
        success: false,
        message: "type is required",
      });
    }

    const result = await browserStreamService.handleKeyboardEvent(sessionId, {
      type,
      key,
      text,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("❌ Error handling keyboard event:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to handle keyboard event",
    });
  }
});

/**
 * @route   POST /api/fingerprint-browser/sessions/:sessionId/input/scroll
 * @desc    Send scroll event to browser
 * @access  Private
 */
router.post("/sessions/:sessionId/input/scroll", protect, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { deltaX, deltaY, x, y } = req.body;

    const result = await browserStreamService.handleScrollEvent(sessionId, {
      deltaX,
      deltaY,
      x,
      y,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("❌ Error handling scroll event:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to handle scroll event",
    });
  }
});

/**
 * @route   GET /api/fingerprint-browser/streams
 * @desc    List all active streams (admin only)
 * @access  Private (admin)
 */
router.get("/streams", protect, isAdmin, async (req, res) => {
  try {
    const streams = browserStreamService.getAllStreams();

    res.json({
      success: true,
      data: {
        count: streams.length,
        streams,
      },
    });
  } catch (error) {
    console.error("❌ Error listing streams:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to list streams",
    });
  }
});

/**
 * @route   GET /api/fingerprint-browser/health
 * @desc    Health check for fingerprint browser service
 * @access  Public
 */
router.get("/health", async (req, res) => {
  try {
    const fs = require("fs");
    const chromiumPath = process.env.FINGERPRINT_CHROMIUM_PATH || "/opt/fingerprint-chromium/chrome";
    const chromiumInstalled = fs.existsSync(chromiumPath);

    const sessions = fingerprintBrowserService.getAllSessions();

    res.json({
      success: true,
      message: "Fingerprint browser service is running",
      data: {
        chromiumInstalled,
        chromiumPath,
        activeSessions: sessions.length,
        maxSessions: parseInt(process.env.MAX_BROWSER_SESSIONS) || 5,
        display: process.env.DISPLAY || ":99",
      },
    });
  } catch (error) {
    console.error("❌ Health check failed:", error);
    res.status(503).json({
      success: false,
      message: "Fingerprint browser service is unavailable",
      error: error.message,
    });
  }
});

module.exports = router;
