const express = require('express');
const { body, param, query } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const {
  getConversations,
  getConversation,
  createOrGetConversation,
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  getChatableUsers,
  getUnreadCount,
  markConversationAsRead,
  createGroupConversation,
  addParticipantsToGroup,
  removeParticipantFromGroup,
  updateGroupConversation,
  searchMessages,
  searchAllMessages,
  addReaction,
  removeReaction
} = require('../controllers/chat');

const router = express.Router();

// All chat routes require authentication
router.use(protect);

// Get all conversations for current user
router.get(
  '/conversations',
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('contextType')
      .optional()
      .isIn(['order', 'lead', 'general', 'support'])
      .withMessage('Invalid context type')
  ],
  getConversations
);

// Get specific conversation
router.get(
  '/conversations/:conversationId',
  [
    param('conversationId')
      .isMongoId()
      .withMessage('Invalid conversation ID')
  ],
  getConversation
);

// Create or get existing conversation
router.post(
  '/conversations',
  [
    body('participantId')
      .isMongoId()
      .withMessage('Invalid participant ID'),
    body('contextType')
      .optional()
      .isIn(['order', 'lead', 'general', 'support'])
      .withMessage('Invalid context type'),
    body('relatedOrder')
      .optional()
      .isMongoId()
      .withMessage('Invalid related order ID'),
    body('relatedLead')
      .optional()
      .isMongoId()
      .withMessage('Invalid related lead ID')
  ],
  createOrGetConversation
);

// Get messages for a conversation
router.get(
  '/conversations/:conversationId/messages',
  [
    param('conversationId')
      .isMongoId()
      .withMessage('Invalid conversation ID'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('before')
      .optional()
      .isISO8601()
      .withMessage('Before must be a valid ISO 8601 date')
  ],
  getMessages
);

// Search messages across all conversations (global search)
router.get(
  '/messages/search',
  [
    query('query')
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Search query must be between 1 and 200 characters'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50')
  ],
  searchAllMessages
);

// Search messages within a conversation
router.get(
  '/conversations/:conversationId/messages/search',
  [
    param('conversationId')
      .isMongoId()
      .withMessage('Invalid conversation ID'),
    query('query')
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Search query must be between 1 and 200 characters'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50'),
    query('skip')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Skip must be a non-negative integer')
  ],
  searchMessages
);

// Send a message
router.post(
  '/conversations/:conversationId/messages',
  [
    param('conversationId')
      .isMongoId()
      .withMessage('Invalid conversation ID'),
    body('content')
      .optional()
      .trim()
      .custom((value, { req }) => {
        // For image messages, content is completely optional
        if (req.body.messageType === 'image') {
          return true;
        }
        // For text messages, content is required
        if (!req.body.messageType || req.body.messageType === 'text') {
          if (!value || value.length === 0) {
            throw new Error('Message content is required for text messages');
          }
        }
        // Check length if content is provided
        if (value && (value.length < 1 || value.length > 5000)) {
          throw new Error('Message content must be between 1 and 5000 characters');
        }
        return true;
      }),
    body('messageType')
      .optional()
      .isIn(['text', 'file', 'image'])
      .withMessage('Invalid message type'),
    body('imageId')
      .optional()
      .isMongoId()
      .withMessage('Invalid image ID'),
    body('replyTo')
      .optional({ nullable: true })
      .isMongoId()
      .withMessage('Invalid reply message ID')
  ],
  sendMessage
);

// Edit a message
router.put(
  '/messages/:messageId',
  [
    param('messageId')
      .isMongoId()
      .withMessage('Invalid message ID'),
    body('content')
      .trim()
      .isLength({ min: 1, max: 5000 })
      .withMessage('Message content must be between 1 and 5000 characters')
  ],
  editMessage
);

// Delete a message
router.delete(
  '/messages/:messageId',
  [
    param('messageId')
      .isMongoId()
      .withMessage('Invalid message ID')
  ],
  deleteMessage
);

// Add a reaction to a message
router.post(
  '/messages/:messageId/reactions',
  [
    param('messageId')
      .isMongoId()
      .withMessage('Invalid message ID'),
    body('emoji')
      .trim()
      .notEmpty()
      .withMessage('Emoji is required')
      .isLength({ min: 1, max: 10 })
      .withMessage('Emoji must be between 1 and 10 characters')
  ],
  addReaction
);

// Remove a reaction from a message
router.delete(
  '/messages/:messageId/reactions',
  [
    param('messageId')
      .isMongoId()
      .withMessage('Invalid message ID'),
    body('emoji')
      .trim()
      .notEmpty()
      .withMessage('Emoji is required')
      .isLength({ min: 1, max: 10 })
      .withMessage('Emoji must be between 1 and 10 characters')
  ],
  removeReaction
);

// Get users that current user can chat with
router.get(
  '/users',
  [
    query('search')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Search query too long'),
    query('role')
      .optional()
      .isIn(['admin', 'affiliate_manager', 'agent', 'lead_manager'])
      .withMessage('Invalid role filter')
  ],
  getChatableUsers
);

// Get unread message count
router.get('/unread-count', getUnreadCount);

// Mark conversation as read
router.put(
  '/conversations/:conversationId/read',
  [
    param('conversationId')
      .isMongoId()
      .withMessage('Invalid conversation ID')
  ],
  markConversationAsRead
);

// GROUP CONVERSATION ROUTES (Admin only)

// Create a new group conversation
router.post(
  '/groups',
  [
    authorize('admin'), // Only admins can create groups
    body('title')
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Group title must be between 1 and 100 characters'),
    body('participantIds')
      .isArray({ min: 2 })
      .withMessage('At least 2 participants are required'),
    body('participantIds.*')
      .isMongoId()
      .withMessage('Each participant ID must be valid'),
    body('contextType')
      .optional()
      .isIn(['order', 'lead', 'general', 'support'])
      .withMessage('Invalid context type'),
    body('relatedOrder')
      .optional()
      .isMongoId()
      .withMessage('Invalid related order ID'),
    body('relatedLead')
      .optional()
      .isMongoId()
      .withMessage('Invalid related lead ID')
  ],
  createGroupConversation
);

// Add participants to a group
router.post(
  '/groups/:conversationId/participants',
  [
    authorize('admin'), // Only admins can manage group participants
    param('conversationId')
      .isMongoId()
      .withMessage('Invalid conversation ID'),
    body('participantIds')
      .isArray({ min: 1 })
      .withMessage('At least 1 participant is required'),
    body('participantIds.*')
      .isMongoId()
      .withMessage('Each participant ID must be valid')
  ],
  addParticipantsToGroup
);

// Remove a participant from a group
router.delete(
  '/groups/:conversationId/participants/:participantId',
  [
    authorize('admin'), // Only admins can manage group participants
    param('conversationId')
      .isMongoId()
      .withMessage('Invalid conversation ID'),
    param('participantId')
      .isMongoId()
      .withMessage('Invalid participant ID')
  ],
  removeParticipantFromGroup
);

// Update group conversation details
router.put(
  '/groups/:conversationId',
  [
    authorize('admin'), // Only admins can update group details
    param('conversationId')
      .isMongoId()
      .withMessage('Invalid conversation ID'),
    body('title')
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Group title must be between 1 and 100 characters')
  ],
  updateGroupConversation
);

module.exports = router; 