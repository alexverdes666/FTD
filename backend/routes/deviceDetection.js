const express = require("express");
const router = express.Router();
const DeviceDetectionLog = require("../models/DeviceDetectionLog");
const { protect, authorize } = require("../middleware/auth");

/**
 * @route   GET /api/device-detection
 * @desc    Get device detection logs with filtering and pagination
 * @access  Admin only
 */
router.get("/", protect, authorize("admin"), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      user,
      method,
      startDate,
      endDate,
      minRiskScore,
      antidetect,
      proxy,
      status,
    } = req.query;

    // Build query
    const query = {};

    if (user) {
      query.user = user;
    }

    if (method) {
      query.method = method;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (minRiskScore) {
      query.riskScore = { $gte: parseInt(minRiskScore) };
    }

    if (antidetect === "true") {
      query["antidetect.isDetected"] = true;
    }

    if (proxy === "true") {
      query["proxy.isProxy"] = true;
    }

    if (status) {
      const statusCode = parseInt(status);
      query.statusCode = statusCode;
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, total] = await Promise.all([
      DeviceDetectionLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate("user", "fullName email role")
        .lean(),
      DeviceDetectionLog.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching device detection logs:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/device-detection/suspicious
 * @desc    Get suspicious activities (anti-detect, proxies, high risk)
 * @access  Admin only
 */
router.get("/suspicious", protect, authorize("admin"), async (req, res) => {
  try {
    const { hours = 24 } = req.query;

    const activities = await DeviceDetectionLog.getSuspiciousActivities(
      parseInt(hours)
    );

    res.json({
      success: true,
      timeWindow: `${hours} hours`,
      count: activities.length,
      data: activities,
    });
  } catch (error) {
    console.error("Error fetching suspicious activities:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/device-detection/user/:userId
 * @desc    Get activity summary for a specific user
 * @access  Admin only
 */
router.get("/user/:userId", protect, authorize("admin"), async (req, res) => {
  try {
    const { userId } = req.params;
    const { days = 30 } = req.query;

    const summary = await DeviceDetectionLog.getUserActivitySummary(
      userId,
      parseInt(days)
    );

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Error fetching user activity summary:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/device-detection/ip/:ipAddress
 * @desc    Get activity by IP address
 * @access  Admin only
 */
router.get("/ip/:ipAddress", protect, authorize("admin"), async (req, res) => {
  try {
    const { ipAddress } = req.params;
    const { hours = 24 } = req.query;

    const activities = await DeviceDetectionLog.getActivityByIP(
      ipAddress,
      parseInt(hours)
    );

    res.json({
      success: true,
      timeWindow: `${hours} hours`,
      ipAddress,
      count: activities.length,
      data: activities,
    });
  } catch (error) {
    console.error("Error fetching activity by IP:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/device-detection/account-sharing/:userId
 * @desc    Detect potential account sharing for a user
 * @access  Admin only
 */
router.get(
  "/account-sharing/:userId",
  protect,
  authorize("admin"),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { hours = 24 } = req.query;

      const analysis = await DeviceDetectionLog.detectAccountSharing(
        userId,
        parseInt(hours)
      );

      res.json({
        success: true,
        data: analysis,
      });
    } catch (error) {
      console.error("Error detecting account sharing:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  }
);

/**
 * @route   GET /api/device-detection/antidetect-stats
 * @desc    Get anti-detect browser usage statistics
 * @access  Admin only
 */
router.get(
  "/antidetect-stats",
  protect,
  authorize("admin"),
  async (req, res) => {
    try {
      const { hours = 24 } = req.query;

      const stats = await DeviceDetectionLog.getAntiDetectStats(
        parseInt(hours)
      );

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error("Error fetching anti-detect stats:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  }
);

/**
 * @route   GET /api/device-detection/stats
 * @desc    Get overall statistics
 * @access  Admin only
 */
router.get("/stats", protect, authorize("admin"), async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    const windowStart = new Date(Date.now() - hours * 60 * 60 * 1000);

    const [
      total,
      byMethod,
      byStatus,
      antidetectCount,
      proxyCount,
      highRiskCount,
    ] = await Promise.all([
      DeviceDetectionLog.countDocuments({ createdAt: { $gte: windowStart } }),
      DeviceDetectionLog.aggregate([
        { $match: { createdAt: { $gte: windowStart } } },
        { $group: { _id: "$method", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      DeviceDetectionLog.aggregate([
        { $match: { createdAt: { $gte: windowStart } } },
        {
          $group: {
            _id: {
              $cond: [
                { $gte: ["$statusCode", 500] },
                "5xx",
                {
                  $cond: [
                    { $gte: ["$statusCode", 400] },
                    "4xx",
                    {
                      $cond: [
                        { $gte: ["$statusCode", 300] },
                        "3xx",
                        {
                          $cond: [{ $gte: ["$statusCode", 200] }, "2xx", "1xx"],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      DeviceDetectionLog.countDocuments({
        "antidetect.isDetected": true,
        createdAt: { $gte: windowStart },
      }),
      DeviceDetectionLog.countDocuments({
        "proxy.isProxy": true,
        createdAt: { $gte: windowStart },
      }),
      DeviceDetectionLog.countDocuments({
        riskScore: { $gte: 50 },
        createdAt: { $gte: windowStart },
      }),
    ]);

    res.json({
      success: true,
      timeWindow: `${hours} hours`,
      data: {
        total,
        byMethod,
        byStatus,
        security: {
          antidetectBrowsers: antidetectCount,
          proxies: proxyCount,
          highRisk: highRiskCount,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching statistics:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/device-detection/:id
 * @desc    Get a single device detection log by ID
 * @access  Admin only
 */
router.get("/:id", protect, authorize("admin"), async (req, res) => {
  try {
    const log = await DeviceDetectionLog.findById(req.params.id)
      .populate("user", "fullName email role")
      .lean();

    if (!log) {
      return res.status(404).json({
        success: false,
        message: "Log not found",
      });
    }

    res.json({
      success: true,
      data: log,
    });
  } catch (error) {
    console.error("Error fetching device detection log:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

module.exports = router;
