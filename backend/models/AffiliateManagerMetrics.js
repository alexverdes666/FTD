const mongoose = require("mongoose");

// --- Sub-schemas for better reusability and clarity ---

// Reusable schema for breakdown items to keep the code DRY.
const breakdownItemSchema = new mongoose.Schema(
  {
    networkId: { type: mongoose.Schema.Types.ObjectId, ref: "OurNetwork" },
    networkName: String, // Denormalized for read performance
    performance: Number,
    utilization: Number,
    revenue: Number,
  },
  { _id: false }
); // Disable _id for subdocuments to save space

const campaignBreakdownItemSchema = new mongoose.Schema(
  {
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign" },
    campaignName: String, // Denormalized for read performance
    success: Number,
    roi: Number,
    revenue: Number,
  },
  { _id: false }
); // Disable _id for subdocuments to save space

const affiliateManagerMetricsSchema = new mongoose.Schema(
  {
    affiliateManager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    period: {
      type: String,
      enum: ["daily", "weekly", "monthly"],
      default: "monthly",
      required: true,
    },
    // Revenue metrics
    revenueFromOrders: {
      type: Number,
      default: 0,
      min: 0,
    },
    revenueFromLeads: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Order metrics
    ordersCompleted: {
      type: Number,
      default: 0,
      min: 0,
    },
    ordersCreated: {
      type: Number,
      default: 0,
      min: 0,
    },
    averageOrderValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Lead metrics
    leadsManaged: {
      type: Number,
      default: 0,
      min: 0,
    },
    leadsConverted: {
      type: Number,
      default: 0,
      min: 0,
    },
    conversionRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
    },
    // Network performance
    networkPerformance: {
      type: Number,
      default: 0,
      min: 0,
    },
    networksManaged: {
      type: Number,
      default: 0,
      min: 0,
    },
    networkUtilization: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
    },
    // Campaign metrics
    campaignSuccess: {
      type: Number,
      default: 0,
      min: 0,
    },
    campaignsManaged: {
      type: Number,
      default: 0,
      min: 0,
    },
    campaignROI: {
      type: Number,
      default: 0,
    },
    // Client broker assignments
    brokersAssigned: {
      type: Number,
      default: 0,
      min: 0,
    },
    brokerAssignmentSuccess: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
    },
    // Quality metrics
    qualityScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    clientSatisfaction: {
      type: Number,
      default: 0,
      min: 0,
      max: 10,
    },
    // Detailed breakdown
    breakdown: {
      ordersBreakdown: {
        type: {
          ftd: { type: Number, default: 0 },
          filler: { type: Number, default: 0 },
          cold: { type: Number, default: 0 },
          live: { type: Number, default: 0 },
        },
        _id: false, // Disable _id for this subdocument
      },
      // Using the reusable sub-schema
      networkBreakdown: [breakdownItemSchema],
      campaignBreakdown: [campaignBreakdownItemSchema],
    },
    // Metadata
    calculatedAt: {
      type: Date,
      default: Date.now,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    verifiedAt: {
      type: Date,
    },
    notes: {
      type: String,
      maxlength: 500,
      trim: true, // Automatically remove whitespace from start/end
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// --- Virtual Properties ---

// Optimization: Calculate totalRevenue dynamically instead of storing it.
// This saves storage space and prevents data inconsistency.
affiliateManagerMetricsSchema.virtual("totalRevenue").get(function () {
  return (this.revenueFromOrders || 0) + (this.revenueFromLeads || 0);
});

// --- Indexing Strategy ---

// Most critical index for ensuring data integrity and fast lookups for a specific manager and date.
affiliateManagerMetricsSchema.index(
  { affiliateManager: 1, date: -1, period: 1 },
  { unique: true }
);

// Optimized index for the `getTopPerformers` static method.
// Sorts by date, then revenue, allowing MongoDB to perform the sort very efficiently using the index.
affiliateManagerMetricsSchema.index({ date: 1, totalRevenue: -1 });

// Index for common filtering by period.
affiliateManagerMetricsSchema.index({ period: 1 });

// Sparse index for finding verified documents efficiently.
// It only indexes documents where `verifiedBy` exists.
affiliateManagerMetricsSchema.index({ verifiedBy: 1 }, { sparse: true });

// --- Static Methods ---

affiliateManagerMetricsSchema.statics.getAggregatedMetrics = function (
  affiliateManagerId,
  startDate,
  endDate
) {
  const matchStage = {
    affiliateManager: new mongoose.Types.ObjectId(affiliateManagerId),
  };

  if (startDate && endDate) {
    matchStage.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: "$affiliateManager", // Group by manager instead of null for clarity
        totalRevenue: {
          $sum: { $add: ["$revenueFromOrders", "$revenueFromLeads"] },
        }, // Calculate sum based on source fields
        totalOrdersCompleted: { $sum: "$ordersCompleted" },
        totalOrdersCreated: { $sum: "$ordersCreated" },
        totalLeadsManaged: { $sum: "$leadsManaged" },
        totalLeadsConverted: { $sum: "$leadsConverted" },
        avgConversionRate: { $avg: "$conversionRate" },
        avgNetworkPerformance: { $avg: "$networkPerformance" },
        avgCampaignSuccess: { $avg: "$campaignSuccess" },
        avgQualityScore: { $avg: "$qualityScore" },
        avgClientSatisfaction: { $avg: "$clientSatisfaction" },
        periodsCount: { $sum: 1 },
      },
    },
  ]);
};

affiliateManagerMetricsSchema.statics.getTopPerformers = function (
  startDate,
  endDate,
  limit = 10
) {
  const matchStage = {};

  if (startDate && endDate) {
    matchStage.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  return this.aggregate([
    { $match: matchStage },
    {
      // Group and calculate initial metrics
      $group: {
        _id: "$affiliateManager",
        totalRevenue: {
          $sum: { $add: ["$revenueFromOrders", "$revenueFromLeads"] },
        }, // Calculate sum based on source fields
        totalOrdersCompleted: { $sum: "$ordersCompleted" },
        avgConversionRate: { $avg: "$conversionRate" },
        avgNetworkPerformance: { $avg: "$networkPerformance" },
        avgCampaignSuccess: { $avg: "$campaignSuccess" },
        avgQualityScore: { $avg: "$qualityScore" },
      },
    },
    // Sort by the aggregated revenue. This can be optimized by the { date: 1, totalRevenue: -1 } index
    { $sort: { totalRevenue: -1 } },
    { $limit: limit },
    // Join with users collection to get manager details
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "managerInfo",
      },
    },
    // Unwind the managerInfo array (lookup always returns an array)
    {
      $unwind: {
        path: "$managerInfo",
        preserveNullAndEmptyArrays: true, // Keep results even if manager is not found in users collection
      },
    },
    // Optimization: Reshape the output to be cleaner and more predictable
    {
      $project: {
        _id: 0, // Exclude the default _id
        managerId: "$_id",
        managerName: "$managerInfo.name", // Assuming user schema has a 'name' field
        managerEmail: "$managerInfo.email", // Assuming user schema has an 'email' field
        totalRevenue: 1,
        totalOrdersCompleted: 1,
        avgConversionRate: 1,
        avgNetworkPerformance: 1,
        avgCampaignSuccess: 1,
        avgQualityScore: 1,
      },
    },
  ]);
};

module.exports = mongoose.model(
  "AffiliateManagerMetrics",
  affiliateManagerMetricsSchema
);
