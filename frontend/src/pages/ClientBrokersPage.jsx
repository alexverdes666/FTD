import React, { useState, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  FormControl,
  Alert,
  CircularProgress,
  FormControlLabel,
  Checkbox,
  Chip,
  Collapse,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Business as BusinessIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import api from "../services/api";
import { selectUser } from "../store/slices/authSlice";
import CommentButton from "../components/CommentButton";

const ClientBrokersPage = () => {
  const user = useSelector(selectUser);
  const [clientBrokers, setClientBrokers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({ message: "", severity: "info" });
  const [searchTerm, setSearchTerm] = useState("");

  // Dialog states
  const [createBrokerDialog, setCreateBrokerDialog] = useState({ open: false, loading: false });
  const [editBrokerDialog, setEditBrokerDialog] = useState({ open: false, loading: false, broker: null });
  const [deleteBrokerDialog, setDeleteBrokerDialog] = useState({ open: false, loading: false, broker: null });

  // Fetch client brokers
  const fetchClientBrokers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get("/client-brokers?limit=1000");
      setClientBrokers(response.data.data || []);
    } catch (err) {
      console.error("Failed to fetch client brokers:", err);
      setNotification({
        message: "Failed to load client brokers",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClientBrokers();
  }, [fetchClientBrokers]);

  // Create broker handlers
  const handleCreateNewBroker = useCallback(() => {
    setCreateBrokerDialog({ open: true, loading: false });
  }, []);

  const handleCloseCreateBrokerDialog = useCallback(() => {
    setCreateBrokerDialog({ open: false, loading: false });
  }, []);

  const handleSubmitNewBroker = useCallback(
    async (brokerData) => {
      try {
        setCreateBrokerDialog((prev) => ({ ...prev, loading: true }));
        setNotification({
          message: "Creating new client broker...",
          severity: "info",
        });

        await api.post("/client-brokers", brokerData);

        setNotification({
          message: `Client broker "${brokerData.name}" created successfully!`,
          severity: "success",
        });

        await fetchClientBrokers();
        handleCloseCreateBrokerDialog();
      } catch (err) {
        setNotification({
          message: err.response?.data?.message || "Failed to create client broker",
          severity: "error",
        });
        setCreateBrokerDialog((prev) => ({ ...prev, loading: false }));
      }
    },
    [fetchClientBrokers, handleCloseCreateBrokerDialog]
  );

  // Edit broker handlers
  const handleEditBroker = useCallback((broker) => {
    setEditBrokerDialog({ open: true, loading: false, broker });
  }, []);

  const handleCloseEditBrokerDialog = useCallback(() => {
    setEditBrokerDialog({ open: false, loading: false, broker: null });
  }, []);

  const handleSubmitEditBroker = useCallback(
    async (brokerData) => {
      try {
        setEditBrokerDialog((prev) => ({ ...prev, loading: true }));
        setNotification({
          message: "Updating client broker...",
          severity: "info",
        });

        await api.put(`/client-brokers/${editBrokerDialog.broker._id}`, brokerData);

        setNotification({
          message: `Client broker "${brokerData.name}" updated successfully!`,
          severity: "success",
        });

        await fetchClientBrokers();
        handleCloseEditBrokerDialog();
      } catch (err) {
        setNotification({
          message: err.response?.data?.message || "Failed to update client broker",
          severity: "error",
        });
        setEditBrokerDialog((prev) => ({ ...prev, loading: false }));
      }
    },
    [editBrokerDialog.broker, fetchClientBrokers, handleCloseEditBrokerDialog]
  );

  // Delete broker handlers
  const handleDeleteBroker = useCallback((broker) => {
    setDeleteBrokerDialog({ open: true, loading: false, broker });
  }, []);

  const handleCloseDeleteBrokerDialog = useCallback(() => {
    setDeleteBrokerDialog({ open: false, loading: false, broker: null });
  }, []);

  const handleConfirmDeleteBroker = useCallback(async () => {
    try {
      setDeleteBrokerDialog((prev) => ({ ...prev, loading: true }));
      setNotification({
        message: "Deleting client broker...",
        severity: "info",
      });

      await api.delete(`/client-brokers/${deleteBrokerDialog.broker._id}`);

      setNotification({
        message: `Client broker "${deleteBrokerDialog.broker.name}" deleted successfully!`,
        severity: "success",
      });

      await fetchClientBrokers();
      handleCloseDeleteBrokerDialog();
    } catch (err) {
      setNotification({
        message: err.response?.data?.message || "Failed to delete client broker",
        severity: "error",
      });
      setDeleteBrokerDialog((prev) => ({ ...prev, loading: false }));
    }
  }, [deleteBrokerDialog.broker, fetchClientBrokers, handleCloseDeleteBrokerDialog]);

  // Filter brokers based on search term
  const filteredBrokers = React.useMemo(() => {
    if (!searchTerm.trim()) {
      return clientBrokers;
    }
    
    const searchLower = searchTerm.toLowerCase();
    return clientBrokers.filter(broker => 
      broker.name?.toLowerCase().includes(searchLower) ||
      broker.domain?.toLowerCase().includes(searchLower)
    );
  }, [clientBrokers, searchTerm]);

  if (user?.role !== "admin") {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Access denied. Only admins can manage client brokers.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Typography variant="h4" component="h1" fontWeight="bold">
          Client Brokers
        </Typography>
        <Box sx={{ display: "flex", gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchClientBrokers}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateNewBroker}
          >
            Create New Broker
          </Button>
        </Box>
      </Box>

      <Collapse in={!!notification.message}>
        <Alert
          severity={notification.severity}
          onClose={() => setNotification({ message: "", severity: "info" })}
          sx={{ mb: 2 }}
        >
          {notification.message}
        </Alert>
      </Collapse>

      {/* Search Bar */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <TextField
          fullWidth
          placeholder="Search by broker name or domain..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <Box sx={{ mr: 1, display: "flex", alignItems: "center" }}>
                <SearchIcon color="action" />
              </Box>
            ),
          }}
          variant="outlined"
          size="small"
        />
      </Paper>

      <Paper sx={{ width: "100%", overflow: "hidden" }}>
        <BrokerManagementTable
          brokers={filteredBrokers}
          loading={loading}
          onRefresh={fetchClientBrokers}
          onDelete={handleDeleteBroker}
          onEdit={handleEditBroker}
          userRole={user?.role}
          searchTerm={searchTerm}
        />
      </Paper>

      {/* Create Broker Dialog */}
      <Dialog
        open={createBrokerDialog.open}
        onClose={handleCloseCreateBrokerDialog}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown={createBrokerDialog.loading}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <AddIcon color="primary" />
            <Typography variant="h6">Create New Client Broker</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <CreateBrokerForm
            onSubmit={handleSubmitNewBroker}
            loading={createBrokerDialog.loading}
            onCancel={handleCloseCreateBrokerDialog}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Broker Dialog */}
      <Dialog
        open={editBrokerDialog.open}
        onClose={handleCloseEditBrokerDialog}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown={editBrokerDialog.loading}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <EditIcon color="primary" />
            <Typography variant="h6">Edit Client Broker</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <EditBrokerForm
            broker={editBrokerDialog.broker}
            onSubmit={handleSubmitEditBroker}
            loading={editBrokerDialog.loading}
            onCancel={handleCloseEditBrokerDialog}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Broker Confirmation Dialog */}
      <Dialog
        open={deleteBrokerDialog.open}
        onClose={handleCloseDeleteBrokerDialog}
        maxWidth="xs"
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete client broker "
            {deleteBrokerDialog.broker?.name}"?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleCloseDeleteBrokerDialog}
            disabled={deleteBrokerDialog.loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDeleteBroker}
            variant="contained"
            color="error"
            startIcon={
              deleteBrokerDialog.loading ? (
                <CircularProgress size={16} />
              ) : (
                <DeleteIcon />
              )
            }
            disabled={deleteBrokerDialog.loading}
          >
            {deleteBrokerDialog.loading ? "Deleting..." : "Delete Broker"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// Create Broker Form Component
const CreateBrokerForm = ({ onSubmit, loading, onCancel }) => {
  const [formData, setFormData] = useState({
    name: "",
    domain: "",
    isActive: true,
    notes: "",
  });

  const handleChange = (field) => (event) => {
    setFormData((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Broker Name *"
            value={formData.name}
            onChange={handleChange("name")}
            required
            disabled={loading}
            placeholder="e.g., Acme Trading Ltd"
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Domain"
            value={formData.domain}
            onChange={handleChange("domain")}
            disabled={loading}
            placeholder="e.g., acmetrading.com"
            helperText="Optional: Primary domain for this broker"
          />
        </Grid>
        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.isActive}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    isActive: e.target.checked,
                  }))
                }
                disabled={loading}
              />
            }
            label="Active"
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Notes"
            value={formData.notes}
            onChange={handleChange("notes")}
            multiline
            rows={3}
            disabled={loading}
            placeholder="Optional notes about this broker"
          />
        </Grid>
        <Grid item xs={12}>
          <Box display="flex" gap={1} justifyContent="flex-end">
            <Button onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={loading || !formData.name.trim()}
              startIcon={loading ? <CircularProgress size={16} /> : <AddIcon />}
            >
              {loading ? "Creating..." : "Create Broker"}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </form>
  );
};

