import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Chip,
  Avatar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Stack,
  Divider,
  useTheme,
  alpha,
  IconButton,
  Tooltip,
  useMediaQuery,
  Skeleton,
  Button,
} from "@mui/material";
import {
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  Phone as PhoneIcon,
  AttachMoney as MoneyIcon,
  Refresh as RefreshIcon,
  Timeline as TimelineIcon,
  Speed as SpeedIcon,
  Assessment as AssessmentIcon,
  Sync as SyncIcon,
  AccountBalance as AccountBalanceIcon,
  Receipt as ReceiptIcon,
  TrendingDown as TrendingDownIcon,
  DateRange as DateRangeIcon,
} from "@mui/icons-material";
import { motion, AnimatePresence } from "framer-motion";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2"; // Line chart removed for performance
import { selectUser } from "../store/slices/authSlice";
import {
  loadPerformanceData,
  refreshPerformanceData,
  selectTeamStats,
  selectFinancialMetrics,
  selectLeadStats,
  selectOrderStats,
  selectAgentPerformance,
  selectIsLoading,
  selectIsSyncing,
  selectError,
  selectLastSyncTime,
  selectBackgroundSyncActive,
  clearError,
} from "../store/slices/performanceSlice";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  ChartTooltip,
  Legend,
  ArcElement
);

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15,
    },
  },
};

const cardStyle = {
  height: "100%",
  transition: "transform 0.2s, box-shadow 0.2s",
  "&:hover": {
    transform: "translateY(-4px)",
    boxShadow: (theme) =>
      `0 8px 24px ${alpha(theme.palette.primary.main, 0.15)}`,
  },
};

