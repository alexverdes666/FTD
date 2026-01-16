/**
 * Fingerprint Browser Service
 * Manages browser instances using fingerprint-chromium for bot-detection evasion
 */

const puppeteer = require("puppeteer-core");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const EventEmitter = require("events");
const Fingerprint = require("../models/Fingerprint");
const Lead = require("../models/Lead");
const sessionSecurity = require("../utils/sessionSecurity");

// Configuration
const CONFIG = {
  chromiumPath: process.env.FINGERPRINT_CHROMIUM_PATH || "/opt/fingerprint-chromium/chrome",
  defaultDisplay: process.env.DISPLAY || ":99",
  maxSessions: parseInt(process.env.MAX_BROWSER_SESSIONS) || 5,
  sessionTimeout: parseInt(process.env.BROWSER_SESSION_TIMEOUT) || 30 * 60 * 1000, // 30 minutes
  debuggingPortStart: 9222,
  userDataDir: process.env.BROWSER_DATA_DIR || "/tmp/fp-browser-profiles",
};

class FingerprintBrowserService extends EventEmitter {
  constructor() {
    super();
    this.sessions = new Map(); // sessionId -> { browser, page, process, leadId, fingerprint, metadata }
    this.portInUse = new Set();
    this.cleanupInterval = null;
    this._initialized = false;
  }

  /**
   * Initialize the service
   */
  async initialize() {
    if (this._initialized) return;

    // Ensure user data directory exists
    if (!fs.existsSync(CONFIG.userDataDir)) {
      fs.mkdirSync(CONFIG.userDataDir, { recursive: true });
    }

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => this._cleanupExpiredSessions(), 60000);

