import api from './api';

export const simCardService = {
  // Get all SIM cards with filtering and pagination
  getSimCards: async (params = {}) => {
    try {
      const response = await api.get('/simcards', { params });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Get single SIM card by ID
  getSimCardById: async (id) => {
    try {
      const response = await api.get(`/simcards/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Create new SIM card
  createSimCard: async (simCardData) => {
    try {
      const response = await api.post('/simcards', simCardData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Update SIM card
  updateSimCard: async (id, simCardData) => {
    try {
      const response = await api.put(`/simcards/${id}`, simCardData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Update SIM card status
  updateSimCardStatus: async (id, status) => {
    try {
      const response = await api.put(`/simcards/${id}/status`, { status });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Delete SIM card
  deleteSimCard: async (id) => {
    try {
      const response = await api.delete(`/simcards/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Get SIM card statistics
  getSimCardStats: async () => {
    try {
      const response = await api.get('/simcards/stats');
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // =============================================================================
  // GATEWAY INTEGRATION METHODS
  // =============================================================================

  /**
   * Configure gateway notifications
   * @param {Object} config - Configuration object
   * @param {string} config.callbackUrl - URL where gateway should send status updates
   * @param {number} config.period - Status report period in seconds (min 60)
   * @param {number} config.allSims - Get all card status (0 or 1)
   */
  configureGatewayNotifications: async (config) => {
    try {
      const response = await api.post('/simcards/gateway/configure', config);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Enable gateway integration for a SIM card
   * @param {string} id - SIM card ID
   * @param {Object} gatewayConfig - Gateway configuration
   * @param {string} gatewayConfig.port - Gateway port (e.g., "1A", "2B")
   * @param {number} gatewayConfig.slot - Slot number (1-4)
   */
  enableGatewayIntegration: async (id, gatewayConfig) => {
    try {
      const response = await api.post(`/simcards/${id}/gateway/enable`, gatewayConfig);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Disable gateway integration for a SIM card
   * @param {string} id - SIM card ID
   */
  disableGatewayIntegration: async (id) => {
    try {
      const response = await api.post(`/simcards/${id}/gateway/disable`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Lock a SIM card port
   * @param {string} id - SIM card ID
   */
  lockPort: async (id) => {
    try {
      const response = await api.post(`/simcards/${id}/gateway/lock`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Unlock a SIM card port
   * @param {string} id - SIM card ID
   */
  unlockPort: async (id) => {
    try {
      const response = await api.post(`/simcards/${id}/gateway/unlock`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Switch SIM card slot
   * @param {string} id - SIM card ID
   * @param {number} targetSlot - Target slot number (1-4)
   */
  switchSlot: async (id, targetSlot) => {
    try {
      const response = await api.post(`/simcards/${id}/gateway/switch`, { targetSlot });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Reset port/module
   * @param {string} id - SIM card ID
   */
  resetPort: async (id) => {
    try {
      const response = await api.post(`/simcards/${id}/gateway/reset`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Send SMS via gateway
   * @param {string} id - SIM card ID
   * @param {Object} smsData - SMS data
   * @param {string|Array} smsData.to - Recipient(s) phone number(s)
   * @param {string} smsData.message - SMS message content
   * @param {Object} smsData.options - Optional SMS options
   */
  sendSMS: async (id, smsData) => {
    try {
      const response = await api.post(`/simcards/${id}/gateway/sms`, smsData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Get SMS statistics from gateway
   * @param {Object} params - Query parameters
   * @param {string} params.ports - Ports to query (e.g., "all", "1A,2B")
   * @param {string} params.slots - Slots to query
   * @param {number} params.type - Statistics type (0: last hour, 1: last 2 hours, 2: today, 3: cumulative)
   */
  getGatewaySMSStats: async (params = {}) => {
    try {
      const response = await api.get('/simcards/gateway/stats/sms', { params });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Get call statistics from gateway
   * @param {Object} params - Query parameters
   * @param {string} params.ports - Ports to query
   * @param {string} params.slots - Slots to query
   * @param {number} params.type - Statistics type
   */
  getGatewayCallStats: async (params = {}) => {
    try {
      const response = await api.get('/simcards/gateway/stats/calls', { params });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  }
};
