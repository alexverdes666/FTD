const express = require("express");
const { query, param } = require("express-validator");
const { protect } = require("../middleware/auth");
const Lead = require("../models/Lead");
const Order = require("../models/Order");
const User = require("../models/User");
const Campaign = require("../models/Campaign");
const Ticket = require("../models/Ticket");
const Announcement = require("../models/Announcement");
const ClientBroker = require("../models/ClientBroker");
const ClientNetwork = require("../models/ClientNetwork");
const OurNetwork = require("../models/OurNetwork");
const SearchHistory = require("../models/SearchHistory");

const router = express.Router();

// Simple in-memory cache for frequent searches
const searchCache = new Map();
const CACHE_TTL = 60000; // 1 minute
const MAX_CACHE_SIZE = 100;

// Periodically evict stale search cache entries
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of searchCache) {
    if (now - val.timestamp > CACHE_TTL) {
      searchCache.delete(key);
    }
  }
}, CACHE_TTL);

/**
 * Parse advanced search query
 * Supports: "exact phrase", type:lead, status:active, country:US, from:2024-01-01, to:2024-12-31
 */
const parseSearchQuery = (queryString) => {
  const result = {
    searchTerms: [],
    exactPhrases: [],
    filters: {
      types: [],
      status: null,
      country: null,
      dateFrom: null,
      dateTo: null,
    },
  };

  if (!queryString) return result;

  // Extract exact phrases (quoted strings)
  const exactPhraseRegex = /"([^"]+)"/g;
  let match;
  while ((match = exactPhraseRegex.exec(queryString)) !== null) {
    result.exactPhrases.push(match[1]);
  }
  
  // Remove exact phrases from query
  let remainingQuery = queryString.replace(exactPhraseRegex, " ");

  // Extract filters
  const filterPatterns = [
    { pattern: /type:(\w+)/gi, handler: (m) => result.filters.types.push(m[1].toLowerCase()) },
    { pattern: /status:(\w+)/gi, handler: (m) => result.filters.status = m[1].toLowerCase() },
    { pattern: /country:(\w+)/gi, handler: (m) => result.filters.country = m[1] },
    { pattern: /from:(\d{4}-\d{2}-\d{2})/gi, handler: (m) => result.filters.dateFrom = new Date(m[1]) },
    { pattern: /to:(\d{4}-\d{2}-\d{2})/gi, handler: (m) => result.filters.dateTo = new Date(m[1]) },
  ];

  filterPatterns.forEach(({ pattern, handler }) => {
    let filterMatch;
    while ((filterMatch = pattern.exec(remainingQuery)) !== null) {
      handler(filterMatch);
    }
    remainingQuery = remainingQuery.replace(pattern, " ");
  });

  // Remaining words are search terms
  result.searchTerms = remainingQuery
    .trim()
    .split(/\s+/)
    .filter((term) => term.length >= 2);

  return result;
};

/**
 * Build regex for search terms
 */
