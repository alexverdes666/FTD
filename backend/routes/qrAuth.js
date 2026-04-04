const express = require('express');
const router = express.Router();
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
  checkQRAuthEnabled,
  // Sensitive action QR auth
  createSensitiveActionSession,
  checkSensitiveActionStatus,
  getSensitiveActionDetails,
  approveSensitiveAction,
  rejectSensitiveAction,
} = require('../controllers/qrAuth');

// ========================================
// LOGIN QR AUTH ROUTES
// ========================================

// Public routes (no auth required)
// Create a new QR login session
router.post('/create-session', createSession);

// Check session status (polling from desktop)
router.get('/session-status/:sessionToken', checkSessionStatus);

// Get session details (for mobile approval page)
router.get('/session/:sessionToken', getSessionDetails);

// Approve a session (from mobile)
router.post('/approve', approveSession);

// Reject a session (from mobile)
router.post('/reject', rejectSession);

// Register device (requires password verification)
router.post('/register-device', registerDevice);

// Check if user has QR auth enabled (for login flow)
router.get('/check-enabled/:userId', checkQRAuthEnabled);

// Protected routes (require authentication)
// Get QR auth status
router.get('/status', protect, getStatus);

// Enable QR auth (generates setup QR code)
router.post('/enable', protect, enableQRAuth);

// Disable QR auth
router.post('/disable', protect, disableQRAuth);

// ========================================
// SENSITIVE ACTION QR AUTH ROUTES
// ========================================

// Create a QR session for sensitive action verification
router.post('/create-sensitive-action-session', createSensitiveActionSession);

// Check sensitive action session status (polling from desktop)
router.get('/sensitive-action-status/:sessionToken', checkSensitiveActionStatus);

// Get sensitive action session details (for mobile approval page)
router.get('/sensitive-action/:sessionToken', getSensitiveActionDetails);

// Approve a sensitive action (from mobile)
router.post('/approve-sensitive-action', approveSensitiveAction);

// Reject a sensitive action (from mobile)
router.post('/reject-sensitive-action', rejectSensitiveAction);

module.exports = router;
