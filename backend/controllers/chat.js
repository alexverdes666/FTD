const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');

// Helper function to check if user can chat with another user based on roles
const canUsersChat = async (user1, user2, context = {}) => {
  // Admins can chat with anyone
  if (user1.role === 'admin' || user2.role === 'admin') {
    return true;
  }

  // Same role users can chat with each other
  if (user1.role === user2.role) {
    return true;
  }

  // Affiliate managers can chat with agents
  if ((user1.role === 'affiliate_manager' && user2.role === 'agent') ||
      (user1.role === 'agent' && user2.role === 'affiliate_manager')) {
    return true;
  }

  // Lead managers can chat with agents and affiliate managers
  if (user1.role === 'lead_manager' || user2.role === 'lead_manager') {
    return true;
  }

  return false;
};

// Get all conversations for the current user
exports.getConversations = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, contextType } = req.query; // Increased limit since conversations are lightweight
    const skip = (page - 1) * limit;

    // Use optimized query with lean() and minimal field selection
    const conversations = await Conversation.findForUserOptimized(req.user._id, {
      limit: parseInt(limit),
      skip,
      contextType
    });

    // Calculate other participants for each conversation with minimal processing
    const conversationsWithOtherParticipants = conversations.map(conv => {
      if (conv.type === 'direct') {
        const otherParticipant = conv.participants.find(
          p => p.user && p.user._id && p.user._id.toString() !== req.user._id.toString()
        );
        conv.otherParticipant = otherParticipant ? otherParticipant.user : null;
      }
      return conv;
    });

    res.status(200).json({
      success: true,
      data: conversationsWithOtherParticipants,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(conversations.length / limit),
        hasNextPage: conversations.length === parseInt(limit),
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get a specific conversation
exports.getConversation = async (req, res, next) => {
  try {
    const { conversationId } = req.params;

    // Use lean query with optimized population for faster response
    const conversation = await Conversation.findById(conversationId)
      .populate('participants.user', 'fullName email role')
      .populate('lastMessage.sender', 'fullName email role')
      .lean();

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Check if user is participant
    const isParticipant = conversation.participants.some(
      p => p.user && p.user._id && p.user._id.toString() === req.user._id.toString()
    );
    
    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - you are not a participant in this conversation'
      });
    }

    // Mark conversation as seen for current user (async, don't wait)
    Conversation.findOneAndUpdate(
      { 
        _id: conversationId,
        'participants.user': req.user._id 
      },
      {
        $set: {
          'participants.$.lastSeenAt': new Date(),
          'participants.$.unreadCount': 0
        }
      }
    ).exec().catch(err => console.error('Error updating last seen:', err));

    // Add other participant info for direct messages
    if (conversation.type === 'direct') {
      const otherParticipant = conversation.participants.find(
        p => p.user && p.user._id && p.user._id.toString() !== req.user._id.toString()
      );
      conversation.otherParticipant = otherParticipant ? otherParticipant.user : null;
    }

    res.status(200).json({
      success: true,
      data: conversation
    });
  } catch (error) {
    next(error);
  }
};

// Create a new conversation or get existing one
exports.createOrGetConversation = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { participantId, contextType = 'general', relatedOrder, relatedLead } = req.body;

    // Validate participant exists
    const participant = await User.findById(participantId).select('fullName email role');
    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'Participant not found'
      });
    }

    // Check if users can chat
    const canChat = await canUsersChat(req.user, participant);
    if (!canChat) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to start a conversation with this user'
      });
    }

    // Create or find existing conversation
    const { conversation, created } = await Conversation.findOrCreateDirect(
      req.user._id,
      participantId,
      {
        contextType,
        relatedOrder,
        relatedLead
      }
    );

    // Add other participant info
    let conversationObj = conversation.toObject();
    const otherParticipant = conversation.participants.find(
      p => p.user && p.user._id && p.user._id.toString() !== req.user._id.toString()
    );
    conversationObj.otherParticipant = otherParticipant ? otherParticipant.user : null;

    res.status(created ? 201 : 200).json({
      success: true,
      data: conversationObj,
      created
    });
  } catch (error) {
    next(error);
  }
};

