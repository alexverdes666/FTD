import api from './api';

const agentScheduleService = {
  /**
   * Get schedule for a specific agent and month
   * @param {string} agentId - Agent user ID
   * @param {number} year - Year
   * @param {number} month - Month (1-12)
   */
  getAgentSchedule: async (agentId, year, month) => {
    try {
      const response = await api.get(`/agent-schedule/${agentId}/${year}/${month}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching agent schedule:', error);
      throw error;
    }
  },

  /**
   * Get all agents' schedules for a specific month
   * @param {number} year - Year
   * @param {number} month - Month (1-12)
   */
  getAllAgentsSchedules: async (year, month) => {
    try {
      const response = await api.get(`/agent-schedule/all/${year}/${month}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching all agents schedules:', error);
      throw error;
    }
  },

  /**
   * Request a schedule change
   * @param {string} agentId - Agent user ID
   * @param {number} year - Year
   * @param {number} month - Month (1-12)
   * @param {number} day - Day (1-31)
   * @param {boolean} requestedAvailability - Requested availability status
   */
  requestScheduleChange: async (agentId, year, month, day, requestedAvailability) => {
    try {
      const response = await api.post('/agent-schedule/request', {
        agentId,
        year,
        month,
        day,
        requestedAvailability
      });
      return response.data;
    } catch (error) {
      console.error('Error requesting schedule change:', error);
      throw error;
    }
  },

  /**
   * Get schedule change requests
   * @param {Object} filters - Filter options
   * @param {string} [filters.agentId] - Filter by agent ID
   * @param {string} [filters.status] - Filter by status (pending, approved, rejected)
   */
  getScheduleChangeRequests: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.agentId) params.append('agentId', filters.agentId);
      if (filters.status) params.append('status', filters.status);
      
      const response = await api.get(`/agent-schedule/requests?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching schedule change requests:', error);
      throw error;
    }
  },

  /**
   * Approve a schedule change request
   * @param {string} requestId - Request ID
   */
  approveScheduleChange: async (requestId) => {
    try {
      const response = await api.put(`/agent-schedule/requests/${requestId}/approve`);
      return response.data;
    } catch (error) {
      console.error('Error approving schedule change:', error);
      throw error;
    }
  },

  /**
   * Reject a schedule change request
   * @param {string} requestId - Request ID
   * @param {string} rejectionReason - Reason for rejection
   */
  rejectScheduleChange: async (requestId, rejectionReason = '') => {
    try {
      const response = await api.put(`/agent-schedule/requests/${requestId}/reject`, {
        rejectionReason
      });
      return response.data;
    } catch (error) {
      console.error('Error rejecting schedule change:', error);
      throw error;
    }
  },

  /**
   * Bulk approve schedule change requests
   * @param {string[]} requestIds - Array of request IDs
   */
  bulkApproveScheduleChanges: async (requestIds) => {
    try {
      const response = await api.post('/agent-schedule/requests/bulk-approve', {
        requestIds
      });
      return response.data;
    } catch (error) {
      console.error('Error bulk approving schedule changes:', error);
      throw error;
    }
  }
};

export default agentScheduleService;

