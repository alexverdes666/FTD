import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Chip,
  InputAdornment,
  Tooltip,
  Grid,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Collapse,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Refresh as RefreshIcon,
  AttachMoney as MoneyIcon,
  People as PeopleIcon,
  Warning as WarningIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Gavel as GavelIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Assignment as AssignmentIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import {
  getAllAgentBonusConfigs,
  updateAgentBonusConfig,
} from '../services/payroll/calculations';
import {
  getAllAgentCallCounts,
  getAllAgentCallCountsMonthly,
  updateAgentCallCounts,
  getCallCountsStats,
} from '../services/agentCallCounts';
import {
  getAllAgentFines,
  getAgentFines,
  createAgentFine,
  resolveAgentFine,
  deleteAgentFine,
  respondToFine,
  adminDecideFine,
  getPendingApprovalFines,
  getDisputedFines,
} from '../services/agentFines';
import FineImageUpload from './FineImageUpload';
import FineDetailDialog from './FineDetailDialog';
import { getGlobalBonusRates } from '../services/systemConfiguration';
import { selectUser } from '../store/slices/authSlice';
import api from '../services/api';
import BonusRatesManagement from './BonusRatesManagement';
import MonthYearSelector from './common/MonthYearSelector';
import dayjs from 'dayjs';

