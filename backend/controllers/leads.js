const { validationResult } = require("express-validator");
const mongoose = require("mongoose");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
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
const LeadAuditLog = require("../models/LeadAuditLog");
const leadSearchCache = require("../services/leadSearchCache");
const referenceCache = require("../services/referenceCache");
const { normalizePhone } = require("../utils/phoneNormalizer");

// S3 client for resolving verification photo URLs
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "eu-west-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const S3_BUCKET =
  process.env.S3_BUCKET_NAME || "creditopro-verification-sessions-2025";

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
      ipqsType,
      ipqsResult,
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

    // IPQS validation filter - filter by risk status for phone, email, or both (overall)
    if (ipqsType) {
      if (ipqsResult) {
        if (ipqsType === "phone") {
          filter["ipqsValidation.summary.phoneStatus"] = ipqsResult;
        } else if (ipqsType === "email") {
          filter["ipqsValidation.summary.emailStatus"] = ipqsResult;
        } else if (ipqsType === "both") {
          filter["ipqsValidation.summary.phoneStatus"] = ipqsResult;
          filter["ipqsValidation.summary.emailStatus"] = ipqsResult;
        }
      } else {
        // Type selected but no result filter - show all leads that have that validation
        if (ipqsType === "phone") {
          filter["ipqsValidation.summary.phoneStatus"] = { $exists: true, $ne: null };
        } else if (ipqsType === "email") {
          filter["ipqsValidation.summary.emailStatus"] = { $exists: true, $ne: null };
        } else if (ipqsType === "both") {
          filter["ipqsValidation.summary.phoneStatus"] = { $exists: true, $ne: null };
          filter["ipqsValidation.summary.emailStatus"] = { $exists: true, $ne: null };
        }
      }
    }

    // Store search keywords for use in aggregation pipeline (for assignedAgent search)
    let searchKeywords = [];
    // Flag to indicate if we're searching by ID
    let searchById = null;

    // Handle unified search - multi-keyword search with AND logic
    // Split search into multiple keywords and trim each (similar to Orders page)
    if (search) {
      // Check if the search query is a MongoDB ObjectId (24 hex characters)
      const trimmedSearch = search.trim();
      if (/^[0-9a-fA-F]{24}$/.test(trimmedSearch)) {
        // Search by lead ID directly
        searchById = new mongoose.Types.ObjectId(trimmedSearch);
        filter._id = searchById;
      }

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
    // Move assignedToMe filter into initial filter (avoids pipeline stage)
    if (req.user.role === "affiliate_manager" && assignedToMe === "true") {
      filter.assignedAgent = new mongoose.Types.ObjectId(req.user.id);
    }

    // Pre-query Order collection for order filters (avoids expensive $lookup on all docs)
    const hasOrderFilters =
      orderStatus || orderPriority || orderCreatedStart || orderCreatedEnd;
    if (hasOrderFilters) {
      const Order = require("../models/Order");
      const orderFilter = {};
      if (orderStatus) orderFilter.status = orderStatus;
      if (orderPriority) orderFilter.priority = orderPriority;
      if (orderCreatedStart || orderCreatedEnd) {
        orderFilter.createdAt = {};
        if (orderCreatedStart) {
          orderFilter.createdAt.$gte = new Date(orderCreatedStart);
        }
        if (orderCreatedEnd) {
          orderFilter.createdAt.$lte = new Date(
            orderCreatedEnd + "T23:59:59.999Z"
          );
        }
      }
      if (filter.orderId) {
        orderFilter._id = filter.orderId;
      }
      const matchingOrders = await Order.find(orderFilter)
        .select("_id")
        .lean();
      filter.orderId = { $in: matchingOrders.map((o) => o._id) };
    }

    // Pre-query for search keywords using in-memory caches for speed
    if (searchKeywords.length > 0 && !searchById) {
      const Order = require("../models/Order");

      const keywordConditions = await Promise.all(
        searchKeywords.map(async (keyword) => {
          const regex = new RegExp(keyword, "i");

          // Phase 1: In-memory lookups (no DB queries)
          const matchingAgentIds = await referenceCache.searchCollection(
            "User",
            keyword
          );
          const matchingLeadIds = await leadSearchCache.searchLeads(
            keyword,
            matchingAgentIds
          );

          // Phase 2: Order matching (small collection, fast DB query)
          const matchingOrders = await Order.find({
            $or: [{ status: regex }, { priority: regex }],
          })
            .select("_id")
            .lean();

          // Use _id index for leads matched by name/email/phone/country/agent
          // Keep regex only for low-cardinality fields not in the cache
          const orConditions = [
            { status: regex },
            { leadType: regex },
            { gender: regex },
          ];

          if (matchingLeadIds.length > 0) {
            orConditions.push({
              _id: { $in: matchingLeadIds },
            });
          }
          if (matchingOrders.length > 0) {
            orConditions.push({
              orderId: { $in: matchingOrders.map((o) => o._id) },
            });
          }

          return { $or: orConditions };
        })
      );

      if (filter.$and) {
        filter.$and.push(...keywordConditions);
      } else {
        filter.$and = keywordConditions;
      }
    }

    // Optimized pipeline: $lookup only on paginated results (10-50 docs) instead of all
    const dataPipeline = [
      { $match: filter },
      { $sort: sortOrder },
      { $skip: skip },
      { $limit: limitNum },
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
          depositConfirmed: 1,
          depositConfirmedBy: 1,
          depositConfirmedAt: 1,
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
          ipqsValidation: 1,
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

    // Run data query and count in parallel
    const [leads, total] = await Promise.all([
      Lead.aggregate(dataPipeline),
      Lead.countDocuments(filter),
    ]);

    // Populate comments.author, assignedAgent, and depositConfirmedBy for the leads
    await Lead.populate(leads, [
      {
        path: "comments.author",
        select: "fullName fourDigitCode",
      },
      {
        path: "assignedAgent",
        select: "fullName email fourDigitCode",
      },
      {
        path: "depositConfirmedBy",
        select: "fullName email",
      },
    ]);

    // Resolve s3: document URLs to signed S3 URLs
    try {
      await Promise.all(
        leads.flatMap((lead) =>
          (lead.documents || [])
            .filter((doc) => doc.url && doc.url.startsWith("s3:"))
            .map(async (doc) => {
              const s3Key = doc.url.substring(3);
              const command = new GetObjectCommand({
                Bucket: S3_BUCKET,
                Key: s3Key,
              });
              doc.url = await getSignedUrl(s3Client, command, {
                expiresIn: 3600,
              });
            })
        )
      );
    } catch (s3Error) {
      console.error(
        "[LEADS] Error resolving S3 document URLs in list:",
        s3Error.message
      );
    }

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
        "_id firstName lastName prefix newEmail newPhone country leadType status assignedAgentAt createdAt orderCallTracking orderComments clientBrokerHistory dob gender address sin socialMedia ipqsValidation"
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
          ipqsValidation: lead.ipqsValidation,
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
      .populate("orderId", "requester")
      .populate("adminActions.performedBy", "fullName email");
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

    // Resolve s3: document URLs to signed S3 URLs
    if (leadData.documents && leadData.documents.length > 0) {
      try {
        await Promise.all(
          leadData.documents.map(async (doc) => {
            if (doc.url && doc.url.startsWith("s3:")) {
              const s3Key = doc.url.substring(3); // Remove "s3:" prefix
              const command = new GetObjectCommand({
                Bucket: S3_BUCKET,
                Key: s3Key,
              });
              doc.url = await getSignedUrl(s3Client, command, {
                expiresIn: 3600,
              });
            }
          })
        );
      } catch (s3Error) {
        console.error(
          "[LEADS] Error resolving S3 document URLs:",
          s3Error.message
        );
      }
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
    const { text } = req.body;

    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // Check permissions based on user role
    if (req.user.role === "admin") {
      // Admins can comment on any lead
    } else if (req.user.role === "affiliate_manager") {
      // Affiliate managers can comment on all leads
    } else if (req.user.role === "lead_manager") {
      // Lead managers can comment on all leads
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

    // Add comment to the lead's comments array
    lead.comments.push({
      text,
      author: req.user.id,
      createdAt: new Date(),
    });
    await lead.save();

    // Populate and return all comments
    await lead.populate("comments.author", "fullName fourDigitCode");

    res.status(200).json({
      success: true,
      message: "Comment added successfully",
      data: {
        leadId: lead._id,
        comments: lead.comments,
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

    // Add audit log to associated order if exists
    if (lead.orderId) {
      const Order = require("../models/Order");
      const order = await Order.findById(lead.orderId);
      if (order) {
        const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                         req.headers['x-real-ip'] ||
                         req.connection?.remoteAddress ||
                         req.socket?.remoteAddress ||
                         'unknown';
        if (!order.auditLog) {
          order.auditLog = [];
        }
        order.auditLog.push({
          action: "client_broker_changed",
          leadId: lead._id,
          leadEmail: lead.email,
          performedBy: req.user._id,
          performedAt: new Date(),
          ipAddress: clientIp,
          details: `Client broker "${clientBroker.name}" assigned to lead ${lead.firstName} ${lead.lastName} (${lead.email}) by ${req.user.fullName || req.user.email}`,
          newValue: {
            clientBrokerId: clientBroker._id,
            clientBrokerName: clientBroker.name,
          },
        });
        await order.save();
      }
    }

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

    // Capture lead name and email for audit (before any changes)
    const leadName = `${lead.firstName} ${lead.lastName}`;
    const leadEmail = lead.newEmail;
    const changedByName = req.user.fullName || req.user.email;
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                     req.headers['x-real-ip'] ||
                     req.connection?.remoteAddress ||
                     req.socket?.remoteAddress ||
                     'unknown';

    // Field mapping for audit labels
    const fieldLabels = {
      firstName: "First Name",
      lastName: "Last Name",
      newEmail: "Email",
      oldEmail: "Old Email",
      newPhone: "Phone",
      oldPhone: "Old Phone",
      country: "Country",
      status: "Status",
      leadType: "Lead Type",
      sin: "SIN",
      gender: "Gender",
      dob: "Date of Birth",
      address: "Address",
    };

    // Collect audit entries to create after save
    const auditEntries = [];

    // Helper function to track field changes
    const trackChange = (fieldName, previousValue, newValue, previousDisplay = null, newDisplay = null) => {
      // Skip if values are the same (handle null/undefined/empty string comparisons)
      const prevStr = previousValue === null || previousValue === undefined ? "" : String(previousValue);
      const newStr = newValue === null || newValue === undefined ? "" : String(newValue);
      if (prevStr === newStr) return;

      auditEntries.push({
        leadId: lead._id,
        leadName,
        leadEmail,
        fieldName,
        fieldLabel: fieldLabels[fieldName] || fieldName,
        previousValue,
        newValue,
        previousValueDisplay: previousDisplay || prevStr,
        newValueDisplay: newDisplay || newStr,
        changedBy: req.user._id,
        changedByName,
        ipAddress: clientIp,
      });
    };

    // Track and apply changes
    if (firstName && firstName !== lead.firstName) {
      trackChange("firstName", lead.firstName, firstName);
      lead.firstName = firstName;
    }
    if (lastName && lastName !== lead.lastName) {
      trackChange("lastName", lead.lastName, lastName);
      lead.lastName = lastName;
    }
    if (newEmail && newEmail !== lead.newEmail) {
      trackChange("newEmail", lead.newEmail, newEmail);
      lead.newEmail = newEmail;
    }
    if (oldEmail !== undefined && oldEmail !== lead.oldEmail) {
      trackChange("oldEmail", lead.oldEmail, oldEmail);
      lead.oldEmail = oldEmail;
    }
    if (newPhone) {
      const normalizedNewPhone = normalizePhone(newPhone, lead.prefix || lead.country);
      if (normalizedNewPhone !== lead.newPhone) {
        trackChange("newPhone", lead.newPhone, normalizedNewPhone);
        lead.newPhone = normalizedNewPhone;
      }
    }
    if (oldPhone !== undefined && oldPhone !== lead.oldPhone) {
      trackChange("oldPhone", lead.oldPhone, oldPhone);
      lead.oldPhone = oldPhone;
    }
    if (country && country !== lead.country) {
      trackChange("country", lead.country, country);
      lead.country = country;
    }
    if (status && status !== lead.status) {
      trackChange("status", lead.status, status);
      lead.status = status;
    }
    if (leadType && leadType !== lead.leadType) {
      trackChange("leadType", lead.leadType, leadType);
      lead.leadType = leadType;
    }
    if (sin !== undefined && leadType === "ftd" && sin !== lead.sin) {
      trackChange("sin", lead.sin, sin);
      lead.sin = sin;
    }
    if (gender !== undefined && gender !== lead.gender) {
      trackChange("gender", lead.gender, gender);
      lead.gender = gender;
    }
    if (dob !== undefined) {
      const newDob = dob ? dob.split('T')[0] : "";
      const oldDob = lead.dob ? new Date(lead.dob).toISOString().split('T')[0] : "";
      if (newDob !== oldDob) {
        trackChange("dob", lead.dob, dob, oldDob, newDob);
        lead.dob = dob ? new Date(String(dob).split('T')[0] + "T12:00:00.000Z") : null;
      }
    }
    if (
      address !== undefined &&
      (lead.leadType === "ftd" || lead.leadType === "filler")
    ) {
      const newAddress = typeof address === 'object' ? JSON.stringify(address) : address;
      const oldAddress = typeof lead.address === 'object' ? JSON.stringify(lead.address) : lead.address;
      if (newAddress !== oldAddress) {
        trackChange("address", lead.address, address, oldAddress || "", newAddress || "");
        lead.address = address;
      }
    }
    if (socialMedia) {
      // Track individual social media field changes
      const socialMediaFields = ['facebook', 'twitter', 'linkedin', 'instagram', 'telegram', 'whatsapp'];
      for (const field of socialMediaFields) {
        if (socialMedia[field] !== undefined) {
          const oldValue = lead.socialMedia?.[field] || "";
          const newValue = socialMedia[field] || "";
          if (oldValue !== newValue) {
            trackChange(
              `socialMedia.${field}`,
              oldValue,
              newValue
            );
            // Update fieldLabel for social media
            auditEntries[auditEntries.length - 1].fieldLabel = `Social Media (${field.charAt(0).toUpperCase() + field.slice(1)})`;
          }
        }
      }
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
    const newlyAddedBrokers = []; // Track brokers added for audit logging
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
            // Find the broker doc for audit logging
            const brokerDoc = brokerDocs.find(b => b._id.toString() === brokerId.toString());
            if (brokerDoc) {
              newlyAddedBrokers.push({ id: brokerDoc._id, name: brokerDoc.name });
            }
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
          newlyAddedBrokers.push({ id: brokerDoc._id, name: brokerDoc.name });
        }
      } else {
        // Note: We don't clear assignedClientBrokers because it's a permanent record
        // of all brokers this lead has been sent to (used for order filtering)
      }
    }

    await lead.save();

    // Create audit entries for all field changes (in separate collection for independence)
    if (auditEntries.length > 0) {
      try {
        // Create audit entries with human-readable details
        const auditDocsToCreate = auditEntries.map(entry => ({
          ...entry,
          details: `The ${entry.fieldLabel.toLowerCase()} of "${leadName}" was changed from "${entry.previousValueDisplay || "(empty)"}" to "${entry.newValueDisplay || "(empty)"}" by ${changedByName}`,
          changedAt: new Date(),
        }));
        await LeadAuditLog.insertMany(auditDocsToCreate);
      } catch (auditError) {
        // Log error but don't fail the main operation
        console.error("Error creating lead audit entries:", auditError);
      }
    }

    // Add audit log for newly added client brokers
    if (newlyAddedBrokers.length > 0 && lead.orderId) {
      const Order = require("../models/Order");
      const order = await Order.findById(lead.orderId);
      if (order) {
        if (!order.auditLog) {
          order.auditLog = [];
        }
        for (const broker of newlyAddedBrokers) {
          order.auditLog.push({
            action: "client_broker_changed",
            leadId: lead._id,
            leadEmail: lead.email,
            performedBy: req.user._id,
            performedAt: new Date(),
            ipAddress: clientIp,
            details: `Client broker "${broker.name}" assigned to lead ${lead.firstName} ${lead.lastName} (${lead.email}) by ${req.user.fullName || req.user.email}`,
            newValue: {
              clientBrokerId: broker.id,
              clientBrokerName: broker.name,
            },
          });
        }
        await order.save();
      }
    }
    await lead.populate("assignedAgent", "fullName fourDigitCode");
    await lead.populate("comments.author", "fullName");
    await lead.populate("assignedClientBrokers", "name domain description");
    await lead.populate(
      "clientBrokerHistory.clientBroker",
      "name domain description"
    );

    // Emit real-time update for lead changes so OrdersPage can update
    if (req.io) {
      req.io.emit("lead:updated", {
        lead: lead.toObject(),
        updatedBy: req.user._id,
        updatedAt: new Date().toISOString(),
      });
    }

    leadSearchCache.clearCache();

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
    const normalizedPhone = normalizePhone(newPhone, req.body.prefix || country);
    const leadData = {
      firstName,
      lastName,
      newEmail,
      oldEmail,
      newPhone: normalizedPhone,
      oldPhone,
      country,
      leadType,
      socialMedia,
      sin,
      dob: dob ? new Date(String(dob).split('T')[0] + "T12:00:00.000Z") : undefined,
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

    leadSearchCache.clearCache();

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
        const month = parseInt(parts[1]);
        const year = parseInt(parts[2]);
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
        }
      }
      const parsed = new Date(dateString);
      if (isNaN(parsed.getTime())) return null;
      return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate(), 12, 0, 0));
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
      // Normalize phone to strip duplicated country code prefix
      if (leadData.newPhone && (leadData.prefix || leadData.country)) {
        leadData.newPhone = normalizePhone(leadData.newPhone, leadData.prefix || leadData.country);
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

    leadSearchCache.clearCache();

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
    // Check admin authorization
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete leads",
      });
    }

    // Validate deletion reason
    const { reason } = req.body;
    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: "Deletion reason is required (minimum 10 characters)",
      });
    }

    // Find and populate the lead
    const lead = await Lead.findById(req.params.id)
      .populate("clientBrokerHistory.clientBroker")
      .populate("assignedAgent");

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // Import the backup utility
    const createDeletedLeadBackup = require("../utils/deletedLeadBackup");

    // Create backup before deletion
    const deletedLead = await createDeletedLeadBackup(
      lead,
      req.user.id,
      "single",
      reason.trim()
    );

    // Delete the lead
    await lead.deleteOne();

    leadSearchCache.clearCache();

    res.status(200).json({
      success: true,
      message: "Lead deleted and backed up successfully",
      data: {
        deletedLeadId: deletedLead._id,
        deletedAt: deletedLead.deletedAt,
        orderReferencesCount: deletedLead.orderReferences.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.bulkDeleteLeads = async (req, res, next) => {
  try {
    // Check admin authorization
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete leads",
      });
    }

    // Validate deletion reason
    const { reason } = req.body;
    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: "Deletion reason is required (minimum 10 characters)",
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

    // BEFORE deletion, fetch all leads that will be deleted
    const leadsToDelete = await Lead.find(filter)
      .populate("clientBrokerHistory.clientBroker")
      .populate("assignedAgent");

    if (leadsToDelete.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No leads found matching the criteria",
      });
    }

    // Import the backup utility
    const createDeletedLeadBackup = require("../utils/deletedLeadBackup");

    // Create backups for each lead
    const backupPromises = leadsToDelete.map((lead) =>
      createDeletedLeadBackup(lead, req.user.id, "bulk", reason.trim())
    );
    const deletedLeads = await Promise.all(backupPromises);

    // NOW perform the deletion
    const result = await Lead.deleteMany(filter);

    leadSearchCache.clearCache();

    res.status(200).json({
      success: true,
      message: `${result.deletedCount} leads deleted and backed up successfully`,
      data: {
        deletedCount: result.deletedCount,
        backedUpCount: deletedLeads.length,
        deletedLeadIds: deletedLeads.map((dl) => dl._id),
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

    const { callNumber, notes, orderId, verified, affiliateManagerId } = req.body;
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
        affiliateManagerId: affiliateManagerId || null,
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
          affiliateManagerId: affiliateManagerId || null,
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

          // Add audit log to associated order if exists
          if (lead.orderId) {
            const Order = require("../models/Order");
            const order = await Order.findById(lead.orderId);
            if (order) {
              const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                               req.headers['x-real-ip'] ||
                               req.connection?.remoteAddress ||
                               req.socket?.remoteAddress ||
                               'unknown';
              if (!order.auditLog) {
                order.auditLog = [];
              }
              order.auditLog.push({
                action: "agent_changed",
                leadId: lead._id,
                leadEmail: lead.email,
                performedBy: req.user._id,
                performedAt: new Date(),
                ipAddress: clientIp,
                details: `Agent unassigned from lead ${lead.firstName} ${lead.lastName} (${lead.email}) by ${req.user.fullName || req.user.email}. Previous agent: ${previousAgentInfo.name}`,
                previousValue: {
                  agentId: previousAgentInfo.id,
                  agentName: previousAgentInfo.name,
                },
                newValue: null,
              });
              await order.save();
            }
          }

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

          // Add audit log to associated order if exists
          if (lead.orderId) {
            const Order = require("../models/Order");
            const order = await Order.findById(lead.orderId);
            if (order) {
              const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                               req.headers['x-real-ip'] ||
                               req.connection?.remoteAddress ||
                               req.socket?.remoteAddress ||
                               'unknown';
              if (!order.auditLog) {
                order.auditLog = [];
              }
              const isReassignment = assignmentResult.isReassignment && previousAgentInfo;
              order.auditLog.push({
                action: "agent_changed",
                leadId: lead._id,
                leadEmail: lead.email,
                performedBy: req.user._id,
                performedAt: new Date(),
                ipAddress: clientIp,
                details: isReassignment
                  ? `Agent changed for lead ${lead.firstName} ${lead.lastName} (${lead.email}) by ${req.user.fullName || req.user.email}. Previous agent: ${previousAgentInfo.name}, New agent: ${agent.fullName}`
                  : `Agent ${agent.fullName} assigned to lead ${lead.firstName} ${lead.lastName} (${lead.email}) by ${req.user.fullName || req.user.email}`,
                previousValue: previousAgentInfo ? {
                  agentId: previousAgentInfo.id,
                  agentName: previousAgentInfo.name,
                } : null,
                newValue: {
                  agentId: agent._id,
                  agentName: agent.fullName,
                },
              });
              await order.save();
            }
          }

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
    const { emails, orderId } = req.body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of email addresses",
      });
    }

    // Normalize emails to lowercase and trim
    const normalizedEmails = emails.map((e) => e.trim().toLowerCase());

    // Search for leads with matching emails (exclude archived leads - they cannot be used in orders)
    const leads = await Lead.find({
      newEmail: { $in: normalizedEmails },
      isArchived: { $ne: true },
    }).populate("assignedAgent", "fullName email");

    // Get order's existing lead IDs if orderId is provided
    let existingLeadIds = [];
    if (orderId) {
      const Order = require("../models/Order");
      const order = await Order.findById(orderId).select("leads");
      if (order) {
        existingLeadIds = order.leads.map((id) => id.toString());
      }
    }

    // Calculate cooldown status for each lead
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const leadsWithStatus = leads.map((lead) => {
      const leadObj = lead.toObject();

      // Check if lead is already in the order
      leadObj.isInOrder = existingLeadIds.includes(lead._id.toString());

      // Check if lead is on cooldown (only for FTD/filler leads)
      const isOnCooldown =
        (lead.leadType === "ftd" || lead.leadType === "filler") &&
        lead.lastUsedInOrder &&
        lead.lastUsedInOrder > tenDaysAgo;

      leadObj.isOnCooldown = isOnCooldown;

      if (isOnCooldown) {
        const cooldownEnds = new Date(lead.lastUsedInOrder.getTime() + 10 * 24 * 60 * 60 * 1000);
        const daysRemaining = Math.ceil((cooldownEnds - Date.now()) / (24 * 60 * 60 * 1000));
        leadObj.cooldownDaysRemaining = daysRemaining;
        leadObj.cooldownEndsAt = cooldownEnds;
      }

      return leadObj;
    });

    res.status(200).json({
      success: true,
      data: leadsWithStatus,
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

/**
 * @desc    Get audit history for a lead from ActivityLog
 * @route   GET /api/leads/:id/audit-history
 * @access  Admin, Lead Manager, Affiliate Manager
 */
exports.getLeadAuditHistory = async (req, res, next) => {
  try {
    const leadId = req.params.id;
    const ActivityLog = require("../models/ActivityLog");

    // Get activity logs for this lead
    const activityLogs = await ActivityLog.find({
      $or: [
        { "requestBody.id": leadId },
        { "requestBody.leadId": leadId },
        { path: { $regex: `/leads/${leadId}` } },
      ],
    })
      .populate("user", "fullName email role")
      .sort({ timestamp: -1 })
      .lean();

    // Transform to show field-level changes
    const history = activityLogs.map((log) => ({
      _id: log._id,
      timestamp: log.timestamp,
      user: log.userSnapshot || log.user,
      action: log.actionType,
      method: log.method,
      changes: log.changes, // Field-by-field diff
      previousState: log.previousState,
      ip: log.ip,
      device: log.device,
      browser: log.browser,
      os: log.os,
      geo: log.geo,
    }));

    res.status(200).json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (error) {
    console.error("Error fetching lead audit history:", error);
    next(error);
  }
};

/**
 * @desc    Get full history for a lead including all assignments and orders
 * @route   GET /api/leads/:id/full-history
 * @access  Admin, Lead Manager, Affiliate Manager
 */
exports.getLeadFullHistory = async (req, res, next) => {
  try {
    const leadId = req.params.id;
    const Order = require("../models/Order");

    const lead = await Lead.findById(leadId)
      .populate("clientBrokerHistory.clientBroker")
      .populate("clientBrokerHistory.assignedBy", "fullName email")
      .populate("clientNetworkHistory.clientNetwork")
      .populate("clientNetworkHistory.assignedBy", "fullName email")
      .populate("campaignHistory.campaign")
      .populate("campaignHistory.assignedBy", "fullName email")
      .populate("ourNetworkHistory.ourNetwork")
      .populate("ourNetworkHistory.assignedBy", "fullName email")
      .populate("depositHistory.performedBy", "fullName email")
      .populate("depositConfirmedBy", "fullName email")
      .populate("createdBy", "fullName email")
      .populate("assignedAgent", "fullName email")
      .populate("archivedBy", "fullName email");

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // Get orders this lead was used in
    const orders = await Order.find({ leads: leadId })
      .populate("requester", "fullName email")
      .select("_id createdAt status requests fulfilled leadsMetadata")
      .lean();

    // Combine all history
    const fullHistory = {
      lead: lead,
      orders: orders.map((order) => {
        const metadata = (order.leadsMetadata || []).find(
          (m) => m.leadId && m.leadId.toString() === leadId
        );
        return {
          ...order,
          orderedAs: metadata?.orderedAs || null,
          replacementHistory: metadata?.replacementHistory || [],
        };
      }),
      clientBrokerHistory: lead.clientBrokerHistory || [],
      clientNetworkHistory: lead.clientNetworkHistory || [],
      campaignHistory: lead.campaignHistory || [],
      ourNetworkHistory: lead.ourNetworkHistory || [],
      callTracking: lead.orderCallTracking || [],
      comments: lead.orderComments || [],
      sessionHistory: lead.sessionHistory || [],
      depositHistory: lead.depositHistory || [],
    };

    res.status(200).json({
      success: true,
      data: fullHistory,
    });
  } catch (error) {
    console.error("Error fetching lead full history:", error);
    next(error);
  }
};

// Confirm deposit for a lead
exports.confirmDeposit = async (req, res, next) => {
  try {
    const leadId = req.params.id;
    const userId = req.user._id;
    const userRole = req.user.role;
    const { pspId, orderId, cardIssuerId, selectedCall } = req.body;

    // Only admin and affiliate_manager can confirm deposits
    if (userRole !== "admin" && userRole !== "affiliate_manager") {
      return res.status(403).json({
        success: false,
        message: "Only admins and affiliate managers can confirm deposits",
      });
    }

    // Validate PSP is provided
    if (!pspId) {
      return res.status(400).json({
        success: false,
        message: "Please select a PSP for this deposit",
      });
    }

    // Validate orderId is provided (required for per-order tracking)
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required for confirming deposit",
      });
    }

    // Validate selectedCall is provided (AM must select the deposit call)
    if (!selectedCall || !selectedCall.cdrCallId || !selectedCall.callDate || !selectedCall.callDuration) {
      return res.status(400).json({
        success: false,
        message: "Please select an agent call as the deposit call",
      });
    }

    // Validate PSP exists and is active
    const PSP = require("../models/PSP");
    const psp = await PSP.findById(pspId);
    if (!psp) {
      return res.status(404).json({
        success: false,
        message: "Selected PSP not found",
      });
    }
    if (!psp.isActive) {
      return res.status(400).json({
        success: false,
        message: "Selected PSP is not active",
      });
    }

    // Validate Card Issuer if provided
    let cardIssuer = null;
    if (cardIssuerId) {
      const CardIssuer = require("../models/CardIssuer");
      cardIssuer = await CardIssuer.findById(cardIssuerId);
      if (!cardIssuer) {
        return res.status(404).json({
          success: false,
          message: "Selected Card Issuer not found",
        });
      }
      if (!cardIssuer.isActive) {
        return res.status(400).json({
          success: false,
          message: "Selected Card Issuer is not active",
        });
      }
    }

    const lead = await Lead.findById(leadId);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // Check if lead has an assigned agent
    if (!lead.assignedAgent) {
      return res.status(400).json({
        success: false,
        message: "Please assign an agent to this lead first before confirming deposit",
      });
    }

    // Validate that the selected call's destination matches the lead's phone
    if (selectedCall.destinationNumber && selectedCall.destinationNumber !== "unknown" && lead.newPhone) {
      const cleanDst = selectedCall.destinationNumber.replace(/[\s\-\(\)\+]/g, "");
      const cleanLeadPhone = lead.newPhone.replace(/[\s\-\(\)\+]/g, "");
      const dstSuffix = cleanDst.length >= 7 ? cleanDst.slice(-10) : cleanDst;
      const phoneSuffix = cleanLeadPhone.length >= 7 ? cleanLeadPhone.slice(-10) : cleanLeadPhone;

      if (dstSuffix && phoneSuffix && dstSuffix !== phoneSuffix) {
        return res.status(400).json({
          success: false,
          message: `Selected call destination (${selectedCall.destinationNumber}) does not match the lead's phone (${lead.newPhone}). Please select a call that was made to this lead.`,
        });
      }
    }

    // Find the order and check if lead is in it
    const Order = require("../models/Order");
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Find the lead's metadata entry in the order
    const leadMetadataIndex = order.leadsMetadata.findIndex(
      (meta) => meta.leadId.toString() === leadId
    );

    if (leadMetadataIndex === -1) {
      return res.status(400).json({
        success: false,
        message: "Lead is not part of this order",
      });
    }

    const leadMetadata = order.leadsMetadata[leadMetadataIndex];

    // Affiliate managers can only confirm once (cannot change after confirming)
    if (userRole === "affiliate_manager" && leadMetadata.depositConfirmed) {
      return res.status(403).json({
        success: false,
        message: "Deposit has already been confirmed for this order. Only admins can modify this.",
      });
    }

    // Update the order's leadsMetadata (not the lead document)
    order.leadsMetadata[leadMetadataIndex].depositConfirmed = true;
    order.leadsMetadata[leadMetadataIndex].depositConfirmedBy = userId;
    order.leadsMetadata[leadMetadataIndex].depositConfirmedAt = new Date();
    order.leadsMetadata[leadMetadataIndex].depositPSP = pspId;
    order.leadsMetadata[leadMetadataIndex].depositCardIssuer = cardIssuerId || null;

    // Add audit log to order
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                     req.headers['x-real-ip'] ||
                     req.connection?.remoteAddress ||
                     req.socket?.remoteAddress ||
                     'unknown';
    if (!order.auditLog) {
      order.auditLog = [];
    }
    order.auditLog.push({
      action: "deposit_confirmed",
      leadId: lead._id,
      leadEmail: lead.newEmail,
      performedBy: userId,
      performedAt: new Date(),
      ipAddress: clientIp,
      details: `Deposit confirmed for lead ${lead.firstName} ${lead.lastName} (${lead.newEmail}) using PSP "${psp.name}"${cardIssuer ? ` (Card Issuer: ${cardIssuer.name})` : ""} by ${req.user.fullName || req.user.email}`,
    });

    await order.save();

    // Create or update DepositCall record so it appears on Deposit Calls page
    const DepositCall = require("../models/DepositCall");
    let depositCall = await DepositCall.findOne({ leadId: lead._id, orderId });

    if (!depositCall) {
      depositCall = await DepositCall.create({
        leadId: lead._id,
        orderId,
        clientBrokerId: lead.assignedClientBrokers?.[0] || order.selectedClientBrokers?.[0] || null,
        accountManager: userId,
        assignedAgent: lead.assignedAgent,
        ftdName: `${lead.firstName} ${lead.lastName}`,
        ftdEmail: lead.newEmail,
        ftdPhone: lead.newPhone,
        depositConfirmed: true,
        depositConfirmedBy: userId,
        depositConfirmedAt: new Date(),
        depositStatus: "confirmed",
        createdBy: userId,
      });
    } else {
      depositCall.depositConfirmed = true;
      depositCall.depositConfirmedBy = userId;
      depositCall.depositConfirmedAt = new Date();
      depositCall.depositStatus = "confirmed";
      depositCall.accountManager = userId;
      await depositCall.save();
    }

    // Create approved deposit call declaration from the selected CDR call
    const AgentCallDeclaration = require("../models/AgentCallDeclaration");
    const cdrService = require("../services/cdrService");
    const { addCallExpenseToAffiliateManager, removeCallExpenseFromAffiliateManager } = require("./agentCallDeclarations");

    // Check if this CDR call is already declared — if so, reverse it so we can re-declare as deposit
    const existingCdrDecl = await AgentCallDeclaration.findOne({
      cdrCallId: selectedCall.cdrCallId,
      isActive: true,
    });
    if (existingCdrDecl) {
      // Reverse AM table expense if it was approved
      if (existingCdrDecl.status === "approved") {
        try {
          await removeCallExpenseFromAffiliateManager(existingCdrDecl);
        } catch (expenseErr) {
          console.error("Error reversing existing declaration expense during deposit override:", expenseErr);
        }

        // Reset the DepositCall slot if it was a non-deposit FTD call
        if (existingCdrDecl.callCategory !== "filler" && existingCdrDecl.callType !== "deposit") {
          const CALL_TYPE_TO_CALL_NUMBER = {
            first_call: 1, second_call: 2, third_call: 3, fourth_call: 4, fifth_call: 5,
            sixth_call: 6, seventh_call: 7, eighth_call: 8, ninth_call: 9, tenth_call: 10,
          };
          const callNumber = CALL_TYPE_TO_CALL_NUMBER[existingCdrDecl.callType];
          if (callNumber) {
            // Find the DepositCall for this lead
            const existingDepositCall = await DepositCall.findOne({
              $or: [
                { leadId: leadId },
                ...(lead.newEmail ? [{ ftdEmail: lead.newEmail }] : []),
              ],
              depositConfirmed: true,
            });
            if (existingDepositCall) {
              const callField = `call${callNumber}`;
              if (existingDepositCall[callField].status !== "pending") {
                existingDepositCall[callField].status = "pending";
                existingDepositCall[callField].expectedDate = null;
                existingDepositCall[callField].doneDate = null;
                existingDepositCall[callField].markedBy = null;
                existingDepositCall[callField].markedAt = null;
                existingDepositCall[callField].approvedBy = null;
                existingDepositCall[callField].approvedAt = null;
                existingDepositCall[callField].notes = "";
                await existingDepositCall.save();
                console.log(`Reset DepositCall ${existingDepositCall._id} call${callNumber} to pending (deposit override)`);
              }
            }
          }
        }
      }

      // Soft-delete the old declaration
      existingCdrDecl.isActive = false;
      await existingCdrDecl.save();
      console.log(`Soft-deleted existing declaration ${existingCdrDecl._id} for CDR call override during deposit confirmation`);
    }

    // Check if a deposit declaration already exists for this lead+order
    const existingDepositDecl = await AgentCallDeclaration.findOne({
      lead: leadId,
      orderId,
      callType: "deposit",
      status: { $in: ["approved", "pending"] },
      isActive: true,
    });
    if (existingDepositDecl) {
      return res.status(400).json({
        success: false,
        message: "A deposit call declaration already exists for this lead on this order",
      });
    }

    // Calculate bonus
    const bonusData = cdrService.calculateBonus("deposit", selectedCall.callDuration);
    const callDateObj = new Date(selectedCall.callDate);

    const depositDeclaration = await AgentCallDeclaration.create({
      agent: lead.assignedAgent._id || lead.assignedAgent,
      cdrCallId: selectedCall.cdrCallId,
      callDate: callDateObj,
      callDuration: selectedCall.callDuration,
      sourceNumber: selectedCall.sourceNumber || "unknown",
      destinationNumber: selectedCall.destinationNumber || "unknown",
      callCategory: "ftd",
      callType: "deposit",
      description: "Deposit call selected by AM during deposit confirmation",
      baseBonus: bonusData.baseBonus,
      hourlyBonus: bonusData.hourlyBonus,
      totalBonus: bonusData.totalBonus,
      status: "approved",
      reviewedBy: userId,
      reviewedAt: new Date(),
      reviewNotes: "Auto-approved: selected by AM during deposit confirmation",
      declarationMonth: callDateObj.getMonth() + 1,
      declarationYear: callDateObj.getFullYear(),
      affiliateManager: userId,
      lead: leadId,
      orderId,
      recordFile: selectedCall.recordFile || "",
    });

    // Add expense to affiliate manager's table
    try {
      await addCallExpenseToAffiliateManager(depositDeclaration);
    } catch (expenseError) {
      console.error("Error adding deposit call expense:", expenseError);
    }

    // Store declaration reference on DepositCall for reversal tracking
    depositCall.depositCallDeclaration = depositDeclaration._id;
    await depositCall.save();

    // Populate order metadata for response
    await order.populate("leadsMetadata.depositConfirmedBy", "fullName email");
    await order.populate("leadsMetadata.depositPSP", "name website");
    await order.populate("leadsMetadata.depositCardIssuer", "name description logo");

    // Also populate lead for response
    await lead.populate("assignedAgent", "fullName email fourDigitCode");

    // Return the updated metadata along with lead info
    const updatedMetadata = order.leadsMetadata[leadMetadataIndex];

    res.status(200).json({
      success: true,
      message: "Deposit confirmed successfully",
      data: {
        ...lead.toObject(),
        // Include order-specific metadata
        orderMetadata: updatedMetadata,
      },
    });
  } catch (error) {
    console.error("Error confirming deposit:", error);
    next(error);
  }
};