// Edit Broker Form Component
const EditBrokerForm = ({ broker, onSubmit, loading, onCancel }) => {
  const [formData, setFormData] = useState({
    name: broker?.name || "",
    domain: broker?.domain || "",
    description: broker?.description || "",
    isActive: broker?.isActive !== undefined ? broker.isActive : true,
  });

  // Update form when broker changes
  useEffect(() => {
    if (broker) {
      setFormData({
        name: broker.name || "",
        domain: broker.domain || "",
        description: broker.description || "",
        isActive: broker.isActive !== undefined ? broker.isActive : true,
      });
    }
  }, [broker]);

  const handleChange = (field) => (e) => {
    setFormData((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    
    onSubmit({
      name: formData.name.trim(),
      domain: formData.domain.trim() || undefined,
      description: formData.description.trim() || undefined,
      isActive: formData.isActive,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Broker Name"
            value={formData.name}
            onChange={handleChange("name")}
            disabled={loading}
            required
            placeholder="e.g., ACME Trading"
            helperText="Unique name for this client broker"
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Domain"
            value={formData.domain}
            onChange={handleChange("domain")}
            disabled={loading}
            placeholder="e.g., acmetrading.com"
            helperText="Optional: Primary domain for this broker"
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Description"
            value={formData.description}
            onChange={handleChange("description")}
            multiline
            rows={3}
            disabled={loading}
            placeholder="Optional description for this broker"
            helperText="Optional: Additional information about this broker"
          />
        </Grid>
        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.isActive}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    isActive: e.target.checked,
                  }))
                }
                disabled={loading}
              />
            }
            label="Active"
          />
        </Grid>
        <Grid item xs={12}>
          <Box display="flex" gap={1} justifyContent="flex-end">
            <Button onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={loading || !formData.name.trim()}
              startIcon={loading ? <CircularProgress size={16} /> : <SaveIcon />}
            >
              {loading ? "Updating..." : "Update Broker"}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </form>
  );
};

