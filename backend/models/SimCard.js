const mongoose = require('mongoose');

const simCardSchema = new mongoose.Schema({
  geo: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  operator: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  dateCharged: {
    type: Date,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'inactive',
    required: true,
    index: true
  },
  simNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 500
  },
  topUpLink: {
    type: String,
    trim: true,
    maxlength: 500
  },
  credentials: {
    username: {
      type: String,
      trim: true,
      maxlength: 200
    },
    password: {
      type: String,
      trim: true,
      maxlength: 200
    }
  },
  // Gateway integration fields
  gateway: {
    enabled: {
      type: Boolean,
      default: false
    },
    gatewayId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GatewayDevice',
      index: true
    },
    port: {
      type: String, // e.g., "1A", "2B", "3C"
      sparse: true,
      index: true
    },
    slot: {
      type: Number, // 1, 2, 3, 4
      min: 1,
      max: 4
    },
    imei: {
      type: String,
      trim: true
    },
    imsi: {
      type: String,
      trim: true
    },
    iccid: {
      type: String,
      trim: true
    },
    balance: {
      type: Number,
      default: 0
    },
    operatorId: {
      type: String, // e.g., "46000"
      trim: true
    },
    deviceStatus: {
      type: String,
      enum: [
        'no_sim',           // 0
        'idle',             // 1
        'registering',      // 2
        'registered',       // 3
        'call_connected',   // 4
        'no_balance',       // 5
        'register_failed',  // 6
        'locked_device',    // 7
        'locked_operator',  // 8
        'recognize_error',  // 9
        'card_detected',    // 11
        'user_locked',      // 12
        'port_intercalling',// 13
        'intercalling_holding' // 14
      ],
      default: 'no_sim'
    },
    lastStatusUpdate: {
      type: Date
    },
    statusCode: {
      type: Number // Raw status code from gateway
    },
    isLocked: {
      type: Boolean,
      default: false
    }
  },
  // SMS statistics
  smsStats: {
    received: {
      type: Number,
      default: 0
    },
    sent: {
      type: Number,
      default: 0
    },
    sentOk: {
      type: Number,
      default: 0
    },
    sentFailed: {
      type: Number,
      default: 0
    },
    lastReset: {
      type: Date,
      default: Date.now
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient querying
simCardSchema.index({ geo: 1, operator: 1 });
simCardSchema.index({ status: 1, dateCharged: -1 });
simCardSchema.index({ createdBy: 1 });

// Virtual for formatted date
simCardSchema.virtual('formattedDateCharged').get(function() {
  return this.dateCharged ? this.dateCharged.toISOString().split('T')[0] : null;
});

module.exports = mongoose.model('SimCard', simCardSchema);
