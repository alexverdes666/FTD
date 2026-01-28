import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Box,
  Typography,
  Divider,
  Alert,
  CircularProgress,
  InputAdornment,
  Chip,
} from '@mui/material';
import {
  Gavel as GavelIcon,
  Cancel as CancelIcon,
  Check as CheckIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { createAgentFine } from '../services/agentFines';
import FineImageUpload from './FineImageUpload';
import MonthYearSelector from './common/MonthYearSelector';
import dayjs from 'dayjs';

const ApplyAgentFineDialog = ({
  open,
  onClose,
  onSuccess,
  agent,
  lead,
  orderId,
}) => {
  const [formData, setFormData] = useState({
    amount: '',
    reason: '',
    description: '',
    notes: '',
  });
  const [fineDate, setFineDate] = useState(dayjs());
  const [fineImages, setFineImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleClose = () => {
    setFormData({
      amount: '',
      reason: '',
      description: '',
      notes: '',
    });
    setFineDate(dayjs());
    setFineImages([]);
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setError('Please enter a valid fine amount');
      return;
    }

    if (!formData.reason.trim()) {
      setError('Please enter a reason for the fine');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createAgentFine(agent._id, {
        amount: parseFloat(formData.amount),
        reason: formData.reason.trim(),
        description: formData.description.trim(),
        notes: formData.notes.trim(),
        fineMonth: fineDate.month() + 1,
        fineYear: fineDate.year(),
        images: fineImages.map(img => img._id),
        leadId: lead?._id,
        orderId: orderId,
      });

      if (onSuccess) {
        onSuccess();
      }
      handleClose();
    } catch (err) {
      console.error('Failed to create fine:', err);
      setError(err.response?.data?.message || 'Failed to create fine');
    } finally {
      setLoading(false);
    }
  };

  const leadName = lead ? `${lead.firstName || ''} ${lead.lastName || ''}`.trim() : '';

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <GavelIcon color="warning" />
          <Typography variant="h6">Apply Fine to Agent</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Context Information */}
        <Box sx={{ mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Box display="flex" alignItems="center" gap={1}>
                <PersonIcon fontSize="small" color="primary" />
                <Typography variant="subtitle2">Agent:</Typography>
                <Chip
                  label={agent?.fullName || 'Unknown Agent'}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              </Box>
            </Grid>
            {lead && leadName && (
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Lead: {leadName}
                </Typography>
              </Grid>
            )}
          </Grid>
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Fine Amount"
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
              }}
              inputProps={{ min: 0, step: 0.01 }}
              required
              disabled={loading}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="subtitle2" gutterBottom>
              Fine Month & Year
            </Typography>
            <MonthYearSelector
              selectedDate={fineDate}
              onDateChange={setFineDate}
              showCurrentSelection={false}
              size="small"
              disabled={loading}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Reason"
              value={formData.reason}
              onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
              required
              disabled={loading}
              placeholder="e.g., Missed deposit confirmation, Late response to lead"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Description"
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              disabled={loading}
              placeholder="Provide additional details about the fine..."
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Notes (Internal)"
              multiline
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              disabled={loading}
              placeholder="Internal notes (not visible to agent)"
            />
          </Grid>
          <Grid item xs={12}>
            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle2" gutterBottom>
              Evidence Images (Optional)
            </Typography>
            <FineImageUpload
              images={fineImages}
              onImagesChange={setFineImages}
              maxImages={5}
              disabled={loading}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} startIcon={<CancelIcon />} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="warning"
          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <CheckIcon />}
          disabled={loading || !formData.amount || !formData.reason.trim()}
        >
          {loading ? 'Applying...' : 'Apply Fine'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ApplyAgentFineDialog;
