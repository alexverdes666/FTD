const express = require("express");
const { body } = require("express-validator");
const {
  getPSPs,
  getPSP,
  getPSPProfile,
  createPSP,
  updatePSP,
  deletePSP,
  getPSPAuditLogs,
} = require("../controllers/psps");
const { protect, isAdmin, authorize } = require("../middleware/auth");

const router = express.Router();

// Get all PSPs
router.get("/", protect, getPSPs);

// Get PSP audit logs (before :id to avoid conflict)
router.get("/:id/audit-logs", protect, isAdmin, getPSPAuditLogs);

// Get PSP profile with linked brokers
router.get("/:id/profile", protect, getPSPProfile);

// Get single PSP
router.get("/:id", protect, getPSP);

// Create PSP (admin and affiliate_manager)
router.post(
  "/",
  [
    protect,
    authorize("admin", "affiliate_manager"),
    body("name")
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage("Name is required and must be less than 100 characters"),
    body("description")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Description must be less than 500 characters"),
    body("website")
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage("Website must be less than 200 characters"),
  ],
  createPSP
);

// Update PSP (admin only)
router.put(
  "/:id",
  [
    protect,
    isAdmin,
    body("name")
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage("Name must be less than 100 characters"),
    body("description")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Description must be less than 500 characters"),
    body("website")
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage("Website must be less than 200 characters"),
    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean"),
  ],
  updatePSP
);

// Delete PSP (admin only)
router.delete("/:id", [protect, isAdmin], deletePSP);

module.exports = router;
