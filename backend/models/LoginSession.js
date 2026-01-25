/**
 * Login Session Model
 *
 * Tracks user login sessions across devices.
 * A session is created when user logs in and ends when they logout or get kicked.
 */

const mongoose = require('mongoose');

const loginSessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Session identifier (matches JWT token's jti or iat for invalidation)
  tokenIssuedAt: {
    type: Date,
    required: true
  },

  // Session state
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },

  // Timestamps
  loginAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  lastActivityAt: {
    type: Date,
    default: Date.now
  },
  logoutAt: {
    type: Date,
    default: null
  },

  // How the session ended
  endReason: {
    type: String,
    enum: ['logout', 'kicked', 'expired', 'token_invalidated', null],
    default: null
  },

  // Device information
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String
  },
  device: {
    type: {
      type: String,  // desktop, mobile, tablet
      default: 'desktop'
    },
    browser: String,
    browserVersion: String,
    os: String,
    osVersion: String
  },

  // Location (if available from IP)
  location: {
    country: String,
    city: String
  }

}, {
  timestamps: true
});

// Indexes for efficient querying
loginSessionSchema.index({ user: 1, isActive: 1 });
loginSessionSchema.index({ user: 1, loginAt: -1 });
loginSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // Auto-delete after 90 days

// Static method to create a session on login
loginSessionSchema.statics.createSession = async function(userId, tokenIssuedAt, req) {
  const UAParser = require('ua-parser-js');
  const parser = new UAParser(req.headers['user-agent']);
  const result = parser.getResult();

  // Get client IP
  const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.ip
    || req.connection?.remoteAddress
    || 'unknown';

  const session = new this({
    user: userId,
    tokenIssuedAt: new Date(tokenIssuedAt * 1000), // Convert from seconds to ms
    loginAt: new Date(),
    lastActivityAt: new Date(),
    ipAddress,
    userAgent: req.headers['user-agent'],
    device: {
      type: result.device.type || 'desktop',
      browser: result.browser.name || 'Unknown',
      browserVersion: result.browser.version || '',
      os: result.os.name || 'Unknown',
      osVersion: result.os.version || ''
    }
  });

  await session.save();
  return session;
};

// Static method to get active sessions for a user
loginSessionSchema.statics.getActiveSessions = async function(userId) {
  return this.find({ user: userId, isActive: true })
    .sort({ lastActivityAt: -1 });
};

// Static method to get session history for a user
loginSessionSchema.statics.getSessionHistory = async function(userId, limit = 20) {
  return this.find({ user: userId, isActive: false })
    .sort({ logoutAt: -1 })
    .limit(limit);
};

// Static method to end a specific session
loginSessionSchema.statics.endSession = async function(sessionId, reason = 'kicked') {
  return this.findByIdAndUpdate(sessionId, {
    isActive: false,
    logoutAt: new Date(),
    endReason: reason
  });
};

// Static method to end all sessions for a user except one
loginSessionSchema.statics.endAllSessionsExcept = async function(userId, exceptSessionId, reason = 'kicked') {
  const query = { user: userId, isActive: true };
  if (exceptSessionId) {
    query._id = { $ne: exceptSessionId };
  }

  return this.updateMany(query, {
    isActive: false,
    logoutAt: new Date(),
    endReason: reason
  });
};

// Static method to update last activity
loginSessionSchema.statics.updateActivity = async function(userId, tokenIssuedAt) {
  // Find session by user and token issue time
  return this.findOneAndUpdate(
    {
      user: userId,
      isActive: true,
      tokenIssuedAt: new Date(tokenIssuedAt * 1000)
    },
    { lastActivityAt: new Date() },
    { new: true }
  );
};

// Instance method to format for API response
loginSessionSchema.methods.toAPIResponse = function(isCurrentSession = false) {
  return {
    id: this._id,
    loginAt: this.loginAt,
    lastActivityAt: this.lastActivityAt,
    logoutAt: this.logoutAt,
    ipAddress: this.ipAddress,
    device: {
      type: this.device.type,
      browser: `${this.device.browser} ${this.device.browserVersion}`.trim(),
      os: `${this.device.os} ${this.device.osVersion}`.trim()
    },
    location: this.location,
    isActive: this.isActive,
    endReason: this.endReason,
    isCurrent: isCurrentSession
  };
};

module.exports = mongoose.model('LoginSession', loginSessionSchema);
