const mongoose = require("mongoose");

const searchHistorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    query: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    filters: {
      types: [String],
      status: String,
      country: String,
      dateFrom: Date,
      dateTo: Date,
    },
    resultCount: {
      type: Number,
      default: 0,
    },
    resultBreakdown: {
      leads: { type: Number, default: 0 },
      orders: { type: Number, default: 0 },
      users: { type: Number, default: 0 },
      campaigns: { type: Number, default: 0 },
      tickets: { type: Number, default: 0 },
      announcements: { type: Number, default: 0 },
      clientBrokers: { type: Number, default: 0 },
      clientNetworks: { type: Number, default: 0 },
      ourNetworks: { type: Number, default: 0 },
    },
    searchedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
searchHistorySchema.index({ user: 1, searchedAt: -1 });
searchHistorySchema.index({ user: 1, query: 1 });

// Static method to add search to history
searchHistorySchema.statics.addSearch = async function (userId, searchData) {
  const { query, filters, resultCount, resultBreakdown } = searchData;

  // Check if same query exists recently (within last hour) to avoid duplicates
  const recentDuplicate = await this.findOne({
    user: userId,
    query: query,
    searchedAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
  });

  if (recentDuplicate) {
    // Update existing entry
    recentDuplicate.searchedAt = new Date();
    recentDuplicate.resultCount = resultCount;
    recentDuplicate.resultBreakdown = resultBreakdown;
    return recentDuplicate.save();
  }

  // Create new entry
  const entry = await this.create({
    user: userId,
    query,
    filters,
    resultCount,
    resultBreakdown,
    searchedAt: new Date(),
  });

  // Keep only last 20 searches per user
  const count = await this.countDocuments({ user: userId });
  if (count > 20) {
    const oldEntries = await this.find({ user: userId })
      .sort({ searchedAt: 1 })
      .limit(count - 20)
      .select("_id");
    
    await this.deleteMany({
      _id: { $in: oldEntries.map((e) => e._id) },
    });
  }

  return entry;
};

// Static method to get user's search history
searchHistorySchema.statics.getUserHistory = async function (userId, limit = 20) {
  return this.find({ user: userId })
    .sort({ searchedAt: -1 })
    .limit(limit)
    .lean();
};

// Static method to clear user's search history
searchHistorySchema.statics.clearUserHistory = async function (userId) {
  return this.deleteMany({ user: userId });
};

// Static method to delete a specific search entry
searchHistorySchema.statics.deleteEntry = async function (userId, entryId) {
  return this.deleteOne({ _id: entryId, user: userId });
};

module.exports = mongoose.model("SearchHistory", searchHistorySchema);
