import React, { useState, useEffect, useMemo } from "react";
import { useSelector } from "react-redux";
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Alert,
  Avatar,
  IconButton,
  Tooltip,
  LinearProgress,
  Skeleton,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Badge,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Button,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  People as PeopleIcon,
  Assignment as AssignmentIcon,
  Phone as PhoneIcon,
  AttachMoney as MoneyIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  Speed as SpeedIcon,
  Inventory as InventoryIcon,
  Groups as GroupsIcon,
  ShowChart as ShowChartIcon,
  LocalShipping as ShippingIcon,
  Receipt as ReceiptIcon,
  Circle as CircleIcon,
  AccessTime as AccessTimeIcon,
  CalendarToday as CalendarIcon,
  BusinessCenter as BusinessIcon,
  Pending as PendingIcon,
  TaskAlt as TaskAltIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Person as PersonIcon,
  TrendingFlat as TrendingFlatIcon,
  OpenInNew as OpenInNewIcon,
  MoreVert as MoreVertIcon,
  BarChart as BarChartIcon,
  PieChart as PieChartOutlineIcon,
} from "@mui/icons-material";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { selectUser } from "../store/slices/authSlice";
import api from "../services/api";
import AffiliateManagerTableView from "../components/AffiliateManagerTableView";

// Role constants
const USER_ROLES = {
  ADMIN: "admin",
  AFFILIATE_MANAGER: "affiliate_manager",
  AGENT: "agent",
  LEAD_MANAGER: "lead_manager",
  REFUNDS_MANAGER: "refunds_manager",
  INVENTORY_MANAGER: "inventory_manager",
};

// Professional color palette
const COLORS = {
  primary: "#1e3a5f",
  primaryLight: "#e8edf3",
  primaryDark: "#152c4a",
  accent: "#f57c00",
  accentLight: "#fff3e0",
  success: "#2e7d32",
  successLight: "#e8f5e9",
  warning: "#ed6c02",
  warningLight: "#fff3e0",
  error: "#c62828",
  errorLight: "#ffebee",
  info: "#0277bd",
  infoLight: "#e1f5fe",
  gray: "#64748b",
  grayLight: "#f1f5f9",
  border: "#e2e8f0",
  background: "transparent",
  cardBg: "#ffffff",
  text: "#1e293b",
  textSecondary: "#64748b",
};

const CHART_COLORS = ["#1e3a5f", "#2e7d32", "#f57c00", "#7b1fa2", "#0097a7", "#e65100"];

const cardShadow = "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)";
const cardHoverShadow = "0 4px 12px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.08)";

// Motion variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

// Time-based greeting
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
};

// Format numbers with K/M suffix
const formatNumber = (num) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num?.toString() || "0";
};

// Format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
};

// Format date
const formatDate = (date) => {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Format today's date nicely
const formatTodayDate = () => {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

// ─── Welcome Header ───────────────────────────────────────────────────────────
const WelcomeHeader = React.memo(({ name, role, onRefresh, isRefreshing }) => {
  const roleLabels = {
    admin: "Administrator",
    affiliate_manager: "Affiliate Manager",
    agent: "Agent",
    lead_manager: "Lead Manager",
    refunds_manager: "Refunds Manager",
    inventory_manager: "Inventory Manager",
  };

  return (
    <motion.div variants={itemVariants}>
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              color: COLORS.text,
              fontSize: { xs: "1.5rem", md: "1.85rem" },
              letterSpacing: "-0.02em",
              lineHeight: 1.3,
            }}
          >
            {getGreeting()},{" "}
            <Box component="span" sx={{ color: COLORS.primary }}>
              {name?.split(" ")[0] || "there"}
            </Box>
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mt: 0.75 }}>
            <Typography
              variant="body2"
              sx={{ color: COLORS.textSecondary, fontSize: "0.875rem" }}
            >
              {formatTodayDate()}
            </Typography>
            <Box
              sx={{
                width: 4,
                height: 4,
                borderRadius: "50%",
                bgcolor: COLORS.border,
              }}
            />
            <Chip
              size="small"
              label={roleLabels[role] || role}
              sx={{
                bgcolor: COLORS.primaryLight,
                color: COLORS.primary,
                fontWeight: 600,
                fontSize: "0.7rem",
                height: 22,
                borderRadius: "6px",
              }}
            />
          </Box>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Tooltip title="Refresh dashboard data">
            <IconButton
              onClick={onRefresh}
              disabled={isRefreshing}
              size="small"
              sx={{
                bgcolor: COLORS.cardBg,
                border: `1px solid ${COLORS.border}`,
                boxShadow: cardShadow,
                width: 38,
                height: 38,
                "&:hover": {
                  bgcolor: COLORS.grayLight,
                  borderColor: COLORS.primary,
                },
              }}
            >
              <RefreshIcon
                sx={{
                  fontSize: 18,
                  color: COLORS.primary,
                  animation: isRefreshing ? "spin 1s linear infinite" : "none",
                  "@keyframes spin": {
                    "0%": { transform: "rotate(0deg)" },
                    "100%": { transform: "rotate(360deg)" },
                  },
                }}
              />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      {isRefreshing && (
        <LinearProgress
          sx={{
            mb: 2,
            borderRadius: 1,
            height: 2,
            bgcolor: COLORS.primaryLight,
            "& .MuiLinearProgress-bar": { bgcolor: COLORS.primary },
          }}
        />
      )}
    </motion.div>
  );
});

