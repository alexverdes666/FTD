const { validationResult } = require("express-validator");
const mongoose = require("mongoose");
const ClientNetwork = require("../models/ClientNetwork");
const User = require("../models/User");
const Lead = require("../models/Lead");
const Order = require("../models/Order");
const CrmDeal = require("../models/CrmDeal");
const AgentComment = require("../models/AgentComment");
const ClientBroker = require("../models/ClientBroker");
const PSP = require("../models/PSP");
const ClientNetworkAuditService = require("../services/clientNetworkAuditService");

exports.getClientNetworks = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, isActive } = req.query;
    const filter = {};

    if (search) {
      filter.$or = [
        { name: new RegExp(search, "i") },
        { description: new RegExp(search, "i") },
      ];
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    const skip = (page - 1) * limit;
    const [clientNetworks, total] = await Promise.all([
      ClientNetwork.find(filter)
        .populate("createdBy", "fullName email")
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 }),
      ClientNetwork.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: clientNetworks,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getClientNetwork = async (req, res, next) => {
  try {
    const clientNetwork = await ClientNetwork.findById(req.params.id).populate(
      "createdBy",
      "fullName email"
    );

    if (!clientNetwork) {
      return res.status(404).json({
        success: false,
        message: "Client network not found",
      });
    }

    res.status(200).json({
      success: true,
      data: clientNetwork,
    });
  } catch (error) {
    next(error);
  }
};

exports.createClientNetwork = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const { name, description } = req.body;

    const clientNetwork = new ClientNetwork({
      name,
      description,
      createdBy: req.user._id,
    });

    await clientNetwork.save();
    await clientNetwork.populate([
      { path: "createdBy", select: "fullName email" },
    ]);

    // Log the creation - logs for all users
    await ClientNetworkAuditService.logNetworkCreated(
      clientNetwork,
      req.user,
      req
    );

    res.status(201).json({
      success: true,
      message: "Client network created successfully",
      data: clientNetwork,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Client network name already exists",
      });
    }
    next(error);
  }
};

exports.updateClientNetwork = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const { name, description, isActive, dealType } = req.body;

    const clientNetwork = await ClientNetwork.findById(req.params.id);
    if (!clientNetwork) {
      return res.status(404).json({
        success: false,
        message: "Client network not found",
      });
    }

    // Store previous data for audit logging
    const previousData = {
      name: clientNetwork.name,
      description: clientNetwork.description,
      isActive: clientNetwork.isActive,
      dealType: clientNetwork.dealType,
    };

    // Apply updates
    if (name !== undefined) clientNetwork.name = name;
    if (description !== undefined) clientNetwork.description = description;
    if (isActive !== undefined) clientNetwork.isActive = isActive;
    if (dealType !== undefined) clientNetwork.dealType = dealType;

    await clientNetwork.save();
    await clientNetwork.populate([
      { path: "createdBy", select: "fullName email" },
    ]);

    // Prepare new data for audit logging
    const newData = {
      name: name !== undefined ? name : undefined,
      description: description !== undefined ? description : undefined,
      isActive: isActive !== undefined ? isActive : undefined,
      dealType: dealType !== undefined ? dealType : undefined,
    };

    // Log the update with detailed changes - logs for all users
    await ClientNetworkAuditService.logNetworkUpdated(
      clientNetwork,
      previousData,
      newData,
      req.user,
      req
    );

    res.status(200).json({
      success: true,
      message: "Client network updated successfully",
      data: clientNetwork,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Client network name already exists",
      });
    }
    next(error);
  }
};

