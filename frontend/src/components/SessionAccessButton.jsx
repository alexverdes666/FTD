import React, { useState, useEffect } from "react";
import {
  IconButton,
  Button,
  Tooltip,
  CircularProgress,
  Alert,
  Snackbar,
  Box,
  Typography,
} from "@mui/material";
import {
  Launch as LaunchIcon,
  Warning as WarningIcon,
  Schedule as ExpiringIcon,
} from "@mui/icons-material";
import api from "../services/api";
const SessionAccessButton = ({
  lead,
  user,
  size = "small",
  variant = "icon",
  onSessionAccess = null,
  disabled = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({
    open: false,
    message: "",
    severity: "info",
  });
  const [sessionHealth, setSessionHealth] = useState(null);
  useEffect(() => {
    if (lead?.browserSession?.sessionId) {
      checkSessionHealth();
    }
  }, [lead?.browserSession?.sessionId]);
  const checkSessionHealth = () => {
    if (!lead.browserSession || !lead.browserSession.createdAt) return;
    const createdAt = new Date(lead.browserSession.createdAt);
    const expirationDate = new Date(
      createdAt.getTime() + 30 * 24 * 60 * 60 * 1000
    );
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const daysUntilExpiration = Math.ceil(
      (expirationDate - new Date()) / (24 * 60 * 60 * 1000)
    );
    if (daysUntilExpiration <= 0) {
      setSessionHealth({ status: "expired", daysUntilExpiration: 0 });
    } else if (daysUntilExpiration <= 7) {
      setSessionHealth({ status: "expiring", daysUntilExpiration });
    } else {
      setSessionHealth({ status: "healthy", daysUntilExpiration });
    }
  };
  const hasPermission = () => {
    if (!user) {
      console.log("SessionAccessButton: No user object");
      return false;
    }
    console.log("SessionAccessButton Debug:", {
      userRole: user.role,
      userId: user._id || user.id,
      leadAssignedTo: lead.assignedTo,
      leadCreatedBy: lead.createdBy,
      leadType: lead.leadType,
      leadId: lead._id,
      leadEmail: lead.newEmail || lead.email,
      isFTD: lead.leadType === "ftd",
    });
    if (user.role === "admin") return true;
    if (user.role === "agent") {
      const userIdToCheck = user._id || user.id;
      const assignedToId =
        lead.assignedTo?._id || lead.assignedTo?.id || lead.assignedTo;
      const hasAccess = assignedToId === userIdToCheck;
      console.log("Agent permission check:", {
        userIdToCheck,
        assignedToId,
        hasAccess,
      });
      if (!hasAccess && !lead.browserSession) {
        console.log("TEMP: Allowing access for testing (no browser session)");
        return true;
      }
      return hasAccess;
    }
    if (user.role === "affiliate_manager") {
      const userIdToCheck = user._id || user.id;
      const assignedToId =
        lead.assignedTo?._id || lead.assignedTo?.id || lead.assignedTo;
      const createdById =
        lead.createdBy?._id || lead.createdBy?.id || lead.createdBy;
      const hasAccess =
        assignedToId === userIdToCheck || createdById === userIdToCheck;
      console.log("Affiliate manager permission check:", {
        userIdToCheck,
        assignedToId,
        createdById,
        hasAccess,
      });
      return hasAccess;
    }
    console.log("No role match, access denied");
    return false;
  };
  const hasActiveSession = () => {
    const hasSession =
      lead.browserSession &&
      lead.browserSession.sessionId &&
      lead.browserSession.isActive;
    console.log("Session check:", {
      hasBrowserSession: !!lead.browserSession,
      hasSessionId: !!lead.browserSession?.sessionId,
      isActive: lead.browserSession?.isActive,
      hasSession,
      browserSession: lead.browserSession,
    });
    if (!hasSession) {
      console.log("TEMP: Creating mock session for testing");
      return true;
    }
    return hasSession;
  };
  const isSessionExpired = () => {
    if (!lead.browserSession) {
      return false;
    }
    if (!lead.browserSession || !lead.browserSession.createdAt) return true;
    const createdAt = new Date(lead.browserSession.createdAt);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return createdAt < thirtyDaysAgo;
  };
  const handleAccessSession = async () => {
    if (!hasPermission()) {
      setNotification({
        open: true,
        message: "You do not have permission to access this session",
        severity: "error",
      });
      return;
    }
    if (!hasActiveSession()) {
      setNotification({
        open: true,
        message: "No active session available for this lead",
        severity: "warning",
      });
      return;
    }
    if (isSessionExpired()) {
      setNotification({
        open: true,
        message: "Session has expired and cannot be accessed",
        severity: "error",
      });
      return;
    }
    if (sessionHealth?.status === "expiring") {
      setNotification({
        open: true,
        message: `Warning: Session expires in ${sessionHealth.daysUntilExpiration} day(s). Consider creating a new session soon.`,
        severity: "warning",
      });
    }
    setLoading(true);
    try {
      if (!lead.browserSession || !lead.browserSession.sessionId) {
        console.log(
          "TEMP: Using test session for FTD lead with real lead data"
        );
        const response = await api.post("/test/browser-session", {
          leadId: lead._id,
          leadInfo: {
            firstName: lead.firstName,
            lastName: lead.lastName,
            email: lead.newEmail || lead.email,
            phone: lead.newPhone || lead.phone,
            country: lead.country,
            countryCode: lead.countryCode,
          },
        });
        if (response.data.success) {
          // Check if this is a GUI browser test session with VNC URL
          if (response.data.data.vncUrl) {
            setNotification({
              open: true,
              message: `🧪 Test GUI Browser session created! Click the VNC URL to access your cloud browser for ${lead.firstName} ${lead.lastName}.`,
              severity: "info",
            });

            // Open VNC URL in a new tab
            window.open(response.data.data.vncUrl, "_blank");
          } else {
            // Local test session
            setNotification({
              open: true,
              message: `🧪 Test Mode: Launching Chromium for ${lead.firstName} ${lead.lastName}. Browser will open with FTD lead data for testing injection process.`,
              severity: "info",
            });
          }
          if (onSessionAccess) {
            onSessionAccess(lead, response.data);
          }
        } else {
          throw new Error(
            response.data.message || "Failed to start test session"
          );
        }
        setLoading(false);
        return;
      }
      const response = await api.post(`/api/leads/${lead._id}/access-session`);
      if (response.data.success) {
        // Check if this is a GUI browser session with VNC URL
        if (response.data.data.vncUrl) {
          setNotification({
            open: true,
            message:
              "🚀 GUI Browser session created! Click the VNC URL to access your browser in the cloud.",
            severity: "success",
          });

          // Open VNC URL in a new tab
          window.open(response.data.data.vncUrl, "_blank");

          if (onSessionAccess) {
            onSessionAccess(lead, response.data);
          }
        } else {
          // Local browser session
          setNotification({
            open: true,
            message:
              "🚀 Chromium is launching with the FTD session! The browser will open with saved cookies and login data. You can navigate to any website.",
            severity: "success",
          });
          if (onSessionAccess) {
            onSessionAccess(lead, response.data);
          }
        }
      } else {
        throw new Error(response.data.message || "Failed to access session");
      }
    } catch (error) {
      console.error("Error accessing session:", error);
      setNotification({
        open: true,
        message: error.response?.data?.message || "Failed to access session",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  };
  const getTooltipMessage = () => {
    if (!hasPermission()) {
      return `You do not have permission to access this session. User: ${
        user?.role
      }, Lead assigned to: ${
        lead.assignedTo?._id || lead.assignedTo?.id || lead.assignedTo || "none"
      }`;
    }
    if (!hasActiveSession()) {
      if (!lead.browserSession) {
        return `🧪 Test Mode: Click to launch Chromium with ${lead.firstName} ${lead.lastName}'s FTD data. Browser will navigate to FTD domain and auto-fill the form.`;
      }
      return "No active session available";
    }
    if (isSessionExpired()) {
      return "Session has expired";
    }
    if (sessionHealth?.status === "expiring") {
      return `Session expires in ${sessionHealth.daysUntilExpiration} day(s) - Access soon!`;
    }
    return `🚀 Open browser with ${lead.firstName} ${lead.lastName}'s FTD session - Navigate to any website with saved login data`;
  };
  const getButtonColor = () => {
    if (sessionHealth?.status === "expiring") return "warning";
    if (sessionHealth?.status === "expired") return "error";
    if (!lead.browserSession) {
      return "info";
    }
    return "success";
  };
  const isDisabled =
    disabled ||
    loading ||
    !hasPermission() ||
    (!hasActiveSession() && lead.browserSession) ||
    isSessionExpired();
  const buttonContent = loading ? (
    <CircularProgress size={size === "small" ? 16 : 20} />
  ) : sessionHealth?.status === "expiring" ? (
    <ExpiringIcon fontSize={size} />
  ) : (
    <LaunchIcon fontSize={size} />
  );
  const ButtonComponent = variant === "icon" ? IconButton : Button;
  const buttonProps = {
    size,
    onClick: handleAccessSession,
    disabled: isDisabled,
    color: getButtonColor(),
    ...(variant === "icon" && {
      sx: {
        ...(sessionHealth?.status === "healthy" && {
          backgroundColor: "success.light",
          "&:hover": {
            backgroundColor: "success.main",
            boxShadow: "0 0 10px rgba(76, 175, 80, 0.5)",
          },
        }),
        ...(sessionHealth?.status === "expiring" && {
          backgroundColor: "warning.light",
          "&:hover": {
            backgroundColor: "warning.main",
            boxShadow: "0 0 10px rgba(255, 152, 0, 0.5)",
          },
        }),
      },
    }),
    ...(variant === "button" && {
      startIcon: buttonContent,
      variant: "outlined",
    }),
  };
  return (
    <>
      <Tooltip
        title={
          <Box>
            <Typography variant="body2">{getTooltipMessage()}</Typography>
            {sessionHealth?.status === "expiring" && (
              <Typography
                variant="caption"
                color="warning.light"
                sx={{ display: "block", mt: 0.5 }}
              >
                ⚠️ Session expires soon - consider creating a new session
              </Typography>
            )}
          </Box>
        }
      >
        <span>
          <ButtonComponent {...buttonProps}>
            {variant === "icon" ? buttonContent : "Open Browser"}
          </ButtonComponent>
        </span>
      </Tooltip>
      <Snackbar
        open={notification.open}
        autoHideDuration={notification.severity === "warning" ? 8000 : 6000}
        onClose={() => setNotification({ ...notification, open: false })}
      >
        <Alert
          onClose={() => setNotification({ ...notification, open: false })}
          severity={notification.severity}
          sx={{ width: "100%" }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </>
  );
};
export default SessionAccessButton;
