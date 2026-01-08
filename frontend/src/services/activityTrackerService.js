/**
 * Activity Tracker Service
 * 
 * Comprehensive user activity tracking for performance monitoring.
 * Tracks mouse movements, focus state, page visits, keystrokes, and inactivity.
 * Reports data to backend in real-time for admin dashboard.
 */

import api from './api';
import { store } from '../store/store';

class ActivityTrackerService {
  constructor() {
    this.isRunning = false;
    this.sessionId = null;
    this.updateInterval = null;
    this.snapshotInterval = null;
    
    // Tracking metrics (reset on each update)
    this.metrics = {
      mouseMovements: 0,
      keystrokes: 0,
      clicks: 0,
      scrollEvents: 0,
      charactersTyped: 0
    };
    
    // Cumulative session metrics
    this.sessionMetrics = {
      totalMouseMovements: 0,
      totalKeystrokes: 0,
      totalClicks: 0,
      totalCharactersTyped: 0
    };
    
    // State tracking
    this.state = {
      isActive: true,
      isFocused: true,
      currentPage: window.location.pathname,
      currentPageTitle: document.title,
      lastActivityTime: Date.now(),
      lastFocusTime: Date.now(),
      lastBlurTime: null,
      pageEnteredAt: Date.now()
    };
    
    // Time tracking
    this.timers = {
      activeTime: 0,
      inactiveTime: 0,
      focusedTime: 0,
      unfocusedTime: 0,
      lastUpdateTime: Date.now()
    };
    
    // Inactivity tracking (30 second threshold)
    this.inactivityThreshold = 30000;
    this.inactivityStartTime = null;
    
    // Typing speed calculation
    this.typingTimestamps = [];
    
    // Scroll depth tracking
    this.maxScrollDepth = 0;
    this.pageInteractions = 0;
    
    // Bound event handlers
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.handleScroll = this.handleScroll.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleFocus = this.handleFocus.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    this.handleBeforeUnload = this.handleBeforeUnload.bind(this);
    
    // Console log for debugging
    console.log('🔍 Activity Tracker Service initialized');
  }
  
  /**
   * Start tracking activity
   */
  async start() {
    if (this.isRunning) return;
    
    console.log('🚀 Starting activity tracking...');
    
    try {
      // Generate session info
      const sessionData = {
        sessionId: this.generateSessionId(),
        userAgent: navigator.userAgent,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        connectionType: navigator.connection?.effectiveType || 'unknown',
        connectionDownlink: navigator.connection?.downlink || 0
      };
      
      // Start session on backend
      const response = await api.post('/user-activity/session/start', sessionData);
      this.sessionId = response.data.sessionId;
      
      // Reset all metrics
      this.resetMetrics();
      
      // Attach event listeners
      this.attachEventListeners();
      
      // Start periodic updates (every 5 seconds)
      this.updateInterval = setInterval(() => this.sendUpdate(), 5000);
      
      // Start snapshot collection (every 10 seconds for graphing)
      this.snapshotInterval = setInterval(() => this.collectSnapshot(), 10000);
      
      this.isRunning = true;
      console.log('✅ Activity tracking started, session:', this.sessionId);
    } catch (error) {
      console.error('❌ Failed to start activity tracking:', error);
    }
  }
  
