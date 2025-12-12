const express = require('express');
const { protect } = require('../middleware/auth');
const BlockchainScraperService = require('../services/blockchainScraperService');

const router = express.Router();

// Get blockchain scraper service instance
const getBlockchainScraperService = () => {
  return BlockchainScraperService.getInstance();
};

/**
 * GET /api/blockchain/status
 * Get current scraper status
 */
router.get('/status', protect, async (req, res) => {
  try {
    const service = getBlockchainScraperService();
    const status = service.getScraperStatus();
    
    res.status(200).json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error getting blockchain scraper status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get scraper status',
      error: error.message
    });
  }
});

/**
 * POST /api/blockchain/scrape
 * Trigger blockchain scrapers for all networks
 */
router.post('/scrape', protect, async (req, res) => {
  try {
    // Only admins and affiliate managers can trigger scrapers
    if (req.user.role !== 'admin' && req.user.role !== 'affiliate_manager') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin or affiliate manager role required.'
      });
    }

    const service = getBlockchainScraperService();
    console.log(`🔗 Blockchain scraper triggered by user: ${req.user.email}`);

    // Check if scrapers are already running
    const currentStatus = service.getScraperStatus();
    if (currentStatus.isRunning) {
      return res.status(409).json({
        success: false,
        message: 'Scrapers are already running. Please wait for completion.',
        data: currentStatus
      });
    }

    // Start scrapers asynchronously (returns immediately)
    const response = service.startAllScrapersAsync();

    res.status(202).json({
      success: true,
      message: 'Blockchain scrapers started successfully. Poll /api/blockchain/status for progress.',
      data: response.status
    });
  } catch (error) {
    console.error('Error triggering blockchain scrapers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger blockchain scrapers',
      error: error.message
    });
  }
});

/**
 * GET /api/blockchain/transactions
 * Get recent transactions from all networks
 */
router.get('/transactions', protect, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const service = getBlockchainScraperService();
    
    const transactions = await service.getRecentTransactions(limit);
    
    res.status(200).json({
      success: true,
      data: {
        transactions,
        count: transactions.length,
        limit
      }
    });
  } catch (error) {
    console.error('Error fetching blockchain transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blockchain transactions',
      error: error.message
    });
  }
});

/**
 * GET /api/blockchain/summary
 * Get overall summary statistics for all networks
 */
router.get('/summary', protect, async (req, res) => {
  try {
    const days = req.query.days !== undefined ? parseInt(req.query.days) : 30;
    const month = req.query.month !== undefined ? parseInt(req.query.month) : null;
    const year = req.query.year !== undefined ? parseInt(req.query.year) : null;
    const service = getBlockchainScraperService();
    
    const summary = await service.getOverallSummary(days, month, year);
    
    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error fetching overall summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch overall summary',
      error: error.message
    });
  }
});

/**
 * POST /api/blockchain/scrape/:networkId
 * Trigger blockchain scrapers for a specific network
 */
router.post('/scrape/:networkId', protect, async (req, res) => {
  try {
    const { networkId } = req.params;
    
    // Only admins and affiliate managers can trigger scrapers
    if (req.user.role !== 'admin' && req.user.role !== 'affiliate_manager') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin or affiliate manager role required.'
      });
    }

    // For affiliate managers, check if they have access to this network
    if (req.user.role === 'affiliate_manager') {
      const OurNetwork = require('../models/OurNetwork');
      const network = await OurNetwork.findOne({
        _id: networkId,
        assignedAffiliateManager: req.user._id,
        isActive: true
      });
      
      if (!network) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Network not assigned to you or inactive.'
        });
      }
    }

    const service = getBlockchainScraperService();
    console.log(`🔗 Network ${networkId} blockchain scraper triggered by user: ${req.user.email}`);

    // Run network-specific scrapers
    const results = await service.runNetworkScrapers(networkId);

    res.status(200).json({
      success: true,
      message: `Blockchain scrapers completed successfully for network ${results.summary.networkName}`,
      data: results
    });
  } catch (error) {
    console.error('Error triggering network blockchain scrapers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger network blockchain scrapers',
      error: error.message
    });
  }
});

/**
 * GET /api/blockchain/networks/:networkId/summary
 * Get network-specific blockchain summary
 */
