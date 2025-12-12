const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  // Who this notification is for
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Who triggered this notification (optional for system notifications)
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // Notification title
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  
  // Notification message/body
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  
  // Notification type for categorization and icons
  type: {
    type: String,
    enum: [
      'ticket_created',
      'ticket_updated', 
      'ticket_commented',
      'ticket_assigned',
      'ticket_resolved',
      'ticket_closed',
      'withdrawal_requested',
      'withdrawal_approved',
      'withdrawal_rejected',
      'withdrawal_completed',
      'sim_card_cooldown',
      'system',
      'general'
    ],
    required: true
  },
  
  // Priority level for display styling
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  // Read status
  isRead: {
    type: Boolean,
    default: false
  },
  
  // When the notification was read
  readAt: {
    type: Date,
    default: null
  },
  
  // Related entity (ticket, order, etc.)
  relatedEntity: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    type: {
      type: String,
      enum: ['Ticket', 'Order', 'Lead', 'User', 'Withdrawal', 'SimCard'],
      default: null
    }
  },
  
  // Action URL for navigation
  actionUrl: {
    type: String,
    default: null
  },
  
  // Additional metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Expiry date for auto-cleanup
  expiresAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Static methods
notificationSchema.statics.getUnreadCount = async function(userId) {
  return this.countDocuments({ recipient: userId, isRead: false });
};

notificationSchema.statics.markAllAsRead = async function(userId) {
  return this.updateMany(
    { recipient: userId, isRead: false },
    { 
      $set: { 
        isRead: true, 
        readAt: new Date() 
      } 
    }
  );
};

notificationSchema.statics.createTicketNotification = async function(type, ticket, recipient, sender = null) {
  const notificationData = {
    recipient,
    sender,
    type,
    relatedEntity: {
      id: ticket._id,
      type: 'Ticket'
    },
    actionUrl: `/tickets`,
    priority: ticket.priority === 'urgent' ? 'urgent' : 'medium'
  };

  switch (type) {
    case 'ticket_created':
      notificationData.title = 'New Support Ticket Created';
      notificationData.message = `A new ${ticket.priority} priority ticket "${ticket.title}" has been created by ${sender?.fullName || 'Unknown User'}.`;
      break;
      
    case 'ticket_commented':
      notificationData.title = 'New Comment on Ticket';
      notificationData.message = `${sender?.fullName || 'Someone'} commented on ticket "${ticket.title}".`;
      break;
      
    case 'ticket_assigned':
      notificationData.title = 'Ticket Assigned to You';
      notificationData.message = `You have been assigned to handle ticket "${ticket.title}".`;
      break;
      
    case 'ticket_resolved':
      notificationData.title = 'Your Ticket has been Resolved';
      notificationData.message = `Your ticket "${ticket.title}" has been marked as resolved.`;
      break;
      
    case 'ticket_updated':
      notificationData.title = 'Ticket Status Updated';
      notificationData.message = `Ticket "${ticket.title}" status has been updated to ${ticket.status.replace('_', ' ')}.`;
      break;
      
    default:
      notificationData.title = 'Ticket Update';
      notificationData.message = `There has been an update to ticket "${ticket.title}".`;
  }

  return this.create(notificationData);
};

notificationSchema.statics.createWithdrawalNotification = async function(type, withdrawal, recipient, sender = null) {
  const notificationData = {
    recipient,
    sender,
    type,
    relatedEntity: {
      id: withdrawal._id,
      type: 'Withdrawal'
    },
    actionUrl: `/withdrawals`,
    priority: 'medium'
  };

  // Format amount with $ sign
  const formattedAmount = `$${withdrawal.amount.toFixed(2)}`;
  
  // Get agent name
  const agentName = withdrawal.agent?.fullName || sender?.fullName || 'Unknown User';

  switch (type) {
    case 'withdrawal_requested':
      notificationData.title = 'New Withdrawal Request';
      notificationData.message = `${agentName} has requested a withdrawal of ${formattedAmount}.`;
      notificationData.priority = 'high';
      break;
      
    case 'withdrawal_approved':
      notificationData.title = 'Withdrawal Request Approved';
      notificationData.message = `Your withdrawal request for ${formattedAmount} has been approved.`;
      break;
      
    case 'withdrawal_rejected':
      notificationData.title = 'Withdrawal Request Rejected';
      notificationData.message = `Your withdrawal request for ${formattedAmount} has been rejected.`;
      break;
      
    case 'withdrawal_completed':
      notificationData.title = 'Withdrawal Completed';
      notificationData.message = `Your withdrawal of ${formattedAmount} has been completed and sent to your wallet.`;
      break;
      
    default:
      notificationData.title = 'Withdrawal Update';
      notificationData.message = `There has been an update to your withdrawal request for ${formattedAmount}.`;
  }

  return this.create(notificationData);
};

// Instance methods
notificationSchema.methods.markAsRead = function() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Notification', notificationSchema);
