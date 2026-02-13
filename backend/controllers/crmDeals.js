const { validationResult } = require("express-validator");
const mongoose = require("mongoose");
const CrmDeal = require("../models/CrmDeal");
const ClientNetwork = require("../models/ClientNetwork");
const AgentComment = require("../models/AgentComment");
const Order = require("../models/Order");
const Lead = require("../models/Lead");

exports.getCrmDeals = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      clientNetwork,
      ourNetwork,
      affiliateManager,
      dateFrom,
      dateTo,
    } = req.query;
    const filter = {};

    if (clientNetwork) filter.clientNetwork = clientNetwork;
    if (ourNetwork) filter.ourNetwork = ourNetwork;
    if (affiliateManager) filter.affiliateManager = affiliateManager;
    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) filter.date.$gte = new Date(dateFrom);
      if (dateTo) filter.date.$lte = new Date(dateTo);
    }

    const skip = (page - 1) * limit;
    const [deals, total] = await Promise.all([
      CrmDeal.find(filter)
        .populate("clientNetwork", "name")
        .populate("ourNetwork", "name")
        .populate("affiliateManager", "fullName email")
        .populate("createdBy", "fullName email")
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ date: -1 }),
      CrmDeal.countDocuments(filter),
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

exports.getCrmDealsByNetwork = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const { networkId } = req.params;

    const clientNetwork = await ClientNetwork.findById(networkId);
    if (!clientNetwork) {
      return res.status(404).json({
        success: false,
        message: "Client network not found",
      });
    }

    const filter = { clientNetwork: clientNetwork._id };

    const skip = (page - 1) * limit;
    const [deals, total] = await Promise.all([
      CrmDeal.find(filter)
        .populate("ourNetwork", "name")
        .populate("affiliateManager", "fullName email")
        .populate("createdBy", "fullName email")
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ date: -1 }),
      CrmDeal.countDocuments(filter),
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

exports.createCrmDeal = async (req, res, next) => {
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
      clientNetwork,
      date,
      ourNetwork,
      affiliateManager,
      totalSentLeads,
      firedFtds,
      shavedFtds,
      totalPaid,
      notes,
    } = req.body;

    const deal = new CrmDeal({
      clientNetwork,
      date,
      ourNetwork,
      affiliateManager,
      totalSentLeads,
      firedFtds,
      shavedFtds,
      totalPaid,
      notes,
      createdBy: req.user._id,
    });

    await deal.save();
    await deal.populate([
      { path: "clientNetwork", select: "name" },
      { path: "ourNetwork", select: "name" },
      { path: "affiliateManager", select: "fullName email" },
      { path: "createdBy", select: "fullName email" },
    ]);

    res.status(201).json({
      success: true,
      message: "CRM deal created successfully",
      data: deal,
    });
  } catch (error) {
    next(error);
  }
};

