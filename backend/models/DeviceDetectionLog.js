const mongoose = require("mongoose");

/**
 * DeviceDetectionLog model for tracking detailed device information
 * This model stores comprehensive device detection data from the get_info service
 * for all POST, PUT, PATCH, and DELETE operations
 *
 * Features:
 * - Complete IP information and proxy detection
 * - User agent parsing (browser, OS, device type)
 * - Anti-detect browser detection
 * - Geolocation data
 * - Client hints (modern browser capabilities)
 * - Security headers analysis
 * - Device system information (hostname, username, specs)
 * - Connection fingerprinting
 */
const deviceDetectionLogSchema = new mongoose.Schema(
  {
    // Reference to user who performed the action
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // User email at time of action (preserved even if user deleted)
    userEmail: {
      type: String,
      default: null,
    },

    // HTTP request details
    method: {
      type: String,
      required: true,
      enum: ["POST", "PUT", "PATCH", "DELETE"],
      index: true,
    },

    path: {
      type: String,
      required: true,
      index: true,
    },

    basePath: {
      type: String, // Path with IDs replaced (e.g., /api/users/:id)
      index: true,
    },

    statusCode: {
      type: Number,
      required: true,
      index: true,
    },

    // Action type (e.g., "users.create", "networks.update")
    actionType: {
      type: String,
      index: true,
    },

    // Request metadata
    requestBody: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    queryParams: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    routeParams: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // ============================================
    // IP INFORMATION (from get_info service)
    // ============================================
    ip: {
      clientIp: { type: String, index: true }, // Final determined client IP
      clientLocalIPs: [String], // Client's local/internal IPs (from WebRTC)
      socketIp: String, // IP from socket connection
      detectedIp: String, // IP detected before local resolution
      forwardedFor: String, // X-Forwarded-For header
      realIp: String, // X-Real-IP header
      cfConnectingIp: String, // Cloudflare IP
      ipChain: [String], // Full chain of proxied IPs
      isIPv6: Boolean,
      ipType: String, // "public", "private-class-a", "loopback", etc.
      connectionType: String, // Type of original connection
      // Legacy field name kept for backward compat with existing data
      localNetworkIPs: {
        ipv4: [
          {
            address: String,
            interface: String,
            netmask: String,
            mac: String,
          },
        ],
        ipv6: [
          {
            address: String,
            interface: String,
            netmask: String,
            mac: String,
            scopeid: Number,
          },
        ],
      },
      serverLocalIPs: {
        ipv4: [
          {
            address: String,
            interface: String,
            netmask: String,
            mac: String,
          },
        ],
        ipv6: [
          {
            address: String,
            interface: String,
            netmask: String,
            mac: String,
            scopeid: Number,
          },
        ],
      },
    },

    // ============================================
    // USER AGENT INFORMATION
    // ============================================
    userAgent: {
      raw: String, // Full user agent string
      browser: {
        name: String,
        version: String,
        major: String,
      },
      engine: {
        name: String,
        version: String,
      },
      os: {
        name: String,
        version: String,
      },
      device: {
        type: { type: String }, // "desktop", "mobile", "tablet", "bot"
        vendor: String,
        model: String,
      },
      cpu: {
        architecture: String,
      },
      isBot: Boolean,
      isMobile: Boolean,
      isTablet: Boolean,
    },

    // ============================================
    // CLIENT DEVICE INFO (derived from headers/client hints)
    // ============================================
    clientDevice: {
      platform: String, // "Windows", "macOS", "Linux", "Android", "iOS"
      platformVersion: String,
      architecture: String, // "x86", "arm"
      bitness: String, // "32", "64"
      deviceMemoryGB: String,
      devicePixelRatio: String,
      viewportWidth: String,
      browser: String,
      browserVersion: String,
      engine: String,
      deviceType: { type: String }, // "desktop", "mobile", "tablet"
      deviceVendor: String,
      deviceModel: String,
      isMobile: Boolean,
      isTablet: Boolean,
      isBot: Boolean,
      connectionType: { type: String },
      connectionRtt: String,
      connectionDownlink: String,
      localIPs: [String], // Client's local IPs from WebRTC
    },

    // ============================================
    // SERVER SYSTEM INFORMATION (the machine running get_info)
    // ============================================
    serverInfo: {
      hostname: String,
      user: {
        username: String,
        uid: Number,
        gid: Number,
        shell: String,
        homedir: String,
        userPath: String,
      },
      system: {
        platform: String, // "win32", "darwin", "linux"
        platformName: String, // "Windows", "macOS", "Linux"
        release: String,
        architecture: String, // "x64", "arm64"
        cpuCount: Number,
        cpuModel: String,
        cpuSpeed: Number,
        totalMemoryGB: String,
        freeMemoryGB: String,
        usedMemoryGB: String,
        memoryUsagePercent: String,
        uptimeHours: String,
      },
      tempDir: String,
      endianness: String,
    },

    // Legacy field - kept for backward compat with existing data
    device: {
      type: mongoose.Schema.Types.Mixed,
    },

    // ============================================
    // ANTI-DETECT BROWSER DETECTION
    // ============================================
    antidetect: {
      isDetected: { type: Boolean, index: true },
      browserName: String, // "dolphinAnty", "multilogin", "gologin", etc.
      indicators: [String], // List of indicators that triggered detection
      confidence: {
        type: String,
        enum: ["none", "low", "medium", "high"],
        default: "none",
      },
    },

    // ============================================
    // PROXY DETECTION
    // ============================================
    proxy: {
      isProxy: { type: Boolean, index: true },
      type: { type: String }, // "HTTP Proxy", "Cloudflare", etc.
      indicators: [String],
      proxyHeaders: mongoose.Schema.Types.Mixed,
    },

    // ============================================
    // CONNECTION INFORMATION
    // ============================================
    connection: {
      protocol: String, // "http", "https"
      httpVersion: String,
      host: String,
      origin: String,
      referer: String,
      connection: String, // "keep-alive", "close"
      keepAlive: String,
      cacheControl: String,
    },

    // ============================================
    // CLIENT HINTS (Modern Browser Capabilities)
    // ============================================
    clientHints: {
      ua: String, // Sec-CH-UA
      uaMobile: String, // Sec-CH-UA-Mobile
      uaPlatform: String, // Sec-CH-UA-Platform
      uaPlatformVersion: String,
      uaArch: String,
      uaBitness: String,
      uaModel: String,
      uaFullVersion: String,
      uaFullVersionList: String,
      prefersColorScheme: String,
      prefersReducedMotion: String,
      deviceMemory: String,
      dpr: String, // Device pixel ratio
      viewportWidth: String,
      contentDpr: String,
      ect: String, // Effective connection type
      rtt: String, // Round trip time
      downlink: String,
      saveData: String,
    },

    // ============================================
    // SECURITY HEADERS
    // ============================================
    securityHeaders: {
      dnt: String, // Do Not Track
      gpc: String, // Global Privacy Control
      secFetchSite: String,
      secFetchMode: String,
      secFetchDest: String,
      secFetchUser: String,
      upgradeInsecureRequests: String,
    },

    // ============================================
    // GEOLOCATION DATA
    // ============================================
    geo: {
      available: Boolean,
      country: String,
      region: String,
      city: String,
      timezone: String,
      coordinates: {
        lat: Number,
        lng: Number,
      },
      eu: Boolean, // Is in EU
      metro: Number,
      area: Number,
    },

    // ============================================
    // FINGERPRINT INDICATORS
    // ============================================
    fingerprint: {
      acceptLanguage: String,
      acceptEncoding: String,
      accept: String,
      languages: [
        {
          code: String,
          quality: Number,
        },
      ],
      encoding: [String],
      contentType: String,
    },

    // ============================================
    // RAW DATA & METADATA
    // ============================================
    rawHeaders: mongoose.Schema.Types.Mixed, // Full headers object
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },

    // Duration of the request
    duration: Number, // in milliseconds

    // Error information (if request failed)
    error: {
      message: String,
      code: String,
    },

    // Change tracking
    previousState: {
      model: String,
      documentId: String,
      data: mongoose.Schema.Types.Mixed,
    },
    changes: mongoose.Schema.Types.Mixed,

    // Security analysis
    riskScore: {
      type: Number,
      default: 0,
      index: true,
    },
    securityFlags: [String],

    // Indicates if this was a sensitive action requiring 2FA
    isSensitiveAction: Boolean,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ============================================
// INDEXES FOR PERFORMANCE
// ============================================
deviceDetectionLogSchema.index({ createdAt: -1 });
deviceDetectionLogSchema.index({ user: 1, createdAt: -1 });
deviceDetectionLogSchema.index({ method: 1, createdAt: -1 });
deviceDetectionLogSchema.index({ actionType: 1, createdAt: -1 });
deviceDetectionLogSchema.index({ "ip.clientIp": 1, createdAt: -1 });
deviceDetectionLogSchema.index({ "antidetect.isDetected": 1, createdAt: -1 });
deviceDetectionLogSchema.index({ "proxy.isProxy": 1, createdAt: -1 });
deviceDetectionLogSchema.index({ riskScore: 1, createdAt: -1 });
deviceDetectionLogSchema.index({ statusCode: 1, createdAt: -1 });

// Compound indexes for common queries
deviceDetectionLogSchema.index({
  user: 1,
  method: 1,
  createdAt: -1,
});
deviceDetectionLogSchema.index({
  "ip.clientIp": 1,
  method: 1,
  createdAt: -1,
});
deviceDetectionLogSchema.index({
  actionType: 1,
  statusCode: 1,
  createdAt: -1,
});

// ============================================
// VIRTUALS
// ============================================
deviceDetectionLogSchema.virtual("isSuccess").get(function () {
  return this.statusCode >= 200 && this.statusCode < 300;
});

deviceDetectionLogSchema.virtual("statusCategory").get(function () {
  if (this.statusCode >= 500) return "server_error";
  if (this.statusCode >= 400) return "client_error";
  if (this.statusCode >= 300) return "redirect";
  return "success";
});

deviceDetectionLogSchema.virtual("deviceType").get(function () {
  if (this.userAgent?.isBot) return "bot";
  if (this.userAgent?.device?.type) return this.userAgent.device.type;
  return "unknown";
});

deviceDetectionLogSchema.virtual("isSuspicious").get(function () {
  return (
    this.antidetect?.isDetected ||
    this.proxy?.isProxy ||
    this.riskScore > 50 ||
    this.userAgent?.isBot
  );
});

// ============================================
// STATIC METHODS
// ============================================

/**
 * Get suspicious activities in the last N hours
 */
deviceDetectionLogSchema.statics.getSuspiciousActivities = async function (
  hours = 24
) {
  const windowStart = new Date(Date.now() - hours * 60 * 60 * 1000);

  return this.find({
    createdAt: { $gte: windowStart },
    $or: [
      { "antidetect.isDetected": true },
      { "proxy.isProxy": true },
      { riskScore: { $gte: 50 } },
      { "userAgent.isBot": true },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate("user", "fullName email role");
};

/**
 * Get activity summary for a user
 */
deviceDetectionLogSchema.statics.getUserActivitySummary = async function (
  userId,
  days = 30
) {
  const windowStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [totalActions, failedActions, methodBreakdown, deviceTypes] =
    await Promise.all([
      this.countDocuments({ user: userId, createdAt: { $gte: windowStart } }),
      this.countDocuments({
        user: userId,
        statusCode: { $gte: 400 },
        createdAt: { $gte: windowStart },
      }),
      this.aggregate([
        { $match: { user: userId, createdAt: { $gte: windowStart } } },
        { $group: { _id: "$method", count: { $sum: 1 } } },
      ]),
      this.aggregate([
        { $match: { user: userId, createdAt: { $gte: windowStart } } },
        { $group: { _id: "$userAgent.device.type", count: { $sum: 1 } } },
      ]),
    ]);

  return {
    userId,
    timeWindow: `${days} days`,
    totalActions,
    failedActions,
    successRate:
      totalActions > 0
        ? (((totalActions - failedActions) / totalActions) * 100).toFixed(1) +
          "%"
        : "N/A",
    methodBreakdown,
    deviceTypes,
  };
};

/**
 * Get activity by IP address
 */
deviceDetectionLogSchema.statics.getActivityByIP = async function (
  ipAddress,
  hours = 24
) {
  const windowStart = new Date(Date.now() - hours * 60 * 60 * 1000);

  return this.find({
    "ip.clientIp": ipAddress,
    createdAt: { $gte: windowStart },
  })
    .sort({ createdAt: -1 })
    .populate("user", "fullName email role");
};

/**
 * Detect potential account sharing (same user, different devices/IPs)
 */
deviceDetectionLogSchema.statics.detectAccountSharing = async function (
  userId,
  hours = 24
) {
  const windowStart = new Date(Date.now() - hours * 60 * 60 * 1000);

  const uniqueIPs = await this.distinct("ip.clientIp", {
    user: userId,
    createdAt: { $gte: windowStart },
  });

  const uniqueDevices = await this.distinct("serverInfo.hostname", {
    user: userId,
    createdAt: { $gte: windowStart },
  });

  return {
    userId,
    timeWindow: `${hours} hours`,
    uniqueIPs: uniqueIPs.length,
    uniqueDevices: uniqueDevices.length,
    ipList: uniqueIPs,
    deviceList: uniqueDevices,
    isPotentialSharing:
      uniqueIPs.length > 2 || uniqueDevices.length > 2 ? true : false,
  };
};

/**
 * Get anti-detect browser usage stats
 */
deviceDetectionLogSchema.statics.getAntiDetectStats = async function (
  hours = 24
) {
  const windowStart = new Date(Date.now() - hours * 60 * 60 * 1000);

  const stats = await this.aggregate([
    {
      $match: {
        "antidetect.isDetected": true,
        createdAt: { $gte: windowStart },
      },
    },
    {
      $group: {
        _id: "$antidetect.browserName",
        count: { $sum: 1 },
        users: { $addToSet: "$user" },
      },
    },
    { $sort: { count: -1 } },
  ]);

  return {
    timeWindow: `${hours} hours`,
    totalDetections: stats.reduce((sum, s) => sum + s.count, 0),
    byBrowser: stats,
  };
};

module.exports = mongoose.model("DeviceDetectionLog", deviceDetectionLogSchema);
