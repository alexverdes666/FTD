const { validationResult } = require("express-validator");
const User = require("../models/User");

// Get all users with their linked accounts
exports.getUsersWithLinkedAccounts = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = "", role = "" } = req.query;
    
    const filter = {
      isActive: true,
      status: "approved"
    };
    
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (role && role !== 'all') {
      filter.role = role;
    }

    const skip = (page - 1) * limit;
    
    const users = await User.find(filter)
      .populate('linkedAccounts', 'fullName email role')
      .populate('primaryAccount', 'fullName email role')
      .select('-password')
      .sort({ fullName: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(filter);

    // Group users by their account relationships
    const userGroups = new Map();
    const processedUsers = new Set();

    users.forEach(user => {
      if (processedUsers.has(user._id.toString())) return;
      
      const group = {
        primaryUser: user,
        linkedAccounts: user.linkedAccounts || [],
        totalAccounts: user.linkedAccounts?.length || 0
      };
      
      userGroups.set(user._id.toString(), group);
      processedUsers.add(user._id.toString());
      
      // Mark linked accounts as processed
      user.linkedAccounts?.forEach(linkedAccount => {
        processedUsers.add(linkedAccount._id.toString());
      });
    });

    res.status(200).json({
      success: true,
      data: {
        users: Array.from(userGroups.values()),
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalUsers: total,
          hasNextPage: page * limit < total,
          hasPrevPage: page > 1,
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get all available users for linking (excluding already linked ones)
exports.getAvailableUsers = async (req, res, next) => {
  try {
    const { excludeIds = [] } = req.query;
    const excludeArray = Array.isArray(excludeIds) ? excludeIds : [excludeIds].filter(Boolean);
    
    const users = await User.find({
      _id: { $nin: excludeArray },
      isActive: true,
      status: "approved"
    })
    .select('fullName email role')
    .sort({ fullName: 1 })
    .limit(100); // Reasonable limit for dropdown

    res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    next(error);
  }
};

// Link accounts together
exports.linkAccounts = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const { primaryAccountId, linkedAccountIds } = req.body;

    // Validate primary account exists
    const primaryAccount = await User.findById(primaryAccountId);
    if (!primaryAccount) {
      return res.status(404).json({
        success: false,
        message: "Primary account not found"
      });
    }

    // Validate all linked accounts exist
    const linkedAccounts = await User.find({
      _id: { $in: linkedAccountIds },
      isActive: true,
      status: "approved"
    });

    if (linkedAccounts.length !== linkedAccountIds.length) {
      return res.status(400).json({
        success: false,
        message: "One or more linked accounts not found or not active"
      });
    }

    // Create the complete list of all accounts in the group (primary + linked)
    const allAccountIds = [primaryAccountId, ...linkedAccountIds];
    
    // Update each account individually to ensure they don't include themselves in linkedAccounts
    // This ensures bidirectional linking - everyone can switch to everyone else (but not to themselves)
    for (const accountId of allAccountIds) {
      const linkedAccountsForThisUser = allAccountIds.filter(id => id !== accountId.toString());
      
      await User.findByIdAndUpdate(accountId, {
        linkedAccounts: linkedAccountsForThisUser,
        primaryAccount: accountId === primaryAccountId ? null : primaryAccountId
      });
    }

    const updatedPrimaryAccount = await User.findById(primaryAccountId)
      .populate('linkedAccounts', 'fullName email role');

    res.status(200).json({
      success: true,
      message: "Accounts linked successfully",
      data: updatedPrimaryAccount
    });
  } catch (error) {
    next(error);
  }
};

// Unlink accounts
exports.unlinkAccounts = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const { accountIds } = req.body;

    // Clear linkedAccounts and primaryAccount for all specified accounts
    await User.updateMany(
      { _id: { $in: accountIds } },
      { 
        $unset: { primaryAccount: 1 },
        $set: { linkedAccounts: [] }
      }
    );

    res.status(200).json({
      success: true,
      message: "Accounts unlinked successfully"
    });
  } catch (error) {
    next(error);
  }
};

// Remove specific account from a group
exports.removeAccountFromGroup = async (req, res, next) => {
  try {
    const { accountId } = req.params;

    const account = await User.findById(accountId);
    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found"
      });
    }

    // Get all accounts in the group
    const allGroupAccountIds = account.linkedAccounts || [];
    
    // Remove this account from all other accounts' linkedAccounts
    await User.updateMany(
      { _id: { $in: allGroupAccountIds, $ne: accountId } },
      { $pull: { linkedAccounts: accountId } }
    );

    // Clear this account's relationships
    account.linkedAccounts = [];
    account.primaryAccount = null;
    await account.save();

    res.status(200).json({
      success: true,
      message: "Account removed from group successfully"
    });
  } catch (error) {
    next(error);
  }
};

// Get account group details
exports.getAccountGroup = async (req, res, next) => {
  try {
    const { accountId } = req.params;

    const account = await User.findById(accountId)
      .populate('linkedAccounts', 'fullName email role')
      .populate('primaryAccount', 'fullName email role');

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found"
      });
    }

    res.status(200).json({
      success: true,
      data: account
    });
  } catch (error) {
    next(error);
  }
};

// Debug endpoint to check linked accounts
exports.debugUserLinks = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId)
      .populate('linkedAccounts', 'fullName email role isActive status')
      .populate('primaryAccount', 'fullName email role');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          status: user.status
        },
        linkedAccounts: user.linkedAccounts || [],
        linkedAccountsCount: user.linkedAccounts?.length || 0,
        primaryAccount: user.primaryAccount
      }
    });
  } catch (error) {
    next(error);
  }
};
