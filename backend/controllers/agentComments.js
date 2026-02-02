const AgentComment = require("../models/AgentComment");
const ClientNetwork = require("../models/ClientNetwork");
const ClientBroker = require("../models/ClientBroker");
const PSP = require("../models/PSP");
const OurNetwork = require("../models/OurNetwork");
const User = require("../models/User");

// Helper function to find target by type
const findTargetByType = async (targetType, targetId) => {
  switch (targetType) {
    case "client_network":
      return await ClientNetwork.findById(targetId);
    case "client_broker":
      return await ClientBroker.findById(targetId);
    case "psp":
      return await PSP.findById(targetId);
    default:
      return null;
  }
};

// Get all comments with filtering
const getComments = async (req, res) => {
  try {
    const {
      targetType,
      targetId,
      status,
      isResolved,
      agent,
      page = 1,
      limit = 20,
    } = req.query;

    const filters = {};

    if (targetType) filters.targetType = targetType;
    if (targetId) filters.targetId = targetId;
    if (status) filters.status = status;
    if (isResolved !== undefined) filters.isResolved = isResolved === "true";
    if (agent) filters.agent = agent;

    const total = await AgentComment.countDocuments(filters);
    const skip = (page - 1) * limit;
    
    // Get comments with targets and pagination
    const comments = await AgentComment.getCommentsWithTargets(filters, {
      skip,
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: comments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching comments:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch comments",
      error: error.message,
    });
  }
};

// Get comments by specific target
const getCommentsByTarget = async (req, res) => {
  try {
    const { targetType, targetId } = req.params;

    // Validate target exists
    const target = await findTargetByType(targetType, targetId);

    if (!target) {
      return res.status(404).json({
        success: false,
        message: "Target not found",
      });
    }

    const comments = await AgentComment.getCommentsByTarget(targetType, targetId);

    res.json({
      success: true,
      data: comments,
      target: {
        id: target._id,
        name: target.name,
        description: target.description,
        isActive: target.isActive,
      },
    });
  } catch (error) {
    console.error("Error fetching comments by target:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch comments",
      error: error.message,
    });
  }
};

// Create a new comment
const createComment = async (req, res) => {
  try {
    const { targetType, targetId, comment, status, parentCommentId, ourNetworkId, images } = req.body;
    const agentId = req.user.id;

    // Validate target exists
    const target = await findTargetByType(targetType, targetId);

    if (!target) {
      return res.status(404).json({
        success: false,
        message: "Target not found",
      });
    }

    // If this is a reply, validate parent comment exists
    if (parentCommentId) {
      const parentComment = await AgentComment.findById(parentCommentId);
      if (!parentComment) {
        return res.status(404).json({
          success: false,
          message: "Parent comment not found",
        });
      }

      // Ensure parent comment is for the same target
      if (parentComment.targetType !== targetType || parentComment.targetId.toString() !== targetId) {
        return res.status(400).json({
          success: false,
          message: "Parent comment must be for the same target",
        });
      }
    }

    // Auto-set ourNetwork from affiliate manager's assigned network if not provided
    let ourNetwork = ourNetworkId || null;
    if (!ourNetwork && req.user.role === "affiliate_manager") {
      const assignedNetwork = await OurNetwork.findOne({ assignedAffiliateManager: req.user.id });
      if (assignedNetwork) {
        ourNetwork = assignedNetwork._id;
      }
    }

    const newComment = new AgentComment({
      agent: agentId,
      targetType,
      targetId,
      comment,
      status: parentCommentId ? undefined : (status || "other"),
      parentComment: parentCommentId || null,
      isReply: !!parentCommentId,
      ourNetwork,
      images: images || [],
    });

    await newComment.save();

    // Populate the comment with agent details
    await newComment.populate("agent", "fullName email");
    await newComment.populate("ourNetwork", "name");

    res.status(201).json({
      success: true,
      data: newComment,
      message: parentCommentId ? "Reply created successfully" : "Comment created successfully",
    });
  } catch (error) {
    console.error("Error creating comment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create comment",
      error: error.message,
    });
  }
};

