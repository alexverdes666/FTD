const express = require("express");
const router = express.Router();
const { protect, isAdmin } = require("../middleware/auth");
const {
  getAllAgentFines,
  getFinesSummary,
  getAgentFines,
  createAgentFine,
  updateAgentFine,
  resolveAgentFine,
  deleteAgentFine,
  getAgentTotalFines,
  getAgentMonthlyFines,
} = require("../controllers/agentFines");

// All routes require authentication
router.use(protect);

// Get all fines for all agents (admin only)
router.get("/all", isAdmin, getAllAgentFines);

// Get fines summary for all agents (admin only)
router.get("/summary", isAdmin, getFinesSummary);

// Get fines for a specific agent
router.get("/agent/:agentId", getAgentFines);

// Get total active fines for an agent
router.get("/agent/:agentId/total", getAgentTotalFines);

// Get monthly fines for an agent
router.get("/agent/:agentId/monthly", getAgentMonthlyFines);

// Create a new fine for an agent (admin only)
router.post("/agent/:agentId", isAdmin, createAgentFine);

// Update a fine (admin only)
router.put("/:fineId", isAdmin, updateAgentFine);

// Resolve a fine (admin only)
router.patch("/:fineId/resolve", isAdmin, resolveAgentFine);

// Delete a fine (admin only)
router.delete("/:fineId", isAdmin, deleteAgentFine);

module.exports = router;
