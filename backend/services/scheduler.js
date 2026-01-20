const cron = require('node-cron');
const { checkSimCardCooldownAndNotify } = require('../controllers/simCards');
const User = require('../models/User');
const sipSyncService = require('./sipSyncService');

class SchedulerService {
  constructor() {
    this.jobs = [];
    this.io = null;
  }

  /**
   * Initialize the scheduler with socket.io instance
   * @param {Object} io - Socket.io instance for real-time notifications
   */
  initialize(io) {
    this.io = io;
    console.log('[Scheduler Service] Initialized');
  }

  /**
   * Start all scheduled jobs
   */
  startAll() {
    this.startSimCardCooldownCheck();
    this.startDailyMidnightLogout();
    this.startSipAgentSync();
    console.log('[Scheduler Service] All jobs started');
  }

  /**
   * Schedule daily SIM card cooldown check
   * Runs every day at 9:00 AM
   */
  startSimCardCooldownCheck() {
    // Schedule for 9:00 AM every day
    // Cron format: minute hour day month weekday
    // '0 9 * * *' means: at minute 0, hour 9, every day
    const schedule = process.env.SIM_CARD_CHECK_SCHEDULE || '0 9 * * *';
    
    const job = cron.schedule(schedule, async () => {
      console.log('[Scheduler] Running SIM card cooldown check...');
      try {
        const result = await checkSimCardCooldownAndNotify(this.io);
        console.log('[Scheduler] SIM card cooldown check completed:', result);
      } catch (error) {
        console.error('[Scheduler] Error in SIM card cooldown check:', error);
      }
    }, {
      scheduled: true,
      timezone: process.env.TIMEZONE || 'UTC'
    });

    this.jobs.push({
      name: 'simCardCooldownCheck',
      job,
      schedule
    });

    console.log(`[Scheduler Service] SIM card cooldown check scheduled: ${schedule} (${process.env.TIMEZONE || 'UTC'})`);
  }

  /**
   * Schedule daily auto-logout at midnight GMT+2 (22:00 UTC)
   * Invalidates all user sessions, forcing everyone to log in again
   */
  startDailyMidnightLogout() {
    // Schedule for 00:00 GMT+2 which is 22:00 UTC
    // Cron format: minute hour day month weekday
    // '0 22 * * *' means: at minute 0, hour 22 UTC (00:00 GMT+2), every day
    const schedule = process.env.MIDNIGHT_LOGOUT_SCHEDULE || '0 22 * * *';
    
    const job = cron.schedule(schedule, async () => {
      console.log('[Scheduler] 🌙 Running daily midnight logout (00:00 GMT+2)...');
      try {
        const result = await this.performDailyLogout();
        console.log('[Scheduler] ✅ Daily midnight logout completed:', result);
      } catch (error) {
        console.error('[Scheduler] ❌ Error in daily midnight logout:', error);
      }
    }, {
      scheduled: true,
      timezone: 'UTC' // Use UTC and schedule at 22:00 to get 00:00 GMT+2
    });

    this.jobs.push({
      name: 'dailyMidnightLogout',
      job,
      schedule
    });

    console.log(`[Scheduler Service] Daily midnight logout scheduled: ${schedule} UTC (00:00 GMT+2)`);
  }

  /**
   * Schedule SIP agent sync
   * Runs every 3 hours to sync agents from external SIP API
   */
  startSipAgentSync() {
    // Schedule for every 3 hours
    // Cron format: minute hour day month weekday
    // '0 */3 * * *' means: at minute 0, every 3rd hour, every day
    const schedule = process.env.SIP_SYNC_SCHEDULE || '0 */3 * * *';

    const job = cron.schedule(schedule, async () => {
      console.log('[Scheduler] Running SIP agent sync...');
      try {
        const result = await sipSyncService.syncAgents();
        console.log('[Scheduler] SIP agent sync completed:', {
          created: result.created,
          existing: result.existingAgents,
          errors: result.errors
        });
      } catch (error) {
        console.error('[Scheduler] Error in SIP agent sync:', error);
      }
    }, {
      scheduled: true,
      timezone: process.env.TIMEZONE || 'UTC'
    });

    this.jobs.push({
      name: 'sipAgentSync',
      job,
      schedule
    });

    console.log(`[Scheduler Service] SIP agent sync scheduled: ${schedule} (${process.env.TIMEZONE || 'UTC'})`);
  }

