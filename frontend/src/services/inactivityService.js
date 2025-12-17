/**
 * Inactivity Service
 * Tracks user activity and triggers auto-logout after 15 minutes of inactivity
 * Also handles scheduled daily logout at 00:00 GMT+2
 */

class InactivityService {
  constructor() {
    this.inactivityTimeout = 15 * 60 * 1000; // 15 minutes in milliseconds
    this.warningTime = 60 * 1000; // Show warning 1 minute before logout
    this.inactivityTimer = null;
    this.warningTimer = null;
    this.midnightTimer = null;
    this.isRunning = false;
    this.onLogout = null;
    this.onWarning = null;
    this.lastActivity = Date.now();
    
    // Bind methods
    this.handleActivity = this.handleActivity.bind(this);
    this.checkMidnight = this.checkMidnight.bind(this);
  }

  /**
   * Start tracking user activity
   * @param {Function} onLogout - Callback to trigger logout
   * @param {Function} onWarning - Callback to show warning before logout
   */
  start(onLogout, onWarning) {
    if (this.isRunning) return;
    
    this.onLogout = onLogout;
    this.onWarning = onWarning;
    this.isRunning = true;
    this.lastActivity = Date.now();
    
    // Add event listeners for user activity
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, this.handleActivity, { passive: true });
    });
    
    // Start the inactivity timer
    this.resetInactivityTimer();
    
    // Start midnight check
    this.scheduleMidnightLogout();
    
    console.log('[InactivityService] Started tracking user activity');
  }

  /**
   * Stop tracking user activity
   */
  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    // Remove event listeners
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.removeEventListener(event, this.handleActivity);
    });
    
    // Clear timers
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
      this.warningTimer = null;
    }
    if (this.midnightTimer) {
      clearTimeout(this.midnightTimer);
      this.midnightTimer = null;
    }
    
    console.log('[InactivityService] Stopped tracking user activity');
  }

  /**
   * Handle user activity event
   */
  handleActivity() {
    this.lastActivity = Date.now();
    this.resetInactivityTimer();
  }

  /**
   * Reset the inactivity timer
   */
  resetInactivityTimer() {
    // Clear existing timers
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }
    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
    }
    
    // Set warning timer (1 minute before logout)
    const warningDelay = this.inactivityTimeout - this.warningTime;
    this.warningTimer = setTimeout(() => {
      if (this.onWarning) {
        this.onWarning(this.warningTime / 1000); // Pass remaining seconds
      }
    }, warningDelay);
    
    // Set logout timer
    this.inactivityTimer = setTimeout(() => {
      console.log('[InactivityService] Inactivity timeout reached, triggering logout');
      if (this.onLogout) {
        this.onLogout('inactivity');
      }
    }, this.inactivityTimeout);
  }

  /**
   * Schedule logout at midnight GMT+2
   */
  scheduleMidnightLogout() {
    // Clear existing timer
    if (this.midnightTimer) {
      clearTimeout(this.midnightTimer);
    }
    
    // Calculate time until midnight GMT+2 (EET - Eastern European Time)
    const now = new Date();
    
    // Get the current time in GMT+2
    // GMT+2 offset in minutes is -120 (negative because it's east of UTC)
    const gmtPlus2Offset = 2 * 60; // 120 minutes
    const localOffset = now.getTimezoneOffset(); // Local timezone offset in minutes (negative if ahead of UTC)
    
    // Create a date object for midnight GMT+2 today
    const midnightGMT2 = new Date(now);
    midnightGMT2.setHours(0, 0, 0, 0);
    
    // Adjust for GMT+2 from local time
    // If local is UTC, we need to trigger at 22:00 UTC (which is 00:00 GMT+2)
    // The adjustment is: UTC time = GMT+2 time - 2 hours
    const adjustmentMinutes = gmtPlus2Offset + localOffset;
    midnightGMT2.setMinutes(midnightGMT2.getMinutes() - adjustmentMinutes);
    
    // If midnight GMT+2 has already passed today, schedule for tomorrow
    if (midnightGMT2 <= now) {
      midnightGMT2.setDate(midnightGMT2.getDate() + 1);
    }
    
    const timeUntilMidnight = midnightGMT2.getTime() - now.getTime();
    
    console.log(`[InactivityService] Midnight GMT+2 logout scheduled in ${Math.round(timeUntilMidnight / 1000 / 60)} minutes`);
    
    this.midnightTimer = setTimeout(() => {
      console.log('[InactivityService] Midnight GMT+2 reached, triggering logout');
      if (this.onLogout) {
        this.onLogout('midnight');
      }
    }, timeUntilMidnight);
  }

  /**
   * Check if it's midnight GMT+2
   */
  checkMidnight() {
    const now = new Date();
    const gmtPlus2Hours = (now.getUTCHours() + 2) % 24;
    const gmtPlus2Minutes = now.getUTCMinutes();
    
    return gmtPlus2Hours === 0 && gmtPlus2Minutes === 0;
  }

  /**
   * Get time remaining until auto-logout (for display purposes)
   */
  getTimeRemaining() {
    const elapsed = Date.now() - this.lastActivity;
    const remaining = Math.max(0, this.inactivityTimeout - elapsed);
    return {
      totalMs: remaining,
      minutes: Math.floor(remaining / 60000),
      seconds: Math.floor((remaining % 60000) / 1000)
    };
  }

  /**
   * Dismiss warning and reset timer
   */
  dismissWarning() {
    this.handleActivity();
  }
}

// Create singleton instance
const inactivityService = new InactivityService();

export default inactivityService;

