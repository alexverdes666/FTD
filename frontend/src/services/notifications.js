import api from './api';

class NotificationsService {
  // Get notifications with pagination and filters
  async getNotifications(params = {}) {
    try {
      const response = await api.get('/notifications', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching notifications:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch notifications');
    }
  }

  // Get unread notifications count
  async getUnreadCount() {
    try {
      const response = await api.get('/notifications/unread-count');
      return response.data.data.count;
    } catch (error) {
      console.error('Error fetching unread count:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch unread count');
    }
  }

  // Mark notification as read
  async markAsRead(notificationId) {
    try {
      const response = await api.put(`/notifications/${notificationId}/read`);
      return response.data.data;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw new Error(error.response?.data?.message || 'Failed to mark notification as read');
    }
  }

  // Mark all notifications as read
  async markAllAsRead() {
    try {
      const response = await api.put('/notifications/mark-all-read');
      return response.data;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw new Error(error.response?.data?.message || 'Failed to mark all notifications as read');
    }
  }

  // Delete notification
  async deleteNotification(notificationId) {
    try {
      const response = await api.delete(`/notifications/${notificationId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw new Error(error.response?.data?.message || 'Failed to delete notification');
    }
  }

  // Create notification (admin only)
  async createNotification(notificationData) {
    try {
      const response = await api.post('/notifications', notificationData);
      return response.data.data;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw new Error(error.response?.data?.message || 'Failed to create notification');
    }
  }

  // Get notification statistics (admin only)
  async getStats() {
    try {
      const response = await api.get('/notifications/stats');
      return response.data.data;
    } catch (error) {
      console.error('Error fetching notification stats:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch notification statistics');
    }
  }

  // Validate notification data
  validateNotificationData(data) {
    const errors = {};

    if (!data.recipient || !data.recipient.trim()) {
      errors.recipient = 'Recipient is required';
    }

    if (!data.title || !data.title.trim()) {
      errors.title = 'Title is required';
    }

    if (!data.message || !data.message.trim()) {
      errors.message = 'Message is required';
    }

    if (data.title && data.title.length > 200) {
      errors.title = 'Title must be less than 200 characters';
    }

    if (data.message && data.message.length > 1000) {
      errors.message = 'Message must be less than 1000 characters';
    }

    const validTypes = [
      'ticket_created',
      'ticket_updated', 
      'ticket_commented',
      'ticket_assigned',
      'ticket_resolved',
      'ticket_closed',
      'system',
      'general'
    ];

    if (data.type && !validTypes.includes(data.type)) {
      errors.type = 'Invalid notification type';
    }

    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    if (data.priority && !validPriorities.includes(data.priority)) {
      errors.priority = 'Invalid priority level';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  // Format notification for display
  formatNotification(notification) {
    return {
      ...notification,
      formattedDate: new Date(notification.createdAt).toLocaleDateString(),
      formattedTime: new Date(notification.createdAt).toLocaleTimeString(),
      isRecent: Date.now() - new Date(notification.createdAt).getTime() < 24 * 60 * 60 * 1000, // Within 24 hours
      displayTitle: notification.title.length > 50 
        ? notification.title.substring(0, 47) + '...' 
        : notification.title,
      displayMessage: notification.message.length > 100 
        ? notification.message.substring(0, 97) + '...' 
        : notification.message
    };
  }

  // Get notification type display information
  getNotificationTypeInfo(type) {
    const typeMap = {
      ticket_created: {
        label: 'New Ticket',
        color: 'primary',
        icon: 'ticket'
      },
      ticket_updated: {
        label: 'Ticket Updated',
        color: 'info',
        icon: 'ticket'
      },
      ticket_commented: {
        label: 'New Comment',
        color: 'info',
        icon: 'comment'
      },
      ticket_assigned: {
        label: 'Ticket Assigned',
        color: 'warning',
        icon: 'assignment'
      },
      ticket_resolved: {
        label: 'Ticket Resolved',
        color: 'success',
        icon: 'check_circle'
      },
      ticket_closed: {
        label: 'Ticket Closed',
        color: 'default',
        icon: 'close'
      },
      system: {
        label: 'System',
        color: 'secondary',
        icon: 'info'
      },
      general: {
        label: 'General',
        color: 'default',
        icon: 'notifications'
      }
    };

    return typeMap[type] || typeMap.general;
  }

  // Get priority display information
  getPriorityInfo(priority) {
    const priorityMap = {
      urgent: {
        label: 'Urgent',
        color: 'error',
        weight: 4
      },
      high: {
        label: 'High',
        color: 'warning',
        weight: 3
      },
      medium: {
        label: 'Medium',
        color: 'info',
        weight: 2
      },
      low: {
        label: 'Low',
        color: 'default',
        weight: 1
      }
    };

    return priorityMap[priority] || priorityMap.medium;
  }

  // Sort notifications by priority and date
  sortNotifications(notifications) {
    return notifications.sort((a, b) => {
      // First sort by read status (unread first)
      if (a.isRead !== b.isRead) {
        return a.isRead ? 1 : -1;
      }

      // Then by priority
      const aPriority = this.getPriorityInfo(a.priority).weight;
      const bPriority = this.getPriorityInfo(b.priority).weight;
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }

      // Finally by date (newest first)
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  // Filter notifications
  filterNotifications(notifications, filters = {}) {
    let filtered = [...notifications];

    if (filters.type) {
      filtered = filtered.filter(n => n.type === filters.type);
    }

    if (filters.priority) {
      filtered = filtered.filter(n => n.priority === filters.priority);
    }

    if (filters.isRead !== undefined) {
      filtered = filtered.filter(n => n.isRead === filters.isRead);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(n => 
        n.title.toLowerCase().includes(searchLower) ||
        n.message.toLowerCase().includes(searchLower)
      );
    }

    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      filtered = filtered.filter(n => new Date(n.createdAt) >= fromDate);
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999); // End of day
      filtered = filtered.filter(n => new Date(n.createdAt) <= toDate);
    }

    return filtered;
  }
}

// Create singleton instance
const notificationsService = new NotificationsService();

export default notificationsService;
