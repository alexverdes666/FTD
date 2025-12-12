const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getAllAgentBonuses,
  getAgentBonus,
  createOrUpdateAgentBonus,
  deleteAgentBonus,
  getBonusStats
} = require('../controllers/agentBonuses');

// Middleware to ensure only admins can access these routes
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }
  next();
};

// Get all agent bonus configurations
router.get('/', protect, adminOnly, getAllAgentBonuses);

// Get bonus statistics summary
router.get('/stats', protect, adminOnly, getBonusStats);



// Get bonus configuration for a specific agent
// Allow agents to get their own config, admins can get any agent's config
router.get('/:agentId', protect, (req, res, next) => {
  const isAdmin = req.user.role === 'admin';
  const isOwnConfig = req.user.id === req.params.agentId || req.user._id.toString() === req.params.agentId;
  
  if (isAdmin || isOwnConfig) {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You can only view your own bonus configuration.'
    });
  }
}, getAgentBonus);

// Create or update bonus configuration for an agent
router.put('/:agentId', protect, adminOnly, createOrUpdateAgentBonus);

// Delete (deactivate) bonus configuration for an agent
router.delete('/:agentId', protect, adminOnly, deleteAgentBonus);

module.exports = router; 