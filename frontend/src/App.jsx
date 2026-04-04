import React, { lazy, Suspense, useState, useEffect } from "react";
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
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Skeleton,
} from "@mui/material";
import { Toaster } from "react-hot-toast";
import { store, persistor } from "./store/store";
import { selectUser, selectIsAuthenticated, acceptEula } from "./store/slices/authSlice.js";
import { useAppServices } from "./hooks/useAppServices.js";
import ProtectedRoute from "./components/common/ProtectedRoute.jsx";
import PublicRoute from "./components/common/PublicRoute.jsx";
import MainLayout from "./layouts/MainLayout.jsx";
import DisclaimerModal from "./components/common/DisclaimerModal.jsx";
import ErrorBoundary from "./components/common/ErrorBoundary.jsx";
import PageLoadingFallback from "./components/common/PageLoadingFallback.jsx";

// --- Lazy-loaded pages (code splitting) ---
const LoginPage = lazy(() => import("./pages/LoginPage.jsx"));
const RegisterPage = lazy(() => import("./pages/RegisterPage.jsx"));
const LandingPage = lazy(() => import("./pages/LandingPage.jsx"));
const DashboardPage = lazy(() => import("./pages/DashboardPage.jsx"));
const OrdersPage = lazy(() => import("./pages/OrdersPage.jsx"));
const LeadsPage = lazy(() => import("./pages/LeadsPage.jsx"));
const DeletedLeadsPage = lazy(() => import("./pages/DeletedLeadsPage.jsx"));
const UsersPage = lazy(() => import("./pages/UsersPage.jsx"));
const ClientNetworksPage = lazy(() => import("./pages/ClientNetworksPage.jsx"));
const OurNetworksPage = lazy(() => import("./pages/OurNetworksPage.jsx"));
const ClientBrokersPage = lazy(() => import("./pages/ClientBrokersPage.jsx"));
const CampaignsPage = lazy(() => import("./pages/CampaignsPage.jsx"));
const ProfilePage = lazy(() => import("./pages/ProfilePage.jsx"));
const PayrollPage = lazy(() => import("./pages/PayrollPage.jsx"));
const WithdrawalsPage = lazy(() => import("./pages/WithdrawalsPage.jsx"));
const PaymentHistoryPage = lazy(() => import("./pages/PaymentHistoryPage.jsx"));
const AffiliateManagersPage = lazy(() => import("./pages/AffiliateManagersPage.jsx"));
const AffiliateManagerTableView = lazy(() => import("./components/AffiliateManagerTableView.jsx"));
const RefundsPage = lazy(() => import("./pages/RefundsPage.jsx"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage.jsx"));
const DisclaimerPage = lazy(() => import("./pages/DisclaimerPage.jsx"));
const VerificationsPage = lazy(() => import("./pages/VerificationsPage.jsx"));
const TicketsPage = lazy(() => import("./pages/TicketsPage.jsx"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage.jsx"));
const SMSGatewayPage = lazy(() => import("./pages/SMSGatewayPage.jsx"));
const AccountManagementPage = lazy(() => import("./pages/AccountManagementPage.jsx"));
const ClientNetworkProfilePage = lazy(() => import("./pages/ClientNetworkProfilePage.jsx"));
const ClientBrokerProfilePage = lazy(() => import("./pages/ClientBrokerProfilePage.jsx"));
const PSPProfilePage = lazy(() => import("./pages/PSPProfilePage.jsx"));
const ClientPSPsPage = lazy(() => import("./pages/ClientPSPsPage.jsx"));
const CardIssuersPage = lazy(() => import("./pages/CardIssuersPage.jsx"));
// GatewayManagementPage removed - merged into SMSGatewayPage
// ApproveAMCallsPage removed - covered by PendingPage and DepositCallsPage
const AnnouncementsPage = lazy(() => import("./pages/AnnouncementsPage.jsx"));
const AMTargetsPage = lazy(() => import("./pages/AMTargetsPage.jsx"));
const DepositCallsPage = lazy(() => import("./pages/DepositCallsPage.jsx"));
const NotesPage = lazy(() => import("./pages/NotesPage.jsx"));
const MobileApprovalPage = lazy(() => import("./pages/MobileApprovalPage.jsx"));
const MobileActionApprovalPage = lazy(() => import("./pages/MobileActionApprovalPage.jsx"));
const QRSetupPage = lazy(() => import("./pages/QRSetupPage.jsx"));
const SearchResultsPage = lazy(() => import("./pages/SearchResultsPage.jsx"));
const WorkspacePage = lazy(() => import("./pages/WorkspacePage.jsx"));
const CrmPage = lazy(() => import("./pages/CrmPage.jsx"));
const AMExpensesPage = lazy(() => import("./pages/AMExpensesPage.jsx"));
const AmiAgentsPage = lazy(() => import("./pages/AmiAgentsPage.jsx"));
const FinesPage = lazy(() => import("./pages/FinesPage.jsx"));
const InjectionPage = lazy(() => import("./pages/InjectionPage.jsx"));
const CallDeclarationsPage = lazy(() => import("./pages/CallDeclarationsPage.jsx"));
const PendingPage = lazy(() => import("./pages/PendingPage.jsx"));
const FinancePage = lazy(() => import("./pages/FinancePage.jsx"));
const AdminPage = lazy(() => import("./pages/AdminPage.jsx"));
const EmployeeDashboardPage = lazy(() => import("./pages/EmployeeDashboardPage.jsx"));
const GlobalTrackingHistoryPage = lazy(() => import("./pages/GlobalTrackingHistoryPage.jsx"));
const QRScannerPage = lazy(() => import("./pages/QRScannerPage.jsx"));

// Component to handle role-based default routing
const RoleBasedRedirect = () => {
  const user = useSelector(selectUser);

  if (!user) {
    return <Navigate to="/dashboard" replace />;
  }

  // Redirect agents to deposit calls page instead of dashboard
  if (user.role === "agent") {
    return <Navigate to="/deposit-calls" replace />;
  }

  // Redirect refunds manager to refunds page
  if (user.role === "refunds_manager") {
    return <Navigate to="/refunds" replace />;
  }

  // Redirect employees to their dashboard
  if (user.role === "employee") {
    return <Navigate to="/employee-dashboard" replace />;
  }

  // Redirect inventory manager to SMS gateway page
  if (user.role === "inventory_manager") {
    return <Navigate to="/sms" replace />;
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

// Suspense wrapper with ErrorBoundary for lazy routes
const LazyPage = ({ children }) => (
  <ErrorBoundary>
    <Suspense fallback={<PageLoadingFallback />}>{children}</Suspense>
  </ErrorBoundary>
);

function AppContent() {
  const dispatch = useDispatch();
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);

  // All background services consolidated into a single hook
  const {
    inactivityWarningOpen,
    warningSecondsRemaining,
    handleDismissInactivityWarning,
  } = useAppServices(isAuthenticated, user);

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
                <LazyPage>
                  <LoginPage />
                </LazyPage>
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <LazyPage>
                  <RegisterPage />
                </LazyPage>
              </PublicRoute>
            }
          />
          <Route
            path="/landing"
            element={
              <LazyPage>
                <LandingPage />
              </LazyPage>
            }
          />
          <Route
            path="/disclaimer"
            element={
              <LazyPage>
                <DisclaimerPage />
              </LazyPage>
            }
          />
          {/* QR Code Mobile Approval - Public route for phone */}
          <Route
            path="/qr-approve/:sessionToken"
            element={
              <LazyPage>
                <MobileApprovalPage />
              </LazyPage>
            }
          />
          {/* QR Code Sensitive Action Approval - Public route for phone */}
          <Route
            path="/qr-approve-action/:sessionToken"
            element={
              <LazyPage>
                <MobileActionApprovalPage />
              </LazyPage>
            }
          />
          {/* QR Code Device Setup - Public route for phone */}
          <Route
            path="/qr-setup/:userId/:setupToken"
            element={
              <LazyPage>
                <QRSetupPage />
              </LazyPage>
            }
          />
          {/* In-app QR Scanner - Protected (must be logged in on phone) */}
          <Route
            path="/scan"
            element={
              <ProtectedRoute>
                <LazyPage>
                  <QRScannerPage />
                </LazyPage>
              </ProtectedRoute>
            }
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
            <Route path="dashboard" element={<LazyPage><DashboardPage /></LazyPage>} />
            <Route path="orders" element={<LazyPage><OrdersPage /></LazyPage>} />
            <Route path="leads" element={<LazyPage><LeadsPage /></LazyPage>} />
            <Route path="deleted-leads" element={<LazyPage><DeletedLeadsPage /></LazyPage>} />
            <Route path="users" element={<LazyPage><UsersPage /></LazyPage>} />
            <Route path="client-networks" element={<LazyPage><ClientNetworksPage /></LazyPage>} />
            <Route path="our-networks" element={<LazyPage><OurNetworksPage /></LazyPage>} />
            <Route path="client-brokers" element={<LazyPage><ClientBrokersPage /></LazyPage>} />
            <Route
              path="client-psps"
              element={
                <ProtectedRoute allowedRoles={["admin", "affiliate_manager"]}>
                  <LazyPage><ClientPSPsPage /></LazyPage>
                </ProtectedRoute>
              }
            />
            <Route
              path="card-issuers"
              element={
                <ProtectedRoute allowedRoles={["admin", "affiliate_manager"]}>
                  <LazyPage><CardIssuersPage /></LazyPage>
                </ProtectedRoute>
              }
            />
            <Route path="campaigns" element={<LazyPage><CampaignsPage /></LazyPage>} />
            <Route
              path="crm"
              element={
                <ProtectedRoute allowedRoles={["admin", "affiliate_manager"]}>
                  <LazyPage><CrmPage /></LazyPage>
                </ProtectedRoute>
              }
            />
            <Route
              path="admin"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <LazyPage><AdminPage /></LazyPage>
                </ProtectedRoute>
              }
            />
            <Route
              path="finance"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <LazyPage><FinancePage /></LazyPage>
                </ProtectedRoute>
              }
            />
            <Route path="payroll" element={<LazyPage><PayrollPage /></LazyPage>} />
            <Route path="withdrawals" element={<LazyPage><WithdrawalsPage /></LazyPage>} />
            <Route path="payment-history" element={<LazyPage><PaymentHistoryPage /></LazyPage>} />
            <Route
              path="affiliate-managers"
              element={<LazyPage><AffiliateManagersPage /></LazyPage>}
            />
            <Route
              path="am-expenses"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <LazyPage><AMExpensesPage /></LazyPage>
                </ProtectedRoute>
              }
            />
            <Route path="my-table" element={<LazyPage><AffiliateManagerTableView /></LazyPage>} />
            <Route path="profile" element={<LazyPage><ProfilePage /></LazyPage>} />
            <Route
              path="refunds"
              element={
                <ProtectedRoute allowedRoles={["refunds_manager", "admin"]}>
                  <LazyPage><RefundsPage /></LazyPage>
                </ProtectedRoute>
              }
            />
            <Route
              path="verifications"
              element={
                <ProtectedRoute allowedRoles={["admin", "lead_manager"]}>
                  <LazyPage><VerificationsPage /></LazyPage>
                </ProtectedRoute>
              }
            />
            <Route
              path="workspace"
              element={
                <ProtectedRoute allowedRoles={["admin", "lead_manager"]}>
                  <LazyPage><WorkspacePage /></LazyPage>
                </ProtectedRoute>
              }
            />
            <Route path="tickets" element={<LazyPage><TicketsPage /></LazyPage>} />
            <Route path="notifications" element={<LazyPage><NotificationsPage /></LazyPage>} />
            <Route path="simcards" element={<Navigate to="/sms" replace />} />
            <Route
              path="sms"
              element={
                <ProtectedRoute allowedRoles={["admin", "inventory_manager", "affiliate_manager", "lead_manager", "refunds_manager"]}>
                  <LazyPage><SMSGatewayPage /></LazyPage>
                </ProtectedRoute>
              }
            />
            <Route
              path="account-management"
              element={
                <ProtectedRoute allowedRoles={["admin", "affiliate_manager"]}>
                  <LazyPage><AccountManagementPage /></LazyPage>
                </ProtectedRoute>
              }
            />
            <Route
              path="client-network/:id"
              element={
                <ProtectedRoute allowedRoles={["admin", "affiliate_manager"]}>
                  <LazyPage><ClientNetworkProfilePage /></LazyPage>
                </ProtectedRoute>
              }
            />
            <Route
              path="client-broker/:id"
              element={
                <ProtectedRoute allowedRoles={["admin", "affiliate_manager"]}>
                  <LazyPage><ClientBrokerProfilePage /></LazyPage>
                </ProtectedRoute>
              }
            />
            <Route
              path="psp/:id"
              element={
                <ProtectedRoute allowedRoles={["admin", "affiliate_manager"]}>
                  <LazyPage><PSPProfilePage /></LazyPage>
                </ProtectedRoute>
              }
            />
            <Route
              path="gateway-devices"
              element={<Navigate to="/sms" replace />}
            />
            <Route
              path="pending"
              element={
                <ProtectedRoute allowedRoles={["affiliate_manager", "admin"]}>
                  <LazyPage><PendingPage /></LazyPage>
                </ProtectedRoute>
              }
            />
            <Route
              path="announcements"
              element={
                <ProtectedRoute
                  allowedRoles={["agent", "affiliate_manager", "admin"]}
                >
                  <LazyPage><AnnouncementsPage /></LazyPage>
                </ProtectedRoute>
              }
            />
            <Route
              path="am-targets"
              element={
                <ProtectedRoute
                  allowedRoles={["affiliate_manager", "admin", "lead_manager"]}
                >
                  <LazyPage><AMTargetsPage /></LazyPage>
                </ProtectedRoute>
              }
            />
            <Route
              path="deposit-calls"
              element={
                <ProtectedRoute
                  allowedRoles={["agent", "affiliate_manager", "admin"]}
                >
                  <LazyPage><DepositCallsPage /></LazyPage>
                </ProtectedRoute>
              }
            />
            <Route
              path="call-declarations"
              element={
                <ProtectedRoute
                  allowedRoles={["agent", "affiliate_manager", "admin"]}
                >
                  <LazyPage><CallDeclarationsPage /></LazyPage>
                </ProtectedRoute>
              }
            />
            <Route path="notes" element={<LazyPage><NotesPage /></LazyPage>} />
            <Route path="search" element={<LazyPage><SearchResultsPage /></LazyPage>} />
            <Route
              path="fines"
              element={
                <LazyPage><FinesPage /></LazyPage>
              }
            />
            <Route
              path="ami-agents"
              element={
                <ProtectedRoute allowedRoles={["admin", "affiliate_manager"]}>
                  <LazyPage><AmiAgentsPage /></LazyPage>
                </ProtectedRoute>
              }
            />
            <Route
              path="injections"
              element={
                <ProtectedRoute allowedRoles={["admin", "affiliate_manager", "agent"]}>
                  <LazyPage><InjectionPage /></LazyPage>
                </ProtectedRoute>
              }
            />
            <Route
              path="employee-dashboard"
              element={
                <ProtectedRoute allowedRoles={["employee", "admin"]}>
                  <LazyPage><EmployeeDashboardPage /></LazyPage>
                </ProtectedRoute>
              }
            />
            <Route
              path="tracking-history"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <LazyPage><GlobalTrackingHistoryPage /></LazyPage>
                </ProtectedRoute>
              }
            />
          </Route>
          {}
          <Route
            path="*"
            element={
              <LazyPage>
                <NotFoundPage />
              </LazyPage>
            }
          />
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
          Session Timeout Warning
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

// App-level loading skeleton for PersistGate
function AppLoadingSkeleton() {
  return (
    <Box
      display="flex"
      flexDirection="column"
      minHeight="100vh"
      bgcolor="#f5f5f5"
    >
      {/* Top bar skeleton */}
      <Skeleton variant="rectangular" width="100%" height={64} />
      {/* Content area */}
      <Box display="flex" flex={1}>
        {/* Sidebar skeleton */}
        <Skeleton
          variant="rectangular"
          width={240}
          sx={{ height: "100%", minHeight: "calc(100vh - 64px)" }}
        />
        {/* Main content skeleton */}
        <Box flex={1} p={3}>
          <Skeleton variant="text" width={200} height={40} sx={{ mb: 2 }} />
          <Skeleton variant="rounded" width="100%" height={300} />
        </Box>
      </Box>
    </Box>
  );
}

function App() {
  return (
    <Provider store={store}>
      <PersistGate loading={<AppLoadingSkeleton />} persistor={persistor}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <AppContent />
        </ThemeProvider>
      </PersistGate>
    </Provider>
  );
}

export default App;
