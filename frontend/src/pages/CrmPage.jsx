import React, { lazy, Suspense, useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  MenuItem,
  Divider,
  FormControl,
  InputLabel,
  Select,
  Switch,
  FormControlLabel,
  Tooltip,
} from "@mui/material";
import {
  Search as SearchIcon,
  Hub as NetworkIcon,
  Business as BrokerIcon,
  Add as AddIcon,
  Lan as OurNetworkIcon,
  Campaign as CampaignIcon,
  Payment as PSPIcon,
  CreditCard as CardIssuerIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import api from "../services/api";
import toast from "react-hot-toast";
import { useSelector } from "react-redux";
import { selectUser } from "../store/slices/authSlice";
import CommentButton from "../components/CommentButton";
import useSensitiveAction from "../hooks/useSensitiveAction";
import SensitiveActionModal from "../components/SensitiveActionModal";

// Lazy-loaded standalone pages
const OurNetworksPage = lazy(() => import("./OurNetworksPage.jsx"));
const CampaignsPage = lazy(() => import("./CampaignsPage.jsx"));
const ClientPSPsPage = lazy(() => import("./ClientPSPsPage.jsx"));
const CardIssuersPage = lazy(() => import("./CardIssuersPage.jsx"));

const tabFallback = (
  <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 6 }}>
    <CircularProgress size={28} />
  </Box>
);

const brokerSchema = yup.object({
  name: yup.string().required("Name is required").max(100, "Name must be less than 100 characters"),
  domain: yup.string().max(200, "Domain must be less than 200 characters"),
  description: yup.string().max(500, "Description must be less than 500 characters"),
});

const positionOptions = [
  { value: "finance", label: "Finance" },
  { value: "boss", label: "Boss" },
  { value: "manager", label: "Manager" },
  { value: "affiliate_manager", label: "Affiliate Manager" },
  { value: "tech_support", label: "Tech Support" },
];

const compactTableSx = {
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
    bgcolor: "rgba(0, 0, 0, 0.015)",
  },
  "& .MuiTableBody-root .MuiTableRow-root:hover": {
    bgcolor: "rgba(25, 118, 210, 0.06) !important",
    transition: "background-color 0.15s ease",
  },
  "& .MuiChip-root": {
    height: "18px",
    fontSize: "0.65rem",
  },
};

// ─── Old inline CRM views ───────────────────────────────────────────────────

