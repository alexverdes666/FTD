const mongoose = require("mongoose");

const incomingSMSSchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      required: true,
      index: true,
    },
    sender: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    recipient: {
      type: String,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
    port: {
      type: String,
      trim: true,
      index: true,
    },
    slot: {
      type: String,
      trim: true,
    },
    deliveryReport: {
      type: String,
      trim: true,
    },
    simCard: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SimCard",
      index: true,
    },
    gatewayDevice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GatewayDevice",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient filtering
incomingSMSSchema.index({ timestamp: -1, simCard: 1 });
incomingSMSSchema.index({ sender: 1, timestamp: -1 });

module.exports = mongoose.model("IncomingSMS", incomingSMSSchema);
