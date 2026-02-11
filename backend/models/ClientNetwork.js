const mongoose = require("mongoose");

// Employee sub-schema
const employeeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Employee name is required"],
      trim: true,
    },
    telegramUsername: {
      type: String,
      trim: true,
    },
    position: {
      type: String,
      enum: ["finance", "boss", "manager", "affiliate_manager", "tech_support"],
      required: [true, "Employee position is required"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

// Reference sub-schema
const referenceSchema = new mongoose.Schema(
  {
    clientNetwork: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClientNetwork",
      required: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const clientNetworkSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Client network name is required"],
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    dealType: {
      type: String,
      enum: ["buy", "sell", "both", null],
      default: null,
    },
    employees: [employeeSchema],
    references: [referenceSchema],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);
clientNetworkSchema.index({ name: 1 });
clientNetworkSchema.index({ createdBy: 1 });
clientNetworkSchema.index({ isActive: 1 });
// Text index for global search
clientNetworkSchema.index(
  { name: "text", description: "text" },
  { weights: { name: 10, description: 5 }, name: "client_network_search_index" }
);
clientNetworkSchema.virtual("assignedManagersCount").get(function () {
  return 0;
});
clientNetworkSchema.virtual("activeBrokersCount").get(function () {
  return 0;
});
module.exports = mongoose.model("ClientNetwork", clientNetworkSchema);
