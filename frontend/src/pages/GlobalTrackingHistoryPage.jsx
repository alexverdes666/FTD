import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  TextField,
  Grid,
  Pagination,
  InputAdornment,
  Tooltip,
  Divider,
  IconButton,
  Button,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Collapse,
  useTheme,
  alpha,
} from "@mui/material";
import {
  History,
  Search,
  Person,
  CalendarToday,
  FilterList,
  Refresh,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  SwapHoriz as SwapIcon,
  Login as LoginIcon,
  Logout as LogoutIcon,
  Assignment as OrderIcon,
  Contacts as LeadIcon,
  Business as BrokerIcon,
  Hub as NetworkIcon,
  Campaign as CampaignIcon,
  Payment as PaymentIcon,
  Sms as SmsIcon,
  Security as SecurityIcon,
  Settings as SettingsIcon,
  ExpandMore,
  ExpandLess,
  CreditCard as CardIcon,
  Announcement as AnnouncementIcon,
  SupportAgent as TicketIcon,
  Gavel as FineIcon,
  VerifiedUser as VerifyIcon,
  PersonAdd as PersonAddIcon,
  PersonRemove as PersonRemoveIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  ArrowForward,
} from "@mui/icons-material";
import api from "../services/api";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

// ─── Action type mapping: raw actionType → icon/color for the chip ───
const ACTION_MAP = {
  "orders.create": { icon: <OrderIcon fontSize="small" />, color: "success" },
  "orders.update": { icon: <EditIcon fontSize="small" />, color: "info" },
  "orders.delete": { icon: <DeleteIcon fontSize="small" />, color: "error" },
  "orders.add_lead": { icon: <AddIcon fontSize="small" />, color: "success" },
  "orders.add_leads": { icon: <AddIcon fontSize="small" />, color: "success" },
  "orders.remove_lead": { icon: <PersonRemoveIcon fontSize="small" />, color: "error" },
  "orders.remove_leads": { icon: <PersonRemoveIcon fontSize="small" />, color: "error" },
  "orders.swap_ftd": { icon: <SwapIcon fontSize="small" />, color: "warning" },
  "orders.assign_agent": { icon: <PersonAddIcon fontSize="small" />, color: "primary" },
  "orders.change_agent": { icon: <SwapIcon fontSize="small" />, color: "info" },
  "orders.confirm_deposit": { icon: <CheckIcon fontSize="small" />, color: "success" },
  "orders.unconfirm_deposit": { icon: <CancelIcon fontSize="small" />, color: "warning" },

  "leads.create": { icon: <LeadIcon fontSize="small" />, color: "success" },
  "leads.update": { icon: <EditIcon fontSize="small" />, color: "info" },
  "leads.delete": { icon: <DeleteIcon fontSize="small" />, color: "error" },
  "leads.bulk_update": { icon: <EditIcon fontSize="small" />, color: "info" },
  "leads.bulk_delete": { icon: <DeleteIcon fontSize="small" />, color: "error" },
  "leads.import": { icon: <AddIcon fontSize="small" />, color: "success" },
  "leads.restore": { icon: <CheckIcon fontSize="small" />, color: "success" },
  "leads.assign_broker": { icon: <BrokerIcon fontSize="small" />, color: "primary" },
  "leads.assign_network": { icon: <NetworkIcon fontSize="small" />, color: "primary" },
  "leads.assign_campaign": { icon: <CampaignIcon fontSize="small" />, color: "primary" },

  "users.create": { icon: <PersonAddIcon fontSize="small" />, color: "success" },
  "users.update": { icon: <EditIcon fontSize="small" />, color: "info" },
  "users.delete": { icon: <PersonRemoveIcon fontSize="small" />, color: "error" },

  "auth.login": { icon: <LoginIcon fontSize="small" />, color: "success" },
  "auth.logout": { icon: <LogoutIcon fontSize="small" />, color: "default" },
  "auth.register": { icon: <PersonAddIcon fontSize="small" />, color: "success" },
  "auth.verify_2fa": { icon: <SecurityIcon fontSize="small" />, color: "info" },

  "client_brokers.create": { icon: <BrokerIcon fontSize="small" />, color: "success" },
  "client_brokers.update": { icon: <EditIcon fontSize="small" />, color: "info" },
  "client_brokers.delete": { icon: <DeleteIcon fontSize="small" />, color: "error" },

  "client_networks.create": { icon: <NetworkIcon fontSize="small" />, color: "success" },
  "client_networks.update": { icon: <EditIcon fontSize="small" />, color: "info" },
  "client_networks.delete": { icon: <DeleteIcon fontSize="small" />, color: "error" },

  "our_networks.create": { icon: <NetworkIcon fontSize="small" />, color: "success" },
  "our_networks.update": { icon: <EditIcon fontSize="small" />, color: "info" },
  "our_networks.delete": { icon: <DeleteIcon fontSize="small" />, color: "error" },

  "campaigns.create": { icon: <CampaignIcon fontSize="small" />, color: "success" },
  "campaigns.update": { icon: <EditIcon fontSize="small" />, color: "info" },
  "campaigns.delete": { icon: <DeleteIcon fontSize="small" />, color: "error" },

  "client_psps.create": { icon: <PaymentIcon fontSize="small" />, color: "success" },
  "client_psps.update": { icon: <EditIcon fontSize="small" />, color: "info" },
  "client_psps.delete": { icon: <DeleteIcon fontSize="small" />, color: "error" },

  "card_issuers.create": { icon: <CardIcon fontSize="small" />, color: "success" },
  "card_issuers.update": { icon: <EditIcon fontSize="small" />, color: "info" },
  "card_issuers.delete": { icon: <DeleteIcon fontSize="small" />, color: "error" },

  "refunds.create": { icon: <PaymentIcon fontSize="small" />, color: "success" },
  "refunds.update": { icon: <EditIcon fontSize="small" />, color: "info" },
  "refunds.delete": { icon: <DeleteIcon fontSize="small" />, color: "error" },

  "announcements.create": { icon: <AnnouncementIcon fontSize="small" />, color: "success" },
  "announcements.update": { icon: <EditIcon fontSize="small" />, color: "info" },
  "announcements.delete": { icon: <DeleteIcon fontSize="small" />, color: "error" },

  "tickets.create": { icon: <TicketIcon fontSize="small" />, color: "success" },
  "tickets.update": { icon: <EditIcon fontSize="small" />, color: "info" },

  "fines.create": { icon: <FineIcon fontSize="small" />, color: "success" },
  "fines.update": { icon: <EditIcon fontSize="small" />, color: "info" },

  "verifications.create": { icon: <VerifyIcon fontSize="small" />, color: "success" },
  "verifications.update": { icon: <EditIcon fontSize="small" />, color: "info" },

  "sms.create": { icon: <SmsIcon fontSize="small" />, color: "success" },
  "sms_gateway.create": { icon: <SmsIcon fontSize="small" />, color: "info" },
  "sms_gateway.update": { icon: <EditIcon fontSize="small" />, color: "info" },

  "settings.update": { icon: <SettingsIcon fontSize="small" />, color: "info" },
  "admin.update": { icon: <SecurityIcon fontSize="small" />, color: "warning" },
};

