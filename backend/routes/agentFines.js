const express = require("express");
const router = express.Router();
const { protect, isAdmin, isManager, isAgent } = require("../middleware/auth");
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
  agentRespondToFine,
  adminDecideFine,
  getPendingApprovalFines,
  getDisputedFines,
  getFinesByLeadId,
  getUnacknowledgedFines,
  acknowledgeFine,
} = require("../controllers/agentFines");

// All routes require authentication
router.use(protect);

// Get all fines for all agents (managers and admins)
router.get("/all", isManager, getAllAgentFines);

// Get fines summary for all agents (managers and admins)
router.get("/summary", isManager, getFinesSummary);

// Get unacknowledged fines for the current agent (popup notifications)
router.get("/unacknowledged", getUnacknowledgedFines);

// Get fines pending agent approval (agent gets own, manager/admin get all)
router.get("/pending-approval", getPendingApprovalFines);

// Get disputed fines for admin review (admin only)
router.get("/disputed", isAdmin, getDisputedFines);

// Get fines by lead ID
router.get("/lead/:leadId", getFinesByLeadId);

// Get fines for a specific agent
router.get("/agent/:agentId", getAgentFines);

// Get total active fines for an agent
router.get("/agent/:agentId/total", getAgentTotalFines);

// Get monthly fines for an agent
router.get("/agent/:agentId/monthly", getAgentMonthlyFines);

// Create a new fine for an agent (managers and admins)
router.post("/agent/:agentId", isManager, createAgentFine);

// Update a fine (managers and admins)
router.put("/:fineId", isManager, updateAgentFine);

// Acknowledge a fine notification (dismiss popup)
router.patch("/:fineId/acknowledge", acknowledgeFine);

// Agent response to fine (approve or dispute) - agent only
router.patch("/:fineId/agent-response", agentRespondToFine);

// Admin decision on disputed fine (admin only)
router.patch("/:fineId/admin-decision", isAdmin, adminDecideFine);

// Resolve a fine as paid/waived (admin only)
router.patch("/:fineId/resolve", isAdmin, resolveAgentFine);

// Delete a fine (admin only)
router.delete("/:fineId", isAdmin, deleteAgentFine);

module.exports = router;
