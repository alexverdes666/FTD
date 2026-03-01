import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSelector } from "react-redux";
import { useSearchParams, useLocation } from "react-router-dom";
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
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
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  LinearProgress,
  useMediaQuery,
  useTheme,
  Snackbar,
  Tooltip,
  Popper,
  Divider,
  alpha,
} from "@mui/material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Business as BusinessIcon,
  Close as CloseIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
  Undo as UndoIcon,
  FilterListOff as FilterListOffIcon,
  Inbox as InboxIcon,
  AlternateEmail as EmailSearchIcon,
} from "@mui/icons-material";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import api from "../services/api";
import { selectUser } from "../store/slices/authSlice";
import LeadQuickView from "../components/LeadQuickView";
import ChangeFTDDialog from "../components/ChangeFTDDialog";
import AssignLeadToAgentDialog from "../components/AssignLeadToAgentDialog";
import AssignToRefundsManagerModal from "../components/AssignToRefundsManagerModal";
import MarkShavedDialog from "../components/MarkShavedDialog";
import { refundsService } from "../services/refunds";
import ClientBrokerManagementDialog from "../components/ClientBrokerManagementDialog";
import GenderFallbackModal from "../components/GenderFallbackModal";
import CopyPreferencesDialog, {
  copyLeadsWithPreferences,
} from "../components/CopyPreferencesDialog";
import ReplaceLeadDialog from "../components/ReplaceLeadDialog";
import ApplyAgentFineDialog from "../components/ApplyAgentFineDialog";

// Extracted modules from orders/ subdirectory
import {
  createOrderSchema,
  getDisplayLeadType,
  useDebounce,
} from "./orders/ordersUtils";
import OrderRow from "./orders/OrderRow";
import {
  ChangeRequesterDialog,
  CreateBrokerForm,
  EditBrokerForm,
  BrokerManagementTable,
} from "./orders/BrokerManagementComponents";
import {
  ClientBrokersDisplayDialog,
  ClientNetworksDisplayDialog,
  OurNetworksDisplayDialog,
  CampaignsDisplayDialog,
} from "./orders/InfoDisplayDialogs";
import CreateOrderDialog from "./orders/CreateOrderDialog";
import PspDepositDialog from "./orders/PspDepositDialog";
import {
  AddLeadsToOrderDialog,
  AddLeadsConfirmDialog,
} from "./orders/AddLeadsToOrderDialog";
import {
  DeleteOrderDialog,
  RemoveLeadDialog,
  OrderAuditLogDialog,
  EditPlannedDateDialog,
  EditNetworkConfigDialog,
  LeadRemovalReasonDialog,
} from "./orders/OrderActionDialogs";
import AssignedLeadsModal from "./orders/AssignedLeadsModal";
import OrderDetailPanel from "./orders/OrderDetailPanel";
import LeadsPreviewModal from "./orders/LeadsPreviewModal";
import useOrdersData from "./orders/useOrdersData";
import useDropdownData from "./orders/useDropdownData";
import useLeadActions from "./orders/useLeadActions";

