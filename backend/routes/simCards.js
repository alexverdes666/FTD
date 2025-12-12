const express = require('express');
const { body } = require('express-validator');
const {
  getSimCards,
  getSimCardById,
  createSimCard,
  updateSimCard,
  updateSimCardStatus,
  deleteSimCard,
  getSimCardStats,
  checkSimCardCooldownAndNotify,
  // Gateway integration
  configureGatewayNotifications,
  receiveDeviceStatus,
  receiveSMS,
  lockPort,
  unlockPort,
  switchSlot,
  resetPort,
  sendSMS,
  getGatewaySMSStats,
  getGatewayCallStats,
  enableGatewayIntegration,
  disableGatewayIntegration
} = require('../controllers/simCards');
const { protect, isAdmin, isInventoryManager, hasPermission } = require('../middleware/auth');

const router = express.Router();

// Middleware to ensure user has permission to manage SIM cards
const requireSimCardPermission = (req, res, next) => {
  if (req.user.role === 'admin' || req.user.role === 'inventory_manager' || 
      (req.user.permissions && req.user.permissions.canManageSimCards)) {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Permission to manage SIM cards required'
    });
  }
};

// Get all SIM cards with filtering
router.get('/', [protect, requireSimCardPermission], getSimCards);

// Get SIM card statistics
router.get('/stats', [protect, requireSimCardPermission], getSimCardStats);

// Manually trigger cooldown check (admin only - for testing)
router.post('/check-cooldown', [protect, isAdmin], async (req, res) => {
  try {
    const result = await checkSimCardCooldownAndNotify(req.io);
    res.status(200).json({
      success: true,
      message: 'SIM card cooldown check completed',
      data: result
    });
  } catch (error) {
    console.error('Error in manual cooldown check:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking SIM card cooldown',
      error: error.message
    });
  }
});

// Get single SIM card by ID
router.get('/:id', [protect, requireSimCardPermission], getSimCardById);

// Create new SIM card
router.post('/', [
  protect,
  requireSimCardPermission,
  body('geo')
    .trim()
    .isLength({ min: 2 })
    .withMessage('GEO must be at least 2 characters'),
  body('operator')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Operator must be at least 2 characters'),
  body('dateCharged')
    .isISO8601()
    .withMessage('Date charged must be a valid date'),
  body('simNumber')
    .trim()
    .isLength({ min: 4 })
    .withMessage('SIM number must be at least 4 characters'),
  body('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Status must be either active or inactive'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters')
], createSimCard);

// Update SIM card
router.put('/:id', [
  protect,
  requireSimCardPermission,
  body('geo')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('GEO must be at least 2 characters'),
  body('operator')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('Operator must be at least 2 characters'),
  body('dateCharged')
    .optional()
    .isISO8601()
    .withMessage('Date charged must be a valid date'),
  body('simNumber')
    .optional()
    .trim()
    .isLength({ min: 4 })
    .withMessage('SIM number must be at least 4 characters'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters')
], updateSimCard);

// Update SIM card status only (specific endpoint for status changes)
router.put('/:id/status', [
  protect,
  requireSimCardPermission,
  body('status')
    .isIn(['active', 'inactive'])
    .withMessage('Status must be either active or inactive')
], updateSimCardStatus);

// Delete SIM card (admin only)
router.delete('/:id', [protect, isAdmin], deleteSimCard);

// =============================================================================
// GATEWAY INTEGRATION ROUTES
// =============================================================================

// Configure gateway notifications (admin only)
router.post('/gateway/configure', [
  protect, 
  isAdmin,
  body('callbackUrl').optional().isURL().withMessage('Invalid callback URL'),
  body('period').optional().isInt({ min: 0 }).withMessage('Period must be a positive integer'),
  body('allSims').optional().isInt({ min: 0, max: 1 }).withMessage('allSims must be 0 or 1')
], configureGatewayNotifications);

// Webhook endpoints (no auth required - gateway pushes data here)
router.post('/gateway/webhook/status', receiveDeviceStatus);
router.post('/gateway/webhook/sms', receiveSMS);

// Gateway statistics (protected)
router.get('/gateway/stats/sms', [protect, requireSimCardPermission], getGatewaySMSStats);
router.get('/gateway/stats/calls', [protect, requireSimCardPermission], getGatewayCallStats);

// Enable/disable gateway integration for a SIM card
router.post('/:id/gateway/enable', [
  protect,
  requireSimCardPermission,
  body('gatewayId').optional().isMongoId().withMessage('Invalid gateway ID'),
  body('port').notEmpty().withMessage('Port is required'),
  body('slot').isInt({ min: 1, max: 4 }).withMessage('Slot must be between 1 and 4')
], enableGatewayIntegration);

router.post('/:id/gateway/disable', [protect, requireSimCardPermission], disableGatewayIntegration);

// Port control operations
router.post('/:id/gateway/lock', [protect, requireSimCardPermission], lockPort);
router.post('/:id/gateway/unlock', [protect, requireSimCardPermission], unlockPort);
router.post('/:id/gateway/reset', [protect, requireSimCardPermission], resetPort);

// Switch SIM slot
router.post('/:id/gateway/switch', [
  protect,
  requireSimCardPermission,
  body('targetSlot').isInt({ min: 1, max: 4 }).withMessage('Target slot must be between 1 and 4')
], switchSlot);

// Send SMS
router.post('/:id/gateway/sms', [
  protect,
  requireSimCardPermission,
  body('to').notEmpty().withMessage('Recipient(s) required'),
  body('message').notEmpty().withMessage('Message is required')
], sendSMS);

// Get live status of ALL ports from gateway (no SIM card ID needed)
router.get('/gateway/live-status', [protect, requireSimCardPermission], require('../controllers/simCards').getLiveGatewayStatus);

module.exports = router;
