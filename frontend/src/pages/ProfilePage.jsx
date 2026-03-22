import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  TextField,
  Button,
  Avatar,
  Divider,
  Alert,
  CircularProgress,
  Stack,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Paper,
  Collapse,
  Tabs,
  Tab,
  alpha,
} from "@mui/material";
import {
  Person as PersonIcon,
  Save as SaveIcon,
  Lock as LockIcon,
  Email as EmailIcon,
  Badge as BadgeIcon,
  Devices as DevicesIcon,
  Logout as LogoutIcon,
  LogoutOutlined as LogoutAllIcon,
  Computer as ComputerIcon,
  PhoneAndroid as PhoneIcon,
  Tablet as TabletIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CheckCircle as ActiveIcon,
  History as HistoryIcon,
  Edit as EditIcon,
  Security as SecurityIcon,
  CalendarToday as CalendarIcon,
  Circle as CircleIcon,
  Settings as SettingsIcon,
} from "@mui/icons-material";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import {
  selectUser,
  selectAuthLoading,
  selectAuthError,
  selectSessions,
  updateProfile,
  changePassword,
  clearError,
  fetchMySessions,
  terminateSession,
  terminateAllSessions,
} from "../store/slices/authSlice";
import TwoFactorManagement from "../components/TwoFactorManagement";

const profileSchema = yup.object({
  fullName: yup
    .string()
    .required("Full name is required")
    .min(2, "Name must be at least 2 characters"),
  email: yup.string().email("Invalid email").required("Email is required"),
});

const passwordSchema = yup.object({
  currentPassword: yup.string().required("Current password is required"),
  newPassword: yup
    .string()
    .required("New password is required")
    .min(6, "Password must be at least 6 characters"),
  confirmPassword: yup
    .string()
    .required("Please confirm your password")
    .oneOf([yup.ref("newPassword")], "Passwords must match"),
});

// -- Styled constants --
const BANNER_HEIGHT = 180;
const AVATAR_SIZE = 120;
const PRIMARY_DARK = "#1e3a5f";
const PRIMARY_MID = "#2d5a8e";
const ACCENT = "#f57c00";
const CARD_RADIUS = "12px";

