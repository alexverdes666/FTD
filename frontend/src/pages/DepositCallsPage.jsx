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
  Checkbox,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Popover,
  FormControlLabel
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Verified as VerifiedIcon,
  TableChart as TableIcon,
  Cancel as RejectIcon,
  Schedule as ScheduleIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Person as PersonIcon,
  FilterList as FilterListIcon,
  ExpandMore as ExpandMoreIcon,
  Add as AddIcon,
  PlayCircleOutline as PlayIcon,
  Delete as DeleteIcon,
  AdminPanelSettings as AdminIcon,
  ViewColumn as ViewColumnIcon
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { selectUser } from '../store/slices/authSlice';
import depositCallsService from '../services/depositCallsService';
import api from '../services/api';
import toast from 'react-hot-toast';
import { formatPhoneWithCountryCode } from '../utils/phoneUtils';
import { formatDateTimeBG, formatFullDateTimeBG, formatDateBG, formatShortDateBG } from '../utils/dateUtils';
import CallDeclarationApprovalDialog from '../components/CallDeclarationApprovalDialog';
import { getFillerDeclarations, fetchRecordingBlob, fetchAgentShortCalls } from '../services/callDeclarations';
import { loadColumns, loadColumnsFromCache, saveColumns } from '../utils/depositCallsColumns';

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

// Format date for display (Bulgarian timezone)
const formatDateTime = (date) => formatDateTimeBG(date);

// Admin call color
const ADMIN_CALL_COLOR = '#ed6c02'; // orange/amber

// Column definitions for table visibility toggle
const ALL_COLUMNS = [
  { id: 'order', label: 'Order', defaultVisible: true },
  { id: 'orderCreated', label: 'Order Created', defaultVisible: true },
  { id: 'broker', label: 'Broker', defaultVisible: true },
  { id: 'clientNet', label: 'Client Net', defaultVisible: true },
  { id: 'ourNet', label: 'Our Net', defaultVisible: true },
  { id: 'am', label: 'AM', defaultVisible: true },
  { id: 'ftdName', label: 'FTD Name', defaultVisible: true },
  { id: 'email', label: 'Email', defaultVisible: true },
  { id: 'phone', label: 'Phone', defaultVisible: true },
  { id: 'psp', label: 'PSP', defaultVisible: false },
  { id: 'cardIssuer', label: 'Card Issuer', defaultVisible: false },
  { id: 'deposit', label: 'Dep.', defaultVisible: true },
  { id: 'depositCall', label: 'Dep. Call', defaultVisible: true },
  ...Array.from({ length: 10 }, (_, i) => ({ id: `call${i + 1}`, label: `C${i + 1}`, defaultVisible: true })),
];

const DEFAULT_VISIBLE_COLUMNS = ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.id);

const getInitialColumns = () => {
  return loadColumnsFromCache() || DEFAULT_VISIBLE_COLUMNS;
};

// Format duration from seconds to M:SS or H:MM:SS
const formatDurationShort = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

