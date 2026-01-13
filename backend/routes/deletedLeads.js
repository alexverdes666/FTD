const express = require("express");
const { protect, isAdmin } = require("../middleware/auth");
const {
  getDeletedLeads,
  getDeletedLeadById,
  getDeletedLeadsForOrder,
  restoreDeletedLead,
  permanentlyDeleteDeletedLead,
} = require("../controllers/deletedLeads");

const router = express.Router();

// All routes require admin access
router.use(protect);
router.use(isAdmin);

// @route   GET /api/deleted-leads
// @desc    Get all deleted leads with filtering
// @access  Admin
router.get("/", getDeletedLeads);

// @route   GET /api/deleted-leads/order/:orderId
// @desc    Get deleted leads for a specific order
// @access  Admin
router.get("/order/:orderId", getDeletedLeadsForOrder);

// @route   GET /api/deleted-leads/:id
// @desc    Get single deleted lead by ID
// @access  Admin
router.get("/:id", getDeletedLeadById);

// @route   POST /api/deleted-leads/:id/restore
// @desc    Restore a deleted lead
// @access  Admin
router.post("/:id/restore", restoreDeletedLead);

// @route   DELETE /api/deleted-leads/:id
// @desc    Permanently delete a deleted lead
// @access  Admin
router.delete("/:id", permanentlyDeleteDeletedLead);

module.exports = router;
