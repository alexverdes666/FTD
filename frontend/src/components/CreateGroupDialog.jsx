import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Checkbox,
  Typography,
  Box,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment
} from '@mui/material';
import {
  Group as GroupIcon,
  Person as PersonIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import chatService from '../services/chatService';

const CreateGroupDialog = ({ open, onClose, onGroupCreated }) => {
  const [groupTitle, setGroupTitle] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [contextType, setContextType] = useState('general');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Load available users when dialog opens
  useEffect(() => {
    if (open) {
      loadAvailableUsers();
      // Reset form when opening
      setGroupTitle('');
      setSelectedParticipants([]);
      setUserSearchQuery('');
      setContextType('general');
      setError('');
    }
  }, [open]);

  // Filter available users based on search query
  const filteredAvailableUsers = availableUsers.filter(user => {
    if (!userSearchQuery.trim()) return true;
    
    const query = userSearchQuery.toLowerCase();
    return (
      user.fullName.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      user.role.toLowerCase().replace('_', ' ').includes(query)
    );
  });

  const loadAvailableUsers = async () => {
    try {
      setLoadingUsers(true);
      const response = await chatService.getChatableUsers();
      setAvailableUsers(response.data || []);
    } catch (error) {
      console.error('Error loading users:', error);
      setError('Failed to load available users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleParticipantToggle = (userId) => {
    setSelectedParticipants(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  const handleCreateGroup = async () => {
    if (!groupTitle.trim()) {
      setError('Please enter a group title');
      return;
    }

    if (selectedParticipants.length < 2) {
      setError('Please select at least 2 participants');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const groupData = {
        title: groupTitle.trim(),
        participantIds: selectedParticipants,
        contextType
      };

      const response = await chatService.createGroupConversation(groupData);
      
      // Notify parent component about the new group
      if (onGroupCreated) {
        onGroupCreated(response.data);
      }

      // Close dialog
      onClose();
    } catch (error) {
      console.error('Error creating group:', error);
      setError(error.response?.data?.message || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  const getSelectedParticipantNames = () => {
    return availableUsers
      .filter(user => selectedParticipants.includes(user._id))
      .map(user => user.fullName)
      .join(', ');
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { minHeight: '500px' }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <GroupIcon />
        Create New Group
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {error && (
            <Alert severity="error">{error}</Alert>
          )}

          {/* Group Title */}
          <TextField
            label="Group Title"
            value={groupTitle}
            onChange={(e) => setGroupTitle(e.target.value)}
            fullWidth
            placeholder="Enter a name for your group"
            disabled={loading}
          />

          {/* Context Type */}
          <FormControl fullWidth>
            <InputLabel>Context Type</InputLabel>
            <Select
              value={contextType}
              onChange={(e) => setContextType(e.target.value)}
              label="Context Type"
              disabled={loading}
            >
              <MenuItem value="general">General</MenuItem>
              <MenuItem value="support">Support</MenuItem>
              <MenuItem value="order">Order Related</MenuItem>
              <MenuItem value="lead">Lead Related</MenuItem>
            </Select>
          </FormControl>

          {/* Selected Participants Summary */}
          {selectedParticipants.length > 0 && (
            <Box sx={{ p: 2, bgcolor: 'primary.50', borderRadius: 1 }}>
              <Typography variant="subtitle2" color="primary.main" gutterBottom>
                Selected Participants ({selectedParticipants.length}):
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {getSelectedParticipantNames()}
              </Typography>
            </Box>
          )}

          {/* Participants Selection */}
          <Typography variant="subtitle1" sx={{ mt: 1 }}>
            Select Participants (minimum 2):
          </Typography>

          {/* User Search */}
          <TextField
            fullWidth
            placeholder="Search users..."
            value={userSearchQuery}
            onChange={(e) => setUserSearchQuery(e.target.value)}
            disabled={loading || loadingUsers}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 1 }}
          />

          {loadingUsers ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <List sx={{ maxHeight: 300, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
              {filteredAvailableUsers.map((user) => (
                <ListItem
                  key={user._id}
                  button
                  onClick={() => handleParticipantToggle(user._id)}
                  disabled={loading}
                >
                  <Checkbox
                    checked={selectedParticipants.includes(user._id)}
                    disabled={loading}
                    tabIndex={-1}
                  />
                  <ListItemAvatar>
                    <Avatar>
                      <PersonIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={user.fullName}
                    secondary={`${user.role.replace('_', ' ')} • ${user.email}`}
                  />
                </ListItem>
              ))}
              
              {filteredAvailableUsers.length === 0 && availableUsers.length > 0 && (
                <ListItem>
                  <ListItemText
                    primary="No users found"
                    secondary={`No users match "${userSearchQuery}"`}
                    sx={{ textAlign: 'center' }}
                  />
                </ListItem>
              )}
              
              {availableUsers.length === 0 && (
                <ListItem>
                  <ListItemText
                    primary="No users available"
                    secondary="No users found that you can add to a group"
                    sx={{ textAlign: 'center' }}
                  />
                </ListItem>
              )}
            </List>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button 
          onClick={onClose} 
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          onClick={handleCreateGroup}
          variant="contained"
          disabled={loading || !groupTitle.trim() || selectedParticipants.length < 2}
          startIcon={loading ? <CircularProgress size={16} /> : <GroupIcon />}
        >
          {loading ? 'Creating...' : 'Create Group'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateGroupDialog; 