const express = require("express");
const { body } = require("express-validator");
const {
  getClientNetworks,
  getClientNetwork,
  getClientNetworkProfile,
  getNetworkDeals,
  createClientNetwork,
  updateClientNetwork,
  deleteClientNetwork,
  addEmployee,
  updateEmployee,
  removeEmployee,
  addReference,
  removeReference,
} = require("../controllers/clientNetworks");
const { protect, isAdmin, authorize } = require("../middleware/auth");
const {
  requireSensitiveActionVerification,
} = require("../middleware/sensitiveAction");

const router = express.Router();

router.get("/", protect, getClientNetworks);

// Profile route (must be before /:id)
router.get("/:id/profile", protect, getClientNetworkProfile);

// Deals route
router.get("/:id/deals", protect, getNetworkDeals);

// Employee routes
router.post(
  "/:id/employees",
  [
    protect,
    isAdmin,
    body("name")
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage("Name is required and must be less than 100 characters"),
    body("telegramUsername")
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage("Telegram username must be less than 100 characters"),
    body("position")
      .isIn(["finance", "boss", "manager", "affiliate_manager", "tech_support"])
      .withMessage("Invalid position"),
  ],
  addEmployee
);

router.put(
  "/:id/employees/:empId",
  [
    protect,
    isAdmin,
    body("name")
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage("Name must be less than 100 characters"),
    body("telegramUsername")
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage("Telegram username must be less than 100 characters"),
    body("position")
      .optional()
      .isIn(["finance", "boss", "manager", "affiliate_manager", "tech_support"])
      .withMessage("Invalid position"),
    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean"),
  ],
  updateEmployee
);

router.delete("/:id/employees/:empId", [protect, isAdmin], removeEmployee);

// Reference routes
router.post(
  "/:id/references",
  [
    protect,
    isAdmin,
    body("clientNetworkId")
      .isMongoId()
      .withMessage("Valid client network ID is required"),
    body("notes")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Notes must be less than 500 characters"),
  ],
  addReference
);

router.delete("/:id/references/:refId", [protect, isAdmin], removeReference);

// Single network route
router.get("/:id", protect, getClientNetwork);

router.post(
  "/",
  [
    protect,
    isAdmin,
    body("name")
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage("Name is required and must be less than 100 characters"),
    body("description")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Description must be less than 500 characters"),
  ],
  createClientNetwork
);

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
    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean"),
  ],
  updateClientNetwork
);

router.delete(
  "/:id",
  [protect, isAdmin, requireSensitiveActionVerification("CLIENT_NETWORK_DELETE")],
  deleteClientNetwork
);

module.exports = router;
