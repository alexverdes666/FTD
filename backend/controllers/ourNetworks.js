const { validationResult } = require("express-validator");
const mongoose = require("mongoose");
const OurNetwork = require("../models/OurNetwork");
const User = require("../models/User");
const Lead = require("../models/Lead");
const NetworkAuditService = require("../services/networkAuditService");

exports.getOurNetworks = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, isActive } = req.query;
    const filter = {};

    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    if (req.user.role === "affiliate_manager") {
      filter.assignedAffiliateManager = req.user._id;
    }

    const skip = (page - 1) * limit;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    // If search is provided, use multi-keyword search with AND logic
    if (search) {
      // Fetch all networks matching the base filter (without search)
      const baseNetworks = await OurNetwork.find(filter)
        .populate("assignedAffiliateManager", "fullName email")
        .populate("createdBy", "fullName email")
        .sort({ createdAt: -1 });

      // Split search into multiple keywords and filter with AND logic
      const searchKeywords = search.toLowerCase().trim().split(/\s+/).filter(k => k.length > 0);

      const filteredNetworks = baseNetworks.filter((network) => {
        // Helper function to check if a keyword matches any field in the network
        const matchesKeyword = (keyword) => {
          // Search in network ID
          if (network._id.toString().toLowerCase().includes(keyword)) return true;

          // Search in name
          if (network.name?.toLowerCase().includes(keyword)) return true;

          // Search in description
          if (network.description?.toLowerCase().includes(keyword)) return true;

          // Search in assigned affiliate manager
          if (network.assignedAffiliateManager?.fullName?.toLowerCase().includes(keyword)) return true;
          if (network.assignedAffiliateManager?.email?.toLowerCase().includes(keyword)) return true;

          // Search in created by user
          if (network.createdBy?.fullName?.toLowerCase().includes(keyword)) return true;
          if (network.createdBy?.email?.toLowerCase().includes(keyword)) return true;

          // Search in crypto wallet addresses
          if (network.cryptoWallets?.ethereum) {
            const ethereumAddresses = Array.isArray(network.cryptoWallets.ethereum)
              ? network.cryptoWallets.ethereum
              : [network.cryptoWallets.ethereum];
            if (ethereumAddresses.some(addr => addr?.toLowerCase().includes(keyword))) return true;
          }

          if (network.cryptoWallets?.bitcoin) {
            const bitcoinAddresses = Array.isArray(network.cryptoWallets.bitcoin)
              ? network.cryptoWallets.bitcoin
              : [network.cryptoWallets.bitcoin];
            if (bitcoinAddresses.some(addr => addr?.toLowerCase().includes(keyword))) return true;
          }

          if (network.cryptoWallets?.tron) {
            const tronAddresses = Array.isArray(network.cryptoWallets.tron)
              ? network.cryptoWallets.tron
              : [network.cryptoWallets.tron];
            if (tronAddresses.some(addr => addr?.toLowerCase().includes(keyword))) return true;
          }

          // Search in active status
          if (network.isActive && keyword === "active") return true;
          if (!network.isActive && keyword === "inactive") return true;

          return false;
        };

        // Network must match ALL keywords (AND logic)
        return searchKeywords.every(keyword => matchesKeyword(keyword));
      });

      // Apply pagination to filtered results
      const total = filteredNetworks.length;
      const paginatedNetworks = filteredNetworks.slice(skip, skip + limitNum);

      return res.status(200).json({
        success: true,
        data: paginatedNetworks,
        pagination: {
          current: pageNum,
          pages: Math.ceil(total / limitNum),
          total,
          limit: limitNum,
        },
      });
    }

    // No search - use regular query
    const [ourNetworks, total] = await Promise.all([
      OurNetwork.find(filter)
        .populate("assignedAffiliateManager", "fullName email")
        .populate("createdBy", "fullName email")
        .skip(skip)
        .limit(limitNum)
        .sort({ createdAt: -1 }),
      OurNetwork.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: ourNetworks,
      pagination: {
        current: pageNum,
        pages: Math.ceil(total / limitNum),
        total,
        limit: limitNum,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getOurNetwork = async (req, res, next) => {
  try {
    const ourNetwork = await OurNetwork.findById(req.params.id)
      .populate("assignedAffiliateManager", "fullName email")
      .populate("createdBy", "fullName email");

    if (!ourNetwork) {
      return res.status(404).json({
        success: false,
        message: "Our network not found",
      });
    }

    if (req.user.role === "affiliate_manager") {
      const isAssigned =
        ourNetwork.assignedAffiliateManager &&
        ourNetwork.assignedAffiliateManager._id.toString() ===
          req.user._id.toString();
      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: "Access denied - our network not assigned to you",
        });
      }
    }

    res.status(200).json({
      success: true,
      data: ourNetwork,
    });
  } catch (error) {
    next(error);
  }
};

