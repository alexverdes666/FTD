import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  Grid,
  Card,
  CardContent,
  IconButton,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Link,
  InputAdornment,
} from "@mui/material";
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  Payment as PSPIcon,
  Business as BrokerIcon,
  Language as WebIcon,
  CreditCard as CreditCardIcon,
} from "@mui/icons-material";
import { useSelector } from "react-redux";
import { selectUser } from "../store/slices/authSlice";
import api from "../services/api";
import toast from "react-hot-toast";
import CommentButton from "../components/CommentButton";

// Card Preview Component
const CardPreview = ({ cardNumber, cardExpiry, cardCVC, compact = false }) => {
  const formatCardNumber = (num) => {
    if (!num) return "•••• •••• •••• ••••";
    const cleaned = num.replace(/\D/g, "");
    const groups = cleaned.match(/.{1,4}/g) || [];
    const formatted = groups.join(" ");
    if (formatted.length < 19) {
      return formatted + " " + "•••• •••• •••• ••••".slice(formatted.length + 1);
    }
    return formatted;
  };

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: compact ? 300 : 380,
        height: compact ? 175 : 220,
        borderRadius: 3,
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        p: compact ? 2 : 3,
        color: "white",
        position: "relative",
        boxShadow: "0 10px 30px rgba(102, 126, 234, 0.4)",
        overflow: "hidden",
        mx: compact ? 0 : "auto",
        "&::before": {
          content: '""',
          position: "absolute",
          top: -50,
          right: -50,
          width: 150,
          height: 150,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.1)",
        },
        "&::after": {
          content: '""',
          position: "absolute",
          bottom: -80,
          left: -80,
          width: 200,
          height: 200,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.05)",
        },
      }}
    >
      {/* Card Chip */}
      <Box
        sx={{
          width: compact ? 40 : 50,
          height: compact ? 28 : 35,
          borderRadius: 1,
          background: "linear-gradient(135deg, #ffd700 0%, #ffb700 100%)",
          mb: compact ? 2 : 3,
        }}
      />

      {/* Card Number */}
      <Typography
        sx={{
          fontSize: compact ? "1.1rem" : "1.4rem",
          fontFamily: "'Courier New', monospace",
          letterSpacing: "0.15em",
          mb: compact ? 2 : 3,
          textShadow: "0 2px 4px rgba(0,0,0,0.2)",
        }}
      >
        {formatCardNumber(cardNumber)}
      </Typography>

      {/* Card Details Row */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <Box>
          <Typography sx={{ fontSize: compact ? "0.55rem" : "0.65rem", opacity: 0.7, mb: 0.5 }}>
            VALID THRU
          </Typography>
          <Typography
            sx={{
              fontSize: compact ? "0.85rem" : "1rem",
              fontFamily: "'Courier New', monospace",
              letterSpacing: "0.1em",
            }}
          >
            {cardExpiry || "MM/YY"}
          </Typography>
        </Box>
        <Box>
          <Typography sx={{ fontSize: compact ? "0.55rem" : "0.65rem", opacity: 0.7, mb: 0.5 }}>
            CVC
          </Typography>
          <Typography
            sx={{
              fontSize: compact ? "0.85rem" : "1rem",
              fontFamily: "'Courier New', monospace",
              letterSpacing: "0.1em",
            }}
          >
            {cardCVC || "•••"}
          </Typography>
        </Box>
        <CreditCardIcon sx={{ fontSize: compact ? 30 : 40, opacity: 0.8 }} />
      </Box>
    </Box>
  );
};

const PSPProfilePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useSelector(selectUser);

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editData, setEditData] = useState({
    website: "",
    description: "",
    cardNumber: "",
    cardExpiry: "",
    cardCVC: "",
  });
  const [editLoading, setEditLoading] = useState(false);

  // Refs for auto-focus flow
  const websiteRef = useRef(null);
  const cardNumberRef = useRef(null);
  const cardExpiryRef = useRef(null);
  const cardCVCRef = useRef(null);
  const submitButtonRef = useRef(null);

  const isAdmin = user?.role === "admin";

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/psps/${id}/profile`);
      setProfile(response.data.data);
      setEditData({
        website: response.data.data.website || "",
        description: response.data.data.description || "",
        cardNumber: response.data.data.cardNumber || "",
        cardExpiry: response.data.data.cardExpiry || "",
        cardCVC: response.data.data.cardCVC || "",
      });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Edit PSP handlers
  const handleEditPSP = async () => {
    try {
      setEditLoading(true);
      await api.put(`/psps/${id}`, editData);
      toast.success("PSP updated");
      setEditDialogOpen(false);
      fetchProfile();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update PSP");
    } finally {
      setEditLoading(false);
    }
  };

  // Format card number for display (with spaces)
  const formatCardNumberDisplay = (value) => {
    if (!value) return "";
    const cleaned = value.replace(/\D/g, "");
    const groups = cleaned.match(/.{1,4}/g) || [];
    return groups.join(" ");
  };

  // Format card number input
  const handleCardNumberChange = (e) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 16) value = value.slice(0, 16);
    setEditData({ ...editData, cardNumber: value });

    // Auto-move to expiry when 16 digits entered
    if (value.length === 16) {
      setTimeout(() => cardExpiryRef.current?.focus(), 50);
    }
  };

  // Format expiry input
  const handleExpiryChange = (e) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 4) value = value.slice(0, 4);
    if (value.length >= 2) {
      value = value.slice(0, 2) + "/" + value.slice(2);
    }
    setEditData({ ...editData, cardExpiry: value });

    // Auto-move to CVC when expiry is complete
    if (value.length === 5) {
      setTimeout(() => cardCVCRef.current?.focus(), 50);
    }
  };

  // Format CVC input
  const handleCVCChange = (e) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 4) value = value.slice(0, 4);
    setEditData({ ...editData, cardCVC: value });

    // Auto-move to submit button when CVC is complete
    if (value.length >= 3) {
      setTimeout(() => submitButtonRef.current?.focus(), 50);
    }
  };

  // Handle website field - move to card number on Enter
  const handleWebsiteKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      cardNumberRef.current?.focus();
    }
  };

  // Open edit dialog with auto-focus
  const handleOpenEditDialog = () => {
    setEditDialogOpen(true);
    setTimeout(() => websiteRef.current?.focus(), 100);
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!profile) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">PSP not found</Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, mb: 2 }}>
          <IconButton onClick={() => navigate(-1)}>
            <BackIcon />
          </IconButton>
          <PSPIcon sx={{ fontSize: 40, color: "primary.main", mt: 0.5 }} />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h5" fontWeight="bold">
              {profile.name}
            </Typography>
            {profile.website && (
              <Link
                href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
              >
                <WebIcon fontSize="small" />
                {profile.website}
              </Link>
            )}
            {profile.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {profile.description}
              </Typography>
            )}
          </Box>
          <Chip
            label={profile.isActive ? "Active" : "Inactive"}
            color={profile.isActive ? "success" : "default"}
          />
          {isAdmin && (
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={handleOpenEditDialog}
            >
              Edit
            </Button>
          )}
          <CommentButton
            targetType="psp"
            targetId={profile._id}
            targetName={profile.name}
          />
        </Box>

        {/* Summary Stats and Card Preview */}
        <Grid container spacing={2}>
          <Grid item xs={12} md={profile.cardNumber ? 8 : 12}>
            <Grid container spacing={2}>
              <Grid item xs={6} sm={4}>
                <Card variant="outlined">
                  <CardContent sx={{ textAlign: "center", py: 1 }}>
                    <Typography variant="h4" color="primary.main">
                      {profile.linkedBrokersCount || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Linked Brokers
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} sm={4}>
                <Card variant="outlined">
                  <CardContent sx={{ textAlign: "center", py: 1 }}>
                    <Typography variant="h4" color="primary.main">
                      {profile.createdBy?.fullName || "-"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Created By
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Card variant="outlined">
                  <CardContent sx={{ textAlign: "center", py: 1 }}>
                    <Typography variant="h6" color="text.primary">
                      {new Date(profile.createdAt).toLocaleDateString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Created At
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Grid>

          {/* Card Preview */}
          {profile.cardNumber && (
            <Grid item xs={12} md={4}>
              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Card Preview
                </Typography>
                <CardPreview
                  cardNumber={profile.cardNumber}
                  cardExpiry={profile.cardExpiry}
                  cardCVC={profile.cardCVC}
                  compact
                />
              </Box>
            </Grid>
          )}
        </Grid>
      </Paper>

      <Grid container spacing={3}>
        {/* Linked Brokers Section */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              <BrokerIcon sx={{ mr: 1, verticalAlign: "middle" }} />
              Linked Brokers ({profile.linkedBrokers?.length || 0})
            </Typography>
            {profile.linkedBrokers?.length ? (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: "bold", backgroundColor: "#f5f5f5" }}>
                        Broker Name
                      </TableCell>
                      <TableCell sx={{ fontWeight: "bold", backgroundColor: "#f5f5f5" }}>
                        Domain
                      </TableCell>
                      <TableCell sx={{ fontWeight: "bold", backgroundColor: "#f5f5f5" }}>
                        Description
                      </TableCell>
                      <TableCell
                        align="center"
                        sx={{ fontWeight: "bold", backgroundColor: "#f5f5f5" }}
                      >
                        Status
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ fontWeight: "bold", backgroundColor: "#f5f5f5" }}
                      >
                        Actions
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {profile.linkedBrokers.map((broker) => (
                      <TableRow key={broker._id} hover>
                        <TableCell>
                          <Typography fontWeight="medium">{broker.name}</Typography>
                        </TableCell>
                        <TableCell>
                          {broker.domain ? (
                            <Link
                              href={broker.domain.startsWith("http") ? broker.domain : `https://${broker.domain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {broker.domain}
                            </Link>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              maxWidth: 300,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {broker.description || "-"}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={broker.isActive ? "Active" : "Inactive"}
                            color={broker.isActive ? "success" : "default"}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            onClick={() => navigate(`/client-broker/${broker._id}`)}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Box sx={{ py: 5, textAlign: "center" }}>
                <BrokerIcon sx={{ fontSize: 48, color: "text.secondary", mb: 2 }} />
                <Typography color="text.secondary">
                  No brokers are currently using this PSP
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Edit PSP Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit PSP</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <TextField
              inputRef={websiteRef}
              label="Website URL"
              placeholder="e.g., stripe.com"
              value={editData.website}
              onChange={(e) => setEditData({ ...editData, website: e.target.value })}
              onKeyDown={handleWebsiteKeyDown}
              fullWidth
              required
              helperText="The PSP name will be updated automatically when you change the URL"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <WebIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label="Description"
              value={editData.description}
              onChange={(e) => setEditData({ ...editData, description: e.target.value })}
              fullWidth
              multiline
              rows={2}
            />

            {/* Card Preview Section */}
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Card Preview (Optional)
              </Typography>

              {/* Live Card Preview */}
              <Box sx={{ mb: 3 }}>
                <CardPreview
                  cardNumber={editData.cardNumber}
                  cardExpiry={editData.cardExpiry}
                  cardCVC={editData.cardCVC}
                />
              </Box>

              {/* Card Input Fields */}
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <TextField
                  inputRef={cardNumberRef}
                  label="Card Number"
                  placeholder="1234 5678 9012 3456"
                  value={formatCardNumberDisplay(editData.cardNumber)}
                  onChange={handleCardNumberChange}
                  fullWidth
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <CreditCardIcon color="action" />
                      </InputAdornment>
                    ),
                  }}
                />
                <Box sx={{ display: "flex", gap: 2 }}>
                  <TextField
                    inputRef={cardExpiryRef}
                    label="Expiry Date"
                    placeholder="MM/YY"
                    value={editData.cardExpiry}
                    onChange={handleExpiryChange}
                    fullWidth
                  />
                  <TextField
                    inputRef={cardCVCRef}
                    label="CVC"
                    placeholder="123"
                    value={editData.cardCVC}
                    onChange={handleCVCChange}
                    fullWidth
                  />
                </Box>
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button
            ref={submitButtonRef}
            onClick={handleEditPSP}
            variant="contained"
            disabled={editLoading}
          >
            {editLoading ? <CircularProgress size={20} /> : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PSPProfilePage;
