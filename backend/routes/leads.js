const express = require("express");
const mongoose = require("mongoose");
const { body, query } = require("express-validator");
const {
  protect,
  isAdmin,
  isAgent,
  authorize,
  isLeadManager,
  affiliateManager,
} = require("../middleware/auth");
const {
  getLeads,
  getAssignedLeads,
  getLeadById,
  addComment,
  updateLeadStatus,
  getLeadStats,
  assignLeads,
  unassignLeads,
  updateLead,
  createLead,
  deleteLead,
  importLeads,
  getLeadsForManager,
  getColdLeads,
  updateLeadType,
  bulkDeleteLeads,
  assignClientBrokerToLead,
  assignCampaignToLead,
  getLeadAssignmentHistory,
  getClientBrokerAnalytics,
  storeLeadSession,
  getLeadSession,
  updateLeadSession,
  clearLeadSession,
  accessLeadSession,
  updateLeadCallNumber,
  assignLeadsToAgent,
  unassignLeadsFromAgent,
  getLeadsByAgent,
  searchLeadsByEmails,
  archiveLead,
  unarchiveLead,
  getArchivedLeads,
  getLeadAuditHistory,
  getLeadFullHistory,
  confirmDeposit,
  unconfirmDeposit,
  markAsShaved,
  unmarkAsShaved,
  assignSimCardToLeads,
  getGlobalLeadAuditLogs,
  batchValidateIPQS,
} = require("../controllers/leads");
const router = express.Router();
router.get(
  "/",
  [
    protect,
    authorize("admin", "affiliate_manager", "lead_manager"),
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    query("leadType")
      .optional()
      .isIn(["ftd", "filler", "cold"])
      .withMessage("Lead type must be ftd, filler, or cold"),
    query("country")
      .optional()
      .trim()
      .isLength({ min: 2 })
      .withMessage("Country must be at least 2 characters"),
    query("isAssigned")
      .optional()
      .isBoolean()
      .withMessage("isAssigned must be a boolean"),
    query("documentStatus")
      .optional()
      .isIn(["good", "ok", "pending"])
      .withMessage("Document status must be good, ok, or pending"),
    query("status")
      .optional()
      .isIn(["active", "contacted", "converted", "inactive"])
      .withMessage("Status must be active, contacted, converted, or inactive"),
    query("order")
      .optional()
      .isIn(["newest", "oldest", "name_asc", "name_desc"])
      .withMessage("Order must be newest, oldest, name_asc, or name_desc"),
    query("orderId")
      .optional()
      .isMongoId()
      .withMessage("Invalid order ID format"),
    query("assignedToMe")
      .optional()
      .isBoolean()
      .withMessage("assignedToMe must be a boolean"),
  ],
  getLeads
);
router.get(
  "/assigned",
  [
    protect,
    isAgent,
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    query("leadType")
      .optional()
      .isIn(["ftd", "filler", "cold"])
      .withMessage("Lead type must be ftd, filler, or cold"),
    query("status")
      .optional()
      .isIn(["active", "contacted", "converted", "inactive"])
      .withMessage("Status must be active, contacted, converted, or inactive"),
  ],
  getAssignedLeads
);
router.get(
  "/stats",
  [protect, authorize("admin", "affiliate_manager")],
  getLeadStats
);
router.get(
  "/client-broker-analytics",
  [
    protect,
    authorize("admin", "affiliate_manager"),
    query("orderId")
      .optional()
      .isMongoId()
      .withMessage("Invalid order ID format"),
  ],
  getClientBrokerAnalytics
);

// Get archived leads
router.get(
  "/archived",
  [
    protect,
    authorize("admin"),
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
      .trim(),
    query("leadType")
      .optional()
      .isIn(["ftd", "filler", "cold"])
      .withMessage("Lead type must be ftd, filler, or cold"),
  ],
  getArchivedLeads
);