exports.createOurNetwork = async (req, res, next) => {
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
      name,
      description,
      assignedAffiliateManager,
      cryptoWallets = {},
    } = req.body;

    if (assignedAffiliateManager) {
      const manager = await User.findOne({
        _id: assignedAffiliateManager,
        role: "affiliate_manager",
        isActive: true,
        status: "approved",
      });

      if (!manager) {
        return res.status(400).json({
          success: false,
          message: "Affiliate manager is invalid or inactive",
        });
      }
    }

    const ourNetwork = new OurNetwork({
      name,
      description,
      assignedAffiliateManager,
      cryptoWallets,
      createdBy: req.user._id,
    });

    await ourNetwork.save();
    await ourNetwork.populate([
      { path: "assignedAffiliateManager", select: "fullName email" },
      { path: "createdBy", select: "fullName email" },
    ]);

    // Log the network creation
    await NetworkAuditService.logNetworkCreated(ourNetwork, req.user, req);

    res.status(201).json({
      success: true,
      message: "Our network created successfully",
      data: ourNetwork,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Our network name already exists",
      });
    }
    next(error);
  }
};

exports.updateOurNetwork = async (req, res, next) => {
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
      name,
      description,
      assignedAffiliateManager,
      isActive,
      cryptoWallets,
    } = req.body;

    const ourNetwork = await OurNetwork.findById(req.params.id);
    if (!ourNetwork) {
      return res.status(404).json({
        success: false,
        message: "Our network not found",
      });
    }

    // Store previous data for audit logging
    const previousData = {
      name: ourNetwork.name,
      description: ourNetwork.description,
      assignedAffiliateManager: ourNetwork.assignedAffiliateManager,
      isActive: ourNetwork.isActive,
      cryptoWallets: JSON.parse(JSON.stringify(ourNetwork.cryptoWallets || {})),
    };

    if (assignedAffiliateManager) {
      const manager = await User.findOne({
        _id: assignedAffiliateManager,
        role: "affiliate_manager",
        isActive: true,
        status: "approved",
      });

      if (!manager) {
        return res.status(400).json({
          success: false,
          message: "Affiliate manager is invalid or inactive",
        });
      }
    }

    if (name !== undefined) ourNetwork.name = name;
    if (description !== undefined) ourNetwork.description = description;
    if (assignedAffiliateManager !== undefined)
      ourNetwork.assignedAffiliateManager = assignedAffiliateManager;
    if (isActive !== undefined) ourNetwork.isActive = isActive;
    if (cryptoWallets !== undefined) ourNetwork.cryptoWallets = cryptoWallets;

    await ourNetwork.save();
    await ourNetwork.populate([
      { path: "assignedAffiliateManager", select: "fullName email" },
      { path: "createdBy", select: "fullName email" },
    ]);

    // Log the network update with detailed changes
    await NetworkAuditService.logNetworkUpdated(
      ourNetwork,
      previousData,
      req.body,
      req.user,
      req
    );

    res.status(200).json({
      success: true,
      message: "Our network updated successfully",
      data: ourNetwork,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Our network name already exists",
      });
    }
    next(error);
  }
};

exports.deleteOurNetwork = async (req, res, next) => {
  try {
    const ourNetwork = await OurNetwork.findById(req.params.id);
    if (!ourNetwork) {
      return res.status(404).json({
        success: false,
        message: "Our network not found",
      });
    }

    // Log the network deletion before actually deleting
    await NetworkAuditService.logNetworkDeleted(ourNetwork, req.user, req);

    await OurNetwork.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Our network deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

exports.getMyOurNetworks = async (req, res, next) => {
  try {
    if (req.user.role !== "affiliate_manager") {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Only affiliate managers can access this endpoint.",
      });
    }

    const ourNetworks = await OurNetwork.find({
      assignedAffiliateManager: req.user._id,
      isActive: true,
    })
      .populate("assignedAffiliateManager", "fullName email")
      .populate("createdBy", "fullName email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: ourNetworks,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get audit logs for a specific network
 */
exports.getNetworkAuditLogs = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      page = 1,
      limit = 20,
      category,
      action,
      startDate,
      endDate,
    } = req.query;

    // Check if network exists
    const network = await OurNetwork.findById(id);
    if (!network) {
      return res.status(404).json({
        success: false,
        message: "Network not found",
      });
    }

    const result = await NetworkAuditService.getNetworkLogs(id, {
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

/**
 * Get all audit logs (admin only)
 */
exports.getAllAuditLogs = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      networkId,
      userId,
      category,
      action,
      blockchain,
      startDate,
      endDate,
      search,
    } = req.query;

    const result = await NetworkAuditService.getAllLogs({
      page: parseInt(page),
      limit: parseInt(limit),
      networkId,
      userId,
      category,
      action,
      blockchain,
      startDate,
      endDate,
      search,
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
