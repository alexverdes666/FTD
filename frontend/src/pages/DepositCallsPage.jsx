import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  Chip,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Divider,
  Badge
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Sync as SyncIcon,
  Verified as VerifiedIcon,
  CalendarMonth as CalendarIcon,
  TableChart as TableIcon,
  Cancel as RejectIcon,
  Schedule as ScheduleIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Person as PersonIcon,
  FormatListBulleted as ListIcon,
  FilterList as FilterListIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { selectUser } from '../store/slices/authSlice';
import depositCallsService from '../services/depositCallsService';
import api from '../services/api';
import toast from 'react-hot-toast';
import { formatPhoneWithCountryCode } from '../utils/phoneUtils';

// Call status colors
const getStatusColor = (status) => {
  switch (status) {
    case 'completed': return 'success';
    case 'answered': return 'success';
    case 'pending_approval': return 'warning';
    case 'scheduled': return 'info';
    case 'rejected': return 'error';
    case 'skipped': return 'default';
    default: return 'default';
  }
};

// Format date for display
const formatDateTime = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};


// Call Cell Component
const CallCell = ({ call, callNumber, depositCall, onSchedule, onMarkDone, onApprove, onReject, onMarkAnswered, onMarkRejected, isAdmin, isAM, isAgent }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expectedDate, setExpectedDate] = useState(call?.expectedDate ? new Date(call.expectedDate) : null);
  const [notes, setNotes] = useState('');

  const handleSchedule = async () => {
    if (!expectedDate) {
      toast.error('Please select a date and time');
      return;
    }
    await onSchedule(depositCall._id, callNumber, expectedDate.toISOString(), notes);
    setDialogOpen(false);
    setNotes('');
  };

  const handleMarkDone = async () => {
    await onMarkDone(depositCall._id, callNumber, notes);
    setDialogOpen(false);
    setNotes('');
  };

  const canSchedule = isAgent || isAM || isAdmin;
  const canMarkDone = isAgent || isAM || isAdmin;
  const canApprove = (isAM || isAdmin) && call?.status === 'pending_approval';

  return (
    <TableCell sx={{ p: '2px 4px' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center', minWidth: 48 }}>
        {call?.status === 'pending' ? (
          <Button
            size="small"
            variant="outlined"
            color="primary"
            onClick={() => setDialogOpen(true)}
            disabled={!canSchedule}
            sx={{ fontSize: '0.55rem', py: 0, px: 0.5, minWidth: 'auto', lineHeight: 1.4 }}
          >
            Schedule
          </Button>
        ) : call?.status === 'scheduled' ? (
          <>
            <Typography sx={{ fontSize: '0.55rem', lineHeight: 1.2, color: 'info.main', fontWeight: 'bold' }}>
              {formatDateTime(call.expectedDate)}
            </Typography>
            {canMarkDone && (
              <Button
                size="small"
                variant="contained"
                color="success"
                onClick={() => setDialogOpen(true)}
                sx={{ fontSize: '0.55rem', py: 0, px: 0.5, minWidth: 'auto', lineHeight: 1.4 }}
              >
                Done
              </Button>
            )}
          </>
        ) : call?.status === 'pending_approval' ? (
          <>
            <Tooltip title={`Done: ${formatDateTime(call.doneDate)}`}>
              <Chip label="Pending" size="small" color="warning" sx={{ fontSize: '0.5rem', height: 15, '& .MuiChip-label': { px: 0.5 } }} />
            </Tooltip>
            {canApprove && (
              <Box sx={{ display: 'flex', gap: '2px' }}>
                <Tooltip title="Mark as Answered">
                  <Button
                    size="small"
                    variant="contained"
                    color="success"
                    onClick={() => onMarkAnswered(depositCall._id, callNumber)}
                    sx={{ fontSize: '0.5rem', py: 0, px: '3px', minWidth: 'auto', lineHeight: 1.4 }}
                  >
                    OK
                  </Button>
                </Tooltip>
                <Tooltip title="Mark as Rejected">
                  <Button
                    size="small"
                    variant="contained"
                    color="error"
                    onClick={() => onMarkRejected(depositCall._id, callNumber)}
                    sx={{ fontSize: '0.5rem', py: 0, px: '3px', minWidth: 'auto', lineHeight: 1.4 }}
                  >
                    Rej
                  </Button>
                </Tooltip>
                <Tooltip title="Retry">
                  <Button
                    size="small"
                    variant="outlined"
                    color="warning"
                    onClick={() => onReject(depositCall._id, callNumber)}
                    sx={{ fontSize: '0.5rem', py: 0, px: '3px', minWidth: 'auto', lineHeight: 1.4 }}
                  >
                    Retry
                  </Button>
                </Tooltip>
              </Box>
            )}
          </>
        ) : call?.status === 'answered' ? (
          <Tooltip title={call.approvedAt ? formatDateTime(call.approvedAt) : formatDateTime(call.doneDate)}>
            <Chip label="Answered" size="small" color="success" sx={{ fontSize: '0.5rem', height: 15, '& .MuiChip-label': { px: 0.5 } }} />
          </Tooltip>
        ) : call?.status === 'rejected' ? (
          <Tooltip title={call.approvedAt ? formatDateTime(call.approvedAt) : formatDateTime(call.doneDate)}>
            <Chip label="Rejected" size="small" color="error" sx={{ fontSize: '0.5rem', height: 15, '& .MuiChip-label': { px: 0.5 } }} />
          </Tooltip>
        ) : call?.status === 'completed' ? (
          <Tooltip title={call.approvedAt ? formatDateTime(call.approvedAt) : formatDateTime(call.doneDate)}>
            <Chip label="Approved" size="small" color="success" sx={{ fontSize: '0.5rem', height: 15, '& .MuiChip-label': { px: 0.5 } }} />
          </Tooltip>
        ) : (
          <Typography sx={{ fontSize: '0.55rem', color: 'text.secondary' }}>-</Typography>
        )}
      </Box>

      {/* Schedule/Mark Done Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {call?.status === 'scheduled' ? `Mark Call ${callNumber} as Done` : `Schedule Call ${callNumber}`}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              FTD: <strong>{depositCall.ftdName}</strong>
            </Typography>
            {call?.status !== 'scheduled' && (
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DateTimePicker
                  label="Expected Date & Time"
                  value={expectedDate}
                  onChange={setExpectedDate}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </LocalizationProvider>
            )}
            <TextField
              label="Notes (optional)"
              multiline
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          {call?.status === 'scheduled' ? (
            <Button onClick={handleMarkDone} variant="contained" color="success">
              Mark as Done
            </Button>
          ) : (
            <Button onClick={handleSchedule} variant="contained" color="primary">
              Schedule
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </TableCell>
  );
};

const DepositCallsPage = () => {
  const user = useSelector(selectUser);
  const isAdmin = user?.role === 'admin';
  const isAM = user?.role === 'affiliate_manager';
  const isAgent = user?.role === 'agent';

  // State
  const [tabValue, setTabValue] = useState(0); // 0 = Table, 1 = Calendar
  const [depositCalls, setDepositCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filters
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedAM, setSelectedAM] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [selectedBroker, setSelectedBroker] = useState('');
  const [selectedClientNetwork, setSelectedClientNetwork] = useState('');
  const [selectedOurNetwork, setSelectedOurNetwork] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [status, setStatus] = useState('active');
  
  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalCount, setTotalCount] = useState(0);

  // Data for filters
  const [accountManagers, setAccountManagers] = useState([]);
  const [agents, setAgents] = useState([]);
  const [brokers, setBrokers] = useState([]);
  const [clientNetworks, setClientNetworks] = useState([]);
  const [ourNetworks, setOurNetworks] = useState([]);

  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarEvents, setCalendarEvents] = useState([]);

  // Day detail dialog state
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayDetailOpen, setDayDetailOpen] = useState(false);

  // Pending approvals count
  const [pendingCount, setPendingCount] = useState(0);

  // Client Networks Display Dialog State
  const [clientNetworksDialog, setClientNetworksDialog] = useState({
    open: false,
    networks: [],
    leadName: "",
  });

  // Our Networks Display Dialog State
  const [ourNetworksDialog, setOurNetworksDialog] = useState({
    open: false,
    networks: [],
    leadName: "",
  });

  // Fetch filter options
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        if (isAdmin || isAM) {
          // Fetch AMs
          const amResponse = await api.get('/users?role=affiliate_manager&isActive=true&limit=1000');
          if (amResponse.data.success) {
            setAccountManagers(amResponse.data.data || []);
          }

          // Fetch Agents
          const agentResponse = await api.get('/users?role=agent&isActive=true&limit=1000');
          if (agentResponse.data.success) {
            setAgents(agentResponse.data.data || []);
          }

          // Fetch Client Brokers
          const brokerResponse = await api.get('/client-brokers?isActive=true&limit=1000');
          if (brokerResponse.data.success) {
            setBrokers(brokerResponse.data.data || []);
          }

          // Fetch Client Networks
          const clientNetworkResponse = await api.get('/client-networks?isActive=true&limit=1000');
          if (clientNetworkResponse.data.success) {
            setClientNetworks(clientNetworkResponse.data.data || []);
          }

          // Fetch Our Networks
          const ourNetworkResponse = await api.get('/our-networks?isActive=true&limit=1000');
          if (ourNetworkResponse.data.success) {
            setOurNetworks(ourNetworkResponse.data.data || []);
          }
        }
      } catch (err) {
        console.error('Error fetching filter options:', err);
      }
    };

    fetchFilterOptions();
  }, [isAdmin, isAM]);

  // Fetch deposit calls
  const fetchDepositCalls = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        status
      };

      if (search) params.search = search;
      if (selectedAM) params.accountManager = selectedAM;
      if (selectedAgent) params.assignedAgent = selectedAgent;
      if (selectedBroker) params.clientBrokerId = selectedBroker;
      if (selectedClientNetwork) params.clientNetwork = selectedClientNetwork;
      if (selectedOurNetwork) params.ourNetwork = selectedOurNetwork;
      if (selectedMonth) {
        const [year, month] = selectedMonth.split('-').map(Number);
        params.startDate = new Date(year, month - 1, 1).toISOString();
        params.endDate = new Date(year, month, 0, 23, 59, 59, 999).toISOString();
      }

      const response = await depositCallsService.getDepositCalls(params);

      if (response.success) {
        setDepositCalls(response.data || []);
        setTotalCount(response.pagination?.total || 0);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch deposit calls');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search, selectedAM, selectedAgent, selectedBroker, selectedClientNetwork, selectedOurNetwork, selectedMonth, status]);

  // Fetch calendar events
  const fetchCalendarEvents = useCallback(async () => {
    try {
      const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);
      
      const filters = {};
      if (selectedAM) filters.accountManager = selectedAM;
      if (selectedAgent) filters.assignedAgent = selectedAgent;

      const response = await depositCallsService.getCalendarAppointments(
        startDate.toISOString(),
        endDate.toISOString(),
        filters
      );

      if (response.success) {
        setCalendarEvents(response.data || []);
      }
    } catch (err) {
      console.error('Error fetching calendar events:', err);
    }
  }, [currentDate, selectedAM, selectedAgent]);

  // Fetch pending approvals count
  const fetchPendingCount = useCallback(async () => {
    if (!isAdmin && !isAM) return;
    
    try {
      const response = await depositCallsService.getPendingApprovals();
      if (response.success) {
        setPendingCount(response.count || 0);
      }
    } catch (err) {
      console.error('Error fetching pending count:', err);
    }
  }, [isAdmin, isAM]);

  useEffect(() => {
    fetchDepositCalls();
    fetchPendingCount();
  }, [fetchDepositCalls, fetchPendingCount]);

  useEffect(() => {
    if (tabValue === 1) {
      fetchCalendarEvents();
    }
  }, [tabValue, fetchCalendarEvents]);

  // Handlers
  const handleScheduleCall = async (depositCallId, callNumber, expectedDate, notes) => {
    try {
      await depositCallsService.scheduleCall(depositCallId, callNumber, expectedDate, notes);
      toast.success(`Call ${callNumber} scheduled successfully`);
      fetchDepositCalls();
      if (tabValue === 1) fetchCalendarEvents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to schedule call');
    }
  };

  const handleMarkDone = async (depositCallId, callNumber, notes) => {
    try {
      await depositCallsService.markCallDone(depositCallId, callNumber, notes);
      toast.success(`Call ${callNumber} marked as done - pending approval`);
      fetchDepositCalls();
      fetchPendingCount();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to mark call as done');
    }
  };

  const handleApproveCall = async (depositCallId, callNumber) => {
    try {
      await depositCallsService.approveCall(depositCallId, callNumber);
      toast.success(`Call ${callNumber} approved successfully`);
      fetchDepositCalls();
      fetchPendingCount();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve call');
    }
  };

  const handleRejectCall = async (depositCallId, callNumber) => {
    try {
      await depositCallsService.rejectCall(depositCallId, callNumber);
      toast.success(`Call ${callNumber} rejected - returned to scheduled`);
      fetchDepositCalls();
      fetchPendingCount();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject call');
    }
  };

  const handleMarkAnswered = async (depositCallId, callNumber) => {
    try {
      await depositCallsService.markCallAnswered(depositCallId, callNumber);
      toast.success(`Call ${callNumber} marked as answered`);
      fetchDepositCalls();
      fetchPendingCount();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to mark call as answered');
    }
  };

  const handleMarkRejected = async (depositCallId, callNumber) => {
    try {
      await depositCallsService.markCallRejected(depositCallId, callNumber);
      toast.success(`Call ${callNumber} marked as rejected`);
      fetchDepositCalls();
      fetchPendingCount();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to mark call as rejected');
    }
  };

  // Sync confirmed deposits from orders (admin only)
  const handleSyncConfirmedDeposits = async () => {
    try {
      const result = await depositCallsService.syncConfirmedDeposits();
      toast.success(result.message || 'Sync complete');
      fetchDepositCalls();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to sync confirmed deposits');
    }
  };

  // Network dialog handlers
  const handleOpenClientNetworksDialog = useCallback((networks, leadName) => {
    setClientNetworksDialog({
      open: true,
      networks: networks || [],
      leadName,
    });
  }, []);

  const handleCloseClientNetworksDialog = useCallback(() => {
    setClientNetworksDialog({
      open: false,
      networks: [],
      leadName: "",
    });
  }, []);

  const handleOpenOurNetworksDialog = useCallback((networks, leadName) => {
    setOurNetworksDialog({
      open: true,
      networks: networks || [],
      leadName,
    });
  }, []);

  const handleCloseOurNetworksDialog = useCallback(() => {
    setOurNetworksDialog({
      open: false,
      networks: [],
      leadName: "",
    });
  }, []);

  // Calendar helpers
  const getDaysInMonth = () => new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = () => new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const getEventsForDay = (day) => {
    return calendarEvents.filter(event => {
      const eventDate = new Date(event.start);
      return eventDate.getDate() === day && 
             eventDate.getMonth() === currentDate.getMonth() &&
             eventDate.getFullYear() === currentDate.getFullYear();
    });
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth();
    const firstDay = getFirstDayOfMonth();
    const days = [];

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      days.push(
        <Grid item xs={12/7} key={`empty-${i}`}>
          <Card sx={{ minHeight: 120, bgcolor: 'grey.100' }}>
            <CardContent sx={{ p: 1 }}>&nbsp;</CardContent>
          </Card>
        </Grid>
      );
    }

    // Calendar days
    for (let day = 1; day <= daysInMonth; day++) {
      const dayEvents = getEventsForDay(day);
      const isToday = new Date().getDate() === day && 
                      new Date().getMonth() === currentDate.getMonth() &&
                      new Date().getFullYear() === currentDate.getFullYear();

      const handleDayClick = () => {
        setSelectedDay({ day, events: dayEvents, date: new Date(currentDate.getFullYear(), currentDate.getMonth(), day) });
        setDayDetailOpen(true);
      };

      days.push(
        <Grid item xs={12/7} key={day}>
          <Card 
            onClick={handleDayClick}
            sx={{ 
              minHeight: 120,
              border: isToday ? '2px solid' : '1px solid',
              borderColor: isToday ? 'primary.main' : 'grey.200',
              overflow: 'hidden',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': {
                boxShadow: 4,
                borderColor: 'primary.light',
                transform: 'scale(1.02)'
              }
            }}
          >
            <CardContent sx={{ p: 1 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle2" fontWeight={isToday ? 'bold' : 'normal'}>
                  {day}
                </Typography>
                {dayEvents.length > 0 && (
                  <Badge badgeContent={dayEvents.length} color="primary" max={9} />
                )}
              </Box>
              
              <Box sx={{ mt: 0.5, maxHeight: 80, overflow: 'auto' }}>
                {dayEvents.slice(0, 3).map((event, idx) => (
                  <Tooltip key={idx} title={`${event.ftdName} - ${event.agent || 'Unassigned'}`}>
                    <Chip
                      label={`C${event.callNumber}: ${event.ftdName?.split(' ')[0]}`}
                      size="small"
                      color={getStatusColor(event.status)}
                      sx={{ fontSize: '0.6rem', height: 18, mb: 0.25, maxWidth: '100%' }}
                    />
                  </Tooltip>
                ))}
                {dayEvents.length > 3 && (
                  <Typography variant="caption" color="text.secondary">
                    +{dayEvents.length - 3} more
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      );
    }

    return days;
  };

  return (
    <Box sx={{ width: "100%", typography: "body1" }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab icon={<TableIcon />} label="Table View" iconPosition="start" />
          <Tab icon={<CalendarIcon />} label="Calendar View" iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Toolbar & Collapsible Filters */}
      <Paper sx={{ mb: 2 }}>
        <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            size="small"
            startIcon={<FilterListIcon />}
            endIcon={<ExpandMoreIcon sx={{ transform: filtersOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s' }} />}
            onClick={() => setFiltersOpen(!filtersOpen)}
            variant={filtersOpen ? 'contained' : 'outlined'}
          >
            Filters
          </Button>
          <TextField
            size="small"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ width: 220 }}
          />
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
            {(isAdmin || isAM) && pendingCount > 0 && (
              <Chip
                icon={<ScheduleIcon />}
                label={`${pendingCount} Pending`}
                color="warning"
                variant="filled"
                size="small"
              />
            )}
            {isAdmin && (
              <Tooltip title="Sync confirmed deposits from orders">
                <IconButton onClick={handleSyncConfirmedDeposits} color="secondary" size="small">
                  <SyncIcon />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Refresh">
              <IconButton onClick={() => { fetchDepositCalls(); if (tabValue === 1) fetchCalendarEvents(); }} color="primary" size="small">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        <Collapse in={filtersOpen}>
          <Divider />
          <Box sx={{ px: 2, py: 1.5 }}>
            <Grid container spacing={1.5} alignItems="center">
              {(isAdmin || isAM) && (
                <>
                  {isAdmin && (
                    <Grid item xs={6} sm={4} md={2}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Account Manager</InputLabel>
                        <Select
                          value={selectedAM}
                          onChange={(e) => setSelectedAM(e.target.value)}
                          label="Account Manager"
                        >
                          <MenuItem value="">All AMs</MenuItem>
                          {accountManagers.map(am => (
                            <MenuItem key={am._id} value={am._id}>{am.fullName}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                  )}

                  <Grid item xs={6} sm={4} md={2}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Agent</InputLabel>
                      <Select
                        value={selectedAgent}
                        onChange={(e) => setSelectedAgent(e.target.value)}
                        label="Agent"
                      >
                        <MenuItem value="">All Agents</MenuItem>
                        {agents.map(agent => (
                          <MenuItem key={agent._id} value={agent._id}>{agent.fullName}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={6} sm={4} md={2}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Client Broker</InputLabel>
                      <Select
                        value={selectedBroker}
                        onChange={(e) => setSelectedBroker(e.target.value)}
                        label="Client Broker"
                      >
                        <MenuItem value="">All Brokers</MenuItem>
                        {brokers.map(broker => (
                          <MenuItem key={broker._id} value={broker._id}>{broker.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={6} sm={4} md={2}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Client Network</InputLabel>
                      <Select
                        value={selectedClientNetwork}
                        onChange={(e) => setSelectedClientNetwork(e.target.value)}
                        label="Client Network"
                      >
                        <MenuItem value="">All Client Networks</MenuItem>
                        {clientNetworks.map(network => (
                          <MenuItem key={network._id} value={network._id}>{network.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={6} sm={4} md={2}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Our Network</InputLabel>
                      <Select
                        value={selectedOurNetwork}
                        onChange={(e) => setSelectedOurNetwork(e.target.value)}
                        label="Our Network"
                      >
                        <MenuItem value="">All Our Networks</MenuItem>
                        {ourNetworks.map(network => (
                          <MenuItem key={network._id} value={network._id}>{network.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </>
              )}

              <Grid item xs={6} sm={4} md={2}>
                <TextField
                  fullWidth
                  size="small"
                  type="month"
                  label="Month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={6} sm={4} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    label="Status"
                  >
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="completed">Completed</MenuItem>
                    <MenuItem value="">All</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Box>
        </Collapse>
      </Paper>

      {/* Table View */}
      {tabValue === 0 && (
        <Paper sx={{ width: '100%', overflow: 'auto' }}>
          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
              <CircularProgress />
            </Box>
          ) : depositCalls.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="h6" color="text.secondary">
                No deposit calls found
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {search ? 'Try adjusting your search criteria' : 'Deposit calls will appear here when FTDs are processed'}
              </Typography>
            </Box>
          ) : (
            <>
              <TableContainer sx={{ maxHeight: 'calc(100vh - 300px)' }}>
                <Table stickyHeader size="small" sx={{
                  borderCollapse: 'collapse',
                  '& .MuiTableCell-root': {
                    px: 0.5,
                    py: 0.25,
                    fontSize: '0.65rem',
                    lineHeight: 1.3,
                    border: '1px solid',
                    borderColor: 'grey.300',
                  },
                }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100', whiteSpace: 'nowrap', fontSize: '0.6rem' }}>Order</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100', whiteSpace: 'nowrap', fontSize: '0.6rem' }}>Order Created</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100', whiteSpace: 'nowrap', fontSize: '0.6rem' }}>Broker</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100', whiteSpace: 'nowrap', fontSize: '0.6rem' }}>Client Net</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100', whiteSpace: 'nowrap', fontSize: '0.6rem' }}>Our Net</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100', whiteSpace: 'nowrap', fontSize: '0.6rem' }}>AM</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100', whiteSpace: 'nowrap', fontSize: '0.6rem' }}>FTD Name</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100', whiteSpace: 'nowrap', fontSize: '0.6rem' }}>Email</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100', whiteSpace: 'nowrap', fontSize: '0.6rem' }}>Phone</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100', whiteSpace: 'nowrap', textAlign: 'center', fontSize: '0.6rem' }}>Dep.</TableCell>
                      {[1,2,3,4,5,6,7,8,9,10].map(num => (
                        <TableCell key={num} sx={{ fontWeight: 'bold', bgcolor: 'grey.100', whiteSpace: 'nowrap', textAlign: 'center', fontSize: '0.6rem' }}>
                          C{num}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {depositCalls.map((dc) => (
                      <TableRow key={dc._id} hover>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Typography fontWeight="medium" sx={{ fontFamily: 'monospace', fontSize: '0.6rem' }}>
                            {dc.orderId?._id ? `...${dc.orderId._id.toString().slice(-6)}` : '-'}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>
                            {dc.orderId?.createdAt ? new Date(dc.orderId.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Typography sx={{ fontSize: '0.55rem' }}>{dc.clientBrokerId?.name || '-'}</Typography>
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
                            <Typography sx={{ fontSize: '0.55rem' }}>
                              {(dc.leadId?.clientNetworkHistory || dc.lead?.clientNetworkHistory)?.length > 0
                                ? (dc.leadId?.clientNetworkHistory || dc.lead?.clientNetworkHistory)[(dc.leadId?.clientNetworkHistory || dc.lead?.clientNetworkHistory).length - 1]?.clientNetwork?.name || "-"
                                : "-"}
                            </Typography>
                            {(dc.leadId?.clientNetworkHistory || dc.lead?.clientNetworkHistory)?.length > 0 && (
                              <Tooltip title="View all client networks">
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    handleOpenClientNetworksDialog(
                                      dc.leadId?.clientNetworkHistory || dc.lead?.clientNetworkHistory,
                                      dc.ftdName || `${dc.leadId?.firstName} ${dc.leadId?.lastName}`
                                    )
                                  }
                                  sx={{ p: 0 }}
                                >
                                  <ListIcon sx={{ fontSize: 12 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
                            <Typography sx={{ fontSize: '0.55rem' }}>
                              {(dc.leadId?.ourNetworkHistory || dc.lead?.ourNetworkHistory)?.length > 0
                                ? (dc.leadId?.ourNetworkHistory || dc.lead?.ourNetworkHistory)[(dc.leadId?.ourNetworkHistory || dc.lead?.ourNetworkHistory).length - 1]?.ourNetwork?.name || "-"
                                : "-"}
                            </Typography>
                            {(dc.leadId?.ourNetworkHistory || dc.lead?.ourNetworkHistory)?.length > 0 && (
                              <Tooltip title="View all our networks">
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    handleOpenOurNetworksDialog(
                                      dc.leadId?.ourNetworkHistory || dc.lead?.ourNetworkHistory,
                                      dc.ftdName || `${dc.leadId?.firstName} ${dc.leadId?.lastName}`
                                    )
                                  }
                                  sx={{ p: 0 }}
                                >
                                  <ListIcon sx={{ fontSize: 12 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Typography sx={{ fontSize: '0.55rem' }}>{dc.accountManager?.fullName || '-'}</Typography>
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Typography sx={{ fontSize: '0.6rem', fontWeight: 500 }}>
                            {dc.ftdName || `${dc.leadId?.firstName} ${dc.leadId?.lastName}`}
                          </Typography>
                          {dc.assignedAgent && (
                            <Typography sx={{ fontSize: '0.55rem', color: 'text.secondary' }}>
                              {dc.assignedAgent.fullName}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <Tooltip title={dc.ftdEmail || dc.leadId?.newEmail || '-'}>
                            <Typography sx={{ fontSize: '0.6rem' }}>
                              {dc.ftdEmail || dc.leadId?.newEmail || '-'}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Typography sx={{ fontSize: '0.5rem' }}>
                            {formatPhoneWithCountryCode(dc.ftdPhone || dc.leadId?.newPhone, dc.leadId?.country || dc.lead?.country) || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {dc.depositConfirmed ? (
                            <Tooltip title={dc.depositConfirmedAt ? `Confirmed: ${new Date(dc.depositConfirmedAt).toLocaleString()}` : 'Deposit Confirmed'}>
                              <VerifiedIcon color="success" sx={{ fontSize: 14 }} />
                            </Tooltip>
                          ) : (
                            <Chip label="Pending" size="small" variant="outlined" sx={{ height: 16, fontSize: '0.55rem' }} />
                          )}
                        </TableCell>
                        {[1,2,3,4,5,6,7,8,9,10].map(num => (
                          <CallCell
                            key={num}
                            call={dc[`call${num}`]}
                            callNumber={num}
                            depositCall={dc}
                            onSchedule={handleScheduleCall}
                            onMarkDone={handleMarkDone}
                            onApprove={handleApproveCall}
                            onReject={handleRejectCall}
                            onMarkAnswered={handleMarkAnswered}
                            onMarkRejected={handleMarkRejected}
                            isAdmin={isAdmin}
                            isAM={isAM}
                            isAgent={isAgent}
                          />
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={totalCount}
                page={page}
                onPageChange={(e, newPage) => setPage(newPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(parseInt(e.target.value, 10));
                  setPage(0);
                }}
                rowsPerPageOptions={[10, 25, 50, 100]}
              />
            </>
          )}
        </Paper>
      )}

      {/* Calendar View */}
      {tabValue === 1 && (
        <Paper sx={{ p: 2 }}>
          {/* Calendar Navigation */}
          <Box display="flex" justifyContent="center" alignItems="center" gap={2} mb={3}>
            <IconButton onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} color="primary">
              <ChevronLeftIcon />
            </IconButton>
            <Typography variant="h5" fontWeight="bold" sx={{ minWidth: 200, textAlign: 'center' }}>
              {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Typography>
            <IconButton onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} color="primary">
              <ChevronRightIcon />
            </IconButton>
          </Box>

          {/* Day headers */}
          <Grid container spacing={1} sx={{ mb: 1 }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <Grid item xs={12/7} key={day}>
                <Typography variant="subtitle2" fontWeight="bold" textAlign="center" color="primary">
                  {day}
                </Typography>
              </Grid>
            ))}
          </Grid>

          {/* Calendar Grid */}
          <Grid container spacing={1}>
            {renderCalendar()}
          </Grid>

          {/* Legend */}
          <Box sx={{ mt: 3, display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Chip label="Scheduled" size="small" color="info" />
            <Chip label="Pending Approval" size="small" color="warning" />
            <Chip label="Answered" size="small" color="success" />
            <Chip label="Rejected" size="small" color="error" />
          </Box>

          {/* Day Detail Dialog */}
          <Dialog 
            open={dayDetailOpen} 
            onClose={() => setDayDetailOpen(false)} 
            maxWidth="md" 
            fullWidth
            PaperProps={{
              sx: { minHeight: 400 }
            }}
          >
            <DialogTitle sx={{ pb: 1 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="h6" fontWeight="bold">
                    {selectedDay?.date?.toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      month: 'long', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedDay?.events?.length || 0} appointment{selectedDay?.events?.length !== 1 ? 's' : ''} scheduled
                  </Typography>
                </Box>
                <IconButton onClick={() => setDayDetailOpen(false)}>
                  <RejectIcon />
                </IconButton>
              </Box>
            </DialogTitle>
            <Divider />
            <DialogContent sx={{ p: 0 }}>
              {selectedDay?.events?.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <CalendarIcon sx={{ fontSize: 64, color: 'grey.300', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary">
                    No appointments scheduled
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Click on a scheduled call in the table view to add appointments
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ p: 0 }}>
                  {selectedDay?.events?.map((event, idx) => (
                    <Box 
                      key={idx} 
                      sx={{ 
                        p: 2, 
                        borderBottom: idx < selectedDay.events.length - 1 ? '1px solid' : 'none',
                        borderColor: 'grey.200',
                        '&:hover': { bgcolor: 'grey.50' }
                      }}
                    >
                      <Grid container spacing={2} alignItems="center">
                        {/* Time & Call Number */}
                        <Grid item xs={12} sm={2}>
                          <Box sx={{ textAlign: { xs: 'left', sm: 'center' } }}>
                            <Typography variant="h6" color="primary.main" fontWeight="bold">
                              {new Date(event.start).toLocaleTimeString('en-US', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </Typography>
                            <Chip 
                              label={`Call ${event.callNumber}`} 
                              size="small" 
                              color={getStatusColor(event.status)}
                              sx={{ mt: 0.5 }}
                            />
                          </Box>
                        </Grid>

                        {/* FTD Info */}
                        <Grid item xs={12} sm={4}>
                          <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                            <PersonIcon fontSize="small" color="action" />
                            <Typography variant="subtitle1" fontWeight="bold">
                              {event.ftdName}
                            </Typography>
                          </Box>
                          <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                            <EmailIcon fontSize="small" color="action" />
                            <Typography variant="body2" color="text.secondary">
                              {event.ftdEmail || '-'}
                            </Typography>
                          </Box>
                          <Box display="flex" alignItems="center" gap={1}>
                            <PhoneIcon fontSize="small" color="action" />
                            <Typography variant="body2" color="text.secondary">
                              {formatPhoneWithCountryCode(event.ftdPhone, event.country) || '-'}
                            </Typography>
                          </Box>
                        </Grid>

                        {/* Agent & Broker */}
                        <Grid item xs={12} sm={3}>
                          <Typography variant="caption" color="text.secondary" display="block">
                            Agent
                          </Typography>
                          <Typography variant="body2" fontWeight="medium">
                            {event.agent || 'Unassigned'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                            Client Broker
                          </Typography>
                          <Typography variant="body2" fontWeight="medium">
                            {event.clientBroker || '-'}
                          </Typography>
                        </Grid>

                        {/* Status & Actions */}
                        <Grid item xs={12} sm={3}>
                          <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                            <Chip
                              label={
                                event.status === 'scheduled' ? 'Scheduled' :
                                event.status === 'pending_approval' ? 'Pending Approval' :
                                event.status === 'completed' ? 'Completed' :
                                event.status === 'answered' ? 'Answered' :
                                event.status === 'rejected' ? 'Rejected' :
                                event.status
                              }
                              color={getStatusColor(event.status)}
                              size="small"
                            />
                            {event.accountManager && (
                              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                                AM: {event.accountManager}
                              </Typography>
                            )}
                            {event.notes && (
                              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5, fontStyle: 'italic' }}>
                                Note: {event.notes}
                              </Typography>
                            )}
                          </Box>
                        </Grid>
                      </Grid>
                    </Box>
                  ))}
                </Box>
              )}
            </DialogContent>
            <DialogActions sx={{ p: 2, borderTop: '1px solid', borderColor: 'grey.200' }}>
              <Button onClick={() => setDayDetailOpen(false)} variant="contained">
                Close
              </Button>
            </DialogActions>
          </Dialog>
        </Paper>
      )}

      {/* Client Networks Display Dialog */}
      <Dialog
        open={clientNetworksDialog.open}
        onClose={handleCloseClientNetworksDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Client Networks
          {clientNetworksDialog.leadName && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              for {clientNetworksDialog.leadName}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          {clientNetworksDialog.networks.length > 0 ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Network Name</TableCell>
                    <TableCell>Assigned At</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {clientNetworksDialog.networks.map((entry, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Typography variant="body2">
                          {entry.clientNetwork?.name || "-"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {entry.assignedAt
                            ? new Date(entry.assignedAt).toLocaleString()
                            : "-"}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No client networks assigned
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseClientNetworksDialog}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Our Networks Display Dialog */}
      <Dialog
        open={ourNetworksDialog.open}
        onClose={handleCloseOurNetworksDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Our Networks
          {ourNetworksDialog.leadName && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              for {ourNetworksDialog.leadName}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          {ourNetworksDialog.networks.length > 0 ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Network Name</TableCell>
                    <TableCell>Assigned At</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {ourNetworksDialog.networks.map((entry, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Typography variant="body2">
                          {entry.ourNetwork?.name || "-"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {entry.assignedAt
                            ? new Date(entry.assignedAt).toLocaleString()
                            : "-"}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No our networks assigned
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseOurNetworksDialog}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DepositCallsPage;

