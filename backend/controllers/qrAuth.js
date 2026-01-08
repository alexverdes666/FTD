const QRLoginSession = require("../models/QRLoginSession");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// Helper function to generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

// Helper function to get client IP
const getClientIP = (req) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  const realIP = req.headers["x-real-ip"];
  if (realIP) {
    return realIP.trim();
  }
  return req.ip || req.connection?.remoteAddress || "unknown";
};

/**
 * Create a new QR login session
 * Called when admin needs 2FA and has QR auth enabled
 * POST /api/qr-auth/create-session
 */
exports.createSession = async (req, res, next) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // Verify user exists and has QR auth enabled
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.qrAuthEnabled) {
      return res.status(400).json({
        success: false,
        message: "QR authentication is not enabled for this user",
      });
    }

    // Create a new session
    const loginIP = getClientIP(req);
    const loginUserAgent = req.headers["user-agent"] || "Unknown";

    const session = await QRLoginSession.createSession(
      userId,
      loginIP,
      loginUserAgent
    );

    // Generate the QR code URL - this will be the URL the phone scans
    const baseUrl = process.env.FRONTEND_URL || "https://ftdm2.com";
    const qrUrl = `${baseUrl}/qr-approve/${session.sessionToken}`;

    res.status(200).json({
      success: true,
      data: {
        sessionToken: session.sessionToken,
        qrUrl,
        expiresAt: session.expiresAt,
      },
    });
  } catch (error) {
    console.error("Error creating QR session:", error);
    next(error);
  }
};

/**
 * Check session status (polling endpoint)
 * GET /api/qr-auth/session-status/:sessionToken
 */
exports.checkSessionStatus = async (req, res, next) => {
  try {
    const { sessionToken } = req.params;

    const session = await QRLoginSession.findOne({ sessionToken });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    // Check if expired
    if (session.expiresAt < new Date()) {
      return res.status(200).json({
        success: true,
        data: {
          status: "expired",
          message: "Session has expired",
        },
      });
    }

    if (session.status === "approved") {
      // Generate the actual login token
      const token = generateToken(session.userId);

      // Get user data
      const user = await User.findById(session.userId);

      return res.status(200).json({
        success: true,
        data: {
          status: "approved",
          token,
          user,
          message: "Login approved",
        },
      });
    }

    if (session.status === "rejected") {
      return res.status(200).json({
        success: true,
        data: {
          status: "rejected",
          message: "Login was rejected",
        },
      });
    }

    // Still pending
    res.status(200).json({
      success: true,
      data: {
        status: "pending",
        expiresAt: session.expiresAt,
      },
    });
  } catch (error) {
    console.error("Error checking session status:", error);
    next(error);
  }
};

/**
 * Get session details (for mobile approval page)
 * GET /api/qr-auth/session/:sessionToken
 * If deviceId/deviceInfo query params are provided and match, auto-approves the session
 */
