const express = require("express");
const { protect } = require("../middleware/auth");
const AgentScraperService = require("../services/agentScraperService");

const router = express.Router();

// Get scraper service instance (singleton)
const getScraperService = () => {
  return AgentScraperService.getInstance();
};

/**
 * GET /api/scraper/status
 * Get scraper service status
 */
router.get("/status", protect, async (req, res) => {
  try {
    // Only admins can check scraper status
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin role required.",
      });
    }

    const service = getScraperService();
    const status = service.getStatus();
    const health = await service.checkScraperHealth();

    res.status(200).json({
      success: true,
      data: {
        service: status,
        scraperHealth: health,
      },
    });
  } catch (error) {
    console.error("Error getting scraper status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get scraper status",
      error: error.message,
    });
  }
});

/**
 * POST /api/scraper/trigger
 * Manually trigger the scraper
 */
router.post("/trigger", protect, async (req, res) => {
  try {
    // Only admins can trigger scraper
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin role required.",
      });
    }

    const service = getScraperService();
    console.log(
      `🔧 Manual scraper trigger requested by user: ${req.user.email}`
    );

    const result = await service.triggerScraper();

    res.status(200).json({
      success: true,
      message: "Scraper triggered successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error triggering scraper:", error);
    res.status(500).json({
      success: false,
      message: "Failed to trigger scraper",
      error: error.message,
    });
  }
});

/**
 * GET /api/scraper/results
 * Get recent scraper results
 */
router.get("/results", protect, async (req, res) => {
  try {
    // Only admins can view scraper results
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin role required.",
      });
    }

    const service = getScraperService();
    const results = await service.getRecentResults();

    if (results.success) {
      res.status(200).json({
        success: true,
        data: results.data,
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to get scraper results",
        error: results.error,
      });
    }
  } catch (error) {
    console.error("Error getting scraper results:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get scraper results",
      error: error.message,
    });
  }
});

/**
 * GET /api/scraper/health
 * Check if scraper API is available
 */
router.get("/health", protect, async (req, res) => {
  try {
    // Only admins can check scraper health
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin role required.",
      });
    }

    const service = getScraperService();
    const health = await service.checkScraperHealth();

    res.status(200).json({
      success: true,
      data: health,
    });
  } catch (error) {
    console.error("Error checking scraper health:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check scraper health",
      error: error.message,
    });
  }
});

module.exports = router;
