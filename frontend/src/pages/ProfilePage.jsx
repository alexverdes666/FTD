import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
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
const ProfilePage = () => {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const isLoading = useSelector(selectAuthLoading);
  const error = useSelector(selectAuthError);
  const sessions = useSelector(selectSessions);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState("profile");
  const [showHistory, setShowHistory] = useState(false);
  const [terminateDialogOpen, setTerminateDialogOpen] = useState(false);
  const [terminateAllDialogOpen, setTerminateAllDialogOpen] = useState(false);
  const [sessionToTerminate, setSessionToTerminate] = useState(null);
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
    queryKey: ['profile', 'sessions'],
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
      dispatch(fetchMySessions()); // Refresh sessions list
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
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        My Profile
      </Typography>
      {}
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
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <Grid container spacing={3}>
        {}
        <Grid item xs={12} md={4}>
          <Card>
            <CardHeader title="Profile Overview" />
            <CardContent>
              <Box
                display="flex"
                flexDirection="column"
                alignItems="center"
                mb={3}
              >
                <Avatar
                  sx={{
                    width: 100,
                    height: 100,
                    mb: 2,
                    bgcolor: "primary.main",
                    fontSize: "2rem",
                  }}
                >
                  {user.fullName?.[0]?.toUpperCase() ||
                    user.email?.[0]?.toUpperCase()}
                </Avatar>
                <Typography variant="h6" gutterBottom>
                  {user.fullName}
                </Typography>
                <Chip
                  label={getRoleDisplayName(user.role)}
                  color={getRoleColor(user.role)}
                  size="small"
                />
              </Box>
              <Divider sx={{ my: 2 }} />
              <Stack spacing={2}>
                <Box display="flex" alignItems="center">
                  <EmailIcon sx={{ mr: 2, color: "text.secondary" }} />
                  <Box>
                    <Typography variant="body2" color="textSecondary">
                      Email
                    </Typography>
                    <Typography variant="body1">{user.email}</Typography>
                  </Box>
                </Box>
                {user.fourDigitCode && (
                  <Box display="flex" alignItems="center">
                    <BadgeIcon sx={{ mr: 2, color: "text.secondary" }} />
                    <Box>
                      <Typography variant="body2" color="textSecondary">
                        Agent Code
                      </Typography>
                      <Typography variant="body1">
                        {user.fourDigitCode}
                      </Typography>
                    </Box>
                  </Box>
                )}
                <Box display="flex" alignItems="center">
                  <PersonIcon sx={{ mr: 2, color: "text.secondary" }} />
                  <Box>
                    <Typography variant="body2" color="textSecondary">
                      Role
                    </Typography>
                    <Typography variant="body1">
                      {getRoleDisplayName(user.role)}
                    </Typography>
                  </Box>
                </Box>
                {user.permissions && (
                  <Box>
                    <Typography
                      variant="body2"
                      color="textSecondary"
                      gutterBottom
                    >
                      Permissions
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {user.permissions.canCreateOrders && (
                        <Chip
                          label="Create Orders"
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </Stack>
                  </Box>
                )}
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Member Since
                  </Typography>
                  <Typography variant="body1">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        {}
        <Grid item xs={12} md={8}>
          <Grid container spacing={3}>
            {}
            <Grid item xs={12}>
              <Card>
                <CardHeader title="Edit Profile" avatar={<PersonIcon />} />
                <CardContent>
                  <form onSubmit={handleProfileSubmit(onSubmitProfile)}>
                    <Grid container spacing={2}>
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
                            />
                          )}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <Button
                          type="submit"
                          variant="contained"
                          startIcon={<SaveIcon />}
                          disabled={isLoading || !isProfileDirty}
                        >
                          {isLoading ? (
                            <CircularProgress size={24} />
                          ) : (
                            "Update Profile"
                          )}
                        </Button>
                      </Grid>
                    </Grid>
                  </form>
                </CardContent>
              </Card>
            </Grid>
            {}
            <Grid item xs={12}>
              <Card>
                <CardHeader title="Change Password" avatar={<LockIcon />} />
                <CardContent>
                  <form onSubmit={handlePasswordSubmit(onSubmitPassword)}>
                    <Grid container spacing={2}>
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
                              helperText={
                                passwordErrors.currentPassword?.message
                              }
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
                              helperText={
                                passwordErrors.confirmPassword?.message
                              }
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
            </Grid>
            {/* Two-Factor Authentication Section */}
            {user.role === "admin" && (
              <Grid item xs={12}>
                <TwoFactorManagement />
              </Grid>
            )}

            {/* Session Management Section */}
            <Grid item xs={12}>
              <Card>
                <CardHeader
                  title="Active Sessions"
                  avatar={<DevicesIcon />}
                  action={
                    sessions.activeSessions.length > 1 && (
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        startIcon={<LogoutAllIcon />}
                        onClick={handleTerminateAllClick}
                        disabled={sessions.isLoading}
                      >
                        Logout All Other
                      </Button>
                    )
                  }
                />
                <CardContent>
                  {sessions.error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
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
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Device</TableCell>
                            <TableCell>IP Address</TableCell>
                            <TableCell>Login Time</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell align="right">Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {sessions.activeSessions.map((session) => (
                            <TableRow
                              key={session.id}
                              sx={{
                                bgcolor: session.isCurrent
                                  ? "action.selected"
                                  : "inherit",
                              }}
                            >
                              <TableCell>
                                <Stack direction="row" spacing={1} alignItems="center">
                                  {getDeviceIcon(session.device?.type)}
                                  <Box>
                                    <Typography variant="body2">
                                      {session.device?.browser || "Unknown Browser"}
                                    </Typography>
                                    <Typography variant="caption" color="textSecondary">
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
                                  />
                                ) : (
                                  <Chip label="Active" color="primary" size="small" />
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
                        endIcon={showHistory ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        sx={{ mb: 1 }}
                      >
                        Session History ({sessions.sessionHistory.length})
                      </Button>
                      <Collapse in={showHistory}>
                        <Paper variant="outlined" sx={{ mt: 1 }}>
                          <TableContainer>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Device</TableCell>
                                  <TableCell>IP Address</TableCell>
                                  <TableCell>Login</TableCell>
                                  <TableCell>Logout</TableCell>
                                  <TableCell>Ended By</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {sessions.sessionHistory.map((session) => (
                                  <TableRow key={session.id}>
                                    <TableCell>
                                      <Stack direction="row" spacing={1} alignItems="center">
                                        {getDeviceIcon(session.device?.type)}
                                        <Box>
                                          <Typography variant="body2">
                                            {session.device?.browser || "Unknown"}
                                          </Typography>
                                          <Typography variant="caption" color="textSecondary">
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
                                        color={session.endReason === "kicked" ? "error" : "default"}
                                        variant="outlined"
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
            </Grid>
          </Grid>
        </Grid>
      </Grid>

      {/* Terminate Session Dialog */}
      <Dialog
        open={terminateDialogOpen}
        onClose={() => setTerminateDialogOpen(false)}
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
                <strong>IP Address:</strong> {sessionToTerminate.ipAddress || "Unknown"}
              </Typography>
              <Typography variant="body2">
                <strong>Login Time:</strong> {formatDate(sessionToTerminate.loginAt)}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTerminateDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleConfirmTerminate}
            color="error"
            variant="contained"
          >
            Terminate
          </Button>
        </DialogActions>
      </Dialog>

      {/* Terminate All Sessions Dialog */}
      <Dialog
        open={terminateAllDialogOpen}
        onClose={() => setTerminateAllDialogOpen(false)}
      >
        <DialogTitle>Logout All Other Sessions</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to logout all other sessions? All devices except
            this one will be logged out immediately. You will remain logged in on
            this device.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTerminateAllDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleConfirmTerminateAll}
            color="error"
            variant="contained"
          >
            Logout All Others
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
export default ProfilePage;
