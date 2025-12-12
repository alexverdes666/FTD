const mongoose = require('mongoose');

// Import BlockchainScraperService to calculate crypto wallet values
let BlockchainScraperService;
try {
  const service = require('../services/blockchainScraperService');
  BlockchainScraperService = service;
} catch (error) {
  console.warn('BlockchainScraperService not available:', error.message);
}

// Schema for individual table row items
const tableRowSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  label: {
    type: String,
    required: true
  },
  value: {
    type: Number,
    default: 0
  },
  quantity: {
    type: Number,
    default: 1,
    min: 0
  },
  calculationType: {
    type: String,
    enum: ['quantity', 'percentage'],
    default: 'quantity'
  },
  currency: {
    type: String,
    default: 'USD'
  },
  isEditable: {
    type: Boolean,
    default: true
  },
  category: {
    type: String,
    required: true
  },
  isCalculated: {
    type: Boolean,
    default: false
  },
  formula: {
    type: String,
    default: null
  },
  order: {
    type: Number,
    default: 0
  }
}, {
  _id: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual field for total value (value * quantity or value * percentage)
tableRowSchema.virtual('totalValue').get(function() {
  const value = this.value || 0;
  const quantity = this.quantity || 1;
  const calculationType = this.calculationType || 'quantity';
  
  if (calculationType === 'percentage') {
    return (value * quantity) / 100; // percentage calculation
  }
  return value * quantity; // quantity calculation
});

// Main schema for affiliate manager table
const affiliateManagerTableSchema = new mongoose.Schema({
  affiliateManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  period: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'yearly'],
    default: 'monthly'
  },
  date: {
    type: Date,
    required: true
  },
  tableData: {
    type: [tableRowSchema],
    default: []
  },
  // Total money automatically calculated from crypto wallet values of assigned networks
  totalMoney: {
    type: Number,
    default: 0
  },
  // Calculated totals
  calculatedTotals: {
    hyperNet: {
      type: Number,
      default: 0
    },
    profit: {
      type: Number,
      default: 0
    },
    percentage: {
      type: Number,
      default: 0
    }
  },
  // Metadata
  isActive: {
    type: Boolean,
    default: true
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  notes: {
    type: String,
    maxlength: 1000
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
affiliateManagerTableSchema.index({ affiliateManager: 1, date: 1, period: 1 });
affiliateManagerTableSchema.index({ affiliateManager: 1, isActive: 1 });
affiliateManagerTableSchema.index({ date: 1, period: 1 });

// Virtual for displaying affiliate manager info
affiliateManagerTableSchema.virtual('affiliateManagerInfo', {
  ref: 'User',
  localField: 'affiliateManager',
  foreignField: '_id',
  justOne: true
});

// Pre-save middleware to calculate totals
affiliateManagerTableSchema.pre('save', function(next) {
  try {
    // Calculate totals based on table data
    this.calculateTotals();
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to calculate totals
affiliateManagerTableSchema.methods.calculateTotals = function() {
  // Calculate total expenses (all table values are expenses, considering calculation type)
  const totalExpenses = this.tableData.reduce((sum, row) => {
    if (!row.isCalculated) {
      const value = parseFloat(row.value) || 0;
      const quantity = parseFloat(row.quantity) || 1;
      const calculationType = row.calculationType || 'quantity';
      
      let totalValue;
      if (calculationType === 'percentage') {
        totalValue = (value * quantity) / 100; // percentage calculation
      } else {
        totalValue = value * quantity; // quantity calculation
      }
      
      return sum + totalValue;
    }
    return sum;
  }, 0);
  
  // Get hyper net value from table data (it's now editable), also consider calculation type
  const hyperNetRow = this.tableData.find(row => row.id === 'hyper_net');
  if (hyperNetRow) {
    const value = parseFloat(hyperNetRow.value) || 0;
    const quantity = parseFloat(hyperNetRow.quantity) || 1;
    const calculationType = hyperNetRow.calculationType || 'quantity';
    
    if (calculationType === 'percentage') {
      this.calculatedTotals.hyperNet = (value * quantity) / 100;
    } else {
      this.calculatedTotals.hyperNet = value * quantity;
    }
  } else {
    this.calculatedTotals.hyperNet = 0;
  }
  
  // Calculate profit = Total Money - Total Expenses
  this.calculatedTotals.profit = this.totalMoney - totalExpenses;
  
  // Calculate percentage = (profit / totalMoney) * 100
  this.calculatedTotals.percentage = this.totalMoney > 0 ? (this.calculatedTotals.profit / this.totalMoney) * 100 : 0;
};

// Instance method to update total money from crypto wallet values
affiliateManagerTableSchema.methods.updateTotalMoneyFromCrypto = async function(options = {}) {
  try {
    if (!BlockchainScraperService) {
      console.warn('BlockchainScraperService not available, cannot update total money from crypto');
      return;
    }

    const service = new BlockchainScraperService();
    
    // Pass month/year directly to the service for proper date range filtering
    const serviceOptions = {};
    
    if (options.month && options.year) {
      serviceOptions.month = options.month;
      serviceOptions.year = options.year;
    }
    
    const cryptoValues = await service.getAffiliateManagerTotalValue(this.affiliateManager, serviceOptions);
    
    // Update totalMoney with the crypto wallet values
    this.totalMoney = cryptoValues.totalUsdValue || 0;
    
    // Recalculate other totals based on the new totalMoney
    this.calculateTotals();
    
    const periodInfo = options.month && options.year 
      ? `for ${new Date(parseInt(options.year), parseInt(options.month) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
      : 'all time';
    
    console.log(`Updated total money for affiliate manager ${this.affiliateManager}: $${this.totalMoney.toFixed(2)} from ${cryptoValues.networksCount} networks, ${cryptoValues.totalTransactions} transactions (${periodInfo})`);
  } catch (error) {
    console.error('Error updating total money from crypto:', error);
    // Don't throw the error, just log it and continue
  }
};

// Static method to get default table structure
affiliateManagerTableSchema.statics.getDefaultTableStructure = function() {
  return [
    // FTD Section
    { id: 'ftd_deposit_300', label: 'FTDs (Deposit) avr $300', value: 0, quantity: 1, calculationType: 'quantity', currency: 'USD', category: 'ftd', order: 1 },
    { id: 'ftd_transaction_commission', label: 'FTDs Transaction Commission', value: 0, quantity: 1, calculationType: 'quantity', currency: 'USD', category: 'ftd', order: 2 },
    
    // Leads + Depositors Section
    { id: 'au_leads_depositors', label: 'AU leads + depositors – voip', value: 0, quantity: 1, calculationType: 'quantity', currency: 'USD', category: 'leads', order: 3 },
    { id: 'ca_leads_depositors', label: 'CA leads + depositors – voip', value: 0, quantity: 1, calculationType: 'quantity', currency: 'USD', category: 'leads', order: 4 },
    { id: 'uk_leads_depositors', label: 'UK leads + depositors – voip', value: 0, quantity: 1, calculationType: 'quantity', currency: 'USD', category: 'leads', order: 5 },
    
    // SIM Cards Section
    { id: 'se_sim_cards', label: 'SE SIM cards', value: 0, quantity: 1, calculationType: 'quantity', currency: 'USD', category: 'sim_cards', order: 6 },
    { id: 'uk_sim_cards', label: 'UK SIM cards', value: 0, quantity: 1, calculationType: 'quantity', currency: 'USD', category: 'sim_cards', order: 7 },
    { id: 'ca_sim_cards', label: 'CA SIM cards', value: 0, quantity: 1, calculationType: 'quantity', currency: 'USD', category: 'sim_cards', order: 8 },
    { id: 'es_sim_cards', label: 'ES SIM cards', value: 0, quantity: 1, calculationType: 'quantity', currency: 'USD', category: 'sim_cards', order: 9 },
    
    // Data Traffic Section
    { id: 'data_traffic_se', label: 'Data traffic leads SE', value: 0, quantity: 1, calculationType: 'quantity', currency: 'USD', category: 'data_traffic', order: 10 },
    { id: 'data_traffic_uk', label: 'Data traffic leads UK', value: 0, quantity: 1, calculationType: 'quantity', currency: 'USD', category: 'data_traffic', order: 11 },
    { id: 'data_traffic_ca', label: 'Data traffic leads CA', value: 0, quantity: 1, calculationType: 'quantity', currency: 'USD', category: 'data_traffic', order: 12 },
    { id: 'data_traffic_es', label: 'Data traffic leads ES', value: 0, quantity: 1, calculationType: 'quantity', currency: 'USD', category: 'data_traffic', order: 13 },
    { id: 'data_traffic_it', label: 'Data traffic leads IT', value: 0, quantity: 1, calculationType: 'quantity', currency: 'USD', category: 'data_traffic', order: 14 },
    
    // Call Activities Section
    { id: 'total_talking_time', label: 'Total talking time (hours)', value: 0, quantity: 1, calculationType: 'quantity', currency: 'USD', category: 'calls', order: 15 },
    { id: 'deposit_calls', label: 'Deposit calls', value: 0, quantity: 1, calculationType: 'quantity', currency: 'USD', category: 'calls', order: 16 },
    { id: 'first_am_call', label: '1st AM call', value: 0, quantity: 1, calculationType: 'quantity', currency: 'USD', category: 'calls', order: 17 },
    { id: 'second_am_call', label: '2nd AM call', value: 0, quantity: 1, calculationType: 'quantity', currency: 'USD', category: 'calls', order: 18 },
    { id: 'third_am_call', label: '3rd AM call', value: 0, quantity: 1, calculationType: 'quantity', currency: 'USD', category: 'calls', order: 19 },
    { id: 'fourth_am_call', label: '4th AM call', value: 0, quantity: 1, calculationType: 'quantity', currency: 'USD', category: 'calls', order: 20 },
    
    // Verification Section
    { id: 'verified_ids', label: 'Verified IDs', value: 0, quantity: 1, calculationType: 'quantity', currency: 'USD', category: 'verification', order: 21 },
    { id: 'proxies_injection', label: 'Proxies per injection', value: 0, quantity: 1, calculationType: 'quantity', currency: 'USD', category: 'verification', order: 22 },
    
    // Cards Section
    { id: 'es_cards', label: 'ES Cards', value: 0, quantity: 1, calculationType: 'quantity', currency: 'USD', category: 'cards', order: 23 },
    { id: 'ca_cards', label: 'CA Cards', value: 0, quantity: 1, calculationType: 'quantity', currency: 'USD', category: 'cards', order: 24 },
    { id: 'jimmy_commission', label: 'Jimmy\'s Commission per CA ftd', value: 0, quantity: 1, calculationType: 'quantity', currency: 'USD', category: 'cards', order: 25 },
    { id: 'cards_issued', label: 'CARDS Issued', value: 0, quantity: 1, calculationType: 'quantity', currency: 'USD', category: 'cards', order: 26 },
    
    // Services Section
    { id: 'documents', label: 'Documents', value: 0, quantity: 1, calculationType: 'quantity', currency: 'USD', category: 'services', order: 27 },
    { id: 'hosting_services', label: 'Hosting services', value: 0, quantity: 1, calculationType: 'quantity', currency: 'USD', category: 'services', order: 28 },
    { id: 'office_percentage', label: 'Office %', value: 0, quantity: 1, calculationType: 'percentage', currency: 'USD', category: 'services', order: 29 },
    { id: 'contract_salary', label: 'Contract salary', value: 0, quantity: 1, calculationType: 'quantity', currency: 'USD', category: 'services', order: 30 },
    { id: 'insurances', label: 'Insurances', value: 0, quantity: 1, calculationType: 'quantity', currency: 'USD', category: 'services', order: 31 },
    
    // Financial Summary Section
    { id: 'hyper_net', label: 'Hyper Net', value: 0, quantity: 1, calculationType: 'quantity', currency: 'USD', category: 'financial', order: 32 }
  ];
};

// Static method to create table for affiliate manager
affiliateManagerTableSchema.statics.createTableForAffiliate = async function(affiliateManagerId, period = 'monthly', date = new Date(), options = {}) {
  const defaultStructure = this.getDefaultTableStructure();
  
  const tableData = {
    affiliateManager: affiliateManagerId,
    period,
    date,
    tableData: defaultStructure,
    lastUpdatedBy: affiliateManagerId
  };
  
  const table = await this.create(tableData);
  
  // Automatically update total money from crypto wallet values for new tables
  try {
    await table.updateTotalMoneyFromCrypto(options);
    await table.save();
  } catch (error) {
    console.error('Error updating total money from crypto in createTableForAffiliate:', error);
    // Continue without failing - table will still be created with default totalMoney value
  }
  
  return table;
};

// Static method to get or create table for affiliate manager
affiliateManagerTableSchema.statics.getOrCreateTable = async function(affiliateManagerId, period = 'monthly', date = new Date(), options = {}) {
  // Try to find existing table for the same period and date
  const startOfPeriod = new Date(date);
  const endOfPeriod = new Date(date);
  
  if (period === 'monthly') {
    startOfPeriod.setDate(1);
    endOfPeriod.setMonth(endOfPeriod.getMonth() + 1);
    endOfPeriod.setDate(0);
  } else if (period === 'weekly') {
    const dayOfWeek = startOfPeriod.getDay();
    startOfPeriod.setDate(startOfPeriod.getDate() - dayOfWeek);
    endOfPeriod.setDate(startOfPeriod.getDate() + 6);
  } else if (period === 'daily') {
    startOfPeriod.setHours(0, 0, 0, 0);
    endOfPeriod.setHours(23, 59, 59, 999);
  }
  
  let table = await this.findOne({
    affiliateManager: affiliateManagerId,
    period,
    date: {
      $gte: startOfPeriod,
      $lte: endOfPeriod
    },
    isActive: true
  }).populate('affiliateManager', 'fullName email');
  
  if (!table) {
    table = await this.createTableForAffiliate(affiliateManagerId, period, date, options);
    await table.populate('affiliateManager', 'fullName email');
  } else {
    // Check if existing table has all fields from current default structure
    const currentDefaultStructure = this.getDefaultTableStructure();
    const existingFieldIds = new Set(table.tableData.map(item => item.id));
    
    let hasUpdates = false;
    const missingFields = [];
    
    for (const defaultField of currentDefaultStructure) {
      if (!existingFieldIds.has(defaultField.id)) {
        missingFields.push(defaultField);
        hasUpdates = true;
      }
    }
    
    // Add missing fields to existing table
    if (hasUpdates) {
      table.tableData.push(...missingFields);
      await table.save();
    }
  }
  
  // Automatically update total money from crypto wallet values with period filtering
  try {
    await table.updateTotalMoneyFromCrypto(options);
    await table.save();
  } catch (error) {
    console.error('Error updating total money from crypto in getOrCreateTable:', error);
    // Continue without failing - table will still be returned with previous totalMoney value
  }
  
  return table;
};

module.exports = mongoose.model('AffiliateManagerTable', affiliateManagerTableSchema); 