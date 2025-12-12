const mongoose = require("mongoose");

const agentCallCountsSchema = new mongoose.Schema(
  {
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Month and year for which these call counts apply
    year: {
      type: Number,
      required: true,
      default: () => new Date().getFullYear()
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
      default: () => new Date().getMonth() + 1
    },
    // Call counts that affiliate managers can input
    callCounts: {
      firstCalls: {
        type: Number,
        default: 0,
        min: 0,
      },
      secondCalls: {
        type: Number,
        default: 0,
        min: 0,
      },
      thirdCalls: {
        type: Number,
        default: 0,
        min: 0,
      },
      fourthCalls: {
        type: Number,
        default: 0,
        min: 0,
      },
      fifthCalls: {
        type: Number,
        default: 0,
        min: 0,
      },
      verifiedAccounts: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    // Fixed monthly bonus rates per call type (admin-configured)
    bonusRates: {
      firstCall: {
        type: Number,
        default: 5.0, // $5 monthly bonus per first call
        min: 0,
      },
      secondCall: {
        type: Number,
        default: 10.0, // $10 monthly bonus per second call
        min: 0,
      },
      thirdCall: {
        type: Number,
        default: 15.0, // $15 monthly bonus per third call
        min: 0,
      },
      fourthCall: {
        type: Number,
        default: 20.0, // $20 monthly bonus per fourth call
        min: 0,
      },
      fifthCall: {
        type: Number,
        default: 25.0, // $25 monthly bonus per fifth call
        min: 0,
      },
      verifiedAcc: {
        type: Number,
        default: 50.0, // $50 monthly bonus per verified account
        min: 0,
      },
    },
    // Who added/updated these call counts
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Additional notes
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

// Compound index to ensure one record per agent per month
agentCallCountsSchema.index({ agent: 1, year: 1, month: 1 }, { unique: true });
agentCallCountsSchema.index({ addedBy: 1 });
agentCallCountsSchema.index({ isActive: 1 });

// Virtual for calculated bonus amounts
agentCallCountsSchema.virtual("calculatedBonuses").get(function () {
  return {
    firstCallBonus: this.callCounts.firstCalls * this.bonusRates.firstCall,
    secondCallBonus: this.callCounts.secondCalls * this.bonusRates.secondCall,
    thirdCallBonus: this.callCounts.thirdCalls * this.bonusRates.thirdCall,
    fourthCallBonus: this.callCounts.fourthCalls * this.bonusRates.fourthCall,
    fifthCallBonus: this.callCounts.fifthCalls * this.bonusRates.fifthCall,
    verifiedAccBonus: this.callCounts.verifiedAccounts * this.bonusRates.verifiedAcc,
  };
});

// Virtual for total bonus amount
agentCallCountsSchema.virtual("totalBonus").get(function () {
  const bonuses = this.calculatedBonuses;
  return Object.values(bonuses).reduce((sum, bonus) => sum + bonus, 0);
});

// Virtual for total call count
agentCallCountsSchema.virtual("totalCalls").get(function () {
  const counts = this.callCounts;
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
});

// Static method to get call counts for an agent for a specific month
agentCallCountsSchema.statics.getAgentCallCounts = function (agentId, year = new Date().getFullYear(), month = new Date().getMonth() + 1) {
  return this.findOne({ 
    agent: agentId, 
    year: year,
    month: month,
    isActive: true 
  })
    .populate("agent", "fullName email fourDigitCode")
    .populate("addedBy", "fullName email");
};

// Static method to get all call counts for a year range
agentCallCountsSchema.statics.getCallCountsInRange = function (agentId, startYear, endYear) {
  return this.find({
    agent: agentId,
    year: { $gte: startYear, $lte: endYear },
    isActive: true
  })
    .populate("agent", "fullName email fourDigitCode")
    .populate("addedBy", "fullName email")
    .sort({ year: -1, month: -1 });
};

// Static method to get all agents with their call counts for a specific month
agentCallCountsSchema.statics.getAllAgentsWithCallCounts = function (year = new Date().getFullYear(), month = new Date().getMonth() + 1) {
  return this.find({ 
    year: year,
    month: month,
    isActive: true 
  })
    .populate("agent", "fullName email fourDigitCode")
    .populate("addedBy", "fullName email")
    .sort({ "agent.fullName": 1 });
};

// Static method to update or create monthly call counts
agentCallCountsSchema.statics.updateCallCounts = async function (agentId, callCounts, addedBy, year = new Date().getFullYear(), month = new Date().getMonth() + 1, notes = "") {
  // Get global bonus rates from SystemConfiguration
  const SystemConfiguration = require('./SystemConfiguration');
  let bonusRates = {
    firstCall: 5.0,
    secondCall: 10.0,
    thirdCall: 15.0,
    fourthCall: 20.0,
    fifthCall: 25.0,
    verifiedAcc: 50.0,
  };
  
  try {
    const globalConfig = await SystemConfiguration.getGlobalBonusRates();
    if (globalConfig && globalConfig.bonusRates) {
      bonusRates = globalConfig.bonusRates;
    }
  } catch (error) {
    console.warn("Failed to load global bonus rates, using defaults:", error);
  }
  
  return this.findOneAndUpdate(
    { agent: agentId, year: year, month: month },
    {
      callCounts,
      addedBy,
      notes,
      bonusRates, // Use global bonus rates
      isActive: true,
    },
    { 
      upsert: true, 
      new: true,
      runValidators: true
    }
  ).populate("agent", "fullName email fourDigitCode")
   .populate("addedBy", "fullName email");
};

// Static method to get summary statistics for a year range
agentCallCountsSchema.statics.getCallCountsStats = function (startYear = new Date().getFullYear(), endYear = new Date().getFullYear()) {
  return this.aggregate([
    {
      $match: {
        year: { $gte: startYear, $lte: endYear },
        isActive: true
      }
    },
    {
      $group: {
        _id: null,
        totalAgents: { $addToSet: "$agent" },
        totalFirstCalls: { $sum: "$callCounts.firstCalls" },
        totalSecondCalls: { $sum: "$callCounts.secondCalls" },
        totalThirdCalls: { $sum: "$callCounts.thirdCalls" },
        totalFourthCalls: { $sum: "$callCounts.fourthCalls" },
        totalFifthCalls: { $sum: "$callCounts.fifthCalls" },
        totalVerifiedAccounts: { $sum: "$callCounts.verifiedAccounts" },
        totalRecords: { $sum: 1 }
      }
    },
    {
      $project: {
        totalAgents: { $size: "$totalAgents" },
        totalFirstCalls: 1,
        totalSecondCalls: 1,
        totalThirdCalls: 1,
        totalFourthCalls: 1,
        totalFifthCalls: 1,
        totalVerifiedAccounts: 1,
        totalRecords: 1,
        totalCalls: {
          $add: [
            "$totalFirstCalls",
            "$totalSecondCalls", 
            "$totalThirdCalls",
            "$totalFourthCalls",
            "$totalFifthCalls",
            "$totalVerifiedAccounts"
          ]
        }
      }
    }
  ]);
};

module.exports = mongoose.model("AgentCallCounts", agentCallCountsSchema); 