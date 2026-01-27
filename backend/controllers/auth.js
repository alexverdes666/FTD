const { validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const LoginSession = require("../models/LoginSession");
const axios = require("axios");
const { getClientIP, isAdminIPAllowed } = require("../middleware/auth");

const generateToken = (id, originalUserId = null) => {
  const payload = { id };
  if (originalUserId) {
    payload.originalUserId = originalUserId;
  }
  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "30d",
  });
  // Decode to get iat (issued at) for session tracking
  const decoded = jwt.decode(token);
  return { token, iat: decoded.iat };
};

// Helper to generate token (returns just token string for backward compatibility)
const generateTokenString = (id, originalUserId = null) => {
  return generateToken(id, originalUserId).token;
};
exports.register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }
    const { fullName, email, password } = req.body;
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    }
    const user = await User.create({
      fullName,
      email,
      password,
    });
    res.status(201).json({
      success: true,
      message: "Registration successful. Your account is pending approval.",
    });
  } catch (error) {
    next(error);
  }
};
exports.login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }
    if (user.status !== "approved" || !user.isActive) {
      let message = "Account is not permitted to log in.";
      if (user.status === "pending") {
        message = "Your account is pending approval.";
      } else if (user.status === "rejected") {
        message = "Your account registration was rejected.";
      } else if (!user.isActive) {
        message = "Your account has been deactivated.";
      }
      return res.status(403).json({ success: false, message });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Admin IP restriction - block login from unauthorized IPs
    if (user.role === "admin") {
      const clientIP = getClientIP(req);
      if (!isAdminIPAllowed(clientIP)) {
        console.warn(
          `⚠️  Admin login blocked for IP: ${clientIP} (user: ${user.email})`
        );
        return res.status(403).json({
          success: false,
          message: "Admin access is restricted to authorized locations only",
        });
      }
    }

    // Check if 2FA or QR Auth is enabled for admin users
    if (user.role === "admin" && (user.twoFactorEnabled || user.qrAuthEnabled)) {
      // Generate a temporary token that's only valid for 2FA verification
      const tempToken = jwt.sign(
        { id: user._id, temp2FA: true },
        process.env.JWT_SECRET,
        { expiresIn: "10m" } // Short expiration for temp token
      );

      return res.status(200).json({
        success: true,
        message: user.qrAuthEnabled ? "QR authentication required" : "2FA verification required",
        data: {
          requires2FA: true,
          useQRAuth: user.qrAuthEnabled || false,
          tempToken: tempToken,
          userId: user._id,
        },
      });
    }

    const { token, iat } = generateToken(user._id);

    // Create login session
    try {
      await LoginSession.createSession(user._id, iat, req);
    } catch (sessionError) {
      console.error("Failed to create login session:", sessionError);
      // Don't fail login if session creation fails
    }

    let agentPerformanceData = null;
    if (user.role === "agent" && user.fullName) {
      try {
        const agentResponse = await axios.get(
          `https://agent-report-1.onrender.com/api/mongodb/agents/${encodeURIComponent(
            user.fullName
          )}`
        );
        if (agentResponse.data.success && agentResponse.data.data.length > 0) {
          agentPerformanceData = agentResponse.data.data[0];
        }
      } catch (agentError) {
        console.log(
          "Could not fetch agent performance data:",
          agentError.message
        );
      }
    }
    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user,
        agentPerformanceData: agentPerformanceData,
        requires2FA: false,
      },
    });
  } catch (error) {
    next(error);
  }
};
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};
exports.updateProfile = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }
    const { fullName, email } = req.body;
    const fieldsToUpdate = {};
    if (fullName) fieldsToUpdate.fullName = fullName;
    if (email) fieldsToUpdate.email = email;
    const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
      new: true,
      runValidators: true,
    });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};
