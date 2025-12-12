const mongoose = require('mongoose');

const salaryConfigurationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  salaryType: {
    type: String,
    enum: ['fixed_monthly'],
    required: true,
    default: 'fixed_monthly'
  },
  // Fixed salary configuration
  fixedSalary: {
    amount: {
      type: Number,
      min: 0
    },
    currency: {
      type: String,
      default: 'USD'
    },
    paymentFrequency: {
      type: String,
      enum: ['weekly', 'bi_weekly', 'monthly'],
      default: 'monthly'
    }
  },

  // Configuration metadata
  isActive: {
    type: Boolean,
    default: true
  },
  effectiveDate: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    maxlength: 500
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient lookups
salaryConfigurationSchema.index({ user: 1 });
salaryConfigurationSchema.index({ salaryType: 1 });
salaryConfigurationSchema.index({ isActive: 1 });

// Validation middleware
salaryConfigurationSchema.pre('save', function(next) {
  // Validate that configuration matches salary type
  if (this.salaryType === 'fixed_monthly' && !this.fixedSalary.amount) {
    return next(new Error('Fixed salary amount is required for fixed_monthly salary type'));
  }
  
  next();
});

// Static methods for salary calculations

salaryConfigurationSchema.statics.calculateFixedSalary = async function(userId, period = 'monthly') {
  const config = await this.findOne({ user: userId });
  if (!config || config.salaryType !== 'fixed_monthly') {
    throw new Error('Fixed salary configuration not found');
  }
  
  let amount = config.fixedSalary.amount;
  
  // Adjust for payment frequency
  if (period === 'weekly' && config.fixedSalary.paymentFrequency === 'monthly') {
    amount = amount / 4.33; // Average weeks per month
  } else if (period === 'bi_weekly' && config.fixedSalary.paymentFrequency === 'monthly') {
    amount = amount / 2.17; // Average bi-weekly periods per month
  }
  
  return {
    amount,
    currency: config.fixedSalary.currency,
    paymentFrequency: config.fixedSalary.paymentFrequency,
    config: config
  };
};

module.exports = mongoose.model('SalaryConfiguration', salaryConfigurationSchema); 