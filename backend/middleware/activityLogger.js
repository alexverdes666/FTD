/**
 * Activity Logger Middleware
 *
 * Comprehensive logging for all API operations.
 * Tracks: WHO (user), WHEN (timestamp), WHAT (method, endpoint, payload, result)
 *         WHERE (IP, geolocation), HOW (device, browser, OS)
 *
 * Features:
 * - Console logging with colors for development/debugging
 * - Database persistence for audit trail
 * - User agent parsing for device/browser info
 * - IP tracking with forwarded headers support
 * - Before/after change tracking for modifications
 * - Risk scoring for security monitoring
 */

const UAParser = require("ua-parser-js");
const { computeChanges } = require("./changeTracker");

// Lazy-load ActivityLog model to avoid circular dependency issues
let ActivityLog = null;
const getActivityLogModel = () => {
  if (!ActivityLog) {
    ActivityLog = require("../models/ActivityLog");
  }
  return ActivityLog;
};

// ANSI color codes for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
};

// Method colors for visual distinction
const methodColors = {
  GET: colors.green,
  POST: colors.cyan,
  PUT: colors.yellow,
  PATCH: colors.magenta,
  DELETE: colors.red,
};

// Status code colors
const getStatusColor = (status) => {
  if (status >= 500) return colors.red;
  if (status >= 400) return colors.yellow;
  if (status >= 300) return colors.cyan;
  if (status >= 200) return colors.green;
  return colors.white;
};

// Get method emoji for quick visual scanning
const getMethodEmoji = (method) => {
  switch (method) {
    case "GET":
      return "📖";
    case "POST":
      return "✨";
    case "PUT":
      return "📝";
    case "PATCH":
      return "🔧";
    case "DELETE":
      return "🗑️";
    default:
      return "❓";
  }
};

// Sensitive fields that should be redacted in logs
const SENSITIVE_FIELDS = [
  "password",
  "newPassword",
  "currentPassword",
  "token",
  "refreshToken",
  "accessToken",
  "secret",
  "apiKey",
  "privateKey",
  "creditCard",
  "cardNumber",
  "cvv",
  "ssn",
  "twoFactorSecret",
  "backupCodes",
  "twoFactorBackupCodes",
  "authorization",
];

// Routes to skip detailed body logging (e.g., file uploads, health checks)
const SKIP_BODY_ROUTES = [
  "/api/health",
  "/api/chat/images",
  "/api/ticket-images",
];

// Routes to skip logging entirely (noisy endpoints)
const SKIP_LOG_ROUTES = ["/api/health", "/socket.io"];

// Known bot patterns
const BOT_PATTERNS = [
  /bot/i,
  /crawler/i,
  /spider/i,
  /scraper/i,
  /curl/i,
  /wget/i,
  /python-requests/i,
  /postman/i,
  /insomnia/i,
];

/**
 * Recursively redacts sensitive fields from an object
 */