// ─── KPI Stat Card ────────────────────────────────────────────────────────────
const StatCard = React.memo(
  ({ title, value, subtitle, icon, accentColor, trend, trendValue, onClick }) => (
    <motion.div variants={itemVariants} style={{ height: "100%" }}>
      <Card
        onClick={onClick}
        sx={{
          height: "100%",
          bgcolor: COLORS.cardBg,
          borderRadius: "12px",
          boxShadow: cardShadow,
          border: "1px solid transparent",
          borderBottom: `3px solid ${accentColor || COLORS.primary}`,
          cursor: onClick ? "pointer" : "default",
          transition: "all 0.25s ease",
          position: "relative",
          overflow: "visible",
          "&:hover": {
            boxShadow: cardHoverShadow,
            transform: onClick ? "translateY(-2px)" : "none",
            borderColor: onClick ? accentColor || COLORS.primary : "transparent",
            borderBottomColor: accentColor || COLORS.primary,
          },
        }}
      >
        <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              mb: 1.5,
            }}
          >
            <Typography
              variant="body2"
              sx={{
                color: COLORS.textSecondary,
                fontWeight: 500,
                fontSize: "0.78rem",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              {title}
            </Typography>
            <Avatar
              sx={{
                bgcolor: (accentColor || COLORS.primary) + "14",
                color: accentColor || COLORS.primary,
                width: 40,
                height: 40,
                borderRadius: "10px",
              }}
            >
              {icon}
            </Avatar>
          </Box>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              color: COLORS.text,
              fontSize: { xs: "1.6rem", md: "1.85rem" },
              lineHeight: 1.1,
              mb: 0.5,
              letterSpacing: "-0.02em",
            }}
          >
            {value}
          </Typography>
          {subtitle && (
            <Typography
              variant="caption"
              sx={{
                color: COLORS.textSecondary,
                display: "block",
                fontSize: "0.75rem",
              }}
            >
              {subtitle}
            </Typography>
          )}
          {trend !== undefined && (
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                mt: 1,
                gap: 0.3,
                px: 0.8,
                py: 0.2,
                borderRadius: "6px",
                bgcolor:
                  trend === "up"
                    ? COLORS.successLight
                    : trend === "down"
                    ? COLORS.errorLight
                    : COLORS.grayLight,
              }}
            >
              {trend === "up" ? (
                <ArrowUpIcon sx={{ color: COLORS.success, fontSize: 14 }} />
              ) : trend === "down" ? (
                <ArrowDownIcon sx={{ color: COLORS.error, fontSize: 14 }} />
              ) : (
                <TrendingFlatIcon sx={{ color: COLORS.gray, fontSize: 14 }} />
              )}
              <Typography
                variant="caption"
                sx={{
                  color:
                    trend === "up"
                      ? COLORS.success
                      : trend === "down"
                      ? COLORS.error
                      : COLORS.gray,
                  fontWeight: 700,
                  fontSize: "0.7rem",
                }}
              >
                {trendValue}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
);

// ─── Section Card Wrapper ─────────────────────────────────────────────────────
const SectionCard = React.memo(({ title, subtitle, action, children, noPadding }) => (
  <motion.div variants={itemVariants} style={{ height: "100%" }}>
    <Card
      sx={{
        height: "100%",
        bgcolor: COLORS.cardBg,
        borderRadius: "12px",
        boxShadow: cardShadow,
        border: "none",
        display: "flex",
        flexDirection: "column",
        transition: "box-shadow 0.25s ease",
        "&:hover": { boxShadow: cardHoverShadow },
      }}
    >
      {(title || action) && (
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            px: 2.5,
            pt: 2.5,
            pb: 1.5,
          }}
        >
          <Box>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 700,
                color: COLORS.text,
                fontSize: "0.95rem",
                letterSpacing: "-0.01em",
              }}
            >
              {title}
            </Typography>
            {subtitle && (
              <Typography
                variant="caption"
                sx={{ color: COLORS.textSecondary, fontSize: "0.75rem" }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>
          {action}
        </Box>
      )}
      <Box sx={{ p: noPadding ? 0 : 2.5, pt: noPadding ? 0 : 1, flex: 1 }}>
        {children}
      </Box>
    </Card>
  </motion.div>
));

// ─── Custom Chart Tooltip ─────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <Paper
        sx={{
          p: 1.5,
          borderRadius: "8px",
          border: "none",
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          backdropFilter: "blur(8px)",
          bgcolor: "rgba(255,255,255,0.96)",
        }}
      >
        <Typography
          variant="body2"
          sx={{ fontWeight: 700, mb: 0.5, color: COLORS.text, fontSize: "0.8rem" }}
        >
          {label}
        </Typography>
        {payload.map((entry, index) => (
          <Box
            key={index}
            sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.25 }}
          >
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                bgcolor: entry.color,
              }}
            />
            <Typography
              variant="caption"
              sx={{ color: COLORS.textSecondary, fontSize: "0.75rem" }}
            >
              {entry.name}:{" "}
              <Box component="span" sx={{ fontWeight: 600, color: COLORS.text }}>
                {formatNumber(entry.value)}
              </Box>
            </Typography>
          </Box>
        ))}
      </Paper>
    );
  }
  return null;
};

// ─── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const statusConfig = {
    active: { color: COLORS.success, bg: COLORS.successLight, label: "Active" },
    completed: { color: COLORS.success, bg: COLORS.successLight, label: "Completed" },
    fulfilled: { color: COLORS.success, bg: COLORS.successLight, label: "Fulfilled" },
    pending: { color: COLORS.warning, bg: COLORS.warningLight, label: "Pending" },
    new: { color: COLORS.info, bg: COLORS.infoLight, label: "New" },
    cancelled: { color: COLORS.error, bg: COLORS.errorLight, label: "Cancelled" },
    partial: { color: COLORS.warning, bg: COLORS.warningLight, label: "Partial" },
    approved: { color: COLORS.success, bg: COLORS.successLight, label: "Approved" },
    rejected: { color: COLORS.error, bg: COLORS.errorLight, label: "Rejected" },
  };

  const config = statusConfig[status] || {
    color: COLORS.gray,
    bg: COLORS.grayLight,
    label: status || "Unknown",
  };

  return (
    <Chip
      size="small"
      label={config.label}
      sx={{
        bgcolor: config.bg,
        color: config.color,
        fontWeight: 600,
        fontSize: "0.68rem",
        height: 22,
        borderRadius: "6px",
        border: `1px solid ${config.color}20`,
      }}
    />
  );
};

