import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box,
  Typography,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Divider,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  InputAdornment,
} from "@mui/material";
import {
  Refresh as RefreshIcon,
  Circle as CircleIcon,
  Phone as PhoneIcon,
  PhoneInTalk as PhoneInTalkIcon,
  PhoneMissed as PhoneMissedIcon,
  PhoneCallback as PhoneCallbackIcon,
  CallMade as CallMadeIcon,
  CallReceived as CallReceivedIcon,
  LinkOff as LinkOffIcon,
  Person as PersonIcon,
  History as HistoryIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import toast from "react-hot-toast";
import amiAgentService from "../services/amiAgentService";

const getDisplayName = (memberName) => {
  if (!memberName) return "Unknown";
  let name = memberName.replace(/^(SIP|PJSIP|IAX2|Local|DAHDI)\//i, "");
  name = name.split("@")[0];
  name = name.split("/")[0];
  return name;
};

const stateConfig = {
  free: {
    color: "#ef4444",
    bgColor: "#fef2f2",
    borderColor: "#fca5a5",
    glowColor: "rgba(239, 68, 68, 0.3)",
    label: "Free",
    icon: PhoneMissedIcon,
  },
  calling: {
    color: "#f97316",
    bgColor: "#fff7ed",
    borderColor: "#fdba74",
    glowColor: "rgba(249, 115, 22, 0.3)",
    label: "Calling",
    icon: PhoneIcon,
  },
  talking: {
    color: "#22c55e",
    bgColor: "#f0fdf4",
    borderColor: "#86efac",
    glowColor: "rgba(34, 197, 94, 0.3)",
    label: "Talking",
    icon: PhoneInTalkIcon,
  },
  paused: {
    color: "#a855f7",
    bgColor: "#faf5ff",
    borderColor: "#d8b4fe",
    glowColor: "rgba(168, 85, 247, 0.3)",
    label: "Paused",
    icon: PhoneMissedIcon,
  },
  unavailable: {
    color: "#6b7280",
    bgColor: "#f9fafb",
    borderColor: "#d1d5db",
    glowColor: "rgba(107, 114, 128, 0.2)",
    label: "Unavailable",
    icon: LinkOffIcon,
  },
};

// Parse alias string that may contain email + phone
// e.g. "john@example.com +447535964504" or just a phone number
const parseAlias = (callerIdName, callerIdNum) => {
  const raw = callerIdName || callerIdNum || "";
  // Try to extract email from the string
  const emailMatch = raw.match(/[\w.+-]+@[\w.-]+\.\w+/);
  // Try to extract phone from the string
  const phoneMatch = raw.match(/\+?\d[\d\s-]{6,}/);
  return {
    email: emailMatch ? emailMatch[0] : null,
    phone: phoneMatch ? phoneMatch[0].replace(/[\s-]/g, "") : callerIdNum || null,
    raw,
  };
};

// Live call duration timer - ticks every second
const LiveTimer = ({ startTime, color }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime) { setElapsed(0); return; }
    const start = new Date(startTime).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick(); // immediate
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startTime]);

  if (!startTime) return null;

  return (
    <Typography
      variant="caption"
      sx={{
        fontFamily: "monospace",
        fontWeight: 700,
        fontSize: "0.85rem",
        color: color || "#22c55e",
        letterSpacing: 1,
      }}
    >
      {formatDuration(elapsed)}
    </Typography>
  );
};

const LeadInfo = ({ lead }) => {
  if (!lead) return null;
  return (
    <Box
      sx={{
        bgcolor: "rgba(255,255,255,0.9)",
        borderRadius: 1.5,
        px: 1.5,
        py: 0.75,
        width: "100%",
        border: "1px solid #e5e7eb",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.25 }}>
        <PersonIcon sx={{ fontSize: 14, color: "#6b7280" }} />
        <Typography
          variant="caption"
          sx={{ fontWeight: 700, color: "#1f2937", fontSize: "0.75rem" }}
        >
          {lead.fullName}
        </Typography>
      </Box>
      {lead.newEmail && (
        <Typography
          variant="caption"
          sx={{ color: "#6b7280", fontSize: "0.65rem", display: "block" }}
        >
          {lead.newEmail}
        </Typography>
      )}
      {lead.country && (
        <Typography
          variant="caption"
          sx={{ color: "#9ca3af", fontSize: "0.6rem", display: "block" }}
        >
          {lead.country}
        </Typography>
      )}
    </Box>
  );
};

