const PSPAuditLog = require("../models/PSPAuditLog");

/**
 * PSP Audit Service
 * Provides helper functions for logging PSP operations
 * Tracks: WHO did WHAT and WHEN
 */
class PSPAuditService {
  /**
   * Log a PSP audit event
   */
  static async log(options) {
    try {
      const {
        pspId,
        pspName,
        userId,
        action,
        category,
        description,
        previousValue = null,
        newValue = null,
        metadata = {},
        req = null,
      } = options;

      const auditLog = new PSPAuditLog({
        psp: pspId,
        pspName,
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
        `[PSP_AUDIT] ${new Date().toISOString()} | ` +
          `WHO: ${metadata.userFullName || "Unknown"} (${
            metadata.userEmail || "N/A"
          }) | ` +
          `WHAT: ${action} | ` +
          `PSP: ${pspName} | ` +
          `DETAILS: ${description}` +
          (req ? ` | IP: ${this.getClientIp(req)}` : "")
      );

      return auditLog;
    } catch (error) {
      console.error("Error creating PSP audit log:", error);
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
   * Log PSP creation
   */
  static async logPSPCreated(psp, user, req) {
    await this.log({
      pspId: psp._id,
      pspName: psp.name,
      userId: user._id,
      action: "PSP_CREATED",
      category: "psp",
      description: `Created PSP "${psp.name}"`,
      newValue: {
        name: psp.name,
        description: psp.description || null,
        website: psp.website || null,
        isActive: psp.isActive,
      },
      metadata: {
        userFullName: user.fullName,
        userEmail: user.email,
      },
      req,
    });
  }

  /**
   * Log PSP deletion
   */
  static async logPSPDeleted(psp, user, req) {
    await this.log({
      pspId: psp._id,
      pspName: psp.name,
      userId: user._id,
      action: "PSP_DELETED",
      category: "psp",
      description: `Deleted PSP "${psp.name}"`,
      previousValue: {
        name: psp.name,
        description: psp.description || null,
        website: psp.website || null,
        isActive: psp.isActive,
      },
      metadata: {
        userFullName: user.fullName,
        userEmail: user.email,
      },
      req,
    });
  }

  /**
   * Log PSP update with detailed changes
   */
  static async logPSPUpdated(psp, previousData, newData, user, req) {
    const changes = [];

    // Check for name change
    if (newData.name !== undefined && newData.name !== previousData.name) {
      changes.push(`name from "${previousData.name}" to "${newData.name}"`);
      await this.log({
        pspId: psp._id,
        pspName: psp.name,
        userId: user._id,
        action: "NAME_CHANGED",
        category: "name",
        description: `Changed PSP name from "${previousData.name}" to "${newData.name}"`,
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
        pspId: psp._id,
        pspName: psp.name,
        userId: user._id,
        action: "DESCRIPTION_CHANGED",
        category: "description",
        description: `Changed description for PSP "${psp.name}"`,
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

    // Check for website change
    if (
      newData.website !== undefined &&
      newData.website !== previousData.website
    ) {
      const prevWebsite = previousData.website || "(empty)";
      const newWebsite = newData.website || "(empty)";
      changes.push("website");
      await this.log({
        pspId: psp._id,
        pspName: psp.name,
        userId: user._id,
        action: "WEBSITE_CHANGED",
        category: "website",
        description: `Changed website for PSP "${psp.name}" from "${prevWebsite}" to "${newWebsite}"`,
        previousValue: previousData.website || null,
        newValue: newData.website || null,
        metadata: {
          userFullName: user.fullName,
          userEmail: user.email,
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
        psp,
        previousData.isActive,
        newData.isActive,
        user,
        req
      );
    }

    // Log general update if there are changes (but not status-only changes)
    if (changes.length > 0) {
      await this.log({
        pspId: psp._id,
        pspName: psp.name,
        userId: user._id,
        action: "PSP_UPDATED",
        category: "psp",
        description: `Updated PSP "${psp.name}": changed ${changes.join(", ")}`,
        previousValue: {
          name: previousData.name,
          description: previousData.description,
          website: previousData.website,
        },
        newValue: {
          name: newData.name ?? previousData.name,
          description: newData.description ?? previousData.description,
          website: newData.website ?? previousData.website,
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
  static async logStatusChanged(psp, previousStatus, newStatus, user, req) {
    const statusText = newStatus ? "Active" : "Inactive";
    const prevStatusText = previousStatus ? "Active" : "Inactive";

    await this.log({
      pspId: psp._id,
      pspName: psp.name,
      userId: user._id,
      action: "STATUS_CHANGED",
      category: "status",
      description: `${
        newStatus ? "Activated" : "Deactivated"
      } PSP "${psp.name}" (${prevStatusText} → ${statusText})`,
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
   * Get audit logs for a specific PSP with pagination
   */
  static async getPSPLogs(pspId, options = {}) {
    const {
      page = 1,
      limit = 20,
      category = null,
      action = null,
      startDate = null,
      endDate = null,
    } = options;

    const filter = { psp: pspId };

    if (category) filter.category = category;
    if (action) filter.action = action;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      PSPAuditLog.find(filter)
        .populate("performedBy", "fullName email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      PSPAuditLog.countDocuments(filter),
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
   * Get all PSP audit logs with pagination and filters
   */
  static async getAllLogs(options = {}) {
    const {
      page = 1,
      limit = 20,
      pspId = null,
      userId = null,
      category = null,
      action = null,
      startDate = null,
      endDate = null,
      search = null,
    } = options;

    const filter = {};

    if (pspId) filter.psp = pspId;
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
        { pspName: new RegExp(search, "i") },
        { description: new RegExp(search, "i") },
      ];
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      PSPAuditLog.find(filter)
        .populate("performedBy", "fullName email role")
        .populate("psp", "name isActive")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      PSPAuditLog.countDocuments(filter),
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

module.exports = PSPAuditService;
