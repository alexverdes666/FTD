const { validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const axios = require("axios");
const { getClientIP, isAdminIPAllowed } = require("../middleware/auth");
const generateToken = (id, originalUserId = null) => {
  const payload = { id };
  if (originalUserId) {
    payload.originalUserId = originalUserId;
  }
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "30d",
  });
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

    const token = generateToken(user._id);
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
    // Determine the original authenticated user (if currently impersonating)
    const rootUserId = req.user.originalUserId || req.user.id;
    
    const currentUser = await User.findById(rootUserId).populate({
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

    console.log(
      "Current user linked accounts:",
      currentUser.linkedAccounts?.length || 0
    );

    // If no linked accounts are configured, return only current user
    if (
      !currentUser.linkedAccounts ||
      currentUser.linkedAccounts.length === 0
    ) {
      return res.status(200).json({
        success: true,
        data: [
          {
            id: currentUser._id,
            fullName: currentUser.fullName,
            email: currentUser.email,
            role: currentUser.role,
            permissions: currentUser.permissions,
            isCurrentAccount: true,
          },
        ],
        message: "No linked accounts configured",
      });
    }

    // Map all linked accounts (which includes the current user due to our linking logic)
    const allAccounts = currentUser.linkedAccounts
      .filter((account) => account) // Remove any null/undefined accounts
      .map((user) => ({
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
        isCurrentAccount: user._id.toString() === req.user.id.toString(), // Check against actual current user (impersonated or real)
      }));

    // Ensure root user is in the list if not already there
    // If I am impersonating B, and A is the root, A should be in the list.
    // If I am A (root), A should be in the list.
    const rootUserInList = allAccounts.find((acc) => acc.id.toString() === rootUserId.toString());
    if (!rootUserInList) {
      allAccounts.unshift({
        id: currentUser._id,
        fullName: currentUser.fullName,
        email: currentUser.email,
        role: currentUser.role,
        permissions: currentUser.permissions,
        isCurrentAccount: currentUser._id.toString() === req.user.id.toString(),
      });
    } else {
       // If root user IS in the list (because of bidirectional linking), make sure isCurrentAccount is correct
       // It might be false if I am impersonating B.
       // The map above handles isCurrentAccount based on req.user.id, so we are good.
    }

    console.log("Returning accounts:", allAccounts.length);

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
    const accessToken = generateToken(user._id);

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

exports.switchAccount = async (req, res, next) => {
  try {
    const { accountId } = req.body;
    
    // Identify the original authenticated user (source of truth for permissions)
    const rootUserId = req.user.originalUserId || req.user.id;
    
    const currentUser = await User.findById(rootUserId);

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

    // Verify that the target account is in the ROOT user's linked accounts
    // We check against rootUserId, not the potentially impersonated req.user.id
    const currentUserWithLinked = await User.findById(rootUserId);
    const isLinkedAccount =
      currentUserWithLinked.linkedAccounts &&
      currentUserWithLinked.linkedAccounts.some(
        (linkedId) => linkedId.toString() === accountId
      );

    // Also allow switching back to the root user itself
    const isSwitchingToRoot = accountId === rootUserId.toString();

    if (!isLinkedAccount && !isSwitchingToRoot) {
      return res.status(403).json({
        success: false,
        message:
          "You can only switch to linked accounts configured by an administrator",
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

      // Check if 2FA or QR Auth is enabled for the target admin account
      if (targetUser.twoFactorEnabled || targetUser.qrAuthEnabled) {
        // Generate a temporary token that's only valid for 2FA verification
        // We preserve the originalUserId so we can maintain the link context if needed,
        // although switching to admin usually implies becoming the root user.
        const tempToken = jwt.sign(
          { 
            id: targetUser._id, 
            temp2FA: true, 
            originalUserId: rootUserId 
          },
          process.env.JWT_SECRET,
          { expiresIn: "10m" }
        );

        return res.status(200).json({
          success: true,
          message: targetUser.qrAuthEnabled ? "QR authentication required" : "2FA verification required",
          data: {
            requires2FA: true,
            useQRAuth: targetUser.qrAuthEnabled || false,
            tempToken: tempToken,
            userId: targetUser._id,
          },
        });
      }
    }

    // Generate new token for the target account, preserving the original user ID
    // If we are switching back to root, we don't need to store originalUserId anymore (or we can, but it's redundant)
    // Actually, it's cleaner to keep it null if we are the root user.
    const newOriginalUserId = isSwitchingToRoot ? null : rootUserId;
    const token = generateToken(targetUser._id, newOriginalUserId);

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