// ─── Mini Progress Bar ────────────────────────────────────────────────────────
const MiniProgress = ({ value, maxValue, color = COLORS.primary }) => {
  const percentage = maxValue ? Math.min((value / maxValue) * 100, 100) : 0;
  return (
    <Box sx={{ width: "100%" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
        <Typography variant="caption" sx={{ color: COLORS.textSecondary, fontSize: "0.7rem" }}>
          {formatNumber(value)} / {formatNumber(maxValue)}
        </Typography>
        <Typography variant="caption" sx={{ fontWeight: 700, color, fontSize: "0.7rem" }}>
          {Math.round(percentage)}%
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={percentage}
        sx={{
          height: 5,
          borderRadius: 3,
          bgcolor: color + "15",
          "& .MuiLinearProgress-bar": {
            bgcolor: color,
            borderRadius: 3,
          },
        }}
      />
    </Box>
  );
};

// ─── Admin Dashboard ──────────────────────────────────────────────────────────
const AdminDashboard = React.memo(({ data }) => {
  const leadTypes = useMemo(
    () =>
      data.leadsStats?.leads
        ? Object.entries(data.leadsStats.leads).filter(([type]) => type !== "overall")
        : [],
    [data.leadsStats]
  );

  const pieChartData = useMemo(
    () =>
      leadTypes.map(([type, stats], index) => ({
        name: type.charAt(0).toUpperCase() + type.slice(1),
        value: stats.total || 0,
        color: CHART_COLORS[index % CHART_COLORS.length],
      })),
    [leadTypes]
  );

  const barChartData = useMemo(
    () =>
      leadTypes.map(([type, stats]) => ({
        name: type.charAt(0).toUpperCase() + type.slice(1),
        Assigned: stats.assigned || 0,
        Available: stats.available || 0,
      })),
    [leadTypes]
  );

  const weeklyData = useMemo(
    () => [
      { name: "Mon", leads: 45, orders: 12, conversions: 8 },
      { name: "Tue", leads: 52, orders: 18, conversions: 11 },
      { name: "Wed", leads: 48, orders: 15, conversions: 9 },
      { name: "Thu", leads: 70, orders: 22, conversions: 15 },
      { name: "Fri", leads: 65, orders: 28, conversions: 18 },
      { name: "Sat", leads: 35, orders: 14, conversions: 8 },
      { name: "Sun", leads: 28, orders: 10, conversions: 6 },
    ],
    []
  );

  const recentOrders = data.recentActivity || [];
  const totalLeads = data.leadsStats?.leads?.overall?.total || 0;
  const assignedLeads = data.leadsStats?.leads?.overall?.assigned || 0;
  const availableLeads = data.leadsStats?.leads?.overall?.available || 0;
  const totalUsers = data.usersStats?.total || 0;
  const activeAgents = data.usersStats?.activeAgents || 0;

  const assignmentRate = totalLeads ? Math.round((assignedLeads / totalLeads) * 100) : 0;
  const agentActiveRate = totalUsers ? Math.round((activeAgents / totalUsers) * 100) : 0;
  const pendingOrders = recentOrders.filter((o) => o.status === "pending").length;
  const completedOrders = recentOrders.filter(
    (o) => o.status === "fulfilled" || o.status === "completed"
  ).length;

  return (
    <Grid container spacing={3}>
      {/* KPI Cards Row */}
      <Grid item xs={6} sm={6} md={3}>
        <StatCard
          title="Total Users"
          value={formatNumber(totalUsers)}
          subtitle={`${activeAgents} active agents`}
          icon={<PeopleIcon sx={{ fontSize: 20 }} />}
          accentColor={COLORS.primary}
          trend="up"
          trendValue={`${agentActiveRate}% active`}
        />
      </Grid>
      <Grid item xs={6} sm={6} md={3}>
        <StatCard
          title="Total Leads"
          value={formatNumber(totalLeads)}
          subtitle={`${assignmentRate}% assigned`}
          icon={<AssignmentIcon sx={{ fontSize: 20 }} />}
          accentColor={COLORS.success}
          trend="up"
          trendValue={`${assignedLeads} assigned`}
        />
      </Grid>
      <Grid item xs={6} sm={6} md={3}>
        <StatCard
          title="Available Leads"
          value={formatNumber(availableLeads)}
          subtitle="Ready for assignment"
          icon={<InventoryIcon sx={{ fontSize: 20 }} />}
          accentColor={COLORS.accent}
        />
      </Grid>
      <Grid item xs={6} sm={6} md={3}>
        <StatCard
          title="Active Agents"
          value={formatNumber(activeAgents)}
          subtitle="Currently working"
          icon={<GroupsIcon sx={{ fontSize: 20 }} />}
          accentColor={COLORS.info}
        />
      </Grid>

      {/* Lead Type Breakdown Cards */}
      {leadTypes.slice(0, 4).map(([type, stats], index) => (
        <Grid item xs={6} sm={6} md={3} key={type}>
          <motion.div variants={itemVariants} style={{ height: "100%" }}>
            <Card
              sx={{
                height: "100%",
                borderRadius: "12px",
                boxShadow: cardShadow,
                border: "none",
                transition: "all 0.25s ease",
                "&:hover": { boxShadow: cardHoverShadow },
              }}
            >
              <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    mb: 1.5,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      color: COLORS.textSecondary,
                      fontWeight: 600,
                      textTransform: "capitalize",
                      fontSize: "0.78rem",
                    }}
                  >
                    {type} Leads
                  </Typography>
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      bgcolor: CHART_COLORS[index % CHART_COLORS.length],
                      boxShadow: `0 0 0 3px ${CHART_COLORS[index % CHART_COLORS.length]}25`,
                    }}
                  />
                </Box>
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 800,
                    color: COLORS.text,
                    mb: 1.5,
                    fontSize: "1.4rem",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {formatNumber(stats.total || 0)}
                </Typography>
                <MiniProgress
                  value={stats.assigned || 0}
                  maxValue={stats.total || 1}
                  color={CHART_COLORS[index % CHART_COLORS.length]}
                />
                <Box sx={{ display: "flex", justifyContent: "space-between", mt: 1.5 }}>
                  <Box>
                    <Typography
                      variant="caption"
                      sx={{ color: COLORS.textSecondary, fontSize: "0.68rem" }}
                    >
                      Assigned
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 700, color: COLORS.success, fontSize: "0.85rem" }}
                    >
                      {formatNumber(stats.assigned || 0)}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: "right" }}>
                    <Typography
                      variant="caption"
                      sx={{ color: COLORS.textSecondary, fontSize: "0.68rem" }}
                    >
                      Available
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 700, color: COLORS.accent, fontSize: "0.85rem" }}
                    >
                      {formatNumber(stats.available || 0)}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>
      ))}

      {/* Weekly Activity Chart */}
      <Grid item xs={12} lg={8}>
        <SectionCard title="Weekly Activity" subtitle="Leads, orders, and conversions this week">
          <Box sx={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyData}>
                <defs>
                  <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={COLORS.success} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke={COLORS.textSecondary}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke={COLORS.textSecondary}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                />
                <Area
                  type="monotone"
                  dataKey="leads"
                  stroke={COLORS.primary}
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorLeads)"
                  name="Leads"
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 2, fill: "#fff" }}
                />
                <Area
                  type="monotone"
                  dataKey="orders"
                  stroke={COLORS.success}
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorOrders)"
                  name="Orders"
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 2, fill: "#fff" }}
                />
                <Line
                  type="monotone"
                  dataKey="conversions"
                  stroke={COLORS.accent}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 2, fill: "#fff", stroke: COLORS.accent }}
                  name="Conversions"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </SectionCard>
      </Grid>

      {/* Lead Distribution */}
      <Grid item xs={12} lg={4}>
        <SectionCard title="Lead Distribution" subtitle="By lead type">
          <Box
            sx={{
              height: 300,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  height={40}
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => (
                    <span style={{ color: COLORS.textSecondary, fontSize: 12 }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </Box>
        </SectionCard>
      </Grid>

      {/* Assignment Status Bar Chart */}
      <Grid item xs={12} md={6}>
        <SectionCard title="Assignment Status" subtitle="Assigned vs Available by type">
          <Box sx={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData} barGap={4} barSize={22}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke={COLORS.textSecondary}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke={COLORS.textSecondary}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                />
                <Bar dataKey="Assigned" fill={COLORS.primary} radius={[6, 6, 0, 0]} />
                <Bar dataKey="Available" fill={COLORS.success} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </SectionCard>
      </Grid>

      {/* Recent Orders Table */}
      <Grid item xs={12} md={6}>
        <SectionCard
          title="Recent Orders"
          subtitle={`${recentOrders.length} latest orders`}
          noPadding
        >
          {recentOrders.length > 0 ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        fontSize: "0.72rem",
                        color: COLORS.textSecondary,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        bgcolor: COLORS.grayLight,
                        borderBottom: "none",
                        py: 1.5,
                      }}
                    >
                      Order ID
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        fontSize: "0.72rem",
                        color: COLORS.textSecondary,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        bgcolor: COLORS.grayLight,
                        borderBottom: "none",
                        py: 1.5,
                      }}
                    >
                      FTD
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        fontSize: "0.72rem",
                        color: COLORS.textSecondary,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        bgcolor: COLORS.grayLight,
                        borderBottom: "none",
                        py: 1.5,
                      }}
                    >
                      Filler
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        fontSize: "0.72rem",
                        color: COLORS.textSecondary,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        bgcolor: COLORS.grayLight,
                        borderBottom: "none",
                        py: 1.5,
                      }}
                    >
                      Status
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentOrders.slice(0, 5).map((order) => (
                    <TableRow
                      key={order._id}
                      hover
                      sx={{
                        "&:last-child td": { borderBottom: 0 },
                        "&:hover": { bgcolor: COLORS.grayLight + "80" },
                      }}
                    >
                      <TableCell
                        sx={{ fontSize: "0.82rem", fontWeight: 500, color: COLORS.text }}
                      >
                        #{order._id?.slice(-6) || "N/A"}
                      </TableCell>
                      <TableCell sx={{ fontSize: "0.82rem", color: COLORS.textSecondary }}>
                        {order.requests?.ftd || 0}
                      </TableCell>
                      <TableCell sx={{ fontSize: "0.82rem", color: COLORS.textSecondary }}>
                        {order.requests?.filler || 0}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={order.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ p: 4, textAlign: "center" }}>
              <Typography variant="body2" sx={{ color: COLORS.textSecondary }}>
                No recent orders
              </Typography>
            </Box>
          )}
        </SectionCard>
      </Grid>

      {/* System Overview KPI Row */}
      <Grid item xs={12}>
        <SectionCard title="System Overview" subtitle="Key performance indicators">
          <Grid container spacing={2}>
            {[
              { label: "Assignment Rate", value: `${assignmentRate}%`, color: COLORS.primary },
              { label: "Completed Orders", value: completedOrders, color: COLORS.success },
              { label: "Pending Orders", value: pendingOrders, color: COLORS.accent },
              { label: "Lead Types", value: leadTypes.length, color: COLORS.info },
              { label: "Agent Activity", value: `${agentActiveRate}%`, color: COLORS.primary },
              { label: "Total Leads", value: formatNumber(totalLeads), color: COLORS.success },
            ].map((item, index) => (
              <Grid item xs={6} sm={4} md={2} key={index}>
                <Box
                  sx={{
                    textAlign: "center",
                    p: 2,
                    bgcolor: item.color + "08",
                    borderRadius: "10px",
                    border: `1px solid ${item.color}15`,
                    transition: "all 0.2s ease",
                    "&:hover": {
                      bgcolor: item.color + "12",
                      transform: "translateY(-1px)",
                    },
                  }}
                >
                  <Typography
                    variant="h5"
                    sx={{
                      fontWeight: 800,
                      color: item.color,
                      fontSize: "1.3rem",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {item.value}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: COLORS.textSecondary,
                      fontWeight: 500,
                      fontSize: "0.7rem",
                    }}
                  >
                    {item.label}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </SectionCard>
      </Grid>
    </Grid>
  );
});

