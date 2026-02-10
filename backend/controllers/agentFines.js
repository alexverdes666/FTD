const AgentFine = require("../models/AgentFine");
const User = require("../models/User");
const FineImage = require("../models/FineImage");
const Ticket = require("../models/Ticket");
const { createTicketNotification } = require("./notifications");

// Get all fines for all agents (admin view)
const getAllAgentFines = async (req, res) => {
  try {
    const year = req.query.year ? parseInt(req.query.year) : null;
    const month = req.query.month ? parseInt(req.query.month) : null;
    
    let fines;
    if (year || month) {
      // If month/year filtering is requested, get month-specific fines
      const matchQuery = { isActive: true };
      if (year) matchQuery.fineYear = year;
      if (month) matchQuery.fineMonth = month;
      
      fines = await AgentFine.find(matchQuery)
        .populate("agent", "fullName email")
        .populate("imposedBy", "fullName email")
        .populate("resolvedBy", "fullName email")
        .sort({ imposedDate: -1 });
    } else {
      // Get all active fines (original behavior)
      fines = await AgentFine.getAllActiveFines();
    }
    
    // If user is an agent, filter to show only their own fines
    let filteredFines = fines;
    if (req.user.role === 'agent') {
      filteredFines = fines.filter(fine => fine.agent._id.toString() === req.user._id.toString());
    }

    res.json({
      success: true,
      data: filteredFines,
    });
  } catch (error) {
    console.error("Error fetching agent fines:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch agent fines",
      error: error.message,
    });
  }
};

// Get fines summary for all agents (for admin dashboard)
const getFinesSummary = async (req, res) => {
  try {
    const summary = await AgentFine.getFinesSummary();

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Error fetching fines summary:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch fines summary",
      error: error.message,
    });
  }
};

// Get fines for a specific agent
const getAgentFines = async (req, res) => {
  try {
    const { agentId } = req.params;
    const includeResolved = req.query.includeResolved === "true";
    const year = req.query.year ? parseInt(req.query.year) : null;
    const month = req.query.month ? parseInt(req.query.month) : null;

    const fines = await AgentFine.getAgentFines(agentId, includeResolved, year, month);

    res.json({
      success: true,
      data: fines,
    });
  } catch (error) {
    console.error("Error fetching agent fines:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch agent fines",
      error: error.message,
    });
  }
};

// Create a new fine for an agent (managers and admins)
const createAgentFine = async (req, res) => {
  try {
    const { agentId } = req.params;
    const { amount, reason, description, notes, fineMonth, fineYear, images, leadId, orderId } = req.body;
    const managerId = req.user.id;

    // Validate that the agent exists
    const agent = await User.findById(agentId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: "Agent not found",
      });
    }

    // Validate required fields
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Fine amount must be greater than 0",
      });
    }

    if (!reason || reason.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Fine reason is required",
      });
    }

    // Validate month and year if provided
    const currentDate = new Date();
    const targetMonth = fineMonth || (currentDate.getMonth() + 1);
    const targetYear = fineYear || currentDate.getFullYear();

    if (targetMonth < 1 || targetMonth > 12) {
      return res.status(400).json({
        success: false,
        message: "Invalid month (must be 1-12)",
      });
    }

    // Validate images if provided
    let imageIds = [];
    if (images && Array.isArray(images) && images.length > 0) {
      // Verify all image IDs are valid
      const validImages = await FineImage.find({ _id: { $in: images } });
      if (validImages.length !== images.length) {
        return res.status(400).json({
          success: false,
          message: "One or more invalid image IDs provided",
        });
      }
      imageIds = images;
    }

    // Check if a fine already exists for this lead (if leadId provided)
    if (leadId) {
      const existingFine = await AgentFine.findOne({
        lead: leadId,
        isActive: true,
        status: { $nin: ["admin_rejected", "waived"] }, // Allow new fine if previous was rejected or waived
      });
      if (existingFine) {
        return res.status(400).json({
          success: false,
          message: "A fine already exists for this lead",
        });
      }
    }

    // Create the fine with month/year and pending_approval status
    const fineData = {
      agent: agentId,
      amount: parseFloat(amount),
      reason: reason.trim(),
      description: description?.trim() || "",
      imposedBy: managerId,
      notes: notes?.trim() || "",
      fineMonth: targetMonth,
      fineYear: targetYear,
      images: imageIds,
      status: "pending_approval", // Initial status awaiting agent approval
    };

    // Add lead reference if provided
    if (leadId) {
      fineData.lead = leadId;
    }

    // Add order reference if provided
    if (orderId) {
      fineData.orderId = orderId;
    }

    const fine = await AgentFine.create(fineData);

    // Update images with fineId reference
    if (imageIds.length > 0) {
      await FineImage.updateMany(
        { _id: { $in: imageIds } },
        { $set: { fineId: fine._id } }
      );
    }

    // Populate the response
    await fine.populate("agent", "fullName email");
    await fine.populate("imposedBy", "fullName email");
    await fine.populate("images");
    if (fine.lead) {
      await fine.populate("lead", "firstName lastName email phone");
    }
    if (fine.orderId) {
      await fine.populate("orderId", "_id createdAt");
    }

    // Emit real-time notification to the agent via Socket.IO
    if (req.io) {
      req.io.to(`user:${agentId}`).emit('fine_created', {
        fine: fine.toJSON(),
      });
    }

    res.status(201).json({
      success: true,
      message: "Fine created successfully. Awaiting agent approval.",
      data: fine,
    });
  } catch (error) {
    console.error("Error creating agent fine:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create agent fine",
      error: error.message,
    });
  }
};

