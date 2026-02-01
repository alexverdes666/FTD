import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  useTheme,
  Fade,
} from '@mui/material';
import {
  Gavel as FineIcon,
  ArrowForward as GoIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { selectUser, selectIsAuthenticated } from '../store/slices/authSlice';
import { getUnacknowledgedFines, acknowledgeFine } from '../services/agentFines';
import chatService from '../services/chatService';

const FineNotificationPopup = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);

  const [open, setOpen] = useState(false);
  const [fines, setFines] = useState([]);
  const [acknowledging, setAcknowledging] = useState(false);

  const isAgent = user?.role === 'agent';

  // Fetch unacknowledged fines on mount
  const fetchUnacknowledgedFines = useCallback(async () => {
    if (!isAuthenticated || !isAgent) return;

    try {
      const data = await getUnacknowledgedFines();
      if (data && data.length > 0) {
        setFines(data);
        setOpen(true);
      }
    } catch (err) {
      console.error('Error fetching unacknowledged fines:', err);
    }
  }, [isAuthenticated, isAgent]);

  // Handle real-time fine_created event
  const handleFineCreated = useCallback((data) => {
    if (data?.fine) {
      setFines(prev => {
        const exists = prev.some(f => f._id === data.fine._id);
        if (exists) return prev;
        const updated = [data.fine, ...prev];
        setOpen(true);
        return updated;
      });
    }
  }, []);

  // Set up Socket.IO listener and fetch initial data
  useEffect(() => {
    if (!isAuthenticated || !isAgent) return;

    fetchUnacknowledgedFines();

    chatService.on('fine_created', handleFineCreated);
    const socket = chatService.socket;
    if (socket) {
      socket.on('fine_created', handleFineCreated);
    }

    return () => {
      chatService.off('fine_created', handleFineCreated);
      if (socket) {
        socket.off('fine_created', handleFineCreated);
      }
    };
  }, [isAuthenticated, isAgent, fetchUnacknowledgedFines, handleFineCreated]);

  // Acknowledge the current fine and show next or close
  const handleAcknowledge = async (goToPayroll = false) => {
    if (fines.length === 0) return;

    const currentFine = fines[0];

    try {
      setAcknowledging(true);
      await acknowledgeFine(currentFine._id);

      const remaining = fines.slice(1);
      if (remaining.length === 0) {
        setOpen(false);
        setFines([]);
      } else {
        setFines(remaining);
      }

      if (goToPayroll) {
        navigate('/payroll');
      }
    } catch (err) {
      console.error('Error acknowledging fine:', err);
    } finally {
      setAcknowledging(false);
    }
  };

  if (!isAgent || fines.length === 0) {
    return null;
  }

  const currentFine = fines[0];

  return (
    <Dialog
      open={open}
      maxWidth="xs"
      fullWidth
      TransitionComponent={Fade}
      transitionDuration={300}
      disableEscapeKeyDown
      onClose={(event, reason) => {
        // Prevent closing by backdrop click or escape
        if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
      }}
      PaperProps={{
        elevation: 12,
        sx: {
          borderRadius: 3,
          overflow: 'hidden',
        }
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          background: `linear-gradient(135deg, ${theme.palette.error.main} 0%, ${theme.palette.error.dark} 100%)`,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          py: 2,
        }}
      >
        <FineIcon sx={{ fontSize: 28 }} />
        <Typography variant="h6" component="span" sx={{ fontWeight: 600 }}>
          Fine Notification
        </Typography>
        {fines.length > 1 && (
          <Typography
            variant="caption"
            sx={{
              ml: 'auto',
              bgcolor: 'rgba(255,255,255,0.2)',
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
            }}
          >
            +{fines.length - 1} more
          </Typography>
        )}
      </DialogTitle>

      <DialogContent sx={{ py: 4, textAlign: 'center' }}>
        <Box sx={{ mb: 2 }}>
          <FineIcon sx={{ fontSize: 56, color: 'error.main', opacity: 0.8 }} />
        </Box>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          You've been fined
        </Typography>
        <Typography variant="h4" color="error.main" fontWeight={700} sx={{ my: 1 }}>
          ${currentFine.amount}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
          {currentFine.reason}
        </Typography>
        {currentFine.imposedBy?.fullName && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            Imposed by: {currentFine.imposedBy.fullName}
          </Typography>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2.5, gap: 1, justifyContent: 'center' }}>
        <Button
          onClick={() => handleAcknowledge(false)}
          disabled={acknowledging}
          variant="outlined"
          color="inherit"
          startIcon={acknowledging ? <CircularProgress size={16} /> : <CloseIcon />}
        >
          Dismiss
        </Button>
        <Button
          onClick={() => handleAcknowledge(true)}
          disabled={acknowledging}
          variant="contained"
          color="error"
          endIcon={acknowledging ? <CircularProgress size={16} color="inherit" /> : <GoIcon />}
        >
          Go to Fine
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FineNotificationPopup;
