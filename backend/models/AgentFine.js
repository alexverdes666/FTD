const mongoose = require("mongoose");

const agentFineSchema = new mongoose.Schema(
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
    reason: {
      type: String,
      required: true,
      maxlength: 500,
    },
    description: {
      type: String,
      maxlength: 1000,
    },
    // Admin who imposed the fine
    imposedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Status of the fine - approval workflow
    status: {
      type: String,
      enum: ["pending_approval", "approved", "disputed", "admin_approved", "admin_rejected", "paid", "waived"],
      default: "pending_approval",
    },
    // Images attached to fine (evidence)
    images: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "FineImage"
    }],
    // Agent response to the fine
    agentResponse: {
      action: {
        type: String,
        enum: ["approved", "disputed"]
      },
      disputeReason: {
        type: String,
        maxlength: 1000
      },
      description: {
        type: String,
        maxlength: 2000
      },
      images: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "FineImage"
      }],
      respondedAt: Date
    },
    // Admin decision for disputed fines
    adminDecision: {
      action: {
        type: String,
        enum: ["approved", "rejected"]
      },
      notes: {
        type: String,
        maxlength: 1000
      },
      decidedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      decidedAt: Date
    },
    // Date when the fine was imposed
    imposedDate: {
      type: Date,
      default: Date.now,
    },
    // Month and year for which this fine applies (like monthly call bonuses)
    fineMonth: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
      default: () => new Date().getMonth() + 1
    },
    fineYear: {
      type: Number,
      required: true,
      default: () => new Date().getFullYear()
    },
    // Date when the fine was resolved (paid/waived)
    resolvedDate: {
      type: Date,
    },
    // Admin who resolved the fine
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // Additional notes
    notes: {
      type: String,
      maxlength: 500,
    },
    // Reference to related lead (when fine is applied for a specific lead)
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
    },
    // Reference to related order (when fine is applied from an order context)
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },
    // Whether the agent has acknowledged/dismissed the fine notification popup
    acknowledgedByAgent: {
      type: Boolean,
      default: false,
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
agentFineSchema.index({ agent: 1 });
agentFineSchema.index({ status: 1 });
agentFineSchema.index({ imposedDate: -1 });
agentFineSchema.index({ agent: 1, status: 1 });
agentFineSchema.index({ agent: 1, fineYear: 1, fineMonth: 1 });
agentFineSchema.index({ fineYear: 1, fineMonth: 1 });
agentFineSchema.index({ lead: 1 });
agentFineSchema.index({ agent: 1, acknowledgedByAgent: 1, isActive: 1 });

// Virtual for fine age in days
agentFineSchema.virtual("ageInDays").get(function () {
  const now = new Date();
  const diffTime = Math.abs(now - this.imposedDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Static method to get all fines for an agent
agentFineSchema.statics.getAgentFines = function (
  agentId,
  includeResolved = false,
  year = null,
  month = null
) {
  const query = { agent: agentId, isActive: true };
  if (!includeResolved) {
    // Active fines are those that are approved or admin_approved and not yet paid/waived
    query.status = { $in: ["pending_approval", "approved", "disputed", "admin_approved"] };
  }
  
  // Add month/year filtering if provided
  if (year) {
    query.fineYear = year;
  }
  if (month) {
    query.fineMonth = month;
  }

  return this.find(query)
    .populate("agent", "fullName email")
    .populate("imposedBy", "fullName email")
    .populate("resolvedBy", "fullName email")
    .populate("images")
    .populate("agentResponse.images")
    .populate("adminDecision.decidedBy", "fullName email")
    .populate("lead", "firstName lastName email phone")
    .populate("orderId", "_id createdAt")
    .sort({ imposedDate: -1 });
};

// Static method to get all active fines
agentFineSchema.statics.getAllActiveFines = function () {
  return this.find({ isActive: true })
    .populate("agent", "fullName email")
    .populate("imposedBy", "fullName email")
    .populate("resolvedBy", "fullName email")
    .populate("images")
    .populate("agentResponse.images")
    .populate("adminDecision.decidedBy", "fullName email")
    .populate("lead", "firstName lastName email phone")
    .populate("orderId", "_id createdAt")
    .sort({ imposedDate: -1 });
};

// Static method to get total active fines for an agent (fines that count toward deduction)
agentFineSchema.statics.getTotalActiveFines = function (agentId, year = null, month = null) {
  const matchQuery = {
    agent: new mongoose.Types.ObjectId(agentId),
    // Only approved or admin_approved fines count as active
    status: { $in: ["approved", "admin_approved"] },
    isActive: true,
  };
  
  // Add month/year filtering if provided
  if (year) {
    matchQuery.fineYear = year;
  }
  if (month) {
    matchQuery.fineMonth = month;
  }
  
  return this.aggregate([
    { $match: matchQuery },
    { $group: { _id: null, totalFines: { $sum: "$amount" } } },
  ]);
};

// Static method to get fines summary for all agents
agentFineSchema.statics.getFinesSummary = function () {
  return this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: "$agent",
        totalFines: { $sum: "$amount" },
        // Active fines are those approved or admin_approved (that count toward deduction)
        activeFines: {
          $sum: { $cond: [{ $in: ["$status", ["approved", "admin_approved"]] }, "$amount", 0] },
        },
        fineCount: { $sum: 1 },
        activeFineCount: {
          $sum: { $cond: [{ $in: ["$status", ["approved", "admin_approved"]] }, 1, 0] },
        },
        pendingApprovalCount: {
          $sum: { $cond: [{ $eq: ["$status", "pending_approval"] }, 1, 0] },
        },
        disputedCount: {
          $sum: { $cond: [{ $eq: ["$status", "disputed"] }, 1, 0] },
        },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "agent",
      },
    },
    { $unwind: "$agent" },
    { $sort: { "agent.fullName": 1 } },
  ]);
};

