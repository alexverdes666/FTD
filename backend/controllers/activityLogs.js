/**
 * Activity Logs Controller
 *
 * Provides endpoints for querying and analyzing activity logs.
 * Only accessible by admin users.
 */

const ActivityLog = require("../models/ActivityLog");

/**
 * Get activity logs with filtering and pagination
 * @route GET /api/activity-logs
 * @access Admin only
 */
exports.getActivityLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      // Filters
      user,
      email,
      method,
      path,
      basePath,
      statusCode,
      statusCategory,
      actionType,
      ip,
      startDate,
      endDate,
      minRiskScore,
      deviceType,
      browser,
      os,
      isBot,
      hasError,
      // Sort
      sortBy = "timestamp",
      sortOrder = "desc",
    } = req.query;

    // Build query
    const query = {};

    // User filters
    if (user) {
      query.user = user;
    }
    if (email) {
      query["userSnapshot.email"] = { $regex: email, $options: "i" };
    }

    // Request filters
    if (method) {
      query.method = method.toUpperCase();
    }
    if (path) {
      query.path = { $regex: path, $options: "i" };
    }
    if (basePath) {
      query.basePath = basePath;
    }
    if (statusCode) {
      query.statusCode = parseInt(statusCode);
    }
    if (statusCategory) {
      query.statusCategory = statusCategory;
    }
    if (actionType) {
      query.actionType = { $regex: actionType, $options: "i" };
    }

    // IP filter
    if (ip) {
      query.ip = { $regex: ip, $options: "i" };
    }

    // Date range filter
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        query.timestamp.$lte = new Date(endDate);
      }
    }

    // Risk score filter
    if (minRiskScore) {
      query.riskScore = { $gte: parseInt(minRiskScore) };
    }

    // Device filters
    if (deviceType) {
      query["device.type"] = deviceType;
    }
    if (browser) {
      query["browser.name"] = { $regex: browser, $options: "i" };
    }
    if (os) {
      query["os.name"] = { $regex: os, $options: "i" };
    }
    if (isBot !== undefined) {
      query.isBot = isBot === "true";
    }

    // Error filter
    if (hasError === "true") {
      query.statusCode = { $gte: 400 };
    }

    // Build sort object
    const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, totalCount] = await Promise.all([
      ActivityLog.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate("user", "fullName email role")
        .lean(),
      ActivityLog.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        limit: parseInt(limit),
        hasNextPage: skip + logs.length < totalCount,
        hasPrevPage: parseInt(page) > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching activity logs:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching activity logs",
      error: error.message,
    });
  }
};

/**
 * Get activity log by ID
 * @route GET /api/activity-logs/:id
 * @access Admin only
 */
exports.getActivityLogById = async (req, res) => {
  try {
    const log = await ActivityLog.findById(req.params.id)
      .populate("user", "fullName email role")
      .lean();

    if (!log) {
      return res.status(404).json({
        success: false,
        message: "Activity log not found",
      });
    }

    res.json({
      success: true,
      data: log,
    });
  } catch (error) {
    console.error("Error fetching activity log:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching activity log",
      error: error.message,
    });
  }
};

/**
 * Get user activity summary
 * @route GET /api/activity-logs/user/:userId/summary
 * @access Admin only
 */
exports.getUserActivitySummary = async (req, res) => {
  try {
    const { userId } = req.params;
    const { hours = 24 } = req.query;

    const summary = await ActivityLog.getUserActivitySummary(
      userId,
      parseInt(hours)
    );

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Error fetching user activity summary:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user activity summary",
      error: error.message,
    });
  }
};

/**
 * Get IP activity
 * @route GET /api/activity-logs/ip/:ip
 * @access Admin only
 */
exports.getIPActivity = async (req, res) => {
  try {
    const { ip } = req.params;
    const { hours = 24 } = req.query;

    const activity = await ActivityLog.getIPActivity(ip, parseInt(hours));

    res.json({
      success: true,
      data: activity,
    });
  } catch (error) {
    console.error("Error fetching IP activity:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching IP activity",
      error: error.message,
    });
  }
};

/**
 * Get failed requests summary
 * @route GET /api/activity-logs/analytics/failed-requests
 * @access Admin only
 */
exports.getFailedRequestsSummary = async (req, res) => {
  try {
    const { hours = 24 } = req.query;

    const summary = await ActivityLog.getFailedRequestsSummary(parseInt(hours));

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Error fetching failed requests summary:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching failed requests summary",
      error: error.message,
    });
  }
};

/**
 * Get high-risk activity
 * @route GET /api/activity-logs/analytics/high-risk
 * @access Admin only
 */
exports.getHighRiskActivity = async (req, res) => {
  try {
    const { minRiskScore = 50, hours = 24 } = req.query;

    const activity = await ActivityLog.getHighRiskActivity(
      parseInt(minRiskScore),
      parseInt(hours)
    );

    res.json({
      success: true,
      data: activity,
    });
  } catch (error) {
    console.error("Error fetching high-risk activity:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching high-risk activity",
      error: error.message,
    });
  }
};

/**
 * Get endpoint analytics
 * @route GET /api/activity-logs/analytics/endpoints
 * @access Admin only
 */
exports.getEndpointAnalytics = async (req, res) => {
  try {
    const { hours = 24 } = req.query;

    const analytics = await ActivityLog.getEndpointAnalytics(parseInt(hours));

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error("Error fetching endpoint analytics:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching endpoint analytics",
      error: error.message,
    });
  }
};

