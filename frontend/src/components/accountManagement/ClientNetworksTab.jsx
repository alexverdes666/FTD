import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
  Tooltip,
  CircularProgress,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import { DataGrid } from "@mui/x-data-grid";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import api from "../../services/api";
import { useSelector } from "react-redux";
import { selectUser } from "../../store/slices/authSlice";
import toast from "react-hot-toast";
import CommentButton from "../CommentButton";
import useSensitiveAction from "../../hooks/useSensitiveAction";
import SensitiveActionModal from "../SensitiveActionModal";

const clientNetworkSchema = yup.object({
  name: yup
    .string()
    .required("Name is required")
    .max(100, "Name must be less than 100 characters"),
  description: yup
    .string()
    .max(500, "Description must be less than 500 characters"),
});

const ClientNetworksTab = () => {
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const { executeSensitiveAction, sensitiveActionState, resetSensitiveAction } =
    useSensitiveAction();

  const [clientNetworks, setClientNetworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 0, pageSize: 25 });
  const [totalRows, setTotalRows] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingNetwork, setEditingNetwork] = useState(null);

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
        page: pagination.page + 1,
        limit: pagination.pageSize,
        ...(searchTerm && { search: searchTerm }),
        ...(showActiveOnly && { isActive: "true" }),
      });

      const response = await api.get(`/client-networks?${params}`);
      const networks = response.data.data.map((n) => ({ ...n, id: n._id }));
      setClientNetworks(networks);
      setTotalRows(response.data.pagination.total);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch networks");
    } finally {
      setLoading(false);
    }
  }, [pagination, searchTerm, showActiveOnly]);

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
      reset({ name: "", description: "" });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingNetwork(null);
    reset();
  };

  const onSubmit = async (data) => {
    try {
      if (editingNetwork) {
        await api.put(`/client-networks/${editingNetwork._id}`, data);
        toast.success("Network updated successfully");
      } else {
        await api.post("/client-networks", data);
        toast.success("Network created successfully");
      }
      handleCloseDialog();
      fetchClientNetworks();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save network");
    }
  };

  const handleDelete = async (networkId) => {
    const network = clientNetworks.find((n) => n._id === networkId);
    if (!window.confirm(`Delete "${network?.name}"? This requires 2FA.`)) return;

    try {
      await executeSensitiveAction({
        actionName: "Delete Client Network",
        actionDescription: `This will permanently delete "${network?.name}".`,
        apiCall: async (headers) => {
          return await api.delete(`/client-networks/${networkId}`, { headers });
        },
      });
      toast.success("Network deleted successfully");
      fetchClientNetworks();
    } catch (error) {
      if (error.message !== "User cancelled sensitive action") {
        toast.error(error.response?.data?.message || "Failed to delete");
      }
    }
  };

  const handleToggleActive = async (network) => {
    try {
      await api.put(`/client-networks/${network._id}`, {
        isActive: !network.isActive,
      });
      toast.success(`Network ${!network.isActive ? "activated" : "deactivated"}`);
      fetchClientNetworks();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update status");
    }
  };

  const columns = [
    {
      field: "name",
      headerName: "Name",
      flex: 1.5,
      minWidth: 150,
      renderCell: (params) => (
        <Typography variant="body2" fontWeight="bold">
          {params.value}
        </Typography>
      ),
    },
    {
      field: "description",
      headerName: "Description",
      flex: 2,
      minWidth: 200,
      renderCell: (params) => (
        <Typography variant="body2" color="text.secondary" noWrap>
          {params.value || "No description"}
        </Typography>
      ),
    },
    {
      field: "employees",
      headerName: "Employees",
      width: 100,
      align: "center",
      headerAlign: "center",
      renderCell: (params) => (
        <Chip
          label={params.value?.length || 0}
          size="small"
          variant="outlined"
        />
      ),
    },
    {
      field: "isActive",
      headerName: "Status",
      width: 100,
      align: "center",
      headerAlign: "center",
      renderCell: (params) => (
        <Chip
          label={params.value ? "Active" : "Inactive"}
          color={params.value ? "success" : "default"}
          size="small"
        />
      ),
    },
    {
      field: "createdAt",
      headerName: "Created",
      width: 110,
      align: "center",
      headerAlign: "center",
      renderCell: (params) => new Date(params.value).toLocaleDateString(),
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 200,
      align: "right",
      headerAlign: "right",
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: "flex", gap: 0.5 }}>
          <Tooltip title="View Profile">
            <IconButton
              size="small"
              onClick={() => navigate(`/client-network/${params.row._id}`)}
            >
              <ViewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {user?.role === "admin" && (
            <>
              <Tooltip title="Edit">
                <IconButton
                  size="small"
                  onClick={() => handleOpenDialog(params.row)}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={params.row.isActive ? "Deactivate" : "Activate"}>
                <span>
                  <Switch
                    size="small"
                    checked={params.row.isActive}
                    onChange={() => handleToggleActive(params.row)}
                  />
                </span>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleDelete(params.row._id)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
          <CommentButton
            targetType="client_network"
            targetId={params.row._id}
            targetName={params.row.name}
          />
        </Box>
      ),
    },
  ];

  return (
    <Box>
      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
          <TextField
            label="Search networks..."
            variant="outlined"
            size="small"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ minWidth: 200 }}
            InputProps={{ endAdornment: <SearchIcon color="action" /> }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={showActiveOnly}
                onChange={(e) => setShowActiveOnly(e.target.checked)}
              />
            }
            label="Active only"
          />
          {user?.role === "admin" && (
            <Box sx={{ ml: "auto" }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleOpenDialog()}
              >
                Add Network
              </Button>
            </Box>
          )}
        </Box>
      </Paper>

      {/* DataGrid */}
      <Paper sx={{ width: "100%" }}>
        <DataGrid
          rows={clientNetworks}
          columns={columns}
          loading={loading}
          pagination
          paginationMode="server"
          paginationModel={pagination}
          onPaginationModelChange={setPagination}
          rowCount={totalRows}
          pageSizeOptions={[25, 50, 100]}
          disableRowSelectionOnClick
          autoHeight
          sx={{
            "& .MuiDataGrid-columnHeaders": { backgroundColor: "#f5f5f5" },
            border: "none",
          }}
        />
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle>
            {editingNetwork ? "Edit Client Network" : "Add Client Network"}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
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
              {isSubmitting ? <CircularProgress size={20} /> : editingNetwork ? "Update" : "Create"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Sensitive Action Modal */}
      <SensitiveActionModal
        open={sensitiveActionState.showModal}
        onClose={resetSensitiveAction}
        onVerify={(code, useBackup) => sensitiveActionState.handleVerify(code, useBackup)}
        onQRVerify={(token) => sensitiveActionState.handleQRVerify(token)}
        actionName={sensitiveActionState.actionName}
        actionDescription={sensitiveActionState.actionDescription}
        loading={sensitiveActionState.verifying}
        error={sensitiveActionState.error}
        requires2FASetup={sensitiveActionState.requires2FASetup}
        userId={sensitiveActionState.userId}
        qrAuthEnabled={sensitiveActionState.qrAuthEnabled}
      />
    </Box>
  );
};

export default ClientNetworksTab;
