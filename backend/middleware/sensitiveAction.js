const speakeasy = require("speakeasy");
const User = require("../models/User");
const { decrypt } = require("../utils/encryption");
const SensitiveActionAuditLog = require("../models/SensitiveActionAuditLog");

/**
 * Sensitive Action Verification Middleware
 *
 * This middleware requires 2FA verification for sensitive operations.
 * It prevents attacks where a compromised session is used to perform
 * critical actions without the attacker having access to the 2FA device.
 *
 * Usage:
 *   router.put("/wallets", [protect, isAdmin, requireSensitiveActionVerification("WALLET_UPDATE")], handler);
 *
 * The client must include:
 *   - Header: x-2fa-code: <6-digit TOTP code>
 *   OR
 *   - Header: x-2fa-backup-code: <8-character backup code>
 */

// Define sensitive action types for audit logging
const SENSITIVE_ACTIONS = {
  // Wallet operations
  WALLET_CREATE: "Create network with wallets",
  WALLET_UPDATE: "Update network wallets",
  WALLET_DELETE: "Delete network",

  // User management
  USER_CREATE: "Create user",
  USER_UPDATE_ROLE: "Update user role",
  USER_UPDATE_PASSWORD: "Change user password",
  USER_DELETE: "Delete user",
  USER_KICK_SESSION: "Kick user session",

  // Security settings
  SECURITY_DISABLE_2FA: "Disable 2FA",
  SECURITY_REGENERATE_BACKUP: "Regenerate backup codes",

  // System configuration
  SYSTEM_CONFIG_UPDATE: "Update system configuration",
};

/**
 * Get client IP address from request
 */
const getClientIP = (req) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return (
    req.headers["x-real-ip"] ||
    req.ip ||
    req.connection?.remoteAddress ||
    "unknown"
  );
};

/**
 * Log sensitive action attempt (success or failure)
 */
const logSensitiveAction = async (options) => {
  try {
    const {
      userId,
      userEmail,
      action,
      actionDescription,
      success,
      failureReason = null,
      targetResource = null,
      targetResourceType = null,
      req,
    } = options;

    await SensitiveActionAuditLog.create({
      user: userId,
      userEmail,
      action,
      actionDescription,
      success,
      failureReason,
      targetResource,
      targetResourceType,
      ipAddress: getClientIP(req),
      userAgent: req.headers["user-agent"] || null,
      requestPath: req.originalUrl,
      requestMethod: req.method,
    });
  } catch (error) {
    console.error("Error logging sensitive action:", error);
    // Don't throw - logging should not break the request
  }
};

/**
 * Middleware factory for requiring 2FA verification on sensitive actions
 * @param {string} actionType - The type of sensitive action (from SENSITIVE_ACTIONS)
 * @param {Object} options - Additional options
 * @param {boolean} options.require2FA - If true, users without 2FA enabled will be blocked (default: true for admins)
 * @param {string} options.targetResourceType - Type of resource being affected (e.g., "network", "user")
 * @param {function} options.getTargetResource - Function to extract target resource ID from request
 */
