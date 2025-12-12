const Notification = require('../models/Notification');
const User = require('../models/User');
const mongoose = require('mongoose');

// @desc    Get all notifications for the authenticated user
// @route   GET /api/notifications
// @access  Private
exports.getNotifications = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      isRead,
      type,
      priority,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = { recipient: req.user._id };
    
    if (isRead !== undefined) {
      filter.isRead = isRead === 'true';
    }
    if (type) filter.type = type;
    if (priority) filter.priority = priority;

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate skip value
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query with population
    const notifications = await Notification.find(filter)
      .populate('sender', 'fullName email role')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await Notification.countDocuments(filter);

    // Get unread count
    const unreadCount = await Notification.getUnreadCount(req.user._id);

    res.status(200).json({
      success: true,
      data: notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
        hasNext: parseInt(page) < Math.ceil(total / parseInt(limit)),
        hasPrev: parseInt(page) > 1
      },
      unreadCount
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching notifications'
    });
  }
};

// @desc    Get unread notifications count
// @route   GET /api/notifications/unread-count
// @access  Private
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.getUnreadCount(req.user._id);
    
    res.status(200).json({
      success: true,
      data: { count }
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching unread count'
    });
  }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      recipient: req.user._id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    await notification.markAsRead();

    // Emit real-time update
    if (req.io) {
      const unreadCount = await Notification.getUnreadCount(req.user._id);
      req.io.to(`user:${req.user._id}`).emit('notification_read', {
        notificationId: notification._id,
        unreadCount
      });
    }

    res.status(200).json({
      success: true,
      data: notification,
      message: 'Notification marked as read'
    });

  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while marking notification as read'
    });
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/mark-all-read
// @access  Private
exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.markAllAsRead(req.user._id);

    // Emit real-time update
    if (req.io) {
      req.io.to(`user:${req.user._id}`).emit('notifications_all_read', {
        unreadCount: 0
      });
    }

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });

  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while marking all notifications as read'
    });
  }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      recipient: req.user._id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    await notification.deleteOne();

    // Emit real-time update
    if (req.io) {
      const unreadCount = await Notification.getUnreadCount(req.user._id);
      req.io.to(`user:${req.user._id}`).emit('notification_deleted', {
        notificationId: notification._id,
        unreadCount
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });

  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting notification'
    });
  }
};

// @desc    Create notification (admin only)
// @route   POST /api/notifications
// @access  Private (Admin)
exports.createNotification = async (req, res) => {
  try {
    const { 
      recipient, 
      title, 
      message, 
      type = 'general', 
      priority = 'medium',
      actionUrl,
      metadata
    } = req.body;

    // Validate required fields
    if (!recipient || !title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Recipient, title, and message are required'
      });
    }

    // Validate recipient exists
    const user = await User.findById(recipient);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Recipient user not found'
      });
    }

    const notification = await Notification.create({
      recipient,
      sender: req.user._id,
      title,
      message,
      type,
      priority,
      actionUrl,
      metadata
    });

    // Populate the created notification
    const populatedNotification = await Notification.findById(notification._id)
      .populate('sender', 'fullName email role')
      .populate('recipient', 'fullName email role');

    // Emit real-time notification
    if (req.io) {
      const unreadCount = await Notification.getUnreadCount(recipient);
      req.io.to(`user:${recipient}`).emit('new_notification', {
        notification: populatedNotification,
        unreadCount
      });
    }

    res.status(201).json({
      success: true,
      data: populatedNotification,
      message: 'Notification created successfully'
    });

  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating notification'
    });
  }
};

// @desc    Get notification statistics (admin only)
// @route   GET /api/notifications/stats
// @access  Private (Admin)
exports.getNotificationStats = async (req, res) => {
  try {
    const stats = await Notification.aggregate([
      {
        $facet: {
          byType: [
            { $group: { _id: '$type', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          byPriority: [
            { $group: { _id: '$priority', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          byReadStatus: [
            { $group: { _id: '$isRead', count: { $sum: 1 } } }
          ],
          totalCount: [
            { $count: "total" }
          ]
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: stats[0]
    });

  } catch (error) {
    console.error('Get notification stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching notification statistics'
    });
  }
};

// Helper function to create ticket-related notifications
exports.createTicketNotification = async (type, ticket, recipientId, senderId = null, io = null) => {
  try {
    // Get populated ticket data if needed
    const populatedTicket = await ticket.populate('createdBy', 'fullName email');
    
    // Get sender info if provided
    let sender = null;
    if (senderId) {
      sender = await User.findById(senderId).select('fullName email role');
    }

    // Create notification using static method
    const notification = await Notification.createTicketNotification(
      type, 
      populatedTicket, 
      recipientId, 
      sender
    );

    // Populate the notification for real-time emission
    const populatedNotification = await notification.populate('sender', 'fullName email role');

    // Emit real-time notification
    if (io) {
      const unreadCount = await Notification.getUnreadCount(recipientId);
      io.to(`user:${recipientId}`).emit('new_notification', {
        notification: populatedNotification,
        unreadCount
      });
    }

    return notification;
  } catch (error) {
    console.error('Create ticket notification error:', error);
    throw error;
  }
};
