const mongoose = require('mongoose');

const agentScheduleSchema = new mongoose.Schema({
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  year: {
    type: Number,
    required: true,
    min: 2020,
    max: 2100
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  // Map of day number (1-31) to availability boolean
  availabilityMap: {
    type: Map,
    of: Boolean,
    default: () => {
      // Default all days to unavailable (false)
      const map = new Map();
      for (let i = 1; i <= 31; i++) {
        map.set(i.toString(), false);
      }
      return map;
    }
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      // Convert Map to plain object for JSON serialization
      if (ret.availabilityMap && ret.availabilityMap instanceof Map) {
        const obj = {};
        ret.availabilityMap.forEach((value, key) => {
          obj[key] = value;
        });
        ret.availabilityMap = obj;
      }
      return ret;
    }
  },
  toObject: { 
    virtuals: true,
    transform: function(doc, ret) {
      // Convert Map to plain object
      if (ret.availabilityMap && ret.availabilityMap instanceof Map) {
        const obj = {};
        ret.availabilityMap.forEach((value, key) => {
          obj[key] = value;
        });
        ret.availabilityMap = obj;
      }
      return ret;
    }
  }
});

// Compound index for unique agent schedule per month
agentScheduleSchema.index({ agentId: 1, year: 1, month: 1 }, { unique: true });

// Virtual to get agent details
agentScheduleSchema.virtual('agent', {
  ref: 'User',
  localField: 'agentId',
  foreignField: '_id',
  justOne: true
});

// Helper method to get availability for a specific day
agentScheduleSchema.methods.getAvailability = function(day) {
  return this.availabilityMap.get(day.toString()) === true;
};

// Helper method to set availability for a specific day
agentScheduleSchema.methods.setAvailability = function(day, available) {
  this.availabilityMap.set(day.toString(), available);
};

module.exports = mongoose.model('AgentSchedule', agentScheduleSchema);

