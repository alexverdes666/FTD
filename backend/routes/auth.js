const express = require("express");
const { body } = require("express-validator");
const { protect } = require("../middleware/auth");
const { authActivityLogger } = require("../middleware/activityLogger");
const {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  getRelatedAccounts,
  switchAccount,
  verify2FAAndLogin,
  getMySessions,
  terminateSession,
  terminateAllSessions,
} = require("../controllers/auth");
const router = express.Router();
router.post(
  "/register",
  [
    authActivityLogger,
    body("fullName")
      .notEmpty()
      .withMessage("Full name is required")
      .isLength({ min: 2 })
      .withMessage("Full name must be at least 2 characters"),
    body("email")
      .isEmail()
      .withMessage("Invalid email format")
      .normalizeEmail()
      .withMessage("Email is required"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters")
      .exists()
      .withMessage("Password is required"),
  ],
  register
);
router.post(
  "/login",
  [
    authActivityLogger,
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Please include a valid email"),
    body("password").exists().withMessage("Password is required"),
  ],
  login
);
router.post(
  "/verify-2fa-login",
  [
    authActivityLogger,
    body("userId").exists().withMessage("User ID is required"),
    body("token").exists().withMessage("Verification token is required"),
  ],
  verify2FAAndLogin
);
router.get("/me", protect, getMe);
router.put(
  "/profile",
  [
    protect,
    body("fullName")
      .optional()
      .trim()
      .isLength({ min: 2 })
      .withMessage("Full name must be at least 2 characters"),
    body("email")
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage("Please include a valid email"),
  ],
  updateProfile
);
router.put(
  "/password",
  [
    protect,
    body("currentPassword")
      .exists()
      .withMessage("Current password is required"),
    body("newPassword")
      .isLength({ min: 6 })
      .withMessage("New password must be at least 6 characters"),
  ],
  changePassword
);

// Session management routes
router.get("/sessions", protect, getMySessions);
router.post("/sessions/terminate-all", protect, terminateAllSessions);
router.delete("/sessions/:sessionId", protect, terminateSession);

// Account switching routes
router.get("/related-accounts", protect, getRelatedAccounts);
router.post(
  "/switch-account",
  [
    authActivityLogger,
    protect,
    body("accountId").isMongoId().withMessage("Invalid account ID"),
  ],
  switchAccount
);

// Debug endpoint for current user's linked accounts
router.get("/debug-links", protect, async (req, res, next) => {
  try {
    const User = require("../models/User");
    const user = await User.findById(req.user.id)
      .populate("linkedAccounts", "fullName email role isActive status")
      .populate("primaryAccount", "fullName email role");

    res.json({
      success: true,
      data: {
        currentUser: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
        },
        linkedAccounts: user.linkedAccounts || [],
        linkedAccountsRaw:
          user.linkedAccounts?.map((acc) => ({
            id: acc._id,
            fullName: acc.fullName,
            email: acc.email,
            role: acc.role,
            isActive: acc.isActive,
            status: acc.status,
          })) || [],
        primaryAccount: user.primaryAccount,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
