import api from './api';

class AnnouncementService {
  // Get announcements for the current user's role
  async getMyAnnouncements(params = {}) {
    try {
      const response = await api.get('/announcements', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching announcements:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch announcements');
    }
  }

  // Get unread announcements for popup display
  async getUnreadAnnouncements() {
    try {
      const response = await api.get('/announcements/unread');
      return response.data;
    } catch (error) {
      console.error('Error fetching unread announcements:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch unread announcements');
    }
  }

  // Mark an announcement as read
  async markAsRead(announcementId) {
    try {
      const response = await api.put(`/announcements/${announcementId}/read`);
      return response.data;
    } catch (error) {
      console.error('Error marking announcement as read:', error);
      throw new Error(error.response?.data?.message || 'Failed to mark announcement as read');
    }
  }

  // Mark all announcements as read
  async markAllAsRead() {
    try {
      const response = await api.put('/announcements/mark-all-read');
      return response.data;
    } catch (error) {
      console.error('Error marking all announcements as read:', error);
      throw new Error(error.response?.data?.message || 'Failed to mark all announcements as read');
    }
  }

  // Get a single announcement by ID
  async getAnnouncement(announcementId) {
    try {
      const response = await api.get(`/announcements/${announcementId}`);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching announcement:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch announcement');
    }
  }

  // Create announcement (admin only)
  async createAnnouncement(announcementData) {
    try {
      const response = await api.post('/announcements', announcementData);
      return response.data;
    } catch (error) {
      console.error('Error creating announcement:', error);
      throw new Error(error.response?.data?.message || 'Failed to create announcement');
    }
  }

  // Get sent announcements (admin only)
  async getSentAnnouncements(params = {}) {
    try {
      const response = await api.get('/announcements/admin/sent', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching sent announcements:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch sent announcements');
    }
  }

  // Get announcement statistics (admin only)
  async getStats() {
    try {
      const response = await api.get('/announcements/admin/stats');
      return response.data.data;
    } catch (error) {
      console.error('Error fetching announcement stats:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch announcement statistics');
    }
  }

  // Delete announcement (admin only)
  async deleteAnnouncement(announcementId) {
    try {
      const response = await api.delete(`/announcements/${announcementId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting announcement:', error);
      throw new Error(error.response?.data?.message || 'Failed to delete announcement');
    }
  }

  // Validate announcement data
  validateAnnouncementData(data) {
    const errors = {};

    if (!data.title || !data.title.trim()) {
      errors.title = 'Title is required';
    } else if (data.title.length > 200) {
      errors.title = 'Title must be less than 200 characters';
    }

    if (!data.message || !data.message.trim()) {
      errors.message = 'Message is required';
    } else if (data.message.length > 5000) {
      errors.message = 'Message must be less than 5000 characters';
    }

    if (!data.targetRoles || data.targetRoles.length === 0) {
      errors.targetRoles = 'At least one target role must be selected';
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

  // Format announcement for display
  formatAnnouncement(announcement) {
    return {
      ...announcement,
      formattedDate: new Date(announcement.createdAt).toLocaleDateString(),
      formattedTime: new Date(announcement.createdAt).toLocaleTimeString(),
      formattedDateTime: new Date(announcement.createdAt).toLocaleString(),
      isRecent: Date.now() - new Date(announcement.createdAt).getTime() < 24 * 60 * 60 * 1000,
      targetAudienceText: this.getTargetAudienceText(announcement.targetRoles)
    };
  }

  // Get target audience display text
  getTargetAudienceText(targetRoles) {
    if (!targetRoles || targetRoles.length === 0) return 'Unknown';
    
    if (targetRoles.includes('agent') && targetRoles.includes('affiliate_manager')) {
      return 'Agents & Affiliate Managers';
    } else if (targetRoles.includes('agent')) {
      return 'Agents';
    } else if (targetRoles.includes('affiliate_manager')) {
      return 'Affiliate Managers';
    }
    return 'Unknown';
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

  // Sort announcements by priority and date
  sortAnnouncements(announcements) {
    return announcements.sort((a, b) => {
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
}

// Create singleton instance
const announcementService = new AnnouncementService();

export default announcementService;

