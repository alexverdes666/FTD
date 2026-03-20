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
  MenuItem,
  Grid,
  Divider,
  Alert,
  CircularProgress,
  Chip,
  Paper,
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

  // Counter-based call type tracking
  const [disabledCallTypes, setDisabledCallTypes] = useState([]);
  const [disabledReasons, setDisabledReasons] = useState({});
  const [orderCount, setOrderCount] = useState(0);
  const [callTypeProgress, setCallTypeProgress] = useState({});
  const [orderDeclaredTypes, setOrderDeclaredTypes] = useState({});

  // Order selection state
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [ordersLoading, setOrdersLoading] = useState(false);

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

  // Fetch confirmed deposit orders when lead changes
  useEffect(() => {
    const fetchOrders = async () => {
      if (!leadId) {
        setOrders([]);
        setSelectedOrderId('');
        return;
      }
      setOrdersLoading(true);
      try {
        const orderList = await getLeadOrders(leadId);
        setOrders(orderList);
        // Auto-select if only one order
        if (orderList.length === 1) {
          setSelectedOrderId(orderList[0].depositCallId);
        } else {
          setSelectedOrderId('');
        }
      } catch (err) {
        console.error('Error fetching orders:', err);
        setOrders([]);
        setSelectedOrderId('');
      } finally {
        setOrdersLoading(false);
      }
    };
    fetchOrders();
  }, [leadId]);

  // Fetch disabled call types when lead changes (lead-wide mode for agent-scoped counts)
  useEffect(() => {
    const fetchDisabledTypes = async () => {
      if (!leadId) {
        setDisabledCallTypes([]);
        setDisabledReasons({});
        setOrderCount(0);
        setCallTypeProgress({});
        setOrderDeclaredTypes({});
        return;
      }
      const result = await getDisabledCallTypes(leadId);
      setDisabledCallTypes(result.disabledCallTypes || []);
      setDisabledReasons(result.disabledReasons || {});
      setOrderCount(result.orderCount || 0);
      setCallTypeProgress(result.callTypeProgress || {});
      setOrderDeclaredTypes(result.orderDeclaredTypes || {});
      // Reset callType if it became disabled
      if (callType && (result.disabledCallTypes || []).includes(callType)) {
        setCallType('');
      }
    };
    fetchDisabledTypes();
  }, [leadId]);

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
      setDisabledReasons({});
      setOrderCount(0);
      setCallTypeProgress({});
      setOrderDeclaredTypes({});
      setOrders([]);
      setSelectedOrderId('');
      setOrdersLoading(false);
    }
  }, [open]);

  // Filter orders to only show ones that don't already have the selected call type declared
  const availableOrders = useMemo(() => {
    if (!callType) return orders;
    return orders.filter(order => {
      const declared = orderDeclaredTypes[order.depositCallId] || [];
      return !declared.includes(callType);
    });
  }, [orders, callType, orderDeclaredTypes]);

  // Auto-select order when only 1 available for this call type
  useEffect(() => {
    if (callCategory !== 'ftd' || !callType) return;
    if (availableOrders.length === 1) {
      setSelectedOrderId(availableOrders[0].depositCallId);
    } else if (selectedOrderId) {
      // Check if currently selected order is still available
      const stillAvailable = availableOrders.some(o => o.depositCallId === selectedOrderId);
      if (!stillAvailable) {
        setSelectedOrderId('');
      }
    }
  }, [callType, availableOrders, callCategory]);

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
    if (callCategory === 'ftd' && availableOrders.length > 1 && !selectedOrderId) {
      setError('Please select an order for this declaration');
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
        depositCallId: selectedOrderId || undefined,
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
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ py: 1, px: 2 }}>
        <Box display="flex" alignItems="center" gap={0.5}>
          <PhoneIcon color="primary" sx={{ fontSize: 18 }} />
          <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: "0.9rem" }}>Declare Call Bonus</Typography>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ px: 2, py: 1.5 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 1, py: 0.25, fontSize: "0.78rem" }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Call Details - Compact Inline */}
        <Paper variant="outlined" sx={{ p: 1, mb: 1.5 }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "stretch" }}>
            <Box>
              <Typography sx={{ fontSize: "0.6rem", color: "text.secondary", textTransform: "uppercase" }}>Date</Typography>
              <Typography sx={{ fontSize: "0.78rem" }}>{formatDate(call.callDate)}</Typography>
            </Box>
            <Divider orientation="vertical" flexItem sx={{ borderColor: "primary.main" }} />
            <Box>
              <Typography sx={{ fontSize: "0.6rem", color: "text.secondary", textTransform: "uppercase" }}>Duration</Typography>
              <Box display="flex" alignItems="center" gap={0.5}>
                <Typography sx={{ fontSize: "0.78rem", fontWeight: 500 }}>{call.formattedDuration}</Typography>
                {call.callDuration >= 3600 && (
                  <Chip label="+$10/hr" size="small" color="success" variant="outlined" sx={{ height: 16, fontSize: "0.6rem" }} />
                )}
              </Box>
            </Box>
            <Divider orientation="vertical" flexItem sx={{ borderColor: "primary.main" }} />
            <Box>
              <Typography sx={{ fontSize: "0.6rem", color: "text.secondary", textTransform: "uppercase" }}>Source</Typography>
              <Typography sx={{ fontSize: "0.75rem", fontFamily: "monospace" }}>{call.sourceNumber}</Typography>
            </Box>
            <Divider orientation="vertical" flexItem sx={{ borderColor: "primary.main" }} />
            <Box>
              <Typography sx={{ fontSize: "0.6rem", color: "text.secondary", textTransform: "uppercase" }}>Dest</Typography>
              <Typography sx={{ fontSize: "0.75rem", fontFamily: "monospace" }}>{call.destinationNumber}</Typography>
            </Box>
          </Box>
        </Paper>

        {/* Call Category Selection (FTD / Filler) */}
        <Box sx={{ mb: 1 }}>
          <Typography sx={{ fontSize: "0.7rem", color: "text.secondary", mb: 0.5 }}>Category *</Typography>
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
            sx={{ height: 30, "& .MuiToggleButton-root": { fontSize: "0.75rem", py: 0.25, textTransform: "none" } }}
          >
            <ToggleButton value="ftd" color="primary">FTD</ToggleButton>
            <ToggleButton value="filler" color="secondary">Filler</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Call Type and Order - only shown for FTD calls */}
        {callCategory === 'ftd' && (
          <>
            {/* Order counter info */}
            {leadId && !ordersLoading && orders.length === 0 && (
              <Alert severity="info" sx={{ mb: 1, py: 0.25, fontSize: "0.75rem" }}>
                No confirmed deposit orders found yet for this lead. You can still declare the call.
              </Alert>
            )}
            {leadId && orders.length === 1 && (
              <Alert severity="info" sx={{ mb: 1, py: 0.25, fontSize: "0.75rem" }}>
                This lead has <strong>1</strong> confirmed deposit order assigned to you. Order auto-selected.
              </Alert>
            )}
            {leadId && orders.length > 1 && (
              <Alert severity="info" sx={{ mb: 1, py: 0.25, fontSize: "0.75rem" }}>
                This lead has <strong>{orders.length}</strong> confirmed deposit orders assigned to you.
                {' '}Select a call type first, then pick the order.
              </Alert>
            )}

            {/* Call Type Selection (shown first so order dropdown filters by it) */}
            <TextField
              select
              fullWidth
              label="Call Type *"
              value={callType}
              onChange={(e) => setCallType(e.target.value)}
              disabled={loading}
              sx={{ mb: 1 }}
              size="small"
            >
              {CALL_TYPES.map((type) => {
                const isDisabled = disabledCallTypes.includes(type.value);
                const progress = callTypeProgress[type.value];
                const reason = disabledReasons[type.value];
                let disabledText = '';
                if (isDisabled) {
                  if (type.value === 'deposit') {
                    disabledText = ' (AM declares deposit call)';
                  } else if (reason === 'fully_declared') {
                    disabledText = ' (fully declared for all your orders)';
                  }
                }
                return (
                  <MenuItem key={type.value} value={type.value} disabled={isDisabled}>
                    <Box display="flex" justifyContent="space-between" width="100%" alignItems="center">
                      <span>{type.label}{disabledText}</span>
                      <Box display="flex" alignItems="center" gap={1}>
                        {progress && orderCount > 1 && type.value !== 'deposit' && (
                          <Chip
                            label={`${progress.declared}/${progress.total}`}
                            size="small"
                            color={progress.declared >= progress.total ? "default" : "info"}
                            variant="outlined"
                          />
                        )}
                        <Chip
                          label={formatCurrency(type.bonus)}
                          size="small"
                          color={isDisabled ? "default" : "success"}
                          variant="outlined"
                        />
                      </Box>
                    </Box>
                  </MenuItem>
                );
              })}
            </TextField>

            {/* Order Selection - shown when call type is selected and multiple orders are available */}
            {leadId && callType && availableOrders.length > 1 && (
              <TextField
                select
                fullWidth
                label="Select Order *"
                value={selectedOrderId}
                onChange={(e) => setSelectedOrderId(e.target.value)}
                disabled={loading || ordersLoading}
                sx={{ mb: 1 }}
                size="small"
                InputProps={{
                  startAdornment: ordersLoading ? (
                    <CircularProgress size={16} sx={{ mr: 1 }} />
                  ) : null,
                }}
              >
                {availableOrders.map((order) => {
                  const shortId = order.orderId?.toString().slice(-8) || '?';
                  const planned = order.plannedDate
                    ? new Date(order.plannedDate).toLocaleDateString()
                    : order.orderCreatedAt
                      ? new Date(order.orderCreatedAt).toLocaleDateString()
                      : 'No date';
                  const broker = order.brokerName || 'Unknown broker';
                  const label = order.isCustomRecord && order.customNote
                    ? order.customNote
                    : `Order ...${shortId}`;
                  return (
                    <MenuItem key={order.depositCallId} value={order.depositCallId}>
                      <Box display="flex" justifyContent="space-between" width="100%" alignItems="center">
                        <span>{label}</span>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Chip label={planned} size="small" variant="outlined" />
                          <Chip label={broker} size="small" color="primary" variant="outlined" />
                        </Box>
                      </Box>
                    </MenuItem>
                  );
                })}
              </TextField>
            )}
            {leadId && callType && availableOrders.length === 1 && orders.length > 1 && (
              <Alert severity="success" sx={{ mb: 1, py: 0.25, fontSize: "0.75rem" }}>
                Order auto-selected — only 1 order remaining for this call type.
              </Alert>
            )}
          </>
        )}

        {callCategory === 'filler' && (
          <Alert severity="info" sx={{ mb: 1, py: 0.25, fontSize: "0.75rem" }}>
            Filler calls: $0.00 bonus, no call type needed.
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
          sx={{ mb: 1 }}
          size="small"
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
              size="small"
              InputProps={{
                ...params.InputProps,
                startAdornment: (
                  <>
                    {leadSearchLoading ? (
                      <CircularProgress size={14} sx={{ mr: 0.5 }} />
                    ) : (
                      <ContactsIcon color={leadAutoFilled ? "success" : "action"} sx={{ mr: 0.5, fontSize: 18 }} />
                    )}
                    {params.InputProps.startAdornment}
                  </>
                ),
              }}
            />
          )}
          sx={{ mb: 1 }}
        />

        <TextField
          fullWidth
          multiline
          rows={2}
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={loading}
          placeholder="Details about the call..."
          sx={{ mb: 1 }}
          size="small"
          inputProps={{ maxLength: 1000 }}
          helperText={`${description.length}/1000`}
        />

        {/* Bonus Preview */}
        {(callCategory === 'filler' || callType) && (
          <Paper variant="outlined" sx={{ p: 1, bgcolor: 'success.50', borderColor: 'success.main' }}>
            {previewLoading ? (
              <Box display="flex" justifyContent="center" py={0.5}>
                <CircularProgress size={16} />
              </Box>
            ) : bonusPreview ? (
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box display="flex" alignItems="center" gap={1}>
                  <MoneyIcon sx={{ fontSize: 16, color: "success.main" }} />
                  <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                    Base: {formatCurrency(bonusPreview.baseBonus)}
                    {bonusPreview.hourlyBonus > 0 && ` + Hourly: ${formatCurrency(bonusPreview.hourlyBonus)}`}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: "success.main" }}>
                  {formatCurrency(bonusPreview.totalBonus)}
                </Typography>
              </Box>
            ) : null}
          </Paper>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2, py: 1 }}>
        <Button onClick={onClose} disabled={loading} size="small" sx={{ fontSize: "0.78rem" }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="primary"
          size="small"
          onClick={handleSubmit}
          disabled={loading || (callCategory === 'ftd' && !callType) || !affiliateManagerId || !leadId || (callCategory === 'ftd' && availableOrders.length > 1 && !selectedOrderId)}
          startIcon={loading ? <CircularProgress size={14} /> : <SendIcon sx={{ fontSize: 16 }} />}
          sx={{ fontSize: "0.78rem", py: 0.5 }}
        >
          {loading ? 'Submitting...' : 'Submit'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CallDeclarationDialog;
