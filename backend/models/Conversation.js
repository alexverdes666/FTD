const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  // Participants in the conversation
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['admin', 'affiliate_manager', 'agent', 'lead_manager'],
      required: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    lastSeenAt: {
      type: Date,
      default: Date.now
    },
    // Unread message count for this participant
    unreadCount: {
      type: Number,
      default: 0
    }
  }],
  
  // Conversation metadata
  type: {
    type: String,
    enum: ['direct', 'group'], // For future expansion to group chats
    default: 'direct'
  },
  
  title: {
    type: String,
    trim: true,
    // Auto-generated for direct messages, custom for groups
    default: null
  },
  
  // Last message for quick preview
  lastMessage: {
    content: String,
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: Date,
    messageType: {
      type: String,
      enum: ['text', 'file', 'image', 'system'],
      default: 'text'
    }
  },
  
  // Context - what this conversation is about
  context: {
    // Related order, lead, or other entity
    relatedOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order'
    },
    relatedLead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead'
    },
    // Context type for filtering
    contextType: {
      type: String,
      enum: ['order', 'lead', 'general', 'support'],
      default: 'general'
    }
  },
  
  // Status and activity
  isActive: {
    type: Boolean,
    default: true
  },
  
  isArchived: {
    type: Boolean,
    default: false
  },
  
  // Created by (who initiated the conversation)
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
conversationSchema.index({ 'participants.user': 1 });
conversationSchema.index({ 'participants.user': 1, isActive: 1 });
conversationSchema.index({ 'participants.user': 1, isActive: 1, 'lastMessage.timestamp': -1 }); // Optimized for sorted queries
conversationSchema.index({ 'context.relatedOrder': 1 });
conversationSchema.index({ 'context.relatedLead': 1 });
conversationSchema.index({ createdAt: -1 });
// Compound index for findOrCreateDirect queries
conversationSchema.index({ type: 1, 'participants.user': 1, isActive: 1 }, { background: true });

// Virtual for getting other participant (in direct messages)
conversationSchema.virtual('otherParticipant').get(function() {
  if (this.type === 'direct' && this.participants.length === 2) {
    // This would be set during population based on current user
    return this._otherParticipant;
  }
  return null;
});

// Method to check if user is participant
conversationSchema.methods.isParticipant = function(userId) {
  return this.participants.some(p => p.user && p.user.toString() === userId.toString());
};

// Method to get participant by user ID
conversationSchema.methods.getParticipant = function(userId) {
  return this.participants.find(p => p.user && p.user.toString() === userId.toString());
};

// Method to update last seen for a participant
conversationSchema.methods.updateLastSeen = function(userId) {
  const participant = this.getParticipant(userId);
  if (participant) {
    participant.lastSeenAt = new Date();
    participant.unreadCount = 0;
  }
  return this.save();
};

// Method to increment unread count for all participants except sender
conversationSchema.methods.incrementUnreadCount = function(senderId) {
  this.participants.forEach(participant => {
    if (participant.user && participant.user.toString() !== senderId.toString()) {
      participant.unreadCount += 1;
    }
  });
  return this.save();
};

// Static method to find conversations for a user
conversationSchema.statics.findForUser = function(userId, options = {}) {
  const {
    limit = 50,
    skip = 0,
    isActive = true,
    contextType = null
  } = options;

  const match = {
    'participants.user': new mongoose.Types.ObjectId(userId),
    isActive
  };

  if (contextType) {
    match['context.contextType'] = contextType;
  }

  return this.find(match)
    .populate('participants.user', 'fullName email role')
    .populate('lastMessage.sender', 'fullName email role')
    .populate('context.relatedOrder', 'requests createdAt')
    .populate('context.relatedLead', 'firstName lastName leadType')
    .sort({ 'lastMessage.timestamp': -1, updatedAt: -1 })
    .limit(limit)
    .skip(skip);
};

// Optimized static method to find conversations for a user (faster with lean)
conversationSchema.statics.findForUserOptimized = function(userId, options = {}) {
  const {
    limit = 50,
    skip = 0,
    isActive = true,
    contextType = null
  } = options;

  const match = {
    'participants.user': new mongoose.Types.ObjectId(userId),
    isActive
  };

  if (contextType) {
    match['context.contextType'] = contextType;
  }

  return this.find(match)
    .select('-__v') // Exclude version key
    .populate('participants.user', 'fullName email role')
    .populate('lastMessage.sender', 'fullName email role')
    .sort({ 'lastMessage.timestamp': -1, updatedAt: -1 })
    .limit(limit)
    .skip(skip)
    .lean(); // Use lean for faster queries
};

// Static method to find or create direct conversation between two users
conversationSchema.statics.findOrCreateDirect = async function(user1Id, user2Id, context = {}) {
  // Check if conversation already exists
  let conversation = await this.findOne({
    type: 'direct',
    $and: [
      { 'participants.user': user1Id },
      { 'participants.user': user2Id }
    ],
    isActive: true
  }).populate('participants.user', 'fullName email role');

  if (conversation) {
    return { conversation, created: false };
  }

  // Get user details for role validation
  const User = mongoose.model('User');
  const [user1, user2] = await Promise.all([
    User.findById(user1Id).select('fullName email role'),
    User.findById(user2Id).select('fullName email role')
  ]);

  if (!user1 || !user2) {
    throw new Error('One or both users not found');
  }

  // Create new conversation
  conversation = new this({
    participants: [
      {
        user: user1Id,
        role: user1.role,
        joinedAt: new Date(),
        lastSeenAt: new Date(),
        unreadCount: 0
      },
      {
        user: user2Id,
        role: user2.role,
        joinedAt: new Date(),
        lastSeenAt: new Date(),
        unreadCount: 0
      }
    ],
    type: 'direct',
    createdBy: user1Id,
    context: {
      contextType: context.contextType || 'general',
      relatedOrder: context.relatedOrder || null,
      relatedLead: context.relatedLead || null
    }
  });

  await conversation.save();
  await conversation.populate('participants.user', 'fullName email role');

  return { conversation, created: true };
};

module.exports = mongoose.model('Conversation', conversationSchema); 