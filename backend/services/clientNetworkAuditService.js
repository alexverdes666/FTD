const ClientNetworkAuditLog = require("../models/ClientNetworkAuditLog");

/**
 * Client Network Audit Service
 * Provides helper functions for logging client network operations
 * Tracks: WHO did WHAT and WHEN
 */
class ClientNetworkAuditService {
  /**
   * Log a client network audit event
   * @param {Object} options - Audit log options
   * @param {string} options.clientNetworkId - Client Network ID
   * @param {string} options.networkName - Network name
   * @param {string} options.userId - User ID who performed the action
   * @param {string} options.action - Action type
   * @param {string} options.category - Category of action
   * @param {string} options.description - Human-readable description
   * @param {*} [options.previousValue] - Previous value
   * @param {*} [options.newValue] - New value
   * @param {Object} [options.metadata] - Additional metadata
   * @param {Object} [options.req] - Express request object for IP/user agent
   */
  static async log(options) {
    try {
      const {
        clientNetworkId,
        networkName,
        userId,
        action,
        category,
        description,
        previousValue = null,
        newValue = null,
        metadata = {},
        req = null,
      } = options;

      const auditLog = new ClientNetworkAuditLog({
        clientNetwork: clientNetworkId,
        networkName,
        performedBy: userId,
        action,
        category,
        description,
        previousValue,
        newValue,
        metadata,
        ipAddress: req ? this.getClientIp(req) : null,
        userAgent: req ? req.headers["user-agent"] : null,
      });

      await auditLog.save();

      // Log to console for visibility
      console.log(
        `[CLIENT_NETWORK_AUDIT] ${new Date().toISOString()} | ` +
          `WHO: ${metadata.userFullName || "Unknown"} (${
            metadata.userEmail || "N/A"
          }) | ` +
          `WHAT: ${action} | ` +
          `NETWORK: ${networkName} | ` +
          `DETAILS: ${description}` +
          (req ? ` | IP: ${this.getClientIp(req)}` : "")
      );

      return auditLog;
    } catch (error) {
      console.error("Error creating client network audit log:", error);
      // Don't throw - audit logging should not break main operations
      return null;
    }
  }

  /**
   * Get client IP address from request
   */
  static getClientIp(req) {
    return (
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.ip ||
      req.connection?.remoteAddress ||
      null
    );
  }

  /**
   * Log network creation
   */
  static async logNetworkCreated(network, user, req) {
    await this.log({
      clientNetworkId: network._id,
      networkName: network.name,
      userId: user._id,
      action: "NETWORK_CREATED",
      category: "network",
      description: `Created client network "${network.name}"`,
      newValue: {
        name: network.name,
        description: network.description || null,
        isActive: network.isActive,
      },
      metadata: {
        userFullName: user.fullName,
        userEmail: user.email,
      },
      req,
    });
  }

  /**
   * Log network deletion
   */
  static async logNetworkDeleted(network, user, req) {
    await this.log({
      clientNetworkId: network._id,
      networkName: network.name,
      userId: user._id,
      action: "NETWORK_DELETED",
      category: "network",
      description: `Deleted client network "${network.name}"`,
      previousValue: {
        name: network.name,
        description: network.description || null,
        isActive: network.isActive,
      },
      metadata: {
        userFullName: user.fullName,
        userEmail: user.email,
      },
      req,
    });
  }

  /**
   * Log network update with detailed changes
   */
  static async logNetworkUpdated(network, previousData, newData, user, req) {
    const changes = [];

    // Check for name change
    if (newData.name !== undefined && newData.name !== previousData.name) {
      changes.push(`name from "${previousData.name}" to "${newData.name}"`);
      await this.log({
        clientNetworkId: network._id,
        networkName: network.name,
        userId: user._id,
        action: "NAME_CHANGED",
        category: "name",
        description: `Changed client network name from "${previousData.name}" to "${newData.name}"`,
        previousValue: previousData.name,
        newValue: newData.name,
        metadata: {
          userFullName: user.fullName,
          userEmail: user.email,
        },
        req,
      });
    }

    // Check for description change
    if (
      newData.description !== undefined &&
      newData.description !== previousData.description
    ) {
      const prevDesc = previousData.description || "(empty)";
      const newDesc = newData.description || "(empty)";
      changes.push("description");
      await this.log({
        clientNetworkId: network._id,
        networkName: network.name,
        userId: user._id,
        action: "DESCRIPTION_CHANGED",
        category: "description",
        description: `Changed description for client network "${network.name}"`,
        previousValue: previousData.description || null,
        newValue: newData.description || null,
        metadata: {
          userFullName: user.fullName,
          userEmail: user.email,
          previousSummary: prevDesc.substring(0, 100),
          newSummary: newDesc.substring(0, 100),
        },
        req,
      });
    }

    // Check for status change
    if (
      newData.isActive !== undefined &&
      newData.isActive !== previousData.isActive
    ) {
      await this.logStatusChanged(
        network,
        previousData.isActive,
        newData.isActive,
        user,
        req
      );
    }

    // Log general update if there are changes (but not status-only changes)
    if (changes.length > 0) {
      await this.log({
        clientNetworkId: network._id,
        networkName: network.name,
        userId: user._id,
        action: "NETWORK_UPDATED",
        category: "network",
        description: `Updated client network "${
          network.name
        }": changed ${changes.join(", ")}`,
        previousValue: {
          name: previousData.name,
          description: previousData.description,
        },
        newValue: {
          name: newData.name ?? previousData.name,
          description: newData.description ?? previousData.description,
        },
        metadata: {
          userFullName: user.fullName,
          userEmail: user.email,
          changedFields: changes,
        },
        req,
      });
    }
  }

