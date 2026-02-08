import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  Popper,
  ClickAwayListener,
  Dialog,
  Button,
  Tooltip,
  Skeleton,
  Stack,
} from "@mui/material";
import {
  Search as SearchIcon,
  Close as CloseIcon,
  Person as PersonIcon,
  Assignment as OrderIcon,
  Contacts as LeadIcon,
  KeyboardArrowRight as ArrowIcon,
  OpenInNew as OpenInNewIcon,
  Campaign as CampaignIcon,
  ConfirmationNumber as TicketIcon,
  Announcement as AnnouncementIcon,
  Business as BusinessIcon,
  Hub as HubIcon,
  AccountTree as NetworkIcon,
  History as HistoryIcon,
  ContentCopy as CopyIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  DeleteOutline as DeleteIcon,
  TrendingUp as TrendingIcon,
} from "@mui/icons-material";
import { quickSearch, getEntityTypeConfig, highlightText, formatSearchDate } from "../services/searchService";
import useSearchHistory from "../hooks/useSearchHistory";
import LeadQuickView from "./LeadQuickView";
import api from "../services/api";

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

// Icon mapping
const getResultIcon = (type) => {
  const icons = {
    lead: LeadIcon,
    order: OrderIcon,
    user: PersonIcon,
    campaign: CampaignIcon,
    ticket: TicketIcon,
    announcement: AnnouncementIcon,
    clientBroker: BusinessIcon,
    clientNetwork: HubIcon,
    ourNetwork: NetworkIcon,
  };
  const Icon = icons[type] || SearchIcon;
  return Icon;
};

// Status color mapping
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
    open: "warning",
    in_progress: "info",
    resolved: "success",
    closed: "default",
    paused: "warning",
    completed: "success",
    draft: "default",
  };
  return colors[status] || "default";
};

// Role color mapping
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

// Highlighted text component
const HighlightedText = ({ text, query }) => {
  const segments = highlightText(text, query);
  
  return (
    <>
      {segments.map((segment, index) => (
        <span
          key={index}
          style={{
            backgroundColor: segment.highlight ? "rgba(255, 235, 59, 0.4)" : "transparent",
            fontWeight: segment.highlight ? 600 : "inherit",
            borderRadius: segment.highlight ? 2 : 0,
            padding: segment.highlight ? "0 2px" : 0,
          }}
        >
          {segment.text}
        </span>
      ))}
    </>
  );
};

// Category section header
const CategoryHeader = ({ label, count, color, onSeeAll }) => {
  const theme = useTheme();
  
  return (
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
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="caption" fontWeight={600} color="text.secondary">
          {label.toUpperCase()}
        </Typography>
        <Chip
          label={count}
          size="small"
          color={color}
          sx={{ height: 18, fontSize: "0.7rem" }}
        />
      </Box>
      {onSeeAll && (
        <Button
          size="small"
          onClick={onSeeAll}
          sx={{ fontSize: "0.7rem", textTransform: "none", minWidth: "auto" }}
        >
          See all
        </Button>
      )}
    </Box>
  );
};

// Loading skeleton
const SearchSkeleton = () => (
  <Box sx={{ p: 2 }}>
    {[1, 2, 3].map((i) => (
      <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
        <Skeleton variant="circular" width={24} height={24} />
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="text" width="60%" height={20} />
          <Skeleton variant="text" width="40%" height={16} />
        </Box>
      </Box>
    ))}
  </Box>
);

