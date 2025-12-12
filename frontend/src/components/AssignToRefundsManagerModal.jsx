import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Checkbox,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { refundsService } from '../services/refunds';

const AssignToRefundsManagerModal = ({ open, onClose, orderId, onSuccess }) => {
  const [ftdLeads, setFtdLeads] = useState([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [refundsManagers, setRefundsManagers] = useState([]);
  const [selectedRefundsManagerId, setSelectedRefundsManagerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [managersLoading, setManagersLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && orderId) {
      fetchFTDLeads();
      fetchRefundsManagers();
    }
  }, [open, orderId]);

  const fetchFTDLeads = async () => {
    try {
      setLoading(true);
      setError('');
      console.log('Fetching FTD leads for order:', orderId);
      const response = await refundsService.getFTDLeadsForOrder(orderId);
      console.log('FTD leads response:', response);
      setFtdLeads(response.data || []);
      // Pre-select all leads by default
      setSelectedLeadIds(response.data?.map(lead => lead._id) || []);
    } catch (err) {
      console.error('Fetch FTD leads error:', err);
      setError(err.response?.data?.message || 'Failed to fetch FTD leads');
    } finally {
      setLoading(false);
    }
  };

  const fetchRefundsManagers = async () => {
    try {
      setManagersLoading(true);
      console.log('Fetching refunds managers');
      const response = await refundsService.getRefundsManagers();
      console.log('Refunds managers response:', response);
      const managers = response.data || [];
      setRefundsManagers(managers);
      // Auto-select the first refunds manager if there's only one
      if (managers.length === 1) {
        setSelectedRefundsManagerId(managers[0]._id);
      }
    } catch (err) {
      console.error('Fetch refunds managers error:', err);
      setError(err.response?.data?.message || 'Failed to fetch refunds managers');
    } finally {
      setManagersLoading(false);
    }
  };

  const handleLeadToggle = (leadId) => {
    setSelectedLeadIds(prev =>
      prev.includes(leadId)
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };

  const handleSelectAll = () => {
    if (selectedLeadIds.length === ftdLeads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(ftdLeads.map(lead => lead._id));
    }
  };

  const handleAssign = async () => {
    if (selectedLeadIds.length === 0) {
      setError('Please select at least one lead to assign');
      return;
    }

    if (!selectedRefundsManagerId && refundsManagers.length > 0) {
      setError('Please select a refunds manager');
      return;
    }

    try {
      setAssigning(true);
      setError('');

      console.log('Assigning leads to refunds manager:', {
        orderId,
        leadIds: selectedLeadIds,
        refundsManagerId: selectedRefundsManagerId
      });

      await refundsService.assignToRefundsManager({
        orderId,
        leadIds: selectedLeadIds,
        refundsManagerId: selectedRefundsManagerId || undefined
      });

      console.log('Successfully assigned leads to refunds manager');
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Assign leads error:', err);
      console.error('Error details:', err.response?.data);
      setError(err.response?.data?.message || 'Failed to assign leads to refunds manager');
    } finally {
      setAssigning(false);
    }
  };

  const handleClose = () => {
    if (!assigning) {
      setSelectedLeadIds([]);
      setSelectedRefundsManagerId('');
      setError('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Assign FTD Leads to Refunds Manager
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading || managersLoading ? (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress />
          </Box>
        ) : ftdLeads.length === 0 ? (
          <Alert severity="info">
            No FTD leads found for this order that can be assigned to refunds manager.
          </Alert>
        ) : (
          <Box>
            {/* Refunds Manager Selection */}
            <Box sx={{ mb: 3 }}>
              <FormControl fullWidth>
                <InputLabel>Select Refunds Manager</InputLabel>
                <Select
                  value={selectedRefundsManagerId}
                  label="Select Refunds Manager"
                  onChange={(e) => setSelectedRefundsManagerId(e.target.value)}
                  disabled={managersLoading || refundsManagers.length === 0}
                >
                  {refundsManagers.map((manager) => (
                    <MenuItem key={manager._id} value={manager._id}>
                      {manager.fullName} ({manager.email})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {refundsManagers.length === 0 && !managersLoading && (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  No active refunds managers found. Please contact an administrator.
                </Alert>
              )}
            </Box>

            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body1">
                Found {ftdLeads.length} FTD lead(s) available for assignment
              </Typography>
              <Button
                size="small"
                onClick={handleSelectAll}
                variant="outlined"
              >
                {selectedLeadIds.length === ftdLeads.length ? 'Deselect All' : 'Select All'}
              </Button>
            </Box>

            <List sx={{ maxHeight: 400, overflow: 'auto' }}>
              {ftdLeads.map((lead, index) => (
                <React.Fragment key={lead._id}>
                  <ListItem
                    dense
                    sx={{
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'grey.50' }
                    }}
                    onClick={() => handleLeadToggle(lead._id)}
                  >
                    <ListItemIcon>
                      <Checkbox
                        checked={selectedLeadIds.includes(lead._id)}
                        color="primary"
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="subtitle2">
                            {lead.firstName} {lead.lastName}
                          </Typography>
                          <Chip label="FTD" color="primary" size="small" />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Email: {lead.email}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Phone: {lead.phone} • Country: {lead.country}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < ftdLeads.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>

            {selectedLeadIds.length > 0 && selectedRefundsManagerId && (
              <Alert severity="info" sx={{ mt: 2 }}>
                {selectedLeadIds.length} lead(s) selected for assignment to{' '}
                {refundsManagers.find(m => m._id === selectedRefundsManagerId)?.fullName || 'refunds manager'}
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={assigning}>
          Cancel
        </Button>
        <Button
          onClick={handleAssign}
          variant="contained"
          disabled={
            assigning ||
            selectedLeadIds.length === 0 ||
            loading ||
            managersLoading ||
            (!selectedRefundsManagerId && refundsManagers.length > 0)
          }
        >
          {assigning ? (
            <>
              <CircularProgress size={20} sx={{ mr: 1 }} />
              Assigning...
            </>
          ) : (
            `Assign ${selectedLeadIds.length} Lead(s)`
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AssignToRefundsManagerModal;