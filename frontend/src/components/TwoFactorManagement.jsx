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
  IconButton,
  Divider,
  InputAdornment
} from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import TelegramIcon from '@mui/icons-material/Telegram';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { QRCodeSVG } from 'qrcode.react';
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
  
  // QR Auth state
  const [qrAuthStatus, setQrAuthStatus] = useState(null);
  const [qrSetupDialogOpen, setQrSetupDialogOpen] = useState(false);
  const [qrSetupUrl, setQrSetupUrl] = useState(null);
  const [qrSetupLoading, setQrSetupLoading] = useState(false);
  const [disableQrDialogOpen, setDisableQrDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Telegram Auth state
  const [telegramAuthStatus, setTelegramAuthStatus] = useState(null);
  const [telegramLinkDialogOpen, setTelegramLinkDialogOpen] = useState(false);
  const [telegramLinkCode, setTelegramLinkCode] = useState(null);
  const [telegramBotUrl, setTelegramBotUrl] = useState(null);
  const [telegramLinkLoading, setTelegramLinkLoading] = useState(false);
  const [disableTelegramDialogOpen, setDisableTelegramDialogOpen] = useState(false);

  const is2FAEnabled = user?.twoFactorEnabled;
  const isAdmin = user?.role === 'admin';
  const isQrAuthEnabled = qrAuthStatus?.qrAuthEnabled;
  const isTelegramAuthEnabled = telegramAuthStatus?.telegramAuthEnabled;

  // Fetch QR auth and Telegram auth status on mount
  useEffect(() => {
    const fetchAuthStatuses = async () => {
      if (isAdmin) {
        try {
          const [qrResponse, telegramResponse] = await Promise.all([
            api.get('/qr-auth/status'),
            api.get('/telegram-auth/status')
          ]);
          if (qrResponse.data.success) {
            setQrAuthStatus(qrResponse.data.data);
          }
          if (telegramResponse.data.success) {
            setTelegramAuthStatus(telegramResponse.data.data);
          }
        } catch (err) {
          console.error('Error fetching auth statuses:', err);
        }
      }
    };
    fetchAuthStatuses();
  }, [isAdmin]);

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

  // QR Auth handlers
  const handleEnableQrAuth = async () => {
    setQrSetupLoading(true);
    setError('');
    try {
      const response = await api.post('/qr-auth/enable');
      if (response.data.success) {
        setQrSetupUrl(response.data.data.setupUrl);
        setQrSetupDialogOpen(true);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to enable QR authentication');
      toast.error(err.response?.data?.message || 'Failed to enable QR authentication');
    } finally {
      setQrSetupLoading(false);
    }
  };

  const handleDisableQrAuth = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/qr-auth/disable');
      if (response.data.success) {
        setQrAuthStatus({ ...qrAuthStatus, qrAuthEnabled: false, deviceInfo: null });
        setDisableQrDialogOpen(false);
        toast.success('QR authentication has been disabled');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to disable QR authentication');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseQrSetupDialog = () => {
    setQrSetupDialogOpen(false);
    setQrSetupUrl(null);
    // Refresh QR auth status
    api.get('/qr-auth/status').then(response => {
      if (response.data.success) {
        setQrAuthStatus(response.data.data);
      }
    });
  };

  // Telegram Auth handlers
  const handleSetupTelegramAuth = async () => {
    setTelegramLinkLoading(true);
    setError('');
    try {
      const response = await api.post('/telegram-auth/generate-link-code');
      if (response.data.success) {
        setTelegramLinkCode(response.data.data.linkCode);
        setTelegramBotUrl(response.data.data.botUrl);
        setTelegramLinkDialogOpen(true);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate Telegram link code');
      toast.error(err.response?.data?.message || 'Failed to generate Telegram link code');
    } finally {
      setTelegramLinkLoading(false);
    }
  };

  const handleDisableTelegramAuth = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/telegram-auth/disable');
      if (response.data.success) {
        setTelegramAuthStatus({ ...telegramAuthStatus, telegramAuthEnabled: false, telegramUsername: null });
        setDisableTelegramDialogOpen(false);
        toast.success('Telegram authentication has been disabled');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to disable Telegram authentication');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseTelegramLinkDialog = () => {
    setTelegramLinkDialogOpen(false);
    setTelegramLinkCode(null);
    setTelegramBotUrl(null);
    // Refresh Telegram auth status
    api.get('/telegram-auth/status').then(response => {
      if (response.data.success) {
        setTelegramAuthStatus(response.data.data);
      }
    });
  };

  const handleCopyLinkCode = () => {
    if (telegramLinkCode) {
      navigator.clipboard.writeText(telegramLinkCode);
      toast.success('Link code copied to clipboard');
    }
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

      {/* QR Code Authentication Card */}
      <Card elevation={2} sx={{ mt: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Box display="flex" alignItems="center" gap={2}>
              <QrCodeScannerIcon color={isQrAuthEnabled ? 'success' : 'action'} fontSize="large" />
              <Box>
                <Typography variant="h6">
                  QR Code Authentication
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Approve logins by scanning a QR code with your phone
                </Typography>
              </Box>
            </Box>
            <Chip
              icon={isQrAuthEnabled ? <CheckCircleIcon /> : <WarningIcon />}
              label={isQrAuthEnabled ? 'Active' : 'Not Active'}
              color={isQrAuthEnabled ? 'success' : 'default'}
            />
          </Box>

          {isQrAuthEnabled ? (
            <Box>
              <Alert severity="success" sx={{ mb: 2 }}>
                <Box display="flex" alignItems="center" gap={1}>
                  <PhoneIphoneIcon fontSize="small" />
                  <Typography variant="body2">
                    Registered device: {qrAuthStatus?.deviceInfo || 'Unknown Device'}
                  </Typography>
                </Box>
                <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                  Only this device can approve your login requests.
                </Typography>
              </Alert>
              <Button
                variant="outlined"
                color="error"
                onClick={() => setDisableQrDialogOpen(true)}
              >
                Disable QR Authentication
              </Button>
            </Box>
          ) : (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                Use your iPhone to approve login requests instead of entering a 6-digit code.
                This is more secure and convenient - just scan the QR code when logging in.
              </Alert>
              <Button
                variant="contained"
                size="large"
                startIcon={<QrCodeScannerIcon />}
                onClick={handleEnableQrAuth}
                disabled={qrSetupLoading || is2FAEnabled}
              >
                {qrSetupLoading ? <CircularProgress size={24} /> : 'Enable QR Authentication'}
              </Button>
              {is2FAEnabled && (
                <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                  Disable 2FA first to switch to QR authentication
                </Typography>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Telegram Authentication Card */}
      <Card elevation={2} sx={{ mt: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Box display="flex" alignItems="center" gap={2}>
              <TelegramIcon sx={{ color: isTelegramAuthEnabled ? '#0088cc' : 'action.active', fontSize: 35 }} />
              <Box>
                <Typography variant="h6">
                  Telegram Authentication
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Approve logins via Telegram bot messages
                </Typography>
              </Box>
            </Box>
            <Chip
              icon={isTelegramAuthEnabled ? <CheckCircleIcon /> : <WarningIcon />}
              label={isTelegramAuthEnabled ? 'Active' : 'Not Active'}
              color={isTelegramAuthEnabled ? 'success' : 'default'}
            />
          </Box>

          {isTelegramAuthEnabled ? (
            <Box>
              <Alert severity="success" sx={{ mb: 2 }}>
                <Box display="flex" alignItems="center" gap={1}>
                  <TelegramIcon fontSize="small" />
                  <Typography variant="body2">
                    Linked Telegram: @{telegramAuthStatus?.telegramUsername || 'Unknown'}
                  </Typography>
                </Box>
                <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                  Login requests will be sent to your Telegram for approval.
                </Typography>
              </Alert>
              <Button
                variant="outlined"
                color="error"
                onClick={() => setDisableTelegramDialogOpen(true)}
              >
                Disable Telegram Authentication
              </Button>
            </Box>
          ) : (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                Receive login approval requests directly in Telegram. Simply tap Approve or Reject
                when someone tries to log into your account.
              </Alert>
              <Button
                variant="contained"
                size="large"
                startIcon={<TelegramIcon />}
                onClick={handleSetupTelegramAuth}
                disabled={telegramLinkLoading || is2FAEnabled || isQrAuthEnabled}
                sx={{ bgcolor: '#0088cc', '&:hover': { bgcolor: '#006699' } }}
              >
                {telegramLinkLoading ? <CircularProgress size={24} /> : 'Setup Telegram Auth'}
              </Button>
              {(is2FAEnabled || isQrAuthEnabled) && (
                <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                  Disable {is2FAEnabled ? '2FA' : 'QR authentication'} first to switch to Telegram authentication
                </Typography>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Telegram Link Dialog */}
      <Dialog open={telegramLinkDialogOpen} onClose={handleCloseTelegramLinkDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <TelegramIcon sx={{ color: '#0088cc' }} />
            <Typography variant="h6">Link Telegram Account</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 3 }}>
            Follow these steps to link your Telegram account:
          </Alert>

          <Box sx={{ mb: 3 }}>
            <Typography variant="body1" sx={{ mb: 1 }}>
              <b>Step 1:</b> Open the bot in Telegram
            </Typography>
            <Button
              variant="outlined"
              href={telegramBotUrl}
              target="_blank"
              rel="noopener noreferrer"
              startIcon={<TelegramIcon />}
              sx={{ mb: 2 }}
            >
              Open @{process.env.REACT_APP_TELEGRAM_BOT_USERNAME || 'ftd_auth_bot'}
            </Button>

            <Typography variant="body1" sx={{ mb: 1, mt: 2 }}>
              <b>Step 2:</b> Send this code to the bot
            </Typography>
            <Box
              display="flex"
              alignItems="center"
              gap={1}
              sx={{
                p: 2,
                bgcolor: 'background.default',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography
                variant="h6"
                fontFamily="monospace"
                sx={{ flex: 1, wordBreak: 'break-all' }}
              >
                {telegramLinkCode}
              </Typography>
              <IconButton onClick={handleCopyLinkCode} size="small">
                <ContentCopyIcon />
              </IconButton>
            </Box>

            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              This code expires in 10 minutes.
            </Typography>
          </Box>

          <Alert severity="warning">
            Once linked, Telegram will be your only authentication method.
            2FA and QR authentication will be disabled.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseTelegramLinkDialog}>
            Done
          </Button>
        </DialogActions>
      </Dialog>

      {/* Disable Telegram Auth Dialog */}
      <Dialog open={disableTelegramDialogOpen} onClose={() => setDisableTelegramDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Disable Telegram Authentication</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Are you sure you want to disable Telegram authentication?
            You'll need to set it up again to use it.
          </Alert>
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDisableTelegramDialogOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleDisableTelegramAuth}
            color="error"
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Disable Telegram Auth'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* QR Setup Dialog */}
      <Dialog open={qrSetupDialogOpen} onClose={handleCloseQrSetupDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <QrCodeScannerIcon color="primary" />
            <Typography variant="h6">Set Up QR Authentication</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 3 }}>
            Scan this QR code with your iPhone camera to register it as your authentication device.
          </Alert>
          
          {qrSetupUrl && (
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
                  value={qrSetupUrl} 
                  size={200}
                  level="H"
                  includeMargin
                />
              </Box>
              
              <Typography variant="body2" color="text.secondary" textAlign="center">
                1. Open the Camera app on your iPhone<br />
                2. Point it at this QR code<br />
                3. Tap the notification to open the link<br />
                4. Enter your password to register the device
              </Typography>
            </Box>
          )}
          
          <Alert severity="warning" sx={{ mt: 3 }}>
            Only register a device you trust and have physical access to. 
            This device will be the only one able to approve your login requests.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseQrSetupDialog}>
            Done
          </Button>
        </DialogActions>
      </Dialog>

      {/* Disable QR Auth Dialog */}
      <Dialog open={disableQrDialogOpen} onClose={() => setDisableQrDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Disable QR Authentication</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Are you sure you want to disable QR authentication? 
            You'll need to set it up again to use it.
          </Alert>
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDisableQrDialogOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleDisableQrAuth}
            color="error"
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Disable QR Auth'}
          </Button>
        </DialogActions>
      </Dialog>

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

