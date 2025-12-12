const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  getAgentMonthlyHistory,
  getMyMonthlyHistory,
  clearMonthlyHistoryCache,
  getMultipleAgentsMonthlyHistory,
} = require("../controllers/agentMonthlyHistory");

// @desc    Get monthly history for current authenticated agent
// @route   GET /api/agent-monthly-history/me
// @access  Private (Agent)
router.get("/me", protect, getMyMonthlyHistory);

// @desc    Get monthly history for specific agent
// @route   GET /api/agent-monthly-history/agent/:agentName
// @access  Private (Agent can only access own data, Admin can access any)
router.get("/agent/:agentName", protect, getAgentMonthlyHistory);

// @desc    Clear cache for agent monthly history
// @route   DELETE /api/agent-monthly-history/cache/:agentName?
// @access  Private (Admin can clear any, Agent can clear own)
router.delete("/cache/:agentName?", protect, clearMonthlyHistoryCache);

// @desc    Clear cache for current agent
// @route   DELETE /api/agent-monthly-history/cache
// @access  Private (Agent)
router.delete("/cache", protect, clearMonthlyHistoryCache);

// @desc    Get monthly history for multiple agents
// @route   POST /api/agent-monthly-history/multiple
// @access  Private (Admin only)
router.post("/multiple", protect, getMultipleAgentsMonthlyHistory);

module.exports = router; 