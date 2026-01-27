import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Alert,
  CircularProgress,
  Tab,
  Tabs,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Stack,
  Button,
  Divider,
  useTheme,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  OutlinedInput,
  Checkbox,
  ListItemText,
  IconButton,
  Collapse,
  alpha,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
  AttachMoney as MoneyIcon,
  TrendingUp as TrendingUpIcon,
  AccessTime as AccessTimeIcon,
  Assessment as AssessmentIcon,
  Settings as SettingsIcon,
  AccountBalanceWallet as WithdrawIcon,
  FilterList as FilterListIcon,
  DateRange as DateRangeIcon,
  Clear as ClearIcon,
  Phone as PhoneIcon,
  Star as StarIcon,
  Warning as WarningIcon,
  People as PeopleIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  LocalAtm as LocalAtmIcon,
} from "@mui/icons-material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import { motion } from "framer-motion";
import { selectUser } from "../store/slices/authSlice";
import AgentPerformanceCard from "../components/AgentPerformanceCard";
import {
  getAgentBonusConfig,
  getAllAgentBonusConfigs,
  formatSalaryDisplay,
  getUserSalaryConfig,
  SALARY_TYPES,
} from "../services/payroll/calculations";
import {
  fetchAgentMetrics,
  fetchAgentEarningsHistory,
} from "../services/agents";
import {
  getAllSalaryConfigurations,
  getSalaryConfigurationByUser,
} from "../services/salaryConfiguration";
import { getAllAffiliateManagersWithMetrics } from "../services/affiliateManagerMetrics";
import { getAffiliateManagerTable } from "../services/affiliateManagerTable";
import AdminBonusManagement from "../components/AdminBonusManagement";
import WithdrawalModal from "../components/WithdrawalModal";
import AffiliateManagerWithdrawalModal from "../components/AffiliateManagerWithdrawalModal";
import AgentMonthlyHistory from "../components/AgentMonthlyHistory";
import AgentCallsTable from "../components/AgentCallsTable";
import { createWithdrawalRequest, getAgentWithdrawalsByMonth } from "../services/withdrawals";
import {
  getFormattedAgentCalls,
  getCurrentPeriod,
  formatMonthYear,
} from "../services/externalAgentCalls";
import {
  getAllAgentCallCounts,
  calculateBonusFromCallCounts,
} from "../services/agentCallCounts";
import { getAllAgentFines, getFinesSummary, getAgentFines, getPendingApprovalFines, respondToFine } from "../services/agentFines";
import FineDetailDialog from "../components/FineDetailDialog";
import CallBonusesSection from "../components/CallBonusesSection";
import api from "../services/api";