const buildSearchRegex = (terms, exactPhrases) => {
  const patterns = [];
  
  // Add exact phrases
  exactPhrases.forEach((phrase) => {
    patterns.push(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  });
  
  // Add individual terms
  terms.forEach((term) => {
    patterns.push(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  });

  if (patterns.length === 0) return null;
  
  return new RegExp(patterns.join("|"), "i");
};

/**
 * Get cache key for search
 */
const getCacheKey = (userId, query, limit, types) => {
  return `${userId}:${query}:${limit}:${types?.join(",") || "all"}`;
};

/**
 * Search Leads
 */
const searchLeads = async (searchRegex, filters, userId, userRole, limit) => {
  if (!searchRegex) return [];
  
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
      { campaign: searchRegex },
      { clientBroker: searchRegex },
      { source: searchRegex },
    ],
  };

  // Apply status filter
  if (filters.status) {
    leadQuery.status = filters.status;
  }

  // Apply country filter
  if (filters.country) {
    leadQuery.country = new RegExp(filters.country, "i");
  }

  // Apply date filter
  if (filters.dateFrom || filters.dateTo) {
    leadQuery.createdAt = {};
    if (filters.dateFrom) leadQuery.createdAt.$gte = filters.dateFrom;
    if (filters.dateTo) leadQuery.createdAt.$lte = filters.dateTo;
  }

  // Agents can only see their assigned leads
  if (userRole === "agent") {
    leadQuery.assignedAgent = userId;
  }

  const leads = await Lead.find(leadQuery)
    .select("firstName lastName newEmail newPhone country leadType status createdAt assignedAgent")
    .populate("assignedAgent", "fullName")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return leads.map((lead) => ({
    _id: lead._id,
    type: "lead",
    title: `${lead.firstName} ${lead.lastName}`,
    subtitle: lead.newEmail,
    meta: {
      country: lead.country,
      leadType: lead.leadType,
      status: lead.status,
      phone: lead.newPhone,
      assignedAgent: lead.assignedAgent?.fullName,
      createdAt: lead.createdAt,
    },
  }));
};

/**
 * Search Orders
 */
const searchOrders = async (searchRegex, filters, userId, userRole, limit) => {
  if (!searchRegex) return [];

  let orderQuery = {
    status: { $ne: "cancelled" },
  };

  // Apply status filter
  if (filters.status) {
    orderQuery.status = filters.status;
  }

  // Apply date filter
  if (filters.dateFrom || filters.dateTo) {
    orderQuery.createdAt = {};
    if (filters.dateFrom) orderQuery.createdAt.$gte = filters.dateFrom;
    if (filters.dateTo) orderQuery.createdAt.$lte = filters.dateTo;
  }

  // For affiliate managers, only show their own orders
  if (userRole === "affiliate_manager") {
    orderQuery.requester = userId;
  }

  const orders = await Order.find(orderQuery)
    .populate("requester", "fullName email")
    .populate("selectedCampaign", "name")
    .select("status requests fulfilled countryFilter plannedDate createdAt requester selectedCampaign")
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  // Filter orders by requester name, order ID, campaign name, or country
  const searchPattern = searchRegex;
  const filteredOrders = orders.filter((order) => {
    if (order._id.toString().toLowerCase().includes(searchRegex.source.toLowerCase())) {
      return true;
    }
    if (order.requester?.fullName && searchPattern.test(order.requester.fullName)) {
      return true;
    }
    if (order.selectedCampaign?.name && searchPattern.test(order.selectedCampaign.name)) {
      return true;
    }
    if (order.countryFilter && searchPattern.test(order.countryFilter)) {
      return true;
    }
    return false;
  }).slice(0, limit);

  return filteredOrders.map((order) => ({
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
      createdAt: order.createdAt,
    },
  }));
};

/**
 * Search Users
 */
const searchUsers = async (searchRegex, filters, limit) => {
  if (!searchRegex) return [];

  const userQuery = {
    isActive: true,
    $or: [
      { fullName: searchRegex },
      { email: searchRegex },
    ],
  };

  const users = await User.find(userQuery)
    .select("fullName email role createdAt")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return users.map((user) => ({
    _id: user._id,
    type: "user",
    title: user.fullName,
    subtitle: user.email,
    meta: {
      role: user.role,
      createdAt: user.createdAt,
    },
  }));
};

/**
 * Search Campaigns
 */
const searchCampaigns = async (searchRegex, filters, limit) => {
  if (!searchRegex) return [];

  const campaignQuery = {
    isActive: true,
    $or: [
      { name: searchRegex },
      { description: searchRegex },
    ],
  };

  if (filters.status) {
    campaignQuery.status = filters.status;
  }

  const campaigns = await Campaign.find(campaignQuery)
    .select("name description status metrics createdAt")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return campaigns.map((campaign) => ({
    _id: campaign._id,
    type: "campaign",
    title: campaign.name,
    subtitle: campaign.description || "No description",
    meta: {
      status: campaign.status,
      totalLeads: campaign.metrics?.totalLeads,
      totalOrders: campaign.metrics?.totalOrders,
      createdAt: campaign.createdAt,
    },
  }));
};