const OrdersPage = () => {
  const user = useSelector(selectUser);
  const theme = useTheme();
  const location = useLocation();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const [searchParams, setSearchParams] = useSearchParams();
  const [notification, setNotification] = useState({
    message: "",
    severity: "info",
  });

  // ── Extracted hooks ──
  const {
    orders, setOrders,
    loading, searching,
    page, rowsPerPage, totalOrders,
    filters, setFilters, debouncedFilters,
    fetchOrders,
    handleChangePage, handleChangeRowsPerPage, handleFilterChange,
    clearFilters, activeFilterCount,
  } = useOrdersData({ user, searchParams, setSearchParams, setNotification });

  const {
    clientNetworks, loadingClientNetworks,
    ourNetworks, loadingOurNetworks,
    campaigns, loadingCampaigns,
    clientBrokers, loadingClientBrokers,
    agents, loadingAgents,
    filteredAgents, setFilteredAgents,
    filteredAgentsLoading,
    unassignedLeadsStats, setUnassignedLeadsStats,
    allAgents,
    fetchClientNetworks, fetchOurNetworks, fetchCampaigns,
    fetchClientBrokers, fetchAgents, fetchFilteredAgents, fetchAllAgents,
  } = useDropdownData(user, setNotification);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
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
  const [selectedOrderForManagement, setSelectedOrderForManagement] =
    useState(null);

  const [expandedRowData, setExpandedRowData] = useState({});
  const [orderPanelId, setOrderPanelId] = useState(null);
  const [expandedLeadId, setExpandedLeadId] = useState(null);
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
    loading: false,
    enriching: false,
  });

  // IPQS validation success state (tracks leadIds that were just successfully validated)
  const [ipqsValidationSuccess, setIpqsValidationSuccess] = useState([]);
  // IPQS validation in progress state (tracks orderIds being validated)
  const [ipqsValidatingOrders, setIpqsValidatingOrders] = useState([]);

  // Highlight lead ID from external navigation (e.g., broker profile)
  const [highlightLeadId, setHighlightLeadId] = useState(location.state?.highlightLeadId || null);

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
    step: 1, // 1 = select card issuer, 2 = select PSP, 3 = select deposit call
    cardIssuers: [],
    selectedCardIssuer: null,
    newCardIssuerName: "",
    creatingIssuer: false,
    psps: [],
    loading: false,
    selectedPsp: null,
    newPspWebsite: "",
    creatingPsp: false,
    // Step 3: CDR call selection
    agentCalls: [],
    agentCallsLoading: false,
    selectedCall: null,
    playingRecording: null,
    callSearchQuery: "",
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

  const handleOpenChangeRequester = useCallback((order) => {
    setSelectedOrderForRequester(order);
    setSelectedNewRequester(null);
    setChangeRequesterOpen(true);
  }, []);


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

  // Autocomplete states for Create Order Dialog
  const [clientNetworkInput, setClientNetworkInput] = useState("");
  const [clientNetworkOpen, setClientNetworkOpen] = useState(false);

  const [ourNetworkInput, setOurNetworkInput] = useState("");
  const [ourNetworkOpen, setOurNetworkOpen] = useState(false);

  const [campaignInput, setCampaignInput] = useState("");
  const [campaignOpen, setCampaignOpen] = useState(false);

  // ── useLeadActions hook ──
  const {
    handleConfirmDeposit,
    handleCardIssuerSelect,
    handlePspSelect,
    handleDepositCallConfirm,
    handleClosePspDepositDialog,
    handleUnconfirmDeposit,
    handleMarkAsShaved,
    handleConfirmMarkAsShaved,
    handleUnmarkAsShaved,
    handleMarkAsClosedNetwork,
    handleUnmarkAsClosedNetwork,
    handleUndoAction,
    handleRestoreLead,
    handleUndoReplacementFromMenu,
    handleRemoveSelectedLeads,
    handleConvertLeadType,
    handleReplaceLeadSuccess,
    handleChangeFTDSuccess,
    handleAssignLeadSuccess,
  } = useLeadActions({
    fetchOrders,
    setNotification,
    setExpandedRowData,
    setLeadsPreviewModal,
    setAssignedLeadsModal,
    setOrders,
    expandedRowData,
    leadsPreviewModal,
    pspDepositDialog,
    markShavedDialog,
    hoveredOrderId,
    changeFTDDialog,
    setPspDepositDialog,
    setMarkShavedDialog,
    setUndoAction,
    setUndoing,
    setRestoringLead,
    setUndoingReplacement,
    setIpqsValidationSuccess,
    setProcessingLeads,
    setLeadRemovalMode,
    setSelectedLeadsForRemoval,
    user,
    removalReasonDialog,
    selectedLeadsForRemoval,
    undoAction,
    setRemovingLeads,
    setRemovalReasonDialog,
  });

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
      closedNetwork: metadata.closedNetwork || false,
      closedNetworkBy: metadata.closedNetworkBy,
      closedNetworkAt: metadata.closedNetworkAt,
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
      loading: false,
      enriching: false,
    });
  }, []);

  const handleCloseLeadsPreviewModal = useCallback(() => {
    setLeadsPreviewModal({ open: false, leads: [], orderId: null, order: null, loading: false, enriching: false });
    setPreviewActionsMenu({ anchorEl: null, lead: null });
    setLeadRemovalMode(false);
    setSelectedLeadsForRemoval([]);
    setHighlightLeadId(null);
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
      // Phase 1: Open modal instantly with data already in memory
      const existingOrder = orders.find((o) => o._id === orderId);
      setLeadsPreviewModal({
        open: true,
        leads: existingOrder?.leads || [],
        orderId: orderId,
        order: existingOrder || null,
        loading: !existingOrder,
        enriching: true,
      });

      // Phase 2: Fetch full data in background (includes documents, IPQS, networks, etc.)
      try {
        const response = await api.get(`/orders/${orderId}`);
        const orderData = response.data.data;
        setLeadsPreviewModal((prev) => {
          if (!prev.open || prev.orderId !== orderId) return prev;
          return {
            ...prev,
            leads: orderData.leads || [],
            order: orderData,
            loading: false,
            enriching: false,
          };
        });
      } catch (err) {
        setLeadsPreviewModal((prev) => {
          if (!prev.open || prev.orderId !== orderId) return prev;
          return { ...prev, loading: false, enriching: false };
        });
        if (!existingOrder) {
          setLeadsPreviewModal((prev) => ({ ...prev, open: false }));
          setNotification({
            message: "Could not load order leads for preview.",
            severity: "error",
          });
        }
      }
    },
    [orders]
  );

  // Open leads preview when navigated from external page (e.g., broker profile)
  useEffect(() => {
    const highlightOrderId = location.state?.highlightOrderId;
    if (highlightOrderId) {
      // Filter to show only this order
      setFilters((prev) => ({ ...prev, search: highlightOrderId }));
      // Open leads preview modal for this order
      handlePreviewOrderLeads(highlightOrderId);
      // Clear navigation state to avoid re-triggering
      window.history.replaceState({}, document.title);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        // Expand immediately with loading state - no waiting for API
        setExpandedRowData((prev) => ({
          ...prev,
          [orderId]: { loading: true },
        }));

        try {
          // Fetch lightweight and full data in parallel
          const lightweightPromise = api.get(
            `/orders/${orderId}?lightweight=true`
          );
          const fullPromise = api.get(`/orders/${orderId}`);

          // Show lightweight data as soon as it arrives
          const lightweightResponse = await lightweightPromise;
          const lightweightData = lightweightResponse.data.data;

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

          // Update with full data when it arrives
          const fullResponse = await fullPromise;
          const fullOrderData = fullResponse.data.data;

          setExpandedRowData((prev) => ({
            ...prev,
            [orderId]: {
              ...fullOrderData,
              leadsLoading: false,
            },
          }));
        } catch (err) {
          // Remove the loading entry on error
          setExpandedRowData((prev) => {
            const newData = { ...prev };
            delete newData[orderId];
            return newData;
          });
          setNotification({
            message: "Could not load order details for expansion.",
            severity: "error",
          });
        }
      }
    },
    [expandedRowData, fetchRefundAssignmentStatus]
  );

  const handleOpenOrderPanel = useCallback(
    (orderId) => {
      setOrderPanelId(orderId);
      setExpandedLeadId(null);
      // Fetch data if not already loaded
      if (!expandedRowData[orderId]) {
        // Set loading state immediately
        setExpandedRowData((prev) => ({
          ...prev,
          [orderId]: { loading: true },
        }));

        // Fire lightweight first for quick data, then full request for leads
        api
          .get(`/orders/${orderId}?lightweight=true`)
          .then((lightweightResponse) => {
            const lightweightData = lightweightResponse.data.data;
            setExpandedRowData((prev) => ({
              ...prev,
              [orderId]: {
                ...lightweightData,
                leadsLoading: true,
              },
            }));
            if (lightweightData.fulfilled?.ftd > 0) {
              fetchRefundAssignmentStatus(orderId);
            }
            // Fire panel request AFTER lightweight completes to avoid resource contention
            return api.get(`/orders/${orderId}?panel=true`);
          })
          .then((fullResponse) => {
            const fullOrderData = fullResponse.data.data;
            setExpandedRowData((prev) => ({
              ...prev,
              [orderId]: {
                ...fullOrderData,
                leadsLoading: false,
              },
            }));
          })
          .catch((err) => {
            // Keep lightweight data if available, just stop the leads spinner
            setExpandedRowData((prev) => {
              const existing = prev[orderId];
              if (existing && !existing.loading) {
                // We have lightweight data - keep it, mark leads as failed
                return {
                  ...prev,
                  [orderId]: {
                    ...existing,
                    leadsLoading: false,
                    leadsError: true,
                  },
                };
              }
              // No lightweight data either - remove entry
              const newData = { ...prev };
              delete newData[orderId];
              return newData;
            });
            setNotification({
              message: "Could not load order leads.",
              severity: "error",
            });
          });
      }
    },
    [expandedRowData, fetchRefundAssignmentStatus]
  );

  const handleCloseOrderPanel = useCallback(() => {
    setOrderPanelId(null);
    setExpandedLeadId(null);
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


  // Close Mark Shaved Dialog
  const handleCloseMarkShavedDialog = useCallback(() => {
    setMarkShavedDialog({ open: false, lead: null, orderId: null, loading: false });
  }, []);

  const handleCloseCopyNotification = useCallback(() => {
    setCopyNotification({ open: false, message: "" });
  }, []);
  return (
    <Box sx={{ width: "100%", typography: "body1", height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
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
      <Paper sx={{ position: "relative", borderRadius: 2, border: 1, borderColor: "divider", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", overflow: "hidden", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {/* Compact Top Filter Bar */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            px: 1,
            py: 0.5,
            background: (theme) => `linear-gradient(135deg, ${alpha(theme.palette.grey[100], 0.7)} 0%, ${alpha(theme.palette.grey[50], 0.5)} 100%)`,
            borderBottom: "1px solid",
            borderColor: (theme) => alpha(theme.palette.divider, 0.6),
            minHeight: 36,
          }}
        >
          {/* Search */}
          <TextField
            placeholder="Search orders..."
            value={filters.search}
            onChange={handleFilterChange("search")}
            size="small"
            sx={{
              width: 180,
              "& .MuiOutlinedInput-root": {
                height: 28,
                borderRadius: 6,
                fontSize: "0.78rem",
                bgcolor: "background.paper",
                border: "none",
                boxShadow: (theme) => `0 1px 2px ${alpha(theme.palette.grey[400], 0.15)}`,
                "& fieldset": { border: "1px solid", borderColor: (theme) => alpha(theme.palette.grey[300], 0.7) },
                "&:hover fieldset": { borderColor: (theme) => alpha(theme.palette.primary.main, 0.3) },
                "&.Mui-focused fieldset": { borderColor: "primary.main", borderWidth: 1.5, boxShadow: (theme) => `0 0 0 2px ${alpha(theme.palette.primary.main, 0.1)}` },
              },
              "& input::placeholder": { fontSize: "0.75rem", opacity: 0.6 },
            }}
            InputProps={{
              startAdornment: <SearchIcon sx={{ color: "action.active", mr: 0.5, fontSize: 15 }} />,
            }}
          />
          <Divider orientation="vertical" flexItem sx={{ my: 0.5, borderColor: (theme) => alpha(theme.palette.grey[300], 0.6) }} />
          {/* Email Search */}
          <TextField
            placeholder="Search by email..."
            value={filters.emailSearch}
            onChange={handleFilterChange("emailSearch")}
            size="small"
            sx={{
              width: 180,
              "& .MuiOutlinedInput-root": {
                height: 28,
                borderRadius: 6,
                fontSize: "0.78rem",
                bgcolor: "background.paper",
                border: "none",
                boxShadow: (theme) => `0 1px 2px ${alpha(theme.palette.grey[400], 0.15)}`,
                "& fieldset": { border: "1px solid", borderColor: (theme) => alpha(theme.palette.grey[300], 0.7) },
                "&:hover fieldset": { borderColor: (theme) => alpha(theme.palette.primary.main, 0.3) },
                "&.Mui-focused fieldset": { borderColor: "primary.main", borderWidth: 1.5, boxShadow: (theme) => `0 0 0 2px ${alpha(theme.palette.primary.main, 0.1)}` },
              },
              "& input::placeholder": { fontSize: "0.75rem", opacity: 0.6 },
            }}
            InputProps={{
              startAdornment: <EmailSearchIcon sx={{ color: "action.active", mr: 0.5, fontSize: 15 }} />,
            }}
          />
          {/* Month */}
          <FormControl size="small" sx={{ minWidth: 78, "& .MuiOutlinedInput-root": { height: 28, borderRadius: 6, fontSize: "0.75rem", bgcolor: "background.paper", boxShadow: (theme) => `0 1px 2px ${alpha(theme.palette.grey[400], 0.15)}`, "& fieldset": { borderColor: (theme) => alpha(theme.palette.grey[300], 0.7) }, "&:hover fieldset": { borderColor: (theme) => alpha(theme.palette.primary.main, 0.3) } } }}>
            <Select
              value={filters.createdMonth}
              onChange={handleFilterChange("createdMonth")}
              displayEmpty
              renderValue={(v) => {
                if (!v) return "Month";
                const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
                return months[parseInt(v) - 1] || "Month";
              }}
              sx={{
                "& .MuiSelect-select": { py: 0, pl: 1, pr: "24px !important", display: "flex", alignItems: "center" },
                "& .MuiSelect-icon": { right: 2, fontSize: 18 },
                color: filters.createdMonth ? "text.primary" : "text.disabled",
                fontWeight: filters.createdMonth ? 600 : 400,
              }}
            >
              <MenuItem value="" sx={{ fontSize: "0.8rem" }}>All Months</MenuItem>
              {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m, i) => (
                <MenuItem key={i + 1} value={String(i + 1)} sx={{ fontSize: "0.8rem" }}>{m}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {/* Year */}
          <FormControl size="small" sx={{ minWidth: 68, "& .MuiOutlinedInput-root": { height: 28, borderRadius: 6, fontSize: "0.75rem", bgcolor: "background.paper", boxShadow: (theme) => `0 1px 2px ${alpha(theme.palette.grey[400], 0.15)}`, "& fieldset": { borderColor: (theme) => alpha(theme.palette.grey[300], 0.7) }, "&:hover fieldset": { borderColor: (theme) => alpha(theme.palette.primary.main, 0.3) } } }}>
            <Select
              value={filters.createdYear}
              onChange={handleFilterChange("createdYear")}
              displayEmpty
              renderValue={(v) => v || "Year"}
              sx={{
                "& .MuiSelect-select": { py: 0, pl: 1, pr: "24px !important", display: "flex", alignItems: "center" },
                "& .MuiSelect-icon": { right: 2, fontSize: 18 },
                color: filters.createdYear ? "text.primary" : "text.disabled",
                fontWeight: filters.createdYear ? 600 : 400,
              }}
            >
              <MenuItem value="" sx={{ fontSize: "0.8rem" }}>All Years</MenuItem>
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                <MenuItem key={y} value={String(y)} sx={{ fontSize: "0.8rem" }}>{y}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {/* Clear filters */}
          {activeFilterCount > 0 && (
            <>
              <Divider orientation="vertical" flexItem sx={{ my: 0.5, borderColor: (theme) => alpha(theme.palette.grey[300], 0.6) }} />
              <Chip
                label={`Clear (${activeFilterCount})`}
                size="small"
                onDelete={clearFilters}
                deleteIcon={<FilterListOffIcon sx={{ fontSize: "14px !important" }} />}
                onClick={clearFilters}
                sx={{
                  height: 24,
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  bgcolor: (theme) => alpha(theme.palette.error.main, 0.08),
                  color: "error.dark",
                  border: "1px solid",
                  borderColor: (theme) => alpha(theme.palette.error.main, 0.2),
                  "& .MuiChip-deleteIcon": { color: "error.main", "&:hover": { color: "error.dark" } },
                  "&:hover": { bgcolor: (theme) => alpha(theme.palette.error.main, 0.14) },
                }}
              />
            </>
          )}
          {/* Spacer */}
          <Box sx={{ flex: 1 }} />
          {/* Action buttons */}
          {(user?.role === "admin" || user?.role === "affiliate_manager") && (
            <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon sx={{ fontSize: "15px !important" }} />}
                onClick={handleOpenCreateDialog}
                sx={{
                  height: 26,
                  textTransform: "none",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  borderRadius: 6,
                  px: 1.25,
                  boxShadow: "none",
                  background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                  "&:hover": { boxShadow: (theme) => `0 2px 6px ${alpha(theme.palette.primary.main, 0.35)}` },
                }}
              >
                New Order
              </Button>
              {user?.role === "admin" && (
                <Tooltip title="Manage Brokers" arrow>
                  <IconButton
                    size="small"
                    onClick={handleManageBrokers}
                    sx={{
                      width: 26,
                      height: 26,
                      borderRadius: 6,
                      bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                      color: "primary.main",
                      "&:hover": { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.16) },
                    }}
                  >
                    <BusinessIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Copy Format Settings" arrow>
                <IconButton
                  size="small"
                  onClick={() => setCopyPreferencesOpen(true)}
                  sx={{
                    width: 26,
                    height: 26,
                    borderRadius: 6,
                    bgcolor: (theme) => alpha(theme.palette.grey[500], 0.08),
                    color: "text.secondary",
                    "&:hover": { bgcolor: (theme) => alpha(theme.palette.grey[500], 0.16) },
                  }}
                >
                  <SettingsIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>
            </Box>
          )}
          {!(user?.role === "admin" || user?.role === "affiliate_manager") && (
            <Tooltip title="Copy Format Settings" arrow>
              <IconButton
                size="small"
                onClick={() => setCopyPreferencesOpen(true)}
                sx={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  bgcolor: (theme) => alpha(theme.palette.grey[500], 0.08),
                  color: "text.secondary",
                  "&:hover": { bgcolor: (theme) => alpha(theme.palette.grey[500], 0.16) },
                }}
              >
                <SettingsIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
        <Box sx={{ display: "flex", flex: 1, minHeight: 0 }}>
          {/* Left side: Orders Table */}
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {searching && (
          <LinearProgress
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              zIndex: 2,
              height: 2,
              "& .MuiLinearProgress-bar": {
                background: "linear-gradient(90deg, #3b82f6, #8b5cf6, #3b82f6)",
                backgroundSize: "200% 100%",
                animation: "shimmer 1.5s infinite",
              },
              "@keyframes shimmer": {
                "0%": { backgroundPosition: "200% 0" },
                "100%": { backgroundPosition: "-200% 0" },
              },
            }}
          />
        )}
        <TableContainer sx={{ flex: 1, overflow: "auto" }}>
          <Table size="small" stickyHeader sx={{
            minWidth: 850,
            tableLayout: "fixed",
            "& .MuiTableHead-root .MuiTableCell-head": {
              background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
              color: "#fff",
              fontWeight: 700,
              fontSize: "0.65rem",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              borderBottom: "2px solid #3b82f6",
              py: 0.4,
              px: 1,
              lineHeight: 1.1,
            },
            "& .MuiTableBody-root .MuiTableCell-root": {
              py: 0.25,
              px: 1,
              fontSize: "0.78rem",
              lineHeight: 1.3,
            },
            "& .MuiTableBody-root .MuiTableRow-root:nth-of-type(even)": {
              bgcolor: (theme) => alpha(theme.palette.grey[500], 0.02),
            },
            "& .MuiTableBody-root .MuiTableRow-root:hover": {
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06),
              transition: "background-color 0.15s ease",
            },
          }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: orderPanelId ? "8%" : "10%" }}>
                  Order ID
                </TableCell>
                <TableCell sx={{ display: { xs: "none", md: "table-cell" }, textAlign: "center", width: orderPanelId ? "11%" : "13%" }}>
                  Requester
                </TableCell>
                <TableCell sx={{ display: { xs: "none", md: "table-cell" }, textAlign: "center", width: orderPanelId ? "8%" : "10%" }}>
                  CN
                </TableCell>
                <TableCell sx={{ display: { xs: "none", md: "table-cell" }, textAlign: "center", width: orderPanelId ? "8%" : "10%" }}>
                  ON
                </TableCell>
                <TableCell sx={{ textAlign: "center", width: orderPanelId ? "12%" : "14%" }}>
                  Fulfilled
                </TableCell>
                <TableCell sx={{ textAlign: "center", width: orderPanelId ? "8%" : "10%" }}>
                  Status
                </TableCell>
                <TableCell sx={{ display: { xs: "none", sm: "table-cell" }, textAlign: "center", width: orderPanelId ? "7%" : "10%" }}>
                  GEO
                </TableCell>
                <TableCell sx={{ display: { xs: "none", sm: "table-cell" }, textAlign: "center", width: orderPanelId ? "8%" : "10%" }}>
                  Priority
                </TableCell>
                <TableCell sx={{ display: { xs: "none", sm: "table-cell" }, textAlign: "center", width: orderPanelId ? "10%" : "12%" }}>
                  Planned Date
                </TableCell>
                <TableCell sx={{ textAlign: "right", width: orderPanelId ? "20%" : "11%" }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 8, borderBottom: "none" }}>
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
                      <CircularProgress size={36} />
                      <Typography variant="body2" color="text.secondary">Loading orders...</Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 8, borderBottom: "none" }}>
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                      <InboxIcon sx={{ fontSize: 48, color: "grey.400" }} />
                      <Typography variant="h6" color="text.secondary">No orders found</Typography>
                      <Typography variant="body2" color="text.disabled">Try adjusting your search or filter criteria</Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order) => (
                    <OrderRow
                      key={order._id}
                      order={order}
                      orderPanelId={orderPanelId}
                      user={user}
                      onPreviewLeads={handlePreviewOrderLeads}
                      onCopyLeads={handleCopyOrderLeadsById}
                      onOpenAudit={handleOpenOrderAudit}
                      onOpenPanel={handleOpenOrderPanel}
                      onChangeRequester={handleOpenChangeRequester}
                    />
                  ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <Box sx={{ display: "flex", alignItems: "center", borderTop: 1, borderColor: "divider", px: 1.5, minHeight: 32 }}>
          <Typography color="text.secondary" sx={{ fontSize: "0.72rem" }}>
            {Math.min(page * rowsPerPage + 1, totalOrders)}–{Math.min((page + 1) * rowsPerPage, totalOrders)} of {totalOrders}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <TablePagination
            rowsPerPageOptions={[25, 50, 100]}
            component="div"
            count={totalOrders}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            sx={{
              borderBottom: "none",
              "& .MuiTablePagination-toolbar": { minHeight: 32, pl: 0 },
              "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows": { fontSize: "0.72rem" },
              "& .MuiTablePagination-select": { fontSize: "0.72rem" },
              "& .MuiTablePagination-actions button": { p: 0.25 },
            }}
          />
        </Box>
          </Box>
          {/* Right side: Order Details Panel */}
          {orderPanelId && (
          <OrderDetailPanel
            orderPanelId={orderPanelId}
            orders={orders}
            expandedRowData={expandedRowData}
            setExpandedRowData={setExpandedRowData}
            expandedLeadId={expandedLeadId}
            setExpandedLeadId={setExpandedLeadId}
            user={user}
            onClose={handleCloseOrderPanel}
            onPreviewLeads={handlePreviewOrderLeads}
            onCopyLeads={handleCopyOrderLeads}
            onExportLeads={handleExportLeads}
            onDeleteOrder={handleDeleteOrderClick}
            onOpenAddLeads={handleOpenAddLeadsDialog}
            onEditPlannedDate={handleOpenEditPlannedDate}
            onEditNetworkConfig={handleOpenEditNetworkConfig}
            onOpenAssignedLeads={handleOpenAssignedLeadsModal}
            onOpenRefundsAssignment={handleOpenRefundsAssignment}
            onDirectIPQSValidation={handleDirectIPQSValidation}
            ipqsValidatingOrders={ipqsValidatingOrders}
            refundAssignmentStatus={refundAssignmentStatus}
            onOpenClientBrokerManagement={handleOpenClientBrokerManagement}
            onChangeRequester={handleOpenChangeRequester}
            getLeadWithOrderMetadata={getLeadWithOrderMetadata}
            onConfirmDeposit={handleConfirmDeposit}
            onUnconfirmDeposit={handleUnconfirmDeposit}
            onMarkAsShaved={handleMarkAsShaved}
            onUnmarkAsShaved={handleUnmarkAsShaved}
            onMarkAsClosedNetwork={handleMarkAsClosedNetwork}
            onUnmarkAsClosedNetwork={handleUnmarkAsClosedNetwork}
            onOpenChangeFTD={handleOpenChangeFTDDialog}
            onOpenReplaceLead={handleOpenReplaceLeadDialog}
            onConvertLeadType={handleConvertLeadType}
            onOpenAssignLead={handleOpenAssignLeadDialog}
            onCopyToClipboard={handleCopyToClipboard}
            onLeadMouseEnter={handleLeadMouseEnter}
            onLeadMouseLeave={handleLeadMouseLeave}
            onOpenApplyFine={handleOpenApplyFineDialog}
            onOpenRemoveLead={handleOpenRemoveLeadDialog}

            setCopyPreferencesOpen={setCopyPreferencesOpen}
            processingLeads={processingLeads}
            setNotification={setNotification}
          />
          )}
        </Box>
      </Paper>

      {/* Create Order Dialog */}
      {createDialogOpen && (
      <CreateOrderDialog
        open={createDialogOpen}
        onClose={() => {
          setCreateDialogOpen(false);
          setFilteredAgents([]);
          setUnassignedLeadsStats({ ftd: null, filler: null });
          setManualSelectionMode(false);
          setManualLeadEmails("");
          setManualLeads([]);
          reset();
        }}
        control={control}
        handleSubmit={handleSubmit}
        watch={watch}
        errors={errors}
        isSubmitting={isSubmitting}
        onSubmitOrder={onSubmitOrder}
        user={user}
        manualSelectionMode={manualSelectionMode}
        setManualSelectionMode={setManualSelectionMode}
        manualLeadEmails={manualLeadEmails}
        setManualLeadEmails={setManualLeadEmails}
        manualLeads={manualLeads}
        setManualLeads={setManualLeads}
        searchingLeads={searchingLeads}
        searchLeadsByEmails={searchLeadsByEmails}
        updateManualLeadAgent={updateManualLeadAgent}
        removeManualLead={removeManualLead}
        allAgents={allAgents}
        clientNetworks={clientNetworks}
        loadingClientNetworks={loadingClientNetworks}
        ourNetworks={ourNetworks}
        loadingOurNetworks={loadingOurNetworks}
        campaigns={campaigns}
        loadingCampaigns={loadingCampaigns}
        clientBrokers={clientBrokers}
        loadingClientBrokers={loadingClientBrokers}
        agents={agents}
        loadingAgents={loadingAgents}
        filteredAgents={filteredAgents}
        filteredAgentsLoading={filteredAgentsLoading}
        unassignedLeadsStats={unassignedLeadsStats}
        fetchFilteredAgents={fetchFilteredAgents}
        fulfillmentSummary={fulfillmentSummary}
        checkingFulfillment={checkingFulfillment}
        setNotification={setNotification}
        handleCreateNewBroker={handleCreateNewBroker}
        handleManageBrokers={handleManageBrokers}
        clientNetworkInput={clientNetworkInput}
        setClientNetworkInput={setClientNetworkInput}
        clientNetworkOpen={clientNetworkOpen}
        setClientNetworkOpen={setClientNetworkOpen}
        ourNetworkInput={ourNetworkInput}
        setOurNetworkInput={setOurNetworkInput}
        ourNetworkOpen={ourNetworkOpen}
        setOurNetworkOpen={setOurNetworkOpen}
        campaignInput={campaignInput}
        setCampaignInput={setCampaignInput}
        campaignOpen={campaignOpen}
        setCampaignOpen={setCampaignOpen}
        setCopyPreferencesOpen={setCopyPreferencesOpen}
        setFilteredAgents={setFilteredAgents}
        setUnassignedLeadsStats={setUnassignedLeadsStats}
      />
      )}


      {/* Replace Lead Dialog */}
      {replaceLeadDialog.open && (
      <ReplaceLeadDialog
        open
        onClose={handleCloseReplaceLeadDialog}
        order={replaceLeadDialog.order}
        lead={replaceLeadDialog.lead}
        onSuccess={handleReplaceLeadSuccess}
      />
      )}


      {/* Apply Agent Fine Dialog */}
      {applyFineDialog.open && (
      <ApplyAgentFineDialog
        open
        onClose={handleCloseApplyFineDialog}
        onSuccess={handleApplyFineSuccess}
        agent={applyFineDialog.agent}
        lead={applyFineDialog.lead}
        orderId={applyFineDialog.orderId}
      />
      )}


      {/* PSP Deposit Confirmation Dialog */}
      {pspDepositDialog.open && (
      <PspDepositDialog
        dialog={pspDepositDialog}
        setDialog={setPspDepositDialog}
        onCardIssuerSelect={handleCardIssuerSelect}
        onPspSelect={handlePspSelect}
        onDepositCallConfirm={handleDepositCallConfirm}
        onClose={handleClosePspDepositDialog}
        setNotification={setNotification}
      />
      )}


      {/* Change Requester Dialog */}
      {changeRequesterOpen && (
      <ChangeRequesterDialog
        open
        onClose={() => setChangeRequesterOpen(false)}
        onSubmit={handleSubmitChangeRequester}
        requesters={potentialRequesters}
        loading={loadingRequesters}
        selectedRequester={selectedNewRequester}
        onSelectRequester={setSelectedNewRequester}
      />
      )}


      {/* Edit Planned Date Dialog */}
      <EditPlannedDateDialog
        editPlannedDateDialog={editPlannedDateDialog}
        newPlannedDate={newPlannedDate}
        setNewPlannedDate={setNewPlannedDate}
        onSubmit={handleSubmitEditPlannedDate}
        onClose={handleCloseEditPlannedDate}
      />

      {/* Edit Network Configuration Dialog (Admin Only) */}
      <EditNetworkConfigDialog
        editNetworkConfigDialog={editNetworkConfigDialog}
        newNetworkValue={newNetworkValue}
        setNewNetworkValue={setNewNetworkValue}
        campaigns={campaigns}
        ourNetworks={ourNetworks}
        clientNetworks={clientNetworks}
        onSubmit={handleSubmitEditNetworkConfig}
        onClose={handleCloseEditNetworkConfig}
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
      <LeadRemovalReasonDialog
        removalReasonDialog={removalReasonDialog}
        setRemovalReasonDialog={setRemovalReasonDialog}
        selectedLeadsForRemoval={selectedLeadsForRemoval}
        removingLeads={removingLeads}
        onConfirm={(reason) => handleRemoveSelectedLeads(reason)}
        onClose={handleCloseRemovalReasonDialog}
      />


      {/* Create New Broker Dialog */}
      {createBrokerDialog.open && (
      <Dialog
        open
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
      )}

      {/* Manage Brokers Dialog */}
      {manageBrokersDialog.open && (
      <Dialog
        open
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
      )}

      {/* Delete Broker Confirmation Dialog */}
      {deleteBrokerDialog.open && (
      <Dialog
        open
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
      )}

      {/* Edit Broker Dialog */}
      {editBrokerDialog.open && (
      <Dialog
        open
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
      )}

      {/* Refunds Manager Assignment Modal */}
      {refundsAssignmentDialog.open && (
      <AssignToRefundsManagerModal
        open
        onClose={handleCloseRefundsAssignment}
        orderId={refundsAssignmentDialog.orderId}
        onSuccess={handleRefundsAssignmentSuccess}
      />
      )}

      {/* Mark Shaved Dialog */}
      {markShavedDialog.open && (
      <MarkShavedDialog
        open
        lead={markShavedDialog.lead}
        userRole={user?.role}
        onClose={handleCloseMarkShavedDialog}
        onConfirm={handleConfirmMarkAsShaved}
        loading={markShavedDialog.loading}
      />
      )}

      {/* Client Broker Management Dialog */}
      {clientBrokerManagementOpen && (
      <ClientBrokerManagementDialog
        open
        onClose={handleCloseClientBrokerManagement}
        order={selectedOrderForManagement}
        onUpdate={handleClientBrokerManagementUpdate}
      />
      )}

      {/* Change FTD Dialog */}
      {changeFTDDialog.open && (
      <ChangeFTDDialog
        open
        onClose={handleCloseChangeFTDDialog}
        order={changeFTDDialog.order}
        lead={changeFTDDialog.lead}
        onSuccess={handleChangeFTDSuccess}
      />
      )}

      {/* Assign Lead to Agent Dialog */}
      {assignLeadDialog.open && (
      <AssignLeadToAgentDialog
        open
        onClose={handleCloseAssignLeadDialog}
        lead={assignLeadDialog.lead}
        onSuccess={handleAssignLeadSuccess}
      />
      )}


      {/* Add Leads to Order Dialog (Admin only) */}
      <AddLeadsToOrderDialog
        dialog={addLeadsDialog}
        onClose={handleCloseAddLeadsDialog}
        addLeadsEmails={addLeadsEmails}
        setAddLeadsEmails={setAddLeadsEmails}
        addLeadsSearching={addLeadsSearching}
        addLeadsFound={addLeadsFound}
        onSearch={searchLeadsForAddToOrder}
        updateAddLeadAgent={updateAddLeadAgent}
        updateAddLeadType={updateAddLeadType}
        removeAddLead={removeAddLead}
        allAgents={allAgents}
        onSubmit={handleSubmitAddLeads}
        user={user}
      />

      {/* Add Leads Confirmation Dialog (Reason Selection) */}
      <AddLeadsConfirmDialog
        dialog={addLeadsConfirmDialog}
        setDialog={setAddLeadsConfirmDialog}
        allAgents={allAgents}
        onConfirm={handleConfirmAddLeads}
        onClose={handleCloseAddLeadsConfirmDialog}
        addLeadsFound={addLeadsFound}
      />

      {/* Delete Order Confirmation Dialog */}
      <DeleteOrderDialog
        deleteOrderDialog={deleteOrderDialog}
        setDeleteOrderDialog={setDeleteOrderDialog}
        onConfirm={handleDeleteOrderConfirm}
        onCancel={handleDeleteOrderCancel}
      />

      {/* Remove Lead from Order Dialog */}
      <RemoveLeadDialog
        removeLeadDialog={removeLeadDialog}
        setRemoveLeadDialog={setRemoveLeadDialog}
        allAgents={allAgents}
        onConfirm={handleConfirmRemoveLead}
        onCancel={handleCloseRemoveLeadDialog}
      />

      {/* Order Audit Log Dialog */}
      <OrderAuditLogDialog
        orderAuditDialog={orderAuditDialog}
        onClose={handleCloseOrderAudit}
      />

      {/* Gender Fallback Modal for Agent Lead Assignment */}
      {genderFallbackModalOpen && (
      <GenderFallbackModal
        open
        onClose={handleGenderFallbackClose}
        onSelectGender={handleGenderFallbackSelect}
        agentName={
          pendingOrderData?.agentFilter
            ? agents.find((a) => a._id === pendingOrderData.agentFilter)
                ?.fullName || "this agent"
            : "this agent"
        }
        insufficientTypes={insufficientAgentLeads || {}}
      />
      )}

      {/* Lead Quick View Popper */}
      <Popper
        open={popoverOpen}
        anchorEl={leadPopoverAnchor}
        placement="right-start"
        modifiers={[{ name: "offset", options: { offset: [0, 8] } }, { name: "preventOverflow", options: { boundary: "viewport" } }]}
        sx={{ zIndex: 1300, maxWidth: 400, width: "100%" }}
        onMouseEnter={() => {
          if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
          }
        }}
        onMouseLeave={() => {
          closeTimerRef.current = setTimeout(() => {
            handlePopoverClose();
          }, 200);
        }}
      >
        {hoveredLead && (
          <Paper elevation={8} sx={{ borderRadius: 2, overflow: "hidden" }}>
            <LeadQuickView
              lead={hoveredLead}
              onUpdate={handleLeadUpdate}
              onClose={handlePopoverClose}
            />
          </Paper>
        )}
      </Popper>

      {/* Assigned Leads Modal */}
      <AssignedLeadsModal
        modal={assignedLeadsModal}
        filteredLeads={filteredLeads}
        leadsSearchQuery={leadsSearchQuery}
        setLeadsSearchQuery={setLeadsSearchQuery}
        showLeadsSearch={showLeadsSearch}
        setShowLeadsSearch={setShowLeadsSearch}
        onClose={handleCloseAssignedLeadsModal}
        onNext={handleNextLead}
        onPrev={handlePrevLead}
        getLeadWithOrderMetadata={getLeadWithOrderMetadata}
        expandedRowData={expandedRowData}
        onLeadUpdate={handleLeadUpdate}
        onConfirmDeposit={handleConfirmDeposit}
        onUnconfirmDeposit={handleUnconfirmDeposit}
        onMarkAsShaved={handleMarkAsShaved}
        onUnmarkAsShaved={handleUnmarkAsShaved}
        onMarkAsClosedNetwork={handleMarkAsClosedNetwork}
        onUnmarkAsClosedNetwork={handleUnmarkAsClosedNetwork}
        user={user}
      />

      {/* Leads Preview Modal */}
      <LeadsPreviewModal
        modal={leadsPreviewModal}
        user={user}
        onClose={handleCloseLeadsPreviewModal}
        leadRemovalMode={leadRemovalMode}
        selectedLeadsForRemoval={selectedLeadsForRemoval}
        onToggleRemovalMode={handleToggleLeadRemovalMode}
        onToggleLeadSelection={handleToggleLeadSelection}
        onSelectAllForRemoval={(ids) => setSelectedLeadsForRemoval(ids)}
        onRemoveSelected={handleRemoveSelectedLeads}
        removingLeads={removingLeads}
        removalReasonDialog={removalReasonDialog}
        setRemovalReasonDialog={setRemovalReasonDialog}
        onOpenRemovalReasonDialog={handleOpenRemovalReasonDialog}
        previewActionsMenu={previewActionsMenu}
        onOpenPreviewActionsMenu={handleOpenPreviewActionsMenu}
        onClosePreviewActionsMenu={handleClosePreviewActionsMenu}
        ipqsValidationSuccess={ipqsValidationSuccess}
        ipqsValidatingOrders={ipqsValidatingOrders}
        onDirectIPQSValidation={handleDirectIPQSValidation}
        onIPQSRecheckLead={handleIPQSRecheckLead}
        onConfirmDeposit={handleConfirmDeposit}
        onUnconfirmDeposit={handleUnconfirmDeposit}
        onMarkAsShaved={handleMarkAsShaved}
        onUnmarkAsShaved={handleUnmarkAsShaved}
        onMarkAsClosedNetwork={handleMarkAsClosedNetwork}
        onUnmarkAsClosedNetwork={handleUnmarkAsClosedNetwork}
        onOpenChangeFTD={handleOpenChangeFTDDialog}
        onOpenReplaceLead={handleOpenReplaceLeadDialog}
        onConvertLeadType={handleConvertLeadType}
        onOpenAssignLead={handleOpenAssignLeadDialog}
        onCopyToClipboard={handleCopyToClipboard}
        onOpenApplyFine={handleOpenApplyFineDialog}
        onOpenRemoveLead={handleOpenRemoveLeadDialog}
        onOpenClientBrokersDialog={handleOpenClientBrokersDialog}
        onOpenClientNetworksDialog={handleOpenClientNetworksDialog}
        onOpenOurNetworksDialog={handleOpenOurNetworksDialog}
        onOpenCampaignsDialog={handleOpenCampaignsDialog}
        onExportLeads={handleExportLeads}
        onCopyOrderLeads={handleCopyOrderLeads}
        setCopyPreferencesOpen={setCopyPreferencesOpen}
        onOpenAddLeads={handleOpenAddLeadsDialog}
        getLeadWithOrderMetadata={getLeadWithOrderMetadata}
        processingLeads={processingLeads}
        highlightLeadId={highlightLeadId}
        undoAction={undoAction}
        onUndoAction={handleUndoAction}
        undoing={undoing}
        onDismissUndo={handleDismissUndo}
        restoringLead={restoringLead}
        undoingReplacement={undoingReplacement}
        onRestoreLead={handleRestoreLead}
        onUndoReplacementFromMenu={handleUndoReplacementFromMenu}
      />

      {/* Client Brokers Display Dialog */}
      <ClientBrokersDisplayDialog
        dialog={clientBrokersDialog}
        onClose={handleCloseClientBrokersDialog}
      />

      {/* Client Networks Display Dialog */}
      <ClientNetworksDisplayDialog
        dialog={clientNetworksDialog}
        onClose={handleCloseClientNetworksDialog}
      />

      {/* Our Networks Display Dialog */}
      <OurNetworksDisplayDialog
        dialog={ourNetworksDialog}
        onClose={handleCloseOurNetworksDialog}
      />

      {/* Campaigns Display Dialog */}
      <CampaignsDisplayDialog
        dialog={campaignsDialog}
        onClose={handleCloseCampaignsDialog}
      />

      {/* Copy Preferences Dialog */}
      {copyPreferencesOpen && (
      <CopyPreferencesDialog
        open
        onClose={() => setCopyPreferencesOpen(false)}
        onSave={() => {
          setNotification({
            message: "Copy preferences saved",
            severity: "success",
          });
        }}
      />
      )}
    </Box>
  );
};

export default OrdersPage;
