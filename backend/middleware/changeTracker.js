/**
 * Change Tracker Middleware
 *
 * Captures the previous state of documents before they are modified.
 * Works with the activityLogger to show before/after comparisons.
 *
 * This middleware intercepts PUT, PATCH, and DELETE requests,
 * fetches the current document from the database, and stores it
 * on req.previousState for the activity logger to use.
 */

const mongoose = require("mongoose");

// Route pattern to Model mapping
// Maps API routes to their corresponding Mongoose models
const ROUTE_MODEL_MAP = {
  "/api/users": "User",
  "/api/leads": "Lead",
  "/api/orders": "Order",
  "/api/client-networks": "ClientNetwork",
  "/api/our-networks": "OurNetwork",
  "/api/client-brokers": "ClientBroker",
  "/api/campaigns": "Campaign",
  "/api/agents": "User",
  "/api/agent-bonuses": "AgentBonus",
  "/api/agent-fines": "AgentFine",
  "/api/withdrawals": "Withdrawal",
  "/api/salary-configuration": "SalaryConfiguration",
  "/api/verifications": "Verification",
  "/api/refunds": "Refund",
  "/api/tickets": "Ticket",
  "/api/notifications": "Notification",
  "/api/simcards": "SimCard",
  "/api/gateway-devices": "GatewayDevice",
  "/api/agent-schedule": "AgentSchedule",
  "/api/announcements": "Announcement",
  "/api/am-targets": "AMTarget",
  "/api/deposit-calls": "DepositCall",
  "/api/system-config": "SystemConfiguration",
  "/api/affiliate-manager-table": "AffiliateManagerTable",
  "/api/agent-comments": "AgentComment",
  "/api/call-change-requests": "CallChangeRequest",
  "/api/agent-call-appointments": "AgentCallAppointment",
};

// Fields to exclude from the previous state (to reduce noise)
const EXCLUDE_FIELDS = [
  "__v",
  "createdAt",
  "updatedAt",
  "password",
  "twoFactorSecret",
  "backupCodes",
  "tokenInvalidatedAt",
];

// Routes to skip change tracking (high-volume or not useful)
const SKIP_ROUTES = [
  "/api/auth",
  "/api/health",
  "/api/chat",
  "/api/notifications/mark-read",
  "/api/notifications/mark-all-read",
  "/socket.io",
];

/**
 * Finds the model name for a given route path
 */
const findModelForRoute = (path) => {
  // Remove query string if present
  const cleanPath = path.split("?")[0];

  // Check each route pattern
  for (const [routePattern, modelName] of Object.entries(ROUTE_MODEL_MAP)) {
    if (cleanPath.startsWith(routePattern)) {
      return modelName;
    }
  }

  return null;
};

/**
 * Extracts the document ID from the request
 * Since middleware runs before routes, we extract from URL path directly
 */
const extractDocumentId = (req) => {
  // First try req.params (in case it's populated)
  const { params } = req;
  if (params) {
    const idParams = [
      "id",
      "userId",
      "agentId",
      "leadId",
      "orderId",
      "networkId",
      "ticketId",
      "deviceId",
      "simId",
      "bonusId",
      "fineId",
    ];

    for (const param of idParams) {
      if (params[param] && mongoose.Types.ObjectId.isValid(params[param])) {
        return params[param];
      }
    }
  }

  // Extract ID from URL path (e.g., /api/our-networks/691ee7dc0f75755b5a648363)
  // Most routes follow pattern: /api/{resource}/{id} or /api/{resource}/{id}/{action}
  const pathParts = req.path.split("/").filter(Boolean);

  // Look for MongoDB ObjectId pattern in path segments (24 hex characters)
  for (const part of pathParts) {
    if (mongoose.Types.ObjectId.isValid(part) && part.length === 24) {
      return part;
    }
  }

  return null;
};

/**
 * Cleans the document for logging (removes sensitive/noisy fields)
 */
