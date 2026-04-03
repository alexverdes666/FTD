import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  InputAdornment,
  Chip,
} from "@mui/material";
import {
  Warning as WarningIcon,
  Search as SearchIcon,
  Person as PersonIcon,
} from "@mui/icons-material";
import api from "../../services/api";

export default function MandatoryAgentAssignmentModal({
  open,
  orderId,
  unassignedLeads,
  onAllAssigned,
  onLeadsUpdate,
}) {
  const [agents, setAgents] = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [assignments, setAssignments] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch agents on open
  useEffect(() => {
    if (open) {
      fetchAgents();
      setError(null);
      setAssignments({});
    }
  }, [open]);

  const fetchAgents = async () => {
    try {
      setLoadingAgents(true);
      const response = await api.get("/users?role=agent&isActive=true&limit=1000");
      setAgents(response.data.data || []);
    } catch (err) {
      console.error("Failed to fetch agents:", err);
      setError("Failed to load agents");
    } finally {
      setLoadingAgents(false);
    }
  };

  const filteredAgents = agents.filter((agent) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (agent.fullName || "").toLowerCase().includes(q) ||
      (agent.email || "").toLowerCase().includes(q) ||
      (agent.fourDigitCode || "").toLowerCase().includes(q)
    );
  });

  const handleAgentChange = (leadId, agentId) => {
    setAssignments((prev) => ({ ...prev, [leadId]: agentId }));
  };

  const allLeadsAssigned =
    unassignedLeads.length > 0 &&
    unassignedLeads.every((lead) => assignments[lead._id]);

  const handleSubmit = useCallback(async () => {
    if (!allLeadsAssigned) return;

    setSubmitting(true);
    setError(null);

    try {
      // Assign each lead to its selected agent
      const promises = unassignedLeads.map((lead) =>
        api.post("/leads/assign-to-agent", {
          leadIds: [lead._id],
          agentId: assignments[lead._id],
        })
      );

      await Promise.all(promises);
      onAllAssigned();
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to assign agents. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }, [allLeadsAssigned, unassignedLeads, assignments, onAllAssigned]);

  if (!open) return null;

  return (
    <Dialog
      open
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown
      onClose={(_, reason) => {
        // Block all close attempts
        if (reason === "backdropClick" || reason === "escapeKeyDown") return;
      }}
      PaperProps={{
        sx: { borderTop: "4px solid", borderColor: "warning.main" },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          bgcolor: "warning.50",
        }}
      >
        <WarningIcon color="warning" />
        <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>
          Agent Assignment Required
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        <Alert severity="warning" sx={{ mb: 2 }}>
          The following FTD/Filler leads in this order have no agent assigned.
          You must assign an agent to each lead before continuing.
        </Alert>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          size="small"
          placeholder="Search agents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ mb: 2, width: 300 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Lead</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Country</TableCell>
                <TableCell sx={{ fontWeight: 600, minWidth: 250 }}>
                  Assign Agent *
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {unassignedLeads.map((lead) => (
                <TableRow key={lead._id}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {lead.firstName} {lead.lastName}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block" }}
                    >
                      {lead.newEmail}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={lead.leadType?.toUpperCase()}
                      size="small"
                      color={lead.leadType === "ftd" ? "primary" : "secondary"}
                      variant="outlined"
                      sx={{ fontWeight: 600, fontSize: "0.7rem" }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{lead.country || "-"}</Typography>
                  </TableCell>
                  <TableCell>
                    <FormControl
                      fullWidth
                      size="small"
                      error={!assignments[lead._id]}
                    >
                      <InputLabel>Select Agent</InputLabel>
                      <Select
                        value={assignments[lead._id] || ""}
                        label="Select Agent"
                        onChange={(e) =>
                          handleAgentChange(lead._id, e.target.value)
                        }
                        disabled={loadingAgents}
                      >
                        {filteredAgents.map((agent) => (
                          <MenuItem key={agent._id} value={agent._id}>
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                              }}
                            >
                              <PersonIcon
                                fontSize="small"
                                color="action"
                              />
                              {agent.fullName || agent.email}
                              {agent.fourDigitCode && (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  ({agent.fourDigitCode})
                                </Typography>
                              )}
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </TableCell>
                </TableRow>
              ))}
              {unassignedLeads.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    <Typography variant="body2" color="text.secondary">
                      All leads have been assigned!
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ mt: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="body2" color="text.secondary">
            {Object.values(assignments).filter(Boolean).length} of{" "}
            {unassignedLeads.length} leads assigned
          </Typography>
          {loadingAgents && <CircularProgress size={20} />}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: "1px solid", borderColor: "divider" }}>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!allLeadsAssigned || submitting}
          sx={{ px: 4, fontWeight: 600 }}
          startIcon={
            submitting ? <CircularProgress size={18} color="inherit" /> : null
          }
        >
          {submitting ? "Assigning..." : "Assign All Agents"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
