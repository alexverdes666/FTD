import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Alert,
  TextField,
  InputAdornment,
  IconButton
} from '@mui/material';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import LockIcon from '@mui/icons-material/Lock';
import api from '../services/api';

// Generate a unique device ID that persists in localStorage
const getDeviceId = () => {
  let deviceId = localStorage.getItem('qr_auth_device_id');
  if (!deviceId) {
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
  } else {
    deviceName = navigator.platform || 'Desktop Browser';
  }
  
  return {
    deviceId: getDeviceId(),
    deviceName,
    userAgent: ua
  };
};

const QRSetupPage = () => {
  const { userId, setupToken } = useParams();
  const navigate = useNavigate();
  
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const deviceInfo = getDeviceInfo();

  const handleRegister = async () => {
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.post('/qr-auth/register-device', {
        userId,
        password,
        deviceId: deviceInfo.deviceId,
        deviceInfo: deviceInfo.deviceName
      });

      if (response.data.success) {
        setSuccess(true);
      }
    } catch (err) {
      console.error('Error registering device:', err);
      setError(err.response?.data?.message || 'Failed to register device');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Box 
        minHeight="100vh" 
        bgcolor="#f5f5f5" 
        py={3} 
        px={2}
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
      >
        <Card elevation={3} sx={{ maxWidth: 400, width: '100%', borderRadius: 2 }}>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <CheckCircleIcon sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
            <Typography variant="h5" color="success.main" fontWeight="bold" gutterBottom>
              Device Registered!
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Your {deviceInfo.deviceName} has been registered for QR authentication.
            </Typography>
            <Alert severity="info" sx={{ mt: 2, textAlign: 'left' }}>
              <Typography variant="body2">
                You can now use this device to approve login requests. 
                When you log in on another device, just scan the QR code with this phone to approve.
              </Typography>
            </Alert>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
              You can close this page now.
            </Typography>
          </CardContent>
        </Card>
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
      justifyContent="center"
    >
      <Card elevation={3} sx={{ maxWidth: 400, width: '100%', borderRadius: 2 }}>
        <CardContent>
          <Box textAlign="center" mb={3}>
            <LockIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
            <Typography variant="h5" fontWeight="bold" gutterBottom>
              Register Device
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Register this device for QR authentication
            </Typography>
          </Box>

          <Alert severity="info" sx={{ mb: 3 }}>
            <Box display="flex" alignItems="center" gap={1}>
              <PhoneIphoneIcon fontSize="small" />
              <Typography variant="body2" fontWeight="medium">
                {deviceInfo.deviceName}
              </Typography>
            </Box>
          </Alert>

          <Typography variant="body2" color="text.secondary" paragraph>
            Enter your account password to register this device. 
            Once registered, only this device can approve your login requests.
          </Typography>

          <TextField
            fullWidth
            type={showPassword ? 'text' : 'password'}
            label="Your Password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
            error={!!error}
            disabled={loading}
            sx={{ mb: 2 }}
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

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Alert severity="warning" sx={{ mb: 3 }}>
            <Typography variant="caption">
              Only register devices you own and trust. 
              This will be the only device that can approve your logins.
            </Typography>
          </Alert>

          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={handleRegister}
            disabled={loading || !password}
            sx={{ py: 1.5 }}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Register This Device'}
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
};

export default QRSetupPage;

