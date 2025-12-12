import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Grid,
  Paper,
  IconButton
} from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useSelector, useDispatch } from 'react-redux';
import { selectUser, getMe } from '../store/slices/authSlice';
import TwoFactorSetup from './TwoFactorSetup';
import api from '../services/api';
import { toast } from 'react-hot-toast';

const TwoFactorManagement = () => {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const [setupOpen, setSetupOpen] = useState(false);
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newBackupCodes, setNewBackupCodes] = useState(null);
  const [copiedCodes, setCopiedCodes] = useState({});

  const is2FAEnabled = user?.twoFactorEnabled;
  const isAdmin = user?.role === 'admin';

  const handleDisable2FA = async () => {
    if (!password) {
      setError('Password is required');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.post('/two-factor/disable', { password });
      if (response.data.success) {
        toast.success('2FA has been disabled');
        setDisableDialogOpen(false);
        setPassword('');
        
        // Refresh user data to update twoFactorEnabled status
        await dispatch(getMe());
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to disable 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateBackupCodes = async () => {
    if (!password) {
      setError('Password is required');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.post('/two-factor/regenerate-backup-codes', { password });
      if (response.data.success) {
        setNewBackupCodes(response.data.data.backupCodes);
        setPassword('');
        toast.success('New backup codes generated');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to regenerate backup codes');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyBackupCode = (code, index) => {
    navigator.clipboard.writeText(code);
    setCopiedCodes({ ...copiedCodes, [index]: true });
    toast.success('Backup code copied');
    setTimeout(() => {
      setCopiedCodes({ ...copiedCodes, [index]: false });
    }, 2000);
  };

  const handleCopyAllBackupCodes = () => {
    const allCodes = newBackupCodes.join('\n');
    navigator.clipboard.writeText(allCodes);
    toast.success('All backup codes copied to clipboard');
  };

  const handleCloseRegenerateDialog = () => {
    setRegenerateDialogOpen(false);
    setNewBackupCodes(null);
    setPassword('');
    setError('');
  };

  const handleCloseDisableDialog = () => {
    setDisableDialogOpen(false);
    setPassword('');
    setError('');
  };

  if (!isAdmin) {
    return null; // Only show for admins
  }

  return (
    <Box>
      <Card elevation={2}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Box display="flex" alignItems="center" gap={2}>
              <SecurityIcon color={is2FAEnabled ? 'success' : 'warning'} fontSize="large" />
              <Box>
                <Typography variant="h6">
                  Two-Factor Authentication
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Protect your account with 6-digit codes from your phone
                </Typography>
              </Box>
            </Box>
            <Chip
              icon={is2FAEnabled ? <CheckCircleIcon /> : <WarningIcon />}
              label={is2FAEnabled ? 'Active' : 'Not Active'}
              color={is2FAEnabled ? 'success' : 'warning'}
            />
          </Box>

          {is2FAEnabled ? (
            <Box>
              <Alert severity="success" sx={{ mb: 2 }}>
                ✓ Your account is secured with 2FA
              </Alert>
              <Box display="flex" gap={2} flexWrap="wrap">
                <Button
                  variant="outlined"
                  onClick={() => setRegenerateDialogOpen(true)}
                >
                  Get New Backup Codes
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  onClick={() => setDisableDialogOpen(true)}
                >
                  Disable 2FA
                </Button>
              </Box>
            </Box>
          ) : (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                Recommended: Enable 2FA to protect your admin account
              </Alert>
              <Button
                variant="contained"
                size="large"
                startIcon={<SecurityIcon />}
                onClick={() => setSetupOpen(true)}
              >
                Enable 2FA
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Setup Dialog */}
      <TwoFactorSetup
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        onSuccess={() => {
          toast.success('2FA enabled successfully');
          window.location.reload();
        }}
      />

      {/* Disable 2FA Dialog */}
      <Dialog open={disableDialogOpen} onClose={handleCloseDisableDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Disabling 2FA will make your account less secure. Are you sure you want to continue?
          </Alert>
          <TextField
            fullWidth
            type="password"
            label="Enter your password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
            sx={{ mt: 2 }}
            autoFocus
          />
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDisableDialog} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleDisable2FA}
            color="error"
            variant="contained"
            disabled={loading || !password}
          >
            {loading ? <CircularProgress size={24} /> : 'Disable 2FA'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Regenerate Backup Codes Dialog */}
      <Dialog open={regenerateDialogOpen} onClose={handleCloseRegenerateDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Regenerate Backup Codes</DialogTitle>
        <DialogContent>
          {!newBackupCodes ? (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>
                This will invalidate your old backup codes and generate new ones. Make sure to save the new codes.
              </Alert>
              <TextField
                fullWidth
                type="password"
                label="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                sx={{ mt: 2 }}
                autoFocus
              />
              {error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {error}
                </Alert>
              )}
            </>
          ) : (
            <>
              <Alert severity="success" sx={{ mb: 2 }}>
                New backup codes generated successfully! Save these codes in a safe place.
              </Alert>
              <Box display="flex" justifyContent="flex-end" mb={2}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ContentCopyIcon />}
                  onClick={handleCopyAllBackupCodes}
                >
                  Copy All Codes
                </Button>
              </Box>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Grid container spacing={1}>
                  {newBackupCodes.map((code, index) => (
                    <Grid item xs={12} sm={6} key={index}>
                      <Box
                        display="flex"
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{
                          p: 1,
                          bgcolor: 'background.default',
                          borderRadius: 1,
                          fontFamily: 'monospace'
                        }}
                      >
                        <Typography variant="body2">{code}</Typography>
                        <IconButton
                          size="small"
                          onClick={() => handleCopyBackupCode(code, index)}
                        >
                          {copiedCodes[index] ? (
                            <CheckCircleIcon fontSize="small" />
                          ) : (
                            <ContentCopyIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Paper>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseRegenerateDialog} disabled={loading}>
            {newBackupCodes ? 'Close' : 'Cancel'}
          </Button>
          {!newBackupCodes && (
            <Button
              onClick={handleRegenerateBackupCodes}
              variant="contained"
              disabled={loading || !password}
            >
              {loading ? <CircularProgress size={24} /> : 'Generate New Codes'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TwoFactorManagement;