// Get messages for a conversation
exports.getMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 15, before } = req.query; // Reduced default limit to 15 for faster loading
    const skip = (page - 1) * parseInt(limit);

    // Verify user is participant - use lean for faster query
    const conversation = await Conversation.findById(conversationId).lean();
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Check participation using lean data
    const isParticipant = conversation.participants.some(
      p => p.user.toString() === req.user._id.toString()
    );
    
    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - you are not a participant in this conversation'
      });
    }

    // Use optimized query with lean() for faster serialization
    const messages = await Message.getForConversationOptimized(conversationId, {
      limit: parseInt(limit),
      skip,
      before
    });

    // Mark messages as read by current user (batch update for performance)
    const unreadMessageIds = messages
      .filter(msg => 
        !msg.readBy?.some(r => r.user.toString() === req.user._id.toString()) && 
        msg.sender._id.toString() !== req.user._id.toString()
      )
      .map(msg => msg._id);

    if (unreadMessageIds.length > 0) {
      // Batch update for better performance
      await Message.updateMany(
        { _id: { $in: unreadMessageIds } },
        { 
          $addToSet: { 
            readBy: { 
              user: req.user._id, 
              readAt: new Date() 
            } 
          } 
        }
      );

      // Emit socket event to notify other participants about read receipts
      if (req.io) {
        const readByData = {
          user: {
            _id: req.user._id,
            fullName: req.user.fullName,
            role: req.user.role
          },
          readAt: new Date()
        };

        // Notify other participants
        conversation.participants.forEach(participant => {
          if (!participant.user) return; // Skip null users
          const participantId = participant.user.toString();
          if (participantId !== req.user._id.toString()) {
            req.io.to(`user:${participantId}`).emit('messages_read', {
              conversationId,
              messageIds: unreadMessageIds,
              readBy: readByData
            });
          }
        });
      }
    }

    // Import decryption utility for lean documents
    const { decryptFromStorage } = require('../utils/messageEncryption');

    // Transform messages to include decrypted content for client
    const transformedMessages = messages.map(msg => {
      // Decrypt content manually for lean documents
      let decryptedContent;
      if (msg.encryption && msg.encryption.isEncrypted) {
        try {
          decryptedContent = decryptFromStorage(msg.encryption);
        } catch (error) {
          console.error('Error decrypting message:', error);
          decryptedContent = '[Encrypted message - decryption failed]';
        }
      } else {
        decryptedContent = msg.content;
      }

      // Create plain object for transformation
      const messageObj = {
        _id: msg._id,
        content: decryptedContent,
        messageType: msg.messageType,
        sender: msg.sender,
        conversation: msg.conversation,
        status: msg.status,
        readBy: msg.readBy,
        isEdited: msg.isEdited,
        editedAt: msg.editedAt,
        isDeleted: msg.isDeleted,
        createdAt: msg.createdAt,
        updatedAt: msg.updatedAt,
        mentions: msg.mentions,
        reactions: msg.reactions,
        attachment: msg.attachment
      };
      
      // Handle replyTo if exists
      if (msg.replyTo) {
        let replyToContent;
        if (msg.replyTo.encryption && msg.replyTo.encryption.isEncrypted) {
          try {
            replyToContent = decryptFromStorage(msg.replyTo.encryption);
          } catch (error) {
            console.error('Error decrypting reply message:', error);
            replyToContent = '[Encrypted message - decryption failed]';
          }
        } else {
          replyToContent = msg.replyTo.content;
        }

        messageObj.replyTo = {
          _id: msg.replyTo._id,
          content: replyToContent,
          sender: msg.replyTo.sender,
          messageType: msg.replyTo.messageType,
          createdAt: msg.replyTo.createdAt
        };
      }
      
      return messageObj;
    });

    // Note: Removed expensive totalCount query for performance
    // The hasMore flag is sufficient for lazy loading
    res.status(200).json({
      success: true,
      data: transformedMessages.reverse(), // Reverse to show oldest first
      pagination: {
        currentPage: parseInt(page),
        limit: parseInt(limit),
        hasMore: messages.length === parseInt(limit),
        loadedCount: transformedMessages.length
      }
    });
  } catch (error) {
    next(error);
  }
};

