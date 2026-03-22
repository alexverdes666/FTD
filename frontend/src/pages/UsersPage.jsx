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
  Avatar,
  Breadcrumbs,
  Link,
  InputAdornment,
  Skeleton,
  Divider,
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
  People as PeopleIcon,
  PersonAdd as PersonAddIcon,
  FileDownload as ExportIcon,
  NavigateNext as NavigateNextIcon,
  Dashboard as DashboardIcon,
  Circle as CircleIcon,
  FilterListOff as ClearFilterIcon,
  Visibility as ViewIcon,
  GroupWork as GroupWorkIcon,
} from "@mui/icons-material";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import api from "../services/api";
import { selectUser } from "../store/slices/authSlice";
import useSensitiveAction from "../hooks/useSensitiveAction";
import SensitiveActionModal from "../components/SensitiveActionModal";

// Design constants
const PRIMARY = "#1e3a5f";
const ACCENT = "#f57c00";
const RADIUS = "12px";

// Role color mapping for badges
const ROLE_COLORS = {
  admin: { bg: "#f3e5f5", text: "#7b1fa2", border: "#ce93d8" },
  affiliate_manager: { bg: "#e3f2fd", text: "#1565c0", border: "#90caf9" },
  lead_manager: { bg: "#e8f5e9", text: "#2e7d32", border: "#a5d6a7" },
  refunds_manager: { bg: "#e0f7fa", text: "#00838f", border: "#80deea" },
  inventory_manager: { bg: "#fff3e0", text: "#e65100", border: "#ffcc80" },
  agent: { bg: "#e8eaf6", text: "#283593", border: "#9fa8da" },
  pending_approval: { bg: "#f5f5f5", text: "#616161", border: "#e0e0e0" },
};

// Stat card accent colors
const STAT_COLORS = {
  total: PRIMARY,
  active: "#2e7d32",
  admin: "#7b1fa2",
  agent: "#283593",
  manager: "#e65100",
  inactive: "#d32f2f",
};

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  transition: "all 0.2s ease-in-out",
  "&:hover": {
    backgroundColor: alpha(theme.palette.primary.main, 0.04),
  },
  "& td": {
    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
  },
}));

