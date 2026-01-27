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
  MenuItem,
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
  Send as SendIcon,
} from '@mui/icons-material';
import { createDeclaration, previewBonus } from '../services/callDeclarations';

const CALL_TYPES = [
  { value: 'deposit', label: 'Deposit Call', bonus: 10.0 },
  { value: 'first_call', label: 'First Call', bonus: 7.5 },
  { value: 'second_call', label: 'Second Call', bonus: 7.5 },
  { value: 'third_call', label: '3rd Call', bonus: 5.0 },
  { value: 'fourth_call', label: '4th Call', bonus: 10.0 },
];

const CallDeclarationDialog = ({ open, onClose, call, onDeclarationCreated }) => {
  const [callType, setCallType] = useState('');
  const [description, setDescription] = useState('');
  const [bonusPreview, setBonusPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState(null);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setCallType('');
      setDescription('');
      setBonusPreview(null);
      setError(null);
    }
  }, [open]);

  // Calculate bonus preview when call type changes
  useEffect(() => {
    if (callType && call?.callDuration) {
      calculateBonusPreview();
    } else {
      setBonusPreview(null);
    }
  }, [callType, call]);

  const calculateBonusPreview = async () => {
    if (!callType || !call?.callDuration) return;

    setPreviewLoading(true);
    try {
      const preview = await previewBonus(callType, call.callDuration);
      setBonusPreview(preview);
    } catch (err) {
      console.error('Error calculating bonus preview:', err);
      // Fallback to local calculation
      const baseBonus = CALL_TYPES.find(t => t.value === callType)?.bonus || 0;
      let hourlyBonus = 0;
      if (call.callDuration > 3600) {
        const additionalHours = Math.floor((call.callDuration - 3600) / 3600);
        hourlyBonus = additionalHours * 10;
      }
      setBonusPreview({
        baseBonus,
        hourlyBonus,
        totalBonus: baseBonus + hourlyBonus,
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!callType) {
      setError('Please select a call type');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const declarationData = {
        cdrCallId: call.cdrCallId,
        callDate: call.callDate,
        callDuration: call.callDuration,
        sourceNumber: call.sourceNumber,
        destinationNumber: call.destinationNumber,
        callType,
        description: description.trim() || undefined,
      };

      const newDeclaration = await createDeclaration(declarationData);
      onDeclarationCreated(newDeclaration);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create declaration');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  const formatCurrency = (value) => `$${Number(value).toFixed(2)}`;

  if (!call) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <PhoneIcon color="primary" />
          <Typography variant="h6">Declare Call Bonus</Typography>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Call Details */}
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Call Details
        </Typography>
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">
                Date & Time
              </Typography>
              <Typography variant="body2">
                {formatDate(call.callDate)}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">
                Duration
              </Typography>
              <Box display="flex" alignItems="center" gap={0.5}>
                <AccessTimeIcon fontSize="small" color="action" />
                <Typography variant="body2" fontWeight="medium">
                  {call.formattedDuration}
                </Typography>
                {call.callDuration >= 3600 && (
                  <Chip
                    label="+$10/hr bonus"
                    size="small"
                    color="success"
                    variant="outlined"
                    sx={{ ml: 1 }}
                  />
                )}
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">
                Source
              </Typography>
              <Typography variant="body2" fontFamily="monospace">
                {call.sourceNumber}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">
                Destination
              </Typography>
              <Typography variant="body2" fontFamily="monospace">
                {call.destinationNumber}
              </Typography>
            </Grid>
          </Grid>
        </Paper>

        <Divider sx={{ mb: 3 }} />

        {/* Declaration Form */}
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Declaration Details
        </Typography>

        <TextField
          select
          fullWidth
          label="Call Type *"
          value={callType}
          onChange={(e) => setCallType(e.target.value)}
          disabled={loading}
          sx={{ mb: 2 }}
          helperText="Select the type of call for bonus calculation"
        >
          {CALL_TYPES.map((type) => (
            <MenuItem key={type.value} value={type.value}>
              <Box display="flex" justifyContent="space-between" width="100%">
                <span>{type.label}</span>
                <Chip
                  label={formatCurrency(type.bonus)}
                  size="small"
                  color="success"
                  variant="outlined"
                  sx={{ ml: 2 }}
                />
              </Box>
            </MenuItem>
          ))}
        </TextField>

        <TextField
          fullWidth
          multiline
          rows={3}
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={loading}
          placeholder="Provide details about the call (e.g., client name, outcome, etc.)"
          sx={{ mb: 3 }}
          inputProps={{ maxLength: 1000 }}
          helperText={`${description.length}/1000 characters`}
        />

        {/* Bonus Preview */}
        {callType && (
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              bgcolor: 'success.50',
              borderColor: 'success.main',
            }}
          >
            <Typography variant="subtitle2" gutterBottom display="flex" alignItems="center" gap={1}>
              <MoneyIcon color="success" />
              Bonus Preview
            </Typography>

            {previewLoading ? (
              <Box display="flex" justifyContent="center" py={1}>
                <CircularProgress size={24} />
              </Box>
            ) : bonusPreview ? (
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Base Bonus
                  </Typography>
                  <Typography variant="body1">
                    {formatCurrency(bonusPreview.baseBonus)}
                  </Typography>
                </Grid>
                {bonusPreview.hourlyBonus > 0 && (
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Hourly Bonus (+1hr)
                    </Typography>
                    <Typography variant="body1">
                      {formatCurrency(bonusPreview.hourlyBonus)}
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
                      {formatCurrency(bonusPreview.totalBonus)}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            ) : null}
          </Paper>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSubmit}
          disabled={loading || !callType}
          startIcon={loading ? <CircularProgress size={16} /> : <SendIcon />}
        >
          {loading ? 'Submitting...' : 'Submit Declaration'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CallDeclarationDialog;
