const mongoose = require("mongoose");

const agentBonusSchema = new mongoose.Schema(
  {
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    // Bonus rates for each call type
    bonusRates: {
      firstCall: {
        type: Number,
        default: 0.0,
        min: 0,
      },
      secondCall: {
        type: Number,
        default: 0.0,
        min: 0,
      },
      thirdCall: {
        type: Number,
        default: 0.0,
        min: 0,
      },
      fourthCall: {
        type: Number,
        default: 0.0,
        min: 0,
      },
      fifthCall: {
        type: Number,
        default: 0.0,
        min: 0,
      },
      verifiedAcc: {
        type: Number,
        default: 0.0,
        min: 0,
      },
    },
    // Track when this configuration was last updated
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Additional metadata
    notes: {
      type: String,
      maxlength: 500,
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

// Index for efficient lookups
agentBonusSchema.index({ agent: 1 });
agentBonusSchema.index({ isActive: 1 });

// Virtual for total potential bonus per week (assuming one call per day)
agentBonusSchema.virtual("totalPotentialBonus").get(function () {
  const rates = this.bonusRates;
  return (
    rates.firstCall +
    rates.secondCall +
    rates.thirdCall +
    rates.fourthCall +
    rates.fifthCall +
    rates.verifiedAcc
  );
});

// Static method to get bonus configuration for an agent
agentBonusSchema.statics.getAgentBonusConfig = function (agentId) {
  return this.findOne({ agent: agentId, isActive: true })
    .populate("agent", "fullName email")
    .populate("lastUpdatedBy", "fullName email");
};

// Static method to get all active bonus configurations
agentBonusSchema.statics.getAllActiveBonusConfigs = function () {
  return this.find({ isActive: true })
    .populate("agent", "fullName email")
    .populate("lastUpdatedBy", "fullName email")
    .sort({ "agent.fullName": 1 });
};

// Static method to create default bonus configuration for new agents
agentBonusSchema.statics.createDefaultConfig = function (agentId, adminId) {
  return this.create({
    agent: agentId,
    lastUpdatedBy: adminId,
    notes: "Default bonus configuration created automatically",
  });
};

module.exports = mongoose.model("AgentBonus", agentBonusSchema);
