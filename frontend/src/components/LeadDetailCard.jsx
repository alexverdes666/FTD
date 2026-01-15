import React, { useState, useCallback } from "react";
import {
  Box,
  Typography,
  Grid,
  Chip,
  Paper,
  Link,
  Avatar,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
} from "@mui/material";
import {
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  Business as BusinessIcon,
  Facebook as FacebookIcon,
  Twitter as TwitterIcon,
  LinkedIn as LinkedInIcon,
  Instagram as InstagramIcon,
  Telegram as TelegramIcon,
  WhatsApp as WhatsAppIcon,
  CalendarToday as CalendarIcon,
  Assignment as AssignmentIcon,
  AttachFile as AttachFileIcon,
  ExpandMore as ExpandMoreIcon,
  Edit as EditIcon,
  Save as SaveIcon,
} from "@mui/icons-material";
import { useSelector } from "react-redux";
import { selectUser } from "../store/slices/authSlice";
import DocumentPreview from "./DocumentPreview";
import api from "../services/api";
import { formatPhoneWithCountryCode } from "../utils/phoneUtils";
const LeadDetailCard = ({ lead, onLeadUpdate }) => {
  const user = useSelector(selectUser);
  const [editingClientBroker, setEditingClientBroker] = useState(false);
  const [clientBrokers, setClientBrokers] = useState([]);
  const [loadingClientBrokers, setLoadingClientBrokers] = useState(false);
  const [selectedClientBrokerValue, setSelectedClientBrokerValue] = useState("");
  const [updatingClientBroker, setUpdatingClientBroker] = useState(false);
  const formatDate = (date) => {
    return date ? new Date(date).toLocaleDateString() : "N/A";
  };
  const formatDateTime = (date) => {
    return date ? new Date(date).toLocaleString() : "N/A";
  };
  const getSocialMediaIcon = (platform) => {
    const icons = {
      facebook: <FacebookIcon color="primary" />,
      twitter: <TwitterIcon color="info" />,
      linkedin: <LinkedInIcon color="primary" />,
      instagram: <InstagramIcon color="secondary" />,
      telegram: <TelegramIcon color="info" />,
      whatsapp: <WhatsAppIcon color="success" />,
    };
    return icons[platform] || <PersonIcon />;
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
        clientBroker: selectedClientBrokerValue || null
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
    <Box sx={{ bgcolor: "background.default", p: 2, borderRadius: 1 }}>
      <Grid container spacing={2}>
        {/* Header Section - Compact */}
        <Grid item xs={12}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 1.5, bgcolor: "background.paper", borderRadius: 1, border: 1, borderColor: "divider" }}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: "primary.main" }}>
              <PersonIcon fontSize="small" />
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                {lead.firstName} {lead.lastName}
              </Typography>
              <Box sx={{ display: "flex", gap: 0.5, mt: 0.5, flexWrap: "wrap" }}>
                <Chip
                  label={(lead.orderedAs || lead.leadType)?.toUpperCase()}
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{ height: "20px", fontSize: "0.7rem" }}
                />
                <Chip
                  label={lead.status || "Active"}
                  size="small"
                  color={getStatusColor(lead.status)}
                  sx={{ height: "20px", fontSize: "0.7rem" }}
                />
                <Chip
                  label={lead.priority || "Medium"}
                  size="small"
                  color={getPriorityColor(lead.priority)}
                  sx={{ height: "20px", fontSize: "0.7rem" }}
                />
              </Box>
            </Box>
          </Box>
        </Grid>

        {/* Contact & Personal Information - Compact Side by Side */}
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: 1.5, border: 1, borderColor: "divider", borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: "primary.main", display: "flex", alignItems: "center", gap: 0.5 }}>
              <EmailIcon fontSize="small" /> Contact Information
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <EmailIcon fontSize="small" color="action" />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                    Current Email
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: "0.85rem", fontWeight: 500 }}>
                    {lead.newEmail || "N/A"}
                  </Typography>
                </Box>
              </Box>
              {lead.oldEmail && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, pl: 1, borderLeft: 2, borderColor: "divider" }}>
                  <EmailIcon fontSize="small" color="disabled" />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                      Previous Email
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: "0.8rem", color: "text.secondary" }}>
                      {lead.oldEmail}
                    </Typography>
                  </Box>
                </Box>
              )}
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <PhoneIcon fontSize="small" color="action" />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                    Current Phone
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: "0.85rem", fontWeight: 500 }}>
                    {formatPhoneWithCountryCode(lead.newPhone, lead.country)}
                  </Typography>
                </Box>
              </Box>
              {lead.oldPhone && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, pl: 1, borderLeft: 2, borderColor: "divider" }}>
                  <PhoneIcon fontSize="small" color="disabled" />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                      Previous Phone
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: "0.8rem", color: "text.secondary" }}>
                      {formatPhoneWithCountryCode(lead.oldPhone, lead.country)}
                    </Typography>
                  </Box>
                </Box>
              )}
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <LocationIcon fontSize="small" color="action" />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                    Country
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: "0.85rem", fontWeight: 500 }}>
                    {lead.country || "N/A"}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Paper>
        </Grid>

        {/* Personal Information */}
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: 1.5, border: 1, borderColor: "divider", borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: "primary.main", display: "flex", alignItems: "center", gap: 0.5 }}>
              <PersonIcon fontSize="small" /> Personal Information
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <PersonIcon fontSize="small" color="action" />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                    Gender
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: "0.85rem", fontWeight: 500 }}>
                    {lead.gender || "Not specified"}
                  </Typography>
                </Box>
              </Box>
              {lead.dob && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <CalendarIcon fontSize="small" color="action" />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                      Date of Birth
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: "0.85rem", fontWeight: 500 }}>
                      {formatDate(lead.dob)}
                    </Typography>
                  </Box>
                </Box>
              )}
              {lead.address && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <LocationIcon fontSize="small" color="action" />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                      Address
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: "0.85rem", fontWeight: 500 }}>
                      {lead.address}
                    </Typography>
                  </Box>
                </Box>
              )}
              {lead.sin && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <AssignmentIcon fontSize="small" color="action" />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                      SIN
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: "0.85rem", fontWeight: 500 }}>
                      {lead.sin}
                    </Typography>
                  </Box>
                </Box>
              )}
              {lead.source && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <AssignmentIcon fontSize="small" color="action" />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                      Source
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: "0.85rem", fontWeight: 500 }}>
                      {lead.source}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>
          </Paper>
        </Grid>
        {/* Business Information */}
        {lead.client && (
          <Grid item xs={12} md={6}>
            <Paper elevation={0} sx={{ p: 1.5, border: 1, borderColor: "divider", borderRadius: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: "primary.main", display: "flex", alignItems: "center", gap: 0.5 }}>
                <BusinessIcon fontSize="small" /> Business Information
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <BusinessIcon fontSize="small" color="action" />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                    Client
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: "0.85rem", fontWeight: 500 }}>
                    {lead.client}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Grid>
        )}

        {/* Network Information - Compact */}
        {(lead.assignedClientBrokers?.length > 0 || lead.clientBroker || lead.clientNetwork) && (
          <Grid item xs={12} md={lead.client ? 6 : 12}>
            <Paper elevation={0} sx={{ p: 1.5, border: 1, borderColor: "divider", borderRadius: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: "primary.main", display: "flex", alignItems: "center", gap: 0.5 }}>
                <BusinessIcon fontSize="small" /> Network Information
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <Box>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={0.5}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem", fontWeight: 600 }}>
                      Client Broker
                    </Typography>
                    {!editingClientBroker && (
                      <IconButton size="small" onClick={handleStartEditClientBroker} sx={{ ml: 1, p: 0.5 }}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                  {editingClientBroker ? (
                    <Box>
                      {/* Client Broker History - More Compact */}
                      {lead.clientBrokerHistory && lead.clientBrokerHistory.length > 0 && (
                        <Box sx={{ mb: 1.5, p: 1, bgcolor: "warning.50", borderRadius: 1, border: "1px solid", borderColor: "warning.light" }}>
                          <Typography variant="caption" sx={{ fontWeight: "bold", fontSize: "0.75rem", display: "block", mb: 0.5 }}>
                            ⚠️ Previous Broker Assignments
                          </Typography>
                          <Box sx={{ maxHeight: 100, overflowY: "auto" }}>
                            {lead.clientBrokerHistory
                              .sort((a, b) => new Date(b.assignedAt) - new Date(a.assignedAt))
                              .map((history, index) => {
                                const brokerName = history.clientBroker?.name || "Unknown Broker";
                                const brokerDomain = history.clientBroker?.domain;
                                const assignedDate = new Date(history.assignedAt).toLocaleDateString();

                                return (
                                  <Box key={index} sx={{ mb: 0.5, p: 0.75, bgcolor: "background.paper", borderRadius: 0.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <Typography variant="caption" sx={{ fontSize: "0.7rem", fontWeight: 500 }}>
                                      {brokerName}
                                      {brokerDomain && (
                                        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5, fontSize: "0.65rem" }}>
                                          ({brokerDomain})
                                        </Typography>
                                      )}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.65rem" }}>
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
                              history => history.clientBroker?._id === broker._id
                            );
                            
                            return (
                              <MenuItem key={broker._id} value={broker._id}>
                                <Box sx={{ display: "flex", alignItems: "center", width: "100%" }}>
                                  <Box sx={{ flex: 1 }}>
                                    {broker.name}
                                    {broker.description && (
                                      <Typography variant="caption" color="text.secondary" sx={{ ml: 1, fontStyle: "italic" }}>
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
                          startIcon={updatingClientBroker ? <CircularProgress size={14} /> : <SaveIcon fontSize="small" />}
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
                  ) : (
                    <Typography variant="body2" sx={{ fontSize: "0.85rem", fontWeight: 500 }}>
                      {lead.assignedClientBrokers?.[0]?.name || lead.clientBroker || "N/A"}
                      {lead.assignedClientBrokers?.[0]?.domain && 
                        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                          ({lead.assignedClientBrokers[0].domain})
                        </Typography>
                      }
                    </Typography>
                  )}
                </Box>
                {lead.clientNetwork && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <BusinessIcon fontSize="small" color="action" />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                        Client Network
                      </Typography>
                      <Typography variant="body2" sx={{ fontSize: "0.85rem", fontWeight: 500 }}>
                        {lead.clientNetwork}
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Box>
            </Paper>
          </Grid>
        )}
        {/* Social Media - Compact */}
        {lead.socialMedia && Object.values(lead.socialMedia).some((value) => value) && (
          <Grid item xs={12}>
            <Paper elevation={0} sx={{ p: 1.5, border: 1, borderColor: "divider", borderRadius: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: "primary.main", fontSize: "0.85rem" }}>
                Social Media
              </Typography>
              <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
                {Object.entries(lead.socialMedia).map(
                  ([platform, value]) =>
                    value && (
                      <Box key={platform} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        {getSocialMediaIcon(platform)}
                        <Link href={value} target="_blank" rel="noopener" sx={{ fontSize: "0.8rem" }}>
                          {platform.charAt(0).toUpperCase() + platform.slice(1)}
                        </Link>
                      </Box>
                    )
                )}
              </Box>
            </Paper>
          </Grid>
        )}

        {/* Documents - Compact Accordion */}
        {lead.documents && lead.documents.length > 0 && (
          <Grid item xs={12}>
            <Accordion elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: 1, '&:before': { display: 'none' } }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "primary.main", display: "flex", alignItems: "center", gap: 0.5, fontSize: "0.85rem" }}>
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
                      <Box key={index} sx={{ display: "flex", alignItems: "center", gap: 1, p: 0.75, bgcolor: "action.hover", borderRadius: 0.5 }}>
                        <AttachFileIcon fontSize="small" color="action" />
                        {isImage ? (
                          <DocumentPreview url={doc.url} type={doc.description || `Document ${index + 1}`}>
                            <Typography color="primary" sx={{ cursor: "pointer", fontSize: "0.85rem" }}>
                              {doc.description || `Document ${index + 1}`}
                            </Typography>
                          </DocumentPreview>
                        ) : (
                          <Link href={doc.url} target="_blank" rel="noopener" sx={{ fontSize: "0.85rem" }}>
                            {doc.description || `Document ${index + 1}`}
                          </Link>
                        )}
                        {isImage && (
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem", ml: "auto" }}>
                            Click to view
                          </Typography>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              </AccordionDetails>
            </Accordion>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};
export default LeadDetailCard;
