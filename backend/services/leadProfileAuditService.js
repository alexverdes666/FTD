const LeadProfileAuditLog = require("../models/LeadProfileAuditLog");
const { encrypt } = require("../utils/encryption");

/**
 * Lead Profile Audit Service
 * Provides helper functions for logging LeadProfileCredential operations
 * Tracks: WHO did WHAT and WHEN
 *
 * Sensitive field values (username, password, twoFactorSecret, recoveryCodes)
 * are encrypted before being stored in audit logs.
 */
class LeadProfileAuditService {
  static SENSITIVE_FIELDS = [
    "username",
    "password",
    "twoFactorSecret",
    "recoveryCodes",
  ];

  /**
   * Encrypt a value if it belongs to a sensitive field
   */
  static encryptSensitiveValue(fieldName, value) {
    if (!value) return value;
    if (!this.SENSITIVE_FIELDS.includes(fieldName)) return value;

    if (Array.isArray(value)) {
      return value.map((v) => (typeof v === "string" ? encrypt(v) : v));
    }
    if (typeof value === "string") {
      return encrypt(value);
    }
    return value;
  }

  /**
   * Log an audit event
   */
  static async log(options) {
    try {
      const {
        profileId,
        leadId,
        accountType,
        userId,
        action,
        category,
        description,
        previousValue = null,
        newValue = null,
        metadata = {},
        req = null,
      } = options;

      const auditLog = new LeadProfileAuditLog({
        leadProfileCredential: profileId,
        lead: leadId,
        accountType,
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

      console.log(
        `[LEAD_PROFILE_AUDIT] ${new Date().toISOString()} | ` +
          `WHO: ${metadata.userFullName || "Unknown"} (${
            metadata.userEmail || "N/A"
          }) | ` +
          `WHAT: ${action} | ` +
          `PROFILE: ${accountType} | ` +
          `DETAILS: ${description}` +
          (req ? ` | IP: ${this.getClientIp(req)}` : "")
      );

      return auditLog;
    } catch (error) {
      console.error("Error creating Lead Profile audit log:", error);
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
   * Log profile creation
   */
  static async logCreated(profile, lead, user, req) {
    await this.log({
      profileId: profile._id,
      leadId: lead._id,
      accountType: profile.accountType,
      userId: user._id,
      action: "PROFILE_CREATED",
      category: "profile",
      description: `Created ${profile.accountType} profile credential for lead "${lead.firstName} ${lead.lastName}"`,
      newValue: {
        accountType: profile.accountType,
        username: this.encryptSensitiveValue("username", profile.username),
        hasPassword: !!profile.password,
        hasTwoFactor: !!profile.twoFactorSecret,
        recoveryCodesCount: Array.isArray(profile.recoveryCodes)
          ? profile.recoveryCodes.length
          : 0,
        notes: profile.notes || null,
      },
      metadata: {
        userFullName: user.fullName,
        userEmail: user.email,
        leadName: `${lead.firstName} ${lead.lastName}`,
      },
      req,
    });
  }

  /**
   * Log profile deletion
   */
  static async logDeleted(profile, lead, user, req) {
    await this.log({
      profileId: profile._id,
      leadId: lead._id || profile.lead,
      accountType: profile.accountType,
      userId: user._id,
      action: "PROFILE_DELETED",
      category: "profile",
      description: `Deleted ${profile.accountType} profile credential`,
      previousValue: {
        accountType: profile.accountType,
        username: this.encryptSensitiveValue("username", profile.username),
        hasPassword: !!profile.password,
        hasTwoFactor: !!profile.twoFactorSecret,
        recoveryCodesCount: Array.isArray(profile.recoveryCodes)
          ? profile.recoveryCodes.length
          : 0,
        notes: profile.notes || null,
      },
      metadata: {
        userFullName: user.fullName,
        userEmail: user.email,
      },
      req,
    });
  }

  /**
   * Log profile update with detailed per-field change tracking
   */
  static async logUpdated(profile, previousData, newData, lead, user, req) {
    const changes = [];
    const userMeta = {
      userFullName: user.fullName,
      userEmail: user.email,
    };

    // Account type change
    if (
      newData.accountType !== undefined &&
      newData.accountType !== previousData.accountType
    ) {
      changes.push(
        `account type from "${previousData.accountType}" to "${newData.accountType}"`
      );
      await this.log({
        profileId: profile._id,
        leadId: lead._id || profile.lead,
        accountType: profile.accountType,
        userId: user._id,
        action: "ACCOUNT_TYPE_CHANGED",
        category: "accountType",
        description: `Changed account type from "${previousData.accountType}" to "${newData.accountType}"`,
        previousValue: previousData.accountType,
        newValue: newData.accountType,
        metadata: userMeta,
        req,
      });
    }

    // Username change
    if (
      newData.username !== undefined &&
      newData.username !== previousData.username
    ) {
      changes.push("username");
      await this.log({
        profileId: profile._id,
        leadId: lead._id || profile.lead,
        accountType: profile.accountType,
        userId: user._id,
        action: "USERNAME_CHANGED",
        category: "username",
        description: `Changed username for ${profile.accountType} profile`,
        previousValue: this.encryptSensitiveValue(
          "username",
          previousData.username
        ),
        newValue: this.encryptSensitiveValue("username", newData.username),
        metadata: userMeta,
        req,
      });
    }

    // Password change
    if (
      newData.password !== undefined &&
      newData.password !== previousData.password
    ) {
      changes.push("password");
      await this.log({
        profileId: profile._id,
        leadId: lead._id || profile.lead,
        accountType: profile.accountType,
        userId: user._id,
        action: "PASSWORD_CHANGED",
        category: "password",
        description: `Changed password for ${profile.accountType} profile`,
        previousValue: this.encryptSensitiveValue(
          "password",
          previousData.password
        ),
        newValue: this.encryptSensitiveValue("password", newData.password),
        metadata: userMeta,
        req,
      });
    }

    // Two-factor secret change
    if (
      newData.twoFactorSecret !== undefined &&
      newData.twoFactorSecret !== previousData.twoFactorSecret
    ) {
      changes.push("2FA secret");
      await this.log({
        profileId: profile._id,
        leadId: lead._id || profile.lead,
        accountType: profile.accountType,
        userId: user._id,
        action: "TWO_FACTOR_CHANGED",
        category: "twoFactor",
        description: `Changed 2FA secret for ${profile.accountType} profile`,
        previousValue: this.encryptSensitiveValue(
          "twoFactorSecret",
          previousData.twoFactorSecret
        ),
        newValue: this.encryptSensitiveValue(
          "twoFactorSecret",
          newData.twoFactorSecret
        ),
        metadata: userMeta,
        req,
      });
    }

    // Recovery codes change
    if (newData.recoveryCodes !== undefined) {
      const prevCodes = JSON.stringify(previousData.recoveryCodes || []);
      const newCodes = JSON.stringify(newData.recoveryCodes || []);
      if (prevCodes !== newCodes) {
        changes.push("recovery codes");
        await this.log({
          profileId: profile._id,
          leadId: lead._id || profile.lead,
          accountType: profile.accountType,
          userId: user._id,
          action: "RECOVERY_CODES_CHANGED",
          category: "recoveryCodes",
          description: `Changed recovery codes for ${profile.accountType} profile`,
          previousValue: this.encryptSensitiveValue(
            "recoveryCodes",
            previousData.recoveryCodes
          ),
          newValue: this.encryptSensitiveValue(
            "recoveryCodes",
            newData.recoveryCodes
          ),
          metadata: {
            ...userMeta,
            previousCount: (previousData.recoveryCodes || []).length,
            newCount: (newData.recoveryCodes || []).length,
          },
          req,
        });
      }
    }

    // Notes change
    if (
      newData.notes !== undefined &&
      newData.notes !== previousData.notes
    ) {
      changes.push("notes");
      await this.log({
        profileId: profile._id,
        leadId: lead._id || profile.lead,
        accountType: profile.accountType,
        userId: user._id,
        action: "NOTES_CHANGED",
        category: "notes",
        description: `Changed notes for ${profile.accountType} profile`,
        previousValue: previousData.notes || null,
        newValue: newData.notes || null,
        metadata: userMeta,
        req,
      });
    }

  }

  /**
   * Get audit logs for all profiles of a specific lead
   */
  static async getLeadProfileLogs(leadId, options = {}) {
    const {
      page = 1,
      limit = 20,
      category = null,
      action = null,
      startDate = null,
      endDate = null,
    } = options;

    const filter = { lead: leadId };
    if (category) filter.category = category;
    if (action) filter.action = action;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      LeadProfileAuditLog.find(filter)
        .populate("performedBy", "fullName email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      LeadProfileAuditLog.countDocuments(filter),
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

module.exports = LeadProfileAuditService;
