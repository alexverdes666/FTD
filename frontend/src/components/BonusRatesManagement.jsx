import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Grid,
  InputAdornment,
  Tooltip,
  IconButton,
  Paper,
  Divider,
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Refresh as RefreshIcon,
  AttachMoney as MoneyIcon,
  Settings as SettingsIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { getGlobalBonusRates, updateGlobalBonusRates } from '../services/systemConfiguration';

const BonusRatesManagement = () => {
  const theme = useTheme();
  const [bonusRates, setBonusRates] = useState({
    firstCall: 5.0,
    secondCall: 10.0,
    thirdCall: 15.0,
    fourthCall: 20.0,
    fifthCall: 25.0,
    verifiedAcc: 50.0,
  });
  const [originalRates, setOriginalRates] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [lastUpdatedBy, setLastUpdatedBy] = useState(null);
  const [alert, setAlert] = useState({ show: false, message: '', severity: 'info' });

  useEffect(() => {
    loadBonusRates();
  }, []);

  const showAlert = (message, severity = 'info') => {
    setAlert({ show: true, message, severity });
    setTimeout(() => setAlert({ show: false, message: '', severity: 'info' }), 5000);
  };

  const loadBonusRates = async () => {
    try {
      setLoading(true);
      const response = await getGlobalBonusRates();
      const config = response.data;
      
      if (config && config.bonusRates) {
        setBonusRates(config.bonusRates);
        setOriginalRates(config.bonusRates);
        setNotes(config.notes || '');
        setLastUpdated(config.updatedAt);
        setLastUpdatedBy(config.lastUpdatedBy);
      }
    } catch (error) {
      console.error('Failed to load bonus rates:', error);
      showAlert('Failed to load bonus rates configuration', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setOriginalRates({ ...bonusRates });
  };

  const handleCancel = () => {
    setBonusRates({ ...originalRates });
    setIsEditing(false);
    setNotes('');
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Validate rates
      for (const [key, value] of Object.entries(bonusRates)) {
        if (isNaN(value) || value < 0) {
          showAlert(`Invalid value for ${key}. Must be a positive number.`, 'error');
          return;
        }
      }

      await updateGlobalBonusRates(bonusRates, notes);
      await loadBonusRates();
      setIsEditing(false);
      showAlert('Global bonus rates updated successfully', 'success');
    } catch (error) {
      console.error('Failed to save bonus rates:', error);
      showAlert('Failed to save bonus rates configuration', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRateChange = (field, value) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0) return;
    setBonusRates(prev => ({
      ...prev,
      [field]: numValue
    }));
  };

  const formatCurrency = (value) => `$${Number(value).toFixed(2)}`;

  const rateFields = [
    { key: 'firstCall', label: '1st Call Monthly Bonus', description: 'Monthly bonus amount per first call' },
    { key: 'secondCall', label: '2nd Call Monthly Bonus', description: 'Monthly bonus amount per second call' },
    { key: 'thirdCall', label: '3rd Call Monthly Bonus', description: 'Monthly bonus amount per third call' },
    { key: 'fourthCall', label: '4th Call Monthly Bonus', description: 'Monthly bonus amount per fourth call' },
    { key: 'fifthCall', label: '5th Call Monthly Bonus', description: 'Monthly bonus amount per fifth call' },
    { key: 'verifiedAcc', label: 'Verified Account Monthly Bonus', description: 'Monthly bonus amount per verified account' },
  ];

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {alert.show && (
        <Alert severity={alert.severity} sx={{ mb: 2 }}>
          {alert.message}
        </Alert>
      )}

      <Card>
        <CardHeader
          title={
            <Box display="flex" alignItems="center" gap={1}>
              <SettingsIcon />
              <Typography variant="h6" fontWeight="bold">
                Global Monthly Bonus Rates Configuration
              </Typography>
            </Box>
          }
          action={
            <Box display="flex" gap={1}>
              {!isEditing ? (
                <>
                  <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={loadBonusRates}
                    disabled={loading}
                  >
                    Refresh
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<EditIcon />}
                    onClick={handleEdit}
                    color="primary"
                  >
                    Edit Rates
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outlined"
                    startIcon={<CancelIcon />}
                    onClick={handleCancel}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={handleSave}
                    disabled={saving}
                    color="success"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </>
              )}
            </Box>
          }
        />
        <CardContent>
          <Box sx={{ mb: 3 }}>
            <Alert severity="info" icon={<InfoIcon />}>
              These global monthly bonus rates will be used as default values for all agent monthly call bonuses. 
              Changes to these rates will affect future monthly bonus calculations.
            </Alert>
          </Box>

          {/* Bonus Rates Grid */}
          <Grid container spacing={3}>
            {rateFields.map((field) => (
              <Grid item xs={12} sm={6} md={4} key={field.key}>
                <Paper 
                  sx={{ 
                    p: 2, 
                    border: isEditing ? `2px solid ${theme.palette.primary.main}` : '1px solid',
                    borderColor: isEditing ? theme.palette.primary.main : theme.palette.divider,
                    transition: 'border-color 0.2s ease-in-out'
                  }}
                >
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <MoneyIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle2" fontWeight="bold">
                      {field.label}
                    </Typography>
                    <Tooltip title={field.description}>
                      <IconButton size="small">
                        <InfoIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  
                  {isEditing ? (
                    <TextField
                      fullWidth
                      type="number"
                      value={bonusRates[field.key]}
                      onChange={(e) => handleRateChange(field.key, e.target.value)}
                      inputProps={{ min: 0, step: 0.01 }}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                      }}
                      size="small"
                    />
                  ) : (
                    <Typography variant="h6" color="success.main" fontWeight="bold">
                      {formatCurrency(bonusRates[field.key])}
                    </Typography>
                  )}
                  
                  <Typography variant="caption" color="text.secondary">
                    {field.description}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>

          {/* Notes Section */}
          {isEditing && (
            <Box sx={{ mt: 3 }}>
              <Divider sx={{ mb: 2 }} />
              <TextField
                fullWidth
                label="Notes (Optional)"
                multiline
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about these bonus rate changes..."
                variant="outlined"
              />
            </Box>
          )}

          {/* Metadata */}
          {lastUpdated && (
            <Box sx={{ mt: 3, pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    Last Updated: {new Date(lastUpdated).toLocaleString()}
                  </Typography>
                </Grid>
                {lastUpdatedBy && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary">
                      Updated By: {lastUpdatedBy.fullName || lastUpdatedBy.email}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default BonusRatesManagement;
