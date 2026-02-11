import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Button,
  Grid,
  LinearProgress,
  Alert,
  Badge
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  SwapHoriz as SwitchIcon,
  RestartAlt as ResetIcon,
  Sms as SmsIcon,
  SignalCellularAlt as SignalIcon,
  AccountBalance as BalanceIcon,
  SimCard as SimCardIcon
} from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { simCardService } from '../services/simCardService';
import { useGatewayOperations, getStatusColor, getStatusDisplay } from '../hooks/useGatewayOperations';
import toast from 'react-hot-toast';

const GatewayStatusTab = () => {
  const queryClient = useQueryClient();
  const [autoRefresh, setAutoRefresh] = useState(true);

  const {
    loading: operationLoading,
    lockPort,
    unlockPort,
    resetPort
  } = useGatewayOperations();

  // React Query replaces the manual setInterval polling
  const { data: simCards = [], isLoading: loading, dataUpdatedAt } = useQuery({
    queryKey: ['gateway', 'simCards'],
    queryFn: async () => {
      const response = await simCardService.getSimCards({ limit: 100 });
      return response.data.filter(card => card.gateway?.enabled);
    },
    refetchInterval: autoRefresh ? 30000 : false,
  });

  const lastUpdate = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  const refetchSimCards = () => {
    queryClient.invalidateQueries({ queryKey: ['gateway', 'simCards'] });
  };

  const handleLockPort = async (simCard) => {
    if (window.confirm(`Lock port ${simCard.gateway.port}?`)) {
      const result = await lockPort(simCard._id);
      if (result) {
        toast.success('Port locked successfully');
        refetchSimCards();
      }
    }
  };

  const handleUnlockPort = async (simCard) => {
    const result = await unlockPort(simCard._id);
    if (result) {
      toast.success('Port unlocked successfully');
      refetchSimCards();
    }
  };

  const handleResetPort = async (simCard) => {
    if (window.confirm(`Reset port ${simCard.gateway.port}? This may cause temporary disconnection.`)) {
      const result = await resetPort(simCard._id);
      if (result) {
        toast.success('Port reset initiated');
        refetchSimCards();
      }
    }
  };

  const getStatusColorForChip = (deviceStatus) => {
    const color = getStatusColor(deviceStatus);
    const colorMap = {
      'green': 'success',
      'blue': 'info',
      'yellow': 'warning',
      'orange': 'warning',
      'red': 'error',
      'gray': 'default'
    };
    return colorMap[color] || 'default';
  };

  const isOnline = (lastStatusUpdate) => {
    if (!lastStatusUpdate) return false;
    const timeDiff = Date.now() - new Date(lastStatusUpdate).getTime();
    return timeDiff < 120000; // Online if updated within last 2 minutes
  };

  const getTimeSinceUpdate = (lastStatusUpdate) => {
    if (!lastStatusUpdate) return 'Never';
    const seconds = Math.floor((Date.now() - new Date(lastStatusUpdate).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  const onlineCount = simCards.filter(card => isOnline(card.gateway?.lastStatusUpdate)).length;
  const totalBalance = simCards.reduce((sum, card) => sum + (card.gateway?.balance || 0), 0);

  return (
    <Box>
      {/* Header Stats */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <SimCardIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
              <Typography variant="h4" color="primary">
                {simCards.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Gateway Enabled
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <SignalIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
              <Typography variant="h4" color="success.main">
                {onlineCount}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Online (Live)
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <BalanceIcon sx={{ fontSize: 40, color: 'info.main', mb: 1 }} />
              <Typography variant="h4" color="info.main">
                ${totalBalance.toFixed(2)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Balance
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <SmsIcon sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
              <Typography variant="h4" color="warning.main">
                {simCards.reduce((sum, card) => sum + (card.smsStats?.sent || 0), 0)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total SMS Sent
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Controls */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SignalIcon />
            Live Gateway Status
            {autoRefresh && (
              <Chip 
                label="Auto-refresh ON" 
                size="small" 
                color="success" 
                sx={{ ml: 1 }}
              />
            )}
          </Typography>
          {lastUpdate && (
            <Typography variant="caption" color="text.secondary">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </Typography>
          )}
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant={autoRefresh ? 'contained' : 'outlined'}
            size="small"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => refetchSimCards()}
            disabled={loading}
          >
            Refresh Now
          </Button>
        </Box>
      </Box>

      {simCards.length === 0 ? (
        <Alert severity="info">
          No SIM cards with gateway integration enabled. Enable gateway integration for your SIM cards to see their live status here.
        </Alert>
      ) : (
        <Card>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Port/Slot</TableCell>
                  <TableCell>SIM Number</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Operator</TableCell>
                  <TableCell>Balance</TableCell>
                  <TableCell>IMEI</TableCell>
                  <TableCell>SMS Stats</TableCell>
                  <TableCell>Last Update</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {simCards.map((simCard) => {
                  const online = isOnline(simCard.gateway?.lastStatusUpdate);
                  const statusColor = getStatusColorForChip(simCard.gateway?.deviceStatus);
                  
                  return (
                    <TableRow 
                      key={simCard._id}
                      sx={{ 
                        bgcolor: online ? 'action.hover' : 'inherit',
                        opacity: online ? 1 : 0.6
                      }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Badge
                            variant="dot"
                            color={online ? 'success' : 'error'}
                            sx={{ mr: 1 }}
                          >
                            <SimCardIcon color={online ? 'primary' : 'disabled'} />
                          </Badge>
                          <Box>
                            <Typography variant="body2" fontWeight="bold">
                              Port {simCard.gateway?.port}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Slot {simCard.gateway?.slot}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {simCard.simNumber}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {simCard.geo}
                        </Typography>
                      </TableCell>
                      
                      <TableCell>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          <Chip
                            label={getStatusDisplay(simCard.gateway?.deviceStatus)}
                            color={statusColor}
                            size="small"
                          />
                          {simCard.gateway?.isLocked && (
                            <Chip
                              icon={<LockIcon fontSize="small" />}
                              label="Locked"
                              size="small"
                              color="error"
                            />
                          )}
                        </Box>
                      </TableCell>
                      
                      <TableCell>
                        <Typography variant="body2">
                          {simCard.operator}
                        </Typography>
                        {simCard.gateway?.operatorId && (
                          <Typography variant="caption" color="text.secondary">
                            ID: {simCard.gateway.operatorId}
                          </Typography>
                        )}
                      </TableCell>
                      
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold" color="success.main">
                          ${simCard.gateway?.balance?.toFixed(2) || '0.00'}
                        </Typography>
                      </TableCell>
                      
                      <TableCell>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                          {simCard.gateway?.imei || 'N/A'}
                        </Typography>
                      </TableCell>
                      
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Tooltip title="Sent">
                            <Chip 
                              label={`↑ ${simCard.smsStats?.sent || 0}`}
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                          </Tooltip>
                          <Tooltip title="Received">
                            <Chip 
                              label={`↓ ${simCard.smsStats?.received || 0}`}
                              size="small"
                              color="info"
                              variant="outlined"
                            />
                          </Tooltip>
                        </Box>
                        {simCard.smsStats?.sentFailed > 0 && (
                          <Typography variant="caption" color="error">
                            {simCard.smsStats.sentFailed} failed
                          </Typography>
                        )}
                      </TableCell>
                      
                      <TableCell>
                        <Typography 
                          variant="caption" 
                          color={online ? 'success.main' : 'text.secondary'}
                          fontWeight={online ? 'bold' : 'normal'}
                        >
                          {getTimeSinceUpdate(simCard.gateway?.lastStatusUpdate)}
                        </Typography>
                      </TableCell>
                      
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                          {simCard.gateway?.isLocked ? (
                            <Tooltip title="Unlock Port">
                              <IconButton 
                                size="small" 
                                color="success"
                                onClick={() => handleUnlockPort(simCard)}
                                disabled={operationLoading}
                              >
                                <LockOpenIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          ) : (
                            <Tooltip title="Lock Port">
                              <IconButton 
                                size="small" 
                                color="error"
                                onClick={() => handleLockPort(simCard)}
                                disabled={operationLoading}
                              >
                                <LockIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          
                          <Tooltip title="Reset Port">
                            <IconButton 
                              size="small" 
                              color="warning"
                              onClick={() => handleResetPort(simCard)}
                              disabled={operationLoading}
                            >
                              <ResetIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Loading indicator for background refresh */}
      {loading && (
        <LinearProgress sx={{ mt: 2 }} />
      )}
    </Box>
  );
};

export default GatewayStatusTab;