const PerformancePage = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));

  // Redux state selectors
  const teamStats = useSelector(selectTeamStats);
  const financialMetrics = useSelector(selectFinancialMetrics);
  const leadStats = useSelector(selectLeadStats);
  const orderStats = useSelector(selectOrderStats);
  const agentPerformance = useSelector(selectAgentPerformance);
  const isLoading = useSelector(selectIsLoading);
  const isSyncing = useSelector(selectIsSyncing);
  const error = useSelector(selectError);
  const lastSyncTime = useSelector(selectLastSyncTime);
  const backgroundSyncActive = useSelector(selectBackgroundSyncActive);

  // Local state
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [appliedMonth, setAppliedMonth] = useState(new Date().getMonth() + 1);
  const [appliedYear, setAppliedYear] = useState(new Date().getFullYear());
  // Chart data state removed - no longer needed

  // Load performance data using Redux
  const loadData = async (forceRefresh = false) => {
    try {
      await dispatch(loadPerformanceData({
        forceSync: forceRefresh,
        month: appliedMonth,
        year: appliedYear
      }));
    } catch (err) {
      console.error("Error loading performance data:", err);
    }
  };

  // Handle manual refresh
  const handleRefresh = async () => {
    try {
      await dispatch(refreshPerformanceData({
        month: appliedMonth,
        year: appliedYear
      }));
    } catch (err) {
      console.error("Error refreshing performance data:", err);
    }
  };

  // Handle month/year change (just update local state, don't fetch data)
  const handleMonthChange = (event) => {
    const newMonth = event.target.value;
    console.log(`📅 Month changed from ${selectedMonth} to ${newMonth}`);
    setSelectedMonth(newMonth);
  };

  const handleYearChange = (event) => {
    const newYear = event.target.value;
    console.log(`📅 Year changed from ${selectedYear} to ${newYear}`);
    setSelectedYear(newYear);
  };

  // Handle Apply button click - this actually triggers the data fetch
  const handleApplyFilters = async () => {
    console.log(`🚀 Applying filters: Month ${selectedMonth}, Year ${selectedYear}`);
    setAppliedMonth(selectedMonth);
    setAppliedYear(selectedYear);

    // Load data with the new filters
    try {
      await dispatch(loadPerformanceData({
        forceSync: true,
        month: selectedMonth,
        year: selectedYear
      }));
    } catch (err) {
      console.error("Error loading performance data:", err);
    }
  };

  // Chart generation removed - no longer needed since monthly breakdown is removed
  // This improves performance by avoiding expensive backend calculations

  // Load data when component mounts - only load once with initial values
  useEffect(() => {
    if (user && (user.role === "admin" || user.role === "agent")) {
      loadData();
    }
  }, [user]); // Removed selectedMonth and selectedYear from dependencies

  // Chart data generation useEffect removed - no longer needed

  // Clear errors when component unmounts
  useEffect(() => {
    return () => {
      dispatch(clearError());
    };
  }, [dispatch]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        labels: {
          font: {
            family: theme.typography.fontFamily,
            size: isSmallScreen ? 10 : 12,
          },
          usePointStyle: true,
        },
      },
      title: {
        display: true,
        text: "Financial Performance Trend",
        font: {
          family: theme.typography.fontFamily,
          size: isSmallScreen ? 14 : 16,
          weight: "bold",
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: alpha(theme.palette.text.primary, 0.1),
        },
        ticks: {
          font: {
            family: theme.typography.fontFamily,
            size: isSmallScreen ? 10 : 12,
          },
          callback: function(value) {
            return '$' + value.toLocaleString();
          }
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: {
            family: theme.typography.fontFamily,
            size: isSmallScreen ? 10 : 12,
          },
        },
      },
    },
    animation: {
      duration: 1000,
      easing: "easeInOutQuart",
    },
  };

  const leadDistributionData = leadStats?.leads
    ? {
        labels: ["FTD", "Filler", "Cold"],
        datasets: [
          {
            data: [
              leadStats.leads.ftd?.total || 0,
              leadStats.leads.filler?.total || 0,
              leadStats.leads.cold?.total || 0,
            ],
            backgroundColor: ["#FF6384", "#36A2EB", "#FFCE56"],
            hoverBackgroundColor: ["#FF6384", "#36A2EB", "#FFCE56"],
          },
        ],
      }
    : {
        labels: ["FTD", "Filler", "Cold"],
        datasets: [
          {
            data: [0, 0, 0],
            backgroundColor: ["#FF6384", "#36A2EB", "#FFCE56"],
            hoverBackgroundColor: ["#FF6384", "#36A2EB", "#FFCE56"],
          },
        ],
      };

  const getPerformanceMetrics = () => {
    if (user?.role === "agent" && agentPerformance.length > 0) {
      const totalCalls = agentPerformance.reduce(
        (sum, p) => sum + (p.metrics?.callsMade || 0),
        0
      );
      const totalEarnings = agentPerformance.reduce(
        (sum, p) => sum + (p.metrics?.earnings || 0),
        0
      );
      const avgQuality =
        agentPerformance.reduce(
          (sum, p) => sum + (p.metrics?.averageCallQuality || 0),
          0
        ) / agentPerformance.length;
      return {
        totalCalls,
        totalEarnings: totalEarnings.toFixed(2),
        averageQuality: avgQuality.toFixed(1),
        totalFTDs: agentPerformance.reduce(
          (sum, p) => sum + (p.metrics?.ftdCount || 0),
          0
        ),
        totalFillers: agentPerformance.reduce(
          (sum, p) => sum + (p.metrics?.fillerCount || 0),
          0
        ),
      };
    }
    return null;
  };

  const agentMetrics = getPerformanceMetrics();

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value || 0);
  };

  const formatPercentage = (value) => {
    return `${(value || 0).toFixed(1)}%`;
  };

  if (user?.role !== "admin" && user?.role !== "agent") {
    return (
      <Box sx={{ p: isSmallScreen ? 2 : 3 }}>
        <Alert severity="error">
          You don't have permission to access performance analytics.
        </Alert>
      </Box>
    );
  }

  return (
    <Box
      component={motion.div}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      sx={{ width: "100%", typography: "body1" }}
    >
      <Box
        display="flex"
        flexDirection={isSmallScreen ? "column" : "row"}
        justifyContent="space-between"
        alignItems={isSmallScreen ? "flex-start" : "center"}
        mb={3}
      >
        <Box>
          <Typography
            variant={isSmallScreen ? "h5" : "h4"}
            component={motion.h4}
            variants={itemVariants}
            sx={{
              fontWeight: "bold",
              background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              mb: isSmallScreen ? 1 : 0,
            }}
          >
            {user?.role === "agent"
              ? "My Performance"
              : "Performance Analytics"}
          </Typography>
          {user?.role === "admin" && (
            <Chip
              label={`Showing data for ${new Date(appliedYear, appliedMonth - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`}
              color="primary"
              variant="outlined"
              size="small"
              sx={{ mt: 0.5, fontSize: '0.75rem' }}
            />
          )}
          {lastSyncTime && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                mb: isSmallScreen ? 1 : 0,
              }}
            >
              Last updated: {new Date(lastSyncTime).toLocaleString()}
              {backgroundSyncActive && (
                <Chip
                  label="Auto-sync active"
                  size="small"
                  color="success"
                  variant="outlined"
                  sx={{ ml: 1, height: 20, fontSize: "0.6rem" }}
                />
              )}
            </Typography>
          )}
          {user?.role === "admin" && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 1, display: "block" }}
            >
              💡 Financial data includes crypto wallet values, affiliate manager expenses, withdrawals, and agent earnings
            </Typography>
          )}
        </Box>
        <Stack
          direction={isSmallScreen ? "column" : "row"}
          spacing={isSmallScreen ? 1 : 2}
          alignItems={isSmallScreen ? "stretch" : "center"}
          sx={{ width: isSmallScreen ? "100%" : "auto" }}
        >
          {user?.role === "admin" && (
            <>
              <FormControl
                sx={{ minWidth: isSmallScreen ? "100%" : 120 }}
                component={motion.div}
                variants={itemVariants}
              >
                <InputLabel>Month</InputLabel>
                <Select
                  value={selectedMonth}
                  label="Month"
                  onChange={handleMonthChange}
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <MenuItem key={i + 1} value={i + 1}>
                      {new Date(2024, i).toLocaleDateString('en-US', { month: 'long' })}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl
                sx={{ minWidth: isSmallScreen ? "100%" : 100 }}
                component={motion.div}
                variants={itemVariants}
              >
                <InputLabel>Year</InputLabel>
                <Select
                  value={selectedYear}
                  label="Year"
                  onChange={handleYearChange}
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
              <Button
                variant="contained"
                color="primary"
                onClick={handleApplyFilters}
                disabled={isLoading || isSyncing || (selectedMonth === appliedMonth && selectedYear === appliedYear)}
                startIcon={<DateRangeIcon />}
                component={motion.div}
                variants={itemVariants}
                sx={{
                  minHeight: 56, // Match the height of the select fields
                  whiteSpace: 'nowrap',
                  '&:disabled': {
                    opacity: 0.5
                  },
                  // Visual indicator when filters have changed
                  ...(selectedMonth !== appliedMonth || selectedYear !== appliedYear ? {
                    animation: 'pulse 2s infinite',
                    '@keyframes pulse': {
                      '0%': { boxShadow: '0 0 0 0 rgba(25, 118, 210, 0.7)' },
                      '70%': { boxShadow: '0 0 0 10px rgba(25, 118, 210, 0)' },
                      '100%': { boxShadow: '0 0 0 0 rgba(25, 118, 210, 0)' }
                    }
                  } : {})
                }}
              >
                {selectedMonth !== appliedMonth || selectedYear !== appliedYear ? 'Apply Changes' : 'Applied'}
              </Button>
            </>
          )}
          <Tooltip title="Refresh Data">
            <IconButton
              onClick={handleRefresh}
              disabled={isSyncing}
              component={motion.button}
              variants={itemVariants}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              sx={{ alignSelf: isSmallScreen ? "flex-end" : "center" }}
            >
              {isSyncing ? <SyncIcon className="spin" /> : <RefreshIcon />}
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          component={motion.div}
          variants={itemVariants}
        >
          {error}
        </Alert>
      )}

      <AnimatePresence>
        {isLoading && !teamStats && !agentPerformance.length ? (
          <Box
            display="flex"
            justifyContent="center"
            my={4}
            component={motion.div}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={isSmallScreen ? 1 : 3}>
            {user?.role === "admin" && (
              <>
                {/* Financial Metrics Cards */}
                <Grid
                  item
                  xs={12}
                  sm={6}
                  md={3}
                  component={motion.div}
                  variants={itemVariants}
                >
                  <Card sx={cardStyle}>
                    <CardContent sx={{ p: isSmallScreen ? 1.5 : 2 }}>
                      <Box display="flex" alignItems="center">
                        <Avatar
                          sx={{
                            bgcolor: alpha(theme.palette.success.main, 0.1),
                            color: theme.palette.success.main,
                            mr: isSmallScreen ? 1 : 2,
                            width: isSmallScreen ? 40 : 56,
                            height: isSmallScreen ? 40 : 56,
                          }}
                        >
                          <AccountBalanceIcon />
                        </Avatar>
                        <Box>
                          <Typography
                            variant={isSmallScreen ? "h6" : "h4"}
                            sx={{
                              fontWeight: "bold",
                              background: `linear-gradient(45deg, ${theme.palette.success.main}, ${theme.palette.success.dark})`,
                              WebkitBackgroundClip: "text",
                              WebkitTextFillColor: "transparent",
                            }}
                          >
                            {formatCurrency(financialMetrics?.metrics?.totalMoneyIn)}
                          </Typography>
                          <Typography
                            variant={isSmallScreen ? "caption" : "body2"}
                            color="text.secondary"
                          >
                            Total Money In (Crypto)
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid
                  item
                  xs={12}
                  sm={6}
                  md={3}
                  component={motion.div}
                  variants={itemVariants}
                >
                  <Card sx={cardStyle}>
                    <CardContent sx={{ p: isSmallScreen ? 1.5 : 2 }}>
                      <Box display="flex" alignItems="center">
                        <Avatar
                          sx={{
                            bgcolor: alpha(theme.palette.error.main, 0.1),
                            color: theme.palette.error.main,
                            mr: isSmallScreen ? 1 : 2,
                            width: isSmallScreen ? 40 : 56,
                            height: isSmallScreen ? 40 : 56,
                          }}
                        >
                          <ReceiptIcon />
                        </Avatar>
                        <Box>
                          <Typography
                            variant={isSmallScreen ? "h6" : "h4"}
                            sx={{
                              fontWeight: "bold",
                              background: `linear-gradient(45deg, ${theme.palette.error.main}, ${theme.palette.error.dark})`,
                              WebkitBackgroundClip: "text",
                              WebkitTextFillColor: "transparent",
                            }}
                          >
                            {formatCurrency(financialMetrics?.metrics?.totalExpenses)}
                          </Typography>
                          <Typography
                            variant={isSmallScreen ? "caption" : "body2"}
                            color="text.secondary"
                          >
                            Total Expenses
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid
                  item
                  xs={12}
                  sm={6}
                  md={3}
                  component={motion.div}
                  variants={itemVariants}
                >
                  <Card sx={cardStyle}>
                    <CardContent sx={{ p: isSmallScreen ? 1.5 : 2 }}>
                      <Box display="flex" alignItems="center">
                        <Avatar
                          sx={{
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            color: theme.palette.primary.main,
                            mr: isSmallScreen ? 1 : 2,
                            width: isSmallScreen ? 40 : 56,
                            height: isSmallScreen ? 40 : 56,
                          }}
                        >
                          <TrendingUpIcon />
                        </Avatar>
                        <Box>
                          <Typography
                            variant={isSmallScreen ? "h6" : "h4"}
                            sx={{
                              fontWeight: "bold",
                              background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                              WebkitBackgroundClip: "text",
                              WebkitTextFillColor: "transparent",
                            }}
                          >
                            {formatCurrency(financialMetrics?.metrics?.netProfit)}
                          </Typography>
                          <Typography
                            variant={isSmallScreen ? "caption" : "body2"}
                            color="text.secondary"
                          >
                            Net Profit
                          </Typography>
                        </Box>
                      </Box>
                      <Box mt={isSmallScreen ? 1 : 2}>
                        <Typography
                          variant={isSmallScreen ? "caption" : "body2"}
                          color="text.secondary"
                        >
                          Profit Margin
                        </Typography>
                        <Box display="flex" alignItems="center" mt={0.5}>
                          <TrendingUpIcon
                            sx={{
                              color: theme.palette.success.main,
                              fontSize: isSmallScreen ? "0.8rem" : "1rem",
                              mr: 0.5,
                            }}
                          />
                          <Typography
                            variant={isSmallScreen ? "body2" : "body1"}
                            color="success.main"
                            fontWeight="bold"
                          >
                            {formatPercentage(financialMetrics?.metrics?.profitMargin)}
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid
                  item
                  xs={12}
                  sm={6}
                  md={3}
                  component={motion.div}
                  variants={itemVariants}
                >
                  <Card sx={cardStyle}>
                    <CardContent sx={{ p: isSmallScreen ? 1.5 : 2 }}>
                      <Box display="flex" alignItems="center">
                        <Avatar
                          sx={{
                            bgcolor: alpha(theme.palette.info.main, 0.1),
                            color: theme.palette.info.main,
                            mr: isSmallScreen ? 1 : 2,
                            width: isSmallScreen ? 40 : 56,
                            height: isSmallScreen ? 40 : 56,
                          }}
                        >
                          <PeopleIcon />
                        </Avatar>
                        <Box>
                          <Typography
                            variant={isSmallScreen ? "h6" : "h4"}
                            sx={{
                              fontWeight: "bold",
                              background: `linear-gradient(45deg, ${theme.palette.info.main}, ${theme.palette.info.dark})`,
                              WebkitBackgroundClip: "text",
                              WebkitTextFillColor: "transparent",
                            }}
                          >
                            {teamStats?.totalAgents || 0}
                          </Typography>
                          <Typography
                            variant={isSmallScreen ? "caption" : "body2"}
                            color="text.secondary"
                          >
                            Active Agents
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Financial Performance Chart - Removed for performance optimization */}
                {/* This eliminates expensive backend calculations and improves loading speed */}

                {/* Lead Distribution Chart */}
                <Grid
                  item
                  xs={12}
                  md={6}
                  component={motion.div}
                  variants={itemVariants}
                >
                  <Card sx={cardStyle}>
                    <CardHeader
                      title={
                        <Typography
                          variant={isSmallScreen ? "h6" : "h5"}
                          sx={{ fontWeight: "bold" }}
                        >
                          Lead Distribution
                        </Typography>
                      }
                      action={
                        <Tooltip title="View Details">
                          <IconButton size={isSmallScreen ? "small" : "medium"}>
                            <AssessmentIcon />
                          </IconButton>
                        </Tooltip>
                      }
                      sx={{ p: isSmallScreen ? 1.5 : 2 }}
                    />
                    <CardContent sx={{ p: isSmallScreen ? 1.5 : 2 }}>
                      <Box sx={{ height: isSmallScreen ? 250 : 300 }}>
                        {leadDistributionData ? (
                          <Doughnut
                            data={leadDistributionData}
                            options={{
                              ...chartOptions,
                              cutout: "70%",
                              plugins: {
                                ...chartOptions.plugins,
                                legend: {
                                  ...chartOptions.plugins.legend,
                                  position: "bottom",
                                  labels: {
                                    font: {
                                      family: theme.typography.fontFamily,
                                      size: isSmallScreen ? 10 : 12,
                                    },
                                    usePointStyle: true,
                                  },
                                },
                              },
                            }}
                          />
                        ) : (
                          <Box display="flex" justifyContent="center" p={4}>
                            <CircularProgress />
                          </Box>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

              </>
            )}

            {/* Agent View */}
            {user?.role === "agent" && agentMetrics && (
              <>
                <Grid
                  item
                  xs={12}
                  sm={6}
                  md={3}
                  component={motion.div}
                  variants={itemVariants}
                >
                  <Card sx={cardStyle}>
                    <CardContent sx={{ p: isSmallScreen ? 1.5 : 2 }}>
                      <Box display="flex" alignItems="center">
                        <Avatar
                          sx={{
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            color: theme.palette.primary.main,
                            mr: isSmallScreen ? 1 : 2,
                            width: isSmallScreen ? 40 : 56,
                            height: isSmallScreen ? 40 : 56,
                          }}
                        >
                          <PhoneIcon />
                        </Avatar>
                        <Box>
                          <Typography
                            variant={isSmallScreen ? "h6" : "h4"}
                            sx={{
                              fontWeight: "bold",
                              background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                              WebkitBackgroundClip: "text",
                              WebkitTextFillColor: "transparent",
                            }}
                          >
                            {agentMetrics.totalCalls}
                          </Typography>
                          <Typography
                            variant={isSmallScreen ? "caption" : "body2"}
                            color="textSecondary"
                          >
                            Total Calls
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid
                  item
                  xs={12}
                  sm={6}
                  md={3}
                  component={motion.div}
                  variants={itemVariants}
                >
                  <Card sx={cardStyle}>
                    <CardContent sx={{ p: isSmallScreen ? 1.5 : 2 }}>
                      <Box display="flex" alignItems="center">
                        <Avatar
                          sx={{
                            bgcolor: alpha(theme.palette.success.main, 0.1),
                            color: theme.palette.success.main,
                            mr: isSmallScreen ? 1 : 2,
                            width: isSmallScreen ? 40 : 56,
                            height: isSmallScreen ? 40 : 56,
                          }}
                        >
                          <MoneyIcon />
                        </Avatar>
                        <Box>
                          <Typography
                            variant={isSmallScreen ? "h6" : "h4"}
                            sx={{
                              fontWeight: "bold",
                              background: `linear-gradient(45deg, ${theme.palette.success.main}, ${theme.palette.success.dark})`,
                              WebkitBackgroundClip: "text",
                              WebkitTextFillColor: "transparent",
                            }}
                          >
                            ${agentMetrics.totalEarnings}
                          </Typography>
                          <Typography
                            variant={isSmallScreen ? "caption" : "body2"}
                            color="text.secondary"
                          >
                            Total Earnings
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid
                  item
                  xs={12}
                  sm={6}
                  md={3}
                  component={motion.div}
                  variants={itemVariants}
                >
                  <Card sx={cardStyle}>
                    <CardContent sx={{ p: isSmallScreen ? 1.5 : 2 }}>
                      <Box display="flex" alignItems="center">
                        <Avatar
                          sx={{
                            bgcolor: alpha(theme.palette.warning.main, 0.1),
                            color: theme.palette.warning.main,
                            mr: isSmallScreen ? 1 : 2,
                            width: isSmallScreen ? 40 : 56,
                            height: isSmallScreen ? 40 : 56,
                          }}
                        >
                          <TrendingUpIcon />
                        </Avatar>
                        <Box>
                          <Typography
                            variant={isSmallScreen ? "h6" : "h4"}
                            sx={{
                              fontWeight: "bold",
                              background: `linear-gradient(45deg, ${theme.palette.warning.main}, ${theme.palette.warning.dark})`,
                              WebkitBackgroundClip: "text",
                              WebkitTextFillColor: "transparent",
                            }}
                          >
                            {agentMetrics.totalFTDs}
                          </Typography>
                          <Typography
                            variant={isSmallScreen ? "caption" : "body2"}
                            color="text.secondary"
                          >
                            FTD Conversions
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid
                  item
                  xs={12}
                  sm={6}
                  md={3}
                  component={motion.div}
                  variants={itemVariants}
                >
                  <Card sx={cardStyle}>
                    <CardContent sx={{ p: isSmallScreen ? 1.5 : 2 }}>
                      <Box display="flex" alignItems="center">
                        <Avatar
                          sx={{
                            bgcolor: alpha(theme.palette.info.main, 0.1),
                            color: theme.palette.info.main,
                            mr: isSmallScreen ? 1 : 2,
                            width: isSmallScreen ? 40 : 56,
                            height: isSmallScreen ? 40 : 56,
                          }}
                        >
                          <SpeedIcon />
                        </Avatar>
                        <Box>
                          <Typography
                            variant={isSmallScreen ? "h6" : "h4"}
                            sx={{
                              fontWeight: "bold",
                              background: `linear-gradient(45deg, ${theme.palette.info.main}, ${theme.palette.info.dark})`,
                              WebkitBackgroundClip: "text",
                              WebkitTextFillColor: "transparent",
                            }}
                          >
                            {agentMetrics.averageQuality}
                          </Typography>
                          <Typography
                            variant={isSmallScreen ? "caption" : "body2"}
                            color="text.secondary"
                          >
                            Avg Quality Score
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Agent Performance Table */}
                <Grid
                  item
                  xs={12}
                  component={motion.div}
                  variants={itemVariants}
                >
                  <Card sx={cardStyle}>
                    <CardHeader title="Daily Performance Records" />
                    <CardContent sx={{ p: isSmallScreen ? 1.5 : 2 }}>
                      <TableContainer component={Paper}>
                        <Table size={isSmallScreen ? "small" : "medium"}>
                          <TableHead>
                            <TableRow>
                              <TableCell>Date</TableCell>
                              <TableCell>Calls Made</TableCell>
                              <TableCell>Earnings</TableCell>
                              <TableCell>FTDs</TableCell>
                              <TableCell>Fillers</TableCell>
                              <TableCell>Quality Score</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {agentPerformance.map((record, index) => (
                              <TableRow
                                key={record._id}
                                component={motion.tr}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                sx={{
                                  "&:hover": {
                                    bgcolor: alpha(
                                      theme.palette.primary.main,
                                      0.05
                                    ),
                                  },
                                }}
                              >
                                <TableCell>
                                  <Typography
                                    variant={isSmallScreen ? "body2" : "body1"}
                                  >
                                    {new Date(record.date).toLocaleDateString()}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography
                                    variant={isSmallScreen ? "body2" : "body1"}
                                  >
                                    {record.metrics?.callsMade || 0}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography
                                    variant={isSmallScreen ? "body2" : "body1"}
                                  >
                                    ${record.metrics?.earnings || 0}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography
                                    variant={isSmallScreen ? "body2" : "body1"}
                                  >
                                    {record.metrics?.ftdCount || 0}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography
                                    variant={isSmallScreen ? "body2" : "body1"}
                                  >
                                    {record.metrics?.fillerCount || 0}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    label={
                                      record.metrics?.averageCallQuality || 0
                                    }
                                    color={
                                      (record.metrics?.averageCallQuality ||
                                        0) >= 4
                                        ? "success"
                                        : (record.metrics?.averageCallQuality ||
                                            0) >= 3
                                        ? "warning"
                                        : "error"
                                    }
                                    size="small"
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </CardContent>
                  </Card>
                </Grid>
              </>
            )}
          </Grid>
        )}
      </AnimatePresence>
    </Box>
  );
};

export default PerformancePage;
