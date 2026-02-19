const mongoose = require('mongoose');

const GlobalFixedExpenseSchema = new mongoose.Schema(
  {
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

GlobalFixedExpenseSchema.index({ isActive: 1 });

module.exports = mongoose.model('GlobalFixedExpense', GlobalFixedExpenseSchema);
