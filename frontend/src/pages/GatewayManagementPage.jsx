import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Tooltip,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Router as RouterIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  SignalCellularAlt as SignalIcon
} from '@mui/icons-material';
import gatewayDeviceService from '../services/gatewayDeviceService';
import toast from 'react-hot-toast';

const GatewayManagementPage = () => {
  const [gateways, setGateways] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingGateway, setEditingGateway] = useState(null);
  const [testingGateway, setTestingGateway] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: '',
    username: '',
    password: '',
    description: '',
    isActive: true
  });

  useEffect(() => {
    fetchGateways();
  }, []);

  const fetchGateways = async () => {
    try {
      setLoading(true);
      const response = await gatewayDeviceService.getGatewayDevices(true);
      setGateways(response.data || []);
    } catch (error) {
      console.error('Error fetching gateways:', error);
      toast.error('Failed to load gateways');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (gateway = null) => {
    if (gateway) {
      setEditingGateway(gateway);
      setFormData({
        name: gateway.name,
        host: gateway.host,
        port: gateway.port,
        username: gateway.username,
        password: '', // Don't prefill password for security
        description: gateway.description || '',
        isActive: gateway.isActive
      });
    } else {
      setEditingGateway(null);
      setFormData({
        name: '',
        host: '',
        port: '',
        username: '',
        password: '',
        description: '',
        isActive: true
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingGateway(null);
    setFormData({
      name: '',
      host: '',
      port: '',
      username: '',
      password: '',
      description: '',
      isActive: true
    });
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async () => {
    try {
      // Validate required fields
      if (!formData.name || !formData.host || !formData.port || !formData.username) {
        toast.error('Please fill in all required fields');
        return;
      }

      // If editing and password is empty, don't include it
      const submitData = { ...formData };
      if (editingGateway && !submitData.password) {
        delete submitData.password;
      }

      if (!editingGateway && !submitData.password) {
        toast.error('Password is required for new gateway');
        return;
      }

      if (editingGateway) {
        await gatewayDeviceService.updateGatewayDevice(editingGateway._id, submitData);
        toast.success('Gateway updated successfully');
      } else {
        await gatewayDeviceService.createGatewayDevice(submitData);
        toast.success('Gateway created successfully');
      }

      handleCloseDialog();
      fetchGateways();
    } catch (error) {
      console.error('Error saving gateway:', error);
      toast.error(error.response?.data?.message || 'Failed to save gateway');
    }
  };

  const handleDelete = async (gateway) => {
    if (!window.confirm(`Are you sure you want to delete gateway "${gateway.name}"?`)) {
      return;
    }

    try {
      await gatewayDeviceService.deleteGatewayDevice(gateway._id);
      toast.success('Gateway deleted successfully');
      fetchGateways();
    } catch (error) {
      console.error('Error deleting gateway:', error);
      toast.error(error.response?.data?.message || 'Failed to delete gateway');
    }
  };

  const handleTestConnection = async (gateway) => {
    try {
      setTestingGateway(gateway._id);
      const response = await gatewayDeviceService.testGatewayConnection(gateway._id);
      
      if (response.success) {
        toast.success(`Connection to ${gateway.name} successful!`);
      } else {
        toast.error(`Connection to ${gateway.name} failed: ${response.error || 'Unknown error'}`);
      }
      
      // Refresh to show updated connection status
      fetchGateways();
    } catch (error) {
      console.error('Error testing connection:', error);
      toast.error(error.response?.data?.message || 'Failed to test connection');
    } finally {
      setTestingGateway(null);
    }
  };

  const getConnectionStatusChip = (gateway) => {
    if (testingGateway === gateway._id) {
      return <Chip size="small" label="Testing..." icon={<CircularProgress size={16} />} />;
    }

    switch (gateway.lastConnectionStatus) {
      case 'success':
        return (
          <Chip 
            size="small" 
            label="Connected" 
            color="success" 
            icon={<CheckCircleIcon />}
          />
        );
      case 'failed':
        return (
          <Chip 
            size="small" 
            label="Failed" 
            color="error" 
            icon={<ErrorIcon />}
          />
        );
      default:
        return (
          <Chip 
            size="small" 
            label="Not Tested" 
            color="default"
          />
        );
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <RouterIcon fontSize="large" />
          Gateway Devices Management
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchGateways}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Add Gateway
          </Button>
        </Box>
      </Box>

      {/* Info Alert */}
      {gateways.length === 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          No gateway devices configured yet. Click "Add Gateway" to create your first gateway.
        </Alert>
      )}

      {/* Gateways Table */}
      <Card>
        <CardContent>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Name</strong></TableCell>
                  <TableCell><strong>Host:Port</strong></TableCell>
                  <TableCell><strong>Username</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  <TableCell><strong>Connection</strong></TableCell>
                  <TableCell><strong>Last Test</strong></TableCell>
                  <TableCell align="right"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {gateways.map((gateway) => (
                  <TableRow key={gateway._id} hover>
                    <TableCell>
                      <Box>
                        <Typography variant="body1" fontWeight="bold">
                          {gateway.name}
                        </Typography>
                        {gateway.description && (
                          <Typography variant="caption" color="text.secondary">
                            {gateway.description}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {gateway.host}:{gateway.port}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {gateway.username}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={gateway.isActive ? 'Active' : 'Inactive'}
                        color={gateway.isActive ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      {getConnectionStatusChip(gateway)}
                    </TableCell>
                    <TableCell>
                      {gateway.lastConnectionTest ? (
                        <Typography variant="caption">
                          {new Date(gateway.lastConnectionTest).toLocaleString()}
                        </Typography>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          Never
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Test Connection">
                        <IconButton
                          size="small"
                          onClick={() => handleTestConnection(gateway)}
                          disabled={testingGateway === gateway._id}
                        >
                          <SignalIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDialog(gateway)}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(gateway)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingGateway ? 'Edit Gateway Device' : 'Add New Gateway Device'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label="Name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                helperText="A friendly name for this gateway (e.g., gsm, gsm32)"
              />
            </Grid>
            <Grid item xs={12} sm={8}>
              <TextField
                fullWidth
                required
                label="Host"
                name="host"
                value={formData.host}
                onChange={handleInputChange}
                helperText="IP address or hostname"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                required
                label="Port"
                name="port"
                type="number"
                value={formData.port}
                onChange={handleInputChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                required
                label="Username"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                required={!editingGateway}
                label="Password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleInputChange}
                helperText={editingGateway ? 'Leave blank to keep current' : ''}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                multiline
                rows={2}
                helperText="Optional description"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingGateway ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GatewayManagementPage;