// Global audit logs (all changes across all leads) - must be before /:id route
router.get(
  "/global-audit-logs",
  [
    protect,
    authorize("admin", "affiliate_manager", "lead_manager"),
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    query("leadId")
      .optional()
      .isMongoId()
      .withMessage("Invalid lead ID format"),
    query("changedBy")
      .optional()
      .isMongoId()
      .withMessage("Invalid user ID format"),
    query("fieldName")
      .optional()
      .trim(),
    query("startDate")
      .optional()
      .isISO8601()
      .withMessage("Start date must be a valid date"),
    query("endDate")
      .optional()
      .isISO8601()
      .withMessage("End date must be a valid date"),
    query("search")
      .optional()
      .trim(),
  ],
  getGlobalLeadAuditLogs
);

router.get(
  "/:id",
  [protect, authorize("admin", "affiliate_manager", "agent")],
  getLeadById
);
router.put(
  "/:id/comment",
  [
    protect,
    body("text")
      .trim()
      .notEmpty()
      .isLength({ min: 1, max: 1000 })
      .withMessage(
        "Comment text is required and must be less than 1000 characters"
      ),
  ],
  addComment
);
router.put(
  "/:id/status",
  [
    protect,
    authorize("admin", "affiliate_manager", "agent"),
    body("status")
      .isIn(["active", "contacted", "converted", "inactive"])
      .withMessage("Status must be active, contacted, converted, or inactive"),
  ],
  updateLeadStatus
);

// Archive a lead
router.put(
  "/:id/archive",
  [protect, authorize("admin")],
  archiveLead
);

// Unarchive a lead
router.put(
  "/:id/unarchive",
  [protect, authorize("admin")],
  unarchiveLead
);

router.put(
  "/:id/assign-client-broker",
  [
    protect,
    authorize("admin", "affiliate_manager"),
    body("clientBrokerId")
      .isMongoId()
      .withMessage("Valid client broker ID is required"),
    body("client").optional().trim(),
    body("intermediaryClientNetwork")
      .optional()
      .isMongoId()
      .withMessage("Client network ID must be valid"),
    body("domain").optional().trim(),
  ],
  assignClientBrokerToLead
);
router.put(
  "/:id/assign-campaign",
  [
    protect,
    authorize("admin", "affiliate_manager"),
    body("campaignId")
      .notEmpty()
      .withMessage("Campaign ID is required")
      .isMongoId()
      .withMessage("Valid campaign ID is required"),
    body("orderId")
      .optional()
      .isMongoId()
      .withMessage("Order ID must be valid"),
  ],
  assignCampaignToLead
);
router.get(
  "/:id/assignment-history",
  [protect, authorize("admin", "affiliate_manager")],
  getLeadAssignmentHistory
);

// Search leads by email addresses (for manual order creation)
router.post(
  "/search-by-emails",
  [
    protect,
    authorize("admin", "affiliate_manager"),
    body("emails")
      .isArray({ min: 1 })
      .withMessage("emails must be a non-empty array"),
  ],
  searchLeadsByEmails
);

