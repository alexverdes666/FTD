import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Card,
  CardContent,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TablePagination,
  IconButton,
  Collapse,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Menu,
  ListItemIcon,
  Alert,
  CircularProgress,
  useMediaQuery,
  useTheme,
  FormControlLabel,
  FormHelperText,
  Checkbox,
  Snackbar,
  Tooltip,
  ListItemText,
  Autocomplete,
  Popover,
  Popper,
  ToggleButton,
  ToggleButtonGroup,
  Divider,
  alpha,
  Link,
} from "@mui/material";
import {
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
  History as HistoryIcon,
  Delete as DeleteIcon,
  Send as SendIcon,
  SwapHorizontalCircle as SwapIcon,
  SwapVert as ConvertIcon,
  SwapHoriz as SwapHorizIcon,
  SyncAlt as SyncAltIcon,
  AssignmentInd as AssignIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Business as BusinessIcon,
  ContentCopy as ContentCopyIcon,
  Save as SaveIcon,
  Person as PersonIcon,
  Visibility as ViewIcon,
  PhoneInTalk as PhoneIcon,
  Close as CloseIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Search as SearchIcon,
  Image as ImageIcon,
  Settings as SettingsIcon,
  MoreVert as MoreVertIcon,
  Cached as ChangeIcon,
  Call as CallIcon,
  ContentCut as ShavedIcon,
  FormatListBulleted as ListIcon,
  Cancel as CancelIcon,
  Warning as WarningIcon,
  Restore as RestoreIcon,
  Undo as UndoIcon,
  VerifiedUser as VerifiedUserIcon,
  Launch as LaunchIcon,
  Gavel as GavelIcon,
  CreditCard as CreditCardIcon,
} from "@mui/icons-material";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import api from "../services/api";
import notificationService from "../services/notificationService";
import chatService from "../services/chatService";
import { selectUser } from "../store/slices/authSlice";
import { getSortedCountries } from "../constants/countries";
import LeadQuickView from "../components/LeadQuickView";
import DocumentPreview from "../components/DocumentPreview";
import ChangeFTDDialog from "../components/ChangeFTDDialog";
import AssignLeadToAgentDialog from "../components/AssignLeadToAgentDialog";
import SessionAccessButton from "../components/SessionAccessButton";
import SessionStatusChip from "../components/SessionStatusChip";
import AssignToRefundsManagerModal from "../components/AssignToRefundsManagerModal";
import MarkShavedDialog from "../components/MarkShavedDialog";
import { refundsService } from "../services/refunds";
import CommentButton from "../components/CommentButton";
import ClientBrokerManagementDialog from "../components/ClientBrokerManagementDialog";
import GenderFallbackModal from "../components/GenderFallbackModal";
import CopyPreferencesDialog, {
  copyLeadsWithPreferences,
} from "../components/CopyPreferencesDialog";
import ReplaceLeadDialog from "../components/ReplaceLeadDialog";
import RemoteBrowserDialog from "../components/RemoteBrowserDialog";
import ApplyAgentFineDialog from "../components/ApplyAgentFineDialog";
import { formatPhoneWithCountryCode } from "../utils/phoneUtils";

const createOrderSchema = (userRole) => {
  return yup.object({
    ftd: yup
      .number()
      .integer("Must be a whole number")
      .min(0, "Cannot be negative")
      .default(0),
    filler: yup
      .number()
      .integer("Must be a whole number")
      .min(0, "Cannot be negative")
      .default(0),
    cold: yup
      .number()
      .integer("Must be a whole number")
      .min(0, "Cannot be negative")
      .default(0),
    live: yup
      .number()
      .integer("Must be a whole number")
      .min(0, "Cannot be negative")
      .default(0),
    countryFilter: yup.string().default(""), // Country filter is only required in non-manual mode (validated in onSubmitOrder)
    genderFilter: yup.string().oneOf(["", "male", "female"]).default(""),
    priority: yup.string().oneOf(["low", "medium", "high"]).default("medium"),
    notes: yup.string().default(""),
    selectedClientNetwork:
      userRole === "admin" || userRole === "affiliate_manager"
        ? yup
            .string()
            .required("Client Network selection is required")
            .default("")
        : yup.string().default(""),
    selectedOurNetwork: yup
      .string()
      .required("Our Network selection is required")
      .default(""),
    selectedCampaign: yup
      .string()
      .required("Campaign selection is mandatory for all orders")
      .default(""),
    selectedClientBrokers: yup.array().of(yup.string()).default([]),
    agentFilter: yup.string().default(""),
    ftdAgents: yup.array().of(yup.string()).default([]),
    fillerAgents: yup.array().of(yup.string()).default([]),
    plannedDate: yup
      .date()
      .required("Planned date is required")
      .test("not-same-day", "Cannot create order for the same day", (value) => {
        // Admin users can bypass same-day restriction
        if (userRole === "admin") return true;

        if (!value) return false;
        const today = new Date();
        const plannedDay = new Date(value);
        today.setHours(0, 0, 0, 0);
        plannedDay.setHours(0, 0, 0, 0);
        return plannedDay.getTime() !== today.getTime();
      })
      .test(
        "not-tomorrow-after-7pm",
        "Cannot create order for tomorrow after 7:00 PM today",
        (value) => {
          // Admin users can bypass time restriction
          if (userRole === "admin") return true;

          if (!value) return false;
          const now = new Date();
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          const plannedDay = new Date(value);
          plannedDay.setHours(0, 0, 0, 0);

          // If planning for tomorrow and current time is after 7 PM
          if (
            plannedDay.getTime() === tomorrow.getTime() &&
            now.getHours() >= 19
          ) {
            return false;
          }
          return true;
        }
      )
      .test("not-past-date", "Cannot create order for past dates", (value) => {
        if (!value) return false;
        const today = new Date();
        const plannedDay = new Date(value);
        today.setHours(0, 0, 0, 0);
        plannedDay.setHours(0, 0, 0, 0);
        return plannedDay >= today;
      })
      .default(() => {
        // Default to tomorrow if before 7 PM today (or if admin), otherwise day after tomorrow
        const now = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (userRole === "admin" || now.getHours() < 19) {
          return tomorrow;
        } else {
          const dayAfterTomorrow = new Date();
          dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
          return dayAfterTomorrow;
        }
      }),
  });
  // Note: "at-least-one lead type" validation is done in onSubmitOrder
  // to support manual selection mode which doesn't use lead counts
};
const getStatusColor = (status) => {
  const colors = {
    fulfilled: "success",
    pending: "warning",
    cancelled: "error",
    partial: "info",
  };
  return colors[status] || "default";
};
const getPriorityColor = (priority) => {
  const colors = {
    high: "error",
    medium: "warning",
    low: "info",
  };
  return colors[priority] || "default";
};
// Helper function to get the display lead type (orderedAs takes precedence over leadType)
const getDisplayLeadType = (lead) => {
  return lead.orderedAs || lead.leadType;
};
// Helper function to calculate FTD cooldown status
const getFTDCooldownStatus = (lead) => {
  const leadType = getDisplayLeadType(lead);
  if (leadType !== "ftd" && leadType !== "filler") {
    return null; // Not an FTD/Filler lead
  }

  if (!lead.lastUsedInOrder) {
    return null; // Never used, no cooldown
  }

  const lastUsedDate = new Date(lead.lastUsedInOrder);
  const now = new Date();
  const daysSinceUsed = Math.floor(
    (now - lastUsedDate) / (1000 * 60 * 60 * 24)
  );
  const cooldownPeriod = 10; // 10 days

  if (daysSinceUsed < cooldownPeriod) {
    const daysRemaining = cooldownPeriod - daysSinceUsed;
    return {
      inCooldown: true,
      daysRemaining: daysRemaining,
      lastUsedDate: lastUsedDate,
    };
  }

  return { inCooldown: false };
};
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
};

// IPQS Status color helper - bold colors matching IPQS validation dialog
const getIPQSStatusConfig = (status) => {
  switch (status) {
    case "clean":
      return { color: "#2e7d32", bgcolor: "#c8e6c9", label: "Clean", textColor: "#1b5e20" };
    case "low_risk":
      return { color: "#1565c0", bgcolor: "#bbdefb", label: "Low Risk", textColor: "#0d47a1" };
    case "medium_risk":
      return { color: "#ef6c00", bgcolor: "#ffe0b2", label: "Medium Risk", textColor: "#e65100" };
    case "high_risk":
      return { color: "#c62828", bgcolor: "#ffcdd2", label: "High Risk", textColor: "#b71c1c" };
    case "invalid":
      return { color: "#c62828", bgcolor: "#ffcdd2", label: "Invalid", textColor: "#b71c1c" };
    default:
      return { color: "inherit", bgcolor: "transparent", label: "Unknown", textColor: "inherit" };
  }
};

// Build IPQS tooltip content
const buildIPQSTooltip = (validation, type) => {
  if (!validation) return "Not validated";

  const data = type === "email" ? validation.email : validation.phone;
  const summary = validation.summary;

  if (!data?.success) return data?.error || "Validation failed";

  if (type === "email") {
    const status = summary?.emailStatus || "unknown";
    const config = getIPQSStatusConfig(status);
    return (
      <Box sx={{ p: 1, bgcolor: config.bgcolor, borderRadius: 1, borderLeft: `4px solid ${config.color}` }}>
        <Typography variant="subtitle2" sx={{ color: config.textColor, fontWeight: "bold", mb: 0.5 }}>
          {config.label} (Score: {data.fraud_score ?? "N/A"})
        </Typography>
        <Typography variant="caption" component="div" sx={{ color: "#212121" }}>Valid: {data.valid ? "Yes" : "No"}</Typography>
        <Typography variant="caption" component="div" sx={{ color: "#212121" }}>Disposable: {data.disposable ? "Yes" : "No"}</Typography>
        <Typography variant="caption" component="div" sx={{ color: "#212121" }}>Honeypot: {data.honeypot ? "Yes" : "No"}</Typography>
        <Typography variant="caption" component="div" sx={{ color: "#212121" }}>Recent Abuse: {data.recent_abuse ? "Yes" : "No"}</Typography>
        <Typography variant="caption" component="div" sx={{ color: "#212121" }}>Catch All: {data.catch_all ? "Yes" : "No"}</Typography>
        <Typography variant="caption" component="div" sx={{ color: "#212121" }}>DNS Valid: {data.dns_valid ? "Yes" : "No"}</Typography>
        <Typography variant="caption" component="div" sx={{ color: "#212121" }}>Deliverability: {data.deliverability || "N/A"}</Typography>
        <Typography variant="caption" component="div" sx={{ color: "#212121" }}>Leaked: {data.leaked ? "Yes" : "No"}</Typography>
      </Box>
    );
  } else {
    const status = summary?.phoneStatus || "unknown";
    const config = getIPQSStatusConfig(status);
    return (
      <Box sx={{ p: 1, bgcolor: config.bgcolor, borderRadius: 1, borderLeft: `4px solid ${config.color}` }}>
        <Typography variant="subtitle2" sx={{ color: config.textColor, fontWeight: "bold", mb: 0.5 }}>
          {config.label} (Score: {data.fraud_score ?? "N/A"})
        </Typography>
        <Typography variant="caption" component="div" sx={{ color: "#212121" }}>Valid: {data.valid ? "Yes" : "No"}</Typography>
        <Typography variant="caption" component="div" sx={{ color: "#212121" }}>Active: {data.active ? "Yes" : "No"}</Typography>
        <Typography variant="caption" component="div" sx={{ color: "#212121" }}>VOIP: {data.VOIP ? "Yes" : "No"}</Typography>
        <Typography variant="caption" component="div" sx={{ color: "#212121" }}>Prepaid: {data.prepaid ? "Yes" : "No"}</Typography>
        <Typography variant="caption" component="div" sx={{ color: "#212121" }}>Risky: {data.risky ? "Yes" : "No"}</Typography>
        <Typography variant="caption" component="div" sx={{ color: "#212121" }}>Line Type: {data.line_type || "N/A"}</Typography>
        <Typography variant="caption" component="div" sx={{ color: "#212121" }}>Carrier: {data.carrier || "N/A"}</Typography>
        <Typography variant="caption" component="div" sx={{ color: "#212121" }}>Country: {data.country || "N/A"}</Typography>
        <Typography variant="caption" component="div" sx={{ color: "#212121" }}>Do Not Call: {data.do_not_call ? "Yes" : "No"}</Typography>
        <Typography variant="caption" component="div" sx={{ color: "#212121" }}>Spammer: {data.spammer ? "Yes" : "No"}</Typography>
      </Box>
    );
  }
};

