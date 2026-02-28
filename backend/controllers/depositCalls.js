const DepositCall = require("../models/DepositCall");
const Lead = require("../models/Lead");
const Order = require("../models/Order");
const User = require("../models/User");
const ClientBroker = require("../models/ClientBroker");
const AgentCallDeclaration = require("../models/AgentCallDeclaration");
const mongoose = require("mongoose");
const { ObjectId } = mongoose.Types;

// Map call types to call slot numbers on DepositCall model (same as in agentCallDeclarations controller)
const CALL_TYPE_TO_CALL_NUMBER = {
  first_call: 1,
  second_call: 2,
  third_call: 3,
  fourth_call: 4,
  fifth_call: 5,
  sixth_call: 6,
  seventh_call: 7,
  eighth_call: 8,
  ninth_call: 9,
  tenth_call: 10,
};

// Get all deposit calls with filters
exports.getDepositCalls = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 50,
      accountManager,
      assignedAgent,
      clientBrokerId,
      clientNetwork,
      ourNetwork,
      status = "active",
      startDate,
      endDate,
      search,
    } = req.query;

    const query = {};

    // Helper: cast to ObjectId for aggregation compatibility
    // Mongoose .find() auto-casts strings to ObjectIds, but aggregation $match does NOT
    const toObjectId = (id) => new ObjectId(id);

    // Role-based filtering
    if (req.user.role === "agent") {
      // Agents can only see their assigned deposit calls
      query.assignedAgent = toObjectId(req.user.id);
    } else if (req.user.role === "affiliate_manager") {
      // AMs can see their own assigned deposit calls OR filter by agent
      if (assignedAgent) {
        query.assignedAgent = toObjectId(assignedAgent);
      } else {
        // Show all that they are AM for, or assigned to them as agent
        query.$or = [
          { accountManager: toObjectId(req.user.id) },
          { assignedAgent: toObjectId(req.user.id) },
        ];
      }
    } else if (req.user.role === "admin") {
      // Admins can filter by any AM or agent
      if (accountManager) {
        query.accountManager = toObjectId(accountManager);
      }
      if (assignedAgent) {
        query.assignedAgent = toObjectId(assignedAgent);
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
      query.clientBrokerId = toObjectId(clientBrokerId);
    }

    // Date range filter is applied on order.createdAt via aggregation
    const hasDateFilter = startDate || endDate;

    // Build aggregation for search or network filtering
    let depositCalls;
    let total;

    // Need aggregation if searching or filtering by lead fields (clientNetwork, ourNetwork) or date
    const needsAggregation = search || clientNetwork || ourNetwork || hasDateFilter;

    if (needsAggregation) {
      // Use aggregation for search across populated fields or network filtering
      const searchRegex = search ? new RegExp(search, "i") : null;

      // Build lead match conditions
      const leadMatchConditions = [];

      if (searchRegex) {
        leadMatchConditions.push({
          $or: [
            { ftdName: searchRegex },
            { ftdEmail: searchRegex },
            { ftdPhone: searchRegex },
            { "lead.firstName": searchRegex },
            { "lead.lastName": searchRegex },
          ],
        });
      }

      if (clientNetwork) {
        // Filter by clientNetwork ID in the clientNetworkHistory array
        leadMatchConditions.push({
          "lead.clientNetworkHistory.clientNetwork": new ObjectId(clientNetwork)
        });
      }

      if (ourNetwork) {
        // Filter by ourNetwork ID in the ourNetworkHistory array
        leadMatchConditions.push({
          "lead.ourNetworkHistory.ourNetwork": new ObjectId(ourNetwork)
        });
      }

      const pipeline = [
        { $match: query },
        {
          $lookup: {
            from: "orders",
            localField: "orderId",
            foreignField: "_id",
            as: "order",
          },
        },
        { $unwind: { path: "$order", preserveNullAndEmptyArrays: true } },
      ];

      // Filter by order.createdAt date range
      if (hasDateFilter) {
        const orderDateMatch = {};
        if (startDate) orderDateMatch.$gte = new Date(startDate);
        if (endDate) orderDateMatch.$lte = new Date(endDate);
        pipeline.push({ $match: { "order.createdAt": orderDateMatch } });
      }

      // Lookup leads
      pipeline.push(
        {
          $lookup: {
            from: "leads",
            localField: "leadId",
            foreignField: "_id",
            as: "lead",
          },
        },
        { $unwind: { path: "$lead", preserveNullAndEmptyArrays: true } }
      );

      // Add lead field matching if we have conditions
      if (leadMatchConditions.length > 0) {
        pipeline.push({
          $match: leadMatchConditions.length === 1
            ? leadMatchConditions[0]
            : { $and: leadMatchConditions },
        });
      }

      pipeline.push(
        { $sort: { createdAt: -1 } },
        { $skip: (parseInt(page) - 1) * parseInt(limit) },
        { $limit: parseInt(limit) }
      );

      depositCalls = await DepositCall.aggregate(pipeline);

      // Get count
      const countPipeline = [
        { $match: query },
        {
          $lookup: {
            from: "orders",
            localField: "orderId",
            foreignField: "_id",
            as: "order",
          },
        },
        { $unwind: { path: "$order", preserveNullAndEmptyArrays: true } },
      ];

      if (hasDateFilter) {
        const orderDateMatch = {};
        if (startDate) orderDateMatch.$gte = new Date(startDate);
        if (endDate) orderDateMatch.$lte = new Date(endDate);
        countPipeline.push({ $match: { "order.createdAt": orderDateMatch } });
      }

      countPipeline.push(
        {
          $lookup: {
            from: "leads",
            localField: "leadId",
            foreignField: "_id",
            as: "lead",
          },
        },
        { $unwind: { path: "$lead", preserveNullAndEmptyArrays: true } }
      );

      if (leadMatchConditions.length > 0) {
        countPipeline.push({
          $match: leadMatchConditions.length === 1
            ? leadMatchConditions[0]
            : { $and: leadMatchConditions },
        });
      }

      countPipeline.push({ $count: "total" });

      const countResult = await DepositCall.aggregate(countPipeline);
      total = countResult[0]?.total || 0;

      // Populate additional fields
      await DepositCall.populate(depositCalls, [
        {
          path: "leadId",
          select: "firstName lastName newEmail newPhone country clientNetwork ourNetwork clientNetworkHistory ourNetworkHistory",
          populate: [
            { path: "clientNetworkHistory.clientNetwork", select: "name" },
            { path: "ourNetworkHistory.ourNetwork", select: "name" },
          ],
        },
        {
          path: "orderId",
          select: "createdAt plannedDate status selectedClientNetwork selectedOurNetwork",
          populate: [
            { path: "selectedClientNetwork", select: "name" },
            { path: "selectedOurNetwork", select: "name" },
          ],
        },
        { path: "clientBrokerId", select: "name domain" },
        { path: "accountManager", select: "fullName email" },
        { path: "assignedAgent", select: "fullName email" },
        { path: "createdBy", select: "fullName" },
        { path: "depositConfirmedBy", select: "fullName" },
        {
          path: "depositCallDeclaration",
          populate: [
            { path: "agent", select: "fullName email fourDigitCode" },
            { path: "lead", select: "firstName lastName newEmail newPhone" },
            { path: "reviewedBy", select: "fullName email" },
            { path: "affiliateManager", select: "fullName email" },
          ],
        },
      ]);
    } else {
      // Standard query
      total = await DepositCall.countDocuments(query);

      depositCalls = await DepositCall.find(query)
        .populate({
          path: "leadId",
          select: "firstName lastName newEmail newPhone country clientNetwork ourNetwork clientNetworkHistory ourNetworkHistory",
          populate: [
            { path: "clientNetworkHistory.clientNetwork", select: "name" },
            { path: "ourNetworkHistory.ourNetwork", select: "name" },
          ],
        })
        .populate({
          path: "orderId",
          select: "createdAt plannedDate status selectedClientNetwork selectedOurNetwork",
          populate: [
            { path: "selectedClientNetwork", select: "name" },
            { path: "selectedOurNetwork", select: "name" },
          ],
        })
        .populate("clientBrokerId", "name domain")
        .populate("accountManager", "fullName email")
        .populate("assignedAgent", "fullName email")
        .populate("createdBy", "fullName")
        .populate("depositConfirmedBy", "fullName")
        .populate({
          path: "depositCallDeclaration",
          populate: [
            { path: "agent", select: "fullName email fourDigitCode" },
            { path: "lead", select: "firstName lastName newEmail newPhone" },
            { path: "reviewedBy", select: "fullName email" },
            { path: "affiliateManager", select: "fullName email" },
          ],
        })
        .sort({ createdAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit))
        .lean();
    }

    // Attach pending/approved AgentCallDeclarations to each deposit call.
    // Many declarations lack depositCallId, so match by lead + orderId instead.
    const dcIds = depositCalls.map((dc) => dc._id);
    const leadIds = [...new Set(depositCalls.map((dc) => (dc.leadId?._id || dc.leadId).toString()))];
    const orderIds = depositCalls.map((dc) => dc.orderId?._id || dc.orderId).filter(Boolean);

    const declarations = await AgentCallDeclaration.find({
      isActive: true,
      callCategory: "ftd",
      callType: { $ne: "deposit" },
      $or: [
        { depositCallId: { $in: dcIds } },
        { lead: { $in: leadIds }, orderId: { $in: orderIds } },
      ],
    })
      .populate("agent", "fullName email fourDigitCode")
      .populate("lead", "firstName lastName newEmail newPhone")
      .populate("reviewedBy", "fullName email")
      .populate("affiliateManager", "fullName email")
      .lean();

    // Build lookup maps for matching declarations -> deposit calls
    const dcByDepositCallId = {};
    const dcByLeadOrder = {};
    for (const dc of depositCalls) {
      const dcId = dc._id.toString();
      dcByDepositCallId[dcId] = dc;
      const leadId = (dc.leadId?._id || dc.leadId)?.toString();
      const orderId = (dc.orderId?._id || dc.orderId)?.toString();
      if (leadId && orderId) {
        dcByLeadOrder[`${leadId}_${orderId}`] = dc;
      }
    }

    // Build per-depositCall, per-callNumber map
    const declMap = {};
    for (const decl of declarations) {
      const callNum = CALL_TYPE_TO_CALL_NUMBER[decl.callType];
      if (!callNum) continue;

      // Resolve which deposit call this declaration belongs to
      let targetDcId = null;
      if (decl.depositCallId && dcByDepositCallId[decl.depositCallId.toString()]) {
        targetDcId = decl.depositCallId.toString();
      } else if (decl.lead && decl.orderId) {
        const leadId = (decl.lead._id || decl.lead).toString();
        const orderId = decl.orderId.toString();
        const matchedDc = dcByLeadOrder[`${leadId}_${orderId}`];
        if (matchedDc) targetDcId = matchedDc._id.toString();
      }
      if (!targetDcId) continue;

      if (!declMap[targetDcId]) declMap[targetDcId] = {};
      declMap[targetDcId][callNum] = decl;
    }

    // Attach to each depositCall
    for (const dc of depositCalls) {
      dc.callDeclarations = declMap[dc._id.toString()] || {};
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
            country: dc.leadId?.country || null,
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

// Sync confirmed deposits from orders into DepositCall records
exports.syncConfirmedDeposits = async (req, res, next) => {
  try {
    // Only admin can sync
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can sync confirmed deposits",
      });
    }

    // Find all orders that have at least one confirmed deposit
    const orders = await Order.find({
      "leadsMetadata.depositConfirmed": true,
    })
      .populate("requester", "role")
      .lean();

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const order of orders) {
      const confirmedEntries = order.leadsMetadata.filter(
        (meta) => meta.depositConfirmed
      );

      for (const meta of confirmedEntries) {
        const leadId = meta.leadId;

        // Check if DepositCall already exists
        let depositCall = await DepositCall.findOne({
          leadId,
          orderId: order._id,
        });

        if (depositCall) {
          let changed = false;
          if (!depositCall.depositConfirmed) {
            depositCall.depositConfirmed = true;
            depositCall.depositConfirmedBy =
              meta.depositConfirmedBy || null;
            depositCall.depositConfirmedAt =
              meta.depositConfirmedAt || null;
            depositCall.depositStatus = "confirmed";
            changed = true;
          }
          if (!depositCall.accountManager && meta.depositConfirmedBy) {
            depositCall.accountManager = meta.depositConfirmedBy;
            changed = true;
          }
          if (!depositCall.clientBrokerId) {
            const lead = await Lead.findById(leadId);
            const broker = lead?.assignedClientBrokers?.[0] || order.selectedClientBrokers?.[0] || null;
            if (broker) {
              depositCall.clientBrokerId = broker;
              changed = true;
            }
          }
          if (changed) {
            await depositCall.save();
            updated++;
          } else {
            skipped++;
          }
          continue;
        }

        // Load the lead to get FTD details
        const lead = await Lead.findById(leadId);
        if (!lead) {
          skipped++;
          continue;
        }

        try {
          await DepositCall.create({
            leadId: lead._id,
            orderId: order._id,
            clientBrokerId: lead.assignedClientBrokers?.[0] || order.selectedClientBrokers?.[0] || null,
            accountManager: meta.depositConfirmedBy || null,
            assignedAgent: lead.assignedAgent || null,
            ftdName: `${lead.firstName} ${lead.lastName}`,
            ftdEmail: lead.newEmail,
            ftdPhone: lead.newPhone,
            depositConfirmed: true,
            depositConfirmedBy: meta.depositConfirmedBy || null,
            depositConfirmedAt: meta.depositConfirmedAt || null,
            depositStatus: "confirmed",
            createdBy: req.user.id,
          });
          created++;
        } catch (err) {
          // Skip duplicates (race condition safety)
          if (err.code === 11000) {
            skipped++;
          } else {
            throw err;
          }
        }
      }
    }

    res.status(200).json({
      success: true,
      message: `Sync complete: ${created} created, ${updated} updated, ${skipped} skipped`,
      data: { created, updated, skipped },
    });
  } catch (error) {
    next(error);
  }
};

