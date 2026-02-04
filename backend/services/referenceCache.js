const User = require("../models/User");
const Campaign = require("../models/Campaign");
const OurNetwork = require("../models/OurNetwork");
const ClientNetwork = require("../models/ClientNetwork");
const ClientBroker = require("../models/ClientBroker");

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const collections = {
  User: {
    model: User,
    projection: { _id: 1, fullName: 1, email: 1 },
    searchFields: ["fullName", "email"],
  },
  Campaign: {
    model: Campaign,
    projection: { _id: 1, name: 1 },
    searchFields: ["name"],
  },
  OurNetwork: {
    model: OurNetwork,
    projection: { _id: 1, name: 1 },
    searchFields: ["name"],
  },
  ClientNetwork: {
    model: ClientNetwork,
    projection: { _id: 1, name: 1 },
    searchFields: ["name"],
  },
  ClientBroker: {
    model: ClientBroker,
    projection: { _id: 1, name: 1, domain: 1 },
    searchFields: ["name", "domain"],
  },
};

const cache = new Map();

async function loadCollection(name) {
  const config = collections[name];
  if (!config) throw new Error(`Unknown collection: ${name}`);
  const docs = await config.model.find({}).select(config.projection).lean();
  cache.set(name, { docs, timestamp: Date.now() });
  return docs;
}

async function getDocs(name) {
  const entry = cache.get(name);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.docs;
  }
  return loadCollection(name);
}

async function searchCollection(name, keyword) {
  const config = collections[name];
  if (!config) throw new Error(`Unknown collection: ${name}`);
  const docs = await getDocs(name);
  const regex = new RegExp(keyword, "i");
  return docs
    .filter((doc) => config.searchFields.some((f) => doc[f] && regex.test(doc[f])))
    .map((doc) => doc._id);
}

async function warmUp() {
  await Promise.all(Object.keys(collections).map(loadCollection));
}

function clearCache(name) {
  if (name) {
    cache.delete(name);
  } else {
    cache.clear();
  }
}

module.exports = { searchCollection, warmUp, clearCache };
