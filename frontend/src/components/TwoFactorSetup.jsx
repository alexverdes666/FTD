import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Paper,
  IconButton,
  Divider
} from '@mui/material';
import { QRCodeSVG } from 'qrcode.react';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SecurityIcon from '@mui/icons-material/Security';
import { useDispatch } from 'react-redux';
import { getMe } from '../store/slices/authSlice';
import api from '../services/api';
import { toast } from 'react-hot-toast';

const TwoFactorSetup = ({ open, onClose, onSuccess }) => {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [setupData, setSetupData] = useState(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (open && !setupData) {
      initiate2FASetup();
    }
    if (open) {
      setVerificationCode('');
      setError('');
      setIsVerifying(false);
    }
  }, [open]);

  const initiate2FASetup = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/two-factor/setup');
      if (response.data.success) {
        setSetupData(response.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to initiate 2FA setup');
      toast.error('Failed to initiate 2FA setup');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (code = verificationCode) => {
    if (!code || code.length !== 6) {
      setError('Please enter a valid 6-digit code');
      setIsVerifying(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.post('/two-factor/verify-setup', {
        token: code
      });
      if (response.data.success) {
        toast.success('2FA enabled successfully!');
        
        // Refresh user data to update twoFactorEnabled status
        await dispatch(getMe());
        
        handleClose();
        
        // Call success callback
        if (onSuccess) {
          onSuccess();
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid verification code');
      toast.error('Invalid verification code');
      setIsVerifying(false);
      setVerificationCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleCopySecret = () => {
    navigator.clipboard.writeText(setupData.secret);
    setCopiedSecret(true);
    toast.success('Secret key copied!');
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const handleClose = () => {
    setSetupData(null);
    setVerificationCode('');
    setError('');
    setCopiedSecret(false);
    setIsVerifying(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <SecurityIcon color="primary" />
          <Typography variant="h6">Enable 2FA</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        {loading && !setupData ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : setupData ? (
          <Box>
            {/* Step 1: QR Code */}
            <Typography variant="body1" gutterBottom>
              <strong>1. Scan this QR code</strong> with Google Authenticator or Authy:
            </Typography>
            <Box display="flex" justifyContent="center" my={3}>
              <Paper elevation={3} sx={{ p: 2, borderRadius: 2 }}>
                <QRCodeSVG value={setupData.otpauthUrl} size={200} />
              </Paper>
            </Box>
            
            {/* Manual entry option */}
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Or enter this code manually:
            </Typography>
            <Box display="flex" alignItems="center" gap={1} mb={3}>
              <TextField
                fullWidth
                value={setupData.secret}
                InputProps={{
                  readOnly: true,
                  style: { fontFamily: 'monospace', fontSize: '14px' }
                }}
                size="small"
              />
              <IconButton onClick={handleCopySecret} color="primary">
                {copiedSecret ? <CheckCircleIcon /> : <ContentCopyIcon />}
              </IconButton>
            </Box>

            <Divider sx={{ my: 3 }} />

            {/* Step 2: Verify */}
            <Typography variant="body1" gutterBottom>
              <strong>2. Enter the 6-digit code</strong> from your app:
            </Typography>
            <TextField
              fullWidth
              value={verificationCode}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                setVerificationCode(value);
                setError('');

                // Auto-submit when 6 digits are entered
                if (value.length === 6 && !loading && !isVerifying) {
                  setIsVerifying(true);
                  // Small delay to show the complete code before submitting
                  setTimeout(() => {
                    handleVerify(value);
                  }, 100);
                }
              }}
              placeholder="000000"
              inputProps={{
                maxLength: 6,
                style: { 
                  fontSize: '28px', 
                  textAlign: 'center', 
                  letterSpacing: '10px',
                  fontFamily: 'monospace'
                }
              }}
              sx={{ my: 2 }}
              autoFocus={!!setupData}
            />

            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}

            <Alert severity="info" sx={{ mt: 2 }}>
              Save your backup codes in your profile after setup
            </Alert>
          </Box>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading || isVerifying}>
          Cancel
        </Button>
        <Button
          onClick={() => handleVerify()}
          variant="contained"
          disabled={loading || isVerifying || !setupData || verificationCode.length !== 6}
        >
          {(loading || isVerifying) ? <CircularProgress size={24} /> : 'Enable 2FA'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TwoFactorSetup;

