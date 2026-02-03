const { validationResult } = require("express-validator");
const PSP = require("../models/PSP");
const ClientBroker = require("../models/ClientBroker");
const CardIssuer = require("../models/CardIssuer");
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
        { website: new RegExp(search, "i") },
      ];
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    const skip = (page - 1) * limit;
    const [psps, total] = await Promise.all([
      PSP.find(filter)
        .populate("createdBy", "fullName email")
        .populate("cardIssuer", "name description logo")
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
    const psp = await PSP.findById(req.params.id)
      .populate("createdBy", "fullName email")
      .populate("cardIssuer", "name description logo");

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
    const psp = await PSP.findById(req.params.id)
      .populate("createdBy", "fullName email")
      .populate("cardIssuer", "name description logo");

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
 * Extract domain name from URL
 */
const extractDomainName = (url) => {
  try {
    // Add protocol if missing
    let urlWithProtocol = url;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      urlWithProtocol = "https://" + url;
    }
    const urlObj = new URL(urlWithProtocol);
    // Get hostname and remove 'www.' prefix if present
    let domain = urlObj.hostname.replace(/^www\./, "");
    // Remove TLD to get just the name (e.g., "stripe.com" -> "stripe")
    const parts = domain.split(".");
    if (parts.length >= 2) {
      // Return the main domain name (before the TLD)
      return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    }
    return domain.charAt(0).toUpperCase() + domain.slice(1);
  } catch (error) {
    // If URL parsing fails, just return the input with capitalized first letter
    return url.charAt(0).toUpperCase() + url.slice(1);
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

    const { description, website, cardIssuer } = req.body;

    // Validate cardIssuer if provided
    if (cardIssuer) {
      const issuer = await CardIssuer.findById(cardIssuer);
      if (!issuer) {
        return res.status(400).json({
          success: false,
          message: "Card Issuer not found",
        });
      }
    }

    // Auto-extract name from website URL
    const name = extractDomainName(website);

    const psp = new PSP({
      name,
      description,
      website,
      cardIssuer: cardIssuer || null,
      createdBy: req.user._id,
    });

    await psp.save();
    await psp.populate([
      { path: "createdBy", select: "fullName email" },
      { path: "cardIssuer", select: "name description logo" },
    ]);

    // Log the creation
    await PSPAuditService.logPSPCreated(psp, req.user, req);

    res.status(201).json({
      success: true,
      message: "PSP created successfully",
      data: psp,
    });
  } catch (error) {
    if (error.code === 11000) {
      // Find and return the existing PSP so the frontend can use it
      const existingPsp = await PSP.findOne({ name })
        .populate("createdBy", "fullName email")
        .populate("cardIssuer", "name description logo");

      if (existingPsp) {
        return res.status(409).json({
          success: false,
          message: "A PSP with this domain already exists",
          existingPsp: existingPsp,
        });
      }

      return res.status(400).json({
        success: false,
        message: "A PSP with this domain already exists",
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

    const { name, description, website, cardIssuer, isActive } = req.body;

    const psp = await PSP.findById(req.params.id);
    if (!psp) {
      return res.status(404).json({
        success: false,
        message: "PSP not found",
      });
    }

    // Validate cardIssuer if provided
    if (cardIssuer !== undefined && cardIssuer !== null) {
      const issuer = await CardIssuer.findById(cardIssuer);
      if (!issuer) {
        return res.status(400).json({
          success: false,
          message: "Card Issuer not found",
        });
      }
    }

    // Store previous data for audit logging
    const previousData = {
      name: psp.name,
      description: psp.description,
      website: psp.website,
      cardIssuer: psp.cardIssuer,
      isActive: psp.isActive,
    };

    // Apply updates
    if (name !== undefined) psp.name = name;
    if (description !== undefined) psp.description = description;
    // If website changes, update the name automatically
    if (website !== undefined) {
      psp.website = website;
      psp.name = extractDomainName(website);
    }
    if (cardIssuer !== undefined) psp.cardIssuer = cardIssuer;
    if (isActive !== undefined) psp.isActive = isActive;

    await psp.save();
    await psp.populate([
      { path: "createdBy", select: "fullName email" },
      { path: "cardIssuer", select: "name description logo" },
    ]);

    // Prepare new data for audit logging
    const newData = {
      name: name !== undefined ? name : (website !== undefined ? psp.name : undefined),
      description: description !== undefined ? description : undefined,
      website: website !== undefined ? website : undefined,
      cardIssuer: cardIssuer !== undefined ? cardIssuer : undefined,
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
        message: "A PSP with this domain already exists",
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
