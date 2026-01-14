const DepositCall = require("../models/DepositCall");
const Lead = require("../models/Lead");
const Order = require("../models/Order");
const User = require("../models/User");
const ClientBroker = require("../models/ClientBroker");
const mongoose = require("mongoose");

// Get all deposit calls with filters
exports.getDepositCalls = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 50,
      accountManager,
      assignedAgent,
      clientBrokerId,
      status = "active",
      startDate,
      endDate,
      search,
    } = req.query;

    const query = {};

    // Role-based filtering
    if (req.user.role === "agent") {
      // Agents can only see their assigned deposit calls
      query.assignedAgent = req.user.id;
    } else if (req.user.role === "affiliate_manager") {
      // AMs can see their own assigned deposit calls OR filter by agent
      if (assignedAgent) {
        query.assignedAgent = assignedAgent;
      } else {
        // Show all that they are AM for, or assigned to them as agent
        query.$or = [
          { accountManager: req.user.id },
          { assignedAgent: req.user.id },
        ];
      }
    } else if (req.user.role === "admin") {
      // Admins can filter by any AM or agent
      if (accountManager) {
        query.accountManager = accountManager;
      }
      if (assignedAgent) {
        query.assignedAgent = assignedAgent;
      }
    } else {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view deposit calls",
      });
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // Client broker filter
    if (clientBrokerId) {
      query.clientBrokerId = clientBrokerId;
    }

    // Date range filter (for order dates)
    if (startDate || endDate) {
      const dateQuery = {};
      if (startDate) dateQuery.$gte = new Date(startDate);
      if (endDate) dateQuery.$lte = new Date(endDate);
      query.createdAt = dateQuery;
    }

    // Build aggregation for search
    let depositCalls;
    let total;

    if (search) {
      // Use aggregation for search across populated fields
      const searchRegex = new RegExp(search, "i");
      const pipeline = [
        { $match: query },
        {
          $lookup: {
            from: "leads",
            localField: "leadId",
            foreignField: "_id",
            as: "lead",
          },
        },
        { $unwind: { path: "$lead", preserveNullAndEmptyArrays: true } },
        {
          $match: {
            $or: [
              { ftdName: searchRegex },
              { ftdEmail: searchRegex },
              { ftdPhone: searchRegex },
              { "lead.firstName": searchRegex },
              { "lead.lastName": searchRegex },
            ],
          },
        },
        { $sort: { createdAt: -1 } },
        { $skip: (parseInt(page) - 1) * parseInt(limit) },
        { $limit: parseInt(limit) },
      ];

      depositCalls = await DepositCall.aggregate(pipeline);

      // Get count
      const countPipeline = [
        { $match: query },
        {
          $lookup: {
            from: "leads",
            localField: "leadId",
            foreignField: "_id",
            as: "lead",
          },
        },
        { $unwind: { path: "$lead", preserveNullAndEmptyArrays: true } },
        {
          $match: {
            $or: [
              { ftdName: searchRegex },
              { ftdEmail: searchRegex },
              { ftdPhone: searchRegex },
              { "lead.firstName": searchRegex },
              { "lead.lastName": searchRegex },
            ],
          },
        },
        { $count: "total" },
      ];

      const countResult = await DepositCall.aggregate(countPipeline);
      total = countResult[0]?.total || 0;

      // Populate additional fields
      await DepositCall.populate(depositCalls, [
        {
          path: "leadId",
          select: "firstName lastName newEmail newPhone country",
        },
        { path: "orderId", select: "createdAt plannedDate status" },
        { path: "clientBrokerId", select: "name domain" },
        { path: "accountManager", select: "fullName email" },
        { path: "assignedAgent", select: "fullName email" },
        { path: "createdBy", select: "fullName" },
      ]);
    } else {
      // Standard query
      total = await DepositCall.countDocuments(query);

      depositCalls = await DepositCall.find(query)
        .populate("leadId", "firstName lastName newEmail newPhone country")
        .populate("orderId", "createdAt plannedDate status")
        .populate("clientBrokerId", "name domain")
        .populate("accountManager", "fullName email")
        .populate("assignedAgent", "fullName email")
        .populate("createdBy", "fullName")
        .sort({ createdAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit))
        .lean();
    }

    res.status(200).json({
      success: true,
      data: depositCalls,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get single deposit call by ID
exports.getDepositCallById = async (req, res, next) => {
  try {
    const depositCall = await DepositCall.findById(req.params.id)
      .populate("leadId", "firstName lastName newEmail newPhone country")
      .populate("orderId", "createdAt plannedDate status")
      .populate("clientBrokerId", "name domain")
      .populate("accountManager", "fullName email")
      .populate("assignedAgent", "fullName email")
      .populate("createdBy", "fullName");

    if (!depositCall) {
      return res.status(404).json({
        success: false,
        message: "Deposit call not found",
      });
    }

    // Check access
    if (
      req.user.role === "agent" &&
      depositCall.assignedAgent?.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this deposit call",
      });
    }

    res.status(200).json({
      success: true,
      data: depositCall,
    });
  } catch (error) {
    next(error);
  }
};

