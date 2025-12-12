import React, { useState, useEffect } from 'react';
import { 
  Fab, 
  Badge, 
  Tooltip,
  Box,
  useTheme
} from '@mui/material';
import { 
  Chat as ChatIcon,
  Close as CloseIcon 
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { selectUser, selectIsAuthenticated } from '../store/slices/authSlice';
import ChatWindow from './ChatWindow';
import chatService from '../services/chatService';
import notificationService from '../services/notificationService';

const ChatButton = () => {
  const theme = useTheme();
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  

  const [isConnected, setIsConnected] = useState(false);

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

  // Fetch unread count periodically
  useEffect(() => {
    if (isAuthenticated && user) {
      fetchUnreadCount();
      
      // Set up interval to check for unread messages
      const interval = setInterval(fetchUnreadCount, 30000); // Every 30 seconds
      
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, user]);

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
    setUnreadCount(0);
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await chatService.getUnreadCount();
      const count = response.data.totalUnread || 0;
      setUnreadCount(count);
    } catch (error) {
      console.error('❌ Error fetching unread count:', error);
    }
  };

  const handleChatConnected = () => {
    setIsConnected(true);
    fetchUnreadCount();
  };

  const handleChatDisconnected = () => {
    setIsConnected(false);
  };

  const handleConversationRead = () => {
    fetchUnreadCount();
  };

  const handleUnreadCountUpdate = (data) => {
    // Update the total unread count based on the specific conversation update
    if (data.conversationId && typeof data.unreadCount === 'number') {
      fetchUnreadCount(); // Refresh the total count from server
    }
  };

  const handleNewMessage = async (data) => {
    // If message is from someone else, increment unread count
    // BUT only if the chat window is closed OR the window is not focused
    // (if chat is open and focused, ChatWindow will handle marking as read automatically)
    if (data.message.sender._id !== user._id) {
      const shouldIncrementUnread = !chatOpen || !document.hasFocus();
      
      if (shouldIncrementUnread) {
        setUnreadCount(prev => prev + 1);
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

  const handleChatToggle = () => {
    setChatOpen(!chatOpen);
    
    // When opening chat, don't automatically reset unread count
    // Let the ChatWindow handle marking messages as read
  };

  // Don't show chat button if user is not authenticated
  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <>
      <Box
        sx={{
          position: 'fixed',
          bottom: { xs: 16, sm: 24 },
          right: { xs: 16, sm: 24 },
          zIndex: 1000,
        }}
      >
        <Tooltip
          title={
            chatOpen 
              ? "Close Chat" 
              : `Open Chat${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`
          }
          placement="left"
        >
          <Badge
            badgeContent={unreadCount}
            color="error"
            max={99}
            invisible={unreadCount === 0}
            sx={{
              '& .MuiBadge-badge': {
                fontSize: '0.75rem',
                minWidth: '20px',
                height: '20px',
                // Make badge more visible
                backgroundColor: 'error.main',
                color: 'error.contrastText',
                fontWeight: 'bold'
              }
            }}
          >
            <Fab
              color="primary"
              onClick={handleChatToggle}
              sx={{
                width: { xs: 48, sm: 56 },
                height: { xs: 48, sm: 56 },
                boxShadow: theme.shadows[6],
                '&:hover': {
                  boxShadow: theme.shadows[8],
                },
                // Add a subtle pulse animation when there are unread messages
                ...(unreadCount > 0 && !chatOpen && {
                  animation: 'pulse 2s infinite',
                  '@keyframes pulse': {
                    '0%': {
                      transform: 'scale(1)',
                    },
                    '50%': {
                      transform: 'scale(1.05)',
                    },
                    '100%': {
                      transform: 'scale(1)',
                    },
                  },
                }),
                // Show different opacity based on connection status
                opacity: isConnected ? 1 : 0.7,
              }}
            >
              {chatOpen ? <CloseIcon /> : <ChatIcon />}
            </Fab>
          </Badge>
        </Tooltip>

        {/* Connection status indicator */}
        {!isConnected && (
          <Box
            sx={{
              position: 'absolute',
              top: -4,
              left: -4,
              width: 12,
              height: 12,
              borderRadius: '50%',
              bgcolor: 'error.main',
              border: '2px solid white',
              zIndex: 1001,
            }}
          />
        )}
      </Box>

      {/* Chat Window */}
      <ChatWindow
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
      />
    </>
  );
};

export default ChatButton; 