import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  Button,
  IconButton,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Pagination,
  Skeleton,
  Alert,
  Divider,
  Tooltip,
  Stack,
  Drawer,
  useTheme,
  useMediaQuery,
  Breadcrumbs,
  Link,
  Badge,
  Collapse,
} from "@mui/material";
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Sort as SortIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  Person as PersonIcon,
  Assignment as OrderIcon,
  Contacts as LeadIcon,
  Campaign as CampaignIcon,
  ConfirmationNumber as TicketIcon,
  Announcement as AnnouncementIcon,
  Business as BusinessIcon,
  Hub as HubIcon,
  AccountTree as NetworkIcon,
  OpenInNew as OpenInNewIcon,
  ContentCopy as CopyIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  ViewList as ListViewIcon,
  GridView as GridViewIcon,
  Home as HomeIcon,
} from "@mui/icons-material";
import { fullSearch, getEntityTypeConfig, highlightText, formatSearchDate, ENTITY_TYPES } from "../services/searchService";
import api from "../services/api";

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
  return icons[type] || SearchIcon;
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

// Highlighted text component
const HighlightedText = ({ text, query }) => {
  if (!text || !query) return <>{text}</>;
  
  const terms = query
    .replace(/"[^"]+"/g, "")
    .replace(/\w+:\w+/g, "")
    .trim()
    .split(/\s+/)
    .filter((term) => term.length >= 2);

  const quotedPhrases = query.match(/"([^"]+)"/g);
  if (quotedPhrases) {
    quotedPhrases.forEach((phrase) => {
      terms.push(phrase.replace(/"/g, ""));
    });
  }

  if (terms.length === 0) return <>{text}</>;

  const pattern = new RegExp(
    `(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi"
  );

  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, index) => {
        const isHighlight = terms.some((term) => part.toLowerCase() === term.toLowerCase());
        return isHighlight ? (
          <Box
            key={index}
            component="span"
            sx={{
              backgroundColor: "warning.light",
              fontWeight: 600,
              borderRadius: 0.5,
              px: 0.5,
            }}
          >
            {part}
          </Box>
        ) : (
          <span key={index}>{part}</span>
        );
      })}
    </>
  );
};

// Loading skeleton
const ResultSkeleton = ({ view }) => (
  <Grid container spacing={2}>
    {[1, 2, 3, 4, 5, 6].map((i) => (
      <Grid item xs={12} sm={view === "grid" ? 6 : 12} md={view === "grid" ? 4 : 12} key={i}>
        <Card>
          <CardContent>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
              <Skeleton variant="circular" width={40} height={40} />
              <Box sx={{ flex: 1 }}>
                <Skeleton variant="text" width="60%" height={24} />
                <Skeleton variant="text" width="40%" height={20} />
              </Box>
            </Box>
            <Skeleton variant="text" width="80%" />
            <Skeleton variant="text" width="60%" />
          </CardContent>
        </Card>
      </Grid>
    ))}
  </Grid>
);

// Result card component
const ResultCard = ({ result, query, view, onNavigate, onCopyDetails }) => {
  const theme = useTheme();
  const Icon = getResultIcon(result.type);
  const typeConfig = getEntityTypeConfig(result.type);

  return (
    <Card
      sx={{
        height: "100%",
        cursor: "pointer",
        transition: "all 0.2s ease",
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: theme.shadows[4],
        },
      }}
      onClick={() => onNavigate(result)}
    >
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, mb: 2 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: `${typeConfig.color}.lighter` || "action.hover",
            }}
          >
            <Icon color={typeConfig.color} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={600} noWrap>
              <HighlightedText text={result.title} query={query} />
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              <HighlightedText text={result.subtitle} query={query} />
            </Typography>
          </Box>
        </Box>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
          <Chip
            label={typeConfig.label}
            size="small"
            color={typeConfig.color}
            variant="outlined"
          />
          {result.meta?.status && (
            <Chip
              label={result.meta.status}
              size="small"
              color={getStatusColor(result.meta.status)}
            />
          )}
          {result.meta?.leadType && (
            <Chip label={result.meta.leadType.toUpperCase()} size="small" />
          )}
          {result.meta?.priority && (
            <Chip
              label={result.meta.priority}
              size="small"
              color={result.meta.priority === "urgent" ? "error" : result.meta.priority === "high" ? "warning" : "default"}
            />
          )}
        </Stack>

        {view === "list" && (
          <Box sx={{ mt: 1 }}>
            {result.meta?.country && (
              <Typography variant="caption" color="text.secondary" sx={{ mr: 2 }}>
                Country: {result.meta.country}
              </Typography>
            )}
            {result.meta?.campaign && (
              <Typography variant="caption" color="text.secondary" sx={{ mr: 2 }}>
                Campaign: {result.meta.campaign}
              </Typography>
            )}
            {result.meta?.assignedAgent && (
              <Typography variant="caption" color="text.secondary" sx={{ mr: 2 }}>
                Agent: {result.meta.assignedAgent}
              </Typography>
            )}
          </Box>
        )}

        <Typography variant="caption" color="text.secondary">
          {result.meta?.createdAt && formatSearchDate(result.meta.createdAt)}
        </Typography>
      </CardContent>
      <CardActions sx={{ justifyContent: "space-between", px: 2, pb: 2 }}>
        <Tooltip title={result.type === "lead" ? "Copy details (Name, Email, Phone, Country)" : "Copy ID"}>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onCopyDetails(result);
            }}
          >
            <CopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Button
          size="small"
          endIcon={<OpenInNewIcon fontSize="small" />}
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(result);
          }}
        >
          View
        </Button>
      </CardActions>
    </Card>
  );
};

// Filter sidebar component
const FilterSidebar = ({ counts, selectedTypes, onTypeChange, onClearFilters }) => {
  const allTypes = Object.keys(ENTITY_TYPES);
  const hasFilters = selectedTypes.length > 0;

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={600}>
          <FilterIcon sx={{ mr: 1, verticalAlign: "middle" }} />
          Filters
        </Typography>
        {hasFilters && (
          <Button size="small" onClick={onClearFilters}>
            Clear
          </Button>
        )}
      </Box>

      <Divider sx={{ mb: 2 }} />

      <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>
        Categories
      </Typography>
      <FormGroup>
        {allTypes.map((type) => {
          const config = ENTITY_TYPES[type];
          const count = counts[type] || 0;
          const Icon = getResultIcon(type);

          return (
            <FormControlLabel
              key={type}
              control={
                <Checkbox
                  checked={selectedTypes.includes(type)}
                  onChange={() => onTypeChange(type)}
                  size="small"
                />
              }
              label={
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Icon fontSize="small" color={config.color} />
                  <Typography variant="body2">{config.label}</Typography>
                  <Badge badgeContent={count} color="primary" max={99} />
                </Box>
              }
              sx={{ mb: 0.5 }}
            />
          );
        })}
      </FormGroup>
    </Paper>
  );
};

const SearchResultsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // State
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [inputQuery, setInputQuery] = useState(searchParams.get("q") || "");
  const [results, setResults] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(parseInt(searchParams.get("page")) || 1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [selectedTypes, setSelectedTypes] = useState(
    searchParams.get("types")?.split(",").filter(Boolean) || []
  );
  const [sort, setSort] = useState(searchParams.get("sort") || "relevance");
  const [view, setView] = useState("grid");
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  // Perform search
  const performSearch = useCallback(async () => {
    if (!query || query.length < 2) {
      setResults([]);
      setCounts({});
      setTotalResults(0);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fullSearch({
        query,
        page,
        limit: 20,
        types: selectedTypes.length > 0 ? selectedTypes : null,
        sort,
      });

      if (response.success) {
        setResults(response.data);
        setCounts(response.meta.counts || {});
        setTotalResults(response.meta.totalResults);
        setTotalPages(response.meta.pagination?.totalPages || 1);
      }
    } catch (err) {
      console.error("Search error:", err);
      setError(err.message || "Failed to perform search");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, page, selectedTypes, sort]);

  // Update URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (page > 1) params.set("page", page.toString());
    if (selectedTypes.length > 0) params.set("types", selectedTypes.join(","));
    if (sort !== "relevance") params.set("sort", sort);
    setSearchParams(params, { replace: true });
  }, [query, page, selectedTypes, sort, setSearchParams]);

  // Perform search when params change
  useEffect(() => {
    performSearch();
  }, [performSearch]);

  // Handle search submit
  const handleSearch = (e) => {
    e?.preventDefault();
    setQuery(inputQuery);
    setPage(1);
  };

  // Handle type filter change
  const handleTypeChange = (type) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
    setPage(1);
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSelectedTypes([]);
    setPage(1);
  };

  // Handle pagination
  const handlePageChange = (event, value) => {
    setPage(value);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Navigate to result
  const handleNavigate = useCallback(
    (result) => {
      switch (result.type) {
        case "lead":
          navigate(`/leads?search=${encodeURIComponent(result._id)}`);
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
    [navigate]
  );

  // Copy details to clipboard (tab-separated for Google Sheets)
  const handleCopyDetails = useCallback((result) => {
    // For leads, copy: Full Name, Email, Phone, Country (tab-separated)
    if (result.type === "lead") {
      const fullName = result.title || "";
      const email = result.subtitle || "";
      const phone = result.meta?.phone || "";
      const country = result.meta?.country || "";
      const copyText = [fullName, email, phone, country].join("\t");
      navigator.clipboard.writeText(copyText);
    } else {
      // For other types, just copy the ID
      navigator.clipboard.writeText(result._id);
    }
  }, []);

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          underline="hover"
          color="inherit"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate("/");
          }}
          sx={{ display: "flex", alignItems: "center" }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
          Home
        </Link>
        <Typography color="text.primary">Search Results</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" fontWeight={600} gutterBottom>
          Search Results
        </Typography>

        {/* Search Bar */}
        <Box component="form" onSubmit={handleSearch} sx={{ mb: 2 }}>
          <TextField
            fullWidth
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Search across all entities..."
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: inputQuery && (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => {
                      setInputQuery("");
                      setQuery("");
                    }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {/* Query info and controls */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          <Box>
            {query && (
              <Typography variant="body2" color="text.secondary">
                {loading ? (
                  "Searching..."
                ) : (
                  <>
                    Found <strong>{totalResults}</strong> results for "<strong>{query}</strong>"
                  </>
                )}
              </Typography>
            )}
          </Box>

          <Stack direction="row" spacing={2} alignItems="center">
            {/* Sort */}
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Sort by</InputLabel>
              <Select
                value={sort}
                label="Sort by"
                onChange={(e) => {
                  setSort(e.target.value);
                  setPage(1);
                }}
              >
                <MenuItem value="relevance">Relevance</MenuItem>
                <MenuItem value="date">Date (Newest)</MenuItem>
                <MenuItem value="name">Name (A-Z)</MenuItem>
              </Select>
            </FormControl>

            {/* View toggle */}
            <Box sx={{ display: { xs: "none", sm: "flex" }, gap: 0.5 }}>
              <IconButton
                size="small"
                color={view === "grid" ? "primary" : "default"}
                onClick={() => setView("grid")}
              >
                <GridViewIcon />
              </IconButton>
              <IconButton
                size="small"
                color={view === "list" ? "primary" : "default"}
                onClick={() => setView("list")}
              >
                <ListViewIcon />
              </IconButton>
            </Box>

            {/* Mobile filter button */}
            {isMobile && (
              <Badge
                badgeContent={selectedTypes.length}
                color="primary"
                invisible={selectedTypes.length === 0}
              >
                <IconButton onClick={() => setFilterDrawerOpen(true)}>
                  <FilterIcon />
                </IconButton>
              </Badge>
            )}

            {/* Refresh */}
            <IconButton onClick={performSearch} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Stack>
        </Box>

        {/* Active filters */}
        {selectedTypes.length > 0 && (
          <Box sx={{ mt: 2, display: "flex", gap: 1, flexWrap: "wrap" }}>
            {selectedTypes.map((type) => {
              const config = ENTITY_TYPES[type];
              return (
                <Chip
                  key={type}
                  label={config?.label || type}
                  onDelete={() => handleTypeChange(type)}
                  color={config?.color || "default"}
                  size="small"
                />
              );
            })}
            <Button size="small" onClick={handleClearFilters}>
              Clear all
            </Button>
          </Box>
        )}
      </Paper>

      {/* Error state */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Main content */}
      <Grid container spacing={3}>
        {/* Sidebar - Desktop only */}
        {!isMobile && (
          <Grid item md={3}>
            <FilterSidebar
              counts={counts}
              selectedTypes={selectedTypes}
              onTypeChange={handleTypeChange}
              onClearFilters={handleClearFilters}
            />
          </Grid>
        )}

        {/* Results */}
        <Grid item xs={12} md={isMobile ? 12 : 9}>
          {loading ? (
            <ResultSkeleton view={view} />
          ) : results.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: "center" }}>
              <SearchIcon sx={{ fontSize: 64, color: "text.secondary", mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                {query ? "No results found" : "Enter a search query"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {query
                  ? "Try using different keywords or check spelling"
                  : "Search across leads, orders, users, campaigns, and more"}
              </Typography>
            </Paper>
          ) : (
            <>
              <Grid container spacing={2}>
                {results.map((result) => (
                  <Grid
                    item
                    xs={12}
                    sm={view === "grid" ? 6 : 12}
                    md={view === "grid" ? 4 : 12}
                    key={result._id}
                  >
                    <ResultCard
                      result={result}
                      query={query}
                      view={view}
                      onNavigate={handleNavigate}
                      onCopyDetails={handleCopyDetails}
                    />
                  </Grid>
                ))}
              </Grid>

              {/* Pagination */}
              {totalPages > 1 && (
                <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
                  <Pagination
                    count={totalPages}
                    page={page}
                    onChange={handlePageChange}
                    color="primary"
                    size={isMobile ? "small" : "medium"}
                    showFirstButton
                    showLastButton
                  />
                </Box>
              )}
            </>
          )}
        </Grid>
      </Grid>

      {/* Mobile filter drawer */}
      <Drawer
        anchor="right"
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
      >
        <Box sx={{ width: 280, p: 2 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="h6">Filters</Typography>
            <IconButton onClick={() => setFilterDrawerOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
          <FilterSidebar
            counts={counts}
            selectedTypes={selectedTypes}
            onTypeChange={handleTypeChange}
            onClearFilters={handleClearFilters}
          />
        </Box>
      </Drawer>
    </Container>
  );
};

export default SearchResultsPage;
