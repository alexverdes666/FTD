/**
 * Activity Logs Controller
 *
 * Provides endpoints for querying and analyzing activity logs.
 * Only accessible by admin users.
 */

const ActivityLog = require("../models/ActivityLog");
const mongoose = require("mongoose");

// Lazy-load models to avoid circular dependencies
const getModel = (name) => {
  try {
    return mongoose.model(name);
  } catch {
    return null;
  }
};

// Map of field names to { model, displayField } for ObjectId resolution
const REFERENCE_FIELDS = {
  // Lead references
  clientBroker: { model: "ClientBroker", displayField: "name" },
  clientBrokerId: { model: "ClientBroker", displayField: "name" },
  assignedAgent: { model: "User", displayField: "fullName" },
  agentId: { model: "User", displayField: "fullName" },
  depositPSP: { model: "PSP", displayField: "name" },
  depositCardIssuer: { model: "CardIssuer", displayField: "name" },
  campaign: { model: "Campaign", displayField: "name" },
  campaignId: { model: "Campaign", displayField: "name" },
  clientNetwork: { model: "ClientNetwork", displayField: "name" },
  clientNetworkId: { model: "ClientNetwork", displayField: "name" },
  ourNetwork: { model: "OurNetwork", displayField: "name" },
  ourNetworkId: { model: "OurNetwork", displayField: "name" },
  intermediaryClientNetwork: { model: "ClientNetwork", displayField: "name" },
  shavedBy: { model: "User", displayField: "fullName" },
  shavedRefundsManager: { model: "User", displayField: "fullName" },
  shavedManagerAssignedBy: { model: "User", displayField: "fullName" },
  depositConfirmedBy: { model: "User", displayField: "fullName" },
  createdBy: { model: "User", displayField: "fullName" },
  // Order references
  selectedCampaign: { model: "Campaign", displayField: "name" },
  selectedClientNetwork: { model: "ClientNetwork", displayField: "name" },
  selectedOurNetwork: { model: "OurNetwork", displayField: "name" },
  requester: { model: "User", displayField: "fullName" },
  // Array reference fields (on Lead/Order models)
  assignedClientBrokers: { model: "ClientBroker", displayField: "name" },
  selectedClientBrokers: { model: "ClientBroker", displayField: "name" },
  // Generic
  leadId: { model: "Lead", displayField: ["firstName", "lastName"] },
  orderId: { model: "Order", displayField: "_id" },
  brokerForOrderId: { model: "Order", displayField: "_id" },
  performedBy: { model: "User", displayField: "fullName" },
};

/**
 * Check if a string looks like a MongoDB ObjectId
 */
const isObjectId = (val) =>
  typeof val === "string" && /^[0-9a-fA-F]{24}$/.test(val);

/**
 * Extract ObjectId strings from a value that could be a string, array, or nested
 */
const extractObjectIds = (value) => {
  const ids = [];
  if (isObjectId(value)) {
    ids.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) {
      if (isObjectId(item)) ids.push(item);
    }
  } else if (typeof value === "object" && value !== null) {
    // Change object { old, new } or { from, to } - each side could be string or array
    for (const key of ["old", "new", "from", "to"]) {
      if (value[key] !== undefined) {
        ids.push(...extractObjectIds(value[key]));
      }
    }
  }
  return ids;
};

/**
 * Collect all ObjectId values from changes and requestBody that match known reference fields
 */
const collectObjectIds = (logs) => {
  // model -> Set of ids
  const idsByModel = {};

  for (const log of logs) {
    const scan = (obj) => {
      if (!obj || typeof obj !== "object") return;
      for (const [key, value] of Object.entries(obj)) {
        const ref = REFERENCE_FIELDS[key];
        if (!ref) continue;
        const candidates = extractObjectIds(value);
        for (const id of candidates) {
          if (!idsByModel[ref.model]) idsByModel[ref.model] = new Set();
          idsByModel[ref.model].add(id);
        }
      }
    };

    scan(log.changes);
    scan(log.requestBody);
    // Also scan previousState.data to resolve "before" references
    if (log.previousState?.data) {
      scan(log.previousState.data);
    }
  }

  // Also collect lead IDs from path for lead operations
  for (const log of logs) {
    const path = log.path || "";
    if (path.includes("/api/leads/")) {
      const match = path.match(/\/api\/leads\/([0-9a-fA-F]{24})/);
      if (match) {
        if (!idsByModel.Lead) idsByModel.Lead = new Set();
        idsByModel.Lead.add(match[1]);
      }
    }
    if (path.includes("/api/orders/")) {
      const match = path.match(/\/api\/orders\/([0-9a-fA-F]{24})/);
      if (match) {
        if (!idsByModel.Order) idsByModel.Order = new Set();
        idsByModel.Order.add(match[1]);
      }
    }
  }

  return idsByModel;
};

