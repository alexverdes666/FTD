const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
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
} = require("../controllers/withdrawals");

// @desc    Create withdrawal request
// @route   POST /api/withdrawals
// @access  Private (Agent and Affiliate Manager)
router.post(
  "/",
  protect,
  authorize("agent", "affiliate_manager"),
  createWithdrawal
);

// @desc    Get user's withdrawal requests
// @route   GET /api/withdrawals/me
// @access  Private (Agent and Affiliate Manager)
router.get(
  "/me",
  protect,
  authorize("agent", "affiliate_manager"),
  getAgentWithdrawals
);

// @desc    Get user's completed withdrawals total
// @route   GET /api/withdrawals/me/completed-total
// @access  Private (Agent and Affiliate Manager)
router.get(
  "/me/completed-total",
  protect,
  authorize("agent", "affiliate_manager"),
  getCompletedWithdrawalsTotal
);

// @desc    Get user's withdrawals by month
// @route   GET /api/withdrawals/me/by-month
// @access  Private (Agent and Affiliate Manager)
router.get(
  "/me/by-month",
  protect,
  authorize("agent", "affiliate_manager"),
  getAgentWithdrawalsByMonth
);

// @desc    Get user's completed withdrawals total by month
// @route   GET /api/withdrawals/me/completed-by-month
// @access  Private (Agent and Affiliate Manager)
router.get(
  "/me/completed-by-month",
  protect,
  authorize("agent", "affiliate_manager"),
  getCompletedWithdrawalsByMonth
);

// @desc    Get all withdrawal requests
// @route   GET /api/withdrawals
// @access  Private (Admin only)
router.get("/", protect, authorize("admin"), getAllWithdrawals);

// @desc    Get withdrawal statistics
// @route   GET /api/withdrawals/stats
// @access  Private (Admin only)
router.get("/stats", protect, authorize("admin"), getWithdrawalStats);

// @desc    Get completed withdrawals total for specific user
// @route   GET /api/withdrawals/completed-total/:userId
// @access  Private (Admin only)
router.get(
  "/completed-total/:userId",
  protect,
  authorize("admin"),
  getCompletedWithdrawalsTotalForUser
);

// @desc    Process withdrawal request
// @route   PUT /api/withdrawals/:id/process
// @access  Private (Admin only)
router.put("/:id/process", protect, authorize("admin"), processWithdrawal);

// @desc    Update withdrawal wallet address
// @route   PUT /api/withdrawals/:id/wallet
// @access  Private (Agent and Affiliate Manager - own requests only)
router.put(
  "/:id/wallet",
  protect,
  authorize("agent", "affiliate_manager"),
  updateWithdrawalWallet
);

// @desc    Get specific withdrawal request
// @route   GET /api/withdrawals/:id
// @access  Private (Agent/Affiliate Manager for own requests, Admin for all)
router.get(
  "/:id",
  protect,
  authorize("agent", "affiliate_manager", "admin"),
  getWithdrawal
);

module.exports = router;
