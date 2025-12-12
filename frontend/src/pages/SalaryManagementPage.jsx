import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Chip,
  InputAdornment,
  Tooltip,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  AccountBalance as SalaryIcon,
  Work as WorkIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import {
  getAllSalaryConfigurations,
  createOrUpdateSalaryConfiguration,
  deleteSalaryConfiguration,
  getSalaryStatistics,
  validateSalaryConfiguration,
  formatSalaryDisplay
} from '../services/salaryConfiguration';
import { 
  getAffiliateManagerTable 
} from '../services/affiliateManagerTable';
import { selectUser } from '../store/slices/authSlice';
import api from '../services/api';

const SalaryManagementPage = () => {
  const theme = useTheme();
  const user = useSelector(selectUser);

  // Salary state
  const [salaryConfigurations, setSalaryConfigurations] = useState([]);
  const [salaryLoading, setSalaryLoading] = useState(true);
  const [salaryStats, setSalaryStats] = useState(null);
  const [affiliateManagers, setAffiliateManagers] = useState([]);
  const [showSalaryForm, setShowSalaryForm] = useState(false);
  const [editingSalaryUser, setEditingSalaryUser] = useState(null);
  const [salaryFormData, setSalaryFormData] = useState({
    userId: '',
    salaryType: 'fixed_monthly',
    fixedSalary: {
      amount: '',
      currency: 'USD',
      paymentFrequency: 'monthly'
    },
    notes: ''
  });
  const [processing, setProcessing] = useState(false);
  
  // Commission calculation state
  const [commissionData, setCommissionData] = useState({});
  const [commissionLoading, setCommissionLoading] = useState(false);
  const [commissionPeriod, setCommissionPeriod] = useState('monthly');

  // General state
  const [alert, setAlert] = useState({ show: false, message: '', severity: 'info' });

  useEffect(() => {
    loadSalaryConfigurations();
    loadAffiliateManagers();
  }, []);

  useEffect(() => {
    if (affiliateManagers.length > 0) {
      loadCommissionData();
    }
  }, [affiliateManagers, commissionPeriod]);

  const showAlert = (message, severity = 'info') => {
    setAlert({ show: true, message, severity });
    setTimeout(() => setAlert({ show: false, message: '', severity: 'info' }), 5000);
  };

  const loadAffiliateManagers = async () => {
    try {
      console.log('Loading affiliate managers...');
      const response = await api.get('/users', { 
        params: { role: 'affiliate_manager' } 
      });
      console.log('Affiliate managers response:', response.data);
      
      const affiliateManagersData = response.data.data || [];
      console.log('Affiliate managers found:', affiliateManagersData.length);
      
      setAffiliateManagers(affiliateManagersData);
    } catch (error) {
      console.error('Failed to load affiliate managers:', error);
      console.error('Error response:', error.response?.data);
      showAlert('Failed to load affiliate managers', 'error');
    }
  };

  const loadSalaryConfigurations = async () => {
    try {
      setSalaryLoading(true);
      const [configsResponse, statsResponse] = await Promise.all([
        getAllSalaryConfigurations(),
        getSalaryStatistics()
      ]);
      setSalaryConfigurations(configsResponse.data);
      setSalaryStats(statsResponse.data);
    } catch (error) {
      console.error('Failed to load salary configurations:', error);
      showAlert('Failed to load salary configurations', 'error');
    } finally {
      setSalaryLoading(false);
    }
  };

  const loadCommissionData = async () => {
    try {
      setCommissionLoading(true);
      const commissionMap = {};
      
      // Get affiliate manager table data for each manager
      for (const manager of affiliateManagers) {
        try {
          const tableResponse = await getAffiliateManagerTable(manager._id, {
            period: commissionPeriod,
            date: new Date().toISOString()
          });
          
          const tableData = tableResponse.data;
          const profit = tableData.calculatedTotals?.profit || 0;
          const commission = profit * 0.1; // 10% commission on profit
          const totalMoney = tableData.totalMoney || 0;
          
          commissionMap[manager._id] = {
            profit,
            commission,
            totalMoney,
            period: commissionPeriod,
            tableData: tableData
          };
        } catch (error) {
          console.error(`Failed to load table data for ${manager.fullName}:`, error);
          // Set default values if table data fails to load
          commissionMap[manager._id] = {
            profit: 0,
            commission: 0,
            totalMoney: 0,
            period: commissionPeriod,
            tableData: null
          };
        }
      }
      
      setCommissionData(commissionMap);
    } catch (error) {
      console.error('Failed to load commission data:', error);
      showAlert('Failed to load commission data', 'error');
    } finally {
      setCommissionLoading(false);
    }
  };

  const handleRefresh = async () => {
    await Promise.all([loadSalaryConfigurations(), loadAffiliateManagers()]);
    // Commission data will be reloaded by the useEffect when affiliateManagers updates
    showAlert('Data refreshed successfully', 'success');
  };

  const handleOpenSalaryForm = (user = null) => {
    if (user) {
      setEditingSalaryUser(user);
      // Pre-populate form with existing configuration if available
      const existingConfig = salaryConfigurations.find(config => config.user._id === user._id);
      if (existingConfig) {
        setSalaryFormData({
          userId: user._id,
          salaryType: existingConfig.salaryType,
          fixedSalary: existingConfig.fixedSalary || {
            amount: '',
            currency: 'USD',
            paymentFrequency: 'monthly'
          },
          notes: existingConfig.notes || ''
        });
      } else {
        setSalaryFormData({
          userId: user._id,
          salaryType: 'fixed_monthly',
          fixedSalary: {
            amount: '',
            currency: 'USD',
            paymentFrequency: 'monthly'
          },
          notes: ''
        });
      }
    } else {
      setSalaryFormData({
        userId: '',
        salaryType: 'fixed_monthly',
        fixedSalary: {
          amount: '',
          currency: 'USD',
          paymentFrequency: 'monthly'
        },
        notes: ''
      });
    }
    setShowSalaryForm(true);
  };

  const handleCloseSalaryForm = () => {
    setShowSalaryForm(false);
    setEditingSalaryUser(null);
    setSalaryFormData({
      userId: '',
      salaryType: 'fixed_monthly',
      fixedSalary: {
        amount: '',
        currency: 'USD',
        paymentFrequency: 'monthly'
      },
      notes: ''
    });
  };

  const handleCreateSalaryConfiguration = async () => {
    try {
      setProcessing(true);

      const errors = validateSalaryConfiguration(salaryFormData);
      if (errors.length > 0) {
        showAlert(errors.join(', '), 'error');
        return;
      }

      // Clean the data based on salary type to avoid validation errors
      const cleanedData = {
        userId: salaryFormData.userId,
        salaryType: salaryFormData.salaryType,
        notes: salaryFormData.notes
      };

      if (salaryFormData.salaryType === 'fixed_monthly') {
        cleanedData.fixedSalary = salaryFormData.fixedSalary;
      }

      await createOrUpdateSalaryConfiguration(cleanedData);
      await loadSalaryConfigurations();
      handleCloseSalaryForm();
      showAlert('Salary configuration saved successfully', 'success');
    } catch (error) {
      console.error('Failed to save salary configuration:', error);
      showAlert('Failed to save salary configuration', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteSalaryConfiguration = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this salary configuration?')) return;

    try {
      setProcessing(true);
      await deleteSalaryConfiguration(userId);
      await loadSalaryConfigurations();
      showAlert('Salary configuration deleted successfully', 'success');
    } catch (error) {
      console.error('Failed to delete salary configuration:', error);
      showAlert('Failed to delete salary configuration', 'error');
    } finally {
      setProcessing(false);
    }
  };

  // Helper functions
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  const formatLargeCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  // Role-based access control
  const canManageSalaries = () => {
    return user && user.role === 'admin';
  };

  if (!canManageSalaries()) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          Access denied. Only administrators can manage salary configurations.
        </Alert>
      </Box>
    );
  }

  if (salaryLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {alert.show && (
        <Alert severity={alert.severity} sx={{ mb: 2 }}>
          {alert.message}
        </Alert>
      )}

      {/* Header */}
      <Card sx={{ mb: 3 }}>
        <CardHeader
          title={
            <Box display="flex" alignItems="center" gap={1}>
              <SalaryIcon />
              <Typography variant="h5" fontWeight="bold">
                Salary Management
              </Typography>
            </Box>
          }
          action={
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={handleRefresh}
              disabled={salaryLoading}
            >
              Refresh
            </Button>
          }
        />
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            Manage salary configurations for affiliate managers. Configure fixed monthly salaries plus 10% commission based on their affiliate table profit calculations.
          </Typography>
        </CardContent>
      </Card>

      {/* Salary Management Section */}
      <Card>
        <CardHeader
          title={
            <Box display="flex" alignItems="center" gap={1}>
              <WorkIcon />
              <Typography variant="h6">Salary Configurations</Typography>
              <Chip
                label={`${salaryConfigurations.length} Configurations`}
                size="small"
                color="primary"
                variant="outlined"
              />
            </Box>
          }
          action={
            <Box display="flex" gap={2}>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Table Period</InputLabel>
                <Select
                  value={commissionPeriod}
                  onChange={(e) => setCommissionPeriod(e.target.value)}
                  label="Table Period"
                >
                  <MenuItem value="monthly">Monthly</MenuItem>
                  <MenuItem value="weekly">Weekly</MenuItem>
                  <MenuItem value="daily">Daily</MenuItem>
                </Select>
              </FormControl>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleOpenSalaryForm()}
                color="primary"
              >
                Add Salary Config
              </Button>
            </Box>
          }
        />
        <CardContent>
          {salaryStats && (
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} md={3}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h4" color="primary">
                    {salaryStats.totalConfigurations}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Configurations
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={3}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h4" color="secondary">
                    {commissionLoading ? (
                      <CircularProgress size={24} />
                    ) : (
                      formatLargeCurrency(Object.values(commissionData).reduce((sum, data) => sum + data.commission, 0))
                    )}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Commission ({commissionPeriod})
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={3}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h4" color="success.main">
                    {commissionLoading ? (
                      <CircularProgress size={24} />
                    ) : (
                      formatLargeCurrency(Object.values(commissionData).reduce((sum, data) => sum + data.profit, 0))
                    )}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Profit ({commissionPeriod})
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={3}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h4" color="info.main">
                    {commissionLoading ? (
                      <CircularProgress size={24} />
                    ) : (
                      formatLargeCurrency(
                        Object.values(commissionData).reduce((sum, data) => sum + data.commission, 0) + 
                        salaryConfigurations.reduce((sum, config) => sum + (config.fixedSalary?.amount || 0), 0)
                      )
                    )}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Compensation ({commissionPeriod})
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          )}
          
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>
                    <Typography variant="subtitle2" fontWeight="bold">
                      User
                    </Typography>
                  </TableCell>
                                      <TableCell align="center">
                      <Typography variant="subtitle2" fontWeight="bold">
                        Fixed Salary
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="subtitle2" fontWeight="bold">
                        Commission (10%)
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="subtitle2" fontWeight="bold">
                        Total Compensation
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="subtitle2" fontWeight="bold">
                        Profit ({commissionPeriod})
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="subtitle2" fontWeight="bold">
                        Actions
                      </Typography>
                    </TableCell>
                  <TableCell align="center">
                    <Typography variant="subtitle2" fontWeight="bold">
                      Actions
                    </Typography>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {salaryConfigurations.map((config) => {
                  // Extract the appropriate salary data based on type
                  let salaryData = null;
                  if (config.salaryType === 'fixed_monthly' && config.fixedSalary) {
                    salaryData = config.fixedSalary;
                  }
                  
                  const salaryDisplay = formatSalaryDisplay(salaryData, config.salaryType);
                  const fixedSalary = salaryData?.amount || 0;
                  
                  // Get commission data for this user
                  const commissionInfo = commissionData[config.user._id] || { commission: 0, profit: 0, totalMoney: 0 };
                  const commission = commissionInfo.commission;
                  const totalCompensation = fixedSalary + commission;
                  
                  return (
                    <TableRow
                      key={config._id}
                      sx={{
                        '&:nth-of-type(odd)': {
                          backgroundColor: theme.palette.action.hover,
                        },
                        '&:hover': {
                          backgroundColor: theme.palette.action.selected,
                        },
                      }}
                    >
                      <TableCell>
                        <Box>
                          <Typography variant="body2" fontWeight="bold">
                            {config.user.fullName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {config.user.email}
                          </Typography>
                          <Chip
                            label={config.user.role}
                            size="small"
                            color="default"
                            variant="outlined"
                            sx={{ ml: 1 }}
                          />
                        </Box>
                      </TableCell>

                      <TableCell align="center">
                        <Box>
                          <Typography variant="body2" fontWeight="bold" color="primary">
                            {formatCurrency(fixedSalary)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {salaryDisplay?.secondary || 'Monthly'}
                          </Typography>
                        </Box>
                      </TableCell>

                      <TableCell align="center">
                        <Box>
                          <Typography variant="body2" fontWeight="bold" color="secondary">
                            {commissionLoading ? (
                              <CircularProgress size={16} />
                            ) : (
                              formatCurrency(commission)
                            )}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            10% of profit
                          </Typography>
                        </Box>
                      </TableCell>

                      <TableCell align="center">
                        <Box>
                          <Typography variant="body2" fontWeight="bold" color="success.main">
                            {commissionLoading ? (
                              <CircularProgress size={16} />
                            ) : (
                              formatCurrency(totalCompensation)
                            )}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Fixed + Commission
                          </Typography>
                        </Box>
                      </TableCell>

                      <TableCell align="center">
                        <Box>
                          <Typography variant="body2" fontWeight="bold">
                            {commissionLoading ? (
                              <CircularProgress size={16} />
                            ) : (
                              formatCurrency(commissionInfo.profit)
                            )}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Table Profit
                          </Typography>
                        </Box>
                      </TableCell>

                      <TableCell align="center">
                        <Box display="flex" gap={1} justifyContent="center">
                          <Tooltip title="Edit Configuration">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenSalaryForm(config.user)}
                              color="primary"
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete Configuration">
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteSalaryConfiguration(config.user._id)}
                              color="error"
                              disabled={processing}
                            >
                              <DeleteIcon />
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
        </CardContent>
      </Card>

      {/* Create/Edit Salary Configuration Dialog */}
      <Dialog open={showSalaryForm} onClose={handleCloseSalaryForm} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <SalaryIcon />
            <Typography>
              {editingSalaryUser ? 'Edit Salary Configuration' : 'Create Salary Configuration'}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Affiliate Manager</InputLabel>
                <Select
                  value={salaryFormData.userId}
                  onChange={(e) => setSalaryFormData(prev => ({ ...prev, userId: e.target.value }))}
                  label="Affiliate Manager"
                  disabled={!!editingSalaryUser}
                >
                  {affiliateManagers.length === 0 ? (
                    <MenuItem disabled>No affiliate managers available</MenuItem>
                  ) : (
                    affiliateManagers.map((user) => (
                      <MenuItem key={user._id} value={user._id}>
                        {user.fullName} ({user.role})
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Salary Type</InputLabel>
                <Select
                  value={salaryFormData.salaryType}
                  onChange={(e) => setSalaryFormData(prev => ({ ...prev, salaryType: e.target.value }))}
                  label="Salary Type"
                >
                  <MenuItem value="fixed_monthly">Fixed Monthly</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {salaryFormData.salaryType === 'fixed_monthly' && (
              <>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Monthly Amount"
                    type="number"
                    value={salaryFormData.fixedSalary.amount}
                    onChange={(e) => setSalaryFormData(prev => ({
                      ...prev,
                      fixedSalary: { ...prev.fixedSalary, amount: e.target.value }
                    }))}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">$</InputAdornment>,
                    }}
                    inputProps={{ min: 0, step: 0.01 }}
                    required
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Payment Frequency</InputLabel>
                    <Select
                      value={salaryFormData.fixedSalary.paymentFrequency}
                      onChange={(e) => setSalaryFormData(prev => ({
                        ...prev,
                        fixedSalary: { ...prev.fixedSalary, paymentFrequency: e.target.value }
                      }))}
                      label="Payment Frequency"
                    >
                      <MenuItem value="weekly">Weekly</MenuItem>
                      <MenuItem value="bi_weekly">Bi-Weekly</MenuItem>
                      <MenuItem value="monthly">Monthly</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </>
            )}

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                multiline
                rows={3}
                value={salaryFormData.notes}
                onChange={(e) => setSalaryFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes about this salary configuration..."
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseSalaryForm} startIcon={<CancelIcon />}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateSalaryConfiguration}
            variant="contained"
            startIcon={<SaveIcon />}
            disabled={processing}
          >
            {processing ? 'Saving...' : 'Save Configuration'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SalaryManagementPage; 