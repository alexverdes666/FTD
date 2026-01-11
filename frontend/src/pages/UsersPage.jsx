import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Card,
  CardContent,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TablePagination,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel,
  Stack,
  Tooltip,
  Fade,
  Grow,
  useTheme,
  alpha,
  useMediaQuery,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  AdminPanelSettings as AdminIcon,
  Support as AgentIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
  Cancel as RejectIcon,
  SupervisorAccount as LeadManagerIcon,
  ManageAccounts as ManagerIcon,
  Logout as LogoutIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import api from "../services/api";
import { selectUser } from "../store/slices/authSlice";
import useSensitiveAction from "../hooks/useSensitiveAction";
import SensitiveActionModal from "../components/SensitiveActionModal";
const StyledCard = styled(Card)(({ theme }) => ({
  background: alpha(theme.palette.background.paper, 0.8),
  backdropFilter: "blur(10px)",
}));
const StyledTableRow = styled(TableRow)(({ theme }) => ({
  transition: "all 0.2s ease-in-out",
  "&:hover": {
    backgroundColor: alpha(theme.palette.primary.main, 0.05),
    transform: "scale(1.001)",
  },
}));
const AnimatedIconButton = styled(IconButton)(({ theme }) => ({
  transition: "all 0.2s ease-in-out",
  "&:hover": {
    transform: "scale(1.1)",
  },
}));
const StyledChip = styled(Chip)(({ theme }) => ({
  transition: "all 0.2s ease-in-out",
  "&:hover": {
    transform: "scale(1.05)",
  },
}));
const ROLES = {
  admin: { label: "Admin", icon: <AdminIcon />, color: "error" },
  affiliate_manager: {
    label: "Affiliate Manager",
    icon: <ManagerIcon />,
    color: "primary",
  },
  lead_manager: {
    label: "Lead Manager",
    icon: <LeadManagerIcon />,
    color: "secondary",
  },
  refunds_manager: {
    label: "Refunds Manager",
    icon: <ManagerIcon />,
    color: "info",
  },
  inventory_manager: {
    label: "Inventory Manager",
    icon: <ManagerIcon />,
    color: "warning",
  },
  agent: { label: "Agent", icon: <AgentIcon />, color: "success" },
  pending_approval: {
    label: "Pending Approval",
    icon: <PersonIcon />,
    color: "default",
  },
};
const STATUSES = {
  approved: { label: "Approved", icon: <CheckCircleIcon />, color: "success" },
  pending: { label: "Pending", icon: <PendingIcon />, color: "warning" },
  rejected: { label: "Rejected", icon: <RejectIcon />, color: "error" },
};
const userSchema = yup.object({
  email: yup.string().email("Invalid email").required("Email is required"),
  fullName: yup
    .string()
    .required("Full name is required")
    .min(2, "Name must be at least 2 characters"),
  role: yup
    .string()
    .oneOf(Object.keys(ROLES), "Invalid role")
    .required("Role is required"),
  fourDigitCode: yup.string().when("role", {
    is: "agent",
    then: (schema) =>
      schema
        .required("Four digit code is required for agents")
        .length(4, "Must be exactly 4 digits")
        .matches(/^\d{4}$/, "Must be 4 digits"),
    otherwise: (schema) => schema.notRequired(),
  }),
  password: yup.string().when("_isEditing", {
    is: false,
    then: (schema) =>
      schema
        .required("Password is required")
        .min(6, "Password must be at least 6 characters"),
    otherwise: (schema) => schema.notRequired(),
  }),
  newPassword: yup.string().when("_isEditing", {
    is: true,
    then: (schema) =>
      schema
        .optional()
        .nullable()
        .transform((value) => (value === "" ? undefined : value))
        .min(6, "Password must be at least 6 characters"),
    otherwise: (schema) => schema.notRequired(),
  }),
  isActive: yup.boolean(),
  permissions: yup.object({
    canCreateOrders: yup.boolean(),
    canManageLeads: yup.boolean(),
    canManageRefunds: yup.boolean(),
  }),
});
const UserDialog = React.memo(
  ({
    open,
    onClose,
    onSubmit,
    isEditing,
    control,
    errors,
    isSubmitting,
    watchedRole,
    currentUser,
  }) => (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      TransitionComponent={Grow}
      TransitionProps={{ timeout: 300 }}
    >
      <DialogTitle>{isEditing ? "Edit User" : "Create User"}</DialogTitle>
      <form onSubmit={onSubmit}>
        <DialogContent>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Fade in timeout={500}>
              <Grid item xs={12}>
                <Controller
                  name="fullName"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Full Name"
                      fullWidth
                      error={!!errors.fullName}
                      helperText={errors.fullName?.message}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          transition: "all 0.2s ease-in-out",
                          "&:hover": {
                            transform: "translateY(-1px)",
                          },
                        },
                      }}
                    />
                  )}
                />
              </Grid>
            </Fade>
            <Fade in timeout={500}>
              <Grid item xs={12}>
                <Controller
                  name="email"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Email"
                      fullWidth
                      error={!!errors.email}
                      helperText={errors.email?.message}
                      disabled={isEditing && currentUser?.role !== "admin"}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          transition: "all 0.2s ease-in-out",
                          "&:hover": {
                            transform: "translateY(-1px)",
                          },
                        },
                      }}
                    />
                  )}
                />
              </Grid>
            </Fade>
            {!isEditing && (
              <Fade in timeout={500}>
                <Grid item xs={12}>
                  <Controller
                    name="password"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        type="password"
                        label="Password"
                        fullWidth
                        error={!!errors.password}
                        helperText={errors.password?.message}
                        sx={{
                          "& .MuiOutlinedInput-root": {
                            transition: "all 0.2s ease-in-out",
                            "&:hover": {
                              transform: "translateY(-1px)",
                            },
                          },
                        }}
                      />
                    )}
                  />
                </Grid>
              </Fade>
            )}
            {isEditing && currentUser?.role === "admin" && (
              <Fade in timeout={500}>
                <Grid item xs={12}>
                  <Controller
                    name="newPassword"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        type="password"
                        label="New Password (optional)"
                        fullWidth
                        error={!!errors.newPassword}
                        helperText={
                          errors.newPassword?.message ||
                          "Leave blank to keep current password"
                        }
                        sx={{
                          "& .MuiOutlinedInput-root": {
                            transition: "all 0.2s ease-in-out",
                            "&:hover": {
                              transform: "translateY(-1px)",
                            },
                          },
                        }}
                      />
                    )}
                  />
                </Grid>
              </Fade>
            )}
            <Fade in timeout={500}>
              <Grid item xs={12}>
                <Controller
                  name="role"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.role}>
                      <InputLabel>Role</InputLabel>
                      <Select {...field} label="Role">
                        {Object.entries(ROLES)
                          .filter(([key]) => key !== "pending_approval")
                          .map(([key, { label }]) => (
                            <MenuItem key={key} value={key}>
                              {label}
                            </MenuItem>
                          ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>
            </Fade>
            {watchedRole === "agent" && (
              <Fade in timeout={500}>
                <Grid item xs={12}>
                  <Controller
                    name="fourDigitCode"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Four Digit Code"
                        fullWidth
                        error={!!errors.fourDigitCode}
                        helperText={errors.fourDigitCode?.message}
                        sx={{
                          "& .MuiOutlinedInput-root": {
                            transition: "all 0.2s ease-in-out",
                            "&:hover": {
                              transform: "translateY(-1px)",
                            },
                          },
                        }}
                      />
                    )}
                  />
                </Grid>
              </Fade>
            )}
            <Fade in timeout={500}>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="isActive"
                  control={control}
                  render={({ field: { value, onChange } }) => (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={!!value}
                          onChange={(e) => onChange(e.target.checked)}
                        />
                      }
                      label="Active"
                    />
                  )}
                />
              </Grid>
            </Fade>
            <Fade in timeout={500}>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="permissions.canCreateOrders"
                  control={control}
                  render={({ field: { value, onChange } }) => (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={!!value}
                          onChange={(e) => onChange(e.target.checked)}
                        />
                      }
                      label="Can Create Orders"
                    />
                  )}
                />
              </Grid>
            </Fade>
            {(watchedRole === "lead_manager" || watchedRole === "admin") && (
              <Fade in timeout={500}>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="permissions.canManageLeads"
                    control={control}
                    render={({ field: { value, onChange } }) => (
                      <FormControlLabel
                        control={
                          <Switch
                            checked={!!value}
                            onChange={(e) => onChange(e.target.checked)}
                          />
                        }
                        label="Can Manage Leads"
                      />
                    )}
                  />
                </Grid>
              </Fade>
            )}
            {watchedRole === "affiliate_manager" && (
              <Fade in timeout={500}>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="permissions.canManageRefunds"
                    control={control}
                    render={({ field: { value, onChange } }) => (
                      <FormControlLabel
                        control={
                          <Switch
                            checked={!!value}
                            onChange={(e) => onChange(e.target.checked)}
                          />
                        }
                        label="Can Manage Refunds"
                      />
                    )}
                  />
                </Grid>
              </Fade>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting}
            sx={{
              position: "relative",
              overflow: "hidden",
              "&::after": {
                content: '""',
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                background:
                  "linear-gradient(45deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)",
                transform: "translateX(-100%)",
                transition: "transform 0.3s ease-in-out",
              },
              "&:hover::after": {
                transform: "translateX(100%)",
              },
            }}
          >
            {isSubmitting ? (
              <CircularProgress size={24} />
            ) : isEditing ? (
              "Update"
            ) : (
              "Create"
            )}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
);
const UsersPage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const currentUser = useSelector(selectUser);
  const [searchParams, setSearchParams] = useSearchParams();
  const { executeSensitiveAction, sensitiveActionState, resetSensitiveAction } =
    useSensitiveAction();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [dialogState, setDialogState] = useState({ type: null, user: null });
  const [totalUsers, setTotalUsers] = useState(0);
  const [filters, setFilters] = useState({
    role: "",
    isActive: "true",
    status: "",
  });
  // Initialize search from URL params (for global search integration)
  const [searchValue, setSearchValue] = useState(() => searchParams.get("search") || "");
  
  // Clear URL params after initial load
  useEffect(() => {
    if (searchParams.get("search")) {
      const timer = setTimeout(() => {
        setSearchParams({}, { replace: true });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(userSchema),
    defaultValues: {
      email: "",
      fullName: "",
      role: "agent",
      fourDigitCode: "",
      password: "",
      newPassword: "",
      isActive: true,
      permissions: {
        canCreateOrders: true,
        canManageLeads: false,
        canManageRefunds: false,
      },
      _isEditing: false,
    },
  });
  const watchedRole = watch("role");
  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };
  const showSuccess = (message) => {
    setSuccess(message);
    setTimeout(() => setSuccess(null), 4000);
  };
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    clearMessages();
    try {
      const queryParams = { limit: 10000, ...filters };
      const activeParams = Object.fromEntries(
        Object.entries(queryParams).filter(([, v]) => v !== "")
      );
      const response = await api.get("/users", { params: activeParams });
      setUsers(response.data.data);
      setTotalUsers(response.data.pagination?.totalUsers || 0);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }, [filters]);
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);
  useEffect(() => {
    const { type, user } = dialogState;
    if (type === "user") {
      const isEditing = !!user;
      reset({
        email: user?.email || "",
        fullName: user?.fullName || "",
        role: user?.role || "agent",
        fourDigitCode: user?.fourDigitCode || "",
        password: "",
        newPassword: "",
        isActive: user ? user.isActive : true,
        permissions: user?.permissions || {
          canCreateOrders: true,
          canManageLeads: false,
          canManageRefunds: false,
        },
        _isEditing: isEditing,
      });
    }
  }, [dialogState, reset]);
  const handleDialogClose = useCallback(() => {
    setDialogState({ type: null, user: null });
  }, []);
  const onSubmitUser = useCallback(
    async (data) => {
      clearMessages();
      const isEditing = !!dialogState.user;
      try {
        const userData = {
          email: data.email,
          fullName: data.fullName,
          role: data.role,
          isActive: data.isActive,
        };
        if (data.role === "agent" && data.fourDigitCode) {
          userData.fourDigitCode = data.fourDigitCode;
        }
        if (!isEditing && data.password) {
          userData.password = data.password;
        }
        const permissionsData = {
          permissions: {
            canCreateOrders: data.permissions.canCreateOrders,
            canManageLeads:
              data.role === "lead_manager" || data.permissions.canManageLeads,
            canManageRefunds: data.permissions.canManageRefunds,
          },
        };
        if (isEditing) {
          await api.put(`/users/${dialogState.user._id}`, userData);
          await api.put(
            `/users/${dialogState.user._id}/permissions`,
            permissionsData
          );

          // Handle admin password change
          if (
            currentUser?.role === "admin" &&
            data.newPassword &&
            data.newPassword.trim() !== ""
          ) {
            await executeSensitiveAction({
              actionName: "Change User Password",
              actionDescription: `Changing password for ${dialogState.user.fullName}`,
              apiCall: (headers) =>
                api.put(
                  `/users/${dialogState.user._id}/password`,
                  {
                    newPassword: data.newPassword,
                  },
                  { headers }
                ),
            });
          }

          showSuccess("User updated successfully!");
        } else {
          await executeSensitiveAction({
            actionName: "Create User",
            actionDescription: `Creating new user ${data.fullName} (${data.role})`,
            apiCall: (headers) =>
              api.post(
                "/users",
                { ...userData, ...permissionsData },
                { headers }
              ),
          });
          showSuccess("User created successfully!");
        }
        handleDialogClose();
        fetchUsers();
      } catch (err) {
        if (err.message !== "User cancelled sensitive action") {
          setError(err.response?.data?.message || "Failed to save user.");
        }
      }
    },
    [
      dialogState.user,
      fetchUsers,
      handleDialogClose,
      currentUser,
      executeSensitiveAction,
    ]
  );
  const handleDeactivateUser = useCallback(async () => {
    clearMessages();
    try {
      await executeSensitiveAction({
        actionName: "Deactivate User",
        actionDescription: `Deactivating user ${dialogState.user.fullName}`,
        apiCall: (headers) =>
          api.delete(`/users/${dialogState.user._id}`, { headers }),
      });
      showSuccess("User deactivated successfully!");
      handleDialogClose();
      fetchUsers();
    } catch (err) {
      if (err.message !== "User cancelled sensitive action") {
        setError(err.response?.data?.message || "Failed to deactivate user.");
      }
    }
  }, [dialogState.user, fetchUsers, handleDialogClose, executeSensitiveAction]);

  const handlePermanentDeleteUser = useCallback(async () => {
    clearMessages();
    try {
      await executeSensitiveAction({
        actionName: "Delete User",
        actionDescription: `Permanently deleting user ${dialogState.user.fullName}`,
        apiCall: (headers) =>
          api.delete(`/users/${dialogState.user._id}/permanent`, { headers }),
      });
      showSuccess("User permanently deleted successfully!");
      handleDialogClose();
      fetchUsers();
    } catch (err) {
      if (err.message !== "User cancelled sensitive action") {
        setError(
          err.response?.data?.message || "Failed to permanently delete user."
        );
      }
    }
  }, [dialogState.user, fetchUsers, handleDialogClose, executeSensitiveAction]);

  const handleKickSession = useCallback(async () => {
    clearMessages();
    try {
      await executeSensitiveAction({
        actionName: "Kick Session",
        actionDescription: `Kicking session for ${dialogState.user.fullName}`,
        apiCall: (headers) =>
          api.post(
            `/users/${dialogState.user._id}/kick-session`,
            {},
            { headers }
          ),
      });
      showSuccess(
        `Session kicked for ${dialogState.user.fullName}. They will need to log in again.`
      );
      handleDialogClose();
    } catch (err) {
      if (err.message !== "User cancelled sensitive action") {
        setError(err.response?.data?.message || "Failed to kick user session.");
      }
    }
  }, [dialogState.user, handleDialogClose, executeSensitiveAction]);
  const handleApproveUser = useCallback(
    async (role) => {
      clearMessages();
      try {
        await api.put(`/users/${dialogState.user._id}/approve`, { role });
        showSuccess("User approved successfully!");
        handleDialogClose();
        fetchUsers();
      } catch (err) {
        setError(err.response?.data?.message || "Failed to approve user.");
      }
    },
    [dialogState.user, fetchUsers, handleDialogClose]
  );
  const handleFilterChange = useCallback(
    (field) => (event) => {
      setFilters((prev) => ({ ...prev, [field]: event.target.value }));
    },
    []
  );
  const handleSearchChange = (event) => {
    setSearchValue(event.target.value);
  };

  const clearFilters = useCallback(() => {
    setFilters({ role: "", isActive: "true", status: "" });
    setSearchValue("");
  }, []);
  const canManageUsers = useMemo(
    () => currentUser?.role === "admin",
    [currentUser]
  );

  // Client-side filtering for search to avoid re-fetching on every keystroke
  const filteredUsers = useMemo(() => {
    if (!searchValue.trim()) return users;
    
    const searchLower = searchValue.toLowerCase();
    return users.filter(user => 
      user.fullName?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower)
    );
  }, [users, searchValue]);
  if (!canManageUsers) {
    return (
      <Box p={3}>
        <Alert severity="error">
          You do not have permission to access this page.
        </Alert>
      </Box>
    );
  }
  return (
    <Box sx={{ width: "100%", typography: "body1" }}>
      {success && (
        <Alert
          severity="success"
          sx={{ mb: 2 }}
          onClose={() => setSuccess(null)}
        >
          {success}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      <StyledCard sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  placeholder="Search by name or email..."
                  value={searchValue}
                  onChange={handleSearchChange}
                  InputProps={{
                    startAdornment: (
                      <SearchIcon sx={{ color: "text.secondary", mr: 1 }} />
                    ),
                  }}
                  size="small"
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      bgcolor: "background.paper",
                    },
                  }}
                />
              </Grid>
              <Grid item xs={6} sm={3} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Role</InputLabel>
                  <Select
                    value={filters.role}
                    label="Role"
                    onChange={handleFilterChange("role")}
                  >
                    <MenuItem value="">All Roles</MenuItem>
                    {Object.entries(ROLES).map(([key, { label }]) => (
                      <MenuItem key={key} value={key}>
                        {label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} sm={3} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={filters.status}
                    label="Status"
                    onChange={handleFilterChange("status")}
                  >
                    <MenuItem value="">All Statuses</MenuItem>
                    {Object.entries(STATUSES).map(([key, { label }]) => (
                      <MenuItem key={key} value={key}>
                        {label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} sm={3} md={1.5}>
                <FormControl fullWidth size="small">
                  <InputLabel>Activity</InputLabel>
                  <Select
                    value={filters.isActive}
                    label="Activity"
                    onChange={handleFilterChange("isActive")}
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="true">Active</MenuItem>
                    <MenuItem value="false">Inactive</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} sm={3} md={1.5}>
                <Button
                  onClick={clearFilters}
                  variant="outlined"
                  fullWidth
                  size="small"
                  sx={{ height: "40px" }}
                >
                  Clear
                </Button>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <Button
                  variant="contained"
                  fullWidth
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setDialogState({ type: "user", user: null })}
                  sx={{
                    height: "40px",
                    background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                    transition: "all 0.3s ease-in-out",
                    "&:hover": {
                      transform: "translateY(-2px)",
                      boxShadow: theme.shadows[8],
                    },
                  }}
                >
                  Add User
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </StyledCard>
      <Paper
        elevation={3}
        sx={{
          background: alpha(theme.palette.background.paper, 0.8),
          backdropFilter: "blur(10px)",
        }}
      >
          <TableContainer>
            <Table size="small" sx={{ tableLayout: "fixed", width: "100%" }}>
              <TableHead>
                <TableRow>
                  <TableCell
                    sx={{ 
                      fontWeight: "bold", 
                      backgroundColor: "grey.200",
                      width: "20%",
                    }}
                  >
                    User
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      backgroundColor: "grey.200",
                      textAlign: "center",
                      width: "10%",
                    }}
                  >
                    Role
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      backgroundColor: "grey.200",
                      textAlign: "center",
                      width: "10%",
                    }}
                  >
                    Status
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      backgroundColor: "grey.200",
                      textAlign: "center",
                      width: "15%",
                    }}
                  >
                    Permissions
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      backgroundColor: "grey.200",
                      textAlign: "center",
                      width: "10%",
                    }}
                  >
                    Agent Code
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      backgroundColor: "grey.200",
                      textAlign: "center",
                      width: "10%",
                    }}
                  >
                    Activity
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      backgroundColor: "grey.200",
                      textAlign: "center",
                      width: "10%",
                    }}
                  >
                    Created
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: "bold",
                      backgroundColor: "grey.200",
                      textAlign: "right",
                      width: "15%",
                    }}
                  >
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                      <CircularProgress
                        sx={{
                          animation: "pulse 1.5s ease-in-out infinite",
                          "@keyframes pulse": {
                            "0%": { transform: "scale(0.95)" },
                            "50%": { transform: "scale(1.05)" },
                            "100%": { transform: "scale(0.95)" },
                          },
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                      <Typography variant="body1" color="text.secondary">
                        {searchValue ? "No users match your search." : "No users found."}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user, index) => {
                    const roleInfo = ROLES[user.role] || ROLES.pending_approval;
                    const statusInfo =
                      STATUSES[user.status] || STATUSES.pending;
                    return (
                      <StyledTableRow hover key={user._id}>
                          <TableCell>
                            <Box>
                              <Typography variant="body2" fontWeight={500}>
                                {user.fullName}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {user.email}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell align="center">
                            <StyledChip
                              label={roleInfo.label}
                              color={roleInfo.color}
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <StyledChip
                              label={statusInfo.label}
                              color={statusInfo.color}
                              size="small"
                              icon={statusInfo.icon}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Stack
                              direction="row"
                              spacing={1}
                              justifyContent="center"
                            >
                              {user.permissions?.canCreateOrders && (
                                <StyledChip
                                  label="Orders"
                                  size="small"
                                  variant="outlined"
                                />
                              )}
                              {user.permissions?.canManageLeads && (
                                <StyledChip
                                  label="Leads"
                                  size="small"
                                  variant="outlined"
                                />
                              )}
                              {user.permissions?.canManageRefunds && (
                                <StyledChip
                                  label="Refunds"
                                  size="small"
                                  variant="outlined"
                                />
                              )}
                            </Stack>
                          </TableCell>
                          <TableCell align="center">
                            {user.fourDigitCode ? (
                              <StyledChip
                                label={user.fourDigitCode}
                                variant="outlined"
                                size="small"
                              />
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell align="center">
                            <StyledChip
                              label={user.isActive ? "Active" : "Inactive"}
                              color={user.isActive ? "success" : "error"}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="center">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                              {user.status === "pending" && (
                                <Tooltip title="Approve User" arrow>
                                  <AnimatedIconButton
                                    size="small"
                                    onClick={() =>
                                      setDialogState({ type: "approve", user })
                                    }
                                    color="success"
                                  >
                                    <CheckCircleIcon />
                                  </AnimatedIconButton>
                                </Tooltip>
                              )}
                              <Tooltip title="Edit User" arrow>
                                <AnimatedIconButton
                                  size="small"
                                  onClick={() =>
                                    setDialogState({ type: "user", user })
                                  }
                                >
                                  <EditIcon />
                                </AnimatedIconButton>
                              </Tooltip>
                              <Tooltip
                                title={
                                  user._id === currentUser?.id
                                    ? "Kick My Session"
                                    : "Kick Session"
                                }
                                arrow
                              >
                                <AnimatedIconButton
                                  size="small"
                                  onClick={() =>
                                    setDialogState({ type: "kick", user })
                                  }
                                  color="warning"
                                >
                                  <LogoutIcon />
                                </AnimatedIconButton>
                              </Tooltip>
                              {user._id !== currentUser?.id && (
                                <Tooltip title="Delete Options" arrow>
                                  <AnimatedIconButton
                                    size="small"
                                    onClick={() =>
                                      setDialogState({ type: "delete", user })
                                    }
                                    color="error"
                                  >
                                    <DeleteIcon />
                                  </AnimatedIconButton>
                                </Tooltip>
                              )}
                            </Stack>
                          </TableCell>
                        </StyledTableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      {}
      <UserDialog
        open={dialogState.type === "user"}
        onClose={handleDialogClose}
        onSubmit={handleSubmit(onSubmitUser)}
        isEditing={!!dialogState.user}
        control={control}
        errors={errors}
        isSubmitting={isSubmitting}
        watchedRole={watchedRole}
        currentUser={currentUser}
      />
      <SensitiveActionModal
        open={sensitiveActionState.showModal}
        onClose={resetSensitiveAction}
        onVerify={(code, useBackup) =>
          sensitiveActionState.handleVerify(code, useBackup)
        }
        onQRVerify={(token) => sensitiveActionState.handleQRVerify(token)}
        actionName={sensitiveActionState.actionName}
        actionDescription={sensitiveActionState.actionDescription}
        loading={sensitiveActionState.verifying}
        error={sensitiveActionState.error}
        requires2FASetup={sensitiveActionState.requires2FASetup}
        userId={sensitiveActionState.userId}
        qrAuthEnabled={sensitiveActionState.qrAuthEnabled}
      />
      <Dialog
        open={dialogState.type === "delete"}
        onClose={handleDialogClose}
        maxWidth="sm"
        TransitionComponent={Grow}
        TransitionProps={{ timeout: 300 }}
      >
        <DialogTitle>Delete User Options</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom sx={{ mb: 2 }}>
            Choose an action for user "{dialogState.user?.fullName}":
          </Typography>

          <Stack spacing={3}>
            <Box
              sx={{
                p: 2,
                border: 1,
                borderColor: "warning.main",
                borderRadius: 1,
                backgroundColor: alpha(theme.palette.warning.main, 0.05),
              }}
            >
              <Typography variant="h6" gutterBottom color="warning.main">
                Deactivate User
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Temporarily disable the user account. The user will not be able
                to log in, but all their data will be preserved and the account
                can be reactivated later.
              </Typography>
              <Button
                onClick={handleDeactivateUser}
                variant="contained"
                color="warning"
                fullWidth
                sx={{
                  transition: "all 0.2s ease-in-out",
                  "&:hover": {
                    transform: "scale(1.02)",
                  },
                }}
              >
                Deactivate User
              </Button>
            </Box>

            <Box
              sx={{
                p: 2,
                border: 1,
                borderColor: "error.main",
                borderRadius: 1,
                backgroundColor: alpha(theme.palette.error.main, 0.05),
              }}
            >
              <Typography variant="h6" gutterBottom color="error.main">
                Permanently Delete User
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                <strong>Warning:</strong> This action cannot be undone! The user
                and all associated data will be permanently removed from the
                database.
              </Typography>
              <Button
                onClick={handlePermanentDeleteUser}
                variant="contained"
                color="error"
                fullWidth
                sx={{
                  transition: "all 0.2s ease-in-out",
                  "&:hover": {
                    transform: "scale(1.02)",
                  },
                }}
              >
                Permanently Delete User
              </Button>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>Cancel</Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={dialogState.type === "approve"}
        onClose={handleDialogClose}
        maxWidth="xs"
      >
        <DialogTitle>Approve User</DialogTitle>
        <DialogContent>
          <Typography>
            Approve "{dialogState.user?.fullName}" and assign a role:
          </Typography>
          <Stack spacing={1} sx={{ mt: 2 }}>
            {Object.entries(ROLES)
              .filter(([key]) => !["pending_approval"].includes(key))
              .map(([key, { label, icon }]) => (
                <Button
                  key={key}
                  variant="outlined"
                  onClick={() => handleApproveUser(key)}
                  startIcon={icon}
                >
                  {label}
                </Button>
              ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>Cancel</Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={dialogState.type === "kick"}
        onClose={handleDialogClose}
        maxWidth="sm"
        TransitionComponent={Grow}
        TransitionProps={{ timeout: 300 }}
      >
        <DialogTitle>
          {dialogState.user?._id === currentUser?.id
            ? "Kick My Session"
            : "Kick User Session"}
        </DialogTitle>
        <DialogContent>
          <Box
            sx={{
              p: 2,
              border: 1,
              borderColor:
                dialogState.user?._id === currentUser?.id
                  ? "error.main"
                  : "warning.main",
              borderRadius: 1,
              backgroundColor: alpha(
                dialogState.user?._id === currentUser?.id
                  ? theme.palette.error.main
                  : theme.palette.warning.main,
                0.05
              ),
            }}
          >
            {dialogState.user?._id === currentUser?.id ? (
              <>
                <Typography variant="body1" gutterBottom>
                  Are you sure you want to kick your own session?
                </Typography>
                <Typography
                  variant="body2"
                  color="error"
                  sx={{ mt: 1, fontWeight: "bold" }}
                >
                  Warning: You will be immediately logged out and redirected to
                  the login page.
                </Typography>
              </>
            ) : (
              <>
                <Typography variant="body1" gutterBottom>
                  Are you sure you want to kick the session for "
                  {dialogState.user?.fullName}"?
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 1 }}
                >
                  This will immediately log out the user from all devices and
                  invalidate their current session. They will need to log in
                  again to access the system.
                </Typography>
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>Cancel</Button>
          <Button
            onClick={handleKickSession}
            variant="contained"
            color={
              dialogState.user?._id === currentUser?.id ? "error" : "warning"
            }
            startIcon={<LogoutIcon />}
            sx={{
              transition: "all 0.2s ease-in-out",
              "&:hover": {
                transform: "scale(1.02)",
              },
            }}
          >
            {dialogState.user?._id === currentUser?.id
              ? "Kick My Session"
              : "Kick Session"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
export default UsersPage;
