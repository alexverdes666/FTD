const express = require("express");
const { body, param, query } = require("express-validator");
const { protect, authorize } = require("../middleware/auth");

// Custom middleware to check refunds access
const checkRefundsAccess = (req, res, next) => {
  const user = req.user;
  const hasAccess =
    user.role === "admin" ||
    user.role === "refunds_manager" ||
    (user.role === "affiliate_manager" && user.permissions?.canManageRefunds);

  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      message: "Access denied. You don't have permission to access refunds.",
    });
  }

  next();
};
const {
  getRefundAssignments,
  getRefundStats,
  updateRefundStatus,
  assignToRefundsManager,
  getRefundAssignmentById,
  importCSVRefunds,
  createManualRefund,
  deleteRefundAssignment,
  getRefundsManagers,
  getOrderRefundAssignmentStatus,
  togglePspEmail,
  markGroupAsFraud,
  uploadGroupDocuments,
} = require("../controllers/refunds");

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get refund assignments (refunds manager, admin, and affiliate managers with permission)
router.get(
  "/",
  [
    checkRefundsAccess,
    query("status")
      .optional()
      .isIn([
        "all",
        "new",
        "uploaded",
        "initial_email",
        "request_approved",
        "docs_sent",
        "threatening_email",
        "review_posted",
        "review_dispute",
        "review_removed",
        "refunded_checked",
        "refund_complete",
        "rejected",
        "fraud",
      ])
      .withMessage("Invalid status filter"),
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    query("search")
      .optional()
      .isString()
      .isLength({ max: 100 })
      .withMessage("Search term must be a string with maximum 100 characters"),
  ],
  getRefundAssignments
);

// Get refund statistics (refunds manager, admin, and affiliate managers with permission)
router.get("/stats", checkRefundsAccess, getRefundStats);

// Get refunds managers (managers only)
router.get(
  "/managers",
  authorize("admin", "affiliate_manager", "lead_manager", "refunds_manager"),
  getRefundsManagers
);

// Get refund assignment status for an order
router.get(
  "/order/:orderId/status",
  [
    authorize("admin", "affiliate_manager", "lead_manager"),
    param("orderId").isMongoId().withMessage("Invalid order ID"),
  ],
  getOrderRefundAssignmentStatus
);

// Get specific refund assignment
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid assignment ID")],
  getRefundAssignmentById
);

// Update refund status (refunds manager, admin, and affiliate managers with permission)
router.put(
  "/:id/status",
  [
    checkRefundsAccess,
    param("id").isMongoId().withMessage("Invalid assignment ID"),
    body("status")
      .isIn([
        "new",
        "uploaded",
        "initial_email",
        "request_approved",
        "docs_sent",
        "threatening_email",
        "review_posted",
        "review_dispute",
        "review_removed",
        "refunded_checked",
        "refund_complete",
        "rejected",
        "fraud",
      ])
      .withMessage("Invalid status"),
    body("notes")
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage("Notes must be less than 1000 characters"),
  ],
  updateRefundStatus
);

// Assign FTD leads to refunds manager (managers only)
router.post(
  "/assign",
  [
    authorize("admin", "affiliate_manager", "lead_manager"),
    body("orderId").isMongoId().withMessage("Invalid order ID"),
    body("leadIds")
      .isArray({ min: 1 })
      .withMessage("Lead IDs must be a non-empty array"),
    body("leadIds.*").isMongoId().withMessage("Invalid lead ID"),
    body("refundsManagerId")
      .optional()
      .isMongoId()
      .withMessage("Invalid refunds manager ID"),
  ],
  assignToRefundsManager
);

// Import CSV refunds (refunds manager, admin, and affiliate managers with permission)
router.post("/import", checkRefundsAccess, importCSVRefunds);

// Create manual refund (refunds manager, admin, and affiliate managers with permission)
router.post(
  "/manual",
  [
    checkRefundsAccess,
    body("firstName")
      .notEmpty()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage(
        "First name is required and must be less than 100 characters"
      ),
    body("lastName")
      .notEmpty()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage(
        "Last name is required and must be less than 100 characters"
      ),
    body("email")
      .notEmpty()
      .isEmail()
      .normalizeEmail()
      .withMessage("Valid email is required"),
    body("geo")
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage("GEO must be less than 50 characters"),
    body("date")
      .optional()
      .isISO8601()
      .withMessage("Date must be a valid ISO date"),
    body("lastFourDigitsCard")
      .optional()
      .trim()
      .isLength({ max: 4 })
      .matches(/^\d{0,4}$/)
      .withMessage("Last four digits must be up to 4 digits"),
    body("bank")
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage("Bank must be less than 100 characters"),
    body("comment")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Comment must be less than 500 characters"),
    body("psp1")
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage("PSP1 must be less than 100 characters"),
    body("broker1")
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage("Broker1 must be less than 100 characters"),
    body("psp2")
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage("PSP2 must be less than 100 characters"),
    body("broker2")
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage("Broker2 must be less than 100 characters"),
    body("refundsManagerId")
      .optional()
      .isMongoId()
      .withMessage("Invalid refunds manager ID"),
  ],
  createManualRefund
);

// Delete refund assignment (refunds manager, admin, and affiliate managers with permission)
router.delete(
  "/:id",
  [
    checkRefundsAccess,
    param("id").isMongoId().withMessage("Invalid assignment ID"),
  ],
  deleteRefundAssignment
);

// Toggle PSP Email status (refunds manager, admin, and affiliate managers with permission)
router.patch(
  "/:id/psp-email",
  [
    checkRefundsAccess,
    param("id").isMongoId().withMessage("Invalid assignment ID"),
  ],
  togglePspEmail
);

// Mark entire group as fraud (refunds manager, admin, and affiliate managers with permission)
router.post(
  "/group/mark-fraud",
  [
    checkRefundsAccess,
    body("email")
      .notEmpty()
      .isEmail()
      .withMessage("Valid email is required"),
    body("fraudReason")
      .notEmpty()
      .trim()
      .isLength({ min: 1, max: 1000 })
      .withMessage("Fraud reason is required and must be less than 1000 characters"),
  ],
  markGroupAsFraud
);

// Upload documents for group (refunds manager, admin, and affiliate managers with permission)
router.post(
  "/group/upload-documents",
  [
    checkRefundsAccess,
    body("email")
      .notEmpty()
      .isEmail()
      .withMessage("Valid email is required"),
    body("gender")
      .optional()
      .trim()
      .isIn(['male', 'female', 'other', ''])
      .withMessage("Gender must be male, female, or other"),
    body("dateOfBirth")
      .optional()
      .isISO8601()
      .withMessage("Date of birth must be a valid ISO date"),
    body("address")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Address must be less than 500 characters"),
    body("authenticator")
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage("Authenticator must be less than 200 characters"),
    body("backupCodes")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Backup codes must be less than 500 characters"),
    body("idFront")
      .optional()
      .trim()
      .isURL()
      .withMessage("ID Front must be a valid URL"),
    body("idBack")
      .optional()
      .trim()
      .isURL()
      .withMessage("ID Back must be a valid URL"),
    body("selfieFront")
      .optional()
      .trim()
      .isURL()
      .withMessage("Selfie Front must be a valid URL"),
    body("selfieBack")
      .optional()
      .trim()
      .isURL()
      .withMessage("Selfie Back must be a valid URL"),
  ],
  uploadGroupDocuments
);

module.exports = router;
