import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Provider, useSelector, useDispatch } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import {
  CssBaseline,
  CircularProgress,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from "@mui/material";
import toast, { Toaster } from "react-hot-toast";
import { store, persistor } from "./store/store";
import {
  selectUser,
  selectIsAuthenticated,
  acceptEula,
  logout,
} from "./store/slices/authSlice.js";
import { backgroundSyncService } from "./services/backgroundSyncService.js";
import chatService from "./services/chatService.js";
import notificationService from "./services/notificationService.js";
import inactivityService from "./services/inactivityService.js";
import activityTrackerService from "./services/activityTrackerService.js";
import ProtectedRoute from "./components/common/ProtectedRoute.jsx";
import PublicRoute from "./components/common/PublicRoute.jsx";
import MainLayout from "./layouts/MainLayout.jsx";
import DisclaimerModal from "./components/common/DisclaimerModal.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import OrdersPage from "./pages/OrdersPage.jsx";
import LeadsPage from "./pages/LeadsPage.jsx";
import DeletedLeadsPage from "./pages/DeletedLeadsPage.jsx";
import UsersPage from "./pages/UsersPage.jsx";
import ClientNetworksPage from "./pages/ClientNetworksPage.jsx";
import OurNetworksPage from "./pages/OurNetworksPage.jsx";
import ClientBrokersPage from "./pages/ClientBrokersPage.jsx";
import CampaignsPage from "./pages/CampaignsPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import PayrollPage from "./pages/PayrollPage.jsx";
import WithdrawalsPage from "./pages/WithdrawalsPage.jsx";
import PaymentHistoryPage from "./pages/PaymentHistoryPage.jsx";
import AffiliateManagersPage from "./pages/AffiliateManagersPage.jsx";
import AffiliateManagerTableView from "./components/AffiliateManagerTableView.jsx";
import AgentCommentsPage from "./pages/AgentCommentsPage.jsx";
import RefundsPage from "./pages/RefundsPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import DisclaimerPage from "./pages/DisclaimerPage.jsx";
import VerificationsPage from "./pages/VerificationsPage.jsx";
import TicketsPage from "./pages/TicketsPage.jsx";
import NotificationsPage from "./pages/NotificationsPage.jsx";
import SimCardsPage from "./pages/SimCardsPage.jsx";
import NumberPage from "./pages/NumberPage.jsx";
import SMSPage from "./pages/SMSPage.jsx";
import AccountManagementPage from "./pages/AccountManagementPage.jsx";
import GatewayManagementPage from "./pages/GatewayManagementPage.jsx";
import AgentSchedulePage from "./pages/AgentSchedulePage.jsx";
import AgentCallsCalendarPage from "./pages/AgentCallsCalendarPage.jsx";
import ApproveAMCallsPage from "./pages/ApproveAMCallsPage.jsx";
import AnnouncementsPage from "./pages/AnnouncementsPage.jsx";
import AMTargetsPage from "./pages/AMTargetsPage.jsx";
import DepositCallsPage from "./pages/DepositCallsPage.jsx";
import NotesPage from "./pages/NotesPage.jsx";
import PerformancePage from "./pages/PerformancePage.jsx";
import MobileApprovalPage from "./pages/MobileApprovalPage.jsx";
import MobileActionApprovalPage from "./pages/MobileActionApprovalPage.jsx";
import QRSetupPage from "./pages/QRSetupPage.jsx";
import SearchResultsPage from "./pages/SearchResultsPage.jsx";
import SheetsPage from "./pages/SheetsPage.jsx";
import WorkspacePage from "./pages/WorkspacePage.jsx";

import GlobalPen from "./components/GlobalPen.jsx";

// Component to handle role-based default routing
const RoleBasedRedirect = () => {
  const user = useSelector(selectUser);

  if (!user) {
    return <Navigate to="/dashboard" replace />;
  }

  // Redirect agents to leads page instead of dashboard
  if (user.role === "agent") {
    return <Navigate to="/leads" replace />;
  }

  // Redirect refunds manager to refunds page
  if (user.role === "refunds_manager") {
    return <Navigate to="/refunds" replace />;
  }

  // Redirect inventory manager to simcards page
  if (user.role === "inventory_manager") {
    return <Navigate to="/simcards" replace />;
  }

  // All other roles go to dashboard
  return <Navigate to="/dashboard" replace />;
};

const theme = createTheme({
  palette: {
    primary: {
      main: "#1976d2",
      light: "#42a5f5",
      dark: "#1565c0",
    },
    secondary: {
      main: "#dc004e",
      light: "#ff5983",
      dark: "#9a0036",
    },
    background: {
      default: "#f5f5f5",
      paper: "#ffffff",
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.1)",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
        },
      },
    },
  },
});

