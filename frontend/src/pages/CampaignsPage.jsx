import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Alert,
  Switch,
  FormControlLabel,
  Tooltip,
  useTheme,
  useMediaQuery,
  Grid,
  CircularProgress,
  Card,
  CardContent,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  TrendingUp as MetricsIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import api from '../services/api';
import { useSelector } from 'react-redux';
import { selectUser } from '../store/slices/authSlice';
const campaignSchema = yup.object({
  name: yup.string().required('Name is required').max(100, 'Name must be less than 100 characters'),
  description: yup.string().max(500, 'Description must be less than 500 characters'),
  status: yup.string().oneOf(['active', 'paused', 'completed', 'draft']).default('active'),
  assignedAffiliateManagers: yup.array().of(yup.string()),
});
const CampaignsPage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const user = useSelector(selectUser);
  const [campaigns, setCampaigns] = useState([]);
  const [affiliateManagers, setAffiliateManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [viewingCampaign, setViewingCampaign] = useState(null);
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [openMetricsDialog, setOpenMetricsDialog] = useState(false);
  const [campaignMetrics, setCampaignMetrics] = useState(null);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [deletingCampaign, setDeletingCampaign] = useState(null);
  const [notification, setNotification] = useState({ message: '', severity: 'info' });
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(campaignSchema),
    defaultValues: {
      name: '',
      description: '',
      status: 'active',
      assignedAffiliateManagers: [],
    },
  });
  if (user?.role !== 'admin') {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Access denied. Only admins can manage campaigns.</Alert>
      </Box>
    );
  }
  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page + 1,
        limit: rowsPerPage,
      });
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter) params.append('status', statusFilter);
      if (showActiveOnly) params.append('isActive', 'true');
      const response = await api.get(`/campaigns?${params}`);
      if (response.data.success) {
        setCampaigns(response.data.data);
        setTotalCount(response.data.pagination.total);
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      setNotification({
        message: 'Failed to fetch campaigns',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, searchTerm, statusFilter, showActiveOnly]);
  const fetchAffiliateManagers = useCallback(async () => {
    try {
      const response = await api.get('/users?role=affiliate_manager&status=approved&limit=100');
      if (response.data.success) {
        setAffiliateManagers(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching affiliate managers:', error);
    }
  }, []);
  const fetchCampaignMetrics = async (campaignId) => {
    try {
      const response = await api.get(`/campaigns/${campaignId}/metrics`);
      if (response.data.success) {
        setCampaignMetrics(response.data.data);
        setOpenMetricsDialog(true);
      }
    } catch (error) {
      console.error('Error fetching campaign metrics:', error);
      setNotification({
        message: 'Failed to fetch campaign metrics',
        severity: 'error'
      });
    }
  };
  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);
  useEffect(() => {
    fetchAffiliateManagers();
  }, [fetchAffiliateManagers]);
  useEffect(() => {
    if (notification.message) {
      const timer = setTimeout(() => {
        setNotification({ message: '', severity: 'info' });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);
  const onSubmit = async (data) => {
    try {
      setSubmitting(true);
      const url = editingCampaign ? `/campaigns/${editingCampaign._id}` : '/campaigns';
      const method = editingCampaign ? 'put' : 'post';
      const response = await api[method](url, data);
      if (response.data.success) {
        setNotification({
          message: `Campaign ${editingCampaign ? 'updated' : 'created'} successfully`,
          severity: 'success'
        });
        setOpenDialog(false);
        setEditingCampaign(null);
        reset();
        fetchCampaigns();
      }
    } catch (error) {
      console.error('Error saving campaign:', error);
      setNotification({
        message: error.response?.data?.message || 'Failed to save campaign',
        severity: 'error'
      });
    } finally {
      setSubmitting(false);
    }
  };
  const handleDelete = async () => {
    if (!deletingCampaign) return;
    try {
      setSubmitting(true);
      const response = await api.delete(`/campaigns/${deletingCampaign._id}`);
      if (response.data.success) {
        setNotification({
          message: 'Campaign deleted successfully',
          severity: 'success'
        });
        setOpenDeleteDialog(false);
        setDeletingCampaign(null);
        fetchCampaigns();
      }
    } catch (error) {
      console.error('Error deleting campaign:', error);
      setNotification({
        message: error.response?.data?.message || 'Failed to delete campaign',
        severity: 'error'
      });
    } finally {
      setSubmitting(false);
    }
  };
  const handleEdit = (campaign) => {
    setEditingCampaign(campaign);
    reset({
      name: campaign.name,
      description: campaign.description || '',
      status: campaign.status,
      assignedAffiliateManagers: campaign.assignedAffiliateManagers?.map(m => m._id) || [],
    });
    setOpenDialog(true);
  };
  const handleView = (campaign) => {
    setViewingCampaign(campaign);
    setOpenViewDialog(true);
  };
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'paused': return 'warning';
      case 'completed': return 'info';
      case 'draft': return 'default';
      default: return 'default';
    }
  };
  return (
    <Box sx={{ p: isMobile ? 2 : 3 }}>
      {}
      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant={isMobile ? 'h5' : 'h4'}>Campaigns</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setEditingCampaign(null);
            reset();
            setOpenDialog(true);
          }}
          size={isMobile ? 'small' : 'medium'}
        >
          Add Campaign
        </Button>
      </Box>
      {}
      {notification.message && (
        <Alert severity={notification.severity} sx={{ mb: 2 }}>
          {notification.message}
        </Alert>
      )}
      {}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              placeholder="Search campaigns..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                label="Status"
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="paused">Paused</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="draft">Draft</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControlLabel
              control={
                <Switch
                  checked={showActiveOnly}
                  onChange={(e) => setShowActiveOnly(e.target.checked)}
                />
              }
              label="Active only"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <Button
              variant="outlined"
              startIcon={<FilterIcon />}
              onClick={fetchCampaigns}
              fullWidth
              size="small"
            >
              Apply Filters
            </Button>
          </Grid>
        </Grid>
      </Paper>
      {}
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Assigned Managers</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : campaigns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      No campaigns found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                campaigns.map((campaign) => (
                  <TableRow key={campaign._id} hover>
                    <TableCell>
                      <Box>
                        <Typography variant="subtitle2" fontWeight={600}>
                          {campaign.name}
                        </Typography>
                        {campaign.description && (
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {campaign.description}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={campaign.status}
                        color={getStatusColor(campaign.status)}
                        size="small"
                        sx={{ textTransform: 'capitalize' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {campaign.assignedManagersCount || 0}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() => handleView(campaign)}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit Campaign">
                          <IconButton
                            size="small"
                            onClick={() => handleEdit(campaign)}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="View Metrics">
                          <IconButton
                            size="small"
                            onClick={() => fetchCampaignMetrics(campaign._id)}
                          >
                            <MetricsIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Campaign">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setDeletingCampaign(campaign);
                              setOpenDeleteDialog(true);
                            }}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={totalCount}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>
      {}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          {editingCampaign ? 'Edit Campaign' : 'Create Campaign'}
        </DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent>
            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="name"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Campaign Name"
                      fullWidth
                      error={!!errors.name}
                      helperText={errors.name?.message}
                      required
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Controller
                  name="description"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Description"
                      fullWidth
                      multiline
                      rows={3}
                      error={!!errors.description}
                      helperText={errors.description?.message}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Status</InputLabel>
                      <Select {...field} label="Status">
                        <MenuItem value="active">Active</MenuItem>
                        <MenuItem value="paused">Paused</MenuItem>
                        <MenuItem value="completed">Completed</MenuItem>
                        <MenuItem value="draft">Draft</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="assignedAffiliateManagers"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Assigned Managers</InputLabel>
                      <Select
                        {...field}
                        multiple
                        input={<OutlinedInput label="Assigned Managers" />}
                        renderValue={(selected) => (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {selected.map((value) => {
                              const manager = affiliateManagers.find(m => m._id === value);
                              return (
                                <Chip
                                  key={value}
                                  label={manager?.fullName || value}
                                  size="small"
                                />
                              );
                            })}
                          </Box>
                        )}
                      >
                        {affiliateManagers.map((manager) => (
                          <MenuItem key={manager._id} value={manager._id}>
                            {manager.fullName} ({manager.email})
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={submitting || isSubmitting}
            >
              {submitting || isSubmitting ? <CircularProgress size={20} /> : (editingCampaign ? 'Update' : 'Create')}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
      {}
      <Dialog
        open={openViewDialog}
        onClose={() => setOpenViewDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Campaign Details</DialogTitle>
        <DialogContent>
          {viewingCampaign && (
            <Card>
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Typography variant="h6" gutterBottom>
                      {viewingCampaign.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      {viewingCampaign.description || 'No description'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="subtitle2">Status:</Typography>
                    <Chip
                      label={viewingCampaign.status}
                      color={getStatusColor(viewingCampaign.status)}
                      size="small"
                      sx={{ textTransform: 'capitalize' }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" gutterBottom>
                      Assigned Managers: ({viewingCampaign.assignedManagersCount || 0})
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                      {viewingCampaign.assignedAffiliateManagers?.map((manager) => (
                        <Chip
                          key={manager._id}
                          label={manager.fullName}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenViewDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      {}
      <Dialog
        open={openMetricsDialog}
        onClose={() => setOpenMetricsDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Campaign Performance Metrics</DialogTitle>
        <DialogContent>
          {campaignMetrics && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {campaignMetrics.campaign.name}
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={4}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="h4" color="primary">
                          {campaignMetrics.campaign.metrics.totalLeads}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Total Leads
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="h4" color="secondary">
                          {campaignMetrics.campaign.metrics.totalOrders}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Total Orders
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="h4" color="success.main">
                          {campaignMetrics.campaign.metrics.conversionRate}%
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Conversion Rate
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  {}
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle1" gutterBottom>
                      Orders by Status
                    </Typography>
                    {campaignMetrics.orderStats?.map((stat) => (
                      <Box key={stat._id} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                          {stat._id}:
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {stat.count}
                        </Typography>
                      </Box>
                    )) || (
                      <Typography variant="body2" color="text.secondary">
                        No order data available
                      </Typography>
                    )}
                  </Grid>
                  {}
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle1" gutterBottom>
                      Leads by Performance
                    </Typography>
                    {campaignMetrics.leadStats?.map((stat) => (
                      <Box key={stat._id} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                          {stat._id || 'Unassigned'}:
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {stat.count}
                        </Typography>
                      </Box>
                    )) || (
                      <Typography variant="body2" color="text.secondary">
                        No lead data available
                      </Typography>
                    )}
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenMetricsDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      {}
      <Dialog
        open={openDeleteDialog}
        onClose={() => setOpenDeleteDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete Campaign</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the campaign "{deletingCampaign?.name}"?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteDialog(false)}>Cancel</Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={submitting}
          >
            {submitting ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
export default CampaignsPage;