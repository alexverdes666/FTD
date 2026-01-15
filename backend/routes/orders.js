const express = require("express");
const mongoose = require("mongoose");
const { body, query } = require("express-validator");
const {
  protect,
  isManager,
  canViewOrders,
  hasPermission,
  authorize,
} = require("../middleware/auth");
const {
  createOrder,
  getOrders,
  getOrderById,
  updateOrder,
  cancelOrder,
  deleteOrder,
  getOrderStats,
  exportOrderLeads,
  assignClientInfoToOrderLeads,
  skipOrderFTDs,
  getFTDLeadsForOrder,
  cancelLeadFromOrder,
  changeFTDInOrder,
  convertLeadTypeInOrder,
  checkOrderFulfillment,
  changeRequester,
  addLeadsToOrder,
  getAvailableLeadsForReplacement,
  replaceLeadInOrder,
} = require("../controllers/orders");
const router = express.Router();

// Change order requester (Admin only)
router.put(
  "/:orderId/change-requester",
  [protect, authorize("admin")],
  changeRequester
);

// Check fulfillment status
router.post(
  "/check-fulfillment",
  [
    protect,
    isManager,
    body("requests.ftd").optional().isInt({ min: 0 }),
    body("requests.filler").optional().isInt({ min: 0 }),
    body("requests.cold").optional().isInt({ min: 0 }),
  ],
  checkOrderFulfillment
);

router.post(
  "/",
  [
    protect,
    isManager,
    hasPermission("canCreateOrders"),
    body("requests.ftd")
      .optional()
      .isInt({ min: 0 })
      .withMessage("FTD request must be a non-negative integer"),
    body("requests.filler")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Filler request must be a non-negative integer"),
    body("requests.cold")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Cold request must be a non-negative integer"),
    body("requests.live")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Live request must be a non-negative integer"),
    body("priority")
      .optional()
      .isIn(["low", "medium", "high"])
      .withMessage("Priority must be low, medium, or high"),
    body("notes")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Notes must be less than 500 characters"),
    body("country")
      .custom((value, { req }) => {
        // Country is only required for non-manual selection orders
        if (!req.body.manualSelection) {
          if (!value || value.trim().length < 2) {
            throw new Error("Country filter is required (at least 2 characters)");
          }
        }
        return true;
      }),
    body("gender")
      .optional({ nullable: true })
      .isIn(["male", "female", "not_defined", null, ""])
      .withMessage("Gender must be male, female, not_defined, or empty"),
    body("selectedClientNetwork")
      .optional()
      .custom((value) => {
        // Both admins and affiliate managers can use client networks
        // Validate the ObjectId if provided
        if (value && value !== "" && !mongoose.Types.ObjectId.isValid(value)) {
          throw new Error(
            "selectedClientNetwork must be a valid MongoDB ObjectId"
          );
        }
        return true;
      }),
    body("selectedOurNetwork")
      .optional()
      .custom((value, { req }) => {
        if (value && value !== "" && !mongoose.Types.ObjectId.isValid(value)) {
          throw new Error(
            "selectedOurNetwork must be a valid MongoDB ObjectId"
          );
        }
        return true;
      }),
    body("selectedCampaign")
      .notEmpty()
      .withMessage("Campaign selection is mandatory for all orders")
      .isMongoId()
      .withMessage("Selected campaign must be a valid MongoDB ObjectId"),
    body("selectedClientBrokers")
      .optional()
      .isArray()
      .withMessage("selectedClientBrokers must be an array")
      .custom((brokers) => {
        if (brokers && brokers.length > 0) {
          return brokers.every(id => mongoose.Types.ObjectId.isValid(id));
        }
        return true;
      })
      .withMessage("All selectedClientBrokers must be valid MongoDB ObjectIds"),
    body("plannedDate")
      .notEmpty()
      .withMessage("Planned date is required")
      .isISO8601()
      .withMessage("Planned date must be a valid ISO 8601 date")
      .custom((value, { req }) => {
        const plannedDate = new Date(value);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const plannedDay = new Date(plannedDate.getFullYear(), plannedDate.getMonth(), plannedDate.getDate());
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // Admin users can bypass time restrictions (but not past date restrictions)
        if (req.user && req.user.role === 'admin') {
          // Even admins cannot create orders for past dates
          if (plannedDay < today) {
            throw new Error('Cannot create order for past dates');
          }
          return true;
        }
        
        // For non-admin users, apply all restrictions
        
        // Cannot create order for the same day
        if (plannedDay.getTime() === today.getTime()) {
          throw new Error('Cannot create order for the same day');
        }
        
        // Cannot create order for tomorrow if current time is after 19:00 (7 PM)
        if (plannedDay.getTime() === tomorrow.getTime() && now.getHours() >= 19) {
          throw new Error('Cannot create order for tomorrow after 7:00 PM today');
        }
        
        // Cannot create order for past dates
        if (plannedDay < today) {
          throw new Error('Cannot create order for past dates');
        }
        
        return true;
      }),
  ],
  createOrder
);
router.get(
  "/",
  [
    protect,
    canViewOrders,
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
  ],
  getOrders
);
router.get("/stats", [protect, canViewOrders], getOrderStats);
router.get("/:id", [protect, canViewOrders], getOrderById);
router.put("/:id", [
  protect,
  isManager,
  body("selectedClientBrokers")
    .optional()
    .isArray()
    .withMessage("selectedClientBrokers must be an array")
    .custom((brokers) => {
      if (brokers && brokers.length > 0) {
        return brokers.every(id => mongoose.Types.ObjectId.isValid(id));
      }
      return true;
    })
    .withMessage("All selectedClientBrokers must be valid MongoDB ObjectIds"),
  body("plannedDate")
    .optional()
    .isISO8601()
    .withMessage("plannedDate must be a valid date"),
  body("selectedCampaign")
    .optional()
    .custom((value) => !value || mongoose.Types.ObjectId.isValid(value))
    .withMessage("selectedCampaign must be a valid MongoDB ObjectId"),
  body("selectedOurNetwork")
    .optional()
    .custom((value) => !value || mongoose.Types.ObjectId.isValid(value))
    .withMessage("selectedOurNetwork must be a valid MongoDB ObjectId"),
  body("selectedClientNetwork")
    .optional()
    .custom((value) => !value || mongoose.Types.ObjectId.isValid(value))
    .withMessage("selectedClientNetwork must be a valid MongoDB ObjectId"),
], updateOrder);
router.delete("/:id", [protect, isManager], cancelOrder);
// Permanent deletion - managers and admins, only for cancelled orders (unless force=true for admins)
router.delete("/:id/permanent", [protect, isManager], deleteOrder);
router.get("/:id/export", [protect, isManager], exportOrderLeads);
router.put(
  "/:id/assign-client-info",
  [
    protect,
    isManager,
    body("client").optional().trim(),
    body("clientBroker").optional().trim(),
    body("clientNetwork").optional().trim(),
  ],
  assignClientInfoToOrderLeads
);
router.post("/:id/skip-ftds", [protect, isManager], skipOrderFTDs);
router.get("/:id/ftd-leads", [protect, isManager], getFTDLeadsForOrder);

