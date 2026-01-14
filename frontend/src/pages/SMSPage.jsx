import React, { useState, useEffect, useCallback } from 'react';
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
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Button,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Sms as SmsIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  CloudDownload as FetchIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { smsService } from '../services/smsService';
import { simCardService } from '../services/simCardService';
import gatewayDeviceService from '../services/gatewayDeviceService';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const SMSPage = () => {
  const [smsMessages, setSmsMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalCount, setTotalCount] = useState(0);

  // SIM cards for filter dropdown
  const [simCards, setSimCards] = useState([]);

  // Gateway fetch dialog state
  const [gateways, setGateways] = useState([]);
  const [fetchDialogOpen, setFetchDialogOpen] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState('');
  const [fetching, setFetching] = useState(false);

  // Filter states
  const [filters, setFilters] = useState({
    phone: '',
    simCard: '',
    dateFrom: null,
    dateTo: null
  });
  const [showFilters, setShowFilters] = useState(true);

  // Fetch SIM cards for filter dropdown
  useEffect(() => {
    const fetchSimCards = async () => {
      try {
        const response = await simCardService.getSimCards({ limit: 1000 });
        setSimCards(response.data || []);
      } catch (error) {
        console.error('Error fetching SIM cards:', error);
      }
    };
    fetchSimCards();
  }, []);

  // Fetch gateways for fetch dialog
  useEffect(() => {
    const fetchGateways = async () => {
      try {
        const response = await gatewayDeviceService.getGatewayDevices();
        setGateways(response.data || []);
      } catch (error) {
        console.error('Error fetching gateways:', error);
      }
    };
    fetchGateways();
  }, []);

  const fetchSMSMessages = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: page + 1,
        limit: rowsPerPage,
      };

      // Add filters
      if (filters.phone) params.phone = filters.phone;
      if (filters.simCard) params.simCard = filters.simCard;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom.toISOString();
      if (filters.dateTo) params.dateTo = filters.dateTo.toISOString();

      const response = await smsService.getSMSMessages(params);
      setSmsMessages(response.data || []);
      setTotalCount(response.pagination?.total || 0);
    } catch (error) {
      toast.error('Failed to fetch SMS messages');
      console.error('Error fetching SMS messages:', error);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, filters]);

  useEffect(() => {
    fetchSMSMessages();
  }, [fetchSMSMessages]);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(0);
  };

  const clearFilters = () => {
    setFilters({
      phone: '',
      simCard: '',
      dateFrom: null,
      dateTo: null
    });
    setPage(0);
  };

  const handleFetchFromGateway = async () => {
    if (!selectedGateway) {
      toast.error('Please select a gateway');
      return;
    }

    try {
      setFetching(true);
      const response = await smsService.fetchFromGateway(selectedGateway);
      if (response.success) {
        toast.success(response.message);
        setFetchDialogOpen(false);
        setSelectedGateway('');
        fetchSMSMessages(); // Refresh the list
      } else {
        toast.error(response.message || 'Failed to fetch SMS from gateway');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to fetch SMS from gateway');
    } finally {
      setFetching(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '-';
    try {
      return format(new Date(timestamp), 'MMM dd, yyyy HH:mm:ss');
    } catch {
      return '-';
    }
  };

  const truncateContent = (content, maxLength = 50) => {
    if (!content) return '-';
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ width: "100%", typography: "body1" }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1" sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <SmsIcon fontSize="large" />
            SMS Messages
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              startIcon={<FetchIcon />}
              onClick={() => setFetchDialogOpen(true)}
              disabled={gateways.length === 0}
            >
              Fetch from Gateway
            </Button>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchSMSMessages}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button
              variant="outlined"
              startIcon={<FilterIcon />}
              onClick={() => setShowFilters(!showFilters)}
            >
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </Button>
          </Box>
        </Box>

        {/* Filters Section */}
        {showFilters && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Phone Number"
                    placeholder="Search sender or recipient"
                    value={filters.phone}
                    onChange={(e) => handleFilterChange('phone', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>SIM Card</InputLabel>
                    <Select
                      value={filters.simCard}
                      label="SIM Card"
                      onChange={(e) => handleFilterChange('simCard', e.target.value)}
                    >
                      <MenuItem value="">All</MenuItem>
                      {simCards.map((sim) => (
                        <MenuItem key={sim._id} value={sim._id}>
                          {sim.simNumber} ({sim.geo})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={2}>
                  <DatePicker
                    label="Date From"
                    value={filters.dateFrom}
                    onChange={(value) => handleFilterChange('dateFrom', value)}
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <DatePicker
                    label="Date To"
                    value={filters.dateTo}
                    onChange={(value) => handleFilterChange('dateTo', value)}
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <Button variant="outlined" onClick={clearFilters} fullWidth>
                    Clear Filters
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        )}

        {/* SMS Messages Table */}
        <Card>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date/Time</TableCell>
                  <TableCell>Sender</TableCell>
                  <TableCell>Recipient</TableCell>
                  <TableCell>Content</TableCell>
                  <TableCell>Port</TableCell>
                  <TableCell>SIM Card</TableCell>
                  <TableCell>Delivery Report</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <CircularProgress size={40} />
                      <Typography variant="body2" sx={{ mt: 2 }}>
                        Loading SMS messages...
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : smsMessages.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        No SMS messages found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  smsMessages.map((sms) => (
                    <TableRow key={sms._id} hover>
                      <TableCell>
                        <Typography variant="body2">
                          {formatTimestamp(sms.timestamp)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {sms.sender || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {sms.recipient || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={sms.content || ''} placement="top">
                          <Typography variant="body2" sx={{ maxWidth: 300 }}>
                            {truncateContent(sms.content, 50)}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {sms.port || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {sms.simCard ? `${sms.simCard.simNumber} (${sms.simCard.geo})` : '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {sms.deliveryReport || '-'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))
                )}
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
            rowsPerPageOptions={[10, 25, 50, 100]}
          />
        </Card>

        {/* Fetch from Gateway Dialog */}
        <Dialog
          open={fetchDialogOpen}
          onClose={() => !fetching && setFetchDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Fetch SMS from Gateway</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Select a gateway device to fetch received SMS messages from.
            </Typography>
            <FormControl fullWidth sx={{ mt: 1 }}>
              <InputLabel>Gateway Device</InputLabel>
              <Select
                value={selectedGateway}
                label="Gateway Device"
                onChange={(e) => setSelectedGateway(e.target.value)}
                disabled={fetching}
              >
                {gateways.map((gateway) => (
                  <MenuItem key={gateway._id} value={gateway._id}>
                    {gateway.name} ({gateway.host}:{gateway.port})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setFetchDialogOpen(false)} disabled={fetching}>
              Cancel
            </Button>
            <Button
              onClick={handleFetchFromGateway}
              variant="contained"
              disabled={fetching || !selectedGateway}
              startIcon={fetching ? <CircularProgress size={20} /> : <FetchIcon />}
            >
              {fetching ? 'Fetching...' : 'Fetch SMS'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default SMSPage;
