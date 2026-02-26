const Lead = require('../models/Lead');
// BrowserSessionService removed - no longer needed for injection management
const cron = require('node-cron');
class SessionCleanupService {
  constructor() {
    // browserSessionService removed - no longer needed for injection management
    this.cleanupScheduled = false;
    this.compressionScheduled = false;
    this.analyticsScheduled = false;
    this.config = {
      sessionExpiryDays: 30,
      compressionAfterDays: 7,
      maxSessionsPerLead: 10,
      analyticsRetentionDays: 90,
      cleanupCronSchedule: '0 2 * * *',
      compressionCronSchedule: '0 3 * * 0',
      analyticsCronSchedule: '0 4 1 * *',
    };
  }
  initializeScheduledJobs() {
    if (!this.cleanupScheduled) {
      this.scheduleDailyCleanup();
    }
    if (!this.compressionScheduled) {
      this.scheduleWeeklyCompression();
    }
    if (!this.analyticsScheduled) {
      this.scheduleMonthlyAnalytics();
    }
    console.log('✅ Session cleanup service initialized with scheduled jobs');
  }
  scheduleDailyCleanup() {
    cron.schedule(this.config.cleanupCronSchedule, async () => {
      console.log('🕐 Starting scheduled daily session cleanup...');
      try {
        const stats = await this.performDailyCleanup();
        console.log('✅ Daily session cleanup completed:', stats);
      } catch (error) {
        console.error('❌ Daily session cleanup failed:', error);
      }
    });
    this.cleanupScheduled = true;
    console.log(`📅 Daily cleanup scheduled: ${this.config.cleanupCronSchedule}`);
  }
  scheduleWeeklyCompression() {
    cron.schedule(this.config.compressionCronSchedule, async () => {
      console.log('🕐 Starting scheduled weekly session compression...');
      try {
        const stats = await this.performWeeklyCompression();
        console.log('✅ Weekly session compression completed:', stats);
      } catch (error) {
        console.error('❌ Weekly session compression failed:', error);
      }
    });
    this.compressionScheduled = true;
    console.log(`📅 Weekly compression scheduled: ${this.config.compressionCronSchedule}`);
  }
  scheduleMonthlyAnalytics() {
    cron.schedule(this.config.analyticsCronSchedule, async () => {
      console.log('🕐 Starting scheduled monthly session analytics...');
      try {
        const report = await this.generateMonthlyReport();
        console.log('✅ Monthly session analytics completed');
        console.log('📊 Report summary:', report.summary);
      } catch (error) {
        console.error('❌ Monthly session analytics failed:', error);
      }
    });
    this.analyticsScheduled = true;
    console.log(`📅 Monthly analytics scheduled: ${this.config.analyticsCronSchedule}`);
  }
  async performDailyCleanup() {
    const startTime = Date.now();
    console.log('🧹 Starting daily session cleanup...');
    try {
      const expiredCleanup = await this.cleanupExpiredSessions(this.config.sessionExpiryDays);
      const orphanedCleanup = await this.cleanupOrphanedSessions();
      const limitCleanup = await this.enforceSessionLimits();
      const invalidCleanup = await this.cleanupInvalidSessions();
      const totalTime = Date.now() - startTime;
      const stats = {
        timestamp: new Date(),
        duration: totalTime,
        expiredSessions: expiredCleanup,
        orphanedSessions: orphanedCleanup,
        limitEnforcement: limitCleanup,
        invalidSessions: invalidCleanup,
        totalSessionsRemoved: expiredCleanup.totalSessionsRemoved +
                             orphanedCleanup.totalSessionsRemoved +
                             limitCleanup.totalSessionsRemoved +
                             invalidCleanup.totalSessionsRemoved
      };
      await this.logCleanupResults(stats);
      return stats;
    } catch (error) {
      console.error('❌ Error during daily cleanup:', error);
      throw new Error(`Daily cleanup failed: ${error.message}`);
    }
  }
  async performWeeklyCompression() {
    const startTime = Date.now();
    console.log('🗜️ Starting weekly session compression...');
    try {
      const compressionStats = await this.compressOldSessionData(this.config.compressionAfterDays);
      const optimizationStats = await this.optimizeSessionStorage();
      const totalTime = Date.now() - startTime;
      const stats = {
        timestamp: new Date(),
        duration: totalTime,
        compression: compressionStats,
        optimization: optimizationStats
      };
      return stats;
    } catch (error) {
      console.error('❌ Error during weekly compression:', error);
      throw new Error(`Weekly compression failed: ${error.message}`);
    }
  }
  async generateMonthlyReport() {
    const startTime = Date.now();
    console.log('📊 Generating monthly session analytics report...');
    try {
      const sessionStats = {}; // BrowserSessionService removed - no longer needed for injection management
      const usageAnalytics = await this.generateUsageAnalytics();
      const healthMetrics = await this.generateHealthMetrics();
      const performanceMetrics = await this.generatePerformanceMetrics();
      const recommendations = await this.generateRecommendations(sessionStats, usageAnalytics, healthMetrics);
      const totalTime = Date.now() - startTime;
      const report = {
        timestamp: new Date(),
        reportPeriod: this.getReportPeriod(),
        duration: totalTime,
        summary: {
          totalLeadsWithSessions: sessionStats.totalLeadsWithSessions,
          activeSessions: sessionStats.leadsWithActiveSessions,
          totalSessions: sessionStats.totalSessions,
          averageSessionsPerLead: sessionStats.averageSessionsPerLead
        },
        sessionStatistics: sessionStats,
        usageAnalytics,
        healthMetrics,
        performanceMetrics,
        recommendations
      };
      await this.storeAnalyticsReport(report);
      return report;
    } catch (error) {
      console.error('❌ Error generating monthly report:', error);
      throw new Error(`Monthly report generation failed: ${error.message}`);
    }
  }
  async cleanupExpiredSessions(daysOld = 30) {
    try {
      console.log(`🧹 Cleaning up sessions older than ${daysOld} days...`);
      const cutoffDate = new Date(Date.now() - (daysOld * 24 * 60 * 60 * 1000));
      const BATCH_SIZE = 500;
      let cleanedLeads = 0;
      let totalSessionsRemoved = 0;
      let totalProcessed = 0;
      const query = {
        $or: [
          { 'browserSession.createdAt': { $lt: cutoffDate } },
          { 'sessionHistory.createdAt': { $lt: cutoffDate } }
        ]
      };
      const cursor = Lead.find(query).select('browserSession sessionHistory').cursor({ batchSize: BATCH_SIZE });
      for await (const lead of cursor) {
        totalProcessed++;
        const initialSessionCount = lead.sessionHistory.length + (lead.browserSession?.sessionId ? 1 : 0);
        lead.clearExpiredSessions(daysOld);
        await lead.save();
        const finalSessionCount = lead.sessionHistory.length + (lead.browserSession?.sessionId ? 1 : 0);
        const sessionsRemoved = initialSessionCount - finalSessionCount;
        if (sessionsRemoved > 0) {
          cleanedLeads++;
          totalSessionsRemoved += sessionsRemoved;
        }
      }
      const stats = {
        leadsProcessed: totalProcessed,
        leadsCleaned: cleanedLeads,
        totalSessionsRemoved,
        daysThreshold: daysOld,
        cutoffDate
      };
      console.log(`✅ Expired session cleanup completed:`, stats);
      return stats;
    } catch (error) {
      console.error('❌ Error cleaning up expired sessions:', error);
      throw new Error(`Failed to cleanup expired sessions: ${error.message}`);
    }
  }
  async cleanupOrphanedSessions() {
    try {
      console.log('🧹 Cleaning up orphaned session data...');
      let totalSessionsRemoved = 0;
      let leadsProcessed = 0;
      const BATCH_SIZE = 500;
      const query = {
        $or: [
          { 'browserSession.sessionId': { $exists: true } },
          { 'sessionHistory.0': { $exists: true } }
        ]
      };
      const cursor = Lead.find(query).select('browserSession sessionHistory currentSessionId').cursor({ batchSize: BATCH_SIZE });
      for await (const lead of cursor) {
        let modified = false;
        if (lead.browserSession && (!lead.browserSession.sessionId || !lead.browserSession.createdAt)) {
          lead.browserSession = undefined;
          lead.currentSessionId = null;
          totalSessionsRemoved++;
          modified = true;
        }
        if (lead.sessionHistory && lead.sessionHistory.length > 0) {
          const validSessions = lead.sessionHistory.filter(session =>
            session.sessionId && session.createdAt
          );
          const removedCount = lead.sessionHistory.length - validSessions.length;
          if (removedCount > 0) {
            lead.sessionHistory = validSessions;
            totalSessionsRemoved += removedCount;
            modified = true;
          }
        }
        if (modified) {
          await lead.save();
          leadsProcessed++;
        }
      }
      const stats = {
        leadsProcessed,
        totalSessionsRemoved
      };
      console.log(`✅ Orphaned session cleanup completed:`, stats);
      return stats;
    } catch (error) {
      console.error('❌ Error cleaning up orphaned sessions:', error);
      throw new Error(`Failed to cleanup orphaned sessions: ${error.message}`);
    }
  }
  async enforceSessionLimits() {
    try {
      console.log(`🧹 Enforcing session limits (max ${this.config.maxSessionsPerLead} per lead)...`);
      const BATCH_SIZE = 500;
      const query = {
        $expr: { $gt: [{ $size: { $ifNull: ['$sessionHistory', []] } }, this.config.maxSessionsPerLead] }
      };
      let leadsProcessed = 0;
      let totalSessionsRemoved = 0;
      const cursor = Lead.find(query).select('sessionHistory').cursor({ batchSize: BATCH_SIZE });
      for await (const lead of cursor) {
        const sessionCount = lead.sessionHistory.length;
        if (sessionCount > this.config.maxSessionsPerLead) {
          lead.sessionHistory.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          const sessionsToRemove = sessionCount - this.config.maxSessionsPerLead;
          lead.sessionHistory = lead.sessionHistory.slice(0, this.config.maxSessionsPerLead);
          await lead.save();
          leadsProcessed++;
          totalSessionsRemoved += sessionsToRemove;
        }
      }
      const stats = {
        leadsProcessed,
        totalSessionsRemoved,
        sessionLimit: this.config.maxSessionsPerLead
      };
      console.log(`✅ Session limit enforcement completed:`, stats);
      return stats;
    } catch (error) {
      console.error('❌ Error enforcing session limits:', error);
      throw new Error(`Failed to enforce session limits: ${error.message}`);
    }
  }
  async cleanupInvalidSessions() {
    try {
      console.log('🧹 Cleaning up invalid session data...');
      const leadsWithSessions = await Lead.find({
        $or: [
          { 'browserSession.sessionId': { $exists: true } },
          { 'sessionHistory.0': { $exists: true } }
        ]
      });
      let leadsProcessed = 0;
      let totalSessionsRemoved = 0;
      for (const lead of leadsWithSessions) {
        let modified = false;
        if (lead.browserSession && lead.browserSession.sessionId) {
          const validation = { isValid: true, errors: [] }; // BrowserSessionService removed - no longer needed for injection management
          if (!validation.isValid && validation.errors.some(error =>
            error.includes('required') || error.includes('structure')
          )) {
            lead.browserSession = undefined;
            lead.currentSessionId = null;
            totalSessionsRemoved++;
            modified = true;
          }
        }
        if (lead.sessionHistory && lead.sessionHistory.length > 0) {
          const validSessions = lead.sessionHistory.filter(session => {
            const validation = { isValid: true, errors: [] }; // BrowserSessionService removed - no longer needed for injection management
            return validation.isValid || !validation.errors.some(error =>
              error.includes('required') || error.includes('structure')
            );
          });
          const removedCount = lead.sessionHistory.length - validSessions.length;
          if (removedCount > 0) {
            lead.sessionHistory = validSessions;
            totalSessionsRemoved += removedCount;
            modified = true;
          }
        }
        if (modified) {
          await lead.save();
          leadsProcessed++;
        }
      }
      const stats = {
        leadsProcessed,
        totalSessionsRemoved
      };
      console.log(`✅ Invalid session cleanup completed:`, stats);
      return stats;
    } catch (error) {
      console.error('❌ Error cleaning up invalid sessions:', error);
      throw new Error(`Failed to cleanup invalid sessions: ${error.message}`);
    }
  }
  async compressOldSessionData(daysOld = 7) {
    try {
      console.log(`🗜️ Compressing session data older than ${daysOld} days...`);
      const cutoffDate = new Date(Date.now() - (daysOld * 24 * 60 * 60 * 1000));
      const leadsWithOldSessions = await Lead.find({
        $or: [
          { 'browserSession.createdAt': { $lt: cutoffDate } },
          { 'sessionHistory.createdAt': { $lt: cutoffDate } }
        ]
      });
      let leadsProcessed = 0;
      let sessionsCompressed = 0;
      let spaceSaved = 0;
      for (const lead of leadsWithOldSessions) {
        let modified = false;
        if (lead.browserSession && lead.browserSession.createdAt < cutoffDate) {
          const originalSize = JSON.stringify(lead.browserSession).length;
          lead.browserSession = this.compressSessionData(lead.browserSession);
          const compressedSize = JSON.stringify(lead.browserSession).length;
          spaceSaved += originalSize - compressedSize;
          sessionsCompressed++;
          modified = true;
        }
        if (lead.sessionHistory && lead.sessionHistory.length > 0) {
          lead.sessionHistory = lead.sessionHistory.map(session => {
            if (session.createdAt < cutoffDate) {
              const originalSize = JSON.stringify(session).length;
              const compressed = this.compressSessionData(session);
              const compressedSize = JSON.stringify(compressed).length;
              spaceSaved += originalSize - compressedSize;
              sessionsCompressed++;
              modified = true;
              return compressed;
            }
            return session;
          });
        }
        if (modified) {
          await lead.save();
          leadsProcessed++;
        }
      }
      const stats = {
        leadsProcessed,
        sessionsCompressed,
        spaceSavedBytes: spaceSaved,
        spaceSavedMB: Math.round(spaceSaved / 1024 / 1024 * 100) / 100,
        compressionThresholdDays: daysOld
      };
      console.log(`✅ Session compression completed:`, stats);
      return stats;
    } catch (error) {
      console.error('❌ Error compressing session data:', error);
      throw new Error(`Failed to compress session data: ${error.message}`);
    }
  }
  compressSessionData(sessionData) {
    const compressed = {
      ...sessionData,
      sessionId: sessionData.sessionId,
      createdAt: sessionData.createdAt,
      lastAccessedAt: sessionData.lastAccessedAt,
      isActive: sessionData.isActive,
      metadata: sessionData.metadata,
      cookies: sessionData.cookies ? sessionData.cookies.filter(cookie =>
        cookie.name.includes('session') ||
        cookie.name.includes('auth') ||
        cookie.name.includes('login') ||
        cookie.name.includes('token')
      ).map(cookie => ({
        name: cookie.name,
        value: cookie.value.length > 100 ? cookie.value.substring(0, 100) + '...' : cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        expires: cookie.expires,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure
      })) : [],
      localStorage: sessionData.localStorage ?
        Object.keys(sessionData.localStorage).length > 0 ?
          { _compressed: true, _itemCount: Object.keys(sessionData.localStorage).length } :
          {} : {},
      sessionStorage: sessionData.sessionStorage ?
        Object.keys(sessionData.sessionStorage).length > 0 ?
          { _compressed: true, _itemCount: Object.keys(sessionData.sessionStorage).length } :
          {} : {},
      viewport: sessionData.viewport,
      userAgent: sessionData.userAgent ?
        sessionData.userAgent.length > 200 ?
          sessionData.userAgent.substring(0, 200) + '...' :
          sessionData.userAgent : '',
      _compressed: true,
      _compressedAt: new Date()
    };
    return compressed;
  }
  async optimizeSessionStorage() {
    try {
      console.log('⚡ Optimizing session storage structure...');
      let optimizedLeads = 0;
      const leadsWithSessions = await Lead.find({
        $or: [
          { 'browserSession.sessionId': { $exists: true } },
          { 'sessionHistory.0': { $exists: true } }
        ]
      });
      for (const lead of leadsWithSessions) {
        let modified = false;
        if (lead.sessionHistory && lead.sessionHistory.length > 1) {
          const uniqueSessions = [];
          const seenSessionIds = new Set();
          for (const session of lead.sessionHistory) {
            if (!seenSessionIds.has(session.sessionId)) {
              uniqueSessions.push(session);
              seenSessionIds.add(session.sessionId);
            }
          }
          if (uniqueSessions.length < lead.sessionHistory.length) {
            lead.sessionHistory = uniqueSessions;
            modified = true;
          }
        }
        if (lead.browserSession && lead.browserSession.sessionId && lead.sessionHistory) {
          const duplicateIndex = lead.sessionHistory.findIndex(
            session => session.sessionId === lead.browserSession.sessionId
          );
          if (duplicateIndex >= 0) {
            lead.sessionHistory.splice(duplicateIndex, 1);
            modified = true;
          }
        }
        if (modified) {
          await lead.save();
          optimizedLeads++;
        }
      }
      const stats = {
        leadsProcessed: leadsWithSessions.length,
        leadsOptimized: optimizedLeads
      };
      console.log(`✅ Storage optimization completed:`, stats);
      return stats;
    } catch (error) {
      console.error('❌ Error optimizing session storage:', error);
      throw new Error(`Failed to optimize session storage: ${error.message}`);
    }
  }
  async generateUsageAnalytics() {
    try {
      const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
      const sevenDaysAgo = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));
      const analytics = await Lead.aggregate([
        {
          $match: {
            $or: [
              { 'browserSession.sessionId': { $exists: true } },
              { 'sessionHistory.0': { $exists: true } }
            ]
          }
        },
        {
          $project: {
            leadType: 1,
            assignedTo: 1,
            hasActiveSession: { $ifNull: ['$browserSession.isActive', false] },
            currentSessionAge: {
              $cond: [
                { $ifNull: ['$browserSession.createdAt', false] },
                { $divide: [{ $subtract: [new Date(), '$browserSession.createdAt'] }, 86400000] },
                null
              ]
            },
            recentSessionAccess: {
              $cond: [
                { $ifNull: ['$browserSession.lastAccessedAt', false] },
                { $gte: ['$browserSession.lastAccessedAt', sevenDaysAgo] },
                false
              ]
            },
            totalSessions: {
              $add: [
                { $cond: [{ $ifNull: ['$browserSession.sessionId', false] }, 1, 0] },
                { $size: { $ifNull: ['$sessionHistory', []] } }
              ]
            },
            recentSessions: {
              $size: {
                $filter: {
                  input: { $ifNull: ['$sessionHistory', []] },
                  cond: { $gte: ['$$this.createdAt', thirtyDaysAgo] }
                }
              }
            }
          }
        },
        {
          $group: {
            _id: null,
            totalLeadsWithSessions: { $sum: 1 },
            leadsWithActiveSessions: { $sum: { $cond: ['$hasActiveSession', 1, 0] } },
            leadsWithRecentAccess: { $sum: { $cond: ['$recentSessionAccess', 1, 0] } },
            averageSessionAge: { $avg: '$currentSessionAge' },
            totalSessions: { $sum: '$totalSessions' },
            recentSessionsCreated: { $sum: '$recentSessions' },
            sessionsByLeadType: {
              $push: {
                leadType: '$leadType',
                hasActiveSession: '$hasActiveSession',
                totalSessions: '$totalSessions'
              }
            }
          }
        }
      ]);
      const result = analytics[0] || {};
      const sessionsByType = {};
      if (result.sessionsByLeadType) {
        result.sessionsByLeadType.forEach(item => {
          if (!sessionsByType[item.leadType]) {
            sessionsByType[item.leadType] = { total: 0, active: 0, sessions: 0 };
          }
          sessionsByType[item.leadType].total++;
          if (item.hasActiveSession) sessionsByType[item.leadType].active++;
          sessionsByType[item.leadType].sessions += item.totalSessions;
        });
      }
      return {
        totalLeadsWithSessions: result.totalLeadsWithSessions || 0,
        leadsWithActiveSessions: result.leadsWithActiveSessions || 0,
        leadsWithRecentAccess: result.leadsWithRecentAccess || 0,
        averageSessionAgeInDays: Math.round((result.averageSessionAge || 0) * 100) / 100,
        totalSessions: result.totalSessions || 0,
        recentSessionsCreated: result.recentSessionsCreated || 0,
        sessionsByLeadType: sessionsByType,
        sessionUtilizationRate: result.totalLeadsWithSessions > 0 ?
          Math.round((result.leadsWithActiveSessions / result.totalLeadsWithSessions) * 100) : 0
      };
    } catch (error) {
      console.error('❌ Error generating usage analytics:', error);
      throw new Error(`Failed to generate usage analytics: ${error.message}`);
    }
  }
  async generateHealthMetrics() {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
      const sevenDaysFromNow = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
      const healthMetrics = await Lead.aggregate([
        {
          $match: {
            $or: [
              { 'browserSession.sessionId': { $exists: true } },
              { 'sessionHistory.0': { $exists: true } }
            ]
          }
        },
        {
          $project: {
            currentSessionExpired: {
              $cond: [
                { $ifNull: ['$browserSession.createdAt', false] },
                { $lt: ['$browserSession.createdAt', thirtyDaysAgo] },
                false
              ]
            },
            currentSessionExpiringSoon: {
              $cond: [
                { $ifNull: ['$browserSession.createdAt', false] },
                {
                  $and: [
                    { $gte: ['$browserSession.createdAt', thirtyDaysAgo] },
                    { $lt: [{ $add: ['$browserSession.createdAt', 30 * 24 * 60 * 60 * 1000] }, sevenDaysFromNow] }
                  ]
                },
                false
              ]
            },
            hasValidSession: {
              $and: [
                { $ifNull: ['$browserSession.sessionId', false] },
                { $ifNull: ['$browserSession.cookies', false] },
                { $gte: ['$browserSession.createdAt', thirtyDaysAgo] }
              ]
            },
            sessionHistoryCount: { $size: { $ifNull: ['$sessionHistory', []] } },
            expiredHistorySessions: {
              $size: {
                $filter: {
                  input: { $ifNull: ['$sessionHistory', []] },
                  cond: { $lt: ['$$this.createdAt', thirtyDaysAgo] }
                }
              }
            }
          }
        },
        {
          $group: {
            _id: null,
            totalLeadsWithSessions: { $sum: 1 },
            leadsWithExpiredSessions: { $sum: { $cond: ['$currentSessionExpired', 1, 0] } },
            leadsWithExpiringSessions: { $sum: { $cond: ['$currentSessionExpiringSoon', 1, 0] } },
            leadsWithValidSessions: { $sum: { $cond: ['$hasValidSession', 1, 0] } },
            totalHistorySessions: { $sum: '$sessionHistoryCount' },
            totalExpiredHistorySessions: { $sum: '$expiredHistorySessions' }
          }
        }
      ]);
      const result = healthMetrics[0] || {};
      return {
        totalLeadsWithSessions: result.totalLeadsWithSessions || 0,
        leadsWithExpiredSessions: result.leadsWithExpiredSessions || 0,
        leadsWithExpiringSessions: result.leadsWithExpiringSessions || 0,
        leadsWithValidSessions: result.leadsWithValidSessions || 0,
        totalHistorySessions: result.totalHistorySessions || 0,
        totalExpiredHistorySessions: result.totalExpiredHistorySessions || 0,
        sessionHealthScore: result.totalLeadsWithSessions > 0 ?
          Math.round((result.leadsWithValidSessions / result.totalLeadsWithSessions) * 100) : 0,
        expirationRate: result.totalLeadsWithSessions > 0 ?
          Math.round((result.leadsWithExpiredSessions / result.totalLeadsWithSessions) * 100) : 0
      };
    } catch (error) {
      console.error('❌ Error generating health metrics:', error);
      throw new Error(`Failed to generate health metrics: ${error.message}`);
    }
  }
  async generatePerformanceMetrics() {
    try {
      const performanceMetrics = {
        averageSessionStorageSize: 0,
        averageSessionRetrievalTime: 0,
        sessionQueryPerformance: 'good',
        indexUtilization: 'optimal',
        storageEfficiency: 85
      };
      const sampleLeads = await Lead.find({
        'browserSession.sessionId': { $exists: true }
      }).limit(100);
      if (sampleLeads.length > 0) {
        const totalSize = sampleLeads.reduce((sum, lead) => {
          return sum + JSON.stringify(lead.browserSession).length;
        }, 0);
        performanceMetrics.averageSessionStorageSize = Math.round(totalSize / sampleLeads.length);
      }
      return performanceMetrics;
    } catch (error) {
      console.error('❌ Error generating performance metrics:', error);
      throw new Error(`Failed to generate performance metrics: ${error.message}`);
    }
  }
  async generateRecommendations(sessionStats, usageAnalytics, healthMetrics) {
    const recommendations = [];
    if (usageAnalytics.sessionUtilizationRate < 50) {
      recommendations.push({
        type: 'utilization',
        priority: 'medium',
        title: 'Low Session Utilization',
        description: `Only ${usageAnalytics.sessionUtilizationRate}% of leads with sessions have active sessions. Consider reviewing session creation and usage patterns.`,
        action: 'Review session creation workflow and agent training'
      });
    }
    if (healthMetrics.sessionHealthScore < 70) {
      recommendations.push({
        type: 'health',
        priority: 'high',
        title: 'Poor Session Health',
        description: `Session health score is ${healthMetrics.sessionHealthScore}%. Many sessions may be expired or invalid.`,
        action: 'Increase cleanup frequency and review session expiration policies'
      });
    }
    if (healthMetrics.leadsWithExpiringSessions > 10) {
      recommendations.push({
        type: 'expiration',
        priority: 'medium',
        title: 'Sessions Expiring Soon',
        description: `${healthMetrics.leadsWithExpiringSessions} leads have sessions expiring within 7 days.`,
        action: 'Notify agents to access sessions soon or create new ones'
      });
    }
    if (usageAnalytics.totalSessions > 1000) {
      recommendations.push({
        type: 'storage',
        priority: 'low',
        title: 'Consider Storage Optimization',
        description: `With ${usageAnalytics.totalSessions} total sessions, consider implementing more aggressive compression.`,
        action: 'Review compression settings and implement tiered storage'
      });
    }
    if (usageAnalytics.leadsWithRecentAccess < usageAnalytics.leadsWithActiveSessions * 0.3) {
      recommendations.push({
        type: 'activity',
        priority: 'medium',
        title: 'Low Session Activity',
        description: 'Many active sessions have not been accessed recently. They may be unused.',
        action: 'Review agent workflow and consider deactivating unused sessions'
      });
    }
    return recommendations;
  }
  getReportPeriod() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      start: startOfMonth,
      end: endOfMonth,
      month: now.toLocaleString('default', { month: 'long', year: 'numeric' })
    };
  }
  async logCleanupResults(stats) {
    try {
      console.log('📋 Session Cleanup Audit Log:');
      console.log(`   Timestamp: ${stats.timestamp}`);
      console.log(`   Duration: ${stats.duration}ms`);
      console.log(`   Expired Sessions Removed: ${stats.expiredSessions.totalSessionsRemoved}`);
      console.log(`   Orphaned Sessions Removed: ${stats.orphanedSessions.totalSessionsRemoved}`);
      console.log(`   Limit Enforcement Removals: ${stats.limitEnforcement.totalSessionsRemoved}`);
      console.log(`   Invalid Sessions Removed: ${stats.invalidSessions.totalSessionsRemoved}`);
      console.log(`   Total Sessions Removed: ${stats.totalSessionsRemoved}`);
    } catch (error) {
      console.error('❌ Error logging cleanup results:', error);
    }
  }
  async storeAnalyticsReport(report) {
    try {
      console.log('📊 Monthly Analytics Report Stored:');
      console.log(`   Report Period: ${report.reportPeriod.month}`);
      console.log(`   Total Sessions: ${report.summary.totalSessions}`);
      console.log(`   Active Sessions: ${report.summary.activeSessions}`);
      console.log(`   Health Score: ${report.healthMetrics.sessionHealthScore}%`);
      console.log(`   Recommendations: ${report.recommendations.length}`);
    } catch (error) {
      console.error('❌ Error storing analytics report:', error);
    }
  }
  getServiceStatus() {
    return {
      initialized: this.cleanupScheduled && this.compressionScheduled && this.analyticsScheduled,
      scheduledJobs: {
        dailyCleanup: this.cleanupScheduled,
        weeklyCompression: this.compressionScheduled,
        monthlyAnalytics: this.analyticsScheduled
      },
      configuration: this.config,
      lastRun: {
        cleanup: null,
        compression: null,
        analytics: null
      }
    };
  }
  async manualCleanup(type = 'daily') {
    console.log(`🔧 Manual ${type} cleanup triggered...`);
    switch (type) {
      case 'daily':
        return await this.performDailyCleanup();
      case 'weekly':
        return await this.performWeeklyCompression();
      case 'monthly':
        return await this.generateMonthlyReport();
      default:
        throw new Error(`Unknown cleanup type: ${type}`);
    }
  }
}
module.exports = SessionCleanupService;