const requireSensitiveActionVerification = (actionType, options = {}) => {
  const {
    require2FAEnabled = true,
    targetResourceType = null,
    getTargetResource = (req) => req.params.id || null,
  } = options;

  return async (req, res, next) => {
    try {
      const userId = req.user._id || req.user.id;
      const userEmail = req.user.email;
      const actionDescription = SENSITIVE_ACTIONS[actionType] || actionType;

      // Get 2FA codes from headers
      const totpCode = req.headers["x-2fa-code"];
      const backupCode = req.headers["x-2fa-backup-code"];

      // Fetch user with 2FA secrets
      const user = await User.findById(userId).select(
        "+twoFactorSecret +twoFactorBackupCodes"
      );

      if (!user) {
        await logSensitiveAction({
          userId,
          userEmail,
          action: actionType,
          actionDescription,
          success: false,
          failureReason: "User not found",
          targetResource: getTargetResource(req),
          targetResourceType,
          req,
        });

        return res.status(401).json({
          success: false,
          message: "User not found",
          requiresSensitiveActionAuth: true,
        });
      }

      // Check if user has 2FA enabled
      if (!user.twoFactorEnabled) {
        if (require2FAEnabled && user.role === "admin") {
          // Block admin actions without 2FA
          await logSensitiveAction({
            userId,
            userEmail,
            action: actionType,
            actionDescription,
            success: false,
            failureReason: "2FA not enabled - action blocked",
            targetResource: getTargetResource(req),
            targetResourceType,
            req,
          });

          return res.status(403).json({
            success: false,
            message:
              "Two-factor authentication must be enabled to perform this sensitive action. Please enable 2FA in your security settings.",
            requiresSensitiveActionAuth: true,
            requires2FASetup: true,
          });
        }

        // Non-admin or 2FA not required - allow through (for now)
        // In a stricter environment, you might want to require 2FA for all users
        console.warn(
          `⚠️  Sensitive action "${actionType}" performed without 2FA by ${userEmail}`
        );
        return next();
      }

      // 2FA is enabled - verify the code
      if (!totpCode && !backupCode) {
        await logSensitiveAction({
          userId,
          userEmail,
          action: actionType,
          actionDescription,
          success: false,
          failureReason: "No 2FA code provided",
          targetResource: getTargetResource(req),
          targetResourceType,
          req,
        });

        return res.status(403).json({
          success: false,
          message:
            "This action requires two-factor authentication verification",
          requiresSensitiveActionAuth: true,
          actionType,
          actionDescription,
        });
      }

      let verified = false;
      let verificationMethod = "totp";

      if (backupCode) {
        // Verify backup code
        verificationMethod = "backup";
        const bcrypt = require("bcryptjs");
        let matchedCode = null;

        for (const hashedCode of user.twoFactorBackupCodes || []) {
          const isMatch = await bcrypt.compare(backupCode, hashedCode);
          if (isMatch) {
            matchedCode = hashedCode;
            verified = true;
            break;
          }
        }

        if (matchedCode) {
          // Remove used backup code
          const updatedCodes = user.twoFactorBackupCodes.filter(
            (code) => code !== matchedCode
          );
          await User.findByIdAndUpdate(
            userId,
            { twoFactorBackupCodes: updatedCodes },
            { new: true }
          );

          console.log(
            `⚠️  Backup code used for sensitive action by ${userEmail}. Remaining codes: ${updatedCodes.length}`
          );
        }
      } else {
        // Verify TOTP token
        try {
          const decryptedSecret = decrypt(user.twoFactorSecret);
          verified = speakeasy.totp.verify({
            secret: decryptedSecret,
            encoding: "base32",
            token: totpCode,
            window: 1, // Tighter window for sensitive actions (30 seconds tolerance)
          });
        } catch (decryptError) {
          console.error("Error decrypting 2FA secret:", decryptError.message);

          await logSensitiveAction({
            userId,
            userEmail,
            action: actionType,
            actionDescription,
            success: false,
            failureReason: "2FA secret decryption failed",
            targetResource: getTargetResource(req),
            targetResourceType,
            req,
          });

          return res.status(500).json({
            success: false,
            message:
              "2FA verification failed. Please contact an administrator.",
            requiresSensitiveActionAuth: true,
          });
        }
      }

      if (!verified) {
        await logSensitiveAction({
          userId,
          userEmail,
          action: actionType,
          actionDescription,
          success: false,
          failureReason: `Invalid ${verificationMethod} code`,
          targetResource: getTargetResource(req),
          targetResourceType,
          req,
        });

        return res.status(403).json({
          success: false,
          message: "Invalid verification code. Please try again.",
          requiresSensitiveActionAuth: true,
        });
      }

      // Verification successful - log and proceed
      await logSensitiveAction({
        userId,
        userEmail,
        action: actionType,
        actionDescription,
        success: true,
        targetResource: getTargetResource(req),
        targetResourceType,
        req,
      });

      console.log(
        `✅ Sensitive action "${actionType}" verified for ${userEmail} using ${verificationMethod}`
      );

      // Add verification info to request for downstream use
      req.sensitiveActionVerified = {
        action: actionType,
        method: verificationMethod,
        verifiedAt: new Date(),
      };

      next();
    } catch (error) {
      console.error("Error in sensitive action verification:", error);
      return res.status(500).json({
        success: false,
        message: "Server error during security verification",
      });
    }
  };
};

module.exports = {
  requireSensitiveActionVerification,
  SENSITIVE_ACTIONS,
  logSensitiveAction,
};