// Cancel a lead from an order and return it to the database as unused
router.delete(
  "/:orderId/leads/:leadId",
  [protect, isManager],
  cancelLeadFromOrder
);

// Change FTD in an order with network filtration
router.post(
  "/:orderId/leads/:leadId/change-ftd",
  [
    protect,
    isManager,
    body("selectedClientNetwork")
      .optional()
      .isMongoId()
      .withMessage("Selected client network must be a valid ID"),
    body("selectedOurNetwork")
      .optional()
      .isMongoId()
      .withMessage("Selected our network must be a valid ID"),
    body("selectedCampaign")
      .optional()
      .isMongoId()
      .withMessage("Selected campaign must be a valid ID"),
    body("selectedClientBrokers")
      .optional()
      .isArray()
      .withMessage("selectedClientBrokers must be an array")
      .custom((brokers) => {
        if (brokers && brokers.length > 0) {
          return brokers.every(id => mongoose.Types.ObjectId.isValid(id));
        }
        return true;
      })
      .withMessage("All selectedClientBrokers must be valid MongoDB ObjectIds"),
  ],
  changeFTDInOrder
);

// Convert lead type between FTD and Filler within an order
router.post(
  "/:orderId/leads/:leadId/convert-lead-type",
  [
    protect,
    isManager,
    body("targetType")
      .optional()
      .isIn(["ftd", "filler"])
      .withMessage("Target type must be 'ftd' or 'filler'"),
  ],
  convertLeadTypeInOrder
);

// Get available leads for replacement (filtered by country and lead type)
router.get(
  "/:orderId/leads/:leadId/available-replacements",
  [
    protect,
    authorize("admin", "affiliate_manager"),
    query("search").optional().trim(),
    query("page").optional().isInt({ min: 1 }).toInt(),
    query("limit").optional().isInt({ min: 1, max: 50 }).toInt(),
  ],
  getAvailableLeadsForReplacement
);

// Replace a lead in an order with a specific selected lead
router.post(
  "/:orderId/leads/:leadId/replace",
  [
    protect,
    authorize("admin", "affiliate_manager"),
    body("newLeadId")
      .isMongoId()
      .withMessage("newLeadId must be a valid MongoDB ObjectId"),
  ],
  replaceLeadInOrder
);

// Add leads to an existing order (Admin only)
router.post(
  "/:orderId/add-leads",
  [
    protect,
    authorize("admin"),
    body("leads")
      .isArray({ min: 1 })
      .withMessage("At least one lead is required"),
    body("leads.*.leadId")
      .isMongoId()
      .withMessage("Each lead must have a valid leadId"),
    body("leads.*.agentId")
      .optional()
      .isMongoId()
      .withMessage("agentId must be a valid MongoDB ObjectId"),
    body("leads.*.leadType")
      .optional()
      .isIn(["ftd", "filler", "cold"])
      .withMessage("leadType must be ftd, filler, or cold"),
  ],
  addLeadsToOrder
);

module.exports = router;
