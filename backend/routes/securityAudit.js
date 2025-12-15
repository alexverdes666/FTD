const express = require("express");
const { query } = require("express-validator");
const { protect, isAdmin } = require("../middleware/auth");
const SensitiveActionAuditLog = require("../models/SensitiveActionAuditLog");

const router = express.Router();

/**
 * @route   GET /api/security-audit
 * @desc    Get sensitive action audit logs
 * @access  Admin only
 */
router.get(
  "/",
  [
    protect,
    isAdmin,
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    query("userId").optional().isMongoId().withMessage("Invalid user ID"),
    query("action").optional().isString(),
    query("success").optional().isBoolean(),
  ],
  async (req, res, next) => {
    try {
      const {
        page = 1,
        limit = 20,
        userId,
        action,
        success,
        startDate,
        endDate,
        ipAddress,
      } = req.query;

      const filter = {};

      if (userId) filter.user = userId;
      if (action) filter.action = action;
      if (success !== undefined) filter.success = success === "true";
      if (ipAddress) filter.ipAddress = ipAddress;

      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [logs, total] = await Promise.all([
        SensitiveActionAuditLog.find(filter)
          .populate("user", "fullName email role")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        SensitiveActionAuditLog.countDocuments(filter),
      ]);

      res.status(200).json({
        success: true,
        data: logs,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total,
          limit: parseInt(limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/security-audit/summary
 * @desc    Get security summary for dashboard
 * @access  Admin only
 */
router.get("/summary", [protect, isAdmin], async (req, res, next) => {
  try {
    const { hours = 24 } = req.query;
    const summary = await SensitiveActionAuditLog.getSecuritySummary(
      parseInt(hours)
    );

    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/security-audit/failed-attempts
 * @desc    Get recent failed attempts (potential attack indicators)
 * @access  Admin only
 */
router.get("/failed-attempts", [protect, isAdmin], async (req, res, next) => {
  try {
    const { hours = 24, limit = 50 } = req.query;
    const windowStart = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000);

    const failedAttempts = await SensitiveActionAuditLog.find({
      success: false,
      createdAt: { $gte: windowStart },
    })
      .populate("user", "fullName email role")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      data: failedAttempts,
      timeWindow: `${hours} hours`,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/security-audit/user/:userId
 * @desc    Get audit logs for a specific user
 * @access  Admin only
 */
router.get("/user/:userId", [protect, isAdmin], async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, total] = await Promise.all([
      SensitiveActionAuditLog.find({ user: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      SensitiveActionAuditLog.countDocuments({ user: userId }),
    ]);

    res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;





