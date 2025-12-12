const RefundAssignment = require("../models/RefundAssignment");
const Order = require("../models/Order");
const Lead = require("../models/Lead");
const User = require("../models/User");
const { validationResult } = require("express-validator");
const csvParser = require("csv-parser");
const { Readable } = require("stream");

// Helper function to check if user has refunds access
const hasRefundsAccess = (user) => {
  return (
    user.role === "admin" ||
    user.role === "refunds_manager" ||
    (user.role === "affiliate_manager" && user.permissions?.canManageRefunds)
  );
};

// Helper function to extract email from assignment
const getAssignmentEmail = (assignment) => {
  if (assignment.source === "csv") {
    return assignment.email?.toLowerCase() || null;
  } else {
    // For order-based assignments, get email from leadId
    const email = assignment.leadId?.newEmail || assignment.leadId?.oldEmail;
    return email?.toLowerCase() || null;
  }
};

// Helper function to extract lead name from assignment
const getAssignmentName = (assignment) => {
  if (assignment.source === "csv") {
    return (
      `${assignment.firstName || ""} ${assignment.lastName || ""}`.trim() ||
      "N/A"
    );
  } else {
    return (
      `${assignment.leadId?.firstName || ""} ${
        assignment.leadId?.lastName || ""
      }`.trim() || "N/A"
    );
  }
};

// Helper function to group assignments by email
const groupAssignmentsByEmail = (assignments) => {
  const groupMap = new Map();

  // Group assignments by email
  assignments.forEach((assignment) => {
    const email = getAssignmentEmail(assignment);

    // Skip assignments without email
    if (!email) {
      return;
    }

    if (!groupMap.has(email)) {
      groupMap.set(email, {
        groupKey: email,
        email: email,
        leadName: getAssignmentName(assignment),
        assignments: [],
        refundCount: 0,
        latestAssignedAt: assignment.assignedAt || assignment.createdAt,
        statuses: new Set(),
      });
    }

    const group = groupMap.get(email);
    group.assignments.push(assignment);
    group.refundCount++;
    group.statuses.add(assignment.status);

    // Update latest assigned date if this assignment is more recent
    const assignedDate = new Date(
      assignment.assignedAt || assignment.createdAt
    );
    const currentLatest = new Date(group.latestAssignedAt);
    if (assignedDate > currentLatest) {
      group.latestAssignedAt = assignment.assignedAt || assignment.createdAt;
      // Update lead name to the most recent assignment's name
      group.leadName = getAssignmentName(assignment);
    }
  });

  // Convert Map to array and format statuses
  const groups = Array.from(groupMap.values()).map((group) => ({
    ...group,
    statuses: Array.from(group.statuses),
  }));

  // Find the most recent update time for each group (considering both assignedAt and updatedAt)
  const groupsWithLatestActivity = groups.map((group) => {
    const latestActivity = group.assignments.reduce((latest, assignment) => {
      const assignedAt = new Date(
        assignment.assignedAt || assignment.createdAt
      );
      const updatedAt = new Date(assignment.updatedAt || assignment.createdAt);
      const mostRecent = updatedAt > assignedAt ? updatedAt : assignedAt;
      return mostRecent > latest ? mostRecent : latest;
    }, new Date(0));

    return {
      ...group,
      latestActivity,
    };
  });

  // Sort groups by latest activity (most recently updated/assigned first)
  groupsWithLatestActivity.sort(
    (a, b) => new Date(b.latestActivity) - new Date(a.latestActivity)
  );

  return groupsWithLatestActivity;
};

