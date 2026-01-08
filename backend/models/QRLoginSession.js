const mongoose = require('mongoose');
const crypto = require('crypto');

const qrLoginSessionSchema = new mongoose.Schema({
  // Unique session token for the QR code
  sessionToken: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  // The user trying to log in
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Session status
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'expired'],
    default: 'pending'
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
  // IP address of the login request
  loginIP: {
    type: String,
    default: null
  },
  // User agent of the login request
  loginUserAgent: {
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
qrLoginSessionSchema.statics.generateSessionToken = function() {
  return crypto.randomBytes(32).toString('hex');
};

// Create a new QR login session
qrLoginSessionSchema.statics.createSession = async function(userId, loginIP, loginUserAgent) {
  const sessionToken = this.generateSessionToken();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  const session = await this.create({
    sessionToken,
    userId,
    loginIP,
    loginUserAgent,
    expiresAt
  });

  return session;
};

// Find and validate a session
qrLoginSessionSchema.statics.findValidSession = async function(sessionToken) {
  const session = await this.findOne({
    sessionToken,
    status: 'pending',
    expiresAt: { $gt: new Date() }
  }).populate('userId', 'email fullName qrAuthDeviceId');

  return session;
};

// Approve a session
qrLoginSessionSchema.methods.approve = async function(deviceId, deviceInfo) {
  this.status = 'approved';
  this.approvedByDeviceId = deviceId;
  this.approvedByDeviceInfo = deviceInfo;
  this.resolvedAt = new Date();
  await this.save();
  return this;
};

// Reject a session
qrLoginSessionSchema.methods.reject = async function(reason) {
  this.status = 'rejected';
  this.resolvedAt = new Date();
  await this.save();
  return this;
};

module.exports = mongoose.model('QRLoginSession', qrLoginSessionSchema);

