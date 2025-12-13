const mongoose = require("mongoose");

/**
 * ClientNetworkAuditLog model for tracking all client network operations
 * Provides detailed audit trail: who did what and when
 */
const clientNetworkAuditLogSchema = new mongoose.Schema(
  {
    // Reference to the client network being modified
    clientNetwork: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClientNetwork",
      required: true,
      index: true,
    },
    // Network name at the time of action (preserved for deleted networks)
    networkName: {
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
        "NETWORK_CREATED",
        "NETWORK_UPDATED",
        "NETWORK_DELETED",
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
      enum: ["network", "status", "name", "description"],
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
clientNetworkAuditLogSchema.index({ createdAt: -1 });
clientNetworkAuditLogSchema.index({ clientNetwork: 1, createdAt: -1 });
clientNetworkAuditLogSchema.index({ performedBy: 1, createdAt: -1 });
clientNetworkAuditLogSchema.index({ action: 1, createdAt: -1 });
clientNetworkAuditLogSchema.index({ category: 1, createdAt: -1 });

// Virtual for formatted action name
clientNetworkAuditLogSchema.virtual("actionLabel").get(function () {
  const actionLabels = {
    NETWORK_CREATED: "Network Created",
    NETWORK_UPDATED: "Network Updated",
    NETWORK_DELETED: "Network Deleted",
    STATUS_CHANGED: "Status Changed",
    NAME_CHANGED: "Name Changed",
    DESCRIPTION_CHANGED: "Description Changed",
  };
  return actionLabels[this.action] || this.action;
});

// Virtual for category label
clientNetworkAuditLogSchema.virtual("categoryLabel").get(function () {
  const categoryLabels = {
    network: "Network",
    status: "Status",
    name: "Name",
    description: "Description",
  };
  return categoryLabels[this.category] || this.category;
});

module.exports = mongoose.model(
  "ClientNetworkAuditLog",
  clientNetworkAuditLogSchema
);
