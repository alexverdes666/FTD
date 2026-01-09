import React, { useState, useRef, useEffect } from 'react';
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
  Link,
  Divider,
  keyframes
} from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';

// Shake animation keyframes
const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-6px); }
  20%, 40%, 60%, 80% { transform: translateX(6px); }
`;

const TwoFactorVerification = ({ 
  open, 
  onClose, 
  onVerify, 
  loading = false,
  error = '' 
}) => {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [backupCode, setBackupCode] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [localError, setLocalError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [hasError, setHasError] = useState(false);
  
  const inputRefs = useRef([]);

  const verificationCode = digits.join('');

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    
    const code = useBackupCode ? backupCode : verificationCode;
    
    if (!code) {
      triggerErrorEffect();
      return;
    }

    if (!useBackupCode && code.length !== 6) {
      triggerErrorEffect();
      return;
    }

    setLocalError('');
    setIsVerifying(true);
    onVerify(code, useBackupCode);
  };

  const triggerErrorEffect = () => {
    setHasError(true);
    // Clear error state after animation completes
    setTimeout(() => {
      setHasError(false);
    }, 500);
  };

  // Reset and clear code when error is received (wrong code)
  useEffect(() => {
    if (error) {
      setIsVerifying(false);
      triggerErrorEffect();
      setDigits(['', '', '', '', '', '']);
      setBackupCode('');
      // Focus first input after error
      setTimeout(() => {
        if (inputRefs.current[0] && !useBackupCode) {
          inputRefs.current[0].focus();
        }
      }, 100);
    }
  }, [error, useBackupCode]);

  // Reset state when dialog opens and focus first input
  useEffect(() => {
    if (open) {
      setDigits(['', '', '', '', '', '']);
      setBackupCode('');
      setUseBackupCode(false);
      setLocalError('');
      setIsVerifying(false);
      setHasError(false);
      // Focus first input when dialog opens
      setTimeout(() => {
        if (inputRefs.current[0]) {
          inputRefs.current[0].focus();
        }
      }, 100);
    }
  }, [open]);

  const handleClose = () => {
    setDigits(['', '', '', '', '', '']);
    setBackupCode('');
    setUseBackupCode(false);
    setLocalError('');
    setIsVerifying(false);
    setHasError(false);
    onClose();
  };

  const handleDigitChange = (index, value) => {
    // Only allow single digit
    const digit = value.replace(/\D/g, '').slice(-1);
    
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);
    setLocalError('');
    setHasError(false);

    // Auto-advance to next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits are filled
    const fullCode = newDigits.join('');
    if (fullCode.length === 6 && !loading && !isVerifying) {
      setIsVerifying(true);
      setTimeout(() => {
        onVerify(fullCode, false);
      }, 100);
    }
  };

  const handleDigitKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        // If current input is empty, go to previous and clear it
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        setDigits(newDigits);
        inputRefs.current[index - 1]?.focus();
        e.preventDefault();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
      e.preventDefault();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
      e.preventDefault();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    
    if (pastedData) {
      const newDigits = ['', '', '', '', '', ''];
      for (let i = 0; i < pastedData.length; i++) {
        newDigits[i] = pastedData[i];
      }
      setDigits(newDigits);
      setLocalError('');
      setHasError(false);

      // Focus the next empty input or last input
      const nextEmptyIndex = newDigits.findIndex(d => !d);
      if (nextEmptyIndex !== -1) {
        inputRefs.current[nextEmptyIndex]?.focus();
      } else {
        inputRefs.current[5]?.focus();
        // Auto-submit if all 6 digits pasted
        if (pastedData.length === 6 && !loading && !isVerifying) {
          setIsVerifying(true);
          setTimeout(() => {
            onVerify(pastedData, false);
          }, 100);
        }
      }
    }
  };

  const handleBackupCodeChange = (e) => {
    const value = e.target.value.toUpperCase().slice(0, 8);
    setBackupCode(value);
    setLocalError('');
    setHasError(false);

    // Auto-submit when backup code is complete (8 characters)
    if (value.length === 8 && !loading && !isVerifying) {
      setIsVerifying(true);
      setTimeout(() => {
        onVerify(value, true);
      }, 100);
    }
  };

  const toggleBackupCode = () => {
    setUseBackupCode(!useBackupCode);
    setDigits(['', '', '', '', '', '']);
    setBackupCode('');
    setLocalError('');
    setHasError(false);
  };

  // Get border color based on state
  const getInputBorderColor = (digit) => {
    if (hasError) return 'error.main';
    if (digit) return 'primary.main';
    return 'divider';
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
          
          {useBackupCode ? (
            <TextField
              fullWidth
              label="Backup Code"
              value={backupCode}
              onChange={handleBackupCodeChange}
              placeholder="XXXXXXXX"
              error={hasError}
              inputProps={{
                maxLength: 8,
                style: { 
                  fontSize: '24px', 
                  textAlign: 'center', 
                  letterSpacing: '4px',
                  fontFamily: 'monospace'
                }
              }}
              sx={{ 
                my: 2,
                animation: hasError ? `${shake} 0.5s ease-in-out` : 'none'
              }}
              autoFocus
            />
          ) : (
            <Box 
              sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                gap: 1, 
                my: 3,
                animation: hasError ? `${shake} 0.5s ease-in-out` : 'none'
              }}
            >
              {digits.map((digit, index) => (
                <Box
                  key={index}
                  component="input"
                  ref={el => inputRefs.current[index] = el}
                  type="text"
                  inputMode="numeric"
                  value={digit}
                  onChange={(e) => handleDigitChange(index, e.target.value)}
                  onKeyDown={(e) => handleDigitKeyDown(index, e)}
                  onPaste={handlePaste}
                  maxLength={1}
                  sx={{
                    width: '48px',
                    height: '56px',
                    fontSize: '28px',
                    fontWeight: 600,
                    fontFamily: 'monospace',
                    textAlign: 'center',
                    border: '2px solid',
                    borderColor: getInputBorderColor(digit),
                    borderRadius: '8px',
                    outline: 'none',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                    backgroundColor: hasError ? 'rgba(211, 47, 47, 0.04)' : 'background.paper',
                    color: 'text.primary',
                    '&:focus': {
                      borderColor: hasError ? 'error.main' : 'primary.main',
                      boxShadow: hasError 
                        ? '0 0 0 3px rgba(211, 47, 47, 0.2)' 
                        : '0 0 0 3px rgba(25, 118, 210, 0.2)',
                    },
                    '&:hover': {
                      borderColor: hasError ? 'error.dark' : 'primary.light',
                    }
                  }}
                />
              ))}
            </Box>
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
            disabled={loading || (useBackupCode ? !backupCode : verificationCode.length !== 6)}
          >
            {loading ? <CircularProgress size={24} /> : 'Verify'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default TwoFactorVerification;
