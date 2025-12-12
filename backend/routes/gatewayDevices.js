const express = require('express');
const { body } = require('express-validator');
const {
  getGatewayDevices,
  getGatewayDeviceById,
  createGatewayDevice,
  updateGatewayDevice,
  deleteGatewayDevice,
  testGatewayConnection,
  getGatewayLiveStatus,
  configureGatewayNotifications
} = require('../controllers/gatewayDevices');
const { protect, isAdmin } = require('../middleware/auth');

const router = express.Router();

// Middleware to ensure user has permission to manage gateways
const requireGatewayPermission = (req, res, next) => {
  if (req.user.role === 'admin' || req.user.role === 'inventory_manager' || 
      (req.user.permissions && req.user.permissions.canManageSimCards)) {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Permission to manage gateways required'
    });
  }
};

// Get all gateway devices
router.get('/', [protect, requireGatewayPermission], getGatewayDevices);

// Get single gateway device by ID
router.get('/:id', [protect, requireGatewayPermission], getGatewayDeviceById);

// Test connection to gateway
router.post('/:id/test', [protect, requireGatewayPermission], testGatewayConnection);

// Get live status from gateway
router.get('/:id/status', [protect, requireGatewayPermission], getGatewayLiveStatus);

// Configure status notifications for gateway
router.post('/:id/configure-notifications', [
  protect,
  isAdmin,
  body('callbackUrl').optional().isURL().withMessage('Invalid callback URL'),
  body('period').optional().isInt({ min: 60 }).withMessage('Period must be at least 60 seconds'),
  body('allSims').optional().isInt({ min: 0, max: 1 }).withMessage('allSims must be 0 or 1')
], configureGatewayNotifications);

// Create new gateway device (admin only)
router.post('/', [
  protect,
  isAdmin,
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('host')
    .trim()
    .notEmpty()
    .withMessage('Host is required')
    .matches(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^[a-zA-Z0-9.-]+$/)
    .withMessage('Invalid host format'),
  body('port')
    .isInt({ min: 1, max: 65535 })
    .withMessage('Port must be between 1 and 65535'),
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters')
], createGatewayDevice);

// Update gateway device (admin only)
router.put('/:id', [
  protect,
  isAdmin,
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('host')
    .optional()
    .trim()
    .matches(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^[a-zA-Z0-9.-]+$/)
    .withMessage('Invalid host format'),
  body('port')
    .optional()
    .isInt({ min: 1, max: 65535 })
    .withMessage('Port must be between 1 and 65535'),
  body('username')
    .optional()
    .trim(),
  body('password')
    .optional(),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
], updateGatewayDevice);

// Delete gateway device (admin only)
router.delete('/:id', [protect, isAdmin], deleteGatewayDevice);

module.exports = router;

