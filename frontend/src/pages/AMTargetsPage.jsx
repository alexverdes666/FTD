import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Pagination,
  IconButton,
  Tooltip,
  Paper,
  useTheme,
  Fade,
  Skeleton,
  LinearProgress,
} from '@mui/material';
import {
  TrackChanges as TargetIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  CheckCircle as CompletedIcon,
  Schedule as PendingIcon,
  Loop as InProgressIcon,
  Refresh as RefreshIcon,
  Warning as OverdueIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import { selectUser } from '../store/slices/authSlice';
import amTargetService from '../services/amTargetService';
import toast from 'react-hot-toast';

const AMTargetsPage = () => {
  const theme = useTheme();
  const user = useSelector(selectUser);
  const isAdmin = user?.role === 'admin' || user?.role === 'lead_manager';

  // State
  const [targets, setTargets] = useState([]);
  const [affiliateManagers, setAffiliateManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  // Filters
  const [filters, setFilters] = useState({
    status: '',
    assignedTo: '',
    dueDateFrom: '',
    dueDateTo: '',
  });

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignedTo: '',
    dueDate: '',
    status: 'pending',
  });
  const [formErrors, setFormErrors] = useState({});

  // Fetch affiliate managers for dropdown (admin only)
  const fetchAffiliateManagers = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const response = await amTargetService.getAffiliateManagers();
      if (response.success) {
        setAffiliateManagers(response.data);
      }
    } catch (err) {
      console.error('Error fetching affiliate managers:', err);
    }
  }, [isAdmin]);

  // Fetch targets
  const fetchTargets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = { page, limit: 10 };
      if (filters.status) params.status = filters.status;
      if (filters.assignedTo) params.assignedTo = filters.assignedTo;
      if (filters.dueDateFrom) params.dueDateFrom = filters.dueDateFrom;
      if (filters.dueDateTo) params.dueDateTo = filters.dueDateTo;

      let response;
      if (isAdmin) {
        response = await amTargetService.getAllTargets(params);
      } else {
        response = await amTargetService.getMyTargets(params);
      }

      if (response.success) {
        setTargets(response.data.map(t => amTargetService.formatTarget(t)));
        setTotalPages(response.pagination?.pages || 1);
      }
    } catch (err) {
      console.error('Error fetching targets:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, page, filters]);

  useEffect(() => {
    fetchAffiliateManagers();
  }, [fetchAffiliateManagers]);

  useEffect(() => {
    fetchTargets();
  }, [fetchTargets]);

  // Handle filter changes
  const handleFilterChange = (field) => (event) => {
    setFilters(prev => ({ ...prev, [field]: event.target.value }));
    setPage(1);
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({
      status: '',
      assignedTo: '',
      dueDateFrom: '',
      dueDateTo: '',
    });
    setPage(1);
  };

  // Handle form input changes
  const handleInputChange = (field) => (event) => {
    const value = event.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  // Open create dialog
  const handleOpenCreate = () => {
    setEditingTarget(null);
    setFormData({
      title: '',
      description: '',
      assignedTo: '',
      dueDate: '',
      status: 'pending',
    });
    setFormErrors({});
    setDialogOpen(true);
  };

  // Open edit dialog
  const handleOpenEdit = (target) => {
    setEditingTarget(target);
    setFormData({
      title: target.title,
      description: target.description || '',
      assignedTo: target.assignedTo?._id || '',
      dueDate: target.dueDate ? new Date(target.dueDate).toISOString().split('T')[0] : '',
      status: target.status,
    });
    setFormErrors({});
    setDialogOpen(true);
  };

  // Validate form
  const validateForm = () => {
    const validation = amTargetService.validateTargetData(formData);
    if (!validation.isValid) {
      setFormErrors(validation.errors);
      return false;
    }
    setFormErrors({});
    return true;
  };

  // Handle save (create or update)
  const handleSave = async () => {
    if (isAdmin && !validateForm()) return;

    try {
      setSaving(true);
      let response;

      if (editingTarget) {
        // Update
        const updateData = isAdmin
          ? formData
          : { status: formData.status }; // AM can only update status
        response = await amTargetService.updateTarget(editingTarget._id, updateData);
        toast.success('Target updated successfully!');
      } else {
        // Create
        response = await amTargetService.createTarget(formData);
        toast.success('Target created successfully!');
      }

      if (response.success) {
        setDialogOpen(false);
        fetchTargets();
      }
    } catch (err) {
      console.error('Error saving target:', err);
      toast.error(err.message || 'Failed to save target');
    } finally {
      setSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async (targetId) => {
    if (!window.confirm('Are you sure you want to delete this target?')) return;

    try {
      setDeleting(targetId);
      await amTargetService.deleteTarget(targetId);
      toast.success('Target deleted');
      fetchTargets();
    } catch (err) {
      console.error('Error deleting target:', err);
      toast.error(err.message || 'Failed to delete target');
    } finally {
      setDeleting(null);
    }
  };

  // Handle status update (quick action for AM)
  const handleStatusUpdate = async (target, newStatus) => {
    try {
      await amTargetService.updateTarget(target._id, { status: newStatus });
      toast.success('Status updated');
      fetchTargets();
    } catch (err) {
      console.error('Error updating status:', err);
      toast.error(err.message || 'Failed to update status');
    }
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CompletedIcon fontSize="small" />;
      case 'in_progress':
        return <InProgressIcon fontSize="small" />;
      default:
        return <PendingIcon fontSize="small" />;
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in_progress':
        return 'primary';
      default:
        return 'default';
    }
  };

  // Render target card
  const renderTargetCard = (target) => {
    const statusInfo = amTargetService.getStatusInfo(target.status);

    return (
      <Fade in key={target._id}>
        <Card
          sx={{
            mb: 2,
            borderLeft: target.isOverdue
              ? `4px solid ${theme.palette.error.main}`
              : target.status === 'completed'
              ? `4px solid ${theme.palette.success.main}`
              : 'none',
          }}
        >
          <CardContent>
            <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={1}>
              <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                <Chip
                  icon={getStatusIcon(target.status)}
                  label={statusInfo.label}
                  color={getStatusColor(target.status)}
                  size="small"
                />
                {target.isOverdue && (
                  <Chip
                    icon={<OverdueIcon fontSize="small" />}
                    label="Overdue"
                    color="error"
                    size="small"
                    variant="outlined"
                  />
                )}
              </Box>
              <Typography variant="caption" color="text.secondary">
                Due: {target.formattedDueDate}
              </Typography>
            </Box>

            <Typography variant="h6" gutterBottom fontWeight={600}>
              {target.title}
            </Typography>

            {target.description && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  whiteSpace: 'pre-wrap',
                  mb: 2,
                }}
              >
                {target.description}
              </Typography>
            )}

            <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
              {isAdmin && (
                <Box display="flex" alignItems="center" gap={0.5}>
                  <PersonIcon fontSize="small" color="action" />
                  <Typography variant="caption" color="text.secondary">
                    Assigned to: {target.assignedTo?.fullName || 'Unknown'}
                  </Typography>
                </Box>
              )}
              <Box display="flex" alignItems="center" gap={0.5}>
                <CalendarIcon fontSize="small" color="action" />
                <Typography variant="caption" color="text.secondary">
                  Created: {target.formattedCreatedAt}
                </Typography>
              </Box>
              {target.assignedBy && (
                <Typography variant="caption" color="text.secondary">
                  By: {target.assignedBy?.fullName}
                </Typography>
              )}
            </Box>

            {/* Progress indicator for due date */}
            {target.status !== 'completed' && (
              <Box mt={2}>
                <Typography variant="caption" color={target.isOverdue ? 'error' : 'text.secondary'}>
                  {target.isOverdue
                    ? `${Math.abs(target.daysUntilDue)} days overdue`
                    : target.daysUntilDue === 0
                    ? 'Due today'
                    : target.daysUntilDue === 1
                    ? '1 day left'
                    : `${target.daysUntilDue} days left`}
                </Typography>
              </Box>
            )}
          </CardContent>

          <CardActions sx={{ px: 2, pb: 2, justifyContent: 'space-between' }}>
            {/* Status quick actions for AM */}
            {!isAdmin && target.status !== 'completed' && (
              <Box display="flex" gap={1}>
                {target.status === 'pending' && (
                  <Button
                    size="small"
                    startIcon={<InProgressIcon />}
                    onClick={() => handleStatusUpdate(target, 'in_progress')}
                  >
                    Start
                  </Button>
                )}
                <Button
                  size="small"
                  color="success"
                  startIcon={<CompletedIcon />}
                  onClick={() => handleStatusUpdate(target, 'completed')}
                >
                  Complete
                </Button>
              </Box>
            )}

            {/* Admin actions */}
            {isAdmin && (
              <Box display="flex" gap={1}>
                <Button
                  size="small"
                  startIcon={<EditIcon />}
                  onClick={() => handleOpenEdit(target)}
                >
                  Edit
                </Button>
                <Button
                  size="small"
                  color="error"
                  startIcon={deleting === target._id ? <CircularProgress size={16} /> : <DeleteIcon />}
                  onClick={() => handleDelete(target._id)}
                  disabled={deleting === target._id}
                >
                  Delete
                </Button>
              </Box>
            )}

            {/* AM edit status button */}
            {!isAdmin && (
              <Button
                size="small"
                startIcon={<EditIcon />}
                onClick={() => handleOpenEdit(target)}
              >
                Change Status
              </Button>
            )}
          </CardActions>
        </Card>
      </Fade>
    );
  };

  // Loading skeleton
  const renderSkeleton = () => (
    <Box>
      {[1, 2, 3].map((i) => (
        <Card key={i} sx={{ mb: 2 }}>
          <CardContent>
            <Skeleton variant="rectangular" width={100} height={24} sx={{ mb: 2 }} />
            <Skeleton variant="text" width="60%" height={32} />
            <Skeleton variant="text" width="100%" />
            <Skeleton variant="text" width="40%" />
          </CardContent>
        </Card>
      ))}
    </Box>
  );

  return (
    <Container maxWidth="lg">
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box display="flex" alignItems="center" gap={2}>
          <TargetIcon fontSize="large" color="primary" />
          <Box>
            <Typography variant="h4" fontWeight={600}>
              {isAdmin ? 'AMs Targets' : 'My Targets'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {isAdmin
                ? 'Manage and assign targets to affiliate managers'
                : 'View and track your assigned targets'}
            </Typography>
          </Box>
        </Box>
        <Box display="flex" gap={1}>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchTargets} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          {isAdmin && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenCreate}
            >
              Assign Target
            </Button>
          )}
        </Box>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <FilterIcon color="action" />
          <Typography variant="subtitle2">Filters</Typography>
        </Box>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={filters.status}
                label="Status"
                onChange={handleFilterChange('status')}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="in_progress">In Progress</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          {isAdmin && (
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Affiliate Manager</InputLabel>
                <Select
                  value={filters.assignedTo}
                  label="Affiliate Manager"
                  onChange={handleFilterChange('assignedTo')}
                >
                  <MenuItem value="">All</MenuItem>
                  {affiliateManagers.map((am) => (
                    <MenuItem key={am._id} value={am._id}>
                      {am.fullName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="Due From"
              value={filters.dueDateFrom}
              onChange={handleFilterChange('dueDateFrom')}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="Due To"
              value={filters.dueDateTo}
              onChange={handleFilterChange('dueDateTo')}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<ClearIcon />}
              onClick={clearFilters}
            >
              Clear
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Targets List */}
      {loading ? (
        renderSkeleton()
      ) : targets.length === 0 ? (
        <Paper
          sx={{
            p: 6,
            textAlign: 'center',
            bgcolor: theme.palette.mode === 'dark'
              ? 'rgba(255,255,255,0.05)'
              : 'rgba(0,0,0,0.02)',
          }}
        >
          <TargetIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            No Targets Found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isAdmin
              ? 'No targets have been assigned yet. Click "Assign Target" to create one.'
              : 'You don\'t have any assigned targets at this time.'}
          </Typography>
        </Paper>
      ) : (
        <Box>
          {targets.map(renderTargetCard)}

          {/* Pagination */}
          {totalPages > 1 && (
            <Box display="flex" justifyContent="center" mt={4}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, value) => setPage(value)}
                color="primary"
              />
            </Box>
          )}
        </Box>
      )}

      {/* Create/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <TargetIcon color="primary" />
            <Typography variant="h6">
              {editingTarget
                ? isAdmin
                  ? 'Edit Target'
                  : 'Update Status'
                : 'Assign New Target'}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={3}>
            {/* Title - Admin only for create/edit */}
            {isAdmin && (
              <Grid item xs={12}>
                <TextField
                  label="Title"
                  fullWidth
                  required
                  value={formData.title}
                  onChange={handleInputChange('title')}
                  error={!!formErrors.title}
                  helperText={formErrors.title}
                  placeholder="Enter target title"
                  inputProps={{ maxLength: 200 }}
                />
              </Grid>
            )}

            {/* Description - Admin only */}
            {isAdmin && (
              <Grid item xs={12}>
                <TextField
                  label="Description"
                  fullWidth
                  multiline
                  rows={3}
                  value={formData.description}
                  onChange={handleInputChange('description')}
                  error={!!formErrors.description}
                  helperText={formErrors.description || `${formData.description.length}/1000 characters`}
                  placeholder="Enter target description (optional)"
                  inputProps={{ maxLength: 1000 }}
                />
              </Grid>
            )}

            {/* Assigned To - Admin only for create */}
            {isAdmin && !editingTarget && (
              <Grid item xs={12}>
                <FormControl fullWidth required error={!!formErrors.assignedTo}>
                  <InputLabel>Assign to Affiliate Manager</InputLabel>
                  <Select
                    value={formData.assignedTo}
                    label="Assign to Affiliate Manager"
                    onChange={handleInputChange('assignedTo')}
                  >
                    {affiliateManagers.map((am) => (
                      <MenuItem key={am._id} value={am._id}>
                        {am.fullName} ({am.email})
                      </MenuItem>
                    ))}
                  </Select>
                  {formErrors.assignedTo && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                      {formErrors.assignedTo}
                    </Typography>
                  )}
                </FormControl>
              </Grid>
            )}

            {/* Due Date - Admin only */}
            {isAdmin && (
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Due Date"
                  type="date"
                  fullWidth
                  required
                  value={formData.dueDate}
                  onChange={handleInputChange('dueDate')}
                  error={!!formErrors.dueDate}
                  helperText={formErrors.dueDate}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            )}

            {/* Status - All users can update for existing targets */}
            {editingTarget && (
              <Grid item xs={12} sm={isAdmin ? 6 : 12}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={formData.status}
                    label="Status"
                    onChange={handleInputChange('status')}
                  >
                    <MenuItem value="pending">
                      <Box display="flex" alignItems="center" gap={1}>
                        <PendingIcon fontSize="small" />
                        Pending
                      </Box>
                    </MenuItem>
                    <MenuItem value="in_progress">
                      <Box display="flex" alignItems="center" gap={1}>
                        <InProgressIcon fontSize="small" color="primary" />
                        In Progress
                      </Box>
                    </MenuItem>
                    <MenuItem value="completed">
                      <Box display="flex" alignItems="center" gap={1}>
                        <CompletedIcon fontSize="small" color="success" />
                        Completed
                      </Box>
                    </MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            )}

            {/* Display target info for AM when editing */}
            {!isAdmin && editingTarget && (
              <Grid item xs={12}>
                <Alert severity="info">
                  <Typography variant="body2">
                    <strong>Target:</strong> {editingTarget.title}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Due Date:</strong> {editingTarget.formattedDueDate}
                  </Typography>
                </Alert>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : editingTarget ? <EditIcon /> : <AddIcon />}
          >
            {saving ? 'Saving...' : editingTarget ? 'Update' : 'Assign Target'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AMTargetsPage;