router.get('/networks/:networkId/summary', protect, async (req, res) => {
  try {
    const { networkId } = req.params;
    const days = req.query.days !== undefined ? parseInt(req.query.days) : 30;
    const month = req.query.month !== undefined ? parseInt(req.query.month) : null;
    const year = req.query.year !== undefined ? parseInt(req.query.year) : null;
    
    // For affiliate managers, check if they have access to this network
    if (req.user.role === 'affiliate_manager') {
      const OurNetwork = require('../models/OurNetwork');
      const network = await OurNetwork.findOne({
        _id: networkId,
        assignedAffiliateManager: req.user._id,
        isActive: true
      });
      
      if (!network) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Network not assigned to you or inactive.'
        });
      }
    }

    const service = getBlockchainScraperService();
    const summary = await service.getNetworkSummary(networkId, days, month, year);
    
    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error fetching network summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch network summary',
      error: error.message
    });
  }
});

/**
 * POST /api/blockchain/test-ethereum/:address
 * Test Ethereum scraper for a specific address (debug endpoint)
 */
router.post('/test-ethereum/:address', protect, async (req, res) => {
  try {
    // Only admins can access this debug endpoint
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required for test endpoints.'
      });
    }

    const { address } = req.params;
    const { apiKey } = req.body;
    
    const service = getBlockchainScraperService();
    console.log(`🧪 Testing Ethereum scraper for address: ${address}`);
    
    // Test the scraper directly
    const ethResult = await service.runScraper('eth_scraper.py', address, [apiKey || process.env.ETHERSCAN_API_KEY || '1MBFZQA78GEHK1SV9M3WGKK39K9IS26ANX']);
    
    // Test conversion
    const ethTransactions = service.convertToBlockchainTransaction(ethResult, 'test-network-id', 'Test Network', 'ethereum');
    
    res.status(200).json({
      success: true,
      data: {
        scraperResult: ethResult,
        convertedTransactions: ethTransactions,
        totalTransactions: ethTransactions.length
      }
    });
  } catch (error) {
    console.error('Error testing Ethereum scraper:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test Ethereum scraper',
      error: error.message
    });
  }
});

/**
 * GET /api/blockchain/networks/:networkId/transactions
 * Get transactions for a specific network with advanced filtering
 */
router.get('/networks/:networkId/transactions', protect, async (req, res) => {
  try {
    const { networkId } = req.params;
    const {
      limit = 50,
      page = 1,
      startDate,
      endDate,
      blockchain,
      transferType = 'incoming',
      minAmount,
      maxAmount,
      tokenSymbol,
      searchHash,
      sortBy = 'timestamp',
      sortOrder = 'desc'
    } = req.query;
    
    // For affiliate managers, check if they have access to this network
    if (req.user.role === 'affiliate_manager') {
      const OurNetwork = require('../models/OurNetwork');
      const network = await OurNetwork.findOne({
        _id: networkId,
        assignedAffiliateManager: req.user._id,
        isActive: true
      });
      
      if (!network) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Network not assigned to you or inactive.'
        });
      }
    }

    const BlockchainTransaction = require('../models/BlockchainTransaction');
    
    // Build query
    let query = { network: networkId };
    
    // Transfer type filter
    if (transferType) {
      query.transferType = transferType;
    }
    
    // Date range filter
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        query.timestamp.$lte = new Date(endDate);
      }
    }
    
    // Blockchain filter
    if (blockchain) {
      query.blockchain = blockchain;
    }
    
    // Amount range filter
    if (minAmount || maxAmount) {
      query.amount = {};
      if (minAmount) {
        query.amount.$gte = parseFloat(minAmount);
      }
      if (maxAmount) {
        query.amount.$lte = parseFloat(maxAmount);
      }
    }
    
    // Token symbol filter
    if (tokenSymbol) {
      query['token.symbol'] = { $regex: tokenSymbol, $options: 'i' };
    }
    
    // Transaction hash search
    if (searchHash) {
      query.transactionHash = { $regex: searchHash, $options: 'i' };
    }
    
    // Build sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // Calculate pagination
    const limitNum = parseInt(limit);
    const pageNum = parseInt(page);
    const skip = (pageNum - 1) * limitNum;
    
    // Get total count for pagination
    const totalCount = await BlockchainTransaction.countDocuments(query);
    
    // Execute query with pagination
    const transactions = await BlockchainTransaction.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .populate('network', 'name');
    
    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;
    
    res.status(200).json({
      success: true,
      data: {
        transactions,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalCount,
          hasNextPage,
          hasPrevPage,
          limit: limitNum
        },
        filters: {
          startDate,
          endDate,
          blockchain,
          transferType,
          minAmount,
          maxAmount,
          tokenSymbol,
          searchHash,
          sortBy,
          sortOrder
        },
        networkId
      }
    });
  } catch (error) {
    console.error('Error fetching network transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch network transactions',
      error: error.message
    });
  }
});

module.exports = router; 