  /**
   * Log status change (activate/deactivate)
   */
  static async logStatusChanged(network, previousStatus, newStatus, user, req) {
    const statusText = newStatus ? "Active" : "Inactive";
    const prevStatusText = previousStatus ? "Active" : "Inactive";

    await this.log({
      clientNetworkId: network._id,
      networkName: network.name,
      userId: user._id,
      action: "STATUS_CHANGED",
      category: "status",
      description: `${
        newStatus ? "Activated" : "Deactivated"
      } client network "${network.name}" (${prevStatusText} → ${statusText})`,
      previousValue: previousStatus,
      newValue: newStatus,
      metadata: {
        userFullName: user.fullName,
        userEmail: user.email,
        previousStatus: prevStatusText,
        newStatus: statusText,
      },
      req,
    });
  }

  /**
   * Get audit logs for a specific client network with pagination
   */
  static async getNetworkLogs(clientNetworkId, options = {}) {
    const {
      page = 1,
      limit = 20,
      category = null,
      action = null,
      startDate = null,
      endDate = null,
    } = options;

    const filter = { clientNetwork: clientNetworkId };

    if (category) filter.category = category;
    if (action) filter.action = action;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      ClientNetworkAuditLog.find(filter)
        .populate("performedBy", "fullName email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ClientNetworkAuditLog.countDocuments(filter),
    ]);

    return {
      logs,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit,
      },
    };
  }

  /**
   * Get all client network audit logs with pagination and filters
   */
  static async getAllLogs(options = {}) {
    const {
      page = 1,
      limit = 20,
      clientNetworkId = null,
      userId = null,
      category = null,
      action = null,
      startDate = null,
      endDate = null,
      search = null,
    } = options;

    const filter = {};

    if (clientNetworkId) filter.clientNetwork = clientNetworkId;
    if (userId) filter.performedBy = userId;
    if (category) filter.category = category;
    if (action) filter.action = action;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    if (search) {
      filter.$or = [
        { networkName: new RegExp(search, "i") },
        { description: new RegExp(search, "i") },
      ];
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      ClientNetworkAuditLog.find(filter)
        .populate("performedBy", "fullName email role")
        .populate("clientNetwork", "name isActive")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ClientNetworkAuditLog.countDocuments(filter),
    ]);

    return {
      logs,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit,
      },
    };
  }

  /**
   * Get audit log statistics
   */
  static async getStats(options = {}) {
    const {
      startDate = null,
      endDate = null,
      clientNetworkId = null,
    } = options;

    const matchStage = {};
    if (clientNetworkId) matchStage.clientNetwork = clientNetworkId;
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    const [actionStats, userStats, recentActivity] = await Promise.all([
      // Stats by action type
      ClientNetworkAuditLog.aggregate([
        { $match: matchStage },
        { $group: { _id: "$action", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      // Stats by user
      ClientNetworkAuditLog.aggregate([
        { $match: matchStage },
        { $group: { _id: "$performedBy", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: "$user" },
        {
          $project: {
            _id: 1,
            count: 1,
            fullName: "$user.fullName",
            email: "$user.email",
          },
        },
      ]),
      // Recent activity count (last 24 hours)
      ClientNetworkAuditLog.countDocuments({
        ...matchStage,
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }),
    ]);

    return {
      actionStats,
      userStats,
      recentActivity,
    };
  }
}

module.exports = ClientNetworkAuditService;
