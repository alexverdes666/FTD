import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  Stack,
  Alert
} from '@mui/material';
import {
  SimCard as SimCardIcon,
  Assignment as AssignmentIcon,
  FilterList as FilterIcon
} from '@mui/icons-material';
import { simCardService } from '../services/simCardService';
import { selectUser } from '../store/slices/authSlice';
import toast from 'react-hot-toast';
import axios from 'axios';

const backendAPI = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

backendAPI.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const NumberPage = () => {
  const user = useSelector(selectUser);
  const [simCards, setSimCards] = useState([]);
  const [ftdLeads, setFtdLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  // Selected items for assignment
  const [selectedLeads, setSelectedLeads] = useState([]);
  const [selectedSimCard, setSelectedSimCard] = useState(null);

  // Dialog state
  const [openAssignDialog, setOpenAssignDialog] = useState(false);

  // Filter states
  const [filters, setFilters] = useState({
    status: '',
    geo: '',
    operator: '',
    simNumber: '',
    hasAssignment: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchSimCards();
  }, [page, rowsPerPage, filters]);

  const fetchSimCards = async () => {
    try {
      setLoading(true);
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value && value !== '')
        )
      };

      const response = await simCardService.getSimCards(params);
      setSimCards(response.data);
      setTotalCount(response.pagination.total);
    } catch (error) {
      toast.error('Failed to fetch SIM cards');
      console.error('Error fetching SIM cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFtdLeads = async (simCardId = null) => {
    try {
      const params = {
        leadType: 'ftd',
        page: 1,
        limit: 1000
      };

      if (simCardId) {
        params.assignedSimCard = simCardId;
      }

      const response = await backendAPI.get('/leads', { params });
      return response.data.data;
    } catch (error) {
      toast.error('Failed to fetch FTD leads');
      console.error('Error fetching FTD leads:', error);
      return [];
    }
  };

  const handleOpenAssignDialog = async (simCard) => {
    setSelectedSimCard(simCard);
    setSelectedLeads([]);

    // Fetch FTD leads
    const leads = await fetchFtdLeads();
    setFtdLeads(leads);
    setOpenAssignDialog(true);
  };

  const handleCloseAssignDialog = () => {
    setOpenAssignDialog(false);
    setSelectedSimCard(null);
    setSelectedLeads([]);
    setFtdLeads([]);
  };

  const handleLeadSelection = (leadId) => {
    setSelectedLeads(prev => {
      if (prev.includes(leadId)) {
        return prev.filter(id => id !== leadId);
      } else {
        return [...prev, leadId];
      }
    });
  };

  const handleAssignSimCard = async () => {
    if (!selectedSimCard || selectedLeads.length === 0) {
      toast.error('Please select at least one lead');
      return;
    }

    try {
      const response = await backendAPI.post('/leads/assign-simcard', {
        leadIds: selectedLeads,
        simCardId: selectedSimCard._id
      });

      if (response.data.success) {
        const { success, reassigned, failed } = response.data.data;

        let message = `Successfully assigned ${success.length + reassigned.length} leads`;
        if (failed.length > 0) {
          message += `, ${failed.length} failed`;
        }

        toast.success(message);
        handleCloseAssignDialog();
        fetchSimCards();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to assign SIM card');
      console.error('Error assigning SIM card:', error);
    }
  };

  const handleUnassignSimCard = async (leadId) => {
    if (!window.confirm('Are you sure you want to unassign this SIM card from the lead?')) {
      return;
    }

    try {
      const response = await backendAPI.post('/leads/assign-simcard', {
        leadIds: [leadId],
        simCardId: null
      });

      if (response.data.success) {
        toast.success('SIM card unassigned successfully');
        fetchSimCards();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to unassign SIM card');
      console.error('Error unassigning SIM card:', error);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
    setPage(0);
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      geo: '',
      operator: '',
      simNumber: '',
      hasAssignment: ''
    });
    setPage(0);
  };

  const getStatusColor = (status) => {
    return status === 'active' ? 'success' : 'default';
  };

  return (
    <Box sx={{ width: "100%", typography: "body1" }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <SimCardIcon fontSize="large" />
          Number Assignment
        </Typography>
      </Box>

      {/* Info Alert */}
      <Alert severity="info" sx={{ mb: 3 }}>
        Assign SIM card numbers to FTD leads. Click "Assign to FTDs" to select leads for each SIM card.
      </Alert>

      {/* Filters */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button
          variant="outlined"
          startIcon={<FilterIcon />}
          onClick={() => setShowFilters(!showFilters)}
        >
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </Button>
      </Box>

      {showFilters && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={filters.status}
                    label="Status"
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="inactive">Inactive</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={2}>
                <TextField
                  fullWidth
                  size="small"
                  label="GEO"
                  value={filters.geo}
                  onChange={(e) => handleFilterChange('geo', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={2}>
                <TextField
                  fullWidth
                  size="small"
                  label="Operator"
                  value={filters.operator}
                  onChange={(e) => handleFilterChange('operator', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={2}>
                <TextField
                  fullWidth
                  size="small"
                  label="SIM Number"
                  value={filters.simNumber}
                  onChange={(e) => handleFilterChange('simNumber', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={2}>
                <Button variant="outlined" onClick={clearFilters} fullWidth>
                  Clear
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* SIM Cards Table */}
      <Card>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>SIM Number</TableCell>
                <TableCell>GEO</TableCell>
                <TableCell>Operator</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {simCards.map((simCard) => (
                <TableRow key={simCard._id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {simCard.simNumber}
                    </Typography>
                  </TableCell>
                  <TableCell>{simCard.geo}</TableCell>
                  <TableCell>{simCard.operator}</TableCell>
                  <TableCell>
                    <Chip
                      label={simCard.status}
                      color={getStatusColor(simCard.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<AssignmentIcon />}
                      onClick={() => handleOpenAssignDialog(simCard)}
                    >
                      Assign to FTDs
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={(event, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(parseInt(event.target.value, 10));
            setPage(0);
          }}
        />
      </Card>

      {/* Assignment Dialog */}
      <Dialog
        open={openAssignDialog}
        onClose={handleCloseAssignDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Assign SIM Card: {selectedSimCard?.simNumber}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Select FTD leads to assign this SIM card to:
          </Typography>

          <TableContainer sx={{ mt: 2, maxHeight: 400 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">Select</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Country</TableCell>
                  <TableCell>Current SIM</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {ftdLeads.map((lead) => (
                  <TableRow key={lead._id} hover>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedLeads.includes(lead._id)}
                        onChange={() => handleLeadSelection(lead._id)}
                      />
                    </TableCell>
                    <TableCell>{lead.firstName} {lead.lastName}</TableCell>
                    <TableCell>{lead.newEmail}</TableCell>
                    <TableCell>{lead.newPhone}</TableCell>
                    <TableCell>{lead.country}</TableCell>
                    <TableCell>
                      {lead.assignedSimCard ? (
                        <Chip
                          label={lead.assignedSimCard.simNumber || 'Assigned'}
                          size="small"
                          color="primary"
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          None
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {ftdLeads.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No FTD leads found
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Typography variant="body2" color="primary" sx={{ mt: 2 }}>
            {selectedLeads.length} lead(s) selected
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAssignDialog}>Cancel</Button>
          <Button
            onClick={handleAssignSimCard}
            variant="contained"
            disabled={selectedLeads.length === 0}
          >
            Assign to {selectedLeads.length} Lead(s)
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default NumberPage;
