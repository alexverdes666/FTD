const mongoose = require("mongoose");

/**
 * NetworkAuditLog model for tracking all network/wallet operations
 * Provides detailed audit trail for who did what and when
 */
const networkAuditLogSchema = new mongoose.Schema(
  {
    // Reference to the network being modified
    network: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OurNetwork",
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
        "WALLET_ADDED",
        "WALLET_REMOVED",
        "WALLET_UPDATED",
        "MANAGER_ASSIGNED",
        "MANAGER_REMOVED",
        "STATUS_CHANGED",
      ],
      index: true,
    },
    // Category for filtering
    category: {
      type: String,
      required: true,
      enum: ["network", "wallet", "manager", "status"],
      index: true,
    },
    // Detailed description of the change
    description: {
      type: String,
      required: true,
    },
    // Blockchain type for wallet operations
    blockchain: {
      type: String,
      enum: ["ethereum", "bitcoin", "tron", null],
      default: null,
    },
    // Wallet address involved (for wallet operations)
    walletAddress: {
      type: String,
      default: null,
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
networkAuditLogSchema.index({ createdAt: -1 });
networkAuditLogSchema.index({ network: 1, createdAt: -1 });
networkAuditLogSchema.index({ performedBy: 1, createdAt: -1 });
networkAuditLogSchema.index({ action: 1, createdAt: -1 });
networkAuditLogSchema.index({ category: 1, createdAt: -1 });
networkAuditLogSchema.index({ blockchain: 1, createdAt: -1 });

// Virtual for formatted action name
networkAuditLogSchema.virtual("actionLabel").get(function () {
  const actionLabels = {
    NETWORK_CREATED: "Network Created",
    NETWORK_UPDATED: "Network Updated",
    NETWORK_DELETED: "Network Deleted",
    WALLET_ADDED: "Wallet Added",
    WALLET_REMOVED: "Wallet Removed",
    WALLET_UPDATED: "Wallet Updated",
    MANAGER_ASSIGNED: "Manager Assigned",
    MANAGER_REMOVED: "Manager Removed",
    STATUS_CHANGED: "Status Changed",
  };
  return actionLabels[this.action] || this.action;
});

// Virtual for blockchain label
networkAuditLogSchema.virtual("blockchainLabel").get(function () {
  const blockchainLabels = {
    ethereum: "Ethereum (ETH)",
    bitcoin: "Bitcoin (BTC)",
    tron: "TRON (TRX)",
  };
  return this.blockchain ? blockchainLabels[this.blockchain] : null;
});

module.exports = mongoose.model("NetworkAuditLog", networkAuditLogSchema);
