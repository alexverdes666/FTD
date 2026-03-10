const RefundApproval = require("../models/RefundApproval");
const RefundAssignment = require("../models/RefundAssignment");
const SystemConfiguration = require("../models/SystemConfiguration");
const Notification = require("../models/Notification");
const Ticket = require("../models/Ticket");
const User = require("../models/User");

// Helper to send real-time notification
const sendNotification = async (io, recipientId, senderId, title, message, type, approvalId) => {
  try {
    const notification = await Notification.create({
      recipient: recipientId,
      sender: senderId,
      title,
      message,
      type,
      priority: "high",
      relatedEntity: { id: approvalId, type: "RefundApproval" },
      actionUrl: "/refunds",
    });

    const populatedNotification = await notification.populate(
      "sender",
      "fullName email role"
    );

    if (io) {
      const unreadCount = await Notification.getUnreadCount(recipientId);
      io.to(`user:${recipientId}`).emit("new_notification", {
        notification: populatedNotification,
        unreadCount,
      });
    }
  } catch (error) {
    console.error("Error sending refund approval notification:", error);
  }
};

// Helper to get customer name from assignment
const getCustomerName = (assignment) => {
  if (assignment.source === "csv") {
    return `${assignment.firstName || ""} ${assignment.lastName || ""}`.trim() || "N/A";
  }
  if (assignment.leadId) {
    return `${assignment.leadId.firstName || ""} ${assignment.leadId.lastName || ""}`.trim() || "N/A";
  }
  return "N/A";
};

// Helper to create a ticket for refund approval
const createApprovalTicket = async (createdByUserId, assignToUserId, title, description) => {
  try {
    const ticket = await Ticket.create({
      title,
      description,
      category: "refund_approval",
      priority: "high",
      createdBy: createdByUserId,
      tags: ["refund-approval"],
      lastActivityBy: createdByUserId,
    });

    if (assignToUserId) {
      await ticket.assignTo(assignToUserId, createdByUserId);
    }

    return ticket;
  } catch (error) {
    console.error("Error creating refund approval ticket:", error);
  }
};

// Create a refund approval request (called when refunds_manager selects "refunded_checked")
exports.createApprovalRequest = async (req, res, next) => {
  try {
    const { refundAssignmentId, notes } = req.body;
    const userId = req.user._id;

    if (req.user.role !== "refunds_manager" && req.user.role !== "admin" &&
        !(req.user.role === "affiliate_manager" && req.user.permissions?.canManageRefunds)) {
      return res.status(403).json({
        success: false,
        message: "Access denied.",
      });
    }

    const assignment = await RefundAssignment.findById(refundAssignmentId)
      .populate("leadId", "firstName lastName newEmail oldEmail")
      .populate("refundsManager", "fullName email");
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Refund assignment not found.",
      });
    }

    if (assignment.pendingApproval) {
      return res.status(400).json({
        success: false,
        message: "There is already a pending approval for this refund.",
      });
    }

    const superiorManager = await SystemConfiguration.getSuperiorLeadManager();
    if (!superiorManager) {
      return res.status(400).json({
        success: false,
        message: "No superior lead manager has been configured. Please contact admin.",
      });
    }

    const approval = await RefundApproval.create({
      refundAssignmentId: assignment._id,
      requestedBy: userId,
      superiorManager: superiorManager._id,
      previousStatus: assignment.status,
      status: "pending_superior",
      requestNotes: notes || "",
    });

    assignment.pendingApproval = approval._id;
    await assignment.save();

    await approval.populate([
      { path: "requestedBy", select: "fullName email" },
      { path: "superiorManager", select: "fullName email" },
      { path: "refundAssignmentId" },
    ]);

    const customerName = getCustomerName(assignment);

    // Notification + ticket only for the superior lead manager
    await sendNotification(
      req.io,
      superiorManager._id,
      userId,
      "Refund Approval Requested",
      `${req.user.fullName} has requested refund approval check for ${customerName}. Please review.`,
      "refund_approval_requested",
      approval._id
    );

    await createApprovalTicket(
      userId,
      superiorManager._id,
      `Refund Approval - ${customerName}`,
      `Refund approval requested by ${req.user.fullName}.\n\nCustomer: ${customerName}\nCurrent Status: ${assignment.status}\nRefunds Manager: ${assignment.refundsManager?.fullName || "N/A"}\n${notes ? `\nNotes: ${notes}` : ""}\n\nPlease review and approve or reject this refund check request.`
    );

    res.status(201).json({
      success: true,
      message: "Refund approval request created. Waiting for superior lead manager review.",
      data: approval,
    });
  } catch (error) {
    next(error);
  }
};

