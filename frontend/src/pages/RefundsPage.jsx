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
  Visibility as ViewIcon,
  Edit as EditIcon,
  FilterList as FilterIcon,
  Upload as UploadIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowRight as KeyboardArrowRightIcon,
  Warning as WarningIcon,
  CloudUpload as CloudUploadIcon,
  HourglassEmpty as PendingIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Image as ImageIcon,
  SupervisorAccount as SupervisorIcon
} from '@mui/icons-material';
import { refundsService, REFUND_STATUSES, getStatusColor, getStatusLabel } from '../services/refunds';
import { refundApprovalsService, getRefundApprovalImageUrl, getRefundApprovalImageThumbnailUrl } from '../services/refundApprovals';
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

  // Refund Approval states
  const [approvalConfirmOpen, setApprovalConfirmOpen] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [approvalsLoading, setApprovalsLoading] = useState(false);
  const [approvalDecisionDialog, setApprovalDecisionDialog] = useState(null);
  const [decisionNotes, setDecisionNotes] = useState('');
  const [decisionImages, setDecisionImages] = useState([]);
  const [uploadedImageIds, setUploadedImageIds] = useState([]);
  const [uploadingEvidenceImage, setUploadingEvidenceImage] = useState(false);
  const [processingDecision, setProcessingDecision] = useState(false);
  const [superiorManager, setSuperiorManager] = useState(null);
  const [superiorManagerDialogOpen, setSuperiorManagerDialogOpen] = useState(false);
  const [selectedSuperiorManagerId, setSelectedSuperiorManagerId] = useState('');
  const [settingSuperior, setSettingSuperior] = useState(false);
  const [approvalCounts, setApprovalCounts] = useState({});
  const [adminUsers, setAdminUsers] = useState([]);
  const [selectedAdminReviewerId, setSelectedAdminReviewerId] = useState('');

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

  const isAdmin = user?.role === 'admin';
  const isSuperiorManager = superiorManager && user?._id === superiorManager._id;

  useEffect(() => {
    if (hasRefundsAccess) {
      fetchAssignments();
      fetchStats();
      fetchRefundsManagers();
      fetchPendingApprovals();
      fetchApprovalCounts();
      fetchSuperiorManager();
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

  // Approval workflow handlers
  const fetchPendingApprovals = async () => {
    try {
      setApprovalsLoading(true);
      const response = await refundApprovalsService.getPendingApprovals();
      setPendingApprovals(response.data || []);
    } catch (err) {
      console.error('Fetch pending approvals error:', err);
    } finally {
      setApprovalsLoading(false);
    }
  };

  const fetchApprovalCounts = async () => {
    try {
      const response = await refundApprovalsService.getApprovalCounts();
      setApprovalCounts(response.data || {});
    } catch (err) {
      console.error('Fetch approval counts error:', err);
    }
  };

  const fetchSuperiorManager = async () => {
    try {
      const response = await refundApprovalsService.getSuperiorLeadManager();
      setSuperiorManager(response.data);
    } catch (err) {
      console.error('Fetch superior manager error:', err);
    }
  };

  const fetchAdminUsers = async () => {
    try {
      const response = await refundApprovalsService.getAdminUsers();
      setAdminUsers(response.data || []);
    } catch (err) {
      console.error('Fetch admin users error:', err);
    }
  };

  const handleStatusUpdateWithApproval = async () => {
    if (!selectedAssignment || !newStatus) return;

    // If non-admin user selects "refunded_checked", trigger approval workflow
    if (newStatus === 'refunded_checked' && !isAdmin) {
      setEditDialogOpen(false);
      setApprovalNotes(statusNotes);
      setApprovalConfirmOpen(true);
      return;
    }

    // For all other statuses (or admin for refunded_checked), proceed normally
    await handleStatusUpdate();
  };

  const handleSubmitApprovalRequest = async () => {
    if (!selectedAssignment) return;

    try {
      setSubmittingApproval(true);
      await refundApprovalsService.createApprovalRequest(
        selectedAssignment._id,
        approvalNotes
      );
      setApprovalConfirmOpen(false);
      setSelectedAssignment(null);
      setApprovalNotes('');
      setNewStatus('');
      setStatusNotes('');

      // Refresh
      await fetchAssignments();
      fetchStats();
      fetchPendingApprovals();
      fetchApprovalCounts();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit approval request');
    } finally {
      setSubmittingApproval(false);
    }
  };

  const handleOpenDecisionDialog = (approval) => {
    setApprovalDecisionDialog(approval);
    setDecisionNotes('');
    setDecisionImages([]);
    setUploadedImageIds([]);
    setSelectedAdminReviewerId('');
    // Fetch admin users if superior is opening a pending_superior approval
    if (approval.status === 'pending_superior') {
      fetchAdminUsers();
    }
  };

  const handleEvidenceImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setUploadingEvidenceImage(true);
      const response = await refundApprovalsService.uploadEvidenceImage(
        file,
        approvalDecisionDialog?._id
      );
      if (response.data) {
        setDecisionImages(prev => [...prev, response.data]);
        setUploadedImageIds(prev => [...prev, response.data._id]);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload evidence image');
    } finally {
      setUploadingEvidenceImage(false);
      event.target.value = '';
    }
  };

  const handleProcessDecision = async (decision) => {
    if (!approvalDecisionDialog) return;

    // If superior is approving, require admin selection
    if (approvalDecisionDialog.status === 'pending_superior' && decision === 'approve' && !selectedAdminReviewerId) {
      setError('Please select an admin to send the approval to');
      return;
    }

    try {
      setProcessingDecision(true);
      const adminId = (approvalDecisionDialog.status === 'pending_superior' && decision === 'approve')
        ? selectedAdminReviewerId
        : null;
      await refundApprovalsService.processDecision(
        approvalDecisionDialog._id,
        decision,
        decisionNotes,
        uploadedImageIds,
        adminId
      );
      setApprovalDecisionDialog(null);
      setDecisionNotes('');
      setDecisionImages([]);
      setUploadedImageIds([]);

      // Refresh everything
      await fetchAssignments();
      fetchStats();
      fetchPendingApprovals();
      fetchApprovalCounts();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process decision');
    } finally {
      setProcessingDecision(false);
    }
  };

  const handleSetSuperiorManager = async () => {
    if (!selectedSuperiorManagerId) return;

    try {
      setSettingSuperior(true);
      await refundApprovalsService.setSuperiorLeadManager(selectedSuperiorManagerId);
      setSuperiorManagerDialogOpen(false);
      setSelectedSuperiorManagerId('');
      fetchSuperiorManager();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to set superior lead manager');
    } finally {
      setSettingSuperior(false);
    }
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
    <Box sx={{ width: "100%", typography: "body1" }}>
      {/* Filters and Actions */}
      <Card sx={{ mb: 2, borderRadius: 3 }}>
        <CardContent sx={{ py: 1, px: 1.5, '&:last-child': { pb: 1 } }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel sx={{ fontSize: '0.75rem' }}>Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                label="Status"
                sx={{ borderRadius: 2, fontSize: '0.75rem', height: 30 }}
              >
                <MenuItem value="all" sx={{ fontSize: '0.8rem' }}>All Statuses</MenuItem>
                {REFUND_STATUSES.map((status) => (
                  <MenuItem key={status.value} value={status.value} sx={{ fontSize: '0.8rem' }}>
                    {status.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              size="small"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ minWidth: 160, '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: '0.75rem', height: 30 } }}
            />
            <TextField
              size="small"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ title: 'From date' }}
              sx={{
                width: 125,
                '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: '0.7rem', height: 30 },
              }}
            />
            <TextField
              size="small"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ title: 'To date' }}
              sx={{
                width: 125,
                '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: '0.7rem', height: 30 },
              }}
            />
            <Box sx={{ flexGrow: 1 }} />
            <Tooltip title="Import CSV">
              <IconButton
                size="small"
                onClick={() => setUploadDialogOpen(true)}
                color="primary"
                sx={{ border: '1px solid', borderColor: 'primary.main', borderRadius: 2, width: 30, height: 30 }}
              >
                <UploadIcon sx={{ fontSize: '1rem' }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Add Manual Refund">
              <IconButton
                size="small"
                onClick={() => setManualRefundDialogOpen(true)}
                color="primary"
                sx={{ border: '1px solid', borderColor: 'primary.main', borderRadius: 2, width: 30, height: 30 }}
              >
                <AddIcon sx={{ fontSize: '1rem' }} />
              </IconButton>
            </Tooltip>
            {isAdmin && (
              <Tooltip title={superiorManager ? 'Change Superior Manager' : 'Set Superior Manager'}>
                <IconButton
                  size="small"
                  onClick={() => setSuperiorManagerDialogOpen(true)}
                  color="secondary"
                  sx={{ border: '1px solid', borderColor: 'secondary.main', borderRadius: 2, width: 30, height: 30 }}
                >
                  <SupervisorIcon sx={{ fontSize: '1rem' }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
          {isAdmin && superiorManager && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              Superior Lead Manager: <strong>{superiorManager.fullName}</strong> ({superiorManager.email})
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Pending Approvals Section - visible to superior lead manager and admin */}
      {(isAdmin || isSuperiorManager) && pendingApprovals.length > 0 && (
        <Card sx={{ mb: 3, border: '2px solid', borderColor: 'warning.main' }}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <PendingIcon color="warning" />
              <Typography variant="h6">
                Pending Refund Approvals ({pendingApprovals.length})
              </Typography>
            </Stack>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Customer</TableCell>
                    <TableCell>Requested By</TableCell>
                    <TableCell>Previous Status</TableCell>
                    <TableCell>Approval Status</TableCell>
                    <TableCell>Requested At</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pendingApprovals.map((approval) => {
                    const assignment = approval.refundAssignmentId;
                    const customerName = assignment?.source === 'csv'
                      ? `${assignment?.firstName || ''} ${assignment?.lastName || ''}`
                      : `${assignment?.leadId?.firstName || ''} ${assignment?.leadId?.lastName || ''}`;

                    const canDecide =
                      (approval.status === 'pending_superior' && (isSuperiorManager || isAdmin)) ||
                      (approval.status === 'pending_admin' && isAdmin);

                    return (
                      <TableRow key={approval._id}>
                        <TableCell>{customerName}</TableCell>
                        <TableCell>{approval.requestedBy?.fullName}</TableCell>
                        <TableCell>
                          <Chip
                            label={getStatusLabel(approval.previousStatus)}
                            color={getStatusColor(approval.previousStatus)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={
                              approval.status === 'pending_superior'
                                ? 'Awaiting Superior Review'
                                : 'Awaiting Admin Confirmation'
                            }
                            color="warning"
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {new Date(approval.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {canDecide && (
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => handleOpenDecisionDialog(approval)}
                            >
                              Review
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2, cursor: 'pointer' }} onClick={() => setError('')}>
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
                            <Stack direction="column" spacing={0.5}>
                              <Chip
                                label={getStatusLabel(assignment.status)}
                                color={getStatusColor(assignment.status)}
                                size="small"
                              />
                              {assignment.pendingApproval && (
                                <Chip
                                  icon={<PendingIcon />}
                                  label={
                                    assignment.pendingApproval.status === 'pending_superior'
                                      ? 'Awaiting Superior Review'
                                      : assignment.pendingApproval.status === 'pending_admin'
                                      ? 'Awaiting Admin Review'
                                      : 'Pending Approval'
                                  }
                                  color="warning"
                                  size="small"
                                  variant="outlined"
                                />
                              )}
                            </Stack>
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
              {selectedAssignment?.pendingApproval && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  This refund has a pending approval (Status: {selectedAssignment.pendingApproval.status?.replace(/_/g, ' ')}). Cannot change status until resolved.
                </Alert>
              )}
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>New Status</InputLabel>
                <Select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  label="New Status"
                  disabled={!!selectedAssignment?.pendingApproval}
                >
                  {REFUND_STATUSES.filter(status => {
                    // Non-admin users can't directly set refund_complete
                    if (status.value === 'refund_complete' && !isAdmin) return false;
                    return true;
                  }).map((status) => (
                    <MenuItem key={status.value} value={status.value}>
                      {status.label}
                      {status.value === 'refunded_checked' && !isAdmin && ' (Requires Approval)'}
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
            onClick={handleStatusUpdateWithApproval}
            variant="contained"
            disabled={updating || !newStatus || !!selectedAssignment?.pendingApproval}
          >
            {updating ? <CircularProgress size={20} /> :
              (newStatus === 'refunded_checked' && !isAdmin) ? 'Request Approval' : 'Update Status'
            }
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
                <Typography component="div"><strong>Status:</strong> <Chip label={getStatusLabel(selectedAssignment.status)} color={getStatusColor(selectedAssignment.status)} size="small" /></Typography>
                <Typography component="div">
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

      {/* Approval Confirmation Dialog - shown when refunds manager selects "Refunded (Check)" */}
      <Dialog open={approvalConfirmOpen} onClose={() => setApprovalConfirmOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Request Refund Approval</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2, mt: 1 }}>
            Setting status to "Refunded (Check)" requires approval from the superior lead manager and admin confirmation.
          </Alert>
          {selectedAssignment && (
            <Typography variant="subtitle1" gutterBottom>
              Customer: {selectedAssignment.source === 'csv'
                ? `${selectedAssignment.firstName} ${selectedAssignment.lastName}`
                : `${selectedAssignment.leadId?.firstName} ${selectedAssignment.leadId?.lastName}`
              }
            </Typography>
          )}
          {superiorManager ? (
            <Typography variant="body2" sx={{ mb: 2 }}>
              Approval will be sent to: <strong>{superiorManager.fullName}</strong>
            </Typography>
          ) : (
            <Alert severity="error" sx={{ mb: 2 }}>
              No superior lead manager configured. Please contact admin.
            </Alert>
          )}
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Notes (optional)"
            value={approvalNotes}
            onChange={(e) => setApprovalNotes(e.target.value)}
            placeholder="Add notes for the approval request..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setApprovalConfirmOpen(false);
            setEditDialogOpen(true);
          }}>Back</Button>
          <Button
            onClick={handleSubmitApprovalRequest}
            variant="contained"
            color="primary"
            disabled={submittingApproval || !superiorManager}
          >
            {submittingApproval ? <CircularProgress size={20} /> : 'Submit for Approval'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Approval Decision Dialog - for superior lead manager and admin */}
      <Dialog
        open={!!approvalDecisionDialog}
        onClose={() => setApprovalDecisionDialog(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {approvalDecisionDialog?.status === 'pending_superior'
            ? 'Review Refund Approval (Superior Lead Manager)'
            : 'Review Refund Approval (Admin Confirmation)'}
        </DialogTitle>
        <DialogContent>
          {approvalDecisionDialog && (
            <Box sx={{ mt: 1 }}>
              {/* Refund details */}
              <Typography variant="h6" gutterBottom>Refund Details</Typography>
              {approvalDecisionDialog.refundAssignmentId && (
                <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body2">
                    <strong>Customer:</strong>{' '}
                    {approvalDecisionDialog.refundAssignmentId.source === 'csv'
                      ? `${approvalDecisionDialog.refundAssignmentId.firstName} ${approvalDecisionDialog.refundAssignmentId.lastName}`
                      : `${approvalDecisionDialog.refundAssignmentId.leadId?.firstName || ''} ${approvalDecisionDialog.refundAssignmentId.leadId?.lastName || ''}`
                    }
                  </Typography>
                  <Typography variant="body2">
                    <strong>Current Status:</strong>{' '}
                    {getStatusLabel(approvalDecisionDialog.refundAssignmentId.status)}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Previous Status:</strong>{' '}
                    {getStatusLabel(approvalDecisionDialog.previousStatus)}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Refunds Manager:</strong>{' '}
                    {approvalDecisionDialog.refundAssignmentId.refundsManager?.fullName || 'N/A'}
                  </Typography>
                </Box>
              )}

              {/* Request info */}
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Requested by:</strong> {approvalDecisionDialog.requestedBy?.fullName}
              </Typography>
              {approvalDecisionDialog.requestNotes && (
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Request notes:</strong> {approvalDecisionDialog.requestNotes}
                </Typography>
              )}
              <Typography variant="body2" sx={{ mb: 2 }}>
                <strong>Requested at:</strong>{' '}
                {new Date(approvalDecisionDialog.createdAt).toLocaleString()}
              </Typography>

              {/* Decision history */}
              {approvalDecisionDialog.decisions?.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="h6" gutterBottom>Decision History</Typography>
                  {approvalDecisionDialog.decisions.map((decision, idx) => (
                    <Box key={idx} sx={{
                      p: 1.5, mb: 1, borderRadius: 1,
                      bgcolor: decision.decision === 'approve' ? 'success.50' : 'error.50',
                      border: `1px solid ${decision.decision === 'approve' ? '#c8e6c9' : '#ffcdd2'}`
                    }}>
                      <Typography variant="body2">
                        <strong>{decision.decidedBy?.fullName}</strong> ({decision.role})
                        {' '}{decision.decision === 'approve' ? 'approved' : 'rejected'}
                        {' '}on {new Date(decision.decidedAt).toLocaleString()}
                      </Typography>
                      {decision.notes && (
                        <Typography variant="body2" sx={{ mt: 0.5, fontStyle: 'italic' }}>
                          Notes: {decision.notes}
                        </Typography>
                      )}
                      {decision.evidenceImages?.length > 0 && (
                        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                          {decision.evidenceImages.map((img) => (
                            <Box
                              key={img._id}
                              component="a"
                              href={getRefundApprovalImageUrl(img._id)}
                              target="_blank"
                              sx={{
                                display: 'inline-block',
                                width: 60, height: 60,
                                borderRadius: 1, overflow: 'hidden',
                                border: '1px solid #ddd'
                              }}
                            >
                              <img
                                src={getRefundApprovalImageThumbnailUrl(img._id)}
                                alt={img.originalName || 'Evidence'}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            </Box>
                          ))}
                        </Stack>
                      )}
                    </Box>
                  ))}
                </Box>
              )}

              {/* Admin selector - shown when superior is reviewing */}
              {approvalDecisionDialog?.status === 'pending_superior' && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="h6" gutterBottom>Select Admin for Final Review</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Choose which admin should perform the final confirmation review.
                  </Typography>
                  <FormControl fullWidth size="small">
                    <InputLabel>Admin Reviewer</InputLabel>
                    <Select
                      value={selectedAdminReviewerId}
                      onChange={(e) => setSelectedAdminReviewerId(e.target.value)}
                      label="Admin Reviewer"
                    >
                      {adminUsers.map((admin) => (
                        <MenuItem key={admin._id} value={admin._id}>
                          {admin.fullName} ({admin.email})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              )}

              {/* Decision form */}
              <Typography variant="h6" gutterBottom>Your Decision</Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Decision Notes"
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                placeholder="Add notes about your decision..."
                sx={{ mb: 2 }}
              />

              {/* Evidence image upload */}
              <Typography variant="subtitle2" gutterBottom>
                Upload Evidence Images (optional)
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={uploadingEvidenceImage ? <CircularProgress size={16} /> : <ImageIcon />}
                  disabled={uploadingEvidenceImage}
                  size="small"
                >
                  {uploadingEvidenceImage ? 'Uploading...' : 'Add Image'}
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={handleEvidenceImageUpload}
                  />
                </Button>
                {decisionImages.length > 0 && (
                  <Typography variant="body2" color="text.secondary">
                    {decisionImages.length} image(s) attached
                  </Typography>
                )}
              </Stack>
              {decisionImages.length > 0 && (
                <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
                  {decisionImages.map((img) => (
                    <Box
                      key={img._id}
                      sx={{
                        width: 80, height: 80,
                        borderRadius: 1, overflow: 'hidden',
                        border: '1px solid #ddd', position: 'relative'
                      }}
                    >
                      <img
                        src={getRefundApprovalImageThumbnailUrl(img._id)}
                        alt={img.originalName || 'Evidence'}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApprovalDecisionDialog(null)}>Cancel</Button>
          <Button
            onClick={() => handleProcessDecision('reject')}
            variant="outlined"
            color="error"
            disabled={processingDecision}
            startIcon={processingDecision ? <CircularProgress size={16} /> : <RejectIcon />}
          >
            Reject
          </Button>
          <Button
            onClick={() => handleProcessDecision('approve')}
            variant="contained"
            color="success"
            disabled={processingDecision || (approvalDecisionDialog?.status === 'pending_superior' && !selectedAdminReviewerId)}
            startIcon={processingDecision ? <CircularProgress size={16} /> : <ApproveIcon />}
          >
            Approve
          </Button>
        </DialogActions>
      </Dialog>

      {/* Superior Lead Manager Selection Dialog (Admin only) */}
      <Dialog
        open={superiorManagerDialogOpen}
        onClose={() => setSuperiorManagerDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Set Superior Lead Manager</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2, mt: 1 }}>
            The superior lead manager will be responsible for reviewing refund approval requests before they go to admin for final confirmation.
          </Alert>
          {superiorManager && (
            <Typography variant="body2" sx={{ mb: 2 }}>
              <strong>Current:</strong> {superiorManager.fullName} ({superiorManager.email})
            </Typography>
          )}
          <FormControl fullWidth>
            <InputLabel>Select User</InputLabel>
            <Select
              value={selectedSuperiorManagerId}
              onChange={(e) => setSelectedSuperiorManagerId(e.target.value)}
              label="Select User"
            >
              {refundsManagers.map((manager) => (
                <MenuItem key={manager._id} value={manager._id}>
                  {manager.fullName} ({manager.email})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSuperiorManagerDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSetSuperiorManager}
            variant="contained"
            disabled={settingSuperior || !selectedSuperiorManagerId}
          >
            {settingSuperior ? <CircularProgress size={20} /> : 'Set Superior Manager'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RefundsPage;