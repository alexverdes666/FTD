import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  Grid,
  Box,
  Chip,
  LinearProgress,
  Stack,
  Divider,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Phone as PhoneIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  AccessTime as AccessTimeIcon,
  TrendingUp as TrendingUpIcon,
  AttachMoney as MoneyIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
const AgentPerformanceCard = ({ performanceData, loading = false, estimatedEarnings = null }) => {
  const theme = useTheme();
  if (loading) {
    return (
      <Card sx={{ mb: 2 }}>
        <CardHeader title="Agent Performance" />
        <CardContent>
          <LinearProgress />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Loading your performance data...
          </Typography>
        </CardContent>
      </Card>
    );
  }
  if (!performanceData) {
    return (
      <Card sx={{ mb: 2 }}>
        <CardHeader title="Agent Performance" />
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            No performance data available. Please contact your administrator.
          </Typography>
        </CardContent>
      </Card>
    );
  }
  const {
    incomingCalls = {},
    outgoingCalls = {},
    metrics = {},
    agentName = 'Unknown Agent',
    lastUpdated
  } = performanceData;
  const formatTime = (timeString) => {
    if (!timeString || timeString === "00:00:00") return "0min";
    const [hours, minutes] = timeString.split(':');
    if (parseInt(hours) > 0) {
      return `${parseInt(hours)}h ${parseInt(minutes)}m`;
    }
    return `${parseInt(minutes)}m`;
  };
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };
  // Use estimated earnings if provided and valid, otherwise fall back to metrics.totalPay
  const hasValidEstimatedEarnings = estimatedEarnings !== null && estimatedEarnings !== undefined && !isNaN(estimatedEarnings);
  const displayedEarnings = hasValidEstimatedEarnings ? estimatedEarnings : (metrics.totalPay || 0);
  const earningsLabel = hasValidEstimatedEarnings ? "Estimated Earnings" : "Total Earnings";
  const earningsSubtext = hasValidEstimatedEarnings ? "Including bonuses & deductions" : `Rate: ${formatCurrency(metrics.ratePerSecond || 0)}/second`;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card
        sx={{
          mb: 2,
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
        }}
      >
        <CardHeader
          title={
            <Box display="flex" alignItems="center" gap={1}>
              <TrendingUpIcon color="primary" />
              <Typography variant="h6" component="div">
                Performance Dashboard
              </Typography>
            </Box>
          }
          subheader={
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Agent: {agentName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Last Updated: {formatDate(lastUpdated)}
              </Typography>
            </Box>
          }
        />
        <CardContent>
          <Grid container spacing={3}>
            {}
            <Grid item xs={12} md={6}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  background: alpha(theme.palette.success.main, 0.1),
                  border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                  <PhoneIcon color="success" />
                  <Typography variant="h6" color="success.main">
                    Total Calls
                  </Typography>
                </Stack>
                <Typography variant="h4" color="success.main">
                  {metrics.totalCalls || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Incoming: {incomingCalls.total || 0} | Outgoing: {outgoingCalls.total || 0}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  background: alpha(theme.palette.info.main, 0.1),
                  border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                  <CheckCircleIcon color="info" />
                  <Typography variant="h6" color="info.main">
                    Success Rate
                  </Typography>
                </Stack>
                <Typography variant="h4" color="info.main">
                  {metrics.successRate || 0}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Successful: {incomingCalls.successful || 0} | Failed: {incomingCalls.unsuccessful || 0}
                </Typography>
              </Box>
            </Grid>
            {}
            <Grid item xs={12} md={6}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  background: alpha(theme.palette.warning.main, 0.1),
                  border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                  <MoneyIcon color="warning" />
                  <Typography variant="h6" color="warning.main">
                    {earningsLabel}
                  </Typography>
                </Stack>
                <Typography variant="h4" color="warning.main">
                  {formatCurrency(displayedEarnings)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {earningsSubtext}
                </Typography>
              </Box>
            </Grid>
            {}
            <Grid item xs={12} md={6}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  background: alpha(theme.palette.secondary.main, 0.1),
                  border: `1px solid ${alpha(theme.palette.secondary.main, 0.2)}`
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                  <AccessTimeIcon color="secondary" />
                  <Typography variant="h6" color="secondary.main">
                    Total Talk Time
                  </Typography>
                </Stack>
                <Typography variant="h4" color="secondary.main">
                  {formatTime(incomingCalls.totalTime || "00:00:00")}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Avg: {formatTime(incomingCalls.averageTime || "00:00:00")} | Max: {formatTime(incomingCalls.maxTime || "00:00:00")}
                </Typography>
              </Box>
            </Grid>
            {}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" gutterBottom>
                Detailed Call Statistics
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h6" color="primary">
                      {incomingCalls.total || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Incoming Calls
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h6" color="success.main">
                      {incomingCalls.successful || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Successful
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h6" color="error.main">
                      {incomingCalls.unsuccessful || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Unsuccessful
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h6" color="info.main">
                      {formatTime(incomingCalls.averageWait || "00:00:00")}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Avg Wait Time
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Grid>
            {}
            <Grid item xs={12}>
              <Box sx={{ mt: 2 }}>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Chip
                    icon={<CheckCircleIcon />}
                    label={`${metrics.successRate || 0}% Success Rate`}
                    color={(metrics.successRate || 0) >= 80 ? 'success' : (metrics.successRate || 0) >= 60 ? 'warning' : 'error'}
                    variant="outlined"
                  />
                  <Chip
                    icon={<PhoneIcon />}
                    label={`${metrics.totalCalls || 0} Total Calls`}
                    color="primary"
                    variant="outlined"
                  />
                  <Chip
                    icon={<MoneyIcon />}
                    label={`${formatCurrency(displayedEarnings)} Earned`}
                    color="secondary"
                    variant="outlined"
                  />
                </Stack>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </motion.div>
  );
};
export default AgentPerformanceCard;