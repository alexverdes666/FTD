import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import DOMPurify from 'dompurify';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  TextField,
  IconButton,
  Divider,
  Badge,
  CircularProgress,
  LinearProgress,
  Chip,
  InputAdornment,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
  Tooltip,
  Popover,
  AvatarGroup,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  Send as SendIcon,
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Reply as ReplyIcon,
  Close as CloseIcon,
  Chat as ChatIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  EmojiEmotions as EmojiIcon,
  Add as AddIcon,
  Image as ImageIcon,
  AttachFile as AttachFileIcon,
  Settings as SettingsIcon,
  Notifications as NotificationsIcon,
  VolumeUp as VolumeUpIcon,
  VolumeOff as VolumeOffIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon
} from '@mui/icons-material';
import EmojiPicker from 'emoji-picker-react';
import { useSelector } from 'react-redux';
import { selectUser } from '../store/slices/authSlice';
import chatService from '../services/chatService';
import unreadService from '../services/unreadService';
import CreateGroupDialog from './CreateGroupDialog';
import GroupManagementDialog from './GroupManagementDialog';
import ChatImageUpload from './ChatImageUpload';
import ChatImageMessage from './ChatImageMessage';
import ChatMessageInput from './ChatMessageInput';
import MentionAutocomplete from './MentionAutocomplete';
import MessageReactions from './MessageReactions';
import MessageSeenBy from './MessageSeenBy';
import notificationService from '../services/notificationService';
import { useUnreadCounts } from '../hooks/useUnreadCounts';
import { parseMentions, detectMentionTyping, insertMention, cleanMentionsForDisplay } from '../utils/mentionUtils';

