/**
 * User Activity Controller
 * 
 * Handles real-time activity tracking and performance analytics.
 * Receives activity data from frontend tracker and provides admin dashboard data.
 */

const UserActivity = require('../models/UserActivity');
const User = require('../models/User');

// In-memory store for real-time updates (Socket.IO will broadcast these)
const liveActivityCache = new Map();

// Evict stale entries every 5 minutes (handles users who disconnect without ending session)
setInterval(() => {
  const now = Date.now();
  const STALE_THRESHOLD = 10 * 60 * 1000; // 10 minutes without update
  for (const [key, val] of liveActivityCache) {
    if (val.lastActivityAt && now - new Date(val.lastActivityAt).getTime() > STALE_THRESHOLD) {
      liveActivityCache.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Start a new activity session
 * POST /api/user-activity/session/start
 */
exports.startSession = async (req, res) => {
  try {
    const { sessionId, userAgent, screenResolution, timezone, language, connectionType, connectionDownlink } = req.body;
    
    // End any previous live sessions for this user
    await UserActivity.updateMany(
      { user: req.user._id, isLive: true },
      { $set: { isLive: false, sessionEnd: new Date() } }
    );
    
    const activity = new UserActivity({
      user: req.user._id,
      sessionId,
      sessionStart: new Date(),
      isLive: true,
      currentPage: '/',
      userAgent,
      screenResolution,
      timezone,
      language,
      connectionType,
      connectionDownlink
    });
    
    await activity.save();
    
    // Update cache
    liveActivityCache.set(req.user._id.toString(), {
      sessionId: activity._id,
      userId: req.user._id,
      userName: req.user.fullName,
      userRole: req.user.role,
      currentPage: '/',
      isActive: true,
      isFocused: true,
      lastActivityAt: new Date(),
      sessionStart: activity.sessionStart
    });
    
    // Emit to admin room via Socket.IO
    if (req.io) {
      req.io.to('admin:performance').emit('user_session_started', {
        userId: req.user._id,
        userName: req.user.fullName,
        userRole: req.user.role,
        sessionId: activity._id,
        timestamp: new Date()
      });
    }
    
    res.status(201).json({
      success: true,
      sessionId: activity._id,
      message: 'Activity session started'
    });
  } catch (error) {
    console.error('Error starting activity session:', error);
    res.status(500).json({ success: false, message: 'Failed to start session' });
  }
};

/**
 * Update activity data (called periodically by frontend tracker)
 * POST /api/user-activity/update
 */
exports.updateActivity = async (req, res) => {
  try {
    const {
      sessionId,
      currentPage,
      currentPageTitle,
      isActive,
      isFocused,
      mouseMovements,
      keystrokes,
      clicks,
      scrollEvents,
      charactersTyped,
      activeTimeDelta,
      inactiveTimeDelta,
      focusedTimeDelta,
      unfocusedTimeDelta,
      snapshot,
      pageVisit,
      inactivityPeriod
    } = req.body;
    
    const updateData = {
      currentPage,
      currentPageTitle,
      isActive,
      isFocused,
      lastActivityAt: new Date()
    };
    
    const incrementData = {};
    if (mouseMovements) incrementData.totalMouseMovements = mouseMovements;
    if (keystrokes) incrementData.totalKeystrokes = keystrokes;
    if (clicks) incrementData.totalClicks = clicks;
    if (scrollEvents) incrementData.totalScrollEvents = scrollEvents;
    if (charactersTyped) incrementData.totalCharactersTyped = charactersTyped;
    if (activeTimeDelta) incrementData.totalActiveTime = activeTimeDelta;
    if (inactiveTimeDelta) incrementData.totalInactiveTime = inactiveTimeDelta;
    if (focusedTimeDelta) incrementData.totalFocusedTime = focusedTimeDelta;
    if (unfocusedTimeDelta) incrementData.totalUnfocusedTime = unfocusedTimeDelta;
    
    const pushData = {};
    if (snapshot) pushData.activitySnapshots = snapshot;
    if (pageVisit) pushData.pageVisits = pageVisit;
    if (inactivityPeriod) pushData.inactivityPeriods = inactivityPeriod;
    
    const updateQuery = { $set: updateData };
    if (Object.keys(incrementData).length > 0) {
      updateQuery.$inc = incrementData;
    }
    if (Object.keys(pushData).length > 0) {
      updateQuery.$push = pushData;
    }
    
    await UserActivity.findByIdAndUpdate(sessionId, updateQuery);
    
    // Update cache for real-time display
    const cacheData = liveActivityCache.get(req.user._id.toString()) || {};
    liveActivityCache.set(req.user._id.toString(), {
      ...cacheData,
      sessionId,
      userId: req.user._id,
      userName: req.user.fullName,
      userRole: req.user.role,
      currentPage,
      currentPageTitle,
      isActive,
      isFocused,
      lastActivityAt: new Date(),
      mouseMovements: (cacheData.mouseMovements || 0) + (mouseMovements || 0),
      keystrokes: (cacheData.keystrokes || 0) + (keystrokes || 0),
      clicks: (cacheData.clicks || 0) + (clicks || 0)
    });
    
    // Emit real-time update to admin room
    if (req.io) {
      req.io.to('admin:performance').emit('activity_update', {
        userId: req.user._id,
        userName: req.user.fullName,
        userRole: req.user.role,
        currentPage,
        currentPageTitle,
        isActive,
        isFocused,
        lastActivityAt: new Date(),
        mouseMovements,
        keystrokes,
        clicks
      });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating activity:', error);
    res.status(500).json({ success: false, message: 'Failed to update activity' });
  }
};

/**
 * End activity session
 * POST /api/user-activity/session/end
 */
exports.endSession = async (req, res) => {
  try {
    const { sessionId, finalStats } = req.body;
    
    const updateData = {
      isLive: false,
      sessionEnd: new Date()
    };
    
    if (finalStats) {
      if (finalStats.typingSpeed) updateData.typingSpeed = finalStats.typingSpeed;
    }
    
    await UserActivity.findByIdAndUpdate(sessionId, updateData);
    
    // Remove from cache
    liveActivityCache.delete(req.user._id.toString());
    
    // Emit to admin room
    if (req.io) {
      req.io.to('admin:performance').emit('user_session_ended', {
        userId: req.user._id,
        userName: req.user.fullName,
        sessionId,
        timestamp: new Date()
      });
    }
    
    res.json({ success: true, message: 'Session ended' });
  } catch (error) {
    console.error('Error ending activity session:', error);
    res.status(500).json({ success: false, message: 'Failed to end session' });
  }
};

/**
 * Get all live users with their current activity (Admin only)
 * GET /api/user-activity/live
 */
exports.getLiveUsers = async (req, res) => {
  try {
    // Get from database for accuracy
    const liveActivities = await UserActivity.find({ isLive: true })
      .populate('user', 'fullName email role fourDigitCode')
      .sort({ lastActivityAt: -1 });
    
    const liveUsers = liveActivities.map(activity => ({
      userId: activity.user._id,
      userName: activity.user.fullName,
      userEmail: activity.user.email,
      userRole: activity.user.role,
      fourDigitCode: activity.user.fourDigitCode,
      sessionId: activity._id,
      sessionStart: activity.sessionStart,
      currentPage: activity.currentPage,
      currentPageTitle: activity.currentPageTitle,
      isActive: activity.isActive,
      isFocused: activity.isFocused,
      lastActivityAt: activity.lastActivityAt,
      totalMouseMovements: activity.totalMouseMovements,
      totalKeystrokes: activity.totalKeystrokes,
      totalClicks: activity.totalClicks,
      totalScrollEvents: activity.totalScrollEvents,
      totalActiveTime: activity.totalActiveTime,
      totalInactiveTime: activity.totalInactiveTime,
      engagementScore: activity.engagementScore,
      sessionDuration: Date.now() - new Date(activity.sessionStart).getTime()
    }));
    
    res.json({ success: true, data: liveUsers, count: liveUsers.length });
  } catch (error) {
    console.error('Error getting live users:', error);
    res.status(500).json({ success: false, message: 'Failed to get live users' });
  }
};

/**
 * Get detailed session data for a specific user (Admin only)
 * GET /api/user-activity/user/:userId/sessions
 */
exports.getUserSessions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10, page = 1 } = req.query;
    
    const sessions = await UserActivity.find({ user: userId })
      .sort({ sessionStart: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const total = await UserActivity.countDocuments({ user: userId });
    
    res.json({
      success: true,
      data: sessions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error getting user sessions:', error);
    res.status(500).json({ success: false, message: 'Failed to get user sessions' });
  }
};

/**
 * Get current live session details for a user (Admin only)
 * GET /api/user-activity/user/:userId/live
 */
exports.getUserLiveSession = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const session = await UserActivity.findOne({ user: userId, isLive: true })
      .populate('user', 'fullName email role');
    
    if (!session) {
      return res.json({ success: true, data: null, message: 'User is not currently active' });
    }
    
    res.json({ success: true, data: session });
  } catch (error) {
    console.error('Error getting user live session:', error);
    res.status(500).json({ success: false, message: 'Failed to get live session' });
  }
};

/**
 * Get performance dashboard stats (Admin only)
 * GET /api/user-activity/dashboard
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Get current live count
    const liveCount = await UserActivity.countDocuments({ isLive: true });
    
    // Get today's session stats
    const todayStats = await UserActivity.aggregate([
      {
        $match: {
          sessionStart: { $gte: today, $lt: tomorrow }
        }
      },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          uniqueUsers: { $addToSet: '$user' },
          totalActiveTime: { $sum: '$totalActiveTime' },
          totalInactiveTime: { $sum: '$totalInactiveTime' },
          avgEngagement: { $avg: '$engagementScore' },
          totalMouseMovements: { $sum: '$totalMouseMovements' },
          totalKeystrokes: { $sum: '$totalKeystrokes' },
          totalClicks: { $sum: '$totalClicks' }
        }
      },
      {
        $project: {
          totalSessions: 1,
          uniqueUsers: { $size: '$uniqueUsers' },
          totalActiveTime: 1,
          totalInactiveTime: 1,
          avgEngagement: { $round: ['$avgEngagement', 1] },
          totalMouseMovements: 1,
          totalKeystrokes: 1,
          totalClicks: 1
        }
      }
    ]);
    
    // Get per-user stats for today
    const userStats = await UserActivity.aggregate([
      {
        $match: {
          sessionStart: { $gte: today, $lt: tomorrow }
        }
      },
      {
        $group: {
          _id: '$user',
          sessions: { $sum: 1 },
          totalActiveTime: { $sum: '$totalActiveTime' },
          totalInactiveTime: { $sum: '$totalInactiveTime' },
          avgEngagement: { $avg: '$engagementScore' },
          lastActivity: { $max: '$lastActivityAt' },
          isCurrentlyLive: { $max: { $cond: ['$isLive', 1, 0] } }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          userId: '$_id',
          userName: '$user.fullName',
          userEmail: '$user.email',
          userRole: '$user.role',
          fourDigitCode: '$user.fourDigitCode',
          sessions: 1,
          totalActiveTime: 1,
          totalInactiveTime: 1,
          avgEngagement: { $round: ['$avgEngagement', 1] },
          lastActivity: 1,
          isCurrentlyLive: { $eq: ['$isCurrentlyLive', 1] }
        }
      },
      {
        $sort: { isCurrentlyLive: -1, lastActivity: -1 }
      }
    ]);
    
    // Get hourly activity for chart
    const hourlyActivity = await UserActivity.aggregate([
      {
        $match: {
          sessionStart: { $gte: today, $lt: tomorrow }
        }
      },
      {
        $unwind: {
          path: '$activitySnapshots',
          preserveNullAndEmptyArrays: false
        }
      },
      {
        $group: {
          _id: { $hour: '$activitySnapshots.timestamp' },
          activeUsers: { $addToSet: '$user' },
          totalMouseMovements: { $sum: '$activitySnapshots.mouseMovements' },
          totalKeystrokes: { $sum: '$activitySnapshots.keystrokes' }
        }
      },
      {
        $project: {
          hour: '$_id',
          activeUsers: { $size: '$activeUsers' },
          totalMouseMovements: 1,
          totalKeystrokes: 1
        }
      },
      {
        $sort: { hour: 1 }
      }
    ]);
    
    // Fill in missing hours
    const hourlyData = [];
    for (let h = 0; h < 24; h++) {
      const found = hourlyActivity.find(x => x.hour === h);
      hourlyData.push({
        hour: h,
        activeUsers: found?.activeUsers || 0,
        mouseMovements: found?.totalMouseMovements || 0,
        keystrokes: found?.totalKeystrokes || 0
      });
    }
    
    res.json({
      success: true,
      data: {
        live: {
          count: liveCount
        },
        today: todayStats[0] || {
          totalSessions: 0,
          uniqueUsers: 0,
          totalActiveTime: 0,
          totalInactiveTime: 0,
          avgEngagement: 0
        },
        userStats,
        hourlyActivity: hourlyData
      }
    });
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    res.status(500).json({ success: false, message: 'Failed to get dashboard stats' });
  }
};

/**
 * Get historical data for a specific user (Admin only)
 * GET /api/user-activity/user/:userId/history
 */
exports.getUserHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { days = 7 } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    startDate.setHours(0, 0, 0, 0);
    
    const dailyStats = await UserActivity.aggregate([
      {
        $match: {
          user: new require('mongoose').Types.ObjectId(userId),
          sessionStart: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$sessionStart' }
          },
          sessions: { $sum: 1 },
          totalActiveTime: { $sum: '$totalActiveTime' },
          totalInactiveTime: { $sum: '$totalInactiveTime' },
          avgEngagement: { $avg: '$engagementScore' },
          totalMouseMovements: { $sum: '$totalMouseMovements' },
          totalKeystrokes: { $sum: '$totalKeystrokes' },
          totalClicks: { $sum: '$totalClicks' },
          pagesVisited: { $sum: { $size: '$pageVisits' } }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    res.json({ success: true, data: dailyStats });
  } catch (error) {
    console.error('Error getting user history:', error);
    res.status(500).json({ success: false, message: 'Failed to get user history' });
  }
};

/**
 * Get page analytics (Admin only)
 * GET /api/user-activity/analytics/pages
 */
exports.getPageAnalytics = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    const pageStats = await UserActivity.aggregate([
      {
        $match: {
          sessionStart: { $gte: startDate }
        }
      },
      {
        $unwind: '$pageVisits'
      },
      {
        $group: {
          _id: '$pageVisits.path',
          visits: { $sum: 1 },
          uniqueUsers: { $addToSet: '$user' },
          avgDuration: { $avg: '$pageVisits.duration' },
          avgScrollDepth: { $avg: '$pageVisits.scrollDepth' },
          totalInteractions: { $sum: '$pageVisits.interactions' }
        }
      },
      {
        $project: {
          path: '$_id',
          visits: 1,
          uniqueUsers: { $size: '$uniqueUsers' },
          avgDuration: { $round: ['$avgDuration', 0] },
          avgScrollDepth: { $round: ['$avgScrollDepth', 1] },
          totalInteractions: 1
        }
      },
      {
        $sort: { visits: -1 }
      },
      {
        $limit: 20
      }
    ]);
    
    res.json({ success: true, data: pageStats });
  } catch (error) {
    console.error('Error getting page analytics:', error);
    res.status(500).json({ success: false, message: 'Failed to get page analytics' });
  }
};

// Export cache for Socket.IO handlers
exports.liveActivityCache = liveActivityCache;

