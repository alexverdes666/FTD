import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSelector } from "react-redux";
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
} from "@mui/material";
import {
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
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
} from "@mui/icons-material";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import api from "../services/api";
import { selectUser } from "../store/slices/authSlice";
import { getSortedCountries } from "../constants/countries";
import LeadDetailCard from "../components/LeadDetailCard";
import ChangeFTDDialog from "../components/ChangeFTDDialog";
import AssignLeadToAgentDialog from "../components/AssignLeadToAgentDialog";
import SessionAccessButton from "../components/SessionAccessButton";
import SessionStatusChip from "../components/SessionStatusChip";
import AssignToRefundsManagerModal from "../components/AssignToRefundsManagerModal";
import { refundsService } from "../services/refunds";
import CommentButton from "../components/CommentButton";
import ClientBrokerManagementDialog from "../components/ClientBrokerManagementDialog";
import GenderFallbackModal from "../components/GenderFallbackModal";

const createOrderSchema = (userRole) => {
  return yup
    .object({
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
      countryFilter: yup
        .string()
        .required("Country filter is required")
        .min(2, "Country must be at least 2 characters")
        .default(""),
      genderFilter: yup.string().oneOf(["", "male", "female"]).default(""),
      priority: yup.string().oneOf(["low", "medium", "high"]).default("medium"),
      notes: yup.string().default(""),
      selectedClientNetwork:
        userRole === "admin" || userRole === "affiliate_manager"
          ? yup.string().required("Client Network selection is required").default("")
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
        .test(
          "not-same-day",
          "Cannot create order for the same day",
          (value) => {
            // Admin users can bypass same-day restriction
            if (userRole === 'admin') return true;

            if (!value) return false;
            const today = new Date();
            const plannedDay = new Date(value);
            today.setHours(0, 0, 0, 0);
            plannedDay.setHours(0, 0, 0, 0);
            return plannedDay.getTime() !== today.getTime();
          }
        )
        .test(
          "not-tomorrow-after-7pm",
          "Cannot create order for tomorrow after 7:00 PM today",
          (value) => {
            // Admin users can bypass time restriction
            if (userRole === 'admin') return true;

            if (!value) return false;
            const now = new Date();
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const plannedDay = new Date(value);
            plannedDay.setHours(0, 0, 0, 0);

            // If planning for tomorrow and current time is after 7 PM
            if (plannedDay.getTime() === tomorrow.getTime() && now.getHours() >= 19) {
              return false;
            }
            return true;
          }
        )
        .test(
          "not-past-date",
          "Cannot create order for past dates",
          (value) => {
            if (!value) return false;
            const today = new Date();
            const plannedDay = new Date(value);
            today.setHours(0, 0, 0, 0);
            plannedDay.setHours(0, 0, 0, 0);
            return plannedDay >= today;
          }
        )
        .default(() => {
          // Default to tomorrow if before 7 PM today (or if admin), otherwise day after tomorrow
          const now = new Date();
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          if (userRole === 'admin' || now.getHours() < 19) {
            return tomorrow;
          } else {
            const dayAfterTomorrow = new Date();
            dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
            return dayAfterTomorrow;
          }
        }),
    })
    .test(
      "at-least-one",
      "At least one lead type must be requested",
      (value) => {
        return (
          (value.ftd || 0) +
            (value.filler || 0) +
            (value.cold || 0) >
          0
        );
      }
    );
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
  if (leadType !== 'ftd' && leadType !== 'filler') {
    return null; // Not an FTD/Filler lead
  }
  
  if (!lead.lastUsedInOrder) {
    return null; // Never used, no cooldown
  }
  
  const lastUsedDate = new Date(lead.lastUsedInOrder);
  const now = new Date();
  const daysSinceUsed = Math.floor((now - lastUsedDate) / (1000 * 60 * 60 * 24));
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
  const [unassignedLeadsStats, setUnassignedLeadsStats] = useState({ ftd: null, filler: null });
  const [genderFallbackModalOpen, setGenderFallbackModalOpen] = useState(false);
  const [pendingOrderData, setPendingOrderData] = useState(null);
  const [insufficientAgentLeads, setInsufficientAgentLeads] = useState(null);
  const [clientBrokerManagementOpen, setClientBrokerManagementOpen] = useState(false);
  const [selectedOrderForManagement, setSelectedOrderForManagement] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalOrders, setTotalOrders] = useState(0);
  const [filters, setFilters] = useState({
    status: "",
    priority: "",
    startDate: "",
    endDate: "",
  });
  const debouncedFilters = useDebounce(filters, 500);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedRowData, setExpandedRowData] = useState({});
  const [expandedLeads, setExpandedLeads] = useState({});
  const [refundAssignmentStatus, setRefundAssignmentStatus] = useState({});
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

  // Delete Order Confirmation State
  const [deleteOrderDialog, setDeleteOrderDialog] = useState({
    open: false,
    orderId: null,
    orderStatus: null,
    permanentDelete: false,
    loading: false,
  });

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
      const response = await api.get("/client-networks?isActive=true&limit=1000");
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
      const response = await api.get("/client-brokers?isActive=true&limit=1000");
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
  const fetchFilteredAgents = useCallback(async (leadType, country, clientNetwork, clientBrokers = []) => {
    if (!leadType || !country || !clientNetwork) {
      return;
    }
    
    setFilteredAgentsLoading(true);
    try {
      const response = await api.post("/users/agents-with-filtered-lead-stats", {
        leadType,
        country,
        clientNetwork,
        clientBrokers,
      });
      
      setFilteredAgents(response.data.data || []);
      
      // Store unassigned leads stats by lead type
      setUnassignedLeadsStats(prev => ({
        ...prev,
        [leadType]: response.data.unassignedLeads || null,
      }));
      
      return response.data;
    } catch (err) {
      console.error("Failed to fetch filtered agents:", err);
      setNotification({
        message: err.response?.data?.message || "Failed to load agents with matching leads",
        severity: "warning",
      });
      return null;
    } finally {
      setFilteredAgentsLoading(false);
    }
  }, []);

  const onSubmitOrder = useCallback(
    async (data) => {
      try {
        // Build agentAssignments array from ftdAgents and fillerAgents
        const agentAssignments = [];

        if (data.ftdAgents && data.ftdAgents.length > 0) {
          data.ftdAgents.forEach((agentId, index) => {
            if (agentId) { // Only add if agent is selected
              agentAssignments.push({
                leadType: 'ftd',
                agentId: agentId,
                index: index
              });
            }
          });
        }

        if (data.fillerAgents && data.fillerAgents.length > 0) {
          data.fillerAgents.forEach((agentId, index) => {
            if (agentId) { // Only add if agent is selected
              agentAssignments.push({
                leadType: 'filler',
                agentId: agentId,
                index: index
              });
            }
          });
        }

        const orderData = {
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
        const response = await api.post("/orders", orderData);

        // Check if any individual agent assignments were insufficient
        if (response.data.agentAssignmentInsufficient && response.data.agentAssignmentInsufficient.length > 0) {
          // Order was created but some assignments couldn't be fulfilled even with filters
          // Just show a warning, don't ask for more input as it would create a duplicate order
          setNotification({
            message: response.data.message || "Order created with warning - some agent assignments could not be fully fulfilled",
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
        if (err.response?.data?.requiresGenderSelection && err.response?.data?.agentAssignmentInsufficient) {
          // Store the order data and show modal to ask for gender selection
          setPendingOrderData(data);
          setInsufficientAgentLeads(err.response.data.agentAssignmentInsufficient);
          setGenderFallbackModalOpen(true);
          setNotification({
            message: err.response.data.message || "Agent has insufficient assigned leads - please select a gender to allow fallback to unassigned leads",
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
    [reset, fetchOrders]
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
    // Fetch all required data for the form
    fetchClientNetworks();
    fetchOurNetworks();
    fetchCampaigns();
    fetchClientBrokers();
  }, [fetchClientNetworks, fetchOurNetworks, fetchCampaigns, fetchClientBrokers]);

  const handleGenderFallbackSelect = useCallback(async (genderSelection) => {
    if (!pendingOrderData) return;

    try {
      // Check if we're using per-assignment genders (array) or single gender (string)
      const isPerAssignment = Array.isArray(genderSelection);

      // Rebuild agentAssignments array from pendingOrderData
      let agentAssignments = [];

      // ALWAYS rebuild ALL agent assignments from pendingOrderData first
      if (pendingOrderData.ftdAgents && pendingOrderData.ftdAgents.length > 0) {
        pendingOrderData.ftdAgents.forEach((agentId, index) => {
          if (agentId) {
            agentAssignments.push({
              leadType: 'ftd',
              agentId: agentId,
              index: index
            });
          }
        });
      }

      if (pendingOrderData.fillerAgents && pendingOrderData.fillerAgents.length > 0) {
        pendingOrderData.fillerAgents.forEach((agentId, index) => {
          if (agentId) {
            agentAssignments.push({
              leadType: 'filler',
              agentId: agentId,
              index: index
            });
          }
        });
      }

      // If per-assignment genders, merge the gender selections into the assignments
      if (isPerAssignment) {
        // Create a map of gender selections by leadType and index
        const genderMap = new Map();
        genderSelection.forEach(gs => {
          const key = `${gs.leadType}-${gs.index}`;
          genderMap.set(key, gs.gender);
        });

        // Add gender to matching assignments
        agentAssignments = agentAssignments.map(assignment => {
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
          ? `Order created successfully with ${genderSelection.length} gender fallback(s) and ${agentAssignments.length - genderSelection.length} agent-assigned lead(s)!`
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
        message: err.response?.data?.message || "Failed to create order with gender filter",
        severity: "error",
      });
    }
  }, [pendingOrderData, reset, fetchOrders]);

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
        const response = await api.get(`/orders/${selectedOrderForManagement._id}`);
        const updatedOrder = response.data.data;

        // Update expandedRowData if it exists
        setExpandedRowData((prev) => {
          if (prev[updatedOrder._id]) {
            return {
              ...prev,
              [updatedOrder._id]: updatedOrder
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
  const toggleLeadExpansion = useCallback((leadId) => {
    setExpandedLeads((prev) => ({
      ...prev,
      [leadId]: !prev[leadId],
    }));
  }, []);
  const expandAllLeads = useCallback((leads) => {
    const expandedState = {};
    leads.forEach((lead) => {
      expandedState[lead._id] = true;
    });
    setExpandedLeads((prev) => ({ ...prev, ...expandedState }));
  }, []);
  const collapseAllLeads = useCallback((leads) => {
    const collapsedState = {};
    leads.forEach((lead) => {
      collapsedState[lead._id] = false;
    });
    setExpandedLeads((prev) => ({ ...prev, ...collapsedState }));
  }, []);
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

  const handleDeleteOrderClick = useCallback((orderId, orderStatus) => {
    const isCancelled = orderStatus === 'cancelled';
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

    setDeleteOrderDialog(prev => ({ ...prev, loading: true }));

    try {
      if (deleteOrderDialog.permanentDelete) {
        // Permanent deletion - completely removes the order from database
        await api.delete(`/orders/${deleteOrderDialog.orderId}/permanent`);

        setNotification({
          message: "Order permanently deleted. All leads have been released back to the database.",
          severity: "success",
        });
      } else {
        // Cancel order - just marks as cancelled
        await api.delete(`/orders/${deleteOrderDialog.orderId}`, {
          data: { reason: 'Cancelled by admin' }
        });

        setNotification({
          message: "Order cancelled successfully. Networks and campaigns have been unassigned.",
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
      setDeleteOrderDialog(prev => ({ ...prev, loading: false }));
    }
  }, [deleteOrderDialog.orderId, deleteOrderDialog.permanentDelete, fetchOrders]);

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
      const response = await refundsService.getOrderRefundAssignmentStatus(orderId);
      setRefundAssignmentStatus(prev => ({
        ...prev,
        [orderId]: response.data
      }));
    } catch (err) {
      console.error('Failed to fetch refund assignment status:', err);
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
        setRefundAssignmentStatus(prev => {
          const { [orderId]: removedStatus, ...restStatus } = prev;
          return restStatus;
        });
      } else {
        try {
          // First, load lightweight order data for fast expansion
          const lightweightResponse = await api.get(`/orders/${orderId}?lightweight=true`);
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

  const handleCancelLead = useCallback(
    async (orderId, leadId, leadName) => {
      try {
        const confirmed = window.confirm(
          `Are you sure you want to cancel lead "${leadName}" from this order? This will return the lead to the database as unused.`
        );

        if (!confirmed) return;

        await api.delete(`/orders/${orderId}/leads/${leadId}`);
        setNotification({
          message: `Lead "${leadName}" has been cancelled from the order and returned to the database as unused`,
          severity: "success",
        });

        // Refresh the expanded order data
        if (expandedRowData[orderId]) {
          try {
            const response = await api.get(`/orders/${orderId}`);
            setExpandedRowData((prev) => ({
              ...prev,
              [orderId]: response.data.data,
            }));
            // Also refresh refund assignment status
            fetchRefundAssignmentStatus(orderId);
          } catch (err) {
            console.error("Failed to refresh order data:", err);
          }
        }

        fetchOrders();
      } catch (err) {
        setNotification({
          message: err.response?.data?.message || "Failed to cancel lead",
          severity: "error",
        });
      }
    },
    [fetchOrders, expandedRowData]
  );



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
  }, [fetchOrders, refundsAssignmentDialog.orderId, fetchRefundAssignmentStatus]);

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
        const response = await api.put(`/client-brokers/${brokerId}`, brokerData);

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
    if (lead.leadType !== 'ftd') {
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

  const handleChangeFTDSuccess = useCallback(async (changeData) => {
    // Determine if it was a filler based on order metadata
    const leadMetadata = changeFTDDialog.order?.leadsMetadata?.find(m => m.leadId?.toString() === changeData.oldLead.id?.toString());
    const isFillerOrder = leadMetadata?.orderedAs === 'filler';
    const leadLabel = isFillerOrder ? 'Filler' : 'FTD';

    setNotification({
      message: `${leadLabel} lead successfully changed from ${changeData.oldLead.firstName} ${changeData.oldLead.lastName} to ${changeData.newLead.firstName} ${changeData.newLead.lastName}`,
      severity: "success",
    });

    // Refresh the orders and expanded order data
    await fetchOrders();
    if (changeFTDDialog.order && expandedRowData[changeFTDDialog.order._id]) {
      toggleRowExpansion(changeFTDDialog.order._id);
    }
  }, [changeFTDDialog.order, expandedRowData, fetchOrders, toggleRowExpansion]);

  // Convert lead type between FTD and Filler
  const handleConvertLeadType = useCallback(async (order, lead) => {
    if (lead.leadType !== 'ftd') {
      setNotification({
        message: "Only FTD/Filler leads can be converted",
        severity: "warning",
      });
      return;
    }

    const leadMetadata = order.leadsMetadata?.find(m => m.leadId?.toString() === lead._id?.toString());
    const currentType = leadMetadata?.orderedAs || 'ftd';
    const newType = currentType === 'ftd' ? 'filler' : 'ftd';

    try {
      const response = await api.post(`/orders/${order._id}/leads/${lead._id}/convert-lead-type`);
      
      if (response.data.success) {
        setNotification({
          message: `Lead ${lead.firstName} ${lead.lastName} converted from ${currentType.toUpperCase()} to ${newType.toUpperCase()}`,
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
  }, [fetchOrders, expandedRowData, toggleRowExpansion]);

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

  const handleAssignLeadSuccess = useCallback(async (assignmentData) => {
    setNotification({
      message: `Lead ${assignmentData.leadId.slice(-8)} successfully assigned to ${assignmentData.agentName}`,
      severity: "success",
    });

    // Refresh the orders and expanded order data
    await fetchOrders();

    // Refresh expanded order data if it exists
    if (assignLeadDialog.lead && expandedRowData) {
      const orderId = Object.keys(expandedRowData).find(id =>
        expandedRowData[id].leads?.some(lead => lead._id === assignmentData.leadId)
      );
      if (orderId) {
        toggleRowExpansion(orderId);
      }
    }
  }, [assignLeadDialog.lead, expandedRowData, fetchOrders, toggleRowExpansion]);

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
    <Box sx={{ p: isSmallScreen ? 2 : 3 }}>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        flexDirection={isSmallScreen ? "column" : "row"}
        sx={{ mb: 3, alignItems: isSmallScreen ? "flex-start" : "center" }}
      >
        <Typography
          variant={isSmallScreen ? "h5" : "h4"}
          gutterBottom
          sx={{ mb: isSmallScreen ? 2 : 0 }}
        >
          Orders
        </Typography>
        {(user?.role === "admin" || user?.role === "affiliate_manager") && (
          <Box
            sx={{
              display: "flex",
              gap: 1,
              flexDirection: isSmallScreen ? "column" : "row",
              width: isSmallScreen ? "100%" : "auto",
            }}
          >
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenCreateDialog}
              size={isSmallScreen ? "small" : "medium"}
              sx={{ width: isSmallScreen ? "100%" : "auto" }}
            >
              Create Order
            </Button>
            {user?.role === "admin" && (
              <Button
                variant="outlined"
                startIcon={<BusinessIcon />}
                onClick={handleManageBrokers}
                size={isSmallScreen ? "small" : "medium"}
                sx={{ width: isSmallScreen ? "100%" : "auto" }}
              >
                Manage Brokers
              </Button>
            )}
          </Box>
        )}
      </Box>
      {}
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
          >
            <Typography variant="h6">Filters</Typography>
            <IconButton onClick={() => setShowFilters(!showFilters)}>
              {showFilters ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
          <Collapse in={showFilters}>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={filters.status}
                    label="Status"
                    onChange={handleFilterChange("status")}
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="pending">Pending</MenuItem>
                    <MenuItem value="fulfilled">Fulfilled</MenuItem>
                    <MenuItem value="partial">Partial</MenuItem>
                    <MenuItem value="cancelled">Cancelled</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={filters.priority}
                    label="Priority"
                    onChange={handleFilterChange("priority")}
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
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
              <Grid item xs={12} sm={6} md={3}>
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
              <Grid item xs={12}>
                <Button onClick={clearFilters} variant="outlined" size="small">
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
          <Table size={isSmallScreen ? "small" : "medium"}>
            <TableHead>
              <TableRow>
                <TableCell>Order ID</TableCell>
                <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                  Requester
                </TableCell>
                <TableCell>Requests (F/Fi/C/L)</TableCell>
                <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                  Fulfilled (F/Fi/C/L)
                </TableCell>
                <TableCell>Status</TableCell>
                <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                  GEO
                </TableCell>
                <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                  Priority
                </TableCell>
                <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                  Created
                </TableCell>
                <TableCell>Actions</TableCell>
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
                      <TableRow hover>
                        <TableCell>{order._id.slice(-8)}</TableCell>
                        <TableCell
                          sx={{ display: { xs: "none", md: "table-cell" } }}
                        >
                          {order.requester?.fullName}
                        </TableCell>
                        <TableCell>{`${order.requests?.ftd || 0}/${
                          order.requests?.filler || 0
                        }/${order.requests?.cold || 0}`}</TableCell>
                        <TableCell
                          sx={{ display: { xs: "none", md: "table-cell" } }}
                        >{`${order.fulfilled?.ftd || 0}/${
                          order.fulfilled?.filler || 0
                        }/${order.fulfilled?.cold || 0}`}</TableCell>
                        <TableCell>
                          <Tooltip
                            title={
                              order.status === "cancelled" && order.cancellationReason
                                ? `Cancellation Details: ${order.cancellationReason.split(' | ').length > 1 ? order.cancellationReason.split(' | ').length + ' issues found' : order.cancellationReason}`
                                : order.status === "partial" && order.partialFulfillmentReason
                                ? `Partial Fulfillment: ${order.partialFulfillmentReason.split(' | ').length > 1 ? order.partialFulfillmentReason.split(' | ').length + ' lead types affected' : order.partialFulfillmentReason}`
                                : ""
                            }
                            placement="top"
                            arrow
                            componentsProps={{
                              tooltip: {
                                sx: {
                                  maxWidth: 400,
                                  fontSize: '0.875rem'
                                }
                              }
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
                          sx={{ display: { xs: "none", sm: "table-cell" } }}
                        >
                          {order.countryFilter || "Any"}
                        </TableCell>
                        <TableCell
                          sx={{ display: { xs: "none", sm: "table-cell" } }}
                        >
                          <Chip
                            label={order.priority}
                            color={getPriorityColor(order.priority)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell
                          sx={{ display: { xs: "none", sm: "table-cell" } }}
                        >
                          {new Date(order.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => handleExportLeads(order._id)}
                            title="Export Leads as CSV"
                          >
                            <DownloadIcon fontSize="small" />
                          </IconButton>

                          {(user?.role === "admin" || user?.role === "affiliate_manager") && (
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteOrderClick(order._id, order.status)}
                              title={order.status === 'cancelled' ? "Permanently Delete Order" : "Cancel Order"}
                              color="error"
                              sx={{
                                '&:hover': {
                                  backgroundColor: 'error.light',
                                  color: 'error.contrastText'
                                }
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          )}
                          <IconButton
                            size="small"
                            onClick={() => toggleRowExpansion(order._id)}
                            title={isExpanded ? "Collapse" : "Expand"}
                          >
                            {isExpanded ? (
                              <ExpandLessIcon />
                            ) : (
                              <ExpandMoreIcon />
                            )}
                          </IconButton>
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
                              <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, color: "primary.main" }}>
                                Order Details
                              </Typography>
                              {expandedDetails ? (
                                <Grid container spacing={2}>
                                  {/* Status Reason Alerts */}
                                  {(expandedDetails.status === "cancelled" && expandedDetails.cancellationReason) && (
                                    <Grid item xs={12}>
                                      <Alert severity="error" sx={{ borderRadius: 2 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                          Cancellation Reason:
                                        </Typography>
                                        {expandedDetails.cancellationReason.split(' | ').map((reason, index) => (
                                          <Typography key={index} variant="body2" sx={{ ml: 1 }}>
                                            • {reason}
                                          </Typography>
                                        ))}
                                      </Alert>
                                    </Grid>
                                  )}
                                  {(expandedDetails.status === "partial" && expandedDetails.partialFulfillmentReason) && (
                                    <Grid item xs={12}>
                                      <Alert severity="warning" sx={{ borderRadius: 2 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                          Partial Fulfillment Reason:
                                        </Typography>
                                        {expandedDetails.partialFulfillmentReason.split(' | ').map((reason, index) => (
                                          <Typography key={index} variant="body2" sx={{ ml: 1 }}>
                                            • {reason}
                                          </Typography>
                                        ))}
                                      </Alert>
                                    </Grid>
                                  )}

                                  {/* Detailed Information Row */}
                                  <Grid item xs={12} md={6}>
                                    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: 1, borderColor: "divider", height: "100%" }}>
                                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, color: "primary.main" }}>
                                        Account Manager
                                      </Typography>
                                      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                                        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                                          <Typography variant="body2" color="text.secondary">Name:</Typography>
                                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                            {expandedDetails.requester?.fullName || "N/A"}
                                          </Typography>
                                        </Box>
                                        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                                          <Typography variant="body2" color="text.secondary">Email:</Typography>
                                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                            {expandedDetails.requester?.email || "N/A"}
                                          </Typography>
                                        </Box>
                                        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                                          <Typography variant="body2" color="text.secondary">Role:</Typography>
                                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                            {expandedDetails.requester?.role || "N/A"}
                                          </Typography>
                                        </Box>
                                      </Box>
                                    </Paper>
                                  </Grid>

                                  <Grid item xs={12} md={6}>
                                    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: 1, borderColor: "divider", height: "100%" }}>
                                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, color: "primary.main" }}>
                                        Order Info & Filters
                                      </Typography>
                                      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                                        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                                          <Typography variant="body2" color="text.secondary">Created:</Typography>
                                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                            {new Date(expandedDetails.createdAt).toLocaleDateString()}
                                          </Typography>
                                        </Box>
                                        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                                          <Typography variant="body2" color="text.secondary">Country:</Typography>
                                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                            {expandedDetails.countryFilter || "Any"}
                                          </Typography>
                                        </Box>
                                        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                                          <Typography variant="body2" color="text.secondary">Gender:</Typography>
                                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                            {expandedDetails.genderFilter || "Any"}
                                          </Typography>
                                        </Box>
                                        {expandedDetails.notes && (
                                          <Box sx={{ mt: 0.5 }}>
                                            <Typography variant="body2" color="text.secondary">Notes:</Typography>
                                            <Typography variant="body2" sx={{ fontWeight: 500, mt: 0.5 }}>
                                              {expandedDetails.notes}
                                            </Typography>
                                          </Box>
                                        )}
                                      </Box>
                                    </Paper>
                                  </Grid>

                                  {/* Network Configuration */}
                                  <Grid item xs={12}>
                                    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: 1, borderColor: "divider" }}>
                                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, color: "primary.main" }}>
                                        Network Configuration
                                      </Typography>
                                      <Grid container spacing={2}>
                                        <Grid item xs={12} sm={6} md={3}>
                                          <Typography variant="caption" color="text.secondary">Campaign</Typography>
                                          <Typography variant="body2" sx={{ fontWeight: 500, mt: 0.5 }}>
                                            {expandedDetails.selectedCampaign?.name || "N/A"}
                                          </Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={6} md={3}>
                                          <Typography variant="caption" color="text.secondary">Our Network</Typography>
                                          <Typography variant="body2" sx={{ fontWeight: 500, mt: 0.5 }}>
                                            {expandedDetails.selectedOurNetwork?.name || "N/A"}
                                          </Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={6} md={3}>
                                          <Typography variant="caption" color="text.secondary">Client Network</Typography>
                                          <Typography variant="body2" sx={{ fontWeight: 500, mt: 0.5 }}>
                                            {expandedDetails.selectedClientNetwork?.name || "N/A"}
                                          </Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={6} md={3}>
                                          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                                            <Typography variant="caption" color="text.secondary">Client Brokers</Typography>
                                            <Button
                                              size="small"
                                              variant="outlined"
                                              onClick={() => handleOpenClientBrokerManagement(expandedDetails)}
                                              startIcon={<BusinessIcon />}
                                              sx={{ width: "fit-content" }}
                                            >
                                              Manage ({expandedDetails.leads?.filter(lead => lead.assignedClientBrokers?.length > 0).length || 0}/{expandedDetails.leads?.length || 0})
                                            </Button>
                                          </Box>
                                        </Grid>
                                      </Grid>
                                    </Paper>
                                  </Grid>

                                  {/* Show leads section if we have leads or are loading them */}
                                  {((expandedDetails.leads && expandedDetails.leads.length > 0) || expandedDetails.leadsLoading) && (
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
                                              <Typography variant="body2" color="text.secondary">
                                                Loading {expandedDetails.leadsCount || 0} leads...
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
                                            <Typography
                                              variant="subtitle1"
                                              sx={{ fontWeight: "bold" }}
                                            >
                                              Assigned Leads (
                                              {expandedDetails.leads.length})
                                            </Typography>
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
                                              {(user?.role === "admin" ||
                                                user?.role === "affiliate_manager" ||
                                                user?.role === "lead_manager") &&
                                                expandedDetails?.fulfilled?.ftd > 0 && (
                                                  <Tooltip
                                                    title={
                                                      refundAssignmentStatus[expandedDetails._id]?.isAssigned
                                                        ? `${refundAssignmentStatus[expandedDetails._id]?.assignmentCount || 0} FTD lead(s) already assigned`
                                                        : `Assign ${expandedDetails?.fulfilled?.ftd || 0} FTD lead(s) to refunds manager`
                                                    }
                                                  >
                                                    <Button
                                                      size="small"
                                                      variant={refundAssignmentStatus[expandedDetails._id]?.isAssigned ? "outlined" : "contained"}
                                                      color={refundAssignmentStatus[expandedDetails._id]?.isAssigned ? "success" : "primary"}
                                                      startIcon={refundAssignmentStatus[expandedDetails._id]?.isAssigned ? <CheckCircleIcon /> : <SendIcon />}
                                                      onClick={() =>
                                                        handleOpenRefundsAssignment(
                                                          expandedDetails._id
                                                        )
                                                      }
                                                      disabled={refundAssignmentStatus[expandedDetails._id]?.isAssigned}
                                                    >
                                                      {refundAssignmentStatus[expandedDetails._id]?.isAssigned
                                                        ? "Assigned to Refunds"
                                                        : "Assign to Refunds"
                                                      }
                                                    </Button>
                                                  </Tooltip>
                                                )}
                                              <Button
                                                size="small"
                                                onClick={() =>
                                                  expandAllLeads(
                                                    expandedDetails.leads
                                                  )
                                                }
                                                variant="outlined"
                                              >
                                                Expand All
                                              </Button>
                                              <Button
                                                size="small"
                                                onClick={() =>
                                                  collapseAllLeads(
                                                    expandedDetails.leads
                                                  )
                                                }
                                                variant="outlined"
                                              >
                                                Collapse All
                                              </Button>
                                            </Box>
                                          </Box>
                                          <TableContainer
                                            component={Paper}
                                            elevation={1}
                                            sx={{
                                              maxHeight: 400,
                                              borderRadius: 1,
                                            }}
                                          >
                                            <Table size="small">
                                              <TableHead>
                                                <TableRow
                                                  sx={{
                                                    bgcolor: "action.hover",
                                                  }}
                                                >
                                                  <TableCell
                                                    sx={{ fontWeight: "bold" }}
                                                  >
                                                    Type
                                                  </TableCell>
                                                  <TableCell
                                                    sx={{ fontWeight: "bold" }}
                                                  >
                                                    Name
                                                  </TableCell>
                                                  <TableCell
                                                    sx={{
                                                      display: {
                                                        xs: "none",
                                                        sm: "table-cell",
                                                      },
                                                      fontWeight: "bold",
                                                    }}
                                                  >
                                                    Country
                                                  </TableCell>
                                                  <TableCell
                                                    sx={{
                                                      display: {
                                                        xs: "none",
                                                        sm: "table-cell",
                                                      },
                                                      fontWeight: "bold",
                                                    }}
                                                  >
                                                    Email
                                                  </TableCell>
                                                  <TableCell
                                                    sx={{
                                                      display: {
                                                        xs: "none",
                                                        md: "table-cell",
                                                      },
                                                      fontWeight: "bold",
                                                    }}
                                                  >
                                                    Phone
                                                  </TableCell>
                                                  <TableCell
                                                    sx={{
                                                      display: {
                                                        xs: "none",
                                                        md: "table-cell",
                                                      },
                                                      fontWeight: "bold",
                                                    }}
                                                  >
                                                    Status
                                                  </TableCell>
                                                  <TableCell
                                                    sx={{ fontWeight: "bold" }}
                                                  >
                                                    Actions
                                                  </TableCell>
                                                </TableRow>
                                              </TableHead>
                                              <TableBody>
                                                {expandedDetails.leads.map(
                                                  (lead) => (
                                                    <React.Fragment
                                                      key={lead._id}
                                                    >
                                                      <TableRow>
                                                        <TableCell>
                                                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                                            <Chip
                                                              label={getDisplayLeadType(lead)?.toUpperCase() || "UNKNOWN"}
                                                              size="small"
                                                            />
                                                            {(() => {
                                                              const cooldownStatus = getFTDCooldownStatus(lead);
                                                              if (cooldownStatus?.inCooldown) {
                                                                return (
                                                                  <Tooltip title={`Last used on ${cooldownStatus.lastUsedDate.toLocaleDateString()}. FTD leads cannot be reused for 10 days.`}>
                                                                    <Chip
                                                                      label={`Cooldown: ${cooldownStatus.daysRemaining}d`}
                                                                      size="small"
                                                                      color="warning"
                                                                      variant="outlined"
                                                                    />
                                                                  </Tooltip>
                                                                );
                                                              }
                                                              return null;
                                                            })()}
                                                          </Box>
                                                        </TableCell>
                                                        <TableCell>
                                                          <Box>
                                                            <Typography variant="body2">
                                                              {lead.firstName}{" "}
                                                              {lead.lastName}
                                                            </Typography>
                                                            {lead.assignedAgent && (
                                                              <Chip
                                                                icon={<PersonIcon />}
                                                                label={
                                                                  typeof lead.assignedAgent === 'object' && lead.assignedAgent.fullName
                                                                    ? `Agent: ${lead.assignedAgent.fullName}`
                                                                    : "Assigned to Agent"
                                                                }
                                                                size="small"
                                                                color="success"
                                                                variant="outlined"
                                                                sx={{ mt: 0.5 }}
                                                                title={
                                                                  typeof lead.assignedAgent === 'object' && lead.assignedAgent.email
                                                                    ? lead.assignedAgent.email
                                                                    : undefined
                                                                }
                                                              />
                                                            )}
                                                          </Box>
                                                        </TableCell>
                                                        <TableCell
                                                          sx={{
                                                            display: {
                                                              xs: "none",
                                                              sm: "table-cell",
                                                            },
                                                          }}
                                                        >
                                                          {lead.country}
                                                        </TableCell>
                                                        <TableCell
                                                          sx={{
                                                            display: {
                                                              xs: "none",
                                                              sm: "table-cell",
                                                            },
                                                          }}
                                                        >
                                                          {lead.newEmail}
                                                        </TableCell>
                                                        <TableCell
                                                          sx={{
                                                            display: {
                                                              xs: "none",
                                                              md: "table-cell",
                                                            },
                                                          }}
                                                        >
                                                          {lead.newPhone || "N/A"}
                                                        </TableCell>
                                                        <TableCell
                                                          sx={{
                                                            display: {
                                                              xs: "none",
                                                              md: "table-cell",
                                                            },
                                                          }}
                                                        >
                                                          {(() => {
                                                            const networkHistory =
                                                              lead.clientNetworkHistory?.find(
                                                                (history) =>
                                                                  history.orderId?.toString() ===
                                                                  order._id.toString()
                                                              );
                                                            return null;
                                                            })()}
                                                          {/* Cancel lead button for admin and affiliate managers */}
                                                          {(user?.role === "admin" || user?.role === "affiliate_manager") && (
                                                            <>
                                                              <IconButton
                                                                size="small"
                                                                onClick={() =>
                                                                  handleCancelLead(
                                                                    order._id,
                                                                    lead._id,
                                                                    `${lead.firstName} ${lead.lastName}`
                                                                  )
                                                                }
                                                                title={`Cancel lead ${lead.firstName} ${lead.lastName} from this order`}
                                                                color="error"
                                                                sx={{ ml: 1 }}
                                                              >
                                                                <DeleteIcon fontSize="small" />
                                                              </IconButton>
                                                              {/* Change FTD/Filler button - for FTD leads (includes fillers) */}
                                                              {lead.leadType === 'ftd' && (() => {
                                                                const leadMetadata = order.leadsMetadata?.find(m => m.leadId?.toString() === lead._id?.toString());
                                                                const isFillerOrder = leadMetadata?.orderedAs === 'filler';
                                                                const leadLabel = isFillerOrder ? 'Filler' : 'FTD';
                                                                const convertToLabel = isFillerOrder ? 'FTD' : 'Filler';
                                                                return (
                                                                  <>
                                                                    <IconButton
                                                                      size="small"
                                                                      onClick={() =>
                                                                        handleOpenChangeFTDDialog(order, lead)
                                                                      }
                                                                      title={`Change ${leadLabel} lead ${lead.firstName} ${lead.lastName}`}
                                                                      color="primary"
                                                                      sx={{ ml: 1 }}
                                                                    >
                                                                      <SwapIcon fontSize="small" />
                                                                    </IconButton>
                                                                    <IconButton
                                                                      size="small"
                                                                      onClick={() =>
                                                                        handleConvertLeadType(order, lead)
                                                                      }
                                                                      title={`Convert to ${convertToLabel}`}
                                                                      color="secondary"
                                                                      sx={{ ml: 0.5 }}
                                                                    >
                                                                      <ConvertIcon fontSize="small" />
                                                                    </IconButton>
                                                                  </>
                                                                );
                                                              })()}
                                                              {/* Assign to Agent button - only if not already assigned */}
                                                              {!lead.assignedAgent && (
                                                                <IconButton
                                                                  size="small"
                                                                  onClick={() =>
                                                                    handleOpenAssignLeadDialog(lead)
                                                                  }
                                                                  title={`Assign ${lead.firstName} ${lead.lastName} to agent`}
                                                                  color="success"
                                                                  sx={{ ml: 1 }}
                                                                >
                                                                  <AssignIcon fontSize="small" />
                                                                </IconButton>
                                                              )}
                                                            </>
                                                          )}
                                                        </TableCell>
                                                        <TableCell>
                                                          <IconButton
                                                            size="small"
                                                            onClick={() =>
                                                              toggleLeadExpansion(
                                                                lead._id
                                                              )
                                                            }
                                                            aria-label={
                                                              expandedLeads[
                                                                lead._id
                                                              ]
                                                                ? "collapse"
                                                                : "expand"
                                                            }
                                                          >
                                                            {expandedLeads[
                                                              lead._id
                                                            ] ? (
                                                              <ExpandLessIcon />
                                                            ) : (
                                                              <ExpandMoreIcon />
                                                            )}
                                                          </IconButton>
                                                          {}
                                                          {(lead.leadType ===
                                                            "ftd" ||
                                                            lead.leadType ===
                                                              "filler") &&
                                                            (user?.role ===
                                                              "admin" ||
                                                              user?.role ===
                                                                "affiliate_manager") &&
                                                            (() => {
                                                              const networkHistory =
                                                                lead.clientNetworkHistory?.find(
                                                                  (history) =>
                                                                    history.orderId?.toString() ===
                                                                    order._id.toString()
                                                                );
                                                              return null;
                                                            })()}
                                                        </TableCell>
                                                      </TableRow>
                                                      {expandedLeads[
                                                        lead._id
                                                      ] && (
                                                        <TableRow>
                                                          <TableCell
                                                            colSpan={7}
                                                            sx={{
                                                              py: 0,
                                                              border: 0,
                                                            }}
                                                          >
                                                            <Collapse
                                                              in={
                                                                expandedLeads[
                                                                  lead._id
                                                                ]
                                                              }
                                                              timeout="auto"
                                                              unmountOnExit
                                                            >
                                                              <Box
                                                                sx={{ p: 2 }}
                                                              >
                                                                <LeadDetailCard
                                                                  lead={lead}
                                                                  onLeadUpdate={(updatedLead) => {
                                                                    // Update the expanded details
                                                                    setExpandedRowData((prev) => ({
                                                                      ...prev,
                                                                      [expandedDetails._id]: {
                                                                        ...prev[expandedDetails._id],
                                                                        leads: prev[expandedDetails._id].leads.map(l =>
                                                                          l._id === updatedLead._id ? updatedLead : l
                                                                        )
                                                                      }
                                                                    }));
                                                                    fetchOrders(); // Refresh main orders list
                                                                  }}
                                                                />
                                                              </Box>
                                                            </Collapse>
                                                          </TableCell>
                                                        </TableRow>
                                                      )}
                                                    </React.Fragment>
                                                  )
                                                )}
                                              </TableBody>
                                            </Table>
                                          </TableContainer>
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
          rowsPerPageOptions={[5, 10, 25]}
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
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Create New Order</DialogTitle>
        <form onSubmit={handleSubmit(onSubmitOrder)}>
          <DialogContent>
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
                    />
                  )}
                />
              </Grid>
              {/* Priority and Gender */}
              <Grid item xs={12} sm={6}>
                <Controller
                  name="priority"
                  control={control}
                  render={({ field }) => (
                    <FormControl
                      fullWidth
                      size="small"
                      error={!!errors.priority}
                    >
                      <InputLabel>Priority</InputLabel>
                      <Select {...field} label="Priority" value={field.value || ""}>
                        <MenuItem value="low">Low</MenuItem>
                        <MenuItem value="medium">Medium</MenuItem>
                        <MenuItem value="high">High</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="genderFilter"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth size="small" error={!!errors.genderFilter}>
                      <InputLabel>Gender (Optional)</InputLabel>
                      <Select {...field} label="Gender (Optional)" value={field.value || ""}>
                        <MenuItem value="">All</MenuItem>
                        <MenuItem value="male">Male</MenuItem>
                        <MenuItem value="female">Female</MenuItem>
                        <MenuItem value="not_defined">Not Defined</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>

              {/* Country Filter */}
              <Grid item xs={12}>
                <Controller
                  name="countryFilter"
                  control={control}
                  render={({ field }) => (
                    <FormControl
                      fullWidth
                      size="small"
                      error={!!errors.countryFilter}
                    >
                      <InputLabel>Country Filter *</InputLabel>
                      <Select
                        {...field}
                        label="Country Filter *"
                        value={field.value || ""}
                      >
                        {getSortedCountries().map((country) => (
                          <MenuItem key={country.code} value={country.name}>
                            {country.name}
                          </MenuItem>
                        ))}
                      </Select>
                      {errors.countryFilter?.message && (
                        <Typography
                          variant="caption"
                          color="error"
                          sx={{ mt: 0.5, ml: 1.5 }}
                        >
                          {errors.countryFilter.message}
                        </Typography>
                      )}
                    </FormControl>
                  )}
                />
              </Grid>

              {/* Client Network Selection */}
              {(user?.role === "admin" || user?.role === "affiliate_manager") && (
                <Grid item xs={12}>
                  <Controller
                    name="selectedClientNetwork"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <Box>
                        <Autocomplete
                          options={clientNetworks}
                          getOptionLabel={(option) => option.name || ""}
                          value={clientNetworks.find(n => n._id === value) || null}
                          onChange={(event, newValue) => {
                            onChange(newValue ? newValue._id : "");
                            // Reset filtered agents when client network changes
                            setFilteredAgents([]);
                            setUnassignedLeadsStats({ ftd: null, filler: null });
                          }}
                          disabled={loadingClientNetworks}
                          size="small"
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="Client Network *"
                              error={!!errors.selectedClientNetwork}
                              placeholder="Search client networks..."
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
                          isOptionEqualToValue={(option, value) => option._id === value._id}
                        />
                        {errors.selectedClientNetwork?.message && (
                          <Typography
                            variant="caption"
                            color="error"
                            sx={{ mt: 0.5, ml: 1.5, display: "block" }}
                          >
                            {errors.selectedClientNetwork.message}
                          </Typography>
                        )}
                        {!errors.selectedClientNetwork?.message && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ mt: 0.5, ml: 1.5, display: "block" }}
                          >
                            {loadingClientNetworks
                              ? "Loading client networks..."
                              : `${clientNetworks.length} client network(s) available`}
                          </Typography>
                        )}
                      </Box>
                    )}
                  />
                </Grid>
              )}
              {}
              <Grid item xs={12}>
                <Controller
                  name="selectedOurNetwork"
                  control={control}
                  render={({ field: { onChange, value } }) => (
                    <Box>
                      <Autocomplete
                        options={ourNetworks}
                        getOptionLabel={(option) => option.name || ""}
                        value={ourNetworks.find(n => n._id === value) || null}
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
                            placeholder="Search our networks..."
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
                        isOptionEqualToValue={(option, value) => option._id === value._id}
                      />
                      {errors.selectedOurNetwork?.message && (
                        <Typography
                          variant="caption"
                          color="error"
                          sx={{ mt: 0.5, ml: 1.5, display: "block" }}
                        >
                          {errors.selectedOurNetwork.message}
                        </Typography>
                      )}
                      {!errors.selectedOurNetwork?.message && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ mt: 0.5, ml: 1.5, display: "block" }}
                        >
                          {loadingOurNetworks
                            ? "Loading our networks..."
                            : `${ourNetworks.length} our network(s) available`}
                        </Typography>
                      )}
                    </Box>
                  )}
                />
              </Grid>
              {}
              <Grid item xs={12}>
                <Controller
                  name="selectedCampaign"
                  control={control}
                  render={({ field }) => (
                    <FormControl
                      fullWidth
                      size="small"
                      error={!!errors.selectedCampaign}
                    >
                      <InputLabel>Campaign *</InputLabel>
                      <Select
                        {...field}
                        label="Campaign *"
                        value={field.value || ""}
                        disabled={loadingCampaigns}
                      >
                        <MenuItem value="" disabled>
                          <em>Select a Campaign</em>
                        </MenuItem>
                        {campaigns.map((campaign) => (
                          <MenuItem key={campaign._id} value={campaign._id}>
                            {campaign.name}
                            {campaign.description && (
                              <Typography
                                variant="caption"
                                sx={{
                                  display: "block",
                                  color: "text.secondary",
                                }}
                              >
                                {campaign.description}
                              </Typography>
                            )}
                          </MenuItem>
                        ))}
                      </Select>
                      {errors.selectedCampaign?.message && (
                        <Typography
                          variant="caption"
                          color="error"
                          sx={{ mt: 0.5, ml: 1.5 }}
                        >
                          {errors.selectedCampaign.message}
                        </Typography>
                      )}
                      {!errors.selectedCampaign?.message && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ mt: 0.5, ml: 1.5 }}
                        >
                          {loadingCampaigns
                            ? "Loading campaigns..."
                            : `${campaigns.length} campaign(s) available`}
                        </Typography>
                      )}
                    </FormControl>
                  )}
                />
              </Grid>
              {/* Client Broker Selection - Multiple Selection for Filtering */}
              <Grid item xs={12}>
                <Controller
                  name="selectedClientBrokers"
                  control={control}
                  render={({ field: { onChange, value } }) => (
                    <Box>
                      <Autocomplete
                        multiple
                        options={clientBrokers}
                        getOptionLabel={(option) => option.name || ""}
                        value={clientBrokers.filter(broker => (value || []).includes(broker._id))}
                        onChange={(event, newValue) => {
                          onChange(newValue.map(broker => broker._id));
                          // Reset filtered agents when client brokers change
                          setFilteredAgents([]);
                          setUnassignedLeadsStats({ ftd: null, filler: null });
                        }}
                        disabled={loadingClientBrokers}
                        size="small"
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Client Brokers (optional - to exclude leads)"
                            error={!!errors.selectedClientBrokers}
                            placeholder="Search client brokers..."
                          />
                        )}
                        renderOption={(props, option) => (
                          <li {...props} key={option._id}>
                            <Checkbox
                              checked={(value || []).includes(option._id)}
                              size="small"
                              sx={{ mr: 1 }}
                            />
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
                        renderTags={(tagValue, getTagProps) =>
                          tagValue.map((option, index) => (
                            <Chip
                              {...getTagProps({ index })}
                              key={option._id}
                              label={option.name}
                              size="small"
                              sx={{ height: 'auto' }}
                            />
                          ))
                        }
                        isOptionEqualToValue={(option, value) => option._id === value._id}
                        disableCloseOnSelect
                      />
                      {errors.selectedClientBrokers?.message && (
                        <Typography
                          variant="caption"
                          color="error"
                          sx={{ mt: 0.5, ml: 1.5, display: "block" }}
                        >
                          {errors.selectedClientBrokers.message}
                        </Typography>
                      )}
                      {!errors.selectedClientBrokers?.message && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            mt: 1,
                            ml: 1.5,
                            display: 'block',
                            lineHeight: 1.2
                          }}
                        >
                          {loadingClientBrokers
                            ? "Loading client brokers..."
                            : `${clientBrokers.length} broker(s) available. Select to exclude leads that have been sent to these brokers.`}
                        </Typography>
                      )}
                    </Box>
                  )}
                />
              </Grid>

              {/* Load Agents Button - Shows when criteria are set and FTD or Filler > 0 */}
              {(watch("ftd") > 0 || watch("filler") > 0) && watch("countryFilter") && watch("selectedClientNetwork") && (
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Button
                      variant="outlined"
                      color="primary"
                      onClick={async () => {
                        const country = watch("countryFilter");
                        const clientNetwork = watch("selectedClientNetwork");
                        const clientBrokersSelected = watch("selectedClientBrokers") || [];
                        
                        // Fetch filtered agents for FTD/Filler leads
                        // Both FTD and Filler are stored with leadType: 'ftd' in the database
                        // So we always search for 'ftd' type leads
                        if (watch("ftd") > 0 || watch("filler") > 0) {
                          await fetchFilteredAgents("ftd", country, clientNetwork, clientBrokersSelected);
                        }
                      }}
                      disabled={filteredAgentsLoading}
                      startIcon={filteredAgentsLoading ? <CircularProgress size={16} /> : <PersonIcon />}
                    >
                      {filteredAgentsLoading ? "Loading Agents..." : "Load Matching Agents"}
                    </Button>
                    
                    {filteredAgents.length > 0 && (
                      <Typography variant="body2" color="success.main">
                        Found {filteredAgents.length} agent(s) with leads matching your criteria (country + network + broker filters)
                      </Typography>
                    )}
                    
                    {!filteredAgentsLoading && filteredAgents.length === 0 && unassignedLeadsStats.ftd !== null && (
                      <Typography variant="body2" color="warning.main">
                        No agents found with leads matching your criteria. Use unassigned leads option.
                      </Typography>
                    )}
                  </Box>
                  
                  {/* Unassigned leads info - shows filtered stats */}
                  {(unassignedLeadsStats.ftd || unassignedLeadsStats.filler) && (
                    <Box sx={{ mt: 1, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Unassigned Leads Matching Criteria:
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        These are leads not assigned to any agent, filtered by your selected country, client network, and client brokers
                      </Typography>
                      {unassignedLeadsStats.ftd && watch("ftd") > 0 && (
                        <Typography variant="body2" color="text.secondary">
                          FTD: <strong>{unassignedLeadsStats.ftd.available}</strong> matching available, {unassignedLeadsStats.ftd.onCooldown} matching on cooldown
                        </Typography>
                      )}
                      {unassignedLeadsStats.filler && watch("filler") > 0 && (
                        <Typography variant="body2" color="text.secondary">
                          Filler: <strong>{unassignedLeadsStats.filler.available}</strong> matching available, {unassignedLeadsStats.filler.onCooldown} matching on cooldown
                        </Typography>
                      )}
                    </Box>
                  )}
                </Grid>
              )}

              {/* Individual FTD Agent Assignments - Shows after filtered agents are loaded */}
              {watch("ftd") > 0 && (filteredAgents.length > 0 || unassignedLeadsStats.ftd !== null) && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="primary" sx={{ mb: 1, fontWeight: 600 }}>
                    Assign FTD Leads to Agents
                  </Typography>
                  <Grid container spacing={2}>
                    {Array.from({ length: watch("ftd") }, (_, index) => (
                      <Grid item xs={12} sm={6} md={4} key={`ftd-agent-${index}`}>
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
                                  <em>Unassigned lead {unassignedLeadsStats.ftd ? `(${unassignedLeadsStats.ftd.available} matching available)` : ''}</em>
                                </MenuItem>
                                {filteredAgents.map((agent) => (
                                  <MenuItem 
                                    key={agent._id} 
                                    value={agent._id}
                                    disabled={agent.filteredLeadStats?.available === 0}
                                  >
                                    {agent.fullName || agent.email} — {agent.filteredLeadStats?.available || 0} matching available, {agent.filteredLeadStats?.onCooldown || 0} matching on cooldown
                                  </MenuItem>
                                ))}
                              </Select>
                              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                Stats show only leads matching your selected criteria
                              </Typography>
                            </FormControl>
                          )}
                        />
                      </Grid>
                    ))}
                  </Grid>
                </Grid>
              )}

              {/* Individual Filler Agent Assignments - Shows after filtered agents are loaded */}
              {watch("filler") > 0 && (filteredAgents.length > 0 || unassignedLeadsStats.filler !== null) && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="secondary" sx={{ mb: 1, fontWeight: 600 }}>
                    Assign Filler Leads to Agents
                  </Typography>
                  <Grid container spacing={2}>
                    {Array.from({ length: watch("filler") }, (_, index) => (
                      <Grid item xs={12} sm={6} md={4} key={`filler-agent-${index}`}>
                        <Controller
                          name={`fillerAgents.${index}`}
                          control={control}
                          render={({ field }) => (
                            <FormControl fullWidth size="small">
                              <InputLabel>Filler #{index + 1} Agent</InputLabel>
                              <Select
                                {...field}
                                label={`Filler #${index + 1} Agent`}
                                value={field.value || ""}
                                disabled={filteredAgentsLoading}
                              >
                                <MenuItem value="">
                                  <em>Unassigned lead {unassignedLeadsStats.filler ? `(${unassignedLeadsStats.filler.available} matching available)` : ''}</em>
                                </MenuItem>
                                {filteredAgents.map((agent) => (
                                  <MenuItem 
                                    key={agent._id} 
                                    value={agent._id}
                                    disabled={agent.filteredLeadStats?.available === 0}
                                  >
                                    {agent.fullName || agent.email} — {agent.filteredLeadStats?.available || 0} matching available, {agent.filteredLeadStats?.onCooldown || 0} matching on cooldown
                                  </MenuItem>
                                ))}
                              </Select>
                              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                Stats show only leads matching your selected criteria
                              </Typography>
                            </FormControl>
                          )}
                        />
                      </Grid>
                    ))}
                  </Grid>
                </Grid>
              )}

              {/* Show message if FTD/Filler requested but criteria not complete */}
              {(watch("ftd") > 0 || watch("filler") > 0) && (!watch("countryFilter") || !watch("selectedClientNetwork")) && (
                <Grid item xs={12}>
                  <Alert severity="info" sx={{ mt: 1 }}>
                    Please select country and client network to load agents with matching leads for assignment.
                  </Alert>
                </Grid>
              )}
              <Grid item xs={12}>
                <Controller
                  name="notes"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Notes"
                      multiline
                      rows={3}
                      error={!!errors.notes}
                      helperText={errors.notes?.message}
                      size="small"
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="plannedDate"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Planned Date"
                      type="date"
                      error={!!errors.plannedDate}
                      helperText={errors.plannedDate?.message || "Select the date for when this order should be processed"}
                      size="small"
                      InputLabelProps={{
                        shrink: true,
                      }}
                      value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                      onChange={(e) => {
                        const dateValue = e.target.value ? new Date(e.target.value) : null;
                        field.onChange(dateValue);
                      }}
                    />
                  )}
                />
              </Grid>
              {}

              {}

              {}
            </Grid>
            {errors[""] && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {errors[""]?.message}
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setCreateDialogOpen(false);
              setFilteredAgents([]);
              setUnassignedLeadsStats({ ftd: null, filler: null });
            }}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={isSubmitting}>
              {isSubmitting ? <CircularProgress size={24} /> : "Create Order"}
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
        maxWidth="md"
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
        maxWidth="md"
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
          {deleteOrderDialog.permanentDelete ? 'Permanently Delete Order' : 'Cancel Order'}
        </DialogTitle>
        <DialogContent>
          {deleteOrderDialog.permanentDelete ? (
            <>
              <Alert severity="error" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>Warning:</strong> This will permanently delete the order from the database!
                </Typography>
              </Alert>
              <Typography>
                Are you sure you want to permanently delete this order? This action will:
              </Typography>
              <Box sx={{ mt: 2, ml: 2 }}>
                <Typography variant="body2">• Permanently remove the order from the database</Typography>
                <Typography variant="body2" sx={{ mt: 1, fontWeight: 'bold', color: 'error.main' }}>
                  This action cannot be undone!
                </Typography>
                <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic', color: 'text.secondary' }}>
                  Note: All cleanup (removing assignments, releasing leads, etc.) was already done when the order was cancelled.
                </Typography>
              </Box>
              {deleteOrderDialog.orderStatus !== 'cancelled' && (
                <Box sx={{ mt: 2 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={deleteOrderDialog.permanentDelete}
                        onChange={(e) => setDeleteOrderDialog(prev => ({ ...prev, permanentDelete: e.target.checked }))}
                        color="error"
                      />
                    }
                    label={
                      <Typography variant="body2" color="error">
                        I understand this will permanently delete a non-cancelled order
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
                <Typography variant="body2">• Mark the order as cancelled</Typography>
                <Typography variant="body2">• Remove client network assignments</Typography>
                <Typography variant="body2">• Remove our network assignments</Typography>
                <Typography variant="body2">• Remove campaign assignments</Typography>
                <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic', color: 'text.secondary' }}>
                  Note: The order will still exist in the database and can be permanently deleted later.
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
            startIcon={deleteOrderDialog.loading ? <CircularProgress size={20} /> : <DeleteIcon />}
          >
            {deleteOrderDialog.loading
              ? (deleteOrderDialog.permanentDelete ? 'Permanently Deleting...' : 'Cancelling...')
              : (deleteOrderDialog.permanentDelete ? 'Permanently Delete' : 'Cancel Order')}
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
            ? agents.find(a => a._id === pendingOrderData.agentFilter)?.fullName || 'this agent'
            : 'this agent'
        }
        insufficientTypes={insufficientAgentLeads || {}}
        agents={agents}
      />
    </Box>
  );
};

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
              startIcon={loading ? <CircularProgress size={16} /> : <SaveIcon />}
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
                  <BusinessIcon fontSize="small" />
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
                  <IconButton
                    size="small"
                    title="Edit Broker"
                    onClick={() => onEdit(broker)}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" title="View Details">
                    <ViewIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    title="Delete Broker"
                    onClick={() => onDelete(broker)}
                    color="error"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
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