// Broker Management Table Component
const BrokerManagementTable = ({
  brokers,
  loading,
  onRefresh,
  onDelete,
  onEdit,
  userRole,
  searchTerm,
}) => {
  const isAdmin = userRole === "admin";

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (brokers.length === 0) {
    return (
      <Box textAlign="center" py={4}>
        <Typography variant="body2" color="text.secondary">
          {searchTerm ? (
            `No brokers found matching "${searchTerm}"`
          ) : isAdmin ? (
            "No client brokers found. Create your first broker to get started."
          ) : (
            "No client brokers found."
          )}
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer component={Paper} elevation={1}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>
              <strong>Name</strong>
            </TableCell>
            <TableCell>
              <strong>Domain</strong>
            </TableCell>
            <TableCell>
              <strong>Status</strong>
            </TableCell>
            <TableCell>
              <strong>Created</strong>
            </TableCell>
            {isAdmin && (
              <TableCell>
                <strong>Actions</strong>
              </TableCell>
            )}
            <TableCell>
              <strong>Comments</strong>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {brokers.map((broker) => (
            <TableRow key={broker._id}>
              <TableCell>
                <Box display="flex" alignItems="center" gap={1}>
                  <BusinessIcon fontSize="small" />
                  <Typography variant="body2">{broker.name}</Typography>
                </Box>
              </TableCell>
              <TableCell>
                <Typography variant="body2">
                  {broker.domain || "N/A"}
                </Typography>
              </TableCell>
              <TableCell>
                <Chip
                  label={broker.isActive ? "Active" : "Inactive"}
                  color={broker.isActive ? "success" : "default"}
                  size="small"
                />
              </TableCell>
              <TableCell>
                <Typography variant="body2">
                  {new Date(broker.createdAt).toLocaleDateString()}
                </Typography>
              </TableCell>
              {isAdmin && (
                <TableCell>
                  <IconButton 
                    size="small" 
                    title="Edit Broker"
                    onClick={() => onEdit(broker)}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    title="Delete Broker"
                    onClick={() => onDelete(broker)}
                    color="error"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              )}
              <TableCell>
                <CommentButton
                  targetType="client_broker"
                  targetId={broker._id}
                  targetName={broker.name}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default ClientBrokersPage;

