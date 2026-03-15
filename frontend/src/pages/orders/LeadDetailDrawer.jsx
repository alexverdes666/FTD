import React, { useState, useEffect, useCallback } from "react";
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Chip,
  Divider,
  Button,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  Tooltip,
  alpha,
} from "@mui/material";
import {
  Close as CloseIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  Business as BusinessIcon,
  ExpandMore as ExpandMoreIcon,
  AttachFile as AttachFileIcon,
  OpenInNew as OpenInNewIcon,
  SwapVert as ConvertIcon,
  Cached as ChangeIcon,
  AssignmentInd as AssignIcon,
  Call as CallIcon,
  ContentCut as ShavedIcon,
  Block as ClosedNetworkIcon,
  VerifiedUser as VerifiedUserIcon,
  Comment as CommentIcon,
  Send as SendIcon,
  Security as SecurityIcon,
  Gavel as GavelIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import DocumentPreview from "../../components/DocumentPreview";
import { formatPhoneWithCountryCode } from "../../utils/phoneUtils";
import {
  getDisplayLeadType,
  getIPQSStatusConfig,
  buildIPQSTooltip,
} from "./ordersUtils";

const DRAWER_WIDTH = 520;

const formatDate = (date) => {
  if (!date) return "N/A";
  const d = new Date(date);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
};

const formatDateShort = (date) => {
  if (!date) return "N/A";
  const d = new Date(date);
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC" }).format(d);
};

const InfoRow = ({ icon: Icon, label, value, color, children }) => (
  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 1 }}>
    <Icon fontSize="small" color={color || "action"} sx={{ mt: 0.3 }} />
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      {children || (
        <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: "break-word" }}>
          {value || "N/A"}
        </Typography>
      )}
    </Box>
  </Box>
);

const SectionHeader = ({ children, color }) => (
  <Typography
    variant="subtitle2"
    sx={{ fontWeight: 600, mb: 1, color: color || "primary.main" }}
  >
    {children}
  </Typography>
);

const IPQSDetailRow = ({ label, value, isBool }) => (
  <Box
    sx={{
      display: "flex",
      justifyContent: "space-between",
      py: 0.25,
      px: 0.5,
      "&:nth-of-type(odd)": { bgcolor: "action.hover" },
      borderRadius: 0.5,
    }}
  >
    <Typography variant="caption" color="text.secondary">
      {label}
    </Typography>
    <Typography
      variant="caption"
      sx={{
        fontWeight: 500,
        color: isBool
          ? value
            ? "error.main"
            : "success.main"
          : "text.primary",
      }}
    >
      {isBool ? (value ? "Yes" : "No") : (value ?? "N/A")}
    </Typography>
  </Box>
);

