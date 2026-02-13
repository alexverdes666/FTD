const AgentCallDeclaration = require("../models/AgentCallDeclaration");
const User = require("../models/User");
const Lead = require("../models/Lead");
const DepositCall = require("../models/DepositCall");
const axios = require("axios");
const cdrService = require("../services/cdrService");
const AffiliateManagerTable = require("../models/AffiliateManagerTable");

/**
 * Find a DepositCall record for a lead, matching by leadId first, then by email fallback.
 * Phone formats can differ between orders and leads (e.g. "+34 617243543" vs "34617243543"),
 * so email is used as the reliable fallback identifier.
 * @param {string} leadId - Lead ObjectId
 * @param {Object} extraQuery - Additional query filters (e.g. { depositConfirmed: true })
 * @returns {Object|null} - DepositCall document or null
 */
const findDepositCallForLead = async (leadId, extraQuery = {}) => {
  // Try exact leadId match first
  let depositCall = await DepositCall.findOne({ leadId, ...extraQuery });
  if (depositCall) return depositCall;

  // Fallback: match by email
  const lead = await Lead.findById(leadId).select("newEmail");
  if (lead && lead.newEmail) {
    depositCall = await DepositCall.findOne({
      ftdEmail: lead.newEmail,
      ...extraQuery,
    });
  }

  return depositCall;
};

// Map call types to call slot numbers on DepositCall model
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

