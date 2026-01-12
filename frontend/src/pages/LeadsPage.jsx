import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
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
  Menu,
  ListItemIcon,
  ListItemText,
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
  MoreVert as MoreVertIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Phone as PhoneIcon,
  ShoppingCart as ShoppingCartIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon,
  Male as MaleIcon,
  Female as FemaleIcon,
  ContentCopy as CopyIcon,
  PersonRemove as PersonRemoveIcon,
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

// Helper function to convert country names to abbreviations
const getCountryAbbreviation = (country) => {
  if (!country) return "—";

  // Split by spaces and take first letter of each word
  const words = country.trim().split(/\s+/);
  if (words.length > 1) {
    return words.map((word) => word.charAt(0).toUpperCase()).join("");
  }

  // If single word, return as is
  return country;
};

// Helper function to calculate cooldown status for FTD/Filler leads (10-day cooldown)
const getCooldownStatus = (lead) => {
  const leadType = getDisplayLeadType(lead);

  // Only FTD and Filler leads have cooldown
  if (leadType !== "ftd" && leadType !== "filler") {
    return { hasCooldown: false, text: "N/A", color: "default" };
  }

  // If never used in an order, no cooldown
  if (!lead.lastUsedInOrder) {
    return { hasCooldown: false, text: "Available", color: "success" };
  }

  const lastUsedDate = new Date(lead.lastUsedInOrder);
  const now = new Date();
  const daysSinceUsed = Math.floor(
    (now - lastUsedDate) / (1000 * 60 * 60 * 24)
  );
  const cooldownPeriod = 10; // 10 days

  if (daysSinceUsed < cooldownPeriod) {
    const daysRemaining = cooldownPeriod - daysSinceUsed;
    return {
      hasCooldown: true,
      inCooldown: true,
      daysRemaining,
      text: `${daysRemaining}d left`,
      color: daysRemaining <= 2 ? "warning" : "error",
    };
  }

  return {
    hasCooldown: true,
    inCooldown: false,
    text: "Available",
    color: "success",
  };
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
              {lead.gender && lead.gender !== "not_defined" ? (
                <Chip
                  icon={
                    lead.gender === "male" ? (
                      <MaleIcon sx={{ fontSize: "1rem !important" }} />
                    ) : (
                      <FemaleIcon sx={{ fontSize: "1rem !important" }} />
                    )
                  }
                  label={
                    lead.gender.charAt(0).toUpperCase() + lead.gender.slice(1)
                  }
                  size="small"
                  sx={{
                    height: "24px",
                    "& .MuiChip-icon": { ml: 0.5 },
                    bgcolor: lead.gender === "male" ? "#e3f2fd" : "#fff3e0",
                    color: lead.gender === "male" ? "#1976d2" : "#e65100",
                    borderColor: lead.gender === "male" ? "#1976d2" : "#e65100",
                    border: "1px solid",
                  }}
                />
              ) : (
                <Typography variant="body2">Not Specified</Typography>
              )}
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
                <Link
                  href={`mailto:${lead.assignedAgent.email}`}
                  color="primary"
                >
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [leads, setLeads] = useState([]);
  const [agents, setAgents] = useState([]);
  const [orders, setOrders] = useState([]);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [selectedLeads, setSelectedLeads] = useState(new Set());
  const [bulkAssignDialogOpen, setBulkAssignDialogOpen] = useState(false);
  const [bulkUnassignDialogOpen, setBulkUnassignDialogOpen] = useState(false);
  const [unassignLoading, setUnassignLoading] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addLeadDialogOpen, setAddLeadDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [archivedLeadsDialogOpen, setArchivedLeadsDialogOpen] = useState(false);
  const [archivedLeads, setArchivedLeads] = useState([]);
  const [archivedLeadsLoading, setArchivedLeadsLoading] = useState(false);
  const [archivedLeadsPagination, setArchivedLeadsPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  });
  const [archivedLeadsSearch, setArchivedLeadsSearch] = useState("");
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
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [totalLeads, setTotalLeads] = useState(0);
  // Initialize filters from URL params (for global search integration)
  const [filters, setFilters] = useState(() => {
    const urlSearch = searchParams.get("search") || "";
    return {
      search: urlSearch, // Unified search field for name, email, phone, country, gender, status, lead type, order status, order priority
      nameSearch: "",
      emailSearch: "",
      phoneSearch: "",
      isAssigned: "",
      gender: "",
      documentStatus: "",
      includeConverted: true,
      order: "newest",
      orderId: "",
      assignedToMe: false,
      orderCreatedStart: "",
      orderCreatedEnd: "",
    };
  });
  const [showFilters, setShowFilters] = useState(false);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [pendingRequests, setPendingRequests] = useState(new Map()); // Map<"leadId-orderId", pendingRequest>

  // Local search input state for instant UI updates (initialized from URL params)
  const [searchInput, setSearchInput] = useState(
    () => searchParams.get("search") || ""
  );

  // Clear URL params after initial load
  useEffect(() => {
    if (searchParams.get("search")) {
      const timer = setTimeout(() => {
        setSearchParams({}, { replace: true });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []);
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
    selectedLeads.forEach((leadId) => {
      const lead = leads.find((l) => l._id === leadId);
      if (lead && (lead.leadType === "ftd" || lead.leadType === "filler")) {
        count++;
      }
    });
    return count;
  }, [selectedLeads, leads]);

  // Count selected leads that are currently assigned to an agent
  const numAssignedAgentSelected = useMemo(() => {
    let count = 0;
    selectedLeads.forEach((leadId) => {
      const lead = leads.find((l) => l._id === leadId);
      if (lead && lead.assignedAgent) {
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
  const fetchPendingRequests = useCallback(
    async (leadsData) => {
      // Only for agents - check for pending requests for each lead/order
      if (!isAgent) return;

      try {
        const requestsMap = new Map();

        // For each lead/order combination, check if there's a pending request
        for (const groupedLead of leadsData) {
          if (groupedLead.orders) {
            for (const order of groupedLead.orders) {
              try {
                const response = await api.get("/call-change-requests/check", {
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
                console.error("Failed to check pending request:", err);
              }
            }
          }
        }

        setPendingRequests(requestsMap);
      } catch (err) {
        console.error("Failed to fetch pending requests:", err);
      }
    },
    [isAgent]
  );

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
      const response = await api.get(
        "/users?role=agent&isActive=true&limit=1000"
      );
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
  const getAvailableCallOptions = useCallback(
    (currentCallNumber) => {
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
    },
    [user?.role]
  );

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
          setPendingRequests((prev) => {
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
          setSuccess(
            "Call change request submitted successfully. Waiting for approval."
          );
        } else {
          // For admin/affiliate_manager, update was successful
          // Optimistically update the local state
          setLeads((prevLeads) =>
            prevLeads.map((groupedLead) => {
              if (
                groupedLead.leadId &&
                groupedLead.leadId.toString() === leadId.toString()
              ) {
                return {
                  ...groupedLead,
                  orders: groupedLead.orders.map((order) =>
                    order.orderId.toString() === orderId.toString()
                      ? {
                          ...order,
                          callNumber: callNumber === "" ? null : callNumber,
                        }
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
          setPendingRequests((prev) => {
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
          setSuccess(
            "Verification change request submitted successfully. Waiting for approval."
          );
        } else {
          // For admin/affiliate_manager, update was successful
          // Optimistically update the local state
          setLeads((prevLeads) =>
            prevLeads.map((groupedLead) => {
              if (
                groupedLead.leadId &&
                groupedLead.leadId.toString() === leadId.toString()
              ) {
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
      } catch (err) {
        setError(err.response?.data?.message || "Failed to delete lead");
      }
    },
    [fetchLeads, setSuccess, setError]
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
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete leads");
    }
  };

  // Bulk unassign leads from agents
  const handleBulkUnassign = async () => {
    try {
      setUnassignLoading(true);
      setError(null);
      
      // Get only the leads that are assigned to an agent
      const leadsToUnassign = Array.from(selectedLeads)
        .map((id) => leads.find((lead) => lead._id === id))
        .filter((lead) => lead && lead.assignedAgent);
      
      const leadIds = leadsToUnassign.map((lead) => lead._id);
      
      if (leadIds.length === 0) {
        setError("No assigned leads selected to unassign");
        setBulkUnassignDialogOpen(false);
        setUnassignLoading(false);
        return;
      }
      
      const response = await api.post("/leads/unassign-from-agent", {
        leadIds,
      });
      
      const successCount = response.data.data?.success?.length || 0;
      const failedCount = response.data.data?.failed?.length || 0;
      
      if (successCount > 0) {
        setSuccess(
          `Successfully unassigned ${successCount} lead(s) from agents${
            failedCount > 0 ? `. ${failedCount} lead(s) failed.` : "."
          }`
        );
      } else if (failedCount > 0) {
        setError(`Failed to unassign ${failedCount} lead(s)`);
      }
      
      setBulkUnassignDialogOpen(false);
      setSelectedLeads(new Set());
      fetchLeads();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to unassign leads from agents");
    } finally {
      setUnassignLoading(false);
    }
  };

  // Fetch archived leads
  const fetchArchivedLeads = useCallback(
    async (page = 1, search = "") => {
      if (user?.role !== ROLES.ADMIN) return;

      setArchivedLeadsLoading(true);
      try {
        const response = await api.get("/leads/archived", {
          params: {
            page,
            limit: archivedLeadsPagination.limit,
            search: search || undefined,
          },
        });
        if (response.data.success) {
          setArchivedLeads(response.data.data.leads);
          setArchivedLeadsPagination(response.data.data.pagination);
        }
      } catch (err) {
        console.error("Failed to fetch archived leads:", err);
        setError(
          err.response?.data?.message || "Failed to fetch archived leads"
        );
      } finally {
        setArchivedLeadsLoading(false);
      }
    },
    [user?.role, archivedLeadsPagination.limit]
  );

  // Archive a lead
  const handleArchiveLead = useCallback(
    async (leadId) => {
      try {
        setError(null);
        await api.put(`/leads/${leadId}/archive`);
        setSuccess("Lead archived successfully");
        fetchLeads();
      } catch (err) {
        setError(err.response?.data?.message || "Failed to archive lead");
      }
    },
    [fetchLeads]
  );

  // Unarchive a lead (from archived leads dialog)
  const handleUnarchiveLead = useCallback(
    async (leadId) => {
      try {
        setError(null);
        await api.put(`/leads/${leadId}/unarchive`);
        setSuccess("Lead unarchived successfully");
        fetchArchivedLeads(archivedLeadsPagination.page, archivedLeadsSearch);
        fetchLeads();
      } catch (err) {
        setError(err.response?.data?.message || "Failed to unarchive lead");
      }
    },
    [
      fetchArchivedLeads,
      fetchLeads,
      archivedLeadsPagination.page,
      archivedLeadsSearch,
    ]
  );

  // Unarchive a lead (from main leads table)
  const handleUnarchiveLeadFromTable = useCallback(
    async (leadId) => {
      try {
        setError(null);
        await api.put(`/leads/${leadId}/unarchive`);
        setSuccess("Lead unarchived successfully");
        fetchLeads();
      } catch (err) {
        setError(err.response?.data?.message || "Failed to unarchive lead");
      }
    },
    [fetchLeads]
  );

  // Open archived leads dialog
  const handleOpenArchivedLeadsDialog = useCallback(() => {
    setArchivedLeadsDialogOpen(true);
    fetchArchivedLeads(1, "");
  }, [fetchArchivedLeads]);

  // Handle archived leads pagination
  const handleArchivedLeadsPageChange = useCallback(
    (event, newPage) => {
      fetchArchivedLeads(newPage + 1, archivedLeadsSearch);
    },
    [fetchArchivedLeads, archivedLeadsSearch]
  );

  // Handle archived leads search
  const handleArchivedLeadsSearchChange = useCallback(
    (value) => {
      setArchivedLeadsSearch(value);
      fetchArchivedLeads(1, value);
    },
    [fetchArchivedLeads]
  );

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);
  useEffect(() => {
    if (isAdminOrManager) {
      fetchAgents();
      fetchOrders();
    }
  }, [isAdminOrManager, fetchAgents, fetchOrders]);
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [success]);
  const handleLeadAdded = useCallback(
    (lead) => {
      fetchLeads();
    },
    [fetchLeads]
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
      isAssigned: "",
      gender: "",
      documentStatus: "",
      includeConverted: true,
      order: "newest",
      orderId: "",
      assignedToMe: false,
      orderCreatedStart: "",
      orderCreatedEnd: "",
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
    <Box sx={{ position: "relative" }}>
      {/* Floating action bar for selected leads */}
      {(canAssignLeads && numSelected > 0 && numAssignableSelected === 0) ||
      (isAdminOrManager && numAssignableSelected > 0) ||
      (isAdminOrManager && numAssignedAgentSelected > 0) ? (
        <Box
          sx={{
            position: "fixed",
            top: 80,
            right: 24,
            zIndex: 1200,
            display: "flex",
            gap: 2,
            alignItems: "center",
            animation: "slideInFromRight 0.3s ease-out",
            "@keyframes slideInFromRight": {
              "0%": {
                transform: "translateX(100%)",
                opacity: 0,
              },
              "100%": {
                transform: "translateX(0)",
                opacity: 1,
              },
            },
          }}
        >
          {canAssignLeads && numSelected > 0 && numAssignableSelected === 0 && (
            <Alert severity="info" sx={{ py: 0.5, px: 2 }}>
              Cold leads cannot be assigned to agents. Only FTD and Filler leads
              can be assigned.
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
                boxShadow: 4,
                "&:hover": {
                  transform: "translateY(-2px)",
                  boxShadow: 6,
                },
              }}
            >
              Assign to Agent (Permanent)
            </Button>
          )}
          {isAdminOrManager && numAssignedAgentSelected > 0 && (
            <Button
              variant="contained"
              color="warning"
              startIcon={<PersonRemoveIcon />}
              onClick={() => setBulkUnassignDialogOpen(true)}
              sx={{
                borderRadius: 2,
                px: 3,
                py: 1,
                transition: "all 0.2s",
                boxShadow: 4,
                "&:hover": {
                  transform: "translateY(-2px)",
                  boxShadow: 6,
                },
              }}
            >
              Unassign from Agent ({numAssignedAgentSelected})
            </Button>
          )}
        </Box>
      ) : null}
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
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Button
            startIcon={showFilters ? <ExpandLessIcon /> : <FilterIcon />}
            onClick={() => setShowFilters(!showFilters)}
            sx={{
              color: "primary.main",
              "&:hover": {
                bgcolor: "primary.lighter",
              },
            }}
          >
            {showFilters ? "Hide Filters" : "Show Filters"}
          </Button>
          {/* Action Icon Buttons - Top Right */}
          <Box display="flex" gap={0.5}>
            {(isLeadManager || user?.role === ROLES.ADMIN) && (
              <Tooltip title="Add New Lead">
                <IconButton
                  size="small"
                  onClick={() => setAddLeadDialogOpen(true)}
                  sx={{
                    color: "primary.main",
                    "&:hover": {
                      bgcolor: "primary.lighter",
                    },
                  }}
                >
                  <PersonAddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {isAdminOrManager && (
              <Tooltip title="Import Leads">
                <IconButton
                  size="small"
                  onClick={() => setImportDialogOpen(true)}
                  sx={{
                    color: "info.main",
                    "&:hover": {
                      bgcolor: "info.lighter",
                    },
                  }}
                >
                  <ImportIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {canDeleteLeads && (
              <Tooltip title="Bulk Delete">
                <IconButton
                  size="small"
                  onClick={() => setBulkDeleteDialogOpen(true)}
                  sx={{
                    color: "error.main",
                    "&:hover": {
                      bgcolor: "error.lighter",
                    },
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {user?.role === ROLES.ADMIN && (
              <Tooltip title="View Archived Leads">
                <IconButton
                  size="small"
                  onClick={handleOpenArchivedLeadsDialog}
                  sx={{
                    color: "warning.main",
                    "&:hover": {
                      bgcolor: "warning.lighter",
                    },
                  }}
                >
                  <ArchiveIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>
        <Collapse in={showFilters}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                label="Search"
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search by name, email, phone, country, gender, status, lead type, agent, or use 'assigned', 'unassigned', 'archived'..."
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
          </Grid>
        </Collapse>
      </Paper>
      {}
      <Box sx={{ display: { xs: "none", md: "block" }, width: "100%" }}>
        <Paper sx={{ width: "100%" }}>
          <TableContainer sx={{ width: "100%", overflowX: "auto" }}>
            <Table
              size="small"
              sx={{
                width: "100%",
                tableLayout: "auto",
                "& .MuiTableCell-root": {
                  padding: "2px 6px",
                  fontSize: "0.75rem",
                  lineHeight: 1.2,
                },
                "& .MuiTableHead-root .MuiTableCell-root": {
                  padding: "4px 6px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                },
                "& .MuiTableBody-root .MuiTableRow-root": {
                  height: "28px",
                },
                "& .MuiChip-root": {
                  height: "18px",
                  fontSize: "0.65rem",
                },
                "& .MuiTypography-root": {
                  lineHeight: 1.2,
                },
                "& .MuiStack-root": {
                  gap: "0 !important",
                },
              }}
            >
              <TableHead>
                <TableRow>
                  {!isAgent && canAssignLeads && (
                    <TableCell
                      padding="checkbox"
                      sx={{
                        borderRight: "1px solid rgba(224, 224, 224, 1)",
                        backgroundColor: "background.paper",
                        fontSize: "0.875rem",
                        width: "40px",
                        maxWidth: "40px",
                        padding: "0",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{ display: "flex", justifyContent: "center" }}
                      >
                        <Checkbox
                          indeterminate={
                            numSelected > 0 && numSelected < leads.length
                          }
                          checked={
                            leads.length > 0 && numSelected === leads.length
                          }
                          onChange={handleSelectAll}
                          sx={{ padding: "4px" }}
                        />
                      </div>
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
                  {!isAgent && (
                    <TableCell
                      sx={{
                        borderRight: "1px solid rgba(224, 224, 224, 1)",
                        backgroundColor: "background.paper",
                        fontSize: "0.875rem",
                        py: 1,
                        textAlign: "center",
                        width: "70px",
                        maxWidth: "70px",
                      }}
                    >
                      Type
                    </TableCell>
                  )}
                  <TableCell
                    sx={{
                      borderRight: "1px solid rgba(224, 224, 224, 1)",
                      backgroundColor: "background.paper",
                      fontSize: "0.875rem",
                      py: 1,
                      textAlign: "left",
                      width: "25%",
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
                        textAlign: "center",
                        width: "25%",
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
                      textAlign: "center",
                      width: "70px",
                      maxWidth: "70px",
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
                        textAlign: "center",
                        width: "70px",
                        maxWidth: "70px",
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
                        textAlign: "center",
                        width: "70px",
                        maxWidth: "70px",
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
                        textAlign: "center",
                        width: "120px",
                        maxWidth: "120px",
                      }}
                    >
                      Assigned To
                    </TableCell>
                  )}
                  {/* Status column hidden but still searchable */}
                  <TableCell
                    sx={{
                      borderRight: "1px solid rgba(224, 224, 224, 1)",
                      backgroundColor: "background.paper",
                      fontSize: "0.875rem",
                      py: 1,
                      textAlign: "center",
                      width: "70px",
                      maxWidth: "70px",
                    }}
                  >
                    Cooldown
                  </TableCell>
                  <TableCell
                    sx={{
                      backgroundColor: "background.paper",
                      fontSize: "0.875rem",
                      py: 1,
                      textAlign: "right",
                      width: "85px",
                      maxWidth: "85px",
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
                      colSpan={isAgent ? 7 : isAdminOrManager ? 10 : 9}
                      align="center"
                      sx={{ height: 200 }}
                    >
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : leads.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={isAgent ? 7 : isAdminOrManager ? 10 : 9}
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
                        onArchiveLead={handleArchiveLead}
                        onUnarchiveLead={handleUnarchiveLeadFromTable}
                        handleEditLead={handleEditLead}
                        updateCallNumber={updateCallNumber}
                      />
                      {expandedRows.has(lead._id) && (
                        <TableRow
                          onClick={() => toggleRowExpansion(lead._id)}
                          sx={{ cursor: "pointer" }}
                        >
                          <TableCell
                            colSpan={9}
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
            rowsPerPageOptions={[25, 50, 100]}
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
                        {leadInfo?.firstName || "N/A"}{" "}
                        {leadInfo?.lastName || ""}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {leadInfo?.newEmail || "No email"}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Chip
                        label={leadInfo?.leadType?.toUpperCase() || "UNKNOWN"}
                        size="small"
                        color={
                          leadInfo?.leadType === "ftd"
                            ? "success"
                            : leadInfo?.leadType === "filler"
                            ? "info"
                            : "default"
                        }
                      />
                      <Chip
                        label={
                          leadInfo?.status
                            ? leadInfo.status.charAt(0).toUpperCase() +
                              leadInfo.status.slice(1)
                            : "Unknown"
                        }
                        size="small"
                        variant="outlined"
                      />
                      <Chip
                        label={`${orders.length} Order${
                          orders.length !== 1 ? "s" : ""
                        }`}
                        size="small"
                        color="primary"
                      />
                    </Stack>
                    {orders.length > 0 && (
                      <Box>
                        <Typography
                          variant="caption"
                          fontWeight="bold"
                          gutterBottom
                        >
                          Orders:
                        </Typography>
                        <Stack spacing={1} sx={{ mt: 1 }}>
                          {orders.map((order, idx) => (
                            <Box
                              key={order.orderId || `order-${idx}`}
                              sx={{
                                pl: 2,
                                borderLeft: "2px solid",
                                borderColor: "divider",
                              }}
                            >
                              <Box
                                sx={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  mb: 0.5,
                                }}
                              >
                                <Typography variant="caption" display="block">
                                  {new Date(
                                    order.orderCreatedAt
                                  ).toLocaleDateString()}
                                </Typography>
                                <Box
                                  sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 0.5,
                                  }}
                                >
                                  <IconButton
                                    size="small"
                                    onClick={() =>
                                      handleOpenCommentDialog({
                                        _id: leadId,
                                        ...leadInfo,
                                        orderId: order.orderId,
                                      })
                                    }
                                  >
                                    <CommentIcon fontSize="small" />
                                  </IconButton>
                                  {order.comments &&
                                    order.comments.length > 0 && (
                                      <Chip
                                        label={order.comments.length}
                                        size="small"
                                        color="info"
                                        sx={{
                                          minWidth: 24,
                                          height: 16,
                                          fontSize: "0.65rem",
                                        }}
                                      />
                                    )}
                                </Box>
                              </Box>
                              {order.clientBrokers &&
                                order.clientBrokers.length > 0 && (
                                  <Box
                                    sx={{
                                      display: "flex",
                                      flexWrap: "wrap",
                                      gap: 0.5,
                                      mt: 0.5,
                                    }}
                                  >
                                    {order.clientBrokers.map((broker, bIdx) => (
                                      <Chip
                                        key={
                                          broker?._id || `broker-${idx}-${bIdx}`
                                        }
                                        label={broker?.name || "Unknown"}
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
                                        bgcolor: "action.hover",
                                        borderRadius: 1,
                                      }}
                                    >
                                      <Typography
                                        variant="caption"
                                        fontWeight="medium"
                                        display="block"
                                      >
                                        {comment.author?.fullName || "Unknown"}
                                      </Typography>
                                      <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        display="block"
                                        sx={{ fontSize: "0.65rem" }}
                                      >
                                        {new Date(
                                          comment.createdAt
                                        ).toLocaleString()}
                                      </Typography>
                                      <Typography variant="caption">
                                        {comment.text}
                                      </Typography>
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
              rowsPerPageOptions={[25, 50, 100]}
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
              rowsPerPageOptions={[25, 50, 100]}
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
        lead={Array.from(selectedLeads)
          .map((id) => leads.find((lead) => lead._id === id))
          .filter(Boolean)}
        onSuccess={() => {
          setSuccess("Leads assigned to agent successfully!");
          setSelectedLeads(new Set());
          fetchLeads();
        }}
      />
      {/* Bulk Unassign Confirmation Dialog */}
      <Dialog
        open={bulkUnassignDialogOpen}
        onClose={() => !unassignLoading && setBulkUnassignDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        sx={{
          "& .MuiBackdrop-root": {
            backdropFilter: "blur(5px)",
          },
        }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <PersonRemoveIcon color="warning" />
          Unassign Leads from Agents
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Are you sure you want to unassign <strong>{numAssignedAgentSelected}</strong> lead(s) from their assigned agents?
          </DialogContentText>
          <Alert severity="warning" sx={{ mb: 2 }}>
            These leads will become unassigned and will no longer be accessible to their current agents. You can reassign them to other agents later.
          </Alert>
          {numAssignedAgentSelected > 0 && (
            <Box sx={{ maxHeight: 200, overflowY: "auto", border: "1px solid", borderColor: "divider", borderRadius: 1, p: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Leads to be unassigned:
              </Typography>
              {Array.from(selectedLeads)
                .map((id) => leads.find((lead) => lead._id === id))
                .filter((lead) => lead && lead.assignedAgent)
                .slice(0, 10)
                .map((lead) => (
                  <Box key={lead._id} sx={{ display: "flex", justifyContent: "space-between", py: 0.5, borderBottom: "1px solid", borderColor: "divider" }}>
                    <Typography variant="body2">
                      {lead.firstName} {lead.lastName}
                    </Typography>
                    <Chip
                      size="small"
                      label={lead.assignedAgent?.fullName || "Unknown Agent"}
                      color="primary"
                      variant="outlined"
                    />
                  </Box>
                ))}
              {numAssignedAgentSelected > 10 && (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1, textAlign: "center" }}>
                  ... and {numAssignedAgentSelected - 10} more
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setBulkUnassignDialogOpen(false)} 
            disabled={unassignLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleBulkUnassign}
            color="warning"
            variant="contained"
            disabled={unassignLoading}
            startIcon={unassignLoading ? <CircularProgress size={20} /> : <PersonRemoveIcon />}
          >
            {unassignLoading ? "Unassigning..." : `Unassign ${numAssignedAgentSelected} Lead(s)`}
          </Button>
        </DialogActions>
      </Dialog>
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

      {/* Archived Leads Dialog */}
      <Dialog
        open={archivedLeadsDialogOpen}
        onClose={() => setArchivedLeadsDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <ArchiveIcon color="warning" />
          Archived Leads
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              size="small"
              label="Search archived leads"
              value={archivedLeadsSearch}
              onChange={(e) => handleArchivedLeadsSearchChange(e.target.value)}
              placeholder="Search by name, email, phone..."
              InputProps={{
                startAdornment: (
                  <SearchIcon sx={{ mr: 1, color: "action.active" }} />
                ),
              }}
            />
          </Box>

          {archivedLeadsLoading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : archivedLeads.length === 0 ? (
            <Box textAlign="center" py={4}>
              <ArchiveIcon
                sx={{ fontSize: 60, color: "text.secondary", mb: 2 }}
              />
              <Typography variant="h6" color="text.secondary">
                No archived leads found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Archived leads will appear here
              </Typography>
            </Box>
          ) : (
            <>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Phone</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Country</TableCell>
                      <TableCell>Archived By</TableCell>
                      <TableCell>Archived At</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {archivedLeads.map((lead) => (
                      <TableRow key={lead._id} hover>
                        <TableCell>
                          {lead.firstName} {lead.lastName}
                        </TableCell>
                        <TableCell>{lead.newEmail}</TableCell>
                        <TableCell>{lead.newPhone}</TableCell>
                        <TableCell>
                          <Chip
                            label={lead.leadType?.toUpperCase()}
                            size="small"
                            color={
                              lead.leadType === "ftd"
                                ? "success"
                                : lead.leadType === "filler"
                                ? "warning"
                                : "info"
                            }
                          />
                        </TableCell>
                        <TableCell>{lead.country}</TableCell>
                        <TableCell>
                          {lead.archivedBy?.fullName || "Unknown"}
                        </TableCell>
                        <TableCell>
                          {lead.archivedAt
                            ? new Date(lead.archivedAt).toLocaleString()
                            : "N/A"}
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="Unarchive Lead">
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    "Are you sure you want to unarchive this lead?"
                                  )
                                ) {
                                  handleUnarchiveLead(lead._id);
                                }
                              }}
                            >
                              <UnarchiveIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={archivedLeadsPagination.total}
                page={archivedLeadsPagination.page - 1}
                rowsPerPage={archivedLeadsPagination.limit}
                onPageChange={handleArchivedLeadsPageChange}
                rowsPerPageOptions={[10]}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setArchivedLeadsDialogOpen(false)}>
            Close
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
        <TableRow
          hover
          sx={{
            "& > *": { borderBottom: "unset" },
            "& .MuiTableCell-root": {
              py: 0.25,
              px: 1,
              fontSize: "0.75rem",
            },
          }}
        >
          <TableCell padding="checkbox">
            <IconButton
              size="small"
              onClick={() => onToggleExpansion(leadId)}
              sx={{ padding: "4px" }}
            >
              {isExpanded ? (
                <ExpandLessIcon fontSize="small" />
              ) : (
                <ExpandMoreIcon fontSize="small" />
              )}
            </IconButton>
          </TableCell>
          <TableCell>
            <Box>
              <Typography
                variant="body2"
                fontWeight="medium"
                sx={{ fontSize: "0.8rem" }}
              >
                {leadInfo?.prefix && `${leadInfo.prefix} `}
                {leadInfo?.firstName || "N/A"} {leadInfo?.lastName || ""}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: "0.7rem" }}
              >
                {leadInfo?.newEmail || "No email"}
              </Typography>
            </Box>
          </TableCell>
          <TableCell>
            <Typography variant="caption" sx={{ fontSize: "0.75rem" }}>
              {leadInfo?.country || "N/A"}
            </Typography>
          </TableCell>
          <TableCell
            sx={{ width: "70px", maxWidth: "70px", textAlign: "center" }}
          >
            <Chip
              label={leadInfo?.leadType?.toUpperCase() || "UNKNOWN"}
              color={getLeadTypeColor(leadInfo?.leadType)}
              size="small"
              sx={{
                height: "18px",
                "& .MuiChip-label": { fontSize: "0.65rem", px: 0.75 },
              }}
            />
          </TableCell>
          {/* Status column hidden but still searchable/filterable */}
          <TableCell>
            <Chip
              label={`${orders.length} Order${orders.length !== 1 ? "s" : ""}`}
              color="primary"
              size="small"
              variant="outlined"
              sx={{
                height: "18px",
                "& .MuiChip-label": { fontSize: "0.65rem", px: 0.75 },
              }}
            />
          </TableCell>
          <TableCell>
            <Typography variant="caption" sx={{ fontSize: "0.7rem" }}>
              {leadInfo?.assignedAgentAt
                ? new Date(leadInfo.assignedAgentAt).toLocaleDateString()
                : leadInfo?.createdAt
                ? new Date(leadInfo.createdAt).toLocaleDateString()
                : "N/A"}
            </Typography>
          </TableCell>
          <TableCell>
            {/* Comments now handled per order in expanded view */}
          </TableCell>
        </TableRow>
        <TableRow
          onClick={() => onToggleExpansion(leadId)}
          sx={{ cursor: isExpanded ? "pointer" : "default" }}
        >
          <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={8}>
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
                              {new Date(
                                order.orderCreatedAt
                              ).toLocaleDateString()}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {new Date(
                                order.orderCreatedAt
                              ).toLocaleTimeString()}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={order.orderedAs?.toUpperCase() || "N/A"}
                              size="small"
                              color={
                                order.orderedAs === "ftd"
                                  ? "success"
                                  : order.orderedAs === "filler"
                                  ? "info"
                                  : "default"
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {order.orderedAs === "filler" ? (
                                <Tooltip title="Call changes are not available for leads ordered as filler">
                                  <span>
                                    <FormControl
                                      size="small"
                                      sx={{ minWidth: 100 }}
                                    >
                                      <Select
                                        value={order.callNumber || ""}
                                        displayEmpty
                                        disabled
                                      >
                                        {getAvailableCallOptions(
                                          order.callNumber
                                        ).map((option) => (
                                          <MenuItem
                                            key={option || "none"}
                                            value={option}
                                          >
                                            {option === "" ? (
                                              <em>None</em>
                                            ) : (
                                              option
                                            )}
                                          </MenuItem>
                                        ))}
                                      </Select>
                                    </FormControl>
                                  </span>
                                </Tooltip>
                              ) : (
                                <FormControl
                                  size="small"
                                  sx={{ minWidth: 100 }}
                                >
                                  <Select
                                    value={order.callNumber || ""}
                                    onChange={(e) =>
                                      updateCallNumber(
                                        leadId,
                                        e.target.value,
                                        order.orderId
                                      )
                                    }
                                    displayEmpty
                                    disabled={pendingRequests.has(
                                      `${leadId}-${order.orderId}`
                                    )}
                                  >
                                    {getAvailableCallOptions(
                                      order.callNumber
                                    ).map((option) => (
                                      <MenuItem
                                        key={option || "none"}
                                        value={option}
                                      >
                                        {option === "" ? <em>None</em> : option}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              )}
                              {pendingRequests.has(
                                `${leadId}-${order.orderId}`
                              ) &&
                                pendingRequests.get(
                                  `${leadId}-${order.orderId}`
                                ).requestedCallNumber !== undefined && (
                                  <Tooltip
                                    title={`Pending: ${
                                      pendingRequests.get(
                                        `${leadId}-${order.orderId}`
                                      ).requestedCallNumber || "None"
                                    }`}
                                  >
                                    <Chip
                                      label="Pending"
                                      size="small"
                                      color="warning"
                                      sx={{ fontSize: "0.75rem" }}
                                    />
                                  </Tooltip>
                                )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {order.orderedAs === "filler" ? (
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
                                    onChange={(e) =>
                                      updateVerification(
                                        leadId,
                                        e.target.value === "yes",
                                        order.orderId
                                      )
                                    }
                                    disabled={pendingRequests.has(
                                      `${leadId}-${order.orderId}`
                                    )}
                                  >
                                    <MenuItem value="no">No</MenuItem>
                                    <MenuItem value="yes">Yes</MenuItem>
                                  </Select>
                                </FormControl>
                              )}
                              {pendingRequests.has(
                                `${leadId}-${order.orderId}`
                              ) &&
                                pendingRequests.get(
                                  `${leadId}-${order.orderId}`
                                ).requestedVerified !== undefined && (
                                  <Tooltip
                                    title={`Pending: ${
                                      pendingRequests.get(
                                        `${leadId}-${order.orderId}`
                                      ).requestedVerified
                                        ? "Yes"
                                        : "No"
                                    }`}
                                  >
                                    <Chip
                                      label="Pending"
                                      size="small"
                                      color="warning"
                                      sx={{ fontSize: "0.75rem" }}
                                    />
                                  </Tooltip>
                                )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            {order.clientBrokers &&
                            order.clientBrokers.length > 0 ? (
                              <Box
                                sx={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: 0.5,
                                }}
                              >
                                {order.clientBrokers.map((broker, idx) => {
                                  // Determine chip color based on injection status
                                  const getStatusColor = (status) => {
                                    switch (status) {
                                      case "successful":
                                        return "success";
                                      case "failed":
                                        return "error";
                                      case "pending":
                                      default:
                                        return "secondary";
                                    }
                                  };

                                  return (
                                    <Chip
                                      key={
                                        broker?._id ||
                                        `broker-${order.orderId}-${idx}`
                                      }
                                      label={broker?.name || "Unknown Broker"}
                                      size="small"
                                      color={getStatusColor(
                                        broker?.injectionStatus
                                      )}
                                      title={
                                        broker?.injectionStatus
                                          ? `Injection: ${broker.injectionStatus}`
                                          : "Lead-level broker assignment"
                                      }
                                    />
                                  );
                                })}
                              </Box>
                            ) : (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                No client brokers assigned
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Tooltip title="Add Comment">
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    onComment({
                                      _id: leadId,
                                      ...leadInfo,
                                      orderId: order.orderId,
                                    })
                                  }
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
                              <Box
                                sx={{
                                  mt: 1,
                                  maxHeight: 200,
                                  overflowY: "auto",
                                }}
                              >
                                <Stack spacing={1}>
                                  {order.comments.map((comment, idx) => (
                                    <Paper
                                      key={idx}
                                      elevation={0}
                                      sx={{
                                        p: 1,
                                        bgcolor: "action.hover",
                                        borderRadius: 1,
                                      }}
                                    >
                                      <Box
                                        sx={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 1,
                                          mb: 0.5,
                                        }}
                                      >
                                        <Avatar
                                          sx={{
                                            width: 20,
                                            height: 20,
                                            fontSize: "0.75rem",
                                          }}
                                        >
                                          {comment.author?.fullName?.charAt(
                                            0
                                          ) || "U"}
                                        </Avatar>
                                        <Typography
                                          variant="caption"
                                          fontWeight="medium"
                                        >
                                          {comment.author?.fullName ||
                                            "Unknown"}
                                        </Typography>
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                        >
                                          •{" "}
                                          {new Date(
                                            comment.createdAt
                                          ).toLocaleString()}
                                        </Typography>
                                      </Box>
                                      <Typography variant="caption">
                                        {comment.text}
                                      </Typography>
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
    onArchiveLead,
    onUnarchiveLead,
    user,
    handleEditLead,
    updateCallNumber,
  }) => {
    const [anchorEl, setAnchorEl] = useState(null);
    const menuOpen = Boolean(anchorEl);

    const handleMenuOpen = (event) => {
      event.stopPropagation();
      setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = (event) => {
      if (event) event.stopPropagation();
      setAnchorEl(null);
    };

    // Helper function to check if two IDs match (handles different formats)
    const idsMatch = (id1, id2) => {
      if (!id1 || !id2) return false;
      return String(id1) === String(id2);
    };

    const isOwner = (() => {
      if (
        user?.role === ROLES.ADMIN ||
        user?.role === ROLES.AFFILIATE_MANAGER ||
        user?.role === ROLES.LEAD_MANAGER
      ) {
        return true;
      }

      if (user?.role === ROLES.AGENT) {
        const assignedAgentId =
          lead.assignedAgent?._id ||
          lead.assignedAgent?.id ||
          lead.assignedAgent;
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
    const isArchived = lead.isArchived === true;
    const greyColor = "#9e9e9e";

    const cellSx = {
      borderRight: "1px solid rgba(224, 224, 224, 1)",
      py: 0,
      px: 0.5,
      fontSize: "0.75rem",
      textAlign: "center",
      lineHeight: 1.2,
    };
    const checkboxCellSx = {
      borderRight: "1px solid rgba(224, 224, 224, 1)",
      width: "40px",
      maxWidth: "40px",
      padding: "0",
      textAlign: "center",
    };
    return (
      <TableRow
        hover
        onClick={handleRowClick}
        sx={{
          "&:hover": { backgroundColor: "action.hover" },
          borderLeft: (theme) =>
            isArchived
              ? `4px solid #bdbdbd`
              : `4px solid ${
                  theme.palette[getLeadTypeColor(getDisplayLeadType(lead))]
                    ?.main || theme.palette.grey.main
                }`,
          cursor: "pointer",
          ...(isArchived && {
            bgcolor: "#f5f5f5",
          }),
        }}
      >
        {canAssignLeads && (
          <TableCell padding="checkbox" sx={checkboxCellSx}>
            <Tooltip
              title={
                isArchived
                  ? "Archived leads cannot be assigned"
                  : lead.leadType === "cold"
                  ? "Cold leads cannot be assigned to agents"
                  : ""
              }
              arrow
            >
              <span
                onClick={(e) => e.stopPropagation()}
                style={{ display: "flex", justifyContent: "center" }}
              >
                <Checkbox
                  checked={selectedLeads.has(lead._id)}
                  onChange={onSelectLead(lead._id)}
                  disabled={lead.leadType === "cold" || isArchived}
                  sx={{ padding: "4px" }}
                />
              </span>
            </Tooltip>
          </TableCell>
        )}
        <TableCell sx={{ ...cellSx, width: "70px", maxWidth: "70px" }}>
          <Chip
            label={
              isArchived
                ? "ARCHIVED"
                : (getDisplayLeadType(lead) || "unknown").toUpperCase()
            }
            color={
              isArchived
                ? "default"
                : getLeadTypeColor(getDisplayLeadType(lead))
            }
            size="small"
            sx={{
              fontWeight: "medium",
              height: "18px",
              "& .MuiChip-label": { fontSize: "0.65rem", px: 0.75 },
              bgcolor: isArchived ? "#bdbdbd" : undefined,
              color: isArchived ? "#616161" : undefined,
            }}
          />
        </TableCell>
        <TableCell sx={{ ...cellSx, textAlign: "left" }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: "medium",
              fontSize: "0.8rem",
              color: isArchived ? greyColor : "inherit",
            }}
          >
            {lead.fullName || `${lead.firstName} ${lead.lastName || ""}`.trim()}
          </Typography>
        </TableCell>
        <TableCell sx={cellSx}>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 0,
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontSize: "0.7rem",
                lineHeight: 1.1,
                color: isArchived ? greyColor : "inherit",
              }}
            >
              📧 {lead.newEmail}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontSize: "0.7rem",
                lineHeight: 1.1,
                color: isArchived ? greyColor : "inherit",
              }}
            >
              📱{" "}
              {lead.prefix && lead.newPhone
                ? `${lead.prefix} ${lead.newPhone}`
                : lead.newPhone || "N/A"}
            </Typography>
          </Box>
        </TableCell>
        <TableCell sx={{ ...cellSx, width: "70px", maxWidth: "70px" }}>
          <Chip
            label={getCountryAbbreviation(lead.country)}
            size="small"
            variant="outlined"
            sx={{
              height: "18px",
              "& .MuiChip-label": { fontSize: "0.65rem", px: 0.75 },
              borderColor: isArchived ? "#bdbdbd" : undefined,
              color: isArchived ? greyColor : undefined,
            }}
          />
        </TableCell>
        <TableCell sx={{ ...cellSx, width: "70px", maxWidth: "70px" }}>
          {lead.gender && lead.gender !== "not_defined" ? (
            <Chip
              icon={
                lead.gender === "male" ? (
                  <MaleIcon sx={{ fontSize: "0.9rem !important" }} />
                ) : (
                  <FemaleIcon sx={{ fontSize: "0.9rem !important" }} />
                )
              }
              label={lead.gender.charAt(0).toUpperCase()}
              size="small"
              sx={{
                height: "20px",
                "& .MuiChip-label": { fontSize: "0.65rem", px: 0.5 },
                "& .MuiChip-icon": { ml: 0.5 },
                bgcolor: isArchived
                  ? "#e0e0e0"
                  : lead.gender === "male"
                  ? "#e3f2fd"
                  : "#fff3e0",
                color: isArchived
                  ? greyColor
                  : lead.gender === "male"
                  ? "#1976d2"
                  : "#e65100",
                borderColor: isArchived
                  ? "#bdbdbd"
                  : lead.gender === "male"
                  ? "#1976d2"
                  : "#e65100",
                border: "1px solid",
              }}
            />
          ) : (
            <Typography
              sx={{
                fontWeight: "bold",
                fontSize: "1rem",
                color: isArchived ? greyColor : "inherit",
              }}
            >
              —
            </Typography>
          )}
        </TableCell>
        {isAdminOrManager && (
          <TableCell sx={{ ...cellSx, width: "120px", maxWidth: "120px" }}>
            <Typography
              sx={{
                fontWeight: lead.assignedAgent ? "normal" : "bold",
                fontSize: lead.assignedAgent ? "0.8rem" : "1rem",
                color: isArchived ? greyColor : "inherit",
              }}
            >
              {lead.assignedAgent ? lead.assignedAgent.fullName : "—"}
            </Typography>
          </TableCell>
        )}
        {/* Status column hidden but still filterable/searchable */}
        <TableCell sx={{ ...cellSx, width: "70px", maxWidth: "70px" }}>
          {(() => {
            const cooldown = getCooldownStatus(lead);
            if (isArchived) {
              return (
                <Typography
                  sx={{
                    color: greyColor,
                    fontWeight: "bold",
                    fontSize: "1rem",
                  }}
                >
                  —
                </Typography>
              );
            }

            // Show "—" for N/A
            if (cooldown.text === "N/A") {
              return (
                <Typography sx={{ fontSize: "1rem", fontWeight: "bold" }}>
                  —
                </Typography>
              );
            }

            // Show green dot for Available
            if (cooldown.text === "Available") {
              return (
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    bgcolor: "success.main",
                    margin: "0 auto",
                  }}
                />
              );
            }

            // Show chip for cooldown days remaining
            return (
              <Chip
                label={cooldown.text}
                color={cooldown.color}
                size="small"
                sx={{
                  height: "18px",
                  "& .MuiChip-label": { fontSize: "0.65rem", px: 0.75 },
                }}
              />
            );
          })()}
        </TableCell>
        <TableCell
          sx={{
            py: 0.25,
            px: 0.5,
            width: "70px",
            maxWidth: "70px",
            textAlign: "right",
          }}
        >
          <Stack
            direction="row"
            spacing={0.5}
            alignItems="center"
            justifyContent="flex-end"
          >
            <Tooltip title="Copy details (Name, Email, Phone, Country)">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  const fullName = `${lead.firstName} ${lead.lastName}`;
                  const email = lead.newEmail || "";
                  const phone = lead.newPhone || "";
                  const country = lead.country || "";
                  const copyText = [fullName, email, phone, country].join("\t");
                  navigator.clipboard.writeText(copyText);
                }}
                title="Copy details"
                sx={{ padding: "4px" }}
              >
                <CopyIcon sx={{ fontSize: "1rem" }} />
              </IconButton>
            </Tooltip>
            {(user?.role === ROLES.ADMIN || isLeadManager) && (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditLead(lead);
                }}
                title="Edit Lead"
                sx={{ padding: "4px" }}
              >
                <EditIcon sx={{ fontSize: "1rem" }} />
              </IconButton>
            )}
            <IconButton
              size="small"
              onClick={handleMenuOpen}
              disabled={!isOwner && !canDeleteLeads}
              sx={{ padding: "4px" }}
              title="More actions"
            >
              <MoreVertIcon sx={{ fontSize: "1rem" }} />
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={menuOpen}
              onClose={handleMenuClose}
              onClick={(e) => e.stopPropagation()}
              anchorOrigin={{
                vertical: "bottom",
                horizontal: "right",
              }}
              transformOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
            >
              {isOwner && (
                <Box>
                  <MenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateStatus(lead._id, LEAD_STATUSES.ACTIVE);
                      handleMenuClose();
                    }}
                    sx={{ fontSize: "0.75rem", py: 0.75 }}
                  >
                    <ListItemIcon>
                      <CheckCircleIcon
                        fontSize="small"
                        sx={{ color: "success.main" }}
                      />
                    </ListItemIcon>
                    <ListItemText primary="Active" />
                  </MenuItem>
                  <MenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateStatus(lead._id, LEAD_STATUSES.CONTACTED);
                      handleMenuClose();
                    }}
                    sx={{ fontSize: "0.75rem", py: 0.75 }}
                  >
                    <ListItemIcon>
                      <PhoneIcon fontSize="small" sx={{ color: "info.main" }} />
                    </ListItemIcon>
                    <ListItemText primary="Contacted" />
                  </MenuItem>
                  <MenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateStatus(lead._id, LEAD_STATUSES.CONVERTED);
                      handleMenuClose();
                    }}
                    sx={{ fontSize: "0.75rem", py: 0.75 }}
                  >
                    <ListItemIcon>
                      <ShoppingCartIcon
                        fontSize="small"
                        sx={{ color: "success.main" }}
                      />
                    </ListItemIcon>
                    <ListItemText primary="Converted" />
                  </MenuItem>
                  <MenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateStatus(lead._id, LEAD_STATUSES.INACTIVE);
                      handleMenuClose();
                    }}
                    sx={{ fontSize: "0.75rem", py: 0.75 }}
                  >
                    <ListItemIcon>
                      <CancelIcon
                        fontSize="small"
                        sx={{ color: "error.main" }}
                      />
                    </ListItemIcon>
                    <ListItemText primary="Inactive" />
                  </MenuItem>
                  <Divider />
                  <MenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onComment(lead);
                      handleMenuClose();
                    }}
                    sx={{ fontSize: "0.75rem", py: 0.75 }}
                  >
                    <ListItemIcon>
                      <CommentIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="Add Comment" />
                  </MenuItem>
                </Box>
              )}
              {user?.role === ROLES.ADMIN && (
                <Box>
                  {isOwner && <Divider />}
                  {isArchived ? (
                    <MenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMenuClose();
                        if (
                          window.confirm(
                            "Are you sure you want to unarchive this lead?"
                          )
                        ) {
                          onUnarchiveLead(lead._id);
                        }
                      }}
                      sx={{
                        fontSize: "0.75rem",
                        py: 0.75,
                        color: "success.main",
                      }}
                    >
                      <ListItemIcon>
                        <UnarchiveIcon
                          fontSize="small"
                          sx={{ color: "success.main" }}
                        />
                      </ListItemIcon>
                      <ListItemText primary="Unarchive" />
                    </MenuItem>
                  ) : (
                    <MenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMenuClose();
                        if (
                          window.confirm(
                            "Are you sure you want to archive this lead? It will become inactive and won't be returned by future orders."
                          )
                        ) {
                          onArchiveLead(lead._id);
                        }
                      }}
                      sx={{
                        fontSize: "0.75rem",
                        py: 0.75,
                        color: "warning.main",
                      }}
                    >
                      <ListItemIcon>
                        <ArchiveIcon
                          fontSize="small"
                          sx={{ color: "warning.main" }}
                        />
                      </ListItemIcon>
                      <ListItemText primary="Archive" />
                    </MenuItem>
                  )}
                </Box>
              )}
              {canDeleteLeads && (
                <Box>
                  <Divider />
                  <MenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMenuClose();
                      if (
                        window.confirm(
                          "Are you sure you want to delete this lead?"
                        )
                      ) {
                        onDeleteLead(lead._id);
                      }
                    }}
                    sx={{ fontSize: "0.75rem", py: 0.75, color: "error.main" }}
                  >
                    <ListItemIcon>
                      <DeleteIcon fontSize="small" color="error" />
                    </ListItemIcon>
                    <ListItemText primary="Delete" />
                  </MenuItem>
                </Box>
              )}
            </Menu>
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
    const [anchorEl, setAnchorEl] = useState(null);
    const menuOpen = Boolean(anchorEl);

    const handleMenuOpen = (event) => {
      event.stopPropagation();
      setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = (event) => {
      if (event) event.stopPropagation();
      setAnchorEl(null);
    };

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
                <Box>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {lead.fullName ||
                      `${lead.firstName} ${lead.lastName || ""}`.trim()}
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
              </Stack>
            </Stack>
          </Grid>
          <Grid item xs={12}>
            <Divider />
          </Grid>
          <Grid item xs={12}>
            <Stack
              direction="row"
              spacing={1}
              justifyContent="space-between"
              alignItems="center"
            >
              <Chip
                label={
                  lead.status.charAt(0).toUpperCase() + lead.status.slice(1)
                }
                color={getStatusColor(lead.status)}
                size="small"
                sx={{ fontWeight: "medium" }}
              />
              <Stack direction="row" spacing={1}>
                <Tooltip title="Copy details">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      const fullName = `${lead.firstName} ${lead.lastName}`;
                      const email = lead.newEmail || "";
                      const phone = lead.newPhone || "";
                      const country = lead.country || "";
                      const copyText = [fullName, email, phone, country].join(
                        "\t"
                      );
                      navigator.clipboard.writeText(copyText);
                    }}
                  >
                    <CopyIcon />
                  </IconButton>
                </Tooltip>
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
                {(user?.role === ROLES.ADMIN || isLeadManager) && (
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
                <IconButton
                  size="small"
                  onClick={handleMenuOpen}
                  title="More actions"
                >
                  <MoreVertIcon />
                </IconButton>
                <Menu
                  anchorEl={anchorEl}
                  open={menuOpen}
                  onClose={handleMenuClose}
                  onClick={(e) => e.stopPropagation()}
                  anchorOrigin={{
                    vertical: "bottom",
                    horizontal: "right",
                  }}
                  transformOrigin={{
                    vertical: "top",
                    horizontal: "right",
                  }}
                >
                  <MenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateStatus(lead._id, LEAD_STATUSES.ACTIVE);
                      handleMenuClose();
                    }}
                  >
                    <ListItemIcon>
                      <CheckCircleIcon
                        fontSize="small"
                        sx={{ color: "success.main" }}
                      />
                    </ListItemIcon>
                    <ListItemText primary="Active" />
                  </MenuItem>
                  <MenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateStatus(lead._id, LEAD_STATUSES.CONTACTED);
                      handleMenuClose();
                    }}
                  >
                    <ListItemIcon>
                      <PhoneIcon fontSize="small" sx={{ color: "info.main" }} />
                    </ListItemIcon>
                    <ListItemText primary="Contacted" />
                  </MenuItem>
                  <MenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateStatus(lead._id, LEAD_STATUSES.CONVERTED);
                      handleMenuClose();
                    }}
                  >
                    <ListItemIcon>
                      <ShoppingCartIcon
                        fontSize="small"
                        sx={{ color: "success.main" }}
                      />
                    </ListItemIcon>
                    <ListItemText primary="Converted" />
                  </MenuItem>
                  <MenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateStatus(lead._id, LEAD_STATUSES.INACTIVE);
                      handleMenuClose();
                    }}
                  >
                    <ListItemIcon>
                      <CancelIcon
                        fontSize="small"
                        sx={{ color: "error.main" }}
                      />
                    </ListItemIcon>
                    <ListItemText primary="Inactive" />
                  </MenuItem>
                  <Divider />
                  <MenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onComment(lead);
                      handleMenuClose();
                    }}
                  >
                    <ListItemIcon>
                      <CommentIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="Add Comment" />
                  </MenuItem>
                  {canDeleteLeads && (
                    <Box>
                      <Divider />
                      <MenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMenuClose();
                          if (
                            window.confirm(
                              "Are you sure you want to delete this lead?"
                            )
                          ) {
                            onDeleteLead(lead._id);
                          }
                        }}
                        sx={{ color: "error.main" }}
                      >
                        <ListItemIcon>
                          <DeleteIcon fontSize="small" color="error" />
                        </ListItemIcon>
                        <ListItemText primary="Delete" />
                      </MenuItem>
                    </Box>
                  )}
                </Menu>
              </Stack>
            </Stack>
          </Grid>
          <Collapse
            in={expandedRows.has(lead._id)}
            sx={{ width: "100%", cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpansion(lead._id);
            }}
          >
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
