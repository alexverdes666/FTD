const ClientBrokerAuditLog = require("../models/ClientBrokerAuditLog");

/**
 * Client Broker Audit Service
 * Provides helper functions for logging client broker operations
 * Tracks: WHO did WHAT and WHEN
 */
class ClientBrokerAuditService {
  /**
   * Log a client broker audit event
   */
  static async log(options) {
    try {
      const {
        clientBrokerId,
        brokerName,
        userId,
        action,
        category,
        description,
        previousValue = null,
        newValue = null,
        metadata = {},
        req = null,
      } = options;

      const auditLog = new ClientBrokerAuditLog({
        clientBroker: clientBrokerId,
        brokerName,
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
        `[CLIENT_BROKER_AUDIT] ${new Date().toISOString()} | ` +
          `WHO: ${metadata.userFullName || "Unknown"} (${
            metadata.userEmail || "N/A"
          }) | ` +
          `WHAT: ${action} | ` +
          `BROKER: ${brokerName} | ` +
          `DETAILS: ${description}` +
          (req ? ` | IP: ${this.getClientIp(req)}` : "")
      );

      return auditLog;
    } catch (error) {
      console.error("Error creating client broker audit log:", error);
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
   * Log broker creation
   */
  static async logBrokerCreated(broker, user, req) {
    await this.log({
      clientBrokerId: broker._id,
      brokerName: broker.name,
      userId: user._id,
      action: "BROKER_CREATED",
      category: "broker",
      description: `Created client broker "${broker.name}"`,
      newValue: {
        name: broker.name,
        domain: broker.domain || null,
        description: broker.description || null,
        isActive: broker.isActive,
      },
      metadata: {
        userFullName: user.fullName,
        userEmail: user.email,
      },
      req,
    });
  }

  /**
   * Log broker deletion
   */
  static async logBrokerDeleted(broker, user, req) {
    await this.log({
      clientBrokerId: broker._id,
      brokerName: broker.name,
      userId: user._id,
      action: "BROKER_DELETED",
      category: "broker",
      description: `Deleted client broker "${broker.name}"`,
      previousValue: {
        name: broker.name,
        domain: broker.domain || null,
        description: broker.description || null,
        isActive: broker.isActive,
      },
      metadata: {
        userFullName: user.fullName,
        userEmail: user.email,
      },
      req,
    });
  }

  /**
   * Log broker update with detailed changes
   */
  static async logBrokerUpdated(broker, previousData, newData, user, req) {
    const changes = [];

    // Check for name change
    if (newData.name !== undefined && newData.name !== previousData.name) {
      changes.push(`name from "${previousData.name}" to "${newData.name}"`);
      await this.log({
        clientBrokerId: broker._id,
        brokerName: broker.name,
        userId: user._id,
        action: "NAME_CHANGED",
        category: "name",
        description: `Changed broker name from "${previousData.name}" to "${newData.name}"`,
        previousValue: previousData.name,
        newValue: newData.name,
        metadata: {
          userFullName: user.fullName,
          userEmail: user.email,
        },
        req,
      });
    }

    // Check for domain change
    if (newData.domain !== undefined && newData.domain !== previousData.domain) {
      const prevDomain = previousData.domain || "(empty)";
      const newDomain = newData.domain || "(empty)";
      changes.push("domain");
      await this.log({
        clientBrokerId: broker._id,
        brokerName: broker.name,
        userId: user._id,
        action: "DOMAIN_CHANGED",
        category: "domain",
        description: `Changed domain for broker "${broker.name}" from "${prevDomain}" to "${newDomain}"`,
        previousValue: previousData.domain || null,
        newValue: newData.domain || null,
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
        clientBrokerId: broker._id,
        brokerName: broker.name,
        userId: user._id,
        action: "DESCRIPTION_CHANGED",
        category: "description",
        description: `Changed description for broker "${broker.name}"`,
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
        broker,
        previousData.isActive,
        newData.isActive,
        user,
        req
      );
    }

    // Log general update if there are changes (but not status-only changes)
    if (changes.length > 0) {
      await this.log({
        clientBrokerId: broker._id,
        brokerName: broker.name,
        userId: user._id,
        action: "BROKER_UPDATED",
        category: "broker",
        description: `Updated broker "${broker.name}": changed ${changes.join(", ")}`,
        previousValue: {
          name: previousData.name,
          domain: previousData.domain,
          description: previousData.description,
        },
        newValue: {
          name: newData.name ?? previousData.name,
          domain: newData.domain ?? previousData.domain,
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
  static async logStatusChanged(broker, previousStatus, newStatus, user, req) {
    const statusText = newStatus ? "Active" : "Inactive";
    const prevStatusText = previousStatus ? "Active" : "Inactive";

    await this.log({
      clientBrokerId: broker._id,
      brokerName: broker.name,
      userId: user._id,
      action: "STATUS_CHANGED",
      category: "status",
      description: `${
        newStatus ? "Activated" : "Deactivated"
      } broker "${broker.name}" (${prevStatusText} → ${statusText})`,
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
   * Log PSP added to broker
   */
  static async logPSPAdded(broker, psp, user, req) {
    await this.log({
      clientBrokerId: broker._id,
      brokerName: broker.name,
      userId: user._id,
      action: "PSP_ADDED",
      category: "psp",
      description: `Added PSP "${psp.name}" to broker "${broker.name}"`,
      newValue: {
        pspId: psp._id,
        pspName: psp.name,
      },
      metadata: {
        userFullName: user.fullName,
        userEmail: user.email,
      },
      req,
    });
  }

  /**
   * Log PSP removed from broker
   */
  static async logPSPRemoved(broker, psp, user, req) {
    await this.log({
      clientBrokerId: broker._id,
      brokerName: broker.name,
      userId: user._id,
      action: "PSP_REMOVED",
      category: "psp",
      description: `Removed PSP "${psp.name}" from broker "${broker.name}"`,
      previousValue: {
        pspId: psp._id,
        pspName: psp.name,
      },
      metadata: {
        userFullName: user.fullName,
        userEmail: user.email,
      },
      req,
    });
  }

  /**
   * Get audit logs for a specific broker with pagination
   */
  static async getBrokerLogs(clientBrokerId, options = {}) {
    const {
      page = 1,
      limit = 20,
      category = null,
      action = null,
      startDate = null,
      endDate = null,
    } = options;

    const filter = { clientBroker: clientBrokerId };

    if (category) filter.category = category;
    if (action) filter.action = action;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      ClientBrokerAuditLog.find(filter)
        .populate("performedBy", "fullName email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ClientBrokerAuditLog.countDocuments(filter),
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
   * Get all broker audit logs with pagination and filters
   */
  static async getAllLogs(options = {}) {
    const {
      page = 1,
      limit = 20,
      clientBrokerId = null,
      userId = null,
      category = null,
      action = null,
      startDate = null,
      endDate = null,
      search = null,
    } = options;

    const filter = {};

    if (clientBrokerId) filter.clientBroker = clientBrokerId;
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
        { brokerName: new RegExp(search, "i") },
        { description: new RegExp(search, "i") },
      ];
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      ClientBrokerAuditLog.find(filter)
        .populate("performedBy", "fullName email role")
        .populate("clientBroker", "name isActive")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ClientBrokerAuditLog.countDocuments(filter),
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
}

module.exports = ClientBrokerAuditService;