// Call Cell Component
const CallCell = ({ call, callNumber, depositCall, declaration, onSchedule, onMarkDone, onApprove, onReject, onMarkAnswered, onMarkRejected, onViewDeclaration, onAdminFill, onAdminRemove, onAdminCallsDetail, isAdmin, isAM, isAgent }) => {
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

  const adminCalls = call?.adminCalls || [];
  const hasAdminCalls = adminCalls.length > 0;

  return (
    <TableCell sx={{ p: '2px 4px' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center', minWidth: 48 }}>
        {/* Admin-added calls display */}
        {hasAdminCalls && (
          <Chip
            label={adminCalls.length === 1
              ? formatDurationShort(adminCalls[0].callDuration)
              : `${adminCalls.length} calls`
            }
            size="small"
            onClick={() => onAdminCallsDetail(adminCalls, depositCall, callNumber)}
            sx={{
              fontSize: '0.5rem',
              height: 15,
              bgcolor: ADMIN_CALL_COLOR,
              color: 'white',
              cursor: 'pointer',
              '& .MuiChip-label': { px: 0.5 },
              '& .MuiChip-deleteIcon': { fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)' },
            }}
            onDelete={isAdmin ? () => onAdminRemove(depositCall._id, callNumber) : undefined}
            deleteIcon={isAdmin ? <DeleteIcon /> : undefined}
          />
        )}
        {call?.status === 'pending' && declaration?.status === 'pending' ? (
          <Tooltip title="Agent declared this call — click to review">
            <Chip
              label="Declared"
              size="small"
              color="warning"
              onClick={() => onViewDeclaration(declaration)}
              sx={{ fontSize: '0.5rem', height: 15, cursor: 'pointer', '& .MuiChip-label': { px: 0.5 } }}
            />
          </Tooltip>
        ) : call?.status === 'pending' && !hasAdminCalls ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '1px', alignItems: 'center' }}>
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
            {isAdmin && depositCall.assignedAgent && (
              <Button
                size="small"
                variant="text"
                onClick={() => onAdminFill(depositCall, callNumber)}
                sx={{ fontSize: '0.45rem', py: 0, px: 0.3, minWidth: 'auto', lineHeight: 1.2, color: ADMIN_CALL_COLOR }}
              >
                Fill
              </Button>
            )}
          </Box>
        ) : call?.status === 'pending' && hasAdminCalls ? (
          isAdmin && depositCall.assignedAgent ? (
            <Button
              size="small"
              variant="text"
              onClick={() => onAdminFill(depositCall, callNumber)}
              sx={{ fontSize: '0.45rem', py: 0, px: 0.3, minWidth: 'auto', lineHeight: 1.2, color: ADMIN_CALL_COLOR }}
            >
              +Add
            </Button>
          ) : null
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
            <Chip
              label="Approved"
              size="small"
              color="success"
              onClick={declaration ? () => onViewDeclaration(declaration) : undefined}
              sx={{ fontSize: '0.5rem', height: 15, cursor: declaration ? 'pointer' : 'default', '& .MuiChip-label': { px: 0.5 } }}
            />
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
  const [selectedDeclaration, setSelectedDeclaration] = useState(null);

  // Filler calls state
  const [fillerDeclarations, setFillerDeclarations] = useState([]);
  const [fillerLoading, setFillerLoading] = useState(false);
  const [fillerError, setFillerError] = useState(null);
  const [fillerPage, setFillerPage] = useState(0);
  const [fillerRowsPerPage, setFillerRowsPerPage] = useState(25);
  const [fillerTotalCount, setFillerTotalCount] = useState(0);

  // Recording playback state
  const [recordingDeclaration, setRecordingDeclaration] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioLoading, setAudioLoading] = useState(false);

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

  // Pending approvals count
  const [pendingCount, setPendingCount] = useState(0);

  // Custom Record Dialog State
  const [customRecordOpen, setCustomRecordOpen] = useState(false);
  const [customRecordEmail, setCustomRecordEmail] = useState('');
  const [customRecordSearching, setCustomRecordSearching] = useState(false);
  const [customRecordLead, setCustomRecordLead] = useState(null);
  const [customRecordOrderId, setCustomRecordOrderId] = useState('');
  const [customRecordAM, setCustomRecordAM] = useState('');
  const [customRecordAgent, setCustomRecordAgent] = useState('');
  const [customRecordNote, setCustomRecordNote] = useState('');
  const [customRecordDate, setCustomRecordDate] = useState('');
  const [customRecordCreating, setCustomRecordCreating] = useState(false);

  // Admin Calls Detail Dialog State (view + play recordings)
  const [adminCallsDetailOpen, setAdminCallsDetailOpen] = useState(false);
  const [adminCallsDetailData, setAdminCallsDetailData] = useState(null); // { calls, depositCall, callSlot }
  const [adminCallsPlayingIdx, setAdminCallsPlayingIdx] = useState(null);
  const [adminCallsAudioUrl, setAdminCallsAudioUrl] = useState(null);
  const [adminCallsAudioLoading, setAdminCallsAudioLoading] = useState(false);

  // Admin Fill Dialog State
  const [adminFillOpen, setAdminFillOpen] = useState(false);
  const [adminFillTarget, setAdminFillTarget] = useState(null); // { depositCall, callSlot }
  const [adminFillCalls, setAdminFillCalls] = useState([]); // CDR short calls
  const [adminFillLoading, setAdminFillLoading] = useState(false);
  const [adminFillSelected, setAdminFillSelected] = useState([]); // selected call indices
  const [adminFillSaving, setAdminFillSaving] = useState(false);

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

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState(getInitialColumns);
  const [colAnchorEl, setColAnchorEl] = useState(null);

  // Load column preferences from DB on mount
  useEffect(() => {
    loadColumns().then(cols => {
      if (cols) setVisibleColumns(cols);
    });
  }, []);

  const toggleColumn = (colId) => {
    setVisibleColumns(prev => {
      const next = prev.includes(colId) ? prev.filter(c => c !== colId) : [...prev, colId];
      saveColumns(next);
      return next;
    });
  };

  const isColVisible = (colId) => visibleColumns.includes(colId);

  // Helper to get PSP/Card Issuer from order leadsMetadata
  const getLeadMetadata = (dc) => {
    if (!dc.orderId?.leadsMetadata) return null;
    const leadId = dc.leadId?._id || dc.leadId;
    return dc.orderId.leadsMetadata.find(m => {
      const mLeadId = m.leadId?._id || m.leadId;
      return mLeadId?.toString() === leadId?.toString();
    });
  };

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
            const sorted = (agentResponse.data.data || []).sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
            setAgents(sorted);
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

  // Fetch filler declarations
  const fetchFillerDeclarations = useCallback(async () => {
    setFillerLoading(true);
    setFillerError(null);
    try {
      const params = {
        page: fillerPage + 1,
        limit: fillerRowsPerPage,
      };

      params.status = 'approved';
      if (search) params.search = search;
      if (selectedAM) params.accountManager = selectedAM;
      if (selectedAgent) params.assignedAgent = selectedAgent;
      if (selectedMonth) {
        const [year, month] = selectedMonth.split('-').map(Number);
        params.startDate = new Date(year, month - 1, 1).toISOString();
        params.endDate = new Date(year, month, 0, 23, 59, 59, 999).toISOString();
      }

      const response = await getFillerDeclarations(params);

      if (response.success) {
        setFillerDeclarations(response.data || []);
        setFillerTotalCount(response.pagination?.total || 0);
      }
    } catch (err) {
      setFillerError(err.response?.data?.message || 'Failed to fetch filler declarations');
    } finally {
      setFillerLoading(false);
    }
  }, [fillerPage, fillerRowsPerPage, search, selectedAM, selectedAgent, selectedMonth]);

  useEffect(() => {
    if (tabValue === 1) {
      fetchFillerDeclarations();
    }
  }, [tabValue, fetchFillerDeclarations]);

  // Recording playback effect
  useEffect(() => {
    let objectUrl = null;
    if (recordingDeclaration?.recordFile) {
      setAudioLoading(true);
      setAudioUrl(null);
      fetchRecordingBlob(recordingDeclaration.recordFile)
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
  }, [recordingDeclaration]);

  // Handlers
  const handleScheduleCall = async (depositCallId, callNumber, expectedDate, notes) => {
    try {
      await depositCallsService.scheduleCall(depositCallId, callNumber, expectedDate, notes);
      toast.success(`Call ${callNumber} scheduled successfully`);
      fetchDepositCalls();
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

  // Admin calls detail handlers
  const handleOpenAdminCallsDetail = useCallback((adminCalls, depositCall, callSlot) => {
    setAdminCallsDetailData({ calls: adminCalls, depositCall, callSlot });
    setAdminCallsDetailOpen(true);
    setAdminCallsPlayingIdx(null);
    setAdminCallsAudioUrl(null);
  }, []);

  const handlePlayAdminRecording = useCallback(async (index, recordFile) => {
    if (adminCallsPlayingIdx === index) {
      // Toggle off
      if (adminCallsAudioUrl) URL.revokeObjectURL(adminCallsAudioUrl);
      setAdminCallsPlayingIdx(null);
      setAdminCallsAudioUrl(null);
      return;
    }
    if (adminCallsAudioUrl) URL.revokeObjectURL(adminCallsAudioUrl);
    setAdminCallsPlayingIdx(index);
    setAdminCallsAudioUrl(null);
    if (!recordFile) return;
    setAdminCallsAudioLoading(true);
    try {
      const url = await fetchRecordingBlob(recordFile);
      setAdminCallsAudioUrl(url);
    } catch (err) {
      toast.error('Failed to load recording');
    } finally {
      setAdminCallsAudioLoading(false);
    }
  }, [adminCallsPlayingIdx, adminCallsAudioUrl]);

  const handleCloseAdminCallsDetail = useCallback(() => {
    if (adminCallsAudioUrl) URL.revokeObjectURL(adminCallsAudioUrl);
    setAdminCallsDetailOpen(false);
    setAdminCallsDetailData(null);
    setAdminCallsPlayingIdx(null);
    setAdminCallsAudioUrl(null);
  }, [adminCallsAudioUrl]);

  // Admin fill handlers
  const handleAdminFill = useCallback(async (depositCall, callSlot) => {
    const agentId = depositCall.assignedAgent?._id || depositCall.assignedAgent;
    if (!agentId) {
      toast.error('No agent assigned to this deposit call');
      return;
    }
    setAdminFillTarget({ depositCall, callSlot });
    setAdminFillSelected([]);
    setAdminFillOpen(true);
    setAdminFillLoading(true);
    try {
      const leadPhone = depositCall.ftdPhone || depositCall.leadId?.newPhone || '';
      const leadEmail = depositCall.ftdEmail || depositCall.leadId?.newEmail || '';
      const data = await fetchAgentShortCalls(agentId, 3, leadPhone, leadEmail);
      setAdminFillCalls(data?.calls || []);
    } catch (err) {
      toast.error('Failed to fetch agent short calls');
      setAdminFillCalls([]);
    } finally {
      setAdminFillLoading(false);
    }
  }, []);

  const handleAdminFillSave = async () => {
    if (!adminFillTarget || adminFillSelected.length === 0) return;
    setAdminFillSaving(true);
    try {
      const selectedCalls = adminFillSelected.map(idx => {
        const call = adminFillCalls[idx];
        return {
          callDate: call.callDate,
          callDuration: call.callDuration,
          sourceNumber: call.sourceNumber || '',
          destinationNumber: call.destinationNumber || '',
          recordFile: call.recordFile || '',
        };
      });
      await depositCallsService.adminDeclareCalls(
        adminFillTarget.depositCall._id,
        adminFillTarget.callSlot,
        selectedCalls
      );
      toast.success('Admin calls added successfully');
      setAdminFillOpen(false);
      setAdminFillTarget(null);
      setAdminFillSelected([]);
      fetchDepositCalls();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add admin calls');
    } finally {
      setAdminFillSaving(false);
    }
  };

  const handleAdminRemoveCalls = async (depositCallId, callSlot) => {
    try {
      await depositCallsService.adminRemoveCalls(depositCallId, callSlot);
      toast.success('Admin calls removed');
      fetchDepositCalls();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove admin calls');
    }
  };

  const handleAdminFillClose = () => {
    setAdminFillOpen(false);
    setAdminFillTarget(null);
    setAdminFillSelected([]);
    setAdminFillCalls([]);
  };

  const toggleAdminFillSelection = (index) => {
    setAdminFillSelected(prev =>
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
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

  // Custom record handlers
  const handleCustomRecordSearch = async () => {
    if (!customRecordEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }
    setCustomRecordSearching(true);
    setCustomRecordLead(null);
    try {
      const response = await api.post('/leads/search-by-emails', { emails: [customRecordEmail.trim()] });
      if (response.data.success && response.data.data?.length > 0) {
        setCustomRecordLead(response.data.data[0]);
      } else {
        toast.error('No lead found with this email');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to search lead');
    } finally {
      setCustomRecordSearching(false);
    }
  };

  const handleCustomRecordCreate = async () => {
    if (!customRecordLead) return;
    if (!customRecordNote.trim()) {
      toast.error('Note is required');
      return;
    }
    setCustomRecordCreating(true);
    try {
      const data = { leadId: customRecordLead._id, note: customRecordNote.trim() };
      if (customRecordOrderId.trim()) data.orderId = customRecordOrderId.trim();
      if (customRecordAM) data.accountManager = customRecordAM;
      if (customRecordAgent) data.assignedAgent = customRecordAgent;
      if (customRecordDate) data.customDate = new Date(customRecordDate).toISOString();

      await depositCallsService.createCustomDepositCall(data);
      toast.success('Custom deposit call record created');
      setCustomRecordOpen(false);
      setCustomRecordEmail('');
      setCustomRecordLead(null);
      setCustomRecordOrderId('');
      setCustomRecordAM('');
      setCustomRecordAgent('');
      setCustomRecordNote('');
      setCustomRecordDate('');
      fetchDepositCalls();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create custom record');
    } finally {
      setCustomRecordCreating(false);
    }
  };

  const handleCustomRecordClose = () => {
    setCustomRecordOpen(false);
    setCustomRecordEmail('');
    setCustomRecordLead(null);
    setCustomRecordOrderId('');
    setCustomRecordAM('');
    setCustomRecordAgent('');
    setCustomRecordNote('');
    setCustomRecordDate('');
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
          <Tab icon={<PhoneIcon />} label="Filler Calls" iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Toolbar & Collapsible Filters */}
      <Paper sx={{ mb: 2 }}>
        <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          {tabValue !== 1 && (
            <Button
              size="small"
              startIcon={<FilterListIcon />}
              endIcon={<ExpandMoreIcon sx={{ transform: filtersOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s' }} />}
              onClick={() => setFiltersOpen(!filtersOpen)}
              variant={filtersOpen ? 'contained' : 'outlined'}
            >
              Filters
            </Button>
          )}
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
          {tabValue === 1 && (isAdmin || isAM) && (
            <>
              {isAdmin && (
                <FormControl size="small" sx={{ minWidth: 160 }}>
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
              )}
              <FormControl size="small" sx={{ minWidth: 140 }}>
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
              <TextField
                size="small"
                type="month"
                label="Month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 140 }}
              />
            </>
          )}
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
              <Tooltip title="Add custom deposit call record">
                <IconButton onClick={() => setCustomRecordOpen(true)} color="primary" size="small">
                  <AddIcon />
                </IconButton>
              </Tooltip>
            )}

            {tabValue === 0 && (
              <Tooltip title="Select columns">
                <IconButton onClick={(e) => setColAnchorEl(e.currentTarget)} color="primary" size="small">
                  <ViewColumnIcon />
                </IconButton>
              </Tooltip>
            )}

            <Tooltip title="Refresh">
              <IconButton onClick={() => { fetchDepositCalls(); if (tabValue === 1) fetchFillerDeclarations(); }} color="primary" size="small">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Column Visibility Popover */}
          <Popover
            open={Boolean(colAnchorEl)}
            anchorEl={colAnchorEl}
            onClose={() => setColAnchorEl(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <Box sx={{ p: 1.5, minWidth: 200 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, px: 1 }}>Visible Columns</Typography>
              <List dense disablePadding>
                {ALL_COLUMNS.map(col => (
                  <ListItem key={col.id} disablePadding sx={{ px: 0.5 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={isColVisible(col.id)}
                          onChange={() => toggleColumn(col.id)}
                        />
                      }
                      label={<Typography variant="body2">{col.label}</Typography>}
                      sx={{ m: 0 }}
                    />
                  </ListItem>
                ))}
              </List>
              <Box sx={{ display: 'flex', gap: 1, mt: 1, px: 0.5 }}>
                <Button size="small" onClick={() => {
                  const all = ALL_COLUMNS.map(c => c.id);
                  setVisibleColumns(all);
                  saveColumns(all);
                }}>All</Button>
                <Button size="small" onClick={() => {
                  setVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
                  saveColumns(DEFAULT_VISIBLE_COLUMNS);
                }}>Reset</Button>
              </Box>
            </Box>
          </Popover>
        </Box>
        <Collapse in={filtersOpen && tabValue !== 1}>
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

                  {tabValue !== 1 && (
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
                  )}

                  {tabValue !== 1 && (
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
                  )}

                  {tabValue !== 1 && (
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
                  )}
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

              {tabValue !== 1 && (
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
              )}
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
                      {isColVisible('order') && <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100', whiteSpace: 'nowrap', fontSize: '0.6rem' }}>Order</TableCell>}
                      {isColVisible('orderCreated') && <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100', whiteSpace: 'nowrap', fontSize: '0.6rem' }}>Order Created</TableCell>}
                      {isColVisible('broker') && <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100', whiteSpace: 'nowrap', fontSize: '0.6rem' }}>Broker</TableCell>}
                      {isColVisible('clientNet') && <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100', whiteSpace: 'nowrap', fontSize: '0.6rem' }}>Client Net</TableCell>}
                      {isColVisible('ourNet') && <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100', whiteSpace: 'nowrap', fontSize: '0.6rem' }}>Our Net</TableCell>}
                      {isColVisible('am') && <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100', whiteSpace: 'nowrap', fontSize: '0.6rem' }}>AM</TableCell>}
                      {isColVisible('ftdName') && <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100', whiteSpace: 'nowrap', fontSize: '0.6rem' }}>FTD Name</TableCell>}
                      {isColVisible('email') && <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100', whiteSpace: 'nowrap', fontSize: '0.6rem' }}>Email</TableCell>}
                      {isColVisible('phone') && <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100', whiteSpace: 'nowrap', fontSize: '0.6rem' }}>Phone</TableCell>}
                      {isColVisible('psp') && <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100', whiteSpace: 'nowrap', fontSize: '0.6rem' }}>PSP</TableCell>}
                      {isColVisible('cardIssuer') && <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100', whiteSpace: 'nowrap', fontSize: '0.6rem' }}>Card Issuer</TableCell>}
                      {isColVisible('deposit') && <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100', whiteSpace: 'nowrap', textAlign: 'center', fontSize: '0.6rem' }}>Dep.</TableCell>}
                      {isColVisible('depositCall') && <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100', whiteSpace: 'nowrap', textAlign: 'center', fontSize: '0.6rem' }}>Dep. Call</TableCell>}
                      {[1,2,3,4,5,6,7,8,9,10].map(num => (
                        isColVisible(`call${num}`) && <TableCell key={num} sx={{ fontWeight: 'bold', bgcolor: 'grey.100', whiteSpace: 'nowrap', textAlign: 'center', fontSize: '0.6rem' }}>
                          C{num}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {depositCalls.map((dc) => (
                      <TableRow key={dc._id} hover sx={{
                        ...(dc.isCustomRecord ? { borderLeft: '3px solid', borderLeftColor: 'error.main' } : {}),
                        ...(dc.isDeleted ? { opacity: 0.6, bgcolor: 'grey.50' } : {}),
                      }}>
                        {isColVisible('order') && (
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {dc.isCustomRecord && dc.customNote ? (
                            <Tooltip title={dc.customNote}>
                              <Typography fontWeight="medium" sx={{ fontFamily: 'monospace', fontSize: '0.6rem', ...(dc.isDeleted ? { textDecoration: 'line-through' } : {}) }}>
                                {dc.orderId?._id ? dc.orderId._id.toString().slice(-8) : dc.customNote.length > 12 ? dc.customNote.slice(0, 12) + '...' : dc.customNote}
                              </Typography>
                            </Tooltip>
                          ) : (
                            <Typography fontWeight="medium" sx={{ fontFamily: 'monospace', fontSize: '0.6rem', ...(dc.isDeleted ? { textDecoration: 'line-through' } : {}) }}>
                              {dc.orderId?._id ? dc.orderId._id.toString().slice(-8) : '-'}
                            </Typography>
                          )}
                        </TableCell>
                        )}
                        {isColVisible('orderCreated') && (
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>
                            {dc.orderId?.createdAt
                              ? formatDateTimeBG(dc.orderId.createdAt)
                              : dc.customDate
                                ? formatShortDateBG(dc.customDate)
                                : '-'}
                          </Typography>
                        </TableCell>
                        )}
                        {isColVisible('broker') && (
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Typography sx={{ fontSize: '0.55rem' }}>{(() => {
                            const lead = dc.leadId;
                            const orderId = dc.orderId?._id;
                            return (lead?.clientBrokerHistory?.length > 0
                              ? (lead.clientBrokerHistory.find(h => h.orderId === orderId || h.orderId?._id === orderId) || lead.clientBrokerHistory[lead.clientBrokerHistory.length - 1])?.clientBroker?.name
                              : null)
                              || (lead?.assignedClientBrokers?.length > 0 ? lead.assignedClientBrokers[lead.assignedClientBrokers.length - 1]?.name : null)
                              || dc.clientBrokerId?.name
                              || '-';
                          })()}</Typography>
                        </TableCell>
                        )}
                        {isColVisible('clientNet') && (
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Typography sx={{ fontSize: '0.55rem' }}>
                            {dc.orderId?.selectedClientNetwork?.name || '-'}
                          </Typography>
                        </TableCell>
                        )}
                        {isColVisible('ourNet') && (
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Typography sx={{ fontSize: '0.55rem' }}>
                            {dc.orderId?.selectedOurNetwork?.name || '-'}
                          </Typography>
                        </TableCell>
                        )}
                        {isColVisible('am') && (
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Typography sx={{ fontSize: '0.55rem' }}>{dc.accountManager?.fullName || '-'}</Typography>
                        </TableCell>
                        )}
                        {isColVisible('ftdName') && (
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography sx={{ fontSize: '0.6rem', fontWeight: 500, ...(dc.isDeleted ? { textDecoration: 'line-through', color: 'text.disabled' } : {}) }}>
                              {dc.ftdName || `${dc.leadId?.firstName} ${dc.leadId?.lastName}`}
                            </Typography>
                            {dc.isDeleted && (
                              <Tooltip title={`Removed: ${dc.deletedReason || 'Lead removed from order'}${dc.deletedAt ? ` (${formatFullDateTimeBG(dc.deletedAt)})` : ''}`}>
                                <Chip label="Removed" size="small" color="error" variant="outlined" sx={{ height: 14, fontSize: '0.45rem', '& .MuiChip-label': { px: 0.3 } }} />
                              </Tooltip>
                            )}
                            {dc.leadHistory && dc.leadHistory.length > 0 && (
                              <Tooltip title={
                                dc.leadHistory.map((h, i) =>
                                  `${i + 1}. ${h.action === 'replaced' ? 'Replaced' : h.action === 'deleted' ? 'Removed' : 'Added'}: ${h.ftdName} (${h.ftdEmail})${h.reason ? ` - ${h.reason}` : ''} [${formatDateBG(h.replacedAt)}]`
                                ).join('\n')
                              }>
                                <Chip label={`${dc.leadHistory.length} prev`} size="small" variant="outlined" color="info" sx={{ height: 14, fontSize: '0.45rem', cursor: 'pointer', '& .MuiChip-label': { px: 0.3 } }} />
                              </Tooltip>
                            )}
                          </Box>
                          {dc.assignedAgent && (
                            <Typography sx={{ fontSize: '0.55rem', color: 'text.secondary', ...(dc.isDeleted ? { textDecoration: 'line-through' } : {}) }}>
                              {dc.assignedAgent.fullName}
                            </Typography>
                          )}
                        </TableCell>
                        )}
                        {isColVisible('email') && (
                        <TableCell sx={{ whiteSpace: 'nowrap', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <Tooltip title={dc.ftdEmail || dc.leadId?.newEmail || '-'}>
                            <Typography sx={{ fontSize: '0.6rem', ...(dc.isDeleted ? { textDecoration: 'line-through', color: 'text.disabled' } : {}) }}>
                              {dc.ftdEmail || dc.leadId?.newEmail || '-'}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                        )}
                        {isColVisible('phone') && (
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Typography sx={{ fontSize: '0.5rem', ...(dc.isDeleted ? { textDecoration: 'line-through', color: 'text.disabled' } : {}) }}>
                            {formatPhoneWithCountryCode(dc.ftdPhone || dc.leadId?.newPhone, dc.leadId?.country || dc.lead?.country) || '-'}
                          </Typography>
                        </TableCell>
                        )}
                        {isColVisible('psp') && (
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Typography sx={{ fontSize: '0.55rem' }}>
                            {getLeadMetadata(dc)?.depositPSP?.name || '-'}
                          </Typography>
                        </TableCell>
                        )}
                        {isColVisible('cardIssuer') && (
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Typography sx={{ fontSize: '0.55rem' }}>
                            {getLeadMetadata(dc)?.depositCardIssuer?.name || '-'}
                          </Typography>
                        </TableCell>
                        )}
                        {isColVisible('deposit') && (
                        <TableCell sx={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {dc.isDeleted ? (
                            <Tooltip title={`Removed: ${dc.deletedReason || 'Lead removed'}`}>
                              <Chip label="Removed" size="small" color="error" variant="outlined" sx={{ height: 16, fontSize: '0.5rem', textDecoration: 'line-through', '& .MuiChip-label': { px: 0.3 } }} />
                            </Tooltip>
                          ) : dc.depositConfirmed || dc.depositStatus === 'confirmed' ? (
                            <Tooltip title={dc.depositConfirmedAt ? `Confirmed: ${formatFullDateTimeBG(dc.depositConfirmedAt)}` : 'Deposit Confirmed'}>
                              <VerifiedIcon color="success" sx={{ fontSize: 14 }} />
                            </Tooltip>
                          ) : (
                            <Chip label="Pending" size="small" color="warning" variant="outlined" sx={{ height: 16, fontSize: '0.55rem' }} />
                          )}
                        </TableCell>
                        )}
                        {/* Deposit Call Declaration column */}
                        {isColVisible('depositCall') && (
                        <TableCell sx={{ p: '2px 4px', textAlign: 'center' }}>
                          {dc.depositCallDeclaration ? (
                            <Tooltip title={`Deposit Call - ${dc.depositCallDeclaration.status}`}>
                              <Chip
                                label={dc.depositCallDeclaration.status === 'approved' ? 'Approved' : dc.depositCallDeclaration.status === 'pending' ? 'Pending' : dc.depositCallDeclaration.status === 'rejected' ? 'Rejected' : dc.depositCallDeclaration.status}
                                size="small"
                                color={dc.depositCallDeclaration.status === 'approved' ? 'success' : dc.depositCallDeclaration.status === 'pending' ? 'warning' : dc.depositCallDeclaration.status === 'rejected' ? 'error' : 'default'}
                                onClick={() => setSelectedDeclaration(dc.depositCallDeclaration)}
                                sx={{ fontSize: '0.5rem', height: 15, cursor: 'pointer', '& .MuiChip-label': { px: 0.5 } }}
                              />
                            </Tooltip>
                          ) : (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
                              {dc.depositAdminCalls?.length > 0 ? (
                                  <Chip
                                    label={dc.depositAdminCalls.length === 1
                                      ? formatDurationShort(dc.depositAdminCalls[0].callDuration)
                                      : `${dc.depositAdminCalls.length} calls`
                                    }
                                    size="small"
                                    onClick={() => handleOpenAdminCallsDetail(dc.depositAdminCalls, dc, 'deposit')}
                                    sx={{
                                      fontSize: '0.5rem',
                                      height: 15,
                                      bgcolor: ADMIN_CALL_COLOR,
                                      color: 'white',
                                      cursor: 'pointer',
                                      '& .MuiChip-label': { px: 0.5 },
                                      '& .MuiChip-deleteIcon': { fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)' },
                                    }}
                                    onDelete={isAdmin ? () => handleAdminRemoveCalls(dc._id, 'deposit') : undefined}
                                    deleteIcon={isAdmin ? <DeleteIcon /> : undefined}
                                  />
                              ) : (
                                <Typography sx={{ fontSize: '0.55rem', color: 'text.secondary' }}>-</Typography>
                              )}
                              {isAdmin && dc.assignedAgent && (
                                <Button
                                  size="small"
                                  variant="text"
                                  onClick={() => handleAdminFill(dc, 'deposit')}
                                  sx={{ fontSize: '0.45rem', py: 0, px: 0.3, minWidth: 'auto', lineHeight: 1.2, color: ADMIN_CALL_COLOR }}
                                >
                                  {dc.depositAdminCalls?.length > 0 ? '+Add' : 'Fill'}
                                </Button>
                              )}
                            </Box>
                          )}
                        </TableCell>
                        )}
                        {[1,2,3,4,5,6,7,8,9,10].map(num => (
                          isColVisible(`call${num}`) && <CallCell
                            key={num}
                            call={dc[`call${num}`]}
                            callNumber={num}
                            depositCall={dc}
                            declaration={dc.callDeclarations?.[num] || null}
                            onSchedule={handleScheduleCall}
                            onMarkDone={handleMarkDone}
                            onApprove={handleApproveCall}
                            onReject={handleRejectCall}
                            onMarkAnswered={handleMarkAnswered}
                            onMarkRejected={handleMarkRejected}
                            onViewDeclaration={setSelectedDeclaration}
                            onAdminFill={handleAdminFill}
                            onAdminRemove={handleAdminRemoveCalls}
                            onAdminCallsDetail={handleOpenAdminCallsDetail}
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

      {/* Filler Calls Tab */}
      {tabValue === 1 && (
        <Paper sx={{ width: '100%', overflow: 'auto' }}>
          {fillerLoading ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
              <CircularProgress />
            </Box>
          ) : fillerError ? (
            <Alert severity="error" sx={{ m: 2 }}>{fillerError}</Alert>
          ) : fillerDeclarations.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="h6" color="text.secondary">
                No filler declarations found
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Filler call declarations will appear here when agents submit them
              </Typography>
            </Box>
          ) : (
            <>
              <TableContainer sx={{ maxHeight: 'calc(100vh - 300px)' }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Agent</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Affiliate Manager</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Lead</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Call Date</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Duration</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Source</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Destination</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100', textAlign: 'center' }}>Recording</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100', textAlign: 'center' }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {fillerDeclarations.map((decl) => (
                      <TableRow key={decl._id} hover>
                        <TableCell>
                          <Typography variant="body2">{decl.agent?.fullName || 'N/A'}</Typography>
                          {decl.agent?.fourDigitCode && (
                            <Typography variant="caption" color="text.secondary">
                              ({decl.agent.fourDigitCode})
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{decl.affiliateManager?.fullName || 'N/A'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {decl.lead ? `${decl.lead.firstName || ''} ${decl.lead.lastName || ''}`.trim() || 'N/A' : 'N/A'}
                          </Typography>
                          {decl.lead?.newEmail && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              {decl.lead.newEmail}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {decl.callDate ? formatDateTimeBG(decl.callDate) : 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {(() => {
                              const h = Math.floor(decl.callDuration / 3600);
                              const m = Math.floor((decl.callDuration % 3600) / 60);
                              const s = decl.callDuration % 60;
                              return h > 0
                                ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
                                : `${m}:${String(s).padStart(2,'0')}`;
                            })()}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace" sx={{ fontSize: '0.75rem' }}>{decl.sourceNumber}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace" sx={{ fontSize: '0.75rem' }}>{decl.destinationNumber}</Typography>
                        </TableCell>
                        <TableCell sx={{ textAlign: 'center' }}>
                          {decl.recordFile ? (
                            <Tooltip title="Play Recording">
                              <IconButton size="small" color="primary" onClick={() => setRecordingDeclaration(decl)}>
                                <PlayIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          ) : (
                            <Typography variant="caption" color="text.secondary">-</Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ textAlign: 'center' }}>
                          <Chip
                            label="Review"
                            size="small"
                            variant="outlined"
                            color="primary"
                            onClick={() => setSelectedDeclaration(decl)}
                            sx={{ cursor: 'pointer' }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={fillerTotalCount}
                page={fillerPage}
                onPageChange={(e, newPage) => setFillerPage(newPage)}
                rowsPerPage={fillerRowsPerPage}
                onRowsPerPageChange={(e) => {
                  setFillerRowsPerPage(parseInt(e.target.value, 10));
                  setFillerPage(0);
                }}
                rowsPerPageOptions={[10, 25, 50, 100]}
              />
            </>
          )}
        </Paper>
      )}

      {/* Recording Playback Dialog */}
      <Dialog
        open={!!recordingDeclaration}
        onClose={() => setRecordingDeclaration(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={1}>
              <PlayIcon color="primary" />
              <Typography variant="h6">Call Recording</Typography>
            </Box>
            <IconButton size="small" onClick={() => setRecordingDeclaration(null)}>
              <RejectIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {recordingDeclaration && (
            <Box sx={{ py: 1 }}>
              <Box display="flex" gap={3} mb={2}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Agent</Typography>
                  <Typography variant="body2">{recordingDeclaration.agent?.fullName || 'N/A'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Date</Typography>
                  <Typography variant="body2">
                    {recordingDeclaration.callDate ? formatFullDateTimeBG(recordingDeclaration.callDate) : 'N/A'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Duration</Typography>
                  <Typography variant="body2">
                    {(() => {
                      const s = recordingDeclaration.callDuration;
                      const h = Math.floor(s / 3600);
                      const m = Math.floor((s % 3600) / 60);
                      const sec = s % 60;
                      return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`;
                    })()}
                  </Typography>
                </Box>
              </Box>
              <Box display="flex" gap={3} mb={2}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Source</Typography>
                  <Typography variant="body2" fontFamily="monospace">{recordingDeclaration.sourceNumber}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Destination</Typography>
                  <Typography variant="body2" fontFamily="monospace">{recordingDeclaration.destinationNumber}</Typography>
                </Box>
              </Box>
              {recordingDeclaration.lead && (
                <Box mb={2}>
                  <Typography variant="caption" color="text.secondary">Lead</Typography>
                  <Typography variant="body2">
                    {`${recordingDeclaration.lead.firstName || ''} ${recordingDeclaration.lead.lastName || ''}`.trim() || 'N/A'}
                    {recordingDeclaration.lead.newPhone ? ` - ${recordingDeclaration.lead.newPhone}` : ''}
                  </Typography>
                </Box>
              )}
              {audioLoading ? (
                <Box display="flex" justifyContent="center" alignItems="center" py={2}>
                  <CircularProgress size={24} sx={{ mr: 1 }} />
                  <Typography variant="body2" color="text.secondary">Loading recording...</Typography>
                </Box>
              ) : audioUrl ? (
                <audio controls src={audioUrl} style={{ width: '100%' }} />
              ) : (
                <Typography variant="body2" color="error">Failed to load recording</Typography>
              )}
            </Box>
          )}
        </DialogContent>
      </Dialog>

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
                            ? formatFullDateTimeBG(entry.assignedAt)
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
                            ? formatFullDateTimeBG(entry.assignedAt)
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

      {/* Custom Deposit Call Record Dialog */}
      <Dialog
        open={customRecordOpen}
        onClose={handleCustomRecordClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Custom Deposit Call Record</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Email Search */}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                size="small"
                label="Lead Email"
                value={customRecordEmail}
                onChange={(e) => setCustomRecordEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCustomRecordSearch(); }}
                placeholder="Enter lead email..."
              />
              <Button
                variant="contained"
                onClick={handleCustomRecordSearch}
                disabled={customRecordSearching || !customRecordEmail.trim()}
                sx={{ minWidth: 80 }}
              >
                {customRecordSearching ? <CircularProgress size={20} /> : 'Search'}
              </Button>
            </Box>

            {/* Lead Info */}
            {customRecordLead && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>Lead Found</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Typography variant="body2">
                    <strong>Name:</strong> {customRecordLead.firstName} {customRecordLead.lastName}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Email:</strong> {customRecordLead.newEmail}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Phone:</strong> {customRecordLead.newPhone || '-'}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Country:</strong> {customRecordLead.country || '-'}
                  </Typography>
                  {customRecordLead.assignedAgent && (
                    <Typography variant="body2">
                      <strong>Agent:</strong> {customRecordLead.assignedAgent?.fullName || customRecordLead.assignedAgent}
                    </Typography>
                  )}
                </Box>
              </Paper>
            )}

            {/* Required + Optional Fields */}
            {customRecordLead && (
              <>
                <TextField
                  fullWidth
                  size="small"
                  label="Note *"
                  value={customRecordNote}
                  onChange={(e) => setCustomRecordNote(e.target.value)}
                  placeholder="Enter a note to identify this record..."
                  required
                  multiline
                  rows={2}
                />
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="Date (optional - shown in Order Created column)"
                  value={customRecordDate}
                  onChange={(e) => setCustomRecordDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  fullWidth
                  size="small"
                  label="Order ID (optional)"
                  value={customRecordOrderId}
                  onChange={(e) => setCustomRecordOrderId(e.target.value)}
                  placeholder="Enter order ID..."
                />
                <FormControl fullWidth size="small">
                  <InputLabel>Affiliate Manager (optional)</InputLabel>
                  <Select
                    value={customRecordAM}
                    onChange={(e) => setCustomRecordAM(e.target.value)}
                    label="Affiliate Manager (optional)"
                  >
                    <MenuItem value="">None</MenuItem>
                    {accountManagers.map(am => (
                      <MenuItem key={am._id} value={am._id}>{am.fullName}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth size="small">
                  <InputLabel>Agent (optional)</InputLabel>
                  <Select
                    value={customRecordAgent}
                    onChange={(e) => setCustomRecordAgent(e.target.value)}
                    label="Agent (optional)"
                  >
                    <MenuItem value="">None</MenuItem>
                    {agents.map(agent => (
                      <MenuItem key={agent._id} value={agent._id}>{agent.fullName}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCustomRecordClose}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCustomRecordCreate}
            disabled={!customRecordLead || customRecordCreating}
          >
            {customRecordCreating ? <CircularProgress size={20} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Admin Calls Detail Dialog */}
      <Dialog
        open={adminCallsDetailOpen}
        onClose={handleCloseAdminCallsDetail}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={1}>
              <AdminIcon sx={{ color: ADMIN_CALL_COLOR }} />
              <Box>
                <Typography variant="h6">
                  Admin Calls — {adminCallsDetailData?.callSlot === 'deposit' ? 'Deposit Call' : `C${adminCallsDetailData?.callSlot}`}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {adminCallsDetailData?.depositCall?.ftdName} | {adminCallsDetailData?.depositCall?.assignedAgent?.fullName || ''}
                </Typography>
              </Box>
            </Box>
            <IconButton size="small" onClick={handleCloseAdminCallsDetail}>
              <RejectIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {adminCallsDetailData?.calls?.map((ac, idx) => (
            <Box
              key={idx}
              sx={{
                p: 1.5,
                mb: 1,
                borderRadius: 1,
                border: '1px solid',
                borderColor: adminCallsPlayingIdx === idx ? ADMIN_CALL_COLOR : 'grey.200',
                bgcolor: adminCallsPlayingIdx === idx ? 'action.hover' : 'transparent',
              }}
            >
              <Box display="flex" alignItems="center" gap={1.5} mb={adminCallsPlayingIdx === idx ? 1 : 0}>
                <Chip
                  label={formatDurationShort(ac.callDuration)}
                  size="small"
                  sx={{ bgcolor: ADMIN_CALL_COLOR, color: 'white', fontWeight: 'bold', fontSize: '0.75rem' }}
                />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" fontFamily="monospace">
                    {ac.destinationNumber || ac.sourceNumber || '—'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {ac.callDate ? formatDateTime(ac.callDate) : '—'}
                    {ac.addedByName ? ` · Added by ${ac.addedByName}` : ''}
                  </Typography>
                </Box>
                {ac.recordFile && (
                  <IconButton
                    size="small"
                    onClick={() => handlePlayAdminRecording(idx, ac.recordFile)}
                    sx={{ color: adminCallsPlayingIdx === idx ? ADMIN_CALL_COLOR : 'primary.main' }}
                  >
                    <PlayIcon />
                  </IconButton>
                )}
              </Box>
              {adminCallsPlayingIdx === idx && (
                <Box sx={{ mt: 1 }}>
                  {adminCallsAudioLoading ? (
                    <Box display="flex" alignItems="center" gap={1} py={0.5}>
                      <CircularProgress size={18} />
                      <Typography variant="caption" color="text.secondary">Loading recording...</Typography>
                    </Box>
                  ) : adminCallsAudioUrl ? (
                    <audio controls autoPlay src={adminCallsAudioUrl} style={{ width: '100%', height: 36 }} />
                  ) : !ac.recordFile ? (
                    <Typography variant="caption" color="text.secondary">No recording available</Typography>
                  ) : (
                    <Typography variant="caption" color="error">Failed to load recording</Typography>
                  )}
                </Box>
              )}
            </Box>
          ))}
        </DialogContent>
      </Dialog>

      {/* Admin Fill Dialog */}
      <Dialog
        open={adminFillOpen}
        onClose={handleAdminFillClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <AdminIcon sx={{ color: ADMIN_CALL_COLOR }} />
            <Box>
              <Typography variant="h6">
                Admin Fill — {adminFillTarget?.callSlot === 'deposit' ? 'Deposit Call' : `Call ${adminFillTarget?.callSlot}`}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                FTD: {adminFillTarget?.depositCall?.ftdName} | Agent: {adminFillTarget?.depositCall?.assignedAgent?.fullName || 'N/A'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Select short calls (&lt;15 min) from agent's CDR history. These will NOT count as bonus.
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {adminFillLoading ? (
            <Box display="flex" justifyContent="center" alignItems="center" py={4}>
              <CircularProgress />
            </Box>
          ) : adminFillCalls.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                No short calls found for this agent in the last 3 months
              </Typography>
            </Box>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {adminFillCalls.length} short call{adminFillCalls.length !== 1 ? 's' : ''} found. Select calls to add:
              </Typography>
              <List dense sx={{ maxHeight: 400, overflow: 'auto' }}>
                {adminFillCalls.map((call, index) => (
                  <ListItem
                    key={index}
                    dense
                    button
                    onClick={() => toggleAdminFillSelection(index)}
                    sx={{
                      bgcolor: adminFillSelected.includes(index) ? 'action.selected' : 'transparent',
                      borderRadius: 1,
                      mb: 0.5,
                      border: '1px solid',
                      borderColor: adminFillSelected.includes(index) ? ADMIN_CALL_COLOR : 'grey.200',
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Checkbox
                        checked={adminFillSelected.includes(index)}
                        size="small"
                        sx={{ '&.Mui-checked': { color: ADMIN_CALL_COLOR } }}
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Chip
                            label={call.formattedDuration || formatDurationShort(call.callDuration)}
                            size="small"
                            sx={{ bgcolor: ADMIN_CALL_COLOR, color: 'white', fontSize: '0.7rem', height: 20 }}
                          />
                          <Typography variant="body2" fontFamily="monospace" sx={{ fontSize: '0.75rem' }}>
                            {call.lineNumber || call.email || call.destinationNumber || '—'}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Typography variant="caption" color="text.secondary">
                          {call.callDate ? formatDateTime(call.callDate) : 'N/A'}
                          {call.sourceNumber ? ` | From: ${call.sourceNumber}` : ''}
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Typography variant="body2" sx={{ mr: 'auto', ml: 1, color: ADMIN_CALL_COLOR, fontWeight: 500 }}>
            {adminFillSelected.length} call{adminFillSelected.length !== 1 ? 's' : ''} selected
          </Typography>
          <Button onClick={handleAdminFillClose}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAdminFillSave}
            disabled={adminFillSelected.length === 0 || adminFillSaving}
            sx={{ bgcolor: ADMIN_CALL_COLOR, '&:hover': { bgcolor: '#e65100' } }}
          >
            {adminFillSaving ? <CircularProgress size={20} /> : 'Add Calls'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Call Declaration Approval Dialog */}
      <CallDeclarationApprovalDialog
        open={!!selectedDeclaration}
        declaration={selectedDeclaration}
        onClose={() => setSelectedDeclaration(null)}
        onDeclarationUpdated={() => {
          setSelectedDeclaration(null);
          fetchDepositCalls();
          if (tabValue === 1) fetchFillerDeclarations();
        }}
        isAdmin={isAdmin}
        onReset={selectedDeclaration?.callCategory === 'filler' ? null : async (declarationId) => {
          await api.put(`/call-declarations/${declarationId}/reset`);
          toast.success('Declaration reset successfully');
          setSelectedDeclaration(null);
          fetchDepositCalls();
          if (tabValue === 1) fetchFillerDeclarations();
        }}
      />
    </Box>
  );
};

export default DepositCallsPage;

