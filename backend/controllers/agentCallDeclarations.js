const AgentCallDeclaration = require("../models/AgentCallDeclaration");
const User = require("../models/User");
const Lead = require("../models/Lead");
const cdrService = require("../services/cdrService");

/**
 * Get affiliate managers for declaration assignment
 * GET /call-declarations/affiliate-managers
 * Available to all authenticated users (agents need this to create declarations)
 */
const getAffiliateManagers = async (req, res) => {
  try {
    const affiliateManagers = await User.find({
      role: "affiliate_manager",
      status: "approved",
      isActive: true,
    })
      .select("_id fullName email")
      .sort({ fullName: 1 });

    res.json({
      success: true,
      data: affiliateManagers,
    });
  } catch (error) {
    console.error("Error fetching affiliate managers:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch affiliate managers",
      error: error.message,
    });
  }
};

/**
 * Fetch CDR calls for the current agent that haven't been declared yet
 * GET /call-declarations/cdr
 */
const fetchCDRCalls = async (req, res) => {
  try {
    const userId = req.user.id;
    const months = parseInt(req.query.months) || 3;

    // Get user's fourDigitCode
    const user = await User.findById(userId).select("fourDigitCode fullName");
    if (!user || !user.fourDigitCode) {
      return res.status(400).json({
        success: false,
        message: "User does not have a four digit code configured",
      });
    }

    // Extract 3-digit code from fourDigitCode
    const agentCode = cdrService.extractAgentCode(user.fourDigitCode);

    // Fetch calls from CDR API
    const allCalls = await cdrService.fetchCDRCalls(agentCode, months);

    // Filter to only long calls (>= 15 minutes)
    const longCalls = cdrService.filterLongCalls(allCalls);

    // Parse calls to normalized format
    const parsedCalls = longCalls.map(cdrService.parseCallRecord);

    // Get all declared cdrCallIds for this agent
    const declaredCalls = await AgentCallDeclaration.find({
      agent: userId,
      isActive: true,
    }).select("cdrCallId");

    const declaredCallIds = new Set(declaredCalls.map((d) => d.cdrCallId));

    // Filter out already declared calls
    const undeclaredCalls = parsedCalls.filter(
      (call) => !declaredCallIds.has(call.cdrCallId)
    );

    // Add formatted duration and call types info
    const enrichedCalls = undeclaredCalls.map((call) => ({
      ...call,
      formattedDuration: cdrService.formatDuration(call.callDuration),
    }));

    res.json({
      success: true,
      data: {
        calls: enrichedCalls,
        totalCount: enrichedCalls.length,
        callTypes: cdrService.getCallTypes(),
      },
    });
  } catch (error) {
    console.error("Error fetching CDR calls:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch CDR calls",
      error: error.message,
    });
  }
};

/**
 * Create a new call declaration
 * POST /call-declarations
 */
const createDeclaration = async (req, res) => {
  try {
    const userId = req.user.id;
    const { cdrCallId, callDate, callDuration, sourceNumber, destinationNumber, callType, description, affiliateManagerId, leadId } = req.body;

    // Validate required fields
    if (!cdrCallId || !callDate || !callDuration || !sourceNumber || !destinationNumber || !callType) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // Validate affiliate manager is provided
    if (!affiliateManagerId) {
      return res.status(400).json({
        success: false,
        message: "Affiliate manager is required",
      });
    }

    // Validate lead is provided
    if (!leadId) {
      return res.status(400).json({
        success: false,
        message: "Lead is required",
      });
    }

    // Validate call duration
    if (callDuration < cdrService.MIN_CALL_DURATION) {
      return res.status(400).json({
        success: false,
        message: `Call duration must be at least ${cdrService.MIN_CALL_DURATION} seconds (15 minutes)`,
      });
    }

    // Validate call type
    const validCallTypes = ["deposit", "first_call", "second_call", "third_call", "fourth_call"];
    if (!validCallTypes.includes(callType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid call type",
      });
    }

    // Validate assignee exists and is an affiliate manager
    const assignee = await User.findById(affiliateManagerId);
    if (!assignee) {
      return res.status(400).json({
        success: false,
        message: "Affiliate manager not found",
      });
    }
    if (assignee.role !== "affiliate_manager") {
      return res.status(400).json({
        success: false,
        message: "Selected user must be an affiliate manager",
      });
    }

    // Validate lead exists and is assigned to this agent
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(400).json({
        success: false,
        message: "Lead not found",
      });
    }
    if (!lead.assignedAgent || lead.assignedAgent.toString() !== userId) {
      return res.status(400).json({
        success: false,
        message: "This lead is not assigned to you",
      });
    }

    // Check if already declared
    const existing = await AgentCallDeclaration.findOne({
      cdrCallId,
      isActive: true,
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "This call has already been declared",
      });
    }

    // Calculate bonuses
    const { baseBonus, hourlyBonus, totalBonus } = cdrService.calculateBonus(callType, callDuration);

    // Determine declaration month/year from call date
    const callDateObj = new Date(callDate);
    const declarationMonth = callDateObj.getMonth() + 1;
    const declarationYear = callDateObj.getFullYear();

    // Create declaration
    const declaration = await AgentCallDeclaration.create({
      agent: userId,
      cdrCallId,
      callDate: callDateObj,
      callDuration,
      sourceNumber,
      destinationNumber,
      callType,
      description: description?.trim() || "",
      baseBonus,
      hourlyBonus,
      totalBonus,
      status: "pending",
      declarationMonth,
      declarationYear,
      affiliateManager: affiliateManagerId,
      lead: leadId,
    });

    // Populate for response
    await declaration.populate("agent", "fullName email fourDigitCode");
    await declaration.populate("affiliateManager", "fullName email");
    await declaration.populate("lead", "firstName lastName newEmail newPhone");

    res.status(201).json({
      success: true,
      message: "Call declaration submitted successfully. Awaiting manager approval.",
      data: declaration,
    });
  } catch (error) {
    console.error("Error creating call declaration:", error);

    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "This call has already been declared",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to create call declaration",
      error: error.message,
    });
  }
};

