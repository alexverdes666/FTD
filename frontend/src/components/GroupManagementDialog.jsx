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
  Divider,
  IconButton,
  Tab,
  Tabs,
  Chip,
  InputAdornment
} from '@mui/material';
import {
  Group as GroupIcon,
  Person as PersonIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import chatService from '../services/chatService';

const GroupManagementDialog = ({ open, onClose, conversation, onUpdated }) => {
  const [tabValue, setTabValue] = useState(0);
  const [groupTitle, setGroupTitle] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedNewParticipants, setSelectedNewParticipants] = useState([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    if (open && conversation) {
      setGroupTitle(conversation.title || '');
      setEditingTitle(false);
      setSelectedNewParticipants([]);
      setUserSearchQuery('');
      setError('');
      loadAvailableUsers();
    }
  }, [open, conversation]);

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
      const currentParticipantIds = conversation?.participants
        ?.filter(p => p.user)
        .map(p => p.user._id) || [];
      
      // Filter out current participants
      const availableUsers = (response.data || []).filter(
        user => !currentParticipantIds.includes(user._id)
      );
      
      setAvailableUsers(availableUsers);
    } catch (error) {
      console.error('Error loading users:', error);
      setError('Failed to load available users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleUpdateTitle = async () => {
    if (!groupTitle.trim()) {
      setError('Please enter a group title');
      return;
    }

    if (groupTitle.trim() === conversation.title) {
      setEditingTitle(false);
      return;
    }

    try {
      setLoading(true);
      setError('');

      await chatService.updateGroupConversation(conversation._id, {
        title: groupTitle.trim()
      });

      setEditingTitle(false);
      
      if (onUpdated) {
        onUpdated();
      }
    } catch (error) {
      console.error('Error updating group title:', error);
      setError(error.response?.data?.message || 'Failed to update group title');
    } finally {
      setLoading(false);
    }
  };

  const handleAddParticipants = async () => {
    if (selectedNewParticipants.length === 0) {
      setError('Please select at least one participant to add');
      return;
    }

    try {
      setLoading(true);
      setError('');

      await chatService.addParticipantsToGroup(conversation._id, selectedNewParticipants);

      setSelectedNewParticipants([]);
      await loadAvailableUsers();
      
      if (onUpdated) {
        onUpdated();
      }
    } catch (error) {
      console.error('Error adding participants:', error);
      setError(error.response?.data?.message || 'Failed to add participants');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveParticipant = async (participantId) => {
    if (!window.confirm('Are you sure you want to remove this participant from the group?')) {
      return;
    }

    try {
      setLoading(true);
      setError('');

      await chatService.removeParticipantFromGroup(conversation._id, participantId);

      await loadAvailableUsers();
      
      if (onUpdated) {
        onUpdated();
      }
    } catch (error) {
      console.error('Error removing participant:', error);
      setError(error.response?.data?.message || 'Failed to remove participant');
    } finally {
      setLoading(false);
    }
  };

  const handleParticipantToggle = (userId) => {
    setSelectedNewParticipants(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  if (!conversation || conversation.type !== 'group') {
    return null;
  }

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { minHeight: '600px' }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <GroupIcon />
        Manage Group: {conversation.title}
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
            <Tab label="Group Info" />
            <Tab label="Members" />
            <Tab label="Add Members" />
          </Tabs>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        )}

        {/* Group Info Tab */}
        {tabValue === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6" gutterBottom>
              Group Information
            </Typography>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {editingTitle ? (
                <>
                  <TextField
                    value={groupTitle}
                    onChange={(e) => setGroupTitle(e.target.value)}
                    label="Group Title"
                    size="small"
                    sx={{ flexGrow: 1 }}
                    disabled={loading}
                  />
                  <IconButton 
                    onClick={handleUpdateTitle}
                    disabled={loading}
                    color="primary"
                  >
                    <SaveIcon />
                  </IconButton>
                  <IconButton 
                    onClick={() => {
                      setGroupTitle(conversation.title || '');
                      setEditingTitle(false);
                    }}
                    disabled={loading}
                  >
                    <CancelIcon />
                  </IconButton>
                </>
              ) : (
                <>
                  <Typography sx={{ flexGrow: 1 }}>
                    <strong>Title:</strong> {conversation.title}
                  </Typography>
                  <IconButton 
                    onClick={() => setEditingTitle(true)}
                    size="small"
                  >
                    <EditIcon />
                  </IconButton>
                </>
              )}
            </Box>

            <Typography>
              <strong>Members:</strong> {conversation.participants?.length || 0}
            </Typography>
            
            <Typography>
              <strong>Created:</strong> {new Date(conversation.createdAt).toLocaleDateString()}
            </Typography>
          </Box>
        )}

        {/* Members Tab */}
        {tabValue === 1 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Current Members ({conversation.participants?.length || 0})
            </Typography>
            
            <List>
              {conversation.participants?.filter(p => p.user).map((participant) => (
                <ListItem 
                  key={participant.user._id}
                  secondaryAction={
                    <IconButton
                      edge="end"
                      onClick={() => handleRemoveParticipant(participant.user._id)}
                      disabled={loading || conversation.participants.length <= 2}
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  }
                >
                  <ListItemAvatar>
                    <Avatar>
                      {participant.user.fullName?.charAt(0) || 'U'}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={participant.user.fullName}
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip 
                          size="small" 
                          label={participant.role.replace('_', ' ')} 
                          variant="outlined"
                        />
                        <Typography variant="caption" color="text.secondary">
                          Joined: {new Date(participant.joinedAt).toLocaleDateString()}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {/* Add Members Tab */}
        {tabValue === 2 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Add New Members
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
              sx={{ mb: 2 }}
            />

            {selectedNewParticipants.length > 0 && (
              <Box sx={{ mb: 2, p: 2, bgcolor: 'primary.50', borderRadius: 1 }}>
                <Typography variant="subtitle2" color="primary.main">
                  Selected ({selectedNewParticipants.length}):
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {availableUsers
                    .filter(user => selectedNewParticipants.includes(user._id))
                    .map(user => user.fullName)
                    .join(', ')}
                </Typography>
              </Box>
            )}

            {loadingUsers ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : (
              <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                {filteredAvailableUsers.map((user) => (
                  <ListItem
                    key={user._id}
                    button
                    onClick={() => handleParticipantToggle(user._id)}
                    disabled={loading}
                  >
                    <Checkbox
                      checked={selectedNewParticipants.includes(user._id)}
                      disabled={loading}
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
                      secondary="All eligible users are already members of this group"
                      sx={{ textAlign: 'center' }}
                    />
                  </ListItem>
                )}
              </List>
            )}

            {selectedNewParticipants.length > 0 && (
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleAddParticipants}
                  disabled={loading}
                >
                  Add {selectedNewParticipants.length} Member{selectedNewParticipants.length > 1 ? 's' : ''}
                </Button>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default GroupManagementDialog; 