import React, { useState, useEffect, useCallback, useRef } from "react";
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
  Search as SearchIcon,
  CreditCard as CreditCardIcon,
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

const cardIssuerSchema = yup.object({
  name: yup
    .string()
    .required("Card Issuer name is required")
    .max(100, "Name must be less than 100 characters"),
  description: yup
    .string()
    .max(500, "Description must be less than 500 characters"),
  logo: yup
    .string()
    .max(500, "Logo URL must be less than 500 characters"),
});

const CardIssuersTab = () => {
  const user = useSelector(selectUser);
  const isAdmin = user?.role === "admin";
  const canCreate = isAdmin || user?.role === "affiliate_manager";

  const [cardIssuers, setCardIssuers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 0, pageSize: 25 });
  const [totalRows, setTotalRows] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingIssuer, setEditingIssuer] = useState(null);

  const nameRef = useRef(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(cardIssuerSchema),
    defaultValues: {
      name: "",
      description: "",
      logo: "",
    },
  });

  const fetchCardIssuers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page + 1,
        limit: pagination.pageSize,
        ...(searchTerm && { search: searchTerm }),
        ...(showActiveOnly && { isActive: "true" }),
      });

      const response = await api.get(`/card-issuers?${params}`);
      const list = response.data.data.map((item) => ({ ...item, id: item._id }));
      setCardIssuers(list);
      setTotalRows(response.data.pagination.total);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch Card Issuers");
    } finally {
      setLoading(false);
    }
  }, [pagination, searchTerm, showActiveOnly]);

  useEffect(() => {
    fetchCardIssuers();
  }, [fetchCardIssuers]);

  const handleOpenDialog = (issuer = null) => {
    setEditingIssuer(issuer);
    if (issuer) {
      reset({
        name: issuer.name || "",
        description: issuer.description || "",
        logo: issuer.logo || "",
      });
    } else {
      reset({ name: "", description: "", logo: "" });
    }
    setOpenDialog(true);
    setTimeout(() => {
      nameRef.current?.focus();
    }, 100);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingIssuer(null);
    reset();
  };

  const onSubmit = async (data) => {
    try {
      if (editingIssuer) {
        await api.put(`/card-issuers/${editingIssuer._id}`, data);
        toast.success("Card Issuer updated successfully");
      } else {
        await api.post("/card-issuers", data);
        toast.success("Card Issuer created successfully");
      }
      handleCloseDialog();
      fetchCardIssuers();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save Card Issuer");
    }
  };

  const handleDelete = async (id) => {
    const issuer = cardIssuers.find((i) => i._id === id);
    if (!window.confirm(`Delete "${issuer?.name}"?`)) return;

    try {
      await api.delete(`/card-issuers/${id}`);
      toast.success("Card Issuer deleted successfully");
      fetchCardIssuers();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete Card Issuer");
    }
  };

  const handleToggleActive = async (issuer) => {
    try {
      await api.put(`/card-issuers/${issuer._id}`, {
        isActive: !issuer.isActive,
      });
      toast.success(`Card Issuer ${!issuer.isActive ? "activated" : "deactivated"}`);
      fetchCardIssuers();
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
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {params.row.logo ? (
            <Box
              component="img"
              src={params.row.logo}
              alt={params.value}
              sx={{
                width: 24,
                height: 24,
                objectFit: "contain",
                borderRadius: 0.5,
              }}
              onError={(e) => {
                e.target.style.display = "none";
                e.target.nextSibling.style.display = "inline-flex";
              }}
            />
          ) : null}
          <CreditCardIcon
            fontSize="small"
            color="primary"
            sx={{ display: params.row.logo ? "none" : "inline-flex" }}
          />
          <Typography variant="body2" fontWeight="bold">
            {params.value}
          </Typography>
        </Box>
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
      width: 180,
      align: "right",
      headerAlign: "right",
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
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
            targetType="cardIssuer"
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
            label="Search Card Issuers..."
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
          {canCreate && (
            <Box sx={{ ml: "auto" }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleOpenDialog()}
              >
                Add Card Issuer
              </Button>
            </Box>
          )}
        </Box>
      </Paper>

      {/* DataGrid */}
      <Paper sx={{ width: "100%" }}>
        <DataGrid
          rows={cardIssuers}
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
            {editingIssuer ? "Edit Card Issuer" : "Add Card Issuer"}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    inputRef={nameRef}
                    label="Name"
                    placeholder="e.g., Visa, Mastercard, Zen"
                    fullWidth
                    required
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
                    rows={2}
                    error={!!errors.description}
                    helperText={errors.description?.message}
                  />
                )}
              />
              <Controller
                name="logo"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Logo URL (optional)"
                    fullWidth
                    error={!!errors.logo}
                    helperText={errors.logo?.message}
                  />
                )}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={isSubmitting}>
              {isSubmitting ? <CircularProgress size={20} /> : editingIssuer ? "Update" : "Create"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default CardIssuersTab;
