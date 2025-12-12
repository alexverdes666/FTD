import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  IconButton,
  Divider,
  CircularProgress,
  Alert,
  useTheme,
  Fade,
  Paper,
} from '@mui/material';
import {
  Campaign as AnnouncementIcon,
  Close as CloseIcon,
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { selectUser, selectIsAuthenticated } from '../store/slices/authSlice';
import announcementService from '../services/announcementService';
import chatService from '../services/chatService';

const AnnouncementPopup = () => {
  const theme = useTheme();
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  
  const [open, setOpen] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dismissing, setDismissing] = useState(false);

  // Check if user can receive announcements
  const canReceiveAnnouncements = user?.role === 'agent' || user?.role === 'affiliate_manager';

  // Fetch unread announcements
  const fetchUnreadAnnouncements = useCallback(async () => {
    if (!isAuthenticated || !canReceiveAnnouncements) return;

    try {
      setLoading(true);
      setError(null);
      const response = await announcementService.getUnreadAnnouncements();
      
      if (response.success && response.data.length > 0) {
        setAnnouncements(response.data);
        setCurrentIndex(0);
        setOpen(true);
      }
    } catch (err) {
      console.error('Error fetching unread announcements:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, canReceiveAnnouncements]);

  // Handle new announcement from Socket.IO
  const handleNewAnnouncement = useCallback((data) => {
    console.log('📢 New announcement received:', data);
    if (data?.announcement) {
      setAnnouncements(prev => {
        // Check if announcement already exists
        const exists = prev.some(a => a._id === data.announcement._id);
        if (exists) return prev;
        
        // Add new announcement to the beginning
        const newAnnouncements = [data.announcement, ...prev];
        
        // If popup is not open, open it and show the new announcement
        if (!open) {
          setCurrentIndex(0);
          setOpen(true);
        }
        
        return newAnnouncements;
      });
    }
  }, [open]);

  // Set up Socket.IO listener and fetch initial announcements
  useEffect(() => {
    if (!isAuthenticated || !canReceiveAnnouncements) return;

    // Fetch unread announcements on mount
    fetchUnreadAnnouncements();

    // Listen for new announcements
    chatService.on('new_announcement', handleNewAnnouncement);

    // Also listen for socket's raw event in case it's not wrapped
    const socket = chatService.socket;
    if (socket) {
      socket.on('new_announcement', handleNewAnnouncement);
    }

    return () => {
      chatService.off('new_announcement', handleNewAnnouncement);
      if (socket) {
        socket.off('new_announcement', handleNewAnnouncement);
      }
    };
  }, [isAuthenticated, canReceiveAnnouncements, fetchUnreadAnnouncements, handleNewAnnouncement]);

  // Handle dismiss current announcement
  const handleDismiss = async () => {
    if (announcements.length === 0) return;

    const currentAnnouncement = announcements[currentIndex];
    
    try {
      setDismissing(true);
      await announcementService.markAsRead(currentAnnouncement._id);
      
      // Remove the dismissed announcement from the list
      const newAnnouncements = announcements.filter((_, index) => index !== currentIndex);
      
      if (newAnnouncements.length === 0) {
        // No more announcements, close the popup
        setOpen(false);
        setAnnouncements([]);
        setCurrentIndex(0);
      } else {
        // Update announcements and adjust current index if needed
        setAnnouncements(newAnnouncements);
        if (currentIndex >= newAnnouncements.length) {
          setCurrentIndex(newAnnouncements.length - 1);
        }
      }
    } catch (err) {
      console.error('Error dismissing announcement:', err);
    } finally {
      setDismissing(false);
    }
  };

  // Handle dismiss all announcements
  const handleDismissAll = async () => {
    try {
      setDismissing(true);
      await announcementService.markAllAsRead();
      setOpen(false);
      setAnnouncements([]);
      setCurrentIndex(0);
    } catch (err) {
      console.error('Error dismissing all announcements:', err);
    } finally {
      setDismissing(false);
    }
  };

  // Navigate to previous announcement
  const handlePrev = () => {
    setCurrentIndex(prev => Math.max(0, prev - 1));
  };

  // Navigate to next announcement
  const handleNext = () => {
    setCurrentIndex(prev => Math.min(announcements.length - 1, prev + 1));
  };

  // Get priority icon and color
  const getPriorityDisplay = (priority) => {
    switch (priority) {
      case 'urgent':
        return { icon: <ErrorIcon />, color: 'error', label: 'Urgent' };
      case 'high':
        return { icon: <WarningIcon />, color: 'warning', label: 'High Priority' };
      case 'medium':
        return { icon: <InfoIcon />, color: 'info', label: 'Medium Priority' };
      case 'low':
        return { icon: <CheckIcon />, color: 'default', label: 'Low Priority' };
      default:
        return { icon: <InfoIcon />, color: 'info', label: 'Medium Priority' };
    }
  };

  // Don't render if user can't receive announcements
  if (!canReceiveAnnouncements || announcements.length === 0) {
    return null;
  }

  const currentAnnouncement = announcements[currentIndex];
  const priorityDisplay = getPriorityDisplay(currentAnnouncement?.priority);

  return (
    <Dialog
      open={open}
      maxWidth="sm"
      fullWidth
      TransitionComponent={Fade}
      transitionDuration={300}
      PaperProps={{
        elevation: 8,
        sx: {
          borderRadius: 2,
          overflow: 'hidden',
        }
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          py: 1.5,
        }}
      >
        <AnnouncementIcon />
        <Typography variant="h6" component="span" sx={{ flexGrow: 1 }}>
          Announcement
        </Typography>
        {announcements.length > 1 && (
          <Chip
            label={`${currentIndex + 1} of ${announcements.length}`}
            size="small"
            sx={{
              bgcolor: 'rgba(255,255,255,0.2)',
              color: 'white',
              fontSize: '0.75rem',
            }}
          />
        )}
        <IconButton
          size="small"
          onClick={() => setOpen(false)}
          sx={{ color: 'white', ml: 1 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ py: 3 }}>
        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : currentAnnouncement ? (
          <Box>
            {/* Priority Badge */}
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <Chip
                icon={priorityDisplay.icon}
                label={priorityDisplay.label}
                color={priorityDisplay.color}
                size="small"
              />
              <Typography variant="caption" color="text.secondary">
                {new Date(currentAnnouncement.createdAt).toLocaleString()}
              </Typography>
            </Box>

            {/* Title */}
            <Typography variant="h5" gutterBottom fontWeight={600}>
              {currentAnnouncement.title}
            </Typography>

            <Divider sx={{ my: 2 }} />

            {/* Message */}
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                bgcolor: theme.palette.mode === 'dark' 
                  ? 'rgba(255,255,255,0.05)' 
                  : 'rgba(0,0,0,0.02)',
                borderRadius: 1,
                maxHeight: 300,
                overflow: 'auto',
              }}
            >
              <Typography
                variant="body1"
                sx={{
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.7,
                }}
              >
                {currentAnnouncement.message}
              </Typography>
            </Paper>

            {/* Sender Info */}
            {currentAnnouncement.createdBy && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                Sent by: {currentAnnouncement.createdBy.fullName}
              </Typography>
            )}
          </Box>
        ) : null}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
        {/* Navigation */}
        <Box display="flex" alignItems="center" gap={1}>
          {announcements.length > 1 && (
            <>
              <IconButton
                onClick={handlePrev}
                disabled={currentIndex === 0}
                size="small"
              >
                <PrevIcon />
              </IconButton>
              <IconButton
                onClick={handleNext}
                disabled={currentIndex === announcements.length - 1}
                size="small"
              >
                <NextIcon />
              </IconButton>
            </>
          )}
        </Box>

        {/* Actions */}
        <Box display="flex" gap={1}>
          {announcements.length > 1 && (
            <Button
              onClick={handleDismissAll}
              disabled={dismissing}
              color="inherit"
            >
              Dismiss All
            </Button>
          )}
          <Button
            onClick={handleDismiss}
            disabled={dismissing}
            variant="contained"
            startIcon={dismissing ? <CircularProgress size={16} /> : <CheckIcon />}
          >
            {dismissing ? 'Dismissing...' : 'Acknowledge'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default AnnouncementPopup;

