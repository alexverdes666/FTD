const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/auth');
const {
  setup2FA,
  verify2FASetup,
  verify2FALogin,
  disable2FA,
  regenerateBackupCodes,
  get2FAStatus
} = require('../controllers/twoFactor');

// Rate limiter for 2FA verification attempts
const verify2FALimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Max 5 attempts per 15 minutes
  message: {
    success: false,
    message: 'Too many verification attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Protected routes (require authentication)
router.post('/setup', protect, setup2FA);
router.post('/verify-setup', protect, verify2FASetup);
router.post('/disable', protect, disable2FA);
router.post('/regenerate-backup-codes', protect, regenerateBackupCodes);
router.get('/status', protect, get2FAStatus);

// Login verification route (with rate limiting)
router.post('/verify-login', verify2FALimiter, verify2FALogin);

module.exports = router;

