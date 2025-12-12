import { useState, useEffect } from 'react';
import unreadService from '../services/unreadService';

// Custom hook to easily access unread counts in components
export const useUnreadCounts = () => {
  const [unreadCounts, setUnreadCounts] = useState({
    conversations: {},
    total: 0
  });

  useEffect(() => {
    // Subscribe to unread count changes
    const unsubscribe = unreadService.subscribe((counts) => {
      setUnreadCounts(counts);
    });

    // Load initial counts
    unreadService.fetchUnreadCounts().catch(console.error);

    return unsubscribe;
  }, []);

  return {
    unreadCounts: unreadCounts.conversations,
    totalUnread: unreadCounts.total,
    getUnreadCount: (conversationId) => unreadCounts.conversations[conversationId] || 0,
    markAsRead: (conversationId) => unreadService.markConversationAsRead(conversationId),
    markAllAsRead: () => unreadService.markAllAsRead(),
    refreshCounts: () => unreadService.fetchUnreadCounts()
  };
};

export default useUnreadCounts;
