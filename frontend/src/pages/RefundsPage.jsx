import React, { useState, useEffect, useCallback } from 'react';
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
  TablePagination,
  Paper,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Stack,
  Checkbox,
  FormControlLabel
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  FilterList as FilterIcon,
  Upload as UploadIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowRight as KeyboardArrowRightIcon,
  Warning as WarningIcon,
  CloudUpload as CloudUploadIcon
} from '@mui/icons-material';
import { refundsService, REFUND_STATUSES, getStatusColor, getStatusLabel } from '../services/refunds';
import { useSelector } from 'react-redux';

const RefundsPage = () => {
  const { user } = useSelector((state) => state.auth);
  const [groups, setGroups] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [totalRecords, setTotalRecords] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [updating, setUpdating] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  // Mark as Fraud states
  const [fraudDialogOpen, setFraudDialogOpen] = useState(false);
  const [selectedGroupForFraud, setSelectedGroupForFraud] = useState(null);
  const [fraudReason, setFraudReason] = useState('');
  const [markingFraud, setMarkingFraud] = useState(false);

  // Upload Documents states
  const [uploadDocsDialogOpen, setUploadDocsDialogOpen] = useState(false);
  const [selectedGroupForDocs, setSelectedGroupForDocs] = useState(null);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [documentData, setDocumentData] = useState({
    gender: '',
    dateOfBirth: '',
    address: '',
    authenticator: '',
    backupCodes: '',
    idFront: '',
    idBack: '',
    selfieFront: '',
    selfieBack: ''
  });

  // CSV Upload states
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  // Manual Refund states
  const [manualRefundDialogOpen, setManualRefundDialogOpen] = useState(false);
  const [creatingRefund, setCreatingRefund] = useState(false);
  const [refundsManagers, setRefundsManagers] = useState([]);
  const [managersLoading, setManagersLoading] = useState(false);
  const [manualRefundData, setManualRefundData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    geo: '',
    date: '',
    lastFourDigitsCard: '',
    bank: '',
    comment: '',
    psp1: '',
    broker1: '',
    psp2: '',
    broker2: '',
    refundsManagerId: ''
  });

  // Check if user has refunds access
  const hasRefundsAccess =
    user?.role === 'refunds_manager' ||
    user?.role === 'admin' ||
    (user?.role === 'affiliate_manager' && user?.permissions?.canManageRefunds);

  useEffect(() => {
    if (hasRefundsAccess) {
      fetchAssignments();
      fetchStats();
      fetchRefundsManagers();
    }
  }, [page, rowsPerPage, statusFilter, startDate, endDate, searchTerm, hasRefundsAccess]);

  const fetchRefundsManagers = async () => {
    try {
      setManagersLoading(true);
      const response = await refundsService.getRefundsManagers();
      const managers = response.data || [];
      setRefundsManagers(managers);
      // Auto-select the first refunds manager if there's only one
      if (managers.length === 1) {
        setManualRefundData(prev => ({ ...prev, refundsManagerId: managers[0]._id }));
      }
    } catch (err) {
      console.error('Fetch refunds managers error:', err);
    } finally {
      setManagersLoading(false);
    }
  };

  // Reset pagination when search term changes
  useEffect(() => {
    if (page !== 0) {
      setPage(0);
    }
  }, [searchTerm, statusFilter, startDate, endDate]);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const params = {
        status: statusFilter,
        page: page + 1,
        limit: rowsPerPage
      };

      // Add date filters if they are set
      if (startDate) {
        params.startDate = startDate;
      }
      if (endDate) {
        params.endDate = endDate;
      }

      // Add search parameter if set
      if (searchTerm && searchTerm.trim()) {
        params.search = searchTerm.trim();
      }

      const response = await refundsService.getRefundAssignments(params);

      setGroups(response.data.groups || []);
      setTotalRecords(response.data.pagination.totalRecords);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch assignments');
      console.error('Fetch assignments error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await refundsService.getRefundStats();
      setStats(response.data);
    } catch (err) {
      console.error('Fetch stats error:', err);
    }
  };

  const handleStatusUpdate = async () => {
    if (!selectedAssignment || !newStatus) return;

    try {
      setUpdating(true);

      // Get the email of the assignment being updated to keep its group expanded
      const assignmentEmail = selectedAssignment.source === 'csv'
        ? selectedAssignment.email?.toLowerCase()
        : (selectedAssignment.leadId?.newEmail || selectedAssignment.leadId?.oldEmail)?.toLowerCase();

      await refundsService.updateRefundStatus(selectedAssignment._id, {
        status: newStatus,
        notes: statusNotes
      });

      setEditDialogOpen(false);
      setSelectedAssignment(null);
      setNewStatus('');
      setStatusNotes('');

      // Refresh data
      await fetchAssignments();
      fetchStats();

      // Keep the group expanded after refresh (it will now be at the top)
      if (assignmentEmail) {
        setExpandedGroups(prev => {
          const newSet = new Set(prev);
          newSet.add(assignmentEmail);
          return newSet;
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const handleEditClick = (assignment) => {
    setSelectedAssignment(assignment);
    setNewStatus(assignment.status);
    setStatusNotes(assignment.notes || '');
    setEditDialogOpen(true);
  };

  const handleViewClick = (assignment) => {
    setSelectedAssignment(assignment);
    setViewDialogOpen(true);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // CSV Upload handlers
  const handleFileUpload = async () => {
    if (!selectedFile) return;

    try {
      setUploading(true);
      setError('');
      setUploadSuccess('');

      const response = await refundsService.importCSVRefunds(selectedFile);

      setUploadSuccess(response.data.message);
      setSelectedFile(null);
      setUploadDialogOpen(false);
      fetchAssignments();
      fetchStats();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload CSV file');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        setError('Please select a CSV file');
        return;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setError('File size must be less than 10MB');
        return;
      }
      setSelectedFile(file);
      setError('');
    }
  };

  // Manual refund handlers - optimized to prevent lag
  const handleManualRefundInputChange = useCallback((field, value) => {
    setManualRefundData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const handleCreateManualRefund = async () => {
    try {
      setCreatingRefund(true);
      setError('');

      // Prepare data, removing empty optional fields
      const refundData = {
        firstName: manualRefundData.firstName,
        lastName: manualRefundData.lastName,
        email: manualRefundData.email,
        refundsManagerId: manualRefundData.refundsManagerId
      };

      // Add optional fields only if they have values
      if (manualRefundData.geo) refundData.geo = manualRefundData.geo;
      if (manualRefundData.date) refundData.date = manualRefundData.date;
      if (manualRefundData.lastFourDigitsCard) refundData.lastFourDigitsCard = manualRefundData.lastFourDigitsCard;
      if (manualRefundData.bank) refundData.bank = manualRefundData.bank;
      if (manualRefundData.comment) refundData.comment = manualRefundData.comment;
      if (manualRefundData.psp1) refundData.psp1 = manualRefundData.psp1;
      if (manualRefundData.broker1) refundData.broker1 = manualRefundData.broker1;
      if (manualRefundData.psp2) refundData.psp2 = manualRefundData.psp2;
      if (manualRefundData.broker2) refundData.broker2 = manualRefundData.broker2;

      await refundsService.createManualRefund(refundData);

      // Reset form and close dialog
      resetManualRefundForm();
      setManualRefundDialogOpen(false);

      // Refresh data
      fetchAssignments();
      fetchStats();

      setUploadSuccess('Manual refund created successfully');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create manual refund');
    } finally {
      setCreatingRefund(false);
    }
  };

  const resetManualRefundForm = () => {
    setManualRefundData({
      firstName: '',
      lastName: '',
      email: '',
      geo: '',
      date: '',
      lastFourDigitsCard: '',
      bank: '',
      comment: '',
      psp1: '',
      broker1: '',
      psp2: '',
      broker2: '',
      refundsManagerId: refundsManagers.length === 1 ? refundsManagers[0]._id : ''
    });
    setError('');
  };

  const handleDeleteAssignment = async (assignmentId, assignmentEmail) => {
    if (!window.confirm('Are you sure you want to delete this assignment?')) return;

    try {
      await refundsService.deleteRefundAssignment(assignmentId);
      await fetchAssignments();
      fetchStats();

      // Keep the group expanded after refresh if it still exists
      if (assignmentEmail) {
        setExpandedGroups(prev => {
          const newSet = new Set(prev);
          newSet.add(assignmentEmail.toLowerCase());
          return newSet;
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete assignment');
    }
  };

  // Toggle group expansion
  const toggleGroupExpansion = (groupKey) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupKey)) {
        newSet.delete(groupKey);
      } else {
        newSet.add(groupKey);
      }
      return newSet;
    });
  };

  // Toggle PSP Email status
  const handleTogglePspEmail = async (assignmentId, assignmentEmail) => {
    try {
      // Optimistic update - update UI immediately
      setGroups(prevGroups =>
        prevGroups.map(group => ({
          ...group,
          assignments: group.assignments.map(assignment =>
            assignment._id === assignmentId
              ? {
                  ...assignment,
                  pspEmailSent: !assignment.pspEmailSent,
                  pspEmailSentAt: !assignment.pspEmailSent ? new Date().toISOString() : undefined
                }
              : assignment
          )
        }))
      );

      // Send request to backend
      await refundsService.togglePspEmail(assignmentId);
    } catch (err) {
      // If error, revert the change by refetching
      setError(err.response?.data?.message || 'Failed to update PSP email status');
      await fetchAssignments();

      // Keep the group expanded after refresh
      if (assignmentEmail) {
        setExpandedGroups(prev => {
          const newSet = new Set(prev);
          newSet.add(assignmentEmail.toLowerCase());
          return newSet;
        });
      }
    }
  };

  // Handle mark group as fraud
  const handleMarkGroupAsFraud = (group) => {
    setSelectedGroupForFraud(group);
    setFraudReason('');
    setFraudDialogOpen(true);
  };

  const handleConfirmMarkAsFraud = async () => {
    if (!selectedGroupForFraud || !fraudReason.trim()) return;

    try {
      setMarkingFraud(true);
      setError('');

      await refundsService.markGroupAsFraud(selectedGroupForFraud.email, fraudReason);

      setFraudDialogOpen(false);
      setSelectedGroupForFraud(null);
      setFraudReason('');

      // Refresh data
      await fetchAssignments();
      fetchStats();

      setUploadSuccess(`Successfully marked group as fraud`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark group as fraud');
    } finally {
      setMarkingFraud(false);
    }
  };

  // Handle upload documents for group
  const handleUploadDocuments = (group) => {
    setSelectedGroupForDocs(group);
    setDocumentData({
      gender: '',
      dateOfBirth: '',
      address: '',
      authenticator: '',
      backupCodes: '',
      idFront: '',
      idBack: '',
      selfieFront: '',
      selfieBack: ''
    });
    setUploadDocsDialogOpen(true);
  };

  const handleDocumentDataChange = (field, value) => {
    setDocumentData(prev => ({ ...prev, [field]: value }));
  };

  const handleConfirmUploadDocuments = async () => {
    if (!selectedGroupForDocs) return;

    try {
      setUploadingDocs(true);
      setError('');

      await refundsService.uploadGroupDocuments(
        selectedGroupForDocs.email,
        documentData
      );

      setUploadDocsDialogOpen(false);
      setSelectedGroupForDocs(null);
      setDocumentData({
        gender: '',
        dateOfBirth: '',
        address: '',
        authenticator: '',
        backupCodes: '',
        idFront: '',
        idBack: '',
        selfieFront: '',
        selfieBack: ''
      });

      // Refresh data
      await fetchAssignments();

      setUploadSuccess(`Successfully uploaded documents for group`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload documents');
    } finally {
      setUploadingDocs(false);
    }
  };

  if (!hasRefundsAccess) {
    return (
      <Box p={3}>
        <Alert severity="error">
          Access denied. You don't have permission to access refunds management.
        </Alert>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        Refunds Management
      </Typography>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {REFUND_STATUSES.map((status) => (
          <Grid item xs={12} sm={6} md={3} key={status.value}>
            <Card>
              <CardContent>
                <Typography variant="h6" component="div">
                  {stats.statusCounts?.[status.value] || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {status.label}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" component="div">
                {stats.totalAssignments || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Assignments
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters and Actions */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Status Filter</InputLabel>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  label="Status Filter"
                >
                  <MenuItem value="all">All Statuses</MenuItem>
                  {REFUND_STATUSES.map((status) => (
                    <MenuItem key={status.value} value={status.value}>
                      {status.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search by name, email, phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="From Date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{
                  '& .MuiInputLabel-root': {
                    color: startDate ? 'primary.main' : 'text.secondary'
                  }
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="To Date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{
                  '& .MuiInputLabel-root': {
                    color: endDate ? 'primary.main' : 'text.secondary'
                  }
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={1}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={fetchAssignments}
                disabled={loading}
              >
                Refresh
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={1}>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                  setStatusFilter('all');
                  setSearchTerm('');
                }}
                disabled={loading}
              >
                Clear Filters
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<UploadIcon />}
                onClick={() => setUploadDialogOpen(true)}
                color="primary"
              >
                Import CSV
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => setManualRefundDialogOpen(true)}
                color="primary"
              >
                Add Manual Refund
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {uploadSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {uploadSuccess}
        </Alert>
      )}

      {/* Assignments Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Customer Details</TableCell>
                <TableCell>Contact Info</TableCell>
                <TableCell>Source Info</TableCell>
                <TableCell>Current Status</TableCell>
                <TableCell>PSP Email</TableCell>
                <TableCell>Refund Date</TableCell>
                <TableCell>Assigned Date</TableCell>
                <TableCell>Last Updated</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : groups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    No assignments found
                  </TableCell>
                </TableRow>
              ) : (
                groups.map((group) => {
                  const isExpanded = expandedGroups.has(group.groupKey);

                  return (
                    <React.Fragment key={group.groupKey}>
                      {/* Group Header Row */}
                      <TableRow
                        sx={{
                          backgroundColor: 'action.hover',
                          cursor: 'pointer',
                          '&:hover': { backgroundColor: 'action.selected' }
                        }}
                        onClick={() => toggleGroupExpansion(group.groupKey)}
                      >
                        <TableCell>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <IconButton size="small">
                              {isExpanded ? <KeyboardArrowDownIcon /> : <KeyboardArrowRightIcon />}
                            </IconButton>
                            <Box>
                              <Typography variant="subtitle2" fontWeight="bold">
                                {group.leadName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {group.refundCount} refund{group.refundCount > 1 ? 's' : ''}
                              </Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {group.email}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            Multiple sources
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5} flexWrap="wrap">
                            {group.statuses.map((status, idx) => (
                              <Chip
                                key={idx}
                                label={getStatusLabel(status)}
                                color={getStatusColor(status)}
                                size="small"
                                sx={{ mb: 0.5 }}
                              />
                            ))}
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {group.assignments.filter(a => a.pspEmailSent === true).length} / {group.refundCount}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            Various dates
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {new Date(group.latestAssignedAt).toLocaleDateString()}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Latest
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary">
                            Expand to view
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1}>
                            <Button
                              size="small"
                              variant="outlined"
                              color="primary"
                              startIcon={<CloudUploadIcon />}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUploadDocuments(group);
                              }}
                            >
                              Upload Docs
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              startIcon={<WarningIcon />}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkGroupAsFraud(group);
                              }}
                            >
                              Mark as Fraud
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>

                      {/* Individual Assignment Rows (when expanded) */}
                      {isExpanded && group.assignments.map((assignment) => (
                        <TableRow
                          key={assignment._id}
                          sx={{ 
                            backgroundColor: 'rgba(76, 175, 80, 0.08)',
                            '&:hover': {
                              backgroundColor: 'rgba(76, 175, 80, 0.15)'
                            }
                          }}
                        >
                          <TableCell sx={{ pl: 8 }}>
                            <Typography variant="body2">
                              {assignment.source === 'csv'
                                ? `${assignment.firstName} ${assignment.lastName}`
                                : `${assignment.leadId?.firstName} ${assignment.leadId?.lastName}`
                              }
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {assignment.source === 'csv'
                                ? `${assignment.geo || 'N/A'} • CSV Import`
                                : `${assignment.leadId?.country} • ${assignment.leadId?.leadType?.toUpperCase()}`
                              }
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {assignment.source === 'csv'
                                ? assignment.email
                                : assignment.leadId?.newEmail || assignment.leadId?.oldEmail
                              }
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {assignment.source === 'csv'
                                ? assignment.bank || 'N/A'
                                : assignment.leadId?.newPhone || assignment.leadId?.oldPhone
                              }
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {assignment.source === 'csv' ? (
                              <>
                                <Typography variant="body2">
                                  CSV Upload
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  by {assignment.assignedBy?.fullName}
                                </Typography>
                              </>
                            ) : (
                              <>
                                <Typography variant="body2">
                                  {assignment.orderId?.selectedCampaign?.name || 'No Campaign'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {[
                                    assignment.orderId?.selectedClientNetwork?.name,
                                    assignment.orderId?.selectedOurNetwork?.name,
                                    assignment.orderId?.selectedClientBroker?.name
                                  ].filter(Boolean).join(' • ') || 'No Networks'} • by {assignment.orderId?.requester?.fullName}
                                </Typography>
                              </>
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={getStatusLabel(assignment.status)}
                              color={getStatusColor(assignment.status)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={assignment.pspEmailSent || false}
                                  onChange={() => handleTogglePspEmail(
                                    assignment._id,
                                    assignment.source === 'csv'
                                      ? assignment.email
                                      : (assignment.leadId?.newEmail || assignment.leadId?.oldEmail)
                                  )}
                                  size="small"
                                  color="primary"
                                />
                              }
                              label={
                                <Typography variant="caption">
                                  {assignment.pspEmailSent ? 'Included' : 'Not included'}
                                </Typography>
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {assignment.refundDate
                                ? new Date(assignment.refundDate).toLocaleDateString()
                                : assignment.source === 'csv' && assignment.date
                                  ? new Date(assignment.date).toLocaleDateString()
                                  : 'N/A'
                              }
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {assignment.refundDate
                                ? 'Completed'
                                : assignment.source === 'csv' && assignment.date
                                  ? 'From CSV'
                                  : 'Pending'
                              }
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {new Date(assignment.assignedAt || assignment.createdAt).toLocaleDateString()}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Assigned Date
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {new Date(assignment.updatedAt || assignment.createdAt).toLocaleDateString()}
                              {' '}
                              <Typography component="span" variant="caption">
                                {new Date(assignment.updatedAt || assignment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </Typography>
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {(() => {
                                const lastStatusChange = assignment.statusHistory && assignment.statusHistory.length > 0
                                  ? new Date(assignment.statusHistory[assignment.statusHistory.length - 1].changedAt)
                                  : null;
                                const updatedAt = assignment.updatedAt ? new Date(assignment.updatedAt) : null;
                                
                                if (lastStatusChange && updatedAt && updatedAt > lastStatusChange) {
                                  // updatedAt is more recent, likely a note update
                                  if (updatedAt - lastStatusChange > 1000) {
                                    return 'Note Updated';
                                  }
                                }
                                
                                if (lastStatusChange) {
                                  return 'Status Changed';
                                }
                                
                                return 'Created';
                              })()}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1}>
                              <Tooltip title="View Details">
                                <IconButton
                                  size="small"
                                  onClick={() => handleViewClick(assignment)}
                                >
                                  <ViewIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Update Status">
                                <IconButton
                                  size="small"
                                  onClick={() => handleEditClick(assignment)}
                                >
                                  <EditIcon />
                                </IconButton>
                              </Tooltip>
                              {assignment.source === 'csv' && (
                                <Tooltip title="Delete Assignment">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDeleteAssignment(
                                      assignment._id,
                                      assignment.source === 'csv'
                                        ? assignment.email
                                        : (assignment.leadId?.newEmail || assignment.leadId?.oldEmail)
                                    )}
                                    color="error"
                                  >
                                    <DeleteIcon />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[10, 20, 50]}
          component="div"
          count={totalRecords}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Card>

      {/* Edit Status Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Update Refund Status</DialogTitle>
        <DialogContent>
          {selectedAssignment && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Customer: {selectedAssignment.source === 'csv'
                  ? `${selectedAssignment.firstName} ${selectedAssignment.lastName}`
                  : `${selectedAssignment.leadId?.firstName} ${selectedAssignment.leadId?.lastName}`
                }
              </Typography>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>New Status</InputLabel>
                <Select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  label="New Status"
                >
                  {REFUND_STATUSES.map((status) => (
                    <MenuItem key={status.value} value={status.value}>
                      {status.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Notes"
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                placeholder="Add notes about the status change..."
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleStatusUpdate}
            variant="contained"
            disabled={updating || !newStatus}
          >
            {updating ? <CircularProgress size={20} /> : 'Update Status'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Assignment Details</DialogTitle>
        <DialogContent>
          {selectedAssignment && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>Customer Information</Typography>
                <Typography><strong>Name:</strong> {selectedAssignment.source === 'csv'
                  ? `${selectedAssignment.firstName} ${selectedAssignment.lastName}`
                  : `${selectedAssignment.leadId?.firstName} ${selectedAssignment.leadId?.lastName}`
                }</Typography>
                <Typography><strong>Email:</strong> {selectedAssignment.source === 'csv'
                  ? selectedAssignment.email
                  : selectedAssignment.leadId?.newEmail || selectedAssignment.leadId?.oldEmail
                }</Typography>
                {selectedAssignment.source === 'csv' ? (
                  <>
                    <Typography><strong>Refund Date:</strong> {
                  selectedAssignment.refundDate
                    ? new Date(selectedAssignment.refundDate).toLocaleDateString()
                    : selectedAssignment.date
                      ? `${new Date(selectedAssignment.date).toLocaleDateString()} (CSV)`
                      : 'N/A'
                }</Typography>
                    <Typography><strong>Location:</strong> {selectedAssignment.geo || 'N/A'}</Typography>
                    <Typography><strong>Bank:</strong> {selectedAssignment.bank || 'N/A'}</Typography>
                    <Typography><strong>Last 4 Digits:</strong> {selectedAssignment.lastFourDigitsCard || 'N/A'}</Typography>
                    <Typography><strong>PSP:</strong> {selectedAssignment.psp1 || 'N/A'}</Typography>
                    <Typography><strong>Broker:</strong> {selectedAssignment.broker1 || 'N/A'}</Typography>
                  </>
                ) : (
                  <>
                    <Typography><strong>Refund Date:</strong> {
                      selectedAssignment.refundDate
                        ? new Date(selectedAssignment.refundDate).toLocaleDateString()
                        : 'N/A'
                    }</Typography>
                    <Typography><strong>Phone:</strong> {selectedAssignment.leadId?.newPhone || selectedAssignment.leadId?.oldPhone}</Typography>
                    <Typography><strong>Country:</strong> {selectedAssignment.leadId?.country}</Typography>
                    <Typography><strong>Type:</strong> {selectedAssignment.leadId?.leadType?.toUpperCase()}</Typography>
                  </>
                )}
                {/* Display common fields */}
                {selectedAssignment.gender && (
                  <Typography><strong>Gender:</strong> {selectedAssignment.gender}</Typography>
                )}
                {selectedAssignment.dateOfBirth && (
                  <Typography><strong>Date of Birth:</strong> {new Date(selectedAssignment.dateOfBirth).toLocaleDateString()}</Typography>
                )}
                {selectedAssignment.address && (
                  <Typography><strong>Address:</strong> {selectedAssignment.address}</Typography>
                )}
                {selectedAssignment.twoFA && (
                  <Typography><strong>Authenticator (2FA):</strong> {selectedAssignment.twoFA}</Typography>
                )}
                {selectedAssignment.recoveryCodes && (
                  <Typography><strong>Backup Codes:</strong> {selectedAssignment.recoveryCodes}</Typography>
                )}
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>Assignment Information</Typography>
                <Typography><strong>Source:</strong> {selectedAssignment.source === 'csv' ? 'CSV Import' : 'Order Assignment'}</Typography>
                <Typography><strong>Status:</strong> <Chip label={getStatusLabel(selectedAssignment.status)} color={getStatusColor(selectedAssignment.status)} size="small" /></Typography>
                <Typography>
                  <strong>PSP Email:</strong>{' '}
                  {selectedAssignment.pspEmailSent ? (
                    <Chip label="Included" color="success" size="small" />
                  ) : (
                    <Chip label="Not Included" color="default" size="small" />
                  )}
                  {selectedAssignment.pspEmailSent && selectedAssignment.pspEmailSentAt && (
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 1 }}>
                      on {new Date(selectedAssignment.pspEmailSentAt).toLocaleString()}
                    </Typography>
                  )}
                </Typography>
                <Typography><strong>Assigned By:</strong> {selectedAssignment.assignedBy?.fullName}</Typography>
                <Typography><strong>Assigned Date:</strong> {new Date(selectedAssignment.assignedAt || selectedAssignment.createdAt).toLocaleString()}</Typography>
                <Typography>
                  <strong>Last Updated:</strong>{' '}
                  {new Date(selectedAssignment.updatedAt || selectedAssignment.createdAt).toLocaleString()}
                  {' '}
                  <Typography component="span" variant="caption" color="text.secondary">
                    ({(() => {
                      const lastStatusChange = selectedAssignment.statusHistory && selectedAssignment.statusHistory.length > 0
                        ? new Date(selectedAssignment.statusHistory[selectedAssignment.statusHistory.length - 1].changedAt)
                        : null;
                      const updatedAt = selectedAssignment.updatedAt ? new Date(selectedAssignment.updatedAt) : null;
                      
                      if (lastStatusChange && updatedAt && updatedAt > lastStatusChange) {
                        if (updatedAt - lastStatusChange > 1000) {
                          return 'Note Updated';
                        }
                      }
                      
                      if (lastStatusChange) {
                        return 'Status Changed';
                      }
                      
                      return 'Created';
                    })()})
                  </Typography>
                </Typography>
                {selectedAssignment.source !== 'csv' && (
                  <>
                    <Typography><strong>Campaign:</strong> {selectedAssignment.orderId?.selectedCampaign?.name || 'N/A'}</Typography>
                    {selectedAssignment.orderId?.selectedClientNetwork?.name && (
                      <Typography><strong>Client Network:</strong> {selectedAssignment.orderId.selectedClientNetwork.name}</Typography>
                    )}
                    {selectedAssignment.orderId?.selectedOurNetwork?.name && (
                      <Typography><strong>Our Network:</strong> {selectedAssignment.orderId.selectedOurNetwork.name}</Typography>
                    )}
                    {selectedAssignment.orderId?.selectedClientBroker?.name && (
                      <Typography><strong>Client Broker:</strong> {selectedAssignment.orderId.selectedClientBroker.name}</Typography>
                    )}
                    <Typography><strong>Order ID:</strong> {selectedAssignment.orderId?._id?.slice(-8)}</Typography>
                  </>
                )}
                {selectedAssignment.source === 'csv' && selectedAssignment.comment && (
                  <Box>
                    <Typography component="span"><strong>Comment:</strong></Typography>
                    <Typography component="span" sx={{ whiteSpace: 'pre-wrap', ml: 1 }}>{selectedAssignment.comment}</Typography>
                  </Box>
                )}
              </Grid>

              {selectedAssignment.notes && (
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>Notes</Typography>
                  <Typography sx={{ whiteSpace: 'pre-wrap' }}>{selectedAssignment.notes}</Typography>
                </Grid>
              )}
              {selectedAssignment.statusHistory && selectedAssignment.statusHistory.length > 0 && (
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>Status History</Typography>
                  {selectedAssignment.statusHistory.map((history, index) => (
                    <Box key={index} sx={{ mb: 1, p: 1, bgcolor: 'grey.100', borderRadius: 1 }}>
                      <Typography variant="body2">
                        <strong>{getStatusLabel(history.status)}</strong> - {new Date(history.changedAt).toLocaleString()}
                      </Typography>
                      {history.notes && (
                        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                          {history.notes}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Grid>
              )}

              {/* Documents Section - For both CSV and order-based refunds */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>Documents</Typography>
                {selectedAssignment.documents && selectedAssignment.documents.length > 0 ? (
                  <Stack spacing={1}>
                    {selectedAssignment.documents.map((doc, index) => (
                      <Box key={index} sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, border: '1px solid', borderColor: 'grey.300' }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Box>
                            <Typography variant="body2" fontWeight="medium">
                              {doc.type ? doc.type.replace(/([A-Z])/g, ' $1').trim() : 'Document'}
                            </Typography>
                            {doc.filename && (
                              <Typography variant="caption" color="text.secondary" display="block">
                                File: {doc.filename}
                              </Typography>
                            )}
                            {doc.url && (
                              <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                                {doc.url}
                              </Typography>
                            )}
                            {doc.uploadedAt && (
                              <Typography variant="caption" color="text.secondary" display="block">
                                Uploaded: {new Date(doc.uploadedAt).toLocaleString()}
                              </Typography>
                            )}
                            {doc.status && (
                              <Chip
                                label={doc.status}
                                size="small"
                                color={doc.status === 'approved' ? 'success' : doc.status === 'rejected' ? 'error' : 'default'}
                                sx={{ mt: 0.5 }}
                              />
                            )}
                          </Box>
                          {doc.url && (
                            <Button
                              size="small"
                              variant="outlined"
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              View
                            </Button>
                          )}
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Alert severity="info" sx={{ mt: 1 }}>
                    No documents uploaded yet.
                  </Alert>
                )}
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* CSV Upload Dialog */}
      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Import Chargeback CSV</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              Upload a CSV file containing chargeback/refund data. Required columns: "First Name", "Last name", "E-mail".
              Optional columns: "GEO", "Date", "Last 4 Digits Card", "Bank", "Comment", "PSP", "Broker".
            </Alert>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              id="csv-file-input"
            />
            <label htmlFor="csv-file-input">
              <Button
                variant="outlined"
                component="span"
                startIcon={<UploadIcon />}
                fullWidth
                sx={{ mb: 2 }}
              >
                Select CSV File
              </Button>
            </label>
            {selectedFile && (
              <Alert severity="success" sx={{ mb: 2 }}>
                Selected file: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setUploadDialogOpen(false);
            setSelectedFile(null);
            setError('');
          }}>
            Cancel
          </Button>
          <Button
            onClick={handleFileUpload}
            variant="contained"
            disabled={uploading || !selectedFile}
          >
            {uploading ? <CircularProgress size={20} /> : 'Upload CSV'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Manual Refund Dialog */}
      <Dialog open={manualRefundDialogOpen} onClose={() => {
        setManualRefundDialogOpen(false);
        resetManualRefundForm();
      }} maxWidth="md" fullWidth>
        <DialogTitle>Create Manual Refund</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Alert severity="info" sx={{ mb: 3 }}>
              Create a manual refund assignment. Required fields are marked with *.
            </Alert>
            <Grid container spacing={2}>
              {/* Required Fields */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="First Name *"
                  value={manualRefundData.firstName}
                  onChange={(e) => handleManualRefundInputChange('firstName', e.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Last Name *"
                  value={manualRefundData.lastName}
                  onChange={(e) => handleManualRefundInputChange('lastName', e.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="email"
                  label="Email *"
                  value={manualRefundData.email}
                  onChange={(e) => handleManualRefundInputChange('email', e.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="date"
                  label="Refund Date"
                  value={manualRefundData.date}
                  onChange={(e) => handleManualRefundInputChange('date', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Assign To (Refunds Manager) *</InputLabel>
                  <Select
                    value={manualRefundData.refundsManagerId}
                    label="Assign To (Refunds Manager) *"
                    onChange={(e) => handleManualRefundInputChange('refundsManagerId', e.target.value)}
                    disabled={managersLoading || refundsManagers.length === 0}
                    required
                  >
                    {refundsManagers.map((manager) => (
                      <MenuItem key={manager._id} value={manager._id}>
                        {manager.fullName} ({manager.email})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {refundsManagers.length === 0 && !managersLoading && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                    No active refunds managers found. Please contact an administrator.
                  </Typography>
                )}
              </Grid>

              {/* Optional Fields */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="GEO/Location"
                  value={manualRefundData.geo}
                  onChange={(e) => handleManualRefundInputChange('geo', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Bank"
                  value={manualRefundData.bank}
                  onChange={(e) => handleManualRefundInputChange('bank', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Last 4 Digits Card"
                  value={manualRefundData.lastFourDigitsCard}
                  onChange={(e) => handleManualRefundInputChange('lastFourDigitsCard', e.target.value)}
                  inputProps={{ maxLength: 4, pattern: '[0-9]{0,4}' }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="PSP 1"
                  value={manualRefundData.psp1}
                  onChange={(e) => handleManualRefundInputChange('psp1', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Broker 1"
                  value={manualRefundData.broker1}
                  onChange={(e) => handleManualRefundInputChange('broker1', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="PSP 2"
                  value={manualRefundData.psp2}
                  onChange={(e) => handleManualRefundInputChange('psp2', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Broker 2"
                  value={manualRefundData.broker2}
                  onChange={(e) => handleManualRefundInputChange('broker2', e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Comment"
                  value={manualRefundData.comment}
                  onChange={(e) => handleManualRefundInputChange('comment', e.target.value)}
                  placeholder="Additional comments or notes..."
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setManualRefundDialogOpen(false);
            resetManualRefundForm();
          }}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateManualRefund}
            variant="contained"
            disabled={
              creatingRefund ||
              !manualRefundData.firstName ||
              !manualRefundData.lastName ||
              !manualRefundData.email ||
              (!manualRefundData.refundsManagerId && refundsManagers.length > 0)
            }
          >
            {creatingRefund ? <CircularProgress size={20} /> : 'Create Refund'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Mark Group as Fraud Dialog */}
      <Dialog open={fraudDialogOpen} onClose={() => setFraudDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Mark Group as Fraud</DialogTitle>
        <DialogContent>
          {selectedGroupForFraud && (
            <Box sx={{ mt: 2 }}>
              <Alert severity="warning" sx={{ mb: 2 }}>
                This will mark all {selectedGroupForFraud.refundCount} assignment(s) for <strong>{selectedGroupForFraud.email}</strong> as fraud.
              </Alert>
              <Typography variant="subtitle2" gutterBottom>
                Group Details:
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                <strong>Name:</strong> {selectedGroupForFraud.leadName}<br />
                <strong>Email:</strong> {selectedGroupForFraud.email}<br />
                <strong>Number of Refunds:</strong> {selectedGroupForFraud.refundCount}
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Fraud Reason *"
                value={fraudReason}
                onChange={(e) => setFraudReason(e.target.value)}
                placeholder="Please provide a detailed reason for marking this group as fraud..."
                required
                helperText="This reason will be recorded in the notes for all assignments in this group"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setFraudDialogOpen(false);
            setSelectedGroupForFraud(null);
            setFraudReason('');
          }}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmMarkAsFraud}
            variant="contained"
            color="error"
            disabled={markingFraud || !fraudReason.trim()}
            startIcon={markingFraud ? <CircularProgress size={20} /> : <WarningIcon />}
          >
            {markingFraud ? 'Marking as Fraud...' : 'Confirm Mark as Fraud'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Upload Documents Dialog */}
      <Dialog open={uploadDocsDialogOpen} onClose={() => setUploadDocsDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Upload Documents for Group</DialogTitle>
        <DialogContent>
          {selectedGroupForDocs && (
            <Box sx={{ mt: 2 }}>
              <Alert severity="info" sx={{ mb: 3 }}>
                Upload documents for all {selectedGroupForDocs.refundCount} assignment(s) for <strong>{selectedGroupForDocs.email}</strong>
              </Alert>
              <Typography variant="subtitle2" gutterBottom>
                Group: {selectedGroupForDocs.leadName}
              </Typography>
              <Typography variant="body2" sx={{ mb: 3 }} color="text.secondary">
                Email: {selectedGroupForDocs.email}
              </Typography>

              <Grid container spacing={3}>
                {/* Gender */}
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Gender</InputLabel>
                    <Select
                      value={documentData.gender}
                      label="Gender"
                      onChange={(e) => handleDocumentDataChange('gender', e.target.value)}
                    >
                      <MenuItem value="">Select Gender</MenuItem>
                      <MenuItem value="male">Male</MenuItem>
                      <MenuItem value="female">Female</MenuItem>
                      <MenuItem value="other">Other</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                {/* Date of Birth */}
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Date of Birth"
                    value={documentData.dateOfBirth}
                    onChange={(e) => handleDocumentDataChange('dateOfBirth', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                {/* Address */}
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Address"
                    value={documentData.address}
                    onChange={(e) => handleDocumentDataChange('address', e.target.value)}
                    placeholder="Enter full address..."
                  />
                </Grid>

                {/* ID Front */}
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="ID Front URL"
                    value={documentData.idFront}
                    onChange={(e) => handleDocumentDataChange('idFront', e.target.value)}
                    placeholder="https://example.com/id-front.jpg"
                  />
                </Grid>

                {/* ID Back */}
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="ID Back URL"
                    value={documentData.idBack}
                    onChange={(e) => handleDocumentDataChange('idBack', e.target.value)}
                    placeholder="https://example.com/id-back.jpg"
                  />
                </Grid>

                {/* Selfie Front */}
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Selfie Front URL"
                    value={documentData.selfieFront}
                    onChange={(e) => handleDocumentDataChange('selfieFront', e.target.value)}
                    placeholder="https://example.com/selfie-front.jpg"
                  />
                </Grid>

                {/* Selfie Back */}
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Selfie Back URL"
                    value={documentData.selfieBack}
                    onChange={(e) => handleDocumentDataChange('selfieBack', e.target.value)}
                    placeholder="https://example.com/selfie-back.jpg"
                  />
                </Grid>

                {/* Authenticator */}
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Authenticator (2FA)"
                    value={documentData.authenticator}
                    onChange={(e) => handleDocumentDataChange('authenticator', e.target.value)}
                    placeholder="Enter authenticator code..."
                  />
                </Grid>

                {/* Backup Codes */}
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Backup Codes"
                    value={documentData.backupCodes}
                    onChange={(e) => handleDocumentDataChange('backupCodes', e.target.value)}
                    placeholder="Enter backup codes..."
                  />
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setUploadDocsDialogOpen(false);
            setSelectedGroupForDocs(null);
            setDocumentData({
              gender: '',
              dateOfBirth: '',
              address: '',
              authenticator: '',
              backupCodes: '',
              idFront: '',
              idBack: '',
              selfieFront: '',
              selfieBack: ''
            });
          }}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmUploadDocuments}
            variant="contained"
            color="primary"
            disabled={uploadingDocs}
            startIcon={uploadingDocs ? <CircularProgress size={20} /> : <CloudUploadIcon />}
          >
            {uploadingDocs ? 'Uploading...' : 'Upload Documents'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RefundsPage;