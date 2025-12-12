import React, { useState, useCallback } from "react";
import {
  Box,
  Typography,
  Grid,
  Chip,
  Divider,
  Card,
  CardContent,
  Link,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
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
    <Card elevation={2} sx={{ mb: 2 }}>
      <CardContent>
        <Grid container spacing={3}>
          {}
          <Grid item xs={12}>
            <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
              <Avatar sx={{ mr: 2, bgcolor: "primary.main" }}>
                <PersonIcon />
              </Avatar>
              <Box>
                <Typography variant="h6" component="div">
                  {lead.firstName} {lead.lastName}
                </Typography>
                <Box
                  sx={{
                    display: "flex",
                    gap: 1,
                    alignItems: "center",
                    mt: 0.5,
                  }}
                >
                  <Chip
                    label={(lead.orderedAs || lead.leadType)?.toUpperCase()}
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
                    label={`Priority: ${lead.priority || "Medium"}`}
                    size="small"
                    color={getPriorityColor(lead.priority)}
                  />
                </Box>
              </Box>
            </Box>
          </Grid>
          {}
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" gutterBottom color="primary">
              <EmailIcon sx={{ mr: 1, verticalAlign: "middle" }} />
              Contact Information
            </Typography>
            <List dense>
              <ListItem>
                <ListItemIcon>
                  <EmailIcon color="action" />
                </ListItemIcon>
                <ListItemText
                  primary="Current Email"
                  secondary={lead.newEmail || "N/A"}
                />
              </ListItem>
              {lead.oldEmail && (
                <ListItem>
                  <ListItemIcon>
                    <EmailIcon color="disabled" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Previous Email"
                    secondary={lead.oldEmail}
                  />
                </ListItem>
              )}
              <ListItem>
                <ListItemIcon>
                  <PhoneIcon color="action" />
                </ListItemIcon>
                <ListItemText
                  primary="Current Phone"
                  secondary={
                    lead.prefix && lead.newPhone
                      ? `${lead.prefix} ${lead.newPhone}`
                      : lead.newPhone || "N/A"
                  }
                />
              </ListItem>
              {lead.oldPhone && (
                <ListItem>
                  <ListItemIcon>
                    <PhoneIcon color="disabled" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Previous Phone"
                    secondary={
                      lead.prefix && lead.oldPhone
                        ? `${lead.prefix} ${lead.oldPhone}`
                        : lead.oldPhone
                    }
                  />
                </ListItem>
              )}
              <ListItem>
                <ListItemIcon>
                  <LocationIcon color="action" />
                </ListItemIcon>
                <ListItemText
                  primary="Country"
                  secondary={lead.country || "N/A"}
                />
              </ListItem>
            </List>
          </Grid>
          {}
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" gutterBottom color="primary">
              <PersonIcon sx={{ mr: 1, verticalAlign: "middle" }} />
              Personal Information
            </Typography>
            <List dense>
              <ListItem>
                <ListItemIcon>
                  <PersonIcon color="action" />
                </ListItemIcon>
                <ListItemText
                  primary="Gender"
                  secondary={lead.gender || "Not specified"}
                />
              </ListItem>
              {lead.dob && (
                <ListItem>
                  <ListItemIcon>
                    <CalendarIcon color="action" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Date of Birth"
                    secondary={formatDate(lead.dob)}
                  />
                </ListItem>
              )}
              {lead.address && (
                <ListItem>
                  <ListItemIcon>
                    <LocationIcon color="action" />
                  </ListItemIcon>
                  <ListItemText primary="Address" secondary={lead.address} />
                </ListItem>
              )}
              {lead.sin && (
                <ListItem>
                  <ListItemIcon>
                    <AssignmentIcon color="action" />
                  </ListItemIcon>
                  <ListItemText primary="SIN" secondary={lead.sin} />
                </ListItem>
              )}
              {lead.source && (
                <ListItem>
                  <ListItemIcon>
                    <AssignmentIcon color="action" />
                  </ListItemIcon>
                  <ListItemText primary="Source" secondary={lead.source} />
                </ListItem>
              )}
            </List>
          </Grid>
          {}
          {lead.client && (
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" gutterBottom color="primary">
                <BusinessIcon sx={{ mr: 1, verticalAlign: "middle" }} />
                Business Information
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Client
                  </Typography>
                  <Typography variant="body1">{lead.client}</Typography>
                </Grid>
              </Grid>
            </Grid>
          )}
          {}
          {(lead.assignedClientBrokers?.length > 0 || lead.clientBroker || lead.clientNetwork) && (
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" gutterBottom color="primary">
                <BusinessIcon sx={{ mr: 1, verticalAlign: "middle" }} />
                Network Information
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                    <Typography variant="body2" color="text.secondary">
                      Client Broker
                    </Typography>
                    {!editingClientBroker && (
                      <IconButton
                        size="small"
                        onClick={handleStartEditClientBroker}
                        sx={{ ml: 1 }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                  {editingClientBroker ? (
                    <Box>
                      {/* Client Broker History */}
                      {lead.clientBrokerHistory && lead.clientBrokerHistory.length > 0 && (
                        <Box sx={{ mb: 2, p: 2, bgcolor: "action.hover", borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
                          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: "bold" }}>
                            📋 Previous Client Broker Assignments
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
                            This lead has been sent to the following brokers:
                          </Typography>
                          <Box sx={{ maxHeight: 150, overflowY: "auto" }}>
                            {lead.clientBrokerHistory
                              .sort((a, b) => new Date(b.assignedAt) - new Date(a.assignedAt))
                              .map((history, index) => {
                                const brokerName = history.clientBroker?.name || "Unknown Broker";
                                const brokerDomain = history.clientBroker?.domain;
                                const assignedDate = new Date(history.assignedAt).toLocaleDateString();

                                return (
                                  <Box key={index} sx={{ mb: 1, p: 1, bgcolor: "background.paper", borderRadius: 0.5, border: "1px solid", borderColor: "divider" }}>
                                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                                      <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                                        {brokerName}
                                        {brokerDomain && (
                                          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                            ({brokerDomain})
                                          </Typography>
                                        )}
                                      </Typography>
                                    </Box>
                                    <Typography variant="caption" color="text.secondary">
                                      Sent on {assignedDate}
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
                            // Check if this lead has been sent to this broker before
                            const hasBeenSentBefore = lead.clientBrokerHistory?.some(
                              history => history.clientBroker?._id === broker._id
                            );
                            
                            return (
                              <MenuItem key={broker._id} value={broker._id}>
                                <Box sx={{ display: "flex", alignItems: "center", width: "100%" }}>
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
                                      sx={{ ml: 1, fontSize: "0.6rem", height: 20 }}
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
                          startIcon={updatingClientBroker ? <CircularProgress size={16} /> : <SaveIcon />}
                        >
                          Save
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={handleCancelEditClientBroker}
                          disabled={updatingClientBroker}
                        >
                          Cancel
                        </Button>
                      </Box>
                    </Box>
                  ) : (
                    <Typography variant="body1">
                      {lead.assignedClientBrokers?.[0]?.name || lead.clientBroker || "N/A"}
                      {lead.assignedClientBrokers?.[0]?.domain && 
                        ` (${lead.assignedClientBrokers[0].domain})`
                      }
                    </Typography>
                  )}
                </Grid>
                {lead.clientNetwork && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Client Network
                    </Typography>
                    <Typography variant="body1">
                      {lead.clientNetwork}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </Grid>
          )}
          {}
          {lead.socialMedia &&
            Object.values(lead.socialMedia).some((value) => value) && (
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle1" gutterBottom color="primary">
                  Social Media
                </Typography>
                <Grid container spacing={2}>
                  {Object.entries(lead.socialMedia).map(
                    ([platform, value]) =>
                      value && (
                        <Grid item xs={12} sm={6} md={4} key={platform}>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                            }}
                          >
                            {getSocialMediaIcon(platform)}
                            <Link href={value} target="_blank" rel="noopener">
                              {platform.charAt(0).toUpperCase() +
                                platform.slice(1)}
                            </Link>
                          </Box>
                        </Grid>
                      )
                  )}
                </Grid>
              </Grid>
            )}
          {}
          {lead.documents && lead.documents.length > 0 && (
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1" color="primary">
                    <AttachFileIcon sx={{ mr: 1, verticalAlign: "middle" }} />
                    Documents ({lead.documents.length})
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <List dense>
                    {lead.documents.map((doc, index) => {
                      const isImage =
                        doc.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ||
                        doc.url?.startsWith("data:image/");
                      return (
                        <ListItem key={index}>
                          <ListItemIcon>
                            <AttachFileIcon color="action" />
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              isImage ? (
                                <DocumentPreview
                                  url={doc.url}
                                  type={
                                    doc.description || `Document ${index + 1}`
                                  }
                                >
                                  <Typography
                                    color="primary"
                                    sx={{ cursor: "pointer" }}
                                  >
                                    {doc.description || `Document ${index + 1}`}
                                  </Typography>
                                </DocumentPreview>
                              ) : (
                                <Link
                                  href={doc.url}
                                  target="_blank"
                                  rel="noopener"
                                >
                                  {doc.description || `Document ${index + 1}`}
                                </Link>
                              )
                            }
                            secondary={
                              isImage ? "Click to view image" : doc.url
                            }
                          />
                        </ListItem>
                      );
                    })}
                  </List>
                </AccordionDetails>
              </Accordion>
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  );
};
export default LeadDetailCard;