// Create deposit call
exports.createDepositCall = async (req, res, next) => {
  try {
    const { leadId, orderId, clientBrokerId, accountManager, assignedAgent } =
      req.body;

    // Only admin and AM can create deposit calls
    if (!["admin", "affiliate_manager"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to create deposit calls",
      });
    }

    // Validate lead exists and is FTD
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // Check if deposit call already exists for this lead/order
    const existing = await DepositCall.findOne({ leadId, orderId });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Deposit call tracking already exists for this lead and order",
      });
    }

    // Create deposit call
    const depositCall = await DepositCall.create({
      leadId,
      orderId,
      clientBrokerId,
      accountManager,
      assignedAgent: assignedAgent || lead.assignedAgent,
      ftdName: `${lead.firstName} ${lead.lastName}`,
      ftdEmail: lead.newEmail,
      ftdPhone: lead.newPhone,
      createdBy: req.user.id,
    });

    // Populate and return
    const populated = await DepositCall.findById(depositCall._id)
      .populate("leadId", "firstName lastName newEmail newPhone country")
      .populate("orderId", "createdAt plannedDate status")
      .populate("clientBrokerId", "name domain")
      .populate("accountManager", "fullName email")
      .populate("assignedAgent", "fullName email");

    res.status(201).json({
      success: true,
      message: "Deposit call tracking created successfully",
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};

// Update deposit call (assign AM, agent, etc.)
exports.updateDepositCall = async (req, res, next) => {
  try {
    const { accountManager, assignedAgent, clientBrokerId, status } = req.body;

    // Only admin and AM can update deposit calls
    if (!["admin", "affiliate_manager"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update deposit calls",
      });
    }

    const depositCall = await DepositCall.findById(req.params.id);
    if (!depositCall) {
      return res.status(404).json({
        success: false,
        message: "Deposit call not found",
      });
    }

    // Update fields
    if (accountManager !== undefined)
      depositCall.accountManager = accountManager;
    if (assignedAgent !== undefined) depositCall.assignedAgent = assignedAgent;
    if (clientBrokerId !== undefined)
      depositCall.clientBrokerId = clientBrokerId;
    if (status !== undefined) depositCall.status = status;

    await depositCall.save();

    // Populate and return
    const populated = await DepositCall.findById(depositCall._id)
      .populate("leadId", "firstName lastName newEmail newPhone country")
      .populate("orderId", "createdAt plannedDate status")
      .populate("clientBrokerId", "name domain")
      .populate("accountManager", "fullName email")
      .populate("assignedAgent", "fullName email");

    res.status(200).json({
      success: true,
      message: "Deposit call updated successfully",
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};

// Schedule a call
exports.scheduleCall = async (req, res, next) => {
  try {
    const { callNumber, expectedDate, notes } = req.body;
    const { id } = req.params;

    const depositCall = await DepositCall.findById(id);
    if (!depositCall) {
      return res.status(404).json({
        success: false,
        message: "Deposit call not found",
      });
    }

    // Check access - agents can only schedule for their own
    if (
      req.user.role === "agent" &&
      depositCall.assignedAgent?.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to schedule calls for this deposit",
      });
    }

    // Schedule the call
    depositCall.scheduleCall(callNumber, new Date(expectedDate), req.user.id);

    if (notes) {
      depositCall[`call${callNumber}`].notes = notes;
    }

    await depositCall.save();

    res.status(200).json({
      success: true,
      message: `Call ${callNumber} scheduled successfully`,
      data: depositCall,
    });
  } catch (error) {
    next(error);
  }
};

// Mark call as done (pending approval)
exports.markCallDone = async (req, res, next) => {
  try {
    const { callNumber, notes } = req.body;
    const { id } = req.params;

    const depositCall = await DepositCall.findById(id);
    if (!depositCall) {
      return res.status(404).json({
        success: false,
        message: "Deposit call not found",
      });
    }

    // Check access - agents can only mark done for their own
    if (
      req.user.role === "agent" &&
      depositCall.assignedAgent?.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to mark calls for this deposit",
      });
    }

    // Mark the call as done (pending approval)
    depositCall.markCallDone(callNumber, req.user.id, notes || "");
    await depositCall.save();

    res.status(200).json({
      success: true,
      message: `Call ${callNumber} marked as done and pending approval`,
      data: depositCall,
    });
  } catch (error) {
    next(error);
  }
};

