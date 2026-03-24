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
  CircularProgress,
  Tabs,
  Tab,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  InputAdornment,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  CreditCard as CreditCardIcon,
  CloudUpload as UploadIcon,
  Link as LinkIcon,
  MoreVert as MoreVertIcon,
  ToggleOn as ActivateIcon,
  ToggleOff as DeactivateIcon,
} from "@mui/icons-material";
import { DataGrid } from "@mui/x-data-grid";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import api from "../services/api";
import { useSelector } from "react-redux";
import { selectUser } from "../store/slices/authSlice";
import toast from "react-hot-toast";
import CommentButton from "../components/CommentButton";

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

const CardIssuersPage = ({ setHeaderExtra }) => {
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
  const [logoInputMode, setLogoInputMode] = useState(0); // 0 = URL, 1 = Upload, 2 = AI Generate
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuRow, setMenuRow] = useState(null);
  const fileInputRef = useRef(null);
  const gridWrapperRef = useRef(null);
  const [gridHeight, setGridHeight] = useState("100%");

  const nameRef = useRef(null);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(cardIssuerSchema),
    defaultValues: {
      name: "",
      description: "",
      logo: "",
    },
  });

  const logoValue = watch("logo");

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

  // Snap grid height to exact row multiples to prevent partial row peeking
  useEffect(() => {
    const wrapper = gridWrapperRef.current;
    if (!wrapper) return;
    const ROW_HEIGHT = 36;
    const HEADER_HEIGHT = 36;
    const FOOTER_HEIGHT = 36;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const available = entry.contentRect.height;
        const rowSpace = available - HEADER_HEIGHT - FOOTER_HEIGHT;
        const visibleRows = Math.floor(rowSpace / ROW_HEIGHT);
        const snappedHeight = visibleRows * ROW_HEIGHT + HEADER_HEIGHT + FOOTER_HEIGHT;
        setGridHeight(snappedHeight);
      }
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  const handleOpenDialog = (issuer = null) => {
    setEditingIssuer(issuer);
    setLogoInputMode(0);
    setLogoPreview(null);
    if (issuer) {
      reset({
        name: issuer.name || "",
        description: issuer.description || "",
        logo: issuer.logo || "",
      });
      if (issuer.logo) {
        setLogoPreview(issuer.logo);
      }
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
    setLogoPreview(null);
    setLogoInputMode(0);
    reset();
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file type. Please upload JPEG, PNG, GIF, WebP, or SVG.");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB.");
      return;
    }

    try {
      setUploadingLogo(true);

      // Create FormData
      const formData = new FormData();
      formData.append("image", file);

      // Upload image
      const response = await api.post("/card-issuers/upload-logo", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data.success) {
        const logoUrl = response.data.data.url;
        setValue("logo", logoUrl);
        setLogoPreview(logoUrl);
        toast.success("Logo uploaded successfully");
      }
    } catch (error) {
      console.error("Error uploading logo:", error);
      toast.error(error.response?.data?.message || "Failed to upload logo");
    } finally {
      setUploadingLogo(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
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

  const handleMenuOpen = (event, row) => {
    setMenuAnchor(event.currentTarget);
    setMenuRow(row);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setMenuRow(null);
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
      width: 100,
      align: "center",
      headerAlign: "center",
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <CommentButton
            targetType="cardIssuer"
            targetId={params.row._id}
            targetName={params.row.name}
          />
          <IconButton size="small" onClick={(e) => handleMenuOpen(e, params.row)}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];

  // Push filters to CRM header
  useEffect(() => {
    if (!setHeaderExtra) return;
    setHeaderExtra(
      <>
        <FormControlLabel
          control={<Switch checked={showActiveOnly} onChange={(e) => setShowActiveOnly(e.target.checked)} size="small" />}
          label={<Typography sx={{ fontSize: "0.7rem" }}>Active only</Typography>}
          sx={{ mr: 0, ml: 0 }}
        />
        <TextField
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          size="small"
          sx={{ width: 160, "& .MuiOutlinedInput-root": { borderRadius: 5, fontSize: "0.75rem", height: 28 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 14, color: "text.disabled" }} />
              </InputAdornment>
            ),
          }}
        />
        {canCreate && (
          <IconButton
            size="small"
            color="primary"
            onClick={() => handleOpenDialog()}
            sx={{ width: 28, height: 28, bgcolor: "primary.main", color: "#fff", "&:hover": { bgcolor: "primary.dark" } }}
          >
            <AddIcon sx={{ fontSize: 16 }} />
          </IconButton>
        )}
      </>
    );
  }, [setHeaderExtra, searchTerm, showActiveOnly, canCreate]);

  useEffect(() => {
    return () => { if (setHeaderExtra) setHeaderExtra(null); };
  }, [setHeaderExtra]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* DataGrid */}
      <Paper ref={gridWrapperRef} sx={{ flex: 1, minHeight: 0, width: "100%" }}>
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
          rowHeight={36}
          columnHeaderHeight={36}
          disableRowSelectionOnClick
          sx={{
            height: gridHeight,
            "& .MuiDataGrid-columnHeaders": { backgroundColor: "#f5f5f5" },
            "& .MuiDataGrid-overlayWrapper": { minHeight: "auto" },
            "& .MuiDataGrid-footerContainer": { minHeight: "36px !important", maxHeight: "36px !important" },
            "& .MuiTablePagination-root": { height: 36, overflow: "hidden" },
            "& .MuiTablePagination-toolbar": { minHeight: "36px !important", height: "36px !important", pl: 0 },
            "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows": { fontSize: "0.72rem" },
            "& .MuiTablePagination-select": { fontSize: "0.72rem" },
            "& .MuiTablePagination-actions button": { p: 0.25 },
            border: "none",
          }}
        />
      </Paper>

      {/* Actions Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        {isAdmin && [
          <MenuItem key="edit" onClick={() => { handleMenuClose(); handleOpenDialog(menuRow); }}>
            <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Edit</ListItemText>
          </MenuItem>,
          <MenuItem key="toggle" onClick={() => { handleMenuClose(); handleToggleActive(menuRow); }}>
            <ListItemIcon>
              {menuRow?.isActive ? <DeactivateIcon fontSize="small" /> : <ActivateIcon fontSize="small" color="success" />}
            </ListItemIcon>
            <ListItemText>{menuRow?.isActive ? "Deactivate" : "Activate"}</ListItemText>
          </MenuItem>,
          <MenuItem key="delete" onClick={() => { handleMenuClose(); handleDelete(menuRow?._id); }} sx={{ color: "error.main" }}>
            <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
            <ListItemText>Delete</ListItemText>
          </MenuItem>,
        ]}
      </Menu>

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

              {/* Logo Input Section */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Logo (optional)
                </Typography>
                <Tabs
                  value={logoInputMode}
                  onChange={(_, newValue) => setLogoInputMode(newValue)}
                  sx={{ mb: 2, minHeight: 36 }}
                >
                  <Tab
                    icon={<LinkIcon fontSize="small" />}
                    iconPosition="start"
                    label="URL"
                    sx={{ minHeight: 36, py: 0.5 }}
                  />
                  <Tab
                    icon={<UploadIcon fontSize="small" />}
                    iconPosition="start"
                    label="Upload"
                    sx={{ minHeight: 36, py: 0.5 }}
                  />
                </Tabs>

                {logoInputMode === 0 ? (
                  <Controller
                    name="logo"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Logo URL"
                        placeholder="https://example.com/logo.png"
                        fullWidth
                        error={!!errors.logo}
                        helperText={errors.logo?.message}
                        onChange={(e) => {
                          field.onChange(e);
                          setLogoPreview(e.target.value);
                        }}
                      />
                    )}
                  />
                ) : (
                  <Box>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                      style={{ display: "none" }}
                      onChange={handleFileSelect}
                    />
                    <Button
                      variant="outlined"
                      startIcon={uploadingLogo ? <CircularProgress size={16} /> : <UploadIcon />}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingLogo}
                      fullWidth
                    >
                      {uploadingLogo ? "Uploading..." : "Choose Image"}
                    </Button>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                      Supported formats: JPEG, PNG, GIF, WebP, SVG. Max size: 5MB.
                    </Typography>
                  </Box>
                )}

                {/* Logo Preview */}
                {logoPreview && (
                  <Box sx={{ mt: 2, display: "flex", alignItems: "center", gap: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Preview:
                    </Typography>
                    <Box
                      component="img"
                      src={logoPreview}
                      alt="Logo preview"
                      sx={{
                        maxWidth: 80,
                        maxHeight: 80,
                        objectFit: "contain",
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1,
                        p: 0.5,
                      }}
                      onError={() => setLogoPreview(null)}
                    />
                    <Button
                      size="small"
                      color="error"
                      onClick={() => {
                        setValue("logo", "");
                        setLogoPreview(null);
                      }}
                    >
                      Remove
                    </Button>
                  </Box>
                )}
              </Box>
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

export default CardIssuersPage;
