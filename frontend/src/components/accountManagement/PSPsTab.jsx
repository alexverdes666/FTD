import React, { useState, useEffect, useCallback, useRef } from "react";
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
  Link,
  InputAdornment,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
  Language as WebIcon,
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

const pspSchema = yup.object({
  website: yup
    .string()
    .required("Website URL is required")
    .max(200, "Website must be less than 200 characters"),
  description: yup
    .string()
    .max(500, "Description must be less than 500 characters"),
});

const PSPsTab = () => {
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const isAdmin = user?.role === "admin";

  const [psps, setPsps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 0, pageSize: 25 });
  const [totalRows, setTotalRows] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingPSP, setEditingPSP] = useState(null);

  const websiteRef = useRef(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(pspSchema),
    defaultValues: {
      website: "",
      description: "",
    },
  });

  const fetchPSPs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page + 1,
        limit: pagination.pageSize,
        ...(searchTerm && { search: searchTerm }),
        ...(showActiveOnly && { isActive: "true" }),
      });

      const response = await api.get(`/psps?${params}`);
      const pspList = response.data.data.map((p) => ({ ...p, id: p._id }));
      setPsps(pspList);
      setTotalRows(response.data.pagination.total);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch PSPs");
    } finally {
      setLoading(false);
    }
  }, [pagination, searchTerm, showActiveOnly]);

  useEffect(() => {
    fetchPSPs();
  }, [fetchPSPs]);

  const handleOpenDialog = async (psp = null) => {
    setEditingPSP(psp);

    if (psp) {
      reset({
        website: psp.website || "",
        description: psp.description || "",
      });
    } else {
      reset({ website: "", description: "" });
    }
    setOpenDialog(true);
    setTimeout(() => {
      websiteRef.current?.focus();
    }, 100);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingPSP(null);
    reset();
  };

  const onSubmit = async (data) => {
    try {
      if (editingPSP) {
        await api.put(`/psps/${editingPSP._id}`, data);
        toast.success("PSP updated successfully");
      } else {
        await api.post("/psps", data);
        toast.success("PSP created successfully");
      }
      handleCloseDialog();
      fetchPSPs();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save PSP");
    }
  };

  const handleDelete = async (pspId) => {
    const psp = psps.find((p) => p._id === pspId);
    if (!window.confirm(`Delete "${psp?.name}"?`)) return;

    try {
      await api.delete(`/psps/${pspId}`);
      toast.success("PSP deleted successfully");
      fetchPSPs();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete PSP");
    }
  };

  const handleToggleActive = async (psp) => {
    try {
      await api.put(`/psps/${psp._id}`, {
        isActive: !psp.isActive,
      });
      toast.success(`PSP ${!psp.isActive ? "activated" : "deactivated"}`);
      fetchPSPs();
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
      field: "website",
      headerName: "Website",
      flex: 1,
      minWidth: 120,
      renderCell: (params) =>
        params.value ? (
          <Link
            href={params.value.startsWith("http") ? params.value : `https://${params.value}`}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
          >
            <WebIcon fontSize="small" />
            Visit
          </Link>
        ) : (
          <Typography variant="body2" color="text.secondary">-</Typography>
        ),
    },
    {
      field: "cardIssuer",
      headerName: "Card Issuer",
      width: 130,
      renderCell: (params) => (
        params.value ? (
          <Chip label={params.value.name} size="small" variant="outlined" color="primary" />
        ) : (
          <Typography variant="body2" color="text.secondary">-</Typography>
        )
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
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Tooltip title="View Profile">
            <IconButton
              size="small"
              onClick={() => navigate(`/psp/${params.row._id}`)}
            >
              <ViewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {isAdmin && (
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
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <Switch
                    size="small"
                    checked={params.row.isActive}
                    onChange={() => handleToggleActive(params.row)}
                  />
                </Box>
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
            targetType="psp"
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
            label="Search PSPs..."
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
          {isAdmin && (
            <Box sx={{ ml: "auto" }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleOpenDialog()}
              >
                Add PSP
              </Button>
            </Box>
          )}
        </Box>
      </Paper>

      {/* DataGrid */}
      <Paper sx={{ width: "100%" }}>
        <DataGrid
          rows={psps}
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
            {editingPSP ? "Edit PSP" : "Add PSP"}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
              <Controller
                name="website"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    inputRef={websiteRef}
                    label="Website URL"
                    placeholder="e.g., stripe.com"
                    fullWidth
                    required
                    error={!!errors.website}
                    helperText={errors.website?.message || "The PSP name will be extracted from this URL"}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <WebIcon color="action" />
                        </InputAdornment>
                      ),
                    }}
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
                    rows={2}
                    error={!!errors.description}
                    helperText={errors.description?.message}
                  />
                )}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isSubmitting}
            >
              {isSubmitting ? <CircularProgress size={20} /> : editingPSP ? "Update" : "Create"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default PSPsTab;
