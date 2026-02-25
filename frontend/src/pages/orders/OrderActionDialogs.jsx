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
  Paper,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  FormControlLabel,
  FormHelperText,
  Checkbox,
  Autocomplete,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  History as HistoryIcon,
  Delete as DeleteIcon,
  SwapHoriz as SwapHorizIcon,
  SyncAlt as SyncAltIcon,
  CheckCircle as CheckCircleIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  Close as CloseIcon,
  Cancel as CancelIcon,
  Warning as WarningIcon,
  Restore as RestoreIcon,
} from "@mui/icons-material";
import { LEAD_CHANGE_REASONS, REMOVE_LEAD_REASONS } from "./ordersUtils";

// ── 1. Delete Order Confirmation Dialog ──────────────────────────────
export function DeleteOrderDialog({
  deleteOrderDialog,
  setDeleteOrderDialog,
  onConfirm,
  onCancel,
}) {
  if (!deleteOrderDialog.open) return null;

  return (
    <Dialog
      open
      onClose={onCancel}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        {deleteOrderDialog.permanentDelete
          ? "Permanently Delete Order"
          : "Cancel Order"}
      </DialogTitle>
      <DialogContent>
        {deleteOrderDialog.permanentDelete ? (
          <>
            <Alert severity="error" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>Warning:</strong> This will permanently delete the
                order from the database!
              </Typography>
            </Alert>
            <Typography>
              Are you sure you want to permanently delete this order? This
              action will:
            </Typography>
            <Box sx={{ mt: 2, ml: 2 }}>
              <Typography variant="body2">
                • Permanently remove the order from the database
              </Typography>
              <Typography
                variant="body2"
                sx={{ mt: 1, fontWeight: "bold", color: "error.main" }}
              >
                This action cannot be undone!
              </Typography>
              <Typography
                variant="body2"
                sx={{ mt: 1, fontStyle: "italic", color: "text.secondary" }}
              >
                Note: All cleanup (removing assignments, releasing leads,
                etc.) was already done when the order was cancelled.
              </Typography>
            </Box>
            {deleteOrderDialog.orderStatus !== "cancelled" && (
              <Box sx={{ mt: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={deleteOrderDialog.permanentDelete}
                      onChange={(e) =>
                        setDeleteOrderDialog((prev) => ({
                          ...prev,
                          permanentDelete: e.target.checked,
                        }))
                      }
                      color="error"
                    />
                  }
                  label={
                    <Typography variant="body2" color="error">
                      I understand this will permanently delete a
                      non-cancelled order
                    </Typography>
                  }
                />
              </Box>
            )}
          </>
        ) : (
          <>
            <Typography>
              Are you sure you want to cancel this order? This action will:
            </Typography>
            <Box sx={{ mt: 2, ml: 2 }}>
              <Typography variant="body2">
                • Mark the order as cancelled
              </Typography>
              <Typography variant="body2">
                • Remove client network assignments
              </Typography>
              <Typography variant="body2">
                • Remove our network assignments
              </Typography>
              <Typography variant="body2">
                • Remove campaign assignments
              </Typography>
              <Typography
                variant="body2"
                sx={{ mt: 1, fontStyle: "italic", color: "text.secondary" }}
              >
                Note: The order will still exist in the database and can be
                permanently deleted later.
              </Typography>
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onCancel}
          disabled={deleteOrderDialog.loading}
        >
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          color="error"
          variant="contained"
          disabled={deleteOrderDialog.loading}
          startIcon={
            deleteOrderDialog.loading ? (
              <CircularProgress size={20} />
            ) : (
              <DeleteIcon />
            )
          }
        >
          {deleteOrderDialog.loading
            ? deleteOrderDialog.permanentDelete
              ? "Permanently Deleting..."
              : "Cancelling..."
            : deleteOrderDialog.permanentDelete
            ? "Permanently Delete"
            : "Cancel Order"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── 2. Remove Lead from Order Dialog ─────────────────────────────────
export function RemoveLeadDialog({
  removeLeadDialog,
  setRemoveLeadDialog,
  allAgents,
  onConfirm,
  onCancel,
}) {
  if (!removeLeadDialog.open) return null;

  return (
    <Dialog
      open
      onClose={onCancel}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Remove Lead from Order</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 2 }}>
          Are you sure you want to remove{" "}
          <strong>{removeLeadDialog.leadName}</strong> from this order? The
          lead will be returned to the pool of available leads.
        </Typography>
        <FormControl fullWidth required error={!removeLeadDialog.reason}>
          <InputLabel id="remove-lead-reason-label">
            Reason for removal *
          </InputLabel>
          <Select
            labelId="remove-lead-reason-label"
            value={removeLeadDialog.reason}
            label="Reason for removal *"
            onChange={(e) =>
              setRemoveLeadDialog((prev) => ({
                ...prev,
                reason: e.target.value,
                customReason:
                  e.target.value !== "Other" ? "" : prev.customReason,
                missingAgentId:
                  e.target.value !== "Agent is missing" ? "" : prev.missingAgentId,
              }))
            }
          >
            {REMOVE_LEAD_REASONS.map((reason) => (
              <MenuItem key={reason} value={reason}>
                {reason}
              </MenuItem>
            ))}
          </Select>
          {!removeLeadDialog.reason && (
            <FormHelperText>Please select a reason</FormHelperText>
          )}
        </FormControl>
        {removeLeadDialog.reason === "Agent is missing" && (
          <FormControl fullWidth required error={!removeLeadDialog.missingAgentId} sx={{ mt: 2 }}>
            <InputLabel id="remove-lead-missing-agent-label">
              Which agent is missing? *
            </InputLabel>
            <Select
              labelId="remove-lead-missing-agent-label"
              value={removeLeadDialog.missingAgentId}
              label="Which agent is missing? *"
              onChange={(e) =>
                setRemoveLeadDialog((prev) => ({
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
            {!removeLeadDialog.missingAgentId && (
              <FormHelperText>Please select an agent</FormHelperText>
            )}
          </FormControl>
        )}
        {removeLeadDialog.reason === "Other" && (
          <TextField
            fullWidth
            required
            label="Please specify the reason *"
            value={removeLeadDialog.customReason}
            onChange={(e) =>
              setRemoveLeadDialog((prev) => ({
                ...prev,
                customReason: e.target.value,
              }))
            }
            error={!removeLeadDialog.customReason.trim()}
            helperText={
              !removeLeadDialog.customReason.trim()
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
          onClick={onCancel}
          disabled={removeLeadDialog.loading}
        >
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          color="error"
          variant="contained"
          disabled={
            removeLeadDialog.loading ||
            !removeLeadDialog.reason ||
            (removeLeadDialog.reason === "Other" &&
              !removeLeadDialog.customReason.trim()) ||
            (removeLeadDialog.reason === "Agent is missing" &&
              !removeLeadDialog.missingAgentId)
          }
          startIcon={
            removeLeadDialog.loading ? (
              <CircularProgress size={20} />
            ) : (
              <DeleteIcon />
            )
          }
        >
          {removeLeadDialog.loading ? "Removing..." : "Remove Lead"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── 3. Order Audit Log Dialog ────────────────────────────────────────
export function OrderAuditLogDialog({
  orderAuditDialog,
  onClose,
}) {
  if (!orderAuditDialog.open) return null;

  const getActionIcon = (actionType) => {
    switch (actionType) {
      case "lead_added":
      case "added_to_order":
        return <AddIcon fontSize="small" color="success" />;
      case "lead_removed":
      case "removed_from_order":
        return <DeleteIcon fontSize="small" color="error" />;
      case "ftd_swapped":
      case "order_ftd_swapped":
        return <SwapHorizIcon fontSize="small" color="warning" />;
      case "lead_type_changed":
        return <SyncAltIcon fontSize="small" color="info" />;
      case "agent_changed":
        return <PersonIcon fontSize="small" color="primary" />;
      case "requester_changed":
        return <PersonIcon fontSize="small" color="secondary" />;
      case "client_broker_changed":
        return <BusinessIcon fontSize="small" color="primary" />;
      case "client_broker_removed":
        return <BusinessIcon fontSize="small" color="error" />;
      case "deposit_confirmed":
        return <CheckCircleIcon fontSize="small" color="success" />;
      case "deposit_unconfirmed":
        return <CancelIcon fontSize="small" color="warning" />;
      case "shaved":
        return <WarningIcon fontSize="small" color="error" />;
      case "unshaved":
        return <RestoreIcon fontSize="small" color="info" />;
      default:
        return <HistoryIcon fontSize="small" />;
    }
  };

  const getActionLabel = (actionType) => {
    switch (actionType) {
      case "lead_added":
      case "added_to_order":
        return "Lead Added";
      case "lead_removed":
      case "removed_from_order":
        return "Lead Removed";
      case "ftd_swapped":
      case "order_ftd_swapped":
        return "FTD Swapped";
      case "lead_type_changed":
        return "Type Changed";
      case "agent_changed":
        return "Agent Changed";
      case "requester_changed":
        return "Requester Changed";
      case "client_broker_changed":
        return "Broker Added";
      case "client_broker_removed":
        return "Broker Removed";
      case "deposit_confirmed":
        return "Deposit Confirmed";
      case "deposit_unconfirmed":
        return "Deposit Unconfirmed";
      case "shaved":
        return "Marked Shaved";
      case "unshaved":
        return "Unmarked Shaved";
      default:
        return actionType;
    }
  };

  const getActionColor = (actionType) => {
    switch (actionType) {
      case "lead_added":
      case "added_to_order":
      case "deposit_confirmed":
        return "success";
      case "lead_removed":
      case "removed_from_order":
      case "shaved":
      case "client_broker_removed":
        return "error";
      case "ftd_swapped":
      case "order_ftd_swapped":
      case "deposit_unconfirmed":
        return "warning";
      case "lead_type_changed":
      case "unshaved":
        return "info";
      case "agent_changed":
      case "client_broker_changed":
        return "primary";
      case "requester_changed":
        return "secondary";
      default:
        return "default";
    }
  };

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
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <HistoryIcon color="primary" />
            <Typography variant="h6">
              Order Audit Log
            </Typography>
            {orderAuditDialog.order && (
              <Chip
                label={`#${orderAuditDialog.order._id?.slice(-8)}`}
                size="small"
                variant="outlined"
              />
            )}
          </Box>
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
        {orderAuditDialog.loading ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              py: 4,
            }}
          >
            <CircularProgress />
          </Box>
        ) : orderAuditDialog.auditLogs.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <Typography color="text.secondary">
              No audit logs found for this order.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {orderAuditDialog.auditLogs.map((log, index) => {
              return (
                <Paper
                  key={index}
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderLeft: 4,
                    borderLeftColor: `${getActionColor(log.action)}.main`,
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      mb: 1,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      {getActionIcon(log.action)}
                      <Chip
                        label={getActionLabel(log.action)}
                        size="small"
                        color={getActionColor(log.action)}
                      />
                      {log.leadName && (
                        <Typography variant="body2" color="text.secondary">
                          - {log.leadName}
                        </Typography>
                      )}
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(log.performedAt).toLocaleString()}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    {log.details}
                  </Typography>
                  {(log.action === "lead_removed" ||
                    log.action === "removed_from_order") &&
                    log.previousValue?.removalReason && (
                      <Alert severity="info" sx={{ mb: 1, py: 0 }}>
                        <Typography variant="body2">
                          <strong>Reason:</strong>{" "}
                          {log.previousValue.removalReason}
                        </Typography>
                      </Alert>
                    )}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 2,
                      flexWrap: "wrap",
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      By:{" "}
                      <strong>
                        {log.performedBy?.fullName ||
                          log.performedBy?.email ||
                          "Unknown"}
                      </strong>
                    </Typography>
                    {log.ipAddress && log.ipAddress !== "unknown" && (
                      <Typography variant="caption" color="text.disabled">
                        IP: {log.ipAddress}
                      </Typography>
                    )}
                    {log.leadEmail && (
                      <Typography variant="caption" color="text.secondary">
                        Email: {log.leadEmail}
                      </Typography>
                    )}
                  </Box>
                </Paper>
              );
            })}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

// ── 4. Edit Planned Date Dialog ──────────────────────────────────────
export function EditPlannedDateDialog({
  editPlannedDateDialog,
  newPlannedDate,
  setNewPlannedDate,
  onSubmit,
  onClose,
}) {
  if (!editPlannedDateDialog.open) return null;

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <EditIcon color="primary" />
          <Typography variant="h6">Edit Planned Date</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <TextField
          label="Planned Date"
          type="date"
          value={newPlannedDate}
          onChange={(e) => setNewPlannedDate(e.target.value)}
          fullWidth
          size="small"
          InputLabelProps={{ shrink: true }}
          inputProps={{
            min: new Date().toISOString().split("T")[0],
          }}
          sx={{ mt: 2 }}
        />
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onClose}
          disabled={editPlannedDateDialog.loading}
        >
          Cancel
        </Button>
        <Button
          onClick={onSubmit}
          variant="contained"
          disabled={!newPlannedDate || editPlannedDateDialog.loading}
        >
          {editPlannedDateDialog.loading ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── 5. Edit Network Configuration Dialog (Admin Only) ────────────────
export function EditNetworkConfigDialog({
  editNetworkConfigDialog,
  newNetworkValue,
  setNewNetworkValue,
  campaigns,
  ourNetworks,
  clientNetworks,
  onSubmit,
  onClose,
}) {
  if (!editNetworkConfigDialog.open) return null;

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <EditIcon color="primary" />
          <Typography variant="h6">
            Edit{" "}
            {editNetworkConfigDialog.field === "campaign"
              ? "Campaign"
              : editNetworkConfigDialog.field === "ourNetwork"
              ? "Our Network"
              : "Client Network"}
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2, mt: 1 }}>
          Changing this will update all leads in the order with the new{" "}
          {editNetworkConfigDialog.field === "campaign"
            ? "campaign"
            : editNetworkConfigDialog.field === "ourNetwork"
            ? "our network"
            : "client network"}
          .
        </Alert>
        {editNetworkConfigDialog.field === "campaign" && (
          <Autocomplete
            value={
              campaigns.find((c) => c._id === newNetworkValue) || null
            }
            onChange={(_, newValue) =>
              setNewNetworkValue(newValue?._id || "")
            }
            options={campaigns}
            getOptionLabel={(option) => option.name || ""}
            isOptionEqualToValue={(option, value) =>
              option._id === value?._id
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Campaign"
                size="small"
                fullWidth
                helperText={`${campaigns.length} campaigns available`}
              />
            )}
            sx={{ mt: 1 }}
          />
        )}
        {editNetworkConfigDialog.field === "ourNetwork" && (
          <Autocomplete
            value={
              ourNetworks.find((n) => n._id === newNetworkValue) || null
            }
            onChange={(_, newValue) =>
              setNewNetworkValue(newValue?._id || "")
            }
            options={ourNetworks}
            getOptionLabel={(option) => option.name || ""}
            isOptionEqualToValue={(option, value) =>
              option._id === value?._id
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Our Network"
                size="small"
                fullWidth
                helperText={`${ourNetworks.length} networks available`}
              />
            )}
            sx={{ mt: 1 }}
          />
        )}
        {editNetworkConfigDialog.field === "clientNetwork" && (
          <Autocomplete
            value={
              clientNetworks.find((n) => n._id === newNetworkValue) || null
            }
            onChange={(_, newValue) =>
              setNewNetworkValue(newValue?._id || "")
            }
            options={clientNetworks}
            getOptionLabel={(option) => option.name || ""}
            isOptionEqualToValue={(option, value) =>
              option._id === value?._id
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Client Network"
                size="small"
                fullWidth
                helperText={`${clientNetworks.length} networks available`}
              />
            )}
            sx={{ mt: 1 }}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onClose}
          disabled={editNetworkConfigDialog.loading}
        >
          Cancel
        </Button>
        <Button
          onClick={onSubmit}
          variant="contained"
          disabled={
            (editNetworkConfigDialog.field === "campaign" && !newNetworkValue) ||
            editNetworkConfigDialog.loading
          }
        >
          {editNetworkConfigDialog.loading ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── 6. Lead Removal Reason Dialog (Bulk) ─────────────────────────────
export function LeadRemovalReasonDialog({
  removalReasonDialog,
  setRemovalReasonDialog,
  selectedLeadsForRemoval,
  removingLeads,
  onConfirm,
  onClose,
}) {
  if (!removalReasonDialog.open) return null;

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown={removingLeads}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <DeleteIcon color="error" />
          <Typography variant="h6">Remove Leads from Order</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 2 }}>
          You are about to remove <strong>{selectedLeadsForRemoval.length} lead(s)</strong> from this order.
          Please select a reason for this action.
        </Typography>
        <FormControl fullWidth required sx={{ mb: 2 }}>
          <InputLabel id="removal-reason-label">Reason for removal *</InputLabel>
          <Select
            labelId="removal-reason-label"
            value={removalReasonDialog.reason}
            label="Reason for removal *"
            onChange={(e) => {
              setRemovalReasonDialog((prev) => ({
                ...prev,
                reason: e.target.value,
                customReason: e.target.value !== "Other" ? "" : prev.customReason,
              }));
            }}
          >
            <MenuItem value="Lead is not sent">Lead is not sent</MenuItem>
            <MenuItem value="Email not working">Email not working</MenuItem>
            <MenuItem value="Phone not working">Phone not working</MenuItem>
            <MenuItem value="One or more leads from this order were already shaved">One or more leads from this order were already shaved</MenuItem>
            <MenuItem value="Lead failed">Lead failed</MenuItem>
            <MenuItem value="Agent is missing">Agent is missing</MenuItem>
            <MenuItem value="Other">Other</MenuItem>
          </Select>
        </FormControl>
        {removalReasonDialog.reason === "Other" && (
          <TextField
            fullWidth
            required
            label="Please specify the reason *"
            value={removalReasonDialog.customReason}
            onChange={(e) => setRemovalReasonDialog((prev) => ({ ...prev, customReason: e.target.value }))}
            multiline
            rows={2}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={removingLeads}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={() => {
            const finalReason = removalReasonDialog.reason === "Other"
              ? removalReasonDialog.customReason
              : removalReasonDialog.reason;
            onConfirm(finalReason);
          }}
          disabled={
            removingLeads ||
            !removalReasonDialog.reason ||
            (removalReasonDialog.reason === "Other" && !removalReasonDialog.customReason.trim())
          }
          startIcon={removingLeads ? <CircularProgress size={20} color="inherit" /> : <DeleteIcon />}
        >
          {removingLeads ? "Removing..." : "Confirm Removal"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