const AnimatedIconButton = styled(IconButton)(({ theme }) => ({
  transition: "all 0.2s ease-in-out",
  "&:hover": {
    transform: "scale(1.1)",
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

// Helper: get initials from full name
const getInitials = (name) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// Helper: avatar background color from name
const getAvatarColor = (name) => {
  if (!name) return PRIMARY;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    "#1e3a5f", "#7b1fa2", "#2e7d32", "#c62828",
    "#00838f", "#e65100", "#283593", "#4e342e",
  ];
  return colors[Math.abs(hash) % colors.length];
};

// Helper: relative time
const getRelativeTime = (dateStr) => {
  if (!dateStr) return "Never";
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

// Stat Card component
const StatCard = ({ label, value, color, icon }) => (
  <Box
    sx={{
      display: "flex",
      alignItems: "center",
      gap: 1.5,
      px: 2,
      py: 1.5,
      bgcolor: "background.paper",
      borderRadius: RADIUS,
      borderLeft: `4px solid ${color}`,
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      minWidth: 120,
      flex: "1 1 0",
    }}
  >
    <Box sx={{ color, display: "flex", alignItems: "center" }}>{icon}</Box>
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.1, color: PRIMARY }}>
        {value}
      </Typography>
      <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.7rem", whiteSpace: "nowrap" }}>
        {label}
      </Typography>
    </Box>
  </Box>
);

// Loading skeleton for the table
const TableSkeleton = () => (
  <>
    {[...Array(6)].map((_, i) => (
      <TableRow key={i}>
        <TableCell>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Skeleton variant="circular" width={36} height={36} />
            <Box>
              <Skeleton width={120} height={16} />
              <Skeleton width={160} height={14} sx={{ mt: 0.5 }} />
            </Box>
          </Box>
        </TableCell>
        <TableCell align="center"><Skeleton width={80} height={24} sx={{ mx: "auto", borderRadius: 2 }} /></TableCell>
        <TableCell align="center"><Skeleton variant="circular" width={10} height={10} sx={{ mx: "auto" }} /></TableCell>
        <TableCell align="center"><Skeleton width={60} height={14} sx={{ mx: "auto" }} /></TableCell>
        <TableCell align="center">
          <Box sx={{ display: "flex", gap: 0.5, justifyContent: "center" }}>
            <Skeleton variant="circular" width={28} height={28} />
            <Skeleton variant="circular" width={28} height={28} />
            <Skeleton variant="circular" width={28} height={28} />
          </Box>
        </TableCell>
      </TableRow>
    ))}
  </>
);

// Role badge component
const RoleBadge = ({ role }) => {
  const colors = ROLE_COLORS[role] || ROLE_COLORS.pending_approval;
  const roleInfo = ROLES[role] || ROLES.pending_approval;
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        px: 1.5,
        py: 0.4,
        borderRadius: "20px",
        bgcolor: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
        fontSize: "0.75rem",
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {roleInfo.label}
    </Box>
  );
};

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
      PaperProps={{
        sx: {
          borderRadius: RADIUS,
          overflow: "hidden",
        },
      }}
    >
      <DialogTitle
        sx={{
          background: `linear-gradient(135deg, ${PRIMARY}, ${alpha(PRIMARY, 0.85)})`,
          color: "white",
          py: 2,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {isEditing ? <EditIcon /> : <PersonAddIcon />}
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {isEditing ? "Edit User" : "Create New User"}
          </Typography>
        </Box>
      </DialogTitle>
      <form onSubmit={onSubmit}>
        <DialogContent sx={{ pt: 3 }}>
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
                          borderRadius: "8px",
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
                          borderRadius: "8px",
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
                            borderRadius: "8px",
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
                            borderRadius: "8px",
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
                      <Select
                        {...field}
                        label="Role"
                        sx={{ borderRadius: "8px" }}
                      >
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
                            borderRadius: "8px",
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
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} sx={{ borderRadius: "8px" }}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting}
            sx={{
              borderRadius: "8px",
              background: `linear-gradient(135deg, ${PRIMARY}, ${alpha(PRIMARY, 0.85)})`,
              px: 3,
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
              <CircularProgress size={24} sx={{ color: "white" }} />
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
  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

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
      setPage(0);
    },
    []
  );
  const handleSearchChange = (event) => {
    setSearchValue(event.target.value);
    setPage(0);
  };

  const clearFilters = useCallback(() => {
    setFilters({ role: "", isActive: "true", status: "" });
    setSearchValue("");
    setPage(0);
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

  // Computed stats
  const stats = useMemo(() => {
    const activeCount = users.filter((u) => u.isActive).length;
    const adminCount = users.filter((u) => u.role === "admin").length;
    const agentCount = users.filter((u) => u.role === "agent").length;
    const managerCount = users.filter(
      (u) =>
        u.role === "affiliate_manager" ||
        u.role === "lead_manager" ||
        u.role === "refunds_manager" ||
        u.role === "inventory_manager"
    ).length;
    const inactiveCount = users.filter((u) => !u.isActive).length;
    return { activeCount, adminCount, agentCount, managerCount, inactiveCount };
  }, [users]);

  // Paginated users
  const paginatedUsers = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredUsers.slice(start, start + rowsPerPage);
  }, [filteredUsers, page, rowsPerPage]);

  // Export users to CSV
  const handleExport = useCallback(() => {
    if (!filteredUsers.length) return;
    const headers = ["Name", "Email", "Role", "Status", "Active", "Created"];
    const rows = filteredUsers.map((u) => [
      u.fullName,
      u.email,
      ROLES[u.role]?.label || u.role,
      STATUSES[u.status]?.label || u.status,
      u.isActive ? "Active" : "Inactive",
      new Date(u.createdAt).toLocaleDateString(),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredUsers]);

  if (!canManageUsers) {
    return (
      <Box p={3}>
        <Alert severity="error" sx={{ borderRadius: RADIUS }}>
          You do not have permission to access this page.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%", typography: "body1" }}>
      {/* Alerts */}
      {success && (
        <Alert
          severity="success"
          sx={{ mb: 2, borderRadius: RADIUS }}
          onClose={() => setSuccess(null)}
        >
          {success}
        </Alert>
      )}
      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2, borderRadius: RADIUS }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {/* Page Header */}
      <Box
        sx={{
          mb: 3,
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          justifyContent: "space-between",
          alignItems: isMobile ? "flex-start" : "center",
          gap: 2,
        }}
      >
        <Box>
          <Breadcrumbs
            separator={<NavigateNextIcon fontSize="small" />}
            sx={{ mb: 1 }}
          >
            <Link
              underline="hover"
              color="inherit"
              href="/dashboard"
              sx={{ display: "flex", alignItems: "center", gap: 0.5, fontSize: "0.85rem" }}
            >
              <DashboardIcon sx={{ fontSize: 16 }} />
              Dashboard
            </Link>
            <Typography color="text.primary" sx={{ display: "flex", alignItems: "center", gap: 0.5, fontSize: "0.85rem", fontWeight: 600 }}>
              <PeopleIcon sx={{ fontSize: 16 }} />
              Users
            </Typography>
          </Breadcrumbs>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: RADIUS,
                background: `linear-gradient(135deg, ${PRIMARY}, ${alpha(PRIMARY, 0.8)})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <PeopleIcon sx={{ color: "white", fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: PRIMARY, lineHeight: 1.2 }}>
                User Management
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Manage team members and permissions
              </Typography>
            </Box>
          </Box>
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            startIcon={<ExportIcon />}
            onClick={handleExport}
            sx={{
              borderRadius: "8px",
              borderColor: alpha(PRIMARY, 0.3),
              color: PRIMARY,
              textTransform: "none",
              fontWeight: 600,
              "&:hover": {
                borderColor: PRIMARY,
                bgcolor: alpha(PRIMARY, 0.04),
              },
            }}
          >
            Export
          </Button>
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={() => setDialogState({ type: "user", user: null })}
            sx={{
              borderRadius: "8px",
              background: `linear-gradient(135deg, ${PRIMARY}, ${alpha(PRIMARY, 0.85)})`,
              textTransform: "none",
              fontWeight: 600,
              px: 3,
              boxShadow: `0 4px 14px ${alpha(PRIMARY, 0.35)}`,
              "&:hover": {
                background: `linear-gradient(135deg, ${alpha(PRIMARY, 0.9)}, ${PRIMARY})`,
                boxShadow: `0 6px 20px ${alpha(PRIMARY, 0.45)}`,
                transform: "translateY(-1px)",
              },
              transition: "all 0.2s ease-in-out",
            }}
          >
            Add User
          </Button>
        </Stack>
      </Box>

      {/* Stats Bar */}
      <Box
        sx={{
          display: "flex",
          gap: 1.5,
          mb: 3,
          flexWrap: "wrap",
        }}
      >
        <StatCard
          label="Total Users"
          value={users.length}
          color={STAT_COLORS.total}
          icon={<PeopleIcon sx={{ fontSize: 20 }} />}
        />
        <StatCard
          label="Active"
          value={stats.activeCount}
          color={STAT_COLORS.active}
          icon={<CheckCircleIcon sx={{ fontSize: 20 }} />}
        />
        <StatCard
          label="Admins"
          value={stats.adminCount}
          color={STAT_COLORS.admin}
          icon={<AdminIcon sx={{ fontSize: 20 }} />}
        />
        <StatCard
          label="Agents"
          value={stats.agentCount}
          color={STAT_COLORS.agent}
          icon={<AgentIcon sx={{ fontSize: 20 }} />}
        />
        <StatCard
          label="Managers"
          value={stats.managerCount}
          color={STAT_COLORS.manager}
          icon={<ManagerIcon sx={{ fontSize: 20 }} />}
        />
        <StatCard
          label="Inactive"
          value={stats.inactiveCount}
          color={STAT_COLORS.inactive}
          icon={<RejectIcon sx={{ fontSize: 20 }} />}
        />
      </Box>

      {/* Search & Filters */}
      <Paper
        elevation={0}
        sx={{
          mb: 3,
          p: 2,
          borderRadius: RADIUS,
          border: `1px solid ${alpha(PRIMARY, 0.08)}`,
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        }}
      >
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              placeholder="Search by name or email..."
              value={searchValue}
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: alpha(PRIMARY, 0.4) }} />
                  </InputAdornment>
                ),
              }}
              size="small"
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "8px",
                  bgcolor: alpha(PRIMARY, 0.02),
                  "&:hover": {
                    bgcolor: alpha(PRIMARY, 0.04),
                  },
                  "&.Mui-focused": {
                    bgcolor: "background.paper",
                  },
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
                sx={{ borderRadius: "8px" }}
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
                sx={{ borderRadius: "8px" }}
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
          <Grid item xs={6} sm={3} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Activity</InputLabel>
              <Select
                value={filters.isActive}
                label="Activity"
                onChange={handleFilterChange("isActive")}
                sx={{ borderRadius: "8px" }}
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
              startIcon={<ClearFilterIcon />}
              sx={{
                height: "40px",
                borderRadius: "8px",
                textTransform: "none",
                borderColor: alpha(PRIMARY, 0.2),
                color: "text.secondary",
                "&:hover": {
                  borderColor: PRIMARY,
                  color: PRIMARY,
                },
              }}
            >
              Clear
            </Button>
          </Grid>
          <Grid item xs={12} md={1.5}>
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                height: "40px",
              }}
            >
              {filteredUsers.length} result{filteredUsers.length !== 1 ? "s" : ""}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Users Table */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: RADIUS,
          border: `1px solid ${alpha(PRIMARY, 0.08)}`,
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          overflow: "hidden",
        }}
      >
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow
                sx={{
                  bgcolor: alpha(PRIMARY, 0.03),
                  "& th": {
                    fontWeight: 700,
                    color: alpha(PRIMARY, 0.7),
                    fontSize: "0.75rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    borderBottom: `2px solid ${alpha(PRIMARY, 0.08)}`,
                    py: 1.5,
                  },
                }}
              >
                <TableCell sx={{ width: "25%", pl: 3 }}>User</TableCell>
                <TableCell align="center" sx={{ width: "14%" }}>Role</TableCell>
                <TableCell align="center" sx={{ width: "8%" }}>Status</TableCell>
                <TableCell align="center" sx={{ width: "13%" }}>Permissions</TableCell>
                <TableCell align="center" sx={{ width: "10%" }}>Agent Code</TableCell>
                <TableCell align="center" sx={{ width: "10%" }}>Created</TableCell>
                <TableCell align="center" sx={{ width: "20%", pr: 3 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableSkeleton />
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                      <Box
                        sx={{
                          width: 80,
                          height: 80,
                          borderRadius: "50%",
                          bgcolor: alpha(PRIMARY, 0.06),
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <PeopleIcon sx={{ fontSize: 40, color: alpha(PRIMARY, 0.25) }} />
                      </Box>
                      <Typography variant="h6" sx={{ color: "text.secondary", fontWeight: 500 }}>
                        {searchValue ? "No users match your search" : "No users found"}
                      </Typography>
                      <Typography variant="body2" sx={{ color: "text.disabled" }}>
                        {searchValue
                          ? "Try adjusting your search terms or filters"
                          : "Get started by adding your first team member"}
                      </Typography>
                      {!searchValue && (
                        <Button
                          variant="outlined"
                          startIcon={<PersonAddIcon />}
                          onClick={() => setDialogState({ type: "user", user: null })}
                          sx={{ mt: 1, borderRadius: "8px", textTransform: "none" }}
                        >
                          Add User
                        </Button>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedUsers.map((user) => {
                  const roleInfo = ROLES[user.role] || ROLES.pending_approval;
                  const statusInfo =
                    STATUSES[user.status] || STATUSES.pending;
                  return (
                    <StyledTableRow hover key={user._id}>
                      {/* User avatar + name + email */}
                      <TableCell sx={{ pl: 3 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                          <Avatar
                            sx={{
                              width: 36,
                              height: 36,
                              bgcolor: getAvatarColor(user.fullName),
                              fontSize: "0.85rem",
                              fontWeight: 600,
                            }}
                          >
                            {getInitials(user.fullName)}
                          </Avatar>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 600,
                                color: PRIMARY,
                                lineHeight: 1.3,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {user.fullName}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{
                                color: "text.secondary",
                                fontSize: "0.72rem",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                display: "block",
                              }}
                            >
                              {user.email}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>

                      {/* Role badge */}
                      <TableCell align="center">
                        <RoleBadge role={user.role} />
                      </TableCell>

                      {/* Status indicator (green/gray dot) */}
                      <TableCell align="center">
                        <Tooltip
                          title={user.isActive ? "Active" : "Inactive"}
                          arrow
                        >
                          <Box
                            sx={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 0.5,
                            }}
                          >
                            <CircleIcon
                              sx={{
                                fontSize: 10,
                                color: user.isActive ? "#4caf50" : "#bdbdbd",
                              }}
                            />
                            <Typography
                              variant="caption"
                              sx={{
                                color: user.isActive
                                  ? "success.main"
                                  : "text.disabled",
                                fontWeight: 500,
                                fontSize: "0.72rem",
                              }}
                            >
                              {user.isActive ? "Active" : "Inactive"}
                            </Typography>
                          </Box>
                        </Tooltip>
                      </TableCell>

                      {/* Permissions */}
                      <TableCell align="center">
                        <Stack
                          direction="row"
                          spacing={0.5}
                          justifyContent="center"
                          flexWrap="wrap"
                          useFlexGap
                        >
                          {user.permissions?.canCreateOrders && (
                            <Chip
                              label="Orders"
                              size="small"
                              variant="outlined"
                              sx={{
                                height: 20,
                                fontSize: "0.65rem",
                                borderRadius: "4px",
                                "& .MuiChip-label": { px: 0.8 },
                              }}
                            />
                          )}
                          {user.permissions?.canManageLeads && (
                            <Chip
                              label="Leads"
                              size="small"
                              variant="outlined"
                              sx={{
                                height: 20,
                                fontSize: "0.65rem",
                                borderRadius: "4px",
                                "& .MuiChip-label": { px: 0.8 },
                              }}
                            />
                          )}
                          {user.permissions?.canManageRefunds && (
                            <Chip
                              label="Refunds"
                              size="small"
                              variant="outlined"
                              sx={{
                                height: 20,
                                fontSize: "0.65rem",
                                borderRadius: "4px",
                                "& .MuiChip-label": { px: 0.8 },
                              }}
                            />
                          )}
                        </Stack>
                      </TableCell>

                      {/* Agent Code */}
                      <TableCell align="center">
                        {user.fourDigitCode ? (
                          <Typography
                            variant="caption"
                            sx={{
                              fontFamily: "monospace",
                              fontWeight: 600,
                              bgcolor: alpha(PRIMARY, 0.06),
                              px: 1.2,
                              py: 0.3,
                              borderRadius: "4px",
                              fontSize: "0.8rem",
                            }}
                          >
                            {user.fourDigitCode}
                          </Typography>
                        ) : (
                          <Typography variant="caption" sx={{ color: "text.disabled" }}>
                            --
                          </Typography>
                        )}
                      </TableCell>

                      {/* Created (relative time) */}
                      <TableCell align="center">
                        <Tooltip title={new Date(user.createdAt).toLocaleString()} arrow>
                          <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.75rem" }}>
                            {getRelativeTime(user.createdAt)}
                          </Typography>
                        </Tooltip>
                      </TableCell>

                      {/* Actions */}
                      <TableCell align="center" sx={{ pr: 3 }}>
                        <Stack direction="row" spacing={0.5} justifyContent="center">
                          {user.status === "pending" && (
                            <Tooltip title="Approve User" arrow>
                              <AnimatedIconButton
                                size="small"
                                onClick={() =>
                                  setDialogState({ type: "approve", user })
                                }
                                sx={{
                                  color: "#2e7d32",
                                  bgcolor: alpha("#2e7d32", 0.08),
                                  "&:hover": { bgcolor: alpha("#2e7d32", 0.15) },
                                }}
                              >
                                <CheckCircleIcon sx={{ fontSize: 18 }} />
                              </AnimatedIconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Edit User" arrow>
                            <AnimatedIconButton
                              size="small"
                              onClick={() =>
                                setDialogState({ type: "user", user })
                              }
                              sx={{
                                color: PRIMARY,
                                bgcolor: alpha(PRIMARY, 0.08),
                                "&:hover": { bgcolor: alpha(PRIMARY, 0.15) },
                              }}
                            >
                              <EditIcon sx={{ fontSize: 18 }} />
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
                              sx={{
                                color: ACCENT,
                                bgcolor: alpha(ACCENT, 0.08),
                                "&:hover": { bgcolor: alpha(ACCENT, 0.15) },
                              }}
                            >
                              <LogoutIcon sx={{ fontSize: 18 }} />
                            </AnimatedIconButton>
                          </Tooltip>
                          {user._id !== currentUser?.id && (
                            <Tooltip title="Delete Options" arrow>
                              <AnimatedIconButton
                                size="small"
                                onClick={() =>
                                  setDialogState({ type: "delete", user })
                                }
                                sx={{
                                  color: "#d32f2f",
                                  bgcolor: alpha("#d32f2f", 0.08),
                                  "&:hover": { bgcolor: alpha("#d32f2f", 0.15) },
                                }}
                              >
                                <DeleteIcon sx={{ fontSize: 18 }} />
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

        {/* Pagination */}
        {!loading && filteredUsers.length > 0 && (
          <TablePagination
            component="div"
            count={filteredUsers.length}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[5, 10, 25, 50]}
            sx={{
              borderTop: `1px solid ${alpha(PRIMARY, 0.08)}`,
              "& .MuiTablePagination-toolbar": {
                minHeight: 48,
              },
            }}
          />
        )}
      </Paper>

      {/* User Dialog */}
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

      {/* Sensitive Action Modal */}
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

      {/* Delete Dialog */}
      <Dialog
        open={dialogState.type === "delete"}
        onClose={handleDialogClose}
        maxWidth="sm"
        TransitionComponent={Grow}
        TransitionProps={{ timeout: 300 }}
        PaperProps={{
          sx: { borderRadius: RADIUS, overflow: "hidden" },
        }}
      >
        <DialogTitle
          sx={{
            background: `linear-gradient(135deg, #d32f2f, ${alpha("#d32f2f", 0.85)})`,
            color: "white",
            py: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <DeleteIcon />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Delete User Options
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography variant="body1" gutterBottom sx={{ mb: 2 }}>
            Choose an action for user "{dialogState.user?.fullName}":
          </Typography>

          <Stack spacing={3}>
            <Box
              sx={{
                p: 2.5,
                border: 1,
                borderColor: "warning.main",
                borderRadius: RADIUS,
                backgroundColor: alpha(theme.palette.warning.main, 0.05),
              }}
            >
              <Typography variant="h6" gutterBottom color="warning.main" sx={{ fontWeight: 600 }}>
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
                  borderRadius: "8px",
                  textTransform: "none",
                  fontWeight: 600,
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
                p: 2.5,
                border: 1,
                borderColor: "error.main",
                borderRadius: RADIUS,
                backgroundColor: alpha(theme.palette.error.main, 0.05),
              }}
            >
              <Typography variant="h6" gutterBottom color="error.main" sx={{ fontWeight: 600 }}>
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
                  borderRadius: "8px",
                  textTransform: "none",
                  fontWeight: 600,
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
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleDialogClose} sx={{ borderRadius: "8px" }}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog
        open={dialogState.type === "approve"}
        onClose={handleDialogClose}
        maxWidth="xs"
        PaperProps={{
          sx: { borderRadius: RADIUS, overflow: "hidden" },
        }}
      >
        <DialogTitle
          sx={{
            background: `linear-gradient(135deg, #2e7d32, ${alpha("#2e7d32", 0.85)})`,
            color: "white",
            py: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CheckCircleIcon />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Approve User
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography sx={{ mb: 2 }}>
            Approve "{dialogState.user?.fullName}" and assign a role:
          </Typography>
          <Stack spacing={1}>
            {Object.entries(ROLES)
              .filter(([key]) => !["pending_approval"].includes(key))
              .map(([key, { label, icon }]) => (
                <Button
                  key={key}
                  variant="outlined"
                  onClick={() => handleApproveUser(key)}
                  startIcon={icon}
                  sx={{
                    borderRadius: "8px",
                    textTransform: "none",
                    justifyContent: "flex-start",
                    py: 1,
                  }}
                >
                  {label}
                </Button>
              ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleDialogClose} sx={{ borderRadius: "8px" }}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Kick Session Dialog */}
      <Dialog
        open={dialogState.type === "kick"}
        onClose={handleDialogClose}
        maxWidth="sm"
        TransitionComponent={Grow}
        TransitionProps={{ timeout: 300 }}
        PaperProps={{
          sx: { borderRadius: RADIUS, overflow: "hidden" },
        }}
      >
        <DialogTitle
          sx={{
            background:
              dialogState.user?._id === currentUser?.id
                ? `linear-gradient(135deg, #d32f2f, ${alpha("#d32f2f", 0.85)})`
                : `linear-gradient(135deg, ${ACCENT}, ${alpha(ACCENT, 0.85)})`,
            color: "white",
            py: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <LogoutIcon />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {dialogState.user?._id === currentUser?.id
                ? "Kick My Session"
                : "Kick User Session"}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Box
            sx={{
              p: 2.5,
              border: 1,
              borderColor:
                dialogState.user?._id === currentUser?.id
                  ? "error.main"
                  : "warning.main",
              borderRadius: RADIUS,
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
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleDialogClose} sx={{ borderRadius: "8px" }}>
            Cancel
          </Button>
          <Button
            onClick={handleKickSession}
            variant="contained"
            color={
              dialogState.user?._id === currentUser?.id ? "error" : "warning"
            }
            startIcon={<LogoutIcon />}
            sx={{
              borderRadius: "8px",
              textTransform: "none",
              fontWeight: 600,
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
