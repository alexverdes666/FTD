const express = require("express");
const { body, query } = require("express-validator");
const {
  protect,
  isAdmin,
  ownerOrAdmin,
  isManager,
} = require("../middleware/auth");
const schedulerService = require("../services/scheduler");
const {
  requireSensitiveActionVerification,
} = require("../middleware/sensitiveAction");
const {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserPermissions,
  deleteUser,
  permanentDeleteUser,
  approveUser,
  getUserStats,
  getAgentPerformance,
  updateAgentPerformance,
  getTopPerformers,
  getDailyTeamStats,
  syncAgentPerformance,
  assignAsLeadManager,
  approveLeadManager,
  acceptEula,
  adminChangeUserPassword,
  getAgentsWithLeadStats,
  getAgentsWithFilteredLeadStats,
  kickUserSession,
} = require("../controllers/users");
const router = express.Router();
router.put("/accept-eula", protect, acceptEula);
router.get(
  "/",
  [
    protect,
    (req, res, next) => {
      if (req.user.role === "affiliate_manager") {
        if (req.query.role === "agent" || req.query.role === "affiliate_manager") {
          return next();
        }
        return res.status(403).json({
          success: false,
          message: "Affiliate managers can only view agent or affiliate manager lists",
        });
      }
      if (req.user.role === "agent") {
        if (req.query.role === "affiliate_manager") {
          return next();
        }
        return res.status(403).json({
          success: false,
          message: "Agents can only view affiliate manager lists",
        });
      }
      if (req.user.role === "admin") {
        return next();
      }
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    },
  ],
  getUsers
);
router.get("/stats", [protect, isAdmin], getUserStats);
router.get("/team-stats", [protect, isAdmin], getDailyTeamStats);
router.get(
  "/top-performers",
  [
    protect,
    isAdmin,
    query("period")
      .optional()
      .isIn(["daily", "weekly", "monthly", "yearly", "all"])
      .withMessage(
        "Period must be one of: daily, weekly, monthly, yearly, all"
      ),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage("Limit must be between 1 and 50"),
    query("forceRefresh")
      .optional()
      .isBoolean()
      .withMessage("forceRefresh must be a boolean"),
  ],
  getTopPerformers
);
router.post("/sync-performance", [protect, isAdmin], syncAgentPerformance);

// ===== SIP Agent Sync Routes =====
// These must come BEFORE /:id routes or Express will treat "sip-sync" as an ID
// Preview what agents would be created from external SIP API
router.get("/sip-sync/preview", [protect, isAdmin], async (req, res) => {
  try {
    const result = await schedulerService.getSipSyncPreview();
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error("SIP sync preview error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get SIP sync preview",
      error: error.message
    });
  }
});

// Manually trigger SIP agent sync
router.post("/sip-sync/trigger", [protect, isAdmin], async (req, res) => {
  try {
    const result = await schedulerService.triggerSipAgentSync();
    res.json({
      success: true,
      message: "SIP agent sync completed",
      data: result
    });
  } catch (error) {
    console.error("SIP sync trigger error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to trigger SIP sync",
      error: error.message
    });
  }
});

router.get("/agents-with-lead-stats", [protect], getAgentsWithLeadStats);
router.post(
  "/agents-with-filtered-lead-stats",
  [protect],
  getAgentsWithFilteredLeadStats
);

// ===== User Preferences Routes =====
// IMPORTANT: These must come BEFORE /:id routes or Express will treat "preferences" as an ID
const User = require("../models/User");

// Get user's copy preferences for orders
router.get("/preferences/copy", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("preferences");
    
    
    // Return defaults if no preferences set
    const copyConfig = user?.preferences?.ordersCopyConfig || {
      fields: ["leadType", "fullName", "newEmail", "newPhone", "country"],
      separator: "\t"
    };
    
    res.json({
      success: true,
      data: copyConfig
    });
  } catch (error) {
    console.error("Get copy preferences error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get copy preferences"
    });
  }
});

