const { validationResult } = require("express-validator");
const mongoose = require("mongoose");
const Lead = require("../models/Lead");
const User = require("../models/User");
const csvParser = require("csv-parser");
const { Readable } = require("stream");
const { spawn } = require("child_process");
const express = require("express");
const ClientNetwork = require("../models/ClientNetwork");
const ClientBroker = require("../models/ClientBroker");
const Campaign = require("../models/Campaign");
const CallChangeRequest = require("../models/CallChangeRequest");
const sessionSecurity = require("../utils/sessionSecurity");

// Country code to name mapping for search
const COUNTRY_CODE_MAP = {
  UK: "United Kingdom",
  GB: "United Kingdom",
  US: "United States",
  USA: "United States",
  UAE: "United Arab Emirates",
  CA: "Canada",
  AU: "Australia",
  NZ: "New Zealand",
  SA: "Saudi Arabia",
  ZA: "South Africa",
  // Add more common abbreviations as needed
};

exports.getLeads = async (req, res, next) => {
  try {
    const {
      leadType,
      isAssigned,
      country,
      gender,
      status,
      documentStatus,
      page = 1,
      limit = 10,
      nameSearch,
      emailSearch,
      phoneSearch,
      search, // New unified search parameter
      includeConverted = "true",
      order = "newest",
      orderId,
      assignedToMe,
      orderStatus,
      orderPriority,
      orderCreatedStart,
      orderCreatedEnd,
    } = req.query;
    const filter = {};
    
    // Note: Archived leads are now included in the list but displayed with grey styling
    // They are excluded from order selection by checking isArchived flag
    
    if (leadType) filter.leadType = leadType;

    // Handle isAssigned filter - use agent assignment system only
    if (isAssigned !== undefined && isAssigned !== "") {
      if (isAssigned === "true") {
        // Show leads that have an assigned agent
        filter.assignedAgent = { $ne: null };
      } else {
        // Show leads that don't have an assigned agent
        filter.assignedAgent = null;
      }
    }
    if (country) filter.country = new RegExp(country, "i");
    if (gender) filter.gender = gender;
    if (orderId) filter.orderId = new mongoose.Types.ObjectId(orderId);
    let sortOrder = { createdAt: -1 };
    switch (order) {
      case "oldest":
        sortOrder = { createdAt: 1 };
        break;
      case "name_asc":
        sortOrder = { firstName: 1, lastName: 1 };
        break;
      case "name_desc":
        sortOrder = { firstName: -1, lastName: -1 };
        break;
      default:
        sortOrder = { createdAt: -1 };
    }
    // Role-based access control
    if (req.user.role === "affiliate_manager") {
      // Affiliate managers can see all leads (no filtering)
    } else if (req.user.role === "lead_manager") {
      // Lead managers can see all leads (no filtering)
    }
    if (status) {
      filter.status = status;
    } else if (includeConverted !== "true") {
      filter.status = { $ne: "converted" };
    }
    if (documentStatus) filter["documents.status"] = documentStatus;

    // Store search keywords for use in aggregation pipeline (for assignedAgent search)
    let searchKeywords = [];

    // Handle unified search - multi-keyword search with AND logic
    // Split search into multiple keywords and trim each (similar to Orders page)
    if (search) {
      const rawKeywords = search
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .filter((k) => k.length > 0);
      
      // Process special parameters (assigned, unassigned, archived) and expand country codes
      searchKeywords = rawKeywords
        .filter((keyword) => {
          // Handle assigned:true or assigned:false
          if (keyword.startsWith("assigned:")) {
            const value = keyword.split(":")[1];
            if (value === "true") {
              filter.assignedAgent = { $ne: null };
            } else if (value === "false") {
              filter.assignedAgent = null;
            }
            return false; // Remove from search keywords
          }
          // Handle "assigned" keyword (without colon) - show all assigned leads
          if (keyword === "assigned") {
            filter.assignedAgent = { $ne: null };
            return false; // Remove from search keywords
          }
          // Handle "unassigned" keyword
          if (keyword === "unassigned") {
            filter.assignedAgent = null;
            return false; // Remove from search keywords
          }
          // Handle "archived" keyword - show only archived leads
          if (keyword === "archived") {
            filter.isArchived = true;
            return false; // Remove from search keywords
          }
          // Handle "unarchived" or "active" keyword - show only non-archived leads
          if (keyword === "unarchived" || keyword === "notarchived") {
            filter.isArchived = { $ne: true };
            return false; // Remove from search keywords
          }
          return true; // Keep other keywords
        })
        .map((keyword) => {
          // Expand country codes to full names
          const upperKeyword = keyword.toUpperCase();
          if (COUNTRY_CODE_MAP[upperKeyword]) {
            return COUNTRY_CODE_MAP[upperKeyword].toLowerCase();
          }
          return keyword;
        });
      
      // Note: Search filtering will be applied in aggregation pipeline after $lookup
      // to include assignedAgent name/email in the search
    } else {
      // Handle separate search filters (for backward compatibility)
      if (nameSearch) {
        filter.$or = [
          { firstName: new RegExp(nameSearch, "i") },
          { lastName: new RegExp(nameSearch, "i") },
        ];
      }

      if (emailSearch) {
        filter.newEmail = new RegExp(emailSearch, "i");
      }

      if (phoneSearch) {
        filter.newPhone = new RegExp(phoneSearch, "i");
      }
    }
    const skip = (page - 1) * limit;
    const limitNum = parseInt(limit);
    // Build order filters
    const orderFilters = {};
    if (orderStatus) {
      orderFilters["order.status"] = orderStatus;
    }
    if (orderPriority) {
      orderFilters["order.priority"] = orderPriority;
    }
    if (orderCreatedStart || orderCreatedEnd) {
      orderFilters["order.createdAt"] = {};
      if (orderCreatedStart) {
        orderFilters["order.createdAt"]["$gte"] = new Date(orderCreatedStart);
      }
      if (orderCreatedEnd) {
        orderFilters["order.createdAt"]["$lte"] = new Date(
          orderCreatedEnd + "T23:59:59.999Z"
        );
      }
    }

    const aggregationPipeline = [
      { $match: filter },
      {
        $lookup: {
          from: "users",
          localField: "assignedAgent",
          foreignField: "_id",
          as: "assignedAgentDetails",
        },
      },
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "orderDetails",
        },
      },
      {
        $addFields: {
          order: { $arrayElemAt: ["$orderDetails", 0] },
          assignedAgentInfo: { $arrayElemAt: ["$assignedAgentDetails", 0] },
        },
      },
      // Filter by assignedAgent name if search keywords are provided
      ...(searchKeywords.length > 0
        ? [
            {
              $match: {
                $and: searchKeywords.map((keyword) => ({
                  $or: [
                    { firstName: new RegExp(keyword, "i") },
                    { lastName: new RegExp(keyword, "i") },
                    { newEmail: new RegExp(keyword, "i") },
                    { newPhone: new RegExp(keyword, "i") },
                    { country: new RegExp(keyword, "i") },
                    { status: new RegExp(keyword, "i") },
                    { leadType: new RegExp(keyword, "i") },
                    { gender: new RegExp(keyword, "i") },
                    { "assignedAgentInfo.fullName": new RegExp(keyword, "i") },
                    { "assignedAgentInfo.email": new RegExp(keyword, "i") },
                    { "order.status": new RegExp(keyword, "i") },
                    { "order.priority": new RegExp(keyword, "i") },
                  ],
                })),
              },
            },
          ]
        : []),
      // Affiliate managers can now see all leads (no filtering needed)
      // Only filter if assignedToMe is explicitly requested
      ...(req.user.role === "affiliate_manager" && assignedToMe === "true"
        ? [
            {
              $match: {
                assignedAgent: new mongoose.Types.ObjectId(req.user.id),
              },
            },
          ]
        : []),
      // Add order filters after the lookup and addFields
      ...(Object.keys(orderFilters).length > 0
        ? [{ $match: orderFilters }]
        : []),
      { $sort: sortOrder },
      { $skip: skip },
      { $limit: limitNum },
      {
        $project: {
          _id: 1,
          firstName: 1,
          lastName: 1,
          prefix: 1,
          newEmail: 1,
          newPhone: 1,
          oldEmail: 1,
          oldPhone: 1,
          country: 1,
          leadType: 1,
          orderedAs: 1,
          assignedAgent: 1,
          assignedAgentAt: 1,
          lastUsedInOrder: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
          createdBy: 1,
          gender: 1,
          dob: 1,
          socialMedia: 1,
          campaign: 1,
          assignedClientBrokers: 1,
          clientNetworkHistory: 1,
          campaignHistory: 1,
          ourNetworkHistory: 1,
          clientNetwork: 1,
          ourNetwork: 1,
          documents: 1,
          comments: 1,
          address: 1,
          sin: 1,
          isArchived: 1,
          archivedAt: 1,
          archivedBy: 1,
          // Only include callNumber and callHistory for agents
          ...(req.user.role === "agent"
            ? {
                callNumber: 1,
                callHistory: 1,
              }
            : {}),
          "order._id": 1,
          "order.status": 1,
          "order.priority": 1,
          "order.createdAt": 1,
        },
      },
    ];
    const leads = await Lead.aggregate(aggregationPipeline);

    // Populate comments.author and assignedAgent for the leads
    await Lead.populate(leads, [
      {
        path: "comments.author",
        select: "fullName fourDigitCode",
      },
      {
        path: "assignedAgent",
        select: "fullName email fourDigitCode",
      },
    ]);

    // Count total documents with order filters
    const countPipeline = [
      { $match: filter },
      {
        $lookup: {
          from: "users",
          localField: "assignedAgent",
          foreignField: "_id",
          as: "assignedAgentDetails",
        },
      },
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "orderDetails",
        },
      },
      {
        $addFields: {
          order: { $arrayElemAt: ["$orderDetails", 0] },
          assignedAgentInfo: { $arrayElemAt: ["$assignedAgentDetails", 0] },
        },
      },
      // Filter by assignedAgent name if search keywords are provided
      ...(searchKeywords.length > 0
        ? [
            {
              $match: {
                $and: searchKeywords.map((keyword) => ({
                  $or: [
                    { firstName: new RegExp(keyword, "i") },
                    { lastName: new RegExp(keyword, "i") },
                    { newEmail: new RegExp(keyword, "i") },
                    { newPhone: new RegExp(keyword, "i") },
                    { country: new RegExp(keyword, "i") },
                    { status: new RegExp(keyword, "i") },
                    { leadType: new RegExp(keyword, "i") },
                    { gender: new RegExp(keyword, "i") },
                    { "assignedAgentInfo.fullName": new RegExp(keyword, "i") },
                    { "assignedAgentInfo.email": new RegExp(keyword, "i") },
                    { "order.status": new RegExp(keyword, "i") },
                    { "order.priority": new RegExp(keyword, "i") },
                  ],
                })),
              },
            },
          ]
        : []),
      // Affiliate managers can now see all leads (no filtering for count)
      ...(req.user.role === "affiliate_manager" && assignedToMe === "true"
        ? [
            {
              $match: {
                assignedAgent: new mongoose.Types.ObjectId(req.user.id),
              },
            },
          ]
        : []),
      ...(Object.keys(orderFilters).length > 0
        ? [{ $match: orderFilters }]
        : []),
      { $count: "total" },
    ];

    const countResult = await Lead.aggregate(countPipeline);
    const total = countResult.length > 0 ? countResult[0].total : 0;
    res.status(200).json({
      success: true,
      data: leads,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalLeads: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    next(error);
  }
};
exports.getAssignedLeads = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      orderId,
      leadType,
      orderStatus,
      orderPriority,
      orderCreatedStart,
      orderCreatedEnd,
    } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const filter = {
      assignedAgent: new mongoose.Types.ObjectId(req.user.id),
    };
    if (status) filter.status = status;
    if (leadType) filter.leadType = leadType;

    // Step 1: Get all unique leads assigned to this agent
    const assignedLeads = await Lead.find(filter)
      .select(
        "_id firstName lastName prefix newEmail newPhone country leadType status assignedAgentAt createdAt orderCallTracking orderComments clientBrokerHistory dob gender address sin socialMedia"
      )
      .populate("clientBrokerHistory.clientBroker", "name domain isActive")
      .lean();

    if (assignedLeads.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        pagination: {
          currentPage: pageNum,
          totalPages: 0,
          totalLeads: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });
    }

    // Get all lead IDs
    const leadIds = assignedLeads.map((lead) => lead._id);

    // Step 2: Find all orders that contain these leads
    const Order = require("../models/Order");
    const orderMatchStage = { leads: { $in: leadIds } };

    // Apply order filters if provided
    if (orderStatus) orderMatchStage.status = orderStatus;
    if (orderPriority) orderMatchStage.priority = orderPriority;
    if (orderCreatedStart || orderCreatedEnd) {
      orderMatchStage.createdAt = {};
      if (orderCreatedStart) {
        orderMatchStage.createdAt.$gte = new Date(orderCreatedStart);
      }
      if (orderCreatedEnd) {
        orderMatchStage.createdAt.$lte = new Date(
          orderCreatedEnd + "T23:59:59.999Z"
        );
      }
    }
    if (orderId) {
      orderMatchStage._id = new mongoose.Types.ObjectId(orderId);
    }

    const orders = await Order.find(orderMatchStage)
      .select("_id createdAt status priority leads leadsMetadata")
      .lean();

    // Step 3: Group leads with their orders
    const leadMap = new Map();

    // Initialize map with all assigned leads
    assignedLeads.forEach((lead) => {
      leadMap.set(lead._id.toString(), {
        leadId: lead._id,
        leadInfo: {
          firstName: lead.firstName,
          lastName: lead.lastName,
          prefix: lead.prefix,
          newEmail: lead.newEmail,
          newPhone: lead.newPhone,
          country: lead.country,
          leadType: lead.leadType,
          status: lead.status,
          assignedAgentAt: lead.assignedAgentAt,
          createdAt: lead.createdAt,
          dob: lead.dob,
          gender: lead.gender,
          address: lead.address,
          sin: lead.sin,
          socialMedia: lead.socialMedia,
        },
        orders: [],
        orderCallTracking: lead.orderCallTracking || [],
        orderComments: lead.orderComments || [],
        clientBrokerHistory: lead.clientBrokerHistory || [],
      });
    });

    // Associate orders with leads and include call numbers, comments, and lead-level brokers per order
    orders.forEach((order) => {
      order.leads.forEach((leadIdInOrder) => {
        const leadIdStr = leadIdInOrder.toString();
        if (leadMap.has(leadIdStr)) {
          const leadData = leadMap.get(leadIdStr);

          // Find call number for this specific order
          const callTracking = leadData.orderCallTracking.find(
            (tracking) =>
              tracking.orderId &&
              tracking.orderId.toString() === order._id.toString()
          );

          // Find comments for this specific order
          const orderComments = (leadData.orderComments || []).filter(
            (comment) =>
              comment.orderId &&
              comment.orderId.toString() === order._id.toString()
          );

          // Find lead-level client brokers assigned for this specific order
          const leadLevelBrokers = (leadData.clientBrokerHistory || [])
            .filter(
              (history) =>
                history.orderId &&
                history.orderId.toString() === order._id.toString()
            )
            .map((history) => ({
              _id: history.clientBroker?._id,
              name: history.clientBroker?.name || "Unknown Broker",
              domain: history.clientBroker?.domain,
              isActive: history.clientBroker?.isActive,
              assignedAt: history.assignedAt,
            }));

          // Find orderedAs from order's leadsMetadata
          const metadata = order.leadsMetadata?.find(
            (meta) => meta.leadId && meta.leadId.toString() === leadIdStr
          );

          leadData.orders.push({
            orderId: order._id,
            orderCreatedAt: order.createdAt,
            orderStatus: order.status,
            orderPriority: order.priority,
            clientBrokers: leadLevelBrokers, // Now showing lead-level brokers filtered by orderId
            callNumber: callTracking ? callTracking.callNumber : null,
            verified: callTracking ? callTracking.verified : false,
            comments: orderComments,
            orderedAs: metadata?.orderedAs || null,
          });
        }
      });
    });

    // Convert map to array and sort by assignedAgentAt
    let groupedLeads = Array.from(leadMap.values()).sort((a, b) => {
      const dateA = a.leadInfo.assignedAgentAt || a.leadInfo.createdAt;
      const dateB = b.leadInfo.assignedAgentAt || b.leadInfo.createdAt;
      return new Date(dateB) - new Date(dateA);
    });

    // Apply filters if orders are required but none found
    if (
      orderId ||
      orderStatus ||
      orderPriority ||
      orderCreatedStart ||
      orderCreatedEnd
    ) {
      groupedLeads = groupedLeads.filter((lead) => lead.orders.length > 0);
    }

    // Sort orders within each lead by creation date (newest first)
    groupedLeads.forEach((lead) => {
      lead.orders.sort(
        (a, b) => new Date(b.orderCreatedAt) - new Date(a.orderCreatedAt)
      );
    });

    const totalCount = groupedLeads.length;

    // Apply pagination
    const paginatedLeads = groupedLeads.slice(skip, skip + limitNum);

    // Populate orderComments.author for display
    const leadIdsForPopulate = paginatedLeads.map((gl) => gl.leadId);
    const populatedLeads = await Lead.find({ _id: { $in: leadIdsForPopulate } })
      .populate("orderComments.author", "fullName fourDigitCode")
      .lean();

    // Merge populated order comments back
    paginatedLeads.forEach((groupedLead) => {
      const populated = populatedLeads.find(
        (pl) => pl._id.toString() === groupedLead.leadId.toString()
      );
      if (populated && populated.orderComments) {
        // Update each order with its populated comments
        groupedLead.orders.forEach((order) => {
          const populatedComments = populated.orderComments.filter(
            (comment) =>
              comment.orderId &&
              comment.orderId.toString() === order.orderId.toString()
          );
          order.comments = populatedComments;
        });
      }
    });

    res.status(200).json({
      success: true,
      data: paginatedLeads,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalCount / limitNum),
        totalLeads: totalCount,
        hasNextPage: pageNum * limitNum < totalCount,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("Error in getAssignedLeads:", error);
    next(error);
  }
};
exports.getLeadById = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate("assignedAgent", "fullName fourDigitCode email")
      .populate("comments.author", "fullName fourDigitCode")
      .populate("orderId", "requester");
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // Access control based on user role
    if (req.user.role === "admin") {
      // Admins can access any lead
    } else if (req.user.role === "affiliate_manager") {
      // Affiliate managers can access all leads (no filtering)
    } else if (req.user.role === "lead_manager") {
      // Lead managers can access all leads (no filtering)
    } else {
      // Other roles (agents) can only access leads assigned to them
      if (
        !lead.assignedAgent ||
        lead.assignedAgent._id.toString() !== req.user.id
      ) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to access this lead",
        });
      }
    }

    // Create a clean version of the lead data
    let leadData = lead.toObject ? lead.toObject() : lead;

    // Only include call number data for agents
    if (req.user.role !== "agent") {
      delete leadData.callNumber;
      delete leadData.callHistory;
    }

    res.status(200).json({
      success: true,
      data: leadData,
    });
  } catch (error) {
    next(error);
  }
};
exports.addComment = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }
    const { text, orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required for comments",
      });
    }

    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // Verify the order exists and contains this lead
    const Order = require("../models/Order");
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const leadExistsInOrder = order.leads.some(
      (leadId) => leadId.toString() === lead._id.toString()
    );
    if (!leadExistsInOrder) {
      return res.status(400).json({
        success: false,
        message: "This lead is not part of the specified order",
      });
    }

    // Check permissions based on user role
    if (req.user.role === "admin") {
      // Admins can comment on any lead
    } else if (req.user.role === "affiliate_manager") {
      // Affiliate managers can only comment on leads from orders they created OR leads assigned to them
      const hasAccess =
        (order.requester && order.requester.toString() === req.user.id) ||
        (lead.assignedAgent && lead.assignedAgent.toString() === req.user.id);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message:
            "Affiliate managers can only comment on leads from their orders or leads assigned to them",
        });
      }
    } else if (req.user.role === "lead_manager") {
      // Lead managers can comment on all leads (no filtering)
    } else if (req.user.role === "agent") {
      // Agents can only comment on leads assigned to them
      if (
        !lead.assignedAgent ||
        lead.assignedAgent.toString() !== req.user.id
      ) {
        return res.status(403).json({
          success: false,
          message: "Agents can only comment on leads assigned to them",
        });
      }
    } else {
      return res.status(403).json({
        success: false,
        message: "Not authorized to comment on this lead",
      });
    }

    // Add order-specific comment
    lead.addOrderComment(orderId, text, req.user.id);
    await lead.save();

    // Populate and return the order-specific comments
    await lead.populate("orderComments.author", "fullName fourDigitCode");
    const orderComments = lead.getOrderComments(orderId);

    res.status(200).json({
      success: true,
      message: "Comment added successfully",
      data: {
        leadId: lead._id,
        orderId: orderId,
        comments: orderComments,
      },
    });
  } catch (error) {
    next(error);
  }
};
exports.updateLeadStatus = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }
    const { status, documentStatus } = req.body;
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }
    // Access control based on user role
    if (req.user.role === "admin") {
      // Admins can update any lead
    } else if (req.user.role === "affiliate_manager") {
      // Affiliate managers can only update leads from orders they created OR leads assigned to them
      const leadWithOrder = await Lead.findById(req.params.id).populate(
        "orderId",
        "requester"
      );
      const hasAccess =
        (leadWithOrder.orderId &&
          leadWithOrder.orderId.requester &&
          leadWithOrder.orderId.requester.toString() === req.user.id) ||
        (leadWithOrder.assignedAgent &&
          leadWithOrder.assignedAgent.toString() === req.user.id);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message:
            "Affiliate managers can only update leads from their orders or leads assigned to them",
        });
      }
    } else if (req.user.role === "lead_manager") {
      // Lead managers can update all leads (no filtering)
    } else {
      // Other roles (agents) can only update leads assigned to them
      if (
        !lead.assignedAgent ||
        lead.assignedAgent.toString() !== req.user.id
      ) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to update this lead",
        });
      }
    }
    if (status) lead.status = status;
    if (documentStatus && lead.documents) {
      lead.documents.status = documentStatus;
    }
    await lead.save();
    await lead.populate("assignedAgent", "fullName fourDigitCode");
    res.status(200).json({
      success: true,
      message: "Lead status updated successfully",
      data: lead,
    });
  } catch (error) {
    next(error);
  }
};
exports.getLeadStats = async (req, res, next) => {
  try {
    const pipeline = [];

    // For affiliate managers, only include leads from orders they created or leads assigned to them
    if (req.user.role === "affiliate_manager") {
      pipeline.push(
        {
          $lookup: {
            from: "orders",
            localField: "orderId",
            foreignField: "_id",
            as: "orderDetails",
          },
        },
        {
          $addFields: {
            order: { $arrayElemAt: ["$orderDetails", 0] },
          },
        },
        {
          $match: {
            $or: [
              { "order.requester": new mongoose.Types.ObjectId(req.user.id) },
              { assignedAgent: new mongoose.Types.ObjectId(req.user.id) },
            ],
          },
        }
      );
    } else if (req.user.role === "lead_manager") {
      // Lead managers can see all leads (no filtering)
    }

    pipeline.push({
      $group: {
        _id: {
          leadType: "$leadType",
          isAssigned: {
            $cond: [{ $ne: ["$assignedAgent", null] }, true, false],
          },
        },
        count: { $sum: 1 },
      },
    });
    const stats = await Lead.aggregate(pipeline);
    const formattedStats = {
      ftd: { assigned: 0, available: 0, total: 0 },
      filler: { assigned: 0, available: 0, total: 0 },
      cold: { assigned: 0, available: 0, total: 0 },
      overall: { assigned: 0, available: 0, total: 0 },
    };
    stats.forEach((stat) => {
      const { leadType, isAssigned } = stat._id;
      const count = stat.count;
      if (formattedStats[leadType]) {
        if (isAssigned) {
          formattedStats[leadType].assigned = count;
        } else {
          formattedStats[leadType].available = count;
        }
        formattedStats[leadType].total += count;
        if (isAssigned) {
          formattedStats.overall.assigned += count;
        } else {
          formattedStats.overall.available += count;
        }
        formattedStats.overall.total += count;
      }
    });
    const documentStatsPipeline = [];

    // For affiliate managers, only include FTD leads from orders they created or leads assigned to them
    if (req.user.role === "affiliate_manager") {
      documentStatsPipeline.push(
        {
          $lookup: {
            from: "orders",
            localField: "orderId",
            foreignField: "_id",
            as: "orderDetails",
          },
        },
        {
          $addFields: {
            order: { $arrayElemAt: ["$orderDetails", 0] },
          },
        },
        {
          $match: {
            leadType: "ftd",
            $or: [
              { "order.requester": new mongoose.Types.ObjectId(req.user.id) },
              { assignedAgent: new mongoose.Types.ObjectId(req.user.id) },
            ],
          },
        }
      );
    } else if (req.user.role === "lead_manager") {
      // Lead managers can see all FTD leads (no filtering)
      documentStatsPipeline.push({
        $match: {
          leadType: "ftd",
        },
      });
    } else {
      documentStatsPipeline.push({
        $match: {
          leadType: "ftd",
        },
      });
    }

    documentStatsPipeline.push({
      $group: {
        _id: "$documents.status",
        count: { $sum: 1 },
      },
    });
    const documentStats = await Lead.aggregate(documentStatsPipeline);
    const formattedDocumentStats = {
      good: 0,
      ok: 0,
      pending: 0,
    };
    documentStats.forEach((stat) => {
      if (formattedDocumentStats.hasOwnProperty(stat._id)) {
        formattedDocumentStats[stat._id] = stat.count;
      }
    });
    res.status(200).json({
      success: true,
      data: {
        leads: formattedStats,
        documents: formattedDocumentStats,
      },
    });
  } catch (error) {
    next(error);
  }
};
exports.assignLeads = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }
    const { leadIds, agentId } = req.body;

    // Verify agent exists and is valid
    const agent = await User.findById(agentId);
    if (
      !agent ||
      agent.role !== "agent" ||
      !agent.isActive ||
      agent.status !== "approved"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid or inactive/unapproved agent selected.",
      });
    }

    // Check if any of the leads are cold leads (cold leads cannot be assigned)
    const leadsToCheck = await Lead.find({ _id: { $in: leadIds } });
    const coldLeads = leadsToCheck.filter((lead) => lead.leadType === "cold");
    if (coldLeads.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cold leads cannot be assigned to agents. Only FTD and Filler leads can be assigned.",
        data: {
          coldLeadIds: coldLeads.map((lead) => lead._id),
          coldLeadCount: coldLeads.length,
        },
      });
    }

    let updateCondition = {
      _id: { $in: leadIds },
      leadType: { $in: ["ftd", "filler"] }, // Only allow FTD and Filler to be assigned
    };

    // For affiliate managers, ensure they can only assign leads from their orders
    if (req.user.role === "affiliate_manager") {
      // First get leads with order information to validate access
      const accessibleLeads = await Lead.aggregate([
        {
          $match: {
            _id: { $in: leadIds.map((id) => new mongoose.Types.ObjectId(id)) },
          },
        },
        {
          $lookup: {
            from: "orders",
            localField: "orderId",
            foreignField: "_id",
            as: "orderDetails",
          },
        },
        {
          $addFields: {
            order: { $arrayElemAt: ["$orderDetails", 0] },
          },
        },
        {
          $match: {
            $or: [
              { "order.requester": new mongoose.Types.ObjectId(req.user.id) },
              { assignedAgent: new mongoose.Types.ObjectId(req.user.id) },
            ],
          },
        },
        { $project: { _id: 1 } },
      ]);

      const accessibleLeadIds = accessibleLeads.map((lead) => lead._id);
      updateCondition._id = { $in: accessibleLeadIds };

      if (accessibleLeadIds.length !== leadIds.length) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only assign leads from your orders.",
        });
      }
    }
    console.log("Assigning leads with:", {
      updateCondition,
      agentId,
      agentName: agent.fullName,
      agentCode: agent.fourDigitCode,
    });
    const result = await Lead.updateMany(updateCondition, {
      $set: {
        assignedAgent: agentId,
        assignedAgentAt: new Date(),
      },
    });
    console.log("Assignment result:", result);
    const verifyLeads = await Lead.find({ _id: { $in: leadIds } })
      .populate("assignedAgent", "fullName fourDigitCode email")
      .limit(3);
    console.log(
      "Verification - First few assigned leads:",
      verifyLeads.map((lead) => ({
        id: lead._id,
        assignedAgent: lead.assignedAgent
          ? {
              id: lead.assignedAgent._id,
              fullName: lead.assignedAgent.fullName,
              fourDigitCode: lead.assignedAgent.fourDigitCode,
            }
          : null,
      }))
    );
    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} leads assigned successfully`,
      data: {
        assignedCount: result.modifiedCount,
        agentName: agent.fullName,
        agentCode: agent.fourDigitCode,
      },
    });
  } catch (error) {
    next(error);
  }
};
exports.unassignLeads = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }
    const { leadIds } = req.body;
    let updateCondition = {
      _id: { $in: leadIds },
      assignedAgent: { $ne: null },
    };

    // For affiliate managers, ensure they can only unassign leads from their orders
    if (req.user.role === "affiliate_manager") {
      // First get leads with order information to validate access
      const accessibleLeads = await Lead.aggregate([
        {
          $match: {
            _id: { $in: leadIds.map((id) => new mongoose.Types.ObjectId(id)) },
          },
        },
        {
          $lookup: {
            from: "orders",
            localField: "orderId",
            foreignField: "_id",
            as: "orderDetails",
          },
        },
        {
          $addFields: {
            order: { $arrayElemAt: ["$orderDetails", 0] },
          },
        },
        {
          $match: {
            $or: [
              { "order.requester": new mongoose.Types.ObjectId(req.user.id) },
              { assignedAgent: new mongoose.Types.ObjectId(req.user.id) },
            ],
          },
        },
        { $project: { _id: 1 } },
      ]);

      const accessibleLeadIds = accessibleLeads.map((lead) => lead._id);
      updateCondition._id = { $in: accessibleLeadIds };

      if (accessibleLeadIds.length !== leadIds.length) {
        return res.status(403).json({
          success: false,
          message:
            "Access denied. You can only unassign leads from your orders.",
        });
      }
    }
    const result = await Lead.updateMany(updateCondition, {
      $set: {
        assignedAgent: null,
        assignedAgentAt: null,
      },
    });
    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} leads unassigned successfully`,
      data: {
        unassignedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    next(error);
  }
};
exports.assignClientBrokerToLead = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }
    const leadId = req.params.id;
    const { clientBrokerId, campaign, intermediaryClientNetwork, domain } =
      req.body;
    const [lead, clientBroker] = await Promise.all([
      Lead.findById(leadId),
      ClientBroker.findById(clientBrokerId),
    ]);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }
    if (!clientBroker) {
      return res.status(404).json({
        success: false,
        message: "Client broker not found",
      });
    }
    if (
      !["admin", "affiliate_manager", "lead_manager"].includes(req.user.role)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Only admins, affiliate managers, and lead managers can assign client brokers.",
      });
    }
    if (!clientBroker.isActive) {
      return res.status(400).json({
        success: false,
        message: "Cannot assign lead to inactive client broker",
      });
    }
    if (lead.isAssignedToClientBroker(clientBrokerId)) {
      return res.status(400).json({
        success: false,
        message: `Lead "${lead.firstName} ${lead.lastName}" is already assigned to client broker "${clientBroker.name}".`,
        data: {
          leadId: lead._id,
          leadName: `${lead.firstName} ${lead.lastName}`,
          clientBroker: clientBroker.name,
        },
      });
    }
    lead.assignClientBroker(
      clientBrokerId,
      req.user.id,
      lead.orderId,
      intermediaryClientNetwork,
      domain
    );
    if (campaign !== undefined) {
      lead.campaign = campaign;
    }
    clientBroker.assignLead(leadId);
    await Promise.all([lead.save(), clientBroker.save()]);
    const updatedLead = await Lead.findById(leadId)
      .populate("assignedAgent", "fullName fourDigitCode email")
      .populate("assignedClientBrokers", "name domain");
    res.status(200).json({
      success: true,
      message: `Successfully assigned client broker "${clientBroker.name}" to lead "${lead.firstName} ${lead.lastName}"`,
      data: updatedLead,
    });
  } catch (error) {
    console.error("Assign client broker to lead error:", error);
    next(error);
  }
};
exports.getLeadAssignmentHistory = async (req, res, next) => {
  try {
    const leadId = req.params.id;
    const lead = await Lead.findById(leadId)
      .populate(
        "clientBrokerHistory.assignedBy",
        "fullName fourDigitCode email"
      )
      .populate("clientBrokerHistory.orderId", "status createdAt")
      .populate("clientBrokerHistory.clientBroker", "name domain")
      .populate("clientBrokerHistory.intermediaryClientNetwork", "name")
      .populate("assignedClientBrokers", "name domain");
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }
    if (!["admin", "affiliate_manager"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Only admins and affiliate managers can view assignment history.",
      });
    }
    res.status(200).json({
      success: true,
      data: {
        leadId: lead._id,
        leadName: `${lead.firstName} ${lead.lastName}`,
        currentAssignments: {
          clientBrokers: lead.assignedClientBrokers.map((broker) => ({
            id: broker._id,
            name: broker.name,
            domain: broker.domain,
          })),
          campaign: lead.campaign,
        },
        assignmentHistory: lead.clientBrokerHistory.map((history) => ({
          clientBroker: {
            id: history.clientBroker._id,
            name: history.clientBroker.name,
            domain: history.clientBroker.domain,
          },
          intermediaryClientNetwork: history.intermediaryClientNetwork
            ? {
                id: history.intermediaryClientNetwork._id,
                name: history.intermediaryClientNetwork.name,
              }
            : null,
          assignedAt: history.assignedAt,
          assignedBy: history.assignedBy,
          orderId: history.orderId,
          orderStatus: history.orderId ? history.orderId.status : null,
          orderCreatedAt: history.orderId ? history.orderId.createdAt : null,
          domain: history.domain,
        })),
      },
    });
  } catch (error) {
    console.error("Get lead assignment history error:", error);
    next(error);
  }
};
exports.getClientBrokerAnalytics = async (req, res, next) => {
  try {
    const { orderId } = req.query;
    if (!["admin", "affiliate_manager"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Only admins and affiliate managers can view analytics.",
      });
    }
    let matchStage = {};
    if (orderId) {
      if (!mongoose.Types.ObjectId.isValid(orderId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid order ID format",
        });
      }
      matchStage.orderId = new mongoose.Types.ObjectId(orderId);
    }
    const analytics = await Lead.aggregate([
      { $match: matchStage },
      {
        $unwind: {
          path: "$clientBrokerHistory",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "clientbrokers",
          localField: "clientBrokerHistory.clientBroker",
          foreignField: "_id",
          as: "brokerDetails",
        },
      },
      { $unwind: { path: "$brokerDetails", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            clientBroker: "$clientBrokerHistory.clientBroker",
            orderId: "$clientBrokerHistory.orderId",
          },
          brokerName: { $first: "$brokerDetails.name" },
          brokerDomain: { $first: "$brokerDetails.domain" },
          totalAssignments: { $sum: 1 },
          uniqueLeads: { $addToSet: "$_id" },
          firstAssignment: { $min: "$clientBrokerHistory.assignedAt" },
          lastAssignment: { $max: "$clientBrokerHistory.assignedAt" },
        },
      },
      {
        $group: {
          _id: "$_id.clientBroker",
          brokerName: { $first: "$brokerName" },
          brokerDomain: { $first: "$brokerDomain" },
          totalAssignments: { $sum: "$totalAssignments" },
          totalUniqueLeads: { $sum: { $size: "$uniqueLeads" } },
          orderBreakdown: {
            $push: {
              orderId: "$_id.orderId",
              assignments: "$totalAssignments",
              uniqueLeads: { $size: "$uniqueLeads" },
              firstAssignment: "$firstAssignment",
              lastAssignment: "$lastAssignment",
            },
          },
        },
      },
      {
        $project: {
          clientBrokerId: "$_id",
          brokerName: 1,
          brokerDomain: 1,
          totalAssignments: 1,
          totalUniqueLeads: 1,
          orderBreakdown: 1,
          _id: 0,
        },
      },
      { $sort: { totalAssignments: -1 } },
    ]);
    res.status(200).json({
      success: true,
      data: {
        analytics,
        totalClientBrokers: analytics.length,
        totalAssignments: analytics.reduce(
          (sum, item) => sum + item.totalAssignments,
          0
        ),
        totalUniqueLeads: analytics.reduce(
          (sum, item) => sum + item.totalUniqueLeads,
          0
        ),
      },
    });
  } catch (error) {
    console.error("Get client broker analytics error:", error);
    next(error);
  }
};
exports.updateLead = async (req, res, next) => {
  try {
    const {
      firstName,
      lastName,
      newEmail,
      oldEmail,
      newPhone,
      oldPhone,
      country,
      status,
      documents,
      leadType,
      socialMedia,
      sin,
      gender,
      address,
      dob,
      campaign,
      clientBroker,
      clientNetwork,
      ourNetwork,
    } = req.body;
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // Access control - lead managers can edit all leads (no filtering)
    // Note: affiliate_manager validation removed - they can update any lead

    if (firstName) lead.firstName = firstName;
    if (lastName) lead.lastName = lastName;
    if (newEmail) lead.newEmail = newEmail;
    if (oldEmail !== undefined) lead.oldEmail = oldEmail;
    if (newPhone) lead.newPhone = newPhone;
    if (oldPhone !== undefined) lead.oldPhone = oldPhone;
    if (country) lead.country = country;
    if (status) lead.status = status;
    if (leadType) lead.leadType = leadType;
    if (sin !== undefined && leadType === "ftd") lead.sin = sin;
    if (gender !== undefined) lead.gender = gender;
    if (dob !== undefined) lead.dob = dob;
    if (
      address !== undefined &&
      (lead.leadType === "ftd" || lead.leadType === "filler")
    ) {
      lead.address = address;
    }
    if (socialMedia) {
      lead.socialMedia = {
        ...lead.socialMedia,
        ...socialMedia,
      };
    }
    if (documents) {
      lead.documents = documents;
    }

    // Handle campaign assignments
    if (campaign !== undefined) {
      if (Array.isArray(campaign) && campaign.length > 0) {
        // Clear existing campaign history for this lead/order
        lead.campaignHistory = lead.campaignHistory.filter(
          (history) =>
            history.orderId &&
            history.orderId.toString() !== lead.orderId?.toString()
        );

        // Add new campaign assignments
        for (const campaignId of campaign) {
          if (
            campaignId &&
            !lead.isAssignedToCampaign(campaignId, lead.orderId)
          ) {
            lead.addCampaignAssignment(campaignId, req.user._id, lead.orderId);
          }
        }
      } else if (Array.isArray(campaign) && campaign.length === 0) {
        // Clear campaign assignments for this order
        lead.campaignHistory = lead.campaignHistory.filter(
          (history) =>
            history.orderId &&
            history.orderId.toString() !== lead.orderId?.toString()
        );
      } else {
        // Handle legacy single campaign assignment
        lead.campaign = campaign;
      }
    }

    // Handle client network assignments
    if (clientNetwork !== undefined) {
      if (Array.isArray(clientNetwork) && clientNetwork.length > 0) {
        // Clear existing client network history for this lead/order
        lead.clientNetworkHistory = lead.clientNetworkHistory.filter(
          (history) =>
            history.orderId &&
            history.orderId.toString() !== lead.orderId?.toString()
        );

        // Add new client network assignments
        for (const networkId of clientNetwork) {
          if (
            networkId &&
            !lead.isAssignedToClientNetwork(networkId, lead.orderId)
          ) {
            lead.addClientNetworkAssignment(
              networkId,
              req.user._id,
              lead.orderId
            );
          }
        }
      } else if (Array.isArray(clientNetwork) && clientNetwork.length === 0) {
        // Clear client network assignments for this order
        lead.clientNetworkHistory = lead.clientNetworkHistory.filter(
          (history) =>
            history.orderId &&
            history.orderId.toString() !== lead.orderId?.toString()
        );
      } else {
        // Handle legacy single client network assignment
        lead.clientNetwork = clientNetwork;
      }
    }

    // Handle our network assignments
    if (ourNetwork !== undefined) {
      if (Array.isArray(ourNetwork) && ourNetwork.length > 0) {
        // Clear existing our network history for this lead/order
        lead.ourNetworkHistory = lead.ourNetworkHistory.filter(
          (history) =>
            history.orderId &&
            history.orderId.toString() !== lead.orderId?.toString()
        );

        // Add new our network assignments
        for (const networkId of ourNetwork) {
          if (
            networkId &&
            !lead.isAssignedToOurNetwork(networkId, lead.orderId)
          ) {
            lead.addOurNetworkAssignment(networkId, req.user._id, lead.orderId);
          }
        }
      } else if (Array.isArray(ourNetwork) && ourNetwork.length === 0) {
        // Clear our network assignments for this order
        lead.ourNetworkHistory = lead.ourNetworkHistory.filter(
          (history) =>
            history.orderId &&
            history.orderId.toString() !== lead.orderId?.toString()
        );
      } else {
        // Handle legacy single our network assignment
        lead.ourNetwork = ourNetwork;
      }
    }

    // Handle client broker updates
    if (clientBroker !== undefined) {
      if (Array.isArray(clientBroker) && clientBroker.length > 0) {
        const ClientBroker = require("../models/ClientBroker");

        // Validate all client brokers exist and are active
        const brokerDocs = await ClientBroker.find({
          _id: { $in: clientBroker },
          isActive: true,
        });

        if (brokerDocs.length !== clientBroker.length) {
          return res.status(400).json({
            success: false,
            message:
              "One or more selected client brokers not found or inactive",
          });
        }

        // Add new brokers to existing assignments (additive, not replacement)
        // This ensures we never "forget" that a lead was sent to a broker
        for (const brokerId of clientBroker) {
          if (!lead.isAssignedToClientBroker(brokerId)) {
            lead.assignClientBroker(brokerId, req.user._id, lead.orderId);
          }
        }
      } else if (Array.isArray(clientBroker) && clientBroker.length === 0) {
        // Note: We don't clear assignedClientBrokers because it's a permanent record
        // of all brokers this lead has been sent to (used for order filtering)
        // If you need to track "currently active" brokers, use clientBrokerHistory
      } else if (clientBroker && clientBroker !== "") {
        // Handle legacy single broker assignment
        const ClientBroker = require("../models/ClientBroker");
        const brokerDoc = await ClientBroker.findOne({
          _id: clientBroker,
          isActive: true,
        });
        if (!brokerDoc) {
          return res.status(400).json({
            success: false,
            message: "Selected client broker not found or inactive",
          });
        }

        // Add broker to assignments (additive, not replacement)
        if (!lead.isAssignedToClientBroker(clientBroker)) {
          lead.assignClientBroker(clientBroker, req.user._id, lead.orderId);
        }
      } else {
        // Note: We don't clear assignedClientBrokers because it's a permanent record
        // of all brokers this lead has been sent to (used for order filtering)
      }
    }

    await lead.save();
    await lead.populate("assignedAgent", "fullName fourDigitCode");
    await lead.populate("comments.author", "fullName");
    await lead.populate("assignedClientBrokers", "name domain description");
    await lead.populate(
      "clientBrokerHistory.clientBroker",
      "name domain description"
    );

    res.status(200).json({
      success: true,
      message: "Lead updated successfully",
      data: lead,
    });
  } catch (error) {
    next(error);
  }
};
exports.createLead = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }
    const {
      firstName,
      lastName,
      newEmail,
      oldEmail,
      newPhone,
      oldPhone,
      country,
      leadType,
      socialMedia,
      sin,
      campaign,
      clientBroker,
      clientNetwork,
      ourNetwork,
      dob,
      address,
      gender,
      documents,
    } = req.body;

    const existingLead = await Lead.findOne({
      newEmail: newEmail.toLowerCase(),
    });
    if (existingLead) {
      return res.status(400).json({
        success: false,
        message: "A lead with this email already exists",
        errors: [
          {
            type: "field",
            value: newEmail,
            msg: "This email is already registered in the system",
            path: "newEmail",
            location: "body",
          },
        ],
      });
    }
    const leadData = {
      firstName,
      lastName,
      newEmail,
      oldEmail,
      newPhone,
      oldPhone,
      country,
      leadType,
      socialMedia,
      sin,
      dob,
      address,
      gender,
      createdBy: req.user.id,
      status: "active",
    };

    // Handle legacy single field assignments for backward compatibility
    if (typeof campaign === "string" && campaign) {
      leadData.campaign = campaign;
    }
    if (typeof clientBroker === "string" && clientBroker) {
      leadData.clientBroker = clientBroker;
    }
    if (typeof clientNetwork === "string" && clientNetwork) {
      leadData.clientNetwork = clientNetwork;
    }
    if (typeof ourNetwork === "string" && ourNetwork) {
      leadData.ourNetwork = ourNetwork;
    }
    if (leadType === "ftd") {
      if (documents && Array.isArray(documents) && documents.length > 0) {
        leadData.documents = documents;
      } else {
        leadData.documents = {
          status: "pending",
        };
      }
    } else {
      leadData.documents = documents || [];
    }
    const lead = new Lead(leadData);
    await lead.save();

    // Handle array assignments for multiple selections
    // Note: For standalone leads, we use null as orderId since they're not part of an order yet

    // Handle campaign assignments
    if (Array.isArray(campaign) && campaign.length > 0) {
      for (const campaignId of campaign) {
        if (campaignId && !lead.isAssignedToCampaign(campaignId, null)) {
          lead.addCampaignAssignment(campaignId, req.user._id, null);
        }
      }
    }

    // Handle client network assignments
    if (Array.isArray(clientNetwork) && clientNetwork.length > 0) {
      for (const networkId of clientNetwork) {
        if (networkId && !lead.isAssignedToClientNetwork(networkId, null)) {
          lead.addClientNetworkAssignment(networkId, req.user._id, null);
        }
      }
    }

    // Handle our network assignments
    if (Array.isArray(ourNetwork) && ourNetwork.length > 0) {
      for (const networkId of ourNetwork) {
        if (networkId && !lead.isAssignedToOurNetwork(networkId, null)) {
          lead.addOurNetworkAssignment(networkId, req.user._id, null);
        }
      }
    }

    // Handle client broker assignments
    if (Array.isArray(clientBroker) && clientBroker.length > 0) {
      for (const brokerId of clientBroker) {
        if (brokerId && !lead.isAssignedToClientBroker(brokerId)) {
          lead.assignClientBroker(brokerId, req.user._id, null);
        }
      }
    }

    // Save the lead again if any assignments were made
    if (
      (Array.isArray(campaign) && campaign.length > 0) ||
      (Array.isArray(clientNetwork) && clientNetwork.length > 0) ||
      (Array.isArray(ourNetwork) && ourNetwork.length > 0) ||
      (Array.isArray(clientBroker) && clientBroker.length > 0)
    ) {
      await lead.save();
    }

    res.status(201).json({
      success: true,
      message: "Lead created successfully",
      data: lead,
    });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.newEmail) {
      return res.status(400).json({
        success: false,
        message: "A lead with this email already exists",
        errors: [
          {
            type: "field",
            value: error.keyValue.newEmail,
            msg: "This email is already registered in the system",
            path: "newEmail",
            location: "body",
          },
        ],
      });
    }
    next(error);
  }
};
const batchProcess = async (items, batchSize, processFn) => {
  const results = [];
  const totalItems = items.length;
  const totalBatches = Math.ceil(totalItems / batchSize);
  console.log(
    `Starting batch processing of ${totalItems} items in ${totalBatches} batches`
  );
  for (let i = 0; i < totalItems; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    console.log(
      `Processing batch ${batchNumber}/${totalBatches} (${batch.length} items)`
    );
    const batchResults = await processFn(batch);
    if (Array.isArray(batchResults)) {
      results.push(...batchResults);
    } else {
      results.push(batchResults);
    }
    if (i + batchSize < totalItems) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  return results;
};
exports.importLeads = async (req, res, next) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a file",
      });
    }
    const file = req.files.file;
    const fileExtension = file.name.split(".").pop().toLowerCase();
    if (!["csv", "json"].includes(fileExtension)) {
      return res.status(400).json({
        success: false,
        message: "Please upload a CSV or JSON file",
      });
    }
    let leads = [];
    if (fileExtension === "csv") {
      const results = [];
      const stream = Readable.from(file.data.toString());
      await new Promise((resolve, reject) => {
        stream
          .pipe(csvParser())
          .on("data", (data) => results.push(data))
          .on("error", (error) => reject(error))
          .on("end", () => resolve());
      });
      leads = results;
    } else {
      try {
        leads = JSON.parse(file.data.toString());
        if (!Array.isArray(leads)) {
          leads = [leads];
        }
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: "Invalid JSON format",
        });
      }
    }
    const parseDate = (dateString) => {
      if (!dateString) return null;
      const parts = dateString.split("/");
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const year = parseInt(parts[2]);
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          return new Date(year, month, day);
        }
      }
      const parsed = new Date(dateString);
      return isNaN(parsed.getTime()) ? null : parsed;
    };
    const normalizeGender = (gender) => {
      if (!gender) return "not_defined";
      const genderLower = gender.toLowerCase();
      if (genderLower === "male" || genderLower === "m") return "male";
      if (genderLower === "female" || genderLower === "f") return "female";
      return "not_defined";
    };
    const processedLeads = leads.map((lead) => {
      const leadData = {
        firstName:
          lead.firstName ||
          lead.first_name ||
          lead["First name"] ||
          lead["first name"] ||
          "",
        lastName:
          lead.lastName ||
          lead.last_name ||
          lead["Last name"] ||
          lead["last name"] ||
          "",
        newEmail:
          lead.email ||
          lead.newEmail ||
          lead.Email ||
          lead["Email"] ||
          lead["new email"] ||
          "",
        oldEmail: lead.oldEmail || lead["old email"] || "",
        newPhone:
          lead.phone ||
          lead.newPhone ||
          lead["Phone number"] ||
          lead["phone number"] ||
          lead.Phone ||
          lead["new phone"] ||
          "",
        oldPhone: lead.oldPhone || lead["old phone"] || "",
        country: lead.country || lead.Country || lead.GEO || lead.geo || "",
        gender: normalizeGender(lead.gender || lead.Gender || ""),
        prefix: lead.prefix || lead.Prefix || "",
        dob: parseDate(lead.dob || lead.DOB || lead["Date of birth"] || ""),
        address: lead.address || lead.Address || "",
        leadType:
          req.body.leadType || lead.leadType || lead.lead_type || "cold",
        createdBy: req.user.id,
      };
      const socialMedia = {};
      if (lead.Facebook || lead.facebook)
        socialMedia.facebook = lead.Facebook || lead.facebook;
      if (lead.Twitter || lead.twitter)
        socialMedia.twitter = lead.Twitter || lead.twitter;
      if (lead.Linkedin || lead.linkedin)
        socialMedia.linkedin = lead.Linkedin || lead.linkedin;
      if (lead.Instagram || lead.instagram)
        socialMedia.instagram = lead.Instagram || lead.instagram;
      if (lead.Telegram || lead.telegram)
        socialMedia.telegram = lead.Telegram || lead.telegram;
      if (lead.WhatsApp || lead.whatsapp)
        socialMedia.whatsapp = lead.WhatsApp || lead.whatsapp;
      if (Object.keys(socialMedia).length > 0) {
        leadData.socialMedia = socialMedia;
      }
      const documents = [];
      const idFront = lead["ID front"] || lead["id front"] || lead.id_front;
      const idBack = lead["ID back"] || lead["id back"] || lead.id_back;
      const selfieFront =
        lead["Selfie front"] || lead["selfie front"] || lead.selfie_front;
      const selfieBack =
        lead["Selfie back"] || lead["selfie back"] || lead.selfie_back;
      if (idFront && idFront.trim()) {
        documents.push({
          url: idFront.trim(),
          description: "ID Front",
        });
      }
      if (idBack && idBack.trim()) {
        documents.push({
          url: idBack.trim(),
          description: "ID Back",
        });
      }
      if (selfieFront && selfieFront.trim()) {
        documents.push({
          url: selfieFront.trim(),
          description: "Selfie with ID Front",
        });
      }
      if (selfieBack && selfieBack.trim()) {
        documents.push({
          url: selfieBack.trim(),
          description: "Selfie with ID Back",
        });
      }
      if (documents.length > 0) {
        leadData.documents = documents;
      }
      if (leadData.leadType === "ftd") {
        const sinValue =
          lead.sin || lead.SIN || lead["Social Insurance Number"] || "";
        if (sinValue && sinValue.trim().length > 0) {
          leadData.sin = sinValue.trim();
        }
      }
      return leadData;
    });
    const validLeads = processedLeads.filter(
      (lead) =>
        lead.firstName && lead.newEmail && (lead.newPhone || lead.country)
    );
    console.log(`Total leads parsed: ${processedLeads.length}`);
    console.log(`Valid leads after filtering: ${validLeads.length}`);
    if (processedLeads.length > 0) {
      console.log("Sample parsed lead:", processedLeads[0]);
      console.log("Raw lead data sample:", leads[0]);
    }
    if (validLeads.length > 0) {
      console.log("Sample valid lead:", validLeads[0]);
    } else {
      console.log("Invalid leads sample (first 5):");
      processedLeads.slice(0, 5).forEach((lead, index) => {
        console.log(`Lead ${index + 1}:`, {
          firstName: lead.firstName,
          newEmail: lead.newEmail,
          newPhone: lead.newPhone,
          country: lead.country,
          isValid: !!(
            lead.firstName &&
            lead.newEmail &&
            (lead.newPhone || lead.country)
          ),
          validationDetails: {
            hasFirstName: !!lead.firstName,
            hasEmail: !!lead.newEmail,
            hasPhoneOrCountry: !!(lead.newPhone || lead.country),
          },
        });
      });
    }
    if (validLeads.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid leads found in the file",
      });
    }
    const BATCH_SIZE = 100;
    const savedLeads = await batchProcess(
      validLeads,
      BATCH_SIZE,
      async (batch) => {
        const emails = batch.map((lead) => lead.newEmail);
        const existingEmails = await Lead.distinct("newEmail", {
          newEmail: { $in: emails },
        });

        // Check for existing leads with matching first name and last name
        const nameChecks = batch.map((lead) => ({
          firstName: lead.firstName,
          lastName: lead.lastName,
        }));

        const existingNameCombinations = await Lead.find({
          $or: nameChecks,
        }).select("firstName lastName newEmail");

        const existingNamePairs = new Set(
          existingNameCombinations.map(
            (lead) =>
              `${lead.firstName.toLowerCase()}|${lead.lastName.toLowerCase()}`
          )
        );

        console.log(`Batch processing: ${batch.length} leads in batch`);
        console.log(
          `Found ${existingEmails.length} existing emails:`,
          existingEmails.slice(0, 5)
        );
        console.log(
          `Found ${existingNamePairs.size} existing name combinations:`,
          Array.from(existingNamePairs).slice(0, 5)
        );

        const newLeads = batch.filter((lead) => {
          const emailExists = existingEmails.includes(lead.newEmail);
          const nameExists = existingNamePairs.has(
            `${lead.firstName.toLowerCase()}|${lead.lastName.toLowerCase()}`
          );

          if (emailExists) {
            console.log(`Skipping lead with duplicate email: ${lead.newEmail}`);
          }
          if (nameExists) {
            console.log(
              `Skipping lead with duplicate name: ${lead.firstName} ${lead.lastName}`
            );
          }

          return !emailExists && !nameExists;
        });
        console.log(
          `After duplicate filtering: ${newLeads.length} new leads to insert`
        );
        if (newLeads.length === 0) {
          console.log("No new leads to insert - all were duplicates");
          return [];
        }
        console.log(`Inserting ${newLeads.length} new leads...`);
        try {
          const result = await Lead.insertMany(newLeads, {
            ordered: false, // Continue inserting even if some fail
            rawResult: true,
          });
          console.log("Insert result:", result);

          // Handle validation errors
          if (
            result.mongoose &&
            result.mongoose.validationErrors &&
            result.mongoose.validationErrors.length > 0
          ) {
            console.log("Validation errors found:");
            result.mongoose.validationErrors
              .slice(0, 3)
              .forEach((error, index) => {
                console.log(`Validation error ${index + 1}:`, error.message);
                console.log("Error details:", error);
              });
          }

          return result;
        } catch (error) {
          // Handle bulk write errors (including duplicates)
          if (error.name === "BulkWriteError" || error.code === 11000) {
            console.log(
              `Bulk write completed with ${
                error.result?.nInserted || 0
              } successful insertions`
            );
            console.log(
              `${error.writeErrors?.length || 0} duplicates were skipped`
            );

            return {
              insertedCount: error.result?.nInserted || 0,
              writeErrors: error.writeErrors || [],
            };
          }
          throw error; // Re-throw other errors
        }
      }
    );
    let importCount = 0;
    let duplicateCount = 0;

    savedLeads.forEach((result) => {
      if (result.insertedCount) {
        importCount += result.insertedCount;
      }
      // Handle any duplicates that were caught at the database level
      if (result.writeErrors) {
        result.writeErrors.forEach((error) => {
          if (error.code === 11000) {
            duplicateCount++;
          }
        });
      }
    });

    const totalProcessed = validLeads.length;
    const skippedCount = totalProcessed - importCount - duplicateCount;

    res.status(200).json({
      success: true,
      message: `${importCount} leads imported successfully. ${
        skippedCount + duplicateCount
      } duplicates were skipped.`,
      stats: {
        imported: importCount,
        duplicatesSkipped: skippedCount + duplicateCount,
        totalProcessed: totalProcessed,
      },
    });
  } catch (error) {
    // Only return error for actual system errors, not duplicates
    if (error.code === 11000) {
      // This shouldn't happen now since we pre-filter, but just in case
      return res.status(200).json({
        success: true,
        message: "Import completed. Some leads were skipped due to duplicates.",
        stats: {
          imported: 0,
          duplicatesSkipped: validLeads.length,
          totalProcessed: validLeads.length,
        },
      });
    }
    next(error);
  }
};
exports.deleteLead = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete leads",
      });
    }
    await lead.deleteOne();
    res.status(200).json({
      success: true,
      message: "Lead deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

exports.bulkDeleteLeads = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete leads",
      });
    }
    const {
      leadType,
      country,
      gender,
      status,
      documentStatus,
      isAssigned,
      search,
    } = req.body;
    const filter = {};
    if (leadType) filter.leadType = leadType;
    if (country) filter.country = new RegExp(country, "i");
    if (gender) filter.gender = gender;
    if (status) filter.status = status;
    if (documentStatus) filter["documents.status"] = documentStatus;
    if (isAssigned !== undefined && isAssigned !== "") {
      const isAssignedBool = isAssigned === "true" || isAssigned === true;
      filter.assignedAgent = isAssignedBool ? { $ne: null } : null;
    }
    if (search) {
      filter.$or = [
        { firstName: new RegExp(search, "i") },
        { lastName: new RegExp(search, "i") },
        { newEmail: new RegExp(search, "i") },
        { oldEmail: new RegExp(search, "i") },
        { newPhone: new RegExp(search, "i") },
        { oldPhone: new RegExp(search, "i") },
      ];
    }
    const result = await Lead.deleteMany(filter);
    res.status(200).json({
      success: true,
      message: `${result.deletedCount} leads deleted successfully`,
      data: {
        deletedCount: result.deletedCount,
      },
    });
  } catch (error) {
    next(error);
  }
};
exports.assignCampaignToLead = async (req, res, next) => {
  try {
    const { campaignId, orderId } = req.body;
    const leadId = req.params.id;
    if (!campaignId) {
      return res.status(400).json({
        success: false,
        message: "Campaign ID is required - campaign assignment is mandatory",
      });
    }
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }
    const Campaign = require("../models/Campaign");
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }
    if (!campaign.isActive || campaign.status !== "active") {
      return res.status(400).json({
        success: false,
        message:
          "Cannot assign inactive campaign - only active campaigns can be assigned",
      });
    }
    if (req.user.role === "affiliate_manager") {
      const isAssigned = campaign.assignedAffiliateManagers.some(
        (managerId) => managerId.toString() === req.user._id.toString()
      );
      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: "Access denied - campaign not assigned to you",
        });
      }
    }
    let order = null;
    if (orderId) {
      const Order = require("../models/Order");
      order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }
    }
    const campaignAssignment = {
      campaign: campaignId,
      assignedBy: req.user._id,
      assignedAt: new Date(),
      order: orderId || null,
      performance: {
        status: "assigned",
        assignedAt: new Date(),
      },
    };
    if (!lead.campaignHistory) {
      lead.campaignHistory = [];
    }
    const existingAssignment = lead.campaignHistory.find(
      (history) => history.campaign.toString() === campaignId.toString()
    );
    if (existingAssignment) {
      existingAssignment.assignedBy = req.user._id;
      existingAssignment.assignedAt = new Date();
      if (orderId) {
        existingAssignment.order = orderId;
      }
      existingAssignment.performance.status = "reassigned";
      existingAssignment.performance.assignedAt = new Date();
    } else {
      lead.campaignHistory.push(campaignAssignment);
    }
    await lead.save();
    await campaign.updateMetrics();
    await lead.populate([
      {
        path: "campaignHistory.campaign",
        select: "name status",
      },
      {
        path: "campaignHistory.assignedBy",
        select: "fullName email",
      },
      {
        path: "campaignHistory.order",
        select: "orderNumber status",
      },
    ]);
    res.status(200).json({
      success: true,
      message: "Campaign assigned to lead successfully",
      data: {
        lead: {
          _id: lead._id,
          fullName: `${lead.firstName} ${lead.lastName}`,
          campaignHistory: lead.campaignHistory,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
exports.storeLeadSession = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }
    const { sessionData, orderId } = req.body;
    const leadId = req.params.id;
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }
    if (req.user.role === "affiliate_manager") {
      if (
        lead.assignedAgent?.toString() !== req.user._id.toString() &&
        lead.createdBy?.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "Access denied - lead not assigned to you",
        });
      }
    }
    if (orderId) {
      const Order = require("../models/Order");
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }
    }
    const integrityValidation =
      sessionSecurity.validateSessionIntegrity(sessionData);
    if (!integrityValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: "Session data validation failed",
        errors: integrityValidation.errors,
        warnings: integrityValidation.warnings,
      });
    }
    const encryptedSessionData =
      sessionSecurity.encryptSessionData(sessionData);
    const sessionId = lead.storeBrowserSession(
      encryptedSessionData,
      orderId,
      req.user._id
    );
    await lead.save();
    sessionSecurity.logSessionAccess({
      sessionId: sessionData.sessionId,
      leadId: lead._id.toString(),
      userId: req.user._id.toString(),
      userRole: req.user.role,
      action: "store",
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get("User-Agent"),
      success: true,
      metadata: {
        orderId: orderId,
        domain: sessionData.metadata?.domain,
        cookieCount: sessionData.cookies?.length || 0,
      },
    });
    res.status(201).json({
      success: true,
      message: "Session data stored and encrypted successfully",
      data: {
        leadId: lead._id,
        sessionId: sessionId,
        currentSessionId: lead.currentSessionId,
        sessionCreatedAt: sessionData.createdAt || new Date(),
        sessionMetadata: sessionData.metadata,
        encryptionStatus: "encrypted",
        integrityHash: sessionSecurity.generateSessionHash(sessionData),
      },
    });
  } catch (error) {
    console.error("Error storing session:", error);
    next(error);
  }
};
exports.getLeadSession = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }
    const leadId = req.params.id;
    const { sessionId, includeHistory = false } = req.query;
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }
    if (req.user.role === "agent") {
      if (lead.assignedAgent?.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access denied - lead not assigned to you",
        });
      }
    } else if (req.user.role === "affiliate_manager") {
      if (
        lead.assignedAgent?.toString() !== req.user._id.toString() &&
        lead.createdBy?.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "Access denied - lead not assigned to you",
        });
      }
    }
    let encryptedSessionData;
    if (sessionId) {
      encryptedSessionData = lead.getSessionById(sessionId);
    } else {
      encryptedSessionData = lead.getCurrentBrowserSession();
    }
    if (!encryptedSessionData) {
      sessionSecurity.logSessionAccess({
        sessionId: sessionId || "unknown",
        leadId: leadId,
        userId: req.user._id.toString(),
        userRole: req.user.role,
        action: "access",
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get("User-Agent"),
        success: false,
        errorMessage: sessionId
          ? "Session not found"
          : "No active session found",
      });
      return res.status(404).json({
        success: false,
        message: sessionId
          ? "Session not found"
          : "No active session found for this lead",
      });
    }
    let sessionData;
    try {
      sessionData = sessionSecurity.decryptSessionData(encryptedSessionData);
    } catch (decryptionError) {
      console.error("❌ Session decryption failed:", decryptionError);
      sessionSecurity.logSessionAccess({
        sessionId: encryptedSessionData.sessionId || "unknown",
        leadId: leadId,
        userId: req.user._id.toString(),
        userRole: req.user.role,
        action: "access",
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get("User-Agent"),
        success: false,
        errorMessage: "Session decryption failed",
      });
      return res.status(500).json({
        success: false,
        message: "Failed to decrypt session data",
      });
    }
    const integrityValidation =
      sessionSecurity.validateSessionIntegrity(sessionData);
    if (!integrityValidation.isValid) {
      console.warn(
        "⚠️ Session integrity validation failed:",
        integrityValidation.errors
      );
      if (integrityValidation.isTampered) {
        sessionSecurity.logSessionAccess({
          sessionId: sessionData.sessionId,
          leadId: leadId,
          userId: req.user._id.toString(),
          userRole: req.user.role,
          action: "access",
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get("User-Agent"),
          success: false,
          errorMessage: "Session appears to be tampered with",
        });
        return res.status(400).json({
          success: false,
          message: "Session data appears to be tampered with",
        });
      }
    }
    const responseData = {
      leadId,
      currentSession: {
        sessionId: sessionData.sessionId,
        createdAt: sessionData.createdAt,
        lastAccessedAt: sessionData.lastAccessedAt,
        isActive: sessionData.isActive,
        metadata: sessionData.metadata,
        userAgent: sessionData.userAgent,
        viewport: sessionData.viewport,
        cookieCount: sessionData.cookies?.length || 0,
        localStorageItemCount: sessionData.localStorage
          ? Object.keys(sessionData.localStorage).length
          : 0,
        sessionStorageItemCount: sessionData.sessionStorage
          ? Object.keys(sessionData.sessionStorage).length
          : 0,
        integrityHash: sessionSecurity.generateSessionHash(sessionData),
      },
      hasActiveSession: lead.hasActiveBrowserSession(),
      validationResult: {
        isValid: integrityValidation.isValid,
        warnings: integrityValidation.warnings,
        isExpired: integrityValidation.isExpired,
      },
    };
    if (includeHistory === "true" || includeHistory === true) {
      const sessionHistory = lead.sessionHistory || [];
      responseData.sessionHistory = sessionHistory.map((encryptedSession) => {
        try {
          const decryptedSession =
            sessionSecurity.decryptSessionData(encryptedSession);
          return {
            sessionId: decryptedSession.sessionId,
            createdAt: decryptedSession.createdAt,
            lastAccessedAt: decryptedSession.lastAccessedAt,
            isActive: decryptedSession.isActive,
            metadata: decryptedSession.metadata,
            cookieCount: decryptedSession.cookies?.length || 0,
            integrityHash:
              sessionSecurity.generateSessionHash(decryptedSession),
          };
        } catch (error) {
          console.error("❌ Failed to decrypt session history item:", error);
          return {
            sessionId: encryptedSession.sessionId || "unknown",
            error: "Failed to decrypt session data",
          };
        }
      });
    }
    lead.updateSessionAccess(sessionData.sessionId);
    await lead.save();
    sessionSecurity.logSessionAccess({
      sessionId: sessionData.sessionId,
      leadId: leadId,
      userId: req.user._id.toString(),
      userRole: req.user.role,
      action: "access",
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get("User-Agent"),
      success: true,
      metadata: {
        domain: sessionData.metadata?.domain,
        cookieCount: sessionData.cookies?.length || 0,
      },
    });
    res.status(200).json({
      success: true,
      message: "Session data retrieved successfully",
      data: responseData,
    });
  } catch (error) {
    console.error("Error retrieving session:", error);
    next(error);
  }
};
exports.updateLeadSession = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }
    const leadId = req.params.id;
    const { sessionId, sessionData, isActive, metadata } = req.body;
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }
    if (req.user.role === "affiliate_manager") {
      if (
        lead.assignedAgent?.toString() !== req.user._id.toString() &&
        lead.createdBy?.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "Access denied - lead not assigned to you",
        });
      }
    } else if (req.user.role === "lead_manager") {
      // Lead managers can update sessions for all leads (no filtering)
    }
    let sessionToUpdate = null;
    let isCurrentSession = false;
    if (lead.browserSession && lead.browserSession.sessionId === sessionId) {
      sessionToUpdate = lead.browserSession;
      isCurrentSession = true;
    } else {
      const historySession = lead.sessionHistory?.find(
        (session) => session.sessionId === sessionId
      );
      if (historySession) {
        sessionToUpdate = historySession;
      }
    }
    if (!sessionToUpdate) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }
    if (sessionData) {
      if (sessionData.cookies) sessionToUpdate.cookies = sessionData.cookies;
      if (sessionData.localStorage)
        sessionToUpdate.localStorage = sessionData.localStorage;
      if (sessionData.sessionStorage)
        sessionToUpdate.sessionStorage = sessionData.sessionStorage;
      if (sessionData.userAgent)
        sessionToUpdate.userAgent = sessionData.userAgent;
      if (sessionData.viewport) sessionToUpdate.viewport = sessionData.viewport;
    }
    if (typeof isActive === "boolean") {
      sessionToUpdate.isActive = isActive;
      if (!isActive && isCurrentSession) {
        lead.currentSessionId = null;
      }
      if (isActive && !isCurrentSession) {
        if (lead.browserSession) {
          lead.browserSession.isActive = false;
        }
        lead.browserSession = sessionToUpdate;
        lead.currentSessionId = sessionId;
        lead.sessionHistory =
          lead.sessionHistory?.filter(
            (session) => session.sessionId !== sessionId
          ) || [];
      }
    }
    if (metadata) {
      sessionToUpdate.metadata = { ...sessionToUpdate.metadata, ...metadata };
    }
    sessionToUpdate.lastAccessedAt = new Date();
    await lead.save();
    res.status(200).json({
      success: true,
      message: "Session updated successfully",
      data: {
        leadId,
        sessionId,
        isActive: sessionToUpdate.isActive,
        lastAccessedAt: sessionToUpdate.lastAccessedAt,
        isCurrentSession: lead.currentSessionId === sessionId,
      },
    });
  } catch (error) {
    console.error("Error updating session:", error);
    next(error);
  }
};
exports.clearLeadSession = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }
    const leadId = req.params.id;
    const { sessionId, clearAll = false } = req.query;
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }
    if (req.user.role === "affiliate_manager") {
      if (
        lead.assignedAgent?.toString() !== req.user._id.toString() &&
        lead.createdBy?.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "Access denied - lead not assigned to you",
        });
      }
    }
    let clearedSessions = 0;
    let message = "";
    if (clearAll === "true" || clearAll === true) {
      if (lead.browserSession) {
        lead.browserSession = undefined;
        clearedSessions++;
      }
      if (lead.sessionHistory && lead.sessionHistory.length > 0) {
        clearedSessions += lead.sessionHistory.length;
        lead.sessionHistory = [];
      }
      lead.currentSessionId = null;
      message = `All ${clearedSessions} sessions cleared successfully`;
    } else if (sessionId) {
      let sessionFound = false;
      if (lead.browserSession && lead.browserSession.sessionId === sessionId) {
        lead.browserSession = undefined;
        lead.currentSessionId = null;
        clearedSessions = 1;
        sessionFound = true;
      } else {
        const initialLength = lead.sessionHistory?.length || 0;
        lead.sessionHistory =
          lead.sessionHistory?.filter(
            (session) => session.sessionId !== sessionId
          ) || [];
        if (lead.sessionHistory.length < initialLength) {
          clearedSessions = 1;
          sessionFound = true;
        }
      }
      if (!sessionFound) {
        return res.status(404).json({
          success: false,
          message: "Session not found",
        });
      }
      message = "Session cleared successfully";
    } else {
      if (lead.browserSession) {
        lead.browserSession = undefined;
        lead.currentSessionId = null;
        clearedSessions = 1;
        message = "Current session cleared successfully";
      } else {
        return res.status(404).json({
          success: false,
          message: "No active session to clear",
        });
      }
    }
    await lead.save();
    res.status(200).json({
      success: true,
      message,
      data: {
        leadId,
        clearedSessions,
        hasActiveSession: !!lead.browserSession,
        remainingSessions: lead.sessionHistory?.length || 0,
      },
    });
  } catch (error) {
    console.error("Error clearing session:", error);
    next(error);
  }
};
exports.updateLeadCallNumber = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const { callNumber, notes, orderId, verified } = req.body;
    const leadId = req.params.id;

    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // Access control - agents can only update leads assigned to them
    if (req.user.role === "agent") {
      if (
        !lead.assignedAgent ||
        lead.assignedAgent.toString() !== req.user.id
      ) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to update this lead",
        });
      }
    } else if (req.user.role === "affiliate_manager") {
      // Affiliate managers can update leads from their orders or assigned to them
      const leadWithOrder = await Lead.findById(leadId).populate(
        "orderId",
        "requester"
      );
      const hasAccess =
        (leadWithOrder.orderId &&
          leadWithOrder.orderId.requester &&
          leadWithOrder.orderId.requester.toString() === req.user.id) ||
        (leadWithOrder.assignedTo &&
          leadWithOrder.assignedTo.toString() === req.user.id);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message:
            "Affiliate managers can only update leads from their orders or leads assigned to them",
        });
      }
    } else if (req.user.role === "lead_manager") {
      // Lead managers can update all leads (no filtering)
    } else if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update leads",
      });
    }

    // Update call number per order
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "orderId is required to update call number",
      });
    }

    // Get current call number and verification status for this order
    const currentCallNumber = lead.getOrderCallNumber(orderId);
    const currentVerified = lead.getOrderVerified(orderId);

    // For agents, validate that call changes are reasonable (can go forward or backward, but not skip multiple steps)
    if (req.user.role === "agent" && callNumber) {
      const callSequence = ["1st", "2nd", "3rd", "4th", "5th"];
      const currentIndex = currentCallNumber
        ? callSequence.indexOf(currentCallNumber)
        : -1;
      const newIndex = callSequence.indexOf(callNumber);

      // Allow moving to adjacent calls (previous, current, or next)
      // or setting first call when no call exists
      if (currentIndex === -1) {
        // No current call - can only set to 1st call
        if (newIndex !== 0) {
          return res.status(400).json({
            success: false,
            message: `You must start with 1st call. Current call: None. Expected: 1st call.`,
          });
        }
      } else {
        // Has a current call - can move to previous, stay at current, or move to next
        const allowedIndexes = [
          currentIndex - 1, // previous
          currentIndex, // current (no change)
          currentIndex + 1, // next
        ].filter((idx) => idx >= 0 && idx < callSequence.length);

        if (!allowedIndexes.includes(newIndex)) {
          return res.status(400).json({
            success: false,
            message: `You can only move one step at a time. Current call: ${currentCallNumber}. You can choose: ${allowedIndexes
              .map((i) => callSequence[i])
              .join(", ")} or None.`,
          });
        }
      }
    }

    // For agents, create a request instead of directly updating
    if (req.user.role === "agent") {
      // Check if there's already a pending request for this lead/order
      const existingRequest = await CallChangeRequest.findOne({
        leadId: leadId,
        orderId: orderId,
        status: "pending",
      });

      if (existingRequest) {
        return res.status(400).json({
          success: false,
          message:
            "There is already a pending call change request for this lead and order.",
        });
      }

      // Create a new call change request
      const callChangeRequest = new CallChangeRequest({
        leadId: leadId,
        orderId: orderId,
        requestedBy: req.user.id,
        currentCallNumber: currentCallNumber,
        requestedCallNumber:
          callNumber !== undefined ? callNumber || null : currentCallNumber,
        currentVerified: currentVerified,
        requestedVerified: verified !== undefined ? verified : currentVerified,
      });

      await callChangeRequest.save();

      return res.status(200).json({
        success: true,
        message:
          "Call change request submitted successfully. Waiting for approval.",
        isPending: true,
        data: {
          requestId: callChangeRequest._id,
          leadId: lead._id,
          orderId: orderId,
          currentCallNumber: currentCallNumber,
          requestedCallNumber: callNumber || null,
          currentVerified: currentVerified,
          requestedVerified:
            verified !== undefined ? verified : currentVerified,
        },
      });
    }

    // For admin and affiliate_manager, directly update
    lead.updateOrderCallNumber(
      orderId,
      callNumber || null,
      req.user.id,
      verified
    );
    await lead.save();

    res.status(200).json({
      success: true,
      message: "Call number updated successfully for order",
      data: {
        leadId: lead._id,
        orderId: orderId,
        callNumber: callNumber || null,
        verified: verified !== undefined ? verified : currentVerified,
        orderCallTracking: lead.getAllOrderCallTracking(),
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.accessLeadSession = async (req, res, next) => {
  try {
    const leadId = req.params.id;
    const userAgent = req.get("User-Agent");
    const ipAddress = req.ip || req.connection.remoteAddress;
    sessionSecurity.logSessionAccess({
      sessionId: "pending",
      leadId: leadId,
      userId: req.user._id.toString(),
      userRole: req.user.role,
      action: "access_attempt",
      ipAddress: ipAddress,
      userAgent: userAgent,
      success: true,
      metadata: {
        requestType: "session_restoration",
      },
    });
    const lead = await Lead.findById(leadId);
    if (!lead) {
      console.log(`❌ Session access denied - Lead not found: ${leadId}`);
      sessionSecurity.logSessionAccess({
        sessionId: "unknown",
        leadId: leadId,
        userId: req.user._id.toString(),
        userRole: req.user.role,
        action: "access",
        ipAddress: ipAddress,
        userAgent: userAgent,
        success: false,
        errorMessage: "Lead not found",
      });
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }
    if (req.user.role === "agent") {
      if (lead.assignedAgent?.toString() !== req.user._id.toString()) {
        console.log(
          `❌ Session access denied - Agent ${req.user._id} not assigned to lead ${leadId}`
        );
        sessionSecurity.logSessionAccess({
          sessionId: "unknown",
          leadId: leadId,
          userId: req.user._id.toString(),
          userRole: req.user.role,
          action: "access",
          ipAddress: ipAddress,
          userAgent: userAgent,
          success: false,
          errorMessage: "Access denied - lead not assigned",
        });
        return res.status(403).json({
          success: false,
          message: "Access denied - lead not assigned to you",
        });
      }
    } else if (req.user.role === "affiliate_manager") {
      if (
        lead.assignedAgent?.toString() !== req.user._id.toString() &&
        lead.createdBy?.toString() !== req.user._id.toString()
      ) {
        console.log(
          `❌ Session access denied - Affiliate manager ${req.user._id} not authorized for lead ${leadId}`
        );
        sessionSecurity.logSessionAccess({
          sessionId: "unknown",
          leadId: leadId,
          userId: req.user._id.toString(),
          userRole: req.user.role,
          action: "access",
          ipAddress: ipAddress,
          userAgent: userAgent,
          success: false,
          errorMessage: "Access denied - not authorized for lead",
        });
        return res.status(403).json({
          success: false,
          message: "Access denied - lead not assigned to you",
        });
      }
    }
    if (!lead.hasActiveBrowserSession()) {
      console.log(
        `❌ Session access denied - No active session for lead ${leadId}`
      );
      sessionSecurity.logSessionAccess({
        sessionId: "none",
        leadId: leadId,
        userId: req.user._id.toString(),
        userRole: req.user.role,
        action: "access",
        ipAddress: ipAddress,
        userAgent: userAgent,
        success: false,
        errorMessage: "No active session found",
      });
      return res.status(404).json({
        success: false,
        message: "No active session found for this lead",
      });
    }
    const encryptedSessionData = lead.getCurrentBrowserSession();
    let sessionData;
    try {
      sessionData = sessionSecurity.decryptSessionData(encryptedSessionData);
    } catch (decryptionError) {
      console.error("❌ Session decryption failed:", decryptionError);
      sessionSecurity.logSessionAccess({
        sessionId: encryptedSessionData.sessionId || "unknown",
        leadId: leadId,
        userId: req.user._id.toString(),
        userRole: req.user.role,
        action: "access",
        ipAddress: ipAddress,
        userAgent: userAgent,
        success: false,
        errorMessage: "Session decryption failed",
      });
      return res.status(500).json({
        success: false,
        message: "Failed to decrypt session data",
      });
    }
    const integrityValidation =
      sessionSecurity.validateSessionIntegrity(sessionData);
    if (!integrityValidation.isValid) {
      console.log(
        `❌ Session access denied - Invalid session for lead ${leadId}:`,
        integrityValidation.errors
      );
      sessionSecurity.logSessionAccess({
        sessionId: sessionData.sessionId,
        leadId: leadId,
        userId: req.user._id.toString(),
        userRole: req.user.role,
        action: "access",
        ipAddress: ipAddress,
        userAgent: userAgent,
        success: false,
        errorMessage: `Session validation failed: ${integrityValidation.errors.join(
          ", "
        )}`,
      });
      if (integrityValidation.isTampered) {
        return res.status(400).json({
          success: false,
          message: "Session data appears to be tampered with",
        });
      }
      return res.status(400).json({
        success: false,
        message: `Session is invalid: ${integrityValidation.errors.join(", ")}`,
      });
    }
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    if (
      sessionData.lastAccessedAt &&
      sessionData.lastAccessedAt > fiveMinutesAgo
    ) {
      const remainingTime = Math.ceil(
        (sessionData.lastAccessedAt.getTime() + 5 * 60 * 1000 - now.getTime()) /
          1000
      );
      console.log(
        `⏰ Session access rate limited for lead ${leadId} - ${remainingTime}s remaining`
      );
      sessionSecurity.logSessionAccess({
        sessionId: sessionData.sessionId,
        leadId: leadId,
        userId: req.user._id.toString(),
        userRole: req.user.role,
        action: "access",
        ipAddress: ipAddress,
        userAgent: userAgent,
        success: false,
        errorMessage: "Rate limited - too many recent access attempts",
      });
      return res.status(429).json({
        success: false,
        message: `Session was recently accessed. Please wait ${remainingTime} seconds before accessing again.`,
        retryAfter: remainingTime,
      });
    }
    lead.updateSessionAccess(sessionData.sessionId);
    await lead.save();
    sessionSecurity.logSessionAccess({
      sessionId: sessionData.sessionId,
      leadId: leadId,
      userId: req.user._id.toString(),
      userRole: req.user.role,
      action: "access",
      ipAddress: ipAddress,
      userAgent: userAgent,
      success: true,
      metadata: {
        domain: sessionData.metadata?.domain,
        cookieCount: sessionData.cookies?.length || 0,
        integrityHash: sessionSecurity.generateSessionHash(sessionData),
      },
    });
    // Check if EC2 GUI Browser service is available (production mode)
    const EC2_GUI_BROWSER_URL = process.env.EC2_GUI_BROWSER_URL;
    const isProduction =
      process.env.NODE_ENV === "production" || EC2_GUI_BROWSER_URL;

    if (
      isProduction &&
      EC2_GUI_BROWSER_URL &&
      EC2_GUI_BROWSER_URL !== "http://your-ec2-ip:3001"
    ) {
      // Use GUI Browser service for production
      const axios = require("axios");

      try {
        console.log(
          `🚀 Creating GUI browser session via EC2 service for lead ${leadId}`
        );

        const response = await axios.post(
          `${EC2_GUI_BROWSER_URL}/sessions`,
          {
            sessionId: sessionData.sessionId,
            leadId: leadId,
            cookies: sessionData.cookies,
            localStorage: sessionData.localStorage,
            sessionStorage: sessionData.sessionStorage,
            userAgent: sessionData.userAgent,
            viewport: sessionData.viewport,
            domain: sessionData.metadata?.domain,
            leadInfo: {
              firstName: lead.firstName,
              lastName: lead.lastName,
              email: lead.newEmail,
              phone: lead.newPhone,
              country: lead.country,
              countryCode: lead.countryCode,
            },
          },
          {
            timeout: 30000,
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (response.data.success) {
          console.log(
            `✅ GUI browser session created successfully for lead ${leadId}`
          );

          sessionSecurity.logSessionAccess({
            sessionId: sessionData.sessionId,
            leadId: leadId,
            userId: req.user._id.toString(),
            userRole: req.user.role,
            action: "gui_browser_session_created",
            ipAddress: ipAddress,
            userAgent: userAgent,
            success: true,
            metadata: {
              domain: sessionData.metadata?.domain,
              sessionStatus: response.data.sessionStatus,
            },
          });

          res.status(200).json({
            success: true,
            message: "GUI browser session created successfully!",
            data: {
              leadId,
              sessionId: sessionData.sessionId,
              domain: sessionData.metadata?.domain,
              lastAccessedAt: new Date(),
              sessionStatus: response.data.sessionStatus,
              leadInfo: {
                name: `${lead.firstName} ${lead.lastName}`,
                email: lead.newEmail,
              },
              securityStatus: {
                encrypted: true,
                validated: true,
                integrityHash: sessionSecurity.generateSessionHash(sessionData),
              },
              instructions: {
                title: "Access Your GUI Browser Session",
                steps: [
                  "The browser session has been created",
                  "The browser will open with your lead's session restored",
                  "Fill out forms and interact normally",
                  "Monitor the session status",
                  "Close the session when finished",
                ],
              },
            },
          });
          return; // Exit early if GUI browser succeeds
        } else {
          throw new Error(
            response.data.message || "Failed to create GUI browser session"
          );
        }
      } catch (guiError) {
        console.error(
          `❌ GUI browser session creation failed for lead ${leadId}:`,
          guiError.message
        );

        sessionSecurity.logSessionAccess({
          sessionId: sessionData.sessionId,
          leadId: leadId,
          userId: req.user._id.toString(),
          userRole: req.user.role,
          action: "gui_browser_session_failed",
          ipAddress: ipAddress,
          userAgent: userAgent,
          success: false,
          errorMessage: `GUI browser failed: ${guiError.message}`,
        });

        // Fall back to local script if GUI service fails
        console.log(`⚠️ Falling back to local script for lead ${leadId}`);
      }
    }

    // Launch local session restoration script (development mode or fallback)
    const { spawn } = require("child_process");
    const path = require("path");
    const scriptPath = path.join(__dirname, "../../agent_session_browser.py");
    const sessionDataForScript = {
      leadId: lead._id.toString(),
      sessionId: sessionData.sessionId,
      cookies: sessionData.cookies,
      localStorage: sessionData.localStorage,
      sessionStorage: sessionData.sessionStorage,
      userAgent: sessionData.userAgent,
      viewport: sessionData.viewport,
      domain: sessionData.metadata?.domain,
      leadInfo: {
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.newEmail,
        phone: lead.newPhone,
        country: lead.country,
      },
    };
    try {
      const pythonProcess = spawn(
        "python3",
        [scriptPath, JSON.stringify(sessionDataForScript)],
        {
          detached: true,
          stdio: "ignore",
        }
      );
      pythonProcess.unref();
      console.log(`🚀 Session restoration script launched for lead ${leadId}`);
      console.log(`📋 Session ID: ${sessionData.sessionId}`);
      console.log(`🌐 Domain: ${sessionData.metadata?.domain || "N/A"}`);
      sessionSecurity.logSessionAccess({
        sessionId: sessionData.sessionId,
        leadId: leadId,
        userId: req.user._id.toString(),
        userRole: req.user.role,
        action: "script_launch",
        ipAddress: ipAddress,
        userAgent: userAgent,
        success: true,
        metadata: {
          domain: sessionData.metadata?.domain,
          scriptPath: "agent_session_browser.py",
        },
      });
      res.status(200).json({
        success: true,
        message:
          "Session restoration initiated successfully. Browser window should open shortly.",
        data: {
          leadId,
          sessionId: sessionData.sessionId,
          domain: sessionData.metadata?.domain,
          lastAccessedAt: new Date(),
          leadInfo: {
            name: `${lead.firstName} ${lead.lastName}`,
            email: lead.newEmail,
          },
          securityStatus: {
            encrypted: true,
            validated: true,
            integrityHash: sessionSecurity.generateSessionHash(sessionData),
          },
        },
      });
    } catch (scriptError) {
      console.error("Error launching session restoration script:", scriptError);
      console.log(
        `❌ Script launch failed for lead ${leadId}:`,
        scriptError.message
      );
      sessionSecurity.logSessionAccess({
        sessionId: sessionData.sessionId,
        leadId: leadId,
        userId: req.user._id.toString(),
        userRole: req.user.role,
        action: "script_launch",
        ipAddress: ipAddress,
        userAgent: userAgent,
        success: false,
        errorMessage: `Script launch failed: ${scriptError.message}`,
      });
      res.status(200).json({
        success: true,
        message:
          "Session data retrieved successfully, but browser restoration script failed to launch. Please contact support.",
        data: {
          leadId,
          sessionId: sessionData.sessionId,
          domain: sessionData.metadata?.domain,
          lastAccessedAt: new Date(),
          scriptError: "Failed to launch browser restoration script",
          securityStatus: {
            encrypted: true,
            validated: true,
            integrityHash: sessionSecurity.generateSessionHash(sessionData),
          },
        },
      });
    }
  } catch (error) {
    console.error("Error accessing session:", error);
    console.log(`❌ Session access error for lead ${req.params.id}:`, {
      error: error.message,
      userId: req.user._id,
      timestamp: new Date().toISOString(),
    });
    sessionSecurity.logSessionAccess({
      sessionId: "unknown",
      leadId: req.params.id,
      userId: req.user._id.toString(),
      userRole: req.user.role,
      action: "access",
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get("User-Agent"),
      success: false,
      errorMessage: `System error: ${error.message}`,
    });
    next(error);
  }
};

// Assign leads to agent
exports.assignLeadsToAgent = async (req, res, next) => {
  try {
    const { leadIds, agentId } = req.body;

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Lead IDs array is required",
      });
    }

    // Check if this is an unassignment request (agentId is null)
    const isUnassigning = agentId === null || agentId === undefined;

    let agent = null;
    if (!isUnassigning) {
      // Verify agent exists and has agent role
      agent = await User.findById(agentId);
      if (!agent) {
        return res.status(404).json({
          success: false,
          message: "Agent not found",
        });
      }

      if (agent.role !== "agent") {
        return res.status(400).json({
          success: false,
          message: "User is not an agent",
        });
      }
    }

    const results = {
      success: [],
      failed: [],
      reassigned: [],
    };

    for (const leadId of leadIds) {
      try {
        const lead = await Lead.findById(leadId).populate(
          "assignedAgent",
          "fullName fourDigitCode"
        );

        if (!lead) {
          results.failed.push({
            leadId,
            reason: "Lead not found",
          });
          continue;
        }

        if (lead.leadType !== "ftd" && lead.leadType !== "filler") {
          results.failed.push({
            leadId,
            reason: "Only FTD and Filler leads can be assigned to agents",
          });
          continue;
        }

        if (isUnassigning) {
          // Handle unassignment
          if (!lead.assignedAgent) {
            // Already unassigned
            results.success.push({
              leadId,
              leadType: lead.leadType,
              name: `${lead.firstName} ${lead.lastName}`,
              alreadyUnassigned: true,
            });
            continue;
          }

          // Store previous agent info
          const previousAgentInfo = {
            id: lead.assignedAgent._id,
            name: lead.assignedAgent.fullName,
            code: lead.assignedAgent.fourDigitCode,
          };

          // Unassign the lead
          lead.unassignFromAgent();
          await lead.save();

          results.success.push({
            leadId,
            leadType: lead.leadType,
            name: `${lead.firstName} ${lead.lastName}`,
            unassigned: true,
            previousAgent: previousAgentInfo,
          });
        } else {
          // Handle assignment
          // Check if this is already assigned to the same agent
          if (
            lead.assignedAgent &&
            lead.assignedAgent._id.toString() === agentId
          ) {
            results.success.push({
              leadId,
              leadType: lead.leadType,
              name: `${lead.firstName} ${lead.lastName}`,
              alreadyAssigned: true,
            });
            continue;
          }

          // Store previous agent info for reassignment tracking
          const previousAgentInfo = lead.assignedAgent
            ? {
                id: lead.assignedAgent._id,
                name: lead.assignedAgent.fullName,
                code: lead.assignedAgent.fourDigitCode,
              }
            : null;

          // Assign to new agent (reassignment allowed)
          const assignmentResult = lead.assignToAgent(agentId, true);
          await assignmentResult.lead.save();

          const successData = {
            leadId,
            leadType: lead.leadType,
            name: `${lead.firstName} ${lead.lastName}`,
          };

          if (assignmentResult.isReassignment && previousAgentInfo) {
            successData.reassigned = true;
            successData.previousAgent = previousAgentInfo;
            results.reassigned.push(successData);
          } else {
            results.success.push(successData);
          }
        }
      } catch (error) {
        results.failed.push({
          leadId,
          reason: error.message,
        });
      }
    }

    const totalSuccess = results.success.length + results.reassigned.length;
    const reassignedCount = results.reassigned.length;

    let message;
    if (isUnassigning) {
      message = `Unassigned ${totalSuccess} lead(s) from their agents.`;
    } else {
      message = `Assigned ${totalSuccess} lead(s) to agent ${agent.fullName}.`;
      if (reassignedCount > 0) {
        message += ` (${reassignedCount} reassigned from other agents)`;
      }
    }
    if (results.failed.length > 0) {
      message += ` ${results.failed.length} failed.`;
    }

    res.status(200).json({
      success: true,
      message,
      data: results,
    });
  } catch (error) {
    console.error("Error assigning leads to agent:", error);
    next(error);
  }
};

// Unassign leads from agent
exports.unassignLeadsFromAgent = async (req, res, next) => {
  try {
    const { leadIds } = req.body;

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Lead IDs array is required",
      });
    }

    const results = {
      success: [],
      failed: [],
    };

    for (const leadId of leadIds) {
      try {
        const lead = await Lead.findById(leadId);

        if (!lead) {
          results.failed.push({
            leadId,
            reason: "Lead not found",
          });
          continue;
        }

        if (!lead.assignedAgent) {
          results.failed.push({
            leadId,
            reason: "Lead is not assigned to any agent",
          });
          continue;
        }

        lead.unassignFromAgent();
        await lead.save();

        results.success.push({
          leadId,
          leadType: lead.leadType,
          name: `${lead.firstName} ${lead.lastName}`,
        });
      } catch (error) {
        results.failed.push({
          leadId,
          reason: error.message,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Unassigned ${results.success.length} lead(s) from agent. ${results.failed.length} failed.`,
      data: results,
    });
  } catch (error) {
    console.error("Error unassigning leads from agent:", error);
    next(error);
  }
};

// Get leads assigned to specific agent
exports.getLeadsByAgent = async (req, res, next) => {
  try {
    const { agentId } = req.params;
    const { leadType, page = 1, limit = 50 } = req.query;

    // Verify agent exists
    const agent = await User.findById(agentId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: "Agent not found",
      });
    }

    const filter = { assignedAgent: agentId };
    if (leadType) {
      filter.leadType = leadType;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const leads = await Lead.find(filter)
      .skip(skip)
      .limit(parseInt(limit))
      .populate("assignedAgent", "fullName email")
      .sort({ assignedAgentAt: -1 });

    const total = await Lead.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        leads,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching leads by agent:", error);
    next(error);
  }
};

// Search leads by email addresses (for manual order creation)
exports.searchLeadsByEmails = async (req, res, next) => {
  try {
    const { emails } = req.body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of email addresses",
      });
    }

    // Normalize emails to lowercase and trim
    const normalizedEmails = emails.map((e) => e.trim().toLowerCase());

    // Search for leads with matching emails
    const leads = await Lead.find({
      newEmail: { $in: normalizedEmails },
    }).populate("assignedAgent", "fullName email");

    res.status(200).json({
      success: true,
      data: leads,
      meta: {
        requested: normalizedEmails.length,
        found: leads.length,
      },
    });
  } catch (error) {
    console.error("Error searching leads by emails:", error);
    next(error);
  }
};

// Archive a lead
exports.archiveLead = async (req, res, next) => {
  try {
    const { id } = req.params;

    const lead = await Lead.findById(id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    if (lead.isArchived) {
      return res.status(400).json({
        success: false,
        message: "Lead is already archived",
      });
    }

    lead.archive(req.user.id);
    await lead.save();

    res.status(200).json({
      success: true,
      message: "Lead archived successfully",
      data: lead,
    });
  } catch (error) {
    console.error("Error archiving lead:", error);
    next(error);
  }
};

// Unarchive a lead
exports.unarchiveLead = async (req, res, next) => {
  try {
    const { id } = req.params;

    const lead = await Lead.findById(id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    if (!lead.isArchived) {
      return res.status(400).json({
        success: false,
        message: "Lead is not archived",
      });
    }

    lead.unarchive();
    await lead.save();

    res.status(200).json({
      success: true,
      message: "Lead unarchived successfully",
      data: lead,
    });
  } catch (error) {
    console.error("Error unarchiving lead:", error);
    next(error);
  }
};

// Get archived leads
exports.getArchivedLeads = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, search, leadType, country } = req.query;

    const filter = { isArchived: true };

    if (leadType) filter.leadType = leadType;
    if (country) filter.country = new RegExp(country, "i");

    // Search functionality
    if (search) {
      const searchRegex = new RegExp(search, "i");
      filter.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { newEmail: searchRegex },
        { newPhone: searchRegex },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const leads = await Lead.find(filter)
      .skip(skip)
      .limit(parseInt(limit))
      .populate("assignedAgent", "fullName email fourDigitCode")
      .populate("archivedBy", "fullName email")
      .sort({ archivedAt: -1 });

    const total = await Lead.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        leads,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching archived leads:", error);
    next(error);
  }
};