// Get all refund assignments for the refunds manager
exports.getRefundAssignments = async (req, res, next) => {
  try {
    const {
      status,
      page = 1,
      limit = 20,
      startDate,
      endDate,
      search,
    } = req.query;
    const userId = req.user._id;

    // Ensure user has refunds access
    if (!hasRefundsAccess(req.user)) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. You don't have permission to view refund assignments.",
      });
    }

    // For refunds managers, only show their assignments; for admins and affiliate managers with permission, show all
    const query = {};
    if (req.user.role === "refunds_manager") {
      query.refundsManager = userId;
    }

    // NOTE: Status filtering is now handled AFTER grouping, not in the query
    // This is because we want to show groups that contain ANY assignment with the selected status

    // Add date filters for CSV refunds
    if (startDate || endDate) {
      query.$or = [
        // For CSV refunds, filter by the date field
        {
          source: "csv",
          date: {
            ...(startDate && { $gte: new Date(startDate) }),
            ...(endDate && { $lte: new Date(endDate + "T23:59:59.999Z") }),
          },
        },
        // For order-based refunds, filter by assignedAt (if no date filters, include all)
        ...(startDate || endDate
          ? [
              {
                source: "order",
                assignedAt: {
                  ...(startDate && { $gte: new Date(startDate) }),
                  ...(endDate && {
                    $lte: new Date(endDate + "T23:59:59.999Z"),
                  }),
                },
              },
            ]
          : []),
      ];
    }

    let assignments;

    // If we have a search term, we need to handle leadId search differently
    // because we can't directly search populated fields in the main query
    if (search && search.trim()) {
      // Use aggregation pipeline to handle search across both CSV and order-based assignments
      const pipeline = [
        // Match the basic query
        { $match: query },

        // Lookup the leadId data
        {
          $lookup: {
            from: "leads",
            localField: "leadId",
            foreignField: "_id",
            as: "leadData",
          },
        },

        // Add a field that contains searchable text for both CSV and order-based assignments
        {
          $addFields: {
            searchableText: {
              $concat: [
                { $ifNull: ["$firstName", ""] },
                " ",
                { $ifNull: ["$lastName", ""] },
                " ",
                { $ifNull: ["$email", ""] },
                " ",
                { $ifNull: ["$bank", ""] },
                " ",
                { $ifNull: [{ $arrayElemAt: ["$leadData.firstName", 0] }, ""] },
                " ",
                { $ifNull: [{ $arrayElemAt: ["$leadData.lastName", 0] }, ""] },
                " ",
                { $ifNull: [{ $arrayElemAt: ["$leadData.newEmail", 0] }, ""] },
                " ",
                { $ifNull: [{ $arrayElemAt: ["$leadData.oldEmail", 0] }, ""] },
                " ",
                { $ifNull: [{ $arrayElemAt: ["$leadData.newPhone", 0] }, ""] },
                " ",
                { $ifNull: [{ $arrayElemAt: ["$leadData.oldPhone", 0] }, ""] },
              ],
            },
          },
        },

        // Filter by search term (case insensitive)
        {
          $match: {
            searchableText: { $regex: search.trim(), $options: "i" },
          },
        },

        // Sort
        { $sort: { assignedAt: -1 } },

        // Clean up the temporary field
        { $unset: ["searchableText", "leadData"] },
      ];

      assignments = await RefundAssignment.aggregate(pipeline);

      // Populate the fields after aggregation
      await RefundAssignment.populate(assignments, [
        {
          path: "orderId",
          select:
            "requester status createdAt fulfilled requests selectedClientNetwork selectedOurNetwork selectedCampaign selectedClientBrokers",
          populate: [
            {
              path: "requester",
              select: "fullName email",
            },
            {
              path: "selectedClientNetwork",
              select: "name",
            },
            {
              path: "selectedOurNetwork",
              select: "name",
            },
            {
              path: "selectedCampaign",
              select: "name",
            },
            {
              path: "selectedClientBrokers",
              select: "name",
            },
          ],
        },
        {
          path: "leadId",
          select:
            "firstName lastName newEmail oldEmail newPhone oldPhone country leadType",
        },
        { path: "assignedBy", select: "fullName email" },
      ]);
    } else {
      // No search term, use regular query
      assignments = await RefundAssignment.find(query)
        .populate({
          path: "orderId",
          select:
            "requester status createdAt fulfilled requests selectedClientNetwork selectedOurNetwork selectedCampaign selectedClientBrokers",
          populate: [
            {
              path: "requester",
              select: "fullName email",
            },
            {
              path: "selectedClientNetwork",
              select: "name",
            },
            {
              path: "selectedOurNetwork",
              select: "name",
            },
            {
              path: "selectedCampaign",
              select: "name",
            },
            {
              path: "selectedClientBrokers",
              select: "name",
            },
          ],
        })
        .populate(
          "leadId",
          "firstName lastName newEmail oldEmail newPhone oldPhone country leadType"
        )
        .populate("assignedBy", "fullName email")
        .sort({ assignedAt: -1 });
    }

    // Group assignments by email
    let groups = groupAssignmentsByEmail(assignments);

    // Apply status filter to groups AFTER grouping
    // Show groups that contain ANY assignment with the selected status
    if (status && status !== "all") {
      groups = groups.filter((group) =>
        group.assignments.some((assignment) => assignment.status === status)
      );
    }

    // Calculate pagination for groups
    const totalGroups = groups.length;
    const skip = (page - 1) * limit;
    const paginatedGroups = groups.slice(skip, skip + parseInt(limit));

    res.json({
      success: true,
      data: {
        groups: paginatedGroups,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(totalGroups / limit),
          count: paginatedGroups.length,
          totalRecords: totalGroups,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get refund assignment statistics
exports.getRefundStats = async (req, res, next) => {
  try {
    const userId = req.user._id;

    if (!hasRefundsAccess(req.user)) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. You don't have permission to view refund statistics.",
      });
    }

    // For refunds managers, only show their stats; for admins and affiliate managers with permission, show all stats
    const matchQuery =
      req.user.role === "refunds_manager" ? { refundsManager: userId } : {};
    const stats = await RefundAssignment.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const statusCounts = {
      new: 0,
      uploaded: 0,
      initial_email: 0,
      threatening_email: 0,
      review_posted: 0,
      review_dispute: 0,
      review_removed: 0,
      refunded_checked: 0,
      refund_complete: 0,
      rejected: 0,
    };

    stats.forEach((stat) => {
      statusCounts[stat._id] = stat.count;
    });

    const totalAssignments = Object.values(statusCounts).reduce(
      (sum, count) => sum + count,
      0
    );

    res.json({
      success: true,
      data: {
        statusCounts,
        totalAssignments,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Update refund assignment status
exports.updateRefundStatus = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const { id } = req.params;
    const { status, notes } = req.body;
    const userId = req.user._id;

    if (!hasRefundsAccess(req.user)) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. You don't have permission to update refund status.",
      });
    }

    // For refunds managers, only allow updating their assignments; for admins and affiliate managers with permission, allow all
    const findQuery = { _id: id };
    if (req.user.role === "refunds_manager") {
      findQuery.refundsManager = userId;
    }
    const assignment = await RefundAssignment.findOne(findQuery);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Refund assignment not found",
      });
    }

    // Set temporary fields for middleware
    assignment.modifiedBy = userId;
    assignment.statusChangeNotes = notes;
    assignment.status = status;
    if (notes) {
      assignment.notes = notes;
    }

    await assignment.save();

    // Populate for response
    await assignment.populate([
      {
        path: "orderId",
        select:
          "requester status createdAt selectedClientNetwork selectedOurNetwork selectedCampaign selectedClientBroker",
        populate: [
          {
            path: "requester",
            select: "fullName email",
          },
          {
            path: "selectedClientNetwork",
            select: "name",
          },
          {
            path: "selectedOurNetwork",
            select: "name",
          },
          {
            path: "selectedCampaign",
            select: "name",
          },
          {
            path: "selectedClientBrokers",
            select: "name",
          },
        ],
      },
      {
        path: "leadId",
        select: "firstName lastName email phone country leadType",
      },
      { path: "assignedBy", select: "fullName email" },
    ]);

    res.json({
      success: true,
      message: "Refund status updated successfully",
      data: assignment,
    });
  } catch (error) {
    next(error);
  }
};

