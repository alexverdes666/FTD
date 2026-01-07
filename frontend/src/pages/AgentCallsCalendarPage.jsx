import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
  Box,
  Container,
  Typography,
  Paper,
  IconButton,
  Card,
  CardContent,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  Divider
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon
} from '@mui/icons-material';
import { selectUser } from '../store/slices/authSlice';
import api from '../services/api';
import agentCallAppointmentService from '../services/agentCallAppointmentService';
import CallAppointmentDialog from '../components/CallAppointmentDialog';
import DayAppointmentsDialog from '../components/DayAppointmentsDialog';
import toast from 'react-hot-toast';

const AgentCallsCalendarPage = () => {
  const user = useSelector(selectUser);
  const isManager = ['admin', 'affiliate_manager'].includes(user?.role);
  const isAgent = user?.role === 'agent';

  // State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [agents, setAgents] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayViewDialogOpen, setDayViewDialogOpen] = useState(false);
  const [dayViewAppointments, setDayViewAppointments] = useState([]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  // Initialize selectedAgentId for agents (must always be their own ID)
  useEffect(() => {
    if (isAgent && user?._id && selectedAgentId !== user._id) {
      setSelectedAgentId(user._id);
    }
  }, [isAgent, user, selectedAgentId]);

  // Fetch agents list for managers (not needed anymore, but keeping for potential future use)
  useEffect(() => {
    if (isManager) {
      fetchAgents();
    }
  }, [isManager]);

  // Fetch appointments when date or agent changes
  // IMPORTANT: Agents only see their own appointments, Managers see all appointments
  useEffect(() => {
    if (isAgent && selectedAgentId) {
      fetchAppointments(); // Fetches ONLY this agent's appointments
    } else if (isManager) {
      fetchAllAppointments(); // Fetches ALL agents' appointments
    }
  }, [selectedAgentId, year, month, isAgent, isManager]);

  const fetchAgents = async () => {
    try {
      const response = await api.get('/users?role=agent&isActive=true&limit=1000');
      if (response.data.success) {
        setAgents(response.data.data || []);
        if (response.data.data.length > 0 && !selectedAgentId) {
          setSelectedAgentId(response.data.data[0]._id);
        }
      }
    } catch (error) {
      console.error('Error fetching agents:', error);
      toast.error('Failed to load agents');
    }
  };

  const fetchAppointments = async () => {
    if (!selectedAgentId) return;
    
    // SECURITY: Ensure agents can only fetch their own appointments
    if (isAgent && selectedAgentId !== user._id) {
      console.error('Security violation: Agent attempting to access another agent\'s appointments');
      toast.error('Access denied');
      return;
    }

    setLoading(true);
    try {
      const response = await agentCallAppointmentService.getAgentAppointments(selectedAgentId, year, month);
      
      if (response.success) {
        setAppointments(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
      toast.error('Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllAppointments = async () => {
    // SECURITY: Only managers can fetch all appointments
    if (!isManager) {
      console.error('Security violation: Non-manager attempting to access all appointments');
      toast.error('Access denied');
      return;
    }

    setLoading(true);
    try {
      const response = await agentCallAppointmentService.getAllAppointments(year, month);
      
      if (response.success) {
        setAppointments(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
      toast.error('Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  const handlePreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleAddAppointment = (day) => {
    // SECURITY: Only agents can add appointments, and only for themselves
    if (!isAgent) {
      toast.error('Only agents can create appointments');
      return;
    }
    
    setSelectedDay(day);
    setSelectedAppointment(null);
    setDialogOpen(true);
  };

  const handleDayClick = (day) => {
    if (isManager) {
      // Show all appointments for this day
      const dayAppts = getAppointmentsForDay(day);
      setDayViewAppointments(dayAppts);
      setSelectedDay(day);
      setDayViewDialogOpen(true);
    } else {
      // Agent: add appointment
      handleAddAppointment(day);
    }
  };

  const handleEditAppointment = (appointment) => {
    // SECURITY: Only agents can edit appointments, and only their own
    if (!isAgent) {
      toast.error('Only agents can edit their appointments');
      return;
    }
    
    // SECURITY: Verify this appointment belongs to the logged-in agent
    const appointmentAgentId = appointment.agentId?._id || appointment.agentId;
    if (appointmentAgentId !== user._id) {
      toast.error('You can only edit your own appointments');
      return;
    }
    
    setSelectedDay(appointment.day);
    setSelectedAppointment(appointment);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedAppointment(null);
    setSelectedDay(null);
  };

  const handleSaveAppointment = (savedAppointment) => {
    if (isAgent) {
      fetchAppointments();
    } else {
      fetchAllAppointments();
    }
  };

  const handleDeleteAppointment = (appointmentId) => {
    if (isAgent) {
      fetchAppointments();
    } else {
      fetchAllAppointments();
    }
  };

  const handleCloseDayView = () => {
    setDayViewDialogOpen(false);
    setDayViewAppointments([]);
    setSelectedDay(null);
  };

  // Get appointments for a specific day
  const getAppointmentsForDay = (day) => {
    const dayAppointments = appointments.filter(apt => apt.day === day);
    
    // SECURITY: For agents, double-check that all appointments belong to them
    if (isAgent) {
      return dayAppointments.filter(apt => 
        apt.agentId?._id === user._id || apt.agentId === user._id
      );
    }
    
    return dayAppointments;
  };

  // Format hour for display
  const formatHour = (hour) => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
  };

  // Generate calendar days
  const getDaysInMonth = () => {
    return new Date(year, month, 0).getDate();
  };

  const getFirstDayOfMonth = () => {
    return new Date(year, month - 1, 1).getDay();
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth();
    const firstDay = getFirstDayOfMonth();
    const days = [];

    // Add empty cells for days before the first of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(
        <Grid item xs={12} sm={6} md={4} lg={3} key={`empty-${i}`}>
          <Card sx={{ minHeight: 150, bgcolor: 'grey.100' }}>
            <CardContent>
              <Typography color="text.disabled">&nbsp;</Typography>
            </CardContent>
          </Card>
        </Grid>
      );
    }

    // Add calendar days
    for (let day = 1; day <= daysInMonth; day++) {
      const dayAppointments = getAppointmentsForDay(day);
      const isToday = new Date().getDate() === day && 
                      new Date().getMonth() === month - 1 && 
                      new Date().getFullYear() === year;

      days.push(
        <Grid item xs={12} sm={6} md={4} lg={3} key={day}>
          <Card 
            sx={{ 
              minHeight: 150,
              border: isToday ? '2px solid' : 'none',
              borderColor: 'primary.main',
              cursor: 'pointer',
              '&:hover': {
                boxShadow: 3,
                transform: 'translateY(-2px)',
                transition: 'all 0.2s'
              }
            }}
            onClick={() => handleDayClick(day)}
          >
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="h6" fontWeight="bold">
                  {day}
                </Typography>
                {isToday && (
                  <Chip label="Today" size="small" color="primary" />
                )}
              </Box>
              
              <Divider sx={{ my: 1 }} />
              
              {isManager ? (
                // Manager view: Show appointment count and summary
                dayAppointments.length > 0 ? (
                  <Box sx={{ mt: 1 }}>
                    <Chip 
                      label={`${dayAppointments.length} appointment${dayAppointments.length !== 1 ? 's' : ''}`}
                      color="primary"
                      size="small"
                      sx={{ mb: 1 }}
                    />
                    <Typography variant="caption" display="block" color="text.secondary">
                      Click to view details
                    </Typography>
                  </Box>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    No appointments
                  </Typography>
                )
              ) : (
                // Agent view: Show their appointments
                dayAppointments.length > 0 ? (
                  <Box sx={{ mt: 1 }}>
                    {dayAppointments.map((apt) => (
                      <Box
                        key={apt._id}
                        sx={{
                          mb: 1,
                          p: 1,
                          bgcolor: 'primary.light',
                          borderRadius: 1,
                          cursor: 'pointer',
                          '&:hover': {
                            bgcolor: 'primary.main',
                            color: 'white'
                          }
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditAppointment(apt);
                        }}
                      >
                        <Typography variant="caption" display="block" fontWeight="bold">
                          {formatHour(apt.hour)}
                        </Typography>
                        <Typography variant="caption" display="block">
                          {apt.ftdName}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    Click to add
                  </Typography>
                )
              )}
            </CardContent>
          </Card>
        </Grid>
      );
    }

    return days;
  };

  return (
    <Box sx={{ width: "100%", typography: "body1" }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom fontWeight="bold">
          AM Calls Calendar
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {isAgent ? 'Schedule your FTD AM call appointments' : 'View agent call schedules'}
        </Typography>
      </Box>

      {/* Controls */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" justifyContent="center" alignItems="center" gap={2}>
          <IconButton onClick={handlePreviousMonth} color="primary">
            <ChevronLeftIcon />
          </IconButton>
          <Typography variant="h5" fontWeight="bold" sx={{ minWidth: 200, textAlign: 'center' }}>
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Typography>
          <IconButton onClick={handleNextMonth} color="primary">
            <ChevronRightIcon />
          </IconButton>
        </Box>
      </Paper>

      {/* Info Alert */}
      {isAgent && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Click on any day to add a new appointment, or click on an existing appointment to edit it.
        </Alert>
      )}

      {isManager && (
        <Alert severity="info" sx={{ mb: 3 }}>
          You are viewing all agents' call schedules. Click on any day to see which agents have scheduled appointments.
        </Alert>
      )}

      {/* Calendar Grid */}
      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Day of week headers */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={day}>
                <Typography variant="subtitle2" fontWeight="bold" textAlign="center" color="primary">
                  {day}
                </Typography>
              </Grid>
            ))}
          </Grid>

          {/* Calendar days */}
          <Grid container spacing={2}>
            {renderCalendar()}
          </Grid>
        </>
      )}

      {/* Appointment Dialog for Agents */}
      {isAgent && (
        <CallAppointmentDialog
          open={dialogOpen}
          onClose={handleDialogClose}
          appointment={selectedAppointment}
          agentId={selectedAgentId}
          year={year}
          month={month}
          day={selectedDay}
          onSave={handleSaveAppointment}
          onDelete={handleDeleteAppointment}
        />
      )}

      {/* Day View Dialog for Managers */}
      {isManager && (
        <DayAppointmentsDialog
          open={dayViewDialogOpen}
          onClose={handleCloseDayView}
          appointments={dayViewAppointments}
          date={selectedDay ? `${month}/${selectedDay}/${year}` : ''}
        />
      )}
    </Box>
  );
};

export default AgentCallsCalendarPage;

