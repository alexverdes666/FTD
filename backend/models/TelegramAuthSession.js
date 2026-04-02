const mongoose = require('mongoose');
const crypto = require('crypto');

const telegramAuthSessionSchema = new mongoose.Schema({
  // Unique session token
  sessionToken: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  // The user trying to log in or verify sensitive action
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Session type: 'login' or 'sensitive'
  type: {
    type: String,
    enum: ['login', 'sensitive'],
    default: 'login'
  },
  // Type of sensitive action being verified (only for type='sensitive')
  actionType: {
    type: String,
    default: null
  },
  // Session status
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'expired'],
    default: 'pending'
  },
  // Verification token returned after approval (used by sensitive action middleware)
  verificationToken: {
    type: String,
    default: null
  },
  // Whether the verification token has been used
  tokenUsed: {
    type: Boolean,
    default: false
  },
  // Telegram message ID (for updating the message after approve/reject)
  telegramMessageId: {
    type: Number,
    default: null
  },
  // Telegram chat ID where the message was sent
  telegramChatId: {
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
telegramAuthSessionSchema.statics.generateSessionToken = function() {
  return crypto.randomBytes(32).toString('hex');
};

// Generate a verification token (for after approval of sensitive actions)
telegramAuthSessionSchema.statics.generateVerificationToken = function() {
  return crypto.randomBytes(48).toString('hex');
};

// Create a new Telegram auth session
telegramAuthSessionSchema.statics.createSession = async function(userId, type, loginIP, loginUserAgent, actionType) {
  const sessionToken = this.generateSessionToken();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  const session = await this.create({
    sessionToken,
    userId,
    type: type || 'login',
    actionType: actionType || null,
    loginIP,
    loginUserAgent,
    expiresAt
  });

  return session;
};

// Find and validate a session
telegramAuthSessionSchema.statics.findValidSession = async function(sessionToken) {
  const session = await this.findOne({
    sessionToken,
    status: 'pending',
    expiresAt: { $gt: new Date() }
  }).populate('userId', 'email fullName telegramChatId');

  return session;
};

// Approve a session
telegramAuthSessionSchema.methods.approve = async function() {
  this.status = 'approved';
  this.resolvedAt = new Date();
  // Generate verification token for sensitive action sessions
  if (this.type === 'sensitive') {
    this.verificationToken = this.constructor.generateVerificationToken();
  }
  await this.save();
  return this;
};

// Reject a session
telegramAuthSessionSchema.methods.reject = async function(reason) {
  this.status = 'rejected';
  this.resolvedAt = new Date();
  await this.save();
  return this;
};

module.exports = mongoose.model('TelegramAuthSession', telegramAuthSessionSchema);
