const express = require("express");
const { body, param, query } = require("express-validator");
const { protect, authorize } = require("../middleware/auth");
const {
  createApprovalRequest,
  getPendingApprovals,
  getAllApprovals,
  processDecision,
  getApprovalById,
  getSuperiorLeadManager,
  setSuperiorLeadManager,
  getApprovalCounts,
  getAdminUsers,
} = require("../controllers/refundApprovals");

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get superior lead manager setting (any authenticated user can check)
router.get("/superior-manager", getSuperiorLeadManager);

// Set superior lead manager (admin only)
router.put(
  "/superior-manager",
  [
    authorize("admin"),
    body("userId").isMongoId().withMessage("Invalid user ID"),
  ],
  setSuperiorLeadManager
);

// Get approval counts for badge display
router.get("/counts", getApprovalCounts);

// Get list of active admins (for superior to select which admin)
router.get("/admins", getAdminUsers);

// Get pending approvals (for superior lead manager and admin)
router.get("/pending", getPendingApprovals);

// Get all approvals with pagination (admin only)
router.get(
  "/",
  [
    authorize("admin"),
    query("status")
      .optional()
      .isIn(["all", "pending_superior", "pending_admin", "approved", "rejected"])
      .withMessage("Invalid status filter"),
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
  ],
  getAllApprovals
);

// Create approval request (refunds_manager, admin, affiliate_manager with refunds permission)
router.post(
  "/",
  [
    authorize("admin", "refunds_manager", "affiliate_manager"),
    body("refundAssignmentId")
      .isMongoId()
      .withMessage("Invalid refund assignment ID"),
    body("notes")
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage("Notes must be less than 1000 characters"),
  ],
  createApprovalRequest
);

// Get specific approval
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid approval ID")],
  getApprovalById
);

// Process decision (approve/reject - admin and superior lead manager)
router.put(
  "/:id/decision",
  [
    authorize("admin", "refunds_manager", "affiliate_manager", "lead_manager"),
    param("id").isMongoId().withMessage("Invalid approval ID"),
    body("decision")
      .isIn(["approve", "reject"])
      .withMessage('Decision must be "approve" or "reject"'),
    body("notes")
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage("Notes must be less than 1000 characters"),
    body("evidenceImageIds")
      .optional()
      .isArray()
      .withMessage("Evidence image IDs must be an array"),
    body("adminReviewerId")
      .optional()
      .isMongoId()
      .withMessage("Invalid admin reviewer ID"),
  ],
  processDecision
);

module.exports = router;
