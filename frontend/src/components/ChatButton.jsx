import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { selectUser, selectIsAuthenticated } from '../store/slices/authSlice';
import ChatWindow from './ChatWindow';
import chatService from '../services/chatService';
import notificationService from '../services/notificationService';

const ChatButton = () => {
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);

  const queryClient = useQueryClient();
  const [chatOpen, setChatOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // React Query for unread count polling (replaces setInterval)
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['chat', 'unreadCount'],
    queryFn: async () => {
      const response = await chatService.getUnreadCount();
      return response.data.totalUnread || 0;
    },
    enabled: isAuthenticated && !!user,
    refetchInterval: 30000,
  });

  // Initialize chat service when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      initializeChat();
    } else {
      cleanupChat();
    }

    return () => {
      cleanupChat();
    };
  }, [isAuthenticated, user]);

  // Invalidate unread count query to trigger a refetch
  const refetchUnreadCount = () => {
    queryClient.invalidateQueries({ queryKey: ['chat', 'unreadCount'] });
  };

  const initializeChat = () => {
    // Connect to chat service if not already connected
    if (!chatService.getConnectionStatus().isConnected) {
      chatService.connect();
    }

    // Set up event listeners
    chatService.on('chat:connected', handleChatConnected);
    chatService.on('chat:disconnected', handleChatDisconnected);
    chatService.on('chat:new_message', handleNewMessage);
    chatService.on('chat:conversation_read', handleConversationRead);
    chatService.on('chat:unread_count_updated', handleUnreadCountUpdate);

    // Get initial connection status
    setIsConnected(chatService.getConnectionStatus().isConnected);
  };

  const cleanupChat = () => {
    // Remove event listeners
    chatService.off('chat:connected', handleChatConnected);
    chatService.off('chat:disconnected', handleChatDisconnected);
    chatService.off('chat:new_message', handleNewMessage);
    chatService.off('chat:conversation_read', handleConversationRead);
    chatService.off('chat:unread_count_updated', handleUnreadCountUpdate);

    // Don't disconnect - other components might be using it
    setIsConnected(false);
  };


  const handleChatConnected = () => {
    setIsConnected(true);
    refetchUnreadCount();
  };

  const handleChatDisconnected = () => {
    setIsConnected(false);
  };

  const handleConversationRead = () => {
    refetchUnreadCount();
  };

  const handleUnreadCountUpdate = (data) => {
    // Update the total unread count based on the specific conversation update
    if (data.conversationId && typeof data.unreadCount === 'number') {
      refetchUnreadCount(); // Refresh the total count from server
    }
  };

  const handleNewMessage = async (data) => {
    // If message is from someone else, increment unread count
    // BUT only if the chat window is closed OR the window is not focused
    // (if chat is open and focused, ChatWindow will handle marking as read automatically)
    if (data.message.sender._id !== user._id) {
      const shouldIncrementUnread = !chatOpen || !document.hasFocus();

      if (shouldIncrementUnread) {
        // Optimistically increment the cached unread count
        queryClient.setQueryData(['chat', 'unreadCount'], (old) => (old || 0) + 1);
      }

      // Only trigger notifications when chat window is closed
      // When chat window is open, let ChatWindow handle notifications
      if (!chatOpen) {
        // Use fallback conversation data to avoid 403 errors
        const mockConversation = {
          _id: data.conversationId,
          type: 'direct',
          otherParticipant: data.message.sender,
          participants: [{ user: data.message.sender }]
        };
        notificationService.notifyNewMessage(data.message, mockConversation, user);
      }
    }
  };

  // Don't render if user is not authenticated
  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <>
      {/* Chat Window */}
      <ChatWindow
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
      />
    </>
  );
};

export default ChatButton;
