const mongoose = require("mongoose");

const agentCallDeclarationSchema = new mongoose.Schema(
  {
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Unique identifier for deduplication: "calldate_src_dst"
    cdrCallId: {
      type: String,
      required: true,
      unique: true,
    },
    callDate: {
      type: Date,
      required: true,
    },
    // Duration in seconds, minimum 900 (15 minutes)
    callDuration: {
      type: Number,
      required: true,
      min: 900,
    },
    sourceNumber: {
      type: String,
      required: true,
    },
    destinationNumber: {
      type: String,
      required: true,
    },
    callType: {
      type: String,
      enum: ["deposit", "first_call", "second_call", "third_call", "fourth_call"],
      required: true,
    },
    description: {
      type: String,
      maxlength: 1000,
    },
    // Base bonus based on call type
    baseBonus: {
      type: Number,
      required: true,
      min: 0,
    },
    // Extra bonus for calls > 1 hour ($10/hour for each additional hour)
    hourlyBonus: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Total bonus = baseBonus + hourlyBonus
    totalBonus: {
      type: Number,
      required: true,
      min: 0,
    },
    // Simpler status than fines
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    // Manager who reviewed the declaration
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: {
      type: Date,
    },
    reviewNotes: {
      type: String,
      maxlength: 1000,
    },
    // Month and year for payroll tracking
    declarationMonth: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    declarationYear: {
      type: Number,
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

// Indexes for efficient queries
agentCallDeclarationSchema.index({ agent: 1 });
agentCallDeclarationSchema.index({ status: 1 });
agentCallDeclarationSchema.index({ callDate: -1 });
agentCallDeclarationSchema.index({ agent: 1, status: 1 });
agentCallDeclarationSchema.index({ agent: 1, declarationYear: 1, declarationMonth: 1 });
agentCallDeclarationSchema.index({ declarationYear: 1, declarationMonth: 1 });
agentCallDeclarationSchema.index({ cdrCallId: 1 }, { unique: true });

// Virtual for formatted call duration
agentCallDeclarationSchema.virtual("formattedDuration").get(function () {
  const hours = Math.floor(this.callDuration / 3600);
  const minutes = Math.floor((this.callDuration % 3600) / 60);
  const seconds = this.callDuration % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
});

// Virtual for call type display name
agentCallDeclarationSchema.virtual("callTypeDisplay").get(function () {
  const displayNames = {
    deposit: "Deposit Call",
    first_call: "First Call",
    second_call: "Second Call",
    third_call: "3rd Call",
    fourth_call: "4th Call",
  };
  return displayNames[this.callType] || this.callType;
});

// Static method to get all declarations for an agent
agentCallDeclarationSchema.statics.getAgentDeclarations = function (
  agentId,
  year = null,
  month = null,
  status = null
) {
  const query = { agent: agentId, isActive: true };

  if (year) {
    query.declarationYear = year;
  }
  if (month) {
    query.declarationMonth = month;
  }
  if (status) {
    query.status = status;
  }

  return this.find(query)
    .populate("agent", "fullName email fourDigitCode")
    .populate("reviewedBy", "fullName email")
    .sort({ callDate: -1 });
};

// Static method to get all pending declarations (for manager approval)
agentCallDeclarationSchema.statics.getPendingDeclarations = function () {
  return this.find({
    status: "pending",
    isActive: true,
  })
    .populate("agent", "fullName email fourDigitCode")
    .sort({ createdAt: -1 });
};

// Static method to get monthly totals for an agent (approved only)
agentCallDeclarationSchema.statics.getMonthlyTotals = function (agentId, year, month) {
  return this.aggregate([
    {
      $match: {
        agent: new mongoose.Types.ObjectId(agentId),
        declarationYear: year,
        declarationMonth: month,
        status: "approved",
        isActive: true,
      },
    },
    {
      $group: {
        _id: null,
        totalBaseBonus: { $sum: "$baseBonus" },
        totalHourlyBonus: { $sum: "$hourlyBonus" },
        totalBonus: { $sum: "$totalBonus" },
        declarationCount: { $sum: 1 },
        totalDuration: { $sum: "$callDuration" },
      },
    },
  ]);
};

// Static method to get all approved declarations for an agent in a month
agentCallDeclarationSchema.statics.getApprovedMonthlyDeclarations = function (agentId, year, month) {
  return this.find({
    agent: agentId,
    declarationYear: year,
    declarationMonth: month,
    status: "approved",
    isActive: true,
  })
    .populate("agent", "fullName email fourDigitCode")
    .populate("reviewedBy", "fullName email")
    .sort({ callDate: -1 });
};

// Static method to check if a CDR call has already been declared
agentCallDeclarationSchema.statics.isCallDeclared = async function (cdrCallId) {
  const existing = await this.findOne({ cdrCallId, isActive: true });
  return !!existing;
};

// Static method to get summary by call type for an agent
agentCallDeclarationSchema.statics.getCallTypeSummary = function (agentId, year, month) {
  return this.aggregate([
    {
      $match: {
        agent: new mongoose.Types.ObjectId(agentId),
        declarationYear: year,
        declarationMonth: month,
        status: "approved",
        isActive: true,
      },
    },
    {
      $group: {
        _id: "$callType",
        count: { $sum: 1 },
        totalBonus: { $sum: "$totalBonus" },
        totalDuration: { $sum: "$callDuration" },
      },
    },
    {
      $sort: { totalBonus: -1 },
    },
  ]);
};

// Instance method to approve declaration
agentCallDeclarationSchema.methods.approve = function (reviewerId, notes) {
  this.status = "approved";
  this.reviewedBy = reviewerId;
  this.reviewedAt = new Date();
  if (notes) {
    this.reviewNotes = notes;
  }
  return this.save();
};

// Instance method to reject declaration
agentCallDeclarationSchema.methods.reject = function (reviewerId, notes) {
  this.status = "rejected";
  this.reviewedBy = reviewerId;
  this.reviewedAt = new Date();
  this.reviewNotes = notes;
  return this.save();
};

module.exports = mongoose.model("AgentCallDeclaration", agentCallDeclarationSchema);
