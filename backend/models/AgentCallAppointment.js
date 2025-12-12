const mongoose = require('mongoose');

const agentCallAppointmentSchema = new mongoose.Schema({
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
  day: {
    type: Number,
    required: true,
    min: 1,
    max: 31
  },
  hour: {
    type: Number,
    required: true,
    min: 0,
    max: 23
  },
  ftdName: {
    type: String,
    required: true,
    trim: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound index to prevent duplicate appointments at same time for same agent
agentCallAppointmentSchema.index({ 
  agentId: 1, 
  year: 1, 
  month: 1, 
  day: 1, 
  hour: 1 
}, { unique: true });

// Index for querying appointments by month
agentCallAppointmentSchema.index({ agentId: 1, year: 1, month: 1 });

// Virtual to get agent details
agentCallAppointmentSchema.virtual('agent', {
  ref: 'User',
  localField: 'agentId',
  foreignField: '_id',
  justOne: true
});

// Instance method to validate date
agentCallAppointmentSchema.methods.isValidDate = function() {
  const daysInMonth = new Date(this.year, this.month, 0).getDate();
  return this.day <= daysInMonth;
};

module.exports = mongoose.model('AgentCallAppointment', agentCallAppointmentSchema);

