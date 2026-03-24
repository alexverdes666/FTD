import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  Button,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  TextField,
} from '@mui/material';
import {
  Add as AddIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import dayjs from 'dayjs';
import { selectUser } from '../store/slices/authSlice';
import {
  getAllAgentFines,
  getAgentFines,
  getDisputedFines,
  deleteAgentFine,
} from '../services/agentFines';
import api from '../services/api';
import toast from 'react-hot-toast';
import MonthYearSelector from '../components/common/MonthYearSelector';
import ApplyAgentFineDialog from '../components/ApplyAgentFineDialog';
import FineDetailDialog from '../components/FineDetailDialog';

const getStatusColor = (status) => {
  switch (status) {
    case 'pending_approval': return 'warning';
    case 'approved': return 'error';
    case 'disputed': return 'info';
    case 'admin_approved': return 'error';
    case 'admin_rejected': return 'success';
    case 'paid': return 'default';
    case 'waived': return 'default';
    default: return 'default';
  }
};

const getStatusLabel = (status) => {
  switch (status) {
    case 'pending_approval': return 'Pending';
    case 'approved': return 'Approved';
    case 'disputed': return 'Disputed';
    case 'admin_approved': return 'Final';
    case 'admin_rejected': return 'Dropped';
    case 'paid': return 'Paid';
    case 'waived': return 'Waived';
    default: return status;
  }
};

const getRoleLabel = (role) => {
  switch (role) {
    case 'admin': return 'Admin';
    case 'affiliate_manager': return 'AM';
    case 'agent': return 'Agent';
    case 'lead_manager': return 'Lead Mgr';
    case 'refunds_manager': return 'Refunds Mgr';
    case 'inventory_manager': return 'Inventory Mgr';
    default: return role;
  }
};

const FinesPage = () => {
  const user = useSelector(selectUser);
  const isAdmin = user?.role === 'admin';
  const isManagerOrAdmin = user?.role === 'admin' || user?.role === 'affiliate_manager';

  const [fines, setFines] = useState([]);
  const [disputedFines, setDisputedFines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [tabValue, setTabValue] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [statusFilter, setStatusFilter] = useState('all');
  const [userFilter, setUserFilter] = useState(null);
  const [imposedByFilter, setImposedByFilter] = useState(null);

  // Admin: apply fine dialog
  const [applyFineOpen, setApplyFineOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [allUsers, setAllUsers] = useState([]);

  // Fine detail dialog
  const [detailFine, setDetailFine] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchFines = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const month = selectedDate.month() + 1;
      const year = selectedDate.year();

      if (isManagerOrAdmin) {
        const data = await getAllAgentFines(year, month);
        setFines(data || []);
      } else {
        const data = await getAgentFines(user._id, true, year, month);
        setFines(data || []);
      }
    } catch (err) {
      console.error('Error fetching fines:', err);
      setError('Failed to load fines');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, isManagerOrAdmin, user?._id]);

  const fetchDisputedFines = useCallback(async () => {
    if (!isManagerOrAdmin) return;
    try {
      const data = await getDisputedFines();
      setDisputedFines(data || []);
    } catch (err) {
      console.error('Error fetching disputed fines:', err);
    }
  }, [isManagerOrAdmin]);

  const fetchUsers = useCallback(async () => {
    if (!isManagerOrAdmin) return;
    try {
      const response = await api.get('/users?isActive=true&limit=1000');
      if (response.data.success) {
        const users = (response.data.data || [])
          .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
        setAllUsers(users);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  }, [isManagerOrAdmin]);

  useEffect(() => {
    fetchFines();
    fetchDisputedFines();
  }, [fetchFines, fetchDisputedFines]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleDeleteFine = async (fineId) => {
    try {
      await deleteAgentFine(fineId);
      toast.success('Fine removed');
      fetchFines();
      fetchDisputedFines();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete fine');
    }
  };

  const handleFineUpdated = () => {
    fetchFines();
    fetchDisputedFines();
  };

  const handleApplyFineSuccess = () => {
    toast.success('Fine applied successfully');
    setSelectedUser(null);
    fetchFines();
  };

  // Derive unique "imposed by" users from current fines for the filter dropdown
  const imposedByUsers = isManagerOrAdmin
    ? [...new Map(fines.filter(f => f.imposedBy?._id).map(f => [f.imposedBy._id, f.imposedBy])).values()]
        .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''))
    : [];

  const filteredFines = fines.filter(fine => {
    if (statusFilter !== 'all' && fine.status !== statusFilter) return false;
    if (userFilter && fine.agent?._id !== userFilter._id) return false;
    if (imposedByFilter && fine.imposedBy?._id !== imposedByFilter._id) return false;
    return true;
  });

  const displayFines = tabValue === 1 ? disputedFines : filteredFines;

  return (
    <Box sx={{ p: 3 }}>
      {/* Admin controls */}
      {isManagerOrAdmin && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>Apply Fine to User</Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Autocomplete
              options={allUsers}
              getOptionLabel={(option) => `${option.fullName} (${getRoleLabel(option.role)})`}
              value={selectedUser}
              onChange={(_, newValue) => setSelectedUser(newValue)}
              renderInput={(params) => (
                <TextField {...params} label="Select User" size="small" />
              )}
              renderOption={(props, option) => (
                <li {...props} key={option._id}>
                  <Box>
                    <Typography variant="body2">{option.fullName}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {getRoleLabel(option.role)} - {option.email}
                    </Typography>
                  </Box>
                </li>
              )}
              sx={{ minWidth: 300 }}
              size="small"
            />
            <Button
              variant="contained"
              color="warning"
              startIcon={<AddIcon />}
              disabled={!selectedUser}
              onClick={() => setApplyFineOpen(true)}
            >
              Apply Fine
            </Button>
          </Box>
        </Paper>
      )}

      {/* Tabs for admin */}
      {isManagerOrAdmin && (
        <Paper sx={{ mb: 2 }}>
          <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
            <Tab label="All Fines" />
            <Tab
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  Disputed
                  {disputedFines.length > 0 && (
                    <Chip label={disputedFines.length} size="small" color="warning" sx={{ height: 20 }} />
                  )}
                </Box>
              }
            />
          </Tabs>
        </Paper>
      )}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <MonthYearSelector
            selectedDate={selectedDate}
            onDateChange={(d) => { setSelectedDate(d); setPage(0); }}
            showCurrentSelection={false}
            size="small"
          />
          {tabValue === 0 && (
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
                label="Status"
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="pending_approval">Pending</MenuItem>
                <MenuItem value="approved">Approved</MenuItem>
                <MenuItem value="disputed">Disputed</MenuItem>
                <MenuItem value="admin_approved">Final</MenuItem>
                <MenuItem value="admin_rejected">Dropped</MenuItem>
              </Select>
            </FormControl>
          )}
          {isManagerOrAdmin && tabValue === 0 && (
            <>
              <Autocomplete
                options={allUsers}
                getOptionLabel={(option) => `${option.fullName} (${getRoleLabel(option.role)})`}
                value={userFilter}
                onChange={(_, v) => { setUserFilter(v); setPage(0); }}
                renderInput={(params) => (
                  <TextField {...params} label="Fined User" size="small" />
                )}
                sx={{ minWidth: 220 }}
                size="small"
              />
              <Autocomplete
                options={imposedByUsers}
                getOptionLabel={(option) => option.fullName || ''}
                value={imposedByFilter}
                onChange={(_, v) => { setImposedByFilter(v); setPage(0); }}
                renderInput={(params) => (
                  <TextField {...params} label="Imposed By" size="small" />
                )}
                sx={{ minWidth: 200 }}
                size="small"
              />
            </>
          )}
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {isManagerOrAdmin && <TableCell>User</TableCell>}
                {isManagerOrAdmin && <TableCell>Role</TableCell>}
                <TableCell align="right">Amount</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell>Period</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Imposed By</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayFines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isManagerOrAdmin ? 9 : 7} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No fines found</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                displayFines
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((fine) => (
                    <TableRow
                      key={fine._id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => { setDetailFine(fine); setDetailOpen(true); }}
                    >
                      {isManagerOrAdmin && (
                        <TableCell>{fine.agent?.fullName || 'N/A'}</TableCell>
                      )}
                      {isManagerOrAdmin && (
                        <TableCell>
                          <Chip
                            label={getRoleLabel(fine.agent?.role)}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.7rem' }}
                          />
                        </TableCell>
                      )}
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                        ${Number(fine.amount).toFixed(2)}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {fine.reason}
                      </TableCell>
                      <TableCell>
                        {fine.fineMonth && fine.fineYear
                          ? `${String(fine.fineMonth).padStart(2, '0')}/${fine.fineYear}`
                          : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getStatusLabel(fine.status)}
                          color={getStatusColor(fine.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{fine.imposedBy?.fullName || 'N/A'}</TableCell>
                      <TableCell>
                        {fine.imposedDate
                          ? new Date(fine.imposedDate).toLocaleDateString()
                          : 'N/A'}
                      </TableCell>
                      <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                          <Button
                            size="small"
                            onClick={() => { setDetailFine(fine); setDetailOpen(true); }}
                          >
                            View
                          </Button>
                          {isAdmin && ['pending_approval', 'approved', 'admin_approved'].includes(fine.status) && (
                            <Button
                              size="small"
                              color="error"
                              onClick={() => handleDeleteFine(fine._id)}
                            >
                              Remove
                            </Button>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={displayFines.length}
            page={page}
            onPageChange={(e, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50]}
          />
        </TableContainer>
      )}

      {/* Apply Fine Dialog */}
      {selectedUser && (
        <ApplyAgentFineDialog
          open={applyFineOpen}
          onClose={() => { setApplyFineOpen(false); setSelectedUser(null); }}
          onSuccess={handleApplyFineSuccess}
          agent={selectedUser}
        />
      )}

      {/* Fine Detail Dialog */}
      <FineDetailDialog
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setDetailFine(null); }}
        fine={detailFine}
        onFineUpdated={handleFineUpdated}
      />
    </Box>
  );
};

export default FinesPage;
