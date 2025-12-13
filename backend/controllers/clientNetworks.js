const { validationResult } = require("express-validator");
const mongoose = require("mongoose");
const ClientNetwork = require("../models/ClientNetwork");
const User = require("../models/User");
const Lead = require("../models/Lead");
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
