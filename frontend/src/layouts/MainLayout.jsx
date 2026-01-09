import React, { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import {
  Box,
  CssBaseline,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  List,
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
  Collapse,
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
  ExpandLess,
  ExpandMore,
  CalendarMonth as CalendarIcon,
  CheckCircle as ApproveIcon,
  Announcement as AnnouncementIcon,
  TrackChanges as TargetIcon,
  PhoneCallback as DepositCallIcon,
  Security as SecurityIcon,
  Note as NoteIcon,
  Speed as PerformanceIcon,
} from "@mui/icons-material";
import {
  logout,
  selectUser,
  selectAuth,
  verify2FAAndLogin,
  completeQRLogin,
  clear2FAState
} from "../store/slices/authSlice";
import Footer from "./Footer";
import ChatButton from "../components/ChatButton";
import UserSwitcher from "../components/UserSwitcher";
import QuickSwitcher from "../components/QuickSwitcher";
import NotificationBell from "../components/NotificationBell";
import Force2FASetup from "../components/Force2FASetup";
import AnnouncementPopup from "../components/AnnouncementPopup";
import TwoFactorVerification from "../components/TwoFactorVerification";
import QRCodeLogin from "../components/QRCodeLogin";
const drawerWidth = 240;
const MainLayout = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [anchorEl, setAnchorEl] = useState(null);
  const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState({
    networks: false,
    leads: false,
    users: false,
    payroll: false,
    schedules: false,
    erp: false,
  });
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const { requires2FA, twoFactorUserId, useQRAuth, isLoading } = useSelector(selectAuth);
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
      const result = await dispatch(verify2FAAndLogin({
        userId: twoFactorUserId,
        token: code,
        useBackupCode
      })).unwrap();
      
      if (result.token) {
        setShow2FADialog(false);
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

  const handleMenuToggle = (menuKey) => {
    setExpandedMenus((prev) => ({
      ...prev,
      [menuKey]: !prev[menuKey],
    }));
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
              text: "Account Management",
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
              text: "Client Networks",
              icon: <NetworkIcon />,
              path: "/client-networks",
            },
            {
              text: "Our Networks",
              icon: <NetworkIcon />,
              path: "/our-networks",
            },
            {
              text: "Client Brokers",
              icon: <BusinessIcon />,
              path: "/client-brokers",
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
              text: "Payroll",
              icon: <PaymentIcon />,
              path: "/payroll",
            },
            {
              text: "Affiliate Managers",
              icon: <TableIcon />,
              path: "/affiliate-managers",
            },
            {
              text: "Withdrawals",
              icon: <WithdrawIcon />,
              path: "/withdrawals",
            },
          ],
        },
        { text: "Refunds Management", icon: <RefundsIcon />, path: "/refunds" },
        {
          text: "ERP",
          icon: <BusinessIcon />,
          isExpandable: true,
          key: "erp",
          children: [
            {
              text: "SIM Cards",
              icon: <SimCardIcon />,
              path: "/simcards",
            },
            {
              text: "AMs Targets",
              icon: <TargetIcon />,
              path: "/am-targets",
            },
            {
              text: "Announcements",
              icon: <AnnouncementIcon />,
              path: "/announcements",
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
              text: "Agent Schedules",
              icon: <CalendarIcon />,
              path: "/agent-schedule",
            },
            {
              text: "AM Calls Calendar",
              icon: <CalendarIcon />,
              path: "/agent-call-calendar",
            },
            {
              text: "Approve AM Calls",
              icon: <ApproveIcon />,
              path: "/approve-am-calls",
            },
            {
              text: "Deposit Calls",
              icon: <DepositCallIcon />,
              path: "/deposit-calls",
            },
            {
              text: "Agent Comments",
              icon: <CommentIcon />,
              path: "/agent-comments",
            },
          ],
        },
        { text: "Support Tickets", icon: <TicketIcon />, path: "/tickets" },
        { text: "Performance", icon: <PerformanceIcon />, path: "/performance" },
      ];
    } else if (user?.role === "affiliate_manager") {
      const affiliateManagerItems = [
        ...commonItems,
        { text: "Orders", icon: <OrdersIcon />, path: "/orders" },
        { text: "Leads", icon: <LeadsIcon />, path: "/leads" },
        { text: "Our Networks", icon: <NetworkIcon />, path: "/our-networks" },
        { text: "My Table", icon: <TableIcon />, path: "/my-table" },
        { text: "My Targets", icon: <TargetIcon />, path: "/am-targets" },
        {
          text: "Payroll",
          icon: <PaymentIcon />,
          isExpandable: true,
          key: "payroll",
          children: [
            {
              text: "Payroll",
              icon: <PaymentIcon />,
              path: "/payroll",
            },
            {
              text: "Payment History",
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
              text: "Agent Schedules",
              icon: <CalendarIcon />,
              path: "/agent-schedule",
            },
            {
              text: "AM Calls Calendar",
              icon: <CalendarIcon />,
              path: "/agent-call-calendar",
            },
            {
              text: "Approve AM Calls",
              icon: <ApproveIcon />,
              path: "/approve-am-calls",
            },
            {
              text: "Deposit Calls",
              icon: <DepositCallIcon />,
              path: "/deposit-calls",
            },
            {
              text: "Agent Comments",
              icon: <CommentIcon />,
              path: "/agent-comments",
            },
          ],
        },
        {
          text: "Announcements",
          icon: <AnnouncementIcon />,
          path: "/announcements",
        },
        { text: "Support Tickets", icon: <TicketIcon />, path: "/tickets" },
      ];

      // Add refunds management if user has permission
      if (user?.permissions?.canManageRefunds) {
        affiliateManagerItems.splice(-2, 0, {
          text: "Refunds Management",
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
              text: "My Schedule",
              icon: <CalendarIcon />,
              path: "/agent-schedule",
            },
            {
              text: "AM Calls Calendar",
              icon: <CalendarIcon />,
              path: "/agent-call-calendar",
            },
            {
              text: "Deposit Calls",
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
              text: "Payroll",
              icon: <PaymentIcon />,
              path: "/payroll",
            },
            {
              text: "Payment History",
              icon: <HistoryIcon />,
              path: "/payment-history",
            },
          ],
        },
        {
          text: "Announcements",
          icon: <AnnouncementIcon />,
          path: "/announcements",
        },
        { text: "Support Tickets", icon: <TicketIcon />, path: "/tickets" },
      ];
    } else if (user?.role === "lead_manager") {
      return [
        ...commonItems,
        { text: "Orders", icon: <OrdersIcon />, path: "/orders" },
        { text: "Lead Management", icon: <LeadsIcon />, path: "/leads" },
        {
          text: "Verifications",
          icon: <VerificationIcon />,
          path: "/verifications",
        },
        { text: "Support Tickets", icon: <TicketIcon />, path: "/tickets" },
      ];
    } else if (user?.role === "refunds_manager") {
      return [
        ...commonItems,
        { text: "Refunds Management", icon: <RefundsIcon />, path: "/refunds" },
        { text: "Support Tickets", icon: <TicketIcon />, path: "/tickets" },
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
              text: "SIM Cards",
              icon: <SimCardIcon />,
              path: "/simcards",
            },
          ],
        },
        { text: "Support Tickets", icon: <TicketIcon />, path: "/tickets" },
      ];
    }
    return [
      ...commonItems,
      { text: "Support Tickets", icon: <TicketIcon />, path: "/tickets" },
    ];
  };
  const navigationItems = getNavigationItems();

  // Helper function to get all navigation paths (including nested ones) for title display
  const getAllNavigationPaths = (items) => {
    const paths = [];
    items.forEach((item) => {
      if (item.path) {
        paths.push(item);
      }
      if (item.children) {
        paths.push(...getAllNavigationPaths(item.children));
      }
    });
    return paths;
  };

  const allNavigationPaths = getAllNavigationPaths(navigationItems);
  const drawer = (
    <Box>
      <Toolbar>
        <Typography
          variant="h6"
          noWrap
          component="div"
          sx={{ fontWeight: 600 }}
        >
          Lead Management
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {navigationItems.map((item) => (
          <React.Fragment key={item.text}>
            {item.isExpandable ? (
              <>
                <ListItem
                  button
                  onClick={() => handleMenuToggle(item.key)}
                  sx={{
                    "&:hover": {
                      backgroundColor: theme.palette.action.hover,
                    },
                  }}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} />
                  {expandedMenus[item.key] ? <ExpandLess /> : <ExpandMore />}
                </ListItem>
                <Collapse
                  in={expandedMenus[item.key]}
                  timeout="auto"
                  unmountOnExit
                >
                  <List component="div" disablePadding>
                    {item.children.map((child) => (
                      <ListItem
                        button
                        key={child.text}
                        onClick={() => handleNavigation(child.path)}
                        selected={location.pathname === child.path}
                        sx={{
                          pl: 4,
                          "&.Mui-selected": {
                            backgroundColor: theme.palette.primary.main + "20",
                            borderRight: `3px solid ${theme.palette.primary.main}`,
                            "& .MuiListItemIcon-root": {
                              color: theme.palette.primary.main,
                            },
                            "& .MuiListItemText-primary": {
                              color: theme.palette.primary.main,
                              fontWeight: 600,
                            },
                          },
                        }}
                      >
                        <ListItemIcon>{child.icon}</ListItemIcon>
                        <ListItemText primary={child.text} />
                      </ListItem>
                    ))}
                  </List>
                </Collapse>
              </>
            ) : (
              <ListItem
                button
                key={item.text}
                onClick={() => handleNavigation(item.path)}
                selected={location.pathname === item.path}
                sx={{
                  "&.Mui-selected": {
                    backgroundColor: theme.palette.primary.main + "20",
                    borderRight: `3px solid ${theme.palette.primary.main}`,
                    "& .MuiListItemIcon-root": {
                      color: theme.palette.primary.main,
                    },
                    "& .MuiListItemText-primary": {
                      color: theme.palette.primary.main,
                      fontWeight: 600,
                    },
                  },
                }}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItem>
            )}
          </React.Fragment>
        ))}
      </List>
    </Box>
  );
  return (
    <Box sx={{ display: "flex" }}>
      <CssBaseline />
      {}
      <AppBar
        position="fixed"
        sx={{
          width: { md: desktopOpen ? `calc(100% - ${drawerWidth}px)` : "100%" },
          ml: { md: desktopOpen ? `${drawerWidth}px` : 0 },
          transition: theme.transitions.create(["width", "margin"], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {allNavigationPaths.find((item) => item.path === location.pathname)
              ?.text || "Dashboard"}
          </Typography>
          {}
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <UserSwitcher onOpenQuickSwitcher={handleOpenQuickSwitcher} />
            <NotificationBell />
            <Typography
              variant="body2"
              sx={{ mr: 1, display: { xs: "none", sm: "block" } }}
            >
              {user?.fullName}
            </Typography>
            <IconButton
              size="large"
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleProfileMenuOpen}
              color="inherit"
            >
              <Box position="relative">
                <Avatar
                  sx={{ width: 32, height: 32, bgcolor: "secondary.main" }}
                >
                  {user?.fullName?.charAt(0)?.toUpperCase()}
                </Avatar>
                {user?.role === "admin" && !user?.twoFactorEnabled && (
                  <SecurityIcon
                    color="warning"
                    sx={{
                      position: "absolute",
                      bottom: -4,
                      right: -4,
                      fontSize: 16,
                      bgcolor: "background.paper",
                      borderRadius: "50%",
                    }}
                  />
                )}
              </Box>
            </IconButton>
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
          p: location.pathname === "/notes" ? 0 : 3,
          width: { md: desktopOpen ? `calc(100% - ${drawerWidth}px)` : "100%" },
          transition: theme.transitions.create(["width", "margin"], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          overflow: location.pathname === "/notes" ? "hidden" : "auto",
          height: location.pathname === "/notes" ? "100vh" : "auto",
        }}
      >
        <Toolbar />
        <Box
          component="div"
          sx={{
            flexGrow: 1,
            overflow: location.pathname === "/notes" ? "hidden" : "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Force2FASetup>
            <Outlet />
          </Force2FASetup>
        </Box>
        {location.pathname !== "/notes" && <Footer />}
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
