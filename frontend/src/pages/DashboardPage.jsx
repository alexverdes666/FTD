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

// Clean color palette - professional blues and grays
const COLORS = {
  primary: "#1976d2",
  primaryLight: "#e3f2fd",
  primaryDark: "#1565c0",
  success: "#2e7d32",
  successLight: "#e8f5e9",
  warning: "#ed6c02",
  warningLight: "#fff3e0",
  error: "#d32f2f",
  errorLight: "#ffebee",
  info: "#0288d1",
  infoLight: "#e1f5fe",
  gray: "#64748b",
  grayLight: "#f1f5f9",
  border: "#e2e8f0",
  background: "#fafbfc",
  text: "#1e293b",
  textSecondary: "#64748b",
};

const CHART_COLORS = ["#1976d2", "#2e7d32", "#ed6c02", "#9c27b0", "#00bcd4", "#ff5722"];

// Motion variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" },
  },
};

// Time-based greeting
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
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

// Welcome header component
const WelcomeHeader = React.memo(({ name, role, onRefresh, isRefreshing }) => {
  const roleLabels = {
    admin: "Administrator",
    affiliate_manager: "Affiliate Manager",
    agent: "Agent",
    lead_manager: "Lead Manager",
    refunds_manager: "Refunds Manager",
    inventory_manager: "Inventory Manager",
  };

  const now = new Date();

  return (
    <motion.div variants={itemVariants}>
      <Card
        sx={{
          mb: 3,
          border: `1px solid ${COLORS.border}`,
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <CardContent sx={{ py: 2.5, px: 3 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 2,
            }}
          >
            <Box>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 600,
                  color: COLORS.text,
                  mb: 0.5,
                }}
              >
                {getGreeting()}, {name?.split(" ")[0] || "there"}
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Chip
                  size="small"
                  label={roleLabels[role] || role}
                  sx={{
                    bgcolor: COLORS.primaryLight,
                    color: COLORS.primary,
                    fontWeight: 500,
                    fontSize: "0.75rem",
                  }}
                />
                <Typography variant="body2" color="text.secondary">
                  Here's your dashboard overview
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Box sx={{ textAlign: "right" }}>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 500, color: COLORS.text }}
                >
                  {now.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {now.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Typography>
              </Box>
              <Tooltip title="Refresh data">
                <IconButton
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  size="small"
                  sx={{
                    bgcolor: COLORS.grayLight,
                    "&:hover": { bgcolor: COLORS.border },
                  }}
                >
                  <RefreshIcon
                    fontSize="small"
                    sx={{
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
        </CardContent>
      </Card>
    </motion.div>
  );
});

// Clean stat card
const StatCard = React.memo(
  ({ title, value, subtitle, icon, iconColor, trend, trendValue, onClick }) => (
    <motion.div variants={itemVariants}>
      <Card
        onClick={onClick}
        sx={{
          height: "100%",
          border: `1px solid ${COLORS.border}`,
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          cursor: onClick ? "pointer" : "default",
          transition: "all 0.2s ease",
          "&:hover": onClick
            ? {
                borderColor: COLORS.primary,
                boxShadow: "0 4px 12px rgba(25, 118, 210, 0.15)",
              }
            : {},
        }}
      >
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <Box sx={{ flex: 1 }}>
              <Typography
                variant="body2"
                sx={{
                  color: COLORS.textSecondary,
                  fontWeight: 500,
                  fontSize: "0.8rem",
                  mb: 0.5,
                }}
              >
                {title}
              </Typography>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  color: COLORS.text,
                  fontSize: "1.75rem",
                  lineHeight: 1.2,
                }}
              >
                {value}
              </Typography>
              {subtitle && (
                <Typography
                  variant="caption"
                  sx={{ color: COLORS.textSecondary, display: "block", mt: 0.5 }}
                >
                  {subtitle}
                </Typography>
              )}
              {trend !== undefined && (
                <Box sx={{ display: "flex", alignItems: "center", mt: 1, gap: 0.5 }}>
                  {trend === "up" ? (
                    <ArrowUpIcon sx={{ color: COLORS.success, fontSize: 16 }} />
                  ) : trend === "down" ? (
                    <ArrowDownIcon sx={{ color: COLORS.error, fontSize: 16 }} />
                  ) : (
                    <TrendingFlatIcon sx={{ color: COLORS.gray, fontSize: 16 }} />
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
                      fontWeight: 600,
                    }}
                  >
                    {trendValue}
                  </Typography>
                </Box>
              )}
            </Box>
            <Avatar
              sx={{
                bgcolor: iconColor + "15",
                color: iconColor,
                width: 44,
                height: 44,
              }}
            >
              {icon}
            </Avatar>
          </Box>
        </CardContent>
      </Card>
    </motion.div>
  )
);