// Get pending approvals (for superior lead manager and admin)
exports.getPendingApprovals = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    let query = {};

    if (userRole === "admin") {
      // Admin only sees approvals assigned to them specifically
      query.$or = [
        { adminReviewer: userId, status: "pending_admin" },
      ];
    } else {
      // Superior lead manager sees only their pending_superior approvals
      query.superiorManager = userId;
      query.status = "pending_superior";
    }

    const approvals = await RefundApproval.find(query)
      .populate("requestedBy", "fullName email")
      .populate("superiorManager", "fullName email")
      .populate("adminReviewer", "fullName email")
      .populate({
        path: "refundAssignmentId",
        populate: [
          {
            path: "leadId",
            select: "firstName lastName newEmail oldEmail country",
          },
          { path: "refundsManager", select: "fullName email" },
          {
            path: "orderId",
            select: "requester status createdAt",
            populate: { path: "requester", select: "fullName email" },
          },
        ],
      })
      .populate({
        path: "decisions.decidedBy",
        select: "fullName email role",
      })
      .populate({
        path: "decisions.evidenceImages",
        select: "-chunks",
      })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: approvals,
      count: approvals.length,
    });
  } catch (error) {
    next(error);
  }
};

// Get all approvals (with optional filters) - admin only
exports.getAllApprovals = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin only.",
      });
    }

    const { status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status && status !== "all") {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [approvals, total] = await Promise.all([
      RefundApproval.find(query)
        .populate("requestedBy", "fullName email")
        .populate("superiorManager", "fullName email")
        .populate("adminReviewer", "fullName email")
        .populate({
          path: "refundAssignmentId",
          populate: [
            {
              path: "leadId",
              select: "firstName lastName newEmail oldEmail country",
            },
            { path: "refundsManager", select: "fullName email" },
          ],
        })
        .populate({
          path: "decisions.decidedBy",
          select: "fullName email role",
        })
        .populate({
          path: "decisions.evidenceImages",
          select: "-chunks",
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      RefundApproval.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: approvals,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Process approval decision (approve/reject by superior or admin)
exports.processDecision = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { decision, notes, evidenceImageIds, adminReviewerId } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;

    if (!["approve", "reject"].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: 'Decision must be "approve" or "reject".',
      });
    }

    const approval = await RefundApproval.findById(id);
    if (!approval) {
      return res.status(404).json({
        success: false,
        message: "Approval not found.",
      });
    }

    // Determine the role of the decision maker - strict checks
    let decisionRole = null;
    const isSuperior =
      approval.superiorManager.toString() === userId.toString();
    const isAdmin = userRole === "admin";
    const isAssignedAdmin =
      isAdmin && approval.adminReviewer && approval.adminReviewer.toString() === userId.toString();

    if (approval.status === "pending_superior" && isSuperior) {
      // ONLY the superior manager can act on pending_superior (admin cannot bypass)
      decisionRole = "superior";
    } else if (approval.status === "pending_admin" && isAssignedAdmin) {
      // ONLY the specifically assigned admin can act on pending_admin
      decisionRole = "admin";
    } else {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to make this decision, or the approval is not in the correct state.",
      });
    }

    // When superior approves, they must select which admin to send to
    if (decisionRole === "superior" && decision === "approve") {
      if (!adminReviewerId) {
        return res.status(400).json({
          success: false,
          message: "You must select an admin to send this approval to.",
        });
      }

      // Verify the selected admin exists and is actually an admin
      const adminUser = await User.findOne({
        _id: adminReviewerId,
        role: "admin",
        isActive: true,
        status: "approved",
      });
      if (!adminUser) {
        return res.status(400).json({
          success: false,
          message: "Selected admin not found or is not active.",
        });
      }
    }

    // Add the decision to history
    approval.decisions.push({
      decidedBy: userId,
      decision,
      role: decisionRole,
      notes: notes || "",
      evidenceImages: evidenceImageIds || [],
      decidedAt: new Date(),
    });

    // Get the refund assignment
    const assignment = await RefundAssignment.findById(
      approval.refundAssignmentId
    )
      .populate("refundsManager", "fullName email")
      .populate("leadId", "firstName lastName newEmail oldEmail");

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Associated refund assignment not found.",
      });
    }

    const customerName = getCustomerName(assignment);

    if (decisionRole === "superior") {
      if (decision === "approve") {
        // Superior approved → goes to the selected admin
        approval.status = "pending_admin";
        approval.adminReviewer = adminReviewerId;

        // Notification + ticket only for the selected admin
        await sendNotification(
          req.io,
          adminReviewerId,
          userId,
          "Refund Approval - Admin Review Required",
          `Superior lead manager approved refund check for ${customerName}. Your confirmation is required.`,
          "refund_approval_admin_review",
          approval._id
        );

        await createApprovalTicket(
          userId,
          adminReviewerId,
          `Refund Admin Confirmation - ${customerName}`,
          `Superior lead manager (${req.user.fullName}) approved the refund check for ${customerName}.\n\nCustomer: ${customerName}\nRefunds Manager: ${assignment.refundsManager?.fullName || "N/A"}\nSuperior Notes: ${notes || "None"}\n\nAdmin confirmation is required to complete this refund.`
        );
      } else {
        // Superior rejected → revert, end process
        approval.status = "rejected";
        approval.completedAt = new Date();

        assignment.pendingApproval = null;
        await assignment.save();

        // No notification on rejection
      }
    } else if (decisionRole === "admin") {
      if (decision === "approve") {
        // Admin approved → refund complete!
        approval.status = "approved";
        approval.completedAt = new Date();

        assignment.modifiedBy = userId;
        assignment.statusChangeNotes = "Approved through refund approval workflow";
        assignment.status = "refund_complete";
        assignment.pendingApproval = null;
        await assignment.save();

        // Notify the requesting refunds manager
        await sendNotification(
          req.io,
          approval.requestedBy,
          userId,
          "Refund Approved - Complete",
          `Your refund check request for ${customerName} has been fully approved. Refund is now complete.`,
          "refund_approval_complete",
          approval._id
        );

        // Notify the superior manager
        await sendNotification(
          req.io,
          approval.superiorManager,
          userId,
          "Refund Approved - Complete",
          `The refund for ${customerName} you approved has been confirmed by admin. Refund is now complete.`,
          "refund_approval_complete",
          approval._id
        );
      } else {
        // Admin rejected → goes back to superior lead manager
        approval.status = "pending_superior";
        approval.adminReviewer = null; // Clear admin so superior picks again

        // Notification + ticket for superior to re-review
        await sendNotification(
          req.io,
          approval.superiorManager,
          userId,
          "Refund Approval - Admin Rejected, Review Again",
          `Admin has rejected the refund approval for ${customerName}. Please review again.`,
          "refund_approval_admin_rejected",
          approval._id
        );

        await createApprovalTicket(
          userId,
          approval.superiorManager,
          `Refund Re-Review Required - ${customerName}`,
          `Admin has rejected the refund approval for ${customerName}.\n\nCustomer: ${customerName}\nAdmin Notes: ${notes || "None"}\n\nPlease review again and decide whether to approve or reject.`
        );
      }
    }

    await approval.save();

    await approval.populate([
      { path: "requestedBy", select: "fullName email" },
      { path: "superiorManager", select: "fullName email" },
      { path: "adminReviewer", select: "fullName email" },
      { path: "decisions.decidedBy", select: "fullName email role" },
      { path: "decisions.evidenceImages", select: "-chunks" },
    ]);

    res.json({
      success: true,
      message:
        decision === "approve"
          ? decisionRole === "admin"
            ? "Refund approved and completed."
            : "Approved. Sent to admin for final confirmation."
          : decisionRole === "admin"
          ? "Rejected. Sent back to superior lead manager for review."
          : "Rejected. Reverted to previous status.",
      data: approval,
    });
  } catch (error) {
    next(error);
  }
};