exports.changePassword = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id).select("+password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }
    user.password = newPassword;
    await user.save();
    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Get related accounts for the same person (for account switching)
exports.getRelatedAccounts = async (req, res, next) => {
  try {
    // The root user is the original authenticated user (admin who started the session)
    const rootUserId = req.user.originalUserId || req.user.id;
    // The current user is who we're currently acting as
    const currentUserId = req.user.id;

    // Fetch the current user's linked accounts (not the root user's)
    const currentUser = await User.findById(currentUserId).populate({
      path: "linkedAccounts",
      select: "fullName email role permissions isActive status",
      match: { isActive: true, status: "approved" },
    });

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // If we're impersonating (acting as a different user), also fetch the root user
    let rootUser = null;
    if (rootUserId.toString() !== currentUserId.toString()) {
      rootUser = await User.findById(rootUserId).select("fullName email role permissions isActive status");
    }

    console.log(
      "Current user linked accounts:",
      currentUser.linkedAccounts?.length || 0
    );

    const allAccounts = [];

    // Always add current user first
    allAccounts.push({
      id: currentUser._id,
      fullName: currentUser.fullName,
      email: currentUser.email,
      role: currentUser.role,
      permissions: currentUser.permissions,
      isCurrentAccount: true,
    });

    // Add the root user if we're impersonating (so user can switch back)
    if (rootUser && rootUser.isActive) {
      allAccounts.push({
        id: rootUser._id,
        fullName: rootUser.fullName,
        email: rootUser.email,
        role: rootUser.role,
        permissions: rootUser.permissions,
        isCurrentAccount: false,
      });
    }

    // Add the current user's linked accounts (if any)
    if (currentUser.linkedAccounts && currentUser.linkedAccounts.length > 0) {
      currentUser.linkedAccounts
        .filter((account) => account) // Remove any null/undefined accounts
        .forEach((user) => {
          // Don't add duplicates (current user or root user already in list)
          const alreadyInList = allAccounts.some(
            (acc) => acc.id.toString() === user._id.toString()
          );
          if (!alreadyInList) {
            allAccounts.push({
              id: user._id,
              fullName: user.fullName,
              email: user.email,
              role: user.role,
              permissions: user.permissions,
              isCurrentAccount: false,
            });
          }
        });
    }

    console.log("Returning accounts:", allAccounts.length);

    res.status(200).json({
      success: true,
      data: allAccounts,
      message: "Related accounts fetched successfully",
    });
  } catch (error) {
    console.error("Error in getRelatedAccounts:", error);
    next(error);
  }
};

// Switch to another account
// Complete login after 2FA verification
exports.verify2FAAndLogin = async (req, res, next) => {
  try {
    const { userId, token, useBackupCode } = req.body;

    if (!userId || !token) {
      return res.status(400).json({
        success: false,
        message: "User ID and verification token are required",
      });
    }

    const speakeasy = require("speakeasy");
    const { decrypt } = require("../utils/encryption");

    const user = await User.findById(userId).select(
      "+twoFactorSecret +twoFactorBackupCodes"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        message: "2FA is not enabled for this account",
      });
    }

    // Admin IP restriction - block 2FA verification from unauthorized IPs
    if (user.role === "admin") {
      const clientIP = getClientIP(req);
      if (!isAdminIPAllowed(clientIP)) {
        console.warn(
          `⚠️  Admin 2FA verification blocked for IP: ${clientIP} (user: ${user.email})`
        );
        return res.status(403).json({
          success: false,
          message: "Admin access is restricted to authorized locations only",
        });
      }
    }

    let verified = false;

    if (useBackupCode) {
      // Verify backup code
      const bcrypt = require("bcryptjs");
      let matchedCode = null;

      for (const hashedCode of user.twoFactorBackupCodes) {
        const isMatch = await bcrypt.compare(token, hashedCode);
        if (isMatch) {
          matchedCode = hashedCode;
          verified = true;
          break;
        }
      }

      if (matchedCode) {
        // Remove used backup code using findByIdAndUpdate
        const updatedCodes = user.twoFactorBackupCodes.filter(
          (code) => code !== matchedCode
        );
        await User.findByIdAndUpdate(
          userId,
          { twoFactorBackupCodes: updatedCodes },
          { new: true }
        );
      }
    } else {
      // Verify TOTP token
      try {
        console.log(
          `🔐 Attempting to decrypt 2FA secret for user ${user.email}...`
        );
        console.log(
          `🔑 ENCRYPTION_KEY is ${
            process.env.ENCRYPTION_KEY ? "SET" : "NOT SET"
          }`
        );
        console.log(
          `📦 Secret starts with: ${user.twoFactorSecret?.substring(0, 10)}...`
        );

        const decryptedSecret = decrypt(user.twoFactorSecret);

        console.log(`✅ Successfully decrypted 2FA secret`);
        console.log(`🔓 Decrypted secret length: ${decryptedSecret?.length}`);

        verified = speakeasy.totp.verify({
          secret: decryptedSecret,
          encoding: "base32",
          token: token,
          window: 2,
        });

        console.log(`🎯 TOTP verification result: ${verified}`);
      } catch (decryptError) {
        console.error("❌ Error decrypting 2FA secret:", decryptError.message);
        console.error("📍 User:", user.email);
        console.error(
          "🔑 ENCRYPTION_KEY is set:",
          !!process.env.ENCRYPTION_KEY
        );

        // If decryption fails, we must NOT disable 2FA (Fail Closed)
        // Log the error and require admin intervention or manual reset
        return res.status(500).json({
          success: false,
          message:
            "System error during 2FA verification. Please contact support.",
        });
      }
    }

    if (!verified) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code",
      });
    }

    // 2FA verified, generate full access token
    const { token: accessToken, iat } = generateToken(user._id);

    // Create login session
    try {
      await LoginSession.createSession(user._id, iat, req);
    } catch (sessionError) {
      console.error("Failed to create login session:", sessionError);
    }

    let agentPerformanceData = null;
    if (user.role === "agent" && user.fullName) {
      try {
        const agentResponse = await axios.get(
          `https://agent-report-1.onrender.com/api/mongodb/agents/${encodeURIComponent(
            user.fullName
          )}`
        );
        if (agentResponse.data.success && agentResponse.data.data.length > 0) {
          agentPerformanceData = agentResponse.data.data[0];
        }
      } catch (agentError) {
        console.log(
          "Could not fetch agent performance data:",
          agentError.message
        );
      }
    }

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token: accessToken,
        user: user.toJSON(),
        agentPerformanceData: agentPerformanceData,
      },
    });
  } catch (error) {
    console.error("Error in verify2FAAndLogin:", error);
    next(error);
  }
};