// Assign FTD leads to refunds manager
exports.assignToRefundsManager = async (req, res, next) => {
  try {
    console.log("=== Starting FTD assignment process ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    console.log("User:", {
      id: req.user._id,
      role: req.user.role,
      email: req.user.email,
    });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("Validation errors:", errors.array());
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const { orderId, leadIds, refundsManagerId } = req.body;
    const assignedBy = req.user._id;

    console.log("Extracted data:", {
      orderId,
      leadIds,
      refundsManagerId,
      assignedBy,
    });

    // Check if user has permission to assign leads
    if (
      !["admin", "affiliate_manager", "lead_manager"].includes(req.user.role)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Only managers can assign leads to refunds manager.",
      });
    }

    // Find the order and verify it exists
    console.log("=== Step 1: Finding order ===");
    let order;
    try {
      order = await Order.findById(orderId).populate("leads");
      console.log("Order query completed");
    } catch (error) {
      console.error("Error finding order:", error);
      throw error;
    }

    if (!order) {
      console.log("Order not found:", orderId);
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    console.log("Order found successfully");
    console.log("Order basic info:", {
      orderId: order._id,
      leadsCount: order.leads?.length || 0,
    });

    // Safely log order details
    try {
      console.log("Order fulfilled info:", {
        fulfilled: order.fulfilled || {},
        fulfilledFtd: order.fulfilled?.ftd || 0,
        requests: order.requests || {},
        requestsFtd: order.requests?.ftd || 0,
      });
    } catch (error) {
      console.error("Error logging order details:", error);
      console.log(
        "Raw order object keys:",
        Object.keys(order.toObject ? order.toObject() : order)
      );
    }

    // Find the refunds manager
    console.log("=== Step 2: Finding refunds manager ===");
    let refundsManager;

    if (refundsManagerId) {
      // Use the selected refunds manager
      refundsManager = await User.findOne({
        _id: refundsManagerId,
        role: "refunds_manager",
        isActive: true,
        status: "approved",
      });
      if (!refundsManager) {
        console.log(
          "Selected refunds manager not found or invalid:",
          refundsManagerId
        );
        return res.status(400).json({
          success: false,
          message: "Selected refunds manager not found or invalid.",
        });
      }
    } else {
      // Fallback to the default behavior (first available refunds manager)
      refundsManager = await RefundAssignment.getRefundsManager();
      if (!refundsManager) {
        console.log("No active refunds manager found");
        return res.status(400).json({
          success: false,
          message:
            "No active refunds manager found. Please ensure there is an active user with the refunds_manager role.",
        });
      }
    }

    console.log("Found refunds manager:", {
      id: refundsManager._id,
      name: refundsManager.fullName,
    });

    console.log("=== Step 3: Validating leads ===");
    console.log("Validating leads:", { leadIds, leadIdsCount: leadIds.length });

    let validLeads;
    try {
      validLeads = await Lead.find({
        _id: { $in: leadIds },
        leadType: "ftd",
      });
      console.log("Found valid FTD leads:", {
        count: validLeads.length,
        leads: validLeads.map((l) => ({ id: l._id, type: l.leadType })),
      });
    } catch (error) {
      console.error("Error finding valid leads:", error);
      throw error;
    }

    if (validLeads.length !== leadIds.length) {
      console.log("Mismatch in lead validation:", {
        requested: leadIds.length,
        found: validLeads.length,
      });
      return res.status(400).json({
        success: false,
        message: "Some leads are invalid or not FTD leads",
      });
    }

    console.log("=== Step 4: Checking existing assignments ===");
    // Check if any of these leads are already assigned to a refunds manager from THIS order
    const existingAssignments = await RefundAssignment.find({
      leadId: { $in: leadIds },
      orderId: orderId, // Only check assignments from the current order
    });

    if (existingAssignments.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Some leads are already assigned to refunds manager from this order",
      });
    }

    console.log("=== Step 5: Creating assignments ===");
    const assignments = leadIds.map((leadId) => {
      // Find the corresponding lead to get documents and address
      const lead = validLeads.find(
        (l) => l._id.toString() === leadId.toString()
      );

      return {
        source: "order",
        orderId,
        leadId,
        assignedBy,
        refundsManager: refundsManager._id,
        status: "new",
        documents: lead?.documents || [], // Copy documents from lead
        address: lead?.address || "", // Copy address from lead
      };
    });
    console.log("Assignment data prepared:", assignments);

    console.log("=== Step 6: Inserting assignments ===");
    let createdAssignments;
    try {
      createdAssignments = await RefundAssignment.insertMany(assignments);
      console.log(
        "Assignments inserted successfully:",
        createdAssignments.length
      );
    } catch (error) {
      console.error("Error inserting assignments:", error);
      throw error;
    }

    console.log("=== Step 7: Populating assignments for response ===");
    let populatedAssignments;
    try {
      populatedAssignments = await RefundAssignment.find({
        _id: { $in: createdAssignments.map((a) => a._id) },
      })
        .populate({
          path: "orderId",
          select:
            "requester status createdAt selectedClientNetwork selectedOurNetwork selectedCampaign selectedClientBroker",
          populate: [
            {
              path: "requester",
              select: "fullName email",
            },
            {
              path: "selectedClientNetwork",
              select: "name",
            },
            {
              path: "selectedOurNetwork",
              select: "name",
            },
            {
              path: "selectedCampaign",
              select: "name",
            },
            {
              path: "selectedClientBrokers",
              select: "name",
            },
          ],
        })
        .populate(
          "leadId",
          "firstName lastName newEmail oldEmail newPhone oldPhone country leadType"
        )
        .populate("assignedBy", "fullName email")
        .populate("refundsManager", "fullName email");
      console.log(
        "Assignments populated successfully:",
        populatedAssignments.length
      );
    } catch (error) {
      console.error("Error populating assignments:", error);
      throw error;
    }

    console.log(
      `Successfully assigned ${leadIds.length} FTD leads to refunds manager`
    );

    res.status(201).json({
      success: true,
      message: `${leadIds.length} FTD leads assigned to refunds manager successfully`,
      data: populatedAssignments,
    });
  } catch (error) {
    console.error("Error assigning FTD leads to refunds manager:", error);
    next(error);
  }
};

