import React, { useState, useEffect, useCallback } from "react";
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
} from "@mui/material";
import {
  Search as SearchIcon,
  Hub as NetworkIcon,
  Business as BrokerIcon,
  Add as AddIcon,
} from "@mui/icons-material";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import api from "../services/api";
import toast from "react-hot-toast";

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

const CrmPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [tab, setTab] = useState(location.state?.tab ?? 0);
  const [search, setSearch] = useState("");
  const [openDialog, setOpenDialog] = useState(false);
  const [creating, setCreating] = useState(false);

  // Network dialog state (matches ReferenceSelector design)
  const [newNetworkName, setNewNetworkName] = useState("");
  const [newNetworkDescription, setNewNetworkDescription] = useState("");
  const [employees, setEmployees] = useState([]);
  const [empName, setEmpName] = useState("");
  const [empTelegram, setEmpTelegram] = useState("");
  const [empPosition, setEmpPosition] = useState("");

  const brokerForm = useForm({
    resolver: yupResolver(brokerSchema),
    defaultValues: { name: "", domain: "", description: "" },
  });

  const handleOpenDialog = () => {
    if (tab === 0) {
      setNewNetworkName("");
      setNewNetworkDescription("");
      setEmployees([]);
      setEmpName("");
      setEmpTelegram("");
      setEmpPosition("");
    } else {
      brokerForm.reset({ name: "", domain: "", description: "" });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
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
      handleCloseDialog();
      fetchNetworks(1);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create network");
    } finally {
      setCreating(false);
    }
  };

  const onBrokerSubmit = async (data) => {
    try {
      await api.post("/client-brokers", data);
      toast.success("Broker created successfully");
      handleCloseDialog();
      fetchBrokers(1);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create broker");
    }
  };

  // Client Networks state
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

  // Client Brokers state
  const [brokers, setBrokers] = useState([]);
  const [brokersLoading, setBrokersLoading] = useState(false);
  const [brokersPagination, setBrokersPagination] = useState({
    current: 1,
    pages: 1,
    total: 0,
    limit: 50,
  });

  const fetchNetworks = useCallback(
    async (page = 1) => {
      try {
        setNetworksLoading(true);
        const response = await api.get("/client-networks", {
          params: { page, limit: 50, search: search || undefined },
        });
        setNetworks(response.data.data);
        setNetworksPagination(response.data.pagination);
      } catch (error) {
        toast.error("Failed to load client networks");
      } finally {
        setNetworksLoading(false);
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

  const fetchBrokers = useCallback(
    async (page = 1) => {
      try {
        setBrokersLoading(true);
        const response = await api.get("/client-brokers", {
          params: { page, limit: 50, search: search || undefined },
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

  useEffect(() => {
    if (tab === 0) {
      fetchNetworks();
      fetchNetworkStats();
    } else {
      fetchBrokers();
      fetchNetworkStats();
    }
  }, [tab, fetchNetworks, fetchBrokers, fetchNetworkStats]);

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter") {
      if (tab === 0) {
        fetchNetworks(1);
        fetchNetworkStats();
      } else {
        fetchBrokers(1);
      }
    }
  };

  const getNetworkDealsCount = (networkId) => {
    return networkStats.networkStats?.[networkId]?.ordersCount || 0;
  };

  const getNetworkUnresolvedComments = (networkId) => {
    return networkStats.commentStats?.[networkId] || 0;
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <Paper sx={{ px: 2, py: 0.5, mb: 1, flexShrink: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ minHeight: 36, "& .MuiTab-root": { minHeight: 36, py: 0.3, fontSize: "0.8rem" } }}>
            <Tab icon={<NetworkIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Client Networks" />
            <Tab icon={<BrokerIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Client Brokers" />
          </Tabs>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <TextField
              size="small"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 16 }} />
                  </InputAdornment>
                ),
              }}
              sx={{ width: 220, "& .MuiInputBase-root": { height: 30, fontSize: "0.8rem", borderRadius: "20px" } }}
            />
            <IconButton
              size="small"
              color="primary"
              onClick={handleOpenDialog}
              sx={{
                width: 30,
                height: 30,
                bgcolor: "primary.main",
                color: "#fff",
                "&:hover": { bgcolor: "primary.dark" },
              }}
            >
              <AddIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        </Box>
      </Paper>

      {/* Client Networks Tab */}
      {tab === 0 && (
        <Paper sx={{ borderRadius: 2, border: 1, borderColor: "divider", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", overflow: "hidden", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <TableContainer sx={{ flex: 1, overflow: "auto" }}>
            <Table size="small" stickyHeader sx={compactTableSx}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: "26%" }}>Name</TableCell>
                  <TableCell sx={{ textAlign: "center", width: "9%" }}>Status</TableCell>
                  <TableCell sx={{ textAlign: "center", width: "10%" }}>Deal Type</TableCell>
                  <TableCell sx={{ textAlign: "center", width: "11%" }}>Employees</TableCell>
                  <TableCell sx={{ textAlign: "center", width: "11%" }}>Brokers</TableCell>
                  <TableCell sx={{ textAlign: "center", width: "11%" }}>CRM Deals</TableCell>
                  <TableCell sx={{ textAlign: "center", width: "11%" }}>Open Comments</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {networksLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                      <CircularProgress size={22} />
                    </TableCell>
                  </TableRow>
                ) : networks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
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
      )}

      {/* Client Brokers Tab */}
      {tab === 1 && (
        <Paper sx={{ borderRadius: 2, border: 1, borderColor: "divider", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", overflow: "hidden", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <TableContainer sx={{ flex: 1, overflow: "auto" }}>
            <Table size="small" stickyHeader sx={compactTableSx}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: "30%" }}>Name</TableCell>
                  <TableCell sx={{ width: "25%" }}>Domain</TableCell>
                  <TableCell sx={{ textAlign: "center", width: "15%" }}>Status</TableCell>
                  <TableCell sx={{ textAlign: "center", width: "15%" }}>PSPs</TableCell>
                  <TableCell sx={{ textAlign: "center", width: "15%" }}>Total Leads</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {brokersLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                      <CircularProgress size={22} />
                    </TableCell>
                  </TableRow>
                ) : brokers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
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
      )}
      {/* Add Network Dialog */}
      <Dialog open={openDialog && tab === 0} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Add Client Network</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <TextField
              label="Network Name"
              value={newNetworkName}
              onChange={(e) => setNewNetworkName(e.target.value)}
              fullWidth
              required
              placeholder="Enter new network name..."
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

            {/* Employees Section */}
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
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={creating}>Cancel</Button>
          <Button
            onClick={handleNetworkSubmit}
            variant="contained"
            disabled={creating || !newNetworkName.trim()}
          >
            {creating ? <CircularProgress size={20} /> : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Broker Dialog */}
      <Dialog open={openDialog && tab === 1} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <form onSubmit={brokerForm.handleSubmit(onBrokerSubmit)}>
          <DialogTitle>Add Client Broker</DialogTitle>
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
              {brokerForm.formState.isSubmitting ? <CircularProgress size={20} /> : "Create"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default CrmPage;
