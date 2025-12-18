import React, { useState, useCallback } from "react";
import {
  Box,
  Typography,
  Chip,
  Divider,
  Paper,
  Link,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import {
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  Business as BusinessIcon,
  CalendarToday as CalendarIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  AttachFile as AttachFileIcon,
  ExpandMore as ExpandMoreIcon,
} from "@mui/icons-material";
import api from "../services/api";
import DocumentPreview from "./DocumentPreview";

/**
 * LeadQuickView - A compact popover component that displays key lead information on hover
 * This replaces the need to click and expand each lead individually
 */
const LeadQuickView = ({ lead, onLeadUpdate, titleExtra }) => {
  const [editingClientBroker, setEditingClientBroker] = useState(false);
  const [clientBrokers, setClientBrokers] = useState([]);
  const [loadingClientBrokers, setLoadingClientBrokers] = useState(false);
  const [selectedClientBrokerValue, setSelectedClientBrokerValue] = useState("");
  const [updatingClientBroker, setUpdatingClientBroker] = useState(false);

  const formatDate = (date) => {
    return date ? new Date(date).toLocaleDateString() : "N/A";
  };

  const getStatusColor = (status) => {
    const colors = {
      active: "success",
      contacted: "info",
      converted: "warning",
      inactive: "error",
    };
    return colors[status] || "default";
  };

  const getPriorityColor = (priority) => {
    const colors = {
      high: "error",
      medium: "warning",
      low: "info",
    };
    return colors[priority] || "default";
  };

  const fetchClientBrokers = useCallback(async () => {
    setLoadingClientBrokers(true);
    try {
      const response = await api.get("/client-brokers?isActive=true&limit=1000");
      setClientBrokers(response.data.data || []);
    } catch (err) {
      console.error("Failed to fetch client brokers:", err);
    } finally {
      setLoadingClientBrokers(false);
    }
  }, []);

  const handleStartEditClientBroker = useCallback(() => {
    if (!clientBrokers.length) {
      fetchClientBrokers();
    }
    // Set current value from lead's assigned client brokers
    const currentBroker = lead.assignedClientBrokers?.[0]?._id || "";
    setSelectedClientBrokerValue(currentBroker);
    setEditingClientBroker(true);
  }, [clientBrokers.length, fetchClientBrokers, lead.assignedClientBrokers]);

  const handleCancelEditClientBroker = useCallback(() => {
    setEditingClientBroker(false);
    const currentBroker = lead.assignedClientBrokers?.[0]?._id || "";
    setSelectedClientBrokerValue(currentBroker);
  }, [lead.assignedClientBrokers]);

  const handleUpdateClientBroker = useCallback(async () => {
    if (!lead) return;

    setUpdatingClientBroker(true);
    try {
      const updateData = {
        clientBroker: selectedClientBrokerValue || null,
      };

      const response = await api.put(`/leads/${lead._id}`, updateData);

      if (onLeadUpdate) {
        onLeadUpdate(response.data.data);
      }

      setEditingClientBroker(false);
    } catch (err) {
      console.error("Failed to update client broker:", err);
    } finally {
      setUpdatingClientBroker(false);
    }
  }, [lead, selectedClientBrokerValue, onLeadUpdate]);

  return (
    <Paper
      elevation={8}
      sx={{
        width: 1000,
        minHeight: 500,
        maxWidth: "95vw",
        p: 2,
        bgcolor: "background.paper",
        borderRadius: 2,
        border: 1,
        borderColor: "divider",
      }}
    >
      {/* Header - Full Width */}
      <Box sx={{ mb: 1.5 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
              {lead.firstName} {lead.lastName}
            </Typography>
            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
              <Chip
                label={(lead.orderedAs || lead.leadType)?.toUpperCase() || "UNKNOWN"}
                size="small"
                color="primary"
                variant="outlined"
              />
              <Chip
                label={lead.status || "Active"}
                size="small"
                color={getStatusColor(lead.status)}
              />
              <Chip
                label={lead.priority || "Medium"}
                size="small"
                color={getPriorityColor(lead.priority)}
              />
            </Box>
          </Box>
          {titleExtra && (
            <Box sx={{ ml: 2 }}>
              {titleExtra}
            </Box>
          )}
        </Box>
      </Box>

      <Divider sx={{ my: 1.5 }} />

      {/* Horizontal Layout - Main Sections */}
      <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
        {/* Contact Information */}
        <Box sx={{ flex: "1 1 250px", minWidth: 250 }}>
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 600, mb: 1, color: "primary.main" }}
          >
            Contact Details
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <EmailIcon fontSize="small" color="action" />
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">
                  Email
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {lead.newEmail || "N/A"}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <PhoneIcon fontSize="small" color="action" />
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">
                  Phone
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {lead.prefix && lead.newPhone
                    ? `${lead.prefix} ${lead.newPhone}`
                    : lead.newPhone || "N/A"}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <LocationIcon fontSize="small" color="action" />
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">
                  Country
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {lead.country || "N/A"}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Personal Information */}
        {(lead.gender || lead.dob || lead.address) && (
          <Box sx={{ flex: "1 1 250px", minWidth: 250 }}>
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 600, mb: 1, color: "primary.main" }}
            >
              Personal Info
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {lead.gender && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <PersonIcon fontSize="small" color="action" />
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Gender
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {lead.gender}
                    </Typography>
                  </Box>
                </Box>
              )}
              {lead.dob && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <CalendarIcon fontSize="small" color="action" />
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Date of Birth
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {formatDate(lead.dob)}
                    </Typography>
                  </Box>
                </Box>
              )}
              {lead.address && (
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                  <LocationIcon fontSize="small" color="action" sx={{ mt: 0.5 }} />
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Address
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {lead.address}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>
          </Box>
        )}

        {/* Business/Network Information */}
        {(lead.client || lead.assignedClientBrokers?.length > 0 || lead.clientBroker || lead.clientNetwork) && (
          <Box sx={{ flex: "1 1 250px", minWidth: 250, maxWidth: "100%" }}>
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 600, mb: 1, color: "primary.main" }}
            >
              Business Info
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {lead.client && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <BusinessIcon fontSize="small" color="action" />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Client
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: "break-word" }}>
                      {lead.client}
                    </Typography>
                  </Box>
                </Box>
              )}
              {(lead.assignedClientBrokers?.length > 0 || lead.clientBroker || true) && (
                <Box>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={0.5}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <BusinessIcon fontSize="small" color="action" />
                      <Typography variant="caption" color="text.secondary" display="block">
                        Client Broker
                      </Typography>
                    </Box>
                    {!editingClientBroker && (
                      <IconButton
                        size="small"
                        onClick={handleStartEditClientBroker}
                        sx={{ ml: 1, p: 0.5 }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                  {!editingClientBroker ? (
                    <Typography variant="body2" sx={{ fontWeight: 500, pl: 3.5, wordBreak: "break-word" }}>
                      {lead.assignedClientBrokers?.[0]?.name ||
                        lead.clientBroker ||
                        "N/A"}
                      {lead.assignedClientBrokers?.[0]?.domain && (
                        <Typography
                          component="span"
                          variant="caption"
                          color="text.secondary"
                          sx={{ ml: 0.5 }}
                        >
                          ({lead.assignedClientBrokers[0].domain})
                        </Typography>
                      )}
                    </Typography>
                  ) : null}
                </Box>
              )}
              {lead.clientNetwork && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <BusinessIcon fontSize="small" color="action" />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Client Network
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: "break-word" }}>
                      {lead.clientNetwork}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>
          </Box>
        )}

        {/* Assigned Agent */}
        {lead.assignedAgent && (
          <Box sx={{ flex: "1 1 200px", minWidth: 200 }}>
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 600, mb: 1, color: "primary.main" }}
            >
              Assignment
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <PersonIcon fontSize="small" color="success" />
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">
                  Assigned Agent
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {typeof lead.assignedAgent === "object" && lead.assignedAgent.fullName
                    ? lead.assignedAgent.fullName
                    : "Assigned"}
                </Typography>
                {typeof lead.assignedAgent === "object" && lead.assignedAgent.email && (
                  <Typography variant="caption" color="text.secondary">
                    {lead.assignedAgent.email}
                  </Typography>
                )}
              </Box>
            </Box>
          </Box>
        )}
      </Box>

      {/* Client Broker Editing Section - Full Width Below */}
      {editingClientBroker && (
        <>
          <Divider sx={{ my: 1.5 }} />
          <Box>
            {/* Client Broker History - More Compact */}
            {lead.clientBrokerHistory && lead.clientBrokerHistory.length > 0 && (
              <Box
                sx={{
                  mb: 1.5,
                  p: 1,
                  bgcolor: "warning.50",
                  borderRadius: 1,
                  border: "1px solid",
                  borderColor: "warning.light",
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: "bold",
                    fontSize: "0.75rem",
                    display: "block",
                    mb: 0.5,
                  }}
                >
                  ⚠️ Previous Broker Assignments
                </Typography>
                <Box sx={{ maxHeight: 100, overflowY: "auto" }}>
                  {lead.clientBrokerHistory
                    .sort((a, b) => new Date(b.assignedAt) - new Date(a.assignedAt))
                    .map((history, index) => {
                      const brokerName =
                        history.clientBroker?.name || "Unknown Broker";
                      const brokerDomain = history.clientBroker?.domain;
                      const assignedDate = new Date(
                        history.assignedAt
                      ).toLocaleDateString();

                      return (
                        <Box
                          key={index}
                          sx={{
                            mb: 0.5,
                            p: 0.75,
                            bgcolor: "background.paper",
                            borderRadius: 0.5,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{ fontSize: "0.7rem", fontWeight: 500 }}
                          >
                            {brokerName}
                            {brokerDomain && (
                              <Typography
                                component="span"
                                variant="caption"
                                color="text.secondary"
                                sx={{ ml: 0.5, fontSize: "0.65rem" }}
                              >
                                ({brokerDomain})
                              </Typography>
                            )}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ fontSize: "0.65rem" }}
                          >
                            {assignedDate}
                          </Typography>
                        </Box>
                      );
                    })}
                </Box>
              </Box>
            )}

            <FormControl size="small" fullWidth sx={{ mb: 1 }}>
              <InputLabel>Client Broker</InputLabel>
              <Select
                value={selectedClientBrokerValue}
                onChange={(e) => setSelectedClientBrokerValue(e.target.value)}
                label="Client Broker"
                disabled={updatingClientBroker || loadingClientBrokers}
                displayEmpty
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {clientBrokers.map((broker) => {
                  const hasBeenSentBefore = lead.clientBrokerHistory?.some(
                    (history) => history.clientBroker?._id === broker._id
                  );

                  return (
                    <MenuItem key={broker._id} value={broker._id}>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          width: "100%",
                        }}
                      >
                        <Box sx={{ flex: 1 }}>
                          {broker.name}
                          {broker.description && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ ml: 1, fontStyle: "italic" }}
                            >
                              - {broker.description}
                            </Typography>
                          )}
                        </Box>
                        {hasBeenSentBefore && (
                          <Chip
                            label="Previously sent"
                            size="small"
                            color="warning"
                            variant="outlined"
                            sx={{ ml: 1, fontSize: "0.6rem", height: 18 }}
                          />
                        )}
                      </Box>
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
            <Box display="flex" gap={1}>
              <Button
                size="small"
                variant="contained"
                onClick={handleUpdateClientBroker}
                disabled={updatingClientBroker}
                startIcon={
                  updatingClientBroker ? (
                    <CircularProgress size={14} />
                  ) : (
                    <SaveIcon fontSize="small" />
                  )
                }
                sx={{ fontSize: "0.75rem", px: 1.5, py: 0.5 }}
              >
                Save
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={handleCancelEditClientBroker}
                disabled={updatingClientBroker}
                sx={{ fontSize: "0.75rem", px: 1.5, py: 0.5 }}
              >
                Cancel
              </Button>
            </Box>
          </Box>
        </>
      )}

      {/* Documents - Compact Accordion - Full Width Below */}
      {lead.documents && lead.documents.length > 0 && (
        <>
          <Divider sx={{ my: 1.5 }} />
          <Accordion
            elevation={0}
            sx={{
              border: 1,
              borderColor: "divider",
              borderRadius: 1,
              "&:before": { display: "none" },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{ minHeight: 40, "& .MuiAccordionSummary-content": { my: 0.5 } }}
            >
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 600,
                  color: "primary.main",
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  fontSize: "0.85rem",
                }}
              >
                <AttachFileIcon fontSize="small" />
                Documents ({lead.documents.length})
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0, pb: 1 }}>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                {lead.documents.map((doc, index) => {
                  const isImage =
                    doc.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ||
                    doc.url?.startsWith("data:image/");
                  return (
                    <Box
                      key={index}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        p: 0.75,
                        bgcolor: "action.hover",
                        borderRadius: 0.5,
                      }}
                    >
                      <AttachFileIcon fontSize="small" color="action" />
                      {isImage ? (
                        <DocumentPreview
                          url={doc.url}
                          type={doc.description || `Document ${index + 1}`}
                        >
                          <Typography
                            color="primary"
                            sx={{ cursor: "pointer", fontSize: "0.85rem" }}
                          >
                            {doc.description || `Document ${index + 1}`}
                          </Typography>
                        </DocumentPreview>
                      ) : (
                        <Link
                          href={doc.url}
                          target="_blank"
                          rel="noopener"
                          sx={{ fontSize: "0.85rem" }}
                        >
                          {doc.description || `Document ${index + 1}`}
                        </Link>
                      )}
                      {isImage && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ fontSize: "0.7rem", ml: "auto" }}
                        >
                          Click to view
                        </Typography>
                      )}
                    </Box>
                  );
                })}
              </Box>
            </AccordionDetails>
          </Accordion>
        </>
      )}

      {/* Assigned Agent - Removed as it's now in horizontal layout */}

    </Paper>
  );
};

export default LeadQuickView;