// Section card wrapper
const SectionCard = React.memo(({ title, subtitle, action, children, noPadding }) => (
  <motion.div variants={itemVariants}>
    <Card
      sx={{
        height: "100%",
        border: `1px solid ${COLORS.border}`,
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      {(title || action) && (
        <>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              px: 2.5,
              py: 2,
            }}
          >
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: COLORS.text }}>
                {title}
              </Typography>
              {subtitle && (
                <Typography variant="caption" color="text.secondary">
                  {subtitle}
                </Typography>
              )}
            </Box>
            {action}
          </Box>
          <Divider />
        </>
      )}
      <Box sx={{ p: noPadding ? 0 : 2.5 }}>{children}</Box>
    </Card>
  </motion.div>
));

// Custom tooltip for charts
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <Paper
        sx={{
          p: 1.5,
          border: `1px solid ${COLORS.border}`,
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
          {label}
        </Typography>
        {payload.map((entry, index) => (
          <Typography
            key={index}
            variant="caption"
            sx={{ color: entry.color, display: "block" }}
          >
            {entry.name}: {formatNumber(entry.value)}
          </Typography>
        ))}
      </Paper>
    );
  }
  return null;
};

// Status badge component
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
        fontWeight: 500,
        fontSize: "0.7rem",
        height: 22,
      }}
    />
  );
};