const redactSensitiveData = (obj, depth = 0) => {
  if (depth > 5) return "[MAX_DEPTH]";
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    return obj.slice(0, 10).map((item) => redactSensitiveData(item, depth + 1));
  }

  const redacted = {};
  for (const [key, value] of Object.entries(obj)) {
    if (
      SENSITIVE_FIELDS.some((field) =>
        key.toLowerCase().includes(field.toLowerCase())
      )
    ) {
      redacted[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      redacted[key] = redactSensitiveData(value, depth + 1);
    } else if (typeof value === "string" && value.length > 500) {
      redacted[key] = value.substring(0, 500) + "...[TRUNCATED]";
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
};

/**
 * Formats the request body for logging
 */
const formatBody = (body, path) => {
  if (!body || Object.keys(body).length === 0) return null;
  if (SKIP_BODY_ROUTES.some((route) => path.startsWith(route)))
    return "[BODY_SKIPPED]";

  const redacted = redactSensitiveData(body);
  const stringified = JSON.stringify(redacted);

  // Truncate very long bodies
  if (stringified.length > 2000) {
    return JSON.stringify(redacted).substring(0, 2000) + "...[TRUNCATED]";
  }

  return redacted;
};

/**
 * Get IP address from request with full chain
 */
const getClientIP = (req) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return (
    req.headers["x-real-ip"] ||
    req.ip ||
    req.connection?.remoteAddress ||
    "unknown"
  );
};

/**
 * Get the full forwarded-for chain
 */
const getForwardedChain = (req) => {
  return req.headers["x-forwarded-for"] || null;
};

/**
 * Parse device fingerprint from X-Device-Fingerprint header
 * The header contains a base64-encoded JSON object
 */
const parseDeviceFingerprint = (fingerprintHeader) => {
  if (!fingerprintHeader) return null;

  try {
    const decoded = Buffer.from(fingerprintHeader, "base64").toString("utf-8");
    const parsed = JSON.parse(decoded);

    // Extract all the fields we care about
    return {
      // Screen
      screenWidth: parsed.screenWidth || null,
      screenHeight: parsed.screenHeight || null,
      colorDepth: parsed.colorDepth || null,
      pixelRatio: parsed.pixelRatio || null,

      // Locale/Time
      timezone: parsed.timezone || null,
      timezoneOffset: parsed.timezoneOffset || null,
      language: parsed.language || null,
      languages: parsed.languages || [],

      // Hardware
      platform: parsed.platform || null,
      hardwareConcurrency: parsed.hardwareConcurrency || null,
      deviceMemory: parsed.deviceMemory || null,
      maxTouchPoints: parsed.maxTouchPoints || null,

      // WebGL (GPU identification)
      webglVendor: parsed.webglVendor || null,
      webglRenderer: parsed.webglRenderer || null,
      webglVersion: parsed.webglVersion || null,
      webglMaxTextureSize: parsed.webglMaxTextureSize || null,

      // Fingerprint hashes
      canvasHash: parsed.canvasHash || null,
      audioHash: parsed.audioHash || null,
      fontFingerprint: parsed.fontFingerprint || null,

      // Apple device detection
      isMac: parsed.isMac || null,
      isIOS: parsed.isIOS || null,
      isSafari: parsed.isSafari || null,
      isAppleSilicon: parsed.isAppleSilicon || null,
      isAppleDevice: parsed.isAppleDevice || null,

      // Preferences
      colorScheme: parsed.colorScheme || null,
      reducedMotion: parsed.reducedMotion || null,

      // Connection
      connectionType: parsed.connectionType || null,
      connectionDownlink: parsed.connectionDownlink || null,
    };
  } catch (e) {
    return null;
  }
};

/**
 * Format user info for logging
 */
const formatUserInfo = (user) => {
  if (!user) return { id: null, name: "Anonymous", role: "none", email: null };
  return {
    id: user._id?.toString() || user.id || "unknown",
    name: user.fullName || user.name || "Unknown",
    role: user.role || "unknown",
    email: user.email || "unknown",
  };
};

/**
 * Parse user agent for device/browser/OS info
 */
const parseUserAgent = (userAgentString) => {
  if (!userAgentString) {
    return {
      device: { type: "unknown", vendor: null, model: null },
      browser: { name: null, version: null },
      os: { name: null, version: null },
      isBot: false,
    };
  }

  const parser = new UAParser(userAgentString);
  const result = parser.getResult();

  // Determine device type
  let deviceType = result.device.type || "desktop";
  if (!result.device.type) {
    // UAParser doesn't always detect desktop, so we infer it
    if (result.os.name && !result.device.type) {
      deviceType = "desktop";
    }
  }

  // Check if it's a bot
  const isBot = BOT_PATTERNS.some((pattern) => pattern.test(userAgentString));

  return {
    device: {
      type: isBot ? "bot" : deviceType,
      vendor: result.device.vendor || null,
      model: result.device.model || null,
    },
    browser: {
      name: result.browser.name || null,
      version: result.browser.version || null,
    },
    os: {
      name: result.os.name || null,
      version: result.os.version || null,
    },
    isBot,
  };
};

/**
 * Get status category from status code
 */
const getStatusCategory = (statusCode) => {
  if (statusCode >= 500) return "server_error";
  if (statusCode >= 400) return "client_error";
  if (statusCode >= 300) return "redirect";
  return "success";
};

/**
 * Extract base path without query params and IDs
 */
const getBasePath = (path) => {
  // Remove query string
  let basePath = path.split("?")[0];

  // Replace MongoDB ObjectIDs with :id placeholder for grouping
  basePath = basePath.replace(/\/[0-9a-fA-F]{24}(?=\/|$)/g, "/:id");

  return basePath;
};

/**
 * Determine action type from method and path
 */
const getActionType = (method, path) => {
  const basePath = getBasePath(path);
  const parts = basePath.split("/").filter(Boolean);

  if (parts.length < 2) return null;

  // Get the resource name (e.g., "users", "leads")
  const resource = parts[1].replace(/-/g, "_");

  // Determine action
  let action;
  switch (method) {
    case "GET":
      action = parts.includes(":id") ? "view" : "list";
      break;
    case "POST":
      action = "create";
      break;
    case "PUT":
    case "PATCH":
      action = "update";
      break;
    case "DELETE":
      action = "delete";
      break;
    default:
      action = method.toLowerCase();
  }

  // Check for special sub-actions
  if (parts.length > 2) {
    const lastPart = parts[parts.length - 1];
    if (lastPart !== ":id" && !lastPart.match(/^[0-9a-fA-F]{24}$/)) {
      action = lastPart.replace(/-/g, "_");
    }
  }

  return `${resource}.${action}`;
};

/**
 * Calculate risk score based on request characteristics
 */
const calculateRiskScore = (logData) => {
  let score = 0;
  const flags = [];

  // Check if this is a 2FA challenge prompt (not a real failure)
  const is2FAPrompt =
    logData.statusCode === 403 &&
    logData.error?.message?.includes("two-factor authentication");

  // Failed requests increase risk (but not 2FA prompts - those are expected)
  if (logData.statusCode >= 400 && !is2FAPrompt) {
    score += 10;
    if (logData.statusCode === 401 || logData.statusCode === 403) {
      score += 15;
      flags.push("failed_auth");
    }
  }

  // 2FA prompts are normal workflow, just mark them
  if (is2FAPrompt) {
    flags.push("2fa_challenge");
  }

  // Sensitive operations
  if (["DELETE", "PUT", "PATCH"].includes(logData.method)) {
    score += 5;
  }

  // Anonymous requests to protected endpoints
  if (!logData.user && !logData.path.includes("/auth/")) {
    score += 10;
  }

  // Bot or suspicious user agent
  if (logData.isBot) {
    score += 20;
    flags.push("suspicious_user_agent");
  }

  // Missing common headers
  if (!logData.userAgent) {
    score += 15;
    flags.push("missing_headers");
  }

  // Rapid requests (would need to track this separately)
  // This is a placeholder for future implementation

  return { score: Math.min(score, 100), flags };
};

/**
 * Save log to database
 */
const saveLogToDatabase = async (logData) => {
  try {
    const ActivityLogModel = getActivityLogModel();
    await ActivityLogModel.create(logData);
  } catch (error) {
    // Don't fail the request if logging fails
    console.error(
      "[ActivityLogger] Failed to save log to database:",
      error.message
    );
  }
};

/**
 * Main activity logger middleware
 * Logs detailed information about all API operations
 */
const activityLogger = (options = {}) => {
  const {
    logAllMethods = false, // If true, logs GET requests too
    logResponseBody = false, // If true, includes response body in logs
    minDuration = 0, // Only log requests that take longer than this (ms)
    saveToDatabase = true, // If true, saves logs to MongoDB
    consoleLog = true, // If true, outputs to console
  } = options;

  return (req, res, next) => {
    // Skip logging for certain routes
    if (SKIP_LOG_ROUTES.some((route) => req.path.startsWith(route))) {
      return next();
    }

    // Skip OPTIONS preflight requests - they don't carry meaningful data
    if (req.method === "OPTIONS") {
      return next();
    }

    // Skip GET requests unless explicitly enabled
    if (!logAllMethods && req.method === "GET") {
      return next();
    }

    const startTime = Date.now();
    const requestId = `${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const timestamp = new Date();

    // Parse user agent upfront
    const userAgentString = req.headers["user-agent"] || null;
    const parsedUA = parseUserAgent(userAgentString);

    // Capture original response methods
    const originalSend = res.send;
    const originalJson = res.json;
    let responseBody = null;
    const MAX_CAPTURE_SIZE = 10000; // Only capture responses under 10KB to prevent memory bloat

    // Override res.send to capture response (with size limit)
    res.send = function (body) {
      if (body && ((typeof body === 'string' && body.length < MAX_CAPTURE_SIZE) ||
          (Buffer.isBuffer(body) && body.length < MAX_CAPTURE_SIZE))) {
        responseBody = body;
      }
      return originalSend.call(this, body);
    };

    // Override res.json to capture response (with size limit)
    res.json = function (body) {
      try {
        const size = JSON.stringify(body).length;
        if (size < MAX_CAPTURE_SIZE) {
          responseBody = body;
        }
      } catch {
        // Skip capture if serialization fails
      }
      return originalJson.call(this, body);
    };

    // Log when response finishes
    res.on("finish", async () => {
      const duration = Date.now() - startTime;

      // Skip if duration is below threshold
      if (duration < minDuration) return;

      const user = formatUserInfo(req.user);
      const method = req.method;
      const path = req.originalUrl || req.url;
      const status = res.statusCode;
      const ip = getClientIP(req);

      // Determine if this was a successful operation
      const isSuccess = status >= 200 && status < 300;
      const statusEmoji = isSuccess ? "✅" : status >= 400 ? "❌" : "⚠️";

      // Build the log data object
      const logData = {
        requestId,
        timestamp,
        duration,
        method,
        path,
        basePath: getBasePath(path),
        statusCode: status,
        statusCategory: getStatusCategory(status),
        actionType: getActionType(method, path),

        // User info
        user: req.user?._id || req.user?.id || null,
        userSnapshot: {
          id: user.id,
          email: user.email,
          fullName: user.name,
          role: user.role,
        },

        // Request details
        routeParams: Object.keys(req.params || {}).length > 0 ? req.params : {},
        queryParams: Object.keys(req.query || {}).length > 0 ? req.query : {},
        requestBody: null,

        // IP and location
        ip,
        forwardedFor: getForwardedChain(req),

        // Device/browser info
        userAgent: userAgentString ? userAgentString.substring(0, 500) : null,
        device: parsedUA.device,
        browser: parsedUA.browser,
        os: parsedUA.os,
        isBot: parsedUA.isBot,

        // Device fingerprint (from client)
        deviceId: req.headers["x-device-id"] || null,
        deviceFingerprint: parseDeviceFingerprint(
          req.headers["x-device-fingerprint"]
        ),

        // Request context
        origin: req.headers["origin"] || null,
        referer: req.headers["referer"] || req.headers["referrer"] || null,
        contentType: req.headers["content-type"] || null,
        contentLength: parseInt(req.headers["content-length"]) || 0,
        acceptLanguage: req.headers["accept-language"]
          ? req.headers["accept-language"].substring(0, 100)
          : null,

        // Error info
        error: {
          message: null,
          code: null,
          stack: null,
        },

        // Security
        isSensitiveAction: !!req.sensitiveActionVerified,
        sensitiveActionVerified: req.sensitiveActionVerified ? true : null,
        riskScore: 0,
        securityFlags: [],

        // Changes tracking
        previousState: {
          model: null,
          documentId: null,
          data: null,
        },
        changes: null,
      };

      // Add request body for mutating operations
      if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
        const formattedBody = formatBody(req.body, path);
        if (formattedBody) {
          logData.requestBody = formattedBody;
        }

        // Add previous state if available (from changeTracker middleware)
        if (req.previousState && req.previousState.data) {
          logData.previousState = {
            model: req.previousState.model,
            documentId: req.previousState.documentId,
            data: redactSensitiveData(req.previousState.data),
          };

          // Compute what changed
          if (formattedBody && typeof formattedBody === "object") {
            const changes = computeChanges(
              req.previousState.data,
              formattedBody
            );
            if (changes) {
              logData.changes = redactSensitiveData(changes);
            }
          }
        }
      }

      // Add error info for failed requests
      if (status >= 400 && responseBody) {
        try {
          const parsed =
            typeof responseBody === "string"
              ? JSON.parse(responseBody)
              : responseBody;
          logData.error = {
            message: parsed.message || parsed.error || "Unknown error",
            code: parsed.code || null,
            stack: null, // Don't log stack traces for security
          };
        } catch (e) {
          logData.error = {
            message: String(responseBody).substring(0, 200),
            code: null,
            stack: null,
          };
        }
      }

      // Calculate risk score
      const { score, flags } = calculateRiskScore(logData);
      logData.riskScore = score;
      logData.securityFlags = flags;

      // Console output with colors (if enabled)
      if (consoleLog) {
        const methodColor = methodColors[method] || colors.white;
        const statusColor = getStatusColor(status);
        const methodEmoji = getMethodEmoji(method);
        const separator = `${colors.dim}${"─".repeat(80)}${colors.reset}`;

        console.log("\n" + separator);
        console.log(
          `${methodEmoji} ${statusEmoji} ${colors.bright}[ACTIVITY LOG]${
            colors.reset
          } ${timestamp.toISOString()}`
        );
        console.log(separator);

        // Method and Path
        console.log(
          `${colors.bright}Request:${colors.reset}  ${methodColor}${method}${colors.reset} ${path}`
        );

        // Status and Duration
        console.log(
          `${colors.bright}Response:${colors.reset} ${statusColor}${status}${colors.reset} (${duration}ms)`
        );

        // User Info
        console.log(
          `${colors.bright}User:${colors.reset}     ${colors.cyan}${user.name}${
            colors.reset
          } (${user.role}) [ID: ${user.id || "anonymous"}]`
        );
        console.log(
          `${colors.bright}Email:${colors.reset}    ${user.email || "N/A"}`
        );

        // IP and Device
        console.log(`${colors.bright}IP:${colors.reset}       ${ip}`);
        console.log(
          `${colors.bright}Device:${colors.reset}   ${parsedUA.device.type} | ${
            parsedUA.browser.name || "Unknown"
          } ${parsedUA.browser.version || ""} | ${
            parsedUA.os.name || "Unknown"
          } ${parsedUA.os.version || ""}`
        );
        console.log(`${colors.bright}Req ID:${colors.reset}   ${requestId}`);

        // Query params
        if (
          logData.queryParams &&
          Object.keys(logData.queryParams).length > 0
        ) {
          console.log(
            `${colors.bright}Query:${colors.reset}    ${JSON.stringify(
              logData.queryParams
            )}`
          );
        }

        // Route params
        if (
          logData.routeParams &&
          Object.keys(logData.routeParams).length > 0
        ) {
          console.log(
            `${colors.bright}Params:${colors.reset}   ${JSON.stringify(
              logData.routeParams
            )}`
          );
        }

        // Show CHANGES section for PUT/PATCH with tracked changes
        if (logData.changes && Object.keys(logData.changes).length > 0) {
          console.log(
            `\n${colors.bright}${colors.yellow}📊 CHANGES DETECTED:${colors.reset}`
          );
          for (const [field, change] of Object.entries(logData.changes)) {
            const fromStr =
              typeof change.from === "object"
                ? JSON.stringify(change.from)
                : String(change.from ?? "(empty)");
            const toStr =
              typeof change.to === "object"
                ? JSON.stringify(change.to)
                : String(change.to ?? "(empty)");

            console.log(`  ${colors.bright}${field}:${colors.reset}`);
            console.log(`    ${colors.red}BEFORE:${colors.reset} ${fromStr}`);
            console.log(`    ${colors.green}AFTER:${colors.reset}  ${toStr}`);
          }
        }

        // Show previous state for context
        if (
          logData.previousState.data &&
          (!logData.changes || Object.keys(logData.changes).length === 0)
        ) {
          console.log(
            `\n${colors.bright}${colors.blue}📋 PREVIOUS STATE (${logData.previousState.model}):${colors.reset}`
          );
          console.log(
            colors.dim +
              JSON.stringify(logData.previousState.data, null, 2) +
              colors.reset
          );
        }

        // Request Body for mutating operations
        if (
          ["POST", "PUT", "PATCH", "DELETE"].includes(method) &&
          logData.requestBody
        ) {
          const payloadLabel =
            method === "POST" ? "📥 NEW DATA:" : "📤 NEW VALUES:";
          console.log(`\n${colors.bright}${payloadLabel}${colors.reset}`);
          console.log(
            colors.dim +
              JSON.stringify(logData.requestBody, null, 2) +
              colors.reset
          );
        }

        // Error details
        if (logData.error.message) {
          console.log(
            `\n${colors.red}${colors.bright}❌ Error:${colors.reset}    ${colors.red}${logData.error.message}${colors.reset}`
          );
        }

        // Security warnings
        if (logData.riskScore > 30) {
          console.log(
            `\n${colors.yellow}${colors.bright}⚠️  Risk Score: ${logData.riskScore}/100${colors.reset}`
          );
          if (logData.securityFlags.length > 0) {
            console.log(
              `${colors.yellow}   Flags: ${logData.securityFlags.join(", ")}${
                colors.reset
              }`
            );
          }
        }

        console.log(separator + "\n");

        // Also log as structured JSON for log aggregation tools
        console.log(
          `[ACTIVITY_JSON] ${JSON.stringify({
            requestId,
            timestamp: timestamp.toISOString(),
            duration: `${duration}ms`,
            method,
            path,
            status,
            user: logData.userSnapshot,
            ip,
            device: `${parsedUA.device.type}/${parsedUA.browser.name}/${parsedUA.os.name}`,
            actionType: logData.actionType,
            riskScore: logData.riskScore,
          })}`
        );
      }

      // Save to database (if enabled)
      if (saveToDatabase) {
        saveLogToDatabase(logData);
      }
    });

    next();
  };
};

/**
 * Simple summary logger for high-level operation tracking
 * Use this for quick overview without full details
 */
const activitySummaryLogger = (req, res, next) => {
  // Skip GET requests and health checks
  if (req.method === "GET" || req.path.startsWith("/api/health")) {
    return next();
  }

  const startTime = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const user = req.user;
    const userInfo = user
      ? `${user.fullName || "Unknown"} (${user.role})`
      : "Anonymous";
    const ip = getClientIP(req);

    const statusEmoji = res.statusCode >= 400 ? "❌" : "✅";
    const methodEmoji = getMethodEmoji(req.method);

    console.log(
      `${methodEmoji} ${statusEmoji} [${new Date().toISOString()}] ` +
        `${req.method} ${req.originalUrl || req.url} | ` +
        `Status: ${res.statusCode} | ` +
        `User: ${userInfo} | ` +
        `IP: ${ip} | ` +
        `Duration: ${duration}ms`
    );
  });

  next();
};

/**
 * Login/Logout specific logger
 * Use this on auth routes for detailed authentication logging
 */
const authActivityLogger = async (req, res, next) => {
  const originalJson = res.json;

  res.json = function (body) {
    // Capture auth result and log it
    const isSuccess = body.success === true;
    const ip = getClientIP(req);
    const userAgentString = req.headers["user-agent"] || null;
    const parsedUA = parseUserAgent(userAgentString);

    const authLogData = {
      type: req.path.includes("login")
        ? "LOGIN"
        : req.path.includes("logout")
        ? "LOGOUT"
        : "AUTH",
      success: isSuccess,
      email: req.body?.email || body?.user?.email || "unknown",
      ip,
      device: parsedUA.device,
      browser: parsedUA.browser,
      os: parsedUA.os,
      userAgent: userAgentString,
      timestamp: new Date().toISOString(),
      failureReason: !isSuccess ? body.message || "Unknown" : null,
    };

    console.log(
      `🔐 [AUTH] ${authLogData.type} | ` +
        `${isSuccess ? "✅ SUCCESS" : "❌ FAILED"} | ` +
        `Email: ${authLogData.email} | ` +
        `IP: ${ip} | ` +
        `Device: ${parsedUA.device.type}/${parsedUA.browser.name}`
    );

    // Could also save to database here for auth-specific logging
    console.log(`[AUTH_JSON] ${JSON.stringify(authLogData)}`);

    return originalJson.call(this, body);
  };

  next();
};

module.exports = {
  activityLogger,
  activitySummaryLogger,
  authActivityLogger,
  // Export utilities for custom logging needs
  formatUserInfo,
  getClientIP,
  redactSensitiveData,
  parseUserAgent,
  getStatusCategory,
  getBasePath,
  getActionType,
  calculateRiskScore,
};