const AgentBox = ({ agent }) => {
  const extensionName = getDisplayName(agent.memberName || agent.name);
  const displayName = agent.agentName || extensionName;
  const config = stateConfig[agent.state] || stateConfig.free;
  const StateIcon = config.icon;
  const alias = (agent.state === "talking" || agent.state === "calling")
    ? parseAlias(agent.callerIdName, agent.talkingTo || agent.callerIdNum)
    : null;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        minWidth: 180,
        maxWidth: 220,
        borderRadius: 3,
        border: `2px solid ${config.borderColor}`,
        bgcolor: config.bgColor,
        boxShadow: `0 0 16px ${config.glowColor}`,
        transition: "all 0.4s ease",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 0.75,
        position: "relative",
        overflow: "hidden",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          bgcolor: config.color,
        },
      }}
    >
      {/* Agent icon */}
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          bgcolor: config.color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          mt: 0.5,
          boxShadow: `0 0 12px ${config.glowColor}`,
          animation: agent.state === "calling" ? "pulse 1.5s infinite" : "none",
          "@keyframes pulse": {
            "0%": { boxShadow: `0 0 12px ${config.glowColor}` },
            "50%": { boxShadow: `0 0 24px ${config.glowColor}, 0 0 40px ${config.glowColor}` },
            "100%": { boxShadow: `0 0 12px ${config.glowColor}` },
          },
        }}
      >
        <StateIcon sx={{ color: "#fff", fontSize: 24 }} />
      </Box>

      {/* Agent name */}
      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#1f2937", textAlign: "center", lineHeight: 1.2 }}>
        {displayName}
      </Typography>

      {/* Extension */}
      {agent.agentName && (
        <Typography variant="caption" sx={{ color: "#6b7280", fontSize: "0.7rem", mt: -0.5 }}>
          Ext. {extensionName}
        </Typography>
      )}

      {/* State chip */}
      <Chip
        icon={<CircleIcon sx={{ fontSize: "10px !important", color: `${config.color} !important` }} />}
        label={config.label}
        size="small"
        sx={{
          bgcolor: "white",
          border: `1px solid ${config.borderColor}`,
          fontWeight: 600,
          fontSize: "0.7rem",
          color: config.color,
          height: 22,
        }}
      />

      {/* Live call duration */}
      {(agent.state === "talking" || agent.state === "calling") && agent.callStartTime && (
        <LiveTimer startTime={agent.callStartTime} color={config.color} />
      )}

      {/* Call info section */}
      {alias && (alias.phone || alias.email) && (
        <>
          <Divider sx={{ width: "100%", my: 0.25 }} />

          {/* Phone number */}
          {alias.phone && (
            <Typography variant="caption" sx={{ color: "#374151", fontSize: "0.7rem", fontWeight: 600 }}>
              {alias.phone}
            </Typography>
          )}

          {/* Alias / email from callerIdName */}
          {alias.email && (
            <Typography variant="caption" sx={{ color: "#6b7280", fontSize: "0.65rem" }}>
              {alias.email}
            </Typography>
          )}

          {/* Raw alias if it has more info than just the phone */}
          {alias.raw && alias.raw !== alias.phone && !alias.email && alias.raw !== agent.talkingTo && (
            <Typography variant="caption" sx={{ color: "#6b7280", fontSize: "0.65rem", textAlign: "center", wordBreak: "break-all" }}>
              {alias.raw}
            </Typography>
          )}

          {/* Lead info from DB lookup */}
          {agent.lead && <LeadInfo lead={agent.lead} />}

          {/* No lead found */}
          {!agent.lead && alias.phone && (
            <Typography variant="caption" sx={{ color: "#d1d5db", fontSize: "0.6rem", fontStyle: "italic" }}>
              Lead not found
            </Typography>
          )}
        </>
      )}
    </Paper>
  );
};

