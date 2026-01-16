import io from 'socket.io-client';
import api from './api';
import { store } from '../store/store';

/**
 * Browser Service
 * Manages fingerprint browser sessions and remote viewing
 */
class BrowserService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.currentSession = null;
    this.frameListeners = [];
    this.statusListeners = [];
    this.isStreaming = false;
  }

  /**
   * Initialize socket connection for browser streaming
   */
  connect() {
    if (this.socket && this.socket.connected) {
      console.log('🌐 Browser socket already connected');
      return;
    }

    const state = store.getState();
    const token = state.auth.token;

    if (!token) {
      console.error('No auth token available');
      return;
    }

    // Construct WebSocket URL
    let socketUrl;
    if (import.meta.env.VITE_API_URL) {
      socketUrl = import.meta.env.VITE_API_URL
        .replace('/api', '')
        .replace('https://', 'wss://')
        .replace('http://', 'ws://');
    } else {
      socketUrl = 'http://localhost:5000';
    }

    console.log('🌐 Connecting browser service to:', socketUrl);

    this.socket = io(socketUrl, {
      auth: { token },
      transports: ['polling', 'websocket'],
      upgrade: true,
      timeout: 30000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      withCredentials: true,
    });

    this.setupEventListeners();
  }

  /**
   * Set up socket event listeners
   */
  setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ Browser service connected');
      this.isConnected = true;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Browser service disconnected:', reason);
      this.isConnected = false;
      this.isStreaming = false;
    });

    this.socket.on('browser:frame', (data) => {
      this.frameListeners.forEach(listener => listener(data));
    });

    this.socket.on('browser:stream_ended', (data) => {
      console.log('📺 Stream ended:', data.reason);
      this.isStreaming = false;
      this.statusListeners.forEach(listener => listener({ type: 'stream_ended', ...data }));
    });
  }

  /**
   * Create a new browser session for a lead
   */
  async createSession(leadId, options = {}) {
    try {
      const response = await api.post('/fingerprint-browser/sessions', {
        leadId,
        proxy: options.proxy,
        headless: options.headless,
      });

      if (response.data.success) {
        this.currentSession = response.data.data;
        return this.currentSession;
      }

      throw new Error(response.data.message || 'Failed to create session');
    } catch (error) {
      console.error('Error creating browser session:', error);
      throw error;
    }
  }

  /**
   * Get session status
   */
  async getSession(sessionId) {
    try {
      const response = await api.get(`/fingerprint-browser/sessions/${sessionId}`);
      return response.data.data;
    } catch (error) {
      console.error('Error getting session:', error);
      throw error;
    }
  }

  /**
   * Close a browser session
   */
  async closeSession(sessionId, saveSession = true) {
    try {
      const response = await api.delete(
        `/fingerprint-browser/sessions/${sessionId}?saveSession=${saveSession}`
      );

      if (sessionId === this.currentSession?.sessionId) {
        this.currentSession = null;
      }

      return response.data;
    } catch (error) {
      console.error('Error closing session:', error);
      throw error;
    }
  }

  /**
   * Start streaming browser screenshots
   */
  async startStream(sessionId, options = {}) {
    try {
      const response = await api.post(
        `/fingerprint-browser/sessions/${sessionId}/stream/start`,
        {
          fps: options.fps || 5,
          quality: options.quality || 60,
        }
      );

      if (response.data.success) {
        // Join the stream room
        const room = response.data.data.room;
        this.socket.emit('join_room', room, (ack) => {
          if (ack?.success) {
            console.log('📺 Joined stream room:', room);
            this.isStreaming = true;
          }
        });

        return response.data.data;
      }

      throw new Error(response.data.message || 'Failed to start stream');
    } catch (error) {
      console.error('Error starting stream:', error);
      throw error;
    }
  }

  /**
   * Stop streaming
   */
  async stopStream(sessionId) {
    try {
      this.isStreaming = false;
      const response = await api.post(
        `/fingerprint-browser/sessions/${sessionId}/stream/stop`
      );
      return response.data;
    } catch (error) {
      console.error('Error stopping stream:', error);
      throw error;
    }
  }

  /**
   * Navigate to URL
   */
  async navigateTo(sessionId, url) {
    try {
      const response = await api.post(
        `/fingerprint-browser/sessions/${sessionId}/navigate`,
        { url }
      );
      return response.data.data;
    } catch (error) {
      console.error('Error navigating:', error);
      throw error;
    }
  }

  /**
   * Take screenshot
   */
  async takeScreenshot(sessionId, options = {}) {
    try {
      const response = await api.post(
        `/fingerprint-browser/sessions/${sessionId}/screenshot`,
        options
      );
      return response.data.data;
    } catch (error) {
      console.error('Error taking screenshot:', error);
      throw error;
    }
  }

  /**
   * Fill form fields
   */
  async fillForm(sessionId, fields) {
    try {
      const response = await api.post(
        `/fingerprint-browser/sessions/${sessionId}/fill`,
        { fields }
      );
      return response.data.data;
    } catch (error) {
      console.error('Error filling form:', error);
      throw error;
    }
  }

  /**
   * Click element
   */
  async click(sessionId, selector, options = {}) {
    try {
      const response = await api.post(
        `/fingerprint-browser/sessions/${sessionId}/click`,
        { selector, ...options }
      );
      return response.data.data;
    } catch (error) {
      console.error('Error clicking:', error);
      throw error;
    }
  }

  /**
   * Send mouse event
   */
  async sendMouseEvent(sessionId, event) {
    try {
      const response = await api.post(
        `/fingerprint-browser/sessions/${sessionId}/input/mouse`,
        event
      );
      return response.data.data;
    } catch (error) {
      console.error('Error sending mouse event:', error);
      throw error;
    }
  }

  /**
   * Send keyboard event
   */
  async sendKeyboardEvent(sessionId, event) {
    try {
      const response = await api.post(
        `/fingerprint-browser/sessions/${sessionId}/input/keyboard`,
        event
      );
      return response.data.data;
    } catch (error) {
      console.error('Error sending keyboard event:', error);
      throw error;
    }
  }

  /**
   * Send scroll event
   */
  async sendScrollEvent(sessionId, event) {
    try {
      const response = await api.post(
        `/fingerprint-browser/sessions/${sessionId}/input/scroll`,
        event
      );
      return response.data.data;
    } catch (error) {
      console.error('Error sending scroll event:', error);
      throw error;
    }
  }

  /**
   * Get health status
   */
  async getHealth() {
    try {
      const response = await api.get('/fingerprint-browser/health');
      return response.data.data;
    } catch (error) {
      console.error('Error getting health:', error);
      throw error;
    }
  }

  /**
   * Add frame listener
   */
  onFrame(listener) {
    this.frameListeners.push(listener);
    return () => {
      this.frameListeners = this.frameListeners.filter(l => l !== listener);
    };
  }

  /**
   * Add status listener
   */
  onStatus(listener) {
    this.statusListeners.push(listener);
    return () => {
      this.statusListeners = this.statusListeners.filter(l => l !== listener);
    };
  }

  /**
   * Disconnect
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.isStreaming = false;
  }
}

// Export singleton
const browserService = new BrowserService();
export default browserService;
