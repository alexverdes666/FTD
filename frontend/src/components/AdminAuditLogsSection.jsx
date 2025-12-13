import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardHeader,
  CardContent,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Collapse,
  Avatar,
  TextField,
  Button,
  InputAdornment,
} from "@mui/material";
import {
  FilterList,
  Refresh,
  ExpandMore,
  ExpandLess,
  History,
  PersonAdd,
  PersonRemove,
  AccountBalanceWallet,
  Add,
  Edit,
  Delete,
  ToggleOn,
  RemoveCircle,
  Search,
  Clear,
} from "@mui/icons-material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import networkAuditService from "../services/networkAuditService";

dayjs.extend(relativeTime);

const AdminAuditLogsSection = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(true);
  const [pagination, setPagination] = useState({
    current: 1,
    pages: 1,
    total: 0,
    limit: 20,
  });

  // Filter states
  const [filters, setFilters] = useState({
    resourceType: "",
    category: "",
    action: "",
    blockchain: "",
    search: "",
    startDate: null,
    endDate: null,
  });

  // Resource type options for filtering
  const resourceTypes = [
    { value: "", label: "All Resources" },
    { value: "our_networks", label: "Our Networks" },
    // Future: add more resource types as they're implemented
    // { value: "client_networks", label: "Client Networks" },
    // { value: "client_brokers", label: "Client Brokers" },
  ];

  const fetchLogs = useCallback(
    async (page = 1) => {
      setLoading(true);
      setError(null);

      try {
        const filterParams = {
          page,
          limit: pagination.limit,
        };

        if (filters.category) filterParams.category = filters.category;
        if (filters.action) filterParams.action = filters.action;
        if (filters.blockchain) filterParams.blockchain = filters.blockchain;
        if (filters.search) filterParams.search = filters.search;
        if (filters.startDate)
          filterParams.startDate = filters.startDate.toISOString();
        if (filters.endDate)
          filterParams.endDate = filters.endDate.toISOString();

        const response = await networkAuditService.getAllAuditLogs(
          filterParams
        );

        setLogs(response.data || []);
        setPagination(
          response.pagination || {
            current: 1,
            pages: 1,
            total: 0,
            limit: 20,
          }
        );
      } catch (err) {
        console.error("Error fetching audit logs:", err);
        setError(err.response?.data?.message || "Failed to fetch audit logs");
      } finally {
        setLoading(false);
      }
    },
    [filters, pagination.limit]
  );

  // Auto-fetch when filters change
  useEffect(() => {
    fetchLogs(1);
  }, [filters]);

  const handlePageChange = (event, newPage) => {
    fetchLogs(newPage + 1);
  };

  const handleRowsPerPageChange = (event) => {
    setPagination((prev) => ({
      ...prev,
      limit: parseInt(event.target.value, 10),
    }));
  };

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleResetFilters = () => {
    setFilters({
      resourceType: "",
      category: "",
      action: "",
      blockchain: "",
      search: "",
      startDate: null,
      endDate: null,
    });
    setTimeout(() => fetchLogs(1), 100);
  };

  const getActionIcon = (action) => {
    const icons = {
      NETWORK_CREATED: <Add sx={{ fontSize: 18 }} />,
      NETWORK_UPDATED: <Edit sx={{ fontSize: 18 }} />,
      NETWORK_DELETED: <Delete sx={{ fontSize: 18 }} />,
      WALLET_ADDED: <AccountBalanceWallet sx={{ fontSize: 18 }} />,
      WALLET_REMOVED: <RemoveCircle sx={{ fontSize: 18 }} />,
      WALLET_UPDATED: <Edit sx={{ fontSize: 18 }} />,
      MANAGER_ASSIGNED: <PersonAdd sx={{ fontSize: 18 }} />,
      MANAGER_REMOVED: <PersonRemove sx={{ fontSize: 18 }} />,
      STATUS_CHANGED: <ToggleOn sx={{ fontSize: 18 }} />,
    };
    return icons[action] || <History sx={{ fontSize: 18 }} />;
  };

  const getActionColor = (action) => {
    const colors = {
      NETWORK_CREATED: "success",
      NETWORK_UPDATED: "info",
      NETWORK_DELETED: "error",
      WALLET_ADDED: "success",
      WALLET_REMOVED: "error",
      WALLET_UPDATED: "warning",
      MANAGER_ASSIGNED: "primary",
      MANAGER_REMOVED: "warning",
      STATUS_CHANGED: "info",
    };
    return colors[action] || "default";
  };

  const getCategoryColor = (category) => {
    const colors = {
      network: "primary",
      wallet: "secondary",
      manager: "info",
      status: "warning",
    };
    return colors[category] || "default";
  };

  const getBlockchainChip = (blockchain) => {
    if (!blockchain) return null;

    const colors = {
      ethereum: { bg: "#627EEA", label: "ETH" },
      bitcoin: { bg: "#F7931A", label: "BTC" },
      tron: { bg: "#FF0013", label: "TRX" },
    };

    const config = colors[blockchain];
    if (!config) return null;

    return (
      <Chip
        label={config.label}
        size="small"
        sx={{
          backgroundColor: config.bg,
          color: "white",
          fontWeight: "bold",
          fontSize: "0.7rem",
          height: 20,
        }}
      />
    );
  };

  return (
    <Card>
      <CardHeader
        title={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <History color="primary" />
            <Typography variant="h6">System Audit Logs</Typography>
          </Box>
        }
        action={
          <Box sx={{ display: "flex", gap: 1 }}>
            <Tooltip title="Refresh">
              <IconButton
                onClick={() => fetchLogs(pagination.current)}
                size="small"
              >
                <Refresh />
              </IconButton>
            </Tooltip>
            <Tooltip title={showFilters ? "Hide Filters" : "Show Filters"}>
              <IconButton
                onClick={() => setShowFilters(!showFilters)}
                size="small"
                color={showFilters ? "primary" : "default"}
              >
                {showFilters ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
            </Tooltip>
          </Box>
        }
      />
      <CardContent>
        {/* Filter Section */}
        <Collapse in={showFilters}>
          <Paper sx={{ p: 2, mb: 2, backgroundColor: "grey.50" }}>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: "bold" }}>
              Filters
            </Typography>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <Box
                sx={{
                  display: "flex",
                  gap: 2,
                  flexWrap: "wrap",
                  alignItems: "center",
                  mb: 2,
                }}
              >
                {/* Resource Type Filter */}
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel>Resource Type</InputLabel>
                  <Select
                    value={filters.resourceType}
                    onChange={(e) =>
                      handleFilterChange("resourceType", e.target.value)
                    }
                    label="Resource Type"
                  >
                    {resourceTypes.map((type) => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Category Filter */}
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={filters.category}
                    onChange={(e) =>
                      handleFilterChange("category", e.target.value)
                    }
                    label="Category"
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="network">Network</MenuItem>
                    <MenuItem value="wallet">Wallet</MenuItem>
                    <MenuItem value="manager">Manager</MenuItem>
                    <MenuItem value="status">Status</MenuItem>
                  </Select>
                </FormControl>

                {/* Action Filter */}
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel>Action</InputLabel>
                  <Select
                    value={filters.action}
                    onChange={(e) =>
                      handleFilterChange("action", e.target.value)
                    }
                    label="Action"
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="NETWORK_CREATED">Network Created</MenuItem>
                    <MenuItem value="NETWORK_UPDATED">Network Updated</MenuItem>
                    <MenuItem value="NETWORK_DELETED">Network Deleted</MenuItem>
                    <MenuItem value="WALLET_ADDED">Wallet Added</MenuItem>
                    <MenuItem value="WALLET_REMOVED">Wallet Removed</MenuItem>
                    <MenuItem value="MANAGER_ASSIGNED">
                      Manager Assigned
                    </MenuItem>
                    <MenuItem value="MANAGER_REMOVED">Manager Removed</MenuItem>
                    <MenuItem value="STATUS_CHANGED">Status Changed</MenuItem>
                  </Select>
                </FormControl>

                {/* Blockchain Filter */}
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Blockchain</InputLabel>
                  <Select
                    value={filters.blockchain}
                    onChange={(e) =>
                      handleFilterChange("blockchain", e.target.value)
                    }
                    label="Blockchain"
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="ethereum">Ethereum (ETH)</MenuItem>
                    <MenuItem value="bitcoin">Bitcoin (BTC)</MenuItem>
                    <MenuItem value="tron">TRON (TRX)</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              <Box
                sx={{
                  display: "flex",
                  gap: 2,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                {/* Search Field */}
                <TextField
                  size="small"
                  placeholder="Search by network name, description, or wallet..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange("search", e.target.value)}
                  sx={{ minWidth: 300 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search />
                      </InputAdornment>
                    ),
                    endAdornment: filters.search && (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={() => handleFilterChange("search", "")}
                        >
                          <Clear fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                {/* Date Range */}
                <DatePicker
                  label="From Date"
                  value={filters.startDate}
                  onChange={(date) => handleFilterChange("startDate", date)}
                  slotProps={{
                    textField: { size: "small", sx: { width: 180 } },
                  }}
                />

                <DatePicker
                  label="To Date"
                  value={filters.endDate}
                  onChange={(date) => handleFilterChange("endDate", date)}
                  slotProps={{
                    textField: { size: "small", sx: { width: 180 } },
                  }}
                />

                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleResetFilters}
                  startIcon={<Clear />}
                >
                  Reset
                </Button>
              </Box>
            </LocalizationProvider>
          </Paper>
        </Collapse>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Summary Stats */}
        <Box sx={{ mb: 2, display: "flex", gap: 2, flexWrap: "wrap" }}>
          <Chip
            label={`Total: ${pagination.total} entries`}
            color="primary"
            variant="outlined"
          />
          {filters.resourceType && (
            <Chip
              label={`Resource: ${
                resourceTypes.find((t) => t.value === filters.resourceType)
                  ?.label
              }`}
              color="primary"
              variant="filled"
              onDelete={() => handleFilterChange("resourceType", "")}
            />
          )}
          {filters.category && (
            <Chip
              label={`Category: ${networkAuditService.getCategoryLabel(
                filters.category
              )}`}
              color={getCategoryColor(filters.category)}
              variant="filled"
              onDelete={() => handleFilterChange("category", "")}
            />
          )}
          {filters.action && (
            <Chip
              label={`Action: ${networkAuditService.getActionLabel(
                filters.action
              )}`}
              color={getActionColor(filters.action)}
              variant="filled"
              onDelete={() => handleFilterChange("action", "")}
            />
          )}
          {filters.blockchain && (
            <Chip
              label={`Blockchain: ${networkAuditService.getBlockchainLabel(
                filters.blockchain
              )}`}
              color="secondary"
              variant="filled"
              onDelete={() => handleFilterChange("blockchain", "")}
            />
          )}
        </Box>

        {/* Logs Table */}
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: "grey.100" }}>
                <TableCell sx={{ fontWeight: "bold", width: 180 }}>
                  Date & Time
                </TableCell>
                <TableCell sx={{ fontWeight: "bold", width: 150 }}>
                  Resource
                </TableCell>
                <TableCell sx={{ fontWeight: "bold", width: 140 }}>
                  Action
                </TableCell>
                <TableCell sx={{ fontWeight: "bold", width: 100 }}>
                  Category
                </TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Description</TableCell>
                <TableCell sx={{ fontWeight: "bold", width: 150 }}>
                  Performed By
                </TableCell>
                <TableCell sx={{ fontWeight: "bold", width: 100 }}>
                  Blockchain
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={32} />
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Loading audit logs...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <History sx={{ fontSize: 48, color: "grey.400", mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      No audit logs found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow
                    key={log._id}
                    hover
                    sx={{
                      "&:hover": { backgroundColor: "grey.50" },
                    }}
                  >
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {dayjs(log.createdAt).format("MMM DD, YYYY")}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {dayjs(log.createdAt).format("HH:mm:ss")}
                        </Typography>
                        <Typography
                          variant="caption"
                          display="block"
                          color="text.secondary"
                        >
                          {dayjs(log.createdAt).fromNow()}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Tooltip title={log.networkName}>
                        <Typography
                          variant="body2"
                          fontWeight="medium"
                          sx={{
                            maxWidth: 150,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {log.networkName}
                        </Typography>
                      </Tooltip>
                      <Typography variant="caption" color="text.secondary">
                        Our Network
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={getActionIcon(log.action)}
                        label={networkAuditService.getActionLabel(log.action)}
                        color={getActionColor(log.action)}
                        size="small"
                        variant="outlined"
                        sx={{ fontWeight: "medium" }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={networkAuditService.getCategoryLabel(
                          log.category
                        )}
                        color={getCategoryColor(log.category)}
                        size="small"
                        variant="filled"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{log.description}</Typography>
                      {log.walletAddress && (
                        <Tooltip title={log.walletAddress}>
                          <Typography
                            variant="caption"
                            sx={{
                              fontFamily: "monospace",
                              color: "text.secondary",
                              display: "block",
                              mt: 0.5,
                            }}
                          >
                            {networkAuditService.formatAddress(
                              log.walletAddress
                            )}
                          </Typography>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <Avatar
                          sx={{ width: 24, height: 24, fontSize: "0.75rem" }}
                        >
                          {log.performedBy?.fullName?.charAt(0) || "?"}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {log.performedBy?.fullName || "Unknown"}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {log.performedBy?.role || ""}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{getBlockchainChip(log.blockchain)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <TablePagination
          component="div"
          count={pagination.total}
          page={pagination.current - 1}
          onPageChange={handlePageChange}
          rowsPerPage={pagination.limit}
          onRowsPerPageChange={handleRowsPerPageChange}
          rowsPerPageOptions={[10, 20, 50, 100]}
        />
      </CardContent>
    </Card>
  );
};

export default AdminAuditLogsSection;
