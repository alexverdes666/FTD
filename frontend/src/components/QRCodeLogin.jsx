import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  Alert,
  LinearProgress,
  Fade,
  Chip
} from '@mui/material';
import { QRCodeSVG } from 'qrcode.react';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import TimerIcon from '@mui/icons-material/Timer';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import api from '../services/api';

const QRCodeLogin = ({ 
  open, 
  onClose, 
  userId,
  onLoginSuccess,
  onFallbackTo2FA 
}) => {
  const [sessionToken, setSessionToken] = useState(null);
  const [qrUrl, setQrUrl] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [status, setStatus] = useState('loading'); // loading, pending, approved, rejected, expired, error
  const [error, setError] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(300); // 5 minutes in seconds

  // Create a new session when dialog opens
  const createSession = useCallback(async () => {
    try {
      setStatus('loading');
      setError('');
      
      const response = await api.post('/qr-auth/create-session', { userId });
      
      if (response.data.success) {
        setSessionToken(response.data.data.sessionToken);
        setQrUrl(response.data.data.qrUrl);
        setExpiresAt(new Date(response.data.data.expiresAt));
        setStatus('pending');
        
        // Calculate initial time remaining
        const remaining = Math.floor((new Date(response.data.data.expiresAt) - new Date()) / 1000);
        setTimeRemaining(remaining > 0 ? remaining : 0);
      } else {
        setStatus('error');
        setError(response.data.message || 'Failed to create QR session');
      }
    } catch (err) {
      console.error('Error creating QR session:', err);
      setStatus('error');
      setError(err.response?.data?.message || 'Failed to create QR session');
    }
  }, [userId]);

  // Poll for session status
  useEffect(() => {
    let pollInterval;
    
    if (open && sessionToken && status === 'pending') {
      pollInterval = setInterval(async () => {
        try {
          const response = await api.get(`/qr-auth/session-status/${sessionToken}`);
          
          if (response.data.success) {
            const { status: sessionStatus, token, user } = response.data.data;
            
            if (sessionStatus === 'approved') {
              setStatus('approved');
              clearInterval(pollInterval);
              
              // Small delay for visual feedback
              setTimeout(() => {
                onLoginSuccess(token, user);
              }, 1500);
            } else if (sessionStatus === 'rejected') {
              setStatus('rejected');
              clearInterval(pollInterval);
            } else if (sessionStatus === 'expired') {
              setStatus('expired');
              clearInterval(pollInterval);
            }
          }
        } catch (err) {
          console.error('Error polling session status:', err);
        }
      }, 2000); // Poll every 2 seconds
    }
    
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [open, sessionToken, status, onLoginSuccess]);

  // Timer countdown
  useEffect(() => {
    let timerInterval;
    
    if (status === 'pending' && timeRemaining > 0) {
      timerInterval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setStatus('expired');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [status, timeRemaining]);

  // Create session when dialog opens
  useEffect(() => {
    if (open && userId) {
      createSession();
    }
    
    // Reset state when dialog closes
    if (!open) {
      setSessionToken(null);
      setQrUrl(null);
      setExpiresAt(null);
      setStatus('loading');
      setError('');
      setTimeRemaining(300);
    }
  }, [open, userId, createSession]);

  const handleRetry = () => {
    createSession();
  };

  const handleClose = () => {
    if (status !== 'approved') {
      onClose();
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <Box display="flex" flexDirection="column" alignItems="center" py={4}>
            <CircularProgress size={48} />
            <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
              Generating QR code...
            </Typography>
          </Box>
        );

      case 'pending':
        return (
          <Fade in>
            <Box display="flex" flexDirection="column" alignItems="center">
              <Box 
                sx={{ 
                  p: 2, 
                  bgcolor: 'white', 
                  borderRadius: 2,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                  mb: 3
                }}
              >
                <QRCodeSVG 
                  value={qrUrl} 
                  size={200}
                  level="H"
                  includeMargin
                />
              </Box>
              
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <PhoneIphoneIcon color="primary" />
                <Typography variant="body1" color="text.secondary">
                  Scan with your registered iPhone
                </Typography>
              </Box>
              
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <TimerIcon color={timeRemaining < 60 ? 'error' : 'action'} />
                <Typography 
                  variant="h5" 
                  color={timeRemaining < 60 ? 'error.main' : 'text.primary'}
                  fontFamily="monospace"
                >
                  {formatTime(timeRemaining)}
                </Typography>
              </Box>
              
              <LinearProgress 
                variant="determinate" 
                value={(timeRemaining / 300) * 100}
                sx={{ 
                  width: '100%', 
                  height: 6, 
                  borderRadius: 3,
                  mb: 2
                }}
              />
              
              <Alert severity="info" sx={{ width: '100%' }}>
                <Typography variant="body2">
                  Open your camera app on your registered iPhone and scan the QR code.
                  Only your authorized device can approve this login.
                </Typography>
              </Alert>
            </Box>
          </Fade>
        );

      case 'approved':
        return (
          <Fade in>
            <Box display="flex" flexDirection="column" alignItems="center" py={4}>
              <CheckCircleIcon sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
              <Typography variant="h5" color="success.main" fontWeight="bold">
                Login Approved!
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                Redirecting you now...
              </Typography>
              <CircularProgress size={24} sx={{ mt: 2 }} />
            </Box>
          </Fade>
        );

      case 'rejected':
        return (
          <Fade in>
            <Box display="flex" flexDirection="column" alignItems="center" py={4}>
              <CancelIcon sx={{ fontSize: 80, color: 'error.main', mb: 2 }} />
              <Typography variant="h5" color="error.main" fontWeight="bold">
                Login Rejected
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mt: 1, mb: 3 }}>
                The login attempt was rejected from your device.
              </Typography>
              <Button variant="contained" onClick={handleRetry}>
                Try Again
              </Button>
            </Box>
          </Fade>
        );

      case 'expired':
        return (
          <Fade in>
            <Box display="flex" flexDirection="column" alignItems="center" py={4}>
              <TimerIcon sx={{ fontSize: 80, color: 'warning.main', mb: 2 }} />
              <Typography variant="h5" color="warning.main" fontWeight="bold">
                Session Expired
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mt: 1, mb: 3 }}>
                The QR code has expired. Please generate a new one.
              </Typography>
              <Button variant="contained" onClick={handleRetry}>
                Generate New QR Code
              </Button>
            </Box>
          </Fade>
        );

      case 'error':
        return (
          <Fade in>
            <Box display="flex" flexDirection="column" alignItems="center" py={4}>
              <Alert severity="error" sx={{ width: '100%', mb: 3 }}>
                {error}
              </Alert>
              <Button variant="contained" onClick={handleRetry}>
                Try Again
              </Button>
            </Box>
          </Fade>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="sm" 
      fullWidth
      disableEscapeKeyDown={status === 'pending' || status === 'approved'}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <QrCodeScannerIcon color="primary" />
          <Typography variant="h6">
            Scan to Approve Login
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        {renderContent()}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
        <Button 
          onClick={onFallbackTo2FA} 
          color="inherit"
          disabled={status === 'approved'}
          size="small"
        >
          Use 2FA Code Instead
        </Button>
        <Button 
          onClick={handleClose} 
          disabled={status === 'approved'}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default QRCodeLogin;