/**
 * Search Tickets
 */
const searchTickets = async (searchRegex, filters, userId, userRole, limit) => {
  if (!searchRegex) return [];

  let ticketQuery = {
    status: { $ne: "deleted" },
    $or: [
      { title: searchRegex },
      { description: searchRegex },
      { tags: searchRegex },
    ],
  };

  if (filters.status) {
    ticketQuery.status = filters.status;
  }

  // Non-admins can only see their own tickets
  if (userRole !== "admin") {
    ticketQuery.createdBy = userId;
  }

  const tickets = await Ticket.find(ticketQuery)
    .populate("createdBy", "fullName")
    .populate("assignedTo", "fullName")
    .select("title description category priority status createdBy assignedTo createdAt")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return tickets.map((ticket) => ({
    _id: ticket._id,
    type: "ticket",
    title: ticket.title,
    subtitle: `${ticket.category} - ${ticket.createdBy?.fullName || "Unknown"}`,
    meta: {
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      assignedTo: ticket.assignedTo?.fullName,
      createdAt: ticket.createdAt,
    },
  }));
};

/**
 * Search Announcements
 */
const searchAnnouncements = async (searchRegex, filters, userRole, limit) => {
  if (!searchRegex) return [];

  const announcementQuery = {
    isActive: true,
    $or: [
      { title: searchRegex },
      { message: searchRegex },
    ],
  };

  // Non-admins can only see announcements targeted to their role
  if (userRole !== "admin") {
    announcementQuery.targetRoles = userRole;
  }

  const announcements = await Announcement.find(announcementQuery)
    .populate("createdBy", "fullName")
    .select("title message priority targetRoles createdBy createdAt")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return announcements.map((announcement) => ({
    _id: announcement._id,
    type: "announcement",
    title: announcement.title,
    subtitle: announcement.message?.substring(0, 100) + (announcement.message?.length > 100 ? "..." : ""),
    meta: {
      priority: announcement.priority,
      targetRoles: announcement.targetRoles,
      createdBy: announcement.createdBy?.fullName,
      createdAt: announcement.createdAt,
    },
  }));
};

/**
 * Search Client Brokers
 */
const searchClientBrokers = async (searchRegex, filters, limit) => {
  if (!searchRegex) return [];

  const clientBrokerQuery = {
    isActive: true,
    $or: [
      { name: searchRegex },
      { domain: searchRegex },
      { description: searchRegex },
    ],
  };

  const clientBrokers = await ClientBroker.find(clientBrokerQuery)
    .select("name domain description totalLeadsAssigned createdAt")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return clientBrokers.map((broker) => ({
    _id: broker._id,
    type: "clientBroker",
    title: broker.name,
    subtitle: broker.domain || broker.description || "No description",
    meta: {
      domain: broker.domain,
      totalLeadsAssigned: broker.totalLeadsAssigned,
      createdAt: broker.createdAt,
    },
  }));
};

/**
 * Search Client Networks
 */
const searchClientNetworks = async (searchRegex, filters, limit) => {
  if (!searchRegex) return [];

  const clientNetworkQuery = {
    isActive: true,
    $or: [
      { name: searchRegex },
      { description: searchRegex },
    ],
  };

  const clientNetworks = await ClientNetwork.find(clientNetworkQuery)
    .select("name description createdAt")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return clientNetworks.map((network) => ({
    _id: network._id,
    type: "clientNetwork",
    title: network.name,
    subtitle: network.description || "No description",
    meta: {
      createdAt: network.createdAt,
    },
  }));
};

/**
 * Search Our Networks
 */