const CATEGORY_OPTIONS = [
  "All", "Orders", "Leads", "Users", "Auth", "Brokers", "Networks",
  "Campaigns", "PSPs", "Card Issuers", "Refunds", "Announcements",
  "Tickets", "Fines", "Verifications", "SMS", "Admin",
];

function getActionVisuals(log) {
  const key = log.actionType?.replace(/-/g, "_");
  if (key && ACTION_MAP[key]) return ACTION_MAP[key];
  if (log.actionType) {
    const normalized = log.actionType.replace(/-/g, "_");
    if (ACTION_MAP[normalized]) return ACTION_MAP[normalized];
  }
  const methodMap = { POST: "success", PUT: "info", PATCH: "info", DELETE: "error" };
  return { icon: <EditIcon fontSize="small" />, color: methodMap[log.method] || "default" };
}

const GlobalTrackingHistoryPage = () => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedMethod, setSelectedMethod] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedLog, setExpandedLog] = useState(null);
  const [users, setUsers] = useState([]);
  const limit = 30;

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await api.get("/users");
        const data = res.data.data || res.data;
        if (Array.isArray(data)) {
          setUsers(data.map((u) => ({ _id: u._id, fullName: u.fullName, email: u.email, role: u.role })));
        }
      } catch { /* skip */ }
    };
    fetchUsers();
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append("page", page);
      params.append("limit", limit);
      params.append("sortBy", "timestamp");
      params.append("sortOrder", "desc");

      if (selectedUser) params.append("user", selectedUser);
      if (search) params.append("path", search);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (selectedMethod) params.append("method", selectedMethod);

      if (selectedCategory && selectedCategory !== "All") {
        const categoryToActionPrefix = {
          Orders: "orders", Leads: "leads", Users: "users", Auth: "auth",
          Brokers: "client_brokers", Networks: "networks", Campaigns: "campaigns",
          PSPs: "client_psps", "Card Issuers": "card_issuers", Refunds: "refunds",
          Announcements: "announcements", Tickets: "tickets", Fines: "fines",
          Verifications: "verifications", SMS: "sms", Admin: "admin",
        };
        const prefix = categoryToActionPrefix[selectedCategory];
        if (prefix) params.append("actionType", prefix);
      }

      const response = await api.get(`/activity-logs/tracking-history?${params.toString()}`);
      const data = response.data;
      setLogs(data.data || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotalCount(data.pagination?.totalCount || 0);
    } catch (err) {
      console.error("Error fetching tracking history:", err);
      setError(err.response?.data?.message || "Failed to load tracking history");
    } finally {
      setLoading(false);
    }
  }, [page, search, startDate, endDate, selectedUser, selectedCategory, selectedMethod]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handlePageChange = (_, value) => setPage(value);

  const handleClearFilters = () => {
    setSearch(""); setStartDate(""); setEndDate("");
    setSelectedUser(""); setSelectedCategory("All"); setSelectedMethod(""); setPage(1);
  };

  const formatDateTime = (date) => date ? dayjs(date).format("DD.MM.YYYY HH:mm:ss") : "N/A";
  const toggleExpand = (logId) => setExpandedLog(expandedLog === logId ? null : logId);

  const renderChangeValue = (val) => {
    if (val === undefined || val === null) return "(empty)";
    if (typeof val === "object") return JSON.stringify(val);
    return String(val).substring(0, 150);
  };

  const renderLogEntry = (log) => {
    const visuals = getActionVisuals(log);
    const description = log.description || "";
    const userName = log.userSnapshot?.fullName || "System";
    const userRole = log.userSnapshot?.role || "";
    const userEmail = log.userSnapshot?.email || "";
    const isExpanded = expandedLog === log._id;
    const isError = log.statusCode >= 400;
    const target = log.targetEntity;
    const resolvedChanges = log.resolvedChanges;

    return (
      <Paper
        key={log._id}
        variant="outlined"
        sx={{
          p: 2, mb: 1.5, borderLeft: 4,
          borderLeftColor: isError ? "error.main" : `${visuals.color}.main`,
          transition: "all 0.2s ease", cursor: "pointer",
          "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.02), boxShadow: 1 },
        }}
        onClick={() => toggleExpand(log._id)}
      >
        {/* Main row */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: 1, minWidth: 0, flexWrap: "wrap" }}>
            {visuals.icon}
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Person sx={{ fontSize: 16, color: "text.secondary" }} />
              <Typography variant="body2" fontWeight={600}>{userName}</Typography>
              {userRole && (
                <Chip label={userRole.replace(/_/g, " ")} size="small" variant="outlined" sx={{ fontSize: "0.65rem", height: 20 }} />
              )}
            </Box>
            {target && (
              <Chip
                label={target.name}
                size="small"
                variant="outlined"
                color="primary"
                sx={{ fontSize: "0.7rem", maxWidth: 200, height: 22 }}
              />
            )}
            {isError && (
              <Chip label={`${log.statusCode}`} size="small" color="error" variant="outlined" sx={{ fontSize: "0.65rem", height: 20 }} />
            )}
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Tooltip title={formatDateTime(log.timestamp)}>
              <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                {dayjs(log.timestamp).fromNow()}
              </Typography>
            </Tooltip>
            <IconButton size="small" sx={{ p: 0.25 }}>
              {isExpanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
            </IconButton>
          </Box>
        </Box>

        {/* Description - always shown */}
        {description && (
          <Typography
            variant="body2"
            sx={{
              mt: 0.75, color: "text.primary",
              overflow: isExpanded ? "visible" : "hidden",
              textOverflow: isExpanded ? "unset" : "ellipsis",
              whiteSpace: isExpanded ? "normal" : "nowrap",
            }}
          >
            {description}
          </Typography>
        )}

        {/* Expanded details */}
        <Collapse in={isExpanded}>
          <Divider sx={{ my: 1.5 }} />
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>User</Typography>
              <Typography variant="body2">{userName} ({userEmail})</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>Time</Typography>
              <Typography variant="body2">{formatDateTime(log.timestamp)}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>Endpoint</Typography>
              <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                {log.method} {log.path?.split("?")[0]}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>Status / Duration</Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Chip
                  label={log.statusCode}
                  size="small"
                  color={log.statusCode >= 400 ? "error" : log.statusCode >= 300 ? "warning" : "success"}
                  sx={{ fontSize: "0.7rem", height: 20 }}
                />
                <Typography variant="body2">{log.duration}ms</Typography>
              </Box>
            </Grid>
            {log.ip && (
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>IP Address</Typography>
                <Typography variant="body2" sx={{ fontFamily: "monospace" }}>{log.ip}</Typography>
              </Grid>
            )}
            {(log.device?.type || log.browser?.name) && (
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>Device</Typography>
                <Typography variant="body2">
                  {log.device?.type || "unknown"} / {log.browser?.name || "unknown"} {log.browser?.version || ""} / {log.os?.name || "unknown"}
                </Typography>
              </Grid>
            )}

            {/* Resolved Changes - shows display names instead of ObjectIds */}
            {resolvedChanges && Object.keys(resolvedChanges).length > 0 && (
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 0.5, display: "block" }}>
                  Changes
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                  {Object.entries(resolvedChanges).map(([field, change]) => (
                    <Box
                      key={field}
                      sx={{
                        display: "flex", alignItems: "center", gap: 1, p: 1,
                        bgcolor: alpha(theme.palette.grey[500], 0.06), borderRadius: 1, flexWrap: "wrap",
                      }}
                    >
                      <Chip label={field} size="small" variant="outlined" sx={{ fontSize: "0.7rem", fontWeight: 600, height: 22 }} />
                      <Box sx={{ p: 0.5, px: 1, bgcolor: alpha(theme.palette.error.main, 0.08), borderRadius: 0.5, minWidth: 0 }}>
                        <Typography variant="caption" sx={{ wordBreak: "break-word" }}>
                          {renderChangeValue(change.oldDisplay ?? change.old)}
                        </Typography>
                      </Box>
                      <ArrowForward sx={{ fontSize: 14, color: "text.disabled" }} />
                      <Box sx={{ p: 0.5, px: 1, bgcolor: alpha(theme.palette.success.main, 0.08), borderRadius: 0.5, minWidth: 0 }}>
                        <Typography variant="caption" sx={{ wordBreak: "break-word" }}>
                          {renderChangeValue(change.newDisplay ?? change.new)}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Grid>
            )}

            {/* Resolved request body for creates (no changes present) */}
            {log.resolvedBody && typeof log.resolvedBody === "object" && !resolvedChanges && (
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 0.5, display: "block" }}>
                  Request Data
                </Typography>
                <Box sx={{ p: 1.5, bgcolor: alpha(theme.palette.grey[500], 0.06), borderRadius: 1, maxHeight: 200, overflow: "auto" }}>
                  <Typography variant="caption" component="pre" sx={{ fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-word", m: 0 }}>
                    {JSON.stringify(log.resolvedBody, null, 2)}
                  </Typography>
                </Box>
              </Grid>
            )}

            {log.error?.message && (
              <Grid item xs={12}>
                <Alert severity="error" variant="outlined" sx={{ py: 0 }}>{log.error.message}</Alert>
              </Grid>
            )}
          </Grid>
        </Collapse>
      </Paper>
    );
  };

  return (
    <Box sx={{ p: { xs: 1, sm: 2, md: 3 }, maxWidth: 1200, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3, flexWrap: "wrap", gap: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <History color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h5" fontWeight={700}>Global Tracking History</Typography>
          {totalCount > 0 && (
            <Chip label={`${totalCount.toLocaleString()} entries`} size="small" color="primary" variant="outlined" />
          )}
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchLogs} size="small" color="primary"><Refresh /></IconButton>
          </Tooltip>
          <Button variant={showFilters ? "contained" : "outlined"} size="small" startIcon={<FilterList />} onClick={() => setShowFilters(!showFilters)}>
            Filters
          </Button>
        </Box>
      </Box>

      {/* Filters */}
      <Collapse in={showFilters}>
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" placeholder="Search by path..." value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>User</InputLabel>
                <Select value={selectedUser} label="User" onChange={(e) => { setSelectedUser(e.target.value); setPage(1); }}>
                  <MenuItem value="">All Users</MenuItem>
                  {users.map((u) => (
                    <MenuItem key={u._id} value={u._id}>{u.fullName} ({u.role?.replace(/_/g, " ")})</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Category</InputLabel>
                <Select value={selectedCategory} label="Category" onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }}>
                  {CATEGORY_OPTIONS.map((cat) => <MenuItem key={cat} value={cat}>{cat}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Method</InputLabel>
                <Select value={selectedMethod} label="Method" onChange={(e) => { setSelectedMethod(e.target.value); setPage(1); }}>
                  <MenuItem value="">All Methods</MenuItem>
                  <MenuItem value="POST">POST (Create)</MenuItem>
                  <MenuItem value="PUT">PUT (Update)</MenuItem>
                  <MenuItem value="PATCH">PATCH (Update)</MenuItem>
                  <MenuItem value="DELETE">DELETE</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={5}>
              <TextField fullWidth size="small" type="date" label="From Date" value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                InputLabelProps={{ shrink: true }}
                InputProps={{ startAdornment: <InputAdornment position="start"><CalendarToday fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={5}>
              <TextField fullWidth size="small" type="date" label="To Date" value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                InputLabelProps={{ shrink: true }}
                InputProps={{ startAdornment: <InputAdornment position="start"><CalendarToday fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={2}>
              <Button fullWidth variant="outlined" onClick={handleClearFilters} sx={{ height: "40px" }}>Clear</Button>
            </Grid>
          </Grid>
        </Paper>
      </Collapse>

      {/* Content */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 8 }}><CircularProgress /></Box>
      ) : error ? (
        <Alert severity="error" sx={{ my: 2 }}>{error}</Alert>
      ) : logs.length === 0 ? (
        <Alert severity="info" sx={{ my: 2 }}>No tracking entries found. All operations performed in the app will appear here.</Alert>
      ) : (
        <Box>{logs.map(renderLogEntry)}</Box>
      )}

      {totalPages > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
          <Pagination count={totalPages} page={page} onChange={handlePageChange} color="primary" showFirstButton showLastButton />
        </Box>
      )}
    </Box>
  );
};

export default GlobalTrackingHistoryPage;
