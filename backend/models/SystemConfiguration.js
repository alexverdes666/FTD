const mongoose = require("mongoose");

const systemConfigurationSchema = new mongoose.Schema(
  {
    configType: {
      type: String,
      required: true,
      unique: true,
    },
    // Global bonus rates configuration
    bonusRates: {
      firstCall: {
        type: Number,
        default: 5.0,
        min: 0,
      },
      secondCall: {
        type: Number,
        default: 10.0,
        min: 0,
      },
      thirdCall: {
        type: Number,
        default: 15.0,
        min: 0,
      },
      fourthCall: {
        type: Number,
        default: 20.0,
        min: 0,
      },
      fifthCall: {
        type: Number,
        default: 25.0,
        min: 0,
      },
      verifiedAcc: {
        type: Number,
        default: 50.0,
        min: 0,
      },
    },
    // Sound settings configuration
    soundSettings: {
      orderCreatedSound: {
        type: String,
        default: "/audio/debeliq.mp3",
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
systemConfigurationSchema.index({ configType: 1 });
systemConfigurationSchema.index({ isActive: 1 });

// Static method to get global bonus rates configuration
systemConfigurationSchema.statics.getGlobalBonusRates = function () {
  return this.findOne({ 
    configType: 'GLOBAL_BONUS_RATES', 
    isActive: true 
  }).populate("lastUpdatedBy", "fullName email");
};

// Static method to update global bonus rates
systemConfigurationSchema.statics.updateGlobalBonusRates = async function (bonusRates, adminId, notes = '') {
  return this.findOneAndUpdate(
    { configType: 'GLOBAL_BONUS_RATES' },
    {
      bonusRates,
      lastUpdatedBy: adminId,
      notes,
      isActive: true,
    },
    { 
      upsert: true, 
      new: true,
      runValidators: true
    }
  ).populate("lastUpdatedBy", "fullName email");
};

// Static method to create default global bonus rates
systemConfigurationSchema.statics.createDefaultGlobalBonusRates = function (adminId) {
  return this.create({
    configType: 'GLOBAL_BONUS_RATES',
    lastUpdatedBy: adminId,
    notes: "Default global bonus rates created automatically",
  });
};

module.exports = mongoose.model("SystemConfiguration", systemConfigurationSchema);