exports.deleteClientNetwork = async (req, res, next) => {
  try {
    const clientNetwork = await ClientNetwork.findById(req.params.id);
    if (!clientNetwork) {
      return res.status(404).json({
        success: false,
        message: "Client network not found",
      });
    }

    // Log the deletion before actually deleting - logs for all users
    await ClientNetworkAuditService.logNetworkDeleted(
      clientNetwork,
      req.user,
      req
    );

    await ClientNetwork.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Client network deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get full client network profile
 * Includes employees, references, comments, and deals summary
 */
exports.getClientNetworkProfile = async (req, res, next) => {
  try {
    const clientNetwork = await ClientNetwork.findById(req.params.id)
      .populate("createdBy", "fullName email")
      .populate("employees.addedBy", "fullName email")
      .populate("references.clientNetwork", "name description isActive")
      .populate("references.addedBy", "fullName email");

    if (!clientNetwork) {
      return res.status(404).json({
        success: false,
        message: "Client network not found",
      });
    }

    // Get networks that reference this one ("referenced by")
    const referencedByNetworks = await ClientNetwork.find({
      "references.clientNetwork": clientNetwork._id,
    }).select("name description isActive references");

    // Extract the relevant reference entries pointing to this network
    const referencedBy = referencedByNetworks.map((net) => {
      const refEntry = net.references.find(
        (r) => r.clientNetwork.toString() === clientNetwork._id.toString()
      );
      return {
        _id: refEntry?._id,
        clientNetwork: {
          _id: net._id,
          name: net.name,
          description: net.description,
          isActive: net.isActive,
        },
        notes: refEntry?.notes,
        addedBy: refEntry?.addedBy,
        addedAt: refEntry?.addedAt,
      };
    });

    // Populate addedBy for referencedBy entries
    const addedByIds = referencedBy
      .map((r) => r.addedBy)
      .filter(Boolean);
    const addedByUsers = await User.find({ _id: { $in: addedByIds } }).select(
      "fullName email"
    );
    const usersMap = {};
    addedByUsers.forEach((u) => {
      usersMap[u._id.toString()] = u;
    });
    referencedBy.forEach((r) => {
      if (r.addedBy) {
        r.addedBy = usersMap[r.addedBy.toString()] || r.addedBy;
      }
    });

    // Get comments for this network grouped by ourNetwork
    const comments = await AgentComment.find({
      targetType: "client_network",
      targetId: clientNetwork._id,
      parentComment: null, // Only top-level comments
    })
      .populate("agent", "fullName email")
      .populate("ourNetwork", "name")
      .populate("resolvedBy", "fullName email")
      .populate("images", "originalName mimetype width height")
      .populate({
        path: "replies",
        populate: [
          { path: "agent", select: "fullName email" },
          { path: "images", select: "originalName mimetype width height" },
        ],
      })
      .sort({ createdAt: -1 });


    // Get deals (orders) summary for this network
    const dealsSummary = await Order.aggregate([
      { $match: { selectedClientNetwork: clientNetwork._id } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalFTDRequested: { $sum: "$requests.ftd" },
          totalFTDFulfilled: { $sum: "$fulfilled.ftd" },
          totalFillerRequested: { $sum: "$requests.filler" },
          totalFillerFulfilled: { $sum: "$fulfilled.filler" },
        },
      },
    ]);

    // Get CRM deals summary
    const crmDealsSummary = await CrmDeal.aggregate([
      { $match: { clientNetwork: clientNetwork._id } },
      {
        $group: {
          _id: null,
          totalDeals: { $sum: 1 },
          totalSentLeads: { $sum: "$totalSentLeads" },
          totalFiredFtds: { $sum: "$firedFtds" },
          totalShavedFtds: { $sum: "$shavedFtds" },
          totalPaid: { $sum: "$totalPaid" },
        },
      },
    ]);

    // Get used client brokers: leads from orders for this network that have assigned brokers
    const networkOrderLeadIds = await Order.find({ selectedClientNetwork: clientNetwork._id })
      .distinct("leads");
    let usedBrokers = [];
    let usedPsps = [];
    if (networkOrderLeadIds.length > 0) {
      // Unique broker IDs from leads in this network's orders
      const brokerIds = await Lead.find({
        _id: { $in: networkOrderLeadIds },
        assignedClientBrokers: { $exists: true, $ne: [] },
      }).distinct("assignedClientBrokers");
      if (brokerIds.length > 0) {
        usedBrokers = await ClientBroker.find({ _id: { $in: brokerIds } })
          .select("name domain isActive")
          .lean();
      }

      // Unique PSPs from deposit confirmations on this network's leads
      const pspAgg = await Order.aggregate([
        { $match: { selectedClientNetwork: clientNetwork._id } },
        { $unwind: "$leadsMetadata" },
        {
          $match: {
            "leadsMetadata.depositConfirmed": true,
            "leadsMetadata.depositPSP": { $ne: null },
          },
        },
        { $group: { _id: "$leadsMetadata.depositPSP" } },
      ]);
      const pspIds = pspAgg.map((p) => p._id);
      if (pspIds.length > 0) {
        usedPsps = await PSP.find({ _id: { $in: pspIds } })
          .select("name description website isActive")
          .lean();
      }
    }

    res.status(200).json({
      success: true,
      data: {
        ...clientNetwork.toObject(),
        referencedBy,
        comments,
        commentsCount: comments.length,
        unresolvedCommentsCount: comments.filter((c) => !c.isResolved).length,
        usedBrokers,
        usedPsps,
        dealsSummary: dealsSummary[0] || {
          totalOrders: 0,
          totalFTDRequested: 0,
          totalFTDFulfilled: 0,
          totalFillerRequested: 0,
          totalFillerFulfilled: 0,
        },
        crmDealsSummary: crmDealsSummary[0] || {
          totalDeals: 0,
          totalSentLeads: 0,
          totalFiredFtds: 0,
          totalShavedFtds: 0,
          totalPaid: 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get network deals (orders) with detailed data
 */
exports.getNetworkDeals = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const clientNetwork = await ClientNetwork.findById(req.params.id);
    if (!clientNetwork) {
      return res.status(404).json({
        success: false,
        message: "Client network not found",
      });
    }

    const filter = { selectedClientNetwork: clientNetwork._id };
    if (status) {
      filter.status = status;
    }

    const skip = (page - 1) * limit;
    const [deals, total, networkTotals] = await Promise.all([
      Order.find(filter)
        .populate("requester", "fullName email")
        .populate("selectedOurNetwork", "name")
        .populate("selectedCampaign", "name")
        .populate("selectedClientBrokers", "name domain")
        .select(
          "createdAt plannedDate status requests fulfilled requester selectedOurNetwork selectedCampaign countryFilter selectedClientBrokers leads leadsMetadata"
        )
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 }),
      Order.countDocuments(filter),
      Order.aggregate([
        { $match: { selectedClientNetwork: clientNetwork._id } },
        { $unwind: { path: "$leadsMetadata", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: null,
            totalConfirmedDeposits: {
              $sum: { $cond: [{ $eq: ["$leadsMetadata.depositConfirmed", true] }, 1, 0] },
            },
            totalShavedFtds: {
              $sum: { $cond: [{ $eq: ["$leadsMetadata.shaved", true] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    // Compute per-order counts and strip raw leadsMetadata
    const data = deals.map((order) => {
      const obj = order.toObject();
      const metadata = obj.leadsMetadata || [];
      obj.confirmedDeposits = metadata.filter((m) => m.depositConfirmed).length;
      obj.shavedFtds = metadata.filter((m) => m.shaved).length;
      delete obj.leadsMetadata;
      return obj;
    });

    const totals = networkTotals[0] || { totalConfirmedDeposits: 0, totalShavedFtds: 0 };

    res.status(200).json({
      success: true,
      data,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit),
      },
      totals: {
        confirmedDeposits: totals.totalConfirmedDeposits,
        shavedFtds: totals.totalShavedFtds,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add employee to client network
 */
exports.addEmployee = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const clientNetwork = await ClientNetwork.findById(req.params.id);
    if (!clientNetwork) {
      return res.status(404).json({
        success: false,
        message: "Client network not found",
      });
    }

    const { name, telegramUsername, position } = req.body;

    clientNetwork.employees.push({
      name,
      telegramUsername,
      position,
      isActive: true,
      addedBy: req.user._id,
      addedAt: new Date(),
    });

    await clientNetwork.save();
    await clientNetwork.populate("employees.addedBy", "fullName email");

    res.status(201).json({
      success: true,
      message: "Employee added successfully",
      data: clientNetwork.employees[clientNetwork.employees.length - 1],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update employee in client network
 */
exports.updateEmployee = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const clientNetwork = await ClientNetwork.findById(req.params.id);
    if (!clientNetwork) {
      return res.status(404).json({
        success: false,
        message: "Client network not found",
      });
    }

    const employee = clientNetwork.employees.id(req.params.empId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    const { name, telegramUsername, position, isActive } = req.body;

    if (name !== undefined) employee.name = name;
    if (telegramUsername !== undefined) employee.telegramUsername = telegramUsername;
    if (position !== undefined) employee.position = position;
    if (isActive !== undefined) employee.isActive = isActive;

    await clientNetwork.save();
    await clientNetwork.populate("employees.addedBy", "fullName email");

    res.status(200).json({
      success: true,
      message: "Employee updated successfully",
      data: employee,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove employee from client network
 */
exports.removeEmployee = async (req, res, next) => {
  try {
    const clientNetwork = await ClientNetwork.findById(req.params.id);
    if (!clientNetwork) {
      return res.status(404).json({
        success: false,
        message: "Client network not found",
      });
    }

    const employee = clientNetwork.employees.id(req.params.empId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    employee.deleteOne();
    await clientNetwork.save();

    res.status(200).json({
      success: true,
      message: "Employee removed successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add reference to client network
 */
exports.addReference = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const clientNetwork = await ClientNetwork.findById(req.params.id);
    if (!clientNetwork) {
      return res.status(404).json({
        success: false,
        message: "Client network not found",
      });
    }

    const { clientNetworkId, notes } = req.body;

    // Check if reference network exists
    const referenceNetwork = await ClientNetwork.findById(clientNetworkId);
    if (!referenceNetwork) {
      return res.status(404).json({
        success: false,
        message: "Reference network not found",
      });
    }

    // Check if reference already exists
    const existingRef = clientNetwork.references.find(
      (ref) => ref.clientNetwork.toString() === clientNetworkId
    );
    if (existingRef) {
      return res.status(400).json({
        success: false,
        message: "Reference already exists",
      });
    }

    // Prevent self-reference
    if (clientNetwork._id.toString() === clientNetworkId) {
      return res.status(400).json({
        success: false,
        message: "Cannot add self as reference",
      });
    }

    clientNetwork.references.push({
      clientNetwork: clientNetworkId,
      notes,
      addedBy: req.user._id,
      addedAt: new Date(),
    });

    await clientNetwork.save();
    await clientNetwork.populate([
      { path: "references.clientNetwork", select: "name description isActive" },
      { path: "references.addedBy", select: "fullName email" },
    ]);

    res.status(201).json({
      success: true,
      message: "Reference added successfully",
      data: clientNetwork.references[clientNetwork.references.length - 1],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove reference from client network
 */
exports.removeReference = async (req, res, next) => {
  try {
    const clientNetwork = await ClientNetwork.findById(req.params.id);
    if (!clientNetwork) {
      return res.status(404).json({
        success: false,
        message: "Client network not found",
      });
    }

    const reference = clientNetwork.references.id(req.params.refId);
    if (!reference) {
      return res.status(404).json({
        success: false,
        message: "Reference not found",
      });
    }

    reference.deleteOne();
    await clientNetwork.save();

    res.status(200).json({
      success: true,
      message: "Reference removed successfully",
    });
  } catch (error) {
    next(error);
  }
};
