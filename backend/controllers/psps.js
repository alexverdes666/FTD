const { validationResult } = require("express-validator");
const PSP = require("../models/PSP");
const ClientBroker = require("../models/ClientBroker");
const PSPAuditService = require("../services/pspAuditService");

/**
 * Get all PSPs with pagination and filtering
 */
exports.getPSPs = async (req, res, next) => {
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
    const [psps, total] = await Promise.all([
      PSP.find(filter)
        .populate("createdBy", "fullName email")
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 }),
      PSP.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: psps,
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
 * Get single PSP by ID
 */
exports.getPSP = async (req, res, next) => {
  try {
    const psp = await PSP.findById(req.params.id).populate(
      "createdBy",
      "fullName email"
    );

    if (!psp) {
      return res.status(404).json({
        success: false,
        message: "PSP not found",
      });
    }

    res.status(200).json({
      success: true,
      data: psp,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get PSP profile with linked brokers
 */
exports.getPSPProfile = async (req, res, next) => {
  try {
    const psp = await PSP.findById(req.params.id).populate(
      "createdBy",
      "fullName email"
    );

    if (!psp) {
      return res.status(404).json({
        success: false,
        message: "PSP not found",
      });
    }

    // Get linked brokers
    const linkedBrokers = await ClientBroker.find({ psps: psp._id })
      .select("name domain description isActive")
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      data: {
        ...psp.toObject(),
        linkedBrokers,
        linkedBrokersCount: linkedBrokers.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create new PSP
 */
exports.createPSP = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const { name, description, website } = req.body;

    const psp = new PSP({
      name,
      description,
      website,
      createdBy: req.user._id,
    });

    await psp.save();
    await psp.populate([{ path: "createdBy", select: "fullName email" }]);

    // Log the creation
    await PSPAuditService.logPSPCreated(psp, req.user, req);

    res.status(201).json({
      success: true,
      message: "PSP created successfully",
      data: psp,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "PSP name already exists",
      });
    }
    next(error);
  }
};

/**
 * Update PSP
 */
exports.updatePSP = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const { name, description, website, isActive } = req.body;

    const psp = await PSP.findById(req.params.id);
    if (!psp) {
      return res.status(404).json({
        success: false,
        message: "PSP not found",
      });
    }

    // Store previous data for audit logging
    const previousData = {
      name: psp.name,
      description: psp.description,
      website: psp.website,
      isActive: psp.isActive,
    };

    // Apply updates
    if (name !== undefined) psp.name = name;
    if (description !== undefined) psp.description = description;
    if (website !== undefined) psp.website = website;
    if (isActive !== undefined) psp.isActive = isActive;

    await psp.save();
    await psp.populate([{ path: "createdBy", select: "fullName email" }]);

    // Prepare new data for audit logging
    const newData = {
      name: name !== undefined ? name : undefined,
      description: description !== undefined ? description : undefined,
      website: website !== undefined ? website : undefined,
      isActive: isActive !== undefined ? isActive : undefined,
    };

    // Log the update with detailed changes
    await PSPAuditService.logPSPUpdated(psp, previousData, newData, req.user, req);

    res.status(200).json({
      success: true,
      message: "PSP updated successfully",
      data: psp,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "PSP name already exists",
      });
    }
    next(error);
  }
};

/**
 * Delete PSP
 */
exports.deletePSP = async (req, res, next) => {
  try {
    const psp = await PSP.findById(req.params.id);
    if (!psp) {
      return res.status(404).json({
        success: false,
        message: "PSP not found",
      });
    }

    // Check if PSP is linked to any brokers
    const linkedBrokersCount = await ClientBroker.countDocuments({ psps: psp._id });
    if (linkedBrokersCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete PSP that is linked to ${linkedBrokersCount} broker(s). Remove the links first.`,
        data: {
          linkedBrokersCount,
        },
      });
    }

    // Log the deletion before actually deleting
    await PSPAuditService.logPSPDeleted(psp, req.user, req);

    await PSP.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "PSP deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get PSP audit logs
 */
exports.getPSPAuditLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, category, action, startDate, endDate } = req.query;

    const result = await PSPAuditService.getPSPLogs(req.params.id, {
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
