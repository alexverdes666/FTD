const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Admin IP whitelist - only these IPs can access admin accounts
const ADMIN_ALLOWED_IPS = [
  "185.109.170.40",
  "94.101.205.231",
  // Localhost IPs for development
  "127.0.0.1",
  "::1",
  "localhost",
];

// Helper function to get client IP address
const getClientIP = (req) => {
  // Check various headers for the real client IP (behind proxies)
  const forwardedFor = req.headers["x-forwarded-for"];
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, the first one is the client
    return forwardedFor.split(",")[0].trim();
  }

  const realIP = req.headers["x-real-ip"];
  if (realIP) {
    return realIP.trim();
  }

  // Fallback to req.ip (Express's built-in IP detection)
  return req.ip || req.connection?.remoteAddress || "unknown";
};

// Check if IP is allowed for admin access
// NOTE: IP restriction temporarily disabled - allowing all IPs
const isAdminIPAllowed = (ip) => {
  // Handle IPv6-mapped IPv4 addresses (e.g., ::ffff:185.109.170.40)
  // const cleanIP = ip.replace(/^::ffff:/, "");
  // return ADMIN_ALLOWED_IPS.includes(cleanIP);
  return true; // Temporarily allow all IPs
};
exports.protect = async (req, res, next) => {
  try {
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to access this route",
      });
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("-password");
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "No user found with this token",
        });
      }
      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: "User account is deactivated",
        });
      }
      // Check if token was invalidated (session kicked)
      if (user.tokenInvalidatedAt && decoded.iat) {
        const tokenIssuedAt = new Date(decoded.iat * 1000); // Convert seconds to milliseconds
        if (tokenIssuedAt < user.tokenInvalidatedAt) {
          return res.status(401).json({
            success: false,
            message: "Session has been terminated. Please log in again.",
          });
        }
      }

      // Admin IP restriction - admin accounts can only be accessed from whitelisted IPs
      if (user.role === "admin") {
        const clientIP = getClientIP(req);
        if (!isAdminIPAllowed(clientIP)) {
          console.warn(
            `⚠️  Admin access denied for IP: ${clientIP} (user: ${user.email})`
          );
          return res.status(403).json({
            success: false,
            message: "Admin access is restricted to authorized locations only",
          });
        }
      }

      req.user = user;
      // Attach originalUserId if present in token (for impersonation/account switching)
      if (decoded.originalUserId) {
        req.user.originalUserId = decoded.originalUserId;
      }

      // Check if the login session is still active (for session kick functionality)
      if (decoded.iat) {
        const LoginSession = require("../models/LoginSession");
        const session = await LoginSession.findOne({
          user: user._id,
          tokenIssuedAt: new Date(decoded.iat * 1000),
        });

        // If session exists and is not active, reject the request
        if (session && !session.isActive) {
          return res.status(401).json({
            success: false,
            message: "Session has been terminated. Please log in again.",
          });
        }

        // Update session activity (non-blocking)
        if (session) {
          session.lastActivityAt = new Date();
          session.save().catch(() => {});
        }
      }

      next();
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to access this route",
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error in authentication",
    });
  }
};
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`,
      });
    }
    next();
  };
};
exports.isAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required",
    });
  }
  next();
};
exports.isManager = (req, res, next) => {
  if (!["admin", "affiliate_manager"].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "Manager or Admin access required",
    });
  }
  next();
};
// Middleware for routes that allow viewing by managers and lead_manager (read-only access for lead_manager)
exports.canViewOrders = (req, res, next) => {
  if (!["admin", "affiliate_manager", "lead_manager"].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "Access denied - insufficient permissions",
    });
  }
  next();
};
exports.isLeadManager = (req, res, next) => {
  if (req.user.role !== "lead_manager") {
    return res.status(403).json({
      success: false,
      message: "Lead Manager access required",
    });
  }
  next();
};
exports.isAgent = (req, res, next) => {
  if (req.user.role !== "agent") {
    return res.status(403).json({
      success: false,
      message: "Agent access required",
    });
  }
  next();
};
exports.isInventoryManager = (req, res, next) => {
  if (req.user.role !== "inventory_manager") {
    return res.status(403).json({
      success: false,
      message: "Inventory Manager access required",
    });
  }
  next();
};
exports.hasPermission = (permission) => {
  return (req, res, next) => {
    console.log(
      `[PERMISSION-DEBUG] Checking permission "${permission}" for user:`,
      {
        userId: req.user._id,
        role: req.user.role,
        permissions: req.user.permissions,
      }
    );
    if (!req.user.permissions || !req.user.permissions[permission]) {
      console.log(`[PERMISSION-DEBUG] Permission denied for "${permission}"`);
      return res.status(403).json({
        success: false,
        message: `Permission ${permission} required`,
      });
    }
    console.log(`[PERMISSION-DEBUG] Permission "${permission}" granted`);
    next();
  };
};
exports.ownerOrAdmin = (req, res, next) => {
  const resourceUserId =
    req.params.userId || req.params.agentId || req.params.id;
  if (req.user.role === "admin" || req.user.id === resourceUserId) {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: "You can only access your own data",
    });
  }
};

// Middleware to check if admin user has 2FA enabled (optional - just logs warning)
exports.require2FA = async (req, res, next) => {
  try {
    // Only check for admin users
    if (req.user.role === "admin" && !req.user.twoFactorEnabled) {
      console.warn(
        `⚠️  Admin user ${req.user.email} accessing without 2FA enabled`
      );
      // Don't block access, just warn
    }
    next();
  } catch (error) {
    next();
  }
};

// Export IP utilities for use in other modules (e.g., auth controller)
exports.getClientIP = getClientIP;
exports.isAdminIPAllowed = isAdminIPAllowed;
exports.ADMIN_ALLOWED_IPS = ADMIN_ALLOWED_IPS;
