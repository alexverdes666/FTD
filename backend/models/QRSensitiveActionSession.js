const mongoose = require('mongoose');
const crypto = require('crypto');

const qrSensitiveActionSessionSchema = new mongoose.Schema({
  // Unique session token for the QR code
  sessionToken: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  // The user requesting the sensitive action
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Type of sensitive action being verified
  actionType: {
    type: String,
    required: true,
    default: 'Sensitive Action'
  },
  // Session status
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'expired'],
    default: 'pending'
  },
  // Verification token returned after approval (used by middleware)
  verificationToken: {
    type: String,
    default: null
  },
  // Whether the verification token has been used
  tokenUsed: {
    type: Boolean,
    default: false
  },
  // Device that approved/rejected the session (if any)
  approvedByDeviceId: {
    type: String,
    default: null
  },
  // Device info of the approving device
  approvedByDeviceInfo: {
    type: String,
    default: null
  },
  // IP address of the request
  requestIP: {
    type: String,
    default: null
  },
  // User agent of the request
  requestUserAgent: {
    type: String,
    default: null
  },
  // Expiration time (5 minutes from creation)
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 } // TTL index - MongoDB will auto-delete expired documents
  },
  // When the session was approved/rejected
  resolvedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Generate a secure session token
qrSensitiveActionSessionSchema.statics.generateSessionToken = function() {
  return crypto.randomBytes(32).toString('hex');
};

// Generate a verification token (for after approval)
qrSensitiveActionSessionSchema.statics.generateVerificationToken = function() {
  return crypto.randomBytes(48).toString('hex');
};

// Create a new QR sensitive action session
qrSensitiveActionSessionSchema.statics.createSession = async function(userId, actionType, requestIP, requestUserAgent) {
  const sessionToken = this.generateSessionToken();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  const session = await this.create({
    sessionToken,
    userId,
    actionType,
    requestIP,
    requestUserAgent,
    expiresAt
  });

  return session;
};

// Find and validate a session
qrSensitiveActionSessionSchema.statics.findValidSession = async function(sessionToken) {
  const session = await this.findOne({
    sessionToken,
    status: 'pending',
    expiresAt: { $gt: new Date() }
  });
  return session;
};

// Approve the session
qrSensitiveActionSessionSchema.methods.approve = async function(deviceId, deviceInfo) {
  this.status = 'approved';
  this.approvedByDeviceId = deviceId;
  this.approvedByDeviceInfo = deviceInfo || null;
  this.resolvedAt = new Date();
  // Generate a verification token that will be used by the sensitive action middleware
  this.verificationToken = this.constructor.generateVerificationToken();
  await this.save();
  return this;
};

// Reject the session
qrSensitiveActionSessionSchema.methods.reject = async function(reason) {
  this.status = 'rejected';
  this.resolvedAt = new Date();
  await this.save();
  return this;
};

module.exports = mongoose.model('QRSensitiveActionSession', qrSensitiveActionSessionSchema);

