import React, { useCallback } from "react";
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  Typography,
  Skeleton,
} from "@mui/material";
import InboxIcon from "@mui/icons-material/InboxOutlined";

/**
 * DataTable - Professional table wrapper with loading, empty state, sorting, and pagination.
 *
 * @param {Array<{id: string, label: string, align?: string, width?: string|number, sortable?: boolean, render?: Function}>} columns
 * @param {Array<Object>} rows - Data rows. Each row should have an `_id` or `id` field.
 * @param {boolean} [loading=false] - Show skeleton rows
 * @param {string} [emptyMessage='No data found'] - Message when rows is empty
 * @param {React.ReactNode} [emptyIcon] - Icon for empty state
 * @param {Function} [onRowClick] - Called with (row) when a row is clicked
 * @param {{ page: number, rowsPerPage: number, totalCount: number, onPageChange: Function, onRowsPerPageChange: Function }} [pagination]
 * @param {{ orderBy: string, order: 'asc'|'desc', onSort: Function }} [sortable] - Sort configuration
 * @param {boolean} [dense=false] - Dense padding
 * @param {boolean} [stickyHeader=false] - Sticky header
 * @param {Function} [rowActions] - Render function (row) => ReactNode, appended as last cell
 */
function DataTable({
  columns = [],
  rows = [],
  loading = false,
  emptyMessage = "No data found",
  emptyIcon,
  onRowClick,
  pagination,
  sortable,
  dense = false,
  stickyHeader = false,
  rowActions,
}) {
  const skeletonRows = dense ? 8 : 5;

  const getRowKey = useCallback(
    (row, index) => row._id || row.id || index,
    []
  );

  const handleSort = useCallback(
    (columnId) => {
      if (!sortable || !sortable.onSort) return;
      const isAsc =
        sortable.orderBy === columnId && sortable.order === "asc";
      sortable.onSort(columnId, isAsc ? "desc" : "asc");
    },
    [sortable]
  );

  const effectiveColumns = rowActions
    ? [...columns, { id: "__actions", label: "", width: "auto", sortable: false }]
    : columns;

  return (
    <Paper
      sx={{
        borderRadius: "12px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)",
        overflow: "hidden",
      }}
    >
      <TableContainer
        sx={{
          maxHeight: stickyHeader ? 600 : "none",
        }}
      >
        <Table
          size={dense ? "small" : "medium"}
          stickyHeader={stickyHeader}
        >
          {/* Header */}
          <TableHead>
            <TableRow>
              {effectiveColumns.map((col) => (
                <TableCell
                  key={col.id}
                  align={col.align || "left"}
                  sx={{
                    bgcolor: "#f8f9fa",
                    fontWeight: 700,
                    fontSize: "0.7rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.8px",
                    color: "#607d8b",
                    borderBottom: "2px solid #e0e0e0",
                    width: col.width || "auto",
                    whiteSpace: "nowrap",
                    py: dense ? 1 : 1.5,
                  }}
                  sortDirection={
                    sortable && sortable.orderBy === col.id
                      ? sortable.order
                      : false
                  }
                >
                  {sortable && col.sortable !== false && col.id !== "__actions" ? (
                    <TableSortLabel
                      active={sortable.orderBy === col.id}
                      direction={
                        sortable.orderBy === col.id ? sortable.order : "asc"
                      }
                      onClick={() => handleSort(col.id)}
                      sx={{
                        "&.Mui-active": { color: "#1e3a5f" },
                        "& .MuiTableSortLabel-icon": { color: "#1e3a5f !important" },
                      }}
                    >
                      {col.label}
                    </TableSortLabel>
                  ) : (
                    col.label
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {/* Loading state */}
            {loading &&
              Array.from({ length: skeletonRows }).map((_, rowIdx) => (
                <TableRow key={`skeleton-${rowIdx}`}>
                  {effectiveColumns.map((col) => (
                    <TableCell key={col.id} sx={{ py: dense ? 0.75 : 1.5 }}>
                      <Skeleton
                        variant="text"
                        width={col.id === "__actions" ? 60 : "75%"}
                        height={20}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {/* Empty state */}
            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={effectiveColumns.length}
                  sx={{ py: 6, textAlign: "center", border: "none" }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 1,
                    }}
                  >
                    {emptyIcon || (
                      <InboxIcon
                        sx={{ fontSize: 48, color: "#bdbdbd" }}
                      />
                    )}
                    <Typography
                      variant="body2"
                      sx={{ color: "#9e9e9e", fontWeight: 500 }}
                    >
                      {emptyMessage}
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            )}

            {/* Data rows */}
            {!loading &&
              rows.map((row, index) => (
                <TableRow
                  key={getRowKey(row, index)}
                  onClick={() => onRowClick && onRowClick(row)}
                  sx={{
                    cursor: onRowClick ? "pointer" : "default",
                    bgcolor: index % 2 === 0 ? "#ffffff" : "#fafbfc",
                    transition: "background-color 200ms ease",
                    "&:hover": {
                      bgcolor: "#f0f4f8",
                    },
                    "&:last-child td": { borderBottom: 0 },
                  }}
                >
                  {columns.map((col) => (
                    <TableCell
                      key={col.id}
                      align={col.align || "left"}
                      sx={{
                        py: dense ? 0.75 : 1.5,
                        fontSize: "0.875rem",
                        color: "#37474f",
                      }}
                    >
                      {col.render
                        ? col.render(row[col.id], row, index)
                        : row[col.id]}
                    </TableCell>
                  ))}
                  {rowActions && (
                    <TableCell
                      align="right"
                      sx={{
                        py: dense ? 0.75 : 1.5,
                      }}
                    >
                      {rowActions(row)}
                    </TableCell>
                  )}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {pagination && !loading && rows.length > 0 && (
        <TablePagination
          component="div"
          count={pagination.totalCount || 0}
          page={pagination.page || 0}
          onPageChange={(e, newPage) =>
            pagination.onPageChange && pagination.onPageChange(newPage)
          }
          rowsPerPage={pagination.rowsPerPage || 10}
          onRowsPerPageChange={(e) =>
            pagination.onRowsPerPageChange &&
            pagination.onRowsPerPageChange(parseInt(e.target.value, 10))
          }
          rowsPerPageOptions={[5, 10, 25, 50]}
          sx={{
            borderTop: "1px solid #e0e0e0",
            "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows":
              {
                fontSize: "0.8rem",
                color: "#607d8b",
              },
          }}
        />
      )}
    </Paper>
  );
}

DataTable.defaultProps = {
  columns: [],
  rows: [],
  loading: false,
  emptyMessage: "No data found",
  emptyIcon: undefined,
  onRowClick: undefined,
  pagination: undefined,
  sortable: undefined,
  dense: false,
  stickyHeader: false,
  rowActions: undefined,
};

export default DataTable;