// Get approval by ID
exports.getApprovalById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const approval = await RefundApproval.findById(id)
      .populate("requestedBy", "fullName email")
      .populate("superiorManager", "fullName email")
      .populate("adminReviewer", "fullName email")
      .populate({
        path: "refundAssignmentId",
        populate: [
          {
            path: "leadId",
            select: "firstName lastName newEmail oldEmail country",
          },
          { path: "refundsManager", select: "fullName email" },
          {
            path: "orderId",
            select: "requester status createdAt",
            populate: { path: "requester", select: "fullName email" },
          },
        ],
      })
      .populate({
        path: "decisions.decidedBy",
        select: "fullName email role",
      })
      .populate({
        path: "decisions.evidenceImages",
        select: "-chunks",
      });

    if (!approval) {
      return res.status(404).json({
        success: false,
        message: "Approval not found.",
      });
    }

    const userId = req.user._id.toString();
    const isAdmin = req.user.role === "admin";
    const isSuperior = approval.superiorManager._id.toString() === userId;
    const isRequester = approval.requestedBy._id.toString() === userId;

    if (!isAdmin && !isSuperior && !isRequester) {
      return res.status(403).json({
        success: false,
        message: "Access denied.",
      });
    }

    res.json({
      success: true,
      data: approval,
    });
  } catch (error) {
    next(error);
  }
};

