const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
    select: false
  },
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['admin', 'affiliate_manager', 'agent', 'pending_approval', 'lead_manager', 'refunds_manager', 'inventory_manager'],
    default: 'pending_approval',
    required: true
  },
  leadManagerStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'not_applicable'],
    default: 'not_applicable'
  },
  leadManagerApprovedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  leadManagerApprovedAt: {
    type: Date,
    default: null
  },
  fourDigitCode: {
    type: String,
    validate: {
      validator: function (v) {
        if (this.role === 'agent') {
          return v && v.length === 4 && /^\d{4}$/.test(v);
        }
        return true;
      },
      message: 'Agents must have a 4-digit code'
    },
  },
  permissions: {
    canCreateOrders: { type: Boolean, default: true },
    canManageLeads: { type: Boolean, default: false },
    canManageRefunds: { type: Boolean, default: false },
    canManageSimCards: { type: Boolean, default: false }
  },
  isActive: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  eulaAccepted: {
    type: Boolean,
    default: false
  },
  // Admin-managed linked accounts for account switching
  linkedAccounts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // The primary account that this account belongs to (for grouping)
  primaryAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // Two-Factor Authentication fields
  twoFactorSecret: {
    type: String,
    select: false, // Don't include in normal queries
    default: null
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorBackupCodes: {
    type: [String],
    select: false, // Don't include in normal queries
    default: []
  },
  // Session invalidation - tokens issued before this timestamp are rejected
  tokenInvalidatedAt: {
    type: Date,
    default: null
  },
  // QR Code Authentication - Device binding for admin
  // The registered device ID that can approve QR logins
  qrAuthDeviceId: {
    type: String,
    default: null,
    select: false // Don't include in normal queries for security
  },
  // Device info for the registered device (for display/verification)
  qrAuthDeviceInfo: {
    type: String,
    default: null
  },
  // When the device was registered
  qrAuthDeviceRegisteredAt: {
    type: Date,
    default: null
  },
  // Whether QR auth is enabled (alternative to TOTP 2FA)
  qrAuthEnabled: {
    type: Boolean,
    default: false
  },
  // User preferences (UI settings, copy preferences, etc.)
  preferences: {
    // Copy preferences for orders page
    ordersCopyConfig: {
      fields: {
        type: [String],
        default: ["leadType", "fullName", "newEmail", "newPhone", "country"]
      },
      separator: {
        type: String,
        default: "\t"
      }
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});
userSchema.index({ email: 1 });
userSchema.index({ role: 1, status: 1 });
userSchema.index({ fourDigitCode: 1 });
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to hash backup codes before saving
userSchema.methods.hashBackupCode = async function (code) {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(code, salt);
};

// Method to verify backup code
userSchema.methods.verifyBackupCode = async function (candidateCode) {
  for (const hashedCode of this.twoFactorBackupCodes) {
    const isMatch = await bcrypt.compare(candidateCode, hashedCode);
    if (isMatch) {
      return hashedCode; // Return the matched code so it can be removed
    }
  }
  return null;
};

userSchema.methods.toJSON = function () {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.twoFactorSecret;
  delete userObject.twoFactorBackupCodes;
  return userObject;
};
module.exports = mongoose.model('User', userSchema);