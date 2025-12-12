const mongoose = require('mongoose');

const amTargetSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed'],
      default: 'pending',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for efficient queries
amTargetSchema.index({ assignedTo: 1 });
amTargetSchema.index({ assignedBy: 1 });
amTargetSchema.index({ status: 1 });
amTargetSchema.index({ dueDate: 1 });

// Virtual to check if target is overdue
amTargetSchema.virtual('isOverdue').get(function () {
  return this.status !== 'completed' && new Date() > this.dueDate;
});

module.exports = mongoose.model('AMTarget', amTargetSchema);

