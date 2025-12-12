import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Chip,
  Tooltip,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  CheckCircle as AvailableIcon,
  Cancel as UnavailableIcon,
  PendingActions as PendingIcon
} from '@mui/icons-material';

const AgentScheduleCalendar = ({
  year,
  month,
  schedule,
  pendingRequests = [],
  onDayClick,
  readOnly = false
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Get the number of days in the month
  const daysInMonth = new Date(year, month, 0).getDate();
  
  // Get the first day of the month (0 = Sunday, 1 = Monday, etc.)
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay();

  // Month names
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Day names
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Create pending requests map for quick lookup
  const pendingRequestsMap = {};
  pendingRequests.forEach(req => {
    pendingRequestsMap[req.day] = req;
  });

  // Get availability for a specific day
  const getAvailability = (day) => {
    if (!schedule || !schedule.availabilityMap) return false;
    const availability = schedule.availabilityMap[day.toString()];
    return availability === true;
  };

  // Check if day has pending request
  const hasPendingRequest = (day) => {
    return pendingRequestsMap[day] !== undefined;
  };

  // Get status color
  const getStatusColor = (day) => {
    if (hasPendingRequest(day)) {
      const request = pendingRequestsMap[day];
      // Show what the status will be if approved
      return request.requestedAvailability ? '#FFA726' : '#FF7043'; // Orange shades for pending
    }
    return getAvailability(day) ? '#66BB6A' : '#EF5350'; // Green for available, red for unavailable
  };

  // Get status icon
  const getStatusIcon = (day) => {
    if (hasPendingRequest(day)) {
      return <PendingIcon sx={{ fontSize: isMobile ? 16 : 20 }} />;
    }
    return getAvailability(day) ? 
      <AvailableIcon sx={{ fontSize: isMobile ? 16 : 20 }} /> : 
      <UnavailableIcon sx={{ fontSize: isMobile ? 16 : 20 }} />;
  };

  // Get tooltip text
  const getTooltipText = (day) => {
    if (hasPendingRequest(day)) {
      const request = pendingRequestsMap[day];
      return `Pending: ${request.requestedAvailability ? 'Available' : 'Unavailable'}`;
    }
    return getAvailability(day) ? 'Available' : 'Unavailable';
  };

  // Handle day click
  const handleDayClick = (day) => {
    if (!readOnly && onDayClick) {
      onDayClick(day);
    }
  };

  // Create calendar grid
  const calendarDays = [];
  
  // Add empty cells for days before the first day of month
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarDays.push(
      <Grid item xs={12/7} key={`empty-${i}`}>
        <Box sx={{ height: isMobile ? 50 : 80 }} />
      </Grid>
    );
  }

  // Add cells for each day of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const currentDay = day;
    calendarDays.push(
      <Grid item xs={12/7} key={day}>
        <Tooltip title={getTooltipText(currentDay)} arrow>
          <Paper
            elevation={hasPendingRequest(currentDay) ? 4 : 1}
            sx={{
              height: isMobile ? 50 : 80,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: readOnly ? 'default' : 'pointer',
              bgcolor: getStatusColor(currentDay),
              color: 'white',
              transition: 'all 0.2s ease',
              border: hasPendingRequest(currentDay) ? '2px solid #FF6F00' : 'none',
              '&:hover': readOnly ? {} : {
                transform: 'scale(1.05)',
                boxShadow: 4
              },
              position: 'relative'
            }}
            onClick={() => handleDayClick(currentDay)}
          >
            <Typography variant={isMobile ? 'body2' : 'h6'} fontWeight="bold">
              {currentDay}
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              {getStatusIcon(currentDay)}
            </Box>
            {hasPendingRequest(currentDay) && (
              <Chip
                label="Pending"
                size="small"
                sx={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  height: 16,
                  fontSize: '0.6rem',
                  bgcolor: 'rgba(255,255,255,0.3)'
                }}
              />
            )}
          </Paper>
        </Tooltip>
      </Grid>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" align="center" gutterBottom>
          {monthNames[month - 1]} {year}
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
          <Chip
            icon={<AvailableIcon />}
            label="Available"
            size="small"
            sx={{ bgcolor: '#66BB6A', color: 'white' }}
          />
          <Chip
            icon={<UnavailableIcon />}
            label="Unavailable"
            size="small"
            sx={{ bgcolor: '#EF5350', color: 'white' }}
          />
          <Chip
            icon={<PendingIcon />}
            label="Pending Change"
            size="small"
            sx={{ bgcolor: '#FFA726', color: 'white' }}
          />
        </Box>
      </Box>

      {/* Day headers */}
      <Grid container spacing={1} sx={{ mb: 1 }}>
        {dayNames.map((dayName) => (
          <Grid item xs={12/7} key={dayName}>
            <Typography
              variant={isMobile ? 'caption' : 'body2'}
              align="center"
              fontWeight="bold"
              color="text.secondary"
            >
              {dayName}
            </Typography>
          </Grid>
        ))}
      </Grid>

      {/* Calendar grid */}
      <Grid container spacing={1}>
        {calendarDays}
      </Grid>

      {!readOnly && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary" display="block">
            Click on any day to request an availability change
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default AgentScheduleCalendar;

