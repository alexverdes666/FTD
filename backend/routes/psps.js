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

// Create PSP (admin only)
router.post(
  "/",
  [
    protect,
    isAdmin,
    body("website")
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage("Website URL is required and must be less than 200 characters"),
    body("description")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Description must be less than 500 characters"),
    body("cardIssuer")
      .optional({ nullable: true })
      .custom((value) => {
        if (value === null || value === "" || value === undefined) return true;
        return /^[0-9a-fA-F]{24}$/.test(value);
      })
      .withMessage("Invalid Card Issuer ID"),
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
    body("cardIssuer")
      .optional({ nullable: true })
      .custom((value) => {
        if (value === null || value === "") return true;
        return /^[0-9a-fA-F]{24}$/.test(value);
      })
      .withMessage("Invalid Card Issuer ID"),
  ],
  updatePSP
);

// Delete PSP (admin only)
router.delete("/:id", [protect, isAdmin], deletePSP);

module.exports = router;