/**
 * Batch-fetch all referenced documents and build a lookup map
 */
const resolveReferences = async (idsByModel) => {
  // id -> display name
  const lookup = {};

  const fetchPromises = Object.entries(idsByModel).map(
    async ([modelName, ids]) => {
      const Model = getModel(modelName);
      if (!Model || ids.size === 0) return;

      const idsArray = [...ids];
      try {
        let selectFields = "_id";
        // Figure out what display fields we need
        const refEntries = Object.values(REFERENCE_FIELDS).filter(
          (r) => r.model === modelName
        );
        const displayFields = new Set();
        for (const ref of refEntries) {
          if (Array.isArray(ref.displayField)) {
            ref.displayField.forEach((f) => displayFields.add(f));
          } else {
            displayFields.add(ref.displayField);
          }
        }
        // For orders, also get some useful fields
        if (modelName === "Order") {
          displayFields.add("status");
          displayFields.add("requestedCount");
        }
        // For leads, get email too
        if (modelName === "Lead") {
          displayFields.add("newEmail");
          displayFields.add("oldEmail");
        }

        selectFields += " " + [...displayFields].join(" ");
        const docs = await Model.find({ _id: { $in: idsArray } })
          .select(selectFields)
          .lean();

        for (const doc of docs) {
          const id = doc._id.toString();
          // Build display string
          if (modelName === "Lead") {
            const name = [doc.firstName, doc.lastName].filter(Boolean).join(" ");
            const email = doc.newEmail || doc.oldEmail || "";
            lookup[id] = name ? `${name} (${email})` : email || id.slice(-8);
          } else if (modelName === "Order") {
            lookup[id] = `Order #${id.slice(-8)}${doc.status ? ` [${doc.status}]` : ""}`;
          } else {
            // Use the first display field that has a value
            let display = null;
            for (const field of displayFields) {
              if (doc[field]) {
                display = doc[field];
                break;
              }
            }
            lookup[id] = display || id.slice(-8);
          }
        }
      } catch (err) {
        console.error(
          `[TrackingHistory] Error resolving ${modelName}:`,
          err.message
        );
      }
    }
  );

  await Promise.all(fetchPromises);
  return lookup;
};

/**
 * Resolve a value: if it's an ObjectId (or array of them), return the display name(s)
 */
const resolveValue = (val, lookup) => {
  if (isObjectId(val) && lookup[val]) return lookup[val];
  if (Array.isArray(val)) {
    const resolved = val.map((item) =>
      isObjectId(item) && lookup[item] ? lookup[item] : item
    );
    // If single-element array, return just the string for cleaner display
    return resolved.length === 1 ? resolved[0] : resolved.join(", ");
  }
  return val;
};

/**
 * Enrich a log entry with resolved display names and a human-readable description
 */
