const express = require('express');
const { body, param } = require('express-validator');
const {
  protect,
  isManager
} = require('../middleware/auth');
const {
  getAgentAppointments,
  getAllAppointments,
  createAppointment,
  updateAppointment,
  deleteAppointment
} = require('../controllers/agentCallAppointments');

const router = express.Router();

// Custom middleware to check if user can access agent appointments
const canAccessAgentAppointments = (req, res, next) => {
  const { agentId } = req.params;
  
  // Admin and managers can access any agent's appointments
  if (['admin', 'affiliate_manager'].includes(req.user.role)) {
    return next();
  }
  
  // Agents can only access their own appointments
  if (req.user.role === 'agent' && req.user._id.toString() === agentId) {
    return next();
  }
  
  return res.status(403).json({
    success: false,
    message: 'You do not have permission to access these appointments'
  });
};

// Get all agents' appointments for a month (MUST come before /:agentId route)
router.get(
  '/all/:year/:month',
  [
    protect,
    isManager,
    param('year').isInt({ min: 2020, max: 2100 }).withMessage('Invalid year'),
    param('month').isInt({ min: 1, max: 12 }).withMessage('Invalid month')
  ],
  getAllAppointments
);

// Get single agent's appointments
router.get(
  '/:agentId/:year/:month',
  [
    protect,
    param('agentId').isMongoId().withMessage('Invalid agent ID'),
    param('year').isInt({ min: 2020, max: 2100 }).withMessage('Invalid year'),
    param('month').isInt({ min: 1, max: 12 }).withMessage('Invalid month'),
    canAccessAgentAppointments
  ],
  getAgentAppointments
);

// Create a new appointment
router.post(
  '/',
  [
    protect,
    body('agentId').isMongoId().withMessage('Invalid agent ID'),
    body('year').isInt({ min: 2020, max: 2100 }).withMessage('Invalid year'),
    body('month').isInt({ min: 1, max: 12 }).withMessage('Invalid month'),
    body('day').isInt({ min: 1, max: 31 }).withMessage('Invalid day'),
    body('hour').isInt({ min: 0, max: 23 }).withMessage('Invalid hour (must be 0-23)'),
    body('ftdName').trim().notEmpty().withMessage('FTD name is required')
  ],
  createAppointment
);

// Update an appointment
router.put(
  '/:id',
  [
    protect,
    param('id').isMongoId().withMessage('Invalid appointment ID'),
    body('year').optional().isInt({ min: 2020, max: 2100 }).withMessage('Invalid year'),
    body('month').optional().isInt({ min: 1, max: 12 }).withMessage('Invalid month'),
    body('day').optional().isInt({ min: 1, max: 31 }).withMessage('Invalid day'),
    body('hour').optional().isInt({ min: 0, max: 23 }).withMessage('Invalid hour (must be 0-23)'),
    body('ftdName').optional().trim().notEmpty().withMessage('FTD name cannot be empty')
  ],
  updateAppointment
);

// Delete an appointment
router.delete(
  '/:id',
  [
    protect,
    param('id').isMongoId().withMessage('Invalid appointment ID')
  ],
  deleteAppointment
);

module.exports = router;

