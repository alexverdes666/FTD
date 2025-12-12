import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSelector } from "react-redux";
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
  Avatar,
  Tooltip,
  Fade,
  Grow,
  useTheme,
  alpha,
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
} from "@mui/icons-material";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import api from "../services/api";
import { selectUser } from "../store/slices/authSlice";
const StyledCard = styled(Card)(({ theme }) => ({
  background: alpha(theme.palette.background.paper, 0.8),
  backdropFilter: "blur(10px)",
  transition: "all 0.3s ease-in-out",
  "&:hover": {
    transform: "translateY(-2px)",
    boxShadow: theme.shadows[8],
  },
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
const StyledAvatar = styled(Avatar)(({ theme }) => ({
  transition: "all 0.2s ease-in-out",
  "&:hover": {
    transform: "scale(1.1) rotate(5deg)",
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
  const currentUser = useSelector(selectUser);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [dialogState, setDialogState] = useState({ type: null, user: null });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalUsers, setTotalUsers] = useState(0);
  const [filters, setFilters] = useState({
    role: "",
    isActive: "true",
    status: "",
  });
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
      permissions: { canCreateOrders: true, canManageLeads: false, canManageRefunds: false },
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
      const queryParams = { page: page + 1, limit: rowsPerPage, ...filters };
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
  }, [page, rowsPerPage, filters]);
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
            await api.put(`/users/${dialogState.user._id}/password`, {
              newPassword: data.newPassword,
            });
          }

          showSuccess("User updated successfully!");
        } else {
          await api.post("/users", { ...userData, ...permissionsData });
          showSuccess("User created successfully!");
        }
        handleDialogClose();
        fetchUsers();
      } catch (err) {
        setError(err.response?.data?.message || "Failed to save user.");
      }
    },
    [dialogState.user, fetchUsers, handleDialogClose]
  );
  const handleDeactivateUser = useCallback(async () => {
    clearMessages();
    try {
      await api.delete(`/users/${dialogState.user._id}`);
      showSuccess("User deactivated successfully!");
      handleDialogClose();
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to deactivate user.");
    }
  }, [dialogState.user, fetchUsers, handleDialogClose]);

  const handlePermanentDeleteUser = useCallback(async () => {
    clearMessages();
    try {
      await api.delete(`/users/${dialogState.user._id}/permanent`);
      showSuccess("User permanently deleted successfully!");
      handleDialogClose();
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to permanently delete user.");
    }
  }, [dialogState.user, fetchUsers, handleDialogClose]);

  const handleKickSession = useCallback(async () => {
    clearMessages();
    try {
      await api.post(`/users/${dialogState.user._id}/kick-session`);
      showSuccess(`Session kicked for ${dialogState.user.fullName}. They will need to log in again.`);
      handleDialogClose();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to kick user session.");
    }
  }, [dialogState.user, handleDialogClose]);
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
  const handleChangePage = useCallback((_, newPage) => setPage(newPage), []);
  const handleChangeRowsPerPage = useCallback((event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }, []);
  const handleFilterChange = useCallback(
    (field) => (event) => {
      setFilters((prev) => ({ ...prev, [field]: event.target.value }));
      setPage(0);
    },
    []
  );
  const clearFilters = useCallback(() => {
    setFilters({ role: "", isActive: "true", status: "" });
    setPage(0);
  }, []);
  const canManageUsers = useMemo(
    () => currentUser?.role === "admin",
    [currentUser]
  );
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
    <Box p={3}>
      <Fade in timeout={800}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          mb={3}
        >
          <Typography
            variant="h4"
            sx={{
              position: "relative",
              "&::after": {
                content: '""',
                position: "absolute",
                bottom: -4,
                left: 0,
                width: "50%",
                height: 2,
                backgroundColor: theme.palette.primary.main,
                transition: "width 0.3s ease-in-out",
              },
              "&:hover::after": {
                width: "100%",
              },
            }}
          >
            User Management
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDialogState({ type: "user", user: null })}
            sx={{
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
        </Stack>
      </Fade>
      {success && (
        <Grow in timeout={500}>
          <Alert
            severity="success"
            sx={{
              mb: 2,
              animation: "slideIn 0.5s ease-out",
              "@keyframes slideIn": {
                from: { transform: "translateX(-100%)" },
                to: { transform: "translateX(0)" },
              },
            }}
            onClose={() => setSuccess(null)}
          >
            {success}
          </Alert>
        </Grow>
      )}
      {error && (
        <Grow in timeout={500}>
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        </Grow>
      )}
      <Fade in timeout={1000}>
        <StyledCard sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Filters
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4} md={3}>
                <FormControl fullWidth>
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
              <Grid item xs={12} sm={4} md={3}>
                <FormControl fullWidth>
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
              <Grid item xs={12} sm={4} md={3}>
                <FormControl fullWidth>
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
              <Grid item xs={12} sm={12} md={3}>
                <Button
                  onClick={clearFilters}
                  variant="outlined"
                  fullWidth
                  sx={{ height: "100%" }}
                >
                  Clear Filters
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </StyledCard>
      </Fade>
      <Fade in timeout={1200}>
        <Paper
          elevation={3}
          sx={{
            background: alpha(theme.palette.background.paper, 0.8),
            backdropFilter: "blur(10px)",
          }}
        >
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Permissions</TableCell>
                  <TableCell>Agent Code</TableCell>
                  <TableCell>Activity</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Actions</TableCell>
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
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                      <Typography variant="body1" color="text.secondary">
                        No users found.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user, index) => {
                    const roleInfo = ROLES[user.role] || ROLES.pending_approval;
                    const statusInfo =
                      STATUSES[user.status] || STATUSES.pending;
                    return (
                      <Grow in timeout={500 + index * 100} key={user._id}>
                        <StyledTableRow hover>
                          <TableCell>
                            <Stack
                              direction="row"
                              alignItems="center"
                              spacing={1.5}
                            >
                              <StyledAvatar
                                sx={{
                                  bgcolor: `${roleInfo.color}.lighter`,
                                  color: `${roleInfo.color}.dark`,
                                }}
                              >
                                {roleInfo.icon}
                              </StyledAvatar>
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
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <StyledChip
                              label={roleInfo.label}
                              color={roleInfo.color}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <StyledChip
                              label={statusInfo.label}
                              color={statusInfo.color}
                              size="small"
                              icon={statusInfo.icon}
                            />
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1}>
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
                          <TableCell>
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
                          <TableCell>
                            <StyledChip
                              label={user.isActive ? "Active" : "Inactive"}
                              color={user.isActive ? "success" : "error"}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            {new Date(user.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={0.5}>
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
                              <Tooltip title={user._id === currentUser?.id ? "Kick My Session" : "Kick Session"} arrow>
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
                      </Grow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={totalUsers}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </Paper>
      </Fade>
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
                Temporarily disable the user account. The user will not be able to log in, 
                but all their data will be preserved and the account can be reactivated later.
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
                <strong>Warning:</strong> This action cannot be undone! The user and all 
                associated data will be permanently removed from the database.
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
          {dialogState.user?._id === currentUser?.id ? "Kick My Session" : "Kick User Session"}
        </DialogTitle>
        <DialogContent>
          <Box
            sx={{
              p: 2,
              border: 1,
              borderColor: dialogState.user?._id === currentUser?.id ? "error.main" : "warning.main",
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
                <Typography variant="body2" color="error" sx={{ mt: 1, fontWeight: 'bold' }}>
                  Warning: You will be immediately logged out and redirected to the login page.
                </Typography>
              </>
            ) : (
              <>
                <Typography variant="body1" gutterBottom>
                  Are you sure you want to kick the session for "{dialogState.user?.fullName}"?
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  This will immediately log out the user from all devices and invalidate their current session.
                  They will need to log in again to access the system.
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
            color={dialogState.user?._id === currentUser?.id ? "error" : "warning"}
            startIcon={<LogoutIcon />}
            sx={{
              transition: "all 0.2s ease-in-out",
              "&:hover": {
                transform: "scale(1.02)",
              },
            }}
          >
            {dialogState.user?._id === currentUser?.id ? "Kick My Session" : "Kick Session"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
export default UsersPage;