// Unconfirm deposit for a lead (admin only)
exports.unconfirmDeposit = async (req, res, next) => {
  try {
    const leadId = req.params.id;
    const userRole = req.user.role;
    const { orderId } = req.body;

    // Only admin can unconfirm deposits
    if (userRole !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can unconfirm deposits",
      });
    }

    // Validate orderId is provided
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required for unconfirming deposit",
      });
    }

    const lead = await Lead.findById(leadId);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // Find the order
    const Order = require("../models/Order");
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Find the lead's metadata entry in the order
    const leadMetadataIndex = order.leadsMetadata.findIndex(
      (meta) => meta.leadId.toString() === leadId
    );

    if (leadMetadataIndex === -1) {
      return res.status(400).json({
        success: false,
        message: "Lead is not part of this order",
      });
    }

    const leadMetadata = order.leadsMetadata[leadMetadataIndex];

    if (!leadMetadata.depositConfirmed) {
      return res.status(400).json({
        success: false,
        message: "Deposit is not confirmed for this order",
      });
    }

    // Reset deposit fields in the order's leadsMetadata
    order.leadsMetadata[leadMetadataIndex].depositConfirmed = false;
    order.leadsMetadata[leadMetadataIndex].depositConfirmedBy = null;
    order.leadsMetadata[leadMetadataIndex].depositConfirmedAt = null;
    order.leadsMetadata[leadMetadataIndex].depositPSP = null;
    order.leadsMetadata[leadMetadataIndex].depositCardIssuer = null;

    // Add audit log to order
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                     req.headers['x-real-ip'] ||
                     req.connection?.remoteAddress ||
                     req.socket?.remoteAddress ||
                     'unknown';
    if (!order.auditLog) {
      order.auditLog = [];
    }
    order.auditLog.push({
      action: "deposit_unconfirmed",
      leadId: lead._id,
      leadEmail: lead.newEmail,
      performedBy: req.user._id,
      performedAt: new Date(),
      ipAddress: clientIp,
      details: `Deposit unconfirmed for lead ${lead.firstName} ${lead.lastName} (${lead.newEmail}) by ${req.user.fullName || req.user.email}`,
    });

    await order.save();

    // Update DepositCall record if it exists
    const DepositCall = require("../models/DepositCall");
    const depositCall = await DepositCall.findOne({ leadId: lead._id, orderId });
    if (depositCall) {
      // Reverse the deposit call declaration if one exists
      if (depositCall.depositCallDeclaration) {
        try {
          const AgentCallDeclaration = require("../models/AgentCallDeclaration");
          const { removeCallExpenseFromAffiliateManager } = require("./agentCallDeclarations");

          const declaration = await AgentCallDeclaration.findById(depositCall.depositCallDeclaration);
          if (declaration && declaration.isActive) {
            // Reverse expense from AM's table
            try {
              await removeCallExpenseFromAffiliateManager(declaration);
            } catch (expenseError) {
              console.error("Error reversing deposit call expense:", expenseError);
            }

            // Soft-delete the declaration
            declaration.isActive = false;
            await declaration.save();
            console.log(`Reversed deposit declaration ${declaration._id} for lead ${leadId} on order ${orderId}`);
          }
        } catch (declError) {
          console.error("Error reversing deposit call declaration:", declError);
        }
      }

      depositCall.depositConfirmed = false;
      depositCall.depositConfirmedBy = null;
      depositCall.depositConfirmedAt = null;
      depositCall.depositCallDeclaration = null;
      depositCall.depositStatus = "pending";
      await depositCall.save();
    }

    await lead.populate("assignedAgent", "fullName email fourDigitCode");

    // Return the updated metadata along with lead info
    const updatedMetadata = order.leadsMetadata[leadMetadataIndex];

    res.status(200).json({
      success: true,
      message: "Deposit unconfirmed successfully",
      data: {
        ...lead.toObject(),
        orderMetadata: updatedMetadata,
      },
    });
  } catch (error) {
    console.error("Error unconfirming deposit:", error);
    next(error);
  }
};