// Static method to get monthly fines for an agent (similar to monthly call bonuses)
agentFineSchema.statics.getMonthlyFines = function (agentId, year, month) {
  return this.find({
    agent: agentId,
    fineYear: year,
    fineMonth: month,
    // Include approved and admin_approved fines for monthly totals
    status: { $in: ["approved", "admin_approved"] },
    isActive: true,
  })
    .populate("agent", "fullName email")
    .populate("imposedBy", "fullName email")
    .populate("resolvedBy", "fullName email")
    .populate("images")
    .populate("agentResponse.images")
    .populate("lead", "firstName lastName email phone")
    .populate("orderId", "_id createdAt")
    .sort({ imposedDate: -1 });
};

// Static method to get total monthly fines amount for an agent
agentFineSchema.statics.getTotalMonthlyFines = function (agentId, year, month) {
  return this.aggregate([
    {
      $match: {
        agent: new mongoose.Types.ObjectId(agentId),
        fineYear: year,
        fineMonth: month,
        // Only approved and admin_approved count toward deductions
        status: { $in: ["approved", "admin_approved"] },
        isActive: true,
      },
    },
    { $group: { _id: null, totalFines: { $sum: "$amount" } } },
  ]);
};

// Static method to get fines pending agent approval
agentFineSchema.statics.getPendingApprovalFines = function (agentId = null) {
  const query = {
    status: "pending_approval",
    isActive: true,
  };
  if (agentId) {
    query.agent = agentId;
  }
  return this.find(query)
    .populate("agent", "fullName email")
    .populate("imposedBy", "fullName email")
    .populate("images")
    .populate("agentResponse.images")
    .populate("lead", "firstName lastName email phone")
    .populate("orderId", "_id createdAt")
    .sort({ imposedDate: -1 });
};

// Static method to get disputed fines for admin review
agentFineSchema.statics.getDisputedFines = function () {
  return this.find({
    status: "disputed",
    isActive: true,
  })
    .populate("agent", "fullName email")
    .populate("imposedBy", "fullName email")
    .populate("images")
    .populate("agentResponse.images")
    .populate("lead", "firstName lastName email phone")
    .populate("orderId", "_id createdAt")
    .sort({ imposedDate: -1 });
};

// Static method to get fines by lead ID
agentFineSchema.statics.getFinesByLeadId = function (leadId) {
  return this.find({
    lead: leadId,
    isActive: true,
  })
    .populate("agent", "fullName email")
    .populate("imposedBy", "fullName email")
    .populate("images")
    .populate("agentResponse.images")
    .populate("adminDecision.decidedBy", "fullName email")
    .populate("lead", "firstName lastName email phone")
    .populate("orderId", "_id createdAt")
    .sort({ imposedDate: -1 });
};

// Instance method to resolve a fine
agentFineSchema.methods.resolve = function (status, resolvedBy, notes) {
  this.status = status;
  this.resolvedDate = new Date();
  this.resolvedBy = resolvedBy;
  if (notes) {
    this.notes = notes;
  }
  return this.save();
};

module.exports = mongoose.model("AgentFine", agentFineSchema);
