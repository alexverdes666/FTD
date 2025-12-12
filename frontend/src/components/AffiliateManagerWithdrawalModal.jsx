import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Divider,
  Alert,
  CircularProgress,
  InputAdornment,
  Stack,
} from "@mui/material";
import {
  AccountBalanceWallet as WalletIcon,
  AttachMoney as MoneyIcon,
  CheckCircle as SuccessIcon,
  AccountBalance as SalaryIcon,
  TrendingUp as CommissionIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";
import { useTheme } from "@mui/material/styles";
import { getCompletedWithdrawalsTotal } from "../services/withdrawals";

const AffiliateManagerWithdrawalModal = ({
  open,
  onClose,
  salaryData,
  tableData,
  onWithdrawalRequest,
  user,
}) => {
  const theme = useTheme();
  const [usdtErc20Wallet, setUsdtErc20Wallet] = useState("");
  const [usdtTrc20Wallet, setUsdtTrc20Wallet] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [completedWithdrawals, setCompletedWithdrawals] = useState(0);
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(false);

  // Fetch completed withdrawals when modal opens
  useEffect(() => {
    if (open && user?.id) {
      fetchCompletedWithdrawals();
    }
  }, [open, user?.id]);

  const fetchCompletedWithdrawals = async () => {
    try {
      setWithdrawalsLoading(true);
      console.log(
        "Fetching completed withdrawals for affiliate manager:",
        user.id
      );
      const response = await getCompletedWithdrawalsTotal();
      const totalCompleted = response.data?.totalCompleted || 0;
      setCompletedWithdrawals(totalCompleted);
      console.log(
        "Affiliate manager completed withdrawals total:",
        totalCompleted
      );
    } catch (error) {
      console.error("Error fetching completed withdrawals:", error);
      setCompletedWithdrawals(0);
    } finally {
      setWithdrawalsLoading(false);
    }
  };

  // Calculate total compensation - updated to subtract completed withdrawals
  const calculateTotalCompensation = () => {
    if (!salaryData?.fixedSalary || !tableData?.calculatedTotals) {
      return 0;
    }

    const fixedSalary = Number(salaryData.fixedSalary.amount || 0);
    const commission = tableData.calculatedTotals.profit * 0.1;
    const grossCompensation = fixedSalary + commission;

    // Subtract completed withdrawals to get available balance
    const availableBalance = grossCompensation - completedWithdrawals;

    return Math.max(0, availableBalance); // Ensure we don't return negative values
  };

  const getFixedSalary = () => {
    return Number(salaryData?.fixedSalary?.amount || 0);
  };

  const getCommission = () => {
    return tableData?.calculatedTotals?.profit * 0.1 || 0;
  };

  const getTableProfit = () => {
    return tableData?.calculatedTotals?.profit || 0;
  };

  const totalCompensation = calculateTotalCompensation();
  const fixedSalary = getFixedSalary();
  const commission = getCommission();
  const tableProfit = getTableProfit();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!usdtErc20Wallet.trim() || !usdtTrc20Wallet.trim()) {
      setError("Both USDT ERC20 and USDT TRC20 wallet addresses are required");
      return;
    }

    if (totalCompensation <= 0) {
      setError("No compensation available for withdrawal");
      return;
    }

    setLoading(true);

    try {
      await onWithdrawalRequest({
        usdtErc20Wallet: usdtErc20Wallet.trim(),
        usdtTrc20Wallet: usdtTrc20Wallet.trim(),
        amount: totalCompensation,
        breakdown: {
          fixedSalary,
          commission,
          tableProfit,
          fines: 0,
        },
      });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
        setUsdtErc20Wallet("");
        setUsdtTrc20Wallet("");
      }, 2000);
    } catch (err) {
      setError(err.message || "Failed to submit withdrawal request");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
      setUsdtErc20Wallet("");
      setUsdtTrc20Wallet("");
      setError("");
      setSuccess(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  if (success) {
    return (
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogContent sx={{ textAlign: "center", py: 4 }}>
          <SuccessIcon sx={{ fontSize: 64, color: "success.main", mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            Withdrawal Request Submitted
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Your withdrawal request has been submitted successfully and will be
            processed by the admin.
          </Typography>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: theme.shadows[10],
        },
      }}
    >
      <DialogTitle
        sx={{
          background: `linear-gradient(135deg, ${theme.palette.secondary.main} 0%, ${theme.palette.secondary.dark} 100%)`,
          color: "white",
          textAlign: "center",
          py: 3,
        }}
      >
        <Box display="flex" alignItems="center" justifyContent="center" gap={1}>
          <WalletIcon />
          <Typography variant="h5" fontWeight="bold">
            Request Withdrawal
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Compensation Summary */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {/* Fixed Salary */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ backgroundColor: "#f8f9fa" }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <SalaryIcon color="primary" />
                  <Typography variant="h6" color="primary">
                    Fixed Salary
                  </Typography>
                </Box>
                <Typography variant="h4" fontWeight="bold">
                  {formatCurrency(fixedSalary)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Monthly base salary
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Commission */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ backgroundColor: "#f0f8f0" }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <CommissionIcon color="success" />
                  <Typography variant="h6" color="success.main">
                    Commission (10%)
                  </Typography>
                </Box>
                <Typography variant="h4" fontWeight="bold" color="success.main">
                  {formatCurrency(commission)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  10% of table profit: {formatCurrency(tableProfit)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Previous Withdrawals */}
          {completedWithdrawals > 0 && (
            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ backgroundColor: "#f5f5f5" }}>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <MoneyIcon color="secondary" />
                    <Typography variant="h6" color="secondary">
                      Previous Withdrawals
                    </Typography>
                  </Box>
                  <Typography variant="h4" fontWeight="bold" color="secondary">
                    -{formatCurrency(completedWithdrawals)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Already withdrawn
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>

        <Divider sx={{ my: 2 }} />

        {/* Available for Withdrawal */}
        <Card
          variant="outlined"
          sx={{
            mb: 3,
            background:
              totalCompensation > 0
                ? `linear-gradient(135deg, ${theme.palette.secondary.light} 0%, ${theme.palette.secondary.main} 100%)`
                : `linear-gradient(135deg, ${theme.palette.grey[300]} 0%, ${theme.palette.grey[400]} 100%)`,
            color: "white",
          }}
        >
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Available for Withdrawal
            </Typography>
            <Typography variant="h3" fontWeight="bold">
              {withdrawalsLoading ? (
                <CircularProgress size={32} color="inherit" />
              ) : (
                formatCurrency(totalCompensation)
              )}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              Net available balance after previous withdrawals
            </Typography>
          </CardContent>
        </Card>

        {totalCompensation > 0 && (
          <Box component="form" onSubmit={handleSubmit}>
            <Typography variant="subtitle1" gutterBottom>
              Wallet Addresses (Both Required)
            </Typography>
            <TextField
              fullWidth
              label="USDT ERC20 Wallet Address"
              value={usdtErc20Wallet}
              onChange={(e) => setUsdtErc20Wallet(e.target.value)}
              placeholder="Enter your USDT ERC20 wallet address"
              required
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <WalletIcon />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              label="USDT TRC20 Wallet Address"
              value={usdtTrc20Wallet}
              onChange={(e) => setUsdtTrc20Wallet(e.target.value)}
              placeholder="Enter your USDT TRC20 wallet address"
              required
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <WalletIcon />
                  </InputAdornment>
                ),
              }}
            />

            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                • Both USDT ERC20 and TRC20 wallet addresses are required
                <br />
                • Withdrawal requests require admin approval
                <br />
                • Processing typically takes 1-3 business days
                <br />• You will receive a notification once processed
              </Typography>
            </Alert>
          </Box>
        )}

        {totalCompensation <= 0 && (
          <Alert severity="warning">
            <Typography variant="body2">
              You currently have no compensation available for withdrawal.
              {completedWithdrawals > 0 &&
                " Your previous withdrawals have been deducted from your available balance."}
            </Typography>
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 0 }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        {totalCompensation > 0 && (
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={loading || !usdtErc20Wallet.trim() || !usdtTrc20Wallet.trim()}
            startIcon={
              loading ? <CircularProgress size={20} /> : <WalletIcon />
            }
          >
            {loading
              ? "Submitting..."
              : `Request ${formatCurrency(totalCompensation)}`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default AffiliateManagerWithdrawalModal;
