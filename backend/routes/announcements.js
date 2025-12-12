const express = require('express');
const router = express.Router();
const {
  createAnnouncement,
  getMyAnnouncements,
  getUnreadAnnouncements,
  markAsRead,
  markAllAsRead,
  getSentAnnouncements,
  getAnnouncement,
  deleteAnnouncement,
  getAnnouncementStats
} = require('../controllers/announcements');

const { protect, isAdmin } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// User routes (agents, affiliate managers)
router.get('/', getMyAnnouncements);
router.get('/unread', getUnreadAnnouncements);
router.put('/mark-all-read', markAllAsRead);
router.put('/:id/read', markAsRead);
router.get('/:id', getAnnouncement);

// Admin routes
router.post('/', isAdmin, createAnnouncement);
router.get('/admin/sent', isAdmin, getSentAnnouncements);
router.get('/admin/stats', isAdmin, getAnnouncementStats);
router.delete('/:id', isAdmin, deleteAnnouncement);

module.exports = router;

