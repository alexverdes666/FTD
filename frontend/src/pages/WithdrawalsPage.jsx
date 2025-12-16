import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  useTheme,
  TextField,
  ButtonGroup,
} from '@mui/material';
import {
  AccountBalanceWallet as WalletIcon,
  Visibility as ViewIcon,
  Edit as ProcessIcon,
  Refresh as RefreshIcon,
  AttachMoney as MoneyIcon,
  Person as PersonIcon,
  Schedule as PendingIcon,
  CheckCircle as ApprovedIcon,
  Cancel as RejectedIcon,
  Paid as CompletedIcon,
  DateRange as DateRangeIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { selectUser } from '../store/slices/authSlice';
import {
  getAllWithdrawals,
  getWithdrawalStats,
  getWithdrawalStatusColor,
  getWithdrawalStatusText,
  getDateRangePresets
} from '../services/withdrawals';
import ProcessWithdrawalModal from '../components/ProcessWithdrawalModal';

const WithdrawalsPage = () => {
  const theme = useTheme();
  const user = useSelector(selectUser);
  const [withdrawals, setWithdrawals] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [processModalOpen, setProcessModalOpen] = useState(false);
  const [alert, setAlert] = useState({ show: false, message: '', severity: 'info' });

  const dateRangePresets = getDateRangePresets();

  useEffect(() => {
    if (user && user.role === 'admin') {
      loadWithdrawals();
      loadStats();
    }
  }, [user, statusFilter, dateFilter, customStartDate, customEndDate]);

  const getDateRangeParams = () => {
    if (dateFilter === 'all') {
      return {};
    }
    
    if (dateFilter === 'custom') {
      const params = {};
      if (customStartDate) {
        params.startDate = customStartDate;
      }
      if (customEndDate) {
        params.endDate = customEndDate;
      }
      return params;
    }
    
    const preset = dateRangePresets[dateFilter];
    if (preset) {
      return {
        startDate: preset.startDate,
        endDate: preset.endDate
      };
    }
    
    return {};
  };

  const loadWithdrawals = async () => {
    try {
      setLoading(true);
      const params = {};
      
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      
      // Add date filtering
      const dateParams = getDateRangeParams();
      Object.assign(params, dateParams);
      
      const response = await getAllWithdrawals(params);
      setWithdrawals(response.data);
    } catch (error) {
      console.error('Failed to load withdrawals:', error);
      showAlert('Failed to load withdrawal requests', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const dateParams = getDateRangeParams();
      const response = await getWithdrawalStats(dateParams);
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load withdrawal stats:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadWithdrawals(), loadStats()]);
    setRefreshing(false);
    showAlert('Data refreshed successfully', 'success');
  };

  const handleProcessWithdrawal = (withdrawal) => {
    setSelectedWithdrawal(withdrawal);
    setProcessModalOpen(true);
  };

  const handleDateFilterChange = (newDateFilter) => {
    setDateFilter(newDateFilter);
    if (newDateFilter !== 'custom') {
      setCustomStartDate('');
      setCustomEndDate('');
    }
  };

  const handleClearDateFilter = () => {
    setDateFilter('all');
    setCustomStartDate('');
    setCustomEndDate('');
  };

  const showAlert = (message, severity = 'info') => {
    setAlert({ show: true, message, severity });
    setTimeout(() => setAlert({ show: false, message: '', severity: 'info' }), 5000);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatWithdrawalMonth = (month, year) => {
    if (!month || !year) return 'N/A';
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[month - 1]} ${year}`;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <PendingIcon color="warning" />;
      case 'approved':
        return <ApprovedIcon color="info" />;
      case 'completed':
        return <CompletedIcon color="success" />;
      case 'rejected':
        return <RejectedIcon color="error" />;
      default:
        return <PendingIcon />;
    }
  };

  const getDateRangeLabel = () => {
    if (dateFilter === 'all') return 'All Time';
    if (dateFilter === 'custom') {
      if (customStartDate || customEndDate) {
        const start = customStartDate || 'Start';
        const end = customEndDate || 'End';
        return `${start} to ${end}`;
      }
      return 'Custom Range';
    }
    return dateRangePresets[dateFilter]?.label || 'Unknown';
  };

  if (!user || user.role !== 'admin') {
    return (
      <Alert severity="error">
        Access denied. Admin role required to view withdrawal requests.
      </Alert>
    );
  }

  return (
    <Box sx={{ width: '100%', typography: 'body1' }}>
      {/* Alert */}
      {alert.show && (
        <Alert severity={alert.severity} sx={{ mb: 2 }}>
          {alert.message}
        </Alert>
      )}

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Withdrawal Management
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </Box>

      {/* Stats Cards */}
      {stats && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="center">
                    <PendingIcon sx={{ mr: 2, color: 'warning.main' }} />
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="warning.main">
                        {stats.pending}
                      </Typography>
                      <Typography color="textSecondary">
                        Pending
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {formatCurrency(stats.pendingAmount)}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="center">
                    <CompletedIcon sx={{ mr: 2, color: 'success.main' }} />
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="success.main">
                        {stats.completed}
                      </Typography>
                      <Typography color="textSecondary">
                        Completed
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {formatCurrency(stats.completedAmount)}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="center">
                    <MoneyIcon sx={{ mr: 2, color: 'primary.main' }} />
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="primary.main">
                        {formatCurrency(stats.totalAmount)}
                      </Typography>
                      <Typography color="textSecondary">
                        Total Amount
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {getDateRangeLabel()}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
            >
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="center">
                    <PersonIcon sx={{ mr: 2, color: 'info.main' }} />
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="info.main">
                        {stats.total}
                      </Typography>
                      <Typography color="textSecondary">
                        Total Requests
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {getDateRangeLabel()}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>
        </Grid>
      )}

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack spacing={3}>
            <Stack
              direction="row"
              spacing={2}
              alignItems="center"
              justifyContent="center"
              flexWrap="wrap"
            >
              <FormControl variant="outlined" size="small" sx={{ minWidth: 150 }}>
                <InputLabel id="status-filter-label">Status Filter</InputLabel>
                <Select
                  labelId="status-filter-label"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  label="Status Filter"
                >
                  <MenuItem value="all">All Statuses</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="approved">Approved</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="rejected">Rejected</MenuItem>
                </Select>
              </FormControl>

              <FormControl variant="outlined" size="small" sx={{ minWidth: 150 }}>
                <InputLabel id="date-filter-label">Date Filter</InputLabel>
                <Select
                  labelId="date-filter-label"
                  value={dateFilter}
                  onChange={(e) => handleDateFilterChange(e.target.value)}
                  label="Date Filter"
                >
                  <MenuItem value="all">All Time</MenuItem>
                  <MenuItem value="today">Today</MenuItem>
                  <MenuItem value="yesterday">Yesterday</MenuItem>
                  <MenuItem value="thisWeek">This Week</MenuItem>
                  <MenuItem value="thisMonth">This Month</MenuItem>
                  <MenuItem value="thisQuarter">This Quarter</MenuItem>
                  <MenuItem value="thisYear">This Year</MenuItem>
                  <MenuItem value="custom">Custom Range</MenuItem>
                </Select>
              </FormControl>

              {(dateFilter !== 'all' || customStartDate || customEndDate) && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<ClearIcon />}
                  onClick={handleClearDateFilter}
                >
                  Clear Date Filter
                </Button>
              )}
            </Stack>

            {/* Custom Date Range Inputs */}
            {dateFilter === 'custom' && (
              <Stack direction="row" spacing={2} alignItems="center" justifyContent="center">
                <TextField
                  label="Start Date"
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  size="small"
                />
                <TextField
                  label="End Date"
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  size="small"
                />
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Withdrawals Table */}
      <Card>
        <CardHeader
          title="Withdrawal Requests"
          subheader={`${withdrawals.length} requests found`}
          sx={{ textAlign: 'center' }}
          action={
            <Stack direction="row" spacing={1} justifyContent="center">
              <Chip
                icon={<WalletIcon />}
                label={`Status: ${statusFilter === 'all' ? 'All' : getWithdrawalStatusText(statusFilter)}`}
                color="primary"
                variant="outlined"
              />
              <Chip
                icon={<DateRangeIcon />}
                label={`Period: ${getDateRangeLabel()}`}
                color="secondary"
                variant="outlined"
              />
            </Stack>
          }
        />
        <CardContent>
          {loading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell align="center">Agent</TableCell>
                    <TableCell align="center">Amount</TableCell>
                    <TableCell align="center">For Month</TableCell>
                    <TableCell align="center">Wallet Address</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="center">Request Date</TableCell>
                    <TableCell align="center">Processed Date</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {withdrawals.map((withdrawal) => (
                    <TableRow
                      key={withdrawal._id}
                      sx={{
                        '&:hover': {
                          backgroundColor: theme.palette.action.hover
                        }
                      }}
                    >
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <Typography variant="body2" fontWeight="medium">
                            {withdrawal.agent?.fullName}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'success.light' }}>
                            {withdrawal.agent?.email}
                          </Typography>
                          {withdrawal.agent?.fourDigitCode && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              Code: {withdrawal.agent.fourDigitCode}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <Typography variant="body2" fontWeight="medium">
                            {formatCurrency(withdrawal.amount)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Base: {formatCurrency(withdrawal.breakdown?.basePay || 0)} |
                            Bonus: {formatCurrency(withdrawal.breakdown?.bonuses || 0)}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={formatWithdrawalMonth(withdrawal.withdrawalMonth, withdrawal.withdrawalYear)}
                          color="info"
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          {/* New format: separate ERC20 and TRC20 wallets */}
                          {withdrawal.usdtErc20Wallet || withdrawal.usdtTrc20Wallet ? (
                            <>
                              {withdrawal.usdtErc20Wallet && (
                                <Box mb={0.5} sx={{ textAlign: 'center' }}>
                                  <Typography variant="caption" color="text.secondary" fontWeight="bold">
                                    ERC20:
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      maxWidth: 200,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    {withdrawal.usdtErc20Wallet}
                                  </Typography>
                                </Box>
                              )}
                              {withdrawal.usdtTrc20Wallet && (
                                <Box sx={{ textAlign: 'center' }}>
                                  <Typography variant="caption" color="text.secondary" fontWeight="bold">
                                    TRC20:
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      maxWidth: 200,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    {withdrawal.usdtTrc20Wallet}
                                  </Typography>
                                </Box>
                              )}
                            </>
                          ) : withdrawal.walletAddresses && withdrawal.walletAddresses.length > 0 ? (
                            /* Old format: array of wallet addresses */
                            withdrawal.walletAddresses.map((addr, idx) => (
                              <Typography
                                key={idx}
                                variant="body2"
                                sx={{
                                  maxWidth: 200,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {withdrawal.walletAddresses.length > 1 && `${idx + 1}. `}{addr}
                              </Typography>
                            ))
                          ) : (
                            <Typography
                              variant="body2"
                              sx={{
                                maxWidth: 200,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {withdrawal.walletAddress || 'N/A'}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          icon={getStatusIcon(withdrawal.status)}
                          label={getWithdrawalStatusText(withdrawal.status)}
                          color={getWithdrawalStatusColor(withdrawal.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2">
                          {formatDate(withdrawal.createdAt)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        {withdrawal.processedAt ? (
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <Typography variant="body2">
                              {formatDate(withdrawal.processedAt)}
                            </Typography>
                            {withdrawal.processedBy && (
                              <Typography variant="caption" color="text.secondary">
                                by {withdrawal.processedBy.fullName}
                              </Typography>
                            )}
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Not processed
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={1} justifyContent="center">
                          <Tooltip title="Process Withdrawal">
                            <IconButton
                              size="small"
                              onClick={() => handleProcessWithdrawal(withdrawal)}
                              disabled={withdrawal.status !== 'pending'}
                            >
                              <ProcessIcon />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                  {withdrawals.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">
                          No withdrawal requests found for the selected filters
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Process Withdrawal Modal */}
      <ProcessWithdrawalModal
        open={processModalOpen}
        onClose={() => setProcessModalOpen(false)}
        withdrawal={selectedWithdrawal}
        onProcessed={handleRefresh}
      />
    </Box>
  );
};

export default WithdrawalsPage; 