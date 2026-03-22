import React from "react";
import {
  Box,
  Paper,
  Typography,
  Skeleton,
} from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";

/**
 * StatCard - KPI card displaying a metric with optional trend indicator.
 *
 * @param {string} title - Metric label (e.g. "Total Revenue")
 * @param {string|number} value - The primary value to display
 * @param {React.ReactNode} [icon] - Icon element shown in a colored circle
 * @param {string} [color='#1e3a5f'] - Accent color for icon circle and border
 * @param {number} [trend] - Trend percentage (e.g. 12.5)
 * @param {'up'|'down'} [trendDirection] - Trend direction
 * @param {string} [subtitle] - Additional context text below the trend
 * @param {Function} [onClick] - Click handler
 * @param {boolean} [loading=false] - Show skeleton loader
 */
function StatCard({
  title,
  value,
  icon,
  color = "#1e3a5f",
  trend,
  trendDirection,
  subtitle,
  onClick,
  loading = false,
}) {
  const trendColor = trendDirection === "up" ? "#2e7d32" : "#c62828";

  if (loading) {
    return (
      <Paper
        sx={{
          p: 2.5,
          borderRadius: "12px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)",
          borderLeft: `4px solid ${color}`,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
          <Skeleton variant="circular" width={48} height={48} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="60%" height={20} />
            <Skeleton variant="text" width="40%" height={36} sx={{ mt: 0.5 }} />
            <Skeleton variant="text" width="50%" height={16} sx={{ mt: 0.5 }} />
          </Box>
        </Box>
      </Paper>
    );
  }

  return (
    <Paper
      onClick={onClick}
      sx={{
        p: 2.5,
        borderRadius: "12px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)",
        borderLeft: `4px solid ${color}`,
        cursor: onClick ? "pointer" : "default",
        transition: "transform 200ms ease, box-shadow 200ms ease",
        "&:hover": onClick
          ? {
              transform: "translateY(-2px)",
              boxShadow:
                "0 4px 12px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.08)",
            }
          : {},
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
        {/* Icon circle */}
        {icon && (
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              bgcolor: `${color}14`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: color,
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
        )}

        {/* Content */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="body2"
            sx={{
              color: "#9e9e9e",
              fontWeight: 500,
              fontSize: "0.8rem",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            {title}
          </Typography>

          <Typography
            variant="h5"
            sx={{
              fontWeight: 700,
              color: "#1e3a5f",
              mt: 0.5,
              lineHeight: 1.2,
              fontSize: "1.5rem",
            }}
          >
            {value}
          </Typography>

          {/* Trend + subtitle row */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              mt: 0.75,
            }}
          >
            {trend !== undefined && trendDirection && (
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.25,
                  color: trendColor,
                  fontSize: "0.8rem",
                  fontWeight: 600,
                }}
              >
                {trendDirection === "up" ? (
                  <TrendingUpIcon sx={{ fontSize: 16 }} />
                ) : (
                  <TrendingDownIcon sx={{ fontSize: 16 }} />
                )}
                {trend}%
              </Box>
            )}
            {subtitle && (
              <Typography
                variant="caption"
                sx={{ color: "#bdbdbd" }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>
      </Box>
    </Paper>
  );
}

StatCard.defaultProps = {
  icon: undefined,
  color: "#1e3a5f",
  trend: undefined,
  trendDirection: undefined,
  subtitle: undefined,
  onClick: undefined,
  loading: false,
};

export default StatCard;
