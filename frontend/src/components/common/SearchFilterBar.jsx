import React from "react";
import {
  Box,
  Paper,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Badge,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import ClearIcon from "@mui/icons-material/Clear";

/**
 * SearchFilterBar - Search input + filter dropdowns in a Paper container.
 *
 * @param {string} [searchValue=''] - Current search text
 * @param {Function} [onSearchChange] - Called with the new search string
 * @param {string} [searchPlaceholder='Search...'] - Placeholder for search input
 * @param {Array<{label: string, value: *, options: Array<{label: string, value: *}>, onChange: Function}>} [filters]
 * @param {Function} [onClearFilters] - Called when user clicks Clear Filters
 * @param {number} [activeFilterCount=0] - Number of active filters (shown as badge)
 * @param {React.ReactNode} [children] - Additional elements rendered at the end
 */
function SearchFilterBar({
  searchValue = "",
  onSearchChange,
  searchPlaceholder = "Search...",
  filters = [],
  onClearFilters,
  activeFilterCount = 0,
  children,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <Paper
      sx={{
        p: 2,
        mb: 2.5,
        borderRadius: "12px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)",
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        {/* Search field */}
        <TextField
          size="small"
          value={searchValue}
          onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: "#9e9e9e", fontSize: 20 }} />
              </InputAdornment>
            ),
          }}
          sx={{
            minWidth: isMobile ? "100%" : 260,
            flex: isMobile ? "1 1 100%" : "0 1 320px",
            "& .MuiOutlinedInput-root": {
              borderRadius: "8px",
              fontSize: "0.875rem",
              bgcolor: "#fafbfc",
              "&:hover .MuiOutlinedInput-notchedOutline": {
                borderColor: "#1e3a5f",
              },
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                borderColor: "#1e3a5f",
              },
            },
          }}
        />

        {/* Filter dropdowns */}
        {filters.map((filter, index) => (
          <FormControl
            key={index}
            size="small"
            sx={{
              minWidth: isMobile ? "100%" : 150,
              flex: isMobile ? "1 1 100%" : "0 0 auto",
            }}
          >
            <InputLabel
              sx={{
                fontSize: "0.85rem",
                "&.Mui-focused": { color: "#1e3a5f" },
              }}
            >
              {filter.label}
            </InputLabel>
            <Select
              value={filter.value ?? ""}
              label={filter.label}
              onChange={(e) =>
                filter.onChange && filter.onChange(e.target.value)
              }
              sx={{
                borderRadius: "8px",
                fontSize: "0.875rem",
                bgcolor: "#fafbfc",
                "&:hover .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#1e3a5f",
                },
                "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#1e3a5f",
                },
              }}
            >
              <MenuItem value="">
                <Typography variant="body2" sx={{ color: "#9e9e9e" }}>
                  All
                </Typography>
              </MenuItem>
              {(filter.options || []).map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ))}

        {/* Spacer */}
        <Box sx={{ flexGrow: 1 }} />

        {/* Active filter badge + clear */}
        {activeFilterCount > 0 && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Badge
              badgeContent={activeFilterCount}
              color="primary"
              sx={{
                "& .MuiBadge-badge": {
                  bgcolor: "#f57c00",
                  fontSize: "0.7rem",
                },
              }}
            >
              <FilterListIcon sx={{ color: "#607d8b", fontSize: 22 }} />
            </Badge>
            {onClearFilters && (
              <Button
                size="small"
                startIcon={<ClearIcon sx={{ fontSize: 16 }} />}
                onClick={onClearFilters}
                sx={{
                  textTransform: "none",
                  fontSize: "0.8rem",
                  color: "#c62828",
                  fontWeight: 500,
                  "&:hover": {
                    bgcolor: "#ffebee",
                  },
                }}
              >
                Clear Filters
              </Button>
            )}
          </Box>
        )}

        {/* Additional children */}
        {children}
      </Box>
    </Paper>
  );
}

SearchFilterBar.defaultProps = {
  searchValue: "",
  onSearchChange: undefined,
  searchPlaceholder: "Search...",
  filters: [],
  onClearFilters: undefined,
  activeFilterCount: 0,
  children: undefined,
};

export default SearchFilterBar;
