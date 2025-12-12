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
  Chip,
  Stack,
} from "@mui/material";
import {
  AccountBalanceWallet as WalletIcon,
  AttachMoney as MoneyIcon,
  EmojiEvents as BonusIcon,
  TrendingUp as EarningsIcon,
  Warning as WarningIcon,
  CheckCircle as SuccessIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";
import { useTheme } from "@mui/material/styles";
import { calculateAgentBonuses } from "../services/payroll/calculations";
import { getAgentFines } from "../services/agentFines";
import { getCompletedWithdrawalsTotal, getAgentWithdrawalsByMonth, getCompletedWithdrawalsByMonth, updateWithdrawalWallet } from "../services/withdrawals";

const WithdrawalModal = ({
  open,
  onClose,
  agentData,
  bonusConfig,
  onWithdrawalRequest,
  user,
  selectedMonth, // Add selected month prop
  agentCallsData, // Add agent calls data
  agentBonusesData, // Add agent bonuses data
  agentFinesData, // Add agent fines data
}) => {
  const theme = useTheme();
  const [usdtErc20Wallet, setUsdtErc20Wallet] = useState("");
  const [usdtTrc20Wallet, setUsdtTrc20Wallet] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [agentFines, setAgentFines] = useState([]);
  const [finesLoading, setFinesLoading] = useState(false);
  const [completedWithdrawals, setCompletedWithdrawals] = useState(0);
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(false);
  const [monthWithdrawals, setMonthWithdrawals] = useState([]);
  const [hasPendingWithdrawal, setHasPendingWithdrawal] = useState(false);
  const [editingWithdrawalId, setEditingWithdrawalId] = useState(null);
  const [editUsdtErc20Wallet, setEditUsdtErc20Wallet] = useState("");
  const [editUsdtTrc20Wallet, setEditUsdtTrc20Wallet] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  // Fetch agent fines and completed withdrawals when modal opens
  useEffect(() => {
    if (open && user?.id && selectedMonth) {
      fetchAgentFines();
      fetchCompletedWithdrawals();
      fetchMonthWithdrawals();
    }
  }, [open, user?.id, selectedMonth]);

  const fetchAgentFines = async () => {
    try {
      setFinesLoading(true);
      console.log("Fetching fines for agent:", user.id, "for month:", selectedMonth);
      
      // Extract year and month from selectedMonth (format: "YYYY-MM")
      const [year, month] = selectedMonth ? selectedMonth.split('-').map(Number) : [null, null];
      
      // Fetch month-specific fines instead of all fines
      const finesData = await getAgentFines(user.id, false, year, month);
      console.log("Agent monthly fines data:", finesData);

      // Filter only active fines (not paid, waived, or disputed)
      const activeFines = finesData.filter((fine) => fine.status === "active");
      setAgentFines(activeFines);
    } catch (error) {
      console.error("Error fetching agent fines:", error);
      setAgentFines([]);
    } finally {
      setFinesLoading(false);
    }
  };

  const fetchCompletedWithdrawals = async () => {
    try {
      setWithdrawalsLoading(true);
      if (!selectedMonth) return;
      
      const [year, month] = selectedMonth.split('-').map(Number);
      console.log("Fetching completed withdrawals for agent:", user.id, "month:", year, month);
      
      const response = await getCompletedWithdrawalsByMonth(year, month);
      const totalCompleted = response.data?.totalAmount || 0;
      setCompletedWithdrawals(totalCompleted);
      console.log("Agent completed withdrawals for month:", totalCompleted);
    } catch (error) {
      console.error("Error fetching completed withdrawals:", error);
      setCompletedWithdrawals(0);
    } finally {
      setWithdrawalsLoading(false);
    }
  };

  const fetchMonthWithdrawals = async () => {
    try {
      if (!selectedMonth) return;
      
      const [year, month] = selectedMonth.split('-').map(Number);
      console.log("Fetching withdrawals for agent:", user.id, "month:", year, month);
      
      const response = await getAgentWithdrawalsByMonth(year, month);
      setMonthWithdrawals(response.data || []);
      
      // Check if there's a pending withdrawal for this month
      const pendingWithdrawal = response.data?.find(withdrawal => withdrawal.status === 'pending');
      setHasPendingWithdrawal(!!pendingWithdrawal);
      
      console.log("Agent withdrawals for month:", response.data);
      console.log("Has pending withdrawal:", !!pendingWithdrawal);
    } catch (error) {
      console.error("Error fetching month withdrawals:", error);
      setMonthWithdrawals([]);
      setHasPendingWithdrawal(false);
    }
  };

  // Calculate total earnings - updated to use correct data and subtract completed withdrawals
  const calculateTotalEarnings = () => {
    if (!agentCallsData || !agentBonusesData || !agentFinesData) {
      return 0;
    }

    // If there's a pending withdrawal, return 0 as no new requests can be made
    if (hasPendingWithdrawal) {
      return 0;
    }

    // Calculate talk time pay from agent calls data
    let basePay = 0;
    if (agentCallsData.length > 0) {
      const agentData = agentCallsData[0];
      if (agentData?.totalTalkTime) {
        const parseTimeToSeconds = (timeStr) => {
          if (!timeStr || timeStr === "00:00:00") return 0;
          const [hours, minutes, seconds] = timeStr.split(":").map(Number);
          return hours * 3600 + minutes * 60 + seconds;
        };
        
        const totalSeconds = parseTimeToSeconds(agentData.totalTalkTime);
        const ratePerSecond = 0.00278; // $0.00278 per second
        basePay = totalSeconds * ratePerSecond;
      }
    }

    // Calculate bonuses from agent bonuses data
    let bonuses = 0;
    if (agentBonusesData.length > 0) {
      const agentBonus = agentBonusesData[0];
      if (agentBonus?.callCounts && agentBonus?.bonusRates) {
        const callCounts = agentBonus.callCounts;
        const bonusRates = agentBonus.bonusRates;
        
        bonuses = (callCounts.firstCalls || 0) * (bonusRates.firstCall || 5) +
                  (callCounts.secondCalls || 0) * (bonusRates.secondCall || 10) +
                  (callCounts.thirdCalls || 0) * (bonusRates.thirdCall || 15) +
                  (callCounts.fourthCalls || 0) * (bonusRates.fourthCall || 20) +
                  (callCounts.fifthCalls || 0) * (bonusRates.fifthCall || 25) +
                  (callCounts.verifiedAccounts || 0) * (bonusRates.verifiedAcc || 50);
      }
    }

    // Calculate fines from agent fines data
    const totalActiveFines = agentFinesData.reduce(
      (sum, fine) => sum + (fine.status === 'active' ? fine.amount : 0),
      0
    );

    const grossEarnings = basePay + bonuses - totalActiveFines;

    // Subtract completed withdrawals for this month to get available balance
    const availableBalance = grossEarnings - completedWithdrawals;

    return Math.max(0, availableBalance); // Ensure we don't return negative values
  };

  const getBonusAmount = () => {
    if (!agentBonusesData || agentBonusesData.length === 0) return 0;
    const agentBonus = agentBonusesData[0];
    if (!agentBonus?.callCounts || !agentBonus?.bonusRates) return 0;
    
    const callCounts = agentBonus.callCounts;
    const bonusRates = agentBonus.bonusRates;
    
    return (callCounts.firstCalls || 0) * (bonusRates.firstCall || 5) +
           (callCounts.secondCalls || 0) * (bonusRates.secondCall || 10) +
           (callCounts.thirdCalls || 0) * (bonusRates.thirdCall || 15) +
           (callCounts.fourthCalls || 0) * (bonusRates.fourthCall || 20) +
           (callCounts.fifthCalls || 0) * (bonusRates.fifthCall || 25) +
           (callCounts.verifiedAccounts || 0) * (bonusRates.verifiedAcc || 50);
  };

  const getTotalFines = () => {
    return agentFinesData.reduce((sum, fine) => sum + (fine.status === 'active' ? fine.amount : 0), 0);
  };

  const totalEarnings = calculateTotalEarnings();
  const basePay = (() => {
    if (!agentCallsData || agentCallsData.length === 0) return 0;
    const agentData = agentCallsData[0];
    if (!agentData?.totalTalkTime) return 0;
    const parseTimeToSeconds = (timeStr) => {
      if (!timeStr || timeStr === "00:00:00") return 0;
      const [hours, minutes, seconds] = timeStr.split(":").map(Number);
      return hours * 3600 + minutes * 60 + seconds;
    };
    const totalSeconds = parseTimeToSeconds(agentData.totalTalkTime);
    const ratePerSecond = 0.00278;
    return totalSeconds * ratePerSecond;
  })();
  const bonuses = getBonusAmount();
  const fines = getTotalFines();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!usdtErc20Wallet.trim() || !usdtTrc20Wallet.trim()) {
      setError("Both USDT ERC20 and USDT TRC20 wallet addresses are required");
      return;
    }

    if (totalEarnings <= 0) {
      setError("No earnings available for withdrawal");
      return;
    }

    setLoading(true);

    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      await onWithdrawalRequest({
        usdtErc20Wallet: usdtErc20Wallet.trim(),
        usdtTrc20Wallet: usdtTrc20Wallet.trim(),
        amount: totalEarnings,
        withdrawalMonth: month,
        withdrawalYear: year,
        breakdown: {
          basePay,
          bonuses,
          fines,
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
    if (!loading && !editLoading) {
      onClose();
      setUsdtErc20Wallet("");
      setUsdtTrc20Wallet("");
      setError("");
      setSuccess(false);
      setEditingWithdrawalId(null);
      setEditUsdtErc20Wallet("");
      setEditUsdtTrc20Wallet("");
      setEditError("");
    }
  };

  const handleEditClick = (withdrawal) => {
    setEditingWithdrawalId(withdrawal._id);
    setEditUsdtErc20Wallet(withdrawal.usdtErc20Wallet || "");
    setEditUsdtTrc20Wallet(withdrawal.usdtTrc20Wallet || "");
    setEditError("");
  };

  const handleCancelEdit = () => {
    setEditingWithdrawalId(null);
    setEditUsdtErc20Wallet("");
    setEditUsdtTrc20Wallet("");
    setEditError("");
  };

  const handleSaveEdit = async (withdrawalId) => {
    if (!editUsdtErc20Wallet.trim() || !editUsdtTrc20Wallet.trim()) {
      setEditError("Both USDT ERC20 and USDT TRC20 wallet addresses are required");
      return;
    }

    setEditLoading(true);
    setEditError("");

    try {
      await updateWithdrawalWallet(withdrawalId, editUsdtErc20Wallet.trim(), editUsdtTrc20Wallet.trim());
      
      // Refresh the month withdrawals list
      await fetchMonthWithdrawals();
      
      // Reset edit state
      setEditingWithdrawalId(null);
      setEditUsdtErc20Wallet("");
      setEditUsdtTrc20Wallet("");
      
      // Show success message
      setError("");
    } catch (err) {
      setEditError(err.message || "Failed to update wallet addresses");
    } finally {
      setEditLoading(false);
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
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
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

        {/* Earnings Summary */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {/* Base Pay */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ backgroundColor: "#f8f9fa" }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <EarningsIcon color="primary" />
                  <Typography variant="h6" color="primary">
                    Base Pay
                  </Typography>
                </Box>
                <Typography variant="h4" fontWeight="bold">
                  {formatCurrency(basePay)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Talk time earnings
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Bonuses */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ backgroundColor: "#f0f8f0" }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <BonusIcon color="success" />
                  <Typography variant="h6" color="success.main">
                    Bonuses
                  </Typography>
                </Box>
                <Typography variant="h4" fontWeight="bold" color="success.main">
                  {formatCurrency(bonuses)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Call bonuses earned
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Fines */}
          {fines > 0 && (
            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ backgroundColor: "#fff3f3" }}>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <WarningIcon color="error" />
                    <Typography variant="h6" color="error">
                      Active Fines
                    </Typography>
                  </Box>
                  <Typography variant="h4" fontWeight="bold" color="error">
                    -{formatCurrency(fines)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {agentFines.length} active fine
                    {agentFines.length !== 1 ? "s" : ""}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Completed Withdrawals */}
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

        {/* Previous Withdrawals for this Month */}
        {monthWithdrawals.length > 0 && (
          <>
            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
              Previous Withdrawal Requests for {selectedMonth ? selectedMonth.split('-').map(Number).reverse().join('/') : 'this month'}
            </Typography>
            <Box sx={{ mb: 2 }}>
              {monthWithdrawals.map((withdrawal, index) => (
                <Card key={withdrawal._id || index} variant="outlined" sx={{ mb: 1 }}>
                  <CardContent sx={{ py: 1.5 }}>
                    {editingWithdrawalId === withdrawal._id ? (
                      // Edit mode
                      <Box>
                        <TextField
                          fullWidth
                          label="USDT ERC20 Wallet"
                          value={editUsdtErc20Wallet}
                          onChange={(e) => setEditUsdtErc20Wallet(e.target.value)}
                          size="small"
                          error={!!editError}
                          helperText={editError}
                          disabled={editLoading}
                          required
                          sx={{ mb: 1 }}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <WalletIcon fontSize="small" />
                              </InputAdornment>
                            ),
                          }}
                        />
                        <TextField
                          fullWidth
                          label="USDT TRC20 Wallet"
                          value={editUsdtTrc20Wallet}
                          onChange={(e) => setEditUsdtTrc20Wallet(e.target.value)}
                          size="small"
                          error={!!editError}
                          disabled={editLoading}
                          required
                          sx={{ mb: 1 }}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <WalletIcon fontSize="small" />
                              </InputAdornment>
                            ),
                          }}
                        />
                        <Stack direction="row" spacing={1}>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => handleSaveEdit(withdrawal._id)}
                            disabled={editLoading}
                            startIcon={editLoading ? <CircularProgress size={16} /> : null}
                          >
                            {editLoading ? "Saving..." : "Save"}
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={handleCancelEdit}
                            disabled={editLoading}
                          >
                            Cancel
                          </Button>
                        </Stack>
                      </Box>
                    ) : (
                      // View mode
                      <Box>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                          <Box>
                            <Typography variant="body2" fontWeight="bold">
                              ${withdrawal.amount.toFixed(2)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(withdrawal.createdAt).toLocaleDateString()}
                            </Typography>
                            {withdrawal.withdrawalMonth && withdrawal.withdrawalYear && (
                              <Typography variant="caption" color="primary" display="block" sx={{ fontWeight: 'medium' }}>
                                For: {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][withdrawal.withdrawalMonth - 1]} {withdrawal.withdrawalYear}
                              </Typography>
                            )}
                          </Box>
                          <Stack direction="row" spacing={1} alignItems="center">
                            {withdrawal.status === 'pending' && (
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<EditIcon />}
                                onClick={() => handleEditClick(withdrawal)}
                              >
                                Edit Wallet
                              </Button>
                            )}
                            <Chip
                              label={withdrawal.status}
                              color={
                                withdrawal.status === 'completed' ? 'success' :
                                withdrawal.status === 'approved' ? 'primary' :
                                withdrawal.status === 'rejected' ? 'error' : 'default'
                              }
                              size="small"
                            />
                          </Stack>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary" fontWeight="medium">
                            USDT ERC20:
                          </Typography>
                          <Typography 
                            variant="caption" 
                            color="text.secondary"
                            sx={{ 
                              display: 'block',
                              wordBreak: 'break-all',
                              ml: 1,
                              mb: 0.5
                            }}
                          >
                            {withdrawal.usdtErc20Wallet || 'Not provided'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" fontWeight="medium">
                            USDT TRC20:
                          </Typography>
                          <Typography 
                            variant="caption" 
                            color="text.secondary"
                            sx={{ 
                              display: 'block',
                              wordBreak: 'break-all',
                              ml: 1
                            }}
                          >
                            {withdrawal.usdtTrc20Wallet || 'Not provided'}
                          </Typography>
                        </Box>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Box>
          </>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Available for Withdrawal */}
        <Card
          variant="outlined"
          sx={{
            mb: 3,
            background:
              totalEarnings > 0 && !hasPendingWithdrawal
                ? `linear-gradient(135deg, ${theme.palette.success.light} 0%, ${theme.palette.success.main} 100%)`
                : hasPendingWithdrawal
                ? `linear-gradient(135deg, ${theme.palette.warning.light} 0%, ${theme.palette.warning.main} 100%)`
                : `linear-gradient(135deg, ${theme.palette.grey[300]} 0%, ${theme.palette.grey[400]} 100%)`,
            color: "white",
          }}
        >
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {hasPendingWithdrawal ? "Withdrawal Status" : "Available for Withdrawal"}
            </Typography>
            <Typography variant="h3" fontWeight="bold">
              {withdrawalsLoading ? (
                <CircularProgress size={32} color="inherit" />
              ) : hasPendingWithdrawal ? (
                "Pending Request"
              ) : (
                formatCurrency(totalEarnings)
              )}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              {hasPendingWithdrawal 
                ? "You have a pending withdrawal request for this month"
                : "Net available balance after fines and previous withdrawals"
              }
            </Typography>
          </CardContent>
        </Card>

        {totalEarnings > 0 && !hasPendingWithdrawal && (
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

        {hasPendingWithdrawal && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Pending Withdrawal Request</strong>
              <br />
              You already have a pending withdrawal request for this month. 
              Please wait for it to be processed before submitting a new request.
            </Typography>
          </Alert>
        )}

        {totalEarnings <= 0 && (
          <Alert severity="warning">
            <Typography variant="body2">
              You currently have no earnings available for withdrawal.
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
        {totalEarnings > 0 && !hasPendingWithdrawal && (
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
              : `Request ${formatCurrency(totalEarnings)}`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default WithdrawalModal;
