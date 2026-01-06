import React, { useMemo, memo, useCallback } from 'react';
import DOMPurify from 'dompurify';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  TextField,
  Button,
  Chip
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import ChatImageMessage from './ChatImageMessage';
import MessageSeenBy from './MessageSeenBy';
import { parseMentions } from '../utils/mentionUtils';

/**
 * Memoized message item component for optimal rendering performance.
 * Only re-renders when message content or editing state changes.
 */
const MessageItem = memo(({
  message,
  isOwnMessage,
  currentUserId,
  selectedConversation,
  editingMessage,
  editContent,
  onEditContentChange,
  onSaveEdit,
  onCancelEdit,
  onMenuOpen,
  onRetryMessage,
  onDeleteMessage,
  onReactionToggle,
  formatMessageTime
}) => {
  // Memoize grouped reactions to avoid recalculation on every render
  const groupedReactions = useMemo(() => {
    if (!message.reactions || message.reactions.length === 0) return [];
    
    const reactionMap = new Map();
    message.reactions.forEach(reaction => {
      if (!reactionMap.has(reaction.emoji)) {
        reactionMap.set(reaction.emoji, { 
          emoji: reaction.emoji, 
          users: [], 
          count: 0, 
          userReacted: false 
        });
      }
      const group = reactionMap.get(reaction.emoji);
      group.users.push(reaction.user);
      group.count += 1;
      if (reaction.user._id === currentUserId) group.userReacted = true;
    });
    return Array.from(reactionMap.values());
  }, [message.reactions, currentUserId]);

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    if ((message.status === 'sent' || message.status === 'delete_failed') && !message.isOptimistic) {
      onMenuOpen(e, message);
    }
  }, [message, onMenuOpen]);

  const handleMenuClick = useCallback((e) => {
    onMenuOpen(e, message);
  }, [message, onMenuOpen]);

  const isEditing = editingMessage?._id === message._id;
  const showStatusRow = message.status === 'sending' || 
    (message.status === 'sent' && isOwnMessage) || 
    message.status === 'failed' || 
    message.status === 'delete_failed';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: isOwnMessage ? 'flex-end' : 'flex-start',
        mb: 0.75,
        gap: 0.5,
        '&:hover .message-time, &:hover .message-menu': {
          opacity: 1,
        },
      }}
      data-message-id={message._id}
    >
      {/* Time on left side for own messages */}
      {isOwnMessage && (
        <Typography 
          className="message-time"
          sx={{ 
            fontSize: '0.65rem', 
            color: 'text.secondary',
            opacity: 0,
            transition: 'opacity 0.2s ease-in-out',
            whiteSpace: 'nowrap',
            userSelect: 'none',
          }}
        >
          {formatMessageTime(message.createdAt)}
          {message.isEdited && ' (edited)'}
        </Typography>
      )}

      {/* Menu button on left side for own messages */}
      {isOwnMessage && ((message.status === 'sent' || message.status === 'delete_failed') && !message.isOptimistic) && (
        <IconButton
          className="message-menu"
          size="small"
          sx={{ 
            opacity: 0,
            transition: 'opacity 0.2s ease-in-out',
            p: 0.25,
            color: 'text.secondary',
          }}
          onClick={handleMenuClick}
        >
          <MoreVertIcon sx={{ fontSize: '18px' }} />
        </IconButton>
      )}
      
      <Paper
        elevation={0}
        sx={{
          p: { xs: 1, sm: 1.25 },
          px: { xs: 1.5, sm: 2 },
          maxWidth: { xs: '80%', sm: '65%' },
          bgcolor: isOwnMessage ? 'primary.main' : 'grey.100',
          color: isOwnMessage ? 'primary.contrastText' : 'text.primary',
          borderRadius: isOwnMessage 
            ? '18px 18px 4px 18px' 
            : '18px 18px 18px 4px',
          opacity: message.status === 'sending' ? 0.7 : 1,
          '@keyframes pulse': {
            '0%': { opacity: 0.7 },
            '50%': { opacity: 1 },
            '100%': { opacity: 0.7 },
          },
          ...(message.status === 'failed' && {
            border: '1px solid',
            borderColor: 'error.main'
          }),
          ...(message.status === 'delete_failed' && {
            border: '1px solid',
            borderColor: 'warning.main',
            bgcolor: isOwnMessage ? 'rgba(255, 152, 0, 0.1)' : 'rgba(255, 152, 0, 0.05)'
          })
        }}
        onContextMenu={handleContextMenu}
      >
        {message.replyTo && (
          <Box sx={{ mb: 0.5, p: 0.5, bgcolor: 'rgba(0,0,0,0.1)', borderRadius: 1 }}>
            <Typography variant="caption" display="block">
              Replying to{selectedConversation?.type === 'group' && message.replyTo.sender ? 
                ` ${message.replyTo.sender.fullName}` : 
                ''}: {message.replyTo.content}
            </Typography>
          </Box>
        )}

        {isEditing ? (
          <Box>
            <TextField
              size="small"
              multiline
              value={editContent}
              onChange={(e) => onEditContentChange(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSaveEdit();
                }
              }}
              sx={{ width: '100%', mb: 1 }}
            />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" onClick={onSaveEdit}>Save</Button>
              <Button size="small" onClick={onCancelEdit}>Cancel</Button>
            </Box>
          </Box>
        ) : (
          <>
            {/* Show sender name for group chats (only for messages from others) */}
            {selectedConversation?.type === 'group' && !isOwnMessage && (
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
                  __html: DOMPurify.sanitize(parseMentions(message.content, currentUserId))
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
            
            {/* Status indicators row */}
            {showStatusRow && (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', mt: 0.25, gap: 0.5 }}>
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

                {message.status === 'sent' && isOwnMessage && selectedConversation?.type === 'group' && (
                  <MessageSeenBy
                    message={message}
                    conversation={selectedConversation}
                    isOwnMessage={isOwnMessage}
                    currentUserId={currentUserId}
                  />
                )}

                {message.status === 'sent' && isOwnMessage && selectedConversation?.type !== 'group' && (
                  <Tooltip title="Sent">
                    <CheckCircleIcon
                      sx={{
                        fontSize: '12px',
                        opacity: 0.7,
                        color: isOwnMessage ? 'inherit' : 'success.main'
                      }}
                    />
                  </Tooltip>
                )}

                {message.status === 'failed' && (
                  <Tooltip title={`Failed to send: ${message.error || 'Unknown error'}`}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <ErrorIcon sx={{ fontSize: '12px', color: 'error.main' }} />
                      <IconButton
                        size="small"
                        sx={{ opacity: 0.7, minWidth: 'auto', width: '16px', height: '16px' }}
                        onClick={() => onRetryMessage(message)}
                      >
                        <RefreshIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Tooltip>
                )}

                {message.status === 'delete_failed' && (
                  <Tooltip title={`Failed to delete: ${message.error || 'Unknown error'}`}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <ErrorIcon sx={{ fontSize: '12px', color: 'warning.main' }} />
                      <IconButton
                        size="small"
                        sx={{ opacity: 0.7, minWidth: 'auto', width: '16px', height: '16px' }}
                        onClick={() => onDeleteMessage(message)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Tooltip>
                )}
              </Box>
            )}
            
            {/* Display existing reactions */}
            {groupedReactions.length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                {groupedReactions.map((reaction, idx) => (
                  <Tooltip
                    key={idx}
                    title={
                      <Box>
                        {reaction.users.map((u, i) => (
                          <Typography key={i} variant="caption" display="block">
                            {u.fullName || 'Unknown User'}
                          </Typography>
                        ))}
                      </Box>
                    }
                    arrow
                  >
                    <Chip
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                          <span style={{ fontSize: '0.9rem' }}>{reaction.emoji}</span>
                          <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>
                            {reaction.count}
                          </Typography>
                        </Box>
                      }
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onReactionToggle(message._id, reaction.emoji);
                      }}
                      sx={{
                        height: 20,
                        backgroundColor: reaction.userReacted 
                          ? 'primary.light' 
                          : isOwnMessage 
                            ? 'rgba(255,255,255,0.2)' 
                            : 'grey.200',
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor: reaction.userReacted 
                            ? 'primary.main' 
                            : isOwnMessage 
                              ? 'rgba(255,255,255,0.3)' 
                              : 'grey.300',
                        }
                      }}
                    />
                  </Tooltip>
                ))}
              </Box>
            )}
          </>
        )}
      </Paper>

      {/* Menu button on right side for others' messages */}
      {!isOwnMessage && ((message.status === 'sent' || message.status === 'delete_failed') && !message.isOptimistic) && (
        <IconButton
          className="message-menu"
          size="small"
          sx={{ 
            opacity: 0,
            transition: 'opacity 0.2s ease-in-out',
            p: 0.25,
            color: 'text.secondary',
          }}
          onClick={handleMenuClick}
        >
          <MoreVertIcon sx={{ fontSize: '18px' }} />
        </IconButton>
      )}

      {/* Time on right side for others' messages */}
      {!isOwnMessage && (
        <Typography 
          className="message-time"
          sx={{ 
            fontSize: '0.65rem', 
            color: 'text.secondary',
            opacity: 0,
            transition: 'opacity 0.2s ease-in-out',
            whiteSpace: 'nowrap',
            userSelect: 'none',
          }}
        >
          {formatMessageTime(message.createdAt)}
          {message.isEdited && ' (edited)'}
        </Typography>
      )}
    </Box>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for optimal re-rendering
  // Only re-render if these specific props change
  return (
    prevProps.message._id === nextProps.message._id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.status === nextProps.message.status &&
    prevProps.message.isEdited === nextProps.message.isEdited &&
    prevProps.message.reactions === nextProps.message.reactions &&
    prevProps.message.readBy === nextProps.message.readBy &&
    prevProps.isOwnMessage === nextProps.isOwnMessage &&
    prevProps.editingMessage?._id === nextProps.editingMessage?._id &&
    prevProps.editContent === nextProps.editContent
  );
});

MessageItem.displayName = 'MessageItem';

export default MessageItem;


