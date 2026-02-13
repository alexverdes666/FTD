const { validationResult } = require("express-validator");
const ClientBroker = require("../models/ClientBroker");
const Lead = require("../models/Lead");
const Order = require("../models/Order");
const PSP = require("../models/PSP");
const AgentComment = require("../models/AgentComment");
const ClientBrokerAuditService = require("../services/clientBrokerAuditService");
exports.getClientBrokers = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      isActive,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;
    const query = {};
    if (search) {
      query.$or = [
        { name: new RegExp(search, "i") },
        { domain: new RegExp(search, "i") },
        { description: new RegExp(search, "i") },
      ];
    }
    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort,
      populate: [
        { path: "createdBy", select: "fullName email" },
        {
          path: "assignedLeads",
          select: "firstName lastName newEmail leadType",
        },
      ],
    };
    const result = await ClientBroker.paginate(query, options);
    res.status(200).json({
      success: true,
      data: result.docs,
      pagination: {
        page: result.page,
        pages: result.totalPages,
        total: result.totalDocs,
        limit: result.limit,
      },
    });
  } catch (error) {
    next(error);
  }
};
exports.getClientBroker = async (req, res, next) => {
  try {
    const clientBroker = await ClientBroker.findById(req.params.id)
      .populate("createdBy", "fullName email")
      .populate(
        "assignedLeads",
        "firstName lastName newEmail leadType country"
      );
    if (!clientBroker) {
      return res.status(404).json({
        success: false,
        message: "Client broker not found",
      });
    }
    res.status(200).json({
      success: true,
      data: clientBroker,
    });
  } catch (error) {
    next(error);
  }
};
exports.createClientBroker = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }
    const { name, domain, description } = req.body;

    const brokerData = {
      name,
      description,
      createdBy: req.user._id,
    };

    if (domain) {
      brokerData.domain = domain;
    }

    const clientBroker = new ClientBroker(brokerData);

    await clientBroker.save();
    await clientBroker.populate("createdBy", "fullName email");

    // Log the creation
    await ClientBrokerAuditService.logBrokerCreated(clientBroker, req.user, req);

    res.status(201).json({
      success: true,
      message: "Client broker created successfully",
      data: clientBroker,
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const value = error.keyValue[field];

      console.log(
        `[DEBUG] Duplicate key error during CREATE - Field: ${field}, Value: '${value}', Type: ${typeof value}`
      );

      return res.status(400).json({
        success: false,
        message: `Client broker ${field} '${value || "empty"}' already exists`,
        details: {
          conflictingField: field,
          conflictingValue: value,
          action: "create",
        },
      });
    }
    next(error);
  }
};
exports.updateClientBroker = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }
    const { name, domain, description, isActive } = req.body;
    const clientBroker = await ClientBroker.findById(req.params.id);
    if (!clientBroker) {
      return res.status(404).json({
        success: false,
        message: "Client broker not found",
      });
    }

    // Store previous data for audit logging
    const previousData = {
      name: clientBroker.name,
      domain: clientBroker.domain,
      description: clientBroker.description,
      isActive: clientBroker.isActive,
    };

    if (name !== undefined) clientBroker.name = name;
    if (domain !== undefined) {
      // Convert empty domain string to null to work with sparse unique index
      clientBroker.domain = domain && domain.trim() ? domain.trim() : null;
    }
    if (description !== undefined) clientBroker.description = description;
    if (isActive !== undefined) clientBroker.isActive = isActive;
    await clientBroker.save();
    await clientBroker.populate("createdBy", "fullName email");

    // Log the update with detailed changes
    const newData = {
      name: name !== undefined ? name : undefined,
      domain: domain !== undefined ? (domain && domain.trim() ? domain.trim() : null) : undefined,
      description: description !== undefined ? description : undefined,
      isActive: isActive !== undefined ? isActive : undefined,
    };
    await ClientBrokerAuditService.logBrokerUpdated(clientBroker, previousData, newData, req.user, req);

    res.status(200).json({
      success: true,
      message: "Client broker updated successfully",
      data: clientBroker,
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const value = error.keyValue[field];

      console.log(
        `[DEBUG] Duplicate key error during UPDATE - Field: ${field}, Value: '${value}', Type: ${typeof value}`
      );

      return res.status(400).json({
        success: false,
        message: `Client broker ${field} '${value || "empty"}' already exists`,
        details: {
          conflictingField: field,
          conflictingValue: value,
          action: "update",
        },
      });
    }
    next(error);
  }
};
exports.deleteClientBroker = async (req, res, next) => {
  try {
    const clientBroker = await ClientBroker.findById(req.params.id);
    if (!clientBroker) {
      return res.status(404).json({
        success: false,
        message: "Client broker not found",
      });
    }
    if (clientBroker.assignedLeads.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete client broker with assigned leads. Unassign leads first.",
        data: {
          assignedLeadsCount: clientBroker.assignedLeads.length,
        },
      });
    }

    // Log the deletion before actually deleting
    await ClientBrokerAuditService.logBrokerDeleted(clientBroker, req.user, req);

    await ClientBroker.findByIdAndDelete(req.params.id);
    res.status(200).json({
      success: true,
      message: "Client broker deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
exports.assignLeadToBroker = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }
    const { leadId, orderId, intermediaryClientNetwork, domain } = req.body;
    const brokerId = req.params.id;
    const [clientBroker, lead] = await Promise.all([
      ClientBroker.findById(brokerId),
      Lead.findById(leadId),
    ]);
    if (!clientBroker) {
      return res.status(404).json({
        success: false,
        message: "Client broker not found",
      });
    }
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }
    if (!clientBroker.isActive) {
      return res.status(400).json({
        success: false,
        message: "Cannot assign lead to inactive client broker",
      });
    }
    if (lead.isAssignedToClientBroker(brokerId)) {
      return res.status(400).json({
        success: false,
        message: "Lead is already assigned to this client broker",
      });
    }
    lead.assignClientBroker(
      brokerId,
      req.user._id,
      orderId,
      intermediaryClientNetwork,
      domain
    );
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

    res.status(200).json({
      success: true,
      message: "Lead assigned to client broker successfully",
      data: {
        clientBroker: clientBroker.name,
        lead: `${lead.firstName} ${lead.lastName}`,
        assignedAt: new Date(),
      },
    });
  } catch (error) {
    next(error);
  }
};
exports.unassignLeadFromBroker = async (req, res, next) => {
  try {
    const { id: brokerId, leadId } = req.params;
    const [clientBroker, lead] = await Promise.all([
      ClientBroker.findById(brokerId),
      Lead.findById(leadId),
    ]);
    if (!clientBroker) {
      return res.status(404).json({
        success: false,
        message: "Client broker not found",
      });
    }
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }
    if (!lead.isAssignedToClientBroker(brokerId)) {
      return res.status(400).json({
        success: false,
        message: "Lead is not assigned to this client broker",
      });
    }
    lead.unassignClientBroker(brokerId);
    clientBroker.unassignLead(leadId);
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
          action: "client_broker_removed",
          leadId: lead._id,
          leadEmail: lead.email,
          performedBy: req.user._id,
          performedAt: new Date(),
          ipAddress: clientIp,
          details: `Client broker "${clientBroker.name}" removed from lead ${lead.firstName} ${lead.lastName} (${lead.email}) by ${req.user.fullName || req.user.email}`,
          previousValue: {
            clientBrokerId: clientBroker._id,
            clientBrokerName: clientBroker.name,
          },
        });
        await order.save();
      }
    }

    res.status(200).json({
      success: true,
      message: "Lead unassigned from client broker successfully",
      data: {
        clientBroker: clientBroker.name,
        lead: `${lead.firstName} ${lead.lastName}`,
        unassignedAt: new Date(),
      },
    });
  } catch (error) {
    next(error);
  }
};
exports.getBrokerLeads = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search = "", leadType, country } = req.query;
    const clientBroker = await ClientBroker.findById(req.params.id);
    if (!clientBroker) {
      return res.status(404).json({
        success: false,
        message: "Client broker not found",
      });
    }
    const query = {
      _id: { $in: clientBroker.assignedLeads },
    };
    if (search) {
      query.$or = [
        { firstName: new RegExp(search, "i") },
        { lastName: new RegExp(search, "i") },
        { newEmail: new RegExp(search, "i") },
        { newPhone: new RegExp(search, "i") },
      ];
    }
    if (leadType) {
      query.leadType = leadType;
    }
    if (country) {
      query.country = country;
    }
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: [
        { path: "createdBy", select: "fullName email" },
        { path: "orderId", select: "status createdAt" },
      ],
    };
    const result = await Lead.paginate(query, options);
    res.status(200).json({
      success: true,
      data: result.docs,
      pagination: {
        page: result.page,
        pages: result.totalPages,
        total: result.totalDocs,
        limit: result.limit,
      },
      clientBroker: {
        name: clientBroker.name,
        domain: clientBroker.domain,
      },
    });
  } catch (error) {
    next(error);
  }
};
exports.getBrokerStats = async (req, res, next) => {
  try {
    const stats = await ClientBroker.getBrokerStats();
    const [totalBrokers, activeBrokers, inactiveBrokers] = await Promise.all([
      ClientBroker.countDocuments(),
      ClientBroker.countDocuments({ isActive: true }),
      ClientBroker.countDocuments({ isActive: false }),
    ]);
    const topBrokers = await ClientBroker.find({ isActive: true })
      .sort({ totalLeadsAssigned: -1 })
      .limit(5)
      .select("name domain totalLeadsAssigned")
      .populate("assignedLeads", "firstName lastName");
    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalBrokers,
          activeBrokers,
          inactiveBrokers,
        },
        aggregatedStats: stats,
        topBrokers,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get full client broker profile
 * Includes PSPs and comments
 */
exports.getClientBrokerProfile = async (req, res, next) => {
  try {
    const clientBroker = await ClientBroker.findById(req.params.id)
      .populate("createdBy", "fullName email")
      .populate("psps", "name description website isActive");

    if (!clientBroker) {
      return res.status(404).json({
        success: false,
        message: "Client broker not found",
      });
    }

    // Get comments for this broker
    const comments = await AgentComment.find({
      targetType: "client_broker",
      targetId: clientBroker._id,
      parentComment: null, // Only top-level comments
    })
      .populate("agent", "fullName email")
      .populate("ourNetwork", "name")
      .populate("resolvedBy", "fullName email")
      .populate({
        path: "replies",
        populate: { path: "agent", select: "fullName email" },
      })
      .sort({ createdAt: -1 });

    // Count leads actually assigned to this broker (via manual "Manage Brokers")
    const totalLeads = await Lead.countDocuments({ assignedClientBrokers: clientBroker._id });

    // Fetch PSPs actually used in deposit confirmations for leads assigned to this broker
    const leadIds = await Lead.find({ assignedClientBrokers: clientBroker._id }).distinct("_id");
    let usedPsps = [];
    if (leadIds.length > 0) {
      const pspAgg = await Order.aggregate([
        { $match: { leads: { $in: leadIds } } },
        { $unwind: "$leadsMetadata" },
        {
          $match: {
            "leadsMetadata.depositConfirmed": true,
            "leadsMetadata.depositPSP": { $ne: null },
            "leadsMetadata.leadId": { $in: leadIds },
          },
        },
        { $group: { _id: "$leadsMetadata.depositPSP" } },
      ]);
      const pspIds = pspAgg.map((p) => p._id);
      if (pspIds.length > 0) {
        usedPsps = await PSP.find({ _id: { $in: pspIds } }).select("name description website isActive").lean();
      }
    }

    const stats = { totalOrders: 0, totalLeads };
    const brokerObj = clientBroker.toObject();
    // Override manually managed psps with auto-fetched deposit PSPs
    brokerObj.psps = usedPsps;

    res.status(200).json({
      success: true,
      data: {
        ...brokerObj,
        comments,
        commentsCount: comments.length,
        unresolvedCommentsCount: comments.filter((c) => !c.isResolved).length,
        totalOrders: stats.totalOrders,
        totalLeadsFromOrders: stats.totalLeads,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get orders and leads for a client broker
 */
exports.getBrokerOrdersWithLeads = async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;

    const clientBroker = await ClientBroker.findById(req.params.id);
    if (!clientBroker) {
      return res.status(404).json({
        success: false,
        message: "Client broker not found",
      });
    }

    const skip = (page - 1) * parseInt(limit);

    // Query leads that were actually assigned to this broker (via manual "Manage Brokers")
    // Not orders where this broker was used as an exclusion filter
    const [leads, total] = await Promise.all([
      Lead.find({ assignedClientBrokers: clientBroker._id })
        .select("firstName lastName newEmail leadType clientBrokerHistory")
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 }),
      Lead.countDocuments({ assignedClientBrokers: clientBroker._id }),
    ]);

    // Build lead rows with order context from clientBrokerHistory
    const rows = leads.map((lead) => {
      // Find history entries for this broker, prefer one with an orderId
      const historyEntries = (lead.clientBrokerHistory || []).filter(
        (h) => h.clientBroker && h.clientBroker.toString() === clientBroker._id.toString()
      );
      const entryWithOrder = historyEntries.find((h) => h.orderId) || historyEntries[0];
      return {
        orderId: entryWithOrder?.orderId?.toString() || null,
        orderDate: entryWithOrder?.assignedAt || lead.createdAt,
        leadId: lead._id,
        name: `${lead.firstName} ${lead.lastName}`.trim(),
        email: lead.newEmail,
        leadType: lead.leadType,
      };
    });

    res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit),
      },
      totalLeads: rows.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add PSP to client broker
 */
exports.addPSP = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const clientBroker = await ClientBroker.findById(req.params.id);
    if (!clientBroker) {
      return res.status(404).json({
        success: false,
        message: "Client broker not found",
      });
    }

    const { pspId } = req.body;

    // Check if PSP exists
    const psp = await PSP.findById(pspId);
    if (!psp) {
      return res.status(404).json({
        success: false,
        message: "PSP not found",
      });
    }

    // Check if PSP is already linked
    if (clientBroker.psps.includes(pspId)) {
      return res.status(400).json({
        success: false,
        message: "PSP is already linked to this broker",
      });
    }

    clientBroker.psps.push(pspId);
    await clientBroker.save();
    await clientBroker.populate("psps", "name description website isActive");

    // Log the PSP addition
    await ClientBrokerAuditService.logPSPAdded(clientBroker, psp, req.user, req);

    res.status(200).json({
      success: true,
      message: "PSP added to broker successfully",
      data: clientBroker,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove PSP from client broker
 */
exports.removePSP = async (req, res, next) => {
  try {
    const clientBroker = await ClientBroker.findById(req.params.id);
    if (!clientBroker) {
      return res.status(404).json({
        success: false,
        message: "Client broker not found",
      });
    }

    const { pspId } = req.params;

    // Check if PSP exists
    const psp = await PSP.findById(pspId);
    if (!psp) {
      return res.status(404).json({
        success: false,
        message: "PSP not found",
      });
    }

    // Check if PSP is linked
    const pspIndex = clientBroker.psps.findIndex(
      (p) => p.toString() === pspId
    );
    if (pspIndex === -1) {
      return res.status(400).json({
        success: false,
        message: "PSP is not linked to this broker",
      });
    }

    clientBroker.psps.splice(pspIndex, 1);
    await clientBroker.save();
    await clientBroker.populate("psps", "name description website isActive");

    // Log the PSP removal
    await ClientBrokerAuditService.logPSPRemoved(clientBroker, psp, req.user, req);

    res.status(200).json({
      success: true,
      message: "PSP removed from broker successfully",
      data: clientBroker,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get client broker audit logs
 */
exports.getBrokerAuditLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, category, action, startDate, endDate } = req.query;

    const result = await ClientBrokerAuditService.getBrokerLogs(req.params.id, {
      page: parseInt(page),
      limit: parseInt(limit),
      category,
      action,
      startDate,
      endDate,
    });

    res.status(200).json({
      success: true,
      data: result.logs,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};