// Update a fine (mainly for editing details)
const updateAgentFine = async (req, res) => {
  try {
    const { fineId } = req.params;
    const { amount, reason, description, notes, images } = req.body;
    const managerId = req.user.id;

    const fine = await AgentFine.findById(fineId);
    if (!fine) {
      return res.status(404).json({
        success: false,
        message: "Fine not found",
      });
    }

    // Only allow updating if the fine is still pending_approval
    if (!["pending_approval"].includes(fine.status)) {
      return res.status(400).json({
        success: false,
        message: "Cannot update a fine that has been responded to or resolved",
      });
    }

    // Update the fine
    if (amount !== undefined) {
      if (amount <= 0) {
        return res.status(400).json({
          success: false,
          message: "Fine amount must be greater than 0",
        });
      }
      fine.amount = parseFloat(amount);
    }

    if (reason !== undefined) {
      if (reason.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Fine reason is required",
        });
      }
      fine.reason = reason.trim();
    }

    if (description !== undefined) {
      fine.description = description.trim();
    }

    if (notes !== undefined) {
      fine.notes = notes.trim();
    }

    // Update images if provided
    if (images !== undefined && Array.isArray(images)) {
      // Remove old fineId from previous images
      if (fine.images && fine.images.length > 0) {
        await FineImage.updateMany(
          { _id: { $in: fine.images } },
          { $set: { fineId: null } }
        );
      }

      // Validate new images
      if (images.length > 0) {
        const validImages = await FineImage.find({ _id: { $in: images } });
        if (validImages.length !== images.length) {
          return res.status(400).json({
            success: false,
            message: "One or more invalid image IDs provided",
          });
        }
        // Update new images with fineId
        await FineImage.updateMany(
          { _id: { $in: images } },
          { $set: { fineId: fine._id } }
        );
      }
      fine.images = images;
    }

    await fine.save();

    // Populate the response
    await fine.populate("agent", "fullName email");
    await fine.populate("imposedBy", "fullName email");
    await fine.populate("images");

    res.json({
      success: true,
      message: "Fine updated successfully",
      data: fine,
    });
  } catch (error) {
    console.error("Error updating agent fine:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update agent fine",
      error: error.message,
    });
  }
};

// Resolve a fine (mark as paid, waived - only for approved/admin_approved fines)
const resolveAgentFine = async (req, res) => {
  try {
    const { fineId } = req.params;
    const { status, notes } = req.body;
    const adminId = req.user.id;

    const fine = await AgentFine.findById(fineId);
    if (!fine) {
      return res.status(404).json({
        success: false,
        message: "Fine not found",
      });
    }

    // Validate status - only paid or waived are valid resolutions
    const validStatuses = ["paid", "waived"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be one of: paid, waived",
      });
    }

    // Only allow resolving fines that are approved or admin_approved
    if (!["approved", "admin_approved"].includes(fine.status)) {
      return res.status(400).json({
        success: false,
        message: "Can only resolve fines that have been approved",
      });
    }

    // Resolve the fine
    await fine.resolve(status, adminId, notes);

    // Populate the response
    await fine.populate("agent", "fullName email");
    await fine.populate("imposedBy", "fullName email");
    await fine.populate("resolvedBy", "fullName email");
    await fine.populate("images");

    res.json({
      success: true,
      message: `Fine marked as ${status}`,
      data: fine,
    });
  } catch (error) {
    console.error("Error resolving agent fine:", error);
    res.status(500).json({
      success: false,
      message: "Failed to resolve agent fine",
      error: error.message,
    });
  }
};

