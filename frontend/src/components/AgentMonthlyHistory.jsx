import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  Grid,
  Box,
  Chip,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  CircularProgress,
  useTheme,
  alpha,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  IconButton,
  Collapse,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  Phone as PhoneIcon,
  CheckCircle as CheckCircleIcon,
  AttachMoney as MoneyIcon,
  AccessTime as AccessTimeIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon,
  CalendarMonth as CalendarMonthIcon,
  Assessment as AssessmentIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { fetchAgentMonthlyHistory } from '../services/agents';

const AgentMonthlyHistory = ({ agentName }) => {
  const theme = useTheme();
  const [monthlyHistory, setMonthlyHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [monthsBack, setMonthsBack] = useState(12);
  const [expandedMonth, setExpandedMonth] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filterYear, setFilterYear] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [filteredHistory, setFilteredHistory] = useState([]);

  useEffect(() => {
    fetchMonthlyHistory();
  }, [monthsBack]);

  // Filter history based on selected year and month
  useEffect(() => {
    if (!monthlyHistory?.monthlyHistory) {
      setFilteredHistory([]);
      return;
    }

    let filtered = monthlyHistory.monthlyHistory;

    // Filter by year
    if (filterYear !== 'all') {
      filtered = filtered.filter(month => month.year === parseInt(filterYear));
    }

    // Filter by month
    if (filterMonth !== 'all') {
      filtered = filtered.filter(month => month.month === parseInt(filterMonth));
    }

    setFilteredHistory(filtered);
  }, [monthlyHistory, filterYear, filterMonth]);

  const fetchMonthlyHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAgentMonthlyHistory(monthsBack);
      setMonthlyHistory(data);
    } catch (error) {
      console.error('Error fetching monthly history:', error);
      setError(error.message || 'Failed to fetch monthly history');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchMonthlyHistory();
    } finally {
      setRefreshing(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatTimeHours = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getTrendIcon = (trend) => {
    if (trend > 0) return <TrendingUpIcon color="success" />;
    if (trend < 0) return <TrendingDownIcon color="error" />;
    return <TrendingFlatIcon color="action" />;
  };

  const getTrendColor = (trend) => {
    if (trend > 0) return 'success';
    if (trend < 0) return 'error';
    return 'default';
  };

  // Get available years from the data
  const getAvailableYears = () => {
    if (!monthlyHistory?.monthlyHistory) return [];
    const years = [...new Set(monthlyHistory.monthlyHistory.map(month => month.year))];
    return years.sort((a, b) => b - a); // Sort descending (newest first)
  };

  // Get available months from the data
  const getAvailableMonths = () => {
    const months = [
      { value: 1, label: 'January' },
      { value: 2, label: 'February' },
      { value: 3, label: 'March' },
      { value: 4, label: 'April' },
      { value: 5, label: 'May' },
      { value: 6, label: 'June' },
      { value: 7, label: 'July' },
      { value: 8, label: 'August' },
      { value: 9, label: 'September' },
      { value: 10, label: 'October' },
      { value: 11, label: 'November' },
      { value: 12, label: 'December' }
    ];
    return months;
  };

  // Calculate filtered totals
  const calculateFilteredTotals = () => {
    if (!filteredHistory || filteredHistory.length === 0) {
      return {
        totalCalls: 0,
        totalSuccessfulCalls: 0,
        totalTalkTimeSeconds: 0,
        totalEarnings: 0,
        monthsActive: 0
      };
    }

    return filteredHistory.reduce((totals, month) => {
      return {
        totalCalls: totals.totalCalls + month.totalCalls,
        totalSuccessfulCalls: totals.totalSuccessfulCalls + month.successfulCalls,
        totalTalkTimeSeconds: totals.totalTalkTimeSeconds + month.totalTalkTimeSeconds,
        totalEarnings: totals.totalEarnings + month.totalEarnings,
        monthsActive: totals.monthsActive + 1
      };
    }, {
      totalCalls: 0,
      totalSuccessfulCalls: 0,
      totalTalkTimeSeconds: 0,
      totalEarnings: 0,
      monthsActive: 0
    });
  };

  // Calculate filtered trends
  const calculateFilteredTrends = () => {
    if (!filteredHistory || filteredHistory.length < 2) {
      return {
        callsTrend: 0,
        earningsTrend: 0,
        talkTimeTrend: 0,
        successRateTrend: 0
      };
    }

    const latest = filteredHistory[0];
    const previous = filteredHistory[1];

    const calculatePercentageChange = (oldValue, newValue) => {
      if (oldValue === 0) return newValue > 0 ? 100 : 0;
      return Math.round(((newValue - oldValue) / oldValue) * 100);
    };

    return {
      callsTrend: calculatePercentageChange(previous.totalCalls, latest.totalCalls),
      earningsTrend: calculatePercentageChange(previous.totalEarnings, latest.totalEarnings),
      talkTimeTrend: calculatePercentageChange(previous.totalTalkTimeSeconds, latest.totalTalkTimeSeconds),
      successRateTrend: calculatePercentageChange(previous.successRate, latest.successRate)
    };
  };

  const filteredTotals = calculateFilteredTotals();
  const filteredTrends = calculateFilteredTrends();

  const MonthCard = ({ month, index }) => (
    <Card
      component={motion.div}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      sx={{
        mb: 2,
        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`,
        border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
        '&:hover': {
          boxShadow: theme.shadows[4],
          transform: 'translateY(-2px)',
        },
        transition: 'all 0.3s ease',
      }}
    >
      <CardHeader
        title={
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="h6" component="div">
              {month.monthName}
            </Typography>
            <IconButton
              onClick={() => setExpandedMonth(expandedMonth === month.monthName ? null : month.monthName)}
              size="small"
            >
              {expandedMonth === month.monthName ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
        }
        subheader={
          <Box display="flex" alignItems="center" gap={1}>
            <CalendarMonthIcon fontSize="small" />
            <Typography variant="body2" color="text.secondary">
              {`${month.year}-${String(month.month).padStart(2, '0')}`}
            </Typography>
          </Box>
        }
      />
      <CardContent>
        <Grid container spacing={2}>
          {/* Main Metrics */}
          <Grid item xs={12} sm={6} md={3}>
            <Box textAlign="center">
              <PhoneIcon sx={{ fontSize: 32, color: theme.palette.primary.main, mb: 1 }} />
              <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
                {month.totalCalls}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Calls
              </Typography>
              <Typography variant="caption" color="success.main">
                {month.successfulCalls} answered
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Box textAlign="center">
              <MoneyIcon sx={{ fontSize: 32, color: theme.palette.success.main, mb: 1 }} />
              <Typography variant="h4" component="div" sx={{ fontWeight: 'bold', color: theme.palette.success.main }}>
                {formatCurrency(month.totalEarnings)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Earnings
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatCurrency(month.earningsPerCall)} per call
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Box textAlign="center">
              <AccessTimeIcon sx={{ fontSize: 32, color: theme.palette.info.main, mb: 1 }} />
              <Typography variant="h4" component="div" sx={{ fontWeight: 'bold', color: theme.palette.info.main }}>
                {formatTimeHours(month.totalTalkTimeSeconds)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Talk Time
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {month.avgTalkTimeMinutes}m avg per call
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Box textAlign="center">
              <AssessmentIcon sx={{ fontSize: 32, color: theme.palette.warning.main, mb: 1 }} />
              <Typography variant="h4" component="div" sx={{ fontWeight: 'bold', color: theme.palette.warning.main }}>
                {month.successRate}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Success Rate
              </Typography>
              <LinearProgress
                variant="determinate"
                value={month.successRate}
                sx={{
                  mt: 1,
                  height: 4,
                  borderRadius: 2,
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: month.successRate > 80 ? theme.palette.success.main : 
                                   month.successRate > 60 ? theme.palette.warning.main : 
                                   theme.palette.error.main,
                  },
                }}
              />
            </Box>
          </Grid>
        </Grid>

        {/* Expanded Details */}
        <Collapse in={expandedMonth === month.monthName}>
          <Box sx={{ mt: 3 }}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Call Details
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Box sx={{ p: 2, bgcolor: alpha(theme.palette.primary.main, 0.05), borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Call Status Breakdown
                  </Typography>
                  <Stack spacing={1}>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2">Answered:</Typography>
                      <Chip label={month.callsByStatus.ANSWER} color="success" size="small" />
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2">No Answer:</Typography>
                      <Chip label={month.callsByStatus.NOANSWER} color="warning" size="small" />
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2">Busy:</Typography>
                      <Chip label={month.callsByStatus.BUSY} color="error" size="small" />
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2">Failed:</Typography>
                      <Chip label={month.callsByStatus.FAILED} color="error" size="small" />
                    </Box>
                  </Stack>
                </Box>
              </Grid>

              <Grid item xs={12} md={6}>
                <Box sx={{ p: 2, bgcolor: alpha(theme.palette.info.main, 0.05), borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Call Duration Stats
                  </Typography>
                  <Stack spacing={1}>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2">Longest Call:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {formatTimeHours(month.longestCall)}
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2">Shortest Call:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {formatTimeHours(month.shortestCall)}
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2">Average Duration:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {formatTimeHours(month.averageCallDuration)}
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2">Total Talk Time:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {month.totalTalkTimeFormatted}
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!monthlyHistory || !monthlyHistory.monthlyHistory || monthlyHistory.monthlyHistory.length === 0) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2">
          📊 <strong>Monthly History Unavailable:</strong> Historical monthly data is not available with the new external API. 
          Use the Period Selection above to view specific month/year call data and earnings.
        </Typography>
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header with Controls */}
      <Box sx={{ mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 'bold' }}>
            Monthly Performance History
          </Typography>
          <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Data Range</InputLabel>
              <Select
                value={monthsBack}
                label="Data Range"
                onChange={(e) => setMonthsBack(e.target.value)}
              >
                <MenuItem value={6}>6 months</MenuItem>
                <MenuItem value={12}>12 months</MenuItem>
                <MenuItem value={18}>18 months</MenuItem>
                <MenuItem value={24}>24 months</MenuItem>
              </Select>
            </FormControl>
            
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel>Year</InputLabel>
              <Select
                value={filterYear}
                label="Year"
                onChange={(e) => setFilterYear(e.target.value)}
              >
                <MenuItem value="all">All Years</MenuItem>
                {getAvailableYears().map(year => (
                  <MenuItem key={year} value={year}>{year}</MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Month</InputLabel>
              <Select
                value={filterMonth}
                label="Month"
                onChange={(e) => setFilterMonth(e.target.value)}
              >
                <MenuItem value="all">All Months</MenuItem>
                {getAvailableMonths().map(month => (
                  <MenuItem key={month.value} value={month.value}>{month.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            
            {(filterYear !== 'all' || filterMonth !== 'all') && (
              <Button
                variant="text"
                size="small"
                startIcon={<ClearIcon />}
                onClick={() => {
                  setFilterYear('all');
                  setFilterMonth('all');
                }}
                sx={{ mr: 1 }}
              >
                Clear Filters
              </Button>
            )}
            
            <Button
              variant="outlined"
              startIcon={refreshing ? <CircularProgress size={20} /> : <RefreshIcon />}
              onClick={handleRefresh}
              disabled={refreshing}
            >
              Refresh
            </Button>
          </Box>
        </Box>

        {/* Summary Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ textAlign: 'center', bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
              <CardContent>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
                  {filteredTotals.totalCalls}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Calls
                </Typography>
                <Box display="flex" alignItems="center" justifyContent="center" mt={1}>
                  {getTrendIcon(filteredTrends.callsTrend)}
                  <Typography variant="caption" color={getTrendColor(filteredTrends.callsTrend)}>
                    {filteredTrends.callsTrend > 0 ? '+' : ''}{filteredTrends.callsTrend}%
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ textAlign: 'center', bgcolor: alpha(theme.palette.success.main, 0.05) }}>
              <CardContent>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.success.main }}>
                  {formatCurrency(filteredTotals.totalEarnings)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Earnings
                </Typography>
                <Box display="flex" alignItems="center" justifyContent="center" mt={1}>
                  {getTrendIcon(filteredTrends.earningsTrend)}
                  <Typography variant="caption" color={getTrendColor(filteredTrends.earningsTrend)}>
                    {filteredTrends.earningsTrend > 0 ? '+' : ''}{filteredTrends.earningsTrend}%
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ textAlign: 'center', bgcolor: alpha(theme.palette.info.main, 0.05) }}>
              <CardContent>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.info.main }}>
                  {formatTimeHours(filteredTotals.totalTalkTimeSeconds)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Talk Time
                </Typography>
                <Box display="flex" alignItems="center" justifyContent="center" mt={1}>
                  {getTrendIcon(filteredTrends.talkTimeTrend)}
                  <Typography variant="caption" color={getTrendColor(filteredTrends.talkTimeTrend)}>
                    {filteredTrends.talkTimeTrend > 0 ? '+' : ''}{filteredTrends.talkTimeTrend}%
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ textAlign: 'center', bgcolor: alpha(theme.palette.warning.main, 0.05) }}>
              <CardContent>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.warning.main }}>
                  {filteredTotals.monthsActive}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {filteredTotals.monthsActive === 1 ? 'Active Month' : 'Active Months'}
                </Typography>
                <Box display="flex" alignItems="center" justifyContent="center" mt={1}>
                  {getTrendIcon(filteredTrends.successRateTrend)}
                  <Typography variant="caption" color={getTrendColor(filteredTrends.successRateTrend)}>
                    {filteredTrends.successRateTrend > 0 ? '+' : ''}{filteredTrends.successRateTrend}%
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Monthly History Cards */}
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Monthly Breakdown
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Showing {filteredHistory.length} of {monthlyHistory.monthlyHistory.length} months
            </Typography>
          </Box>
          {(filterYear !== 'all' || filterMonth !== 'all') && (
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="body2" color="text.secondary">
                Filtered:
              </Typography>
              {filterYear !== 'all' && (
                <Chip
                  label={`Year: ${filterYear}`}
                  size="small"
                  color="primary"
                  variant="outlined"
                  onDelete={() => setFilterYear('all')}
                />
              )}
              {filterMonth !== 'all' && (
                <Chip
                  label={`Month: ${getAvailableMonths().find(m => m.value === parseInt(filterMonth))?.label}`}
                  size="small"
                  color="primary"
                  variant="outlined"
                  onDelete={() => setFilterMonth('all')}
                />
              )}
            </Box>
          )}
        </Box>
        
        {filteredHistory.length > 0 ? (
          filteredHistory.map((month, index) => (
            <MonthCard key={month.monthName} month={month} index={index} />
          ))
        ) : (
          <Alert severity="info" sx={{ mb: 2 }}>
            No data found for the selected filters. Try adjusting your filter criteria.
          </Alert>
        )}
      </Box>

      {/* Footer Info */}
      <Box sx={{ mt: 3, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          Data generated at: {new Date(monthlyHistory.generatedAt).toLocaleString()}
        </Typography>
      </Box>
    </Box>
  );
};

export default AgentMonthlyHistory; 