/**
 * Get declarations with filters
 * GET /call-declarations
 */
const getDeclarations = async (req, res) => {
  try {
    const { agentId, status, month, year } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;

    const query = { isActive: true };

    // If agent, only show their own declarations
    if (userRole === "agent") {
      query.agent = userId;
    } else if (userRole === "affiliate_manager") {
      // Affiliate managers only see declarations assigned to them
      query.affiliateManager = userId;
      if (agentId) {
        query.agent = agentId;
      }
    } else if (agentId) {
      // Admins can filter by agent
      query.agent = agentId;
    }

    if (status) {
      query.status = status;
    }

    if (year) {
      query.declarationYear = parseInt(year);
    }

    if (month) {
      query.declarationMonth = parseInt(month);
    }

    const declarations = await AgentCallDeclaration.find(query)
      .populate("agent", "fullName email fourDigitCode")
      .populate("reviewedBy", "fullName email")
      .populate("affiliateManager", "fullName email")
      .populate("lead", "firstName lastName newEmail newPhone")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: declarations,
    });
  } catch (error) {
    console.error("Error fetching declarations:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch declarations",
      error: error.message,
    });
  }
};

/**
 * Get pending declarations for approval
 * GET /call-declarations/pending
 * For affiliate_manager or agent: returns only declarations assigned to them
 * For admin: returns all pending declarations
 */
const getPendingDeclarations = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    // If affiliate manager or agent, only show declarations assigned to them
    const assigneeId = (userRole === "affiliate_manager" || userRole === "agent") ? userId : null;
    const declarations = await AgentCallDeclaration.getPendingDeclarations(assigneeId);

    res.json({
      success: true,
      data: declarations,
    });
  } catch (error) {
    console.error("Error fetching pending declarations:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pending declarations",
      error: error.message,
    });
  }
};

/**
 * Get declarations for a specific agent
 * GET /call-declarations/agent/:id
 */
const getAgentDeclarations = async (req, res) => {
  try {
    const { id: agentId } = req.params;
    const { status, month, year } = req.query;

    const declarations = await AgentCallDeclaration.getAgentDeclarations(
      agentId,
      year ? parseInt(year) : null,
      month ? parseInt(month) : null,
      status
    );

    res.json({
      success: true,
      data: declarations,
    });
  } catch (error) {
    console.error("Error fetching agent declarations:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch agent declarations",
      error: error.message,
    });
  }
};

/**
 * Get monthly totals for an agent (for payroll)
 * GET /call-declarations/agent/:id/monthly
 */
const getMonthlyTotals = async (req, res) => {
  try {
    const { id: agentId } = req.params;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;

    // Validate month
    if (month < 1 || month > 12) {
      return res.status(400).json({
        success: false,
        message: "Invalid month (must be 1-12)",
      });
    }

    // Get totals
    const totalsResult = await AgentCallDeclaration.getMonthlyTotals(agentId, year, month);
    const totals = totalsResult.length > 0 ? totalsResult[0] : {
      totalBaseBonus: 0,
      totalHourlyBonus: 0,
      totalBonus: 0,
      declarationCount: 0,
      totalDuration: 0,
    };

    // Get call type breakdown
    const callTypeSummary = await AgentCallDeclaration.getCallTypeSummary(agentId, year, month);

    // Get approved declarations
    const declarations = await AgentCallDeclaration.getApprovedMonthlyDeclarations(agentId, year, month);

    res.json({
      success: true,
      data: {
        agentId,
        year,
        month,
        totals,
        callTypeSummary,
        declarations,
      },
    });
  } catch (error) {
    console.error("Error fetching monthly totals:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch monthly totals",
      error: error.message,
    });
  }
};