const ChatWindow = ({ isOpen, onClose, initialConversationId = null, initialParticipantId = null }) => {
  const user = useSelector(selectUser);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [messageMenuAnchor, setMessageMenuAnchor] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [chatableUsers, setChatableUsers] = useState([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [showCreateGroupDialog, setShowCreateGroupDialog] = useState(false);
  const [showGroupManagementDialog, setShowGroupManagementDialog] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState({ isConnected: false });
  const [isSending, setIsSending] = useState(false);
  
  // Use the unread counts hook
  const { unreadCounts } = useUnreadCounts();

  // Message search states
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [jumpingToMessage, setJumpingToMessage] = useState(null); // ID of message we're jumping to
  const [showSidebar, setShowSidebar] = useState(true);

  // Emoji picker states
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiAnchorEl, setEmojiAnchorEl] = useState(null);

  // Image upload states
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [pasteUploading, setPasteUploading] = useState(false);
  const [pasteUploadProgress, setPasteUploadProgress] = useState(0);

  // Notification states
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState(notificationService.getSettings());

  // Queue for messages received before conversation is selected
  const [pendingMessages, setPendingMessages] = useState([]);

  // Refresh messages state
  const [refreshingMessages, setRefreshingMessages] = useState(false);

  // Mention states
  const [showMentionAutocomplete, setShowMentionAutocomplete] = useState(false);
  const [mentionSearchTerm, setMentionSearchTerm] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Lazy loading states
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalMessagesCount, setTotalMessagesCount] = useState(0);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const messageInputRef = useRef(null);
  
  // Track processed messages to avoid duplicates
  const processedMessages = useRef(new Set());
  
  // Track previous scroll height for maintaining scroll position when loading more
  const previousScrollHeightRef = useRef(0);
  
  // Refs to store latest values without triggering re-renders in callbacks
  const newMessageRef = useRef(newMessage);
  const isSendingRef = useRef(isSending);
  const showMentionAutocompleteRef = useRef(showMentionAutocomplete);
  const replyToMessageRef = useRef(replyToMessage);
  const pasteUploadingRef = useRef(pasteUploading);
  
  // Track typing indicator state to avoid emitting on every keystroke
  const isTypingRef = useRef(false);
  const selectedConversationRef = useRef(selectedConversation);
  
  // Keep refs in sync with state
  useEffect(() => {
    newMessageRef.current = newMessage;
  }, [newMessage]);
  
  useEffect(() => {
    isSendingRef.current = isSending;
  }, [isSending]);
  
  useEffect(() => {
    showMentionAutocompleteRef.current = showMentionAutocomplete;
  }, [showMentionAutocomplete]);
  
  useEffect(() => {
    replyToMessageRef.current = replyToMessage;
  }, [replyToMessage]);
  
  useEffect(() => {
    pasteUploadingRef.current = pasteUploading;
  }, [pasteUploading]);
  
  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  // Filter chatable users based on search query (memoized for performance)
  const filteredChatableUsers = useMemo(() => {
    return chatableUsers.filter(chatUser => {
      if (!userSearchQuery.trim()) return true;
      
      const query = userSearchQuery.toLowerCase();
      return (
        chatUser.fullName.toLowerCase().includes(query) ||
        chatUser.email.toLowerCase().includes(query) ||
        chatUser.role.toLowerCase().replace('_', ' ').includes(query)
      );
    });
  }, [chatableUsers, userSearchQuery]);

  // Helper functions (defined early to avoid hoisting issues)
  const loadConversations = useCallback(async () => {
    try {
      const response = await chatService.getConversations();
      setConversations(response.data || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  }, []);

  const handleClearSearch = useCallback(() => {
    setMessageSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
    setSearchError(null);
    setJumpingToMessage(null);
  }, []);

  // Scroll to bottom function (defined early to avoid hoisting issues)
  const scrollToBottom = useCallback((behavior = 'auto') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: 'end', inline: 'nearest' });
    }
  }, []);

  const selectConversation = useCallback(async (conversation) => {

    try {
      // Hide sidebar on mobile when selecting conversation
      setShowSidebar(false);
      
      // Leave previous conversation room using functional state update
      setSelectedConversation(currentSelected => {
        if (currentSelected) {
          chatService.leaveConversation(currentSelected._id).catch(error => {
            console.error('Failed to leave previous conversation room:', error);
          });
        }
        return conversation;
      });

      setMessages([]);
      setMessagesLoading(true);
      
      // Reset pagination state
      setCurrentPage(1);
      setHasMoreMessages(true);
      setTotalMessagesCount(0);
      
      // Clear search state when switching conversations
      setMessageSearchQuery('');
      setSearchResults([]);
      setShowSearchResults(false);
      setSearchError(null);
      setJumpingToMessage(null);

      // Join new conversation room with error handling
      try {
        await chatService.joinConversation(conversation._id);
      } catch (error) {
        console.error('Failed to join conversation room:', error);
      }

      // Set active conversation for notifications
      notificationService.setActiveConversation(conversation._id);

      // Load initial messages (page 1, limit 15 for faster loading)
      const messagesResponse = await chatService.getMessages(conversation._id, { 
        page: 1, 
        limit: 15 
      });
      const loadedMessages = messagesResponse.data || [];
      const pagination = messagesResponse.pagination || {};
      
      // Update pagination state
      setHasMoreMessages(pagination.hasMore || false);
      setTotalMessagesCount(prev => prev + loadedMessages.length); // Approximate count
      
      // Check for any pending messages for this conversation
      setPendingMessages(prevPending => {
        const conversationPendingMessages = prevPending.filter(
          msg => msg.conversationId === conversation._id
        );
        
        if (conversationPendingMessages.length > 0) {
          // Add pending messages that aren't already in loaded messages
          const newMessages = conversationPendingMessages.filter(pendingMsg => 
            !loadedMessages.find(loadedMsg => loadedMsg._id === pendingMsg.message._id)
          ).map(pendingMsg => ({ ...pendingMsg.message, status: 'sent' }));
          
          setMessages([...loadedMessages, ...newMessages]);
          
          // Return pending messages without the ones for this conversation
          return prevPending.filter(msg => msg.conversationId !== conversation._id);
        } else {
          setMessages(loadedMessages);
          return prevPending;
        }
      });

      // Mark conversation as read when opened
      await chatService.markConversationAsRead(conversation._id);
      
      // Update local unread service to ensure UI is immediately updated
      await unreadService.markConversationAsRead(conversation._id);

      // Scroll to bottom with a delay to ensure DOM is fully rendered
      // Use a longer delay for initial load
      setTimeout(() => {
        scrollToBottom('auto');
        // Double-check scroll position after another short delay
        setTimeout(() => scrollToBottom('auto'), 100);
      }, 150);

    } catch (error) {
      console.error('Error selecting conversation:', error);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  const selectConversationById = useCallback(async (conversationId) => {
    try {
      const response = await chatService.getConversation(conversationId);
      await selectConversation(response.data);
        } catch (error) {
      console.error('Error selecting conversation:', error);
    }
  }, [selectConversation]);

  // Load more messages (lazy loading)
  const loadMoreMessages = useCallback(async () => {
    if (!selectedConversation || !hasMoreMessages || isLoadingMore) {
      return;
    }

    try {
      setIsLoadingMore(true);
      
      // Store current scroll position
      const container = messagesContainerRef.current;
      if (container) {
        previousScrollHeightRef.current = container.scrollHeight;
      }

      const nextPage = currentPage + 1;
      const messagesResponse = await chatService.getMessages(selectedConversation._id, { 
        page: nextPage, 
        limit: 15 
      });
      
      const olderMessages = messagesResponse.data || [];
      const pagination = messagesResponse.pagination || {};

      if (olderMessages.length > 0) {
        // Prepend older messages to the beginning
        setMessages(prev => [...olderMessages, ...prev]);
        setCurrentPage(nextPage);
        setHasMoreMessages(pagination.hasMore || false);
        setTotalMessagesCount(prev => prev + olderMessages.length);
        
        // Restore scroll position after new messages are added
        setTimeout(() => {
          if (container && previousScrollHeightRef.current) {
            const newScrollHeight = container.scrollHeight;
            const scrollDiff = newScrollHeight - previousScrollHeightRef.current;
            container.scrollTop = scrollDiff;
          }
        }, 50);
      } else {
        setHasMoreMessages(false);
      }

    } catch (error) {
      console.error('Error loading more messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [selectedConversation, hasMoreMessages, isLoadingMore, currentPage]);

  // Event handlers for real-time updates (defined early to avoid hoisting issues)
  const handleNewMessage = useCallback(async (data) => {
    // Prevent duplicate processing of the same message
    const messageKey = `${data.message?._id}_${data.conversationId}`;
    if (processedMessages.current.has(messageKey)) {
      return;
    }
    processedMessages.current.add(messageKey);

    // Clean up old processed messages (keep only last 100)
    if (processedMessages.current.size > 100) {
      const entries = Array.from(processedMessages.current);
      processedMessages.current.clear();
      entries.slice(-50).forEach(key => processedMessages.current.add(key));
    }

    // Use functional state updates to avoid dependency on selectedConversation
    setSelectedConversation(currentSelected => {
      const isForCurrentConversation = currentSelected && data.conversationId === currentSelected._id;
      

      
      if (isForCurrentConversation) {
        setMessages(prev => {
          
          // Check if this message already exists (avoid duplicates with optimistic updates)
          const existingMessage = prev.find(msg =>
            msg._id === data.message._id ||
            (msg.content === data.message.content &&
             msg.sender._id === data.message.sender._id &&
             Math.abs(new Date(msg.createdAt) - new Date(data.message.createdAt)) < 5000) // Within 5 seconds
          );

          if (existingMessage) {
            // Replace optimistic message with real message
            return prev.map(msg =>
              msg._id === existingMessage._id
                ? { ...data.message, status: 'sent' }
                : msg
            );
          } else {
            // Add new message
            const newMessage = { ...data.message, status: 'sent' };
            return [...prev, newMessage];
          }
        });
        
        // If the message is from someone else and the chat window is open and focused,
        // automatically mark the conversation as read to keep unread count accurate
        if (data.message.sender._id !== user._id && isOpen && document.hasFocus()) {
          chatService.markConversationAsRead(data.conversationId).catch(error => {
            console.error('Error auto-marking conversation as read:', error);
          });
          
          // Also update local unread service
          unreadService.markConversationAsRead(data.conversationId).catch(error => {
            console.error('Error updating local unread count:', error);
          });
        }
        
        setTimeout(() => scrollToBottom(), 100);
      } else {
        // Queue the message for when the conversation is selected
        setPendingMessages(prev => [...prev, data]);
        
        // Handle notifications and unread count when chat window is open (only for messages not in current conversation)
        if (data.message.sender._id !== user._id) {
          // Increment unread count for this conversation
          unreadService.incrementUnreadCount(data.conversationId);
          
          setConversations(currentConversations => {
            // Find the conversation from our conversations list or create a mock one
            const conversation = currentConversations.find(c => c._id === data.conversationId) || {
              _id: data.conversationId,
              type: 'direct',
              otherParticipant: data.message.sender,
              participants: [{ user: data.message.sender }]
            };
            
            notificationService.notifyNewMessage(data.message, conversation, user);
            return currentConversations;
          });
        }
      }
      
      // Return the same selected conversation (no change)
      return currentSelected;
    });

    // Fetch updated conversations list from backend to ensure we have correct data
    // The backend has already updated the conversation's lastMessage in the Message post-save hook
    // This ensures we always show the decrypted content and complete message data
    chatService.getConversations()
      .then(response => {
        setConversations(response.data || []);
        
        // If this is our own message, ensure the conversation doesn't show as unread
        if (data.message.sender._id === user._id) {
          // Clear any unread count for our own messages
          unreadService.markConversationAsRead(data.conversationId).catch(error => {
            console.error('Error clearing unread count for own message:', error);
          });
        }
      })
      .catch(error => {
        console.error('Error loading conversations:', error);
      });
  }, [isOpen, user]);

  const handleMessageEdited = useCallback((data) => {
    setSelectedConversation(currentSelected => {
      if (data.conversationId === currentSelected?._id) {
        setMessages(prev => prev.map(msg =>
          msg._id === data.messageId
            ? { ...msg, content: data.newContent, isEdited: data.isEdited, editedAt: data.editedAt }
            : msg
        ));
      }
      return currentSelected;
    });
    
    // Update conversation preview if the edited message is the last message
    // Note: We can't reliably check if it's the last message from the event alone,
    // so we'll let the backend refresh handle updating the preview if needed
    // This prevents showing stale data
  }, []);

  const handleMessageDeleted = useCallback((data) => {
    setSelectedConversation(currentSelected => {
      if (data.conversationId === currentSelected?._id) {
        setMessages(prev => prev.filter(msg => msg._id !== data.messageId));
      }
      return currentSelected;
    });
  }, []);

  const handleReactionUpdated = useCallback((data) => {
    setSelectedConversation(currentSelected => {
      if (data.conversationId === currentSelected?._id) {
        setMessages(prev => prev.map(msg =>
          msg._id === data.messageId
            ? { ...msg, reactions: data.reactions }
            : msg
        ));
      }
      return currentSelected;
    });
  }, []);

  const handleUserTyping = useCallback((data) => {
    setSelectedConversation(currentSelected => {
      if (data.conversationId === currentSelected?._id && data.userId !== user._id) {
        setTypingUsers(prev => {
          if (!prev.find(u => u.userId === data.userId)) {
            return [...prev, { userId: data.userId, userName: data.userName }];
          }
          return prev;
        });
      }
      return currentSelected;
    });
  }, [user]);

  const handleUserStopTyping = useCallback((data) => {
    setSelectedConversation(currentSelected => {
      if (data.conversationId === currentSelected?._id) {
        setTypingUsers(prev => prev.filter(u => u.userId !== data.userId));
      }
      return currentSelected;
    });
  }, []);

  const handleChatConnected = useCallback(() => {
    setConnectionStatus({ isConnected: true });
  }, []);

  const handleChatDisconnected = useCallback(() => {
    setConnectionStatus({ isConnected: false });
  }, []);

  const handleGroupUpdated = useCallback(async (data) => {
    // Refresh conversations list to reflect group changes
    try {
      const response = await chatService.getConversations();
      setConversations(response.data || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }

    // If we're viewing the updated group, refresh the conversation
    setSelectedConversation(currentSelected => {
      if (currentSelected?._id === data.conversationId) {
        // Refresh the current conversation
        chatService.getConversation(data.conversationId)
          .then(response => selectConversation(response.data))
          .catch(error => console.error('Error refreshing conversation:', error));
      }
      return currentSelected;
    });
  }, [selectConversation]);

  const handleUserMentioned = useCallback((data) => {
    // Show special notification for mentions
    notificationService.notifyMention(
      data.message,
      data.mentionedBy,
      data.conversationId
    );
  }, []);

  const handleMessagesRead = useCallback((data) => {
    // Update readBy field for messages that were read
    setSelectedConversation(currentSelected => {
      if (data.conversationId === currentSelected?._id) {
        setMessages(prev => prev.map(msg => {
          // Check if this message was read
          if (data.messageIds.includes(msg._id)) {
            // Add the reader to the readBy array if not already present
            const readBy = msg.readBy || [];
            const alreadyRead = readBy.some(r => r.user && r.user._id === data.readBy?.user?._id);
            
            if (!alreadyRead) {
              return {
                ...msg,
                readBy: [...readBy, data.readBy]
              };
            }
          }
          return msg;
        }));
      }
      return currentSelected;
    });
  }, []);

  // Helper function to load chatable users
  const loadChatableUsers = useCallback(async () => {
    try {
      const response = await chatService.getChatableUsers();
      setChatableUsers(response.data || []);
    } catch (error) {
      console.error('Error loading chatable users:', error);
    }
  }, []);

  // Initialize chat on first open or user change
  const initializeChat = useCallback(async () => {
    try {
      setLoading(true);

      // Start WebSocket connection in background (non-blocking)
      const connectionStatus = chatService.getConnectionStatus();
      if (!connectionStatus.isConnected) {
        chatService.connect(); // Don't await - let it connect in background
      }

      // Load conversations and initial conversation in parallel (if needed)
      const loadTasks = [];
      
      // Always load conversations list
      loadTasks.push(
        chatService.getConversations()
          .then(response => {
            setConversations(response.data || []);
            return response;
          })
          .catch(error => {
            console.error('Error loading conversations:', error);
            return null;
          })
      );

      // If we have an initial conversation/participant, load it in parallel
      if (initialConversationId) {
        loadTasks.push(
          chatService.getConversation(initialConversationId)
            .then(response => ({ type: 'conversation', data: response.data }))
            .catch(error => {
              console.error('Error selecting initial conversation:', error);
              return null;
            })
        );
      } else if (initialParticipantId) {
        loadTasks.push(
          chatService.createOrGetConversation(initialParticipantId)
            .then(response => ({ type: 'participant', data: response.data, created: response.created }))
            .catch(error => {
              console.error('Error creating/selecting conversation:', error);
              return null;
            })
        );
      }

      // Wait for all parallel tasks
      const results = await Promise.all(loadTasks);

      // Process initial conversation if loaded
      const initialConvResult = results.find(r => r?.type);
      if (initialConvResult?.data) {
        await selectConversation(initialConvResult.data);
        
        // Refresh conversations if a new one was created
        if (initialConvResult.created) {
          try {
            const conversationsResponse = await chatService.getConversations();
            setConversations(conversationsResponse.data || []);
          } catch (error) {
            console.error('Error refreshing conversations:', error);
          }
        }
      }

      // Note: Chatable users are now loaded lazily when user opens "New Chat" dialog
      setConnectionStatus(chatService.getConnectionStatus());
    } catch (error) {
      console.error('Error initializing chat:', error);
    } finally {
      setLoading(false);
    }
  }, [initialConversationId, initialParticipantId, selectConversation]);

  // Set up event listeners once when chat opens
  useEffect(() => {
    if (isOpen && user) {
      // Refresh unread counts when chat opens to ensure accuracy
      unreadService.fetchUnreadCounts().catch(error => {
        console.error('Error fetching initial unread counts:', error);
      });

      chatService.on('chat:new_message', handleNewMessage);
      chatService.on('chat:message_edited', handleMessageEdited);
      chatService.on('chat:message_deleted', handleMessageDeleted);
      chatService.on('chat:reaction_updated', handleReactionUpdated);
      chatService.on('chat:user_typing', handleUserTyping);
      chatService.on('chat:user_stop_typing', handleUserStopTyping);
      chatService.on('chat:connected', handleChatConnected);
      chatService.on('chat:disconnected', handleChatDisconnected);
      chatService.on('chat:group_updated', handleGroupUpdated);
      chatService.on('chat:user_mentioned', handleUserMentioned);
      chatService.on('chat:messages_read', handleMessagesRead);

      return () => {
        chatService.off('chat:new_message', handleNewMessage);
        chatService.off('chat:message_edited', handleMessageEdited);
        chatService.off('chat:message_deleted', handleMessageDeleted);
        chatService.off('chat:reaction_updated', handleReactionUpdated);
        chatService.off('chat:user_typing', handleUserTyping);
        chatService.off('chat:user_stop_typing', handleUserStopTyping);
        chatService.off('chat:connected', handleChatConnected);
        chatService.off('chat:disconnected', handleChatDisconnected);
        chatService.off('chat:group_updated', handleGroupUpdated);
        chatService.off('chat:user_mentioned', handleUserMentioned);
        chatService.off('chat:messages_read', handleMessagesRead);
      };
    }
  }, [isOpen, user]); // Removed event handlers from dependencies to prevent frequent re-registration

  // Initialize chat service and load data
  useEffect(() => {
    if (isOpen && user) {
      initializeChat();
    }

    return () => {
      if (selectedConversation) {
        chatService.leaveConversation(selectedConversation._id).catch(console.error);
        notificationService.setActiveConversation(null);
      }
    };
  }, [isOpen, user, initializeChat, selectedConversation]);



  // Handle opening chat from notifications
  useEffect(() => {
    const handleOpenChat = (event) => {
      const { conversationId } = event.detail;
      if (conversationId) {
        selectConversationById(conversationId);
      }
    };

    window.addEventListener('openChatConversation', handleOpenChat);
    return () => {
      window.removeEventListener('openChatConversation', handleOpenChat);
    };
  }, []);

  // Handle window focus to mark active conversation as read
  useEffect(() => {
    const handleWindowFocus = async () => {
      // When user returns to the window and chat is open with an active conversation,
      // mark it as read to catch any messages that arrived while window was not focused
      if (isOpen && selectedConversation) {
        try {
          await chatService.markConversationAsRead(selectedConversation._id);
        } catch (error) {
          console.error('Error marking conversation as read on focus:', error);
        }
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    return () => {
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [isOpen, selectedConversation]);

  // Periodic connection health check
  useEffect(() => {
    let healthCheckInterval;
    
    if (isOpen) {
      healthCheckInterval = setInterval(() => {
        const status = chatService.getConnectionStatus();
        if (!status.isConnected) {
          chatService.ensureConnection();
        }
      }, 10000); // Check every 10 seconds
    }

    return () => {
      if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
      }
    };
  }, [isOpen]);

  // Fullscreen keyboard shortcut (F11)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      // F11 key to toggle fullscreen
      if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
      }
      // Escape key to exit fullscreen (if not typing in input)
      if (e.key === 'Escape' && isFullscreen && document.activeElement !== messageInputRef.current) {
        e.preventDefault();
        setIsFullscreen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isFullscreen]);

  // Auto-scroll to bottom when messages change (for new sent messages)
  useEffect(() => {
    if (messages.length > 0 && selectedConversation && !isLoadingMore) {
      // Small delay to ensure DOM is updated
      const timer = setTimeout(() => {
        scrollToBottom('auto');
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [messages.length, selectedConversation, isLoadingMore, scrollToBottom]);

  // Lazy load chatable users only when New Chat dialog is opened
  useEffect(() => {
    if (showNewChatDialog && chatableUsers.length === 0) {
      loadChatableUsers();
    }
  }, [showNewChatDialog, chatableUsers.length, loadChatableUsers]);



  const createOrSelectConversation = async (participantId, context = {}) => {
    try {
      const response = await chatService.createOrGetConversation(participantId, context);
      await selectConversation(response.data);

      // Refresh conversations list if new conversation was created
      if (response.created) {
        try {
          const conversationsResponse = await chatService.getConversations();
          setConversations(conversationsResponse.data || []);
        } catch (error) {
          console.error('Error loading conversations:', error);
        }
      }
    } catch (error) {
      console.error('Error creating/selecting conversation:', error);
    }
  };

  const handleSendMessage = useCallback(async () => {
    const currentMessage = newMessageRef.current;
    const currentIsSending = isSendingRef.current;
    const currentReplyTo = replyToMessageRef.current;
    
    if (!currentMessage.trim() || !selectedConversation || currentIsSending) return;

    setIsSending(true);

    const messageContent = currentMessage.trim();
    const tempId = `temp_${Date.now()}_${Math.random()}`;

    // Create optimistic message for immediate UI update
    const optimisticMessage = {
      _id: tempId,
      content: messageContent,
      messageType: 'text',
      sender: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role
      },
      conversation: selectedConversation._id,
      createdAt: new Date().toISOString(),
      status: 'sending', // Custom status for optimistic updates
      isOptimistic: true, // Flag to identify optimistic messages
      replyTo: currentReplyTo || null
    };

    // Add message to UI immediately
    setMessages(prev => [...prev, optimisticMessage]);

    // Clear input and reply state
    setNewMessage('');
    setReplyToMessage(null);

    // Stop typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      chatService.stopTyping(selectedConversation._id);
      isTypingRef.current = false;
    }

    // Scroll to bottom
    setTimeout(() => scrollToBottom(), 100);

    try {
      const messageData = {
        content: messageContent,
        messageType: 'text'
      };

      // Only include replyTo if we're actually replying to a message
      if (currentReplyTo?._id) {
        messageData.replyTo = currentReplyTo._id;
      }

      const response = await chatService.sendMessage(selectedConversation._id, messageData);

      // Replace optimistic message with real message from server
      setMessages(prev => prev.map(msg =>
        msg._id === tempId
          ? { ...response.data, status: 'sent' }
          : msg
      ));
      
      // Update conversation list to move this conversation to top
      setConversations(currentConversations => {
        const updatedConversations = currentConversations.map(conv => {
          if (conv._id === selectedConversation._id) {
            return {
              ...conv,
              lastMessage: {
                content: response.data.content || '',
                sender: {
                  _id: response.data.sender?._id || user._id,
                  fullName: response.data.sender?.fullName || user.fullName,
                  email: response.data.sender?.email || user.email,
                  role: response.data.sender?.role || user.role
                },
                timestamp: response.data.createdAt || new Date().toISOString(),
                messageType: response.data.messageType || 'text'
              }
            };
          }
          return conv;
        });
        
        // Sort so this conversation moves to top
        return updatedConversations.sort((a, b) => {
          const aTime = a.lastMessage?.timestamp ? new Date(a.lastMessage.timestamp).getTime() : 0;
          const bTime = b.lastMessage?.timestamp ? new Date(b.lastMessage.timestamp).getTime() : 0;
          return bTime - aTime;
        });
      });

    } catch (error) {
      console.error('Error sending message:', error);

      // Mark message as failed
      setMessages(prev => prev.map(msg =>
        msg._id === tempId
          ? { ...msg, status: 'failed', error: error.message }
          : msg
      ));
    }

    // Focus back on input
    if (messageInputRef.current) {
      messageInputRef.current.focus();
    }

    setIsSending(false);
  }, [selectedConversation, user]);

  const handleMessageInputChange = useCallback((e) => {
    const value = e.target.value;
    const cursor = e.target.selectionStart;
    
    setNewMessage(value);
    
    // Only detect mentions if we're in a group and recently typed @ or near an @
    // This avoids expensive regex on every keystroke
    const lastChar = value[cursor - 1];
    const shouldCheckMention = lastChar === '@' || value.substring(Math.max(0, cursor - 20), cursor).includes('@');
    
    if (shouldCheckMention && selectedConversationRef.current?.type === 'group') {
      const mentionDetection = detectMentionTyping(value, cursor);
      if (mentionDetection) {
        setCursorPosition(cursor);
        setShowMentionAutocomplete(true);
        setMentionSearchTerm(mentionDetection.searchTerm);
      } else {
        setShowMentionAutocomplete(false);
        setMentionSearchTerm('');
      }
    } else if (showMentionAutocompleteRef.current) {
      // Close autocomplete if it was open
      setShowMentionAutocomplete(false);
      setMentionSearchTerm('');
    }

    // Handle typing indicator - only emit once per typing session
    const currentConversation = selectedConversationRef.current;
    if (currentConversation) {
      // Only emit typing indicator if not already typing
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        chatService.sendTyping(currentConversation._id);
      }

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Stop typing after 3 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        isTypingRef.current = false;
        chatService.stopTyping(currentConversation._id);
      }, 3000);
    }
  }, []);

  const handleKeyPress = useCallback((e) => {
    // Don't send message if mention autocomplete is open
    if (e.key === 'Enter' && !e.shiftKey && !isSendingRef.current && !showMentionAutocompleteRef.current) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const handleMentionSelect = (userId, displayName) => {
    const result = insertMention(newMessage, cursorPosition, userId, displayName, mentionSearchTerm);
    setNewMessage(result.newText);
    setShowMentionAutocomplete(false);
    setMentionSearchTerm('');
    
    // Focus back to input and set cursor position
    setTimeout(() => {
      if (messageInputRef.current) {
        messageInputRef.current.focus();
        messageInputRef.current.setSelectionRange(result.newCursorPosition, result.newCursorPosition);
      }
    }, 0);
  };

  const handleCloseMentionAutocomplete = () => {
    setShowMentionAutocomplete(false);
    setMentionSearchTerm('');
  };

  const handleEmojiButtonClick = useCallback((e) => {
    setEmojiAnchorEl(e.currentTarget);
    setShowEmojiPicker(prev => !prev);
  }, []);

  const handleImageUploadClick = useCallback(() => {
    setShowImageUpload(true);
  }, []);

  const toggleFullscreen = () => {
    setIsFullscreen(prev => !prev);
  };

  const handlePaste = useCallback(async (e) => {
    // Check if clipboard contains files/images
    const clipboardData = e.clipboardData || e.originalEvent?.clipboardData;
    if (!clipboardData || !selectedConversation || pasteUploadingRef.current) return;

    const items = Array.from(clipboardData.items);
    const imageItems = items.filter(item => item.type.startsWith('image/'));

    if (imageItems.length > 0) {
      e.preventDefault(); // Prevent default paste behavior
      
      setPasteUploading(true);
      setPasteUploadProgress(0);

      try {
        for (const item of imageItems) {
          const file = item.getAsFile();
          if (file) {
            // Validate the image file
            const validation = chatService.validateImageFile(file);
            if (!validation.valid) {
              console.error('Invalid image file:', validation.errors[0]);
              continue;
            }

            // Create a proper File object with a name
            const timestamp = new Date().getTime();
            const extension = file.type.split('/')[1] || 'png';
            const fileName = `pasted-image-${timestamp}.${extension}`;
            
            const renamedFile = new File([file], fileName, {
              type: file.type,
              lastModified: Date.now()
            });

            // Upload the image using existing functionality
            const response = await chatService.uploadImage(renamedFile, {
              conversationId: selectedConversation._id,
              requestOptions: {
                onUploadProgress: (progressEvent) => {
                  const progress = Math.round(
                    (progressEvent.loaded * 100) / progressEvent.total
                  );
                  setPasteUploadProgress(progress);
                }
              }
            });

            const uploadedImage = {
              ...response.data,
              caption: '' // No caption for pasted images by default
            };

            // Use existing image upload handler
            handleImageUpload(uploadedImage);
          }
        }
      } catch (error) {
        console.error('Error uploading pasted image:', error);
      } finally {
        setPasteUploading(false);
        setPasteUploadProgress(0);
      }
    }
  }, [selectedConversation]);




  const handleGroupCreated = async (newGroup) => {
    // Refresh conversations list
    try {
      const response = await chatService.getConversations();
      setConversations(response.data || []);
        } catch (error) {
      console.error('Error loading conversations:', error);
    }

    // Select the newly created group
    await selectConversation(newGroup);
  };

  const handleGroupManagementUpdated = async () => {
    // Refresh conversations and current conversation
    try {
      const response = await chatService.getConversations();
      setConversations(response.data || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
    
    setSelectedConversation(currentSelected => {
      if (currentSelected) {
        chatService.getConversation(currentSelected._id)
          .then(response => selectConversation(response.data))
          .catch(error => console.error('Error refreshing conversation:', error));
      }
      return currentSelected;
    });
  };

  const refreshMessages = async () => {
    if (!selectedConversation || refreshingMessages) return;

    setRefreshingMessages(true);

    try {
      // Load fresh messages from the server
      const messagesResponse = await chatService.getMessages(selectedConversation._id);
      const freshMessages = messagesResponse.data || [];
      
      // Update messages with fresh data
      setMessages(freshMessages);

      // Mark as read after refresh
      await chatService.markConversationAsRead(selectedConversation._id);
      
      // Scroll to bottom to show latest messages
      setTimeout(() => scrollToBottom(), 100);

    } catch (error) {
      console.error('Error refreshing messages:', error);
    } finally {
      setRefreshingMessages(false);
    }
  };

  const handleEditMessage = (message) => {
    setEditingMessage(message);
    setEditContent(message.content);
    setMessageMenuAnchor(null);
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim() || !editingMessage) return;

    const oldContent = editingMessage.content;
    const newContent = editContent.trim();

    // Optimistically update the message in the UI
    setMessages(prev => prev.map(msg =>
      msg._id === editingMessage._id
        ? { ...msg, content: newContent, isEdited: true, editedAt: new Date().toISOString() }
        : msg
    ));

    // Clear edit state immediately for better UX
    setEditingMessage(null);
    setEditContent('');

    try {
      await chatService.editMessage(editingMessage._id, newContent);
      // If successful, the socket event will confirm the edit
    } catch (error) {
      console.error('Error editing message:', error);
      
      // If edit fails, restore the old content
      setMessages(prev => prev.map(msg =>
        msg._id === editingMessage._id
          ? { ...msg, content: oldContent, isEdited: msg.isEdited, editedAt: msg.editedAt }
          : msg
      ));
      
      // Show error feedback
      alert('Failed to edit message. Please try again.');
    }
  };

  const handleDeleteMessage = async (message) => {
    // Optimistically remove the message immediately
    setMessages(prev => prev.filter(msg => msg._id !== message._id));
    setMessageMenuAnchor(null);

    try {
      // Call server to delete the message
      await chatService.deleteMessage(message._id);
      // If successful, the real-time handler will confirm the deletion
    } catch (error) {
      console.error('Error deleting message:', error);
      
      // If deletion fails, restore the message with error state
      setMessages(prev => {
        // Check if message is already back (from real-time events)
        const existingMessage = prev.find(msg => msg._id === message._id);
        if (!existingMessage) {
          // Restore the message with failed deletion state
          const restoredMessage = {
            ...message,
            status: 'delete_failed',
            error: 'Failed to delete message'
          };
          
          // Insert back in correct chronological position
          const newMessages = [...prev, restoredMessage];
          return newMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        }
        return prev;
      });
    }
  };

  const handleReplyToMessage = (message) => {
    setReplyToMessage(message);
    setMessageMenuAnchor(null);
    if (messageInputRef.current) {
      messageInputRef.current.focus();
    }
  };

  const handleReactionToggle = async (messageId, emoji) => {
    try {
      await chatService.addReaction(messageId, emoji);
      // The reaction update will be handled by the real-time event
    } catch (error) {
      console.error('Error toggling reaction:', error);
    }
  };

  const handleImageUpload = async (uploadedImage) => {
    if (!selectedConversation) return;

    const tempId = `temp_${Date.now()}_${Math.random()}`;

    // Create optimistic image message for immediate UI update
    const optimisticImageMessage = {
      _id: tempId,
      content: uploadedImage.caption || '',
      messageType: 'image',
      sender: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role
      },
      conversation: selectedConversation._id,
      createdAt: new Date().toISOString(),
      status: 'sending', // Custom status for optimistic updates
      isOptimistic: true, // Flag to identify optimistic messages
      replyTo: replyToMessage || null,
      attachment: {
        filename: uploadedImage._id,
        originalName: uploadedImage.originalName || 'image',
        fileType: uploadedImage.fileType || 'image/jpeg',
        fileSize: uploadedImage.fileSize || 0
      }
    };

    // Add message to UI immediately
    setMessages(prev => [...prev, optimisticImageMessage]);

    // Clear reply state
    setReplyToMessage(null);

    // Scroll to bottom
    setTimeout(() => scrollToBottom(), 100);

    try {
      // Send image message
      const response = await chatService.sendImageMessage(
        selectedConversation._id,
        uploadedImage._id,
        uploadedImage.caption,
        replyToMessage?._id
      );

      // Replace optimistic message with real message from server
      setMessages(prev => prev.map(msg =>
        msg._id === tempId
          ? { ...response.data, status: 'sent' }
          : msg
      ));
      
      // Update conversation list to move this conversation to top
      setConversations(currentConversations => {
        const updatedConversations = currentConversations.map(conv => {
          if (conv._id === selectedConversation._id) {
            return {
              ...conv,
              lastMessage: {
                content: response.data.content || '',
                sender: {
                  _id: response.data.sender?._id || user._id,
                  fullName: response.data.sender?.fullName || user.fullName,
                  email: response.data.sender?.email || user.email,
                  role: response.data.sender?.role || user.role
                },
                timestamp: response.data.createdAt || new Date().toISOString(),
                messageType: response.data.messageType || 'image'
              }
            };
          }
          return conv;
        });
        
        // Sort so this conversation moves to top
        return updatedConversations.sort((a, b) => {
          const aTime = a.lastMessage?.timestamp ? new Date(a.lastMessage.timestamp).getTime() : 0;
          const bTime = b.lastMessage?.timestamp ? new Date(b.lastMessage.timestamp).getTime() : 0;
          return bTime - aTime;
        });
      });

    } catch (error) {
      console.error('Error sending image message:', error);

      // Mark message as failed
      setMessages(prev => prev.map(msg =>
        msg._id === tempId
          ? { ...msg, status: 'failed', error: error.message }
          : msg
      ));
    }
  };

    const handleRetryMessage = async (failedMessage) => {
    const tempId = `temp_${Date.now()}_${Math.random()}`;

    // Update the failed message to show it's being retried
    setMessages(prev => prev.map(msg =>
      msg._id === failedMessage._id
        ? { ...msg, status: 'sending', _id: tempId }
        : msg
    ));

    try {
      let response;

      if (failedMessage.messageType === 'image') {
        // For image messages, use sendImageMessage
        response = await chatService.sendImageMessage(
          selectedConversation._id,
          failedMessage.attachment?.filename,
          failedMessage.content, // caption
          failedMessage.replyTo?._id
        );
      } else {
        // For text messages, use sendMessage
        const messageData = {
          content: failedMessage.content,
          messageType: failedMessage.messageType || 'text'
        };

        // Include replyTo if the original message was a reply
        if (failedMessage.replyTo?._id) {
          messageData.replyTo = failedMessage.replyTo._id;
        }

        response = await chatService.sendMessage(selectedConversation._id, messageData);
      }

      // Replace retry message with successful message
      setMessages(prev => prev.map(msg =>
        msg._id === tempId
          ? { ...response.data, status: 'sent' }
          : msg
      ));

    } catch (error) {
      console.error('Error retrying message:', error);

      // Mark message as failed again
      setMessages(prev => prev.map(msg =>
        msg._id === tempId
          ? { ...msg, status: 'failed', error: error.message }
          : msg
      ));
    }
  };

  // Notification settings handlers
  const handleNotificationSettingChange = (setting, value) => {
    const newSettings = { ...notificationSettings, [setting]: value };
    setNotificationSettings(newSettings);
    
    switch (setting) {
      case 'isEnabled':
        notificationService.setEnabled(value);
        break;
      case 'audioEnabled':
        notificationService.setAudioEnabled(value);
        break;
      case 'browserNotificationsEnabled':
        notificationService.setBrowserNotificationsEnabled(value);
        break;
    }
  };

  const handleTestNotification = () => {
    notificationService.testNotification();
  };

  // Message search handlers
  const handleMessageSearch = async () => {
    if (!messageSearchQuery.trim() || !selectedConversation || isSearching) return;

    setIsSearching(true);
    setSearchError(null);

    try {
      const response = await chatService.searchMessages(selectedConversation._id, messageSearchQuery.trim());
      setSearchResults(response.data || []);
      setShowSearchResults(true);
    } catch (error) {
      console.error('Error searching messages:', error);
      setSearchError(error.response?.data?.message || 'Failed to search messages');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter' && !isSearching) {
      e.preventDefault();
      handleMessageSearch();
    }
  };

  const jumpToMessage = async (messageId) => {
    // Set jumping state to show loading feedback
    setJumpingToMessage(messageId);
    
    // First, close search results and go back to chat
    setShowSearchResults(false);
    
    // Check if message is already in current messages
    let messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    
    if (messageElement) {
      // Message is already visible, just scroll to it
      scrollToMessage(messageElement);
      setJumpingToMessage(null);
      return;
    }

    // Message is not currently loaded, need to fetch more messages
    if (!selectedConversation) {
      setJumpingToMessage(null);
      return;
    }

    try {
      setMessagesLoading(true);
      
      // Check if message is already in loaded messages (in case DOM isn't updated yet)
      let allMessages = [...messages];
      let foundMessage = allMessages.find(msg => msg._id === messageId);
      
      if (foundMessage) {
        // Message is already loaded, turn off loading and wait for DOM to render
        setMessagesLoading(false);
        
        // Wait for DOM to update with the messages, then scroll
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(() => {
              const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
              if (messageElement) {
                scrollToMessage(messageElement);
              } else {
                console.warn('Message element not found in DOM (already loaded case)');
              }
              setJumpingToMessage(null);
            }, 300);
          });
        });
        return;
      }
      
      // Load messages in batches until we find the target message
      // Start from the next page after what's already loaded
      let page = currentPage + 1;
      const limit = 15; // Use same limit as normal pagination
      let lastPaginationInfo = null;
      
      while (!foundMessage && page <= currentPage + 20) { // Limit search to 20 more pages
        const response = await chatService.getMessages(selectedConversation._id, {
          page,
          limit
        });
        
        const olderMessages = response.data || [];
        lastPaginationInfo = response.pagination || {};
        
        if (olderMessages.length === 0) break; // No more messages
        
        // Add older messages to the beginning of our array
        allMessages = [...olderMessages, ...allMessages];
        foundMessage = olderMessages.find(msg => msg._id === messageId);
        page++;
        
        // If pagination says no more, break early
        if (!lastPaginationInfo.hasMore) break;
      }
      
      if (foundMessage) {
        // Update the messages state with all loaded messages
        setMessages(allMessages);
        
        // Update pagination state to reflect all loaded pages
        setCurrentPage(page - 1); // page - 1 because we incremented after the last load
        setHasMoreMessages(lastPaginationInfo?.hasMore || false);
        setTotalMessagesCount(allMessages.length);
        
        // Turn off loading state FIRST so messages can render
        setMessagesLoading(false);
        
        // Wait for DOM to update with the messages, then scroll
        // Use requestAnimationFrame twice to ensure React has committed and browser has painted
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(() => {
              const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
              if (messageElement) {
                scrollToMessage(messageElement);
              } else {
                console.warn('Message element not found in DOM after loading');
              }
              setJumpingToMessage(null);
            }, 300);
          });
        });
      } else {
        // Message not found even after loading more
        console.warn('Message not found in conversation history');
        setSearchError('Could not find the selected message in the conversation history.');
        setJumpingToMessage(null);
        setMessagesLoading(false);
      }
    } catch (error) {
      console.error('Error loading messages to jump to:', error);
      setSearchError('Error loading messages. Please try again.');
      setJumpingToMessage(null);
      setMessagesLoading(false);
    }
  };

  const scrollToMessage = (messageElement) => {
    messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Highlight the message briefly
    const originalBg = messageElement.style.backgroundColor;
    messageElement.style.backgroundColor = 'rgba(25, 118, 210, 0.2)';
    messageElement.style.transition = 'background-color 0.3s ease';
    
    setTimeout(() => {
      messageElement.style.backgroundColor = 'rgba(25, 118, 210, 0.1)';
      setTimeout(() => {
        messageElement.style.backgroundColor = originalBg;
        setTimeout(() => {
          messageElement.style.transition = '';
        }, 300);
      }, 1000);
    }, 500);
  };

  const formatMessageTime = (timestamp) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return '';
    }
    
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString();
    }
  };

  const getConversationTitle = (conversation) => {
    if (conversation.title) return conversation.title;
    if (conversation.type === 'group') {
      // For groups without titles, show participant names
      const participantNames = conversation.participants
        ?.filter(p => p.user && p.user._id !== user._id)
        .map(p => p.user?.fullName || 'Unknown')
        .slice(0, 2)
        .join(', ');
      return participantNames ? `${participantNames}${conversation.participants.length > 3 ? '...' : ''}` : 'Group Chat';
    }
    if (conversation.otherParticipant) {
      return conversation.otherParticipant.fullName;
    }
    return 'Chat';
  };

  const getConversationSubtitle = (conversation, unreadCount = 0) => {
    if (conversation.lastMessage) {
      const lastMessage = conversation.lastMessage;
      const isFromCurrentUser = lastMessage.sender?._id === user._id;
      
      // Handle different message types
      let messageContent = '';
      if (lastMessage.messageType === 'image') {
        messageContent = lastMessage.content || '📷 Image';
      } else if (lastMessage.messageType === 'file') {
        messageContent = lastMessage.content || '📎 File';
      } else {
        // Clean mentions for display in preview (@[Name](id) -> @Name)
        messageContent = cleanMentionsForDisplay(lastMessage.content || '');
      }
      
      // For unread messages, show who sent them
      if (unreadCount > 0 && !isFromCurrentUser) {
        const senderName = lastMessage.sender?.fullName || '';
        if (senderName && messageContent) {
          return `${senderName}: ${messageContent}`;
        } else if (messageContent) {
          return messageContent;
        } else {
          return 'New message';
        }
      }
      
      // For messages from current user, show "You: message"
      if (isFromCurrentUser) {
        return messageContent ? `You: ${messageContent}` : 'You sent a message';
      }
      
      // For read messages from others, just show the content
      return messageContent || 'Message';
    }
    return 'No messages yet';
  };

  const getConversationAvatar = (conversation) => {
    if (conversation.type === 'group') {
      // Show group icon or first few participant avatars
      const participantAvatars = conversation.participants
        ?.filter(p => p.user && p.user._id !== user._id)
        .slice(0, 2)
        .map(p => (
          <Avatar key={p.user._id} sx={{ width: 24, height: 24 }}>
            {p.user?.fullName?.charAt(0) || 'U'}
          </Avatar>
        ));

      if (participantAvatars && participantAvatars.length > 1) {
        return (
          <AvatarGroup max={2} sx={{ '& .MuiAvatar-root': { width: 24, height: 24, fontSize: '12px' } }}>
            {participantAvatars}
          </AvatarGroup>
        );
      } else {
        return (
          <Avatar>
            <GroupIcon />
          </Avatar>
        );
      }
    }

    return (
      <Avatar>
        {conversation.otherParticipant?.fullName?.charAt(0) || 'U'}
      </Avatar>
    );
  };

  // Filter and sort conversations by most recent message (memoized for performance)
  const filteredConversations = useMemo(() => {
    return conversations
      .filter(conv =>
        getConversationTitle(conv).toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => {
        // Prioritize conversations with unread messages
        const aUnread = unreadCounts[a._id] || 0;
        const bUnread = unreadCounts[b._id] || 0;
        
        // If one has unread and the other doesn't, prioritize the one with unread
        if (aUnread > 0 && bUnread === 0) return -1;
        if (aUnread === 0 && bUnread > 0) return 1;
        
        // Otherwise, sort by most recent message timestamp
        const aTime = a.lastMessage?.timestamp ? new Date(a.lastMessage.timestamp).getTime() : 0;
        const bTime = b.lastMessage?.timestamp ? new Date(b.lastMessage.timestamp).getTime() : 0;
        return bTime - aTime; // Most recent first
      });
  }, [conversations, searchQuery, unreadCounts]);

  if (!isOpen) return null;

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      fullScreen={isMobile || isFullscreen}
      PaperProps={{
        sx: { 
          height: isFullscreen ? '100vh' : { xs: '100vh', sm: '88vh' }, 
          maxHeight: isFullscreen ? '100vh' : { xs: '100vh', sm: '900px' },
          width: isFullscreen ? '100vw' : { xs: '100vw', sm: '95vw', md: '90vw', lg: '85vw' },
          margin: isFullscreen ? 0 : 'auto',
          maxWidth: isFullscreen ? '100vw' : '1600px',
          borderRadius: isFullscreen ? 0 : 2
        },
        'data-testid': 'chat-window'
      }}
    >
      <Box sx={{ display: 'flex', height: '100%' }}>
        {/* Conversations List */}
        <Box sx={{ 
          width: { xs: showSidebar ? '100%' : 0, sm: isFullscreen ? 420 : 360 }, 
          borderRight: 1, 
          borderColor: 'divider', 
          display: { xs: showSidebar ? 'flex' : 'none', sm: 'flex' },
          flexDirection: 'column',
          transition: 'width 0.3s ease'
        }}>
          {/* Header */}
          <Box sx={{ p: 2.5, borderBottom: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 600 }}>
                <ChatIcon fontSize="large" />
                Chat
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Tooltip title={connectionStatus.isConnected ? "Connected" : "Disconnected - Click to reconnect"}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: connectionStatus.isConnected ? 'success.main' : 'error.main',
                      cursor: !connectionStatus.isConnected ? 'pointer' : 'default'
                    }}
                    onClick={() => {
                      if (!connectionStatus.isConnected) {
                        chatService.forceReconnect();
                      }
                    }}
                  />
                </Tooltip>
                {!connectionStatus.isConnected && (
                  <Tooltip title="Reconnect">
                    <IconButton 
                      size="small" 
                      onClick={() => {
                        chatService.forceReconnect();
                      }}
                      sx={{ color: 'warning.main' }}
                    >
                      <RefreshIcon />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Notification Settings">
                  <IconButton size="small" onClick={() => setShowNotificationSettings(true)}>
                    <NotificationsIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                  <IconButton 
                    size="small" 
                    onClick={toggleFullscreen}
                    sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
                  >
                    {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                  </IconButton>
                </Tooltip>
                <IconButton size="small" onClick={onClose}>
                  <CloseIcon />
                </IconButton>
              </Box>
            </Box>
            <TextField
              size="medium"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                )
              }}
              sx={{ width: '100%' }}
            />
            <Button
              variant="outlined"
              size="medium"
              startIcon={<PersonIcon />}
              onClick={() => setShowNewChatDialog(true)}
              sx={{ mt: 1.5, width: '100%' }}
            >
              New Chat
            </Button>
            {user?.role === 'admin' && (
              <Button
                variant="outlined"
                size="medium"
                startIcon={<GroupIcon />}
                onClick={() => setShowCreateGroupDialog(true)}
                sx={{ mt: 1.5, width: '100%' }}
              >
                Create Group
              </Button>
            )}
          </Box>

          {/* Conversations */}
          <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                <CircularProgress />
              </Box>
            ) : (
              <List sx={{ p: 0 }}>
                {filteredConversations.map((conversation) => {
                  const unreadCount = unreadCounts[conversation._id] || 0;

                  return (
                    <ListItem
                      key={conversation._id}
                      button
                      selected={selectedConversation?._id === conversation._id}
                      onClick={() => selectConversation(conversation)}
                      sx={{ 
                        px: 2.5, 
                        py: 1.5,
                        // Add visual indicators for unread messages
                        ...(unreadCount > 0 && {
                          borderLeft: '4px solid',
                          borderLeftColor: 'primary.main',
                          backgroundColor: 'action.hover',
                          '&:hover': {
                            backgroundColor: 'action.selected',
                          }
                        })
                      }}
                    >
                      <ListItemAvatar>
                        <Box sx={{ position: 'relative' }}>
                        {getConversationAvatar(conversation)}
                          {unreadCount > 0 && (
                            <Box
                              sx={{
                                position: 'absolute',
                                top: -2,
                                right: -2,
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                backgroundColor: 'error.main',
                                border: '2px solid white',
                                animation: 'pulse 2s infinite',
                                '@keyframes pulse': {
                                  '0%': { opacity: 1 },
                                  '50%': { opacity: 0.5 },
                                  '100%': { opacity: 1 },
                                }
                              }}
                            />
                          )}
                        </Box>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography 
                              variant="subtitle2" 
                              noWrap
                              sx={{
                                // Make text bold and slightly larger for unread conversations
                                ...(unreadCount > 0 && {
                                  fontWeight: 'bold',
                                  color: 'text.primary',
                                  textDecoration: 'underline',
                                  textDecorationColor: 'primary.main'
                                })
                              }}
                            >
                              {getConversationTitle(conversation)}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {unreadCount > 0 && (
                                <Chip 
                                  label="NEW" 
                                  size="small" 
                                  color="error"
                                  sx={{ 
                                    height: 18, 
                                    fontSize: '0.65rem',
                                    fontWeight: 'bold',
                                    animation: 'pulse 2s infinite',
                                    '@keyframes pulse': {
                                      '0%': { transform: 'scale(1)' },
                                      '50%': { transform: 'scale(1.05)' },
                                      '100%': { transform: 'scale(1)' },
                                    }
                                  }}
                                />
                              )}
                            {unreadCount > 0 && (
                              <Badge badgeContent={unreadCount} color="primary" />
                            )}
                            </Box>
                          </Box>
                        }
                        secondary={
                          <>
                          <Typography 
                            variant="body2" 
                            color="text.secondary" 
                            noWrap
                            component="span"
                            sx={{
                              display: 'block',
                              // Make subtitle text bolder for unread conversations
                              ...(unreadCount > 0 && {
                                fontWeight: 'medium',
                                color: 'text.primary'
                              })
                            }}
                          >
                              {getConversationSubtitle(conversation, unreadCount)}
                          </Typography>
                            {conversation.lastMessage && (
                              <Typography 
                                variant="caption" 
                                color="text.secondary"
                                component="span"
                                sx={{
                                  display: 'block',
                                  ...(unreadCount > 0 && {
                                    color: 'primary.main',
                                    fontWeight: 'medium'
                                  })
                                }}
                              >
                                {formatMessageTime(conversation.lastMessage.timestamp)}
                              </Typography>
                            )}
                          </>
                        }
                        secondaryTypographyProps={{
                          component: 'div'
                        }}
                      />
                    </ListItem>
                  );
                })}
                {filteredConversations.length === 0 && (
                  <Box sx={{ p: 2, textAlign: 'center' }}>
                    <Typography color="text.secondary">
                      {searchQuery ? 'No conversations found' : 'No conversations yet'}
                    </Typography>
                  </Box>
                )}
              </List>
            )}
          </Box>
        </Box>

        {/* Messages Area */}
        <Box sx={{ 
          flexGrow: 1, 
          display: { xs: showSidebar ? 'none' : 'flex', sm: 'flex' },
          flexDirection: 'column',
          width: { xs: '100%', sm: 'auto' }
        }}>
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <Box sx={{ p: { xs: 1, sm: 2.5 }, borderBottom: 1, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 } }}>
                    {/* Back button for mobile */}
                    <IconButton 
                      size="small" 
                      onClick={() => {
                        setShowSidebar(true);
                        setSelectedConversation(null);
                      }}
                      sx={{ display: { xs: 'inline-flex', sm: 'none' } }}
                    >
                      <CloseIcon />
                    </IconButton>
                    {getConversationAvatar(selectedConversation)}
                    <Box>
                      <Typography 
                        variant="h5" 
                        sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 1,
                          fontSize: { xs: '1.1rem', sm: '1.5rem' },
                          fontWeight: 600
                        }}
                      >
                        {getConversationTitle(selectedConversation)}
                        {selectedConversation.type === 'group' && (
                          <Chip
                            size="small"
                            label={`${selectedConversation.participants?.length || 0} members`}
                            variant="outlined"
                            sx={{ fontSize: '0.75rem', display: { xs: 'none', sm: 'inline-flex' } }}
                          />
                        )}
                      </Typography>
                      {selectedConversation.type === 'group' ? (
                        <Typography variant="body2" color="text.secondary">
                          {selectedConversation.participants
                            ?.map(p => p.user?.fullName || 'Unknown')
                            .join(', ')}
                        </Typography>
                      ) : (
                        selectedConversation.otherParticipant && (
                          <Typography variant="body2" color="text.secondary">
                            {selectedConversation.otherParticipant.role.replace('_', ' ')}
                          </Typography>
                        )
                      )}
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Tooltip title="Refresh messages">
                      <IconButton
                        onClick={refreshMessages}
                        disabled={refreshingMessages}
                        color="primary"
                        size="small"
                      >
                        {refreshingMessages ? (
                          <CircularProgress size={20} />
                        ) : (
                          <RefreshIcon />
                        )}
                      </IconButton>
                    </Tooltip>
                    
                    <Tooltip title={isFullscreen ? "Exit Fullscreen (F11)" : "Fullscreen (F11)"}>
                      <IconButton
                        onClick={toggleFullscreen}
                        color={isFullscreen ? "primary" : "default"}
                        size="small"
                      >
                        {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                      </IconButton>
                    </Tooltip>
                    
                    {selectedConversation.type === 'group' && user?.role === 'admin' && (
                      <IconButton
                        onClick={(e) => {
                          setShowGroupManagementDialog(true);
                        }}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    )}
                  </Box>
                </Box>

                {/* Message Search */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
                  <TextField
                    size="small"
                    placeholder="Search messages..."
                    value={messageSearchQuery}
                    onChange={(e) => setMessageSearchQuery(e.target.value)}
                    onKeyPress={handleSearchKeyPress}
                    disabled={isSearching}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      ),
                      endAdornment: messageSearchQuery && (
                        <InputAdornment position="end">
                          <IconButton 
                            size="small" 
                            onClick={handleClearSearch}
                            edge="end"
                          >
                            <CloseIcon />
                          </IconButton>
                        </InputAdornment>
                      )
                    }}
                    sx={{ flexGrow: 1, minWidth: { xs: '100%', sm: 'auto' } }}
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleMessageSearch}
                    disabled={!messageSearchQuery.trim() || isSearching}
                    startIcon={isSearching ? <CircularProgress size={16} /> : <SearchIcon />}
                    sx={{ 
                      minWidth: { xs: '100%', sm: 'auto' },
                      display: { xs: messageSearchQuery ? 'flex' : 'none', sm: 'flex' }
                    }}
                  >
                    {isSearching ? 'Searching...' : 'Search'}
                  </Button>
                </Box>

                {/* Search Error Alert */}
                {searchError && (
                  <Alert severity="error" sx={{ mt: 1 }} onClose={() => setSearchError(null)}>
                    {searchError}
                  </Alert>
                )}
              </Box>

              {/* Messages */}
              <Box 
                ref={messagesContainerRef}
                onScroll={(e) => {
                  const container = e.target;
                  // Detect scroll to top (within 100px from top)
                  if (container.scrollTop < 100 && hasMoreMessages && !isLoadingMore) {
                    loadMoreMessages();
                  }
                }}
                sx={{ flexGrow: 1, overflow: 'auto', p: { xs: 0.5, sm: 1 } }}
              >
                {messagesLoading ? (
                  /* Skeleton loading screen for better UX */
                  <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {[1, 2, 3, 4, 5].map((item) => (
                      <Box 
                        key={item} 
                        sx={{ 
                          display: 'flex', 
                          gap: 1,
                          alignItems: 'flex-start',
                          justifyContent: item % 2 === 0 ? 'flex-end' : 'flex-start'
                        }}
                      >
                        {item % 2 === 1 && (
                          <Box
                            sx={{
                              width: 40,
                              height: 40,
                              borderRadius: '50%',
                              bgcolor: 'grey.300',
                              animation: 'pulse 1.5s ease-in-out infinite',
                              '@keyframes pulse': {
                                '0%, 100%': { opacity: 1 },
                                '50%': { opacity: 0.5 },
                              },
                            }}
                          />
                        )}
                        <Box
                          sx={{
                            maxWidth: '70%',
                            minWidth: item % 3 === 0 ? '40%' : '60%',
                            height: item % 3 === 0 ? 60 : 80,
                            borderRadius: 2,
                            bgcolor: item % 2 === 0 ? 'primary.light' : 'grey.200',
                            opacity: 0.3,
                            animation: 'pulse 1.5s ease-in-out infinite',
                            animationDelay: `${item * 0.1}s`,
                          }}
                        />
                        {item % 2 === 0 && (
                          <Box
                            sx={{
                              width: 40,
                              height: 40,
                              borderRadius: '50%',
                              bgcolor: 'primary.light',
                              opacity: 0.3,
                              animation: 'pulse 1.5s ease-in-out infinite',
                              animationDelay: `${item * 0.1}s`,
                            }}
                          />
                        )}
                      </Box>
                    ))}
                  </Box>
                ) : showSearchResults ? (
                  /* Search Results */
                  <Box>
                    <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'grey.50' }}>
                      <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <SearchIcon fontSize="small" />
                        Search Results for "{messageSearchQuery}"
                        <Chip size="small" label={`${searchResults.length} found`} />
                        <Button size="small" onClick={handleClearSearch} sx={{ ml: 'auto' }}>
                          Back to Chat
                        </Button>
                      </Typography>
                    </Box>

                    {searchResults.length === 0 ? (
                      <Box sx={{ p: 3, textAlign: 'center' }}>
                        <Typography color="text.secondary">
                          No messages found matching "{messageSearchQuery}"
                        </Typography>
                      </Box>
                    ) : (
                      <List sx={{ p: 0 }}>
                        {searchResults.map((message) => {
                          const isOwnMessage = message.sender._id === user._id;
                          return (
                            <ListItem
                              key={message._id}
                              sx={{
                                flexDirection: 'column',
                                alignItems: 'stretch',
                                borderBottom: 1,
                                borderColor: 'divider',
                                '&:hover': {
                                  bgcolor: 'action.hover',
                                  cursor: jumpingToMessage === message._id ? 'wait' : 'pointer'
                                },
                                ...(jumpingToMessage === message._id && {
                                  bgcolor: 'action.selected',
                                  opacity: 0.7
                                })
                              }}
                              onClick={() => jumpingToMessage !== message._id && jumpToMessage(message._id)}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, width: '100%' }}>
                                <Avatar sx={{ width: 32, height: 32 }}>
                                  {message.sender?.fullName?.charAt(0) || 'U'}
                                </Avatar>
                                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                    <Typography variant="subtitle2" noWrap>
                                      {message.sender?.fullName || 'Unknown User'}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {formatMessageTime(message.createdAt)}
                                    </Typography>
                                    {isOwnMessage && (
                                      <Chip size="small" label="You" variant="outlined" />
                                    )}
                                    {jumpingToMessage === message._id && (
                                      <>
                                        <CircularProgress size={12} />
                                        <Typography variant="caption" color="primary">
                                          Loading...
                                        </Typography>
                                      </>
                                    )}
                                  </Box>
                                  <Typography 
                                    variant="body2" 
                                    sx={{ 
                                      wordBreak: 'break-word',
                                      '& mark': {
                                        backgroundColor: 'primary.light',
                                        color: 'primary.contrastText',
                                        padding: '0 2px',
                                        borderRadius: 1
                                      }
                                    }}
                                    dangerouslySetInnerHTML={{ 
                                      __html: DOMPurify.sanitize(message.highlightedContent || message.content) 
                                    }}
                                  />
                                  {message.replyTo && (
                                    <Box sx={{ mt: 0.5, p: 1, bgcolor: 'grey.100', borderRadius: 1 }}>
                                      <Typography variant="caption" color="text.secondary">
                                        Replying to: {message.replyTo.content}
                                      </Typography>
                                    </Box>
                                  )}
                                </Box>
                              </Box>
                            </ListItem>
                          );
                        })}
                      </List>
                    )}
                  </Box>
                ) : (
                  <>
                    {/* Lazy loading indicator at top */}
                    {isLoadingMore && (
                      <Box sx={{ display: 'flex', justifyContent: 'center', p: 2, gap: 1 }}>
                        <CircularProgress size={20} />
                        <Typography variant="body2" color="text.secondary">
                          Loading older messages...
                        </Typography>
                      </Box>
                    )}
                    
                    {/* Show "Load More" button if there are more messages and not auto-loading */}
                    {!isLoadingMore && hasMoreMessages && messages.length > 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'center', p: 1 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={loadMoreMessages}
                          startIcon={<RefreshIcon />}
                        >
                          Load Older Messages
                        </Button>
                      </Box>
                    )}
                    
                    {messages.map((message, index) => {
                      const isOwnMessage = message.sender._id === user._id;

                      return (
                        <React.Fragment key={message._id}>
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: isOwnMessage ? 'flex-end' : 'flex-start',
                              mb: 1,
                            }}
                            data-message-id={message._id}
                          >
                            <Paper
                              sx={{
                                p: { xs: 0.75, sm: 1 },
                                maxWidth: { xs: '85%', sm: '70%' },
                                bgcolor: isOwnMessage ? 'primary.main' : 'grey.100',
                                color: isOwnMessage ? 'primary.contrastText' : 'text.primary',
                                // Show slightly different appearance for optimistic/sending messages
                                opacity: message.status === 'sending' ? 0.7 : 1,
                                // Add pulse animation styles
                                '@keyframes pulse': {
                                  '0%': { opacity: 0.7 },
                                  '50%': { opacity: 1 },
                                  '100%': { opacity: 0.7 },
                                },
                                // Red border for failed messages
                                ...(message.status === 'failed' && {
                                  border: '1px solid',
                                  borderColor: 'error.main'
                                }),
                                // Orange border for failed deletion
                                ...(message.status === 'delete_failed' && {
                                  border: '1px solid',
                                  borderColor: 'warning.main',
                                  bgcolor: isOwnMessage ? 'rgba(255, 152, 0, 0.1)' : 'rgba(255, 152, 0, 0.05)'
                                })
                              }}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                // Only show context menu for sent messages or delete_failed messages
                                if ((message.status === 'sent' || message.status === 'delete_failed') && !message.isOptimistic) {
                                  setSelectedMessage(message);
                                  setMessageMenuAnchor(e.currentTarget);
                                }
                              }}
                            >
                            {message.replyTo && (
                              <Box sx={{ mb: 0.5, p: 0.5, bgcolor: 'rgba(0,0,0,0.1)', borderRadius: 1 }}>
                                <Typography variant="caption" display="block">
                                  Replying to{selectedConversation.type === 'group' && message.replyTo.sender ? 
                                    ` ${message.replyTo.sender.fullName}` : 
                                    ''}: {message.replyTo.content}
                                </Typography>
                              </Box>
                            )}

                            {editingMessage?._id === message._id ? (
                              <Box>
                                <TextField
                                  size="small"
                                  multiline
                                  value={editContent}
                                  onChange={(e) => setEditContent(e.target.value)}
                                  onKeyPress={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      handleSaveEdit();
                                    }
                                  }}
                                  sx={{ width: '100%', mb: 1 }}
                                />
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                  <Button size="small" onClick={handleSaveEdit}>
                                    Save
                                  </Button>
                                  <Button size="small" onClick={() => setEditingMessage(null)}>
                                    Cancel
                                  </Button>
                                </Box>
                              </Box>
                            ) : (
                              <>
                                {/* Show sender name for group chats (only for messages from others) */}
                                {selectedConversation.type === 'group' && !isOwnMessage && (
                                  <Typography variant="caption" sx={{ 
                                    display: 'block', 
                                    fontWeight: 'bold', 
                                    color: 'primary.main',
                                    mb: 0.5 
                                  }}>
                                    {message.sender?.fullName || 'Unknown User'}
                                  </Typography>
                                )}
                                
                                {message.messageType === 'image' ? (
                                  <ChatImageMessage
                                    message={message}
                                    isOwnMessage={isOwnMessage}
                                    maxWidth={250}
                                    maxHeight={200}
                                  />
                                ) : (
                                  <Typography 
                                    variant="body1"
                                    dangerouslySetInnerHTML={{
                                      __html: DOMPurify.sanitize(parseMentions(message.content, user._id))
                                    }}
                                    sx={{
                                      fontSize: '0.95rem',
                                      '& .mention': {
                                        cursor: 'pointer',
                                        transition: 'opacity 0.2s'
                                      },
                                      '& .mention:hover': {
                                        opacity: 0.8
                                      }
                                    }}
                                  />
                                )}
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <Typography variant="caption" sx={{ opacity: 0.7 }}>
                                      {formatMessageTime(message.createdAt)}
                                      {message.isEdited && ' (edited)'}
                                    </Typography>

                                    {/* Message status indicators */}
                                    {message.status === 'sending' && (
                                      <Tooltip title="Sending...">
                                        <ScheduleIcon
                                          sx={{
                                            fontSize: '12px',
                                            opacity: 0.7,
                                            animation: 'pulse 1.5s infinite'
                                          }}
                                        />
                                      </Tooltip>
                                    )}

                                    {/* Show "Seen by" for group chats, simple check for direct messages */}
                                    {message.status === 'sent' && isOwnMessage && selectedConversation?.type === 'group' && (
                                      <MessageSeenBy
                                        message={message}
                                        conversation={selectedConversation}
                                        isOwnMessage={isOwnMessage}
                                        currentUserId={user._id}
                                      />
                                    )}

                                    {message.status === 'sent' && isOwnMessage && selectedConversation?.type !== 'group' && (
                                      <Tooltip title="Sent">
                                        <CheckCircleIcon
                                          sx={{
                                            fontSize: '12px',
                                            opacity: 0.7,
                                            color: 'success.main'
                                          }}
                                        />
                                      </Tooltip>
                                    )}

                                    {message.status === 'failed' && (
                                      <Tooltip title={`Failed to send: ${message.error || 'Unknown error'}`}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                          <ErrorIcon
                                            sx={{
                                              fontSize: '12px',
                                              color: 'error.main'
                                            }}
                                          />
                                          <IconButton
                                            size="small"
                                            sx={{
                                              opacity: 0.7,
                                              minWidth: 'auto',
                                              width: '16px',
                                              height: '16px'
                                            }}
                                            onClick={() => handleRetryMessage(message)}
                                          >
                                            <RefreshIcon fontSize="small" />
                                          </IconButton>
                                        </Box>
                                      </Tooltip>
                                    )}

                                    {message.status === 'delete_failed' && (
                                      <Tooltip title={`Failed to delete: ${message.error || 'Unknown error'}`}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                          <ErrorIcon
                                            sx={{
                                              fontSize: '12px',
                                              color: 'warning.main'
                                            }}
                                          />
                                          <IconButton
                                            size="small"
                                            sx={{
                                              opacity: 0.7,
                                              minWidth: 'auto',
                                              width: '16px',
                                              height: '16px'
                                            }}
                                            onClick={() => handleDeleteMessage(message)}
                                          >
                                            <DeleteIcon fontSize="small" />
                                          </IconButton>
                                        </Box>
                                      </Tooltip>
                                    )}
                                  </Box>

                                  {/* Only show menu for successfully sent messages or delete_failed messages */}
                                  {((message.status === 'sent' || message.status === 'delete_failed') && !message.isOptimistic) && (
                                    <IconButton
                                      size="small"
                                      sx={{ opacity: 0.7 }}
                                      onClick={(e) => {
                                        setSelectedMessage(message);
                                        setMessageMenuAnchor(e.currentTarget);
                                      }}
                                    >
                                      <MoreVertIcon fontSize="small" />
                                    </IconButton>
                                  )}
                                </Box>
                                
                                {/* Message Reactions */}
                                <MessageReactions
                                  message={message}
                                  currentUserId={user._id}
                                  onReactionToggle={handleReactionToggle}
                                  isOwnMessage={isOwnMessage}
                                />
                              </>
                            )}
                          </Paper>
                          </Box>
                        </React.Fragment>
                      );
                    })}

                    {/* Typing indicator */}
                    {typingUsers.length > 0 && (
                      <Box sx={{ p: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          {typingUsers.map(u => u.userName).join(', ')} typing...
                        </Typography>
                      </Box>
                    )}

                    <div ref={messagesEndRef} />
                  </>
                )}
              </Box>

              {/* Reply preview */}
              {replyToMessage && (
                <Box sx={{ p: 1, bgcolor: 'grey.50', borderTop: 1, borderColor: 'divider' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Replying to:
                      </Typography>
                      <Typography variant="body2" noWrap>
                        {replyToMessage.content}
                      </Typography>
                    </Box>
                    <IconButton size="small" onClick={() => setReplyToMessage(null)}>
                      <CloseIcon />
                    </IconButton>
                  </Box>
                </Box>
              )}

              {/* Mention Autocomplete */}
              <MentionAutocomplete
                participants={selectedConversation?.participants?.map(p => p.user).filter(u => u._id !== user._id) || []}
                anchorEl={messageInputRef.current}
                onSelect={handleMentionSelect}
                onClose={handleCloseMentionAutocomplete}
                searchTerm={mentionSearchTerm}
                open={showMentionAutocomplete}
              />

              {/* Message Input */}
              <Box sx={{ p: { xs: 1, sm: 2.5 }, borderTop: 1, borderColor: 'divider' }}>
                {/* Paste Upload Progress */}
                {pasteUploading && (
                  <Box sx={{ mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <ImageIcon sx={{ fontSize: '16px', color: 'primary.main' }} />
                      <Typography variant="caption" color="primary">
                        Uploading pasted image... {pasteUploadProgress}%
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={pasteUploadProgress}
                      sx={{ height: 4, borderRadius: 2 }}
                    />
                  </Box>
                )}
                
                <ChatMessageInput
                  messageInputRef={messageInputRef}
                  newMessage={newMessage}
                  pasteUploading={pasteUploading}
                  isSending={isSending}
                  hasConversation={!!selectedConversation}
                  onMessageChange={handleMessageInputChange}
                  onKeyPress={handleKeyPress}
                  onPaste={handlePaste}
                  onSendMessage={handleSendMessage}
                  onEmojiClick={handleEmojiButtonClick}
                  onImageUpload={handleImageUploadClick}
                />

                {/* Emoji Picker Popover */}
                <Popover
                  open={showEmojiPicker}
                  anchorEl={emojiAnchorEl}
                  onClose={() => setShowEmojiPicker(false)}
                  anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                  }}
                  transformOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                  }}
                  sx={{
                    '& .MuiPopover-paper': {
                      overflow: 'visible',
                      filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                    },
                  }}
                >
                  <EmojiPicker
                    onEmojiClick={(emojiData) => {
                      setNewMessage(prev => prev + emojiData.emoji);
                      setShowEmojiPicker(false);
                      // Focus back to input after emoji selection
                      setTimeout(() => {
                        if (messageInputRef.current) {
                          messageInputRef.current.focus();
                        }
                      }, 100);
                    }}
                    width={300}
                    height={400}
                    previewConfig={{
                      showPreview: false
                    }}
                    skinTonesDisabled
                    searchDisabled={false}
                    emojiStyle="native"
                  />
                </Popover>
              </Box>
            </>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <Typography color="text.secondary">
                Select a conversation to start chatting
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* Message Context Menu */}
      <Menu
        anchorEl={messageMenuAnchor}
        open={Boolean(messageMenuAnchor)}
        onClose={() => setMessageMenuAnchor(null)}
      >
        <MenuItem onClick={() => handleReplyToMessage(selectedMessage)}>
          <ReplyIcon sx={{ mr: 1 }} />
          Reply
        </MenuItem>
        {selectedMessage?.sender._id === user._id && selectedMessage?.status !== 'delete_failed' && (
          <MenuItem onClick={() => handleEditMessage(selectedMessage)}>
            <EditIcon sx={{ mr: 1 }} />
            Edit
          </MenuItem>
        )}
        {(selectedMessage?.sender._id === user._id || user.role === 'admin') && (
          <MenuItem onClick={() => handleDeleteMessage(selectedMessage)}>
            <DeleteIcon sx={{ mr: 1 }} />
            Delete
          </MenuItem>
        )}
      </Menu>

      {/* New Chat Dialog */}
      <Dialog open={showNewChatDialog} onClose={() => setShowNewChatDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Start New Chat</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              placeholder="Search users..."
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
          <List sx={{ maxHeight: 400, overflow: 'auto' }}>
            {filteredChatableUsers.map((chatUser) => (
              <ListItem
                key={chatUser._id}
                button
                onClick={() => {
                  createOrSelectConversation(chatUser._id);
                  setShowNewChatDialog(false);
                  setUserSearchQuery(''); // Reset search when closing
                }}
              >
                <ListItemAvatar>
                  <Avatar>{chatUser.fullName.charAt(0)}</Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={chatUser.fullName}
                  secondary={`${chatUser.role.replace('_', ' ')} • ${chatUser.email}`}
                />
              </ListItem>
            ))}
            {filteredChatableUsers.length === 0 && chatableUsers.length > 0 && (
              <ListItem>
                <ListItemText
                  primary="No users found"
                  secondary={`No users match "${userSearchQuery}"`}
                  sx={{ textAlign: 'center' }}
                />
              </ListItem>
            )}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowNewChatDialog(false);
            setUserSearchQuery(''); // Reset search when closing
          }}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Create Group Dialog */}
      <CreateGroupDialog
        open={showCreateGroupDialog}
        onClose={() => setShowCreateGroupDialog(false)}
        onGroupCreated={handleGroupCreated}
      />

      {/* Group Management Dialog */}
      <GroupManagementDialog
        open={showGroupManagementDialog}
        onClose={() => setShowGroupManagementDialog(false)}
        conversation={selectedConversation}
        onUpdated={handleGroupManagementUpdated}
      />

      {/* Image Upload Dialog */}
      <ChatImageUpload
        open={showImageUpload}
        onClose={() => setShowImageUpload(false)}
        onImageUploaded={handleImageUpload}
        conversationId={selectedConversation?._id}
        maxFiles={1}
        showCaption={true}
      />

      {/* Notification Settings Dialog */}
      <Dialog
        open={showNotificationSettings}
        onClose={() => setShowNotificationSettings(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <NotificationsIcon />
          Notification Settings
        </DialogTitle>
        <DialogContent>
          <Box sx={{ py: 2 }}>
            {/* Master Enable/Disable */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Box>
                <Typography variant="subtitle1">
                  Enable Notifications
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Turn on/off all chat notifications
                </Typography>
              </Box>
              <IconButton
                onClick={() => handleNotificationSettingChange('isEnabled', !notificationSettings.isEnabled)}
                color={notificationSettings.isEnabled ? 'primary' : 'default'}
              >
                {notificationSettings.isEnabled ? <NotificationsIcon /> : <NotificationsIcon sx={{ opacity: 0.5 }} />}
              </IconButton>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Audio Notifications */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Box>
                <Typography variant="subtitle1">
                  Sound Notifications
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Play sound when receiving messages
                </Typography>
              </Box>
              <IconButton
                onClick={() => handleNotificationSettingChange('audioEnabled', !notificationSettings.audioEnabled)}
                color={notificationSettings.audioEnabled && notificationSettings.isEnabled ? 'primary' : 'default'}
                disabled={!notificationSettings.isEnabled}
              >
                {notificationSettings.audioEnabled ? <VolumeUpIcon /> : <VolumeOffIcon />}
              </IconButton>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Browser Notifications */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Box>
                <Typography variant="subtitle1">
                  Desktop Notifications
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Show desktop notifications for new messages
                </Typography>
                {notificationSettings.permission !== 'granted' && (
                  <Typography variant="caption" color="warning.main">
                    Browser permission required
                  </Typography>
                )}
              </Box>
              <IconButton
                onClick={() => handleNotificationSettingChange('browserNotificationsEnabled', !notificationSettings.browserNotificationsEnabled)}
                color={notificationSettings.browserNotificationsEnabled && notificationSettings.isEnabled ? 'primary' : 'default'}
                disabled={!notificationSettings.isEnabled}
              >
                <SettingsIcon />
              </IconButton>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Test Notification */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="subtitle1">
                  Test Notifications
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Test your current notification settings
                </Typography>
              </Box>
              <Button
                variant="outlined"
                onClick={handleTestNotification}
                disabled={!notificationSettings.isEnabled}
                size="small"
              >
                Test
              </Button>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNotificationSettings(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

export default ChatWindow;