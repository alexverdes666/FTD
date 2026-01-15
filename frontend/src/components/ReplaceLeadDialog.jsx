import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Alert,
  CircularProgress,
  Chip,
  Stack,
  TablePagination,
  InputAdornment,
} from '@mui/material';
import {
  SwapHoriz as SwapIcon,
  Search as SearchIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import api from '../services/api';

const ReplaceLeadDialog = ({
  open,
  onClose,
  order,
  lead,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [availableLeads, setAvailableLeads] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [pagination, setPagination] = useState({
    page: 0,
    rowsPerPage: 10,
    total: 0,
    totalPages: 0,
  });
  const [context, setContext] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch available leads when dialog opens or search/pagination changes
  const fetchAvailableLeads = useCallback(async () => {
    if (!open || !order?._id || !lead?._id) return;

    try {
      setLoading(true);
      setError(null);

      const response = await api.get(
        `/orders/${order._id}/leads/${lead._id}/available-replacements`,
        {
          params: {
            search: debouncedSearch || undefined,
            page: pagination.page + 1, // API uses 1-indexed pages
            limit: pagination.rowsPerPage,
          },
        }
      );

      setAvailableLeads(response.data.data || []);
      setContext(response.data.context || null);
      setPagination((prev) => ({
        ...prev,
        total: response.data.pagination?.total || 0,
        totalPages: response.data.pagination?.totalPages || 0,
      }));
    } catch (err) {
      console.error('Failed to fetch available leads:', err);
      setError(err.response?.data?.message || 'Failed to load available leads');
      setAvailableLeads([]);
    } finally {
      setLoading(false);
    }
  }, [open, order?._id, lead?._id, debouncedSearch, pagination.page, pagination.rowsPerPage]);

  useEffect(() => {
    fetchAvailableLeads();
  }, [fetchAvailableLeads]);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setSearchQuery('');
      setDebouncedSearch('');
      setSelectedLead(null);
      setPagination((prev) => ({ ...prev, page: 0 }));
      setError(null);
      setSuccess(null);
    }
  }, [open]);

  // Handle lead selection
  const handleSelectLead = useCallback((selectedLeadItem) => {
    setSelectedLead(selectedLeadItem);
    setError(null);
  }, []);

  // Handle replacement
  const handleReplaceLead = useCallback(async () => {
    if (!selectedLead) {
      setError('Please select a lead to replace with');
      return;
    }

    try {
      setReplacing(true);
      setError(null);

      const response = await api.post(
        `/orders/${order._id}/leads/${lead._id}/replace`,
        { newLeadId: selectedLead._id }
      );

      setSuccess('Lead successfully replaced!');

      // Call onSuccess callback after a short delay
      setTimeout(() => {
        if (onSuccess) {
          onSuccess(response.data.data);
        }
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Failed to replace lead:', err);
      setError(err.response?.data?.message || 'Failed to replace lead');
    } finally {
      setReplacing(false);
    }
  }, [selectedLead, order?._id, lead?._id, onSuccess, onClose]);

  // Handle pagination change
  const handleChangePage = useCallback((event, newPage) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
    setSelectedLead(null);
  }, []);

  const handleChangeRowsPerPage = useCallback((event) => {
    setPagination((prev) => ({
      ...prev,
      rowsPerPage: parseInt(event.target.value, 10),
      page: 0,
    }));
    setSelectedLead(null);
  }, []);

  // Handle close
  const handleClose = useCallback(() => {
    if (!replacing) {
      onClose();
    }
  }, [replacing, onClose]);

  // Get lead type label
  const leadTypeLabel = useMemo(() => {
    if (!context?.orderedAs) return 'Lead';
    switch (context.orderedAs) {
      case 'ftd':
        return 'FTD';
      case 'filler':
        return 'Filler';
      case 'cold':
        return 'Cold';
      default:
        return 'Lead';
    }
  }, [context?.orderedAs]);

  // Get lead type color
  const getLeadTypeColor = useCallback((type) => {
    switch (type) {
      case 'ftd':
        return 'success';
      case 'filler':
        return 'warning';
      case 'cold':
        return 'info';
      default:
        return 'default';
    }
  }, []);

  if (!order || !lead) return null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '60vh' },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SwapIcon color="primary" />
            <Typography variant="h6">Replace {leadTypeLabel} Lead</Typography>
          </Box>
          <IconButton onClick={handleClose} disabled={replacing} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        {/* Current Lead Information */}
        <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="subtitle1" gutterBottom fontWeight="medium">
            Current Lead to Replace
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip
              icon={<PersonIcon />}
              label={`${lead.firstName} ${lead.lastName}`}
              color="primary"
              variant="outlined"
              size="small"
            />
            <Chip
              icon={<EmailIcon />}
              label={lead.newEmail}
              variant="outlined"
              size="small"
            />
            <Chip
              icon={<PhoneIcon />}
              label={lead.newPhone}
              variant="outlined"
              size="small"
            />
            {context?.orderedAs && (
              <Chip
                label={leadTypeLabel}
                color={getLeadTypeColor(context.orderedAs)}
                size="small"
              />
            )}
          </Stack>
        </Box>

        {/* Filter Info */}
        {context && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Showing {leadTypeLabel} leads from <strong>{context.countryFilter}</strong>
          </Alert>
        )}

        {/* Search Input */}
        <TextField
          fullWidth
          placeholder="Search by name, email, or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          }}
          size="small"
        />

        {/* Available Leads Table */}
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Agent</TableCell>
                <TableCell>Type</TableCell>
                <TableCell align="center">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={32} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Loading available leads...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : availableLeads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      {debouncedSearch
                        ? 'No leads found matching your search'
                        : 'No available leads found'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                availableLeads.map((availableLead) => {
                  const isSelected = selectedLead?._id === availableLead._id;
                  return (
                    <TableRow
                      key={availableLead._id}
                      hover
                      selected={isSelected}
                      sx={{
                        cursor: 'pointer',
                        bgcolor: isSelected ? 'primary.lighter' : undefined,
                        '&:hover': {
                          bgcolor: isSelected ? 'primary.lighter' : undefined,
                        },
                      }}
                      onClick={() => handleSelectLead(availableLead)}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight={isSelected ? 'medium' : 'regular'}>
                          {availableLead.firstName} {availableLead.lastName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {availableLead.newEmail}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {availableLead.newPhone}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {availableLead.assignedAgent ? (
                          <Chip
                            label={
                              availableLead.assignedAgent.fullName ||
                              availableLead.assignedAgent.email ||
                              'Assigned'
                            }
                            size="small"
                            variant="outlined"
                            color="info"
                          />
                        ) : (
                          <Chip label="Unassigned" size="small" variant="outlined" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={availableLead.leadType?.toUpperCase() || 'N/A'}
                          size="small"
                          color={getLeadTypeColor(availableLead.leadType)}
                        />
                      </TableCell>
                      <TableCell align="center">
                        {isSelected ? (
                          <CheckCircleIcon color="primary" />
                        ) : (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectLead(availableLead);
                            }}
                          >
                            Select
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={pagination.total}
            page={pagination.page}
            onPageChange={handleChangePage}
            rowsPerPage={pagination.rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 20, 50]}
          />
        </TableContainer>

        {/* Selected Lead Preview */}
        {selectedLead && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'success.lighter', borderRadius: 1, border: '1px solid', borderColor: 'success.light' }}>
            <Typography variant="subtitle2" gutterBottom color="success.dark">
              Selected Replacement Lead
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip
                icon={<PersonIcon />}
                label={`${selectedLead.firstName} ${selectedLead.lastName}`}
                color="success"
                size="small"
              />
              <Chip
                icon={<EmailIcon />}
                label={selectedLead.newEmail}
                color="success"
                variant="outlined"
                size="small"
              />
              <Chip
                icon={<PhoneIcon />}
                label={selectedLead.newPhone}
                color="success"
                variant="outlined"
                size="small"
              />
            </Stack>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={replacing}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleReplaceLead}
          disabled={!selectedLead || replacing || loading}
          startIcon={replacing ? <CircularProgress size={20} /> : <SwapIcon />}
        >
          {replacing ? 'Replacing...' : 'Replace Lead'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReplaceLeadDialog;
