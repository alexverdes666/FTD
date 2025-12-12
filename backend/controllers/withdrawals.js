const Withdrawal = require("../models/Withdrawal");
const User = require("../models/User");
const Notification = require("../models/Notification");
const mongoose = require("mongoose");

// Create withdrawal request (Agent and Affiliate Manager)
const createWithdrawal = async (req, res) => {
  try {
    const { usdtErc20Wallet, usdtTrc20Wallet, amount, breakdown, withdrawalMonth, withdrawalYear } = req.body;

    // Validate required fields
    if (!usdtErc20Wallet || !usdtTrc20Wallet || !amount || !breakdown) {
      return res.status(400).json({
        success: false,
        message: "USDT ERC20 wallet, USDT TRC20 wallet, amount, and breakdown are required",
      });
    }

    // Validate wallet addresses are non-empty strings
    if (typeof usdtErc20Wallet !== 'string' || usdtErc20Wallet.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Valid USDT ERC20 wallet address is required",
      });
    }

    if (typeof usdtTrc20Wallet !== 'string' || usdtTrc20Wallet.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Valid USDT TRC20 wallet address is required",
      });
    }

    // Validate month and year if provided
    if (withdrawalMonth && withdrawalYear) {
      if (withdrawalMonth < 1 || withdrawalMonth > 12) {
        return res.status(400).json({
          success: false,
          message: "Invalid month (must be 1-12)",
        });
      }
      if (withdrawalYear < 2020 || withdrawalYear > 2030) {
        return res.status(400).json({
          success: false,
          message: "Invalid year",
        });
      }
    }

    // Validate amount
    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than 0",
      });
    }

    // Check if user exists and has valid role
    const user = await User.findById(req.user.id);
    if (!user || !["agent", "affiliate_manager"].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message:
          "Only agents and affiliate managers can create withdrawal requests",
      });
    }

    // Check if user already has a pending withdrawal request for this month
    const pendingWithdrawal = await Withdrawal.findOne({
      agent: req.user.id,
      withdrawalMonth: withdrawalMonth || new Date().getMonth() + 1,
      withdrawalYear: withdrawalYear || new Date().getFullYear(),
      status: "pending"
    });

    if (pendingWithdrawal) {
      return res.status(400).json({
        success: false,
        message: "You already have a pending withdrawal request for this month. Please wait for it to be processed before submitting a new request.",
      });
    }

    // Create withdrawal request
    const withdrawal = new Withdrawal({
      agent: req.user.id,
      amount: parseFloat(amount),
      usdtErc20Wallet: usdtErc20Wallet.trim(),
      usdtTrc20Wallet: usdtTrc20Wallet.trim(),
      withdrawalMonth: withdrawalMonth || new Date().getMonth() + 1,
      withdrawalYear: withdrawalYear || new Date().getFullYear(),
      breakdown: {
        basePay: parseFloat(breakdown.basePay || 0),
        bonuses: parseFloat(breakdown.bonuses || 0),
        fines: parseFloat(breakdown.fines || 0),
      },
    });

    await withdrawal.save();

    // Populate user details for response
    await withdrawal.populate("agent", "fullName email fourDigitCode");

    // Notify all admins about the new withdrawal request
    try {
      const admins = await User.find({ role: "admin" }).select("_id");
      
      for (const admin of admins) {
        const notification = await Notification.createWithdrawalNotification(
          "withdrawal_requested",
          withdrawal,
          admin._id,
          user
        );

        // Emit real-time notification if socket.io is available
        if (req.io) {
          const populatedNotification = await notification.populate("sender", "fullName email role");
          const unreadCount = await Notification.getUnreadCount(admin._id);
          req.io.to(`user:${admin._id}`).emit("new_notification", {
            notification: populatedNotification,
            unreadCount,
          });
        }
      }
    } catch (notificationError) {
      console.error("Error creating withdrawal notifications:", notificationError);
      // Don't fail the request if notifications fail
    }

    res.status(201).json({
      success: true,
      message: "Withdrawal request created successfully",
      data: withdrawal,
    });
  } catch (error) {
    console.error("Error creating withdrawal request:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create withdrawal request",
      error: error.message,
    });
  }
};

// Get user's withdrawal requests (agents and affiliate managers)
const getAgentWithdrawals = async (req, res) => {
  try {
    const { status, page = 1, limit = 10, startDate, endDate } = req.query;

    const withdrawals = await Withdrawal.getAgentWithdrawals(req.user.id, {
      status,
      page: parseInt(page),
      limit: parseInt(limit),
      startDate,
      endDate,
    });

    let countQuery = { agent: req.user.id };
    if (status) countQuery.status = status;
    if (startDate || endDate) {
      countQuery.createdAt = {};
      if (startDate) countQuery.createdAt.$gte = new Date(startDate);
      if (endDate) countQuery.createdAt.$lte = new Date(endDate);
    }

    const totalCount = await Withdrawal.countDocuments(countQuery);

    res.json({
      success: true,
      data: withdrawals,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching agent withdrawals:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch withdrawal requests",
      error: error.message,
    });
  }
};