// Mark lead as shaved (brand didn't show deposit) and assign to refunds manager
exports.markAsShaved = async (req, res, next) => {
  try {
    const leadId = req.params.id;
    const userId = req.user._id;
    const userRole = req.user.role;
    const { refundsManagerId, orderId } = req.body;

    // Only admin and affiliate_manager can mark as shaved
    if (userRole !== "admin" && userRole !== "affiliate_manager") {
      return res.status(403).json({
        success: false,
        message: "Only admins and affiliate managers can mark leads as shaved",
      });
    }

    // Validate refundsManagerId is provided
    if (!refundsManagerId) {
      return res.status(400).json({
        success: false,
        message: "Please select a refunds manager",
      });
    }

    // Validate orderId is provided (required for per-order tracking)
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required for marking as shaved",
      });
    }

    const lead = await Lead.findById(leadId);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // Check if lead is FTD type
    if (lead.leadType !== "ftd") {
      return res.status(400).json({
        success: false,
        message: "Only FTD leads can be marked as shaved",
      });
    }

    // Find the order
    const Order = require("../models/Order");
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Find the lead's metadata entry in the order
    const leadMetadataIndex = order.leadsMetadata.findIndex(
      (meta) => meta.leadId.toString() === leadId
    );

    if (leadMetadataIndex === -1) {
      return res.status(400).json({
        success: false,
        message: "Lead is not part of this order",
      });
    }

    const leadMetadata = order.leadsMetadata[leadMetadataIndex];

    // Check if deposit is confirmed in this order
    if (!leadMetadata.depositConfirmed) {
      return res.status(400).json({
        success: false,
        message: "Please confirm the deposit first before marking as shaved",
      });
    }

    // Affiliate managers can only set once (cannot change after assignment)
    if (userRole === "affiliate_manager" && leadMetadata.shaved && leadMetadata.shavedRefundsManager) {
      return res.status(403).json({
        success: false,
        message: "This lead is already marked as shaved for this order. Only admins can modify the assignment.",
      });
    }

    // Validate refunds manager exists and has the correct role
    const User = require("../models/User");
    const refundsManager = await User.findOne({
      _id: refundsManagerId,
      role: "refunds_manager",
      isActive: true,
      status: "approved",
    });

    if (!refundsManager) {
      return res.status(400).json({
        success: false,
        message: "Selected refunds manager not found or is not active",
      });
    }

    // Determine if this is a new shaved mark or a manager change
    const isNewShaved = !leadMetadata.shaved;
    const isManagerChange = leadMetadata.shaved && leadMetadata.shavedRefundsManager &&
      leadMetadata.shavedRefundsManager.toString() !== refundsManagerId;

    // Update the order's leadsMetadata (not the lead document)
    order.leadsMetadata[leadMetadataIndex].shaved = true;
    order.leadsMetadata[leadMetadataIndex].shavedBy = userId;
    order.leadsMetadata[leadMetadataIndex].shavedAt = new Date();
    order.leadsMetadata[leadMetadataIndex].shavedRefundsManager = refundsManagerId;
    order.leadsMetadata[leadMetadataIndex].shavedManagerAssignedBy = userId;
    order.leadsMetadata[leadMetadataIndex].shavedManagerAssignedAt = new Date();

    // Add audit log to order
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                     req.headers['x-real-ip'] ||
                     req.connection?.remoteAddress ||
                     req.socket?.remoteAddress ||
                     'unknown';
    if (!order.auditLog) {
      order.auditLog = [];
    }
    order.auditLog.push({
      action: "shaved",
      leadId: lead._id,
      leadEmail: lead.newEmail,
      performedBy: userId,
      performedAt: new Date(),
      ipAddress: clientIp,
      details: `Lead ${lead.firstName} ${lead.lastName} (${lead.newEmail}) marked as shaved by ${req.user.fullName || req.user.email}. Refunds manager: ${refundsManager.fullName}`,
      newValue: {
        refundsManagerId: refundsManagerId,
        refundsManagerName: refundsManager.fullName,
      },
    });

    await order.save();

    // Create or update RefundAssignment so the refunds manager can see this lead
    const RefundAssignment = require("../models/RefundAssignment");

    // Check if a RefundAssignment already exists for this lead AND order
    let refundAssignment = await RefundAssignment.findOne({ leadId: leadId, orderId: orderId });

    if (refundAssignment) {
      // Update existing assignment with new refunds manager
      refundAssignment.refundsManager = refundsManagerId;
      refundAssignment.modifiedBy = userId;
      await refundAssignment.save();
    } else {
      // Create new RefundAssignment
      refundAssignment = new RefundAssignment({
        source: "order",
        orderId: orderId,
        leadId: leadId,
        assignedBy: userId,
        refundsManager: refundsManagerId,
        status: "new",
        notes: "Marked as shaved - brand didn't show deposit",
      });
      await refundAssignment.save();
    }

    // Populate order metadata for response
    await order.populate("leadsMetadata.shavedBy", "fullName email");
    await order.populate("leadsMetadata.shavedRefundsManager", "fullName email");
    await order.populate("leadsMetadata.shavedManagerAssignedBy", "fullName email");

    // Also populate lead for response
    await lead.populate("assignedAgent", "fullName email fourDigitCode");

    // Return the updated metadata along with lead info
    const updatedMetadata = order.leadsMetadata[leadMetadataIndex];

    res.status(200).json({
      success: true,
      message: "Lead marked as shaved successfully",
      data: {
        ...lead.toObject(),
        orderMetadata: updatedMetadata,
      },
    });
  } catch (error) {
    console.error("Error marking lead as shaved:", error);
    next(error);
  }
};

