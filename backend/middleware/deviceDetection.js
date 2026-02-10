/**
 * Device Detection Middleware
 *
 * Uses the UserDetector module directly (no HTTP call) to capture comprehensive
 * device information for all POST, PUT, PATCH, and DELETE operations.
 *
 * Detection includes:
 * - Detailed IP analysis with proxy/VPN detection
 * - Anti-detect browser detection (Dolphin Anty, Multilogin, etc.)
 * - Client device info from headers/client hints
 * - Server system information
 * - Geolocation data
 * - Client hints and fingerprinting
 *
 * This data is stored in MongoDB for security auditing and compliance.
 */

const UserDetector = require("../get_info/src/services/detector");
const DeviceDetectionLog = require("../models/DeviceDetectionLog");
const AgentCheckin = require("../models/AgentCheckin");
const { computeChanges } = require("./changeTracker");
const { getBasePath, getActionType } = require("./activityLogger");

// Routes to skip detection logging
const SKIP_ROUTES = [
  "/api/health",
  "/api/auth/login", // Already logged by auth system
  "/api/auth/logout",
  "/api/two-factor", // Already logged by 2FA system
];

// Sensitive fields to redact in logs
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
 * Run device detection directly using the UserDetector module.
 * No HTTP call needed — runs in-process, bypasses Cloudflare entirely.
 */
const runDetection = (req) => {
  try {
    const detector = new UserDetector(req);
    return detector.getFullDetection();
  } catch (error) {
    console.error(
      "[DeviceDetection] ⚠️  Detection error:",
      error.message
    );
    return null;
  }
};

/**
 * Look up local device info from the FTD Local Agent via AgentCheckin.
 * The agent phones home to the backend, so we match by public IP.
 */
const lookupAgentCheckin = async (clientIp) => {
  try {
    if (!clientIp || clientIp === "unknown") return null;
    const entry = await AgentCheckin.findOne({ publicIP: clientIp })
      .sort({ lastSeenAt: -1 })
      .lean();
    return entry;
  } catch (e) {
    return null;
  }
};

/**
 * Calculate risk score based on detection data
 */
const calculateRiskScore = (detectionData, statusCode) => {
  let score = 0;
  const flags = [];

  // Check if this is a 2FA challenge prompt (not a real failure)
  const is2FAPrompt =
    statusCode === 403 &&
    detectionData.error?.message?.includes("two-factor authentication");

  // Failed requests increase risk (but not 2FA prompts)
  if (statusCode >= 400 && !is2FAPrompt) {
    score += 10;
    if (statusCode === 401 || statusCode === 403) {
      score += 15;
      flags.push("failed_auth");
    }
  }

  // 2FA prompts are normal workflow
  if (is2FAPrompt) {
    flags.push("2fa_challenge");
  }

  // Sensitive operations
  if (["DELETE", "PUT", "PATCH"].includes(detectionData.method)) {
    score += 5;
  }

  // Anonymous requests to protected endpoints
  if (!detectionData.user && !detectionData.path.includes("/auth/")) {
    score += 10;
  }

  // Anti-detect browser detected
  if (detectionData.antidetect?.isDetected) {
    score += 30;
    flags.push("antidetect_browser");
  }

  // Proxy detected
  if (detectionData.proxy?.isProxy) {
    score += 20;
    flags.push("proxy_detected");
  }

  // Bot or suspicious user agent
  if (detectionData.userAgent?.isBot) {
    score += 20;
    flags.push("suspicious_user_agent");
  }

  // Missing common headers
  if (!detectionData.userAgent?.raw) {
    score += 15;
    flags.push("missing_headers");
  }

  // Multiple IPs in chain (possible proxy chain)
  if (detectionData.ip?.ipChain && detectionData.ip.ipChain.length > 2) {
    score += 10;
    flags.push("ip_chain");
  }

  return { score: Math.min(score, 100), flags };
};

/**
 * Device Detection Middleware
 * Calls get_info service and logs all POST, PUT, PATCH, DELETE operations
 */
