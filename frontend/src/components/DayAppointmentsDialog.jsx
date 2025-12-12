import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Divider,
  Chip
} from '@mui/material';
import {
  Close as CloseIcon,
  Person as PersonIcon,
  AccessTime as TimeIcon
} from '@mui/icons-material';

const DayAppointmentsDialog = ({ 
  open, 
  onClose, 
  appointments,
  date
}) => {
  // Format hour for display
  const formatHour = (hour) => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
  };

  // Sort appointments by hour
  const sortedAppointments = [...appointments].sort((a, b) => a.hour - b.hour);

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
            AM Call Appointments - {date}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {sortedAppointments.length === 0 ? (
          <Box textAlign="center" py={3}>
            <Typography color="text.secondary">
              No appointments scheduled for this day
            </Typography>
          </Box>
        ) : (
          <List>
            {sortedAppointments.map((apt, index) => (
              <React.Fragment key={apt._id}>
                {index > 0 && <Divider />}
                <ListItem sx={{ py: 2 }}>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <PersonIcon color="primary" fontSize="small" />
                        <Typography variant="subtitle1" fontWeight="bold">
                          {apt.agentId?.fullName || 'Unknown Agent'}
                        </Typography>
                        <Chip 
                          label={apt.agentId?.fourDigitCode || 'N/A'} 
                          size="small" 
                          variant="outlined"
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                          <TimeIcon fontSize="small" color="action" />
                          <Typography variant="body2">
                            <strong>Time:</strong> {formatHour(apt.hour)} ({apt.hour}:00)
                          </Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          <strong>FTD:</strong> {apt.ftdName}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DayAppointmentsDialog;

