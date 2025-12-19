const mongoose = require("mongoose");
const { Schema, model } = mongoose;
const SchemaTypes = Schema.Types;

// --- 1. Centralized Constants for Enums ---
const ENUMS = {
  ORDER_STATUS: ["fulfilled", "partial", "pending", "cancelled"],
  PRIORITY: ["low", "medium", "high"],
  GENDER: ["male", "female", "not_defined", null],
  DEVICE_SELECTION_MODE: ["individual", "bulk", "ratio", "random"],
  DEVICE_TYPE: ["windows", "android", "ios", "mac"],
  BULK_DEVICE_TYPE: ["windows", "android", "ios", "mac", null],
  FTD_HANDLING_STATUS: [
    "pending",
    "skipped",
    "manual_fill_required",
    "completed",
  ],
  ASSIGNMENT_STATUS: ["pending", "in_progress", "completed", "skipped"],
};

// --- 2. Reusable & Modular Sub-Schemas ---

// Reusable schema for 'requests' and 'fulfilled' fields
const leadCountSchema = new Schema(
  {
    ftd: { type: Number, default: 0 },
    filler: { type: Number, default: 0 },
    cold: { type: Number, default: 0 },
    live: { type: Number, default: 0 },
  },
  { _id: false }
); // _id: false prevents creating unnecessary IDs for sub-documents

const deviceConfigSchema = new Schema(
  {
    selectionMode: {
      type: String,
      enum: ENUMS.DEVICE_SELECTION_MODE,
      default: "random",
    },
    bulkDeviceType: {
      type: String,
      enum: ENUMS.BULK_DEVICE_TYPE,
      default: null,
    },
    deviceRatio: {
      windows: { type: Number, default: 0, min: 0, max: 10 },
      android: { type: Number, default: 0, min: 0, max: 10 },
      ios: { type: Number, default: 0, min: 0, max: 10 },
      mac: { type: Number, default: 0, min: 0, max: 10 },
    },
    individualAssignments: [
      {
        leadId: { type: SchemaTypes.ObjectId, ref: "Lead" },
        deviceType: { type: String, enum: ENUMS.DEVICE_TYPE, required: true },
      },
    ],
    availableDeviceTypes: [{ type: String, enum: ENUMS.DEVICE_TYPE }],
  },
  { _id: false }
);

const ftdHandlingSchema = new Schema(
  {
    status: {
      type: String,
      enum: ENUMS.FTD_HANDLING_STATUS,
      default: "pending",
    },
    skippedAt: { type: Date },
    completedAt: { type: Date },
    notes: { type: String },
  },
  { _id: false }
);