// Unmark lead as shaved (admin only)
exports.unmarkAsShaved = async (req, res, next) => {
  try {
    const leadId = req.params.id;
    const userRole = req.user.role;
    const { orderId } = req.body;

    // Only admin can unmark shaved
    if (userRole !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can unmark leads as shaved",
      });
    }

    // Validate orderId is provided
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required for unmarking as shaved",
      });
    }

    const lead = await Lead.findById(leadId);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // Find the order
    const Order = require("../models/Order");
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Find the lead's metadata entry in the order
    const leadMetadataIndex = order.leadsMetadata.findIndex(
      (meta) => meta.leadId.toString() === leadId
    );

    if (leadMetadataIndex === -1) {
      return res.status(400).json({
        success: false,
        message: "Lead is not part of this order",
      });
    }

    const leadMetadata = order.leadsMetadata[leadMetadataIndex];

    if (!leadMetadata.shaved) {
      return res.status(400).json({
        success: false,
        message: "Lead is not marked as shaved for this order",
      });
    }

    // Clear shaved fields in the order's leadsMetadata
    order.leadsMetadata[leadMetadataIndex].shaved = false;
    order.leadsMetadata[leadMetadataIndex].shavedBy = null;
    order.leadsMetadata[leadMetadataIndex].shavedAt = null;
    order.leadsMetadata[leadMetadataIndex].shavedRefundsManager = null;
    order.leadsMetadata[leadMetadataIndex].shavedManagerAssignedBy = null;
    order.leadsMetadata[leadMetadataIndex].shavedManagerAssignedAt = null;

    // Add audit log to order
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                     req.headers['x-real-ip'] ||
                     req.connection?.remoteAddress ||
                     req.socket?.remoteAddress ||
                     'unknown';
    if (!order.auditLog) {
      order.auditLog = [];
    }
    order.auditLog.push({
      action: "unshaved",
      leadId: lead._id,
      leadEmail: lead.newEmail,
      performedBy: req.user._id,
      performedAt: new Date(),
      ipAddress: clientIp,
      details: `Lead ${lead.firstName} ${lead.lastName} (${lead.newEmail}) unmarked as shaved by ${req.user.fullName || req.user.email}`,
    });

    await order.save();

    // Delete the RefundAssignment for this lead AND order
    const RefundAssignment = require("../models/RefundAssignment");
    await RefundAssignment.deleteOne({ leadId: leadId, orderId: orderId });

    await lead.populate("assignedAgent", "fullName email fourDigitCode");

    // Return the updated metadata along with lead info
    const updatedMetadata = order.leadsMetadata[leadMetadataIndex];

    res.status(200).json({
      success: true,
      message: "Lead unmarked as shaved successfully",
      data: {
        ...lead.toObject(),
        orderMetadata: updatedMetadata,
      },
    });
  } catch (error) {
    console.error("Error unmarking lead as shaved:", error);
    next(error);
  }
};

