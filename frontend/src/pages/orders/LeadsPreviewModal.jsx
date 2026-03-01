import React from "react";
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  MenuItem,
  Menu,
  ListItemIcon,
  CircularProgress,
  Checkbox,
  Tooltip,
  Divider,
  alpha,
} from "@mui/material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  SwapVert as ConvertIcon,
  SwapHoriz as SwapHorizIcon,
  AssignmentInd as AssignIcon,
  CheckCircle as CheckCircleIcon,
  Close as CloseIcon,
  Image as ImageIcon,
  MoreVert as MoreVertIcon,
  Cached as ChangeIcon,
  Call as CallIcon,
  ContentCut as ShavedIcon,
  FormatListBulleted as ListIcon,
  Restore as RestoreIcon,
  Undo as UndoIcon,
  VerifiedUser as VerifiedUserIcon,
  Gavel as GavelIcon,
  Block as ClosedNetworkIcon,
  Label as SetStatusIcon,
} from "@mui/icons-material";
import DocumentPreview from "../../components/DocumentPreview";
import { formatPhoneWithCountryCode } from "../../utils/phoneUtils";
import {
  getDisplayLeadType,
  getFTDCooldownStatus,
  getIPQSStatusConfig,
  buildIPQSTooltip,
  getCountryCode,
} from "./ordersUtils";

