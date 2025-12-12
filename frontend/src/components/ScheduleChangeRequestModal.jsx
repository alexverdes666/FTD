import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  TextField,
  IconButton,
  Divider,
  Alert,
  CircularProgress,
  Checkbox,
  FormControlLabel
} from '@mui/material';
import {
  CheckCircle as ApprovedIcon,
  Cancel as RejectedIcon,
  PendingActions as PendingIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  CalendarToday as CalendarIcon,
  DoneAll as BulkApproveIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import agentScheduleService from '../services/agentScheduleService';

const ScheduleChangeRequestModal = ({
  open,
  onClose,
  requests = [],
  onApprove,
  onReject,
  isManager = false,
  loading = false
}) => {
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [selectedRequests, setSelectedRequests] = useState(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Clear selections when modal is closed or opened
  React.useEffect(() => {
    if (!open) {
      setSelectedRequests(new Set());
    }
  }, [open]);

  // Filter to show only pending requests first, then others
  const pendingRequests = requests.filter(req => req.status === 'pending');
  const otherRequests = requests.filter(req => req.status !== 'pending');

  const handleApprove = async (request) => {
    if (processing) return;
    
    try {
      setProcessing(true);
      await onApprove(request._id);
      toast.success('Request approved successfully');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to approve request');
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectClick = (request) => {
    setSelectedRequest(request);
    setRejectDialogOpen(true);
  };

  const handleRejectConfirm = async () => {
    if (!selectedRequest || processing) return;

    try {
      setProcessing(true);
      await onReject(selectedRequest._id, rejectionReason);
      toast.success('Request rejected');
      setRejectDialogOpen(false);
      setSelectedRequest(null);
      setRejectionReason('');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reject request');
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedRequests.size === 0 || bulkProcessing) return;

    try {
      setBulkProcessing(true);
      const requestIds = Array.from(selectedRequests);
      const response = await agentScheduleService.bulkApproveScheduleChanges(requestIds);
      
      toast.success(response.message || `Successfully approved ${response.data.success.length} request(s)`);
      
      // Clear selections
      setSelectedRequests(new Set());
      
      // Refresh the parent component by calling onApprove with null
      // This will trigger a refresh of the requests list
      if (onApprove) {
        await onApprove(null);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to bulk approve requests');
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleSelectRequest = (requestId) => {
    setSelectedRequests(prev => {
      const newSet = new Set(prev);
      if (newSet.has(requestId)) {
        newSet.delete(requestId);
      } else {
        newSet.add(requestId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      const allPendingIds = pendingRequests.map(req => req._id);
      setSelectedRequests(new Set(allPendingIds));
    } else {
      setSelectedRequests(new Set());
    }
  };

  const isAllSelected = pendingRequests.length > 0 && selectedRequests.size === pendingRequests.length;

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved':
        return <ApprovedIcon sx={{ color: 'success.main' }} />;
      case 'rejected':
        return <RejectedIcon sx={{ color: 'error.main' }} />;
      case 'pending':
        return <PendingIcon sx={{ color: 'warning.main' }} />;
      default:
        return null;
    }
  };

  const getStatusChip = (status) => {
    const colors = {
      pending: 'warning',
      approved: 'success',
      rejected: 'error'
    };
    return (
      <Chip
        label={status.charAt(0).toUpperCase() + status.slice(1)}
        color={colors[status] || 'default'}
        size="small"
      />
    );
  };

  const formatDate = (year, month, day) => {
    try {
      return format(new Date(year, month - 1, day), 'MMM dd, yyyy');
    } catch (error) {
      return `${year}-${month}-${day}`;
    }
  };

  const renderRequest = (request) => (
    <ListItem
      key={request._id}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        mb: 1,
        bgcolor: request.status === 'pending' ? 'action.hover' : 'background.paper'
      }}
    >
      {isManager && request.status === 'pending' && (
        <Checkbox
          checked={selectedRequests.has(request._id)}
          onChange={() => handleSelectRequest(request._id)}
          disabled={processing || bulkProcessing}
          sx={{ mr: 1 }}
        />
      )}
      <ListItemIcon>
        {getStatusIcon(request.status)}
      </ListItemIcon>
      <ListItemText
        primary={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="subtitle2">
              {formatDate(request.year, request.month, request.day)}
            </Typography>
            {getStatusChip(request.status)}
            <Chip
              label={request.requestedAvailability ? 'Available' : 'Unavailable'}
              size="small"
              color={request.requestedAvailability ? 'success' : 'error'}
              variant="outlined"
            />
          </Box>
        }
        secondary={
          <Box sx={{ mt: 1 }}>
            {isManager && request.agentId && (
              <Typography variant="caption" display="block">
                Agent: {request.agentId.fullName} ({request.agentId.fourDigitCode})
              </Typography>
            )}
            <Typography variant="caption" display="block">
              Requested: {format(new Date(request.requestedAt), 'MMM dd, yyyy HH:mm')}
            </Typography>
            {request.status !== 'pending' && request.reviewedBy && (
              <Typography variant="caption" display="block">
                Reviewed by: {request.reviewedBy.fullName} on {format(new Date(request.reviewedAt), 'MMM dd, yyyy HH:mm')}
              </Typography>
            )}
            {request.status === 'rejected' && request.rejectionReason && (
              <Typography variant="caption" display="block" color="error">
                Reason: {request.rejectionReason}
              </Typography>
            )}
          </Box>
        }
      />
      {isManager && request.status === 'pending' && (
        <Box sx={{ display: 'flex', gap: 1, ml: 2 }}>
          <IconButton
            size="small"
            color="success"
            onClick={() => handleApprove(request)}
            disabled={processing}
          >
            <CheckIcon />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            onClick={() => handleRejectClick(request)}
            disabled={processing}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      )}
    </ListItem>
  );

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CalendarIcon />
            <Typography variant="h6">Schedule Change Requests</Typography>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : requests.length === 0 ? (
            <Alert severity="info">No schedule change requests found</Alert>
          ) : (
            <>
              {pendingRequests.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle1" fontWeight="bold" color="warning.main">
                        Pending Requests ({pendingRequests.length})
                      </Typography>
                      {isManager && (
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={isAllSelected}
                              indeterminate={selectedRequests.size > 0 && selectedRequests.size < pendingRequests.length}
                              onChange={handleSelectAll}
                              disabled={processing || bulkProcessing}
                            />
                          }
                          label={<Typography variant="caption">Select All</Typography>}
                        />
                      )}
                    </Box>
                    {isManager && selectedRequests.size > 0 && (
                      <Button
                        variant="contained"
                        color="success"
                        size="small"
                        startIcon={bulkProcessing ? <CircularProgress size={16} color="inherit" /> : <BulkApproveIcon />}
                        onClick={handleBulkApprove}
                        disabled={bulkProcessing || processing}
                      >
                        Approve Selected ({selectedRequests.size})
                      </Button>
                    )}
                  </Box>
                  <List>
                    {pendingRequests.map(renderRequest)}
                  </List>
                </Box>
              )}
              
              {otherRequests.length > 0 && (
                <Box>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Processed Requests ({otherRequests.length})
                  </Typography>
                  <List>
                    {otherRequests.map(renderRequest)}
                  </List>
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Rejection Reason Dialog */}
      <Dialog open={rejectDialogOpen} onClose={() => !processing && setRejectDialogOpen(false)}>
        <DialogTitle>Reject Schedule Change Request</DialogTitle>
        <DialogContent>
          {selectedRequest && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" gutterBottom>
                Date: {formatDate(selectedRequest.year, selectedRequest.month, selectedRequest.day)}
              </Typography>
              <Typography variant="body2" gutterBottom>
                Requested: {selectedRequest.requestedAvailability ? 'Available' : 'Unavailable'}
              </Typography>
            </Box>
          )}
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Rejection Reason"
            placeholder="Please provide a reason for rejecting this request"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            disabled={processing}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)} disabled={processing}>
            Cancel
          </Button>
          <Button
            onClick={handleRejectConfirm}
            variant="contained"
            color="error"
            disabled={processing}
          >
            {processing ? <CircularProgress size={20} /> : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ScheduleChangeRequestModal;