// Mini progress bar
const MiniProgress = ({ value, maxValue, color = COLORS.primary }) => {
  const percentage = maxValue ? Math.min((value / maxValue) * 100, 100) : 0;
  return (
    <Box sx={{ width: "100%" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          {formatNumber(value)} / {formatNumber(maxValue)}
        </Typography>
        <Typography variant="caption" sx={{ fontWeight: 600, color }}>
          {Math.round(percentage)}%
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={percentage}
        sx={{
          height: 6,
          borderRadius: 3,
          bgcolor: COLORS.grayLight,
          "& .MuiLinearProgress-bar": {
            bgcolor: color,
            borderRadius: 3,
          },
        }}
      />
    </Box>
  );
};

// Admin Dashboard Component
const AdminDashboard = React.memo(({ data }) => {
  const leadTypes = useMemo(
    () =>
      data.leadsStats?.leads
        ? Object.entries(data.leadsStats.leads).filter(([type]) => type !== "overall")
        : [],
    [data.leadsStats]
  );

  // Prepare chart data
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

  // Simulated activity data
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

  // Calculate additional metrics
  const assignmentRate = totalLeads ? Math.round((assignedLeads / totalLeads) * 100) : 0;
  const agentActiveRate = totalUsers ? Math.round((activeAgents / totalUsers) * 100) : 0;
  const pendingOrders = recentOrders.filter((o) => o.status === "pending").length;
  const completedOrders = recentOrders.filter((o) => o.status === "fulfilled" || o.status === "completed").length;

  return (
    <Grid container spacing={2.5}>
      {/* Top Stats Row */}
      <Grid item xs={6} sm={6} md={3}>
        <StatCard
          title="Total Users"
          value={formatNumber(totalUsers)}
          subtitle={`${activeAgents} active agents`}
          icon={<PeopleIcon fontSize="small" />}
          iconColor={COLORS.primary}
          trend="up"
          trendValue={`${agentActiveRate}% active`}
        />
      </Grid>
      <Grid item xs={6} sm={6} md={3}>
        <StatCard
          title="Total Leads"
          value={formatNumber(totalLeads)}
          subtitle={`${assignmentRate}% assigned`}
          icon={<AssignmentIcon fontSize="small" />}
          iconColor={COLORS.success}
          trend="up"
          trendValue={`${assignedLeads} assigned`}
        />
      </Grid>
      <Grid item xs={6} sm={6} md={3}>
        <StatCard
          title="Available Leads"
          value={formatNumber(availableLeads)}
          subtitle="Ready for assignment"
          icon={<InventoryIcon fontSize="small" />}
          iconColor={COLORS.warning}
        />
      </Grid>
      <Grid item xs={6} sm={6} md={3}>
        <StatCard
          title="Active Agents"
          value={formatNumber(activeAgents)}
          subtitle="Currently working"
          icon={<GroupsIcon fontSize="small" />}
          iconColor={COLORS.info}
        />
      </Grid>

      {/* Lead Type Breakdown Cards */}
      {leadTypes.slice(0, 4).map(([type, stats], index) => (
        <Grid item xs={6} sm={6} md={3} key={type}>
          <motion.div variants={itemVariants}>
            <Card
              sx={{
                border: `1px solid ${COLORS.border}`,
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              }}
            >
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      color: COLORS.textSecondary,
                      fontWeight: 500,
                      textTransform: "capitalize",
                    }}
                  >
                    {type} Leads
                  </Typography>
                  <CircleIcon sx={{ fontSize: 10, color: CHART_COLORS[index % CHART_COLORS.length] }} />
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 700, color: COLORS.text, mb: 1 }}>
                  {formatNumber(stats.total || 0)}
                </Typography>
                <MiniProgress
                  value={stats.assigned || 0}
                  maxValue={stats.total || 1}
                  color={CHART_COLORS[index % CHART_COLORS.length]}
                />
                <Box sx={{ display: "flex", justifyContent: "space-between", mt: 1.5 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Assigned
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: COLORS.success }}>
                      {formatNumber(stats.assigned || 0)}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: "right" }}>
                    <Typography variant="caption" color="text.secondary">
                      Available
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: COLORS.warning }}>
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
                    <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.1} />
                    <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.1} />
                    <stop offset="95%" stopColor={COLORS.success} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                <XAxis dataKey="name" stroke={COLORS.textSecondary} fontSize={12} tickLine={false} />
                <YAxis stroke={COLORS.textSecondary} fontSize={12} tickLine={false} axisLine={false} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="leads"
                  stroke={COLORS.primary}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorLeads)"
                  name="Leads"
                />
                <Area
                  type="monotone"
                  dataKey="orders"
                  stroke={COLORS.success}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorOrders)"
                  name="Orders"
                />
                <Line
                  type="monotone"
                  dataKey="conversions"
                  stroke={COLORS.warning}
                  strokeWidth={2}
                  dot={{ fill: COLORS.warning, r: 3 }}
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
          <Box sx={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  height={40}
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
              <BarChart data={barChartData} barGap={4} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                <XAxis dataKey="name" stroke={COLORS.textSecondary} fontSize={12} tickLine={false} />
                <YAxis stroke={COLORS.textSecondary} fontSize={12} tickLine={false} axisLine={false} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="Assigned" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Available" fill={COLORS.success} radius={[4, 4, 0, 0]} />
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
                  <TableRow sx={{ bgcolor: COLORS.grayLight }}>
                    <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem" }}>Order ID</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem" }}>FTD</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem" }}>Filler</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem" }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentOrders.slice(0, 5).map((order) => (
                    <TableRow key={order._id} hover>
                      <TableCell sx={{ fontSize: "0.8rem" }}>
                        #{order._id?.slice(-6) || "N/A"}
                      </TableCell>
                      <TableCell sx={{ fontSize: "0.8rem" }}>
                        {order.requests?.ftd || 0}
                      </TableCell>
                      <TableCell sx={{ fontSize: "0.8rem" }}>
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
            <Box sx={{ p: 3, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">
                No recent orders
              </Typography>
            </Box>
          )}
        </SectionCard>
      </Grid>

      {/* Quick Stats Summary */}
      <Grid item xs={12}>
        <SectionCard title="System Overview" subtitle="Key performance indicators">
          <Grid container spacing={3}>
            <Grid item xs={6} sm={4} md={2}>
              <Box sx={{ textAlign: "center", p: 1.5, bgcolor: COLORS.grayLight, borderRadius: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 700, color: COLORS.primary }}>
                  {assignmentRate}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Assignment Rate
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Box sx={{ textAlign: "center", p: 1.5, bgcolor: COLORS.grayLight, borderRadius: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 700, color: COLORS.success }}>
                  {completedOrders}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Completed Orders
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Box sx={{ textAlign: "center", p: 1.5, bgcolor: COLORS.grayLight, borderRadius: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 700, color: COLORS.warning }}>
                  {pendingOrders}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Pending Orders
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Box sx={{ textAlign: "center", p: 1.5, bgcolor: COLORS.grayLight, borderRadius: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 700, color: COLORS.info }}>
                  {leadTypes.length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Lead Types
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Box sx={{ textAlign: "center", p: 1.5, bgcolor: COLORS.grayLight, borderRadius: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 700, color: COLORS.primary }}>
                  {agentActiveRate}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Agent Activity
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Box sx={{ textAlign: "center", p: 1.5, bgcolor: COLORS.grayLight, borderRadius: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 700, color: COLORS.success }}>
                  {formatNumber(totalLeads)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Total Leads
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </SectionCard>
      </Grid>
    </Grid>
  );
});

// Agent Dashboard Component
const AgentDashboard = React.memo(({ data }) => {
  const performance = data.performance || {};
  const assignedLeads = data.leadsStats?.assigned || 0;
  const recentLeads = data.recentLeads || [];

  // Weekly performance data
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
    <Grid container spacing={2.5}>
      {/* Top Stats */}
      <Grid item xs={6} sm={6} md={3}>
        <StatCard
          title="Assigned Leads"
          value={formatNumber(assignedLeads)}
          subtitle="Active leads to call"
          icon={<AssignmentIcon fontSize="small" />}
          iconColor={COLORS.primary}
        />
      </Grid>
      <Grid item xs={6} sm={6} md={3}>
        <StatCard
          title="Calls Today"
          value={formatNumber(performance.totalCalls || 0)}
          subtitle="Completed calls"
          icon={<PhoneIcon fontSize="small" />}
          iconColor={COLORS.success}
          trend="up"
          trendValue="+5 from yesterday"
        />
      </Grid>
      <Grid item xs={6} sm={6} md={3}>
        <StatCard
          title="Earnings Today"
          value={formatCurrency(performance.totalEarnings || 0)}
          subtitle="Commission earned"
          icon={<MoneyIcon fontSize="small" />}
          iconColor={COLORS.info}
        />
      </Grid>
      <Grid item xs={6} sm={6} md={3}>
        <StatCard
          title="Conversion Rate"
          value={`${performance.conversionRate || 0}%`}
          subtitle="Lead to sale ratio"
          icon={<TrendingUpIcon fontSize="small" />}
          iconColor={COLORS.warning}
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
                sx={{ color: COLORS.primary }}
              />
              <CircularProgress
                variant="determinate"
                value={100}
                size={140}
                thickness={4}
                sx={{
                  color: COLORS.grayLight,
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
                <Typography variant="h4" sx={{ fontWeight: 700, color: COLORS.text }}>
                  {Math.round(progressPercentage)}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  of target
                </Typography>
              </Box>
            </Box>
            <Typography variant="body2" color="text.secondary">
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
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                <XAxis dataKey="day" stroke={COLORS.textSecondary} fontSize={12} tickLine={false} />
                <YAxis stroke={COLORS.textSecondary} fontSize={12} tickLine={false} axisLine={false} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="calls" fill={COLORS.primary} name="Calls" radius={[4, 4, 0, 0]} />
                <Bar dataKey="conversions" fill={COLORS.success} name="Conversions" radius={[4, 4, 0, 0]} />
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
              { label: "Total Calls", value: performance.totalCalls || 0, icon: <PhoneIcon />, color: COLORS.primary },
              { label: "Conversions", value: performance.conversions || 0, icon: <CheckCircleIcon />, color: COLORS.success },
              { label: "Pending Follow-ups", value: performance.pendingFollowUps || 0, icon: <ScheduleIcon />, color: COLORS.warning },
              { label: "This Month", value: formatCurrency(performance.monthlyEarnings || 0), icon: <MoneyIcon />, color: COLORS.info },
            ].map((metric, index) => (
              <Grid item xs={6} key={index}>
                <Box
                  sx={{
                    p: 2,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 2,
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                  }}
                >
                  <Avatar sx={{ bgcolor: metric.color + "15", color: metric.color, width: 36, height: 36 }}>
                    {React.cloneElement(metric.icon, { fontSize: "small" })}
                  </Avatar>
                  <Box>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: COLORS.text }}>
                      {typeof metric.value === "number" ? formatNumber(metric.value) : metric.value}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
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
              { icon: <PhoneIcon />, title: "Prime Call Hours", desc: "Best response rates between 10 AM - 2 PM" },
              { icon: <ScheduleIcon />, title: "Follow Up", desc: "Second calls have 40% higher conversion" },
              { icon: <CheckCircleIcon />, title: "Complete Notes", desc: "Detailed notes improve future conversions" },
              { icon: <SpeedIcon />, title: "Quick Response", desc: "First 5 minutes are critical for new leads" },
            ].map((tip, index) => (
              <ListItem key={index} sx={{ px: 0, py: 1 }}>
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: COLORS.primaryLight, color: COLORS.primary, width: 36, height: 36 }}>
                    {React.cloneElement(tip.icon, { fontSize: "small" })}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={tip.title}
                  secondary={tip.desc}
                  primaryTypographyProps={{ fontWeight: 500, fontSize: "0.875rem" }}
                  secondaryTypographyProps={{ fontSize: "0.75rem" }}
                />
              </ListItem>
            ))}
          </List>
        </SectionCard>
      </Grid>
    </Grid>
  );
});

