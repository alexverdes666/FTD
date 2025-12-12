const { validationResult } = require("express-validator");
const AffiliateManagerMetrics = require("../models/AffiliateManagerMetrics");
const User = require("../models/User");
const Order = require("../models/Order");
const Lead = require("../models/Lead");
const Campaign = require("../models/Campaign");
const OurNetwork = require("../models/OurNetwork");

// Get affiliate manager metrics
exports.getAffiliateManagerMetrics = async (req, res, next) => {
  try {
    const { affiliateManagerId } = req.params;
    const { startDate, endDate, period = "monthly" } = req.query;

    // Validate affiliate manager exists
    const affiliateManager = await User.findById(affiliateManagerId);
    if (!affiliateManager || affiliateManager.role !== "affiliate_manager") {
      return res.status(404).json({
        success: false,
        message: "Affiliate manager not found",
      });
    }

    // Check permissions
    if (
      req.user.role !== "admin" &&
      req.user._id.toString() !== affiliateManagerId
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const filter = { affiliateManager: affiliateManagerId };
    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const metrics = await AffiliateManagerMetrics.find(filter)
      .populate("affiliateManager", "fullName email")
      .sort({ date: -1 });

    res.status(200).json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    next(error);
  }
};

// Get aggregated metrics for affiliate manager
exports.getAggregatedMetrics = async (req, res, next) => {
  try {
    const { affiliateManagerId } = req.params;
    const { startDate, endDate } = req.query;

    // Validate affiliate manager exists
    const affiliateManager = await User.findById(affiliateManagerId);
    if (!affiliateManager || affiliateManager.role !== "affiliate_manager") {
      return res.status(404).json({
        success: false,
        message: "Affiliate manager not found",
      });
    }

    // Check permissions
    if (
      req.user.role !== "admin" &&
      req.user._id.toString() !== affiliateManagerId
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const aggregatedData = await AffiliateManagerMetrics.getAggregatedMetrics(
      affiliateManagerId,
      startDate,
      endDate
    );

    res.status(200).json({
      success: true,
      data:
        aggregatedData.length > 0
          ? aggregatedData[0]
          : {
              totalRevenue: 0,
              totalOrdersCompleted: 0,
              totalOrdersCreated: 0,
              totalLeadsManaged: 0,
              totalLeadsConverted: 0,
              avgConversionRate: 0,
              avgNetworkPerformance: 0,
              avgCampaignSuccess: 0,
              avgQualityScore: 0,
              avgClientSatisfaction: 0,
              periodsWorked: 0,
            },
    });
  } catch (error) {
    next(error);
  }
};

// Calculate and store affiliate manager metrics
exports.calculateAndStoreMetrics = async (req, res, next) => {
  try {
    const { affiliateManagerId } = req.params;
    const { date, period = "monthly" } = req.body;

    // Validate affiliate manager exists
    const affiliateManager = await User.findById(affiliateManagerId);
    if (!affiliateManager || affiliateManager.role !== "affiliate_manager") {
      return res.status(404).json({
        success: false,
        message: "Affiliate manager not found",
      });
    }

    const targetDate = new Date(date || new Date());

    // Calculate date range based on period
    let startDate, endDate;
    if (period === "monthly") {
      startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      endDate = new Date(
        targetDate.getFullYear(),
        targetDate.getMonth() + 1,
        0
      );
    } else if (period === "weekly") {
      const dayOfWeek = targetDate.getDay();
      startDate = new Date(targetDate);
      startDate.setDate(targetDate.getDate() - dayOfWeek);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
    } else {
      startDate = new Date(targetDate);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(targetDate);
      endDate.setHours(23, 59, 59, 999);
    }

    // Get orders managed by affiliate manager
    const orders = await Order.find({
      createdBy: affiliateManagerId,
      createdAt: { $gte: startDate, $lte: endDate },
    }).populate("leads");

    // Get leads assigned to affiliate manager
    const leads = await Lead.find({
      $or: [
        { assignedAgent: affiliateManagerId },
        { createdBy: affiliateManagerId },
      ],
      createdAt: { $gte: startDate, $lte: endDate },
    });

    // Get campaigns managed by affiliate manager
    const campaigns = await Campaign.find({
      assignedAffiliateManagers: affiliateManagerId,
      createdAt: { $lte: endDate },
    });

    // Get networks managed by affiliate manager
    const networks = await OurNetwork.find({
      assignedAffiliateManager: affiliateManagerId,
      createdAt: { $lte: endDate },
    });

    // Calculate metrics
    const metrics = {
      affiliateManager: affiliateManagerId,
      date: targetDate,
      period,

      // Order metrics
      ordersCompleted: orders.filter((o) => o.status === "completed").length,
      ordersCreated: orders.length,

      // Lead metrics
      leadsManaged: leads.length,
      leadsConverted: leads.filter((l) => l.status === "converted").length,

      // Revenue calculations (simplified - would need actual revenue data)
      totalRevenue: orders.reduce((sum, order) => {
        // This would need actual revenue calculation logic
        return sum + (order.value || 0);
      }, 0),

      // Network metrics
      networksManaged: networks.length,
      networkPerformance:
        networks.reduce((sum, network) => {
          // This would need actual performance calculation
          return sum + (network.performance || 0);
        }, 0) / Math.max(networks.length, 1),

      // Campaign metrics
      campaignsManaged: campaigns.length,
      campaignSuccess:
        campaigns.reduce((sum, campaign) => {
          // This would need actual success metric calculation
          return sum + (campaign.successRate || 0);
        }, 0) / Math.max(campaigns.length, 1),

      // Quality metrics (would need actual calculation)
      qualityScore: 85, // Placeholder
      clientSatisfaction: 8.5, // Placeholder

      // Detailed breakdown
      breakdown: {
        ordersBreakdown: {
          ftd: orders.filter((o) => o.requests?.ftd > 0).length,
          filler: orders.filter((o) => o.requests?.filler > 0).length,
          cold: orders.filter((o) => o.requests?.cold > 0).length,
          live: orders.filter((o) => o.requests?.live > 0).length,
        },
        networkBreakdown: networks.map((network) => ({
          networkId: network._id,
          networkName: network.name,
          performance: network.performance || 0,
          utilization: network.utilization || 0,
          revenue: network.revenue || 0,
        })),
        campaignBreakdown: campaigns.map((campaign) => ({
          campaignId: campaign._id,
          campaignName: campaign.name,
          success: campaign.successRate || 0,
          roi: campaign.roi || 0,
          revenue: campaign.revenue || 0,
        })),
      },
    };

    // Calculate derived metrics
    metrics.conversionRate =
      metrics.leadsManaged > 0
        ? metrics.leadsConverted / metrics.leadsManaged
        : 0;
    metrics.averageOrderValue =
      metrics.ordersCompleted > 0
        ? metrics.totalRevenue / metrics.ordersCompleted
        : 0;

    // Check if metrics already exist for this date
    const existingMetrics = await AffiliateManagerMetrics.findOne({
      affiliateManager: affiliateManagerId,
      date: targetDate,
    });

    if (existingMetrics) {
      // Update existing metrics
      Object.assign(existingMetrics, metrics);
      await existingMetrics.save();

      res.status(200).json({
        success: true,
        message: "Affiliate manager metrics updated successfully",
        data: existingMetrics,
      });
    } else {
      // Create new metrics
      const newMetrics = await AffiliateManagerMetrics.create(metrics);

      res.status(201).json({
        success: true,
        message: "Affiliate manager metrics calculated and stored successfully",
        data: newMetrics,
      });
    }
  } catch (error) {
    next(error);
  }
};

// Get all affiliate managers with metrics
exports.getAllAffiliateManagersWithMetrics = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const topPerformers = await AffiliateManagerMetrics.getTopPerformers(
      startDate,
      endDate,
      100 // Get all
    );

    res.status(200).json({
      success: true,
      data: topPerformers,
    });
  } catch (error) {
    next(error);
  }
};