// Get assignment details
exports.getRefundAssignmentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    let query = { _id: id };

    // If user is refunds manager, only show their assignments; admins and affiliate managers with permission can see all
    if (req.user.role === "refunds_manager") {
      query.refundsManager = userId;
    }

    const assignment = await RefundAssignment.findOne(query)
      .populate({
        path: "orderId",
        select:
          "requester status createdAt fulfilled requests selectedClientNetwork selectedOurNetwork selectedCampaign selectedClientBrokers",
        populate: [
          {
            path: "requester",
            select: "fullName email",
          },
          {
            path: "selectedClientNetwork",
            select: "name",
          },
          {
            path: "selectedOurNetwork",
            select: "name",
          },
          {
            path: "selectedCampaign",
            select: "name",
          },
          {
            path: "selectedClientBrokers",
            select: "name",
          },
        ],
      })
      .populate(
        "leadId",
        "firstName lastName newEmail oldEmail newPhone oldPhone country leadType"
      )
      .populate("assignedBy", "fullName email")
      .populate("refundsManager", "fullName email")
      .populate("statusHistory.changedBy", "fullName email");

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Refund assignment not found",
      });
    }

    res.json({
      success: true,
      data: assignment,
    });
  } catch (error) {
    next(error);
  }
};

// Import CSV refunds
exports.importCSVRefunds = async (req, res, next) => {
  try {
    // Ensure user has refunds access
    if (!hasRefundsAccess(req.user)) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. You don't have permission to import CSV refunds.",
      });
    }

    if (!req.files || !req.files.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a file",
      });
    }

    const file = req.files.file;
    const fileExtension = file.name.split(".").pop().toLowerCase();

    if (fileExtension !== "csv") {
      return res.status(400).json({
        success: false,
        message: "Please upload a CSV file",
      });
    }

    const results = [];
    const stream = Readable.from(file.data.toString());

    await new Promise((resolve, reject) => {
      stream
        .pipe(csvParser())
        .on("data", (data) => results.push(data))
        .on("error", (error) => reject(error))
        .on("end", () => resolve());
    });

    if (results.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No data found in CSV file",
      });
    }

    // Parse and validate CSV data
    const parseDate = (dateString) => {
      if (!dateString) return null;

      // Handle M/D/YYYY format (like "1/8/2025")
      const parts = dateString.split("/");
      if (parts.length === 3) {
        const month = parseInt(parts[0]) - 1; // Month is 0-indexed in JS Date
        const day = parseInt(parts[1]);
        const year = parseInt(parts[2]);
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          return new Date(year, month, day);
        }
      }

      // Fallback to standard date parsing
      const parsed = new Date(dateString);
      return isNaN(parsed.getTime()) ? null : parsed;
    };

    const csvRefunds = [];
    const errors = [];

    // Determine which refunds manager to assign to
    let refundsManager;

    if (req.user.role === "refunds_manager") {
      // If the user importing is a refunds manager, assign to them
      refundsManager = req.user;
    } else {
      // Otherwise (admin or affiliate manager), use the default refunds manager
      refundsManager = await RefundAssignment.getRefundsManager();
      if (!refundsManager) {
        return res.status(400).json({
          success: false,
          message:
            "No active refunds manager found. Please ensure there is an active user with the refunds_manager role.",
        });
      }
    }

    for (let i = 0; i < results.length; i++) {
      const row = results[i];
      const rowIndex = i + 1;

      try {
        // Map CSV columns to our fields (handling the specific CSV format)
        const firstName = row["First Name"]?.trim();
        const lastName = row["Last name"]?.trim();
        const email = row["E-mail"]?.trim();

        // Skip empty rows
        if (!firstName && !lastName && !email) {
          continue;
        }

        // Validate required fields
        if (!firstName || !lastName || !email) {
          errors.push({
            row: rowIndex,
            error: "Missing required fields: First Name, Last name, or E-mail",
            data: row,
          });
          continue;
        }

        const refundData = {
          source: "csv",
          firstName: firstName,
          lastName: lastName,
          email: email.toLowerCase(),

          // Optional fields mapped from CSV columns
          geo: row["GEO"]?.trim() || undefined,
          date: parseDate(row["Date"]),
          lastFourDigitsCard: row["Last 4 Digits Card"]?.trim() || undefined,
          bank: row["Bank"]?.trim() || undefined,
          comment: row["Comment"]?.trim() || undefined,
          psp1: row["PSP"]?.trim() || undefined,
          broker1: row["Broker"]?.trim() || undefined,

          // Management fields
          assignedBy: req.user._id,
          refundsManager: refundsManager._id,
          status: "uploaded",
        };

        csvRefunds.push(refundData);
      } catch (error) {
        errors.push({
          row: rowIndex,
          error: error.message,
          data: row,
        });
      }
    }

    if (csvRefunds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid records found in CSV file",
        errors,
      });
    }

    // Remove duplicates within the CSV file itself (same firstName, lastName, and date)
    const csvKeys = new Set();
    const deduplicatedRefunds = [];
    let csvDuplicatesCount = 0;

    for (const refund of csvRefunds) {
      const key = `${refund.firstName}-${refund.lastName}-${
        refund.date ? refund.date.toISOString().split("T")[0] : "no-date"
      }`;
      if (!csvKeys.has(key)) {
        csvKeys.add(key);
        deduplicatedRefunds.push(refund);
      } else {
        csvDuplicatesCount++;
      }
    }

    // Check for existing duplicates in database based on firstName, lastName, and date combination
    const existingRefunds = await RefundAssignment.find({
      source: "csv",
      $or: deduplicatedRefunds.map((refund) => ({
        firstName: refund.firstName,
        lastName: refund.lastName,
        date: refund.date,
      })),
    });

    // Create a set of existing refund keys for quick lookup (firstName-lastName-date)
    const existingKeys = new Set();
    existingRefunds.forEach((refund) => {
      const key = `${refund.firstName}-${refund.lastName}-${
        refund.date ? refund.date.toISOString().split("T")[0] : "no-date"
      }`;
      existingKeys.add(key);
    });

    // Filter out duplicates (same firstName, lastName, and date)
    const uniqueRefunds = deduplicatedRefunds.filter((refund) => {
      const key = `${refund.firstName}-${refund.lastName}-${
        refund.date ? refund.date.toISOString().split("T")[0] : "no-date"
      }`;
      return !existingKeys.has(key);
    });

    if (uniqueRefunds.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "All records in the CSV file are duplicates (same first name, last name, and date) of existing refunds or within the CSV file itself",
        data: {
          imported: 0,
          duplicatesInCsv: csvDuplicatesCount,
          duplicatesInDatabase:
            deduplicatedRefunds.length - uniqueRefunds.length,
          totalDuplicates: csvRefunds.length,
          errors: errors.length > 0 ? errors : null,
          totalProcessed: results.length,
        },
      });
    }

    // Bulk insert unique CSV refunds
    const insertedRefunds = await RefundAssignment.insertMany(uniqueRefunds, {
      ordered: false,
    });

    const databaseDuplicatesCount =
      deduplicatedRefunds.length - uniqueRefunds.length;
    const totalDuplicatesCount = csvRefunds.length - uniqueRefunds.length;

    let message = `Successfully imported ${insertedRefunds.length} CSV refunds`;
    if (totalDuplicatesCount > 0) {
      message += ` (${totalDuplicatesCount} duplicate records skipped`;
      if (csvDuplicatesCount > 0 && databaseDuplicatesCount > 0) {
        message += `: ${csvDuplicatesCount} within CSV, ${databaseDuplicatesCount} already exist in database)`;
      } else if (csvDuplicatesCount > 0) {
        message += `: ${csvDuplicatesCount} duplicates within CSV file)`;
      } else {
        message += `: ${databaseDuplicatesCount} already exist in database)`;
      }
    }

    res.json({
      success: true,
      message: message,
      data: {
        imported: insertedRefunds.length,
        duplicatesInCsv: csvDuplicatesCount,
        duplicatesInDatabase: databaseDuplicatesCount,
        totalDuplicates: totalDuplicatesCount,
        errors: errors.length > 0 ? errors : null,
        totalProcessed: results.length,
      },
    });
  } catch (error) {
    console.error("CSV import error:", error);
    next(error);
  }
};

