import api from "./api";

const depositCallsService = {
  // Get all deposit calls with filters
  getDepositCalls: async (params = {}) => {
    try {
      const response = await api.get("/deposit-calls", { params });
      return response.data;
    } catch (error) {
      console.error("Error fetching deposit calls:", error);
      throw error;
    }
  },

  // Get single deposit call by ID
  getDepositCallById: async (id) => {
    try {
      const response = await api.get(`/deposit-calls/${id}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching deposit call:", error);
      throw error;
    }
  },

  // Get calendar appointments
  getCalendarAppointments: async (startDate, endDate, filters = {}) => {
    try {
      const response = await api.get("/deposit-calls/calendar", {
        params: { startDate, endDate, ...filters },
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching calendar appointments:", error);
      throw error;
    }
  },

  // Get pending approvals
  getPendingApprovals: async () => {
    try {
      const response = await api.get("/deposit-calls/pending-approvals");
      return response.data;
    } catch (error) {
      console.error("Error fetching pending approvals:", error);
      throw error;
    }
  },

  // Create deposit call
  createDepositCall: async (data) => {
    try {
      const response = await api.post("/deposit-calls", data);
      return response.data;
    } catch (error) {
      console.error("Error creating deposit call:", error);
      throw error;
    }
  },

  // Create deposit calls from order
  createFromOrder: async (orderId) => {
    try {
      const response = await api.post("/deposit-calls/from-order", { orderId });
      return response.data;
    } catch (error) {
      console.error("Error creating deposit calls from order:", error);
      throw error;
    }
  },

  // Create and assign deposit call for a single FTD lead to an agent
  assignToAgent: async (orderId, leadId, agentId) => {
    try {
      const response = await api.post("/deposit-calls/assign-to-agent", {
        orderId,
        leadId,
        agentId,
      });
      return response.data;
    } catch (error) {
      console.error("Error assigning deposit call to agent:", error);
      throw error;
    }
  },

  // Update deposit call
  updateDepositCall: async (id, data) => {
    try {
      const response = await api.put(`/deposit-calls/${id}`, data);
      return response.data;
    } catch (error) {
      console.error("Error updating deposit call:", error);
      throw error;
    }
  },

  // Schedule a call
  scheduleCall: async (id, callNumber, expectedDate, notes = "") => {
    try {
      const response = await api.post(`/deposit-calls/${id}/schedule`, {
        callNumber,
        expectedDate,
        notes,
      });
      return response.data;
    } catch (error) {
      console.error("Error scheduling call:", error);
      throw error;
    }
  },

  // Bulk schedule calls
  bulkScheduleCalls: async (depositCallId, calls) => {
    try {
      const response = await api.post(
        `/deposit-calls/${depositCallId}/bulk-schedule`,
        {
          depositCallId,
          calls,
        }
      );
      return response.data;
    } catch (error) {
      console.error("Error bulk scheduling calls:", error);
      throw error;
    }
  },

  // Mark call as done
  markCallDone: async (id, callNumber, notes = "") => {
    try {
      const response = await api.post(`/deposit-calls/${id}/mark-done`, {
        callNumber,
        notes,
      });
      return response.data;
    } catch (error) {
      console.error("Error marking call as done:", error);
      throw error;
    }
  },

  // Approve a call
  approveCall: async (id, callNumber) => {
    try {
      const response = await api.post(`/deposit-calls/${id}/approve`, {
        callNumber,
      });
      return response.data;
    } catch (error) {
      console.error("Error approving call:", error);
      throw error;
    }
  },

  // Reject a call
  rejectCall: async (id, callNumber) => {
    try {
      const response = await api.post(`/deposit-calls/${id}/reject`, {
        callNumber,
      });
      return response.data;
    } catch (error) {
      console.error("Error rejecting call:", error);
      throw error;
    }
  },
};

export default depositCallsService;