    this._initialized = true;
    console.log("🌐 FingerprintBrowserService initialized");
    console.log(`   Chromium path: ${CONFIG.chromiumPath}`);
    console.log(`   Max sessions: ${CONFIG.maxSessions}`);
  }

  /**
   * Get next available debugging port
   */
  _getNextPort() {
    let port = CONFIG.debuggingPortStart;
    while (this.portInUse.has(port)) {
      port++;
      if (port > CONFIG.debuggingPortStart + 100) {
        throw new Error("No available debugging ports");
      }
    }
    this.portInUse.add(port);
    return port;
  }

  /**
   * Convert Fingerprint model to chromium command line args
   */
  _fingerprintToArgs(fingerprint) {
    const args = [];

    // Generate fingerprint seed from deviceId
    const seed = this._hashToInt(fingerprint.deviceId);
    args.push(`--fingerprint=${seed}`);

    // Platform mapping
    const platformMap = {
      windows: "windows",
      mac: "macos",
      android: "linux",
      ios: "macos",
    };
    args.push(`--fingerprint-platform=${platformMap[fingerprint.deviceType] || "windows"}`);

    // Browser brand
    const brandMap = {
      chrome: "Chrome",
      edge: "Edge",
      firefox: "Chrome", // fingerprint-chromium doesn't support firefox
      safari: "Chrome",
    };
    args.push(`--fingerprint-brand=${brandMap[fingerprint.browser.name] || "Chrome"}`);

    // Hardware
    args.push(`--fingerprint-hardware-concurrency=${fingerprint.navigator.hardwareConcurrency}`);

    // GPU
    if (fingerprint.webgl.vendor) {
      args.push(`--fingerprint-gpu-vendor=${fingerprint.webgl.vendor}`);
    }

    // Timezone
    args.push(`--timezone=${fingerprint.timezone}`);

    // Language
    args.push(`--lang=${fingerprint.navigator.language}`);
    args.push(`--accept-lang=${fingerprint.navigator.languages.join(",")}`);

    return args;
  }

  /**
   * Hash string to 32-bit integer for fingerprint seed
   */
  _hashToInt(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Create a new browser session for a lead
   */
  async createSession(leadId, userId, options = {}) {
    await this.initialize();

    // Check max sessions
    if (this.sessions.size >= CONFIG.maxSessions) {
      throw new Error(`Maximum browser sessions (${CONFIG.maxSessions}) reached. Please close an existing session.`);
    }

    // Verify chromium exists
    if (!fs.existsSync(CONFIG.chromiumPath)) {
      throw new Error(`Fingerprint Chromium not found at ${CONFIG.chromiumPath}. Please run setup script.`);
    }

    // Get lead and fingerprint
    const lead = await Lead.findById(leadId).populate("fingerprint");
    if (!lead) {
      throw new Error("Lead not found");
    }

    let fingerprint = lead.fingerprint;
    if (!fingerprint) {
      // Create a new fingerprint for the lead
      fingerprint = await Fingerprint.createForLead(leadId, "windows", userId);
      lead.fingerprint = fingerprint._id;
      await lead.save();
    }

    const sessionId = `fp_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const port = this._getNextPort();
    const userDataPath = path.join(CONFIG.userDataDir, sessionId);

    // Create user data directory
    fs.mkdirSync(userDataPath, { recursive: true });

    // Build command args
    const fingerprintArgs = this._fingerprintToArgs(fingerprint);
    const browserArgs = [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataPath}`,
      // Container-specific flags (required for Docker/Render)
      `--no-sandbox`,
      `--disable-setuid-sandbox`,
      `--disable-dev-shm-usage`,
      `--disable-gpu`,
      `--disable-software-rasterizer`,
      `--single-process`,
      // General browser flags
      `--no-first-run`,
      `--no-default-browser-check`,
      `--disable-background-timer-throttling`,
      `--disable-backgrounding-occluded-windows`,
      `--disable-renderer-backgrounding`,
      `--disable-features=TranslateUI`,
      `--window-size=${fingerprint.screen.width},${fingerprint.screen.height}`,
      ...fingerprintArgs,
    ];

    // Add proxy if specified
    if (options.proxy) {
      browserArgs.push(`--proxy-server=${options.proxy}`);
    }

    // Add headless mode args if needed (for screenshot-only mode)
    if (options.headless) {
      browserArgs.push("--headless=new");
    }

    console.log(`🚀 Launching browser session ${sessionId} on port ${port}`);
    console.log(`   Fingerprint args: ${fingerprintArgs.join(" ")}`);

    // Launch browser process
    const browserProcess = spawn(CONFIG.chromiumPath, browserArgs, {
      env: {
        ...process.env,
        DISPLAY: CONFIG.defaultDisplay,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    browserProcess.stdout.on("data", (data) => {
      console.log(`[Browser ${sessionId}] ${data.toString().trim()}`);
    });

    browserProcess.stderr.on("data", (data) => {
      const msg = data.toString().trim();
      if (!msg.includes("DevTools listening") && !msg.includes("GPU process")) {
        console.error(`[Browser ${sessionId}] ${msg}`);
      }
    });

    // Wait for browser to be ready
    await this._waitForBrowser(port, 30000);

    // Connect puppeteer
    const browser = await puppeteer.connect({
      browserURL: `http://127.0.0.1:${port}`,
      defaultViewport: {
        width: fingerprint.screen.width,
        height: fingerprint.screen.height,
      },
    });

    // Get or create page
    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();

    // Restore session data if exists
    const existingSession = lead.getActiveBrowserSession();
    if (existingSession) {
      try {
        const decryptedSession = sessionSecurity.decryptSessionData(existingSession);
        await this._restoreSessionData(page, decryptedSession);
        console.log(`📋 Restored existing session data for lead ${leadId}`);
      } catch (err) {
        console.error(`❌ Failed to restore session: ${err.message}`);
      }
    }

    // Store session
    const sessionData = {
      sessionId,
      browser,
      page,
      process: browserProcess,
      port,
      leadId,
      fingerprint,
      userDataPath,
      userId,
      createdAt: new Date(),
      lastActivity: new Date(),
      metadata: {
        viewport: { width: fingerprint.screen.width, height: fingerprint.screen.height },
        userAgent: fingerprint.navigator.userAgent,
      },
    };

    this.sessions.set(sessionId, sessionData);

    // Setup activity tracking
    page.on("framenavigated", () => {
      sessionData.lastActivity = new Date();
    });

    // Emit session created event
    this.emit("sessionCreated", {
      sessionId,
      leadId,
      port,
      fingerprint: fingerprint.deviceDescription,
    });

    console.log(`✅ Browser session ${sessionId} created successfully`);

    return {
      sessionId,
      port,
      viewport: sessionData.metadata.viewport,
      fingerprint: {
        deviceType: fingerprint.deviceType,
        browser: fingerprint.browser,
        screen: fingerprint.screen,
      },
      leadInfo: {
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.newEmail,
      },
    };
  }

  /**
   * Wait for browser debugging port to be available
   */
  async _waitForBrowser(port, timeout) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/json/version`);
        if (response.ok) {
          return;
        }
      } catch (err) {
        // Not ready yet
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error(`Browser failed to start within ${timeout}ms`);
  }

  /**
   * Restore session data (cookies, localStorage, sessionStorage)
   */
  async _restoreSessionData(page, sessionData) {
    if (sessionData.cookies && sessionData.cookies.length > 0) {
      await page.setCookie(...sessionData.cookies);
    }

    if (sessionData.domain) {
      await page.goto(sessionData.domain, { waitUntil: "domcontentloaded" });

      if (sessionData.localStorage) {
        await page.evaluate((storage) => {
          for (const [key, value] of Object.entries(storage)) {
            localStorage.setItem(key, value);
          }
        }, sessionData.localStorage);
      }

      if (sessionData.sessionStorage) {
        await page.evaluate((storage) => {
          for (const [key, value] of Object.entries(storage)) {
            sessionStorage.setItem(key, value);
          }
        }, sessionData.sessionStorage);
      }
    }
  }

  /**
   * Navigate to URL
   */
  async navigateTo(sessionId, url) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    session.lastActivity = new Date();
    await session.page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    return {
      url: session.page.url(),
      title: await session.page.title(),
    };
  }

  /**
   * Take screenshot
   */
  async takeScreenshot(sessionId, options = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    session.lastActivity = new Date();

    const screenshot = await session.page.screenshot({
      type: options.type || "jpeg",
      quality: options.quality || 80,
      fullPage: options.fullPage || false,
      encoding: "base64",
    });

    return screenshot;
  }

  /**
   * Execute JavaScript in page context
   */
  async executeScript(sessionId, script) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    session.lastActivity = new Date();
    return await session.page.evaluate(script);
  }

  /**
   * Fill form fields
   */
  async fillForm(sessionId, fields) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    session.lastActivity = new Date();
    const results = [];

    for (const field of fields) {
      try {
        const { selector, value, type = "type" } = field;

        if (type === "select") {
          await session.page.select(selector, value);
        } else if (type === "click") {
          await session.page.click(selector);
        } else if (type === "type") {
          await session.page.type(selector, value, { delay: 50 });
        } else if (type === "clear_and_type") {
          await session.page.click(selector, { clickCount: 3 });
          await session.page.type(selector, value, { delay: 50 });
        }

        results.push({ selector, success: true });
      } catch (err) {
        results.push({ selector: field.selector, success: false, error: err.message });
      }
    }

    return results;
  }

  /**
   * Click element
   */
  async click(sessionId, selector, options = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    session.lastActivity = new Date();

    if (options.waitForSelector) {
      await session.page.waitForSelector(selector, { timeout: options.timeout || 5000 });
    }

    await session.page.click(selector);

    return { success: true };
  }

  /**
   * Get page content/HTML
   */
  async getPageContent(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    return {
      url: session.page.url(),
      title: await session.page.title(),
      html: await session.page.content(),
    };
  }

  /**
   * Save session data and close browser
   */
  async closeSession(sessionId, saveSession = true) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    console.log(`🛑 Closing browser session ${sessionId}`);

    try {
      if (saveSession) {
        // Save session data to lead
        const sessionData = await this._extractSessionData(session);
        const encryptedSession = sessionSecurity.encryptSessionData(sessionData);

        const lead = await Lead.findById(session.leadId);
        if (lead) {
          await lead.storeBrowserSession({
            ...sessionData,
            encrypted: encryptedSession,
          });
          console.log(`💾 Session data saved for lead ${session.leadId}`);
        }
      }

      // Close browser
      await session.browser.close();
    } catch (err) {
      console.error(`Error during session cleanup: ${err.message}`);
    }

    // Kill process if still running
    if (session.process && !session.process.killed) {
      session.process.kill("SIGTERM");
    }

    // Cleanup user data directory
    try {
      fs.rmSync(session.userDataPath, { recursive: true, force: true });
    } catch (err) {
      console.error(`Failed to cleanup user data: ${err.message}`);
    }

    // Release port
    this.portInUse.delete(session.port);

    // Remove from sessions
    this.sessions.delete(sessionId);

    // Emit event
    this.emit("sessionClosed", { sessionId, leadId: session.leadId });

    console.log(`✅ Session ${sessionId} closed`);
  }

  /**
   * Extract session data (cookies, storage) from page
   */
  async _extractSessionData(session) {
    const page = session.page;
    const url = page.url();

    let localStorage = {};
    let sessionStorage = {};

    try {
      localStorage = await page.evaluate(() => {
        const items = {};
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          items[key] = window.localStorage.getItem(key);
        }
        return items;
      });

      sessionStorage = await page.evaluate(() => {
        const items = {};
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const key = window.sessionStorage.key(i);
          items[key] = window.sessionStorage.getItem(key);
        }
        return items;
      });
    } catch (err) {
      console.error(`Failed to extract storage: ${err.message}`);
    }

    const cookies = await page.cookies();

    return {
      sessionId: session.sessionId,
      cookies,
      localStorage,
      sessionStorage,
      userAgent: session.fingerprint.navigator.userAgent,
      viewport: session.metadata.viewport,
      domain: url,
      leadInfo: {
        leadId: session.leadId,
      },
      metadata: {
        createdAt: session.createdAt,
        closedAt: new Date(),
        userId: session.userId,
      },
    };
  }

  /**
   * Get session info
   */
  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    return {
      sessionId: session.sessionId,
      leadId: session.leadId,
      port: session.port,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      fingerprint: {
        deviceType: session.fingerprint.deviceType,
        browser: session.fingerprint.browser,
        screen: session.fingerprint.screen,
      },
      metadata: session.metadata,
    };
  }

  /**
   * Get all active sessions
   */
  getAllSessions() {
    const sessions = [];
    for (const [sessionId, session] of this.sessions) {
      sessions.push({
        sessionId,
        leadId: session.leadId,
        port: session.port,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        fingerprint: session.fingerprint.deviceDescription,
      });
    }
    return sessions;
  }

  /**
   * Cleanup expired sessions
   */
  async _cleanupExpiredSessions() {
    const now = Date.now();
    const expiredSessions = [];

    for (const [sessionId, session] of this.sessions) {
      const age = now - session.lastActivity.getTime();
      if (age > CONFIG.sessionTimeout) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      console.log(`⏰ Session ${sessionId} expired, closing...`);
      try {
        await this.closeSession(sessionId, true);
      } catch (err) {
        console.error(`Failed to close expired session: ${err.message}`);
      }
    }
  }

  /**
   * Shutdown service
   */
  async shutdown() {
    console.log("🛑 Shutting down FingerprintBrowserService...");

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Close all sessions
    const sessionIds = Array.from(this.sessions.keys());
    for (const sessionId of sessionIds) {
      try {
        await this.closeSession(sessionId, true);
      } catch (err) {
        console.error(`Failed to close session ${sessionId}: ${err.message}`);
      }
    }

    this._initialized = false;
    console.log("✅ FingerprintBrowserService shutdown complete");
  }
}

// Export singleton instance
const service = new FingerprintBrowserService();
module.exports = service;
