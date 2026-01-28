const mongoose = require("mongoose");

/**
 * CardIssuerAuditLog model for tracking all Card Issuer operations
 * Provides detailed audit trail: who did what and when
 */
const cardIssuerAuditLogSchema = new mongoose.Schema(
  {
    // Reference to the Card Issuer being modified
    cardIssuer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CardIssuer",
      required: true,
      index: true,
    },
    // Card Issuer name at the time of action (preserved for deleted issuers)
    cardIssuerName: {
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
        "CARD_ISSUER_CREATED",
        "CARD_ISSUER_UPDATED",
        "CARD_ISSUER_DELETED",
        "STATUS_CHANGED",
        "NAME_CHANGED",
        "DESCRIPTION_CHANGED",
      ],
      index: true,
    },
    // Category for filtering
    category: {
      type: String,
      required: true,
      enum: ["cardIssuer", "status", "name", "description"],
      index: true,
    },
    // Detailed description of the change
    description: {
      type: String,
      required: true,
    },
    // Previous values (for comparison)
    previousValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // New values (for comparison)
    newValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // Additional metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // IP address of the user (for security audit)
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
cardIssuerAuditLogSchema.index({ createdAt: -1 });
cardIssuerAuditLogSchema.index({ cardIssuer: 1, createdAt: -1 });
cardIssuerAuditLogSchema.index({ performedBy: 1, createdAt: -1 });
cardIssuerAuditLogSchema.index({ action: 1, createdAt: -1 });
cardIssuerAuditLogSchema.index({ category: 1, createdAt: -1 });

// Virtual for formatted action name
cardIssuerAuditLogSchema.virtual("actionLabel").get(function () {
  const actionLabels = {
    CARD_ISSUER_CREATED: "Card Issuer Created",
    CARD_ISSUER_UPDATED: "Card Issuer Updated",
    CARD_ISSUER_DELETED: "Card Issuer Deleted",
    STATUS_CHANGED: "Status Changed",
    NAME_CHANGED: "Name Changed",
    DESCRIPTION_CHANGED: "Description Changed",
  };
  return actionLabels[this.action] || this.action;
});

// Virtual for category label
cardIssuerAuditLogSchema.virtual("categoryLabel").get(function () {
  const categoryLabels = {
    cardIssuer: "Card Issuer",
    status: "Status",
    name: "Name",
    description: "Description",
  };
  return categoryLabels[this.category] || this.category;
});

module.exports = mongoose.model("CardIssuerAuditLog", cardIssuerAuditLogSchema);
