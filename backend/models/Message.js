const mongoose = require('mongoose');
const { encryptForStorage, decryptFromStorage } = require('../utils/messageEncryption');

const messageSchema = new mongoose.Schema({
  // Message content (can be plain text or encrypted)
  content: {
    type: String,
    required: function() {
      // Content is required if message is not encrypted
      return !this.encryption || !this.encryption.isEncrypted;
    },
    trim: true,
    maxlength: 5000 // Prevent extremely long messages
  },
  
  // Encryption data for secure message storage
  encryption: {
    isEncrypted: {
      type: Boolean,
      default: false
    },
    encryptedContent: {
      type: String,
      required: function() {
        return this.encryption && this.encryption.isEncrypted;
      }
    },
    iv: {
      type: String,
      required: function() {
        return this.encryption && this.encryption.isEncrypted;
      }
    },
    authTag: {
      type: String,
      required: function() {
        return this.encryption && this.encryption.isEncrypted;
      }
    },
    algorithm: {
      type: String,
      default: 'aes-256-gcm'
    }
  },
  
  // Message type
  messageType: {
    type: String,
    enum: ['text', 'file', 'image', 'system'],
    default: 'text'
  },
  
  // Who sent the message
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Which conversation this belongs to
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  
  // File attachment (for file/image messages)
  attachment: {
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    url: String // URL to access the file
  },
  
  // Message status
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read', 'failed'],
    default: 'sent'
  },
  
  // Read receipts - track who has read this message
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Reply to another message (for threading)
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  
  // Mentioned users (for @mentions)
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Message editing
  isEdited: {
    type: Boolean,
    default: false
  },
  
  editedAt: {
    type: Date
  },
  
  originalContent: {
    type: String // Store original content if edited
  },
  
  // Reactions to message
  reactions: [{
    emoji: {
      type: String,
      required: true,
      trim: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    reactedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false
  },
  
  deletedAt: {
    type: Date
  },
  
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // System message metadata (for automated messages)
  systemData: {
    action: String, // 'order_created', 'lead_assigned', etc.
    relatedEntity: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'systemData.entityType'
    },
    entityType: {
      type: String,
      enum: ['Order', 'Lead', 'User']
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
messageSchema.index({ conversation: 1, createdAt: -1 }); // Primary query pattern
messageSchema.index({ conversation: 1, isDeleted: 1, createdAt: -1 }); // Optimized for common filtered queries
messageSchema.index({ sender: 1 });
messageSchema.index({ conversation: 1, messageType: 1 });
messageSchema.index({ 'readBy.user': 1 });
messageSchema.index({ 'reactions.user': 1 });
// Compound index for optimized pagination queries
messageSchema.index({ conversation: 1, isDeleted: 1, createdAt: -1 }, { background: true });

// Virtual for formatted timestamp
messageSchema.virtual('formattedTime').get(function() {
  if (!this.createdAt) return '';
  return this.createdAt.toLocaleTimeString();
});

// Virtual for decrypted content - this will handle both encrypted and plain text messages
messageSchema.virtual('decryptedContent').get(function() {
  try {
    if (this.encryption && this.encryption.isEncrypted) {
      // Decrypt the message content
      return decryptFromStorage(this.encryption);
    } else {
      // Return plain text content for non-encrypted messages
      return this.content;
    }
  } catch (error) {
    console.error('Error decrypting message content:', error);
    return '[Encrypted message - decryption failed]';
  }
});

// Method to mark as read by a user
messageSchema.methods.markAsRead = function(userId) {
  // Check if already read by this user
  const alreadyRead = this.readBy.some(read => read.user.toString() === userId.toString());
  
  if (!alreadyRead) {
    this.readBy.push({
      user: userId,
      readAt: new Date()
    });
  }
  
  return this.save();
};

// Method to check if read by a user
messageSchema.methods.isReadBy = function(userId) {
  return this.readBy.some(read => read.user.toString() === userId.toString());
};

// Method to encrypt message content
messageSchema.methods.encryptContent = function(content) {
  try {
    const encryptedData = encryptForStorage(content);
    if (encryptedData && encryptedData.isEncrypted) {
      this.encryption = encryptedData;
      this.content = undefined; // Clear plain text content
    } else {
      // If encryption fails, store as plain text
      this.content = content;
      this.encryption = { isEncrypted: false };
    }
  } catch (error) {
    console.error('Error encrypting message content:', error);
    // Fallback to plain text if encryption fails
    this.content = content;
    this.encryption = { isEncrypted: false };
  }
};

// Method to edit message content
messageSchema.methods.edit = function(newContent, editorId) {
  // Only sender can edit their own messages
  // Handle both populated and unpopulated sender
  const senderId = this.sender._id ? this.sender._id.toString() : this.sender.toString();
  if (senderId !== editorId.toString()) {
    throw new Error('Only the sender can edit this message');
  }
  
  // Can't edit system messages
  if (this.messageType === 'system') {
    throw new Error('System messages cannot be edited');
  }
  
  // Store original content if not already edited
  if (!this.isEdited) {
    this.originalContent = this.decryptedContent; // Store decrypted original content
  }
  
  // Encrypt the new content
  this.encryptContent(newContent);
  this.isEdited = true;
  this.editedAt = new Date();
  
  return this.save();
};

// Method to soft delete message
messageSchema.methods.softDelete = function(deleterId) {
  // Only sender or admin can delete
  // This will be validated at the route level
  
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deleterId;
  
  return this.save();
};

// Method to add a reaction
messageSchema.methods.addReaction = function(userId, emoji) {
  // Check if user has already reacted with this emoji
  const existingReaction = this.reactions.find(
    r => r.user.toString() === userId.toString() && r.emoji === emoji
  );
  
  if (existingReaction) {
    // User already reacted with this emoji, do nothing
    return this.save();
  }
  
  // Add new reaction
  this.reactions.push({
    emoji,
    user: userId,
    reactedAt: new Date()
  });
  
  return this.save();
};

// Method to remove a reaction
messageSchema.methods.removeReaction = function(userId, emoji) {
  // Find the reaction to remove
  const reactionIndex = this.reactions.findIndex(
    r => r.user.toString() === userId.toString() && r.emoji === emoji
  );
  
  if (reactionIndex !== -1) {
    this.reactions.splice(reactionIndex, 1);
  }
  
  return this.save();
};

// Method to toggle a reaction (add if not present, remove if present)
messageSchema.methods.toggleReaction = function(userId, emoji) {
  const existingReactionIndex = this.reactions.findIndex(
    r => r.user.toString() === userId.toString() && r.emoji === emoji
  );
  
  if (existingReactionIndex !== -1) {
    // Remove existing reaction
    this.reactions.splice(existingReactionIndex, 1);
  } else {
    // Add new reaction
    this.reactions.push({
      emoji,
      user: userId,
      reactedAt: new Date()
    });
  }
  
  return this.save();
};

// Static method to get messages for a conversation
messageSchema.statics.getForConversation = function(conversationId, options = {}) {
  const {
    limit = 50,
    skip = 0,
    before = null, // Get messages before this timestamp (for pagination)
    includeDeleted = false
  } = options;

  const match = {
    conversation: conversationId
  };

  if (!includeDeleted) {
    match.isDeleted = false;
  }

  if (before) {
    match.createdAt = { $lt: new Date(before) };
  }

  return this.find(match)
    .populate('sender', 'fullName email role')
    .populate('mentions', 'fullName email role')
    .populate('reactions.user', 'fullName email role')
    .populate('readBy.user', 'fullName email role') // Populate readBy users for "seen by" feature
    .populate('replyTo', 'content sender messageType createdAt encryption')
    .populate({
      path: 'replyTo',
      populate: {
        path: 'sender',
        select: 'fullName email role'
      }
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

// Optimized static method to get messages for a conversation (faster with minimal population)
messageSchema.statics.getForConversationOptimized = function(conversationId, options = {}) {
  const {
    limit = 15,
    skip = 0,
    before = null,
    includeDeleted = false
  } = options;

  const match = {
    conversation: conversationId
  };

  if (!includeDeleted) {
    match.isDeleted = false;
  }

  if (before) {
    match.createdAt = { $lt: new Date(before) };
  }

  // Use lean query with minimal population for faster response
  return this.find(match)
    .select('-__v -originalContent -systemData') // Exclude unnecessary fields
    .populate('sender', 'fullName role') // Reduced fields
    .populate('mentions', 'fullName role') // Reduced fields
    .populate('readBy.user', 'fullName role') // Populate readBy users for "seen by" feature
    .populate({
      path: 'replyTo',
      select: 'content sender messageType createdAt encryption',
      populate: {
        path: 'sender',
        select: 'fullName role'
      }
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .lean(); // Critical for performance - returns plain JS objects
};

// Static method to create system message
messageSchema.statics.createSystemMessage = function(conversationId, action, data = {}) {
  const systemMessages = {
    order_created: `New order created: ${data.orderType || 'Order'}`,
    lead_assigned: `Lead assigned: ${data.leadName || 'Lead'}`,
    user_joined: `${data.userName} joined the conversation`,
    user_left: `${data.userName} left the conversation`
  };

  const content = systemMessages[action] || `System action: ${action}`;

  return this.create({
    content,
    messageType: 'system',
    conversation: conversationId,
    sender: data.systemUserId || null, // Could be null for pure system messages
    systemData: {
      action,
      relatedEntity: data.relatedEntity || null,
      entityType: data.entityType || null
    }
  });
};

// Pre-save middleware to encrypt message content
messageSchema.pre('save', function(next) {
  try {
    // Capture isNew flag before it gets changed
    if (this.isNew) {
      this._wasNew = true;
    }
    
    // Store plain text content before encryption for conversation preview
    if (this.isNew && this.content && (!this.encryption || !this.encryption.isEncrypted)) {
      // Store the plain text content temporarily
      this._plainTextContent = this.content;
      
      // Don't encrypt system messages (optional - you can enable this if needed)
      if (this.messageType !== 'system') {
        this.encryptContent(this.content);
      }
    }
    next();
  } catch (error) {
    console.error('Error in pre-save encryption:', error);
    next(); // Continue saving even if encryption fails
  }
});

// Update conversation's last message when a new message is created
messageSchema.post('save', async function() {
  if (this._wasNew && !this.isDeleted) {
    const Conversation = mongoose.model('Conversation');
    
    // Use the plain text content we stored before encryption
    // or decrypt if we don't have it
    const contentForPreview = this._plainTextContent || this.decryptedContent || '';
    
    await Conversation.findByIdAndUpdate(this.conversation, {
      'lastMessage.content': contentForPreview,
      'lastMessage.sender': this.sender,
      'lastMessage.timestamp': this.createdAt,
      'lastMessage.messageType': this.messageType
    });
    
    // Clean up temporary fields
    delete this._plainTextContent;
    delete this._wasNew;
    
    // Note: Unread count increment is now handled in the controller for better timing control
  }
});

module.exports = mongoose.model('Message', messageSchema); 