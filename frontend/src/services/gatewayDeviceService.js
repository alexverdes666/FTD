import api from './api';

const gatewayDeviceService = {
  /**
   * Get all gateway devices
   * @param {boolean} includeInactive - Include inactive gateways
   */
  async getGatewayDevices(includeInactive = false) {
    const params = includeInactive ? { includeInactive: 'true' } : {};
    const response = await api.get('/gateway-devices', { params });
    return response.data;
  },

  /**
   * Get single gateway device by ID
   * @param {string} id - Gateway device ID
   */
  async getGatewayDeviceById(id) {
    const response = await api.get(`/gateway-devices/${id}`);
    return response.data;
  },

  /**
   * Create new gateway device
   * @param {Object} gatewayData - Gateway device data
   */
  async createGatewayDevice(gatewayData) {
    const response = await api.post('/gateway-devices', gatewayData);
    return response.data;
  },

  /**
   * Update gateway device
   * @param {string} id - Gateway device ID
   * @param {Object} gatewayData - Updated gateway data
   */
  async updateGatewayDevice(id, gatewayData) {
    const response = await api.put(`/gateway-devices/${id}`, gatewayData);
    return response.data;
  },

  /**
   * Delete gateway device
   * @param {string} id - Gateway device ID
   */
  async deleteGatewayDevice(id) {
    const response = await api.delete(`/gateway-devices/${id}`);
    return response.data;
  },

  /**
   * Test connection to gateway device
   * @param {string} id - Gateway device ID
   */
  async testGatewayConnection(id) {
    const response = await api.post(`/gateway-devices/${id}/test`);
    return response.data;
  },

  /**
   * Get live status from gateway device
   * @param {string} id - Gateway device ID
   */
  async getGatewayLiveStatus(id) {
    const response = await api.get(`/gateway-devices/${id}/status`);
    return response.data;
  },

  /**
   * Configure status notifications for gateway
   * @param {string} id - Gateway device ID
   * @param {Object} config - Notification configuration
   */
  async configureNotifications(id, config) {
    const response = await api.post(`/gateway-devices/${id}/configure-notifications`, config);
    return response.data;
  }
};

export default gatewayDeviceService;