// ─── Agent Dashboard ──────────────────────────────────────────────────────────
const AgentDashboard = React.memo(({ data }) => {
  const performance = data.performance || {};
  const assignedLeads = data.leadsStats?.assigned || 0;
  const recentLeads = data.recentLeads || [];

  const weeklyPerformance = [
    { day: "Mon", calls: 12, conversions: 3 },
    { day: "Tue", calls: 18, conversions: 5 },
    { day: "Wed", calls: 15, conversions: 4 },
    { day: "Thu", calls: 22, conversions: 8 },
    { day: "Fri", calls: 20, conversions: 6 },
    { day: "Sat", calls: 8, conversions: 2 },
    { day: "Sun", calls: 5, conversions: 1 },
  ];

  const dailyTarget = 50;
  const progressPercentage = Math.min((assignedLeads / dailyTarget) * 100, 100);

  return (
    <Grid container spacing={3}>
      {/* Top Stats */}
      <Grid item xs={6} sm={6} md={3}>
        <StatCard
          title="Assigned Leads"
          value={formatNumber(assignedLeads)}
          subtitle="Active leads to call"
          icon={<AssignmentIcon sx={{ fontSize: 20 }} />}
          accentColor={COLORS.primary}
        />
      </Grid>
      <Grid item xs={6} sm={6} md={3}>
        <StatCard
          title="Calls Today"
          value={formatNumber(performance.totalCalls || 0)}
          subtitle="Completed calls"
          icon={<PhoneIcon sx={{ fontSize: 20 }} />}
          accentColor={COLORS.success}
          trend="up"
          trendValue="+5 from yesterday"
        />
      </Grid>
      <Grid item xs={6} sm={6} md={3}>
        <StatCard
          title="Earnings Today"
          value={formatCurrency(performance.totalEarnings || 0)}
          subtitle="Commission earned"
          icon={<MoneyIcon sx={{ fontSize: 20 }} />}
          accentColor={COLORS.info}
        />
      </Grid>
      <Grid item xs={6} sm={6} md={3}>
        <StatCard
          title="Conversion Rate"
          value={`${performance.conversionRate || 0}%`}
          subtitle="Lead to sale ratio"
          icon={<TrendingUpIcon sx={{ fontSize: 20 }} />}
          accentColor={COLORS.accent}
        />
      </Grid>

      {/* Daily Progress */}
      <Grid item xs={12} md={4}>
        <SectionCard title="Daily Progress" subtitle="Lead completion target">
          <Box sx={{ textAlign: "center", py: 2 }}>
            <Box sx={{ position: "relative", display: "inline-flex", mb: 2 }}>
              <CircularProgress
                variant="determinate"
                value={progressPercentage}
                size={140}
                thickness={4}
                sx={{
                  color: COLORS.primary,
                  "& .MuiCircularProgress-circle": {
                    strokeLinecap: "round",
                  },
                }}
              />
              <CircularProgress
                variant="determinate"
                value={100}
                size={140}
                thickness={4}
                sx={{
                  color: COLORS.primary + "12",
                  position: "absolute",
                  left: 0,
                  zIndex: -1,
                }}
              />
              <Box
                sx={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  bottom: 0,
                  right: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                }}
              >
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 800,
                    color: COLORS.text,
                    fontSize: "1.75rem",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {Math.round(progressPercentage)}%
                </Typography>
                <Typography variant="caption" sx={{ color: COLORS.textSecondary }}>
                  of target
                </Typography>
              </Box>
            </Box>
            <Typography variant="body2" sx={{ color: COLORS.textSecondary }}>
              {assignedLeads} of {dailyTarget} leads completed
            </Typography>
          </Box>
        </SectionCard>
      </Grid>

      {/* Weekly Performance Chart */}
      <Grid item xs={12} md={8}>
        <SectionCard title="Weekly Performance" subtitle="Calls and conversions this week">
          <Box sx={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyPerformance} barGap={4} barSize={24}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
                <XAxis
                  dataKey="day"
                  stroke={COLORS.textSecondary}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke={COLORS.textSecondary}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                />
                <Bar
                  dataKey="calls"
                  fill={COLORS.primary}
                  name="Calls"
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey="conversions"
                  fill={COLORS.success}
                  name="Conversions"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </SectionCard>
      </Grid>

      {/* Performance Metrics */}
      <Grid item xs={12} md={6}>
        <SectionCard title="Performance Metrics" subtitle="Your key statistics">
          <Grid container spacing={2}>
            {[
              {
                label: "Total Calls",
                value: performance.totalCalls || 0,
                icon: <PhoneIcon />,
                color: COLORS.primary,
              },
              {
                label: "Conversions",
                value: performance.conversions || 0,
                icon: <CheckCircleIcon />,
                color: COLORS.success,
              },
              {
                label: "Pending Follow-ups",
                value: performance.pendingFollowUps || 0,
                icon: <ScheduleIcon />,
                color: COLORS.accent,
              },
              {
                label: "This Month",
                value: formatCurrency(performance.monthlyEarnings || 0),
                icon: <MoneyIcon />,
                color: COLORS.info,
              },
            ].map((metric, index) => (
              <Grid item xs={6} key={index}>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: "10px",
                    bgcolor: metric.color + "08",
                    border: `1px solid ${metric.color}15`,
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    transition: "all 0.2s ease",
                    "&:hover": {
                      bgcolor: metric.color + "12",
                      transform: "translateY(-1px)",
                    },
                  }}
                >
                  <Avatar
                    sx={{
                      bgcolor: metric.color + "18",
                      color: metric.color,
                      width: 38,
                      height: 38,
                      borderRadius: "10px",
                    }}
                  >
                    {React.cloneElement(metric.icon, { sx: { fontSize: 18 } })}
                  </Avatar>
                  <Box>
                    <Typography
                      variant="body1"
                      sx={{ fontWeight: 700, color: COLORS.text, fontSize: "0.95rem" }}
                    >
                      {typeof metric.value === "number"
                        ? formatNumber(metric.value)
                        : metric.value}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: COLORS.textSecondary, fontSize: "0.7rem" }}
                    >
                      {metric.label}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </SectionCard>
      </Grid>

      {/* Tips & Guidelines */}
      <Grid item xs={12} md={6}>
        <SectionCard title="Performance Tips" subtitle="Maximize your productivity">
          <List dense sx={{ p: 0 }}>
            {[
              {
                icon: <PhoneIcon />,
                title: "Prime Call Hours",
                desc: "Best response rates between 10 AM - 2 PM",
              },
              {
                icon: <ScheduleIcon />,
                title: "Follow Up",
                desc: "Second calls have 40% higher conversion",
              },
              {
                icon: <CheckCircleIcon />,
                title: "Complete Notes",
                desc: "Detailed notes improve future conversions",
              },
              {
                icon: <SpeedIcon />,
                title: "Quick Response",
                desc: "First 5 minutes are critical for new leads",
              },
            ].map((tip, index) => (
              <ListItem
                key={index}
                sx={{
                  px: 1.5,
                  py: 1,
                  borderRadius: "8px",
                  mb: 0.5,
                  transition: "all 0.15s ease",
                  "&:hover": { bgcolor: COLORS.grayLight },
                }}
              >
                <ListItemAvatar>
                  <Avatar
                    sx={{
                      bgcolor: COLORS.primary + "12",
                      color: COLORS.primary,
                      width: 36,
                      height: 36,
                      borderRadius: "10px",
                    }}
                  >
                    {React.cloneElement(tip.icon, { sx: { fontSize: 18 } })}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={tip.title}
                  secondary={tip.desc}
                  primaryTypographyProps={{
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    color: COLORS.text,
                  }}
                  secondaryTypographyProps={{
                    fontSize: "0.75rem",
                    color: COLORS.textSecondary,
                  }}
                />
              </ListItem>
            ))}
          </List>
        </SectionCard>
      </Grid>
    </Grid>
  );
});