  /**
   * Stop tracking activity
   */
  async stop() {
    if (!this.isRunning) return;
    
    console.log('🛑 Stopping activity tracking...');
    
    // Remove event listeners
    this.removeEventListeners();
    
    // Clear intervals
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval);
      this.snapshotInterval = null;
    }
    
    // Send final update
    await this.sendUpdate();
    
    // End session on backend
    try {
      await api.post('/user-activity/session/end', {
        sessionId: this.sessionId,
        finalStats: {
          typingSpeed: this.calculateTypingSpeed()
        }
      });
    } catch (error) {
      console.error('Error ending activity session:', error);
    }
    
    this.isRunning = false;
    this.sessionId = null;
    console.log('✅ Activity tracking stopped');
  }
  
  /**
   * Attach all event listeners
   */
  attachEventListeners() {
    // Mouse tracking
    document.addEventListener('mousemove', this.handleMouseMove, { passive: true });
    document.addEventListener('click', this.handleClick, { passive: true });
    
    // Keyboard tracking
    document.addEventListener('keydown', this.handleKeyDown, { passive: true });
    
    // Scroll tracking
    window.addEventListener('scroll', this.handleScroll, { passive: true });
    
    // Focus/blur tracking
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('focus', this.handleFocus);
    window.addEventListener('blur', this.handleBlur);
    
    // Page unload
    window.addEventListener('beforeunload', this.handleBeforeUnload);
  }
  
  /**
   * Remove all event listeners
   */
  removeEventListeners() {
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('click', this.handleClick);
    document.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('scroll', this.handleScroll);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('focus', this.handleFocus);
    window.removeEventListener('blur', this.handleBlur);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
  }
  
  /**
   * Mouse move handler - throttled counting
   */
  handleMouseMove() {
    this.metrics.mouseMovements++;
    this.recordActivity();
  }
  
  /**
   * Key down handler
   */
  handleKeyDown(event) {
    this.metrics.keystrokes++;
    this.pageInteractions++;
    
    // Track character input for typing speed (exclude special keys)
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
      this.metrics.charactersTyped++;
      this.typingTimestamps.push(Date.now());
      
      // Keep only last 100 timestamps for speed calculation
      if (this.typingTimestamps.length > 100) {
        this.typingTimestamps.shift();
      }
    }
    
    this.recordActivity();
  }
  
  /**
   * Click handler
   */
  handleClick() {
    this.metrics.clicks++;
    this.pageInteractions++;
    this.recordActivity();
  }
  
  /**
   * Scroll handler
   */
  handleScroll() {
    this.metrics.scrollEvents++;
    this.pageInteractions++;
    
    // Calculate scroll depth
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    this.maxScrollDepth = Math.max(this.maxScrollDepth, scrollPercent);
    
    this.recordActivity();
  }
  
  /**
   * Visibility change handler (tab switching)
   */
  handleVisibilityChange() {
    if (document.hidden) {
      this.handleBlur();
    } else {
      this.handleFocus();
    }
  }
  
  /**
   * Window focus handler - actual focus, not just mouse movement
   */
  handleFocus() {
    if (!this.state.isFocused) {
      const now = Date.now();
      
      // Calculate unfocused time
      if (this.state.lastBlurTime) {
        const unfocusedDuration = now - this.state.lastBlurTime;
        this.timers.unfocusedTime += unfocusedDuration;
      }
      
      this.state.isFocused = true;
      this.state.lastFocusTime = now;
      console.log('👁️ Window focused');
    }
  }
  
  /**
   * Window blur handler - actual loss of focus
   */
  handleBlur() {
    if (this.state.isFocused) {
      const now = Date.now();
      
      // Calculate focused time
      if (this.state.lastFocusTime) {
        const focusedDuration = now - this.state.lastFocusTime;
        this.timers.focusedTime += focusedDuration;
      }
      
      this.state.isFocused = false;
      this.state.lastBlurTime = now;
      console.log('👁️ Window blurred (unfocused)');
    }
  }
  
  /**
   * Before unload handler
   */
  handleBeforeUnload() {
    // Record page exit
    this.recordPageExit();
    
    // Try to send final beacon
    if (this.sessionId && navigator.sendBeacon) {
      const data = JSON.stringify({
        sessionId: this.sessionId,
        finalStats: { typingSpeed: this.calculateTypingSpeed() }
      });
      
      const blob = new Blob([data], { type: 'application/json' });
      navigator.sendBeacon('/api/user-activity/session/end', blob);
    }
  }
  
  /**
   * Record user activity (resets inactivity timer)
   */
  recordActivity() {
    const now = Date.now();
    
    // Check if was inactive
    if (!this.state.isActive && this.inactivityStartTime) {
      // End inactivity period
      const inactivityDuration = now - this.inactivityStartTime;
      if (inactivityDuration >= this.inactivityThreshold) {
        this.timers.inactiveTime += inactivityDuration;
      }
      this.inactivityStartTime = null;
    }
    
    // Calculate active time since last activity
    const activeTimeSinceLastActivity = now - this.state.lastActivityTime;
    if (activeTimeSinceLastActivity < this.inactivityThreshold) {
      this.timers.activeTime += activeTimeSinceLastActivity;
    }
    
    this.state.isActive = true;
    this.state.lastActivityTime = now;
  }
  
  /**
   * Check for inactivity (called before sending update)
   */
  checkInactivity() {
    const now = Date.now();
    const timeSinceActivity = now - this.state.lastActivityTime;
    
    if (timeSinceActivity >= this.inactivityThreshold) {
      if (this.state.isActive) {
        this.state.isActive = false;
        this.inactivityStartTime = this.state.lastActivityTime;
        console.log('💤 User became inactive');
      }
    }
  }
  
  /**
   * Track page navigation
   */
  trackPageVisit(path, title) {
    // Record exit from previous page
    this.recordPageExit();
    
    // Start tracking new page
    this.state.currentPage = path;
    this.state.currentPageTitle = title || document.title;
    this.state.pageEnteredAt = Date.now();
    this.maxScrollDepth = 0;
    this.pageInteractions = 0;
    
    console.log('📄 Page visit:', path);
  }
  
  /**
   * Record page exit (for duration tracking)
   */
  recordPageExit() {
    if (this.state.pageEnteredAt && this.state.currentPage) {
      const duration = Date.now() - this.state.pageEnteredAt;
      
      // This will be sent in the next update
      this.pendingPageVisit = {
        path: this.state.currentPage,
        title: this.state.currentPageTitle,
        enteredAt: new Date(this.state.pageEnteredAt),
        leftAt: new Date(),
        duration,
        scrollDepth: Math.round(this.maxScrollDepth),
        interactions: this.pageInteractions
      };
    }
  }
  
  /**
   * Collect activity snapshot for graphing
   */
  collectSnapshot() {
    this.pendingSnapshot = {
      timestamp: new Date(),
      isActive: this.state.isActive,
      isFocused: this.state.isFocused,
      mouseMovements: this.metrics.mouseMovements,
      keystrokes: this.metrics.keystrokes,
      clicks: this.metrics.clicks,
      scrollEvents: this.metrics.scrollEvents,
      currentPage: this.state.currentPage
    };
  }
  
  /**
   * Calculate typing speed (characters per minute)
   */
  calculateTypingSpeed() {
    if (this.typingTimestamps.length < 2) return 0;
    
    const timeSpan = this.typingTimestamps[this.typingTimestamps.length - 1] - this.typingTimestamps[0];
    if (timeSpan === 0) return 0;
    
    const minutes = timeSpan / 60000;
    return Math.round(this.typingTimestamps.length / minutes);
  }
  
  /**
   * Send activity update to backend
   */
  async sendUpdate() {
    if (!this.sessionId || !this.isRunning) return;
    
    // Check for inactivity
    this.checkInactivity();
    
    // Calculate time deltas
    const now = Date.now();
    const timeSinceLastUpdate = now - this.timers.lastUpdateTime;
    
    // Prepare update data
    const updateData = {
      sessionId: this.sessionId,
      currentPage: this.state.currentPage,
      currentPageTitle: this.state.currentPageTitle,
      isActive: this.state.isActive,
      isFocused: this.state.isFocused,
      mouseMovements: this.metrics.mouseMovements,
      keystrokes: this.metrics.keystrokes,
      clicks: this.metrics.clicks,
      scrollEvents: this.metrics.scrollEvents,
      charactersTyped: this.metrics.charactersTyped,
      activeTimeDelta: Math.min(this.timers.activeTime, timeSinceLastUpdate),
      inactiveTimeDelta: this.timers.inactiveTime,
      focusedTimeDelta: this.timers.focusedTime,
      unfocusedTimeDelta: this.timers.unfocusedTime
    };
    
    // Add snapshot if collected
    if (this.pendingSnapshot) {
      updateData.snapshot = this.pendingSnapshot;
      this.pendingSnapshot = null;
    }
    
    // Add page visit if recorded
    if (this.pendingPageVisit) {
      updateData.pageVisit = this.pendingPageVisit;
      this.pendingPageVisit = null;
    }
    
    // Update session metrics
    this.sessionMetrics.totalMouseMovements += this.metrics.mouseMovements;
    this.sessionMetrics.totalKeystrokes += this.metrics.keystrokes;
    this.sessionMetrics.totalClicks += this.metrics.clicks;
    this.sessionMetrics.totalCharactersTyped += this.metrics.charactersTyped;
    
    // Reset per-interval metrics
    this.metrics = {
      mouseMovements: 0,
      keystrokes: 0,
      clicks: 0,
      scrollEvents: 0,
      charactersTyped: 0
    };
    
    // Reset time deltas
    this.timers.activeTime = 0;
    this.timers.inactiveTime = 0;
    this.timers.focusedTime = 0;
    this.timers.unfocusedTime = 0;
    this.timers.lastUpdateTime = now;
    
    try {
      await api.post('/user-activity/update', updateData);
    } catch (error) {
      // Silently fail - don't disrupt user experience
      console.warn('Activity update failed:', error.message);
    }
  }
  
  /**
   * Reset all metrics
   */
  resetMetrics() {
    this.metrics = {
      mouseMovements: 0,
      keystrokes: 0,
      clicks: 0,
      scrollEvents: 0,
      charactersTyped: 0
    };
    
    this.sessionMetrics = {
      totalMouseMovements: 0,
      totalKeystrokes: 0,
      totalClicks: 0,
      totalCharactersTyped: 0
    };
    
    this.state = {
      isActive: true,
      isFocused: !document.hidden,
      currentPage: window.location.pathname,
      currentPageTitle: document.title,
      lastActivityTime: Date.now(),
      lastFocusTime: document.hidden ? null : Date.now(),
      lastBlurTime: document.hidden ? Date.now() : null,
      pageEnteredAt: Date.now()
    };
    
    this.timers = {
      activeTime: 0,
      inactiveTime: 0,
      focusedTime: 0,
      unfocusedTime: 0,
      lastUpdateTime: Date.now()
    };
    
    this.typingTimestamps = [];
    this.maxScrollDepth = 0;
    this.pageInteractions = 0;
    this.inactivityStartTime = null;
    this.pendingSnapshot = null;
    this.pendingPageVisit = null;
  }
  
  /**
   * Generate unique session ID
   */
  generateSessionId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Get current session stats (for debugging)
   */
  getSessionStats() {
    return {
      sessionId: this.sessionId,
      isRunning: this.isRunning,
      state: this.state,
      sessionMetrics: this.sessionMetrics,
      typingSpeed: this.calculateTypingSpeed()
    };
  }
}

// Create singleton instance
const activityTrackerService = new ActivityTrackerService();

export default activityTrackerService;

