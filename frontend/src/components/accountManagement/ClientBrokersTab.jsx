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

const clientBrokerSchema = yup.object({
  name: yup
    .string()
    .required("Name is required")
    .max(100, "Name must be less than 100 characters"),
  domain: yup.string().max(200, "Domain must be less than 200 characters"),
  description: yup
    .string()
    .max(500, "Description must be less than 500 characters"),
});

const ClientBrokersTab = () => {
  const navigate = useNavigate();
  const user = useSelector(selectUser);

  const [clientBrokers, setClientBrokers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 0, pageSize: 25 });
  const [totalRows, setTotalRows] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingBroker, setEditingBroker] = useState(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(clientBrokerSchema),
    defaultValues: {
      name: "",
      domain: "",
      description: "",
    },
  });

  const fetchClientBrokers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page + 1,
        limit: pagination.pageSize,
        ...(searchTerm && { search: searchTerm }),
        ...(showActiveOnly && { isActive: "true" }),
      });

      const response = await api.get(`/client-brokers?${params}`);
      const brokers = response.data.data.map((b) => ({ ...b, id: b._id }));
      setClientBrokers(brokers);
      setTotalRows(response.data.pagination.total);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch brokers");
    } finally {
      setLoading(false);
    }
  }, [pagination, searchTerm, showActiveOnly]);

  useEffect(() => {
    fetchClientBrokers();
  }, [fetchClientBrokers]);

  const handleOpenDialog = (broker = null) => {
    setEditingBroker(broker);
    if (broker) {
      reset({
        name: broker.name,
        domain: broker.domain || "",
        description: broker.description || "",
      });
    } else {
      reset({ name: "", domain: "", description: "" });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingBroker(null);
    reset();
  };

  const onSubmit = async (data) => {
    try {
      if (editingBroker) {
        await api.put(`/client-brokers/${editingBroker._id}`, data);
        toast.success("Broker updated successfully");
      } else {
        await api.post("/client-brokers", data);
        toast.success("Broker created successfully");
      }
      handleCloseDialog();
      fetchClientBrokers();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save broker");
    }
  };

  const handleDelete = async (brokerId) => {
    const broker = clientBrokers.find((b) => b._id === brokerId);
    if (!window.confirm(`Delete "${broker?.name}"?`)) return;

    try {
      await api.delete(`/client-brokers/${brokerId}`);
      toast.success("Broker deleted successfully");
      fetchClientBrokers();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete broker");
    }
  };

  const handleToggleActive = async (broker) => {
    try {
      await api.put(`/client-brokers/${broker._id}`, {
        isActive: !broker.isActive,
      });
      toast.success(`Broker ${!broker.isActive ? "activated" : "deactivated"}`);
      fetchClientBrokers();
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
      field: "domain",
      headerName: "Domain",
      flex: 1.5,
      minWidth: 150,
      renderCell: (params) => (
        <Typography variant="body2" color="text.secondary">
          {params.value || "-"}
        </Typography>
      ),
    },
    {
      field: "psps",
      headerName: "PSPs",
      width: 80,
      align: "center",
      headerAlign: "center",
      renderCell: (params) => (
        <Chip
          label={params.value?.length || 0}
          size="small"
          variant="outlined"
          color={params.value?.length > 0 ? "primary" : "default"}
        />
      ),
    },
    {
      field: "totalLeadsAssigned",
      headerName: "Leads",
      width: 80,
      align: "center",
      headerAlign: "center",
      renderCell: (params) => params.value || 0,
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
              onClick={() => navigate(`/client-broker/${params.row._id}`)}
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
            targetType="client_broker"
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
            label="Search brokers..."
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
                Add Broker
              </Button>
            </Box>
          )}
        </Box>
      </Paper>

      {/* DataGrid */}
      <Paper sx={{ width: "100%" }}>
        <DataGrid
          rows={clientBrokers}
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
            {editingBroker ? "Edit Client Broker" : "Add Client Broker"}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Broker Name"
                    fullWidth
                    error={!!errors.name}
                    helperText={errors.name?.message}
                  />
                )}
              />
              <Controller
                name="domain"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Domain/Website"
                    fullWidth
                    error={!!errors.domain}
                    helperText={errors.domain?.message}
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
              {isSubmitting ? <CircularProgress size={20} /> : editingBroker ? "Update" : "Create"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default ClientBrokersTab;
