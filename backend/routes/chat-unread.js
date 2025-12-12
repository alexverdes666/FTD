const express = require('express');
const router = express.Router();
const { protect: auth } = require('../middleware/auth');
const Conversation = require('../models/Conversation');

// Get unread counts for all user's conversations
router.get('/unread-counts', auth, async (req, res, next) => {
  try {
    const userId = req.user._id;
    
    // Get all conversations for the user with unread counts
    const conversations = await Conversation.find({
      'participants.user': userId,
      isActive: true
    }).select('_id participants');
    
    const unreadCounts = {};
    let totalUnread = 0;
    
    conversations.forEach(conv => {
      const participant = conv.participants.find(p => p.user && p.user.toString() === userId.toString());
      const unreadCount = participant?.unreadCount || 0;
      unreadCounts[conv._id.toString()] = unreadCount;
      totalUnread += unreadCount;
    });
    
    res.json({
      success: true,
      data: {
        conversations: unreadCounts,
        total: totalUnread
      }
    });
  } catch (error) {
    next(error);
  }
});

// Mark specific conversation as read
router.post('/mark-read/:conversationId', auth, async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;
    
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }
    
    if (!conversation.isParticipant(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    // Get current unread count before updating
    const participant = conversation.getParticipant(userId);
    const currentUnreadCount = participant?.unreadCount || 0;
    
    // Reset unread count for this user
    await conversation.updateLastSeen(userId);
    
    // Only emit socket event if there was actually an unread count to reset
    if (req.io && currentUnreadCount > 0) {
      req.io.to(`user:${userId}`).emit('unread_count_updated', {
        conversationId,
        unreadCount: 0
      });
    }
    
    res.json({
      success: true,
      message: 'Conversation marked as read'
    });
  } catch (error) {
    next(error);
  }
});

// Mark all conversations as read
router.post('/mark-all-read', auth, async (req, res, next) => {
  try {
    const userId = req.user._id;
    
    // Get all conversations for this user first
    const conversations = await Conversation.find({
      'participants.user': userId
    }).select('_id');
    
    // Update all conversations where user is a participant
    await Conversation.updateMany(
      { 'participants.user': userId },
      { 
        $set: { 
          'participants.$.unreadCount': 0,
          'participants.$.lastSeenAt': new Date()
        }
      }
    );
    
    // Emit socket events for all conversations
    if (req.io) {
      conversations.forEach(conv => {
        req.io.to(`user:${userId}`).emit('unread_count_updated', {
          conversationId: conv._id.toString(),
          unreadCount: 0
        });
      });
    }
    
    res.json({
      success: true,
      message: 'All conversations marked as read'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
