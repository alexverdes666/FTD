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

const pspSchema = yup.object({
  website: yup
    .string()
    .required("Website URL is required")
    .max(200, "Website must be less than 200 characters"),
  description: yup
    .string()
    .max(500, "Description must be less than 500 characters"),
  cardNumber: yup
    .string()
    .max(30, "Card number must be less than 30 characters"),
  cardExpiry: yup
    .string()
    .matches(/^$|^(0[1-9]|1[0-2])\/([0-9]{2})$/, "Must be in MM/YY format"),
  cardCVC: yup
    .string()
    .matches(/^$|^[0-9]{3,4}$/, "Must be 3-4 digits"),
});

// Card Preview Component
const CardPreview = ({ cardNumber, cardExpiry, cardCVC }) => {
  const formatCardNumber = (num) => {
    if (!num) return "•••• •••• •••• ••••";
    // Remove non-digits and format
    const cleaned = num.replace(/\D/g, "");
    const groups = cleaned.match(/.{1,4}/g) || [];
    const formatted = groups.join(" ");
    // Pad with dots if needed
    if (formatted.length < 19) {
      return formatted + " " + "•••• •••• •••• ••••".slice(formatted.length + 1);
    }
    return formatted;
  };

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 380,
        height: 220,
        borderRadius: 3,
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        p: 3,
        color: "white",
        position: "relative",
        boxShadow: "0 10px 30px rgba(102, 126, 234, 0.4)",
        overflow: "hidden",
        mx: "auto",
        "&::before": {
          content: '""',
          position: "absolute",
          top: -50,
          right: -50,
          width: 150,
          height: 150,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.1)",
        },
        "&::after": {
          content: '""',
          position: "absolute",
          bottom: -80,
          left: -80,
          width: 200,
          height: 200,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.05)",
        },
      }}
    >
      {/* Card Chip */}
      <Box
        sx={{
          width: 50,
          height: 35,
          borderRadius: 1,
          background: "linear-gradient(135deg, #ffd700 0%, #ffb700 100%)",
          mb: 3,
        }}
      />

      {/* Card Number */}
      <Typography
        sx={{
          fontSize: "1.4rem",
          fontFamily: "'Courier New', monospace",
          letterSpacing: "0.15em",
          mb: 3,
          textShadow: "0 2px 4px rgba(0,0,0,0.2)",
        }}
      >
        {formatCardNumber(cardNumber)}
      </Typography>

      {/* Card Details Row */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <Box>
          <Typography sx={{ fontSize: "0.65rem", opacity: 0.7, mb: 0.5 }}>
            VALID THRU
          </Typography>
          <Typography
            sx={{
              fontSize: "1rem",
              fontFamily: "'Courier New', monospace",
              letterSpacing: "0.1em",
            }}
          >
            {cardExpiry || "MM/YY"}
          </Typography>
        </Box>
        <Box>
          <Typography sx={{ fontSize: "0.65rem", opacity: 0.7, mb: 0.5 }}>
            CVC
          </Typography>
          <Typography
            sx={{
              fontSize: "1rem",
              fontFamily: "'Courier New', monospace",
              letterSpacing: "0.1em",
            }}
          >
            {cardCVC || "•••"}
          </Typography>
        </Box>
        <CreditCardIcon sx={{ fontSize: 40, opacity: 0.8 }} />
      </Box>
    </Box>
  );
};

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

  // Refs for auto-focus flow
  const websiteRef = useRef(null);
  const cardNumberRef = useRef(null);
  const cardExpiryRef = useRef(null);
  const cardCVCRef = useRef(null);
  const submitButtonRef = useRef(null);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(pspSchema),
    defaultValues: {
      website: "",
      description: "",
      cardNumber: "",
      cardExpiry: "",
      cardCVC: "",
    },
  });

  // Watch card fields for live preview
  const watchedCardNumber = watch("cardNumber");
  const watchedCardExpiry = watch("cardExpiry");
  const watchedCardCVC = watch("cardCVC");

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

  const handleOpenDialog = (psp = null) => {
    setEditingPSP(psp);
    if (psp) {
      reset({
        website: psp.website || "",
        description: psp.description || "",
        cardNumber: psp.cardNumber || "",
        cardExpiry: psp.cardExpiry || "",
        cardCVC: psp.cardCVC || "",
      });
    } else {
      reset({ website: "", description: "", cardNumber: "", cardExpiry: "", cardCVC: "" });
    }
    setOpenDialog(true);
    // Auto-focus on website field after dialog opens
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

  // Format card number for display (with spaces)
  const formatCardNumberDisplay = (value) => {
    if (!value) return "";
    const cleaned = value.replace(/\D/g, "");
    const groups = cleaned.match(/.{1,4}/g) || [];
    return groups.join(" ");
  };

  // Format card number input
  const handleCardNumberChange = (e, onChange) => {
    // Remove all non-digits and spaces
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 16) value = value.slice(0, 16);
    onChange(value);

    // Auto-move to expiry when 16 digits entered
    if (value.length === 16) {
      setTimeout(() => cardExpiryRef.current?.focus(), 50);
    }
  };

  // Format expiry input
  const handleExpiryChange = (e, onChange) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 4) value = value.slice(0, 4);
    if (value.length >= 2) {
      value = value.slice(0, 2) + "/" + value.slice(2);
    }
    onChange(value);

    // Auto-move to CVC when expiry is complete (MM/YY = 5 chars)
    if (value.length === 5) {
      setTimeout(() => cardCVCRef.current?.focus(), 50);
    }
  };

  // Format CVC input
  const handleCVCChange = (e, onChange) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 4) value = value.slice(0, 4);
    onChange(value);

    // Auto-move to submit button when CVC is complete (3-4 digits)
    if (value.length >= 3) {
      setTimeout(() => submitButtonRef.current?.focus(), 50);
    }
  };

  // Handle website field - move to card number on Enter
  const handleWebsiteKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      cardNumberRef.current?.focus();
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
      field: "cardNumber",
      headerName: "Card",
      width: 100,
      align: "center",
      headerAlign: "center",
      renderCell: (params) => (
        params.value ? (
          <Tooltip title={`•••• ${params.value.slice(-4)}`}>
            <CreditCardIcon color="primary" fontSize="small" />
          </Tooltip>
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
        <Box sx={{ display: "flex", gap: 0.5 }}>
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
                    onKeyDown={handleWebsiteKeyDown}
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

              {/* Card Preview Section */}
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Card Preview (Optional)
                </Typography>

                {/* Live Card Preview */}
                <Box sx={{ mb: 3 }}>
                  <CardPreview
                    cardNumber={watchedCardNumber}
                    cardExpiry={watchedCardExpiry}
                    cardCVC={watchedCardCVC}
                  />
                </Box>

                {/* Card Input Fields */}
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <Controller
                    name="cardNumber"
                    control={control}
                    render={({ field: { onChange, value, ...field } }) => (
                      <TextField
                        {...field}
                        inputRef={cardNumberRef}
                        value={formatCardNumberDisplay(value)}
                        onChange={(e) => handleCardNumberChange(e, onChange)}
                        label="Card Number"
                        placeholder="1234 5678 9012 3456"
                        fullWidth
                        error={!!errors.cardNumber}
                        helperText={errors.cardNumber?.message}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <CreditCardIcon color="action" />
                            </InputAdornment>
                          ),
                        }}
                      />
                    )}
                  />
                  <Box sx={{ display: "flex", gap: 2 }}>
                    <Controller
                      name="cardExpiry"
                      control={control}
                      render={({ field: { onChange, value, ...field } }) => (
                        <TextField
                          {...field}
                          inputRef={cardExpiryRef}
                          value={value}
                          onChange={(e) => handleExpiryChange(e, onChange)}
                          label="Expiry Date"
                          placeholder="MM/YY"
                          fullWidth
                          error={!!errors.cardExpiry}
                          helperText={errors.cardExpiry?.message}
                        />
                      )}
                    />
                    <Controller
                      name="cardCVC"
                      control={control}
                      render={({ field: { onChange, value, ...field } }) => (
                        <TextField
                          {...field}
                          inputRef={cardCVCRef}
                          value={value}
                          onChange={(e) => handleCVCChange(e, onChange)}
                          label="CVC"
                          placeholder="123"
                          fullWidth
                          error={!!errors.cardCVC}
                          helperText={errors.cardCVC?.message}
                        />
                      )}
                    />
                  </Box>
                </Box>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button
              ref={submitButtonRef}
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
