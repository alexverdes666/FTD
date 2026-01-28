const CardIssuerAuditLog = require("../models/CardIssuerAuditLog");

/**
 * Card Issuer Audit Service
 * Provides helper functions for logging Card Issuer operations
 * Tracks: WHO did WHAT and WHEN
 */
class CardIssuerAuditService {
  /**
   * Log a Card Issuer audit event
   */
  static async log(options) {
    try {
      const {
        cardIssuerId,
        cardIssuerName,
        userId,
        action,
        category,
        description,
        previousValue = null,
        newValue = null,
        metadata = {},
        req = null,
      } = options;

      const auditLog = new CardIssuerAuditLog({
        cardIssuer: cardIssuerId,
        cardIssuerName,
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
        `[CARD_ISSUER_AUDIT] ${new Date().toISOString()} | ` +
          `WHO: ${metadata.userFullName || "Unknown"} (${
            metadata.userEmail || "N/A"
          }) | ` +
          `WHAT: ${action} | ` +
          `CARD_ISSUER: ${cardIssuerName} | ` +
          `DETAILS: ${description}` +
          (req ? ` | IP: ${this.getClientIp(req)}` : "")
      );

      return auditLog;
    } catch (error) {
      console.error("Error creating Card Issuer audit log:", error);
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
   * Log Card Issuer creation
   */
  static async logCreated(cardIssuer, user, req) {
    await this.log({
      cardIssuerId: cardIssuer._id,
      cardIssuerName: cardIssuer.name,
      userId: user._id,
      action: "CARD_ISSUER_CREATED",
      category: "cardIssuer",
      description: `Created Card Issuer "${cardIssuer.name}"`,
      newValue: {
        name: cardIssuer.name,
        description: cardIssuer.description || null,
        logo: cardIssuer.logo || null,
        isActive: cardIssuer.isActive,
      },
      metadata: {
        userFullName: user.fullName,
        userEmail: user.email,
      },
      req,
    });
  }

  /**
   * Log Card Issuer deletion
   */
  static async logDeleted(cardIssuer, user, req) {
    await this.log({
      cardIssuerId: cardIssuer._id,
      cardIssuerName: cardIssuer.name,
      userId: user._id,
      action: "CARD_ISSUER_DELETED",
      category: "cardIssuer",
      description: `Deleted Card Issuer "${cardIssuer.name}"`,
      previousValue: {
        name: cardIssuer.name,
        description: cardIssuer.description || null,
        logo: cardIssuer.logo || null,
        isActive: cardIssuer.isActive,
      },
      metadata: {
        userFullName: user.fullName,
        userEmail: user.email,
      },
      req,
    });
  }

  /**
   * Log Card Issuer update with detailed changes
   */
  static async logUpdated(cardIssuer, previousData, newData, user, req) {
    const changes = [];

    // Check for name change
    if (newData.name !== undefined && newData.name !== previousData.name) {
      changes.push(`name from "${previousData.name}" to "${newData.name}"`);
      await this.log({
        cardIssuerId: cardIssuer._id,
        cardIssuerName: cardIssuer.name,
        userId: user._id,
        action: "NAME_CHANGED",
        category: "name",
        description: `Changed Card Issuer name from "${previousData.name}" to "${newData.name}"`,
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
        cardIssuerId: cardIssuer._id,
        cardIssuerName: cardIssuer.name,
        userId: user._id,
        action: "DESCRIPTION_CHANGED",
        category: "description",
        description: `Changed description for Card Issuer "${cardIssuer.name}"`,
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
        cardIssuer,
        previousData.isActive,
        newData.isActive,
        user,
        req
      );
    }

    // Log general update if there are changes (but not status-only changes)
    if (changes.length > 0) {
      await this.log({
        cardIssuerId: cardIssuer._id,
        cardIssuerName: cardIssuer.name,
        userId: user._id,
        action: "CARD_ISSUER_UPDATED",
        category: "cardIssuer",
        description: `Updated Card Issuer "${cardIssuer.name}": changed ${changes.join(", ")}`,
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
  static async logStatusChanged(cardIssuer, previousStatus, newStatus, user, req) {
    const statusText = newStatus ? "Active" : "Inactive";
    const prevStatusText = previousStatus ? "Active" : "Inactive";

    await this.log({
      cardIssuerId: cardIssuer._id,
      cardIssuerName: cardIssuer.name,
      userId: user._id,
      action: "STATUS_CHANGED",
      category: "status",
      description: `${
        newStatus ? "Activated" : "Deactivated"
      } Card Issuer "${cardIssuer.name}" (${prevStatusText} -> ${statusText})`,
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
   * Get audit logs for a specific Card Issuer with pagination
   */
  static async getCardIssuerLogs(cardIssuerId, options = {}) {
    const {
      page = 1,
      limit = 20,
      category = null,
      action = null,
      startDate = null,
      endDate = null,
    } = options;

    const filter = { cardIssuer: cardIssuerId };

    if (category) filter.category = category;
    if (action) filter.action = action;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      CardIssuerAuditLog.find(filter)
        .populate("performedBy", "fullName email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      CardIssuerAuditLog.countDocuments(filter),
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

module.exports = CardIssuerAuditService;