// Verify 2FA and complete account switch
exports.verify2FAAndSwitch = async (req, res, next) => {
  try {
    const { tempToken, token, useBackupCode } = req.body;

    if (!tempToken || !token) {
      return res.status(400).json({
        success: false,
        message: "Temp token and verification code are required",
      });
    }

    // Verify and decode the temp token
    let decoded;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired verification session. Please try again.",
      });
    }

    if (!decoded.temp2FA) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification token",
      });
    }

    const targetUserId = decoded.id;
    const originalUserId = decoded.originalUserId;
    const twoFactorUserId = decoded.twoFactorUserId || targetUserId;

    // Get the user whose 2FA we need to verify
    const speakeasy = require("speakeasy");
    const { decrypt } = require("../utils/encryption");

    const twoFactorUser = await User.findById(twoFactorUserId).select(
      "+twoFactorSecret +twoFactorBackupCodes"
    );

    if (!twoFactorUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!twoFactorUser.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        message: "2FA is not enabled for this account",
      });
    }

    let verified = false;

    if (useBackupCode) {
      const bcrypt = require("bcryptjs");
      let matchedCode = null;

      for (const hashedCode of twoFactorUser.twoFactorBackupCodes) {
        const isMatch = await bcrypt.compare(token, hashedCode);
        if (isMatch) {
          matchedCode = hashedCode;
          verified = true;
          break;
        }
      }

      if (matchedCode) {
        const updatedCodes = twoFactorUser.twoFactorBackupCodes.filter(
          (code) => code !== matchedCode
        );
        await User.findByIdAndUpdate(
          twoFactorUserId,
          { twoFactorBackupCodes: updatedCodes },
          { new: true }
        );
      }
    } else {
      try {
        const decryptedSecret = decrypt(twoFactorUser.twoFactorSecret);
        verified = speakeasy.totp.verify({
          secret: decryptedSecret,
          encoding: "base32",
          token: token,
          window: 2,
        });
      } catch (decryptError) {
        console.error("Error decrypting 2FA secret:", decryptError.message);
        return res.status(500).json({
          success: false,
          message: "System error during 2FA verification. Please contact support.",
        });
      }
    }

    if (!verified) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code",
      });
    }

    // 2FA verified - now complete the account switch
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "Target account not found",
      });
    }

    // Generate token for target user, preserving originalUserId
    const isSwitchingToRoot = targetUserId.toString() === originalUserId?.toString();
    const newOriginalUserId = isSwitchingToRoot ? null : originalUserId;
    const { token: accessToken, iat } = generateToken(targetUser._id, newOriginalUserId);

    // Create login session
    try {
      await LoginSession.createSession(targetUser._id, iat, req);
    } catch (sessionError) {
      console.error("Failed to create login session:", sessionError);
    }

    let agentPerformanceData = null;
    if (targetUser.role === "agent" && targetUser.fullName) {
      try {
        const agentResponse = await axios.get(
          `https://agent-report-1.onrender.com/api/mongodb/agents/${encodeURIComponent(
            targetUser.fullName
          )}`
        );
        if (agentResponse.data.success && agentResponse.data.data.length > 0) {
          agentPerformanceData = agentResponse.data.data[0];
        }
      } catch (agentError) {
        console.log("Could not fetch agent performance data:", agentError.message);
      }
    }

    res.status(200).json({
      success: true,
      message: "Account switched successfully",
      data: {
        token: accessToken,
        user: targetUser.toJSON(),
        agentPerformanceData: agentPerformanceData,
      },
    });
  } catch (error) {
    console.error("Error in verify2FAAndSwitch:", error);
    next(error);
  }
};

