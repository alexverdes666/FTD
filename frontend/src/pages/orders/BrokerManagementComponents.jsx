import React, { useState, useEffect } from "react";
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
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Alert,
  CircularProgress,
  FormControlLabel,
  Checkbox,
  ListItemText,
  Autocomplete,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Business as BusinessIcon,
} from "@mui/icons-material";
import CommentButton from "../../components/CommentButton";

// Change Requester Dialog Component
export const ChangeRequesterDialog = ({
  open,
  onClose,
  onSubmit,
  requesters,
  loading,
  selectedRequester,
  onSelectRequester,
}) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitle>Change Order Requester</DialogTitle>
    <DialogContent sx={{ pt: 2 }}>
      <Autocomplete
        options={requesters}
        getOptionLabel={(option) => `${option.fullName} (${option.role})`}
        loading={loading}
        value={selectedRequester}
        onChange={(event, newValue) => onSelectRequester(newValue)}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Select New Requester"
            variant="outlined"
            margin="normal"
          />
        )}
        renderOption={(props, option) => (
          <li {...props}>
            <ListItemText primary={option.fullName} secondary={option.role} />
          </li>
        )}
      />
      <Alert severity="warning" sx={{ mt: 2 }}>
        Changing the requester will relink all connections (leads, etc.) to the
        new requester.
      </Alert>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Cancel</Button>
      <Button
        onClick={onSubmit}
        variant="contained"
        disabled={!selectedRequester}
      >
        Change Requester
      </Button>
    </DialogActions>
  </Dialog>
);

// Create Broker Form Component
export const CreateBrokerForm = ({ onSubmit, loading, onCancel }) => {
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
      <Grid container spacing={2}>
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
export const EditBrokerForm = ({ broker, onSubmit, loading, onCancel }) => {
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
      <Grid container spacing={2}>
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
              startIcon={
                loading ? <CircularProgress size={16} /> : <SaveIcon />
              }
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
export const BrokerManagementTable = ({
  brokers,
  loading,
  onRefresh,
  onDelete,
  onEdit,
  userRole,
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
          {isAdmin
            ? "No client brokers found. Create your first broker to get started."
            : "No client brokers found."}
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
                  <BusinessIcon fontSize="small" color="primary" />
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
                  <Box display="flex" flexDirection="row" gap={1}>
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
                  </Box>
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