// Send a message
exports.sendMessage = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { conversationId } = req.params;
    const { content, messageType = 'text', replyTo, imageId } = req.body;

    // Validate message content based on type
    if (messageType === 'image') {
      if (!imageId) {
        return res.status(400).json({
          success: false,
          message: 'Image ID is required for image messages'
        });
      }
      
      // Verify image exists and belongs to user
      const ChatImage = require('../models/ChatImage');
      const chatImage = await ChatImage.findById(imageId);
      if (!chatImage) {
        return res.status(404).json({
          success: false,
          message: 'Image not found'
        });
      }
      
      if (chatImage.uploadedBy.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only send images you uploaded'
        });
      }
    } else if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required for text messages'
      });
    }

    // Verify conversation exists and user is participant
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    if (!conversation.isParticipant(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - you are not a participant in this conversation'
      });
    }

    // Parse mentions from message content (e.g., @username or @[User Name](userId))
    const mentions = [];
    if (messageType === 'text' && content) {
      // Match @[DisplayName](userId) format
      const mentionRegex = /@\[([^\]]+)\]\(([a-f0-9]{24})\)/g;
      let match;
      while ((match = mentionRegex.exec(content)) !== null) {
        const userId = match[2];
        if (mongoose.Types.ObjectId.isValid(userId) && !mentions.includes(userId)) {
          mentions.push(userId);
        }
      }
    }

    // Create message
    const messageData = {
      messageType,
      sender: req.user._id,
      conversation: conversationId,
      replyTo: replyTo || null,
      mentions: mentions
    };

    if (messageType === 'image') {
      // For image messages, store image reference
      const ChatImage = require('../models/ChatImage');
      const chatImage = await ChatImage.findById(imageId);
      
      messageData.content = content || `📷 ${chatImage.originalName}`;
      messageData.attachment = {
        filename: chatImage._id.toString(),
        originalName: chatImage.originalName,
        mimetype: chatImage.mimetype,
        size: chatImage.processedSize,
        url: chatImage.url
      };
      
      // Increment image usage
      await chatImage.incrementUsage();
    } else {
      messageData.content = content;
    }

    const message = new Message(messageData);

    await message.save();
    await message.populate('sender', 'fullName email role');
    await message.populate('mentions', 'fullName email role');
    
    // Populate replyTo if it exists
    if (message.replyTo) {
      await message.populate({
        path: 'replyTo',
        select: 'content sender messageType encryption createdAt',
        populate: {
          path: 'sender',
          select: 'fullName email role'
        }
      });
    }

    // Transform message for client response (with decrypted content)
    const messageForClient = message.toObject();
    messageForClient.content = message.decryptedContent;
    delete messageForClient.encryption; // Don't send encryption data to client
    
    // Also decrypt the replyTo message content if it exists
    if (messageForClient.replyTo && message.replyTo) {
      messageForClient.replyTo.content = message.replyTo.decryptedContent || message.replyTo.content;
      delete messageForClient.replyTo.encryption; // Don't send encryption data
    }

    // Manually increment unread count for better control over timing
    await conversation.incrementUnreadCount(req.user._id);
    
    // Reload conversation with updated unread counts
    await conversation.populate('participants.user', 'fullName email role');

    // Emit socket event to other participants
    if (req.io) {
      // Get other participants with updated unread counts
      const otherParticipants = conversation.participants
        .filter(p => {
          if (!p.user) return false; // Skip null users
          const participantUserId = p.user._id ? p.user._id.toString() : p.user.toString();
          const currentUserId = req.user._id.toString();
          return participantUserId !== currentUserId;
        });

      // Emit to other participants with decrypted content and unread count
      otherParticipants.forEach(participant => {
        if (!participant.user) return; // Skip if user is null
        const participantId = participant.user._id ? participant.user._id.toString() : participant.user.toString();
        
        // Check if this participant was mentioned
        const wasMentioned = mentions.includes(participantId);
        
        // Emit new message with mention flag
        req.io.to(`user:${participantId}`).emit('new_message', {
          conversationId,
          message: messageForClient,
          wasMentioned
        });

        // Always emit unread count update for other participants
        req.io.to(`user:${participantId}`).emit('unread_count_updated', {
          conversationId,
          unreadCount: participant.unreadCount
        });

        // Send special mention notification if user was mentioned
        if (wasMentioned) {
          req.io.to(`user:${participantId}`).emit('user_mentioned', {
            conversationId,
            message: messageForClient,
            mentionedBy: {
              _id: req.user._id,
              fullName: req.user.fullName
            }
          });
        }
      });
    }

    res.status(201).json({
      success: true,
      data: messageForClient
    });
  } catch (error) {
    next(error);
  }
};