// ─── Affiliate Manager Dashboard ──────────────────────────────────────────────
const AffiliateManagerDashboard = React.memo(({ data }) => {
  const assignedLeads = data.leadsStats?.assigned || 0;
  const ordersStats = data.ordersStats || {};
  const recentOrders = data.recentActivity || [];

  const pendingOrders = recentOrders.filter((o) => o.status === "pending").length;
  const completedOrders = recentOrders.filter(
    (o) => o.status === "fulfilled" || o.status === "completed"
  ).length;

  return (
    <Grid container spacing={3}>
      {/* Stat Cards */}
      <Grid item xs={6} sm={6} md={3}>
        <StatCard
          title="Team Leads"
          value={formatNumber(assignedLeads)}
          subtitle="Under management"
          icon={<AssignmentIcon sx={{ fontSize: 20 }} />}
          accentColor={COLORS.primary}
        />
      </Grid>
      <Grid item xs={6} sm={6} md={3}>
        <StatCard
          title="Pending Orders"
          value={formatNumber(ordersStats.pending || pendingOrders)}
          subtitle="Awaiting fulfillment"
          icon={<PendingIcon sx={{ fontSize: 20 }} />}
          accentColor={COLORS.accent}
        />
      </Grid>
      <Grid item xs={6} sm={6} md={3}>
        <StatCard
          title="Completed Today"
          value={formatNumber(ordersStats.completed || completedOrders)}
          subtitle="Successfully fulfilled"
          icon={<TaskAltIcon sx={{ fontSize: 20 }} />}
          accentColor={COLORS.success}
        />
      </Grid>
      <Grid item xs={6} sm={6} md={3}>
        <StatCard
          title="Fulfillment Rate"
          value={`${ordersStats.fulfillmentRate || 85}%`}
          subtitle="Team performance"
          icon={<ShowChartIcon sx={{ fontSize: 20 }} />}
          accentColor={COLORS.info}
        />
      </Grid>

      {/* Recent Orders Summary */}
      <Grid item xs={12} md={6}>
        <SectionCard
          title="Recent Orders"
          subtitle={`${recentOrders.length} latest orders`}
          noPadding
        >
          {recentOrders.length > 0 ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        fontSize: "0.72rem",
                        color: COLORS.textSecondary,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        bgcolor: COLORS.grayLight,
                        borderBottom: "none",
                        py: 1.5,
                      }}
                    >
                      Order ID
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        fontSize: "0.72rem",
                        color: COLORS.textSecondary,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        bgcolor: COLORS.grayLight,
                        borderBottom: "none",
                        py: 1.5,
                      }}
                    >
                      Requests
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        fontSize: "0.72rem",
                        color: COLORS.textSecondary,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        bgcolor: COLORS.grayLight,
                        borderBottom: "none",
                        py: 1.5,
                      }}
                    >
                      Status
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentOrders.slice(0, 5).map((order) => (
                    <TableRow
                      key={order._id}
                      hover
                      sx={{
                        "&:last-child td": { borderBottom: 0 },
                        "&:hover": { bgcolor: COLORS.grayLight + "80" },
                      }}
                    >
                      <TableCell
                        sx={{ fontSize: "0.82rem", fontWeight: 500, color: COLORS.text }}
                      >
                        #{order._id?.slice(-6) || "N/A"}
                      </TableCell>
                      <TableCell sx={{ fontSize: "0.82rem", color: COLORS.textSecondary }}>
                        FTD: {order.requests?.ftd || 0}, Filler: {order.requests?.filler || 0}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={order.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ p: 4, textAlign: "center" }}>
              <Typography variant="body2" sx={{ color: COLORS.textSecondary }}>
                No recent orders
              </Typography>
            </Box>
          )}
        </SectionCard>
      </Grid>

      {/* Quick Stats */}
      <Grid item xs={12} md={6}>
        <SectionCard title="Team Overview" subtitle="Performance summary">
          <Grid container spacing={2}>
            {[
              { label: "Total Leads", value: formatNumber(assignedLeads), color: COLORS.primary },
              { label: "Completed", value: completedOrders, color: COLORS.success },
              { label: "Pending", value: pendingOrders, color: COLORS.accent },
              { label: "Total Orders", value: recentOrders.length, color: COLORS.info },
            ].map((item, index) => (
              <Grid item xs={6} key={index}>
                <Box
                  sx={{
                    p: 2.5,
                    bgcolor: item.color + "08",
                    borderRadius: "10px",
                    textAlign: "center",
                    border: `1px solid ${item.color}15`,
                    transition: "all 0.2s ease",
                    "&:hover": {
                      bgcolor: item.color + "12",
                      transform: "translateY(-1px)",
                    },
                  }}
                >
                  <Typography
                    variant="h4"
                    sx={{
                      fontWeight: 800,
                      color: item.color,
                      fontSize: "1.5rem",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {item.value}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: COLORS.textSecondary,
                      fontWeight: 500,
                      fontSize: "0.72rem",
                    }}
                  >
                    {item.label}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </SectionCard>
      </Grid>

      {/* Affiliate Manager Table */}
      <Grid item xs={12}>
        <motion.div variants={itemVariants}>
          <AffiliateManagerTableView />
        </motion.div>
      </Grid>
    </Grid>
  );
});

