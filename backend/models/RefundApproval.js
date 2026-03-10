const mongoose = require("mongoose");
const { Schema } = mongoose;

const APPROVAL_STATUSES = [
  "pending_superior",  // Waiting for superior lead manager review
  "pending_admin",     // Superior approved, waiting for admin review
  "approved",          // Admin approved - refund_complete
  "rejected",          // Rejected at any final step (reverts to previous status)
];

const refundApprovalSchema = new Schema(
  {
    // The refund assignment this approval is for
    refundAssignmentId: {
      type: Schema.Types.ObjectId,
      ref: "RefundAssignment",
      required: true,
    },

    // Who requested the refund check (the refunds manager)
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // The superior lead manager assigned to review
    superiorManager: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // The admin selected by the superior manager for final review
    adminReviewer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // The status before the approval was requested (to revert on rejection)
    previousStatus: {
      type: String,
      required: true,
    },

    // Current approval status
    status: {
      type: String,
      enum: APPROVAL_STATUSES,
      default: "pending_superior",
    },

    // Notes from the refunds manager when requesting
    requestNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    // Decision history - tracks every approve/reject action
    decisions: [
      {
        decidedBy: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        decision: {
          type: String,
          enum: ["approve", "reject"],
          required: true,
        },
        role: {
          type: String,
          enum: ["superior", "admin"],
          required: true,
        },
        notes: {
          type: String,
          trim: true,
          maxlength: 1000,
        },
        // Evidence image IDs uploaded with this decision
        evidenceImages: [
          {
            type: Schema.Types.ObjectId,
            ref: "RefundApprovalImage",
          },
        ],
        decidedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
refundApprovalSchema.index({ refundAssignmentId: 1 });
refundApprovalSchema.index({ superiorManager: 1, status: 1 });
refundApprovalSchema.index({ adminReviewer: 1, status: 1 });
refundApprovalSchema.index({ status: 1 });
refundApprovalSchema.index({ requestedBy: 1 });
refundApprovalSchema.index({ createdAt: -1 });

// Virtual for latest decision
refundApprovalSchema.virtual("latestDecision").get(function () {
  if (this.decisions && this.decisions.length > 0) {
    return this.decisions[this.decisions.length - 1];
  }
  return null;
});

module.exports = mongoose.model("RefundApproval", refundApprovalSchema);
