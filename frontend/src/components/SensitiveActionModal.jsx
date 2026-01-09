import React, { useState, useEffect, useCallback } from "react";
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
  Divider,
  Chip,
  LinearProgress,
  Fade,
} from "@mui/material";
import { QRCodeSVG } from "qrcode.react";
import SecurityIcon from "@mui/icons-material/Security";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import LockIcon from "@mui/icons-material/Lock";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import TimerIcon from "@mui/icons-material/Timer";
import PhoneIphoneIcon from "@mui/icons-material/PhoneIphone";
import api from "../services/api";

/**
 * SensitiveActionModal - Requires 2FA verification for sensitive operations
 *
 * This modal is shown when a user tries to perform a sensitive action like:
 * - Changing wallet addresses
 * - Modifying user accounts
 * - Changing passwords
 * - Deleting resources
 *
 * Props:
 * - open: boolean - Whether the modal is open
 * - onClose: function - Called when modal is closed
 * - onVerify: function(code, useBackupCode) - Called when user submits verification
 * - onQRVerify: function(sessionToken) - Called when QR auth is approved
 * - actionName: string - Human-readable name of the action (e.g., "Update Network Wallets")
 * - actionDescription: string - Optional description of what will happen
 * - loading: boolean - Whether verification is in progress
 * - error: string - Error message to display
 * - requires2FASetup: boolean - If true, show message that 2FA must be enabled first
 * - userId: string - Current user's ID (for QR auth)
 * - qrAuthEnabled: boolean - Whether user has QR auth enabled
 */
