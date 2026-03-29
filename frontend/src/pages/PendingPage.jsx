import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  Badge,
  Button,
  TextField,
  InputAdornment,
  Autocomplete,
  Popover,
  Fade,
} from "@mui/material";
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  OpenInNew as OpenInNewIcon,
  Search as SearchIcon,
  CalendarMonth as CalendarIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Clear as ClearIcon,
} from "@mui/icons-material";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { selectUser } from "../store/slices/authSlice";
import api from "../services/api";
import depositCallsService from "../services/depositCallsService";
import { getPendingDeclarations } from "../services/callDeclarations";
import { getPendingApprovalFines } from "../services/agentFines";
import CallDeclarationsTable from "../components/CallDeclarationsTable";
import CallDeclarationApprovalDialog from "../components/CallDeclarationApprovalDialog";
import FineDetailDialog from "../components/FineDetailDialog";
import { formatDateBG } from "../utils/dateUtils";

const COMPACT_TABLE_SX = {
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
    bgcolor: "rgba(25, 118, 210, 0.06)",
  },
};

const FILTER_FIELD_SX = {
  "& .MuiOutlinedInput-root": {
    borderRadius: 5,
    fontSize: "0.78rem",
    height: 32,
    "& .MuiAutocomplete-input": {
      padding: "2px 4px !important",
    },
  },
  "& .MuiInputLabel-root": {
    fontSize: "0.75rem",
    transform: "translate(14px, 7px) scale(1)",
    "&.MuiInputLabel-shrink": {
      transform: "translate(14px, -9px) scale(0.75)",
      fontSize: "0.85rem",
    },
  },
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

// Custom drill-down calendar picker: Year -> Month -> Day with record bubbles
const CalendarPicker = ({ value, onChange, label, recordDates = new Set() }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [view, setView] = useState("year");
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [yearPage, setYearPage] = useState(Math.floor(now.getFullYear() / 12) * 12);
  const [hoveredDay, setHoveredDay] = useState(null);
  const open = Boolean(anchorEl);

  const handleOpen = (e) => {
    setAnchorEl(e.currentTarget);
    setView("year");
    if (value) {
      const d = new Date(value);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
      setYearPage(Math.floor(d.getFullYear() / 12) * 12);
    } else {
      setYearPage(Math.floor(now.getFullYear() / 12) * 12);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
    setHoveredDay(null);
  };

  const handleSelectYear = (y) => {
    setViewYear(y);
    setView("month");
  };

  const handleSelectMonth = (m) => {
    setViewMonth(m);
    setView("day");
  };

  const handleSelectDay = (day) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    onChange(dateStr);
    handleClose();
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange("");
  };

  // Build calendar grid for the day view
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) startDay = 6;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const weeks = [];
    let week = new Array(startDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      week.push(d);
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }
    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }
    return weeks;
  }, [viewYear, viewMonth]);

  const hasRecords = (day) => {
    if (!day) return false;
    const key = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return recordDates.has(key);
  };

  const isSelected = (day) => {
    if (!day || !value) return false;
    const key = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return value === key;
  };

  const displayValue = value
    ? (() => {
        const d = new Date(value + "T00:00:00");
        return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
      })()
    : "";

  return (
    <>
      <TextField
        size="small"
        label={label}
        value={displayValue}
        onClick={handleOpen}
        InputProps={{
          readOnly: true,
          startAdornment: (
            <InputAdornment position="start">
              <CalendarIcon sx={{ fontSize: 15, color: "text.secondary" }} />
            </InputAdornment>
          ),
          endAdornment: value ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={handleClear} sx={{ p: 0, mr: -0.5 }}>
                <ClearIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </InputAdornment>
          ) : null,
        }}
        sx={{
          ...FILTER_FIELD_SX,
          width: 155,
          cursor: "pointer",
          "& .MuiOutlinedInput-input": { cursor: "pointer" },
        }}
        InputLabelProps={{ shrink: true }}
      />
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        TransitionComponent={Fade}
        transitionDuration={200}
        slotProps={{
          paper: {
            sx: {
              borderRadius: 3,
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              overflow: "hidden",
              mt: 0.5,
            },
          },
        }}
      >
        <Box sx={{ width: 280, p: 2, userSelect: "none" }}>
          {/* Year view */}
          {view === "year" && (
            <>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                <IconButton size="small" onClick={() => setYearPage((p) => p - 12)}>
                  <ChevronLeftIcon sx={{ fontSize: 18 }} />
                </IconButton>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: "0.85rem" }}>
                  {yearPage} - {yearPage + 11}
                </Typography>
                <IconButton size="small" onClick={() => setYearPage((p) => p + 12)}>
                  <ChevronRightIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Box>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0.75 }}>
                {Array.from({ length: 12 }, (_, i) => yearPage + i).map((y) => (
                  <Button
                    key={y}
                    size="small"
                    variant={viewYear === y && value ? "contained" : "text"}
                    onClick={() => handleSelectYear(y)}
                    sx={{
                      borderRadius: 2,
                      fontSize: "0.8rem",
                      fontWeight: y === now.getFullYear() ? 700 : 400,
                      color: y === now.getFullYear() && !(viewYear === y && value) ? "primary.main" : undefined,
                      minWidth: 0,
                      py: 0.8,
                      transition: "all 0.15s ease",
                      "&:hover": { bgcolor: "primary.main", color: "#fff" },
                    }}
                  >
                    {y}
                  </Button>
                ))}
              </Box>
            </>
          )}

          {/* Month view */}
          {view === "month" && (
            <>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                <IconButton size="small" onClick={() => setView("year")}>
                  <ChevronLeftIcon sx={{ fontSize: 18 }} />
                </IconButton>
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", "&:hover": { color: "primary.main" } }}
                  onClick={() => setView("year")}
                >
                  {viewYear}
                </Typography>
                <Box sx={{ width: 28 }} />
              </Box>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0.75 }}>
                {MONTH_NAMES.map((m, i) => (
                  <Button
                    key={m}
                    size="small"
                    variant={viewMonth === i && value?.startsWith(`${viewYear}-${String(i + 1).padStart(2, "0")}`) ? "contained" : "text"}
                    onClick={() => handleSelectMonth(i)}
                    sx={{
                      borderRadius: 2,
                      fontSize: "0.8rem",
                      fontWeight: i === now.getMonth() && viewYear === now.getFullYear() ? 700 : 400,
                      color: i === now.getMonth() && viewYear === now.getFullYear() && !(viewMonth === i && value?.startsWith(`${viewYear}-`)) ? "primary.main" : undefined,
                      minWidth: 0,
                      py: 0.8,
                      transition: "all 0.15s ease",
                      "&:hover": { bgcolor: "primary.main", color: "#fff" },
                    }}
                  >
                    {m}
                  </Button>
                ))}
              </Box>
            </>
          )}

          {/* Day view */}
          {view === "day" && (
            <>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <IconButton size="small" onClick={() => setView("month")}>
                  <ChevronLeftIcon sx={{ fontSize: 18 }} />
                </IconButton>
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", "&:hover": { color: "primary.main" } }}
                  onClick={() => setView("month")}
                >
                  {MONTH_FULL[viewMonth]} {viewYear}
                </Typography>
                <Box sx={{ width: 28 }} />
              </Box>
              {/* Day labels */}
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.25, mb: 0.5 }}>
                {DAY_LABELS.map((d) => (
                  <Box key={d} sx={{ textAlign: "center", fontSize: "0.65rem", fontWeight: 700, color: "text.secondary", py: 0.25 }}>
                    {d}
                  </Box>
                ))}
              </Box>
              {/* Day grid */}
              {calendarDays.map((week, wi) => (
                <Box key={wi} sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.25 }}>
                  {week.map((day, di) => {
                    if (!day) return <Box key={di} />;
                    const hasRec = hasRecords(day);
                    const isSel = isSelected(day);
                    const isHovered = hoveredDay === day;
                    const isToday = day === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear();
                    return (
                      <Box
                        key={di}
                        onClick={() => handleSelectDay(day)}
                        onMouseEnter={() => setHoveredDay(day)}
                        onMouseLeave={() => setHoveredDay(null)}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 34,
                          height: 34,
                          mx: "auto",
                          borderRadius: "50%",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                          fontWeight: isToday ? 700 : 400,
                          transition: "all 0.2s ease",
                          position: "relative",
                          // Selected state
                          ...(isSel && {
                            bgcolor: "primary.main",
                            color: "#fff",
                            fontWeight: 700,
                          }),
                          // Record bubble: green outline by default, green fill on hover
                          ...(!isSel && hasRec && {
                            border: "2px solid",
                            borderColor: isHovered ? "transparent" : "#4caf50",
                            bgcolor: isHovered ? "#4caf50" : "transparent",
                            color: isHovered ? "#fff" : (isToday ? "primary.main" : "text.primary"),
                          }),
                          // No records: subtle hover
                          ...(!isSel && !hasRec && {
                            color: isToday ? "primary.main" : "text.primary",
                            "&:hover": {
                              bgcolor: "action.hover",
                            },
                          }),
                        }}
                      >
                        {day}
                      </Box>
                    );
                  })}
                </Box>
              ))}
            </>
          )}
        </Box>
      </Popover>
    </>
  );
};

