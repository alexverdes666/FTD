const axios = require("axios");
const cron = require("node-cron");

// --- Constants for better maintainability ---
const SCRAPE_STATUS = Object.freeze({
  IDLE: "idle",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
});

const DEFAULT_CRON_SCHEDULE = "0 2 * * *"; // Daily at 2:00 AM
const STARTUP_DELAY_MS = 30000; // 30 seconds
const SCRAPE_TIMEOUT_MS = 120000; // 2 minutes
const HEALTH_CHECK_TIMEOUT_MS = 10000; // 10 seconds
const RESULTS_TIMEOUT_MS = 30000; // 30 seconds
const USER_AGENT = "FTD-Backend-Service/1.0";

class AgentScraperService {
  constructor() {
    // --- 1. Configuration from Environment Variables (with defaults) ---
    this.scraperUrl =
      process.env.SCRAPER_API_URL || "https://agent-report-1.onrender.com/api";
    if (!process.env.SCRAPER_USERNAME || !process.env.SCRAPER_PASSWORD) {
      throw new Error(
        "SCRAPER_USERNAME and SCRAPER_PASSWORD environment variables are required."
      );
    }
    this.scraperCredentials = {
      username: process.env.SCRAPER_USERNAME,
      password: process.env.SCRAPER_PASSWORD,
    };
    this.cronSchedule =
      process.env.SCRAPER_CRON_SCHEDULE || DEFAULT_CRON_SCHEDULE;

    // --- State properties ---
    this.isScheduled = false;
    this.lastScrapeTime = null;
    this.scrapeStatus = SCRAPE_STATUS.IDLE;
    this.cronJob = null; // To hold the cron instance if needed later

    // --- 3. Centralized Axios instance ---
    this.apiClient = axios.create({
      baseURL: this.scraperUrl,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
      },
    });

    console.log("🔧 Agent Scraper Service initialized.");
  }

  /**
   * A private helper to wrap the scrape task logic, avoiding code duplication.
   * @private
   */
  async _runScrapeTask(taskName = "Scheduled") {
    console.log(`🚀 Triggering ${taskName} scrape...`);
    try {
      await this.triggerScraper();
    } catch (error) {
      console.error(`❌ ${taskName} scrape failed:`, error.message);
    }
  }

  /**
   * Initialize the daily cron job to trigger the scraper.
   */
  initializeScheduledScraping() {
    if (this.isScheduled) {
      console.warn("⚠️ Scraper scheduling already initialized. Skipping.");
      return;
    }

    // Schedule the recurring task
    this.cronJob = cron.schedule(
      this.cronSchedule,
      () => this._runScrapeTask("Daily Cron"),
      {
        scheduled: true,
        timezone: "UTC", // Explicitly set timezone for consistency
      }
    );

    this.isScheduled = true;
    console.log(
      `📅 Agent scraper scheduled with pattern: "${this.cronSchedule}"`
    );

    // Trigger immediately on startup (after a delay)
    setTimeout(() => this._runScrapeTask("Initial Startup"), STARTUP_DELAY_MS);
  }

  /**
   * Trigger the scraper.
   */
  async triggerScraper() {
    if (this.scrapeStatus === SCRAPE_STATUS.RUNNING) {
      const message = "Scraper is already running, skipping trigger.";
      console.warn(`⚠️ ${message}`);
      return { success: false, message };
    }

    this.scrapeStatus = SCRAPE_STATUS.RUNNING;
    console.log(`📡 Triggering scraper at: ${this.scraperUrl}/scrape`);

    try {
      const response = await this.apiClient.post(
        "/scrape",
        this.scraperCredentials,
        { timeout: SCRAPE_TIMEOUT_MS }
      );

      this.lastScrapeTime = new Date();
      this.scrapeStatus = SCRAPE_STATUS.COMPLETED;

      return {
        success: true,
        data: response.data,
        timestamp: this.lastScrapeTime,
      };
    } catch (error) {
      this.scrapeStatus = SCRAPE_STATUS.FAILED;
      this._handleApiError(error, "trigger scraper");
      // Re-throw to allow callers to handle the failure
      throw new Error(`Scraper trigger failed: ${error.message}`);
    }
  }

  /**
   * Get scraper service status.
   */
  getStatus() {
    return {
      isScheduled: this.isScheduled,
      lastScrapeTime: this.lastScrapeTime,
      scrapeStatus: this.scrapeStatus,
      scraperUrl: this.scraperUrl,
      nextScheduledRun: this.cronJob
        ? this.cronJob.nextDate().toJSDate()
        : "Not scheduled",
    };
  }

  /**
   * Check if scraper API is available.
   */
  async checkScraperHealth() {
    try {
      // Use the base URL of the axios instance for the health check
      const healthCheckUrl = new URL(this.apiClient.defaults.baseURL).origin;
      const response = await axios.get(healthCheckUrl, {
        timeout: HEALTH_CHECK_TIMEOUT_MS,
      });
      return { available: true, status: response.status, data: response.data };
    } catch (error) {
      return { available: false, error: error.message };
    }
  }

  /**
   * Get recent scraper results.
   */
  async getRecentResults() {
    try {
      const response = await this.apiClient.get("/results", {
        timeout: RESULTS_TIMEOUT_MS,
      });
      return { success: true, data: response.data };
    } catch (error) {
      this._handleApiError(error, "get recent results");
      return { success: false, error: error.message };
    }
  }

  /**
   * A private helper to consistently log API errors.
   * @private
   */
  _handleApiError(error, context) {
    console.error(`❌ Failed to ${context}:`, error.message);
    if (error.response) {
      console.error("  - Status:", error.response.status);
      console.error("  - Data:", error.response.data);
    } else if (error.request) {
      console.error("  - No response received from server.");
    }
  }
}

// --- 2. Idiomatic Node.js Singleton Pattern ---
// By exporting an instance, `require`'s module cache ensures it's a singleton.
module.exports = new AgentScraperService();
