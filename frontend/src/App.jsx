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
import { CssBaseline, CircularProgress, Box } from "@mui/material";
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
import UsersPage from "./pages/UsersPage.jsx";
import ClientNetworksPage from "./pages/ClientNetworksPage.jsx";
import OurNetworksPage from "./pages/OurNetworksPage.jsx";
import ClientBrokersPage from "./pages/ClientBrokersPage.jsx";
import CampaignsPage from "./pages/CampaignsPage.jsx";
import PerformancePage from "./pages/PerformancePage.jsx";
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
import AccountManagementPage from "./pages/AccountManagementPage.jsx";
import GatewayManagementPage from "./pages/GatewayManagementPage.jsx";
import AgentSchedulePage from "./pages/AgentSchedulePage.jsx";
import AgentCallsCalendarPage from "./pages/AgentCallsCalendarPage.jsx";
import ApproveAMCallsPage from "./pages/ApproveAMCallsPage.jsx";
import AnnouncementsPage from "./pages/AnnouncementsPage.jsx";
import AMTargetsPage from "./pages/AMTargetsPage.jsx";
import DepositCallsPage from "./pages/DepositCallsPage.jsx";

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
      console.log('🚪 Force logout triggered:', data);
      // Show toast notification
      toast.error(data?.message || 'Your session has been terminated by an administrator.', {
        duration: 5000,
      });
      // Dispatch logout action
      dispatch(logout());
      // Disconnect chat service
      chatService.disconnect();
    };

    chatService.on('auth:force_logout', handleForceLogout);

    return () => {
      chatService.off('auth:force_logout', handleForceLogout);
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
            <Route path="users" element={<UsersPage />} />
            <Route path="client-networks" element={<ClientNetworksPage />} />
            <Route path="our-networks" element={<OurNetworksPage />} />
            <Route path="client-brokers" element={<ClientBrokersPage />} />
            <Route path="campaigns" element={<CampaignsPage />} />
            <Route path="performance" element={<PerformancePage />} />
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
                <ProtectedRoute allowedRoles={["agent", "affiliate_manager", "admin"]}>
                  <AgentSchedulePage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="agent-call-calendar" 
              element={
                <ProtectedRoute allowedRoles={["agent", "affiliate_manager", "admin"]}>
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
                <ProtectedRoute allowedRoles={["agent", "affiliate_manager", "admin"]}>
                  <AnnouncementsPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="am-targets" 
              element={
                <ProtectedRoute allowedRoles={["affiliate_manager", "admin", "lead_manager"]}>
                  <AMTargetsPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="deposit-calls" 
              element={
                <ProtectedRoute allowedRoles={["agent", "affiliate_manager", "admin"]}>
                  <DepositCallsPage />
                </ProtectedRoute>
              } 
            />

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
      <DisclaimerModal open={disclaimerOpen} onAgree={handleAgree} />
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
