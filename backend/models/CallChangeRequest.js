const mongoose = require("mongoose");

const callChangeRequestSchema = new mongoose.Schema(
  {
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    affiliateManagerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    currentCallNumber: {
      type: String,
      enum: ["1st", "2nd", "3rd", "4th", "5th", null],
      default: null,
    },
    requestedCallNumber: {
      type: String,
      enum: ["1st", "2nd", "3rd", "4th", "5th", null],
      default: null,
    },
    currentVerified: {
      type: Boolean,
      default: false,
    },
    requestedVerified: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
callChangeRequestSchema.index({ status: 1, createdAt: -1 });
callChangeRequestSchema.index({ leadId: 1, orderId: 1 });
callChangeRequestSchema.index({ requestedBy: 1 });
callChangeRequestSchema.index({ affiliateManagerId: 1, status: 1, reviewedAt: -1 });

const CallChangeRequest = mongoose.model(
  "CallChangeRequest",
  callChangeRequestSchema
);

module.exports = CallChangeRequest;
