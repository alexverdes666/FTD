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
import TwoFactorVerification from "../components/TwoFactorVerification";
import QRCodeLogin from "../components/QRCodeLogin";
import { Reorder, useDragControls } from "framer-motion";
import debounce from "lodash.debounce";
import { loadNavOrder, saveNavOrder, applyNavOrder, loadNavOrderFromCache, clearNavOrderCache } from "../utils/sidebarNavOrder";
const drawerWidth = 150;

const SidebarNavItem = ({ item, isSelected, iconColor, primaryColor, onNavigate }) => {
  const dragControls = useDragControls();

  return (
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
          py: 0.4,
          px: 1,
          minHeight: 32,
          width: "100%",
          boxSizing: "border-box",
          "&.Mui-selected": {
            backgroundColor: primaryColor + "20",
            borderRight: `3px solid ${primaryColor}`,
            "& .MuiListItemIcon-root": {
              color: primaryColor,
            },
            "& .MuiListItemText-primary": {
              color: primaryColor,
              fontWeight: 600,
            },
          },
        }}
      >
        <ListItemIcon
          sx={{
            color: isSelected ? primaryColor : iconColor,
            minWidth: 28,
            cursor: "grab",
            "&:active": { cursor: "grabbing" },
            "& .MuiSvgIcon-root": { fontSize: 18 },
          }}
          onPointerDown={(e) => {
            e.preventDefault();
            dragControls.start(e);
          }}
        >
          {item.icon}
        </ListItemIcon>
        <ListItemText primary={item.text} sx={{ flex: 1, minWidth: 0 }} primaryTypographyProps={{ fontSize: 13, noWrap: true }} />
      </ListItem>
    </Reorder.Item>
  );
};