// Approve a call
exports.approveCall = async (req, res, next) => {
  try {
    const { callNumber } = req.body;
    const { id } = req.params;

    // Only admin and AM can approve
    if (!["admin", "affiliate_manager"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to approve calls",
      });
    }

    const depositCall = await DepositCall.findById(id);
    if (!depositCall) {
      return res.status(404).json({
        success: false,
        message: "Deposit call not found",
      });
    }

    // AM can only approve their assigned deposit calls
    if (
      req.user.role === "affiliate_manager" &&
      depositCall.accountManager?.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to approve calls for this deposit",
      });
    }

    // Approve the call
    depositCall.approveCall(callNumber, req.user.id);
    await depositCall.save();

    res.status(200).json({
      success: true,
      message: `Call ${callNumber} approved successfully`,
      data: depositCall,
    });
  } catch (error) {
    next(error);
  }
};

// Reject a call
exports.rejectCall = async (req, res, next) => {
  try {
    const { callNumber } = req.body;
    const { id } = req.params;

    // Only admin and AM can reject
    if (!["admin", "affiliate_manager"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to reject calls",
      });
    }

    const depositCall = await DepositCall.findById(id);
    if (!depositCall) {
      return res.status(404).json({
        success: false,
        message: "Deposit call not found",
      });
    }

    // AM can only reject their assigned deposit calls
    if (
      req.user.role === "affiliate_manager" &&
      depositCall.accountManager?.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to reject calls for this deposit",
      });
    }

    // Reject the call
    depositCall.rejectCall(callNumber, req.user.id);
    await depositCall.save();

    res.status(200).json({
      success: true,
      message: `Call ${callNumber} rejected, returned to scheduled state`,
      data: depositCall,
    });
  } catch (error) {
    next(error);
  }
};

// Mark call as answered (final status)
exports.markCallAnswered = async (req, res, next) => {
  try {
    const { callNumber, notes } = req.body;
    const { id } = req.params;

    // Only admin and AM can mark as answered
    if (!["admin", "affiliate_manager"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to mark calls as answered",
      });
    }

    const depositCall = await DepositCall.findById(id);
    if (!depositCall) {
      return res.status(404).json({
        success: false,
        message: "Deposit call not found",
      });
    }

    // AM can only mark their assigned deposit calls
    if (
      req.user.role === "affiliate_manager" &&
      depositCall.accountManager?.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to mark calls for this deposit",
      });
    }

    // Mark the call as answered
    depositCall.markCallAnswered(callNumber, req.user.id, notes || "");
    await depositCall.save();

    res.status(200).json({
      success: true,
      message: `Call ${callNumber} marked as answered`,
      data: depositCall,
    });
  } catch (error) {
    next(error);
  }
};

// Mark call as rejected (final status - FTD rejected)
exports.markCallRejected = async (req, res, next) => {
  try {
    const { callNumber, notes } = req.body;
    const { id } = req.params;

    // Only admin and AM can mark as rejected
    if (!["admin", "affiliate_manager"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to mark calls as rejected",
      });
    }

    const depositCall = await DepositCall.findById(id);
    if (!depositCall) {
      return res.status(404).json({
        success: false,
        message: "Deposit call not found",
      });
    }

    // AM can only mark their assigned deposit calls
    if (
      req.user.role === "affiliate_manager" &&
      depositCall.accountManager?.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to mark calls for this deposit",
      });
    }

    // Mark the call as rejected
    depositCall.markCallRejected(callNumber, req.user.id, notes || "");
    await depositCall.save();

    res.status(200).json({
      success: true,
      message: `Call ${callNumber} marked as rejected`,
      data: depositCall,
    });
  } catch (error) {
    next(error);
  }
};