// Get all withdrawal requests (Admin only)
const getAllWithdrawals = async (req, res) => {
  try {
    const { status, page = 1, limit = 50, startDate, endDate } = req.query;

    const withdrawals = await Withdrawal.getAllWithdrawals({
      status,
      page: parseInt(page),
      limit: parseInt(limit),
      startDate,
      endDate,
    });

    let countQuery = {};
    if (status) countQuery.status = status;
    if (startDate || endDate) {
      countQuery.createdAt = {};
      if (startDate) countQuery.createdAt.$gte = new Date(startDate);
      if (endDate) countQuery.createdAt.$lte = new Date(endDate);
    }

    const totalCount = await Withdrawal.countDocuments(countQuery);

    res.json({
      success: true,
      data: withdrawals,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching all withdrawals:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch withdrawal requests",
      error: error.message,
    });
  }
};

// Get withdrawal statistics (Admin only)
const getWithdrawalStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const stats = await Withdrawal.getWithdrawalStats({
      startDate,
      endDate,
    });

    // Format stats for better response
    const formattedStats = {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      completed: 0,
      totalAmount: 0,
      pendingAmount: 0,
      completedAmount: 0,
    };

    stats.forEach((stat) => {
      formattedStats.total += stat.count;
      formattedStats.totalAmount += stat.totalAmount;

      switch (stat._id) {
        case "pending":
          formattedStats.pending = stat.count;
          formattedStats.pendingAmount = stat.totalAmount;
          break;
        case "approved":
          formattedStats.approved = stat.count;
          break;
        case "rejected":
          formattedStats.rejected = stat.count;
          break;
        case "completed":
          formattedStats.completed = stat.count;
          formattedStats.completedAmount = stat.totalAmount;
          break;
      }
    });

    res.json({
      success: true,
      data: formattedStats,
    });
  } catch (error) {
    console.error("Error fetching withdrawal stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch withdrawal statistics",
      error: error.message,
    });
  }
};

// Process withdrawal request (Admin only)
const processWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes, paymentLink } = req.body;

    // Validate status
    if (!["approved", "rejected", "completed"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be approved, rejected, or completed",
      });
    }

    // Find withdrawal request
    const withdrawal = await Withdrawal.findById(id);
    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: "Withdrawal request not found",
      });
    }

    // Check if already processed
    if (withdrawal.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Withdrawal request has already been processed",
      });
    }

    // Process withdrawal
    await withdrawal.processWithdrawal(
      status,
      req.user.id,
      adminNotes,
      paymentLink
    );

    // Populate for response
    await withdrawal.populate([
      { path: "agent", select: "fullName email fourDigitCode" },
      { path: "processedBy", select: "fullName email" },
    ]);

    // Notify the agent about the withdrawal status change
    try {
      const notificationType = `withdrawal_${status}`;
      const admin = await User.findById(req.user.id).select("fullName email role");
      
      const notification = await Notification.createWithdrawalNotification(
        notificationType,
        withdrawal,
        withdrawal.agent._id,
        admin
      );

      // Emit real-time notification if socket.io is available
      if (req.io) {
        const populatedNotification = await notification.populate("sender", "fullName email role");
        const unreadCount = await Notification.getUnreadCount(withdrawal.agent._id);
        req.io.to(`user:${withdrawal.agent._id}`).emit("new_notification", {
          notification: populatedNotification,
          unreadCount,
        });
      }
    } catch (notificationError) {
      console.error("Error creating withdrawal status notification:", notificationError);
      // Don't fail the request if notifications fail
    }

    res.json({
      success: true,
      message: `Withdrawal request ${status} successfully`,
      data: withdrawal,
    });
  } catch (error) {
    console.error("Error processing withdrawal:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process withdrawal request",
      error: error.message,
    });
  }
};

// Get specific withdrawal request
const getWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;

    const withdrawal = await Withdrawal.findById(id)
      .populate("agent", "fullName email fourDigitCode")
      .populate("processedBy", "fullName email");

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: "Withdrawal request not found",
      });
    }

    // Check if user is requesting their own withdrawal or if user is admin
    if (
      req.user.role !== "admin" &&
      withdrawal.agent._id.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. You can only view your own withdrawal requests",
      });
    }

    res.json({
      success: true,
      data: withdrawal,
    });
  } catch (error) {
    console.error("Error fetching withdrawal:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch withdrawal request",
      error: error.message,
    });
  }
};