const MainLayout = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(true);
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
      setDesktopOpen(!desktopOpen);
    }
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
        {
          text: "Users",
          icon: <UsersIcon />,
          isExpandable: true,
          key: "users",
          children: [
            {
              text: "Users",
              icon: <UsersIcon />,
              path: "/users",
            },
            {
              text: "Accounts",
              icon: <AdminIcon />,
              path: "/account-management",
            },
          ],
        },
        {
          text: "Networks",
          icon: <NetworkIcon />,
          isExpandable: true,
          key: "networks",
          children: [
            {
              text: "Client Nets",
              icon: <NetworkIcon />,
              path: "/client-networks",
            },
            {
              text: "Our Nets",
              icon: <NetworkIcon />,
              path: "/our-networks",
            },
            {
              text: "Brokers",
              icon: <BusinessIcon />,
              path: "/client-brokers",
            },
            {
              text: "PSPs",
              icon: <PSPIcon />,
              path: "/client-psps",
            },
            {
              text: "Issuers",
              icon: <CardIssuerIcon />,
              path: "/card-issuers",
            },
            {
              text: "Campaigns",
              icon: <CampaignIcon />,
              path: "/campaigns",
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
              text: "AM Payroll",
              icon: <TableIcon />,
              path: "/affiliate-managers",
            },
            {
              text: "Withdraw",
              icon: <WithdrawIcon />,
              path: "/withdrawals",
            },
          ],
        },
        { text: "Refunds", icon: <RefundsIcon />, path: "/refunds" },
        {
          text: "ERP",
          icon: <BusinessIcon />,
          isExpandable: true,
          key: "erp",
          children: [
            {
              text: "SIMs",
              icon: <SimCardIcon />,
              path: "/simcards",
            },
            {
              text: "Numbers",
              icon: <SimCardIcon />,
              path: "/numbers",
            },
            {
              text: "SMS",
              icon: <SmsIcon />,
              path: "/sms",
            },
            {
              text: "Targets",
              icon: <TargetIcon />,
              path: "/am-targets",
            },
            {
              text: "Announce",
              icon: <AnnouncementIcon />,
              path: "/announcements",
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
              text: "Comments",
              icon: <CommentIcon />,
              path: "/agent-comments",
            },
          ],
        },
        { text: "Tickets", icon: <TicketIcon />, path: "/tickets" },
        { text: "Sheets", icon: <SheetsIcon />, path: "/sheets" },
      ];
    } else if (user?.role === "affiliate_manager") {
      const affiliateManagerItems = [
        ...commonItems,
        { text: "Orders", icon: <OrdersIcon />, path: "/orders" },
        { text: "Leads", icon: <LeadsIcon />, path: "/leads" },
        { text: "Our Nets", icon: <NetworkIcon />, path: "/our-networks" },
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
              text: "Comments",
              icon: <CommentIcon />,
              path: "/agent-comments",
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
          ],
        },
        { text: "Tickets", icon: <TicketIcon />, path: "/tickets" },
      ];
    } else if (user?.role === "refunds_manager") {
      return [
        ...commonItems,
        { text: "Refunds", icon: <RefundsIcon />, path: "/refunds" },
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
              text: "SIMs",
              icon: <SimCardIcon />,
              path: "/simcards",
            },
          ],
        },
        { text: "Tickets", icon: <TicketIcon />, path: "/tickets" },
      ];
    }
    return [
      ...commonItems,
      { text: "Support Tickets", icon: <TicketIcon />, path: "/tickets" },
    ];
  };
  const rawNavigationItems = getNavigationItems();

  const iconColorMap = {
    "/": "#42a5f5",
    "/orders": "#ff7043",
    "/leads": "#66bb6a",
    "/crm": "#ec407a",
    "/users": "#ab47bc",
    "/account-management": "#7e57c2",
    "/client-networks": "#29b6f6",
    "/our-networks": "#29b6f6",
    "/client-brokers": "#8d6e63",
    "/client-psps": "#5c6bc0",
    "/card-issuers": "#ffa726",
    "/campaigns": "#ef5350",
    "/payroll": "#4caf50",
    "/affiliate-managers": "#42a5f5",
    "/withdrawals": "#ef5350",
    "/refunds": "#e53935",
    "/simcards": "#26c6da",
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
  const primaryColor = theme.palette.primary.main;

  const drawer = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Box sx={{ height: 42, display: "flex", alignItems: "center", px: 1, overflow: "hidden" }}>
        <img
          src="/leadflow.png"
          alt="LeadFlow"
          style={{ width: "150%", maxHeight: 70, objectFit: "contain", objectPosition: "left", marginLeft: -17 }}
        />
      </Box>
      <Divider />
      <Box sx={{ flex: 1, overflow: "auto", width: "100%" }}>
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
              iconColor={iconColorMap[item.path] || theme.palette.text.secondary}
              primaryColor={primaryColor}
              onNavigate={handleNavigation}
            />
          ))}
        </Reorder.Group>
      </Box>
    </Box>
  );
  return (
    <Box sx={{ display: "flex" }}>
      <CssBaseline />
      {}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: desktopOpen ? `calc(100% - ${drawerWidth}px)` : "100%" },
          ml: { md: desktopOpen ? `${drawerWidth}px` : 0 },
          transition: theme.transitions.create(["width", "margin"], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
          borderBottom: "1px solid",
          borderColor: "rgba(255,255,255,0.12)",
        }}
      >
        <Toolbar
          variant="dense"
          sx={{ minHeight: 42, height: 42, px: { xs: 1, sm: 1.5 } }}
        >
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            size="small"
            sx={{ mr: 1 }}
          >
            <MenuIcon fontSize="small" />
          </IconButton>
          <Typography
            variant="subtitle2"
            noWrap
            component="div"
            sx={{
              display: { xs: "none", sm: "block" },
              fontWeight: 600,
              letterSpacing: 0.3,
              opacity: 0.95,
            }}
          >
            {allNavigationPaths.find((item) => item.path === location.pathname)
              ?.text || "Dashboard"}
          </Typography>
          <Box sx={{ ml: 1.5, display: { xs: "none", md: "block" } }}>
            <GlobalSearch />
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <UserSwitcher onOpenQuickSwitcher={handleOpenQuickSwitcher} />
            <NotificationBell />
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                cursor: "pointer",
                borderRadius: 1,
                px: 0.5,
                py: 0.25,
                "&:hover": { bgcolor: "rgba(255,255,255,0.08)" },
              }}
              onClick={handleProfileMenuOpen}
            >
              <Box position="relative">
                <Avatar
                  sx={{
                    width: 26,
                    height: 26,
                    bgcolor: "secondary.main",
                    fontSize: "0.75rem",
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
                      bottom: -3,
                      right: -3,
                      fontSize: 13,
                      bgcolor: "background.paper",
                      borderRadius: "50%",
                    }}
                  />
                )}
              </Box>
              <Typography
                variant="caption"
                noWrap
                sx={{
                  display: { xs: "none", sm: "block" },
                  fontWeight: 500,
                  maxWidth: 120,
                  opacity: 0.9,
                }}
              >
                {user?.fullName}
              </Typography>
            </Box>
          </Box>
        </Toolbar>
      </AppBar>
      {}
      <Menu
        id="menu-appbar"
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        keepMounted
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        open={Boolean(anchorEl)}
        onClose={handleProfileMenuClose}
      >
        <MenuItem
          onClick={() => {
            handleNavigation("/profile");
            handleProfileMenuClose();
          }}
        >
          <ListItemIcon>
            <AccountIcon fontSize="small" />
          </ListItemIcon>
          Profile
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          Logout
        </MenuItem>
      </Menu>
      {}
      <Box
        component="nav"
        sx={{
          width: { md: desktopOpen ? drawerWidth : 0 },
          flexShrink: { md: 0 },
          transition: theme.transitions.create("width", {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        }}
        aria-label="navigation menu"
      >
        {/* The implementation can be swapped with js to avoid SEO duplication of links. */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: drawerWidth,
            },
          }}
        >
          {drawer}
        </Drawer>
        {/* Desktop drawer */}
        <Drawer
          variant="persistent"
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: drawerWidth,
            },
          }}
          open={desktopOpen}
        >
          {drawer}
        </Drawer>
      </Box>
      {}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: location.pathname === "/notes" ? 0 : 2,
          width: { md: desktopOpen ? `calc(100% - ${drawerWidth}px)` : "100%" },
          transition: theme.transitions.create(["width", "margin"], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          overflow: (location.pathname === "/notes" || location.pathname === "/orders") ? "hidden" : "auto",
          height: (location.pathname === "/notes" || location.pathname === "/orders") ? "100vh" : "auto",
        }}
      >
        <Box sx={{ minHeight: 42 }} />
        <Box
          component="div"
          sx={{
            flexGrow: 1,
            overflow: (location.pathname === "/notes" || location.pathname === "/orders") ? "hidden" : "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Force2FASetup>
            <Outlet />
          </Force2FASetup>
        </Box>
        {location.pathname !== "/notes" && location.pathname !== "/orders" && <Footer />}
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
