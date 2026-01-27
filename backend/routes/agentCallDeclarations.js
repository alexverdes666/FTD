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
  approveDeclaration,
  rejectDeclaration,
  deleteDeclaration,
  getCallTypes,
  previewBonus,
} = require("../controllers/agentCallDeclarations");

// All routes require authentication
router.use(protect);

// Get call types with bonus info (available to all authenticated users)
router.get("/call-types", getCallTypes);

// Calculate bonus preview
router.post("/preview-bonus", previewBonus);

// Agent fetches CDR calls (only their own based on fourDigitCode)
router.get("/cdr", fetchCDRCalls);

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
