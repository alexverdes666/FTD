const Lead = require("../models/Lead");

const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

// Full in-memory collection cache for instant lead search
let leadDocs = null;
let leadDocsTimestamp = 0;
let loadingPromise = null;

const PROJECTION = {
  _id: 1,
  firstName: 1,
  lastName: 1,
  newEmail: 1,
  oldEmail: 1,
  newPhone: 1,
  oldPhone: 1,
  country: 1,
  assignedAgent: 1,
};

const SEARCH_FIELDS = [
  "firstName",
  "lastName",
  "newEmail",
  "oldEmail",
  "newPhone",
  "oldPhone",
  "country",
];

async function loadDocs() {
  const docs = await Lead.find({}).select(PROJECTION).lean();
  leadDocs = docs;
  leadDocsTimestamp = Date.now();
  loadingPromise = null;
  return docs;
}

async function getDocs() {
  if (leadDocs && Date.now() - leadDocsTimestamp < CACHE_TTL) {
    return leadDocs;
  }
  // Prevent multiple concurrent reloads
  if (loadingPromise) {
    return loadingPromise;
  }
  loadingPromise = loadDocs();
  return loadingPromise;
}

/**
 * Search leads by keyword using in-memory filtering.
 * All lead searchable fields are pre-loaded into memory for instant search.
 * Returns an array of Lead _id values.
 */
async function searchLeads(keyword, agentIds = []) {
  const docs = await getDocs();
  const regex = new RegExp(keyword, "i");

  const agentIdSet =
    agentIds.length > 0
      ? new Set(agentIds.map((id) => id.toString()))
      : null;

  const ids = [];
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    let matched = false;
    for (let j = 0; j < SEARCH_FIELDS.length; j++) {
      const val = doc[SEARCH_FIELDS[j]];
      if (val && regex.test(val)) {
        matched = true;
        break;
      }
    }
    if (
      !matched &&
      agentIdSet &&
      doc.assignedAgent &&
      agentIdSet.has(doc.assignedAgent.toString())
    ) {
      matched = true;
    }
    if (matched) {
      ids.push(doc._id);
    }
  }
  return ids;
}

/**
 * Pre-load all leads into memory. Call on server startup.
 */
async function warmUp() {
  await loadDocs();
}

/**
 * Clear the in-memory cache.
 * Call this whenever leads are created, updated, or deleted.
 */
function clearCache() {
  leadDocs = null;
  leadDocsTimestamp = 0;
  loadingPromise = null;
}

module.exports = { searchLeads, warmUp, clearCache };
