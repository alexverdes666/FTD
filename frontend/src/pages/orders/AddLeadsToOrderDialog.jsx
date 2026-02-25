import React from "react";
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  CircularProgress,
  Tooltip,
} from "@mui/material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import { LEAD_CHANGE_REASONS } from "./ordersUtils";

// ── 1. Add Leads to Order Dialog (Admin only) ──────────────────────────
export function AddLeadsToOrderDialog({
  dialog,
  onClose,
  addLeadsEmails,
  setAddLeadsEmails,
  addLeadsSearching,
  addLeadsFound,
  onSearch,
  updateAddLeadAgent,
  updateAddLeadType,
  removeAddLead,
  allAgents,
  onSubmit,
  user,
}) {
  if (!dialog.open) return null;

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography variant="h6">
            Add Leads to Order {dialog.order?._id?.slice(-8)}
          </Typography>
          <IconButton
            aria-label="close"
            onClick={onClose}
            size="small"
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Enter email addresses of leads to add (one per line or separated by
            commas/spaces)
          </Typography>
          <TextField
            multiline
            rows={4}
            fullWidth
            placeholder="lead1@example.com&#10;lead2@example.com"
            value={addLeadsEmails}
            onChange={(e) => setAddLeadsEmails(e.target.value)}
            disabled={dialog.loading}
          />
          <Button
            variant="contained"
            sx={{ mt: 1 }}
            onClick={onSearch}
            disabled={addLeadsSearching || !addLeadsEmails.trim()}
            startIcon={
              addLeadsSearching ? (
                <CircularProgress size={16} />
              ) : (
                <SearchIcon />
              )
            }
          >
            {addLeadsSearching ? "Searching..." : "Search Leads"}
          </Button>
        </Box>

        {addLeadsFound.length > 0 && (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Found Leads ({addLeadsFound.length})
              {addLeadsFound.filter((e) => e.canAdd).length <
                addLeadsFound.length && (
                <Typography
                  component="span"
                  variant="caption"
                  color="text.secondary"
                  sx={{ ml: 1 }}
                >
                  ({addLeadsFound.filter((e) => e.canAdd).length} can be added)
                </Typography>
              )}
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Status</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Country</TableCell>
                    <TableCell>Lead Type</TableCell>
                    <TableCell>Agent</TableCell>
                    <TableCell width={50}>Remove</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {addLeadsFound.map((entry, index) => (
                    <TableRow
                      key={entry.lead._id}
                      sx={{
                        bgcolor: !entry.canAdd
                          ? entry.isInOrder || entry.isWrongCountry
                            ? "error.lighter"
                            : "warning.lighter"
                          : "inherit",
                        opacity: !entry.canAdd ? 0.7 : 1,
                      }}
                    >
                      <TableCell>
                        {entry.isInOrder ? (
                          <Tooltip title="This lead is already in this order">
                            <Chip
                              label="In Order"
                              size="small"
                              color="error"
                              sx={{ fontSize: "0.7rem" }}
                            />
                          </Tooltip>
                        ) : entry.isWrongCountry ? (
                          <Tooltip
                            title={`This lead is from ${entry.lead.country}, but order requires ${dialog.order?.countryFilter}`}
                          >
                            <Chip
                              label="Wrong Country"
                              size="small"
                              color="error"
                              sx={{ fontSize: "0.7rem" }}
                            />
                          </Tooltip>
                        ) : entry.isOnCooldown ? (
                          <Tooltip
                            title={`This lead is on cooldown. ${entry.cooldownDaysRemaining} days remaining.`}
                          >
                            <Chip
                              label={`Cooldown (${entry.cooldownDaysRemaining}d)`}
                              size="small"
                              color="warning"
                              sx={{ fontSize: "0.7rem" }}
                            />
                          </Tooltip>
                        ) : (
                          <Chip
                            label="Ready"
                            size="small"
                            color="success"
                            sx={{ fontSize: "0.7rem" }}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {entry.lead.firstName} {entry.lead.lastName}
                      </TableCell>
                      <TableCell>{entry.lead.newEmail}</TableCell>
                      <TableCell>{entry.lead.country}</TableCell>
                      <TableCell>
                        <FormControl size="small" sx={{ minWidth: 100 }}>
                          <Select
                            value={entry.leadType}
                            onChange={(e) =>
                              updateAddLeadType(index, e.target.value)
                            }
                            disabled={dialog.loading || !entry.canAdd}
                          >
                            <MenuItem value="ftd">FTD</MenuItem>
                            <MenuItem value="filler">Filler</MenuItem>
                            <MenuItem value="cold">Cold</MenuItem>
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>
                        <FormControl size="small" sx={{ minWidth: 150 }}>
                          <Select
                            value={entry.agent || ""}
                            onChange={(e) =>
                              updateAddLeadAgent(index, e.target.value)
                            }
                            displayEmpty
                            disabled={dialog.loading || !entry.canAdd}
                          >
                            <MenuItem value="">
                              <em>No Agent</em>
                            </MenuItem>
                            {allAgents.map((agent) => (
                              <MenuItem key={agent._id} value={agent._id}>
                                {agent.fullName}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => removeAddLead(index)}
                          disabled={dialog.loading}
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={dialog.loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={onSubmit}
          disabled={
            dialog.loading ||
            addLeadsFound.filter((e) => e.canAdd).length === 0
          }
          startIcon={<AddIcon />}
        >
          {`Add ${addLeadsFound.filter((e) => e.canAdd).length} Lead(s)`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── 2. Add Leads Confirmation Dialog (Reason Selection) ─────────────────
export function AddLeadsConfirmDialog({
  dialog,
  setDialog,
  allAgents,
  onConfirm,
  onClose,
  addLeadsFound,
}) {
  if (!dialog.open) return null;

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Confirm Adding Leads</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 2 }}>
          You are about to add{" "}
          <strong>{addLeadsFound.filter((e) => e.canAdd).length} lead(s)</strong>{" "}
          to the order. Please select a reason for this action.
        </Typography>
        <FormControl fullWidth required error={!dialog.reason}>
          <InputLabel id="add-leads-confirm-reason-label">
            Reason for adding leads *
          </InputLabel>
          <Select
            labelId="add-leads-confirm-reason-label"
            value={dialog.reason}
            label="Reason for adding leads *"
            onChange={(e) =>
              setDialog((prev) => ({
                ...prev,
                reason: e.target.value,
                customReason:
                  e.target.value !== "Other" ? "" : prev.customReason,
                missingAgentId:
                  e.target.value !== "Agent is missing" ? "" : prev.missingAgentId,
              }))
            }
          >
            {LEAD_CHANGE_REASONS.map((reason) => (
              <MenuItem key={reason} value={reason}>
                {reason}
              </MenuItem>
            ))}
          </Select>
          {!dialog.reason && (
            <FormHelperText>Please select a reason</FormHelperText>
          )}
        </FormControl>
        {dialog.reason === "Agent is missing" && (
          <FormControl fullWidth required error={!dialog.missingAgentId} sx={{ mt: 2 }}>
            <InputLabel id="add-leads-confirm-missing-agent-label">
              Which agent is missing? *
            </InputLabel>
            <Select
              labelId="add-leads-confirm-missing-agent-label"
              value={dialog.missingAgentId}
              label="Which agent is missing? *"
              onChange={(e) =>
                setDialog((prev) => ({
                  ...prev,
                  missingAgentId: e.target.value,
                }))
              }
            >
              {allAgents.map((agent) => (
                <MenuItem key={agent._id} value={agent._id}>
                  {agent.fullName}
                </MenuItem>
              ))}
            </Select>
            {!dialog.missingAgentId && (
              <FormHelperText>Please select an agent</FormHelperText>
            )}
          </FormControl>
        )}
        {dialog.reason === "Other" && (
          <TextField
            fullWidth
            required
            label="Please specify the reason *"
            value={dialog.customReason}
            onChange={(e) =>
              setDialog((prev) => ({
                ...prev,
                customReason: e.target.value,
              }))
            }
            error={!dialog.customReason.trim()}
            helperText={
              !dialog.customReason.trim()
                ? "Please enter a custom reason"
                : ""
            }
            sx={{ mt: 2 }}
            multiline
            rows={2}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onClose}
          disabled={dialog.loading}
        >
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          color="primary"
          variant="contained"
          disabled={
            dialog.loading ||
            !dialog.reason ||
            (dialog.reason === "Other" &&
              !dialog.customReason.trim()) ||
            (dialog.reason === "Agent is missing" &&
              !dialog.missingAgentId)
          }
          startIcon={
            dialog.loading ? (
              <CircularProgress size={20} />
            ) : (
              <AddIcon />
            )
          }
        >
          {dialog.loading ? "Adding..." : "Confirm & Add"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
