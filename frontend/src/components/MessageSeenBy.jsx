import React, { useState } from 'react';
import {
  Box,
  Typography,
  Tooltip,
  Avatar,
  AvatarGroup,
  Popover,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider
} from '@mui/material';
import {
  DoneAll as DoneAllIcon,
  Done as DoneIcon
} from '@mui/icons-material';

/**
 * Component to show who has seen a message in group chats
 * Displays check marks and optionally a detailed popover with user list
 */
const MessageSeenBy = ({ message, conversation, isOwnMessage, currentUserId }) => {
  const [anchorEl, setAnchorEl] = useState(null);

  // Only show for group chats and own messages
  if (!conversation || conversation.type !== 'group' || !isOwnMessage) {
    return null;
  }

  // Get list of users who have read this message (excluding sender)
  const readByUsers = message.readBy
    ? message.readBy
        .filter(read => read.user._id !== currentUserId)
        .map(read => {
          // Find the full user details from conversation participants
          const participant = conversation.participants?.find(
            p => p.user._id === read.user._id || p.user === read.user._id
          );
          return {
            ...read,
            user: participant?.user || read.user,
            readAt: read.readAt
          };
        })
        .filter(read => read.user) // Filter out any undefined users
    : [];

  // Get total number of other participants (excluding sender)
  const otherParticipants = conversation.participants?.filter(
    p => (p.user._id || p.user) !== currentUserId
  ) || [];
  const totalOtherParticipants = otherParticipants.length;

  const readCount = readByUsers.length;
  const allRead = readCount === totalOtherParticipants && totalOtherParticipants > 0;

  const handleClick = (event) => {
    if (readCount > 0) {
      setAnchorEl(event.currentTarget);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  // Format the read timestamp
  const formatReadTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    // Less than 1 minute
    if (diff < 60000) {
      return 'Just now';
    }
    // Less than 1 hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes}m ago`;
    }
    // Less than 1 day
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}h ago`;
    }
    // Format as date/time
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  // Generate tooltip text
  const getTooltipText = () => {
    if (readCount === 0) {
      return 'Sent';
    }
    if (allRead) {
      return `Seen by all (${readCount})`;
    }
    if (readCount === 1) {
      return `Seen by ${readByUsers[0].user?.fullName || 'Unknown'}`;
    }
    if (readCount === 2) {
      return `Seen by ${readByUsers[0].user?.fullName || 'Unknown'} and ${readByUsers[1].user?.fullName || 'Unknown'}`;
    }
    return `Seen by ${readCount} of ${totalOtherParticipants}`;
  };

  return (
    <>
      <Tooltip title={getTooltipText()}>
        <Box
          onClick={handleClick}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.25,
            cursor: readCount > 0 ? 'pointer' : 'default',
            ml: 0.5,
            '&:hover': readCount > 0 ? {
              opacity: 0.8
            } : {}
          }}
        >
          {/* Show double check if read by anyone, single check if only sent */}
          {readCount > 0 ? (
            <DoneAllIcon
              sx={{
                fontSize: '14px',
                color: allRead ? 'info.main' : 'inherit',
                opacity: 0.7
              }}
            />
          ) : (
            <DoneIcon
              sx={{
                fontSize: '14px',
                opacity: 0.7
              }}
            />
          )}
          
          {/* Show count if more than 0 */}
          {readCount > 0 && (
            <Typography
              variant="caption"
              sx={{
                fontSize: '10px',
                opacity: 0.7,
                lineHeight: 1
              }}
            >
              {readCount}
            </Typography>
          )}
        </Box>
      </Tooltip>

      {/* Detailed popover showing who has seen the message */}
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            maxWidth: 300,
            maxHeight: 400
          }
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Seen by {readCount} of {totalOtherParticipants}
          </Typography>
          
          <List dense sx={{ pt: 1 }}>
            {readByUsers.map((read) => (
              <ListItem
                key={read.user._id || read.user}
                sx={{ px: 0 }}
              >
                <ListItemAvatar>
                  <Avatar sx={{ width: 32, height: 32 }}>
                    {read.user?.fullName?.charAt(0) || 'U'}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Typography variant="body2" noWrap>
                      {read.user?.fullName || 'Unknown User'}
                    </Typography>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary">
                      {formatReadTime(read.readAt)}
                    </Typography>
                  }
                />
              </ListItem>
            ))}
          </List>

          {/* Show who hasn't seen it yet */}
          {readCount < totalOtherParticipants && (
            <>
              <Divider sx={{ my: 1 }} />
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Not seen yet ({totalOtherParticipants - readCount})
              </Typography>
              <List dense sx={{ pt: 0.5 }}>
                {otherParticipants
                  .filter(p => !readByUsers.some(read => 
                    (read.user._id || read.user) === (p.user._id || p.user)
                  ))
                  .map((participant) => (
                    <ListItem
                      key={participant.user._id || participant.user}
                      sx={{ px: 0 }}
                    >
                      <ListItemAvatar>
                        <Avatar sx={{ width: 32, height: 32, opacity: 0.5 }}>
                          {participant.user?.fullName?.charAt(0) || 'U'}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Typography variant="body2" noWrap sx={{ opacity: 0.7 }}>
                            {participant.user?.fullName || 'Unknown User'}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
              </List>
            </>
          )}
        </Box>
      </Popover>
    </>
  );
};

export default MessageSeenBy;

