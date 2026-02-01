const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  category: {
    type: String,
    enum: [
      'leads_request',
      'salary_issue',
      'technical_support',
      'account_access',
      'payment_issue',
      'feature_request',
      'bug_report',
      'fine_dispute',
      'other'
    ],
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'waiting_response', 'resolved', 'closed', 'deleted'],
    default: 'open'
  },
  // Ticket creator
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Admin/manager assigned to handle the ticket
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // Who assigned the ticket
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // When the ticket was assigned
  assignedAt: {
    type: Date,
    default: null
  },
  // Comments/conversation thread
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000
    },
    isInternal: {
      type: Boolean,
      default: false // Internal comments only visible to admins
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // File attachments
  attachments: [{
    filename: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    mimetype: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Resolution details
  resolution: {
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    resolvedAt: {
      type: Date,
      default: null
    },
    resolutionNote: {
      type: String,
      trim: true,
      maxlength: 1000
    }
  },
  // Metadata
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  // Due date for urgent tickets
  dueDate: {
    type: Date,
    default: null
  },
  // Related fine (for fine_dispute tickets)
  relatedFine: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AgentFine',
    default: null
  },
  // Last activity timestamp
  lastActivityAt: {
    type: Date,
    default: Date.now
  },
  // Last activity by user
  lastActivityBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for time since last activity
ticketSchema.virtual('timeSinceLastActivity').get(function() {
  if (!this.lastActivityAt) return null;
  return Date.now() - this.lastActivityAt.getTime();
});

// Virtual for ticket age
ticketSchema.virtual('age').get(function() {
  return Date.now() - this.createdAt.getTime();
});

// Virtual for comment count
ticketSchema.virtual('commentCount').get(function() {
  return this.comments ? this.comments.length : 0;
});

// Virtual for public comment count (excluding internal comments)
ticketSchema.virtual('publicCommentCount').get(function() {
  return this.comments ? this.comments.filter(comment => !comment.isInternal).length : 0;
});

// Indexes for efficient queries
ticketSchema.index({ status: 1, createdAt: -1 });
ticketSchema.index({ createdBy: 1, createdAt: -1 });
ticketSchema.index({ assignedTo: 1, status: 1, createdAt: -1 });
ticketSchema.index({ category: 1, status: 1 });
ticketSchema.index({ priority: 1, status: 1 });
ticketSchema.index({ lastActivityAt: -1 });
ticketSchema.index({ dueDate: 1, status: 1 });
ticketSchema.index({ tags: 1 });

// Text search index
ticketSchema.index({ 
  title: 'text', 
  description: 'text', 
  'comments.message': 'text' 
});

// Pre-save middleware to update lastActivityAt
ticketSchema.pre('save', function(next) {
  if (this.isModified('comments') || this.isModified('status') || this.isModified('assignedTo')) {
    this.lastActivityAt = new Date();
  }
  next();
});

// Static methods
ticketSchema.statics.getTicketStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const categoryStats = await this.aggregate([
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 }
      }
    }
  ]);

  const priorityStats = await this.aggregate([
    {
      $group: {
        _id: '$priority',
        count: { $sum: 1 }
      }
    }
  ]);

  return {
    byStatus: stats,
    byCategory: categoryStats,
    byPriority: priorityStats
  };
};

// Instance methods
ticketSchema.methods.addComment = function(userId, message, isInternal = false) {
  this.comments.push({
    user: userId,
    message: message,
    isInternal: isInternal,
    createdAt: new Date()
  });
  this.lastActivityAt = new Date();
  this.lastActivityBy = userId;
  return this.save();
};

ticketSchema.methods.assignTo = function(userId, assignedByUserId) {
  this.assignedTo = userId;
  this.assignedBy = assignedByUserId;
  this.assignedAt = new Date();
  this.lastActivityAt = new Date();
  this.lastActivityBy = assignedByUserId;
  return this.save();
};

ticketSchema.methods.resolve = function(userId, resolutionNote) {
  this.status = 'resolved';
  this.resolution = {
    resolvedBy: userId,
    resolvedAt: new Date(),
    resolutionNote: resolutionNote
  };
  this.lastActivityAt = new Date();
  this.lastActivityBy = userId;
  return this.save();
};

module.exports = mongoose.model('Ticket', ticketSchema);
