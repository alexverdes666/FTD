import api from "./api";

/**
 * Global Search Service
 * Provides methods for searching across all entities
 */

/**
 * Quick search across all entities (for dropdown)
 * @param {string} query - Search query
 * @param {number} limit - Max results per category (default: 5)
 * @param {string[]} types - Optional filter by entity types
 * @returns {Promise} Search results
 */
export const quickSearch = async (query, limit = 5, types = null) => {
  const params = new URLSearchParams();
  params.append("q", query);
  params.append("limit", limit);
  if (types && types.length > 0) {
    params.append("types", types.join(","));
  }
  
  const response = await api.get(`/global-search?${params.toString()}`);
  return response.data;
};

/**
 * Full search with pagination (for search results page)
 * @param {Object} options - Search options
 * @param {string} options.query - Search query
 * @param {number} options.page - Page number (default: 1)
 * @param {number} options.limit - Results per page (default: 20)
 * @param {string[]} options.types - Optional filter by entity types
 * @param {string} options.sort - Sort order: 'relevance', 'date', 'name'
 * @returns {Promise} Search results with pagination
 */
export const fullSearch = async ({ query, page = 1, limit = 20, types = null, sort = "relevance" }) => {
  const params = new URLSearchParams();
  params.append("q", query);
  params.append("page", page);
  params.append("limit", limit);
  params.append("sort", sort);
  if (types && types.length > 0) {
    params.append("types", types.join(","));
  }
  
  const response = await api.get(`/global-search/full?${params.toString()}`);
  return response.data;
};

/**
 * Get user's search history
 * @returns {Promise} Array of recent searches
 */
export const getSearchHistory = async () => {
  const response = await api.get("/global-search/history");
  return response.data;
};

/**
 * Delete a specific search history entry
 * @param {string} entryId - History entry ID
 * @returns {Promise}
 */
export const deleteSearchHistoryEntry = async (entryId) => {
  const response = await api.delete(`/global-search/history/${entryId}`);
  return response.data;
};

/**
 * Clear all search history
 * @returns {Promise}
 */
export const clearSearchHistory = async () => {
  const response = await api.delete("/global-search/history");
  return response.data;
};

/**
 * Entity type configuration
 */
export const ENTITY_TYPES = {
  lead: {
    label: "Leads",
    color: "primary",
    icon: "Contacts",
    route: "/leads",
  },
  order: {
    label: "Orders",
    color: "warning",
    icon: "Assignment",
    route: "/orders",
  },
  user: {
    label: "Users",
    color: "success",
    icon: "Person",
    route: "/users",
  },
  campaign: {
    label: "Campaigns",
    color: "info",
    icon: "Campaign",
    route: "/campaigns",
  },
  ticket: {
    label: "Tickets",
    color: "error",
    icon: "ConfirmationNumber",
    route: "/tickets",
  },
  announcement: {
    label: "Announcements",
    color: "secondary",
    icon: "Announcement",
    route: "/announcements",
  },
  clientBroker: {
    label: "Client Brokers",
    color: "default",
    icon: "Business",
    route: "/client-brokers",
  },
  clientNetwork: {
    label: "Client Networks",
    color: "default",
    icon: "Hub",
    route: "/client-networks",
  },
  ourNetwork: {
    label: "Our Networks",
    color: "default",
    icon: "AccountTree",
    route: "/our-networks",
  },
};

/**
 * Get entity type configuration
 * @param {string} type - Entity type
 * @returns {Object} Type configuration
 */
export const getEntityTypeConfig = (type) => {
  return ENTITY_TYPES[type] || {
    label: type,
    color: "default",
    icon: "Search",
    route: "/",
  };
};

/**
 * Highlight search terms in text
 * @param {string} text - Text to highlight
 * @param {string} query - Search query
 * @returns {Array} Array of text segments with highlight flags
 */
export const highlightText = (text, query) => {
  if (!text || !query) return [{ text, highlight: false }];
  
  // Parse query to get search terms
  const terms = query
    .replace(/"[^"]+"/g, "") // Remove quoted phrases for now
    .replace(/\w+:\w+/g, "") // Remove filters
    .trim()
    .split(/\s+/)
    .filter((term) => term.length >= 2);
  
  // Add quoted phrases
  const quotedPhrases = query.match(/"([^"]+)"/g);
  if (quotedPhrases) {
    quotedPhrases.forEach((phrase) => {
      terms.push(phrase.replace(/"/g, ""));
    });
  }
  
  if (terms.length === 0) return [{ text, highlight: false }];
  
  // Create regex pattern
  const pattern = new RegExp(
    `(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi"
  );
  
  // Split text by matches
  const parts = text.split(pattern);
  
  return parts.map((part) => ({
    text: part,
    highlight: terms.some((term) => part.toLowerCase() === term.toLowerCase()),
  }));
};

/**
 * Format date for display
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
export const formatSearchDate = (date) => {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return diffMinutes <= 1 ? "Just now" : `${diffMinutes}m ago`;
    }
    return `${diffHours}h ago`;
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return d.toLocaleDateString();
};

export default {
  quickSearch,
  fullSearch,
  getSearchHistory,
  deleteSearchHistoryEntry,
  clearSearchHistory,
  ENTITY_TYPES,
  getEntityTypeConfig,
  highlightText,
  formatSearchDate,
};
