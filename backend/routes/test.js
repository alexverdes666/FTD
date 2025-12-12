const express = require("express");
const router = express.Router();
const { spawn } = require("child_process");
const path = require("path");
const Lead = require("../models/Lead");
router.post("/browser-session", async (req, res) => {
  try {
    const { leadId, leadInfo } = req.body;
    console.log("🧪 Test browser session requested for lead:", leadId);
    console.log("Lead info:", leadInfo);
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }
    let fingerprintConfig = null;
    let deviceViewport = { width: 1366, height: 768 };
    let deviceUserAgent =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    if (lead.fingerprint) {
      try {
        const fingerprint = await lead.getFingerprint();
        if (fingerprint) {
          console.log(
            `📱 Using device fingerprint: ${fingerprint.deviceType} (${fingerprint.deviceId})`
          );
          deviceViewport = {
            width: fingerprint.screen.availWidth || fingerprint.screen.width,
            height: fingerprint.screen.availHeight || fingerprint.screen.height,
          };
          deviceUserAgent = fingerprint.navigator.userAgent;
          fingerprintConfig = {
            deviceId: fingerprint.deviceId,
            deviceType: fingerprint.deviceType,
            browser: fingerprint.browser,
            screen: fingerprint.screen,
            navigator: fingerprint.navigator,
            webgl: fingerprint.webgl,
            canvasFingerprint: fingerprint.canvasFingerprint,
            audioFingerprint: fingerprint.audioFingerprint,
            timezone: fingerprint.timezone,
            plugins: fingerprint.plugins,
            mobile: fingerprint.mobile,
            additional: fingerprint.additional,
          };
          console.log(
            `📐 Using ${fingerprint.deviceType} viewport: ${deviceViewport.width}x${deviceViewport.height}`
          );
        }
      } catch (error) {
        console.error("❌ Failed to get fingerprint for lead:", error);
        console.log("⚠️ Falling back to default desktop configuration");
      }
    } else {
      console.log(
        "⚠️ Lead has no fingerprint assigned, using default desktop configuration"
      );
    }
    const testSessionData = {
      leadId: leadId,
      sessionId: `test_session_${Date.now()}`,
      cookies: [],
      localStorage: {},
      sessionStorage: {},
      userAgent: deviceUserAgent,
      viewport: deviceViewport,
      domain: "ftd-copy.vercel.app",
      fingerprint: fingerprintConfig,
      leadInfo: {
        firstName: leadInfo.firstName,
        lastName: leadInfo.lastName,
        email: leadInfo.email,
        phone: leadInfo.phone,
        country: leadInfo.country,
        countryCode: leadInfo.countryCode,
      },
      metadata: {
        leadName: `${leadInfo.firstName} ${leadInfo.lastName}`,
        leadEmail: leadInfo.email,
        testMode: true,
        originalDeviceType: fingerprintConfig?.deviceType || "desktop",
      },
    };
    const sessionDataJson = JSON.stringify(testSessionData);
    console.log("📝 Test session data prepared:", {
      leadId: testSessionData.leadId,
      sessionId: testSessionData.sessionId,
      domain: testSessionData.domain || "Google homepage",
      deviceType: fingerprintConfig?.deviceType || "desktop",
      viewport: `${deviceViewport.width}x${deviceViewport.height}`,
      userAgent: deviceUserAgent.substring(0, 50) + "...",
    });
    // Check if EC2 GUI Browser service is available (production mode)
    const EC2_GUI_BROWSER_URL = process.env.EC2_GUI_BROWSER_URL;
    const isProduction =
      process.env.NODE_ENV === "production" || EC2_GUI_BROWSER_URL;

    if (
      isProduction &&
      EC2_GUI_BROWSER_URL &&
      EC2_GUI_BROWSER_URL !== "http://your-ec2-ip:3001"
    ) {
      // Use GUI Browser service for production
      const axios = require("axios");

      try {
        console.log("🚀 Creating test GUI browser session via EC2 service");

        const response = await axios.post(
          `${EC2_GUI_BROWSER_URL}/sessions`,
          {
            sessionId: testSessionData.sessionId,
            leadId: testSessionData.leadId,
            cookies: testSessionData.cookies,
            localStorage: testSessionData.localStorage,
            sessionStorage: testSessionData.sessionStorage,
            userAgent: testSessionData.userAgent,
            viewport: testSessionData.viewport,
            domain: testSessionData.domain,
            leadInfo: testSessionData.leadInfo,
          },
          {
            timeout: 30000,
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (response.data.success) {
          console.log("✅ Test GUI browser session created successfully");

          res.json({
            success: true,
            message:
              "Test GUI browser session created successfully!",
            data: {
              leadId: leadId,
              sessionId: testSessionData.sessionId,
              testMode: true,
              sessionStatus: response.data.sessionStatus,
              instructions: {
                title: "Access Your Test GUI Browser Session",
                steps: [
                  "The browser session has been created",
                  "Test form filling and interaction",
                  "Monitor the session status",
                  "Close the session when finished",
                ],
              },
            },
          });
          return; // Exit early if GUI browser succeeds
        } else {
          throw new Error(
            response.data.message || "Failed to create test GUI browser session"
          );
        }
      } catch (guiError) {
        console.error(
          "❌ Test GUI browser session creation failed:",
          guiError.message
        );
        console.log("⚠️ Falling back to local script for test session");
      }
    }

    // Launch local test session script (development mode or fallback)
    const pythonScript = path.join(
      __dirname,
      "..",
      "..",
      "agent_session_browser.py"
    );
    console.log("🚀 Starting Python script:", pythonScript);
    console.log(
      "📄 Session data length:",
      sessionDataJson.length,
      "characters"
    );
    console.log("🔧 Spawning Python process...");
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const pythonProcess = spawn(pythonCmd, [pythonScript, sessionDataJson], {
      detached: true,
      stdio: ["ignore", "ignore", "ignore"],
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });
    pythonProcess.on("error", (error) => {
      console.error("🐍 Python process error:", error);
    });
    console.log("🐍 Python process started with PID:", pythonProcess.pid);
    pythonProcess.unref();
    res.json({
      success: true,
      message: "Test browser session initiated",
      data: {
        leadId: leadId,
        sessionId: testSessionData.sessionId,
        testMode: true,
        pythonPid: pythonProcess.pid,
      },
    });
  } catch (error) {
    console.error("❌ Error in test browser session:", error);
    res.status(500).json({
      success: false,
      message: "Failed to start test browser session",
      error: error.message,
    });
  }
});
module.exports = router;