// Get pending approvals
exports.getPendingApprovals = async (req, res, next) => {
  try {
    // Only admin and AM can view pending approvals
    if (!["admin", "affiliate_manager"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view pending approvals",
      });
    }

    let depositCalls;
    if (req.user.role === "admin") {
      depositCalls = await DepositCall.getPendingApprovals();
    } else {
      // AM sees only their assigned
      depositCalls = await DepositCall.getPendingApprovals(req.user.id);
    }

    // Transform to include call details
    const result = depositCalls.map((dc) => {
      const pendingCalls = [];
      for (let i = 1; i <= 10; i++) {
        const call = dc[`call${i}`];
        if (call && call.status === "pending_approval") {
          pendingCalls.push({
            callNumber: i,
            expectedDate: call.expectedDate,
            doneDate: call.doneDate,
            markedBy: call.markedBy,
            notes: call.notes,
          });
        }
      }
      return {
        ...dc.toObject(),
        pendingCalls,
      };
    });

    res.status(200).json({
      success: true,
      data: result,
      count: result.length,
    });
  } catch (error) {
    next(error);
  }
};

// Get calendar appointments
exports.getCalendarAppointments = async (req, res, next) => {
  try {
    const { startDate, endDate, accountManager, assignedAgent } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "startDate and endDate are required",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const filters = {};

    // Role-based filtering
    if (req.user.role === "agent") {
      filters.assignedAgent = req.user.id;
    } else if (req.user.role === "affiliate_manager") {
      if (assignedAgent) {
        filters.assignedAgent = assignedAgent;
      } else {
        // Show all their assigned
        filters.accountManager = req.user.id;
      }
    } else if (req.user.role === "admin") {
      if (accountManager) filters.accountManager = accountManager;
      if (assignedAgent) filters.assignedAgent = assignedAgent;
    }

    const depositCalls = await DepositCall.getUpcomingAppointments(
      start,
      end,
      filters
    );

    // Transform to calendar events
    const events = [];
    depositCalls.forEach((dc) => {
      for (let i = 1; i <= 10; i++) {
        const call = dc[`call${i}`];
        if (
          call &&
          call.expectedDate &&
          new Date(call.expectedDate) >= start &&
          new Date(call.expectedDate) <= end
        ) {
          events.push({
            id: `${dc._id}_call${i}`,
            depositCallId: dc._id,
            callNumber: i,
            title: `Call ${i}: ${dc.ftdName}`,
            start: call.expectedDate,
            status: call.status,
            ftdName: dc.ftdName,
            ftdEmail: dc.ftdEmail,
            ftdPhone: dc.ftdPhone,
            clientBroker: dc.clientBrokerId?.name,
            accountManager: dc.accountManager?.fullName,
            agent: dc.assignedAgent?.fullName,
            doneDate: call.doneDate,
            notes: call.notes,
          });
        }
      }
    });

    // Sort by date
    events.sort((a, b) => new Date(a.start) - new Date(b.start));

    res.status(200).json({
      success: true,
      data: events,
      count: events.length,
    });
  } catch (error) {
    next(error);
  }
};

