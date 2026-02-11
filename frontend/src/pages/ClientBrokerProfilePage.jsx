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
  TablePagination,
  Tooltip,
} from "@mui/material";
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Business as BrokerIcon,
  Payment as PSPIcon,
  Language as WebIcon,
  ChevronRight as ChevronRightIcon,
} from "@mui/icons-material";
import { useSelector } from "react-redux";
import { selectUser } from "../store/slices/authSlice";
import api from "../services/api";
import toast from "react-hot-toast";
import PSPSelector from "../components/accountManagement/PSPSelector";
import CommentButton from "../components/CommentButton";

const leadsTableSx = {
  tableLayout: "fixed",
  "& .MuiTableHead-root .MuiTableCell-head": {
    background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
    color: "#fff",
    fontWeight: 700,
    fontSize: "0.65rem",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    borderBottom: "2px solid #3b82f6",
    py: 0.4,
    px: 1,
    lineHeight: 1.1,
  },
  "& .MuiTableBody-root .MuiTableCell-root": {
    py: 0.25,
    px: 1,
    fontSize: "0.78rem",
    lineHeight: 1.3,
  },
  "& .MuiTableBody-root .MuiTableRow-root:nth-of-type(even)": {
    bgcolor: "rgba(0, 0, 0, 0.015)",
  },
  "& .MuiTableBody-root .MuiTableRow-root:hover": {
    bgcolor: "rgba(25, 118, 210, 0.06) !important",
    transition: "background-color 0.15s ease",
  },
  "& .MuiChip-root": {
    height: "18px",
    fontSize: "0.65rem",
  },
};

const getLeadTypeColor = (type) => {
  const colors = { ftd: "error", filler: "info", cold: "default" };
  return colors[type] || "default";
};

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

  // Orders/leads state
  const [orderLeads, setOrderLeads] = useState([]);
  const [orderLeadsLoading, setOrderLeadsLoading] = useState(false);
  const [orderLeadsPagination, setOrderLeadsPagination] = useState({
    current: 1,
    pages: 1,
    total: 0,
    limit: 50,
  });

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

  const fetchOrderLeads = useCallback(
    async (page = 1) => {
      try {
        setOrderLeadsLoading(true);
        const response = await api.get(`/client-brokers/${id}/orders-leads`, {
          params: { page, limit: 50 },
        });
        setOrderLeads(response.data.data);
        setOrderLeadsPagination(response.data.pagination);
      } catch (error) {
        console.error("Failed to load order leads", error);
      } finally {
        setOrderLeadsLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    fetchProfile();
    fetchOrderLeads();
  }, [fetchProfile, fetchOrderLeads]);

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
          <IconButton onClick={() => navigate("/crm", { state: { tab: 1 } })}>
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
                  {profile.totalOrders || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Orders
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: "center", py: 1 }}>
                <Typography variant="h4" color="primary.main">
                  {profile.totalLeadsFromOrders || 0}
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

      {/* Orders / Leads Table */}
      <Paper sx={{ borderRadius: 2, border: 1, borderColor: "divider", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", overflow: "hidden", mb: 3 }}>
        <Box sx={{ px: 2, py: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="subtitle2">
            Leads from Orders ({profile.totalLeadsFromOrders || 0})
          </Typography>
        </Box>
        <TableContainer sx={{ maxHeight: 400 }}>
          <Table size="small" stickyHeader sx={leadsTableSx}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: "14%" }}>Order ID</TableCell>
                <TableCell sx={{ width: "11%" }}>Order Date</TableCell>
                <TableCell sx={{ width: "21%" }}>Lead Name</TableCell>
                <TableCell sx={{ width: "27%" }}>Email</TableCell>
                <TableCell sx={{ textAlign: "center", width: "12%" }}>Type</TableCell>
                <TableCell sx={{ width: "5%" }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {orderLeadsLoading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                    <CircularProgress size={22} />
                  </TableCell>
                </TableRow>
              ) : orderLeads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                    <Typography variant="caption" color="text.secondary">
                      No leads found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                orderLeads.map((row, idx) => (
                  <TableRow key={`${row.orderId}-${row.leadId}-${idx}`} hover>
                    <TableCell>
                      <Tooltip title={row.orderId}>
                        <Typography noWrap sx={{ fontFamily: "monospace", fontSize: "0.75rem", color: "primary.dark", fontWeight: 500 }}>
                          {row.orderId.slice(-8)}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Typography noWrap sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                        {row.orderDate ? new Date(row.orderDate).toLocaleDateString() : "-"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography noWrap sx={{ fontSize: "0.78rem" }}>
                        {row.name || "-"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography noWrap sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                        {row.email || "-"}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ textAlign: "center" }}>
                      <Chip
                        label={row.leadType?.toUpperCase() || "-"}
                        color={getLeadTypeColor(row.leadType)}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell sx={{ textAlign: "center", px: 0 }}>
                      <IconButton
                        size="small"
                        onClick={() => navigate("/orders", { state: { highlightOrderId: row.orderId, highlightLeadId: row.leadId } })}
                        sx={{ p: 0.25 }}
                      >
                        <ChevronRightIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {orderLeadsPagination.total > 0 && (
          <TablePagination
            component="div"
            count={orderLeadsPagination.total}
            page={orderLeadsPagination.current - 1}
            onPageChange={(e, p) => fetchOrderLeads(p + 1)}
            rowsPerPage={orderLeadsPagination.limit}
            rowsPerPageOptions={[orderLeadsPagination.limit]}
            sx={{ borderTop: 1, borderColor: "divider", "& .MuiTablePagination-toolbar": { minHeight: 36 }, "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows": { fontSize: "0.75rem" } }}
          />
        )}
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
