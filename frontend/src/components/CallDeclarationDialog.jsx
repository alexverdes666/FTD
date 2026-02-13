import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  TextField,
  MenuItem,
  Grid,
  Divider,
  Alert,
  CircularProgress,
  Chip,
  Paper,
  FormControl,
  InputLabel,
  Select,
  ListItemText,
  ToggleButton,
  ToggleButtonGroup,
  Autocomplete,
} from '@mui/material';
import {
  Phone as PhoneIcon,
  AccessTime as AccessTimeIcon,
  AttachMoney as MoneyIcon,
  Send as SendIcon,
  Person as PersonIcon,
  Contacts as ContactsIcon,
} from '@mui/icons-material';
import { createDeclaration, previewBonus, findLeadsByPhone, getDisabledCallTypes, getLeadOrders } from '../services/callDeclarations';
import api from '../services/api';

const CALL_TYPES = [
  { value: 'deposit', label: 'Deposit Call', bonus: 10.0 },
  { value: 'first_call', label: 'First Call', bonus: 7.5 },
  { value: 'second_call', label: 'Second Call', bonus: 7.5 },
  { value: 'third_call', label: '3rd Call', bonus: 5.0 },
  { value: 'fourth_call', label: '4th Call', bonus: 10.0 },
  { value: 'fifth_call', label: '5th Call', bonus: 0 },
  { value: 'sixth_call', label: '6th Call', bonus: 0 },
  { value: 'seventh_call', label: '7th Call', bonus: 0 },
  { value: 'eighth_call', label: '8th Call', bonus: 0 },
  { value: 'ninth_call', label: '9th Call', bonus: 0 },
  { value: 'tenth_call', label: '10th Call', bonus: 0 },
];