const LeadDetailDrawer = ({
  open,
  onClose,
  leadId,
  initialLeadData,
  orderId,
  order,
  user,
  getLeadWithOrderMetadata,
  // Action callbacks
  onConfirmDeposit,
  onUnconfirmDeposit,
  onMarkAsShaved,
  onUnmarkAsShaved,
  onMarkAsClosedNetwork,
  onUnmarkAsClosedNetwork,
  onConvertLeadType,
  onOpenChangeFTD,
  onOpenReplaceLead,
  onOpenAssignLead,
  onOpenApplyFine,
  onOpenRemoveLead,
  onIPQSRecheckLead,
  onLeadUpdate,
  processingLeads,
}) => {
  const navigate = useNavigate();
  const [fullLead, setFullLead] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [addingComment, setAddingComment] = useState(false);

  // The lead to display: prefer fullLead (API-fetched), fall back to initialLeadData
  const lead = fullLead || initialLeadData;
  const leadType = lead ? getDisplayLeadType(lead) : "";
  const isFtdOrFiller = ["ftd", "filler"].includes(leadType);
  const userRole = user?.role;

  // Fetch full lead data when drawer opens
  useEffect(() => {
    if (!open || !leadId) {
      setFullLead(null);
      setError(null);
      return;
    }

    let cancelled = false;
    const fetchLead = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get(`/leads/${leadId}`);
        if (!cancelled) {
          let fetchedLead = response.data.data;
          // Merge order-specific metadata
          if (getLeadWithOrderMetadata && order) {
            fetchedLead = getLeadWithOrderMetadata(fetchedLead, order);
          }
          setFullLead(fetchedLead);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to fetch lead details:", err);
          setError("Failed to load full lead details");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchLead();
    return () => { cancelled = true; };
  }, [open, leadId, order, getLeadWithOrderMetadata]);

  const handleAddComment = useCallback(async () => {
    if (!commentText.trim() || !leadId) return;
    setAddingComment(true);
    try {
      const response = await api.put(`/leads/${leadId}/comment`, {
        text: commentText.trim(),
      });
      // Update fullLead with the new comments array
      if (response.data?.data) {
        setFullLead((prev) => prev ? { ...prev, comments: response.data.data.comments } : prev);
      }
      setCommentText("");
    } catch (err) {
      console.error("Failed to add comment:", err);
    } finally {
      setAddingComment(false);
    }
  }, [commentText, leadId]);

  const handleViewInLeadsPage = useCallback(() => {
    if (lead) {
      onClose();
      navigate(
        `/leads?search=${encodeURIComponent(lead.newEmail || lead.firstName)}`
      );
    }
  }, [lead, navigate, onClose]);

  if (!lead) return null;

  const ipqs = lead.ipqsValidation;
  const emailStatus = ipqs?.summary?.emailStatus;
  const phoneStatus = ipqs?.summary?.phoneStatus;
  const emailConfig = emailStatus ? getIPQSStatusConfig(emailStatus) : null;
  const phoneConfig = phoneStatus ? getIPQSStatusConfig(phoneStatus) : null;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        zIndex: 1350,
        "& .MuiDrawer-paper": {
          width: { xs: "100%", sm: DRAWER_WIDTH },
          boxSizing: "border-box",
        },
      }}
    >
      {/* Sticky Header */}
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 1,
          bgcolor: "background.paper",
          borderBottom: 1,
          borderColor: "divider",
          px: 2,
          py: 1.5,
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: "1.1rem" }}>
              {lead.firstName} {lead.lastName}
            </Typography>
            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.5 }}>
              <Chip
                label={(lead.orderedAs || lead.leadType)?.toUpperCase() || "UNKNOWN"}
                size="small"
                color={leadType === "ftd" ? "success" : leadType === "filler" ? "warning" : leadType === "cold" ? "info" : "default"}
                variant="outlined"
              />
              {lead.status && (
                <Chip label={lead.status} size="small" color={lead.status === "active" ? "success" : lead.status === "contacted" ? "info" : lead.status === "converted" ? "warning" : "error"} />
              )}
              {lead.depositConfirmed && <Chip label="Deposit" size="small" color="success" sx={{ height: 22 }} />}
              {lead.shaved && <Chip label="Shaved" size="small" color="error" sx={{ height: 22 }} />}
              {lead.closedNetwork && <Chip label="Closed Net" size="small" color="warning" sx={{ height: 22 }} />}
            </Box>
          </Box>
          <IconButton size="small" onClick={onClose} sx={{ ml: 1 }}>
            <CloseIcon />
          </IconButton>
        </Box>
        {loading && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
            <CircularProgress size={14} />
            <Typography variant="caption" color="text.secondary">Loading full details...</Typography>
          </Box>
        )}
      </Box>

      {/* Scrollable Body */}
      <Box sx={{ flex: 1, overflow: "auto", px: 2, py: 2 }}>
        {error && (
          <Typography variant="body2" color="error" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}

        {/* Action Buttons */}
        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mb: 2 }}>
          {onConvertLeadType && isFtdOrFiller && (
            <Button size="small" startIcon={<ConvertIcon />} onClick={() => { onConvertLeadType(lead, orderId); }} variant="outlined" color="primary" sx={{ fontSize: "0.7rem" }}>
              Convert to {leadType === "ftd" ? "Filler" : "FTD"}
            </Button>
          )}
          {onOpenChangeFTD && isFtdOrFiller && (userRole === "admin" || userRole === "affiliate_manager") && (
            <Button size="small" startIcon={<ChangeIcon />} onClick={() => { onOpenChangeFTD(lead, orderId); }} variant="outlined" color="warning" sx={{ fontSize: "0.7rem" }}>
              Change {leadType === "filler" ? "Filler" : "FTD"}
            </Button>
          )}
          {onOpenReplaceLead && isFtdOrFiller && (userRole === "admin" || userRole === "affiliate_manager") && (
            <Button size="small" startIcon={<ChangeIcon />} onClick={() => { onOpenReplaceLead(lead, orderId); }} variant="outlined" color="secondary" sx={{ fontSize: "0.7rem" }}>
              Replace
            </Button>
          )}
          {onOpenAssignLead && (
            <Button size="small" startIcon={<AssignIcon />} onClick={() => { onOpenAssignLead(lead, orderId); }} variant="outlined" color="info" sx={{ fontSize: "0.7rem" }}>
              Assign Agent
            </Button>
          )}
          {isFtdOrFiller && lead.assignedAgent && !lead.depositConfirmed && onConfirmDeposit && (
            <Button size="small" startIcon={<CallIcon />} onClick={() => { onConfirmDeposit(lead, orderId); }} variant="outlined" color="success" sx={{ fontSize: "0.7rem" }}>
              Confirm Deposit
            </Button>
          )}
          {isFtdOrFiller && lead.depositConfirmed && userRole === "admin" && onUnconfirmDeposit && (
            <Button size="small" startIcon={<CallIcon />} onClick={() => { onUnconfirmDeposit(lead, orderId); }} variant="contained" color="warning" sx={{ fontSize: "0.7rem" }}>
              Unconfirm Deposit
            </Button>
          )}
          {isFtdOrFiller && lead.depositConfirmed && !lead.shaved && onMarkAsShaved && userRole !== "lead_manager" && (
            <Button size="small" startIcon={<ShavedIcon />} onClick={() => { onMarkAsShaved(lead, orderId); }} variant="outlined" color="error" sx={{ fontSize: "0.7rem" }}>
              Mark Shaved
            </Button>
          )}
          {lead.shaved && userRole === "admin" && onUnmarkAsShaved && (
            <Button size="small" startIcon={<ShavedIcon />} onClick={() => { onUnmarkAsShaved(lead, orderId); }} variant="contained" color="error" sx={{ fontSize: "0.7rem" }}>
              Unmark Shaved
            </Button>
          )}
          {isFtdOrFiller && lead.depositConfirmed && !lead.closedNetwork && onMarkAsClosedNetwork && userRole !== "lead_manager" && (
            <Button size="small" startIcon={<ClosedNetworkIcon />} onClick={() => { onMarkAsClosedNetwork(lead, orderId); }} variant="outlined" color="warning" sx={{ fontSize: "0.7rem" }}>
              Closed Network
            </Button>
          )}
          {lead.closedNetwork && userRole === "admin" && onUnmarkAsClosedNetwork && (
            <Button size="small" startIcon={<ClosedNetworkIcon />} onClick={() => { onUnmarkAsClosedNetwork(lead, orderId); }} variant="contained" color="warning" sx={{ fontSize: "0.7rem" }}>
              Unmark Closed Net
            </Button>
          )}
          {onOpenApplyFine && lead.assignedAgent && (userRole === "admin" || userRole === "affiliate_manager") && (
            <Button size="small" startIcon={<GavelIcon />} onClick={() => { onOpenApplyFine(lead, orderId); }} variant="outlined" color="error" sx={{ fontSize: "0.7rem" }}>
              Apply Fine
            </Button>
          )}
          {onIPQSRecheckLead && (
            <Button size="small" startIcon={<VerifiedUserIcon />} onClick={() => { onIPQSRecheckLead(lead, orderId); }} variant="outlined" sx={{ fontSize: "0.7rem" }}>
              Recheck IPQS
            </Button>
          )}
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Contact Details */}
        <SectionHeader>Contact Details</SectionHeader>
        <InfoRow icon={EmailIcon} label="Email" color={emailConfig ? undefined : "action"}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Tooltip title={ipqs ? buildIPQSTooltip(ipqs, "email") : "Not validated"}>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 500,
                  wordBreak: "break-all",
                  ...(emailConfig && {
                    bgcolor: emailConfig.bgcolor,
                    color: emailConfig.textColor,
                    px: 0.75,
                    py: 0.25,
                    borderRadius: 0.5,
                    borderLeft: `3px solid ${emailConfig.color}`,
                  }),
                }}
              >
                {lead.newEmail || "N/A"}
              </Typography>
            </Tooltip>
          </Box>
          {lead.oldEmail && lead.oldEmail !== lead.newEmail && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25 }} display="block">
              Previous: {lead.oldEmail}
            </Typography>
          )}
        </InfoRow>
        <InfoRow icon={PhoneIcon} label="Phone" color={phoneConfig ? undefined : "action"}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Tooltip title={ipqs ? buildIPQSTooltip(ipqs, "phone") : "Not validated"}>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 500,
                  ...(phoneConfig && {
                    bgcolor: phoneConfig.bgcolor,
                    color: phoneConfig.textColor,
                    px: 0.75,
                    py: 0.25,
                    borderRadius: 0.5,
                    borderLeft: `3px solid ${phoneConfig.color}`,
                  }),
                }}
              >
                {formatPhoneWithCountryCode(lead.newPhone, lead.country)}
              </Typography>
            </Tooltip>
          </Box>
          {lead.oldPhone && lead.oldPhone !== lead.newPhone && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25 }} display="block">
              Previous: {lead.oldPhone}
            </Typography>
          )}
        </InfoRow>
        <InfoRow icon={LocationIcon} label="Country" value={lead.country} />

        <Divider sx={{ my: 2 }} />

        {/* IPQS Validation Details */}
        {ipqs && (ipqs.email?.success || ipqs.phone?.success) && (
          <>
            <Accordion
              elevation={0}
              defaultExpanded={false}
              sx={{ border: 1, borderColor: "divider", borderRadius: 1, "&:before": { display: "none" }, mb: 2 }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40, "& .MuiAccordionSummary-content": { my: 0.5 } }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <SecurityIcon fontSize="small" color="primary" />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: "0.85rem" }}>
                    IPQS Validation
                  </Typography>
                  {emailConfig && (
                    <Chip label={`Email: ${emailConfig.label}`} size="small" sx={{ height: 18, fontSize: "0.6rem", bgcolor: emailConfig.bgcolor, color: emailConfig.textColor }} />
                  )}
                  {phoneConfig && (
                    <Chip label={`Phone: ${phoneConfig.label}`} size="small" sx={{ height: 18, fontSize: "0.6rem", bgcolor: phoneConfig.bgcolor, color: phoneConfig.textColor }} />
                  )}
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0, pb: 1 }}>
                {ipqs.email?.success && (
                  <Box sx={{ mb: 1.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, display: "block", mb: 0.5 }}>
                      Email Validation
                    </Typography>
                    <Box sx={{ bgcolor: emailConfig?.bgcolor || "grey.50", borderRadius: 1, p: 0.5, borderLeft: `3px solid ${emailConfig?.color || "grey"}` }}>
                      <IPQSDetailRow label="Fraud Score" value={ipqs.email.fraud_score} />
                      <IPQSDetailRow label="Valid" value={ipqs.email.valid} isBool />
                      <IPQSDetailRow label="Disposable" value={ipqs.email.disposable} isBool />
                      <IPQSDetailRow label="Honeypot" value={ipqs.email.honeypot} isBool />
                      <IPQSDetailRow label="Recent Abuse" value={ipqs.email.recent_abuse} isBool />
                      <IPQSDetailRow label="Catch All" value={ipqs.email.catch_all} isBool />
                      <IPQSDetailRow label="DNS Valid" value={ipqs.email.dns_valid} isBool />
                      <IPQSDetailRow label="Deliverability" value={ipqs.email.deliverability} />
                      <IPQSDetailRow label="Leaked" value={ipqs.email.leaked} isBool />
                    </Box>
                  </Box>
                )}
                {ipqs.phone?.success && (
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 600, display: "block", mb: 0.5 }}>
                      Phone Validation
                    </Typography>
                    <Box sx={{ bgcolor: phoneConfig?.bgcolor || "grey.50", borderRadius: 1, p: 0.5, borderLeft: `3px solid ${phoneConfig?.color || "grey"}` }}>
                      <IPQSDetailRow label="Fraud Score" value={ipqs.phone.fraud_score} />
                      <IPQSDetailRow label="Valid" value={ipqs.phone.valid} isBool />
                      <IPQSDetailRow label="Active" value={ipqs.phone.active} isBool />
                      <IPQSDetailRow label="VOIP" value={ipqs.phone.VOIP} isBool />
                      <IPQSDetailRow label="Prepaid" value={ipqs.phone.prepaid} isBool />
                      <IPQSDetailRow label="Risky" value={ipqs.phone.risky} isBool />
                      <IPQSDetailRow label="Line Type" value={ipqs.phone.line_type} />
                      <IPQSDetailRow label="Carrier" value={ipqs.phone.carrier} />
                      <IPQSDetailRow label="Country" value={ipqs.phone.country} />
                      <IPQSDetailRow label="Do Not Call" value={ipqs.phone.do_not_call} isBool />
                      <IPQSDetailRow label="Spammer" value={ipqs.phone.spammer} isBool />
                    </Box>
                  </Box>
                )}
              </AccordionDetails>
            </Accordion>
          </>
        )}

        {/* Personal Info */}
        {(lead.gender || lead.dob || lead.address || lead.sin) && (
          <>
            <SectionHeader>Personal Info</SectionHeader>
            {lead.gender && <InfoRow icon={PersonIcon} label="Gender" value={lead.gender} />}
            {lead.dob && <InfoRow icon={CalendarIcon} label="Date of Birth" value={formatDateShort(lead.dob)} />}
            {lead.address && <InfoRow icon={LocationIcon} label="Address" value={lead.address} />}
            {lead.sin && <InfoRow icon={PersonIcon} label="SIN" value={lead.sin} />}
            <Divider sx={{ my: 2 }} />
          </>
        )}

        {/* Business Info */}
        {(lead.assignedClientBrokers?.length > 0 || lead.clientBroker || lead.clientNetwork || lead.ourNetwork || lead.campaign) && (
          <>
            <SectionHeader>Business Info</SectionHeader>
            {(lead.assignedClientBrokers?.length > 0 || lead.clientBroker) && (
              <InfoRow icon={BusinessIcon} label="Client Broker">
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {lead.assignedClientBrokers?.[0]?.name || lead.clientBroker || "N/A"}
                  {lead.assignedClientBrokers?.[0]?.domain && (
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                      ({lead.assignedClientBrokers[0].domain})
                    </Typography>
                  )}
                </Typography>
              </InfoRow>
            )}
            {lead.clientNetwork && <InfoRow icon={BusinessIcon} label="Client Network" value={lead.clientNetwork} />}
            {lead.ourNetwork && <InfoRow icon={BusinessIcon} label="Our Network" value={lead.ourNetwork} />}
            {lead.campaign && <InfoRow icon={BusinessIcon} label="Campaign" value={lead.campaign} />}
            <Divider sx={{ my: 2 }} />
          </>
        )}

        {/* Agent Assignment */}
        {lead.assignedAgent && (
          <>
            <SectionHeader>Assignment</SectionHeader>
            <InfoRow icon={PersonIcon} label="Assigned Agent" color="success">
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {typeof lead.assignedAgent === "object"
                  ? `${lead.assignedAgent.fullName}${lead.assignedAgent.fourDigitCode ? ` (${lead.assignedAgent.fourDigitCode})` : ""}`
                  : "Assigned"}
              </Typography>
              {typeof lead.assignedAgent === "object" && lead.assignedAgent.email && (
                <Typography variant="caption" color="text.secondary" display="block">
                  {lead.assignedAgent.email}
                </Typography>
              )}
            </InfoRow>
            <Divider sx={{ my: 2 }} />
          </>
        )}

        {/* Deposit Status */}
        {lead.depositConfirmed && (
          <>
            <SectionHeader color="success.main">Deposit Status</SectionHeader>
            <Box sx={{ p: 1.5, bgcolor: (theme) => alpha(theme.palette.success.main, 0.08), borderRadius: 1, borderLeft: 3, borderColor: "success.main", mb: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: "success.main", mb: 0.5 }}>
                Deposit Confirmed
              </Typography>
              {lead.depositCardIssuer && (
                <Typography variant="caption" display="block" sx={{ mb: 0.25 }}>
                  Card Issuer: {typeof lead.depositCardIssuer === "object" ? lead.depositCardIssuer.name : lead.depositCardIssuer}
                </Typography>
              )}
              {lead.depositPSP && (
                <Typography variant="caption" display="block" color="primary.main" sx={{ fontWeight: 600, mb: 0.25 }}>
                  PSP: {typeof lead.depositPSP === "object" ? lead.depositPSP.name : lead.depositPSP}
                </Typography>
              )}
              {lead.depositConfirmedBy && (
                <Typography variant="caption" display="block" color="text.secondary">
                  By: {typeof lead.depositConfirmedBy === "object" ? lead.depositConfirmedBy.fullName : "Unknown"}
                </Typography>
              )}
              {lead.depositConfirmedAt && (
                <Typography variant="caption" display="block" color="text.secondary">
                  {formatDate(lead.depositConfirmedAt)}
                </Typography>
              )}
            </Box>
            <Divider sx={{ my: 2 }} />
          </>
        )}

        {/* Shaved Status */}
        {lead.shaved && (
          <>
            <SectionHeader color="error.main">Shaved Status</SectionHeader>
            <Box sx={{ p: 1.5, bgcolor: (theme) => alpha(theme.palette.error.main, 0.08), borderRadius: 1, borderLeft: 3, borderColor: "error.main", mb: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: "error.main", mb: 0.5 }}>
                Marked as Shaved
              </Typography>
              {lead.shavedRefundsManager && (
                <Typography variant="caption" display="block">
                  Refunds Manager: {typeof lead.shavedRefundsManager === "object" ? lead.shavedRefundsManager.fullName : "Assigned"}
                </Typography>
              )}
              {lead.shavedBy && (
                <Typography variant="caption" display="block" color="text.secondary">
                  By: {typeof lead.shavedBy === "object" ? lead.shavedBy.fullName : "Unknown"}
                </Typography>
              )}
              {lead.shavedAt && (
                <Typography variant="caption" display="block" color="text.secondary">
                  {formatDate(lead.shavedAt)}
                </Typography>
              )}
            </Box>
            <Divider sx={{ my: 2 }} />
          </>
        )}

        {/* Documents - only from fullLead which has fresh signed S3 URLs */}
        {!fullLead && initialLeadData?.documents?.length > 0 && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, p: 1, border: 1, borderColor: "divider", borderRadius: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="caption" color="text.secondary">Loading documents...</Typography>
          </Box>
        )}
        {fullLead?.documents && fullLead.documents.length > 0 && (
          <Accordion
            elevation={0}
            sx={{ border: 1, borderColor: "divider", borderRadius: 1, "&:before": { display: "none" }, mb: 2 }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40, "& .MuiAccordionSummary-content": { my: 0.5 } }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 0.5, fontSize: "0.85rem" }}>
                <AttachFileIcon fontSize="small" />
                Documents ({fullLead.documents.length})
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0, pb: 1 }}>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                {fullLead.documents.map((doc, index) => (
                    <Box key={index} sx={{ display: "flex", alignItems: "center", gap: 1, p: 0.75, bgcolor: "action.hover", borderRadius: 0.5 }}>
                      <AttachFileIcon fontSize="small" color="action" />
                      <DocumentPreview url={doc.url} type={doc.description || `Document ${index + 1}`} forceImage>
                        <Typography color="primary" sx={{ cursor: "pointer", fontSize: "0.85rem" }}>
                          {doc.description || `Document ${index + 1}`}
                        </Typography>
                      </DocumentPreview>
                    </Box>
                  ))}
              </Box>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Comments */}
        <Accordion
          elevation={0}
          defaultExpanded={false}
          sx={{ border: 1, borderColor: "divider", borderRadius: 1, "&:before": { display: "none" }, mb: 2 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40, "& .MuiAccordionSummary-content": { my: 0.5 } }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 0.5, fontSize: "0.85rem" }}>
              <CommentIcon fontSize="small" />
              Comments {fullLead?.comments?.length ? `(${fullLead.comments.length})` : ""}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0, pb: 1 }}>
            {!fullLead ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="caption" color="text.secondary">Loading comments...</Typography>
              </Box>
            ) : fullLead.comments?.length > 0 ? (
              <Box sx={{ maxHeight: 250, overflowY: "auto", mb: 1 }}>
                {[...fullLead.comments].reverse().map((comment, index) => (
                  <Box key={index} sx={{ p: 1, mb: 0.5, bgcolor: "action.hover", borderRadius: 1 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.25 }}>
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        {comment.author?.fullName || "Unknown"}
                        {comment.author?.fourDigitCode && (
                          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                            ({comment.author.fourDigitCode})
                          </Typography>
                        )}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(comment.createdAt)}
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ fontSize: "0.8rem" }}>
                      {comment.text}
                    </Typography>
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography variant="caption" color="text.secondary" sx={{ py: 1, display: "block" }}>
                No comments yet
              </Typography>
            )}
            {/* Add Comment */}
            <Box sx={{ display: "flex", gap: 0.5, mt: 1 }}>
              <TextField
                size="small"
                fullWidth
                placeholder="Add a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                disabled={addingComment}
                multiline
                maxRows={3}
                sx={{ "& .MuiInputBase-input": { fontSize: "0.8rem" } }}
              />
              <IconButton
                size="small"
                color="primary"
                onClick={handleAddComment}
                disabled={!commentText.trim() || addingComment}
              >
                {addingComment ? <CircularProgress size={18} /> : <SendIcon fontSize="small" />}
              </IconButton>
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Social Media */}
        {lead.socialMedia && Object.values(lead.socialMedia).some(Boolean) && (
          <>
            <SectionHeader>Social Media</SectionHeader>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 2 }}>
              {lead.socialMedia.facebook && (
                <Chip label="Facebook" size="small" component="a" href={lead.socialMedia.facebook} target="_blank" rel="noopener" clickable sx={{ fontSize: "0.7rem" }} />
              )}
              {lead.socialMedia.twitter && (
                <Chip label="Twitter" size="small" component="a" href={lead.socialMedia.twitter} target="_blank" rel="noopener" clickable sx={{ fontSize: "0.7rem" }} />
              )}
              {lead.socialMedia.linkedin && (
                <Chip label="LinkedIn" size="small" component="a" href={lead.socialMedia.linkedin} target="_blank" rel="noopener" clickable sx={{ fontSize: "0.7rem" }} />
              )}
              {lead.socialMedia.instagram && (
                <Chip label="Instagram" size="small" component="a" href={lead.socialMedia.instagram} target="_blank" rel="noopener" clickable sx={{ fontSize: "0.7rem" }} />
              )}
              {lead.socialMedia.telegram && (
                <Chip label="Telegram" size="small" component="a" href={lead.socialMedia.telegram} target="_blank" rel="noopener" clickable sx={{ fontSize: "0.7rem" }} />
              )}
              {lead.socialMedia.whatsapp && (
                <Chip label="WhatsApp" size="small" component="a" href={lead.socialMedia.whatsapp} target="_blank" rel="noopener" clickable sx={{ fontSize: "0.7rem" }} />
              )}
            </Box>
            <Divider sx={{ my: 2 }} />
          </>
        )}

        {/* Admin Actions / Audit Log */}
        {userRole === "admin" && fullLead?.adminActions?.length > 0 && (
          <Accordion
            elevation={0}
            sx={{ border: 1, borderColor: "divider", borderRadius: 1, "&:before": { display: "none" }, mb: 2 }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40, "& .MuiAccordionSummary-content": { my: 0.5 } }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: "0.85rem" }}>
                Audit Log ({fullLead.adminActions.length})
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0, pb: 1 }}>
              <Box sx={{ maxHeight: 200, overflowY: "auto" }}>
                {[...fullLead.adminActions].reverse().map((action, index) => (
                  <Box key={index} sx={{ p: 0.75, mb: 0.5, bgcolor: "action.hover", borderRadius: 0.5 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        {action.action || action.type}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(action.performedAt || action.createdAt)}
                      </Typography>
                    </Box>
                    {action.performedBy && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        By: {typeof action.performedBy === "object" ? action.performedBy.fullName : "Unknown"}
                      </Typography>
                    )}
                    {action.details && (
                      <Typography variant="caption" display="block" sx={{ mt: 0.25 }}>
                        {action.details}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Meta Info */}
        <Box sx={{ mt: 2, pt: 1, borderTop: 1, borderColor: "divider" }}>
          <Typography variant="caption" color="text.secondary" display="block">
            Lead ID: {lead._id}
          </Typography>
          {lead.createdAt && (
            <Typography variant="caption" color="text.secondary" display="block">
              Created: {formatDate(lead.createdAt)}
            </Typography>
          )}
          {lead.updatedAt && (
            <Typography variant="caption" color="text.secondary" display="block">
              Updated: {formatDate(lead.updatedAt)}
            </Typography>
          )}
        </Box>
      </Box>

      {/* Sticky Footer */}
      <Box
        sx={{
          position: "sticky",
          bottom: 0,
          bgcolor: "background.paper",
          borderTop: 1,
          borderColor: "divider",
          px: 2,
          py: 1.5,
          display: "flex",
          gap: 1,
        }}
      >
        <Button
          variant="outlined"
          size="small"
          startIcon={<OpenInNewIcon />}
          onClick={handleViewInLeadsPage}
          fullWidth
        >
          View in Leads Page
        </Button>
      </Box>
    </Drawer>
  );
};

export default LeadDetailDrawer;
