import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import {
  Box,
  CssBaseline,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  Divider,
  useTheme,
  useMediaQuery,
  Tooltip,
  Chip,
} from "@mui/material";
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Assignment as OrdersIcon,
  Contacts as LeadsIcon,
  People as UsersIcon,
  AccountCircle as AccountIcon,
  Logout as LogoutIcon,
  AttachMoney as PaymentIcon,
  Hub as NetworkIcon,
  Campaign as CampaignIcon,
  Business as BusinessIcon,
  AccountBalanceWallet as WithdrawIcon,
  History as HistoryIcon,
  TableChart as TableIcon,
  VerifiedUser as VerificationIcon,
  Undo as RefundsIcon,
  Comment as CommentIcon,
  SupportAgent as TicketIcon,
  SimCard as SimCardIcon,
  AdminPanelSettings as AdminIcon,
  CalendarMonth as CalendarIcon,
  CheckCircle as ApproveIcon,
  Announcement as AnnouncementIcon,
  TrackChanges as TargetIcon,
  PhoneCallback as DepositCallIcon,
  Security as SecurityIcon,
  Note as NoteIcon,
  Speed as PerformanceIcon,
  GridOn as SheetsIcon,
  Sms as SmsIcon,
  Workspaces as WorkspaceIcon,
  Payment as PSPIcon,
  CreditCard as CardIssuerIcon,
  Handshake as CrmIcon,
  ReceiptLong as ReceiptLongIcon,
  Headset as HeadsetIcon,
  Gavel as GavelIcon,
  Vaccines as InjectionIcon,
  AccountBalance as FinanceIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from "@mui/icons-material";
import {
  logout,
  selectUser,
  selectAuth,
  verify2FAAndLogin,
  verify2FAAndSwitch,
  completeQRLogin,
  clear2FAState
} from "../store/slices/authSlice";
import Footer from "./Footer";
import ChatButton from "../components/ChatButton";
import UserSwitcher from "../components/UserSwitcher";
import QuickSwitcher from "../components/QuickSwitcher";
import NotificationBell from "../components/NotificationBell";
import GlobalSearch from "../components/GlobalSearch";
import Force2FASetup from "../components/Force2FASetup";
import AnnouncementPopup from "../components/AnnouncementPopup";
import FineNotificationPopup from "../components/FineNotificationPopup";
import TicketHeaderButton from "../components/TicketHeaderButton";
import TwoFactorVerification from "../components/TwoFactorVerification";
import QRCodeLogin from "../components/QRCodeLogin";
import { Reorder, useDragControls } from "framer-motion";
import debounce from "lodash.debounce";
import { loadNavOrder, saveNavOrder, applyNavOrder, loadNavOrderFromCache, clearNavOrderCache } from "../utils/sidebarNavOrder";

const SIDEBAR_WIDTH_EXPANDED = 280;
const SIDEBAR_WIDTH_COLLAPSED = 72;
const HEADER_HEIGHT = 64;
const ACCENT_COLOR = "#f57c00";

const SIDEBAR_BG = "linear-gradient(180deg, #1e3a5f 0%, #152d4a 100%)";

