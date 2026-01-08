import React, { memo, useMemo } from 'react';
import {
  Box,
  Typography,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Badge,
  Chip,
  AvatarGroup
} from '@mui/material';
import { Group as GroupIcon } from '@mui/icons-material';
import { cleanMentionsForDisplay } from '../utils/mentionUtils';

/**
 * Memoized conversation list item for optimal rendering performance.
 * Only re-renders when conversation data or unread count changes.
 */
const ConversationListItem = memo(({
  conversation,
  isSelected,
  unreadCount,
  currentUserId,
  onSelect
}) => {
  // Memoize conversation title
  const title = useMemo(() => {
    if (conversation.title) return conversation.title;
    if (conversation.type === 'group') {
      const participantNames = conversation.participants
        ?.filter(p => p.user && p.user._id !== currentUserId)
        .map(p => p.user?.fullName || 'Unknown')
        .slice(0, 2)
        .join(', ');
      return participantNames 
        ? `${participantNames}${conversation.participants.length > 3 ? '...' : ''}` 
        : 'Group Chat';
    }
    if (conversation.otherParticipant) {
      return conversation.otherParticipant.fullName;
    }
    return 'Chat';
  }, [conversation.title, conversation.type, conversation.participants, conversation.otherParticipant, currentUserId]);

  // Memoize subtitle
  const subtitle = useMemo(() => {
    if (conversation.lastMessage) {
      const lastMessage = conversation.lastMessage;
      const isFromCurrentUser = lastMessage.sender?._id === currentUserId;
      
      let messageContent = '';
      if (lastMessage.messageType === 'image') {
        messageContent = lastMessage.content || '📷 Image';
      } else if (lastMessage.messageType === 'file') {
        messageContent = lastMessage.content || '📎 File';
      } else {
        messageContent = cleanMentionsForDisplay(lastMessage.content || '');
      }
      
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
      
      if (isFromCurrentUser) {
        return messageContent ? `You: ${messageContent}` : 'You sent a message';
      }
      
      return messageContent || 'Message';
    }
    return 'No messages yet';
  }, [conversation.lastMessage, currentUserId, unreadCount]);

  // Memoize avatar
  const avatar = useMemo(() => {
    if (conversation.type === 'group') {
      const participantAvatars = conversation.participants
        ?.filter(p => p.user && p.user._id !== currentUserId)
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
  }, [conversation.type, conversation.participants, conversation.otherParticipant, currentUserId]);

  // Memoize formatted time
  const formattedTime = useMemo(() => {
    if (!conversation.lastMessage?.timestamp) return '';
    const date = new Date(conversation.lastMessage.timestamp);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [conversation.lastMessage?.timestamp]);

  const handleClick = () => {
    onSelect(conversation);
  };

  return (
    <ListItem
      button
      selected={isSelected}
      onClick={handleClick}
      sx={{ 
        px: 2.5, 
        py: 1.5,
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
          {avatar}
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
                ...(unreadCount > 0 && {
                  fontWeight: 'bold',
                  color: 'text.primary',
                  textDecoration: 'underline',
                  textDecorationColor: 'primary.main'
                })
              }}
            >
              {title}
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
                ...(unreadCount > 0 && {
                  fontWeight: 'medium',
                  color: 'text.primary'
                })
              }}
            >
              {subtitle}
            </Typography>
            {formattedTime && (
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
                {formattedTime}
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
}, (prevProps, nextProps) => {
  // Custom comparison for optimal re-rendering
  return (
    prevProps.conversation._id === nextProps.conversation._id &&
    prevProps.conversation.lastMessage?.content === nextProps.conversation.lastMessage?.content &&
    prevProps.conversation.lastMessage?.timestamp === nextProps.conversation.lastMessage?.timestamp &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.unreadCount === nextProps.unreadCount
  );
});

ConversationListItem.displayName = 'ConversationListItem';

export default ConversationListItem;



