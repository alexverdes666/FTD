import io from 'socket.io-client';
import api from './api';
import { store } from '../store/store';
import unreadService from './unreadService';

class ChatService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.eventListeners = new Map();
    
    // Connection health monitoring
    this.lastPingTime = null;
    this.pingInterval = null;
    this.connectionHealthy = false;
    
    // Deduplication tracking
    this.processedUnreadUpdates = new Set();
    this.lastUnreadUpdateTime = {};
    
    // Initialization tracking
    this.isInitializing = false;
  }

  // Initialize WebSocket connection
  connect() {
    // Prevent multiple simultaneous connections or initialization
    if (this.isInitializing || (this.socket && (this.socket.connected || this.socket.connecting))) {
      console.log('🔌 Already connected/connecting/initializing, skipping...');
      return;
    }
    
    this.isInitializing = true;

    const state = store.getState();
    const token = state.auth.token;
    
    if (!token) {
      console.error('No auth token available for chat connection');
      this.isInitializing = false; // Clear flag on error
      return;
    }

    // Construct WebSocket URL properly for production
    let socketUrl;
    if (import.meta.env.VITE_API_URL) {
      // Production: Convert HTTPS API URL to WSS WebSocket URL
      socketUrl = import.meta.env.VITE_API_URL
        .replace('/api', '')
        .replace('https://', 'wss://')
        .replace('http://', 'ws://');
    } else {
      // Development: Use localhost
      socketUrl = 'http://localhost:5000';
    }
    
    console.log('🔌 Connecting to chat server:', socketUrl);
    
    this.socket = io(socketUrl, {
      auth: {
        token: token
      },
      // Production-optimized configuration
      transports: ['polling', 'websocket'], // Start with polling, then upgrade to websocket
      upgrade: true,
      autoConnect: true,
      timeout: 30000, // Increased timeout for production
      reconnection: true,
      reconnectionAttempts: 10, // More attempts for production
      reconnectionDelay: 2000, // Longer delay for production
      reconnectionDelayMax: 10000,
      // Production-specific options
      forceNew: false,
      rememberUpgrade: false,
      // CORS and production settings
      withCredentials: true,
      // Enable compression
      compression: true,
    });

    this.setupEventListeners();
    this.startConnectionHealthMonitoring();
  }

  // Set up Socket.IO event listeners
  setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ Connected to chat server via', this.socket.io.engine.transport.name);
      console.log('🌐 Socket ID:', this.socket.id);
      this.isConnected = true;
      this.connectionHealthy = true;
      this.reconnectAttempts = 0;
      this.isInitializing = false; // Clear initialization flag
      this.emit('chat:connected');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from chat server:', reason);
      this.isConnected = false;
      this.connectionHealthy = false;
      this.emit('chat:disconnected', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('💥 Chat connection error:', error.message);
      console.error('🔍 Error details:', error);
      console.error('🌐 Attempted URL:', import.meta.env.VITE_API_URL);
      this.connectionHealthy = false;
      this.isInitializing = false; // Clear flag on error
      this.handleReconnect();
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Reconnected to chat server after', attemptNumber, 'attempts');
      this.connectionHealthy = true;
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('🔄 Reconnection error:', error.message);
      this.connectionHealthy = false;
    });

    this.socket.on('reconnect_failed', () => {
      console.error('🚫 Failed to reconnect to chat server');
      this.connectionHealthy = false;
    });

    this.socket.on('connected', (data) => {
      console.log('🎯 Connection confirmed:', data);
      this.connectionHealthy = true;
    });

    // Monitor transport upgrades
    this.socket.io.on('upgrade', () => {
      console.log('🔄 Transport upgraded to', this.socket.io.engine.transport.name);
    });

    // Chat-specific events
    this.socket.on('new_message', (data) => {
      this.emit('chat:new_message', data);
    });

    this.socket.on('message_edited', (data) => {
      this.emit('chat:message_edited', data);
    });

    this.socket.on('message_deleted', (data) => {
      this.emit('chat:message_deleted', data);
    });

    this.socket.on('user_typing', (data) => {
      this.emit('chat:user_typing', data);
    });

    this.socket.on('user_stop_typing', (data) => {
      this.emit('chat:user_stop_typing', data);
    });

    // Room join confirmation with acknowledgment
    this.socket.on('room_joined', (data) => {
      console.log('👥 Room joined confirmed:', data);
    });

    // Group-related events
    this.socket.on('group_updated', (data) => {
      this.emit('chat:group_updated', data);
    });

    // Unread count updates with deduplication
    this.socket.on('unread_count_updated', (data) => {
      if (!data.conversationId || typeof data.unreadCount !== 'number') return;
      
      // Create unique key for this update
      const updateKey = `${data.conversationId}_${data.unreadCount}_${Date.now()}`;
      const simpleKey = `${data.conversationId}_${data.unreadCount}`;
      
      // Prevent duplicate updates within 1 second
      const now = Date.now();
      const lastUpdate = this.lastUnreadUpdateTime[simpleKey];
      if (lastUpdate && (now - lastUpdate) < 1000) {
        console.log('🔄 Duplicate unread update ignored:', simpleKey);
        return;
      }
      
      this.lastUnreadUpdateTime[simpleKey] = now;
      

      
      // Update unread service
      unreadService.unreadCounts[data.conversationId] = data.unreadCount;
      
      // Recalculate total
      unreadService.totalUnread = Object.values(unreadService.unreadCounts)
        .reduce((total, count) => total + count, 0);
      
      unreadService.notifyListeners();
      
      // Emit event for other components
      this.emit('chat:unread_count_updated', data);
      
      // Clean up old tracking data
      if (Object.keys(this.lastUnreadUpdateTime).length > 50) {
        const cutoff = now - 60000; // Keep only last minute
        Object.keys(this.lastUnreadUpdateTime).forEach(key => {
          if (this.lastUnreadUpdateTime[key] < cutoff) {
            delete this.lastUnreadUpdateTime[key];
          }
        });
      }
    });

    // Reaction update events
    this.socket.on('message_reaction_updated', (data) => {
      this.emit('chat:reaction_updated', data);
    });

    // Read receipt events
    this.socket.on('messages_read', (data) => {
      this.emit('chat:messages_read', data);
    });

    // User mentioned events
    this.socket.on('user_mentioned', (data) => {
      this.emit('chat:user_mentioned', data);
    });

    // Force logout event (session kicked by admin)
    this.socket.on('force_logout', (data) => {
      console.log('🚪 Force logout received:', data);
      this.emit('auth:force_logout', data);
    });

    // Announcement events
    this.socket.on('new_announcement', (data) => {
      console.log('📢 New announcement received:', data);
      this.emit('new_announcement', data);
    });
  }

  // Handle reconnection logic
  handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      
      setTimeout(() => {
        if (!this.isConnected) {
          this.connect();
        }
      }, delay);
    } else {
      console.error('🚫 Max reconnection attempts reached');
      this.emit('chat:max_reconnect_attempts');
    }
  }

  // Disconnect from chat
  disconnect() {
    console.log('🔌 Disconnecting from chat server...');
    
    this.stopConnectionHealthMonitoring();
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.connectionHealthy = false;
    }
  }

  // Join a conversation room with acknowledgment
  joinConversation(conversationId) {
    return new Promise((resolve, reject) => {
      if (this.socket && this.isConnected) {
        this.socket.emit('join_conversation', conversationId, (response) => {
          if (response && response.success) {
            console.log('✅ Successfully joined conversation:', conversationId);
            resolve(response);
          } else {
            console.error('❌ Failed to join conversation:', response?.error);
            reject(new Error(response?.error || 'Failed to join conversation'));
          }
        });
      } else {
        reject(new Error('Socket not connected'));
      }
    });
  }

  // Leave a conversation room with acknowledgment
  leaveConversation(conversationId) {
    return new Promise((resolve, reject) => {
      if (this.socket && this.isConnected) {
        this.socket.emit('leave_conversation', conversationId, (response) => {
          if (response && response.success) {
            console.log('✅ Successfully left conversation:', conversationId);
            resolve(response);
          } else {
            console.error('❌ Failed to leave conversation:', response?.error);
            reject(new Error(response?.error || 'Failed to leave conversation'));
          }
        });
      } else {
        reject(new Error('Socket not connected'));
      }
    });
  }

  // Send typing indicator
  sendTyping(conversationId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing', { conversationId });
    }
  }

  // Stop typing indicator
  stopTyping(conversationId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('stop_typing', { conversationId });
    }
  }

  // Ensure connection is active
  ensureConnection() {
    if (!this.socket || !this.socket.connected) {
      this.connect();
      return false;
    }
    return true;
  }

  // Connection health monitoring
  startConnectionHealthMonitoring() {
    // Clear existing interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    // Ping server every 30 seconds to check connection health
    this.pingInterval = setInterval(() => {
      if (this.socket && this.isConnected) {
        const pingTime = Date.now();
        this.lastPingTime = pingTime;
        
        this.socket.emit('ping', (response) => {
          // Only process if this is the response to our latest ping
          if (response && response.timestamp && this.lastPingTime === pingTime) {
            const latency = Date.now() - pingTime;
            console.log(`🏓 Ping response received, latency: ${latency}ms`);
            this.connectionHealthy = true;
            
            // Clear the timeout since we got a response
            if (this.currentPingTimeout) {
              clearTimeout(this.currentPingTimeout);
              this.currentPingTimeout = null;
            }
          }
        });
        
        // If no response in 10 seconds, consider connection unhealthy
        const timeoutId = setTimeout(() => {
          // Only show warning if this ping is still the latest one and we're still connected
          if (this.lastPingTime === pingTime && (Date.now() - pingTime) > 10000 && this.isConnected) {
            console.warn('⚠️ Ping timeout, connection may be unhealthy');
            this.connectionHealthy = false;
          }
        }, 10000);
        
        // Store timeout ID to clear it if we get a response
        this.currentPingTimeout = timeoutId;
      }
    }, 30000);
  }

  stopConnectionHealthMonitoring() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.currentPingTimeout) {
      clearTimeout(this.currentPingTimeout);
      this.currentPingTimeout = null;
    }
  }

  // Force reconnection
  forceReconnect() {
    console.log('🔄 Forcing reconnection...');
    this.stopConnectionHealthMonitoring();
    
    if (this.socket) {
      this.socket.disconnect();
    }
    
    setTimeout(() => {
      this.connect();
    }, 1000);
  }

  // Event listener management
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in chat event listener:', error);
        }
      });
    }
  }

  // API Methods
  
  // Get conversations (with caching)
  async getConversations(params = {}) {
    try {
      const cacheKey = `conversations_${JSON.stringify(params)}`;
      const cached = this.conversationCache.get(cacheKey);
      
      // Return cached data if available and fresh
      if (cached && (Date.now() - cached.timestamp < this.CACHE_TTL)) {
        console.log('📦 Using cached conversations');
        return cached.data;
      }

      const response = await api.get('/chat/conversations', { params });
      
      // Cache the response
      this.conversationCache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now()
      });
      
      return response.data;
    } catch (error) {
      console.error('Error fetching conversations:', error);
      throw error;
    }
  }

  // Invalidate conversation cache
  invalidateConversationCache() {
    this.conversationCache.clear();
  }

  // Get specific conversation (with caching)
  async getConversation(conversationId) {
    try {
      const cacheKey = `conversation_${conversationId}`;
      const cached = this.conversationCache.get(cacheKey);
      
      // Return cached data if available and fresh
      if (cached && (Date.now() - cached.timestamp < this.CACHE_TTL)) {
        console.log('📦 Using cached conversation', conversationId);
        return cached.data;
      }

      const response = await api.get(`/chat/conversations/${conversationId}`);
      
      // Cache the response
      this.conversationCache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now()
      });
      
      return response.data;
    } catch (error) {
      console.error('Error fetching conversation:', error);
      throw error;
    }
  }

  // Create or get conversation
  async createOrGetConversation(participantId, context = {}) {
    try {
      const response = await api.post('/chat/conversations', {
        participantId,
        ...context
      });
      return response.data;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  }

  // Message cache for faster subsequent loads
  messageCache = new Map();
  conversationCache = new Map();
  
  // Cache TTL (5 minutes)
  CACHE_TTL = 5 * 60 * 1000;

  // Get messages for a conversation (with caching)
  async getMessages(conversationId, params = {}) {
    try {
      const cacheKey = `${conversationId}_${params.page || 1}_${params.limit || 15}`;
      const cached = this.messageCache.get(cacheKey);
      
      // Return cached data if available and fresh (only for page 1)
      if (cached && params.page === 1 && (Date.now() - cached.timestamp < this.CACHE_TTL)) {
        console.log('📦 Using cached messages for', conversationId);
        return cached.data;
      }

      const response = await api.get(`/chat/conversations/${conversationId}/messages`, { params });
      
      // Cache the response (only page 1 for now)
      if (params.page === 1) {
        this.messageCache.set(cacheKey, {
          data: response.data,
          timestamp: Date.now()
        });
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }
  }

  // Invalidate message cache for a conversation
  invalidateMessageCache(conversationId) {
    // Remove all cache entries for this conversation
    for (const key of this.messageCache.keys()) {
      if (key.startsWith(conversationId)) {
        this.messageCache.delete(key);
      }
    }
  }

  // Send a message
  async sendMessage(conversationId, messageData) {
    try {
      const response = await api.post(`/chat/conversations/${conversationId}/messages`, messageData);
      // Invalidate cache when sending new message
      this.invalidateMessageCache(conversationId);
      this.invalidateConversationCache();
      return response.data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  // IMAGE METHODS

  // Upload an image for chat
  async uploadImage(imageFile, options = {}) {
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      
      if (options.conversationId) {
        formData.append('conversationId', options.conversationId);
      }

      const response = await api.post('/chat/images/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        ...options.requestOptions
      });

      return response.data;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  }

  // Send an image message
  async sendImageMessage(conversationId, imageId, caption = '', replyTo = null) {
    try {
      const messageData = {
        messageType: 'image',
        imageId,
        content: caption,
        replyTo
      };

      const response = await api.post(`/chat/conversations/${conversationId}/messages`, messageData);
      return response.data;
    } catch (error) {
      console.error('Error sending image message:', error);
      throw error;
    }
  }

  // Get image info
  async getImageInfo(imageId) {
    try {
      const response = await api.get(`/chat/images/${imageId}/info`);
      return response.data;
    } catch (error) {
      console.error('Error getting image info:', error);
      throw error;
    }
  }

  // Get user's uploaded images
  async getUserImages(params = {}) {
    try {
      const response = await api.get('/chat/images/my/images', { params });
      return response.data;
    } catch (error) {
      console.error('Error getting user images:', error);
      throw error;
    }
  }

  // Delete an image
  async deleteImage(imageId) {
    try {
      const response = await api.delete(`/chat/images/${imageId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting image:', error);
      throw error;
    }
  }

  // Get image URL with authentication token
  getImageUrl(imageId) {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const state = store.getState();
    const token = state.auth.token;
    return `${apiUrl}/chat/images/${imageId}?token=${encodeURIComponent(token)}`;
  }

  // Get thumbnail URL with authentication token
  getThumbnailUrl(imageId) {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const state = store.getState();
    const token = state.auth.token;
    return `${apiUrl}/chat/images/${imageId}/thumbnail?token=${encodeURIComponent(token)}`;
  }

  // Utility: Validate image file
  validateImageFile(file, options = {}) {
    const {
      maxSize = 50 * 1024 * 1024, // 50MB default
      allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    } = options;

    const errors = [];

    if (!file) {
      errors.push('No file selected');
      return { valid: false, errors };
    }

    if (!allowedTypes.includes(file.type)) {
      errors.push(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`);
    }

    if (file.size > maxSize) {
      const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
      errors.push(`File size exceeds ${maxSizeMB}MB limit`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Utility: Format file size
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Edit a message
  async editMessage(messageId, content) {
    try {
      const response = await api.put(`/chat/messages/${messageId}`, { content });
      // Don't invalidate cache for edits - real-time updates will handle it
      return response.data;
    } catch (error) {
      console.error('Error editing message:', error);
      throw error;
    }
  }

  // Delete a message
  async deleteMessage(messageId) {
    try {
      const response = await api.delete(`/chat/messages/${messageId}`);
      // Don't invalidate cache for deletes - real-time updates will handle it
      return response.data;
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  }

  // Get users that can be chatted with
  async getChatableUsers(params = {}) {
    try {
      const response = await api.get('/chat/users', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching chatable users:', error);
      throw error;
    }
  }

  // Get unread message count
  async getUnreadCount() {
    try {
      const response = await api.get('/chat/unread-count');
      return response.data;
    } catch (error) {
      console.error('Error fetching unread count:', error);
      throw error;
    }
  }

  // Mark conversation as read
  async markConversationAsRead(conversationId) {
    try {
      const response = await unreadService.markConversationAsRead(conversationId);
      
      // Emit event to notify other components that a conversation was read
      this.emit('chat:conversation_read', { conversationId });
      
      return response;
    } catch (error) {
      console.error('Error marking conversation as read:', error);
      throw error;
    }
  }

  // GROUP CONVERSATION METHODS

  // Create a new group conversation (admin only)
  async createGroupConversation(groupData) {
    try {
      const response = await api.post('/chat/groups', groupData);
      return response.data;
    } catch (error) {
      console.error('Error creating group conversation:', error);
      throw error;
    }
  }

  // Add participants to a group
  async addParticipantsToGroup(conversationId, participantIds) {
    try {
      const response = await api.post(`/chat/groups/${conversationId}/participants`, {
        participantIds
      });
      return response.data;
    } catch (error) {
      console.error('Error adding participants to group:', error);
      throw error;
    }
  }

  // Remove participant from a group
  async removeParticipantFromGroup(conversationId, participantId) {
    try {
      const response = await api.delete(`/chat/groups/${conversationId}/participants/${participantId}`);
      return response.data;
    } catch (error) {
      console.error('Error removing participant from group:', error);
      throw error;
    }
  }

  // Update group conversation details
  async updateGroupConversation(conversationId, updates) {
    try {
      const response = await api.put(`/chat/groups/${conversationId}`, updates);
      return response.data;
    } catch (error) {
      console.error('Error updating group conversation:', error);
      throw error;
    }
  }

  // Get connection status
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  // Search messages within a conversation
  async searchMessages(conversationId, searchQuery, params = {}) {
    try {
      const { limit = 20, skip = 0 } = params;
      const response = await api.get(`/chat/conversations/${conversationId}/messages/search`, { 
        params: {
          query: searchQuery,
          limit,
          skip
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error searching messages:', error);
      throw error;
    }
  }

  // REACTION METHODS

  // Add a reaction to a message
  async addReaction(messageId, emoji) {
    try {
      const response = await api.post(`/chat/messages/${messageId}/reactions`, { emoji });
      return response.data;
    } catch (error) {
      console.error('Error adding reaction:', error);
      throw error;
    }
  }

  // Remove a reaction from a message
  async removeReaction(messageId, emoji) {
    try {
      const response = await api.delete(`/chat/messages/${messageId}/reactions`, { 
        data: { emoji }
      });
      return response.data;
    } catch (error) {
      console.error('Error removing reaction:', error);
      throw error;
    }
  }
}

// Create singleton instance
const chatService = new ChatService();

export default chatService; 