// Edit a message
exports.editMessage = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { messageId } = req.params;
    const { content } = req.body;

    const message = await Message.findById(messageId)
      .populate('sender', 'fullName email role');

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Only sender can edit their own message
    if (message.sender._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only edit your own messages'
      });
    }

    await message.edit(content, req.user._id);

    // Transform message for client response (with decrypted content)
    const messageForClient = message.toObject();
    messageForClient.content = message.decryptedContent;
    delete messageForClient.encryption;

    // Emit socket event
    if (req.io) {
      const conversation = await Conversation.findById(message.conversation);
      const allParticipants = conversation.participants
        .filter(p => p.user) // Skip null users
        .map(p => p.user.toString());

      // Emit to ALL participants (including sender for multi-device support)
      allParticipants.forEach(participantId => {
        req.io.to(`user:${participantId}`).emit('message_edited', {
          conversationId: message.conversation,
          messageId: message._id,
          newContent: message.decryptedContent, // Send decrypted content
          isEdited: true,
          editedAt: message.editedAt
        });
      });
    }

    res.status(200).json({
      success: true,
      data: messageForClient
    });
  } catch (error) {
    next(error);
  }
};

// Delete a message
exports.deleteMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId)
      .populate('sender', 'fullName email role');

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Only sender or admin can delete
    if (message.sender._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own messages'
      });
    }

    await message.softDelete(req.user._id);

    // Emit socket event
    if (req.io) {
      const conversation = await Conversation.findById(message.conversation);
      const otherParticipants = conversation.participants
        .filter(p => p.user && p.user.toString() !== req.user._id.toString()) // Skip null users
        .map(p => p.user.toString());

      otherParticipants.forEach(participantId => {
        req.io.to(`user:${participantId}`).emit('message_deleted', {
          conversationId: message.conversation,
          messageId: message._id
        });
      });
    }

    res.status(200).json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Get users that current user can chat with
exports.getChatableUsers = async (req, res, next) => {
  try {
    const { search = '', role } = req.query;
    const currentUser = req.user;

    let userFilter = {
      _id: { $ne: currentUser._id },
      isActive: true,
      status: 'approved'
    };

    // Role-based filtering
    if (currentUser.role === 'admin') {
      // Admins can chat with anyone
      if (role) {
        userFilter.role = role;
      }
    } else if (currentUser.role === 'affiliate_manager') {
      // Affiliate managers can chat with agents, other managers, and admins
      userFilter.role = { $in: ['agent', 'affiliate_manager', 'admin', 'lead_manager'] };
      if (role) {
        userFilter.role = role;
      }
    } else if (currentUser.role === 'agent') {
      // Agents can chat with affiliate managers, other agents, and admins
      userFilter.role = { $in: ['affiliate_manager', 'agent', 'admin', 'lead_manager'] };
      if (role) {
        userFilter.role = role;
      }
    } else if (currentUser.role === 'lead_manager') {
      // Lead managers can chat with agents, affiliate managers, and admins
      userFilter.role = { $in: ['agent', 'affiliate_manager', 'admin'] };
      if (role) {
        userFilter.role = role;
      }
    }

    // Add search filter
    if (search) {
      userFilter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(userFilter)
      .select('fullName email role')
      .sort({ fullName: 1 })
      .limit(50);

    res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    next(error);
  }
};

// Get unread message count
exports.getUnreadCount = async (req, res, next) => {
  try {
    const conversations = await Conversation.find({
      'participants.user': req.user._id,
      isActive: true
    });

    let totalUnread = 0;
    conversations.forEach(conv => {
      const participant = conv.getParticipant(req.user._id);
      if (participant) {
        totalUnread += participant.unreadCount || 0;
      }
    });

    res.status(200).json({
      success: true,
      data: {
        totalUnread,
        conversationCount: conversations.length
      }
    });
  } catch (error) {
    next(error);
  }
};

// Mark conversation as read
exports.markConversationAsRead = async (req, res, next) => {
  try {
    const { conversationId } = req.params;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    if (!conversation.isParticipant(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - you are not a participant in this conversation'
      });
    }

    await conversation.updateLastSeen(req.user._id);

    res.status(200).json({
      success: true,
      message: 'Conversation marked as read'
    });
  } catch (error) {
    next(error);
  }
};