const PayrollPage = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const [tabValue, setTabValue] = useState(0);
  const [expanded, setExpanded] = useState("performance");
  const [refreshing, setRefreshing] = useState(false);
  const [bonusConfig, setBonusConfig] = useState(null);

  const [allAgentBonusConfigs, setAllAgentBonusConfigs] = useState([]);
  const [salaryConfigurations, setSalaryConfigurations] = useState([]);
  const [affiliateManagersData, setAffiliateManagersData] = useState([]);

  // Agent metrics data for withdrawal calculation
  const [agentMetricsData, setAgentMetricsData] = useState(null);

  // Agent earnings history data for date range
  const [agentEarningsHistory, setAgentEarningsHistory] = useState(null);
  const [historicalBonusConfig, setHistoricalBonusConfig] = useState(null);

  // Affiliate manager salary data
  const [affiliateManagerSalary, setAffiliateManagerSalary] = useState(null);
  const [affiliateManagerTableData, setAffiliateManagerTableData] =
    useState(null);
  const [salaryLoading, setSalaryLoading] = useState(false);

  // Withdrawal modal state
  const [withdrawalModalOpen, setWithdrawalModalOpen] = useState(false);
  const [hasPendingWithdrawal, setHasPendingWithdrawal] = useState(false);

  // Agent calls data state
  const [agentCallsData, setAgentCallsData] = useState([]);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [agentCallsLoading, setAgentCallsLoading] = useState(false);
  const [agentCallsStats, setAgentCallsStats] = useState(null);
  const [withdrawalLoading, setWithdrawalLoading] = useState(false);
  const [withdrawalAlert, setWithdrawalAlert] = useState({
    show: false,
    message: "",
    severity: "info",
  });

  // Agent bonuses and fines data state
  const [agentBonusesData, setAgentBonusesData] = useState([]);
  const [agentFinesData, setAgentFinesData] = useState([]);
  const [bonusesLoading, setBonusesLoading] = useState(false);
  const [finesLoading, setFinesLoading] = useState(false);
  const [bonusesStats, setBonusesStats] = useState(null);
  const [finesStats, setFinesStats] = useState(null);

  // Pending approval fines for agents
  const [pendingApprovalFines, setPendingApprovalFines] = useState([]);
  const [selectedFineDetail, setSelectedFineDetail] = useState(null);
  const [showFineDetailDialog, setShowFineDetailDialog] = useState(false);

  // Add loading states for individual data fetches
  const [bonusDataLoading, setBonusDataLoading] = useState(false);
  const [agentMetricsLoading, setAgentMetricsLoading] = useState(false);
  const [filterLoading, setFilterLoading] = useState(false);
  const [dataInitialized, setDataInitialized] = useState(false);

  // Calendar and filter state
  const [dateRange, setDateRange] = useState({
    startDate: dayjs().subtract(30, "day"),
    endDate: dayjs(),
  });

  // Agent month selection state
  const [selectedAgentMonth, setSelectedAgentMonth] = useState(() => {
    const currentDate = new Date();
    return `${currentDate.getFullYear()}-${String(
      currentDate.getMonth() + 1
    ).padStart(2, "0")}`;
  });

  // Removed old filter state - now using simplified approach

  // Removed old performance data fetching - now using simplified external API approach

  useEffect(() => {
    if (user && user.role === "admin") {
      loadAllAgentBonusConfigs();
      loadSalaryConfigurations();
      loadAffiliateManagersData();
    }
  }, [user]);

  // Updated useEffect for agent data loading with better dependency management
  useEffect(() => {
    if (
      user &&
      user.role === "agent" &&
      (user._id || user.id) &&
      !dataInitialized
    ) {
      console.log(
        "PayrollPage: Initializing agent data loading for:",
        user.fullName
      );
      setDataInitialized(true);

      // Load data sequentially to avoid race conditions
      const loadAgentData = async () => {
        try {
          // First load bonus data
          await fetchBonusData();
          // Then load agent metrics with fresh data
          await fetchAgentMetricsData(true);
          // Finally load initial date range data if dates are available
          if (dateRange.startDate && dateRange.endDate) {
            await fetchAgentEarningsForDateRange();
          }
        } catch (error) {
          console.error("Error loading agent data:", error);
        }
      };

      loadAgentData();
    }
  }, [user, dataInitialized]);

  useEffect(() => {
    if (user && user.role === "affiliate_manager") {
      fetchAffiliateManagerSalary();
    }
  }, [user]);

  // Initialize agent calls data for admin only
  useEffect(() => {
    if (user && user.role === "admin") {
      const currentPeriod = getCurrentPeriod();
      setSelectedPeriod(`${currentPeriod.year}-${currentPeriod.month}`);
      loadAvailableMonths();
    }
  }, [user]);

  // Initialize agent month selection
  useEffect(() => {
    if (user && user.role === "agent") {
      loadAvailableMonths();
    }
  }, [user]);

  // Load agent calls data when period changes (admin only)
  useEffect(() => {
    if (selectedPeriod && user?.role === "admin") {
      loadAgentCallsData();
      loadAgentBonusesData();
      loadAgentFinesData();
    }
  }, [selectedPeriod, user]);

  // Check for pending withdrawal for affiliate managers
  useEffect(() => {
    if (user?.role === "affiliate_manager") {
      const currentPeriod = getCurrentPeriod();
      const period = `${currentPeriod.year}-${currentPeriod.month}`;
      checkPendingWithdrawal(period);
    }
  }, [user]);

  // Load agent data when selected month changes
  useEffect(() => {
    if (selectedAgentMonth && user?.role === "agent") {
      loadAgentDataForMonth();
      checkPendingWithdrawal(selectedAgentMonth);
    }
  }, [selectedAgentMonth, user]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleAccordionChange = (panel) => (event, isExpanded) => {
    setExpanded(isExpanded ? panel : false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (user?.role === "agent") {
        await fetchBonusData();
        await fetchAgentMetricsData(true);
      } else if (user?.role === "admin") {
        await loadAllAgentBonusConfigs();
        await loadSalaryConfigurations();
        await loadAffiliateManagersData();
      } else if (user?.role === "affiliate_manager") {
        await fetchAffiliateManagerSalary();
      }
    } catch (error) {
      console.error("Failed to refresh data:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const loadAllAgentBonusConfigs = async () => {
    try {
      const configs = await getAllAgentBonusConfigs();
      setAllAgentBonusConfigs(configs);
    } catch (error) {
      console.error("Failed to load all agent bonus configurations:", error);
    }
  };

  // Removed old performance data loading - now using simplified agent calls approach

  const loadSalaryConfigurations = async () => {
    try {
      const response = await getAllSalaryConfigurations();
      setSalaryConfigurations(response.data);
    } catch (error) {
      console.error("Failed to load salary configurations:", error);
    }
  };

  const loadAffiliateManagersData = async () => {
    try {
      const response = await getAllAffiliateManagersWithMetrics({
        startDate: dateRange.startDate?.toDate(),
        endDate: dateRange.endDate?.toDate(),
      });
      setAffiliateManagersData(response.data);
    } catch (error) {
      console.error("Failed to load affiliate managers data:", error);
    }
  };

  const fetchBonusData = async () => {
    if (!user || user.role !== "agent") return;

    const agentId = user._id || user.id;
    if (!agentId) {
      console.warn("No agent ID available for bonus data fetch");
      return;
    }

    try {
      setBonusDataLoading(true);
      console.log("🔍 Fetching bonus data for agent:", agentId);

      const bonusConfig = await getAgentBonusConfig(agentId);
      console.log("💰 Bonus data fetched:", bonusConfig);

      setBonusConfig(bonusConfig);

      // Load earnings data for the current date range to ensure total earnings are calculated correctly
      if (dateRange.startDate && dateRange.endDate) {
        try {
          await fetchAgentEarningsForDateRange(bonusConfig);
        } catch (error) {
          console.error("Failed to load earnings data on initial load:", error);
        }
      }
    } catch (error) {
      console.error("Failed to fetch bonus data:", error);
      // Set default bonus config to prevent UI from breaking
      setBonusConfig({
        bonusRates: {
          firstCall: 5,
          secondCall: 10,
          thirdCall: 15,
          fourthCall: 20,
          fifthCall: 25,
          verifiedAcc: 50,
        },
        callCounts: {
          firstCalls: 0,
          secondCalls: 0,
          thirdCalls: 0,
          fourthCalls: 0,
          fifthCalls: 0,
          verifiedAccounts: 0,
        },
        totalPotentialBonus: 0,
        isDefault: true,
      });
    } finally {
      setBonusDataLoading(false);
    }
  };

  const checkPendingWithdrawal = async (monthString) => {
    if (!user || !monthString) return;
    
    try {
      const [year, month] = monthString.split('-').map(Number);
      console.log("Checking for pending withdrawal:", year, month);
      
      const response = await getAgentWithdrawalsByMonth(year, month);
      const pendingWithdrawal = response.data?.find(withdrawal => withdrawal.status === 'pending');
      setHasPendingWithdrawal(!!pendingWithdrawal);
      
      console.log("Has pending withdrawal:", !!pendingWithdrawal);
    } catch (error) {
      console.error("Error checking pending withdrawal:", error);
      setHasPendingWithdrawal(false);
    }
  };

  const fetchAgentMetricsData = async (
    forceRefresh = false,
    year = null,
    month = null
  ) => {
    if (!user || user.role !== "agent") return;

    const agentName = user.fullName || user.name || user.email;
    if (!agentName) {
      console.warn("No agent name available for metrics data fetch");
      return;
    }

    try {
      setAgentMetricsLoading(true);
      console.log(
        "🔍 Fetching agent metrics for call earnings calculation:",
        agentName,
        forceRefresh ? "(forced refresh)" : "",
        year && month ? `for period ${year}/${month}` : ""
      );

      // Use new API with specific period if provided
      let metricsData;
      if (year && month) {
        const { fetchAgentMetricsByPeriod } = await import(
          "../services/agents"
        );
        metricsData = await fetchAgentMetricsByPeriod(agentName, year, month);
      } else {
        metricsData = await fetchAgentMetrics(agentName, forceRefresh);
      }

      console.log("📊 Agent metrics data fetched:", metricsData);

      setAgentMetricsData(metricsData);
    } catch (error) {
      console.error("Failed to fetch agent metrics data:", error);

      // Check if it's a "no data" error vs a real API error
      if (error.message === "No data found for agent") {
        console.log(
          "ℹ️ No call data found for agent - this is normal for new agents"
        );
        // Create default metrics data but don't show it as an error
        const defaultMetricsData = {
          stats: {
            totalTalkPay: 0,
            incoming: 0,
            successful: 0,
            totalTalkTimeSeconds: 0,
            callCounts: {
              firstCalls: 0,
              secondCalls: 0,
              thirdCalls: 0,
              fourthCalls: 0,
              fifthCalls: 0,
              verifiedAccounts: 0,
            },
          },
        };
        setAgentMetricsData(defaultMetricsData);
        console.log(
          "✅ Using default metrics data - agent can still withdraw bonuses"
        );
      } else {
        // Real API error - still set default data but log as actual error
        console.error("❌ Real API error occurred:", error);
        const defaultMetricsData = {
          stats: {
            totalTalkPay: 0,
            incoming: 0,
            successful: 0,
            totalTalkTimeSeconds: 0,
            callCounts: {
              firstCalls: 0,
              secondCalls: 0,
              thirdCalls: 0,
              fourthCalls: 0,
              fifthCalls: 0,
              verifiedAccounts: 0,
            },
          },
        };
        setAgentMetricsData(defaultMetricsData);
      }
    } finally {
      setAgentMetricsLoading(false);
    }
  };

  // Generate months from January 2025 to current date
  const generateAvailableMonths = () => {
    const months = [];
    const startYear = 2025;
    const startMonth = 1; // January
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Generate months from current to January 2025 (newest first)
    for (let year = currentYear; year >= startYear; year--) {
      const endMonth = year === currentYear ? currentMonth : 12;
      const beginMonth = year === startYear ? startMonth : 1;

      for (let month = endMonth; month >= beginMonth; month--) {
        months.push({
          year,
          month,
          report_count: 0 // Default value since we're generating locally
        });
      }
    }

    return months;
  };

  // Agent calls functions
  const loadAvailableMonths = async () => {
    try {
      // Generate months locally from January 2025 to current date
      const generatedMonths = generateAvailableMonths();
      setAvailableMonths(generatedMonths);

      // If no current period selected and we have months, select the latest one
      if (!selectedPeriod && generatedMonths.length > 0) {
        const latestMonth = generatedMonths[0]; // Latest first
        setSelectedPeriod(`${latestMonth.year}-${latestMonth.month}`);
      }
    } catch (err) {
      console.error("Error loading available months:", err);
    }
  };

  const loadAgentCallsData = async () => {
    if (!selectedPeriod) return;

    setAgentCallsLoading(true);

    try {
      const [year, month] = selectedPeriod.split("-").map(Number);
      const response = await getFormattedAgentCalls(year, month);

      if (response.success) {
        setAgentCallsData(response.data);
        calculateAgentCallsStats(response.data);
      }
    } catch (err) {
      console.error("Error loading agent calls:", err);
      setAgentCallsData([]);
      setAgentCallsStats({
        totalAgents: 0,
        totalCalls: 0,
        totalIncoming: 0,
        totalOutgoing: 0,
        totalSuccessful: 0,
        totalTalkTimeSeconds: 0,
        avgSuccessRate: "0.0",
        avgCallsPerAgent: 0,
        totalTalkTime: "00:00:00",
      });
    } finally {
      setAgentCallsLoading(false);
    }
  };

  const calculateAgentCallsStats = (data) => {
    if (!data || data.length === 0) {
      setAgentCallsStats({
        totalAgents: 0,
        totalCalls: 0,
        totalIncoming: 0,
        totalOutgoing: 0,
        totalSuccessful: 0,
        totalTalkTimeSeconds: 0,
        avgSuccessRate: "0.0",
        avgCallsPerAgent: 0,
        totalTalkTime: "00:00:00",
      });
      return;
    }

    const parseTimeToSeconds = (timeStr) => {
      if (!timeStr || timeStr === "00:00:00") return 0;
      const [hours, minutes, seconds] = timeStr.split(":").map(Number);
      return hours * 3600 + minutes * 60 + seconds;
    };

    const formatSecondsToTime = (seconds) => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      return `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    const totalStats = data.reduce(
      (acc, agent) => ({
        totalAgents: acc.totalAgents + 1,
        totalCalls: acc.totalCalls + agent.totalCalls,
        totalIncoming: acc.totalIncoming + agent.incomingCalls,
        totalOutgoing: acc.totalOutgoing + agent.outgoingCalls,
        totalSuccessful: acc.totalSuccessful + agent.successfulCalls,
        totalTalkTimeSeconds:
          acc.totalTalkTimeSeconds + parseTimeToSeconds(agent.totalTalkTime),
      }),
      {
        totalAgents: 0,
        totalCalls: 0,
        totalIncoming: 0,
        totalOutgoing: 0,
        totalSuccessful: 0,
        totalTalkTimeSeconds: 0,
      }
    );

    const avgSuccessRate =
      totalStats.totalCalls > 0
        ? ((totalStats.totalSuccessful / totalStats.totalCalls) * 100).toFixed(
            1
          )
        : "0.0";

    const avgCallsPerAgent =
      totalStats.totalAgents > 0
        ? Math.round(totalStats.totalCalls / totalStats.totalAgents)
        : 0;

    setAgentCallsStats({
      ...totalStats,
      avgSuccessRate,
      avgCallsPerAgent,
      totalTalkTime: formatSecondsToTime(totalStats.totalTalkTimeSeconds),
    });
  };

  const loadAgentBonusesData = async () => {
    if (!selectedPeriod) return;

    setBonusesLoading(true);

    try {
      const [year, month] = selectedPeriod.split("-").map(Number);
      const response = await getAllAgentCallCounts(year, month);

      if (response.success) {
        setAgentBonusesData(response.data);
        calculateBonusesStats(response.data);
      }
    } catch (err) {
      console.error("Error loading agent bonuses:", err);
      setAgentBonusesData([]);
      setBonusesStats({
        totalAgents: 0,
        totalBonus: 0,
        totalFirstCalls: 0,
        totalSecondCalls: 0,
        totalThirdCalls: 0,
        totalFourthCalls: 0,
        totalFifthCalls: 0,
        totalVerifiedAccounts: 0,
        avgBonusPerAgent: "0.00",
      });
    } finally {
      setBonusesLoading(false);
    }
  };

  const loadAgentFinesData = async () => {
    if (!selectedPeriod) return;

    setFinesLoading(true);

    try {
      const [year, month] = selectedPeriod.split("-").map(Number);
      
      // Use the updated getAllAgentFines service with year/month filtering
      const response = await getAllAgentFines(year, month);
      setAgentFinesData(response);
      calculateFinesStats(response);
    } catch (err) {
      console.error("Error loading agent fines:", err);
      setAgentFinesData([]);
      setFinesStats({
        totalFines: 0,
        totalAmount: 0,
        activeFines: 0,
        activeAmount: 0,
        paidFines: 0,
        waivedFines: 0,
        disputedFines: 0,
        avgFineAmount: "0.00",
      });
    } finally {
      setFinesLoading(false);
    }
  };

  const calculateBonusesStats = (data) => {
    if (!data || data.length === 0) {
      setBonusesStats({
        totalAgents: 0,
        totalBonus: 0,
        totalFirstCalls: 0,
        totalSecondCalls: 0,
        totalThirdCalls: 0,
        totalFourthCalls: 0,
        totalFifthCalls: 0,
        totalVerifiedAccounts: 0,
        avgBonusPerAgent: "0.00",
      });
      return;
    }

    const totalStats = data.reduce(
      (acc, agent) => {
        const callCounts = agent.callCounts || {};
        const bonusRates = agent.bonusRates || {
          firstCall: 5.0,
          secondCall: 10.0,
          thirdCall: 15.0,
          fourthCall: 20.0,
          fifthCall: 25.0,
          verifiedAcc: 50.0,
        };

        const totalBonus = calculateBonusFromCallCounts(callCounts, bonusRates);

        return {
          totalAgents: acc.totalAgents + 1,
          totalBonus: acc.totalBonus + totalBonus,
          totalFirstCalls: acc.totalFirstCalls + (callCounts.firstCalls || 0),
          totalSecondCalls:
            acc.totalSecondCalls + (callCounts.secondCalls || 0),
          totalThirdCalls: acc.totalThirdCalls + (callCounts.thirdCalls || 0),
          totalFourthCalls:
            acc.totalFourthCalls + (callCounts.fourthCalls || 0),
          totalFifthCalls: acc.totalFifthCalls + (callCounts.fifthCalls || 0),
          totalVerifiedAccounts:
            acc.totalVerifiedAccounts + (callCounts.verifiedAccounts || 0),
        };
      },
      {
        totalAgents: 0,
        totalBonus: 0,
        totalFirstCalls: 0,
        totalSecondCalls: 0,
        totalThirdCalls: 0,
        totalFourthCalls: 0,
        totalFifthCalls: 0,
        totalVerifiedAccounts: 0,
      }
    );

    const avgBonusPerAgent =
      totalStats.totalAgents > 0
        ? (totalStats.totalBonus / totalStats.totalAgents).toFixed(2)
        : "0.00";

    setBonusesStats({
      ...totalStats,
      avgBonusPerAgent,
    });
  };

  const calculateFinesStats = (data) => {
    if (!data || data.length === 0) {
      setFinesStats({
        totalFines: 0,
        totalAmount: 0,
        activeFines: 0,
        activeAmount: 0,
        paidFines: 0,
        waivedFines: 0,
        disputedFines: 0,
        avgFineAmount: "0.00",
      });
      return;
    }

    const totalStats = data.reduce(
      (acc, fine) => {
        // Active fines are those approved or admin_approved (include 'active' for backward compatibility)
        const isActive = ['approved', 'admin_approved', 'active'].includes(fine.status);
        const isPending = fine.status === 'pending_approval';
        return {
          totalFines: acc.totalFines + 1,
          totalAmount: acc.totalAmount + fine.amount,
          activeFines: acc.activeFines + (isActive ? 1 : 0),
          activeAmount: acc.activeAmount + (isActive ? fine.amount : 0),
          paidFines: acc.paidFines + (fine.status === "paid" ? 1 : 0),
          waivedFines: acc.waivedFines + (fine.status === "waived" ? 1 : 0),
          disputedFines:
            acc.disputedFines + (fine.status === "disputed" ? 1 : 0),
          pendingFines: (acc.pendingFines || 0) + (isPending ? 1 : 0),
        };
      },
      {
        totalFines: 0,
        totalAmount: 0,
        activeFines: 0,
        activeAmount: 0,
        paidFines: 0,
        waivedFines: 0,
        disputedFines: 0,
      }
    );

    const avgFineAmount =
      totalStats.totalFines > 0
        ? (totalStats.totalAmount / totalStats.totalFines).toFixed(2)
        : "0.00";

    setFinesStats({
      ...totalStats,
      avgFineAmount,
    });
  };

  const calculateTotalPayableStats = () => {
    if (!agentCallsStats || !bonusesStats || !finesStats) {
      return null;
    }

    // Calculate total talk time pay
    const parseTimeToSeconds = (timeStr) => {
      if (!timeStr || timeStr === "00:00:00") return 0;
      const [hours, minutes, seconds] = timeStr.split(":").map(Number);
      return hours * 3600 + minutes * 60 + seconds;
    };

    const totalTalkTimeSeconds = parseTimeToSeconds(
      agentCallsStats.totalTalkTime
    );
    const ratePerSecond = 0.00278; // $0.00278 per second
    const totalTalkTimePay = totalTalkTimeSeconds * ratePerSecond;

    // Calculate total payable
    const totalPayable =
      totalTalkTimePay + bonusesStats.totalBonus - finesStats.activeAmount;
    const avgPayablePerAgent =
      agentCallsStats.totalAgents > 0
        ? (totalPayable / agentCallsStats.totalAgents).toFixed(2)
        : "0.00";

    return {
      totalTalkTimePay: totalTalkTimePay.toFixed(2),
      totalPayable: totalPayable.toFixed(2),
      avgPayablePerAgent,
    };
  };

  const formatCurrency = (value) => {
    return `$${Number(value || 0).toFixed(2)}`;
  };

  const handlePeriodChange = (event) => {
    setSelectedPeriod(event.target.value);
  };

  const handleAgentMonthChange = (event) => {
    setSelectedAgentMonth(event.target.value);
  };

  const loadAgentDataForMonth = async () => {
    if (!selectedAgentMonth) return;

    try {
      const [year, month] = selectedAgentMonth.split("-").map(Number);

      // Load agent calls data for the selected month
      const callsResponse = await getFormattedAgentCalls(year, month);
      if (callsResponse.success) {
        // Filter to show only the current agent's data
        const agentData = callsResponse.data.filter(
          (agent) => agent.agentName === user.fullName
        );
        setAgentCallsData(agentData);
        calculateAgentCallsStats(agentData);
      }

      // Load agent bonuses data for the selected month
      const bonusesResponse = await getAllAgentCallCounts(year, month);
      if (bonusesResponse.success) {
        // Filter to show only the current agent's data
        const agentBonuses = bonusesResponse.data.filter(
          (bonus) => bonus.agent.fullName === user.fullName
        );
        setAgentBonusesData(agentBonuses);
        calculateBonusesStats(agentBonuses);
      }

      // Load agent fines data for the selected month
      const agentFines = await getAgentFines(user.id, false, year, month);
      setAgentFinesData(agentFines);
      calculateFinesStats(agentFines);

      // Load pending approval fines for agent
      try {
        const pendingFines = await getPendingApprovalFines();
        setPendingApprovalFines(pendingFines);
      } catch (e) {
        console.error("Error loading pending fines:", e);
        setPendingApprovalFines([]);
      }
    } catch (err) {
      console.error("Error loading agent data for month:", err);
    }
  };

  // Handle fine detail dialog
  const handleViewFineDetail = (fine) => {
    setSelectedFineDetail(fine);
    setShowFineDetailDialog(true);
  };

  const handleFineUpdated = (updatedFine) => {
    // Refresh fines data
    if (selectedAgentMonth) {
      loadAgentDataForMonth();
    }
  };

  const fetchAffiliateManagerSalary = async () => {
    if (!user || user.role !== "affiliate_manager") return;

    try {
      setSalaryLoading(true);
      const userId = user._id || user.id;
      console.log("💰 Fetching affiliate manager salary for:", userId);

      // Fetch both salary configuration and table data
      const [salaryConfig, tableData] = await Promise.all([
        getSalaryConfigurationByUser(userId).catch((err) => {
          if (err.response?.status === 404) {
            return { data: null }; // No salary config found
          }
          throw err;
        }),
        getAffiliateManagerTable(userId, {
          period: "monthly",
          date: new Date().toISOString(),
        }).catch((err) => {
          console.error("Failed to fetch affiliate manager table:", err);
          return { data: null }; // No table data found
        }),
      ]);

      console.log("📋 Salary configuration fetched:", salaryConfig);
      console.log("📊 Table data fetched:", tableData);

      setAffiliateManagerSalary(salaryConfig.data);
      setAffiliateManagerTableData(tableData.data);
    } catch (error) {
      console.error("Failed to fetch affiliate manager salary:", error);
      setWithdrawalAlert({
        show: true,
        message: "Failed to load salary information",
        severity: "warning",
      });
    } finally {
      setSalaryLoading(false);
    }
  };

  const setDateRangeAndLoad = (startDate, endDate) => {
    setDateRange({ startDate, endDate });
    // Auto-load data after a short delay to allow state update
    setTimeout(() => fetchAgentEarningsForDateRange(), 100);
  };

  const fetchAgentEarningsForDateRange = async (providedBonusConfig = null) => {
    if (
      !user ||
      user.role !== "agent" ||
      !dateRange.startDate ||
      !dateRange.endDate
    )
      return;

    const agentId = user._id || user.id;
    if (!agentId) {
      console.warn("No agent ID available for earnings history fetch");
      return;
    }

    try {
      setFilterLoading(true);
      const startDate = dateRange.startDate.format("YYYY-MM-DD");
      const endDate = dateRange.endDate.format("YYYY-MM-DD");

      console.log("📊 Date range selected for agent earnings:", {
        agentId,
        startDate,
        endDate,
      });

      // Instead of using the legacy API that has parsing errors,
      // we'll use the current agent metrics data and show a message
      // that historical range data is not available with the new API
      console.log(
        "ℹ️ Using current agent metrics data instead of legacy range API"
      );

      // Use existing agent metrics data if available
      const currentMetrics = agentMetricsData;

      // Since the new external API provides more accurate data per period,
      // we'll use the current metrics data instead of trying to aggregate ranges
      const currentBonusConfig = providedBonusConfig || bonusConfig;

      if (currentMetrics && currentBonusConfig) {
        // Use the current period's data as historical data for the selected range
        setHistoricalBonusConfig({
          ...currentBonusConfig,
          callCounts: currentBonusConfig.callCounts || {
            firstCalls: 0,
            secondCalls: 0,
            thirdCalls: 0,
            fourthCalls: 0,
            fifthCalls: 0,
            verifiedAccounts: 0,
          },
        });

        // Set a simple history array with current data
        setAgentEarningsHistory([
          {
            date: dateRange.startDate.format("YYYY-MM-DD"),
            callCounts: currentBonusConfig.callCounts || {},
            earnings: currentBonusConfig.totalPotentialBonus || 0,
          },
        ]);

        console.log("✅ Using current metrics data for date range display");
      } else {
        console.log("⚠️ No current metrics available for date range display");
        setHistoricalBonusConfig(null);
        setAgentEarningsHistory([]);
      }
    } catch (error) {
      console.error("Failed to fetch agent earnings history:", error);
      setWithdrawalAlert({
        show: true,
        message: "Failed to load earnings history. Please try again.",
        severity: "error",
      });
    } finally {
      setFilterLoading(false);
    }
  };

  const handleWithdrawalRequest = async (withdrawalData) => {
    setWithdrawalLoading(true);
    try {
      const response = await createWithdrawalRequest(withdrawalData);
      console.log("Withdrawal request created:", response);

      setWithdrawalAlert({
        show: true,
        message:
          "Withdrawal request submitted successfully! You will be notified when it is processed.",
        severity: "success",
      });

      // Auto-hide alert after 5 seconds
      setTimeout(() => {
        setWithdrawalAlert({ show: false, message: "", severity: "info" });
      }, 5000);

      return response;
    } catch (error) {
      console.error("Failed to create withdrawal request:", error);
      const errorMessage =
        error.message ||
        "Failed to submit withdrawal request. Please try again.";

      setWithdrawalAlert({
        show: true,
        message: errorMessage,
        severity: "error",
      });

      // Auto-hide alert after 5 seconds
      setTimeout(() => {
        setWithdrawalAlert({ show: false, message: "", severity: "info" });
      }, 5000);

      throw error;
    } finally {
      setWithdrawalLoading(false);
    }
  };

  // Calculate available earnings for withdrawal (for agents)
  const calculateAvailableEarnings = () => {
    if (!user || user.role !== "agent") {
      return 0;
    }

    // Use the correct calculations from agent calls and bonuses data
    let basePay = 0;
    let bonuses = 0;
    let fines = 0;

    // Calculate talk time pay from agent calls data
    if (agentCallsData && agentCallsData.length > 0) {
      const agentData = agentCallsData[0];
      if (agentData?.totalTalkTime) {
        const parseTimeToSeconds = (timeStr) => {
          if (!timeStr || timeStr === "00:00:00") return 0;
          const [hours, minutes, seconds] = timeStr.split(":").map(Number);
          return hours * 3600 + minutes * 60 + seconds;
        };

        const totalSeconds = parseTimeToSeconds(agentData.totalTalkTime);
        const ratePerSecond = 0.00278; // $0.00278 per second
        basePay = totalSeconds * ratePerSecond;
      }
    }

    // Calculate bonuses from agent bonuses data
    if (agentBonusesData && agentBonusesData.length > 0) {
      const agentBonus = agentBonusesData[0];
      if (agentBonus?.callCounts && agentBonus?.bonusRates) {
        const callCounts = agentBonus.callCounts;
        const bonusRates = agentBonus.bonusRates;

        bonuses =
          (callCounts.firstCalls || 0) * (bonusRates.firstCall || 5) +
          (callCounts.secondCalls || 0) * (bonusRates.secondCall || 10) +
          (callCounts.thirdCalls || 0) * (bonusRates.thirdCall || 15) +
          (callCounts.fourthCalls || 0) * (bonusRates.fourthCall || 20) +
          (callCounts.fifthCalls || 0) * (bonusRates.fifthCall || 25) +
          (callCounts.verifiedAccounts || 0) * (bonusRates.verifiedAcc || 50);
      }
    }

    // Calculate fines from agent fines data (only approved/admin_approved count as deductions)
    if (agentFinesData && agentFinesData.length > 0) {
      fines = agentFinesData.reduce((total, fine) => {
        const isActive = ['approved', 'admin_approved', 'active'].includes(fine.status);
        return total + (isActive ? fine.amount : 0);
      }, 0);
    }

    const grossEarnings = basePay + bonuses - fines;
    return Math.max(0, grossEarnings); // Ensure we don't return negative values
  };

  const handleAffiliateManagerWithdrawalRequest = async (withdrawalData) => {
    setWithdrawalLoading(true);
    try {
      // Calculate the total compensation for affiliate manager
      const fixedSalary = Number(
        affiliateManagerSalary.fixedSalary?.amount || 0
      );
      const commission =
        affiliateManagerTableData.calculatedTotals.profit * 0.1;
      const totalCompensation = fixedSalary + commission;

      const affiliateManagerWithdrawalData = {
        ...withdrawalData,
        amount: totalCompensation,
        userType: "affiliate_manager", // Add user type to distinguish from agent withdrawals
        breakdown: {
          fixedSalary: fixedSalary,
          commission: commission,
          tableProfit: affiliateManagerTableData.calculatedTotals.profit,
          fines: 0, // Affiliate managers don't have fines like agents
        },
      };

      const response = await createWithdrawalRequest(
        affiliateManagerWithdrawalData
      );
      console.log("Affiliate manager withdrawal request created:", response);

      setWithdrawalAlert({
        show: true,
        message:
          "Withdrawal request submitted successfully! You will be notified when it is processed.",
        severity: "success",
      });

      // Auto-hide alert after 5 seconds
      setTimeout(() => {
        setWithdrawalAlert({ show: false, message: "", severity: "info" });
      }, 5000);

      return response;
    } catch (error) {
      console.error(
        "Failed to create affiliate manager withdrawal request:",
        error
      );
      const errorMessage =
        error.message ||
        "Failed to submit withdrawal request. Please try again.";

      setWithdrawalAlert({
        show: true,
        message: errorMessage,
        severity: "error",
      });

      // Auto-hide alert after 5 seconds
      setTimeout(() => {
        setWithdrawalAlert({ show: false, message: "", severity: "info" });
      }, 5000);

      throw error;
    } finally {
      setWithdrawalLoading(false);
    }
  };

  const handleWithdrawalModalClose = () => {
    if (!withdrawalLoading) {
      setWithdrawalModalOpen(false);
      
      // Re-check pending withdrawal status after modal closes
      if (user?.role === "agent" && selectedAgentMonth) {
        checkPendingWithdrawal(selectedAgentMonth);
      } else if (user?.role === "affiliate_manager" && selectedPeriod) {
        checkPendingWithdrawal(selectedPeriod);
      }
    }
  };

  // Filter and date range handlers
  const handleDateRangeChange = (field, value) => {
    setDateRange((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Removed old filter functions - no longer needed

  // Removed old filtering logic - now using simplified agent calls data

  // Removed old filtering logic - now using agent calls data directly

  // Reload data when date range changes (for admin users)
  useEffect(() => {
    if (user && user.role === "admin") {
      loadAffiliateManagersData();
    }
  }, [dateRange.startDate, dateRange.endDate]);

  // Add loading indicator while initial data is being fetched
  if (
    user?.role === "agent" &&
    (bonusDataLoading || agentMetricsLoading) &&
    !bonusConfig
  ) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "60vh",
        }}
      >
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (!user) {
    return <Alert severity="error">User not found. Please log in again.</Alert>;
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ width: "100%", typography: "body1", px: { xs: 1, sm: 2, md: 0 }, py: { xs: 1, sm: 2 } }}>
        {/* Withdrawal Alert */}
        {withdrawalAlert.show && (
          <Alert severity={withdrawalAlert.severity} sx={{ mb: { xs: 1, sm: 2 }, fontSize: { xs: '0.875rem', sm: '1rem' } }}>
            {withdrawalAlert.message}
          </Alert>
        )}

        {/* Affiliate Manager Salary View */}
        {user?.role === "affiliate_manager" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card sx={{ mb: { xs: 2, sm: 3 } }}>
              <CardHeader
                title={
                  <Box display="flex" alignItems="center" gap={1}>
                    <MoneyIcon sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }} />
                    <Typography variant="h6" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>My Total Compensation</Typography>
                  </Box>
                }
                action={
                  <Button
                    variant="outlined"
                    startIcon={<RefreshIcon sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }} />}
                    onClick={handleRefresh}
                    disabled={refreshing || salaryLoading}
                    size="small"
                    sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' }, px: { xs: 1, sm: 2 } }}
                  >
                    <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                      {refreshing ? "Refreshing..." : "Refresh"}
                    </Box>
                    <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                      {refreshing ? "..." : "↻"}
                    </Box>
                  </Button>
                }
                sx={{ pb: { xs: 1, sm: 2 } }}
              />
              <CardContent>
                {salaryLoading ? (
                  <Box display="flex" justifyContent="center" py={4}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <Grid container spacing={{ xs: 2, sm: 3 }}>
                    {/* Fixed Salary Section */}
                    <Grid item xs={12} sm={6} md={4}>
                      <Paper
                        sx={{
                          p: { xs: 2, sm: 3 },
                          textAlign: "center",
                          backgroundColor: "#e3f2fd",
                        }}
                      >
                        <Typography variant="h6" color="primary" gutterBottom sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                          Fixed Salary
                        </Typography>
                        {affiliateManagerSalary &&
                        affiliateManagerSalary.fixedSalary ? (
                          <Box>
                            <Typography
                              variant="h4"
                              color="primary"
                              fontWeight="bold"
                              sx={{ fontSize: { xs: '1.75rem', sm: '2.125rem' } }}
                            >
                              $
                              {Number(
                                affiliateManagerSalary.fixedSalary.amount
                              ).toFixed(2)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                              {
                                affiliateManagerSalary.fixedSalary
                                  .paymentFrequency
                              }{" "}
                              payment
                            </Typography>
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                            No fixed salary configured
                          </Typography>
                        )}
                      </Paper>
                    </Grid>

                    {/* Commission Section */}
                    <Grid item xs={12} sm={6} md={4}>
                      <Paper
                        sx={{
                          p: { xs: 2, sm: 3 },
                          textAlign: "center",
                          backgroundColor: "#e8f5e8",
                        }}
                      >
                        <Typography
                          variant="h6"
                          color="success.main"
                          gutterBottom
                          sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}
                        >
                          Commission (10%)
                        </Typography>
                        {affiliateManagerTableData ? (
                          <Box>
                            <Typography
                              variant="h4"
                              color="success.main"
                              fontWeight="bold"
                              sx={{ fontSize: { xs: '1.75rem', sm: '2.125rem' } }}
                            >
                              $
                              {(
                                affiliateManagerTableData.calculatedTotals
                                  .profit * 0.1
                              ).toFixed(2)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                              10% of table profit
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              display="block"
                              sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}
                            >
                              Profit: $
                              {affiliateManagerTableData.calculatedTotals.profit.toFixed(
                                2
                              )}
                            </Typography>
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                            No table data available
                          </Typography>
                        )}
                      </Paper>
                    </Grid>

                    {/* Total Compensation Section */}
                    <Grid item xs={12} md={4}>
                      <Paper
                        sx={{
                          p: { xs: 2, sm: 3 },
                          textAlign: "center",
                          backgroundColor: "#f3e5f5",
                          border: "2px solid #9c27b0",
                        }}
                      >
                        <Typography variant="h6" color="secondary" gutterBottom sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                          Total Compensation
                        </Typography>
                        {affiliateManagerSalary && affiliateManagerTableData ? (
                          <Box>
                            <Typography
                              variant="h4"
                              color="secondary"
                              fontWeight="bold"
                              sx={{ fontSize: { xs: '1.75rem', sm: '2.125rem' } }}
                            >
                              $
                              {(
                                Number(
                                  affiliateManagerSalary.fixedSalary?.amount ||
                                    0
                                ) +
                                affiliateManagerTableData.calculatedTotals
                                  .profit *
                                  0.1
                              ).toFixed(2)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                              Fixed + Commission
                            </Typography>
                            <Button
                              variant="contained"
                              color="secondary"
                              startIcon={<WithdrawIcon sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }} />}
                              onClick={() => setWithdrawalModalOpen(true)}
                              sx={{ mt: { xs: 1.5, sm: 2 }, fontSize: { xs: '0.75rem', sm: '0.875rem' }, px: { xs: 2, sm: 3 } }}
                              disabled={
                                hasPendingWithdrawal ||
                                !affiliateManagerSalary ||
                                !affiliateManagerTableData ||
                                Number(
                                  affiliateManagerSalary.fixedSalary?.amount ||
                                    0
                                ) +
                                  affiliateManagerTableData.calculatedTotals
                                    .profit *
                                    0.1 <=
                                  0
                              }
                            >
                              Withdraw
                            </Button>
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                            Calculation not available
                          </Typography>
                        )}
                      </Paper>
                    </Grid>

                    {/* Notes Section */}
                    {affiliateManagerSalary?.notes && (
                      <Grid item xs={12}>
                        <Paper sx={{ p: { xs: 1.5, sm: 2 }, backgroundColor: "grey.50" }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Notes:
                          </Typography>
                          <Typography variant="body2">
                            {affiliateManagerSalary.notes}
                          </Typography>
                        </Paper>
                      </Grid>
                    )}

                    {/* Missing Data Alerts */}
                    {!affiliateManagerSalary && (
                      <Grid item xs={12}>
                        <Alert severity="warning" sx={{ textAlign: "center" }}>
                          <Typography variant="body1">
                            No salary configuration found. Please contact your
                            administrator to set up your fixed salary.
                          </Typography>
                        </Alert>
                      </Grid>
                    )}

                    {!affiliateManagerTableData && (
                      <Grid item xs={12}>
                        <Alert severity="info" sx={{ textAlign: "center" }}>
                          <Typography variant="body1">
                            No table data found for commission calculation.
                            Commission will be calculated based on your
                            affiliate table performance.
                          </Typography>
                        </Alert>
                      </Grid>
                    )}
                  </Grid>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Tabs Section - For Admins and Affiliate Managers only */}
        {user?.role && user.role !== "agent" && (
          <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              aria-label="payroll tabs"
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              sx={{
                '& .MuiTab-root': {
                  minWidth: { xs: 100, sm: 160 },
                  fontSize: { xs: '0.75rem', sm: '0.875rem' }
                }
              }}
            >
              {user.role === "admin" && (
                <Tab icon={<PhoneIcon />} label="Agent Calls" />
              )}
              {(user.role === "admin" || user.role === "affiliate_manager") && (
                <Tab icon={<PhoneIcon />} label="Call Bonuses" />
              )}
              {(user.role === "admin" || user.role === "affiliate_manager") && (
                <Tab icon={<SettingsIcon />} label="Bonus Management" />
              )}
            </Tabs>
          </Box>
        )}

        {/* Header Section - Only for Agents and Admins */}
        {user?.role !== "affiliate_manager" && (
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: { xs: 'flex-start', sm: 'center' },
              flexDirection: { xs: 'column', sm: 'row' },
              gap: { xs: 2, sm: 0 },
              mb: 3,
            }}
          >
            <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: '1.5rem', sm: '2rem' } }}>
              {user.role === "admin"
                ? "All Agents Payroll"
                : user.role === "agent"
                ? "My Earnings"
                : "Payroll Dashboard"}
            </Typography>
            <Stack direction="row" spacing={{ xs: 1, sm: 2 }}>
              {/* Filter button removed - no longer needed */}
              <Button
                variant="outlined"
                startIcon={<RefreshIcon sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }} />}
                onClick={handleRefresh}
                disabled={refreshing}
                sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' }, px: { xs: 1.5, sm: 2 } }}
              >
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                  {refreshing ? "Refreshing..." : "Refresh"}
                </Box>
                <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                  {refreshing ? "..." : "↻"}
                </Box>
              </Button>
            </Stack>
          </Box>
        )}

        {/* Filter section removed - no longer needed */}
        {false && (
          <Card sx={{ mb: 3 }}>
            <CardHeader
              title="Filters & Period Selection"
              action={
                <Button
                  startIcon={<ClearIcon />}
                  onClick={clearFilters}
                  size="small"
                >
                  Clear All
                </Button>
              }
            />
            <CardContent>
              <Grid container spacing={{ xs: 2, sm: 3 }}>
                {/* Date Range Selection */}
                <Grid item xs={12} md={6}>
                  <Typography
                    variant="h6"
                    gutterBottom
                    sx={{ display: "flex", alignItems: "center", gap: 1 }}
                  >
                    <DateRangeIcon />
                    Period Selection
                  </Typography>
                  <Stack direction="row" spacing={2}>
                    <DatePicker
                      label="Start Date"
                      value={dateRange.startDate}
                      onChange={(value) =>
                        handleDateRangeChange("startDate", value)
                      }
                      slotProps={{
                        textField: {
                          size: "small",
                          fullWidth: true,
                        },
                      }}
                    />
                    <DatePicker
                      label="End Date"
                      value={dateRange.endDate}
                      onChange={(value) =>
                        handleDateRangeChange("endDate", value)
                      }
                      slotProps={{
                        textField: {
                          size: "small",
                          fullWidth: true,
                        },
                      }}
                    />
                  </Stack>
                </Grid>

                {/* Agent Selection */}
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom>
                    Agent Selection
                  </Typography>
                  <FormControl fullWidth size="small">
                    <InputLabel>Select Agents</InputLabel>
                    <Select
                      multiple
                      value={filters.selectedAgents}
                      onChange={(e) =>
                        handleFilterChange("selectedAgents", e.target.value)
                      }
                      input={<OutlinedInput label="Select Agents" />}
                      renderValue={(selected) => selected.join(", ")}
                    >
                      {allAgentsData.map((agent) => (
                        <MenuItem key={agent.id} value={agent.fullName}>
                          <Checkbox
                            checked={
                              filters.selectedAgents.indexOf(agent.fullName) >
                              -1
                            }
                          />
                          <ListItemText primary={agent.fullName} />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {/* Performance Filters */}
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    Performance Filters
                  </Typography>
                  <Grid container spacing={{ xs: 1, sm: 2 }}>
                    <Grid item xs={6} sm={3}>
                      <TextField
                        label="Min Success Rate (%)"
                        type="number"
                        size="small"
                        fullWidth
                        value={filters.minSuccessRate}
                        onChange={(e) =>
                          handleFilterChange("minSuccessRate", e.target.value)
                        }
                        inputProps={{ min: 0, max: 100 }}
                      />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <TextField
                        label="Max Success Rate (%)"
                        type="number"
                        size="small"
                        fullWidth
                        value={filters.maxSuccessRate}
                        onChange={(e) =>
                          handleFilterChange("maxSuccessRate", e.target.value)
                        }
                        inputProps={{ min: 0, max: 100 }}
                      />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <TextField
                        label="Min Total Calls"
                        type="number"
                        size="small"
                        fullWidth
                        value={filters.minTotalCalls}
                        onChange={(e) =>
                          handleFilterChange("minTotalCalls", e.target.value)
                        }
                        inputProps={{ min: 0 }}
                      />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <TextField
                        label="Max Total Calls"
                        type="number"
                        size="small"
                        fullWidth
                        value={filters.maxTotalCalls}
                        onChange={(e) =>
                          handleFilterChange("maxTotalCalls", e.target.value)
                        }
                        inputProps={{ min: 0 }}
                      />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <TextField
                        label="Min Talk Time (hours)"
                        type="number"
                        size="small"
                        fullWidth
                        value={filters.minTalkTime}
                        onChange={(e) =>
                          handleFilterChange("minTalkTime", e.target.value)
                        }
                        inputProps={{ min: 0, step: 0.1 }}
                      />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <TextField
                        label="Max Talk Time (hours)"
                        type="number"
                        size="small"
                        fullWidth
                        value={filters.maxTalkTime}
                        onChange={(e) =>
                          handleFilterChange("maxTalkTime", e.target.value)
                        }
                        inputProps={{ min: 0, step: 0.1 }}
                      />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Sort By</InputLabel>
                        <Select
                          value={filters.sortBy}
                          onChange={(e) =>
                            handleFilterChange("sortBy", e.target.value)
                          }
                          label="Sort By"
                        >
                          <MenuItem value="fullName">Name</MenuItem>
                          <MenuItem value="totalCalls">Total Calls</MenuItem>
                          <MenuItem value="successful">
                            Successful Calls
                          </MenuItem>
                          <MenuItem value="successRate">Success Rate</MenuItem>
                          <MenuItem value="talkTime">Talk Time</MenuItem>
                          <MenuItem value="basePay">Base Pay</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Sort Order</InputLabel>
                        <Select
                          value={filters.sortOrder}
                          onChange={(e) =>
                            handleFilterChange("sortOrder", e.target.value)
                          }
                          label="Sort Order"
                        >
                          <MenuItem value="asc">Ascending</MenuItem>
                          <MenuItem value="desc">Descending</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        )}

        {/* Agent Earnings Page - Single page with all components */}
        {user?.role === "agent" && bonusConfig && bonusConfig.bonusRates && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Grid container spacing={{ xs: 2, sm: 3 }}>
              {/* Withdraw Button - Prominent Position */}
              <Grid item xs={12}>
                <Card
                  sx={{
                    background:
                      "linear-gradient(135deg, #2196F3 0%, #21CBF3 100%)",
                    color: "white",
                    boxShadow: "0 8px 32px 0 rgba(33, 150, 243, 0.37)",
                    border: "2px solid rgba(255, 255, 255, 0.18)",
                  }}
                >
                  <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                    <Box
                      display="flex"
                      flexDirection="column"
                      alignItems="center"
                      gap={{ xs: 1.5, sm: 2 }}
                      sx={{ py: { xs: 1, sm: 2 } }}
                    >
                      <Typography
                        variant="h5"
                        fontWeight="bold"
                        textAlign="center"
                        sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}
                      >
                        Ready to Withdraw Your Earnings?
                      </Typography>
                      <Typography
                        variant="body1"
                        textAlign="center"
                        sx={{ opacity: 0.9, fontSize: { xs: '0.875rem', sm: '1rem' }, px: { xs: 1, sm: 0 } }}
                      >
                        Submit a withdrawal request and get paid within 1-3
                        business days
                      </Typography>
                      {calculateAvailableEarnings() > 0 && (
                        <Box
                          sx={{
                            mt: { xs: 1, sm: 2 },
                            p: { xs: 1.5, sm: 2 },
                            bgcolor: "rgba(255, 255, 255, 0.1)",
                            borderRadius: 2,
                          }}
                        >
                          <Typography
                            variant="body2"
                            textAlign="center"
                            sx={{ opacity: 0.8, fontSize: { xs: '0.75rem', sm: '0.875rem' }, lineHeight: 1.6 }}
                          >
                            💰 Talk Pay: $
                            {(() => {
                              if (
                                !agentCallsData ||
                                agentCallsData.length === 0
                              )
                                return "0.00";
                              const agentData = agentCallsData[0];
                              if (!agentData?.totalTalkTime) return "0.00";
                              const parseTimeToSeconds = (timeStr) => {
                                if (!timeStr || timeStr === "00:00:00")
                                  return 0;
                                const [hours, minutes, seconds] = timeStr
                                  .split(":")
                                  .map(Number);
                                return hours * 3600 + minutes * 60 + seconds;
                              };
                              const totalSeconds = parseTimeToSeconds(
                                agentData.totalTalkTime
                              );
                              const ratePerSecond = 0.00278;
                              return (totalSeconds * ratePerSecond).toFixed(2);
                            })()}{" "}
                            + 🎁 Bonuses: $
                            {(() => {
                              if (
                                !agentBonusesData ||
                                agentBonusesData.length === 0
                              )
                                return "0.00";
                              const agentBonus = agentBonusesData[0];
                              if (
                                !agentBonus?.callCounts ||
                                !agentBonus?.bonusRates
                              )
                                return "0.00";
                              const callCounts = agentBonus.callCounts;
                              const bonusRates = agentBonus.bonusRates;
                              const total =
                                (callCounts.firstCalls || 0) *
                                  (bonusRates.firstCall || 5) +
                                (callCounts.secondCalls || 0) *
                                  (bonusRates.secondCall || 10) +
                                (callCounts.thirdCalls || 0) *
                                  (bonusRates.thirdCall || 15) +
                                (callCounts.fourthCalls || 0) *
                                  (bonusRates.fourthCall || 20) +
                                (callCounts.fifthCalls || 0) *
                                  (bonusRates.fifthCall || 25) +
                                (callCounts.verifiedAccounts || 0) *
                                  (bonusRates.verifiedAcc || 50);
                              return total.toFixed(2);
                            })()}
                            {(() => {
                              if (
                                !agentFinesData ||
                                agentFinesData.length === 0
                              )
                                return "";
                              const fines = agentFinesData.reduce(
                                (total, fine) => {
                                  const isActive = ['approved', 'admin_approved', 'active'].includes(fine.status);
                                  return total + (isActive ? fine.amount : 0);
                                },
                                0
                              );
                              return fines > 0
                                ? ` - Fines: $${fines.toFixed(2)}`
                                : "";
                            })()}
                          </Typography>
                        </Box>
                      )}
                      <Button
                        variant="contained"
                        size="large"
                        startIcon={<WithdrawIcon sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }} />}
                        onClick={() => setWithdrawalModalOpen(true)}
                        disabled={
                          hasPendingWithdrawal || withdrawalLoading || calculateAvailableEarnings() <= 0
                        }
                        sx={{
                          py: { xs: 1, sm: 1.5 },
                          px: { xs: 2, sm: 4 },
                          fontSize: { xs: '0.875rem', sm: '1.2rem' },
                          fontWeight: "bold",
                          background:
                            calculateAvailableEarnings() > 0
                              ? "rgba(255, 255, 255, 0.2)"
                              : "rgba(128, 128, 128, 0.2)",
                          backdropFilter: "blur(10px)",
                          border: "1px solid rgba(255, 255, 255, 0.3)",
                          color:
                            calculateAvailableEarnings() > 0
                              ? "white"
                              : "rgba(255, 255, 255, 0.5)",
                          "&:hover":
                            calculateAvailableEarnings() > 0
                              ? {
                                  background: "rgba(255, 255, 255, 0.3)",
                                  transform: "translateY(-2px)",
                                }
                              : {},
                          transition: "all 0.3s ease",
                        }}
                      >
                        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                          {withdrawalLoading
                            ? "Processing..."
                            : calculateAvailableEarnings() > 0
                            ? `Withdraw $${calculateAvailableEarnings().toFixed(
                                2
                              )}`
                            : "No Earnings Available"}
                        </Box>
                        <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                          {withdrawalLoading
                            ? "..."
                            : calculateAvailableEarnings() > 0
                            ? `$${calculateAvailableEarnings().toFixed(2)}`
                            : "No Earnings"}
                        </Box>
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Month Selector for Agent Earnings */}
              <Grid item xs={12}>
                <Card>
                  <CardHeader
                    title={
                      <Box display="flex" alignItems="center" gap={1}>
                        <DateRangeIcon color="primary" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }} />
                        <Typography variant="h6" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                          Select Month for Earnings
                        </Typography>
                      </Box>
                    }
                    sx={{ pb: { xs: 1, sm: 2 } }}
                  />
                  <CardContent sx={{ px: { xs: 2, sm: 3 } }}>
                    <Grid container spacing={3} alignItems="center">
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth>
                          <InputLabel>Select Month</InputLabel>
                          <Select
                            value={selectedAgentMonth}
                            onChange={handleAgentMonthChange}
                            label="Select Month"
                            disabled={
                              agentCallsLoading ||
                              bonusesLoading ||
                              finesLoading
                            }
                          >
                            {availableMonths.map((monthData) => (
                              <MenuItem
                                key={`${monthData.year}-${monthData.month}`}
                                value={`${monthData.year}-${monthData.month}`}
                              >
                                {formatMonthYear(
                                  monthData.year,
                                  monthData.month
                                )}
                                <Chip
                                  label={`${monthData.report_count} reports`}
                                  size="small"
                                  sx={{ ml: 1 }}
                                />
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Box
                          sx={{ display: "flex", alignItems: "center", gap: 2 }}
                        >
                          <PhoneIcon color="primary" />
                          <Typography variant="h6">
                            {selectedAgentMonth
                              ? formatMonthYear(
                                  ...selectedAgentMonth.split("-").map(Number)
                                )
                              : "Select Month"}
                          </Typography>
                          {(agentCallsLoading ||
                            bonusesLoading ||
                            finesLoading) && <CircularProgress size={20} />}
                        </Box>
                      </Grid>
                    </Grid>

                    {/* Information about monthly bonuses and fines */}
                    <Alert severity="info" sx={{ mt: { xs: 1.5, sm: 2 }, mb: { xs: 1.5, sm: 2 } }}>
                      <Typography variant="body2" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                        📊 <strong>Monthly Data:</strong> Your bonuses and fines
                        are calculated monthly. Select a month to view your call
                        statistics, monthly bonuses, and any active fines for
                        that period.
                      </Typography>
                    </Alert>

                    <Box sx={{ mt: { xs: 1.5, sm: 2 } }}>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                        View your monthly earnings including call bonuses and
                        fines for{" "}
                        {selectedAgentMonth
                          ? formatMonthYear(
                              ...selectedAgentMonth.split("-").map(Number)
                            )
                          : "the selected month"}
                        .
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Statistics Cards for Agent */}
              {agentCallsStats && (
                <Grid item xs={12}>
                  <Grid container spacing={{ xs: 2, sm: 3 }}>
                    <Grid item xs={6} sm={6} md={2.4}>
                      <Card
                        elevation={2}
                        sx={{
                          height: "100%",
                          background: "#fafafa",
                          border: "1px solid rgba(0, 0, 0, 0.08)",
                          "&:hover": {
                            transform: "translateY(-2px)",
                            boxShadow: 3,
                            transition: "all 0.2s ease-in-out",
                          },
                        }}
                      >
                        <CardContent sx={{ textAlign: "center", p: { xs: 1.5, sm: 2, md: 3 } }}>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              mb: { xs: 1, sm: 1.5, md: 2 },
                              flexDirection: { xs: 'column', sm: 'row' }
                            }}
                          >
                            <PhoneIcon
                              sx={{
                                fontSize: { xs: 20, sm: 24, md: 28 },
                                color: "text.primary",
                                mr: { xs: 0, sm: 1 },
                                mb: { xs: 0.5, sm: 0 }
                              }}
                            />
                            <Typography
                              variant="h3"
                              color="text.primary"
                              fontWeight="bold"
                              sx={{ fontSize: { xs: '1.5rem', sm: '2rem', md: '3rem' } }}
                            >
                              {agentCallsStats.totalCalls}
                            </Typography>
                          </Box>
                          <Typography
                            variant="subtitle1"
                            color="text.secondary"
                            fontWeight="medium"
                            sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem', md: '1rem' } }}
                          >
                            Total Calls
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>

                    <Grid item xs={6} sm={6} md={2.4}>
                      <Card
                        elevation={2}
                        sx={{
                          background: "#fafafa",
                          border: "1px solid rgba(0, 0, 0, 0.08)",
                          "&:hover": {
                            transform: "translateY(-2px)",
                            boxShadow: 3,
                            transition: "all 0.2s ease-in-out",
                          },
                          height: "100%",
                        }}
                      >
                        <CardContent sx={{ textAlign: "center", p: { xs: 1.5, sm: 2, md: 3 } }}>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              mb: { xs: 1, sm: 1.5 },
                              flexDirection: { xs: 'column', sm: 'row' }
                            }}
                          >
                            <CheckCircleIcon
                              sx={{
                                fontSize: { xs: 20, sm: 24, md: 28 },
                                color: "text.primary",
                                mr: { xs: 0, sm: 1 },
                                mb: { xs: 0.5, sm: 0 }
                              }}
                            />
                            <Typography
                              variant="h3"
                              color="text.primary"
                              fontWeight="bold"
                              sx={{ fontSize: { xs: '1.5rem', sm: '2rem', md: '3rem' } }}
                            >
                              {agentCallsStats.avgSuccessRate}%
                            </Typography>
                          </Box>
                          <Typography
                            variant="subtitle1"
                            color="text.secondary"
                            fontWeight="medium"
                            mb={1}
                            sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem', md: '1rem' } }}
                          >
                            Success Rate
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              background: "rgba(0, 0, 0, 0.05)",
                              px: { xs: 1, sm: 1.5 },
                              py: 0.5,
                              borderRadius: 1,
                              fontWeight: 500,
                              fontSize: { xs: '0.65rem', sm: '0.75rem' }
                            }}
                          >
                            {agentCallsStats.totalSuccessful} successful
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>

                    <Grid item xs={6} sm={6} md={2.4}>
                      <Card
                        elevation={2}
                        sx={{
                          height: "100%",
                          background: "#fafafa",
                          border: "1px solid rgba(0, 0, 0, 0.08)",
                          "&:hover": {
                            transform: "translateY(-2px)",
                            boxShadow: 3,
                            transition: "all 0.2s ease-in-out",
                          },
                        }}
                      >
                        <CardContent sx={{ textAlign: "center", p: { xs: 1.5, sm: 2, md: 3 } }}>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              mb: { xs: 1, sm: 1.5 },
                              flexDirection: { xs: 'column', sm: 'row' }
                            }}
                          >
                            <LocalAtmIcon
                              sx={{
                                fontSize: { xs: 20, sm: 24, md: 28 },
                                color: "text.primary",
                                mr: { xs: 0, sm: 1 },
                                mb: { xs: 0.5, sm: 0 }
                              }}
                            />
                            <Typography
                              variant="h3"
                              color="text.primary"
                              fontWeight="bold"
                              sx={{ fontSize: { xs: '1.25rem', sm: '1.75rem', md: '3rem' } }}
                            >
                              {calculateTotalPayableStats()
                                ? formatCurrency(
                                    calculateTotalPayableStats().totalTalkTimePay
                                  )
                                : "0.00"}
                            </Typography>
                          </Box>
                          <Typography
                            variant="subtitle1"
                            color="text.secondary"
                            fontWeight="medium"
                            mb={1}
                            sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem', md: '1rem' } }}
                          >
                            Money from Calls
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              background: "rgba(0, 0, 0, 0.05)",
                              px: { xs: 1, sm: 1.5 },
                              py: 0.5,
                              borderRadius: 1,
                              fontWeight: 500,
                              fontSize: { xs: '0.65rem', sm: '0.75rem' },
                              display: { xs: 'none', sm: 'inline' }
                            }}
                          >
                            {agentCallsStats.totalTalkTime} talk time
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>

                    {/* Monthly Bonuses Card */}
                    <Grid item xs={6} sm={6} md={2.4}>
                      <Card
                        elevation={2}
                        sx={{
                          height: "100%",
                          background: "#fafafa",
                          border: "1px solid rgba(0, 0, 0, 0.08)",
                          "&:hover": {
                            transform: "translateY(-2px)",
                            boxShadow: 3,
                            transition: "all 0.2s ease-in-out",
                          },
                        }}
                      >
                        <CardContent sx={{ textAlign: "center", p: { xs: 1.5, sm: 2, md: 3 } }}>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              mb: { xs: 1, sm: 1.5 },
                              flexDirection: { xs: 'column', sm: 'row' }
                            }}
                          >
                            <StarIcon
                              sx={{
                                fontSize: { xs: 20, sm: 24, md: 28 },
                                color: "text.primary",
                                mr: { xs: 0, sm: 1 },
                                mb: { xs: 0.5, sm: 0 }
                              }}
                            />
                            <Typography
                              variant="h3"
                              color="text.primary"
                              fontWeight="bold"
                              sx={{ fontSize: { xs: '1.25rem', sm: '1.75rem', md: '3rem' } }}
                            >
                              {bonusesStats
                                ? formatCurrency(bonusesStats.totalBonus)
                                : "0.00"}
                            </Typography>
                          </Box>
                          <Typography
                            variant="subtitle1"
                            color="text.secondary"
                            fontWeight="medium"
                            sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem', md: '1rem' } }}
                          >
                            Monthly Bonuses
                          </Typography>
                          {bonusesLoading && (
                            <Box sx={{ mt: 1.5 }}>
                              <CircularProgress size={20} />
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    </Grid>

                    {/* Monthly Fines Card */}
                    <Grid item xs={12} sm={12} md={2.4}>
                      <Card
                        elevation={2}
                        sx={{
                          height: "100%",
                          background: "#fafafa",
                          border: "1px solid rgba(0, 0, 0, 0.08)",
                          "&:hover": {
                            transform: "translateY(-2px)",
                            boxShadow: 3,
                            transition: "all 0.2s ease-in-out",
                          },
                        }}
                      >
                        <CardContent sx={{ textAlign: "center", p: { xs: 1.5, sm: 2, md: 3 } }}>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              mb: { xs: 1, sm: 1.5 },
                              flexDirection: { xs: 'row', sm: 'row' }
                            }}
                          >
                            <WarningIcon
                              sx={{
                                fontSize: { xs: 20, sm: 24, md: 28 },
                                color: "text.primary",
                                mr: 1,
                              }}
                            />
                            <Typography
                              variant="h3"
                              color="text.primary"
                              fontWeight="bold"
                              sx={{ fontSize: { xs: '1.25rem', sm: '1.75rem', md: '3rem' } }}
                            >
                              {finesStats
                                ? formatCurrency(finesStats.activeAmount)
                                : "0.00"}
                            </Typography>
                          </Box>
                          <Typography
                            variant="subtitle1"
                            color="text.secondary"
                            fontWeight="medium"
                            sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem', md: '1rem' } }}
                          >
                            Active Fines
                          </Typography>
                          {finesLoading && (
                            <Box sx={{ mt: 1.5 }}>
                              <CircularProgress size={20} />
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    </Grid>

                    {/* Total Payable Card - Only show if we have room or in a separate row */}
                    {calculateTotalPayableStats() && (
                      <Grid item xs={12}>
                        <Grid container justifyContent="center">
                          <Grid item xs={12} sm={6} md={4}>
                            <Card
                              elevation={2}
                              sx={{
                                background: "#fafafa",
                                border: "1px solid rgba(0, 0, 0, 0.12)",
                                "&:hover": {
                                  transform: "translateY(-3px)",
                                  boxShadow: 4,
                                  transition: "all 0.2s ease-in-out",
                                },
                              }}
                            >
                              <CardContent sx={{ textAlign: "center", p: 4 }}>
                                <Box
                                  sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    mb: 2,
                                  }}
                                >
                                  <LocalAtmIcon
                                    sx={{
                                      fontSize: 32,
                                      color: "text.primary",
                                      mr: 1.5,
                                    }}
                                  />
                                  <Typography
                                    variant="h2"
                                    color="text.primary"
                                    fontWeight="bold"
                                  >
                                    {formatCurrency(
                                      calculateTotalPayableStats().totalPayable
                                    )}
                                  </Typography>
                                </Box>
                                <Typography
                                  variant="h6"
                                  color="text.secondary"
                                  fontWeight="medium"
                                >
                                  Total Payable
                                </Typography>
                              </CardContent>
                            </Card>
                          </Grid>
                        </Grid>
                      </Grid>
                    )}
                  </Grid>
                </Grid>
              )}

              {/* Agent Table for Agent View */}
              <Grid item xs={12}>
                <AgentCallsTable
                  agentCalls={agentCallsData}
                  loading={agentCallsLoading || bonusesLoading || finesLoading}
                  agentBonusesData={agentBonusesData}
                  agentFinesData={agentFinesData}
                />
              </Grid>

              {/* Call Counts Bonuses Card */}
              <Grid item xs={12}>
                <Card>
                  <CardHeader
                    title="Your Call Bonuses & Earnings"
                    action={
                      <Chip
                        label={
                          historicalBonusConfig
                            ? "Historical Data"
                            : "Current Data"
                        }
                        color={historicalBonusConfig ? "secondary" : "primary"}
                        size="small"
                      />
                    }
                  />
                  <CardContent>
                    <Grid container spacing={{ xs: 2, sm: 3 }}>
                      <Grid item xs={6} sm={4}>
                        <Box
                          textAlign="center"
                          p={3}
                          sx={{
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 2,
                            "&:hover": {
                              borderColor: "primary.main",
                              backgroundColor: "action.hover",
                            },
                          }}
                        >
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            gutterBottom
                          >
                            1st Calls
                          </Typography>
                          <Typography
                            variant="h3"
                            color="text.primary"
                            fontWeight="bold"
                          >
                            {(historicalBonusConfig || bonusConfig)?.callCounts
                              ?.firstCalls || 0}
                          </Typography>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 1 }}
                          >
                            × $
                            {(historicalBonusConfig || bonusConfig)?.bonusRates
                              ?.firstCall || 5}{" "}
                            = $
                            {(
                              ((historicalBonusConfig || bonusConfig)
                                ?.callCounts?.firstCalls || 0) *
                              ((historicalBonusConfig || bonusConfig)
                                ?.bonusRates?.firstCall || 5)
                            ).toFixed(2)}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6} sm={4}>
                        <Box
                          textAlign="center"
                          p={3}
                          sx={{
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 2,
                            "&:hover": {
                              borderColor: "primary.main",
                              backgroundColor: "action.hover",
                            },
                          }}
                        >
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            gutterBottom
                          >
                            2nd Calls
                          </Typography>
                          <Typography
                            variant="h3"
                            color="text.primary"
                            fontWeight="bold"
                          >
                            {(historicalBonusConfig || bonusConfig)?.callCounts
                              ?.secondCalls || 0}
                          </Typography>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 1 }}
                          >
                            × $
                            {(historicalBonusConfig || bonusConfig)?.bonusRates
                              ?.secondCall || 10}{" "}
                            = $
                            {(
                              ((historicalBonusConfig || bonusConfig)
                                ?.callCounts?.secondCalls || 0) *
                              ((historicalBonusConfig || bonusConfig)
                                ?.bonusRates?.secondCall || 10)
                            ).toFixed(2)}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6} sm={4}>
                        <Box
                          textAlign="center"
                          p={3}
                          sx={{
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 2,
                            "&:hover": {
                              borderColor: "primary.main",
                              backgroundColor: "action.hover",
                            },
                          }}
                        >
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            gutterBottom
                          >
                            3rd Calls
                          </Typography>
                          <Typography
                            variant="h3"
                            color="text.primary"
                            fontWeight="bold"
                          >
                            {(historicalBonusConfig || bonusConfig)?.callCounts
                              ?.thirdCalls || 0}
                          </Typography>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 1 }}
                          >
                            × $
                            {(historicalBonusConfig || bonusConfig)?.bonusRates
                              ?.thirdCall || 15}{" "}
                            = $
                            {(
                              ((historicalBonusConfig || bonusConfig)
                                ?.callCounts?.thirdCalls || 0) *
                              ((historicalBonusConfig || bonusConfig)
                                ?.bonusRates?.thirdCall || 15)
                            ).toFixed(2)}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6} sm={4}>
                        <Box
                          textAlign="center"
                          p={3}
                          sx={{
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 2,
                            "&:hover": {
                              borderColor: "primary.main",
                              backgroundColor: "action.hover",
                            },
                          }}
                        >
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            gutterBottom
                          >
                            4th Calls
                          </Typography>
                          <Typography
                            variant="h3"
                            color="text.primary"
                            fontWeight="bold"
                          >
                            {(historicalBonusConfig || bonusConfig)?.callCounts
                              ?.fourthCalls || 0}
                          </Typography>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 1 }}
                          >
                            × $
                            {(historicalBonusConfig || bonusConfig)?.bonusRates
                              ?.fourthCall || 20}{" "}
                            = $
                            {(
                              ((historicalBonusConfig || bonusConfig)
                                ?.callCounts?.fourthCalls || 0) *
                              ((historicalBonusConfig || bonusConfig)
                                ?.bonusRates?.fourthCall || 20)
                            ).toFixed(2)}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6} sm={4}>
                        <Box
                          textAlign="center"
                          p={3}
                          sx={{
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 2,
                            "&:hover": {
                              borderColor: "primary.main",
                              backgroundColor: "action.hover",
                            },
                          }}
                        >
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            gutterBottom
                          >
                            5th Calls
                          </Typography>
                          <Typography
                            variant="h3"
                            color="text.primary"
                            fontWeight="bold"
                          >
                            {(historicalBonusConfig || bonusConfig)?.callCounts
                              ?.fifthCalls || 0}
                          </Typography>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 1 }}
                          >
                            × $
                            {(historicalBonusConfig || bonusConfig)?.bonusRates
                              ?.fifthCall || 25}{" "}
                            = $
                            {(
                              ((historicalBonusConfig || bonusConfig)
                                ?.callCounts?.fifthCalls || 0) *
                              ((historicalBonusConfig || bonusConfig)
                                ?.bonusRates?.fifthCall || 25)
                            ).toFixed(2)}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6} sm={4}>
                        <Box
                          textAlign="center"
                          p={3}
                          sx={{
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 2,
                            "&:hover": {
                              borderColor: "primary.main",
                              backgroundColor: "action.hover",
                            },
                          }}
                        >
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            gutterBottom
                          >
                            Verified Accounts
                          </Typography>
                          <Typography
                            variant="h3"
                            color="text.primary"
                            fontWeight="bold"
                          >
                            {(historicalBonusConfig || bonusConfig)?.callCounts
                              ?.verifiedAccounts || 0}
                          </Typography>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 1 }}
                          >
                            × $
                            {(historicalBonusConfig || bonusConfig)?.bonusRates
                              ?.verifiedAcc || 50}{" "}
                            = $
                            {(
                              ((historicalBonusConfig || bonusConfig)
                                ?.callCounts?.verifiedAccounts || 0) *
                              ((historicalBonusConfig || bonusConfig)
                                ?.bonusRates?.verifiedAcc || 50)
                            ).toFixed(2)}
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              {/* Total Earnings Summary */}
              <Grid item xs={12}>
                <Card>
                  <CardHeader
                    title="Total Earnings Summary"
                    action={
                      <Chip
                        label={
                          historicalBonusConfig
                            ? "Historical Data"
                            : "Current Data"
                        }
                        color={historicalBonusConfig ? "secondary" : "info"}
                        size="small"
                      />
                    }
                  />
                  <CardContent>
                    <Grid container spacing={3} justifyContent="center">
                      <Grid item xs={12} md={6}>
                        <Box
                          textAlign="center"
                          p={3}
                          sx={{
                            background:
                              theme.palette.mode === "dark"
                                ? "linear-gradient(135deg, #1a237e 0%, #3949ab 100%)"
                                : "linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)",
                            borderRadius: 2,
                            border: "1px solid",
                            borderColor: "primary.light",
                          }}
                        >
                          <Typography variant="h6" color="primary" gutterBottom>
                            Total Call Bonus Earnings
                          </Typography>
                          <Typography
                            variant="h3"
                            color="primary"
                            fontWeight="bold"
                          >
                            $
                            {(() => {
                              // Use the correct bonus calculation from agent bonuses data
                              if (
                                !agentBonusesData ||
                                agentBonusesData.length === 0
                              )
                                return "0.00";

                              const agentBonus = agentBonusesData[0]; // Agent bonus data for current user
                              if (
                                !agentBonus?.callCounts ||
                                !agentBonus?.bonusRates
                              )
                                return "0.00";

                              const callCounts = agentBonus.callCounts;
                              const bonusRates = agentBonus.bonusRates;

                              const total =
                                (callCounts.firstCalls || 0) *
                                  (bonusRates.firstCall || 5) +
                                (callCounts.secondCalls || 0) *
                                  (bonusRates.secondCall || 10) +
                                (callCounts.thirdCalls || 0) *
                                  (bonusRates.thirdCall || 15) +
                                (callCounts.fourthCalls || 0) *
                                  (bonusRates.fourthCall || 20) +
                                (callCounts.fifthCalls || 0) *
                                  (bonusRates.fifthCall || 25) +
                                (callCounts.verifiedAccounts || 0) *
                                  (bonusRates.verifiedAcc || 50);

                              return total.toFixed(2);
                            })()}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            From call bonuses assigned by admin
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Box
                          textAlign="center"
                          p={3}
                          sx={{
                            background:
                              theme.palette.mode === "dark"
                                ? "linear-gradient(135deg, #2e7d32 0%, #4caf50 100%)"
                                : "#fafafa",
                            borderRadius: 2,
                            border: "1px solid",
                            borderColor: "success.light",
                          }}
                        >
                          <Typography
                            variant="h6"
                            color="success.main"
                            gutterBottom
                          >
                            Total Talk Pay Earnings
                          </Typography>
                          <Typography
                            variant="h3"
                            color="success.main"
                            fontWeight="bold"
                          >
                            $
                            {(() => {
                              // Use the correct talk time calculation from agent calls data
                              if (
                                !agentCallsData ||
                                agentCallsData.length === 0
                              )
                                return "0.00";

                              const agentData = agentCallsData[0]; // Agent data for current user
                              if (!agentData?.totalTalkTime) return "0.00";

                              // Calculate talk time pay using the same method as in AgentCallsTable
                              const parseTimeToSeconds = (timeStr) => {
                                if (!timeStr || timeStr === "00:00:00")
                                  return 0;
                                const [hours, minutes, seconds] = timeStr
                                  .split(":")
                                  .map(Number);
                                return hours * 3600 + minutes * 60 + seconds;
                              };

                              const totalSeconds = parseTimeToSeconds(
                                agentData.totalTalkTime
                              );
                              const ratePerSecond = 0.00278; // $0.00278 per second
                              const totalTalkPay = totalSeconds * ratePerSecond;

                              return totalTalkPay.toFixed(2);
                            })()}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            From call time calculations (
                            {agentCallsData?.[0]?.totalTalkTime || "00:00:00"})
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              {/* Monthly History Section */}
              <Grid item xs={12}>
                <Card>
                  <CardHeader
                    title="Monthly Performance History"
                    action={
                      <Chip
                        label="Historical Data"
                        color="secondary"
                        size="small"
                      />
                    }
                  />
                  <CardContent>
                    <AgentMonthlyHistory agentName={user.fullName} />
                  </CardContent>
                </Card>
              </Grid>

              {/* Call Bonuses Section - For Agents */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <CallBonusesSection />
                  </CardContent>
                </Card>
              </Grid>

              {/* Pending Approval Fines Section - For Agents */}
              {pendingApprovalFines.length > 0 && (
                <Grid item xs={12}>
                  <Card sx={{ mt: 2 }}>
                    <CardHeader
                      title={
                        <Box display="flex" alignItems="center" gap={1}>
                          <WarningIcon color="warning" />
                          <Typography variant="h6">
                            Fines Awaiting Your Approval ({pendingApprovalFines.length})
                          </Typography>
                        </Box>
                      }
                    />
                    <CardContent>
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
                              <TableCell>Evidence</TableCell>
                              <TableCell align="center">Actions</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {pendingApprovalFines.map((fine) => (
                              <TableRow key={fine._id}>
                                <TableCell>
                                  <Typography fontWeight="bold" color="error.main">
                                    ${fine.amount.toFixed(2)}
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
                    </CardContent>
                  </Card>
                </Grid>
              )}

              {/* All Agent Fines Summary */}
              {agentFinesData.length > 0 && (
                <Grid item xs={12}>
                  <Card sx={{ mt: 2 }}>
                    <CardHeader
                      title={
                        <Box display="flex" alignItems="center" gap={1}>
                          <WarningIcon color="error" />
                          <Typography variant="h6">
                            My Fines This Month ({agentFinesData.length})
                          </Typography>
                        </Box>
                      }
                    />
                    <CardContent>
                      <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Amount</TableCell>
                              <TableCell>Reason</TableCell>
                              <TableCell>Period</TableCell>
                              <TableCell>Status</TableCell>
                              <TableCell align="center">Actions</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {agentFinesData.map((fine) => (
                              <TableRow key={fine._id}>
                                <TableCell>
                                  <Typography fontWeight="bold" color="error.main">
                                    ${fine.amount.toFixed(2)}
                                  </Typography>
                                </TableCell>
                                <TableCell>{fine.reason}</TableCell>
                                <TableCell>
                                  {fine.fineMonth && fine.fineYear
                                    ? `${String(fine.fineMonth).padStart(2, '0')}/${fine.fineYear}`
                                    : 'N/A'}
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    label={fine.status.replace('_', ' ').toUpperCase()}
                                    size="small"
                                    color={
                                      fine.status === 'approved' || fine.status === 'admin_approved' ? 'error' :
                                      fine.status === 'disputed' ? 'warning' :
                                      fine.status === 'admin_rejected' ? 'success' :
                                      fine.status === 'pending_approval' ? 'info' :
                                      'default'
                                    }
                                  />
                                </TableCell>
                                <TableCell align="center">
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() => handleViewFineDetail(fine)}
                                  >
                                    View
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </CardContent>
                  </Card>
                </Grid>
              )}
            </Grid>
          </motion.div>
        )}

        {/* Agent Calls Tab (Admin Only) */}
        {user?.role === "admin" && tabValue === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Grid container spacing={{ xs: 2, sm: 3 }}>
              {/* Period Selection */}
              <Grid item xs={12}>
                <Paper sx={{ p: { xs: 2, sm: 3 } }}>
                  <Grid container spacing={{ xs: 2, sm: 3 }} alignItems="center">
                    <Grid item xs={12} sm={6} md={4}>
                      <FormControl fullWidth>
                        <InputLabel>Select Period</InputLabel>
                        <Select
                          value={selectedPeriod || ""}
                          onChange={handlePeriodChange}
                          label="Select Period"
                          disabled={agentCallsLoading}
                        >
                          {availableMonths.map((monthData) => (
                            <MenuItem
                              key={`${monthData.year}-${monthData.month}`}
                              value={`${monthData.year}-${monthData.month}`}
                            >
                              {formatMonthYear(monthData.year, monthData.month)}
                              <Chip
                                label={`${monthData.report_count} reports`}
                                size="small"
                                sx={{ ml: 1 }}
                              />
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid item xs={12} sm={6} md={8}>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: { xs: 1, sm: 2 } }}
                      >
                        <PhoneIcon color="primary" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }} />
                        <Typography variant="h6" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                          {selectedPeriod
                            ? formatMonthYear(
                                ...selectedPeriod.split("-").map(Number)
                              )
                            : "Select Period"}
                        </Typography>
                        {agentCallsLoading && <CircularProgress size={20} />}
                      </Box>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>

              {/* Statistics Cards */}
              {agentCallsStats && (
                <Grid item xs={12}>
                  <Grid container spacing={{ xs: 2, sm: 3 }}>
                    <Grid item xs={6} sm={6} md={2.4}>
                      <Card
                        elevation={2}
                        sx={{
                          height: "100%",
                          background: "#fafafa",
                          border: "1px solid rgba(0, 0, 0, 0.08)",
                          "&:hover": {
                            transform: "translateY(-2px)",
                            boxShadow: 3,
                            transition: "all 0.2s ease-in-out",
                          },
                        }}
                      >
                        <CardContent sx={{ textAlign: "center", p: { xs: 1.5, sm: 2, md: 3 } }}>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              mb: { xs: 1, sm: 1.5, md: 2 },
                              flexDirection: { xs: 'column', sm: 'row' }
                            }}
                          >
                            <PeopleIcon
                              sx={{
                                fontSize: { xs: 20, sm: 24, md: 28 },
                                color: "text.primary",
                                mr: { xs: 0, sm: 1 },
                                mb: { xs: 0.5, sm: 0 }
                              }}
                            />
                            <Typography
                              variant="h3"
                              color="text.primary"
                              fontWeight="bold"
                              sx={{ fontSize: { xs: '1.5rem', sm: '2rem', md: '3rem' } }}
                            >
                              {agentCallsStats.totalAgents}
                            </Typography>
                          </Box>
                          <Typography
                            variant="subtitle1"
                            color="text.secondary"
                            fontWeight="medium"
                            sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem', md: '1rem' } }}
                          >
                            Total Agents
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>

                    <Grid item xs={6} sm={6} md={2.4}>
                      <Card
                        elevation={2}
                        sx={{
                          height: "100%",
                          background: "#fafafa",
                          border: "1px solid rgba(0, 0, 0, 0.08)",
                          "&:hover": {
                            transform: "translateY(-2px)",
                            boxShadow: 3,
                            transition: "all 0.2s ease-in-out",
                          },
                        }}
                      >
                        <CardContent sx={{ textAlign: "center", p: { xs: 1.5, sm: 2, md: 3 } }}>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              mb: { xs: 1, sm: 1.5 },
                              flexDirection: { xs: 'column', sm: 'row' }
                            }}
                          >
                            <PhoneIcon
                              sx={{
                                fontSize: { xs: 20, sm: 24, md: 28 },
                                color: "text.primary",
                                mr: { xs: 0, sm: 1 },
                                mb: { xs: 0.5, sm: 0 }
                              }}
                            />
                            <Typography
                              variant="h3"
                              color="success.main"
                              fontWeight="bold"
                              sx={{ fontSize: { xs: '1.5rem', sm: '2rem', md: '3rem' } }}
                            >
                              {agentCallsStats.totalCalls}
                            </Typography>
                          </Box>
                          <Typography
                            variant="subtitle1"
                            color="success.dark"
                            fontWeight="medium"
                            mb={1}
                            sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem', md: '1rem' } }}
                          >
                            Total Calls
                          </Typography>
                          <Typography
                            variant="caption"
                            color="success.dark"
                            sx={{
                              background: "rgba(0, 0, 0, 0.05)",
                              px: { xs: 1, sm: 1.5 },
                              py: 0.5,
                              borderRadius: 1,
                              fontWeight: 500,
                              fontSize: { xs: '0.65rem', sm: '0.75rem' },
                              display: { xs: 'none', sm: 'inline' }
                            }}
                          >
                            {agentCallsStats.avgCallsPerAgent} avg per agent
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>

                    <Grid item xs={6} sm={6} md={2.4}>
                      <Card
                        elevation={2}
                        sx={{
                          height: "100%",
                          background: "#fafafa",
                          border: "1px solid rgba(0, 0, 0, 0.08)",
                          "&:hover": {
                            transform: "translateY(-2px)",
                            boxShadow: 3,
                            transition: "all 0.2s ease-in-out",
                          },
                        }}
                      >
                        <CardContent sx={{ textAlign: "center", p: { xs: 1.5, sm: 2, md: 3 } }}>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              mb: { xs: 1, sm: 1.5 },
                              flexDirection: { xs: 'column', sm: 'row' }
                            }}
                          >
                            <CheckCircleIcon
                              sx={{
                                fontSize: { xs: 20, sm: 24, md: 28 },
                                color: "text.primary",
                                mr: { xs: 0, sm: 1 },
                                mb: { xs: 0.5, sm: 0 }
                              }}
                            />
                            <Typography
                              variant="h3"
                              color="warning.main"
                              fontWeight="bold"
                              sx={{ fontSize: { xs: '1.5rem', sm: '2rem', md: '3rem' } }}
                            >
                              {agentCallsStats.avgSuccessRate}%
                            </Typography>
                          </Box>
                          <Typography
                            variant="subtitle1"
                            color="warning.dark"
                            fontWeight="medium"
                            mb={1}
                            sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem', md: '1rem' } }}
                          >
                            Success Rate
                          </Typography>
                          <Typography
                            variant="caption"
                            color="warning.dark"
                            sx={{
                              background: "rgba(0, 0, 0, 0.05)",
                              px: { xs: 1, sm: 1.5 },
                              py: 0.5,
                              borderRadius: 1,
                              fontWeight: 500,
                              fontSize: { xs: '0.65rem', sm: '0.75rem' },
                              display: { xs: 'none', sm: 'inline' }
                            }}
                          >
                            {agentCallsStats.totalSuccessful} successful
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>

                    <Grid item xs={6} sm={6} md={2.4}>
                      <Card
                        elevation={2}
                        sx={{
                          height: "100%",
                          background: "#fafafa",
                          border: "1px solid rgba(0, 0, 0, 0.08)",
                          "&:hover": {
                            transform: "translateY(-2px)",
                            boxShadow: 3,
                            transition: "all 0.2s ease-in-out",
                          },
                        }}
                      >
                        <CardContent sx={{ textAlign: "center", p: { xs: 1.5, sm: 2, md: 3 } }}>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              mb: { xs: 1, sm: 1.5 },
                              flexDirection: { xs: 'column', sm: 'row' }
                            }}
                          >
                            <LocalAtmIcon
                              sx={{
                                fontSize: { xs: 20, sm: 24, md: 28 },
                                color: "text.primary",
                                mr: { xs: 0, sm: 1 },
                                mb: { xs: 0.5, sm: 0 }
                              }}
                            />
                            <Typography
                              variant="h3"
                              color="info.main"
                              fontWeight="bold"
                              sx={{ fontSize: { xs: '1.25rem', sm: '1.75rem', md: '3rem' } }}
                            >
                              {calculateTotalPayableStats()
                                ? formatCurrency(
                                    calculateTotalPayableStats().totalTalkTimePay
                                  )
                                : "0.00"}
                            </Typography>
                          </Box>
                          <Typography
                            variant="subtitle1"
                            color="info.dark"
                            fontWeight="medium"
                            mb={1}
                            sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem', md: '1rem' } }}
                          >
                            Money from Calls
                          </Typography>
                          <Typography
                            variant="caption"
                            color="info.dark"
                            sx={{
                              background: "rgba(0, 0, 0, 0.05)",
                              px: { xs: 1, sm: 1.5 },
                              py: 0.5,
                              borderRadius: 1,
                              fontWeight: 500,
                              fontSize: { xs: '0.65rem', sm: '0.75rem' },
                              display: { xs: 'none', sm: 'inline' }
                            }}
                          >
                            {agentCallsStats.totalTalkTime} talk time
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>

                    {/* Monthly Bonuses Card */}
                    <Grid item xs={6} sm={6} md={2.4}>
                      <Card
                        elevation={2}
                        sx={{
                          height: "100%",
                          background: "#fafafa",
                          border: "1px solid rgba(0, 0, 0, 0.08)",
                          "&:hover": {
                            transform: "translateY(-2px)",
                            boxShadow: 3,
                            transition: "all 0.2s ease-in-out",
                          },
                        }}
                      >
                        <CardContent sx={{ textAlign: "center", p: { xs: 1.5, sm: 2, md: 3 } }}>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              mb: { xs: 1, sm: 1.5 },
                              flexDirection: { xs: 'column', sm: 'row' }
                            }}
                          >
                            <StarIcon
                              sx={{
                                fontSize: { xs: 20, sm: 24, md: 28 },
                                color: "text.primary",
                                mr: { xs: 0, sm: 1 },
                                mb: { xs: 0.5, sm: 0 }
                              }}
                            />
                            <Typography
                              variant="h3"
                              color="success.main"
                              fontWeight="bold"
                              sx={{ fontSize: { xs: '1.25rem', sm: '1.75rem', md: '3rem' } }}
                            >
                              {bonusesStats
                                ? formatCurrency(bonusesStats.totalBonus)
                                : "0.00"}
                            </Typography>
                          </Box>
                          <Typography
                            variant="subtitle1"
                            color="success.dark"
                            fontWeight="medium"
                            mb={1}
                            sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem', md: '1rem' } }}
                          >
                            Monthly Bonuses
                          </Typography>
                          <Typography
                            variant="caption"
                            color="success.dark"
                            sx={{
                              background: "rgba(0, 0, 0, 0.05)",
                              px: { xs: 1, sm: 1.5 },
                              py: 0.5,
                              borderRadius: 1,
                              fontWeight: 500,
                              fontSize: { xs: '0.65rem', sm: '0.75rem' },
                              display: { xs: 'none', sm: 'inline' }
                            }}
                          >
                            {bonusesStats
                              ? `${formatCurrency(
                                  bonusesStats.avgBonusPerAgent
                                )} avg per agent`
                              : "Loading..."}
                          </Typography>
                          {bonusesLoading && (
                            <Box sx={{ mt: 1.5 }}>
                              <CircularProgress size={20} color="success" />
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>

                  {/* Second Row - Additional Cards */}
                  <Grid container spacing={{ xs: 2, sm: 3 }} sx={{ mt: { xs: 1, sm: 2 } }}>
                    {/* Monthly Fines Card */}
                    <Grid item xs={12} sm={6} md={6}>
                      <Card
                        elevation={2}
                        sx={{
                          height: "100%",
                          background: "#fafafa",
                          border: "1px solid rgba(0, 0, 0, 0.08)",
                          "&:hover": {
                            transform: "translateY(-2px)",
                            boxShadow: 3,
                            transition: "all 0.2s ease-in-out",
                          },
                        }}
                      >
                        <CardContent sx={{ textAlign: "center", p: { xs: 2, sm: 3 } }}>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              mb: { xs: 1, sm: 1.5 },
                            }}
                          >
                            <WarningIcon
                              sx={{
                                fontSize: { xs: 24, sm: 28 },
                                color: "text.primary",
                                mr: 1,
                              }}
                            />
                            <Typography
                              variant="h3"
                              color="error.main"
                              fontWeight="bold"
                              sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem', md: '3rem' } }}
                            >
                              {finesStats
                                ? formatCurrency(finesStats.activeAmount)
                                : "0.00"}
                            </Typography>
                          </Box>
                          <Typography
                            variant="subtitle1"
                            color="error.dark"
                            fontWeight="medium"
                            mb={1}
                            sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
                          >
                            Active Fines
                          </Typography>
                          <Typography
                            variant="caption"
                            color="error.dark"
                            sx={{
                              background: "rgba(0, 0, 0, 0.05)",
                              px: { xs: 1, sm: 1.5 },
                              py: 0.5,
                              borderRadius: 1,
                              fontWeight: 500,
                              fontSize: { xs: '0.65rem', sm: '0.75rem' }
                            }}
                          >
                            {finesStats
                              ? `${finesStats.activeFines} active fines`
                              : "Loading..."}
                          </Typography>
                          {finesLoading && (
                            <Box sx={{ mt: 1.5 }}>
                              <CircularProgress size={20} color="error" />
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    </Grid>

                    {/* Total Payable Card */}
                    <Grid item xs={12} sm={6} md={6}>
                      <Card
                        elevation={4}
                        sx={{
                          height: "100%",
                          background: "#fafafa",
                          border: "2px solid rgba(63, 81, 181, 0.2)",
                          "&:hover": {
                            transform: "translateY(-6px)",
                            boxShadow: 6,
                            transition: "all 0.3s ease-in-out",
                          },
                        }}
                      >
                        <CardContent sx={{ textAlign: "center", p: { xs: 2, sm: 3, md: 4 } }}>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              mb: { xs: 1, sm: 1.5 },
                            }}
                          >
                            <LocalAtmIcon
                              sx={{
                                fontSize: { xs: 28, sm: 32 },
                                color: "text.primary",
                                mr: { xs: 1, sm: 1.5 },
                              }}
                            />
                            <Typography
                              variant="h2"
                              color="primary.main"
                              fontWeight="bold"
                              sx={{ fontSize: { xs: '1.75rem', sm: '2.5rem', md: '3.75rem' } }}
                            >
                              {calculateTotalPayableStats()
                                ? formatCurrency(
                                    calculateTotalPayableStats().totalPayable
                                  )
                                : "0.00"}
                            </Typography>
                          </Box>
                          <Typography
                            variant="h6"
                            color="primary.dark"
                            fontWeight="medium"
                            mb={1}
                            sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}
                          >
                            Total Payable
                          </Typography>
                          <Typography
                            variant="caption"
                            color="primary.dark"
                            sx={{
                              background: "rgba(0, 0, 0, 0.05)",
                              px: { xs: 1.5, sm: 2 },
                              py: 0.5,
                              borderRadius: 1,
                              fontWeight: 500,
                              fontSize: { xs: '0.65rem', sm: '0.75rem' },
                            }}
                          >
                            {calculateTotalPayableStats()
                              ? `${formatCurrency(
                                  calculateTotalPayableStats()
                                    .avgPayablePerAgent
                                )} avg per agent`
                              : "Loading..."}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                </Grid>
              )}

              {/* Agent Calls Table */}
              <Grid item xs={12}>
                <AgentCallsTable
                  agentCalls={agentCallsData}
                  loading={agentCallsLoading || bonusesLoading || finesLoading}
                  agentBonusesData={agentBonusesData}
                  agentFinesData={agentFinesData}
                />
              </Grid>
            </Grid>
          </motion.div>
        )}

        {/* Call Bonuses Tab (Admin and Affiliate Manager) - For approving call declarations */}
        {((tabValue === 1 && user?.role === "admin") || (tabValue === 0 && user?.role === "affiliate_manager")) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardContent>
                <CallBonusesSection />
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Bonus Management Tab (Admin and Affiliate Manager) */}
        {((tabValue === 2 && user?.role === "admin") || (tabValue === 1 && user?.role === "affiliate_manager")) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <AdminBonusManagement />
          </motion.div>
        )}

        {/* Withdrawal Modal - Agent */}
        {user?.role === "agent" && (
          <WithdrawalModal
            open={withdrawalModalOpen}
            onClose={handleWithdrawalModalClose}
            agentData={agentMetricsData}
            bonusConfig={bonusConfig}
            onWithdrawalRequest={handleWithdrawalRequest}
            user={user}
            selectedMonth={selectedAgentMonth}
            agentCallsData={agentCallsData}
            agentBonusesData={agentBonusesData}
            agentFinesData={agentFinesData}
          />
        )}

        {/* Withdrawal Modal - Affiliate Manager */}
        {user?.role === "affiliate_manager" && (
          <AffiliateManagerWithdrawalModal
            open={withdrawalModalOpen}
            onClose={handleWithdrawalModalClose}
            salaryData={affiliateManagerSalary}
            tableData={affiliateManagerTableData}
            onWithdrawalRequest={handleAffiliateManagerWithdrawalRequest}
            user={user}
          />
        )}

        {/* Fine Detail Dialog - For Agent fine review */}
        {user?.role === "agent" && (
          <FineDetailDialog
            open={showFineDetailDialog}
            onClose={() => {
              setShowFineDetailDialog(false);
              setSelectedFineDetail(null);
            }}
            fine={selectedFineDetail}
            onFineUpdated={handleFineUpdated}
          />
        )}
      </Box>
    </LocalizationProvider>
  );
};

export default PayrollPage;
