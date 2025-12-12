const mongoose = require('mongoose');

const blockchainTransactionSchema = new mongoose.Schema({
  // Network information
  network: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OurNetwork',
    required: true,
    index: true
  },
  networkName: {
    type: String,
    required: true
  },
  
  // Blockchain and wallet info
  blockchain: {
    type: String,
    enum: ['bitcoin', 'ethereum', 'tron'],
    required: true,
    index: true
  },
  walletAddress: {
    type: String,
    required: true,
    index: true
  },
  
  // Transaction details
  transactionHash: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  transactionId: {
    type: String,
    required: true,
    index: true
  },
  
  // Transfer details
  from: {
    type: String,
    required: true
  },
  to: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  amountRaw: {
    type: String,
    required: true
  },
  
  // Token information
  token: {
    symbol: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    decimals: {
      type: Number,
      default: 18
    }
  },
  
  // USD value
  usdValue: {
    type: Number,
    min: 0
  },
  
  // Block information
  blockNumber: {
    type: Number,
    index: true
  },
  
  // Timing information
  timestamp: {
    type: Date,
    required: true,
    index: true
  },
  date: {
    type: String,
    required: true,
    index: true
  },
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'failed'],
    default: 'confirmed'
  },
  
  // Transfer type
  transferType: {
    type: String,
    enum: ['incoming', 'outgoing'],
    required: true,
    index: true
  },
  
  // Scraper metadata
  scraperInfo: {
    scrapedAt: {
      type: Date,
      default: Date.now
    },
    scraperVersion: {
      type: String,
      default: '1.0.0'
    },
    dataSource: {
      type: String,
      enum: ['blockchain.info', 'etherscan', 'tronscan'],
      required: true
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Essential indexes only
blockchainTransactionSchema.index({ network: 1, blockchain: 1, timestamp: -1 });
blockchainTransactionSchema.index({ walletAddress: 1, timestamp: -1 });

// Virtual for formatted amount
blockchainTransactionSchema.virtual('formattedAmount').get(function() {
  return `${this.amount.toFixed(4)} ${this.token.symbol}`;
});

// Virtual for formatted USD value
blockchainTransactionSchema.virtual('formattedUsdValue').get(function() {
  return this.usdValue ? `$${this.usdValue.toFixed(2)}` : 'N/A';
});

// Static method to get recent transactions
blockchainTransactionSchema.statics.getRecentTransactions = async function(networkId, limit = 50) {
  return await this.find({
    ...(networkId && { network: networkId }),
    transferType: 'incoming'
  })
  .sort({ timestamp: -1 })
  .limit(limit)
  .populate('network', 'name');
};

// Static method to get summary by network
blockchainTransactionSchema.statics.getNetworkSummary = async function(networkId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const pipeline = [
    {
      $match: {
        ...(networkId && { network: new mongoose.Types.ObjectId(networkId) }),
        timestamp: { $gte: startDate },
        transferType: 'incoming'
      }
    },
    {
      $group: {
        _id: {
          blockchain: '$blockchain',
          tokenSymbol: '$token.symbol'
        },
        totalAmount: { $sum: '$amount' },
        totalUsdValue: { $sum: '$usdValue' },
        transactionCount: { $sum: 1 },
        latestTransaction: { $max: '$timestamp' }
      }
    },
    {
      $sort: { totalUsdValue: -1 }
    }
  ];
  
  return await this.aggregate(pipeline);
};

module.exports = mongoose.model('BlockchainTransaction', blockchainTransactionSchema); 