// Map call types to affiliate manager table row IDs
const CALL_TYPE_TO_TABLE_ROW = {
  deposit: "deposit_calls",
  first_call: "first_am_call",
  second_call: "second_am_call",
  third_call: "third_am_call",
  fourth_call: "fourth_am_call",
  fifth_call: "fifth_am_call",
  sixth_call: "sixth_am_call",
  seventh_call: "seventh_am_call",
  eighth_call: "eighth_am_call",
  ninth_call: "ninth_am_call",
  tenth_call: "tenth_am_call",
};

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

    // Get all declarations for this agent (to attach status to each call)
    const declaredCalls = await AgentCallDeclaration.find({
      agent: userId,
      isActive: true,
    }).select("cdrCallId status");

    const declarationMap = new Map();
    for (const d of declaredCalls) {
      declarationMap.set(d.cdrCallId, d.status);
    }

    // Enrich all calls with declaration status and formatted duration
    const enrichedCalls = parsedCalls.map((call) => {
      const declarationStatus = declarationMap.get(call.cdrCallId) || null;
      return {
        ...call,
        formattedDuration: cdrService.formatDuration(call.callDuration),
        declarationStatus, // null = undeclared, 'pending', 'approved', 'rejected'
      };
    });

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
    const { cdrCallId, callDate, callDuration, sourceNumber, destinationNumber, lineNumber, callType, callCategory, description, affiliateManagerId, leadId, orderId, recordFile } = req.body;

    // Validate required fields
    if (!cdrCallId || !callDate || !callDuration || !sourceNumber || !destinationNumber) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // Validate call category
    const validCallCategories = ["ftd", "filler"];
    if (!callCategory || !validCallCategories.includes(callCategory)) {
      return res.status(400).json({
        success: false,
        message: "Call category is required (ftd or filler)",
      });
    }

    // Validate call type (required only for FTD calls)
    if (callCategory === "ftd") {
      const validCallTypes = ["deposit", "first_call", "second_call", "third_call", "fourth_call", "fifth_call", "sixth_call", "seventh_call", "eighth_call", "ninth_call", "tenth_call"];
      if (!callType || !validCallTypes.includes(callType)) {
        return res.status(400).json({
          success: false,
          message: "Valid call type is required for FTD calls",
        });
      }
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

    // Prevent duplicate call type per lead+order (check approved or pending declarations)
    // When orderId is provided, scope the check to that order so the same lead
    // can have separate declarations for different orders.
    if (callCategory === "ftd" && callType) {
      const duplicateQuery = {
        lead: leadId,
        callType,
        status: { $in: ["approved", "pending"] },
        isActive: true,
      };
      if (orderId) {
        duplicateQuery.orderId = orderId;
      }

      const duplicateDeclaration = await AgentCallDeclaration.findOne(duplicateQuery);

      if (duplicateDeclaration) {
        const statusText = duplicateDeclaration.status === "approved" ? "already approved" : "already pending approval";
        return res.status(400).json({
          success: false,
          message: `This call type is ${statusText} for this lead${orderId ? " on this order" : ""}`,
        });
      }

      // For "deposit" type, also check if lead has a confirmed deposit in DepositCall
      if (callType === "deposit") {
        const depositQuery = { depositConfirmed: true };
        if (orderId) {
          depositQuery.orderId = orderId;
        }
        const depositCall = orderId
          ? await DepositCall.findOne({ leadId, ...depositQuery })
          : await findDepositCallForLead(leadId, depositQuery);

        if (depositCall) {
          return res.status(400).json({
            success: false,
            message: "Deposit has already been confirmed for this lead",
          });
        }
      }
    }

    // Calculate bonuses
    let bonusData;
    if (callCategory === "filler") {
      bonusData = { baseBonus: 0, hourlyBonus: 0, totalBonus: 0 };
    } else {
      bonusData = cdrService.calculateBonus(callType, callDuration);
    }
    const { baseBonus, hourlyBonus, totalBonus } = bonusData;

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
      lineNumber: lineNumber || "",
      callCategory,
      callType: callCategory === "ftd" ? callType : undefined,
      description: description?.trim() || "",
      baseBonus,
      hourlyBonus,
      totalBonus,
      status: "pending",
      declarationMonth,
      declarationYear,
      affiliateManager: affiliateManagerId,
      lead: leadId,
      orderId: orderId || null,
      recordFile: recordFile || "",
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

    // Add expense to affiliate manager's table
    try {
      await addCallExpenseToAffiliateManager(declaration);
    } catch (expenseError) {
      console.error("Error adding expense to affiliate manager table:", expenseError);
      // Don't fail the approval if expense tracking fails, just log it
    }

    // Update corresponding DepositCall record (link declaration to deposit calls table)
    try {
      await updateDepositCallOnApproval(declaration, reviewerId);
    } catch (depositCallError) {
      console.error("Error updating deposit call record:", depositCallError);
      // Don't fail the approval if deposit call update fails, just log it
    }

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
 * Add call bonus as expense to affiliate manager's table
 * This is called when a call declaration is approved
 */
const addCallExpenseToAffiliateManager = async (declaration) => {
  const { affiliateManager, callType, callCategory, totalBonus, declarationMonth, declarationYear } = declaration;

  // Skip filler calls - they have $0 bonus, no expense to track
  if (callCategory === "filler" || totalBonus === 0) {
    return;
  }

  // Get the row ID for this call type
  const rowId = CALL_TYPE_TO_TABLE_ROW[callType];
  if (!rowId) {
    console.warn(`Unknown call type for expense tracking: ${callType}`);
    return;
  }

  // Create date for the declaration month/year
  const tableDate = new Date(declarationYear, declarationMonth - 1, 1);

  // Get or create the affiliate manager's table for this period
  const table = await AffiliateManagerTable.getOrCreateTable(
    affiliateManager,
    "monthly",
    tableDate,
    { month: declarationMonth, year: declarationYear }
  );

  // Find the row for this call type
  const rowIndex = table.tableData.findIndex((row) => row.id === rowId);
  if (rowIndex === -1) {
    console.warn(`Row ${rowId} not found in affiliate manager table`);
    return;
  }

  // Update the row: add the bonus to the value
  // The value represents the cumulative total bonus for this call type
  // We keep quantity at 1 so that totalExpense = value * 1 = value (the accumulated bonus)
  table.tableData[rowIndex].value = (table.tableData[rowIndex].value || 0) + totalBonus;

  // Save the updated table
  await table.save();

  console.log(
    `Added expense for ${callType} ($${totalBonus}) to affiliate manager ${affiliateManager} for ${declarationMonth}/${declarationYear}`
  );
};

/**
 * Update DepositCall record when a call declaration is approved
 * Maps the declaration's callType to the corresponding call slot on the DepositCall
 */
const updateDepositCallOnApproval = async (declaration, reviewerId) => {
  const { lead, callType, callCategory } = declaration;

  // Skip filler calls and deposit type (deposit confirmation is handled via Orders page)
  if (callCategory === "filler" || callType === "deposit") {
    return;
  }

  const callNumber = CALL_TYPE_TO_CALL_NUMBER[callType];
  if (!callNumber) {
    console.warn(`Unknown call type for deposit call update: ${callType}`);
    return;
  }

  // A lead can appear in multiple orders, each with its own DepositCall record.
  // The call is made to the person (lead), so all confirmed DepositCall records
  // for this lead should reflect the approved call.
  const leadDoc = await Lead.findById(lead).select("newEmail");

  // Find all DepositCall records for this lead (by leadId, then also by email)
  let depositCalls = await DepositCall.find({ leadId: lead, depositConfirmed: true });

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
    console.log(`No confirmed DepositCall records found for lead ${lead}, skipping deposit call update`);
    return;
  }

  const callField = `call${callNumber}`;

  for (const depositCall of depositCalls) {
    if (depositCall[callField].status === "completed") {
      continue;
    }
    depositCall[callField].status = "completed";
    depositCall[callField].doneDate = new Date();
    depositCall[callField].approvedBy = reviewerId;
    depositCall[callField].approvedAt = new Date();
    await depositCall.save();
    console.log(
      `Updated DepositCall ${depositCall._id} call${callNumber} to completed for lead ${lead}`
    );
  }
};

