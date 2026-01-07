import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Alert,
  CircularProgress,
  Pagination,
  Divider,
  IconButton,
  Tooltip,
  Paper,
  useTheme,
  Fade,
  Skeleton,
} from '@mui/material';
import {
  Campaign as AnnouncementIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Send as SendIcon,
  CheckCircle as ReadIcon,
  RadioButtonUnchecked as UnreadIcon,
  People as PeopleIcon,
  Person as PersonIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { selectUser } from '../store/slices/authSlice';
import announcementService from '../services/announcementService';
import toast from 'react-hot-toast';

const AnnouncementsPage = () => {
  const theme = useTheme();
  const user = useSelector(selectUser);
  const isAdmin = user?.role === 'admin';

  // State
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);

  // Create form state
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    targetRoles: [],
    priority: 'medium',
  });
  const [formErrors, setFormErrors] = useState({});

  // Fetch announcements
  const fetchAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let response;
      if (isAdmin) {
        response = await announcementService.getSentAnnouncements({ page, limit: 10 });
      } else {
        response = await announcementService.getMyAnnouncements({ page, limit: 10 });
      }

      if (response.success) {
        setAnnouncements(response.data);
        setTotalPages(response.pagination?.pages || 1);
      }
    } catch (err) {
      console.error('Error fetching announcements:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, page]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  // Handle form input changes
  const handleInputChange = (field) => (event) => {
    const value = event.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  // Handle target roles change
  const handleRoleToggle = (role) => {
    setFormData(prev => {
      const newRoles = prev.targetRoles.includes(role)
        ? prev.targetRoles.filter(r => r !== role)
        : [...prev.targetRoles, role];
      return { ...prev, targetRoles: newRoles };
    });
    if (formErrors.targetRoles) {
      setFormErrors(prev => ({ ...prev, targetRoles: null }));
    }
  };

  // Validate form
  const validateForm = () => {
    const validation = announcementService.validateAnnouncementData(formData);
    if (!validation.isValid) {
      setFormErrors(validation.errors);
      return false;
    }
    setFormErrors({});
    return true;
  };

  // Handle create announcement
  const handleCreate = async () => {
    if (!validateForm()) return;

    try {
      setCreating(true);
      const response = await announcementService.createAnnouncement(formData);
      
      if (response.success) {
        toast.success('Announcement sent successfully!');
        setCreateDialogOpen(false);
        setFormData({
          title: '',
          message: '',
          targetRoles: [],
          priority: 'medium',
        });
        fetchAnnouncements();
      }
    } catch (err) {
      console.error('Error creating announcement:', err);
      toast.error(err.message || 'Failed to create announcement');
    } finally {
      setCreating(false);
    }
  };

  // Handle delete announcement
  const handleDelete = async (announcementId) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) return;

    try {
      setDeleting(announcementId);
      await announcementService.deleteAnnouncement(announcementId);
      toast.success('Announcement deleted');
      fetchAnnouncements();
    } catch (err) {
      console.error('Error deleting announcement:', err);
      toast.error(err.message || 'Failed to delete announcement');
    } finally {
      setDeleting(null);
    }
  };

  // Handle mark as read (for non-admin users)
  const handleMarkAsRead = async (announcementId) => {
    try {
      await announcementService.markAsRead(announcementId);
      setAnnouncements(prev =>
        prev.map(a =>
          a._id === announcementId ? { ...a, isRead: true } : a
        )
      );
      toast.success('Marked as read');
    } catch (err) {
      console.error('Error marking as read:', err);
      toast.error('Failed to mark as read');
    }
  };

  // Get priority display
  const getPriorityDisplay = (priority) => {
    switch (priority) {
      case 'urgent':
        return { icon: <ErrorIcon fontSize="small" />, color: 'error', label: 'Urgent' };
      case 'high':
        return { icon: <WarningIcon fontSize="small" />, color: 'warning', label: 'High' };
      case 'medium':
        return { icon: <InfoIcon fontSize="small" />, color: 'info', label: 'Medium' };
      case 'low':
        return { icon: <CheckIcon fontSize="small" />, color: 'default', label: 'Low' };
      default:
        return { icon: <InfoIcon fontSize="small" />, color: 'info', label: 'Medium' };
    }
  };

  // Get target audience display
  const getTargetAudienceDisplay = (targetRoles) => {
    if (targetRoles?.includes('agent') && targetRoles?.includes('affiliate_manager')) {
      return { icon: <PeopleIcon fontSize="small" />, label: 'Agents & Affiliate Managers' };
    } else if (targetRoles?.includes('agent')) {
      return { icon: <PersonIcon fontSize="small" />, label: 'Agents' };
    } else if (targetRoles?.includes('affiliate_manager')) {
      return { icon: <PersonIcon fontSize="small" />, label: 'Affiliate Managers' };
    }
    return { icon: <PeopleIcon fontSize="small" />, label: 'Unknown' };
  };

  // Render announcement card
  const renderAnnouncementCard = (announcement) => {
    const priorityDisplay = getPriorityDisplay(announcement.priority);
    const targetDisplay = getTargetAudienceDisplay(announcement.targetRoles);
    const isUnread = !isAdmin && !announcement.isRead;

    return (
      <Fade in key={announcement._id}>
        <Card
          sx={{
            mb: 2,
            borderLeft: isUnread ? `4px solid ${theme.palette.primary.main}` : 'none',
            bgcolor: isUnread 
              ? theme.palette.mode === 'dark' 
                ? 'rgba(25, 118, 210, 0.08)'
                : 'rgba(25, 118, 210, 0.04)'
              : 'background.paper',
          }}
        >
          <CardContent>
            <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={1}>
              <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                {!isAdmin && (
                  <Tooltip title={isUnread ? 'Unread' : 'Read'}>
                    {isUnread ? (
                      <UnreadIcon color="primary" fontSize="small" />
                    ) : (
                      <ReadIcon color="success" fontSize="small" />
                    )}
                  </Tooltip>
                )}
                <Chip
                  icon={priorityDisplay.icon}
                  label={priorityDisplay.label}
                  color={priorityDisplay.color}
                  size="small"
                />
                {isAdmin && (
                  <Chip
                    icon={targetDisplay.icon}
                    label={targetDisplay.label}
                    variant="outlined"
                    size="small"
                  />
                )}
              </Box>
              <Typography variant="caption" color="text.secondary">
                {new Date(announcement.createdAt).toLocaleString()}
              </Typography>
            </Box>

            <Typography variant="h6" gutterBottom fontWeight={600}>
              {announcement.title}
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                whiteSpace: 'pre-wrap',
                maxHeight: 100,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {announcement.message}
            </Typography>

            {isAdmin && (
              <Box mt={2} display="flex" alignItems="center" gap={2}>
                <Typography variant="caption" color="text.secondary">
                  Sent by: {announcement.createdBy?.fullName || 'Unknown'}
                </Typography>
                {announcement.readCount !== undefined && (
                  <Chip
                    label={`${announcement.readCount} read`}
                    size="small"
                    variant="outlined"
                    icon={<ReadIcon />}
                  />
                )}
              </Box>
            )}
          </CardContent>

          <CardActions sx={{ px: 2, pb: 2 }}>
            {!isAdmin && isUnread && (
              <Button
                size="small"
                startIcon={<ReadIcon />}
                onClick={() => handleMarkAsRead(announcement._id)}
              >
                Mark as Read
              </Button>
            )}
            {isAdmin && (
              <Button
                size="small"
                color="error"
                startIcon={deleting === announcement._id ? <CircularProgress size={16} /> : <DeleteIcon />}
                onClick={() => handleDelete(announcement._id)}
                disabled={deleting === announcement._id}
              >
                Delete
              </Button>
            )}
          </CardActions>
        </Card>
      </Fade>
    );
  };

  // Loading skeleton
  const renderSkeleton = () => (
    <Box>
      {[1, 2, 3].map((i) => (
        <Card key={i} sx={{ mb: 2 }}>
          <CardContent>
            <Skeleton variant="rectangular" width={100} height={24} sx={{ mb: 2 }} />
            <Skeleton variant="text" width="60%" height={32} />
            <Skeleton variant="text" width="100%" />
            <Skeleton variant="text" width="80%" />
          </CardContent>
        </Card>
      ))}
    </Box>
  );

  return (
    <Box sx={{ width: "100%", typography: "body1" }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box display="flex" alignItems="center" gap={2}>
          <AnnouncementIcon fontSize="large" color="primary" />
          <Box>
            <Typography variant="h4" fontWeight={600}>
              Announcements
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {isAdmin ? 'Manage and send announcements to users' : 'View announcements from administrators'}
            </Typography>
          </Box>
        </Box>
        <Box display="flex" gap={1}>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchAnnouncements} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          {isAdmin && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
            >
              New Announcement
            </Button>
          )}
        </Box>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Announcements List */}
      {loading ? (
        renderSkeleton()
      ) : announcements.length === 0 ? (
        <Paper
          sx={{
            p: 6,
            textAlign: 'center',
            bgcolor: theme.palette.mode === 'dark' 
              ? 'rgba(255,255,255,0.05)' 
              : 'rgba(0,0,0,0.02)',
          }}
        >
          <AnnouncementIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            No Announcements
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isAdmin 
              ? 'You haven\'t sent any announcements yet. Click "New Announcement" to create one.'
              : 'You don\'t have any announcements at this time.'}
          </Typography>
        </Paper>
      ) : (
        <Box>
          {announcements.map(renderAnnouncementCard)}

          {/* Pagination */}
          {totalPages > 1 && (
            <Box display="flex" justifyContent="center" mt={4}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, value) => setPage(value)}
                color="primary"
              />
            </Box>
          )}
        </Box>
      )}

      {/* Create Announcement Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <SendIcon color="primary" />
            <Typography variant="h6">Create Announcement</Typography>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={3}>
            {/* Title */}
            <Grid item xs={12}>
              <TextField
                label="Title"
                fullWidth
                required
                value={formData.title}
                onChange={handleInputChange('title')}
                error={!!formErrors.title}
                helperText={formErrors.title}
                placeholder="Enter announcement title"
                inputProps={{ maxLength: 200 }}
              />
            </Grid>

            {/* Message */}
            <Grid item xs={12}>
              <TextField
                label="Message"
                fullWidth
                required
                multiline
                rows={6}
                value={formData.message}
                onChange={handleInputChange('message')}
                error={!!formErrors.message}
                helperText={formErrors.message || `${formData.message.length}/5000 characters`}
                placeholder="Enter announcement message..."
                inputProps={{ maxLength: 5000 }}
              />
            </Grid>

            {/* Target Roles */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Target Audience *
              </Typography>
              <FormGroup row>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.targetRoles.includes('agent')}
                      onChange={() => handleRoleToggle('agent')}
                    />
                  }
                  label="Agents"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.targetRoles.includes('affiliate_manager')}
                      onChange={() => handleRoleToggle('affiliate_manager')}
                    />
                  }
                  label="Affiliate Managers"
                />
              </FormGroup>
              {formErrors.targetRoles && (
                <Typography variant="caption" color="error">
                  {formErrors.targetRoles}
                </Typography>
              )}
            </Grid>

            {/* Priority */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={formData.priority}
                  label="Priority"
                  onChange={handleInputChange('priority')}
                >
                  <MenuItem value="low">
                    <Box display="flex" alignItems="center" gap={1}>
                      <CheckIcon fontSize="small" />
                      Low
                    </Box>
                  </MenuItem>
                  <MenuItem value="medium">
                    <Box display="flex" alignItems="center" gap={1}>
                      <InfoIcon fontSize="small" color="info" />
                      Medium
                    </Box>
                  </MenuItem>
                  <MenuItem value="high">
                    <Box display="flex" alignItems="center" gap={1}>
                      <WarningIcon fontSize="small" color="warning" />
                      High
                    </Box>
                  </MenuItem>
                  <MenuItem value="urgent">
                    <Box display="flex" alignItems="center" gap={1}>
                      <ErrorIcon fontSize="small" color="error" />
                      Urgent
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setCreateDialogOpen(false)} disabled={creating}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={creating}
            startIcon={creating ? <CircularProgress size={16} /> : <SendIcon />}
          >
            {creating ? 'Sending...' : 'Send Announcement'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AnnouncementsPage;

