import React, { useState, useEffect } from 'react';
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
  CircularProgress,
  Button,
  Grid,
  Alert,
  Badge,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  SignalCellularAlt as SignalIcon,
  SimCard as SimCardIcon,
  CheckCircle as ActiveIcon,
  Cancel as InactiveIcon,
  AccountBalance as BalanceIcon,
  Router as RouterIcon
} from '@mui/icons-material';
import api from '../services/api';
import gatewayDeviceService from '../services/gatewayDeviceService';
import toast from 'react-hot-toast';

const LiveGatewayStatusTab = () => {
  const [gateways, setGateways] = useState([]);
  const [selectedGateway, setSelectedGateway] = useState('');
  const [gatewayStatus, setGatewayStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);

  // Fetch available gateways on component mount
  useEffect(() => {
    fetchGateways();
  }, []);

  // Fetch status when gateway is selected
  useEffect(() => {
    if (selectedGateway) {
      fetchLiveStatus();
      
      // Auto-refresh every 15 seconds
      let interval;
      if (autoRefresh) {
        interval = setInterval(() => {
          fetchLiveStatus(true);
        }, 15000);
      }
      
      return () => {
        if (interval) clearInterval(interval);
      };
    }
  }, [selectedGateway, autoRefresh]);

  const fetchGateways = async () => {
    try {
      const response = await gatewayDeviceService.getGatewayDevices(false);
      const activeGateways = response.data || [];
      setGateways(activeGateways);
      
      // Auto-select first gateway if available
      if (activeGateways.length > 0 && !selectedGateway) {
        setSelectedGateway(activeGateways[0]._id);
      }
    } catch (error) {
      console.error('Error fetching gateways:', error);
      toast.error('Failed to load gateway devices');
    }
  };

  const fetchLiveStatus = async (silent = false) => {
    if (!selectedGateway) return;
    
    try {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      
      const response = await gatewayDeviceService.getGatewayLiveStatus(selectedGateway);
      
      if (response.success) {
        console.log('Gateway Response:', response.data);
        setGatewayStatus(response.data);
        setLastUpdate(new Date());
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching live gateway status:', err);
      setError(err.response?.data?.message || 'Failed to connect to gateway');
      if (!silent) {
        toast.error('Failed to fetch gateway status');
      }
    } finally {
      setLoading(false);
    }
  };

  const parseGatewayResponse = () => {
    if (!gatewayStatus?.rawResponse) return null;
    
    console.log('Raw Response Type:', typeof gatewayStatus.rawResponse);
    console.log('Raw Response:', gatewayStatus.rawResponse);
    
    // The gateway should send JSON with dev-status or port-status
    // For now, we'll show the raw data and parse it
    try {
      if (typeof gatewayStatus.rawResponse === 'string') {
        // Try to parse as JSON
        const parsed = JSON.parse(gatewayStatus.rawResponse);
        console.log('Parsed Response:', parsed);
        return parsed;
      }
      // Already an object
      console.log('Already Object:', gatewayStatus.rawResponse);
      return gatewayStatus.rawResponse;
    } catch (e) {
      console.error('Parse error:', e);
      return gatewayStatus.rawResponse;
    }
  };

  const getStatusColor = (statusCode) => {
    const statusMap = {
      0: 'error',      // No SIM
      1: 'success',    // Idle
      2: 'warning',    // Registering
      3: 'success',    // Registered
      4: 'info',       // Call connected
      5: 'warning',    // No balance
      6: 'error',      // Register failed
      7: 'error',      // Locked device
      8: 'error',      // Locked operator
      9: 'error',      // Recognize error
      11: 'warning',   // Card detected
      12: 'error',     // User locked
      13: 'info',      // Port intercalling
      14: 'info'       // Intercalling holding
    };
    return statusMap[statusCode] || 'default';
  };

  const getStatusText = (statusCode) => {
    const statusMap = {
      0: 'No SIM',
      1: 'Idle',
      2: 'Registering',
      3: 'Registered',
      4: 'Call Connected',
      5: 'No Balance',
      6: 'Register Failed',
      7: 'Locked (Device)',
      8: 'Locked (Operator)',
      9: 'Recognition Error',
      11: 'Card Detected',
      12: 'User Locked',
      13: 'Inter-calling',
      14: 'Inter-calling Holding'
    };
    return statusMap[statusCode] || `Status ${statusCode}`;
  };

  const parseStatusCode = (st) => {
    if (!st) return 0;
    
    // If st is already a number, return it
    if (typeof st === 'number') return st;
    
    // If st is a string, try to parse it
    if (typeof st === 'string') {
      const parts = st.split(' ');
      return parseInt(parts[0]) || 0;
    }
    
    // If st is an object with code property
    if (typeof st === 'object' && st.code !== undefined) {
      return parseInt(st.code) || 0;
    }
    
    return 0;
  };

  const renderPortsFromData = (data) => {
    if (!data) return null;

    // Check if we have status array (from dev-status message)
    if (data.status && Array.isArray(data.status)) {
      const activeCount = data.status.filter(p => {
        const statusCode = parseStatusCode(p.st);
        return statusCode !== 0; // Not "No SIM"
      }).length;

      const totalBalance = data.status.reduce((sum, p) => {
        return sum + (parseFloat(p.bal) || 0);
      }, 0);

      return (
        <>
          {/* Stats Cards */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <SimCardIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                  <Typography variant="h4" color="primary">
                    {data.status.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Ports
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <ActiveIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
                  <Typography variant="h4" color="success.main">
                    {activeCount}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active (Has SIM)
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <InactiveIcon sx={{ fontSize: 40, color: 'error.main', mb: 1 }} />
                  <Typography variant="h4" color="error.main">
                    {data.status.length - activeCount}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Inactive (No SIM)
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
          </Grid>

          {/* Ports Table */}
          <Card>
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Port</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Operator</TableCell>
                    <TableCell>Balance</TableCell>
                    <TableCell>SIM Number</TableCell>
                    <TableCell>IMEI</TableCell>
                    <TableCell>IMSI</TableCell>
                    <TableCell>ICCID</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.status.map((port) => {
                    const statusCode = parseStatusCode(port.st);
                    
                    // Get status detail text
                    let statusDetail = '';
                    if (typeof port.st === 'string') {
                      const parts = port.st.split(' ');
                      statusDetail = parts.slice(1).join(' ');
                    }
                    
                    const hasSimCard = statusCode !== 0;

                    return (
                      <TableRow 
                        key={port.port}
                        sx={{ 
                          bgcolor: hasSimCard ? 'action.hover' : 'inherit',
                          opacity: hasSimCard ? 1 : 0.5
                        }}
                      >
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Badge
                              variant="dot"
                              color={hasSimCard ? 'success' : 'error'}
                            >
                              <SimCardIcon color={hasSimCard ? 'primary' : 'disabled'} />
                            </Badge>
                            <Typography variant="body2" fontWeight="bold">
                              {port.port}
                            </Typography>
                          </Box>
                        </TableCell>
                        
                        <TableCell>
                          <Chip
                            label={getStatusText(statusCode)}
                            color={getStatusColor(statusCode)}
                            size="small"
                          />
                        </TableCell>
                        
                        <TableCell>
                          <Typography variant="body2">
                            {port.opr || 'N/A'}
                          </Typography>
                        </TableCell>
                        
                        <TableCell>
                          <Typography 
                            variant="body2" 
                            fontWeight="bold" 
                            color={hasSimCard ? 'success.main' : 'text.disabled'}
                          >
                            ${parseFloat(port.bal || 0).toFixed(2)}
                          </Typography>
                        </TableCell>
                        
                        <TableCell>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                            {port.sn || '-'}
                          </Typography>
                        </TableCell>
                        
                        <TableCell>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                            {port.imei || '-'}
                          </Typography>
                        </TableCell>
                        
                        <TableCell>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                            {port.imsi || '-'}
                          </Typography>
                        </TableCell>
                        
                        <TableCell>
                          <Tooltip title={port.iccid || 'N/A'}>
                            <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                              {port.iccid ? `${port.iccid.substring(0, 10)}...` : '-'}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </>
      );
    }

    // Fallback: show raw data
    return (
      <Box>
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body1" gutterBottom>
            <strong>Gateway Response Format:</strong>
          </Typography>
          <Typography variant="body2">
            The gateway returned data in an unexpected format. Please check the console for details.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Expected format: JSON with "status" array containing port information.
          </Typography>
        </Alert>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Raw Gateway Response</Typography>
            <pre style={{ 
              background: '#f5f5f5', 
              padding: '16px', 
              borderRadius: '4px',
              overflow: 'auto',
              maxHeight: '400px',
              fontSize: '12px'
            }}>
              {JSON.stringify(data, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </Box>
    );
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="h6" gutterBottom>Cannot Connect to Gateway</Typography>
          <Typography variant="body2">{error}</Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Please check:
          </Typography>
          <ul>
            <li>Gateway is powered on and accessible at {gatewayStatus?.gatewayHost}:{gatewayStatus?.gatewayPort}</li>
            <li>Gateway credentials are correct in environment variables</li>
            <li>Network connectivity to gateway</li>
          </ul>
        </Alert>
        <Button
          variant="contained"
          startIcon={<RefreshIcon />}
          onClick={() => fetchLiveStatus()}
        >
          Retry Connection
        </Button>
      </Box>
    );
  }

  const parsedData = parseGatewayResponse();

  // Show loading or no gateways state
  if (gateways.length === 0 && !loading) {
    return (
      <Box>
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="h6" gutterBottom>No Gateway Devices Available</Typography>
          <Typography variant="body2">
            Please configure at least one gateway device to view live status.
          </Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header Controls */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ flex: 1, minWidth: 250 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
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
          
          {/* Gateway Selector */}
          <FormControl size="small" sx={{ minWidth: 250, mt: 1 }}>
            <InputLabel>Select Gateway</InputLabel>
            <Select
              value={selectedGateway}
              onChange={(e) => setSelectedGateway(e.target.value)}
              label="Select Gateway"
              startAdornment={<RouterIcon sx={{ mr: 1, ml: 0.5, color: 'action.active' }} />}
            >
              {gateways.map((gateway) => (
                <MenuItem key={gateway._id} value={gateway._id}>
                  {gateway.name} ({gateway.host}:{gateway.port})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          {lastUpdate && gatewayStatus?.gateway && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              Last updated: {lastUpdate.toLocaleTimeString()} • 
              {gatewayStatus.gateway.name} ({gatewayStatus.gateway.host}:{gatewayStatus.gateway.port})
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
            onClick={() => fetchLiveStatus()}
            disabled={loading || !selectedGateway}
          >
            Refresh Now
          </Button>
        </Box>
      </Box>

      {/* Gateway Data */}
      {renderPortsFromData(parsedData)}
    </Box>
  );
};

export default LiveGatewayStatusTab;
