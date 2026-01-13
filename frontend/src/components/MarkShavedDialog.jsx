import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  Alert,
  CircularProgress,
} from "@mui/material";
import { Warning as WarningIcon } from "@mui/icons-material";
import { refundsService } from "../services/refunds";

const MarkShavedDialog = ({
  open,
  lead,
  userRole,
  onClose,
  onConfirm,
  loading = false,
}) => {
  const [refundsManagers, setRefundsManagers] = useState([]);
  const [selectedManager, setSelectedManager] = useState("");
  const [managersLoading, setManagersLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      fetchRefundsManagers();
    }
  }, [open]);

  const fetchRefundsManagers = async () => {
    setManagersLoading(true);
    setError(null);
    try {
      const response = await refundsService.getRefundsManagers();
      const managers = response.data || [];
      setRefundsManagers(managers);
      // Auto-select if only one manager
      if (managers.length === 1) {
        setSelectedManager(managers[0]._id);
      }
    } catch (err) {
      console.error("Failed to fetch refunds managers:", err);
      setError("Failed to load refunds managers. Please try again.");
    } finally {
      setManagersLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!selectedManager) {
      setError("Please select a refunds manager");
      return;
    }
    onConfirm(selectedManager);
  };

  const handleClose = () => {
    setSelectedManager("");
    setError(null);
    onClose();
  };

  const isAdmin = userRole === "admin";

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Mark as Shaved
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1 }}>
          {lead && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Lead: <strong>{lead.firstName} {lead.lastName}</strong>
              {lead.newEmail && ` (${lead.newEmail})`}
            </Typography>
          )}

          <Typography variant="body2" sx={{ mb: 2 }}>
            This will mark the FTD as "shaved" (deposit made but brand didn't show it)
            and assign it to a refunds manager for follow-up.
          </Typography>

          {!isAdmin && (
            <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 2 }}>
              Once you select a refunds manager, this assignment cannot be changed.
              Only admins can modify it later.
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel id="refunds-manager-label">Refunds Manager *</InputLabel>
            <Select
              labelId="refunds-manager-label"
              value={selectedManager}
              label="Refunds Manager *"
              onChange={(e) => setSelectedManager(e.target.value)}
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
            <Typography variant="caption" color="error" sx={{ mt: 1, display: "block" }}>
              No active refunds managers found. Please contact an administrator.
            </Typography>
          )}

          {managersLoading && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
              <CircularProgress size={16} />
              <Typography variant="caption" color="text.secondary">
                Loading refunds managers...
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color="warning"
          disabled={loading || !selectedManager || managersLoading}
          startIcon={loading ? <CircularProgress size={16} /> : null}
        >
          {loading ? "Marking..." : "Mark as Shaved"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MarkShavedDialog;
