import React, { useState, useEffect, useCallback } from "react";
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
  Stack,
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Business as BrokerIcon,
  Payment as PSPIcon,
  Language as WebIcon,
} from "@mui/icons-material";
import { useSelector } from "react-redux";
import { selectUser } from "../store/slices/authSlice";
import api from "../services/api";
import toast from "react-hot-toast";
import PSPSelector from "../components/accountManagement/PSPSelector";
import CommentButton from "../components/CommentButton";

const ClientBrokerProfilePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useSelector(selectUser);

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [pspDialogOpen, setPspDialogOpen] = useState(false);
  const [pspLoading, setPspLoading] = useState(false);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editData, setEditData] = useState({ name: "", domain: "", description: "" });
  const [editLoading, setEditLoading] = useState(false);

  const isAdmin = user?.role === "admin";

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/client-brokers/${id}/profile`);
      setProfile(response.data.data);
      setEditData({
        name: response.data.data.name,
        domain: response.data.data.domain || "",
        description: response.data.data.description || "",
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

  // PSP handlers
  const handleAddPSP = async (pspId) => {
    try {
      setPspLoading(true);
      await api.post(`/client-brokers/${id}/psps`, { pspId });
      toast.success("PSP added to broker");
      setPspDialogOpen(false);
      fetchProfile();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to add PSP");
    } finally {
      setPspLoading(false);
    }
  };

  const handleRemovePSP = async (pspId) => {
    if (!window.confirm("Remove this PSP from the broker?")) return;
    try {
      await api.delete(`/client-brokers/${id}/psps/${pspId}`);
      toast.success("PSP removed");
      fetchProfile();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to remove PSP");
    }
  };

  // Edit broker handlers
  const handleEditBroker = async () => {
    try {
      setEditLoading(true);
      await api.put(`/client-brokers/${id}`, editData);
      toast.success("Broker updated");
      setEditDialogOpen(false);
      fetchProfile();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update broker");
    } finally {
      setEditLoading(false);
    }
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
        <Alert severity="error">Broker not found</Alert>
      </Box>
    );
  }

  const existingPspIds = profile.psps?.map((p) => p._id) || [];

  return (
    <Box>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
          <IconButton onClick={() => navigate(-1)}>
            <BackIcon />
          </IconButton>
          <BrokerIcon sx={{ fontSize: 40, color: "primary.main" }} />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h5" fontWeight="bold">
              {profile.name}
            </Typography>
            {profile.domain && (
              <Link
                href={profile.domain.startsWith("http") ? profile.domain : `https://${profile.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
              >
                <WebIcon fontSize="small" />
                {profile.domain}
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
              onClick={() => setEditDialogOpen(true)}
            >
              Edit
            </Button>
          )}
          <CommentButton
            targetType="client_broker"
            targetId={profile._id}
            targetName={profile.name}
          />
        </Box>

        {/* Summary Stats */}
        <Grid container spacing={2}>
          <Grid item xs={6} sm={3}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: "center", py: 1 }}>
                <Typography variant="h4" color="primary.main">
                  {profile.psps?.length || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  PSPs
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: "center", py: 1 }}>
                <Typography variant="h4" color="primary.main">
                  {profile.totalLeadsAssigned || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Leads
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: "center", py: 1 }}>
                <Typography variant="h4" color="primary.main">
                  {profile.assignedLeads?.length || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Current Leads
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: "center", py: 1 }}>
                <Typography variant="h4" color="warning.main">
                  {profile.unresolvedCommentsCount || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Open Comments
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>

      <Grid container spacing={3}>
        {/* PSPs Section */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Typography variant="h6">
                <PSPIcon sx={{ mr: 1, verticalAlign: "middle" }} />
                Payment Service Providers (PSPs)
              </Typography>
              {isAdmin && (
                <Button size="small" startIcon={<AddIcon />} onClick={() => setPspDialogOpen(true)}>
                  Add
                </Button>
              )}
            </Box>
            {profile.psps?.length ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Website</TableCell>
                      <TableCell>Status</TableCell>
                      {isAdmin && <TableCell align="right">Actions</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {profile.psps.map((psp) => (
                      <TableRow key={psp._id} hover>
                        <TableCell>
                          <Typography fontWeight="medium">{psp.name}</Typography>
                        </TableCell>
                        <TableCell>
                          {psp.website ? (
                            <Link
                              href={psp.website.startsWith("http") ? psp.website : `https://${psp.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {psp.website}
                            </Link>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={psp.isActive ? "Active" : "Inactive"}
                            color={psp.isActive ? "success" : "default"}
                            size="small"
                          />
                        </TableCell>
                        {isAdmin && (
                          <TableCell align="right">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleRemovePSP(psp._id)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
                No PSPs linked to this broker
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* Comments Section */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Comments ({profile.commentsCount || 0})
            </Typography>
            {profile.comments?.length ? (
              <Stack spacing={1}>
                {profile.comments.map((comment) => (
                  <Box
                    key={comment._id}
                    sx={{
                      p: 2,
                      border: 1,
                      borderColor: comment.isResolved ? "success.light" : "warning.light",
                      borderRadius: 1,
                      backgroundColor: comment.isResolved
                        ? "rgba(76, 175, 80, 0.05)"
                        : "rgba(255, 152, 0, 0.05)",
                    }}
                  >
                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                      <Typography variant="body2" fontWeight="bold">
                        {comment.agent?.fullName || "Unknown"}
                      </Typography>
                      <Chip
                        label={comment.isResolved ? "Resolved" : "Open"}
                        color={comment.isResolved ? "success" : "warning"}
                        size="small"
                      />
                    </Box>
                    <Typography variant="body2">{comment.comment}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                      {new Date(comment.createdAt).toLocaleString()}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            ) : (
              <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
                No comments yet
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* PSP Selector Dialog */}
      <PSPSelector
        open={pspDialogOpen}
        onClose={() => setPspDialogOpen(false)}
        onSelect={handleAddPSP}
        excludeIds={existingPspIds}
        loading={pspLoading}
      />

      {/* Edit Broker Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Client Broker</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <TextField
              label="Name"
              value={editData.name}
              onChange={(e) => setEditData({ ...editData, name: e.target.value })}
              fullWidth
            />
            <TextField
              label="Domain/Website"
              value={editData.domain}
              onChange={(e) => setEditData({ ...editData, domain: e.target.value })}
              fullWidth
            />
            <TextField
              label="Description"
              value={editData.description}
              onChange={(e) => setEditData({ ...editData, description: e.target.value })}
              fullWidth
              multiline
              rows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleEditBroker} variant="contained" disabled={editLoading}>
            {editLoading ? <CircularProgress size={20} /> : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ClientBrokerProfilePage;