// Create a new group conversation (admin only) 
exports.createGroupConversation = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    // Only admins can create group conversations
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can create group conversations'
      });
    }

    const { title, participantIds, contextType = 'general', relatedOrder, relatedLead } = req.body;

    // Validate required fields
    if (!title || !participantIds || !Array.isArray(participantIds) || participantIds.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Group title and at least 2 participants are required'
      });
    }

    // Validate all participants exist
    const participants = await User.find({
      _id: { $in: participantIds },
      isActive: true,
      status: 'approved'
    }).select('fullName email role');

    if (participants.length !== participantIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some participants were not found or are not active'
      });
    }

    // Create participants array with roles
    const conversationParticipants = participants.map(participant => ({
      user: participant._id,
      role: participant.role,
      joinedAt: new Date(),
      lastSeenAt: new Date(),
      unreadCount: 0
    }));

    // Add the admin who created the group if not already included
    const adminAlreadyIncluded = participantIds.some(id => id.toString() === req.user._id.toString());
    if (!adminAlreadyIncluded) {
      conversationParticipants.push({
        user: req.user._id,
        role: req.user.role,
        joinedAt: new Date(),
        lastSeenAt: new Date(),
        unreadCount: 0
      });
    }

    // Create the group conversation
    const conversation = new Conversation({
      participants: conversationParticipants,
      type: 'group',
      title: title.trim(),
      createdBy: req.user._id,
      context: {
        contextType,
        relatedOrder: relatedOrder || null,
        relatedLead: relatedLead || null
      }
    });

    await conversation.save();
    await conversation.populate('participants.user', 'fullName email role');

    // Send a system message to announce the group creation
    const systemMessage = new Message({
      content: `Group "${title}" created by ${req.user.fullName}`,
      messageType: 'system',
      sender: req.user._id,
      conversation: conversation._id
    });
    await systemMessage.save();
    await systemMessage.populate('sender', 'fullName email role');

    // Update conversation's lastMessage
    conversation.lastMessage = {
      content: systemMessage.content,
      sender: systemMessage.sender._id,
      timestamp: systemMessage.createdAt,
      messageType: 'system'
    };
    await conversation.save();

    res.status(201).json({
      success: true,
      data: conversation.toObject(),
      message: 'Group conversation created successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Add participants to a group conversation (admin only)
exports.addParticipantsToGroup = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { conversationId } = req.params;
    const { participantIds } = req.body;

    // Only admins can manage group participants
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can manage group participants'
      });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    if (conversation.type !== 'group') {
      return res.status(400).json({
        success: false,
        message: 'This operation is only available for group conversations'
      });
    }

    // Validate participants exist
    const newParticipants = await User.find({
      _id: { $in: participantIds },
      isActive: true,
      status: 'approved'
    }).select('fullName email role');

    if (newParticipants.length !== participantIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some participants were not found or are not active'
      });
    }

    // Filter out participants who are already in the group
    const existingParticipantIds = conversation.participants.map(p => p.user.toString());
    const participantsToAdd = newParticipants.filter(p => 
      !existingParticipantIds.includes(p._id.toString())
    );

    if (participantsToAdd.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'All specified users are already participants in this group'
      });
    }

    // Add new participants
    const newParticipantObjects = participantsToAdd.map(participant => ({
      user: participant._id,
      role: participant.role,
      joinedAt: new Date(),
      lastSeenAt: new Date(),
      unreadCount: 0
    }));

    conversation.participants.push(...newParticipantObjects);
    await conversation.save();
    await conversation.populate('participants.user', 'fullName email role');

    // Send system message about new participants
    const addedNames = participantsToAdd.map(p => p.fullName).join(', ');
    const systemMessage = new Message({
      content: `${addedNames} added to the group by ${req.user.fullName}`,
      messageType: 'system',
      sender: req.user._id,
      conversation: conversation._id
    });
    await systemMessage.save();

    // Emit socket event to all participants
    if (req.io) {
      conversation.participants.forEach(participant => {
        if (participant.user && participant.user._id) {
          req.io.to(`user:${participant.user._id}`).emit('group_updated', {
            conversationId: conversation._id,
            action: 'participants_added',
            addedParticipants: participantsToAdd.map(p => ({
              _id: p._id,
              fullName: p.fullName,
              role: p.role
            }))
          });
        }
      });
    }

    res.status(200).json({
      success: true,
      data: conversation.toObject(),
      message: `${participantsToAdd.length} participant(s) added successfully`
    });
  } catch (error) {
    next(error);
  }
};

