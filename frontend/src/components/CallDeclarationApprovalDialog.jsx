import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  TextField,
  Grid,
  Divider,
  Alert,
  CircularProgress,
  Chip,
  Paper,
} from '@mui/material';
import {
  Phone as PhoneIcon,
  AccessTime as AccessTimeIcon,
  AttachMoney as MoneyIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Person as PersonIcon,
  RestartAlt as ResetIcon,
} from '@mui/icons-material';
import { approveDeclaration, rejectDeclaration, fetchRecordingBlob } from '../services/callDeclarations';
import { formatFullDateTimeBG } from '../utils/dateUtils';

const CallDeclarationApprovalDialog = ({ open, onClose, declaration, onDeclarationUpdated, onReset, isAdmin, canApprove = true }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [showRejectionInput, setShowRejectionInput] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioLoading, setAudioLoading] = useState(false);

  // Load recording when declaration changes
  useEffect(() => {
    let objectUrl = null;
    if (open && declaration?.recordFile) {
      setAudioLoading(true);
      setAudioUrl(null);
      fetchRecordingBlob(declaration.recordFile)
        .then((url) => {
          objectUrl = url;
          setAudioUrl(url);
        })
        .catch((err) => {
          console.error("Failed to load recording:", err);
        })
        .finally(() => setAudioLoading(false));
    } else {
      setAudioUrl(null);
    }

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [open, declaration?.recordFile]);

  if (!declaration) return null;

  const formatDate = (dateStr) => formatFullDateTimeBG(dateStr);

  const formatCurrency = (value) => `$${Number(value).toFixed(2)}`;

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  };

  const getCallTypeLabel = (callType, callCategory) => {
    if (callCategory === 'filler') return 'Filler Call';
    const labels = {
      deposit: 'Deposit Call',
      first_call: 'First Call',
      second_call: 'Second Call',
      third_call: '3rd Call',
      fourth_call: '4th Call',
    };
    return labels[callType] || callType || 'N/A';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'approved': return 'success';
      case 'rejected': return 'error';
      default: return 'default';
    }
  };

  const handleApprove = async () => {
    setLoading(true);
    setError(null);
    try {
      const updatedDeclaration = await approveDeclaration(
        declaration._id,
        approvalNotes.trim() || null
      );
      onDeclarationUpdated(updatedDeclaration);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve declaration');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionNotes.trim()) {
      setError('Please provide a reason for rejection');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const updatedDeclaration = await rejectDeclaration(
        declaration._id,
        rejectionNotes.trim()
      );
      onDeclarationUpdated(updatedDeclaration);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject declaration');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!onReset) return;
    setLoading(true);
    setError(null);
    try {
      await onReset(declaration._id);
      setShowResetConfirm(false);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to reset declaration');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setRejectionNotes('');
    setApprovalNotes('');
    setShowRejectionInput(false);
    setShowResetConfirm(false);
    setError(null);
    setAudioUrl(null);
    setAudioLoading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const isPending = declaration.status === 'pending';

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ py: 1, px: 2 }}>
        <Box display="flex" alignItems="center" gap={0.5}>
          <PhoneIcon color="primary" sx={{ fontSize: 18 }} />
          <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: "0.9rem" }}>Declaration Details</Typography>
          <Chip
            label={declaration.status}
            color={getStatusColor(declaration.status)}
            size="small"
            sx={{ ml: "auto", height: 20, fontSize: "0.65rem", textTransform: "capitalize" }}
          />
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ px: 2, py: 1.5 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 1, py: 0.25, fontSize: "0.75rem" }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {showResetConfirm && (
          <Alert severity="warning" sx={{ mb: 1, py: 0.25, fontSize: "0.75rem" }}>
            This will reverse the expense, reset the deposit call slot, and deactivate this declaration.
          </Alert>
        )}

        {/* Agent & Lead Info - Compact Inline */}
        <Paper variant="outlined" sx={{ p: 1, mb: 1 }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
            <Box>
              <Typography sx={{ fontSize: "0.6rem", color: "text.secondary", textTransform: "uppercase" }}>Agent</Typography>
              <Typography sx={{ fontSize: "0.78rem", fontWeight: 500 }}>
                {declaration.agent?.fullName || 'N/A'}
                {declaration.agent?.fourDigitCode && <Typography component="span" sx={{ fontSize: "0.68rem", color: "text.secondary" }}> ({declaration.agent.fourDigitCode})</Typography>}
              </Typography>
            </Box>
            <Divider orientation="vertical" flexItem sx={{ borderColor: "primary.main" }} />
            <Box>
              <Typography sx={{ fontSize: "0.6rem", color: "text.secondary", textTransform: "uppercase" }}>AM</Typography>
              <Typography sx={{ fontSize: "0.78rem" }}>{declaration.affiliateManager?.fullName || 'N/A'}</Typography>
            </Box>
            {declaration.lead && (
              <>
                <Divider orientation="vertical" flexItem sx={{ borderColor: "primary.main" }} />
                <Box>
                  <Typography sx={{ fontSize: "0.6rem", color: "text.secondary", textTransform: "uppercase" }}>Lead</Typography>
                  <Typography sx={{ fontSize: "0.78rem", fontWeight: 500 }}>
                    {`${declaration.lead.firstName || ''} ${declaration.lead.lastName || ''}`.trim() || 'N/A'}
                  </Typography>
                  <Typography sx={{ fontSize: "0.65rem", color: "text.secondary", fontFamily: "monospace" }}>
                    {declaration.lead.newPhone || ''} {declaration.lead.newEmail ? `| ${declaration.lead.newEmail}` : ''}
                  </Typography>
                </Box>
              </>
            )}
          </Box>
        </Paper>

        {/* Call Details - Compact */}
        <Paper variant="outlined" sx={{ p: 1, mb: 1 }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
            <Box>
              <Typography sx={{ fontSize: "0.6rem", color: "text.secondary", textTransform: "uppercase" }}>Date</Typography>
              <Typography sx={{ fontSize: "0.78rem" }}>{formatDate(declaration.callDate)}</Typography>
            </Box>
            <Divider orientation="vertical" flexItem sx={{ borderColor: "primary.main" }} />
            <Box>
              <Typography sx={{ fontSize: "0.6rem", color: "text.secondary", textTransform: "uppercase" }}>Duration</Typography>
              <Typography sx={{ fontSize: "0.78rem", fontWeight: 500 }}>{formatDuration(declaration.callDuration)}</Typography>
            </Box>
            <Divider orientation="vertical" flexItem sx={{ borderColor: "primary.main" }} />
            <Box>
              <Typography sx={{ fontSize: "0.6rem", color: "text.secondary", textTransform: "uppercase" }}>Source</Typography>
              <Typography sx={{ fontSize: "0.75rem", fontFamily: "monospace" }}>{declaration.sourceNumber}</Typography>
            </Box>
            <Divider orientation="vertical" flexItem sx={{ borderColor: "primary.main" }} />
            <Box>
              <Typography sx={{ fontSize: "0.6rem", color: "text.secondary", textTransform: "uppercase" }}>Dest</Typography>
              <Typography sx={{ fontSize: "0.75rem", fontFamily: "monospace" }}>{declaration.destinationNumber}</Typography>
            </Box>
          </Box>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, mt: 0.75 }}>
            <Box>
              <Typography sx={{ fontSize: "0.6rem", color: "text.secondary", textTransform: "uppercase" }}>Category</Typography>
              <Chip label={declaration.callCategory === 'filler' ? 'Filler' : 'FTD'} size="small" color={declaration.callCategory === 'filler' ? 'default' : 'primary'} variant="outlined" sx={{ height: 18, fontSize: "0.62rem" }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: "0.6rem", color: "text.secondary", textTransform: "uppercase" }}>Type</Typography>
              <Typography sx={{ fontSize: "0.78rem" }}>{getCallTypeLabel(declaration.callType, declaration.callCategory)}</Typography>
            </Box>
            {declaration.description && (
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: "0.6rem", color: "text.secondary", textTransform: "uppercase" }}>Description</Typography>
                <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>{declaration.description}</Typography>
              </Box>
            )}
          </Box>
        </Paper>

        {/* Recording */}
        {declaration.recordFile && (
          <Paper variant="outlined" sx={{ p: 1, mb: 1 }}>
            <Typography sx={{ fontSize: "0.6rem", color: "text.secondary", textTransform: "uppercase", mb: 0.5 }}>Recording</Typography>
            {audioLoading ? (
              <Box display="flex" alignItems="center" gap={1}>
                <CircularProgress size={16} />
                <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>Loading...</Typography>
              </Box>
            ) : audioUrl ? (
              <audio controls src={audioUrl} style={{ width: '100%', height: 28 }} />
            ) : (
              <Typography sx={{ fontSize: "0.75rem" }} color="error">Failed to load</Typography>
            )}
          </Paper>
        )}

        {/* Bonus - Compact Inline */}
        <Paper variant="outlined" sx={{ p: 1, mb: 1, bgcolor: 'success.50', borderColor: 'success.main' }}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={1}>
              <MoneyIcon sx={{ fontSize: 16, color: "success.main" }} />
              <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                Base: {formatCurrency(declaration.baseBonus)}
                {declaration.hourlyBonus > 0 && ` + Hourly: ${formatCurrency(declaration.hourlyBonus)}`}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: "success.main" }}>
              {formatCurrency(declaration.totalBonus)}
            </Typography>
          </Box>
        </Paper>

        {/* Submission + Review */}
        <Typography sx={{ fontSize: "0.68rem", color: "text.disabled" }}>
          Submitted: {formatDate(declaration.createdAt)}
        </Typography>

        {declaration.reviewedBy && (
          <Box sx={{ mt: 0.5, pt: 0.5, borderTop: "1px solid", borderColor: "divider" }}>
            <Typography sx={{ fontSize: "0.68rem", color: "text.secondary" }}>
              Reviewed by {declaration.reviewedBy?.fullName || 'N/A'} on {formatDate(declaration.reviewedAt)}
            </Typography>
            {declaration.reviewNotes && (
              <Typography sx={{ fontSize: "0.75rem", color: "text.secondary", mt: 0.25 }}>{declaration.reviewNotes}</Typography>
            )}
          </Box>
        )}

        {/* Rejection Input */}
        {isPending && showRejectionInput && (
          <Box sx={{ mt: 1 }}>
            <TextField
              fullWidth
              multiline
              rows={2}
              size="small"
              label="Rejection Reason *"
              value={rejectionNotes}
              onChange={(e) => setRejectionNotes(e.target.value)}
              placeholder="Reason for rejection..."
              disabled={loading}
              required
              error={!rejectionNotes.trim() && showRejectionInput}
            />
          </Box>
        )}

        {/* Approval Notes (optional) */}
        {isPending && canApprove && !showRejectionInput && (
          <Box sx={{ mt: 1 }}>
            <TextField
              fullWidth
              multiline
              rows={1}
              size="small"
              label="Approval Notes (optional)"
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              placeholder="Notes..."
              disabled={loading}
            />
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2, py: 1 }}>
        {showResetConfirm ? (
          <>
            <Button onClick={() => setShowResetConfirm(false)} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleReset}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={16} /> : <ResetIcon />}
            >
              Confirm Reset
            </Button>
          </>
        ) : isPending ? (
          !canApprove ? (
            <Button onClick={handleClose}>
              Close
            </Button>
          ) : showRejectionInput ? (
            <>
              <Button
                onClick={() => setShowRejectionInput(false)}
                disabled={loading}
              >
                Back
              </Button>
              <Button
                variant="contained"
                color="error"
                onClick={handleReject}
                disabled={loading || !rejectionNotes.trim()}
                startIcon={loading ? <CircularProgress size={16} /> : <CloseIcon />}
              >
                Confirm Rejection
              </Button>
            </>
          ) : (
            <>
              {isAdmin && onReset && (
                <Button
                  color="error"
                  onClick={() => setShowResetConfirm(true)}
                  disabled={loading}
                  startIcon={<ResetIcon />}
                  sx={{ mr: 'auto' }}
                >
                  Reset
                </Button>
              )}
              <Button onClick={handleClose} disabled={loading}>
                Close
              </Button>
              <Button
                variant="outlined"
                color="error"
                onClick={() => setShowRejectionInput(true)}
                disabled={loading}
                startIcon={<CloseIcon />}
              >
                Reject
              </Button>
              <Button
                variant="contained"
                color="success"
                onClick={handleApprove}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={16} /> : <CheckIcon />}
              >
                Approve
              </Button>
            </>
          )
        ) : (
          <>
            {isAdmin && onReset && (declaration.status === 'approved' || declaration.status === 'rejected') && (
              <Button
                color="error"
                onClick={() => setShowResetConfirm(true)}
                disabled={loading}
                startIcon={<ResetIcon />}
                sx={{ mr: 'auto' }}
              >
                Reset
              </Button>
            )}
            <Button onClick={handleClose}>
              Close
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default CallDeclarationApprovalDialog;
