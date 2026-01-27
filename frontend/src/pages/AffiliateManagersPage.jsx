import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Stack,
  Tabs,
  Tab,
  Chip,
  Tooltip,
  InputAdornment,
  Avatar,
} from "@mui/material";
import {
  Edit as EditIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  Person as PersonIcon,
  AccountBalance as SalaryIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  TableChart as TableChartIcon,
  Summarize as SummaryIcon,
} from "@mui/icons-material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import { selectUser } from "../store/slices/authSlice";
import MonthYearSelector from "../components/common/MonthYearSelector";
import {
  getAllAffiliateManagerTables,
  getAffiliateManagerTable,
  formatCurrency,
  refreshTotalMoneyFromCrypto,
  getAffiliateManagerSummary,
} from "../services/affiliateManagerTable";
import {
  getAllSalaryConfigurations,
  createOrUpdateSalaryConfiguration,
  deleteSalaryConfiguration,
  getSalaryStatistics,
  formatSalaryDisplay,
} from "../services/salaryConfiguration";
import AffiliateManagerTableEditor from "../components/AffiliateManagerTableEditor";
import api from "../services/api";

const AffiliateManagersPage = () => {
  const user = useSelector(selectUser);

  // Tab state - starts at 0 (Performance Tables) since Overview was removed
  const [tabValue, setTabValue] = useState(0);

  // Performance tables state
  const [tables, setTables] = useState([]);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [selectedPeriod, setSelectedPeriod] = useState("monthly");
  const [selectedManager, setSelectedManager] = useState(null);
  const [showTableEditor, setShowTableEditor] = useState(false);

  // Salary state
  const [salaryConfigurations, setSalaryConfigurations] = useState([]);
  const [salaryLoading, setSalaryLoading] = useState(true);
  const [salaryStats, setSalaryStats] = useState(null);
  const [affiliateManagers, setAffiliateManagers] = useState([]);
  const [showSalaryForm, setShowSalaryForm] = useState(false);
  const [editingSalaryUser, setEditingSalaryUser] = useState(null);
  const [salaryFormData, setSalaryFormData] = useState({
    userId: "",
    salaryType: "fixed_monthly",
    fixedSalary: {
      amount: "",
      currency: "USD",
      paymentFrequency: "monthly",
    },
    notes: "",
  });
  const [processing, setProcessing] = useState(false);

  // Commission calculation state
  const [commissionData, setCommissionData] = useState({});
  const [commissionLoading, setCommissionLoading] = useState(false);
  const [commissionPeriod, setCommissionPeriod] = useState("monthly");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Summary state (for Summary tab)
  const [summaryData, setSummaryData] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [selectedSummaryManager, setSelectedSummaryManager] = useState("");

  // General state
  const [alert, setAlert] = useState({
    show: false,
    message: "",
    severity: "info",
  });

  useEffect(() => {
    if (user?.role === "admin") {
      loadInitialData();
    }
  }, [user]);

  useEffect(() => {
    if (user?.role === "admin" && tabValue === 0) {
      loadTables();
    }
  }, [user, selectedDate, selectedPeriod, tabValue]);

  useEffect(() => {
    if (affiliateManagers.length > 0 && tabValue === 1) {
      loadCommissionData();
    }
  }, [affiliateManagers, commissionPeriod, selectedMonth, selectedYear, tabValue]);

  // Generate summary data when affiliate managers are loaded or selection changes
  useEffect(() => {
    if (affiliateManagers.length > 0 && tabValue === 2) {
      fetchSummaryData();
    }
  }, [affiliateManagers, selectedMonth, selectedYear, tabValue]);

  const fetchSummaryData = async () => {
    setSummaryLoading(true);
    try {
      const response = await getAffiliateManagerSummary({
        month: selectedMonth,
        year: selectedYear,
      });
      if (response.success) {
        setSummaryData(response.data);
      } else {
        showAlert("Failed to fetch summary data", "error");
      }
    } catch (error) {
      console.error("Error fetching summary data:", error);
      showAlert("Error fetching summary data", "error");
    } finally {
      setSummaryLoading(false);
    }
  };

  const showAlert = (message, severity = "info") => {
    setAlert({ show: true, message, severity });
    setTimeout(
      () => setAlert({ show: false, message: "", severity: "info" }),
      5000
    );
  };

  const loadInitialData = async () => {
    try {
      await Promise.all([
        loadAffiliateManagers(),
        loadSalaryConfigurations(),
      ]);
    } catch (error) {
      console.error("Failed to load initial data:", error);
      showAlert("Failed to load some data", "error");
    }
  };

  const loadAffiliateManagers = async () => {
    try {
      const response = await api.get("/users", {
        params: { role: "affiliate_manager" },
      });
      const affiliateManagersData = response.data.data || [];
      setAffiliateManagers(affiliateManagersData);
    } catch (error) {
      console.error("Failed to load affiliate managers:", error);
      showAlert("Failed to load affiliate managers", "error");
    }
  };

  const loadTables = async () => {
    try {
      setTablesLoading(true);
      const params = {
        page: 1,
        limit: 100,
        period: selectedPeriod,
        date: selectedDate.format("YYYY-MM-DD"),
        month: selectedDate.month() + 1, // dayjs months are 0-indexed, so add 1
        year: selectedDate.year()
      };

      console.log('📅 Loading affiliate manager tables with params:', params);
      const response = await getAllAffiliateManagerTables(params);
      setTables(response.data || []);
    } catch (error) {
      console.error("Failed to load tables:", error);
      showAlert("Failed to load tables", "error");
    } finally {
      setTablesLoading(false);
    }
  };

  const loadSalaryConfigurations = async () => {
    try {
      setSalaryLoading(true);
      const [configsResponse, statsResponse] = await Promise.all([
        getAllSalaryConfigurations(),
        getSalaryStatistics(),
      ]);
      setSalaryConfigurations(configsResponse.data);
      setSalaryStats(statsResponse.data);
    } catch (error) {
      console.error("Failed to load salary configurations:", error);
      showAlert("Failed to load salary configurations", "error");
    } finally {
      setSalaryLoading(false);
    }
  };

  const loadCommissionData = async () => {
    try {
      setCommissionLoading(true);
      const commissionMap = {};

      for (const manager of affiliateManagers) {
        try {
          // Create date for selected month/year
          const selectedDate = new Date(selectedYear, selectedMonth - 1, 1);

          const tableResponse = await getAffiliateManagerTable(manager._id, {
            period: commissionPeriod,
            date: selectedDate.toISOString(),
            month: selectedMonth,
            year: selectedYear,
          });

          // Force refresh crypto values to ensure we get monthly data
          try {
            await refreshTotalMoneyFromCrypto(manager._id, {
              period: commissionPeriod,
              month: selectedMonth,
              year: selectedYear,
            });
          } catch (refreshError) {
            console.warn(`Failed to refresh crypto for manager ${manager.fullName}:`, refreshError);
          }

          // Get updated table data after refresh
          const updatedTableResponse = await getAffiliateManagerTable(manager._id, {
            period: commissionPeriod,
            date: selectedDate.toISOString(),
            month: selectedMonth,
            year: selectedYear,
          });

          const tableData = updatedTableResponse.data;
          const profit = tableData.calculatedTotals?.profit || 0;
          const totalMoney = tableData.totalMoney || 0;
          // Commission is 10% of the incoming crypto transactions for the selected period
          const commission = totalMoney * 0.1;

          commissionMap[manager._id] = {
            profit,
            commission,
            totalMoney,
            period: commissionPeriod,
            month: selectedMonth,
            year: selectedYear,
            tableData: tableData,
          };
        } catch (error) {
          console.error(
            `Failed to load table data for ${manager.fullName}:`,
            error
          );
          commissionMap[manager._id] = {
            profit: 0,
            commission: 0,
            totalMoney: 0,
            period: commissionPeriod,
            month: selectedMonth,
            year: selectedYear,
            tableData: null,
          };
        }
      }

      setCommissionData(commissionMap);
    } catch (error) {
      console.error("Failed to load commission data:", error);
      showAlert("Failed to load commission data", "error");
    } finally {
      setCommissionLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleRefreshAll = async () => {
    await loadInitialData();
    if (tabValue === 0) {
      await loadTables();
    }
    showAlert("All data refreshed successfully", "success");
  };

  const handleEditTable = (manager) => {
    setSelectedManager(manager);
    setShowTableEditor(true);
  };

  const handleCloseEditor = () => {
    setShowTableEditor(false);
    setSelectedManager(null);
    if (tabValue === 0) {
      loadTables();
    }
  };

  // Salary management functions
  const handleOpenSalaryForm = (user = null) => {
    if (user) {
      setEditingSalaryUser(user);
      const existingConfig = salaryConfigurations.find(
        (config) => config.user._id === user._id
      );
      if (existingConfig) {
        setSalaryFormData({
          userId: user._id,
          salaryType: existingConfig.salaryType,
          fixedSalary: existingConfig.fixedSalary || {
            amount: "",
            currency: "USD",
            paymentFrequency: "monthly",
          },
          notes: existingConfig.notes || "",
        });
      } else {
        setSalaryFormData({
          userId: user._id,
          salaryType: "fixed_monthly",
          fixedSalary: {
            amount: "",
            currency: "USD",
            paymentFrequency: "monthly",
          },
          notes: "",
        });
      }
    } else {
      setEditingSalaryUser(null);
      setSalaryFormData({
        userId: "",
        salaryType: "fixed_monthly",
        fixedSalary: {
          amount: "",
          currency: "USD",
          paymentFrequency: "monthly",
        },
        notes: "",
      });
    }
    setShowSalaryForm(true);
  };

  const handleCloseSalaryForm = () => {
    setShowSalaryForm(false);
    setEditingSalaryUser(null);
    setSalaryFormData({
      userId: "",
      salaryType: "fixed_monthly",
      fixedSalary: {
        amount: "",
        currency: "USD",
        paymentFrequency: "monthly",
      },
      notes: "",
    });
  };

  const handleCreateSalaryConfiguration = async () => {
    try {
      setProcessing(true);
      await createOrUpdateSalaryConfiguration(salaryFormData);
      showAlert("Salary configuration saved successfully", "success");
      handleCloseSalaryForm();
      await loadSalaryConfigurations();
    } catch (error) {
      console.error("Failed to save salary configuration:", error);
      showAlert("Failed to save salary configuration", "error");
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteSalaryConfiguration = async (userId) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this salary configuration?"
      )
    ) {
      return;
    }

    try {
      setProcessing(true);
      await deleteSalaryConfiguration(userId);
      showAlert("Salary configuration deleted successfully", "success");
      await loadSalaryConfigurations();
    } catch (error) {
      console.error("Failed to delete salary configuration:", error);
      showAlert("Failed to delete salary configuration", "error");
    } finally {
      setProcessing(false);
    }
  };

  const formatLargeCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  if (user?.role !== "admin") {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Access denied. Only administrators can access affiliate manager
          management.
        </Alert>
      </Box>
    );
  }

  const renderPerformanceTablesTab = () => (
    <Box>
      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Period</InputLabel>
                <Select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  label="Period"
                >
                  <MenuItem value="daily">Daily</MenuItem>
                  <MenuItem value="weekly">Weekly</MenuItem>
                  <MenuItem value="monthly">Monthly</MenuItem>
                  <MenuItem value="yearly">Yearly</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <MonthYearSelector
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                showCurrentSelection={false}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="body2" color="text.secondary">
                Showing {selectedPeriod} data for{" "}
                {selectedDate.format("MMMM YYYY")}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Tables List */}
      <Card>
        <CardHeader
          title={
            <Box display="flex" alignItems="center" gap={1}>
              <TableChartIcon />
              <Typography variant="h6">
                Performance Tables ({tables.length})
              </Typography>
            </Box>
          }
          action={
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadTables}
              disabled={tablesLoading}
            >
              Refresh
            </Button>
          }
        />
        <CardContent>
          {tablesLoading ? (
            <Box
              display="flex"
              justifyContent="center"
              alignItems="center"
              minHeight="200px"
            >
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Affiliate Manager</TableCell>
                    <TableCell>Period</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell align="right">Items</TableCell>
                    <TableCell align="right">Hyper Net</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tables.map((table) => (
                    <TableRow key={table._id} hover>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={2}>
                          <PersonIcon sx={{ color: "#666" }} />
                          <Box>
                            <Typography variant="body2" fontWeight="medium">
                              {table.affiliateManager.fullName}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {table.affiliateManager.email}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{ textTransform: "capitalize" }}
                        >
                          {table.period}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(table.date).toLocaleDateString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {table.tableData.length}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          sx={{ color: "#1976d2", fontWeight: "medium" }}
                        >
                          {formatCurrency(
                            table.tableData.find(
                              (row) => row.id === "hyper_net"
                            )?.value || 0
                          )}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<EditIcon />}
                          onClick={() =>
                            handleEditTable(table.affiliateManager)
                          }
                        >
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );

  const renderSummaryTab = () => {
    // Merge affiliate managers with their summary data
    const getMergedData = () => {
      return affiliateManagers.map((manager) => {
        const summary = summaryData.find((s) => s.managerId === manager._id) || {};
        return {
          ...manager,
          summary,
        };
      });
    };

    const mergedData = getMergedData();
    const filteredData = selectedSummaryManager
      ? mergedData.filter((item) => item._id === selectedSummaryManager)
      : mergedData;

    return (
      <Box>
        {/* Filters */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
              <Typography variant="h6" sx={{ mr: 2 }}>
                Filter:
              </Typography>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Affiliate Manager</InputLabel>
                <Select
                  value={selectedSummaryManager}
                  onChange={(e) => setSelectedSummaryManager(e.target.value)}
                  label="Affiliate Manager"
                >
                  <MenuItem value="">All Managers</MenuItem>
                  {affiliateManagers.map((manager) => (
                    <MenuItem key={manager._id} value={manager._id}>
                      {manager.fullName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Month</InputLabel>
                <Select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  label="Month"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <MenuItem key={i + 1} value={i + 1}>
                      {new Date(2024, i).toLocaleDateString("en-US", {
                        month: "long",
                      })}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 100 }}>
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
              <Button
                variant="outlined"
                startIcon={summaryLoading ? <CircularProgress size={20} /> : <RefreshIcon />}
                onClick={fetchSummaryData}
                disabled={summaryLoading}
              >
                {summaryLoading ? "Loading..." : "Refresh"}
              </Button>
            </Box>
          </CardContent>
        </Card>

        {/* Loading indicator */}
        {summaryLoading && (
          <Box display="flex" justifyContent="center" my={4}>
            <CircularProgress />
          </Box>
        )}

        {/* Summary Table */}
        {!summaryLoading && (
          <Card>
            <CardHeader
              title={
                <Box display="flex" alignItems="center" gap={1}>
                  <SummaryIcon />
                  <Typography variant="h6">
                    Affiliate Managers Summary ({new Date(selectedYear, selectedMonth - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })})
                  </Typography>
                </Box>
              }
            />
            <CardContent>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: "grey.100" }}>
                      <TableCell>Manager</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell align="right" sx={{ color: "success.main" }}>Money In</TableCell>
                      <TableCell align="right" sx={{ color: "error.main" }}>Expenses</TableCell>
                      <TableCell align="right" sx={{ color: "secondary.main" }}>Commissions</TableCell>
                      <TableCell align="right" sx={{ color: "warning.main" }}>Fixed Exp.</TableCell>
                      <TableCell align="center">FTDs</TableCell>
                      <TableCell align="center">Shaved</TableCell>
                      <TableCell align="center">Verified</TableCell>
                      <TableCell align="center">Fillers</TableCell>
                      <TableCell align="center">1st</TableCell>
                      <TableCell align="center">2nd</TableCell>
                      <TableCell align="center">3rd</TableCell>
                      <TableCell align="center">4th</TableCell>
                      <TableCell align="center">5th</TableCell>
                      <TableCell align="center">SIMs</TableCell>
                      <TableCell align="center">Data (GB)</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredData.map((manager) => {
                      const summary = manager.summary || {};
                      const hasSalaryConfig = salaryConfigurations.some(
                        (config) => config.user._id === manager._id
                      );

                      return (
                        <TableRow key={manager._id} hover>
                          <TableCell>
                            <Box display="flex" alignItems="center" gap={1}>
                              <Avatar sx={{ width: 32, height: 32, fontSize: 14 }}>
                                {manager.fullName?.charAt(0) || "A"}
                              </Avatar>
                              <Box>
                                <Typography variant="body2" fontWeight="medium">
                                  {manager.fullName}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {manager.email}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={manager.status || "pending"}
                              color={
                                manager.status === "approved"
                                  ? "success"
                                  : manager.status === "deactivated"
                                  ? "default"
                                  : manager.status === "deleted"
                                  ? "error"
                                  : "warning"
                              }
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {new Date(manager.createdAt).toLocaleDateString()}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight="medium" color="success.main">
                              {formatCurrency(summary.totalMoneyIn || 0)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight="medium" color="error.main">
                              {formatCurrency(summary.totalMoneyExpenses || 0)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight="medium" color="secondary.main">
                              {formatCurrency(summary.totalCommissionsAM || 0)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight="medium" color="warning.main">
                              {formatCurrency(summary.otherFixedExpenses || 0)}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Typography variant="body2" fontWeight="medium" color="primary">
                              {summary.totalFTDs || 0}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Typography variant="body2" color="error.main">
                              {summary.shavedFTDs || 0}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Typography variant="body2" color="success.main">
                              {summary.totalVerifiedFTDs || 0}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Typography variant="body2" color="info.main">
                              {summary.totalFillers || 0}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Typography variant="body2">{summary.firstCalls || 0}</Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Typography variant="body2">{summary.secondCalls || 0}</Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Typography variant="body2">{summary.thirdCalls || 0}</Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Typography variant="body2">{summary.fourthCalls || 0}</Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Typography variant="body2">{summary.fifthCalls || 0}</Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Typography variant="body2">{summary.totalSimCardUsed || 0}</Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Typography variant="body2">{summary.totalDataUsed || 0}</Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Stack direction="row" spacing={0.5} justifyContent="center">
                              <Tooltip title="Edit Performance Table">
                                <IconButton
                                  size="small"
                                  onClick={() => handleEditTable(manager)}
                                  color="primary"
                                >
                                  <TableChartIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Manage Salary">
                                <IconButton
                                  size="small"
                                  onClick={() => handleOpenSalaryForm(manager)}
                                  color="secondary"
                                >
                                  <SalaryIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
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

        {!summaryLoading && filteredData.length === 0 && (
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Box
                display="flex"
                justifyContent="center"
                alignItems="center"
                minHeight={200}
              >
                <Typography variant="body1" color="text.secondary">
                  No affiliate managers found. Please check if there are any affiliate managers in the system.
                </Typography>
              </Box>
            </CardContent>
          </Card>
        )}
      </Box>
    );
  };

  const renderSalaryCommissionsTab = () => (
    <Box>
      {/* Month/Year Selector */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
            <Typography variant="h6" sx={{ mr: 2 }}>
              Filter by Period:
            </Typography>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Month</InputLabel>
              <Select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                label="Month"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <MenuItem key={i + 1} value={i + 1}>
                    {new Date(2024, i).toLocaleDateString('en-US', { month: 'long' })}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 100 }}>
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
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Table Period</InputLabel>
              <Select
                value={commissionPeriod}
                onChange={(e) => setCommissionPeriod(e.target.value)}
                label="Table Period"
              >
                <MenuItem value="daily">Daily</MenuItem>
                <MenuItem value="weekly">Weekly</MenuItem>
                <MenuItem value="monthly">Monthly</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadCommissionData}
              disabled={commissionLoading}
            >
              Refresh
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Summary Statistics */}
      {salaryStats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={2}>
            <Paper sx={{ p: 2, textAlign: "center" }}>
              <Typography variant="h4" color="primary">
                {salaryStats.totalConfigurations}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Configurations
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={2}>
            <Paper sx={{ p: 2, textAlign: "center" }}>
              <Typography variant="h4" color="warning.main">
                {commissionLoading ? (
                  <CircularProgress size={24} />
                ) : (
                  formatLargeCurrency(
                    Object.values(commissionData).reduce(
                      (sum, data) => sum + data.totalMoney,
                      0
                    )
                  )
                )}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Crypto Transactions ({new Date(selectedYear, selectedMonth - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })})
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={2}>
            <Paper sx={{ p: 2, textAlign: "center" }}>
              <Typography variant="h4" color="secondary">
                {commissionLoading ? (
                  <CircularProgress size={24} />
                ) : (
                  formatLargeCurrency(
                    Object.values(commissionData).reduce(
                      (sum, data) => sum + data.commission,
                      0
                    )
                  )
                )}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Commission ({new Date(selectedYear, selectedMonth - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })})
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={2}>
            <Paper sx={{ p: 2, textAlign: "center" }}>
              <Typography variant="h4" color="success.main">
                {commissionLoading ? (
                  <CircularProgress size={24} />
                ) : (
                  formatLargeCurrency(
                    Object.values(commissionData).reduce(
                      (sum, data) => sum + data.profit,
                      0
                    )
                  )
                )}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Profit ({new Date(selectedYear, selectedMonth - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })})
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={2}>
            <Paper sx={{ p: 2, textAlign: "center" }}>
              <Typography variant="h4" color="info.main">
                {commissionLoading ? (
                  <CircularProgress size={24} />
                ) : (
                  formatLargeCurrency(
                    Object.values(commissionData).reduce(
                      (sum, data) => sum + data.commission,
                      0
                    ) +
                      salaryConfigurations.reduce(
                        (sum, config) =>
                          sum + (config.fixedSalary?.amount || 0),
                        0
                      )
                  )
                )}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Compensation ({new Date(selectedYear, selectedMonth - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })})
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Commission Info */}
      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2">
          <strong>Commission Calculation:</strong> Commission is calculated as 10% of the incoming crypto transactions for the selected month/year period.
          This ensures that commissions are based on actual revenue generated during the specific time period.
        </Typography>
      </Alert>

      {/* Salary Configurations Table */}
      <Card>
        <CardHeader
          title={
            <Box display="flex" alignItems="center" gap={1}>
              <SalaryIcon />
              <Typography variant="h6">Salary Configurations</Typography>
              <Chip
                label={`${salaryConfigurations.length} Configurations`}
                size="small"
                color="primary"
                variant="outlined"
              />
            </Box>
          }
          action={
            <Box display="flex" gap={2}>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Table Period</InputLabel>
                <Select
                  value={commissionPeriod}
                  onChange={(e) => setCommissionPeriod(e.target.value)}
                  label="Table Period"
                >
                  <MenuItem value="monthly">Monthly</MenuItem>
                  <MenuItem value="weekly">Weekly</MenuItem>
                  <MenuItem value="daily">Daily</MenuItem>
                </Select>
              </FormControl>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleOpenSalaryForm()}
                color="primary"
              >
                Add Salary Config
              </Button>
            </Box>
          }
        />
        <CardContent>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell align="center">Fixed Salary</TableCell>
                  <TableCell align="center">Crypto Transactions</TableCell>
                  <TableCell align="center">Commission (10% of Crypto)</TableCell>
                  <TableCell align="center">Total Compensation</TableCell>
                  <TableCell align="center">
                    Profit ({commissionPeriod})
                  </TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {salaryConfigurations.map((config) => {
                  const salaryData = config.fixedSalary;
                  const salaryDisplay = formatSalaryDisplay(
                    salaryData,
                    config.salaryType
                  );
                  const fixedSalary = salaryData?.amount || 0;

                  const commissionInfo = commissionData[config.user._id] || {
                    commission: 0,
                    profit: 0,
                    totalMoney: 0,
                  };
                  const commission = commissionInfo.commission;
                  const totalCompensation = fixedSalary + commission;

                  return (
                    <TableRow key={config._id} hover>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" fontWeight="bold">
                            {config.user.fullName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {config.user.email}
                          </Typography>
                          <Chip
                            label={config.user.role}
                            size="small"
                            color="default"
                            variant="outlined"
                            sx={{ ml: 1 }}
                          />
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Box>
                          <Typography
                            variant="body2"
                            fontWeight="bold"
                            color="primary"
                          >
                            {formatCurrency(fixedSalary)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {salaryDisplay?.secondary || "Monthly"}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Box>
                          <Typography
                            variant="body2"
                            fontWeight="bold"
                            color="warning.main"
                          >
                            {commissionLoading ? (
                              <CircularProgress size={16} />
                            ) : (
                              formatCurrency(commissionInfo.totalMoney)
                            )}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Crypto Transactions
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Box>
                          <Typography
                            variant="body2"
                            fontWeight="bold"
                            color="secondary"
                          >
                            {commissionLoading ? (
                              <CircularProgress size={16} />
                            ) : (
                              formatCurrency(commission)
                            )}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            10% of crypto
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Box>
                          <Typography
                            variant="body2"
                            fontWeight="bold"
                            color="success.main"
                          >
                            {commissionLoading ? (
                              <CircularProgress size={16} />
                            ) : (
                              formatCurrency(totalCompensation)
                            )}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Fixed + Commission
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Box>
                          <Typography variant="body2" fontWeight="bold">
                            {commissionLoading ? (
                              <CircularProgress size={16} />
                            ) : (
                              formatCurrency(commissionInfo.profit)
                            )}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Table Profit
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Box display="flex" gap={1} justifyContent="center">
                          <Tooltip title="Edit Configuration">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenSalaryForm(config.user)}
                              color="primary"
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete Configuration">
                            <IconButton
                              size="small"
                              onClick={() =>
                                handleDeleteSalaryConfiguration(config.user._id)
                              }
                              color="error"
                              disabled={processing}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
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
    </Box>
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ width: "100%", typography: "body1", backgroundColor: "#f5f5f5", minHeight: "100vh" }}>
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
                <PersonIcon sx={{ fontSize: 32 }} />
                <Typography variant="h4" component="h1">
                  Affiliate Manager Management
                </Typography>
              </Box>
            }
            action={
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={handleRefreshAll}
                size="large"
              >
                Refresh All
              </Button>
            }
          />
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              Centralized management for all affiliate manager operations
              including performance tables, salary configurations, and
              commission calculations.
            </Typography>
          </CardContent>
        </Card>

        {/* Navigation Tabs */}
        <Card sx={{ mb: 3 }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="affiliate manager tabs"
          >
            <Tab
              icon={<TableChartIcon />}
              label="Performance Tables"
              iconPosition="start"
            />
            <Tab
              icon={<SalaryIcon />}
              label="Salary & Commissions"
              iconPosition="start"
            />
            <Tab
              icon={<SummaryIcon />}
              label="Summary"
              iconPosition="start"
            />
          </Tabs>
        </Card>

        {/* Tab Content */}
        {tabValue === 0 && renderPerformanceTablesTab()}
        {tabValue === 1 && renderSalaryCommissionsTab()}
        {tabValue === 2 && renderSummaryTab()}

        {/* Table Editor Dialog */}
        <Dialog
          open={showTableEditor}
          onClose={handleCloseEditor}
          maxWidth="lg"
          fullWidth
          fullScreen
        >
          <DialogTitle>
            <Box
              display="flex"
              alignItems="center"
              justifyContent="space-between"
            >
              <Typography variant="h6">
                Edit Performance Table: {selectedManager?.fullName}
              </Typography>
              <IconButton onClick={handleCloseEditor} color="inherit">
                <CloseIcon />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent>
            {selectedManager && (
              <AffiliateManagerTableEditor
                affiliateManager={selectedManager}
                onClose={handleCloseEditor}
                selectedMonth={tabValue === 0 ? selectedDate.month() + 1 : selectedMonth}
                selectedYear={tabValue === 0 ? selectedDate.year() : selectedYear}
                commissionPeriod={tabValue === 0 ? selectedPeriod : commissionPeriod}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Salary Configuration Dialog */}
        <Dialog
          open={showSalaryForm}
          onClose={handleCloseSalaryForm}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Box display="flex" alignItems="center" gap={1}>
              <SalaryIcon />
              <Typography>
                {editingSalaryUser
                  ? "Edit Salary Configuration"
                  : "Create Salary Configuration"}
              </Typography>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Affiliate Manager</InputLabel>
                  <Select
                    value={salaryFormData.userId}
                    onChange={(e) =>
                      setSalaryFormData((prev) => ({
                        ...prev,
                        userId: e.target.value,
                      }))
                    }
                    label="Affiliate Manager"
                    disabled={!!editingSalaryUser}
                  >
                    {affiliateManagers.length === 0 ? (
                      <MenuItem disabled>
                        No affiliate managers available
                      </MenuItem>
                    ) : (
                      affiliateManagers.map((user) => (
                        <MenuItem key={user._id} value={user._id}>
                          {user.fullName} ({user.role})
                        </MenuItem>
                      ))
                    )}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Salary Type</InputLabel>
                  <Select
                    value={salaryFormData.salaryType}
                    onChange={(e) =>
                      setSalaryFormData((prev) => ({
                        ...prev,
                        salaryType: e.target.value,
                      }))
                    }
                    label="Salary Type"
                  >
                    <MenuItem value="fixed_monthly">Fixed Monthly</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {salaryFormData.salaryType === "fixed_monthly" && (
                <>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Monthly Amount"
                      type="number"
                      value={salaryFormData.fixedSalary.amount}
                      onChange={(e) =>
                        setSalaryFormData((prev) => ({
                          ...prev,
                          fixedSalary: {
                            ...prev.fixedSalary,
                            amount: e.target.value,
                          },
                        }))
                      }
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">$</InputAdornment>
                        ),
                      }}
                      inputProps={{ min: 0, step: 0.01 }}
                      required
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel>Payment Frequency</InputLabel>
                      <Select
                        value={salaryFormData.fixedSalary.paymentFrequency}
                        onChange={(e) =>
                          setSalaryFormData((prev) => ({
                            ...prev,
                            fixedSalary: {
                              ...prev.fixedSalary,
                              paymentFrequency: e.target.value,
                            },
                          }))
                        }
                        label="Payment Frequency"
                      >
                        <MenuItem value="weekly">Weekly</MenuItem>
                        <MenuItem value="bi_weekly">Bi-Weekly</MenuItem>
                        <MenuItem value="monthly">Monthly</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </>
              )}

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notes"
                  multiline
                  rows={3}
                  value={salaryFormData.notes}
                  onChange={(e) =>
                    setSalaryFormData((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                  placeholder="Additional notes about this salary configuration..."
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseSalaryForm} startIcon={<CancelIcon />}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateSalaryConfiguration}
              variant="contained"
              startIcon={<SaveIcon />}
              disabled={processing}
            >
              {processing ? "Saving..." : "Save Configuration"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default AffiliateManagersPage;
