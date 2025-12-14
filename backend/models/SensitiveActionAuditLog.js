const mongoose = require("mongoose");

/**
 * SensitiveActionAuditLog model for tracking all sensitive action attempts
 * This provides a security audit trail for critical operations that require 2FA
 *
 * This log captures:
 * - Successful sensitive actions with 2FA verification
 * - Failed attempts (wrong code, no code provided, 2FA not enabled)
 * - The action type and target resource
 * - IP address and user agent for forensic analysis
 */
const sensitiveActionAuditLogSchema = new mongoose.Schema(
  {
    // User who attempted the action
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Email at the time of action (preserved even if user is deleted)
    userEmail: {
      type: String,
      required: true,
    },

    // Type of sensitive action attempted
    action: {
      type: String,
      required: true,
      enum: [
        "WALLET_CREATE",
        "WALLET_UPDATE",
        "WALLET_DELETE",
        "USER_CREATE",
        "USER_UPDATE_ROLE",
        "USER_UPDATE_PASSWORD",
        "USER_DELETE",
        "USER_KICK_SESSION",
        "SECURITY_DISABLE_2FA",
        "SECURITY_REGENERATE_BACKUP",
        "SYSTEM_CONFIG_UPDATE",
      ],
      index: true,
    },

    // Human-readable description
    actionDescription: {
      type: String,
      required: true,
    },

    // Whether the action was successful
    success: {
      type: Boolean,
      required: true,
      index: true,
    },

    // Reason for failure (if success is false)
    failureReason: {
      type: String,
      default: null,
    },

    // Target resource being affected
    targetResource: {
      type: String,
      default: null,
    },

    // Type of target resource (e.g., "network", "user")
    targetResourceType: {
      type: String,
      default: null,
    },

    // IP address of the requester
    ipAddress: {
      type: String,
      default: null,
      index: true,
    },

    // User agent string
    userAgent: {
      type: String,
      default: null,
    },

    // The API endpoint that was called
    requestPath: {
      type: String,
      default: null,
    },

    // HTTP method
    requestMethod: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for efficient querying
sensitiveActionAuditLogSchema.index({ createdAt: -1 });
sensitiveActionAuditLogSchema.index({ user: 1, createdAt: -1 });
sensitiveActionAuditLogSchema.index({ action: 1, createdAt: -1 });
sensitiveActionAuditLogSchema.index({ success: 1, createdAt: -1 });
sensitiveActionAuditLogSchema.index({ ipAddress: 1, createdAt: -1 });

// Compound indexes for common queries
sensitiveActionAuditLogSchema.index({ user: 1, action: 1, createdAt: -1 });
sensitiveActionAuditLogSchema.index({ success: 1, action: 1, createdAt: -1 });

// Virtual for formatted action status
sensitiveActionAuditLogSchema.virtual("statusLabel").get(function () {
  return this.success ? "Verified" : "Failed";
});

// Virtual for severity level
sensitiveActionAuditLogSchema.virtual("severity").get(function () {
  if (!this.success) {
    // Failed attempts are higher severity - potential attack indicator
    return "high";
  }

  // Successful sensitive actions are medium severity - important but expected
  const highSeverityActions = [
    "WALLET_UPDATE",
    "WALLET_DELETE",
    "USER_DELETE",
    "USER_UPDATE_PASSWORD",
    "SECURITY_DISABLE_2FA",
  ];

  return highSeverityActions.includes(this.action) ? "medium" : "low";
});

// Static method to get failed attempts for a user in the last hour
sensitiveActionAuditLogSchema.statics.getRecentFailedAttempts = async function (
  userId,
  windowMinutes = 60
) {
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);
  return this.countDocuments({
    user: userId,
    success: false,
    createdAt: { $gte: windowStart },
  });
};

// Static method to get failed attempts from an IP in the last hour
sensitiveActionAuditLogSchema.statics.getFailedAttemptsFromIP = async function (
  ipAddress,
  windowMinutes = 60
) {
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);
  return this.countDocuments({
    ipAddress,
    success: false,
    createdAt: { $gte: windowStart },
  });
};

// Static method to get audit summary for dashboard
sensitiveActionAuditLogSchema.statics.getSecuritySummary = async function (
  hours = 24
) {
  const windowStart = new Date(Date.now() - hours * 60 * 60 * 1000);

  const [totalActions, failedActions, actionsByType, failedByUser] =
    await Promise.all([
      // Total actions in window
      this.countDocuments({ createdAt: { $gte: windowStart } }),

      // Failed actions in window
      this.countDocuments({ success: false, createdAt: { $gte: windowStart } }),

      // Actions grouped by type
      this.aggregate([
        { $match: { createdAt: { $gte: windowStart } } },
        {
          $group: {
            _id: { action: "$action", success: "$success" },
            count: { $sum: 1 },
          },
        },
      ]),

      // Failed attempts by user (potential compromised accounts)
      this.aggregate([
        { $match: { success: false, createdAt: { $gte: windowStart } } },
        {
          $group: {
            _id: "$user",
            userEmail: { $first: "$userEmail" },
            failedCount: { $sum: 1 },
            lastAttempt: { $max: "$createdAt" },
          },
        },
        { $sort: { failedCount: -1 } },
        { $limit: 10 },
      ]),
    ]);

  return {
    timeWindow: `${hours} hours`,
    totalSensitiveActions: totalActions,
    failedVerifications: failedActions,
    successRate:
      totalActions > 0
        ? (((totalActions - failedActions) / totalActions) * 100).toFixed(1) +
          "%"
        : "N/A",
    actionsByType,
    topFailedUsers: failedByUser,
  };
};

module.exports = mongoose.model(
  "SensitiveActionAuditLog",
  sensitiveActionAuditLogSchema
);


