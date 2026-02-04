const Lead = require("../models/Lead");

const CACHE_TTL = 30 * 1000; // 30 seconds
const MAX_CACHE_ENTRIES = 500;
const MAX_LEAD_RESULTS = 5000;

// Map<string, { ids: ObjectId[], timestamp: number }>
const cache = new Map();

/**
 * Search leads by keyword with caching.
 * Returns an array of Lead _id values matching the keyword across
 * firstName, lastName, newEmail, oldEmail, newPhone, oldPhone, country.
 */
async function searchLeads(keyword, agentIds = []) {
  const agentKey =
    agentIds.length > 0
      ? ":" +
        agentIds
          .map((id) => id.toString())
          .sort()
          .join(",")
      : "";
  const cacheKey = keyword.toLowerCase() + agentKey;

  const entry = cache.get(cacheKey);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.ids;
  }

  const regex = new RegExp(keyword, "i");
  const leadOrConditions = [
    { firstName: regex },
    { lastName: regex },
    { newEmail: regex },
    { oldEmail: regex },
    { newPhone: regex },
    { oldPhone: regex },
    { country: regex },
  ];
  if (agentIds.length > 0) {
    leadOrConditions.push({ assignedAgent: { $in: agentIds } });
  }

  const matchingLeads = await Lead.find({ $or: leadOrConditions })
    .select("_id")
    .limit(MAX_LEAD_RESULTS)
    .lean();

  const ids = matchingLeads.map((l) => l._id);

  // Evict oldest entry if cache is full
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }

  cache.set(cacheKey, { ids, timestamp: Date.now() });
  return ids;
}

/**
 * Clear the entire lead search cache.
 * Call this whenever leads are created, updated, or deleted.
 */
function clearCache() {
  cache.clear();
}

module.exports = { searchLeads, clearCache };