/**
 * Get disabled call types for a lead
 * GET /call-declarations/lead-disabled-types/:leadId?orderId=XXX
 * Returns call types that should be disabled in the declaration dropdown.
 * When orderId is provided, only considers declarations for that specific order,
 * allowing the same call type to be declared for different orders.
 */
const getDisabledCallTypes = async (req, res) => {
  try {
    const { leadId } = req.params;
    const { orderId } = req.query;

    if (!leadId) {
      return res.status(400).json({
        success: false,
        message: "Lead ID is required",
      });
    }

    const disabledCallTypes = [];

    // Check if lead has a confirmed deposit in DepositCall for this specific order
    if (orderId) {
      const depositCall = await DepositCall.findOne({
        leadId,
        orderId,
        depositConfirmed: true,
      });
      if (depositCall) {
        disabledCallTypes.push("deposit");
      }
    } else {
      const depositCall = await findDepositCallForLead(leadId, { depositConfirmed: true });
      if (depositCall) {
        disabledCallTypes.push("deposit");
      }
    }

    // Check for approved or pending declarations for this lead (scoped by order if provided)
    const declarationQuery = {
      lead: leadId,
      status: { $in: ["approved", "pending"] },
      isActive: true,
      callCategory: "ftd",
    };
    if (orderId) {
      declarationQuery.orderId = orderId;
    }

    const existingDeclarations = await AgentCallDeclaration.find(declarationQuery)
      .select("callType status");

    for (const decl of existingDeclarations) {
      if (decl.callType && !disabledCallTypes.includes(decl.callType)) {
        disabledCallTypes.push(decl.callType);
      }
    }

    res.json({
      success: true,
      data: { disabledCallTypes },
    });
  } catch (error) {
    console.error("Error fetching disabled call types:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch disabled call types",
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

/**
 * Get monthly totals for ALL agents from approved declarations
 * GET /call-declarations/all-agents-monthly?year=YYYY&month=MM
 * Admin only
 */
const getAllAgentsMonthlyTotals = async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;

    if (month < 1 || month > 12) {
      return res.status(400).json({
        success: false,
        message: "Invalid month (must be 1-12)",
      });
    }

    const results = await AgentCallDeclaration.aggregate([
      {
        $match: {
          declarationYear: year,
          declarationMonth: month,
          status: "approved",
          isActive: true,
        },
      },
      {
        $group: {
          _id: { agent: "$agent", callType: "$callType" },
          count: { $sum: 1 },
          totalBonus: { $sum: "$totalBonus" },
          totalDuration: { $sum: "$callDuration" },
          totalBaseBonus: { $sum: "$baseBonus" },
          totalHourlyBonus: { $sum: "$hourlyBonus" },
        },
      },
      {
        $group: {
          _id: "$_id.agent",
          totalBaseBonus: { $sum: "$totalBaseBonus" },
          totalHourlyBonus: { $sum: "$totalHourlyBonus" },
          totalBonus: { $sum: "$totalBonus" },
          declarationCount: { $sum: "$count" },
          totalDuration: { $sum: "$totalDuration" },
          callTypeSummary: {
            $push: {
              _id: "$_id.callType",
              count: "$count",
              totalBonus: "$totalBonus",
              totalDuration: "$totalDuration",
            },
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "agentInfo",
        },
      },
      { $unwind: "$agentInfo" },
      {
        $project: {
          agentId: "$_id",
          agentName: "$agentInfo.fullName",
          totalBaseBonus: 1,
          totalHourlyBonus: 1,
          totalBonus: 1,
          declarationCount: 1,
          totalDuration: 1,
          callTypeSummary: 1,
        },
      },
    ]);

    res.json({
      success: true,
      data: results,
      period: { year, month },
    });
  } catch (error) {
    console.error("Error fetching all agents monthly totals:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch all agents monthly totals",
      error: error.message,
    });
  }
};

/**
 * Find leads by phone number (for auto-filling in declaration dialog)
 * GET /call-declarations/lead-by-phone?phone=XXXX&email=YYYY
 * Returns ALL matching leads assigned to the requesting agent (by phone).
 * A lead can appear in multiple orders, so returning all matches lets the
 * agent pick which order's lead to declare for.
 */
const findLeadByPhone = async (req, res) => {
  try {
    const userId = req.user.id;
    const { phone, email } = req.query;

    if ((!phone || phone.trim().length < 4) && !email) {
      return res.status(400).json({
        success: false,
        message: "Phone number or email is required",
      });
    }

    const selectFields = "_id firstName lastName newEmail newPhone orderId";
    let leads = [];

    // 1. Try phone matching first (returns ALL matches)
    if (phone && phone.trim().length >= 4) {
      const cleanPhone = phone.replace(/[\s\-\(\)\+]/g, "");

      // 1a. Exact match on newPhone (try with and without leading +)
      leads = await Lead.find({
        newPhone: { $in: [cleanPhone, `+${cleanPhone}`, phone.trim()] },
        assignedAgent: userId,
      }).select(selectFields).populate("orderId", "createdAt");

      // 1b. If not found, try suffix-based matching (last 10 digits)
      if (leads.length === 0 && cleanPhone.length >= 7) {
        const suffix = cleanPhone.slice(-10);
        leads = await Lead.find({
          newPhone: { $regex: suffix + "$" },
          assignedAgent: userId,
        }).select(selectFields).populate("orderId", "createdAt");
      }
    }

    // 2. If phone didn't match, try email
    if (leads.length === 0 && email && email.trim()) {
      leads = await Lead.find({
        newEmail: email.trim(),
        assignedAgent: userId,
      }).select(selectFields).populate("orderId", "createdAt");
    }

    if (leads.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: "No matching lead found",
      });
    }

    // Return single lead for backward compatibility, or array if multiple
    res.json({
      success: true,
      data: leads.length === 1 ? leads[0] : leads,
      multiple: leads.length > 1,
    });
  } catch (error) {
    console.error("Error finding lead by phone/email:", error);
    res.status(500).json({
      success: false,
      message: "Failed to find lead",
      error: error.message,
    });
  }
};

