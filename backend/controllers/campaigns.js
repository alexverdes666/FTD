const { validationResult } = require("express-validator");
const mongoose = require("mongoose");
const Campaign = require("../models/Campaign");
const User = require("../models/User");
const Lead = require("../models/Lead");
const ClientNetwork = require("../models/ClientNetwork");
exports.getCampaigns = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, status, isActive } = req.query;
    const filter = {};
    if (search) {
      filter.$or = [
        { name: new RegExp(search, "i") },
        { description: new RegExp(search, "i") },
      ];
    }
    if (status) {
      filter.status = status;
    }
    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }
    if (req.user.role === "affiliate_manager") {
      filter.assignedAffiliateManagers = req.user._id;
    }
    const skip = (page - 1) * limit;
    const [campaigns, total] = await Promise.all([
      Campaign.find(filter)
        .populate("assignedAffiliateManagers", "fullName email")
        .populate("createdBy", "fullName email")
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 }),
      Campaign.countDocuments(filter),
    ]);
    res.status(200).json({
      success: true,
      data: campaigns,
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
exports.getCampaign = async (req, res, next) => {
  try {
    const campaign = await Campaign.findById(req.params.id)
      .populate("assignedAffiliateManagers", "fullName email")
      .populate("createdBy", "fullName email");
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }
    if (req.user.role === "affiliate_manager") {
      const isAssigned = campaign.assignedAffiliateManagers.some(
        (manager) => manager._id.toString() === req.user._id.toString()
      );
      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: "Access denied - campaign not assigned to you",
        });
      }
    }
    res.status(200).json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    next(error);
  }
};
exports.createCampaign = async (req, res, next) => {
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
      status,
      budget,
      dateRange,
      targetAudience,
      assignedAffiliateManagers = [],
    } = req.body;
    if (assignedAffiliateManagers.length > 0) {
      const managers = await User.find({
        _id: { $in: assignedAffiliateManagers },
        role: "affiliate_manager",
        isActive: true,
        status: "approved",
      });
      if (managers.length !== assignedAffiliateManagers.length) {
        return res.status(400).json({
          success: false,
          message: "One or more affiliate managers are invalid or inactive",
        });
      }
    }
    const campaign = new Campaign({
      name,
      description,
      status,
      budget,
      dateRange,
      targetAudience,
      assignedAffiliateManagers,
      createdBy: req.user._id,
    });
    await campaign.save();
    await campaign.populate([
      { path: "assignedAffiliateManagers", select: "fullName email" },
      { path: "createdBy", select: "fullName email" },
    ]);
    res.status(201).json({
      success: true,
      message: "Campaign created successfully",
      data: campaign,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Campaign name already exists",
      });
    }
    next(error);
  }
};
exports.updateCampaign = async (req, res, next) => {
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
      status,
      budget,
      dateRange,
      targetAudience,
      assignedAffiliateManagers,
      isActive,
    } = req.body;
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }
    if (assignedAffiliateManagers && assignedAffiliateManagers.length > 0) {
      const managers = await User.find({
        _id: { $in: assignedAffiliateManagers },
        role: "affiliate_manager",
        isActive: true,
        status: "approved",
      });
      if (managers.length !== assignedAffiliateManagers.length) {
        return res.status(400).json({
          success: false,
          message: "One or more affiliate managers are invalid or inactive",
        });
      }
    }
    if (name !== undefined) campaign.name = name;
    if (description !== undefined) campaign.description = description;
    if (status !== undefined) campaign.status = status;
    if (budget !== undefined) campaign.budget = budget;
    if (dateRange !== undefined) campaign.dateRange = dateRange;
    if (targetAudience !== undefined) campaign.targetAudience = targetAudience;
    if (assignedAffiliateManagers !== undefined)
      campaign.assignedAffiliateManagers = assignedAffiliateManagers;
    if (isActive !== undefined) campaign.isActive = isActive;
    await campaign.save();
    await campaign.populate([
      { path: "assignedAffiliateManagers", select: "fullName email" },
      { path: "createdBy", select: "fullName email" },
    ]);
    res.status(200).json({
      success: true,
      message: "Campaign updated successfully",
      data: campaign,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Campaign name already exists",
      });
    }
    next(error);
  }
};
exports.deleteCampaign = async (req, res, next) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }
    await Campaign.findByIdAndDelete(req.params.id);
    res.status(200).json({
      success: true,
      message: "Campaign deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
exports.getMyCampaigns = async (req, res, next) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }
    const campaigns = await Campaign.find({
      assignedAffiliateManagers: req.user._id,
      isActive: true,
      status: "active",
    })
      .select("name description campaignType status")
      .sort({ name: 1 });
    res.status(200).json({
      success: true,
      data: campaigns,
    });
  } catch (error) {
    console.error("Error in getMyCampaigns:", error);
    next(error);
  }
};
exports.getCampaignMetrics = async (req, res, next) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
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
    await campaign.updateMetrics();
    const Order = require("../models/Order");
    const orderStats = await Order.aggregate([
      { $match: { selectedCampaign: campaign._id } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const leadStats = await Lead.aggregate([
      { $match: { "campaignHistory.campaign": campaign._id } },
      { $unwind: "$campaignHistory" },
      { $match: { "campaignHistory.campaign": campaign._id } },
      {
        $group: {
          _id: "$campaignHistory.performance.status",
          count: { $sum: 1 },
        },
      },
    ]);
    res.status(200).json({
      success: true,
      data: {
        campaign: {
          _id: campaign._id,
          name: campaign.name,
          metrics: campaign.metrics,
        },
        orderStats,
        leadStats,
      },
    });
  } catch (error) {
    next(error);
  }
};