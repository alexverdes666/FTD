const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getGlobalBonusRates,
  updateGlobalBonusRates,
} = require('../controllers/systemConfiguration');

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

// Get global bonus rates configuration
router.get('/bonus-rates', protect, adminOnly, getGlobalBonusRates);

// Update global bonus rates configuration  
router.put('/bonus-rates', protect, adminOnly, updateGlobalBonusRates);

module.exports = router;
