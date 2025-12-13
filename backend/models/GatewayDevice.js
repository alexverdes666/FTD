const mongoose = require("mongoose");
const encryptFields = require("./plugins/encryptFields");

const gatewayDeviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    host: {
      type: String,
      required: true,
      trim: true,
    },
    port: {
      type: Number,
      required: true,
      min: 1,
      max: 65535,
    },
    username: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    // Connection status
    lastConnectionTest: {
      type: Date,
    },
    lastConnectionStatus: {
      type: String,
      enum: ["success", "failed", "never_tested"],
      default: "never_tested",
    },
    lastConnectionError: {
      type: String,
    },
    // Status notification configuration
    statusNotificationEnabled: {
      type: Boolean,
      default: false,
    },
    statusNotificationPeriod: {
      type: Number,
      default: 60, // seconds
      min: 60,
    },
    statusNotificationUrl: {
      type: String,
    },
    // Statistics
    stats: {
      totalPorts: {
        type: Number,
        default: 0,
      },
      activePorts: {
        type: Number,
        default: 0,
      },
      lastStatusUpdate: {
        type: Date,
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for efficient querying
gatewayDeviceSchema.index({ host: 1, port: 1 }, { unique: true });
gatewayDeviceSchema.index({ isActive: 1 });

// Virtual for base URL
gatewayDeviceSchema.virtual("baseURL").get(function () {
  return `http://${this.host}:${this.port}`;
});

// Virtual for connection status display
gatewayDeviceSchema.virtual("connectionStatusDisplay").get(function () {
  if (this.lastConnectionStatus === "never_tested") {
    return "Never Tested";
  }
  return this.lastConnectionStatus === "success"
    ? "Connected"
    : "Connection Failed";
});

gatewayDeviceSchema.plugin(encryptFields, { fields: ["password"] });

module.exports = mongoose.model("GatewayDevice", gatewayDeviceSchema);
