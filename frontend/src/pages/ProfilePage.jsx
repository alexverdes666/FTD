import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
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
} from "@mui/material";
import {
  Person as PersonIcon,
  Save as SaveIcon,
  Lock as LockIcon,
  Email as EmailIcon,
  Badge as BadgeIcon,
} from "@mui/icons-material";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import {
  selectUser,
  selectAuthLoading,
  selectAuthError,
  updateProfile,
  changePassword,
  clearError,
} from "../store/slices/authSlice";
import TwoFactorManagement from "../components/TwoFactorManagement";
import AdminAuditLogsSection from "../components/AdminAuditLogsSection";
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
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState("profile");
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
          </Grid>
        </Grid>

        {/* Audit Logs Section - Full Width for Admin Only */}
        {user.role === "admin" && (
          <Grid item xs={12}>
            <AdminAuditLogsSection />
          </Grid>
        )}
      </Grid>
    </Box>
  );
};
export default ProfilePage;