// Update affiliate manager metrics
exports.updateAffiliateManagerMetrics = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const { metricsId } = req.params;
    const updateData = req.body;

    const metrics = await AffiliateManagerMetrics.findById(metricsId);
    if (!metrics) {
      return res.status(404).json({
        success: false,
        message: "Metrics not found",
      });
    }

    // Update metrics
    Object.assign(metrics, updateData);
    await metrics.save();

    res.status(200).json({
      success: true,
      message: "Affiliate manager metrics updated successfully",
      data: metrics,
    });
  } catch (error) {
    next(error);
  }
};

// Delete affiliate manager metrics
exports.deleteAffiliateManagerMetrics = async (req, res, next) => {
  try {
    const { metricsId } = req.params;

    const metrics = await AffiliateManagerMetrics.findByIdAndDelete(metricsId);
    if (!metrics) {
      return res.status(404).json({
        success: false,
        message: "Metrics not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Affiliate manager metrics deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Verify affiliate manager metrics
exports.verifyAffiliateManagerMetrics = async (req, res, next) => {
  try {
    const { metricsId } = req.params;

    const metrics = await AffiliateManagerMetrics.findById(metricsId);
    if (!metrics) {
      return res.status(404).json({
        success: false,
        message: "Metrics not found",
      });
    }

    metrics.isVerified = true;
    metrics.verifiedBy = req.user._id;
    metrics.verifiedAt = new Date();
    await metrics.save();

    res.status(200).json({
      success: true,
      message: "Affiliate manager metrics verified successfully",
      data: metrics,
    });
  } catch (error) {
    next(error);
  }
};
