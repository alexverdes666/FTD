const jwt = require('jsonwebtoken');
const User = require('../models/User');
exports.protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'No user found with this token'
        });
      }
      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'User account is deactivated'
        });
      }
      // Check if token was invalidated (session kicked)
      if (user.tokenInvalidatedAt && decoded.iat) {
        const tokenIssuedAt = new Date(decoded.iat * 1000); // Convert seconds to milliseconds
        if (tokenIssuedAt < user.tokenInvalidatedAt) {
          return res.status(401).json({
            success: false,
            message: 'Session has been terminated. Please log in again.'
          });
        }
      }
      req.user = user;
      next();
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error in authentication'
    });
  }
};
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`
      });
    }
    next();
  };
};
exports.isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};
exports.isManager = (req, res, next) => {
  if (!['admin', 'affiliate_manager'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Manager or Admin access required'
    });
  }
  next();
};
exports.isLeadManager = (req, res, next) => {
  if (req.user.role !== 'lead_manager') {
    return res.status(403).json({
      success: false,
      message: 'Lead Manager access required'
    });
  }
  next();
};
exports.isAgent = (req, res, next) => {
  if (req.user.role !== 'agent') {
    return res.status(403).json({
      success: false,
      message: 'Agent access required'
    });
  }
  next();
};
exports.isInventoryManager = (req, res, next) => {
  if (req.user.role !== 'inventory_manager') {
    return res.status(403).json({
      success: false,
      message: 'Inventory Manager access required'
    });
  }
  next();
};
exports.hasPermission = (permission) => {
  return (req, res, next) => {
    console.log(`[PERMISSION-DEBUG] Checking permission "${permission}" for user:`, {
      userId: req.user._id,
      role: req.user.role,
      permissions: req.user.permissions
    });
    if (!req.user.permissions || !req.user.permissions[permission]) {
      console.log(`[PERMISSION-DEBUG] Permission denied for "${permission}"`);
      return res.status(403).json({
        success: false,
        message: `Permission ${permission} required`
      });
    }
    console.log(`[PERMISSION-DEBUG] Permission "${permission}" granted`);
    next();
  };
};
exports.ownerOrAdmin = (req, res, next) => {
  const resourceUserId = req.params.userId || req.params.agentId || req.params.id;
  if (req.user.role === 'admin' || req.user.id === resourceUserId) {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'You can only access your own data'
    });
  }
};

// Middleware to check if admin user has 2FA enabled (optional - just logs warning)
exports.require2FA = async (req, res, next) => {
  try {
    // Only check for admin users
    if (req.user.role === 'admin' && !req.user.twoFactorEnabled) {
      console.warn(`⚠️  Admin user ${req.user.email} accessing without 2FA enabled`);
      // Don't block access, just warn
    }
    next();
  } catch (error) {
    next();
  }
};