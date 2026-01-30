import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
} from "@mui/material";
import {
  Close,
  History,
  Add,
  Edit,
  Delete,
  LockOpen as LockOpenIcon,
} from "@mui/icons-material";
import { leadProfileService } from "../services/leadProfileService";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

const getActionColor = (action) => {
  if (action.includes("CREATED")) return "success";
  if (action.includes("DELETED")) return "error";
  return "primary";
};

const getActionIcon = (action) => {
  if (action.includes("CREATED")) return <Add fontSize="small" />;
  if (action.includes("DELETED")) return <Delete fontSize="small" />;
  return <Edit fontSize="small" />;
};

const formatValue = (value) => {
  if (value === null || value === undefined) return "(empty)";
  if (typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
  }
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "string" && value.startsWith("ENC:")) {
    return "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
  }
  return String(value);
};

const ProfileAuditHistoryDialog = ({ open, onClose, leadId, unlockToken }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pages: 1,
    total: 0,
  });
  const [showSensitive, setShowSensitive] = useState(false);
  const [sensitiveLogs, setSensitiveLogs] = useState([]);
  const [loadingSensitive, setLoadingSensitive] = useState(false);

  const fetchLogs = useCallback(
    async (page = 1) => {
      if (!leadId) return;
      setLoading(true);
      setError(null);
      try {
        const result = await leadProfileService.getProfileAuditLogs(leadId, {
          page,
          limit: 20,
        });
        if (result.success) {
          setLogs(result.data);
          setPagination(result.pagination);
        }
      } catch (err) {
        setError(err.message || "Failed to load audit logs");
      } finally {
        setLoading(false);
      }
    },
    [leadId]
  );

  const fetchSensitiveLogs = useCallback(async () => {
    if (!leadId || !unlockToken) return;
    setLoadingSensitive(true);
    try {
      const result = await leadProfileService.getProfileAuditLogsSensitive(
        leadId,
        unlockToken,
        { page: pagination.current, limit: 20 }
      );
      if (result.success) {
        setSensitiveLogs(result.data);
        setShowSensitive(true);
      }
    } catch (err) {
      setError(err.message || "Failed to load sensitive audit data");
    } finally {
      setLoadingSensitive(false);
    }
  }, [leadId, unlockToken, pagination.current]);

  useEffect(() => {
    if (open) {
      fetchLogs();
      setShowSensitive(false);
      setSensitiveLogs([]);
    }
  }, [open, fetchLogs]);

  const displayLogs = showSensitive ? sensitiveLogs : logs;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
        >
          <Box display="flex" alignItems="center" gap={1}>
            <History />
            <Typography variant="h6">Profile Credential History</Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers sx={{ minHeight: 300, maxHeight: "70vh" }}>
        {/* Unlock sensitive values button */}
        {unlockToken && !showSensitive && (
          <Box sx={{ mb: 2 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={
                loadingSensitive ? (
                  <CircularProgress size={16} />
                ) : (
                  <LockOpenIcon />
                )
              }
              onClick={fetchSensitiveLogs}
              disabled={loadingSensitive}
            >
              Show Sensitive Values
            </Button>
          </Box>
        )}
        {showSensitive && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Sensitive values are visible. They will be hidden when you close
            this dialog.
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : displayLogs.length === 0 ? (
          <Alert severity="info">No audit history found.</Alert>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Profile</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Previous</TableCell>
                  <TableCell>New</TableCell>
                  <TableCell>By</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {displayLogs.map((log) => (
                  <TableRow key={log._id}>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      <Tooltip
                        title={dayjs(log.createdAt).format(
                          "MMM D, YYYY HH:mm:ss"
                        )}
                      >
                        <Typography variant="caption">
                          {dayjs(log.createdAt).fromNow()}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={log.actionLabel || log.action}
                        size="small"
                        color={getActionColor(log.action)}
                        variant="outlined"
                        icon={getActionIcon(log.action)}
                        sx={{ fontSize: "0.65rem" }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {log.accountType}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {log.description}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="caption"
                        sx={{
                          fontFamily: "monospace",
                          fontSize: "0.7rem",
                          wordBreak: "break-all",
                          maxWidth: 150,
                          display: "block",
                        }}
                      >
                        {formatValue(log.previousValue)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="caption"
                        sx={{
                          fontFamily: "monospace",
                          fontSize: "0.7rem",
                          wordBreak: "break-all",
                          maxWidth: 150,
                          display: "block",
                        }}
                      >
                        {formatValue(log.newValue)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {log.performedBy?.fullName ||
                          log.metadata?.userFullName ||
                          "Unknown"}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <Box display="flex" justifyContent="center" mt={2}>
            <Pagination
              count={pagination.pages}
              page={pagination.current}
              onChange={(e, page) => {
                fetchLogs(page);
                if (showSensitive) {
                  setShowSensitive(false);
                  setSensitiveLogs([]);
                }
              }}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProfileAuditHistoryDialog;
