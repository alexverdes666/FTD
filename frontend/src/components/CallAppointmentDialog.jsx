import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  IconButton,
  Alert
} from '@mui/material';
import {
  Close as CloseIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import agentCallAppointmentService from '../services/agentCallAppointmentService';

const CallAppointmentDialog = ({ 
  open, 
  onClose, 
  appointment, 
  agentId,
  year,
  month,
  day,
  onSave,
  onDelete
}) => {
  const [formData, setFormData] = useState({
    hour: '',
    ftdName: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isEditMode = Boolean(appointment);

  // Initialize form data when dialog opens
  useEffect(() => {
    if (open) {
      if (isEditMode) {
        setFormData({
          hour: appointment.hour !== undefined ? appointment.hour : '',
          ftdName: appointment.ftdName || ''
        });
      } else {
        setFormData({
          hour: '',
          ftdName: ''
        });
      }
      setError('');
    }
  }, [open, appointment, isEditMode]);

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (formData.hour === '') {
      setError('Please select an hour');
      return;
    }
    if (!formData.ftdName.trim()) {
      setError('Please enter FTD name');
      return;
    }

    setLoading(true);
    try {
      if (isEditMode) {
        // Update existing appointment
        const response = await agentCallAppointmentService.updateAppointment(
          appointment._id,
          {
            hour: parseInt(formData.hour),
            ftdName: formData.ftdName.trim()
          }
        );
        toast.success('Appointment updated successfully');
        onSave(response.data);
      } else {
        // Create new appointment
        const response = await agentCallAppointmentService.createAppointment({
          agentId,
          year,
          month,
          day,
          hour: parseInt(formData.hour),
          ftdName: formData.ftdName.trim()
        });
        toast.success('Appointment created successfully');
        onSave(response.data);
      }
      onClose();
    } catch (error) {
      console.error('Error saving appointment:', error);
      const errorMessage = error.response?.data?.message || 'Failed to save appointment';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this appointment?')) {
      return;
    }

    setLoading(true);
    try {
      await agentCallAppointmentService.deleteAppointment(appointment._id);
      toast.success('Appointment deleted successfully');
      onDelete(appointment._id);
      onClose();
    } catch (error) {
      console.error('Error deleting appointment:', error);
      const errorMessage = error.response?.data?.message || 'Failed to delete appointment';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Format hour for display
  const formatHour = (hour) => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            {isEditMode ? 'Edit AM Call Appointment' : 'Add AM Call Appointment'}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {error && (
              <Alert severity="error" onClose={() => setError('')}>
                {error}
              </Alert>
            )}

            <TextField
              label="Date"
              value={`${month}/${day}/${year}`}
              disabled
              fullWidth
            />

            <FormControl fullWidth required>
              <InputLabel>Hour GMT+2</InputLabel>
              <Select
                value={formData.hour}
                onChange={(e) => handleChange('hour', e.target.value)}
                label="Hour"
              >
                {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
                  <MenuItem key={hour} value={hour}>
                    {formatHour(hour)} ({hour}:00)
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="FTD Name"
              value={formData.ftdName}
              onChange={(e) => handleChange('ftdName', e.target.value)}
              required
              fullWidth
              placeholder="Enter FTD name"
              inputProps={{ maxLength: 100 }}
            />
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
          <Box>
            {isEditMode && (
              <Button
                onClick={handleDelete}
                color="error"
                startIcon={<DeleteIcon />}
                disabled={loading}
              >
                Delete
              </Button>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
            >
              {loading ? 'Saving...' : (isEditMode ? 'Update' : 'Create')}
            </Button>
          </Box>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default CallAppointmentDialog;