// Mark lead as closed network (network closed, deposit not counted)
exports.markAsClosedNetwork = async (req, res, next) => {
  try {
    const leadId = req.params.id;
    const userId = req.user._id;
    const userRole = req.user.role;
    const { orderId } = req.body;

    // Only admin and affiliate_manager can mark as closed network
    if (userRole !== "admin" && userRole !== "affiliate_manager") {
      return res.status(403).json({
        success: false,
        message: "Only admins and affiliate managers can mark leads as closed network",
      });
    }

    // Validate orderId is provided
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required for marking as closed network",
      });
    }

    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // Check if lead is FTD type
    if (lead.leadType !== "ftd") {
      return res.status(400).json({
        success: false,
        message: "Only FTD leads can be marked as closed network",
      });
    }

    // Find the order
    const Order = require("../models/Order");
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Find the lead's metadata entry in the order
    const leadMetadataIndex = order.leadsMetadata.findIndex(
      (meta) => meta.leadId.toString() === leadId
    );

    if (leadMetadataIndex === -1) {
      return res.status(400).json({
        success: false,
        message: "Lead is not part of this order",
      });
    }

    const leadMetadata = order.leadsMetadata[leadMetadataIndex];

    // Check if deposit is confirmed in this order
    if (!leadMetadata.depositConfirmed) {
      return res.status(400).json({
        success: false,
        message: "Please confirm the deposit first before marking as closed network",
      });
    }

    // Affiliate managers can only set once
    if (userRole === "affiliate_manager" && leadMetadata.closedNetwork) {
      return res.status(403).json({
        success: false,
        message: "This lead is already marked as closed network for this order. Only admins can modify this.",
      });
    }

    // Update the order's leadsMetadata
    order.leadsMetadata[leadMetadataIndex].closedNetwork = true;
    order.leadsMetadata[leadMetadataIndex].closedNetworkBy = userId;
    order.leadsMetadata[leadMetadataIndex].closedNetworkAt = new Date();

    // Add audit log to order
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                     req.headers['x-real-ip'] ||
                     req.connection?.remoteAddress ||
                     req.socket?.remoteAddress ||
                     'unknown';
    if (!order.auditLog) {
      order.auditLog = [];
    }
    order.auditLog.push({
      action: "closed_network",
      leadId: lead._id,
      leadEmail: lead.newEmail,
      performedBy: userId,
      performedAt: new Date(),
      ipAddress: clientIp,
      details: `Lead ${lead.firstName} ${lead.lastName} (${lead.newEmail}) marked as closed network by ${req.user.fullName || req.user.email}`,
    });

    await order.save();

    // Populate for response
    await order.populate("leadsMetadata.closedNetworkBy", "fullName email");
    await lead.populate("assignedAgent", "fullName email fourDigitCode");

    const updatedMetadata = order.leadsMetadata[leadMetadataIndex];

    res.status(200).json({
      success: true,
      message: "Lead marked as closed network successfully",
      data: {
        ...lead.toObject(),
        orderMetadata: updatedMetadata,
      },
    });
  } catch (error) {
    console.error("Error marking lead as closed network:", error);
    next(error);
  }
};

