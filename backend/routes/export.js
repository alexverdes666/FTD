const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const Lead = require("../models/Lead");
const User = require("../models/User");

/**
 * @route   GET /api/export/orders
 * @desc    Export orders with their leads for external API consumption
 * @access  Public (consider adding API key authentication for production)
 * @query   orderId - Optional: filter by specific order ID
 *          requesterEmail - Optional: filter by requester's email address
 *          startDate - Optional: filter orders from this date (ISO format)
 *          endDate - Optional: filter orders until this date (ISO format)
 *          country - Optional: filter by country
 *          limit - Optional: limit number of results (default 100, max 500)
 *          page - Optional: pagination page number (default 1)
 */
router.get("/orders", async (req, res) => {
  try {
    const {
      orderId,
      requesterEmail,
      startDate,
      endDate,
      country,
      limit = 100,
      page = 1,
    } = req.query;

    // Build filter
    const filter = {};

    if (orderId) {
      filter._id = orderId;
    }

    // Filter by requester email
    if (requesterEmail) {
      const user = await User.findOne({
        email: { $regex: `^${requesterEmail}$`, $options: "i" }
      }).select("_id");

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User with the specified email not found",
        });
      }
      filter.requester = user._id;
    }

    if (startDate || endDate) {
      filter.plannedDate = {};
      if (startDate) {
        filter.plannedDate.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.plannedDate.$lte = new Date(endDate);
      }
    }

    if (country) {
      filter.countryFilter = { $regex: country, $options: "i" };
    }

    // Pagination
    const limitNum = Math.min(Math.max(parseInt(limit) || 100, 1), 500);
    const pageNum = Math.max(parseInt(page) || 1, 1);
    const skip = (pageNum - 1) * limitNum;

    // Get total count for pagination
    const total = await Order.countDocuments(filter);

    // Fetch orders with populated references
    const orders = await Order.find(filter)
      .populate("requester", "firstName lastName email")
      .populate("selectedCampaign", "name")
      .populate("selectedOurNetwork", "name")
      .populate({
        path: "leads",
        select: "firstName lastName newPhone newEmail country",
      })
      .select(
        "_id requester selectedCampaign selectedOurNetwork countryFilter plannedDate leads createdAt"
      )
      .sort({ plannedDate: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Transform orders to the desired format
    const exportData = orders.map((order) => ({
      orderId: order._id,
      requester: order.requester
        ? `${order.requester.firstName || ""} ${order.requester.lastName || ""}`.trim()
        : null,
      requesterEmail: order.requester?.email || null,
      campaignName: order.selectedCampaign?.name || null,
      ourNetworkName: order.selectedOurNetwork?.name || null,
      country: order.countryFilter || null,
      plannedDate: order.plannedDate,
      createdAt: order.createdAt,
      leads: (order.leads || []).map((lead) => ({
        fullName: `${lead.firstName || ""} ${lead.lastName || ""}`.trim(),
        phone: lead.newPhone || null,
        email: lead.newEmail || null,
      })),
    }));

    res.status(200).json({
      success: true,
      data: {
        orders: exportData,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    console.error("Export API error:", error);
    res.status(500).json({
      success: false,
      message: "Error exporting orders",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * @route   GET /api/export/orders/:orderId
 * @desc    Export a single order with its leads
 * @access  Public
 */
router.get("/orders/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate("requester", "firstName lastName email")
      .populate("selectedCampaign", "name")
      .populate("selectedOurNetwork", "name")
      .populate({
        path: "leads",
        select: "firstName lastName newPhone newEmail country",
      })
      .select(
        "_id requester selectedCampaign selectedOurNetwork countryFilter plannedDate leads createdAt"
      )
      .lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const exportData = {
      orderId: order._id,
      requester: order.requester
        ? `${order.requester.firstName || ""} ${order.requester.lastName || ""}`.trim()
        : null,
      requesterEmail: order.requester?.email || null,
      campaignName: order.selectedCampaign?.name || null,
      ourNetworkName: order.selectedOurNetwork?.name || null,
      country: order.countryFilter || null,
      plannedDate: order.plannedDate,
      createdAt: order.createdAt,
      leads: (order.leads || []).map((lead) => ({
        fullName: `${lead.firstName || ""} ${lead.lastName || ""}`.trim(),
        phone: lead.newPhone || null,
        email: lead.newEmail || null,
      })),
    };

    res.status(200).json({
      success: true,
      data: exportData,
    });
  } catch (error) {
    console.error("Export API error:", error);
    res.status(500).json({
      success: false,
      message: "Error exporting order",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

module.exports = router;