// Agent response to fine (approve or dispute)
const agentRespondToFine = async (req, res) => {
  try {
    const { fineId } = req.params;
    const { action, disputeReason, description, images } = req.body;
    const agentId = req.user.id;

    const fine = await AgentFine.findById(fineId);
    if (!fine) {
      return res.status(404).json({
        success: false,
        message: "Fine not found",
      });
    }

    // Check if user is the agent for this fine
    if (fine.agent.toString() !== agentId) {
      return res.status(403).json({
        success: false,
        message: "You can only respond to your own fines",
      });
    }

    // Only allow response to pending_approval fines
    if (fine.status !== "pending_approval") {
      return res.status(400).json({
        success: false,
        message: "This fine has already been responded to",
      });
    }

    // Validate action
    if (!["approved", "disputed"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action. Must be 'approved' or 'disputed'",
      });
    }

    // If disputing, require a reason
    if (action === "disputed" && (!disputeReason || disputeReason.trim() === "")) {
      return res.status(400).json({
        success: false,
        message: "Dispute reason is required when disputing a fine",
      });
    }

    // Update fine with agent response
    fine.agentResponse = {
      action,
      disputeReason: action === "disputed" ? disputeReason.trim() : undefined,
      description: description ? description.trim() : undefined,
      images: images && images.length > 0 ? images : undefined,
      respondedAt: new Date(),
    };

    // Update status based on action
    fine.status = action; // 'approved' or 'disputed'

    await fine.save();

    // If disputed, also create a ticket for admin visibility
    if (action === "disputed") {
      try {
        const agent = await User.findById(agentId, "fullName");
        const agentName = agent ? agent.fullName : "Agent";

        const ticket = await Ticket.create({
          title: `Fine Dispute - ${fine.reason}`,
          description: `Agent ${agentName} disputed a fine of $${fine.amount}.\n\nFine reason: ${fine.reason}\n${fine.description ? `Fine description: ${fine.description}\n` : ""}\nDispute reason: ${disputeReason.trim()}${description ? `\nAdditional details: ${description.trim()}` : ""}`,
          category: "fine_dispute",
          priority: "high",
          createdBy: agentId,
          relatedFine: fine._id,
          tags: ["fine-dispute"],
          lastActivityBy: agentId,
        });

        // Notify all admins about the new ticket
        const admins = await User.find({ role: "admin", isActive: true });
        for (const admin of admins) {
          if (admin._id.toString() !== agentId) {
            await createTicketNotification(
              "ticket_created",
              ticket,
              admin._id,
              agentId,
              req.io
            );
          }
        }
      } catch (ticketError) {
        console.error("Failed to create dispute ticket:", ticketError);
        // Don't fail the dispute itself if ticket creation fails
      }
    }

    // Populate the response
    await fine.populate("agent", "fullName email");
    await fine.populate("imposedBy", "fullName email");
    await fine.populate("images");
    await fine.populate("agentResponse.images");

    res.json({
      success: true,
      message: action === "approved"
        ? "Fine approved successfully"
        : "Fine disputed. Awaiting admin review.",
      data: fine,
    });
  } catch (error) {
    console.error("Error responding to agent fine:", error);
    res.status(500).json({
      success: false,
      message: "Failed to respond to fine",
      error: error.message,
    });
  }
};

// Admin decision on disputed fine
const adminDecideFine = async (req, res) => {
  try {
    const { fineId } = req.params;
    const { action, notes } = req.body;
    const adminId = req.user.id;

    const fine = await AgentFine.findById(fineId);
    if (!fine) {
      return res.status(404).json({
        success: false,
        message: "Fine not found",
      });
    }

    // Only allow decision on disputed fines
    if (fine.status !== "disputed") {
      return res.status(400).json({
        success: false,
        message: "Can only make decisions on disputed fines",
      });
    }

    // Validate action
    if (!["approve_dispute", "reject_dispute"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action. Must be 'approve_dispute' or 'reject_dispute'",
      });
    }

    // Update fine with admin decision
    fine.adminDecision = {
      action,
      notes: notes?.trim() || undefined,
      decidedBy: adminId,
      decidedAt: new Date(),
    };

    // approve_dispute = agent was right, fine is dropped (admin_rejected)
    // reject_dispute = agent was wrong, fine stands (admin_approved)
    fine.status = action === "reject_dispute" ? "admin_approved" : "admin_rejected";

    await fine.save();

    // Populate the response
    await fine.populate("agent", "fullName email");
    await fine.populate("imposedBy", "fullName email");
    await fine.populate("adminDecision.decidedBy", "fullName email");
    await fine.populate("images");

    res.json({
      success: true,
      message: action === "approve_dispute"
        ? "Dispute approved - fine has been dropped"
        : "Dispute rejected - fine still stands",
      data: fine,
    });
  } catch (error) {
    console.error("Error making admin decision on fine:", error);
    res.status(500).json({
      success: false,
      message: "Failed to make decision on fine",
      error: error.message,
    });
  }
};

