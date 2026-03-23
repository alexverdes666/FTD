const mongoose = require('mongoose');

const employeeBonusSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  currency: {
    type: String,
    default: 'USD',
  },
  reason: {
    type: String,
    required: true,
    maxlength: 500,
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12,
  },
  year: {
    type: Number,
    required: true,
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
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

employeeBonusSchema.index({ employee: 1, year: 1, month: 1 });
employeeBonusSchema.index({ employee: 1 });

module.exports = mongoose.model('EmployeeBonus', employeeBonusSchema);
