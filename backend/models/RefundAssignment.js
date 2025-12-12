const mongoose = require("mongoose");
const { Schema } = mongoose;

const REFUND_STATUSES = [
  "new",
  "uploaded", // For CSV imports
  "initial_email",
  "request_approved",
  "docs_sent",
  "threatening_email",
  "review_posted",
  "review_dispute",
  "review_removed",
  "refunded_checked",
  "refund_complete",
  "rejected",
  "fraud",
];

const refundAssignmentSchema = new Schema(
  {
    // Source information - either from order or CSV upload
    source: {
      type: String,
      enum: ["order", "csv"],
      required: true,
      default: "order",
    },

    // Order-based FTD fields (required only for order source)
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: function () {
        return this.source === "order";
      },
    },
    leadId: {
      type: Schema.Types.ObjectId,
      ref: "Lead",
      required: function () {
        return this.source === "order";
      },
    },

    // CSV-based FTD fields (required only for CSV source)
    firstName: {
      type: String,
      required: function () {
        return this.source === "csv";
      },
      trim: true,
    },
    lastName: {
      type: String,
      required: function () {
        return this.source === "csv";
      },
      trim: true,
    },
    email: {
      type: String,
      required: function () {
        return this.source === "csv";
      },
      lowercase: true,
      trim: true,
    },

    // CSV-specific fields (optional for CSV source)
    twoFA: {
      type: String,
      trim: true,
    },
    recoveryCodes: {
      type: String,
      trim: true,
    },
    geo: {
      type: String,
      trim: true,
    },
    date: {
      type: Date,
    },
    lastFourDigitsCard: {
      type: String,
      trim: true,
    },
    bank: {
      type: String,
      trim: true,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', ''],
      default: '',
      trim: true,
    },
    dateOfBirth: {
      type: Date,
    },
    comment: {
      type: String,
      trim: true,
    },
    psp1: {
      type: String,
      trim: true,
    },
    broker1: {
      type: String,
      trim: true,
    },
    psp2: {
      type: String,
      trim: true,
    },
    broker2: {
      type: String,
      trim: true,
    },
    step1: {
      type: String,
      trim: true,
    },
    step2: {
      type: String,
      trim: true,
    },
    step3: {
      type: String,
      trim: true,
    },
    step4: {
      type: String,
      trim: true,
    },
    step5: {
      type: String,
      trim: true,
    },

    // Documents from lead (for order-based refunds)
    documents: {
      type: Schema.Types.Mixed,
      default: [],
    },

    // Address from lead (for order-based refunds)
    address: {
      type: String,
      trim: true,
    },

    // PSP Email tracking
    pspEmailSent: {
      type: Boolean,
      default: false,
    },
    pspEmailSentAt: {
      type: Date,
    },
    pspEmailSentBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    // Common fields
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    refundsManager: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: REFUND_STATUSES,
      default: function () {
        return this.source === "csv" ? "uploaded" : "new";
      },
    },
    notes: {
      type: String,
      trim: true,
    },
    statusHistory: [
      {
        status: {
          type: String,
          enum: REFUND_STATUSES,
          required: true,
        },
        changedBy: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        changedAt: {
          type: Date,
          default: Date.now,
        },
        notes: String,
      },
    ],
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    refundDate: {
      type: Date,
      // Automatically set when status changes to 'refund_complete'
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for efficient queries
refundAssignmentSchema.index({ refundsManager: 1, status: 1 });
refundAssignmentSchema.index({ orderId: 1 });
refundAssignmentSchema.index({ leadId: 1 });
refundAssignmentSchema.index({ assignedAt: -1 });
refundAssignmentSchema.index({ source: 1 });
refundAssignmentSchema.index({ email: 1 });

// Virtual for full name (works for both CSV and order-based FTDs)
refundAssignmentSchema.virtual("fullName").get(function () {
  if (this.source === "csv") {
    return `${this.firstName} ${this.lastName}`;
  } else if (this.leadId && this.leadId.firstName && this.leadId.lastName) {
    return `${this.leadId.firstName} ${this.leadId.lastName}`;
  }
  return "N/A";
});

// Virtual for email (works for both CSV and order-based FTDs)
refundAssignmentSchema.virtual("customerEmail").get(function () {
  if (this.source === "csv") {
    return this.email;
  } else if (this.leadId && this.leadId.email) {
    return this.leadId.email;
  }
  return "N/A";
});

// Virtual for current status with timestamp
refundAssignmentSchema.virtual("currentStatusInfo").get(function () {
  if (this.statusHistory && this.statusHistory.length > 0) {
    return this.statusHistory[this.statusHistory.length - 1];
  }
  return {
    status: this.status,
    changedAt: this.assignedAt,
    changedBy: this.assignedBy,
  };
});

// Virtual for last update info (status change or note update)
refundAssignmentSchema.virtual("lastUpdateInfo").get(function () {
  const lastStatusChange = this.statusHistory && this.statusHistory.length > 0
    ? this.statusHistory[this.statusHistory.length - 1].changedAt
    : null;
  
  const updatedAt = this.updatedAt;
  
  // Determine the most recent update
  let lastUpdate = this.createdAt;
  let updateType = 'created';
  
  if (lastStatusChange) {
    lastUpdate = lastStatusChange;
    updateType = 'status_change';
  }
  
  // If updatedAt is more recent than last status change, it means notes were updated
  if (updatedAt && (!lastStatusChange || new Date(updatedAt) > new Date(lastStatusChange))) {
    lastUpdate = updatedAt;
    // Only mark as note_update if it's significantly different from status change
    if (!lastStatusChange || (new Date(updatedAt) - new Date(lastStatusChange) > 1000)) {
      updateType = 'note_update';
    }
  }
  
  return {
    timestamp: lastUpdate,
    type: updateType
  };
});

// Pre-save middleware to update status history and refund date
refundAssignmentSchema.pre("save", function (next) {
  if (this.isModified("status") && !this.isNew) {
    this.statusHistory.push({
      status: this.status,
      changedBy: this.modifiedBy || this.assignedBy,
      changedAt: new Date(),
      notes: this.statusChangeNotes,
    });

    // Automatically set refund date when status changes to 'refund_complete'
    if (this.status === "refund_complete" && !this.refundDate) {
      this.refundDate = new Date();
    }

    // Clear temporary fields
    this.modifiedBy = undefined;
    this.statusChangeNotes = undefined;
  }
  next();
});

// Static method to get refunds manager (assuming there's only one)
refundAssignmentSchema.statics.getRefundsManager = async function () {
  const User = mongoose.model("User");
  return await User.findOne({
    role: "refunds_manager",
    isActive: true,
    status: "approved",
  });
};

// Static method to get assignments by status
refundAssignmentSchema.statics.getByStatus = function (
  refundsManagerId,
  status = null
) {
  const query = { refundsManager: refundsManagerId };
  if (status) {
    query.status = status;
  }

  return this.find(query)
    .populate("orderId", "requester status createdAt")
    .populate(
      "leadId",
      "firstName lastName newEmail oldEmail newPhone oldPhone country leadType"
    )
    .populate("assignedBy", "fullName email")
    .populate("refundsManager", "fullName email")
    .sort({ assignedAt: -1 });
};

module.exports = mongoose.model("RefundAssignment", refundAssignmentSchema);
