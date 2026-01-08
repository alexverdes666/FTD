const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/auth');
const {
  createSession,
  checkSessionStatus,
  getSessionDetails,
  approveSession,
  rejectSession,
  registerDevice,
  enableQRAuth,
  getStatus,
  disableQRAuth,
  checkQRAuthEnabled
} = require('../controllers/qrAuth');

// Rate limiter for QR auth attempts
const qrAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Max 20 attempts per 15 minutes
  message: {
    success: false,
    message: 'Too many QR authentication attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter for device registration (more restrictive)
const deviceRegLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Max 5 registration attempts per hour
  message: {
    success: false,
    message: 'Too many device registration attempts. Please try again later.'
  }
});

// Public routes (no auth required)
// Create a new QR login session
router.post('/create-session', qrAuthLimiter, createSession);

// Check session status (polling from desktop)
router.get('/session-status/:sessionToken', qrAuthLimiter, checkSessionStatus);

// Get session details (for mobile approval page)
router.get('/session/:sessionToken', qrAuthLimiter, getSessionDetails);

// Approve a session (from mobile)
router.post('/approve', qrAuthLimiter, approveSession);

// Reject a session (from mobile)
router.post('/reject', qrAuthLimiter, rejectSession);

// Register device (requires password verification)
router.post('/register-device', deviceRegLimiter, registerDevice);

// Check if user has QR auth enabled (for login flow)
router.get('/check-enabled/:userId', qrAuthLimiter, checkQRAuthEnabled);

// Protected routes (require authentication)
// Get QR auth status
router.get('/status', protect, getStatus);

// Enable QR auth (generates setup QR code)
router.post('/enable', protect, enableQRAuth);

// Disable QR auth
router.post('/disable', protect, disableQRAuth);

module.exports = router;