// Get current user's login sessions (active and history)
exports.getMySessions = async (req, res, next) => {
  try {
    // Get token issue time from the current request to identify current session
    const jwt = require("jsonwebtoken");
    const token = req.headers.authorization?.split(" ")[1];
    let currentTokenIat = null;

    if (token) {
      try {
        const decoded = jwt.decode(token);
        currentTokenIat = decoded?.iat;
      } catch (e) {
        // Ignore decode errors
      }
    }

    // Get active login sessions
    const activeSessions = await LoginSession.find({
      user: req.user.id,
      isActive: true,
    }).sort({ lastActivityAt: -1 });

    // Get session history (last 20 ended sessions)
    const sessionHistory = await LoginSession.find({
      user: req.user.id,
      isActive: false,
    })
      .sort({ logoutAt: -1 })
      .limit(20);

    // Format sessions for response
    const formatSession = (session) => {
      // Check if this is the current session by comparing token issue time
      const isCurrent = currentTokenIat && session.tokenIssuedAt &&
        Math.floor(session.tokenIssuedAt.getTime() / 1000) === currentTokenIat;

      return session.toAPIResponse(isCurrent);
    };

    res.status(200).json({
      success: true,
      data: {
        activeSessions: activeSessions.map(formatSession),
        sessionHistory: sessionHistory.map(formatSession),
      },
    });
  } catch (error) {
    console.error("Error in getMySessions:", error);
    next(error);
  }
};

// Terminate a specific login session
exports.terminateSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    // Find the session and verify it belongs to the current user
    const session = await LoginSession.findOne({
      _id: sessionId,
      user: req.user.id,
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    if (!session.isActive) {
      return res.status(400).json({
        success: false,
        message: "Session is already ended",
      });
    }

    // End the session
    await LoginSession.endSession(sessionId, 'kicked');

    res.status(200).json({
      success: true,
      message: "Session terminated successfully",
    });
  } catch (error) {
    console.error("Error in terminateSession:", error);
    next(error);
  }
};

// Terminate all login sessions except current
exports.terminateAllSessions = async (req, res, next) => {
  try {
    // Get current session by token issue time
    const jwt = require("jsonwebtoken");
    const token = req.headers.authorization?.split(" ")[1];
    let currentSession = null;

    if (token) {
      try {
        const decoded = jwt.decode(token);
        if (decoded?.iat) {
          currentSession = await LoginSession.findOne({
            user: req.user.id,
            isActive: true,
            tokenIssuedAt: new Date(decoded.iat * 1000)
          });
        }
      } catch (e) {
        // Ignore decode errors
      }
    }

    // End all sessions except current
    const result = await LoginSession.endAllSessionsExcept(
      req.user.id,
      currentSession?._id,
      'kicked'
    );

    // Invalidate all existing tokens by setting tokenInvalidatedAt
    await User.findByIdAndUpdate(req.user.id, {
      tokenInvalidatedAt: new Date(),
    });

    // Generate a new token for the current session
    const { token: newToken, iat } = generateToken(req.user.id, req.user.originalUserId || null);

    // Create a new login session for the new token
    if (currentSession) {
      // Update the current session with new token info
      currentSession.tokenIssuedAt = new Date(iat * 1000);
      currentSession.isActive = true;
      currentSession.logoutAt = null;
      currentSession.endReason = null;
      await currentSession.save();
    } else {
      // Create new session
      await LoginSession.createSession(req.user.id, iat, req);
    }

    res.status(200).json({
      success: true,
      message: `Terminated ${result.modifiedCount} session(s). All other devices have been logged out.`,
      data: {
        terminatedCount: result.modifiedCount,
        newToken,
      },
    });
  } catch (error) {
    console.error("Error in terminateAllSessions:", error);
    next(error);
  }
};

