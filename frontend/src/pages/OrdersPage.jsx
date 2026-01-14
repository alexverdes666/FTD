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
} from "@mui/icons-material";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import api from "../services/api";
import notificationService from "../services/notificationService";
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
  const debouncedFilters = useDebounce(filters, 500);
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

  // Actions menu state for leads preview modal
  const [previewActionsMenu, setPreviewActionsMenu] = useState({
    anchorEl: null,
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

  const fetchPotentialRequesters = useCallback(async () => {
    try {
      setLoadingRequesters(true);
      const response = await api.get("/users?isActive=true&limit=1000");
      setPotentialRequesters(response.data.data);
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
      fetchOrders();
    } catch (err) {
      setNotification({
        message: err.response?.data?.message || "Failed to change requester",
        severity: "error",
      });
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

  // Autocomplete states for Create Order Dialog
  const [clientNetworkInput, setClientNetworkInput] = useState("");
  const [clientNetworkOpen, setClientNetworkOpen] = useState(false);

  const [ourNetworkInput, setOurNetworkInput] = useState("");
  const [ourNetworkOpen, setOurNetworkOpen] = useState(false);

  const [campaignInput, setCampaignInput] = useState("");
  const [campaignOpen, setCampaignOpen] = useState(false);

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

      // Map found leads to manual selection format
      const manualLeadEntries = foundLeads.map((lead) => ({
        lead,
        agent: lead.assignedAgent?._id || "",
      }));

      setManualLeads(manualLeadEntries);

      // Show notification about found/not found
      const notFoundEmails = emails.filter(
        (email) =>
          !foundLeads.some(
            (lead) => lead.newEmail.toLowerCase() === email.toLowerCase()
          )
      );

      if (notFoundEmails.length > 0) {
        setNotification({
          message: `Found ${
            foundLeads.length
          } leads. Not found: ${notFoundEmails.join(", ")}`,
          severity: "warning",
        });
      } else {
        setNotification({
          message: `Found all ${foundLeads.length} leads`,
          severity: "success",
        });
      }
    } catch (err) {
      console.error("Failed to search leads:", err);
      setNotification({
        message: err.response?.data?.message || "Failed to search leads",
        severity: "error",
      });
    } finally {
      setSearchingLeads(false);
    }
  }, [manualLeadEmails]);

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

          // Validate that all leads have agent assignments
          const leadsWithoutAgents = manualLeads.filter(
            (entry) => !entry.agent
          );
          if (leadsWithoutAgents.length > 0) {
            setNotification({
              message: `Please assign agents to all leads (${leadsWithoutAgents.length} unassigned)`,
              severity: "warning",
            });
            return;
          }

          // Build manual leads data - use the lead's original type
          const manualLeadsData = manualLeads.map((entry) => ({
            leadId: entry.lead._id,
            agentId: entry.agent,
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
    [reset, fetchOrders, manualSelectionMode, manualLeads]
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
  }, []);

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

  const handleCancelLead = async (leadId) => {
    const orderId = leadsPreviewModal.orderId;
    if (!orderId) return;

    if (
      !window.confirm(
        "Are you sure you want to remove this lead from the order? It will be returned to the pool of available leads."
      )
    ) {
      return;
    }

    try {
      await api.delete(`/orders/${orderId}/leads/${leadId}`);
      notificationService.success("Lead removed from order successfully");

      // Update the local state to remove the lead from the modal
      setLeadsPreviewModal((prev) => ({
        ...prev,
        leads: prev.leads.filter((lead) => lead._id !== leadId),
      }));

      // Refresh the orders list to reflect the changes (e.g. updated counts)
      fetchOrders();
    } catch (error) {
      console.error("Error removing lead from order:", error);
      notificationService.error(
        error.response?.data?.message || "Failed to remove lead from order"
      );
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

  // Confirm Deposit Handler
  const handleConfirmDeposit = useCallback(
    async (lead) => {
      // Ask for confirmation
      if (!window.confirm(`Are you sure you want to confirm deposit for ${lead.firstName} ${lead.lastName}?`)) {
        return;
      }

      try {
        const response = await api.put(`/leads/${lead._id}/confirm-deposit`);

        // Update local state instantly
        const updatedLeadData = {
          depositConfirmed: true,
          depositConfirmedBy: response.data.data?.depositConfirmedBy || user,
          depositConfirmedAt: new Date().toISOString(),
        };

        setAssignedLeadsModal((prev) => ({
          ...prev,
          leads: prev.leads.map((l) =>
            l._id === lead._id ? { ...l, ...updatedLeadData } : l
          ),
        }));

        // Also update preview modal if open
        setLeadsPreviewModal((prev) => ({
          ...prev,
          leads: prev.leads.map((l) =>
            l._id === lead._id ? { ...l, ...updatedLeadData } : l
          ),
        }));

        setNotification({
          message: "Deposit confirmed successfully",
          severity: "success",
        });

        // Refresh the orders in background
        fetchOrders();
      } catch (err) {
        console.error("Error confirming deposit:", err);
        setNotification({
          message: err.response?.data?.message || "Failed to confirm deposit",
          severity: "error",
        });
      }
    },
    [fetchOrders, user]
  );

  // Unconfirm Deposit Handler (admin only)
  const handleUnconfirmDeposit = useCallback(
    async (lead) => {
      // Ask for confirmation
      if (!window.confirm(`Are you sure you want to unconfirm deposit for ${lead.firstName} ${lead.lastName}?`)) {
        return;
      }

      try {
        await api.put(`/leads/${lead._id}/unconfirm-deposit`);

        // Update local state instantly
        const updatedLeadData = {
          depositConfirmed: false,
          depositConfirmedBy: null,
          depositConfirmedAt: null,
        };

        setAssignedLeadsModal((prev) => ({
          ...prev,
          leads: prev.leads.map((l) =>
            l._id === lead._id ? { ...l, ...updatedLeadData } : l
          ),
        }));

        // Also update preview modal if open
        setLeadsPreviewModal((prev) => ({
          ...prev,
          leads: prev.leads.map((l) =>
            l._id === lead._id ? { ...l, ...updatedLeadData } : l
          ),
        }));

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
    [fetchOrders]
  );

  // Mark as Shaved Handler - opens the dialog
  const handleMarkAsShaved = useCallback((lead) => {
    setMarkShavedDialog({
      open: true,
      lead: lead,
      loading: false,
    });
  }, []);

  // Confirm Mark as Shaved Handler - called when dialog is confirmed
  const handleConfirmMarkAsShaved = useCallback(
    async (refundsManagerId) => {
      const lead = markShavedDialog.lead;
      if (!lead) return;

      setMarkShavedDialog((prev) => ({ ...prev, loading: true }));

      try {
        const response = await api.put(`/leads/${lead._id}/mark-shaved`, {
          refundsManagerId,
        });

        // Update local state instantly
        const updatedLeadData = {
          shaved: true,
          shavedBy: response.data.data?.shavedBy || user,
          shavedAt: new Date().toISOString(),
          shavedRefundsManager: response.data.data?.shavedRefundsManager,
          shavedManagerAssignedBy: response.data.data?.shavedManagerAssignedBy || user,
          shavedManagerAssignedAt: new Date().toISOString(),
        };

        setAssignedLeadsModal((prev) => ({
          ...prev,
          leads: prev.leads.map((l) =>
            l._id === lead._id ? { ...l, ...updatedLeadData } : l
          ),
        }));

        setLeadsPreviewModal((prev) => ({
          ...prev,
          leads: prev.leads.map((l) =>
            l._id === lead._id ? { ...l, ...updatedLeadData } : l
          ),
        }));

        setNotification({
          message: "Lead marked as shaved successfully",
          severity: "success",
        });

        // Close dialog
        setMarkShavedDialog({ open: false, lead: null, loading: false });

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
    [markShavedDialog.lead, fetchOrders, user]
  );

  // Unmark as Shaved Handler (admin only)
  const handleUnmarkAsShaved = useCallback(
    async (lead) => {
      if (!window.confirm(`Are you sure you want to unmark ${lead.firstName} ${lead.lastName} as shaved?`)) {
        return;
      }

      try {
        await api.put(`/leads/${lead._id}/unmark-shaved`);

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

        setLeadsPreviewModal((prev) => ({
          ...prev,
          leads: prev.leads.map((l) =>
            l._id === lead._id ? { ...l, ...updatedLeadData } : l
          ),
        }));

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
    [fetchOrders]
  );

  // Close Mark Shaved Dialog
  const handleCloseMarkShavedDialog = useCallback(() => {
    setMarkShavedDialog({ open: false, lead: null, loading: false });
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
                  <TableCell colSpan={9} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
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

                            {(user?.role === "admin" ||
                              user?.role === "affiliate_manager") && (
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteOrderClick(
                                    order._id,
                                    order.status
                                  );
                                }}
                                title={
                                  order.status === "cancelled"
                                    ? "Permanently Delete Order"
                                    : "Cancel Order"
                                }
                                color="error"
                                sx={{
                                  "&:hover": {
                                    backgroundColor: "error.light",
                                    color: "error.contrastText",
                                  },
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                      {}
                      <TableRow>
                        <TableCell
                          sx={{ p: 0, borderBottom: "none" }}
                          colSpan={9}
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
                                            👤 Account Manager
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
                      <Typography
                        variant="subtitle2"
                        sx={{ mb: 1, fontWeight: 600 }}
                      >
                        Found Leads ({manualLeads.length})
                      </Typography>
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
                              <TableRow key={entry.lead._id}>
                                <TableCell>
                                  <Typography
                                    variant="body2"
                                    sx={{ fontSize: "0.75rem" }}
                                  >
                                    {entry.lead.newEmail}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  {entry.lead.firstName} {entry.lead.lastName}
                                </TableCell>
                                <TableCell>{entry.lead.country}</TableCell>
                                <TableCell>
                                  <Chip
                                    label={entry.lead.leadType?.toUpperCase()}
                                    size="small"
                                    color={
                                      entry.lead.leadType === "ftd"
                                        ? "success"
                                        : entry.lead.leadType === "filler"
                                        ? "warning"
                                        : "default"
                                    }
                                  />
                                </TableCell>
                                <TableCell>
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
                                      error={!entry.agent}
                                    >
                                      <MenuItem value="">
                                        <em>Select Agent</em>
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
                        * All leads must have an agent assigned before creating
                        the order
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
              <LeadQuickView
                lead={hoveredLead}
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
              filteredLeads[assignedLeadsModal.currentIndex] && (
                <LeadQuickView
                  lead={filteredLeads[assignedLeadsModal.currentIndex]}
                  onLeadUpdate={
                    user?.role !== "lead_manager" ? handleLeadUpdate : undefined
                  }
                  readOnly={user?.role === "lead_manager"}
                  onMarkAsShaved={
                    user?.role !== "lead_manager"
                      ? handleMarkAsShaved
                      : undefined
                  }
                  onUnmarkAsShaved={
                    user?.role === "admin"
                      ? handleUnmarkAsShaved
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
              )
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
            <IconButton
              aria-label="close"
              onClick={handleCloseLeadsPreviewModal}
              size="small"
            >
              <CloseIcon />
            </IconButton>
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
                  leadsPreviewModal.leads.map((lead, index) => {
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

                    return (
                      <TableRow
                        key={lead._id || index}
                        hover
                        sx={{ "& td": { py: 0.5 } }}
                      >
                        {/* Name */}
                        <TableCell sx={{ py: 0.5, px: 1 }}>
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
                            {lead.depositConfirmed && (
                              <Chip
                                label="Deposit Confirmed"
                                size="small"
                                color="success"
                                sx={{
                                  height: 18,
                                  fontSize: "0.6rem",
                                  "& .MuiChip-label": {
                                    padding: "0 4px",
                                  },
                                }}
                              />
                            )}
                            {lead.shaved && (
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
                            {!lead.depositConfirmed && !lead.shaved && (
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
                          <Typography
                            variant="body2"
                            sx={{ whiteSpace: "nowrap", fontSize: "0.75rem" }}
                          >
                            {lead.newPhone || lead.phone || "-"}
                          </Typography>
                        </TableCell>
                        {/* Email */}
                        <TableCell sx={{ py: 0.5, px: 1 }}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontSize: "0.7rem",
                              maxWidth: 180,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {lead.newEmail || lead.email || "-"}
                          </Typography>
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
                              {lead.assignedClientBrokers?.[0]?.name ||
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
                            <MoreVertIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </TableCell>
                      </TableRow>
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

                {/* Delete - Admin only */}
                {user.role === "admin" && (
                  <>
                    <Divider />
                    <MenuItem
                      onClick={() => {
                        handleCancelLead(lead._id);
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
                )}
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