  /**
   * Perform daily logout for all users
   * Invalidates all tokens and notifies connected users via Socket.IO
   */
  async performDailyLogout() {
    const startTime = Date.now();
    const now = new Date();
    
    try {
      // Update tokenInvalidatedAt for all active users
      // This will cause all existing tokens to be rejected on next API call
      const result = await User.updateMany(
        { isActive: true, status: 'approved' },
        { 
          $set: { 
            tokenInvalidatedAt: now 
          }
        }
      );

      console.log(`[Scheduler] Invalidated tokens for ${result.modifiedCount} users`);

      // Emit force logout event to all connected Socket.IO clients
      if (this.io) {
        this.io.emit('auth:force_logout', {
          reason: 'midnight_logout',
          message: 'Daily automatic logout at midnight. Please log in again.',
          timestamp: now.toISOString()
        });
        console.log('[Scheduler] Sent force logout event to all connected clients');
      }

      const duration = Date.now() - startTime;
      
      return {
        success: true,
        usersAffected: result.modifiedCount,
        timestamp: now,
        duration: `${duration}ms`
      };
    } catch (error) {
      console.error('[Scheduler] Error performing daily logout:', error);
      throw error;
    }
  }

  /**
   * Manually trigger daily logout (for testing/admin purposes)
   */
  async triggerDailyLogout() {
    console.log('[Scheduler] Manually triggering daily logout...');
    try {
      const result = await this.performDailyLogout();
      console.log('[Scheduler] Manual daily logout completed:', result);
      return result;
    } catch (error) {
      console.error('[Scheduler] Error in manual daily logout:', error);
      throw error;
    }
  }

  /**
   * Manually trigger SIM card cooldown check (for testing)
   */
  async triggerSimCardCooldownCheck() {
    console.log('[Scheduler] Manually triggering SIM card cooldown check...');
    try {
      const result = await checkSimCardCooldownAndNotify(this.io);
      console.log('[Scheduler] Manual SIM card cooldown check completed:', result);
      return result;
    } catch (error) {
      console.error('[Scheduler] Error in manual SIM card cooldown check:', error);
      throw error;
    }
  }

  /**
   * Manually trigger SIP agent sync (for testing/admin purposes)
   */
  async triggerSipAgentSync() {
    console.log('[Scheduler] Manually triggering SIP agent sync...');
    try {
      const result = await sipSyncService.syncAgents();
      console.log('[Scheduler] Manual SIP agent sync completed:', result);
      return result;
    } catch (error) {
      console.error('[Scheduler] Error in manual SIP agent sync:', error);
      throw error;
    }
  }

  /**
   * Get SIP agent sync preview (for admin to see what would be synced)
   */
  async getSipSyncPreview() {
    console.log('[Scheduler] Getting SIP sync preview...');
    try {
      const result = await sipSyncService.getSyncPreview();
      console.log('[Scheduler] SIP sync preview generated:', {
        alreadyExist: result.alreadyExist,
        toBeCreated: result.toBeCreated
      });
      return result;
    } catch (error) {
      console.error('[Scheduler] Error getting SIP sync preview:', error);
      throw error;
    }
  }

  /**
   * Stop all scheduled jobs
   */
  stopAll() {
    this.jobs.forEach(({ name, job }) => {
      job.stop();
      console.log(`[Scheduler Service] Stopped job: ${name}`);
    });
    console.log('[Scheduler Service] All jobs stopped');
  }

  /**
   * Get status of all scheduled jobs
   */
  getStatus() {
    return this.jobs.map(({ name, schedule }) => ({
      name,
      schedule,
      nextRun: 'Check cron schedule' // Could be enhanced with next-run calculation
    }));
  }
}

// Create singleton instance
const schedulerService = new SchedulerService();

module.exports = schedulerService;