const PendingPage = () => {
  const user = useSelector(selectUser);
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";

  // Tab state
  const [activeTab, setActiveTab] = useState(0);

  // Deposits state
  const [pendingDeposits, setPendingDeposits] = useState([]);
  const [depositsLoading, setDepositsLoading] = useState(true);

  // Declarations state
  const [pendingDeclarations, setPendingDeclarations] = useState([]);
  const [declarationsLoading, setDeclarationsLoading] = useState(true);
  const [selectedDeclaration, setSelectedDeclaration] = useState(null);

  // Verifications state
  const [pendingVerifications, setPendingVerifications] = useState([]);
  const [verificationsLoading, setVerificationsLoading] = useState(true);

  // Fines state
  const [pendingFines, setPendingFines] = useState([]);
  const [finesLoading, setFinesLoading] = useState(true);
  const [selectedFine, setSelectedFine] = useState(null);

  // Filter state
  const [search, setSearch] = useState("");
  const [selectedAM, setSelectedAM] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Dropdown data
  const [affiliateManagers, setAffiliateManagers] = useState([]);
  const [agents, setAgents] = useState([]);

  // Shared state
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [processingId, setProcessingId] = useState(null);

  // Fetch dropdown data
  useEffect(() => {
    const fetchDropdowns = async () => {
      try {
        const [amRes, agentRes] = await Promise.all([
          api.get("/users?role=affiliate_manager&isActive=true&limit=1000"),
          api.get("/users?role=agent&isActive=true&limit=1000"),
        ]);
        setAffiliateManagers(amRes.data.data || []);
        setAgents(agentRes.data.data || []);
      } catch (err) {
        console.error("Failed to load dropdown data:", err);
      }
    };
    fetchDropdowns();
  }, []);

  // Fetch pending deposits
  const fetchDeposits = useCallback(async () => {
    try {
      setDepositsLoading(true);
      const response = await depositCallsService.getDepositCalls({
        depositStatus: "pending",
        limit: 200,
      });
      setPendingDeposits(response.data || []);
    } catch (err) {
      console.error("Failed to load pending deposits:", err);
    } finally {
      setDepositsLoading(false);
    }
  }, []);

  // Fetch pending declarations
  const fetchDeclarations = useCallback(async () => {
    try {
      setDeclarationsLoading(true);
      const data = await getPendingDeclarations();
      setPendingDeclarations(data || []);
    } catch (err) {
      console.error("Failed to load pending declarations:", err);
    } finally {
      setDeclarationsLoading(false);
    }
  }, []);

  // Fetch pending verifications (CallChangeRequests with requestedVerified)
  const fetchVerifications = useCallback(async () => {
    try {
      setVerificationsLoading(true);
      const response = await api.get("/call-change-requests/pending");
      const all = response.data.data || [];
      setPendingVerifications(all.filter((r) => r.requestedVerified === true));
    } catch (err) {
      console.error("Failed to load pending verifications:", err);
    } finally {
      setVerificationsLoading(false);
    }
  }, []);

  // Fetch pending fines (pending_approval status)
  const fetchFines = useCallback(async () => {
    try {
      setFinesLoading(true);
      const data = await getPendingApprovalFines();
      setPendingFines(data || []);
    } catch (err) {
      console.error("Failed to load pending fines:", err);
    } finally {
      setFinesLoading(false);
    }
  }, []);

  // Load all on mount
  useEffect(() => {
    fetchDeposits();
    fetchDeclarations();
    fetchVerifications();
    fetchFines();
  }, [fetchDeposits, fetchDeclarations, fetchVerifications, fetchFines]);

  // Auto-dismiss alerts
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Build record dates set for calendar bubbles per tab
  const buildDateSet = useCallback((items, getDate) => {
    const dates = new Set();
    items.forEach((item) => {
      const dateStr = getDate(item);
      if (!dateStr) return;
      const d = new Date(dateStr);
      if (isNaN(d)) return;
      dates.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    });
    return dates;
  }, []);

  const depositDates = useMemo(() => buildDateSet(pendingDeposits, (i) => i.orderId?.createdAt), [pendingDeposits, buildDateSet]);
  const declarationDates = useMemo(() => buildDateSet(pendingDeclarations, (i) => i.callDate || i.createdAt), [pendingDeclarations, buildDateSet]);
  const verificationDates = useMemo(() => buildDateSet(pendingVerifications, (i) => i.createdAt), [pendingVerifications, buildDateSet]);
  const fineDates = useMemo(() => buildDateSet(pendingFines, (i) => i.imposedDate || i.createdAt), [pendingFines, buildDateSet]);
  const allDates = useMemo(() => new Set([...depositDates, ...declarationDates, ...verificationDates, ...fineDates]), [depositDates, declarationDates, verificationDates, fineDates]);

  // Pick record dates based on active tab: 0=All, 1=Deposits, 2=Declarations, 3=Verifications, 4=Fines
  const recordDates = useMemo(() => {
    if (activeTab === 0) return allDates;
    if (activeTab === 1) return depositDates;
    if (activeTab === 2) return declarationDates;
    if (activeTab === 3) return verificationDates;
    return fineDates;
  }, [activeTab, allDates, depositDates, declarationDates, verificationDates, fineDates]);

  // Filtering logic
  const matchesFilters = useCallback(
    (item, type) => {
      const term = search.toLowerCase().trim();

      if (term) {
        let match = false;
        if (type === "deposit") {
          const name = (item.ftdName || `${item.leadId?.firstName || ""} ${item.leadId?.lastName || ""}`).toLowerCase();
          const phone = (item.ftdPhone || item.leadId?.newPhone || "").toLowerCase();
          const email = (item.ftdEmail || item.leadId?.newEmail || "").toLowerCase();
          match = name.includes(term) || phone.includes(term) || email.includes(term);
        } else if (type === "declaration") {
          const agentName = (item.agent?.fullName || "").toLowerCase();
          const leadName = `${item.lead?.firstName || ""} ${item.lead?.lastName || ""}`.toLowerCase();
          const leadPhone = (item.lead?.newPhone || "").toLowerCase();
          const leadEmail = (item.lead?.newEmail || "").toLowerCase();
          match = agentName.includes(term) || leadName.includes(term) || leadPhone.includes(term) || leadEmail.includes(term);
        } else if (type === "verification") {
          const leadName = `${item.leadId?.firstName || ""} ${item.leadId?.lastName || ""}`.toLowerCase();
          const agentName = (item.requestedBy?.fullName || "").toLowerCase();
          match = leadName.includes(term) || agentName.includes(term);
        } else if (type === "fine") {
          const agentName = (item.agent?.fullName || "").toLowerCase();
          const imposedByName = (item.imposedBy?.fullName || "").toLowerCase();
          const reason = (item.reason || "").toLowerCase();
          match = agentName.includes(term) || imposedByName.includes(term) || reason.includes(term);
        }
        if (!match) return false;
      }

      if (selectedAM) {
        let amId;
        if (type === "deposit") amId = item.accountManager?._id;
        else if (type === "declaration") amId = item.affiliateManager?._id;
        else if (type === "verification") amId = item.affiliateManagerId?._id || item.orderId?.requester?._id;
        else if (type === "fine") amId = item.imposedBy?._id;
        if (amId !== selectedAM._id) return false;
      }

      if (selectedAgent) {
        let agentId;
        if (type === "deposit") agentId = item.assignedAgent?._id;
        else if (type === "declaration") agentId = item.agent?._id;
        else if (type === "verification") agentId = item.requestedBy?._id;
        else if (type === "fine") agentId = item.agent?._id;
        if (agentId !== selectedAgent._id) return false;
      }

      if (dateFrom || dateTo) {
        let itemDate;
        if (type === "deposit") itemDate = item.orderId?.createdAt;
        else if (type === "declaration") itemDate = item.callDate || item.createdAt;
        else if (type === "verification") itemDate = item.createdAt;
        else if (type === "fine") itemDate = item.imposedDate || item.createdAt;
        if (itemDate) {
          const d = new Date(itemDate);
          if (dateFrom && d < new Date(dateFrom)) return false;
          if (dateTo) {
            const toEnd = new Date(dateTo + "T23:59:59.999");
            if (d > toEnd) return false;
          }
        }
      }

      return true;
    },
    [search, selectedAM, selectedAgent, dateFrom, dateTo]
  );

  const filteredDeposits = useMemo(
    () => pendingDeposits
      .filter((d) => matchesFilters(d, "deposit"))
      .sort((a, b) => new Date(b.orderId?.createdAt || 0) - new Date(a.orderId?.createdAt || 0)),
    [pendingDeposits, matchesFilters]
  );

  const filteredDeclarations = useMemo(
    () => pendingDeclarations
      .filter((d) => matchesFilters(d, "declaration"))
      .sort((a, b) => new Date(b.callDate || b.createdAt || 0) - new Date(a.callDate || a.createdAt || 0)),
    [pendingDeclarations, matchesFilters]
  );

  const filteredVerifications = useMemo(
    () => pendingVerifications
      .filter((d) => matchesFilters(d, "verification"))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
    [pendingVerifications, matchesFilters]
  );

  const filteredFines = useMemo(
    () => pendingFines
      .filter((d) => matchesFilters(d, "fine"))
      .sort((a, b) => new Date(b.imposedDate || b.createdAt || 0) - new Date(a.imposedDate || a.createdAt || 0)),
    [pendingFines, matchesFilters]
  );

  const handleGoToOrder = (item) => {
    navigate("/orders", {
      state: {
        highlightOrderId: item.orderId?._id || item.orderId,
        highlightLeadId: item.leadId?._id || item.leadId,
      },
    });
  };

  const handleDeclarationUpdated = (updatedDeclaration) => {
    setSuccess(
      `Call declaration ${updatedDeclaration.status === "approved" ? "approved" : "rejected"} successfully!`
    );
    setSelectedDeclaration(null);
    fetchDeclarations();
  };

  const handleFineUpdated = () => {
    setSuccess("Fine updated successfully!");
    setSelectedFine(null);
    fetchFines();
  };

  const handleApproveVerification = async (requestId) => {
    try {
      setProcessingId(requestId);
      setError(null);
      await api.post(`/call-change-requests/${requestId}/approve`);
      setSuccess("Verification request approved successfully!");
      fetchVerifications();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to approve request");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectVerification = async (requestId) => {
    try {
      setProcessingId(requestId);
      setError(null);
      await api.post(`/call-change-requests/${requestId}/reject`);
      setSuccess("Verification request rejected successfully!");
      fetchVerifications();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to reject request");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mx: 2, mb: 0.5, flexShrink: 0 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mx: 2, mb: 0.5, flexShrink: 0 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Filter bar + Tabs */}
      <Box sx={{ px: 2, flexShrink: 0 }}>
        <Paper
          sx={{
            px: 1.5,
            py: 0.75,
            mb: 1,
            display: "flex",
            alignItems: "center",
            gap: 1,
            flexWrap: "wrap",
            borderRadius: 5,
          }}
        >
          <TextField
            size="small"
            placeholder="Name, phone, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ ...FILTER_FIELD_SX, minWidth: 160, flex: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 16, color: "text.secondary" }} />
                </InputAdornment>
              ),
            }}
          />
          {isAdmin && (
            <Autocomplete
              size="small"
              options={affiliateManagers}
              getOptionLabel={(o) => o.fullName || ""}
              value={selectedAM}
              onChange={(e, v) => setSelectedAM(v)}
              renderInput={(params) => (
                <TextField {...params} label="Aff. Manager" sx={FILTER_FIELD_SX} />
              )}
              sx={{ minWidth: 150 }}
            />
          )}
          <Autocomplete
            size="small"
            options={agents}
            getOptionLabel={(o) => o.fullName || ""}
            value={selectedAgent}
            onChange={(e, v) => setSelectedAgent(v)}
            renderInput={(params) => (
              <TextField {...params} label="Agent" sx={FILTER_FIELD_SX} />
            )}
            sx={{ minWidth: 130 }}
          />
          <CalendarPicker
            value={dateFrom}
            onChange={setDateFrom}
            label="From"
            recordDates={recordDates}
          />
          <CalendarPicker
            value={dateTo}
            onChange={setDateTo}
            label="To"
            recordDates={recordDates}
          />
        </Paper>

        <Paper sx={{ borderRadius: "12px 12px 0 0", px: 0.5, pt: 0.5 }}>
          <Tabs
            value={activeTab}
            onChange={(e, v) => setActiveTab(v)}
            variant="fullWidth"
            TabIndicatorProps={{ sx: { display: "none" } }}
            sx={{
              minHeight: 32,
              "& .MuiTab-root": {
                fontWeight: 600,
                fontSize: "0.8rem",
                minHeight: 32,
                py: 0,
                borderRadius: 2,
                mx: 0.25,
                transition: "all 0.2s ease",
                color: "text.secondary",
                "&.Mui-selected": {
                  bgcolor: "primary.main",
                  color: "#fff",
                },
              },
            }}
          >
            <Tab
              label={
                <Badge badgeContent={filteredDeposits.length + filteredDeclarations.length + filteredVerifications.length + filteredFines.length} color="error" max={999} sx={{ "& .MuiBadge-badge": { fontSize: "0.6rem", height: 16, minWidth: 16, p: "0 4px" } }}>
                  <Box sx={{ px: 1 }}>All</Box>
                </Badge>
              }
            />
            <Tab
              label={
                <Badge badgeContent={filteredDeposits.length} color="error" max={999} sx={{ "& .MuiBadge-badge": { fontSize: "0.6rem", height: 16, minWidth: 16, p: "0 4px" } }}>
                  <Box sx={{ px: 1 }}>Deposits</Box>
                </Badge>
              }
            />
            <Tab
              label={
                <Badge badgeContent={filteredDeclarations.length} color="error" max={999} sx={{ "& .MuiBadge-badge": { fontSize: "0.6rem", height: 16, minWidth: 16, p: "0 4px" } }}>
                  <Box sx={{ px: 1 }}>Declarations</Box>
                </Badge>
              }
            />
            <Tab
              label={
                <Badge badgeContent={filteredVerifications.length} color="error" max={999} sx={{ "& .MuiBadge-badge": { fontSize: "0.6rem", height: 16, minWidth: 16, p: "0 4px" } }}>
                  <Box sx={{ px: 1 }}>Verifications</Box>
                </Badge>
              }
            />
            <Tab
              label={
                <Badge badgeContent={filteredFines.length} color="error" max={999} sx={{ "& .MuiBadge-badge": { fontSize: "0.6rem", height: 16, minWidth: 16, p: "0 4px" } }}>
                  <Box sx={{ px: 1 }}>Fines</Box>
                </Badge>
              }
            />
          </Tabs>
        </Paper>
      </Box>

      {/* Tab content - fills remaining space */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          px: 2,
          pb: 2,
        }}
      >
        {/* Tab 0: All combined */}
        {activeTab === 0 && (
          <Paper sx={{ borderRadius: "0 0 12px 12px", display: "flex", flexDirection: "column", minHeight: "100%" }}>
            {depositsLoading && declarationsLoading && verificationsLoading && finesLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer sx={{ flex: 1 }}>
                <Table size="small" sx={COMPACT_TABLE_SX}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: 70 }}>Type</TableCell>
                      <TableCell sx={{ width: 90 }}>Date</TableCell>
                      <TableCell sx={{ width: 140 }}>Name</TableCell>
                      <TableCell sx={{ width: 120 }}>Details</TableCell>
                      <TableCell sx={{ width: 110 }}>Agent</TableCell>
                      <TableCell sx={{ width: 110 }}>Account Manager</TableCell>
                      <TableCell sx={{ width: 100, textAlign: "center" }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredDeposits.map((item) => (
                      <TableRow key={`dep-${item._id}`}>
                        <TableCell><Chip label="Deposit" size="small" color="warning" variant="outlined" sx={{ fontSize: "0.6rem", height: 18 }} /></TableCell>
                        <TableCell>{formatDateBG(item.orderId?.createdAt)}</TableCell>
                        <TableCell sx={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.ftdName || `${item.leadId?.firstName || ""} ${item.leadId?.lastName || ""}`.trim() || "N/A"}
                        </TableCell>
                        <TableCell sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.ftdPhone || item.leadId?.newPhone || "N/A"}
                        </TableCell>
                        <TableCell sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.assignedAgent?.fullName || "Unassigned"}
                        </TableCell>
                        <TableCell sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.accountManager?.fullName || "N/A"}
                        </TableCell>
                        <TableCell sx={{ textAlign: "center" }}>
                          <Tooltip title="Go to Order">
                            <Button size="small" variant="outlined" color="primary" onClick={() => handleGoToOrder(item)}
                              startIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                              sx={{ fontSize: "0.7rem", py: 0.25, px: 1, minWidth: 0, textTransform: "none" }}>
                              Open
                            </Button>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredDeclarations.map((item) => (
                      <TableRow key={`decl-${item._id}`} sx={{ cursor: "pointer" }} onClick={() => setSelectedDeclaration(item)}>
                        <TableCell><Chip label="Declaration" size="small" color="info" variant="outlined" sx={{ fontSize: "0.6rem", height: 18 }} /></TableCell>
                        <TableCell>{formatDateBG(item.callDate || item.createdAt)}</TableCell>
                        <TableCell sx={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {`${item.lead?.firstName || ""} ${item.lead?.lastName || ""}`.trim() || "N/A"}
                        </TableCell>
                        <TableCell sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.callType ? item.callType.replace(/_/g, " ") : "N/A"}
                        </TableCell>
                        <TableCell sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.agent?.fullName || "N/A"}
                        </TableCell>
                        <TableCell sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.affiliateManager?.fullName || "N/A"}
                        </TableCell>
                        <TableCell sx={{ textAlign: "center" }}>
                          <Chip label="Review" size="small" variant="outlined" color="primary" sx={{ fontSize: "0.6rem", height: 18, cursor: "pointer" }} />
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredVerifications.map((request) => (
                      <TableRow key={`ver-${request._id}`}>
                        <TableCell><Chip label="Verification" size="small" color="success" variant="outlined" sx={{ fontSize: "0.6rem", height: 18 }} /></TableCell>
                        <TableCell>{formatDateBG(request.createdAt)}</TableCell>
                        <TableCell sx={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {`${request.leadId?.firstName || ""} ${request.leadId?.lastName || ""}`.trim() || "N/A"}
                        </TableCell>
                        <TableCell sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {request.orderId?.selectedClientNetwork?.name || "N/A"}
                        </TableCell>
                        <TableCell sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {request.requestedBy?.fullName || "N/A"}
                        </TableCell>
                        <TableCell sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {request.affiliateManagerId?.fullName || request.orderId?.requester?.fullName || "N/A"}
                        </TableCell>
                        <TableCell sx={{ textAlign: "center" }}>
                          <Box sx={{ display: "flex", justifyContent: "center", gap: 0.5 }}>
                            <Tooltip title="Approve">
                              <span>
                                <IconButton color="success" size="small" onClick={() => handleApproveVerification(request._id)} disabled={processingId === request._id}>
                                  {processingId === request._id ? <CircularProgress size={18} /> : <ApproveIcon />}
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Reject">
                              <span>
                                <IconButton color="error" size="small" onClick={() => handleRejectVerification(request._id)} disabled={processingId === request._id}>
                                  <RejectIcon />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredFines.map((fine) => (
                      <TableRow key={`fine-${fine._id}`} sx={{ cursor: "pointer" }} onClick={() => setSelectedFine(fine)}>
                        <TableCell><Chip label="Fine" size="small" color="error" variant="outlined" sx={{ fontSize: "0.6rem", height: 18 }} /></TableCell>
                        <TableCell>{formatDateBG(fine.imposedDate || fine.createdAt)}</TableCell>
                        <TableCell sx={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {fine.agent?.fullName || "N/A"}
                        </TableCell>
                        <TableCell sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          ${fine.amount} - {fine.reason || "N/A"}
                        </TableCell>
                        <TableCell sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {fine.agent?.fullName || "N/A"}
                        </TableCell>
                        <TableCell sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {fine.imposedBy?.fullName || "N/A"}
                        </TableCell>
                        <TableCell sx={{ textAlign: "center" }}>
                          <Chip label="Review" size="small" variant="outlined" color="primary" sx={{ fontSize: "0.6rem", height: 18, cursor: "pointer" }} />
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredDeposits.length === 0 && filteredDeclarations.length === 0 && filteredVerifications.length === 0 && filteredFines.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} sx={{ textAlign: "center", py: 3 }}>
                          <Alert severity="info" sx={{ justifyContent: "center" }}>No pending items to review.</Alert>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        )}

        {/* Tab 1: Pending Deposits */}
        {activeTab === 1 && (
          <Paper sx={{ borderRadius: "0 0 12px 12px", display: "flex", flexDirection: "column", minHeight: "100%" }}>
            {depositsLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress />
              </Box>
            ) : filteredDeposits.length === 0 ? (
              <Box sx={{ p: 2 }}>
                <Alert severity="info">No pending deposits to review.</Alert>
              </Box>
            ) : (
              <TableContainer sx={{ flex: 1 }}>
                <Table size="small" sx={COMPACT_TABLE_SX}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: 90 }}>Order Date</TableCell>
                      <TableCell sx={{ width: 140 }}>FTD Name</TableCell>
                      <TableCell sx={{ width: 120 }}>Phone</TableCell>
                      <TableCell sx={{ width: 100 }}>Email</TableCell>
                      <TableCell sx={{ width: 110 }}>Agent</TableCell>
                      <TableCell sx={{ width: 110 }}>Account Manager</TableCell>
                      <TableCell sx={{ width: 80, textAlign: "center" }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredDeposits.map((item) => (
                      <TableRow key={item._id}>
                        <TableCell>{formatDateBG(item.orderId?.createdAt)}</TableCell>
                        <TableCell
                          sx={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        >
                          {item.ftdName || `${item.leadId?.firstName || ""} ${item.leadId?.lastName || ""}`.trim() || "N/A"}
                        </TableCell>
                        <TableCell sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.ftdPhone || item.leadId?.newPhone || "N/A"}
                        </TableCell>
                        <TableCell sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.ftdEmail || item.leadId?.newEmail || "N/A"}
                        </TableCell>
                        <TableCell sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.assignedAgent?.fullName || "Unassigned"}
                        </TableCell>
                        <TableCell sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.accountManager?.fullName || "N/A"}
                        </TableCell>
                        <TableCell sx={{ textAlign: "center" }}>
                          <Tooltip title="Go to Order">
                            <Button
                              size="small"
                              variant="outlined"
                              color="primary"
                              onClick={() => handleGoToOrder(item)}
                              startIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                              sx={{
                                fontSize: "0.7rem",
                                py: 0.25,
                                px: 1,
                                minWidth: 0,
                                textTransform: "none",
                              }}
                            >
                              Open
                            </Button>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        )}

        {/* Tab 2: Pending Declarations */}
        {activeTab === 2 && (
          <Paper sx={{ borderRadius: "0 0 12px 12px", minHeight: "100%", p: 1 }}>
            <CallDeclarationsTable
              declarations={filteredDeclarations}
              loading={declarationsLoading}
              onViewDetails={setSelectedDeclaration}
              showAgent={true}
              hidePagination={true}
              emptyMessage="No pending call declarations to review."
            />
          </Paper>
        )}

        {/* Tab 3: Pending Verifications */}
        {activeTab === 3 && (
          <Paper sx={{ borderRadius: "0 0 12px 12px", display: "flex", flexDirection: "column", minHeight: "100%" }}>
            {verificationsLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress />
              </Box>
            ) : filteredVerifications.length === 0 ? (
              <Box sx={{ p: 2 }}>
                <Alert severity="info">No pending verification requests to review.</Alert>
              </Box>
            ) : (
              <TableContainer sx={{ flex: 1 }}>
                <Table size="small" sx={COMPACT_TABLE_SX}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: 90 }}>Order Date</TableCell>
                      <TableCell sx={{ width: 140 }}>Lead Name</TableCell>
                      <TableCell sx={{ width: 120 }}>Client Network</TableCell>
                      <TableCell sx={{ width: 110 }}>Agent</TableCell>
                      <TableCell sx={{ width: 110 }}>Account Manager</TableCell>
                      <TableCell sx={{ width: 80, textAlign: "center" }}>Verified</TableCell>
                      <TableCell sx={{ width: 90 }}>Request Date</TableCell>
                      <TableCell sx={{ width: 100, textAlign: "center" }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredVerifications.map((request) => (
                      <TableRow key={request._id}>
                        <TableCell>{formatDateBG(request.orderId?.createdAt)}</TableCell>
                        <TableCell
                          sx={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        >
                          {`${request.leadId?.firstName || ""} ${request.leadId?.lastName || ""}`.trim() || "N/A"}
                        </TableCell>
                        <TableCell sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {request.orderId?.selectedClientNetwork?.name || "N/A"}
                        </TableCell>
                        <TableCell sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {request.requestedBy?.fullName || "N/A"}
                        </TableCell>
                        <TableCell sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {request.affiliateManagerId?.fullName || request.orderId?.requester?.fullName || "N/A"}
                        </TableCell>
                        <TableCell sx={{ textAlign: "center" }}>
                          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5 }}>
                            <Chip label="No" size="small" color="default" variant="outlined" sx={{ fontSize: "0.65rem", height: 20 }} />
                            <Box component="span" sx={{ color: "text.secondary", fontSize: "0.75rem" }}>&rarr;</Box>
                            <Chip label="Yes" size="small" color="success" sx={{ fontSize: "0.65rem", height: 20 }} />
                          </Box>
                        </TableCell>
                        <TableCell>{formatDateBG(request.createdAt)}</TableCell>
                        <TableCell sx={{ textAlign: "center" }}>
                          <Box sx={{ display: "flex", justifyContent: "center", gap: 0.5 }}>
                            <Tooltip title="Approve">
                              <span>
                                <IconButton
                                  color="success"
                                  size="small"
                                  onClick={() => handleApproveVerification(request._id)}
                                  disabled={processingId === request._id}
                                >
                                  {processingId === request._id ? (
                                    <CircularProgress size={18} />
                                  ) : (
                                    <ApproveIcon />
                                  )}
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Reject">
                              <span>
                                <IconButton
                                  color="error"
                                  size="small"
                                  onClick={() => handleRejectVerification(request._id)}
                                  disabled={processingId === request._id}
                                >
                                  <RejectIcon />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        )}

        {/* Tab 4: Pending Fines */}
        {activeTab === 4 && (
          <Paper sx={{ borderRadius: "0 0 12px 12px", display: "flex", flexDirection: "column", minHeight: "100%" }}>
            {finesLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress />
              </Box>
            ) : filteredFines.length === 0 ? (
              <Box sx={{ p: 2 }}>
                <Alert severity="info">No pending fines to review.</Alert>
              </Box>
            ) : (
              <TableContainer sx={{ flex: 1 }}>
                <Table size="small" sx={COMPACT_TABLE_SX}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: 90 }}>Date</TableCell>
                      <TableCell sx={{ width: 140 }}>Agent</TableCell>
                      <TableCell sx={{ width: 80 }}>Amount</TableCell>
                      <TableCell sx={{ width: 140 }}>Reason</TableCell>
                      <TableCell sx={{ width: 120 }}>Imposed By</TableCell>
                      <TableCell sx={{ width: 80, textAlign: "center" }}>Status</TableCell>
                      <TableCell sx={{ width: 80, textAlign: "center" }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredFines.map((fine) => (
                      <TableRow key={fine._id} sx={{ cursor: "pointer" }} onClick={() => setSelectedFine(fine)}>
                        <TableCell>{formatDateBG(fine.imposedDate || fine.createdAt)}</TableCell>
                        <TableCell sx={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {fine.agent?.fullName || "N/A"}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, color: "error.main" }}>
                          ${fine.amount}
                        </TableCell>
                        <TableCell sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {fine.reason || "N/A"}
                        </TableCell>
                        <TableCell sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {fine.imposedBy?.fullName || "N/A"}
                        </TableCell>
                        <TableCell sx={{ textAlign: "center" }}>
                          <Chip label="Pending" size="small" color="warning" sx={{ fontSize: "0.6rem", height: 18 }} />
                        </TableCell>
                        <TableCell sx={{ textAlign: "center" }}>
                          <Chip label="Review" size="small" variant="outlined" color="primary" sx={{ fontSize: "0.6rem", height: 18, cursor: "pointer" }} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        )}
      </Box>

      {/* Call Declaration Approval Dialog */}
      <CallDeclarationApprovalDialog
        open={!!selectedDeclaration}
        onClose={() => setSelectedDeclaration(null)}
        declaration={selectedDeclaration}
        onDeclarationUpdated={handleDeclarationUpdated}
        isAdmin={isAdmin}
      />

      {/* Fine Detail Dialog */}
      <FineDetailDialog
        open={!!selectedFine}
        onClose={() => setSelectedFine(null)}
        fine={selectedFine}
        onFineUpdated={handleFineUpdated}
      />
    </Box>
  );
};

export default PendingPage;
