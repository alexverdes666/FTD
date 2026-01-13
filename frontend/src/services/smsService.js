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
};
