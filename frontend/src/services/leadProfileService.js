import api from "./api";

export const leadProfileService = {
  verifyPassword: async (password) => {
    try {
      const response = await api.post("/lead-profiles/verify-password", {
        password,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  getProfilesByLead: async (leadId) => {
    try {
      const response = await api.get(`/lead-profiles/lead/${leadId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  getSensitiveFields: async (id, unlockToken) => {
    try {
      const response = await api.get(`/lead-profiles/${id}/sensitive`, {
        headers: { "X-Unlock-Token": unlockToken },
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  getTotpCode: async (id, unlockToken) => {
    try {
      const response = await api.get(`/lead-profiles/${id}/totp`, {
        headers: { "X-Unlock-Token": unlockToken },
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  createProfile: async (profileData) => {
    try {
      const response = await api.post("/lead-profiles", profileData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  updateProfile: async (id, profileData) => {
    try {
      const response = await api.put(`/lead-profiles/${id}`, profileData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  deleteProfile: async (id) => {
    try {
      const response = await api.delete(`/lead-profiles/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },
};