// Get superior lead manager setting
exports.getSuperiorLeadManager = async (req, res, next) => {
  try {
    const superiorManager = await SystemConfiguration.getSuperiorLeadManager();
    res.json({
      success: true,
      data: superiorManager,
    });
  } catch (error) {
    next(error);
  }
};

// Set superior lead manager (admin only)
exports.setSuperiorLeadManager = async (req, res, next) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required.",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (!user.isActive || user.status !== "approved") {
      return res.status(400).json({
        success: false,
        message: "User must be active and approved.",
      });
    }

    const config = await SystemConfiguration.setSuperiorLeadManager(
      userId,
      req.user._id
    );

    res.json({
      success: true,
      message: `${user.fullName} has been set as the superior lead manager.`,
      data: config.superiorLeadManager,
    });
  } catch (error) {
    next(error);
  }
};

// Get list of active admins (for superior to select which admin to send to)
exports.getAdminUsers = async (req, res, next) => {
  try {
    const admins = await User.find({
      role: "admin",
      isActive: true,
      status: "approved",
    }).select("_id fullName email");

    res.json({
      success: true,
      data: admins,
    });
  } catch (error) {
    next(error);
  }
};

// Get approval count for badge display
exports.getApprovalCounts = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    let counts = {};

    if (userRole === "admin") {
      // Admin only counts approvals specifically assigned to them
      const pendingAdmin = await RefundApproval.countDocuments({
        adminReviewer: userId,
        status: "pending_admin",
      });
      counts = { pendingAdmin, total: pendingAdmin };
    } else {
      // Check if user is the superior lead manager
      const superiorManager = await SystemConfiguration.getSuperiorLeadManager();
      if (superiorManager && superiorManager._id.toString() === userId.toString()) {
        const pendingSuperior = await RefundApproval.countDocuments({
          superiorManager: userId,
          status: "pending_superior",
        });
        counts = { pendingSuperior, total: pendingSuperior };
      }
    }

    res.json({
      success: true,
      data: counts,
    });
  } catch (error) {
    next(error);
  }
};