const ProfilePage = () => {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const isLoading = useSelector(selectAuthLoading);
  const error = useSelector(selectAuthError);
  const sessions = useSelector(selectSessions);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [terminateDialogOpen, setTerminateDialogOpen] = useState(false);
  const [terminateAllDialogOpen, setTerminateAllDialogOpen] = useState(false);
  const [sessionToTerminate, setSessionToTerminate] = useState(null);
  const [editMode, setEditMode] = useState(false);

  const {
    control: profileControl,
    handleSubmit: handleProfileSubmit,
    formState: { errors: profileErrors, isDirty: isProfileDirty },
  } = useForm({
    resolver: yupResolver(profileSchema),
    defaultValues: {
      fullName: user?.fullName || "",
      email: user?.email || "",
    },
  });

  const {
    control: passwordControl,
    handleSubmit: handlePasswordSubmit,
    reset: resetPasswordForm,
    formState: { errors: passwordErrors },
  } = useForm({
    resolver: yupResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  React.useEffect(() => {
    dispatch(clearError());
  }, [dispatch]);

  React.useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Fetch sessions on mount and auto-refresh every 30 seconds via React Query
  useQuery({
    queryKey: ["profile", "sessions"],
    queryFn: () => dispatch(fetchMySessions()).unwrap(),
    refetchInterval: 30000,
  });

  // Session management handlers
  const handleTerminateClick = (session) => {
    setSessionToTerminate(session);
    setTerminateDialogOpen(true);
  };

  const handleConfirmTerminate = async () => {
    if (sessionToTerminate) {
      try {
        await dispatch(terminateSession(sessionToTerminate.id)).unwrap();
        setSuccess("Session terminated successfully");
      } catch (err) {
        // Error handled by redux
      }
    }
    setTerminateDialogOpen(false);
    setSessionToTerminate(null);
  };

  const handleTerminateAllClick = () => {
    setTerminateAllDialogOpen(true);
  };

  const handleConfirmTerminateAll = async () => {
    try {
      await dispatch(terminateAllSessions()).unwrap();
      setSuccess("All other sessions terminated successfully");
      dispatch(fetchMySessions());
    } catch (err) {
      // Error handled by redux
    }
    setTerminateAllDialogOpen(false);
  };

  const getDeviceIcon = (deviceType) => {
    switch (deviceType?.toLowerCase()) {
      case "mobile":
        return <PhoneIcon />;
      case "tablet":
        return <TabletIcon />;
      default:
        return <ComputerIcon />;
    }
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleString();
  };

  const onSubmitProfile = async (data) => {
    try {
      await dispatch(updateProfile(data)).unwrap();
      setSuccess("Profile updated successfully!");
      setEditMode(false);
    } catch (error) {}
  };

  const onSubmitPassword = async (data) => {
    try {
      await dispatch(
        changePassword({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        })
      ).unwrap();
      setSuccess("Password changed successfully!");
      resetPasswordForm();
    } catch (error) {}
  };

  const getRoleColor = (role) => {
    switch (role) {
      case "admin":
        return "primary";
      case "affiliate_manager":
        return "secondary";
      case "agent":
        return "info";
      default:
        return "default";
    }
  };

  const getRoleDisplayName = (role) => {
    switch (role) {
      case "admin":
        return "Administrator";
      case "affiliate_manager":
        return "Affiliate Manager";
      case "agent":
        return "Agent";
      default:
        return role;
    }
  };

  if (!user) {
    return (
      <Box display="flex" justifyContent="center" my={4}>
        <CircularProgress />
      </Box>
    );
  }

  const memberSince = new Date(user.createdAt).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });

  // ---- Tab Panels ----

  const renderPersonalInfoTab = () => (
    <Card
      sx={{
        borderRadius: CARD_RADIUS,
        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
      }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={3}
        >
          <Box display="flex" alignItems="center" gap={1.5}>
            <PersonIcon sx={{ color: PRIMARY_DARK }} />
            <Typography variant="h6" fontWeight={600}>
              Personal Information
            </Typography>
          </Box>
          {!editMode && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<EditIcon />}
              onClick={() => setEditMode(true)}
              sx={{
                borderColor: PRIMARY_DARK,
                color: PRIMARY_DARK,
                textTransform: "none",
                borderRadius: "8px",
                "&:hover": {
                  borderColor: PRIMARY_MID,
                  bgcolor: alpha(PRIMARY_DARK, 0.04),
                },
              }}
            >
              Edit
            </Button>
          )}
        </Box>

        {editMode ? (
          <form onSubmit={handleProfileSubmit(onSubmitProfile)}>
            <Grid container spacing={2.5}>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="fullName"
                  control={profileControl}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Full Name"
                      error={!!profileErrors.fullName}
                      helperText={profileErrors.fullName?.message}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          borderRadius: "8px",
                        },
                      }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="email"
                  control={profileControl}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Email"
                      type="email"
                      error={!!profileErrors.email}
                      helperText={profileErrors.email?.message}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          borderRadius: "8px",
                        },
                      }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Stack direction="row" spacing={1.5}>
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={<SaveIcon />}
                    disabled={isLoading || !isProfileDirty}
                    sx={{
                      bgcolor: PRIMARY_DARK,
                      textTransform: "none",
                      borderRadius: "8px",
                      px: 3,
                      "&:hover": { bgcolor: PRIMARY_MID },
                    }}
                  >
                    {isLoading ? (
                      <CircularProgress size={24} />
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => setEditMode(false)}
                    sx={{
                      textTransform: "none",
                      borderRadius: "8px",
                    }}
                  >
                    Cancel
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </form>
        ) : (
          <Grid container spacing={0}>
            {[
              { label: "Full Name", value: user.fullName, icon: <PersonIcon fontSize="small" sx={{ color: "text.secondary" }} /> },
              { label: "Email", value: user.email, icon: <EmailIcon fontSize="small" sx={{ color: "text.secondary" }} /> },
              { label: "Role", value: getRoleDisplayName(user.role), icon: <BadgeIcon fontSize="small" sx={{ color: "text.secondary" }} /> },
              ...(user.fourDigitCode
                ? [{ label: "Agent Code", value: user.fourDigitCode, icon: <BadgeIcon fontSize="small" sx={{ color: "text.secondary" }} /> }]
                : []),
              { label: "Member Since", value: new Date(user.createdAt).toLocaleDateString(), icon: <CalendarIcon fontSize="small" sx={{ color: "text.secondary" }} /> },
            ].map((item, index, arr) => (
              <React.Fragment key={item.label}>
                <Grid item xs={12}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      py: 2,
                      px: 1,
                      borderBottom: index < arr.length - 1 ? "1px solid" : "none",
                      borderColor: "divider",
                    }}
                  >
                    <Box sx={{ mr: 2, display: "flex", alignItems: "center" }}>
                      {item.icon}
                    </Box>
                    <Box sx={{ minWidth: 140 }}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        fontWeight={500}
                      >
                        {item.label}
                      </Typography>
                    </Box>
                    <Typography variant="body1" fontWeight={500}>
                      {item.value}
                    </Typography>
                  </Box>
                </Grid>
              </React.Fragment>
            ))}
            {user.permissions && (
              <Grid item xs={12}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    py: 2,
                    px: 1,
                  }}
                >
                  <Box sx={{ mr: 2, display: "flex", alignItems: "center" }}>
                    <SettingsIcon fontSize="small" sx={{ color: "text.secondary" }} />
                  </Box>
                  <Box sx={{ minWidth: 140 }}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      fontWeight={500}
                    >
                      Permissions
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {user.permissions.canCreateOrders && (
                      <Chip
                        label="Create Orders"
                        size="small"
                        variant="outlined"
                        sx={{ borderRadius: "6px" }}
                      />
                    )}
                  </Stack>
                </Box>
              </Grid>
            )}
          </Grid>
        )}
      </CardContent>
    </Card>
  );

  const renderSecurityTab = () => (
    <Stack spacing={3}>
      {/* Password Change */}
      <Card
        sx={{
          borderRadius: CARD_RADIUS,
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Box display="flex" alignItems="center" gap={1.5} mb={3}>
            <LockIcon sx={{ color: PRIMARY_DARK }} />
            <Typography variant="h6" fontWeight={600}>
              Change Password
            </Typography>
          </Box>
          <form onSubmit={handlePasswordSubmit(onSubmitPassword)}>
            <Grid container spacing={2.5}>
              <Grid item xs={12}>
                <Controller
                  name="currentPassword"
                  control={passwordControl}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Current Password"
                      type="password"
                      error={!!passwordErrors.currentPassword}
                      helperText={passwordErrors.currentPassword?.message}
                      sx={{
                        "& .MuiOutlinedInput-root": { borderRadius: "8px" },
                      }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="newPassword"
                  control={passwordControl}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="New Password"
                      type="password"
                      error={!!passwordErrors.newPassword}
                      helperText={passwordErrors.newPassword?.message}
                      sx={{
                        "& .MuiOutlinedInput-root": { borderRadius: "8px" },
                      }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="confirmPassword"
                  control={passwordControl}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Confirm New Password"
                      type="password"
                      error={!!passwordErrors.confirmPassword}
                      helperText={passwordErrors.confirmPassword?.message}
                      sx={{
                        "& .MuiOutlinedInput-root": { borderRadius: "8px" },
                      }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<LockIcon />}
                  disabled={isLoading}
                  sx={{
                    bgcolor: PRIMARY_DARK,
                    textTransform: "none",
                    borderRadius: "8px",
                    px: 3,
                    "&:hover": { bgcolor: PRIMARY_MID },
                  }}
                >
                  {isLoading ? (
                    <CircularProgress size={24} />
                  ) : (
                    "Change Password"
                  )}
                </Button>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>

      {/* Two-Factor Authentication Section */}
      {user.role === "admin" && <TwoFactorManagement />}

      {/* Session Management Section */}
      <Card
        sx={{
          borderRadius: CARD_RADIUS,
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            mb={3}
          >
            <Box display="flex" alignItems="center" gap={1.5}>
              <DevicesIcon sx={{ color: PRIMARY_DARK }} />
              <Typography variant="h6" fontWeight={600}>
                Active Sessions
              </Typography>
            </Box>
            {sessions.activeSessions.length > 1 && (
              <Button
                variant="outlined"
                color="error"
                size="small"
                startIcon={<LogoutAllIcon />}
                onClick={handleTerminateAllClick}
                disabled={sessions.isLoading}
                sx={{
                  textTransform: "none",
                  borderRadius: "8px",
                }}
              >
                Logout All Other
              </Button>
            )}
          </Box>

          {sessions.error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: "8px" }}>
              {sessions.error}
            </Alert>
          )}

          {sessions.isLoading && sessions.activeSessions.length === 0 ? (
            <Box display="flex" justifyContent="center" py={3}>
              <CircularProgress />
            </Box>
          ) : sessions.activeSessions.length === 0 ? (
            <Typography color="textSecondary" textAlign="center" py={2}>
              No active sessions found
            </Typography>
          ) : (
            <TableContainer
              component={Paper}
              variant="outlined"
              sx={{ borderRadius: "8px" }}
            >
              <Table size="small">
                <TableHead>
                  <TableRow
                    sx={{ bgcolor: alpha(PRIMARY_DARK, 0.03) }}
                  >
                    <TableCell sx={{ fontWeight: 600 }}>Device</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>IP Address</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Login Time</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sessions.activeSessions.map((session) => (
                    <TableRow
                      key={session.id}
                      sx={{
                        bgcolor: session.isCurrent
                          ? alpha(PRIMARY_DARK, 0.04)
                          : "inherit",
                        "&:last-child td": { borderBottom: 0 },
                      }}
                    >
                      <TableCell>
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                        >
                          {getDeviceIcon(session.device?.type)}
                          <Box>
                            <Typography variant="body2">
                              {session.device?.browser || "Unknown Browser"}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="textSecondary"
                            >
                              {session.device?.os || "Unknown OS"}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {session.ipAddress || "Unknown"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(session.loginAt)}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          Last: {formatDate(session.lastActivityAt)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {session.isCurrent ? (
                          <Chip
                            icon={<ActiveIcon />}
                            label="Current"
                            color="success"
                            size="small"
                            sx={{ borderRadius: "6px" }}
                          />
                        ) : (
                          <Chip
                            label="Active"
                            color="primary"
                            size="small"
                            sx={{ borderRadius: "6px" }}
                          />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {!session.isCurrent && (
                          <Tooltip title="Terminate session">
                            <IconButton
                              color="error"
                              size="small"
                              onClick={() => handleTerminateClick(session)}
                            >
                              <LogoutIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Session History */}
          {sessions.sessionHistory.length > 0 && (
            <Box mt={2}>
              <Button
                onClick={() => setShowHistory(!showHistory)}
                startIcon={<HistoryIcon />}
                endIcon={
                  showHistory ? <ExpandLessIcon /> : <ExpandMoreIcon />
                }
                sx={{
                  mb: 1,
                  textTransform: "none",
                  color: PRIMARY_DARK,
                }}
              >
                Session History ({sessions.sessionHistory.length})
              </Button>
              <Collapse in={showHistory}>
                <Paper
                  variant="outlined"
                  sx={{ mt: 1, borderRadius: "8px" }}
                >
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow
                          sx={{ bgcolor: alpha(PRIMARY_DARK, 0.03) }}
                        >
                          <TableCell sx={{ fontWeight: 600 }}>
                            Device
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>
                            IP Address
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Login</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>
                            Logout
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>
                            Ended By
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {sessions.sessionHistory.map((session) => (
                          <TableRow key={session.id}>
                            <TableCell>
                              <Stack
                                direction="row"
                                spacing={1}
                                alignItems="center"
                              >
                                {getDeviceIcon(session.device?.type)}
                                <Box>
                                  <Typography variant="body2">
                                    {session.device?.browser || "Unknown"}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    color="textSecondary"
                                  >
                                    {session.device?.os || "Unknown OS"}
                                  </Typography>
                                </Box>
                              </Stack>
                            </TableCell>
                            <TableCell>
                              <Typography
                                variant="body2"
                                fontFamily="monospace"
                              >
                                {session.ipAddress || "Unknown"}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {formatDate(session.loginAt)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {formatDate(session.logoutAt)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={session.endReason || "Unknown"}
                                size="small"
                                color={
                                  session.endReason === "kicked"
                                    ? "error"
                                    : "default"
                                }
                                variant="outlined"
                                sx={{ borderRadius: "6px" }}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Collapse>
            </Box>
          )}
        </CardContent>
      </Card>
    </Stack>
  );

  return (
    <Box sx={{ pb: 4 }}>
      {/* Alerts */}
      {success && (
        <Alert
          severity="success"
          sx={{ mb: 2, borderRadius: "8px" }}
          onClose={() => setSuccess(null)}
        >
          {success}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: "8px" }}>
          {error}
        </Alert>
      )}

      {/* ====== BANNER HEADER ====== */}
      <Card
        sx={{
          borderRadius: CARD_RADIUS,
          overflow: "visible",
          boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
          mb: 4,
        }}
      >
        {/* Gradient Banner */}
        <Box
          sx={{
            height: BANNER_HEIGHT,
            background: `linear-gradient(135deg, ${PRIMARY_DARK} 0%, ${PRIMARY_MID} 60%, ${alpha(ACCENT, 0.7)} 100%)`,
            borderRadius: `${CARD_RADIUS} ${CARD_RADIUS} 0 0`,
            position: "relative",
          }}
        >
          {/* Subtle pattern overlay */}
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              opacity: 0.07,
              backgroundImage:
                "radial-gradient(circle at 25% 50%, #fff 1px, transparent 1px), radial-gradient(circle at 75% 50%, #fff 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />
        </Box>

        {/* Profile Info Area */}
        <Box
          sx={{
            px: { xs: 2, sm: 4 },
            pb: 3,
            position: "relative",
          }}
        >
          {/* Avatar - overlapping banner */}
          <Avatar
            sx={{
              width: AVATAR_SIZE,
              height: AVATAR_SIZE,
              fontSize: "2.5rem",
              fontWeight: 700,
              bgcolor: PRIMARY_DARK,
              border: "4px solid",
              borderColor: "background.paper",
              boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
              position: "relative",
              mt: `-${AVATAR_SIZE / 2}px`,
            }}
          >
            {user.fullName?.[0]?.toUpperCase() ||
              user.email?.[0]?.toUpperCase()}
          </Avatar>

          {/* Name, role, status row */}
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              alignItems: { xs: "flex-start", sm: "center" },
              justifyContent: "space-between",
              mt: 2,
            }}
          >
            <Box>
              <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
                <Typography
                  variant="h5"
                  fontWeight={700}
                  sx={{ color: "text.primary" }}
                >
                  {user.fullName}
                </Typography>
                <Chip
                  label={getRoleDisplayName(user.role)}
                  color={getRoleColor(user.role)}
                  size="small"
                  sx={{
                    fontWeight: 600,
                    borderRadius: "6px",
                    height: 26,
                  }}
                />
                <Box display="flex" alignItems="center" gap={0.5}>
                  <CircleIcon
                    sx={{ fontSize: 10, color: "success.main" }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    Online
                  </Typography>
                </Box>
              </Box>
              <Typography variant="body2" color="text.secondary" mt={0.5}>
                {user.email}
              </Typography>
            </Box>
          </Box>

          {/* Quick Stats Row */}
          <Divider sx={{ my: 2.5 }} />
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={{ xs: 1.5, sm: 4 }}
            alignItems={{ sm: "center" }}
          >
            <Box display="flex" alignItems="center" gap={1}>
              <CalendarIcon
                fontSize="small"
                sx={{ color: "text.secondary" }}
              />
              <Typography variant="body2" color="text.secondary">
                Active since{" "}
                <Box component="span" fontWeight={600} color="text.primary">
                  {memberSince}
                </Box>
              </Typography>
            </Box>
            {user.fourDigitCode && (
              <Box display="flex" alignItems="center" gap={1}>
                <BadgeIcon
                  fontSize="small"
                  sx={{ color: "text.secondary" }}
                />
                <Typography variant="body2" color="text.secondary">
                  Agent Code{" "}
                  <Box component="span" fontWeight={600} color="text.primary">
                    {user.fourDigitCode}
                  </Box>
                </Typography>
              </Box>
            )}
            <Box display="flex" alignItems="center" gap={1}>
              <DevicesIcon
                fontSize="small"
                sx={{ color: "text.secondary" }}
              />
              <Typography variant="body2" color="text.secondary">
                <Box component="span" fontWeight={600} color="text.primary">
                  {sessions.activeSessions.length}
                </Box>{" "}
                active {sessions.activeSessions.length === 1 ? "session" : "sessions"}
              </Typography>
            </Box>
            {user.permissions?.canCreateOrders && (
              <Chip
                label="Can Create Orders"
                size="small"
                variant="outlined"
                sx={{
                  borderRadius: "6px",
                  borderColor: alpha(ACCENT, 0.5),
                  color: ACCENT,
                  fontWeight: 500,
                }}
              />
            )}
          </Stack>
        </Box>
      </Card>

      {/* ====== TABS NAVIGATION ====== */}
      <Box
        sx={{
          borderBottom: 1,
          borderColor: "divider",
          mb: 3,
        }}
      >
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          sx={{
            "& .MuiTab-root": {
              textTransform: "none",
              fontWeight: 600,
              fontSize: "0.95rem",
              minHeight: 48,
              "&.Mui-selected": {
                color: PRIMARY_DARK,
              },
            },
            "& .MuiTabs-indicator": {
              backgroundColor: PRIMARY_DARK,
              height: 3,
              borderRadius: "3px 3px 0 0",
            },
          }}
        >
          <Tab
            icon={<PersonIcon />}
            iconPosition="start"
            label="Personal Info"
          />
          <Tab
            icon={<SecurityIcon />}
            iconPosition="start"
            label="Security"
          />
        </Tabs>
      </Box>

      {/* ====== TAB CONTENT ====== */}
      <Box>
        {activeTab === 0 && renderPersonalInfoTab()}
        {activeTab === 1 && renderSecurityTab()}
      </Box>

      {/* ====== DIALOGS (preserved from original) ====== */}

      {/* Terminate Session Dialog */}
      <Dialog
        open={terminateDialogOpen}
        onClose={() => setTerminateDialogOpen(false)}
        PaperProps={{ sx: { borderRadius: CARD_RADIUS } }}
      >
        <DialogTitle>Terminate Session</DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            Are you sure you want to terminate this session? The device will be
            logged out immediately.
          </DialogContentText>
          {sessionToTerminate && (
            <Box mt={2}>
              <Typography variant="body2">
                <strong>Device:</strong> {sessionToTerminate.device?.browser} on{" "}
                {sessionToTerminate.device?.os}
              </Typography>
              <Typography variant="body2">
                <strong>IP Address:</strong>{" "}
                {sessionToTerminate.ipAddress || "Unknown"}
              </Typography>
              <Typography variant="body2">
                <strong>Login Time:</strong>{" "}
                {formatDate(sessionToTerminate.loginAt)}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setTerminateDialogOpen(false)}
            sx={{ textTransform: "none" }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmTerminate}
            color="error"
            variant="contained"
            sx={{ textTransform: "none", borderRadius: "8px" }}
          >
            Terminate
          </Button>
        </DialogActions>
      </Dialog>

      {/* Terminate All Sessions Dialog */}
      <Dialog
        open={terminateAllDialogOpen}
        onClose={() => setTerminateAllDialogOpen(false)}
        PaperProps={{ sx: { borderRadius: CARD_RADIUS } }}
      >
        <DialogTitle>Logout All Other Sessions</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to logout all other sessions? All devices
            except this one will be logged out immediately. You will remain
            logged in on this device.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setTerminateAllDialogOpen(false)}
            sx={{ textTransform: "none" }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmTerminateAll}
            color="error"
            variant="contained"
            sx={{ textTransform: "none", borderRadius: "8px" }}
          >
            Logout All Others
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProfilePage;