// Affiliate Manager Dashboard Component
const AffiliateManagerDashboard = React.memo(({ data }) => {
  const assignedLeads = data.leadsStats?.assigned || 0;
  const ordersStats = data.ordersStats || {};
  const recentOrders = data.recentActivity || [];

  const pendingOrders = recentOrders.filter((o) => o.status === "pending").length;
  const completedOrders = recentOrders.filter((o) => o.status === "fulfilled" || o.status === "completed").length;

  return (
    <Grid container spacing={2.5}>
      {/* Stat Cards */}
      <Grid item xs={6} sm={6} md={3}>
        <StatCard
          title="Team Leads"
          value={formatNumber(assignedLeads)}
          subtitle="Under management"
          icon={<AssignmentIcon fontSize="small" />}
          iconColor={COLORS.primary}
        />
      </Grid>
      <Grid item xs={6} sm={6} md={3}>
        <StatCard
          title="Pending Orders"
          value={formatNumber(ordersStats.pending || pendingOrders)}
          subtitle="Awaiting fulfillment"
          icon={<PendingIcon fontSize="small" />}
          iconColor={COLORS.warning}
        />
      </Grid>
      <Grid item xs={6} sm={6} md={3}>
        <StatCard
          title="Completed Today"
          value={formatNumber(ordersStats.completed || completedOrders)}
          subtitle="Successfully fulfilled"
          icon={<TaskAltIcon fontSize="small" />}
          iconColor={COLORS.success}
        />
      </Grid>
      <Grid item xs={6} sm={6} md={3}>
        <StatCard
          title="Fulfillment Rate"
          value={`${ordersStats.fulfillmentRate || 85}%`}
          subtitle="Team performance"
          icon={<ShowChartIcon fontSize="small" />}
          iconColor={COLORS.info}
        />
      </Grid>

      {/* Recent Orders Summary */}
      <Grid item xs={12} md={6}>
        <SectionCard title="Recent Orders" subtitle={`${recentOrders.length} latest orders`} noPadding>
          {recentOrders.length > 0 ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: COLORS.grayLight }}>
                    <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem" }}>Order ID</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem" }}>Requests</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem" }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentOrders.slice(0, 5).map((order) => (
                    <TableRow key={order._id} hover>
                      <TableCell sx={{ fontSize: "0.8rem" }}>
                        #{order._id?.slice(-6) || "N/A"}
                      </TableCell>
                      <TableCell sx={{ fontSize: "0.8rem" }}>
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
            <Box sx={{ p: 3, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">
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
            <Grid item xs={6}>
              <Box sx={{ p: 2, bgcolor: COLORS.grayLight, borderRadius: 2, textAlign: "center" }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: COLORS.primary }}>
                  {formatNumber(assignedLeads)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Total Leads
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box sx={{ p: 2, bgcolor: COLORS.grayLight, borderRadius: 2, textAlign: "center" }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: COLORS.success }}>
                  {completedOrders}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Completed
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box sx={{ p: 2, bgcolor: COLORS.grayLight, borderRadius: 2, textAlign: "center" }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: COLORS.warning }}>
                  {pendingOrders}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Pending
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box sx={{ p: 2, bgcolor: COLORS.grayLight, borderRadius: 2, textAlign: "center" }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: COLORS.info }}>
                  {recentOrders.length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Total Orders
                </Typography>
              </Box>
            </Grid>
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

// Generic Manager Dashboard (for Lead Manager, Refunds Manager, Inventory Manager)
const GenericManagerDashboard = React.memo(({ data, role }) => {
  const configs = {
    lead_manager: {
      title: "Lead Management",
      stats: [
        { title: "Pending Verifications", value: data.pendingVerifications || 0, icon: <PendingIcon />, color: COLORS.warning },
        { title: "Verified Today", value: data.verifiedToday || 0, icon: <CheckCircleIcon />, color: COLORS.success },
        { title: "Total Managed", value: data.totalManaged || 0, icon: <AssignmentIcon />, color: COLORS.primary },
        { title: "Approval Rate", value: `${data.approvalRate || 92}%`, icon: <TrendingUpIcon />, color: COLORS.info },
      ],
      description: "Access the Verifications page from the sidebar to manage pending lead verifications.",
    },
    refunds_manager: {
      title: "Refunds Management",
      stats: [
        { title: "Pending Refunds", value: data.pendingRefunds || 0, icon: <ReceiptIcon />, color: COLORS.warning },
        { title: "Processed Today", value: data.processedToday || 0, icon: <CheckCircleIcon />, color: COLORS.success },
        { title: "Total Amount", value: formatCurrency(data.totalAmount || 0), icon: <MoneyIcon />, color: COLORS.primary },
        { title: "Avg Processing Time", value: `${data.avgProcessingTime || 24}h`, icon: <ScheduleIcon />, color: COLORS.info },
      ],
      description: "Access the Refunds page from the sidebar to manage all refund requests.",
    },
    inventory_manager: {
      title: "Inventory Management",
      stats: [
        { title: "Active SIM Cards", value: data.activeSims || 0, icon: <InventoryIcon />, color: COLORS.success },
        { title: "Available SIMs", value: data.availableSims || 0, icon: <ShippingIcon />, color: COLORS.primary },
        { title: "Gateway Devices", value: data.gatewayDevices || 0, icon: <SpeedIcon />, color: COLORS.info },
        { title: "Low Stock Alert", value: data.lowStockItems || 0, icon: <WarningIcon />, color: COLORS.warning },
      ],
      description: "Use the SIM Cards and Gateway Devices pages to manage inventory.",
    },
  };

  const config = configs[role] || configs.lead_manager;

  return (
    <Grid container spacing={2.5}>
      {config.stats.map((stat, index) => (
        <Grid item xs={6} sm={6} md={3} key={index}>
          <StatCard
            title={stat.title}
            value={typeof stat.value === "number" ? formatNumber(stat.value) : stat.value}
            icon={React.cloneElement(stat.icon, { fontSize: "small" })}
            iconColor={stat.color}
          />
        </Grid>
      ))}

      <Grid item xs={12}>
        <SectionCard title={config.title} subtitle="Quick navigation guide">
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <InfoIcon sx={{ color: COLORS.info }} />
            <Typography variant="body2" color="text.secondary">
              {config.description}
            </Typography>
          </Box>
        </SectionCard>
      </Grid>
    </Grid>
  );
});

// Loading skeleton
const DashboardSkeleton = () => (
  <Box>
    <Skeleton variant="rounded" height={80} sx={{ mb: 3, borderRadius: 2 }} animation="wave" />
    <Grid container spacing={2.5}>
      {[1, 2, 3, 4].map((i) => (
        <Grid item xs={6} sm={6} md={3} key={i}>
          <Skeleton variant="rounded" height={120} sx={{ borderRadius: 2 }} animation="wave" />
        </Grid>
      ))}
      {[1, 2, 3, 4].map((i) => (
        <Grid item xs={6} sm={6} md={3} key={`type-${i}`}>
          <Skeleton variant="rounded" height={140} sx={{ borderRadius: 2 }} animation="wave" />
        </Grid>
      ))}
      <Grid item xs={12} lg={8}>
        <Skeleton variant="rounded" height={380} sx={{ borderRadius: 2 }} animation="wave" />
      </Grid>
      <Grid item xs={12} lg={4}>
        <Skeleton variant="rounded" height={380} sx={{ borderRadius: 2 }} animation="wave" />
      </Grid>
    </Grid>
  </Box>
);

// Main Dashboard Component
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
      <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: COLORS.background, minHeight: "100vh" }}>
        <DashboardSkeleton />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert
          severity="error"
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
          <Alert severity="info">
            Welcome! Your dashboard is being configured.
          </Alert>
        );
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: COLORS.background, minHeight: "100vh" }}>
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
