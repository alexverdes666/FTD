import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import chatService from '../../services/chatService';

// Async thunks for chat operations
export const fetchConversations = createAsyncThunk(
  'chat/fetchConversations',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await chatService.getConversations(params);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch conversations');
    }
  }
);

export const fetchUnreadCount = createAsyncThunk(
  'chat/fetchUnreadCount',
  async (_, { rejectWithValue }) => {
    try {
      const response = await chatService.getUnreadCount();
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch unread count');
    }
  }
);

export const sendMessage = createAsyncThunk(
  'chat/sendMessage',
  async ({ conversationId, messageData }, { rejectWithValue }) => {
    try {
      const response = await chatService.sendMessage(conversationId, messageData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to send message');
    }
  }
);

const initialState = {
  // Connection state
  isConnected: false,
  connectionStatus: 'disconnected', // 'connecting', 'connected', 'disconnected', 'error'
  
  // Conversations
  conversations: [],
  selectedConversation: null,
  conversationsLoading: false,
  conversationsError: null,
  
  // Messages
  messages: {},
  messagesLoading: {},
  messagesError: {},
  
  // Unread counts
  totalUnreadCount: 0,
  unreadCounts: {}, // Per conversation
  
  // UI state
  chatWindowOpen: false,
  typingUsers: {},
  
  // Notifications
  notifications: [],
  showNotifications: true,
  
  // Cache timestamps
  lastFetch: null,
  lastUnreadFetch: null,
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    // Connection management
    setConnectionStatus(state, action) {
      const { status, isConnected } = action.payload;
      state.connectionStatus = status;
      state.isConnected = isConnected;
    },
    
    // Chat window management
    setChatWindowOpen(state, action) {
      state.chatWindowOpen = action.payload;
    },
    
    setSelectedConversation(state, action) {
      state.selectedConversation = action.payload;
    },
    
    // Real-time message handling
    addMessage(state, action) {
      const { conversationId, message } = action.payload;
      
      if (!state.messages[conversationId]) {
        state.messages[conversationId] = [];
      }
      
      // Check if message already exists (avoid duplicates)
      const existingMessage = state.messages[conversationId].find(m => m._id === message._id);
      if (!existingMessage) {
        state.messages[conversationId].push(message);
      }
    },
    
    updateMessage(state, action) {
      const { conversationId, messageId, updates } = action.payload;
      
      if (state.messages[conversationId]) {
        const messageIndex = state.messages[conversationId].findIndex(m => m._id === messageId);
        if (messageIndex !== -1) {
          state.messages[conversationId][messageIndex] = {
            ...state.messages[conversationId][messageIndex],
            ...updates
          };
        }
      }
    },
    
    removeMessage(state, action) {
      const { conversationId, messageId } = action.payload;
      
      if (state.messages[conversationId]) {
        state.messages[conversationId] = state.messages[conversationId].filter(
          m => m._id !== messageId
        );
      }
    },
    
    // Typing indicators
    setUserTyping(state, action) {
      const { conversationId, userId, userName } = action.payload;
      
      if (!state.typingUsers[conversationId]) {
        state.typingUsers[conversationId] = [];
      }
      
      const existingUser = state.typingUsers[conversationId].find(u => u.userId === userId);
      if (!existingUser) {
        state.typingUsers[conversationId].push({ userId, userName });
      }
    },
    
    setUserStopTyping(state, action) {
      const { conversationId, userId } = action.payload;
      
      if (state.typingUsers[conversationId]) {
        state.typingUsers[conversationId] = state.typingUsers[conversationId].filter(
          u => u.userId !== userId
        );
      }
    },
    
    // Unread count management
    setUnreadCount(state, action) {
      const { totalUnread, conversationCount } = action.payload;
      state.totalUnreadCount = totalUnread;
    },
    
    incrementUnreadCount(state, action) {
      const { conversationId } = action.payload;
      state.totalUnreadCount += 1;
      
      if (!state.unreadCounts[conversationId]) {
        state.unreadCounts[conversationId] = 0;
      }
      state.unreadCounts[conversationId] += 1;
    },
    
    resetUnreadCount(state, action) {
      if (action.payload) {
        // Reset for specific conversation
        const conversationId = action.payload;
        const previousCount = state.unreadCounts[conversationId] || 0;
        state.totalUnreadCount = Math.max(0, state.totalUnreadCount - previousCount);
        state.unreadCounts[conversationId] = 0;
      } else {
        // Reset all
        state.totalUnreadCount = 0;
        state.unreadCounts = {};
      }
    },
    
    // Notifications
    addNotification(state, action) {
      const notification = {
        id: Date.now() + Math.random(),
        timestamp: Date.now(),
        ...action.payload
      };
      
      state.notifications.unshift(notification);
      
      // Keep only last 50 notifications
      if (state.notifications.length > 50) {
        state.notifications = state.notifications.slice(0, 50);
      }
    },
    
    removeNotification(state, action) {
      const notificationId = action.payload;
      state.notifications = state.notifications.filter(n => n.id !== notificationId);
    },
    
    clearNotifications(state) {
      state.notifications = [];
    },
    
    setShowNotifications(state, action) {
      state.showNotifications = action.payload;
    },
    
    // Update conversation last message
    updateConversationLastMessage(state, action) {
      const { conversationId, lastMessage } = action.payload;
      
      const conversationIndex = state.conversations.findIndex(c => c._id === conversationId);
      if (conversationIndex !== -1) {
        state.conversations[conversationIndex].lastMessage = lastMessage;
        
        // Move conversation to top
        const conversation = state.conversations[conversationIndex];
        state.conversations.splice(conversationIndex, 1);
        state.conversations.unshift(conversation);
      }
    },
    
    // Clear chat data (on logout)
    clearChatData(state) {
      return {
        ...initialState,
        showNotifications: state.showNotifications
      };
    }
  },
  extraReducers: (builder) => {
    // Fetch conversations
    builder
      .addCase(fetchConversations.pending, (state) => {
        state.conversationsLoading = true;
        state.conversationsError = null;
      })
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.conversationsLoading = false;
        state.conversations = action.payload;
        state.lastFetch = Date.now();
      })
      .addCase(fetchConversations.rejected, (state, action) => {
        state.conversationsLoading = false;
        state.conversationsError = action.payload;
      });
    
    // Fetch unread count
    builder
      .addCase(fetchUnreadCount.pending, (state) => {
        // Don't show loading for background unread count fetches
      })
      .addCase(fetchUnreadCount.fulfilled, (state, action) => {
        state.totalUnreadCount = action.payload.totalUnread;
        state.lastUnreadFetch = Date.now();
      })
      .addCase(fetchUnreadCount.rejected, (state, action) => {
        console.error('Failed to fetch unread count:', action.payload);
      });
    
    // Send message
    builder
      .addCase(sendMessage.pending, (state, action) => {
        const conversationId = action.meta.arg.conversationId;
        state.messagesLoading[conversationId] = true;
        state.messagesError[conversationId] = null;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        const message = action.payload;
        const conversationId = message.conversation;
        
        state.messagesLoading[conversationId] = false;
        
        // Add message to local state
        if (!state.messages[conversationId]) {
          state.messages[conversationId] = [];
        }
        
        // Check if message already exists
        const existingMessage = state.messages[conversationId].find(m => m._id === message._id);
        if (!existingMessage) {
          state.messages[conversationId].push(message);
        }
      })
      .addCase(sendMessage.rejected, (state, action) => {
        const conversationId = action.meta.arg.conversationId;
        state.messagesLoading[conversationId] = false;
        state.messagesError[conversationId] = action.payload;
      });
  }
});

