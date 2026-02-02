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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Divider,
  Stack,
} from "@mui/material";
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Person as PersonIcon,
  Hub as NetworkIcon,
  Link as LinkIcon,
} from "@mui/icons-material";
import { useSelector } from "react-redux";
import { selectUser } from "../store/slices/authSlice";
import api from "../services/api";
import toast from "react-hot-toast";
import EmployeeForm, { getPositionLabel } from "../components/accountManagement/EmployeeForm";
import ReferenceSelector from "../components/accountManagement/ReferenceSelector";
import CrmDealsTable from "../components/crm/CrmDealsTable";
import GroupedComments from "../components/accountManagement/GroupedComments";

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

  // Employee handlers
  const handleAddEmployee = () => {
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
          <IconButton onClick={() => navigate(-1)}>
            <BackIcon />
          </IconButton>
          <NetworkIcon sx={{ fontSize: 40, color: "primary.main" }} />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h5" fontWeight="bold">
              {profile.name}
            </Typography>
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
                  {profile.references?.length || 0}
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
                  {profile.crmDealsSummary?.totalDeals || 0}
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

      <Grid container spacing={3}>
        {/* Employees Section */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Typography variant="h6">
                <PersonIcon sx={{ mr: 1, verticalAlign: "middle" }} />
                Employees
              </Typography>
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
                      <TableRow key={emp._id}>
                        <TableCell>{emp.name}</TableCell>
                        <TableCell>
                          <Chip label={getPositionLabel(emp.position)} size="small" />
                        </TableCell>
                        <TableCell>{emp.telegramUsername || "-"}</TableCell>
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
        </Grid>

        {/* References Section */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Typography variant="h6">
                <LinkIcon sx={{ mr: 1, verticalAlign: "middle" }} />
                References
              </Typography>
              {canManageCrm && (
                <Button size="small" startIcon={<AddIcon />} onClick={() => setReferenceDialogOpen(true)}>
                  Add
                </Button>
              )}
            </Box>
            {profile.references?.length ? (
              <Stack spacing={1}>
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
            ) : (
              <Typography color="text.secondary" align="center">
                No references
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* Comments Section */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Comments (Grouped by Our Network)
            </Typography>
            <GroupedComments groupedComments={profile.groupedComments || []} />
          </Paper>
        </Grid>

        {/* Deals Section */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              CRM Deals
            </Typography>
            <CrmDealsTable networkId={id} isAdmin={isAdmin} />
          </Paper>
        </Grid>
      </Grid>

      {/* Employee Dialog */}
      <EmployeeForm
        open={employeeDialogOpen}
        onClose={() => setEmployeeDialogOpen(false)}
        onSubmit={handleEmployeeSubmit}
        employee={editingEmployee}
        loading={employeeLoading}
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
