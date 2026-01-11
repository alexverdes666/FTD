const express = require("express");
const { query } = require("express-validator");
const { protect } = require("../middleware/auth");
const Lead = require("../models/Lead");
const Order = require("../models/Order");
const User = require("../models/User");

const router = express.Router();

/**
 * @route   GET /api/global-search
 * @desc    Search across Leads, Orders, and Users simultaneously
 * @access  Protected
 */
router.get(
  "/",
  [
    protect,
    query("q")
      .trim()
      .notEmpty()
      .withMessage("Search query is required")
      .isLength({ min: 2 })
      .withMessage("Search query must be at least 2 characters"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 20 })
      .withMessage("Limit must be between 1 and 20"),
  ],
  async (req, res) => {
    try {
      const { q, limit = 5 } = req.query;
      const searchLimit = parseInt(limit);
      const searchQuery = q.trim();

      // Build regex for case-insensitive search
      const searchRegex = new RegExp(searchQuery, "i");

      // Determine user permissions based on role
      const userRole = req.user.role;
      const userId = req.user._id;

      // Results object
      const results = {
        leads: [],
        orders: [],
        users: [],
      };

      // Search Leads - based on role permissions
      if (["admin", "affiliate_manager", "lead_manager", "agent"].includes(userRole)) {
        let leadQuery = {
          isArchived: { $ne: true },
          $or: [
            { firstName: searchRegex },
            { lastName: searchRegex },
            { newEmail: searchRegex },
            { oldEmail: searchRegex },
            { newPhone: searchRegex },
            { oldPhone: searchRegex },
            { country: searchRegex },
          ],
        };

        // Agents can only see their assigned leads
        if (userRole === "agent") {
          leadQuery.assignedAgent = userId;
        }

        const leads = await Lead.find(leadQuery)
          .select("firstName lastName newEmail newPhone country leadType status createdAt")
          .sort({ createdAt: -1 })
          .limit(searchLimit)
          .lean();

        results.leads = leads.map((lead) => ({
          _id: lead._id,
          type: "lead",
          title: `${lead.firstName} ${lead.lastName}`,
          subtitle: lead.newEmail,
          meta: {
            country: lead.country,
            leadType: lead.leadType,
            status: lead.status,
            phone: lead.newPhone,
          },
        }));
      }

      // Search Orders - based on role permissions
      if (["admin", "affiliate_manager", "lead_manager"].includes(userRole)) {
        // Search by order ID or requester name
        let orderQuery = {
          status: { $ne: "cancelled" },
        };

        // For affiliate managers, only show their own orders
        if (userRole === "affiliate_manager") {
          orderQuery.requester = userId;
        }

        // If search query looks like an ObjectId, search by ID
        const isObjectId = /^[0-9a-fA-F]{24}$/.test(searchQuery);

        const orders = await Order.find(orderQuery)
          .populate("requester", "fullName email")
          .populate("selectedCampaign", "name")
          .select("status requests fulfilled countryFilter plannedDate createdAt requester selectedCampaign")
          .sort({ createdAt: -1 })
          .limit(100) // Get more to filter
          .lean();

        // Filter orders by requester name or order ID
        const filteredOrders = orders.filter((order) => {
          // Match by order ID
          if (order._id.toString().toLowerCase().includes(searchQuery.toLowerCase())) {
            return true;
          }
          // Match by requester name
          if (order.requester?.fullName && searchRegex.test(order.requester.fullName)) {
            return true;
          }
          // Match by campaign name
          if (order.selectedCampaign?.name && searchRegex.test(order.selectedCampaign.name)) {
            return true;
          }
          // Match by country filter
          if (order.countryFilter && searchRegex.test(order.countryFilter)) {
            return true;
          }
          return false;
        }).slice(0, searchLimit);

        results.orders = filteredOrders.map((order) => ({
          _id: order._id,
          type: "order",
          title: `Order #${order._id.toString().slice(-6).toUpperCase()}`,
          subtitle: order.requester?.fullName || "Unknown Requester",
          meta: {
            status: order.status,
            country: order.countryFilter,
            campaign: order.selectedCampaign?.name,
            requests: order.requests,
            fulfilled: order.fulfilled,
            plannedDate: order.plannedDate,
          },
        }));
      }

      // Search Users - admin only
      if (userRole === "admin") {
        const users = await User.find({
          isActive: true,
          $or: [
            { fullName: searchRegex },
            { email: searchRegex },
          ],
        })
          .select("fullName email role createdAt")
          .sort({ createdAt: -1 })
          .limit(searchLimit)
          .lean();

        results.users = users.map((user) => ({
          _id: user._id,
          type: "user",
          title: user.fullName,
          subtitle: user.email,
          meta: {
            role: user.role,
          },
        }));
      }

      // Calculate total results
      const totalResults =
        results.leads.length + results.orders.length + results.users.length;

      res.json({
        success: true,
        data: results,
        meta: {
          query: searchQuery,
          totalResults,
          counts: {
            leads: results.leads.length,
            orders: results.orders.length,
            users: results.users.length,
          },
        },
      });
    } catch (error) {
      console.error("Global search error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to perform search",
        error: error.message,
      });
    }
  }
);

module.exports = router;
