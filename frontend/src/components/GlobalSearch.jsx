import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  TextField,
  InputAdornment,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  CircularProgress,
  Fade,
  Divider,
  IconButton,
  useTheme,
  alpha,
  Popper,
  ClickAwayListener,
  Dialog,
  Button,
} from "@mui/material";
import {
  Search as SearchIcon,
  Close as CloseIcon,
  Person as PersonIcon,
  Assignment as OrderIcon,
  Contacts as LeadIcon,
  KeyboardArrowRight as ArrowIcon,
  OpenInNew as OpenInNewIcon,
} from "@mui/icons-material";
import api from "../services/api";
import LeadQuickView from "./LeadQuickView";

// Debounce hook
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

const GlobalSearch = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const inputRef = useRef(null);
  const anchorRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState({ leads: [], orders: [], users: [] });
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [focused, setFocused] = useState(false);

  // Lead detail dialog state
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [loadingLead, setLoadingLead] = useState(false);

  const debouncedQuery = useDebounce(searchQuery, 300);

  // Flatten results for keyboard navigation
  const flatResults = [
    ...results.leads.map((r) => ({ ...r, category: "leads" })),
    ...results.orders.map((r) => ({ ...r, category: "orders" })),
    ...results.users.map((r) => ({ ...r, category: "users" })),
  ];

  // Search API
  const performSearch = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setResults({ leads: [], orders: [], users: [] });
      return;
    }

    setLoading(true);
    try {
      const response = await api.get(`/global-search?q=${encodeURIComponent(query)}&limit=5`);
      if (response.data.success) {
        setResults(response.data.data);
      }
    } catch (error) {
      console.error("Global search error:", error);
      setResults({ leads: [], orders: [], users: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  // Trigger search on debounced query change
  useEffect(() => {
    performSearch(debouncedQuery);
  }, [debouncedQuery, performSearch]);

  // Fetch full lead details for the dialog
  const fetchLeadDetails = useCallback(async (leadId) => {
    setLoadingLead(true);
    try {
      const response = await api.get(`/leads/${leadId}`);
      if (response.data.success || response.data.data) {
        setSelectedLead(response.data.data || response.data);
        setLeadDialogOpen(true);
      }
    } catch (error) {
      console.error("Failed to fetch lead details:", error);
      // Fallback to navigating to leads page
      navigate(`/leads?search=${encodeURIComponent(leadId)}`);
    } finally {
      setLoadingLead(false);
    }
  }, [navigate]);

  // Handle navigation to result
  const handleNavigate = useCallback(
    (result) => {
      setOpen(false);
      setSearchQuery("");
      setResults({ leads: [], orders: [], users: [] });
      setSelectedIndex(-1);

      switch (result.type) {
        case "lead":
          // Open lead details in a dialog
          fetchLeadDetails(result._id);
          break;
        case "order":
          navigate(`/orders?search=${encodeURIComponent(result._id)}`);
          break;
        case "user":
          navigate(`/users?search=${encodeURIComponent(result.title)}`);
          break;
        default:
          break;
      }
    },
    [navigate, fetchLeadDetails]
  );

  // Handle closing lead dialog and navigating to leads page
  const handleViewInLeadsPage = useCallback(() => {
    if (selectedLead) {
      setLeadDialogOpen(false);
      navigate(`/leads?search=${encodeURIComponent(selectedLead.newEmail || selectedLead.firstName)}`);
    }
  }, [selectedLead, navigate]);

  // Handle lead update from dialog
  const handleLeadUpdate = useCallback((updatedLead) => {
    setSelectedLead(updatedLead);
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (event) => {
      if (!open || flatResults.length === 0) return;

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setSelectedIndex((prev) =>
            prev < flatResults.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          event.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : flatResults.length - 1
          );
          break;
        case "Enter":
          event.preventDefault();
          if (selectedIndex >= 0 && flatResults[selectedIndex]) {
            handleNavigate(flatResults[selectedIndex]);
          }
          break;
        case "Escape":
          event.preventDefault();
          setOpen(false);
          setSearchQuery("");
          inputRef.current?.blur();
          break;
        default:
          break;
      }
    },
    [open, flatResults, selectedIndex, handleNavigate]
  );

  // Global keyboard shortcut (Ctrl/Cmd + K)
  useEffect(() => {
    const handleGlobalKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };

    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  const handleFocus = () => {
    setFocused(true);
    if (searchQuery.length >= 2) {
      setOpen(true);
    }
  };

  const handleBlur = () => {
    setFocused(false);
  };

  const handleInputChange = (event) => {
    const value = event.target.value;
    setSearchQuery(value);
    setSelectedIndex(-1);
    if (value.length >= 2) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  const handleClear = () => {
    setSearchQuery("");
    setResults({ leads: [], orders: [], users: [] });
    setOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  const handleClickAway = () => {
    setOpen(false);
  };

  const getResultIcon = (type) => {
    switch (type) {
      case "lead":
        return <LeadIcon fontSize="small" />;
      case "order":
        return <OrderIcon fontSize="small" />;
      case "user":
        return <PersonIcon fontSize="small" />;
      default:
        return <SearchIcon fontSize="small" />;
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      active: "success",
      contacted: "info",
      converted: "warning",
      inactive: "default",
      fulfilled: "success",
      partial: "warning",
      pending: "info",
      cancelled: "error",
    };
    return colors[status] || "default";
  };

  const getRoleColor = (role) => {
    const colors = {
      admin: "error",
      affiliate_manager: "primary",
      agent: "success",
      lead_manager: "info",
      refunds_manager: "warning",
      inventory_manager: "secondary",
    };
    return colors[role] || "default";
  };

  const formatRole = (role) => {
    return role
      ?.split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const totalResults =
    results.leads.length + results.orders.length + results.users.length;
  const hasResults = totalResults > 0;

  return (
    <>
    <ClickAwayListener onClickAway={handleClickAway}>
      <Box ref={anchorRef} sx={{ position: "relative" }}>
        <TextField
          ref={inputRef}
          size="small"
          placeholder="Search leads, orders, users... (Ctrl+K)"
          value={searchQuery}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                {loading || loadingLead ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <SearchIcon
                    fontSize="small"
                    sx={{ color: focused ? "primary.main" : "action.active" }}
                  />
                )}
              </InputAdornment>
            ),
            endAdornment: searchQuery && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={handleClear} edge="end">
                  <CloseIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
            sx: {
              borderRadius: 2,
              bgcolor: alpha(theme.palette.common.white, 0.15),
              "&:hover": {
                bgcolor: alpha(theme.palette.common.white, 0.25),
              },
              "&.Mui-focused": {
                bgcolor: alpha(theme.palette.common.white, 0.25),
              },
              "& .MuiOutlinedInput-notchedOutline": {
                border: "none",
              },
              color: "inherit",
              "& input": {
                color: "inherit",
                "&::placeholder": {
                  color: "inherit",
                  opacity: 0.7,
                },
              },
              minWidth: { xs: 200, sm: 280, md: 320 },
            },
          }}
        />

        <Popper
          open={open && (hasResults || loading || searchQuery.length >= 2)}
          anchorEl={anchorRef.current}
          placement="bottom-start"
          transition
          style={{ zIndex: 1300, width: anchorRef.current?.offsetWidth || 320 }}
        >
          {({ TransitionProps }) => (
            <Fade {...TransitionProps} timeout={200}>
              <Paper
                elevation={8}
                sx={{
                  mt: 1,
                  width: { xs: 320, sm: 400 },
                  maxHeight: 480,
                  overflow: "auto",
                  borderRadius: 2,
                }}
              >
                {loading && !hasResults ? (
                  <Box sx={{ p: 3, textAlign: "center" }}>
                    <CircularProgress size={24} />
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 1 }}
                    >
                      Searching...
                    </Typography>
                  </Box>
                ) : !hasResults && searchQuery.length >= 2 ? (
                  <Box sx={{ p: 3, textAlign: "center" }}>
                    <Typography variant="body2" color="text.secondary">
                      No results found for "{searchQuery}"
                    </Typography>
                  </Box>
                ) : (
                  <>
                    {/* Leads Section */}
                    {results.leads.length > 0 && (
                      <>
                        <Box
                          sx={{
                            px: 2,
                            py: 1,
                            bgcolor: "action.hover",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <Typography
                            variant="caption"
                            fontWeight={600}
                            color="text.secondary"
                          >
                            LEADS
                          </Typography>
                          <Chip
                            label={results.leads.length}
                            size="small"
                            sx={{ height: 18, fontSize: "0.7rem" }}
                          />
                        </Box>
                        <List dense disablePadding>
                          {results.leads.map((lead, index) => {
                            const globalIndex = index;
                            return (
                              <ListItem
                                key={lead._id}
                                button
                                selected={selectedIndex === globalIndex}
                                onClick={() => handleNavigate(lead)}
                                sx={{
                                  "&.Mui-selected": {
                                    bgcolor: "primary.main",
                                    color: "primary.contrastText",
                                    "&:hover": { bgcolor: "primary.dark" },
                                  },
                                }}
                              >
                                <ListItemIcon sx={{ minWidth: 36 }}>
                                  <LeadIcon
                                    fontSize="small"
                                    color={
                                      selectedIndex === globalIndex
                                        ? "inherit"
                                        : "primary"
                                    }
                                  />
                                </ListItemIcon>
                                <ListItemText
                                  primary={
                                    <Box
                                      sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                      }}
                                    >
                                      <Typography
                                        variant="body2"
                                        fontWeight={500}
                                      >
                                        {lead.title}
                                      </Typography>
                                      <Chip
                                        label={lead.meta?.leadType?.toUpperCase()}
                                        size="small"
                                        sx={{
                                          height: 18,
                                          fontSize: "0.65rem",
                                        }}
                                      />
                                    </Box>
                                  }
                                  secondary={
                                    <Typography variant="caption" noWrap>
                                      {lead.subtitle} • {lead.meta?.country}
                                    </Typography>
                                  }
                                />
                                <ArrowIcon
                                  fontSize="small"
                                  sx={{ opacity: 0.5 }}
                                />
                              </ListItem>
                            );
                          })}
                        </List>
                      </>
                    )}

                    {/* Orders Section */}
                    {results.orders.length > 0 && (
                      <>
                        {results.leads.length > 0 && <Divider />}
                        <Box
                          sx={{
                            px: 2,
                            py: 1,
                            bgcolor: "action.hover",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <Typography
                            variant="caption"
                            fontWeight={600}
                            color="text.secondary"
                          >
                            ORDERS
                          </Typography>
                          <Chip
                            label={results.orders.length}
                            size="small"
                            sx={{ height: 18, fontSize: "0.7rem" }}
                          />
                        </Box>
                        <List dense disablePadding>
                          {results.orders.map((order, index) => {
                            const globalIndex = results.leads.length + index;
                            return (
                              <ListItem
                                key={order._id}
                                button
                                selected={selectedIndex === globalIndex}
                                onClick={() => handleNavigate(order)}
                                sx={{
                                  "&.Mui-selected": {
                                    bgcolor: "primary.main",
                                    color: "primary.contrastText",
                                    "&:hover": { bgcolor: "primary.dark" },
                                  },
                                }}
                              >
                                <ListItemIcon sx={{ minWidth: 36 }}>
                                  <OrderIcon
                                    fontSize="small"
                                    color={
                                      selectedIndex === globalIndex
                                        ? "inherit"
                                        : "warning"
                                    }
                                  />
                                </ListItemIcon>
                                <ListItemText
                                  primary={
                                    <Box
                                      sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                      }}
                                    >
                                      <Typography
                                        variant="body2"
                                        fontWeight={500}
                                      >
                                        {order.title}
                                      </Typography>
                                      <Chip
                                        label={order.meta?.status}
                                        size="small"
                                        color={getStatusColor(order.meta?.status)}
                                        sx={{
                                          height: 18,
                                          fontSize: "0.65rem",
                                        }}
                                      />
                                    </Box>
                                  }
                                  secondary={
                                    <Typography variant="caption" noWrap>
                                      {order.subtitle}
                                      {order.meta?.country &&
                                        ` • ${order.meta.country}`}
                                    </Typography>
                                  }
                                />
                                <ArrowIcon
                                  fontSize="small"
                                  sx={{ opacity: 0.5 }}
                                />
                              </ListItem>
                            );
                          })}
                        </List>
                      </>
                    )}

                    {/* Users Section */}
                    {results.users.length > 0 && (
                      <>
                        {(results.leads.length > 0 ||
                          results.orders.length > 0) && <Divider />}
                        <Box
                          sx={{
                            px: 2,
                            py: 1,
                            bgcolor: "action.hover",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <Typography
                            variant="caption"
                            fontWeight={600}
                            color="text.secondary"
                          >
                            USERS
                          </Typography>
                          <Chip
                            label={results.users.length}
                            size="small"
                            sx={{ height: 18, fontSize: "0.7rem" }}
                          />
                        </Box>
                        <List dense disablePadding>
                          {results.users.map((user, index) => {
                            const globalIndex =
                              results.leads.length +
                              results.orders.length +
                              index;
                            return (
                              <ListItem
                                key={user._id}
                                button
                                selected={selectedIndex === globalIndex}
                                onClick={() => handleNavigate(user)}
                                sx={{
                                  "&.Mui-selected": {
                                    bgcolor: "primary.main",
                                    color: "primary.contrastText",
                                    "&:hover": { bgcolor: "primary.dark" },
                                  },
                                }}
                              >
                                <ListItemIcon sx={{ minWidth: 36 }}>
                                  <PersonIcon
                                    fontSize="small"
                                    color={
                                      selectedIndex === globalIndex
                                        ? "inherit"
                                        : "success"
                                    }
                                  />
                                </ListItemIcon>
                                <ListItemText
                                  primary={
                                    <Box
                                      sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                      }}
                                    >
                                      <Typography
                                        variant="body2"
                                        fontWeight={500}
                                      >
                                        {user.title}
                                      </Typography>
                                      <Chip
                                        label={formatRole(user.meta?.role)}
                                        size="small"
                                        color={getRoleColor(user.meta?.role)}
                                        sx={{
                                          height: 18,
                                          fontSize: "0.65rem",
                                        }}
                                      />
                                    </Box>
                                  }
                                  secondary={
                                    <Typography variant="caption" noWrap>
                                      {user.subtitle}
                                    </Typography>
                                  }
                                />
                                <ArrowIcon
                                  fontSize="small"
                                  sx={{ opacity: 0.5 }}
                                />
                              </ListItem>
                            );
                          })}
                        </List>
                      </>
                    )}

                    {/* Footer hint */}
                    <Box
                      sx={{
                        px: 2,
                        py: 1,
                        bgcolor: "action.hover",
                        borderTop: 1,
                        borderColor: "divider",
                      }}
                    >
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                        }}
                      >
                        <kbd
                          style={{
                            background: theme.palette.action.selected,
                            padding: "2px 6px",
                            borderRadius: 4,
                            fontSize: "0.7rem",
                          }}
                        >
                          ↑↓
                        </kbd>
                        Navigate
                        <kbd
                          style={{
                            background: theme.palette.action.selected,
                            padding: "2px 6px",
                            borderRadius: 4,
                            fontSize: "0.7rem",
                            marginLeft: 8,
                          }}
                        >
                          Enter
                        </kbd>
                        Select
                        <kbd
                          style={{
                            background: theme.palette.action.selected,
                            padding: "2px 6px",
                            borderRadius: 4,
                            fontSize: "0.7rem",
                            marginLeft: 8,
                          }}
                        >
                          Esc
                        </kbd>
                        Close
                      </Typography>
                    </Box>
                  </>
                )}
              </Paper>
            </Fade>
          )}
        </Popper>
      </Box>
    </ClickAwayListener>

    {/* Lead Detail Dialog */}
    <Dialog
      open={leadDialogOpen}
      onClose={() => setLeadDialogOpen(false)}
      maxWidth="lg"
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight: "90vh",
          overflow: "visible",
          bgcolor: "transparent",
          boxShadow: "none",
        },
      }}
      BackdropProps={{
        sx: {
          bgcolor: "rgba(0, 0, 0, 0.5)",
        },
      }}
    >
      <Box sx={{ position: "relative" }}>
        {/* Close button */}
        <IconButton
          onClick={() => setLeadDialogOpen(false)}
          size="small"
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            zIndex: 1,
            bgcolor: "background.paper",
            boxShadow: 1,
            "&:hover": {
              bgcolor: "action.hover",
            },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
        
        {loadingLead ? (
          <Paper
            elevation={8}
            sx={{
              p: 4,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minHeight: 300,
              minWidth: 400,
              borderRadius: 2,
            }}
          >
            <CircularProgress />
          </Paper>
        ) : selectedLead ? (
          <Box>
            <LeadQuickView
              lead={selectedLead}
              onLeadUpdate={handleLeadUpdate}
              readOnly
              titleExtra={
                <Button
                  onClick={handleViewInLeadsPage}
                  variant="outlined"
                  size="small"
                  startIcon={<OpenInNewIcon />}
                >
                  Open in Leads Page
                </Button>
              }
            />
          </Box>
        ) : null}
      </Box>
    </Dialog>
    </>
  );
};

export default GlobalSearch;
