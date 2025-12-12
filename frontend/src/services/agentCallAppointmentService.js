import api from './api';

const agentCallAppointmentService = {
  // Get appointments for a specific agent and month
  getAgentAppointments: async (agentId, year, month) => {
    try {
      const response = await api.get(`/agent-call-appointments/${agentId}/${year}/${month}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching agent appointments:', error);
      throw error;
    }
  },

  // Get all agents' appointments for a month (admin/managers only)
  getAllAppointments: async (year, month) => {
    try {
      const response = await api.get(`/agent-call-appointments/all/${year}/${month}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching all appointments:', error);
      throw error;
    }
  },

  // Create a new appointment
  createAppointment: async (appointmentData) => {
    try {
      const response = await api.post('/agent-call-appointments', appointmentData);
      return response.data;
    } catch (error) {
      console.error('Error creating appointment:', error);
      throw error;
    }
  },

  // Update an existing appointment
  updateAppointment: async (appointmentId, updateData) => {
    try {
      const response = await api.put(`/agent-call-appointments/${appointmentId}`, updateData);
      return response.data;
    } catch (error) {
      console.error('Error updating appointment:', error);
      throw error;
    }
  },

  // Delete an appointment
  deleteAppointment: async (appointmentId) => {
    try {
      const response = await api.delete(`/agent-call-appointments/${appointmentId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting appointment:', error);
      throw error;
    }
  }
};

export default agentCallAppointmentService;

