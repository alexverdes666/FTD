import React, { useState } from 'react';
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
  Link,
  Divider
} from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';
import { toast } from 'react-hot-toast';

const TwoFactorVerification = ({ 
  open, 
  onClose, 
  onVerify, 
  loading = false,
  error = '' 
}) => {
  const [verificationCode, setVerificationCode] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [localError, setLocalError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    
    if (!verificationCode) {
      setLocalError('Please enter a verification code');
      return;
    }

    if (!useBackupCode && verificationCode.length !== 6) {
      setLocalError('Please enter a valid 6-digit code');
      return;
    }

    setLocalError('');
    setIsVerifying(true);
    onVerify(verificationCode, useBackupCode);
  };

  // Reset isVerifying when error is received (wrong code)
  React.useEffect(() => {
    if (error) {
      setIsVerifying(false);
    }
  }, [error]);

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open) {
      setVerificationCode('');
      setUseBackupCode(false);
      setLocalError('');
      setIsVerifying(false);
    }
  }, [open]);

  const handleClose = () => {
    setVerificationCode('');
    setUseBackupCode(false);
    setLocalError('');
    setIsVerifying(false);
    onClose();
  };

  const handleCodeChange = (e) => {
    let value = e.target.value;
    
    if (!useBackupCode) {
      // For TOTP codes, only allow digits and max 6 characters
      value = value.replace(/\D/g, '').slice(0, 6);
    } else {
      // For backup codes, allow alphanumeric and max 8 characters
      value = value.toUpperCase().slice(0, 8);
    }
    
    setVerificationCode(value);
    setLocalError('');

    // Auto-submit when code is complete
    const requiredLength = useBackupCode ? 8 : 6;
    if (value.length === requiredLength && !loading && !isVerifying) {
      setIsVerifying(true);
      // Small delay to show the complete code before submitting
      setTimeout(() => {
        onVerify(value, useBackupCode);
      }, 100);
    }
  };

  const toggleBackupCode = () => {
    setUseBackupCode(!useBackupCode);
    setVerificationCode('');
    setLocalError('');
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="xs" 
      fullWidth
      disableEscapeKeyDown={loading}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <SecurityIcon color="primary" />
          <Typography variant="h6">
            Two-Factor Authentication
          </Typography>
        </Box>
      </DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" paragraph>
            {useBackupCode
              ? 'Enter one of your backup codes to continue'
              : 'Enter the 6-digit code from your authenticator app'}
          </Typography>
          
          <TextField
            fullWidth
            label={useBackupCode ? 'Backup Code' : 'Verification Code'}
            value={verificationCode}
            onChange={handleCodeChange}
            placeholder={useBackupCode ? 'XXXXXXXX' : '000000'}
            inputProps={{
              maxLength: useBackupCode ? 8 : 6,
              style: { 
                fontSize: '24px', 
                textAlign: 'center', 
                letterSpacing: useBackupCode ? '4px' : '8px',
                fontFamily: 'monospace'
              }
            }}
            sx={{ my: 2 }}
            autoFocus
            disabled={loading}
          />

          {(error || localError) && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error || localError}
            </Alert>
          )}

          <Divider sx={{ my: 2 }} />

          <Box textAlign="center">
            <Link
              component="button"
              type="button"
              variant="body2"
              onClick={toggleBackupCode}
              disabled={loading}
              sx={{ cursor: 'pointer' }}
            >
              {useBackupCode
                ? 'Use authenticator app code instead'
                : "Lost your device? Use a backup code"}
            </Link>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading || !verificationCode || (!useBackupCode && verificationCode.length !== 6)}
          >
            {loading ? <CircularProgress size={24} /> : 'Verify'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default TwoFactorVerification;

