import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  TextField,
  Grid,
  Pagination,
  InputAdornment,
  Tooltip,
  Divider,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Close,
  History,
  Search,
  Person,
  CalendarToday,
  ArrowForward,
  FilterList,
  Refresh,
} from '@mui/icons-material';
import api from '../services/api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const LeadGlobalAuditDialog = ({ open, onClose }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const limit = 20;

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', limit);
      if (search) params.append('search', search);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await api.get(`/leads/global-audit-logs?${params.toString()}`);
      const data = response.data.data;
      setAuditLogs(data.logs || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Error fetching global audit logs:', err);
      setError(err.response?.data?.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [page, search, startDate, endDate]);

  useEffect(() => {
    if (open) {
      fetchAuditLogs();
    }
  }, [open, fetchAuditLogs]);

  const handlePageChange = (event, value) => {
    setPage(value);
  };

  const handleSearchChange = (event) => {
    setSearch(event.target.value);
    setPage(1);
  };

  const handleStartDateChange = (event) => {
    setStartDate(event.target.value);
    setPage(1);
  };

  const handleEndDateChange = (event) => {
    setEndDate(event.target.value);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearch('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const handleRefresh = () => {
    fetchAuditLogs();
  };

  const formatDateTime = (date) => {
    if (!date) return 'N/A';
    return dayjs(date).format('DD.MM.YYYY HH:mm');
  };

  const getFieldColor = (fieldName) => {
    const colors = {
      firstName: 'primary',
      lastName: 'primary',
      newEmail: 'info',
      oldEmail: 'info',
      newPhone: 'secondary',
      oldPhone: 'secondary',
      country: 'success',
      status: 'warning',
      leadType: 'error',
      gender: 'default',
      dob: 'default',
      address: 'default',
      sin: 'error',
    };

    if (fieldName?.startsWith('socialMedia')) {
      return 'info';
    }

    return colors[fieldName] || 'default';
  };

  const renderAuditEntry = (log) => {
    return (
      <Paper
        key={log._id}
        variant="outlined"
        sx={{
          p: 2,
          mb: 2,
          borderLeft: 4,
          borderLeftColor: `${getFieldColor(log.fieldName)}.main`,
          transition: 'all 0.2s ease',
          '&:hover': {
            bgcolor: alpha(theme.palette.primary.main, 0.02),
            boxShadow: 1,
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              label={log.fieldLabel}
              color={getFieldColor(log.fieldName)}
              size="small"
              sx={{ fontWeight: 500 }}
            />
            <Typography variant="subtitle2" color="text.primary">
              {log.leadName}
            </Typography>
          </Box>
          <Tooltip title={formatDateTime(log.changedAt)}>
            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
              {dayjs(log.changedAt).fromNow()}
            </Typography>
          </Tooltip>
        </Box>

        <Box sx={{ mb: 1.5 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              flexWrap: 'wrap',
              p: 1.5,
              bgcolor: alpha(theme.palette.grey[500], 0.08),
              borderRadius: 1,
            }}
          >
            <Box
              sx={{
                flex: '1 1 auto',
                minWidth: 0,
                p: 1,
                bgcolor: alpha(theme.palette.error.main, 0.08),
                borderRadius: 0.5,
              }}
            >
              <Typography variant="caption" color="text.secondary" display="block">
                Previous
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  wordBreak: 'break-word',
                  color: log.previousValueDisplay ? 'text.primary' : 'text.disabled',
                  fontStyle: log.previousValueDisplay ? 'normal' : 'italic',
                }}
              >
                {log.previousValueDisplay || '(empty)'}
              </Typography>
            </Box>

            <ArrowForward color="action" sx={{ flexShrink: 0 }} />

            <Box
              sx={{
                flex: '1 1 auto',
                minWidth: 0,
                p: 1,
                bgcolor: alpha(theme.palette.success.main, 0.08),
                borderRadius: 0.5,
              }}
            >
              <Typography variant="caption" color="text.secondary" display="block">
                New
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  wordBreak: 'break-word',
                  color: log.newValueDisplay ? 'text.primary' : 'text.disabled',
                  fontStyle: log.newValueDisplay ? 'normal' : 'italic',
                }}
              >
                {log.newValueDisplay || '(empty)'}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Divider sx={{ my: 1 }} />

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Person fontSize="small" color="action" />
            <Typography variant="caption" color="text.secondary">
              Changed by: <strong>{log.changedByName}</strong>
            </Typography>
          </Box>
          {log.leadEmail && (
            <Typography variant="caption" color="text.secondary">
              Lead email: {log.leadEmail}
            </Typography>
          )}
        </Box>
      </Paper>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '70vh' }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <History color="primary" />
          <Typography variant="h6">Lead Changes Audit</Typography>
          {total > 0 && (
            <Chip
              label={`${total} changes`}
              size="small"
              color="primary"
              variant="outlined"
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh} size="small">
              <Refresh />
            </IconButton>
          </Tooltip>
          <Tooltip title="Toggle Filters">
            <IconButton onClick={() => setShowFilters(!showFilters)} size="small" color={showFilters ? 'primary' : 'default'}>
              <FilterList />
            </IconButton>
          </Tooltip>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {/* Search and Filters */}
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search by lead name, email, or user..."
            value={search}
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            sx={{ mb: showFilters ? 2 : 0 }}
          />

          {showFilters && (
            <Grid container spacing={2} sx={{ mt: 0 }}>
              <Grid item xs={12} sm={5}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="From Date"
                  value={startDate}
                  onChange={handleStartDateChange}
                  InputLabelProps={{ shrink: true }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <CalendarToday fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={5}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="To Date"
                  value={endDate}
                  onChange={handleEndDateChange}
                  InputLabelProps={{ shrink: true }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <CalendarToday fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={2}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={handleClearFilters}
                  sx={{ height: '40px' }}
                >
                  Clear
                </Button>
              </Grid>
            </Grid>
          )}
        </Box>

        {/* Content */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ my: 2 }}>
            {error}
          </Alert>
        ) : auditLogs.length === 0 ? (
          <Alert severity="info" sx={{ my: 2 }}>
            No audit logs found. Changes to lead data will appear here.
          </Alert>
        ) : (
          <Box>
            {auditLogs.map(renderAuditEntry)}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ justifyContent: 'space-between', px: 3, py: 2 }}>
        {totalPages > 1 && (
          <Pagination
            count={totalPages}
            page={page}
            onChange={handlePageChange}
            color="primary"
            size="small"
          />
        )}
        {totalPages <= 1 && <Box />}
        <Button onClick={onClose} variant="outlined">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LeadGlobalAuditDialog;