/**
 * Approve a declaration
 * PATCH /call-declarations/:id/approve
 */
const approveDeclaration = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const reviewerId = req.user.id;
    const userRole = req.user.role;

    const declaration = await AgentCallDeclaration.findById(id);

    if (!declaration) {
      return res.status(404).json({
        success: false,
        message: "Declaration not found",
      });
    }

    if (!declaration.isActive) {
      return res.status(400).json({
        success: false,
        message: "Declaration has been deleted",
      });
    }

    // Affiliate managers can only approve declarations assigned to them
    if (userRole === "affiliate_manager" && declaration.affiliateManager.toString() !== reviewerId) {
      return res.status(403).json({
        success: false,
        message: "You can only approve declarations assigned to you",
      });
    }

    if (declaration.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Declaration is already ${declaration.status}`,
      });
    }

    await declaration.approve(reviewerId, notes);

    // Populate for response
    await declaration.populate("agent", "fullName email fourDigitCode");
    await declaration.populate("reviewedBy", "fullName email");
    await declaration.populate("affiliateManager", "fullName email");
    await declaration.populate("lead", "firstName lastName newEmail newPhone");

    res.json({
      success: true,
      message: "Declaration approved successfully",
      data: declaration,
    });
  } catch (error) {
    console.error("Error approving declaration:", error);
    res.status(500).json({
      success: false,
      message: "Failed to approve declaration",
      error: error.message,
    });
  }
};

/**
 * Reject a declaration
 * PATCH /call-declarations/:id/reject
 */
const rejectDeclaration = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const reviewerId = req.user.id;
    const userRole = req.user.role;

    if (!notes || notes.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Rejection notes are required",
      });
    }

    const declaration = await AgentCallDeclaration.findById(id);

    if (!declaration) {
      return res.status(404).json({
        success: false,
        message: "Declaration not found",
      });
    }

    if (!declaration.isActive) {
      return res.status(400).json({
        success: false,
        message: "Declaration has been deleted",
      });
    }

    // Affiliate managers can only reject declarations assigned to them
    if (userRole === "affiliate_manager" && declaration.affiliateManager.toString() !== reviewerId) {
      return res.status(403).json({
        success: false,
        message: "You can only reject declarations assigned to you",
      });
    }

    if (declaration.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Declaration is already ${declaration.status}`,
      });
    }

    await declaration.reject(reviewerId, notes);

    // Populate for response
    await declaration.populate("agent", "fullName email fourDigitCode");
    await declaration.populate("reviewedBy", "fullName email");
    await declaration.populate("affiliateManager", "fullName email");
    await declaration.populate("lead", "firstName lastName newEmail newPhone");

    res.json({
      success: true,
      message: "Declaration rejected",
      data: declaration,
    });
  } catch (error) {
    console.error("Error rejecting declaration:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reject declaration",
      error: error.message,
    });
  }
};

/**
 * Delete (soft delete) a declaration
 * DELETE /call-declarations/:id
 */
const deleteDeclaration = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const declaration = await AgentCallDeclaration.findById(id);

    if (!declaration) {
      return res.status(404).json({
        success: false,
        message: "Declaration not found",
      });
    }

    // Agents can only delete their own pending declarations
    if (userRole === "agent") {
      if (declaration.agent.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: "You can only delete your own declarations",
        });
      }

      if (declaration.status !== "pending") {
        return res.status(400).json({
          success: false,
          message: "You can only delete pending declarations",
        });
      }
    }

    // Soft delete
    declaration.isActive = false;
    await declaration.save();

    res.json({
      success: true,
      message: "Declaration deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting declaration:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete declaration",
      error: error.message,
    });
  }
};

/**
 * Get call types with bonus info (public endpoint)
 * GET /call-declarations/call-types
 */
const getCallTypes = async (req, res) => {
  try {
    res.json({
      success: true,
      data: cdrService.getCallTypes(),
    });
  } catch (error) {
    console.error("Error fetching call types:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch call types",
      error: error.message,
    });
  }
};

/**
 * Calculate bonus preview for a call
 * POST /call-declarations/preview-bonus
 */
const previewBonus = async (req, res) => {
  try {
    const { callType, callDuration } = req.body;

    if (!callType || !callDuration) {
      return res.status(400).json({
        success: false,
        message: "Call type and duration are required",
      });
    }

    const bonus = cdrService.calculateBonus(callType, parseInt(callDuration));

    res.json({
      success: true,
      data: {
        ...bonus,
        callTypeDisplay: cdrService.getCallTypeDisplayName(callType),
        formattedDuration: cdrService.formatDuration(parseInt(callDuration)),
      },
    });
  } catch (error) {
    console.error("Error calculating bonus preview:", error);
    res.status(500).json({
      success: false,
      message: "Failed to calculate bonus preview",
      error: error.message,
    });
  }
};

module.exports = {
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
  getAffiliateManagers,
};
