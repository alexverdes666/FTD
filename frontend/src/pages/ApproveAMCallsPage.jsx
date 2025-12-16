import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  Grid,
  Card,
  CardContent,
  CardActions,
  Divider,
} from "@mui/material";
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  ViewList as ViewListIcon,
  ViewModule as ViewModuleIcon,
} from "@mui/icons-material";
import { useSelector } from "react-redux";
import { selectUser } from "../store/slices/authSlice";
import api from "../services/api";

const ApproveAMCallsPage = () => {
  const user = useSelector(selectUser);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [processingId, setProcessingId] = useState(null);
  const [viewMode, setViewMode] = useState("table"); // 'table' or 'card'

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get("/call-change-requests/pending");
      setRequests(response.data.data || []);
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to fetch pending requests"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleApprove = async (requestId) => {
    try {
      setProcessingId(requestId);
      setError(null);
      await api.post(`/call-change-requests/${requestId}/approve`);
      setSuccess("Call change request approved successfully!");
      fetchRequests();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to approve request");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId) => {
    try {
      setProcessingId(requestId);
      setError(null);
      await api.post(`/call-change-requests/${requestId}/reject`);
      setSuccess("Call change request rejected successfully!");
      fetchRequests();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to reject request");
    } finally {
      setProcessingId(null);
    }
  };

  const handleViewModeChange = (event, newMode) => {
    if (newMode !== null) {
      setViewMode(newMode);
    }
  };

  const renderCallNumber = (callNumber, size = 32) => {
    if (!callNumber) {
      return (
        <Chip
          label="NONE"
          size="small"
          color="default"
          variant="outlined"
          sx={{ fontWeight: "bold" }}
        />
      );
    }

    const num = callNumber.replace(/\D/g, "");

    // Handle double-digit numbers (like 10)
    if (num.length > 1) {
      return (
        <Box sx={{ display: "inline-flex", alignItems: "center" }}>
          {num.split("").map((digit, index) => (
            <img
              key={index}
              src={`/numbers/${digit}.png`}
              alt={digit}
              style={{ width: size, height: size, verticalAlign: "middle" }}
            />
          ))}
        </Box>
      );
    }

    return (
      <img
        src={`/numbers/${num}.png`}
        alt={callNumber}
        style={{ width: size, height: size, verticalAlign: "middle" }}
      />
    );
  };

  const filteredRequests = requests.filter((request) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      request.leadId?.firstName?.toLowerCase().includes(term) ||
      request.leadId?.lastName?.toLowerCase().includes(term) ||
      request.requestedBy?.fullName?.toLowerCase().includes(term) ||
      request.orderId?.requester?.fullName?.toLowerCase().includes(term) ||
      request.orderId?.selectedClientNetwork?.name?.toLowerCase().includes(term)
    );
  });

  const renderCardView = () => (
    <Grid container spacing={3}>
      {filteredRequests.map((request) => (
        <Grid item xs={12} sm={6} md={4} key={request._id}>
          <Card
            elevation={2}
            sx={{ height: "100%", display: "flex", flexDirection: "column" }}
          >
            <CardContent sx={{ flexGrow: 1, textAlign: "center" }}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 1,
                  mb: 2,
                }}
              >
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  sx={{ fontStyle: "italic" }}
                >
                  {request.orderId?.createdAt
                    ? new Date(request.orderId.createdAt).toLocaleDateString()
                    : "N/A"}
                </Typography>
                <Chip
                  label={request.orderId?.selectedClientNetwork?.name || "N/A"}
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{ fontWeight: "bold" }}
                />
              </Box>

              <Typography
                variant="h6"
                gutterBottom
                sx={{ fontWeight: "bold", textAlign: "center" }}
              >
                {request.leadId?.firstName && request.leadId?.lastName
                  ? `${request.leadId.firstName} ${request.leadId.lastName}`
                  : "Unknown Lead"}
              </Typography>

              <Divider sx={{ my: 1.5 }} />

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 2,
                  textAlign: "center",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                    sx={{ fontWeight: "bold", textTransform: "uppercase" }}
                  >
                    Current Call
                  </Typography>
                  <Box sx={{ mt: 0.5 }}>
                    {renderCallNumber(request.currentCallNumber, 40)}
                  </Box>
                  {request.currentVerified && (
                    <Chip
                      label="VERIFIED"
                      size="small"
                      color="success"
                      variant="outlined"
                      sx={{ mt: 0.5, fontWeight: "bold", fontSize: "0.7rem" }}
                    />
                  )}
                </Box>
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                    sx={{ fontWeight: "bold", textTransform: "uppercase" }}
                  >
                    Requested Call
                  </Typography>
                  <Box sx={{ mt: 0.5 }}>
                    {renderCallNumber(request.requestedCallNumber, 40)}
                  </Box>
                  {request.requestedVerified && (
                    <Chip
                      label="VERIFIED"
                      size="small"
                      color="success"
                      variant="filled"
                      sx={{ mt: 0.5, fontWeight: "bold", fontSize: "0.7rem" }}
                    />
                  )}
                </Box>
              </Box>

              <Box sx={{ mt: 2, textAlign: "center" }}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  display="block"
                >
                  <span style={{ fontWeight: 600 }}>AM:</span>{" "}
                  {request.orderId?.requester?.fullName || "N/A"}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  display="block"
                >
                  <span style={{ fontWeight: 600 }}>Agent:</span>{" "}
                  {request.requestedBy?.fullName || "Unknown"}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                  sx={{ mt: 1, fontStyle: "italic" }}
                >
                  Requested: {new Date(request.createdAt).toLocaleString()}
                </Typography>
              </Box>
            </CardContent>
            <CardActions sx={{ justifyContent: "center", p: 2, pt: 0 }}>
              <Tooltip title="Reject">
                <IconButton
                  color="error"
                  onClick={() => handleReject(request._id)}
                  disabled={processingId === request._id}
                >
                  <RejectIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Approve">
                <IconButton
                  color="success"
                  onClick={() => handleApprove(request._id)}
                  disabled={processingId === request._id}
                >
                  <ApproveIcon />
                </IconButton>
              </Tooltip>
            </CardActions>
          </Card>
        </Grid>
      ))}
    </Grid>
  );

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "60vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Typography variant="h4" gutterBottom>
          Approve AM Call Changes
        </Typography>
        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={handleViewModeChange}
            aria-label="view mode"
            size="small"
          >
            <ToggleButton value="table" aria-label="table view">
              <Tooltip title="Table View">
                <ViewListIcon />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="card" aria-label="card view">
              <Tooltip title="Card View">
                <ViewModuleIcon />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchRequests} color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert
          severity="success"
          sx={{ mb: 3 }}
          onClose={() => setSuccess(null)}
        >
          {success}
        </Alert>
      )}

      <Paper
        sx={{
          p: 3,
          mb: 3,
          backgroundColor: viewMode === "card" ? "transparent" : undefined,
          boxShadow: viewMode === "card" ? "none" : undefined,
        }}
      >
        <TextField
          fullWidth
          placeholder="Search by lead, agent, AM, or client network..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 3 }}
        />

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 2, textAlign: "center" }}
        >
          {filteredRequests.length} pending request
          {filteredRequests.length !== 1 ? "s" : ""}
        </Typography>

        {filteredRequests.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 6 }}>
            <Typography variant="h6" color="text.secondary">
              {searchTerm
                ? "No matching requests found"
                : "No pending call change requests"}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {searchTerm
                ? "Try adjusting your search criteria"
                : "All call change requests have been processed"}
            </Typography>
          </Box>
        ) : viewMode === "table" ? (
          <TableContainer component={Paper} elevation={0}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell align="center">Order Date</TableCell>
                  <TableCell align="center">Lead Name</TableCell>
                  <TableCell align="center">Client Network</TableCell>
                  <TableCell align="center">Account Manager</TableCell>
                  <TableCell align="center">Agent</TableCell>
                  <TableCell align="center">Current Call</TableCell>
                  <TableCell align="center">Requested Call</TableCell>
                  <TableCell align="center">Current Verified</TableCell>
                  <TableCell align="center">Requested Verified</TableCell>
                  <TableCell align="center">Request Date</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRequests.map((request) => (
                  <TableRow key={request._id} hover>
                    <TableCell align="center">
                      <Typography variant="body2" fontWeight="medium">
                        {request.orderId?.createdAt
                          ? new Date(
                              request.orderId.createdAt
                            ).toLocaleDateString()
                          : "N/A"}
                      </Typography>
                      {request.orderId?.createdAt && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          display="block"
                        >
                          {new Date(
                            request.orderId.createdAt
                          ).toLocaleTimeString()}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2">
                        {request.leadId?.firstName && request.leadId?.lastName
                          ? `${request.leadId.firstName} ${request.leadId.lastName}`
                          : "N/A"}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2">
                        {request.orderId?.selectedClientNetwork?.name || "N/A"}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2">
                        {request.orderId?.requester?.fullName || "N/A"}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2">
                        {request.requestedBy?.fullName || "Unknown"}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      {renderCallNumber(request.currentCallNumber, 28)}
                    </TableCell>
                    <TableCell align="center">
                      {renderCallNumber(request.requestedCallNumber, 28)}
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={request.currentVerified ? "Yes" : "No"}
                        size="small"
                        color={request.currentVerified ? "success" : "default"}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={request.requestedVerified ? "Yes" : "No"}
                        size="small"
                        color={
                          request.requestedVerified ? "success" : "default"
                        }
                        variant={
                          request.currentVerified !== request.requestedVerified
                            ? "filled"
                            : "outlined"
                        }
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2" sx={{ fontSize: "0.875rem" }}>
                        {new Date(request.createdAt).toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Box
                        sx={{
                          display: "flex",
                          gap: 1,
                          justifyContent: "center",
                        }}
                      >
                        <Tooltip title="Approve">
                          <span>
                            <IconButton
                              color="success"
                              size="small"
                              onClick={() => handleApprove(request._id)}
                              disabled={processingId === request._id}
                            >
                              <ApproveIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Reject">
                          <span>
                            <IconButton
                              color="error"
                              size="small"
                              onClick={() => handleReject(request._id)}
                              disabled={processingId === request._id}
                            >
                              <RejectIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          renderCardView()
        )}
      </Paper>
    </Box>
  );
};

export default ApproveAMCallsPage;
