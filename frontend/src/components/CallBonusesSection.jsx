import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Grid,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Badge,
  Chip,
} from '@mui/material';
import {
  Phone as PhoneIcon,
  AttachMoney as MoneyIcon,
  Pending as PendingIcon,
  FiberNew as NewIcon,
  HourglassEmpty as HourglassIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { selectUser } from '../store/slices/authSlice';
import UndeclaredCallsTable from './UndeclaredCallsTable';
import CallDeclarationDialog from './CallDeclarationDialog';
import CallDeclarationsTable from './CallDeclarationsTable';
import CallDeclarationApprovalDialog from './CallDeclarationApprovalDialog';
import {
  fetchCDRCalls,
  getDeclarations,
  getPendingDeclarations,
  getMonthlyTotals,
} from '../services/callDeclarations';

const CallBonusesSection = ({ leads: passedLeads = [] }) => {
  const user = useSelector(selectUser);
  const isAgent = user?.role === 'agent';
  const isManager = ['admin', 'affiliate_manager'].includes(user?.role);

  const [tabValue, setTabValue] = useState(0);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // CDR calls data (all calls with declaration status)
  const [cdrCalls, setCdrCalls] = useState([]);
  const [cdrLoading, setCdrLoading] = useState(false);
  const [cdrError, setCdrError] = useState(null);

  // Declarations data
  const [myDeclarations, setMyDeclarations] = useState([]);
  const [declarationsLoading, setDeclarationsLoading] = useState(false);
  const [declarationsError, setDeclarationsError] = useState(null);

  // Pending declarations for managers
  const [pendingDeclarations, setPendingDeclarations] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);

  // Monthly totals
  const [monthlyTotals, setMonthlyTotals] = useState(null);

  // Selected month filter
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Dialog states
  const [selectedCallForDeclaration, setSelectedCallForDeclaration] = useState(null);
  const [selectedDeclarationForApproval, setSelectedDeclarationForApproval] = useState(null);

  // Generate month options (last 12 months)
  const getMonthOptions = () => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleString('default', { month: 'long', year: 'numeric' });
      options.push({ value, label });
    }
    return options;
  };

  // Fetch CDR calls
  const loadCDRCalls = useCallback(async () => {
    if (!isAgent) return;

    setCdrLoading(true);
    setCdrError(null);
    try {
      const data = await fetchCDRCalls(3);
      setCdrCalls(data.calls || []);
    } catch (err) {
      setCdrError(err.response?.data?.message || 'Failed to load CDR calls');
    } finally {
      setCdrLoading(false);
    }
  }, [isAgent]);

  // Fetch declarations
  const loadDeclarations = useCallback(async () => {
    const [year, month] = selectedMonth.split('-');
    setDeclarationsLoading(true);
    setDeclarationsError(null);
    try {
      const data = await getDeclarations({
        year,
        month,
      });
      setMyDeclarations(data || []);
    } catch (err) {
      setDeclarationsError(err.response?.data?.message || 'Failed to load declarations');
    } finally {
      setDeclarationsLoading(false);
    }
  }, [selectedMonth]);

  // Fetch pending declarations for managers
  const loadPendingDeclarations = useCallback(async () => {
    if (!isManager) return;

    setPendingLoading(true);
    try {
      const data = await getPendingDeclarations();
      setPendingDeclarations(data || []);
    } catch (err) {
      console.error('Failed to load pending declarations:', err);
    } finally {
      setPendingLoading(false);
    }
  }, [isManager]);

  // Fetch monthly totals
  const loadMonthlyTotals = useCallback(async () => {
    if (!isAgent) return;

    const [year, month] = selectedMonth.split('-');
    try {
      const data = await getMonthlyTotals(user._id || user.id, parseInt(year), parseInt(month));
      setMonthlyTotals(data);
    } catch (err) {
      console.error('Failed to load monthly totals:', err);
    }
  }, [isAgent, selectedMonth, user]);

  // Initial load and auto-refresh
  useEffect(() => {
    const loadData = () => {
      if (isAgent) {
        loadCDRCalls();
        loadMonthlyTotals();
      }
      loadDeclarations();
      if (isManager) {
        loadPendingDeclarations();
      }
    };

    // Initial load
    loadData();

    // Auto-refresh every 30 seconds
    const intervalId = setInterval(loadData, 30000);

    return () => clearInterval(intervalId);
  }, [isAgent, isManager, loadCDRCalls, loadDeclarations, loadPendingDeclarations, loadMonthlyTotals]);

  // Handle declaration created
  const handleDeclarationCreated = (newDeclaration) => {
    setSuccessMessage('Declaration submitted successfully!');
    setSelectedCallForDeclaration(null);
    // Refresh data
    loadCDRCalls();
    loadDeclarations();
    loadMonthlyTotals();
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  // Handle declaration updated (approved/rejected)
  const handleDeclarationUpdated = (updatedDeclaration) => {
    setSuccessMessage(`Declaration ${updatedDeclaration.status === 'approved' ? 'approved' : 'rejected'} successfully!`);
    setSelectedDeclarationForApproval(null);
    // Refresh data
    loadDeclarations();
    loadPendingDeclarations();
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  // Format currency
  const formatCurrency = (value) => `$${Number(value || 0).toFixed(2)}`;

  return (
    <Box>
      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}

      {/* Agent View - 3 Category Sections */}
      {isAgent && (() => {
        const newCalls = cdrCalls.filter(c => !c.declarationStatus || c.declarationStatus === 'rejected');
        const pendingCalls = cdrCalls.filter(c => c.declarationStatus === 'pending');
        const completedCalls = cdrCalls.filter(c => c.declarationStatus === 'approved');

        return (
          <Box>
            {/* Monthly Bonus Summary */}
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                mb: 3,
                bgcolor: 'success.50',
                borderColor: 'success.main',
              }}
            >
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={4}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <MoneyIcon color="success" />
                    <Typography variant="subtitle1" fontWeight="bold">
                      Monthly Bonus
                    </Typography>
                  </Box>
                  <Typography variant="h4" color="success.main" fontWeight="bold">
                    {formatCurrency(monthlyTotals?.totals?.totalBonus)}
                  </Typography>
                </Grid>
                {monthlyTotals?.totals && (
                  <>
                    <Grid item xs={6} sm={2}>
                      <Typography variant="caption" color="text.secondary">Declarations</Typography>
                      <Typography variant="body1" fontWeight="medium">
                        {monthlyTotals.totals.declarationCount || 0}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} sm={2}>
                      <Typography variant="caption" color="text.secondary">Base Bonus</Typography>
                      <Typography variant="body1" fontWeight="medium">
                        {formatCurrency(monthlyTotals.totals.totalBaseBonus)}
                      </Typography>
                    </Grid>
                    {monthlyTotals.totals.totalHourlyBonus > 0 && (
                      <Grid item xs={6} sm={2}>
                        <Typography variant="caption" color="text.secondary">Hourly Bonus</Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {formatCurrency(monthlyTotals.totals.totalHourlyBonus)}
                        </Typography>
                      </Grid>
                    )}
                  </>
                )}
              </Grid>
            </Paper>

            {/* New Calls Section */}
            <Paper variant="outlined" sx={{ mb: 3 }}>
              <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <NewIcon color="primary" />
                <Typography variant="subtitle1" fontWeight="bold">
                  New
                </Typography>
                <Chip label={cdrLoading ? '...' : newCalls.length} size="small" color="primary" />
              </Box>
              <Divider />
              <UndeclaredCallsTable
                calls={newCalls}
                loading={cdrLoading}
                error={cdrError}
                onDeclare={setSelectedCallForDeclaration}
                emptyMessage="No new calls to declare."
              />
            </Paper>

            {/* Pending Calls Section */}
            <Paper variant="outlined" sx={{ mb: 3 }}>
              <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <HourglassIcon color="warning" />
                <Typography variant="subtitle1" fontWeight="bold">
                  Pending
                </Typography>
                <Chip label={cdrLoading ? '...' : pendingCalls.length} size="small" color="warning" />
              </Box>
              <Divider />
              <UndeclaredCallsTable
                calls={pendingCalls}
                loading={cdrLoading}
                error={null}
                onDeclare={setSelectedCallForDeclaration}
                emptyMessage="No pending declarations."
              />
            </Paper>

            {/* Completed Calls Section */}
            <Paper variant="outlined" sx={{ mb: 3 }}>
              <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircleIcon color="success" />
                <Typography variant="subtitle1" fontWeight="bold">
                  Completed
                </Typography>
                <Chip label={cdrLoading ? '...' : completedCalls.length} size="small" color="success" />
              </Box>
              <Divider />
              <UndeclaredCallsTable
                calls={completedCalls}
                loading={cdrLoading}
                error={null}
                onDeclare={setSelectedCallForDeclaration}
                emptyMessage="No completed declarations."
              />
            </Paper>
          </Box>
        );
      })()}

      {/* Manager Pending Queue Badge */}
      {isManager && pendingDeclarations.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Box display="flex" alignItems="center" gap={1}>
            <Badge badgeContent={pendingDeclarations.length} color="error">
              <PendingIcon />
            </Badge>
            <Typography>
              You have {pendingDeclarations.length} pending declaration{pendingDeclarations.length > 1 ? 's' : ''} to review
            </Typography>
          </Box>
        </Alert>
      )}

      {/* Tabs - Only for managers */}
      {isManager && (
        <Paper sx={{ mb: 2 }}>
          <Tabs
            value={tabValue}
            onChange={(e, newValue) => setTabValue(newValue)}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab
              label={
                <Box display="flex" alignItems="center" gap={1}>
                  All Declarations
                </Box>
              }
            />
            <Tab
              label={
                <Badge badgeContent={pendingDeclarations.length} color="error">
                  Pending Approvals
                </Badge>
              }
            />
          </Tabs>
        </Paper>
      )}

      {/* Month Filter - Only for managers */}
      {isManager && (
        <Box display="flex" justifyContent="flex-end" mb={2}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Month</InputLabel>
            <Select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              label="Month"
            >
              {getMonthOptions().map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      )}

      {/* Manager View - All Declarations Tab */}
      {isManager && tabValue === 0 && (
        <Box>
          <CallDeclarationsTable
            declarations={myDeclarations}
            loading={declarationsLoading}
            error={declarationsError}
            onViewDetails={setSelectedDeclarationForApproval}
            showAgent={true}
            emptyMessage="No declarations found for the selected month."
          />
        </Box>
      )}

      {/* Manager View - Pending Approvals Tab */}
      {isManager && tabValue === 1 && (
        <Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Declarations pending your review
          </Typography>
          <CallDeclarationsTable
            declarations={pendingDeclarations}
            loading={pendingLoading}
            onViewDetails={setSelectedDeclarationForApproval}
            showAgent={true}
            emptyMessage="No pending declarations to review."
          />
        </Box>
      )}

      {/* Declaration Dialog */}
      <CallDeclarationDialog
        open={!!selectedCallForDeclaration}
        onClose={() => setSelectedCallForDeclaration(null)}
        call={selectedCallForDeclaration}
        onDeclarationCreated={handleDeclarationCreated}
        leads={passedLeads}
      />

      {/* Approval Dialog */}
      <CallDeclarationApprovalDialog
        open={!!selectedDeclarationForApproval}
        onClose={() => setSelectedDeclarationForApproval(null)}
        declaration={selectedDeclarationForApproval}
        onDeclarationUpdated={handleDeclarationUpdated}
      />
    </Box>
  );
};

export default CallBonusesSection;
