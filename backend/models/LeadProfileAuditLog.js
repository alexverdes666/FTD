const mongoose = require("mongoose");

/**
 * LeadProfileAuditLog model for tracking all LeadProfileCredential operations
 * Provides detailed audit trail: who did what and when
 */
const leadProfileAuditLogSchema = new mongoose.Schema(
  {
    // Reference to the LeadProfileCredential being modified
    leadProfileCredential: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LeadProfileCredential",
      required: true,
      index: true,
    },
    // Reference to the Lead (for querying all audit logs for a lead)
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
      index: true,
    },
    // Account type at the time of action (preserved for deleted profiles)
    accountType: {
      type: String,
      required: true,
    },
    // User who performed the action
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Type of action performed
    action: {
      type: String,
      required: true,
      enum: [
        "PROFILE_CREATED",
        "PROFILE_DELETED",
        "ACCOUNT_TYPE_CHANGED",
        "USERNAME_CHANGED",
        "PASSWORD_CHANGED",
        "TWO_FACTOR_CHANGED",
        "RECOVERY_CODES_CHANGED",
        "NOTES_CHANGED",
      ],
      index: true,
    },
    // Category for filtering
    category: {
      type: String,
      required: true,
      enum: [
        "profile",
        "accountType",
        "username",
        "password",
        "twoFactor",
        "recoveryCodes",
        "notes",
      ],
      index: true,
    },
    // Detailed description of the change
    description: {
      type: String,
      required: true,
    },
    // Previous values (sensitive fields are encrypted)
    previousValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // New values (sensitive fields are encrypted)
    newValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // Additional metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // IP address of the user
    ipAddress: {
      type: String,
      default: null,
    },
    // User agent string
    userAgent: {
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
leadProfileAuditLogSchema.index({ createdAt: -1 });
leadProfileAuditLogSchema.index({ leadProfileCredential: 1, createdAt: -1 });
leadProfileAuditLogSchema.index({ lead: 1, createdAt: -1 });
leadProfileAuditLogSchema.index({ performedBy: 1, createdAt: -1 });
leadProfileAuditLogSchema.index({ action: 1, createdAt: -1 });
leadProfileAuditLogSchema.index({ category: 1, createdAt: -1 });

// Virtual for formatted action name
leadProfileAuditLogSchema.virtual("actionLabel").get(function () {
  const actionLabels = {
    PROFILE_CREATED: "Profile Created",
    PROFILE_DELETED: "Profile Deleted",
    ACCOUNT_TYPE_CHANGED: "Account Type Changed",
    USERNAME_CHANGED: "Username Changed",
    PASSWORD_CHANGED: "Password Changed",
    TWO_FACTOR_CHANGED: "2FA Secret Changed",
    RECOVERY_CODES_CHANGED: "Recovery Codes Changed",
    NOTES_CHANGED: "Notes Changed",
  };
  return actionLabels[this.action] || this.action;
});

// Virtual for category label
leadProfileAuditLogSchema.virtual("categoryLabel").get(function () {
  const categoryLabels = {
    profile: "Profile",
    accountType: "Account Type",
    username: "Username",
    password: "Password",
    twoFactor: "2FA",
    recoveryCodes: "Recovery Codes",
    notes: "Notes",
  };
  return categoryLabels[this.category] || this.category;
});

module.exports = mongoose.model(
  "LeadProfileAuditLog",
  leadProfileAuditLogSchema
);