// Remove participants from a group conversation (admin only)
exports.removeParticipantFromGroup = async (req, res, next) => {
  try {
    const { conversationId, participantId } = req.params;

    // Only admins can manage group participants
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can manage group participants'
      });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    if (conversation.type !== 'group') {
      return res.status(400).json({
        success: false,
        message: 'This operation is only available for group conversations'
      });
    }

    // Find the participant to remove
    const participantIndex = conversation.participants.findIndex(
      p => p.user.toString() === participantId
    );

    if (participantIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Participant not found in this conversation'
      });
    }

    // Get participant info before removing
    const removedParticipant = await User.findById(participantId).select('fullName');
    
    // Remove the participant
    conversation.participants.splice(participantIndex, 1);
    
    // Ensure at least 2 participants remain in group
    if (conversation.participants.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove participant - group must have at least 2 members'
      });
    }

    await conversation.save();
    await conversation.populate('participants.user', 'fullName email role');

    // Send system message about participant removal
    const systemMessage = new Message({
      content: `${removedParticipant.fullName} removed from the group by ${req.user.fullName}`,
      messageType: 'system',
      sender: req.user._id,
      conversation: conversation._id
    });
    await systemMessage.save();

    // Emit socket events
    if (req.io) {
      // Notify remaining participants
      conversation.participants.forEach(participant => {
        if (participant.user && participant.user._id) {
          req.io.to(`user:${participant.user._id}`).emit('group_updated', {
            conversationId: conversation._id,
            action: 'participant_removed',
            removedParticipant: {
              _id: participantId,
              fullName: removedParticipant.fullName
            }
          });
        }
      });

      // Notify the removed participant
      req.io.to(`user:${participantId}`).emit('group_updated', {
        conversationId: conversation._id,
        action: 'removed_from_group'
      });
    }

    res.status(200).json({
      success: true,
      data: conversation.toObject(),
      message: 'Participant removed successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Update group conversation details (admin only)
exports.updateGroupConversation = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { conversationId } = req.params;
    const { title } = req.body;

    // Only admins can update group details
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can update group details'
      });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    if (conversation.type !== 'group') {
      return res.status(400).json({
        success: false,
        message: 'This operation is only available for group conversations'
      });
    }

    const oldTitle = conversation.title;
    conversation.title = title.trim();
    await conversation.save();
    await conversation.populate('participants.user', 'fullName email role');

    // Send system message about title change
    const systemMessage = new Message({
      content: `Group name changed from "${oldTitle}" to "${title}" by ${req.user.fullName}`,
      messageType: 'system',
      sender: req.user._id,
      conversation: conversation._id
    });
    await systemMessage.save();

    // Emit socket event to all participants
    if (req.io) {
      conversation.participants.forEach(participant => {
        if (participant.user && participant.user._id) {
          req.io.to(`user:${participant.user._id}`).emit('group_updated', {
            conversationId: conversation._id,
            action: 'title_updated',
            newTitle: title,
            oldTitle: oldTitle
          });
        }
      });
    }

    res.status(200).json({
      success: true,
      data: conversation.toObject(),
      message: 'Group updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Add a reaction to a message
exports.addReaction = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { messageId } = req.params;
    const { emoji } = req.body;

    const message = await Message.findById(messageId)
      .populate('sender', 'fullName email role')
      .populate('reactions.user', 'fullName email role');

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Verify user is participant in the conversation
    const conversation = await Conversation.findById(message.conversation);
    if (!conversation || !conversation.isParticipant(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - you are not a participant in this conversation'
      });
    }

    // Toggle reaction (add if not present, remove if present)
    await message.toggleReaction(req.user._id, emoji);
    
    // Reload message with populated reactions
    await message.populate('reactions.user', 'fullName email role');

    // Transform message for client response (with decrypted content)
    const messageForClient = message.toObject();
    messageForClient.content = message.decryptedContent;
    delete messageForClient.encryption;

    // Emit socket event to all participants
    if (req.io) {
      const otherParticipants = conversation.participants
        .filter(p => {
          if (!p.user) return false; // Skip null users
          const participantUserId = p.user._id ? p.user._id.toString() : p.user.toString();
          return participantUserId !== req.user._id.toString();
        });

      // Emit to all participants (including sender for multi-device support)
      conversation.participants.forEach(participant => {
        if (!participant.user) return; // Skip if user is null
        const participantId = participant.user._id ? participant.user._id.toString() : participant.user.toString();
        req.io.to(`user:${participantId}`).emit('message_reaction_updated', {
          conversationId: conversation._id.toString(),
          messageId: message._id.toString(),
          reactions: message.reactions
        });
      });
    }

    res.status(200).json({
      success: true,
      data: messageForClient
    });
  } catch (error) {
    next(error);
  }
};

