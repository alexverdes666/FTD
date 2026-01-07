import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
  Box,
  Container,
  Typography,
  Paper,
  Button,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Badge,
  CircularProgress,
  Alert,
  Grid,
  Card,
  CardContent,
  Divider
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Notifications as NotificationsIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { selectUser } from '../store/slices/authSlice';
import api from '../services/api';
import agentScheduleService from '../services/agentScheduleService';
import AgentScheduleCalendar from '../components/AgentScheduleCalendar';
import ScheduleChangeRequestModal from '../components/ScheduleChangeRequestModal';
import toast from 'react-hot-toast';

const AgentSchedulePage = () => {
  const user = useSelector(selectUser);
  const isManager = ['admin', 'affiliate_manager'].includes(user?.role);

  // State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedAgentId, setSelectedAgentId] = useState(user?.role === 'agent' ? user._id : '');
  const [agents, setAgents] = useState([]);
  const [schedule, setSchedule] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [allRequests, setAllRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [requestsModalOpen, setRequestsModalOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [allSchedules, setAllSchedules] = useState([]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  // Fetch agents list for managers
  useEffect(() => {
    if (isManager) {
      fetchAgents();
    }
  }, [isManager]);

  // Fetch schedule when date or agent changes
  useEffect(() => {
    if (selectedAgentId) {
      if (isManager) {
        fetchAllSchedules();
      } else {
        fetchSchedule();
      }
      fetchRequests();
    }
  }, [selectedAgentId, year, month]);

  const fetchAgents = async () => {
    try {
      // Fetch all agents with a high limit and filter for active agents only
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

  const fetchSchedule = async () => {
    if (!selectedAgentId) return;

    setLoading(true);
    try {
      const response = await agentScheduleService.getAgentSchedule(selectedAgentId, year, month);
      if (response.success) {
        setSchedule(response.data.schedule);
        setPendingRequests(response.data.pendingRequests || []);
      }
    } catch (error) {
      console.error('Error fetching schedule:', error);
      toast.error('Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllSchedules = async () => {
    setLoading(true);
    try {
      const response = await agentScheduleService.getAllAgentsSchedules(year, month);
      if (response.success) {
        setAllSchedules(response.data || []);
        
        // Find the selected agent's schedule
        const agentSchedule = response.data.find(s => s.agentId._id === selectedAgentId);
        if (agentSchedule) {
          setSchedule(agentSchedule);
          // Note: pending requests are not included in the all schedules response
          // We need to fetch them separately
        }
      }
    } catch (error) {
      console.error('Error fetching all schedules:', error);
      toast.error('Failed to load schedules');
    } finally {
      setLoading(false);
    }
  };

  const fetchRequests = async () => {
    try {
      const filters = isManager ? {} : { agentId: selectedAgentId };
      const response = await agentScheduleService.getScheduleChangeRequests(filters);
      if (response.success) {
        setAllRequests(response.data || []);
        
        // Filter pending requests for current agent/month
        const pending = response.data.filter(
          req => req.agentId._id === selectedAgentId && 
                 req.year === year && 
                 req.month === month && 
                 req.status === 'pending'
        );
        setPendingRequests(pending);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    }
  };

  const handlePreviousMonth = () => {
    setCurrentDate(new Date(year, month - 2, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month, 1));
  };

  const handleDayClick = (day) => {
    setSelectedDay(day);
    setConfirmDialogOpen(true);
  };

  const handleRequestChange = async () => {
    if (!selectedDay) return;

    try {
      // Get current availability
      const currentAvailability = schedule?.availabilityMap?.[selectedDay.toString()] === true;
      const requestedAvailability = !currentAvailability;

      await agentScheduleService.requestScheduleChange(
        selectedAgentId,
        year,
        month,
        selectedDay,
        requestedAvailability
      );

      toast.success('Schedule change request submitted');
      setConfirmDialogOpen(false);
      setSelectedDay(null);
      
      // Refresh data
      fetchSchedule();
      fetchRequests();
    } catch (error) {
      console.error('Error requesting change:', error);
      toast.error(error.response?.data?.message || 'Failed to submit request');
    }
  };

  const handleApproveRequest = async (requestId) => {
    try {
      // If requestId is null, it's from bulk approval - just refresh
      if (requestId !== null) {
        await agentScheduleService.approveScheduleChange(requestId);
      }
      // Refresh data
      if (isManager) {
        fetchAllSchedules();
      } else {
        fetchSchedule();
      }
      fetchRequests();
    } catch (error) {
      throw error;
    }
  };

  const handleRejectRequest = async (requestId, reason) => {
    try {
      await agentScheduleService.rejectScheduleChange(requestId, reason);
      // Refresh data
      fetchRequests();
    } catch (error) {
      throw error;
    }
  };

  const getCurrentAvailability = () => {
    if (!selectedDay || !schedule) return false;
    return schedule.availabilityMap?.[selectedDay.toString()] === true;
  };

  const getPendingRequestsCount = () => {
    return allRequests.filter(req => req.status === 'pending').length;
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <Box sx={{ width: "100%", typography: "body1" }}>
      <Box sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Typography variant="h4" fontWeight="bold">
            {isManager ? 'Agent Schedules' : 'My Schedule'}
          </Typography>
          <Button
            variant="outlined"
            startIcon={
              <Badge badgeContent={getPendingRequestsCount()} color="error">
                <NotificationsIcon />
              </Badge>
            }
            onClick={() => setRequestsModalOpen(true)}
          >
            View Requests
          </Button>
        </Box>

        {/* Agent Selection (Manager View) */}
        {isManager && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <FormControl fullWidth>
              <InputLabel>Select Agent</InputLabel>
              <Select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                label="Select Agent"
              >
                {agents.map((agent) => (
                  <MenuItem key={agent._id} value={agent._id}>
                    {agent.fullName} ({agent.fourDigitCode})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Paper>
        )}

        {/* Calendar Section */}
        <Paper sx={{ p: 3, mb: 3 }}>
          {/* Month Navigation */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <IconButton onClick={handlePreviousMonth}>
              <ChevronLeftIcon />
            </IconButton>
            <Typography variant="h5" fontWeight="bold">
              {monthNames[month - 1]} {year}
            </Typography>
            <IconButton onClick={handleNextMonth}>
              <ChevronRightIcon />
            </IconButton>
          </Box>

          {/* Calendar */}
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : !selectedAgentId ? (
            <Alert severity="info">Please select an agent to view their schedule</Alert>
          ) : schedule ? (
            <AgentScheduleCalendar
              year={year}
              month={month}
              schedule={schedule}
              pendingRequests={pendingRequests}
              onDayClick={user?.role === 'agent' ? handleDayClick : null}
              readOnly={isManager}
            />
          ) : (
            <Alert severity="info">No schedule data available</Alert>
          )}
        </Paper>

        {/* Manager Stats */}
        {isManager && allSchedules.length > 0 && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Overview for {monthNames[month - 1]} {year}
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Grid container spacing={2}>
              {allSchedules.slice(0, 5).map((agentSchedule) => {
                const availableDays = Object.values(agentSchedule.availabilityMap || {}).filter(v => v === true).length;
                const totalDays = new Date(year, month, 0).getDate();
                
                return (
                  <Grid item xs={12} sm={6} md={4} key={agentSchedule.agentId._id}>
                    <Card variant="outlined">
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <PersonIcon color="primary" />
                          <Typography variant="subtitle2">
                            {agentSchedule.agentId.fullName}
                          </Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          Available: {availableDays}/{totalDays} days
                        </Typography>
                        {agentSchedule.pendingRequestsCount > 0 && (
                          <Badge badgeContent={agentSchedule.pendingRequestsCount} color="warning" sx={{ mt: 1 }}>
                            <Typography variant="caption" color="warning.main">
                              Pending requests
                            </Typography>
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </Paper>
        )}
      </Box>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)}>
        <DialogTitle>Request Schedule Change</DialogTitle>
        <DialogContent>
          <Typography>
            Do you want to request to be <strong>{getCurrentAvailability() ? 'unavailable' : 'available'}</strong> on{' '}
            <strong>{monthNames[month - 1]} {selectedDay}, {year}</strong>?
          </Typography>
          <Alert severity="info" sx={{ mt: 2 }}>
            This request will need to be approved by a manager before it takes effect.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleRequestChange} variant="contained">
            Submit Request
          </Button>
        </DialogActions>
      </Dialog>

      {/* Requests Modal */}
      <ScheduleChangeRequestModal
        open={requestsModalOpen}
        onClose={() => setRequestsModalOpen(false)}
        requests={allRequests}
        onApprove={handleApproveRequest}
        onReject={handleRejectRequest}
        isManager={isManager}
      />
    </Box>
  );
};

export default AgentSchedulePage;

