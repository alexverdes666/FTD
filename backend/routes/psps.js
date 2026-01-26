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
    body("cardNumber")
      .optional()
      .trim()
      .isLength({ max: 30 })
      .withMessage("Card number must be less than 30 characters"),
    body("cardExpiry")
      .optional()
      .trim()
      .custom((value) => {
        if (!value || value === "") return true;
        return /^(0[1-9]|1[0-2])\/([0-9]{2})$/.test(value);
      })
      .withMessage("Card expiry must be in MM/YY format"),
    body("cardCVC")
      .optional()
      .trim()
      .custom((value) => {
        if (!value || value === "") return true;
        return /^[0-9]{3,4}$/.test(value);
      })
      .withMessage("Card CVC must be 3-4 digits"),
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
    body("cardNumber")
      .optional()
      .trim()
      .isLength({ max: 30 })
      .withMessage("Card number must be less than 30 characters"),
    body("cardExpiry")
      .optional()
      .trim()
      .custom((value) => {
        if (!value || value === "") return true;
        return /^(0[1-9]|1[0-2])\/([0-9]{2})$/.test(value);
      })
      .withMessage("Card expiry must be in MM/YY format"),
    body("cardCVC")
      .optional()
      .trim()
      .custom((value) => {
        if (!value || value === "") return true;
        return /^[0-9]{3,4}$/.test(value);
      })
      .withMessage("Card CVC must be 3-4 digits"),
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