// Remove a reaction from a message
exports.removeReaction = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { messageId } = req.params;
    const { emoji } = req.body;

    const message = await Message.findById(messageId)
      .populate('sender', 'fullName email role')
      .populate('reactions.user', 'fullName email role');

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Verify user is participant in the conversation
    const conversation = await Conversation.findById(message.conversation);
    if (!conversation || !conversation.isParticipant(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - you are not a participant in this conversation'
      });
    }

    // Remove reaction
    await message.removeReaction(req.user._id, emoji);
    
    // Reload message with populated reactions
    await message.populate('reactions.user', 'fullName email role');

    // Transform message for client response (with decrypted content)
    const messageForClient = message.toObject();
    messageForClient.content = message.decryptedContent;
    delete messageForClient.encryption;

    // Emit socket event to all participants
    if (req.io) {
      const otherParticipants = conversation.participants
        .filter(p => {
          if (!p.user) return false; // Skip null users
          const participantUserId = p.user._id ? p.user._id.toString() : p.user.toString();
          return participantUserId !== req.user._id.toString();
        });

      // Emit to all participants (including sender for multi-device support)
      conversation.participants.forEach(participant => {
        if (!participant.user) return; // Skip if user is null
        const participantId = participant.user._id ? participant.user._id.toString() : participant.user.toString();
        req.io.to(`user:${participantId}`).emit('message_reaction_updated', {
          conversationId: conversation._id.toString(),
          messageId: message._id.toString(),
          reactions: message.reactions
        });
      });
    }

    res.status(200).json({
      success: true,
      data: messageForClient
    });
  } catch (error) {
    next(error);
  }
};