// ─── Generic Manager Dashboard ────────────────────────────────────────────────
const GenericManagerDashboard = React.memo(({ data, role }) => {
  const configs = {
    lead_manager: {
      title: "Lead Management",
      stats: [
        {
          title: "Pending Verifications",
          value: data.pendingVerifications || 0,
          icon: <PendingIcon />,
          color: COLORS.accent,
        },
        {
          title: "Verified Today",
          value: data.verifiedToday || 0,
          icon: <CheckCircleIcon />,
          color: COLORS.success,
        },
        {
          title: "Total Managed",
          value: data.totalManaged || 0,
          icon: <AssignmentIcon />,
          color: COLORS.primary,
        },
        {
          title: "Approval Rate",
          value: `${data.approvalRate || 92}%`,
          icon: <TrendingUpIcon />,
          color: COLORS.info,
        },
      ],
      description:
        "Access the Verifications page from the sidebar to manage pending lead verifications.",
    },
    refunds_manager: {
      title: "Refunds Management",
      stats: [
        {
          title: "Pending Refunds",
          value: data.pendingRefunds || 0,
          icon: <ReceiptIcon />,
          color: COLORS.accent,
        },
        {
          title: "Processed Today",
          value: data.processedToday || 0,
          icon: <CheckCircleIcon />,
          color: COLORS.success,
        },
        {
          title: "Total Amount",
          value: formatCurrency(data.totalAmount || 0),
          icon: <MoneyIcon />,
          color: COLORS.primary,
        },
        {
          title: "Avg Processing Time",
          value: `${data.avgProcessingTime || 24}h`,
          icon: <ScheduleIcon />,
          color: COLORS.info,
        },
      ],
      description: "Access the Refunds page from the sidebar to manage all refund requests.",
    },
    inventory_manager: {
      title: "Inventory Management",
      stats: [
        {
          title: "Active SIM Cards",
          value: data.activeSims || 0,
          icon: <InventoryIcon />,
          color: COLORS.success,
        },
        {
          title: "Available SIMs",
          value: data.availableSims || 0,
          icon: <ShippingIcon />,
          color: COLORS.primary,
        },
        {
          title: "Gateway Devices",
          value: data.gatewayDevices || 0,
          icon: <SpeedIcon />,
          color: COLORS.info,
        },
        {
          title: "Low Stock Alert",
          value: data.lowStockItems || 0,
          icon: <WarningIcon />,
          color: COLORS.accent,
        },
      ],
      description: "Use the SIM Cards and Gateway Devices pages to manage inventory.",
    },
  };

  const config = configs[role] || configs.lead_manager;

  return (
    <Grid container spacing={3}>
      {config.stats.map((stat, index) => (
        <Grid item xs={6} sm={6} md={3} key={index}>
          <StatCard
            title={stat.title}
            value={typeof stat.value === "number" ? formatNumber(stat.value) : stat.value}
            icon={React.cloneElement(stat.icon, { sx: { fontSize: 20 } })}
            accentColor={stat.color}
          />
        </Grid>
      ))}

      <Grid item xs={12}>
        <SectionCard title={config.title} subtitle="Quick navigation guide">
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              p: 2,
              bgcolor: COLORS.infoLight,
              borderRadius: "10px",
              border: `1px solid ${COLORS.info}20`,
            }}
          >
            <Avatar
              sx={{
                bgcolor: COLORS.info + "18",
                color: COLORS.info,
                width: 40,
                height: 40,
                borderRadius: "10px",
              }}
            >
              <InfoIcon sx={{ fontSize: 20 }} />
            </Avatar>
            <Typography variant="body2" sx={{ color: COLORS.text, fontWeight: 500 }}>
              {config.description}
            </Typography>
          </Box>
        </SectionCard>
      </Grid>
    </Grid>
  );
});

