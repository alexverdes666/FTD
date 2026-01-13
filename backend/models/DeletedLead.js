const mongoose = require("mongoose");

const DeletedLeadSchema = new mongoose.Schema(
  {
    // Original lead data (full snapshot)
    leadData: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, "Lead data is required"],
    },

    // Deletion metadata
    deletedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Deleted by user is required"],
    },
    deletionReason: {
      type: String,
      required: [true, "Deletion reason is required"],
      minlength: [10, "Deletion reason must be at least 10 characters"],
    },
    deletionType: {
      type: String,
      enum: ["single", "bulk"],
      default: "single",
    },

    // References to trace where lead was used
    orderReferences: [
      {
        orderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Order",
        },
        orderedAs: {
          type: String,
          enum: ["ftd", "filler", "cold", "live", null],
        },
        orderCreatedAt: Date,
      },
    ],

    // Additional traces found at deletion time
    traces: {
      depositCalls: [mongoose.Schema.Types.Mixed],
      callChangeRequests: [mongoose.Schema.Types.Mixed],
      refundAssignments: [mongoose.Schema.Types.Mixed],
      fingerprints: [mongoose.Schema.Types.Mixed],
      clientBrokerAssignments: [String], // broker names
    },

    // Activity log reference
    activityLogId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ActivityLog",
    },

    // Make searchable
    searchFields: {
      email: {
        type: String,
        index: true,
      },
      phone: {
        type: String,
        index: true,
      },
      firstName: {
        type: String,
        index: true,
      },
      lastName: {
        type: String,
        index: true,
      },
      originalLeadId: {
        type: mongoose.Schema.Types.ObjectId,
        index: true,
        required: [true, "Original lead ID is required"],
      },
    },

    // Restoration tracking
    restoredAt: Date,
    restoredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    restorationCount: {
      type: Number,
      default: 0,
    },

    // Migration flag for historically deleted leads
    migrationRecovered: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
DeletedLeadSchema.index({ deletedAt: -1 });
DeletedLeadSchema.index({ "searchFields.email": 1 });
DeletedLeadSchema.index({ "searchFields.phone": 1 });
DeletedLeadSchema.index({ "searchFields.originalLeadId": 1 });
DeletedLeadSchema.index({ deletedBy: 1 });
DeletedLeadSchema.index({ migrationRecovered: 1 });

// Compound index for common queries
DeletedLeadSchema.index({ deletedAt: -1, deletedBy: 1 });
DeletedLeadSchema.index({ "searchFields.firstName": 1, "searchFields.lastName": 1 });

module.exports = mongoose.model("DeletedLead", DeletedLeadSchema);
