const { Schema, model, Types } = require("mongoose");

/**
 * @description Schema for tracking daily performance metrics of an agent.
 * Each document represents a single day's performance for a specific agent.
 */
const agentPerformanceSchema = new Schema(
  {
    agent: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    callTimeMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    earnings: {
      type: Number,
      default: 0,
      min: 0,
    },
    penalties: {
      type: Number,
      default: 0,
      min: 0,
    },
    leadsContacted: {
      type: Number,
      default: 0,
      min: 0,
    },
    leadsConverted: {
      type: Number,
      default: 0,
      min: 0,
    },
    callsCompleted: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Sub-document for granular call/conversion metrics.
    // Using _id: false prevents Mongoose from creating an ObjectId for this sub-document.
    breakdown: {
      _id: false,
      ftdCalls: { type: Number, default: 0 },
      fillerCalls: { type: Number, default: 0 },
      coldCalls: { type: Number, default: 0 },
      ftdConversions: { type: Number, default: 0 },
      fillerConversions: { type: Number, default: 0 },
      coldConversions: { type: Number, default: 0 },
    },
    // Sub-document for bonus-related call tracking.
    callCounts: {
      _id: false,
      firstCalls: { type: Number, default: 0 },
      secondCalls: { type: Number, default: 0 },
      thirdCalls: { type: Number, default: 0 },
      fourthCalls: { type: Number, default: 0 },
      fifthCalls: { type: Number, default: 0 },
      verifiedAccounts: { type: Number, default: 0 },
    },
    notes: String,
    isVerified: {
      type: Boolean,
      default: false,
    },
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    verifiedAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// --- INDEXES ---
// Unique index to prevent duplicate performance entries for the same agent on the same day.
// Also optimizes queries filtering by agent and date.
agentPerformanceSchema.index({ agent: 1, date: 1 }, { unique: true });

// Optimizes queries that sort or filter by date, e.g., fetching all records for a day.
agentPerformanceSchema.index({ date: -1 });

// Optimizes queries for a specific agent, sorted by most recent date.
// Useful for fetching an agent's latest performance records.
agentPerformanceSchema.index({ agent: 1, date: -1 });

// --- VIRTUALS ---
// These are calculated properties and are not stored in the database.
agentPerformanceSchema.virtual("netEarnings").get(function () {
  return this.earnings - this.penalties;
});

agentPerformanceSchema.virtual("conversionRate").get(function () {
  if (!this.leadsContacted) return 0; // Use a falsy check for both 0 and undefined
  return Math.round((this.leadsConverted / this.leadsContacted) * 100);
});

agentPerformanceSchema.virtual("callsPerHour").get(function () {
  if (!this.callTimeMinutes) return 0;
  // No change needed, this is an efficient way to round to 2 decimal places.
  return (
    Math.round((this.callsCompleted / (this.callTimeMinutes / 60)) * 100) / 100
  );
});

// --- STATIC METHODS ---

/**
 * Aggregates performance statistics for a specific agent over a date range.
 * @param {string|Types.ObjectId} agentId - The ID of the agent.
 * @param {string|Date} startDate - The start of the date range.
 * @param {string|Date} endDate - The end of the date range.
 * @returns {Promise<Object[]>} A promise that resolves to the aggregated stats.
 */
agentPerformanceSchema.statics.getAgentStats = function (
  agentId,
  startDate,
  endDate
) {
  const match = { agent: new Types.ObjectId(agentId) }; // Explicit casting is safer
  if (startDate && endDate) {
    match.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  return this.aggregate([
    // Stage 1: Filter documents for the specified agent and date range
    { $match: match },
    // Stage 2: Group all matching documents into a single result
    {
      $group: {
        _id: "$agent", // Group by agent ID for consistency
        totalCallTime: { $sum: "$callTimeMinutes" },
        totalEarnings: { $sum: "$earnings" },
        totalPenalties: { $sum: "$penalties" },
        totalLeadsContacted: { $sum: "$leadsContacted" },
        totalLeadsConverted: { $sum: "$leadsConverted" },
        totalCalls: { $sum: "$callsCompleted" },
        daysWorked: { $sum: 1 },
      },
    },
    // Stage 3: Calculate overall averages and rates safely
    {
      $project: {
        _id: 0, // Exclude the default _id field
        agent: "$_id",
        totalCallTime: 1,
        totalEarnings: 1,
        totalPenalties: 1,
        totalLeadsContacted: 1,
        totalLeadsConverted: 1,
        totalCalls: 1,
        daysWorked: 1,
        netEarnings: { $subtract: ["$totalEarnings", "$totalPenalties"] },
        // OPTIMIZATION: Safely calculate conversion rate, avoiding division by zero
        overallConversionRate: {
          $cond: {
            if: { $eq: ["$totalLeadsContacted", 0] },
            then: 0,
            else: {
              $round: [
                {
                  $multiply: [
                    {
                      $divide: ["$totalLeadsConverted", "$totalLeadsContacted"],
                    },
                    100,
                  ],
                },
              ],
            },
          },
        },
        avgDailyEarnings: { $divide: ["$totalEarnings", "$daysWorked"] },
      },
    },
  ]);
};

/**
 * Retrieves a list of top-performing agents based on net earnings over a date range.
 * @param {string|Date} startDate - The start of the date range.
 * @param {string|Date} endDate - The end of the date range.
 * @param {number} [limit=10] - The number of top performers to return.
 * @returns {Promise<Object[]>} A promise that resolves to an array of top performers.
 */
agentPerformanceSchema.statics.getTopPerformers = function (
  startDate,
  endDate,
  limit = 10
) {
  const match = {};
  if (startDate && endDate) {
    match.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  return this.aggregate([
    // Stage 1: Filter documents by the date range
    { $match: match },
    // Stage 2: Group stats by agent
    {
      $group: {
        _id: "$agent",
        totalEarnings: { $sum: "$earnings" },
        totalPenalties: { $sum: "$penalties" },
        totalLeadsConverted: { $sum: "$leadsConverted" },
        totalLeadsContacted: { $sum: "$leadsContacted" }, // Needed for safe calculation
      },
    },
    // Stage 3: Calculate derived metrics like net earnings and conversion rate
    {
      $project: {
        totalEarnings: 1,
        totalPenalties: 1,
        totalLeadsConverted: 1,
        netEarnings: { $subtract: ["$totalEarnings", "$totalPenalties"] },
        // OPTIMIZATION: Safely calculate conversion rate, avoiding division by zero
        conversionRate: {
          $cond: {
            if: { $eq: ["$totalLeadsContacted", 0] },
            then: 0,
            else: {
              $multiply: [
                { $divide: ["$totalLeadsConverted", "$totalLeadsContacted"] },
                100,
              ],
            },
          },
        },
      },
    },
    // Stage 4: Sort by net earnings to find top performers
    { $sort: { netEarnings: -1 } },
    // Stage 5: Limit the results
    { $limit: limit },
    // Stage 6: Join with the users collection to get agent details
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "agentInfo",
      },
    },
    // Stage 7: Deconstruct the agentInfo array and reshape the output
    // OPTIMIZATION: Use $unwind with preserverNullAndEmptyArrays for robustness
    { $unwind: { path: "$agentInfo", preserveNullAndEmptyArrays: true } },
    // Stage 8: Project to a clean, final shape
    {
      $project: {
        _id: 0,
        agentId: "$_id",
        name: "$agentInfo.name", // Assuming user schema has 'name'
        email: "$agentInfo.email", // Assuming user schema has 'email'
        netEarnings: 1,
        totalEarnings: 1,
        totalPenalties: 1,
        totalLeadsConverted: 1,
        conversionRate: { $round: ["$conversionRate", 0] },
      },
    },
  ]);
};

/**
 * Aggregates performance statistics for the entire team on a specific day.
 * @param {string|Date} date - The target date.
 * @returns {Promise<Object[]>} A promise that resolves to the aggregated team stats.
 */
agentPerformanceSchema.statics.getDailyTeamStats = function (date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return this.aggregate([
    // Stage 1: Find all records for the specified day
    {
      $match: {
        date: { $gte: startOfDay, $lte: endOfDay },
      },
    },
    // Stage 2: Group all records into a single summary document
    {
      $group: {
        _id: null,
        totalAgentsActive: { $addToSet: "$agent" }, // Use $addToSet to count unique agents
        totalCallTime: { $sum: "$callTimeMinutes" },
        totalEarnings: { $sum: "$earnings" },
        totalPenalties: { $sum: "$penalties" },
        totalLeadsContacted: { $sum: "$leadsContacted" },
        totalLeadsConverted: { $sum: "$leadsConverted" },
        totalCalls: { $sum: "$callsCompleted" },
      },
    },
    // Stage 3: Reshape the output for clarity
    {
      $project: {
        _id: 0,
        totalActiveAgents: { $size: "$totalAgentsActive" }, // Calculate the size of the set
        totalCallTime: 1,
        totalEarnings: 1,
        netEarnings: { $subtract: ["$totalEarnings", "$totalPenalties"] },
        totalLeadsContacted: 1,
        totalLeadsConverted: 1,
        totalCalls: 1,
        teamConversionRate: {
          $cond: {
            if: { $eq: ["$totalLeadsContacted", 0] },
            then: 0,
            else: {
              $round: [
                {
                  $multiply: [
                    {
                      $divide: ["$totalLeadsConverted", "$totalLeadsContacted"],
                    },
                    100,
                  ],
                },
              ],
            },
          },
        },
      },
    },
  ]);
};

module.exports = model("AgentPerformance", agentPerformanceSchema);