// Save user's copy preferences for orders
router.put(
  "/preferences/copy",
  [
    protect,
    body("fields")
      .isArray({ min: 1 })
      .withMessage("Fields must be a non-empty array"),
    body("separator")
      .optional()
      .isString()
      .withMessage("Separator must be a string")
  ],
  async (req, res) => {
    try {
      const { fields, separator = "\t" } = req.body;
      
      // Validate fields
      const validFields = [
        "leadType", "fullName", "newEmail", "newPhone", "country",
        "address", "assignedAgent", "ourNetwork", "campaign",
        "clientNetwork", "clientBrokers", "requester", "createdAt", "plannedDate",
        "dob", "documents"
      ];
      
      const invalidFields = fields.filter(f => !validFields.includes(f));
      if (invalidFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid fields: ${invalidFields.join(", ")}`
        });
      }
      
      // Update user preferences - use dot-notation to avoid overwriting sibling preference keys
      const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        {
          $set: {
            "preferences.ordersCopyConfig": {
              fields: fields,
              separator: separator
            }
          }
        },
        { new: true, runValidators: true }
      ).select("preferences");
      
      
      res.json({
        success: true,
        message: "Copy preferences saved successfully",
        data: { fields, separator }
      });
    } catch (error) {
      console.error("Save copy preferences error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to save copy preferences",
        error: error.message
      });
    }
  }
);

// Get user's sidebar navigation order
router.get("/preferences/sidebar-order", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("preferences.sidebarNavOrder");
    const navOrder = user?.preferences?.sidebarNavOrder || [];
    res.json({ success: true, data: { navOrder } });
  } catch (error) {
    console.error("Get sidebar nav order error:", error);
    res.status(500).json({ success: false, message: "Failed to get sidebar nav order" });
  }
});

// Save user's sidebar navigation order
router.put(
  "/preferences/sidebar-order",
  [
    protect,
    body("navOrder")
      .isArray()
      .withMessage("navOrder must be an array"),
    body("navOrder.*")
      .isString()
      .withMessage("Each item in navOrder must be a string path"),
  ],
  async (req, res) => {
    try {
      const { navOrder } = req.body;

      await User.findByIdAndUpdate(
        req.user._id,
        { $set: { "preferences.sidebarNavOrder": navOrder } },
        { new: true, runValidators: true }
      );

      res.json({
        success: true,
        message: "Sidebar nav order saved",
        data: { navOrder }
      });
    } catch (error) {
      console.error("Save sidebar nav order error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to save sidebar nav order",
        error: error.message
      });
    }
  }
);

router.get("/:id", [protect, ownerOrAdmin], getUserById);
router.post(
  "/",
  [
    protect,
    isAdmin,
    // Require 2FA verification for creating users
    requireSensitiveActionVerification("USER_CREATE", {
      targetResourceType: "user",
      getTargetResource: () => null, // New user, no ID yet
    }),
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Please include a valid email"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
    body("fullName")
      .trim()
      .isLength({ min: 2 })
      .withMessage("Full name must be at least 2 characters"),
    body("role")
      .isIn([
        "admin",
        "affiliate_manager",
        "agent",
        "lead_manager",
        "refunds_manager",
        "inventory_manager",
      ])
      .withMessage(
        "Role must be admin, affiliate_manager, agent, lead_manager, refunds_manager, or inventory_manager"
      ),
    body("fourDigitCode")
      .optional()
      .isLength({ min: 4, max: 4 })
      .isNumeric()
      .withMessage("Four digit code must be exactly 4 digits"),
    body("permissions.canCreateOrders")
      .optional()
      .isBoolean()
      .withMessage("canCreateOrders must be a boolean"),
    body("permissions.canManageLeads")
      .optional()
      .isBoolean()
      .withMessage("canManageLeads must be a boolean"),
    body("permissions.canManageRefunds")
      .optional()
      .isBoolean()
      .withMessage("canManageRefunds must be a boolean"),
    body("permissions.canManageSimCards")
      .optional()
      .isBoolean()
      .withMessage("canManageSimCards must be a boolean"),
    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean"),
  ],
  createUser
);
router.put(
  "/:id/approve",
  [
    protect,
    isAdmin,
    body("role", "A valid role is required for approval").isIn([
      "admin",
      "affiliate_manager",
      "agent",
      "lead_manager",
    ]),
  ],
  approveUser
);
router.put(
  "/:id",
  [
    protect,
    ownerOrAdmin,
    body("email")
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage("Please include a valid email"),
    body("fullName")
      .optional()
      .trim()
      .isLength({ min: 2 })
      .withMessage("Full name must be at least 2 characters"),
    body("role")
      .optional()
      .isIn([
        "admin",
        "affiliate_manager",
        "agent",
        "lead_manager",
        "refunds_manager",
        "inventory_manager",
      ])
      .withMessage(
        "Role must be admin, affiliate_manager, agent, lead_manager, refunds_manager, or inventory_manager"
      ),
    body("fourDigitCode")
      .optional()
      .isLength({ min: 4, max: 4 })
      .isNumeric()
      .withMessage("Four digit code must be exactly 4 digits"),
    body("permissions.canCreateOrders")
      .optional()
      .isBoolean()
      .withMessage("canCreateOrders must be a boolean"),
    body("permissions.canManageLeads")
      .optional()
      .isBoolean()
      .withMessage("canManageLeads must be a boolean"),
    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive must be a boolean"),
  ],
  updateUser
);
router.put(
  "/:id/permissions",
  [
    protect,
    isAdmin,
    body("permissions").isObject().withMessage("Permissions must be an object"),
    body("permissions.canCreateOrders")
      .optional()
      .isBoolean()
      .withMessage("canCreateOrders must be a boolean"),
  ],
  updateUserPermissions
);

router.put(
  "/:id/password",
  [
    protect,
    isAdmin,
    // Require 2FA verification for changing user passwords
    requireSensitiveActionVerification("USER_UPDATE_PASSWORD", {
      targetResourceType: "user",
    }),
    body("newPassword")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
  ],
  adminChangeUserPassword
);
router.post(
  "/:id/kick-session",
  [
    protect,
    isAdmin,
    // Require 2FA verification for kicking user sessions
    requireSensitiveActionVerification("USER_KICK_SESSION", {
      targetResourceType: "user",
    }),
  ],
  kickUserSession
);
router.delete(
  "/:id",
  [
    protect,
    isAdmin,
    // Require 2FA verification for deleting users
    requireSensitiveActionVerification("USER_DELETE", {
      targetResourceType: "user",
    }),
  ],
  deleteUser
);
router.delete(
  "/:id/permanent",
  [
    protect,
    isAdmin,
    // Require 2FA verification for permanently deleting users
    requireSensitiveActionVerification("USER_DELETE", {
      targetResourceType: "user",
    }),
  ],
  permanentDeleteUser
);
router.get(
  "/:id/performance",
  [
    protect,
    ownerOrAdmin,
    query("startDate")
      .optional()
      .isISO8601()
      .withMessage("Start date must be a valid ISO date"),
    query("endDate")
      .optional()
      .isISO8601()
      .withMessage("End date must be a valid ISO date"),
  ],
  getAgentPerformance
);
router.put(
  "/:id/performance",
  [
    protect,
    ownerOrAdmin,
    body("date").isISO8601().withMessage("Date must be a valid ISO date"),
    body("callTimeMinutes")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Call time must be a non-negative integer"),
    body("earnings")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Earnings must be a non-negative number"),
    body("penalties")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Penalties must be a non-negative number"),
    body("leadsContacted")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Leads contacted must be a non-negative integer"),
    body("leadsConverted")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Leads converted must be a non-negative integer"),
    body("callsCompleted")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Calls completed must be a non-negative integer"),
  ],
  updateAgentPerformance
);
router.put(
  "/:id/assign-lead-manager",
  [
    protect,
    isAdmin,
    body("assignAsLeadManager")
      .isBoolean()
      .withMessage("assignAsLeadManager must be a boolean"),
  ],
  assignAsLeadManager
);
router.put(
  "/:id/approve-lead-manager",
  [
    protect,
    isAdmin,
    body("approved").isBoolean().withMessage("approved must be a boolean"),
    body("reason")
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1 })
      .withMessage("If provided, reason must be a non-empty string"),
  ],
  approveLeadManager
);

module.exports = router;