const AdminBonusManagement = () => {
  const theme = useTheme();
  const user = useSelector(selectUser);
  const [tabValue, setTabValue] = useState(0);

  // Call counts state
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingAgent, setEditingAgent] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [callCountsStats, setCallCountsStats] = useState(null);
  const [globalBonusRates, setGlobalBonusRates] = useState({
    firstCall: 5.0,
    secondCall: 10.0,
    thirdCall: 15.0,
    fourthCall: 20.0,
    fifthCall: 25.0,
    verifiedAcc: 50.0,
  });

  // Fines state
  const [fines, setFines] = useState([]);
  const [finesLoading, setFinesLoading] = useState(true);
  const [selectedAgentFines, setSelectedAgentFines] = useState([]);
  const [viewingFinesFor, setViewingFinesFor] = useState(null);
  const [showFineForm, setShowFineForm] = useState(false);
  const [fineFormData, setFineFormData] = useState({
    agentId: '',
    amount: '',
    reason: '',
    description: '',
    notes: ''
  });
  const [fineImages, setFineImages] = useState([]); // Images for new fine
  const [fineDate, setFineDate] = useState(dayjs()); // For month/year selection
  const [finesFilterDate, setFinesFilterDate] = useState(dayjs()); // For filtering fines display
  const [processingFine, setProcessingFine] = useState(false);
  const [pendingApprovalFines, setPendingApprovalFines] = useState([]);
  const [disputedFines, setDisputedFines] = useState([]);
  const [selectedFineDetail, setSelectedFineDetail] = useState(null);
  const [showFineDetailDialog, setShowFineDetailDialog] = useState(false);



  // General state
  const [alert, setAlert] = useState({ show: false, message: '', severity: 'info' });

  useEffect(() => {
    loadAgents();
    loadCallCountsStats();
    loadGlobalBonusRates();
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    loadFines();
  }, [finesFilterDate]);

  const showAlert = (message, severity = 'info') => {
    setAlert({ show: true, message, severity });
    setTimeout(() => setAlert({ show: false, message: '', severity: 'info' }), 5000);
  };

  const loadAgents = async () => {
    try {
      setLoading(true);
      const response = await getAllAgentCallCounts(selectedYear, selectedMonth);
      let agentsData = response.data;
      
      // If user is an agent, filter to show only their own data
      if (user && user.role === 'agent') {
        agentsData = agentsData.filter(agent => agent.agent._id === user._id);
      }
      
      setAgents(agentsData);
    } catch (error) {
      console.error('Failed to load agents:', error);
      showAlert('Failed to load agents data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadCallCountsStats = async () => {
    try {
      const response = await getCallCountsStats();
      setCallCountsStats(response.data);
    } catch (error) {
      console.error('Failed to load call counts stats:', error);
    }
  };

  const loadGlobalBonusRates = async () => {
    try {
      const response = await getGlobalBonusRates();
      if (response.data && response.data.bonusRates) {
        setGlobalBonusRates(response.data.bonusRates);
      }
    } catch (error) {
      console.error('Failed to load global bonus rates:', error);
      // Keep default rates if loading fails
    }
  };

  const loadFines = async () => {
    try {
      setFinesLoading(true);

      if (user && user.role === 'agent') {
        // For agents, load their month-specific fines and pending approval fines
        const year = finesFilterDate.year();
        const month = finesFilterDate.month() + 1;
        const [finesData, pendingData] = await Promise.all([
          getAgentFines(user._id, true, year, month),
          getPendingApprovalFines(),
        ]);
        setFines(finesData);
        setPendingApprovalFines(pendingData);
      } else {
        // For admins/affiliate managers, load all fines
        const finesData = await getAllAgentFines();
        setFines(finesData);

        // Load pending approval fines
        try {
          const pendingData = await getPendingApprovalFines();
          setPendingApprovalFines(pendingData);
        } catch (e) {
          console.error('Failed to load pending fines:', e);
        }

        // Admin also loads disputed fines
        if (user && user.role === 'admin') {
          try {
            const disputedData = await getDisputedFines();
            setDisputedFines(disputedData);
          } catch (e) {
            console.error('Failed to load disputed fines:', e);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load fines:', error);
      showAlert('Failed to load fines data', 'error');
    } finally {
      setFinesLoading(false);
    }
  };

  const handleRefresh = async () => {
    await Promise.all([loadAgents(), loadFines(), loadCallCountsStats(), loadGlobalBonusRates()]);
    showAlert('Data refreshed successfully', 'success');
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  // Call counts management functions
  const handleEditAgent = (agent) => {
    setEditingAgent(agent.agent._id);
    setEditValues({
      firstCalls: agent.callCounts?.firstCalls || 0,
      secondCalls: agent.callCounts?.secondCalls || 0,
      thirdCalls: agent.callCounts?.thirdCalls || 0,
      fourthCalls: agent.callCounts?.fourthCalls || 0,
      fifthCalls: agent.callCounts?.fifthCalls || 0,
      verifiedAccounts: agent.callCounts?.verifiedAccounts || 0,
    });
  };

  const handleCancelEdit = () => {
    setEditingAgent(null);
    setEditValues({});
  };

  const handleSaveAgent = async (agent) => {
    try {
      setSaving(true);
      await updateAgentCallCounts(agent.agent._id, editValues, '', selectedYear, selectedMonth);
      await loadAgents();
      setEditingAgent(null);
      setEditValues({});
      showAlert(`Monthly call bonuses updated successfully for ${agent.agent.fullName}`, 'success');
    } catch (error) {
      console.error('Failed to save call counts:', error);
      showAlert('Failed to save monthly call bonuses', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleValueChange = (field, value) => {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < 0) return;
    setEditValues(prev => ({
      ...prev,
      [field]: numValue
    }));
  };

  // Fines management functions
  const handleViewAgentFines = async (agent) => {
    try {
      setViewingFinesFor(agent);
      const agentFines = await getAgentFines(agent.agent._id, true);
      setSelectedAgentFines(agentFines);
    } catch (error) {
      console.error('Failed to load agent fines:', error);
      showAlert('Failed to load agent fines', 'error');
    }
  };

  const handleCloseFinesView = () => {
    setViewingFinesFor(null);
    setSelectedAgentFines([]);
  };

  const handleOpenFineForm = (agent = null) => {
    setFineFormData({
      agentId: agent ? agent.agent._id : '',
      amount: '',
      reason: '',
      description: '',
      notes: ''
    });
    setShowFineForm(true);
  };

  const handleCloseFineForm = () => {
    setShowFineForm(false);
    setFineFormData({
      agentId: '',
      amount: '',
      reason: '',
      description: '',
      notes: ''
    });
    setFineImages([]); // Reset images
    setFineDate(dayjs()); // Reset to current month/year
  };

  const handleCreateFine = async () => {
    try {
      setProcessingFine(true);

      if (!fineFormData.agentId || !fineFormData.amount || !fineFormData.reason) {
        showAlert('Please fill in all required fields', 'error');
        return;
      }

      await createAgentFine(fineFormData.agentId, {
        amount: parseFloat(fineFormData.amount),
        reason: fineFormData.reason,
        description: fineFormData.description,
        notes: fineFormData.notes,
        fineMonth: fineDate.month() + 1,
        fineYear: fineDate.year(),
        images: fineImages.map(img => img._id), // Include image IDs
      });

      await loadFines();
      handleCloseFineForm();
      showAlert('Fine created successfully. Awaiting agent approval.', 'success');
    } catch (error) {
      console.error('Failed to create fine:', error);
      showAlert('Failed to create fine', 'error');
    } finally {
      setProcessingFine(false);
    }
  };

  const handleResolveFine = async (fineId, status) => {
    try {
      setProcessingFine(true);
      await resolveAgentFine(fineId, status, '');
      await loadFines();
      showAlert(`Fine marked as ${status}`, 'success');
    } catch (error) {
      console.error('Failed to resolve fine:', error);
      showAlert('Failed to resolve fine', 'error');
    } finally {
      setProcessingFine(false);
    }
  };

  const handleDeleteFine = async (fineId) => {
    if (!window.confirm('Are you sure you want to delete this fine?')) return;

    try {
      setProcessingFine(true);
      await deleteAgentFine(fineId);
      await loadFines();
      showAlert('Fine deleted successfully', 'success');
    } catch (error) {
      console.error('Failed to delete fine:', error);
      showAlert('Failed to delete fine', 'error');
    } finally {
      setProcessingFine(false);
    }
  };

  // Utility functions
  const formatCurrency = (value) => `$${Number(value).toFixed(2)}`;
  const calculateTotalCalls = (callCounts) => {
    if (!callCounts) return 0;
    return Object.values(callCounts).reduce((sum, count) => sum + count, 0);
  };
  
  const calculateBonusFromCalls = (callCounts, bonusRates = null) => {
    if (!callCounts) return 0;
    const rates = bonusRates || globalBonusRates;
    return (callCounts.firstCalls || 0) * (rates.firstCall || 5) +
           (callCounts.secondCalls || 0) * (rates.secondCall || 10) +
           (callCounts.thirdCalls || 0) * (rates.thirdCall || 15) +
           (callCounts.fourthCalls || 0) * (rates.fourthCall || 20) +
           (callCounts.fifthCalls || 0) * (rates.fifthCall || 25) +
           (callCounts.verifiedAccounts || 0) * (rates.verifiedAcc || 50);
  };

  // Role-based access control
  const canEditCallCounts = () => {
    return user && (user.role === 'admin' || user.role === 'affiliate_manager');
  };

  const canManageFines = () => {
    return user && (user.role === 'admin' || user.role === 'affiliate_manager');
  };

  const canViewAllAgents = () => {
    return user && (user.role === 'admin' || user.role === 'affiliate_manager');
  };

  const isAgent = () => {
    return user && user.role === 'agent';
  };

  const getFilteredFines = () => {
    if (user && user.role === 'agent') {
      // For agents, fines are already filtered by month when loaded
      return fines;
    } else {
      // For admins/affiliate managers, filter by selected month/year
      const filterYear = finesFilterDate.year();
      const filterMonth = finesFilterDate.month() + 1;
      return fines.filter(fine => 
        fine.fineYear === filterYear && fine.fineMonth === filterMonth
      );
    }
  };

  const getAgentTotalFines = (agentId) => {
    const filteredFines = getFilteredFines();
    // Only count approved and admin_approved fines as active deductions
    return filteredFines
      .filter(fine => fine.agent._id === agentId && ['approved', 'admin_approved'].includes(fine.status))
      .reduce((sum, fine) => sum + fine.amount, 0);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending_approval': return 'warning';
      case 'approved': return 'success';
      case 'disputed': return 'error';
      case 'admin_approved': return 'success';
      case 'admin_rejected': return 'default';
      case 'paid': return 'info';
      case 'waived': return 'secondary';
      case 'active': return 'error'; // Legacy support
      default: return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending_approval': return 'Pending Approval';
      case 'approved': return 'Approved';
      case 'disputed': return 'Disputed';
      case 'admin_approved': return 'Admin Approved';
      case 'admin_rejected': return 'Admin Rejected';
      case 'paid': return 'Paid';
      case 'waived': return 'Waived';
      case 'active': return 'Active'; // Legacy support
      default: return status;
    }
  };

  const handleViewFineDetail = (fine) => {
    setSelectedFineDetail(fine);
    setShowFineDetailDialog(true);
  };

  const handleFineUpdated = (updatedFine) => {
    // Refresh fines list
    loadFines();
  };

  if (loading || finesLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {alert.show && (
        <Alert severity={alert.severity} sx={{ mb: 2 }}>
          {alert.message}
        </Alert>
      )}

      {/* Header */}
      <Card sx={{ mb: 3 }}>
        <CardHeader
          title={
            <Box display="flex" alignItems="center" gap={1}>
              <PeopleIcon />
              <Typography variant="h5" fontWeight="bold">
                {isAgent() ? 'My Performance' : 'Agent Management'}
              </Typography>
            </Box>
          }
          action={
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={handleRefresh}
              disabled={loading || finesLoading}
            >
              Refresh
            </Button>
          }
        />
        <CardContent>
                      <Typography variant="body2" color="text.secondary">
            {isAgent() 
              ? 'View your monthly call counts bonuses and fines. Monthly bonuses are calculated automatically based on fixed rates per call.'
              : 'Manage agent monthly call counts bonuses and fines. Affiliate managers can input monthly call counts for agents, and the system will automatically calculate monthly bonuses based on fixed rates per call.'
            }
          </Typography>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label={isAgent() ? "My Monthly Call Bonuses" : "Monthly Call Bonuses"} icon={<MoneyIcon />} />
          <Tab label="Fines" icon={<WarningIcon />} />
          {user && user.role === 'admin' && (
            <Tab label="Global Bonus Rates" icon={<SettingsIcon />} />
          )}
        </Tabs>
      </Paper>

      {/* Call Counts Tab */}
      {tabValue === 0 && (
        <Card>
          <CardHeader
            title={
                          <Box display="flex" alignItems="center" gap={1}>
              <MoneyIcon />
              <Typography variant="h6">
                {isAgent() ? 'My Monthly Call Bonuses' : 'Agent Monthly Call Bonuses'}
              </Typography>
              {!isAgent() && (
                <Chip
                  label={`${agents.length} Agents`}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              )}
            </Box>
            }
            action={
              <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
                <FormControl size="small" sx={{ minWidth: 80 }}>
                  <InputLabel>Year</InputLabel>
                  <Select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    label="Year"
                  >
                    {Array.from({ length: 5 }, (_, i) => {
                      const year = new Date().getFullYear() - 2 + i;
                      return (
                        <MenuItem key={year} value={year}>
                          {year}
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 100 }}>
                  <InputLabel>Month</InputLabel>
                  <Select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    label="Month"
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <MenuItem key={i + 1} value={i + 1}>
                        {new Date(0, i).toLocaleString('default', { month: 'long' })}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            }
          />
          <CardContent>
            {/* Bonus Rates Info */}
            <Box sx={{ mb: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Current Monthly Bonus Rates (per call):
              </Typography>
              <Grid container spacing={1}>
                <Grid item xs={2}>
                  <Typography variant="caption">1st Call: ${globalBonusRates.firstCall}</Typography>
                </Grid>
                <Grid item xs={2}>
                  <Typography variant="caption">2nd Call: ${globalBonusRates.secondCall}</Typography>
                </Grid>
                <Grid item xs={2}>
                  <Typography variant="caption">3rd Call: ${globalBonusRates.thirdCall}</Typography>
                </Grid>
                <Grid item xs={2}>
                  <Typography variant="caption">4th Call: ${globalBonusRates.fourthCall}</Typography>
                </Grid>
                <Grid item xs={2}>
                  <Typography variant="caption">5th Call: ${globalBonusRates.fifthCall}</Typography>
                </Grid>
                <Grid item xs={2}>
                  <Typography variant="caption">Verified Acc: ${globalBonusRates.verifiedAcc}</Typography>
                </Grid>
              </Grid>
            </Box>

            {!canEditCallCounts() && (
              <Alert severity="info" sx={{ mb: 2 }}>
                {isAgent() 
                  ? 'This is a read-only view of your monthly call bonuses and calculated bonuses.'
                  : 'Only affiliate managers and admins can edit monthly call bonuses.'
                }
              </Alert>
            )}

            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <Typography variant="subtitle2" fontWeight="bold">
                        Agent
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="subtitle2" fontWeight="bold">
                        1st Calls
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="subtitle2" fontWeight="bold">
                        2nd Calls
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="subtitle2" fontWeight="bold">
                        3rd Calls
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="subtitle2" fontWeight="bold">
                        4th Calls
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="subtitle2" fontWeight="bold">
                        5th Calls
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="subtitle2" fontWeight="bold">
                        Verified Acc
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="subtitle2" fontWeight="bold">
                        Total Calls
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="subtitle2" fontWeight="bold">
                        Monthly Bonus
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="subtitle2" fontWeight="bold">
                        Actions
                      </Typography>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {agents.map((agent) => {
                    const isEditing = editingAgent === agent.agent._id;
                    const displayValues = isEditing ? editValues : (agent.callCounts || {
                      firstCalls: 0,
                      secondCalls: 0,
                      thirdCalls: 0,
                      fourthCalls: 0,
                      fifthCalls: 0,
                      verifiedAccounts: 0,
                    });

                    const defaultBonusRates = globalBonusRates;

                    return (
                      <TableRow
                        key={agent.agent._id}
                        sx={{
                          '&:nth-of-type(odd)': {
                            backgroundColor: theme.palette.action.hover,
                          },
                          '&:hover': {
                            backgroundColor: theme.palette.action.selected,
                          },
                        }}
                      >
                        <TableCell>
                          <Box>
                            <Typography variant="body2" fontWeight="bold">
                              {agent.agent.fullName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {agent.agent.email}
                            </Typography>
                          </Box>
                        </TableCell>

                        {/* Call count fields */}
                        {['firstCalls', 'secondCalls', 'thirdCalls', 'fourthCalls', 'fifthCalls', 'verifiedAccounts'].map((field) => (
                          <TableCell key={field} align="center">
                            {isEditing ? (
                              <TextField
                                size="small"
                                type="number"
                                value={displayValues[field] || 0}
                                onChange={(e) => handleValueChange(field, e.target.value)}
                                inputProps={{ min: 0, step: 1 }}
                                sx={{ width: 80 }}
                              />
                            ) : (
                              <Typography variant="body2" fontWeight="bold" color="primary.main">
                                {displayValues[field] || 0}
                              </Typography>
                            )}
                          </TableCell>
                        ))}

                        {/* Total Calls */}
                        <TableCell align="center">
                          <Typography variant="body2" fontWeight="bold" color="info.main">
                            {calculateTotalCalls(displayValues)}
                          </Typography>
                        </TableCell>

                        {/* Estimated Bonus */}
                        <TableCell align="center">
                          <Typography variant="body2" fontWeight="bold" color="success.main">
                            {formatCurrency(calculateBonusFromCalls(displayValues, defaultBonusRates))}
                          </Typography>
                        </TableCell>

                        {/* Actions */}
                        <TableCell align="center">
                          <Box display="flex" gap={1} justifyContent="center">
                            {isEditing ? (
                              <>
                                <Tooltip title="Save Changes">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleSaveAgent(agent)}
                                    color="success"
                                    disabled={saving}
                                  >
                                    <SaveIcon />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Cancel">
                                  <IconButton
                                    size="small"
                                    onClick={handleCancelEdit}
                                    color="error"
                                    disabled={saving}
                                  >
                                    <CancelIcon />
                                  </IconButton>
                                </Tooltip>
                              </>
                            ) : (
                              canEditCallCounts() && (
                                <Tooltip title="Edit Monthly Call Bonuses">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleEditAgent(agent)}
                                    color="primary"
                                  >
                                    <EditIcon />
                                  </IconButton>
                                </Tooltip>
                              )
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Fines Tab */}
      {tabValue === 1 && (
        <Card>
          <CardHeader
            title={
              <Box display="flex" alignItems="center" gap={1}>
                <WarningIcon />
                <Typography variant="h6">
                  {isAgent() ? 'My Fines' : 'Agent Fines'}
                </Typography>
                <Chip
                  label={`${getFilteredFines().length} ${isAgent() ? 'Fines' : 'Fines for ' + finesFilterDate.format('MMMM YYYY')}`}
                  size="small"
                  color="error"
                  variant="outlined"
                />
              </Box>
            }
            action={
              canManageFines() && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => handleOpenFineForm()}
                  color="error"
                >
                  Add Fine
                </Button>
              )
            }
          />
          <CardContent>
            {/* Month/Year Filter for Fines */}
            <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle2" gutterBottom>
                Filter Fines by Month & Year
              </Typography>
              <MonthYearSelector
                selectedDate={finesFilterDate}
                onDateChange={setFinesFilterDate}
                showCurrentSelection={true}
                size="small"
              />
            </Box>

            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <Typography variant="subtitle2" fontWeight="bold">
                        Agent
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="subtitle2" fontWeight="bold">
                        Active Fines
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="subtitle2" fontWeight="bold">
                        Total Fines
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="subtitle2" fontWeight="bold">
                        Actions
                      </Typography>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {agents.map((agent) => {
                    const filteredFines = getFilteredFines();
                    const activeFines = getAgentTotalFines(agent.agent._id);
                    const totalFines = filteredFines
                      .filter(fine => fine.agent._id === agent.agent._id)
                      .reduce((sum, fine) => sum + fine.amount, 0);
                    const fineCount = filteredFines.filter(fine => fine.agent._id === agent.agent._id).length;

                    return (
                      <TableRow
                        key={agent.agent._id}
                        sx={{
                          '&:nth-of-type(odd)': {
                            backgroundColor: theme.palette.action.hover,
                          },
                          '&:hover': {
                            backgroundColor: theme.palette.action.selected,
                          },
                        }}
                      >
                        <TableCell>
                          <Box>
                            <Typography variant="body2" fontWeight="bold">
                              {agent.agent.fullName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {agent.agent.email}
                            </Typography>
                          </Box>
                        </TableCell>

                        <TableCell align="center">
                          <Typography
                            variant="body2"
                            fontWeight="bold"
                            color={activeFines > 0 ? 'error.main' : 'success.main'}
                          >
                            {formatCurrency(activeFines)}
                          </Typography>
                        </TableCell>

                        <TableCell align="center">
                          <Typography variant="body2" fontWeight="bold">
                            {formatCurrency(totalFines)}
                          </Typography>
                        </TableCell>

                        <TableCell align="center">
                          <Box display="flex" gap={1} justifyContent="center">
                            <Tooltip title="View Fines">
                              <IconButton
                                size="small"
                                onClick={() => handleViewAgentFines(agent)}
                                color="primary"
                              >
                                <ViewIcon />
                              </IconButton>
                            </Tooltip>
                            {canManageFines() && (
                              <Tooltip title="Add Fine">
                                <IconButton
                                  size="small"
                                  onClick={() => handleOpenFineForm(agent)}
                                  color="error"
                                >
                                  <AddIcon />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Pending Approval Fines Section - For Agents */}
            {isAgent() && pendingApprovalFines.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <WarningIcon color="warning" />
                  Fines Awaiting Your Approval ({pendingApprovalFines.length})
                </Typography>
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Please review and respond to the fines below. You can approve or dispute each fine.
                </Alert>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Amount</TableCell>
                        <TableCell>Reason</TableCell>
                        <TableCell>Period</TableCell>
                        <TableCell>Imposed By</TableCell>
                        <TableCell>Images</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pendingApprovalFines.map((fine) => (
                        <TableRow key={fine._id}>
                          <TableCell>
                            <Typography fontWeight="bold" color="error.main">
                              {formatCurrency(fine.amount)}
                            </Typography>
                          </TableCell>
                          <TableCell>{fine.reason}</TableCell>
                          <TableCell>
                            {fine.fineMonth && fine.fineYear
                              ? `${String(fine.fineMonth).padStart(2, '0')}/${fine.fineYear}`
                              : 'N/A'}
                          </TableCell>
                          <TableCell>{fine.imposedBy?.fullName || 'N/A'}</TableCell>
                          <TableCell>
                            {fine.images?.length > 0 ? (
                              <Chip label={`${fine.images.length} image(s)`} size="small" variant="outlined" />
                            ) : 'None'}
                          </TableCell>
                          <TableCell align="center">
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => handleViewFineDetail(fine)}
                            >
                              Review
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}

            {/* Disputed Fines Section - For Admin */}
            {user?.role === 'admin' && disputedFines.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <GavelIcon color="error" />
                  Disputed Fines Awaiting Admin Decision ({disputedFines.length})
                </Typography>
                <Alert severity="error" sx={{ mb: 2 }}>
                  The following fines have been disputed by agents and require your decision.
                </Alert>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Agent</TableCell>
                        <TableCell>Amount</TableCell>
                        <TableCell>Reason</TableCell>
                        <TableCell>Dispute Reason</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {disputedFines.map((fine) => (
                        <TableRow key={fine._id}>
                          <TableCell>{fine.agent?.fullName || 'N/A'}</TableCell>
                          <TableCell>
                            <Typography fontWeight="bold" color="error.main">
                              {formatCurrency(fine.amount)}
                            </Typography>
                          </TableCell>
                          <TableCell>{fine.reason}</TableCell>
                          <TableCell>
                            <Typography variant="body2" color="warning.main">
                              {fine.agentResponse?.disputeReason || 'No reason provided'}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Button
                              size="small"
                              variant="contained"
                              color="warning"
                              onClick={() => handleViewFineDetail(fine)}
                            >
                              Review & Decide
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Global Bonus Rates Tab */}
      {tabValue === 2 && user && user.role === 'admin' && (
        <BonusRatesManagement />
      )}

      {/* Create Fine Dialog */}
      <Dialog open={showFineForm} onClose={handleCloseFineForm} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <GavelIcon />
            <Typography>Create New Fine</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Agent</InputLabel>
                <Select
                  value={fineFormData.agentId}
                  onChange={(e) => setFineFormData(prev => ({ ...prev, agentId: e.target.value }))}
                  label="Agent"
                >
                  {agents.map((agent) => (
                    <MenuItem key={agent.agent._id} value={agent.agent._id}>
                      {agent.agent.fullName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Fine Amount"
                type="number"
                value={fineFormData.amount}
                onChange={(e) => setFineFormData(prev => ({ ...prev, amount: e.target.value }))}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
                inputProps={{ min: 0, step: 0.01 }}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Fine Month & Year
              </Typography>
              <MonthYearSelector
                selectedDate={fineDate}
                onDateChange={setFineDate}
                showCurrentSelection={false}
                size="small"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Reason"
                value={fineFormData.reason}
                onChange={(e) => setFineFormData(prev => ({ ...prev, reason: e.target.value }))}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={3}
                value={fineFormData.description}
                onChange={(e) => setFineFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                multiline
                rows={2}
                value={fineFormData.notes}
                onChange={(e) => setFineFormData(prev => ({ ...prev, notes: e.target.value }))}
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
                disabled={processingFine}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseFineForm} startIcon={<CancelIcon />}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateFine}
            variant="contained"
            startIcon={<SaveIcon />}
            disabled={processingFine}
            color="error"
          >
            {processingFine ? 'Creating...' : 'Create Fine'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Agent Fines Dialog */}
      <Dialog
        open={!!viewingFinesFor}
        onClose={handleCloseFinesView}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <WarningIcon />
            <Typography>
              Fines for {viewingFinesFor?.agent.fullName}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedAgentFines.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 2 }}>
              No fines found for this agent.
            </Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Amount</TableCell>
                    <TableCell>Reason</TableCell>
                    <TableCell>Month/Year</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedAgentFines.map((fine) => (
                    <TableRow key={fine._id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {formatCurrency(fine.amount)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {fine.reason}
                        </Typography>
                        {fine.description && (
                          <Typography variant="caption" color="text.secondary">
                            {fine.description}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {fine.fineMonth && fine.fineYear 
                            ? `${String(fine.fineMonth).padStart(2, '0')}/${fine.fineYear}`
                            : 'N/A'
                          }
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getStatusLabel(fine.status)}
                          color={getStatusColor(fine.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">
                          {new Date(fine.imposedDate).toLocaleDateString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" gap={1}>
                          <Tooltip title="View Details">
                            <IconButton
                              size="small"
                              onClick={() => {
                                handleCloseFinesView();
                                handleViewFineDetail(fine);
                              }}
                              color="primary"
                            >
                              <ViewIcon />
                            </IconButton>
                          </Tooltip>
                          {/* Only show resolve buttons for approved/admin_approved fines */}
                          {['approved', 'admin_approved'].includes(fine.status) && user?.role === 'admin' && (
                            <>
                              <Tooltip title="Mark as Paid">
                                <IconButton
                                  size="small"
                                  onClick={() => handleResolveFine(fine._id, 'paid')}
                                  color="success"
                                  disabled={processingFine}
                                >
                                  <CheckIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Waive Fine">
                                <IconButton
                                  size="small"
                                  onClick={() => handleResolveFine(fine._id, 'waived')}
                                  color="info"
                                  disabled={processingFine}
                                >
                                  <CloseIcon />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                          {user?.role === 'admin' && (
                            <Tooltip title="Delete Fine">
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteFine(fine._id)}
                                color="error"
                                disabled={processingFine}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseFinesView}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Fine Detail Dialog */}
      <FineDetailDialog
        open={showFineDetailDialog}
        onClose={() => {
          setShowFineDetailDialog(false);
          setSelectedFineDetail(null);
        }}
        fine={selectedFineDetail}
        onFineUpdated={handleFineUpdated}
      />

    </Box>
  );
};

export default AdminBonusManagement;