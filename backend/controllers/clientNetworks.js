const { validationResult } = require("express-validator");
const mongoose = require("mongoose");
const ClientNetwork = require("../models/ClientNetwork");
const User = require("../models/User");
const Lead = require("../models/Lead");
const Order = require("../models/Order");
const AgentComment = require("../models/AgentComment");
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

    const { name, description, isActive } = req.body;

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
    };

    // Apply updates
    if (name !== undefined) clientNetwork.name = name;
    if (description !== undefined) clientNetwork.description = description;
    if (isActive !== undefined) clientNetwork.isActive = isActive;

    await clientNetwork.save();
    await clientNetwork.populate([
      { path: "createdBy", select: "fullName email" },
    ]);

    // Prepare new data for audit logging
    const newData = {
      name: name !== undefined ? name : undefined,
      description: description !== undefined ? description : undefined,
      isActive: isActive !== undefined ? isActive : undefined,
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

    // Get comments for this network grouped by ourNetwork
    const comments = await AgentComment.find({
      targetType: "client_network",
      targetId: clientNetwork._id,
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

    // Group comments by ourNetwork
    const groupedComments = {};
    comments.forEach((comment) => {
      const networkKey = comment.ourNetwork?._id?.toString() || "unassigned";
      const networkName = comment.ourNetwork?.name || "Unassigned";
      if (!groupedComments[networkKey]) {
        groupedComments[networkKey] = {
          ourNetwork: comment.ourNetwork || { _id: null, name: "Unassigned" },
          comments: [],
        };
      }
      groupedComments[networkKey].comments.push(comment);
    });

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

    res.status(200).json({
      success: true,
      data: {
        ...clientNetwork.toObject(),
        groupedComments: Object.values(groupedComments),
        commentsCount: comments.length,
        unresolvedCommentsCount: comments.filter((c) => !c.isResolved).length,
        dealsSummary: dealsSummary[0] || {
          totalOrders: 0,
          totalFTDRequested: 0,
          totalFTDFulfilled: 0,
          totalFillerRequested: 0,
          totalFillerFulfilled: 0,
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
    const [deals, total] = await Promise.all([
      Order.find(filter)
        .populate("requester", "fullName email")
        .populate("selectedOurNetwork", "name")
        .populate("selectedCampaign", "name")
        .select(
          "createdAt plannedDate status requests fulfilled requester selectedOurNetwork selectedCampaign"
        )
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 }),
      Order.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: deals,
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
