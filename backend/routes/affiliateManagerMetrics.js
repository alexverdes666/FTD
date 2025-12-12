const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const affiliateManagerMetricsController = require('../controllers/affiliateManagerMetrics');
const { protect, isAdmin, isManager } = require('../middleware/auth');

// Validation rules
const metricsValidation = [
  body('date').optional().isISO8601().withMessage('Valid date is required'),
  body('period').optional().isIn(['daily', 'weekly', 'monthly']).withMessage('Valid period is required'),
  body('totalRevenue').optional().isNumeric().withMessage('Total revenue must be numeric'),
  body('ordersCompleted').optional().isInt({ min: 0 }).withMessage('Orders completed must be a non-negative integer'),
  body('ordersCreated').optional().isInt({ min: 0 }).withMessage('Orders created must be a non-negative integer'),
  body('leadsManaged').optional().isInt({ min: 0 }).withMessage('Leads managed must be a non-negative integer'),
  body('leadsConverted').optional().isInt({ min: 0 }).withMessage('Leads converted must be a non-negative integer'),
  body('networkPerformance').optional().isNumeric().withMessage('Network performance must be numeric'),
  body('campaignSuccess').optional().isNumeric().withMessage('Campaign success must be numeric'),
  body('qualityScore').optional().isFloat({ min: 0, max: 100 }).withMessage('Quality score must be between 0 and 100'),
  body('clientSatisfaction').optional().isFloat({ min: 0, max: 10 }).withMessage('Client satisfaction must be between 0 and 10'),
  body('notes').optional().isString().withMessage('Notes must be a string')
];

// Routes

// Get all affiliate managers with metrics (Admin only)
router.get('/all', protect, isAdmin, affiliateManagerMetricsController.getAllAffiliateManagersWithMetrics);

// Get affiliate manager metrics
router.get('/:affiliateManagerId', protect, isManager, affiliateManagerMetricsController.getAffiliateManagerMetrics);

// Get aggregated metrics for affiliate manager
router.get('/:affiliateManagerId/aggregated', protect, isManager, affiliateManagerMetricsController.getAggregatedMetrics);

// Calculate and store affiliate manager metrics
router.post('/:affiliateManagerId/calculate', protect, isAdmin, metricsValidation, affiliateManagerMetricsController.calculateAndStoreMetrics);

// Update affiliate manager metrics
router.put('/:metricsId', protect, isAdmin, metricsValidation, affiliateManagerMetricsController.updateAffiliateManagerMetrics);

// Verify affiliate manager metrics
router.patch('/:metricsId/verify', protect, isAdmin, affiliateManagerMetricsController.verifyAffiliateManagerMetrics);

// Delete affiliate manager metrics
router.delete('/:metricsId', protect, isAdmin, affiliateManagerMetricsController.deleteAffiliateManagerMetrics);

module.exports = router; 