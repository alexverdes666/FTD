const mongoose = require('mongoose');

const AMFixedExpenseSchema = new mongoose.Schema(
  {
    affiliateManager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Affiliate manager is required'],
    },
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
    label: {
      type: String,
      required: [true, 'Label is required'],
      trim: true,
      maxlength: 200,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
    },
    category: {
      type: String,
      default: 'other',
    },
    notes: {
      type: String,
      maxlength: 500,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

AMFixedExpenseSchema.index({ affiliateManager: 1, month: 1, year: 1, isActive: 1 });

module.exports = mongoose.model('AMFixedExpense', AMFixedExpenseSchema);