// --- Main Order Schema ---
const orderSchema = new Schema(
  {
    requester: { type: SchemaTypes.ObjectId, ref: "User", required: true },
    requesterHistory: [{
      previousRequester: { type: SchemaTypes.ObjectId, ref: "User" },
      newRequester: { type: SchemaTypes.ObjectId, ref: "User" },
      changedBy: { type: SchemaTypes.ObjectId, ref: "User" },
      changedAt: { type: Date, default: Date.now }
    }],
    status: { type: String, enum: ENUMS.ORDER_STATUS, default: "pending" },
    requests: { type: leadCountSchema, default: () => ({}) },
    leads: [{ type: SchemaTypes.ObjectId, ref: "Lead" }],
    // Metadata about how each lead was ordered in this specific order
    // This tracks display information per order to maintain historical accuracy
    leadsMetadata: [{
      leadId: { type: SchemaTypes.ObjectId, ref: "Lead", required: true },
      orderedAs: { 
        type: String, 
        enum: ["ftd", "filler", "cold", null],
        default: null
      },
      // Track all leads that have been in this position (for FTD swap prevention)
      replacementHistory: [{ 
        type: SchemaTypes.ObjectId, 
        ref: "Lead",
        default: []
      }],
      _id: false
    }],
    notes: String,
    priority: { type: String, enum: ENUMS.PRIORITY, default: "medium" },
    countryFilter: { type: String, trim: true },
    genderFilter: { type: String, enum: ENUMS.GENDER, default: null },
    selectedClientNetwork: {
      type: SchemaTypes.ObjectId,
      ref: "ClientNetwork",
      default: null,
    },
    selectedOurNetwork: {
      type: SchemaTypes.ObjectId,
      ref: "OurNetwork",
      default: null,
    },
    selectedCampaign: {
      type: SchemaTypes.ObjectId,
      ref: "Campaign",
      required: [true, "Campaign selection is mandatory for all orders"],
    },
    selectedClientBrokers: [{
      type: SchemaTypes.ObjectId,
      ref: "ClientBroker",
    }],
    agentFilter: {
      type: SchemaTypes.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    agentAssignments: [{
      leadType: {
        type: String,
        enum: ['ftd', 'filler'],
        required: true,
      },
      agentId: {
        type: SchemaTypes.ObjectId,
        ref: "User",
        required: true,
      },
      index: {
        type: Number,
        required: true,
      },
      _id: false,
    }],
    fulfilled: { type: leadCountSchema, default: () => ({}) },
    ftdHandling: { type: ftdHandlingSchema, default: () => ({}) },
    completedAt: Date,
    cancelledAt: Date,
    cancellationReason: String,
    partialFulfillmentReason: String,
    plannedDate: { 
      type: Date, 
      required: [true, "Planned date is required for order creation"],
      validate: {
        validator: function(value) {
          // Only validate plannedDate when creating a NEW order
          // Skip validation for existing orders (updates, FTD swaps, etc.)
          if (!this.isNew) {
            return true;
          }
          
          const now = new Date();
          // Normalize to UTC midnight for consistent comparison across timezones
          const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
          const plannedDay = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
          
          // Cannot create order for past dates (applies to everyone including admin)
          if (plannedDay < today) {
            throw new Error('Cannot create order for past dates');
          }
          
          return true;
        },
        message: props => props.reason
      }
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// --- 3. Optimized Compound Indexes ---
// Index for fetching a user's recent orders (covers filter + sort in getRecentOrders)
orderSchema.index({ requester: 1, createdAt: -1 });

// Index for dashboard/reporting queries (e.g., finding high-priority pending orders)
orderSchema.index({ status: 1, priority: 1, createdAt: -1 });

// Index for campaign-specific queries
orderSchema.index({ selectedCampaign: 1, status: 1 });

// Index for planned date statistics queries
orderSchema.index({ plannedDate: 1, status: 1 });

// --- Virtuals (Logic remains unchanged) ---
orderSchema.virtual("totalRequested").get(function () {
  const requests = this.requests || {};
  return (
    (requests.ftd || 0) +
    (requests.filler || 0) +
    (requests.cold || 0) +
    (requests.live || 0)
  );
});

orderSchema.virtual("totalFulfilled").get(function () {
  const fulfilled = this.fulfilled || {};
  return (
    (fulfilled.ftd || 0) +
    (fulfilled.filler || 0) +
    (fulfilled.cold || 0) +
    (fulfilled.live || 0)
  );
});

orderSchema.virtual("completionPercentage").get(function () {
  const total = this.totalRequested || 0;
  if (total === 0) return 0;
  const fulfilled = this.totalFulfilled || 0;
  return Math.round((fulfilled / total) * 100);
});

// --- Middleware (Logic remains unchanged, already optimized with isModified) ---
orderSchema.pre("save", function (next) {
  if (this.isModified("status")) {
    if (this.status === "fulfilled" && !this.completedAt) {
      this.completedAt = new Date();
    } else if (this.status === "cancelled" && !this.cancelledAt) {
      this.cancelledAt = new Date();
    }
  }
  next();
});

// --- Static Methods (Logic remains unchanged, query optimized) ---
orderSchema.statics.getOrderStats = function (userId = null) {
  const matchStage = userId
    ? { requester: new mongoose.Types.ObjectId(userId) }
    : {};

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalRequested: {
          $sum: {
            $add: [
              "$requests.ftd",
              "$requests.filler",
              "$requests.cold",
              "$requests.live",
            ],
          },
        },
        totalFulfilled: {
          $sum: {
            $add: [
              "$fulfilled.ftd",
              "$fulfilled.filler",
              "$fulfilled.cold",
              "$fulfilled.live",
            ],
          },
        },
      },
    },
  ]);
};

orderSchema.statics.getRecentOrders = function (userId = null, limit = 10) {
  const matchStage = userId
    ? { requester: new mongoose.Types.ObjectId(userId) }
    : {};

  return (
    this.find(matchStage)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("requester", "fullName email role")
      .populate("leads", "leadType firstName lastName country")
      // --- 4. Performance Optimization for Read Queries ---
      .lean()
  ); // Returns plain JS objects, much faster for read-only operations
};

module.exports = model("Order", orderSchema);