// Auto-create deposit call from order (for FTDs)
exports.createFromOrder = async (req, res, next) => {
  try {
    const { orderId } = req.body;

    // Only admin and AM can create
    if (!["admin", "affiliate_manager"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to create deposit calls",
      });
    }

    const order = await Order.findById(orderId)
      .populate({
        path: "leads",
        match: { leadType: "ftd" },
      })
      .populate("selectedClientBrokers")
      .populate("requester");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const ftdLeads = order.leads.filter((lead) => lead.leadType === "ftd");
    if (ftdLeads.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No FTD leads found in this order",
      });
    }

    const created = [];
    const skipped = [];

    for (const lead of ftdLeads) {
      // Check if already exists
      const existing = await DepositCall.findOne({ leadId: lead._id, orderId });
      if (existing) {
        skipped.push(lead._id);
        continue;
      }

      // Get client broker from lead's history
      const clientBrokerId =
        lead.assignedClientBrokers?.[0] ||
        order.selectedClientBrokers?.[0]?._id ||
        null;

      // Determine AM (requester if AM, or null for admin to assign)
      const accountManager =
        order.requester?.role === "affiliate_manager"
          ? order.requester._id
          : null;

      const depositCall = await DepositCall.create({
        leadId: lead._id,
        orderId,
        clientBrokerId,
        accountManager,
        assignedAgent: lead.assignedAgent,
        ftdName: `${lead.firstName} ${lead.lastName}`,
        ftdEmail: lead.newEmail,
        ftdPhone: lead.newPhone,
        createdBy: req.user.id,
      });

      created.push(depositCall._id);
    }

    res.status(201).json({
      success: true,
      message: `Created ${created.length} deposit call records, skipped ${skipped.length} existing`,
      data: {
        created,
        skipped,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Create/assign deposit call for a single FTD lead to an agent
exports.createAndAssignToAgent = async (req, res, next) => {
  try {
    const { orderId, leadId, agentId } = req.body;

    // Only admin and AM can create and assign
    if (!["admin", "affiliate_manager"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to assign deposit calls",
      });
    }

    // Validate inputs
    if (!orderId || !leadId || !agentId) {
      return res.status(400).json({
        success: false,
        message: "Order ID, Lead ID, and Agent ID are required",
      });
    }

    // Verify order exists
    const order = await Order.findById(orderId)
      .populate("selectedClientBrokers")
      .populate("requester");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Verify lead exists and is FTD
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    if (lead.leadType !== "ftd") {
      return res.status(400).json({
        success: false,
        message: "Only FTD leads can be assigned deposit calls",
      });
    }

    // Verify agent exists and has agent role
    const agent = await User.findById(agentId);
    if (!agent || agent.role !== "agent") {
      return res.status(404).json({
        success: false,
        message: "Valid agent not found",
      });
    }

    // Check if deposit call already exists
    let depositCall = await DepositCall.findOne({ leadId, orderId });

    if (depositCall) {
      // Update existing deposit call with new agent assignment
      depositCall.assignedAgent = agentId;
      await depositCall.save();

      // Populate for response
      await depositCall.populate(
        "leadId accountManager assignedAgent clientBrokerId"
      );

      return res.status(200).json({
        success: true,
        message: "Deposit call reassigned to agent successfully",
        data: depositCall,
        isNew: false,
      });
    }

    // Get client broker from lead's history or order
    const clientBrokerId =
      lead.assignedClientBrokers?.[0] ||
      order.selectedClientBrokers?.[0]?._id ||
      null;

    // Determine AM (requester if AM, or current user if admin)
    const accountManager =
      order.requester?.role === "affiliate_manager"
        ? order.requester._id
        : req.user.role === "affiliate_manager"
        ? req.user.id
        : null;

    // Create new deposit call
    depositCall = await DepositCall.create({
      leadId: lead._id,
      orderId,
      clientBrokerId,
      accountManager,
      assignedAgent: agentId,
      ftdName: `${lead.firstName} ${lead.lastName}`,
      ftdEmail: lead.newEmail,
      ftdPhone: lead.newPhone,
      createdBy: req.user.id,
    });

    // Populate for response
    await depositCall.populate(
      "leadId accountManager assignedAgent clientBrokerId"
    );

    res.status(201).json({
      success: true,
      message: "Deposit call created and assigned to agent successfully",
      data: depositCall,
      isNew: true,
    });
  } catch (error) {
    next(error);
  }
};

// Bulk schedule calls
exports.bulkScheduleCalls = async (req, res, next) => {
  try {
    const { depositCallId, calls } = req.body;
    // calls = [{ callNumber: 1, expectedDate: '2024-01-15T10:00:00Z' }, ...]

    const depositCall = await DepositCall.findById(depositCallId);
    if (!depositCall) {
      return res.status(404).json({
        success: false,
        message: "Deposit call not found",
      });
    }

    // Check access
    if (
      req.user.role === "agent" &&
      depositCall.assignedAgent?.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to schedule calls for this deposit",
      });
    }

    // Schedule all calls
    for (const call of calls) {
      if (call.callNumber >= 1 && call.callNumber <= 10 && call.expectedDate) {
        depositCall.scheduleCall(
          call.callNumber,
          new Date(call.expectedDate),
          req.user.id
        );
        if (call.notes) {
          depositCall[`call${call.callNumber}`].notes = call.notes;
        }
      }
    }

    await depositCall.save();

    res.status(200).json({
      success: true,
      message: `Scheduled ${calls.length} calls successfully`,
      data: depositCall,
    });
  } catch (error) {
    next(error);
  }
};
