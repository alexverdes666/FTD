import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSelector } from "react-redux";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Card,
  CardContent,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TablePagination,
  IconButton,
  Collapse,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Checkbox,
  Stack,
  Avatar,
  Divider,
  FormControlLabel,
  Switch,
  Link,
  Tooltip,
  DialogContentText,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Search as SearchIcon,
  Comment as CommentIcon,
  Assignment as AssignmentIcon,
  PersonAdd as PersonAddIcon,
  FilterList as FilterIcon,
  Description as DescriptionIcon,
  FileUpload as ImportIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Contacts as ContactsIcon,
  Info as InfoIcon,
  AssignmentInd as AssignmentIndIcon,
  Share as ShareIcon,
  Facebook as FacebookIcon,
  Twitter as TwitterIcon,
  LinkedIn as LinkedInIcon,
  Instagram as InstagramIcon,
  Telegram as TelegramIcon,
  WhatsApp as WhatsAppIcon,
  Videocam as VideocamIcon,
  PlayArrow as PlayArrowIcon,
} from "@mui/icons-material";
import AddLeadForm from "../components/AddLeadForm";
import DocumentPreview from "../components/DocumentPreview";
import AssignLeadToAgentDialog from "../components/AssignLeadToAgentDialog";

import api from "../services/api";
import { selectUser } from "../store/slices/authSlice";
import { getSortedCountries } from "../constants/countries";
import ImportLeadsDialog from "../components/ImportLeadsDialog";
import EditLeadForm from "../components/EditLeadForm";
const glassMorphismStyles = {
  bgcolor: "rgba(255, 255, 255, 0.1)",
  backdropFilter: "blur(10px)",
  borderRadius: 2,
  border: "1px solid rgba(255, 255, 255, 0.2)",
  transition: "all 0.3s ease-in-out",
  "&:hover": {
    bgcolor: "rgba(255, 255, 255, 0.15)",
    backdropFilter: "blur(15px)",
    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.1)",
  },
  "& .MuiButton-root": {
    bgcolor: "rgba(255, 255, 255, 0.1)",
    backdropFilter: "blur(10px)",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    "&:hover": {
      bgcolor: "rgba(255, 255, 255, 0.15)",
      boxShadow: "0 4px 16px rgba(0, 0, 0, 0.1)",
    },
  },
  "& .MuiInputBase-root": {
    bgcolor: "rgba(255, 255, 255, 0.1)",
    backdropFilter: "blur(10px)",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    "&:hover": {
      bgcolor: "rgba(255, 255, 255, 0.15)",
      boxShadow: "0 4px 16px rgba(0, 0, 0, 0.1)",
    },
    "&.Mui-focused": {
      boxShadow: "0 0 0 3px rgba(100, 181, 246, 0.3)",
      borderColor: "primary.main",
    },
    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: "rgba(255, 255, 255, 0.3)",
    },
    "&:hover .MuiOutlinedInput-notchedOutline": {
      borderColor: "primary.light",
    },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
      borderColor: "primary.main",
    },
  },
};
const buttonGlassMorphismStyles = {
  bgcolor: "rgba(255, 255, 255, 0.15)",
  backdropFilter: "blur(10px)",
  border: "1px solid rgba(255, 255, 255, 0.3)",
  color: "text.primary",
  transition: "all 0.3s ease-in-out",
  "&:hover": {
    bgcolor: "rgba(255, 255, 255, 0.25)",
    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.1)",
  },
};
const inputGlassMorphismStyles = {
  bgcolor: "rgba(255, 255, 255, 0.1)",
  backdropFilter: "blur(8px)",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  borderRadius: 2,
  "& .MuiOutlinedInput-notchedOutline": {
    borderColor: "transparent",
  },
  "&:hover .MuiOutlinedInput-notchedOutline": {
    borderColor: "rgba(255, 255, 255, 0.4)",
  },
  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
    borderColor: "primary.main",
    boxShadow: "0 0 0 3px rgba(100, 181, 246, 0.3)",
  },
  "& .MuiInputBase-input": {
    color: "text.primary",
  },
  "& .MuiInputLabel-root": {
    color: "text.secondary",
  },
  "& .MuiInputLabel-root.Mui-focused": {
    color: "primary.main",
  },
};
const ROLES = {
  ADMIN: "admin",
  AFFILIATE_MANAGER: "affiliate_manager",
  LEAD_MANAGER: "lead_manager",
  AGENT: "agent",
};
const LEAD_STATUSES = {
  ACTIVE: "active",
  CONTACTED: "contacted",
  CONVERTED: "converted",
  INACTIVE: "inactive",
};
const LEAD_TYPES = {
  FTD: "ftd",
  FILLER: "filler",
  COLD: "cold",
};
const commentSchema = yup.object({
  text: yup
    .string()
    .required("Comment is required")
    .min(3, "Comment must be at least 3 characters"),
});
const getStatusColor = (status) => {
  switch (status) {
    case LEAD_STATUSES.ACTIVE:
    case LEAD_STATUSES.CONVERTED:
      return "success";
    case LEAD_STATUSES.CONTACTED:
      return "info";
    case LEAD_STATUSES.INACTIVE:
      return "error";
    default:
      return "default";
  }
};
const getLeadTypeColor = (leadType) => {
  if (!leadType) return "default";
  switch (leadType.toLowerCase()) {
    case LEAD_TYPES.FTD:
      return "success";
    case LEAD_TYPES.FILLER:
      return "warning";
    case LEAD_TYPES.COLD:
      return "info";
    default:
      return "default";
  }
};
// Helper function to get the display lead type (orderedAs takes precedence over leadType)
const getDisplayLeadType = (lead) => {
  return lead.orderedAs || lead.leadType;
};

