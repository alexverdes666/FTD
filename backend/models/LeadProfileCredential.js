const mongoose = require("mongoose");
const encryptFields = require("./plugins/encryptFields");

const leadProfileCredentialSchema = new mongoose.Schema(
  {
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: [true, "Lead reference is required"],
      index: true,
    },
    accountType: {
      type: String,
      required: [true, "Account type is required"],
      trim: true,
    },
    username: {
      type: String,
      trim: true,
    },
    password: {
      type: String,
    },
    twoFactorSecret: {
      type: String,
    },
    recoveryCodes: {
      type: [String],
      default: [],
    },
    notes: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

leadProfileCredentialSchema.index({ lead: 1, accountType: 1 });

leadProfileCredentialSchema.plugin(encryptFields, {
  fields: ["password", "twoFactorSecret", "recoveryCodes"],
});

module.exports = mongoose.model(
  "LeadProfileCredential",
  leadProfileCredentialSchema
);
