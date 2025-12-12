const express = require("express");
const router = express.Router();
const { protect, isManager } = require("../middleware/auth");
const {
  getComments,
  getCommentsByTarget,
  createComment,
  createReply,
  updateComment,
  resolveComment,
  deleteComment,
  getCommentStats,
} = require("../controllers/agentComments");

// Get all comments (with filtering) - Only admin and affiliate managers
router.get("/", protect, isManager, getComments);

// Get comments by specific target - Only admin and affiliate managers
router.get("/target/:targetType/:targetId", protect, isManager, getCommentsByTarget);

// Get comment statistics - Only admin and affiliate managers
router.get("/stats", protect, isManager, getCommentStats);

// Create a new comment (agents only)
router.post("/", protect, createComment);

// Create a reply to an existing comment
router.post("/:parentCommentId/reply", protect, createReply);

// Update a comment (only by the agent who created it)
router.put("/:id", protect, updateComment);

// Resolve a comment (admin/manager only)
router.patch("/:id/resolve", protect, resolveComment);

// Delete a comment (only by the agent who created it or admin)
router.delete("/:id", protect, deleteComment);

module.exports = router;