// ─── Loading Skeleton ─────────────────────────────────────────────────────────
const DashboardSkeleton = () => (
  <Box>
    {/* Header skeleton */}
    <Box sx={{ mb: 3 }}>
      <Skeleton
        variant="text"
        width={280}
        height={40}
        sx={{ borderRadius: "8px" }}
        animation="wave"
      />
      <Skeleton
        variant="text"
        width={200}
        height={20}
        sx={{ borderRadius: "6px", mt: 0.5 }}
        animation="wave"
      />
    </Box>
    {/* KPI cards skeleton */}
    <Grid container spacing={3}>
      {[1, 2, 3, 4].map((i) => (
        <Grid item xs={6} sm={6} md={3} key={i}>
          <Skeleton
            variant="rounded"
            height={140}
            sx={{ borderRadius: "12px" }}
            animation="wave"
          />
        </Grid>
      ))}
      {[1, 2, 3, 4].map((i) => (
        <Grid item xs={6} sm={6} md={3} key={`type-${i}`}>
          <Skeleton
            variant="rounded"
            height={160}
            sx={{ borderRadius: "12px" }}
            animation="wave"
          />
        </Grid>
      ))}
      <Grid item xs={12} lg={8}>
        <Skeleton
          variant="rounded"
          height={380}
          sx={{ borderRadius: "12px" }}
          animation="wave"
        />
      </Grid>
      <Grid item xs={12} lg={4}>
        <Skeleton
          variant="rounded"
          height={380}
          sx={{ borderRadius: "12px" }}
          animation="wave"
        />
      </Grid>
    </Grid>
  </Box>
);