// Search messages across all user's conversations (global search)
exports.searchAllMessages = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { query: searchQuery, limit = 30 } = req.query;

    if (!searchQuery || !searchQuery.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    // Get all conversations where user is a participant
    const userConversations = await Conversation.find({
      'participants.user': req.user._id,
      isActive: true
    }).select('_id type title participants').lean();

    if (userConversations.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        searchQuery: searchQuery.trim()
      });
    }

    const conversationIds = userConversations.map(c => c._id);

    // Build search criteria for all user conversations
    const searchCriteria = {
      conversation: { $in: conversationIds },
      isDeleted: false,
      messageType: { $in: ['text', 'system'] }
    };

    try {
      // Search in plain text content
      const plainTextResults = await Message.find({
        ...searchCriteria,
        'encryption.isEncrypted': { $ne: true },
        content: { $regex: searchQuery.trim(), $options: 'i' }
      })
      .populate('sender', 'fullName email role')
      .populate('conversation', 'type title participants')
      .populate({
        path: 'conversation',
        populate: {
          path: 'participants.user',
          select: 'fullName email role'
        }
      })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

      // For encrypted messages, get and filter after decryption
      const encryptedMessages = await Message.find({
        ...searchCriteria,
        'encryption.isEncrypted': true
      })
      .populate('sender', 'fullName email role')
      .populate('conversation', 'type title participants')
      .populate({
        path: 'conversation',
        populate: {
          path: 'participants.user',
          select: 'fullName email role'
        }
      })
      .sort({ createdAt: -1 })
      .limit(200); // Limit for performance

      // Filter encrypted messages by decrypted content
      const matchingEncryptedMessages = encryptedMessages.filter(msg => {
        try {
          const decryptedContent = msg.decryptedContent;
          return decryptedContent && decryptedContent.toLowerCase().includes(searchQuery.trim().toLowerCase());
        } catch (error) {
          return false;
        }
      });

      // Combine and sort results
      const allResults = [...plainTextResults, ...matchingEncryptedMessages];
      allResults.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // Apply limit
      const limitedResults = allResults.slice(0, parseInt(limit));

      // Transform messages
      const transformedMessages = limitedResults.map(msg => {
        const messageObj = msg.toObject();
        messageObj.content = msg.decryptedContent;
        delete messageObj.encryption;

        // Get conversation display name
        if (messageObj.conversation) {
          if (messageObj.conversation.type === 'group') {
            messageObj.conversationTitle = messageObj.conversation.title || 'Group Chat';
          } else {
            // For direct chats, find the other participant
            const otherParticipant = messageObj.conversation.participants?.find(
              p => p.user && p.user._id.toString() !== req.user._id.toString()
            );
            messageObj.conversationTitle = otherParticipant?.user?.fullName || 'Direct Chat';
          }
          messageObj.conversationId = messageObj.conversation._id;
          messageObj.conversationType = messageObj.conversation.type;
        }

        // Add highlight
        const highlightedContent = messageObj.content.replace(
          new RegExp(`(${searchQuery.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
          '<mark>$1</mark>'
        );
        messageObj.highlightedContent = highlightedContent;

        return messageObj;
      });

      res.status(200).json({
        success: true,
        data: transformedMessages,
        total: transformedMessages.length,
        searchQuery: searchQuery.trim()
      });
    } catch (searchError) {
      console.error('Error during global message search:', searchError);
      return res.status(500).json({
        success: false,
        message: 'Error performing search'
      });
    }
  } catch (error) {
    next(error);
  }
};

// Search messages within a conversation
exports.searchMessages = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { conversationId } = req.params;
    const { query: searchQuery, limit = 20, skip = 0 } = req.query;

    // Verify conversation exists and user is participant
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    if (!conversation.isParticipant(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - you are not a participant in this conversation'
      });
    }

    if (!searchQuery || !searchQuery.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    // Build search criteria
    const searchCriteria = {
      conversation: conversationId,
      isDeleted: false,
      messageType: { $in: ['text', 'system'] } // Only search text and system messages
    };

    // For encrypted messages, we'll need to search through all messages
    // and filter them after decryption (not ideal for large datasets, but necessary for encrypted content)
    let messages;
    
    try {
      // First, try to search in plain text content (for non-encrypted messages)
      const plainTextResults = await Message.find({
        ...searchCriteria,
        'encryption.isEncrypted': { $ne: true },
        content: { $regex: searchQuery.trim(), $options: 'i' }
      })
      .populate('sender', 'fullName email role')
      .populate('mentions', 'fullName email role')
      .populate('replyTo', 'content sender messageType createdAt encryption')
      .populate({
        path: 'replyTo',
        populate: {
          path: 'sender',
          select: 'fullName email role'
        }
      })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

      // For encrypted messages, we need to get all encrypted messages and search after decryption
      const encryptedMessages = await Message.find({
        ...searchCriteria,
        'encryption.isEncrypted': true
      })
      .populate('sender', 'fullName email role')
      .populate('mentions', 'fullName email role')
      .populate('replyTo', 'content sender messageType createdAt encryption')
      .populate({
        path: 'replyTo',
        populate: {
          path: 'sender',
          select: 'fullName email role'
        }
      })
      .sort({ createdAt: -1 });

      // Filter encrypted messages by decrypted content
      const matchingEncryptedMessages = encryptedMessages.filter(msg => {
        try {
          const decryptedContent = msg.decryptedContent;
          return decryptedContent && decryptedContent.toLowerCase().includes(searchQuery.trim().toLowerCase());
        } catch (error) {
          console.error('Error decrypting message during search:', error);
          return false;
        }
      });

      // Combine and sort results
      const allResults = [...plainTextResults, ...matchingEncryptedMessages];
      allResults.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // Apply pagination to combined results
      messages = allResults.slice(parseInt(skip), parseInt(skip) + parseInt(limit));

    } catch (searchError) {
      console.error('Error during message search:', searchError);
      return res.status(500).json({
        success: false,
        message: 'Error performing search'
      });
    }

    // Transform messages to include decrypted content for client
    const transformedMessages = messages.map(msg => {
      const messageObj = msg.toObject();
      messageObj.content = msg.decryptedContent; // Use decrypted content
      delete messageObj.encryption; // Don't send encryption data to client
      
      // Also decrypt the replyTo message content if it exists
      if (messageObj.replyTo && msg.replyTo) {
        messageObj.replyTo.content = msg.replyTo.decryptedContent || msg.replyTo.content;
        delete messageObj.replyTo.encryption; // Don't send encryption data
      }
      
      // Add search highlight info (simple implementation)
      const highlightedContent = messageObj.content.replace(
        new RegExp(`(${searchQuery.trim()})`, 'gi'),
        '<mark>$1</mark>'
      );
      messageObj.highlightedContent = highlightedContent;
      
      return messageObj;
    });

    res.status(200).json({
      success: true,
      data: transformedMessages,
      pagination: {
        total: messages.length,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: messages.length === parseInt(limit)
      },
      searchQuery: searchQuery.trim()
    });
  } catch (error) {
    next(error);
  }
}; 