import { store } from "../store/store";
import {
  backgroundSyncPerformance,
  setBackgroundSyncActive,
} from "../store/slices/performanceSlice";

class BackgroundSyncService {
  constructor() {
    this.syncInterval = null;
    this.isActive = false;
    this.syncIntervalDuration = 5 * 60 * 1000; // 5 minutes
    this.retryCount = 0;
    this.maxRetries = 3;
  }

  start() {
    if (this.isActive) {

      return;
    }


    this.isActive = true;
    store.dispatch(setBackgroundSyncActive(true));

    // Start immediate sync after a short delay to let the app settle
    setTimeout(() => {
      this.performSync();
    }, 30000); // 30 seconds after app start

    // Set up recurring sync
    this.syncInterval = setInterval(() => {
      this.performSync();
    }, this.syncIntervalDuration);

    // Listen for network status changes
    if (typeof window !== "undefined") {
      window.addEventListener("online", this.handleOnline.bind(this));
      window.addEventListener("offline", this.handleOffline.bind(this));

      // Listen for visibility changes to sync when user comes back
      document.addEventListener(
        "visibilitychange",
        this.handleVisibilityChange.bind(this)
      );
    }
  }

  stop() {

    this.isActive = false;
    store.dispatch(setBackgroundSyncActive(false));

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.handleOnline.bind(this));
      window.removeEventListener("offline", this.handleOffline.bind(this));
      document.removeEventListener(
        "visibilitychange",
        this.handleVisibilityChange.bind(this)
      );
    }
  }

  async performSync() {
    if (!this.isActive) return;

    try {
      const state = store.getState();
      const user = state.auth.user;

      if (!user || !state.auth.isAuthenticated) {

        return;
      }


      await store.dispatch(backgroundSyncPerformance());

      // Reset retry count on successful sync
      this.retryCount = 0;

    } catch (error) {

      this.handleSyncError(error);
    }
  }

  handleSyncError(error) {
    this.retryCount++;

    if (this.retryCount >= this.maxRetries) {

      // Reduce sync frequency on repeated failures
      this.setSyncInterval(10 * 60 * 1000); // 10 minutes
      this.retryCount = 0; // Reset for next cycle
    } else {
      // Retry with exponential backoff
      const retryDelay = Math.min(1000 * Math.pow(2, this.retryCount), 30000); // Max 30 seconds


      setTimeout(() => {
        this.performSync();
      }, retryDelay);
    }
  }

  setSyncInterval(newInterval) {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncIntervalDuration = newInterval;
    this.syncInterval = setInterval(() => {
      this.performSync();
    }, this.syncIntervalDuration);


  }

  handleOnline() {

    if (this.isActive) {
      // Perform immediate sync when coming back online
      setTimeout(() => {
        this.performSync();
      }, 1000);

      // Reset to normal sync interval
      this.setSyncInterval(5 * 60 * 1000); // 5 minutes
    }
  }

  handleOffline() {

    // Don't stop the service, just let it fail gracefully until we're back online
  }

  handleVisibilityChange() {
    if (!document.hidden && this.isActive) {

      // Sync when user returns to the app (after 2 seconds to let things settle)
      setTimeout(() => {
        this.performSync();
      }, 2000);
    }
  }

  // Method to force a sync (useful for manual refresh)
  forcSync() {
    if (this.isActive) {

      return this.performSync();
    }
  }

  getStatus() {
    return {
      isActive: this.isActive,
      syncIntervalDuration: this.syncIntervalDuration,
      retryCount: this.retryCount,
      maxRetries: this.maxRetries,
    };
  }
}

// Create and export singleton instance
export const backgroundSyncService = new BackgroundSyncService();

// Export the class for testing purposes
export default BackgroundSyncService;
