import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  CircularProgress,
  Grid,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import MonthYearSelector from './common/MonthYearSelector';
import { 
  getAffiliateManagerTable,
  formatCurrency,
  sortTableData,
  calculateTotals,
  calculateRowTotalValue
} from '../services/affiliateManagerTable';
import { selectUser } from '../store/slices/authSlice';

const AffiliateManagerTableView = () => {
  const user = useSelector(selectUser);
  const [tableData, setTableData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [selectedPeriod, setSelectedPeriod] = useState('monthly');
  const [alert, setAlert] = useState({ show: false, message: '', severity: 'info' });

  useEffect(() => {
    if (user?.role === 'affiliate_manager') {
      loadTableData();
    }
  }, [user, selectedDate, selectedPeriod]);

  const showAlert = (message, severity = 'info') => {
    setAlert({ show: true, message, severity });
    setTimeout(() => setAlert({ show: false, message: '', severity: 'info' }), 5000);
  };

  const loadTableData = async () => {
    try {
      setLoading(true);
      const params = {
        period: selectedPeriod,
        date: selectedDate.format('YYYY-MM-DD'),
        month: selectedDate.month() + 1, // dayjs months are 0-indexed, so add 1
        year: selectedDate.year()
      };
      console.log('📅 Loading affiliate manager table with params:', params);
      const response = await getAffiliateManagerTable(user._id, params);
      setTableData(response.data);
    } catch (error) {
      console.error('Failed to load table data:', error);
      showAlert('Failed to load your table data', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (user?.role !== 'affiliate_manager') {
    return (
      <Alert severity="info">
        This table is only available for affiliate managers.
      </Alert>
    );
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (!tableData) {
    return (
      <Alert severity="error">
        Failed to load your table data. Please try again or contact support.
      </Alert>
    );
  }

  const sortedData = sortTableData(tableData.tableData);
  const totals = calculateTotals(sortedData);
  const hyperNetValue = tableData.tableData.find(row => row.id === 'hyper_net')?.value || 0;

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ p: 3, backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
        {alert.show && (
          <Alert severity={alert.severity} sx={{ mb: 2 }}>
            {alert.message}
          </Alert>
        )}

        {/* Header */}
        <Box mb={3}>
          <Typography variant="h4" component="h1" sx={{ color: '#333' }}>
            My Performance Table
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Last updated: {new Date(tableData.updatedAt).toLocaleString()}
          </Typography>
        </Box>

        {/* Filters */}
        <Card sx={{ mb: 3, boxShadow: 1 }}>
          <CardContent>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Period</InputLabel>
                  <Select
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                    label="Period"
                  >
                    <MenuItem value="daily">Daily</MenuItem>
                    <MenuItem value="weekly">Weekly</MenuItem>
                    <MenuItem value="monthly">Monthly</MenuItem>
                    <MenuItem value="yearly">Yearly</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <MonthYearSelector
                  selectedDate={selectedDate}
                  onDateChange={setSelectedDate}
                  showCurrentSelection={false}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="body2" color="text.secondary">
                  Showing {selectedPeriod} data for {selectedDate.format('MMMM YYYY')}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Summary */}
        <Card sx={{ mb: 3, boxShadow: 1 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ color: '#333' }}>
              Summary
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={3}>
              <Grid item xs={6} md={2}>
                <Box textAlign="center">
                  <Typography variant="h6" color="text.primary">
                    {formatCurrency(tableData.totalMoney || 0)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Money
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} md={2}>
                <Box textAlign="center">
                  <Typography variant="h6" color="text.primary">
                    {formatCurrency(totals.total)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Expenses
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={6} md={2}>
                <Box textAlign="center">
                  <Typography variant="h6" color="text.primary">
                    {formatCurrency(tableData.calculatedTotals.profit)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Profit
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} md={2}>
                <Box textAlign="center" sx={{ 
                  backgroundColor: '#e8f5e8', 
                  borderRadius: 1, 
                  p: 2,
                  border: '2px solid #4caf50'
                }}>
                  <Typography variant="h6" sx={{ color: '#2e7d32', fontWeight: 'bold' }}>
                    {formatCurrency(tableData.calculatedTotals.profit * 0.1)}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#2e7d32', fontWeight: 'medium' }}>
                    My Commission (10%)
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Table Data */}
        <Card sx={{ boxShadow: 1 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ color: '#333' }}>
              Performance Details ({sortedData.length} items)
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <TableContainer component={Paper} sx={{ boxShadow: 0 }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#f8f9fa' }}>
                    <TableCell><strong>Category</strong></TableCell>
                    <TableCell><strong>Description</strong></TableCell>
                    <TableCell align="right"><strong>Unit Value</strong></TableCell>
                    <TableCell align="right"><strong>Quantity</strong></TableCell>
                    <TableCell align="center"><strong>Type</strong></TableCell>
                    <TableCell align="right"><strong>Total Amount</strong></TableCell>
                    <TableCell><strong>Currency</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedData.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                          {row.category.replace('_', ' ')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {row.label}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {formatCurrency(row.value, row.currency)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {row.quantity || 1}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" sx={{ 
                          textTransform: 'capitalize',
                          color: (row.calculationType || 'quantity') === 'percentage' ? '#d32f2f' : '#1976d2',
                          fontWeight: 'medium'
                        }}>
                          {(row.calculationType || 'quantity') === 'percentage' ? '%' : 'Qty'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="bold" sx={{ backgroundColor: '#f0f8ff', px: 1, py: 0.5, borderRadius: 1 }}>
                          {formatCurrency(calculateRowTotalValue(row), row.currency)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {row.currency}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        {/* Footer Note */}
        <Card sx={{ mt: 3, boxShadow: 1 }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              This table shows your performance metrics. Values are updated by administrators. 
              If you have questions about any entries, please contact your administrator.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </LocalizationProvider>
  );
};

export default AffiliateManagerTableView; 