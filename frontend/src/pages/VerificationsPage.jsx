import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Button,
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
  Paper,
  Pagination,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Snackbar,
  Stack,
  Avatar,
  IconButton,
  Tooltip,
  Badge,
} from "@mui/material";
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Visibility as ViewIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Home as AddressIcon,
  Work as WorkIcon,
  AttachMoney as IncomeIcon,
  Badge as IdIcon,
  PhotoCamera as PhotoIcon,
  Security as SecurityIcon,
} from "@mui/icons-material";
import { useSelector } from "react-redux";
import api from "../services/api";

const VerificationsPage = () => {
  const { user } = useSelector((state) => state.auth);

  // State management
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [selectedVerification, setSelectedVerification] = useState(null);
  const [viewDetailsDialog, setViewDetailsDialog] = useState(false);
  const [approveDialog, setApproveDialog] = useState(false);
  const [rejectDialog, setRejectDialog] = useState(false);
  const [notes, setNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [photoDialog, setPhotoDialog] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  // Email and phone editing for approval
  const [editableEmail, setEditableEmail] = useState("");
  const [editablePhone, setEditablePhone] = useState("");
  const [editableFullName, setEditableFullName] = useState("");
  const [editableCountry, setEditableCountry] = useState("Bulgaria");
  const [editableAddress, setEditableAddress] = useState("");
  const [editableGender, setEditableGender] = useState("not_defined");
  const [editableDob, setEditableDob] = useState("");

  // Filters and pagination
  const [filters, setFilters] = useState({
    status: "all",
    page: 1,
    limit: 10,
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
  });

  // Notifications
  const [notification, setNotification] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  // Fetch verifications
  const fetchVerifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get("/verifications", {
        params: filters,
      });

      setVerifications(response.data.data);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error("Error fetching verifications:", error);
      showNotification("Failed to fetch verifications", "error");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Fetch statistics
  const fetchStats = useCallback(async () => {
    try {
      const response = await api.get("/verifications/stats");
      setStats(response.data.data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  }, []);

  // Get verification details with photos
  const fetchVerificationDetails = async (sessionId) => {
    try {
      const response = await api.get(`/verifications/${sessionId}`, {
        params: { includePhotos: true },
      });
      setSelectedVerification(response.data.data);
      setViewDetailsDialog(true);
    } catch (error) {
      console.error("Error fetching verification details:", error);
      showNotification("Failed to fetch verification details", "error");
    }
  };

  // Refresh verification details if dialog is open
  const refreshSelectedVerification = async () => {
    if (selectedVerification && viewDetailsDialog) {
      try {
        const response = await api.get(
          `/verifications/${selectedVerification.sessionId}`,
          {
            params: { includePhotos: true },
          }
        );
        setSelectedVerification(response.data.data);
      } catch (error) {
        console.error("Error refreshing verification details:", error);
      }
    }
  };

  // Helper to check if a value is N/A or empty
  const isNA = (val) => !val || val.trim() === "" || val.trim() === "N/A";

  // Check if the selected verification has N/A personal info
  const isExternalNA = selectedVerification
    ? isNA(selectedVerification.personalInfo?.firstName) &&
      isNA(selectedVerification.personalInfo?.lastName)
    : false;

  // Approve verification
  const handleApprove = async () => {
    if (isExternalNA && !editableFullName.trim()) {
      showNotification("Please provide a full name", "error");
      return;
    }

    try {
      setProcessing(true);

      const payload = {
        notes: notes.trim() || undefined,
        country: editableCountry.trim() || "Bulgaria",
        address: editableAddress.trim() || undefined,
        gender: editableGender || "not_defined",
        dob: editableDob || undefined,
      };

      if (isExternalNA) {
        payload.fullName = editableFullName.trim();
        // Only send email/phone if user provided real values
        if (editableEmail.trim() && editableEmail.trim() !== "N/A") {
          payload.newEmail = editableEmail.trim();
        }
        if (editablePhone.trim() && editablePhone.trim() !== "N/A") {
          payload.newPhone = editablePhone.trim();
        }
      } else {
        payload.newEmail = editableEmail.trim();
        payload.newPhone = editablePhone.trim();
      }

      await api.put(
        `/verifications/${selectedVerification.sessionId}/approve`,
        payload
      );

      // Close dialog and clear form since verification is now migrated
      setApproveDialog(false);
      setViewDetailsDialog(false); // Close details dialog too since verification no longer exists
      setNotes("");
      setEditableEmail("");
      setEditablePhone("");
      setEditableFullName("");
      setEditableCountry("Bulgaria");
      setEditableAddress("");
      setEditableGender("not_defined");
      setEditableDob("");
      setSelectedVerification(null); // Clear selected verification

      showNotification(
        "Verification approved and lead migrated successfully",
        "success"
      );

      // Refresh data - the approved verification will no longer be in the list
      await fetchVerifications();
      await fetchStats();
    } catch (error) {
      console.error("Error approving verification:", error);
      showNotification(
        error.response?.data?.message || "Failed to approve verification",
        "error"
      );
    } finally {
      setProcessing(false);
    }
  };

  // Reject verification
  const handleReject = async () => {
    const trimmedReason = rejectionReason.trim();

    // Validate reason length
    if (trimmedReason.length < 10) {
      showNotification(
        "Rejection reason must be at least 10 characters long",
        "error"
      );
      return;
    }

    if (trimmedReason.length > 500) {
      showNotification(
        "Rejection reason must not exceed 500 characters",
        "error"
      );
      return;
    }

    try {
      setProcessing(true);
      console.log("Sending rejection request:", {
        sessionId: selectedVerification.sessionId,
        reason: trimmedReason,
        reasonLength: trimmedReason.length,
      });

      await api.put(`/verifications/${selectedVerification.sessionId}/reject`, {
        reason: trimmedReason,
      });

      // Update the selected verification status immediately
      setSelectedVerification((prev) => ({
        ...prev,
        metadata: {
          ...prev.metadata,
          status: "manually_rejected",
          rejectedBy: user._id,
          rejectedAt: new Date().toISOString(),
          rejectionReason: trimmedReason,
        },
      }));

      showNotification("Verification rejected successfully", "success");
      setRejectDialog(false);
      setRejectionReason("");

      // Refresh data
      await fetchVerifications();
      await fetchStats();
      await refreshSelectedVerification();
    } catch (error) {
      console.error("Error rejecting verification:", error);
      console.error("Error response:", error.response?.data);

      let errorMessage = "Failed to reject verification";
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.errors) {
        errorMessage = error.response.data.errors.map((e) => e.msg).join(", ");
      }

      showNotification(errorMessage, "error");
    } finally {
      setProcessing(false);
    }
  };

  // Show notification
  const showNotification = (message, severity = "success") => {
    setNotification({ open: true, message, severity });
  };

  // Handle filter changes
  const handleFilterChange = (name, value) => {
    setFilters((prev) => ({
      ...prev,
      [name]: value,
      page: 1, // Reset to first page when filter changes
    }));
  };

  // Handle page change
  const handlePageChange = (event, page) => {
    setFilters((prev) => ({
      ...prev,
      page,
    }));
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "warning";
      case "approved":
        return "success";
      case "failed":
        return "error";
      case "verification_failed":
        return "error";
      case "manually_rejected":
        return "error";
      default:
        return "default";
    }
  };

  // Get status display text
  const getStatusText = (status) => {
    switch (status) {
      case "pending":
        return "Pending Review";
      case "approved":
        return "AWS Approved";
      case "failed":
        return "AWS Failed";
      case "verification_failed":
        return "Verification Failed";
      case "manually_rejected":
        return "Manually Rejected";
      default:
        return status;
    }
  };

  // Open photo viewer
  const viewPhoto = (photoData, photoType) => {
    setSelectedPhoto({ data: photoData, type: photoType });
    setPhotoDialog(true);
  };

  // Check if user can take action
  const canTakeAction = useMemo(() => {
    return user?.role === "admin" || user?.role === "lead_manager";
  }, [user?.role]);

  // Load data on mount and filter changes
  useEffect(() => {
    fetchVerifications();
  }, [fetchVerifications]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <Box sx={{ p: 3 }}>
      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent sx={{ textAlign: "center" }}>
              <Typography variant="h4">{stats.total || 0}</Typography>
              <Typography color="textSecondary">Total</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent sx={{ textAlign: "center" }}>
              <Badge badgeContent={stats.pending || 0} color="warning">
                <Typography variant="h4">{stats.pending || 0}</Typography>
              </Badge>
              <Typography color="textSecondary">Pending</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent sx={{ textAlign: "center" }}>
              <Typography variant="h4" color="success.main">
                {stats.approved || 0}
              </Typography>
              <Typography color="textSecondary">AWS Approved</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent sx={{ textAlign: "center" }}>
              <Typography variant="h4" color="error.main">
                {(stats.failed || 0) + (stats.verification_failed || 0) + (stats.manually_rejected || 0)}
              </Typography>
              <Typography color="textSecondary">Rejected</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  label="Status"
                  onChange={(e) => handleFilterChange("status", e.target.value)}
                >
                  <MenuItem value="all">All Statuses</MenuItem>
                  <MenuItem value="pending">Pending Review</MenuItem>
                  <MenuItem value="approved">AWS Approved</MenuItem>
                  <MenuItem value="failed">AWS Failed</MenuItem>
                  <MenuItem value="verification_failed">
                    Verification Failed
                  </MenuItem>
                  <MenuItem value="manually_rejected">
                    Manually Rejected
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Per Page</InputLabel>
                <Select
                  value={filters.limit}
                  label="Per Page"
                  onChange={(e) => handleFilterChange("limit", e.target.value)}
                >
                  <MenuItem value={10}>10</MenuItem>
                  <MenuItem value={25}>25</MenuItem>
                  <MenuItem value={50}>50</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Verifications Table */}
      <Card>
        <CardContent>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Applicant</TableCell>
                  <TableCell>Contact</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>AWS Score</TableCell>
                  <TableCell>Submitted</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : verifications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      No verifications found
                    </TableCell>
                  </TableRow>
                ) : (
                  verifications.map((verification, index) => (
                    <TableRow key={`${verification.sessionId}-${index}`}>
                      <TableCell>
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Avatar>
                            <PersonIcon />
                          </Avatar>
                          <Box>
                            <Typography variant="subtitle2">
                              {verification.personalInfo.firstName}{" "}
                              {verification.personalInfo.lastName}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              EGN: {verification.personalInfo.egn}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.5}>
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                          >
                            <EmailIcon fontSize="small" color="action" />
                            <Typography variant="body2">
                              {verification.personalInfo.email}
                            </Typography>
                          </Stack>
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                          >
                            <PhoneIcon fontSize="small" color="action" />
                            <Typography variant="body2">
                              {verification.personalInfo.phone}
                            </Typography>
                          </Stack>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getStatusText(verification.metadata.status)}
                          color={getStatusColor(verification.metadata.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {verification.metadata.rekognitionResult ? (
                          <Stack spacing={0.5}>
                            <Typography variant="body2">
                              Similarity:{" "}
                              {verification.metadata.rekognitionResult.similarity?.toFixed(
                                1
                              )}
                              %
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              Confidence:{" "}
                              {verification.metadata.rekognitionResult.confidence?.toFixed(
                                1
                              )}
                              %
                            </Typography>
                          </Stack>
                        ) : (
                          <Typography variant="body2" color="textSecondary">
                            Not processed
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(verification.metadata.createdAt)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Stack
                          direction="row"
                          spacing={1}
                          justifyContent="center"
                        >
                          <Tooltip title="View Details">
                            <IconButton
                              size="small"
                              onClick={() =>
                                fetchVerificationDetails(verification.sessionId)
                              }
                            >
                              <ViewIcon />
                            </IconButton>
                          </Tooltip>
                          {canTakeAction && (
                              <>
                                <Tooltip title={verification.metadata.status === "manually_rejected" || verification.metadata.status === "verification_failed" ? "Re-approve" : "Approve"}>
                                  <IconButton
                                    size="small"
                                    color="success"
                                    onClick={() => {
                                      setSelectedVerification(verification);
                                      const naCheck = (v) => !v || v.trim() === "" || v.trim() === "N/A";
                                      setEditableEmail(
                                        naCheck(verification.personalInfo.email) ? "" : verification.personalInfo.email
                                      );
                                      setEditablePhone(
                                        naCheck(verification.personalInfo.phone) ? "" : verification.personalInfo.phone
                                      );
                                      setEditableFullName("");
                                      setEditableCountry("Bulgaria");
                                      setEditableAddress(naCheck(verification.personalInfo.address) ? "" : verification.personalInfo.address);
                                      setEditableGender("not_defined");
                                      setEditableDob("");
                                      setNotes("");
                                      setApproveDialog(true);
                                    }}
                                    disabled={processing}
                                  >
                                    <ApproveIcon />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title={verification.metadata.status === "manually_rejected" || verification.metadata.status === "verification_failed" ? "Re-reject" : "Reject"}>
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => {
                                      setSelectedVerification(verification);
                                      setRejectDialog(true);
                                    }}
                                    disabled={processing}
                                  >
                                    <RejectIcon />
                                  </IconButton>
                                </Tooltip>
                              </>
                            )}
                          {(verification.metadata.status ===
                            "manually_rejected" || verification.metadata.status === "verification_failed") && (
                            <Chip
                              size="small"
                              label="Rejected"
                              color="error"
                              variant="outlined"
                            />
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
              <Pagination
                count={pagination.totalPages}
                page={pagination.currentPage}
                onChange={handlePageChange}
                color="primary"
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* View Details Dialog */}
      <Dialog
        open={viewDetailsDialog}
        onClose={() => setViewDetailsDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={2}>
            <SecurityIcon />
            <Typography variant="h6">Verification Details</Typography>
            {selectedVerification && (
              <Chip
                label={getStatusText(selectedVerification.metadata.status)}
                color={getStatusColor(selectedVerification.metadata.status)}
                size="small"
              />
            )}
          </Stack>
        </DialogTitle>
        <DialogContent>
          {selectedVerification && (
            <Grid container spacing={3}>
              {/* Personal Information */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Personal Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <PersonIcon color="action" />
                      <Box>
                        <Typography variant="body2" color="textSecondary">
                          Full Name
                        </Typography>
                        <Typography variant="body1">
                          {selectedVerification.personalInfo.firstName}{" "}
                          {selectedVerification.personalInfo.lastName}
                        </Typography>
                      </Box>
                    </Stack>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <IdIcon color="action" />
                      <Box>
                        <Typography variant="body2" color="textSecondary">
                          EGN
                        </Typography>
                        <Typography variant="body1">
                          {selectedVerification.personalInfo.egn}
                        </Typography>
                      </Box>
                    </Stack>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <EmailIcon color="action" />
                      <Box>
                        <Typography variant="body2" color="textSecondary">
                          Email
                        </Typography>
                        <Typography variant="body1">
                          {selectedVerification.personalInfo.email}
                        </Typography>
                      </Box>
                    </Stack>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <PhoneIcon color="action" />
                      <Box>
                        <Typography variant="body2" color="textSecondary">
                          Phone
                        </Typography>
                        <Typography variant="body1">
                          {selectedVerification.personalInfo.phone}
                        </Typography>
                      </Box>
                    </Stack>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <AddressIcon color="action" />
                      <Box>
                        <Typography variant="body2" color="textSecondary">
                          Address
                        </Typography>
                        <Typography variant="body1">
                          {selectedVerification.personalInfo.address}
                        </Typography>
                      </Box>
                    </Stack>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <WorkIcon color="action" />
                      <Box>
                        <Typography variant="body2" color="textSecondary">
                          Employment
                        </Typography>
                        <Typography variant="body1">
                          {selectedVerification.personalInfo.employment}
                        </Typography>
                      </Box>
                    </Stack>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <IncomeIcon color="action" />
                      <Box>
                        <Typography variant="body2" color="textSecondary">
                          Income
                        </Typography>
                        <Typography variant="body1">
                          {selectedVerification.personalInfo.income} BGN
                        </Typography>
                      </Box>
                    </Stack>
                  </Grid>
                </Grid>
              </Grid>

              {/* Photos */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Verification Photos
                </Typography>
                <Grid container spacing={2}>
                  {selectedVerification.photos &&
                    Object.entries(selectedVerification.photos).map(
                      ([photoType, photo]) => (
                        <Grid item xs={12} sm={6} md={4} key={photoType}>
                          <Card
                            sx={{
                              cursor: "pointer",
                              "&:hover": { boxShadow: 4 },
                            }}
                            onClick={() => viewPhoto(photo.data, photoType)}
                          >
                            <CardContent sx={{ textAlign: "center", p: 2 }}>
                              <PhotoIcon
                                sx={{ fontSize: 40, mb: 1, color: "action" }}
                              />
                              <Typography variant="body2" gutterBottom>
                                {photoType
                                  .replace(/([A-Z])/g, " $1")
                                  .replace(/^./, (str) => str.toUpperCase())}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="textSecondary"
                              >
                                Click to view
                              </Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                      )
                    )}
                </Grid>
              </Grid>

              {/* AWS Rekognition Results */}
              {selectedVerification.metadata.rekognitionResult && (
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    AWS Rekognition Results
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Box
                        sx={{
                          textAlign: "center",
                          p: 2,
                          bgcolor: "background.paper",
                        }}
                      >
                        <Typography variant="h4" color="primary">
                          {selectedVerification.metadata.rekognitionResult.similarity?.toFixed(
                            1
                          )}
                          %
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Similarity Score
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Box
                        sx={{
                          textAlign: "center",
                          p: 2,
                          bgcolor: "background.paper",
                        }}
                      >
                        <Typography variant="h4" color="secondary">
                          {selectedVerification.metadata.rekognitionResult.confidence?.toFixed(
                            1
                          )}
                          %
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Confidence Level
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </Grid>
              )}

              {/* Session Recordings */}
              {selectedVerification.metadata.sessionRecordings &&
                selectedVerification.metadata.sessionRecordings.length > 0 && (
                  <Grid item xs={12}>
                    <Typography variant="h6" gutterBottom>
                      Session Recordings
                    </Typography>
                    <Typography
                      variant="body2"
                      color="textSecondary"
                      gutterBottom
                    >
                      Complete session recordings from both cameras during the
                      verification process.
                    </Typography>
                    <Grid container spacing={2}>
                      {selectedVerification.metadata.sessionRecordings.map(
                        (recording, index) => (
                          <Grid item xs={12} sm={6} key={index}>
                            <Card>
                              <CardContent>
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
                                    <Typography
                                      variant="caption"
                                      color="textSecondary"
                                    >
                                      {Math.round(recording.duration / 1000)}s •{" "}
                                      {(
                                        recording.fileSize /
                                        (1024 * 1024)
                                      ).toFixed(1)}
                                      MB
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
                                          console.error(
                                            "No S3 key found for recording"
                                          );
                                          return;
                                        }

                                        const [sessionId, filename] =
                                          s3Key.split("/");

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
                                          alert(
                                            "Error loading video. Please try again."
                                          );
                                        }
                                      } catch (error) {
                                        console.error(
                                          "Error fetching video:",
                                          error
                                        );
                                        alert(
                                          "Error loading video. Please try again."
                                        );
                                      }
                                    }}
                                    startIcon={<ViewIcon />}
                                  >
                                    View Recording
                                  </Button>
                                  <Typography
                                    variant="caption"
                                    color="textSecondary"
                                    sx={{ textAlign: "center" }}
                                  >
                                    Uploaded: {formatDate(recording.uploadedAt)}
                                  </Typography>
                                </Stack>
                              </CardContent>
                            </Card>
                          </Grid>
                        )
                      )}
                    </Grid>
                  </Grid>
                )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          {canTakeAction && selectedVerification && (
              <>
                <Button
                  color="error"
                  onClick={() => setRejectDialog(true)}
                  startIcon={<RejectIcon />}
                  disabled={processing}
                >
                  {selectedVerification.metadata.status === "manually_rejected" || selectedVerification.metadata.status === "verification_failed" ? "Re-reject" : "Reject"}
                </Button>
                <Button
                  color="success"
                  onClick={() => {
                    const naCheck = (v) => !v || v.trim() === "" || v.trim() === "N/A";
                    setEditableEmail(
                      naCheck(selectedVerification.personalInfo?.email) ? "" : selectedVerification.personalInfo.email
                    );
                    setEditablePhone(
                      naCheck(selectedVerification.personalInfo?.phone) ? "" : selectedVerification.personalInfo.phone
                    );
                    setEditableFullName("");
                    setEditableCountry("Bulgaria");
                    setEditableAddress(naCheck(selectedVerification.personalInfo?.address) ? "" : selectedVerification.personalInfo.address);
                    setEditableGender("not_defined");
                    setEditableDob("");
                    setNotes("");
                    setApproveDialog(true);
                  }}
                  startIcon={<ApproveIcon />}
                  variant="contained"
                  disabled={processing}
                >
                  {selectedVerification.metadata.status === "manually_rejected" || selectedVerification.metadata.status === "verification_failed" ? "Re-approve & Create Lead" : "Approve & Create Lead"}
                </Button>
              </>
            )}
          {selectedVerification &&
            (selectedVerification.metadata.status === "manually_rejected" || selectedVerification.metadata.status === "verification_failed") && (
              <Alert severity="warning">
                {selectedVerification.metadata.status === "verification_failed"
                  ? "This verification failed AWS automated checks."
                  : <>
                      This verification was previously rejected
                      {selectedVerification.metadata.rejectedAt &&
                        ` on ${formatDate(selectedVerification.metadata.rejectedAt)}`}
                      {selectedVerification.metadata.rejectionReason &&
                        `. Reason: ${selectedVerification.metadata.rejectionReason}`}
                    </>
                }
                <br />
                You can still change the status by approving or re-rejecting it.
              </Alert>
            )}
          <Button onClick={() => setViewDetailsDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Photo Viewer Dialog */}
      <Dialog
        open={photoDialog}
        onClose={() => setPhotoDialog(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          {selectedPhoto?.type
            ?.replace(/([A-Z])/g, " $1")
            .replace(/^./, (str) => str.toUpperCase())}
        </DialogTitle>
        <DialogContent>
          {selectedPhoto && (
            <Box sx={{ textAlign: "center" }}>
              <img
                src={selectedPhoto.data}
                alt={selectedPhoto.type}
                loading="lazy"
                style={{
                  maxWidth: "100%",
                  maxHeight: "70vh",
                  objectFit: "contain",
                }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPhotoDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog
        open={approveDialog}
        onClose={() => setApproveDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Approve Verification</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Are you sure you want to approve this verification? This will create
            a new FTD lead in the system.
          </Typography>

          {/* Contact Information Editing */}
          {selectedVerification && isExternalNA && (
            <Box sx={{ mt: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Lead Information
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                This verification has no personal info. Please provide a full name for the lead.
                Email and phone are optional.
              </Typography>

              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Full Name"
                    value={editableFullName}
                    onChange={(e) => setEditableFullName(e.target.value)}
                    placeholder="Enter full name"
                    required
                    error={!editableFullName.trim()}
                    helperText={!editableFullName.trim() ? "Full name is required" : ""}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Email (optional)"
                    type="email"
                    value={editableEmail}
                    onChange={(e) => setEditableEmail(e.target.value)}
                    placeholder="Enter email address"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Phone (optional)"
                    value={editablePhone}
                    onChange={(e) => setEditablePhone(e.target.value)}
                    placeholder="Enter phone number"
                  />
                </Grid>
              </Grid>
            </Box>
          )}
          {selectedVerification && !isExternalNA && (
            <Box sx={{ mt: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Contact Information
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                You can modify the email and phone before creating the lead.
                Original values will be preserved as oldEmail and oldPhone.
              </Typography>

              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Email"
                    type="email"
                    value={editableEmail}
                    onChange={(e) => setEditableEmail(e.target.value)}
                    placeholder="Enter email address"
                    helperText={
                      editableEmail !== selectedVerification.personalInfo.email
                        ? `Original: ${selectedVerification.personalInfo.email}`
                        : ""
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Phone"
                    value={editablePhone}
                    onChange={(e) => setEditablePhone(e.target.value)}
                    placeholder="Enter phone number"
                    helperText={
                      editablePhone !== selectedVerification.personalInfo.phone
                        ? `Original: ${selectedVerification.personalInfo.phone}`
                        : ""
                    }
                  />
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Additional Lead Information */}
          {selectedVerification && (
            <Box sx={{ mt: 3, mb: 1 }}>
              <Typography variant="h6" gutterBottom>
                Additional Information
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Country"
                    value={editableCountry}
                    onChange={(e) => setEditableCountry(e.target.value)}
                    placeholder="Enter country"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Gender</InputLabel>
                    <Select
                      value={editableGender}
                      label="Gender"
                      onChange={(e) => setEditableGender(e.target.value)}
                    >
                      <MenuItem value="not_defined">Not Defined</MenuItem>
                      <MenuItem value="male">Male</MenuItem>
                      <MenuItem value="female">Female</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Date of Birth"
                    type="date"
                    value={editableDob}
                    onChange={(e) => setEditableDob(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Address"
                    value={editableAddress}
                    onChange={(e) => setEditableAddress(e.target.value)}
                    placeholder="Enter address"
                  />
                </Grid>
              </Grid>
            </Box>
          )}

          <TextField
            fullWidth
            multiline
            rows={3}
            label="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any notes about this approval..."
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setApproveDialog(false);
              setEditableEmail("");
              setEditablePhone("");
              setEditableFullName("");
              setEditableCountry("Bulgaria");
              setEditableAddress("");
              setEditableGender("not_defined");
              setEditableDob("");
              setNotes("");
            }}
            disabled={processing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleApprove}
            color="success"
            variant="contained"
            disabled={processing || (isExternalNA && !editableFullName.trim())}
            startIcon={<ApproveIcon />}
          >
            {processing ? "Processing..." : "Approve & Create Lead"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog
        open={rejectDialog}
        onClose={() => setRejectDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Reject Verification</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Please provide a reason for rejecting this verification:
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Rejection Reason"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Explain why this verification is being rejected... (minimum 10 characters)"
            required
            error={
              rejectionReason.trim().length > 0 &&
              rejectionReason.trim().length < 10
            }
            helperText={
              rejectionReason.trim().length > 0 &&
              rejectionReason.trim().length < 10
                ? `${
                    rejectionReason.trim().length
                  }/10 - Minimum 10 characters required`
                : `${rejectionReason.length}/500 characters`
            }
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialog(false)} disabled={processing}>
            Cancel
          </Button>
          <Button
            onClick={handleReject}
            color="error"
            variant="contained"
            disabled={processing || rejectionReason.trim().length < 10}
            startIcon={<RejectIcon />}
          >
            {processing ? "Processing..." : "Reject"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={() => setNotification({ ...notification, open: false })}
      >
        <Alert
          onClose={() => setNotification({ ...notification, open: false })}
          severity={notification.severity}
          sx={{ width: "100%" }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default VerificationsPage;
