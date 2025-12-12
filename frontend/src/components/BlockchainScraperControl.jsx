import React, { useState, useEffect, useRef } from 'react';
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
  Divider,
  IconButton,
  Tooltip,
  LinearProgress
} from '@mui/material';
import {
  PlayArrow,
  Refresh,
  CheckCircle,
  Error,
  Pending,
  AccountBalanceWallet,
  TrendingUp,
  Schedule
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import blockchainService from '../services/blockchain';

const BlockchainScraperControl = () => {
  const [scraperStatus, setScraperStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [summary, setSummary] = useState(null);
  const [progress, setProgress] = useState(null);
  
  const pollingIntervalRef = useRef(null);
  
  const { user } = useSelector((state) => state.auth);

  useEffect(() => {
    fetchScraperStatus();
    fetchSummary();
    
    // Cleanup polling on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const fetchScraperStatus = async () => {
    try {
      const response = await blockchainService.getScraperStatus();
      setScraperStatus(response.data);
    } catch (error) {
      console.error('Error fetching scraper status:', error);
      setError('Failed to fetch scraper status');
    }
  };

  const fetchSummary = async () => {
    try {
      const response = await blockchainService.getOverallSummary();
      setSummary(response.data);
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  };

  const pollScraperStatus = async () => {
    try {
      const response = await blockchainService.getScraperStatus();
      const status = response.data;
      setScraperStatus(status);
      
      if (!status.overall) {
        return;
      }

      const { state, progress: overallProgress, currentNetwork, networksProcessed, totalNetworks, lastResults, error: scraperError } = status.overall;

      // Update progress display
      setProgress({
        state,
        progress: overallProgress || 0,
        currentNetwork,
        networksProcessed,
        totalNetworks
      });

      // Check if scraping completed
      if (state === 'completed') {
        // Stop polling
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        
        setIsLoading(false);
        setProgress(null);
        
        if (lastResults) {
          const { newTransactions, totalUsdValue } = lastResults.summary;
          const valueText = totalUsdValue ? ` with total value $${totalUsdValue.toFixed(2)}` : '';
          setSuccess(`Scrapers completed successfully! Found ${newTransactions} new transactions${valueText}.`);
          await fetchSummary();
        }
      } else if (state === 'failed') {
        // Stop polling
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        
        setIsLoading(false);
        setProgress(null);
        setError(scraperError || 'Scrapers failed');
      }
    } catch (error) {
      console.error('Error polling scraper status:', error);
    }
  };

  const handleTriggerScrapers = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    setProgress(null);

    try {
      // Trigger scrapers (returns immediately with 202 status)
      await blockchainService.triggerScrapers();
      
      // Start polling for status updates
      pollingIntervalRef.current = setInterval(pollScraperStatus, 2000); // Poll every 2 seconds
      
      // Do initial poll immediately
      pollScraperStatus();
      
    } catch (error) {
      console.error('Error triggering scrapers:', error);
      setError(error.response?.data?.message || 'Failed to trigger scrapers');
      setIsLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'running':
        return 'warning';
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'running':
        return <Pending />;
      case 'completed':
        return <CheckCircle />;
      case 'failed':
        return <Error />;
      default:
        return <Schedule />;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const formatCurrency = (amount) => {
    if (!amount) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const canTriggerScrapers = user?.role === 'admin' || user?.role === 'affiliate_manager';

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <AccountBalanceWallet />
          <Typography variant="h6">Blockchain Scrapers</Typography>
          <Box sx={{ ml: 'auto' }}>
            <Tooltip title="Refresh Status">
              <IconButton onClick={fetchScraperStatus} disabled={isLoading}>
                <Refresh />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

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

        <Grid container spacing={3}>
          {/* Control Panel */}
          <Grid item xs={12} md={6}>
            <Box sx={{ mb: 3 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleTriggerScrapers}
                disabled={isLoading || !canTriggerScrapers || scraperStatus?.isRunning}
                startIcon={isLoading ? <CircularProgress size={20} /> : <PlayArrow />}
                fullWidth
                sx={{ mb: 2 }}
              >
                {isLoading ? 'Running Scrapers...' : 'Run All Scrapers'}
              </Button>

              {/* Progress indicator */}
              {progress && isLoading && (
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {progress.currentNetwork ? `Processing: ${progress.currentNetwork}` : 'Starting...'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {progress.networksProcessed || 0}/{progress.totalNetworks || 0} ({progress.progress || 0}%)
                    </Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={progress.progress || 0}
                    sx={{ height: 8, borderRadius: 1 }}
                  />
                </Box>
              )}

              {!canTriggerScrapers && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  You need admin or affiliate manager permissions to trigger scrapers.
                </Alert>
              )}
            </Box>

            <Typography variant="subtitle1" gutterBottom>
              Scraper Status
            </Typography>

            {scraperStatus && (
              <Box sx={{ mb: 2 }}>
                <Grid container spacing={1}>
                  <Grid item xs={4}>
                    <Chip
                      label={`BTC: ${scraperStatus.status.bitcoin}`}
                      color={getStatusColor(scraperStatus.status.bitcoin)}
                      icon={getStatusIcon(scraperStatus.status.bitcoin)}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <Chip
                      label={`ETH: ${scraperStatus.status.ethereum}`}
                      color={getStatusColor(scraperStatus.status.ethereum)}
                      icon={getStatusIcon(scraperStatus.status.ethereum)}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <Chip
                      label={`TRON: ${scraperStatus.status.tron}`}
                      color={getStatusColor(scraperStatus.status.tron)}
                      icon={getStatusIcon(scraperStatus.status.tron)}
                      size="small"
                    />
                  </Grid>
                </Grid>
              </Box>
            )}
          </Grid>

          {/* Summary Stats */}
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <TrendingUp />
              <Typography variant="subtitle1">
                Summary (Last 30 Days)
              </Typography>
            </Box>

            {summary ? (
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                    <Typography variant="h4" color="primary">
                      {summary.summary.totalTransactions || 0}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Transactions
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                    <Typography variant="h4" color="success.main">
                      {formatCurrency(summary.summary.totalUsdValue)}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Total Value
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            ) : (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            )}
          </Grid>

          {/* Last Scrape Times */}
          <Grid item xs={12}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="subtitle1" gutterBottom>
              Last Scrape Times
            </Typography>
            {scraperStatus && (
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Bitcoin
                    </Typography>
                    <Typography variant="body2">
                      {formatDate(scraperStatus.lastScrapeTime.bitcoin)}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Ethereum
                    </Typography>
                    <Typography variant="body2">
                      {formatDate(scraperStatus.lastScrapeTime.ethereum)}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                    <Typography variant="subtitle2" color="textSecondary">
                      TRON
                    </Typography>
                    <Typography variant="body2">
                      {formatDate(scraperStatus.lastScrapeTime.tron)}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            )}
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default BlockchainScraperControl; 