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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { selectUser, selectIsAuthenticated } from '../store/slices/authSlice';
import ChatWindow from './ChatWindow';
import chatService from '../services/chatService';
import notificationService from '../services/notificationService';

const ChatButton = () => {
  const theme = useTheme();
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

  // Drag state
  const [position, setPosition] = useState({ bottom: 16, right: 16 });
  const dragRef = React.useRef(null);
  const isDragging = React.useRef(false);
  const dragStart = React.useRef({ x: 0, y: 0, bottom: 0, right: 0 });
  const hasMoved = React.useRef(false);

  const pointerIdRef = React.useRef(null);
  const handlePointerDown = (e) => {
    isDragging.current = true;
    hasMoved.current = false;
    pointerIdRef.current = e.pointerId;
    dragStart.current = { x: e.clientX, y: e.clientY, bottom: position.bottom, right: position.right };
    // Don't capture pointer immediately — wait until drag threshold is reached
    // so that click events on the inner Fab still fire normally on desktop
  };
  const handlePointerMove = (e) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      if (!hasMoved.current) {
        hasMoved.current = true;
        // Capture pointer only once drag actually starts
        try { e.currentTarget.setPointerCapture(pointerIdRef.current); } catch (_) {}
      }
    }
    if (!hasMoved.current) return;
    setPosition({
      right: Math.max(0, dragStart.current.right - dx),
      bottom: Math.max(0, dragStart.current.bottom - dy),
    });
  };
  const handlePointerUp = (e) => {
    isDragging.current = false;
    try { e.currentTarget.releasePointerCapture(pointerIdRef.current); } catch (_) {}
  };

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

  const handleChatToggle = () => {
    if (hasMoved.current) return;
    setChatOpen(!chatOpen);
  };

  // Don't show chat button if user is not authenticated
  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <>
      <Box
        ref={dragRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        sx={{
          position: 'fixed',
          bottom: position.bottom,
          right: position.right,
          zIndex: 1000,
          touchAction: 'none',
          userSelect: 'none',
          cursor: isDragging.current ? 'grabbing' : 'grab',
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
                fontSize: '0.65rem',
                minWidth: '16px',
                height: '16px',
                backgroundColor: 'error.main',
                color: 'error.contrastText',
                fontWeight: 'bold'
              }
            }}
          >
            <Fab
              color="primary"
              onClick={handleChatToggle}
              size="small"
              sx={{
                width: 36,
                height: 36,
                minHeight: 36,
                boxShadow: theme.shadows[4],
                '&:hover': {
                  boxShadow: theme.shadows[6],
                },
                ...(unreadCount > 0 && !chatOpen && {
                  animation: 'pulse 2s infinite',
                  '@keyframes pulse': {
                    '0%': { transform: 'scale(1)' },
                    '50%': { transform: 'scale(1.05)' },
                    '100%': { transform: 'scale(1)' },
                  },
                }),
                opacity: isConnected ? 1 : 0.7,
              }}
            >
              {chatOpen ? <CloseIcon sx={{ fontSize: 18 }} /> : <ChatIcon sx={{ fontSize: 18 }} />}
            </Fab>
          </Badge>
        </Tooltip>

        {/* Connection status indicator */}
        {!isConnected && (
          <Box
            sx={{
              position: 'absolute',
              top: -2,
              left: -2,
              width: 8,
              height: 8,
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