const searchOurNetworks = async (searchRegex, filters, limit) => {
  if (!searchRegex) return [];

  const ourNetworkQuery = {
    isActive: true,
    $or: [
      { name: searchRegex },
      { description: searchRegex },
    ],
  };

  const ourNetworks = await OurNetwork.find(ourNetworkQuery)
    .populate("assignedAffiliateManager", "fullName")
    .select("name description assignedAffiliateManager createdAt")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return ourNetworks.map((network) => ({
    _id: network._id,
    type: "ourNetwork",
    title: network.name,
    subtitle: network.description || "No description",
    meta: {
      assignedManager: network.assignedAffiliateManager?.fullName,
      createdAt: network.createdAt,
    },
  }));
};

/**
 * @route   GET /api/global-search
 * @desc    Search across all entities simultaneously (quick search)
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
    query("types")
      .optional()
      .isString(),
  ],
  async (req, res) => {
    try {
      const { q, limit = 5, types } = req.query;
      const searchLimit = parseInt(limit);
      const userRole = req.user.role;
      const userId = req.user._id;

      // Parse types filter
      const allowedTypes = types ? types.split(",").map((t) => t.trim().toLowerCase()) : null;

      // Check cache
      const cacheKey = getCacheKey(userId, q, searchLimit, allowedTypes);
      const cached = searchCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return res.json(cached.data);
      }

      // Parse the search query
      const parsed = parseSearchQuery(q);
      const searchRegex = buildSearchRegex(parsed.searchTerms, parsed.exactPhrases);

      // Merge parsed filters with any existing type filters
      if (allowedTypes && allowedTypes.length > 0) {
        parsed.filters.types = allowedTypes;
      }

      // Results object
      const results = {
        leads: [],
        orders: [],
        users: [],
        campaigns: [],
        tickets: [],
        announcements: [],
        clientBrokers: [],
        clientNetworks: [],
        ourNetworks: [],
      };

      // Determine which searches to run based on role and filters
      const searchPromises = [];
      const shouldSearch = (type) => {
        if (parsed.filters.types.length > 0) {
          return parsed.filters.types.includes(type);
        }
        return true;
      };

      // Search Leads
      if (shouldSearch("lead") && ["admin", "affiliate_manager", "lead_manager", "agent"].includes(userRole)) {
        searchPromises.push(
          searchLeads(searchRegex, parsed.filters, userId, userRole, searchLimit)
            .then((data) => { results.leads = data; })
        );
      }

      // Search Orders
      if (shouldSearch("order") && ["admin", "affiliate_manager", "lead_manager"].includes(userRole)) {
        searchPromises.push(
          searchOrders(searchRegex, parsed.filters, userId, userRole, searchLimit)
            .then((data) => { results.orders = data; })
        );
      }

      // Search Users (admin only)
      if (shouldSearch("user") && userRole === "admin") {
        searchPromises.push(
          searchUsers(searchRegex, parsed.filters, searchLimit)
            .then((data) => { results.users = data; })
        );
      }

      // Search Campaigns
      if (shouldSearch("campaign") && ["admin", "affiliate_manager", "lead_manager"].includes(userRole)) {
        searchPromises.push(
          searchCampaigns(searchRegex, parsed.filters, searchLimit)
            .then((data) => { results.campaigns = data; })
        );
      }

      // Search Tickets
      if (shouldSearch("ticket")) {
        searchPromises.push(
          searchTickets(searchRegex, parsed.filters, userId, userRole, searchLimit)
            .then((data) => { results.tickets = data; })
        );
      }

      // Search Announcements
      if (shouldSearch("announcement")) {
        searchPromises.push(
          searchAnnouncements(searchRegex, parsed.filters, userRole, searchLimit)
            .then((data) => { results.announcements = data; })
        );
      }

      // Search Client Brokers (admin only)
      if (shouldSearch("clientbroker") && userRole === "admin") {
        searchPromises.push(
          searchClientBrokers(searchRegex, parsed.filters, searchLimit)
            .then((data) => { results.clientBrokers = data; })
        );
      }

      // Search Client Networks (admin only)
      if (shouldSearch("clientnetwork") && userRole === "admin") {
        searchPromises.push(
          searchClientNetworks(searchRegex, parsed.filters, searchLimit)
            .then((data) => { results.clientNetworks = data; })
        );
      }

      // Search Our Networks (admin only)
      if (shouldSearch("ournetwork") && userRole === "admin") {
        searchPromises.push(
          searchOurNetworks(searchRegex, parsed.filters, searchLimit)
            .then((data) => { results.ourNetworks = data; })
        );
      }

      // Execute all searches in parallel
      await Promise.all(searchPromises);

      // Calculate total results
      const totalResults = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);

      const response = {
        success: true,
        data: results,
        meta: {
          query: q,
          parsedQuery: {
            terms: parsed.searchTerms,
            exactPhrases: parsed.exactPhrases,
            filters: parsed.filters,
          },
          totalResults,
          counts: {
            leads: results.leads.length,
            orders: results.orders.length,
            users: results.users.length,
            campaigns: results.campaigns.length,
            tickets: results.tickets.length,
            announcements: results.announcements.length,
            clientBrokers: results.clientBrokers.length,
            clientNetworks: results.clientNetworks.length,
            ourNetworks: results.ourNetworks.length,
          },
        },
      };

      // Cache the result
      if (searchCache.size >= MAX_CACHE_SIZE) {
        const firstKey = searchCache.keys().next().value;
        searchCache.delete(firstKey);
      }
      searchCache.set(cacheKey, { data: response, timestamp: Date.now() });

      // Save to search history (don't await to avoid slowing down response)
      SearchHistory.addSearch(userId, {
        query: q,
        filters: parsed.filters,
        resultCount: totalResults,
        resultBreakdown: response.meta.counts,
      }).catch((err) => console.error("Failed to save search history:", err));

      res.json(response);
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

/**
 * @route   GET /api/global-search/full
 * @desc    Full search with pagination (for search results page)
 * @access  Protected
 */
