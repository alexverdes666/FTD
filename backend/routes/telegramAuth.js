const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  webhook,
  createSession,
  checkSessionStatus,
  generateLinkCode,
  getStatus,
  disableTelegramAuth,
  createSensitiveActionSession,
  setWebhook,
} = require('../controllers/telegramAuth');

// ========================================
// TELEGRAM WEBHOOK (public - called by Telegram)
// ========================================
router.post('/webhook', webhook);

// ========================================
// LOGIN TELEGRAM AUTH ROUTES
// ========================================

// Create a new Telegram login session (public - called during login)
router.post('/create-session', createSession);

// Check session status (polling from desktop)
router.get('/session-status/:sessionToken', checkSessionStatus);

// ========================================
// SENSITIVE ACTION ROUTES
// ========================================

// Create a Telegram session for sensitive action verification
router.post('/create-sensitive-action-session', createSensitiveActionSession);

// ========================================
// PROTECTED ROUTES (require authentication)
// ========================================

// Generate a link code for connecting Telegram account
router.post('/generate-link-code', protect, generateLinkCode);

// Get Telegram auth status
router.get('/status', protect, getStatus);

// Disable Telegram auth
router.post('/disable', protect, disableTelegramAuth);

// Manually set webhook (admin utility)
router.post('/set-webhook', protect, setWebhook);

module.exports = router;