// Get total completed withdrawals for current user
const getCompletedWithdrawalsTotal = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await Withdrawal.aggregate([
      {
        $match: {
          agent: new mongoose.Types.ObjectId(userId),
          status: "completed",
        },
      },
      {
        $group: {
          _id: null,
          totalCompleted: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const totalCompleted = result.length > 0 ? result[0].totalCompleted : 0;
    const count = result.length > 0 ? result[0].count : 0;

    res.json({
      success: true,
      data: {
        totalCompleted,
        count,
      },
    });
  } catch (error) {
    console.error("Error fetching completed withdrawals total:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch completed withdrawals total",
      error: error.message,
    });
  }
};

// Get total completed withdrawals for specific user (Admin only)
const getCompletedWithdrawalsTotalForUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await Withdrawal.aggregate([
      {
        $match: {
          agent: new mongoose.Types.ObjectId(userId),
          status: "completed",
        },
      },
      {
        $group: {
          _id: null,
          totalCompleted: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const totalCompleted = result.length > 0 ? result[0].totalCompleted : 0;
    const count = result.length > 0 ? result[0].count : 0;

    res.json({
      success: true,
      data: {
        totalCompleted,
        count,
        userId,
      },
    });
  } catch (error) {
    console.error(
      "Error fetching completed withdrawals total for user:",
      error
    );
    res.status(500).json({
      success: false,
      message: "Failed to fetch completed withdrawals total for user",
      error: error.message,
    });
  }
};

// Get user's withdrawals by month
const getAgentWithdrawalsByMonth = async (req, res) => {
  try {
    const { year, month } = req.query;
    const userId = req.user.id;

    if (!year || !month) {
      return res.status(400).json({
        success: false,
        message: "Year and month are required",
      });
    }

    const withdrawals = await Withdrawal.getAgentWithdrawalsByMonth(
      userId,
      parseInt(year),
      parseInt(month)
    );

    res.json({
      success: true,
      data: withdrawals,
    });
  } catch (error) {
    console.error("Error fetching agent withdrawals by month:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch agent withdrawals by month",
      error: error.message,
    });
  }
};

// Get completed withdrawals total by month for current user
const getCompletedWithdrawalsByMonth = async (req, res) => {
  try {
    const { year, month } = req.query;
    const userId = req.user.id;

    if (!year || !month) {
      return res.status(400).json({
        success: false,
        message: "Year and month are required",
      });
    }

    const result = await Withdrawal.getCompletedWithdrawalsByMonth(
      userId,
      parseInt(year),
      parseInt(month)
    );

    const totalAmount = result.length > 0 ? result[0].totalAmount : 0;
    const count = result.length > 0 ? result[0].count : 0;

    res.json({
      success: true,
      data: {
        totalAmount,
        count,
      },
    });
  } catch (error) {
    console.error("Error fetching completed withdrawals by month:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch completed withdrawals by month",
      error: error.message,
    });
  }
};

// Update withdrawal wallet addresses (Agent only, for pending withdrawals)
const updateWithdrawalWallet = async (req, res) => {
  try {
    const { id } = req.params;
    const { usdtErc20Wallet, usdtTrc20Wallet } = req.body;

    // Validate wallet addresses
    if (!usdtErc20Wallet || !usdtTrc20Wallet) {
      return res.status(400).json({
        success: false,
        message: "Both USDT ERC20 and USDT TRC20 wallet addresses are required",
      });
    }

    // Validate wallet addresses are non-empty strings
    if (typeof usdtErc20Wallet !== 'string' || usdtErc20Wallet.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Valid USDT ERC20 wallet address is required",
      });
    }

    if (typeof usdtTrc20Wallet !== 'string' || usdtTrc20Wallet.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Valid USDT TRC20 wallet address is required",
      });
    }

    // Find withdrawal request
    const withdrawal = await Withdrawal.findById(id);
    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: "Withdrawal request not found",
      });
    }

    // Check if the withdrawal belongs to the requesting user
    if (withdrawal.agent.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You can only edit your own withdrawal requests",
      });
    }

    // Check if withdrawal is still pending
    if (withdrawal.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "You can only edit pending withdrawal requests",
      });
    }

    // Update wallet addresses
    withdrawal.usdtErc20Wallet = usdtErc20Wallet.trim();
    withdrawal.usdtTrc20Wallet = usdtTrc20Wallet.trim();
    await withdrawal.save();

    // Populate for response
    await withdrawal.populate("agent", "fullName email fourDigitCode");

    res.json({
      success: true,
      message: "Wallet addresses updated successfully",
      data: withdrawal,
    });
  } catch (error) {
    console.error("Error updating withdrawal wallet address:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update wallet address",
      error: error.message,
    });
  }
};

module.exports = {
  createWithdrawal,
  getAgentWithdrawals,
  getAllWithdrawals,
  getWithdrawalStats,
  processWithdrawal,
  getWithdrawal,
  getCompletedWithdrawalsTotal,
  getCompletedWithdrawalsTotalForUser,
  getAgentWithdrawalsByMonth,
  getCompletedWithdrawalsByMonth,
  updateWithdrawalWallet,
};
