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
  Alert,
  CircularProgress,
  IconButton,
  Autocomplete,
  Radio,
} from "@mui/material";
import {
  Call as CallIcon,
  CreditCard as CreditCardIcon,
  PlayArrow as PlayArrowIcon,
} from "@mui/icons-material";

export default function PspDepositDialog({
  dialog,
  setDialog,
  onCardIssuerSelect,
  onPspSelect,
  onDepositCallConfirm,
  onClose,
  setNotification,
}) {
  if (!dialog.open) return null;

  return (
      <Dialog
        open
        onClose={onClose}
        maxWidth={dialog.step === 3 ? "md" : "sm"}
        fullWidth
        disableEscapeKeyDown={dialog.loading || dialog.creatingIssuer || dialog.creatingPsp}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <CallIcon color="success" />
            <Typography variant="h6">
              Confirm Deposit - Step {dialog.step} of 3
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {dialog.lead && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Confirming deposit for:
              </Typography>
              <Typography variant="subtitle1" fontWeight="bold">
                {dialog.lead.firstName} {dialog.lead.lastName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {dialog.lead.newEmail || dialog.lead.email}
              </Typography>
            </Box>
          )}

          {/* Step 1: Select Card Issuer */}
          {dialog.step === 1 && (
            <Box>
              <Typography variant="subtitle2" gutterBottom sx={{ mb: 1 }}>
                Select Card Issuer or Create New
              </Typography>
              <Autocomplete
                options={dialog.cardIssuers}
                getOptionLabel={(option) => option.name}
                value={dialog.selectedCardIssuer}
                onChange={(_, newValue) => {
                  setDialog((prev) => ({
                    ...prev,
                    selectedCardIssuer: newValue,
                    newCardIssuerName: "",
                  }));
                }}
                loading={dialog.loading && dialog.cardIssuers.length === 0}
                disabled={dialog.newCardIssuerName.length > 0}
                renderOption={(props, option) => (
                  <li {...props}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <CreditCardIcon fontSize="small" color="primary" />
                      <span>{option.name}</span>
                    </Box>
                  </li>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Select Existing Card Issuer"
                    placeholder="Search Card Issuers..."
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {dialog.loading && dialog.cardIssuers.length === 0 && (
                            <CircularProgress size={20} />
                          )}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
              <Typography variant="body2" sx={{ my: 2, textAlign: "center", color: "text.secondary" }}>
                - OR -
              </Typography>
              <TextField
                fullWidth
                label="Create New Card Issuer"
                placeholder="e.g., Visa, Mastercard, Zen"
                value={dialog.newCardIssuerName}
                onChange={(e) => {
                  setDialog((prev) => ({
                    ...prev,
                    newCardIssuerName: e.target.value,
                    selectedCardIssuer: null,
                  }));
                }}
                disabled={dialog.selectedCardIssuer !== null}
              />
            </Box>
          )}

          {/* Step 2: Select PSP */}
          {dialog.step === 2 && (
            <Box>
              <Box sx={{ mb: 2, p: 1.5, bgcolor: "grey.100", borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Card Issuer:
                </Typography>
                <Typography variant="subtitle1" fontWeight="bold">
                  {dialog.selectedCardIssuer?.name}
                </Typography>
              </Box>
              <Typography variant="subtitle2" gutterBottom sx={{ mb: 1 }}>
                Select PSP or Create New
              </Typography>
              <Autocomplete
                options={dialog.psps}
                getOptionLabel={(option) => option.name}
                value={dialog.selectedPsp}
                onChange={(_, newValue) =>
                  setDialog((prev) => ({
                    ...prev,
                    selectedPsp: newValue,
                    newPspWebsite: "",
                  }))
                }
                loading={dialog.loading}
                disabled={dialog.newPspWebsite.length > 0}
                renderOption={(props, option) => (
                  <li {...props}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <CreditCardIcon fontSize="small" color="primary" />
                      <span>{option.name}</span>
                      {option.cardIssuer?.name && (
                        <Chip label={option.cardIssuer.name} size="small" variant="outlined" sx={{ ml: 1 }} />
                      )}
                    </Box>
                  </li>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Select Existing PSP"
                    placeholder="Search PSPs..."
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {dialog.loading && (
                            <CircularProgress size={20} />
                          )}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
              <Typography variant="body2" sx={{ my: 2, textAlign: "center", color: "text.secondary" }}>
                - OR -
              </Typography>
              <TextField
                fullWidth
                label="Create New PSP"
                placeholder="e.g., https://example.com"
                value={dialog.newPspWebsite}
                onChange={(e) => {
                  setDialog((prev) => ({
                    ...prev,
                    newPspWebsite: e.target.value,
                    selectedPsp: null,
                  }));
                }}
                disabled={dialog.selectedPsp !== null}
              />
              {dialog.selectedPsp && (
                <Box sx={{ mt: 2, p: 2, bgcolor: "success.50", borderRadius: 1, border: "1px solid", borderColor: "success.200" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <CreditCardIcon color="success" />
                    <Typography variant="subtitle1" fontWeight="bold" color="success.main">
                      {dialog.selectedPsp.name}
                    </Typography>
                    <Chip
                      label="Active"
                      color="success"
                      size="small"
                      sx={{ ml: "auto" }}
                    />
                  </Box>
                  {dialog.selectedPsp.website && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {dialog.selectedPsp.website}
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          )}

          {/* Step 3: Select Deposit Call */}
          {dialog.step === 3 && (
            <Box>
              <Box sx={{ mb: 2, p: 1.5, bgcolor: "grey.100", borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Card Issuer: <strong>{dialog.selectedCardIssuer?.name || "\u2014"}</strong>
                  {" | "}
                  PSP: <strong>{dialog.selectedPsp?.name || "\u2014"}</strong>
                </Typography>
              </Box>
              <Typography variant="subtitle2" gutterBottom>
                Select the agent's deposit call
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Choose which call from the agent was the deposit call. A $10.00 deposit call bonus will be created.
              </Typography>

              {dialog.agentCallsLoading ? (
                <Box display="flex" justifyContent="center" alignItems="center" py={4}>
                  <CircularProgress size={24} sx={{ mr: 1 }} />
                  <Typography variant="body2" color="text.secondary">Loading agent calls...</Typography>
                </Box>
              ) : dialog.agentCalls.length === 0 ? (
                <Alert severity="warning">
                  No calls found for this agent in the last 3 months. The agent may not have a CDR code configured.
                </Alert>
              ) : (
                <>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Search by phone number or email..."
                  value={dialog.callSearchQuery}
                  onChange={(e) => setDialog((prev) => ({ ...prev, callSearchQuery: e.target.value }))}
                  sx={{ mb: 1.5 }}
                />
                <Box sx={{ maxHeight: 400, overflow: "auto" }}>
                  {dialog.agentCalls
                    .filter((call) => {
                      const q = (dialog.callSearchQuery || "").toLowerCase().trim();
                      if (!q) return true;
                      return (
                        (call.lineNumber || "").toLowerCase().includes(q) ||
                        (call.sourceNumber || "").toLowerCase().includes(q) ||
                        (call.email || "").toLowerCase().includes(q) ||
                        (call.destinationNumber || "").toLowerCase().includes(q)
                      );
                    })
                    .map((call) => {
                    const isSelected = dialog.selectedCall?.cdrCallId === call.cdrCallId;
                    return (
                      <Paper
                        key={call.cdrCallId}
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          mb: 1,
                          cursor: "pointer",
                          border: isSelected ? "2px solid" : "1px solid",
                          borderColor: isSelected ? "primary.main" : "divider",
                          bgcolor: isSelected ? "primary.50" : "transparent",
                          "&:hover": { bgcolor: isSelected ? "primary.50" : "action.hover" },
                        }}
                        onClick={() =>
                          setDialog((prev) => ({ ...prev, selectedCall: call }))
                        }
                      >
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                              <Typography variant="body2">
                                {new Date(call.callDate).toLocaleString()}
                              </Typography>
                              <Chip
                                label={call.formattedDuration}
                                size="small"
                                color={call.callDuration >= 3600 ? "error" : call.callDuration >= 1800 ? "warning" : "default"}
                                variant="outlined"
                              />
                            </Box>
                            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                              {call.lineNumber || call.sourceNumber} {"\u2192"} {call.email || call.destinationNumber}
                            </Typography>
                          </Box>
                          <Box display="flex" alignItems="center" gap={0.5} sx={{ ml: 1 }}>
                            {call.recordFile && (
                              <IconButton
                                size="small"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  // Revoke previous blob URL
                                  if (dialog.playingRecording?.blobUrl) {
                                    URL.revokeObjectURL(dialog.playingRecording.blobUrl);
                                  }
                                  // Toggle off if clicking same call
                                  if (dialog.playingRecording?.cdrCallId === call.cdrCallId) {
                                    setDialog((prev) => ({ ...prev, playingRecording: null }));
                                    return;
                                  }
                                  try {
                                    const { fetchRecordingBlob } = await import("../../services/callDeclarations");
                                    const blobUrl = await fetchRecordingBlob(call.recordFile);
                                    setDialog((prev) => ({
                                      ...prev,
                                      playingRecording: { cdrCallId: call.cdrCallId, blobUrl },
                                    }));
                                  } catch (err) {
                                    console.error("Failed to load recording:", err);
                                    setNotification({ message: "Failed to load recording", severity: "error" });
                                  }
                                }}
                                color={dialog.playingRecording?.cdrCallId === call.cdrCallId ? "primary" : "default"}
                              >
                                <PlayArrowIcon fontSize="small" />
                              </IconButton>
                            )}
                            <Radio
                              checked={isSelected}
                              size="small"
                              onClick={(e) => e.stopPropagation()}
                              onChange={() =>
                                setDialog((prev) => ({ ...prev, selectedCall: call }))
                              }
                            />
                          </Box>
                        </Box>
                        {dialog.playingRecording?.cdrCallId === call.cdrCallId && (
                          <Box sx={{ mt: 1 }}>
                            <audio
                              controls
                              src={dialog.playingRecording.blobUrl}
                              style={{ width: "100%" }}
                            />
                          </Box>
                        )}
                      </Paper>
                    );
                  })}
                </Box>
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {dialog.step > 1 && (
            <Button
              onClick={() => {
                // Revoke blob URL when going back from step 3
                if (dialog.step === 3 && dialog.playingRecording?.blobUrl) {
                  URL.revokeObjectURL(dialog.playingRecording.blobUrl);
                }
                setDialog((prev) => ({
                  ...prev,
                  step: prev.step - 1,
                  ...(prev.step === 3 ? { selectedCall: null, agentCalls: [], playingRecording: null, callSearchQuery: "" } : {}),
                  ...(prev.step === 2 ? { selectedPsp: null, newPspWebsite: "" } : {}),
                }));
              }}
              disabled={dialog.loading || dialog.creatingPsp || dialog.agentCallsLoading}
            >
              Back
            </Button>
          )}
          <Button
            onClick={onClose}
            disabled={dialog.loading || dialog.creatingIssuer || dialog.creatingPsp}
          >
            Cancel
          </Button>
          {dialog.step === 1 ? (
            <Button
              onClick={onCardIssuerSelect}
              variant="contained"
              disabled={
                (!dialog.selectedCardIssuer && !dialog.newCardIssuerName.trim()) ||
                dialog.loading ||
                dialog.creatingIssuer
              }
              startIcon={dialog.creatingIssuer ? <CircularProgress size={16} /> : null}
            >
              {dialog.creatingIssuer ? "Creating..." : "Next"}
            </Button>
          ) : dialog.step === 2 ? (
            <Button
              onClick={onPspSelect}
              variant="contained"
              disabled={
                (!dialog.selectedPsp && !dialog.newPspWebsite.trim()) ||
                dialog.loading ||
                dialog.creatingPsp
              }
              startIcon={
                dialog.creatingPsp
                  ? <CircularProgress size={16} />
                  : null
              }
            >
              {dialog.creatingPsp ? "Creating PSP..." : "Next"}
            </Button>
          ) : (
            <Button
              onClick={onDepositCallConfirm}
              variant="contained"
              color="success"
              disabled={
                !dialog.selectedCall ||
                dialog.loading
              }
              startIcon={
                dialog.loading
                  ? <CircularProgress size={16} />
                  : <CallIcon />
              }
            >
              {dialog.loading ? "Confirming..." : "Confirm Deposit"}
            </Button>
          )}
        </DialogActions>
      </Dialog>
  );
}
