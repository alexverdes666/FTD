import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Divider,
  Alert,
  CircularProgress,
  Chip,
  Stack
} from '@mui/material';
import {
  AccountBalanceWallet as WalletIcon,
  Person as PersonIcon,
  AttachMoney as MoneyIcon,
  Link as LinkIcon,
  Close as CloseIcon,
  Check as CheckIcon,
  Cancel as CancelIcon,
  Schedule as PendingIcon,
  CheckCircle as ApprovedIcon,
  Paid as CompletedIcon,
  CalendarMonth as Schedule,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { processWithdrawal, getWithdrawalStatusColor, getWithdrawalStatusText } from '../services/withdrawals';

const ProcessWithdrawalModal = ({ open, onClose, withdrawal, onProcessed }) => {
  const [status, setStatus] = useState(withdrawal?.status || 'pending');
  const [paymentLink, setPaymentLink] = useState(withdrawal?.paymentLink || '');
  const [adminNotes, setAdminNotes] = useState(withdrawal?.adminNotes || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset form fields when modal opens or withdrawal changes
  useEffect(() => {
    if (open && withdrawal) {
      setStatus(withdrawal.status || 'pending');
      setPaymentLink(withdrawal.paymentLink || '');
      setAdminNotes(withdrawal.adminNotes || '');
      setError('');
      setLoading(false);
    }
  }, [open, withdrawal]);

  const handleSubmit = async () => {
    if (!withdrawal) return;

    // Validation
    if (status === 'completed' && !paymentLink.trim()) {
      setError('Payment link is required when marking as completed');
      return;
    }

    if (status === 'rejected' && !adminNotes.trim()) {
      setError('Admin notes are required when rejecting a withdrawal');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const processData = {
        status,
        paymentLink: paymentLink.trim(),
        adminNotes: adminNotes.trim()
      };

      await processWithdrawal(withdrawal._id, processData);
      
      // Reset form
      setError('');
      
      // Notify parent component
      onProcessed?.();
      
      // Close modal
      onClose();
    } catch (error) {
      console.error('Failed to process withdrawal:', error);
      setError(error.message || 'Failed to process withdrawal request');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const formatWithdrawalMonth = (month, year) => {
    if (!month || !year) return 'N/A';
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${monthNames[month - 1]} ${year}`;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <PendingIcon color="warning" />;
      case 'approved':
        return <ApprovedIcon color="info" />;
      case 'completed':
        return <CompletedIcon color="success" />;
      case 'rejected':
        return <CancelIcon color="error" />;
      default:
        return <PendingIcon />;
    }
  };

  const getStatusDescription = (status) => {
    switch (status) {
      case 'pending':
        return 'Awaiting admin review';
      case 'approved':
        return 'Approved for payment processing';
      case 'completed':
        return 'Payment has been sent to agent';
      case 'rejected':
        return 'Withdrawal request was rejected';
      default:
        return '';
    }
  };

  if (!withdrawal) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={2}>
          <WalletIcon color="primary" />
          <Box>
            <Typography variant="h6">
              Process Withdrawal Request
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {withdrawal.agent?.fullName} - {formatCurrency(withdrawal.amount)}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Withdrawal Details */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Withdrawal Details
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <PersonIcon color="primary" fontSize="small" />
                  <Typography variant="body2" color="text.secondary">
                    Agent Information
                  </Typography>
                </Box>
                <Typography variant="body1" fontWeight="medium">
                  {withdrawal.agent?.fullName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {withdrawal.agent?.email}
                </Typography>
                {withdrawal.agent?.fourDigitCode && (
                  <Typography variant="body2" color="text.secondary">
                    Code: {withdrawal.agent.fourDigitCode}
                  </Typography>
                )}
              </Grid>

              <Grid item xs={12} md={6}>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <MoneyIcon color="primary" fontSize="small" />
                  <Typography variant="body2" color="text.secondary">
                    Amount Breakdown
                  </Typography>
                </Box>
                <Typography variant="h6" color="primary">
                  {formatCurrency(withdrawal.amount)}
                </Typography>
                {withdrawal.breakdown && (
                  <Stack spacing={0.5}>
                    <Typography variant="body2" color="text.secondary">
                      Base Pay: {formatCurrency(withdrawal.breakdown.basePay || 0)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Bonuses: {formatCurrency(withdrawal.breakdown.bonuses || 0)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Fines: -{formatCurrency(withdrawal.breakdown.fines || 0)}
                    </Typography>
                  </Stack>
                )}
              </Grid>

              {/* New format: separate ERC20 and TRC20 wallets */}
              {withdrawal.usdtErc20Wallet || withdrawal.usdtTrc20Wallet ? (
                <>
                  <Grid item xs={12} md={6}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <WalletIcon color="primary" fontSize="small" />
                      <Typography variant="body2" color="text.secondary">
                        USDT ERC20 Wallet
                      </Typography>
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{
                        wordBreak: 'break-all',
                        backgroundColor: 'grey.50',
                        p: 1,
                        borderRadius: 1,
                        fontFamily: 'monospace'
                      }}
                    >
                      {withdrawal.usdtErc20Wallet || 'Not provided'}
                    </Typography>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <WalletIcon color="primary" fontSize="small" />
                      <Typography variant="body2" color="text.secondary">
                        USDT TRC20 Wallet
                      </Typography>
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{
                        wordBreak: 'break-all',
                        backgroundColor: 'grey.50',
                        p: 1,
                        borderRadius: 1,
                        fontFamily: 'monospace'
                      }}
                    >
                      {withdrawal.usdtTrc20Wallet || 'Not provided'}
                    </Typography>
                  </Grid>
                </>
              ) : (
                /* Old format: array of wallet addresses - backward compatibility */
                <Grid item xs={12} md={6}>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <WalletIcon color="primary" fontSize="small" />
                    <Typography variant="body2" color="text.secondary">
                      {withdrawal.walletAddresses && withdrawal.walletAddresses.length > 1 ? 'Wallet Addresses' : 'Wallet Address'}
                    </Typography>
                  </Box>
                  {withdrawal.walletAddresses && withdrawal.walletAddresses.length > 0 ? (
                    withdrawal.walletAddresses.map((addr, idx) => (
                      <Typography
                        key={idx}
                        variant="body2"
                        sx={{
                          wordBreak: 'break-all',
                          backgroundColor: 'grey.50',
                          p: 1,
                          borderRadius: 1,
                          fontFamily: 'monospace',
                          mb: 0.5
                        }}
                      >
                        {withdrawal.walletAddresses.length > 1 && `${idx + 1}. `}{addr}
                      </Typography>
                    ))
                  ) : (
                    <Typography
                      variant="body2"
                      sx={{
                        wordBreak: 'break-all',
                        backgroundColor: 'grey.50',
                        p: 1,
                        borderRadius: 1,
                        fontFamily: 'monospace'
                      }}
                    >
                      {withdrawal.walletAddress || 'No wallet address'}
                    </Typography>
                  )}
                </Grid>
              )}

              <Grid item xs={12} md={6}>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <PendingIcon color="primary" fontSize="small" />
                  <Typography variant="body2" color="text.secondary">
                    Current Status
                  </Typography>
                </Box>
                <Chip
                  icon={getStatusIcon(withdrawal.status)}
                  label={getWithdrawalStatusText(withdrawal.status)}
                  color={getWithdrawalStatusColor(withdrawal.status)}
                  size="small"
                />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Requested: {formatDate(withdrawal.createdAt)}
                </Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <Schedule color="primary" fontSize="small" />
                  <Typography variant="body2" color="text.secondary">
                    For Month
                  </Typography>
                </Box>
                <Chip
                  label={formatWithdrawalMonth(withdrawal.withdrawalMonth, withdrawal.withdrawalYear)}
                  color="info"
                  size="medium"
                  sx={{ fontWeight: 'bold' }}
                />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Payment period for this withdrawal
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        <Divider sx={{ mb: 3 }} />

        {/* Processing Form */}
        <Typography variant="h6" gutterBottom>
          Process Withdrawal
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>New Status</InputLabel>
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                label="New Status"
              >
                <MenuItem value="pending">
                  <Box display="flex" alignItems="center" gap={1}>
                    <PendingIcon color="warning" fontSize="small" />
                    Pending Review
                  </Box>
                </MenuItem>
                <MenuItem value="approved">
                  <Box display="flex" alignItems="center" gap={1}>
                    <ApprovedIcon color="info" fontSize="small" />
                    Approved
                  </Box>
                </MenuItem>
                <MenuItem value="completed">
                  <Box display="flex" alignItems="center" gap={1}>
                    <CompletedIcon color="success" fontSize="small" />
                    Completed
                  </Box>
                </MenuItem>
                <MenuItem value="rejected">
                  <Box display="flex" alignItems="center" gap={1}>
                    <CancelIcon color="error" fontSize="small" />
                    Rejected
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              {getStatusDescription(status)}
            </Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Payment Link"
              value={paymentLink}
              onChange={(e) => setPaymentLink(e.target.value)}
              placeholder="https://example.com/payment/123456"
              InputProps={{
                startAdornment: <LinkIcon color="action" sx={{ mr: 1 }} />
              }}
              helperText={status === 'completed' ? 'Required when marking as completed' : 'Optional - Link to payment confirmation'}
              error={status === 'completed' && !paymentLink.trim()}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Admin Notes"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Add any notes about this withdrawal request..."
              helperText={status === 'rejected' ? 'Required when rejecting' : 'Optional - Internal notes about processing'}
              error={status === 'rejected' && !adminNotes.trim()}
            />
          </Grid>
        </Grid>

        {/* Status Change Preview */}
        {status !== withdrawal.status && (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              Status will change from <strong>{getWithdrawalStatusText(withdrawal.status)}</strong> to <strong>{getWithdrawalStatusText(status)}</strong>
            </Typography>
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : <CheckIcon />}
        >
          {loading ? 'Processing...' : 'Process Withdrawal'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProcessWithdrawalModal; 