const LiveCallBox = ({ agent }) => {
  const extensionName = getDisplayName(agent.memberName || agent.name);
  const displayName = agent.agentName || extensionName;
  const alias = parseAlias(agent.callerIdName, agent.talkingTo || agent.callerIdNum);
  const phone = alias.phone || agent.talkingTo || "Unknown";
  const isCalling = agent.state === "calling";
  const isOutbound = agent.direction === "outbound" || (!agent.direction && agent.state === "calling");

  const borderColor = isCalling ? "#fdba74" : "#86efac";
  const bgColor = isCalling ? "#fff7ed" : "#f0fdf4";
  const accentColor = isCalling ? "#f97316" : "#22c55e";
  const glowColor = isCalling ? "rgba(249, 115, 22, 0.25)" : "rgba(34, 197, 94, 0.2)";

  return (
    <Paper
      elevation={0}
      sx={{
        px: 2,
        py: 1.5,
        borderRadius: 2,
        border: `2px solid ${borderColor}`,
        bgcolor: bgColor,
        boxShadow: `0 0 12px ${glowColor}`,
        display: "flex",
        alignItems: "center",
        gap: 2,
        minWidth: 280,
        animation: isCalling ? "pulseCall 1.5s infinite" : "none",
        "@keyframes pulseCall": {
          "0%": { boxShadow: `0 0 8px ${glowColor}` },
          "50%": { boxShadow: `0 0 20px ${glowColor}, 0 0 32px ${glowColor}` },
          "100%": { boxShadow: `0 0 8px ${glowColor}` },
        },
      }}
    >
      {/* Direction icon */}
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          bgcolor: accentColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {isOutbound ? (
          <CallMadeIcon sx={{ color: "#fff", fontSize: 20 }} />
        ) : (
          <CallReceivedIcon sx={{ color: "#fff", fontSize: 20 }} />
        )}
      </Box>

      {/* Info */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, color: "#1f2937" }}>
            {displayName}
          </Typography>
          <Typography variant="caption" sx={{ color: "#6b7280" }}>
            Ext. {extensionName}
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ fontFamily: "monospace", fontWeight: 600, color: "#374151", fontSize: "0.85rem" }}>
          {phone}
        </Typography>
      </Box>

      {/* Status + timer */}
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0.25 }}>
        <Chip
          label={isOutbound ? "Outbound" : "Inbound"}
          size="small"
          sx={{
            height: 20,
            fontSize: "0.65rem",
            fontWeight: 600,
            bgcolor: "white",
            border: `1px solid ${borderColor}`,
            color: accentColor,
          }}
        />
        <Chip
          label={isCalling ? "Ringing" : "Talking"}
          size="small"
          sx={{
            height: 20,
            fontSize: "0.65rem",
            fontWeight: 600,
            bgcolor: accentColor,
            color: "white",
          }}
        />
        {agent.callStartTime && (
          <LiveTimer startTime={agent.callStartTime} color={accentColor} />
        )}
      </Box>
    </Paper>
  );
};

