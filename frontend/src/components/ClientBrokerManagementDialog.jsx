import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  Avatar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  Alert,
  Checkbox,
  Tooltip,
  Autocomplete,
  TextField,
} from "@mui/material";
import {
  Close as CloseIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  History as HistoryIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Pending as PendingIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
} from "@mui/icons-material";
import api from "../services/api";

const ClientBrokerManagementDialog = ({ open, onClose, order, onUpdate }) => {
  const [clientBrokers, setClientBrokers] = useState([]);
  const [loadingBrokers, setLoadingBrokers] = useState(false);
  const [editingLeads, setEditingLeads] = useState(new Set());
  const [leadBrokerValues, setLeadBrokerValues] = useState({});
  const [updatingLeads, setUpdatingLeads] = useState(new Set());
  const [selectedLeads, setSelectedLeads] = useState(new Set());
  const [bulkBroker, setBulkBroker] = useState("");
  const [notification, setNotification] = useState({ message: "", severity: "info" });

  // Define callbacks first (before useEffect hooks that use them)
  const fetchClientBrokers = useCallback(async () => {
    setLoadingBrokers(true);
    try {
      const response = await api.get("/client-brokers?isActive=true&limit=1000");
      setClientBrokers(response.data.data || []);
    } catch (err) {
      console.error("Failed to fetch client brokers:", err);
      setNotification({
        message: "Failed to load client brokers",
        severity: "error",
      });
    } finally {
      setLoadingBrokers(false);
    }
  }, []);

  const initializeLeadValues = useCallback(() => {
    if (!order?.leads) return;

    const initialValues = {};
    order.leads.forEach(lead => {
      // Initialize with empty string for adding new brokers
      initialValues[lead._id] = "";
    });
    setLeadBrokerValues(initialValues);
  }, [order]);

  // Reset all state when order changes or dialog closes
  useEffect(() => {
    if (!open) {
      // Reset all state when dialog closes
      setEditingLeads(new Set());
      setLeadBrokerValues({});
      setUpdatingLeads(new Set());
      setSelectedLeads(new Set());
      setBulkBroker("");
      setNotification({ message: "", severity: "info" });
    }
  }, [open]);

  // Reset state and fetch data when order changes
  useEffect(() => {
    if (open && order) {
      // Reset all state for new order
      setEditingLeads(new Set());
      setLeadBrokerValues({});
      setUpdatingLeads(new Set());
      setSelectedLeads(new Set());
      setBulkBroker("");
      setNotification({ message: "", severity: "info" });

      // Fetch fresh data
      fetchClientBrokers();
      initializeLeadValues();
    }
  }, [order?._id, open, fetchClientBrokers, initializeLeadValues]);

  const handleStartEdit = useCallback((leadId) => {
    setEditingLeads(prev => new Set([...prev, leadId]));
  }, []);

  const handleCancelEdit = useCallback((leadId) => {
    setEditingLeads(prev => {
      const newSet = new Set(prev);
      newSet.delete(leadId);
      return newSet;
    });
    // Reset value to empty
    setLeadBrokerValues(prev => ({
      ...prev,
      [leadId]: ""
    }));
  }, []);

  const handleUpdateLead = useCallback(async (leadId) => {
    setUpdatingLeads(prev => new Set([...prev, leadId]));

    try {
      const newBrokerId = leadBrokerValues[leadId];
      if (!newBrokerId) {
        setNotification({
          message: "Please select a broker to add",
          severity: "warning",
        });
        setUpdatingLeads(prev => {
          const newSet = new Set(prev);
          newSet.delete(leadId);
          return newSet;
        });
        return;
      }

      const lead = order.leads.find(l => l._id === leadId);
      const currentBrokerIds = lead?.assignedClientBrokers?.map(b => b._id || b) || [];

      // Check if broker is already assigned
      if (currentBrokerIds.includes(newBrokerId)) {
        setNotification({
          message: "This broker is already assigned to this lead",
          severity: "warning",
        });
        setUpdatingLeads(prev => {
          const newSet = new Set(prev);
          newSet.delete(leadId);
          return newSet;
        });
        return;
      }

      // Add the new broker to existing brokers
      const updatedBrokers = [...currentBrokerIds, newBrokerId];

      const updateData = {
        clientBroker: updatedBrokers
      };

      const response = await api.put(`/leads/${leadId}`, updateData);

      setNotification({
        message: "Client broker added successfully!",
        severity: "success",
      });

      setEditingLeads(prev => {
        const newSet = new Set(prev);
        newSet.delete(leadId);
        return newSet;
      });

      // Reset the value to empty
      setLeadBrokerValues(prev => ({
        ...prev,
        [leadId]: ""
      }));

      // Callback to parent to refresh order data
      if (onUpdate) {
        onUpdate(response.data.data);
      }
    } catch (err) {
      setNotification({
        message: err.response?.data?.message || "Failed to add client broker",
        severity: "error",
      });
    } finally {
      setUpdatingLeads(prev => {
        const newSet = new Set(prev);
        newSet.delete(leadId);
        return newSet;
      });
    }
  }, [leadBrokerValues, onUpdate, order]);

  const handleBrokerChange = useCallback((leadId, brokerId) => {
    setLeadBrokerValues(prev => ({
      ...prev,
      [leadId]: brokerId
    }));
  }, []);

  const handleSelectLead = useCallback((leadId, checked) => {
    setSelectedLeads(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(leadId);
      } else {
        newSet.delete(leadId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback((checked) => {
    if (checked) {
      setSelectedLeads(new Set(order.leads.map(lead => lead._id)));
    } else {
      setSelectedLeads(new Set());
    }
  }, [order]);

  const handleRemoveBroker = useCallback(async (leadId, brokerId) => {
    setUpdatingLeads(prev => new Set([...prev, leadId]));

    try {
      const lead = order.leads.find(l => l._id === leadId);
      const currentBrokerIds = lead?.assignedClientBrokers?.map(b => b._id || b) || [];

      // Remove the broker
      const updatedBrokers = currentBrokerIds.filter(id => id !== brokerId);

      const updateData = {
        clientBroker: updatedBrokers
      };

      await api.put(`/leads/${leadId}`, updateData);

      setNotification({
        message: "Client broker removed successfully!",
        severity: "success",
      });

      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      setNotification({
        message: err.response?.data?.message || "Failed to remove client broker",
        severity: "error",
      });
    } finally {
      setUpdatingLeads(prev => {
        const newSet = new Set(prev);
        newSet.delete(leadId);
        return newSet;
      });
    }
  }, [onUpdate, order]);

  const handleBulkAssign = useCallback(async () => {
    if (selectedLeads.size === 0 || !bulkBroker) return;

    const leadIds = Array.from(selectedLeads);
    setUpdatingLeads(prev => new Set([...prev, ...leadIds]));

    try {
      let successCount = 0;
      let skipCount = 0;

      const updatePromises = leadIds.map(async (leadId) => {
        const lead = order.leads.find(l => l._id === leadId);
        const currentBrokerIds = lead?.assignedClientBrokers?.map(b => b._id || b) || [];

        // Skip if broker is already assigned
        if (currentBrokerIds.includes(bulkBroker)) {
          skipCount++;
          return Promise.resolve();
        }

        // Add the new broker to existing brokers
        const updatedBrokers = [...currentBrokerIds, bulkBroker];

        await api.put(`/leads/${leadId}`, { clientBroker: updatedBrokers });
        successCount++;
      });

      await Promise.all(updatePromises);

      let message = '';
      if (successCount > 0 && skipCount > 0) {
        message = `Added broker to ${successCount} leads. Skipped ${skipCount} leads (already assigned)`;
      } else if (successCount > 0) {
        message = `Successfully added broker to ${successCount} leads`;
      } else if (skipCount > 0) {
        message = `All ${skipCount} selected leads already have this broker assigned`;
      }

      setNotification({
        message,
        severity: successCount > 0 ? "success" : "info",
      });

      setSelectedLeads(new Set());
      setBulkBroker("");

      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      setNotification({
        message: "Failed to update some leads",
        severity: "error",
      });
    } finally {
      setUpdatingLeads(new Set());
    }
  }, [selectedLeads, bulkBroker, onUpdate, order]);

  const getStatusIcon = (status) => {
    switch (status) {
      case "successful":
        return <CheckCircleIcon color="success" />;
      case "failed":
        return <ErrorIcon color="error" />;
      case "pending":
        return <PendingIcon color="warning" />;
      default:
        return <WarningIcon color="action" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "successful":
        return "success";
      case "failed":
        return "error";
      case "pending":
        return "warning";
      default:
        return "default";
    }
  };

  if (!order) return null;

  const allSelected = selectedLeads.size === order.leads.length;
  const someSelected = selectedLeads.size > 0 && selectedLeads.size < order.leads.length;

  return (
    <Dialog
      key={order?._id || 'no-order'}
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { height: '90vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={2}>
            <BusinessIcon color="primary" />
            <Box>
              <Typography variant="h6">
                Client Broker Management
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Order ID: {order._id?.slice(-8)} • {order.leads?.length || 0} leads
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {notification.message && (
          <Alert
            severity={notification.severity}
            sx={{ mb: 2 }}
            onClose={() => setNotification({ message: "", severity: "info" })}
          >
            {notification.message}
          </Alert>
        )}

        {/* Order Summary */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>Order Information</Typography>
                <Typography variant="body2">
                  <strong>Requester:</strong> {order.requester?.fullName}
                </Typography>
                <Typography variant="body2">
                  <strong>Campaign:</strong> {order.selectedCampaign?.name || "N/A"}
                </Typography>
                <Typography variant="body2">
                  <strong>Status:</strong>{" "}
                  <Chip label={order.status} size="small" color={order.status === "fulfilled" ? "success" : "warning"} />
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>Lead Summary</Typography>
                <Typography variant="body2">
                  <strong>Total Leads:</strong> {order.leads?.length || 0}
                </Typography>
                <Typography variant="body2">
                  <strong>With Brokers:</strong> {order.leads?.filter(lead => lead.assignedClientBrokers?.length > 0).length || 0}
                </Typography>
                <Typography variant="body2">
                  <strong>By Type:</strong> FTD({order.leads?.filter(l => l.leadType === 'ftd').length || 0}),
                  Filler({order.leads?.filter(l => l.leadType === 'filler').length || 0}),
                  Cold({order.leads?.filter(l => l.leadType === 'cold').length || 0})
                </Typography>
                <Typography variant="body2">
                  <strong>Unassigned:</strong> {order.leads?.filter(lead => !lead.assignedClientBrokers?.length).length || 0}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Bulk Assignment */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle2" gutterBottom>Bulk Add Broker</Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
              Add a broker to multiple leads at once. This will not remove existing broker assignments.
            </Typography>
            <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
              <Typography variant="body2">
                Selected: {selectedLeads.size} leads
              </Typography>
              <Autocomplete
                size="small"
                sx={{ minWidth: 300 }}
                options={clientBrokers}
                value={clientBrokers.find(b => b._id === bulkBroker) || null}
                onChange={(event, newValue) => setBulkBroker(newValue?._id || "")}
                disabled={selectedLeads.size === 0}
                getOptionLabel={(option) => `${option.name}${option.domain ? ` (${option.domain})` : ''}`}
                filterOptions={(options, { inputValue }) => {
                  const lowerInput = inputValue.toLowerCase();
                  return options.filter(option =>
                    option.name.toLowerCase().includes(lowerInput) ||
                    (option.domain && option.domain.toLowerCase().includes(lowerInput))
                  );
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Client Broker"
                    placeholder="Search by name or domain..."
                  />
                )}
                renderOption={(props, option) => (
                  <li {...props} key={option._id}>
                    <Box>
                      <Typography variant="body2">{option.name}</Typography>
                      {option.domain && (
                        <Typography variant="caption" color="text.secondary">
                          {option.domain}
                        </Typography>
                      )}
                    </Box>
                  </li>
                )}
              />
              <Button
                variant="contained"
                onClick={handleBulkAssign}
                disabled={selectedLeads.size === 0 || !bulkBroker || updatingLeads.size > 0}
                startIcon={updatingLeads.size > 0 ? <CircularProgress size={16} /> : <AddIcon />}
              >
                Add to Selected Leads
              </Button>
            </Box>
          </CardContent>
        </Card>

        {/* Leads Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={someSelected}
                    checked={allSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </TableCell>
                <TableCell>Lead</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Assigned Brokers</TableCell>
                <TableCell>Assignment History</TableCell>
                <TableCell>Add New Broker</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {order.leads?.map((lead) => {
                const isEditing = editingLeads.has(lead._id);
                const isUpdating = updatingLeads.has(lead._id);
                const isSelected = selectedLeads.has(lead._id);
                const currentBroker = lead.assignedClientBrokers?.[0];
                const hasHistory = lead.clientBrokerHistory?.length > 0;

                return (
                  <TableRow key={lead._id} selected={isSelected}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={isSelected}
                        onChange={(e) => handleSelectLead(lead._id, e.target.checked)}
                      />
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Avatar sx={{ width: 32, height: 32 }}>
                          <PersonIcon />
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                            {lead.firstName} {lead.lastName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {lead.newEmail}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={(lead.orderedAs || lead.leadType)?.toUpperCase() || "UNKNOWN"}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      {lead.assignedClientBrokers?.length > 0 ? (
                        <Box display="flex" flexDirection="column" gap={1}>
                          {lead.assignedClientBrokers.map((broker) => (
                            <Chip
                              key={broker._id}
                              label={
                                <Box>
                                  <Typography variant="body2" component="span" sx={{ fontWeight: "bold" }}>
                                    {broker.name}
                                  </Typography>
                                  {broker.domain && (
                                    <Typography variant="caption" component="span" color="text.secondary" sx={{ ml: 0.5 }}>
                                      ({broker.domain})
                                    </Typography>
                                  )}
                                </Box>
                              }
                              onDelete={() => handleRemoveBroker(lead._id, broker._id)}
                              deleteIcon={
                                <Tooltip title="Remove broker">
                                  <DeleteIcon />
                                </Tooltip>
                              }
                              disabled={isUpdating}
                              color="primary"
                              variant="outlined"
                              sx={{
                                maxWidth: "100%",
                                height: "auto",
                                py: 0.5,
                                "& .MuiChip-label": {
                                  display: "block",
                                  whiteSpace: "normal",
                                  textAlign: "left"
                                }
                              }}
                            />
                          ))}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No brokers assigned
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {hasHistory ? (
                        <Tooltip title="View assignment history">
                          <Chip
                            icon={<HistoryIcon />}
                            label={`${lead.clientBrokerHistory.length} assignment(s)`}
                            size="small"
                            variant="outlined"
                            color="info"
                            onClick={() => {/* Could expand to show history */}}
                          />
                        </Tooltip>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          No history
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Box display="flex" flexDirection="column" gap={1}>
                          <Autocomplete
                            size="small"
                            fullWidth
                            options={clientBrokers}
                            value={clientBrokers.find(b => b._id === leadBrokerValues[lead._id]) || null}
                            onChange={(event, newValue) => handleBrokerChange(lead._id, newValue?._id || "")}
                            disabled={isUpdating}
                            getOptionLabel={(option) => `${option.name}${option.domain ? ` (${option.domain})` : ''}`}
                            filterOptions={(options, { inputValue }) => {
                              const lowerInput = inputValue.toLowerCase();
                              return options.filter(option =>
                                option.name.toLowerCase().includes(lowerInput) ||
                                (option.domain && option.domain.toLowerCase().includes(lowerInput))
                              );
                            }}
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                label="Select Broker"
                                placeholder="Search by name or domain..."
                              />
                            )}
                            renderOption={(props, option) => {
                              const hasBeenSentBefore = lead.clientBrokerHistory?.some(
                                history => history.clientBroker?._id === option._id
                              );
                              const isAlreadyAssigned = lead.assignedClientBrokers?.some(
                                broker => broker._id === option._id
                              );

                              return (
                                <li {...props} key={option._id}>
                                  <Box display="flex" alignItems="center" justifyContent="space-between" width="100%">
                                    <Box>
                                      <Typography variant="body2">{option.name}</Typography>
                                      {option.domain && (
                                        <Typography variant="caption" color="text.secondary">
                                          {option.domain}
                                        </Typography>
                                      )}
                                    </Box>
                                    <Box display="flex" gap={0.5}>
                                      {isAlreadyAssigned && (
                                        <Chip
                                          label="Already assigned"
                                          size="small"
                                          color="info"
                                          variant="outlined"
                                          sx={{ fontSize: "0.6rem", height: 16 }}
                                        />
                                      )}
                                      {hasBeenSentBefore && (
                                        <Chip
                                          label="Previously sent"
                                          size="small"
                                          color="warning"
                                          variant="outlined"
                                          sx={{ fontSize: "0.6rem", height: 16 }}
                                        />
                                      )}
                                    </Box>
                                  </Box>
                                </li>
                              );
                            }}
                          />
                          <Box display="flex" gap={1}>
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => handleUpdateLead(lead._id)}
                              disabled={isUpdating || !leadBrokerValues[lead._id]}
                              startIcon={isUpdating ? <CircularProgress size={16} /> : <AddIcon />}
                              fullWidth
                            >
                              Add Broker
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => handleCancelEdit(lead._id)}
                              disabled={isUpdating}
                            >
                              Cancel
                            </Button>
                          </Box>
                        </Box>
                      ) : (
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<AddIcon />}
                          onClick={() => handleStartEdit(lead._id)}
                          disabled={isUpdating}
                        >
                          Add Broker
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ClientBrokerManagementDialog;