/**
 * Get activity dashboard stats
 * @route GET /api/activity-logs/dashboard
 * @access Admin only
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    const windowStart = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000);

    const [
      totalRequests,
      uniqueUsers,
      uniqueIPs,
      errorCount,
      byMethod,
      byStatusCategory,
      topEndpoints,
      topUsers,
      recentHighRisk,
    ] = await Promise.all([
      // Total requests
      ActivityLog.countDocuments({ timestamp: { $gte: windowStart } }),

      // Unique users
      ActivityLog.distinct("user", {
        timestamp: { $gte: windowStart },
        user: { $ne: null },
      }),

      // Unique IPs
      ActivityLog.distinct("ip", { timestamp: { $gte: windowStart } }),

      // Error count
      ActivityLog.countDocuments({
        timestamp: { $gte: windowStart },
        statusCode: { $gte: 400 },
      }),

      // Requests by method
      ActivityLog.aggregate([
        { $match: { timestamp: { $gte: windowStart } } },
        { $group: { _id: "$method", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // Requests by status category
      ActivityLog.aggregate([
        { $match: { timestamp: { $gte: windowStart } } },
        { $group: { _id: "$statusCategory", count: { $sum: 1 } } },
      ]),

      // Top endpoints
      ActivityLog.aggregate([
        { $match: { timestamp: { $gte: windowStart } } },
        {
          $group: {
            _id: { method: "$method", path: "$basePath" },
            count: { $sum: 1 },
            avgDuration: { $avg: "$duration" },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),

      // Top users
      ActivityLog.aggregate([
        {
          $match: {
            timestamp: { $gte: windowStart },
            user: { $ne: null },
          },
        },
        {
          $group: {
            _id: "$user",
            email: { $first: "$userSnapshot.email" },
            fullName: { $first: "$userSnapshot.fullName" },
            requestCount: { $sum: 1 },
          },
        },
        { $sort: { requestCount: -1 } },
        { $limit: 10 },
      ]),

      // Recent high-risk activity
      ActivityLog.find({
        timestamp: { $gte: windowStart },
        riskScore: { $gte: 30 },
      })
        .sort({ riskScore: -1, timestamp: -1 })
        .limit(5)
        .select(
          "timestamp method path statusCode userSnapshot ip riskScore securityFlags"
        )
        .lean(),
    ]);

    res.json({
      success: true,
      data: {
        timeWindow: `${hours} hours`,
        summary: {
          totalRequests,
          uniqueUsers: uniqueUsers.length,
          uniqueIPs: uniqueIPs.length,
          errorCount,
          errorRate:
            totalRequests > 0
              ? ((errorCount / totalRequests) * 100).toFixed(2) + "%"
              : "0%",
        },
        byMethod: Object.fromEntries(byMethod.map((m) => [m._id, m.count])),
        byStatusCategory: Object.fromEntries(
          byStatusCategory.map((s) => [s._id || "unknown", s.count])
        ),
        topEndpoints,
        topUsers,
        recentHighRisk,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard stats",
      error: error.message,
    });
  }
};

/**
 * Get real-time activity stream (last N entries)
 * @route GET /api/activity-logs/stream
 * @access Admin only
 */
exports.getActivityStream = async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const logs = await ActivityLog.find()
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .select(
        "timestamp method path statusCode userSnapshot ip device browser duration actionType"
      )
      .lean();

    res.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    console.error("Error fetching activity stream:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching activity stream",
      error: error.message,
    });
  }
};

/**
 * Export activity logs to CSV
 * @route GET /api/activity-logs/export
 * @access Admin only
 */
exports.exportActivityLogs = async (req, res) => {
  try {
    const { startDate, endDate, limit = 10000 } = req.query;

    const query = {};
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const logs = await ActivityLog.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .select(
        "timestamp requestId method path statusCode userSnapshot ip device browser os duration actionType riskScore"
      )
      .lean();

    // Convert to CSV
    const headers = [
      "Timestamp",
      "Request ID",
      "Method",
      "Path",
      "Status",
      "User Email",
      "User Name",
      "User Role",
      "IP",
      "Device Type",
      "Browser",
      "OS",
      "Duration (ms)",
      "Action Type",
      "Risk Score",
    ];

    const rows = logs.map((log) => [
      log.timestamp?.toISOString() || "",
      log.requestId || "",
      log.method || "",
      log.path || "",
      log.statusCode || "",
      log.userSnapshot?.email || "",
      log.userSnapshot?.fullName || "",
      log.userSnapshot?.role || "",
      log.ip || "",
      log.device?.type || "",
      log.browser?.name || "",
      log.os?.name || "",
      log.duration || "",
      log.actionType || "",
      log.riskScore || "",
    ]);

    const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join(
      "\n"
    );

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=activity-logs-${
        new Date().toISOString().split("T")[0]
      }.csv`
    );
    res.send(csv);
  } catch (error) {
    console.error("Error exporting activity logs:", error);
    res.status(500).json({
      success: false,
      message: "Error exporting activity logs",
      error: error.message,
    });
  }
};

/**
 * Delete old activity logs
 * @route DELETE /api/activity-logs/cleanup
 * @access Admin only
 */
exports.cleanupOldLogs = async (req, res) => {
  try {
    const { days = 90 } = req.query;

    const deletedCount = await ActivityLog.cleanOldLogs(parseInt(days));

    res.json({
      success: true,
      message: `Deleted ${deletedCount} activity logs older than ${days} days`,
      deletedCount,
    });
  } catch (error) {
    console.error("Error cleaning up activity logs:", error);
    res.status(500).json({
      success: false,
      message: "Error cleaning up activity logs",
      error: error.message,
    });
  }
};
