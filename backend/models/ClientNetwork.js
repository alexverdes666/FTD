const mongoose = require("mongoose");
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