const LeadsPreviewModal = ({
  modal,
  user,
  onClose,
  // Lead removal mode
  leadRemovalMode,
  selectedLeadsForRemoval,
  onToggleRemovalMode,
  onToggleLeadSelection,
  onSelectAllForRemoval,
  onRemoveSelected,
  removingLeads,
  // Removal reason dialog
  removalReasonDialog,
  setRemovalReasonDialog,
  onOpenRemovalReasonDialog,
  // Preview actions menu
  previewActionsMenu,
  onOpenPreviewActionsMenu,
  onClosePreviewActionsMenu,
  // IPQS
  ipqsValidationSuccess,
  ipqsValidatingOrders,
  onDirectIPQSValidation,
  onIPQSRecheckLead,
  // Lead actions
  onConfirmDeposit,
  onUnconfirmDeposit,
  onMarkAsShaved,
  onUnmarkAsShaved,
  onMarkAsClosedNetwork,
  onUnmarkAsClosedNetwork,
  onOpenChangeFTD,
  onOpenReplaceLead,
  onConvertLeadType,
  onOpenAssignLead,
  onCopyToClipboard,
  onOpenApplyFine,
  onOpenRemoveLead,
  // Display info dialogs
  onOpenClientBrokersDialog,
  onOpenClientNetworksDialog,
  onOpenOurNetworksDialog,
  onOpenCampaignsDialog,
  // Export / Copy
  onExportLeads,
  onCopyOrderLeads,
  setCopyPreferencesOpen,
  // Add leads
  onOpenAddLeads,
  // Metadata helper
  getLeadWithOrderMetadata,
  // Processing
  processingLeads,
  highlightLeadId,
  // Undo
  undoAction,
  onUndoAction,
  undoing,
  onDismissUndo,
  restoringLead,
  undoingReplacement,
  // Restore / Undo replacement
  onRestoreLead,
  onUndoReplacementFromMenu,
}) => {
  if (!modal.open) return null;

  // Handler for select-all / deselect-all checkbox
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const selectableIds = modal.leads
        .filter(
          (l) =>
            !modal.order?.removedLeads?.find(
              (rl) => rl.leadId === l._id || rl.leadId?._id === l._id
            )
        )
        .map((l) => l._id);
      onSelectAllForRemoval(selectableIds);
    } else {
      onSelectAllForRemoval([]);
    }
  };

  return (
      <Dialog
        open
        onClose={onClose}
        maxWidth="xl"
        fullWidth
        PaperProps={{
          sx: { maxHeight: "90vh" },
        }}
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
              Leads Preview {modal.loading ? "" : `(${modal.leads.length} leads)`}
              {modal.enriching && !modal.loading && (
                <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  Loading details...
                </Typography>
              )}
            </Typography>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              {leadRemovalMode ? (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                    {selectedLeadsForRemoval.length} selected
                  </Typography>
                  <Button
                    size="small"
                    variant="contained"
                    color="error"
                    onClick={onOpenRemovalReasonDialog}
                    disabled={selectedLeadsForRemoval.length === 0 || removingLeads}
                    startIcon={removingLeads ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}
                  >
                    {removingLeads ? "Removing..." : "Remove"}
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={onToggleRemovalMode}
                    disabled={removingLeads}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  {["admin", "affiliate_manager", "lead_manager"].includes(user?.role) && modal.order && (() => {
                    const allLeadsValidated = modal.leads.length > 0 &&
                      modal.leads.every((lead) => lead.ipqsValidation?.validatedAt);
                    const isValidating = ipqsValidatingOrders.includes(modal.orderId);
                    return (
                      <Tooltip title={isValidating ? "Validating..." : allLeadsValidated ? "All leads already validated" : "Validate lead emails and phones with IPQS"}>
                        <span>
                          <IconButton
                            aria-label="IPQS check"
                            onClick={() => onDirectIPQSValidation(modal.orderId, true)}
                            size="small"
                            color="info"
                            disabled={isValidating || allLeadsValidated || modal.enriching}
                          >
                            {isValidating ? (
                              <CircularProgress size={20} color="inherit" />
                            ) : (
                              <VerifiedUserIcon />
                            )}
                          </IconButton>
                        </span>
                      </Tooltip>
                    );
                  })()}
                  {["admin", "affiliate_manager", "lead_manager"].includes(user?.role) && modal.order && modal.leads.length > 0 && (
                    <Tooltip title={modal.enriching ? "Loading details..." : "Remove leads from this order"}>
                      <span>
                      <IconButton
                        aria-label="remove leads"
                        onClick={onToggleRemovalMode}
                        size="small"
                        disabled={modal.enriching}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                      </span>
                    </Tooltip>
                  )}
                  {["admin", "affiliate_manager"].includes(user?.role) && modal.order && (
                    <Tooltip title={modal.enriching ? "Loading details..." : "Add leads to this order"}>
                      <span>
                      <IconButton
                        aria-label="add leads"
                        onClick={() => onOpenAddLeads(modal.order)}
                        size="small"
                        color="primary"
                        disabled={modal.enriching}
                      >
                        <AddIcon />
                      </IconButton>
                      </span>
                    </Tooltip>
                  )}
                </>
              )}
              <IconButton
                aria-label="close"
                onClick={onClose}
                size="small"
              >
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 1, overflow: "auto" }}>
          {modal.loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 200 }}>
              <CircularProgress />
            </Box>
          ) : (
          <TableContainer
            sx={{ maxHeight: "calc(90vh - 180px)", overflow: "auto" }}
          >
            <Table
              size="small"
              stickyHeader
              sx={{ tableLayout: "auto", minWidth: 900, border: "1px solid rgba(100,150,255,0.4)", "& td, & th": { border: "1px solid rgba(100,150,255,0.4)" } }}
            >
              <TableHead>
                <TableRow>
                  {leadRemovalMode && (
                    <TableCell
                      sx={{
                        fontWeight: "bold",
                        backgroundColor: "grey.100",
                        py: 0.5,
                        px: 0.5,
                        width: 40,
                      }}
                    >
                      <Checkbox
                        size="small"
                        checked={selectedLeadsForRemoval.length === modal.leads.filter(l => !modal.order?.removedLeads?.find(rl => rl.leadId === l._id || rl.leadId?._id === l._id)).length && selectedLeadsForRemoval.length > 0}
                        indeterminate={selectedLeadsForRemoval.length > 0 && selectedLeadsForRemoval.length < modal.leads.filter(l => !modal.order?.removedLeads?.find(rl => rl.leadId === l._id || rl.leadId?._id === l._id)).length}
                        onChange={handleSelectAll}
                      />
                    </TableCell>
                  )}
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      backgroundColor: "grey.100",
                      whiteSpace: "nowrap",
                      py: 0.5,
                      px: 0.5,
                      fontSize: "0.75rem",
                      textAlign: "center",
                      width: 52,
                    }}
                  >
                    Type
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      backgroundColor: "grey.100",
                      whiteSpace: "nowrap",
                      py: 0.5,
                      px: 1,
                      fontSize: "0.75rem",
                    }}
                  >
                    Name
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      backgroundColor: "grey.100",
                      whiteSpace: "nowrap",
                      py: 0.5,
                      px: 1,
                      fontSize: "0.75rem",
                    }}
                  >
                    Status
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      backgroundColor: "grey.100",
                      whiteSpace: "nowrap",
                      py: 0.5,
                      px: 1,
                      fontSize: "0.75rem",
                    }}
                  >
                    Phone
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      backgroundColor: "grey.100",
                      whiteSpace: "nowrap",
                      py: 0.5,
                      px: 1,
                      fontSize: "0.75rem",
                    }}
                  >
                    Email
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      backgroundColor: "grey.100",
                      whiteSpace: "nowrap",
                      py: 0.5,
                      px: 1,
                      fontSize: "0.75rem",
                    }}
                  >
                    Agent
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      backgroundColor: "grey.100",
                      whiteSpace: "nowrap",
                      textAlign: "center",
                      py: 0.5,
                      px: 0.5,
                      fontSize: "0.75rem",
                    }}
                  >
                    Docs
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      backgroundColor: "grey.100",
                      whiteSpace: "nowrap",
                      py: 0.5,
                      px: 1,
                      fontSize: "0.75rem",
                    }}
                  >
                    Broker
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      backgroundColor: "grey.100",
                      whiteSpace: "nowrap",
                      py: 0.5,
                      px: 1,
                      fontSize: "0.75rem",
                    }}
                  >
                    Client Network
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      backgroundColor: "grey.100",
                      whiteSpace: "nowrap",
                      py: 0.5,
                      px: 1,
                      fontSize: "0.75rem",
                    }}
                  >
                    Our Network
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      backgroundColor: "grey.100",
                      whiteSpace: "nowrap",
                      py: 0.5,
                      px: 1,
                      fontSize: "0.75rem",
                    }}
                  >
                    Campaign
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      backgroundColor: "grey.100",
                      whiteSpace: "nowrap",
                      py: 0.5,
                      px: 0.5,
                      fontSize: "0.75rem",
                      textAlign: "center",
                    }}
                  >
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {modal.leads.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={13}
                      align="center"
                    >
                      <Typography color="text.secondary" variant="body2">
                        No leads found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  [...modal.leads].sort((a, b) => {
                    const typePriority = { ftd: 0, filler: 1, cold: 2 };
                    const typeA = getDisplayLeadType(getLeadWithOrderMetadata(a, modal.order));
                    const typeB = getDisplayLeadType(getLeadWithOrderMetadata(b, modal.order));
                    return (typePriority[typeA] ?? 3) - (typePriority[typeB] ?? 3);
                  }).map((originalLead, index) => {
                    // Merge order metadata into lead for correct deposit/shaved status
                    const lead = getLeadWithOrderMetadata(originalLead, modal.order);
                    const leadType = getDisplayLeadType(lead);
                    const documents = Array.isArray(lead.documents) ? lead.documents.filter(doc => doc.url) : [];

                    // Check if lead is removed
                    const removedInfo = modal.order?.removedLeads?.find(
                      (rl) => rl.leadId === lead._id || rl.leadId?._id === lead._id
                    );
                    const isRemoved = !!removedInfo;

                    return (
                      <Tooltip
                        key={lead._id || index}
                        title={
                          isRemoved
                            ? `Removed: ${removedInfo.reason}${
                                removedInfo.removedBy?.fullName
                                  ? ` (by ${removedInfo.removedBy.fullName})`
                                  : ""
                              }${
                                removedInfo.removedAt
                                  ? ` on ${new Date(removedInfo.removedAt).toLocaleString()}`
                                  : ""
                              }`
                            : ""
                        }
                        arrow
                        placement="top"
                        disableHoverListener={!isRemoved}
                      >
                        <TableRow
                          hover={!isRemoved}
                          sx={{
                            "& td": { py: 0.5 },
                            ...(!isRemoved && { "&:hover": { backgroundColor: (theme) => `${alpha(theme.palette.primary.main, 0.08)} !important` } }),
                            ...(highlightLeadId && lead._id === highlightLeadId && !isRemoved && {
                              backgroundColor: (theme) => alpha(theme.palette.warning.main, 0.15),
                              "&:hover": { backgroundColor: (theme) => `${alpha(theme.palette.warning.main, 0.22)} !important` },
                            }),
                            ...(isRemoved && {
                              backgroundColor: "action.disabledBackground",
                              opacity: 0.6,
                              "& *": {
                                textDecoration: "line-through",
                                color: "text.disabled",
                              },
                              "& .MuiChip-root": {
                                opacity: 0.5,
                              },
                            }),
                          }}
                        >
                        {/* Checkbox for removal selection */}
                        {leadRemovalMode && (
                          <TableCell sx={{ py: 0.5, px: 0.5 }}>
                            <Checkbox
                              size="small"
                              checked={selectedLeadsForRemoval.includes(lead._id)}
                              onChange={() => onToggleLeadSelection(lead._id)}
                              disabled={isRemoved}
                            />
                          </TableCell>
                        )}
                        {/* Type */}
                        <TableCell sx={{ py: 0.5, px: 0.5, textAlign: "center", width: 52 }}>
                          <Chip
                            label={leadType?.toUpperCase() || "N/A"}
                            size="small"
                            color={
                              leadType === "ftd"
                                ? "success"
                                : leadType === "filler"
                                ? "warning"
                                : leadType === "cold"
                                ? "info"
                                : "default"
                            }
                            sx={{
                              height: 18,
                              fontSize: "0.6rem",
                              "& .MuiChip-label": {
                                padding: "0 4px",
                              },
                            }}
                          />
                        </TableCell>
                        {/* Name */}
                        <TableCell sx={{ py: 0.5, px: 1, position: "relative" }}>
                          {/* IPQS Validation Success Indicator - overlays on top */}
                          {ipqsValidationSuccess.includes(lead._id) && (
                            <Box
                              sx={{
                                position: "absolute",
                                top: "50%",
                                left: "50%",
                                transform: "translate(-50%, -50%)",
                                zIndex: 10,
                                animation: "ipqsCheckFadeInOut 2s ease-in-out",
                                "@keyframes ipqsCheckFadeInOut": {
                                  "0%": { opacity: 0, transform: "translate(-50%, -50%) scale(0.5)" },
                                  "15%": { opacity: 1, transform: "translate(-50%, -50%) scale(1.3)" },
                                  "30%": { opacity: 1, transform: "translate(-50%, -50%) scale(1)" },
                                  "85%": { opacity: 1 },
                                  "100%": { opacity: 0 },
                                },
                              }}
                            >
                              <CheckCircleIcon sx={{ color: "success.main", fontSize: 32 }} />
                            </Box>
                          )}
                          <Typography
                            variant="body2"
                            sx={{ whiteSpace: "nowrap", fontSize: "0.75rem" }}
                          >
                            {lead.firstName} {lead.lastName}
                          </Typography>
                        </TableCell>
                        {/* Status */}
                        <TableCell sx={{ py: 0.5, px: 1 }}>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 0.5,
                              flexWrap: "wrap",
                            }}
                          >
                            {isRemoved && (
                              <Chip
                                label="Removed"
                                size="small"
                                sx={{
                                  height: 18,
                                  fontSize: "0.6rem",
                                  backgroundColor: "grey.500",
                                  color: "white",
                                  textDecoration: "none !important",
                                  "& .MuiChip-label": {
                                    padding: "0 4px",
                                    textDecoration: "none !important",
                                  },
                                }}
                              />
                            )}
                            {lead.depositConfirmed && !isRemoved && (
                              <Tooltip
                                title={
                                  lead.depositPSP ? (
                                    <Box sx={{ p: 0.5 }}>
                                      <Typography variant="caption" sx={{ fontWeight: 600, display: "block" }}>
                                        PSP: {lead.depositPSP.name || lead.depositPSP}
                                      </Typography>
                                      {lead.depositPSP.website && (
                                        <Typography variant="caption" sx={{ display: "block", color: "rgba(255,255,255,0.8)" }}>
                                          {lead.depositPSP.website}
                                        </Typography>
                                      )}
                                    </Box>
                                  ) : "Deposit Confirmed"
                                }
                                arrow
                                placement="top"
                              >
                                <Chip
                                  label={lead.depositPSP?.name ? `Deposit (${lead.depositPSP.name})` : "Deposit Confirmed"}
                                  size="small"
                                  color="success"
                                  sx={{
                                    height: 18,
                                    fontSize: "0.6rem",
                                    maxWidth: 150,
                                    "& .MuiChip-label": {
                                      padding: "0 4px",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    },
                                  }}
                                />
                              </Tooltip>
                            )}
                            {lead.shaved && !isRemoved && (
                              <Chip
                                label="Shaved"
                                size="small"
                                color="error"
                                sx={{
                                  height: 18,
                                  fontSize: "0.6rem",
                                  "& .MuiChip-label": {
                                    padding: "0 4px",
                                  },
                                }}
                              />
                            )}
                            {lead.closedNetwork && !isRemoved && (
                              <Chip
                                label="Closed Net"
                                size="small"
                                color="warning"
                                sx={{
                                  height: 18,
                                  fontSize: "0.6rem",
                                  "& .MuiChip-label": {
                                    padding: "0 4px",
                                  },
                                }}
                              />
                            )}
                            {!lead.depositConfirmed && !lead.shaved && !lead.closedNetwork && !isRemoved && (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ fontSize: "0.75rem", width: "100%", textAlign: "center" }}
                              >
                                -
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
                        {/* Phone */}
                        <TableCell sx={{ py: 0.5, px: 1 }}>
                          {(() => {
                            const phoneValue = formatPhoneWithCountryCode(lead.newPhone || lead.phone, lead.country);
                            const phoneStatus = lead.ipqsValidation?.summary?.phoneStatus;
                            const statusConfig = phoneStatus ? getIPQSStatusConfig(phoneStatus) : null;
                            return (
                              <Tooltip
                                title={lead.ipqsValidation ? buildIPQSTooltip(lead.ipqsValidation, "phone") : "Not validated"}
                                arrow
                                placement="top"
                              >
                                <Typography
                                  variant="body2"
                                  sx={{
                                    whiteSpace: "nowrap",
                                    fontSize: "0.75rem",
                                    ...(!phoneValue && { textAlign: "center" }),
                                    ...(statusConfig && {
                                      backgroundColor: `${statusConfig.bgcolor} !important`,
                                      color: "#212121 !important",
                                      fontWeight: 500,
                                      px: 0.5,
                                      py: 0.25,
                                      borderRadius: 0.5,
                                      borderLeft: `3px solid ${statusConfig.color}`,
                                    }),
                                    textDecoration: isRemoved ? "line-through !important" : "none",
                                  }}
                                >
                                  {phoneValue || "-"}
                                </Typography>
                              </Tooltip>
                            );
                          })()}
                        </TableCell>
                        {/* Email */}
                        <TableCell sx={{ py: 0.5, px: 1 }}>
                          {(() => {
                            const emailValue = lead.newEmail || lead.email;
                            const emailStatus = lead.ipqsValidation?.summary?.emailStatus;
                            const statusConfig = emailStatus ? getIPQSStatusConfig(emailStatus) : null;
                            return (
                              <Tooltip
                                title={lead.ipqsValidation ? buildIPQSTooltip(lead.ipqsValidation, "email") : "Not validated"}
                                arrow
                                placement="top"
                              >
                                <Typography
                                  variant="body2"
                                  sx={{
                                    fontSize: "0.7rem",
                                    maxWidth: 180,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    ...(!emailValue && { textAlign: "center" }),
                                    ...(statusConfig && {
                                      backgroundColor: `${statusConfig.bgcolor} !important`,
                                      color: "#212121 !important",
                                      fontWeight: 500,
                                      px: 0.5,
                                      py: 0.25,
                                      borderRadius: 0.5,
                                      borderLeft: `3px solid ${statusConfig.color}`,
                                    }),
                                    textDecoration: isRemoved ? "line-through !important" : "none",
                                  }}
                                >
                                  {emailValue || "-"}
                                </Typography>
                              </Tooltip>
                            );
                          })()}
                        </TableCell>
                        {/* Assigned Agent */}
                        <TableCell sx={{ py: 0.5, px: 1 }}>
                          <Typography
                            variant="body2"
                            sx={{ whiteSpace: "nowrap", fontSize: "0.75rem", ...(!lead.assignedAgent?.fullName && { textAlign: "center" }) }}
                          >
                            {lead.assignedAgent?.fullName || "-"}
                          </Typography>
                        </TableCell>
                        {/* Documents */}
                        <TableCell align="center" sx={{ py: 0.5, px: 0.5 }}>
                          {documents.length > 0 ? (
                            <Box sx={{ display: "flex", gap: 0.25, justifyContent: "center" }}>
                              {documents.map((doc, idx) => (
                                <DocumentPreview
                                  key={idx}
                                  url={doc.url}
                                  type={doc.description || `Doc ${idx + 1}`}
                                  forceImage
                                >
                                  <Tooltip title={doc.description || `Doc ${idx + 1}`} arrow placement="top">
                                    <ImageIcon
                                      sx={{
                                        fontSize: 16,
                                        color: "primary.main",
                                        cursor: "pointer",
                                      }}
                                    />
                                  </Tooltip>
                                </DocumentPreview>
                              ))}
                            </Box>
                          ) : (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ fontSize: "0.75rem" }}
                            >
                              -
                            </Typography>
                          )}
                        </TableCell>
                        {/* Client Broker */}
                        <TableCell sx={{ py: 0.5, px: 1 }}>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 0.5,
                            }}
                          >
                            {(() => {
                              const brokerValue = (lead.clientBrokerHistory?.length > 0
                                ? (lead.clientBrokerHistory.find(h => h.orderId === modal.orderId || h.orderId?._id === modal.orderId) || lead.clientBrokerHistory[lead.clientBrokerHistory.length - 1])?.clientBroker?.name
                                : null) ||
                                (lead.assignedClientBrokers?.length > 0
                                  ? lead.assignedClientBrokers[lead.assignedClientBrokers.length - 1]?.name
                                  : null) ||
                                lead.clientBroker;
                              return (
                              <Typography
                              variant="body2"
                              sx={{ whiteSpace: "nowrap", fontSize: "0.75rem", ...(!brokerValue && { width: "100%", textAlign: "center" }) }}
                            >
                              {brokerValue || "-"}
                            </Typography>
                              );
                            })()}
                            {lead.assignedClientBrokers &&
                              lead.assignedClientBrokers.length > 0 && (
                                <Tooltip title="View all client brokers">
                                  <IconButton
                                    size="small"
                                    onClick={() =>
                                      onOpenClientBrokersDialog(
                                        lead.assignedClientBrokers,
                                        `${lead.firstName} ${lead.lastName}`
                                      )
                                    }
                                    sx={{ p: 0.25 }}
                                  >
                                    <ListIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Tooltip>
                              )}
                          </Box>
                        </TableCell>
                        {/* Client Network */}
                        <TableCell sx={{ py: 0.5, px: 1 }}>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 0.5,
                            }}
                          >
                            {(() => {
                              const cnValue = modal.order?.selectedClientNetwork?.name
                                || (lead.clientNetworkHistory?.length > 0
                                  ? (lead.clientNetworkHistory.find(h => h.orderId === modal.orderId || h.orderId?._id === modal.orderId) || lead.clientNetworkHistory[lead.clientNetworkHistory.length - 1])?.clientNetwork?.name
                                  : null);
                              return (
                                <Typography
                                  variant="body2"
                                  sx={{ whiteSpace: "nowrap", fontSize: "0.75rem", ...(!cnValue && { width: "100%", textAlign: "center" }) }}
                                >
                                  {cnValue || "-"}
                                </Typography>
                              );
                            })()}
                            {lead.clientNetworkHistory &&
                              lead.clientNetworkHistory.length > 0 && (
                                <Tooltip title="View all client networks">
                                  <IconButton
                                    size="small"
                                    onClick={() =>
                                      onOpenClientNetworksDialog(
                                        lead.clientNetworkHistory,
                                        `${lead.firstName} ${lead.lastName}`
                                      )
                                    }
                                    sx={{ p: 0.25 }}
                                  >
                                    <ListIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Tooltip>
                              )}
                          </Box>
                        </TableCell>
                        {/* Our Network */}
                        <TableCell sx={{ py: 0.5, px: 1 }}>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 0.5,
                            }}
                          >
                            {(() => {
                              const onValue = modal.order?.selectedOurNetwork?.name
                                || (lead.ourNetworkHistory?.length > 0
                                  ? (lead.ourNetworkHistory.find(h => h.orderId === modal.orderId || h.orderId?._id === modal.orderId) || lead.ourNetworkHistory[lead.ourNetworkHistory.length - 1])?.ourNetwork?.name
                                  : null);
                              return (
                                <Typography
                                  variant="body2"
                                  sx={{ whiteSpace: "nowrap", fontSize: "0.75rem", ...(!onValue && { width: "100%", textAlign: "center" }) }}
                                >
                                  {onValue || "-"}
                                </Typography>
                              );
                            })()}
                            {lead.ourNetworkHistory &&
                              lead.ourNetworkHistory.length > 0 && (
                                <Tooltip title="View all our networks">
                                  <IconButton
                                    size="small"
                                    onClick={() =>
                                      onOpenOurNetworksDialog(
                                        lead.ourNetworkHistory,
                                        `${lead.firstName} ${lead.lastName}`
                                      )
                                    }
                                    sx={{ p: 0.25 }}
                                  >
                                    <ListIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Tooltip>
                              )}
                          </Box>
                        </TableCell>
                        {/* Campaign */}
                        <TableCell sx={{ py: 0.5, px: 1 }}>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 0.5,
                            }}
                          >
                            {(() => {
                              const campValue = modal.order?.selectedCampaign?.name
                                || (lead.campaignHistory?.length > 0
                                  ? (lead.campaignHistory.find(h => h.orderId === modal.orderId || h.orderId?._id === modal.orderId) || lead.campaignHistory[lead.campaignHistory.length - 1])?.campaign?.name
                                  : null);
                              return (
                                <Typography
                                  variant="body2"
                                  sx={{ whiteSpace: "nowrap", fontSize: "0.75rem", ...(!campValue && { width: "100%", textAlign: "center" }) }}
                                >
                                  {campValue || "-"}
                                </Typography>
                              );
                            })()}
                            {lead.campaignHistory &&
                              lead.campaignHistory.length > 0 && (
                                <Tooltip title="View all campaigns">
                                  <IconButton
                                    size="small"
                                    onClick={() =>
                                      onOpenCampaignsDialog(
                                        lead.campaignHistory,
                                        `${lead.firstName} ${lead.lastName}`
                                      )
                                    }
                                    sx={{ p: 0.25 }}
                                  >
                                    <ListIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Tooltip>
                              )}
                          </Box>
                        </TableCell>
                        {/* Actions */}
                        <TableCell sx={{ py: 0.5, px: 0.5, textAlign: "center" }}>
                          <IconButton
                            size="small"
                            onClick={(e) => onOpenPreviewActionsMenu(e, lead)}
                            sx={{ p: 0.25 }}
                          >
                            {isRemoved ? (
                              <RestoreIcon sx={{ fontSize: 18, color: "info.main" }} />
                            ) : (
                              <MoreVertIcon sx={{ fontSize: 18 }} />
                            )}
                          </IconButton>
                        </TableCell>
                      </TableRow>
                      </Tooltip>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} variant="outlined">
            Close
          </Button>
        </DialogActions>

        {/* Actions Menu for Preview Modal */}
        <Menu
          anchorEl={previewActionsMenu.anchorEl}
          open={Boolean(previewActionsMenu.anchorEl)}
          onClose={onClosePreviewActionsMenu}
          anchorOrigin={{
            vertical: "bottom",
            horizontal: "right",
          }}
          transformOrigin={{
            vertical: "top",
            horizontal: "right",
          }}
        >
          {previewActionsMenu.lead && (() => {
            const lead = previewActionsMenu.lead;
            const leadType = getDisplayLeadType(lead);
            const isFtdOrFiller = leadType === "ftd" || leadType === "filler";
            const order = modal.order;

            // Check if lead is removed
            const isRemovedLead = order?.removedLeads?.some(
              (rl) => rl.leadId === lead._id || rl.leadId?._id === lead._id
            );

            // Check if this lead has a replacement history (meaning it replaced another lead)
            const leadMetadata = order?.leadsMetadata?.find(
              (meta) => meta.leadId?.toString() === lead._id || meta.leadId === lead._id
            );
            const replacementHistory = leadMetadata?.replacementHistory || [];
            const canUndoReplacement = replacementHistory.length > 0 &&
              (user?.role === "admin" || user?.role === "affiliate_manager");
            const lastReplacedLeadId = replacementHistory.length > 0
              ? replacementHistory[replacementHistory.length - 1]
              : null;

            // For removed leads, show only restore option
            if (isRemovedLead) {
              return (
                <MenuItem
                  onClick={() => {
                    onRestoreLead(order._id, lead);
                    onClosePreviewActionsMenu();
                  }}
                  disabled={restoringLead === lead._id}
                >
                  <ListItemIcon>
                    {restoringLead === lead._id ? (
                      <CircularProgress size={20} />
                    ) : (
                      <RestoreIcon fontSize="small" color="info" />
                    )}
                  </ListItemIcon>
                  {restoringLead === lead._id ? "Restoring..." : "Restore Lead"}
                </MenuItem>
              );
            }

            return (
              <>
                {/* Convert to Filler/FTD */}
                {isFtdOrFiller && order && (
                  <MenuItem
                    onClick={() => {
                      onConvertLeadType(order, lead);
                      onClosePreviewActionsMenu();
                    }}
                  >
                    <ListItemIcon>
                      <ConvertIcon fontSize="small" color="primary" />
                    </ListItemIcon>
                    Convert to {leadType === "ftd" ? "Filler" : "FTD"}
                  </MenuItem>
                )}

                {/* Change FTD/Filler Lead */}
                {isFtdOrFiller && order && (
                  <MenuItem
                    onClick={() => {
                      onOpenChangeFTD(order, lead);
                      onClosePreviewActionsMenu();
                    }}
                  >
                    <ListItemIcon>
                      <ChangeIcon fontSize="small" color="warning" />
                    </ListItemIcon>
                    Change {leadType === "filler" ? "Filler" : "FTD"} Lead
                  </MenuItem>
                )}

                {/* Replace Lead - Admin and Affiliate Manager only */}
                {(user?.role === "admin" || user?.role === "affiliate_manager") && order && (
                  <MenuItem
                    onClick={() => {
                      onOpenReplaceLead(order, lead);
                      onClosePreviewActionsMenu();
                    }}
                  >
                    <ListItemIcon>
                      <SwapHorizIcon fontSize="small" color="secondary" />
                    </ListItemIcon>
                    Replace Lead
                  </MenuItem>
                )}

                {/* Undo Replacement - Admin and Affiliate Manager only, when lead has replacement history */}
                {canUndoReplacement && order && (
                  <MenuItem
                    onClick={() => {
                      onUndoReplacementFromMenu(order._id, lead._id, lastReplacedLeadId);
                      onClosePreviewActionsMenu();
                    }}
                    disabled={undoingReplacement === lead._id}
                  >
                    <ListItemIcon>
                      {undoingReplacement === lead._id ? (
                        <CircularProgress size={20} />
                      ) : (
                        <UndoIcon fontSize="small" color="warning" />
                      )}
                    </ListItemIcon>
                    {undoingReplacement === lead._id ? "Undoing..." : "Undo Replacement"}
                  </MenuItem>
                )}

                {/* Assign to Agent */}
                <MenuItem
                  onClick={() => {
                    onOpenAssignLead(lead);
                    onClosePreviewActionsMenu();
                  }}
                >
                  <ListItemIcon>
                    <AssignIcon fontSize="small" color="info" />
                  </ListItemIcon>
                  Assign to Agent
                </MenuItem>

                {/* Apply Fine to Agent - Only show if lead has an assigned agent */}
                {lead.assignedAgent && (user?.role === "admin" || user?.role === "affiliate_manager") && (
                  <MenuItem
                    onClick={() => {
                      onOpenApplyFine(lead, modal.orderId);
                      onClosePreviewActionsMenu();
                    }}
                  >
                    <ListItemIcon>
                      <GavelIcon fontSize="small" color="warning" />
                    </ListItemIcon>
                    Apply Fine to Agent
                  </MenuItem>
                )}

                {/* IPQS Recheck */}
                <MenuItem onClick={() => onIPQSRecheckLead(lead)}>
                  <ListItemIcon>
                    <VerifiedUserIcon fontSize="small" color="secondary" />
                  </ListItemIcon>
                  IPQS Recheck
                </MenuItem>

                {/* Confirm/Unconfirm Deposit */}
                {isFtdOrFiller && (
                  lead.depositConfirmed ? (
                    user.role === "admin" ? (
                      <MenuItem
                        onClick={() => {
                          onUnconfirmDeposit(lead, modal.orderId);
                          onClosePreviewActionsMenu();
                        }}
                      >
                        <ListItemIcon>
                          <CallIcon fontSize="small" color="warning" />
                        </ListItemIcon>
                        Unconfirm Deposit
                      </MenuItem>
                    ) : (
                      <MenuItem disabled>
                        <ListItemIcon>
                          <CallIcon fontSize="small" color="success" />
                        </ListItemIcon>
                        Deposit Confirmed
                      </MenuItem>
                    )
                  ) : (
                    <MenuItem
                      onClick={() => {
                        onConfirmDeposit(lead, modal.orderId);
                        onClosePreviewActionsMenu();
                      }}
                      disabled={!lead.assignedAgent}
                    >
                      <ListItemIcon>
                        <CallIcon fontSize="small" color="success" />
                      </ListItemIcon>
                      Confirm Deposit
                    </MenuItem>
                  )
                )}

                {/* Set Status - for FTD/Filler with confirmed deposit */}
                {isFtdOrFiller && lead.depositConfirmed && user.role !== "lead_manager" && (
                  <>
                    <Divider />
                    <MenuItem disabled sx={{ opacity: "1 !important", py: 0.25, minHeight: 0 }}>
                      <ListItemIcon>
                        <SetStatusIcon fontSize="small" color="action" />
                      </ListItemIcon>
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>
                        Set Status
                      </Typography>
                    </MenuItem>
                    {/* Mark/Unmark as Shaved */}
                    {lead.shaved ? (
                      user.role === "admin" && (
                        <MenuItem
                          onClick={() => {
                            onUnmarkAsShaved(lead, modal.orderId);
                            onClosePreviewActionsMenu();
                          }}
                          sx={{ pl: 4 }}
                        >
                          <ListItemIcon>
                            <ShavedIcon fontSize="small" color="warning" />
                          </ListItemIcon>
                          Unmark as Shaved
                        </MenuItem>
                      )
                    ) : (
                      <MenuItem
                        onClick={() => {
                          onMarkAsShaved(lead, modal.orderId);
                          onClosePreviewActionsMenu();
                        }}
                        sx={{ pl: 4 }}
                      >
                        <ListItemIcon>
                          <ShavedIcon fontSize="small" color="error" />
                        </ListItemIcon>
                        Mark as Shaved
                      </MenuItem>
                    )}
                    {/* Mark/Unmark as Closed Network */}
                    {lead.closedNetwork ? (
                      user.role === "admin" && (
                        <MenuItem
                          onClick={() => {
                            onUnmarkAsClosedNetwork(lead, modal.orderId);
                            onClosePreviewActionsMenu();
                          }}
                          sx={{ pl: 4 }}
                        >
                          <ListItemIcon>
                            <ClosedNetworkIcon fontSize="small" color="warning" />
                          </ListItemIcon>
                          Unmark Closed Network
                        </MenuItem>
                      )
                    ) : (
                      <MenuItem
                        onClick={() => {
                          onMarkAsClosedNetwork(lead, modal.orderId);
                          onClosePreviewActionsMenu();
                        }}
                        sx={{ pl: 4 }}
                      >
                        <ListItemIcon>
                          <ClosedNetworkIcon fontSize="small" color="warning" />
                        </ListItemIcon>
                        Mark as Closed Network
                      </MenuItem>
                    )}
                  </>
                )}


                {/* Delete - Available to all users */}
                <>
                  <Divider />
                  <MenuItem
                    onClick={() => {
                      onOpenRemoveLead(lead);
                      onClosePreviewActionsMenu();
                    }}
                    sx={{ color: "error.main" }}
                  >
                    <ListItemIcon>
                      <DeleteIcon fontSize="small" color="error" />
                    </ListItemIcon>
                    Remove from Order
                  </MenuItem>
                </>
              </>
            );
          })()}
        </Menu>
      </Dialog>
  );
};

export default LeadsPreviewModal;
