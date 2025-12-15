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
  CircularProgress,
  Alert,
  Box,
  Typography,
  Chip,
} from "@mui/material";
import { Person as PersonIcon, Phone as PhoneIcon } from "@mui/icons-material";
import api from "../services/api";

const AssignDepositCallDialog = ({ open, onClose, onAssign, order, lead }) => {
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      fetchAgents();
      setSelectedAgent("");
      setError("");
    }
  }, [open]);

  const fetchAgents = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/users", {
        params: { role: "agent", limit: 1000 },
      });
      setAgents(response.data.data || []);
    } catch (err) {
      console.error("Error fetching agents:", err);
      setError("Failed to load agents");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedAgent) {
      setError("Please select an agent");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await onAssign(order._id, lead._id, selectedAgent);
      onClose();
    } catch (err) {
      console.error("Error assigning deposit call:", err);
      setError(err.response?.data?.message || "Failed to assign deposit call");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Assign Deposit Call to Agent</DialogTitle>
      <DialogContent>
        {lead && (
          <Box
            sx={{
              mb: 3,
              p: 2,
              bgcolor: "background.paper",
              borderRadius: 1,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              FTD Lead Details
            </Typography>
            <Typography variant="body1" fontWeight="bold">
              {lead.firstName} {lead.lastName}
            </Typography>
            <Box sx={{ display: "flex", gap: 1, mt: 1, flexWrap: "wrap" }}>
              <Chip
                icon={<PersonIcon />}
                label={lead.newEmail}
                size="small"
                variant="outlined"
              />
              {lead.newPhone && (
                <Chip
                  icon={<PhoneIcon />}
                  label={lead.newPhone}
                  size="small"
                  variant="outlined"
                />
              )}
            </Box>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <FormControl fullWidth>
            <InputLabel id="agent-select-label">Select Agent</InputLabel>
            <Select
              labelId="agent-select-label"
              id="agent-select"
              value={selectedAgent}
              label="Select Agent"
              onChange={(e) => setSelectedAgent(e.target.value)}
            >
              <MenuItem value="">
                <em>Select an agent...</em>
              </MenuItem>
              {agents.map((agent) => (
                <MenuItem key={agent._id} value={agent._id}>
                  <Box>
                    <Typography variant="body1">{agent.fullName}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {agent.email}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            This will create a deposit call record for this FTD lead and assign
            it to the selected agent. The agent will be able to see and manage
            this deposit call in the Deposit Calls page.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="primary"
          disabled={!selectedAgent || submitting || loading}
          startIcon={submitting && <CircularProgress size={16} />}
        >
          {submitting ? "Assigning..." : "Assign"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AssignDepositCallDialog;