// Unmark lead as closed network (admin only)
exports.unmarkAsClosedNetwork = async (req, res, next) => {
  try {
    const leadId = req.params.id;
    const userRole = req.user.role;
    const { orderId } = req.body;

    // Only admin can unmark closed network
    if (userRole !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can unmark leads as closed network",
      });
    }

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required for unmarking as closed network",
      });
    }

    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    const Order = require("../models/Order");
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const leadMetadataIndex = order.leadsMetadata.findIndex(
      (meta) => meta.leadId.toString() === leadId
    );

    if (leadMetadataIndex === -1) {
      return res.status(400).json({
        success: false,
        message: "Lead is not part of this order",
      });
    }

    if (!order.leadsMetadata[leadMetadataIndex].closedNetwork) {
      return res.status(400).json({
        success: false,
        message: "Lead is not marked as closed network for this order",
      });
    }

    // Clear closed network fields
    order.leadsMetadata[leadMetadataIndex].closedNetwork = false;
    order.leadsMetadata[leadMetadataIndex].closedNetworkBy = null;
    order.leadsMetadata[leadMetadataIndex].closedNetworkAt = null;

    // Add audit log
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                     req.headers['x-real-ip'] ||
                     req.connection?.remoteAddress ||
                     req.socket?.remoteAddress ||
                     'unknown';
    if (!order.auditLog) {
      order.auditLog = [];
    }
    order.auditLog.push({
      action: "unclosed_network",
      leadId: lead._id,
      leadEmail: lead.newEmail,
      performedBy: req.user._id,
      performedAt: new Date(),
      ipAddress: clientIp,
      details: `Lead ${lead.firstName} ${lead.lastName} (${lead.newEmail}) unmarked as closed network by ${req.user.fullName || req.user.email}`,
    });

    await order.save();
    await lead.populate("assignedAgent", "fullName email fourDigitCode");

    const updatedMetadata = order.leadsMetadata[leadMetadataIndex];

    res.status(200).json({
      success: true,
      message: "Lead unmarked as closed network successfully",
      data: {
        ...lead.toObject(),
        orderMetadata: updatedMetadata,
      },
    });
  } catch (error) {
    console.error("Error unmarking lead as closed network:", error);
    next(error);
  }
};

