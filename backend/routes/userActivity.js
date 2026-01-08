/**
 * User Activity Routes
 * 
 * API endpoints for real-time activity tracking and performance monitoring.
 */

const express = require('express');
const router = express.Router();
const { protect, isAdmin } = require('../middleware/auth');
const {
  startSession,
  updateActivity,
  endSession,
  getLiveUsers,
  getUserSessions,
  getUserLiveSession,
  getDashboardStats,
  getUserHistory,
  getPageAnalytics
} = require('../controllers/userActivity');

// All routes require authentication
router.use(protect);

// User-facing routes (for the tracking script)
router.post('/session/start', startSession);
router.post('/update', updateActivity);
router.post('/session/end', endSession);

// Admin-only routes for performance monitoring
router.get('/live', isAdmin, getLiveUsers);
router.get('/dashboard', isAdmin, getDashboardStats);
router.get('/analytics/pages', isAdmin, getPageAnalytics);
router.get('/user/:userId/sessions', isAdmin, getUserSessions);
router.get('/user/:userId/live', isAdmin, getUserLiveSession);
router.get('/user/:userId/history', isAdmin, getUserHistory);

module.exports = router;