exports.getSessionDetails = async (req, res, next) => {
  try {
    const { sessionToken } = req.params;
    const { deviceId, deviceInfo } = req.query;

    const session = await QRLoginSession.findOne({ sessionToken }).populate(
      "userId",
      "email fullName"
    );

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found or expired",
      });
    }

    // Check if expired
    if (session.expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Session has expired",
      });
    }

    // Check if already resolved
    if (session.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Session has already been ${session.status}`,
      });
    }

    // If deviceId/deviceInfo provided, attempt auto-approval
    if (deviceId) {
      const user = await User.findById(
        session.userId._id || session.userId
      ).select("+qrAuthDeviceId qrAuthDeviceInfo qrAuthEnabled");

      console.log(`🔍 QR Auth Auto-Approval Check:`, {
        providedDeviceId: deviceId?.substring(0, 12) + "...",
        providedDeviceInfo: deviceInfo,
        storedDeviceId: user?.qrAuthDeviceId?.substring(0, 12) + "...",
        storedDeviceInfo: user?.qrAuthDeviceInfo,
        qrAuthEnabled: user?.qrAuthEnabled,
      });

      if (user && user.qrAuthEnabled) {
        // Check if device matches - allow by exact deviceId OR by matching device name/info (partial match)
        const deviceIdMatches = user.qrAuthDeviceId === deviceId;
        const storedInfoLower = user.qrAuthDeviceInfo?.toLowerCase() || "";
        const providedInfoLower = deviceInfo?.toLowerCase() || "";
        // Allow partial match - either one contains the other
        const deviceInfoMatches =
          deviceInfo &&
          user.qrAuthDeviceInfo &&
          (storedInfoLower.includes(providedInfoLower) ||
            providedInfoLower.includes(storedInfoLower) ||
            storedInfoLower === providedInfoLower);

        console.log(`🔍 QR Auth Match Results:`, {
          deviceIdMatches,
          deviceInfoMatches,
        });

        if (deviceIdMatches || deviceInfoMatches) {
          // Auto-approve the session
          await session.approve(deviceId, deviceInfo);

          // If deviceInfo matched but deviceId didn't, update the stored deviceId
          if (!deviceIdMatches && deviceInfoMatches) {
            console.log(
              `📱 QR Auth: Updating deviceId for ${user.email} (matched by device name: ${deviceInfo})`
            );
            await User.findByIdAndUpdate(user._id, {
              qrAuthDeviceId: deviceId,
            });
          }

          console.log(
            `✅ QR Auth: Auto-approved login for ${user.email} from device ${
              deviceInfo || deviceId.substring(0, 8) + "..."
            }`
          );

          return res.status(200).json({
            success: true,
            autoApproved: true,
            message: "Login automatically approved - device recognized",
            data: {
              sessionToken: session.sessionToken,
              user: {
                email: session.userId.email,
                fullName: session.userId.fullName,
              },
            },
          });
        }
      }
    }

    // Return session details for manual approval
    res.status(200).json({
      success: true,
      data: {
        sessionToken: session.sessionToken,
        user: {
          email: session.userId.email,
          fullName: session.userId.fullName,
        },
        loginIP: session.loginIP,
        loginUserAgent: session.loginUserAgent,
        expiresAt: session.expiresAt,
        createdAt: session.createdAt,
      },
    });
  } catch (error) {
    console.error("Error getting session details:", error);
    next(error);
  }
};

/**
 * Approve a login session from mobile device
 * POST /api/qr-auth/approve
 */
exports.approveSession = async (req, res, next) => {
  try {
    const { sessionToken, deviceId, deviceInfo } = req.body;

    if (!sessionToken || !deviceId) {
      return res.status(400).json({
        success: false,
        message: "Session token and device ID are required",
      });
    }

    // Find the session
    const session = await QRLoginSession.findValidSession(sessionToken);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found, expired, or already resolved",
      });
    }

    // Get user with device ID and device info
    const user = await User.findById(session.userId).select(
      "+qrAuthDeviceId qrAuthDeviceInfo"
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if device is registered
    if (!user.qrAuthDeviceId && !user.qrAuthDeviceInfo) {
      return res.status(403).json({
        success: false,
        message:
          "No device is registered for QR authentication. Please register this device first.",
        requiresRegistration: true,
      });
    }

    // Check if device matches - allow by exact deviceId OR by matching device name/info (partial match)
    const deviceIdMatches = user.qrAuthDeviceId === deviceId;
    const storedInfoLower = user.qrAuthDeviceInfo?.toLowerCase() || "";
    const providedInfoLower = deviceInfo?.toLowerCase() || "";
    // Allow partial match - either one contains the other
    const deviceInfoMatches =
      deviceInfo &&
      user.qrAuthDeviceInfo &&
      (storedInfoLower.includes(providedInfoLower) ||
        providedInfoLower.includes(storedInfoLower) ||
        storedInfoLower === providedInfoLower);

    if (!deviceIdMatches && !deviceInfoMatches) {
      console.warn(
        `⚠️ QR Auth: Device mismatch for user ${user.email}. ` +
          `Expected ID: ${
            user.qrAuthDeviceId?.substring(0, 8) || "none"
          }..., Got: ${deviceId.substring(0, 8)}... | ` +
          `Expected Info: "${user.qrAuthDeviceInfo || "none"}", Got: "${
            deviceInfo || "none"
          }"`
      );
      return res.status(403).json({
        success: false,
        message:
          "This device is not authorized to approve logins. Only your registered device can approve.",
      });
    }

    // If deviceInfo matched but deviceId didn't, update the stored deviceId for future matches
    if (!deviceIdMatches && deviceInfoMatches) {
      console.log(
        `📱 QR Auth: Updating deviceId for ${user.email} (matched by device name: ${deviceInfo})`
      );
      await User.findByIdAndUpdate(user._id, { qrAuthDeviceId: deviceId });
    }

    // Approve the session
    await session.approve(deviceId, deviceInfo);

    console.log(
      `✅ QR Auth: Login approved for ${user.email} from device ${
        deviceInfo || deviceId.substring(0, 8) + "..."
      }`
    );

    res.status(200).json({
      success: true,
      message: "Login approved successfully",
    });
  } catch (error) {
    console.error("Error approving session:", error);
    next(error);
  }
};

/**
 * Reject a login session from mobile device
 * POST /api/qr-auth/reject
 */
