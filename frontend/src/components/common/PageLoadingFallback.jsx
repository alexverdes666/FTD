import React from "react";
import { Box, Skeleton, Paper } from "@mui/material";

function PageLoadingFallback() {
  return (
    <Box sx={{ p: 3, width: "100%" }}>
      {/* Page title skeleton */}
      <Skeleton variant="text" width={240} height={40} sx={{ mb: 2 }} />

      {/* Toolbar / filters skeleton */}
      <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
        <Skeleton variant="rounded" width={200} height={40} />
        <Skeleton variant="rounded" width={160} height={40} />
        <Skeleton variant="rounded" width={120} height={40} />
        <Box sx={{ flexGrow: 1 }} />
        <Skeleton variant="rounded" width={100} height={40} />
      </Box>

      {/* Table skeleton */}
      <Paper sx={{ overflow: "hidden" }}>
        {/* Table header */}
        <Box sx={{ display: "flex", gap: 2, p: 2, bgcolor: "grey.50" }}>
          {[100, 150, 120, 180, 120, 100, 80].map((w, i) => (
            <Skeleton key={i} variant="text" width={w} height={24} />
          ))}
        </Box>
        {/* Table rows */}
        {Array.from({ length: 8 }).map((_, row) => (
          <Box
            key={row}
            sx={{
              display: "flex",
              gap: 2,
              p: 2,
              borderTop: "1px solid",
              borderColor: "divider",
            }}
          >
            {[100, 150, 120, 180, 120, 100, 80].map((w, i) => (
              <Skeleton key={i} variant="text" width={w} height={20} />
            ))}
          </Box>
        ))}
      </Paper>

      {/* Pagination skeleton */}
      <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2, gap: 1 }}>
        <Skeleton variant="text" width={120} height={32} />
        <Skeleton variant="rounded" width={180} height={32} />
      </Box>
    </Box>
  );
}

export default PageLoadingFallback;
