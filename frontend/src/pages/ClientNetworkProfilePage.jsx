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
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Menu,
  MenuItem,
  Divider,
  Tooltip,
  Link,
} from "@mui/material";
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Person as PersonIcon,
  Hub as NetworkIcon,
  Link as LinkIcon,
  Comment as CommentIcon,
  Handshake as DealsIcon,
  Business as BrokerIcon,
  Payment as PSPIcon,
} from "@mui/icons-material";
import { useSelector } from "react-redux";
import { selectUser } from "../store/slices/authSlice";
import api from "../services/api";
import toast from "react-hot-toast";
import EmployeeForm, { getPositionLabel } from "../components/accountManagement/EmployeeForm";
import ReferenceSelector from "../components/accountManagement/ReferenceSelector";
import CrmNetworkOrdersTable from "../components/crm/CrmNetworkOrdersTable";
import CommentsList from "../components/accountManagement/CommentsList";
import { createComment as createAgentComment } from "../services/agentComments";
import chatService from "../services/chatService";

const ClientNetworkProfilePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useSelector(selectUser);

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [employeeLoading, setEmployeeLoading] = useState(false);

  const [referenceDialogOpen, setReferenceDialogOpen] = useState(false);
  const [referenceLoading, setReferenceLoading] = useState(false);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editData, setEditData] = useState({ name: "", description: "" });
  const [editLoading, setEditLoading] = useState(false);

  const [activeTab, setActiveTab] = useState(0);
  const [pastedTelegram, setPastedTelegram] = useState("");

  // Comment form states
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentImages, setCommentImages] = useState([]);
  const [commentLoading, setCommentLoading] = useState(false);

  const [dealTypeAnchor, setDealTypeAnchor] = useState(null);

  const isAdmin = user?.role === "admin";
  const canManageCrm = ["admin", "affiliate_manager"].includes(user?.role);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/client-networks/${id}/profile`);
      setProfile(response.data.data);
      setEditData({
        name: response.data.data.name,
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

  // Paste handler: Ctrl+V on Employees tab opens Add dialog with clipboard as telegram username
  useEffect(() => {
    const handlePaste = async (e) => {
      // Only on Employees tab (tab 0), and not when a dialog or input is focused
      if (activeTab !== 0) return;
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || document.activeElement?.isContentEditable) return;
      if (employeeDialogOpen) return;

      const text = e.clipboardData?.getData("text")?.trim()?.replace(/^@+/, "");
      if (text) {
        setPastedTelegram(text);
        setEditingEmployee(null);
        setEmployeeDialogOpen(true);
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [activeTab, employeeDialogOpen]);

  // Employee handlers
  const handleAddEmployee = () => {
    setPastedTelegram("");
    setEditingEmployee(null);
    setEmployeeDialogOpen(true);
  };

  const handleEditEmployee = (employee) => {
    setEditingEmployee(employee);
    setEmployeeDialogOpen(true);
  };

  const handleEmployeeSubmit = async (data) => {
    try {
      setEmployeeLoading(true);
      if (editingEmployee) {
        await api.put(`/client-networks/${id}/employees/${editingEmployee._id}`, data);
        toast.success("Employee updated");
      } else {
        await api.post(`/client-networks/${id}/employees`, data);
        toast.success("Employee added");
      }
      setEmployeeDialogOpen(false);
      fetchProfile();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save employee");
    } finally {
      setEmployeeLoading(false);
    }
  };

  const handleDeleteEmployee = async (empId) => {
    if (!window.confirm("Delete this employee?")) return;
    try {
      await api.delete(`/client-networks/${id}/employees/${empId}`);
      toast.success("Employee removed");
      fetchProfile();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to remove employee");
    }
  };

  // Reference handlers
  const handleAddReference = async (data) => {
    try {
      setReferenceLoading(true);
      await api.post(`/client-networks/${id}/references`, data);
      toast.success("Reference added");
      setReferenceDialogOpen(false);
      fetchProfile();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to add reference");
    } finally {
      setReferenceLoading(false);
    }
  };

  const handleDeleteReference = async (refId) => {
    if (!window.confirm("Remove this reference?")) return;
    try {
      await api.delete(`/client-networks/${id}/references/${refId}`);
      toast.success("Reference removed");
      fetchProfile();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to remove reference");
    }
  };

  // Edit network handlers
  const handleEditNetwork = async () => {
    try {
      setEditLoading(true);
      await api.put(`/client-networks/${id}`, editData);
      toast.success("Network updated");
      setEditDialogOpen(false);
      fetchProfile();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update network");
    } finally {
      setEditLoading(false);
    }
  };

  // Comment handlers
  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    const previews = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setCommentImages((prev) => [...prev, ...previews]);
  };

  const handleRemoveImage = (index) => {
    setCommentImages((prev) => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  const handleCommentSubmit = async () => {
    if (!commentText.trim()) {
      toast.error("Please enter a comment");
      return;
    }
    try {
      setCommentLoading(true);

      // Upload images first
      const imageIds = [];
      for (const img of commentImages) {
        const result = await chatService.uploadImage(img.file);
        if (result?.data?._id) {
          imageIds.push(result.data._id);
        }
      }

      await createAgentComment({
        targetType: "client_network",
        targetId: id,
        comment: commentText,
        status: "other",
        images: imageIds,
      });

      toast.success("Comment added");
      setCommentText("");
      setCommentImages([]);
      setShowCommentForm(false);
      fetchProfile();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to add comment");
    } finally {
      setCommentLoading(false);
    }
  };

  // Deal type handler
  const handleDealTypeChange = async (value) => {
    setDealTypeAnchor(null);
    try {
      await api.put(`/client-networks/${id}`, { dealType: value });
      toast.success("Deal type updated");
      fetchProfile();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update deal type");
    }
  };

  const getDealTypeLabel = (type) => {
    const labels = { buy: "Buy", sell: "Sell", both: "Both" };
    return labels[type] || "-";
  };

  const getDealTypeColor = (type) => {
    const colors = { buy: "success", sell: "error", both: "info" };
    return colors[type] || "default";
  };

  const handleCancelComment = () => {
    setCommentText("");
    commentImages.forEach((img) => URL.revokeObjectURL(img.preview));
    setCommentImages([]);
    setShowCommentForm(false);
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
        <Alert severity="error">Network not found</Alert>
      </Box>
    );
  }

  const existingRefIds = [
    id, // Exclude self
    ...(profile.references?.map((r) => r.clientNetwork?._id) || []),
  ];

  return (
    <Box>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
          <IconButton onClick={() => navigate("/crm", { state: { tab: 0 } })}>
            <BackIcon />
          </IconButton>
          <NetworkIcon sx={{ fontSize: 40, color: "primary.main" }} />
          <Box sx={{ flexGrow: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="h5" fontWeight="bold">
                {profile.name}
              </Typography>
              <Tooltip title={canManageCrm ? "Click to change deal type" : "Deal type"}>
                <Chip
                  label={getDealTypeLabel(profile.dealType)}
                  color={getDealTypeColor(profile.dealType)}
                  size="small"
                  variant={profile.dealType ? "filled" : "outlined"}
                  onClick={canManageCrm ? (e) => setDealTypeAnchor(e.currentTarget) : undefined}
                  sx={canManageCrm ? { cursor: "pointer" } : {}}
                />
              </Tooltip>
              <Menu
                anchorEl={dealTypeAnchor}
                open={Boolean(dealTypeAnchor)}
                onClose={() => setDealTypeAnchor(null)}
              >
                <MenuItem onClick={() => handleDealTypeChange("buy")}>Buy</MenuItem>
                <MenuItem onClick={() => handleDealTypeChange("sell")}>Sell</MenuItem>
                <MenuItem onClick={() => handleDealTypeChange("both")}>Both</MenuItem>
                <Divider />
                <MenuItem onClick={() => handleDealTypeChange(null)}>- (Not defined)</MenuItem>
              </Menu>
            </Box>
            <Typography variant="body2" color="text.secondary">
              {profile.description || "No description"}
            </Typography>
          </Box>
          <Chip
            label={profile.isActive ? "Active" : "Inactive"}
            color={profile.isActive ? "success" : "default"}
          />
          {canManageCrm && (
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => setEditDialogOpen(true)}
            >
              Edit
            </Button>
          )}
        </Box>

        {/* Summary Stats */}
        <Grid container spacing={2}>
          <Grid item xs={6} sm={3}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: "center", py: 1 }}>
                <Typography variant="h4" color="primary.main">
                  {profile.employees?.length || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Employees
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: "center", py: 1 }}>
                <Typography variant="h4" color="primary.main">
                  {(profile.references?.length || 0) + (profile.referencedBy?.length || 0)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  References
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: "center", py: 1 }}>
                <Typography variant="h4" color="primary.main">
                  {profile.dealsSummary?.totalOrders || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Deals
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

      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(e, v) => setActiveTab(v)}
          variant="fullWidth"
        >
          <Tab icon={<PersonIcon />} iconPosition="start" label={`Employees (${profile.employees?.length || 0})`} />
          <Tab icon={<LinkIcon />} iconPosition="start" label={`References (${(profile.references?.length || 0) + (profile.referencedBy?.length || 0)})`} />
          <Tab icon={<CommentIcon />} iconPosition="start" label={`Comments (${profile.unresolvedCommentsCount || 0})`} />
          <Tab icon={<DealsIcon />} iconPosition="start" label={`CRM Deals (${profile.dealsSummary?.totalOrders || 0})`} />
          <Tab icon={<BrokerIcon />} iconPosition="start" label={`Brokers & PSPs (${(profile.usedBrokers?.length || 0) + (profile.usedPsps?.length || 0)})`} />
        </Tabs>
      </Paper>

      {/* Employees Tab */}
      {activeTab === 0 && (
        <Paper sx={{ p: 2 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="h6">Employees</Typography>
            {canManageCrm && (
              <Button size="small" startIcon={<AddIcon />} onClick={handleAddEmployee}>
                Add
              </Button>
            )}
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Position</TableCell>
                  <TableCell>Telegram</TableCell>
                  {canManageCrm && <TableCell align="right">Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {profile.employees?.length ? (
                  profile.employees.map((emp) => (
                    <TableRow key={emp._id} hover>
                      <TableCell>{emp.name}</TableCell>
                      <TableCell>
                        <Chip label={getPositionLabel(emp.position)} size="small" />
                      </TableCell>
                      <TableCell>{emp.telegramUsername ? `@${emp.telegramUsername}` : "-"}</TableCell>
                      {canManageCrm && (
                        <TableCell align="right">
                          <IconButton size="small" onClick={() => handleEditEmployee(emp)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteEmployee(emp._id)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={canManageCrm ? 4 : 3} align="center">
                      No employees
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* References Tab */}
      {activeTab === 1 && (
        <Paper sx={{ p: 2 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="h6">References</Typography>
            {canManageCrm && (
              <Button size="small" startIcon={<AddIcon />} onClick={() => setReferenceDialogOpen(true)}>
                Add
              </Button>
            )}
          </Box>

          {/* Added by this network */}
          {profile.references?.length > 0 && (
            <>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                Added as reference ({profile.references.length})
              </Typography>
              <Stack spacing={1} sx={{ mb: 2 }}>
                {profile.references.map((ref) => (
                  <Box
                    key={ref._id}
                    sx={{
                      p: 1.5,
                      border: 1,
                      borderColor: "divider",
                      borderRadius: 1,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Box>
                      <Typography fontWeight="medium">
                        {ref.clientNetwork?.name || "Unknown"}
                      </Typography>
                      {ref.notes && (
                        <Typography variant="body2" color="text.secondary">
                          {ref.notes}
                        </Typography>
                      )}
                    </Box>
                    {canManageCrm && (
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteReference(ref._id)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                ))}
              </Stack>
            </>
          )}

          {/* Referenced by other networks */}
          {profile.referencedBy?.length > 0 && (
            <>
              {profile.references?.length > 0 && <Divider sx={{ my: 2 }} />}
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                Referenced by ({profile.referencedBy.length})
              </Typography>
              <Stack spacing={1}>
                {profile.referencedBy.map((ref) => (
                  <Box
                    key={ref._id}
                    sx={{
                      p: 1.5,
                      border: 1,
                      borderColor: "info.light",
                      borderRadius: 1,
                      backgroundColor: "rgba(33, 150, 243, 0.04)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Box>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography fontWeight="medium">
                          {ref.clientNetwork?.name || "Unknown"}
                        </Typography>
                        <Chip label="Referenced by" size="small" variant="outlined" color="info" />
                      </Box>
                      {ref.notes && (
                        <Typography variant="body2" color="text.secondary">
                          {ref.notes}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                ))}
              </Stack>
            </>
          )}

          {!profile.references?.length && !profile.referencedBy?.length && (
            <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
              No references
            </Typography>
          )}
        </Paper>
      )}

      {/* Comments Tab */}
      {activeTab === 2 && (
        <Paper sx={{ p: 2 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="h6">Comments</Typography>
            {!showCommentForm && (
              <Button size="small" startIcon={<AddIcon />} onClick={() => setShowCommentForm(true)}>
                Add
              </Button>
            )}
          </Box>

          {showCommentForm && (
            <Box sx={{ mb: 3, p: 2, border: 1, borderColor: "divider", borderRadius: 1 }}>
              <TextField
                label="Comment"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                multiline
                rows={3}
                fullWidth
                sx={{ mb: 2 }}
              />
              {commentImages.length > 0 && (
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
                  {commentImages.map((img, idx) => (
                    <Box key={idx} sx={{ position: "relative" }}>
                      <Box
                        component="img"
                        src={img.preview}
                        sx={{
                          width: 80,
                          height: 80,
                          objectFit: "cover",
                          borderRadius: 1,
                          border: 1,
                          borderColor: "divider",
                        }}
                      />
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveImage(idx)}
                        sx={{
                          position: "absolute",
                          top: -8,
                          right: -8,
                          backgroundColor: "background.paper",
                          boxShadow: 1,
                          "&:hover": { backgroundColor: "error.light", color: "white" },
                        }}
                      >
                        <DeleteIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              )}
              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  variant="contained"
                  onClick={handleCommentSubmit}
                  disabled={commentLoading || !commentText.trim()}
                >
                  {commentLoading ? <CircularProgress size={20} /> : "Add Comment"}
                </Button>
                <Button variant="outlined" onClick={handleCancelComment} disabled={commentLoading}>
                  Cancel
                </Button>
                <Button component="label" variant="text" size="small">
                  Attach Images
                  <input
                    type="file"
                    hidden
                    multiple
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleImageSelect}
                  />
                </Button>
              </Stack>
            </Box>
          )}

          <CommentsList comments={profile.comments || []} />
        </Paper>
      )}

      {/* CRM Deals Tab */}
      {activeTab === 3 && (
        <Paper sx={{ p: 2 }}>
          <CrmNetworkOrdersTable networkId={id} />
        </Paper>
      )}

      {/* Brokers & PSPs Tab */}
      {activeTab === 4 && (
        <Paper sx={{ p: 2 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Typography variant="subtitle1" fontWeight={600}>
                  <BrokerIcon sx={{ mr: 1, verticalAlign: "middle", fontSize: 20 }} />
                  Used Client Brokers ({profile.usedBrokers?.length || 0})
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Assigned to leads from this network
                </Typography>
              </Box>
              <TableContainer sx={{ maxHeight: 400, overflow: "auto" }}>
                {profile.usedBrokers?.length ? (
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Domain</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {profile.usedBrokers.map((broker) => (
                        <TableRow key={broker._id} hover>
                          <TableCell>
                            <Typography fontWeight="medium" sx={{ fontSize: "0.85rem" }}>{broker.name}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {broker.domain || "-"}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={broker.isActive ? "Active" : "Inactive"}
                              color={broker.isActive ? "success" : "default"}
                              size="small"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
                    No brokers assigned yet
                  </Typography>
                )}
              </TableContainer>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Typography variant="subtitle1" fontWeight={600}>
                  <PSPIcon sx={{ mr: 1, verticalAlign: "middle", fontSize: 20 }} />
                  Used PSPs ({profile.usedPsps?.length || 0})
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  From deposit confirmations
                </Typography>
              </Box>
              <TableContainer sx={{ maxHeight: 400, overflow: "auto" }}>
                {profile.usedPsps?.length ? (
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Website</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {profile.usedPsps.map((psp) => (
                        <TableRow key={psp._id} hover>
                          <TableCell>
                            <Typography fontWeight="medium" sx={{ fontSize: "0.85rem" }}>{psp.name}</Typography>
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
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
                    No PSPs used yet
                  </Typography>
                )}
              </TableContainer>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Employee Dialog */}
      <EmployeeForm
        open={employeeDialogOpen}
        onClose={() => { setEmployeeDialogOpen(false); setPastedTelegram(""); }}
        onSubmit={handleEmployeeSubmit}
        employee={editingEmployee}
        loading={employeeLoading}
        defaultTelegramUsername={pastedTelegram}
      />

      {/* Reference Dialog */}
      <ReferenceSelector
        open={referenceDialogOpen}
        onClose={() => setReferenceDialogOpen(false)}
        onSelect={handleAddReference}
        excludeIds={existingRefIds}
        loading={referenceLoading}
      />

      {/* Edit Network Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Client Network</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <TextField
              label="Name"
              value={editData.name}
              onChange={(e) => setEditData({ ...editData, name: e.target.value })}
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
          <Button onClick={handleEditNetwork} variant="contained" disabled={editLoading}>
            {editLoading ? <CircularProgress size={20} /> : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ClientNetworkProfilePage;
