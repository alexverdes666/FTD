import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  Phone as PhoneIcon,
  AttachMoney as MoneyIcon,
  FiberNew as NewIcon,
  HourglassEmpty as HourglassIcon,
  CheckCircle as CheckCircleIcon,
  Search as SearchIcon,
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

const CallBonusesSection = ({
  leads: passedLeads = [],
  initialTab = 0,
  externalSearch = '',
  externalMonth = '',
  hideFilters = false,
}) => {
  const user = useSelector(selectUser);
  const isAgent = user?.role === 'agent';
  const isManager = ['admin', 'affiliate_manager'].includes(user?.role);

  const [tabValue, setTabValue] = useState(initialTab);
  const [agentTab, setAgentTab] = useState(0);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');

  // Use external values when provided (from parent header), fallback to internal
  const effectiveSearch = hideFilters ? externalSearch : searchFilter;

  // CDR calls data (all calls with declaration status)
  const [cdrCalls, setCdrCalls] = useState([]);

  // Declarations data
  const [myDeclarations, setMyDeclarations] = useState([]);

  // Pending declarations for managers
  const [pendingDeclarations, setPendingDeclarations] = useState([]);

  // Monthly totals
  const [monthlyTotals, setMonthlyTotals] = useState(null);

  // Selected month filter
  const [selectedMonth, setSelectedMonth] = useState(() => {
    if (externalMonth) return externalMonth;
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Sync with external month when provided
  useEffect(() => {
    if (externalMonth && hideFilters) setSelectedMonth(externalMonth);
  }, [externalMonth, hideFilters]);

  // Sync tab with initialTab changes
  useEffect(() => {
    setTabValue(initialTab);
  }, [initialTab]);

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

  const queryClient = useQueryClient();
  const [year, month] = useMemo(() => selectedMonth.split('-'), [selectedMonth]);

  // React Query: CDR calls (agents only)
  const { data: cdrData, isLoading: cdrLoading, error: cdrQueryError } = useQuery({
    queryKey: ['callBonuses', 'cdrCalls'],
    queryFn: () => fetchCDRCalls(3),
    enabled: isAgent,
    refetchInterval: 30000,
  });
  useEffect(() => {
    if (cdrData) setCdrCalls(cdrData.calls || []);
  }, [cdrData]);
  const cdrError = cdrQueryError?.response?.data?.message || cdrQueryError?.message || null;

  // React Query: declarations
  const { data: declarationsData, isLoading: declarationsLoading, error: declQueryError } = useQuery({
    queryKey: ['callBonuses', 'declarations', year, month],
    queryFn: () => getDeclarations({ year, month }),
    refetchInterval: 30000,
  });
  useEffect(() => {
    if (declarationsData) setMyDeclarations(declarationsData || []);
  }, [declarationsData]);
  const declarationsError = declQueryError?.response?.data?.message || declQueryError?.message || null;

  // React Query: pending declarations (managers only)
  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ['callBonuses', 'pendingDeclarations'],
    queryFn: getPendingDeclarations,
    enabled: isManager,
    refetchInterval: 30000,
  });
  useEffect(() => {
    if (pendingData) setPendingDeclarations(pendingData || []);
  }, [pendingData]);

  // React Query: monthly totals (agents only)
  useQuery({
    queryKey: ['callBonuses', 'monthlyTotals', user?._id || user?.id, year, month],
    queryFn: () => getMonthlyTotals(user._id || user.id, parseInt(year), parseInt(month)),
    enabled: isAgent,
    refetchInterval: 30000,
    onSuccess: (data) => setMonthlyTotals(data),
  });

  // Refetch helpers for backward compat
  const loadCDRCalls = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['callBonuses', 'cdrCalls'] });
  }, [queryClient]);
  const loadDeclarations = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['callBonuses', 'declarations'] });
  }, [queryClient]);
  const loadPendingDeclarations = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['callBonuses', 'pendingDeclarations'] });
  }, [queryClient]);
  const loadMonthlyTotals = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['callBonuses', 'monthlyTotals'] });
  }, [queryClient]);

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

      {/* Agent View - Tabbed Categories */}
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

            {/* Tabs */}
            <Paper sx={{ mb: 2 }}>
              <Tabs
                value={agentTab}
                onChange={(e, newValue) => setAgentTab(newValue)}
                variant="fullWidth"
              >
                <Tab
                  icon={<NewIcon />}
                  iconPosition="start"
                  label={
                    <Box display="flex" alignItems="center" gap={1}>
                      New
                      <Chip label={cdrLoading ? '...' : newCalls.length} size="small" color="primary" />
                    </Box>
                  }
                />
                <Tab
                  icon={<HourglassIcon />}
                  iconPosition="start"
                  label={
                    <Box display="flex" alignItems="center" gap={1}>
                      Pending
                      <Chip label={cdrLoading ? '...' : pendingCalls.length} size="small" color="warning" />
                    </Box>
                  }
                />
                <Tab
                  icon={<CheckCircleIcon />}
                  iconPosition="start"
                  label={
                    <Box display="flex" alignItems="center" gap={1}>
                      Completed
                      <Chip label={cdrLoading ? '...' : completedCalls.length} size="small" color="success" />
                    </Box>
                  }
                />
              </Tabs>
            </Paper>

            {/* Tab Content */}
            {agentTab === 0 && (
              <UndeclaredCallsTable
                calls={newCalls}
                loading={cdrLoading}
                error={cdrError}
                onDeclare={setSelectedCallForDeclaration}
                emptyMessage="No new calls to declare."
              />
            )}
            {agentTab === 1 && (
              <UndeclaredCallsTable
                calls={pendingCalls}
                loading={cdrLoading}
                error={null}
                onDeclare={setSelectedCallForDeclaration}
                emptyMessage="No pending declarations."
              />
            )}
            {agentTab === 2 && (
              <UndeclaredCallsTable
                calls={completedCalls}
                loading={cdrLoading}
                error={null}
                onDeclare={setSelectedCallForDeclaration}
                emptyMessage="No completed declarations."
              />
            )}
          </Box>
        );
      })()}

      {/* Tabs + Filters inline - Only for managers, hidden when controlled from parent */}
      {isManager && !hideFilters && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
          <Tabs
            value={tabValue}
            onChange={(e, newValue) => setTabValue(newValue)}
            sx={{
              minHeight: 36,
              '& .MuiTab-root': { minHeight: 36, py: 0.5, fontSize: '0.8rem', textTransform: 'none' },
            }}
          >
            <Tab label="All Declarations" />
            <Tab
              label={
                <Badge badgeContent={pendingDeclarations.length} color="error" sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', height: 16, minWidth: 16 } }}>
                  Pending Approvals
                </Badge>
              }
            />
          </Tabs>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              size="small"
              placeholder="Search..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                width: 160,
                '& .MuiOutlinedInput-root': { borderRadius: 5, fontSize: '0.75rem', height: 28 },
              }}
            />
            <FormControl size="small" sx={{
              minWidth: 140,
              '& .MuiOutlinedInput-root': { borderRadius: 5, fontSize: '0.75rem', height: 28 },
            }}>
              <InputLabel sx={{ fontSize: '0.75rem' }}>Month</InputLabel>
              <Select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                label="Month"
              >
                {getMonthOptions().map((option) => (
                  <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Box>
      )}

      {/* Manager View - All Declarations Tab */}
      {isManager && tabValue === 0 && (
        <Box>
          <CallDeclarationsTable
            declarations={effectiveSearch
              ? myDeclarations.filter(d => {
                  const q = effectiveSearch.toLowerCase();
                  return (
                    (d.agent?.fullName || '').toLowerCase().includes(q) ||
                    (d.affiliateManager?.fullName || '').toLowerCase().includes(q) ||
                    (d.orderId?._id || d.orderId || '').toString().toLowerCase().includes(q) ||
                    (`${d.lead?.firstName || ''} ${d.lead?.lastName || ''}`.toLowerCase()).includes(q) ||
                    (d.lineNumber || d.lead?.newPhone || '').toLowerCase().includes(q) ||
                    (d.callType || '').toLowerCase().includes(q) ||
                    (d.callCategory || '').toLowerCase().includes(q) ||
                    (d.status || '').toLowerCase().includes(q)
                  );
                })
              : myDeclarations}
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
          <CallDeclarationsTable
            declarations={effectiveSearch
              ? pendingDeclarations.filter(d => {
                  const q = effectiveSearch.toLowerCase();
                  return (
                    (d.agent?.fullName || '').toLowerCase().includes(q) ||
                    (d.affiliateManager?.fullName || '').toLowerCase().includes(q) ||
                    (d.orderId?._id || d.orderId || '').toString().toLowerCase().includes(q) ||
                    (`${d.lead?.firstName || ''} ${d.lead?.lastName || ''}`.toLowerCase()).includes(q) ||
                    (d.lineNumber || d.lead?.newPhone || '').toLowerCase().includes(q) ||
                    (d.callType || '').toLowerCase().includes(q) ||
                    (d.callCategory || '').toLowerCase().includes(q) ||
                    (d.status || '').toLowerCase().includes(q)
                  );
                })
              : pendingDeclarations}
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
        canApprove={isManager}
      />
    </Box>
  );
};

export default CallBonusesSection;