const cleanDocument = (doc) => {
  if (!doc) return null;

  // Convert Mongoose document to plain object
  const obj = doc.toObject ? doc.toObject() : { ...doc };

  // Remove excluded fields
  for (const field of EXCLUDE_FIELDS) {
    delete obj[field];
  }

  // Convert ObjectIds to strings for readability
  const stringifyIds = (o) => {
    if (o === null || o === undefined) return o;
    if (o instanceof mongoose.Types.ObjectId) return o.toString();
    if (Array.isArray(o)) return o.map(stringifyIds);
    if (typeof o === "object" && o !== null) {
      const result = {};
      for (const [key, value] of Object.entries(o)) {
        if (key === "_id" || key.endsWith("Id") || key === "id") {
          result[key] = value?.toString ? value.toString() : value;
        } else {
          result[key] = stringifyIds(value);
        }
      }
      return result;
    }
    return o;
  };

  return stringifyIds(obj);
};

/**
 * Computes the differences between previous and current states
 * Only compares fields that exist in the current (request body) to avoid
 * false positives from partial updates that don't include all fields
 */
const computeChanges = (previous, current) => {
  if (!previous || !current) return null;

  const changes = {};

  // Only check fields that are in the current request (the update payload)
  // This avoids showing "field removed" for fields that just weren't sent
  for (const key of Object.keys(current)) {
    // Skip internal/meta fields
    if (key.startsWith("_") || key === "id") continue;

    const prevValue = previous[key];
    const currValue = current[key];

    // Skip if values are the same
    const prevStr = JSON.stringify(prevValue);
    const currStr = JSON.stringify(currValue);

    if (prevStr !== currStr) {
      changes[key] = {
        from: prevValue,
        to: currValue,
      };
    }
  }

  return Object.keys(changes).length > 0 ? changes : null;
};

/**
 * Main change tracker middleware
 * Fetches the previous state of a document before it's modified
 */
const changeTracker = async (req, res, next) => {
  // Only track PUT, PATCH, DELETE requests
  if (!["PUT", "PATCH", "DELETE"].includes(req.method)) {
    return next();
  }

  // Skip certain routes
  if (SKIP_ROUTES.some((route) => req.path.startsWith(route))) {
    return next();
  }

  try {
    const modelName = findModelForRoute(req.path);
    const documentId = extractDocumentId(req);

    if (!modelName || !documentId) {
      // Debug: log why we're skipping
      if (process.env.NODE_ENV === "development") {
        console.log(
          `[ChangeTracker] Skipping - model: ${modelName}, docId: ${documentId}, path: ${req.path}`
        );
      }
      return next();
    }

    // Try to get the model
    let Model;
    try {
      Model = mongoose.model(modelName);
    } catch (err) {
      // Model not registered, skip tracking
      console.log(`[ChangeTracker] Model "${modelName}" not registered`);
      return next();
    }

    // Fetch the current document (without .lean() to allow decryption plugins to work)
    const previousDoc = await Model.findById(documentId);

    if (previousDoc) {
      // Convert to object after decryption has happened
      const docData = previousDoc.toObject
        ? previousDoc.toObject()
        : previousDoc;

      req.previousState = {
        model: modelName,
        documentId: documentId,
        data: cleanDocument(docData),
        fetchedAt: new Date().toISOString(),
      };

      console.log(
        `[ChangeTracker] ✅ Captured previous state for ${modelName}:${documentId}`
      );
    } else {
      console.log(
        `[ChangeTracker] ⚠️ Document not found: ${modelName}:${documentId}`
      );
    }
  } catch (error) {
    // Don't fail the request if tracking fails
    console.error(
      "[ChangeTracker] ❌ Error fetching previous state:",
      error.message
    );
  }

  next();
};

/**
 * Utility to manually track changes in controllers
 * Use this when automatic tracking doesn't work for complex cases
 *
 * Example usage in a controller:
 *   const { trackChange } = require('../middleware/changeTracker');
 *   await trackChange(req, 'User', user._id, user.toObject());
 */
const trackChange = (req, modelName, documentId, previousData) => {
  req.previousState = {
    model: modelName,
    documentId: documentId?.toString(),
    data: cleanDocument(previousData),
    fetchedAt: new Date().toISOString(),
  };
};

module.exports = {
  changeTracker,
  trackChange,
  computeChanges,
  cleanDocument,
  findModelForRoute,
  ROUTE_MODEL_MAP,
};
