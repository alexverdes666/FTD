import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Button,
  Typography,
  Box,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Phone as PhoneIcon,
  AccessTime as AccessTimeIcon,
  Add as AddIcon,
  Check as CheckIcon,
  HourglassEmpty as HourglassIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';

const COMPACT_TABLE_SX = {
  tableLayout: "fixed",
  "& .MuiTableHead-root .MuiTableCell-head": {
    background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
    color: "#fff",
    fontWeight: 700,
    fontSize: "0.65rem",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    borderBottom: "2px solid #3b82f6",
    py: 0.4,
    px: 1,
    lineHeight: 1.1,
  },
  "& .MuiTableBody-root .MuiTableCell-root": {
    py: 0.25,
    px: 1,
    fontSize: "0.78rem",
    lineHeight: 1.3,
  },
  "& .MuiTableBody-root .MuiTableRow-root:nth-of-type(even)": {
    bgcolor: "rgba(0, 0, 0, 0.015)",
  },
  "& .MuiTableBody-root .MuiTableRow-root:hover": {
    bgcolor: "rgba(25, 118, 210, 0.06)",
    transition: "background-color 0.15s ease",
  },
};

const PAGINATION_SX = {
  borderTop: "1px solid",
  borderColor: "divider",
  "& .MuiTablePagination-toolbar": { minHeight: 32, pl: 0 },
  "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows": { fontSize: "0.72rem" },
  "& .MuiTablePagination-select": { fontSize: "0.72rem" },
  "& .MuiTablePagination-actions button": { p: 0.25 },
};

const UndeclaredCallsTable = ({
  calls = [],
  loading = false,
  error = null,
  onDeclare,
  onViewDetails,
  emptyMessage = "No undeclared calls found"
}) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  const extractEmail = (raw) => {
    if (!raw) return null;
    const match = raw.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
    return match ? match[0] : raw;
  };

  const getDurationColor = (seconds) => {
    if (seconds >= 3600) return 'error';
    if (seconds >= 1800) return 'warning';
    return 'default';
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" py={3}>
        <CircularProgress size={20} />
        <Typography variant="body2" color="text.secondary" sx={{ ml: 1, fontSize: "0.78rem" }}>
          Loading calls...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error" sx={{ mb: 1, py: 0.25 }}>{error}</Alert>;
  }

  if (!calls || calls.length === 0) {
    return (
      <Box textAlign="center" py={3}>
        <PhoneIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
        <Typography variant="body2" color="text.secondary">{emptyMessage}</Typography>
      </Box>
    );
  }

  const paginatedCalls = calls.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, height: "100%" }}>
      <TableContainer component={Paper} variant="outlined" sx={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
        <Table stickyHeader size="small" sx={COMPACT_TABLE_SX}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: "22%" }}>Alias</TableCell>
              <TableCell sx={{ width: "20%" }}>Date & Time</TableCell>
              <TableCell sx={{ width: "14%" }}>Duration</TableCell>
              <TableCell sx={{ width: "18%" }}>Phone Number</TableCell>
              <TableCell sx={{ width: "26%" }} align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedCalls.map((call, index) => (
              <TableRow key={call.cdrCallId || index} hover>
                <TableCell>
                  <Typography variant="body2" sx={{ fontSize: "0.75rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {extractEmail(call.email) || 'N/A'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontSize: "0.75rem" }}>
                    {formatDate(call.callDate)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    icon={<AccessTimeIcon sx={{ fontSize: 14 }} />}
                    label={call.formattedDuration}
                    size="small"
                    color={getDurationColor(call.callDuration)}
                    variant="outlined"
                    sx={{ height: 20, fontSize: "0.68rem" }}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontFamily="monospace" sx={{ fontSize: "0.75rem" }}>
                    {call.lineNumber || 'N/A'}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Box display="flex" justifyContent="flex-end" alignItems="center" gap={0.5}>
                    {call.declarationStatus === 'approved' ? (
                      <>
                        <Chip icon={<CheckIcon sx={{ fontSize: 14 }} />} label="Declared" size="small" color="success" sx={{ height: 20, fontSize: "0.68rem" }} />
                        {onViewDetails && call.declarationId && (
                          <Tooltip title="View Details">
                            <IconButton size="small" onClick={() => onViewDetails(call)} sx={{ p: 0.25 }}>
                              <VisibilityIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </>
                    ) : call.declarationStatus === 'pending' ? (
                      <>
                        <Chip icon={<HourglassIcon sx={{ fontSize: 14 }} />} label="Pending" size="small" color="warning" sx={{ height: 20, fontSize: "0.68rem" }} />
                        {onViewDetails && call.declarationId && (
                          <Tooltip title="View Details">
                            <IconButton size="small" onClick={() => onViewDetails(call)} sx={{ p: 0.25 }}>
                              <VisibilityIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </>
                    ) : (
                      <Button
                        variant="contained"
                        color="primary"
                        size="small"
                        startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                        onClick={() => onDeclare(call)}
                        sx={{ fontSize: "0.7rem", py: 0.25, px: 1, minWidth: 0, textTransform: "none" }}
                      >
                        Declare
                      </Button>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        rowsPerPageOptions={[25, 50, 100]}
        component="div"
        count={calls.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={(_, newPage) => setPage(newPage)}
        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        sx={{ ...PAGINATION_SX, mt: "auto", flexShrink: 0 }}
      />
    </Box>
  );
};

export default UndeclaredCallsTable;