const enrichLog = (log, lookup) => {
  const enriched = { ...log };

  // Resolve changes
  const prevData = log.previousState?.data;
  if (log.changes && typeof log.changes === "object") {
    enriched.resolvedChanges = {};
    for (const [field, change] of Object.entries(log.changes)) {
      let oldVal = change?.old ?? change?.from;
      const newVal = change?.new ?? change?.to;

      // If old value is empty/null, try to find the real previous value from previousState
      if ((oldVal === null || oldVal === undefined || oldVal === "") && prevData) {
        // For broker/network/campaign changes tied to a specific order,
        // look at the history array to find the previous assignment for THAT order
        const body = log.requestBody || {};
        const orderId =
          (change?.new ?? change?.to) && field === "brokerForOrderId"
            ? null // skip brokerForOrderId itself
            : body.brokerForOrderId || body.orderId;

        const historyMap = {
          clientBroker: { history: "clientBrokerHistory", refField: "clientBroker", orderField: "orderId" },
          clientNetwork: { history: "clientNetworkHistory", refField: "clientNetwork", orderField: "orderId" },
          ourNetwork: { history: "ourNetworkHistory", refField: "ourNetwork", orderField: "orderId" },
          campaign: { history: "campaignHistory", refField: "campaign", orderField: "orderId" },
        };

        const historyInfo = historyMap[field];
        if (historyInfo && prevData[historyInfo.history]) {
          const historyArr = prevData[historyInfo.history];
          if (Array.isArray(historyArr) && historyArr.length > 0) {
            if (orderId) {
              // Find the most recent entry for this specific order
              const orderStr = String(orderId);
              const match = [...historyArr]
                .reverse()
                .find((h) => String(h[historyInfo.orderField]) === orderStr);
              if (match && match[historyInfo.refField]) {
                oldVal = String(match[historyInfo.refField]);
              }
            } else {
              // No order context - use the most recent history entry
              const last = historyArr[historyArr.length - 1];
              if (last && last[historyInfo.refField]) {
                oldVal = String(last[historyInfo.refField]);
              }
            }
          }
        }

        // Fallback for simple fields (e.g. assignedAgent which is a direct ObjectId)
        if ((oldVal === null || oldVal === undefined || oldVal === "") && !historyInfo) {
          const simpleFieldMap = { assignedAgent: "assignedAgent" };
          const directField = simpleFieldMap[field];
          if (directField && prevData[directField]) {
            oldVal = prevData[directField];
          }
        }
      }

      enriched.resolvedChanges[field] = {
        old: oldVal,
        new: newVal,
        oldDisplay: resolveValue(oldVal, lookup),
        newDisplay: resolveValue(newVal, lookup),
      };
    }
  }

  // Resolve key fields in requestBody
  if (log.requestBody && typeof log.requestBody === "object") {
    enriched.resolvedBody = {};
    for (const [key, val] of Object.entries(log.requestBody)) {
      if (REFERENCE_FIELDS[key]) {
        enriched.resolvedBody[key] = resolveValue(val, lookup);
      } else {
        enriched.resolvedBody[key] = val;
      }
    }
  }

  // Resolve entity from URL path
  const path = log.path || "";
  const leadMatch = path.match(/\/api\/leads\/([0-9a-fA-F]{24})/);
  const orderMatch = path.match(/\/api\/orders\/([0-9a-fA-F]{24})/);
  if (leadMatch && lookup[leadMatch[1]]) {
    enriched.targetEntity = { type: "Lead", id: leadMatch[1], name: lookup[leadMatch[1]] };
  } else if (orderMatch && lookup[orderMatch[1]]) {
    enriched.targetEntity = { type: "Order", id: orderMatch[1], name: lookup[orderMatch[1]] };
  }

  // Build human-readable description
  enriched.description = buildDescription(log, lookup, enriched);

  return enriched;
};

/**
 * Build a human-readable description of what happened
 */
