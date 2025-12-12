import React, { useState } from 'react';
import {
  Box,
  IconButton,
  Popover,
  Tooltip,
  Typography,
  Paper,
  Chip
} from '@mui/material';
import {
  AddReaction as AddReactionIcon
} from '@mui/icons-material';

// Common emoji reactions
const COMMON_REACTIONS = [
  '👍', '❤️', '😂', '😮', '😢', '🙏', '🎉', '🔥'
];

const MessageReactions = ({ 
  message, 
  currentUserId, 
  onReactionToggle, 
  isOwnMessage 
}) => {
  const [emojiPickerAnchor, setEmojiPickerAnchor] = useState(null);

  const handleOpenEmojiPicker = (event) => {
    event.stopPropagation();
    setEmojiPickerAnchor(event.currentTarget);
  };

  const handleCloseEmojiPicker = () => {
    setEmojiPickerAnchor(null);
  };

  const handleReactionClick = (emoji) => {
    if (onReactionToggle) {
      onReactionToggle(message._id, emoji);
    }
    handleCloseEmojiPicker();
  };

  // Group reactions by emoji and count them
  const groupedReactions = React.useMemo(() => {
    if (!message.reactions || message.reactions.length === 0) {
      return [];
    }

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
      
      if (reaction.user._id === currentUserId) {
        group.userReacted = true;
      }
    });

    return Array.from(reactionMap.values());
  }, [message.reactions, currentUserId]);

  const hasReactions = groupedReactions.length > 0;

  return (
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: 0.5,
      mt: 0.5,
      flexWrap: 'wrap'
    }}>
      {/* Display grouped reactions */}
      {groupedReactions.map((reaction, index) => (
        <Tooltip
          key={index}
          title={
            <Box>
              {reaction.users.map((user, idx) => (
                <Typography key={idx} variant="caption" display="block">
                  {user.fullName || 'Unknown User'}
                </Typography>
              ))}
            </Box>
          }
          arrow
        >
          <Chip
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                <span style={{ fontSize: '1rem' }}>{reaction.emoji}</span>
                <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                  {reaction.count}
                </Typography>
              </Box>
            }
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleReactionClick(reaction.emoji);
            }}
            sx={{
              height: 22,
              cursor: 'pointer',
              borderRadius: '12px',
              '& .MuiChip-label': {
                px: 0.75,
                py: 0.25
              },
              // Highlight if current user reacted
              ...(reaction.userReacted && {
                bgcolor: isOwnMessage ? 'rgba(255, 255, 255, 0.3)' : 'primary.light',
                border: isOwnMessage ? '1px solid rgba(255, 255, 255, 0.5)' : '1px solid',
                borderColor: isOwnMessage ? 'rgba(255, 255, 255, 0.5)' : 'primary.main',
              }),
              '&:hover': {
                bgcolor: isOwnMessage ? 'rgba(255, 255, 255, 0.4)' : 'primary.lighter',
                transform: 'scale(1.1)',
              },
              transition: 'all 0.2s ease'
            }}
          />
        </Tooltip>
      ))}

      {/* Add reaction button */}
      <Tooltip title="Add reaction">
        <IconButton
          size="small"
          onClick={handleOpenEmojiPicker}
          sx={{
            width: 22,
            height: 22,
            opacity: 0.6,
            '&:hover': {
              opacity: 1,
              bgcolor: isOwnMessage ? 'rgba(255, 255, 255, 0.2)' : 'action.hover',
            }
          }}
        >
          <AddReactionIcon sx={{ fontSize: '1rem' }} />
        </IconButton>
      </Tooltip>

      {/* Emoji Picker Popover */}
      <Popover
        open={Boolean(emojiPickerAnchor)}
        anchorEl={emojiPickerAnchor}
        onClose={handleCloseEmojiPicker}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Paper sx={{ p: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap', maxWidth: 240 }}>
          {COMMON_REACTIONS.map((emoji, index) => (
            <IconButton
              key={index}
              onClick={() => handleReactionClick(emoji)}
              sx={{
                fontSize: '1.5rem',
                width: 40,
                height: 40,
                '&:hover': {
                  bgcolor: 'action.hover',
                  transform: 'scale(1.2)',
                },
                transition: 'all 0.2s ease'
              }}
            >
              {emoji}
            </IconButton>
          ))}
        </Paper>
      </Popover>
    </Box>
  );
};

export default MessageReactions;

