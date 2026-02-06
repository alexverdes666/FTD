import React from "react";
import { Box, Skeleton, TableRow, TableCell } from "@mui/material";

/**
 * Skeleton loader for table rows. Drop this into a <TableBody> while loading.
 * @param {number} rows - Number of skeleton rows to display (default: 5)
 * @param {number} columns - Number of columns (default: 6)
 */
function TableSkeleton({ rows = 5, columns = 6 }) {
  return Array.from({ length: rows }).map((_, rowIdx) => (
    <TableRow key={rowIdx}>
      {Array.from({ length: columns }).map((_, colIdx) => (
        <TableCell key={colIdx}>
          <Skeleton variant="text" width={colIdx === 0 ? "80%" : "60%"} />
        </TableCell>
      ))}
    </TableRow>
  ));
}

/**
 * Skeleton loader for card/section content while data is loading.
 * @param {number} rows - Number of skeleton rows (default: 6)
 */
function SectionSkeleton({ rows = 6 }) {
  return (
    <Box sx={{ p: 2, width: "100%" }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Box key={i} sx={{ display: "flex", gap: 2, mb: 1.5 }}>
          <Skeleton variant="text" width="15%" />
          <Skeleton variant="text" width="20%" />
          <Skeleton variant="text" width="25%" />
          <Skeleton variant="text" width="15%" />
          <Skeleton variant="text" width="10%" />
        </Box>
      ))}
    </Box>
  );
}

/**
 * Skeleton for calendar-style grids.
 */
function CalendarSkeleton() {
  return (
    <Box sx={{ p: 2 }}>
      {/* Day headers */}
      <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} variant="text" width="13%" height={28} />
        ))}
      </Box>
      {/* Calendar rows */}
      {Array.from({ length: 5 }).map((_, row) => (
        <Box key={row} sx={{ display: "flex", gap: 1, mb: 1 }}>
          {Array.from({ length: 7 }).map((_, col) => (
            <Skeleton
              key={col}
              variant="rounded"
              sx={{ width: "13%", height: 80 }}
            />
          ))}
        </Box>
      ))}
    </Box>
  );
}

export { TableSkeleton, SectionSkeleton, CalendarSkeleton };
