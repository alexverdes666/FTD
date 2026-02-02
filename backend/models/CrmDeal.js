const mongoose = require("mongoose");

const crmDealSchema = new mongoose.Schema(
  {
    clientNetwork: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClientNetwork",
      required: [true, "Client network is required"],
    },
    date: {
      type: Date,
      required: [true, "Deal date is required"],
    },
    ourNetwork: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OurNetwork",
      required: [true, "Our network is required"],
    },
    affiliateManager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Affiliate manager is required"],
    },
    totalSentLeads: {
      type: Number,
      default: 0,
      min: [0, "Total sent leads cannot be negative"],
    },
    firedFtds: {
      type: Number,
      default: 0,
      min: [0, "Fired FTDs cannot be negative"],
    },
    shavedFtds: {
      type: Number,
      default: 0,
      min: [0, "Shaved FTDs cannot be negative"],
    },
    totalPaid: {
      type: Number,
      default: 0,
      min: [0, "Total paid cannot be negative"],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
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

crmDealSchema.index({ clientNetwork: 1, date: -1 });
crmDealSchema.index({ ourNetwork: 1, date: -1 });
crmDealSchema.index({ affiliateManager: 1, date: -1 });
crmDealSchema.index({ date: -1 });
crmDealSchema.index({ createdBy: 1 });

module.exports = mongoose.model("CrmDeal", crmDealSchema);