// Get all available refunds managers
exports.getRefundsManagers = async (req, res, next) => {
  try {
    // Ensure user has refunds access or is admin/lead_manager/affiliate_manager
    if (
      !hasRefundsAccess(req.user) &&
      !["admin", "affiliate_manager", "lead_manager"].includes(req.user.role)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. You don't have permission to view refunds managers.",
      });
    }

    const refundsManagers = await User.find({
      role: "refunds_manager",
      isActive: true,
      status: "approved",
    }).select("_id fullName email");

    res.json({
      success: true,
      data: refundsManagers,
    });
  } catch (error) {
    next(error);
  }
};

// Get refund assignment status for an order
exports.getOrderRefundAssignmentStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    // Check if user has permission
    if (
      !["admin", "affiliate_manager", "lead_manager"].includes(req.user.role)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Only managers can view refund assignment status.",
      });
    }

    // Find refund assignments for this order
    const assignments = await RefundAssignment.find({
      orderId: orderId,
      source: "order", // Only order-based assignments, not CSV imports
    })
      .populate("refundsManager", "fullName email")
      .populate("leadId", "firstName lastName");

    const isAssigned = assignments.length > 0;

    res.json({
      success: true,
      data: {
        isAssigned,
        assignmentCount: assignments.length,
        assignments: assignments.map((assignment) => ({
          _id: assignment._id,
          leadName: `${assignment.leadId?.firstName || ""} ${
            assignment.leadId?.lastName || ""
          }`.trim(),
          refundsManager: assignment.refundsManager,
          assignedAt: assignment.assignedAt,
          status: assignment.status,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Create manual refund assignment
exports.createManualRefund = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    // Ensure user has refunds access
    if (!hasRefundsAccess(req.user)) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. You don't have permission to create manual refunds.",
      });
    }

    const {
      firstName,
      lastName,
      email,
      geo,
      date,
      lastFourDigitsCard,
      bank,
      comment,
      psp1,
      broker1,
      psp2,
      broker2,
      refundsManagerId,
    } = req.body;

    // Find the refunds manager
    let refundsManager;

    if (refundsManagerId) {
      // Use the selected refunds manager
      refundsManager = await User.findOne({
        _id: refundsManagerId,
        role: "refunds_manager",
        isActive: true,
        status: "approved",
      });
      if (!refundsManager) {
        return res.status(400).json({
          success: false,
          message: "Selected refunds manager not found or invalid.",
        });
      }
    } else {
      // Fallback to the default behavior (first available refunds manager)
      refundsManager = await RefundAssignment.getRefundsManager();
      if (!refundsManager) {
        return res.status(400).json({
          success: false,
          message:
            "No active refunds manager found. Please ensure there is an active user with the refunds_manager role.",
        });
      }
    }

    // Check for existing duplicate based on firstName, lastName, and date combination
    const parseDate = (dateString) => {
      if (!dateString) return null;
      const parsed = new Date(dateString);
      return isNaN(parsed.getTime()) ? null : parsed;
    };

    const parsedDate = parseDate(date);

    if (parsedDate) {
      const existingRefund = await RefundAssignment.findOne({
        source: "csv",
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        date: parsedDate,
      });

      if (existingRefund) {
        return res.status(400).json({
          success: false,
          message:
            "A refund with the same first name, last name, and date already exists.",
        });
      }
    }

    // Create the manual refund assignment
    const refundData = {
      source: "csv",
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      geo: geo?.trim() || undefined,
      date: parsedDate,
      lastFourDigitsCard: lastFourDigitsCard?.trim() || undefined,
      bank: bank?.trim() || undefined,
      comment: comment?.trim() || undefined,
      psp1: psp1?.trim() || undefined,
      broker1: broker1?.trim() || undefined,
      psp2: psp2?.trim() || undefined,
      broker2: broker2?.trim() || undefined,
      assignedBy: req.user._id,
      refundsManager: refundsManager._id,
      status: "uploaded",
    };

    const newRefund = await RefundAssignment.create(refundData);

    // Populate the response
    const populatedRefund = await RefundAssignment.findById(newRefund._id)
      .populate("assignedBy", "fullName email")
      .populate("refundsManager", "fullName email");

    res.status(201).json({
      success: true,
      message: "Manual refund created successfully",
      data: populatedRefund,
    });
  } catch (error) {
    console.error("Manual refund creation error:", error);
    next(error);
  }
};

// Delete refund assignment
exports.deleteRefundAssignment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Ensure user has refunds access
    if (!hasRefundsAccess(req.user)) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. You don't have permission to delete refund assignments.",
      });
    }

    // For refunds managers, only allow deleting their assignments; for admins and affiliate managers with permission, allow all
    const findQuery = { _id: id };
    if (req.user.role === "refunds_manager") {
      findQuery.refundsManager = userId;
    }
    const assignment = await RefundAssignment.findOne(findQuery);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Refund assignment not found",
      });
    }

    await RefundAssignment.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Refund assignment deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Toggle PSP Email status
