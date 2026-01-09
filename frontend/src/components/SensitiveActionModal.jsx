import React, { useState, useEffect } from "react";
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
} from "@mui/material";
import SecurityIcon from "@mui/icons-material/Security";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import LockIcon from "@mui/icons-material/Lock";

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
 * - actionName: string - Human-readable name of the action (e.g., "Update Network Wallets")
 * - actionDescription: string - Optional description of what will happen
 * - loading: boolean - Whether verification is in progress
 * - error: string - Error message to display
 * - requires2FASetup: boolean - If true, show message that 2FA must be enabled first
 */
const SensitiveActionModal = ({
  open,
  onClose,
  onVerify,
  actionName = "Sensitive Action",
  actionDescription = "",
  loading = false,
  error = "",
  requires2FASetup = false,
}) => {
  const [verificationCode, setVerificationCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [localError, setLocalError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setVerificationCode("");
      setUseBackupCode(false);
      setLocalError("");
      setIsVerifying(false);
    }
  }, [open]);

  // Reset isVerifying when error is received (wrong code)
  useEffect(() => {
    if (error) {
      setIsVerifying(false);
    }
  }, [error]);

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
            disabled={loading}
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
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={loading} color="inherit">
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
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default SensitiveActionModal;





