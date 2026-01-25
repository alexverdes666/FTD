const mongoose = require("mongoose");

/**
 * PSPAuditLog model for tracking all PSP operations
 * Provides detailed audit trail: who did what and when
 */
const pspAuditLogSchema = new mongoose.Schema(
  {
    // Reference to the PSP being modified
    psp: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PSP",
      required: true,
      index: true,
    },
    // PSP name at the time of action (preserved for deleted PSPs)
    pspName: {
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
        "PSP_CREATED",
        "PSP_UPDATED",
        "PSP_DELETED",
        "STATUS_CHANGED",
        "NAME_CHANGED",
        "DESCRIPTION_CHANGED",
        "WEBSITE_CHANGED",
      ],
      index: true,
    },
    // Category for filtering
    category: {
      type: String,
      required: true,
      enum: ["psp", "status", "name", "description", "website"],
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
pspAuditLogSchema.index({ createdAt: -1 });
pspAuditLogSchema.index({ psp: 1, createdAt: -1 });
pspAuditLogSchema.index({ performedBy: 1, createdAt: -1 });
pspAuditLogSchema.index({ action: 1, createdAt: -1 });
pspAuditLogSchema.index({ category: 1, createdAt: -1 });

// Virtual for formatted action name
pspAuditLogSchema.virtual("actionLabel").get(function () {
  const actionLabels = {
    PSP_CREATED: "PSP Created",
    PSP_UPDATED: "PSP Updated",
    PSP_DELETED: "PSP Deleted",
    STATUS_CHANGED: "Status Changed",
    NAME_CHANGED: "Name Changed",
    DESCRIPTION_CHANGED: "Description Changed",
    WEBSITE_CHANGED: "Website Changed",
  };
  return actionLabels[this.action] || this.action;
});

// Virtual for category label
pspAuditLogSchema.virtual("categoryLabel").get(function () {
  const categoryLabels = {
    psp: "PSP",
    status: "Status",
    name: "Name",
    description: "Description",
    website: "Website",
  };
  return categoryLabels[this.category] || this.category;
});

module.exports = mongoose.model("PSPAuditLog", pspAuditLogSchema);
