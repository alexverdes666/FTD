import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Collapse,
  Switch,
  FormControlLabel,
  Tooltip,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
} from "@mui/icons-material";
import CommentButton from "../components/CommentButton";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import api from "../services/api";
import { useSelector } from "react-redux";
import { selectUser } from "../store/slices/authSlice";

const clientNetworkSchema = yup.object({
  name: yup
    .string()
    .required("Name is required")
    .max(100, "Name must be less than 100 characters"),
  description: yup
    .string()
    .max(500, "Description must be less than 500 characters"),
});

const ClientNetworksPage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const user = useSelector(selectUser);

  const [clientNetworks, setClientNetworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingNetwork, setEditingNetwork] = useState(null);
  const [viewingNetwork, setViewingNetwork] = useState(null);
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [notification, setNotification] = useState({
    message: "",
    severity: "info",
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(clientNetworkSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const fetchClientNetworks = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page + 1,
        limit: rowsPerPage,
        ...(searchTerm && { search: searchTerm }),
        ...(showActiveOnly && { isActive: "true" }),
      });

      const response = await api.get(`/client-networks?${params}`);
      setClientNetworks(response.data.data);
      setTotalCount(response.data.pagination.total);
    } catch (error) {
      setNotification({
        message:
          error.response?.data?.message || "Failed to fetch client networks",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, searchTerm, showActiveOnly]);

  useEffect(() => {
    fetchClientNetworks();
  }, [fetchClientNetworks]);

  const handleOpenDialog = (network = null) => {
    setEditingNetwork(network);
    if (network) {
      reset({
        name: network.name,
        description: network.description || "",
      });
    } else {
      reset({
        name: "",
        description: "",
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingNetwork(null);
    reset();
  };

  const handleViewNetwork = (network) => {
    setViewingNetwork(network);
    setOpenViewDialog(true);
  };

  const onSubmit = async (data) => {
    try {
      if (editingNetwork) {
        await api.put(`/client-networks/${editingNetwork._id}`, data);
        setNotification({
          message: "Client network updated successfully!",
          severity: "success",
        });
      } else {
        await api.post("/client-networks", data);
        setNotification({
          message: "Client network created successfully!",
          severity: "success",
        });
      }
      handleCloseDialog();
      fetchClientNetworks();
    } catch (error) {
      setNotification({
        message:
          error.response?.data?.message || "Failed to save client network",
        severity: "error",
      });
    }
  };

  const handleDelete = async (networkId) => {
    if (
      !window.confirm("Are you sure you want to delete this client network?")
    ) {
      return;
    }

    try {
      await api.delete(`/client-networks/${networkId}`);
      setNotification({
        message: "Client network deleted successfully!",
        severity: "success",
      });
      fetchClientNetworks();
    } catch (error) {
      setNotification({
        message:
          error.response?.data?.message || "Failed to delete client network",
        severity: "error",
      });
    }
  };

  const handleToggleActive = async (network) => {
    try {
      await api.put(`/client-networks/${network._id}`, {
        isActive: !network.isActive,
      });
      setNotification({
        message: `Client network ${
          !network.isActive ? "activated" : "deactivated"
        } successfully!`,
        severity: "success",
      });
      fetchClientNetworks();
    } catch (error) {
      setNotification({
        message:
          error.response?.data?.message ||
          "Failed to update client network status",
        severity: "error",
      });
    }
  };

  if (user?.role !== "admin") {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Access denied. Only admins can manage client networks.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: isMobile ? 2 : 3, pt: 0, mt: -2 }}>
      {/* Notification */}
      {notification.message && (
        <Collapse in={!!notification.message}>
          <Alert
            severity={notification.severity}
            sx={{ mb: 2 }}
            onClose={() => setNotification({ message: "", severity: "info" })}
          >
            {notification.message}
          </Alert>
        </Collapse>
      )}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
          <TextField
            label="Search networks..."
            variant="outlined"
            size="small"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ minWidth: 200 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={showActiveOnly}
                onChange={(e) => setShowActiveOnly(e.target.checked)}
                color="primary"
              />
            }
            label="Active only"
          />
          <Box sx={{ ml: "auto" }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
              size={isMobile ? "small" : "medium"}
            >
              Add Network
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', backgroundColor: 'grey.200' }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 'bold', backgroundColor: 'grey.200' }}>Description</TableCell>
              <TableCell sx={{ fontWeight: 'bold', backgroundColor: 'grey.200', textAlign: 'center' }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 'bold', backgroundColor: 'grey.200', textAlign: 'center' }}>Created</TableCell>
              <TableCell sx={{ fontWeight: 'bold', backgroundColor: 'grey.200', textAlign: 'right' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : clientNetworks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  No client networks found
                </TableCell>
              </TableRow>
            ) : (
              clientNetworks.map((network) => (
                <TableRow key={network._id}>
                  <TableCell>
                    <Typography variant="subtitle2">{network.name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {network.description || "No description"}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={network.isActive ? "Active" : "Inactive"}
                      color={network.isActive ? "success" : "default"}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Typography variant="body2">
                      {new Date(network.createdAt).toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Box display="flex" gap={1} justifyContent="flex-end">
                      <Tooltip title="View">
                        <IconButton
                          size="small"
                          onClick={() => handleViewNetwork(network)}
                        >
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDialog(network)}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip
                        title={network.isActive ? "Deactivate" : "Activate"}
                      >
                        <IconButton
                          size="small"
                          onClick={() => handleToggleActive(network)}
                        >
                          <Switch
                            checked={network.isActive}
                            size="small"
                            onChange={() => handleToggleActive(network)}
                          />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(network._id)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                      <CommentButton
                        targetType="client_network"
                        targetId={network._id}
                        targetName={network.name}
                      />
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      <TablePagination
        rowsPerPageOptions={[5, 10, 25]}
        component="div"
        count={totalCount}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={(event, newPage) => setPage(newPage)}
        onRowsPerPageChange={(event) => {
          setRowsPerPage(parseInt(event.target.value, 10));
          setPage(0);
        }}
      />

      {/* Add/Edit Dialog */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle>
            {editingNetwork ? "Edit Client Network" : "Add Client Network"}
          </DialogTitle>
          <DialogContent>
            <Box
              sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}
            >
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Network Name"
                    fullWidth
                    error={!!errors.name}
                    helperText={errors.name?.message}
                  />
                )}
              />
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Description"
                    fullWidth
                    multiline
                    rows={3}
                    error={!!errors.description}
                    helperText={errors.description?.message}
                  />
                )}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={isSubmitting}>
              {isSubmitting
                ? "Saving..."
                : editingNetwork
                ? "Update"
                : "Create"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* View Dialog */}
      <Dialog
        open={openViewDialog}
        onClose={() => setOpenViewDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Client Network Details</DialogTitle>
        <DialogContent>
          {viewingNetwork && (
            <Box
              sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}
            >
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Network Name
                </Typography>
                <Typography variant="body1">{viewingNetwork.name}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Description
                </Typography>
                <Typography variant="body1">
                  {viewingNetwork.description || "No description"}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Status
                </Typography>
                <Chip
                  label={viewingNetwork.isActive ? "Active" : "Inactive"}
                  color={viewingNetwork.isActive ? "success" : "default"}
                  size="small"
                />
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Created
                </Typography>
                <Typography variant="body1">
                  {new Date(viewingNetwork.createdAt).toLocaleDateString()}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Created By
                </Typography>
                <Typography variant="body1">
                  {viewingNetwork.createdBy?.fullName || "Unknown"}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenViewDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ClientNetworksPage;
