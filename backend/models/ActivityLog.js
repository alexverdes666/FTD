const mongoose = require("mongoose");

/**
 * ActivityLog Model
 *
 * Comprehensive audit trail for all API activity.
 * Captures: WHO, WHEN, WHAT, WHERE (IP/location), HOW (device/browser)
 *
 * This model stores detailed logs for security auditing, debugging,
 * and compliance purposes.
 */
const activityLogSchema = new mongoose.Schema(
  {
    // Unique identifier for this request
    requestId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // ==================== WHO ====================
    // User information (null for unauthenticated requests)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
    },
    // Snapshot of user info at the time (preserved even if user changes/deleted)
    userSnapshot: {
      id: { type: String, default: null },
      email: { type: String, default: null },
      fullName: { type: String, default: null },
      role: { type: String, default: null },
    },

    // ==================== WHEN ====================
    timestamp: {
      type: Date,
      required: true,
      index: true,
    },
    // Request duration in milliseconds
    duration: {
      type: Number,
      default: 0,
    },

    // ==================== WHAT ====================
    // HTTP method (GET, POST, PUT, PATCH, DELETE)
    method: {
      type: String,
      required: true,
      enum: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
      index: true,
    },
    // Full path including query string
    path: {
      type: String,
      required: true,
      index: true,
    },
    // Base path without query params (for grouping)
    basePath: {
      type: String,
      index: true,
    },
    // HTTP status code
    statusCode: {
      type: Number,
      required: true,
      index: true,
    },
    // Status category for quick filtering
    statusCategory: {
      type: String,
      enum: ["success", "redirect", "client_error", "server_error"],
      index: true,
    },

    // Route parameters (e.g., { id: "abc123" })
    routeParams: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Query parameters
    queryParams: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Request body (redacted for sensitive fields)
    requestBody: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // Action type/category for grouping (e.g., "user.create", "lead.update")
    actionType: {
      type: String,
      index: true,
      default: null,
    },

    // ==================== CHANGES ====================
    // Previous state before modification (for PUT/PATCH/DELETE)
    previousState: {
      model: { type: String, default: null },
      documentId: { type: String, default: null },
      data: { type: mongoose.Schema.Types.Mixed, default: null },
    },
    // Computed changes (field-by-field diff)
    changes: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // ==================== WHERE ====================
    // IP address information
    ip: {
      type: String,
      index: true,
    },
    // Forwarded IPs chain (if behind proxies)
    forwardedFor: {
      type: String,
      default: null,
    },
    // Geographic information (if available from IP lookup)
    geo: {
      country: { type: String, default: null },
      countryCode: { type: String, default: null },
      region: { type: String, default: null },
      city: { type: String, default: null },
      timezone: { type: String, default: null },
      isp: { type: String, default: null },
    },

    // ==================== HOW (Device/Browser) ====================
    // Raw user agent string
    userAgent: {
      type: String,
      default: null,
    },
    // Parsed user agent information
    device: {
      type: { type: String, default: null }, // desktop, mobile, tablet, bot
      vendor: { type: String, default: null },
      model: { type: String, default: null },
    },
    browser: {
      name: { type: String, default: null },
      version: { type: String, default: null },
    },
    os: {
      name: { type: String, default: null },
      version: { type: String, default: null },
    },
    // Is this a known bot/crawler?
    isBot: {
      type: Boolean,
      default: false,
    },

    // ==================== DEVICE FINGERPRINT ====================
    // Unique device identifier (persisted on client)
    deviceId: {
      type: String,
      index: true,
      default: null,
    },
    // Device fingerprint data (collected from browser)
    deviceFingerprint: {
      // Screen
      screenWidth: { type: Number, default: null },
      screenHeight: { type: Number, default: null },
      colorDepth: { type: Number, default: null },
      pixelRatio: { type: Number, default: null },

      // Locale/Time
      timezone: { type: String, default: null },
      timezoneOffset: { type: Number, default: null },
      language: { type: String, default: null },
      languages: [{ type: String }],

      // Hardware
      platform: { type: String, default: null },
      hardwareConcurrency: { type: Number, default: null },
      deviceMemory: { type: Number, default: null },
      maxTouchPoints: { type: Number, default: null },

      // WebGL (GPU identification)
      webglVendor: { type: String, default: null },
      webglRenderer: { type: String, default: null },
      webglVersion: { type: String, default: null },
      webglMaxTextureSize: { type: Number, default: null },

      // Fingerprint hashes
      canvasHash: { type: String, default: null },
      audioHash: { type: String, default: null },
      fontFingerprint: { type: String, default: null },

      // Apple device detection
      isMac: { type: Boolean, default: null },
      isIOS: { type: Boolean, default: null },
      isSafari: { type: Boolean, default: null },
      isAppleSilicon: { type: Boolean, default: null },
      isAppleDevice: { type: Boolean, default: null },

      // Preferences
      colorScheme: { type: String, default: null },
      reducedMotion: { type: Boolean, default: null },

      // Connection
      connectionType: { type: String, default: null },
      connectionDownlink: { type: Number, default: null },
    },

    // ==================== REQUEST CONTEXT ====================
    // Origin/Referer for tracking source
    origin: {
      type: String,
      default: null,
    },
    referer: {
      type: String,
      default: null,
    },
    // Content type of request
    contentType: {
      type: String,
      default: null,
    },
    // Request size in bytes
    contentLength: {
      type: Number,
      default: 0,
    },
    // Accept-Language header
    acceptLanguage: {
      type: String,
      default: null,
    },

    // ==================== ERROR INFORMATION ====================
    // Error details if request failed
    error: {
      message: { type: String, default: null },
      code: { type: String, default: null },
      stack: { type: String, default: null },
    },

    // ==================== SECURITY FLAGS ====================
    // Was this a sensitive action requiring 2FA?
    isSensitiveAction: {
      type: Boolean,
      default: false,
    },
    // Did 2FA verification succeed?
    sensitiveActionVerified: {
      type: Boolean,
      default: null,
    },
    // Security risk score (calculated based on various factors)
    riskScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    // Security flags/warnings
    securityFlags: [
      {
        type: String,
        enum: [
          "unusual_ip",
          "unusual_location",
          "unusual_time",
          "rapid_requests",
          "failed_auth",
          "suspicious_user_agent",
          "missing_headers",
          "vpn_detected",
          "tor_detected",
          "2fa_challenge", // Normal 2FA prompt (not a failure)
        ],
      },
    ],

    // ==================== METADATA ====================
    // Environment (production, staging, development)
    environment: {
      type: String,
      default: process.env.NODE_ENV || "development",
    },
    // Server/instance identifier (useful for distributed systems)
    serverId: {
      type: String,
      default: process.env.SERVER_ID || "default",
    },
    // Custom tags for filtering
    tags: [
      {
        type: String,
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ==================== INDEXES ====================
// Compound indexes for common queries
activityLogSchema.index({ timestamp: -1 }); // Most recent first
activityLogSchema.index({ user: 1, timestamp: -1 }); // User activity timeline
activityLogSchema.index({ ip: 1, timestamp: -1 }); // IP activity
activityLogSchema.index({ statusCode: 1, timestamp: -1 }); // Error tracking
activityLogSchema.index({ method: 1, basePath: 1, timestamp: -1 }); // Endpoint analytics
activityLogSchema.index({ "userSnapshot.email": 1, timestamp: -1 }); // Email lookup
activityLogSchema.index({ actionType: 1, timestamp: -1 }); // Action type filtering
activityLogSchema.index({ riskScore: -1, timestamp: -1 }); // High-risk activity
activityLogSchema.index({ deviceId: 1, timestamp: -1 }); // Device activity tracking
activityLogSchema.index({ user: 1, deviceId: 1, timestamp: -1 }); // User+Device activity

// Keep createdAt indexed for queries (no auto-delete)
activityLogSchema.index({ createdAt: 1 });

// ==================== VIRTUALS ====================
activityLogSchema.virtual("isError").get(function () {
  return this.statusCode >= 400;
});

activityLogSchema.virtual("isSuccess").get(function () {
  return this.statusCode >= 200 && this.statusCode < 300;
});

activityLogSchema.virtual("responseTime").get(function () {
  return `${this.duration}ms`;
});

// ==================== STATIC METHODS ====================

/**
 * Get activity summary for a user
 */
activityLogSchema.statics.getUserActivitySummary = async function (
  userId,
  hours = 24
) {
  const windowStart = new Date(Date.now() - hours * 60 * 60 * 1000);

  const [totalRequests, byMethod, byStatus, recentActivity] = await Promise.all(
    [
      this.countDocuments({ user: userId, timestamp: { $gte: windowStart } }),

      this.aggregate([
        { $match: { user: userId, timestamp: { $gte: windowStart } } },
        { $group: { _id: "$method", count: { $sum: 1 } } },
      ]),

      this.aggregate([
        { $match: { user: userId, timestamp: { $gte: windowStart } } },
        { $group: { _id: "$statusCategory", count: { $sum: 1 } } },
      ]),

      this.find({ user: userId })
        .sort({ timestamp: -1 })
        .limit(10)
        .select("method path statusCode timestamp ip device browser"),
    ]
  );

  return {
    userId,
    timeWindow: `${hours} hours`,
    totalRequests,
    byMethod: Object.fromEntries(byMethod.map((m) => [m._id, m.count])),
    byStatus: Object.fromEntries(byStatus.map((s) => [s._id, s.count])),
    recentActivity,
  };
};

/**
 * Get activity from a specific IP
 */
activityLogSchema.statics.getIPActivity = async function (ip, hours = 24) {
  const windowStart = new Date(Date.now() - hours * 60 * 60 * 1000);

  return this.aggregate([
    { $match: { ip, timestamp: { $gte: windowStart } } },
    {
      $group: {
        _id: "$user",
        requestCount: { $sum: 1 },
        uniquePaths: { $addToSet: "$basePath" },
        firstSeen: { $min: "$timestamp" },
        lastSeen: { $max: "$timestamp" },
        statusCodes: { $addToSet: "$statusCode" },
      },
    },
    { $sort: { requestCount: -1 } },
  ]);
};

/**
 * Get failed requests summary
 */
activityLogSchema.statics.getFailedRequestsSummary = async function (
  hours = 24
) {
  const windowStart = new Date(Date.now() - hours * 60 * 60 * 1000);

  return this.aggregate([
    {
      $match: {
        statusCode: { $gte: 400 },
        timestamp: { $gte: windowStart },
      },
    },
    {
      $group: {
        _id: {
          path: "$basePath",
          statusCode: "$statusCode",
        },
        count: { $sum: 1 },
        lastOccurrence: { $max: "$timestamp" },
        users: { $addToSet: "$userSnapshot.email" },
        ips: { $addToSet: "$ip" },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 50 },
  ]);
};

/**
 * Get high-risk activity
 */
activityLogSchema.statics.getHighRiskActivity = async function (
  minRiskScore = 50,
  hours = 24
) {
  const windowStart = new Date(Date.now() - hours * 60 * 60 * 1000);

  return this.find({
    riskScore: { $gte: minRiskScore },
    timestamp: { $gte: windowStart },
  })
    .sort({ riskScore: -1, timestamp: -1 })
    .limit(100)
    .populate("user", "fullName email role");
};

/**
 * Get endpoint analytics
 */
activityLogSchema.statics.getEndpointAnalytics = async function (hours = 24) {
  const windowStart = new Date(Date.now() - hours * 60 * 60 * 1000);

  return this.aggregate([
    { $match: { timestamp: { $gte: windowStart } } },
    {
      $group: {
        _id: { method: "$method", path: "$basePath" },
        requestCount: { $sum: 1 },
        avgDuration: { $avg: "$duration" },
        maxDuration: { $max: "$duration" },
        errorCount: {
          $sum: { $cond: [{ $gte: ["$statusCode", 400] }, 1, 0] },
        },
        uniqueUsers: { $addToSet: "$user" },
      },
    },
    {
      $project: {
        _id: 1,
        requestCount: 1,
        avgDuration: { $round: ["$avgDuration", 2] },
        maxDuration: 1,
        errorCount: 1,
        uniqueUserCount: { $size: "$uniqueUsers" },
        errorRate: {
          $multiply: [{ $divide: ["$errorCount", "$requestCount"] }, 100],
        },
      },
    },
    { $sort: { requestCount: -1 } },
  ]);
};

/**
 * Clean old logs (manual cleanup, in addition to TTL)
 */
activityLogSchema.statics.cleanOldLogs = async function (days = 90) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const result = await this.deleteMany({ timestamp: { $lt: cutoff } });
  return result.deletedCount;
};

module.exports = mongoose.model("ActivityLog", activityLogSchema);
