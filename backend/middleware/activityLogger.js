/**
 * Activity Logger Middleware
 *
 * Provides detailed console logging for all API operations.
 * Tracks: WHEN (timestamp), WHO (user), WHAT (method, endpoint, payload, result)
 * Now includes BEFORE/AFTER change tracking for modifications.
 *
 * This middleware intercepts responses to capture both request and response data.
 */

// Import change computation utility
const { computeChanges } = require("./changeTracker");

// ANSI color codes for console output (works on Render and most terminals)
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",

  // Foreground colors
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",

  // Background colors
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
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
];

// Routes to skip detailed body logging (e.g., file uploads, health checks)
const SKIP_BODY_ROUTES = [
  "/api/health",
  "/api/chat/images",
  "/api/ticket-images",
];

// Routes to skip logging entirely (noisy endpoints)
const SKIP_LOG_ROUTES = ["/api/health"];

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
 * Get IP address from request
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
 * Format user info for logging
 */
const formatUserInfo = (user) => {
  if (!user)
    return { id: "anonymous", name: "Anonymous", role: "none", email: "none" };
  return {
    id: user._id?.toString() || user.id || "unknown",
    name: user.fullName || user.name || "Unknown",
    role: user.role || "unknown",
    email: user.email || "unknown",
  };
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
  } = options;

  return (req, res, next) => {
    // Skip logging for certain routes
    if (SKIP_LOG_ROUTES.some((route) => req.path.startsWith(route))) {
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
    const timestamp = new Date().toISOString();

    // Capture original response methods
    const originalSend = res.send;
    const originalJson = res.json;
    let responseBody = null;

    // Override res.send to capture response
    res.send = function (body) {
      responseBody = body;
      return originalSend.call(this, body);
    };

    // Override res.json to capture response
    res.json = function (body) {
      responseBody = body;
      return originalJson.call(this, body);
    };

    // Log when response finishes
    res.on("finish", () => {
      const duration = Date.now() - startTime;

      // Skip if duration is below threshold
      if (duration < minDuration) return;

      const user = formatUserInfo(req.user);
      const method = req.method;
      const path = req.originalUrl || req.url;
      const status = res.statusCode;
      const ip = getClientIP(req);
      const userAgent = req.headers["user-agent"] || "unknown";

      // Determine if this was a successful operation
      const isSuccess = status >= 200 && status < 300;
      const statusEmoji = isSuccess ? "✅" : status >= 400 ? "❌" : "⚠️";

      // Build the log message
      const methodColor = methodColors[method] || colors.white;
      const statusColor = getStatusColor(status);
      const methodEmoji = getMethodEmoji(method);

      // Create structured log for easy parsing
      const logData = {
        requestId,
        timestamp,
        duration: `${duration}ms`,
        method,
        path,
        status,
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
          email: user.email,
        },
        ip,
        userAgent: userAgent.substring(0, 100),
      };

      // Add request body for mutating operations
      if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
        const formattedBody = formatBody(req.body, path);
        if (formattedBody) {
          logData.requestBody = formattedBody;
        }

        // Add query params if present
        if (Object.keys(req.query).length > 0) {
          logData.queryParams = req.query;
        }

        // Add route params if present
        if (Object.keys(req.params).length > 0) {
          logData.routeParams = req.params;
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

      // Add response info for errors
      if (status >= 400 && responseBody) {
        try {
          const parsed =
            typeof responseBody === "string"
              ? JSON.parse(responseBody)
              : responseBody;
          logData.error = {
            message: parsed.message || parsed.error || "Unknown error",
            success: parsed.success,
          };
        } catch (e) {
          logData.error = { raw: String(responseBody).substring(0, 200) };
        }
      }

      // Console output with colors
      const separator = `${colors.dim}${"─".repeat(80)}${colors.reset}`;

      console.log("\n" + separator);
      console.log(
        `${methodEmoji} ${statusEmoji} ${colors.bright}[ACTIVITY LOG]${colors.reset} ${timestamp}`
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
        `${colors.bright}User:${colors.reset}     ${colors.cyan}${user.name}${colors.reset} (${user.role}) [ID: ${user.id}]`
      );
      console.log(`${colors.bright}Email:${colors.reset}    ${user.email}`);

      // IP and Request ID
      console.log(`${colors.bright}IP:${colors.reset}       ${ip}`);
      console.log(`${colors.bright}Req ID:${colors.reset}   ${requestId}`);

      // Query params
      if (logData.queryParams) {
        console.log(
          `${colors.bright}Query:${colors.reset}    ${JSON.stringify(
            logData.queryParams
          )}`
        );
      }

      // Route params
      if (logData.routeParams) {
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

      // Show previous state for context (if no computed changes but we have previous state)
      if (
        logData.previousState &&
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

      // Request Body for mutating operations (new payload)
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
      if (logData.error) {
        console.log(
          `\n${colors.red}${colors.bright}❌ Error:${colors.reset}    ${
            colors.red
          }${logData.error.message || JSON.stringify(logData.error)}${
            colors.reset
          }`
        );
      }

      console.log(separator + "\n");

      // Also log as structured JSON for log aggregation tools
      console.log(`[ACTIVITY_JSON] ${JSON.stringify(logData)}`);
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

    const statusEmoji = res.statusCode >= 400 ? "❌" : "✅";
    const methodEmoji = getMethodEmoji(req.method);

    console.log(
      `${methodEmoji} ${statusEmoji} [${new Date().toISOString()}] ` +
        `${req.method} ${req.originalUrl || req.url} | ` +
        `Status: ${res.statusCode} | ` +
        `User: ${userInfo} | ` +
        `Duration: ${duration}ms`
    );
  });

  next();
};

module.exports = {
  activityLogger,
  activitySummaryLogger,
  // Export utilities for custom logging needs
  formatUserInfo,
  getClientIP,
  redactSensitiveData,
};