router.get(
  "/full",
  [
    protect,
    query("q")
      .trim()
      .notEmpty()
      .withMessage("Search query is required")
      .isLength({ min: 2 })
      .withMessage("Search query must be at least 2 characters"),
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be at least 1"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage("Limit must be between 1 and 50"),
    query("types")
      .optional()
      .isString(),
    query("sort")
      .optional()
      .isIn(["relevance", "date", "name"])
      .withMessage("Sort must be relevance, date, or name"),
  ],
  async (req, res) => {
    try {
      const { q, page = 1, limit = 20, types, sort = "relevance" } = req.query;
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const userRole = req.user.role;
      const userId = req.user._id;

      // Parse types filter
      const allowedTypes = types ? types.split(",").map((t) => t.trim().toLowerCase()) : null;

      // Parse the search query
      const parsed = parseSearchQuery(q);
      const searchRegex = buildSearchRegex(parsed.searchTerms, parsed.exactPhrases);

      if (allowedTypes && allowedTypes.length > 0) {
        parsed.filters.types = allowedTypes;
      }

      // For full search, we get more results per type and combine them
      const fullLimit = 100;

      // Results object
      const allResults = [];

      // Determine which searches to run
      const searchPromises = [];
      const shouldSearch = (type) => {
        if (parsed.filters.types.length > 0) {
          return parsed.filters.types.includes(type);
        }
        return true;
      };

      // Run all applicable searches
      if (shouldSearch("lead") && ["admin", "affiliate_manager", "lead_manager", "agent"].includes(userRole)) {
        searchPromises.push(searchLeads(searchRegex, parsed.filters, userId, userRole, fullLimit));
      }
      if (shouldSearch("order") && ["admin", "affiliate_manager", "lead_manager"].includes(userRole)) {
        searchPromises.push(searchOrders(searchRegex, parsed.filters, userId, userRole, fullLimit));
      }
      if (shouldSearch("user") && userRole === "admin") {
        searchPromises.push(searchUsers(searchRegex, parsed.filters, fullLimit));
      }
      if (shouldSearch("campaign") && ["admin", "affiliate_manager", "lead_manager"].includes(userRole)) {
        searchPromises.push(searchCampaigns(searchRegex, parsed.filters, fullLimit));
      }
      if (shouldSearch("ticket")) {
        searchPromises.push(searchTickets(searchRegex, parsed.filters, userId, userRole, fullLimit));
      }
      if (shouldSearch("announcement")) {
        searchPromises.push(searchAnnouncements(searchRegex, parsed.filters, userRole, fullLimit));
      }
      if (shouldSearch("clientbroker") && userRole === "admin") {
        searchPromises.push(searchClientBrokers(searchRegex, parsed.filters, fullLimit));
      }
      if (shouldSearch("clientnetwork") && userRole === "admin") {
        searchPromises.push(searchClientNetworks(searchRegex, parsed.filters, fullLimit));
      }
      if (shouldSearch("ournetwork") && userRole === "admin") {
        searchPromises.push(searchOurNetworks(searchRegex, parsed.filters, fullLimit));
      }

      // Execute all searches in parallel
      const searchResults = await Promise.all(searchPromises);
      
      // Flatten all results
      searchResults.forEach((results) => {
        allResults.push(...results);
      });

      // Sort results
      if (sort === "date") {
        allResults.sort((a, b) => new Date(b.meta?.createdAt || 0) - new Date(a.meta?.createdAt || 0));
      } else if (sort === "name") {
        allResults.sort((a, b) => a.title.localeCompare(b.title));
      }
      // relevance = default order from searches

      // Calculate counts by type
      const counts = allResults.reduce((acc, item) => {
        acc[item.type] = (acc[item.type] || 0) + 1;
        return acc;
      }, {});

      // Paginate results
      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;
      const paginatedResults = allResults.slice(startIndex, endIndex);

      res.json({
        success: true,
        data: paginatedResults,
        meta: {
          query: q,
          parsedQuery: {
            terms: parsed.searchTerms,
            exactPhrases: parsed.exactPhrases,
            filters: parsed.filters,
          },
          totalResults: allResults.length,
          counts,
          pagination: {
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(allResults.length / limitNum),
            hasMore: endIndex < allResults.length,
          },
        },
      });
    } catch (error) {
      console.error("Full global search error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to perform search",
        error: error.message,
      });
    }
  }
);

