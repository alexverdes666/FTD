const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  // Announcement title
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  
  // Announcement message/body
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000
  },
  
  // Target roles for this announcement
  targetRoles: {
    type: [String],
    required: true,
    validate: {
      validator: function(v) {
        if (!v || v.length === 0) return false;
        const validRoles = ['agent', 'affiliate_manager'];
        return v.every(role => validRoles.includes(role));
      },
      message: 'Target roles must include at least one of: agent, affiliate_manager'
    }
  },
  
  // Who created this announcement (admin)
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Users who have read/dismissed this announcement
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
  
  // Priority level for display styling
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  // Whether the announcement is active
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
announcementSchema.index({ targetRoles: 1, createdAt: -1 });
announcementSchema.index({ createdBy: 1, createdAt: -1 });
announcementSchema.index({ 'readBy.user': 1 });
announcementSchema.index({ isActive: 1 });

// Virtual to get target roles as readable string
announcementSchema.virtual('targetAudience').get(function() {
  if (this.targetRoles.includes('agent') && this.targetRoles.includes('affiliate_manager')) {
    return 'Agents & Affiliate Managers';
  } else if (this.targetRoles.includes('agent')) {
    return 'Agents';
  } else if (this.targetRoles.includes('affiliate_manager')) {
    return 'Affiliate Managers';
  }
  return 'Unknown';
});

// Instance method to check if a user has read this announcement
announcementSchema.methods.isReadByUser = function(userId) {
  return this.readBy.some(read => read.user.toString() === userId.toString());
};

// Instance method to mark as read by a user
announcementSchema.methods.markAsReadByUser = async function(userId) {
  if (!this.isReadByUser(userId)) {
    this.readBy.push({
      user: userId,
      readAt: new Date()
    });
    return this.save();
  }
  return this;
};

// Static method to get unread announcements for a user role
announcementSchema.statics.getUnreadForUser = async function(userId, userRole) {
  return this.find({
    targetRoles: userRole,
    isActive: true,
    'readBy.user': { $ne: userId }
  })
  .populate('createdBy', 'fullName email')
  .sort({ createdAt: -1 });
};

// Static method to get all announcements for a user role
announcementSchema.statics.getAllForUserRole = async function(userRole, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  
  const announcements = await this.find({
    targetRoles: userRole,
    isActive: true
  })
  .populate('createdBy', 'fullName email')
  .sort({ createdAt: -1 })
  .skip(skip)
  .limit(limit);
  
  const total = await this.countDocuments({
    targetRoles: userRole,
    isActive: true
  });
  
  return {
    announcements,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

// Static method to get announcements created by admin
announcementSchema.statics.getSentByAdmin = async function(adminId, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  
  const announcements = await this.find({
    createdBy: adminId
  })
  .populate('createdBy', 'fullName email')
  .sort({ createdAt: -1 })
  .skip(skip)
  .limit(limit);
  
  const total = await this.countDocuments({
    createdBy: adminId
  });
  
  return {
    announcements,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

// Static method to get all announcements (admin view)
announcementSchema.statics.getAllAnnouncements = async function(page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  
  const announcements = await this.find({})
  .populate('createdBy', 'fullName email')
  .sort({ createdAt: -1 })
  .skip(skip)
  .limit(limit);
  
  const total = await this.countDocuments({});
  
  return {
    announcements,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

module.exports = mongoose.model('Announcement', announcementSchema);