const SidebarNavItem = ({ item, isSelected, onNavigate, collapsed }) => {
  const dragControls = useDragControls();

  const navItemContent = (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={dragControls}
      style={{ listStyle: "none", margin: 0, padding: 0, paddingInlineStart: 0, width: "100%", boxSizing: "border-box" }}
    >
      <ListItem
        button
        onClick={() => onNavigate(item.path)}
        selected={isSelected}
        sx={{
          py: 1,
          px: collapsed ? 0 : 2,
          mx: collapsed ? 0 : 1,
          my: 0.3,
          minHeight: 44,
          width: collapsed ? "100%" : "calc(100% - 16px)",
          boxSizing: "border-box",
          borderRadius: collapsed ? 0 : "10px",
          justifyContent: collapsed ? "center" : "flex-start",
          borderLeft: isSelected ? `3px solid ${ACCENT_COLOR}` : "3px solid transparent",
          transition: "all 0.2s ease",
          "&:hover": {
            backgroundColor: "rgba(255, 255, 255, 0.08)",
          },
          "&.Mui-selected": {
            backgroundColor: "rgba(255, 255, 255, 0.15)",
            "&:hover": {
              backgroundColor: "rgba(255, 255, 255, 0.18)",
            },
          },
        }}
      >
        <ListItemIcon
          sx={{
            color: isSelected ? "#fff" : "rgba(255, 255, 255, 0.7)",
            minWidth: collapsed ? 0 : 36,
            justifyContent: "center",
            cursor: "grab",
            "&:active": { cursor: "grabbing" },
            "& .MuiSvgIcon-root": { fontSize: 22 },
            transition: "color 0.2s ease",
          }}
          onPointerDown={(e) => {
            e.preventDefault();
            dragControls.start(e);
          }}
        >
          {item.icon}
        </ListItemIcon>
        {!collapsed && (
          <ListItemText
            primary={item.text}
            sx={{ flex: 1, minWidth: 0, ml: 0.5 }}
            primaryTypographyProps={{
              fontSize: 14,
              fontWeight: isSelected ? 600 : 500,
              noWrap: true,
              color: isSelected ? "#fff" : "rgba(255, 255, 255, 0.85)",
              sx: { transition: "color 0.2s ease" },
            }}
          />
        )}
      </ListItem>
    </Reorder.Item>
  );

  if (collapsed) {
    return (
      <Tooltip title={item.text} placement="right" arrow>
        {navItemContent}
      </Tooltip>
    );
  }

  return navItemContent;
};

