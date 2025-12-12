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
  TextField,
  Button,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Divider,
  Grid,
  Tooltip
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  Info as InfoIcon,
  CalendarToday as CalendarIcon
} from '@mui/icons-material';
import {
  getAffiliateManagerTable,
  updateTableRow,
  refreshTotalMoneyFromCrypto,
  deleteTableRow,
  resetTableToDefault,
  addTableRow,
  formatCurrency,
  calculateTotals,
  calculateRowTotalValue
} from '../services/affiliateManagerTable';
import { selectUser } from '../store/slices/authSlice';

const AffiliateManagerTableEditor = ({
  affiliateManager,
  onClose,
  selectedMonth = new Date().getMonth() + 1,
  selectedYear = new Date().getFullYear(),
  commissionPeriod = 'monthly'
}) => {
  const user = useSelector(selectUser);
  const [tableData, setTableData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingRowId, setSavingRowId] = useState(null);
  const [editingRow, setEditingRow] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [alert, setAlert] = useState({ show: false, message: '', severity: 'info' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRowData, setNewRowData] = useState({
    label: '',
    value: 0,
    quantity: 1,
    calculationType: 'quantity',
    currency: 'USD',
    category: 'services'
  });

  // Helper function to format month/year display
  const getMonthYearDisplay = () => {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${monthNames[selectedMonth - 1]} ${selectedYear}`;
  };

  useEffect(() => {
    if (affiliateManager) {
      loadTableData();
    }
  }, [affiliateManager, selectedMonth, selectedYear, commissionPeriod]);

  const showAlert = (message, severity = 'info') => {
    setAlert({ show: true, message, severity });
    setTimeout(() => setAlert({ show: false, message: '', severity: 'info' }), 3000);
  };

  const loadTableData = async () => {
    try {
      setLoading(true);
      const params = {
        period: commissionPeriod,
        month: selectedMonth,
        year: selectedYear
      };
      const response = await getAffiliateManagerTable(affiliateManager._id, params);
      setTableData(response.data);
    } catch (error) {
      console.error('Error loading table data:', error);
      showAlert('Failed to load table data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditRow = (row) => {
    setEditingRow(row.id);
    setEditValues({
      label: row.label,
      value: row.value,
      quantity: row.quantity || 1,
      calculationType: row.calculationType || 'quantity',
      currency: row.currency
    });
  };

  const handleSaveRow = async (rowId) => {
    try {
      setSavingRowId(rowId);
      const response = await updateTableRow(affiliateManager._id, rowId, editValues);

      // Update local state instead of reloading all data
      setTableData(prevData => ({
        ...prevData,
        tableData: response.data.tableData, // Use the complete updated table data
        calculatedTotals: response.data.calculatedTotals,
        lastUpdatedBy: response.data.lastUpdatedBy,
        updatedAt: response.data.updatedAt
      }));

      setEditingRow(null);
      setEditValues({});
      showAlert('Row updated successfully', 'success');
    } catch (error) {
      console.error('Error updating row:', error);
      showAlert('Failed to update row', 'error');
    } finally {
      setSavingRowId(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingRow(null);
    setEditValues({});
  };

  const handleRefreshTotalMoney = async () => {
    try {
      setSaving(true);
      const params = {
        period: commissionPeriod,
        month: selectedMonth,
        year: selectedYear
      };
      const response = await refreshTotalMoneyFromCrypto(affiliateManager._id, params);

      // Update local state instead of reloading all data
      setTableData(prevData => ({
        ...prevData,
        totalMoney: response.data.totalMoney,
        calculatedTotals: response.data.calculatedTotals,
        lastUpdatedBy: response.data.lastUpdatedBy,
        updatedAt: response.data.updatedAt
      }));

      showAlert(response.message || 'Total money refreshed successfully from crypto wallet values', 'success');
    } catch (error) {
      console.error('Error refreshing total money from crypto:', error);
      showAlert('Failed to refresh total money from crypto wallet values', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRow = async (rowId) => {
    if (!window.confirm('Are you sure you want to delete this row?')) return;

    try {
      setSavingRowId(rowId);
      const response = await deleteTableRow(affiliateManager._id, rowId);

      // Update local state instead of reloading all data
      setTableData(prevData => ({
        ...prevData,
        tableData: response.data.tableData, // Use the complete updated table data
        calculatedTotals: response.data.calculatedTotals,
        lastUpdatedBy: response.data.lastUpdatedBy,
        updatedAt: response.data.updatedAt
      }));

      showAlert('Row deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting row:', error);
      showAlert('Failed to delete row', 'error');
    } finally {
      setSavingRowId(null);
    }
  };

  const handleResetTable = async () => {
    if (!window.confirm('Are you sure you want to reset the table to default structure? This will remove all custom data.')) return;

    try {
      setSaving(true);
      const response = await resetTableToDefault(affiliateManager._id);

      // Update local state instead of reloading all data
      setTableData(response.data);

      showAlert('Table reset to default structure', 'success');
    } catch (error) {
      console.error('Error resetting table:', error);
      showAlert('Failed to reset table', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddRow = async () => {
    if (!newRowData.label.trim()) {
      showAlert('Please enter a label for the new row', 'error');
      return;
    }

    // Confirm global update
    const confirmed = window.confirm(
      `Are you sure you want to add "${newRowData.label}" to ALL affiliate managers' tables?\n\nThis action will add this item to every affiliate manager's performance table.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setSaving(true);
      const rowData = {
        id: `custom_${Date.now()}`, // Generate unique ID
        label: newRowData.label,
        value: parseFloat(newRowData.value) || 0,
        quantity: parseFloat(newRowData.quantity) || 1,
        calculationType: newRowData.calculationType || 'quantity',
        currency: newRowData.currency,
        category: newRowData.category,
        order: tableData.tableData.length + 1 // Add to end
      };

      const response = await addTableRow(affiliateManager._id, rowData);

      // Update local state instead of reloading all data
      setTableData(prevData => ({
        ...prevData,
        tableData: response.data.tableData, // Use the complete updated table data
        calculatedTotals: response.data.calculatedTotals,
        lastUpdatedBy: response.data.lastUpdatedBy,
        updatedAt: response.data.updatedAt
      }));

      setShowAddForm(false);
      setNewRowData({
        label: '',
        value: 0,
        quantity: 1,
        calculationType: 'quantity',
        currency: 'USD',
        category: 'services'
      });

      // Show success message with global update info
      if (response.globalUpdate) {
        const { totalAffiliateManagers, updatedTables, errors } = response.globalUpdate;
        let message = response.message;

        if (errors && errors.length > 0) {
          message += `\n\nErrors: ${errors.join(', ')}`;
        }

        showAlert(message, updatedTables === totalAffiliateManagers ? 'success' : 'warning');
      } else {
        showAlert('New row added successfully', 'success');
      }
    } catch (error) {
      console.error('Error adding row:', error);
      showAlert('Failed to add new row', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelAdd = () => {
    setShowAddForm(false);
    setNewRowData({
      label: '',
      value: 0,
      quantity: 1,
      calculationType: 'quantity',
      currency: 'USD',
      category: 'services'
    });
  };

  const renderEditableCell = (row, field) => {
    if (editingRow === row.id) {
      return (
        <TextField
          size="small"
          value={editValues[field] || ''}
          onChange={(e) => setEditValues({ ...editValues, [field]: e.target.value })}
          type={field === 'value' || field === 'quantity' ? 'number' : 'text'}
          fullWidth
          variant="outlined"
          inputProps={field === 'quantity' ? { min: 0, step: 0.01 } : {}}
        />
      );
    }

    if (field === 'value') {
      return formatCurrency(row[field]);
    }

    if (field === 'quantity') {
      return row[field] || 1;
    }

    if (field === 'totalValue') {
      return formatCurrency(calculateRowTotalValue(row));
    }

    return row[field];
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!tableData) {
    return (
      <Alert severity="error">
        Failed to load table data. Please try refreshing.
      </Alert>
    );
  }

  const totals = calculateTotals(tableData.tableData);

  // Get Hyper Net value from table data
  const hyperNetRow = tableData.tableData.find(row => row.id === 'hyper_net');
  const hyperNetValue = hyperNetRow ? hyperNetRow.value : 0;

  return (
    <Box sx={{ p: 2 }}>
      {alert.show && (
        <Alert severity={alert.severity} sx={{ mb: 2 }}>
          {alert.message}
        </Alert>
      )}

      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" sx={{ color: '#333', mb: 1 }}>
            {affiliateManager.fullName} - Table Editor
          </Typography>
          <Box display="flex" alignItems="center" gap={2}>
            <Box
              display="flex"
              alignItems="center"
              gap={1}
              sx={{
                backgroundColor: '#e3f2fd',
                px: 2,
                py: 1,
                borderRadius: 1,
                border: '2px solid #1976d2'
              }}
            >
              <CalendarIcon color="primary" />
              <Typography variant="h6" color="primary" fontWeight="bold">
                {getMonthYearDisplay()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ({commissionPeriod} expenses)
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Editing table items for the selected month
            </Typography>
          </Box>
        </Box>
        <Stack direction="row" spacing={2}>
          <Tooltip title="Add a new row that will appear in ALL affiliate managers' tables">
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setShowAddForm(true)}
              disabled={loading || saving}
              size="small"
              color="primary"
            >
              Add Global Row
            </Button>
          </Tooltip>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadTableData}
            disabled={loading || saving}
            size="small"
          >
            Refresh
          </Button>
          <Button
            variant="outlined"
            onClick={handleResetTable}
            disabled={loading || saving}
            size="small"
            color="warning"
          >
            Reset to Default
          </Button>
        </Stack>
      </Box>

      {/* Summary */}
      <Card sx={{ mb: 3, backgroundColor: '#f8f9fa' }}>
        <CardContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
            <strong>Financial Summary for {getMonthYearDisplay()}</strong>
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={6} md={2}>
              <Box textAlign="center">
                <Stack spacing={1}>
                  <Typography variant="h6" color="text.primary">
                    {formatCurrency(tableData.totalMoney || 0)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Money (from crypto)
                  </Typography>
                  <Button
                    size="small"
                    onClick={handleRefreshTotalMoney}
                    disabled={saving}
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                  >
                    Refresh
                  </Button>
                </Stack>
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
                  {formatCurrency(hyperNetValue)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Hyper Net
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
            <Grid item xs={6} md={2}>
              <Box textAlign="center">
                <Typography variant="h6" color="text.primary">
                  {tableData.calculatedTotals.percentage.toFixed(2)}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Percentage
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={2}>
              <Box textAlign="center" sx={{
                backgroundColor: '#e8f5e8',
                borderRadius: 1,
                p: 1,
                border: '2px solid #4caf50'
              }}>
                <Typography variant="h6" sx={{ color: '#2e7d32', fontWeight: 'bold' }}>
                  {formatCurrency(tableData.calculatedTotals.profit * 0.1)}
                </Typography>
                <Typography variant="body2" sx={{ color: '#2e7d32', fontWeight: 'medium' }}>
                  10% Commission
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Add New Row Form */}
      {showAddForm && (
        <Card sx={{ mb: 3, backgroundColor: '#f0f8ff' }}>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="h6">
                  Add Global Table Item
                </Typography>
                <Tooltip title="This item will be added to ALL affiliate managers' tables simultaneously">
                  <InfoIcon color="info" fontSize="small" />
                </Tooltip>
              </Box>
              <Alert severity="info" sx={{ py: 0, px: 2, fontSize: '0.875rem' }}>
                <strong>Global Update:</strong> This item will be added to all affiliate managers' tables
              </Alert>
            </Box>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={3}>
                <TextField
                  label="Item Label"
                  fullWidth
                  value={newRowData.label}
                  onChange={(e) => setNewRowData({ ...newRowData, label: e.target.value })}
                  placeholder="Enter item description"
                  size="small"
                />
              </Grid>
              <Grid item xs={12} md={1.5}>
                <TextField
                  label="Value"
                  type="number"
                  fullWidth
                  value={newRowData.value}
                  onChange={(e) => setNewRowData({ ...newRowData, value: e.target.value })}
                  size="small"
                />
              </Grid>
              <Grid item xs={12} md={1.5}>
                <TextField
                  label="Quantity"
                  type="number"
                  fullWidth
                  value={newRowData.quantity}
                  onChange={(e) => setNewRowData({ ...newRowData, quantity: e.target.value })}
                  size="small"
                  inputProps={{ min: 0, step: 0.01 }}
                />
              </Grid>
              <Grid item xs={12} md={1.5}>
                <FormControl fullWidth size="small">
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={newRowData.calculationType}
                    onChange={(e) => setNewRowData({ ...newRowData, calculationType: e.target.value })}
                    label="Type"
                  >
                    <MenuItem value="quantity">Quantity</MenuItem>
                    <MenuItem value="percentage">Percentage</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={1.5}>
                <FormControl fullWidth size="small">
                  <InputLabel>Currency</InputLabel>
                  <Select
                    value={newRowData.currency}
                    onChange={(e) => setNewRowData({ ...newRowData, currency: e.target.value })}
                    label="Currency"
                  >
                    <MenuItem value="USD">USD</MenuItem>
                    <MenuItem value="EUR">EUR</MenuItem>
                    <MenuItem value="GBP">GBP</MenuItem>
                    <MenuItem value="CAD">CAD</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={1.5}>
                <FormControl fullWidth size="small">
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={newRowData.category}
                    onChange={(e) => setNewRowData({ ...newRowData, category: e.target.value })}
                    label="Category"
                  >
                    <MenuItem value="ftd">FTD</MenuItem>
                    <MenuItem value="leads">Leads</MenuItem>
                    <MenuItem value="sim_cards">SIM Cards</MenuItem>
                    <MenuItem value="data_traffic">Data Traffic</MenuItem>
                    <MenuItem value="calls">Calls</MenuItem>
                    <MenuItem value="verification">Verification</MenuItem>
                    <MenuItem value="cards">Cards</MenuItem>
                    <MenuItem value="services">Services</MenuItem>
                    <MenuItem value="financial">Financial</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={1.5}>
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={handleAddRow}
                    disabled={saving}
                    size="small"
                    color="primary"
                  >
                    Add
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<CancelIcon />}
                    onClick={handleCancelAdd}
                    disabled={saving}
                    size="small"
                  >
                    Cancel
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Monthly Expense Items for {getMonthYearDisplay()} ({tableData.tableData.length})
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            All amounts shown below represent expenses incurred during {getMonthYearDisplay()}.
            Each item contributes to the total {commissionPeriod} expense calculation.
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell><strong>Category</strong></TableCell>
                  <TableCell><strong>Item</strong></TableCell>
                  <TableCell align="right"><strong>Value</strong></TableCell>
                  <TableCell align="right"><strong>Quantity</strong></TableCell>
                  <TableCell align="center"><strong>Type</strong></TableCell>
                  <TableCell align="right"><strong>Total Value</strong></TableCell>
                  <TableCell><strong>Currency</strong></TableCell>
                  <TableCell align="center"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tableData.tableData
                  .sort((a, b) => (a.order || 0) - (b.order || 0))
                  .map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                          {row.category.replace('_', ' ')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {renderEditableCell(row, 'label')}
                      </TableCell>
                      <TableCell align="right">
                        {renderEditableCell(row, 'value')}
                      </TableCell>
                      <TableCell align="right">
                        {renderEditableCell(row, 'quantity')}
                      </TableCell>
                      <TableCell align="center">
                        {editingRow === row.id ? (
                          <FormControl size="small" fullWidth>
                            <Select
                              value={editValues.calculationType || row.calculationType || 'quantity'}
                              onChange={(e) => setEditValues({ ...editValues, calculationType: e.target.value })}
                            >
                              <MenuItem value="quantity">Quantity</MenuItem>
                              <MenuItem value="percentage">Percentage</MenuItem>
                            </Select>
                          </FormControl>
                        ) : (
                          <Typography variant="body2" sx={{
                            textTransform: 'capitalize',
                            color: (row.calculationType || 'quantity') === 'percentage' ? '#d32f2f' : '#1976d2',
                            fontWeight: 'medium'
                          }}>
                            {(row.calculationType || 'quantity') === 'percentage' ? '%' : 'Qty'}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', backgroundColor: '#f8f9fa' }}>
                        {renderEditableCell(row, 'totalValue')}
                      </TableCell>
                      <TableCell>
                        {editingRow === row.id ? (
                          <FormControl size="small" fullWidth>
                            <Select
                              value={editValues.currency}
                              onChange={(e) => setEditValues({ ...editValues, currency: e.target.value })}
                            >
                              <MenuItem value="USD">USD</MenuItem>
                              <MenuItem value="EUR">EUR</MenuItem>
                              <MenuItem value="GBP">GBP</MenuItem>
                              <MenuItem value="CAD">CAD</MenuItem>
                            </Select>
                          </FormControl>
                        ) : (
                          row.currency
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {editingRow === row.id ? (
                          <Stack direction="row" spacing={1} justifyContent="center">
                            <Button
                              size="small"
                              variant="contained"
                              startIcon={<SaveIcon />}
                              onClick={() => handleSaveRow(row.id)}
                              disabled={savingRowId === row.id}
                            >
                              {savingRowId === row.id ? 'Saving...' : 'Save'}
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<CancelIcon />}
                              onClick={handleCancelEdit}
                              disabled={savingRowId === row.id}
                            >
                              Cancel
                            </Button>
                          </Stack>
                        ) : (
                          <Stack direction="row" spacing={1} justifyContent="center">
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<EditIcon />}
                              onClick={() => handleEditRow(row)}
                              disabled={savingRowId === row.id}
                            >
                              Edit
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<DeleteIcon />}
                              onClick={() => handleDeleteRow(row.id)}
                              disabled={savingRowId === row.id}
                              color="error"
                            >
                              {savingRowId === row.id ? 'Deleting...' : 'Delete'}
                            </Button>
                          </Stack>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Add New Row Button at bottom of table */}
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                         <Tooltip title="Add a new item that will appear in ALL affiliate managers' tables">
               <Button
                 variant="outlined"
                 startIcon={<AddIcon />}
                 onClick={() => setShowAddForm(true)}
                 disabled={loading || saving || showAddForm}
                 size="medium"
                 color="primary"
                 sx={{
                   borderStyle: 'dashed',
                   borderWidth: 2,
                   py: 1.5,
                   px: 3,
                   backgroundColor: 'rgba(25, 118, 210, 0.04)',
                   '&:hover': {
                     backgroundColor: 'rgba(25, 118, 210, 0.08)',
                     borderStyle: 'dashed'
                   }
                 }}
               >
                 Add Global Table Item
               </Button>
             </Tooltip>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default AffiliateManagerTableEditor;