const buildDescription = (log, lookup, enriched) => {
  const user = log.userSnapshot?.fullName || "System";
  const method = log.method;
  const path = log.path || "";
  const body = log.requestBody || {};
  const changes = enriched.resolvedChanges || {};
  const target = enriched.targetEntity;

  // Try to build a specific description based on what changed
  const changedFields = Object.keys(changes);

  // Lead operations
  if (path.includes("/api/leads/")) {
    const leadName = target?.name || "a lead";

    if (changedFields.includes("clientBroker") || body.clientBrokerId || body.clientBroker) {
      const newBroker =
        changes.clientBroker?.newDisplay ||
        resolveValue(body.clientBrokerId, lookup) ||
        resolveValue(body.clientBroker, lookup) ||
        "a broker";
      const prevBroker = changes.clientBroker?.oldDisplay;
      const orderName =
        changes.brokerForOrderId?.newDisplay ||
        resolveValue(body.brokerForOrderId, lookup) ||
        "";
      const prevPart = prevBroker && prevBroker !== "(empty)" ? ` (was "${prevBroker}")` : "";
      return `${user} assigned client broker "${newBroker}" to ${leadName}${prevPart}${orderName ? ` (${orderName})` : ""}`;
    }
    if (changedFields.includes("assignedAgent") || body.agentId) {
      const agentName =
        changes.assignedAgent?.newDisplay ||
        (body.agentId && lookup[body.agentId]) ||
        "an agent";
      return `${user} assigned agent "${agentName}" to ${leadName}`;
    }
    if (changedFields.includes("campaign") || body.campaignId) {
      const campaignName =
        changes.campaign?.newDisplay ||
        (body.campaignId && lookup[body.campaignId]) ||
        "a campaign";
      return `${user} assigned campaign "${campaignName}" to ${leadName}`;
    }
    if (changedFields.includes("clientNetwork") || body.clientNetworkId) {
      const networkName =
        changes.clientNetwork?.newDisplay ||
        (body.clientNetworkId && lookup[body.clientNetworkId]) ||
        "a network";
      return `${user} assigned client network "${networkName}" to ${leadName}`;
    }
    if (changedFields.includes("ourNetwork") || body.ourNetworkId) {
      const networkName =
        changes.ourNetwork?.newDisplay ||
        (body.ourNetworkId && lookup[body.ourNetworkId]) ||
        "a network";
      return `${user} assigned our network "${networkName}" to ${leadName}`;
    }
    if (changedFields.includes("depositConfirmed")) {
      const confirmed = changes.depositConfirmed?.new;
      return `${user} ${confirmed ? "confirmed" : "unconfirmed"} deposit for ${leadName}`;
    }
    if (changedFields.includes("isShaved")) {
      const shaved = changes.isShaved?.new;
      return `${user} ${shaved ? "marked" : "unmarked"} ${leadName} as shaved`;
    }

    if (method === "POST") return `${user} created lead`;
    if (method === "DELETE") return `${user} deleted ${leadName}`;
    if (changedFields.length > 0) {
      return `${user} updated ${leadName}: ${changedFields.join(", ")}`;
    }
    return `${user} updated ${leadName}`;
  }

  // Order operations
  if (path.includes("/api/orders/")) {
    const orderName = target?.name || "an order";

    if (path.includes("/add-lead") || path.includes("/add_lead")) {
      const leadId = body.leadId;
      const leadName2 = leadId && lookup[leadId] ? lookup[leadId] : "a lead";
      return `${user} added ${leadName2} to ${orderName}`;
    }
    if (path.includes("/remove-lead") || path.includes("/remove_lead")) {
      const leadId = body.leadId;
      const leadName2 = leadId && lookup[leadId] ? lookup[leadId] : "a lead";
      return `${user} removed ${leadName2} from ${orderName}`;
    }
    if (path.includes("/swap") || path.includes("/ftd")) {
      return `${user} swapped FTD in ${orderName}`;
    }

    if (method === "POST") {
      const campaignName =
        body.selectedCampaign && lookup[body.selectedCampaign]
          ? lookup[body.selectedCampaign]
          : "";
      return `${user} created ${orderName}${campaignName ? ` (Campaign: ${campaignName})` : ""}`;
    }
    if (method === "DELETE") return `${user} deleted ${orderName}`;
    if (changedFields.length > 0) {
      return `${user} updated ${orderName}: ${changedFields.join(", ")}`;
    }
    return `${user} updated ${orderName}`;
  }

  // User operations
  if (path.includes("/api/users/")) {
    const name = body.fullName || body.email || target?.name || "a user";
    if (method === "POST") return `${user} created user "${name}"`;
    if (method === "DELETE") return `${user} deleted user "${name}"`;
    return `${user} updated user "${name}"`;
  }

  // Auth operations
  if (path.includes("/api/auth/")) {
    if (path.includes("login")) return `${user} logged in`;
    if (path.includes("logout")) return `${user} logged out`;
    if (path.includes("register")) return `New user registered: ${body.email || ""}`;
    return `${user} performed auth action`;
  }

  // Client broker operations
  if (path.includes("/api/client-brokers/")) {
    const name = body.name || target?.name || "a broker";
    if (method === "POST") return `${user} created client broker "${name}"`;
    if (method === "DELETE") return `${user} deleted client broker "${name}"`;
    return `${user} updated client broker "${name}"`;
  }

  // Client network operations
  if (path.includes("/api/client-networks/")) {
    const name = body.name || target?.name || "a network";
    if (method === "POST") return `${user} created client network "${name}"`;
    if (method === "DELETE") return `${user} deleted client network "${name}"`;
    return `${user} updated client network "${name}"`;
  }

  // Our network operations
  if (path.includes("/api/our-networks/")) {
    const name = body.name || target?.name || "a network";
    if (method === "POST") return `${user} created our network "${name}"`;
    if (method === "DELETE") return `${user} deleted our network "${name}"`;
    return `${user} updated our network "${name}"`;
  }

  // Campaign operations
  if (path.includes("/api/campaigns/")) {
    const name = body.name || target?.name || "a campaign";
    if (method === "POST") return `${user} created campaign "${name}"`;
    if (method === "DELETE") return `${user} deleted campaign "${name}"`;
    return `${user} updated campaign "${name}"`;
  }

  // Generic fallback
  const resource = path.split("/")[2] || "resource";
  const readableResource = resource.replace(/-/g, " ");
  const methodLabel = { POST: "created", PUT: "updated", PATCH: "updated", DELETE: "deleted" }[method] || method.toLowerCase();
  return `${user} ${methodLabel} ${readableResource}`;
};