const OldClientNetworksTab = ({ setHeaderExtra }) => {
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const isAdmin = user?.role === "admin";
  const canManageNetworks = user?.role === "admin" || user?.role === "affiliate_manager";
  const { executeSensitiveAction, sensitiveActionState, resetSensitiveAction } =
    useSensitiveAction();
  const [search, setSearch] = useState("");
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingNetwork, setEditingNetwork] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newNetworkName, setNewNetworkName] = useState("");
  const [newNetworkDescription, setNewNetworkDescription] = useState("");
  const [employees, setEmployees] = useState([]);
  const [empName, setEmpName] = useState("");
  const [empTelegram, setEmpTelegram] = useState("");
  const [empPosition, setEmpPosition] = useState("");
  const [networks, setNetworks] = useState([]);
  const [networksLoading, setNetworksLoading] = useState(false);
  const [networksPagination, setNetworksPagination] = useState({
    current: 1,
    pages: 1,
    total: 0,
    limit: 50,
  });
  const [networkStats, setNetworkStats] = useState({
    networkStats: {},
    commentStats: {},
  });

  const handleOpenDialog = (network = null) => {
    setEditingNetwork(network);
    if (network) {
      setNewNetworkName(network.name || "");
      setNewNetworkDescription(network.description || "");
      setEmployees([]);
    } else {
      setNewNetworkName("");
      setNewNetworkDescription("");
      setEmployees([]);
    }
    setEmpName("");
    setEmpTelegram("");
    setEmpPosition("");
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingNetwork(null);
  };

  const handleAddEmployee = () => {
    if (!empName.trim() || !empPosition) return;
    setEmployees((prev) => [
      ...prev,
      {
        name: empName.trim(),
        telegramUsername: empTelegram.replace(/^@+/, "").trim(),
        position: empPosition,
      },
    ]);
    setEmpName("");
    setEmpTelegram("");
    setEmpPosition("");
  };

  const handleRemoveEmployee = (index) => {
    setEmployees((prev) => prev.filter((_, i) => i !== index));
  };

  const handleNetworkSubmit = async () => {
    if (!newNetworkName.trim()) {
      toast.error("Please enter a network name");
      return;
    }
    try {
      setCreating(true);
      if (editingNetwork) {
        await api.put(`/client-networks/${editingNetwork._id}`, {
          name: newNetworkName.trim(),
          description: newNetworkDescription.trim() || undefined,
        });
        toast.success(`Network "${newNetworkName.trim()}" updated`);
      } else {
        const response = await api.post("/client-networks", {
          name: newNetworkName.trim(),
          description: newNetworkDescription.trim() || undefined,
        });
        const newNetwork = response.data.data;

        if (employees.length > 0) {
          const results = await Promise.allSettled(
            employees.map((emp) =>
              api.post(`/client-networks/${newNetwork._id}/employees`, emp)
            )
          );
          const failed = results.filter((r) => r.status === "rejected").length;
          if (failed > 0) {
            toast.error(`Failed to add ${failed} employee(s)`);
          }
        }
        toast.success(`Network "${newNetwork.name}" created`);
      }
      handleCloseDialog();
      fetchNetworks(networksPagination.current);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save network");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (network, e) => {
    e.stopPropagation();
    try {
      await api.put(`/client-networks/${network._id}`, {
        isActive: !network.isActive,
      });
      toast.success(`Network "${network.name}" ${!network.isActive ? "activated" : "deactivated"}`);
      fetchNetworks(networksPagination.current);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update network status");
    }
  };

  const handleDelete = async (network, e) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete "${network.name}"? This requires 2FA verification.`)) {
      return;
    }
    try {
      await executeSensitiveAction({
        actionName: "Delete Client Network",
        actionDescription: `This will permanently delete the client network "${network.name}".`,
        apiCall: async (headers) => {
          return await api.delete(`/client-networks/${network._id}`, { headers });
        },
      });
      toast.success(`Network "${network.name}" deleted`);
      fetchNetworks(1);
    } catch (error) {
      if (error.message === "User cancelled sensitive action") return;
      toast.error(error.response?.data?.message || "Failed to delete network");
    }
  };

  const fetchNetworks = useCallback(
    async (page = 1) => {
      try {
        setNetworksLoading(true);
        const response = await api.get("/client-networks", {
          params: {
            page,
            limit: 50,
            search: search || undefined,
            ...(showActiveOnly && { isActive: "true" }),
          },
        });
        setNetworks(response.data.data);
        setNetworksPagination(response.data.pagination);
      } catch (error) {
        toast.error("Failed to load client networks");
      } finally {
        setNetworksLoading(false);
      }
    },
    [search, showActiveOnly]
  );

  const fetchNetworkStats = useCallback(async () => {
    try {
      const response = await api.get("/crm-deals/dashboard-stats");
      setNetworkStats(response.data.data);
    } catch (error) {
      console.error("Failed to load CRM stats", error);
    }
  }, []);

  useEffect(() => {
    fetchNetworks();
    fetchNetworkStats();
  }, [fetchNetworks, fetchNetworkStats]);

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter") {
      fetchNetworks(1);
      fetchNetworkStats();
    }
  };

  const getNetworkDealsCount = (networkId) =>
    networkStats.networkStats?.[networkId]?.ordersCount || 0;

  const getNetworkUnresolvedComments = (networkId) =>
    networkStats.commentStats?.[networkId] || 0;

  const colSpan = canManageNetworks ? 10 : 9;

  // Push filters to CRM header
  useEffect(() => {
    if (!setHeaderExtra) return;
    setHeaderExtra(
      <>
        <FormControlLabel
          control={<Switch checked={showActiveOnly} onChange={(e) => setShowActiveOnly(e.target.checked)} size="small" />}
          label={<Typography sx={{ fontSize: "0.7rem" }}>Active only</Typography>}
          sx={{ mr: 0, ml: 0 }}
        />
        <TextField
          size="small"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 14, color: "text.disabled" }} />
              </InputAdornment>
            ),
          }}
          sx={{ width: 160, "& .MuiOutlinedInput-root": { borderRadius: 5, fontSize: "0.75rem", height: 28 } }}
        />
        {canManageNetworks && (
          <IconButton
            size="small"
            color="primary"
            onClick={() => handleOpenDialog()}
            sx={{ width: 28, height: 28, bgcolor: "primary.main", color: "#fff", "&:hover": { bgcolor: "primary.dark" } }}
          >
            <AddIcon sx={{ fontSize: 16 }} />
          </IconButton>
        )}
      </>
    );
  }, [setHeaderExtra, showActiveOnly, search, canManageNetworks]);

  useEffect(() => {
    return () => { if (setHeaderExtra) setHeaderExtra(null); };
  }, [setHeaderExtra]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <Paper sx={{ borderRadius: 2, border: 1, borderColor: "divider", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", overflow: "hidden", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <TableContainer sx={{ flex: 1, overflow: "auto" }}>
          <Table size="small" stickyHeader sx={compactTableSx}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: "22%" }}>Name</TableCell>
                <TableCell sx={{ textAlign: "center", width: "8%" }}>Status</TableCell>
                <TableCell sx={{ textAlign: "center", width: "9%" }}>Deal Type</TableCell>
                <TableCell sx={{ textAlign: "center", width: "9%" }}>Employees</TableCell>
                <TableCell sx={{ textAlign: "center", width: "9%" }}>Brokers</TableCell>
                <TableCell sx={{ textAlign: "center", width: "9%" }}>CRM Deals</TableCell>
                <TableCell sx={{ textAlign: "center", width: "9%" }}>Open Comments</TableCell>
                <TableCell sx={{ textAlign: "center", width: "5%" }}>Notes</TableCell>
                <TableCell sx={{ textAlign: "center", width: "10%" }}>Created By</TableCell>
                {canManageNetworks && (
                  <TableCell sx={{ textAlign: "right", width: "14%" }}>Actions</TableCell>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {networksLoading ? (
                <TableRow>
                  <TableCell colSpan={colSpan} align="center" sx={{ py: 3 }}>
                    <CircularProgress size={22} />
                  </TableCell>
                </TableRow>
              ) : networks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colSpan} align="center" sx={{ py: 3 }}>
                    <Typography variant="caption" color="text.secondary">
                      No client networks found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                networks.map((network) => (
                  <TableRow
                    key={network._id}
                    hover
                    sx={{ cursor: "pointer", height: 32 }}
                    onClick={() => navigate(`/client-network/${network._id}`)}
                  >
                    <TableCell>
                      <Typography noWrap sx={{ fontWeight: 500, fontSize: "0.78rem" }}>
                        {network.name}
                      </Typography>
                      {network.description && (
                        <Typography noWrap sx={{ fontSize: "0.65rem", color: "text.secondary" }}>
                          {network.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ textAlign: "center" }}>
                      <Chip
                        label={network.isActive ? "Active" : "Inactive"}
                        color={network.isActive ? "success" : "default"}
                        size="small"
                      />
                    </TableCell>
                    <TableCell sx={{ textAlign: "center" }}>
                      {network.dealType ? (
                        <Chip
                          label={network.dealType === "both" ? "Both" : network.dealType === "buy" ? "Buy" : "Sell"}
                          color={network.dealType === "buy" ? "success" : network.dealType === "sell" ? "error" : "info"}
                          size="small"
                          variant="outlined"
                        />
                      ) : (
                        <Typography sx={{ fontSize: "0.75rem", color: "text.disabled" }}>-</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ textAlign: "center" }}>
                      {network.employees?.length || 0}
                    </TableCell>
                    <TableCell sx={{ textAlign: "center" }}>
                      {networkStats.networkStats?.[network._id]?.brokerCount || 0}
                    </TableCell>
                    <TableCell sx={{ textAlign: "center" }}>
                      {getNetworkDealsCount(network._id)}
                    </TableCell>
                    <TableCell sx={{ textAlign: "center" }}>
                      {getNetworkUnresolvedComments(network._id) > 0 ? (
                        <Chip
                          label={getNetworkUnresolvedComments(network._id)}
                          color="warning"
                          size="small"
                        />
                      ) : (
                        <Typography sx={{ fontSize: "0.75rem", color: "text.disabled" }}>0</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                      <CommentButton
                        targetType="client_network"
                        targetId={network._id}
                        targetName={network.name}
                      />
                    </TableCell>
                    <TableCell sx={{ textAlign: "center" }}>
                      <Typography noWrap sx={{ fontSize: "0.72rem", color: "text.secondary" }}>
                        {network.createdBy?.fullName || "-"}
                      </Typography>
                    </TableCell>
                    {canManageNetworks && (
                      <TableCell sx={{ textAlign: "right" }}>
                        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 0.25 }}>
                          <Tooltip title="Edit">
                            <IconButton
                              size="small"
                              onClick={(e) => { e.stopPropagation(); handleOpenDialog(network); }}
                              sx={{ p: 0.25 }}
                            >
                              <EditIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                          {isAdmin && (
                            <Tooltip title={network.isActive ? "Deactivate" : "Activate"}>
                              <Switch
                                checked={network.isActive}
                                size="small"
                                onClick={(e) => handleToggleActive(network, e)}
                                sx={{ mx: 0 }}
                              />
                            </Tooltip>
                          )}
                          {isAdmin && (
                            <Tooltip title="Delete">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={(e) => handleDelete(network, e)}
                                sx={{ p: 0.25 }}
                              >
                                <DeleteIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {networksPagination.total > 0 && (
          <TablePagination
            component="div"
            count={networksPagination.total}
            page={networksPagination.current - 1}
            onPageChange={(e, p) => fetchNetworks(p + 1)}
            rowsPerPage={networksPagination.limit}
            rowsPerPageOptions={[networksPagination.limit]}
            sx={{ flexShrink: 0, borderTop: 1, borderColor: "divider", "& .MuiTablePagination-toolbar": { minHeight: 36 }, "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows": { fontSize: "0.75rem" } }}
          />
        )}
      </Paper>

      {/* Add/Edit Network Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingNetwork ? "Edit Client Network" : "Add Client Network"}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <TextField
              label="Network Name"
              value={newNetworkName}
              onChange={(e) => setNewNetworkName(e.target.value)}
              fullWidth
              required
              placeholder="Enter network name..."
              inputProps={{ maxLength: 100 }}
            />
            <TextField
              label="Description (optional)"
              value={newNetworkDescription}
              onChange={(e) => setNewNetworkDescription(e.target.value)}
              fullWidth
              multiline
              rows={2}
              placeholder="Add a description..."
              inputProps={{ maxLength: 500 }}
            />

            {!editingNetwork && (
              <>
                <Divider sx={{ my: 0.5 }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Employees (optional)
                </Typography>

                {employees.length > 0 && (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {employees.map((emp, idx) => (
                      <Chip
                        key={idx}
                        label={`${emp.name} - ${positionOptions.find((p) => p.value === emp.position)?.label || emp.position}${emp.telegramUsername ? ` (@${emp.telegramUsername})` : ""}`}
                        onDelete={() => handleRemoveEmployee(idx)}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                )}

                <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                  <TextField
                    label="Name"
                    value={empName}
                    onChange={(e) => setEmpName(e.target.value)}
                    size="small"
                    sx={{ flex: 1 }}
                    inputProps={{ maxLength: 100 }}
                  />
                  <TextField
                    label="Telegram"
                    value={empTelegram}
                    onChange={(e) => setEmpTelegram(e.target.value.replace(/^@+/, ""))}
                    size="small"
                    sx={{ flex: 1 }}
                    placeholder="username"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start" sx={{ mr: 0 }}>
                          <span style={{ fontWeight: 700, color: "#1976d2" }}>@</span>
                        </InputAdornment>
                      ),
                    }}
                    inputProps={{ maxLength: 100 }}
                  />
                </Box>
                <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                  <FormControl size="small" sx={{ flex: 1 }}>
                    <InputLabel>Position</InputLabel>
                    <Select
                      value={empPosition}
                      onChange={(e) => setEmpPosition(e.target.value)}
                      label="Position"
                    >
                      {positionOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <IconButton
                    color="primary"
                    onClick={handleAddEmployee}
                    disabled={!empName.trim() || !empPosition}
                    sx={{
                      border: "1px solid",
                      borderColor: !empName.trim() || !empPosition ? "action.disabled" : "primary.main",
                      borderRadius: 1,
                    }}
                  >
                    <AddIcon />
                  </IconButton>
                </Box>
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={creating}>Cancel</Button>
          <Button
            onClick={handleNetworkSubmit}
            variant="contained"
            disabled={creating || !newNetworkName.trim()}
          >
            {creating ? <CircularProgress size={20} /> : editingNetwork ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Sensitive Action 2FA Modal */}
      <SensitiveActionModal
        open={sensitiveActionState.showModal}
        onClose={resetSensitiveAction}
        onVerify={(code, useBackup) => sensitiveActionState.handleVerify(code, useBackup)}
        onQRVerify={(token) => sensitiveActionState.handleQRVerify(token)}
        actionName={sensitiveActionState.actionName}
        actionDescription={sensitiveActionState.actionDescription}
        loading={sensitiveActionState.verifying}
        error={sensitiveActionState.error}
        requires2FASetup={sensitiveActionState.requires2FASetup}
        userId={sensitiveActionState.userId}
        qrAuthEnabled={sensitiveActionState.qrAuthEnabled}
      />
    </Box>
  );
};

const OldClientBrokersTab = ({ setHeaderExtra }) => {
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const isAdmin = user?.role === "admin";
  const canManageBrokers = user?.role === "admin" || user?.role === "affiliate_manager";
  const [search, setSearch] = useState("");
  const [openDialog, setOpenDialog] = useState(false);
  const [editingBroker, setEditingBroker] = useState(null);
  const [deleteConfirmBroker, setDeleteConfirmBroker] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [brokers, setBrokers] = useState([]);
  const [brokersLoading, setBrokersLoading] = useState(false);
  const [brokersPagination, setBrokersPagination] = useState({
    current: 1,
    pages: 1,
    total: 0,
    limit: 50,
  });
  const [networkStats, setNetworkStats] = useState({
    brokerStats: {},
  });

  const brokerForm = useForm({
    resolver: yupResolver(brokerSchema),
    defaultValues: { name: "", domain: "", description: "" },
  });

  const handleOpenDialog = (broker = null) => {
    setEditingBroker(broker);
    if (broker) {
      brokerForm.reset({
        name: broker.name || "",
        domain: broker.domain || "",
        description: broker.description || "",
      });
    } else {
      brokerForm.reset({ name: "", domain: "", description: "" });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingBroker(null);
  };

  const onBrokerSubmit = async (data) => {
    try {
      if (editingBroker) {
        await api.put(`/client-brokers/${editingBroker._id}`, data);
        toast.success(`Broker "${data.name}" updated`);
      } else {
        await api.post("/client-brokers", data);
        toast.success("Broker created successfully");
      }
      handleCloseDialog();
      fetchBrokers(editingBroker ? brokersPagination.current : 1);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save broker");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmBroker) return;
    try {
      setDeleting(true);
      await api.delete(`/client-brokers/${deleteConfirmBroker._id}`);
      toast.success(`Broker "${deleteConfirmBroker.name}" deleted`);
      setDeleteConfirmBroker(null);
      fetchBrokers(1);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete broker");
    } finally {
      setDeleting(false);
    }
  };

  const fetchBrokers = useCallback(
    async (page = 1) => {
      try {
        setBrokersLoading(true);
        const response = await api.get("/client-brokers", {
          params: {
            page,
            limit: 50,
            search: search || undefined,
          },
        });
        setBrokers(response.data.data);
        setBrokersPagination({
          current: response.data.pagination.page,
          pages: response.data.pagination.pages,
          total: response.data.pagination.total,
          limit: response.data.pagination.limit,
        });
      } catch (error) {
        toast.error("Failed to load client brokers");
      } finally {
        setBrokersLoading(false);
      }
    },
    [search]
  );

  const fetchNetworkStats = useCallback(async () => {
    try {
      const response = await api.get("/crm-deals/dashboard-stats");
      setNetworkStats(response.data.data);
    } catch (error) {
      console.error("Failed to load CRM stats", error);
    }
  }, []);

  useEffect(() => {
    fetchBrokers();
    fetchNetworkStats();
  }, [fetchBrokers, fetchNetworkStats]);

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter") {
      fetchBrokers(1);
    }
  };

  const colSpan = canManageBrokers ? 8 : 7;

  // Push filters to CRM header
  useEffect(() => {
    if (!setHeaderExtra) return;
    setHeaderExtra(
      <>
        <TextField
          size="small"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 14, color: "text.disabled" }} />
              </InputAdornment>
            ),
          }}
          sx={{ width: 160, "& .MuiOutlinedInput-root": { borderRadius: 5, fontSize: "0.75rem", height: 28 } }}
        />
        {canManageBrokers && (
          <IconButton
            size="small"
            color="primary"
            onClick={() => handleOpenDialog()}
            sx={{ width: 28, height: 28, bgcolor: "primary.main", color: "#fff", "&:hover": { bgcolor: "primary.dark" } }}
          >
            <AddIcon sx={{ fontSize: 16 }} />
          </IconButton>
        )}
      </>
    );
  }, [setHeaderExtra, search, canManageBrokers]);

  useEffect(() => {
    return () => { if (setHeaderExtra) setHeaderExtra(null); };
  }, [setHeaderExtra]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <Paper sx={{ borderRadius: 2, border: 1, borderColor: "divider", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", overflow: "hidden", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <TableContainer sx={{ flex: 1, overflow: "auto" }}>
          <Table size="small" stickyHeader sx={compactTableSx}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: "24%" }}>Name</TableCell>
                <TableCell sx={{ width: "18%" }}>Domain</TableCell>
                <TableCell sx={{ textAlign: "center", width: "10%" }}>Status</TableCell>
                <TableCell sx={{ textAlign: "center", width: "10%" }}>PSPs</TableCell>
                <TableCell sx={{ textAlign: "center", width: "10%" }}>Total Leads</TableCell>
                <TableCell sx={{ textAlign: "center", width: "5%" }}>Notes</TableCell>
                {canManageBrokers && (
                  <TableCell sx={{ textAlign: "right", width: "18%" }}>Actions</TableCell>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {brokersLoading ? (
                <TableRow>
                  <TableCell colSpan={colSpan} align="center" sx={{ py: 3 }}>
                    <CircularProgress size={22} />
                  </TableCell>
                </TableRow>
              ) : brokers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colSpan} align="center" sx={{ py: 3 }}>
                    <Typography variant="caption" color="text.secondary">
                      No client brokers found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                brokers.map((broker) => (
                  <TableRow
                    key={broker._id}
                    hover
                    sx={{ cursor: "pointer", height: 32 }}
                    onClick={() => navigate(`/client-broker/${broker._id}`)}
                  >
                    <TableCell>
                      <Typography noWrap sx={{ fontWeight: 500, fontSize: "0.78rem" }}>
                        {broker.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography noWrap sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                        {broker.domain && !broker.domain.startsWith("autogen-")
                          ? broker.domain
                          : "-"}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ textAlign: "center" }}>
                      <Chip
                        label={broker.isActive ? "Active" : "Inactive"}
                        color={broker.isActive ? "success" : "default"}
                        size="small"
                      />
                    </TableCell>
                    <TableCell sx={{ textAlign: "center" }}>
                      {networkStats.brokerStats?.[broker._id]?.pspCount || 0}
                    </TableCell>
                    <TableCell sx={{ textAlign: "center" }}>
                      {networkStats.brokerStats?.[broker._id]?.totalLeads || 0}
                    </TableCell>
                    <TableCell sx={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                      <CommentButton
                        targetType="client_broker"
                        targetId={broker._id}
                        targetName={broker.name}
                      />
                    </TableCell>
                    {canManageBrokers && (
                      <TableCell sx={{ textAlign: "right" }}>
                        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 0.25 }}>
                          <Tooltip title="Edit">
                            <IconButton
                              size="small"
                              onClick={(e) => { e.stopPropagation(); handleOpenDialog(broker); }}
                              sx={{ p: 0.25 }}
                            >
                              <EditIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                          {isAdmin && (
                            <Tooltip title="Delete">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={(e) => { e.stopPropagation(); setDeleteConfirmBroker(broker); }}
                                sx={{ p: 0.25 }}
                              >
                                <DeleteIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {brokersPagination.total > 0 && (
          <TablePagination
            component="div"
            count={brokersPagination.total}
            page={brokersPagination.current - 1}
            onPageChange={(e, p) => fetchBrokers(p + 1)}
            rowsPerPage={brokersPagination.limit}
            rowsPerPageOptions={[brokersPagination.limit]}
            sx={{ flexShrink: 0, borderTop: 1, borderColor: "divider", "& .MuiTablePagination-toolbar": { minHeight: 36 }, "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows": { fontSize: "0.75rem" } }}
          />
        )}
      </Paper>

      {/* Add/Edit Broker Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <form onSubmit={brokerForm.handleSubmit(onBrokerSubmit)}>
          <DialogTitle>{editingBroker ? "Edit Client Broker" : "Add Client Broker"}</DialogTitle>
          <DialogContent>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
              <Controller
                name="name"
                control={brokerForm.control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Broker Name"
                    fullWidth
                    error={!!brokerForm.formState.errors.name}
                    helperText={brokerForm.formState.errors.name?.message}
                  />
                )}
              />
              <Controller
                name="domain"
                control={brokerForm.control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Domain/Website"
                    fullWidth
                    error={!!brokerForm.formState.errors.domain}
                    helperText={brokerForm.formState.errors.domain?.message}
                  />
                )}
              />
              <Controller
                name="description"
                control={brokerForm.control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Description"
                    fullWidth
                    multiline
                    rows={3}
                    error={!!brokerForm.formState.errors.description}
                    helperText={brokerForm.formState.errors.description?.message}
                  />
                )}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={brokerForm.formState.isSubmitting}>
              {brokerForm.formState.isSubmitting ? <CircularProgress size={20} /> : editingBroker ? "Update" : "Create"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmBroker} onClose={() => setDeleteConfirmBroker(null)} maxWidth="xs">
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete broker "{deleteConfirmBroker?.name}"?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmBroker(null)} disabled={deleting}>Cancel</Button>
          <Button
            onClick={handleDeleteConfirm}
            variant="contained"
            color="error"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} /> : <DeleteIcon />}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// ─── Tab config ──────────────────────────────────────────────────────────────

const tabs = [
  { label: "Client Networks", icon: <NetworkIcon sx={{ fontSize: 16, color: "#1976d2" }} /> },
  { label: "Client Brokers", icon: <BrokerIcon sx={{ fontSize: 16, color: "#7b1fa2" }} /> },
  { label: "Our Networks", icon: <OurNetworkIcon sx={{ fontSize: 16, color: "#2e7d32" }} /> },
  { label: "Campaigns", icon: <CampaignIcon sx={{ fontSize: 16, color: "#ed6c02" }} /> },
  { label: "PSPs", icon: <PSPIcon sx={{ fontSize: 16, color: "#d32f2f" }} /> },
  { label: "Card Issuers", icon: <CardIssuerIcon sx={{ fontSize: 16, color: "#0288d1" }} /> },
];

// ─── Main CRM Page ──────────────────────────────────────────────────────────

const CrmPage = () => {
  const location = useLocation();
  const user = useSelector(selectUser);
  const isAdmin = user?.role === "admin";
  const [headerExtra, setHeaderExtra] = useState(null);

  const onSetHeaderExtra = useCallback((node) => setHeaderExtra(node), []);

  // Filter tabs: Campaigns is admin-only
  const visibleTabs = isAdmin ? tabs : tabs.filter((t) => t.label !== "Campaigns");

  // Map visible tab index → content key
  const tabContentMap = visibleTabs.map((t) => tabs.indexOf(t));

  const [tab, setTab] = useState(location.state?.tab ?? 0);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <Paper sx={{ px: 2, py: 0.5, mb: 1, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Tabs
            value={tab}
            onChange={(e, v) => { setTab(v); setHeaderExtra(null); }}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              minHeight: 36,
              "& .MuiTab-root": { minHeight: 36, py: 0.3, fontSize: "0.8rem", minWidth: "auto", px: 1.5 },
            }}
          >
            {visibleTabs.map((t, i) => (
              <Tab key={i} icon={t.icon} iconPosition="start" label={t.label} />
            ))}
          </Tabs>
          {headerExtra && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0, ml: 'auto', pl: 2 }}>
              {headerExtra}
            </Box>
          )}
        </Box>
      </Paper>

      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        {tabContentMap[tab] === 0 && <OldClientNetworksTab setHeaderExtra={onSetHeaderExtra} />}
        {tabContentMap[tab] === 1 && <OldClientBrokersTab setHeaderExtra={onSetHeaderExtra} />}
        <Suspense fallback={tabFallback}>
          {tabContentMap[tab] === 2 && <OurNetworksPage setHeaderExtra={onSetHeaderExtra} />}
          {tabContentMap[tab] === 3 && <CampaignsPage />}
          {tabContentMap[tab] === 4 && <ClientPSPsPage setHeaderExtra={onSetHeaderExtra} />}
          {tabContentMap[tab] === 5 && <CardIssuersPage setHeaderExtra={onSetHeaderExtra} />}
        </Suspense>
      </Box>
    </Box>
  );
};

export default CrmPage;
