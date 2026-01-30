const express = require("express");
const { body } = require("express-validator");
const { protect, authorize } = require("../middleware/auth");
const {
  verifyPasswordForProfiles,
  getProfilesByLead,
  getSensitiveFields,
  getProfileTOTP,
  createProfile,
  updateProfile,
  deleteProfile,
  getProfileAuditLogs,
  getProfileAuditLogsSensitive,
} = require("../controllers/leadProfiles");

const router = express.Router();

const authorizedRoles = ["admin", "affiliate_manager", "lead_manager"];

// Password verification - creates a time-limited unlock token
router.post(
  "/verify-password",
  [
    protect,
    authorize(...authorizedRoles),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  verifyPasswordForProfiles
);

// Get all profiles for a lead (redacted)
router.get(
  "/lead/:leadId",
  [protect, authorize(...authorizedRoles)],
  getProfilesByLead
);

// Get audit logs for a lead's profiles (admin only)
router.get(
  "/lead/:leadId/audit-logs",
  [protect, authorize("admin")],
  getProfileAuditLogs
);

// Get audit logs with decrypted sensitive values (admin only, requires unlock token)
router.get(
  "/lead/:leadId/audit-logs/sensitive",
  [protect, authorize("admin")],
  getProfileAuditLogsSensitive
);

// Get decrypted sensitive fields (requires X-Unlock-Token header)
router.get(
  "/:id/sensitive",
  [protect, authorize(...authorizedRoles)],
  getSensitiveFields
);

// Get current TOTP code (requires X-Unlock-Token header)
router.get(
  "/:id/totp",
  [protect, authorize(...authorizedRoles)],
  getProfileTOTP
);

// Create profile credential
router.post(
  "/",
  [
    protect,
    authorize(...authorizedRoles),
    body("leadId").isMongoId().withMessage("Valid lead ID is required"),
    body("accountType")
      .trim()
      .notEmpty()
      .withMessage("Account type is required"),
    body("username").optional().trim(),
    body("password").optional(),
    body("twoFactorSecret").optional(),
    body("recoveryCodes").optional().isArray(),
    body("notes").optional().trim(),
  ],
  createProfile
);

// Update profile credential
router.put(
  "/:id",
  [
    protect,
    authorize(...authorizedRoles),
    body("accountType").optional().trim(),
    body("username").optional().trim(),
    body("password").optional(),
    body("twoFactorSecret").optional(),
    body("recoveryCodes").optional().isArray(),
    body("notes").optional().trim(),
  ],
  updateProfile
);

// Delete profile credential
router.delete(
  "/:id",
  [protect, authorize(...authorizedRoles)],
  deleteProfile
);

module.exports = router;