router.post(
  "/assign",
  [
    protect,
    authorize("admin", "affiliate_manager"),
    body("leadIds")
      .isArray({ min: 1 })
      .withMessage("leadIds must be a non-empty array"),
    body("leadIds.*")
      .isMongoId()
      .withMessage("Each leadId must be a valid MongoDB ObjectId"),
    body("agentId")
      .isMongoId()
      .withMessage("agentId must be a valid MongoDB ObjectId"),
  ],
  assignLeads
);
router.post(
  "/unassign",
  [
    protect,
    authorize("admin", "affiliate_manager"),
    body("leadIds")
      .isArray({ min: 1 })
      .withMessage("leadIds must be a non-empty array"),
    body("leadIds.*")
      .isMongoId()
      .withMessage("Each leadId must be a valid MongoDB ObjectId"),
  ],
  unassignLeads
);
router.post(
  "/",
  [
    protect,
    authorize("admin", "affiliate_manager", "lead_manager"),
    body("firstName")
      .trim()
      .isLength({ min: 2 })
      .withMessage("First name must be at least 2 characters"),
    body("lastName")
      .trim()
      .isLength({ min: 2 })
      .withMessage("Last name must be at least 2 characters"),
    body("gender")
      .optional()
      .isIn(["male", "female", "not_defined"])
      .withMessage("Gender must be male, female, or not_defined"),
    body("newEmail")
      .trim()
      .isEmail()
      .withMessage("Please provide a valid new email"),
    body("oldEmail")
      .optional()
      .custom((value) => {
        if (!value || value.trim() === "") {
          return true;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          throw new Error("Please provide a valid old email");
        }
        return true;
      }),
    body("newPhone").trim().notEmpty().withMessage("New phone is required"),
    body("oldPhone").optional().trim(),
    body("country")
      .trim()
      .isLength({ min: 2 })
      .withMessage("Country must be at least 2 characters"),
    body("leadType")
      .isIn(["ftd", "filler", "cold"])
      .withMessage("Invalid lead type"),
    body("sin")
      .optional()
      .trim(),
  ],
  createLead
);
router.put("/:id", [
  protect, 
  authorize("admin", "lead_manager", "affiliate_manager"),
  body("clientBroker")
    .optional()
    .custom((value) => {
      if (value && value !== "" && !mongoose.Types.ObjectId.isValid(value)) {
        throw new Error("clientBroker must be a valid MongoDB ObjectId");
      }
      return true;
    }),
], updateLead);
router.delete(
  "/bulk-delete",
  [
    (req, res, next) => {
      console.log("Bulk delete route hit:", {
        method: req.method,
        path: req.path,
        body: req.body,
        user: req.user ? { id: req.user.id, role: req.user.role } : null,
      });
      next();
    },
    protect,
    isAdmin,
  ],
  bulkDeleteLeads
);

// Batch validate leads with IPQS
router.post(
  "/batch-validate-ipqs",
  [
    protect,
    authorize("admin", "affiliate_manager"),
    body("leadIds")
      .isArray({ min: 1 })
      .withMessage("leadIds must be a non-empty array"),
    body("leadIds.*")
      .isMongoId()
      .withMessage("Each leadId must be a valid MongoDB ObjectId"),
  ],
  batchValidateIPQS
);

// Audit history routes (must come before /:id to avoid route conflicts)
router.get(
  "/:id/audit-history",
  [protect, authorize("admin", "affiliate_manager", "lead_manager")],
  getLeadAuditHistory
);
router.get(
  "/:id/full-history",
  [protect, authorize("admin", "affiliate_manager", "lead_manager")],
  getLeadFullHistory
);

router.delete("/:id", [protect, isAdmin], deleteLead);
router.post(
  "/import",
  [protect, authorize("admin", "affiliate_manager", "lead_manager")],
  importLeads
);

router.post(
  "/:id/session",
  [
    protect,
    authorize("admin", "affiliate_manager"),
    body("sessionData")
      .notEmpty()
      .withMessage("Session data is required")
      .isObject()
      .withMessage("Session data must be an object"),
    body("sessionData.sessionId")
      .notEmpty()
      .withMessage("Session ID is required"),
    body("sessionData.cookies")
      .optional()
      .isArray()
      .withMessage("Cookies must be an array"),
    body("sessionData.localStorage")
      .optional()
      .isObject()
      .withMessage("localStorage must be an object"),
    body("sessionData.sessionStorage")
      .optional()
      .isObject()
      .withMessage("sessionStorage must be an object"),
    body("sessionData.userAgent")
      .optional()
      .isString()
      .withMessage("User agent must be a string"),
    body("sessionData.viewport")
      .optional()
      .isObject()
      .withMessage("Viewport must be an object"),
    body("orderId")
      .optional()
      .isMongoId()
      .withMessage("Order ID must be valid"),
  ],
  storeLeadSession
);
router.get(
  "/:id/session",
  [
    protect,
    authorize("admin", "affiliate_manager", "agent"),
    query("sessionId")
      .optional()
      .isString()
      .withMessage("Session ID must be a string"),
    query("includeHistory")
      .optional()
      .isBoolean()
      .withMessage("includeHistory must be a boolean"),
  ],
  getLeadSession
);
router.put(
  "/:id/session",
  [
    protect,
    authorize("admin", "affiliate_manager"),
    body("sessionId")
      .notEmpty()
      .withMessage("Session ID is required"),
    body("sessionData")
      .optional()
      .isObject()
      .withMessage("Session data must be an object"),
    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean"),
    body("metadata")
      .optional()
      .isObject()
      .withMessage("Metadata must be an object"),
  ],
  updateLeadSession
);
router.delete(
  "/:id/session",
  [
    protect,
    authorize("admin", "affiliate_manager"),
    query("sessionId")
      .optional()
      .isString()
      .withMessage("Session ID must be a string"),
    query("clearAll")
      .optional()
      .isBoolean()
      .withMessage("clearAll must be a boolean"),
  ],
  clearLeadSession
);
router.post(
  "/:id/access-session",
  [
    protect,
    authorize("admin", "affiliate_manager", "agent"),
  ],
  accessLeadSession
);