// Get fines pending agent approval (for agent's own fines)
const getPendingApprovalFines = async (req, res) => {
  try {
    const agentId = req.user.role === "agent" ? req.user.id : null;

    const fines = await AgentFine.getPendingApprovalFines(agentId);

    res.json({
      success: true,
      data: fines,
    });
  } catch (error) {
    console.error("Error fetching pending approval fines:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pending approval fines",
      error: error.message,
    });
  }
};

// Get disputed fines for admin review
const getDisputedFines = async (req, res) => {
  try {
    const fines = await AgentFine.getDisputedFines();

    res.json({
      success: true,
      data: fines,
    });
  } catch (error) {
    console.error("Error fetching disputed fines:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch disputed fines",
      error: error.message,
    });
  }
};

// Delete a fine (set as inactive)
const deleteAgentFine = async (req, res) => {
  try {
    const { fineId } = req.params;
    const adminId = req.user.id;

    const fine = await AgentFine.findById(fineId);
    if (!fine) {
      return res.status(404).json({
        success: false,
        message: "Fine not found",
      });
    }

    // Mark as inactive instead of deleting
    fine.isActive = false;
    await fine.save();

    res.json({
      success: true,
      message: "Fine deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting agent fine:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete agent fine",
      error: error.message,
    });
  }
};

// Get total active fines for an agent
const getAgentTotalFines = async (req, res) => {
  try {
    const { agentId } = req.params;
    const year = req.query.year ? parseInt(req.query.year) : null;
    const month = req.query.month ? parseInt(req.query.month) : null;

    const result = await AgentFine.getTotalActiveFines(agentId, year, month);
    const totalFines = result.length > 0 ? result[0].totalFines : 0;

    res.json({
      success: true,
      data: {
        agentId,
        totalActiveFines: totalFines,
        year,
        month,
      },
    });
  } catch (error) {
    console.error("Error fetching agent total fines:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch agent total fines",
      error: error.message,
    });
  }
};

// Get monthly fines for an agent (similar to monthly call bonuses)
const getAgentMonthlyFines = async (req, res) => {
  try {
    const { agentId } = req.params;
    const year = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();
    const month = req.query.month ? parseInt(req.query.month) : new Date().getMonth() + 1;

    // Validate month and year
    if (month < 1 || month > 12) {
      return res.status(400).json({
        success: false,
        message: "Invalid month (must be 1-12)",
      });
    }

    const fines = await AgentFine.getMonthlyFines(agentId, year, month);
    const totalResult = await AgentFine.getTotalMonthlyFines(agentId, year, month);
    const totalAmount = totalResult.length > 0 ? totalResult[0].totalFines : 0;

    res.json({
      success: true,
      data: {
        agentId,
        year,
        month,
        fines,
        totalAmount,
      },
    });
  } catch (error) {
    console.error("Error fetching agent monthly fines:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch agent monthly fines",
      error: error.message,
    });
  }
};

// Get fines by lead ID
const getFinesByLeadId = async (req, res) => {
  try {
    const { leadId } = req.params;

    const fines = await AgentFine.getFinesByLeadId(leadId);

    res.json({
      success: true,
      data: fines,
    });
  } catch (error) {
    console.error("Error fetching fines by lead ID:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch fines by lead ID",
      error: error.message,
    });
  }
};

// Get unacknowledged fines for the current agent (for popup notifications)
const getUnacknowledgedFines = async (req, res) => {
  try {
    const agentId = req.user.id;

    const fines = await AgentFine.find({
      agent: agentId,
      acknowledgedByAgent: false,
      isActive: true,
    })
      .populate("imposedBy", "fullName email")
      .populate("lead", "firstName lastName email phone")
      .populate("orderId", "_id createdAt")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: fines,
    });
  } catch (error) {
    console.error("Error fetching unacknowledged fines:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch unacknowledged fines",
      error: error.message,
    });
  }
};

// Acknowledge a fine (dismiss the popup notification)
const acknowledgeFine = async (req, res) => {
  try {
    const { fineId } = req.params;
    const agentId = req.user.id;

    const fine = await AgentFine.findById(fineId);
    if (!fine) {
      return res.status(404).json({
        success: false,
        message: "Fine not found",
      });
    }

    // Ensure the agent can only acknowledge their own fines
    if (fine.agent.toString() !== agentId) {
      return res.status(403).json({
        success: false,
        message: "You can only acknowledge your own fines",
      });
    }

    fine.acknowledgedByAgent = true;
    await fine.save();

    res.json({
      success: true,
      message: "Fine acknowledged",
    });
  } catch (error) {
    console.error("Error acknowledging fine:", error);
    res.status(500).json({
      success: false,
      message: "Failed to acknowledge fine",
      error: error.message,
    });
  }
};

module.exports = {
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
};
