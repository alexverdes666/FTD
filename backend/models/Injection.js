const mongoose = require("mongoose");

const injectionSchema = new mongoose.Schema(
  {
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    // The AM (or admin) who created the injection
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // The agent who should perform the injection (null if AM injects themselves)
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    injectionType: {
      type: String,
      enum: ["self", "agent"],
      required: true,
    },
    workingHours: {
      type: String,
      trim: true,
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "injected", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    statusHistory: [
      {
        status: {
          type: String,
          enum: ["pending", "injected", "approved", "rejected"],
          required: true,
        },
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        changedAt: {
          type: Date,
          default: Date.now,
        },
        note: {
          type: String,
          trim: true,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

injectionSchema.index({ assignedTo: 1, status: 1 });
injectionSchema.index({ assignedBy: 1, status: 1 });
injectionSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Injection", injectionSchema);