// Format seconds to mm:ss or hh:mm:ss
const formatDuration = (seconds) => {
  if (!seconds || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
};

const dispositionConfig = {
  ANSWERED: { label: "Answered", bgcolor: "#dcfce7", color: "#16a34a" },
  "NO ANSWER": { label: "No Answer", bgcolor: "#fef3c7", color: "#d97706" },
  BUSY: { label: "Busy", bgcolor: "#fee2e2", color: "#dc2626" },
  FAILED: { label: "Failed", bgcolor: "#fee2e2", color: "#dc2626" },
  CONGESTION: { label: "Congestion", bgcolor: "#fef3c7", color: "#d97706" },
};

// Parse "mm:ss" or "hh:mm:ss" or plain seconds string into total seconds
const parseDurationInput = (val) => {
  if (!val) return null;
  const trimmed = val.trim();
  // plain number = seconds
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  // mm:ss
  const mmss = trimmed.match(/^(\d+):(\d{1,2})$/);
  if (mmss) return parseInt(mmss[1], 10) * 60 + parseInt(mmss[2], 10);
  // hh:mm:ss
  const hhmmss = trimmed.match(/^(\d+):(\d{1,2}):(\d{1,2})$/);
  if (hhmmss) return parseInt(hhmmss[1], 10) * 3600 + parseInt(hhmmss[2], 10) * 60 + parseInt(hhmmss[3], 10);
  return null;
};

const CallHistoryTab = ({ history }) => {
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [durFrom, setDurFrom] = useState("");
  const [durTo, setDurTo] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const dfrom = dateFrom ? new Date(dateFrom).getTime() : null;
    const dto = dateTo ? new Date(dateTo).getTime() : null;
    const durFromSec = parseDurationInput(durFrom);
    const durToSec = parseDurationInput(durTo);

    return history.filter((entry) => {
      // Text search
      if (q) {
        const agent = (entry.agentName || entry.extension || "").toLowerCase();
        const phone = (entry.phone || "").toLowerCase();
        const lead = `${entry.leadName || ""} ${entry.leadEmail || ""} ${entry.leadCountry || ""}`.toLowerCase();
        const status = (entry.disposition || "").toLowerCase();
        const callType = (entry.callType || "").toLowerCase();
        if (
          !agent.includes(q) &&
          !phone.includes(q) &&
          !lead.includes(q) &&
          !status.includes(q) &&
          !callType.includes(q)
        ) return false;
      }

      // Date range filter
      if (dfrom || dto) {
        const entryTime = entry.startTime ? new Date(entry.startTime).getTime() : 0;
        if (dfrom && entryTime < dfrom) return false;
        if (dto && entryTime > dto) return false;
      }

      // Duration range filter (uses total duration in seconds)
      if (durFromSec !== null || durToSec !== null) {
        const dur = typeof entry.duration === "number" ? entry.duration : 0;
        if (durFromSec !== null && dur < durFromSec) return false;
        if (durToSec !== null && dur > durToSec) return false;
      }

      return true;
    });
  }, [history, search, dateFrom, dateTo, durFrom, durTo]);

  const hasActiveFilters = search || dateFrom || dateTo || durFrom || durTo;

  const clearFilters = () => {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setDurFrom("");
    setDurTo("");
  };

  if (history.length === 0) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        No call history recorded yet. CDR records from the PBX will appear here as calls complete.
      </Alert>
    );
  }

  const labelSx = { fontSize: "0.7rem", color: "#6b7280", fontWeight: 600, mb: 0.25 };
  const inputSx = { fontSize: "0.8rem" };

  return (
    <Box sx={{ mt: 2 }}>
      {/* Filters row */}
      <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5, borderRadius: 2 }}>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "flex-end" }}>
          {/* Text search */}
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Typography sx={labelSx}>Search</Typography>
            <TextField
              size="small"
              fullWidth
              placeholder="Agent, phone, lead, status..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 16, color: "#9ca3af" }} />
                  </InputAdornment>
                ),
                sx: inputSx,
              }}
            />
          </Box>

          {/* Date From */}
          <Box sx={{ minWidth: 180 }}>
            <Typography sx={labelSx}>Started From</Typography>
            <TextField
              size="small"
              fullWidth
              type="datetime-local"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              InputProps={{ sx: inputSx }}
              inputProps={{ step: 1 }}
            />
          </Box>

          {/* Date To */}
          <Box sx={{ minWidth: 180 }}>
            <Typography sx={labelSx}>Started To</Typography>
            <TextField
              size="small"
              fullWidth
              type="datetime-local"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              InputProps={{ sx: inputSx }}
              inputProps={{ step: 1 }}
            />
          </Box>

          {/* Duration From */}
          <Box sx={{ minWidth: 110 }}>
            <Typography sx={labelSx}>Duration From</Typography>
            <TextField
              size="small"
              fullWidth
              placeholder="e.g. 1:30"
              value={durFrom}
              onChange={(e) => setDurFrom(e.target.value)}
              InputProps={{ sx: inputSx }}
            />
          </Box>

          {/* Duration To */}
          <Box sx={{ minWidth: 110 }}>
            <Typography sx={labelSx}>Duration To</Typography>
            <TextField
              size="small"
              fullWidth
              placeholder="e.g. 10:00"
              value={durTo}
              onChange={(e) => setDurTo(e.target.value)}
              InputProps={{ sx: inputSx }}
            />
          </Box>

          {/* Clear + count */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, pb: 0.5 }}>
            {hasActiveFilters && (
              <Chip
                label="Clear"
                size="small"
                onClick={clearFilters}
                onDelete={clearFilters}
                sx={{ fontWeight: 600, fontSize: "0.7rem", height: 26 }}
              />
            )}
            <Typography variant="caption" sx={{ color: "#6b7280", whiteSpace: "nowrap" }}>
              {filtered.length} / {history.length}
            </Typography>
          </Box>
        </Box>
      </Paper>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "#f9fafb" }}>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem" }}>Agent</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem" }}>Phone</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem" }}>Lead</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem" }}>Started</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem" }}>Duration</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem" }}>Billable</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem" }}>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((entry, idx) => {
              const disp = dispositionConfig[entry.disposition] || { label: entry.disposition || "Unknown", bgcolor: "#f3f4f6", color: "#6b7280" };
              return (
                <TableRow key={idx} sx={{ "&:nth-of-type(odd)": { bgcolor: "#fafafa" } }}>
                  <TableCell sx={{ fontSize: "0.75rem" }}>{entry.agentName || entry.extension}</TableCell>
                  <TableCell sx={{ fontSize: "0.75rem", fontFamily: "monospace" }}>{entry.phone || "-"}</TableCell>
                  <TableCell sx={{ fontSize: "0.75rem" }}>
                    {entry.leadName ? (
                      <Box>
                        <Typography variant="caption" sx={{ fontWeight: 600, fontSize: "0.75rem" }}>
                          {entry.leadName}
                        </Typography>
                        {entry.leadEmail && (
                          <Typography variant="caption" sx={{ fontSize: "0.65rem", color: "#6b7280", display: "block" }}>
                            {entry.leadEmail}
                          </Typography>
                        )}
                        {entry.leadCountry && (
                          <Typography variant="caption" sx={{ fontSize: "0.6rem", color: "#9ca3af", display: "block" }}>
                            {entry.leadCountry}
                          </Typography>
                        )}
                      </Box>
                    ) : (
                      <Typography variant="caption" sx={{ color: "#9ca3af", fontSize: "0.7rem" }}>-</Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ fontSize: "0.75rem" }}>
                    {entry.startTime ? new Date(entry.startTime).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "-"}
                  </TableCell>
                  <TableCell sx={{ fontSize: "0.75rem", fontFamily: "monospace" }}>
                    {typeof entry.duration === "number" ? formatDuration(entry.duration) : entry.duration || "-"}
                  </TableCell>
                  <TableCell sx={{ fontSize: "0.75rem", fontFamily: "monospace" }}>
                    {typeof entry.billsec === "number" ? formatDuration(entry.billsec) : "-"}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={disp.label}
                      sx={{
                        height: 20,
                        fontSize: "0.65rem",
                        fontWeight: 600,
                        bgcolor: disp.bgcolor,
                        color: disp.color,
                      }}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                  <Typography variant="body2" sx={{ color: "#9ca3af" }}>
                    No records match the current filters
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

const AmiAgentsPage = () => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [callHistory, setCallHistory] = useState([]);

  const fetchInitialState = useCallback(async () => {
    try {
      setLoading(true);
      const response = await amiAgentService.getAgentStates();
      if (response.success) {
        setAgents(response.data);
        setConnectionStatus(response.connection);
        // Load server-side CDR history
        if (response.callHistory && response.callHistory.length > 0) {
          setCallHistory(response.callHistory);
        }
      }
    } catch (error) {
      console.error("Failed to fetch AMI agent states:", error);
      toast.error("Failed to load agent states");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialState();
    amiAgentService.connect();

    const handleAgentStates = (data) => {
      setAgents(data);
    };

    const handleCallHistory = (data) => {
      setCallHistory(data);
    };

    amiAgentService.on("agentStates", handleAgentStates);
    amiAgentService.on("callHistory", handleCallHistory);

    return () => {
      amiAgentService.off("agentStates", handleAgentStates);
      amiAgentService.off("callHistory", handleCallHistory);
      amiAgentService.disconnect();
    };
  }, [fetchInitialState]);

  const handleRefresh = async () => {
    await fetchInitialState();
    toast.success("Refreshed");
  };

  const handleReconnect = async () => {
    try {
      await amiAgentService.reconnect();
      toast.success("AMI reconnection initiated");
      setTimeout(fetchInitialState, 2000);
    } catch (error) {
      toast.error("Failed to reconnect AMI");
    }
  };

  const onlineAgents = agents.filter((a) => a.registrationState === "online");
  const offlineAgents = agents.filter((a) => a.registrationState !== "online");
  const freeCount = agents.filter((a) => a.state === "free").length;
  const callingCount = agents.filter((a) => a.state === "calling").length;
  const talkingCount = agents.filter((a) => a.state === "talking").length;
  const unavailableCount = agents.filter((a) => a.state === "unavailable").length;

  return (
    <Box sx={{ width: "100%" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Agent Monitor
          </Typography>
          <Chip
            size="small"
            label={connectionStatus?.connected ? "Connected" : "Disconnected"}
            color={connectionStatus?.connected ? "success" : "error"}
            variant="outlined"
            sx={{ fontWeight: 600 }}
          />
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh} size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          {connectionStatus && !connectionStatus.connected && (
            <Tooltip title="Reconnect AMI">
              <IconButton onClick={handleReconnect} size="small" color="warning">
                <LinkOffIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 2 }}>
        <Tab label="Live Monitor" icon={<PhoneInTalkIcon sx={{ fontSize: 18 }} />} iconPosition="start" sx={{ minHeight: 40, textTransform: "none", fontWeight: 600 }} />
        <Tab
          label={`Call History (${callHistory.length})`}
          icon={<HistoryIcon sx={{ fontSize: 18 }} />}
          iconPosition="start"
          sx={{ minHeight: 40, textTransform: "none", fontWeight: 600 }}
        />
      </Tabs>

      {activeTab === 0 && (
        <>
          {/* Stats bar */}
          <Box sx={{ display: "flex", gap: 1.5, mb: 2.5, flexWrap: "wrap" }}>
            <Chip label={`Total: ${agents.length} (${onlineAgents.length} online, ${offlineAgents.length} offline)`} size="small" sx={{ fontWeight: 600 }} />
            <Chip icon={<CircleIcon sx={{ fontSize: "10px !important", color: "#ef4444 !important" }} />} label={`Free: ${freeCount}`} size="small" variant="outlined" sx={{ fontWeight: 600, borderColor: "#fca5a5", color: "#ef4444" }} />
            <Chip icon={<CircleIcon sx={{ fontSize: "10px !important", color: "#f97316 !important" }} />} label={`Calling: ${callingCount}`} size="small" variant="outlined" sx={{ fontWeight: 600, borderColor: "#fdba74", color: "#f97316" }} />
            <Chip icon={<CircleIcon sx={{ fontSize: "10px !important", color: "#22c55e !important" }} />} label={`Talking: ${talkingCount}`} size="small" variant="outlined" sx={{ fontWeight: 600, borderColor: "#86efac", color: "#22c55e" }} />
            {unavailableCount > 0 && (
              <Chip icon={<CircleIcon sx={{ fontSize: "10px !important", color: "#6b7280 !important" }} />} label={`Unavailable: ${unavailableCount}`} size="small" variant="outlined" sx={{ fontWeight: 600, borderColor: "#d1d5db", color: "#6b7280" }} />
            )}
          </Box>

          {loading && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
              <CircularProgress />
            </Box>
          )}

          {!loading && agents.length === 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              No agents detected. Make sure the PBX has SIP peers configured and the AMI connection is active.
            </Alert>
          )}

          {!loading && agents.length > 0 && (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
              {agents.map((agent) => (
                <AgentBox key={agent.name} agent={agent} />
              ))}
            </Box>
          )}

          {/* Live Calls Section */}
          {!loading && agents.filter((a) => a.state === "calling" || a.state === "talking").length > 0 && (
            <>
              <Divider sx={{ my: 2.5 }} />
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                <PhoneCallbackIcon sx={{ color: "#f97316", fontSize: 20 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#1f2937" }}>
                  Live Calls
                </Typography>
                <Chip
                  label={agents.filter((a) => a.state === "calling" || a.state === "talking").length}
                  size="small"
                  sx={{ height: 20, fontSize: "0.7rem", fontWeight: 700, bgcolor: "#f97316", color: "#fff" }}
                />
              </Box>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {agents
                  .filter((a) => a.state === "calling" || a.state === "talking")
                  .sort((a, b) => (a.state === "calling" ? -1 : 1) - (b.state === "calling" ? -1 : 1))
                  .map((agent) => (
                    <LiveCallBox key={`live-${agent.name}`} agent={agent} />
                  ))}
              </Box>
            </>
          )}
        </>
      )}

      {activeTab === 1 && <CallHistoryTab history={callHistory} />}
    </Box>
  );
};

export default AmiAgentsPage;
