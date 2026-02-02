const express = require("express");
const { body } = require("express-validator");
const {
  getCrmDeals,
  getCrmDealsByNetwork,
  createCrmDeal,
  updateCrmDeal,
  deleteCrmDeal,
  getCrmDashboardStats,
} = require("../controllers/crmDeals");
const { protect, isManager } = require("../middleware/auth");

const router = express.Router();

router.get("/", [protect, isManager], getCrmDeals);
router.get("/dashboard-stats", [protect, isManager], getCrmDashboardStats);
router.get("/network/:networkId", [protect, isManager], getCrmDealsByNetwork);

router.post(
  "/",
  [
    protect,
    isManager,
    body("clientNetwork")
      .isMongoId()
      .withMessage("Valid client network ID is required"),
    body("date").isISO8601().withMessage("Valid date is required"),
    body("ourNetwork")
      .isMongoId()
      .withMessage("Valid our network ID is required"),
    body("affiliateManager")
      .isMongoId()
      .withMessage("Valid affiliate manager ID is required"),
    body("totalSentLeads")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Total sent leads must be a non-negative integer"),
    body("firedFtds")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Fired FTDs must be a non-negative integer"),
    body("shavedFtds")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Shaved FTDs must be a non-negative integer"),
    body("totalPaid")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Total paid must be a non-negative number"),
    body("notes")
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage("Notes must be less than 1000 characters"),
  ],
  createCrmDeal
);

router.put(
  "/:id",
  [
    protect,
    isManager,
    body("date").optional().isISO8601().withMessage("Valid date is required"),
    body("ourNetwork")
      .optional()
      .isMongoId()
      .withMessage("Valid our network ID is required"),
    body("affiliateManager")
      .optional()
      .isMongoId()
      .withMessage("Valid affiliate manager ID is required"),
    body("totalSentLeads")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Total sent leads must be a non-negative integer"),
    body("firedFtds")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Fired FTDs must be a non-negative integer"),
    body("shavedFtds")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Shaved FTDs must be a non-negative integer"),
    body("totalPaid")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Total paid must be a non-negative number"),
    body("notes")
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage("Notes must be less than 1000 characters"),
  ],
  updateCrmDeal
);

router.delete("/:id", [protect, isManager], deleteCrmDeal);

module.exports = router;
