import { useEffect, useState, useCallback } from "react";
import { useDispatch } from "react-redux";
import toast from "react-hot-toast";
import { logout } from "../store/slices/authSlice.js";
import { backgroundSyncService } from "../services/backgroundSyncService.js";
import chatService from "../services/chatService.js";
import notificationService from "../services/notificationService.js";
import inactivityService from "../services/inactivityService.js";

/**
 * Manages all background services (sync, inactivity, chat, force-logout).
 * Extracts useEffects from AppContent into a single hook.
 */
export function useAppServices(isAuthenticated, user) {
  const dispatch = useDispatch();
  const [inactivityWarningOpen, setInactivityWarningOpen] = useState(false);
  const [warningSecondsRemaining, setWarningSecondsRemaining] = useState(60);

  // Background sync lifecycle
  useEffect(() => {
    if (isAuthenticated && user) {
      backgroundSyncService.start();
    } else {
      backgroundSyncService.stop();
    }
    return () => {
      backgroundSyncService.stop();
    };
  }, [isAuthenticated, user]);

  // Inactivity tracking
  useEffect(() => {
    if (isAuthenticated && user) {
      const handleAutoLogout = (reason) => {
        setInactivityWarningOpen(false);
        let message = "You have been logged out.";
        if (reason === "inactivity") {
          message = "You have been logged out due to 15 minutes of inactivity.";
        } else if (reason === "midnight") {
          message =
            "Daily automatic logout at midnight (00:00 GMT+2). Please log in again.";
        }
        toast.error(message, { duration: 5000 });
        dispatch(logout());
        chatService.disconnect();
      };

      const handleInactivityWarning = (secondsRemaining) => {
        setWarningSecondsRemaining(secondsRemaining);
        setInactivityWarningOpen(true);
      };

      inactivityService.start(handleAutoLogout, handleInactivityWarning);
    } else {
      inactivityService.stop();
      setInactivityWarningOpen(false);
    }
    return () => inactivityService.stop();
  }, [isAuthenticated, user, dispatch]);

  // Countdown timer for warning dialog
  useEffect(() => {
    let countdownInterval;
    if (inactivityWarningOpen && warningSecondsRemaining > 0) {
      countdownInterval = setInterval(() => {
        setWarningSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (countdownInterval) clearInterval(countdownInterval);
    };
  }, [inactivityWarningOpen, warningSecondsRemaining]);

  // Chat service connection
  useEffect(() => {
    if (isAuthenticated && user) {
      if (!chatService.getConnectionStatus().isConnected) {
        chatService.connect();
      }
    }
  }, [isAuthenticated, user]);

  // Force logout listener
  useEffect(() => {
    const handleForceLogout = (data) => {
      toast.error(
        data?.message ||
          "Your session has been terminated by an administrator.",
        { duration: 5000 }
      );
      dispatch(logout());
      chatService.disconnect();
    };
    chatService.on("auth:force_logout", handleForceLogout);
    return () => chatService.off("auth:force_logout", handleForceLogout);
  }, [dispatch]);

  const handleDismissInactivityWarning = useCallback(() => {
    setInactivityWarningOpen(false);
    inactivityService.dismissWarning();
  }, []);

  return {
    inactivityWarningOpen,
    warningSecondsRemaining,
    handleDismissInactivityWarning,
  };
}
