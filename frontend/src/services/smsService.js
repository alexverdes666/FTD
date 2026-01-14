import api from './api';

export const smsService = {
  // Get all SMS messages with filtering and pagination
  getSMSMessages: async (params = {}) => {
    try {
      const response = await api.get('/sms', { params });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Fetch SMS messages from a gateway device
  fetchFromGateway: async (gatewayId, params = {}) => {
    try {
      const response = await api.post(`/sms/fetch-from-gateway/${gatewayId}`, {}, { params });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },
};