// Sync approved call declarations into DepositCall records
// Repairs DepositCall call slots that were missed due to the findOne bug
exports.createCustomDepositCall = async (req, res, next) => {
  try {
    // Only admin can create custom records
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can create custom deposit call records",
      });
    }

    const { leadId, orderId, accountManager, assignedAgent, note, customDate } = req.body;

    if (!leadId) {
      return res.status(400).json({
        success: false,
        message: "leadId is required",
      });
    }

    if (!note || !note.trim()) {
      return res.status(400).json({
        success: false,
        message: "Note is required for custom records",
      });
    }

    // Validate lead exists
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // If orderId provided, validate it exists (support partial ID matching)
    let resolvedOrderId = null;
    if (orderId) {
      if (orderId.match(/^[0-9a-fA-F]{24}$/)) {
        // Full ObjectId
        const order = await Order.findById(orderId);
        if (!order) {
          return res.status(404).json({
            success: false,
            message: "Order not found",
          });
        }
        resolvedOrderId = order._id;
      } else {
        // Partial ID (e.g. last 8 chars shown in UI) — use aggregation to match
        const orders = await Order.aggregate([
          { $addFields: { idStr: { $toString: "$_id" } } },
          { $match: { idStr: { $regex: new RegExp(orderId + "$", "i") } } },
          { $limit: 2 },
          { $project: { _id: 1 } },
        ]);
        if (orders.length === 0) {
          return res.status(404).json({
            success: false,
            message: "Order not found with this ID",
          });
        }
        if (orders.length > 1) {
          return res.status(400).json({
            success: false,
            message: "Multiple orders match this partial ID. Please provide more characters.",
          });
        }
        resolvedOrderId = orders[0]._id;
      }
    }

    // If accountManager provided, validate user exists
    if (accountManager) {
      const am = await User.findById(accountManager);
      if (!am) {
        return res.status(404).json({
          success: false,
          message: "Account manager not found",
        });
      }
    }

    // Create custom deposit call record
    const depositCall = await DepositCall.create({
      leadId,
      orderId: resolvedOrderId,
      clientBrokerId: lead.clientBroker || null,
      accountManager: accountManager || null,
      assignedAgent: assignedAgent || lead.assignedAgent || null,
      ftdName: `${lead.firstName || ""} ${lead.lastName || ""}`.trim(),
      ftdEmail: lead.newEmail,
      ftdPhone: lead.newPhone,
      isCustomRecord: true,
      customNote: note.trim(),
      customDate: customDate ? new Date(customDate) : null,
      depositConfirmed: true,
      depositConfirmedBy: req.user.id,
      depositConfirmedAt: new Date(),
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
      message: "Custom deposit call record created successfully",
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};

// Sync ALL ordered FTDs into DepositCall records (not just confirmed ones)
// Creates deposit calls with 'pending' status for FTDs that don't have one yet
exports.syncOrderedFTDs = async (req, res, next) => {
  try {
    // Only admin can sync
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can sync ordered FTDs",
      });
    }

    // Find all non-cancelled orders with FTD leads
    const orders = await Order.find({
      status: { $ne: "cancelled" },
      "leadsMetadata.orderedAs": "ftd",
    })
      .populate("requester", "role")
      .lean();

    let created = 0;
    let skipped = 0;

    for (const order of orders) {
      const ftdMetadata = (order.leadsMetadata || []).filter(
        (meta) => meta.orderedAs === "ftd"
      );

      for (const meta of ftdMetadata) {
        const leadId = meta.leadId;

        // Check if deposit call already exists
        const existing = await DepositCall.findOne({
          leadId,
          orderId: order._id,
        });
        if (existing) {
          skipped++;
          continue;
        }

        // Find the lead
        const lead = await Lead.findById(leadId);
        if (!lead) {
          skipped++;
          continue;
        }

        try {
          const isConfirmed = meta.depositConfirmed === true;
          await DepositCall.create({
            leadId: lead._id,
            orderId: order._id,
            clientBrokerId:
              lead.assignedClientBrokers?.[0] ||
              order.selectedClientBrokers?.[0] ||
              null,
            accountManager:
              isConfirmed
                ? meta.depositConfirmedBy || null
                : order.requester?.role === "affiliate_manager"
                  ? order.requester._id || null
                  : null,
            assignedAgent: lead.assignedAgent || null,
            ftdName: `${lead.firstName} ${lead.lastName}`,
            ftdEmail: lead.newEmail,
            ftdPhone: lead.newPhone,
            depositConfirmed: isConfirmed,
            depositConfirmedBy: isConfirmed ? meta.depositConfirmedBy : null,
            depositConfirmedAt: isConfirmed ? meta.depositConfirmedAt : null,
            depositStatus: isConfirmed ? "confirmed" : "pending",
            createdBy: req.user.id,
          });
          created++;
        } catch (err) {
          if (err.code === 11000) {
            skipped++;
          } else {
            console.error("[SYNC-FTD] Error creating deposit call:", err);
          }
        }
      }
    }

    res.status(200).json({
      success: true,
      message: `Synced ordered FTDs: ${created} created, ${skipped} skipped (already exist)`,
      data: { created, skipped, ordersScanned: orders.length },
    });
  } catch (error) {
    next(error);
  }
};

exports.syncApprovedDeclarations = async (req, res, next) => {
  try {
    // Only admin can run this
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can sync approved declarations",
      });
    }

    // Find all approved FTD declarations (exclude deposit type and filler)
    const declarations = await AgentCallDeclaration.find({
      status: "approved",
      isActive: true,
      callCategory: "ftd",
      callType: { $ne: "deposit" },
    }).lean();

    let updated = 0;
    let skipped = 0;
    let notFound = 0;

    for (const declaration of declarations) {
      const callNumber = CALL_TYPE_TO_CALL_NUMBER[declaration.callType];
      if (!callNumber) {
        skipped++;
        continue;
      }

      const callField = `call${callNumber}`;

      // Look up lead to get email for fallback matching
      const leadDoc = await Lead.findById(declaration.lead).select("newEmail");

      // Find ALL DepositCall records for this lead (by leadId, then also by email)
      let depositCalls = await DepositCall.find({
        leadId: declaration.lead,
        depositConfirmed: true,
      });

      // Also find by email fallback and merge (avoid duplicates)
      if (leadDoc?.newEmail) {
        const emailMatches = await DepositCall.find({
          ftdEmail: leadDoc.newEmail,
          depositConfirmed: true,
          _id: { $nin: depositCalls.map((dc) => dc._id) },
        });
        depositCalls = depositCalls.concat(emailMatches);
      }

      if (depositCalls.length === 0) {
        notFound++;
        continue;
      }

      // Update all matching DepositCall records
      let allSkipped = true;
      for (const depositCall of depositCalls) {
        if (depositCall[callField].status === "completed") {
          continue;
        }
        depositCall[callField].status = "completed";
        depositCall[callField].doneDate = declaration.reviewedAt || new Date();
        depositCall[callField].approvedBy = declaration.reviewedBy;
        depositCall[callField].approvedAt = declaration.reviewedAt || new Date();
        await depositCall.save();
        updated++;
        allSkipped = false;
      }

      if (allSkipped) {
        skipped++;
      }
    }

    res.status(200).json({
      success: true,
      message: `Sync complete: ${updated} call slots updated, ${skipped} already up-to-date, ${notFound} deposit call records not found`,
      data: { updated, skipped, notFound, totalDeclarations: declarations.length },
    });
  } catch (error) {
    next(error);
  }
};
