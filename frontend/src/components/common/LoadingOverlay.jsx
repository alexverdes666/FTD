import React from "react";
import {
  Box,
  CircularProgress,
  LinearProgress,
  Skeleton,
} from "@mui/material";

/**
 * LoadingOverlay - Wraps children with a loading indicator.
 *
 * @param {boolean} [loading=false] - Whether to show the loading state
 * @param {React.ReactNode} children - Content to wrap
 * @param {'skeleton'|'spinner'|'linear'} [variant='spinner'] - Loading indicator style
 * @param {number} [rows=5] - Number of skeleton rows (only for skeleton variant)
 */
function LoadingOverlay({
  loading = false,
  children,
  variant = "spinner",
  rows = 5,
}) {
  if (!loading) return children || null;

  // Skeleton variant: show placeholder rows
  if (variant === "skeleton") {
    return (
      <Box sx={{ width: "100%" }}>
        {Array.from({ length: rows }).map((_, i) => (
          <Box
            key={i}
            sx={{
              display: "flex",
              gap: 2,
              mb: 1.5,
              px: 1,
            }}
          >
            <Skeleton
              variant="text"
              sx={{ flex: "0 0 15%" }}
              height={24}
            />
            <Skeleton
              variant="text"
              sx={{ flex: "0 0 25%" }}
              height={24}
            />
            <Skeleton
              variant="text"
              sx={{ flex: "0 0 20%" }}
              height={24}
            />
            <Skeleton
              variant="text"
              sx={{ flex: "0 0 15%" }}
              height={24}
            />
            <Skeleton
              variant="text"
              sx={{ flex: "1 1 auto" }}
              height={24}
            />
          </Box>
        ))}
      </Box>
    );
  }

  // Linear variant: show top progress bar above children
  if (variant === "linear") {
    return (
      <Box sx={{ position: "relative", width: "100%" }}>
        <LinearProgress
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            height: 3,
            borderRadius: "4px 4px 0 0",
            "& .MuiLinearProgress-bar": {
              bgcolor: "#1e3a5f",
            },
            bgcolor: "#e8eaf0",
          }}
        />
        <Box sx={{ opacity: 0.5, pointerEvents: "none" }}>{children}</Box>
      </Box>
    );
  }

  // Spinner variant (default): centered circular progress
  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        minHeight: 200,
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "rgba(255, 255, 255, 0.7)",
          borderRadius: "12px",
          zIndex: 10,
        }}
      >
        <CircularProgress
          size={40}
          thickness={4}
          sx={{ color: "#1e3a5f" }}
        />
      </Box>
      <Box sx={{ opacity: 0.3, pointerEvents: "none" }}>{children}</Box>
    </Box>
  );
}

LoadingOverlay.defaultProps = {
  loading: false,
  variant: "spinner",
  rows: 5,
};

export default LoadingOverlay;
