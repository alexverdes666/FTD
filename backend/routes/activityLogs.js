/**
 * Activity Logs Routes
 *
 * API endpoints for querying and analyzing activity logs.
 * All routes require admin authentication.
 */

const express = require("express");
const router = express.Router();
const { protect, isAdmin } = require("../middleware/auth");
const {
  getActivityLogs,
  getActivityLogById,
  getUserActivitySummary,
  getIPActivity,
  getFailedRequestsSummary,
  getHighRiskActivity,
  getEndpointAnalytics,
  getDashboardStats,
  getActivityStream,
  exportActivityLogs,
  cleanupOldLogs,
} = require("../controllers/activityLogs");

// All routes require admin authentication
router.use(protect);
router.use(isAdmin);

// Dashboard and analytics
router.get("/dashboard", getDashboardStats);
router.get("/stream", getActivityStream);
router.get("/export", exportActivityLogs);

// Analytics endpoints
router.get("/analytics/failed-requests", getFailedRequestsSummary);
router.get("/analytics/high-risk", getHighRiskActivity);
router.get("/analytics/endpoints", getEndpointAnalytics);

// User-specific activity
router.get("/user/:userId/summary", getUserActivitySummary);

// IP-specific activity
router.get("/ip/:ip", getIPActivity);

// Cleanup (admin only)
router.delete("/cleanup", cleanupOldLogs);

// Main log queries
router.get("/", getActivityLogs);
router.get("/:id", getActivityLogById);

module.exports = router;