const MainLayout = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem("sidebarCollapsed");
      return stored === "true";
    } catch {
      return false;
    }
  });
  const [anchorEl, setAnchorEl] = useState(null);
  const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false);
  const [navOrder, setNavOrder] = useState(() => loadNavOrderFromCache());
  const [orderedItems, setOrderedItems] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const { requires2FA, twoFactorUserId, twoFactorToken, twoFactorMode, useQRAuth, isLoading } = useSelector(selectAuth);
  const [show2FADialog, setShow2FADialog] = useState(false);
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState('');

  const currentSidebarWidth = isMobile ? SIDEBAR_WIDTH_EXPANDED : (sidebarCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED);

  // Handle 2FA/QR Dialog visibility based on Redux state
  useEffect(() => {
    if (requires2FA && twoFactorUserId) {
      if (useQRAuth) {
        setShowQRDialog(true);
        setShow2FADialog(false);
      } else {
        setShow2FADialog(true);
        setShowQRDialog(false);
      }
    } else {
      setShow2FADialog(false);
      setShowQRDialog(false);
    }
  }, [requires2FA, twoFactorUserId, useQRAuth]);

  const handle2FAClose = () => {
    setShow2FADialog(false);
    setTwoFactorError('');
    dispatch(clear2FAState());
  };

  const handleQRClose = () => {
    setShowQRDialog(false);
    dispatch(clear2FAState());
  };

  const handle2FAVerification = async (code, useBackupCode) => {
    setTwoFactorError('');
    try {
      let result;
      if (twoFactorMode === 'switch') {
        // Account switch 2FA verification
        result = await dispatch(verify2FAAndSwitch({
          tempToken: twoFactorToken,
          token: code,
          useBackupCode
        })).unwrap();
      } else {
        // Login 2FA verification
        result = await dispatch(verify2FAAndLogin({
          userId: twoFactorUserId,
          token: code,
          useBackupCode
        })).unwrap();
      }

      if (result.token) {
        setShow2FADialog(false);
        // Redirect to dashboard after successful account switch via 2FA
        if (twoFactorMode === 'switch') {
          navigate('/');
        }
      }
    } catch (error) {
       setTwoFactorError(error || '2FA verification failed');
    }
  };

  const handleQRLoginSuccess = async (token, user) => {
    await dispatch(completeQRLogin({ token, user }));
    setShowQRDialog(false);
  };

  const handleFallbackTo2FA = () => {
    setShowQRDialog(false);
    setShow2FADialog(true);
  };

  const handleDrawerToggle = () => {
    if (isMobile) {
      setMobileOpen(!mobileOpen);
    } else {
      setSidebarCollapsed(!sidebarCollapsed);
      try {
        localStorage.setItem("sidebarCollapsed", String(!sidebarCollapsed));
      } catch {}
    }
  };

  const handleSidebarCollapse = () => {
    setSidebarCollapsed(!sidebarCollapsed);
    try {
      localStorage.setItem("sidebarCollapsed", String(!sidebarCollapsed));
    } catch {}
  };

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };
  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };
  const handleLogout = () => {
    clearNavOrderCache();
    dispatch(logout());
    handleProfileMenuClose();
    navigate("/login");
  };

  const handleOpenQuickSwitcher = () => {
    setQuickSwitcherOpen(true);
  };

  const handleCloseQuickSwitcher = () => {
    setQuickSwitcherOpen(false);
  };

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Ctrl+Shift+S or Cmd+Shift+S to open quick switcher
      if (
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        event.key === "S"
      ) {
        event.preventDefault();
        handleOpenQuickSwitcher();
      }
      // Alt+1, Alt+2, etc. for quick switching (if you want to add this later)
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleNavigation = (path) => {
    navigate(path);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const getNavigationItems = () => {
    const commonItems = [
      { text: "Dashboard", icon: <DashboardIcon />, path: "/" },
      // { text: "Notes", icon: <NoteIcon />, path: "/notes" },
    ];
    if (user?.role === "admin") {
      return [
        ...commonItems,
        { text: "Orders", icon: <OrdersIcon />, path: "/orders" },
        { text: "Leads", icon: <LeadsIcon />, path: "/leads" },
        { text: "CRM", icon: <CrmIcon />, path: "/crm" },
        // { text: "Workspace", icon: <WorkspaceIcon />, path: "/workspace" }, // Temporarily hidden
        { text: "Admin", icon: <AdminIcon />, path: "/admin" },
        { text: "Payroll", icon: <PaymentIcon />, path: "/payroll" },
        { text: "Finance", icon: <FinanceIcon />, path: "/finance" },
        { text: "Refunds", icon: <RefundsIcon />, path: "/refunds" },
        {
          text: "ERP",
          icon: <BusinessIcon />,
          isExpandable: true,
          key: "erp",
          children: [
            {
              text: "Numbers",
              icon: <SimCardIcon />,
              path: "/numbers",
            },
            {
              text: "SMS Gateway",
              icon: <SmsIcon />,
              path: "/sms",
            },
            {
              text: "Verify",
              icon: <VerificationIcon />,
              path: "/verifications",
            },
          ],
        },
        {
          text: "Agents",
          icon: <CalendarIcon />,
          isExpandable: true,
          key: "schedules",
          children: [
            {
              text: "Schedules",
              icon: <CalendarIcon />,
              path: "/agent-schedule",
            },
            {
              text: "AM Calendar",
              icon: <CalendarIcon />,
              path: "/agent-call-calendar",
            },
            {
              text: "Approve Calls",
              icon: <ApproveIcon />,
              path: "/approve-am-calls",
            },
            {
              text: "Dep. Calls",
              icon: <DepositCallIcon />,
              path: "/deposit-calls",
            },
            {
              text: "Live Monit.",
              icon: <HeadsetIcon />,
              path: "/ami-agents",
            },
            {
              text: "Injection",
              icon: <InjectionIcon />,
              path: "/injections",
            },
          ],
        },
        { text: "Sheets", icon: <SheetsIcon />, path: "/sheets" },
      ];
    } else if (user?.role === "affiliate_manager") {
      const affiliateManagerItems = [
        ...commonItems,
        { text: "Orders", icon: <OrdersIcon />, path: "/orders" },
        { text: "Leads", icon: <LeadsIcon />, path: "/leads" },
        { text: "CRM", icon: <CrmIcon />, path: "/crm" },
        { text: "My Table", icon: <TableIcon />, path: "/my-table" },
        { text: "Targets", icon: <TargetIcon />, path: "/am-targets" },
        {
          text: "Payroll",
          icon: <PaymentIcon />,
          isExpandable: true,
          key: "payroll",
          children: [
            {
              text: "Agents",
              icon: <PaymentIcon />,
              path: "/payroll",
            },
            {
              text: "Pay History",
              icon: <HistoryIcon />,
              path: "/payment-history",
            },
            {
              text: "Fines",
              icon: <GavelIcon />,
              path: "/fines",
            },
          ],
        },
        {
          text: "Agents",
          icon: <CalendarIcon />,
          isExpandable: true,
          key: "schedules",
          children: [
            {
              text: "Schedules",
              icon: <CalendarIcon />,
              path: "/agent-schedule",
            },
            {
              text: "AM Calendar",
              icon: <CalendarIcon />,
              path: "/agent-call-calendar",
            },
            {
              text: "Approve Calls",
              icon: <ApproveIcon />,
              path: "/approve-am-calls",
            },
            {
              text: "Dep. Calls",
              icon: <DepositCallIcon />,
              path: "/deposit-calls",
            },
            {
              text: "Live Monit.",
              icon: <HeadsetIcon />,
              path: "/ami-agents",
            },
            {
              text: "Injection",
              icon: <InjectionIcon />,
              path: "/injections",
            },
          ],
        },
        { text: "SMS Gateway", icon: <SmsIcon />, path: "/sms" },
        {
          text: "Announce",
          icon: <AnnouncementIcon />,
          path: "/announcements",
        },
        { text: "Tickets", icon: <TicketIcon />, path: "/tickets" },
        { text: "Sheets", icon: <SheetsIcon />, path: "/sheets" },
      ];

      // Add refunds management if user has permission
      if (user?.permissions?.canManageRefunds) {
        affiliateManagerItems.splice(-2, 0, {
          text: "Refunds",
          icon: <RefundsIcon />,
          path: "/refunds",
        });
      }

      return affiliateManagerItems;
    } else if (user?.role === "agent") {
      return [
        { text: "My Leads", icon: <LeadsIcon />, path: "/leads" },
        { text: "Calls", icon: <HeadsetIcon />, path: "/call-declarations" },
        { text: "Injection", icon: <InjectionIcon />, path: "/injections" },
        { text: "Notes", icon: <NoteIcon />, path: "/notes" },
        {
          text: "Agents",
          icon: <CalendarIcon />,
          isExpandable: true,
          key: "schedules",
          children: [
            {
              text: "Schedule",
              icon: <CalendarIcon />,
              path: "/agent-schedule",
            },
            {
              text: "AM Calendar",
              icon: <CalendarIcon />,
              path: "/agent-call-calendar",
            },
            {
              text: "Dep. Calls",
              icon: <DepositCallIcon />,
              path: "/deposit-calls",
            },
          ],
        },
        {
          text: "Payroll",
          icon: <PaymentIcon />,
          isExpandable: true,
          key: "payroll",
          children: [
            {
              text: "Agents",
              icon: <PaymentIcon />,
              path: "/payroll",
            },
            {
              text: "Pay History",
              icon: <HistoryIcon />,
              path: "/payment-history",
            },
            {
              text: "Fines",
              icon: <GavelIcon />,
              path: "/fines",
            },
          ],
        },
        {
          text: "Announce",
          icon: <AnnouncementIcon />,
          path: "/announcements",
        },
        { text: "Tickets", icon: <TicketIcon />, path: "/tickets" },
        { text: "Sheets", icon: <SheetsIcon />, path: "/sheets" },
      ];
    } else if (user?.role === "lead_manager") {
      return [
        ...commonItems,
        { text: "Orders", icon: <OrdersIcon />, path: "/orders" },
        { text: "Leads", icon: <LeadsIcon />, path: "/leads" },
        // { text: "Workspace", icon: <WorkspaceIcon />, path: "/workspace" }, // Temporarily hidden
        {
          text: "Verify",
          icon: <VerificationIcon />,
          path: "/verifications",
        },
        {
          text: "ERP",
          icon: <BusinessIcon />,
          isExpandable: true,
          key: "erp",
          children: [
            {
              text: "Numbers",
              icon: <SimCardIcon />,
              path: "/numbers",
            },
            {
              text: "SMS Gateway",
              icon: <SmsIcon />,
              path: "/sms",
            },
          ],
        },
        { text: "Fines", icon: <GavelIcon />, path: "/fines" },
        { text: "Tickets", icon: <TicketIcon />, path: "/tickets" },
      ];
    } else if (user?.role === "refunds_manager") {
      return [
        ...commonItems,
        { text: "Refunds", icon: <RefundsIcon />, path: "/refunds" },
        { text: "SMS Gateway", icon: <SmsIcon />, path: "/sms" },
        { text: "Fines", icon: <GavelIcon />, path: "/fines" },
        { text: "Tickets", icon: <TicketIcon />, path: "/tickets" },
      ];
    } else if (user?.role === "inventory_manager") {
      return [
        ...commonItems,
        {
          text: "ERP",
          icon: <BusinessIcon />,
          isExpandable: true,
          key: "erp",
          children: [
            {
              text: "SMS Gateway",
              icon: <SmsIcon />,
              path: "/sms",
            },
          ],
        },
        { text: "Fines", icon: <GavelIcon />, path: "/fines" },
        { text: "Tickets", icon: <TicketIcon />, path: "/tickets" },
      ];
    }
    return [
      ...commonItems,
      { text: "Fines", icon: <GavelIcon />, path: "/fines" },
      { text: "Support Tickets", icon: <TicketIcon />, path: "/tickets" },
    ];
  };
  const rawNavigationItems = getNavigationItems();

  const iconColorMap = {
    "/": "#42a5f5",
    "/orders": "#ff7043",
    "/leads": "#66bb6a",
    "/crm": "#ec407a",
    "/admin": "#7e57c2",
    "/users": "#ab47bc",
    "/account-management": "#7e57c2",
    "/client-networks": "#29b6f6",
    "/our-networks": "#29b6f6",
    "/client-brokers": "#8d6e63",
    "/client-psps": "#5c6bc0",
    "/card-issuers": "#ffa726",
    "/campaigns": "#ef5350",
    "/payroll": "#4caf50",
    "/finance": "#2e7d32",
    "/affiliate-managers": "#42a5f5",
    "/am-expenses": "#e91e63",
    "/withdrawals": "#ef5350",
    "/refunds": "#e53935",
    "/numbers": "#26c6da",
    "/sms": "#42a5f5",
    "/am-targets": "#ffa726",
    "/announcements": "#ffb300",
    "/agent-schedule": "#26a69a",
    "/agent-call-calendar": "#26a69a",
    "/approve-am-calls": "#66bb6a",
    "/deposit-calls": "#42a5f5",
    "/agent-comments": "#78909c",
    "/tickets": "#ff7043",
    "/sheets": "#66bb6a",
    "/my-table": "#42a5f5",
    "/notes": "#ffca28",
    "/payment-history": "#78909c",
    "/verifications": "#66bb6a",
    "/lead-management": "#66bb6a",
    "/ami-agents": "#e91e63",
    "/fines": "#ff9800",
    "/injections": "#9c27b0",
    "/call-declarations": "#e91e63",
  };

  // Flatten navigation items: expand all children into a single flat list
  const flattenNavigationItems = (items) => {
    const flat = [];
    items.forEach((item) => {
      if (item.isExpandable && item.children) {
        item.children.forEach((child) => flat.push(child));
      } else if (item.path) {
        flat.push(item);
      }
    });
    return flat;
  };

  const flatNavigationItems = useMemo(
    () => flattenNavigationItems(rawNavigationItems),
    [user?.role, user?.permissions?.canManageRefunds]
  );

  // Load sidebar nav order from API on mount
  useEffect(() => {
    const fetchNavOrder = async () => {
      const order = await loadNavOrder();
      setNavOrder(order);
    };
    fetchNavOrder();
  }, []);

  // Recompute ordered items when flat items or saved order changes
  useEffect(() => {
    setOrderedItems(applyNavOrder(flatNavigationItems, navOrder));
  }, [flatNavigationItems, navOrder]);

  // Debounced save to API
  const debouncedSaveNavOrder = useMemo(
    () => debounce((pathOrder) => saveNavOrder(pathOrder), 1000),
    []
  );

  useEffect(() => {
    return () => debouncedSaveNavOrder.cancel();
  }, [debouncedSaveNavOrder]);

  const handleReorder = useCallback((newItems) => {
    setOrderedItems(newItems);
    const newPathOrder = newItems.map((item) => item.path);
    setNavOrder(newPathOrder);
    try {
      localStorage.setItem("sidebarNavOrder", JSON.stringify(newPathOrder));
    } catch {}
    debouncedSaveNavOrder(newPathOrder);
  }, [debouncedSaveNavOrder]);

  const allNavigationPaths = flatNavigationItems;

  const getRoleBadgeLabel = (role) => {
    const labels = {
      admin: "Admin",
      affiliate_manager: "AM",
      agent: "Agent",
      lead_manager: "LM",
      refunds_manager: "Refunds",
      inventory_manager: "Inventory",
    };
    return labels[role] || "User";
  };

  const drawer = (collapsed = false) => (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: SIDEBAR_BG,
        overflow: "hidden",
      }}
    >
      {/* Logo Section */}
      <Box
        sx={{
          height: HEADER_HEIGHT,
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          px: collapsed ? 1 : 2.5,
          flexShrink: 0,
        }}
      >
        {collapsed ? (
          <Typography
            variant="h5"
            sx={{
              fontWeight: 800,
              color: "#fff",
              letterSpacing: 1,
              userSelect: "none",
            }}
          >
            F
            <Box component="span" sx={{ color: ACCENT_COLOR }}>.</Box>
          </Typography>
        ) : (
          <Typography
            variant="h5"
            sx={{
              fontWeight: 800,
              color: "#fff",
              letterSpacing: 1,
              userSelect: "none",
            }}
          >
            FTD
            <Box component="span" sx={{ color: ACCENT_COLOR, ml: 0.5 }}>Hub</Box>
          </Typography>
        )}
      </Box>

      {/* Divider */}
      <Divider sx={{ borderColor: "rgba(255, 255, 255, 0.1)", mx: collapsed ? 1 : 2 }} />

      {/* Navigation Area */}
      <Box
        sx={{
          flex: 1,
          overflow: "auto",
          width: "100%",
          py: 1,
          "&::-webkit-scrollbar": {
            width: 4,
          },
          "&::-webkit-scrollbar-track": {
            background: "transparent",
          },
          "&::-webkit-scrollbar-thumb": {
            background: "rgba(255, 255, 255, 0.15)",
            borderRadius: 2,
          },
          "&::-webkit-scrollbar-thumb:hover": {
            background: "rgba(255, 255, 255, 0.25)",
          },
        }}
      >
        <Reorder.Group
          axis="y"
          values={orderedItems}
          onReorder={handleReorder}
          style={{ padding: 0, paddingInlineStart: 0, margin: 0, width: "100%", listStyleType: "none", boxSizing: "border-box" }}
          as="ul"
        >
          {orderedItems.map((item) => (
            <SidebarNavItem
              key={item.path}
              item={item}
              isSelected={location.pathname === item.path}
              onNavigate={handleNavigation}
              collapsed={collapsed}
            />
          ))}
        </Reorder.Group>
      </Box>

      {/* Divider */}
      <Divider sx={{ borderColor: "rgba(255, 255, 255, 0.1)", mx: collapsed ? 1 : 2 }} />

      {/* User Info Section */}
      <Box
        sx={{
          py: 1.5,
          px: collapsed ? 1 : 2,
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          gap: collapsed ? 0 : 1.5,
          flexShrink: 0,
        }}
      >
        {collapsed ? (
          <Tooltip title={`${user?.fullName || "User"} (${getRoleBadgeLabel(user?.role)})`} placement="right" arrow>
            <Avatar
              sx={{
                width: 36,
                height: 36,
                bgcolor: ACCENT_COLOR,
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "default",
              }}
            >
              {user?.fullName?.charAt(0)?.toUpperCase()}
            </Avatar>
          </Tooltip>
        ) : (
          <>
            <Avatar
              sx={{
                width: 36,
                height: 36,
                bgcolor: ACCENT_COLOR,
                fontSize: "0.875rem",
                fontWeight: 600,
              }}
            >
              {user?.fullName?.charAt(0)?.toUpperCase()}
            </Avatar>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                variant="body2"
                noWrap
                sx={{ color: "#fff", fontWeight: 600, fontSize: 13, lineHeight: 1.3 }}
              >
                {user?.fullName}
              </Typography>
              <Chip
                label={getRoleBadgeLabel(user?.role)}
                size="small"
                sx={{
                  height: 18,
                  fontSize: 10,
                  fontWeight: 600,
                  color: ACCENT_COLOR,
                  borderColor: "rgba(245, 124, 0, 0.4)",
                  bgcolor: "rgba(245, 124, 0, 0.1)",
                  mt: 0.3,
                  "& .MuiChip-label": { px: 1 },
                }}
                variant="outlined"
              />
            </Box>
          </>
        )}
      </Box>

      {/* Collapse Toggle Button (desktop only) */}
      {!isMobile && (
        <>
          <Divider sx={{ borderColor: "rgba(255, 255, 255, 0.1)", mx: collapsed ? 1 : 2 }} />
          <Box
            sx={{
              py: 1,
              display: "flex",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <IconButton
              onClick={handleSidebarCollapse}
              size="small"
              sx={{
                color: "rgba(255, 255, 255, 0.6)",
                "&:hover": {
                  color: "#fff",
                  bgcolor: "rgba(255, 255, 255, 0.08)",
                },
                transition: "all 0.2s ease",
              }}
            >
              {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            </IconButton>
          </Box>
        </>
      )}
    </Box>
  );

  return (
    <Box sx={{ display: "flex" }}>
      <CssBaseline />

      {/* AppBar / Header */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${currentSidebarWidth}px)` },
          ml: { md: `${currentSidebarWidth}px` },
          transition: "width 300ms ease, margin-left 300ms ease",
          bgcolor: "#fff",
          color: "text.primary",
          borderBottom: "1px solid",
          borderColor: "rgba(0, 0, 0, 0.08)",
        }}
      >
        <Toolbar
          sx={{ minHeight: HEADER_HEIGHT, height: HEADER_HEIGHT, px: { xs: 2, sm: 3 } }}
        >
          {/* Mobile hamburger */}
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{
              mr: 2,
              display: { md: "none" },
              color: "text.secondary",
            }}
          >
            <MenuIcon />
          </IconButton>

          {/* Page Title */}
          <Typography
            variant="h6"
            noWrap
            component="div"
            sx={{
              display: { xs: "none", sm: "block" },
              fontWeight: 700,
              fontSize: 18,
              color: "text.primary",
              letterSpacing: -0.3,
            }}
          >
            {allNavigationPaths.find((item) => item.path === location.pathname)
              ?.text || "Dashboard"}
          </Typography>

          {/* Global Search */}
          <Box sx={{ ml: 3, display: { xs: "none", md: "block" } }}>
            <GlobalSearch />
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          {/* Right side actions */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <UserSwitcher onOpenQuickSwitcher={handleOpenQuickSwitcher} />
            <TicketHeaderButton />
            <NotificationBell />
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                cursor: "pointer",
                borderRadius: 2,
                px: 1,
                py: 0.5,
                ml: 0.5,
                "&:hover": { bgcolor: "rgba(0, 0, 0, 0.04)" },
                transition: "background-color 0.2s ease",
              }}
              onClick={handleProfileMenuOpen}
            >
              <Box position="relative">
                <Avatar
                  sx={{
                    width: 34,
                    height: 34,
                    bgcolor: "#1e3a5f",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                  }}
                >
                  {user?.fullName?.charAt(0)?.toUpperCase()}
                </Avatar>
                {user?.role === "admin" && !user?.twoFactorEnabled && (
                  <SecurityIcon
                    color="warning"
                    sx={{
                      position: "absolute",
                      bottom: -2,
                      right: -2,
                      fontSize: 14,
                      bgcolor: "background.paper",
                      borderRadius: "50%",
                    }}
                  />
                )}
              </Box>
              <Typography
                variant="body2"
                noWrap
                sx={{
                  display: { xs: "none", sm: "block" },
                  fontWeight: 500,
                  maxWidth: 140,
                  color: "text.primary",
                  fontSize: 14,
                }}
              >
                {user?.fullName}
              </Typography>
            </Box>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Profile Menu */}
      <Menu
        id="menu-appbar"
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        keepMounted
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        open={Boolean(anchorEl)}
        onClose={handleProfileMenuClose}
        PaperProps={{
          sx: {
            mt: 1,
            borderRadius: 2,
            boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
            minWidth: 180,
          },
        }}
      >
        <MenuItem
          onClick={() => {
            handleNavigation("/profile");
            handleProfileMenuClose();
          }}
          sx={{ py: 1.2, px: 2 }}
        >
          <ListItemIcon>
            <AccountIcon fontSize="small" />
          </ListItemIcon>
          Profile
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout} sx={{ py: 1.2, px: 2 }}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          Logout
        </MenuItem>
      </Menu>

      {/* Sidebar Navigation */}
      <Box
        component="nav"
        sx={{
          width: { md: currentSidebarWidth },
          flexShrink: { md: 0 },
          transition: "width 300ms ease",
        }}
        aria-label="navigation menu"
      >
        {/* Mobile drawer (temporary overlay) */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: SIDEBAR_WIDTH_EXPANDED,
              border: "none",
            },
          }}
        >
          {drawer(false)}
        </Drawer>

        {/* Desktop drawer (permanent) */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: currentSidebarWidth,
              border: "none",
              transition: "width 300ms ease",
              overflowX: "hidden",
            },
          }}
          open
        >
          {drawer(sidebarCollapsed)}
        </Drawer>
      </Box>

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: location.pathname === "/notes" ? 0 : { xs: 2, md: 3 },
          width: { md: `calc(100% - ${currentSidebarWidth}px)` },
          transition: "width 300ms ease",
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          bgcolor: "#f8f9fa",
          overflow: (location.pathname === "/notes" || location.pathname === "/orders" || location.pathname === "/crm" || location.pathname === "/leads" || location.pathname === "/client-psps" || location.pathname === "/card-issuers" || location.pathname === "/sms" || location.pathname === "/deposit-calls" || location.pathname === "/call-declarations") ? "hidden" : "auto",
          height: (location.pathname === "/notes" || location.pathname === "/orders" || location.pathname === "/crm" || location.pathname === "/leads" || location.pathname === "/client-psps" || location.pathname === "/card-issuers" || location.pathname === "/sms" || location.pathname === "/deposit-calls" || location.pathname === "/call-declarations") ? "100vh" : "auto",
        }}
      >
        {/* Spacer for fixed header */}
        <Box sx={{ minHeight: HEADER_HEIGHT }} />
        <Box
          component="div"
          sx={{
            flexGrow: 1,
            overflow: (location.pathname === "/notes" || location.pathname === "/orders" || location.pathname === "/crm" || location.pathname === "/leads" || location.pathname === "/client-psps" || location.pathname === "/card-issuers" || location.pathname === "/sms" || location.pathname === "/deposit-calls" || location.pathname === "/call-declarations") ? "hidden" : "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Force2FASetup>
            <Outlet />
          </Force2FASetup>
        </Box>
        {location.pathname !== "/notes" && location.pathname !== "/orders" && location.pathname !== "/crm" && location.pathname !== "/leads" && location.pathname !== "/client-psps" && location.pathname !== "/card-issuers" && location.pathname !== "/admin" && location.pathname !== "/finance" && location.pathname !== "/am-expenses" && location.pathname !== "/sms" && location.pathname !== "/fines" && location.pathname !== "/numbers" && location.pathname !== "/approve-am-calls" && location.pathname !== "/deposit-calls" && location.pathname !== "/call-declarations" && !location.pathname.startsWith("/client-network/") && !location.pathname.startsWith("/client-broker/") && <Footer />}
      </Box>

      {/* Floating Chat Button */}
      {location.pathname !== "/notes" && <ChatButton />}

      {/* Quick Switcher Modal */}
      <QuickSwitcher
        open={quickSwitcherOpen}
        onClose={handleCloseQuickSwitcher}
      />

      {/* Announcement Popup for agents and affiliate managers */}
      <AnnouncementPopup />

      {/* Fine Notification Popup for agents */}
      <FineNotificationPopup />

      {/* 2FA Verification Dialog */}
      <TwoFactorVerification
        open={show2FADialog}
        onClose={handle2FAClose}
        onVerify={handle2FAVerification}
        loading={isLoading}
        error={twoFactorError}
      />

      {/* QR Code Login Dialog */}
      <QRCodeLogin
        open={showQRDialog}
        onClose={handleQRClose}
        userId={twoFactorUserId}
        onLoginSuccess={handleQRLoginSuccess}
        onFallbackTo2FA={handleFallbackTo2FA}
      />
    </Box>
  );
};
export default MainLayout;
