const mongoose = require("mongoose");
const encryptFields = require("./plugins/encryptFields");

const withdrawalSchema = new mongoose.Schema(
  {
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    usdtErc20Wallet: {
      type: String,
      required: false, // Made optional for backward compatibility with old withdrawals
      trim: true,
      validate: {
        validator: function (v) {
          // Skip validation if withdrawal is rejected or if it's an old withdrawal without these fields
          if (this.status === "rejected" || !v) {
            return true;
          }
          return v.trim().length > 0;
        },
        message: "USDT ERC20 wallet address must be valid if provided",
      },
    },
    usdtTrc20Wallet: {
      type: String,
      required: false, // Made optional for backward compatibility with old withdrawals
      trim: true,
      validate: {
        validator: function (v) {
          // Skip validation if withdrawal is rejected or if it's an old withdrawal without these fields
          if (this.status === "rejected" || !v) {
            return true;
          }
          return v.trim().length > 0;
        },
        message: "USDT TRC20 wallet address must be valid if provided",
      },
    },
    // Legacy fields for backward compatibility (old withdrawal structure)
    walletAddress: {
      type: String,
      trim: true,
    },
    walletAddresses: {
      type: [String],
    },
    // Month and year for which this withdrawal is requested
    withdrawalMonth: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
      default: () => new Date().getMonth() + 1,
    },
    withdrawalYear: {
      type: Number,
      required: true,
      default: () => new Date().getFullYear(),
    },
    breakdown: {
      basePay: {
        type: Number,
        required: true,
        default: 0,
      },
      bonuses: {
        type: Number,
        required: true,
        default: 0,
      },
      fines: {
        type: Number,
        required: true,
        default: 0,
      },
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "completed"],
      default: "pending",
    },
    adminNotes: {
      type: String,
      trim: true,
    },
    paymentLink: {
      type: String,
      trim: true,
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    processedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
withdrawalSchema.index({ agent: 1, createdAt: -1 });
withdrawalSchema.index({ status: 1, createdAt: -1 });

// Virtual for formatted amount
withdrawalSchema.virtual("formattedAmount").get(function () {
  return `$${this.amount.toFixed(2)}`;
});

// Static method to get agent withdrawals
withdrawalSchema.statics.getAgentWithdrawals = function (
  agentId,
  options = {}
) {
  const { status, limit = 10, page = 1, startDate, endDate } = options;

  let query = { agent: agentId };
  if (status) {
    query.status = status;
  }

  // Add date filtering
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) {
      query.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      query.createdAt.$lte = new Date(endDate);
    }
  }

  return this.find(query)
    .populate("agent", "fullName email")
    .populate("processedBy", "fullName email")
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip((page - 1) * limit);
};

// Static method to get agent withdrawals by month
withdrawalSchema.statics.getAgentWithdrawalsByMonth = function (
  agentId,
  year,
  month
) {
  return this.find({
    agent: agentId,
    withdrawalYear: year,
    withdrawalMonth: month,
  })
    .populate("agent", "fullName email")
    .populate("processedBy", "fullName email")
    .sort({ createdAt: -1 });
};

// Static method to get total completed withdrawals for a specific month
withdrawalSchema.statics.getCompletedWithdrawalsByMonth = function (
  agentId,
  year,
  month
) {
  return this.aggregate([
    {
      $match: {
        agent: new mongoose.Types.ObjectId(agentId),
        withdrawalYear: year,
        withdrawalMonth: month,
        status: { $in: ["completed", "approved"] },
      },
    },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
  ]);
};

// Static method to get all withdrawals for admin
withdrawalSchema.statics.getAllWithdrawals = function (options = {}) {
  const { status, limit = 50, page = 1, startDate, endDate } = options;

  let query = {};
  if (status) {
    query.status = status;
  }

  // Add date filtering
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) {
      query.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      query.createdAt.$lte = new Date(endDate);
    }
  }

  return this.find(query)
    .populate("agent", "fullName email fourDigitCode")
    .populate("processedBy", "fullName email")
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip((page - 1) * limit);
};

// Static method to get withdrawal statistics
withdrawalSchema.statics.getWithdrawalStats = function (options = {}) {
  const { startDate, endDate } = options;

  let matchQuery = {};

  // Add date filtering
  if (startDate || endDate) {
    matchQuery.createdAt = {};
    if (startDate) {
      matchQuery.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      matchQuery.createdAt.$lte = new Date(endDate);
    }
  }

  const pipeline = [];

  // Add match stage only if there are filters
  if (Object.keys(matchQuery).length > 0) {
    pipeline.push({ $match: matchQuery });
  }

  // Add grouping stage
  pipeline.push({
    $group: {
      _id: "$status",
      count: { $sum: 1 },
      totalAmount: { $sum: "$amount" },
    },
  });

  return this.aggregate(pipeline);
};

// Instance method to process withdrawal
withdrawalSchema.methods.processWithdrawal = function (
  status,
  processedBy,
  adminNotes = "",
  paymentLink = ""
) {
  this.status = status;
  this.processedBy = processedBy;
  this.processedAt = new Date();
  this.adminNotes = adminNotes;
  if (paymentLink) {
    this.paymentLink = paymentLink;
  }
  return this.save();
};

withdrawalSchema.plugin(encryptFields, {
  fields: [
    "usdtErc20Wallet",
    "usdtTrc20Wallet",
    "walletAddress",
    "walletAddresses",
  ],
});

module.exports = mongoose.model("Withdrawal", withdrawalSchema);