exports.togglePspEmail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Ensure user has refunds access
    if (!hasRefundsAccess(req.user)) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. You don't have permission to update PSP email status.",
      });
    }

    // For refunds managers, only allow updating their assignments; for admins and affiliate managers with permission, allow all
    const findQuery = { _id: id };
    if (req.user.role === "refunds_manager") {
      findQuery.refundsManager = userId;
    }
    const assignment = await RefundAssignment.findOne(findQuery);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Refund assignment not found",
      });
    }

    // Toggle the PSP email status
    assignment.pspEmailSent = !assignment.pspEmailSent;

    if (assignment.pspEmailSent) {
      // Mark as sent
      assignment.pspEmailSentAt = new Date();
      assignment.pspEmailSentBy = userId;
    } else {
      // Mark as not sent
      assignment.pspEmailSentAt = undefined;
      assignment.pspEmailSentBy = undefined;
    }

    await assignment.save();

    res.json({
      success: true,
      message: `PSP email marked as ${
        assignment.pspEmailSent ? "included" : "not included"
      }`,
      data: {
        pspEmailSent: assignment.pspEmailSent,
        pspEmailSentAt: assignment.pspEmailSentAt,
        pspEmailSentBy: assignment.pspEmailSentBy,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Mark entire group as fraud
exports.markGroupAsFraud = async (req, res, next) => {
  try {
    const { email: rawEmail, fraudReason } = req.body;
    const userId = req.user._id;

    // Ensure user has refunds access
    if (!hasRefundsAccess(req.user)) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. You don't have permission to mark groups as fraud.",
      });
    }

    // Normalize email consistently (only lowercase, no other transformations)
    const email = rawEmail ? rawEmail.toLowerCase().trim() : null;

    if (!email || !fraudReason) {
      return res.status(400).json({
        success: false,
        message: "Email and fraud reason are required",
      });
    }

    // Build the query to find all assignments in this group
    const query = {};

    // For refunds managers, only allow updating their assignments
    if (req.user.role === "refunds_manager") {
      query.refundsManager = userId;
    }

    // Find assignments by email - handle both CSV and order sources
    const assignments = await RefundAssignment.find(query)
      .populate("leadId", "newEmail oldEmail");

    // Filter to find all assignments matching this email
    const matchingAssignments = assignments.filter((assignment) => {
      if (assignment.source === "csv") {
        return assignment.email?.toLowerCase() === email;
      } else if (assignment.leadId) {
        const leadEmail =
          assignment.leadId.newEmail || assignment.leadId.oldEmail;
        return leadEmail?.toLowerCase() === email;
      }
      return false;
    });

    if (matchingAssignments.length === 0) {
      console.log("Mark as fraud - No matching assignments found:", {
        searchEmail: email,
        totalAssignments: assignments.length,
        userRole: req.user.role,
        userId: userId,
      });
      return res.status(404).json({
        success: false,
        message: "No refund assignments found for this email",
      });
    }

    // Update all matching assignments to fraud status
    const updatePromises = matchingAssignments.map(async (assignment) => {
      // Set temporary fields for middleware
      assignment.modifiedBy = userId;
      assignment.statusChangeNotes = fraudReason;
      assignment.status = "fraud";
      assignment.notes = fraudReason;
      return assignment.save();
    });

    await Promise.all(updatePromises);

    res.json({
      success: true,
      message: `Successfully marked ${matchingAssignments.length} assignment(s) as fraud`,
      data: {
        updatedCount: matchingAssignments.length,
      },
    });
  } catch (error) {
    console.error("Mark group as fraud error:", error);
    next(error);
  }
};