exports.switchAccount = async (req, res, next) => {
  try {
    const { accountId } = req.body;

    // Identify the original authenticated user (root user who started the session)
    const rootUserId = req.user.originalUserId || req.user.id;
    // The current user is who we're currently acting as
    const currentUserId = req.user.id;

    const currentUser = await User.findById(currentUserId);

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "Current user not found",
      });
    }

    const targetUser = await User.findById(accountId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "Target account not found",
      });
    }

    // Check if switching back to the root user
    const isSwitchingToRoot = accountId === rootUserId.toString();

    // Verify that the target account is in the CURRENT user's linked accounts
    // (not the root user's linked accounts)
    const isLinkedToCurrentUser =
      currentUser.linkedAccounts &&
      currentUser.linkedAccounts.some(
        (linkedId) => linkedId.toString() === accountId
      );

    if (!isLinkedToCurrentUser && !isSwitchingToRoot) {
      return res.status(403).json({
        success: false,
        message:
          "You can only switch to linked accounts or back to your original account",
      });
    }

    if (!targetUser.isActive || targetUser.status !== "approved") {
      return res.status(403).json({
        success: false,
        message: "Target account is not active or approved",
      });
    }

    // Admin IP restriction - block switching to admin account from unauthorized IPs
    if (targetUser.role === "admin") {
      const clientIP = getClientIP(req);
      if (!isAdminIPAllowed(clientIP)) {
        console.warn(
          `⚠️  Switch to admin account blocked for IP: ${clientIP} (target: ${targetUser.email})`
        );
        return res.status(403).json({
          success: false,
          message: "Admin access is restricted to authorized locations only",
        });
      }

      // Always require 2FA when switching to an admin account
      // Use target admin's 2FA if available, otherwise fall back to root user's 2FA
      const rootUser = await User.findById(rootUserId);

      // Determine which user's 2FA to use
      let twoFactorUser = null;
      if (targetUser.twoFactorEnabled || targetUser.qrAuthEnabled) {
        twoFactorUser = targetUser;
      } else if (rootUser && (rootUser.twoFactorEnabled || rootUser.qrAuthEnabled)) {
        twoFactorUser = rootUser;
      }

      if (!twoFactorUser) {
        // Neither target admin nor root user has 2FA enabled
        return res.status(403).json({
          success: false,
          message: "Cannot switch to admin account. Either the target admin or your original account must have 2FA enabled.",
        });
      }

      // Generate a temporary token that's only valid for 2FA verification
      // We preserve the originalUserId so we can maintain the link context if needed,
      // although switching to admin usually implies becoming the root user.
      const tempToken = jwt.sign(
        {
          id: targetUser._id,
          temp2FA: true,
          originalUserId: rootUserId,
          twoFactorUserId: twoFactorUser._id // Track which user's 2FA is being used
        },
        process.env.JWT_SECRET,
        { expiresIn: "10m" }
      );

      return res.status(200).json({
        success: true,
        message: twoFactorUser.qrAuthEnabled ? "QR authentication required" : "2FA verification required",
        data: {
          requires2FA: true,
          useQRAuth: twoFactorUser.qrAuthEnabled || false,
          tempToken: tempToken,
          userId: targetUser._id,
          twoFactorUserId: twoFactorUser._id, // Tell frontend which user's 2FA to verify
        },
      });
    }

    // Generate new token for the target account, preserving the original user ID
    // If we are switching back to root, we don't need to store originalUserId anymore (or we can, but it's redundant)
    // Actually, it's cleaner to keep it null if we are the root user.
    const newOriginalUserId = isSwitchingToRoot ? null : rootUserId;
    const { token, iat } = generateToken(targetUser._id, newOriginalUserId);

    // Create login session for the switched account
    try {
      await LoginSession.createSession(targetUser._id, iat, req);
    } catch (sessionError) {
      console.error("Failed to create login session for account switch:", sessionError);
    }

    let agentPerformanceData = null;
    if (targetUser.role === "agent" && targetUser.fullName) {
      try {
        const agentResponse = await axios.get(
          `https://agent-report-1.onrender.com/api/mongodb/agents/${encodeURIComponent(
            targetUser.fullName
          )}`
        );
        if (agentResponse.data.success && agentResponse.data.data.length > 0) {
          agentPerformanceData = agentResponse.data.data[0];
        }
      } catch (agentError) {
        console.log(
          "Could not fetch agent performance data:",
          agentError.message
        );
      }
    }

    res.status(200).json({
      success: true,
      message: "Account switched successfully",
      data: {
        token,
        user: targetUser,
        agentPerformanceData: agentPerformanceData,
      },
    });
  } catch (error) {
    next(error);
  }
};