// Create a reply to an existing comment
const createReply = async (req, res) => {
  try {
    const { parentCommentId } = req.params;
    const { comment } = req.body;
    const agentId = req.user.id;

    // Validate parent comment exists
    const parentComment = await AgentComment.findById(parentCommentId);
    if (!parentComment) {
      return res.status(404).json({
        success: false,
        message: "Parent comment not found",
      });
    }

    const newReply = new AgentComment({
      agent: agentId,
      targetType: parentComment.targetType,
      targetId: parentComment.targetId,
      comment,
      parentComment: parentCommentId,
      isReply: true,
      // Note: status is not required for replies
    });

    await newReply.save();

    // Populate the reply with agent details
    await newReply.populate("agent", "fullName email");

    res.status(201).json({
      success: true,
      data: newReply,
      message: "Reply created successfully",
    });
  } catch (error) {
    console.error("Error creating reply:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create reply",
      error: error.message,
    });
  }
};

// Update a comment (only by the agent who created it)
const updateComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment, status } = req.body;
    const userId = req.user.id;

    const existingComment = await AgentComment.findById(id);

    if (!existingComment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Only the agent who created the comment can update it
    if (existingComment.agent.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only update your own comments",
      });
    }

    // Cannot update resolved comments
    if (existingComment.isResolved) {
      return res.status(400).json({
        success: false,
        message: "Cannot update resolved comments",
      });
    }

    const updatedComment = await AgentComment.findByIdAndUpdate(
      id,
      { comment, status },
      { new: true, runValidators: true }
    ).populate("agent", "fullName email");

    res.json({
      success: true,
      data: updatedComment,
      message: "Comment updated successfully",
    });
  } catch (error) {
    console.error("Error updating comment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update comment",
      error: error.message,
    });
  }
};

// Resolve a comment (admin/manager only)
const resolveComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolutionNote } = req.body;
    const resolvedById = req.user.id;

    const comment = await AgentComment.findById(id);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    if (comment.isResolved) {
      return res.status(400).json({
        success: false,
        message: "Comment is already resolved",
      });
    }

    const resolvedComment = await AgentComment.findByIdAndUpdate(
      id,
      {
        isResolved: true,
        resolvedBy: resolvedById,
        resolvedAt: new Date(),
        resolutionNote,
      },
      { new: true, runValidators: true }
    )
      .populate("agent", "fullName email")
      .populate("resolvedBy", "fullName email");

    res.json({
      success: true,
      data: resolvedComment,
      message: "Comment resolved successfully",
    });
  } catch (error) {
    console.error("Error resolving comment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to resolve comment",
      error: error.message,
    });
  }
};

// Delete a comment (only by the agent who created it or admin)
const deleteComment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const comment = await AgentComment.findById(id);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Only the agent who created the comment or admin can delete it
    if (comment.agent.toString() !== userId && userRole !== "admin") {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own comments",
      });
    }

    // Delete the comment and all its replies
    await AgentComment.deleteMany({
      $or: [
        { _id: id },
        { parentComment: id }
      ]
    });

    res.json({
      success: true,
      message: "Comment deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete comment",
      error: error.message,
    });
  }
};

// Get comment statistics
const getCommentStats = async (req, res) => {
  try {
    const { targetType, targetId } = req.query;
    const filters = { parentComment: null }; // Only count top-level comments

    if (targetType) filters.targetType = targetType;
    if (targetId) filters.targetId = targetId;

    const stats = await AgentComment.aggregate([
      { $match: filters },
      {
        $group: {
          _id: {
            status: "$status",
            isResolved: "$isResolved",
          },
          count: { $sum: 1 },
        },
      },
    ]);

    const totalComments = await AgentComment.countDocuments(filters);
    const unresolvedComments = await AgentComment.countDocuments({
      ...filters,
      isResolved: false,
    });

    const statusBreakdown = {};
    stats.forEach((stat) => {
      const key = stat._id.status;
      if (!statusBreakdown[key]) {
        statusBreakdown[key] = { total: 0, resolved: 0, unresolved: 0 };
      }
      statusBreakdown[key].total += stat.count;
      if (stat._id.isResolved) {
        statusBreakdown[key].resolved += stat.count;
      } else {
        statusBreakdown[key].unresolved += stat.count;
      }
    });

    res.json({
      success: true,
      data: {
        total: totalComments,
        unresolved: unresolvedComments,
        resolved: totalComments - unresolvedComments,
        statusBreakdown,
      },
    });
  } catch (error) {
    console.error("Error fetching comment stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch comment statistics",
      error: error.message,
    });
  }
};

module.exports = {
  getComments,
  getCommentsByTarget,
  createComment,
  createReply,
  updateComment,
  resolveComment,
  deleteComment,
  getCommentStats,
};
