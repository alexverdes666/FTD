const mongoose = require("mongoose");

/**
 * CardIssuer model for grouping PSPs by card issuer (e.g., Visa, Mastercard, Zen)
 * Multiple PSPs can belong to the same Card Issuer
 */
const cardIssuerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Card Issuer name is required"],
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
    },
    logo: {
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
cardIssuerSchema.index({ name: 1 });
cardIssuerSchema.index({ createdBy: 1 });
cardIssuerSchema.index({ isActive: 1 });

// Text index for global search
cardIssuerSchema.index(
  { name: "text", description: "text" },
  { weights: { name: 10, description: 5 }, name: "card_issuer_search_index" }
);

// Virtual for counting linked PSPs
cardIssuerSchema.virtual("linkedPSPsCount", {
  ref: "PSP",
  localField: "_id",
  foreignField: "cardIssuer",
  count: true,
});

module.exports = mongoose.model("CardIssuer", cardIssuerSchema);