function AppContent() {
  const dispatch = useDispatch();
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [inactivityWarningOpen, setInactivityWarningOpen] = useState(false);
  const [warningSecondsRemaining, setWarningSecondsRemaining] = useState(60);
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);

  // Initialize background sync service when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      backgroundSyncService.start();
    } else {
      backgroundSyncService.stop();
    }

    // Cleanup on unmount
    return () => {
      backgroundSyncService.stop();
    };
  }, [isAuthenticated, user]);

  // Initialize activity tracker service for performance monitoring
  useEffect(() => {
    if (isAuthenticated && user) {
      // Start activity tracking
      activityTrackerService.start();
    } else {
      // Stop activity tracking when logged out
      activityTrackerService.stop();
    }

    // Cleanup on unmount
    return () => {
      activityTrackerService.stop();
    };
  }, [isAuthenticated, user]);

  // Track page navigation for activity tracker
  useEffect(() => {
    const handleRouteChange = () => {
      if (activityTrackerService.isRunning) {
        activityTrackerService.trackPageVisit(
          window.location.pathname,
          document.title
        );
      }
    };

    // Initial page track
    handleRouteChange();

    // Listen for popstate (back/forward navigation)
    window.addEventListener("popstate", handleRouteChange);

    return () => {
      window.removeEventListener("popstate", handleRouteChange);
    };
  }, []);

  // Initialize inactivity tracking service for auto-logout
  useEffect(() => {
    if (isAuthenticated && user) {
      // Define logout handler
      const handleAutoLogout = (reason) => {
        console.log(`🚪 Auto-logout triggered: ${reason}`);
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

      // Define warning handler
      const handleInactivityWarning = (secondsRemaining) => {
        console.log(
          `⚠️ Inactivity warning: ${secondsRemaining} seconds until logout`
        );
        setWarningSecondsRemaining(secondsRemaining);
        setInactivityWarningOpen(true);
      };

      // Start inactivity tracking
      inactivityService.start(handleAutoLogout, handleInactivityWarning);
    } else {
      inactivityService.stop();
      setInactivityWarningOpen(false);
    }

    // Cleanup on unmount
    return () => {
      inactivityService.stop();
    };
  }, [isAuthenticated, user, dispatch]);

  // Handle dismissing inactivity warning
  const handleDismissInactivityWarning = () => {
    setInactivityWarningOpen(false);
    inactivityService.dismissWarning();
  };

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
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
    };
  }, [inactivityWarningOpen, warningSecondsRemaining]);

  // Initialize chat service for global notifications
  useEffect(() => {
    if (isAuthenticated && user) {
      // Connect to chat service for global notifications
      if (!chatService.getConnectionStatus().isConnected) {
        chatService.connect();
      }

      // Don't disconnect here - let other components manage their own lifecycle
    }
  }, [isAuthenticated, user]);

  // Listen for force logout event (session kicked by admin)
  useEffect(() => {
    const handleForceLogout = (data) => {
      console.log("🚪 Force logout triggered:", data);
      // Show toast notification
      toast.error(
        data?.message ||
          "Your session has been terminated by an administrator.",
        {
          duration: 5000,
        }
      );
      // Dispatch logout action
      dispatch(logout());
      // Disconnect chat service
      chatService.disconnect();
    };

    chatService.on("auth:force_logout", handleForceLogout);

    return () => {
      chatService.off("auth:force_logout", handleForceLogout);
    };
  }, [dispatch]);

  useEffect(() => {
    if (isAuthenticated && user && !user.eulaAccepted) {
      setDisclaimerOpen(true);
    } else {
      setDisclaimerOpen(false);
    }
  }, [isAuthenticated, user]);
  const handleAgree = () => {
    dispatch(acceptEula());
  };
  return (
    <>
      <Router>
        <Routes>
          {}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <RegisterPage />
              </PublicRoute>
            }
          />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/disclaimer" element={<DisclaimerPage />} />
          {/* QR Code Mobile Approval - Public route for phone */}
          <Route
            path="/qr-approve/:sessionToken"
            element={<MobileApprovalPage />}
          />
          {/* QR Code Sensitive Action Approval - Public route for phone */}
          <Route
            path="/qr-approve-action/:sessionToken"
            element={<MobileActionApprovalPage />}
          />
          {/* QR Code Device Setup - Public route for phone */}
          <Route
            path="/qr-setup/:userId/:setupToken"
            element={<QRSetupPage />}
          />
          {}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<RoleBasedRedirect />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="leads" element={<LeadsPage />} />
            <Route path="deleted-leads" element={<DeletedLeadsPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="client-networks" element={<ClientNetworksPage />} />
            <Route path="our-networks" element={<OurNetworksPage />} />
            <Route path="client-brokers" element={<ClientBrokersPage />} />
            <Route path="campaigns" element={<CampaignsPage />} />
            <Route path="payroll" element={<PayrollPage />} />
            <Route path="withdrawals" element={<WithdrawalsPage />} />
            <Route path="payment-history" element={<PaymentHistoryPage />} />
            <Route
              path="affiliate-managers"
              element={<AffiliateManagersPage />}
            />
            <Route path="my-table" element={<AffiliateManagerTableView />} />
            <Route
              path="agent-comments"
              element={
                <ProtectedRoute allowedRoles={["admin", "affiliate_manager"]}>
                  <AgentCommentsPage />
                </ProtectedRoute>
              }
            />
            <Route path="profile" element={<ProfilePage />} />
            <Route
              path="refunds"
              element={
                <ProtectedRoute allowedRoles={["refunds_manager", "admin"]}>
                  <RefundsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="verifications"
              element={
                <ProtectedRoute allowedRoles={["admin", "lead_manager"]}>
                  <VerificationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="workspace"
              element={
                <ProtectedRoute allowedRoles={["admin", "lead_manager"]}>
                  <WorkspacePage />
                </ProtectedRoute>
              }
            />
            <Route path="tickets" element={<TicketsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route
              path="simcards"
              element={
                <ProtectedRoute allowedRoles={["inventory_manager", "admin"]}>
                  <SimCardsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="numbers"
              element={
                <ProtectedRoute allowedRoles={["admin", "lead_manager"]}>
                  <NumberPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="sms"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <SMSPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="account-management"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AccountManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="gateway-devices"
              element={
                <ProtectedRoute allowedRoles={["inventory_manager", "admin"]}>
                  <GatewayManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="agent-schedule"
              element={
                <ProtectedRoute
                  allowedRoles={["agent", "affiliate_manager", "admin"]}
                >
                  <AgentSchedulePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="agent-call-calendar"
              element={
                <ProtectedRoute
                  allowedRoles={["agent", "affiliate_manager", "admin"]}
                >
                  <AgentCallsCalendarPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="approve-am-calls"
              element={
                <ProtectedRoute allowedRoles={["affiliate_manager", "admin"]}>
                  <ApproveAMCallsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="announcements"
              element={
                <ProtectedRoute
                  allowedRoles={["agent", "affiliate_manager", "admin"]}
                >
                  <AnnouncementsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="am-targets"
              element={
                <ProtectedRoute
                  allowedRoles={["affiliate_manager", "admin", "lead_manager"]}
                >
                  <AMTargetsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="deposit-calls"
              element={
                <ProtectedRoute
                  allowedRoles={["agent", "affiliate_manager", "admin"]}
                >
                  <DepositCallsPage />
                </ProtectedRoute>
              }
            />
            <Route path="notes" element={<NotesPage />} />
            <Route
              path="performance"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <PerformancePage />
                </ProtectedRoute>
              }
            />
            <Route path="search" element={<SearchResultsPage />} />
            <Route path="sheets" element={<SheetsPage />} />
          </Route>
          {}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Router>
      {}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: "#363636",
            color: "#fff",
          },
          success: {
            duration: 3000,
            theme: {
              primary: "green",
              secondary: "black",
            },
          },
        }}
      />
      <GlobalPen />
      <DisclaimerModal open={disclaimerOpen} onAgree={handleAgree} />

      {/* Inactivity Warning Dialog */}
      <Dialog
        open={inactivityWarningOpen}
        onClose={handleDismissInactivityWarning}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          },
        }}
      >
        <DialogTitle
          sx={{
            bgcolor: "warning.main",
            color: "warning.contrastText",
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          ⚠️ Session Timeout Warning
        </DialogTitle>
        <DialogContent sx={{ pt: 3, pb: 2 }}>
          <Typography variant="body1" gutterBottom>
            You will be automatically logged out due to inactivity in:
          </Typography>
          <Typography
            variant="h2"
            sx={{
              textAlign: "center",
              my: 2,
              color:
                warningSecondsRemaining <= 30 ? "error.main" : "text.primary",
              fontWeight: "bold",
            }}
          >
            {warningSecondsRemaining}s
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Click "Stay Logged In" or interact with the page to continue your
            session.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={handleDismissInactivityWarning}
            variant="contained"
            color="primary"
            size="large"
            fullWidth
            sx={{ fontWeight: "bold" }}
          >
            Stay Logged In
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function App() {
  return (
    <Provider store={store}>
      <PersistGate
        loading={
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            minHeight="100vh"
          >
            <CircularProgress />
          </Box>
        }
        persistor={persistor}
      >
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <AppContent />
        </ThemeProvider>
      </PersistGate>
    </Provider>
  );
}

export default App;
