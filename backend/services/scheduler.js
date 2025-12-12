const cron = require('node-cron');
const { checkSimCardCooldownAndNotify } = require('../controllers/simCards');

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