exports.updateCrmDeal = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const deal = await CrmDeal.findById(req.params.id);
    if (!deal) {
      return res.status(404).json({
        success: false,
        message: "CRM deal not found",
      });
    }

    const {
      date,
      ourNetwork,
      affiliateManager,
      totalSentLeads,
      firedFtds,
      shavedFtds,
      totalPaid,
      notes,
    } = req.body;

    if (date !== undefined) deal.date = date;
    if (ourNetwork !== undefined) deal.ourNetwork = ourNetwork;
    if (affiliateManager !== undefined) deal.affiliateManager = affiliateManager;
    if (totalSentLeads !== undefined) deal.totalSentLeads = totalSentLeads;
    if (firedFtds !== undefined) deal.firedFtds = firedFtds;
    if (shavedFtds !== undefined) deal.shavedFtds = shavedFtds;
    if (totalPaid !== undefined) deal.totalPaid = totalPaid;
    if (notes !== undefined) deal.notes = notes;

    await deal.save();
    await deal.populate([
      { path: "clientNetwork", select: "name" },
      { path: "ourNetwork", select: "name" },
      { path: "affiliateManager", select: "fullName email" },
      { path: "createdBy", select: "fullName email" },
    ]);

    res.status(200).json({
      success: true,
      message: "CRM deal updated successfully",
      data: deal,
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteCrmDeal = async (req, res, next) => {
  try {
    const deal = await CrmDeal.findById(req.params.id);
    if (!deal) {
      return res.status(404).json({
        success: false,
        message: "CRM deal not found",
      });
    }

    await CrmDeal.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "CRM deal deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

exports.getCrmDashboardStats = async (req, res, next) => {
  try {
    // Get client networks with CRM deal counts and comment counts
    const networkStats = await CrmDeal.aggregate([
      {
        $group: {
          _id: "$clientNetwork",
          dealsCount: { $sum: 1 },
          totalSentLeads: { $sum: "$totalSentLeads" },
          totalFiredFtds: { $sum: "$firedFtds" },
          totalShavedFtds: { $sum: "$shavedFtds" },
          totalPaid: { $sum: "$totalPaid" },
        },
      },
    ]);

    // Get order counts per client network
    const orderStats = await Order.aggregate([
      {
        $match: { selectedClientNetwork: { $ne: null } },
      },
      {
        $group: {
          _id: "$selectedClientNetwork",
          ordersCount: { $sum: 1 },
        },
      },
    ]);

    // Create a map of network stats, merging CRM deals and orders
    const networkStatsMap = {};
    networkStats.forEach((stat) => {
      networkStatsMap[stat._id.toString()] = stat;
    });
    orderStats.forEach((stat) => {
      const key = stat._id.toString();
      if (!networkStatsMap[key]) {
        networkStatsMap[key] = { _id: stat._id, dealsCount: 0 };
      }
      networkStatsMap[key].ordersCount = stat.ordersCount;
    });

    // Get unresolved comments count per client network
    const commentStats = await AgentComment.aggregate([
      {
        $match: {
          targetType: "client_network",
          isResolved: false,
          parentComment: null,
        },
      },
      {
        $group: {
          _id: "$targetId",
          unresolvedCount: { $sum: 1 },
        },
      },
    ]);

    const commentStatsMap = {};
    commentStats.forEach((stat) => {
      commentStatsMap[stat._id.toString()] = stat.unresolvedCount;
    });

    // Get leads count per client broker from actual lead assignments (not order exclusion filters)
    const brokerStats = await Lead.aggregate([
      { $unwind: "$assignedClientBrokers" },
      {
        $group: {
          _id: "$assignedClientBrokers",
          totalLeads: { $sum: 1 },
          leadIds: { $push: "$_id" },
        },
      },
    ]);

    // Get unique PSP counts per broker from deposit confirmations
    const allBrokerLeadIds = brokerStats.flatMap((s) => s.leadIds);
    let brokerPspMap = {};
    if (allBrokerLeadIds.length > 0) {
      const pspAgg = await Order.aggregate([
        { $match: { leads: { $in: allBrokerLeadIds } } },
        { $unwind: "$leadsMetadata" },
        {
          $match: {
            "leadsMetadata.depositConfirmed": true,
            "leadsMetadata.depositPSP": { $ne: null },
            "leadsMetadata.leadId": { $in: allBrokerLeadIds },
          },
        },
        {
          $lookup: {
            from: "leads",
            localField: "leadsMetadata.leadId",
            foreignField: "_id",
            as: "leadDoc",
          },
        },
        { $unwind: "$leadDoc" },
        { $unwind: "$leadDoc.assignedClientBrokers" },
        {
          $group: {
            _id: "$leadDoc.assignedClientBrokers",
            psps: { $addToSet: "$leadsMetadata.depositPSP" },
          },
        },
      ]);
      pspAgg.forEach((entry) => {
        brokerPspMap[entry._id.toString()] = entry.psps.length;
      });
    }

    const brokerStatsMap = {};
    brokerStats.forEach((stat) => {
      brokerStatsMap[stat._id.toString()] = {
        _id: stat._id,
        totalLeads: stat.totalLeads,
        pspCount: brokerPspMap[stat._id.toString()] || 0,
      };
    });

    // Get unique broker counts per client network from lead assignments
    const networkBrokerStats = await Order.aggregate([
      { $match: { selectedClientNetwork: { $ne: null }, leads: { $exists: true, $ne: [] } } },
      { $unwind: "$leads" },
      {
        $lookup: {
          from: "leads",
          localField: "leads",
          foreignField: "_id",
          as: "leadDoc",
        },
      },
      { $unwind: "$leadDoc" },
      { $match: { "leadDoc.assignedClientBrokers": { $exists: true, $ne: [] } } },
      { $unwind: "$leadDoc.assignedClientBrokers" },
      {
        $group: {
          _id: "$selectedClientNetwork",
          brokers: { $addToSet: "$leadDoc.assignedClientBrokers" },
        },
      },
    ]);
    networkBrokerStats.forEach((stat) => {
      const key = stat._id.toString();
      if (!networkStatsMap[key]) {
        networkStatsMap[key] = { _id: stat._id, dealsCount: 0 };
      }
      networkStatsMap[key].brokerCount = stat.brokers.length;
    });

    res.status(200).json({
      success: true,
      data: {
        networkStats: networkStatsMap,
        commentStats: commentStatsMap,
        brokerStats: brokerStatsMap,
      },
    });
  } catch (error) {
    next(error);
  }
};