/**
 * Get activity logs with filtering and pagination
 * @route GET /api/activity-logs
 * @access Admin only
 */
exports.getActivityLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      // Filters
      user,
      email,
      method,
      path,
      basePath,
      statusCode,
      statusCategory,
      actionType,
      ip,
      startDate,
      endDate,
      minRiskScore,
      deviceType,
      browser,
      os,
      isBot,
      hasError,
      // Sort
      sortBy = "timestamp",
      sortOrder = "desc",
    } = req.query;

    // Build query
    const query = {};

    // User filters
    if (user) {
      query.user = user;
    }
    if (email) {
      query["userSnapshot.email"] = { $regex: email, $options: "i" };
    }

    // Request filters
    if (method) {
      query.method = method.toUpperCase();
    }
    if (path) {
      query.path = { $regex: path, $options: "i" };
    }
    if (basePath) {
      query.basePath = basePath;
    }
    if (statusCode) {
      query.statusCode = parseInt(statusCode);
    }
    if (statusCategory) {
      query.statusCategory = statusCategory;
    }
    if (actionType) {
      query.actionType = { $regex: actionType, $options: "i" };
    }

    // IP filter
    if (ip) {
      query.ip = { $regex: ip, $options: "i" };
    }

    // Date range filter
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        query.timestamp.$lte = new Date(endDate);
      }
    }

    // Risk score filter
    if (minRiskScore) {
      query.riskScore = { $gte: parseInt(minRiskScore) };
    }

    // Device filters
    if (deviceType) {
      query["device.type"] = deviceType;
    }
    if (browser) {
      query["browser.name"] = { $regex: browser, $options: "i" };
    }
    if (os) {
      query["os.name"] = { $regex: os, $options: "i" };
    }
    if (isBot !== undefined) {
      query.isBot = isBot === "true";
    }

    // Error filter
    if (hasError === "true") {
      query.statusCode = { $gte: 400 };
    }

    // Build sort object
    const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, totalCount] = await Promise.all([
      ActivityLog.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate("user", "fullName email role")
        .lean(),
      ActivityLog.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        limit: parseInt(limit),
        hasNextPage: skip + logs.length < totalCount,
        hasPrevPage: parseInt(page) > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching activity logs:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching activity logs",
      error: error.message,
    });
  }
};

/**
 * Get activity log by ID
 * @route GET /api/activity-logs/:id
 * @access Admin only
 */
exports.getActivityLogById = async (req, res) => {
  try {
    const log = await ActivityLog.findById(req.params.id)
      .populate("user", "fullName email role")
      .lean();

    if (!log) {
      return res.status(404).json({
        success: false,
        message: "Activity log not found",
      });
    }

    res.json({
      success: true,
      data: log,
    });
  } catch (error) {
    console.error("Error fetching activity log:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching activity log",
      error: error.message,
    });
  }
};

/**
 * Get user activity summary
 * @route GET /api/activity-logs/user/:userId/summary
 * @access Admin only
 */
exports.getUserActivitySummary = async (req, res) => {
  try {
    const { userId } = req.params;
    const { hours = 24 } = req.query;

    const summary = await ActivityLog.getUserActivitySummary(
      userId,
      parseInt(hours)
    );

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Error fetching user activity summary:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user activity summary",
      error: error.message,
    });
  }
};

/**
 * Get IP activity
 * @route GET /api/activity-logs/ip/:ip
 * @access Admin only
 */
exports.getIPActivity = async (req, res) => {
  try {
    const { ip } = req.params;
    const { hours = 24 } = req.query;

    const activity = await ActivityLog.getIPActivity(ip, parseInt(hours));

    res.json({
      success: true,
      data: activity,
    });
  } catch (error) {
    console.error("Error fetching IP activity:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching IP activity",
      error: error.message,
    });
  }
};

