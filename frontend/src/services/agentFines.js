import api from "./api";

// Get all agent fines (admin)
export const getAllAgentFines = async (year = null, month = null) => {
  try {
    const params = {};
    if (year) params.year = year;
    if (month) params.month = month;
    
    const response = await api.get("/agent-fines/all", {
      params,
    });
    return response.data.data;
  } catch (error) {
    console.error("Error fetching all agent fines:", error);
    throw error;
  }
};

// Get fines summary for all agents (admin)
export const getFinesSummary = async () => {
  try {
    const response = await api.get("/agent-fines/summary");
    return response.data.data;
  } catch (error) {
    console.error("Error fetching fines summary:", error);
    throw error;
  }
};

// Get fines for a specific agent
export const getAgentFines = async (agentId, includeResolved = false, year = null, month = null) => {
  try {
    const params = { includeResolved };
    if (year) params.year = year;
    if (month) params.month = month;
    
    const response = await api.get(`/agent-fines/agent/${agentId}`, {
      params,
    });
    return response.data.data;
  } catch (error) {
    console.error("Error fetching agent fines:", error);
    throw error;
  }
};

// Get total active fines for an agent
export const getAgentTotalFines = async (agentId, year = null, month = null) => {
  try {
    const params = {};
    if (year) params.year = year;
    if (month) params.month = month;
    
    const response = await api.get(`/agent-fines/agent/${agentId}/total`, {
      params,
    });
    return response.data.data;
  } catch (error) {
    console.error("Error fetching agent total fines:", error);
    throw error;
  }
};

// Create a new fine for an agent
// fineData can include: amount, reason, description, notes, fineMonth, fineYear, images, leadId
export const createAgentFine = async (agentId, fineData) => {
  try {
    const response = await api.post(`/agent-fines/agent/${agentId}`, fineData);
    return response.data.data;
  } catch (error) {
    console.error("Error creating agent fine:", error);
    throw error;
  }
};

// Update a fine
export const updateAgentFine = async (fineId, fineData) => {
  try {
    const response = await api.put(`/agent-fines/${fineId}`, fineData);
    return response.data.data;
  } catch (error) {
    console.error("Error updating agent fine:", error);
    throw error;
  }
};

// Resolve a fine (mark as paid, waived, etc.)
export const resolveAgentFine = async (fineId, status, notes) => {
  try {
    const response = await api.patch(`/agent-fines/${fineId}/resolve`, {
      status,
      notes,
    });
    return response.data.data;
  } catch (error) {
    console.error("Error resolving agent fine:", error);
    throw error;
  }
};

// Delete a fine
export const deleteAgentFine = async (fineId) => {
  try {
    const response = await api.delete(`/agent-fines/${fineId}`);
    return response.data;
  } catch (error) {
    console.error("Error deleting agent fine:", error);
    throw error;
  }
};

// Get monthly fines for an agent (similar to monthly call bonuses)
export const getAgentMonthlyFines = async (agentId, year = null, month = null) => {
  try {
    const params = {};
    if (year) params.year = year;
    if (month) params.month = month;

    const response = await api.get(`/agent-fines/agent/${agentId}/monthly`, {
      params,
    });
    return response.data.data;
  } catch (error) {
    console.error("Error fetching agent monthly fines:", error);
    throw error;
  }
};

// Agent respond to fine (approve or dispute)
export const respondToFine = async (fineId, action, disputeReason = null, description = null, images = null) => {
  try {
    const data = { action };
    if (disputeReason) {
      data.disputeReason = disputeReason;
    }
    if (description) {
      data.description = description;
    }
    if (images && images.length > 0) {
      data.images = images;
    }
    const response = await api.patch(`/agent-fines/${fineId}/agent-response`, data);
    return response.data.data;
  } catch (error) {
    console.error("Error responding to fine:", error);
    throw error;
  }
};

// Admin decision on disputed fine
export const adminDecideFine = async (fineId, action, notes = null) => {
  try {
    const data = { action };
    if (notes) {
      data.notes = notes;
    }
    const response = await api.patch(`/agent-fines/${fineId}/admin-decision`, data);
    return response.data.data;
  } catch (error) {
    console.error("Error making admin decision on fine:", error);
    throw error;
  }
};

// Get fines pending agent approval
export const getPendingApprovalFines = async () => {
  try {
    const response = await api.get("/agent-fines/pending-approval");
    return response.data.data;
  } catch (error) {
    console.error("Error fetching pending approval fines:", error);
    throw error;
  }
};

// Get disputed fines for admin review
export const getDisputedFines = async () => {
  try {
    const response = await api.get("/agent-fines/disputed");
    return response.data.data;
  } catch (error) {
    console.error("Error fetching disputed fines:", error);
    throw error;
  }
};

// Get unacknowledged fines for the current agent (popup notifications)
export const getUnacknowledgedFines = async () => {
  try {
    const response = await api.get("/agent-fines/unacknowledged");
    return response.data.data;
  } catch (error) {
    console.error("Error fetching unacknowledged fines:", error);
    throw error;
  }
};

// Acknowledge a fine (dismiss popup notification)
export const acknowledgeFine = async (fineId) => {
  try {
    const response = await api.patch(`/agent-fines/${fineId}/acknowledge`);
    return response.data;
  } catch (error) {
    console.error("Error acknowledging fine:", error);
    throw error;
  }
};

// Get fines by lead ID
export const getFinesByLeadId = async (leadId) => {
  try {
    const response = await api.get(`/agent-fines/lead/${leadId}`);
    return response.data.data;
  } catch (error) {
    console.error("Error fetching fines by lead ID:", error);
    throw error;
  }
};
