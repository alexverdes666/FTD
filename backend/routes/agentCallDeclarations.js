const express = require("express");
const router = express.Router();
const { protect, isManager } = require("../middleware/auth");
const {
  fetchCDRCalls,
  createDeclaration,
  getDeclarations,
  getPendingDeclarations,
  getAgentDeclarations,
  getMonthlyTotals,
  getAllAgentsMonthlyTotals,
  approveDeclaration,
  rejectDeclaration,
  deleteDeclaration,
  getCallTypes,
  previewBonus,
  getAffiliateManagers,
  findLeadByPhone,
  streamRecording,
} = require("../controllers/agentCallDeclarations");

// All routes require authentication
router.use(protect);

// Get call types with bonus info (available to all authenticated users)
router.get("/call-types", getCallTypes);

// Get affiliate managers for declaration assignment (available to all authenticated users)
router.get("/affiliate-managers", getAffiliateManagers);

// Calculate bonus preview
router.post("/preview-bonus", previewBonus);

// Agent fetches CDR calls (only their own based on fourDigitCode)
router.get("/cdr", fetchCDRCalls);

// Find lead by phone number (for auto-fill in declaration dialog)
router.get("/lead-by-phone", findLeadByPhone);

// Proxy call recording to avoid mixed content (HTTP→HTTPS)
router.get("/recording/:filename", streamRecording);

// Get monthly totals for all agents (admin/manager)
router.get("/all-agents-monthly", isManager, getAllAgentsMonthlyTotals);

// Get pending declarations for manager approval
router.get("/pending", isManager, getPendingDeclarations);

// Get declarations with filters (agents see their own, managers see all)
router.get("/", getDeclarations);

// Get declarations for a specific agent
router.get("/agent/:id", getAgentDeclarations);

// Get monthly totals for an agent (for payroll)
router.get("/agent/:id/monthly", getMonthlyTotals);

// Create a new declaration (agents only create their own)
router.post("/", createDeclaration);

// Approve a declaration (managers only)
router.patch("/:id/approve", isManager, approveDeclaration);

// Reject a declaration (managers only)
router.patch("/:id/reject", isManager, rejectDeclaration);

// Delete a declaration (agents can delete pending own, managers can delete any)
router.delete("/:id", deleteDeclaration);

module.exports = router;
