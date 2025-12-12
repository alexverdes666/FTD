const express = require('express');
const router = express.Router();
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  createNotification,
  getNotificationStats
} = require('../controllers/notifications');

const { protect, isAdmin } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// User routes
router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.put('/:id/read', markAsRead);
router.put('/mark-all-read', markAllAsRead);
router.delete('/:id', deleteNotification);

// Admin routes
router.post('/', isAdmin, createNotification);
router.get('/stats', isAdmin, getNotificationStats);

module.exports = router;
