import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Divider,
  Chip,
  Stack,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  InputAdornment
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import LockIcon from '@mui/icons-material/Lock';
import DevicesIcon from '@mui/icons-material/Devices';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import api from '../services/api';

// Generate a unique device ID that persists in localStorage
const getDeviceId = () => {
  let deviceId = localStorage.getItem('qr_auth_device_id');
  if (!deviceId) {
    // Generate a unique ID based on random bytes and timestamp
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    deviceId = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('') + 
               '-' + Date.now().toString(36);
    localStorage.setItem('qr_auth_device_id', deviceId);
  }
  return deviceId;
};

// Get device info
const getDeviceInfo = () => {
  const ua = navigator.userAgent;
  const isIPhone = /iPhone/.test(ua);
  const isIPad = /iPad/.test(ua);
  const isAndroid = /Android/.test(ua);
  
  let deviceName = 'Unknown Device';
  
  if (isIPhone) {
    const match = ua.match(/iPhone[^;)]+/);
    deviceName = match ? match[0] : 'iPhone';
  } else if (isIPad) {
    deviceName = 'iPad';
  } else if (isAndroid) {
    const match = ua.match(/Android[^;]+;[^;)]+/);
    deviceName = match ? match[0] : 'Android Device';
  }
  
  return {
    deviceId: getDeviceId(),
    deviceName,
    userAgent: ua,
    platform: navigator.platform,
    timestamp: new Date().toISOString()
  };
};

