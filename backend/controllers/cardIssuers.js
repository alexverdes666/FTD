const { validationResult } = require("express-validator");
const CardIssuer = require("../models/CardIssuer");
const PSP = require("../models/PSP");
const CardIssuerAuditService = require("../services/cardIssuerAuditService");

/**
 * Get all Card Issuers with pagination and filtering
 */
exports.getCardIssuers = async (req, res, next) => {
  try {
    const { page = 1, limit = 100, search, isActive } = req.query;
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
    const [cardIssuers, total] = await Promise.all([
      CardIssuer.find(filter)
        .populate("createdBy", "fullName email")
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ name: 1 }),
      CardIssuer.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: cardIssuers,
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
 * Get single Card Issuer by ID
 */
exports.getCardIssuer = async (req, res, next) => {
  try {
    const cardIssuer = await CardIssuer.findById(req.params.id).populate(
      "createdBy",
      "fullName email"
    );

    if (!cardIssuer) {
      return res.status(404).json({
        success: false,
        message: "Card Issuer not found",
      });
    }

    // Get linked PSPs count
    const linkedPSPsCount = await PSP.countDocuments({ cardIssuer: cardIssuer._id });

    res.status(200).json({
      success: true,
      data: { ...cardIssuer.toObject(), linkedPSPsCount },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get PSPs by Card Issuer
 */
exports.getPSPsByCardIssuer = async (req, res, next) => {
  try {
    const { isActive } = req.query;
    const filter = { cardIssuer: req.params.id };

    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    const psps = await PSP.find(filter)
      .populate("createdBy", "fullName email")
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      data: psps,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create new Card Issuer
 * Allowed: admin and affiliate_manager
 */
exports.createCardIssuer = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const { name, description, logo } = req.body;

    const cardIssuer = new CardIssuer({
      name: name.trim(),
      description,
      logo,
      createdBy: req.user._id,
    });

    await cardIssuer.save();
    await cardIssuer.populate("createdBy", "fullName email");

    // Log the creation
    await CardIssuerAuditService.logCreated(cardIssuer, req.user, req);

    res.status(201).json({
      success: true,
      message: "Card Issuer created successfully",
      data: cardIssuer,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "A Card Issuer with this name already exists",
      });
    }
    next(error);
  }
};

/**
 * Update Card Issuer
 * Allowed: admin only
 */
exports.updateCardIssuer = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const { name, description, logo, isActive } = req.body;

    const cardIssuer = await CardIssuer.findById(req.params.id);
    if (!cardIssuer) {
      return res.status(404).json({
        success: false,
        message: "Card Issuer not found",
      });
    }

    // Store previous data for audit logging
    const previousData = {
      name: cardIssuer.name,
      description: cardIssuer.description,
      logo: cardIssuer.logo,
      isActive: cardIssuer.isActive,
    };

    // Apply updates
    if (name !== undefined) cardIssuer.name = name.trim();
    if (description !== undefined) cardIssuer.description = description;
    if (logo !== undefined) cardIssuer.logo = logo;
    if (isActive !== undefined) cardIssuer.isActive = isActive;

    await cardIssuer.save();
    await cardIssuer.populate("createdBy", "fullName email");

    // Prepare new data for audit logging
    const newData = {
      name: name !== undefined ? name : undefined,
      description: description !== undefined ? description : undefined,
      logo: logo !== undefined ? logo : undefined,
      isActive: isActive !== undefined ? isActive : undefined,
    };

    // Log the update with detailed changes
    await CardIssuerAuditService.logUpdated(cardIssuer, previousData, newData, req.user, req);

    res.status(200).json({
      success: true,
      message: "Card Issuer updated successfully",
      data: cardIssuer,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "A Card Issuer with this name already exists",
      });
    }
    next(error);
  }
};

/**
 * Delete Card Issuer
 * Allowed: admin only
 */
exports.deleteCardIssuer = async (req, res, next) => {
  try {
    const cardIssuer = await CardIssuer.findById(req.params.id);
    if (!cardIssuer) {
      return res.status(404).json({
        success: false,
        message: "Card Issuer not found",
      });
    }

    // Check if any PSPs are linked to this Card Issuer
    const linkedPSPsCount = await PSP.countDocuments({ cardIssuer: cardIssuer._id });
    if (linkedPSPsCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete Card Issuer that is linked to ${linkedPSPsCount} PSP(s). Remove the links first.`,
        data: {
          linkedPSPsCount,
        },
      });
    }

    // Log the deletion before actually deleting
    await CardIssuerAuditService.logDeleted(cardIssuer, req.user, req);

    await CardIssuer.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Card Issuer deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Card Issuer audit logs
 */
exports.getCardIssuerAuditLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, category, action, startDate, endDate } = req.query;

    const result = await CardIssuerAuditService.getCardIssuerLogs(req.params.id, {
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
