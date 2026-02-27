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

const CallDeclarationApprovalDialog = ({ open, onClose, declaration, onDeclarationUpdated, onReset, isAdmin }) => {
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

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

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
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <PhoneIcon color="primary" />
          <Typography variant="h6">Review Call Declaration</Typography>
          <Box sx={{ ml: 'auto' }}>
            <Chip
              label={declaration.status.charAt(0).toUpperCase() + declaration.status.slice(1)}
              color={getStatusColor(declaration.status)}
              size="small"
            />
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {showResetConfirm && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            This will reverse the AM table expense, reset the deposit call slot back to pending, and deactivate this declaration. The agent will be able to re-declare this call.
          </Alert>
        )}

        {/* Agent Info */}
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <PersonIcon color="action" />
            <Typography variant="subtitle2" color="text.secondary">
              Agent
            </Typography>
          </Box>
          <Typography variant="body1" fontWeight="medium">
            {declaration.agent?.fullName || 'N/A'}
          </Typography>
          {declaration.agent?.fourDigitCode && (
            <Typography variant="body2" color="text.secondary">
              Code: {declaration.agent.fourDigitCode}
            </Typography>
          )}
        </Paper>

        {/* Lead Info */}
        {declaration.lead && (
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <PhoneIcon color="action" />
              <Typography variant="subtitle2" color="text.secondary">
                Lead
              </Typography>
            </Box>
            <Typography variant="body1" fontWeight="medium">
              {`${declaration.lead.firstName || ''} ${declaration.lead.lastName || ''}`.trim() || 'N/A'}
            </Typography>
            {declaration.lead.newPhone && (
              <Typography variant="body2" color="text.secondary" fontFamily="monospace">
                Phone: {declaration.lead.newPhone}
              </Typography>
            )}
            {declaration.lead.newEmail && (
              <Typography variant="body2" color="text.secondary">
                Email: {declaration.lead.newEmail}
              </Typography>
            )}
          </Paper>
        )}

        {/* Call Details */}
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Call Details
        </Typography>
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">
                Call Date & Time
              </Typography>
              <Typography variant="body2">
                {formatDate(declaration.callDate)}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">
                Duration
              </Typography>
              <Box display="flex" alignItems="center" gap={0.5}>
                <AccessTimeIcon fontSize="small" color="action" />
                <Typography variant="body2" fontWeight="medium">
                  {formatDuration(declaration.callDuration)}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">
                Source Number
              </Typography>
              <Typography variant="body2" fontFamily="monospace">
                {declaration.sourceNumber}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">
                Destination Number
              </Typography>
              <Typography variant="body2" fontFamily="monospace">
                {declaration.destinationNumber}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">
                Call Category
              </Typography>
              <Box>
                <Chip
                  label={declaration.callCategory === 'filler' ? 'Filler' : 'FTD'}
                  size="small"
                  color={declaration.callCategory === 'filler' ? 'default' : 'primary'}
                  variant="outlined"
                />
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">
                Call Type
              </Typography>
              <Typography variant="body2">
                {getCallTypeLabel(declaration.callType, declaration.callCategory)}
              </Typography>
            </Grid>
            {declaration.description && (
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">
                  Description
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {declaration.description}
                </Typography>
              </Grid>
            )}
          </Grid>
        </Paper>

        {/* Call Recording */}
        {declaration.recordFile && (
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Call Recording
            </Typography>
            {audioLoading ? (
              <Box display="flex" alignItems="center" gap={1}>
                <CircularProgress size={20} />
                <Typography variant="body2" color="text.secondary">Loading recording...</Typography>
              </Box>
            ) : audioUrl ? (
              <audio controls src={audioUrl} style={{ width: '100%' }} />
            ) : (
              <Typography variant="body2" color="error">Failed to load recording</Typography>
            )}
          </Paper>
        )}

        {/* Bonus Details */}
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            mb: 2,
            bgcolor: 'success.50',
            borderColor: 'success.main',
          }}
        >
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <MoneyIcon color="success" />
            <Typography variant="subtitle2">
              Requested Bonus
            </Typography>
          </Box>
          <Grid container spacing={1}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">
                Base Bonus
              </Typography>
              <Typography variant="body1">
                {formatCurrency(declaration.baseBonus)}
              </Typography>
            </Grid>
            {declaration.hourlyBonus > 0 && (
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Hourly Bonus
                </Typography>
                <Typography variant="body1">
                  {formatCurrency(declaration.hourlyBonus)}
                </Typography>
              </Grid>
            )}
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle1" fontWeight="bold">
                  Total Bonus
                </Typography>
                <Typography variant="h5" color="success.main" fontWeight="bold">
                  {formatCurrency(declaration.totalBonus)}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>

        {/* Submission Info */}
        <Typography variant="caption" color="text.secondary">
          Submitted: {formatDate(declaration.createdAt)}
        </Typography>

        {/* Reviewed Info (if already reviewed) */}
        {declaration.reviewedBy && (
          <Box mt={2}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Review Information
            </Typography>
            <Grid container spacing={1}>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Reviewed By
                </Typography>
                <Typography variant="body2">
                  {declaration.reviewedBy?.fullName || 'N/A'}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Reviewed At
                </Typography>
                <Typography variant="body2">
                  {formatDate(declaration.reviewedAt)}
                </Typography>
              </Grid>
              {declaration.reviewNotes && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Notes
                  </Typography>
                  <Typography variant="body2">
                    {declaration.reviewNotes}
                  </Typography>
                </Grid>
              )}
            </Grid>
          </Box>
        )}

        {/* Rejection Input */}
        {isPending && showRejectionInput && (
          <Box mt={2}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="subtitle2" gutterBottom color="error">
              Rejection Reason *
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={3}
              value={rejectionNotes}
              onChange={(e) => setRejectionNotes(e.target.value)}
              placeholder="Please provide a reason for rejecting this declaration..."
              disabled={loading}
              required
              error={!rejectionNotes.trim() && showRejectionInput}
              helperText={!rejectionNotes.trim() && showRejectionInput ? 'Required' : ''}
            />
          </Box>
        )}

        {/* Approval Notes (optional) */}
        {isPending && !showRejectionInput && (
          <Box mt={2}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="subtitle2" gutterBottom>
              Approval Notes (optional)
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={2}
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              placeholder="Add any notes about this approval..."
              disabled={loading}
            />
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
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
          showRejectionInput ? (
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
