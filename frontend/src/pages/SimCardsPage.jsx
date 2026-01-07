import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
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
  TablePagination,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Alert,
  Tooltip,
  Stack,
  Divider,
  Collapse,
  Tabs,
  Tab
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  SimCard as SimCardIcon,
  PowerSettingsNew as PowerIcon,
  FilterList as FilterIcon,
  Assessment as StatsIcon,
  Dashboard as DashboardIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Storage as ManagementIcon,
  SignalCellularAlt as SignalIcon,
  Link as LinkIcon,
  VpnKey as KeyIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { simCardService } from '../services/simCardService';
import { selectUser } from '../store/slices/authSlice';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import LiveGatewayStatusTab from '../components/LiveGatewayStatusTab';

const SimCardsPage = () => {
  const user = useSelector(selectUser);
  const [simCards, setSimCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  
  // Tab state
  const [activeTab, setActiveTab] = useState(0);
  
  // Dashboard states
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [showDashboard, setShowDashboard] = useState(true);
  
  // Dialog states
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('create'); // 'create' or 'edit'
  const [selectedSimCard, setSelectedSimCard] = useState(null);
  
  // Form states
  const [formData, setFormData] = useState({
    geo: '',
    operator: '',
    dateCharged: new Date(),
    simNumber: '',
    notes: '',
    status: 'inactive',
    topUpLink: '',
    credentials: {
      username: '',
      password: ''
    }
  });
  
  // Filter states
  const [filters, setFilters] = useState({
    status: '',
    geo: '',
    operator: '',
    simNumber: '',
    dateFrom: null,
    dateTo: null
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showNeedsAttentionOnly, setShowNeedsAttentionOnly] = useState(false);

  useEffect(() => {
    fetchSimCards();
    fetchStats();
  }, [page, rowsPerPage, filters]);

  const fetchSimCards = async () => {
    try {
      setLoading(true);
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value && value !== '')
        )
      };
      
      const response = await simCardService.getSimCards(params);
      setSimCards(response.data);
      setTotalCount(response.pagination.total);
    } catch (error) {
      toast.error('Failed to fetch SIM cards');
      console.error('Error fetching SIM cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const response = await simCardService.getSimCardStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleCreateOrEdit = async () => {
    try {
      const payload = {
        ...formData,
        dateCharged: formData.dateCharged.toISOString()
      };

      if (dialogMode === 'create') {
        await simCardService.createSimCard(payload);
        toast.success('SIM card created successfully');
      } else {
        await simCardService.updateSimCard(selectedSimCard._id, payload);
        toast.success('SIM card updated successfully');
      }
      
      fetchSimCards();
      handleCloseDialog();
    } catch (error) {
      toast.error(error.message || 'Operation failed');
      console.error('Error:', error);
    }
  };

  const handleStatusChange = async (simCard) => {
    try {
      const newStatus = simCard.status === 'active' ? 'inactive' : 'active';
      await simCardService.updateSimCardStatus(simCard._id, newStatus);
      toast.success(`SIM card status changed to ${newStatus}`);
      fetchSimCards();
    } catch (error) {
      toast.error('Failed to update status');
      console.error('Error updating status:', error);
    }
  };

  const handleDelete = async (simCard) => {
    if (window.confirm(`Are you sure you want to delete SIM card ${simCard.simNumber}?`)) {
      try {
        await simCardService.deleteSimCard(simCard._id);
        toast.success('SIM card deleted successfully');
        fetchSimCards();
      } catch (error) {
        toast.error('Failed to delete SIM card');
        console.error('Error deleting SIM card:', error);
      }
    }
  };

  const handleOpenDialog = (mode, simCard = null) => {
    setDialogMode(mode);
    setSelectedSimCard(simCard);
    
    if (mode === 'edit' && simCard) {
      setFormData({
        geo: simCard.geo,
        operator: simCard.operator,
        dateCharged: new Date(simCard.dateCharged),
        simNumber: simCard.simNumber,
        notes: simCard.notes || '',
        status: simCard.status,
        topUpLink: simCard.topUpLink || '',
        credentials: {
          username: simCard.credentials?.username || '',
          password: simCard.credentials?.password || ''
        }
      });
    } else {
      setFormData({
        geo: '',
        operator: '',
        dateCharged: new Date(),
        simNumber: '',
        notes: '',
        status: 'inactive',
        topUpLink: '',
        credentials: {
          username: '',
          password: ''
        }
      });
    }
    
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedSimCard(null);
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
    setPage(0);
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      geo: '',
      operator: '',
      simNumber: '',
      dateFrom: null,
      dateTo: null
    });
    setPage(0);
  };

  const getStatusColor = (status) => {
    return status === 'active' ? 'success' : 'default';
  };

  // Calculate cooldown status for a SIM card
  const calculateCooldownStatus = (dateCharged) => {
    const currentDate = new Date();
    const chargedDate = new Date(dateCharged);
    
    // Use UTC dates to avoid timezone issues
    const chargedDateUTC = Date.UTC(chargedDate.getUTCFullYear(), chargedDate.getUTCMonth(), chargedDate.getUTCDate());
    const currentDateUTC = Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate());
    const daysSinceCharged = Math.floor((currentDateUTC - chargedDateUTC) / (1000 * 60 * 60 * 24));
    const daysRemaining = 30 - daysSinceCharged;
    
    let status = 'ok';
    let label = '';
    let color = 'success';
    let urgency = 'none';
    
    if (daysRemaining <= 0) {
      status = 'overdue';
      label = `${Math.abs(daysRemaining)} days overdue`;
      color = 'error';
      urgency = 'urgent';
    } else if (daysRemaining <= 5) {
      status = 'critical';
      label = `${daysRemaining} days left`;
      color = 'error';
      urgency = 'high';
    } else if (daysRemaining <= 10) {
      status = 'warning';
      label = `${daysRemaining} days left`;
      color = 'warning';
      urgency = 'medium';
    } else {
      status = 'ok';
      label = `${daysRemaining} days left`;
      color = 'success';
      urgency = 'none';
    }
    
    return { status, label, color, urgency, daysRemaining, daysSinceCharged };
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const renderManagementTab = () => (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog('create')}
            sx={{ 
              bgcolor: 'primary.main',
              '&:hover': { bgcolor: 'primary.dark' },
              fontWeight: 'bold'
            }}
          >
            Add SIM Card
          </Button>
          <Button
            variant="outlined"
            startIcon={showDashboard ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            onClick={() => setShowDashboard(!showDashboard)}
          >
            {showDashboard ? 'Hide Overview' : 'Show Overview'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<FilterIcon />}
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </Button>
          <Button
            variant={showNeedsAttentionOnly ? "contained" : "outlined"}
            color={showNeedsAttentionOnly ? "warning" : "inherit"}
            onClick={() => setShowNeedsAttentionOnly(!showNeedsAttentionOnly)}
          >
            {showNeedsAttentionOnly ? '⚠️ Showing Attention Needed' : '⚠️ Show Needs Attention Only'}
          </Button>
        </Stack>
      </Box>

      {/* Dashboard Overview Section */}
      <Collapse in={showDashboard}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DashboardIcon />
                Overview & Statistics
              </Typography>
              
              
              {statsLoading ? (
                <Typography>Loading statistics...</Typography>
              ) : stats ? (
                <Grid container spacing={3}>
                  {/* Overview Cards */}
                  <Grid item xs={12} md={4}>
                    <Card variant="outlined">
                      <CardContent sx={{ textAlign: 'center' }}>
                        <SimCardIcon sx={{ fontSize: 40, color: 'primary.main', mb: 2 }} />
                        <Typography variant="h4" color="primary">
                          {stats.overview.total}
                        </Typography>
                        <Typography variant="h6" color="text.secondary">
                          Total SIM Cards
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Card variant="outlined">
                      <CardContent sx={{ textAlign: 'center' }}>
                        <SimCardIcon sx={{ fontSize: 40, color: 'success.main', mb: 2 }} />
                        <Typography variant="h4" color="success.main">
                          {stats.overview.active}
                        </Typography>
                        <Typography variant="h6" color="text.secondary">
                          Active SIM Cards
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Card variant="outlined">
                      <CardContent sx={{ textAlign: 'center' }}>
                        <SimCardIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="h4" color="text.secondary">
                          {stats.overview.inactive}
                        </Typography>
                        <Typography variant="h6" color="text.secondary">
                          Inactive SIM Cards
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Stats by GEO */}
                  {stats.byGeo && stats.byGeo.length > 0 && (
                    <Grid item xs={12} md={6}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            Top 5 by GEO
                          </Typography>
                          {stats.byGeo.slice(0, 5).map((geo) => (
                            <Box key={geo._id} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="body1">{geo._id}:</Typography>
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                <Chip label={`Total: ${geo.count}`} size="small" />
                                <Chip label={`Active: ${geo.active}`} color="success" size="small" />
                              </Box>
                            </Box>
                          ))}
                        </CardContent>
                      </Card>
                    </Grid>
                  )}

                  {/* Stats by Operator */}
                  {stats.byOperator && stats.byOperator.length > 0 && (
                    <Grid item xs={12} md={6}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            Top 5 by Operator
                          </Typography>
                          {stats.byOperator.slice(0, 5).map((operator) => (
                            <Box key={operator._id} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="body1">{operator._id}:</Typography>
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                <Chip label={`Total: ${operator.count}`} size="small" />
                                <Chip label={`Active: ${operator.active}`} color="success" size="small" />
                              </Box>
                            </Box>
                          ))}
                        </CardContent>
                      </Card>
                    </Grid>
                  )}
                </Grid>
              ) : (
                <Typography>No statistics available</Typography>
              )}
            </CardContent>
          </Card>
      </Collapse>

      {/* Filters Section */}
      {showFilters && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={filters.status}
                      label="Status"
                      onChange={(e) => handleFilterChange('status', e.target.value)}
                    >
                      <MenuItem value="">All</MenuItem>
                      <MenuItem value="active">Active</MenuItem>
                      <MenuItem value="inactive">Inactive</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={2}>
                  <TextField
                    fullWidth
                    size="small"
                    label="GEO"
                    value={filters.geo}
                    onChange={(e) => handleFilterChange('geo', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Operator"
                    value={filters.operator}
                    onChange={(e) => handleFilterChange('operator', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <TextField
                    fullWidth
                    size="small"
                    label="SIM Number"
                    value={filters.simNumber}
                    onChange={(e) => handleFilterChange('simNumber', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <DatePicker
                    label="Date From"
                    value={filters.dateFrom}
                    onChange={(value) => handleFilterChange('dateFrom', value)}
                    renderInput={(params) => <TextField {...params} size="small" fullWidth />}
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <DatePicker
                    label="Date To"
                    value={filters.dateTo}
                    onChange={(value) => handleFilterChange('dateTo', value)}
                    renderInput={(params) => <TextField {...params} size="small" fullWidth />}
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <Button variant="outlined" onClick={clearFilters} fullWidth>
                    Clear
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
      )}

      {/* SIM Cards Table */}
      <Card>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>SIM Number</TableCell>
                  <TableCell>GEO</TableCell>
                  <TableCell>Operator</TableCell>
                  <TableCell>Date Charged</TableCell>
                  <TableCell>Cooldown Status</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Top-Up Link</TableCell>
                  <TableCell align="center">Credentials</TableCell>
                  <TableCell>Created By</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {simCards
                  .filter(simCard => {
                    if (!showNeedsAttentionOnly) return true;
                    const cooldown = calculateCooldownStatus(simCard.dateCharged);
                    return cooldown.daysRemaining <= 10; // Show only cards with 10 or fewer days remaining
                  })
                  .map((simCard) => (
                  <TableRow key={simCard._id}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {simCard.simNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>{simCard.geo}</TableCell>
                    <TableCell>{simCard.operator}</TableCell>
                    <TableCell>
                      {format(new Date(simCard.dateCharged), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const cooldown = calculateCooldownStatus(simCard.dateCharged);
                        return (
                          <Tooltip title={`${cooldown.daysSinceCharged} days since charged`}>
                            <Chip 
                              label={cooldown.label}
                              color={cooldown.color}
                              size="small"
                              icon={
                                cooldown.status === 'overdue' ? <span>⚠️</span> :
                                cooldown.status === 'critical' ? <span>🔴</span> :
                                cooldown.status === 'warning' ? <span>🟡</span> :
                                <span>✅</span>
                              }
                            />
                          </Tooltip>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={simCard.status}
                        color={getStatusColor(simCard.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      {simCard.topUpLink ? (
                        <Tooltip title={simCard.topUpLink}>
                          <IconButton 
                            size="small"
                            color="primary"
                            href={simCard.topUpLink}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <LinkIcon />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Typography variant="body2" color="text.disabled">-</Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {simCard.credentials?.username || simCard.credentials?.password ? (
                        <Tooltip title={`Username: ${simCard.credentials?.username || 'N/A'} | Password: ${simCard.credentials?.password ? '•••••' : 'N/A'}`}>
                          <IconButton size="small" color="primary">
                            <KeyIcon />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Typography variant="body2" color="text.disabled">-</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {simCard.createdBy?.fullName}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title={`${simCard.status === 'active' ? 'Deactivate' : 'Activate'} SIM`}>
                        <IconButton 
                          onClick={() => handleStatusChange(simCard)}
                          color={simCard.status === 'active' ? 'error' : 'success'}
                          size="small"
                        >
                          <PowerIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit SIM">
                        <IconButton 
                          onClick={() => handleOpenDialog('edit', simCard)}
                          color="primary"
                          size="small"
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete SIM">
                        <IconButton 
                          onClick={() => handleDelete(simCard)}
                          color="error"
                          size="small"
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
          
          <TablePagination
            component="div"
            count={totalCount}
            page={page}
            onPageChange={(event, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(parseInt(event.target.value, 10));
              setPage(0);
            }}
          />
      </Card>
    </Box>
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ width: "100%", typography: "body1" }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1" sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <SimCardIcon fontSize="large" />
            SIM Card Management
          </Typography>
        </Box>

        {/* Tabs */}
        <Card sx={{ mb: 3 }}>
          <Tabs 
            value={activeTab} 
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{
              borderBottom: 1,
              borderColor: 'divider',
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 'bold',
                fontSize: '1rem'
              }
            }}
          >
            <Tab 
              icon={<ManagementIcon />} 
              iconPosition="start" 
              label="SIM Card Management" 
            />
            <Tab 
              icon={<SignalIcon />} 
              iconPosition="start" 
              label="Live Gateway Status" 
            />
          </Tabs>
        </Card>

        {/* Tab Content */}
        {activeTab === 0 && renderManagementTab()}
        {activeTab === 1 && <LiveGatewayStatusTab />}

        {/* Create/Edit Dialog */}
        <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
          <DialogTitle>
            {dialogMode === 'create' ? 'Add New SIM Card' : 'Edit SIM Card'}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="SIM Number"
                  value={formData.simNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, simNumber: e.target.value }))}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="GEO"
                  value={formData.geo}
                  onChange={(e) => setFormData(prev => ({ ...prev, geo: e.target.value }))}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Operator"
                  value={formData.operator}
                  onChange={(e) => setFormData(prev => ({ ...prev, operator: e.target.value }))}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <DatePicker
                  label="Date Charged"
                  value={formData.dateCharged}
                  onChange={(value) => setFormData(prev => ({ ...prev, dateCharged: value }))}
                  renderInput={(params) => <TextField {...params} fullWidth required />}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={formData.status}
                    label="Status"
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                  >
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="inactive">Inactive</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Top-Up Link"
                  value={formData.topUpLink}
                  onChange={(e) => setFormData(prev => ({ ...prev, topUpLink: e.target.value }))}
                  placeholder="https://example.com/topup"
                />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Site Credentials
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Username/Email"
                  value={formData.credentials.username}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    credentials: { ...prev.credentials, username: e.target.value }
                  }))}
                  placeholder="Enter username or email"
                  autoComplete="off"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Password"
                  type="text"
                  value={formData.credentials.password}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    credentials: { ...prev.credentials, password: e.target.value }
                  }))}
                  placeholder="Enter password"
                  autoComplete="off"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  multiline
                  rows={3}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button onClick={handleCreateOrEdit} variant="contained">
              {dialogMode === 'create' ? 'Create' : 'Update'}
            </Button>
          </DialogActions>
        </Dialog>

      </Box>
    </LocalizationProvider>
  );
};

export default SimCardsPage;
