class BackgroundSyncService {
  constructor() {
    this.syncInterval = null;
    this.isActive = false;
    this.syncIntervalDuration = 5 * 60 * 1000; // 5 minutes
  }

  start() {
    if (this.isActive) {
      return;
    }

    this.isActive = true;
    // Background sync service is currently a no-op
    // It can be extended for other background sync needs in the future
  }

  stop() {
    this.isActive = false;

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  getStatus() {
    return {
      isActive: this.isActive,
      syncIntervalDuration: this.syncIntervalDuration,
    };
  }
}

// Create and export singleton instance
export const backgroundSyncService = new BackgroundSyncService();

// Export the class for testing purposes
export default BackgroundSyncService;