const deviceDetectionMiddleware = () => {
  return async (req, res, next) => {
    // Only track mutating operations
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      return next();
    }

    // Skip certain routes
    if (SKIP_ROUTES.some((route) => req.path.startsWith(route))) {
      return next();
    }

    const startTime = Date.now();

    // Capture response for logging
    const originalJson = res.json;
    let responseBody = null;
    let responseStatusCode = null;

    res.json = function (body) {
      responseBody = body;
      responseStatusCode = res.statusCode;
      return originalJson.call(this, body);
    };

    // Wait for response to finish before logging
    res.on("finish", async () => {
      try {
        const duration = Date.now() - startTime;

        // Run device detection directly (no HTTP call)
        const detectionData = runDetection(req);

        // Build the log entry
        const logEntry = {
          // User info
          user: req.user?._id || req.user?.id || null,
          userEmail: req.user?.email || null,

          // Request info
          method: req.method,
          path: req.originalUrl || req.url,
          basePath: getBasePath(req.originalUrl || req.url),
          statusCode: res.statusCode,
          actionType: getActionType(req.method, req.originalUrl || req.url),
          duration,

          // Request details
          requestBody: redactSensitiveData(req.body),
          queryParams:
            Object.keys(req.query || {}).length > 0 ? req.query : null,
          routeParams:
            Object.keys(req.params || {}).length > 0 ? req.params : null,

          // Timestamp
          timestamp: new Date(),

          // Sensitive action tracking
          isSensitiveAction: !!req.sensitiveActionVerified,
        };

        // If get_info service returned data, use it
        if (detectionData) {
          logEntry.ip = detectionData.ip;
          logEntry.userAgent = detectionData.userAgent;
          logEntry.clientDevice = detectionData.clientDevice;
          logEntry.serverInfo = detectionData.serverInfo;
          logEntry.antidetect = detectionData.antidetect;
          logEntry.proxy = detectionData.proxy;
          logEntry.connection = detectionData.connection;
          logEntry.clientHints = detectionData.clientHints;
          logEntry.securityHeaders = detectionData.securityHeaders;
          logEntry.geo = detectionData.geo;
          logEntry.fingerprint = detectionData.fingerprint;
          logEntry.rawHeaders = detectionData.rawHeaders;
        } else {
          // Fallback: basic detection from request
          logEntry.ip = {
            clientIp:
              req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
              req.headers["x-real-ip"] ||
              req.ip ||
              "unknown",
            forwardedFor: req.headers["x-forwarded-for"] || null,
          };
          logEntry.userAgent = {
            raw: req.headers["user-agent"] || null,
          };
          logEntry.connection = {
            protocol: req.protocol || "http",
            host: req.headers["host"],
            origin: req.headers["origin"] || null,
            referer: req.headers["referer"] || null,
          };
        }

        // Enrich with local device info from the FTD Local Agent (phone-home approach)
        const clientIp = logEntry.ip?.clientIp;
        const agentData = await lookupAgentCheckin(clientIp);
        if (agentData) {
          logEntry.localAgent = {
            hostname: agentData.hostname,
            username: agentData.username,
            platform: agentData.platform,
            localIPs: agentData.ips?.ipv4?.map((i) => i.address) || [],
            macs: agentData.ips?.ipv4?.map((i) => i.mac).filter(Boolean) || [],
            lastSeenAt: agentData.lastSeenAt,
          };
          // Also populate clientLocalIPs in the ip object for backward compat
          if (logEntry.ip && !logEntry.ip.clientLocalIPs?.length) {
            logEntry.ip.clientLocalIPs =
              agentData.ips?.ipv4?.map((i) => i.address) || [];
          }
        }

        // Add previous state and changes if available
        if (req.previousState && req.previousState.data) {
          logEntry.previousState = {
            model: req.previousState.model,
            documentId: req.previousState.documentId,
            data: redactSensitiveData(req.previousState.data),
          };

          // Compute what changed
          if (req.body && typeof req.body === "object") {
            const changes = computeChanges(req.previousState.data, req.body);
            if (changes) {
              logEntry.changes = redactSensitiveData(changes);
            }
          }
        }

        // Add error info for failed requests
        if (res.statusCode >= 400 && responseBody) {
          try {
            const parsed =
              typeof responseBody === "string"
                ? JSON.parse(responseBody)
                : responseBody;
            logEntry.error = {
              message: parsed.message || parsed.error || "Unknown error",
              code: parsed.code || null,
            };
          } catch (e) {
            logEntry.error = {
              message: String(responseBody).substring(0, 200),
              code: null,
            };
          }
        }

        // Calculate risk score
        const { score, flags } = calculateRiskScore(logEntry, res.statusCode);
        logEntry.riskScore = score;
        logEntry.securityFlags = flags;

        // Save to database
        await DeviceDetectionLog.create(logEntry);

        // Log summary to console
        const statusEmoji =
          res.statusCode >= 400 ? "❌" : res.statusCode >= 300 ? "⚠️" : "✅";
        const methodEmoji = {
          POST: "✨",
          PUT: "📝",
          PATCH: "🔧",
          DELETE: "🗑️",
        }[req.method];

        console.log(
          `${methodEmoji} ${statusEmoji} [DEVICE-DETECT] ${req.method} ${
            req.originalUrl || req.url
          } | ` +
            `User: ${req.user?.fullName || "Anonymous"} | ` +
            `IP: ${logEntry.ip?.clientIp || "unknown"} | ` +
            `Status: ${res.statusCode} | ` +
            `Duration: ${duration}ms` +
            (logEntry.antidetect?.isDetected
              ? ` | 🚨 ANTI-DETECT: ${logEntry.antidetect.browserName}`
              : "") +
            (logEntry.proxy?.isProxy ? ` | 🔀 PROXY DETECTED` : "") +
            (logEntry.riskScore > 50
              ? ` | ⚠️  RISK: ${logEntry.riskScore}/100`
              : "")
        );

        // Log detailed JSON for log aggregation
        console.log(
          `[DEVICE_DETECT_JSON] ${JSON.stringify({
            timestamp: logEntry.timestamp.toISOString(),
            method: req.method,
            path: logEntry.path,
            status: res.statusCode,
            user: logEntry.userEmail || "anonymous",
            ip: logEntry.ip?.clientIp,
            antidetect: logEntry.antidetect?.isDetected || false,
            proxy: logEntry.proxy?.isProxy || false,
            riskScore: logEntry.riskScore,
            duration: `${duration}ms`,
          })}`
        );
      } catch (error) {
        // Skip logging error on localhost/dev to reduce noise
        const isLocalhost =
          process.env.NODE_ENV === "development" ||
          (req.headers &&
            req.headers.host &&
            req.headers.host.includes("localhost"));

        if (isLocalhost) return;

        // Don't fail the request if logging fails
        console.error(
          "[DeviceDetection] ❌ Failed to log device detection:",
          error.message
        );
      }
    });

    next();
  };
};

module.exports = {
  deviceDetectionMiddleware,
  runDetection,
  redactSensitiveData,
};
