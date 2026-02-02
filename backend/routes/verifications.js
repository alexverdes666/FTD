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
      .custom((value) => {
        // Allow empty string or skip validation for N/A values
        if (!value || value === "N/A") return true;
        // Validate as email only if a real value is provided
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          throw new Error("Please provide a valid email address");
        }
        return true;
      }),
    body("newPhone")
      .optional()
      .trim()
      .isLength({ min: 1 })
      .withMessage("Phone number cannot be empty if provided"),
    body("fullName")
      .optional()
      .trim()
      .isLength({ min: 2 })
      .withMessage("Full name must be at least 2 characters"),
    body("country")
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage("Country must be between 2 and 100 characters"),
    body("address")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Address must not exceed 500 characters"),
    body("gender")
      .optional()
      .isIn(["male", "female", "not_defined"])
      .withMessage("Gender must be male, female, or not_defined"),
    body("dob")
      .optional()
      .isISO8601()
      .withMessage("Date of birth must be a valid date"),
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