const CallDeclarationDialog = ({ open, onClose, call, onDeclarationCreated, leads: passedLeads = [] }) => {
  const [callType, setCallType] = useState('');
  const [callCategory, setCallCategory] = useState('ftd');
  const [description, setDescription] = useState('');
  const [bonusPreview, setBonusPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState(null);

  // New state for affiliate manager and lead selection
  const [affiliateManagerId, setAffiliateManagerId] = useState('');
  const [leadId, setLeadId] = useState('');
  const [affiliateManagers, setAffiliateManagers] = useState([]);
  const [affiliateManagersLoading, setAffiliateManagersLoading] = useState(false);

  // Lead auto-fill state
  const [leadAutoFilled, setLeadAutoFilled] = useState(false);
  const [leadSearchLoading, setLeadSearchLoading] = useState(false);

  // Order selection state (when a lead has multiple orders with confirmed deposits)
  const [availableOrders, setAvailableOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Disabled call types for the selected lead
  const [disabledCallTypes, setDisabledCallTypes] = useState([]);

  // Fetch affiliate managers only
  const fetchAffiliateManagers = useCallback(async () => {
    setAffiliateManagersLoading(true);
    try {
      // Fetch affiliate managers from the call-declarations endpoint (accessible to agents)
      const response = await api.get('/call-declarations/affiliate-managers');

      const affiliateManagersList = response.data.success ? (response.data.data || []) : [];
      setAffiliateManagers(affiliateManagersList);
    } catch (err) {
      console.error('Error fetching affiliate managers:', err);
    } finally {
      setAffiliateManagersLoading(false);
    }
  }, []);

  // Fetch affiliate managers when dialog opens
  useEffect(() => {
    if (open) {
      fetchAffiliateManagers();
    }
  }, [open, fetchAffiliateManagers]);

  // Auto-fill lead by phone number or email when dialog opens
  useEffect(() => {
    const autoFillLead = async () => {
      if (!open || (!call?.lineNumber && !call?.email)) return;

      setLeadSearchLoading(true);
      try {
        const { leads: matchedLeads, multiple } = await findLeadsByPhone(call.lineNumber, call.email);
        if (matchedLeads.length > 0) {
          setLeadId(matchedLeads[0]._id);
          // Only lock selection when exactly one lead matches.
          // When multiple leads match (same phone, different orders),
          // let the agent pick which order's lead to declare for.
          setLeadAutoFilled(!multiple);
        } else {
          setLeadAutoFilled(false);
        }
      } catch (err) {
        console.error('Error auto-filling lead:', err);
        setLeadAutoFilled(false);
      } finally {
        setLeadSearchLoading(false);
      }
    };

    autoFillLead();
  }, [open, call?.lineNumber, call?.email]);

  // Fetch available orders when lead changes
  useEffect(() => {
    const fetchOrders = async () => {
      if (!leadId) {
        setAvailableOrders([]);
        setSelectedOrderId('');
        return;
      }
      setOrdersLoading(true);
      try {
        const orders = await getLeadOrders(leadId);
        setAvailableOrders(orders);
        // Auto-select if only one order
        if (orders.length === 1) {
          setSelectedOrderId(orders[0].orderId);
        } else {
          setSelectedOrderId('');
        }
      } catch (err) {
        console.error('Error fetching lead orders:', err);
        setAvailableOrders([]);
        setSelectedOrderId('');
      } finally {
        setOrdersLoading(false);
      }
    };
    fetchOrders();
  }, [leadId]);

  // Fetch disabled call types when lead or selected order changes
  useEffect(() => {
    const fetchDisabledTypes = async () => {
      if (!leadId) {
        setDisabledCallTypes([]);
        return;
      }
      const disabled = await getDisabledCallTypes(leadId, selectedOrderId || null);
      setDisabledCallTypes(disabled);
      // Reset callType if it became disabled
      if (callType && disabled.includes(callType)) {
        setCallType('');
      }
    };
    fetchDisabledTypes();
  }, [leadId, selectedOrderId]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setCallType('');
      setCallCategory('ftd');
      setDescription('');
      setBonusPreview(null);
      setError(null);
      setAffiliateManagerId('');
      setLeadId('');
      setLeadAutoFilled(false);
      setDisabledCallTypes([]);
      setAvailableOrders([]);
      setSelectedOrderId('');
      setOrdersLoading(false);
    }
  }, [open]);

  // Calculate bonus preview when call type or category changes
  useEffect(() => {
    if (callCategory === 'filler') {
      setBonusPreview({ baseBonus: 0, hourlyBonus: 0, totalBonus: 0 });
    } else if (callType && call?.callDuration) {
      calculateBonusPreview();
    } else {
      setBonusPreview(null);
    }
  }, [callCategory, callType, call]);

  const calculateBonusPreview = async () => {
    if (!callType || !call?.callDuration) return;

    setPreviewLoading(true);
    try {
      const preview = await previewBonus(callType, call.callDuration);
      setBonusPreview(preview);
    } catch (err) {
      console.error('Error calculating bonus preview:', err);
      // Fallback to local calculation
      const baseBonus = CALL_TYPES.find(t => t.value === callType)?.bonus || 0;
      let hourlyBonus = 0;
      if (call.callDuration > 3600) {
        const additionalHours = Math.floor((call.callDuration - 3600) / 3600);
        hourlyBonus = additionalHours * 10;
      }
      setBonusPreview({
        baseBonus,
        hourlyBonus,
        totalBonus: baseBonus + hourlyBonus,
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (callCategory === 'ftd' && !callType) {
      setError('Please select a call type');
      return;
    }
    if (!affiliateManagerId) {
      setError('Please select an affiliate manager');
      return;
    }
    if (!leadId) {
      setError('Please select a lead');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const declarationData = {
        cdrCallId: call.cdrCallId,
        callDate: call.callDate,
        callDuration: call.callDuration,
        sourceNumber: call.sourceNumber,
        destinationNumber: call.destinationNumber,
        lineNumber: call.lineNumber || '',
        callCategory,
        callType: callCategory === 'ftd' ? callType : undefined,
        description: description.trim() || undefined,
        affiliateManagerId,
        leadId,
        orderId: selectedOrderId || undefined,
        recordFile: call.recordFile || '',
      };

      const newDeclaration = await createDeclaration(declarationData);
      onDeclarationCreated(newDeclaration);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create declaration');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  const formatCurrency = (value) => `$${Number(value).toFixed(2)}`;

  if (!call) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <PhoneIcon color="primary" />
          <Typography variant="h6">Declare Call Bonus</Typography>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Call Details */}
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Call Details
        </Typography>
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">
                Date & Time
              </Typography>
              <Typography variant="body2">
                {formatDate(call.callDate)}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">
                Duration
              </Typography>
              <Box display="flex" alignItems="center" gap={0.5}>
                <AccessTimeIcon fontSize="small" color="action" />
                <Typography variant="body2" fontWeight="medium">
                  {call.formattedDuration}
                </Typography>
                {call.callDuration >= 3600 && (
                  <Chip
                    label="+$10/hr bonus"
                    size="small"
                    color="success"
                    variant="outlined"
                    sx={{ ml: 1 }}
                  />
                )}
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">
                Source
              </Typography>
              <Typography variant="body2" fontFamily="monospace">
                {call.sourceNumber}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">
                Destination
              </Typography>
              <Typography variant="body2" fontFamily="monospace">
                {call.destinationNumber}
              </Typography>
            </Grid>
          </Grid>
        </Paper>

        <Divider sx={{ mb: 3 }} />

        {/* Declaration Form */}
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Declaration Details
        </Typography>

        {/* Call Category Selection (FTD / Filler) */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Call Category *
          </Typography>
          <ToggleButtonGroup
            value={callCategory}
            exclusive
            onChange={(e, newValue) => {
              if (newValue !== null) {
                setCallCategory(newValue);
                if (newValue === 'filler') {
                  setCallType('');
                }
              }
            }}
            fullWidth
            disabled={loading}
            size="small"
          >
            <ToggleButton value="ftd" color="primary">
              FTD Call
            </ToggleButton>
            <ToggleButton value="filler" color="secondary">
              Filler Call
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Call Type - only shown for FTD calls */}
        {callCategory === 'ftd' && (
          <TextField
            select
            fullWidth
            label="Call Type *"
            value={callType}
            onChange={(e) => setCallType(e.target.value)}
            disabled={loading}
            sx={{ mb: 2 }}
            helperText="Select the type of call for bonus calculation"
          >
            {CALL_TYPES.map((type) => {
              const isDisabled = disabledCallTypes.includes(type.value);
              return (
                <MenuItem key={type.value} value={type.value} disabled={isDisabled}>
                  <Box display="flex" justifyContent="space-between" width="100%">
                    <span>{type.label}{isDisabled ? ' (already declared)' : ''}</span>
                    <Chip
                      label={formatCurrency(type.bonus)}
                      size="small"
                      color={isDisabled ? "default" : "success"}
                      variant="outlined"
                      sx={{ ml: 2 }}
                    />
                  </Box>
                </MenuItem>
              );
            })}
          </TextField>
        )}

        {/* Filler call info */}
        {callCategory === 'filler' && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Filler calls have a $0.00 bonus. No call type selection needed.
          </Alert>
        )}

        {/* Affiliate Manager Selection */}
        <TextField
          select
          fullWidth
          label="Assign To *"
          value={affiliateManagerId}
          onChange={(e) => setAffiliateManagerId(e.target.value)}
          disabled={loading || affiliateManagersLoading}
          sx={{ mb: 2 }}
          helperText="Select the affiliate manager for approval"
          InputProps={{
            startAdornment: affiliateManagersLoading ? (
              <CircularProgress size={16} sx={{ mr: 1 }} />
            ) : (
              <PersonIcon color="action" sx={{ mr: 1 }} />
            ),
          }}
        >
          {affiliateManagers.length === 0 && !affiliateManagersLoading ? (
            <MenuItem disabled>No affiliate managers available</MenuItem>
          ) : (
            affiliateManagers.map((user) => (
              <MenuItem key={user._id} value={user._id}>
                <Box display="flex" alignItems="center" gap={1} width="100%">
                  <span>{user.fullName}</span>
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                    {user.email}
                  </Typography>
                </Box>
              </MenuItem>
            ))
          )}
        </TextField>

        {/* Lead Selection (searchable) */}
        <Autocomplete
          options={passedLeads || []}
          value={(passedLeads || []).find((l) => (l._id || l.leadId) === leadId) || null}
          onChange={(e, newValue) => {
            if (!leadAutoFilled) {
              setLeadId(newValue ? (newValue._id || newValue.leadId) : '');
            }
          }}
          getOptionLabel={(option) => {
            const orderId = option.orderId?._id || option.orderId;
            const orderSuffix = orderId ? ` (Order: ${orderId.toString().slice(-8)})` : '';
            return `${option.firstName || ''} ${option.lastName || ''} - ${option.newEmail || ''} - ${option.newPhone || ''}${orderSuffix}`;
          }}
          isOptionEqualToValue={(option, value) =>
            (option._id || option.leadId) === (value._id || value.leadId)
          }
          filterOptions={(options, { inputValue }) => {
            const search = inputValue.toLowerCase();
            return options.filter((lead) =>
              `${lead.firstName} ${lead.lastName} ${lead.newEmail} ${lead.newPhone}`
                .toLowerCase()
                .includes(search)
            );
          }}
          disabled={loading || leadAutoFilled || leadSearchLoading || (!passedLeads || passedLeads.length === 0)}
          noOptionsText="No leads found"
          renderOption={(props, option) => {
            const orderId = option.orderId?._id || option.orderId;
            return (
              <li {...props} key={option._id || option.leadId}>
                <Box>
                  <Typography variant="body2">
                    {option.firstName} {option.lastName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {option.newEmail} | {option.newPhone}
                    {orderId && (
                      <> | Order: <b>{orderId.toString().slice(-8)}</b></>
                    )}
                  </Typography>
                </Box>
              </li>
            );
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Lead *"
              helperText={
                leadSearchLoading
                  ? "Searching for matching lead..."
                  : leadAutoFilled
                    ? "Lead auto-matched by phone number"
                    : leadId && !leadAutoFilled
                      ? "Multiple leads found for this phone — select the correct order"
                      : !passedLeads || passedLeads.length === 0
                        ? "No leads assigned to you"
                        : "Search by name, email or phone"
              }
              InputProps={{
                ...params.InputProps,
                startAdornment: (
                  <>
                    {leadSearchLoading ? (
                      <CircularProgress size={16} sx={{ mr: 1 }} />
                    ) : (
                      <ContactsIcon color={leadAutoFilled ? "success" : "action"} sx={{ mr: 1 }} />
                    )}
                    {params.InputProps.startAdornment}
                  </>
                ),
              }}
            />
          )}
          sx={{ mb: 2 }}
        />

        {/* Order Selection - shown when lead has multiple orders with confirmed deposits */}
        {leadId && availableOrders.length > 1 && (
          <TextField
            select
            fullWidth
            label="Order *"
            value={selectedOrderId}
            onChange={(e) => setSelectedOrderId(e.target.value)}
            disabled={loading || ordersLoading}
            sx={{ mb: 2 }}
            helperText={ordersLoading ? "Loading orders..." : "This lead has multiple orders — select which order this call is for"}
          >
            {availableOrders.map((order) => (
              <MenuItem key={order.orderId} value={order.orderId}>
                <Box display="flex" alignItems="center" gap={1} width="100%">
                  <span>Order: ...{order.orderId.toString().slice(-8)}</span>
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                    {order.orderCreatedAt ? new Date(order.orderCreatedAt).toLocaleDateString() : ''}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </TextField>
        )}

        <TextField
          fullWidth
          multiline
          rows={3}
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={loading}
          placeholder="Provide details about the call (e.g., client name, outcome, etc.)"
          sx={{ mb: 3 }}
          inputProps={{ maxLength: 1000 }}
          helperText={`${description.length}/1000 characters`}
        />

        {/* Bonus Preview */}
        {(callCategory === 'filler' || callType) && (
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              bgcolor: 'success.50',
              borderColor: 'success.main',
            }}
          >
            <Typography variant="subtitle2" gutterBottom display="flex" alignItems="center" gap={1}>
              <MoneyIcon color="success" />
              Bonus Preview
            </Typography>

            {previewLoading ? (
              <Box display="flex" justifyContent="center" py={1}>
                <CircularProgress size={24} />
              </Box>
            ) : bonusPreview ? (
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Base Bonus
                  </Typography>
                  <Typography variant="body1">
                    {formatCurrency(bonusPreview.baseBonus)}
                  </Typography>
                </Grid>
                {bonusPreview.hourlyBonus > 0 && (
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Hourly Bonus (+1hr)
                    </Typography>
                    <Typography variant="body1">
                      {formatCurrency(bonusPreview.hourlyBonus)}
                    </Typography>
                  </Grid>
                )}
                <Grid item xs={12}>
                  <Divider sx={{ my: 1 }} />
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle1" fontWeight="bold">
                      Total Bonus
                    </Typography>
                    <Typography variant="h5" color="success.main" fontWeight="bold">
                      {formatCurrency(bonusPreview.totalBonus)}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            ) : null}
          </Paper>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSubmit}
          disabled={loading || (callCategory === 'ftd' && !callType) || !affiliateManagerId || !leadId || (availableOrders.length > 1 && !selectedOrderId)}
          startIcon={loading ? <CircularProgress size={16} /> : <SendIcon />}
        >
          {loading ? 'Submitting...' : 'Submit Declaration'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CallDeclarationDialog;