exports.rejectSession = async (req, res, next) => {
  try {
    const { sessionToken, deviceId, deviceInfo } = req.body;

    if (!sessionToken || !deviceId) {
      return res.status(400).json({
        success: false,
        message: "Session token and device ID are required",
      });
    }

    // Find the session
    const session = await QRLoginSession.findValidSession(sessionToken);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found, expired, or already resolved",
      });
    }

    // Get user with device ID and device info
    const user = await User.findById(session.userId).select(
      "+qrAuthDeviceId qrAuthDeviceInfo"
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if device matches - allow by exact deviceId OR by matching device name/info (partial match)
    const deviceIdMatches = user.qrAuthDeviceId === deviceId;
    const storedInfoLower = user.qrAuthDeviceInfo?.toLowerCase() || "";
    const providedInfoLower = deviceInfo?.toLowerCase() || "";
    // Allow partial match - either one contains the other
    const deviceInfoMatches =
      deviceInfo &&
      user.qrAuthDeviceInfo &&
      (storedInfoLower.includes(providedInfoLower) ||
        providedInfoLower.includes(storedInfoLower) ||
        storedInfoLower === providedInfoLower);

    // Only registered device can reject (for security)
    if (user.qrAuthDeviceId && !deviceIdMatches && !deviceInfoMatches) {
      return res.status(403).json({
        success: false,
        message: "Only the registered device can reject login attempts",
      });
    }

    // Reject the session
    await session.reject("User rejected from mobile");

    console.log(`❌ QR Auth: Login rejected for ${user.email}`);

    res.status(200).json({
      success: true,
      message: "Login rejected",
    });
  } catch (error) {
    console.error("Error rejecting session:", error);
    next(error);
  }
};

/**
 * Register a device for QR authentication
 * POST /api/qr-auth/register-device
 * Requires user to be authenticated (via password verification)
 */
exports.registerDevice = async (req, res, next) => {
  try {
    const { userId, password, deviceId, deviceInfo } = req.body;

    if (!userId || !password || !deviceId) {
      return res.status(400).json({
        success: false,
        message: "User ID, password, and device ID are required",
      });
    }

    // Find user with password
    const user = await User.findById(userId).select(
      "+password +qrAuthDeviceId"
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid password",
      });
    }

    // Check if user is admin
    if (user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "QR authentication is only available for admin accounts",
      });
    }

    // Update user with new device
    await User.findByIdAndUpdate(userId, {
      qrAuthDeviceId: deviceId,
      qrAuthDeviceInfo: deviceInfo || "Unknown Device",
      qrAuthDeviceRegisteredAt: new Date(),
      qrAuthEnabled: true,
      // Disable regular 2FA when enabling QR auth
      twoFactorEnabled: false,
    });

    console.log(
      `📱 QR Auth: Device registered for ${user.email}: ${deviceInfo}`
    );

    res.status(200).json({
      success: true,
      message:
        "Device registered successfully. You can now use this device to approve logins.",
      data: {
        deviceInfo,
        registeredAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Error registering device:", error);
    next(error);
  }
};

/**
 * Enable QR auth for admin (called from profile settings)
 * POST /api/qr-auth/enable
 * Generates a QR code URL for device registration
 */
exports.enableQRAuth = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "QR authentication is only available for admin accounts",
      });
    }

    // Generate the QR code URL for device registration
    // Security: The register-device endpoint requires password verification
    const baseUrl = process.env.FRONTEND_URL || "https://ftdm2.com";
    const setupUrl = `${baseUrl}/qr-setup/${userId}/setup`;

    res.status(200).json({
      success: true,
      message: "Scan this QR code with your phone to register it",
      data: {
        setupUrl,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
  } catch (error) {
    console.error("Error enabling QR auth:", error);
    next(error);
  }
};

/**
 * Get QR auth status for current user
 * GET /api/qr-auth/status
 */
exports.getStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        qrAuthEnabled: user.qrAuthEnabled || false,
        deviceInfo: user.qrAuthDeviceInfo || null,
        registeredAt: user.qrAuthDeviceRegisteredAt || null,
        isAdmin: user.role === "admin",
      },
    });
  } catch (error) {
    console.error("Error getting QR auth status:", error);
    next(error);
  }
};

/**
 * Disable QR auth
 * POST /api/qr-auth/disable
 */
exports.disableQRAuth = async (req, res, next) => {
  try {
    const userId = req.user.id;

    await User.findByIdAndUpdate(userId, {
      qrAuthEnabled: false,
      qrAuthDeviceId: null,
      qrAuthDeviceInfo: null,
      qrAuthDeviceRegisteredAt: null,
    });

    res.status(200).json({
      success: true,
      message: "QR authentication has been disabled",
    });
  } catch (error) {
    console.error("Error disabling QR auth:", error);
    next(error);
  }
};

/**
 * Check if a user has QR auth enabled (public endpoint for login flow)
 * GET /api/qr-auth/check-enabled/:userId
 */
exports.checkQRAuthEnabled = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select("qrAuthEnabled role");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        qrAuthEnabled: user.qrAuthEnabled || false,
        isAdmin: user.role === "admin",
      },
    });
  } catch (error) {
    console.error("Error checking QR auth status:", error);
    next(error);
  }
};