/**
 * Get failed requests summary
 * @route GET /api/activity-logs/analytics/failed-requests
 * @access Admin only
 */
exports.getFailedRequestsSummary = async (req, res) => {
  try {
    const { hours = 24 } = req.query;

    const summary = await ActivityLog.getFailedRequestsSummary(parseInt(hours));

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Error fetching failed requests summary:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching failed requests summary",
      error: error.message,
    });
  }
};

/**
 * Get high-risk activity
 * @route GET /api/activity-logs/analytics/high-risk
 * @access Admin only
 */
exports.getHighRiskActivity = async (req, res) => {
  try {
    const { minRiskScore = 50, hours = 24 } = req.query;

    const activity = await ActivityLog.getHighRiskActivity(
      parseInt(minRiskScore),
      parseInt(hours)
    );

    res.json({
      success: true,
      data: activity,
    });
  } catch (error) {
    console.error("Error fetching high-risk activity:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching high-risk activity",
      error: error.message,
    });
  }
};

/**
 * Get endpoint analytics
 * @route GET /api/activity-logs/analytics/endpoints
 * @access Admin only
 */
exports.getEndpointAnalytics = async (req, res) => {
  try {
    const { hours = 24 } = req.query;

    const analytics = await ActivityLog.getEndpointAnalytics(parseInt(hours));

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error("Error fetching endpoint analytics:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching endpoint analytics",
      error: error.message,
    });
  }
};

/**
 * Get activity dashboard stats
 * @route GET /api/activity-logs/dashboard
 * @access Admin only
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    const windowStart = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000);

    const [
      totalRequests,
      uniqueUsers,
      uniqueIPs,
      errorCount,
      byMethod,
      byStatusCategory,
      topEndpoints,
      topUsers,
      recentHighRisk,
    ] = await Promise.all([
      // Total requests
      ActivityLog.countDocuments({ timestamp: { $gte: windowStart } }),

      // Unique users
      ActivityLog.distinct("user", {
        timestamp: { $gte: windowStart },
        user: { $ne: null },
      }),

      // Unique IPs
      ActivityLog.distinct("ip", { timestamp: { $gte: windowStart } }),

      // Error count
      ActivityLog.countDocuments({
        timestamp: { $gte: windowStart },
        statusCode: { $gte: 400 },
      }),

      // Requests by method
      ActivityLog.aggregate([
        { $match: { timestamp: { $gte: windowStart } } },
        { $group: { _id: "$method", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // Requests by status category
      ActivityLog.aggregate([
        { $match: { timestamp: { $gte: windowStart } } },
        { $group: { _id: "$statusCategory", count: { $sum: 1 } } },
      ]),

      // Top endpoints
      ActivityLog.aggregate([
        { $match: { timestamp: { $gte: windowStart } } },
        {
          $group: {
            _id: { method: "$method", path: "$basePath" },
            count: { $sum: 1 },
            avgDuration: { $avg: "$duration" },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),

      // Top users
      ActivityLog.aggregate([
        {
          $match: {
            timestamp: { $gte: windowStart },
            user: { $ne: null },
          },
        },
        {
          $group: {
            _id: "$user",
            email: { $first: "$userSnapshot.email" },
            fullName: { $first: "$userSnapshot.fullName" },
            requestCount: { $sum: 1 },
          },
        },
        { $sort: { requestCount: -1 } },
        { $limit: 10 },
      ]),

      // Recent high-risk activity
      ActivityLog.find({
        timestamp: { $gte: windowStart },
        riskScore: { $gte: 30 },
      })
        .sort({ riskScore: -1, timestamp: -1 })
        .limit(5)
        .select(
          "timestamp method path statusCode userSnapshot ip riskScore securityFlags"
        )
        .lean(),
    ]);

    res.json({
      success: true,
      data: {
        timeWindow: `${hours} hours`,
        summary: {
          totalRequests,
          uniqueUsers: uniqueUsers.length,
          uniqueIPs: uniqueIPs.length,
          errorCount,
          errorRate:
            totalRequests > 0
              ? ((errorCount / totalRequests) * 100).toFixed(2) + "%"
              : "0%",
        },
        byMethod: Object.fromEntries(byMethod.map((m) => [m._id, m.count])),
        byStatusCategory: Object.fromEntries(
          byStatusCategory.map((s) => [s._id || "unknown", s.count])
        ),
        topEndpoints,
        topUsers,
        recentHighRisk,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard stats",
      error: error.message,
    });
  }
};

/**
 * Get real-time activity stream (last N entries)
 * @route GET /api/activity-logs/stream
 * @access Admin only
 */
