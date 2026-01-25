const mongoose = require("mongoose");

/**
 * ClientBrokerAuditLog model for tracking all client broker operations
 * Provides detailed audit trail: who did what and when
 */
const clientBrokerAuditLogSchema = new mongoose.Schema(
  {
    // Reference to the client broker being modified
    clientBroker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClientBroker",
      required: true,
      index: true,
    },
    // Broker name at the time of action (preserved for deleted brokers)
    brokerName: {
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
        "BROKER_CREATED",
        "BROKER_UPDATED",
        "BROKER_DELETED",
        "STATUS_CHANGED",
        "NAME_CHANGED",
        "DOMAIN_CHANGED",
        "DESCRIPTION_CHANGED",
        "PSP_ADDED",
        "PSP_REMOVED",
      ],
      index: true,
    },
    // Category for filtering
    category: {
      type: String,
      required: true,
      enum: ["broker", "status", "name", "domain", "description", "psp"],
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
clientBrokerAuditLogSchema.index({ createdAt: -1 });
clientBrokerAuditLogSchema.index({ clientBroker: 1, createdAt: -1 });
clientBrokerAuditLogSchema.index({ performedBy: 1, createdAt: -1 });
clientBrokerAuditLogSchema.index({ action: 1, createdAt: -1 });
clientBrokerAuditLogSchema.index({ category: 1, createdAt: -1 });

// Virtual for formatted action name
clientBrokerAuditLogSchema.virtual("actionLabel").get(function () {
  const actionLabels = {
    BROKER_CREATED: "Broker Created",
    BROKER_UPDATED: "Broker Updated",
    BROKER_DELETED: "Broker Deleted",
    STATUS_CHANGED: "Status Changed",
    NAME_CHANGED: "Name Changed",
    DOMAIN_CHANGED: "Domain Changed",
    DESCRIPTION_CHANGED: "Description Changed",
    PSP_ADDED: "PSP Added",
    PSP_REMOVED: "PSP Removed",
  };
  return actionLabels[this.action] || this.action;
});

// Virtual for category label
clientBrokerAuditLogSchema.virtual("categoryLabel").get(function () {
  const categoryLabels = {
    broker: "Broker",
    status: "Status",
    name: "Name",
    domain: "Domain",
    description: "Description",
    psp: "PSP",
  };
  return categoryLabels[this.category] || this.category;
});

module.exports = mongoose.model("ClientBrokerAuditLog", clientBrokerAuditLogSchema);
