import React, { useState, useEffect } from 'react';
import { SectionSkeleton } from '../components/common/TableSkeleton.jsx';
import { useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Stack,
  Divider
} from '@mui/material';
import {
  Edit as EditIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import MonthYearSelector from '../components/common/MonthYearSelector';
import { selectUser } from '../store/slices/authSlice';
import { 
  getAllAffiliateManagerTables,
  formatCurrency
} from '../services/affiliateManagerTable';
import AffiliateManagerTableEditor from '../components/AffiliateManagerTableEditor';

const AffiliateManagerTablesPage = () => {
  const user = useSelector(selectUser);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [selectedPeriod, setSelectedPeriod] = useState('monthly');
  const [selectedManager, setSelectedManager] = useState(null);
  const [showTableEditor, setShowTableEditor] = useState(false);
  const [alert, setAlert] = useState({ show: false, message: '', severity: 'info' });

  useEffect(() => {
    if (user?.role === 'admin') {
      loadTables();
    }
  }, [user, selectedDate, selectedPeriod]);

  const showAlert = (message, severity = 'info') => {
    setAlert({ show: true, message, severity });
    setTimeout(() => setAlert({ show: false, message: '', severity: 'info' }), 3000);
  };

  const loadTables = async () => {
    try {
      setLoading(true);
      const params = {
        page: 1,
        limit: 100,
        period: selectedPeriod,
        date: selectedDate.format('YYYY-MM-DD'),
        month: selectedDate.month() + 1, // dayjs months are 0-indexed, so add 1
        year: selectedDate.year()
      };
      
      console.log('📅 Loading affiliate manager tables with params:', params);
      const response = await getAllAffiliateManagerTables(params);
      setTables(response.data || []);
    } catch (error) {
      console.error('Failed to load tables:', error);
      showAlert('Failed to load tables', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadTables();
    showAlert('Data refreshed', 'success');
  };

  const handleEditTable = (manager) => {
    setSelectedManager(manager);
    setShowTableEditor(true);
  };

  const handleCloseEditor = () => {
    setShowTableEditor(false);
    setSelectedManager(null);
    loadTables();
  };

  if (user?.role !== 'admin') {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Access denied. Only admins can manage affiliate manager tables.
        </Alert>
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ p: 3, backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
        {alert.show && (
          <Alert severity={alert.severity} sx={{ mb: 2 }}>
            {alert.message}
          </Alert>
        )}

        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" component="h1" sx={{ color: '#333' }}>
            Affiliate Manager Tables
          </Typography>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={loading}
            sx={{ color: '#666', borderColor: '#666' }}
          >
            Refresh
          </Button>
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

        {/* Tables List */}
        <Card sx={{ boxShadow: 1 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ color: '#333' }}>
              Affiliate Managers ({tables.length})
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            {loading ? (
              <SectionSkeleton rows={6} />
            ) : (
              <TableContainer component={Paper} sx={{ boxShadow: 0 }}>
                <Table>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#f8f9fa' }}>
                      <TableCell>Affiliate Manager</TableCell>
                      <TableCell>Period</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell align="right">Items</TableCell>
                      <TableCell align="right">Profit</TableCell>
                      <TableCell align="right">Hyper Net</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tables.map((table) => (
                      <TableRow key={table._id} hover>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={2}>
                            <PersonIcon sx={{ color: '#666' }} />
                            <Box>
                              <Typography variant="body2" fontWeight="medium">
                                {table.affiliateManager.fullName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {table.affiliateManager.email}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                            {table.period}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {new Date(table.date).toLocaleDateString()}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">
                            {table.tableData.length}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            sx={{ 
                              color: table.calculatedTotals.profit >= 0 ? '#2e7d32' : '#d32f2f',
                              fontWeight: 'medium'
                            }}
                          >
                            {formatCurrency(table.calculatedTotals.profit)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ color: '#1976d2', fontWeight: 'medium' }}>
                            {formatCurrency(
                              table.tableData.find(row => row.id === 'hyper_net')?.value || 0
                            )}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<EditIcon />}
                            onClick={() => handleEditTable(table.affiliateManager)}
                            sx={{ 
                              color: '#1976d2',
                              borderColor: '#1976d2',
                              '&:hover': {
                                backgroundColor: '#e3f2fd'
                              }
                            }}
                          >
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>

        {/* Table Editor Dialog */}
        <Dialog
          open={showTableEditor}
          onClose={handleCloseEditor}
          maxWidth="lg"
          fullWidth
          fullScreen
        >
          <DialogTitle>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Typography variant="h6">
                Edit Table: {selectedManager?.fullName}
              </Typography>
              <IconButton onClick={handleCloseEditor} color="inherit">
                <CloseIcon />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent>
            {selectedManager && (
              <AffiliateManagerTableEditor
                affiliateManager={selectedManager}
                onClose={handleCloseEditor}
              />
            )}
          </DialogContent>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default AffiliateManagerTablesPage; 