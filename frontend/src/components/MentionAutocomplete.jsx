import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Typography,
  Popper
} from '@mui/material';

/**
 * MentionAutocomplete Component
 * 
 * Provides autocomplete functionality for @mentions in chat messages.
 * Shows a dropdown list of users when @ is typed.
 * 
 * @param {Object} props
 * @param {Array} props.participants - Array of conversation participants to suggest
 * @param {HTMLElement} props.anchorEl - The input element to anchor the dropdown to
 * @param {Function} props.onSelect - Callback when a user is selected (userId, userName)
 * @param {Function} props.onClose - Callback when autocomplete should close
 * @param {string} props.searchTerm - Current search term after @
 * @param {boolean} props.open - Whether the autocomplete is open
 */
const MentionAutocomplete = ({
  participants = [],
  anchorEl,
  onSelect,
  onClose,
  searchTerm = '',
  open = false
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef(null);

  // Filter participants based on search term
  const filteredParticipants = participants.filter(participant => {
    if (!participant || !participant.fullName) return false;
    
    const search = searchTerm.toLowerCase();
    const name = participant.fullName.toLowerCase();
    const email = participant.email?.toLowerCase() || '';
    
    return name.includes(search) || email.includes(search);
  });

  // Reset selected index when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchTerm, participants]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e) => {
      if (!open || filteredParticipants.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < filteredParticipants.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : filteredParticipants.length - 1
          );
          break;
        case 'Enter':
          if (filteredParticipants[selectedIndex]) {
            e.preventDefault();
            const selected = filteredParticipants[selectedIndex];
            onSelect(selected._id, selected.fullName);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, filteredParticipants, selectedIndex, onSelect, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && open) {
      const selectedElement = listRef.current.children[selectedIndex];
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth'
        });
      }
    }
  }, [selectedIndex, open]);

  if (!open || filteredParticipants.length === 0) {
    return null;
  }

  return (
    <Popper
      open={open}
      anchorEl={anchorEl}
      placement="top-start"
      sx={{ zIndex: 1500 }}
    >
      <Paper
        elevation={8}
        sx={{
          maxHeight: 300,
          overflow: 'auto',
          minWidth: 250,
          maxWidth: 400,
          borderRadius: 2,
          mt: -1
        }}
      >
        <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'grey.50' }}>
          <Typography variant="caption" color="text.secondary">
            Select a user to mention (↑↓ to navigate, Enter to select)
          </Typography>
        </Box>
        <List ref={listRef} sx={{ p: 0 }}>
          {filteredParticipants.map((participant, index) => (
            <ListItem
              key={participant._id}
              button
              selected={index === selectedIndex}
              onClick={() => onSelect(participant._id, participant.fullName)}
              sx={{
                '&.Mui-selected': {
                  bgcolor: 'primary.light',
                  '&:hover': {
                    bgcolor: 'primary.main',
                    '& .MuiTypography-root': {
                      color: 'white'
                    }
                  },
                  '& .MuiTypography-root': {
                    color: 'white'
                  }
                },
                transition: 'background-color 0.2s'
              }}
            >
              <ListItemAvatar>
                <Avatar sx={{ width: 32, height: 32 }}>
                  {participant.fullName?.charAt(0) || 'U'}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={participant.fullName}
                secondary={
                  <React.Fragment>
                    <Typography
                      component="span"
                      variant="caption"
                      sx={{ 
                        display: 'block',
                        ...(index === selectedIndex && {
                          color: 'rgba(255, 255, 255, 0.7)'
                        })
                      }}
                    >
                      {participant.role?.replace('_', ' ') || 'User'}
                    </Typography>
                  </React.Fragment>
                }
                primaryTypographyProps={{
                  sx: {
                    fontWeight: index === selectedIndex ? 'bold' : 'normal'
                  }
                }}
              />
            </ListItem>
          ))}
        </List>
      </Paper>
    </Popper>
  );
};

export default MentionAutocomplete;

