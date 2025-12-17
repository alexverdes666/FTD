import React, { useState, useEffect, useRef } from 'react';
import {
  IconButton,
  Box,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Button,
  Chip,
  Divider,
  LinearProgress,
  Tooltip
} from '@mui/material';
import {
  CheckCircle,
  Error as ErrorIcon,
  Pending,
  Refresh,
  AccountBalanceWallet,
  Close,
  Rocket as RocketIcon
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import blockchainService from '../services/blockchain';

const AllNetworksScraperButton = ({ variant = 'contained', size = 'medium', onComplete }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showResultsDialog, setShowResultsDialog] = useState(false);
  const [results, setResults] = useState(null);
  const [progress, setProgress] = useState(null);
  
  const pollingIntervalRef = useRef(null);
  
  const { user } = useSelector((state) => state.auth);
  const canTriggerScrapers = user?.role === 'admin' || user?.role === 'affiliate_manager';

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const pollScraperStatus = async () => {
    try {
      const response = await blockchainService.getScraperStatus();
      const status = response.data;
      
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
          setResults(lastResults);
          setSuccess(`Scrapers completed successfully! Found ${lastResults.summary.newTransactions} new transactions with total value $${lastResults.summary.totalUsdValue}`);
          setShowResultsDialog(true);
          
          // Call onComplete callback if provided
          if (onComplete) {
            onComplete(lastResults);
          }

          // Auto close dialog after 3 seconds
          setTimeout(() => {
            setShowResultsDialog(false);
          }, 3000);
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

  const handleTriggerAllScrapers = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    setResults(null);
    setProgress(null);

    try {
      // Trigger scrapers (returns immediately with 202 status)
      const response = await blockchainService.triggerScrapers();
      
      // Start polling for status updates
      pollingIntervalRef.current = setInterval(pollScraperStatus, 2000); // Poll every 2 seconds
      
      // Do initial poll immediately
      pollScraperStatus();
      
    } catch (error) {
      console.error('Error triggering all scrapers:', error);
      const errorMsg = error.response?.data?.message || 'Failed to trigger scrapers';
      setError(errorMsg);
      setIsLoading(false);
      
      // Show conflict error in dialog if scrapers are already running
      if (error.response?.status === 409) {
        setResults({
          error: errorMsg,
          status: error.response.data.data
        });
        setShowResultsDialog(true);
      }
    }
  };

  const handleCloseDialog = () => {
    setShowResultsDialog(false);
  };

  const formatCurrency = (amount) => {
    if (!amount) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getBlockchainIcon = (blockchain) => {
    const colors = {
      bitcoin: '#f7931a',
      ethereum: '#627eea',
      tron: '#eb0029'
    };
    return <AccountBalanceWallet sx={{ color: colors[blockchain] || 'inherit' }} />;
  };

  return (
    <>
      <Box>
        <Tooltip title={isLoading ? "Running Scrapers..." : "Run All Scrapers"}>
          <span>
            <IconButton
              size={size === "medium" ? "medium" : "small"}
              onClick={handleTriggerAllScrapers}
              disabled={isLoading || !canTriggerScrapers}
              color="success"
              sx={{
                ...(variant === 'contained' && {
                  bgcolor: 'success.main',
                  color: 'white',
                  '&:hover': {
                    bgcolor: 'success.dark',
                  },
                  '&.Mui-disabled': {
                     bgcolor: 'action.disabledBackground',
                     color: 'action.disabled'
                  }
                })
              }}
            >
              {isLoading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                <RocketIcon />
              )}
            </IconButton>
          </span>
        </Tooltip>

        {/* Progress indicator */}
        {progress && isLoading && (
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {progress.currentNetwork ? `Processing: ${progress.currentNetwork}` : 'Starting...'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {progress.networksProcessed || 0}/{progress.totalNetworks || 0} networks ({progress.progress || 0}%)
              </Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={progress.progress || 0}
              sx={{ height: 8, borderRadius: 1 }}
            />
          </Box>
        )}

        {/* Error message */}
        {error && !showResultsDialog && (
          <Alert 
            severity="error" 
            sx={{ mt: 2 }} 
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}

        {/* Success message */}
        {success && !showResultsDialog && (
          <Alert 
            severity="success" 
            sx={{ mt: 2 }} 
            onClose={() => setSuccess(null)}
          >
            {success}
          </Alert>
        )}

        {/* Permission warning */}
        {!canTriggerScrapers && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            You need admin or affiliate manager permissions to trigger scrapers.
          </Alert>
        )}
      </Box>

      {/* Results Dialog */}
      <Dialog 
        open={showResultsDialog} 
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {results?.error ? (
              <ErrorIcon color="error" />
            ) : (
              <CheckCircle color="success" />
            )}
            <Typography variant="h6">
              {results?.error ? 'Scraper Status' : 'Scraper Results'}
            </Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent dividers>
          {results?.error ? (
            // Show error state
            <Box>
              <Alert severity="error" sx={{ mb: 2 }}>
                {results.error}
              </Alert>
              
              {results.status && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Current Scraper Status:
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemIcon>
                        <Pending />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Bitcoin" 
                        secondary={results.status.bitcoin || 'idle'}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <Pending />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Ethereum" 
                        secondary={results.status.ethereum || 'idle'}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <Pending />
                      </ListItemIcon>
                      <ListItemText 
                        primary="TRON" 
                        secondary={results.status.tron || 'idle'}
                      />
                    </ListItem>
                  </List>
                </Box>
              )}
            </Box>
          ) : results && (
            // Show success results
            <Box>
              <Alert severity="success" sx={{ mb: 3 }}>
                Successfully scraped all networks!
              </Alert>

              {/* Summary Statistics */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Overall Summary
                </Typography>
                <Box sx={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 2,
                  mb: 2 
                }}>
                  <Box sx={{ 
                    p: 2, 
                    bgcolor: 'primary.light', 
                    color: 'primary.contrastText',
                    borderRadius: 2,
                    textAlign: 'center'
                  }}>
                    <Typography variant="h4">
                      {results.summary.networksScraped}
                    </Typography>
                    <Typography variant="body2">
                      Networks Scraped
                    </Typography>
                  </Box>
                  
                  <Box sx={{ 
                    p: 2, 
                    bgcolor: 'success.light', 
                    color: 'success.contrastText',
                    borderRadius: 2,
                    textAlign: 'center'
                  }}>
                    <Typography variant="h4">
                      {results.summary.newTransactions}
                    </Typography>
                    <Typography variant="body2">
                      New Transactions
                    </Typography>
                  </Box>
                  
                  <Box sx={{ 
                    p: 2, 
                    bgcolor: 'success.dark', 
                    color: 'success.contrastText',
                    borderRadius: 2,
                    textAlign: 'center'
                  }}>
                    <Typography variant="h4">
                      {formatCurrency(results.summary.totalUsdValue)}
                    </Typography>
                    <Typography variant="body2">
                      Total Value
                    </Typography>
                  </Box>
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Breakdown by Blockchain */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Breakdown by Blockchain
                </Typography>
                <List>
                  {Object.entries(results.summary.breakdown).map(([blockchain, data]) => (
                    <ListItem 
                      key={blockchain}
                      sx={{ 
                        mb: 1,
                        bgcolor: 'background.default',
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider'
                      }}
                    >
                      <ListItemIcon>
                        {getBlockchainIcon(blockchain)}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="subtitle1" sx={{ textTransform: 'capitalize' }}>
                              {blockchain}
                            </Typography>
                            <Chip 
                              size="small" 
                              label={`${data.count} txns`}
                              color="primary"
                            />
                          </Box>
                        }
                        secondary={
                          <Typography variant="body2" color="success.main" sx={{ fontWeight: 'bold' }}>
                            {formatCurrency(data.totalUsdValue)}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>

              {/* Recent Transactions Preview */}
              {results.recentTransactions && results.recentTransactions.length > 0 && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Recent Transactions ({results.recentTransactions.length})
                  </Typography>
                  <List dense>
                    {results.recentTransactions.slice(0, 5).map((tx, index) => (
                      <ListItem 
                        key={index}
                        sx={{ 
                          bgcolor: 'background.default',
                          borderRadius: 1,
                          mb: 0.5
                        }}
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2">
                                {tx.tokenSymbol}
                              </Typography>
                              <Chip 
                                size="small" 
                                label={tx.blockchain}
                                sx={{ textTransform: 'capitalize' }}
                              />
                            </Box>
                          }
                          secondary={
                            <Typography variant="caption">
                              {tx.amount} {tx.tokenSymbol} • {formatCurrency(tx.usdValue)} • {tx.networkName}
                            </Typography>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={handleCloseDialog} startIcon={<Close />}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AllNetworksScraperButton;

