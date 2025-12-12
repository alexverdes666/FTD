const mongoose = require('mongoose');

const scheduleChangeRequestSchema = new mongoose.Schema({
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
  requestedAvailability: {
    type: Boolean,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    required: true
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  rejectionReason: {
    type: String,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
scheduleChangeRequestSchema.index({ agentId: 1, status: 1 });
scheduleChangeRequestSchema.index({ status: 1, requestedAt: 1 });
scheduleChangeRequestSchema.index({ agentId: 1, year: 1, month: 1, day: 1 });

// Virtual to get agent details
scheduleChangeRequestSchema.virtual('agent', {
  ref: 'User',
  localField: 'agentId',
  foreignField: '_id',
  justOne: true
});

// Virtual to get reviewer details
scheduleChangeRequestSchema.virtual('reviewer', {
  ref: 'User',
  localField: 'reviewedBy',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('ScheduleChangeRequest', scheduleChangeRequestSchema);

