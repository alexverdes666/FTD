import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  Collapse,
  IconButton,
  Tooltip,
  Divider
} from '@mui/material';
import {
  PlayArrow,
  Refresh,
  CheckCircle,
  Error,
  Pending,
  AccountBalanceWallet,
  TrendingUp,
  ExpandMore,
  ExpandLess,
  AttachMoney,
  Token
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import blockchainService from '../services/blockchain';

const NetworkBlockchainControl = ({ network, useMonthFilter = false, selectedMonth = null }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [summary, setSummary] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  
  const { user } = useSelector((state) => state.auth);

  const cryptoWallets = network.cryptoWallets || {};
  const hasWallets = cryptoWallets.bitcoin || cryptoWallets.ethereum || cryptoWallets.tron;

  useEffect(() => {
    if (expanded && hasWallets) {
      fetchSummary();
    }
  }, [expanded, hasWallets, network._id, useMonthFilter, selectedMonth]);

  const fetchSummary = async () => {
    if (!hasWallets) return;
    
    setLoadingSummary(true);
    try {
      let response;
      if (useMonthFilter && selectedMonth) {
        response = await blockchainService.getNetworkSummary(
          network._id, 
          0, // days not used when month filter is active
          selectedMonth.month(),
          selectedMonth.year()
        );
      } else {
        response = await blockchainService.getNetworkSummary(network._id, 0); // 0 = all time
      }
      setSummary(response.data);
    } catch (error) {
      console.error('Error fetching network summary:', error);
    } finally {
      setLoadingSummary(false);
    }
  };



  const handleTriggerScrapers = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await blockchainService.triggerNetworkScrapers(network._id);
      const { newTransactions, totalUsdValue, breakdown } = response.data.summary;
      const valueText = totalUsdValue ? ` with total value $${totalUsdValue.toFixed(2)}` : '';
      setSuccess(`Scrapers completed for ${network.name}! Found ${newTransactions} new transactions${valueText}.`);
      
      // Update summary immediately with fresh data from scraper response
      if (expanded) {
        const freshSummary = {
          networkId: network._id,
          networkName: network.name,
          totalTransactions: (summary?.totalTransactions || 0) + newTransactions,
          totalUsdValue: (summary?.totalUsdValue || 0) + totalUsdValue,
          breakdown: {
            bitcoin: {
              count: (summary?.breakdown?.bitcoin?.count || 0) + (breakdown?.bitcoin?.count || 0),
              totalUsdValue: (summary?.breakdown?.bitcoin?.totalUsdValue || 0) + (breakdown?.bitcoin?.totalUsdValue || 0),
              walletAddress: network.cryptoWallets?.bitcoin || null
            },
            ethereum: {
              count: (summary?.breakdown?.ethereum?.count || 0) + (breakdown?.ethereum?.count || 0),
              totalUsdValue: (summary?.breakdown?.ethereum?.totalUsdValue || 0) + (breakdown?.ethereum?.totalUsdValue || 0),
              walletAddress: network.cryptoWallets?.ethereum || null
            },
            tron: {
              count: (summary?.breakdown?.tron?.count || 0) + (breakdown?.tron?.count || 0),
              totalUsdValue: (summary?.breakdown?.tron?.totalUsdValue || 0) + (breakdown?.tron?.totalUsdValue || 0),
              walletAddress: network.cryptoWallets?.tron || null
            }
          },
          recentTransactions: summary?.recentTransactions || []
        };
        setSummary(freshSummary);
        
        // Fetch full summary after a short delay to get recent transactions and accurate totals
        setTimeout(() => {
          fetchSummary(); // Get all transactions to show correct total
        }, 2000);
      }
    } catch (error) {
      console.error('Error triggering network scrapers:', error);
      setError(error.response?.data?.message || 'Failed to trigger scrapers');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatAddress = (address) => {
    if (!address) return 'Not configured';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getBlockchainIcon = (blockchain) => {
    switch (blockchain) {
      case 'bitcoin':
        return <Token sx={{ color: '#f7931a' }} />;
      case 'ethereum':
        return <Token sx={{ color: '#627eea' }} />;
      case 'tron':
        return <Token sx={{ color: '#eb0029' }} />;
      default:
        return <Token />;
    }
  };

  const canTriggerScrapers = user?.role === 'admin' || user?.role === 'affiliate_manager';

  if (!hasWallets) {
    return (
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <AccountBalanceWallet sx={{ color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary">
              No blockchain wallets configured for this network
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <AccountBalanceWallet />
          <Typography variant="h6">Blockchain Wallets</Typography>
          <Box sx={{ ml: 'auto' }}>
            <Tooltip title={expanded ? 'Collapse' : 'Expand'}>
              <IconButton onClick={() => setExpanded(!expanded)}>
                {expanded ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Wallet addresses summary */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          {cryptoWallets.bitcoin && (
            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {getBlockchainIcon('bitcoin')}
                <Typography variant="body2" color="text.secondary">
                  BTC: {formatAddress(cryptoWallets.bitcoin)}
                </Typography>
              </Box>
            </Grid>
          )}
          {cryptoWallets.ethereum && (
            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {getBlockchainIcon('ethereum')}
                <Typography variant="body2" color="text.secondary">
                  ETH: {formatAddress(cryptoWallets.ethereum)}
                </Typography>
              </Box>
            </Grid>
          )}
          {cryptoWallets.tron && (
            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {getBlockchainIcon('tron')}
                <Typography variant="body2" color="text.secondary">
                  TRX: {formatAddress(cryptoWallets.tron)}
                </Typography>
              </Box>
            </Grid>
          )}
        </Grid>

        {/* Control buttons */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <Button
            variant="contained"
            size="small"
            onClick={handleTriggerScrapers}
            disabled={isLoading || !canTriggerScrapers}
            startIcon={isLoading ? <CircularProgress size={16} /> : <PlayArrow />}
          >
            {isLoading ? 'Scraping...' : 'Run Scrapers'}
          </Button>
          
          {expanded && (
            <Button
              variant="outlined"
              size="small"
              onClick={fetchSummary}
              disabled={loadingSummary}
              startIcon={loadingSummary ? <CircularProgress size={16} /> : <Refresh />}
            >
              Refresh
            </Button>
          )}
        </Box>

        {/* Error and success messages */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {!canTriggerScrapers && (
          <Alert severity="info" sx={{ mb: 2 }}>
            You need admin or affiliate manager permissions to trigger scrapers.
          </Alert>
        )}

        {/* Expanded details */}
        <Collapse in={expanded}>
          <Divider sx={{ mb: 2 }} />
          
          {loadingSummary ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress />
            </Box>
          ) : summary ? (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <TrendingUp />
                <Typography variant="subtitle1">
                  Network Summary (All Transactions)
                </Typography>
              </Box>

              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={6}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                    <Typography variant="h5" color="primary">
                      {summary.totalTransactions || 0}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Transactions
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                    <Typography variant="h5" color="success.main">
                      {formatCurrency(summary.totalUsdValue)}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Total Value
                    </Typography>
                  </Box>
                </Grid>
              </Grid>

              {/* Breakdown by blockchain */}
              <Typography variant="subtitle2" gutterBottom>
                Breakdown by Blockchain
              </Typography>
              <Grid container spacing={1}>
                {Object.entries(summary.breakdown).map(([blockchain, data]) => (
                  data.walletAddress && (
                    <Grid item xs={12} md={4} key={blockchain}>
                      <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          {getBlockchainIcon(blockchain)}
                          <Typography variant="subtitle2" sx={{ textTransform: 'capitalize' }}>
                            {blockchain}
                          </Typography>
                        </Box>
                        <Typography variant="body2" color="textSecondary">
                          {data.count} transactions
                        </Typography>
                        <Typography variant="body2" color="success.main">
                          {formatCurrency(data.totalUsdValue)}
                        </Typography>
                      </Box>
                    </Grid>
                  )
                ))}
              </Grid>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No data available. Run scrapers to collect blockchain data.
            </Typography>
          )}
        </Collapse>
      </CardContent>
    </Card>
  );
};

export default NetworkBlockchainControl; 