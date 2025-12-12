const express = require('express');
const { body, query, param } = require('express-validator');
const {
  protect,
  isAdmin,
  isManager,
  ownerOrAdmin
} = require('../middleware/auth');
const {
  getAgentSchedule,
  getAllAgentsSchedules,
  requestScheduleChange,
  getScheduleChangeRequests,
  approveScheduleChange,
  bulkApproveScheduleChanges,
  rejectScheduleChange
} = require('../controllers/agentSchedule');

const router = express.Router();

// Custom middleware to check if user can access agent schedule
const canAccessAgentSchedule = (req, res, next) => {
  const { agentId } = req.params;
  
  // Admin and managers can access any agent's schedule
  if (['admin', 'affiliate_manager'].includes(req.user.role)) {
    return next();
  }
  
  // Agents can only access their own schedule
  if (req.user.role === 'agent' && req.user._id.toString() === agentId) {
    return next();
  }
  
  return res.status(403).json({
    success: false,
    message: 'You do not have permission to access this schedule'
  });
};

// Get all agents' schedules for a month (MUST come before /:agentId route)
router.get(
  '/all/:year/:month',
  [
    protect,
    isManager,
    param('year').isInt({ min: 2020, max: 2100 }).withMessage('Invalid year'),
    param('month').isInt({ min: 1, max: 12 }).withMessage('Invalid month')
  ],
  getAllAgentsSchedules
);

// Get single agent schedule
router.get(
  '/:agentId/:year/:month',
  [
    protect,
    param('agentId').isMongoId().withMessage('Invalid agent ID'),
    param('year').isInt({ min: 2020, max: 2100 }).withMessage('Invalid year'),
    param('month').isInt({ min: 1, max: 12 }).withMessage('Invalid month'),
    canAccessAgentSchedule
  ],
  getAgentSchedule
);

// Create a schedule change request
router.post(
  '/request',
  [
    protect,
    body('agentId').isMongoId().withMessage('Invalid agent ID'),
    body('year').isInt({ min: 2020, max: 2100 }).withMessage('Invalid year'),
    body('month').isInt({ min: 1, max: 12 }).withMessage('Invalid month'),
    body('day').isInt({ min: 1, max: 31 }).withMessage('Invalid day'),
    body('requestedAvailability').isBoolean().withMessage('Requested availability must be a boolean')
  ],
  requestScheduleChange
);

// Get schedule change requests
router.get(
  '/requests',
  [
    protect,
    query('agentId').optional().isMongoId().withMessage('Invalid agent ID'),
    query('status').optional().isIn(['pending', 'approved', 'rejected']).withMessage('Invalid status')
  ],
  getScheduleChangeRequests
);

// Approve a schedule change request
router.put(
  '/requests/:id/approve',
  [
    protect,
    isManager,
    param('id').isMongoId().withMessage('Invalid request ID')
  ],
  approveScheduleChange
);

// Bulk approve schedule change requests
router.post(
  '/requests/bulk-approve',
  [
    protect,
    isManager,
    body('requestIds').isArray({ min: 1 }).withMessage('Request IDs must be a non-empty array'),
    body('requestIds.*').isMongoId().withMessage('Each request ID must be valid')
  ],
  bulkApproveScheduleChanges
);

// Reject a schedule change request
router.put(
  '/requests/:id/reject',
  [
    protect,
    isManager,
    param('id').isMongoId().withMessage('Invalid request ID'),
    body('rejectionReason').optional().isString().trim().withMessage('Rejection reason must be a string')
  ],
  rejectScheduleChange
);

module.exports = router;

