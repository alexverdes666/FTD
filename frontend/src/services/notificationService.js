class NotificationService {
  constructor() {
    this.isEnabled = true;
    this.audioEnabled = true;
    this.browserNotificationsEnabled = true;
    this.audioContext = null;
    this.notificationSound = null;
    this.permission = 'default';
    
    // Initialize the service
    this.init();
  }

  async init() {
    // Request notification permission
    await this.requestPermission();
    
    // Create audio notification sound
    this.createNotificationSound();
    
    // Load settings from localStorage
    this.loadSettings();
  }

  // Request browser notification permission
  async requestPermission() {
    if ('Notification' in window) {
      try {
        this.permission = await Notification.requestPermission();
        this.browserNotificationsEnabled = this.permission === 'granted';
      } catch (error) {
        console.warn('Error requesting notification permission:', error);
        this.browserNotificationsEnabled = false;
      }
    } else {
      console.warn('Browser notifications not supported');
      this.browserNotificationsEnabled = false;
    }
  }

  // Create audio notification sound using Web Audio API
  createNotificationSound() {
    try {
      // Create AudioContext
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Create a simple notification sound
      this.createNotificationTone();
    } catch (error) {
      console.warn('Web Audio API not supported, falling back to HTML Audio:', error);
      this.createHTMLAudio();
    }
  }

  // Create notification tone using Web Audio API
  createNotificationTone() {
    const duration = 0.3; // 300ms
    const sampleRate = this.audioContext.sampleRate;
    const numSamples = duration * sampleRate;
    const buffer = this.audioContext.createBuffer(1, numSamples, sampleRate);
    const data = buffer.getChannelData(0);

    // Generate a pleasant notification tone (two frequencies)
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      // Combine two sine waves for a pleasant sound
      const freq1 = 800; // Higher frequency
      const freq2 = 600; // Lower frequency
      const envelope = Math.exp(-t * 3); // Fade out envelope
      
      data[i] = envelope * (
        Math.sin(2 * Math.PI * freq1 * t) * 0.3 +
        Math.sin(2 * Math.PI * freq2 * t) * 0.2
      );
    }

    this.notificationSound = buffer;
  }

  // Fallback to HTML Audio
  createHTMLAudio() {
    // Create a data URL for a simple beep sound
    const audioData = this.generateBeepDataURL();
    this.notificationSound = new Audio(audioData);
    this.notificationSound.volume = 0.5;
  }

  // Generate a simple beep sound as data URL
  generateBeepDataURL() {
    const sampleRate = 22050;
    const duration = 0.3;
    const samples = sampleRate * duration;
    const buffer = new ArrayBuffer(44 + samples * 2);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, samples * 2, true);
    
    // Generate audio data
    let offset = 44;
    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      const frequency = 800;
      const amplitude = Math.exp(-t * 3) * 0.3; // Fade out
      const sample = Math.sin(2 * Math.PI * frequency * t) * amplitude;
      const intSample = Math.max(-32768, Math.min(32767, sample * 32767));
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
    
    const blob = new Blob([buffer], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  }

  // Play notification sound
  playNotificationSound() {
    if (!this.audioEnabled || !this.isEnabled) return;

    try {
      if (this.audioContext && this.notificationSound instanceof AudioBuffer) {
        // Web Audio API
        const source = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();
        
        source.buffer = this.notificationSound;
        gainNode.gain.value = 0.5;
        
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        source.start();
      } else if (this.notificationSound instanceof Audio) {
        // HTML Audio fallback
        this.notificationSound.currentTime = 0;
        this.notificationSound.play().catch(error => {
          console.warn('Error playing notification sound:', error);
        });
      }
    } catch (error) {
      console.warn('Error playing notification sound:', error);
    }
  }

  // Show browser notification
  showBrowserNotification(title, options = {}) {
    if (!this.browserNotificationsEnabled || !this.isEnabled) return null;

    try {
      const notification = new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'chat-message',
        renotify: true,
        requireInteraction: false,
        silent: false, // Let the browser handle sound if needed
        ...options
      });

      // Auto-close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);

      return notification;
    } catch (error) {
      console.warn('Error showing browser notification:', error);
      return null;
    }
  }

  // Main notification method for incoming messages
  notifyNewMessage(message, conversation, currentUser) {
    // Don't notify for own messages
    if (message.sender._id === currentUser._id) return;

    // Don't notify if chat window is focused and conversation is selected
    if (document.hasFocus() && this.isCurrentConversationActive(conversation._id)) {
      console.log('🔇 Skipping notification - conversation is active and window focused');
      return;
    }

    console.log('🔊 Playing notification sound and showing notification');
    
    // Play sound
    this.playNotificationSound();

    // Show browser notification
    const senderName = message.sender.fullName || 'Someone';
    const conversationTitle = this.getConversationTitle(conversation, currentUser);
    
    let notificationTitle = `New message from ${senderName}`;
    if (conversation.type === 'group') {
      notificationTitle = `${senderName} in ${conversationTitle}`;
    }

    let body = message.content;
    if (message.messageType === 'image') {
      body = '📷 Sent an image';
    }

    // Limit body text length
    if (body.length > 100) {
      body = body.substring(0, 97) + '...';
    }

    const notification = this.showBrowserNotification(notificationTitle, {
      body,
      data: {
        conversationId: conversation._id,
        messageId: message._id
      }
    });

    // Handle notification click
    if (notification) {
      notification.onclick = () => {
        window.focus();
        // Dispatch custom event to open chat
        window.dispatchEvent(new CustomEvent('openChatConversation', {
          detail: { conversationId: conversation._id }
        }));
        notification.close();
      };
    }
  }

  // Mention notification
  notifyMention(message, mentionedBy, conversationId) {
    console.log('🔔 You were mentioned!');
    
    // Play a special sound for mentions (could be different from regular notifications)
    this.playNotificationSound();

    // Show browser notification
    const senderName = mentionedBy.fullName || 'Someone';
    const title = `${senderName} mentioned you`;
    
    let body = message.content;
    if (message.messageType === 'image') {
      body = '📷 Sent an image';
    }

    // Limit body text length
    if (body.length > 100) {
      body = body.substring(0, 97) + '...';
    }

    const notification = this.showBrowserNotification(title, {
      body,
      icon: '/favicon.ico',
      tag: 'mention',
      requireInteraction: true, // Keep mention notifications until user interacts
      data: {
        conversationId,
        messageId: message._id,
        type: 'mention'
      }
    });

    // Handle notification click
    if (notification) {
      notification.onclick = () => {
        window.focus();
        // Dispatch custom event to open chat
        window.dispatchEvent(new CustomEvent('openChatConversation', {
          detail: { conversationId }
        }));
        notification.close();
      };
    }
  }

  // Ticket notification methods
  notifyTicketCreated(ticket, currentUser) {
    // Don't notify if user is the creator
    if (ticket.createdBy._id === currentUser._id) return;

    // Play sound
    this.playNotificationSound();

    // Show browser notification
    const creatorName = ticket.createdBy.fullName || 'Someone';
    const title = `New Support Ticket Created`;
    const body = `${creatorName} created: "${ticket.title}"`;

    const notification = this.showBrowserNotification(title, {
      body,
      icon: '/favicon.ico',
      tag: 'ticket-created',
      data: {
        ticketId: ticket._id,
        type: 'ticket_created'
      }
    });

    // Handle notification click
    if (notification) {
      notification.onclick = () => {
        window.focus();
        window.dispatchEvent(new CustomEvent('openTicket', {
          detail: { ticketId: ticket._id }
        }));
        notification.close();
      };
    }
  }

  // Assignment notifications removed - only admins handle all tickets

  notifyTicketStatusChanged(ticket, oldStatus, currentUser) {
    // Don't notify if user made the change
    if (ticket.lastActivityBy && ticket.lastActivityBy._id === currentUser._id) return;

    // Only notify ticket creator and admins
    const shouldNotify = 
      ticket.createdBy._id === currentUser._id || 
      currentUser.role === 'admin';

    if (!shouldNotify) return;

    // Play sound for important status changes
    if (['resolved', 'closed'].includes(ticket.status)) {
      this.playNotificationSound();
    }

    // Show browser notification
    let title = `Ticket Status Updated`;
    let body = `"${ticket.title}" is now ${ticket.status.replace('_', ' ').toUpperCase()}`;

    if (ticket.status === 'resolved' && ticket.resolution?.resolvedBy) {
      body = `"${ticket.title}" was resolved by ${ticket.resolution.resolvedBy.fullName}`;
    }

    const notification = this.showBrowserNotification(title, {
      body,
      icon: '/favicon.ico',
      tag: 'ticket-status',
      data: {
        ticketId: ticket._id,
        type: 'ticket_status_changed'
      }
    });

    // Handle notification click
    if (notification) {
      notification.onclick = () => {
        window.focus();
        window.dispatchEvent(new CustomEvent('openTicket', {
          detail: { ticketId: ticket._id }
        }));
        notification.close();
      };
    }
  }

  notifyTicketCommentAdded(ticket, comment, currentUser) {
    // Don't notify if user added the comment
    if (comment.user._id === currentUser._id) return;

    // Only notify relevant users (and don't notify internal comments to non-admins)
    const isAdmin = currentUser.role === 'admin';
    if (comment.isInternal && !isAdmin) return;

    const shouldNotify = 
      ticket.createdBy._id === currentUser._id || 
      currentUser.role === 'admin';

    if (!shouldNotify) return;

    // Play sound
    this.playNotificationSound();

    // Show browser notification
    const commenterName = comment.user.fullName || 'Someone';
    const title = `New Comment on Ticket`;
    let body = `${commenterName}: "${comment.message}"`;
    
    if (body.length > 100) {
      body = body.substring(0, 97) + '...';
    }

    const notification = this.showBrowserNotification(title, {
      body,
      icon: '/favicon.ico',
      tag: 'ticket-comment',
      data: {
        ticketId: ticket._id,
        commentId: comment._id,
        type: 'ticket_comment_added'
      }
    });

    // Handle notification click
    if (notification) {
      notification.onclick = () => {
        window.focus();
        window.dispatchEvent(new CustomEvent('openTicket', {
          detail: { ticketId: ticket._id }
        }));
        notification.close();
      };
    }
  }

  notifyTicketEscalated(ticket, currentUser) {
    // Don't notify if user escalated it
    if (ticket.escalatedBy && ticket.escalatedBy._id === currentUser._id) return;

    // Notify only admins about escalated tickets
    if (currentUser.role !== 'admin') return;

    // Play urgent sound
    this.playNotificationSound();

    // Show browser notification
    const escalatedBy = ticket.escalatedBy?.fullName || 'Someone';
    const title = `🚨 Ticket Escalated`;
    const body = `"${ticket.title}" was escalated by ${escalatedBy}`;

    const notification = this.showBrowserNotification(title, {
      body,
      icon: '/favicon.ico',
      tag: 'ticket-escalated',
      requireInteraction: true, // Keep notification until user interacts
      data: {
        ticketId: ticket._id,
        type: 'ticket_escalated'
      }
    });

    // Handle notification click
    if (notification) {
      notification.onclick = () => {
        window.focus();
        window.dispatchEvent(new CustomEvent('openTicket', {
          detail: { ticketId: ticket._id }
        }));
        notification.close();
      };
    }
  }

  notifyTicketOverdue(ticket, currentUser) {
    // Only notify admins about overdue tickets
    if (currentUser.role !== 'admin') return;

    // Play urgent sound
    this.playNotificationSound();

    // Show browser notification
    const title = `⏰ Ticket Overdue`;
    const body = `"${ticket.title}" is past its due date`;

    const notification = this.showBrowserNotification(title, {
      body,
      icon: '/favicon.ico',
      tag: 'ticket-overdue',
      requireInteraction: true,
      data: {
        ticketId: ticket._id,
        type: 'ticket_overdue'
      }
    });

    // Handle notification click
    if (notification) {
      notification.onclick = () => {
        window.focus();
        window.dispatchEvent(new CustomEvent('openTicket', {
          detail: { ticketId: ticket._id }
        }));
        notification.close();
      };
    }
  }

  // Helper to get conversation title
  getConversationTitle(conversation, currentUser) {
    if (conversation.title) return conversation.title;
    if (conversation.type === 'group') {
      const participantNames = conversation.participants
        ?.filter(p => p.user && p.user._id !== currentUser._id)
        .map(p => p.user?.fullName || 'Unknown')
        .slice(0, 2)
        .join(', ');
      return participantNames ? `${participantNames}${conversation.participants.length > 3 ? '...' : ''}` : 'Group Chat';
    }
    if (conversation.otherParticipant) {
      return conversation.otherParticipant.fullName;
    }
    return 'Chat';
  }

  // Check if current conversation is active (this would be set by the chat component)
  isCurrentConversationActive(conversationId) {
    return this.activeConversationId === conversationId;
  }

  // Set active conversation (called by chat component)
  setActiveConversation(conversationId) {
    this.activeConversationId = conversationId;
  }

  // Settings management
  loadSettings() {
    try {
      const settings = localStorage.getItem('notificationSettings');
      if (settings) {
        const parsed = JSON.parse(settings);
        this.isEnabled = parsed.isEnabled !== false;
        this.audioEnabled = parsed.audioEnabled !== false;
        this.browserNotificationsEnabled = parsed.browserNotificationsEnabled !== false;
      }
    } catch (error) {
      console.warn('Error loading notification settings:', error);
    }
  }

  saveSettings() {
    try {
      const settings = {
        isEnabled: this.isEnabled,
        audioEnabled: this.audioEnabled,
        browserNotificationsEnabled: this.browserNotificationsEnabled
      };
      localStorage.setItem('notificationSettings', JSON.stringify(settings));
    } catch (error) {
      console.warn('Error saving notification settings:', error);
    }
  }

  // Enable/disable notifications
  setEnabled(enabled) {
    this.isEnabled = enabled;
    this.saveSettings();
  }

  setAudioEnabled(enabled) {
    this.audioEnabled = enabled;
    this.saveSettings();
  }

  setBrowserNotificationsEnabled(enabled) {
    this.browserNotificationsEnabled = enabled;
    this.saveSettings();
    
    if (enabled && this.permission !== 'granted') {
      this.requestPermission();
    }
  }

  // Get current settings
  getSettings() {
    return {
      isEnabled: this.isEnabled,
      audioEnabled: this.audioEnabled,
      browserNotificationsEnabled: this.browserNotificationsEnabled,
      permission: this.permission
    };
  }

  // Test notification
  testNotification() {
    this.playNotificationSound();
    this.showBrowserNotification('Test Notification', {
      body: 'This is a test notification from the chat system.'
    });
  }

  // Cleanup
  destroy() {
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}

// Create singleton instance
const notificationService = new NotificationService();

export default notificationService;