// Upload documents for a group of refunds
exports.uploadGroupDocuments = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Ensure user has refunds access
    if (!hasRefundsAccess(req.user)) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. You don't have permission to upload documents.",
      });
    }

    // Get email and normalize it consistently (only lowercase, no other transformations)
    const { email: rawEmail } = req.body;
    const email = rawEmail ? rawEmail.toLowerCase().trim() : null;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Extract document data from request
    const documentData = {
      gender: req.body.gender,
      dateOfBirth: req.body.dateOfBirth ? new Date(req.body.dateOfBirth) : undefined,
      address: req.body.address,
      twoFA: req.body.authenticator,
      recoveryCodes: req.body.backupCodes,
    };

    // Handle document links
    const documents = [];
    const documentFields = {
      idFront: 'ID Front',
      idBack: 'ID Back',
      selfieFront: 'Selfie Front',
      selfieBack: 'Selfie Back'
    };

    for (const [field, label] of Object.entries(documentFields)) {
      if (req.body[field] && req.body[field].trim()) {
        documents.push({
          type: field,
          label: label,
          url: req.body[field].trim(),
          uploadedAt: new Date(),
        });
      }
    }

    // Build the query to find all assignments in this group
    const query = {};

    // For refunds managers, only allow updating their assignments
    if (req.user.role === "refunds_manager") {
      query.refundsManager = userId;
    }

    // Find assignments by email - handle both CSV and order sources
    const assignments = await RefundAssignment.find(query)
      .populate("leadId", "newEmail oldEmail");

    // Filter to find all assignments matching this email
    const matchingAssignments = assignments.filter((assignment) => {
      if (assignment.source === "csv") {
        return assignment.email?.toLowerCase() === email;
      } else if (assignment.leadId) {
        const leadEmail =
          assignment.leadId.newEmail || assignment.leadId.oldEmail;
        return leadEmail?.toLowerCase() === email;
      }
      return false;
    });

    if (matchingAssignments.length === 0) {
      console.log("Upload documents - No matching assignments found:", {
        searchEmail: email,
        totalAssignments: assignments.length,
        userRole: req.user.role,
        userId: userId,
      });
      return res.status(404).json({
        success: false,
        message: "No refund assignments found for this email",
      });
    }

    // Update all matching assignments with document data
    const updatePromises = matchingAssignments.map(async (assignment) => {
      // Update basic fields
      if (documentData.gender) assignment.gender = documentData.gender;
      if (documentData.dateOfBirth) assignment.dateOfBirth = documentData.dateOfBirth;
      if (documentData.address) assignment.address = documentData.address;
      if (documentData.twoFA) assignment.twoFA = documentData.twoFA;
      if (documentData.recoveryCodes) assignment.recoveryCodes = documentData.recoveryCodes;

      // Merge documents
      if (documents.length > 0) {
        const existingDocs = Array.isArray(assignment.documents) ? assignment.documents : [];
        assignment.documents = [...existingDocs, ...documents];
      }

      return assignment.save();
    });

    await Promise.all(updatePromises);

    res.json({
      success: true,
      message: `Successfully updated documents for ${matchingAssignments.length} assignment(s)`,
      data: {
        updatedCount: matchingAssignments.length,
        documentsAdded: documents.length,
      },
    });
  } catch (error) {
    console.error("Upload group documents error:", error);
    next(error);
  }
};