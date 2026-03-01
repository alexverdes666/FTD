import React from "react";
import {
  Box,
  Typography,
  Button,
  Chip,
  Paper,
  IconButton,
  Collapse,
  Alert,
  CircularProgress,
  Tooltip,
  Divider,
  alpha,
} from "@mui/material";
import {
  Edit as EditIcon,
  Send as SendIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Business as BusinessIcon,
  ContentCopy as ContentCopyIcon,
  Visibility as ViewIcon,
  Close as CloseIcon,
  ChevronRight as ChevronRightIcon,
  Restore as RestoreIcon,
  VerifiedUser as VerifiedUserIcon,
  AccountCircle as AccountCircleIcon,
  Assignment as AssignmentIcon,
  Notes as NotesIcon,
  Language as LanguageIcon,
} from "@mui/icons-material";
import api from "../../services/api";
import { formatPhoneWithCountryCode } from "../../utils/phoneUtils";
import {
  getDisplayLeadType,
  getStatusChipSx,
  getPriorityChipSx,
  renderLeadCounts,
} from "./ordersUtils";

const OrderDetailPanel = ({
  orderPanelId,
  orders,
  expandedRowData,
  setExpandedRowData,
  expandedLeadId,
  setExpandedLeadId,
  user,
  onClose: handleCloseOrderPanel,
  onPreviewLeads: handleOpenLeadsPreviewModal,
  onCopyLeads: handleCopyOrderLeads,
  onExportLeads: handleExportLeads,
  onDeleteOrder: handleDeleteOrderClick,
  onOpenAddLeads: handleOpenAddLeadsDialog,
  onEditPlannedDate: handleOpenEditPlannedDate,
  onEditNetworkConfig: handleOpenEditNetworkConfig,
  onOpenAssignedLeads: handleOpenAssignedLeadsModal,
  onOpenRefundsAssignment: handleOpenRefundsAssignment,
  onDirectIPQSValidation: handleDirectIPQSValidation,
  ipqsValidatingOrders,
  refundAssignmentStatus,
  onOpenClientBrokerManagement: handleOpenClientBrokerManagement,
  onChangeRequester: handleOpenChangeRequester,
  getLeadWithOrderMetadata,
  onConfirmDeposit,
  onUnconfirmDeposit,
  onMarkAsShaved,
  onUnmarkAsShaved,
  onOpenChangeFTD,
  onOpenReplaceLead,
  onConvertLeadType,
  onOpenAssignLead,
  onCopyToClipboard,
  onLeadMouseEnter,
  onLeadMouseLeave,
  onOpenApplyFine,
  onOpenRemoveLead,
  setCopyPreferencesOpen,
  processingLeads,
  setNotification,
}) => {
  if (!orderPanelId) return null;

  const panelOrder = orders.find((o) => o._id === orderPanelId);
  const expandedDetails = orderPanelId ? expandedRowData[orderPanelId] : null;

  return (
          <Box sx={{ width: { xs: "100%", sm: 480, md: 520 }, borderLeft: 1, borderColor: "divider", display: "flex", flexDirection: "column", flexShrink: 0, bgcolor: "background.paper" }}>
              <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
                {/* Panel Header */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    px: 2,
                    py: 0.75,
                    borderBottom: 1,
                    borderColor: "divider",
                    background: (theme) =>
                      `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.secondary.main, 0.04)} 100%)`,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Order Details
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                      {orderPanelId?.slice(-8)}
                    </Typography>
                  </Box>
                  <IconButton onClick={handleCloseOrderPanel} size="small" sx={{ p: 0.5 }}>
                    <CloseIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Box>

                {/* Panel Body - Scrollable */}
                <Box sx={{ flex: 1, overflow: "auto", p: 2.5 }}>
                  {expandedDetails?.loading ? (
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", p: 4 }}>
                      <CircularProgress size={28} />
                    </Box>
                  ) : expandedDetails ? (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {/* Status Reason Alerts */}
                      {expandedDetails.status === "cancelled" && expandedDetails.cancellationReason && (
                        <Alert severity="error" sx={{ borderRadius: 2 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                            Cancellation Reason:
                          </Typography>
                          {expandedDetails.cancellationReason.split(" | ").map((reason, index) => (
                            <Typography key={index} variant="body2" sx={{ ml: 1 }}>
                              {reason}
                            </Typography>
                          ))}
                        </Alert>
                      )}
                      {expandedDetails.status === "partial" && expandedDetails.partialFulfillmentReason && (
                        <Alert severity="warning" sx={{ borderRadius: 2 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                            Partial Fulfillment Reason:
                          </Typography>
                          {expandedDetails.partialFulfillmentReason.split(" | ").map((reason, index) => (
                            <Typography key={index} variant="body2" sx={{ ml: 1 }}>
                              {reason}
                            </Typography>
                          ))}
                        </Alert>
                      )}

                      {/* Network Configuration */}
                      <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: 1, borderColor: "divider" }}>
                        <Typography
                          variant="subtitle2"
                          sx={{
                            fontWeight: 700, mb: 1.5, color: "primary.main", display: "flex", alignItems: "center", gap: 0.5,
                            textTransform: "uppercase", letterSpacing: "0.5px", pb: 0.75, borderBottom: 1, borderColor: "divider",
                          }}
                        >
                          <LanguageIcon sx={{ fontSize: 18 }} /> Network Configuration
                        </Typography>
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ minWidth: "90px" }}>Campaign:</Typography>
                            <Chip label={expandedDetails.selectedCampaign?.name || "N/A"} size="small" color="primary" variant="outlined" sx={{ height: "22px", fontSize: "0.75rem" }} />
                            {user?.role === "admin" && (
                              <IconButton size="small" onClick={() => handleOpenEditNetworkConfig(expandedDetails, "campaign")} title="Edit Campaign" sx={{ p: 0.25 }}>
                                <EditIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            )}
                          </Box>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ minWidth: "90px" }}>Our Network:</Typography>
                            <Chip label={expandedDetails.selectedOurNetwork?.name || "N/A"} size="small" color="secondary" variant="outlined" sx={{ height: "22px", fontSize: "0.75rem" }} />
                            {user?.role === "admin" && (
                              <IconButton size="small" onClick={() => handleOpenEditNetworkConfig(expandedDetails, "ourNetwork")} title="Edit Our Network" sx={{ p: 0.25 }}>
                                <EditIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            )}
                          </Box>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ minWidth: "90px" }}>Client Network:</Typography>
                            <Chip label={expandedDetails.selectedClientNetwork?.name || "N/A"} size="small" color="info" variant="outlined" sx={{ height: "22px", fontSize: "0.75rem" }} />
                            {user?.role === "admin" && (
                              <IconButton size="small" onClick={() => handleOpenEditNetworkConfig(expandedDetails, "clientNetwork")} title="Edit Client Network" sx={{ p: 0.25 }}>
                                <EditIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            )}
                          </Box>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ minWidth: "90px" }}>Client Brokers:</Typography>
                            {user?.role !== "lead_manager" ? (
                              <Button
                                size="small" variant="outlined"
                                onClick={() => handleOpenClientBrokerManagement(expandedDetails)}
                                startIcon={<BusinessIcon />}
                                sx={{ height: "26px", fontSize: "0.7rem", px: 1 }}
                              >
                                Manage ({expandedDetails.leads?.filter((lead) => lead.assignedClientBrokers?.length > 0).length || 0}/{expandedDetails.leads?.length || 0})
                              </Button>
                            ) : (
                              <Chip
                                label={`${expandedDetails.leads?.filter((lead) => lead.assignedClientBrokers?.length > 0).length || 0}/${expandedDetails.leads?.length || 0} assigned`}
                                size="small" color="info" variant="outlined" sx={{ height: "22px", fontSize: "0.75rem" }}
                              />
                            )}
                          </Box>
                        </Box>
                      </Paper>

                      {/* Leads Section */}
                      {((expandedDetails.leads && expandedDetails.leads.length > 0) || expandedDetails.leadsLoading || expandedDetails.leadsError) && (
                        <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: 1, borderColor: "divider" }}>
                          {expandedDetails.leadsLoading ? (
                            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", p: 4, gap: 2 }}>
                              <CircularProgress />
                              <Typography variant="body2" color="text.secondary">Loading {expandedDetails.leadsCount || 0} leads...</Typography>
                            </Box>
                          ) : expandedDetails.leadsError ? (
                            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", p: 4, gap: 2 }}>
                              <ErrorIcon color="error" />
                              <Typography variant="body2" color="text.secondary">Failed to load leads</Typography>
                              <Button
                                size="small" variant="outlined"
                                startIcon={<RestoreIcon />}
                                onClick={() => {
                                  setExpandedRowData((prev) => ({
                                    ...prev,
                                    [panelOrder._id]: {
                                      ...prev[panelOrder._id],
                                      leadsLoading: true,
                                      leadsError: false,
                                    },
                                  }));
                                  api.get(`/orders/${panelOrder._id}?panel=true`)
                                    .then((res) => {
                                      setExpandedRowData((prev) => ({
                                        ...prev,
                                        [panelOrder._id]: {
                                          ...res.data.data,
                                          leadsLoading: false,
                                        },
                                      }));
                                    })
                                    .catch(() => {
                                      setExpandedRowData((prev) => ({
                                        ...prev,
                                        [panelOrder._id]: {
                                          ...prev[panelOrder._id],
                                          leadsLoading: false,
                                          leadsError: true,
                                        },
                                      }));
                                    });
                                }}
                              >
                                Retry
                              </Button>
                            </Box>
                          ) : (
                            <>
                              {/* Leads Header with Actions */}
                              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 1 }}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                  <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>Assigned Leads</Typography>
                                  <Chip label={expandedDetails.leads.length} size="small" color="primary" sx={{ height: 22, fontSize: "0.75rem", fontWeight: 600 }} />
                                </Box>
                                <Box sx={{ display: "flex", gap: 0.5, flexWrap: "nowrap" }}>
                                  <Button
                                    variant="contained" size="small"
                                    onClick={() => handleOpenAssignedLeadsModal(expandedDetails.leads, panelOrder?._id)}
                                  >
                                    See Leads
                                  </Button>
                                  <Button
                                    variant="outlined" size="small" startIcon={<ViewIcon />}
                                    onClick={() => handleOpenLeadsPreviewModal(expandedDetails.leads, panelOrder?._id, panelOrder)}
                                  >
                                    Preview
                                  </Button>
                                  <Button
                                    size="small" startIcon={<ContentCopyIcon />}
                                    onClick={() => handleCopyOrderLeads(expandedDetails.leads, expandedDetails)}
                                    variant="outlined"
                                  >
                                    Copy
                                  </Button>
                                  {(user?.role === "admin" || user?.role === "affiliate_manager" || user?.role === "lead_manager") && (() => {
                                    const allLeadsValidated = expandedDetails?.leads?.length > 0 &&
                                      expandedDetails.leads.every((lead) => lead.ipqsValidation?.validatedAt);
                                    const isValidating = ipqsValidatingOrders.includes(panelOrder?._id);
                                    return (
                                      <Tooltip title={isValidating ? "Validating..." : allLeadsValidated ? "All leads already validated" : "Validate with IPQS"}>
                                        <span>
                                          <Button
                                            size="small"
                                            startIcon={isValidating ? <CircularProgress size={16} color="inherit" /> : <VerifiedUserIcon />}
                                            onClick={() => handleDirectIPQSValidation(panelOrder?._id)}
                                            variant="outlined" color="info"
                                            disabled={isValidating || allLeadsValidated}
                                          >
                                            {isValidating ? "..." : "IPQS"}
                                          </Button>
                                        </span>
                                      </Tooltip>
                                    );
                                  })()}
                                  {(user?.role === "admin" || user?.role === "affiliate_manager" || user?.role === "lead_manager") &&
                                    expandedDetails?.fulfilled?.ftd > 0 && (
                                      <Tooltip
                                        title={
                                          refundAssignmentStatus[expandedDetails._id]?.isAssigned
                                            ? `${refundAssignmentStatus[expandedDetails._id]?.assignmentCount || 0} FTD lead(s) already assigned`
                                            : `Assign ${expandedDetails?.fulfilled?.ftd || 0} FTD lead(s) to refunds manager`
                                        }
                                      >
                                        <span>
                                          <Button
                                            size="small"
                                            variant={refundAssignmentStatus[expandedDetails._id]?.isAssigned ? "outlined" : "contained"}
                                            color={refundAssignmentStatus[expandedDetails._id]?.isAssigned ? "success" : "primary"}
                                            startIcon={refundAssignmentStatus[expandedDetails._id]?.isAssigned ? <CheckCircleIcon /> : <SendIcon />}
                                            onClick={() => handleOpenRefundsAssignment(expandedDetails._id)}
                                            disabled={refundAssignmentStatus[expandedDetails._id]?.isAssigned}
                                          >
                                            {refundAssignmentStatus[expandedDetails._id]?.isAssigned ? "Assigned" : "Refunds"}
                                          </Button>
                                        </span>
                                      </Tooltip>
                                    )}
                                </Box>
                              </Box>

                              {/* Leads List with Inline Expansion */}
                              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                                {expandedDetails.leads.map((originalLead) => {
                                  const lead = getLeadWithOrderMetadata(originalLead, expandedDetails);
                                  const leadType = getDisplayLeadType(lead);
                                  const isLeadExpanded = expandedLeadId === lead._id;
                                  const removedInfo = expandedDetails.removedLeads?.find(
                                    (rl) => rl.leadId === lead._id || rl.leadId?._id === lead._id
                                  );
                                  const isRemoved = !!removedInfo;

                                  return (
                                    <Box key={lead._id}>
                                      {/* Compact Lead Row */}
                                      <Box
                                        onClick={() => setExpandedLeadId(isLeadExpanded ? null : lead._id)}
                                        sx={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 1,
                                          p: 1,
                                          borderRadius: 1,
                                          cursor: "pointer",
                                          bgcolor: isLeadExpanded ? (theme) => alpha(theme.palette.primary.main, 0.06) : "transparent",
                                          border: 1,
                                          borderColor: isLeadExpanded ? "primary.light" : "divider",
                                          transition: "all 0.15s ease",
                                          "&:hover": { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04) },
                                          ...(isRemoved && { opacity: 0.5, textDecoration: "line-through" }),
                                        }}
                                      >
                                        <Chip
                                          label={leadType?.toUpperCase() || "N/A"}
                                          size="small"
                                          color={leadType === "ftd" ? "success" : leadType === "filler" ? "warning" : leadType === "cold" ? "info" : "default"}
                                          sx={{ height: 20, fontSize: "0.65rem", "& .MuiChip-label": { px: "4px" } }}
                                        />
                                        <Typography variant="body2" sx={{ fontWeight: 500, fontSize: "0.85rem", flex: 1 }}>
                                          {lead.firstName} {lead.lastName}
                                        </Typography>
                                        {/* Status indicators */}
                                        <Box sx={{ display: "flex", gap: 0.5 }}>
                                          {isRemoved && <Chip label="Removed" size="small" sx={{ height: 18, fontSize: "0.6rem", bgcolor: "grey.500", color: "white" }} />}
                                          {lead.depositConfirmed && !isRemoved && <Chip label="Deposit" size="small" color="success" sx={{ height: 18, fontSize: "0.6rem" }} />}
                                          {lead.shaved && !isRemoved && <Chip label="Shaved" size="small" color="error" sx={{ height: 18, fontSize: "0.6rem" }} />}
                                        </Box>
                                        <ChevronRightIcon
                                          sx={{
                                            fontSize: 20,
                                            color: "text.secondary",
                                            transition: "transform 0.2s ease",
                                            transform: isLeadExpanded ? "rotate(90deg)" : "rotate(0deg)",
                                          }}
                                        />
                                      </Box>

                                      {/* Inline Expanded Lead Details */}
                                      <Collapse in={isLeadExpanded} timeout={200} unmountOnExit>
                                        <Box sx={{ pl: 2, pr: 1, py: 1.5, ml: 1, borderLeft: 2, borderColor: "primary.light" }}>
                                          {/* Contact Details */}
                                          <Typography variant="caption" sx={{ fontWeight: 700, color: "primary.main", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", mb: 0.75 }}>
                                            Contact Details
                                          </Typography>
                                          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 1.5 }}>
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 55 }}>Email:</Typography>
                                              <Typography variant="body2" sx={{ fontWeight: 500, fontSize: "0.85rem" }}>{lead.newEmail || lead.email || "N/A"}</Typography>
                                            </Box>
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 55 }}>Phone:</Typography>
                                              <Typography variant="body2" sx={{ fontWeight: 500, fontSize: "0.85rem" }}>{formatPhoneWithCountryCode(lead.newPhone || lead.phone, lead.country) || "N/A"}</Typography>
                                            </Box>
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 55 }}>Country:</Typography>
                                              <Typography variant="body2" sx={{ fontWeight: 500 }}>{lead.country || "N/A"}</Typography>
                                            </Box>
                                          </Box>

                                          {/* Personal Info */}
                                          {(lead.gender || lead.dob) && (
                                            <>
                                              <Typography variant="caption" sx={{ fontWeight: 700, color: "primary.main", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", mb: 0.75 }}>
                                                Personal Info
                                              </Typography>
                                              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 1.5 }}>
                                                {lead.gender && (
                                                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 55 }}>Gender:</Typography>
                                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{lead.gender}</Typography>
                                                  </Box>
                                                )}
                                                {lead.dob && (
                                                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 55 }}>DOB:</Typography>
                                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{new Intl.DateTimeFormat('en-US', { timeZone: 'UTC' }).format(new Date(lead.dob))}</Typography>
                                                  </Box>
                                                )}
                                              </Box>
                                            </>
                                          )}

                                          {/* Business Info */}
                                          {(lead.assignedClientBrokers?.length > 0 || lead.clientBroker || lead.clientNetwork) && (
                                            <>
                                              <Typography variant="caption" sx={{ fontWeight: 700, color: "primary.main", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", mb: 0.75 }}>
                                                Business Info
                                              </Typography>
                                              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 1.5 }}>
                                                {(lead.assignedClientBrokers?.length > 0 || lead.clientBroker) && (
                                                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 55 }}>Broker:</Typography>
                                                    <Typography variant="body2" sx={{ fontWeight: 500, fontSize: "0.85rem" }}>
                                                      {lead.assignedClientBrokers?.[0]?.name || lead.clientBroker || "N/A"}
                                                    </Typography>
                                                  </Box>
                                                )}
                                                {lead.clientNetwork && (
                                                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 55 }}>Network:</Typography>
                                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{lead.clientNetwork}</Typography>
                                                  </Box>
                                                )}
                                              </Box>
                                            </>
                                          )}

                                          {/* Agent */}
                                          {lead.assignedAgent && (
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                                              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 55 }}>Agent:</Typography>
                                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                {typeof lead.assignedAgent === "object" ? lead.assignedAgent.fullName : "Assigned"}
                                              </Typography>
                                            </Box>
                                          )}

                                          {/* Deposit Status */}
                                          {lead.depositConfirmed && (
                                            <Box sx={{ p: 1, bgcolor: (theme) => alpha(theme.palette.success.main, 0.08), borderRadius: 1, mb: 1 }}>
                                              <Typography variant="caption" sx={{ fontWeight: 600, color: "success.main" }}>Deposit Confirmed</Typography>
                                              {lead.depositPSP && (
                                                <Typography variant="caption" color="primary.main" display="block" sx={{ fontWeight: 600 }}>
                                                  PSP: {typeof lead.depositPSP === "object" ? lead.depositPSP.name : lead.depositPSP}
                                                </Typography>
                                              )}
                                              {lead.depositConfirmedBy && (
                                                <Typography variant="caption" color="text.secondary" display="block">
                                                  By: {typeof lead.depositConfirmedBy === "object" ? lead.depositConfirmedBy.fullName : "Unknown"}
                                                </Typography>
                                              )}
                                            </Box>
                                          )}

                                          {/* Shaved Status */}
                                          {lead.shaved && (
                                            <Box sx={{ p: 1, bgcolor: (theme) => alpha(theme.palette.error.main, 0.08), borderRadius: 1, mb: 1 }}>
                                              <Typography variant="caption" sx={{ fontWeight: 600, color: "error.main" }}>Marked as Shaved</Typography>
                                              {lead.shavedRefundsManager && (
                                                <Typography variant="caption" color="text.secondary" display="block">
                                                  Assigned to: {typeof lead.shavedRefundsManager === "object" ? lead.shavedRefundsManager.fullName : "Unknown"}
                                                </Typography>
                                              )}
                                            </Box>
                                          )}

                                          {/* Documents */}
                                          {Array.isArray(lead.documents) && lead.documents.length > 0 && (
                                            <Box sx={{ mt: 0.5 }}>
                                              <Typography variant="caption" sx={{ fontWeight: 700, color: "primary.main", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", mb: 0.5 }}>
                                                Documents ({lead.documents.length})
                                              </Typography>
                                              <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                                                {lead.documents.map((doc, idx) => (
                                                  <Chip
                                                    key={idx}
                                                    label={doc.description || `Doc ${idx + 1}`}
                                                    size="small"
                                                    color={doc.url ? "primary" : "default"}
                                                    variant="outlined"
                                                    sx={{ cursor: doc.url ? "pointer" : "default", height: 22, fontSize: "0.7rem" }}
                                                    onClick={doc.url ? () => window.open(doc.url, "_blank", "noopener,noreferrer") : undefined}
                                                  />
                                                ))}
                                              </Box>
                                            </Box>
                                          )}
                                        </Box>
                                      </Collapse>
                                    </Box>
                                  );
                                })}
                              </Box>
                            </>
                          )}
                        </Paper>
                      )}

                      {/* Account Manager Section */}
                      <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: 1, borderColor: "divider" }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1.5 }}>
                          <Typography
                            variant="subtitle2"
                            sx={{
                              fontWeight: 700, color: "primary.main", display: "flex", alignItems: "center", gap: 0.5,
                              textTransform: "uppercase", letterSpacing: "0.5px", pb: 0.75, borderBottom: 1, borderColor: "divider", flex: 1,
                            }}
                          >
                            <AccountCircleIcon sx={{ fontSize: 18 }} /> Account Manager
                          </Typography>
                          {user?.role === "admin" && (
                            <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleOpenChangeRequester(panelOrder); }} title="Change Requester" sx={{ p: 0.25 }}>
                              <EditIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          )}
                        </Box>
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ minWidth: "50px" }}>Name:</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>{expandedDetails.requester?.fullName || "N/A"}</Typography>
                          </Box>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ minWidth: "50px" }}>Email:</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 500, fontSize: "0.85rem" }}>{expandedDetails.requester?.email || "N/A"}</Typography>
                          </Box>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ minWidth: "50px" }}>Role:</Typography>
                            <Chip label={expandedDetails.requester?.role || "N/A"} size="small" color="info" sx={{ height: "20px", fontSize: "0.7rem" }} />
                          </Box>
                        </Box>
                      </Paper>

                      {/* Order Info & Filters Section */}
                      <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: 1, borderColor: "divider" }}>
                        <Typography
                          variant="subtitle2"
                          sx={{
                            fontWeight: 700, mb: 1.5, color: "primary.main", display: "flex", alignItems: "center", gap: 0.5,
                            textTransform: "uppercase", letterSpacing: "0.5px", pb: 0.75, borderBottom: 1, borderColor: "divider",
                          }}
                        >
                          <AssignmentIcon sx={{ fontSize: 18 }} /> Order Info & Filters
                        </Typography>
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ minWidth: "60px" }}>Status:</Typography>
                            <Chip label={expandedDetails.status} variant="outlined" size="small" sx={{ textTransform: "capitalize", fontWeight: 600, ...getStatusChipSx(expandedDetails.status) }} />
                          </Box>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ minWidth: "60px" }}>Priority:</Typography>
                            <Chip label={expandedDetails.priority} variant="outlined" size="small" sx={{ textTransform: "capitalize", fontWeight: 600, ...getPriorityChipSx(expandedDetails.priority) }} />
                          </Box>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ minWidth: "60px" }}>Created:</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>{new Date(expandedDetails.createdAt).toLocaleDateString()}</Typography>
                          </Box>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ minWidth: "60px" }}>Planned:</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>{expandedDetails.plannedDate ? new Date(expandedDetails.plannedDate).toLocaleDateString() : "N/A"}</Typography>
                            {(user?.role === "admin" || user?.role === "affiliate_manager") && (
                              <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleOpenEditPlannedDate(panelOrder); }} title="Edit Planned Date" sx={{ p: 0.25 }}>
                                <EditIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            )}
                          </Box>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ minWidth: "60px" }}>Country:</Typography>
                            <Chip label={expandedDetails.countryFilter || "Any"} size="small" variant="outlined" sx={{ height: "20px", fontSize: "0.7rem" }} />
                          </Box>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ minWidth: "60px" }}>Gender:</Typography>
                            <Chip label={expandedDetails.genderFilter || "Any"} size="small" variant="outlined" sx={{ height: "20px", fontSize: "0.7rem" }} />
                          </Box>
                          {/* Requests / Fulfilled */}
                          <Divider sx={{ my: 0.5 }} />
                          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                            {[
                              { label: "FTD", fulfilled: expandedDetails.fulfilled?.ftd || 0, requested: expandedDetails.requests?.ftd || 0, color: "#3b82f6" },
                              { label: "Filler", fulfilled: expandedDetails.fulfilled?.filler || 0, requested: expandedDetails.requests?.filler || 0, color: "#f59e0b" },
                              { label: "Cold", fulfilled: expandedDetails.fulfilled?.cold || 0, requested: expandedDetails.requests?.cold || 0, color: "#8b5cf6" },
                              { label: "Live", fulfilled: expandedDetails.fulfilled?.live || 0, requested: expandedDetails.requests?.live || 0, color: "#10b981" },
                            ].filter((item) => item.requested > 0).map((item) => (
                              <Box key={item.label} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                <Typography variant="caption" color="text.secondary">{item.label}:</Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: item.color }}>{item.fulfilled}/{item.requested}</Typography>
                              </Box>
                            ))}
                          </Box>
                        </Box>
                      </Paper>

                      {/* Notes Section */}
                      {expandedDetails.notes && (
                        <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: 1, borderColor: "divider" }}>
                          <Typography
                            variant="subtitle2"
                            sx={{
                              fontWeight: 700, mb: 1.5, color: "primary.main", display: "flex", alignItems: "center", gap: 0.5,
                              textTransform: "uppercase", letterSpacing: "0.5px", pb: 0.75, borderBottom: 1, borderColor: "divider",
                            }}
                          >
                            <NotesIcon sx={{ fontSize: 18 }} /> Notes
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 400, fontStyle: "italic", fontSize: "0.85rem", lineHeight: 1.5, bgcolor: (theme) => alpha(theme.palette.grey[500], 0.06), p: 1.5, borderRadius: 1, borderLeft: 3, borderColor: "primary.light" }}
                          >
                            {expandedDetails.notes}
                          </Typography>
                        </Paper>
                      )}
                    </Box>
                  ) : (
                    <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
                      <CircularProgress />
                    </Box>
                  )}
                </Box>
              </Box>
          </Box>
  );
};

export default OrderDetailPanel;
