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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Link,
} from "@mui/material";
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  Payment as PSPIcon,
  Business as BrokerIcon,
  Language as WebIcon,
} from "@mui/icons-material";
import { useSelector } from "react-redux";
import { selectUser } from "../store/slices/authSlice";
import api from "../services/api";
import toast from "react-hot-toast";
import CommentButton from "../components/CommentButton";

const PSPProfilePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useSelector(selectUser);

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editData, setEditData] = useState({ name: "", website: "", description: "" });
  const [editLoading, setEditLoading] = useState(false);

  const isAdmin = user?.role === "admin";

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/psps/${id}/profile`);
      setProfile(response.data.data);
      setEditData({
        name: response.data.data.name,
        website: response.data.data.website || "",
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
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
          <IconButton onClick={() => navigate(-1)}>
            <BackIcon />
          </IconButton>
          <PSPIcon sx={{ fontSize: 40, color: "primary.main" }} />
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
              onClick={() => setEditDialogOpen(true)}
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

        {/* Summary Stats */}
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
              label="Name"
              value={editData.name}
              onChange={(e) => setEditData({ ...editData, name: e.target.value })}
              fullWidth
            />
            <TextField
              label="Website"
              value={editData.website}
              onChange={(e) => setEditData({ ...editData, website: e.target.value })}
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
          <Button onClick={handleEditPSP} variant="contained" disabled={editLoading}>
            {editLoading ? <CircularProgress size={20} /> : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PSPProfilePage;
