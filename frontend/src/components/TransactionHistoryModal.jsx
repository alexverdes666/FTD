import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
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
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  InputAdornment,
  Collapse
} from '@mui/material';
import {
  Close,
  FilterList,
  Search,
  TrendingUp,
  TrendingDown,
  Link,
  Refresh,
  ExpandMore,
  ExpandLess,
  Download,
  AttachMoney,
  AccountBalanceWallet
} from '@mui/icons-material';
import { Switch, FormControlLabel } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import blockchainService from '../services/blockchain';
import MonthYearSelector from './common/MonthYearSelector';

const TransactionHistoryModal = ({ open, onClose, network }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 25
  });

  // Filter states
  const [filters, setFilters] = useState({
    startDate: null,
    endDate: null,
    blockchain: '',
    transferType: 'incoming',
    minAmount: '',
    maxAmount: '',
    tokenSymbol: '',
    searchHash: '',
    sortBy: 'timestamp',
    sortOrder: 'desc'
  });

  // Month filter state
  const [useMonthFilter, setUseMonthFilter] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(dayjs());

  // Statistics state
  const [stats, setStats] = useState({
    totalTransactions: 0,
    totalValue: 0,
    avgValue: 0,
    breakdown: {
      bitcoin: { count: 0, value: 0 },
      ethereum: { count: 0, value: 0 },
      tron: { count: 0, value: 0 }
    }
  });

  const fetchTransactions = useCallback(async (page = 1) => {
    if (!network?._id) return;

    setLoading(true);
    setError(null);

    try {
      let queryFilters = {
        ...filters,
        page,
        limit: pagination.limit
      };

      // Apply month filter if enabled
      if (useMonthFilter && selectedMonth) {
        const startOfMonth = selectedMonth.startOf('month').format('YYYY-MM-DD');
        const endOfMonth = selectedMonth.endOf('month').format('YYYY-MM-DD');
        queryFilters.startDate = startOfMonth;
        queryFilters.endDate = endOfMonth;
      } else {
        // Use existing date filters
        queryFilters.startDate = filters.startDate ? dayjs(filters.startDate).format('YYYY-MM-DD') : undefined;
        queryFilters.endDate = filters.endDate ? dayjs(filters.endDate).format('YYYY-MM-DD') : undefined;
      }

      const response = await blockchainService.getTransactionHistory(network._id, queryFilters);
      
      setTransactions(response.data.transactions || []);
      setPagination(response.data.pagination || {});
      
      // Calculate statistics
      const txs = response.data.transactions || [];
      const totalValue = txs.reduce((sum, tx) => sum + (parseFloat(tx.usdValue) || 0), 0);
      const avgValue = txs.length > 0 ? totalValue / txs.length : 0;
      
      const breakdown = txs.reduce((acc, tx) => {
        const blockchain = tx.blockchain;
        if (!acc[blockchain]) {
          acc[blockchain] = { count: 0, value: 0 };
        }
        acc[blockchain].count++;
        acc[blockchain].value += parseFloat(tx.usdValue) || 0;
        return acc;
      }, {});

      setStats({
        totalTransactions: txs.length,
        totalValue,
        avgValue,
        breakdown
      });

    } catch (err) {
      setError(err.message || 'Failed to fetch transaction history');
    } finally {
      setLoading(false);
    }
  }, [network, filters, pagination.limit]);

  useEffect(() => {
    if (open && network) {
      fetchTransactions();
    }
  }, [open, network, fetchTransactions]);

  // Auto-refresh when month filter changes
  useEffect(() => {
    if (open && network && useMonthFilter) {
      fetchTransactions(1);
    }
  }, [useMonthFilter, selectedMonth, open, network, fetchTransactions]);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleApplyFilters = () => {
    fetchTransactions(1);
  };

  const handleClearFilters = () => {
    setFilters({
      startDate: null,
      endDate: null,
      blockchain: '',
      transferType: 'incoming',
      minAmount: '',
      maxAmount: '',
      tokenSymbol: '',
      searchHash: '',
      sortBy: 'timestamp',
      sortOrder: 'desc'
    });
  };

  const handlePageChange = (event, newPage) => {
    fetchTransactions(newPage + 1);
  };

  const handleRowsPerPageChange = (event) => {
    setPagination(prev => ({
      ...prev,
      limit: parseInt(event.target.value, 10)
    }));
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value || 0);
  };

  const formatDate = (dateString) => {
    return dayjs(dateString).format('MMM DD, YYYY HH:mm');
  };

  const getBlockchainColor = (blockchain) => {
    switch (blockchain) {
      case 'bitcoin': return 'warning';
      case 'ethereum': return 'info';
      case 'tron': return 'error';
      default: return 'default';
    }
  };

  const getTransferTypeColor = (type) => {
    return type === 'incoming' ? 'success' : 'error';
  };

  const getTransferTypeIcon = (type) => {
    return type === 'incoming' ? <TrendingUp /> : <TrendingDown />;
  };

  const openTransactionInExplorer = (transaction) => {
    let url = '';
    switch (transaction.blockchain) {
      case 'bitcoin':
        url = `https://www.blockchain.com/btc/tx/${transaction.transactionHash}`;
        break;
      case 'ethereum':
        url = `https://etherscan.io/tx/${transaction.transactionHash}`;
        break;
      case 'tron':
        url = `https://tronscan.org/#/transaction/${transaction.transactionHash}`;
        break;
    }
    if (url) {
      window.open(url, '_blank');
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{
        style: { minHeight: '80vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <AccountBalanceWallet color="primary" />
            <Typography variant="h6">
              Transaction History - {network?.name}
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Tooltip title="Refresh">
              <span>
                <IconButton onClick={() => fetchTransactions()} disabled={loading}>
                  <Refresh />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Toggle Filters">
              <IconButton onClick={() => setShowFilters(!showFilters)}>
                <FilterList />
              </IconButton>
            </Tooltip>
            <IconButton onClick={onClose}>
              <Close />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mb: 3 }}>
          {/* Statistics Cards */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Total Transactions
                  </Typography>
                  <Typography variant="h5">
                    {stats.totalTransactions}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Total Value
                  </Typography>
                  <Typography variant="h5">
                    {formatCurrency(stats.totalValue)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Average Value
                  </Typography>
                  <Typography variant="h5">
                    {formatCurrency(stats.avgValue)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Blockchain Breakdown
                  </Typography>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    {Object.entries(stats.breakdown).map(([blockchain, data]) => (
                      data.count > 0 && (
                        <Chip
                          key={blockchain}
                          label={`${blockchain.toUpperCase()}: ${data.count}`}
                          color={getBlockchainColor(blockchain)}
                          size="small"
                        />
                      )
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Filters */}
          <Collapse in={showFilters}>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Filters
                </Typography>
                
                {/* Month Filter */}
                <Box sx={{ mb: 2, p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Typography variant="subtitle2">Quick Month Filter:</Typography>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={useMonthFilter}
                          onChange={(e) => setUseMonthFilter(e.target.checked)}
                        />
                      }
                      label="Filter by Month"
                    />
                  </Box>
                  
                  {useMonthFilter && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <MonthYearSelector
                        selectedDate={selectedMonth}
                        onDateChange={setSelectedMonth}
                        label="Select Month & Year"
                        showCurrentSelection={false}
                        size="small"
                      />
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => fetchTransactions(1)}
                        disabled={loading}
                      >
                        Apply Month Filter
                      </Button>
                    </Box>
                  )}
                </Box>
                
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={3}>
                      <DatePicker
                        label="Start Date"
                        value={filters.startDate}
                        onChange={(date) => handleFilterChange('startDate', date)}
                        renderInput={(params) => <TextField {...params} fullWidth />}
                        disabled={useMonthFilter}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <DatePicker
                        label="End Date"
                        value={filters.endDate}
                        onChange={(date) => handleFilterChange('endDate', date)}
                        renderInput={(params) => <TextField {...params} fullWidth />}
                        disabled={useMonthFilter}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <FormControl fullWidth>
                        <InputLabel>Blockchain</InputLabel>
                        <Select
                          value={filters.blockchain}
                          label="Blockchain"
                          onChange={(e) => handleFilterChange('blockchain', e.target.value)}
                        >
                          <MenuItem value="">All</MenuItem>
                          <MenuItem value="bitcoin">Bitcoin</MenuItem>
                          <MenuItem value="ethereum">Ethereum</MenuItem>
                          <MenuItem value="tron">TRON</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <FormControl fullWidth>
                        <InputLabel>Transfer Type</InputLabel>
                        <Select
                          value={filters.transferType}
                          label="Transfer Type"
                          onChange={(e) => handleFilterChange('transferType', e.target.value)}
                        >
                          <MenuItem value="incoming">Incoming</MenuItem>
                          <MenuItem value="outgoing">Outgoing</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <TextField
                        fullWidth
                        label="Min Amount"
                        type="number"
                        value={filters.minAmount}
                        onChange={(e) => handleFilterChange('minAmount', e.target.value)}
                        InputProps={{
                          startAdornment: <InputAdornment position="start">$</InputAdornment>,
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <TextField
                        fullWidth
                        label="Max Amount"
                        type="number"
                        value={filters.maxAmount}
                        onChange={(e) => handleFilterChange('maxAmount', e.target.value)}
                        InputProps={{
                          startAdornment: <InputAdornment position="start">$</InputAdornment>,
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <TextField
                        fullWidth
                        label="Token Symbol"
                        value={filters.tokenSymbol}
                        onChange={(e) => handleFilterChange('tokenSymbol', e.target.value)}
                        placeholder="e.g., USDT, BTC"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <TextField
                        fullWidth
                        label="Search Hash"
                        value={filters.searchHash}
                        onChange={(e) => handleFilterChange('searchHash', e.target.value)}
                        placeholder="Transaction hash..."
                        InputProps={{
                          startAdornment: <InputAdornment position="start"><Search /></InputAdornment>,
                        }}
                      />
                    </Grid>
                  </Grid>
                  <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                    <Button variant="contained" onClick={handleApplyFilters}>
                      Apply Filters
                    </Button>
                    <Button variant="outlined" onClick={handleClearFilters}>
                      Clear Filters
                    </Button>
                  </Box>
                </LocalizationProvider>
              </CardContent>
            </Card>
          </Collapse>

          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Loading Indicator */}
          {loading && (
            <Box display="flex" justifyContent="center" sx={{ mb: 2 }}>
              <CircularProgress />
            </Box>
          )}

          {/* Transactions Table */}
          <Paper>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Blockchain</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Token</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell align="right">USD Value</TableCell>
                    <TableCell>From</TableCell>
                    <TableCell>Hash</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow key={transaction._id} hover>
                      <TableCell>
                        {formatDate(transaction.timestamp)}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={transaction.blockchain.toUpperCase()}
                          color={getBlockchainColor(transaction.blockchain)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={getTransferTypeIcon(transaction.transferType)}
                          label={transaction.transferType}
                          color={getTransferTypeColor(transaction.transferType)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {transaction.token.symbol}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {transaction.amount.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="primary">
                          {formatCurrency(transaction.usdValue)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ maxWidth: 120 }}>
                          {`${transaction.from.slice(0, 6)}...${transaction.from.slice(-4)}`}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ maxWidth: 120 }}>
                          {`${transaction.transactionHash.slice(0, 6)}...${transaction.transactionHash.slice(-4)}`}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Tooltip title="View in Explorer">
                          <IconButton
                            size="small"
                            onClick={() => openTransactionInExplorer(transaction)}
                          >
                            <Link />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={pagination.totalCount || 0}
              page={(pagination.currentPage || 1) - 1}
              onPageChange={handlePageChange}
              rowsPerPage={pagination.limit || 25}
              onRowsPerPageChange={handleRowsPerPageChange}
              rowsPerPageOptions={[10, 25, 50, 100]}
            />
          </Paper>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default TransactionHistoryModal; 