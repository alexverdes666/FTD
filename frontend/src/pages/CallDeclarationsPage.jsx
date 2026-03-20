import React, { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Chip,
  Alert,
  FormControl,
  Select,
  MenuItem,
  Badge,
  LinearProgress,
  Divider,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Phone as PhoneIcon,
  FiberNew as NewIcon,
  HourglassEmpty as HourglassIcon,
  CheckCircle as CheckCircleIcon,
  AttachMoney as MoneyIcon,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { selectUser } from '../store/slices/authSlice';
import UndeclaredCallsTable from '../components/UndeclaredCallsTable';
import CallDeclarationsTable from '../components/CallDeclarationsTable';
import CallDeclarationDialog from '../components/CallDeclarationDialog';
import CallDeclarationApprovalDialog from '../components/CallDeclarationApprovalDialog';
import api from '../services/api';
import {
  fetchCDRCalls,
  getDeclarations,
  getPendingDeclarations,
  getMonthlyTotals,
  deleteDeclaration,
} from '../services/callDeclarations';

const CallDeclarationsPage = () => {
  const user = useSelector(selectUser);
  const isAgent = user?.role === 'agent';
  const isManager = ['admin', 'affiliate_manager'].includes(user?.role);
  const queryClient = useQueryClient();

  const [tabValue, setTabValue] = useState(0);
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [selectedCallForDeclaration, setSelectedCallForDeclaration] = useState(null);
  const [selectedDeclarationForApproval, setSelectedDeclarationForApproval] = useState(null);

  const [year, month] = useMemo(() => selectedMonth.split('-'), [selectedMonth]);

  // Generate month options (last 12 months)
  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleString('default', { month: 'short', year: 'numeric' });
      options.push({ value, label });
    }
    return options;
  }, []);

  // Fetch agent's leads for declaration dialog
  const { data: leadsData } = useQuery({
    queryKey: ['callDeclarations', 'agentLeads'],
    queryFn: async () => {
      const res = await api.get('/leads/assigned?limit=500');
      const leads = res.data?.data || [];
      // Flatten grouped leads for the dialog
      return leads.map(g => ({
        _id: g.leadId,
        firstName: g.leadInfo?.firstName,
        lastName: g.leadInfo?.lastName,
        newEmail: g.leadInfo?.newEmail,
        newPhone: g.leadInfo?.newPhone,
        leadType: g.leadInfo?.leadType,
        orderId: g.leadInfo?.orderId,
      })).filter(l => l._id);
    },
    enabled: isAgent,
    staleTime: 60000,
  });

  // CDR calls (agents only)
  const { data: cdrData, isLoading: cdrLoading, error: cdrError } = useQuery({
    queryKey: ['callBonuses', 'cdrCalls'],
    queryFn: () => fetchCDRCalls(3),
    enabled: isAgent,
    refetchInterval: 30000,
  });
  const cdrCalls = cdrData?.calls || [];

  // Declarations
  const { data: declarationsData, isLoading: declarationsLoading, error: declError } = useQuery({
    queryKey: ['callBonuses', 'declarations', year, month],
    queryFn: () => getDeclarations({ year, month }),
    refetchInterval: 30000,
  });
  const declarations = declarationsData || [];

  // Pending declarations (managers)
  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ['callBonuses', 'pendingDeclarations'],
    queryFn: getPendingDeclarations,
    enabled: isManager,
    refetchInterval: 30000,
  });
  const pendingDeclarations = pendingData || [];

  // Monthly totals (agents)
  const { data: monthlyTotals } = useQuery({
    queryKey: ['callBonuses', 'monthlyTotals', user?._id || user?.id, year, month],
    queryFn: () => getMonthlyTotals(user._id || user.id, parseInt(year), parseInt(month)),
    enabled: isAgent,
    refetchInterval: 30000,
  });

  // Split CDR calls by status
  const newCalls = useMemo(() => cdrCalls.filter(c => !c.declarationStatus || c.declarationStatus === 'rejected'), [cdrCalls]);
  const pendingCalls = useMemo(() => cdrCalls.filter(c => c.declarationStatus === 'pending'), [cdrCalls]);
  const completedCalls = useMemo(() => cdrCalls.filter(c => c.declarationStatus === 'approved'), [cdrCalls]);

  const refreshAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['callBonuses'] });
  }, [queryClient]);

  const handleDeclarationCreated = useCallback(() => {
    setSuccessMessage('Declaration submitted successfully!');
    setSelectedCallForDeclaration(null);
    refreshAll();
    setTimeout(() => setSuccessMessage(null), 4000);
  }, [refreshAll]);

  const handleDeclarationUpdated = useCallback((updated) => {
    setSuccessMessage(`Declaration ${updated.status === 'approved' ? 'approved' : 'rejected'} successfully!`);
    setSelectedDeclarationForApproval(null);
    refreshAll();
    setTimeout(() => setSuccessMessage(null), 4000);
  }, [refreshAll]);

  const handleDeleteDeclaration = useCallback(async (declaration) => {
    if (!window.confirm('Delete this pending declaration?')) return;
    try {
      await deleteDeclaration(declaration._id);
      setSuccessMessage('Declaration deleted.');
      refreshAll();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to delete declaration');
      setTimeout(() => setErrorMessage(null), 4000);
    }
  }, [refreshAll]);

  // Handle viewing details for a CDR call (pending/completed tabs)
  const handleViewCDRCallDetails = useCallback((call) => {
    if (!call.declarationId) return;
    // Find the declaration from the loaded declarations list
    const decl = declarations.find(d => d._id === call.declarationId);
    if (decl) {
      setSelectedDeclarationForApproval(decl);
    }
  }, [declarations]);

  const formatCurrency = (value) => `$${Number(value || 0).toFixed(2)}`;

  const isLoading = cdrLoading || declarationsLoading || pendingLoading;

  // Agent tabs: 0=New, 1=Pending, 2=Completed, 3=All Declarations
  // Manager tabs: 0=All Declarations, 1=Pending Approvals

  return (
    <Box sx={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {isLoading && (
        <LinearProgress sx={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 1, height: 2 }} />
      )}

      {/* Alerts */}
      {successMessage && (
        <Alert severity="success" sx={{ mx: 1, mt: 0.5, py: 0.25, fontSize: "0.78rem" }} onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}
      {errorMessage && (
        <Alert severity="error" sx={{ mx: 1, mt: 0.5, py: 0.25, fontSize: "0.78rem" }} onClose={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      )}

      {/* Top Bar */}
      <Box sx={{ display: "flex", flexDirection: "column", width: "100%", flex: 1, minHeight: 0, overflow: "hidden" }}>
        <Paper sx={{ width: "100%", position: "relative", borderRadius: 2, overflow: "hidden", border: 1, borderColor: "divider", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>

          {/* Compact Filter Bar */}
          <Box sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 1.5,
            py: 0.5,
            flexWrap: "wrap",
            background: (theme) => `linear-gradient(135deg, ${alpha(theme.palette.grey[100], 0.7)} 0%, ${alpha(theme.palette.grey[50], 0.5)} 100%)`,
            borderBottom: "1px solid",
            borderColor: (theme) => alpha(theme.palette.divider, 0.6),
            minHeight: 38,
          }}>
            <PhoneIcon sx={{ fontSize: 18, color: "primary.main" }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: "0.85rem", mr: 1 }}>
              Call Declarations
            </Typography>

            <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />

            {/* Month Selector */}
            <FormControl size="small" sx={{
              minWidth: 120,
              "& .MuiOutlinedInput-root": {
                height: 28, borderRadius: 6, fontSize: "0.75rem", bgcolor: "background.paper",
                "& fieldset": { borderColor: (theme) => alpha(theme.palette.grey[300], 0.7) },
              },
            }}>
              <Select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                sx={{ "& .MuiSelect-select": { py: 0, pl: 1, pr: "24px !important" } }}
              >
                {monthOptions.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: "0.78rem" }}>{opt.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Agent Monthly Summary - Compact Inline */}
            {isAgent && monthlyTotals?.totals && (
              <>
                <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <MoneyIcon sx={{ fontSize: 16, color: "success.main" }} />
                    <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: "success.main" }}>
                      {formatCurrency(monthlyTotals.totals.totalBonus)}
                    </Typography>
                  </Box>
                  <Chip
                    label={`${monthlyTotals.totals.declarationCount || 0} decl`}
                    size="small"
                    sx={{ height: 20, fontSize: "0.65rem" }}
                  />
                  <Typography sx={{ fontSize: "0.68rem", color: "text.secondary" }}>
                    Base: {formatCurrency(monthlyTotals.totals.totalBaseBonus)}
                    {monthlyTotals.totals.totalHourlyBonus > 0 && ` | Hourly: ${formatCurrency(monthlyTotals.totals.totalHourlyBonus)}`}
                  </Typography>
                </Box>
              </>
            )}

            {/* Manager pending badge */}
            {isManager && pendingDeclarations.length > 0 && (
              <>
                <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
                <Chip
                  label={`${pendingDeclarations.length} pending`}
                  size="small"
                  color="warning"
                  sx={{ height: 20, fontSize: "0.65rem" }}
                />
              </>
            )}
          </Box>

          {/* Tabs */}
          <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
            {isAgent ? (
              <Tabs
                value={tabValue}
                onChange={(_, v) => setTabValue(v)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                  minHeight: 32,
                  "& .MuiTab-root": { minHeight: 32, py: 0.5, fontSize: "0.75rem", textTransform: "none" },
                }}
              >
                <Tab icon={<NewIcon sx={{ fontSize: 16 }} />} iconPosition="start" label={
                  <Box display="flex" alignItems="center" gap={0.5}>
                    New <Chip label={newCalls.length} size="small" color="primary" sx={{ height: 18, fontSize: "0.62rem" }} />
                  </Box>
                } />
                <Tab icon={<HourglassIcon sx={{ fontSize: 16 }} />} iconPosition="start" label={
                  <Box display="flex" alignItems="center" gap={0.5}>
                    Pending <Chip label={pendingCalls.length} size="small" color="warning" sx={{ height: 18, fontSize: "0.62rem" }} />
                  </Box>
                } />
                <Tab icon={<CheckCircleIcon sx={{ fontSize: 16 }} />} iconPosition="start" label={
                  <Box display="flex" alignItems="center" gap={0.5}>
                    Completed <Chip label={completedCalls.length} size="small" color="success" sx={{ height: 18, fontSize: "0.62rem" }} />
                  </Box>
                } />
                <Tab label={
                  <Box display="flex" alignItems="center" gap={0.5}>
                    All Declarations <Chip label={declarations.length} size="small" sx={{ height: 18, fontSize: "0.62rem" }} />
                  </Box>
                } />
              </Tabs>
            ) : (
              <Tabs
                value={tabValue}
                onChange={(_, v) => setTabValue(v)}
                sx={{
                  minHeight: 32,
                  "& .MuiTab-root": { minHeight: 32, py: 0.5, fontSize: "0.75rem", textTransform: "none" },
                }}
              >
                <Tab label="All Declarations" />
                <Tab label={
                  <Badge badgeContent={pendingDeclarations.length} color="error" sx={{ "& .MuiBadge-badge": { fontSize: "0.6rem", height: 16, minWidth: 16 } }}>
                    Pending Approvals
                  </Badge>
                } />
              </Tabs>
            )}
          </Box>

          {/* Tab Content */}
          <Box sx={{ flex: 1, overflow: "auto", minHeight: 0 }}>
            {isAgent && tabValue === 0 && (
              <UndeclaredCallsTable
                calls={newCalls}
                loading={cdrLoading}
                error={cdrError?.response?.data?.message || cdrError?.message || null}
                onDeclare={setSelectedCallForDeclaration}
                emptyMessage="No new calls to declare."
              />
            )}
            {isAgent && tabValue === 1 && (
              <UndeclaredCallsTable
                calls={pendingCalls}
                loading={cdrLoading}
                onDeclare={setSelectedCallForDeclaration}
                onViewDetails={handleViewCDRCallDetails}
                emptyMessage="No pending declarations."
              />
            )}
            {isAgent && tabValue === 2 && (
              <UndeclaredCallsTable
                calls={completedCalls}
                loading={cdrLoading}
                onDeclare={setSelectedCallForDeclaration}
                onViewDetails={handleViewCDRCallDetails}
                emptyMessage="No completed declarations."
              />
            )}
            {isAgent && tabValue === 3 && (
              <CallDeclarationsTable
                declarations={declarations}
                loading={declarationsLoading}
                error={declError?.response?.data?.message || declError?.message || null}
                onViewDetails={setSelectedDeclarationForApproval}
                onDelete={handleDeleteDeclaration}
                emptyMessage="No declarations for the selected month."
              />
            )}

            {isManager && tabValue === 0 && (
              <CallDeclarationsTable
                declarations={declarations}
                loading={declarationsLoading}
                error={declError?.response?.data?.message || declError?.message || null}
                onViewDetails={setSelectedDeclarationForApproval}
                showAgent
                emptyMessage="No declarations for the selected month."
              />
            )}
            {isManager && tabValue === 1 && (
              <CallDeclarationsTable
                declarations={pendingDeclarations}
                loading={pendingLoading}
                onViewDetails={setSelectedDeclarationForApproval}
                showAgent
                emptyMessage="No pending declarations to review."
              />
            )}
          </Box>
        </Paper>
      </Box>

      {/* Declaration Dialog */}
      <CallDeclarationDialog
        open={!!selectedCallForDeclaration}
        onClose={() => setSelectedCallForDeclaration(null)}
        call={selectedCallForDeclaration}
        onDeclarationCreated={handleDeclarationCreated}
        leads={leadsData || []}
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

export default CallDeclarationsPage;
