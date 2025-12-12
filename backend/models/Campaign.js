const mongoose = require("mongoose");
const campaignSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Campaign name is required"],
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["active", "paused", "completed", "draft"],
      default: "active",
    },
    budget: {
      amount: {
        type: Number,
        min: 0,
      },
      currency: {
        type: String,
        default: "USD",
      },
    },
    dateRange: {
      startDate: {
        type: Date,
      },
      endDate: {
        type: Date,
      },
    },
    targetAudience: {
      countries: [String],
      genders: [
        {
          type: String,
          enum: ["male", "female", "not_defined"],
        },
      ],
      ageRange: {
        min: Number,
        max: Number,
      },
    },
    assignedAffiliateManagers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    metrics: {
      totalLeads: {
        type: Number,
        default: 0,
      },
      totalOrders: {
        type: Number,
        default: 0,
      },
      conversionRate: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);
campaignSchema.index({ name: 1 });
campaignSchema.index({ status: 1 });
campaignSchema.index({ assignedAffiliateManagers: 1 });
campaignSchema.index({ createdBy: 1 });
campaignSchema.index({ isActive: 1 });
campaignSchema.index({ "dateRange.startDate": 1, "dateRange.endDate": 1 });
campaignSchema.virtual("assignedManagersCount").get(function () {
  return this.assignedAffiliateManagers
    ? this.assignedAffiliateManagers.length
    : 0;
});
campaignSchema.methods.isCurrentlyActive = function () {
  if (!this.isActive || this.status !== "active") {
    return false;
  }
  const now = new Date();
  const startDate = this.dateRange?.startDate;
  const endDate = this.dateRange?.endDate;
  if (startDate && now < startDate) {
    return false;
  }
  if (endDate && now > endDate) {
    return false;
  }
  return true;
};
campaignSchema.methods.updateMetrics = async function () {
  const Lead = require("./Lead");
  const Order = require("./Order");
  try {
    const totalLeads = await Lead.countDocuments({
      "campaignHistory.campaign": this._id,
    });
    const totalOrders = await Order.countDocuments({
      selectedCampaign: this._id,
    });
    const conversionRate =
      totalLeads > 0 ? (totalOrders / totalLeads) * 100 : 0;
    this.metrics = {
      totalLeads,
      totalOrders,
      conversionRate: Math.round(conversionRate * 100) / 100,
    };
    await this.save();
  } catch (error) {
    console.error("Error updating campaign metrics:", error);
  }
};
module.exports = mongoose.model("Campaign", campaignSchema);