export const {
  setConnectionStatus,
  setChatWindowOpen,
  setSelectedConversation,
  addMessage,
  updateMessage,
  removeMessage,
  setUserTyping,
  setUserStopTyping,
  setUnreadCount,
  incrementUnreadCount,
  resetUnreadCount,
  addNotification,
  removeNotification,
  clearNotifications,
  setShowNotifications,
  updateConversationLastMessage,
  clearChatData
} = chatSlice.actions;

// Selectors
export const selectChatState = (state) => state.chat;
export const selectIsConnected = (state) => state.chat.isConnected;
export const selectConnectionStatus = (state) => state.chat.connectionStatus;
export const selectConversations = (state) => state.chat.conversations;
export const selectSelectedConversation = (state) => state.chat.selectedConversation;
export const selectMessages = (conversationId) => (state) => 
  state.chat.messages[conversationId] || [];
export const selectTotalUnreadCount = (state) => state.chat.totalUnreadCount;
export const selectUnreadCount = (conversationId) => (state) => 
  state.chat.unreadCounts[conversationId] || 0;
export const selectTypingUsers = (conversationId) => (state) => 
  state.chat.typingUsers[conversationId] || [];
export const selectNotifications = (state) => state.chat.notifications;
export const selectShowNotifications = (state) => state.chat.showNotifications;
export const selectChatWindowOpen = (state) => state.chat.chatWindowOpen;

export default chatSlice.reducer; 