// Assign SIM cards to FTD leads
exports.assignSimCardToLeads = async (req, res, next) => {
  try {
    const { leadIds, simCardId } = req.body;

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Lead IDs array is required",
      });
    }

    // Check if this is an unassignment request (simCardId is null)
    const isUnassigning = simCardId === null || simCardId === undefined;

    let simCard = null;
    if (!isUnassigning) {
      // Verify SIM card exists
      const SimCard = require("../models/SimCard");
      simCard = await SimCard.findById(simCardId);
      if (!simCard) {
        return res.status(404).json({
          success: false,
          message: "SIM card not found",
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
          "assignedSimCard",
          "simNumber geo operator"
        );

        if (!lead) {
          results.failed.push({
            leadId,
            reason: "Lead not found",
          });
          continue;
        }

        if (lead.leadType !== "ftd") {
          results.failed.push({
            leadId,
            reason: "Only FTD leads can be assigned SIM cards",
          });
          continue;
        }

        if (isUnassigning) {
          // Handle unassignment
          if (!lead.assignedSimCard) {
            // Already unassigned
            results.success.push({
              leadId,
              name: `${lead.firstName} ${lead.lastName}`,
              alreadyUnassigned: true,
            });
            continue;
          }

          // Store previous SIM card info
          const previousSimCardInfo = {
            id: lead.assignedSimCard._id,
            simNumber: lead.assignedSimCard.simNumber,
            geo: lead.assignedSimCard.geo,
            operator: lead.assignedSimCard.operator,
          };

          // Unassign the SIM card
          lead.assignedSimCard = null;
          lead.assignedSimCardAt = null;
          lead.assignedSimCardBy = null;
          await lead.save();

          results.success.push({
            leadId,
            name: `${lead.firstName} ${lead.lastName}`,
            unassigned: true,
            previousSimCard: previousSimCardInfo,
          });
        } else {
          // Handle assignment
          // Check if this is already assigned to the same SIM card
          if (
            lead.assignedSimCard &&
            lead.assignedSimCard._id.toString() === simCardId
          ) {
            results.success.push({
              leadId,
              name: `${lead.firstName} ${lead.lastName}`,
              alreadyAssigned: true,
              simCard: {
                id: simCard._id,
                simNumber: simCard.simNumber,
                geo: simCard.geo,
                operator: simCard.operator,
              },
            });
            continue;
          }

          // Check if reassigning from another SIM card
          const wasReassigned = !!lead.assignedSimCard;
          const previousSimCardInfo = wasReassigned
            ? {
                id: lead.assignedSimCard._id,
                simNumber: lead.assignedSimCard.simNumber,
                geo: lead.assignedSimCard.geo,
                operator: lead.assignedSimCard.operator,
              }
            : null;

          // Assign the SIM card
          lead.assignedSimCard = simCardId;
          lead.assignedSimCardAt = new Date();
          lead.assignedSimCardBy = req.user._id;
          await lead.save();

          const resultEntry = {
            leadId,
            name: `${lead.firstName} ${lead.lastName}`,
            simCard: {
              id: simCard._id,
              simNumber: simCard.simNumber,
              geo: simCard.geo,
              operator: simCard.operator,
            },
          };

          if (wasReassigned) {
            resultEntry.reassigned = true;
            resultEntry.previousSimCard = previousSimCardInfo;
            results.reassigned.push(resultEntry);
          } else {
            results.success.push(resultEntry);
          }
        }
      } catch (error) {
        results.failed.push({
          leadId,
          reason: error.message,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: "SIM card assignment completed",
      data: results,
    });
  } catch (error) {
    console.error("Error assigning SIM cards to leads:", error);
    next(error);
  }
};

/**
 * Batch validate leads with IPQS
 * @route POST /api/leads/batch-validate-ipqs
 * @body leadIds - Array of lead IDs to validate
 * @query force - If true, revalidate even if already validated
 * @access Protected (Admin, Affiliate Manager)
 */
exports.batchValidateIPQS = async (req, res, next) => {
  try {
    const { leadIds } = req.body;
    const { force } = req.query;
    const ipqsService = require("../services/ipqsService");

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "leadIds must be a non-empty array",
      });
    }

    // Validate all IDs
    const invalidIds = leadIds.filter(
      (id) => !mongoose.Types.ObjectId.isValid(id)
    );
    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid lead ID format: ${invalidIds.join(", ")}`,
      });
    }

    // Find all leads
    const leads = await Lead.find({ _id: { $in: leadIds } })
      .select("_id firstName lastName newEmail newPhone country ipqsValidation")
      .lean();

    if (leads.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No leads found with the provided IDs",
      });
    }

    // Filter leads based on force parameter
    const leadsToValidate = force === "true"
      ? leads
      : leads.filter((lead) => !ipqsService.isLeadValidated(lead));

    if (leadsToValidate.length === 0) {
      return res.json({
        success: true,
        message: "All selected leads are already validated",
        data: {
          results: leads.map((lead) => ({
            leadId: lead._id,
            firstName: lead.firstName,
            lastName: lead.lastName,
            ipqsValidation: lead.ipqsValidation,
            alreadyValidated: true,
          })),
          stats: {
            total: leads.length,
            validated: leads.length,
            newlyValidated: 0,
            alreadyValidated: leads.length,
            failed: 0,
          },
        },
      });
    }

    console.log(
      `[IPQS] Batch validating ${leadsToValidate.length} leads (force=${force})`
    );

    const results = [];
    const alreadyValidated = leads.filter((lead) =>
      ipqsService.isLeadValidated(lead)
    );

    // Add already validated leads to results if not forcing revalidation
    if (force !== "true") {
      alreadyValidated.forEach((lead) => {
        results.push({
          leadId: lead._id,
          firstName: lead.firstName,
          lastName: lead.lastName,
          ipqsValidation: lead.ipqsValidation,
          alreadyValidated: true,
        });
      });
    }

    // Process leads sequentially to avoid rate limiting
    let successCount = 0;
    let failedCount = 0;

    for (const lead of leadsToValidate) {
      try {
        const result = await ipqsService.validateLead(lead);
        const summary = ipqsService.getValidationSummary(result.email, result.phone);

        // Update lead in database
        await Lead.findByIdAndUpdate(lead._id, {
          $set: {
            ipqsValidation: {
              email: result.email,
              phone: result.phone,
              summary: summary,
              validatedAt: result.validatedAt,
            },
          },
        });

        results.push({
          leadId: lead._id,
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: result.email,
          phone: result.phone,
          summary: summary,
          validatedAt: result.validatedAt,
          alreadyValidated: false,
        });

        successCount++;

        // Small delay between requests to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`[IPQS] Error validating lead ${lead._id}:`, error.message);
        results.push({
          leadId: lead._id,
          firstName: lead.firstName,
          lastName: lead.lastName,
          error: error.message,
          alreadyValidated: false,
        });
        failedCount++;
      }
    }

    console.log(
      `[IPQS] Batch validation completed: ${successCount} success, ${failedCount} failed`
    );

    res.json({
      success: true,
      message: `Validated ${successCount} leads successfully${failedCount > 0 ? `, ${failedCount} failed` : ""}`,
      data: {
        results,
        stats: {
          total: leads.length,
          validated: successCount + alreadyValidated.length,
          newlyValidated: successCount,
          alreadyValidated: force !== "true" ? alreadyValidated.length : 0,
          failed: failedCount,
        },
      },
    });
  } catch (error) {
    console.error("Error batch validating leads with IPQS:", error);
    next(error);
  }
};

// Get global lead audit logs (all changes across all leads)
exports.getGlobalLeadAuditLogs = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 50,
      leadId,
      changedBy,
      fieldName,
      startDate,
      endDate,
      search,
    } = req.query;

    const query = {};

    if (leadId) {
      query.leadId = leadId;
    }
    if (changedBy) {
      query.changedBy = changedBy;
    }
    if (fieldName) {
      query.fieldName = fieldName;
    }
    if (startDate || endDate) {
      query.changedAt = {};
      if (startDate) {
        query.changedAt.$gte = new Date(startDate);
      }
      if (endDate) {
        // Add a day to include the entire end date
        const endDatePlusOne = new Date(endDate);
        endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
        query.changedAt.$lt = endDatePlusOne;
      }
    }
    if (search) {
      query.$or = [
        { leadName: { $regex: search, $options: "i" } },
        { leadEmail: { $regex: search, $options: "i" } },
        { changedByName: { $regex: search, $options: "i" } },
        { details: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, total] = await Promise.all([
      LeadAuditLog.find(query)
        .sort({ changedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate("changedBy", "fullName email")
        .lean(),
      LeadAuditLog.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        logs,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error getting global lead audit logs:", error);
    next(error);
  }
};