const GlobalSearch = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const inputRef = useRef(null);
  const anchorRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState({
    leads: [],
    orders: [],
    users: [],
    campaigns: [],
    tickets: [],
    announcements: [],
    clientBrokers: [],
    clientNetworks: [],
    ourNetworks: [],
  });
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [focused, setFocused] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [activeFilters, setActiveFilters] = useState([]);
  const [hoveredResult, setHoveredResult] = useState(null);

  // Lead detail dialog state
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [loadingLead, setLoadingLead] = useState(false);

  // Search history
  const { history, deleteEntry, clearAll } = useSearchHistory();

  const debouncedQuery = useDebounce(searchQuery, 300);

  // Flatten results for keyboard navigation
  const flatResults = useMemo(() => {
    const flat = [];
    const categories = [
      "leads", "orders", "users", "campaigns", "tickets",
      "announcements", "clientBrokers", "clientNetworks", "ourNetworks"
    ];
    categories.forEach((cat) => {
      results[cat]?.forEach((r) => flat.push({ ...r, category: cat }));
    });
    return flat;
  }, [results]);

  // Category configs for rendering
  const categoryConfigs = useMemo(() => [
    { key: "leads", label: "Leads", color: "primary", type: "lead" },
    { key: "orders", label: "Orders", color: "warning", type: "order" },
    { key: "users", label: "Users", color: "success", type: "user" },
    { key: "campaigns", label: "Campaigns", color: "info", type: "campaign" },
    { key: "tickets", label: "Tickets", color: "error", type: "ticket" },
    { key: "announcements", label: "Announcements", color: "secondary", type: "announcement" },
    { key: "clientBrokers", label: "Client Brokers", color: "default", type: "clientBroker" },
    { key: "clientNetworks", label: "Client Networks", color: "default", type: "clientNetwork" },
    { key: "ourNetworks", label: "Our Networks", color: "default", type: "ourNetwork" },
  ], []);

  // Search API
  const performSearch = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setResults({
        leads: [],
        orders: [],
        users: [],
        campaigns: [],
        tickets: [],
        announcements: [],
        clientBrokers: [],
        clientNetworks: [],
        ourNetworks: [],
      });
      return;
    }

    setLoading(true);
    setShowHistory(false);
    try {
      const types = activeFilters.length > 0 ? activeFilters : null;
      const response = await quickSearch(query, 5, types);
      if (response.success) {
        setResults(response.data);
      }
    } catch (error) {
      console.error("Global search error:", error);
      setResults({
        leads: [],
        orders: [],
        users: [],
        campaigns: [],
        tickets: [],
        announcements: [],
        clientBrokers: [],
        clientNetworks: [],
        ourNetworks: [],
      });
    } finally {
      setLoading(false);
    }
  }, [activeFilters]);

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
      setResults({
        leads: [],
        orders: [],
        users: [],
        campaigns: [],
        tickets: [],
        announcements: [],
        clientBrokers: [],
        clientNetworks: [],
        ourNetworks: [],
      });
      setSelectedIndex(-1);

      switch (result.type) {
        case "lead":
          fetchLeadDetails(result._id);
          break;
        case "order":
          navigate(`/orders?search=${encodeURIComponent(result._id)}`);
          break;
        case "user":
          navigate(`/users?search=${encodeURIComponent(result.title)}`);
          break;
        case "campaign":
          navigate(`/campaigns?search=${encodeURIComponent(result.title)}`);
          break;
        case "ticket":
          navigate(`/tickets?id=${encodeURIComponent(result._id)}`);
          break;
        case "announcement":
          navigate(`/announcements`);
          break;
        case "clientBroker":
          navigate(`/client-brokers?search=${encodeURIComponent(result.title)}`);
          break;
        case "clientNetwork":
          navigate(`/client-networks?search=${encodeURIComponent(result.title)}`);
          break;
        case "ourNetwork":
          navigate(`/our-networks?search=${encodeURIComponent(result.title)}`);
          break;
        default:
          break;
      }
    },
    [navigate, fetchLeadDetails]
  );

  // Handle "See all" for a category
  const handleSeeAll = useCallback((type) => {
    setOpen(false);
    navigate(`/search?q=${encodeURIComponent(searchQuery)}&types=${type}`);
  }, [navigate, searchQuery]);

  // Handle "See all results"
  const handleSeeAllResults = useCallback(() => {
    setOpen(false);
    navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
  }, [navigate, searchQuery]);

  // Handle clicking a history item
  const handleHistoryClick = useCallback((query) => {
    setSearchQuery(query);
    setShowHistory(false);
  }, []);

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

  // Copy details to clipboard (tab-separated for Google Sheets)
  const handleCopyDetails = useCallback((e, result) => {
    e.stopPropagation();
    let copyText = "";
    
    switch (result.type) {
      case "lead":
        // Copy: Full Name, Email, Phone, Country
        copyText = [
          result.title || "",
          result.subtitle || "",
          result.meta?.phone || "",
          result.meta?.country || ""
        ].join("\t");
        break;
      case "user":
        // Copy: Name, Email
        copyText = [result.title || "", result.subtitle || ""].join("\t");
        break;
      case "campaign":
        // Copy: Name
        copyText = result.title || "";
        break;
      case "ticket":
        // Copy: Title
        copyText = result.title || "";
        break;
      case "announcement":
        // Copy: Title
        copyText = result.title || "";
        break;
      case "clientBroker":
        // Copy: Name, Domain
        copyText = [result.title || "", result.meta?.domain || ""].join("\t");
        break;
      case "clientNetwork":
        // Copy: Name
        copyText = result.title || "";
        break;
      case "ourNetwork":
        // Copy: Name, Assigned Manager
        copyText = [result.title || "", result.meta?.assignedManager || ""].join("\t");
        break;
      default:
        // For other types, just copy the ID
        copyText = result._id;
    }
    
    navigator.clipboard.writeText(copyText);
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        setSearchQuery("");
        inputRef.current?.blur();
        return;
      }

      if (!open) return;

      if (showHistory && history.length > 0) {
        // Navigate history
        switch (event.key) {
          case "ArrowDown":
            event.preventDefault();
            setSelectedIndex((prev) =>
              prev < history.length - 1 ? prev + 1 : 0
            );
            break;
          case "ArrowUp":
            event.preventDefault();
            setSelectedIndex((prev) =>
              prev > 0 ? prev - 1 : history.length - 1
            );
            break;
          case "Enter":
            event.preventDefault();
            if (selectedIndex >= 0 && history[selectedIndex]) {
              handleHistoryClick(history[selectedIndex].query);
            }
            break;
          default:
            break;
        }
        return;
      }

      if (flatResults.length === 0) return;

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
          } else if (searchQuery.length >= 2) {
            handleSeeAllResults();
          }
          break;
        case "Tab":
          event.preventDefault();
          // Cycle through categories
          break;
        default:
          break;
      }
    },
    [open, flatResults, selectedIndex, handleNavigate, showHistory, history, handleHistoryClick, searchQuery, handleSeeAllResults]
  );

  // Global keyboard shortcut (Ctrl/Cmd + K or /)
  useEffect(() => {
    const handleGlobalKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
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
      setShowHistory(false);
    } else if (searchQuery.length === 0 && history.length > 0) {
      setOpen(true);
      setShowHistory(true);
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
      setShowHistory(false);
    } else if (value.length === 0 && history.length > 0) {
      setOpen(true);
      setShowHistory(true);
    } else {
      setOpen(false);
    }
  };

  const handleClear = () => {
    setSearchQuery("");
    setResults({
      leads: [],
      orders: [],
      users: [],
      campaigns: [],
      tickets: [],
      announcements: [],
      clientBrokers: [],
      clientNetworks: [],
      ourNetworks: [],
    });
    setOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  const handleClickAway = () => {
    setOpen(false);
  };

  const totalResults = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);
  const hasResults = totalResults > 0;

  // Calculate global index for a result in a category
  const getGlobalIndex = (categoryKey, localIndex) => {
    let globalIndex = 0;
    for (const config of categoryConfigs) {
      if (config.key === categoryKey) {
        return globalIndex + localIndex;
      }
      globalIndex += (results[config.key]?.length || 0);
    }
    return -1;
  };

  // Render a single result item
  const renderResultItem = (result, categoryKey, localIndex) => {
    const globalIndex = getGlobalIndex(categoryKey, localIndex);
    const Icon = getResultIcon(result.type);
    const typeConfig = getEntityTypeConfig(result.type);
    const isSelected = selectedIndex === globalIndex;
    const isHovered = hoveredResult === result._id;

    return (
      <ListItem
        key={result._id}
        button
        selected={isSelected}
        onClick={() => handleNavigate(result)}
        onMouseEnter={() => setHoveredResult(result._id)}
        onMouseLeave={() => setHoveredResult(null)}
        sx={{
          "&.Mui-selected": {
            bgcolor: "primary.main",
            color: "primary.contrastText",
            "&:hover": { bgcolor: "primary.dark" },
          },
          position: "relative",
        }}
      >
        <ListItemIcon sx={{ minWidth: 36 }}>
          <Icon
            fontSize="small"
            color={isSelected ? "inherit" : typeConfig.color}
          />
        </ListItemIcon>
        <ListItemText
          primary={
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="body2" fontWeight={500} noWrap sx={{ maxWidth: 200 }}>
                <HighlightedText text={result.title} query={searchQuery} />
              </Typography>
              {result.meta?.status && (
                <Chip
                  label={result.meta.status}
                  size="small"
                  color={getStatusColor(result.meta.status)}
                  sx={{ height: 18, fontSize: "0.65rem" }}
                />
              )}
              {result.meta?.role && (
                <Chip
                  label={formatRole(result.meta.role)}
                  size="small"
                  color={getRoleColor(result.meta.role)}
                  sx={{ height: 18, fontSize: "0.65rem" }}
                />
              )}
              {result.meta?.leadType && (
                <Chip
                  label={result.meta.leadType.toUpperCase()}
                  size="small"
                  sx={{ height: 18, fontSize: "0.65rem" }}
                />
              )}
              {result.meta?.priority && (
                <Chip
                  label={result.meta.priority}
                  size="small"
                  color={result.meta.priority === "urgent" ? "error" : result.meta.priority === "high" ? "warning" : "default"}
                  sx={{ height: 18, fontSize: "0.65rem" }}
                />
              )}
            </Box>
          }
          secondary={
            <Typography variant="caption" noWrap color={isSelected ? "inherit" : "text.secondary"}>
              <HighlightedText text={result.subtitle} query={searchQuery} />
              {result.meta?.country && ` • ${result.meta.country}`}
              {result.meta?.createdAt && ` • ${formatSearchDate(result.meta.createdAt)}`}
            </Typography>
          }
        />
        {/* Quick actions on hover */}
        {isHovered && !isSelected && (
          <Stack direction="row" spacing={0.5} sx={{ position: "absolute", right: 8 }}>
            <Tooltip title={
                result.type === "lead" ? "Copy details (Name, Email, Phone, Country)" :
                result.type === "user" ? "Copy details (Name, Email)" :
                result.type === "campaign" ? "Copy name" :
                result.type === "ticket" ? "Copy title" :
                result.type === "announcement" ? "Copy title" :
                result.type === "clientBroker" ? "Copy details (Name, Domain)" :
                result.type === "clientNetwork" ? "Copy name" :
                result.type === "ourNetwork" ? "Copy details (Name, Assigned Manager)" :
                "Copy ID"
              }>
              <IconButton size="small" onClick={(e) => handleCopyDetails(e, result)}>
                <CopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        )}
        {!isHovered && <ArrowIcon fontSize="small" sx={{ opacity: 0.5 }} />}
      </ListItem>
    );
  };

  return (
    <>
      <ClickAwayListener onClickAway={handleClickAway}>
        <Box ref={anchorRef} sx={{ position: "relative" }}>
          <TextField
            inputRef={inputRef}
            size="small"
            placeholder="Search... (Ctrl+K)"
            value={searchQuery}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  {loading || loadingLead ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <SearchIcon
                      sx={{
                        fontSize: 18,
                        color: focused ? "primary.main" : "action.active",
                      }}
                    />
                  )}
                </InputAdornment>
              ),
              endAdornment: searchQuery && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={handleClear} edge="end" sx={{ p: 0.25 }}>
                    <CloseIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </InputAdornment>
              ),
              sx: {
                borderRadius: 1.5,
                bgcolor: "rgba(255,255,255,0.08)",
                "&:hover": { bgcolor: "rgba(255,255,255,0.13)" },
                "&.Mui-focused": { bgcolor: "rgba(255,255,255,0.15)" },
                "& .MuiOutlinedInput-notchedOutline": { border: "none" },
                color: "inherit",
                height: 30,
                fontSize: "0.8rem",
                "& input": {
                  color: "inherit",
                  py: 0,
                  "&::placeholder": { color: "inherit", opacity: 0.6, fontSize: "0.8rem" },
                },
                width: { xs: 240, sm: 300 },
                transition: "width 0.2s, background-color 0.2s",
              },
            }}
          />

          <Popper
            open={open && (hasResults || loading || searchQuery.length >= 2 || showHistory)}
            anchorEl={anchorRef.current}
            placement="bottom-start"
            transition
            style={{ zIndex: 1300, width: anchorRef.current?.offsetWidth || 400 }}
          >
            {({ TransitionProps }) => (
              <Fade {...TransitionProps} timeout={200}>
                <Paper
                  elevation={8}
                  sx={{
                    mt: 1,
                    width: { xs: 360, sm: 450 },
                    maxHeight: 520,
                    overflow: "auto",
                    borderRadius: 2,
                    "&::-webkit-scrollbar": { display: "none" },
                    msOverflowStyle: "none",
                    scrollbarWidth: "none",
                  }}
                >
                  {/* Search History */}
                  {showHistory && history.length > 0 && (
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
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <HistoryIcon fontSize="small" color="action" />
                          <Typography variant="caption" fontWeight={600} color="text.secondary">
                            RECENT SEARCHES
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          onClick={clearAll}
                          sx={{ fontSize: "0.7rem", textTransform: "none" }}
                        >
                          Clear all
                        </Button>
                      </Box>
                      <List dense disablePadding>
                        {history.slice(0, 8).map((item, index) => (
                          <ListItem
                            key={item._id}
                            button
                            selected={selectedIndex === index}
                            onClick={() => handleHistoryClick(item.query)}
                            secondaryAction={
                              <IconButton
                                edge="end"
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteEntry(item._id);
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            }
                          >
                            <ListItemIcon sx={{ minWidth: 36 }}>
                              <HistoryIcon fontSize="small" color="action" />
                            </ListItemIcon>
                            <ListItemText
                              primary={item.query}
                              secondary={`${item.resultCount} results • ${formatSearchDate(item.searchedAt)}`}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </>
                  )}

                  {/* Loading State */}
                  {loading && !hasResults && <SearchSkeleton />}

                  {/* No Results */}
                  {!loading && !hasResults && searchQuery.length >= 2 && !showHistory && (
                    <Box sx={{ p: 3, textAlign: "center" }}>
                      <Typography variant="body2" color="text.secondary">
                        No results found for "{searchQuery}"
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                        Try using different keywords or check spelling
                      </Typography>
                    </Box>
                  )}

                  {/* Search Results */}
                  {hasResults && !showHistory && (
                    <>
                      {categoryConfigs.map((config) => {
                        const items = results[config.key] || [];
                        if (items.length === 0) return null;

                        return (
                          <React.Fragment key={config.key}>
                            {config.key !== "leads" && <Divider />}
                            <CategoryHeader
                              label={config.label}
                              count={items.length}
                              color={config.color}
                              onSeeAll={() => handleSeeAll(config.type)}
                            />
                            <List dense disablePadding>
                              {items.map((item, index) =>
                                renderResultItem(item, config.key, index)
                              )}
                            </List>
                          </React.Fragment>
                        );
                      })}

                      {/* Footer */}
                      <Box
                        sx={{
                          px: 2,
                          py: 1.5,
                          bgcolor: "action.hover",
                          borderTop: 1,
                          borderColor: "divider",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: "flex", alignItems: "center", gap: 1 }}
                        >
                          <kbd style={{ background: theme.palette.action.selected, padding: "2px 6px", borderRadius: 4, fontSize: "0.7rem" }}>↑↓</kbd>
                          Navigate
                          <kbd style={{ background: theme.palette.action.selected, padding: "2px 6px", borderRadius: 4, fontSize: "0.7rem", marginLeft: 8 }}>Enter</kbd>
                          Select
                          <kbd style={{ background: theme.palette.action.selected, padding: "2px 6px", borderRadius: 4, fontSize: "0.7rem", marginLeft: 8 }}>Esc</kbd>
                          Close
                        </Typography>
                        <Button
                          size="small"
                          endIcon={<ArrowIcon />}
                          onClick={handleSeeAllResults}
                          sx={{ fontSize: "0.75rem", textTransform: "none" }}
                        >
                          See all {totalResults} results
                        </Button>
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
          sx: { bgcolor: "rgba(0, 0, 0, 0.5)" },
        }}
      >
        <Box sx={{ position: "relative" }}>
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
              "&:hover": { bgcolor: "action.hover" },
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

export default React.memo(GlobalSearch);
