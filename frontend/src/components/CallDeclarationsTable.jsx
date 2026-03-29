import React, { useState, useEffect, useRef } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Typography,
  Box,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
} from '@mui/material';
import {
  Phone as PhoneIcon,
  AccessTime as AccessTimeIcon,
  Delete as DeleteIcon,
  PlayCircleOutline as PlayIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { fetchRecordingBlob } from '../services/callDeclarations';
import { formatDateBG } from '../utils/dateUtils';

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

const CallDeclarationsTable = ({
  declarations = [],
  loading = false,
  error = null,
  onViewDetails,
  onDelete,
  showAgent = false,
  hidePagination = false,
  hideRecordings = false,
  emptyMessage = "No declarations found"
}) => {
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [recordingDeclaration, setRecordingDeclaration] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const audioUrlRef = useRef(null);

  const toggleRow = (id) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    if (recordingDeclaration?.recordFile) {
      setAudioLoading(true);
      setAudioUrl(null);
      fetchRecordingBlob(recordingDeclaration.recordFile)
        .then((url) => { audioUrlRef.current = url; setAudioUrl(url); })
        .catch((err) => console.error("Failed to load recording:", err))
        .finally(() => setAudioLoading(false));
    }
    return () => {
      if (audioUrlRef.current) { URL.revokeObjectURL(audioUrlRef.current); audioUrlRef.current = null; }
    };
  }, [recordingDeclaration]);

  const formatDate = (dateStr) => formatDateBG(dateStr);
  const formatCurrency = (value) => `$${Number(value || 0).toFixed(2)}`;

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'approved': return 'success';
      case 'rejected': return 'error';
      default: return 'default';
    }
  };

  const getCallTypeLabel = (callType, callCategory) => {
    if (callCategory === 'filler') return 'Filler';
    const labels = {
      deposit: 'Deposit',
      first_call: '1st Call',
      second_call: '2nd Call',
      third_call: '3rd Call',
      fourth_call: '4th Call',
      fifth_call: '5th Call',
      sixth_call: '6th Call',
      seventh_call: '7th Call',
      eighth_call: '8th Call',
      ninth_call: '9th Call',
      tenth_call: '10th Call',
    };
    return labels[callType] || callType || 'N/A';
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  };

  const getDurationColor = (seconds) => {
    if (seconds >= 3600) return 'error';
    if (seconds >= 1800) return 'warning';
    return 'default';
  };

  // Calculate column count for colSpan
  const colCount = 9 + (showAgent ? 2 : 0);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" py={3}>
        <CircularProgress size={20} />
        <Typography variant="body2" color="text.secondary" sx={{ ml: 1, fontSize: "0.78rem" }}>
          Loading declarations...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error" sx={{ mb: 1, py: 0.25 }}>{error}</Alert>;
  }

  if (!declarations || declarations.length === 0) {
    return (
      <Box textAlign="center" py={3}>
        <PhoneIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
        <Typography variant="body2" color="text.secondary">{emptyMessage}</Typography>
      </Box>
    );
  }

  const paginatedDeclarations = hidePagination ? declarations : declarations.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, height: "100%" }}>
      <TableContainer component={Paper} variant="outlined" sx={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
        <Table stickyHeader size="small" sx={COMPACT_TABLE_SX}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: "3%" }} />
              {showAgent && <TableCell sx={{ width: "10%" }}>Agent</TableCell>}
              <TableCell sx={{ width: showAgent ? "10%" : "12%" }}>AM</TableCell>
              <TableCell sx={{ width: "10%" }}>Order</TableCell>
              <TableCell sx={{ width: showAgent ? "11%" : "13%" }}>Date</TableCell>
              <TableCell sx={{ width: "7%" }}>Duration</TableCell>
              <TableCell sx={{ width: showAgent ? "12%" : "16%" }}>Lead</TableCell>
              <TableCell sx={{ width: "9%" }}>Type</TableCell>
              <TableCell sx={{ width: "7%" }} align="right">Bonus</TableCell>
              <TableCell sx={{ width: "7%" }} align="center">Status</TableCell>
              <TableCell sx={{ width: showAgent ? "6%" : "8%" }} align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedDeclarations.map((declaration) => {
              const isExpanded = expandedRows.has(declaration._id);
              const leadName = declaration.lead
                ? `${declaration.lead.firstName || ''} ${declaration.lead.lastName || ''}`.trim() || 'N/A'
                : 'N/A';
              const orderId = declaration.orderId?._id || declaration.orderId;
              const orderIdStr = typeof orderId === 'string' ? orderId : orderId?.toString?.() || '';

              return (
                <React.Fragment key={declaration._id}>
                  <TableRow hover sx={{ cursor: 'pointer' }} onClick={() => toggleRow(declaration._id)}>
                    <TableCell sx={{ p: 0, textAlign: "center" }}>
                      <IconButton size="small" sx={{ p: 0.25 }}>
                        {isExpanded ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
                      </IconButton>
                    </TableCell>
                    {showAgent && (
                      <TableCell>
                        <Typography sx={{ fontSize: "0.75rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {declaration.agent?.fullName || 'N/A'}
                        </Typography>
                      </TableCell>
                    )}
                    <TableCell>
                      <Typography sx={{ fontSize: "0.75rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {declaration.affiliateManager?.fullName || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: "0.72rem", fontFamily: "monospace", color: "primary.dark" }}>
                        {orderIdStr ? `...${orderIdStr.slice(-6)}` : '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: "0.75rem" }}>
                        {formatDate(declaration.callDate)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={<AccessTimeIcon sx={{ fontSize: 12 }} />}
                        label={formatDuration(declaration.callDuration)}
                        size="small"
                        color={getDurationColor(declaration.callDuration)}
                        variant="outlined"
                        sx={{ height: 18, fontSize: "0.65rem", "& .MuiChip-icon": { ml: 0.25 } }}
                      />
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography sx={{ fontSize: "0.75rem", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {leadName}
                        </Typography>
                        <Typography sx={{ fontSize: "0.65rem", color: "text.secondary", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {declaration.lineNumber || declaration.lead?.newPhone || ''}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getCallTypeLabel(declaration.callType, declaration.callCategory)}
                        size="small"
                        color={declaration.callCategory === 'filler' ? 'info' : 'default'}
                        variant="outlined"
                        sx={{ height: 18, fontSize: "0.65rem" }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "success.main" }}>
                        {formatCurrency(declaration.totalBonus)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={declaration.status}
                        size="small"
                        color={getStatusColor(declaration.status)}
                        sx={{ height: 18, fontSize: "0.62rem", textTransform: "capitalize" }}
                      />
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <Box display="flex" justifyContent="flex-end" gap={0}>
                        {declaration.recordFile && !hideRecordings && (
                          <Tooltip title="Play Recording">
                            <IconButton size="small" color="primary" onClick={() => setRecordingDeclaration(declaration)} sx={{ p: 0.25 }}>
                              <PlayIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                        {onViewDetails && (
                          <Tooltip title="View Details">
                            <IconButton size="small" onClick={() => onViewDetails(declaration)} sx={{ p: 0.25 }}>
                              <VisibilityIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                        {onDelete && declaration.status === 'pending' && (
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error" onClick={() => onDelete(declaration)} sx={{ p: 0.25 }}>
                              <DeleteIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>

                  {/* Expanded Detail Row */}
                  <TableRow>
                    <TableCell sx={{ py: 0, borderBottom: isExpanded ? undefined : "none" }} colSpan={colCount}>
                      <Collapse in={isExpanded} timeout={0}>
                        <Box sx={{ py: 1, px: 2, bgcolor: "rgba(0,0,0,0.02)", borderRadius: 1, my: 0.5 }}>
                          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                            <Box>
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.65rem", textTransform: "uppercase" }}>Category</Typography>
                              <Typography sx={{ fontSize: "0.78rem", fontWeight: 500 }}>
                                {declaration.callCategory === 'ftd' ? 'FTD' : 'Filler'}
                              </Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.65rem", textTransform: "uppercase" }}>Call Type</Typography>
                              <Typography sx={{ fontSize: "0.78rem", fontWeight: 500 }}>
                                {getCallTypeLabel(declaration.callType, declaration.callCategory)}
                              </Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.65rem", textTransform: "uppercase" }}>Affiliate Manager</Typography>
                              <Typography sx={{ fontSize: "0.78rem" }}>{declaration.affiliateManager?.fullName || 'N/A'}</Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.65rem", textTransform: "uppercase" }}>Lead</Typography>
                              <Typography sx={{ fontSize: "0.78rem" }}>{leadName}</Typography>
                              {declaration.lead?.newEmail && (
                                <Typography sx={{ fontSize: "0.68rem", color: "text.secondary" }}>{declaration.lead.newEmail}</Typography>
                              )}
                            </Box>
                            <Box>
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.65rem", textTransform: "uppercase" }}>Phone</Typography>
                              <Typography sx={{ fontSize: "0.78rem", fontFamily: "monospace" }}>
                                {declaration.lineNumber || declaration.lead?.newPhone || 'N/A'}
                              </Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.65rem", textTransform: "uppercase" }}>Order ID</Typography>
                              <Typography sx={{ fontSize: "0.78rem", fontFamily: "monospace", color: "primary.dark" }}>
                                {orderIdStr || 'N/A'}
                              </Typography>
                            </Box>
                            {declaration.orderId?.plannedDate && (
                              <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.65rem", textTransform: "uppercase" }}>Order Planned</Typography>
                                <Typography sx={{ fontSize: "0.78rem" }}>{formatDate(declaration.orderId.plannedDate)}</Typography>
                              </Box>
                            )}
                            <Box>
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.65rem", textTransform: "uppercase" }}>Bonus Breakdown</Typography>
                              <Typography sx={{ fontSize: "0.78rem" }}>
                                Base: {formatCurrency(declaration.baseBonus)}
                                {declaration.hourlyBonus > 0 && ` + Hourly: ${formatCurrency(declaration.hourlyBonus)}`}
                                {' = '}<strong>{formatCurrency(declaration.totalBonus)}</strong>
                              </Typography>
                            </Box>
                          </Box>

                          {declaration.description && (
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.65rem", textTransform: "uppercase" }}>Description</Typography>
                              <Typography sx={{ fontSize: "0.78rem", color: "text.secondary" }}>{declaration.description}</Typography>
                            </Box>
                          )}

                          {declaration.reviewedBy && (
                            <Box sx={{ mt: 1, pt: 1, borderTop: "1px solid", borderColor: "divider" }}>
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.65rem", textTransform: "uppercase" }}>
                                Reviewed by {declaration.reviewedBy?.fullName || 'N/A'} on {declaration.reviewedAt ? formatDate(declaration.reviewedAt) : 'N/A'}
                              </Typography>
                              {declaration.reviewNotes && (
                                <Typography sx={{ fontSize: "0.78rem", color: "text.secondary", mt: 0.25 }}>
                                  {declaration.reviewNotes}
                                </Typography>
                              )}
                            </Box>
                          )}

                          {/* Inline Recording Player */}
                          {declaration.recordFile && !hideRecordings && (
                            <Box sx={{ mt: 1, pt: 1, borderTop: "1px solid", borderColor: "divider" }}>
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.65rem", textTransform: "uppercase", mb: 0.5, display: "block" }}>Recording</Typography>
                              <InlineRecordingPlayer recordFile={declaration.recordFile} />
                            </Box>
                          )}
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      {!hidePagination && (
        <TablePagination
          rowsPerPageOptions={[25, 50, 100]}
          component="div"
          count={declarations.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          sx={{
            mt: "auto",
            flexShrink: 0,
            borderTop: "1px solid",
            borderColor: "divider",
            "& .MuiTablePagination-toolbar": { minHeight: 32, pl: 0 },
            "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows": { fontSize: "0.72rem" },
            "& .MuiTablePagination-select": { fontSize: "0.72rem" },
            "& .MuiTablePagination-actions button": { p: 0.25 },
          }}
        />
      )}

      {/* Recording Playback Dialog (for action button) */}
      <Dialog open={!!recordingDeclaration} onClose={() => setRecordingDeclaration(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ py: 1.5 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={1}>
              <PlayIcon color="primary" sx={{ fontSize: 20 }} />
              <Typography variant="subtitle1" fontWeight={600}>Call Recording</Typography>
            </Box>
            <IconButton size="small" onClick={() => setRecordingDeclaration(null)}><CloseIcon sx={{ fontSize: 18 }} /></IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {recordingDeclaration && (
            <Box sx={{ py: 1 }}>
              <Box display="flex" gap={3} mb={1.5} flexWrap="wrap">
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.65rem" }}>Agent</Typography>
                  <Typography sx={{ fontSize: "0.8rem" }}>{recordingDeclaration.agent?.fullName || 'N/A'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.65rem" }}>Date</Typography>
                  <Typography sx={{ fontSize: "0.8rem" }}>{formatDate(recordingDeclaration.callDate)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.65rem" }}>Duration</Typography>
                  <Typography sx={{ fontSize: "0.8rem" }}>{formatDuration(recordingDeclaration.callDuration)}</Typography>
                </Box>
              </Box>
              {audioLoading ? (
                <Box display="flex" justifyContent="center" alignItems="center" py={2}>
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                  <Typography variant="body2" color="text.secondary">Loading...</Typography>
                </Box>
              ) : audioUrl ? (
                <audio controls src={audioUrl} style={{ width: '100%' }} />
              ) : (
                <Typography variant="body2" color="error">Failed to load recording</Typography>
              )}
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

// Inline recording player for expanded rows
const InlineRecordingPlayer = ({ recordFile }) => {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const urlRef = useRef(null);

  useEffect(() => {
    return () => {
      if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
    };
  }, []);

  const handleLoad = () => {
    if (loaded) return;
    setLoading(true);
    fetchRecordingBlob(recordFile)
      .then((blobUrl) => { urlRef.current = blobUrl; setUrl(blobUrl); setLoaded(true); })
      .catch((err) => console.error("Failed to load recording:", err))
      .finally(() => setLoading(false));
  };

  if (!loaded) {
    return (
      <Chip
        icon={loading ? <CircularProgress size={12} /> : <PlayIcon sx={{ fontSize: 14 }} />}
        label={loading ? "Loading..." : "Load Recording"}
        size="small"
        onClick={handleLoad}
        sx={{ cursor: "pointer", height: 22, fontSize: "0.7rem" }}
        variant="outlined"
        color="primary"
      />
    );
  }

  return url ? (
    <audio controls src={url} style={{ width: '100%', height: 28 }} />
  ) : (
    <Typography variant="caption" color="error">Failed to load</Typography>
  );
};

export default React.memo(CallDeclarationsTable);
