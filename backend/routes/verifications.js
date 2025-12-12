const express = require("express");
const { body } = require("express-validator");
const { protect, authorize } = require("../middleware/auth");
const {
  getPendingVerifications,
  getVerificationDetails,
  approveVerification,
  rejectVerification,
  getVerificationStats,
} = require("../controllers/verifications");

const router = express.Router();

// All routes require authentication and lead_manager or admin role
router.use(protect);
router.use(authorize("admin", "lead_manager"));

// GET /api/verifications - Get pending verifications with pagination
router.get("/", getPendingVerifications);

// GET /api/verifications/stats - Get verification statistics
router.get("/stats", getVerificationStats);

// GET /api/verifications/:sessionId - Get verification details
router.get("/:sessionId", getVerificationDetails);

// PUT /api/verifications/:sessionId/approve - Approve verification and create lead
router.put(
  "/:sessionId/approve",
  [
    body("notes")
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage("Notes must not exceed 1000 characters"),
    body("newEmail")
      .optional()
      .trim()
      .isEmail()
      .withMessage("Please provide a valid email address"),
    body("newPhone")
      .optional()
      .trim()
      .isLength({ min: 1 })
      .withMessage("Phone number cannot be empty if provided"),
  ],
  approveVerification
);

// PUT /api/verifications/:sessionId/reject - Reject verification
router.put(
  "/:sessionId/reject",
  [
    body("reason")
      .notEmpty()
      .trim()
      .withMessage("Rejection reason is required")
      .isLength({ min: 10, max: 500 })
      .withMessage("Rejection reason must be between 10 and 500 characters"),
  ],
  rejectVerification
);

module.exports = router;
