/**
 * User Activity Model
 * 
 * Stores real-time activity data for performance tracking.
 * Each document represents an activity session or snapshot.
 */

const mongoose = require('mongoose');

const pageVisitSchema = new mongoose.Schema({
  path: { type: String, required: true },
  title: { type: String },
  enteredAt: { type: Date, required: true },
  leftAt: { type: Date },
  duration: { type: Number, default: 0 }, // milliseconds
  scrollDepth: { type: Number, default: 0 }, // percentage
  interactions: { type: Number, default: 0 } // clicks, keypresses on page
}, { _id: false });

const activitySnapshotSchema = new mongoose.Schema({
  timestamp: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  isFocused: { type: Boolean, default: true },
  mouseMovements: { type: Number, default: 0 },
  keystrokes: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  scrollEvents: { type: Number, default: 0 },
  currentPage: { type: String }
}, { _id: false });

const userActivitySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  
  // Session info
  sessionStart: { type: Date, required: true },
  sessionEnd: { type: Date },
  isLive: { type: Boolean, default: true, index: true },
  
  // Current state (updated in real-time)
  currentPage: { type: String },
  currentPageTitle: { type: String },
  isActive: { type: Boolean, default: true },
  isFocused: { type: Boolean, default: true },
  lastActivityAt: { type: Date, default: Date.now },
  
  // Cumulative metrics for the session
  totalMouseMovements: { type: Number, default: 0 },
  totalKeystrokes: { type: Number, default: 0 },
  totalClicks: { type: Number, default: 0 },
  totalScrollEvents: { type: Number, default: 0 },
  totalActiveTime: { type: Number, default: 0 }, // milliseconds user was active
  totalInactiveTime: { type: Number, default: 0 }, // milliseconds user was inactive
  totalFocusedTime: { type: Number, default: 0 }, // milliseconds window was focused
  totalUnfocusedTime: { type: Number, default: 0 }, // milliseconds window was unfocused/blurred
  
  // Typing analysis (characters typed, not passwords/sensitive data)
  typingSpeed: { type: Number, default: 0 }, // chars per minute average
  totalCharactersTyped: { type: Number, default: 0 },
  
  // Page visits during session
  pageVisits: [pageVisitSchema],
  
  // Activity timeline (snapshots every 10 seconds for graphing)
  activitySnapshots: [activitySnapshotSchema],
  
  // Inactivity periods (gaps > 30 seconds)
  inactivityPeriods: [{
    startedAt: { type: Date, required: true },
    endedAt: { type: Date },
    duration: { type: Number } // milliseconds
  }],
  
  // Device/browser info
  userAgent: { type: String },
  screenResolution: { type: String },
  timezone: { type: String },
  language: { type: String },
  
  // Connection quality
  connectionType: { type: String }, // wifi, cellular, ethernet
  connectionDownlink: { type: Number }, // Mbps
  
  // Performance indicators
  idlePercentage: { type: Number, default: 0 }, // % of time idle
  focusPercentage: { type: Number, default: 0 }, // % of time focused
  engagementScore: { type: Number, default: 0 }, // 0-100 calculated score
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient querying
userActivitySchema.index({ user: 1, sessionStart: -1 });
userActivitySchema.index({ isLive: 1, lastActivityAt: -1 });
userActivitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }); // Auto-delete after 30 days

// Virtual for session duration
userActivitySchema.virtual('sessionDuration').get(function() {
  const end = this.sessionEnd || new Date();
  return end - this.sessionStart;
});

// Virtual for activity rate (interactions per minute)
userActivitySchema.virtual('activityRate').get(function() {
  const durationMinutes = this.sessionDuration / 60000;
  if (durationMinutes === 0) return 0;
  const totalInteractions = this.totalMouseMovements + this.totalKeystrokes + this.totalClicks + this.totalScrollEvents;
  return Math.round(totalInteractions / durationMinutes);
});

// Calculate engagement score before saving
userActivitySchema.pre('save', function(next) {
  const duration = this.sessionDuration;
  
  if (duration > 0) {
    // Calculate idle percentage
    this.idlePercentage = Math.round((this.totalInactiveTime / duration) * 100);
    
    // Calculate focus percentage
    this.focusPercentage = Math.round((this.totalFocusedTime / duration) * 100);
    
    // Calculate engagement score (weighted formula)
    // High mouse movement + keystrokes + focus = higher score
    const activityRate = this.activityRate || 0;
    const focusWeight = this.focusPercentage * 0.3;
    const activeWeight = (100 - this.idlePercentage) * 0.4;
    const interactionWeight = Math.min(activityRate / 10, 30); // Cap at 30
    
    this.engagementScore = Math.round(focusWeight + activeWeight + interactionWeight);
  }
  
  next();
});

// Static method to get live users
userActivitySchema.statics.getLiveUsers = async function() {
  return this.find({ isLive: true })
    .populate('user', 'fullName email role')
    .sort({ lastActivityAt: -1 });
};

// Static method to get user's recent sessions
userActivitySchema.statics.getUserSessions = async function(userId, limit = 10) {
  return this.find({ user: userId })
    .sort({ sessionStart: -1 })
    .limit(limit);
};

// Static method to aggregate daily stats for a user
userActivitySchema.statics.getDailyStats = async function(userId, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const result = await this.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        sessionStart: { $gte: startOfDay, $lte: endOfDay }
      }
    },
    {
      $group: {
        _id: null,
        totalSessions: { $sum: 1 },
        totalActiveTime: { $sum: '$totalActiveTime' },
        totalInactiveTime: { $sum: '$totalInactiveTime' },
        totalMouseMovements: { $sum: '$totalMouseMovements' },
        totalKeystrokes: { $sum: '$totalKeystrokes' },
        totalClicks: { $sum: '$totalClicks' },
        avgEngagementScore: { $avg: '$engagementScore' },
        avgTypingSpeed: { $avg: '$typingSpeed' },
        pagesVisited: { $sum: { $size: '$pageVisits' } }
      }
    }
  ]);
  
  return result[0] || null;
};

module.exports = mongoose.model('UserActivity', userActivitySchema);

