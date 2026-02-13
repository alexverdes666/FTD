import api from "./api";

/**
 * Fetch undeclared CDR calls for the current agent
 * @param {number} months - Number of months to fetch (default 3)
 */
export const fetchCDRCalls = async (months = 3) => {
  try {
    const response = await api.get("/call-declarations/cdr", {
      params: { months },
    });
    return response.data.data;
  } catch (error) {
    console.error("Error fetching CDR calls:", error);
    throw error;
  }
};

/**
 * Find leads by phone number or email (for auto-fill in declaration dialog)
 * @param {string} phone - Phone number to search
 * @param {string} email - Email to search (fallback)
 * @returns {{ leads: Array, multiple: boolean }} - Matching leads and whether multiple were found
 */
export const findLeadsByPhone = async (phone, email) => {
  try {
    const params = {};
    if (phone) params.phone = phone;
    if (email) params.email = email;

    const response = await api.get("/call-declarations/lead-by-phone", {
      params,
    });

    const { data, multiple } = response.data;
    if (!data) return { leads: [], multiple: false };
    // Backend returns single object when 1 match, array when multiple
    const leads = Array.isArray(data) ? data : [data];
    return { leads, multiple: !!multiple };
  } catch (error) {
    console.error("Error finding leads by phone/email:", error);
    return { leads: [], multiple: false };
  }
};

/**
 * Get call types with bonus info
 */
export const getCallTypes = async () => {
  try {
    const response = await api.get("/call-declarations/call-types");
    return response.data.data;
  } catch (error) {
    console.error("Error fetching call types:", error);
    throw error;
  }
};

/**
 * Calculate bonus preview
 * @param {string} callType - Call type
 * @param {number} callDuration - Duration in seconds
 */
export const previewBonus = async (callType, callDuration) => {
  try {
    const response = await api.post("/call-declarations/preview-bonus", {
      callType,
      callDuration,
    });
    return response.data.data;
  } catch (error) {
    console.error("Error calculating bonus preview:", error);
    throw error;
  }
};

/**
 * Create a new call declaration
 * @param {Object} declarationData - Declaration data
 */
export const createDeclaration = async (declarationData) => {
  try {
    const response = await api.post("/call-declarations", declarationData);
    return response.data.data;
  } catch (error) {
    console.error("Error creating declaration:", error);
    throw error;
  }
};

/**
 * Get declarations with filters
 * @param {Object} filters - { agentId, status, month, year }
 */
export const getDeclarations = async (filters = {}) => {
  try {
    const response = await api.get("/call-declarations", {
      params: filters,
    });
    return response.data.data;
  } catch (error) {
    console.error("Error fetching declarations:", error);
    throw error;
  }
};

/**
 * Get pending declarations for manager approval
 */
export const getPendingDeclarations = async () => {
  try {
    const response = await api.get("/call-declarations/pending");
    return response.data.data;
  } catch (error) {
    console.error("Error fetching pending declarations:", error);
    throw error;
  }
};

/**
 * Get declarations for a specific agent
 * @param {string} agentId - Agent ID
 * @param {Object} filters - { status, month, year }
 */
export const getAgentDeclarations = async (agentId, filters = {}) => {
  try {
    const response = await api.get(`/call-declarations/agent/${agentId}`, {
      params: filters,
    });
    return response.data.data;
  } catch (error) {
    console.error("Error fetching agent declarations:", error);
    throw error;
  }
};

/**
 * Get monthly totals for an agent (for payroll)
 * @param {string} agentId - Agent ID
 * @param {number} year - Year
 * @param {number} month - Month (1-12)
 */
export const getMonthlyTotals = async (agentId, year = null, month = null) => {
  try {
    const params = {};
    if (year) params.year = year;
    if (month) params.month = month;

    const response = await api.get(`/call-declarations/agent/${agentId}/monthly`, {
      params,
    });
    return response.data.data;
  } catch (error) {
    console.error("Error fetching monthly totals:", error);
    throw error;
  }
};

/**
 * Get monthly totals for ALL agents (admin/manager view)
 * @param {number} year - Year
 * @param {number} month - Month (1-12)
 */
export const getAllAgentsMonthlyTotals = async (year = null, month = null) => {
  try {
    const params = {};
    if (year) params.year = year;
    if (month) params.month = month;

    const response = await api.get("/call-declarations/all-agents-monthly", {
      params,
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching all agents monthly totals:", error);
    throw error;
  }
};

/**
 * Approve a declaration (managers only)
 * @param {string} declarationId - Declaration ID
 * @param {string} notes - Optional approval notes
 */
export const approveDeclaration = async (declarationId, notes = null) => {
  try {
    const data = {};
    if (notes) data.notes = notes;

    const response = await api.patch(`/call-declarations/${declarationId}/approve`, data);
    return response.data.data;
  } catch (error) {
    console.error("Error approving declaration:", error);
    throw error;
  }
};

/**
 * Reject a declaration (managers only)
 * @param {string} declarationId - Declaration ID
 * @param {string} notes - Required rejection notes
 */
export const rejectDeclaration = async (declarationId, notes) => {
  try {
    const response = await api.patch(`/call-declarations/${declarationId}/reject`, {
      notes,
    });
    return response.data.data;
  } catch (error) {
    console.error("Error rejecting declaration:", error);
    throw error;
  }
};

/**
 * Fetch a call recording as a blob (proxied through backend to avoid mixed content)
 * @param {string} recordFile - Recording filename (without .mp3 extension)
 * @returns {string} - Object URL for the audio blob
 */
export const fetchRecordingBlob = async (recordFile) => {
  const response = await api.get(`/call-declarations/recording/${recordFile}`, {
    responseType: "blob",
  });
  return URL.createObjectURL(response.data);
};

/**
 * Get disabled call types for a lead
 * @param {string} leadId - Lead ID
 * @param {string} orderId - Optional order ID to scope the check
 * @returns {Array} - Array of disabled call type values
 */
export const getDisabledCallTypes = async (leadId, orderId = null) => {
  try {
    const params = {};
    if (orderId) params.orderId = orderId;
    const response = await api.get(`/call-declarations/lead-disabled-types/${leadId}`, { params });
    return response.data.data.disabledCallTypes || [];
  } catch (error) {
    console.error("Error fetching disabled call types:", error);
    return [];
  }
};

/**
 * Get confirmed deposit orders for a lead
 * @param {string} leadId - Lead ID
 * @returns {Array} - Array of { orderId, orderCreatedAt, depositCallId }
 */
export const getLeadOrders = async (leadId) => {
  try {
    const response = await api.get(`/call-declarations/lead-orders/${leadId}`);
    return response.data.data || [];
  } catch (error) {
    console.error("Error fetching lead orders:", error);
    return [];
  }
};

/**
 * Delete a declaration
 * @param {string} declarationId - Declaration ID
 */
export const deleteDeclaration = async (declarationId) => {
  try {
    const response = await api.delete(`/call-declarations/${declarationId}`);
    return response.data;
  } catch (error) {
    console.error("Error deleting declaration:", error);
    throw error;
  }
};