/**
 * Proxy call recording to avoid mixed content (HTTP audio on HTTPS page)
 * GET /call-declarations/recording/:filename
 */
const streamRecording = async (req, res) => {
  try {
    const { filename } = req.params;

    if (!filename || !/^[\w\-\+\.]+$/.test(filename)) {
      return res.status(400).json({
        success: false,
        message: "Invalid filename",
      });
    }

    const recordingUrl = `http://188.126.10.151:6680/rec/${filename}.mp3`;

    const response = await axios.get(recordingUrl, {
      responseType: "arraybuffer",
      timeout: 60000,
    });

    const buffer = Buffer.from(response.data);

    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": buffer.length,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=86400",
    });

    res.send(buffer);
  } catch (error) {
    console.error("Error fetching recording:", {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      url: `http://188.126.10.151:6680/rec/${req.params.filename}.mp3`,
    });
    if (error.response && error.response.status === 404) {
      return res.status(404).json({
        success: false,
        message: "Recording not found",
      });
    }
    res.status(500).json({
      success: false,
      message: "Failed to fetch recording",
      error: error.message,
      code: error.code,
    });
  }
};

/**
 * Get confirmed deposit orders for a lead
 * GET /call-declarations/lead-orders/:leadId
 * Returns all orders where this lead has a confirmed deposit (from DepositCall records).
 * Used by the frontend to let the agent pick which order to declare a call for.
 */
const getLeadOrders = async (req, res) => {
  try {
    const { leadId } = req.params;

    if (!leadId) {
      return res.status(400).json({
        success: false,
        message: "Lead ID is required",
      });
    }

    // Find all DepositCall records for this lead with confirmed deposits
    const depositCalls = await DepositCall.find({
      leadId,
      depositConfirmed: true,
    })
      .select("orderId ftdEmail ftdName createdAt")
      .populate("orderId", "createdAt")
      .sort({ createdAt: -1 });

    // Also check by email fallback
    const leadDoc = await Lead.findById(leadId).select("newEmail");
    let emailMatches = [];
    if (leadDoc?.newEmail) {
      emailMatches = await DepositCall.find({
        ftdEmail: leadDoc.newEmail,
        depositConfirmed: true,
        _id: { $nin: depositCalls.map((dc) => dc._id) },
      })
        .select("orderId ftdEmail ftdName createdAt")
        .populate("orderId", "createdAt")
        .sort({ createdAt: -1 });
    }

    const allDepositCalls = depositCalls.concat(emailMatches);

    const orders = allDepositCalls.map((dc) => ({
      orderId: dc.orderId?._id || dc.orderId,
      orderCreatedAt: dc.orderId?.createdAt || dc.createdAt,
      depositCallId: dc._id,
    }));

    res.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error("Error fetching lead orders:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch lead orders",
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
  getAllAgentsMonthlyTotals,
  approveDeclaration,
  rejectDeclaration,
  deleteDeclaration,
  getCallTypes,
  previewBonus,
  getAffiliateManagers,
  findLeadByPhone,
  streamRecording,
  getDisabledCallTypes,
  getLeadOrders,
};
