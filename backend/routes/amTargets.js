const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getAllTargets,
  getMyTargets,
  createTarget,
  updateTarget,
  deleteTarget,
  getAffiliateManagers,
} = require('../controllers/amTargets');

// Middleware to check if user is admin or lead manager
const adminOrLeadManager = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'lead_manager') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin or Lead Manager privileges required.',
    });
  }
  next();
};

// Middleware to check if user can access targets
const canAccessTargets = (req, res, next) => {
  const allowedRoles = ['admin', 'lead_manager', 'affiliate_manager'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied.',
    });
  }
  next();
};

// Get affiliate managers for dropdown (admin/lead_manager only)
router.get('/affiliate-managers', protect, adminOrLeadManager, getAffiliateManagers);

// Get all targets (admin/lead_manager only)
router.get('/', protect, adminOrLeadManager, getAllTargets);

// Get own targets (affiliate_manager)
router.get('/my-targets', protect, canAccessTargets, getMyTargets);

// Create target (admin/lead_manager only)
router.post('/', protect, adminOrLeadManager, createTarget);

// Update target (all allowed roles, with restrictions in controller)
router.put('/:id', protect, canAccessTargets, updateTarget);

// Delete target (admin/lead_manager only)
router.delete('/:id', protect, adminOrLeadManager, deleteTarget);

module.exports = router;

