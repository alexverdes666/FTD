const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { protect } = require("../middleware/auth");
const {
  requireSensitiveActionVerification,
} = require("../middleware/sensitiveAction");
const {
  setup2FA,
  verify2FASetup,
  verify2FALogin,
  disable2FA,
  regenerateBackupCodes,
  get2FAStatus,
} = require("../controllers/twoFactor");

// Rate limiter for 2FA verification attempts
const verify2FALimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Max 5 attempts per 15 minutes
  message: {
    success: false,
    message: "Too many verification attempts. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Protected routes (require authentication)
router.post("/setup", protect, setup2FA);
router.post("/verify-setup", protect, verify2FASetup);

// Disabling 2FA requires verification with current 2FA code
// Note: This uses password verification internally, but we also log it as a sensitive action
router.post(
  "/disable",
  [
    protect,
    // We use a custom approach here since the user must provide their password
    // and we log this as a sensitive action attempt
  ],
  disable2FA
);

// Regenerating backup codes requires verification
router.post(
  "/regenerate-backup-codes",
  [
    protect,
    // Password verification is handled in the controller
    // The action is logged for audit purposes
  ],
  regenerateBackupCodes
);

router.get("/status", protect, get2FAStatus);

// Login verification route (with rate limiting)
router.post("/verify-login", verify2FALimiter, verify2FALogin);

module.exports = router;
