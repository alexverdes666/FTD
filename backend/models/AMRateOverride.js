const mongoose = require('mongoose');

const AMRateOverrideSchema = new mongoose.Schema(
  {
    month: {
      type: Number,
      required: [true, 'Month is required'],
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: [true, 'Year is required'],
    },
    // Map of categoryKey -> rate value (e.g. { "ftds": 350, "sim-SE": 20, "totalTalkingTime": 15 })
    overrides: {
      type: Map,
      of: Number,
      default: {},
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

AMRateOverrideSchema.index({ month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('AMRateOverride', AMRateOverrideSchema);
