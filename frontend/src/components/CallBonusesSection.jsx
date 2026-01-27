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
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Badge,
} from '@mui/material';
import {
  Phone as PhoneIcon,
  AttachMoney as MoneyIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
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

const CallBonusesSection = () => {
  const user = useSelector(selectUser);
  const isAgent = user?.role === 'agent';
  const isManager = ['admin', 'affiliate_manager'].includes(user?.role);

  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // CDR calls data
  const [undeclaredCalls, setUndeclaredCalls] = useState([]);
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
      setUndeclaredCalls(data.calls || []);
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

  // Initial load
  useEffect(() => {
    if (isAgent) {
      loadCDRCalls();
    }
    loadDeclarations();
    if (isManager) {
      loadPendingDeclarations();
    }
    if (isAgent) {
      loadMonthlyTotals();
    }
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

  // Handle refresh
  const handleRefresh = () => {
    if (isAgent) {
      loadCDRCalls();
      loadMonthlyTotals();
    }
    loadDeclarations();
    if (isManager) {
      loadPendingDeclarations();
    }
  };

  // Format currency
  const formatCurrency = (value) => `$${Number(value || 0).toFixed(2)}`;

  // Get summary stats
  const getDeclarationStats = () => {
    const pending = myDeclarations.filter(d => d.status === 'pending').length;
    const approved = myDeclarations.filter(d => d.status === 'approved').length;
    const rejected = myDeclarations.filter(d => d.status === 'rejected').length;
    return { pending, approved, rejected };
  };

  const stats = getDeclarationStats();

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box display="flex" alignItems="center" gap={1}>
          <PhoneIcon color="primary" />
          <Typography variant="h6">Call Bonuses</Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<RefreshIcon />}
          onClick={handleRefresh}
          disabled={loading || cdrLoading || declarationsLoading}
        >
          Refresh
        </Button>
      </Box>

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

      {/* Agent View - Two Column Layout */}
      {isAgent && (
        <Grid container spacing={3}>
          {/* Left Column - Undeclared Calls Table */}
          <Grid item xs={12} md={8}>
            <UndeclaredCallsTable
              calls={undeclaredCalls}
              loading={cdrLoading}
              error={cdrError}
              onDeclare={setSelectedCallForDeclaration}
              emptyMessage="No undeclared calls found. All your long calls have been declared."
            />
          </Grid>

          {/* Right Column - Summary */}
          <Grid item xs={12} md={4}>
            {/* Status Summary */}
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle1" gutterBottom display="flex" alignItems="center" gap={1}>
                <PhoneIcon color="primary" />
                Declaration Status
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Box textAlign="center">
                    <Typography variant="caption" color="text.secondary">
                      Undeclared
                    </Typography>
                    <Typography variant="h5" color="primary.main">
                      {cdrLoading ? <CircularProgress size={20} /> : undeclaredCalls.length}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box textAlign="center">
                    <Typography variant="caption" color="text.secondary">
                      Pending
                    </Typography>
                    <Typography variant="h5" color="warning.main">
                      {stats.pending}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box textAlign="center">
                    <Typography variant="caption" color="text.secondary">
                      Approved
                    </Typography>
                    <Typography variant="h5" color="success.main">
                      {stats.approved}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box textAlign="center">
                    <Typography variant="caption" color="text.secondary">
                      Rejected
                    </Typography>
                    <Typography variant="h5" color="error.main">
                      {stats.rejected}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Paper>

            {/* Monthly Bonus Summary */}
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                bgcolor: 'success.50',
                borderColor: 'success.main',
              }}
            >
              <Typography variant="subtitle1" gutterBottom display="flex" alignItems="center" gap={1}>
                <MoneyIcon color="success" />
                Monthly Bonus
              </Typography>
              <Divider sx={{ mb: 2 }} />

              {/* Total Bonus - Prominent */}
              <Box textAlign="center" mb={2}>
                <Typography variant="caption" color="text.secondary">
                  Total Approved Bonus
                </Typography>
                <Typography variant="h3" color="success.main" fontWeight="bold">
                  {formatCurrency(monthlyTotals?.totals?.totalBonus)}
                </Typography>
              </Box>

              {/* Breakdown */}
              {monthlyTotals?.totals && (
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Declarations
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {monthlyTotals.totals.declarationCount || 0}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Base Bonus
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {formatCurrency(monthlyTotals.totals.totalBaseBonus)}
                    </Typography>
                  </Grid>
                  {monthlyTotals.totals.totalHourlyBonus > 0 && (
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary">
                        Hourly Bonus (+1hr calls)
                      </Typography>
                      <Typography variant="body1" fontWeight="medium">
                        {formatCurrency(monthlyTotals.totals.totalHourlyBonus)}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              )}

              {/* Call Type Breakdown */}
              {monthlyTotals?.callTypeSummary && monthlyTotals.callTypeSummary.length > 0 && (
                <Box mt={2}>
                  <Divider sx={{ mb: 1 }} />
                  <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                    By Call Type
                  </Typography>
                  <Box display="flex" flexDirection="column" gap={0.5}>
                    {monthlyTotals.callTypeSummary.map((item) => (
                      <Box key={item._id} display="flex" justifyContent="space-between">
                        <Typography variant="body2">
                          {item._id.replace('_', ' ')} ({item.count})
                        </Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {formatCurrency(item.totalBonus)}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}

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
