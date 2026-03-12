import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  TextField,
  Button,
  IconButton,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Divider,
  InputAdornment,
  Collapse,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Speed as TestIcon,
  Close as CloseIcon,
  Webhook as WebhookIcon,
  FiberManualRecord as DotIcon,
  Sms as SmsIcon,
  CloudDownload as FetchIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  ContactPhone as NumbersIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { smsService } from '../services/smsService';
import gatewayDeviceService from '../services/gatewayDeviceService';
import chatService from '../services/chatService';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

// ─── Gateway Sidebar Item ────────────────────────────────────
const GatewayItem = ({ gateway, onTest, onEdit, onDelete, onSetupForwarding, onSelect, selected, testing }) => {
  const theme = useTheme();
  const isConnected = gateway.lastConnectionStatus === 'success';
  const isTesting = testing === gateway._id;

  return (
    <Box
      onClick={() => onSelect(gateway._id)}
      sx={{
        px: 1.5, py: 1,
        cursor: 'pointer',
        borderLeft: '3px solid',
        borderLeftColor: selected ? theme.palette.warning.main : 'transparent',
        bgcolor: selected ? alpha(theme.palette.warning.main, 0.06) : 'transparent',
        transition: 'all 0.15s',
        '&:hover': { bgcolor: selected ? alpha(theme.palette.warning.main, 0.08) : alpha(theme.palette.action.hover, 0.04) },
      }}
    >
      <Box display="flex" alignItems="center" gap={0.75}>
        <DotIcon sx={{ fontSize: 8, color: isConnected ? 'success.main' : 'grey.400', flexShrink: 0 }} />
        <Typography variant="body2" noWrap sx={{ flex: 1, fontWeight: selected ? 600 : 500, fontSize: '0.82rem' }}>
          {gateway.name}
        </Typography>
        {!gateway.isActive && (
          <Chip label="Off" size="small" sx={{ height: 16, fontSize: '0.6rem' }} />
        )}
      </Box>

      <Box display="flex" alignItems="center" justifyContent="space-between" mt={0.25} ml={1.75}>
        <Typography variant="caption" color="text.disabled" fontFamily="monospace" fontSize="0.65rem" noWrap>
          {gateway.host}:{gateway.port}
        </Typography>
        {gateway.webhook?.enabled && (
          <WebhookIcon sx={{ fontSize: 12, color: 'info.main', flexShrink: 0 }} />
        )}
      </Box>

      <Box display="flex" gap={0.25} mt={0.5} ml={1.25} onClick={(e) => e.stopPropagation()}>
        {gateway.webhook?.enabled && (
          <Tooltip title="Setup SMS forwarding">
            <IconButton size="small" color="info" onClick={() => onSetupForwarding(gateway)} sx={{ p: 0.25 }}>
              <WebhookIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Test">
          <IconButton size="small" onClick={() => onTest(gateway)} disabled={isTesting} sx={{ p: 0.25 }}>
            {isTesting ? <CircularProgress size={12} /> : <TestIcon sx={{ fontSize: 14 }} />}
          </IconButton>
        </Tooltip>
        <Tooltip title="Edit">
          <IconButton size="small" onClick={() => onEdit(gateway)} sx={{ p: 0.25 }}>
            <EditIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton size="small" color="error" onClick={() => onDelete(gateway)} sx={{ p: 0.25 }}>
            <DeleteIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
};

// ─── Gateway Dialog ──────────────────────────────────────────
const GatewayDialog = ({ open, onClose, gateway, onSave }) => {
  const [formData, setFormData] = useState({
    name: '', host: '', port: '', username: '', password: '',
    description: '', isActive: true,
    webhookEnabled: false, webhookSlug: '', webhookUsername: '', webhookPassword: '',
  });
  const [portNumbers, setPortNumbers] = useState([]); // [{ port: '1', number: '+34...' }]
  const [showPorts, setShowPorts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingPorts, setLoadingPorts] = useState(false);

  useEffect(() => {
    if (gateway) {
      setFormData({
        name: gateway.name || '',
        host: gateway.host || '',
        port: gateway.port || '',
        username: gateway.username || '',
        password: '',
        description: gateway.description || '',
        isActive: gateway.isActive ?? true,
        webhookEnabled: gateway.webhook?.enabled || false,
        webhookSlug: gateway.webhook?.slug || '',
        webhookUsername: gateway.webhook?.username || '',
        webhookPassword: gateway.webhook?.password || '',
      });
      // Load existing port numbers
      const existing = gateway.portNumbers || {};
      const entries = Object.entries(existing)
        .map(([p, n]) => ({ port: p, number: n || '' }))
        .sort((a, b) => parseInt(a.port) - parseInt(b.port));
      setPortNumbers(entries);
      setShowPorts(entries.length > 0);
    } else {
      setFormData({
        name: '', host: '', port: '80', username: '', password: '',
        description: '', isActive: true,
        webhookEnabled: false, webhookSlug: '', webhookUsername: '', webhookPassword: '',
      });
      setPortNumbers([]);
      setShowPorts(false);
    }
  }, [gateway, open]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.host || !formData.port || !formData.username) {
      toast.error('Name, host, port and username are required');
      return;
    }
    if (!gateway && !formData.password) {
      toast.error('Password is required for new gateways');
      return;
    }

    setSaving(true);
    try {
      const data = { ...formData };
      if (gateway && !data.password) delete data.password;
      data.webhook = {
        enabled: data.webhookEnabled,
        slug: data.webhookSlug,
        username: data.webhookUsername,
        password: data.webhookPassword,
      };
      delete data.webhookEnabled;
      delete data.webhookSlug;
      delete data.webhookUsername;
      delete data.webhookPassword;

      // Build portNumbers map from entries (skip empty ports)
      const pnMap = {};
      portNumbers.forEach(({ port, number }) => {
        if (port && number) pnMap[port] = number;
      });
      data.portNumbers = pnMap;

      await onSave(data, gateway?._id);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save gateway');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        {gateway ? 'Edit Gateway' : 'Add Gateway'}
      </DialogTitle>
      <DialogContent sx={{ pt: '8px !important' }}>
        <Box display="flex" flexDirection="column" gap={2}>
          <Box display="flex" gap={2}>
            <TextField fullWidth size="small" label="Name *" name="name"
              value={formData.name} onChange={handleChange} placeholder="e.g. GSM-32" />
            <FormControlLabel
              control={<Switch checked={formData.isActive} onChange={(e) =>
                setFormData((p) => ({ ...p, isActive: e.target.checked }))} size="small" />}
              label="Active" sx={{ ml: 0 }}
            />
          </Box>

          <Box display="flex" gap={2}>
            <TextField fullWidth size="small" label="Host *" name="host"
              value={formData.host} onChange={handleChange} placeholder="IP or hostname" />
            <TextField sx={{ width: 120 }} size="small" label="Port *" name="port" type="number"
              value={formData.port} onChange={handleChange} />
          </Box>

          <Box display="flex" gap={2}>
            <TextField fullWidth size="small" label="API Username *" name="username"
              value={formData.username} onChange={handleChange} />
            <TextField fullWidth size="small" label="API Password" name="password" type="password"
              value={formData.password} onChange={handleChange}
              helperText={gateway ? 'Blank = keep current' : ''} />
          </Box>

          <TextField fullWidth size="small" label="Description" name="description"
            value={formData.description} onChange={handleChange} multiline rows={2} />

          <Divider />

          <Box>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <WebhookIcon fontSize="small" color="action" />
              <Typography variant="subtitle2">SMS Webhook</Typography>
              <Switch size="small" checked={formData.webhookEnabled}
                onChange={(e) => setFormData((p) => ({ ...p, webhookEnabled: e.target.checked }))} />
            </Box>
            <Collapse in={formData.webhookEnabled}>
              <Box display="flex" flexDirection="column" gap={1.5}>
                <TextField fullWidth size="small" label="Webhook Slug" name="webhookSlug"
                  value={formData.webhookSlug} onChange={handleChange}
                  helperText={formData.webhookSlug ?
                    `URL: ${window.location.origin.replace(/:\d+$/, ':5000')}/${formData.webhookSlug}` :
                    'e.g. gsm_canada1'} />
                <Box display="flex" gap={2}>
                  <TextField fullWidth size="small" label="Webhook User" name="webhookUsername"
                    value={formData.webhookUsername} onChange={handleChange} />
                  <TextField fullWidth size="small" label="Webhook Pass" name="webhookPassword"
                    value={formData.webhookPassword} onChange={handleChange} />
                </Box>
              </Box>
            </Collapse>
          </Box>

          <Divider />

          {/* Port Numbers Section */}
          <Box>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <NumbersIcon fontSize="small" color="action" />
              <Typography variant="subtitle2">Port Numbers</Typography>
              <Switch size="small" checked={showPorts}
                onChange={(e) => setShowPorts(e.target.checked)} />
              {showPorts && gateway && (
                <Button
                  size="small" variant="text"
                  disabled={loadingPorts}
                  onClick={async () => {
                    setLoadingPorts(true);
                    try {
                      const res = await gatewayDeviceService.getGatewayNumbers(gateway._id);
                      if (res.success && Array.isArray(res.data?.numbers)) {
                        const fetched = res.data.numbers.map((item) => {
                          const ps = String(item.port);
                          const portOnly = ps.includes('.') ? ps.split('.')[0] : ps;
                          return { port: portOnly, number: item.number || '' };
                        });
                        // Merge: keep existing numbers, add new ports
                        const existingMap = {};
                        portNumbers.forEach((e) => { if (e.number) existingMap[e.port] = e.number; });
                        fetched.forEach((e) => { if (!e.number && existingMap[e.port]) e.number = existingMap[e.port]; });
                        setPortNumbers(fetched);
                        toast.success(`Loaded ${fetched.length} ports from device`);
                      }
                    } catch { toast.error('Failed to load ports'); }
                    finally { setLoadingPorts(false); }
                  }}
                  sx={{ fontSize: '0.7rem', textTransform: 'none', ml: 'auto' }}
                >
                  {loadingPorts ? 'Loading...' : 'Load from device'}
                </Button>
              )}
            </Box>
            <Collapse in={showPorts}>
              <Box sx={{ maxHeight: 240, overflowY: 'auto', mb: 1 }}>
                <Box display="flex" flexWrap="wrap" gap={0.75}>
                  {portNumbers.map((entry, idx) => (
                    <Box key={idx} display="flex" gap={0.5} alignItems="center">
                      <TextField
                        size="small" placeholder="Port"
                        value={entry.port}
                        onChange={(e) => {
                          const updated = [...portNumbers];
                          updated[idx] = { ...updated[idx], port: e.target.value };
                          setPortNumbers(updated);
                        }}
                        sx={{ width: 52, '& .MuiOutlinedInput-root': { height: 28, fontSize: '0.75rem' } }}
                      />
                      <TextField
                        size="small" placeholder="Number"
                        value={entry.number}
                        onChange={(e) => {
                          const updated = [...portNumbers];
                          updated[idx] = { ...updated[idx], number: e.target.value };
                          setPortNumbers(updated);
                        }}
                        sx={{ width: 130, '& .MuiOutlinedInput-root': { height: 28, fontSize: '0.75rem' } }}
                      />
                      <IconButton size="small" onClick={() => setPortNumbers((p) => p.filter((_, i) => i !== idx))} sx={{ p: 0.15 }}>
                        <CloseIcon sx={{ fontSize: 12 }} />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              </Box>
              <Button
                size="small" variant="text" startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                onClick={() => setPortNumbers((p) => [...p, { port: String(p.length + 1), number: '' }])}
                sx={{ fontSize: '0.7rem', textTransform: 'none' }}
              >
                Add port
              </Button>
            </Collapse>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={saving}>
          {saving ? 'Saving...' : gateway ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── SMS Content Dialog (content only) ───────────────────────
const SMSContentDialog = ({ open, onClose, sms }) => {
  if (!sms) return null;
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5, px: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {sms.sender || 'Unknown'} &middot; {formatTs(sms.timestamp)}
        </Typography>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ px: 2, pb: 2, pt: '0 !important' }}>
        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6 }}>
          {sms.content || '-'}
        </Typography>
      </DialogContent>
    </Dialog>
  );
};

// ─── Helpers ─────────────────────────────────────────────────
function formatTs(ts) {
  if (!ts) return '-';
  try { return format(new Date(ts), 'MMM dd, HH:mm:ss'); } catch { return '-'; }
}

function truncate(str, max = 60) {
  if (!str) return '-';
  return str.length <= max ? str : str.substring(0, max) + '...';
}

// ─── Main Page ───────────────────────────────────────────────
const SMSGatewayPage = () => {
  const theme = useTheme();

  // ── Gateway state ──
  const [gateways, setGateways] = useState([]);
  const [gatewaysLoading, setGatewaysLoading] = useState(true);
  const [testingGateway, setTestingGateway] = useState(null);
  const [gatewayDialogOpen, setGatewayDialogOpen] = useState(false);
  const [editingGateway, setEditingGateway] = useState(null);
  const [selectedGatewayId, setSelectedGatewayId] = useState(null);

  // ── SMS state ──
  const [smsMessages, setSmsMessages] = useState([]);
  const [smsLoading, setSmsLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedSms, setSelectedSms] = useState(null);

  const [fetching, setFetching] = useState(false);

  // ── Filter state ──
  const [filters, setFilters] = useState({
    search: '', port: '', dateFrom: null, dateTo: null,
  });
  const [sortBy, setSortBy] = useState('timestamp');
  const [sortDir, setSortDir] = useState('desc');
  const [portNumbers, setPortNumbers] = useState({}); // gatewayId -> { port -> number }

  // Ref to track if initial load has happened
  const initialLoadDone = useRef(false);

  // ── Load gateways ──
  const fetchGateways = useCallback(async () => {
    try {
      setGatewaysLoading(true);
      const res = await gatewayDeviceService.getGatewayDevices(true);
      setGateways(res.data || []);
    } catch { toast.error('Failed to load gateways'); }
    finally { setGatewaysLoading(false); }
  }, []);

  // ── Load SMS ──
  const fetchSMS = useCallback(async () => {
    try {
      setSmsLoading(true);
      const params = { page: page + 1, limit: rowsPerPage, sortBy, sortDir };
      if (filters.search) params.search = filters.search;
      if (filters.port) params.port = filters.port;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom.toISOString();
      if (filters.dateTo) params.dateTo = filters.dateTo.toISOString();
      if (selectedGatewayId) params.gatewayDevice = selectedGatewayId;

      const res = await smsService.getSMSMessages(params);
      setSmsMessages(res.data || []);
      setTotalCount(res.pagination?.total || 0);
      initialLoadDone.current = true;
    } catch { toast.error('Failed to load SMS'); }
    finally { setSmsLoading(false); }
  }, [page, rowsPerPage, filters, selectedGatewayId, sortBy, sortDir]);

  // ── Initial fetch ──
  useEffect(() => { fetchGateways(); }, [fetchGateways]);
  useEffect(() => { fetchSMS(); }, [fetchSMS]);

  // ── Real-time SMS via socket ──
  useEffect(() => {
    const handleNewSms = (data) => {
      if (!data?.sms) return;
      // Skip if a gateway filter is active and this SMS is from a different gateway
      const smsGatewayId = data.sms.gatewayDevice?._id || data.sms.gatewayDevice;
      if (selectedGatewayId && smsGatewayId !== selectedGatewayId) return;
      // Only prepend if we're on the first page with no active text/sim/date filters
      if (page === 0 && !filters.search && !filters.port && !filters.dateFrom && !filters.dateTo) {
        setSmsMessages((prev) => {
          if (prev.some((m) => m._id === data.sms._id)) return prev;
          const updated = [data.sms, ...prev];
          if (updated.length > rowsPerPage) updated.pop();
          return updated;
        });
        setTotalCount((prev) => prev + 1);
      }
    };

    chatService.on('sms:new_message', handleNewSms);
    return () => chatService.off('sms:new_message', handleNewSms);
  }, [page, filters, rowsPerPage, selectedGatewayId]);

  // ── Gateway handlers ──
  const handleTestConnection = async (gw) => {
    setTestingGateway(gw._id);
    try {
      const res = await gatewayDeviceService.testGatewayConnection(gw._id);
      toast[res.success ? 'success' : 'error'](
        res.success ? `${gw.name}: Connected` : `${gw.name}: ${res.error || 'Failed'}`
      );
      fetchGateways();
    } catch { toast.error('Connection test failed'); }
    finally { setTestingGateway(null); }
  };

  const handleSaveGateway = async (data, id) => {
    if (id) {
      await gatewayDeviceService.updateGatewayDevice(id, data);
      toast.success('Gateway updated');
    } else {
      await gatewayDeviceService.createGatewayDevice(data);
      toast.success('Gateway created');
    }
    fetchGateways();
  };

  const handleDeleteGateway = async (gw) => {
    if (!window.confirm(`Delete gateway "${gw.name}"?`)) return;
    try {
      await gatewayDeviceService.deleteGatewayDevice(gw._id);
      toast.success('Gateway deleted');
      fetchGateways();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  // ── Select gateway to filter SMS ──
  const handleSelectGateway = (gatewayId) => {
    setSelectedGatewayId((prev) => prev === gatewayId ? null : gatewayId);
    setPage(0);
  };

  // ── Setup SMS forwarding ──
  const handleSetupForwarding = async (gw) => {
    try {
      const res = await gatewayDeviceService.configureSmsForwarding(gw._id);
      if (res.success) {
        toast.success(`SMS forwarding configured on ${gw.name}. Incoming SMS will appear automatically.`);
      } else {
        toast.error(res.message || 'Failed to configure forwarding');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to configure SMS forwarding');
    }
  };

  // ── Fetch from all gateways ──
  const handleFetchFromAllGateways = async () => {
    const activeGateways = gateways.filter((g) => g.isActive);
    if (activeGateways.length === 0) return toast.error('No active gateways');
    setFetching(true);
    let totalSaved = 0;
    let errors = 0;
    try {
      for (const gw of activeGateways) {
        try {
          const res = await smsService.fetchFromGateway(gw._id);
          if (res.success) totalSaved += res.data?.saved || 0;
        } catch { errors++; }
      }
      if (errors > 0) {
        toast.error(`Fetched from ${activeGateways.length - errors}/${activeGateways.length} gateways (${errors} failed). ${totalSaved} new messages.`);
      } else {
        toast.success(`Fetched from ${activeGateways.length} gateways. ${totalSaved} new messages.`);
      }
      fetchSMS();
    } finally { setFetching(false); }
  };

  // ── Filter handlers ──
  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setPage(0);
  };

  const clearFilters = () => {
    setFilters({ search: '', port: '', dateFrom: null, dateTo: null });
    setSortBy('timestamp');
    setSortDir('desc');
    setPage(0);
  };

  // ── Sort handler ──
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir(field === 'port' ? 'asc' : 'desc');
    }
    setPage(0);
  };

  const hasActiveFilters = filters.search || filters.port || filters.dateFrom || filters.dateTo || selectedGatewayId;
  const selectedGatewayName = selectedGatewayId ? gateways.find((g) => g._id === selectedGatewayId)?.name : null;

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ display: 'flex', width: '100%', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>

        {/* ── Gateway Sidebar ── */}
        <Paper
          variant="outlined"
          sx={{
            width: 240, minWidth: 240, display: 'flex', flexDirection: 'column',
            borderRight: '1px solid', borderColor: 'divider', borderRadius: 0,
            overflow: 'hidden',
          }}
        >
          {/* Sidebar Header */}
          <Box sx={{
            px: 1.5, py: 1,
            bgcolor: alpha(theme.palette.primary.main, 0.04),
            borderBottom: '1px solid', borderColor: 'divider',
          }}>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={0.75}>
              <Box display="flex" alignItems="center" gap={0.75}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: 1 }}>
                  Gateways
                </Typography>
                <Chip label={gateways.length} size="small" sx={{ height: 16, fontSize: '0.6rem' }} />
              </Box>
              <Tooltip title="Add gateway">
                <IconButton size="small" color="primary"
                  onClick={() => { setEditingGateway(null); setGatewayDialogOpen(true); }}
                  sx={{ p: 0.25 }}>
                  <AddIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </Box>
            <Box display="flex" gap={0.5}>
              <Button size="small" variant="outlined" fullWidth
                startIcon={fetching ? <CircularProgress size={12} /> : <FetchIcon sx={{ fontSize: '14px !important' }} />}
                onClick={handleFetchFromAllGateways}
                disabled={gateways.length === 0 || fetching}
                sx={{ height: 26, fontSize: '0.7rem', textTransform: 'none' }}>
                {fetching ? 'Fetching...' : 'Fetch SMS'}
              </Button>
              <Tooltip title="Refresh">
                <IconButton size="small" onClick={() => { fetchGateways(); fetchSMS(); }} sx={{ p: 0.25 }}>
                  <RefreshIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Gateway List */}
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            {gatewaysLoading ? (
              <Box display="flex" alignItems="center" justifyContent="center" py={3}>
                <CircularProgress size={16} />
              </Box>
            ) : gateways.length === 0 ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', py: 3, px: 2 }}>
                No gateways. Click + to add one.
              </Typography>
            ) : (
              gateways.map((gw, i) => (
                <React.Fragment key={gw._id}>
                  {i > 0 && <Divider />}
                  <GatewayItem
                    gateway={gw}
                    testing={testingGateway}
                    selected={selectedGatewayId === gw._id}
                    onSelect={handleSelectGateway}
                    onTest={handleTestConnection}
                    onEdit={(g) => { setEditingGateway(g); setGatewayDialogOpen(true); }}
                    onDelete={handleDeleteGateway}
                    onSetupForwarding={handleSetupForwarding}
                  />
                </React.Fragment>
              ))
            )}
          </Box>
        </Paper>

        {/* ── SMS Main Content ── */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* SMS Header + Filters (always visible) */}
          <Box
            display="flex" alignItems="center" flexWrap="wrap" gap={1}
            sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}
          >
            <Box display="flex" alignItems="center" gap={0.75} mr={1}>
              <SmsIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: 1 }}>
                Messages
              </Typography>
              <Chip label={totalCount} size="small" sx={{ height: 16, fontSize: '0.6rem' }} />
              {selectedGatewayName && (
                <Chip
                  label={selectedGatewayName}
                  size="small"
                  color="warning"
                  onDelete={() => setSelectedGatewayId(null)}
                  sx={{ height: 20, fontSize: '0.65rem' }}
                />
              )}
            </Box>

            <TextField
              size="small" placeholder="Search from, to, content..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16 }} /></InputAdornment>,
              }}
              sx={{
                width: 240,
                '& .MuiOutlinedInput-root': {
                  height: 28, borderRadius: 6, fontSize: '0.78rem', bgcolor: 'background.paper',
                  boxShadow: (t) => `0 1px 2px ${alpha(t.palette.grey[400], 0.15)}`,
                  '& fieldset': { border: '1px solid', borderColor: (t) => alpha(t.palette.grey[300], 0.7) },
                  '&:hover fieldset': { borderColor: (t) => alpha(t.palette.primary.main, 0.3) },
                  '&.Mui-focused fieldset': { borderColor: 'primary.main', borderWidth: 1.5 },
                },
                '& input::placeholder': { fontSize: '0.75rem', opacity: 0.6 },
              }}
            />

            <Box display="flex" alignItems="center" gap={0.5}>
              <TextField
                size="small" placeholder="Port..."
                value={filters.port}
                onChange={(e) => handleFilterChange('port', e.target.value)}
                sx={{
                  width: 70,
                  '& .MuiOutlinedInput-root': {
                    height: 28, borderRadius: 6, fontSize: '0.78rem', bgcolor: 'background.paper',
                    boxShadow: (t) => `0 1px 2px ${alpha(t.palette.grey[400], 0.15)}`,
                    '& fieldset': { border: '1px solid', borderColor: (t) => alpha(t.palette.grey[300], 0.7) },
                    '&:hover fieldset': { borderColor: (t) => alpha(t.palette.primary.main, 0.3) },
                    '&.Mui-focused fieldset': { borderColor: 'primary.main', borderWidth: 1.5 },
                  },
                  '& input::placeholder': { fontSize: '0.75rem', opacity: 0.6 },
                }}
              />
              {filters.port && (() => {
                // Resolve number for the filtered port from any gateway
                const matchedGw = selectedGatewayId
                  ? gateways.find((g) => g._id === selectedGatewayId)
                  : gateways.find((g) => g.portNumbers?.[filters.port]);
                const num = matchedGw?.portNumbers?.[filters.port] || portNumbers[matchedGw?._id]?.[filters.port] || '';
                return num ? (
                  <Chip
                    label={num}
                    size="small"
                    color="info"
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.68rem', borderRadius: 5, maxWidth: 140 }}
                  />
                ) : null;
              })()}
            </Box>

            <DatePicker value={filters.dateFrom}
              onChange={(v) => handleFilterChange('dateFrom', v)}
              slotProps={{
                textField: {
                  size: 'small', placeholder: 'From',
                  sx: {
                    width: 140,
                    '& .MuiOutlinedInput-root': {
                      height: 28, borderRadius: 6, fontSize: '0.78rem', bgcolor: 'background.paper',
                      boxShadow: (t) => `0 1px 2px ${alpha(t.palette.grey[400], 0.15)}`,
                      '& fieldset': { border: '1px solid', borderColor: (t) => alpha(t.palette.grey[300], 0.7) },
                      '&:hover fieldset': { borderColor: (t) => alpha(t.palette.primary.main, 0.3) },
                      '&.Mui-focused fieldset': { borderColor: 'primary.main', borderWidth: 1.5 },
                    },
                    '& input': { fontSize: '0.78rem', py: 0 },
                    '& input::placeholder': { fontSize: '0.75rem', opacity: 0.6 },
                    '& .MuiInputLabel-root': { display: 'none' },
                  },
                },
              }} />
            <DatePicker value={filters.dateTo}
              onChange={(v) => handleFilterChange('dateTo', v)}
              slotProps={{
                textField: {
                  size: 'small', placeholder: 'To',
                  sx: {
                    width: 140,
                    '& .MuiOutlinedInput-root': {
                      height: 28, borderRadius: 6, fontSize: '0.78rem', bgcolor: 'background.paper',
                      boxShadow: (t) => `0 1px 2px ${alpha(t.palette.grey[400], 0.15)}`,
                      '& fieldset': { border: '1px solid', borderColor: (t) => alpha(t.palette.grey[300], 0.7) },
                      '&:hover fieldset': { borderColor: (t) => alpha(t.palette.primary.main, 0.3) },
                      '&.Mui-focused fieldset': { borderColor: 'primary.main', borderWidth: 1.5 },
                    },
                    '& input': { fontSize: '0.78rem', py: 0 },
                    '& input::placeholder': { fontSize: '0.75rem', opacity: 0.6 },
                    '& .MuiInputLabel-root': { display: 'none' },
                  },
                },
              }} />

            {hasActiveFilters && (
              <Button size="small" onClick={clearFilters} sx={{ fontSize: '0.7rem', minWidth: 0, px: 1, height: 28 }}>
                Clear
              </Button>
            )}
          </Box>

          {/* SMS Table */}
          <TableContainer sx={{ flex: 1, overflow: 'auto', px: 1.5, pt: 0.5 }}>
            <Table size="small" stickyHeader sx={{
              borderCollapse: 'separate',
              borderSpacing: '0 4px',
              '& .MuiTableHead-root .MuiTableCell-head': {
                bgcolor: 'background.default', border: 'none', fontWeight: 700,
                fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: 0.5,
                color: 'text.secondary', py: 0.5, px: 1.5,
              },
            }}>
              <TableHead>
                <TableRow>
                  {[
                    { id: 'timestamp', label: 'Time' },
                    { id: 'sender', label: 'From' },
                    { id: 'recipient', label: 'To (Number)' },
                    { id: null, label: 'Content' },
                    { id: null, label: 'Gateway' },
                    { id: 'port', label: 'Port', width: 60 },
                  ].map((col) => (
                    <TableCell
                      key={col.label}
                      sx={{
                        ...(col.width ? { width: col.width } : {}),
                        ...(col.id ? { cursor: 'pointer', userSelect: 'none', '&:hover': { color: 'primary.main' } } : {}),
                      }}
                      onClick={col.id ? () => handleSort(col.id) : undefined}
                    >
                      <Box display="flex" alignItems="center" gap={0.25}>
                        {col.label}
                        {col.id && sortBy === col.id && (
                          sortDir === 'asc'
                            ? <ArrowUpIcon sx={{ fontSize: 12 }} />
                            : <ArrowDownIcon sx={{ fontSize: 12 }} />
                        )}
                      </Box>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {smsLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 6, border: 'none' }}>
                      <CircularProgress size={28} />
                    </TableCell>
                  </TableRow>
                ) : smsMessages.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 6, border: 'none' }}>
                      <Typography variant="body2" color="text.secondary">No messages found</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  smsMessages.map((sms) => {
                    const gwId = sms.gatewayDevice?._id || sms.gatewayDevice;
                    const gwData = gateways.find((g) => g._id === gwId);
                    const gwPortNums = gwData?.portNumbers || {};
                    const fetchedPortNums = portNumbers[gwId] || {};
                    const portKey = sms.port || '';
                    const portNumber = gwPortNums[portKey] || fetchedPortNums[portKey] || '';
                    const receivingNumber = sms.recipient || portNumber || sms.simCard?.simNumber || '';

                    return (
                      <TableRow
                        key={sms._id}
                        onClick={() => setSelectedSms(sms)}
                        sx={{
                          cursor: 'pointer',
                          bgcolor: 'background.paper',
                          boxShadow: (t) => `0 1px 3px ${alpha(t.palette.grey[400], 0.12)}`,
                          transition: 'all 0.15s ease',
                          '&:hover': { boxShadow: (t) => `0 2px 6px ${alpha(t.palette.primary.main, 0.12)}`, bgcolor: (t) => alpha(t.palette.primary.main, 0.03) },
                          '& td': { border: '1px solid', borderColor: (t) => alpha(t.palette.grey[200], 0.8), borderLeft: 'none', borderRight: 'none' },
                          '& td:first-of-type': { borderRadius: '20px 0 0 20px', borderLeft: '1px solid', borderLeftColor: (t) => alpha(t.palette.grey[200], 0.8) },
                          '& td:last-of-type': { borderRadius: '0 20px 20px 0', borderRight: '1px solid', borderRightColor: (t) => alpha(t.palette.grey[200], 0.8) },
                        }}
                      >
                        <TableCell sx={{ py: 0.75, px: 1.5, fontSize: '0.78rem', whiteSpace: 'nowrap', color: 'text.secondary' }}>
                          {formatTs(sms.timestamp)}
                        </TableCell>
                        <TableCell sx={{ py: 0.75, px: 1.5, fontSize: '0.78rem', fontWeight: 500 }}>
                          {sms.sender || '-'}
                        </TableCell>
                        <TableCell sx={{ py: 0.75, px: 1.5, fontSize: '0.78rem', color: 'text.secondary' }}>
                          {receivingNumber || '-'}
                        </TableCell>
                        <TableCell sx={{ py: 0.75, px: 1.5, fontSize: '0.78rem', maxWidth: 350, color: 'text.secondary' }}>
                          {truncate(sms.content)}
                        </TableCell>
                        <TableCell sx={{ py: 0.75, px: 1.5, fontSize: '0.75rem', color: 'text.secondary' }}>
                          {sms.gatewayDevice?.name || '-'}
                        </TableCell>
                        <TableCell sx={{ py: 0.75, px: 1.5, fontSize: '0.75rem', fontFamily: 'monospace', color: 'text.disabled' }}>
                          {sms.port || '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={totalCount}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[25, 50, 100]}
            sx={{
              borderTop: '1px solid', borderColor: 'divider', borderBottom: 'none', flexShrink: 0,
              '& .MuiTablePagination-toolbar': { minHeight: 32, pl: 0 },
              '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': { fontSize: '0.72rem' },
              '& .MuiTablePagination-select': { fontSize: '0.72rem' },
              '& .MuiTablePagination-actions button': { p: 0.25 },
            }}
          />
        </Box>

        {/* ── Dialogs ── */}
        <GatewayDialog
          open={gatewayDialogOpen}
          onClose={() => { setGatewayDialogOpen(false); setEditingGateway(null); }}
          gateway={editingGateway}
          onSave={handleSaveGateway}
        />

        <SMSContentDialog
          open={!!selectedSms}
          onClose={() => setSelectedSms(null)}
          sms={selectedSms}
        />

      </Box>
    </LocalizationProvider>
  );
};

export default SMSGatewayPage;
