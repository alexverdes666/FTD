const express = require("express");
const { body } = require("express-validator");
const {
    getClientBrokers,
    getClientBroker,
    getClientBrokerProfile,
    createClientBroker,
    updateClientBroker,
    deleteClientBroker,
    assignLeadToBroker,
    unassignLeadFromBroker,
    getBrokerLeads,
    getBrokerStats,
    addPSP,
    removePSP,
    getBrokerAuditLogs,
    getBrokerOrdersWithLeads,
} = require("../controllers/clientBrokers");
const { protect, isAdmin, authorize } = require("../middleware/auth");
const router = express.Router();
router.get("/", protect, getClientBrokers);
router.get("/stats", protect, getBrokerStats);

// Profile and audit log routes (must be before /:id)
router.get("/:id/profile", protect, getClientBrokerProfile);
router.get("/:id/audit-logs", protect, isAdmin, getBrokerAuditLogs);
router.get("/:id/orders-leads", protect, getBrokerOrdersWithLeads);

// PSP management routes
router.post(
    "/:id/psps",
    [
        protect,
        isAdmin,
        body("pspId")
            .isMongoId()
            .withMessage("Valid PSP ID is required"),
    ],
    addPSP
);
router.delete("/:id/psps/:pspId", [protect, isAdmin], removePSP);

router.get("/:id", protect, getClientBroker);
router.post(
    "/",
    [
        protect,
        isAdmin,
        body("name")
            .trim()
            .isLength({ min: 1, max: 100 })
            .withMessage("Broker name is required and must be less than 100 characters"),
        body("domain")
            .optional()
            .trim()
            .isLength({ max: 200 })
            .withMessage("Domain must be less than 200 characters"),
        body("description")
            .optional()
            .trim()
            .isLength({ max: 500 })
            .withMessage("Description must be less than 500 characters"),
    ],
    createClientBroker
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
            .withMessage("Broker name must be less than 100 characters"),
        body("domain")
            .optional()
            .trim()
            .isLength({ max: 200 })
            .withMessage("Domain must be less than 200 characters"),
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
    updateClientBroker
);
router.delete("/:id", [protect, isAdmin], deleteClientBroker);
router.post(
    "/:id/assign-lead",
    [
        protect,
        authorize("admin", "affiliate_manager"),
        body("leadId")
            .isMongoId()
            .withMessage("Valid lead ID is required"),
        body("orderId")
            .optional()
            .isMongoId()
            .withMessage("Order ID must be valid"),
        body("intermediaryClientNetwork")
            .optional()
            .isMongoId()
            .withMessage("Client network ID must be valid"),
        body("domain")
            .optional()
            .trim(),
    ],
    assignLeadToBroker
);
router.delete(
    "/:id/unassign-lead/:leadId",
    [protect, authorize("admin", "affiliate_manager")],
    unassignLeadFromBroker
);
router.get("/:id/leads", [protect, authorize("admin", "affiliate_manager")], getBrokerLeads);
module.exports = router;