/**
 * @route   GET /api/global-search/history
 * @desc    Get user's search history
 * @access  Protected
 */
router.get("/history", protect, async (req, res) => {
  try {
    const history = await SearchHistory.getUserHistory(req.user._id, 20);
    
    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error("Get search history error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get search history",
      error: error.message,
    });
  }
});

/**
 * @route   DELETE /api/global-search/history/:id
 * @desc    Delete a specific search history entry
 * @access  Protected
 */
router.delete(
  "/history/:id",
  [
    protect,
    param("id").isMongoId().withMessage("Invalid history entry ID"),
  ],
  async (req, res) => {
    try {
      await SearchHistory.deleteEntry(req.user._id, req.params.id);
      
      res.json({
        success: true,
        message: "Search history entry deleted",
      });
    } catch (error) {
      console.error("Delete search history entry error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete search history entry",
        error: error.message,
      });
    }
  }
);

/**
 * @route   DELETE /api/global-search/history
 * @desc    Clear all user's search history
 * @access  Protected
 */
router.delete("/history", protect, async (req, res) => {
  try {
    await SearchHistory.clearUserHistory(req.user._id);
    
    res.json({
      success: true,
      message: "Search history cleared",
    });
  } catch (error) {
    console.error("Clear search history error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clear search history",
      error: error.message,
    });
  }
});

module.exports = router;
