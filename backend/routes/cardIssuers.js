const express = require("express");
const { body } = require("express-validator");
const {
  getCardIssuers,
  getCardIssuer,
  getPSPsByCardIssuer,
  createCardIssuer,
  updateCardIssuer,
  deleteCardIssuer,
  getCardIssuerAuditLogs,
  uploadLogo,
} = require("../controllers/cardIssuers");
const { protect, isAdmin, authorize } = require("../middleware/auth");

const router = express.Router();

// Upload logo for Card Issuer (admin and affiliate_manager)
router.post(
  "/upload-logo",
  [protect, authorize("admin", "affiliate_manager")],
  uploadLogo
);

// Get all Card Issuers (any authenticated user)
router.get("/", protect, getCardIssuers);

// Get Card Issuer audit logs (admin only)
router.get("/:id/audit-logs", protect, isAdmin, getCardIssuerAuditLogs);

// Get PSPs by Card Issuer (any authenticated user)
router.get("/:id/psps", protect, getPSPsByCardIssuer);

// Get single Card Issuer
router.get("/:id", protect, getCardIssuer);

// Create Card Issuer (admin and affiliate_manager)
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
    body("logo")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Logo URL must be less than 500 characters"),
  ],
  createCardIssuer
);

// Update Card Issuer (admin only)
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
    body("logo")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Logo URL must be less than 500 characters"),
    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean"),
  ],
  updateCardIssuer
);

// Delete Card Issuer (admin only)
router.delete("/:id", [protect, isAdmin], deleteCardIssuer);

module.exports = router;