const OrdersPage = () => {
  const user = useSelector(selectUser);
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({
    message: "",
    severity: "info",
  });
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [clientNetworks, setClientNetworks] = useState([]);
  const [loadingClientNetworks, setLoadingClientNetworks] = useState(false);
  const [ourNetworks, setOurNetworks] = useState([]);
  const [loadingOurNetworks, setLoadingOurNetworks] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [clientBrokers, setClientBrokers] = useState([]);
  const [loadingClientBrokers, setLoadingClientBrokers] = useState(false);
  const [agents, setAgents] = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [filteredAgents, setFilteredAgents] = useState([]);
  const [filteredAgentsLoading, setFilteredAgentsLoading] = useState(false);
  const [unassignedLeadsStats, setUnassignedLeadsStats] = useState({
    ftd: null,
    filler: null,
  });
  const [genderFallbackModalOpen, setGenderFallbackModalOpen] = useState(false);
  const [pendingOrderData, setPendingOrderData] = useState(null);
  const [insufficientAgentLeads, setInsufficientAgentLeads] = useState(null);
  const [clientBrokerManagementOpen, setClientBrokerManagementOpen] =
    useState(false);

  // Manual Lead Selection State
  const [manualSelectionMode, setManualSelectionMode] = useState(false);
  const [manualLeadEmails, setManualLeadEmails] = useState("");
  const [manualLeads, setManualLeads] = useState([]); // [{lead, agent, leadType}]
  const [searchingLeads, setSearchingLeads] = useState(false);
  const [fulfillmentSummary, setFulfillmentSummary] = useState(null);
  const [checkingFulfillment, setCheckingFulfillment] = useState(false);
  const [allAgents, setAllAgents] = useState([]);
  const [selectedOrderForManagement, setSelectedOrderForManagement] =
    useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [totalOrders, setTotalOrders] = useState(0);
  // Initialize filters from URL params (for global search integration)
  const [filters, setFilters] = useState(() => {
    const urlSearch = searchParams.get("search") || "";
    return {
      startDate: "",
      endDate: "",
      search: urlSearch,
    };
  });

  // Clear URL params after initial load to avoid persisting
  useEffect(() => {
    if (searchParams.get("search")) {
      // Clear the search param from URL after a short delay
      const timer = setTimeout(() => {
        setSearchParams({}, { replace: true });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []);
  const debouncedFilters = useDebounce(filters, 300);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedRowData, setExpandedRowData] = useState({});
  const [refundAssignmentStatus, setRefundAssignmentStatus] = useState({});

  // Lead Quick View Popover State
  const [leadPopoverAnchor, setLeadPopoverAnchor] = useState(null);
  const [hoveredLead, setHoveredLead] = useState(null);
  const [hoveredOrderId, setHoveredOrderId] = useState(null);
  const popoverTimerRef = React.useRef(null);
  const closeTimerRef = React.useRef(null);

  // Assigned Leads Modal State
  const [assignedLeadsModal, setAssignedLeadsModal] = useState({
    open: false,
    leads: [],
    currentIndex: 0,
    orderId: null,
  });

  // Search state for leads modal
  const [leadsSearchQuery, setLeadsSearchQuery] = useState("");
  const [showLeadsSearch, setShowLeadsSearch] = useState(false);

  const [leadsPreviewModal, setLeadsPreviewModal] = useState({
    open: false,
    leads: [],
    orderId: null,
    order: null,
  });

  // IPQS validation success state (tracks leadIds that were just successfully validated)
  const [ipqsValidationSuccess, setIpqsValidationSuccess] = useState([]);
  // IPQS validation in progress state (tracks orderIds being validated)
  const [ipqsValidatingOrders, setIpqsValidatingOrders] = useState([]);

  // Lead removal selection state for leads preview modal
  const [leadRemovalMode, setLeadRemovalMode] = useState(false);
  const [selectedLeadsForRemoval, setSelectedLeadsForRemoval] = useState([]);
  const [removingLeads, setRemovingLeads] = useState(false);

  // Undo action state - tracks the last undoable action for lead removal/replacement
  const [undoAction, setUndoAction] = useState(null);
  // undoAction structure: { type: 'removal' | 'replacement', orderId, leadId, oldLeadId?, leadName, timestamp }
  const [undoing, setUndoing] = useState(false);

  // Restore lead state
  const [restoringLead, setRestoringLead] = useState(null);

  // Undo replacement state
  const [undoingReplacement, setUndoingReplacement] = useState(null);

  // Removal reason dialog state
  const [removalReasonDialog, setRemovalReasonDialog] = useState({
    open: false,
    reason: "",
    customReason: "",
  });

  // Actions menu state for leads preview modal
  const [previewActionsMenu, setPreviewActionsMenu] = useState({
    anchorEl: null,
    lead: null,
  });

  // Remote Browser Dialog State
  const [browserDialog, setBrowserDialog] = useState({
    open: false,
    lead: null,
  });

  // Client Brokers Display Dialog State
  const [clientBrokersDialog, setClientBrokersDialog] = useState({
    open: false,
    brokers: [],
    leadName: "",
  });

  // Client Networks Display Dialog State
  const [clientNetworksDialog, setClientNetworksDialog] = useState({
    open: false,
    networks: [],
    leadName: "",
  });

  // Our Networks Display Dialog State
  const [ourNetworksDialog, setOurNetworksDialog] = useState({
    open: false,
    networks: [],
    leadName: "",
  });

  // Campaigns Display Dialog State
  const [campaignsDialog, setCampaignsDialog] = useState({
    open: false,
    campaigns: [],
    leadName: "",
  });

  // Apply Agent Fine Dialog State
  const [applyFineDialog, setApplyFineDialog] = useState({
    open: false,
    agent: null,
    lead: null,
    orderId: null,
  });

  // PSP Selection Dialog State for Confirm Deposit (2-step: Card Issuer -> PSP)
  const [pspDepositDialog, setPspDepositDialog] = useState({
    open: false,
    lead: null,
    orderId: null,
    step: 1, // 1 = select card issuer, 2 = select PSP
    cardIssuers: [],
    selectedCardIssuer: null,
    newCardIssuerName: "",
    creatingIssuer: false,
    psps: [],
    loading: false,
    selectedPsp: null,
    newPspWebsite: "",
    creatingPsp: false,
  });

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(createOrderSchema(user?.role)),
    defaultValues: createOrderSchema(user?.role).getDefault(),
  });
  const [changeFTDDialog, setChangeFTDDialog] = useState({
    open: false,
    order: null,
    lead: null,
  });
  const [assignLeadDialog, setAssignLeadDialog] = useState({
    open: false,
    lead: null,
  });
  const [replaceLeadDialog, setReplaceLeadDialog] = useState({
    open: false,
    order: null,
    lead: null,
  });
  const [processingLeads, setProcessingLeads] = useState({});
  const [copyPreferencesOpen, setCopyPreferencesOpen] = useState(false);
  const [copyNotification, setCopyNotification] = useState({
    open: false,
    message: "",
  });

  // Create Broker Dialog State
  const [createBrokerDialog, setCreateBrokerDialog] = useState({
    open: false,
    loading: false,
  });
  const [manageBrokersDialog, setManageBrokersDialog] = useState({
    open: false,
    loading: false,
  });

  // Change Requester State
  const [changeRequesterOpen, setChangeRequesterOpen] = useState(false);
  const [requesterHistoryOpen, setRequesterHistoryOpen] = useState(false);
  const [selectedOrderForRequester, setSelectedOrderForRequester] =
    useState(null);
  const [potentialRequesters, setPotentialRequesters] = useState([]);
  const [loadingRequesters, setLoadingRequesters] = useState(false);
  const [selectedNewRequester, setSelectedNewRequester] = useState(null);

  // Order Audit Log State
  const [orderAuditDialog, setOrderAuditDialog] = useState({
    open: false,
    order: null,
    auditLogs: [],
    loading: false,
  });

  // Edit Planned Date State
  const [editPlannedDateDialog, setEditPlannedDateDialog] = useState({
    open: false,
    order: null,
    loading: false,
  });
  const [newPlannedDate, setNewPlannedDate] = useState("");

  // Edit Network Configuration State (admin only)
  const [editNetworkConfigDialog, setEditNetworkConfigDialog] = useState({
    open: false,
    order: null,
    loading: false,
    field: null, // 'campaign', 'ourNetwork', or 'clientNetwork'
  });
  const [newNetworkValue, setNewNetworkValue] = useState("");

  const fetchPotentialRequesters = useCallback(async () => {
    try {
      setLoadingRequesters(true);
      const response = await api.get("/users?isActive=true&limit=1000");
      // Filter to only show affiliate managers and admins (exclude agents)
      const filteredUsers = response.data.data.filter(
        (u) => u.role === "affiliate_manager" || u.role === "admin"
      );
      setPotentialRequesters(filteredUsers);
    } catch (error) {
      console.error("Error fetching potential requesters:", error);
      setNotification({
        message: "Failed to fetch users list",
        severity: "error",
      });
    } finally {
      setLoadingRequesters(false);
    }
  }, []);

  useEffect(() => {
    if (changeRequesterOpen) {
      fetchPotentialRequesters();
    }
  }, [changeRequesterOpen, fetchPotentialRequesters]);

  // Order Audit Log handlers
  const handleOpenOrderAudit = useCallback(async (order) => {
    setOrderAuditDialog({
      open: true,
      order,
      auditLogs: [],
      loading: true,
    });

    try {
      // Fetch full order with auditLog
      const response = await api.get(`/orders/${order._id}`);
      const fullOrder = response.data.data;

      // Collect all audit logs from the order
      const allAuditLogs = [];

      // Add order audit log entries (these are stored on the Order model and persist)
      if (fullOrder.auditLog && fullOrder.auditLog.length > 0) {
        fullOrder.auditLog.forEach((log) => {
          allAuditLogs.push({
            ...log,
            leadName: log.newValue?.leadName || log.previousValue?.leadName || null,
          });
        });
      }

      // Add requester change history
      if (fullOrder.requesterHistory && fullOrder.requesterHistory.length > 0) {
        fullOrder.requesterHistory.forEach((history) => {
          allAuditLogs.push({
            action: "requester_changed",
            performedBy: history.changedBy,
            performedAt: history.changedAt,
            details: `Requester changed from ${history.previousRequester?.fullName || "Unknown"} to ${history.newRequester?.fullName || "Unknown"}`,
            previousValue: history.previousRequester?.fullName,
            newValue: history.newRequester?.fullName,
          });
        });
      }

      // Sort by date (newest first)
      allAuditLogs.sort(
        (a, b) => new Date(b.performedAt) - new Date(a.performedAt)
      );

      setOrderAuditDialog((prev) => ({
        ...prev,
        auditLogs: allAuditLogs,
        loading: false,
      }));
    } catch (err) {
      console.error("Failed to fetch order audit logs:", err);
      setNotification({
        message: "Failed to fetch audit logs",
        severity: "error",
      });
      setOrderAuditDialog((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  const handleCloseOrderAudit = useCallback(() => {
    setOrderAuditDialog({
      open: false,
      order: null,
      auditLogs: [],
      loading: false,
    });
  }, []);

  const handleOpenChangeRequester = (order) => {
    setSelectedOrderForRequester(order);
    setSelectedNewRequester(null);
    setChangeRequesterOpen(true);
  };

  const handleOpenRequesterHistory = (order) => {
    setSelectedOrderForRequester(order);
    setRequesterHistoryOpen(true);
  };

  const handleSubmitChangeRequester = async () => {
    if (!selectedOrderForRequester || !selectedNewRequester) return;

    try {
      await api.put(
        `/orders/${selectedOrderForRequester._id}/change-requester`,
        {
          newRequesterId: selectedNewRequester._id,
        }
      );
      setChangeRequesterOpen(false);
      setNotification({
        message: "Requester changed successfully",
        severity: "success",
      });

      // Update expandedRowData immediately if the order is expanded
      const orderId = selectedOrderForRequester._id;
      if (expandedRowData[orderId]) {
        setExpandedRowData((prev) => ({
          ...prev,
          [orderId]: {
            ...prev[orderId],
            requester: selectedNewRequester,
          },
        }));
      }

      fetchOrders();
    } catch (err) {
      setNotification({
        message: err.response?.data?.message || "Failed to change requester",
        severity: "error",
      });
    }
  };

  // Edit Planned Date handlers
  const handleOpenEditPlannedDate = (order) => {
    const currentDate = order.plannedDate
      ? new Date(order.plannedDate).toISOString().split("T")[0]
      : "";
    setNewPlannedDate(currentDate);
    setEditPlannedDateDialog({
      open: true,
      order,
      loading: false,
    });
  };

  const handleCloseEditPlannedDate = () => {
    setEditPlannedDateDialog({
      open: false,
      order: null,
      loading: false,
    });
    setNewPlannedDate("");
  };

  const handleSubmitEditPlannedDate = async () => {
    if (!editPlannedDateDialog.order || !newPlannedDate) return;

    setEditPlannedDateDialog((prev) => ({ ...prev, loading: true }));

    try {
      await api.put(`/orders/${editPlannedDateDialog.order._id}`, {
        plannedDate: new Date(newPlannedDate).toISOString(),
      });

      setNotification({
        message: "Planned date updated successfully",
        severity: "success",
      });

      // Update expandedRowData immediately if the order is expanded
      const orderId = editPlannedDateDialog.order._id;
      if (expandedRowData[orderId]) {
        setExpandedRowData((prev) => ({
          ...prev,
          [orderId]: {
            ...prev[orderId],
            plannedDate: new Date(newPlannedDate).toISOString(),
          },
        }));
      }

      handleCloseEditPlannedDate();
      fetchOrders();
    } catch (err) {
      setNotification({
        message: err.response?.data?.message || "Failed to update planned date",
        severity: "error",
      });
      setEditPlannedDateDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  // Network Configuration Edit Handlers (admin only)
  const handleOpenEditNetworkConfig = (order, field) => {
    let currentValue = "";
    if (field === "campaign" && order.selectedCampaign) {
      currentValue = order.selectedCampaign._id || order.selectedCampaign;
    } else if (field === "ourNetwork" && order.selectedOurNetwork) {
      currentValue = order.selectedOurNetwork._id || order.selectedOurNetwork;
    } else if (field === "clientNetwork" && order.selectedClientNetwork) {
      currentValue = order.selectedClientNetwork._id || order.selectedClientNetwork;
    }
    setNewNetworkValue(currentValue);
    setEditNetworkConfigDialog({
      open: true,
      order,
      loading: false,
      field,
    });
    // Fetch the relevant data for the dropdown
    if (field === "campaign") {
      fetchCampaigns();
    } else if (field === "ourNetwork") {
      fetchOurNetworks();
    } else if (field === "clientNetwork") {
      fetchClientNetworks();
    }
  };

  const handleCloseEditNetworkConfig = () => {
    setEditNetworkConfigDialog({
      open: false,
      order: null,
      loading: false,
      field: null,
    });
    setNewNetworkValue("");
  };

  const handleSubmitEditNetworkConfig = async () => {
    if (!editNetworkConfigDialog.order || !editNetworkConfigDialog.field) return;

    setEditNetworkConfigDialog((prev) => ({ ...prev, loading: true }));

    try {
      const updateData = {};
      const { field } = editNetworkConfigDialog;

      if (field === "campaign") {
        updateData.selectedCampaign = newNetworkValue;
      } else if (field === "ourNetwork") {
        updateData.selectedOurNetwork = newNetworkValue || null;
      } else if (field === "clientNetwork") {
        updateData.selectedClientNetwork = newNetworkValue || null;
      }

      const response = await api.put(
        `/orders/${editNetworkConfigDialog.order._id}`,
        updateData
      );

      const fieldLabels = {
        campaign: "Campaign",
        ourNetwork: "Our Network",
        clientNetwork: "Client Network",
      };

      setNotification({
        message: `${fieldLabels[field]} updated successfully. All leads in the order have been updated.`,
        severity: "success",
      });

      // Update expandedRowData immediately if the order is expanded
      const orderId = editNetworkConfigDialog.order._id;
      if (expandedRowData[orderId]) {
        const updatedOrder = response.data.data;
        setExpandedRowData((prev) => ({
          ...prev,
          [orderId]: {
            ...prev[orderId],
            selectedCampaign: updatedOrder.selectedCampaign,
            selectedOurNetwork: updatedOrder.selectedOurNetwork,
            selectedClientNetwork: updatedOrder.selectedClientNetwork,
          },
        }));
      }

      handleCloseEditNetworkConfig();
      fetchOrders();
    } catch (err) {
      setNotification({
        message:
          err.response?.data?.message || "Failed to update network configuration",
        severity: "error",
      });
      setEditNetworkConfigDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  // Delete Broker Confirmation State
  const [deleteBrokerDialog, setDeleteBrokerDialog] = useState({
    open: false,
    broker: null,
    loading: false,
  });

  // Edit Broker Dialog State
  const [editBrokerDialog, setEditBrokerDialog] = useState({
    open: false,
    broker: null,
    loading: false,
  });

  // Refunds Manager Assignment State
  const [refundsAssignmentDialog, setRefundsAssignmentDialog] = useState({
    open: false,
    orderId: null,
  });

  // Mark Shaved Dialog State
  const [markShavedDialog, setMarkShavedDialog] = useState({
    open: false,
    lead: null,
    orderId: null,
    loading: false,
  });

  // Add Leads to Order Dialog State (Admin only)
  const [addLeadsDialog, setAddLeadsDialog] = useState({
    open: false,
    order: null,
    loading: false,
  });
  const [addLeadsEmails, setAddLeadsEmails] = useState("");
  const [addLeadsSearching, setAddLeadsSearching] = useState(false);
  const [addLeadsFound, setAddLeadsFound] = useState([]); // [{lead, agent, leadType}]

  // Add Leads Confirmation Dialog State (for reason selection)
  const [addLeadsConfirmDialog, setAddLeadsConfirmDialog] = useState({
    open: false,
    reason: "",
    customReason: "",
    missingAgentId: "",
    loading: false,
  });

  // Delete Order Confirmation State
  const [deleteOrderDialog, setDeleteOrderDialog] = useState({
    open: false,
    orderId: null,
    orderStatus: null,
    permanentDelete: false,
    loading: false,
  });

  // Remove Lead from Order Dialog State
  const [removeLeadDialog, setRemoveLeadDialog] = useState({
    open: false,
    leadId: null,
    leadName: "",
    reason: "",
    customReason: "",
    missingAgentId: "",
    loading: false,
  });

  const LEAD_CHANGE_REASONS = [
    "Lead is not sent",
    "Email not working",
    "Phone not working",
    "One or more leads from this order were already shaved",
    "Lead failed",
    "Agent is missing",
    "Other",
  ];

  // Keep alias for backward compatibility
  const REMOVE_LEAD_REASONS = LEAD_CHANGE_REASONS;

  // Autocomplete states for Create Order Dialog
  const [clientNetworkInput, setClientNetworkInput] = useState("");
  const [clientNetworkOpen, setClientNetworkOpen] = useState(false);

  const [ourNetworkInput, setOurNetworkInput] = useState("");
  const [ourNetworkOpen, setOurNetworkOpen] = useState(false);

  const [campaignInput, setCampaignInput] = useState("");
  const [campaignOpen, setCampaignOpen] = useState(false);

  // Helper function to get lead metadata from order
  // This merges order-specific deposit/shaved status into the lead object
  const getLeadWithOrderMetadata = useCallback((lead, order) => {
    if (!order || !order.leadsMetadata || !lead) return lead;

    const leadId = lead._id || lead.id;
    const metadata = order.leadsMetadata.find(
      (meta) => meta.leadId === leadId || meta.leadId?._id === leadId ||
                (typeof meta.leadId === 'string' && meta.leadId === leadId)
    );

    if (!metadata) return lead;

    // Merge order-specific metadata into lead object for display
    return {
      ...lead,
      // Override lead-level deposit/shaved with order-level values
      depositConfirmed: metadata.depositConfirmed || false,
      depositConfirmedBy: metadata.depositConfirmedBy,
      depositConfirmedAt: metadata.depositConfirmedAt,
      depositPSP: metadata.depositPSP,
      shaved: metadata.shaved || false,
      shavedBy: metadata.shavedBy,
      shavedAt: metadata.shavedAt,
      shavedRefundsManager: metadata.shavedRefundsManager,
      shavedManagerAssignedBy: metadata.shavedManagerAssignedBy,
      shavedManagerAssignedAt: metadata.shavedManagerAssignedAt,
    };
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setNotification({ message: "", severity: "info" });
    try {
      const params = new URLSearchParams({
        page: page + 1,
        limit: rowsPerPage,
      });
      Object.entries(debouncedFilters).forEach(([key, value]) => {
        if (value) {
          params.append(key, value);
        }
      });
      const response = await api.get(`/orders?${params}`);
      setOrders(response.data.data);
      setTotalOrders(response.data.pagination.total);
    } catch (err) {
      setNotification({
        message: err.response?.data?.message || "Failed to fetch orders",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, debouncedFilters]);
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Listen for real-time lead updates to sync across pages
  useEffect(() => {
    const handleLeadUpdate = (data) => {
      const updatedLead = data.lead;
      if (!updatedLead?._id) return;

      // Update leads in all orders that contain this lead
      setOrders((prevOrders) =>
        prevOrders.map((order) => {
          // Check if this order contains the updated lead
          const leadIndex = order.leads?.findIndex(
            (lead) => lead._id === updatedLead._id
          );

          if (leadIndex === -1 || leadIndex === undefined) {
            return order;
          }

          // Create a new leads array with the updated lead
          const updatedLeads = [...order.leads];
          // Preserve orderedAs from leadsMetadata if it exists
          const metadata = order.leadsMetadata?.find(
            (m) => m.leadId === updatedLead._id || m.leadId?._id === updatedLead._id
          );
          updatedLeads[leadIndex] = {
            ...updatedLead,
            orderedAs: metadata?.orderedAs || updatedLeads[leadIndex].orderedAs,
          };

          return {
            ...order,
            leads: updatedLeads,
          };
        })
      );

      // Also update expanded row data if the lead is there
      setExpandedRowData((prev) => {
        const newData = { ...prev };
        Object.keys(newData).forEach((orderId) => {
          const orderData = newData[orderId];
          if (orderData?.leads) {
            const leadIndex = orderData.leads.findIndex(
              (lead) => lead._id === updatedLead._id
            );
            if (leadIndex !== -1) {
              const updatedLeads = [...orderData.leads];
              const metadata = orderData.leadsMetadata?.find(
                (m) => m.leadId === updatedLead._id || m.leadId?._id === updatedLead._id
              );
              updatedLeads[leadIndex] = {
                ...updatedLead,
                orderedAs: metadata?.orderedAs || updatedLeads[leadIndex].orderedAs,
              };
              newData[orderId] = {
                ...orderData,
                leads: updatedLeads,
              };
            }
          }
        });
        return newData;
      });
    };

    chatService.on("leads:updated", handleLeadUpdate);

    return () => {
      chatService.off("leads:updated", handleLeadUpdate);
    };
  }, []);

  useEffect(() => {
    if (notification.message) {
      const timer = setTimeout(() => {
        setNotification({ message: "", severity: "info" });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification.message]);
  const fetchClientNetworks = useCallback(async () => {
    // Both admins and affiliate managers can access all client networks
    if (user?.role !== "admin" && user?.role !== "affiliate_manager") return;
    setLoadingClientNetworks(true);
    try {
      const response = await api.get(
        "/client-networks?isActive=true&limit=1000"
      );
      setClientNetworks(response.data.data || []);
    } catch (err) {
      console.error("Failed to fetch client networks:", err);
      setNotification({
        message: "Failed to load client networks",
        severity: "warning",
      });
    } finally {
      setLoadingClientNetworks(false);
    }
  }, [user?.role]);

  const fetchOurNetworks = useCallback(async () => {
    if (user?.role !== "affiliate_manager" && user?.role !== "admin") return;
    setLoadingOurNetworks(true);
    try {
      const endpoint =
        user?.role === "affiliate_manager"
          ? "/our-networks/my-networks"
          : "/our-networks?isActive=true&limit=1000";
      const response = await api.get(endpoint);
      setOurNetworks(response.data.data || []);
    } catch (err) {
      console.error("Failed to fetch our networks:", err);
      setNotification({
        message: "Failed to load our networks",
        severity: "warning",
      });
    } finally {
      setLoadingOurNetworks(false);
    }
  }, [user?.role]);
  const fetchCampaigns = useCallback(async () => {
    setLoadingCampaigns(true);
    try {
      const endpoint =
        user?.role === "affiliate_manager"
          ? "/campaigns/my-campaigns"
          : "/campaigns?isActive=true&status=active&limit=1000";
      const response = await api.get(endpoint);
      setCampaigns(response.data.data || []);
    } catch (err) {
      console.error("Failed to fetch campaigns:", err);
      setNotification({
        message: "Failed to load campaigns",
        severity: "warning",
      });
    } finally {
      setLoadingCampaigns(false);
    }
  }, [user?.role]);

  const fetchClientBrokers = useCallback(async () => {
    setLoadingClientBrokers(true);
    try {
      const response = await api.get(
        "/client-brokers?isActive=true&limit=1000"
      );
      setClientBrokers(response.data.data || []);
    } catch (err) {
      console.error("Failed to fetch client brokers:", err);
      setNotification({
        message: "Failed to load client brokers",
        severity: "warning",
      });
    } finally {
      setLoadingClientBrokers(false);
    }
  }, []);

  const fetchAgents = useCallback(async () => {
    setLoadingAgents(true);
    try {
      const response = await api.get("/users/agents-with-lead-stats");
      setAgents(response.data.data || []);
    } catch (err) {
      console.error("Failed to fetch agents:", err);
      setNotification({
        message: "Failed to load agents",
        severity: "warning",
      });
    } finally {
      setLoadingAgents(false);
    }
  }, []);

  // Fetch agents with lead stats filtered by specific criteria
  const fetchFilteredAgents = useCallback(
    async (leadType, country, clientNetwork, clientBrokers = []) => {
      if (!leadType || !country || !clientNetwork) {
        return;
      }

      setFilteredAgentsLoading(true);
      try {
        const response = await api.post(
          "/users/agents-with-filtered-lead-stats",
          {
            leadType,
            country,
            clientNetwork,
            clientBrokers,
          }
        );

        setFilteredAgents(response.data.data || []);

        // Store unassigned leads stats by lead type
        setUnassignedLeadsStats((prev) => ({
          ...prev,
          [leadType]: response.data.unassignedLeads || null,
        }));

        return response.data;
      } catch (err) {
        console.error("Failed to fetch filtered agents:", err);
        setNotification({
          message:
            err.response?.data?.message ||
            "Failed to load agents with matching leads",
          severity: "warning",
        });
        return null;
      } finally {
        setFilteredAgentsLoading(false);
      }
    },
    []
  );

  // Fetch all agents for manual lead selection
  const fetchAllAgents = useCallback(async () => {
    try {
      const response = await api.get("/users?role=agent&limit=1000");
      setAllAgents(response.data.data || []);
    } catch (err) {
      console.error("Failed to fetch all agents:", err);
    }
  }, []);

  // Search leads by emails for manual selection
  const searchLeadsByEmails = useCallback(async () => {
    if (!manualLeadEmails.trim()) {
      setNotification({
        message: "Please enter at least one email address",
        severity: "warning",
      });
      return;
    }

    setSearchingLeads(true);
    try {
      // Parse emails - support both newline and space separated
      const emails = manualLeadEmails
        .split(/[\n\s,]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.length > 0);

      if (emails.length === 0) {
        setNotification({
          message: "No valid emails found",
          severity: "warning",
        });
        return;
      }

      // Search for leads by emails
      const response = await api.post("/leads/search-by-emails", { emails });
      const foundLeads = response.data.data || [];

      if (foundLeads.length === 0) {
        setNotification({
          message: "No leads found with the provided emails",
          severity: "warning",
        });
        return;
      }

      // Map found leads to manual selection format (include cooldown status)
      const manualLeadEntries = foundLeads.map((lead) => ({
        lead,
        agent: lead.assignedAgent?._id || "",
        isOnCooldown: lead.isOnCooldown || false,
        cooldownDaysRemaining: lead.cooldownDaysRemaining || 0,
      }));

      setManualLeads(manualLeadEntries);

      // Count active vs cooldown leads
      const activeLeads = manualLeadEntries.filter((e) => !e.isOnCooldown);
      const cooldownLeads = manualLeadEntries.filter((e) => e.isOnCooldown);

      // Show notification about found/not found/cooldown
      const notFoundEmails = emails.filter(
        (email) =>
          !foundLeads.some(
            (lead) => lead.newEmail.toLowerCase() === email.toLowerCase()
          )
      );

      let notificationMessage = `Found ${foundLeads.length} leads`;
      let notificationSeverity = "success";

      if (cooldownLeads.length > 0) {
        // Admin can add cooldown leads, non-admin cannot
        if (user?.role === "admin") {
          notificationMessage += ` (${cooldownLeads.length} on cooldown - admin override)`;
        } else {
          notificationMessage += ` (${cooldownLeads.length} on cooldown - will be excluded)`;
          notificationSeverity = "warning";
        }
      }

      if (notFoundEmails.length > 0) {
        notificationMessage += `. Not found: ${notFoundEmails.join(", ")}`;
        notificationSeverity = "warning";
      }

      // Only block if all leads on cooldown AND user is not admin
      if (activeLeads.length === 0 && foundLeads.length > 0 && user?.role !== "admin") {
        notificationMessage = `All ${foundLeads.length} found leads are on cooldown. Cannot create order.`;
        notificationSeverity = "error";
      }

      setNotification({
        message: notificationMessage,
        severity: notificationSeverity,
      });
    } catch (err) {
      console.error("Failed to search leads:", err);
      setNotification({
        message: err.response?.data?.message || "Failed to search leads",
        severity: "error",
      });
    } finally {
      setSearchingLeads(false);
    }
  }, [manualLeadEmails, user]);

  // Update manual lead agent assignment
  const updateManualLeadAgent = useCallback((index, agentId) => {
    setManualLeads((prev) =>
      prev.map((entry, i) =>
        i === index ? { ...entry, agent: agentId } : entry
      )
    );
  }, []);

  // Remove a lead from manual selection
  const removeManualLead = useCallback((index) => {
    setManualLeads((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Add Leads to Order handlers (Admin only)
  const handleOpenAddLeadsDialog = useCallback((order) => {
    setAddLeadsDialog({ open: true, order, loading: false });
    setAddLeadsEmails("");
    setAddLeadsFound([]);
    fetchAllAgents(); // Fetch agents for the dialog
  }, [fetchAllAgents]);

  const handleCloseAddLeadsDialog = useCallback(() => {
    setAddLeadsDialog({ open: false, order: null, loading: false });
    setAddLeadsEmails("");
    setAddLeadsFound([]);
  }, []);

  const searchLeadsForAddToOrder = useCallback(async () => {
    if (!addLeadsEmails.trim()) {
      setNotification({
        message: "Please enter at least one email address",
        severity: "warning",
      });
      return;
    }

    setAddLeadsSearching(true);
    try {
      const emails = addLeadsEmails
        .split(/[\n\s,]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.length > 0);

      if (emails.length === 0) {
        setNotification({
          message: "No valid emails found",
          severity: "warning",
        });
        return;
      }

      // Pass orderId to get status info (isInOrder, isOnCooldown)
      const response = await api.post("/leads/search-by-emails", {
        emails,
        orderId: addLeadsDialog.order?._id,
      });
      const foundLeads = response.data.data || [];

      if (foundLeads.length === 0) {
        setNotification({
          message: "No leads found with the provided emails",
          severity: "warning",
        });
        return;
      }

      // Get order's country filter
      const orderCountry = addLeadsDialog.order?.countryFilter;

      // Map all found leads to add leads format (including those with issues)
      // Admin can add leads on cooldown, but not archived (already filtered by backend) or in order
      const isAdmin = user?.role === "admin";
      const addLeadsEntries = foundLeads.map((lead) => {
        const isWrongCountry = orderCountry && lead.country !== orderCountry;
        // Admin bypasses cooldown check
        const cooldownBlocks = lead.isOnCooldown && !isAdmin;
        return {
          lead,
          agent: lead.assignedAgent?._id || "",
          leadType: lead.leadType || "ftd",
          isInOrder: lead.isInOrder || false,
          isOnCooldown: lead.isOnCooldown || false,
          cooldownDaysRemaining: lead.cooldownDaysRemaining || 0,
          isWrongCountry: isWrongCountry,
          canAdd: !lead.isInOrder && !cooldownBlocks && !isWrongCountry,
        };
      });

      setAddLeadsFound(addLeadsEntries);

      // Show notification about found/not found
      const notFoundEmails = emails.filter(
        (email) =>
          !foundLeads.some(
            (lead) => lead.newEmail?.toLowerCase() === email.toLowerCase()
          )
      );

      const alreadyInOrder = addLeadsEntries.filter((e) => e.isInOrder).length;
      const onCooldown = addLeadsEntries.filter((e) => e.isOnCooldown && !e.isInOrder).length;
      const wrongCountry = addLeadsEntries.filter((e) => e.isWrongCountry && !e.isInOrder && !e.isOnCooldown).length;
      const canAddCount = addLeadsEntries.filter((e) => e.canAdd).length;

      let msg = `Found ${foundLeads.length} leads.`;
      if (canAddCount > 0) msg = `${canAddCount} leads ready to add.`;
      if (alreadyInOrder > 0) msg += ` ${alreadyInOrder} already in order.`;
      if (onCooldown > 0) {
        if (isAdmin) {
          msg += ` ${onCooldown} on cooldown (admin override).`;
        } else {
          msg += ` ${onCooldown} on cooldown.`;
        }
      }
      if (wrongCountry > 0) msg += ` ${wrongCountry} wrong country (order requires ${orderCountry}).`;
      if (notFoundEmails.length > 0)
        msg += ` Not found: ${notFoundEmails.join(", ")}`;

      setNotification({
        message: msg,
        severity: canAddCount > 0 ? "success" : "warning",
      });
    } catch (err) {
      console.error("Failed to search leads:", err);
      setNotification({
        message: err.response?.data?.message || "Failed to search leads",
        severity: "error",
      });
    } finally {
      setAddLeadsSearching(false);
    }
  }, [addLeadsEmails, addLeadsDialog.order, user]);

  const updateAddLeadAgent = useCallback((index, agentId) => {
    setAddLeadsFound((prev) =>
      prev.map((entry, i) =>
        i === index ? { ...entry, agent: agentId } : entry
      )
    );
  }, []);

  const updateAddLeadType = useCallback((index, leadType) => {
    setAddLeadsFound((prev) =>
      prev.map((entry, i) =>
        i === index ? { ...entry, leadType } : entry
      )
    );
  }, []);

  const removeAddLead = useCallback((index) => {
    setAddLeadsFound((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Open confirmation dialog when user clicks "Add Leads"
  const handleSubmitAddLeads = useCallback(() => {
    // Only submit leads that can be added (not on cooldown, not already in order, correct country)
    const eligibleLeads = addLeadsFound.filter((entry) => entry.canAdd);

    if (eligibleLeads.length === 0) {
      setNotification({
        message: "No eligible leads to add. All leads are either on cooldown, already in the order, or from a different country.",
        severity: "warning",
      });
      return;
    }

    // Open confirmation dialog for reason selection
    setAddLeadsConfirmDialog({
      open: true,
      reason: "",
      customReason: "",
      missingAgentId: "",
      loading: false,
    });
  }, [addLeadsFound]);

  // Close add leads confirmation dialog
  const handleCloseAddLeadsConfirmDialog = useCallback(() => {
    setAddLeadsConfirmDialog({
      open: false,
      reason: "",
      customReason: "",
      missingAgentId: "",
      loading: false,
    });
  }, []);

  // Actually submit the leads after reason is selected
  const handleConfirmAddLeads = useCallback(async () => {
    const { reason, customReason, missingAgentId } = addLeadsConfirmDialog;

    // Validate reason is provided
    if (!reason) {
      setNotification({
        message: "Please select a reason for adding leads",
        severity: "warning",
      });
      return;
    }

    // Validate custom reason if "Other" is selected
    if (reason === "Other" && !customReason.trim()) {
      setNotification({
        message: "Please enter a custom reason",
        severity: "warning",
      });
      return;
    }

    // Validate missing agent if "Agent is missing" is selected
    if (reason === "Agent is missing" && !missingAgentId) {
      setNotification({
        message: "Please select which agent is missing",
        severity: "warning",
      });
      return;
    }

    // Build the final reason
    let finalReason = reason;
    if (reason === "Other") {
      finalReason = customReason;
    } else if (reason === "Agent is missing") {
      const missingAgent = allAgents.find(a => a._id === missingAgentId);
      finalReason = `Agent is missing: ${missingAgent?.fullName || missingAgentId}`;
    }

    setAddLeadsConfirmDialog((prev) => ({ ...prev, loading: true }));
    const orderId = addLeadsDialog.order._id;
    const wasExpanded = !!expandedRowData[orderId];

    try {
      const eligibleLeads = addLeadsFound.filter((entry) => entry.canAdd);
      const leadsToAdd = eligibleLeads.map((entry) => ({
        leadId: entry.lead._id,
        agentId: entry.agent || null,
        leadType: entry.leadType,
      }));

      await api.post(`/orders/${orderId}/add-leads`, {
        leads: leadsToAdd,
        reason: finalReason,
      });

      setNotification({
        message: `Successfully added ${leadsToAdd.length} lead(s) to the order`,
        severity: "success",
      });

      // Close both dialogs
      handleCloseAddLeadsConfirmDialog();
      handleCloseAddLeadsDialog();

      // Clear expanded row data for this order so it will be re-fetched
      if (wasExpanded) {
        setExpandedRowData((prev) => {
          const newData = { ...prev };
          delete newData[orderId];
          return newData;
        });
      }

      // Fetch fresh order data for immediate update
      const fullResponse = await api.get(`/orders/${orderId}`);
      const fullOrderData = fullResponse.data.data;

      // Update orders list
      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          order._id === orderId ? { ...order, ...fullOrderData } : order
        )
      );

      // Re-expand the order if it was expanded before
      if (wasExpanded) {
        setExpandedRowData((prev) => ({
          ...prev,
          [orderId]: {
            ...fullOrderData,
            leadsLoading: false,
          },
        }));
      }

      // Update leadsPreviewModal if open for this order
      if (leadsPreviewModal.open && leadsPreviewModal.orderId === orderId) {
        setLeadsPreviewModal((prev) => ({
          ...prev,
          leads: fullOrderData.leads || prev.leads,
          order: fullOrderData,
        }));
      }

      // Auto-validate newly added leads with IPQS
      const addedLeadIds = leadsToAdd.map((l) => l.leadId);
      const validationResults = [];
      for (const leadId of addedLeadIds) {
        try {
          const validateRes = await api.post(`/orders/${orderId}/leads/${leadId}/validate-ipqs`);
          if (validateRes.data.success && !validateRes.data.data.alreadyValidated) {
            validationResults.push({ leadId, validation: validateRes.data.data });
          }
        } catch (err) {
          console.error("Auto IPQS validation failed for added lead:", err);
        }
      }

      // Update UI with IPQS validation results
      if (validationResults.length > 0) {
        const validationMap = new Map(
          validationResults.map((r) => [r.leadId, r.validation])
        );

        // Update leadsPreviewModal with validation results
        if (leadsPreviewModal.open && leadsPreviewModal.orderId === orderId) {
          setLeadsPreviewModal((prev) => ({
            ...prev,
            leads: prev.leads.map((lead) => {
              const validation = validationMap.get(lead._id);
              if (validation) {
                return {
                  ...lead,
                  ipqsValidation: {
                    email: validation.email,
                    phone: validation.phone,
                    summary: validation.summary,
                    validatedAt: validation.validatedAt,
                  },
                };
              }
              return lead;
            }),
          }));
        }

        // Update expandedRowData with validation results
        if (wasExpanded) {
          setExpandedRowData((prev) => ({
            ...prev,
            [orderId]: {
              ...prev[orderId],
              leads: prev[orderId].leads?.map((lead) => {
                const validation = validationMap.get(lead._id);
                if (validation) {
                  return {
                    ...lead,
                    ipqsValidation: {
                      email: validation.email,
                      phone: validation.phone,
                      summary: validation.summary,
                      validatedAt: validation.validatedAt,
                    },
                  };
                }
                return lead;
              }),
            },
          }));
        }

        // Show success indicators on validated leads
        const validatedLeadIds = validationResults.map((r) => r.leadId);
        setIpqsValidationSuccess(validatedLeadIds);
        setTimeout(() => {
          setIpqsValidationSuccess([]);
        }, 2000);
      }
    } catch (err) {
      console.error("Failed to add leads to order:", err);
      setNotification({
        message: err.response?.data?.message || "Failed to add leads to order",
        severity: "error",
      });
    } finally {
      setAddLeadsConfirmDialog((prev) => ({ ...prev, loading: false }));
    }
  }, [
    addLeadsConfirmDialog,
    addLeadsDialog.order,
    addLeadsFound,
    allAgents,
    handleCloseAddLeadsConfirmDialog,
    handleCloseAddLeadsDialog,
    expandedRowData,
    leadsPreviewModal.open,
    leadsPreviewModal.orderId,
  ]);

  const checkFulfillment = useCallback(
    async (data) => {
      // Skip if manual mode or required fields missing
      if (manualSelectionMode || !data) return;

      // Minimal validation to avoid spamming empty checks
      const hasLeads = data.ftd > 0 || data.filler > 0 || data.cold > 0;
      if (!hasLeads) {
        setFulfillmentSummary(null);
        return;
      }

      setCheckingFulfillment(true);
      try {
        // Build agent assignments
        const agentAssignments = [];
        if (data.ftdAgents && data.ftdAgents.length > 0) {
          data.ftdAgents.forEach((agentId, index) => {
            if (agentId)
              agentAssignments.push({ leadType: "ftd", agentId, index });
          });
        }
        if (data.fillerAgents && data.fillerAgents.length > 0) {
          data.fillerAgents.forEach((agentId, index) => {
            if (agentId)
              agentAssignments.push({ leadType: "filler", agentId, index });
          });
        }

        const checkData = {
          requests: {
            ftd: Number(data.ftd) || 0,
            filler: Number(data.filler) || 0,
            cold: Number(data.cold) || 0,
          },
          country: data.countryFilter,
          gender: data.genderFilter,
          selectedClientNetwork: data.selectedClientNetwork,
          selectedClientBrokers: data.selectedClientBrokers,
          agentFilter: data.agentFilter || null,
          agentAssignments,
        };

        const response = await api.post("/orders/check-fulfillment", checkData);
        setFulfillmentSummary(response.data.summary);
      } catch (err) {
        console.error("Fulfillment check failed:", err);
        // Don't show error notification for background check
      } finally {
        setCheckingFulfillment(false);
      }
    },
    [manualSelectionMode]
  );

  // Watch specific fields to avoid infinite loop with full form watch
  const watchedValues = watch([
    "ftd",
    "filler",
    "cold",
    "countryFilter",
    "genderFilter",
    "selectedClientNetwork",
    "selectedClientBrokers",
    "agentFilter",
    "ftdAgents",
    "fillerAgents",
  ]);

  // Create a stable object for debounce
  const stableWatchedValues = useMemo(() => {
    return {
      ftd: watchedValues[0],
      filler: watchedValues[1],
      cold: watchedValues[2],
      countryFilter: watchedValues[3],
      genderFilter: watchedValues[4],
      selectedClientNetwork: watchedValues[5],
      selectedClientBrokers: watchedValues[6],
      agentFilter: watchedValues[7],
      ftdAgents: watchedValues[8],
      fillerAgents: watchedValues[9],
    };
  }, [
    watchedValues[0],
    watchedValues[1],
    watchedValues[2],
    watchedValues[3],
    watchedValues[4],
    watchedValues[5],
    watchedValues[6],
    watchedValues[7],
    watchedValues[8],
    watchedValues[9],
  ]);

  const debouncedFormValues = useDebounce(stableWatchedValues, 1000);

  useEffect(() => {
    if (createDialogOpen && !manualSelectionMode) {
      checkFulfillment(debouncedFormValues);
    } else {
      setFulfillmentSummary(null);
    }
  }, [
    debouncedFormValues,
    createDialogOpen,
    manualSelectionMode,
    checkFulfillment,
  ]);

  const onSubmitOrder = useCallback(
    async (data) => {
      try {
        let orderData;

        // Check if using manual lead selection mode
        if (manualSelectionMode) {
          // Validate that leads are selected
          if (manualLeads.length === 0) {
            setNotification({
              message: "Please search and select leads first",
              severity: "warning",
            });
            return;
          }

          // Filter out leads that are on cooldown (admin can bypass cooldown)
          const isAdmin = user?.role === "admin";
          const activeLeads = isAdmin
            ? manualLeads // Admin can use all leads including cooldown
            : manualLeads.filter((entry) => !entry.isOnCooldown);

          // Check if there are any active leads (only block non-admin if all on cooldown)
          if (activeLeads.length === 0) {
            setNotification({
              message: "All selected leads are on cooldown. Cannot create order.",
              severity: "error",
            });
            return;
          }

          // Validate that all non-cold leads have agent assignments (cold leads don't need agents)
          const leadsWithoutAgents = activeLeads.filter(
            (entry) => !entry.agent && entry.lead.leadType !== "cold"
          );
          if (leadsWithoutAgents.length > 0) {
            setNotification({
              message: `Please assign agents to all FTD/Filler leads (${leadsWithoutAgents.length} unassigned)`,
              severity: "warning",
            });
            return;
          }

          // Build manual leads data - admin includes all, non-admin excludes cooldown
          const manualLeadsData = activeLeads.map((entry) => ({
            leadId: entry.lead._id,
            agentId: entry.agent || null, // Cold leads won't have an agent
            leadType: entry.lead.leadType, // Use original lead type from the record
          }));

          orderData = {
            manualSelection: true,
            manualLeads: manualLeadsData,
            priority: data.priority,
            notes: data.notes,
            plannedDate: data.plannedDate?.toISOString(),
            selectedClientNetwork: data.selectedClientNetwork,
            selectedOurNetwork: data.selectedOurNetwork,
            selectedCampaign: data.selectedCampaign,
            selectedClientBrokers: data.selectedClientBrokers,
          };
        } else {
          // Validate that at least one lead type is requested (non-manual mode)
          const totalLeads =
            (data.ftd || 0) + (data.filler || 0) + (data.cold || 0);
          if (totalLeads === 0) {
            setNotification({
              message: "At least one lead type must be requested",
              severity: "warning",
            });
            return;
          }

          // Validate country filter in non-manual mode
          if (!data.countryFilter || data.countryFilter.length < 2) {
            setNotification({
              message: "Country filter is required (at least 2 characters)",
              severity: "warning",
            });
            return;
          }

          // Build agentAssignments array from ftdAgents and fillerAgents
          const agentAssignments = [];

          if (data.ftdAgents && data.ftdAgents.length > 0) {
            data.ftdAgents.forEach((agentId, index) => {
              if (agentId) {
                // Only add if agent is selected
                agentAssignments.push({
                  leadType: "ftd",
                  agentId: agentId,
                  index: index,
                });
              }
            });
          }

          if (data.fillerAgents && data.fillerAgents.length > 0) {
            data.fillerAgents.forEach((agentId, index) => {
              if (agentId) {
                // Only add if agent is selected
                agentAssignments.push({
                  leadType: "filler",
                  agentId: agentId,
                  index: index,
                });
              }
            });
          }

          orderData = {
            requests: {
              ftd: data.ftd || 0,
              filler: data.filler || 0,
              cold: data.cold || 0,
            },
            priority: data.priority,
            country: data.countryFilter,
            gender: data.genderFilter,
            notes: data.notes,
            plannedDate: data.plannedDate?.toISOString(),
            selectedClientNetwork: data.selectedClientNetwork,
            selectedOurNetwork: data.selectedOurNetwork,
            selectedCampaign: data.selectedCampaign,
            selectedClientBrokers: data.selectedClientBrokers,
            agentFilter: data.agentFilter || null,
            agentAssignments: agentAssignments,
          };
        }

        const response = await api.post("/orders", orderData);

        // Check if any individual agent assignments were insufficient
        if (
          response.data.agentAssignmentInsufficient &&
          response.data.agentAssignmentInsufficient.length > 0
        ) {
          // Order was created but some assignments couldn't be fulfilled even with filters
          // Just show a warning, don't ask for more input as it would create a duplicate order
          setNotification({
            message:
              response.data.message ||
              "Order created with warning - some agent assignments could not be fully fulfilled",
            severity: "warning",
          });
          setCreateDialogOpen(false);
          reset();
        } else {
          setNotification({
            message: "Order created successfully!",
            severity: "success",
          });
          setCreateDialogOpen(false);
          reset();
        }

        fetchOrders();
      } catch (err) {
        // Check if the error is due to insufficient agent-assigned leads requiring gender selection
        if (
          err.response?.data?.requiresGenderSelection &&
          err.response?.data?.agentAssignmentInsufficient
        ) {
          // Store the order data and show modal to ask for gender selection
          setPendingOrderData(data);
          setInsufficientAgentLeads(
            err.response.data.agentAssignmentInsufficient
          );
          setGenderFallbackModalOpen(true);
          setNotification({
            message:
              err.response.data.message ||
              "Agent has insufficient assigned leads - please select a gender to allow fallback to unassigned leads",
            severity: "warning",
          });
        } else {
          setNotification({
            message: err.response?.data?.message || "Failed to create order",
            severity: "error",
          });
        }
      }
    },
    [reset, fetchOrders, manualSelectionMode, manualLeads, user]
  );

  const handleOpenClientBrokerManagement = useCallback((order) => {
    if (order) {
      setSelectedOrderForManagement(order);
      setClientBrokerManagementOpen(true);
    }
  }, []);

  const handleCloseClientBrokerManagement = useCallback(() => {
    setClientBrokerManagementOpen(false);
    setSelectedOrderForManagement(null);
  }, []);

  const handleOpenCreateDialog = useCallback(() => {
    setCreateDialogOpen(true);
    // Reset filtered agents state
    setFilteredAgents([]);
    setUnassignedLeadsStats({ ftd: null, filler: null });
    // Reset manual selection state
    setManualSelectionMode(false);
    setManualLeadEmails("");
    setManualLeads([]);
    // Fetch all required data for the form
    fetchClientNetworks();
    fetchOurNetworks();
    fetchCampaigns();
    fetchClientBrokers();
    fetchAllAgents();
  }, [
    fetchClientNetworks,
    fetchOurNetworks,
    fetchCampaigns,
    fetchClientBrokers,
    fetchAllAgents,
  ]);

  const handleGenderFallbackSelect = useCallback(
    async (genderSelection) => {
      if (!pendingOrderData) return;

      try {
        // Check if we're using per-assignment genders (array) or single gender (string)
        const isPerAssignment = Array.isArray(genderSelection);

        // Rebuild agentAssignments array from pendingOrderData
        let agentAssignments = [];

        // ALWAYS rebuild ALL agent assignments from pendingOrderData first
        if (
          pendingOrderData.ftdAgents &&
          pendingOrderData.ftdAgents.length > 0
        ) {
          pendingOrderData.ftdAgents.forEach((agentId, index) => {
            if (agentId) {
              agentAssignments.push({
                leadType: "ftd",
                agentId: agentId,
                index: index,
              });
            }
          });
        }

        if (
          pendingOrderData.fillerAgents &&
          pendingOrderData.fillerAgents.length > 0
        ) {
          pendingOrderData.fillerAgents.forEach((agentId, index) => {
            if (agentId) {
              agentAssignments.push({
                leadType: "filler",
                agentId: agentId,
                index: index,
              });
            }
          });
        }

        // If per-assignment genders, merge the gender selections into the assignments
        if (isPerAssignment) {
          // Create a map of gender selections by leadType and index
          const genderMap = new Map();
          genderSelection.forEach((gs) => {
            const key = `${gs.leadType}-${gs.index}`;
            genderMap.set(key, gs.gender);
          });

          // Add gender to matching assignments
          agentAssignments = agentAssignments.map((assignment) => {
            const key = `${assignment.leadType}-${assignment.index}`;
            const gender = genderMap.get(key);
            if (gender) {
              return { ...assignment, gender };
            }
            return assignment;
          });
        }

        // Retry the order with the selected gender(s)
        const orderData = {
          requests: {
            ftd: pendingOrderData.ftd || 0,
            filler: pendingOrderData.filler || 0,
            cold: pendingOrderData.cold || 0,
          },
          priority: pendingOrderData.priority,
          country: pendingOrderData.countryFilter,
          gender: isPerAssignment ? null : genderSelection, // Only use global gender for old format
          notes: pendingOrderData.notes,
          plannedDate: pendingOrderData.plannedDate?.toISOString(),
          selectedClientNetwork: pendingOrderData.selectedClientNetwork,
          selectedOurNetwork: pendingOrderData.selectedOurNetwork,
          selectedCampaign: pendingOrderData.selectedCampaign,
          selectedClientBrokers: pendingOrderData.selectedClientBrokers,
          agentFilter: pendingOrderData.agentFilter || null,
          agentAssignments: agentAssignments,
          perAssignmentGenders: isPerAssignment, // Flag to tell backend to use per-assignment genders
        };

        const response = await api.post("/orders", orderData);

        setNotification({
          message: isPerAssignment
            ? `Order created successfully with ${
                genderSelection.length
              } gender fallback(s) and ${
                agentAssignments.length - genderSelection.length
              } agent-assigned lead(s)!`
            : `Order created successfully with ${genderSelection} gender filter!`,
          severity: "success",
        });

        setGenderFallbackModalOpen(false);
        setCreateDialogOpen(false);
        setPendingOrderData(null);
        setInsufficientAgentLeads(null);
        reset();
        fetchOrders();
      } catch (err) {
        setNotification({
          message:
            err.response?.data?.message ||
            "Failed to create order with gender filter",
          severity: "error",
        });
      }
    },
    [pendingOrderData, reset, fetchOrders]
  );

  const handleGenderFallbackClose = useCallback(() => {
    setGenderFallbackModalOpen(false);
    setCreateDialogOpen(false);
    setPendingOrderData(null);
    setInsufficientAgentLeads(null);
  }, []);

  const handleClientBrokerManagementUpdate = useCallback(async () => {
    // Refresh the order data after lead updates
    if (selectedOrderForManagement) {
      try {
        const response = await api.get(
          `/orders/${selectedOrderForManagement._id}`
        );
        const updatedOrder = response.data.data;

        // Update expandedRowData if it exists
        setExpandedRowData((prev) => {
          if (prev[updatedOrder._id]) {
            return {
              ...prev,
              [updatedOrder._id]: updatedOrder,
            };
          }
          return prev;
        });

        // Update the order for management
        setSelectedOrderForManagement(updatedOrder);

        // Refresh main orders list
        fetchOrders();
      } catch (err) {
        console.error("Failed to refresh order data:", err);
      }
    }
  }, [selectedOrderForManagement, fetchOrders]);
  const handleLeadUpdate = useCallback(
    (updatedLead) => {
      if (!hoveredOrderId) return;

      // Update local state for immediate feedback
      setExpandedRowData((prev) => {
        const orderData = prev[hoveredOrderId];
        if (!orderData) return prev;

        return {
          ...prev,
          [hoveredOrderId]: {
            ...orderData,
            leads: orderData.leads.map((l) =>
              l._id === updatedLead._id ? updatedLead : l
            ),
          },
        };
      });

      // Also update hoveredLead
      setHoveredLead(updatedLead);

      // Refresh main orders list to ensure consistency
      fetchOrders();
    },
    [hoveredOrderId, fetchOrders]
  );

  // Lead Quick View Popover Handlers
  const handlePopoverClose = useCallback(() => {
    console.log("Closing popover");
    setLeadPopoverAnchor(null);
    setHoveredLead(null);
    if (popoverTimerRef.current) {
      clearTimeout(popoverTimerRef.current);
      popoverTimerRef.current = null;
    }
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const handleLeadMouseEnter = useCallback((event, lead, orderId) => {
    // Clear close timer if re-entering
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    // Clear any existing open timer
    if (popoverTimerRef.current) {
      clearTimeout(popoverTimerRef.current);
    }

    const target = event.currentTarget;

    // Set a delay before showing the popover (1000ms)
    popoverTimerRef.current = setTimeout(() => {
      console.log("Showing popover for lead:", lead.firstName, lead.lastName);
      setLeadPopoverAnchor(target);
      setHoveredLead(lead);
      setHoveredOrderId(orderId);
    }, 1000);
  }, []);

  const handleLeadMouseLeave = useCallback(() => {
    console.log("Mouse left lead row");
    // Clear the open timer if user moves away before popover appears
    if (popoverTimerRef.current) {
      clearTimeout(popoverTimerRef.current);
      popoverTimerRef.current = null;
    }

    // Start close timer
    closeTimerRef.current = setTimeout(() => {
      handlePopoverClose();
    }, 200);
  }, [handlePopoverClose]);

  const handleOpenAssignedLeadsModal = useCallback((leads, orderId) => {
    setAssignedLeadsModal({
      open: true,
      leads: leads || [],
      currentIndex: 0,
      orderId,
    });
  }, []);

  const handleCloseAssignedLeadsModal = useCallback(() => {
    setAssignedLeadsModal((prev) => ({ ...prev, open: false }));
    setLeadsSearchQuery("");
    setShowLeadsSearch(false);
  }, []);

  const handleOpenLeadsPreviewModal = useCallback((leads, orderId, order) => {
    setLeadsPreviewModal({
      open: true,
      leads: leads || [],
      orderId: orderId,
      order: order || null,
    });
  }, []);

  const handleCloseLeadsPreviewModal = useCallback(() => {
    setLeadsPreviewModal({ open: false, leads: [], orderId: null, order: null });
    setPreviewActionsMenu({ anchorEl: null, lead: null });
    setLeadRemovalMode(false);
    setSelectedLeadsForRemoval([]);
  }, []);

  // Handler for manual IPQS recheck of a single lead
  const handleIPQSRecheckLead = useCallback(async (lead) => {
    if (!leadsPreviewModal.orderId || !lead?._id) return;

    handleClosePreviewActionsMenu();

    try {
      const response = await api.post(
        `/orders/${leadsPreviewModal.orderId}/leads/${lead._id}/validate-ipqs?force=true`
      );

      if (response.data.success) {
        const validation = {
          email: response.data.data.email,
          phone: response.data.data.phone,
          summary: response.data.data.summary,
          validatedAt: response.data.data.validatedAt,
        };

        // Update leads in the preview modal
        setLeadsPreviewModal((prev) => ({
          ...prev,
          leads: prev.leads.map((l) =>
            l._id === lead._id ? { ...l, ipqsValidation: validation } : l
          ),
        }));

        // Also update expandedRowData if the order is expanded
        setExpandedRowData((prev) => {
          if (prev[leadsPreviewModal.orderId]) {
            return {
              ...prev,
              [leadsPreviewModal.orderId]: {
                ...prev[leadsPreviewModal.orderId],
                leads: prev[leadsPreviewModal.orderId].leads?.map((l) =>
                  l._id === lead._id ? { ...l, ipqsValidation: validation } : l
                ),
              },
            };
          }
          return prev;
        });

        // Show success indicator on the lead
        setIpqsValidationSuccess([lead._id]);
        setTimeout(() => {
          setIpqsValidationSuccess([]);
        }, 2000);
      }
    } catch (error) {
      console.error("Error rechecking lead IPQS:", error);
    }
  }, [leadsPreviewModal.orderId]);

  // Handler for direct IPQS validation of all unvalidated leads in an order
  const handleDirectIPQSValidation = useCallback(async (orderId, fromLeadsPreview = false) => {
    if (!orderId || ipqsValidatingOrders.includes(orderId)) return;

    setIpqsValidatingOrders((prev) => [...prev, orderId]);

    try {
      const response = await api.post(`/orders/${orderId}/validate-leads`);

      if (response.data.success) {
        const validationData = response.data.data;

        // Create validation map for quick lookup
        const validationMap = new Map(
          validationData.results?.map((r) => [r.leadId, r]) || []
        );

        // Update leadsPreviewModal if it's open for this order
        if (fromLeadsPreview || (leadsPreviewModal.open && leadsPreviewModal.orderId === orderId)) {
          setLeadsPreviewModal((prev) => ({
            ...prev,
            leads: prev.leads.map((lead) => {
              const validation = validationMap.get(lead._id);
              if (validation) {
                return {
                  ...lead,
                  ipqsValidation: {
                    email: validation.email,
                    phone: validation.phone,
                    summary: validation.summary,
                    validatedAt: validation.validatedAt,
                  },
                };
              }
              return lead;
            }),
          }));
        }

        // Update expandedRowData if the order is expanded
        if (expandedRowData[orderId]) {
          setExpandedRowData((prev) => ({
            ...prev,
            [orderId]: {
              ...prev[orderId],
              leads: prev[orderId].leads?.map((lead) => {
                const validation = validationMap.get(lead._id);
                if (validation) {
                  return {
                    ...lead,
                    ipqsValidation: {
                      email: validation.email,
                      phone: validation.phone,
                      summary: validation.summary,
                      validatedAt: validation.validatedAt,
                    },
                  };
                }
                return lead;
              }),
            },
          }));
        }

        // Show success indicators on validated leads
        if (validationData.results) {
          const validatedLeadIds = validationData.results
            .filter((r) => !r.alreadyValidated)
            .map((r) => r.leadId);
          if (validatedLeadIds.length > 0) {
            setIpqsValidationSuccess(validatedLeadIds);
            setTimeout(() => setIpqsValidationSuccess([]), 3000);
          }
        }

        // Show notification
        const newlyValidated = validationData.newlyValidated || 0;
        const alreadyValidated = validationData.alreadyValidated || 0;
        if (newlyValidated > 0) {
          setNotification({
            message: `Validated ${newlyValidated} lead(s)${alreadyValidated > 0 ? ` (${alreadyValidated} already validated)` : ""}`,
            severity: "success",
          });
        } else if (alreadyValidated > 0) {
          setNotification({
            message: "All leads already validated",
            severity: "info",
          });
        }
      }
    } catch (error) {
      console.error("Error validating leads with IPQS:", error);
      setNotification({
        message: error.response?.data?.message || "Failed to validate leads",
        severity: "error",
      });
    } finally {
      setIpqsValidatingOrders((prev) => prev.filter((id) => id !== orderId));
    }
  }, [ipqsValidatingOrders, leadsPreviewModal.open, leadsPreviewModal.orderId, expandedRowData]);

  // Toggle lead removal mode
  const handleToggleLeadRemovalMode = useCallback(() => {
    setLeadRemovalMode((prev) => !prev);
    setSelectedLeadsForRemoval([]);
  }, []);

  // Toggle lead selection for removal
  const handleToggleLeadSelection = useCallback((leadId) => {
    setSelectedLeadsForRemoval((prev) =>
      prev.includes(leadId)
        ? prev.filter((id) => id !== leadId)
        : [...prev, leadId]
    );
  }, []);

  // Remove selected leads from order
  const handleRemoveSelectedLeads = useCallback(async (reason) => {
    if (!leadsPreviewModal.orderId || selectedLeadsForRemoval.length === 0 || !reason) return;

    setRemovingLeads(true);
    const orderId = leadsPreviewModal.orderId;
    const successfulRemovals = [];
    const failedRemovals = [];
    const removedLeadDetails = [];

    // Get lead details before removing for undo functionality
    const leadsToRemove = leadsPreviewModal.leads.filter(
      (lead) => selectedLeadsForRemoval.includes(lead._id)
    );

    for (const leadId of selectedLeadsForRemoval) {
      try {
        await api.delete(`/orders/${orderId}/leads/${leadId}`, {
          data: { reason }
        });
        successfulRemovals.push(leadId);
        const leadInfo = leadsToRemove.find((l) => l._id === leadId);
        if (leadInfo) {
          removedLeadDetails.push({
            leadId,
            leadName: `${leadInfo.firstName} ${leadInfo.lastName}`,
          });
        }
      } catch (error) {
        console.error(`Failed to remove lead ${leadId}:`, error);
        failedRemovals.push(leadId);
      }
    }

    // Update UI
    if (successfulRemovals.length > 0) {
      // Refresh the order to get updated removedLeads list
      try {
        const response = await api.get(`/orders/${orderId}`);
        if (response.data.success) {
          // Update leadsPreviewModal with fresh data including removedLeads
          setLeadsPreviewModal((prev) => ({
            ...prev,
            leads: response.data.data.leads || prev.leads,
            order: response.data.data,
          }));

          // Update expandedRowData if the order is expanded
          if (expandedRowData[orderId]) {
            setExpandedRowData((prev) => ({
              ...prev,
              [orderId]: {
                ...prev[orderId],
                leads: response.data.data.leads || prev[orderId].leads,
                removedLeads: response.data.data.removedLeads,
              },
            }));
          }
        }
      } catch (err) {
        console.error("Failed to refresh order data:", err);
      }

      // Refresh orders list
      fetchOrders();

      // Set undo action for the removed leads
      setUndoAction({
        type: "removal",
        orderId,
        removedLeads: removedLeadDetails,
        timestamp: Date.now(),
      });

      setNotification({
        message: `Removed ${successfulRemovals.length} lead(s) from order`,
        severity: "success",
      });
    }

    if (failedRemovals.length > 0) {
      setNotification({
        message: `Failed to remove ${failedRemovals.length} lead(s)`,
        severity: "error",
      });
    }

    // Reset selection state
    setSelectedLeadsForRemoval([]);
    setLeadRemovalMode(false);
    setRemovingLeads(false);
    setRemovalReasonDialog({ open: false, reason: "", customReason: "" });
  }, [leadsPreviewModal.orderId, leadsPreviewModal.leads, selectedLeadsForRemoval, expandedRowData, fetchOrders]);

  // Handle undo action (restore removed leads or undo replacement)
  const handleUndoAction = useCallback(async () => {
    if (!undoAction) return;

    setUndoing(true);
    try {
      if (undoAction.type === "removal") {
        // Restore removed leads
        const successfulRestores = [];
        const failedRestores = [];

        for (const removedLead of undoAction.removedLeads) {
          try {
            await api.post(`/orders/${undoAction.orderId}/leads/${removedLead.leadId}/restore`);
            successfulRestores.push(removedLead);
          } catch (error) {
            console.error(`Failed to restore lead ${removedLead.leadId}:`, error);
            failedRestores.push(removedLead);
          }
        }

        if (successfulRestores.length > 0) {
          // Refresh orders list
          fetchOrders();

          // Refresh leads preview modal if open
          if (leadsPreviewModal.open && leadsPreviewModal.orderId === undoAction.orderId) {
            try {
              const response = await api.get(`/orders/${undoAction.orderId}`);
              if (response.data.success) {
                setLeadsPreviewModal((prev) => ({
                  ...prev,
                  leads: response.data.data.leads || [],
                  order: response.data.data,
                }));
              }
            } catch (err) {
              console.error("Failed to refresh leads preview:", err);
            }
          }

          setNotification({
            message: `Restored ${successfulRestores.length} lead(s) to order`,
            severity: "success",
          });
        }

        if (failedRestores.length > 0) {
          setNotification({
            message: `Failed to restore ${failedRestores.length} lead(s) - they may have been assigned to another order`,
            severity: "error",
          });
        }
      } else if (undoAction.type === "replacement") {
        // Undo lead replacement
        try {
          const response = await api.post(
            `/orders/${undoAction.orderId}/leads/${undoAction.newLeadId}/undo-replace`,
            { oldLeadId: undoAction.oldLeadId }
          );

          if (response.data.success) {
            // Refresh orders list
            fetchOrders();

            // Update leads preview modal if open
            if (leadsPreviewModal.open && leadsPreviewModal.orderId === undoAction.orderId) {
              setLeadsPreviewModal((prev) => ({
                ...prev,
                leads: response.data.data.order?.leads || prev.leads,
                order: response.data.data.order || prev.order,
              }));
            }

            // Update expandedRowData if the order is expanded
            if (expandedRowData[undoAction.orderId]) {
              setExpandedRowData((prev) => ({
                ...prev,
                [undoAction.orderId]: {
                  ...prev[undoAction.orderId],
                  leads: response.data.data.order?.leads || prev[undoAction.orderId].leads,
                },
              }));
            }

            setNotification({
              message: `Replacement undone: restored ${undoAction.oldLeadName}`,
              severity: "success",
            });
          }
        } catch (error) {
          console.error("Failed to undo replacement:", error);
          setNotification({
            message: error.response?.data?.message || "Failed to undo replacement - the original lead may have been assigned to another order",
            severity: "error",
          });
        }
      }
    } finally {
      setUndoing(false);
      setUndoAction(null);
    }
  }, [undoAction, fetchOrders, leadsPreviewModal.open, leadsPreviewModal.orderId, expandedRowData]);

  // Clear undo action after 30 seconds
  useEffect(() => {
    if (undoAction) {
      const timer = setTimeout(() => {
        setUndoAction(null);
      }, 30000); // 30 seconds window to undo
      return () => clearTimeout(timer);
    }
  }, [undoAction]);

  // Dismiss undo action
  const handleDismissUndo = useCallback(() => {
    setUndoAction(null);
  }, []);

  // Restore a single removed lead
  const handleRestoreLead = useCallback(async (orderId, lead) => {
    if (!orderId || !lead?._id) return;

    setRestoringLead(lead._id);
    try {
      const response = await api.post(`/orders/${orderId}/leads/${lead._id}/restore`);

      if (response.data.success) {
        // Refresh orders list
        fetchOrders();

        // Update leads preview modal
        if (leadsPreviewModal.open && leadsPreviewModal.orderId === orderId) {
          setLeadsPreviewModal((prev) => ({
            ...prev,
            leads: response.data.data.order?.leads || prev.leads,
            order: response.data.data.order || prev.order,
          }));
        }

        // Update expandedRowData if the order is expanded
        if (expandedRowData[orderId]) {
          setExpandedRowData((prev) => ({
            ...prev,
            [orderId]: {
              ...prev[orderId],
              leads: response.data.data.order?.leads || prev[orderId].leads,
            },
          }));
        }

        setNotification({
          message: `Lead ${lead.firstName} ${lead.lastName} has been restored to the order`,
          severity: "success",
        });
      }
    } catch (error) {
      console.error("Failed to restore lead:", error);
      setNotification({
        message: error.response?.data?.message || "Failed to restore lead - it may have been assigned to another order",
        severity: "error",
      });
    } finally {
      setRestoringLead(null);
    }
  }, [fetchOrders, leadsPreviewModal.open, leadsPreviewModal.orderId, expandedRowData]);

  // Open removal reason dialog
  const handleOpenRemovalReasonDialog = useCallback(() => {
    if (selectedLeadsForRemoval.length === 0) return;
    setRemovalReasonDialog({
      open: true,
      reason: "",
      customReason: "",
    });
  }, [selectedLeadsForRemoval.length]);

  // Close removal reason dialog
  const handleCloseRemovalReasonDialog = useCallback(() => {
    setRemovalReasonDialog({
      open: false,
      reason: "",
      customReason: "",
    });
  }, []);

  // Undo replacement from actions menu
  const handleUndoReplacementFromMenu = useCallback(async (orderId, newLeadId, oldLeadId) => {
    if (!orderId || !newLeadId || !oldLeadId) return;

    setUndoingReplacement(newLeadId);
    try {
      const response = await api.post(
        `/orders/${orderId}/leads/${newLeadId}/undo-replace`,
        { oldLeadId }
      );

      if (response.data.success) {
        // Refresh orders list
        fetchOrders();

        // Update leads preview modal
        if (leadsPreviewModal.open && leadsPreviewModal.orderId === orderId) {
          setLeadsPreviewModal((prev) => ({
            ...prev,
            leads: response.data.data.order?.leads || prev.leads,
            order: response.data.data.order || prev.order,
          }));
        }

        // Update expandedRowData if the order is expanded
        if (expandedRowData[orderId]) {
          setExpandedRowData((prev) => ({
            ...prev,
            [orderId]: {
              ...prev[orderId],
              leads: response.data.data.order?.leads || prev[orderId].leads,
              leadsMetadata: response.data.data.order?.leadsMetadata || prev[orderId].leadsMetadata,
            },
          }));
        }

        setNotification({
          message: `Replacement undone: restored ${response.data.data.restoredLead?.firstName} ${response.data.data.restoredLead?.lastName}`,
          severity: "success",
        });
      }
    } catch (error) {
      console.error("Failed to undo replacement:", error);
      setNotification({
        message: error.response?.data?.message || "Failed to undo replacement - the original lead may have been assigned to another order",
        severity: "error",
      });
    } finally {
      setUndoingReplacement(null);
    }
  }, [fetchOrders, leadsPreviewModal.open, leadsPreviewModal.orderId, expandedRowData]);

  const handleOpenPreviewActionsMenu = useCallback((event, lead) => {
    setPreviewActionsMenu({ anchorEl: event.currentTarget, lead });
  }, []);

  const handleClosePreviewActionsMenu = useCallback(() => {
    setPreviewActionsMenu({ anchorEl: null, lead: null });
  }, []);

  const handleOpenClientBrokersDialog = useCallback((brokers, leadName) => {
    setClientBrokersDialog({
      open: true,
      brokers: brokers || [],
      leadName,
    });
  }, []);

  const handleCloseClientBrokersDialog = useCallback(() => {
    setClientBrokersDialog({
      open: false,
      brokers: [],
      leadName: "",
    });
  }, []);

  const handleOpenClientNetworksDialog = useCallback((networks, leadName) => {
    setClientNetworksDialog({
      open: true,
      networks: networks || [],
      leadName,
    });
  }, []);

  const handleCloseClientNetworksDialog = useCallback(() => {
    setClientNetworksDialog({
      open: false,
      networks: [],
      leadName: "",
    });
  }, []);

  const handleOpenOurNetworksDialog = useCallback((networks, leadName) => {
    setOurNetworksDialog({
      open: true,
      networks: networks || [],
      leadName,
    });
  }, []);

  const handleCloseOurNetworksDialog = useCallback(() => {
    setOurNetworksDialog({
      open: false,
      networks: [],
      leadName: "",
    });
  }, []);

  const handleOpenCampaignsDialog = useCallback((campaigns, leadName) => {
    setCampaignsDialog({
      open: true,
      campaigns: campaigns || [],
      leadName,
    });
  }, []);

  const handleCloseCampaignsDialog = useCallback(() => {
    setCampaignsDialog({
      open: false,
      campaigns: [],
      leadName: "",
    });
  }, []);

  const handlePreviewOrderLeads = useCallback(
    async (orderId) => {
      try {
        const response = await api.get(`/orders/${orderId}`);
        const orderData = response.data.data;
        handleOpenLeadsPreviewModal(orderData.leads || [], orderId, orderData);
      } catch (err) {
        setNotification({
          message: "Could not load order leads for preview.",
          severity: "error",
        });
      }
    },
    [handleOpenLeadsPreviewModal]
  );

  // Copy leads for a specific order by fetching them first
  const handleCopyOrderLeadsById = useCallback(async (orderId) => {
    try {
      setNotification({ message: "Loading leads...", severity: "info" });
      const response = await api.get(`/orders/${orderId}`);
      const orderData = response.data.data;
      const leads = orderData.leads || [];

      if (leads.length === 0) {
        setNotification({
          message: "No leads to copy in this order",
          severity: "warning",
        });
        return;
      }

      // Pass the full order data for order-level fields (requester, dates, networks, etc.)
      const result = copyLeadsWithPreferences(
        leads,
        orderData,
        getDisplayLeadType
      );

      if (result.success) {
        setNotification({
          message: result.message,
          severity: "success",
        });
      } else {
        setNotification({
          message: result.message,
          severity: "error",
        });
      }
    } catch (err) {
      setNotification({
        message: "Could not load order leads for copying.",
        severity: "error",
      });
    }
  }, []);

  // Open remove lead dialog
  const handleOpenRemoveLeadDialog = (lead) => {
    setRemoveLeadDialog({
      open: true,
      leadId: lead._id,
      leadName: `${lead.firstName} ${lead.lastName}`,
      reason: "",
      customReason: "",
      missingAgentId: "",
      loading: false,
    });
    fetchAllAgents(); // Fetch agents for "Agent is missing" reason
  };

  // Close remove lead dialog
  const handleCloseRemoveLeadDialog = () => {
    setRemoveLeadDialog({
      open: false,
      leadId: null,
      leadName: "",
      reason: "",
      customReason: "",
      missingAgentId: "",
      loading: false,
    });
  };

  // Confirm remove lead
  const handleConfirmRemoveLead = async () => {
    const orderId = leadsPreviewModal.orderId;
    const { leadId, reason, customReason, missingAgentId } = removeLeadDialog;

    // Determine the final reason
    let finalReason = reason;
    if (reason === "Other") {
      finalReason = customReason;
    } else if (reason === "Agent is missing") {
      const missingAgent = allAgents.find(a => a._id === missingAgentId);
      finalReason = `Agent is missing: ${missingAgent?.fullName || missingAgentId}`;
    }

    if (!orderId || !leadId || !finalReason || !finalReason.trim()) return;

    setRemoveLeadDialog((prev) => ({ ...prev, loading: true }));

    try {
      const response = await api.delete(`/orders/${orderId}/leads/${leadId}`, {
        data: { reason: finalReason },
      });
      setNotification({
        message: "Lead removed from order successfully",
        severity: "success",
      });

      // Update the local state to mark the lead as removed (not filter it out)
      const updatedOrder = response.data?.data?.order;
      if (updatedOrder) {
        // Update leads preview modal
        setLeadsPreviewModal((prev) => ({
          ...prev,
          order: {
            ...prev.order,
            removedLeads: updatedOrder.removedLeads || [],
            fulfilled: updatedOrder.fulfilled,
          },
        }));

        // Update the orders list with the new fulfilled counts (real-time update)
        setOrders((prevOrders) =>
          prevOrders.map((order) =>
            order._id === orderId
              ? {
                  ...order,
                  fulfilled: updatedOrder.fulfilled,
                  removedLeads: updatedOrder.removedLeads || [],
                  status: updatedOrder.status,
                }
              : order
          )
        );

        // Update expandedRowData if the order is expanded
        setExpandedRowData((prev) => {
          if (prev[orderId]) {
            return {
              ...prev,
              [orderId]: {
                ...prev[orderId],
                removedLeads: updatedOrder.removedLeads || [],
                fulfilled: updatedOrder.fulfilled,
                status: updatedOrder.status,
              },
            };
          }
          return prev;
        });
      }

      // Close the dialog
      handleCloseRemoveLeadDialog();
    } catch (error) {
      console.error("Error removing lead from order:", error);
      setNotification({
        message:
          error.response?.data?.message || "Failed to remove lead from order",
        severity: "error",
      });
      setRemoveLeadDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  // Filter leads based on search query (multiple fields)
  const filteredLeads = useMemo(() => {
    if (!leadsSearchQuery.trim()) {
      return assignedLeadsModal.leads;
    }

    const query = leadsSearchQuery.toLowerCase().trim();

    return assignedLeadsModal.leads.filter((lead) => {
      // Search in lead name
      const fullName = `${lead.firstName || ""} ${
        lead.lastName || ""
      }`.toLowerCase();
      if (fullName.includes(query)) return true;

      // Search in email
      if (lead.email?.toLowerCase().includes(query)) return true;

      // Search in assigned agent
      const agentName = lead.assignedAgent?.fullName?.toLowerCase() || "";
      if (agentName.includes(query)) return true;

      // Search in client broker
      const clientBroker =
        lead.assignedClientBrokers?.[0]?.name?.toLowerCase() ||
        lead.clientBroker?.toLowerCase() ||
        "";
      if (clientBroker.includes(query)) return true;

      // Search in gender
      const gender = lead.gender?.toLowerCase() || "";
      if (gender.includes(query)) return true;

      return false;
    });
  }, [assignedLeadsModal.leads, leadsSearchQuery]);

  const handleNextLead = useCallback(() => {
    setAssignedLeadsModal((prev) => {
      const maxIndex = filteredLeads.length - 1;
      if (prev.currentIndex < maxIndex) {
        return { ...prev, currentIndex: prev.currentIndex + 1 };
      }
      return prev;
    });
  }, [filteredLeads.length]);

  const handlePrevLead = useCallback(() => {
    setAssignedLeadsModal((prev) => {
      if (prev.currentIndex > 0) {
        return { ...prev, currentIndex: prev.currentIndex - 1 };
      }
      return prev;
    });
  }, []);

  // Keyboard navigation for Assigned Leads Modal
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!assignedLeadsModal.open) return;

      if (event.key === "ArrowRight") {
        handleNextLead();
      } else if (event.key === "ArrowLeft") {
        handlePrevLead();
      } else if (event.key === "Escape") {
        handleCloseAssignedLeadsModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    assignedLeadsModal.open,
    handleNextLead,
    handlePrevLead,
    handleCloseAssignedLeadsModal,
  ]);

  // Reset current index when search query changes
  useEffect(() => {
    if (leadsSearchQuery && filteredLeads.length > 0) {
      setAssignedLeadsModal((prev) => ({ ...prev, currentIndex: 0 }));
    }
  }, [leadsSearchQuery, filteredLeads.length]);

  const popoverOpen = Boolean(leadPopoverAnchor);

  const handleExportLeads = useCallback(async (orderId) => {
    try {
      setNotification({ message: "Preparing CSV export...", severity: "info" });
      const response = await api.get(`/orders/${orderId}/export`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      const contentDisposition = response.headers["content-disposition"];
      let filename = `order_${orderId}_leads_${
        new Date().toISOString().split("T")[0]
      }.csv`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setNotification({
        message: "CSV export completed successfully!",
        severity: "success",
      });
    } catch (err) {
      setNotification({
        message: err.response?.data?.message || "Failed to export leads",
        severity: "error",
      });
    }
  }, []);

  // Copy leads from order to clipboard with user preferences
  const handleCopyOrderLeads = useCallback((leads, orderData) => {
    const result = copyLeadsWithPreferences(
      leads,
      orderData,
      getDisplayLeadType
    );

    if (result.success) {
      setNotification({
        message: result.message,
        severity: "success",
      });
    } else {
      setNotification({
        message: result.message,
        severity: "error",
      });
    }
  }, []);

  const handleDeleteOrderClick = useCallback((orderId, orderStatus) => {
    const isCancelled = orderStatus === "cancelled";
    setDeleteOrderDialog({
      open: true,
      orderId: orderId,
      orderStatus: orderStatus,
      permanentDelete: isCancelled, // Default to permanent delete for cancelled orders
      loading: false,
    });
  }, []);

  const handleDeleteOrderConfirm = useCallback(async () => {
    if (!deleteOrderDialog.orderId) return;

    setDeleteOrderDialog((prev) => ({ ...prev, loading: true }));

    try {
      if (deleteOrderDialog.permanentDelete) {
        // Permanent deletion - completely removes the order from database
        await api.delete(`/orders/${deleteOrderDialog.orderId}/permanent`);

        setNotification({
          message:
            "Order permanently deleted. All leads have been released back to the database.",
          severity: "success",
        });
      } else {
        // Cancel order - just marks as cancelled
        await api.delete(`/orders/${deleteOrderDialog.orderId}`, {
          data: { reason: "Cancelled by admin" },
        });

        setNotification({
          message:
            "Order cancelled successfully. Networks and campaigns have been unassigned.",
          severity: "success",
        });
      }

      // Close dialog
      setDeleteOrderDialog({
        open: false,
        orderId: null,
        orderStatus: null,
        permanentDelete: false,
        loading: false,
      });

      // Refresh orders list
      fetchOrders();
    } catch (err) {
      setNotification({
        message: err.response?.data?.message || "Failed to delete order",
        severity: "error",
      });
      setDeleteOrderDialog((prev) => ({ ...prev, loading: false }));
    }
  }, [
    deleteOrderDialog.orderId,
    deleteOrderDialog.permanentDelete,
    fetchOrders,
  ]);

  const handleDeleteOrderCancel = useCallback(() => {
    setDeleteOrderDialog({
      open: false,
      orderId: null,
      orderStatus: null,
      permanentDelete: false,
      loading: false,
    });
  }, []);

  const fetchRefundAssignmentStatus = useCallback(async (orderId) => {
    try {
      const response = await refundsService.getOrderRefundAssignmentStatus(
        orderId
      );
      setRefundAssignmentStatus((prev) => ({
        ...prev,
        [orderId]: response.data,
      }));
    } catch (err) {
      console.error("Failed to fetch refund assignment status:", err);
      // Don't show error to user, just log it
    }
  }, []);

  const toggleRowExpansion = useCallback(
    async (orderId) => {
      const isCurrentlyExpanded = !!expandedRowData[orderId];
      if (isCurrentlyExpanded) {
        const newExpandedData = { ...expandedRowData };
        delete newExpandedData[orderId];
        setExpandedRowData(newExpandedData);
        // Also remove the refund assignment status
        setRefundAssignmentStatus((prev) => {
          const { [orderId]: removedStatus, ...restStatus } = prev;
          return restStatus;
        });
      } else {
        try {
          // First, load lightweight order data for fast expansion
          const lightweightResponse = await api.get(
            `/orders/${orderId}?lightweight=true`
          );
          const lightweightData = lightweightResponse.data.data;

          // Set lightweight data with loading flag for leads
          setExpandedRowData((prev) => ({
            ...prev,
            [orderId]: {
              ...lightweightData,
              leadsLoading: true,
            },
          }));

          // Fetch refund assignment status if order has FTD leads
          if (lightweightData.fulfilled?.ftd > 0) {
            fetchRefundAssignmentStatus(orderId);
          }

          // Then immediately fetch full lead details in the background
          const fullResponse = await api.get(`/orders/${orderId}`);
          const fullOrderData = fullResponse.data.data;

          setExpandedRowData((prev) => ({
            ...prev,
            [orderId]: {
              ...fullOrderData,
              leadsLoading: false,
            },
          }));
        } catch (err) {
          setNotification({
            message: "Could not load order details for expansion.",
            severity: "error",
          });
        }
      }
    },
    [expandedRowData, fetchRefundAssignmentStatus]
  );
  const handleChangePage = useCallback((event, newPage) => {
    setPage(newPage);
  }, []);
  const handleChangeRowsPerPage = useCallback((event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }, []);
  const handleFilterChange = useCallback(
    (field) => (event) => {
      const value = event.target.value;
      setFilters((prev) => ({ ...prev, [field]: value }));
      setPage(0);
    },
    []
  );
  const clearFilters = useCallback(() => {
    setFilters({ status: "", priority: "", startDate: "", endDate: "" });
    setPage(0);
  }, []);

  // Refunds Manager Assignment Handlers
  const handleOpenRefundsAssignment = useCallback((orderId) => {
    setRefundsAssignmentDialog({
      open: true,
      orderId: orderId,
    });
  }, []);

  const handleCloseRefundsAssignment = useCallback(() => {
    setRefundsAssignmentDialog({
      open: false,
      orderId: null,
    });
  }, []);

  const handleRefundsAssignmentSuccess = useCallback(() => {
    setNotification({
      message: "FTD leads assigned to refunds manager successfully!",
      severity: "success",
    });
    fetchOrders(); // Refresh the orders list
    // Also refresh the refund assignment status for the assigned order
    if (refundsAssignmentDialog.orderId) {
      fetchRefundAssignmentStatus(refundsAssignmentDialog.orderId);
    }
  }, [
    fetchOrders,
    refundsAssignmentDialog.orderId,
    fetchRefundAssignmentStatus,
  ]);

  const handleCreateNewBroker = useCallback(() => {
    setCreateBrokerDialog({ open: true, loading: false });
  }, []);

  const handleCloseCreateBrokerDialog = useCallback(() => {
    setCreateBrokerDialog({ open: false, loading: false });
  }, []);

  const handleSubmitNewBroker = useCallback(
    async (brokerData) => {
      try {
        setCreateBrokerDialog((prev) => ({ ...prev, loading: true }));
        setNotification({
          message: "Creating new client broker...",
          severity: "info",
        });

        const response = await api.post("/client-brokers", brokerData);

        setNotification({
          message: `Client broker "${brokerData.name}" created successfully!`,
          severity: "success",
        });

        // Refresh client brokers list
        await fetchClientBrokers();

        // Close dialog
        handleCloseCreateBrokerDialog();
      } catch (err) {
        setNotification({
          message:
            err.response?.data?.message || "Failed to create client broker",
          severity: "error",
        });
        setCreateBrokerDialog((prev) => ({ ...prev, loading: false }));
      }
    },
    [fetchClientBrokers]
  );

  const handleManageBrokers = useCallback(() => {
    setManageBrokersDialog({ open: true, loading: false });
    fetchClientBrokers();
  }, [fetchClientBrokers]);

  const handleCloseManageBrokersDialog = useCallback(() => {
    setManageBrokersDialog({ open: false, loading: false });
  }, []);

  const handleDeleteBroker = useCallback((broker) => {
    setDeleteBrokerDialog({ open: true, broker, loading: false });
  }, []);

  const handleConfirmDeleteBroker = useCallback(async () => {
    try {
      setDeleteBrokerDialog((prev) => ({ ...prev, loading: true }));
      setNotification({
        message: "Deleting client broker...",
        severity: "info",
      });

      const brokerId = deleteBrokerDialog.broker._id;
      await api.delete(`/client-brokers/${brokerId}`);

      setNotification({
        message: `Client broker "${deleteBrokerDialog.broker.name}" deleted successfully!`,
        severity: "success",
      });

      // Refresh client brokers list
      await fetchClientBrokers();

      // Close dialog
      setDeleteBrokerDialog({ open: false, broker: null, loading: false });
    } catch (err) {
      setNotification({
        message:
          err.response?.data?.message || "Failed to delete client broker",
        severity: "error",
      });
      setDeleteBrokerDialog((prev) => ({ ...prev, loading: false }));
    }
  }, [deleteBrokerDialog.broker, fetchClientBrokers]);

  const handleCloseDeleteBrokerDialog = useCallback(() => {
    setDeleteBrokerDialog({ open: false, broker: null, loading: false });
  }, []);

  // Edit Broker Handlers
  const handleEditBroker = useCallback((broker) => {
    setEditBrokerDialog({ open: true, broker, loading: false });
  }, []);

  const handleCloseEditBrokerDialog = useCallback(() => {
    setEditBrokerDialog({ open: false, broker: null, loading: false });
  }, []);

  const handleSubmitEditBroker = useCallback(
    async (brokerData) => {
      try {
        setEditBrokerDialog((prev) => ({ ...prev, loading: true }));
        setNotification({
          message: "Updating client broker...",
          severity: "info",
        });

        const brokerId = editBrokerDialog.broker._id;
        const response = await api.put(
          `/client-brokers/${brokerId}`,
          brokerData
        );

        setNotification({
          message: `Client broker "${brokerData.name}" updated successfully!`,
          severity: "success",
        });

        // Refresh client brokers list
        await fetchClientBrokers();

        // Close dialog
        handleCloseEditBrokerDialog();
      } catch (err) {
        setNotification({
          message:
            err.response?.data?.message || "Failed to update client broker",
          severity: "error",
        });
        setEditBrokerDialog((prev) => ({ ...prev, loading: false }));
      }
    },
    [editBrokerDialog.broker, fetchClientBrokers]
  );

  const handleOpenChangeFTDDialog = useCallback((order, lead) => {
    // Allow changing FTD leads (which includes both FTD and Filler since fillers are FTD type)
    if (lead.leadType !== "ftd") {
      setNotification({
        message: "Only FTD/Filler leads can be changed",
        severity: "warning",
      });
      return;
    }

    setChangeFTDDialog({
      open: true,
      order: order,
      lead: lead,
    });
  }, []);

  const handleCloseChangeFTDDialog = useCallback(() => {
    setChangeFTDDialog({
      open: false,
      order: null,
      lead: null,
    });
  }, []);

  const handleChangeFTDSuccess = useCallback(
    async (changeData) => {
      // Determine if it was a filler based on order metadata
      const leadMetadata = changeFTDDialog.order?.leadsMetadata?.find(
        (m) => m.leadId?.toString() === changeData.oldLead.id?.toString()
      );
      const isFillerOrder = leadMetadata?.orderedAs === "filler";
      const leadLabel = isFillerOrder ? "Filler" : "FTD";

      setNotification({
        message: `${leadLabel} lead successfully changed from ${changeData.oldLead.firstName} ${changeData.oldLead.lastName} to ${changeData.newLead.firstName} ${changeData.newLead.lastName}`,
        severity: "success",
      });

      // Refresh the orders and expanded order data
      await fetchOrders();
      if (changeFTDDialog.order && expandedRowData[changeFTDDialog.order._id]) {
        toggleRowExpansion(changeFTDDialog.order._id);
      }
    },
    [changeFTDDialog.order, expandedRowData, fetchOrders, toggleRowExpansion]
  );

  // Replace Lead Dialog handlers
  const handleOpenReplaceLeadDialog = useCallback(
    (order, lead) => {
      // Check user role
      if (user?.role !== "admin" && user?.role !== "affiliate_manager") {
        setNotification({
          message: "Only admins and affiliate managers can replace leads",
          severity: "warning",
        });
        return;
      }

      setReplaceLeadDialog({
        open: true,
        order: order,
        lead: lead,
      });
    },
    [user?.role]
  );

  const handleCloseReplaceLeadDialog = useCallback(() => {
    setReplaceLeadDialog({
      open: false,
      order: null,
      lead: null,
    });
  }, []);

  const handleReplaceLeadSuccess = useCallback(
    async (replaceData) => {
      const orderId = replaceData.order?._id;

      setNotification({
        message: `Lead successfully replaced: ${replaceData.oldLead.firstName} ${replaceData.oldLead.lastName} replaced with ${replaceData.newLead.firstName} ${replaceData.newLead.lastName}`,
        severity: "success",
      });

      // Set undo action for the replacement
      setUndoAction({
        type: "replacement",
        orderId,
        newLeadId: replaceData.newLead._id,
        oldLeadId: replaceData.oldLead._id,
        newLeadName: `${replaceData.newLead.firstName} ${replaceData.newLead.lastName}`,
        oldLeadName: `${replaceData.oldLead.firstName} ${replaceData.oldLead.lastName}`,
        timestamp: Date.now(),
      });

      // Update orders list immediately with new data
      if (replaceData.order) {
        setOrders((prevOrders) =>
          prevOrders.map((order) =>
            order._id === orderId ? { ...order, ...replaceData.order } : order
          )
        );
      }

      // Update the leads preview modal if open
      if (leadsPreviewModal.open && leadsPreviewModal.orderId === orderId) {
        setLeadsPreviewModal((prev) => ({
          ...prev,
          leads: replaceData.order?.leads || prev.leads,
          order: replaceData.order || prev.order,
        }));
      }

      // Update expandedRowData if the order is expanded
      if (orderId && expandedRowData[orderId]) {
        setExpandedRowData((prev) => ({
          ...prev,
          [orderId]: {
            ...prev[orderId],
            leads: replaceData.order?.leads || prev[orderId].leads,
            leadsMetadata: replaceData.order?.leadsMetadata || prev[orderId].leadsMetadata,
          },
        }));
      }

      // Auto-validate the new lead with IPQS only if it's not already validated
      const newLeadId = replaceData.newLead?._id;
      const newLeadAlreadyValidated = replaceData.newLead?.ipqsValidation?.validatedAt;

      if (orderId && newLeadId && !newLeadAlreadyValidated) {
        try {
          const validateResponse = await api.post(
            `/orders/${orderId}/leads/${newLeadId}/validate-ipqs`
          );
          if (validateResponse.data.success && !validateResponse.data.data.alreadyValidated) {
            // Update the lead in the preview modal with validation results
            const validation = validateResponse.data.data;
            const ipqsData = {
              email: validation.email,
              phone: validation.phone,
              summary: validation.summary,
              validatedAt: validation.validatedAt,
            };
            setLeadsPreviewModal((prev) => ({
              ...prev,
              leads: prev.leads.map((lead) => {
                if (lead._id === newLeadId) {
                  return {
                    ...lead,
                    ipqsValidation: ipqsData,
                  };
                }
                return lead;
              }),
            }));
            // Also update expandedRowData if the order is expanded
            if (expandedRowData[orderId]) {
              setExpandedRowData((prev) => ({
                ...prev,
                [orderId]: {
                  ...prev[orderId],
                  leads: prev[orderId].leads?.map((lead) =>
                    lead._id === newLeadId
                      ? { ...lead, ipqsValidation: ipqsData }
                      : lead
                  ),
                },
              }));
            }
            // Show success indicator on the new lead
            setIpqsValidationSuccess([newLeadId]);
            setTimeout(() => {
              setIpqsValidationSuccess([]);
            }, 2000);
          }
        } catch (err) {
          console.error("Auto IPQS validation failed for replaced lead:", err);
          // Don't show error notification - auto-validation is optional
        }
      }
    },
    [leadsPreviewModal.open, leadsPreviewModal.orderId, expandedRowData]
  );

  // Convert lead type between FTD and Filler
  const handleConvertLeadType = useCallback(
    async (order, lead) => {
      if (lead.leadType !== "ftd") {
        setNotification({
          message: "Only FTD/Filler leads can be converted",
          severity: "warning",
        });
        return;
      }

      const leadMetadata = order.leadsMetadata?.find(
        (m) => m.leadId?.toString() === lead._id?.toString()
      );
      const currentType = leadMetadata?.orderedAs || "ftd";
      const newType = currentType === "ftd" ? "filler" : "ftd";

      try {
        const response = await api.post(
          `/orders/${order._id}/leads/${lead._id}/convert-lead-type`
        );

        if (response.data.success) {
          setNotification({
            message: `Lead ${lead.firstName} ${
              lead.lastName
            } converted from ${currentType.toUpperCase()} to ${newType.toUpperCase()}`,
            severity: "success",
          });

          // Refresh the orders and expanded order data
          await fetchOrders();
          if (expandedRowData[order._id]) {
            toggleRowExpansion(order._id);
          }
        }
      } catch (err) {
        setNotification({
          message: err.response?.data?.message || "Failed to convert lead type",
          severity: "error",
        });
      }
    },
    [fetchOrders, expandedRowData, toggleRowExpansion]
  );

  const handleOpenAssignLeadDialog = useCallback((lead) => {
    setAssignLeadDialog({
      open: true,
      lead: lead,
    });
  }, []);

  const handleCloseAssignLeadDialog = useCallback(() => {
    setAssignLeadDialog({
      open: false,
      lead: null,
    });
  }, []);

  const handleAssignLeadSuccess = useCallback(
    async (assignmentData) => {
      // Update local state instantly
      const updatedLeadData = {
        assignedAgent: {
          _id: assignmentData.agentId,
          fullName: assignmentData.agentName,
          email: assignmentData.agentEmail,
        },
        assignedAgentAt: new Date().toISOString(),
      };

      setAssignedLeadsModal((prev) => ({
        ...prev,
        leads: prev.leads.map((l) =>
          l._id === assignmentData.leadId ? { ...l, ...updatedLeadData } : l
        ),
      }));

      // Also update preview modal if open
      setLeadsPreviewModal((prev) => ({
        ...prev,
        leads: prev.leads.map((l) =>
          l._id === assignmentData.leadId ? { ...l, ...updatedLeadData } : l
        ),
      }));

      setNotification({
        message: `Lead ${assignmentData.leadId.slice(
          -8
        )} successfully assigned to ${assignmentData.agentName}`,
        severity: "success",
      });

      // Refresh the orders in background
      fetchOrders();
    },
    [fetchOrders]
  );

  const handleCopyToClipboard = useCallback(async (text, fieldName) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyNotification({
        open: true,
        message: `${fieldName} copied to clipboard!`,
      });
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      setCopyNotification({
        open: true,
        message: `Failed to copy ${fieldName}`,
      });
    }
  }, []);

  // Apply Fine Dialog Handlers
  const handleOpenApplyFineDialog = useCallback((lead, orderId) => {
    if (!lead.assignedAgent) {
      setNotification({
        message: "Cannot apply fine - lead has no assigned agent",
        severity: "warning",
      });
      return;
    }
    setApplyFineDialog({
      open: true,
      agent: lead.assignedAgent,
      lead: lead,
      orderId: orderId,
    });
  }, []);

  const handleCloseApplyFineDialog = useCallback(() => {
    setApplyFineDialog({
      open: false,
      agent: null,
      lead: null,
      orderId: null,
    });
  }, []);

  const handleApplyFineSuccess = useCallback(() => {
    setNotification({
      message: "Fine applied successfully. Awaiting agent approval.",
      severity: "success",
    });
  }, []);

  // Open PSP selection dialog for confirm deposit (Step 1: Card Issuer)
  const handleConfirmDeposit = useCallback(
    async (lead, orderId) => {
      // Use passed orderId or fall back to hoveredOrderId
      const targetOrderId = orderId || hoveredOrderId;

      // Fetch active Card Issuers first
      try {
        setPspDepositDialog({
          open: true,
          lead: lead,
          orderId: targetOrderId,
          step: 1,
          cardIssuers: [],
          selectedCardIssuer: null,
          newCardIssuerName: "",
          creatingIssuer: false,
          psps: [],
          loading: true,
          selectedPsp: null,
          newPspWebsite: "",
          creatingPsp: false,
        });

        const response = await api.get("/card-issuers", {
          params: { limit: 10000, isActive: true },
        });

        setPspDepositDialog((prev) => ({
          ...prev,
          cardIssuers: response.data.data || [],
          loading: false,
        }));
      } catch (err) {
        console.error("Error fetching Card Issuers:", err);
        setNotification({
          message: "Failed to load Card Issuers",
          severity: "error",
        });
        setPspDepositDialog({
          open: false,
          lead: null,
          orderId: null,
          step: 1,
          cardIssuers: [],
          selectedCardIssuer: null,
          newCardIssuerName: "",
          creatingIssuer: false,
          psps: [],
          loading: false,
          selectedPsp: null,
          newPspWebsite: "",
          creatingPsp: false,
        });
      }
    },
    [hoveredOrderId]
  );

  // Handle Card Issuer selection (move to Step 2: PSP selection)
  const handleCardIssuerSelect = useCallback(async () => {
    const { selectedCardIssuer, newCardIssuerName } = pspDepositDialog;

    // If creating new issuer
    if (newCardIssuerName && !selectedCardIssuer) {
      try {
        setPspDepositDialog((prev) => ({ ...prev, creatingIssuer: true }));
        const response = await api.post("/card-issuers", { name: newCardIssuerName.trim() });
        const newIssuer = response.data.data;

        // Proceed to step 2 with new issuer
        setPspDepositDialog((prev) => ({
          ...prev,
          selectedCardIssuer: newIssuer,
          step: 2,
          loading: true,
          creatingIssuer: false,
        }));

        // Fetch all active PSPs (not filtered by issuer since PSPs may not have issuer set)
        const pspsResponse = await api.get("/psps", {
          params: { isActive: true, limit: 10000 },
        });

        setPspDepositDialog((prev) => ({
          ...prev,
          psps: pspsResponse.data.data || [],
          loading: false,
        }));
      } catch (err) {
        console.error("Error creating Card Issuer:", err);
        setNotification({
          message: err.response?.data?.message || "Failed to create Card Issuer",
          severity: "error",
        });
        setPspDepositDialog((prev) => ({ ...prev, creatingIssuer: false }));
      }
      return;
    }

    // Using existing issuer
    if (!selectedCardIssuer) {
      setNotification({
        message: "Please select a Card Issuer or enter a new name",
        severity: "error",
      });
      return;
    }

    try {
      setPspDepositDialog((prev) => ({ ...prev, step: 2, loading: true }));

      // Fetch all active PSPs
      const response = await api.get("/psps", {
        params: { isActive: true, limit: 10000 },
      });

      setPspDepositDialog((prev) => ({
        ...prev,
        psps: response.data.data || [],
        loading: false,
      }));
    } catch (err) {
      console.error("Error fetching PSPs:", err);
      setNotification({
        message: "Failed to load PSPs",
        severity: "error",
      });
      setPspDepositDialog((prev) => ({ ...prev, loading: false }));
    }
  }, [pspDepositDialog, setNotification]);

  // Handle PSP selection and confirm deposit
  const handlePspDepositConfirm = useCallback(
    async () => {
      const { lead, selectedPsp, selectedCardIssuer, orderId, newPspWebsite } = pspDepositDialog;

      if (!orderId) {
        setNotification({
          message: "Order context is required to confirm deposit",
          severity: "error",
        });
        return;
      }

      // Determine which PSP to use
      let pspToUse = selectedPsp;

      // If creating a new PSP
      if (newPspWebsite.trim() && !selectedPsp) {
        try {
          setPspDepositDialog((prev) => ({ ...prev, creatingPsp: true }));
          const pspResponse = await api.post("/psps", {
            website: newPspWebsite.trim(),
            cardIssuer: selectedCardIssuer?._id || null,
          });
          pspToUse = pspResponse.data.data;
          setPspDepositDialog((prev) => ({
            ...prev,
            selectedPsp: pspToUse,
            newPspWebsite: "",
            creatingPsp: false,
          }));
        } catch (err) {
          // If PSP already exists (409), use the existing one
          if (err.response?.status === 409 && err.response?.data?.existingPsp) {
            pspToUse = err.response.data.existingPsp;
            setPspDepositDialog((prev) => ({
              ...prev,
              selectedPsp: pspToUse,
              newPspWebsite: "",
              creatingPsp: false,
            }));
            setNotification({
              message: "PSP already exists - using existing one",
              severity: "info",
            });
          } else {
            console.error("Error creating PSP:", err);
            setNotification({
              message: err.response?.data?.message || "Failed to create PSP",
              severity: "error",
            });
            setPspDepositDialog((prev) => ({ ...prev, creatingPsp: false }));
            return;
          }
        }
      }

      if (!pspToUse) {
        setNotification({
          message: "Please select a PSP or enter a website to create one",
          severity: "error",
        });
        return;
      }

      try {
        setPspDepositDialog((prev) => ({ ...prev, loading: true }));

        const response = await api.put(`/leads/${lead._id}/confirm-deposit`, {
          pspId: pspToUse._id,
          orderId: orderId,
          cardIssuerId: selectedCardIssuer?._id || null,
        });

        // Get the order metadata from response
        const orderMetadata = response.data.data?.orderMetadata || {};

        // Update local state with order metadata
        const updatedLeadData = {
          depositConfirmed: orderMetadata.depositConfirmed || true,
          depositConfirmedBy: orderMetadata.depositConfirmedBy || user,
          depositConfirmedAt: orderMetadata.depositConfirmedAt || new Date().toISOString(),
          depositPSP: orderMetadata.depositPSP || pspToUse,
        };

        setAssignedLeadsModal((prev) => ({
          ...prev,
          leads: prev.leads.map((l) =>
            l._id === lead._id ? { ...l, ...updatedLeadData } : l
          ),
        }));

        // Also update preview modal if open
        setLeadsPreviewModal((prev) => {
          // Also update order's leadsMetadata if we have the order
          let updatedOrder = prev.order;
          if (updatedOrder && updatedOrder.leadsMetadata) {
            updatedOrder = {
              ...updatedOrder,
              leadsMetadata: updatedOrder.leadsMetadata.map((meta) =>
                meta.leadId === lead._id || meta.leadId?._id === lead._id
                  ? { ...meta, ...orderMetadata }
                  : meta
              ),
            };
          }
          return {
            ...prev,
            leads: prev.leads.map((l) =>
              l._id === lead._id ? { ...l, ...updatedLeadData } : l
            ),
            order: updatedOrder,
          };
        });

        // Update expandedRowData if order is expanded
        if (orderId && expandedRowData[orderId]) {
          setExpandedRowData((prev) => {
            const orderData = prev[orderId];
            if (!orderData) return prev;
            return {
              ...prev,
              [orderId]: {
                ...orderData,
                leads: orderData.leads?.map((l) =>
                  l._id === lead._id ? { ...l, ...updatedLeadData } : l
                ),
                leadsMetadata: orderData.leadsMetadata?.map((meta) =>
                  meta.leadId === lead._id || meta.leadId?._id === lead._id
                    ? { ...meta, ...orderMetadata }
                    : meta
                ),
              },
            };
          });
        }

        setNotification({
          message: "Deposit confirmed successfully",
          severity: "success",
        });

        // Close the dialog
        setPspDepositDialog({
          open: false,
          lead: null,
          orderId: null,
          step: 1,
          cardIssuers: [],
          selectedCardIssuer: null,
          newCardIssuerName: "",
          creatingIssuer: false,
          psps: [],
          loading: false,
          selectedPsp: null,
          newPspWebsite: "",
          creatingPsp: false,
        });

        // Refresh the orders in background
        fetchOrders();
      } catch (err) {
        console.error("Error confirming deposit:", err);
        setNotification({
          message: err.response?.data?.message || "Failed to confirm deposit",
          severity: "error",
        });
        setPspDepositDialog((prev) => ({ ...prev, loading: false }));
      }
    },
    [pspDepositDialog, fetchOrders, user, expandedRowData]
  );

  // Close PSP deposit dialog
  const handleClosePspDepositDialog = useCallback(() => {
    setPspDepositDialog({
      open: false,
      lead: null,
      orderId: null,
      step: 1,
      cardIssuers: [],
      selectedCardIssuer: null,
      newCardIssuerName: "",
      creatingIssuer: false,
      psps: [],
      loading: false,
      selectedPsp: null,
      newPspWebsite: "",
      creatingPsp: false,
    });
  }, []);

  // Unconfirm Deposit Handler (admin only)
  const handleUnconfirmDeposit = useCallback(
    async (lead, orderId) => {
      // Use passed orderId or fall back to hoveredOrderId
      const targetOrderId = orderId || hoveredOrderId;

      if (!targetOrderId) {
        setNotification({
          message: "Order context is required to unconfirm deposit",
          severity: "error",
        });
        return;
      }

      // Ask for confirmation
      if (!window.confirm(`Are you sure you want to unconfirm deposit for ${lead.firstName} ${lead.lastName}?`)) {
        return;
      }

      try {
        await api.put(`/leads/${lead._id}/unconfirm-deposit`, {
          orderId: targetOrderId,
        });

        // Update local state instantly
        const updatedLeadData = {
          depositConfirmed: false,
          depositConfirmedBy: null,
          depositConfirmedAt: null,
          depositPSP: null,
        };

        setAssignedLeadsModal((prev) => ({
          ...prev,
          leads: prev.leads.map((l) =>
            l._id === lead._id ? { ...l, ...updatedLeadData } : l
          ),
        }));

        // Also update preview modal if open
        setLeadsPreviewModal((prev) => {
          let updatedOrder = prev.order;
          if (updatedOrder && updatedOrder.leadsMetadata) {
            updatedOrder = {
              ...updatedOrder,
              leadsMetadata: updatedOrder.leadsMetadata.map((meta) =>
                meta.leadId === lead._id || meta.leadId?._id === lead._id
                  ? { ...meta, ...updatedLeadData }
                  : meta
              ),
            };
          }
          return {
            ...prev,
            leads: prev.leads.map((l) =>
              l._id === lead._id ? { ...l, ...updatedLeadData } : l
            ),
            order: updatedOrder,
          };
        });

        // Update expandedRowData if order is expanded
        if (targetOrderId && expandedRowData[targetOrderId]) {
          setExpandedRowData((prev) => {
            const orderData = prev[targetOrderId];
            if (!orderData) return prev;
            return {
              ...prev,
              [targetOrderId]: {
                ...orderData,
                leads: orderData.leads?.map((l) =>
                  l._id === lead._id ? { ...l, ...updatedLeadData } : l
                ),
                leadsMetadata: orderData.leadsMetadata?.map((meta) =>
                  meta.leadId === lead._id || meta.leadId?._id === lead._id
                    ? { ...meta, ...updatedLeadData }
                    : meta
                ),
              },
            };
          });
        }

        setNotification({
          message: "Deposit unconfirmed successfully",
          severity: "success",
        });

        // Refresh the orders in background
        fetchOrders();
      } catch (err) {
        console.error("Error unconfirming deposit:", err);
        setNotification({
          message: err.response?.data?.message || "Failed to unconfirm deposit",
          severity: "error",
        });
      }
    },
    [fetchOrders, hoveredOrderId, expandedRowData]
  );

  // Mark as Shaved Handler - opens the dialog
  const handleMarkAsShaved = useCallback((lead, orderId) => {
    // Use passed orderId or fall back to hoveredOrderId
    const targetOrderId = orderId || hoveredOrderId;
    setMarkShavedDialog({
      open: true,
      lead: lead,
      orderId: targetOrderId,
      loading: false,
    });
  }, [hoveredOrderId]);

  // Confirm Mark as Shaved Handler - called when dialog is confirmed
  const handleConfirmMarkAsShaved = useCallback(
    async (refundsManagerId) => {
      const { lead, orderId } = markShavedDialog;
      if (!lead) return;

      if (!orderId) {
        setNotification({
          message: "Order context is required to mark as shaved",
          severity: "error",
        });
        return;
      }

      setMarkShavedDialog((prev) => ({ ...prev, loading: true }));

      try {
        const response = await api.put(`/leads/${lead._id}/mark-shaved`, {
          refundsManagerId,
          orderId: orderId,
        });

        // Get the order metadata from response
        const orderMetadata = response.data.data?.orderMetadata || {};

        // Update local state with order metadata
        const updatedLeadData = {
          shaved: orderMetadata.shaved || true,
          shavedBy: orderMetadata.shavedBy || user,
          shavedAt: orderMetadata.shavedAt || new Date().toISOString(),
          shavedRefundsManager: orderMetadata.shavedRefundsManager,
          shavedManagerAssignedBy: orderMetadata.shavedManagerAssignedBy || user,
          shavedManagerAssignedAt: orderMetadata.shavedManagerAssignedAt || new Date().toISOString(),
        };

        setAssignedLeadsModal((prev) => ({
          ...prev,
          leads: prev.leads.map((l) =>
            l._id === lead._id ? { ...l, ...updatedLeadData } : l
          ),
        }));

        setLeadsPreviewModal((prev) => {
          let updatedOrder = prev.order;
          if (updatedOrder && updatedOrder.leadsMetadata) {
            updatedOrder = {
              ...updatedOrder,
              leadsMetadata: updatedOrder.leadsMetadata.map((meta) =>
                meta.leadId === lead._id || meta.leadId?._id === lead._id
                  ? { ...meta, ...orderMetadata }
                  : meta
              ),
            };
          }
          return {
            ...prev,
            leads: prev.leads.map((l) =>
              l._id === lead._id ? { ...l, ...updatedLeadData } : l
            ),
            order: updatedOrder,
          };
        });

        // Update expandedRowData if order is expanded
        if (orderId && expandedRowData[orderId]) {
          setExpandedRowData((prev) => {
            const orderData = prev[orderId];
            if (!orderData) return prev;
            return {
              ...prev,
              [orderId]: {
                ...orderData,
                leads: orderData.leads?.map((l) =>
                  l._id === lead._id ? { ...l, ...updatedLeadData } : l
                ),
                leadsMetadata: orderData.leadsMetadata?.map((meta) =>
                  meta.leadId === lead._id || meta.leadId?._id === lead._id
                    ? { ...meta, ...orderMetadata }
                    : meta
                ),
              },
            };
          });
        }

        setNotification({
          message: "Lead marked as shaved successfully",
          severity: "success",
        });

        // Close dialog
        setMarkShavedDialog({ open: false, lead: null, orderId: null, loading: false });

        // Refresh orders in background
        fetchOrders();
      } catch (err) {
        console.error("Error marking lead as shaved:", err);
        setMarkShavedDialog((prev) => ({ ...prev, loading: false }));
        setNotification({
          message: err.response?.data?.message || "Failed to mark lead as shaved",
          severity: "error",
        });
      }
    },
    [markShavedDialog, fetchOrders, user, expandedRowData]
  );

  // Unmark as Shaved Handler (admin only)
  const handleUnmarkAsShaved = useCallback(
    async (lead, orderId) => {
      // Use passed orderId or fall back to hoveredOrderId
      const targetOrderId = orderId || hoveredOrderId;

      if (!targetOrderId) {
        setNotification({
          message: "Order context is required to unmark as shaved",
          severity: "error",
        });
        return;
      }

      if (!window.confirm(`Are you sure you want to unmark ${lead.firstName} ${lead.lastName} as shaved?`)) {
        return;
      }

      try {
        await api.put(`/leads/${lead._id}/unmark-shaved`, {
          orderId: targetOrderId,
        });

        // Update local state instantly
        const updatedLeadData = {
          shaved: false,
          shavedBy: null,
          shavedAt: null,
          shavedRefundsManager: null,
          shavedManagerAssignedBy: null,
          shavedManagerAssignedAt: null,
        };

        setAssignedLeadsModal((prev) => ({
          ...prev,
          leads: prev.leads.map((l) =>
            l._id === lead._id ? { ...l, ...updatedLeadData } : l
          ),
        }));

        setLeadsPreviewModal((prev) => {
          let updatedOrder = prev.order;
          if (updatedOrder && updatedOrder.leadsMetadata) {
            updatedOrder = {
              ...updatedOrder,
              leadsMetadata: updatedOrder.leadsMetadata.map((meta) =>
                meta.leadId === lead._id || meta.leadId?._id === lead._id
                  ? { ...meta, ...updatedLeadData }
                  : meta
              ),
            };
          }
          return {
            ...prev,
            leads: prev.leads.map((l) =>
              l._id === lead._id ? { ...l, ...updatedLeadData } : l
            ),
            order: updatedOrder,
          };
        });

        // Update expandedRowData if order is expanded
        if (targetOrderId && expandedRowData[targetOrderId]) {
          setExpandedRowData((prev) => {
            const orderData = prev[targetOrderId];
            if (!orderData) return prev;
            return {
              ...prev,
              [targetOrderId]: {
                ...orderData,
                leads: orderData.leads?.map((l) =>
                  l._id === lead._id ? { ...l, ...updatedLeadData } : l
                ),
                leadsMetadata: orderData.leadsMetadata?.map((meta) =>
                  meta.leadId === lead._id || meta.leadId?._id === lead._id
                    ? { ...meta, ...updatedLeadData }
                    : meta
                ),
              },
            };
          });
        }

        setNotification({
          message: "Lead unmarked as shaved successfully",
          severity: "success",
        });

        // Refresh orders in background
        fetchOrders();
      } catch (err) {
        console.error("Error unmarking lead as shaved:", err);
        setNotification({
          message: err.response?.data?.message || "Failed to unmark lead as shaved",
          severity: "error",
        });
      }
    },
    [fetchOrders, hoveredOrderId, expandedRowData]
  );

  // Close Mark Shaved Dialog
  const handleCloseMarkShavedDialog = useCallback(() => {
    setMarkShavedDialog({ open: false, lead: null, orderId: null, loading: false });
  }, []);

  const handleCloseCopyNotification = useCallback(() => {
    setCopyNotification({ open: false, message: "" });
  }, []);
  // Country mapping function to convert full country names to two-letter codes
  const getCountryCode = (countryName) => {
    const countryMapping = {
      "United States": "US",
      Germany: "DE",
      "United Kingdom": "GB",
      UK: "UK", // Handle both GB and UK variants
      France: "FR",
      Canada: "CA",
      Australia: "AU",
      Japan: "JP",
    };
    return countryMapping[countryName] || countryName;
  };

  const renderLeadCounts = (label, requested, fulfilled) => (
    <Typography variant="body2">
      {label}: {requested || 0} requested, {fulfilled || 0} fulfilled
    </Typography>
  );
  return (
    <Box sx={{ width: "100%", typography: "body1" }}>
      {notification.message && (
        <Collapse in={!!notification.message}>
          <Alert
            severity={notification.severity}
            sx={{ mb: 2 }}
            onClose={() => setNotification({ message: "", severity: "info" })}
          >
            {notification.message}
          </Alert>
        </Collapse>
      )}
      <Card sx={{ mb: 3 }}>
        <CardContent
          sx={{
            p: isSmallScreen ? 1.5 : 2,
            "&:last-child": { pb: isSmallScreen ? 1.5 : 2 },
          }}
        >
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            flexWrap="wrap"
            gap={2}
          >
            <Box display="flex" alignItems="center" gap={1} flex={1}>
              <TextField
                label="Search by keyword"
                placeholder="Type to search..."
                value={filters.search}
                onChange={handleFilterChange("search")}
                size="small"
                sx={{ minWidth: 400, maxWidth: 600 }}
                InputProps={{
                  startAdornment: (
                    <SearchIcon
                      sx={{ color: "action.active", mr: 1, fontSize: 20 }}
                    />
                  ),
                }}
              />
              {(user?.role === "admin" ||
                user?.role === "affiliate_manager") && (
                <Box
                  sx={{
                    display: "flex",
                    gap: 1,
                    flexDirection: isSmallScreen ? "column" : "row",
                  }}
                >
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleOpenCreateDialog}
                    size={isSmallScreen ? "small" : "medium"}
                  >
                    Create Order
                  </Button>
                  {user?.role === "admin" && (
                    <Button
                      variant="outlined"
                      startIcon={<BusinessIcon />}
                      onClick={handleManageBrokers}
                      size={isSmallScreen ? "small" : "medium"}
                    >
                      Manage Brokers
                    </Button>
                  )}
                </Box>
              )}
              <Tooltip title="Configure copy format for leads">
                <IconButton onClick={() => setCopyPreferencesOpen(true)}>
                  <SettingsIcon />
                </IconButton>
              </Tooltip>
              <IconButton onClick={() => setShowFilters(!showFilters)}>
                {showFilters ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>
          </Box>
          <Collapse in={showFilters}>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  fullWidth
                  label="Planned Date (From)"
                  type="date"
                  value={filters.startDate}
                  onChange={handleFilterChange("startDate")}
                  InputLabelProps={{ shrink: true }}
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  fullWidth
                  label="Planned Date (To)"
                  type="date"
                  value={filters.endDate}
                  onChange={handleFilterChange("endDate")}
                  InputLabelProps={{ shrink: true }}
                  size="small"
                />
              </Grid>
              <Grid
                item
                xs={12}
                md={4}
                sx={{ display: "flex", alignItems: "center" }}
              >
                <Button
                  onClick={clearFilters}
                  variant="outlined"
                  size="small"
                  fullWidth
                >
                  Clear Filters
                </Button>
              </Grid>
            </Grid>
          </Collapse>
        </CardContent>
      </Card>
      {}
      <Paper>
        <TableContainer>
          <Table size="small" sx={{ tableLayout: "fixed" }}>
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{
                    fontWeight: "bold",
                    backgroundColor: "grey.200",
                    width: "10%",
                    py: 1,
                  }}
                >
                  Order ID
                </TableCell>
                <TableCell
                  sx={{
                    display: { xs: "none", md: "table-cell" },
                    fontWeight: "bold",
                    backgroundColor: "grey.200",
                    textAlign: "center",
                    width: "13%",
                    py: 1,
                  }}
                >
                  Requester
                </TableCell>
                <TableCell
                  sx={{
                    display: { xs: "none", md: "table-cell" },
                    fontWeight: "bold",
                    backgroundColor: "grey.200",
                    textAlign: "center",
                    width: "10%",
                    py: 1,
                  }}
                >
                  CN
                </TableCell>
                <TableCell
                  sx={{
                    display: { xs: "none", md: "table-cell" },
                    fontWeight: "bold",
                    backgroundColor: "grey.200",
                    textAlign: "center",
                    width: "10%",
                    py: 1,
                  }}
                >
                  ON
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: "bold",
                    backgroundColor: "grey.200",
                    textAlign: "center",
                    width: "14%",
                    py: 1,
                  }}
                >
                  Fulfilled
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: "bold",
                    backgroundColor: "grey.200",
                    textAlign: "center",
                    width: "10%",
                    py: 1,
                  }}
                >
                  Status
                </TableCell>
                <TableCell
                  sx={{
                    display: { xs: "none", sm: "table-cell" },
                    fontWeight: "bold",
                    backgroundColor: "grey.200",
                    textAlign: "center",
                    width: "10%",
                    py: 1,
                  }}
                >
                  GEO
                </TableCell>
                <TableCell
                  sx={{
                    display: { xs: "none", sm: "table-cell" },
                    fontWeight: "bold",
                    backgroundColor: "grey.200",
                    textAlign: "center",
                    width: "10%",
                    py: 1,
                  }}
                >
                  Priority
                </TableCell>
                <TableCell
                  sx={{
                    display: { xs: "none", sm: "table-cell" },
                    fontWeight: "bold",
                    backgroundColor: "grey.200",
                    textAlign: "center",
                    width: "12%",
                    py: 1,
                  }}
                >
                  Planned Date
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: "bold",
                    backgroundColor: "grey.200",
                    textAlign: "right",
                    width: "11%",
                    py: 1,
                  }}
                >
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center">
                    No orders found
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order) => {
                  const isExpanded = !!expandedRowData[order._id];
                  const expandedDetails = expandedRowData[order._id];
                  return (
                    <React.Fragment key={order._id}>
                      <TableRow
                        hover
                        onClick={() => toggleRowExpansion(order._id)}
                        sx={{ cursor: "pointer", "& td": { py: 0.5 } }}
                      >
                        <TableCell>
                          <Typography variant="body2" noWrap>
                            {order._id.slice(-8)}
                          </Typography>
                        </TableCell>
                        <TableCell
                          align="center"
                          sx={{ display: { xs: "none", md: "table-cell" } }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 0.5,
                              "&:hover .edit-requester-icon": {
                                opacity: 1,
                              },
                            }}
                          >
                            <Typography
                              variant="body2"
                              noWrap
                              sx={{ maxWidth: "100%" }}
                            >
                              {order.requester?.fullName}
                            </Typography>
                            {user?.role === "admin" && (
                              <IconButton
                                className="edit-requester-icon"
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenChangeRequester(order);
                                }}
                                title="Change Requester"
                                sx={{
                                  opacity: 0,
                                  transition: "opacity 0.2s",
                                }}
                              >
                                <EditIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            )}
                            {user?.role === "admin" &&
                              order.requesterHistory?.length > 0 && (
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenRequesterHistory(order);
                                  }}
                                  title="Requester History"
                                >
                                  <HistoryIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                              )}
                          </Box>
                        </TableCell>
                        <TableCell
                          align="center"
                          sx={{ display: { xs: "none", md: "table-cell" } }}
                        >
                          <Typography variant="body2" noWrap>
                            {order.selectedClientNetwork?.name || "-"}
                          </Typography>
                        </TableCell>
                        <TableCell
                          align="center"
                          sx={{ display: { xs: "none", md: "table-cell" } }}
                        >
                          <Typography variant="body2" noWrap>
                            {order.selectedOurNetwork?.name || "-"}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Box
                            sx={{
                              display: "flex",
                              justifyContent: "center",
                              gap: 0.5,
                            }}
                          >
                            {[
                              {
                                fulfilled: order.fulfilled?.ftd || 0,
                                requested: order.requests?.ftd || 0,
                              },
                              {
                                fulfilled: order.fulfilled?.filler || 0,
                                requested: order.requests?.filler || 0,
                              },
                              {
                                fulfilled: order.fulfilled?.cold || 0,
                                requested: order.requests?.cold || 0,
                              },
                            ].map((item, idx) => {
                              const isUnfulfilled =
                                (order.status === "cancelled" ||
                                  order.status === "partial") &&
                                item.fulfilled < item.requested;
                              return (
                                <React.Fragment key={idx}>
                                  {idx > 0 && (
                                    <Typography
                                      variant="body2"
                                      component="span"
                                      sx={{
                                        color: "primary.main",
                                        fontWeight: 900,
                                        mx: 0.5,
                                      }}
                                    >
                                      |
                                    </Typography>
                                  )}
                                  <Typography
                                    variant="caption"
                                    component="span"
                                    noWrap
                                  >
                                    <Box
                                      component="span"
                                      sx={{
                                        color: isUnfulfilled
                                          ? "error.main"
                                          : "inherit",
                                      }}
                                    >
                                      {item.fulfilled}
                                    </Box>
                                    /{item.requested}
                                  </Typography>
                                </React.Fragment>
                              );
                            })}
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip
                            title={
                              order.status === "cancelled" &&
                              order.cancellationReason
                                ? `Cancellation Details: ${
                                    order.cancellationReason.split(" | ")
                                      .length > 1
                                      ? order.cancellationReason.split(" | ")
                                          .length + " issues found"
                                      : order.cancellationReason
                                  }`
                                : order.status === "partial" &&
                                  order.partialFulfillmentReason
                                ? `Partial Fulfillment: ${
                                    order.partialFulfillmentReason.split(" | ")
                                      .length > 1
                                      ? order.partialFulfillmentReason.split(
                                          " | "
                                        ).length + " lead types affected"
                                      : order.partialFulfillmentReason
                                  }`
                                : ""
                            }
                            placement="top"
                            arrow
                            componentsProps={{
                              tooltip: {
                                sx: {
                                  maxWidth: 400,
                                  fontSize: "0.875rem",
                                },
                              },
                            }}
                          >
                            <Chip
                              label={order.status}
                              color={getStatusColor(order.status)}
                              size="small"
                            />
                          </Tooltip>
                        </TableCell>
                        <TableCell
                          align="center"
                          sx={{ display: { xs: "none", sm: "table-cell" } }}
                        >
                          <Typography variant="body2" noWrap>
                            {order.countryFilter || "Any"}
                          </Typography>
                        </TableCell>
                        <TableCell
                          align="center"
                          sx={{ display: { xs: "none", sm: "table-cell" } }}
                        >
                          <Chip
                            label={order.priority}
                            color={getPriorityColor(order.priority)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell
                          align="center"
                          sx={{ display: { xs: "none", sm: "table-cell" } }}
                        >
                          <Typography variant="body2" noWrap>
                            {order.plannedDate
                              ? new Date(order.plannedDate).toLocaleDateString()
                              : "N/A"}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Box
                            display="flex"
                            flexDirection="row"
                            gap={0.5}
                            justifyContent="flex-end"
                          >
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePreviewOrderLeads(order._id);
                              }}
                              title="Preview Leads"
                            >
                              <ViewIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleExportLeads(order._id);
                              }}
                              title="Export Leads as CSV"
                            >
                              <DownloadIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyOrderLeadsById(order._id);
                              }}
                              title="Copy Leads to Clipboard"
                            >
                              <ContentCopyIcon fontSize="small" />
                            </IconButton>

                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenOrderAudit(order);
                              }}
                              title="View Audit Log"
                              color="info"
                            >
                              <HistoryIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </TableCell>
                      </TableRow>
                      {}
                      <TableRow>
                        <TableCell
                          sx={{ p: 0, borderBottom: "none" }}
                          colSpan={10}
                        >
                          <Collapse
                            in={isExpanded}
                            timeout="auto"
                            unmountOnExit
                          >
                            <Box sx={{ p: 3, bgcolor: "grey.50" }}>
                              {expandedDetails ? (
                                <Grid container spacing={2}>
                                  {/* Status Reason Alerts */}
                                  {expandedDetails.status === "cancelled" &&
                                    expandedDetails.cancellationReason && (
                                      <Grid item xs={12}>
                                        <Alert
                                          severity="error"
                                          sx={{ borderRadius: 2 }}
                                        >
                                          <Typography
                                            variant="body2"
                                            sx={{ fontWeight: 600, mb: 0.5 }}
                                          >
                                            Cancellation Reason:
                                          </Typography>
                                          {expandedDetails.cancellationReason
                                            .split(" | ")
                                            .map((reason, index) => (
                                              <Typography
                                                key={index}
                                                variant="body2"
                                                sx={{ ml: 1 }}
                                              >
                                                • {reason}
                                              </Typography>
                                            ))}
                                        </Alert>
                                      </Grid>
                                    )}
                                  {expandedDetails.status === "partial" &&
                                    expandedDetails.partialFulfillmentReason && (
                                      <Grid item xs={12}>
                                        <Alert
                                          severity="warning"
                                          sx={{ borderRadius: 2 }}
                                        >
                                          <Typography
                                            variant="body2"
                                            sx={{ fontWeight: 600, mb: 0.5 }}
                                          >
                                            Partial Fulfillment Reason:
                                          </Typography>
                                          {expandedDetails.partialFulfillmentReason
                                            .split(" | ")
                                            .map((reason, index) => (
                                              <Typography
                                                key={index}
                                                variant="body2"
                                                sx={{ ml: 1 }}
                                              >
                                                • {reason}
                                              </Typography>
                                            ))}
                                        </Alert>
                                      </Grid>
                                    )}

                                  {/* Detailed Information Row - Enhanced Compact Layout */}
                                  <Grid item xs={12}>
                                    <Paper
                                      elevation={0}
                                      sx={{
                                        p: 2,
                                        borderRadius: 2,
                                        border: 1,
                                        borderColor: "divider",
                                      }}
                                    >
                                      <Grid container spacing={2}>
                                        {/* Account Manager Section */}
                                        <Grid item xs={12} md={4}>
                                          <Box
                                            sx={{
                                              display: "flex",
                                              alignItems: "center",
                                              gap: 0.5,
                                              mb: 1.5,
                                            }}
                                          >
                                            <Typography
                                              variant="subtitle2"
                                              sx={{
                                                fontWeight: 600,
                                                color: "primary.main",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 0.5,
                                              }}
                                            >
                                              👤 Account Manager
                                            </Typography>
                                            {user?.role === "admin" && (
                                              <IconButton
                                                size="small"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleOpenChangeRequester(order);
                                                }}
                                                title="Change Requester"
                                                sx={{
                                                  p: 0.25,
                                                }}
                                              >
                                                <EditIcon sx={{ fontSize: 14 }} />
                                              </IconButton>
                                            )}
                                            {user?.role === "admin" &&
                                              order.requesterHistory?.length > 0 && (
                                                <IconButton
                                                  size="small"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenRequesterHistory(order);
                                                  }}
                                                  title="Requester History"
                                                  sx={{
                                                    p: 0.25,
                                                  }}
                                                >
                                                  <HistoryIcon sx={{ fontSize: 14 }} />
                                                </IconButton>
                                              )}
                                          </Box>
                                          <Box
                                            sx={{
                                              display: "flex",
                                              flexDirection: "column",
                                              gap: 0.75,
                                            }}
                                          >
                                            <Box
                                              sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1,
                                              }}
                                            >
                                              <Typography
                                                variant="caption"
                                                color="text.secondary"
                                                sx={{ minWidth: "50px" }}
                                              >
                                                Name:
                                              </Typography>
                                              <Typography
                                                variant="body2"
                                                sx={{ fontWeight: 500 }}
                                              >
                                                {expandedDetails.requester
                                                  ?.fullName || "N/A"}
                                              </Typography>
                                            </Box>
                                            <Box
                                              sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1,
                                              }}
                                            >
                                              <Typography
                                                variant="caption"
                                                color="text.secondary"
                                                sx={{ minWidth: "50px" }}
                                              >
                                                Email:
                                              </Typography>
                                              <Typography
                                                variant="body2"
                                                sx={{
                                                  fontWeight: 500,
                                                  fontSize: "0.85rem",
                                                }}
                                              >
                                                {expandedDetails.requester
                                                  ?.email || "N/A"}
                                              </Typography>
                                            </Box>
                                            <Box
                                              sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1,
                                              }}
                                            >
                                              <Typography
                                                variant="caption"
                                                color="text.secondary"
                                                sx={{ minWidth: "50px" }}
                                              >
                                                Role:
                                              </Typography>
                                              <Chip
                                                label={
                                                  expandedDetails.requester
                                                    ?.role || "N/A"
                                                }
                                                size="small"
                                                color="info"
                                                sx={{
                                                  height: "20px",
                                                  fontSize: "0.7rem",
                                                }}
                                              />
                                            </Box>
                                          </Box>
                                        </Grid>

                                        {/* Order Info & Filters Section */}
                                        <Grid item xs={12} md={4}>
                                          <Typography
                                            variant="subtitle2"
                                            sx={{
                                              fontWeight: 600,
                                              mb: 1.5,
                                              color: "primary.main",
                                              display: "flex",
                                              alignItems: "center",
                                              gap: 0.5,
                                            }}
                                          >
                                            📋 Order Info & Filters
                                          </Typography>
                                          <Box
                                            sx={{
                                              display: "flex",
                                              flexDirection: "column",
                                              gap: 0.75,
                                            }}
                                          >
                                            <Box
                                              sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1,
                                              }}
                                            >
                                              <Typography
                                                variant="caption"
                                                color="text.secondary"
                                                sx={{ minWidth: "60px" }}
                                              >
                                                Created:
                                              </Typography>
                                              <Typography
                                                variant="body2"
                                                sx={{ fontWeight: 500 }}
                                              >
                                                {new Date(
                                                  expandedDetails.createdAt
                                                ).toLocaleDateString()}
                                              </Typography>
                                            </Box>
                                            <Box
                                              sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1,
                                              }}
                                            >
                                              <Typography
                                                variant="caption"
                                                color="text.secondary"
                                                sx={{ minWidth: "60px" }}
                                              >
                                                Planned:
                                              </Typography>
                                              <Typography
                                                variant="body2"
                                                sx={{ fontWeight: 500 }}
                                              >
                                                {expandedDetails.plannedDate
                                                  ? new Date(
                                                      expandedDetails.plannedDate
                                                    ).toLocaleDateString()
                                                  : "N/A"}
                                              </Typography>
                                              {(user?.role === "admin" ||
                                                user?.role ===
                                                  "affiliate_manager") && (
                                                <IconButton
                                                  size="small"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenEditPlannedDate(
                                                      order
                                                    );
                                                  }}
                                                  title="Edit Planned Date"
                                                  sx={{
                                                    p: 0.25,
                                                  }}
                                                >
                                                  <EditIcon
                                                    sx={{ fontSize: 14 }}
                                                  />
                                                </IconButton>
                                              )}
                                            </Box>
                                            <Box
                                              sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1,
                                              }}
                                            >
                                              <Typography
                                                variant="caption"
                                                color="text.secondary"
                                                sx={{ minWidth: "60px" }}
                                              >
                                                Country:
                                              </Typography>
                                              <Chip
                                                label={
                                                  expandedDetails.countryFilter ||
                                                  "Any"
                                                }
                                                size="small"
                                                variant="outlined"
                                                sx={{
                                                  height: "20px",
                                                  fontSize: "0.7rem",
                                                }}
                                              />
                                            </Box>
                                            <Box
                                              sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1,
                                              }}
                                            >
                                              <Typography
                                                variant="caption"
                                                color="text.secondary"
                                                sx={{ minWidth: "60px" }}
                                              >
                                                Gender:
                                              </Typography>
                                              <Chip
                                                label={
                                                  expandedDetails.genderFilter ||
                                                  "Any"
                                                }
                                                size="small"
                                                variant="outlined"
                                                sx={{
                                                  height: "20px",
                                                  fontSize: "0.7rem",
                                                }}
                                              />
                                            </Box>
                                          </Box>
                                        </Grid>

                                        {/* Notes Section */}
                                        <Grid item xs={12} md={4}>
                                          {expandedDetails.notes && (
                                            <>
                                              <Typography
                                                variant="subtitle2"
                                                sx={{
                                                  fontWeight: 600,
                                                  mb: 1.5,
                                                  color: "primary.main",
                                                  display: "flex",
                                                  alignItems: "center",
                                                  gap: 0.5,
                                                }}
                                              >
                                                📝 Notes
                                              </Typography>
                                              <Typography
                                                variant="body2"
                                                sx={{
                                                  fontWeight: 400,
                                                  fontSize: "0.85rem",
                                                  lineHeight: 1.5,
                                                  bgcolor: "action.hover",
                                                  p: 1,
                                                  borderRadius: 1,
                                                }}
                                              >
                                                {expandedDetails.notes}
                                              </Typography>
                                            </>
                                          )}
                                        </Grid>
                                      </Grid>
                                    </Paper>
                                  </Grid>

                                  {/* Network Configuration - Compact Layout */}
                                  <Grid item xs={12}>
                                    <Paper
                                      elevation={0}
                                      sx={{
                                        p: 2,
                                        borderRadius: 2,
                                        border: 1,
                                        borderColor: "divider",
                                      }}
                                    >
                                      <Typography
                                        variant="subtitle2"
                                        sx={{
                                          fontWeight: 600,
                                          mb: 1.5,
                                          color: "primary.main",
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 0.5,
                                        }}
                                      >
                                        🌐 Network Configuration
                                      </Typography>
                                      <Grid container spacing={2}>
                                        <Grid item xs={12} sm={6} md={3}>
                                          <Box
                                            sx={{
                                              display: "flex",
                                              alignItems: "center",
                                              gap: 1,
                                            }}
                                          >
                                            <Typography
                                              variant="caption"
                                              color="text.secondary"
                                              sx={{ minWidth: "70px" }}
                                            >
                                              Campaign:
                                            </Typography>
                                            <Chip
                                              label={
                                                expandedDetails.selectedCampaign
                                                  ?.name || "N/A"
                                              }
                                              size="small"
                                              color="primary"
                                              variant="outlined"
                                              sx={{
                                                height: "22px",
                                                fontSize: "0.75rem",
                                              }}
                                            />
                                            {user?.role === "admin" && (
                                              <IconButton
                                                size="small"
                                                onClick={() =>
                                                  handleOpenEditNetworkConfig(
                                                    expandedDetails,
                                                    "campaign"
                                                  )
                                                }
                                                title="Edit Campaign"
                                                sx={{ p: 0.25 }}
                                              >
                                                <EditIcon sx={{ fontSize: 14 }} />
                                              </IconButton>
                                            )}
                                          </Box>
                                        </Grid>
                                        <Grid item xs={12} sm={6} md={3}>
                                          <Box
                                            sx={{
                                              display: "flex",
                                              alignItems: "center",
                                              gap: 1,
                                            }}
                                          >
                                            <Typography
                                              variant="caption"
                                              color="text.secondary"
                                              sx={{ minWidth: "80px" }}
                                            >
                                              Our Network:
                                            </Typography>
                                            <Chip
                                              label={
                                                expandedDetails
                                                  .selectedOurNetwork?.name ||
                                                "N/A"
                                              }
                                              size="small"
                                              color="secondary"
                                              variant="outlined"
                                              sx={{
                                                height: "22px",
                                                fontSize: "0.75rem",
                                              }}
                                            />
                                            {user?.role === "admin" && (
                                              <IconButton
                                                size="small"
                                                onClick={() =>
                                                  handleOpenEditNetworkConfig(
                                                    expandedDetails,
                                                    "ourNetwork"
                                                  )
                                                }
                                                title="Edit Our Network"
                                                sx={{ p: 0.25 }}
                                              >
                                                <EditIcon sx={{ fontSize: 14 }} />
                                              </IconButton>
                                            )}
                                          </Box>
                                        </Grid>
                                        <Grid item xs={12} sm={6} md={3}>
                                          <Box
                                            sx={{
                                              display: "flex",
                                              alignItems: "center",
                                              gap: 1,
                                            }}
                                          >
                                            <Typography
                                              variant="caption"
                                              color="text.secondary"
                                              sx={{ minWidth: "90px" }}
                                            >
                                              Client Network:
                                            </Typography>
                                            <Chip
                                              label={
                                                expandedDetails
                                                  .selectedClientNetwork
                                                  ?.name || "N/A"
                                              }
                                              size="small"
                                              color="info"
                                              variant="outlined"
                                              sx={{
                                                height: "22px",
                                                fontSize: "0.75rem",
                                              }}
                                            />
                                            {user?.role === "admin" && (
                                              <IconButton
                                                size="small"
                                                onClick={() =>
                                                  handleOpenEditNetworkConfig(
                                                    expandedDetails,
                                                    "clientNetwork"
                                                  )
                                                }
                                                title="Edit Client Network"
                                                sx={{ p: 0.25 }}
                                              >
                                                <EditIcon sx={{ fontSize: 14 }} />
                                              </IconButton>
                                            )}
                                          </Box>
                                        </Grid>
                                        <Grid item xs={12} sm={6} md={3}>
                                          <Box
                                            sx={{
                                              display: "flex",
                                              alignItems: "center",
                                              gap: 1,
                                            }}
                                          >
                                            <Typography
                                              variant="caption"
                                              color="text.secondary"
                                              sx={{ minWidth: "90px" }}
                                            >
                                              Client Brokers:
                                            </Typography>
                                            {user?.role !== "lead_manager" ? (
                                              <Button
                                                size="small"
                                                variant="outlined"
                                                onClick={() =>
                                                  handleOpenClientBrokerManagement(
                                                    expandedDetails
                                                  )
                                                }
                                                startIcon={<BusinessIcon />}
                                                sx={{
                                                  height: "26px",
                                                  fontSize: "0.7rem",
                                                  px: 1,
                                                }}
                                              >
                                                Manage (
                                                {expandedDetails.leads?.filter(
                                                  (lead) =>
                                                    lead.assignedClientBrokers
                                                      ?.length > 0
                                                ).length || 0}
                                                /
                                                {expandedDetails.leads
                                                  ?.length || 0}
                                                )
                                              </Button>
                                            ) : (
                                              <Chip
                                                label={`${
                                                  expandedDetails.leads?.filter(
                                                    (lead) =>
                                                      lead.assignedClientBrokers
                                                        ?.length > 0
                                                  ).length || 0
                                                }/${
                                                  expandedDetails.leads
                                                    ?.length || 0
                                                } assigned`}
                                                size="small"
                                                color="info"
                                                variant="outlined"
                                                sx={{
                                                  height: "22px",
                                                  fontSize: "0.75rem",
                                                }}
                                              />
                                            )}
                                          </Box>
                                        </Grid>
                                      </Grid>
                                    </Paper>
                                  </Grid>

                                  {/* Show leads section if we have leads or are loading them */}
                                  {((expandedDetails.leads &&
                                    expandedDetails.leads.length > 0) ||
                                    expandedDetails.leadsLoading) && (
                                    <Grid item xs={12}>
                                      <Box
                                        sx={{
                                          mb: 2,
                                          p: 2,
                                          bgcolor: "background.paper",
                                          borderRadius: 1,
                                        }}
                                      >
                                        {expandedDetails.leadsLoading ? (
                                          <Box
                                            sx={{
                                              display: "flex",
                                              flexDirection: "column",
                                              alignItems: "center",
                                              justifyContent: "center",
                                              p: 4,
                                              gap: 2,
                                            }}
                                          >
                                            <CircularProgress />
                                            <Typography
                                              variant="body2"
                                              color="text.secondary"
                                            >
                                              Loading{" "}
                                              {expandedDetails.leadsCount || 0}{" "}
                                              leads...
                                            </Typography>
                                          </Box>
                                        ) : (
                                          <>
                                            <Box
                                              sx={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                                mb: 2,
                                                flexWrap: "wrap",
                                                gap: 1,
                                              }}
                                            >
                                              <Box
                                                sx={{
                                                  display: "flex",
                                                  alignItems: "center",
                                                  gap: 2,
                                                }}
                                              >
                                                <Typography
                                                  variant="subtitle1"
                                                  sx={{ fontWeight: "bold" }}
                                                >
                                                  Assigned Leads (
                                                  {expandedDetails.leads.length}
                                                  )
                                                </Typography>
                                                <Button
                                                  variant="contained"
                                                  size="small"
                                                  onClick={() =>
                                                    handleOpenAssignedLeadsModal(
                                                      expandedDetails.leads,
                                                      order._id
                                                    )
                                                  }
                                                >
                                                  See Leads
                                                </Button>
                                                <Button
                                                  variant="outlined"
                                                  size="small"
                                                  startIcon={<ViewIcon />}
                                                  onClick={() =>
                                                    handleOpenLeadsPreviewModal(
                                                      expandedDetails.leads,
                                                      order._id,
                                                      order
                                                    )
                                                  }
                                                >
                                                  Preview
                                                </Button>
                                              </Box>
                                              <Box
                                                sx={{
                                                  display: "flex",
                                                  gap: 1,
                                                  flexWrap: "wrap",
                                                }}
                                              >
                                                <Button
                                                  size="small"
                                                  startIcon={<DownloadIcon />}
                                                  onClick={() =>
                                                    handleExportLeads(order._id)
                                                  }
                                                  variant="outlined"
                                                >
                                                  Export CSV
                                                </Button>
                                                <Button
                                                  size="small"
                                                  startIcon={
                                                    <ContentCopyIcon />
                                                  }
                                                  onClick={() =>
                                                    handleCopyOrderLeads(
                                                      expandedDetails.leads,
                                                      expandedDetails
                                                    )
                                                  }
                                                  variant="outlined"
                                                >
                                                  Copy Leads
                                                </Button>
                                                {(user?.role === "admin" ||
                                                  user?.role ===
                                                    "affiliate_manager" ||
                                                  user?.role ===
                                                    "lead_manager") && (() => {
                                                  const allLeadsValidated = expandedDetails?.leads?.length > 0 &&
                                                    expandedDetails.leads.every((lead) => lead.ipqsValidation?.validatedAt);
                                                  const isValidating = ipqsValidatingOrders.includes(order._id);
                                                  return (
                                                    <Tooltip title={isValidating ? "Validating..." : allLeadsValidated ? "All leads already validated" : "Validate lead emails and phones with IPQS"}>
                                                      <span>
                                                        <Button
                                                          size="small"
                                                          startIcon={
                                                            isValidating ? (
                                                              <CircularProgress size={16} color="inherit" />
                                                            ) : (
                                                              <VerifiedUserIcon />
                                                            )
                                                          }
                                                          onClick={() => handleDirectIPQSValidation(order._id)}
                                                          variant="outlined"
                                                          color="info"
                                                          disabled={isValidating || allLeadsValidated}
                                                        >
                                                          {isValidating ? "Validating..." : "IPQS Validate"}
                                                        </Button>
                                                      </span>
                                                    </Tooltip>
                                                  );
                                                })()}
                                                {(user?.role === "admin" ||
                                                  user?.role ===
                                                    "affiliate_manager" ||
                                                  user?.role ===
                                                    "lead_manager") &&
                                                  expandedDetails?.fulfilled
                                                    ?.ftd > 0 && (
                                                    <Tooltip
                                                      title={
                                                        refundAssignmentStatus[
                                                          expandedDetails._id
                                                        ]?.isAssigned
                                                          ? `${
                                                              refundAssignmentStatus[
                                                                expandedDetails
                                                                  ._id
                                                              ]
                                                                ?.assignmentCount ||
                                                              0
                                                            } FTD lead(s) already assigned`
                                                          : `Assign ${
                                                              expandedDetails
                                                                ?.fulfilled
                                                                ?.ftd || 0
                                                            } FTD lead(s) to refunds manager`
                                                      }
                                                    >
                                                      <span>
                                                        <Button
                                                          size="small"
                                                          variant={
                                                            refundAssignmentStatus[
                                                              expandedDetails._id
                                                            ]?.isAssigned
                                                              ? "outlined"
                                                              : "contained"
                                                          }
                                                          color={
                                                            refundAssignmentStatus[
                                                              expandedDetails._id
                                                            ]?.isAssigned
                                                              ? "success"
                                                              : "primary"
                                                          }
                                                          startIcon={
                                                            refundAssignmentStatus[
                                                              expandedDetails._id
                                                            ]?.isAssigned ? (
                                                              <CheckCircleIcon />
                                                            ) : (
                                                              <SendIcon />
                                                            )
                                                          }
                                                          onClick={() =>
                                                            handleOpenRefundsAssignment(
                                                              expandedDetails._id
                                                            )
                                                          }
                                                          disabled={
                                                            refundAssignmentStatus[
                                                              expandedDetails._id
                                                            ]?.isAssigned
                                                          }
                                                        >
                                                          {refundAssignmentStatus[
                                                            expandedDetails._id
                                                          ]?.isAssigned
                                                            ? "Assigned to Refunds"
                                                            : "Assign to Refunds"}
                                                        </Button>
                                                      </span>
                                                    </Tooltip>
                                                  )}
                                              </Box>
                                            </Box>
                                          </>
                                        )}
                                      </Box>
                                    </Grid>
                                  )}
                                </Grid>
                              ) : (
                                <Box
                                  sx={{
                                    display: "flex",
                                    justifyContent: "center",
                                    p: 2,
                                  }}
                                >
                                  <CircularProgress />
                                </Box>
                              )}
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[25, 50, 100]}
          component="div"
          count={totalOrders}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>
      {}
      <Dialog
        open={createDialogOpen}
        onClose={() => {
          setCreateDialogOpen(false);
          setFilteredAgents([]);
          setUnassignedLeadsStats({ ftd: null, filler: null });
          setManualSelectionMode(false);
          setManualLeadEmails("");
          setManualLeads([]);
          setClientNetworkInput("");
          setClientNetworkOpen(false);
          setOurNetworkInput("");
          setOurNetworkOpen(false);
          setCampaignInput("");
          setCampaignOpen(false);
        }}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle
          sx={{
            py: 1.5,
            background: (theme) =>
              `linear-gradient(135deg, ${alpha(
                theme.palette.primary.main,
                0.08
              )} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
            }}
          >
            {/* Left: Title and Manual Toggle */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Typography variant="h6" fontWeight={600}>
                Create New Order
              </Typography>
              <Button
                variant={manualSelectionMode ? "contained" : "outlined"}
                size="small"
                onClick={() => {
                  setManualSelectionMode(!manualSelectionMode);
                  if (manualSelectionMode) {
                    setManualLeadEmails("");
                    setManualLeads([]);
                  }
                }}
                sx={{
                  borderRadius: "16px",
                  textTransform: "none",
                  fontSize: "0.75rem",
                  px: 2,
                  py: 0.5,
                  minWidth: "auto",
                }}
              >
                {manualSelectionMode ? "Auto" : "Manual"}
              </Button>
            </Box>

            {/* Right: Quick Filters - Gender & Priority as Chips */}
            {!manualSelectionMode && (
              <Box sx={{ display: "flex", gap: 3, alignItems: "center" }}>
                {/* Gender Filter */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontWeight: 500 }}
                  >
                    Gender:
                  </Typography>
                  <Controller
                    name="genderFilter"
                    control={control}
                    render={({ field }) => (
                      <ToggleButtonGroup
                        value={field.value || ""}
                        exclusive
                        onChange={(e, newValue) =>
                          field.onChange(newValue ?? "")
                        }
                        size="small"
                        sx={{
                          "& .MuiToggleButton-root": {
                            px: 1.5,
                            py: 0.25,
                            fontSize: "0.7rem",
                            textTransform: "none",
                            borderRadius: "16px !important",
                            border: "1px solid",
                            borderColor: "divider",
                            mx: 0.25,
                            "&.Mui-selected": {
                              bgcolor: "primary.main",
                              color: "primary.contrastText",
                              borderColor: "primary.main",
                              "&:hover": {
                                bgcolor: "primary.dark",
                              },
                            },
                          },
                        }}
                      >
                        <ToggleButton value="">All</ToggleButton>
                        <ToggleButton value="male">Male</ToggleButton>
                        <ToggleButton value="female">Female</ToggleButton>
                        <ToggleButton value="not_defined">N/A</ToggleButton>
                      </ToggleButtonGroup>
                    )}
                  />
                </Box>

                {/* Priority Filter */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontWeight: 500 }}
                  >
                    Priority:
                  </Typography>
                  <Controller
                    name="priority"
                    control={control}
                    render={({ field }) => (
                      <ToggleButtonGroup
                        value={field.value || "medium"}
                        exclusive
                        onChange={(e, newValue) => {
                          if (newValue !== null) field.onChange(newValue);
                        }}
                        size="small"
                        sx={{
                          "& .MuiToggleButton-root": {
                            px: 1.5,
                            py: 0.25,
                            fontSize: "0.7rem",
                            textTransform: "none",
                            borderRadius: "16px !important",
                            border: "1px solid",
                            borderColor: "divider",
                            mx: 0.25,
                            "&.Mui-selected": {
                              '&[value="low"]': {
                                bgcolor: "success.main",
                                color: "success.contrastText",
                                borderColor: "success.main",
                              },
                              '&[value="medium"]': {
                                bgcolor: "warning.main",
                                color: "warning.contrastText",
                                borderColor: "warning.main",
                              },
                              '&[value="high"]': {
                                bgcolor: "error.main",
                                color: "error.contrastText",
                                borderColor: "error.main",
                              },
                            },
                          },
                        }}
                      >
                        <ToggleButton value="low">Low</ToggleButton>
                        <ToggleButton value="medium">Medium</ToggleButton>
                        <ToggleButton value="high">High</ToggleButton>
                      </ToggleButtonGroup>
                    )}
                  />
                </Box>
              </Box>
            )}
          </Box>
        </DialogTitle>
        <form onSubmit={handleSubmit(onSubmitOrder)}>
          <DialogContent sx={{ pt: 2 }}>
            {/* Top Row: Planned Date + Fulfillment Estimate */}
            {!manualSelectionMode && (
              <Box
                sx={{
                  mb: 3,
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                }}
              >
                {/* Planned Date - Outside the fulfillment box */}
                <Controller
                  name="plannedDate"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Planned Date *"
                      type="date"
                      error={!!errors.plannedDate}
                      size="small"
                      InputLabelProps={{ shrink: true }}
                      sx={{
                        "& .MuiInputBase-input": {
                          py: 0.75,
                          fontSize: "0.875rem",
                        },
                        width: 160,
                        flexShrink: 0,
                      }}
                      value={
                        field.value
                          ? new Date(field.value).toISOString().split("T")[0]
                          : ""
                      }
                      onChange={(e) => {
                        const dateValue = e.target.value
                          ? new Date(e.target.value)
                          : null;
                        field.onChange(dateValue);
                      }}
                    />
                  )}
                />

                {/* Fulfillment Box */}
                <Box
                  sx={{
                    flex: 1,
                    p: 1.5,
                    bgcolor: (theme) => alpha(theme.palette.info.main, 0.04),
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: (theme) => alpha(theme.palette.info.main, 0.2),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 2,
                    minHeight: 44,
                  }}
                >
                  {/* Left: Title and Status */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        fontWeight: 600,
                        color: "info.dark",
                        whiteSpace: "nowrap",
                      }}
                    >
                      📊 Fulfillment
                      {checkingFulfillment && <CircularProgress size={14} />}
                    </Typography>

                    {/* Status Chip */}
                    {!checkingFulfillment && fulfillmentSummary ? (
                      <Chip
                        label={
                          fulfillmentSummary.status === "fulfilled"
                            ? "✓ Can be Fulfilled"
                            : fulfillmentSummary.status === "partial"
                            ? "⚠ Partial"
                            : "✗ Not Fulfilled"
                        }
                        color={
                          fulfillmentSummary.status === "fulfilled"
                            ? "success"
                            : fulfillmentSummary.status === "partial"
                            ? "warning"
                            : "error"
                        }
                        size="small"
                        sx={{ fontWeight: 500 }}
                      />
                    ) : (
                      <Chip
                        label={checkingFulfillment ? "Checking..." : "Pending"}
                        size="small"
                        variant="outlined"
                        sx={{ opacity: 0.6 }}
                      />
                    )}
                  </Box>

                  {/* Right: Breakdown Stats */}
                  <Box sx={{ display: "flex", gap: 3 }}>
                    {fulfillmentSummary?.breakdown ? (
                      Object.entries(fulfillmentSummary.breakdown).map(
                        ([type, stats]) =>
                          stats.requested > 0 ? (
                            <Box
                              key={type}
                              sx={{ textAlign: "center", minWidth: 45 }}
                            >
                              <Typography
                                variant="caption"
                                fontWeight="bold"
                                display="block"
                                sx={{
                                  textTransform: "uppercase",
                                  color: "text.secondary",
                                  fontSize: "0.65rem",
                                }}
                              >
                                {type}
                              </Typography>
                              <Typography
                                variant="body2"
                                fontWeight={600}
                                color={
                                  stats.available < stats.requested
                                    ? "error.main"
                                    : "success.main"
                                }
                              >
                                {stats.available}/{stats.requested}
                              </Typography>
                            </Box>
                          ) : null
                      )
                    ) : (
                      <>
                        <Box
                          sx={{
                            textAlign: "center",
                            minWidth: 45,
                            opacity: 0.4,
                          }}
                        >
                          <Typography
                            variant="caption"
                            fontWeight="bold"
                            display="block"
                            sx={{
                              textTransform: "uppercase",
                              color: "text.secondary",
                              fontSize: "0.65rem",
                            }}
                          >
                            FTD
                          </Typography>
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            color="text.disabled"
                          >
                            -/-
                          </Typography>
                        </Box>
                        <Box
                          sx={{
                            textAlign: "center",
                            minWidth: 45,
                            opacity: 0.4,
                          }}
                        >
                          <Typography
                            variant="caption"
                            fontWeight="bold"
                            display="block"
                            sx={{
                              textTransform: "uppercase",
                              color: "text.secondary",
                              fontSize: "0.65rem",
                            }}
                          >
                            Filler
                          </Typography>
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            color="text.disabled"
                          >
                            -/-
                          </Typography>
                        </Box>
                      </>
                    )}
                  </Box>
                </Box>
              </Box>
            )}

            <Grid container spacing={2}>
              {/* Manual Selection Mode UI */}
              {manualSelectionMode && (
                <>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={4}
                      label="Lead Emails (one per line or space/comma separated)"
                      placeholder="email1@example.com&#10;email2@example.com&#10;email3@example.com"
                      value={manualLeadEmails}
                      onChange={(e) => setManualLeadEmails(e.target.value)}
                      size="small"
                      helperText="Enter the email addresses of leads you want to include in this order"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Button
                      variant="contained"
                      onClick={searchLeadsByEmails}
                      disabled={searchingLeads || !manualLeadEmails.trim()}
                      startIcon={
                        searchingLeads ? (
                          <CircularProgress size={16} color="inherit" />
                        ) : (
                          <PersonIcon />
                        )
                      }
                    >
                      {searchingLeads ? "Searching..." : "Search Leads"}
                    </Button>
                  </Grid>

                  {/* Display found leads with agent assignment */}
                  {manualLeads.length > 0 && (
                    <Grid item xs={12}>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          mb: 1,
                        }}
                      >
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          Found Leads ({manualLeads.length})
                        </Typography>
                        {manualLeads.filter((e) => e.isOnCooldown).length > 0 && (
                          <Chip
                            label={`${
                              manualLeads.filter((e) => !e.isOnCooldown).length
                            } active, ${
                              manualLeads.filter((e) => e.isOnCooldown).length
                            } on cooldown`}
                            size="small"
                            color={
                              manualLeads.filter((e) => !e.isOnCooldown).length ===
                              0
                                ? "error"
                                : "warning"
                            }
                            variant="outlined"
                          />
                        )}
                      </Box>
                      <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Email</TableCell>
                              <TableCell>Name</TableCell>
                              <TableCell>Country</TableCell>
                              <TableCell>Type</TableCell>
                              <TableCell>Assign to Agent *</TableCell>
                              <TableCell width={50}></TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {manualLeads.map((entry, index) => (
                              <TableRow
                                key={entry.lead._id}
                                sx={{
                                  opacity: entry.isOnCooldown ? 0.5 : 1,
                                  bgcolor: entry.isOnCooldown
                                    ? "action.disabledBackground"
                                    : "inherit",
                                }}
                              >
                                <TableCell>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      fontSize: "0.75rem",
                                      textDecoration: entry.isOnCooldown
                                        ? "line-through"
                                        : "none",
                                    }}
                                  >
                                    {entry.lead.newEmail}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  {entry.lead.firstName} {entry.lead.lastName}
                                </TableCell>
                                <TableCell>{entry.lead.country}</TableCell>
                                <TableCell>
                                  <Box
                                    sx={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 0.5,
                                    }}
                                  >
                                    <Chip
                                      label={entry.lead.leadType?.toUpperCase()}
                                      size="small"
                                      color={
                                        entry.isOnCooldown
                                          ? "default"
                                          : entry.lead.leadType === "ftd"
                                          ? "success"
                                          : entry.lead.leadType === "filler"
                                          ? "warning"
                                          : "default"
                                      }
                                    />
                                    {entry.isOnCooldown && (
                                      <Chip
                                        label={`Cooldown ${entry.cooldownDaysRemaining}d`}
                                        size="small"
                                        color="error"
                                        variant="outlined"
                                        sx={{ fontSize: "0.65rem" }}
                                      />
                                    )}
                                  </Box>
                                </TableCell>
                                <TableCell>
                                  {entry.lead.leadType === "cold" ? (
                                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                                      N/A
                                    </Typography>
                                  ) : (
                                    <FormControl fullWidth size="small">
                                      <Select
                                        value={entry.agent}
                                        onChange={(e) =>
                                          updateManualLeadAgent(
                                            index,
                                            e.target.value
                                          )
                                        }
                                        displayEmpty
                                        error={!entry.agent && (!entry.isOnCooldown || user?.role === "admin")}
                                        disabled={entry.isOnCooldown && user?.role !== "admin"}
                                      >
                                        <MenuItem value="">
                                          <em>
                                            {entry.isOnCooldown && user?.role !== "admin"
                                              ? "On Cooldown"
                                              : "Select Agent"}
                                          </em>
                                        </MenuItem>
                                        {allAgents.map((agent) => (
                                          <MenuItem
                                            key={agent._id}
                                            value={agent._id}
                                          >
                                            {agent.fullName || agent.email}
                                          </MenuItem>
                                        ))}
                                      </Select>
                                    </FormControl>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <IconButton
                                    size="small"
                                    onClick={() => removeManualLead(index)}
                                    color="error"
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ mt: 1, display: "block" }}
                      >
                        * All active FTD/Filler leads must have an agent assigned. Cold leads do not require agent assignment. Leads on
                        cooldown will be automatically excluded from the order.
                      </Typography>
                    </Grid>
                  )}
                </>
              )}

              {/* Normal Selection Mode UI */}
              {!manualSelectionMode && (
                <>
                  {/* Lead Quantities Section */}
                  <Grid item xs={12}>
                    <Box
                      sx={{
                        p: 2,
                        bgcolor: (theme) =>
                          alpha(theme.palette.grey[500], 0.04),
                        borderRadius: 2,
                        border: "1px solid",
                        borderColor: "divider",
                      }}
                    >
                      <Typography
                        variant="subtitle2"
                        sx={{
                          mb: 1.5,
                          fontWeight: 600,
                          color: "text.secondary",
                        }}
                      >
                        Lead Quantities
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={6} sm={3}>
                          <Controller
                            name="ftd"
                            control={control}
                            render={({ field }) => (
                              <TextField
                                {...field}
                                fullWidth
                                label="FTD"
                                type="number"
                                error={!!errors.ftd}
                                helperText={errors.ftd?.message}
                                inputProps={{ min: 0 }}
                                size="small"
                                sx={{
                                  "& .MuiOutlinedInput-root": {
                                    bgcolor: "background.paper",
                                  },
                                }}
                              />
                            )}
                          />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Controller
                            name="filler"
                            control={control}
                            render={({ field }) => (
                              <TextField
                                {...field}
                                fullWidth
                                label="Filler"
                                type="number"
                                error={!!errors.filler}
                                helperText={errors.filler?.message}
                                inputProps={{ min: 0 }}
                                size="small"
                                sx={{
                                  "& .MuiOutlinedInput-root": {
                                    bgcolor: "background.paper",
                                  },
                                }}
                              />
                            )}
                          />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Controller
                            name="cold"
                            control={control}
                            render={({ field }) => (
                              <TextField
                                {...field}
                                fullWidth
                                label="Cold"
                                type="number"
                                error={!!errors.cold}
                                helperText={errors.cold?.message}
                                inputProps={{ min: 0 }}
                                size="small"
                                sx={{
                                  "& .MuiOutlinedInput-root": {
                                    bgcolor: "background.paper",
                                  },
                                }}
                              />
                            )}
                          />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Controller
                            name="countryFilter"
                            control={control}
                            render={({ field }) => {
                              const [inputValue, setInputValue] =
                                React.useState("");
                              const [isOpen, setIsOpen] = React.useState(false);

                              return (
                                <Autocomplete
                                  {...field}
                                  options={getSortedCountries().map(
                                    (country) => country.name
                                  )}
                                  value={field.value || null}
                                  inputValue={inputValue}
                                  open={isOpen}
                                  onOpen={() => {
                                    if (inputValue.length > 0) setIsOpen(true);
                                  }}
                                  onClose={() => setIsOpen(false)}
                                  onInputChange={(
                                    event,
                                    newInputValue,
                                    reason
                                  ) => {
                                    setInputValue(newInputValue);
                                    if (
                                      reason === "input" &&
                                      newInputValue.length > 0
                                    ) {
                                      setIsOpen(true);
                                    } else if (
                                      reason === "clear" ||
                                      newInputValue.length === 0
                                    ) {
                                      setIsOpen(false);
                                    }
                                  }}
                                  onChange={(event, newValue) => {
                                    field.onChange(newValue || "");
                                    setIsOpen(false);
                                  }}
                                  filterOptions={(options, state) => {
                                    if (!state.inputValue) {
                                      return [];
                                    }
                                    return options.filter((option) =>
                                      option
                                        .toLowerCase()
                                        .includes(
                                          state.inputValue.toLowerCase()
                                        )
                                    );
                                  }}
                                  renderInput={(params) => (
                                    <TextField
                                      {...params}
                                      label="Country *"
                                      size="small"
                                      error={!!errors.countryFilter}
                                      helperText={errors.countryFilter?.message}
                                      sx={{
                                        "& .MuiOutlinedInput-root": {
                                          bgcolor: "background.paper",
                                        },
                                      }}
                                    />
                                  )}
                                  fullWidth
                                  disableClearable={false}
                                  forcePopupIcon={false}
                                  noOptionsText=""
                                />
                              );
                            }}
                          />
                        </Grid>
                      </Grid>
                    </Box>
                  </Grid>
                </>
              )}

              {/* Common fields for both modes */}

              {/* Networks Section - Grouped */}
              <Grid item xs={12}>
                <Box
                  sx={{
                    p: 2,
                    bgcolor: (theme) => alpha(theme.palette.grey[500], 0.04),
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    sx={{ mb: 1.5, fontWeight: 600, color: "text.secondary" }}
                  >
                    Network Configuration
                  </Typography>
                  <Grid container spacing={2}>
                    {/* Client Network Selection */}
                    {(user?.role === "admin" ||
                      user?.role === "affiliate_manager") && (
                      <Grid item xs={12} md={6}>
                        <Controller
                          name="selectedClientNetwork"
                          control={control}
                          render={({ field: { onChange, value } }) => (
                            <Autocomplete
                              open={clientNetworkOpen}
                              onOpen={() => {
                                if (clientNetworkInput.length > 0)
                                  setClientNetworkOpen(true);
                              }}
                              onClose={() => setClientNetworkOpen(false)}
                              inputValue={clientNetworkInput}
                              onInputChange={(event, newInputValue, reason) => {
                                setClientNetworkInput(newInputValue);
                                if (
                                  reason === "input" &&
                                  newInputValue.length > 0
                                ) {
                                  setClientNetworkOpen(true);
                                } else if (
                                  reason === "clear" ||
                                  newInputValue.length === 0
                                ) {
                                  setClientNetworkOpen(false);
                                }
                              }}
                              options={clientNetworks}
                              getOptionLabel={(option) => option.name || ""}
                              value={
                                clientNetworks.find((n) => n._id === value) ||
                                null
                              }
                              onChange={(event, newValue) => {
                                onChange(newValue ? newValue._id : "");
                                setFilteredAgents([]);
                                setUnassignedLeadsStats({
                                  ftd: null,
                                  filler: null,
                                });
                              }}
                              disabled={loadingClientNetworks}
                              size="small"
                              renderInput={(params) => (
                                <TextField
                                  {...params}
                                  label="Client Network *"
                                  error={!!errors.selectedClientNetwork}
                                  placeholder="Search..."
                                  helperText={
                                    errors.selectedClientNetwork?.message ||
                                    (loadingClientNetworks
                                      ? "Loading..."
                                      : `${clientNetworks.length} available`)
                                  }
                                  sx={{
                                    "& .MuiOutlinedInput-root": {
                                      bgcolor: "background.paper",
                                    },
                                  }}
                                />
                              )}
                              renderOption={(props, option) => (
                                <li {...props} key={option._id}>
                                  <Box>
                                    <Typography variant="body2">
                                      {option.name}
                                    </Typography>
                                    {option.description && (
                                      <Typography
                                        variant="caption"
                                        sx={{ color: "text.secondary" }}
                                      >
                                        {option.description}
                                      </Typography>
                                    )}
                                  </Box>
                                </li>
                              )}
                              isOptionEqualToValue={(option, value) =>
                                option._id === value._id
                              }
                            />
                          )}
                        />
                      </Grid>
                    )}
                    {/* Our Network Selection */}
                    <Grid
                      item
                      xs={12}
                      md={
                        user?.role === "admin" ||
                        user?.role === "affiliate_manager"
                          ? 6
                          : 12
                      }
                    >
                      <Controller
                        name="selectedOurNetwork"
                        control={control}
                        render={({ field: { onChange, value } }) => (
                          <Autocomplete
                            open={ourNetworkOpen}
                            onOpen={() => {
                              if (ourNetworkInput.length > 0)
                                setOurNetworkOpen(true);
                            }}
                            onClose={() => setOurNetworkOpen(false)}
                            inputValue={ourNetworkInput}
                            onInputChange={(event, newInputValue, reason) => {
                              setOurNetworkInput(newInputValue);
                              if (
                                reason === "input" &&
                                newInputValue.length > 0
                              ) {
                                setOurNetworkOpen(true);
                              } else if (
                                reason === "clear" ||
                                newInputValue.length === 0
                              ) {
                                setOurNetworkOpen(false);
                              }
                            }}
                            options={ourNetworks}
                            getOptionLabel={(option) => option.name || ""}
                            value={
                              ourNetworks.find((n) => n._id === value) || null
                            }
                            onChange={(event, newValue) => {
                              onChange(newValue ? newValue._id : "");
                            }}
                            disabled={loadingOurNetworks}
                            size="small"
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                label="Our Network *"
                                error={!!errors.selectedOurNetwork}
                                placeholder="Search..."
                                helperText={
                                  errors.selectedOurNetwork?.message ||
                                  (loadingOurNetworks
                                    ? "Loading..."
                                    : `${ourNetworks.length} available`)
                                }
                                sx={{
                                  "& .MuiOutlinedInput-root": {
                                    bgcolor: "background.paper",
                                  },
                                }}
                              />
                            )}
                            renderOption={(props, option) => (
                              <li {...props} key={option._id}>
                                <Box>
                                  <Typography variant="body2">
                                    {option.name}
                                  </Typography>
                                  {option.description && (
                                    <Typography
                                      variant="caption"
                                      sx={{ color: "text.secondary" }}
                                    >
                                      {option.description}
                                    </Typography>
                                  )}
                                </Box>
                              </li>
                            )}
                            isOptionEqualToValue={(option, value) =>
                              option._id === value._id
                            }
                          />
                        )}
                      />
                    </Grid>
                  </Grid>
                </Box>
              </Grid>
              {/* Campaign & Brokers Section */}
              <Grid item xs={12}>
                <Box
                  sx={{
                    p: 2,
                    bgcolor: (theme) => alpha(theme.palette.grey[500], 0.04),
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    sx={{ mb: 1.5, fontWeight: 600, color: "text.secondary" }}
                  >
                    Campaign & Broker Settings
                  </Typography>
                  <Grid container spacing={2}>
                    {/* Campaign Selection */}
                    <Grid item xs={12} md={6}>
                      <Controller
                        name="selectedCampaign"
                        control={control}
                        render={({ field: { onChange, value } }) => (
                          <Autocomplete
                            open={campaignOpen}
                            onOpen={() => {
                              if (campaignInput.length > 0)
                                setCampaignOpen(true);
                            }}
                            onClose={() => setCampaignOpen(false)}
                            inputValue={campaignInput}
                            onInputChange={(event, newInputValue, reason) => {
                              setCampaignInput(newInputValue);
                              if (
                                reason === "input" &&
                                newInputValue.length > 0
                              ) {
                                setCampaignOpen(true);
                              } else if (
                                reason === "clear" ||
                                newInputValue.length === 0
                              ) {
                                setCampaignOpen(false);
                              }
                            }}
                            options={campaigns}
                            getOptionLabel={(option) => option.name || ""}
                            value={
                              campaigns.find((c) => c._id === value) || null
                            }
                            onChange={(event, newValue) => {
                              onChange(newValue ? newValue._id : "");
                            }}
                            disabled={loadingCampaigns}
                            size="small"
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                label="Campaign *"
                                error={!!errors.selectedCampaign}
                                helperText={
                                  errors.selectedCampaign?.message ||
                                  (loadingCampaigns
                                    ? "Loading..."
                                    : `${campaigns.length} available`)
                                }
                                placeholder="Search..."
                                sx={{
                                  "& .MuiOutlinedInput-root": {
                                    bgcolor: "background.paper",
                                  },
                                }}
                              />
                            )}
                            renderOption={(props, option) => (
                              <li {...props} key={option._id}>
                                <Box>
                                  <Typography variant="body2">
                                    {option.name}
                                  </Typography>
                                  {option.description && (
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        display: "block",
                                        color: "text.secondary",
                                      }}
                                    >
                                      {option.description}
                                    </Typography>
                                  )}
                                </Box>
                              </li>
                            )}
                            isOptionEqualToValue={(option, value) =>
                              option._id === value._id
                            }
                          />
                        )}
                      />
                    </Grid>
                    {/* Client Brokers Selection */}
                    <Grid item xs={12} md={6}>
                      <Controller
                        name="selectedClientBrokers"
                        control={control}
                        render={({ field: { onChange, value } }) => (
                          <Autocomplete
                            multiple
                            options={clientBrokers}
                            getOptionLabel={(option) => option.name || ""}
                            value={clientBrokers.filter((broker) =>
                              (value || []).includes(broker._id)
                            )}
                            isOptionEqualToValue={(option, value) =>
                              option._id === value._id
                            }
                            onChange={(event, newValue) => {
                              onChange(newValue.map((broker) => broker._id));
                              setFilteredAgents([]);
                              setUnassignedLeadsStats({
                                ftd: null,
                                filler: null,
                              });
                            }}
                            loading={loadingClientBrokers}
                            disabled={loadingClientBrokers}
                            size="small"
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                fullWidth
                                label="Exclude Brokers (optional)"
                                placeholder="Select..."
                                error={!!errors.selectedClientBrokers}
                                helperText={
                                  errors.selectedClientBrokers?.message ||
                                  "Exclude leads from these brokers"
                                }
                                sx={{
                                  "& .MuiOutlinedInput-root": {
                                    bgcolor: "background.paper",
                                  },
                                }}
                                InputProps={{
                                  ...params.InputProps,
                                  endAdornment: (
                                    <React.Fragment>
                                      {loadingClientBrokers ? (
                                        <CircularProgress
                                          color="inherit"
                                          size={18}
                                        />
                                      ) : null}
                                      {params.InputProps.endAdornment}
                                    </React.Fragment>
                                  ),
                                }}
                              />
                            )}
                            renderTags={(tagValue, getTagProps) =>
                              tagValue.map((option, index) => {
                                const { key, ...chipProps } = getTagProps({
                                  index,
                                });
                                return (
                                  <Chip
                                    key={key}
                                    label={option.name}
                                    {...chipProps}
                                    size="small"
                                  />
                                );
                              })
                            }
                          />
                        )}
                      />
                    </Grid>
                  </Grid>
                </Box>
              </Grid>

              {/* Load Agents Button - Shows when criteria are set and FTD or Filler > 0 (Normal mode only) */}
              {!manualSelectionMode &&
                (watch("ftd") > 0 || watch("filler") > 0) &&
                watch("countryFilter") &&
                watch("selectedClientNetwork") && (
                  <Grid item xs={12}>
                    <Box
                      sx={{
                        display: "flex",
                        gap: 2,
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      <Button
                        variant="outlined"
                        color="primary"
                        onClick={async () => {
                          const country = watch("countryFilter");
                          const clientNetwork = watch("selectedClientNetwork");
                          const clientBrokersSelected =
                            watch("selectedClientBrokers") || [];

                          // Fetch filtered agents for FTD/Filler leads
                          // Both FTD and Filler are stored with leadType: 'ftd' in the database
                          // So we always search for 'ftd' type leads
                          if (watch("ftd") > 0 || watch("filler") > 0) {
                            await fetchFilteredAgents(
                              "ftd",
                              country,
                              clientNetwork,
                              clientBrokersSelected
                            );
                          }
                        }}
                        disabled={filteredAgentsLoading}
                        startIcon={
                          filteredAgentsLoading ? (
                            <CircularProgress size={16} />
                          ) : (
                            <PersonIcon />
                          )
                        }
                      >
                        {filteredAgentsLoading
                          ? "Loading Agents..."
                          : "Load Matching Agents"}
                      </Button>

                      {filteredAgents.length > 0 && (
                        <Typography variant="body2" color="success.main">
                          Found {filteredAgents.length} agent(s) with leads
                          matching your criteria (country + network + broker
                          filters)
                        </Typography>
                      )}

                      {!filteredAgentsLoading &&
                        filteredAgents.length === 0 &&
                        unassignedLeadsStats.ftd !== null && (
                          <Typography variant="body2" color="warning.main">
                            No agents found with leads matching your criteria.
                            Use unassigned leads option.
                          </Typography>
                        )}
                    </Box>

                    {/* Unassigned leads info - shows filtered stats */}
                    {(unassignedLeadsStats.ftd ||
                      unassignedLeadsStats.filler) && (
                      <Box
                        sx={{
                          mt: 1,
                          p: 1.5,
                          bgcolor: "action.hover",
                          borderRadius: 1,
                        }}
                      >
                        <Typography variant="subtitle2" gutterBottom>
                          Unassigned Leads Matching Criteria:
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: "block", mb: 1 }}
                        >
                          These are leads not assigned to any agent, filtered by
                          your selected country, client network, and client
                          brokers
                        </Typography>
                        {unassignedLeadsStats.ftd && watch("ftd") > 0 && (
                          <Typography variant="body2" color="text.secondary">
                            FTD:{" "}
                            <strong>
                              {unassignedLeadsStats.ftd.available}
                            </strong>{" "}
                            matching available,{" "}
                            {unassignedLeadsStats.ftd.onCooldown} matching on
                            cooldown
                          </Typography>
                        )}
                        {unassignedLeadsStats.filler && watch("filler") > 0 && (
                          <Typography variant="body2" color="text.secondary">
                            Filler:{" "}
                            <strong>
                              {unassignedLeadsStats.filler.available}
                            </strong>{" "}
                            matching available,{" "}
                            {unassignedLeadsStats.filler.onCooldown} matching on
                            cooldown
                          </Typography>
                        )}
                      </Box>
                    )}
                  </Grid>
                )}

              {/* Individual FTD Agent Assignments - Shows after filtered agents are loaded (Normal mode only) */}
              {!manualSelectionMode &&
                watch("ftd") > 0 &&
                (filteredAgents.length > 0 ||
                  unassignedLeadsStats.ftd !== null) && (
                  <Grid item xs={12}>
                    <Typography
                      variant="subtitle2"
                      color="primary"
                      sx={{ mb: 1, fontWeight: 600 }}
                    >
                      Assign FTD Leads to Agents
                    </Typography>
                    <Grid container spacing={2}>
                      {Array.from({ length: watch("ftd") }, (_, index) => (
                        <Grid
                          item
                          xs={12}
                          sm={6}
                          md={4}
                          key={`ftd-agent-${index}`}
                        >
                          <Controller
                            name={`ftdAgents.${index}`}
                            control={control}
                            render={({ field }) => (
                              <FormControl fullWidth size="small">
                                <InputLabel>FTD #{index + 1} Agent</InputLabel>
                                <Select
                                  {...field}
                                  label={`FTD #${index + 1} Agent`}
                                  value={field.value || ""}
                                  disabled={filteredAgentsLoading}
                                >
                                  <MenuItem value="">
                                    <em>
                                      Unassigned lead{" "}
                                      {unassignedLeadsStats.ftd
                                        ? `(${unassignedLeadsStats.ftd.available} matching available)`
                                        : ""}
                                    </em>
                                  </MenuItem>
                                  {filteredAgents.map((agent) => (
                                    <MenuItem
                                      key={agent._id}
                                      value={agent._id}
                                      disabled={
                                        agent.filteredLeadStats?.available === 0
                                      }
                                    >
                                      {agent.fullName || agent.email} —{" "}
                                      {agent.filteredLeadStats?.available || 0}{" "}
                                      matching available,{" "}
                                      {agent.filteredLeadStats?.onCooldown || 0}{" "}
                                      matching on cooldown
                                    </MenuItem>
                                  ))}
                                </Select>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ mt: 0.5, display: "block" }}
                                >
                                  Stats show only leads matching your selected
                                  criteria
                                </Typography>
                              </FormControl>
                            )}
                          />
                        </Grid>
                      ))}
                    </Grid>
                  </Grid>
                )}

              {/* Individual Filler Agent Assignments - Shows after filtered agents are loaded (Normal mode only) */}
              {!manualSelectionMode &&
                watch("filler") > 0 &&
                (filteredAgents.length > 0 ||
                  unassignedLeadsStats.filler !== null) && (
                  <Grid item xs={12}>
                    <Typography
                      variant="subtitle2"
                      color="secondary"
                      sx={{ mb: 1, fontWeight: 600 }}
                    >
                      Assign Filler Leads to Agents
                    </Typography>
                    <Grid container spacing={2}>
                      {Array.from({ length: watch("filler") }, (_, index) => (
                        <Grid
                          item
                          xs={12}
                          sm={6}
                          md={4}
                          key={`filler-agent-${index}`}
                        >
                          <Controller
                            name={`fillerAgents.${index}`}
                            control={control}
                            render={({ field }) => (
                              <FormControl fullWidth size="small">
                                <InputLabel>
                                  Filler #{index + 1} Agent
                                </InputLabel>
                                <Select
                                  {...field}
                                  label={`Filler #${index + 1} Agent`}
                                  value={field.value || ""}
                                  disabled={filteredAgentsLoading}
                                >
                                  <MenuItem value="">
                                    <em>
                                      Unassigned lead{" "}
                                      {unassignedLeadsStats.filler
                                        ? `(${unassignedLeadsStats.filler.available} matching available)`
                                        : ""}
                                    </em>
                                  </MenuItem>
                                  {filteredAgents.map((agent) => (
                                    <MenuItem
                                      key={agent._id}
                                      value={agent._id}
                                      disabled={
                                        agent.filteredLeadStats?.available === 0
                                      }
                                    >
                                      {agent.fullName || agent.email} —{" "}
                                      {agent.filteredLeadStats?.available || 0}{" "}
                                      matching available,{" "}
                                      {agent.filteredLeadStats?.onCooldown || 0}{" "}
                                      matching on cooldown
                                    </MenuItem>
                                  ))}
                                </Select>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ mt: 0.5, display: "block" }}
                                >
                                  Stats show only leads matching your selected
                                  criteria
                                </Typography>
                              </FormControl>
                            )}
                          />
                        </Grid>
                      ))}
                    </Grid>
                  </Grid>
                )}

              {/* Show message if FTD/Filler requested but criteria not complete (Normal mode only) */}
              {!manualSelectionMode &&
                (watch("ftd") > 0 || watch("filler") > 0) &&
                (!watch("countryFilter") ||
                  !watch("selectedClientNetwork")) && (
                  <Grid item xs={12}>
                    <Alert severity="info" sx={{ mt: 1 }}>
                      Please select country and client network to load agents
                      with matching leads for assignment.
                    </Alert>
                  </Grid>
                )}

              {/* Notes Section */}
              <Grid item xs={12}>
                <Controller
                  name="notes"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Notes (optional)"
                      multiline
                      rows={2}
                      error={!!errors.notes}
                      helperText={errors.notes?.message}
                      size="small"
                      placeholder="Add any additional notes for this order..."
                    />
                  )}
                />
              </Grid>
            </Grid>
            {errors[""] && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {errors[""]?.message}
              </Alert>
            )}
          </DialogContent>
          <DialogActions
            sx={{
              px: 3,
              py: 2,
              borderTop: "1px solid",
              borderColor: "divider",
              bgcolor: (theme) => alpha(theme.palette.grey[500], 0.02),
            }}
          >
            <Button
              onClick={() => {
                setCreateDialogOpen(false);
                setFilteredAgents([]);
                setUnassignedLeadsStats({ ftd: null, filler: null });
                setManualSelectionMode(false);
                setManualLeadEmails("");
                setManualLeads([]);
              }}
              sx={{ px: 3 }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isSubmitting}
              sx={{
                px: 4,
                fontWeight: 600,
              }}
            >
              {isSubmitting ? (
                <CircularProgress size={22} color="inherit" />
              ) : (
                "Create Order"
              )}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Create New Broker Dialog */}
      <Dialog
        open={createBrokerDialog.open}
        onClose={handleCloseCreateBrokerDialog}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown={createBrokerDialog.loading}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <AddIcon color="primary" />
            <Typography variant="h6">Create New Client Broker</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <CreateBrokerForm
            onSubmit={handleSubmitNewBroker}
            loading={createBrokerDialog.loading}
            onCancel={handleCloseCreateBrokerDialog}
          />
        </DialogContent>
      </Dialog>

      {/* Manage Brokers Dialog */}
      <Dialog
        open={manageBrokersDialog.open}
        onClose={handleCloseManageBrokersDialog}
        maxWidth="xl"
        fullWidth
      >
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignments="center"
          >
            <Box display="flex" alignItems="center" gap={1}>
              <BusinessIcon color="primary" />
              <Typography variant="h6">
                {user?.role === "admin"
                  ? "Manage Client Brokers"
                  : "View Client Brokers"}
              </Typography>
            </Box>
            {user?.role === "admin" && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleCreateNewBroker}
                size="small"
              >
                Create New
              </Button>
            )}
          </Box>
        </DialogTitle>
        <DialogContent>
          <BrokerManagementTable
            brokers={clientBrokers}
            loading={loadingClientBrokers}
            onRefresh={fetchClientBrokers}
            onDelete={handleDeleteBroker}
            onEdit={handleEditBroker}
            userRole={user?.role}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseManageBrokersDialog}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Broker Confirmation Dialog */}
      <Dialog
        open={deleteBrokerDialog.open}
        onClose={handleCloseDeleteBrokerDialog}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown={deleteBrokerDialog.loading}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <DeleteIcon color="error" />
            <Typography variant="h6">Delete Client Broker</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {deleteBrokerDialog.broker && (
            <>
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>Warning:</strong> This action cannot be undone. All
                  data associated with this broker will be permanently deleted.
                </Typography>
              </Alert>
              <Typography variant="body1" sx={{ mb: 2 }}>
                Are you sure you want to delete the client broker:
              </Typography>
              <Box sx={{ p: 2, bgcolor: "grey.100", borderRadius: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                  {deleteBrokerDialog.broker.name}
                </Typography>
                {deleteBrokerDialog.broker.domain && (
                  <Typography variant="body2" color="text.secondary">
                    Domain: {deleteBrokerDialog.broker.domain}
                  </Typography>
                )}
                <Typography variant="body2" color="text.secondary">
                  Created:{" "}
                  {new Date(
                    deleteBrokerDialog.broker.createdAt
                  ).toLocaleDateString()}
                </Typography>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleCloseDeleteBrokerDialog}
            disabled={deleteBrokerDialog.loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDeleteBroker}
            variant="contained"
            color="error"
            startIcon={
              deleteBrokerDialog.loading ? (
                <CircularProgress size={16} />
              ) : (
                <DeleteIcon />
              )
            }
            disabled={deleteBrokerDialog.loading}
          >
            {deleteBrokerDialog.loading ? "Deleting..." : "Delete Broker"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Broker Dialog */}
      <Dialog
        open={editBrokerDialog.open}
        onClose={handleCloseEditBrokerDialog}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown={editBrokerDialog.loading}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <EditIcon color="primary" />
            <Typography variant="h6">Edit Client Broker</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <EditBrokerForm
            broker={editBrokerDialog.broker}
            onSubmit={handleSubmitEditBroker}
            loading={editBrokerDialog.loading}
            onCancel={handleCloseEditBrokerDialog}
          />
        </DialogContent>
      </Dialog>

      {/* Refunds Manager Assignment Modal */}
      <AssignToRefundsManagerModal
        open={refundsAssignmentDialog.open}
        onClose={handleCloseRefundsAssignment}
        orderId={refundsAssignmentDialog.orderId}
        onSuccess={handleRefundsAssignmentSuccess}
      />

      {/* Mark Shaved Dialog */}
      <MarkShavedDialog
        open={markShavedDialog.open}
        lead={markShavedDialog.lead}
        userRole={user?.role}
        onClose={handleCloseMarkShavedDialog}
        onConfirm={handleConfirmMarkAsShaved}
        loading={markShavedDialog.loading}
      />

      {/* Client Broker Management Dialog */}
      <ClientBrokerManagementDialog
        open={clientBrokerManagementOpen}
        onClose={handleCloseClientBrokerManagement}
        order={selectedOrderForManagement}
        onUpdate={handleClientBrokerManagementUpdate}
      />

      {/* Change FTD Dialog */}
      <ChangeFTDDialog
        open={changeFTDDialog.open}
        onClose={handleCloseChangeFTDDialog}
        order={changeFTDDialog.order}
        lead={changeFTDDialog.lead}
        onSuccess={handleChangeFTDSuccess}
      />

      {/* Assign Lead to Agent Dialog */}
      <AssignLeadToAgentDialog
        open={assignLeadDialog.open}
        onClose={handleCloseAssignLeadDialog}
        lead={assignLeadDialog.lead}
        onSuccess={handleAssignLeadSuccess}
      />

      {/* Replace Lead Dialog */}
      <ReplaceLeadDialog
        open={replaceLeadDialog.open}
        onClose={handleCloseReplaceLeadDialog}
        order={replaceLeadDialog.order}
        lead={replaceLeadDialog.lead}
        onSuccess={handleReplaceLeadSuccess}
      />


      {/* Remote Browser Dialog */}
      <RemoteBrowserDialog
        open={browserDialog.open}
        onClose={() => setBrowserDialog({ open: false, lead: null })}
        lead={browserDialog.lead}
      />

      {/* Apply Agent Fine Dialog */}
      <ApplyAgentFineDialog
        open={applyFineDialog.open}
        onClose={handleCloseApplyFineDialog}
        onSuccess={handleApplyFineSuccess}
        agent={applyFineDialog.agent}
        lead={applyFineDialog.lead}
        orderId={applyFineDialog.orderId}
      />

      {/* PSP Deposit Confirmation Dialog - 2 Step (Card Issuer -> PSP) */}
      <Dialog
        open={pspDepositDialog.open}
        onClose={handleClosePspDepositDialog}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown={pspDepositDialog.loading || pspDepositDialog.creatingIssuer || pspDepositDialog.creatingPsp}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <CallIcon color="success" />
            <Typography variant="h6">
              Confirm Deposit - Step {pspDepositDialog.step} of 2
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {pspDepositDialog.lead && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Confirming deposit for:
              </Typography>
              <Typography variant="subtitle1" fontWeight="bold">
                {pspDepositDialog.lead.firstName} {pspDepositDialog.lead.lastName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {pspDepositDialog.lead.newEmail || pspDepositDialog.lead.email}
              </Typography>
            </Box>
          )}

          {/* Step 1: Select Card Issuer */}
          {pspDepositDialog.step === 1 && (
            <Box>
              <Typography variant="subtitle2" gutterBottom sx={{ mb: 1 }}>
                Select Card Issuer or Create New
              </Typography>
              <Autocomplete
                options={pspDepositDialog.cardIssuers}
                getOptionLabel={(option) => option.name}
                value={pspDepositDialog.selectedCardIssuer}
                onChange={(_, newValue) => {
                  setPspDepositDialog((prev) => ({
                    ...prev,
                    selectedCardIssuer: newValue,
                    newCardIssuerName: "",
                  }));
                }}
                loading={pspDepositDialog.loading && pspDepositDialog.cardIssuers.length === 0}
                disabled={pspDepositDialog.newCardIssuerName.length > 0}
                renderOption={(props, option) => (
                  <li {...props}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <CreditCardIcon fontSize="small" color="primary" />
                      <span>{option.name}</span>
                    </Box>
                  </li>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Select Existing Card Issuer"
                    placeholder="Search Card Issuers..."
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {pspDepositDialog.loading && pspDepositDialog.cardIssuers.length === 0 && (
                            <CircularProgress size={20} />
                          )}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
              <Typography variant="body2" sx={{ my: 2, textAlign: "center", color: "text.secondary" }}>
                - OR -
              </Typography>
              <TextField
                fullWidth
                label="Create New Card Issuer"
                placeholder="e.g., Visa, Mastercard, Zen"
                value={pspDepositDialog.newCardIssuerName}
                onChange={(e) => {
                  setPspDepositDialog((prev) => ({
                    ...prev,
                    newCardIssuerName: e.target.value,
                    selectedCardIssuer: null,
                  }));
                }}
                disabled={pspDepositDialog.selectedCardIssuer !== null}
              />
            </Box>
          )}

          {/* Step 2: Select PSP */}
          {pspDepositDialog.step === 2 && (
            <Box>
              <Box sx={{ mb: 2, p: 1.5, bgcolor: "grey.100", borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Card Issuer:
                </Typography>
                <Typography variant="subtitle1" fontWeight="bold">
                  {pspDepositDialog.selectedCardIssuer?.name}
                </Typography>
              </Box>
              <Typography variant="subtitle2" gutterBottom sx={{ mb: 1 }}>
                Select PSP or Create New
              </Typography>
              <Autocomplete
                options={pspDepositDialog.psps}
                getOptionLabel={(option) => option.name}
                value={pspDepositDialog.selectedPsp}
                onChange={(_, newValue) =>
                  setPspDepositDialog((prev) => ({
                    ...prev,
                    selectedPsp: newValue,
                    newPspWebsite: "",
                  }))
                }
                loading={pspDepositDialog.loading}
                disabled={pspDepositDialog.newPspWebsite.length > 0}
                renderOption={(props, option) => (
                  <li {...props}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <CreditCardIcon fontSize="small" color="primary" />
                      <span>{option.name}</span>
                      {option.cardIssuer?.name && (
                        <Chip label={option.cardIssuer.name} size="small" variant="outlined" sx={{ ml: 1 }} />
                      )}
                    </Box>
                  </li>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Select Existing PSP"
                    placeholder="Search PSPs..."
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {pspDepositDialog.loading && (
                            <CircularProgress size={20} />
                          )}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
              <Typography variant="body2" sx={{ my: 2, textAlign: "center", color: "text.secondary" }}>
                - OR -
              </Typography>
              <TextField
                fullWidth
                label="Create New PSP"
                placeholder="e.g., https://example.com"
                value={pspDepositDialog.newPspWebsite}
                onChange={(e) => {
                  setPspDepositDialog((prev) => ({
                    ...prev,
                    newPspWebsite: e.target.value,
                    selectedPsp: null,
                  }));
                }}
                disabled={pspDepositDialog.selectedPsp !== null}
              />
              {pspDepositDialog.selectedPsp && (
                <Box sx={{ mt: 2, p: 2, bgcolor: "success.50", borderRadius: 1, border: "1px solid", borderColor: "success.200" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <CreditCardIcon color="success" />
                    <Typography variant="subtitle1" fontWeight="bold" color="success.main">
                      {pspDepositDialog.selectedPsp.name}
                    </Typography>
                    <Chip
                      label="Active"
                      color="success"
                      size="small"
                      sx={{ ml: "auto" }}
                    />
                  </Box>
                  {pspDepositDialog.selectedPsp.website && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {pspDepositDialog.selectedPsp.website}
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {pspDepositDialog.step === 2 && (
            <Button
              onClick={() =>
                setPspDepositDialog((prev) => ({
                  ...prev,
                  step: 1,
                  selectedPsp: null,
                  newPspWebsite: "",
                }))
              }
              disabled={pspDepositDialog.loading || pspDepositDialog.creatingPsp}
            >
              Back
            </Button>
          )}
          <Button
            onClick={handleClosePspDepositDialog}
            disabled={pspDepositDialog.loading || pspDepositDialog.creatingIssuer || pspDepositDialog.creatingPsp}
          >
            Cancel
          </Button>
          {pspDepositDialog.step === 1 ? (
            <Button
              onClick={handleCardIssuerSelect}
              variant="contained"
              disabled={
                (!pspDepositDialog.selectedCardIssuer && !pspDepositDialog.newCardIssuerName.trim()) ||
                pspDepositDialog.loading ||
                pspDepositDialog.creatingIssuer
              }
              startIcon={pspDepositDialog.creatingIssuer ? <CircularProgress size={16} /> : null}
            >
              {pspDepositDialog.creatingIssuer ? "Creating..." : "Next"}
            </Button>
          ) : (
            <Button
              onClick={handlePspDepositConfirm}
              variant="contained"
              color="success"
              disabled={
                (!pspDepositDialog.selectedPsp && !pspDepositDialog.newPspWebsite.trim()) ||
                pspDepositDialog.loading ||
                pspDepositDialog.creatingPsp
              }
              startIcon={
                pspDepositDialog.loading || pspDepositDialog.creatingPsp
                  ? <CircularProgress size={16} />
                  : <CallIcon />
              }
            >
              {pspDepositDialog.creatingPsp
                ? "Creating PSP..."
                : pspDepositDialog.loading
                  ? "Confirming..."
                  : "Confirm Deposit"}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Gender Fallback Modal */}
      <GenderFallbackModal
        open={genderFallbackModalOpen}
        onClose={() => setGenderFallbackModalOpen(false)}
        agentAssignmentInsufficient={insufficientAgentLeads}
        orderData={pendingOrderData}
        onConfirm={handleGenderFallbackSelect}
      />

      {/* Change Requester Dialog */}
      <ChangeRequesterDialog
        open={changeRequesterOpen}
        onClose={() => setChangeRequesterOpen(false)}
        onSubmit={handleSubmitChangeRequester}
        requesters={potentialRequesters}
        loading={loadingRequesters}
        selectedRequester={selectedNewRequester}
        onSelectRequester={setSelectedNewRequester}
      />

      {/* Edit Planned Date Dialog */}
      <Dialog
        open={editPlannedDateDialog.open}
        onClose={handleCloseEditPlannedDate}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <EditIcon color="primary" />
            <Typography variant="h6">Edit Planned Date</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <TextField
            label="Planned Date"
            type="date"
            value={newPlannedDate}
            onChange={(e) => setNewPlannedDate(e.target.value)}
            fullWidth
            size="small"
            InputLabelProps={{ shrink: true }}
            inputProps={{
              min: new Date().toISOString().split("T")[0],
            }}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleCloseEditPlannedDate}
            disabled={editPlannedDateDialog.loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmitEditPlannedDate}
            variant="contained"
            disabled={!newPlannedDate || editPlannedDateDialog.loading}
          >
            {editPlannedDateDialog.loading ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Network Configuration Dialog (Admin Only) */}
      <Dialog
        open={editNetworkConfigDialog.open}
        onClose={handleCloseEditNetworkConfig}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <EditIcon color="primary" />
            <Typography variant="h6">
              Edit{" "}
              {editNetworkConfigDialog.field === "campaign"
                ? "Campaign"
                : editNetworkConfigDialog.field === "ourNetwork"
                ? "Our Network"
                : "Client Network"}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2, mt: 1 }}>
            Changing this will update all leads in the order with the new{" "}
            {editNetworkConfigDialog.field === "campaign"
              ? "campaign"
              : editNetworkConfigDialog.field === "ourNetwork"
              ? "our network"
              : "client network"}
            .
          </Alert>
          {editNetworkConfigDialog.field === "campaign" && (
            <Autocomplete
              value={
                campaigns.find((c) => c._id === newNetworkValue) || null
              }
              onChange={(_, newValue) =>
                setNewNetworkValue(newValue?._id || "")
              }
              options={campaigns}
              getOptionLabel={(option) => option.name || ""}
              isOptionEqualToValue={(option, value) =>
                option._id === value?._id
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Campaign"
                  size="small"
                  fullWidth
                  helperText={`${campaigns.length} campaigns available`}
                />
              )}
              sx={{ mt: 1 }}
            />
          )}
          {editNetworkConfigDialog.field === "ourNetwork" && (
            <Autocomplete
              value={
                ourNetworks.find((n) => n._id === newNetworkValue) || null
              }
              onChange={(_, newValue) =>
                setNewNetworkValue(newValue?._id || "")
              }
              options={ourNetworks}
              getOptionLabel={(option) => option.name || ""}
              isOptionEqualToValue={(option, value) =>
                option._id === value?._id
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Our Network"
                  size="small"
                  fullWidth
                  helperText={`${ourNetworks.length} networks available`}
                />
              )}
              sx={{ mt: 1 }}
            />
          )}
          {editNetworkConfigDialog.field === "clientNetwork" && (
            <Autocomplete
              value={
                clientNetworks.find((n) => n._id === newNetworkValue) || null
              }
              onChange={(_, newValue) =>
                setNewNetworkValue(newValue?._id || "")
              }
              options={clientNetworks}
              getOptionLabel={(option) => option.name || ""}
              isOptionEqualToValue={(option, value) =>
                option._id === value?._id
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Client Network"
                  size="small"
                  fullWidth
                  helperText={`${clientNetworks.length} networks available`}
                />
              )}
              sx={{ mt: 1 }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleCloseEditNetworkConfig}
            disabled={editNetworkConfigDialog.loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmitEditNetworkConfig}
            variant="contained"
            disabled={
              (editNetworkConfigDialog.field === "campaign" && !newNetworkValue) ||
              editNetworkConfigDialog.loading
            }
          >
            {editNetworkConfigDialog.loading ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Requester History Dialog */}
      <RequesterHistoryDialog
        open={requesterHistoryOpen}
        onClose={() => setRequesterHistoryOpen(false)}
        order={selectedOrderForRequester}
      />

      {/* Copy Notification */}
      <Snackbar
        open={copyNotification.open}
        autoHideDuration={2000}
        onClose={handleCloseCopyNotification}
        message={copyNotification.message}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />

      {/* Undo Action Snackbar */}
      <Snackbar
        open={!!undoAction}
        autoHideDuration={30000}
        onClose={handleDismissUndo}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Alert
          severity="info"
          sx={{
            width: "100%",
            alignItems: "center",
          }}
          action={
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                color="inherit"
                size="small"
                onClick={handleUndoAction}
                disabled={undoing}
                startIcon={undoing ? <CircularProgress size={16} color="inherit" /> : <UndoIcon />}
              >
                {undoing ? "Undoing..." : "Undo"}
              </Button>
              <IconButton
                size="small"
                color="inherit"
                onClick={handleDismissUndo}
                disabled={undoing}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          }
        >
          {undoAction?.type === "removal"
            ? `Removed ${undoAction.removedLeads?.length || 0} lead(s) from order`
            : undoAction?.type === "replacement"
            ? `Replaced ${undoAction.oldLeadName} with ${undoAction.newLeadName}`
            : "Action completed"}
        </Alert>
      </Snackbar>

      {/* Lead Removal Reason Dialog */}
      <Dialog
        open={removalReasonDialog.open}
        onClose={handleCloseRemovalReasonDialog}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown={removingLeads}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <DeleteIcon color="error" />
            <Typography variant="h6">Remove Leads from Order</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            You are about to remove <strong>{selectedLeadsForRemoval.length} lead(s)</strong> from this order.
            Please select a reason for this action.
          </Typography>
          <FormControl fullWidth required sx={{ mb: 2 }}>
            <InputLabel id="removal-reason-label">Reason for removal *</InputLabel>
            <Select
              labelId="removal-reason-label"
              value={removalReasonDialog.reason}
              label="Reason for removal *"
              onChange={(e) => {
                setRemovalReasonDialog((prev) => ({
                  ...prev,
                  reason: e.target.value,
                  customReason: e.target.value !== "Other" ? "" : prev.customReason,
                }));
              }}
            >
              <MenuItem value="Lead is not sent">Lead is not sent</MenuItem>
              <MenuItem value="Email not working">Email not working</MenuItem>
              <MenuItem value="Phone not working">Phone not working</MenuItem>
              <MenuItem value="One or more leads from this order were already shaved">One or more leads from this order were already shaved</MenuItem>
              <MenuItem value="Lead failed">Lead failed</MenuItem>
              <MenuItem value="Agent is missing">Agent is missing</MenuItem>
              <MenuItem value="Other">Other</MenuItem>
            </Select>
          </FormControl>
          {removalReasonDialog.reason === "Other" && (
            <TextField
              fullWidth
              required
              label="Please specify the reason *"
              value={removalReasonDialog.customReason}
              onChange={(e) => setRemovalReasonDialog((prev) => ({ ...prev, customReason: e.target.value }))}
              multiline
              rows={2}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseRemovalReasonDialog} disabled={removingLeads}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              const finalReason = removalReasonDialog.reason === "Other"
                ? removalReasonDialog.customReason
                : removalReasonDialog.reason;
              handleRemoveSelectedLeads(finalReason);
            }}
            disabled={
              removingLeads ||
              !removalReasonDialog.reason ||
              (removalReasonDialog.reason === "Other" && !removalReasonDialog.customReason.trim())
            }
            startIcon={removingLeads ? <CircularProgress size={20} color="inherit" /> : <DeleteIcon />}
          >
            {removingLeads ? "Removing..." : "Confirm Removal"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create New Broker Dialog */}
      <Dialog
        open={createBrokerDialog.open}
        onClose={handleCloseCreateBrokerDialog}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown={createBrokerDialog.loading}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <AddIcon color="primary" />
            <Typography variant="h6">Create New Client Broker</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <CreateBrokerForm
            onSubmit={handleSubmitNewBroker}
            loading={createBrokerDialog.loading}
            onCancel={handleCloseCreateBrokerDialog}
          />
        </DialogContent>
      </Dialog>

      {/* Manage Brokers Dialog */}
      <Dialog
        open={manageBrokersDialog.open}
        onClose={handleCloseManageBrokersDialog}
        maxWidth="xl"
        fullWidth
      >
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Box display="flex" alignItems="center" gap={1}>
              <BusinessIcon color="primary" />
              <Typography variant="h6">
                {user?.role === "admin"
                  ? "Manage Client Brokers"
                  : "View Client Brokers"}
              </Typography>
            </Box>
            {user?.role === "admin" && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleCreateNewBroker}
                size="small"
              >
                Create New
              </Button>
            )}
          </Box>
        </DialogTitle>
        <DialogContent>
          <BrokerManagementTable
            brokers={clientBrokers}
            loading={loadingClientBrokers}
            onRefresh={fetchClientBrokers}
            onDelete={handleDeleteBroker}
            onEdit={handleEditBroker}
            userRole={user?.role}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseManageBrokersDialog}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Broker Confirmation Dialog */}
      <Dialog
        open={deleteBrokerDialog.open}
        onClose={handleCloseDeleteBrokerDialog}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown={deleteBrokerDialog.loading}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <DeleteIcon color="error" />
            <Typography variant="h6">Delete Client Broker</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {deleteBrokerDialog.broker && (
            <>
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>Warning:</strong> This action cannot be undone. All
                  data associated with this broker will be permanently deleted.
                </Typography>
              </Alert>
              <Typography variant="body1" sx={{ mb: 2 }}>
                Are you sure you want to delete the client broker:
              </Typography>
              <Box sx={{ p: 2, bgcolor: "grey.100", borderRadius: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                  {deleteBrokerDialog.broker.name}
                </Typography>
                {deleteBrokerDialog.broker.domain && (
                  <Typography variant="body2" color="text.secondary">
                    Domain: {deleteBrokerDialog.broker.domain}
                  </Typography>
                )}
                <Typography variant="body2" color="text.secondary">
                  Created:{" "}
                  {new Date(
                    deleteBrokerDialog.broker.createdAt
                  ).toLocaleDateString()}
                </Typography>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleCloseDeleteBrokerDialog}
            disabled={deleteBrokerDialog.loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDeleteBroker}
            variant="contained"
            color="error"
            startIcon={
              deleteBrokerDialog.loading ? (
                <CircularProgress size={16} />
              ) : (
                <DeleteIcon />
              )
            }
            disabled={deleteBrokerDialog.loading}
          >
            {deleteBrokerDialog.loading ? "Deleting..." : "Delete Broker"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Broker Dialog */}
      <Dialog
        open={editBrokerDialog.open}
        onClose={handleCloseEditBrokerDialog}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown={editBrokerDialog.loading}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <EditIcon color="primary" />
            <Typography variant="h6">Edit Client Broker</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <EditBrokerForm
            broker={editBrokerDialog.broker}
            onSubmit={handleSubmitEditBroker}
            loading={editBrokerDialog.loading}
            onCancel={handleCloseEditBrokerDialog}
          />
        </DialogContent>
      </Dialog>

      {/* Refunds Manager Assignment Modal */}
      <AssignToRefundsManagerModal
        open={refundsAssignmentDialog.open}
        onClose={handleCloseRefundsAssignment}
        orderId={refundsAssignmentDialog.orderId}
        onSuccess={handleRefundsAssignmentSuccess}
      />

      {/* Mark Shaved Dialog */}
      <MarkShavedDialog
        open={markShavedDialog.open}
        lead={markShavedDialog.lead}
        userRole={user?.role}
        onClose={handleCloseMarkShavedDialog}
        onConfirm={handleConfirmMarkAsShaved}
        loading={markShavedDialog.loading}
      />

      {/* Client Broker Management Dialog */}
      <ClientBrokerManagementDialog
        open={clientBrokerManagementOpen}
        onClose={handleCloseClientBrokerManagement}
        order={selectedOrderForManagement}
        onUpdate={handleClientBrokerManagementUpdate}
      />

      {/* Change FTD Dialog */}
      <ChangeFTDDialog
        open={changeFTDDialog.open}
        onClose={handleCloseChangeFTDDialog}
        order={changeFTDDialog.order}
        lead={changeFTDDialog.lead}
        onSuccess={handleChangeFTDSuccess}
      />

      {/* Assign Lead to Agent Dialog */}
      <AssignLeadToAgentDialog
        open={assignLeadDialog.open}
        onClose={handleCloseAssignLeadDialog}
        lead={assignLeadDialog.lead}
        onSuccess={handleAssignLeadSuccess}
      />

      {/* Add Leads to Order Dialog (Admin only) */}
      <Dialog
        open={addLeadsDialog.open}
        onClose={handleCloseAddLeadsDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Typography variant="h6">
              Add Leads to Order {addLeadsDialog.order?._id?.slice(-8)}
            </Typography>
            <IconButton
              aria-label="close"
              onClick={handleCloseAddLeadsDialog}
              size="small"
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Enter email addresses of leads to add (one per line or separated by
              commas/spaces)
            </Typography>
            <TextField
              multiline
              rows={4}
              fullWidth
              placeholder="lead1@example.com&#10;lead2@example.com"
              value={addLeadsEmails}
              onChange={(e) => setAddLeadsEmails(e.target.value)}
              disabled={addLeadsDialog.loading}
            />
            <Button
              variant="contained"
              sx={{ mt: 1 }}
              onClick={searchLeadsForAddToOrder}
              disabled={addLeadsSearching || !addLeadsEmails.trim()}
              startIcon={
                addLeadsSearching ? (
                  <CircularProgress size={16} />
                ) : (
                  <SearchIcon />
                )
              }
            >
              {addLeadsSearching ? "Searching..." : "Search Leads"}
            </Button>
          </Box>

          {addLeadsFound.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Found Leads ({addLeadsFound.length})
                {addLeadsFound.filter((e) => e.canAdd).length <
                  addLeadsFound.length && (
                  <Typography
                    component="span"
                    variant="caption"
                    color="text.secondary"
                    sx={{ ml: 1 }}
                  >
                    ({addLeadsFound.filter((e) => e.canAdd).length} can be added)
                  </Typography>
                )}
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Status</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Country</TableCell>
                      <TableCell>Lead Type</TableCell>
                      <TableCell>Agent</TableCell>
                      <TableCell width={50}>Remove</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {addLeadsFound.map((entry, index) => (
                      <TableRow
                        key={entry.lead._id}
                        sx={{
                          bgcolor: !entry.canAdd
                            ? entry.isInOrder || entry.isWrongCountry
                              ? "error.lighter"
                              : "warning.lighter"
                            : "inherit",
                          opacity: !entry.canAdd ? 0.7 : 1,
                        }}
                      >
                        <TableCell>
                          {entry.isInOrder ? (
                            <Tooltip title="This lead is already in this order">
                              <Chip
                                label="In Order"
                                size="small"
                                color="error"
                                sx={{ fontSize: "0.7rem" }}
                              />
                            </Tooltip>
                          ) : entry.isWrongCountry ? (
                            <Tooltip
                              title={`This lead is from ${entry.lead.country}, but order requires ${addLeadsDialog.order?.countryFilter}`}
                            >
                              <Chip
                                label="Wrong Country"
                                size="small"
                                color="error"
                                sx={{ fontSize: "0.7rem" }}
                              />
                            </Tooltip>
                          ) : entry.isOnCooldown ? (
                            <Tooltip
                              title={`This lead is on cooldown. ${entry.cooldownDaysRemaining} days remaining.`}
                            >
                              <Chip
                                label={`Cooldown (${entry.cooldownDaysRemaining}d)`}
                                size="small"
                                color="warning"
                                sx={{ fontSize: "0.7rem" }}
                              />
                            </Tooltip>
                          ) : (
                            <Chip
                              label="Ready"
                              size="small"
                              color="success"
                              sx={{ fontSize: "0.7rem" }}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          {entry.lead.firstName} {entry.lead.lastName}
                        </TableCell>
                        <TableCell>{entry.lead.newEmail}</TableCell>
                        <TableCell>{entry.lead.country}</TableCell>
                        <TableCell>
                          <FormControl size="small" sx={{ minWidth: 100 }}>
                            <Select
                              value={entry.leadType}
                              onChange={(e) =>
                                updateAddLeadType(index, e.target.value)
                              }
                              disabled={addLeadsDialog.loading || !entry.canAdd}
                            >
                              <MenuItem value="ftd">FTD</MenuItem>
                              <MenuItem value="filler">Filler</MenuItem>
                              <MenuItem value="cold">Cold</MenuItem>
                            </Select>
                          </FormControl>
                        </TableCell>
                        <TableCell>
                          <FormControl size="small" sx={{ minWidth: 150 }}>
                            <Select
                              value={entry.agent || ""}
                              onChange={(e) =>
                                updateAddLeadAgent(index, e.target.value)
                              }
                              displayEmpty
                              disabled={addLeadsDialog.loading || !entry.canAdd}
                            >
                              <MenuItem value="">
                                <em>No Agent</em>
                              </MenuItem>
                              {allAgents.map((agent) => (
                                <MenuItem key={agent._id} value={agent._id}>
                                  {agent.fullName}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => removeAddLead(index)}
                            disabled={addLeadsDialog.loading}
                            color="error"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAddLeadsDialog} disabled={addLeadsDialog.loading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmitAddLeads}
            disabled={
              addLeadsDialog.loading ||
              addLeadsFound.filter((e) => e.canAdd).length === 0
            }
            startIcon={<AddIcon />}
          >
            {`Add ${addLeadsFound.filter((e) => e.canAdd).length} Lead(s)`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Leads Confirmation Dialog (Reason Selection) */}
      <Dialog
        open={addLeadsConfirmDialog.open}
        onClose={handleCloseAddLeadsConfirmDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm Adding Leads</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            You are about to add{" "}
            <strong>{addLeadsFound.filter((e) => e.canAdd).length} lead(s)</strong>{" "}
            to the order. Please select a reason for this action.
          </Typography>
          <FormControl fullWidth required error={!addLeadsConfirmDialog.reason}>
            <InputLabel id="add-leads-confirm-reason-label">
              Reason for adding leads *
            </InputLabel>
            <Select
              labelId="add-leads-confirm-reason-label"
              value={addLeadsConfirmDialog.reason}
              label="Reason for adding leads *"
              onChange={(e) =>
                setAddLeadsConfirmDialog((prev) => ({
                  ...prev,
                  reason: e.target.value,
                  customReason:
                    e.target.value !== "Other" ? "" : prev.customReason,
                  missingAgentId:
                    e.target.value !== "Agent is missing" ? "" : prev.missingAgentId,
                }))
              }
            >
              {LEAD_CHANGE_REASONS.map((reason) => (
                <MenuItem key={reason} value={reason}>
                  {reason}
                </MenuItem>
              ))}
            </Select>
            {!addLeadsConfirmDialog.reason && (
              <FormHelperText>Please select a reason</FormHelperText>
            )}
          </FormControl>
          {addLeadsConfirmDialog.reason === "Agent is missing" && (
            <FormControl fullWidth required error={!addLeadsConfirmDialog.missingAgentId} sx={{ mt: 2 }}>
              <InputLabel id="add-leads-confirm-missing-agent-label">
                Which agent is missing? *
              </InputLabel>
              <Select
                labelId="add-leads-confirm-missing-agent-label"
                value={addLeadsConfirmDialog.missingAgentId}
                label="Which agent is missing? *"
                onChange={(e) =>
                  setAddLeadsConfirmDialog((prev) => ({
                    ...prev,
                    missingAgentId: e.target.value,
                  }))
                }
              >
                {allAgents.map((agent) => (
                  <MenuItem key={agent._id} value={agent._id}>
                    {agent.fullName}
                  </MenuItem>
                ))}
              </Select>
              {!addLeadsConfirmDialog.missingAgentId && (
                <FormHelperText>Please select an agent</FormHelperText>
              )}
            </FormControl>
          )}
          {addLeadsConfirmDialog.reason === "Other" && (
            <TextField
              fullWidth
              required
              label="Please specify the reason *"
              value={addLeadsConfirmDialog.customReason}
              onChange={(e) =>
                setAddLeadsConfirmDialog((prev) => ({
                  ...prev,
                  customReason: e.target.value,
                }))
              }
              error={!addLeadsConfirmDialog.customReason.trim()}
              helperText={
                !addLeadsConfirmDialog.customReason.trim()
                  ? "Please enter a custom reason"
                  : ""
              }
              sx={{ mt: 2 }}
              multiline
              rows={2}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleCloseAddLeadsConfirmDialog}
            disabled={addLeadsConfirmDialog.loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmAddLeads}
            color="primary"
            variant="contained"
            disabled={
              addLeadsConfirmDialog.loading ||
              !addLeadsConfirmDialog.reason ||
              (addLeadsConfirmDialog.reason === "Other" &&
                !addLeadsConfirmDialog.customReason.trim()) ||
              (addLeadsConfirmDialog.reason === "Agent is missing" &&
                !addLeadsConfirmDialog.missingAgentId)
            }
            startIcon={
              addLeadsConfirmDialog.loading ? (
                <CircularProgress size={20} />
              ) : (
                <AddIcon />
              )
            }
          >
            {addLeadsConfirmDialog.loading ? "Adding..." : "Confirm & Add"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Order Confirmation Dialog */}
      <Dialog
        open={deleteOrderDialog.open}
        onClose={handleDeleteOrderCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {deleteOrderDialog.permanentDelete
            ? "Permanently Delete Order"
            : "Cancel Order"}
        </DialogTitle>
        <DialogContent>
          {deleteOrderDialog.permanentDelete ? (
            <>
              <Alert severity="error" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>Warning:</strong> This will permanently delete the
                  order from the database!
                </Typography>
              </Alert>
              <Typography>
                Are you sure you want to permanently delete this order? This
                action will:
              </Typography>
              <Box sx={{ mt: 2, ml: 2 }}>
                <Typography variant="body2">
                  • Permanently remove the order from the database
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ mt: 1, fontWeight: "bold", color: "error.main" }}
                >
                  This action cannot be undone!
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ mt: 1, fontStyle: "italic", color: "text.secondary" }}
                >
                  Note: All cleanup (removing assignments, releasing leads,
                  etc.) was already done when the order was cancelled.
                </Typography>
              </Box>
              {deleteOrderDialog.orderStatus !== "cancelled" && (
                <Box sx={{ mt: 2 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={deleteOrderDialog.permanentDelete}
                        onChange={(e) =>
                          setDeleteOrderDialog((prev) => ({
                            ...prev,
                            permanentDelete: e.target.checked,
                          }))
                        }
                        color="error"
                      />
                    }
                    label={
                      <Typography variant="body2" color="error">
                        I understand this will permanently delete a
                        non-cancelled order
                      </Typography>
                    }
                  />
                </Box>
              )}
            </>
          ) : (
            <>
              <Typography>
                Are you sure you want to cancel this order? This action will:
              </Typography>
              <Box sx={{ mt: 2, ml: 2 }}>
                <Typography variant="body2">
                  • Mark the order as cancelled
                </Typography>
                <Typography variant="body2">
                  • Remove client network assignments
                </Typography>
                <Typography variant="body2">
                  • Remove our network assignments
                </Typography>
                <Typography variant="body2">
                  • Remove campaign assignments
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ mt: 1, fontStyle: "italic", color: "text.secondary" }}
                >
                  Note: The order will still exist in the database and can be
                  permanently deleted later.
                </Typography>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleDeleteOrderCancel}
            disabled={deleteOrderDialog.loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteOrderConfirm}
            color="error"
            variant="contained"
            disabled={deleteOrderDialog.loading}
            startIcon={
              deleteOrderDialog.loading ? (
                <CircularProgress size={20} />
              ) : (
                <DeleteIcon />
              )
            }
          >
            {deleteOrderDialog.loading
              ? deleteOrderDialog.permanentDelete
                ? "Permanently Deleting..."
                : "Cancelling..."
              : deleteOrderDialog.permanentDelete
              ? "Permanently Delete"
              : "Cancel Order"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Remove Lead from Order Dialog */}
      <Dialog
        open={removeLeadDialog.open}
        onClose={handleCloseRemoveLeadDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Remove Lead from Order</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Are you sure you want to remove{" "}
            <strong>{removeLeadDialog.leadName}</strong> from this order? The
            lead will be returned to the pool of available leads.
          </Typography>
          <FormControl fullWidth required error={!removeLeadDialog.reason}>
            <InputLabel id="remove-lead-reason-label">
              Reason for removal *
            </InputLabel>
            <Select
              labelId="remove-lead-reason-label"
              value={removeLeadDialog.reason}
              label="Reason for removal *"
              onChange={(e) =>
                setRemoveLeadDialog((prev) => ({
                  ...prev,
                  reason: e.target.value,
                  customReason:
                    e.target.value !== "Other" ? "" : prev.customReason,
                  missingAgentId:
                    e.target.value !== "Agent is missing" ? "" : prev.missingAgentId,
                }))
              }
            >
              {REMOVE_LEAD_REASONS.map((reason) => (
                <MenuItem key={reason} value={reason}>
                  {reason}
                </MenuItem>
              ))}
            </Select>
            {!removeLeadDialog.reason && (
              <FormHelperText>Please select a reason</FormHelperText>
            )}
          </FormControl>
          {removeLeadDialog.reason === "Agent is missing" && (
            <FormControl fullWidth required error={!removeLeadDialog.missingAgentId} sx={{ mt: 2 }}>
              <InputLabel id="remove-lead-missing-agent-label">
                Which agent is missing? *
              </InputLabel>
              <Select
                labelId="remove-lead-missing-agent-label"
                value={removeLeadDialog.missingAgentId}
                label="Which agent is missing? *"
                onChange={(e) =>
                  setRemoveLeadDialog((prev) => ({
                    ...prev,
                    missingAgentId: e.target.value,
                  }))
                }
              >
                {allAgents.map((agent) => (
                  <MenuItem key={agent._id} value={agent._id}>
                    {agent.fullName}
                  </MenuItem>
                ))}
              </Select>
              {!removeLeadDialog.missingAgentId && (
                <FormHelperText>Please select an agent</FormHelperText>
              )}
            </FormControl>
          )}
          {removeLeadDialog.reason === "Other" && (
            <TextField
              fullWidth
              required
              label="Please specify the reason *"
              value={removeLeadDialog.customReason}
              onChange={(e) =>
                setRemoveLeadDialog((prev) => ({
                  ...prev,
                  customReason: e.target.value,
                }))
              }
              error={!removeLeadDialog.customReason.trim()}
              helperText={
                !removeLeadDialog.customReason.trim()
                  ? "Please enter a custom reason"
                  : ""
              }
              sx={{ mt: 2 }}
              multiline
              rows={2}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleCloseRemoveLeadDialog}
            disabled={removeLeadDialog.loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmRemoveLead}
            color="error"
            variant="contained"
            disabled={
              removeLeadDialog.loading ||
              !removeLeadDialog.reason ||
              (removeLeadDialog.reason === "Other" &&
                !removeLeadDialog.customReason.trim()) ||
              (removeLeadDialog.reason === "Agent is missing" &&
                !removeLeadDialog.missingAgentId)
            }
            startIcon={
              removeLeadDialog.loading ? (
                <CircularProgress size={20} />
              ) : (
                <DeleteIcon />
              )
            }
          >
            {removeLeadDialog.loading ? "Removing..." : "Remove Lead"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Order Audit Log Dialog */}
      <Dialog
        open={orderAuditDialog.open}
        onClose={handleCloseOrderAudit}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <HistoryIcon color="primary" />
              <Typography variant="h6">
                Order Audit Log
              </Typography>
              {orderAuditDialog.order && (
                <Chip
                  label={`#${orderAuditDialog.order._id?.slice(-8)}`}
                  size="small"
                  variant="outlined"
                />
              )}
            </Box>
            <IconButton
              aria-label="close"
              onClick={handleCloseOrderAudit}
              size="small"
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {orderAuditDialog.loading ? (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                py: 4,
              }}
            >
              <CircularProgress />
            </Box>
          ) : orderAuditDialog.auditLogs.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <Typography color="text.secondary">
                No audit logs found for this order.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {orderAuditDialog.auditLogs.map((log, index) => {
                const getActionIcon = (actionType) => {
                  switch (actionType) {
                    case "lead_added":
                    case "added_to_order":
                      return <AddIcon fontSize="small" color="success" />;
                    case "lead_removed":
                    case "removed_from_order":
                      return <DeleteIcon fontSize="small" color="error" />;
                    case "ftd_swapped":
                    case "order_ftd_swapped":
                      return <SwapHorizIcon fontSize="small" color="warning" />;
                    case "lead_type_changed":
                      return <SyncAltIcon fontSize="small" color="info" />;
                    case "agent_changed":
                      return <PersonIcon fontSize="small" color="primary" />;
                    case "requester_changed":
                      return <PersonIcon fontSize="small" color="secondary" />;
                    case "client_broker_changed":
                      return <BusinessIcon fontSize="small" color="primary" />;
                    case "client_broker_removed":
                      return <BusinessIcon fontSize="small" color="error" />;
                    case "deposit_confirmed":
                      return <CheckCircleIcon fontSize="small" color="success" />;
                    case "deposit_unconfirmed":
                      return <CancelIcon fontSize="small" color="warning" />;
                    case "shaved":
                      return <WarningIcon fontSize="small" color="error" />;
                    case "unshaved":
                      return <RestoreIcon fontSize="small" color="info" />;
                    default:
                      return <HistoryIcon fontSize="small" />;
                  }
                };

                const getActionLabel = (actionType) => {
                  switch (actionType) {
                    case "lead_added":
                    case "added_to_order":
                      return "Lead Added";
                    case "lead_removed":
                    case "removed_from_order":
                      return "Lead Removed";
                    case "ftd_swapped":
                    case "order_ftd_swapped":
                      return "FTD Swapped";
                    case "lead_type_changed":
                      return "Type Changed";
                    case "agent_changed":
                      return "Agent Changed";
                    case "requester_changed":
                      return "Requester Changed";
                    case "client_broker_changed":
                      return "Broker Added";
                    case "client_broker_removed":
                      return "Broker Removed";
                    case "deposit_confirmed":
                      return "Deposit Confirmed";
                    case "deposit_unconfirmed":
                      return "Deposit Unconfirmed";
                    case "shaved":
                      return "Marked Shaved";
                    case "unshaved":
                      return "Unmarked Shaved";
                    default:
                      return actionType;
                  }
                };

                const getActionColor = (actionType) => {
                  switch (actionType) {
                    case "lead_added":
                    case "added_to_order":
                    case "deposit_confirmed":
                      return "success";
                    case "lead_removed":
                    case "removed_from_order":
                    case "shaved":
                    case "client_broker_removed":
                      return "error";
                    case "ftd_swapped":
                    case "order_ftd_swapped":
                    case "deposit_unconfirmed":
                      return "warning";
                    case "lead_type_changed":
                    case "unshaved":
                      return "info";
                    case "agent_changed":
                    case "client_broker_changed":
                      return "primary";
                    case "requester_changed":
                      return "secondary";
                    default:
                      return "default";
                  }
                };

                return (
                  <Paper
                    key={index}
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderLeft: 4,
                      borderLeftColor: `${getActionColor(log.action)}.main`,
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        mb: 1,
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        {getActionIcon(log.action)}
                        <Chip
                          label={getActionLabel(log.action)}
                          size="small"
                          color={getActionColor(log.action)}
                        />
                        {log.leadName && (
                          <Typography variant="body2" color="text.secondary">
                            - {log.leadName}
                          </Typography>
                        )}
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(log.performedAt).toLocaleString()}
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {log.details}
                    </Typography>
                    {(log.action === "lead_removed" ||
                      log.action === "removed_from_order") &&
                      log.previousValue?.removalReason && (
                        <Alert severity="info" sx={{ mb: 1, py: 0 }}>
                          <Typography variant="body2">
                            <strong>Reason:</strong>{" "}
                            {log.previousValue.removalReason}
                          </Typography>
                        </Alert>
                      )}
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 2,
                        flexWrap: "wrap",
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        By:{" "}
                        <strong>
                          {log.performedBy?.fullName ||
                            log.performedBy?.email ||
                            "Unknown"}
                        </strong>
                      </Typography>
                      {log.ipAddress && log.ipAddress !== "unknown" && (
                        <Typography variant="caption" color="text.disabled">
                          IP: {log.ipAddress}
                        </Typography>
                      )}
                      {log.leadEmail && (
                        <Typography variant="caption" color="text.secondary">
                          Email: {log.leadEmail}
                        </Typography>
                      )}
                    </Box>
                  </Paper>
                );
              })}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseOrderAudit}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Gender Fallback Modal for Agent Lead Assignment */}
      <GenderFallbackModal
        open={genderFallbackModalOpen}
        onClose={handleGenderFallbackClose}
        onSelectGender={handleGenderFallbackSelect}
        agentName={
          pendingOrderData?.agentFilter
            ? agents.find((a) => a._id === pendingOrderData.agentFilter)
                ?.fullName || "this agent"
            : "this agent"
        }
        insufficientTypes={insufficientAgentLeads || {}}
        agents={agents}
      />

      {/* Lead Quick View Popover */}
      <Popper
        open={popoverOpen}
        anchorEl={leadPopoverAnchor}
        placement="top"
        modifiers={[
          {
            name: "flip",
            enabled: true,
            options: {
              altBoundary: true,
              rootBoundary: "document",
              padding: 8,
            },
          },
          {
            name: "preventOverflow",
            enabled: true,
            options: {
              altAxis: true,
              altBoundary: true,
              tether: true,
              rootBoundary: "document",
              padding: 8,
            },
          },
          {
            name: "offset",
            options: {
              offset: [0, 8],
            },
          },
        ]}
        sx={{
          zIndex: 9999,
          pointerEvents: "none", // Allows mouse through invisible areas
        }}
      >
        <Paper
          elevation={8}
          onMouseEnter={() => {
            console.log("Mouse entered popover");
            if (closeTimerRef.current) {
              clearTimeout(closeTimerRef.current);
              closeTimerRef.current = null;
            }
          }}
          onMouseLeave={() => {
            console.log("Mouse left popover");
            closeTimerRef.current = setTimeout(() => {
              handlePopoverClose();
            }, 200);
          }}
          sx={{
            pointerEvents: "auto", // Re-enable pointer events for content
            mb: 1,
            zIndex: 9999,
          }}
        >
          {hoveredLead && (
            <>
              {console.log("Rendering popover for:", hoveredLead.firstName)}
              {(() => {
                // Get order data to merge metadata into lead
                const orderData = hoveredOrderId && expandedRowData[hoveredOrderId];
                const leadWithMetadata = orderData
                  ? getLeadWithOrderMetadata(hoveredLead, orderData)
                  : hoveredLead;

                return (
                  <LeadQuickView
                    lead={leadWithMetadata}
                    onLeadUpdate={
                      user?.role !== "lead_manager" ? handleLeadUpdate : undefined
                    }
                    readOnly={user?.role === "lead_manager"}
                    onConfirmDeposit={
                      user?.role !== "lead_manager" ? handleConfirmDeposit : undefined
                    }
                    onUnconfirmDeposit={
                      user?.role === "admin" ? handleUnconfirmDeposit : undefined
                    }
                    onMarkAsShaved={
                      user?.role !== "lead_manager" ? handleMarkAsShaved : undefined
                    }
                    onUnmarkAsShaved={
                      user?.role === "admin" ? handleUnmarkAsShaved : undefined
                    }
                    userRole={user?.role}
                  />
                );
              })()}
            </>
          )}
        </Paper>
      </Popper>

      {/* Assigned Leads Modal */}
      <Dialog
        open={assignedLeadsModal.open}
        onClose={handleCloseAssignedLeadsModal}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: "transparent",
            boxShadow: "none",
            backgroundImage: "none",
          },
        }}
      >
        <DialogContent sx={{ p: 0, overflow: "visible" }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              position: "relative",
            }}
          >
            <IconButton
              aria-label="close"
              onClick={handleCloseAssignedLeadsModal}
              sx={{
                position: "absolute",
                top: -40,
                right: 0,
                color: "white",
                bgcolor: "rgba(0,0,0,0.5)",
                "&:hover": {
                  bgcolor: "rgba(0,0,0,0.7)",
                },
              }}
            >
              <CloseIcon />
            </IconButton>

            {filteredLeads.length > 0 ? (
              filteredLeads[assignedLeadsModal.currentIndex] && (() => {
                // Get order data to merge metadata into lead
                const orderId = assignedLeadsModal.orderId;
                const orderData = orderId && expandedRowData[orderId];
                const currentLead = filteredLeads[assignedLeadsModal.currentIndex];
                const leadWithMetadata = orderData
                  ? getLeadWithOrderMetadata(currentLead, orderData)
                  : currentLead;

                return (
                <LeadQuickView
                  lead={leadWithMetadata}
                  onLeadUpdate={
                    user?.role !== "lead_manager" ? handleLeadUpdate : undefined
                  }
                  readOnly={user?.role === "lead_manager"}
                  onMarkAsShaved={
                    user?.role !== "lead_manager"
                      ? (lead) => handleMarkAsShaved(lead, orderId)
                      : undefined
                  }
                  onUnmarkAsShaved={
                    user?.role === "admin"
                      ? (lead) => handleUnmarkAsShaved(lead, orderId)
                      : undefined
                  }
                  userRole={user?.role}
                  titleExtra={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      {!showLeadsSearch ? (
                        <>
                          <IconButton
                            size="small"
                            onClick={() => setShowLeadsSearch(true)}
                            sx={{
                              color: "text.secondary",
                              "&:hover": { color: "primary.main" },
                            }}
                          >
                            <SearchIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                          <Typography
                            component="div"
                            variant="subtitle1"
                            color="text.secondary"
                            sx={{ fontWeight: "bold" }}
                          >
                            {assignedLeadsModal.currentIndex + 1} /{" "}
                            {filteredLeads.length}
                            {leadsSearchQuery && (
                              <Typography
                                component="span"
                                variant="caption"
                                sx={{ ml: 0.5, opacity: 0.7 }}
                              >
                                (of {assignedLeadsModal.leads.length})
                              </Typography>
                            )}
                          </Typography>
                        </>
                      ) : (
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.5,
                          }}
                        >
                          <TextField
                            size="small"
                            placeholder="Search leads..."
                            value={leadsSearchQuery}
                            onChange={(e) =>
                              setLeadsSearchQuery(e.target.value)
                            }
                            autoFocus
                            sx={{
                              width: 200,
                              "& .MuiOutlinedInput-root": {
                                height: 32,
                                fontSize: "0.875rem",
                              },
                            }}
                            InputProps={{
                              startAdornment: (
                                <SearchIcon
                                  sx={{
                                    fontSize: 16,
                                    mr: 0.5,
                                    color: "text.secondary",
                                  }}
                                />
                              ),
                            }}
                          />
                          <IconButton
                            size="small"
                            onClick={() => {
                              setLeadsSearchQuery("");
                              setShowLeadsSearch(false);
                            }}
                            sx={{ color: "text.secondary" }}
                          >
                            <CloseIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                          <Typography
                            component="div"
                            variant="subtitle1"
                            color="text.secondary"
                            sx={{ fontWeight: "bold", ml: 0.5 }}
                          >
                            {assignedLeadsModal.currentIndex + 1} /{" "}
                            {filteredLeads.length}
                            {leadsSearchQuery && (
                              <Typography
                                component="span"
                                variant="caption"
                                sx={{ ml: 0.5, opacity: 0.7 }}
                              >
                                (of {assignedLeadsModal.leads.length})
                              </Typography>
                            )}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  }
                />
                );
              })()
            ) : (
              <Paper
                elevation={8}
                sx={{
                  width: 1000,
                  maxWidth: "95vw",
                  p: 2,
                  bgcolor: "background.paper",
                  borderRadius: 2,
                  border: 1,
                  borderColor: "divider",
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  {!showLeadsSearch ? (
                    <>
                      <IconButton
                        size="small"
                        onClick={() => setShowLeadsSearch(true)}
                        sx={{
                          color: "text.secondary",
                          "&:hover": { color: "primary.main" },
                        }}
                      >
                        <SearchIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                      <Typography
                        component="div"
                        variant="subtitle1"
                        color="text.secondary"
                        sx={{ fontWeight: "bold" }}
                      >
                        0 / {assignedLeadsModal.leads.length}
                      </Typography>
                    </>
                  ) : (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                      }}
                    >
                      <TextField
                        size="small"
                        placeholder="Search leads..."
                        value={leadsSearchQuery}
                        onChange={(e) => setLeadsSearchQuery(e.target.value)}
                        autoFocus
                        sx={{
                          width: 200,
                          "& .MuiOutlinedInput-root": {
                            height: 32,
                            fontSize: "0.875rem",
                          },
                        }}
                        InputProps={{
                          startAdornment: (
                            <SearchIcon
                              sx={{
                                fontSize: 16,
                                mr: 0.5,
                                color: "text.secondary",
                              }}
                            />
                          ),
                        }}
                      />
                      <IconButton
                        size="small"
                        onClick={() => {
                          setLeadsSearchQuery("");
                          setShowLeadsSearch(false);
                        }}
                        sx={{ color: "text.secondary" }}
                      >
                        <CloseIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                      <Typography
                        component="div"
                        variant="subtitle1"
                        color="text.secondary"
                        sx={{ fontWeight: "bold", ml: 0.5 }}
                      >
                        0 / {assignedLeadsModal.leads.length}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Paper>
            )}
          </Box>
        </DialogContent>
      </Dialog>

      {/* Leads Preview Modal */}
      <Dialog
        open={leadsPreviewModal.open}
        onClose={handleCloseLeadsPreviewModal}
        maxWidth="xl"
        fullWidth
        PaperProps={{
          sx: { maxHeight: "90vh" },
        }}
      >
        <DialogTitle>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Typography variant="h6">
              Leads Preview ({leadsPreviewModal.leads.length} leads)
            </Typography>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              {leadRemovalMode ? (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                    {selectedLeadsForRemoval.length} selected
                  </Typography>
                  <Button
                    size="small"
                    variant="contained"
                    color="error"
                    onClick={handleOpenRemovalReasonDialog}
                    disabled={selectedLeadsForRemoval.length === 0 || removingLeads}
                    startIcon={removingLeads ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}
                  >
                    {removingLeads ? "Removing..." : "Remove"}
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={handleToggleLeadRemovalMode}
                    disabled={removingLeads}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  {["admin", "affiliate_manager", "lead_manager"].includes(user?.role) && leadsPreviewModal.order && (() => {
                    const allLeadsValidated = leadsPreviewModal.leads.length > 0 &&
                      leadsPreviewModal.leads.every((lead) => lead.ipqsValidation?.validatedAt);
                    const isValidating = ipqsValidatingOrders.includes(leadsPreviewModal.orderId);
                    return (
                      <Tooltip title={isValidating ? "Validating..." : allLeadsValidated ? "All leads already validated" : "Validate lead emails and phones with IPQS"}>
                        <span>
                          <IconButton
                            aria-label="IPQS check"
                            onClick={() => handleDirectIPQSValidation(leadsPreviewModal.orderId, true)}
                            size="small"
                            color="info"
                            disabled={isValidating || allLeadsValidated}
                          >
                            {isValidating ? (
                              <CircularProgress size={20} color="inherit" />
                            ) : (
                              <VerifiedUserIcon />
                            )}
                          </IconButton>
                        </span>
                      </Tooltip>
                    );
                  })()}
                  {["admin", "affiliate_manager", "lead_manager"].includes(user?.role) && leadsPreviewModal.order && leadsPreviewModal.leads.length > 0 && (
                    <Tooltip title="Remove leads from this order">
                      <IconButton
                        aria-label="remove leads"
                        onClick={handleToggleLeadRemovalMode}
                        size="small"
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                  {["admin", "affiliate_manager"].includes(user?.role) && leadsPreviewModal.order && (
                    <Tooltip title="Add leads to this order">
                      <IconButton
                        aria-label="add leads"
                        onClick={() => handleOpenAddLeadsDialog(leadsPreviewModal.order)}
                        size="small"
                        color="primary"
                      >
                        <AddIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                </>
              )}
              <IconButton
                aria-label="close"
                onClick={handleCloseLeadsPreviewModal}
                size="small"
              >
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 1, overflow: "auto" }}>
          <TableContainer
            sx={{ maxHeight: "calc(90vh - 180px)", overflow: "auto" }}
          >
            <Table
              size="small"
              stickyHeader
              sx={{ tableLayout: "auto", minWidth: 900 }}
            >
              <TableHead>
                <TableRow>
                  {leadRemovalMode && (
                    <TableCell
                      sx={{
                        fontWeight: "bold",
                        backgroundColor: "grey.100",
                        py: 0.5,
                        px: 0.5,
                        width: 40,
                      }}
                    >
                      <Checkbox
                        size="small"
                        checked={selectedLeadsForRemoval.length === leadsPreviewModal.leads.filter(l => !leadsPreviewModal.order?.removedLeads?.find(rl => rl.leadId === l._id || rl.leadId?._id === l._id)).length && selectedLeadsForRemoval.length > 0}
                        indeterminate={selectedLeadsForRemoval.length > 0 && selectedLeadsForRemoval.length < leadsPreviewModal.leads.filter(l => !leadsPreviewModal.order?.removedLeads?.find(rl => rl.leadId === l._id || rl.leadId?._id === l._id)).length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedLeadsForRemoval(
                              leadsPreviewModal.leads
                                .filter(l => !leadsPreviewModal.order?.removedLeads?.find(rl => rl.leadId === l._id || rl.leadId?._id === l._id))
                                .map(l => l._id)
                            );
                          } else {
                            setSelectedLeadsForRemoval([]);
                          }
                        }}
                      />
                    </TableCell>
                  )}
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      backgroundColor: "grey.100",
                      whiteSpace: "nowrap",
                      py: 0.5,
                      px: 1,
                      fontSize: "0.75rem",
                    }}
                  >
                    Name
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      backgroundColor: "grey.100",
                      whiteSpace: "nowrap",
                      py: 0.5,
                      px: 1,
                      fontSize: "0.75rem",
                    }}
                  >
                    Status
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      backgroundColor: "grey.100",
                      whiteSpace: "nowrap",
                      py: 0.5,
                      px: 1,
                      fontSize: "0.75rem",
                    }}
                  >
                    Phone
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      backgroundColor: "grey.100",
                      whiteSpace: "nowrap",
                      py: 0.5,
                      px: 1,
                      fontSize: "0.75rem",
                    }}
                  >
                    Email
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      backgroundColor: "grey.100",
                      whiteSpace: "nowrap",
                      py: 0.5,
                      px: 1,
                      fontSize: "0.75rem",
                    }}
                  >
                    Agent
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      backgroundColor: "grey.100",
                      whiteSpace: "nowrap",
                      textAlign: "center",
                      py: 0.5,
                      px: 0.5,
                      fontSize: "0.75rem",
                    }}
                  >
                    ID Front
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      backgroundColor: "grey.100",
                      whiteSpace: "nowrap",
                      textAlign: "center",
                      py: 0.5,
                      px: 0.5,
                      fontSize: "0.75rem",
                    }}
                  >
                    ID Back
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      backgroundColor: "grey.100",
                      whiteSpace: "nowrap",
                      textAlign: "center",
                      py: 0.5,
                      px: 0.5,
                      fontSize: "0.75rem",
                    }}
                  >
                    Selfie
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      backgroundColor: "grey.100",
                      whiteSpace: "nowrap",
                      py: 0.5,
                      px: 1,
                      fontSize: "0.75rem",
                    }}
                  >
                    Broker
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      backgroundColor: "grey.100",
                      whiteSpace: "nowrap",
                      py: 0.5,
                      px: 1,
                      fontSize: "0.75rem",
                    }}
                  >
                    Client Network
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      backgroundColor: "grey.100",
                      whiteSpace: "nowrap",
                      py: 0.5,
                      px: 1,
                      fontSize: "0.75rem",
                    }}
                  >
                    Our Network
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      backgroundColor: "grey.100",
                      whiteSpace: "nowrap",
                      py: 0.5,
                      px: 1,
                      fontSize: "0.75rem",
                    }}
                  >
                    Campaign
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      backgroundColor: "grey.100",
                      whiteSpace: "nowrap",
                      py: 0.5,
                      px: 0.5,
                      fontSize: "0.75rem",
                      textAlign: "center",
                    }}
                  >
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {leadsPreviewModal.leads.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={13}
                      align="center"
                    >
                      <Typography color="text.secondary" variant="body2">
                        No leads found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  leadsPreviewModal.leads.map((originalLead, index) => {
                    // Merge order metadata into lead for correct deposit/shaved status
                    const lead = getLeadWithOrderMetadata(originalLead, leadsPreviewModal.order);
                    const leadType = getDisplayLeadType(lead);
                    // Extract document URLs from documents array
                    const documents = lead.documents || [];
                    const idFrontDoc = documents.find(
                      (doc) =>
                        doc.description?.toLowerCase().includes("id front") &&
                        !doc.description?.toLowerCase().includes("selfie")
                    );
                    const idBackDoc = documents.find(
                      (doc) =>
                        doc.description?.toLowerCase().includes("id back") &&
                        !doc.description?.toLowerCase().includes("selfie")
                    );
                    const selfieDoc = documents.find((doc) =>
                      doc.description?.toLowerCase().includes("selfie")
                    );

                    // Check if lead is removed
                    const removedInfo = leadsPreviewModal.order?.removedLeads?.find(
                      (rl) => rl.leadId === lead._id || rl.leadId?._id === lead._id
                    );
                    const isRemoved = !!removedInfo;

                    return (
                      <Tooltip
                        key={lead._id || index}
                        title={
                          isRemoved
                            ? `Removed: ${removedInfo.reason}${
                                removedInfo.removedBy?.fullName
                                  ? ` (by ${removedInfo.removedBy.fullName})`
                                  : ""
                              }${
                                removedInfo.removedAt
                                  ? ` on ${new Date(removedInfo.removedAt).toLocaleString()}`
                                  : ""
                              }`
                            : ""
                        }
                        arrow
                        placement="top"
                        disableHoverListener={!isRemoved}
                      >
                        <TableRow
                          hover={!isRemoved}
                          sx={{
                            "& td": { py: 0.5 },
                            ...(isRemoved && {
                              backgroundColor: "action.disabledBackground",
                              opacity: 0.6,
                              "& *": {
                                textDecoration: "line-through",
                                color: "text.disabled",
                              },
                              "& .MuiChip-root": {
                                opacity: 0.5,
                              },
                            }),
                          }}
                        >
                        {/* Checkbox for removal selection */}
                        {leadRemovalMode && (
                          <TableCell sx={{ py: 0.5, px: 0.5 }}>
                            <Checkbox
                              size="small"
                              checked={selectedLeadsForRemoval.includes(lead._id)}
                              onChange={() => handleToggleLeadSelection(lead._id)}
                              disabled={isRemoved}
                            />
                          </TableCell>
                        )}
                        {/* Name */}
                        <TableCell sx={{ py: 0.5, px: 1, position: "relative" }}>
                          {/* IPQS Validation Success Indicator - overlays on top */}
                          {ipqsValidationSuccess.includes(lead._id) && (
                            <Box
                              sx={{
                                position: "absolute",
                                top: "50%",
                                left: "50%",
                                transform: "translate(-50%, -50%)",
                                zIndex: 10,
                                animation: "ipqsCheckFadeInOut 2s ease-in-out",
                                "@keyframes ipqsCheckFadeInOut": {
                                  "0%": { opacity: 0, transform: "translate(-50%, -50%) scale(0.5)" },
                                  "15%": { opacity: 1, transform: "translate(-50%, -50%) scale(1.3)" },
                                  "30%": { opacity: 1, transform: "translate(-50%, -50%) scale(1)" },
                                  "85%": { opacity: 1 },
                                  "100%": { opacity: 0 },
                                },
                              }}
                            >
                              <CheckCircleIcon sx={{ color: "success.main", fontSize: 32 }} />
                            </Box>
                          )}
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 0.5,
                            }}
                          >
                            <Chip
                              label={leadType?.toUpperCase() || "N/A"}
                              size="small"
                              color={
                                leadType === "ftd"
                                  ? "success"
                                  : leadType === "filler"
                                  ? "warning"
                                  : leadType === "cold"
                                  ? "info"
                                  : "default"
                              }
                              sx={{
                                height: 18,
                                fontSize: "0.6rem",
                                "& .MuiChip-label": {
                                  padding: "0 4px",
                                },
                              }}
                            />
                            <Typography
                              variant="body2"
                              sx={{ whiteSpace: "nowrap", fontSize: "0.75rem" }}
                            >
                              {lead.firstName} {lead.lastName}
                            </Typography>
                          </Box>
                        </TableCell>
                        {/* Status */}
                        <TableCell sx={{ py: 0.5, px: 1 }}>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 0.5,
                              flexWrap: "wrap",
                            }}
                          >
                            {isRemoved && (
                              <Chip
                                label="Removed"
                                size="small"
                                sx={{
                                  height: 18,
                                  fontSize: "0.6rem",
                                  backgroundColor: "grey.500",
                                  color: "white",
                                  textDecoration: "none !important",
                                  "& .MuiChip-label": {
                                    padding: "0 4px",
                                    textDecoration: "none !important",
                                  },
                                }}
                              />
                            )}
                            {lead.depositConfirmed && !isRemoved && (
                              <Tooltip
                                title={
                                  lead.depositPSP ? (
                                    <Box sx={{ p: 0.5 }}>
                                      <Typography variant="caption" sx={{ fontWeight: 600, display: "block" }}>
                                        PSP: {lead.depositPSP.name || lead.depositPSP}
                                      </Typography>
                                      {lead.depositPSP.website && (
                                        <Typography variant="caption" sx={{ display: "block", color: "rgba(255,255,255,0.8)" }}>
                                          {lead.depositPSP.website}
                                        </Typography>
                                      )}
                                    </Box>
                                  ) : "Deposit Confirmed"
                                }
                                arrow
                                placement="top"
                              >
                                <Chip
                                  label={lead.depositPSP?.name ? `Deposit (${lead.depositPSP.name})` : "Deposit Confirmed"}
                                  size="small"
                                  color="success"
                                  sx={{
                                    height: 18,
                                    fontSize: "0.6rem",
                                    maxWidth: 150,
                                    "& .MuiChip-label": {
                                      padding: "0 4px",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    },
                                  }}
                                />
                              </Tooltip>
                            )}
                            {lead.shaved && !isRemoved && (
                              <Chip
                                label="Shaved"
                                size="small"
                                color="error"
                                sx={{
                                  height: 18,
                                  fontSize: "0.6rem",
                                  "& .MuiChip-label": {
                                    padding: "0 4px",
                                  },
                                }}
                              />
                            )}
                            {!lead.depositConfirmed && !lead.shaved && !isRemoved && (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ fontSize: "0.75rem" }}
                              >
                                -
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
                        {/* Phone */}
                        <TableCell sx={{ py: 0.5, px: 1 }}>
                          {(() => {
                            const phoneStatus = lead.ipqsValidation?.summary?.phoneStatus;
                            const statusConfig = phoneStatus ? getIPQSStatusConfig(phoneStatus) : null;
                            return (
                              <Tooltip
                                title={lead.ipqsValidation ? buildIPQSTooltip(lead.ipqsValidation, "phone") : "Not validated"}
                                arrow
                                placement="top"
                              >
                                <Typography
                                  variant="body2"
                                  sx={{
                                    whiteSpace: "nowrap",
                                    fontSize: "0.75rem",
                                    ...(statusConfig && {
                                      backgroundColor: `${statusConfig.bgcolor} !important`,
                                      color: "#212121 !important",
                                      fontWeight: 500,
                                      px: 0.5,
                                      py: 0.25,
                                      borderRadius: 0.5,
                                      borderLeft: `3px solid ${statusConfig.color}`,
                                    }),
                                    textDecoration: isRemoved ? "line-through !important" : "none",
                                  }}
                                >
                                  {formatPhoneWithCountryCode(lead.newPhone || lead.phone, lead.country) || "-"}
                                </Typography>
                              </Tooltip>
                            );
                          })()}
                        </TableCell>
                        {/* Email */}
                        <TableCell sx={{ py: 0.5, px: 1 }}>
                          {(() => {
                            const emailStatus = lead.ipqsValidation?.summary?.emailStatus;
                            const statusConfig = emailStatus ? getIPQSStatusConfig(emailStatus) : null;
                            return (
                              <Tooltip
                                title={lead.ipqsValidation ? buildIPQSTooltip(lead.ipqsValidation, "email") : "Not validated"}
                                arrow
                                placement="top"
                              >
                                <Typography
                                  variant="body2"
                                  sx={{
                                    fontSize: "0.7rem",
                                    maxWidth: 180,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    ...(statusConfig && {
                                      backgroundColor: `${statusConfig.bgcolor} !important`,
                                      color: "#212121 !important",
                                      fontWeight: 500,
                                      px: 0.5,
                                      py: 0.25,
                                      borderRadius: 0.5,
                                      borderLeft: `3px solid ${statusConfig.color}`,
                                    }),
                                    textDecoration: isRemoved ? "line-through !important" : "none",
                                  }}
                                >
                                  {lead.newEmail || lead.email || "-"}
                                </Typography>
                              </Tooltip>
                            );
                          })()}
                        </TableCell>
                        {/* Assigned Agent */}
                        <TableCell sx={{ py: 0.5, px: 1 }}>
                          <Typography
                            variant="body2"
                            sx={{ whiteSpace: "nowrap", fontSize: "0.75rem" }}
                          >
                            {lead.assignedAgent?.fullName || "-"}
                          </Typography>
                        </TableCell>
                        {/* ID Front */}
                        <TableCell align="center" sx={{ py: 0.5, px: 0.5 }}>
                          {idFrontDoc?.url ? (
                            <DocumentPreview
                              url={idFrontDoc.url}
                              type="ID Front"
                              forceImage
                            >
                              <ImageIcon
                                sx={{
                                  fontSize: 16,
                                  color: "primary.main",
                                  cursor: "pointer",
                                }}
                              />
                            </DocumentPreview>
                          ) : (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ fontSize: "0.75rem" }}
                            >
                              -
                            </Typography>
                          )}
                        </TableCell>
                        {/* ID Back */}
                        <TableCell align="center" sx={{ py: 0.5, px: 0.5 }}>
                          {idBackDoc?.url ? (
                            <DocumentPreview
                              url={idBackDoc.url}
                              type="ID Back"
                              forceImage
                            >
                              <ImageIcon
                                sx={{
                                  fontSize: 16,
                                  color: "primary.main",
                                  cursor: "pointer",
                                }}
                              />
                            </DocumentPreview>
                          ) : (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ fontSize: "0.75rem" }}
                            >
                              -
                            </Typography>
                          )}
                        </TableCell>
                        {/* Selfie */}
                        <TableCell align="center" sx={{ py: 0.5, px: 0.5 }}>
                          {selfieDoc?.url ? (
                            <DocumentPreview
                              url={selfieDoc.url}
                              type="Selfie"
                              forceImage
                            >
                              <ImageIcon
                                sx={{
                                  fontSize: 16,
                                  color: "primary.main",
                                  cursor: "pointer",
                                }}
                              />
                            </DocumentPreview>
                          ) : (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ fontSize: "0.75rem" }}
                            >
                              -
                            </Typography>
                          )}
                        </TableCell>
                        {/* Client Broker */}
                        <TableCell sx={{ py: 0.5, px: 1 }}>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 0.5,
                            }}
                          >
                            <Typography
                              variant="body2"
                              sx={{ whiteSpace: "nowrap", fontSize: "0.75rem" }}
                            >
                              {(lead.assignedClientBrokers?.length > 0
                                ? lead.assignedClientBrokers[lead.assignedClientBrokers.length - 1]?.name
                                : null) ||
                                lead.clientBroker ||
                                "-"}
                            </Typography>
                            {lead.assignedClientBrokers &&
                              lead.assignedClientBrokers.length > 0 && (
                                <Tooltip title="View all client brokers">
                                  <IconButton
                                    size="small"
                                    onClick={() =>
                                      handleOpenClientBrokersDialog(
                                        lead.assignedClientBrokers,
                                        `${lead.firstName} ${lead.lastName}`
                                      )
                                    }
                                    sx={{ p: 0.25 }}
                                  >
                                    <ListIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Tooltip>
                              )}
                          </Box>
                        </TableCell>
                        {/* Client Network */}
                        <TableCell sx={{ py: 0.5, px: 1 }}>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 0.5,
                            }}
                          >
                            <Typography
                              variant="body2"
                              sx={{ whiteSpace: "nowrap", fontSize: "0.75rem" }}
                            >
                              {lead.clientNetworkHistory?.length > 0
                                ? lead.clientNetworkHistory[lead.clientNetworkHistory.length - 1]?.clientNetwork?.name || "-"
                                : "-"}
                            </Typography>
                            {lead.clientNetworkHistory &&
                              lead.clientNetworkHistory.length > 0 && (
                                <Tooltip title="View all client networks">
                                  <IconButton
                                    size="small"
                                    onClick={() =>
                                      handleOpenClientNetworksDialog(
                                        lead.clientNetworkHistory,
                                        `${lead.firstName} ${lead.lastName}`
                                      )
                                    }
                                    sx={{ p: 0.25 }}
                                  >
                                    <ListIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Tooltip>
                              )}
                          </Box>
                        </TableCell>
                        {/* Our Network */}
                        <TableCell sx={{ py: 0.5, px: 1 }}>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 0.5,
                            }}
                          >
                            <Typography
                              variant="body2"
                              sx={{ whiteSpace: "nowrap", fontSize: "0.75rem" }}
                            >
                              {lead.ourNetworkHistory?.length > 0
                                ? lead.ourNetworkHistory[lead.ourNetworkHistory.length - 1]?.ourNetwork?.name || "-"
                                : "-"}
                            </Typography>
                            {lead.ourNetworkHistory &&
                              lead.ourNetworkHistory.length > 0 && (
                                <Tooltip title="View all our networks">
                                  <IconButton
                                    size="small"
                                    onClick={() =>
                                      handleOpenOurNetworksDialog(
                                        lead.ourNetworkHistory,
                                        `${lead.firstName} ${lead.lastName}`
                                      )
                                    }
                                    sx={{ p: 0.25 }}
                                  >
                                    <ListIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Tooltip>
                              )}
                          </Box>
                        </TableCell>
                        {/* Campaign */}
                        <TableCell sx={{ py: 0.5, px: 1 }}>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 0.5,
                            }}
                          >
                            <Typography
                              variant="body2"
                              sx={{ whiteSpace: "nowrap", fontSize: "0.75rem" }}
                            >
                              {lead.campaignHistory?.length > 0
                                ? lead.campaignHistory[lead.campaignHistory.length - 1]?.campaign?.name || "-"
                                : "-"}
                            </Typography>
                            {lead.campaignHistory &&
                              lead.campaignHistory.length > 0 && (
                                <Tooltip title="View all campaigns">
                                  <IconButton
                                    size="small"
                                    onClick={() =>
                                      handleOpenCampaignsDialog(
                                        lead.campaignHistory,
                                        `${lead.firstName} ${lead.lastName}`
                                      )
                                    }
                                    sx={{ p: 0.25 }}
                                  >
                                    <ListIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Tooltip>
                              )}
                          </Box>
                        </TableCell>
                        {/* Actions */}
                        <TableCell sx={{ py: 0.5, px: 0.5, textAlign: "center" }}>
                          <IconButton
                            size="small"
                            onClick={(e) => handleOpenPreviewActionsMenu(e, lead)}
                            sx={{ p: 0.25 }}
                          >
                            {isRemoved ? (
                              <RestoreIcon sx={{ fontSize: 18, color: "info.main" }} />
                            ) : (
                              <MoreVertIcon sx={{ fontSize: 18 }} />
                            )}
                          </IconButton>
                        </TableCell>
                      </TableRow>
                      </Tooltip>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseLeadsPreviewModal} variant="outlined">
            Close
          </Button>
        </DialogActions>

        {/* Actions Menu for Preview Modal */}
        <Menu
          anchorEl={previewActionsMenu.anchorEl}
          open={Boolean(previewActionsMenu.anchorEl)}
          onClose={handleClosePreviewActionsMenu}
          anchorOrigin={{
            vertical: "bottom",
            horizontal: "right",
          }}
          transformOrigin={{
            vertical: "top",
            horizontal: "right",
          }}
        >
          {previewActionsMenu.lead && (() => {
            const lead = previewActionsMenu.lead;
            const leadType = getDisplayLeadType(lead);
            const isFtdOrFiller = leadType === "ftd" || leadType === "filler";
            const order = leadsPreviewModal.order;

            // Check if lead is removed
            const isRemovedLead = order?.removedLeads?.some(
              (rl) => rl.leadId === lead._id || rl.leadId?._id === lead._id
            );

            // Check if this lead has a replacement history (meaning it replaced another lead)
            const leadMetadata = order?.leadsMetadata?.find(
              (meta) => meta.leadId?.toString() === lead._id || meta.leadId === lead._id
            );
            const replacementHistory = leadMetadata?.replacementHistory || [];
            const canUndoReplacement = replacementHistory.length > 0 &&
              (user?.role === "admin" || user?.role === "affiliate_manager");
            const lastReplacedLeadId = replacementHistory.length > 0
              ? replacementHistory[replacementHistory.length - 1]
              : null;

            // For removed leads, show only restore option
            if (isRemovedLead) {
              return (
                <MenuItem
                  onClick={() => {
                    handleRestoreLead(order._id, lead);
                    handleClosePreviewActionsMenu();
                  }}
                  disabled={restoringLead === lead._id}
                >
                  <ListItemIcon>
                    {restoringLead === lead._id ? (
                      <CircularProgress size={20} />
                    ) : (
                      <RestoreIcon fontSize="small" color="info" />
                    )}
                  </ListItemIcon>
                  {restoringLead === lead._id ? "Restoring..." : "Restore Lead"}
                </MenuItem>
              );
            }

            return (
              <>
                {/* Convert to Filler/FTD */}
                {isFtdOrFiller && order && (
                  <MenuItem
                    onClick={() => {
                      handleConvertLeadType(order, lead);
                      handleClosePreviewActionsMenu();
                    }}
                  >
                    <ListItemIcon>
                      <ConvertIcon fontSize="small" color="primary" />
                    </ListItemIcon>
                    Convert to {leadType === "ftd" ? "Filler" : "FTD"}
                  </MenuItem>
                )}

                {/* Change FTD/Filler Lead */}
                {isFtdOrFiller && order && (
                  <MenuItem
                    onClick={() => {
                      handleOpenChangeFTDDialog(order, lead);
                      handleClosePreviewActionsMenu();
                    }}
                  >
                    <ListItemIcon>
                      <ChangeIcon fontSize="small" color="warning" />
                    </ListItemIcon>
                    Change {leadType === "filler" ? "Filler" : "FTD"} Lead
                  </MenuItem>
                )}

                {/* Replace Lead - Admin and Affiliate Manager only */}
                {(user?.role === "admin" || user?.role === "affiliate_manager") && order && (
                  <MenuItem
                    onClick={() => {
                      handleOpenReplaceLeadDialog(order, lead);
                      handleClosePreviewActionsMenu();
                    }}
                  >
                    <ListItemIcon>
                      <SwapHorizIcon fontSize="small" color="secondary" />
                    </ListItemIcon>
                    Replace Lead
                  </MenuItem>
                )}

                {/* Undo Replacement - Admin and Affiliate Manager only, when lead has replacement history */}
                {canUndoReplacement && order && (
                  <MenuItem
                    onClick={() => {
                      handleUndoReplacementFromMenu(order._id, lead._id, lastReplacedLeadId);
                      handleClosePreviewActionsMenu();
                    }}
                    disabled={undoingReplacement === lead._id}
                  >
                    <ListItemIcon>
                      {undoingReplacement === lead._id ? (
                        <CircularProgress size={20} />
                      ) : (
                        <UndoIcon fontSize="small" color="warning" />
                      )}
                    </ListItemIcon>
                    {undoingReplacement === lead._id ? "Undoing..." : "Undo Replacement"}
                  </MenuItem>
                )}

                {/* Assign to Agent */}
                <MenuItem
                  onClick={() => {
                    handleOpenAssignLeadDialog(lead);
                    handleClosePreviewActionsMenu();
                  }}
                >
                  <ListItemIcon>
                    <AssignIcon fontSize="small" color="info" />
                  </ListItemIcon>
                  Assign to Agent
                </MenuItem>

                {/* Apply Fine to Agent - Only show if lead has an assigned agent */}
                {lead.assignedAgent && (user?.role === "admin" || user?.role === "affiliate_manager") && (
                  <MenuItem
                    onClick={() => {
                      handleOpenApplyFineDialog(lead, leadsPreviewModal.orderId);
                      handleClosePreviewActionsMenu();
                    }}
                  >
                    <ListItemIcon>
                      <GavelIcon fontSize="small" color="warning" />
                    </ListItemIcon>
                    Apply Fine to Agent
                  </MenuItem>
                )}

                {/* IPQS Recheck */}
                <MenuItem onClick={() => handleIPQSRecheckLead(lead)}>
                  <ListItemIcon>
                    <VerifiedUserIcon fontSize="small" color="secondary" />
                  </ListItemIcon>
                  IPQS Recheck
                </MenuItem>

                {/* Confirm/Unconfirm Deposit */}
                {isFtdOrFiller && (
                  lead.depositConfirmed ? (
                    user.role === "admin" ? (
                      <MenuItem
                        onClick={() => {
                          handleUnconfirmDeposit(lead, leadsPreviewModal.orderId);
                          handleClosePreviewActionsMenu();
                        }}
                      >
                        <ListItemIcon>
                          <CallIcon fontSize="small" color="warning" />
                        </ListItemIcon>
                        Unconfirm Deposit
                      </MenuItem>
                    ) : (
                      <MenuItem disabled>
                        <ListItemIcon>
                          <CallIcon fontSize="small" color="success" />
                        </ListItemIcon>
                        Deposit Confirmed
                      </MenuItem>
                    )
                  ) : (
                    <MenuItem
                      onClick={() => {
                        handleConfirmDeposit(lead, leadsPreviewModal.orderId);
                        handleClosePreviewActionsMenu();
                      }}
                      disabled={!lead.assignedAgent}
                    >
                      <ListItemIcon>
                        <CallIcon fontSize="small" color="success" />
                      </ListItemIcon>
                      Confirm Deposit
                    </MenuItem>
                  )
                )}

                {/* Mark/Unmark as Shaved - for FTD/Filler with confirmed deposit */}
                {isFtdOrFiller && lead.depositConfirmed && (
                  lead.shaved ? (
                    user.role === "admin" && (
                      <MenuItem
                        onClick={() => {
                          handleUnmarkAsShaved(lead, leadsPreviewModal.orderId);
                          handleClosePreviewActionsMenu();
                        }}
                      >
                        <ListItemIcon>
                          <ShavedIcon fontSize="small" color="warning" />
                        </ListItemIcon>
                        Unmark as Shaved
                      </MenuItem>
                    )
                  ) : (
                    user.role !== "lead_manager" && (
                      <MenuItem
                        onClick={() => {
                          handleMarkAsShaved(lead, leadsPreviewModal.orderId);
                          handleClosePreviewActionsMenu();
                        }}
                      >
                        <ListItemIcon>
                          <ShavedIcon fontSize="small" color="error" />
                        </ListItemIcon>
                        Mark as Shaved
                      </MenuItem>
                    )
                  )
                )}

                {/* Open Browser Session */}
                {(leadType === "ftd" || leadType === "filler") && (
                  <MenuItem
                    onClick={() => {
                      setBrowserDialog({ open: true, lead });
                      handleClosePreviewActionsMenu();
                    }}
                  >
                    <ListItemIcon>
                      <LaunchIcon fontSize="small" color="success" />
                    </ListItemIcon>
                    Open Browser
                  </MenuItem>
                )}

                {/* Delete - Available to all users */}
                <>
                  <Divider />
                  <MenuItem
                    onClick={() => {
                      handleOpenRemoveLeadDialog(lead);
                      handleClosePreviewActionsMenu();
                    }}
                    sx={{ color: "error.main" }}
                  >
                    <ListItemIcon>
                      <DeleteIcon fontSize="small" color="error" />
                    </ListItemIcon>
                    Remove from Order
                  </MenuItem>
                </>
              </>
            );
          })()}
        </Menu>
      </Dialog>

      {/* Client Brokers Display Dialog */}
      <Dialog
        open={clientBrokersDialog.open}
        onClose={handleCloseClientBrokersDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Client Brokers
          {clientBrokersDialog.leadName && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              for {clientBrokersDialog.leadName}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          {clientBrokersDialog.brokers.length > 0 ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Broker Name</TableCell>
                    <TableCell>Domain</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {clientBrokersDialog.brokers.map((broker, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Typography variant="body2">
                          {broker.name || "-"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {broker.domain || "-"}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No client brokers assigned
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseClientBrokersDialog} variant="outlined">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Client Networks Display Dialog */}
      <Dialog
        open={clientNetworksDialog.open}
        onClose={handleCloseClientNetworksDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Client Networks
          {clientNetworksDialog.leadName && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              for {clientNetworksDialog.leadName}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          {clientNetworksDialog.networks.length > 0 ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Network Name</TableCell>
                    <TableCell>Assigned At</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {clientNetworksDialog.networks.map((entry, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Typography variant="body2">
                          {entry.clientNetwork?.name || "-"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {entry.assignedAt
                            ? new Date(entry.assignedAt).toLocaleString()
                            : "-"}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No client networks assigned
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseClientNetworksDialog} variant="outlined">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Our Networks Display Dialog */}
      <Dialog
        open={ourNetworksDialog.open}
        onClose={handleCloseOurNetworksDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Our Networks
          {ourNetworksDialog.leadName && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              for {ourNetworksDialog.leadName}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          {ourNetworksDialog.networks.length > 0 ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Network Name</TableCell>
                    <TableCell>Assigned At</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {ourNetworksDialog.networks.map((entry, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Typography variant="body2">
                          {entry.ourNetwork?.name || "-"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {entry.assignedAt
                            ? new Date(entry.assignedAt).toLocaleString()
                            : "-"}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No our networks assigned
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseOurNetworksDialog} variant="outlined">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Campaigns Display Dialog */}
      <Dialog
        open={campaignsDialog.open}
        onClose={handleCloseCampaignsDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Campaigns
          {campaignsDialog.leadName && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              for {campaignsDialog.leadName}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          {campaignsDialog.campaigns.length > 0 ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Campaign Name</TableCell>
                    <TableCell>Assigned At</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {campaignsDialog.campaigns.map((entry, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Typography variant="body2">
                          {entry.campaign?.name || "-"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {entry.assignedAt
                            ? new Date(entry.assignedAt).toLocaleString()
                            : "-"}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No campaigns assigned
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCampaignsDialog} variant="outlined">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Copy Preferences Dialog */}
      <CopyPreferencesDialog
        open={copyPreferencesOpen}
        onClose={() => setCopyPreferencesOpen(false)}
        onSave={() => {
          setNotification({
            message: "Copy preferences saved",
            severity: "success",
          });
        }}
      />
    </Box>
  );
};

// Change Requester Dialog Component
const ChangeRequesterDialog = ({
  open,
  onClose,
  onSubmit,
  requesters,
  loading,
  selectedRequester,
  onSelectRequester,
}) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitle>Change Order Requester</DialogTitle>
    <DialogContent sx={{ pt: 2 }}>
      <Autocomplete
        options={requesters}
        getOptionLabel={(option) => `${option.fullName} (${option.role})`}
        loading={loading}
        value={selectedRequester}
        onChange={(event, newValue) => onSelectRequester(newValue)}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Select New Requester"
            variant="outlined"
            margin="normal"
          />
        )}
        renderOption={(props, option) => (
          <li {...props}>
            <ListItemText primary={option.fullName} secondary={option.role} />
          </li>
        )}
      />
      <Alert severity="warning" sx={{ mt: 2 }}>
        Changing the requester will relink all connections (leads, etc.) to the
        new requester.
      </Alert>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Cancel</Button>
      <Button
        onClick={onSubmit}
        variant="contained"
        disabled={!selectedRequester}
      >
        Change Requester
      </Button>
    </DialogActions>
  </Dialog>
);

// Requester History Dialog Component
const RequesterHistoryDialog = ({ open, onClose, order }) => (
  <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
    <DialogTitle>Requester History</DialogTitle>
    <DialogContent>
      {order?.requesterHistory && order.requesterHistory.length > 0 ? (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Previous Requester</TableCell>
                <TableCell>New Requester</TableCell>
                <TableCell>Changed By</TableCell>
                <TableCell>Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {order.requesterHistory.map((history, index) => (
                <TableRow key={index}>
                  <TableCell>
                    {history.previousRequester?.fullName || "Unknown"}
                  </TableCell>
                  <TableCell>
                    {history.newRequester?.fullName || "Unknown"}
                  </TableCell>
                  <TableCell>
                    {history.changedBy?.fullName || "Unknown"}
                  </TableCell>
                  <TableCell>
                    {new Date(history.changedAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Typography color="textSecondary" align="center" sx={{ py: 3 }}>
          No history available.
        </Typography>
      )}
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Close</Button>
    </DialogActions>
  </Dialog>
);

// Create Broker Form Component
const CreateBrokerForm = ({ onSubmit, loading, onCancel }) => {
  const [formData, setFormData] = useState({
    name: "",
    domain: "",
    isActive: true,
    notes: "",
  });

  const handleChange = (field) => (event) => {
    setFormData((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Broker Name *"
            value={formData.name}
            onChange={handleChange("name")}
            required
            disabled={loading}
            placeholder="e.g., Acme Trading Ltd"
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Domain"
            value={formData.domain}
            onChange={handleChange("domain")}
            disabled={loading}
            placeholder="e.g., acmetrading.com"
            helperText="Optional: Primary domain for this broker"
          />
        </Grid>
        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.isActive}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    isActive: e.target.checked,
                  }))
                }
                disabled={loading}
              />
            }
            label="Active"
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Notes"
            value={formData.notes}
            onChange={handleChange("notes")}
            multiline
            rows={3}
            disabled={loading}
            placeholder="Optional notes about this broker"
          />
        </Grid>
        <Grid item xs={12}>
          <Box display="flex" gap={1} justifyContent="flex-end">
            <Button onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={loading || !formData.name.trim()}
              startIcon={loading ? <CircularProgress size={16} /> : <AddIcon />}
            >
              {loading ? "Creating..." : "Create Broker"}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </form>
  );
};

// Edit Broker Form Component
const EditBrokerForm = ({ broker, onSubmit, loading, onCancel }) => {
  const [formData, setFormData] = useState({
    name: broker?.name || "",
    domain: broker?.domain || "",
    description: broker?.description || "",
    isActive: broker?.isActive !== undefined ? broker.isActive : true,
  });

  // Update form when broker changes
  useEffect(() => {
    if (broker) {
      setFormData({
        name: broker.name || "",
        domain: broker.domain || "",
        description: broker.description || "",
        isActive: broker.isActive !== undefined ? broker.isActive : true,
      });
    }
  }, [broker]);

  const handleChange = (field) => (e) => {
    setFormData((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    onSubmit({
      name: formData.name.trim(),
      domain: formData.domain.trim() || undefined,
      description: formData.description.trim() || undefined,
      isActive: formData.isActive,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Broker Name"
            value={formData.name}
            onChange={handleChange("name")}
            disabled={loading}
            required
            placeholder="e.g., ACME Trading"
            helperText="Unique name for this client broker"
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Domain"
            value={formData.domain}
            onChange={handleChange("domain")}
            disabled={loading}
            placeholder="e.g., acmetrading.com"
            helperText="Optional: Primary domain for this broker"
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Description"
            value={formData.description}
            onChange={handleChange("description")}
            multiline
            rows={3}
            disabled={loading}
            placeholder="Optional description for this broker"
            helperText="Optional: Additional information about this broker"
          />
        </Grid>
        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.isActive}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    isActive: e.target.checked,
                  }))
                }
                disabled={loading}
              />
            }
            label="Active"
          />
        </Grid>
        <Grid item xs={12}>
          <Box display="flex" gap={1} justifyContent="flex-end">
            <Button onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={loading || !formData.name.trim()}
              startIcon={
                loading ? <CircularProgress size={16} /> : <SaveIcon />
              }
            >
              {loading ? "Updating..." : "Update Broker"}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </form>
  );
};

// Broker Management Table Component
const BrokerManagementTable = ({
  brokers,
  loading,
  onRefresh,
  onDelete,
  onEdit,
  userRole,
}) => {
  const isAdmin = userRole === "admin";

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (brokers.length === 0) {
    return (
      <Box textAlign="center" py={4}>
        <Typography variant="body2" color="text.secondary">
          {isAdmin
            ? "No client brokers found. Create your first broker to get started."
            : "No client brokers found."}
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer component={Paper} elevation={1}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>
              <strong>Name</strong>
            </TableCell>
            <TableCell>
              <strong>Domain</strong>
            </TableCell>
            <TableCell>
              <strong>Status</strong>
            </TableCell>
            <TableCell>
              <strong>Created</strong>
            </TableCell>
            {isAdmin && (
              <TableCell>
                <strong>Actions</strong>
              </TableCell>
            )}
            <TableCell>
              <strong>Comments</strong>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {brokers.map((broker) => (
            <TableRow key={broker._id}>
              <TableCell>
                <Box display="flex" alignItems="center" gap={1}>
                  <BusinessIcon fontSize="small" color="primary" />
                  <Typography variant="body2">{broker.name}</Typography>
                </Box>
              </TableCell>
              <TableCell>
                <Typography variant="body2">
                  {broker.domain || "N/A"}
                </Typography>
              </TableCell>
              <TableCell>
                <Chip
                  label={broker.isActive ? "Active" : "Inactive"}
                  color={broker.isActive ? "success" : "default"}
                  size="small"
                />
              </TableCell>
              <TableCell>
                <Typography variant="body2">
                  {new Date(broker.createdAt).toLocaleDateString()}
                </Typography>
              </TableCell>
              {isAdmin && (
                <TableCell>
                  <Box display="flex" flexDirection="row" gap={1}>
                    <IconButton
                      size="small"
                      title="Edit Broker"
                      onClick={() => onEdit(broker)}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      title="Delete Broker"
                      onClick={() => onDelete(broker)}
                      color="error"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </TableCell>
              )}
              <TableCell>
                <CommentButton
                  targetType="client_broker"
                  targetId={broker._id}
                  targetName={broker.name}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default OrdersPage;