exports.getActivityStream = async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const logs = await ActivityLog.find()
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .select(
        "timestamp method path statusCode userSnapshot ip device browser duration actionType"
      )
      .lean();

    res.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    console.error("Error fetching activity stream:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching activity stream",
      error: error.message,
    });
  }
};

/**
 * Export activity logs to CSV
 * @route GET /api/activity-logs/export
 * @access Admin only
 */
exports.exportActivityLogs = async (req, res) => {
  try {
    const { startDate, endDate, limit = 10000 } = req.query;

    const query = {};
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const logs = await ActivityLog.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .select(
        "timestamp requestId method path statusCode userSnapshot ip device browser os duration actionType riskScore"
      )
      .lean();

    // Convert to CSV
    const headers = [
      "Timestamp",
      "Request ID",
      "Method",
      "Path",
      "Status",
      "User Email",
      "User Name",
      "User Role",
      "IP",
      "Device Type",
      "Browser",
      "OS",
      "Duration (ms)",
      "Action Type",
      "Risk Score",
    ];

    const rows = logs.map((log) => [
      log.timestamp?.toISOString() || "",
      log.requestId || "",
      log.method || "",
      log.path || "",
      log.statusCode || "",
      log.userSnapshot?.email || "",
      log.userSnapshot?.fullName || "",
      log.userSnapshot?.role || "",
      log.ip || "",
      log.device?.type || "",
      log.browser?.name || "",
      log.os?.name || "",
      log.duration || "",
      log.actionType || "",
      log.riskScore || "",
    ]);

    const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join(
      "\n"
    );

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=activity-logs-${
        new Date().toISOString().split("T")[0]
      }.csv`
    );
    res.send(csv);
  } catch (error) {
    console.error("Error exporting activity logs:", error);
    res.status(500).json({
      success: false,
      message: "Error exporting activity logs",
      error: error.message,
    });
  }
};

/**
 * Get enriched tracking history with resolved ObjectId references
 * @route GET /api/activity-logs/tracking-history
 * @access Admin only
 */
exports.getTrackingHistory = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 30,
      user,
      actionType,
      method,
      path: pathFilter,
      startDate,
      endDate,
      sortBy = "timestamp",
      sortOrder = "desc",
    } = req.query;

    const query = {};

    if (user) query.user = user;
    if (method) query.method = method.toUpperCase();
    if (pathFilter) query.path = { $regex: pathFilter, $options: "i" };
    if (actionType) query.actionType = { $regex: actionType, $options: "i" };

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, totalCount] = await Promise.all([
      ActivityLog.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .select(
          "timestamp method path basePath statusCode statusCategory actionType " +
          "user userSnapshot duration ip device browser os " +
          "requestBody changes previousState error"
        )
        .lean(),
      ActivityLog.countDocuments(query),
    ]);

    // Collect all ObjectIds that need resolving
    const idsByModel = collectObjectIds(logs);

    // Batch-resolve all references
    const lookup = await resolveReferences(idsByModel);

    // Enrich each log with resolved names and descriptions
    const enrichedLogs = logs.map((log) => enrichLog(log, lookup));

    res.json({
      success: true,
      data: enrichedLogs,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        limit: parseInt(limit),
        hasNextPage: skip + logs.length < totalCount,
        hasPrevPage: parseInt(page) > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching tracking history:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching tracking history",
      error: error.message,
    });
  }
};

/**
 * Delete old activity logs
 * @route DELETE /api/activity-logs/cleanup
 * @access Admin only
 */
exports.cleanupOldLogs = async (req, res) => {
  try {
    const { days = 90 } = req.query;

    const deletedCount = await ActivityLog.cleanOldLogs(parseInt(days));

    res.json({
      success: true,
      message: `Deleted ${deletedCount} activity logs older than ${days} days`,
      deletedCount,
    });
  } catch (error) {
    console.error("Error cleaning up activity logs:", error);
    res.status(500).json({
      success: false,
      message: "Error cleaning up activity logs",
      error: error.message,
    });
  }
};