router.put(
  "/:id/call-number",
  [
    protect,
    authorize("agent"), // Only agents can update call numbers
    body("callNumber")
      .optional({ nullable: true })
      .custom((value) => {
        if (value === null || value === undefined || value === "") {
          return true; // Allow null/empty values to clear call number
        }
        if (!["1st", "2nd", "3rd", "4th", "5th"].includes(value)) {
          throw new Error("Call number must be 1st, 2nd, 3rd, 4th, or 5th, or null to clear");
        }
        return true;
      }),
    body("notes")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Notes must be less than 500 characters"),
  ],
  updateLeadCallNumber
);

// Agent assignment routes
router.post(
  "/assign-to-agent",
  [
    protect,
    authorize("admin", "affiliate_manager"),
    body("leadIds")
      .isArray({ min: 1 })
      .withMessage("leadIds must be a non-empty array"),
    body("leadIds.*")
      .isMongoId()
      .withMessage("Each leadId must be a valid MongoDB ObjectId"),
    body("agentId")
      .optional({ nullable: true })
      .custom((value) => {
        if (value !== null && value !== undefined) {
          // Only validate if not null/undefined
          if (!/^[0-9a-fA-F]{24}$/.test(value)) {
            throw new Error('agentId must be a valid MongoDB ObjectId or null');
          }
        }
        return true;
      }),
  ],
  assignLeadsToAgent
);

router.post(
  "/unassign-from-agent",
  [
    protect,
    authorize("admin", "affiliate_manager"),
    body("leadIds")
      .isArray({ min: 1 })
      .withMessage("leadIds must be a non-empty array"),
    body("leadIds.*")
      .isMongoId()
      .withMessage("Each leadId must be a valid MongoDB ObjectId"),
  ],
  unassignLeadsFromAgent
);

router.get(
  "/agent/:agentId",
  [
    protect,
    authorize("admin", "affiliate_manager"),
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    query("leadType")
      .optional()
      .isIn(["ftd", "filler"])
      .withMessage("Lead type must be ftd or filler"),
  ],
  getLeadsByAgent
);

// Confirm deposit for a lead
router.put(
  "/:id/confirm-deposit",
  [protect, authorize("admin", "affiliate_manager")],
  confirmDeposit
);

// Unconfirm deposit for a lead (admin only)
router.put(
  "/:id/unconfirm-deposit",
  [protect, authorize("admin")],
  unconfirmDeposit
);

// Mark lead as shaved (brand didn't show deposit)
router.put(
  "/:id/mark-shaved",
  [protect, authorize("admin", "affiliate_manager")],
  markAsShaved
);

// Unmark lead as shaved (admin only)
router.put(
  "/:id/unmark-shaved",
  [protect, authorize("admin")],
  unmarkAsShaved
);

// Assign SIM card to FTD leads
router.post(
  "/assign-simcard",
  [
    protect,
    authorize("admin", "lead_manager"),
    body("leadIds")
      .isArray({ min: 1 })
      .withMessage("leadIds must be a non-empty array"),
    body("simCardId")
      .optional()
      .custom((value) => {
        if (value === null || value === undefined) {
          return true;
        }
        if (!mongoose.Types.ObjectId.isValid(value)) {
          throw new Error("Invalid SIM card ID");
        }
        return true;
      }),
  ],
  assignSimCardToLeads
);

module.exports = router;