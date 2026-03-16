import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  RadioGroup,
  Radio,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Chip,
  Box,
  CircularProgress,
  Autocomplete,
  TextField,
} from "@mui/material";
import api from "../../services/api";
import { createInjections } from "../../services/injections";
import toast from "react-hot-toast";

const InjectLeadsDialog = ({ open, onClose, leads, orderId, onSuccess }) => {
  const [step, setStep] = useState("choose"); // "choose" | "select"
  const [injectionType, setInjectionType] = useState(""); // "self" | "agent"
  const [selectedLeads, setSelectedLeads] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const [workingHours, setWorkingHours] = useState("");

  // Agent selection for cold leads (leadId -> agentId)
  const [coldAgentMap, setColdAgentMap] = useState({});
  const [agents, setAgents] = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(false);

  // Fetch agents when opening the "agent" selection step
  useEffect(() => {
    if (step === "select" && injectionType === "agent" && agents.length === 0) {
      setLoadingAgents(true);
      api
        .get("/users?role=agent&limit=1000")
        .then((res) => setAgents(res.data.data || []))
        .catch(() => {})
        .finally(() => setLoadingAgents(false));
    }
  }, [step, injectionType, agents.length]);

  // Filter leads based on injection type
  const selectableLeads = useMemo(() => {
    if (!leads) return [];
    if (injectionType === "self") {
      return leads;
    }
    // Agent injection: FTD/filler with assigned agents + all colds
    return leads.filter((lead) => {
      if (lead.leadType === "cold") return true;
      if (["ftd", "filler"].includes(lead.leadType)) {
        return !!lead.assignedAgent;
      }
      return false;
    });
  }, [leads, injectionType]);

  // Cold leads in the selectable list
  const coldLeadIds = useMemo(
    () => selectableLeads.filter((l) => l.leadType === "cold").map((l) => l._id),
    [selectableLeads]
  );

  // Bulk-assign all colds to one agent: selects them + sets the agent
  const handleBulkColdAgent = (agent) => {
    if (!agent) return;
    const map = {};
    coldLeadIds.forEach((id) => {
      map[id] = agent._id;
    });
    setColdAgentMap((prev) => ({ ...prev, ...map }));
    // Also make sure all colds are selected
    setSelectedLeads((prev) => {
      const set = new Set(prev);
      coldLeadIds.forEach((id) => set.add(id));
      return [...set];
    });
  };

  const handleNext = () => {
    if (!injectionType) return;
    setStep("select");
    setSelectedLeads([]);
    setColdAgentMap({});
  };

  const handleToggleLead = (leadId) => {
    if (injectionType === "self") {
      setSelectedLeads((prev) =>
        prev.includes(leadId) ? [] : [leadId]
      );
    } else {
      setSelectedLeads((prev) => {
        if (prev.includes(leadId)) {
          // Deselecting — also clear agent assignment
          setColdAgentMap((m) => {
            const copy = { ...m };
            delete copy[leadId];
            return copy;
          });
          return prev.filter((id) => id !== leadId);
        }
        return [...prev, leadId];
      });
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedLeads(selectableLeads.map((l) => l._id));
    } else {
      setSelectedLeads([]);
      setColdAgentMap({});
    }
  };

  // Check if all selected cold leads have an agent assigned
  const allColdsHaveAgent = useMemo(() => {
    if (injectionType !== "agent") return true;
    const selectedColds = selectableLeads.filter(
      (l) => l.leadType === "cold" && selectedLeads.includes(l._id)
    );
    return selectedColds.every((l) => coldAgentMap[l._id]);
  }, [injectionType, selectableLeads, selectedLeads, coldAgentMap]);

  const handleSubmit = async () => {
    if (selectedLeads.length === 0) return;
    if (!allColdsHaveAgent) {
      toast.error("Please assign an agent to all selected cold leads");
      return;
    }
    setSubmitting(true);
    try {
      const res = await createInjections({
        leadIds: selectedLeads,
        orderId,
        injectionType,
        coldAgentMap: injectionType === "agent" ? coldAgentMap : undefined,
        workingHours: injectionType === "agent" && workingHours ? workingHours : undefined,
      });
      if (res.data.success) {
        toast.success(
          `${res.data.data.length} injection${res.data.data.length > 1 ? "s" : ""} created`
        );
        onSuccess?.();
        handleClose();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create injections");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep("choose");
    setInjectionType("");
    setSelectedLeads([]);
    setColdAgentMap({});
    setWorkingHours("");
    setSubmitting(false);
    onClose();
  };

  if (!open) return null;

  return (
    <Dialog open onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {step === "choose"
          ? "Inject Leads"
          : `Select Leads (${injectionType === "self" ? "Self Injection" : "Assign to Agent"})`}
      </DialogTitle>
      <DialogContent dividers>
        {step === "choose" ? (
          <Box sx={{ py: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Choose how you want to handle the injection:
            </Typography>
            <RadioGroup
              value={injectionType}
              onChange={(e) => setInjectionType(e.target.value)}
            >
              <FormControlLabel
                value="self"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body1" fontWeight={500}>
                      Inject Myself
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      You will handle the injection yourself. Select one lead.
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="agent"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body1" fontWeight={500}>
                      Assign to Agent
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Assign injection to the lead's agent. Select multiple
                      leads (FTD & Filler).
                    </Typography>
                  </Box>
                }
              />
            </RadioGroup>
          </Box>
        ) : (
          <Box>
            {injectionType === "agent" && (
              <TextField
                size="small"
                label="Working Hours"
                placeholder="e.g. 09:00 - 17:00"
                value={workingHours}
                onChange={(e) => setWorkingHours(e.target.value)}
                fullWidth
                sx={{ mb: 1 }}
              />
            )}
            {injectionType === "agent" && coldLeadIds.length > 0 && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
                  Assign all colds to:
                </Typography>
                <Autocomplete
                  size="small"
                  options={agents}
                  loading={loadingAgents}
                  getOptionLabel={(o) => o.fullName || ""}
                  onChange={(_, val) => handleBulkColdAgent(val)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Select agent"
                      variant="outlined"
                    />
                  )}
                  isOptionEqualToValue={(o, v) => o._id === v._id}
                  sx={{ minWidth: 220 }}
                />
              </Box>
            )}
            <TableContainer sx={{ maxHeight: 400 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: "bold", width: 40 }}>
                      {injectionType === "agent" && (
                        <Checkbox
                          size="small"
                          checked={
                            selectedLeads.length === selectableLeads.length &&
                            selectableLeads.length > 0
                          }
                          indeterminate={
                            selectedLeads.length > 0 &&
                            selectedLeads.length < selectableLeads.length
                          }
                          onChange={handleSelectAll}
                        />
                      )}
                    </TableCell>
                    <TableCell sx={{ fontWeight: "bold" }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: "bold" }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: "bold" }}>Country</TableCell>
                    <TableCell sx={{ fontWeight: "bold", minWidth: 180 }}>
                      Agent
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectableLeads.map((lead) => {
                    const isSelected = selectedLeads.includes(lead._id);
                    const isCold = lead.leadType === "cold";
                    const needsAgentPicker =
                      injectionType === "agent" && isCold && isSelected;

                    return (
                      <TableRow
                        key={lead._id}
                        hover
                        onClick={() => handleToggleLead(lead._id)}
                        sx={{ cursor: "pointer" }}
                        selected={isSelected}
                      >
                        <TableCell>
                          <Checkbox
                            size="small"
                            checked={isSelected}
                            onChange={() => handleToggleLead(lead._id)}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={lead.leadType?.toUpperCase()}
                            size="small"
                            color={
                              lead.leadType === "ftd"
                                ? "success"
                                : lead.leadType === "filler"
                                ? "warning"
                                : "info"
                            }
                            sx={{ height: 20, fontSize: "0.65rem" }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {lead.firstName} {lead.lastName}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {lead.country}
                          </Typography>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {needsAgentPicker ? (
                            <Autocomplete
                              size="small"
                              options={agents}
                              loading={loadingAgents}
                              getOptionLabel={(o) => o.fullName || ""}
                              value={
                                agents.find(
                                  (a) => a._id === coldAgentMap[lead._id]
                                ) || null
                              }
                              onChange={(_, val) =>
                                setColdAgentMap((m) => ({
                                  ...m,
                                  [lead._id]: val?._id || null,
                                }))
                              }
                              renderInput={(params) => (
                                <TextField
                                  {...params}
                                  placeholder="Select agent"
                                  variant="outlined"
                                  sx={{ minWidth: 160 }}
                                />
                              )}
                              disableClearable={false}
                              isOptionEqualToValue={(o, v) => o._id === v._id}
                            />
                          ) : (
                            <Typography
                              variant="body2"
                              color={
                                lead.assignedAgent
                                  ? "text.primary"
                                  : "text.disabled"
                              }
                            >
                              {lead.assignedAgent?.fullName || "Unassigned"}
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {selectableLeads.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                        <Typography color="text.secondary">
                          No eligible leads found
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            {selectedLeads.length > 0 && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 1 }}
              >
                {selectedLeads.length} lead
                {selectedLeads.length > 1 ? "s" : ""} selected
              </Typography>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        {step === "select" && (
          <Button onClick={() => setStep("choose")} sx={{ mr: "auto" }}>
            Back
          </Button>
        )}
        <Button onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
        {step === "choose" ? (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={!injectionType}
          >
            Next
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={
              selectedLeads.length === 0 || submitting || !allColdsHaveAgent
            }
            startIcon={
              submitting ? (
                <CircularProgress size={16} color="inherit" />
              ) : null
            }
          >
            {submitting ? "Creating..." : "Create Injection"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default InjectLeadsDialog;
