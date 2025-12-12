const Announcement = require('../models/Announcement');
const User = require('../models/User');
const mongoose = require('mongoose');

// @desc    Create a new announcement (admin only)
// @route   POST /api/announcements
// @access  Private (Admin)
exports.createAnnouncement = async (req, res) => {
  try {
    const { title, message, targetRoles, priority = 'medium' } = req.body;

    // Validate required fields
    if (!title || !message || !targetRoles || targetRoles.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Title, message, and at least one target role are required'
      });
    }

    // Validate target roles
    const validRoles = ['agent', 'affiliate_manager'];
    const invalidRoles = targetRoles.filter(role => !validRoles.includes(role));
    if (invalidRoles.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid target roles: ${invalidRoles.join(', ')}. Valid roles are: ${validRoles.join(', ')}`
      });
    }

    // Create announcement
    const announcement = await Announcement.create({
      title,
      message,
      targetRoles,
      priority,
      createdBy: req.user._id
    });

    // Populate the created announcement
    const populatedAnnouncement = await Announcement.findById(announcement._id)
      .populate('createdBy', 'fullName email role');

    // Emit real-time announcement to targeted users via Socket.IO
    if (req.io) {
      // Get all users with the targeted roles
      const targetedUsers = await User.find({
        role: { $in: targetRoles },
        isActive: true,
        status: 'approved'
      }).select('_id');

      // Emit to each targeted user's personal room
      targetedUsers.forEach(user => {
        req.io.to(`user:${user._id}`).emit('new_announcement', {
          announcement: populatedAnnouncement
        });
      });

      console.log(`📢 Announcement sent to ${targetedUsers.length} users with roles: ${targetRoles.join(', ')}`);
    }

    res.status(201).json({
      success: true,
      data: populatedAnnouncement,
      message: 'Announcement created and sent successfully'
    });

  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating announcement'
    });
  }
};

// @desc    Get all announcements for the current user's role
// @route   GET /api/announcements
// @access  Private
exports.getMyAnnouncements = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const userRole = req.user.role;

    // Check if user role can receive announcements
    const eligibleRoles = ['agent', 'affiliate_manager'];
    if (!eligibleRoles.includes(userRole)) {
      return res.status(200).json({
        success: true,
        data: [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          pages: 0
        },
        message: 'Your role does not receive announcements'
      });
    }

    const result = await Announcement.getAllForUserRole(userRole, parseInt(page), parseInt(limit));

    // Add isRead status for each announcement
    const announcementsWithReadStatus = result.announcements.map(announcement => {
      const announcementObj = announcement.toObject();
      announcementObj.isRead = announcement.isReadByUser(req.user._id);
      return announcementObj;
    });

    res.status(200).json({
      success: true,
      data: announcementsWithReadStatus,
      pagination: result.pagination
    });

  } catch (error) {
    console.error('Get my announcements error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching announcements'
    });
  }
};

// @desc    Get unread announcements for popup display
// @route   GET /api/announcements/unread
// @access  Private
exports.getUnreadAnnouncements = async (req, res) => {
  try {
    const userRole = req.user.role;

    // Check if user role can receive announcements
    const eligibleRoles = ['agent', 'affiliate_manager'];
    if (!eligibleRoles.includes(userRole)) {
      return res.status(200).json({
        success: true,
        data: [],
        count: 0
      });
    }

    const unreadAnnouncements = await Announcement.getUnreadForUser(req.user._id, userRole);

    res.status(200).json({
      success: true,
      data: unreadAnnouncements,
      count: unreadAnnouncements.length
    });

  } catch (error) {
    console.error('Get unread announcements error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching unread announcements'
    });
  }
};

// @desc    Mark an announcement as read
// @route   PUT /api/announcements/:id/read
// @access  Private
exports.markAsRead = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Check if the announcement is targeted at the user's role
    if (!announcement.targetRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'This announcement is not for your role'
      });
    }

    await announcement.markAsReadByUser(req.user._id);

    res.status(200).json({
      success: true,
      message: 'Announcement marked as read'
    });

  } catch (error) {
    console.error('Mark announcement as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while marking announcement as read'
    });
  }
};

// @desc    Mark all announcements as read
// @route   PUT /api/announcements/mark-all-read
// @access  Private
exports.markAllAsRead = async (req, res) => {
  try {
    const userRole = req.user.role;

    // Check if user role can receive announcements
    const eligibleRoles = ['agent', 'affiliate_manager'];
    if (!eligibleRoles.includes(userRole)) {
      return res.status(200).json({
        success: true,
        message: 'No announcements to mark as read'
      });
    }

    // Get all unread announcements for this user
    const unreadAnnouncements = await Announcement.getUnreadForUser(req.user._id, userRole);

    // Mark each as read
    for (const announcement of unreadAnnouncements) {
      await announcement.markAsReadByUser(req.user._id);
    }

    res.status(200).json({
      success: true,
      message: `${unreadAnnouncements.length} announcements marked as read`
    });

  } catch (error) {
    console.error('Mark all announcements as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while marking all announcements as read'
    });
  }
};

// @desc    Get announcements sent by admin (admin view)
// @route   GET /api/announcements/sent
// @access  Private (Admin)
exports.getSentAnnouncements = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    // Get all announcements (admin can see all, not just their own)
    const result = await Announcement.getAllAnnouncements(parseInt(page), parseInt(limit));

    // Add read count for each announcement
    const announcementsWithStats = result.announcements.map(announcement => {
      const announcementObj = announcement.toObject();
      announcementObj.readCount = announcement.readBy.length;
      return announcementObj;
    });

    res.status(200).json({
      success: true,
      data: announcementsWithStats,
      pagination: result.pagination
    });

  } catch (error) {
    console.error('Get sent announcements error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching sent announcements'
    });
  }
};

// @desc    Get a single announcement by ID
// @route   GET /api/announcements/:id
// @access  Private
exports.getAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id)
      .populate('createdBy', 'fullName email role');

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // For non-admin users, check if announcement is targeted at their role
    if (req.user.role !== 'admin' && !announcement.targetRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this announcement'
      });
    }

    const announcementObj = announcement.toObject();
    announcementObj.isRead = announcement.isReadByUser(req.user._id);
    announcementObj.readCount = announcement.readBy.length;

    res.status(200).json({
      success: true,
      data: announcementObj
    });

  } catch (error) {
    console.error('Get announcement error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching announcement'
    });
  }
};

// @desc    Delete an announcement (admin only)
// @route   DELETE /api/announcements/:id
// @access  Private (Admin)
exports.deleteAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    await announcement.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Announcement deleted successfully'
    });

  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting announcement'
    });
  }
};

// @desc    Get announcement statistics (admin only)
// @route   GET /api/announcements/stats
// @access  Private (Admin)
exports.getAnnouncementStats = async (req, res) => {
  try {
    const stats = await Announcement.aggregate([
      {
        $facet: {
          byTargetRole: [
            { $unwind: '$targetRoles' },
            { $group: { _id: '$targetRoles', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          byPriority: [
            { $group: { _id: '$priority', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          totalCount: [
            { $count: 'total' }
          ],
          recentAnnouncements: [
            { $sort: { createdAt: -1 } },
            { $limit: 5 },
            {
              $project: {
                title: 1,
                targetRoles: 1,
                createdAt: 1,
                readCount: { $size: '$readBy' }
              }
            }
          ]
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: stats[0]
    });

  } catch (error) {
    console.error('Get announcement stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching announcement statistics'
    });
  }
};

