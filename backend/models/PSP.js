const mongoose = require("mongoose");

const pspSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "PSP name is required"],
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
    },
    website: {
      type: String,
      required: [true, "Website URL is required"],
      trim: true,
    },
    // Card preview fields
    cardNumber: {
      type: String,
      trim: true,
    },
    cardExpiry: {
      type: String,
      trim: true,
    },
    cardCVC: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
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

// Indexes
pspSchema.index({ name: 1 });
pspSchema.index({ createdBy: 1 });
pspSchema.index({ isActive: 1 });

// Text index for global search
pspSchema.index(
  { name: "text", description: "text" },
  { weights: { name: 10, description: 5 }, name: "psp_search_index" }
);

// Virtual for counting linked brokers
pspSchema.virtual("linkedBrokersCount", {
  ref: "ClientBroker",
  localField: "_id",
  foreignField: "psps",
  count: true,
});

module.exports = mongoose.model("PSP", pspSchema);
