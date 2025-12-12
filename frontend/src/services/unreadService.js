import api from './api';

class UnreadService {
  constructor() {
    this.unreadCounts = {};
    this.totalUnread = 0;
    this.listeners = new Set();
  }

  // Subscribe to unread count changes
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Notify all listeners of changes
  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback({
          conversations: { ...this.unreadCounts },
          total: this.totalUnread
        });
      } catch (error) {
        console.error('Error in unread service listener:', error);
      }
    });
  }

  // Get current unread counts from server
  async fetchUnreadCounts() {
    try {
      const response = await api.get('/chat/unread/unread-counts');
      if (response.data.success) {
        this.unreadCounts = response.data.data.conversations;
        this.totalUnread = response.data.data.total;
        this.notifyListeners();
        return response.data.data;
      }
    } catch (error) {
      console.error('Error fetching unread counts:', error);
      throw error;
    }
  }

  // Mark conversation as read
  async markConversationAsRead(conversationId) {
    try {
      const response = await api.post(`/chat/unread/mark-read/${conversationId}`);
      if (response.data.success) {
        // Update local counts
        const prevCount = this.unreadCounts[conversationId] || 0;
        this.unreadCounts[conversationId] = 0;
        this.totalUnread = Math.max(0, this.totalUnread - prevCount);
        this.notifyListeners();
      }
      return response.data;
    } catch (error) {
      console.error('Error marking conversation as read:', error);
      throw error;
    }
  }

  // Mark all conversations as read
  async markAllAsRead() {
    try {
      const response = await api.post('/chat/unread/mark-all-read');
      if (response.data.success) {
        // Clear all local counts
        this.unreadCounts = {};
        this.totalUnread = 0;
        this.notifyListeners();
      }
      return response.data;
    } catch (error) {
      console.error('Error marking all as read:', error);
      throw error;
    }
  }

  // Update unread count for a conversation (called when new message received)
  incrementUnreadCount(conversationId) {
    const currentCount = this.unreadCounts[conversationId] || 0;
    this.unreadCounts[conversationId] = currentCount + 1;
    this.totalUnread += 1;
    this.notifyListeners();
  }

  // Get unread count for specific conversation
  getUnreadCount(conversationId) {
    return this.unreadCounts[conversationId] || 0;
  }

  // Get total unread count
  getTotalUnread() {
    return this.totalUnread;
  }

  // Get all unread counts
  getAllUnreadCounts() {
    return {
      conversations: { ...this.unreadCounts },
      total: this.totalUnread
    };
  }

  // Clear all local data (on logout)
  clear() {
    this.unreadCounts = {};
    this.totalUnread = 0;
    this.listeners.clear();
  }
}

// Create singleton instance
const unreadService = new UnreadService();

export default unreadService;