const MobileApprovalPage = () => {
  const { sessionToken } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState('loading'); // loading, pending, approved, rejected, expired, error, register
  const [error, setError] = useState('');
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const deviceInfo = getDeviceInfo();

  // Fetch session details (with auto-approval if device matches)
  const fetchSession = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      // Pass device info as query params for auto-approval
      const response = await api.get(`/qr-auth/session/${sessionToken}`, {
        params: {
          deviceId: deviceInfo.deviceId,
          deviceInfo: deviceInfo.deviceName
        }
      });
      
      if (response.data.success) {
        // Check if auto-approved
        if (response.data.autoApproved) {
          setStatus('approved');
          return;
        }
        
        setSession(response.data.data);
        setStatus('pending');
      }
    } catch (err) {
      console.error('Error fetching session:', err);
      const errorMsg = err.response?.data?.message || 'Failed to load session';
      
      if (errorMsg.includes('expired')) {
        setStatus('expired');
      } else if (errorMsg.includes('already been')) {
        setStatus('already_resolved');
        setError(errorMsg);
      } else {
        setStatus('error');
        setError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  }, [sessionToken, deviceInfo.deviceId, deviceInfo.deviceName]);

  useEffect(() => {
    if (sessionToken) {
      fetchSession();
    }
  }, [sessionToken, fetchSession]);

  const handleApprove = async () => {
    try {
      setActionLoading(true);
      setError('');
      
      const response = await api.post('/qr-auth/approve', {
        sessionToken,
        deviceId: deviceInfo.deviceId,
        deviceInfo: deviceInfo.deviceName
      });
      
      if (response.data.success) {
        setStatus('approved');
      }
    } catch (err) {
      console.error('Error approving session:', err);
      const errorMsg = err.response?.data?.message || 'Failed to approve login';
      
      if (err.response?.data?.requiresRegistration) {
        setShowRegisterDialog(true);
      } else {
        setError(errorMsg);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    try {
      setActionLoading(true);
      setError('');
      
      const response = await api.post('/qr-auth/reject', {
        sessionToken,
        deviceId: deviceInfo.deviceId
      });
      
      if (response.data.success) {
        setStatus('rejected');
      }
    } catch (err) {
      console.error('Error rejecting session:', err);
      setError(err.response?.data?.message || 'Failed to reject login');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegisterDevice = async () => {
    if (!password) {
      setRegisterError('Please enter your password');
      return;
    }

    try {
      setRegistering(true);
      setRegisterError('');
      
      const response = await api.post('/qr-auth/register-device', {
        userId: session.user?._id || session.userId,
        password,
        deviceId: deviceInfo.deviceId,
        deviceInfo: deviceInfo.deviceName
      });
      
      if (response.data.success) {
        setShowRegisterDialog(false);
        setPassword('');
        // Now approve the session
        await handleApprove();
      }
    } catch (err) {
      console.error('Error registering device:', err);
      setRegisterError(err.response?.data?.message || 'Failed to register device');
    } finally {
      setRegistering(false);
    }
  };

  const formatTimeAgo = (dateString) => {
    const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
    if (seconds < 60) return `${seconds} seconds ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'More than an hour ago';
  };

  if (loading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="100vh"
        bgcolor="#f5f5f5"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box 
      minHeight="100vh" 
      bgcolor="#f5f5f5" 
      py={3} 
      px={2}
      display="flex"
      flexDirection="column"
      alignItems="center"
    >
      <Box maxWidth="400px" width="100%">
        {/* Header */}
        <Box textAlign="center" mb={3}>
          <LockIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            Login Approval
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Someone is trying to log in to your account
          </Typography>
        </Box>

        {/* Status Cards */}
        {status === 'pending' && session && (
          <Card elevation={3} sx={{ borderRadius: 2 }}>
            <CardContent>
              {/* User Info */}
              <Box mb={3}>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  {session.user?.fullName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {session.user?.email}
                </Typography>
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Login Details */}
              <Stack spacing={2} mb={3}>
                <Box display="flex" alignItems="center" gap={1}>
                  <LocationOnIcon color="action" fontSize="small" />
                  <Typography variant="body2" color="text.secondary">
                    IP: {session.loginIP}
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={1}>
                  <DevicesIcon color="action" fontSize="small" />
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {session.loginUserAgent?.substring(0, 50)}...
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={1}>
                  <AccessTimeIcon color="action" fontSize="small" />
                  <Typography variant="body2" color="text.secondary">
                    {formatTimeAgo(session.createdAt)}
                  </Typography>
                </Box>
              </Stack>

              {/* Device Info */}
              <Alert severity="info" sx={{ mb: 3 }}>
                <Box display="flex" alignItems="center" gap={1}>
                  <PhoneIphoneIcon fontSize="small" />
                  <Typography variant="body2">
                    Approving from: {deviceInfo.deviceName}
                  </Typography>
                </Box>
              </Alert>

              {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {error}
                </Alert>
              )}

              {/* Action Buttons */}
              <Stack spacing={2}>
                <Button
                  variant="contained"
                  color="success"
                  size="large"
                  fullWidth
                  onClick={handleApprove}
                  disabled={actionLoading}
                  startIcon={actionLoading ? <CircularProgress size={20} color="inherit" /> : <CheckCircleIcon />}
                  sx={{ py: 1.5, fontWeight: 'bold' }}
                >
                  {actionLoading ? 'Approving...' : 'Approve Login'}
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  size="large"
                  fullWidth
                  onClick={handleReject}
                  disabled={actionLoading}
                  startIcon={<CancelIcon />}
                  sx={{ py: 1.5 }}
                >
                  Reject Login
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}

        {status === 'approved' && (
          <Card elevation={3} sx={{ borderRadius: 2 }}>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <CheckCircleIcon sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
              <Typography variant="h5" color="success.main" fontWeight="bold" gutterBottom>
                Login Approved!
              </Typography>
              <Typography variant="body1" color="text.secondary">
                You can close this page now.
              </Typography>
            </CardContent>
          </Card>
        )}

        {status === 'rejected' && (
          <Card elevation={3} sx={{ borderRadius: 2 }}>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <CancelIcon sx={{ fontSize: 80, color: 'error.main', mb: 2 }} />
              <Typography variant="h5" color="error.main" fontWeight="bold" gutterBottom>
                Login Rejected
              </Typography>
              <Typography variant="body1" color="text.secondary">
                The login attempt has been denied.
              </Typography>
            </CardContent>
          </Card>
        )}

        {status === 'expired' && (
          <Card elevation={3} sx={{ borderRadius: 2 }}>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <AccessTimeIcon sx={{ fontSize: 80, color: 'warning.main', mb: 2 }} />
              <Typography variant="h5" color="warning.main" fontWeight="bold" gutterBottom>
                Session Expired
              </Typography>
              <Typography variant="body1" color="text.secondary">
                This QR code has expired. Please scan a new one.
              </Typography>
            </CardContent>
          </Card>
        )}

        {status === 'error' && (
          <Card elevation={3} sx={{ borderRadius: 2 }}>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
              <Button variant="contained" onClick={fetchSession}>
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {status === 'already_resolved' && (
          <Card elevation={3} sx={{ borderRadius: 2 }}>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <Alert severity="info">
                {error}
              </Alert>
            </CardContent>
          </Card>
        )}

        {/* Device Registration Dialog */}
        <Dialog 
          open={showRegisterDialog} 
          onClose={() => setShowRegisterDialog(false)}
          fullWidth
          maxWidth="xs"
        >
          <DialogTitle>
            <Box display="flex" alignItems="center" gap={1}>
              <PhoneIphoneIcon color="primary" />
              <Typography variant="h6">Register This Device</Typography>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" paragraph>
              This device is not registered for QR authentication. Enter your password to register it.
            </Typography>
            
            <Alert severity="warning" sx={{ mb: 2 }}>
              Only register devices you trust and own. This device will be the only one able to approve your logins.
            </Alert>

            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <PhoneIphoneIcon color="action" />
              <Typography variant="body2">
                {deviceInfo.deviceName}
              </Typography>
            </Box>

            <TextField
              fullWidth
              type={showPassword ? 'text' : 'password'}
              label="Your Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={!!registerError}
              helperText={registerError}
              disabled={registering}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button 
              onClick={() => setShowRegisterDialog(false)}
              disabled={registering}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleRegisterDevice}
              disabled={registering || !password}
            >
              {registering ? <CircularProgress size={24} /> : 'Register & Approve'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
};

export default MobileApprovalPage;

