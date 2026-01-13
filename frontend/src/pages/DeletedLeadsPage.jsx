import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Button,
  TextField,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  InputAdornment
} from '@mui/material';
import {
  ArrowBack,
  Visibility,
  Restore,
  DeleteForever,
  Search,
  FilterList,
  Refresh
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import api from '../services/api';
import DeletedLeadDetailsModal from '../components/DeletedLeadDetailsModal';

const DeletedLeadsPage = () => {
  const navigate = useNavigate();
  const [deletedLeads, setDeletedLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0
  });

  // Filter states
  const [filters, setFilters] = useState({
    search: '',
    startDate: null,
    endDate: null,
    leadType: '',
    migrationRecovered: ''
  });

  // Modal states
  const [detailsModal, setDetailsModal] = useState({
    open: false,
    deletedLead: null
  });

  const [restoreDialog, setRestoreDialog] = useState({
    open: false,
    deletedLeadId: null,
    leadName: ''
  });

  const [permanentDeleteDialog, setPermanentDeleteDialog] = useState({
    open: false,
    deletedLeadId: null,
    leadName: ''
  });

  // Fetch deleted leads
  const fetchDeletedLeads = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: page,
        limit: pagination.limit,
        ...(filters.search && { search: filters.search }),
        ...(filters.startDate && { startDate: filters.startDate.toISOString() }),
        ...(filters.endDate && { endDate: filters.endDate.toISOString() }),
        ...(filters.leadType && { leadType: filters.leadType }),
        ...(filters.migrationRecovered && { migrationRecovered: filters.migrationRecovered })
      };

      const response = await api.get('/deleted-leads', { params });
      setDeletedLeads(response.data.data || []);
      setPagination({
        page: response.data.page,
        limit: response.data.limit || 50,
        total: response.data.total,
        pages: response.data.pages
      });
    } catch (err) {
      console.error('Error fetching deleted leads:', err);
      setError(err.response?.data?.message || 'Failed to fetch deleted leads');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.limit]);

  useEffect(() => {
    fetchDeletedLeads(1);
  }, []);

  const handlePageChange = (event, newPage) => {
    fetchDeletedLeads(newPage + 1);
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleSearch = () => {
    fetchDeletedLeads(1);
  };

  const handleClearFilters = () => {
    setFilters({
      search: '',
      startDate: null,
      endDate: null,
      leadType: '',
      migrationRecovered: ''
    });
    setTimeout(() => fetchDeletedLeads(1), 100);
  };

  const handleViewDetails = (deletedLead) => {
    setDetailsModal({
      open: true,
      deletedLead: deletedLead
    });
  };

  const handleCloseDetails = () => {
    setDetailsModal({
      open: false,
      deletedLead: null
    });
  };

  const handleOpenRestoreDialog = (deletedLeadId, leadName) => {
    setRestoreDialog({
      open: true,
      deletedLeadId: deletedLeadId,
      leadName: leadName
    });
  };

  const handleCloseRestoreDialog = () => {
    setRestoreDialog({
      open: false,
      deletedLeadId: null,
      leadName: ''
    });
  };

  const handleRestoreLead = async () => {
    try {
      setLoading(true);
      await api.post(`/deleted-leads/${restoreDialog.deletedLeadId}/restore`);
      setSuccess(`Lead "${restoreDialog.leadName}" restored successfully!`);
      handleCloseRestoreDialog();
      fetchDeletedLeads(pagination.page);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to restore lead');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPermanentDeleteDialog = (deletedLeadId, leadName) => {
    setPermanentDeleteDialog({
      open: true,
      deletedLeadId: deletedLeadId,
      leadName: leadName
    });
  };

  const handleClosePermanentDeleteDialog = () => {
    setPermanentDeleteDialog({
      open: false,
      deletedLeadId: null,
      leadName: ''
    });
  };

  const handlePermanentDelete = async () => {
    try {
      setLoading(true);
      await api.delete(`/deleted-leads/${permanentDeleteDialog.deletedLeadId}`);
      setSuccess(`Lead "${permanentDeleteDialog.leadName}" permanently deleted!`);
      handleClosePermanentDeleteDialog();
      fetchDeletedLeads(pagination.page);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to permanently delete lead');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (date) => {
    if (!date) return 'N/A';
    return dayjs(date).format('MMM D, YYYY HH:mm');
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box display="flex" alignItems="center" gap={2}>
            <IconButton onClick={() => navigate('/admin/leads')}>
              <ArrowBack />
            </IconButton>
            <Typography variant="h4">Deleted Leads</Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={() => fetchDeletedLeads(pagination.page)}
          >
            Refresh
          </Button>
        </Box>

        {/* Success/Error Messages */}
        {success && (
          <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Statistics Cards */}
        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom variant="body2">
                  Total Deleted Leads
                </Typography>
                <Typography variant="h4">{pagination.total}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                label="Search by name, email, phone"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  )
                }}
              />
            </Grid>

            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                select
                size="small"
                label="Lead Type"
                value={filters.leadType}
                onChange={(e) => handleFilterChange('leadType', e.target.value)}
                SelectProps={{ native: true }}
              >
                <option value="">All Types</option>
                <option value="ftd">FTD</option>
                <option value="filler">Filler</option>
                <option value="cold">Cold</option>
              </TextField>
            </Grid>

            <Grid item xs={12} md={2}>
              <DatePicker
                label="Start Date"
                value={filters.startDate}
                onChange={(date) => handleFilterChange('startDate', date)}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Grid>

            <Grid item xs={12} md={2}>
              <DatePicker
                label="End Date"
                value={filters.endDate}
                onChange={(date) => handleFilterChange('endDate', date)}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Grid>

            <Grid item xs={12} md={2}>
              <Box display="flex" gap={1}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<FilterList />}
                  onClick={handleSearch}
                >
                  Filter
                </Button>
                <Button onClick={handleClearFilters}>Clear</Button>
              </Box>
            </Grid>
          </Grid>
        </Paper>

        {/* Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Lead Type</TableCell>
                <TableCell>Deleted At</TableCell>
                <TableCell>Deleted By</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell>Orders</TableCell>
                <TableCell>Traces</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : deletedLeads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No deleted leads found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                deletedLeads.map((dl) => (
                  <TableRow key={dl._id} hover>
                    <TableCell>
                      {dl.leadData?.firstName} {dl.leadData?.lastName}
                      {dl.migrationRecovered && (
                        <Chip
                          label="Recovered"
                          size="small"
                          color="warning"
                          sx={{ ml: 1 }}
                        />
                      )}
                    </TableCell>
                    <TableCell>{dl.searchFields?.email || 'N/A'}</TableCell>
                    <TableCell>{dl.searchFields?.phone || 'N/A'}</TableCell>
                    <TableCell>
                      <Chip
                        label={dl.leadData?.leadType?.toUpperCase() || 'N/A'}
                        size="small"
                        color={
                          dl.leadData?.leadType === 'ftd'
                            ? 'success'
                            : dl.leadData?.leadType === 'filler'
                            ? 'warning'
                            : 'info'
                        }
                      />
                    </TableCell>
                    <TableCell>{formatDateTime(dl.deletedAt)}</TableCell>
                    <TableCell>
                      {dl.deletedBy?.fullName || 'Unknown'}
                    </TableCell>
                    <TableCell>
                      <Tooltip title={dl.deletionReason || 'No reason provided'}>
                        <Typography
                          variant="body2"
                          sx={{
                            maxWidth: 200,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {dl.deletionReason || 'N/A'}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={dl.orderReferences?.length || 0}
                        size="small"
                        color="info"
                      />
                    </TableCell>
                    <TableCell>
                      <Box display="flex" gap={0.5} flexWrap="wrap">
                        {dl.traces?.depositCalls?.length > 0 && (
                          <Chip label={`Calls: ${dl.traces.depositCalls.length}`} size="small" />
                        )}
                        {dl.traces?.fingerprints?.length > 0 && (
                          <Chip label="Prints" size="small" />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Box display="flex" gap={1} justifyContent="center">
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            color="info"
                            onClick={() => handleViewDetails(dl)}
                          >
                            <Visibility />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Restore Lead">
                          <IconButton
                            size="small"
                            color="success"
                            onClick={() =>
                              handleOpenRestoreDialog(
                                dl._id,
                                `${dl.leadData?.firstName} ${dl.leadData?.lastName}`
                              )
                            }
                          >
                            <Restore />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Permanently Delete">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() =>
                              handleOpenPermanentDeleteDialog(
                                dl._id,
                                `${dl.leadData?.firstName} ${dl.leadData?.lastName}`
                              )
                            }
                          >
                            <DeleteForever />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <TablePagination
            component="div"
            count={pagination.total}
            page={pagination.page - 1}
            onPageChange={handlePageChange}
            rowsPerPage={pagination.limit}
            rowsPerPageOptions={[pagination.limit]}
          />
        </TableContainer>

        {/* Deleted Lead Details Modal */}
        <DeletedLeadDetailsModal
          open={detailsModal.open}
          onClose={handleCloseDetails}
          deletedLead={detailsModal.deletedLead}
          onRestore={(id, name) => {
            handleCloseDetails();
            handleOpenRestoreDialog(id, name);
          }}
        />

        {/* Restore Confirmation Dialog */}
        <Dialog open={restoreDialog.open} onClose={handleCloseRestoreDialog}>
          <DialogTitle>Restore Lead</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to restore lead "{restoreDialog.leadName}"?
              This will add it back to the active leads database.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseRestoreDialog}>Cancel</Button>
            <Button
              onClick={handleRestoreLead}
              variant="contained"
              color="success"
              disabled={loading}
            >
              Restore
            </Button>
          </DialogActions>
        </Dialog>

        {/* Permanent Delete Confirmation Dialog */}
        <Dialog
          open={permanentDeleteDialog.open}
          onClose={handleClosePermanentDeleteDialog}
        >
          <DialogTitle sx={{ color: 'error.main' }}>
            Permanently Delete Lead
          </DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to <strong>permanently delete</strong> lead "
              {permanentDeleteDialog.leadName}"? This action cannot be undone and
              all backup data will be lost.
            </DialogContentText>
            <Alert severity="error" sx={{ mt: 2 }}>
              This is a destructive action that cannot be reversed!
            </Alert>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClosePermanentDeleteDialog}>Cancel</Button>
            <Button
              onClick={handlePermanentDelete}
              variant="contained"
              color="error"
              disabled={loading}
            >
              Permanently Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default DeletedLeadsPage;