const SensitiveActionModal = ({
  open,
  onClose,
  onVerify,
  onQRVerify,
  actionName = "Sensitive Action",
  actionDescription = "",
  loading = false,
  error = "",
  requires2FASetup = false,
  userId = null,
  qrAuthEnabled = false,
}) => {
  const [verificationCode, setVerificationCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [localError, setLocalError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  
  // QR Auth states
  const [useQRMode, setUseQRMode] = useState(false);
  const [qrSessionToken, setQrSessionToken] = useState(null);
  const [qrUrl, setQrUrl] = useState(null);
  const [qrStatus, setQrStatus] = useState("idle"); // idle, loading, pending, approved, rejected, expired, error
  const [qrError, setQrError] = useState("");
  const [timeRemaining, setTimeRemaining] = useState(300);

  // Create QR session for sensitive action
  const createQRSession = useCallback(async () => {
    if (!userId) return;
    
    try {
      setQrStatus("loading");
      setQrError("");
      
      const response = await api.post("/qr-auth/create-sensitive-action-session", { 
        userId,
        actionType: actionName,
      });
      
      if (response.data.success) {
        setQrSessionToken(response.data.data.sessionToken);
        setQrUrl(response.data.data.qrUrl);
        setQrStatus("pending");
        
        const remaining = Math.floor(
          (new Date(response.data.data.expiresAt) - new Date()) / 1000
        );
        setTimeRemaining(remaining > 0 ? remaining : 0);
      } else {
        setQrStatus("error");
        setQrError(response.data.message || "Failed to create QR session");
      }
    } catch (err) {
      console.error("Error creating QR session:", err);
      setQrStatus("error");
      setQrError(err.response?.data?.message || "Failed to create QR session");
    }
  }, [userId, actionName]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setVerificationCode("");
      setUseBackupCode(false);
      setLocalError("");
      setIsVerifying(false);
      // Reset QR states
      setUseQRMode(qrAuthEnabled); // Default to QR mode if enabled
      setQrSessionToken(null);
      setQrUrl(null);
      setQrStatus("idle");
      setQrError("");
      setTimeRemaining(300);
    }
  }, [open, qrAuthEnabled]);

  // Reset and clear code when error is received (wrong code)
  useEffect(() => {
    if (error) {
      setIsVerifying(false);
      setVerificationCode("");
    }
  }, [error]);

  // Create QR session when switching to QR mode
  useEffect(() => {
    if (open && useQRMode && qrStatus === "idle" && userId) {
      createQRSession();
    }
  }, [open, useQRMode, qrStatus, userId, createQRSession]);

  // Poll for QR session status
  useEffect(() => {
    let pollInterval;
    
    if (open && qrSessionToken && qrStatus === "pending") {
      pollInterval = setInterval(async () => {
        try {
          const response = await api.get(
            `/qr-auth/sensitive-action-status/${qrSessionToken}`
          );
          
          if (response.data.success) {
            const { status: sessionStatus, verificationToken } = response.data.data;
            
            if (sessionStatus === "approved") {
              setQrStatus("approved");
              clearInterval(pollInterval);
              
              // Small delay for visual feedback, then call verify callback
              setTimeout(() => {
                if (onQRVerify) {
                  onQRVerify(verificationToken);
                }
              }, 1000);
            } else if (sessionStatus === "rejected") {
              setQrStatus("rejected");
              clearInterval(pollInterval);
            } else if (sessionStatus === "expired") {
              setQrStatus("expired");
              clearInterval(pollInterval);
            }
          }
        } catch (err) {
          console.error("Error polling session status:", err);
        }
      }, 2000);
    }
    
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [open, qrSessionToken, qrStatus, onQRVerify]);

  // Timer countdown
  useEffect(() => {
    let timerInterval;
    
    if (qrStatus === "pending" && timeRemaining > 0) {
      timerInterval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            setQrStatus("expired");
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
  }, [qrStatus, timeRemaining]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleRetryQR = () => {
    setQrStatus("idle");
    setQrSessionToken(null);
    setQrUrl(null);
    setQrError("");
    setTimeRemaining(300);
  };

  const switchToQRMode = () => {
    setUseQRMode(true);
    setQrStatus("idle");
    setVerificationCode("");
    setLocalError("");
  };

  const switchTo2FAMode = () => {
    setUseQRMode(false);
    setQrStatus("idle");
    setQrSessionToken(null);
    setQrUrl(null);
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();

    if (!verificationCode) {
      setLocalError("Please enter a verification code");
      return;
    }

    if (!useBackupCode && verificationCode.length !== 6) {
      setLocalError("Please enter a valid 6-digit code");
      return;
    }

    if (useBackupCode && verificationCode.length !== 8) {
      setLocalError("Please enter a valid 8-character backup code");
      return;
    }

    setLocalError("");
    setIsVerifying(true);
    onVerify(verificationCode, useBackupCode);
  };

  const handleClose = () => {
    if (!loading) {
      setVerificationCode("");
      setUseBackupCode(false);
      setLocalError("");
      setIsVerifying(false);
      onClose();
    }
  };

  const handleCodeChange = (e) => {
    let value = e.target.value;

    if (!useBackupCode) {
      // For TOTP codes, only allow digits and max 6 characters
      value = value.replace(/\D/g, "").slice(0, 6);
    } else {
      // For backup codes, allow alphanumeric and max 8 characters
      value = value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 8);
    }

    setVerificationCode(value);
    setLocalError("");

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
    setVerificationCode("");
    setLocalError("");
  };

  // Render QR code content
  const renderQRContent = () => {
    switch (qrStatus) {
      case "loading":
        return (
          <Box display="flex" flexDirection="column" alignItems="center" py={4}>
            <CircularProgress size={48} />
            <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
              Generating QR code...
            </Typography>
          </Box>
        );

      case "pending":
        return (
          <Fade in>
            <Box display="flex" flexDirection="column" alignItems="center">
              <Box
                sx={{
                  p: 2,
                  bgcolor: "white",
                  borderRadius: 2,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                  mb: 3,
                }}
              >
                <QRCodeSVG value={qrUrl} size={180} level="H" includeMargin />
              </Box>

              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <PhoneIphoneIcon color="primary" />
                <Typography variant="body2" color="text.secondary">
                  Scan with your registered device
                </Typography>
              </Box>

              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <TimerIcon color={timeRemaining < 60 ? "error" : "action"} />
                <Typography
                  variant="h5"
                  color={timeRemaining < 60 ? "error.main" : "text.primary"}
                  fontFamily="monospace"
                >
                  {formatTime(timeRemaining)}
                </Typography>
              </Box>

              <LinearProgress
                variant="determinate"
                value={(timeRemaining / 300) * 100}
                sx={{
                  width: "100%",
                  height: 6,
                  borderRadius: 3,
                  mb: 2,
                }}
              />

              <Alert severity="info" sx={{ width: "100%" }}>
                <Typography variant="body2">
                  Scan the QR code with your authorized device to approve this
                  sensitive action.
                </Typography>
              </Alert>
            </Box>
          </Fade>
        );

      case "approved":
        return (
          <Fade in>
            <Box display="flex" flexDirection="column" alignItems="center" py={4}>
              <CheckCircleIcon
                sx={{ fontSize: 80, color: "success.main", mb: 2 }}
              />
              <Typography variant="h5" color="success.main" fontWeight="bold">
                Action Approved!
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                Processing your request...
              </Typography>
              <CircularProgress size={24} sx={{ mt: 2 }} />
            </Box>
          </Fade>
        );

      case "rejected":
        return (
          <Fade in>
            <Box display="flex" flexDirection="column" alignItems="center" py={4}>
              <CancelIcon sx={{ fontSize: 80, color: "error.main", mb: 2 }} />
              <Typography variant="h5" color="error.main" fontWeight="bold">
                Action Rejected
              </Typography>
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ mt: 1, mb: 3 }}
              >
                The action was rejected from your device.
              </Typography>
              <Button variant="contained" onClick={handleRetryQR}>
                Try Again
              </Button>
            </Box>
          </Fade>
        );

      case "expired":
        return (
          <Fade in>
            <Box display="flex" flexDirection="column" alignItems="center" py={4}>
              <TimerIcon sx={{ fontSize: 80, color: "warning.main", mb: 2 }} />
              <Typography variant="h5" color="warning.main" fontWeight="bold">
                Session Expired
              </Typography>
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ mt: 1, mb: 3 }}
              >
                The QR code has expired. Please generate a new one.
              </Typography>
              <Button variant="contained" onClick={handleRetryQR}>
                Generate New QR Code
              </Button>
            </Box>
          </Fade>
        );

      case "error":
        return (
          <Fade in>
            <Box display="flex" flexDirection="column" alignItems="center" py={4}>
              <Alert severity="error" sx={{ width: "100%", mb: 3 }}>
                {qrError}
              </Alert>
              <Button variant="contained" onClick={handleRetryQR}>
                Try Again
              </Button>
            </Box>
          </Fade>
        );

      default:
        return (
          <Box display="flex" flexDirection="column" alignItems="center" py={4}>
            <CircularProgress size={48} />
          </Box>
        );
    }
  };

  // If 2FA is not set up, show a different message
  if (requires2FASetup) {
    return (
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <WarningAmberIcon color="warning" />
            <Typography variant="h6">
              Two-Factor Authentication Required
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Two-factor authentication must be enabled to perform sensitive
            actions.
          </Alert>
          <Typography variant="body1" paragraph>
            For security reasons, administrative actions like{" "}
            <strong>{actionName}</strong> require two-factor authentication to
            be enabled on your account.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Please go to your Profile settings and enable 2FA before proceeding
            with this action.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Close</Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              handleClose();
              // Navigate to profile page - you may need to use your router
              window.location.href = "/profile";
            }}
          >
            Go to Security Settings
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  // QR Mode Dialog
  if (useQRMode && qrAuthEnabled) {
    return (
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown={qrStatus === "pending" || qrStatus === "approved"}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <QrCodeScannerIcon color="primary" />
            <Typography variant="h6">Scan to Approve Action</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {/* Action description */}
          <Alert severity="warning" icon={<SecurityIcon />} sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {actionName}
            </Typography>
            {actionDescription && (
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {actionDescription}
              </Typography>
            )}
          </Alert>

          {renderQRContent()}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: "space-between" }}>
          <Button
            onClick={switchTo2FAMode}
            color="inherit"
            disabled={qrStatus === "approved"}
            size="small"
          >
            Use 2FA Code Instead
          </Button>
          <Button onClick={handleClose} disabled={qrStatus === "approved"}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  // 2FA Code Mode Dialog
  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown={loading}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <LockIcon color="error" />
          <Typography variant="h6">Confirm Sensitive Action</Typography>
        </Box>
      </DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          {/* Action description */}
          <Alert severity="warning" icon={<SecurityIcon />} sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {actionName}
            </Typography>
            {actionDescription && (
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {actionDescription}
              </Typography>
            )}
          </Alert>

          <Typography variant="body2" color="text.secondary" paragraph>
            This is a sensitive action that requires two-factor authentication
            verification. Please enter your 2FA code to continue.
          </Typography>

          <Divider sx={{ my: 2 }} />

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {useBackupCode
              ? "Enter one of your backup codes to verify"
              : "Enter the 6-digit code from your authenticator app"}
          </Typography>

          <TextField
            fullWidth
            label={useBackupCode ? "Backup Code" : "Verification Code"}
            value={verificationCode}
            onChange={handleCodeChange}
            placeholder={useBackupCode ? "XXXXXXXX" : "000000"}
            inputProps={{
              maxLength: useBackupCode ? 8 : 6,
              style: {
                fontSize: "24px",
                textAlign: "center",
                letterSpacing: useBackupCode ? "4px" : "8px",
                fontFamily: "monospace",
              },
              autoComplete: "one-time-code",
            }}
            sx={{ my: 2 }}
            autoFocus
          />

          {(error || localError) && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error || localError}
            </Alert>
          )}

          <Box textAlign="center">
            <Link
              component="button"
              type="button"
              variant="body2"
              onClick={toggleBackupCode}
              disabled={loading}
              sx={{ cursor: "pointer" }}
            >
              {useBackupCode
                ? "Use authenticator app code instead"
                : "Lost your device? Use a backup code"}
            </Link>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: qrAuthEnabled ? "space-between" : "flex-end" }}>
          {qrAuthEnabled && (
            <Button
              onClick={switchToQRMode}
              color="inherit"
              disabled={loading}
              size="small"
              startIcon={<QrCodeScannerIcon />}
            >
              Use QR Scan Instead
            </Button>
          )}
          <Box>
            <Button onClick={handleClose} disabled={loading} color="inherit" sx={{ mr: 1 }}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="error"
              disabled={
                loading ||
                !verificationCode ||
                (!useBackupCode && verificationCode.length !== 6) ||
                (useBackupCode && verificationCode.length !== 8)
              }
            >
              {loading ? <CircularProgress size={24} /> : "Verify & Continue"}
            </Button>
          </Box>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default SensitiveActionModal;