// ─── Main Dashboard Component ─────────────────────────────────────────────────
const DashboardPage = () => {
  const user = useSelector(selectUser);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);

  const fetchDashboardData = React.useCallback(
    async (isRefresh = false) => {
      if (!user || !user.id || !user.role) {
        setLoading(false);
        return;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const promises = [];
        const { role, id } = user;

        if (role === USER_ROLES.ADMIN) {
          promises.push(
            api.get("/leads/stats"),
            api.get("/users/stats"),
            api.get("/orders?limit=10")
          );
        } else if (role === USER_ROLES.AFFILIATE_MANAGER) {
          promises.push(
            api.get("/orders?limit=10"),
            api.get("/leads?isAssigned=true"),
            api.get("/orders/stats").catch(() => ({ data: { data: {} } }))
          );
        } else if (role === USER_ROLES.AGENT) {
          promises.push(
            api.get("/leads/assigned"),
            api.get(`/users/${id}/performance`).catch(() => ({ data: { data: {} } }))
          );
        } else if (role === USER_ROLES.LEAD_MANAGER) {
          promises.push(api.get("/verifications/stats").catch(() => ({ data: { data: {} } })));
        } else if (role === USER_ROLES.REFUNDS_MANAGER) {
          promises.push(api.get("/refunds/stats").catch(() => ({ data: { data: {} } })));
        } else if (role === USER_ROLES.INVENTORY_MANAGER) {
          promises.push(api.get("/simcards/stats").catch(() => ({ data: { data: {} } })));
        }

        const responses = await Promise.allSettled(promises);
        const extractedData = responses.map((res) =>
          res.status === "fulfilled" ? res.value?.data?.data : null
        );

        const data = {};

        if (role === USER_ROLES.ADMIN) {
          data.leadsStats = extractedData[0];
          data.usersStats = extractedData[1];
          data.recentActivity = extractedData[2] || [];
        } else if (role === USER_ROLES.AFFILIATE_MANAGER) {
          data.recentActivity = extractedData[0] || [];
          data.leadsStats = { assigned: extractedData[1]?.length || 0 };
          data.ordersStats = extractedData[2] || {};
        } else if (role === USER_ROLES.AGENT) {
          const assignedLeads = extractedData[0] || [];
          data.leadsStats = { assigned: assignedLeads.length };
          data.performance = extractedData[1] || {};
          data.recentLeads = assignedLeads.slice(0, 5);
        } else if (role === USER_ROLES.LEAD_MANAGER) {
          Object.assign(data, extractedData[0] || {});
        } else if (role === USER_ROLES.REFUNDS_MANAGER) {
          Object.assign(data, extractedData[0] || {});
        } else if (role === USER_ROLES.INVENTORY_MANAGER) {
          Object.assign(data, extractedData[0] || {});
        }

        setDashboardData(data);
      } catch (err) {
        setError(err.message || "Failed to fetch dashboard data");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user]
  );

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleRefresh = () => {
    fetchDashboardData(true);
  };

  if (loading) {
    return (
      <Box sx={{ p: { xs: 2, md: 3 }, minHeight: "100vh" }}>
        <DashboardSkeleton />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert
          severity="error"
          variant="outlined"
          sx={{
            borderRadius: "12px",
            border: `1px solid ${COLORS.error}40`,
            bgcolor: COLORS.errorLight,
          }}
          action={
            <IconButton color="inherit" size="small" onClick={handleRefresh}>
              <RefreshIcon />
            </IconButton>
          }
        >
          {error}
        </Alert>
      </Box>
    );
  }

  const renderDashboardByRole = () => {
    if (!dashboardData) return null;

    switch (user.role) {
      case USER_ROLES.ADMIN:
        return <AdminDashboard data={dashboardData} />;
      case USER_ROLES.AGENT:
        return <AgentDashboard data={dashboardData} />;
      case USER_ROLES.AFFILIATE_MANAGER:
        return <AffiliateManagerDashboard data={dashboardData} />;
      case USER_ROLES.LEAD_MANAGER:
      case USER_ROLES.REFUNDS_MANAGER:
      case USER_ROLES.INVENTORY_MANAGER:
        return <GenericManagerDashboard data={dashboardData} role={user.role} />;
      default:
        return (
          <Alert
            severity="info"
            sx={{ borderRadius: "12px", border: `1px solid ${COLORS.info}30` }}
          >
            Welcome! Your dashboard is being configured.
          </Alert>
        );
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, minHeight: "100vh" }}>
      <motion.div variants={containerVariants} initial="hidden" animate="visible">
        <WelcomeHeader
          name={user?.fullName || user?.email}
          role={user?.role}
          onRefresh={handleRefresh}
          isRefreshing={refreshing}
        />
        {renderDashboardByRole()}
      </motion.div>
    </Box>
  );
};

export default DashboardPage;