// Helper function to calculate cooldown status for FTD/Filler leads (10-day cooldown)
const getCooldownStatus = (lead) => {
  const leadType = getDisplayLeadType(lead);
  
  // Only FTD and Filler leads have cooldown
  if (leadType !== 'ftd' && leadType !== 'filler') {
    return { hasCooldown: false, text: 'N/A', color: 'default' };
  }
  
  // If never used in an order, no cooldown
  if (!lead.lastUsedInOrder) {
    return { hasCooldown: false, text: 'Available', color: 'success' };
  }
  
  const lastUsedDate = new Date(lead.lastUsedInOrder);
  const now = new Date();
  const daysSinceUsed = Math.floor((now - lastUsedDate) / (1000 * 60 * 60 * 24));
  const cooldownPeriod = 10; // 10 days
  
  if (daysSinceUsed < cooldownPeriod) {
    const daysRemaining = cooldownPeriod - daysSinceUsed;
    return {
      hasCooldown: true,
      inCooldown: true,
      daysRemaining,
      text: `${daysRemaining}d left`,
      color: daysRemaining <= 2 ? 'warning' : 'error',
    };
  }
  
  return { hasCooldown: true, inCooldown: false, text: 'Available', color: 'success' };
};
const getDocumentStatusColor = (status) => {
  switch (status) {
    case "good":
      return "success";
    case "ok":
      return "warning";
    case "pending":
      return "error";
    default:
      return "default";
  }
};
const LeadDetails = React.memo(({ lead }) => (
  <Box
    sx={{
      animation: "fadeIn 0.3s ease-in-out",
      "@keyframes fadeIn": {
        "0%": {
          opacity: 0,
          transform: "translateY(-10px)",
        },
        "100%": {
          opacity: 1,
          transform: "translateY(0)",
        },
      },
    }}
  >
    <Grid container spacing={3}>
      {}
      <Grid item xs={12} md={4}>
        <Paper
          elevation={0}
          sx={{
            p: 2,
            bgcolor: "background.paper",
            borderRadius: 1,
            border: "1px solid",
            borderColor: "divider",
            height: "100%",
            transition: "all 0.2s ease-in-out",
            "&:hover": {
              boxShadow: (theme) => theme.shadows[4],
              transform: "translateY(-4px)",
            },
          }}
        >
          <Typography
            variant="subtitle2"
            gutterBottom
            sx={{
              color: "primary.main",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              gap: 1,
              mb: 2,
            }}
          >
            <PersonAddIcon fontSize="small" />
            Basic Information
          </Typography>
          <Stack spacing={2}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Full Name
              </Typography>
              <Typography variant="body1" fontWeight="medium">
                {lead.fullName ||
                  `${lead.firstName} ${lead.lastName || ""}`.trim()}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Lead ID
              </Typography>
              <Typography variant="body2" fontFamily="monospace">
                {lead._id}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Created
              </Typography>
              <Typography variant="body2">
                {new Date(lead.createdAt).toLocaleString()}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Last Updated
              </Typography>
              <Typography variant="body2">
                {new Date(lead.updatedAt).toLocaleString()}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Chip
                label={getDisplayLeadType(lead)?.toUpperCase() || "UNKNOWN"}
                color={getLeadTypeColor(getDisplayLeadType(lead))}
                size="small"
                sx={{ fontWeight: "medium" }}
              />
              <Chip
                label={
                  lead.status.charAt(0).toUpperCase() + lead.status.slice(1)
                }
                color={getStatusColor(lead.status)}
                size="small"
                sx={{ fontWeight: "medium" }}
              />
            </Stack>
          </Stack>
        </Paper>
      </Grid>
      {}
      <Grid item xs={12} md={4}>
        <Paper
          elevation={0}
          sx={{
            p: 2,
            bgcolor: "background.paper",
            borderRadius: 1,
            border: "1px solid",
            borderColor: "divider",
            height: "100%",
            transition: "all 0.2s ease-in-out",
            "&:hover": {
              boxShadow: (theme) => theme.shadows[4],
              transform: "translateY(-4px)",
            },
          }}
        >
          <Typography
            variant="subtitle2"
            gutterBottom
            sx={{
              color: "primary.main",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              gap: 1,
              mb: 2,
            }}
          >
            <ContactsIcon fontSize="small" />
            Contact Information
          </Typography>
          <Stack spacing={2}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Current Email
              </Typography>
              <Typography variant="body2">{lead.newEmail}</Typography>
              {lead.oldEmail && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                >
                  Previous: {lead.oldEmail}
                </Typography>
              )}
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Current Phone
              </Typography>
              <Typography variant="body2">{lead.newPhone}</Typography>
              {lead.oldPhone && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                >
                  Previous: {lead.oldPhone}
                </Typography>
              )}
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Address
              </Typography>
              <Typography variant="body2">
                {typeof lead.address === "string"
                  ? lead.address
                  : lead.address
                  ? `${lead.address.street || ""}, ${lead.address.city || ""} ${
                      lead.address.postalCode || ""
                    }`.trim()
                  : "N/A"}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Country
              </Typography>
              <Typography variant="body2">{lead.country || "N/A"}</Typography>
            </Box>
          </Stack>
        </Paper>
      </Grid>
      {}
      <Grid item xs={12} md={4}>
        <Paper
          elevation={0}
          sx={{
            p: 2,
            bgcolor: "background.paper",
            borderRadius: 1,
            border: "1px solid",
            borderColor: "divider",
            height: "100%",
            transition: "all 0.2s ease-in-out",
            "&:hover": {
              boxShadow: (theme) => theme.shadows[4],
              transform: "translateY(-4px)",
            },
          }}
        >
          <Typography
            variant="subtitle2"
            gutterBottom
            sx={{
              color: "primary.main",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              gap: 1,
              mb: 2,
            }}
          >
            <InfoIcon fontSize="small" />
            Additional Details
          </Typography>
          <Stack spacing={2}>
            {lead.sin && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  SIN
                </Typography>
                <Typography variant="body2" fontFamily="monospace">
                  {lead.sin}
                </Typography>
              </Box>
            )}
            {lead.dob && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Date of Birth
                </Typography>
                <Typography variant="body2">
                  {new Date(lead.dob).toLocaleDateString()}
                </Typography>
              </Box>
            )}
            <Box>
              <Typography variant="caption" color="text.secondary">
                Gender
              </Typography>
              <Typography variant="body2">
                {lead.gender
                  ? lead.gender.charAt(0).toUpperCase() + lead.gender.slice(1)
                  : "Not Specified"}
              </Typography>
            </Box>
            {lead.client && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Client
                </Typography>
                <Typography variant="body2">{lead.client}</Typography>
              </Box>
            )}
            {lead.clientBroker && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Client Broker
                </Typography>
                <Typography variant="body2">{lead.clientBroker}</Typography>
              </Box>
            )}
            {lead.clientNetwork && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Client Network
                </Typography>
                <Typography variant="body2">{lead.clientNetwork}</Typography>
              </Box>
            )}
          </Stack>
        </Paper>
      </Grid>
      {}
      {lead.assignedAgent && (
        <Grid item xs={12} md={4}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              bgcolor: "background.paper",
              borderRadius: 1,
              border: "1px solid",
              borderColor: "divider",
              transition: "all 0.2s ease-in-out",
              "&:hover": {
                boxShadow: (theme) => theme.shadows[4],
                transform: "translateY(-4px)",
              },
            }}
          >
            <Typography
              variant="subtitle2"
              gutterBottom
              sx={{
                color: "primary.main",
                fontWeight: "bold",
                display: "flex",
                alignItems: "center",
                gap: 1,
                mb: 2,
              }}
            >
              <AssignmentIndIcon fontSize="small" />
              Assignment Information
            </Typography>
            <Stack spacing={2}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Avatar sx={{ bgcolor: "primary.main" }}>
                  {lead.assignedAgent.fullName?.charAt(0) || "A"}
                </Avatar>
                <Box>
                  <Typography variant="body1" fontWeight="medium">
                    {lead.assignedAgent.fullName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Agent Code: {lead.assignedAgent.fourDigitCode}
                  </Typography>
                </Box>
              </Box>
              <Typography variant="body2">
                <Link href={`mailto:${lead.assignedAgent.email}`} color="primary">
                  {lead.assignedAgent.email}
                </Link>
              </Typography>
              {lead.assignedAgentAt && (
                <Typography variant="caption" color="text.secondary">
                  Assigned on: {new Date(lead.assignedAgentAt).toLocaleString()}
                </Typography>
              )}
            </Stack>
          </Paper>
        </Grid>
      )}
      {}
      {lead.socialMedia && Object.values(lead.socialMedia).some(Boolean) && (
        <Grid item xs={12} md={lead.assignedAgent ? 8 : 12}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              bgcolor: "background.paper",
              borderRadius: 1,
              border: "1px solid",
              borderColor: "divider",
              transition: "all 0.2s ease-in-out",
              "&:hover": {
                boxShadow: (theme) => theme.shadows[4],
                transform: "translateY(-4px)",
              },
            }}
          >
            <Typography
              variant="subtitle2"
              gutterBottom
              sx={{
                color: "primary.main",
                fontWeight: "bold",
                display: "flex",
                alignItems: "center",
                gap: 1,
                mb: 2,
              }}
            >
              <ShareIcon fontSize="small" />
              Social Media Profiles
            </Typography>
            <Grid container spacing={2}>
              {lead.socialMedia.facebook && (
                <Grid item xs={12} sm={6} md={4}>
                  <Link
                    href={lead.socialMedia.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      color: "text.primary",
                      textDecoration: "none",
                      p: 1,
                      borderRadius: 1,
                      "&:hover": {
                        bgcolor: "action.hover",
                      },
                    }}
                  >
                    <FacebookIcon color="primary" />
                    Facebook Profile
                  </Link>
                </Grid>
              )}
              {lead.socialMedia.twitter && (
                <Grid item xs={12} sm={6} md={4}>
                  <Link
                    href={lead.socialMedia.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      color: "text.primary",
                      textDecoration: "none",
                      p: 1,
                      borderRadius: 1,
                      "&:hover": {
                        bgcolor: "action.hover",
                      },
                    }}
                  >
                    <TwitterIcon color="info" />
                    Twitter Profile
                  </Link>
                </Grid>
              )}
              {lead.socialMedia.linkedin && (
                <Grid item xs={12} sm={6} md={4}>
                  <Link
                    href={lead.socialMedia.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      color: "text.primary",
                      textDecoration: "none",
                      p: 1,
                      borderRadius: 1,
                      "&:hover": {
                        bgcolor: "action.hover",
                      },
                    }}
                  >
                    <LinkedInIcon color="primary" />
                    LinkedIn Profile
                  </Link>
                </Grid>
              )}
              {lead.socialMedia.instagram && (
                <Grid item xs={12} sm={6} md={4}>
                  <Link
                    href={lead.socialMedia.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      color: "text.primary",
                      textDecoration: "none",
                      p: 1,
                      borderRadius: 1,
                      "&:hover": {
                        bgcolor: "action.hover",
                      },
                    }}
                  >
                    <InstagramIcon color="secondary" />
                    Instagram Profile
                  </Link>
                </Grid>
              )}
              {lead.socialMedia.telegram && (
                <Grid item xs={12} sm={6} md={4}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      p: 1,
                      borderRadius: 1,
                    }}
                  >
                    <TelegramIcon color="info" />
                    <Typography variant="body2">
                      {lead.socialMedia.telegram}
                    </Typography>
                  </Box>
                </Grid>
              )}
              {lead.socialMedia.whatsapp && (
                <Grid item xs={12} sm={6} md={4}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      p: 1,
                      borderRadius: 1,
                    }}
                  >
                    <WhatsAppIcon color="success" />
                    <Typography variant="body2">
                      {lead.socialMedia.whatsapp}
                    </Typography>
                  </Box>
                </Grid>
              )}
            </Grid>
          </Paper>
        </Grid>
      )}
      {}
      {lead.documents && lead.documents.length > 0 && (
        <Grid item xs={12}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              bgcolor: "background.paper",
              borderRadius: 1,
              border: "1px solid",
              borderColor: "divider",
              transition: "all 0.2s ease-in-out",
              "&:hover": {
                boxShadow: (theme) => theme.shadows[4],
                transform: "translateY(-4px)",
              },
            }}
          >
            <Typography
              variant="subtitle2"
              gutterBottom
              sx={{
                color: "primary.main",
                fontWeight: "bold",
                display: "flex",
                alignItems: "center",
                gap: 1,
                mb: 2,
              }}
            >
              <DescriptionIcon fontSize="small" />
              Documents
            </Typography>
            <Grid container spacing={2}>
              {lead.documents.map((doc, index) => (
                <Grid item xs={12} sm={6} md={4} key={index}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.5,
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 1,
                      "&:hover": {
                        bgcolor: "action.hover",
                      },
                    }}
                  >
                    {doc?.url &&
                    (doc.url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ||
                      doc.url.startsWith("data:image/")) ? (
                      <Box sx={{ mb: 1 }}>
                        <DocumentPreview
                          url={doc.url}
                          type={doc.description || `Document ${index + 1}`}
                        />
                      </Box>
                    ) : (
                      <Link
                        href={doc?.url || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          color: "primary.main",
                          textDecoration: "none",
                          mb: 1,
                        }}
                      >
                        <DescriptionIcon fontSize="small" />
                        {doc?.description || "View Document"}
                      </Link>
                    )}
                    {doc?.description && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                      >
                        {doc.description}
                      </Typography>
                    )}
                    {doc?.uploadedAt && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                      >
                        Uploaded: {new Date(doc.uploadedAt).toLocaleString()}
                      </Typography>
                    )}
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>
      )}
      {}
      {/* Session Recordings */}
      {lead.sessionRecordings && lead.sessionRecordings.length > 0 && (
        <Grid item xs={12}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              bgcolor: "background.paper",
              borderRadius: 1,
              border: "1px solid",
              borderColor: "divider",
              transition: "all 0.2s ease-in-out",
              "&:hover": {
                boxShadow: (theme) => theme.shadows[4],
                transform: "translateY(-4px)",
              },
            }}
          >
            <Typography
              variant="subtitle2"
              gutterBottom
              sx={{
                color: "primary.main",
                fontWeight: "bold",
                display: "flex",
                alignItems: "center",
                gap: 1,
                mb: 2,
              }}
            >
              <VideocamIcon fontSize="small" />
              Session Recordings
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Complete verification session recordings from both cameras.
            </Typography>
            <Grid container spacing={2}>
              {lead.sessionRecordings.map((recording, index) => (
                <Grid item xs={12} sm={6} md={4} key={index}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 1,
                      "&:hover": {
                        bgcolor: "action.hover",
                      },
                    }}
                  >
                    <Stack
                      direction="row"
                      alignItems="center"
                      spacing={2}
                      sx={{ mb: 2 }}
                    >
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 1,
                          bgcolor:
                            recording.cameraType === "front"
                              ? "primary.main"
                              : "secondary.main",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "white",
                        }}
                      >
                        📹
                      </Box>
                      <Box>
                        <Typography variant="subtitle2">
                          {recording.cameraType === "front"
                            ? "Front Camera"
                            : "Back Camera"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {Math.round(recording.duration / 1000)}s •{" "}
                          {(recording.fileSize / (1024 * 1024)).toFixed(1)}MB
                        </Typography>
                      </Box>
                    </Stack>
                    <Stack spacing={1}>
                      <Button
                        variant="contained"
                        size="small"
                        fullWidth
                        onClick={async () => {
                          try {
                            // Extract sessionId and filename from s3Key
                            const s3Key =
                              recording.s3Key ||
                              recording.s3Location
                                ?.split("/")
                                .slice(-2)
                                .join("/");
                            if (!s3Key) {
                              console.error("No S3 key found for recording");
                              return;
                            }

                            const [sessionId, filename] = s3Key.split("/");

                            // Get signed URL from our backend API
                            const response = await api.get(
                              `/video/${sessionId}/${filename}`
                            );

                            if (response.data.success) {
                              window.open(response.data.url, "_blank");
                            } else {
                              console.error(
                                "Failed to get video URL:",
                                response.data.error
                              );
                              alert("Error loading video. Please try again.");
                            }
                          } catch (error) {
                            console.error("Error fetching video:", error);
                            alert("Error loading video. Please try again.");
                          }
                        }}
                        startIcon={<PlayArrowIcon />}
                      >
                        View Recording
                      </Button>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ textAlign: "center" }}
                      >
                        Uploaded:{" "}
                        {new Date(recording.uploadedAt).toLocaleString()}
                      </Typography>
                    </Stack>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>
      )}
      {}
      <Grid item xs={12}>
        <Paper
          elevation={0}
          sx={{
            p: 2,
            bgcolor: "background.paper",
            borderRadius: 1,
            border: "1px solid",
            borderColor: "divider",
            transition: "all 0.2s ease-in-out",
            "&:hover": {
              boxShadow: (theme) => theme.shadows[4],
              transform: "translateY(-4px)",
            },
          }}
        >
          <Typography
            variant="subtitle2"
            gutterBottom
            sx={{
              color: "primary.main",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              gap: 1,
              mb: 2,
            }}
          >
            <CommentIcon fontSize="small" />
            Comments & Activity
          </Typography>
          <Box sx={{ maxHeight: 300, overflowY: "auto", pr: 1 }}>
            {lead.comments && lead.comments.length > 0 ? (
              <Stack spacing={2}>
                {lead.comments.map((comment, index) => (
                  <Paper
                    key={index}
                    elevation={0}
                    sx={{
                      p: 2,
                      bgcolor: "action.hover",
                      borderRadius: 1,
                      border: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        mb: 1,
                      }}
                    >
                      <Avatar
                        sx={{ width: 24, height: 24, fontSize: "0.875rem" }}
                      >
                        {comment.author?.fullName?.charAt(0) || "U"}
                      </Avatar>
                      <Typography variant="subtitle2">
                        {comment.author?.fullName || "Unknown User"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        • {new Date(comment.createdAt).toLocaleString()}
                      </Typography>
                    </Box>
                    <Typography variant="body2">{comment.text}</Typography>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Box sx={{ textAlign: "center", py: 3, color: "text.secondary" }}>
                <CommentIcon sx={{ fontSize: 40, opacity: 0.5, mb: 1 }} />
                <Typography variant="body2">No comments yet</Typography>
              </Box>
            )}
          </Box>
        </Paper>
      </Grid>
    </Grid>
  </Box>
));

const LeadsPage = () => {
  const user = useSelector(selectUser);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [leads, setLeads] = useState([]);
  const [agents, setAgents] = useState([]);
  const [orders, setOrders] = useState([]);
  const [leadStats, setLeadStats] = useState(null);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [selectedLeads, setSelectedLeads] = useState(new Set());
  const [bulkAssignDialogOpen, setBulkAssignDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addLeadDialogOpen, setAddLeadDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkDeleteFilters, setBulkDeleteFilters] = useState({
    leadType: "",
    country: "",
    gender: "",
    status: "",
    documentStatus: "",
    isAssigned: "",
    nameSearch: "",
    emailSearch: "",
    phoneSearch: "",
  });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalLeads, setTotalLeads] = useState(0);
  const [filters, setFilters] = useState({
    search: "", // Unified search field for name, email, and phone
    nameSearch: "",
    emailSearch: "",
    phoneSearch: "",
    leadType: "",
    isAssigned: "",
    country: "",
    gender: "",
    status: "",
    documentStatus: "",
    includeConverted: true,
    order: "newest",
    orderId: "",
    assignedToMe: false,
    orderStatus: "",
    orderPriority: "",
    orderCreatedStart: "",
    orderCreatedEnd: "",
  });
  const [showFilters, setShowFilters] = useState(false);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [pendingRequests, setPendingRequests] = useState(new Map()); // Map<"leadId-orderId", pendingRequest>
  
  // Local search input state for instant UI updates
  const [searchInput, setSearchInput] = useState("");
  const searchDebounceTimer = useRef(null);
  
  const isAdminOrManager = useMemo(
    () => user?.role === ROLES.ADMIN || user?.role === ROLES.AFFILIATE_MANAGER,
    [user?.role]
  );
  const isAffiliateManager = useMemo(
    () => user?.role === ROLES.AFFILIATE_MANAGER,
    [user?.role]
  );
  const isLeadManager = useMemo(
    () => user?.role === ROLES.LEAD_MANAGER,
    [user?.role]
  );
  const isAgent = useMemo(() => user?.role === ROLES.AGENT, [user?.role]);
  const canAssignLeads = useMemo(() => isAdminOrManager, [isAdminOrManager]);
  const canDeleteLeads = useMemo(
    () => user?.role === ROLES.ADMIN,
    [user?.role]
  );
  const numSelected = useMemo(() => selectedLeads.size, [selectedLeads]);
  
  // Count only assignable leads (FTD and Filler, not Cold)
  const numAssignableSelected = useMemo(() => {
    let count = 0;
    selectedLeads.forEach(leadId => {
      const lead = leads.find(l => l._id === leadId);
      if (lead && (lead.leadType === 'ftd' || lead.leadType === 'filler')) {
        count++;
      }
    });
    return count;
  }, [selectedLeads, leads]);
  const {
    control: commentControl,
    handleSubmit: handleCommentSubmit,
    reset: resetComment,
    formState: { errors: commentErrors, isSubmitting: isCommentSubmitting },
  } = useForm({
    resolver: yupResolver(commentSchema),
    defaultValues: { text: "" },
  });
  const fetchPendingRequests = useCallback(async (leadsData) => {
    // Only for agents - check for pending requests for each lead/order
    if (!isAgent) return;
    
    try {
      const requestsMap = new Map();
      
      // For each lead/order combination, check if there's a pending request
      for (const groupedLead of leadsData) {
        if (groupedLead.orders) {
          for (const order of groupedLead.orders) {
            try {
              const response = await api.get('/call-change-requests/check', {
                params: {
                  leadId: groupedLead.leadId,
                  orderId: order.orderId,
                },
              });
              
              if (response.data.data) {
                const key = `${groupedLead.leadId}-${order.orderId}`;
                requestsMap.set(key, {
                  requestId: response.data.data._id,
                  currentCallNumber: response.data.data.currentCallNumber,
                  requestedCallNumber: response.data.data.requestedCallNumber,
                });
              }
            } catch (err) {
              // Silently fail for individual checks
              console.error('Failed to check pending request:', err);
            }
          }
        }
      }
      
      setPendingRequests(requestsMap);
    } catch (err) {
      console.error('Failed to fetch pending requests:', err);
    }
  }, [isAgent]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page + 1,
        limit: rowsPerPage,
        ...filters,
      });
      if ((isAdminOrManager || isLeadManager) && filters.isAssigned === "") {
        params.delete("isAssigned");
      }
      const endpoint = isAgent ? "/leads/assigned" : "/leads";
      const response = await api.get(`${endpoint}?${params}`);
      if (!response.data.success) {
        throw new Error(response.data.message || "Failed to fetch leads");
      }
      const leadsData = response.data.data;
      setLeads(leadsData);
      setTotalLeads(response.data.pagination.totalLeads);
      
      // Fetch pending requests for agents
      if (isAgent && leadsData.length > 0) {
        fetchPendingRequests(leadsData);
      }
    } catch (err) {
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        "An unexpected error occurred.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    rowsPerPage,
    filters,
    user,
    isAdminOrManager,
    isLeadManager,
    isAgent,
    fetchPendingRequests,
  ]);
  const fetchAgents = useCallback(async () => {
    try {
      const response = await api.get("/users?role=agent&isActive=true&limit=1000");
      setAgents(response.data.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch agents");
    }
  }, []);
  const fetchOrders = useCallback(async () => {
    try {
      const response = await api.get("/orders");
      setOrders(response.data.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch orders");
    }
  }, []);
  const fetchLeadStats = useCallback(async () => {
    try {
      const response = await api.get("/leads/stats");
      if (response.data.success) {
        setLeadStats(response.data.data);
      }
    } catch (err) {
      console.error("Failed to fetch lead stats:", err);
    }
  }, []);
  const onSubmitComment = useCallback(
    async (data) => {
      try {
        setError(null);
        if (isLeadManager) {
          const lead = leads.find((l) => l._id === selectedLead._id);
          if (lead?.createdBy !== user.id) {
            setError("You can only comment on leads that you created.");
            return;
          }
        }
        
        // For agents, orderId is required (passed from the order row)
        if (isAgent && !selectedLead?.orderId) {
          setError("Order ID is required for comments.");
          return;
        }
        
        // Include orderId in the request data
        const requestData = isAgent 
          ? { ...data, orderId: selectedLead.orderId }
          : data;
        
        await api.put(`/leads/${selectedLead._id}/comment`, requestData);
        setSuccess("Comment added successfully!");
        setCommentDialogOpen(false);
        resetComment();
        fetchLeads();
      } catch (err) {
        setError(err.response?.data?.message || "Failed to add comment.");
      }
    },
    [
      selectedLead,
      fetchLeads,
      resetComment,
      isLeadManager,
      isAgent,
      user?.id,
      leads,
      setSuccess,
      setError,
    ]
  );
  const updateLeadStatus = useCallback(
    async (leadId, status) => {
      try {
        setError(null);
        if (isLeadManager) {
          const lead = leads.find((l) => l._id === leadId);
          if (lead?.createdBy !== user.id) {
            setError("You can only update leads that you created.");
            return;
          }
        }
        await api.put(`/leads/${leadId}/status`, { status });
        setSuccess("Lead status updated successfully!");
        fetchLeads();
      } catch (err) {
        setError(
          err.response?.data?.message || "Failed to update lead status."
        );
      }
    },
    [fetchLeads, isLeadManager, user?.id, leads, setSuccess, setError]
  );

  // Helper function to get available call options based on current call number
  const getAvailableCallOptions = useCallback((currentCallNumber) => {
    // Admins can see all options
    if (user?.role === ROLES.ADMIN) {
      return ["", "1st", "2nd", "3rd", "4th", "5th"];
    }
    
    // For agents, show previous, current, next, and None
    const callSequence = ["1st", "2nd", "3rd", "4th", "5th"];
    
    if (!currentCallNumber) {
      // No call made yet, can only select 1st or None
      return ["", "1st"];
    }
    
    const currentIndex = callSequence.indexOf(currentCallNumber);
    if (currentIndex === -1) {
      // Invalid call number, show all
      return ["", "1st", "2nd", "3rd", "4th", "5th"];
    }
    
    // Build options: None, previous (if exists), current, next (if exists)
    const options = [""];
    
    // Add previous call option if not at the first
    if (currentIndex > 0) {
      options.push(callSequence[currentIndex - 1]);
    }
    
    // Add current call option
    options.push(currentCallNumber);
    
    // Add next call option if not at the last
    if (currentIndex < callSequence.length - 1) {
      options.push(callSequence[currentIndex + 1]);
    }
    
    return options;
  }, [user?.role]);

  const updateCallNumber = useCallback(
    async (leadId, callNumber, orderId) => {
      try {
        setError(null);
        
        if (!orderId) {
          setError("Order ID is required to update call number");
          return;
        }
        
        // Make API call to update call number for specific order
        const response = await api.put(`/leads/${leadId}/call-number`, {
          callNumber: callNumber === "" ? null : callNumber,
          orderId: orderId,
        });
        
        // Check if the request is pending (for agents)
        if (response.data.isPending) {
          // Add to pending requests map
          const key = `${leadId}-${orderId}`;
          setPendingRequests(prev => {
            const newMap = new Map(prev);
            newMap.set(key, {
              requestId: response.data.data.requestId,
              currentCallNumber: response.data.data.currentCallNumber,
              requestedCallNumber: response.data.data.requestedCallNumber,
              currentVerified: response.data.data.currentVerified,
              requestedVerified: response.data.data.requestedVerified,
            });
            return newMap;
          });
          setSuccess("Call change request submitted successfully. Waiting for approval.");
        } else {
          // For admin/affiliate_manager, update was successful
          // Optimistically update the local state
          setLeads((prevLeads) =>
            prevLeads.map((groupedLead) => {
              if (groupedLead.leadId && groupedLead.leadId.toString() === leadId.toString()) {
                return {
                  ...groupedLead,
                  orders: groupedLead.orders.map((order) =>
                    order.orderId.toString() === orderId.toString()
                      ? { ...order, callNumber: callNumber === "" ? null : callNumber }
                      : order
                  ),
                };
              }
              return groupedLead;
            })
          );
          setSuccess("Call number updated successfully!");
        }
      } catch (err) {
        setError(
          err.response?.data?.message || "Failed to update call number."
        );
      }
    },
    [fetchLeads, setSuccess, setError]
  );

  const updateVerification = useCallback(
    async (leadId, verified, orderId) => {
      try {
        setError(null);
        
        if (!orderId) {
          setError("Order ID is required to update verification status");
          return;
        }
        
        // Make API call to update verification for specific order
        const response = await api.put(`/leads/${leadId}/call-number`, {
          verified: verified,
          orderId: orderId,
        });
        
        // Check if the request is pending (for agents)
        if (response.data.isPending) {
          // Add to pending requests map
          const key = `${leadId}-${orderId}`;
          setPendingRequests(prev => {
            const newMap = new Map(prev);
            newMap.set(key, {
              requestId: response.data.data.requestId,
              currentCallNumber: response.data.data.currentCallNumber,
              requestedCallNumber: response.data.data.requestedCallNumber,
              currentVerified: response.data.data.currentVerified,
              requestedVerified: response.data.data.requestedVerified,
            });
            return newMap;
          });
          setSuccess("Verification change request submitted successfully. Waiting for approval.");
        } else {
          // For admin/affiliate_manager, update was successful
          // Optimistically update the local state
          setLeads((prevLeads) =>
            prevLeads.map((groupedLead) => {
              if (groupedLead.leadId && groupedLead.leadId.toString() === leadId.toString()) {
                return {
                  ...groupedLead,
                  orders: groupedLead.orders.map((order) =>
                    order.orderId.toString() === orderId.toString()
                      ? { ...order, verified: verified }
                      : order
                  ),
                };
              }
              return groupedLead;
            })
          );
          setSuccess("Verification status updated successfully!");
        }
      } catch (err) {
        setError(
          err.response?.data?.message || "Failed to update verification status."
        );
      }
    },
    [fetchLeads, setSuccess, setError]
  );

  const handleDeleteLead = useCallback(
    async (leadId) => {
      try {
        await api.delete(`/leads/${leadId}`);
        setSuccess("Lead deleted successfully");
        fetchLeads();
        fetchLeadStats();
      } catch (err) {
        setError(err.response?.data?.message || "Failed to delete lead");
      }
    },
    [fetchLeads, fetchLeadStats, setSuccess, setError]
  );
  const handleBulkDelete = async () => {
    try {
      setError(null);
      const response = await api.delete("/leads/bulk-delete", {
        data: bulkDeleteFilters,
      });
      setSuccess(response.data.message);
      setBulkDeleteDialogOpen(false);
      fetchLeads();
      fetchLeadStats();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete leads");
    }
  };
  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);
  useEffect(() => {
    if (isAdminOrManager || isLeadManager) {
      fetchLeadStats();
    }
    if (isAdminOrManager) {
      fetchAgents();
      fetchOrders();
    }
  }, [isAdminOrManager, isLeadManager, fetchAgents, fetchOrders, fetchLeadStats]);
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [success]);
  const handleLeadAdded = useCallback(
    (lead) => {
      fetchLeads();
      fetchLeadStats();
    },
    [fetchLeads, fetchLeadStats]
  );
  const handleChangePage = useCallback((_, newPage) => {
    setPage(newPage);
  }, []);
  const handleChangeRowsPerPage = useCallback((event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }, []);
  const handleFilterChange = useCallback((field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setPage(0);
  }, []);
  
  // Debounced search handler for instant typing without API lag
  const handleSearchChange = useCallback((value) => {
    // Update local state immediately for instant UI feedback
    setSearchInput(value);
    
    // Clear existing timer
    if (searchDebounceTimer.current) {
      clearTimeout(searchDebounceTimer.current);
    }
    
    // Set new timer to update filter state (which triggers API call)
    searchDebounceTimer.current = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: value }));
      setPage(0);
    }, 300); // 300ms debounce delay
  }, []);
  
  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (searchDebounceTimer.current) {
        clearTimeout(searchDebounceTimer.current);
      }
    };
  }, []);
  
  const clearFilters = useCallback(() => {
    setFilters({
      search: "",
      nameSearch: "",
      emailSearch: "",
      phoneSearch: "",
      leadType: "",
      isAssigned: "",
      country: "",
      gender: "",
      status: "",
      documentStatus: "",
      includeConverted: true,
      order: "newest",
      orderId: "",
    });
    setSearchInput(""); // Also clear the local search input
    setPage(0);
  }, []);
  const handleSelectAll = useCallback(
    (event) => {
      if (event.target.checked) {
        setSelectedLeads(new Set(leads.map((lead) => lead._id)));
      } else {
        setSelectedLeads(new Set());
      }
    },
    [leads]
  );
  const handleSelectLead = useCallback(
    (leadId) => (event) => {
      setSelectedLeads((prev) => {
        const newSelected = new Set(prev);
        if (event.target.checked) {
          newSelected.add(leadId);
        } else {
          newSelected.delete(leadId);
        }
        return newSelected;
      });
    },
    []
  );
  const toggleRowExpansion = useCallback((leadId) => {
    setExpandedRows((prev) => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(leadId)) {
        newExpanded.delete(leadId);
      } else {
        newExpanded.add(leadId);
      }
      return newExpanded;
    });
  }, []);
  const handleOpenCommentDialog = useCallback((lead) => {
    setSelectedLead(lead);
    setCommentDialogOpen(true);
  }, []);
  const handleEditLead = (lead) => {
    setSelectedLead(lead);
    setEditDialogOpen(true);
  };
  const handleLeadUpdated = (updatedLead) => {
    setSuccess("Lead updated successfully");
    fetchLeads();
  };
  return (
    <Box>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={0}
        sx={{
          "& .MuiButton-root": {
            transition: "all 0.2s ease-in-out",
            "&:hover": {
              transform: "translateY(-2px)",
              boxShadow: (theme) => theme.shadows[4],
            },
          },
        }}
      >
        <Box display="flex" gap={2} alignItems="center" ml="auto">
          {canAssignLeads && numSelected > 0 && numAssignableSelected === 0 && (
            <Alert severity="info" sx={{ py: 0.5, px: 2 }}>
              Cold leads cannot be assigned to agents. Only FTD and Filler leads can be assigned.
            </Alert>
          )}
          {isAdminOrManager && numAssignableSelected > 0 && (
            <Button
              variant="contained"
              color="success"
              startIcon={<AssignmentIndIcon />}
              onClick={() => setBulkAssignDialogOpen(true)}
              sx={{
                borderRadius: 2,
                px: 3,
                py: 1,
                transition: "all 0.2s",
                "&:hover": {
                  transform: "translateY(-2px)",
                  boxShadow: 4,
                },
              }}
            >
              Assign to Agent (Permanent)
            </Button>
          )}
        </Box>
      </Box>
      {success && (
        <Alert
          severity="success"
          sx={{ mb: 2 }}
          onClose={() => setSuccess(null)}
        >
          {success}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {}
      {leadStats && (
        <Box sx={{ mb: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  bgcolor: "rgba(255, 255, 255, 0.85)",
                  backdropFilter: "blur(10px)",
                  borderRadius: 2,
                  border: "1px solid rgba(255, 255, 255, 0.3)",
                  color: "text.primary",
                  textAlign: "center",
                  transition: "all 0.3s ease-in-out",
                  background:
                    "linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(240, 245, 255, 0.8) 100%)",
                  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.1)",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    bgcolor: "rgba(255, 255, 255, 0.95)",
                    backdropFilter: "blur(15px)",
                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
                    background:
                      "linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(240, 245, 255, 0.9) 100%)",
                  },
                }}
              >
                <Typography variant="h5" fontWeight="bold" sx={{ mb: 0.5 }}>
                  {leadStats.leads.overall.total}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Leads
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  bgcolor: "rgba(255, 255, 255, 0.85)",
                  backdropFilter: "blur(10px)",
                  borderRadius: 2,
                  border: "1px solid rgba(255, 255, 255, 0.3)",
                  color: "text.primary",
                  textAlign: "center",
                  transition: "all 0.3s ease-in-out",
                  background:
                    "linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(245, 255, 245, 0.8) 100%)",
                  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.1)",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    bgcolor: "rgba(255, 255, 255, 0.95)",
                    backdropFilter: "blur(15px)",
                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
                    background:
                      "linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(245, 255, 245, 0.9) 100%)",
                  },
                }}
              >
                <Typography variant="h5" fontWeight="bold" sx={{ mb: 0.5 }}>
                  {leadStats.leads.overall.assigned}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Assigned Leads
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  bgcolor: "rgba(255, 255, 255, 0.85)",
                  backdropFilter: "blur(10px)",
                  borderRadius: 2,
                  border: "1px solid rgba(255, 255, 255, 0.3)",
                  color: "text.primary",
                  textAlign: "center",
                  transition: "all 0.3s ease-in-out",
                  background:
                    "linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 250, 240, 0.8) 100%)",
                  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.1)",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    bgcolor: "rgba(255, 255, 255, 0.95)",
                    backdropFilter: "blur(15px)",
                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
                    background:
                      "linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 250, 240, 0.9) 100%)",
                  },
                }}
              >
                <Typography variant="h5" fontWeight="bold" sx={{ mb: 0.5 }}>
                  {leadStats.leads.overall.available}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Available Leads
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  bgcolor: "rgba(255, 255, 255, 0.85)",
                  backdropFilter: "blur(10px)",
                  borderRadius: 2,
                  border: "1px solid rgba(255, 255, 255, 0.3)",
                  color: "text.primary",
                  textAlign: "center",
                  transition: "all 0.3s ease-in-out",
                  background:
                    "linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(250, 245, 255, 0.8) 100%)",
                  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.1)",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    bgcolor: "rgba(255, 255, 255, 0.95)",
                    backdropFilter: "blur(15px)",
                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
                    background:
                      "linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(250, 245, 255, 0.9) 100%)",
                  },
                }}
              >
                <Typography variant="h5" fontWeight="bold" sx={{ mb: 0.5 }}>
                  {leadStats.leads.ftd.total}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  FTD Leads
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </Box>
      )}
      {}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 3,
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Button
          startIcon={showFilters ? <ExpandLessIcon /> : <FilterIcon />}
          onClick={() => setShowFilters(!showFilters)}
          sx={{
            mb: 2,
            color: "primary.main",
            "&:hover": {
              bgcolor: "primary.lighter",
            },
          }}
        >
          {showFilters ? "Hide Filters" : "Show Filters"}
        </Button>
        <Collapse in={showFilters}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Search"
                value={searchInput}
                onChange={(e) =>
                  handleSearchChange(e.target.value)
                }
                placeholder="Search by name, email, phone, country, gender, status, type, or agent..."
                InputProps={{
                  startAdornment: (
                    <SearchIcon sx={{ mr: 1, color: "action.active" }} />
                  ),
                }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 2,
                  },
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={1.5}>
              <FormControl fullWidth>
                <InputLabel>Lead Type</InputLabel>
                <Select
                  value={filters.leadType}
                  label="Lead Type"
                  onChange={(e) =>
                    handleFilterChange("leadType", e.target.value)
                  }
                  sx={{ borderRadius: 2 }}
                >
                  <MenuItem value="">All Types</MenuItem>
                  {Object.values(LEAD_TYPES).map((type) => (
                    <MenuItem key={type} value={type}>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            bgcolor: (theme) =>
                              theme.palette[getLeadTypeColor(type)]?.main,
                          }}
                        />
                        {type.toUpperCase()}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            {isAdminOrManager && (
              <Grid item xs={12} sm={6} md={1.5}>
                <FormControl fullWidth>
                  <InputLabel>Assignment</InputLabel>
                  <Select
                    value={filters.isAssigned}
                    label="Assignment"
                    onChange={(e) =>
                      handleFilterChange("isAssigned", e.target.value)
                    }
                    sx={{ borderRadius: 2 }}
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="true">Assigned</MenuItem>
                    <MenuItem value="false">Unassigned</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            )}
            <Grid item xs={12} sm={6} md={1.5}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  label="Status"
                  onChange={(e) => handleFilterChange("status", e.target.value)}
                  sx={{ borderRadius: 2 }}
                >
                  <MenuItem value="">All Statuses</MenuItem>
                  {Object.values(LEAD_STATUSES).map((status) => (
                    <MenuItem key={status} value={status}>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            bgcolor: (theme) =>
                              theme.palette[getStatusColor(status)]?.main,
                          }}
                        />
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth>
                <InputLabel>Country</InputLabel>
                <Select
                  value={filters.country}
                  label="Country"
                  onChange={(e) =>
                    handleFilterChange("country", e.target.value)
                  }
                  sx={{ borderRadius: 2 }}
                >
                  <MenuItem value="">All Countries</MenuItem>
                  {getSortedCountries().map((country) => (
                    <MenuItem key={country.code} value={country.name}>
                      {country.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            {isAdminOrManager && (
              <Grid item xs={12} sm={6} md={2}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={filters.includeConverted}
                      onChange={(e) =>
                        handleFilterChange("includeConverted", e.target.checked)
                      }
                      color="primary"
                    />
                  }
                  label="Include Converted Leads"
                />
              </Grid>
            )}
            {isAffiliateManager && (
              <Grid item xs={12} sm={6} md={2}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={filters.assignedToMe}
                      onChange={(e) =>
                        handleFilterChange("assignedToMe", e.target.checked)
                      }
                      color="primary"
                    />
                  }
                  label="My Assigned Leads"
                />
              </Grid>
            )}
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth>
                <InputLabel>Order</InputLabel>
                <Select
                  value={filters.orderId}
                  label="Order"
                  onChange={(e) =>
                    handleFilterChange("orderId", e.target.value)
                  }
                  sx={{ borderRadius: 2 }}
                >
                  <MenuItem value="">All Orders</MenuItem>
                  {orders.map((order) => (
                    <MenuItem key={order._id} value={order._id}>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            bgcolor:
                              order.status === "active"
                                ? "success.main"
                                : order.status === "paused"
                                ? "warning.main"
                                : order.status === "completed"
                                ? "info.main"
                                : "error.main",
                          }}
                        />
                        Order {order._id.slice(-8)} - {order.priority}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth>
                <InputLabel>Order Status</InputLabel>
                <Select
                  value={filters.orderStatus}
                  label="Order Status"
                  onChange={(e) =>
                    handleFilterChange("orderStatus", e.target.value)
                  }
                  sx={{ borderRadius: 2 }}
                >
                  <MenuItem value="">All Status</MenuItem>
                  <MenuItem value="pending">
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          bgcolor: "warning.main",
                        }}
                      />
                      Pending
                    </Box>
                  </MenuItem>
                  <MenuItem value="fulfilled">
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          bgcolor: "success.main",
                        }}
                      />
                      Fulfilled
                    </Box>
                  </MenuItem>
                  <MenuItem value="partial">
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          bgcolor: "info.main",
                        }}
                      />
                      Partial
                    </Box>
                  </MenuItem>
                  <MenuItem value="cancelled">
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          bgcolor: "error.main",
                        }}
                      />
                      Cancelled
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth>
                <InputLabel>Order Priority</InputLabel>
                <Select
                  value={filters.orderPriority}
                  label="Order Priority"
                  onChange={(e) =>
                    handleFilterChange("orderPriority", e.target.value)
                  }
                  sx={{ borderRadius: 2 }}
                >
                  <MenuItem value="">All Priorities</MenuItem>
                  <MenuItem value="low">
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          bgcolor: "success.main",
                        }}
                      />
                      Low
                    </Box>
                  </MenuItem>
                  <MenuItem value="medium">
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          bgcolor: "warning.main",
                        }}
                      />
                      Medium
                    </Box>
                  </MenuItem>
                  <MenuItem value="high">
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          bgcolor: "error.main",
                        }}
                      />
                      High
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                label="Order Created From"
                type="date"
                value={filters.orderCreatedStart}
                onChange={(e) =>
                  handleFilterChange("orderCreatedStart", e.target.value)
                }
                InputLabelProps={{ shrink: true }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 2,
                  },
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                label="Order Created To"
                type="date"
                value={filters.orderCreatedEnd}
                onChange={(e) =>
                  handleFilterChange("orderCreatedEnd", e.target.value)
                }
                InputLabelProps={{ shrink: true }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 2,
                  },
                }}
              />
            </Grid>
            {/* Action Buttons */}
            <Grid item xs={12}>
              <Box display="flex" gap={2} alignItems="center" mt={2}>
                {(isLeadManager || user?.role === ROLES.ADMIN) && (
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<PersonAddIcon />}
                    onClick={() => setAddLeadDialogOpen(true)}
                    sx={{
                      borderRadius: 2,
                      px: 3,
                      py: 1,
                      transition: "all 0.3s ease-in-out",
                      bgcolor: "rgba(255, 255, 255, 0.15)",
                      backdropFilter: "blur(10px)",
                      border: "1px solid rgba(255, 255, 255, 0.3)",
                      color: "text.primary",
                      "&:hover": {
                        transform: "translateY(-2px)",
                        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.1)",
                        bgcolor: "rgba(255, 255, 255, 0.25)",
                      },
                    }}
                  >
                    Add New Lead
                  </Button>
                )}
                {isAdminOrManager && (
                  <Button
                    variant="outlined"
                    startIcon={<ImportIcon />}
                    onClick={() => setImportDialogOpen(true)}
                    sx={{
                      borderRadius: 2,
                      px: 3,
                      py: 1,
                      transition: "all 0.2s",
                      "&:hover": {
                        transform: "translateY(-2px)",
                        boxShadow: 2,
                      },
                    }}
                  >
                    Import Leads
                  </Button>
                )}
                {canDeleteLeads && (
                  <Button
                    variant="contained"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={() => setBulkDeleteDialogOpen(true)}
                    sx={{ ml: 1 }}
                  >
                    Bulk Delete
                  </Button>
                )}
              </Box>
            </Grid>
          </Grid>
        </Collapse>
      </Paper>
      {}
      <Box sx={{ display: { xs: "none", md: "block" } }}>
        <Paper>
          <TableContainer sx={{ maxHeight: "calc(100vh - 180px)" }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  {!isAgent && canAssignLeads && (
                    <TableCell
                      padding="checkbox"
                      sx={{
                        borderRight: "1px solid rgba(224, 224, 224, 1)",
                        backgroundColor: "background.paper",
                        fontSize: "0.875rem",
                      }}
                    >
                      <Checkbox
                        indeterminate={
                          numSelected > 0 && numSelected < leads.length
                        }
                        checked={
                          leads.length > 0 && numSelected === leads.length
                        }
                        onChange={handleSelectAll}
                      />
                    </TableCell>
                  )}
                  {isAgent && (
                    <TableCell
                      padding="checkbox"
                      sx={{
                        borderRight: "1px solid rgba(224, 224, 224, 1)",
                        backgroundColor: "background.paper",
                        fontSize: "0.875rem",
                      }}
                    />
                  )}
                  <TableCell
                    sx={{
                      borderRight: "1px solid rgba(224, 224, 224, 1)",
                      backgroundColor: "background.paper",
                      fontSize: "0.875rem",
                      py: 1,
                    }}
                  >
                    Name
                  </TableCell>
                  {!isAgent && (
                    <TableCell
                      sx={{
                        borderRight: "1px solid rgba(224, 224, 224, 1)",
                        backgroundColor: "background.paper",
                        fontSize: "0.875rem",
                        py: 1,
                      }}
                    >
                      Type
                    </TableCell>
                  )}
                  {!isAgent && (
                    <TableCell
                      sx={{
                        borderRight: "1px solid rgba(224, 224, 224, 1)",
                        backgroundColor: "background.paper",
                        fontSize: "0.875rem",
                        py: 1,
                      }}
                    >
                      Contact
                    </TableCell>
                  )}
                  <TableCell
                    sx={{
                      borderRight: "1px solid rgba(224, 224, 224, 1)",
                      backgroundColor: "background.paper",
                      fontSize: "0.875rem",
                      py: 1,
                    }}
                  >
                    Country
                  </TableCell>
                  {isAgent && (
                    <TableCell
                      sx={{
                        borderRight: "1px solid rgba(224, 224, 224, 1)",
                        backgroundColor: "background.paper",
                        fontSize: "0.875rem",
                        py: 1,
                      }}
                    >
                      Type
                    </TableCell>
                  )}
                  {!isAgent && (
                    <TableCell
                      sx={{
                        borderRight: "1px solid rgba(224, 224, 224, 1)",
                        backgroundColor: "background.paper",
                        fontSize: "0.875rem",
                        py: 1,
                      }}
                    >
                      Gender
                    </TableCell>
                  )}
                  {isAdminOrManager && !isAgent && (
                    <TableCell
                      sx={{
                        borderRight: "1px solid rgba(224, 224, 224, 1)",
                        backgroundColor: "background.paper",
                        fontSize: "0.875rem",
                        py: 1,
                      }}
                    >
                      Assigned To
                    </TableCell>
                  )}
                  <TableCell
                    sx={{
                      borderRight: "1px solid rgba(224, 224, 224, 1)",
                      backgroundColor: "background.paper",
                      fontSize: "0.875rem",
                      py: 1,
                    }}
                  >
                    Status
                  </TableCell>
                  <TableCell
                    sx={{
                      borderRight: "1px solid rgba(224, 224, 224, 1)",
                      backgroundColor: "background.paper",
                      fontSize: "0.875rem",
                      py: 1,
                    }}
                  >
                    Cooldown
                  </TableCell>
                  <TableCell
                    sx={{
                      backgroundColor: "background.paper",
                      fontSize: "0.875rem",
                      py: 1,
                    }}
                  >
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={isAgent ? 8 : (isAdminOrManager ? 11 : 10)}
                      align="center"
                    >
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : leads.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={isAgent ? 8 : (isAdminOrManager ? 11 : 10)}
                      align="center"
                    >
                      No leads found
                    </TableCell>
                  </TableRow>
                ) : isAgent ? (
                  // Agent View: Grouped leads with orders
                  leads.map((groupedLead) => (
                    <GroupedLeadRow
                      key={groupedLead.leadId}
                      groupedLead={groupedLead}
                      expandedRows={expandedRows}
                      onToggleExpansion={toggleRowExpansion}
                      onComment={handleOpenCommentDialog}
                      onUpdateStatus={updateLeadStatus}
                      updateCallNumber={updateCallNumber}
                      updateVerification={updateVerification}
                      getAvailableCallOptions={getAvailableCallOptions}
                      pendingRequests={pendingRequests}
                    />
                  ))
                ) : (
                  // Admin/Manager View: Regular lead rows
                  leads.map((lead) => (
                    <React.Fragment key={lead._id}>
                      <LeadRow
                        lead={lead}
                        canAssignLeads={canAssignLeads}
                        canDeleteLeads={canDeleteLeads}
                        isAdminOrManager={isAdminOrManager}
                        isLeadManager={isLeadManager}
                        userId={user?.id}
                        user={user}
                        selectedLeads={selectedLeads}
                        expandedRows={expandedRows}
                        onSelectLead={handleSelectLead}
                        onUpdateStatus={updateLeadStatus}
                        onComment={handleOpenCommentDialog}
                        onToggleExpansion={toggleRowExpansion}
                        onFilterByOrder={(orderId) =>
                          handleFilterChange("orderId", orderId)
                        }
                        onDeleteLead={handleDeleteLead}
                        handleEditLead={handleEditLead}
                        updateCallNumber={updateCallNumber}
                      />
                      {expandedRows.has(lead._id) && (
                        <TableRow>
                          <TableCell
                            colSpan={isAdminOrManager ? 13 : 12}
                            sx={{
                              bgcolor: "background.default",
                              borderBottom: "2px solid",
                              borderColor: "divider",
                              py: 3,
                            }}
                          >
                            <LeadDetails lead={lead} />
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={totalLeads}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </Paper>
      </Box>
      {}
      <Box sx={{ display: { xs: "block", md: "none" } }}>
        {loading ? (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress />
          </Box>
        ) : leads.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: "center" }}>
            <Typography color="text.secondary">No leads found</Typography>
          </Paper>
        ) : isAgent ? (
          // Agent View: Grouped leads mobile cards
          <Stack spacing={2}>
            {leads.map((groupedLead) => {
              const { leadId, leadInfo = {}, orders = [] } = groupedLead || {};
              if (!leadId) return null;
              
              return (
                <Paper key={leadId} sx={{ p: 2 }}>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {leadInfo?.prefix && `${leadInfo.prefix} `}
                        {leadInfo?.firstName || 'N/A'} {leadInfo?.lastName || ''}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {leadInfo?.newEmail || 'No email'}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Chip
                        label={leadInfo?.leadType?.toUpperCase() || "UNKNOWN"}
                        size="small"
                        color={leadInfo?.leadType === 'ftd' ? 'success' : leadInfo?.leadType === 'filler' ? 'info' : 'default'}
                      />
                      <Chip
                        label={leadInfo?.status ? leadInfo.status.charAt(0).toUpperCase() + leadInfo.status.slice(1) : "Unknown"}
                        size="small"
                        variant="outlined"
                      />
                      <Chip
                        label={`${orders.length} Order${orders.length !== 1 ? 's' : ''}`}
                        size="small"
                        color="primary"
                      />
                    </Stack>
                    {orders.length > 0 && (
                      <Box>
                        <Typography variant="caption" fontWeight="bold" gutterBottom>
                          Orders:
                        </Typography>
                        <Stack spacing={1} sx={{ mt: 1 }}>
                          {orders.map((order, idx) => (
                            <Box key={order.orderId || `order-${idx}`} sx={{ pl: 2, borderLeft: '2px solid', borderColor: 'divider' }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                                <Typography variant="caption" display="block">
                                  {new Date(order.orderCreatedAt).toLocaleDateString()}
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleOpenCommentDialog({ _id: leadId, ...leadInfo, orderId: order.orderId })}
                                  >
                                    <CommentIcon fontSize="small" />
                                  </IconButton>
                                  {order.comments && order.comments.length > 0 && (
                                    <Chip
                                      label={order.comments.length}
                                      size="small"
                                      color="info"
                                      sx={{ minWidth: 24, height: 16, fontSize: '0.65rem' }}
                                    />
                                  )}
                                </Box>
                              </Box>
                              {order.clientBrokers && order.clientBrokers.length > 0 && (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                  {order.clientBrokers.map((broker, bIdx) => (
                                    <Chip
                                      key={broker?._id || `broker-${idx}-${bIdx}`}
                                      label={broker?.name || 'Unknown'}
                                      size="small"
                                      color="secondary"
                                      variant="outlined"
                                    />
                                  ))}
                                </Box>
                              )}
                              {order.comments && order.comments.length > 0 && (
                                <Stack spacing={0.5} sx={{ mt: 1 }}>
                                  {order.comments.map((comment, cIdx) => (
                                    <Paper
                                      key={cIdx}
                                      elevation={0}
                                      sx={{
                                        p: 1,
                                        bgcolor: 'action.hover',
                                        borderRadius: 1,
                                      }}
                                    >
                                      <Typography variant="caption" fontWeight="medium" display="block">
                                        {comment.author?.fullName || 'Unknown'}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.65rem' }}>
                                        {new Date(comment.createdAt).toLocaleString()}
                                      </Typography>
                                      <Typography variant="caption">{comment.text}</Typography>
                                    </Paper>
                                  ))}
                                </Stack>
                              )}
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    )}
                  </Stack>
                </Paper>
              );
            })}
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={totalLeads}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </Stack>
        ) : (
          // Admin/Manager View: Regular lead cards
          <Stack spacing={2}>
            {leads.map((lead) => (
              <LeadCard
                key={lead._id}
                lead={lead}
                canAssignLeads={canAssignLeads}
                canDeleteLeads={canDeleteLeads}
                selectedLeads={selectedLeads}
                expandedRows={expandedRows}
                onSelectLead={handleSelectLead}
                onUpdateStatus={updateLeadStatus}
                onComment={handleOpenCommentDialog}
                onToggleExpansion={toggleRowExpansion}
                onDeleteLead={handleDeleteLead}
                user={user}
                isLeadManager={isLeadManager}
                handleEditLead={handleEditLead}
              />
            ))}
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={totalLeads}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </Stack>
        )}
      </Box>
      {}
      <Dialog
        open={commentDialogOpen}
        onClose={() => setCommentDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Comment</DialogTitle>
        <form onSubmit={handleCommentSubmit(onSubmitComment)}>
          <DialogContent>
            {selectedLead && (
              <Box mb={2}>
                <Typography variant="subtitle2">
                  Lead: {selectedLead.firstName} {selectedLead.lastName}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {selectedLead.email} • {selectedLead.leadType.toUpperCase()}
                </Typography>
              </Box>
            )}
            <Controller
              name="text"
              control={commentControl}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Comment"
                  multiline
                  rows={4}
                  error={!!commentErrors.text}
                  helperText={commentErrors.text?.message}
                  placeholder="Add your comment about this lead..."
                />
              )}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCommentDialogOpen(false)}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isCommentSubmitting}
            >
              {isCommentSubmitting ? (
                <CircularProgress size={24} />
              ) : (
                "Add Comment"
              )}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
      <ImportLeadsDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onImportComplete={fetchLeads}
      />
      <EditLeadForm
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setSelectedLead(null);
        }}
        lead={selectedLead}
        onLeadUpdated={handleLeadUpdated}
        sx={{
          "& .MuiBackdrop-root": {
            backdropFilter: "blur(5px)",
          },
        }}
      />
      <AssignLeadToAgentDialog
        open={bulkAssignDialogOpen}
        onClose={() => setBulkAssignDialogOpen(false)}
        lead={Array.from(selectedLeads).map(id => 
          leads.find(lead => lead._id === id)
        ).filter(Boolean)}
        onSuccess={() => {
          setSuccess('Leads assigned to agent successfully!');
          setSelectedLeads(new Set());
          fetchLeads();
        }}
      />
      <Dialog
        open={addLeadDialogOpen}
        onClose={() => setAddLeadDialogOpen(false)}
        maxWidth="md"
        fullWidth
        sx={{
          "& .MuiBackdrop-root": {
            backdropFilter: "blur(5px)",
          },
        }}
      >
        <DialogTitle>Add New Lead</DialogTitle>
        <DialogContent>
          <AddLeadForm
            onLeadAdded={(lead) => {
              handleLeadAdded(lead);
              setAddLeadDialogOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
      <Dialog
        open={bulkDeleteDialogOpen}
        onClose={() => setBulkDeleteDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Bulk Delete Leads</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Warning: This action will permanently delete all leads matching the
            selected filters. This action cannot be undone.
          </DialogContentText>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Lead Type</InputLabel>
                <Select
                  value={bulkDeleteFilters.leadType}
                  label="Lead Type"
                  onChange={(e) =>
                    setBulkDeleteFilters((prev) => ({
                      ...prev,
                      leadType: e.target.value,
                    }))
                  }
                >
                  <MenuItem value="">All Types</MenuItem>
                  {Object.values(LEAD_TYPES).map((type) => (
                    <MenuItem key={type} value={type}>
                      {type.toUpperCase()}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Country</InputLabel>
                <Select
                  value={bulkDeleteFilters.country}
                  label="Country"
                  onChange={(e) =>
                    setBulkDeleteFilters((prev) => ({
                      ...prev,
                      country: e.target.value,
                    }))
                  }
                >
                  <MenuItem value="">All Countries</MenuItem>
                  {getSortedCountries().map((country) => (
                    <MenuItem key={country.code} value={country.code}>
                      {country.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Gender</InputLabel>
                <Select
                  value={bulkDeleteFilters.gender}
                  label="Gender"
                  onChange={(e) =>
                    setBulkDeleteFilters((prev) => ({
                      ...prev,
                      gender: e.target.value,
                    }))
                  }
                >
                  <MenuItem value="">All Genders</MenuItem>
                  <MenuItem value="male">Male</MenuItem>
                  <MenuItem value="female">Female</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={bulkDeleteFilters.status}
                  label="Status"
                  onChange={(e) =>
                    setBulkDeleteFilters((prev) => ({
                      ...prev,
                      status: e.target.value,
                    }))
                  }
                >
                  <MenuItem value="">All Statuses</MenuItem>
                  {Object.values(LEAD_STATUSES).map((status) => (
                    <MenuItem key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Document Status</InputLabel>
                <Select
                  value={bulkDeleteFilters.documentStatus}
                  label="Document Status"
                  onChange={(e) =>
                    setBulkDeleteFilters((prev) => ({
                      ...prev,
                      documentStatus: e.target.value,
                    }))
                  }
                >
                  <MenuItem value="">All Document Statuses</MenuItem>
                  <MenuItem value="good">Good</MenuItem>
                  <MenuItem value="ok">OK</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Assignment Status</InputLabel>
                <Select
                  value={bulkDeleteFilters.isAssigned}
                  label="Assignment Status"
                  onChange={(e) =>
                    setBulkDeleteFilters((prev) => ({
                      ...prev,
                      isAssigned: e.target.value,
                    }))
                  }
                >
                  <MenuItem value="">All Assignment Statuses</MenuItem>
                  <MenuItem value={true}>Assigned</MenuItem>
                  <MenuItem value={false}>Unassigned</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Search"
                value={bulkDeleteFilters.search}
                onChange={(e) =>
                  setBulkDeleteFilters((prev) => ({
                    ...prev,
                    search: e.target.value,
                  }))
                }
                helperText="Search by name, email, or phone"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleBulkDelete} color="error" variant="contained">
            Delete Matching Leads
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// New component for Agent's grouped leads view
const GroupedLeadRow = React.memo(
  ({
    groupedLead,
    expandedRows,
    onToggleExpansion,
    onComment,
    onUpdateStatus,
    updateCallNumber,
    updateVerification,
    getAvailableCallOptions,
    pendingRequests,
  }) => {
    const { leadId, leadInfo = {}, orders = [] } = groupedLead || {};
    
    // Safety check: if no leadId, don't render
    if (!leadId) return null;
    
    const isExpanded = expandedRows.has(leadId);

    const getLeadTypeColor = (type) => {
      const colors = {
        ftd: "success",
        filler: "info",
        cold: "warning",
        live: "error",
      };
      return colors[type] || "default";
    };

    const getStatusColor = (status) => {
      const colors = {
        active: "info",
        contacted: "warning",
        converted: "success",
        inactive: "default",
      };
      return colors[status] || "default";
    };

    return (
      <React.Fragment key={leadId}>
        <TableRow hover sx={{ '& > *': { borderBottom: 'unset' } }}>
          <TableCell padding="checkbox">
            <IconButton
              size="small"
              onClick={() => onToggleExpansion(leadId)}
            >
              {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </TableCell>
          <TableCell>
            <Box>
              <Typography variant="body2" fontWeight="medium">
                {leadInfo?.prefix && `${leadInfo.prefix} `}
                {leadInfo?.firstName || 'N/A'} {leadInfo?.lastName || ''}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {leadInfo?.newEmail || 'No email'}
              </Typography>
            </Box>
          </TableCell>
          <TableCell>{leadInfo?.country || 'N/A'}</TableCell>
          <TableCell>
            <Chip
              label={leadInfo?.leadType?.toUpperCase() || "UNKNOWN"}
              color={getLeadTypeColor(leadInfo?.leadType)}
              size="small"
            />
          </TableCell>
          <TableCell>
            <Chip
              label={
                leadInfo?.status
                  ? leadInfo.status.charAt(0).toUpperCase() + leadInfo.status.slice(1)
                  : "Unknown"
              }
              color={getStatusColor(leadInfo?.status)}
              size="small"
            />
          </TableCell>
          <TableCell>
            <Chip
              label={`${orders.length} Order${orders.length !== 1 ? 's' : ''}`}
              color="primary"
              size="small"
              variant="outlined"
            />
          </TableCell>
          <TableCell>
            <Typography variant="caption">
              {leadInfo?.assignedAgentAt
                ? new Date(leadInfo.assignedAgentAt).toLocaleDateString()
                : leadInfo?.createdAt 
                  ? new Date(leadInfo.createdAt).toLocaleDateString()
                  : 'N/A'}
            </Typography>
          </TableCell>
          <TableCell>
            {/* Comments now handled per order in expanded view */}
          </TableCell>
        </TableRow>
        <TableRow>
          <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={9}>
            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
              <Box sx={{ margin: 2 }}>
                <Typography variant="h6" gutterBottom component="div">
                  Orders ({orders.length})
                </Typography>
                {orders.length === 0 ? (
                  <Alert severity="info">No orders found for this lead</Alert>
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Order Date</TableCell>
                        <TableCell>Ordered As</TableCell>
                        <TableCell>Call Number</TableCell>
                        <TableCell>Verified</TableCell>
                        <TableCell>Client Brokers</TableCell>
                        <TableCell>Comments</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {orders.map((order) => (
                        <TableRow key={order.orderId}>
                          <TableCell>
                            <Typography variant="body2">
                              {new Date(order.orderCreatedAt).toLocaleDateString()}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(order.orderCreatedAt).toLocaleTimeString()}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={order.orderedAs?.toUpperCase() || 'N/A'}
                              size="small"
                              color={order.orderedAs === 'ftd' ? 'success' : order.orderedAs === 'filler' ? 'info' : 'default'}
                            />
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {order.orderedAs === 'filler' ? (
                                <Tooltip title="Call changes are not available for leads ordered as filler">
                                  <span>
                                    <FormControl size="small" sx={{ minWidth: 100 }}>
                                      <Select
                                        value={order.callNumber || ""}
                                        displayEmpty
                                        disabled
                                      >
                                        {getAvailableCallOptions(order.callNumber).map((option) => (
                                          <MenuItem key={option || "none"} value={option}>
                                            {option === "" ? <em>None</em> : option}
                                          </MenuItem>
                                        ))}
                                      </Select>
                                    </FormControl>
                                  </span>
                                </Tooltip>
                              ) : (
                                <FormControl size="small" sx={{ minWidth: 100 }}>
                                  <Select
                                    value={order.callNumber || ""}
                                    onChange={(e) => updateCallNumber(leadId, e.target.value, order.orderId)}
                                    displayEmpty
                                    disabled={pendingRequests.has(`${leadId}-${order.orderId}`)}
                                  >
                                    {getAvailableCallOptions(order.callNumber).map((option) => (
                                      <MenuItem key={option || "none"} value={option}>
                                        {option === "" ? <em>None</em> : option}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              )}
                              {pendingRequests.has(`${leadId}-${order.orderId}`) && pendingRequests.get(`${leadId}-${order.orderId}`).requestedCallNumber !== undefined && (
                                <Tooltip title={`Pending: ${pendingRequests.get(`${leadId}-${order.orderId}`).requestedCallNumber || 'None'}`}>
                                  <Chip
                                    label="Pending"
                                    size="small"
                                    color="warning"
                                    sx={{ fontSize: '0.75rem' }}
                                  />
                                </Tooltip>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {order.orderedAs === 'filler' ? (
                                <Tooltip title="Verification changes are not available for leads ordered as filler">
                                  <span>
                                    <FormControl size="small">
                                      <Select
                                        value={order.verified ? "yes" : "no"}
                                        disabled
                                      >
                                        <MenuItem value="no">No</MenuItem>
                                        <MenuItem value="yes">Yes</MenuItem>
                                      </Select>
                                    </FormControl>
                                  </span>
                                </Tooltip>
                              ) : (
                                <FormControl size="small">
                                  <Select
                                    value={order.verified ? "yes" : "no"}
                                    onChange={(e) => updateVerification(leadId, e.target.value === "yes", order.orderId)}
                                    disabled={pendingRequests.has(`${leadId}-${order.orderId}`)}
                                  >
                                    <MenuItem value="no">No</MenuItem>
                                    <MenuItem value="yes">Yes</MenuItem>
                                  </Select>
                                </FormControl>
                              )}
                              {pendingRequests.has(`${leadId}-${order.orderId}`) && pendingRequests.get(`${leadId}-${order.orderId}`).requestedVerified !== undefined && (
                                <Tooltip title={`Pending: ${pendingRequests.get(`${leadId}-${order.orderId}`).requestedVerified ? 'Yes' : 'No'}`}>
                                  <Chip
                                    label="Pending"
                                    size="small"
                                    color="warning"
                                    sx={{ fontSize: '0.75rem' }}
                                  />
                                </Tooltip>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            {order.clientBrokers && order.clientBrokers.length > 0 ? (
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {order.clientBrokers.map((broker, idx) => {
                                  // Determine chip color based on injection status
                                  const getStatusColor = (status) => {
                                    switch (status) {
                                      case 'successful':
                                        return 'success';
                                      case 'failed':
                                        return 'error';
                                      case 'pending':
                                      default:
                                        return 'secondary';
                                    }
                                  };
                                  
                                  return (
                                    <Chip
                                      key={broker?._id || `broker-${order.orderId}-${idx}`}
                                      label={broker?.name || 'Unknown Broker'}
                                      size="small"
                                      color={getStatusColor(broker?.injectionStatus)}
                                      title={broker?.injectionStatus ? `Injection: ${broker.injectionStatus}` : 'Lead-level broker assignment'}
                                    />
                                  );
                                })}
                              </Box>
                            ) : (
                              <Typography variant="caption" color="text.secondary">
                                No client brokers assigned
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Tooltip title="Add Comment">
                                <IconButton
                                  size="small"
                                  onClick={() => onComment({ _id: leadId, ...leadInfo, orderId: order.orderId })}
                                  color="primary"
                                >
                                  <CommentIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              {order.comments && order.comments.length > 0 && (
                                <Chip
                                  label={order.comments.length}
                                  size="small"
                                  color="info"
                                  sx={{ minWidth: 30, height: 20 }}
                                />
                              )}
                            </Box>
                            {order.comments && order.comments.length > 0 && (
                              <Box sx={{ mt: 1, maxHeight: 200, overflowY: 'auto' }}>
                                <Stack spacing={1}>
                                  {order.comments.map((comment, idx) => (
                                    <Paper
                                      key={idx}
                                      elevation={0}
                                      sx={{
                                        p: 1,
                                        bgcolor: 'action.hover',
                                        borderRadius: 1,
                                      }}
                                    >
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                        <Avatar sx={{ width: 20, height: 20, fontSize: '0.75rem' }}>
                                          {comment.author?.fullName?.charAt(0) || 'U'}
                                        </Avatar>
                                        <Typography variant="caption" fontWeight="medium">
                                          {comment.author?.fullName || 'Unknown'}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                          • {new Date(comment.createdAt).toLocaleString()}
                                        </Typography>
                                      </Box>
                                      <Typography variant="caption">{comment.text}</Typography>
                                    </Paper>
                                  ))}
                                </Stack>
                              </Box>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      </React.Fragment>
    );
  }
);

const LeadRow = React.memo(
  ({
    lead,
    canAssignLeads,
    canDeleteLeads,
    isAdminOrManager,
    isLeadManager,
    userId,
    selectedLeads,
    expandedRows,
    onSelectLead,
    onUpdateStatus,
    onComment,
    onToggleExpansion,
    onFilterByOrder,
    onDeleteLead,
    user,
    handleEditLead,
    updateCallNumber,
  }) => {
    // Helper function to check if two IDs match (handles different formats)
    const idsMatch = (id1, id2) => {
      if (!id1 || !id2) return false;
      return String(id1) === String(id2);
    };

    const isOwner = (() => {
      if (
        user?.role === ROLES.ADMIN ||
        user?.role === ROLES.AFFILIATE_MANAGER
      ) {
        return true;
      }

      if (user?.role === ROLES.LEAD_MANAGER) {
        return (
          idsMatch(lead.createdBy, userId) || idsMatch(lead.createdBy, user?.id)
        );
      }

      if (user?.role === ROLES.AGENT) {
        const assignedAgentId =
          lead.assignedAgent?._id || lead.assignedAgent?.id || lead.assignedAgent;
        const userIdToCheck = userId || user?.id;

        // Debug logging for agent permission check
        console.log("Agent permission check:", {
          leadId: lead._id,
          leadEmail: lead.newEmail,
          userRole: user?.role,
          userId: userIdToCheck,
          assignedAgentId: assignedAgentId,
          assignedAgentObject: lead.assignedAgent,
          match: idsMatch(assignedAgentId, userIdToCheck),
        });

        return !!lead.assignedAgent && idsMatch(assignedAgentId, userIdToCheck);
      }

      return false;
    })();
    const handleRowClick = (event) => {
      if (
        event.target.closest(
          'button, input, select, [role="combobox"], .MuiSelect-select, .MuiMenuItem-root'
        )
      ) {
        return;
      }
      onToggleExpansion(lead._id);
    };
    const cellSx = {
      borderRight: "1px solid rgba(224, 224, 224, 1)",
      py: 0.5,
      fontSize: "0.875rem",
    };
    return (
      <TableRow
        hover
        onClick={handleRowClick}
        sx={{
          "&:hover": { backgroundColor: "action.hover" },
          borderLeft: (theme) =>
            `4px solid ${
              theme.palette[getLeadTypeColor(getDisplayLeadType(lead))]?.main ||
              theme.palette.grey.main
            }`,
          cursor: "pointer",
        }}
      >
        {canAssignLeads && (
          <TableCell padding="checkbox" sx={cellSx}>
            <Tooltip 
              title={lead.leadType === 'cold' ? "Cold leads cannot be assigned to agents" : ""}
              arrow
            >
              <span>
                <Checkbox
                  checked={selectedLeads.has(lead._id)}
                  onChange={onSelectLead(lead._id)}
                  disabled={lead.leadType === 'cold'}
                />
              </span>
            </Tooltip>
          </TableCell>
        )}
        <TableCell sx={cellSx}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Avatar
              sx={{
                width: 24,
                height: 24,
                fontSize: "0.75rem",
                bgcolor: (theme) =>
                  theme.palette[getLeadTypeColor(getDisplayLeadType(lead))]?.light,
                color: (theme) =>
                  theme.palette[getLeadTypeColor(getDisplayLeadType(lead))]?.main,
              }}
            >
              {(
                lead.fullName ||
                `${lead.firstName} ${lead.lastName || ""}`.trim()
              )
                .charAt(0)
                .toUpperCase()}
            </Avatar>
            <Box>
              <Typography
                variant="body2"
                sx={{ fontWeight: "bold", fontSize: "0.875rem" }}
              >
                {lead.fullName ||
                  `${lead.firstName} ${lead.lastName || ""}`.trim()}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: "0.75rem" }}
              >
                ID: {lead._id.slice(-8)}
              </Typography>
            </Box>
          </Stack>
        </TableCell>
        <TableCell sx={cellSx}>
          <Chip
            label={(getDisplayLeadType(lead) || "unknown").toUpperCase()}
            color={getLeadTypeColor(getDisplayLeadType(lead))}
            size="small"
            sx={{
              fontWeight: "medium",
              height: "20px",
              "& .MuiChip-label": { fontSize: "0.75rem", px: 1 },
            }}
          />
        </TableCell>
        <TableCell sx={cellSx}>
          <Stack spacing={0.5}>
            <Typography
              variant="body2"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                fontSize: "0.875rem",
              }}
            >
              📧 {lead.newEmail}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                fontSize: "0.875rem",
              }}
            >
              📱{" "}
              {lead.prefix && lead.newPhone
                ? `${lead.prefix} ${lead.newPhone}`
                : lead.newPhone || "N/A"}
            </Typography>
          </Stack>
        </TableCell>
        <TableCell sx={cellSx}>
          <Chip
            label={lead.country || "Unknown"}
            size="small"
            variant="outlined"
            sx={{
              height: "20px",
              "& .MuiChip-label": { fontSize: "0.75rem", px: 1 },
            }}
          />
        </TableCell>
        <TableCell sx={cellSx}>{lead.gender || "N/A"}</TableCell>
        {isAdminOrManager && (
          <TableCell sx={cellSx}>
            {lead.assignedAgent ? lead.assignedAgent.fullName : "Unassigned"}
          </TableCell>
        )}
        <TableCell sx={cellSx}>
          <Chip
            label={lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
            color={getStatusColor(lead.status)}
            size="small"
            sx={{
              height: "20px",
              "& .MuiChip-label": { fontSize: "0.75rem", px: 1 },
            }}
          />
        </TableCell>
        <TableCell sx={cellSx}>
          {(() => {
            const cooldown = getCooldownStatus(lead);
            return (
              <Chip
                label={cooldown.text}
                color={cooldown.color}
                size="small"
                sx={{
                  height: "20px",
                  "& .MuiChip-label": { fontSize: "0.75rem", px: 1 },
                }}
              />
            );
          })()}
        </TableCell>
        <TableCell sx={{ py: 0.5 }}>
          <Stack direction="row" spacing={0.5}>
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <Select
                value={lead.status}
                onChange={(e) => onUpdateStatus(lead._id, e.target.value)}
                size="small"
                disabled={!isOwner}
                sx={{
                  "& .MuiSelect-select": { py: 0.5, fontSize: "0.875rem" },
                }}
              >
                {Object.values(LEAD_STATUSES).map((status) => (
                  <MenuItem
                    key={status}
                    value={status}
                    sx={{ fontSize: "0.875rem" }}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {}
            <IconButton
              size="small"
              onClick={() => onComment(lead)}
              disabled={!isOwner}
            >
              <CommentIcon sx={{ fontSize: "1.25rem" }} />
            </IconButton>
            {(user?.role === ROLES.ADMIN ||
              (isLeadManager && lead.createdBy === user?.id)) && (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditLead(lead);
                }}
                title="Edit Lead"
              >
                <EditIcon sx={{ fontSize: "1.25rem" }} />
              </IconButton>
            )}
            {canDeleteLeads && (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  if (
                    window.confirm("Are you sure you want to delete this lead?")
                  ) {
                    onDeleteLead(lead._id);
                  }
                }}
                color="error"
              >
                <DeleteIcon sx={{ fontSize: "1.25rem" }} />
              </IconButton>
            )}
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpansion(lead._id);
              }}
            >
              {expandedRows.has(lead._id) ? (
                <ExpandLessIcon sx={{ fontSize: "1.25rem" }} />
              ) : (
                <ExpandMoreIcon sx={{ fontSize: "1.25rem" }} />
              )}
            </IconButton>
          </Stack>
        </TableCell>
      </TableRow>
    );
  }
);
const LeadCard = React.memo(
  ({
    lead,
    canAssignLeads,
    canDeleteLeads,
    selectedLeads,
    expandedRows,
    onSelectLead,
    onUpdateStatus,
    onComment,
    onToggleExpansion,
    onDeleteLead,
    user,
    isLeadManager,
    handleEditLead,
  }) => {
    const handleCardClick = (event) => {
      if (
        event.target.closest(
          'button, input, select, [role="combobox"], .MuiSelect-select, .MuiMenuItem-root'
        )
      ) {
        return;
      }
      onToggleExpansion(lead._id);
    };
    return (
      <Paper
        onClick={handleCardClick}
        sx={{
          p: 2,
          borderLeft: (theme) =>
            `4px solid ${
              theme.palette[getLeadTypeColor(getDisplayLeadType(lead))]?.main ||
              theme.palette.grey.main
            }`,
          cursor: "pointer",
          transition: "all 0.2s ease-in-out",
          "&:hover": {
            backgroundColor: "action.hover",
            transform: "translateX(4px)",
            boxShadow: (theme) => theme.shadows[4],
          },
          "& .MuiChip-root": {
            transition: "all 0.2s ease-in-out",
            "&:hover": {
              transform: "scale(1.05)",
            },
          },
          "& .MuiIconButton-root": {
            transition: "all 0.2s ease-in-out",
            "&:hover": {
              transform: "scale(1.1)",
              backgroundColor: "action.hover",
            },
          },
        }}
      >
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Stack
              direction="row"
              spacing={2}
              alignItems="center"
              justifyContent="space-between"
            >
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Avatar
                  sx={{
                    bgcolor: (theme) =>
                      theme.palette[getLeadTypeColor(getDisplayLeadType(lead))]?.light,
                    color: (theme) =>
                      theme.palette[getLeadTypeColor(getDisplayLeadType(lead))]?.main,
                  }}
                >
                  {(
                    lead.fullName ||
                    `${lead.firstName} ${lead.lastName || ""}`.trim()
                  )
                    .charAt(0)
                    .toUpperCase()}
                </Avatar>
                <Box>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {lead.fullName ||
                      `${lead.firstName} ${lead.lastName || ""}`.trim()}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    ID: {lead._id.slice(-8)}
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  label={(getDisplayLeadType(lead) || "unknown").toUpperCase()}
                  color={getLeadTypeColor(getDisplayLeadType(lead))}
                  size="small"
                  sx={{ fontWeight: "medium" }}
                />
                <Chip
                  label={
                    lead.status.charAt(0).toUpperCase() + lead.status.slice(1)
                  }
                  color={getStatusColor(lead.status)}
                  size="small"
                  sx={{ fontWeight: "medium" }}
                />
              </Stack>
            </Stack>
          </Grid>
          <Grid item xs={12}>
            <Divider />
          </Grid>
          <Grid item xs={12}>
            <FormControl size="small" fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={lead.status}
                label="Status"
                onChange={(e) => onUpdateStatus(lead._id, e.target.value)}
                size="small"
              >
                {Object.values(LEAD_STATUSES).map((status) => (
                  <MenuItem key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleExpansion(lead._id);
                }}
                sx={{
                  transform: expandedRows.has(lead._id)
                    ? "rotate(180deg)"
                    : "none",
                }}
              >
                <ExpandMoreIcon />
              </IconButton>
              {}
              <IconButton
                size="small"
                onClick={() => onComment(lead)}
                sx={{ color: "info.main" }}
              >
                <CommentIcon />
              </IconButton>
              {(user?.role === ROLES.ADMIN ||
                (isLeadManager && lead.createdBy === user?.id)) && (
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditLead(lead);
                  }}
                  title="Edit Lead"
                >
                  <EditIcon />
                </IconButton>
              )}
              {canDeleteLeads && (
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (
                      window.confirm(
                        "Are you sure you want to delete this lead?"
                      )
                    ) {
                      onDeleteLead(lead._id);
                    }
                  }}
                  color="error"
                >
                  <DeleteIcon />
                </IconButton>
              )}
              {canAssignLeads && (
                <Tooltip 
                  title={lead.leadType === 'cold' ? "Cold leads cannot be assigned to agents" : ""}
                  arrow
                >
                  <span>
                    <Checkbox
                      checked={selectedLeads.has(lead._id)}
                      onChange={onSelectLead(lead._id)}
                      size="small"
                      disabled={lead.leadType === 'cold'}
                    />
                  </span>
                </Tooltip>
              )}
            </Stack>
          </Grid>
          <Collapse in={expandedRows.has(lead._id)} sx={{ width: "100%" }}>
            <Grid item xs={12}>
              <Box sx={{ mt: 2, pb: 2, overflowX: "hidden" }}>
                <LeadDetails lead={lead} />
              </Box>
            </Grid>
          </Collapse>
        </Grid>
      </Paper>
    );
  }
);
export default LeadsPage;
