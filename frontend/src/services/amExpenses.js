import api from "./api";

export const getCalculatedExpenses = async (params = {}) => {
  try {
    const response = await api.get("/am-expenses/calculate", { params });
    return response.data;
  } catch (error) {
    console.error("Error fetching calculated expenses:", error);
    throw error;
  }
};

export const getCalculatedExpensesForAM = async (id, params = {}) => {
  try {
    const response = await api.get(`/am-expenses/calculate/${id}`, { params });
    return response.data;
  } catch (error) {
    console.error("Error fetching AM expense details:", error);
    throw error;
  }
};

export const getFixedExpenses = async (id, params = {}) => {
  try {
    const response = await api.get(`/am-expenses/fixed/${id}`, { params });
    return response.data;
  } catch (error) {
    console.error("Error fetching fixed expenses:", error);
    throw error;
  }
};

export const addFixedExpense = async (id, data) => {
  try {
    const response = await api.post(`/am-expenses/fixed/${id}`, data);
    return response.data;
  } catch (error) {
    console.error("Error adding fixed expense:", error);
    throw error;
  }
};

export const updateFixedExpense = async (id, data) => {
  try {
    const response = await api.put(`/am-expenses/fixed/${id}`, data);
    return response.data;
  } catch (error) {
    console.error("Error updating fixed expense:", error);
    throw error;
  }
};

export const deleteFixedExpense = async (id) => {
  try {
    const response = await api.delete(`/am-expenses/fixed/${id}`);
    return response.data;
  } catch (error) {
    console.error("Error deleting fixed expense:", error);
    throw error;
  }
};

// ==================== Global Fixed Expenses ====================

export const getGlobalFixedExpenses = async () => {
  try {
    const response = await api.get("/am-expenses/global-fixed");
    return response.data;
  } catch (error) {
    console.error("Error fetching global fixed expenses:", error);
    throw error;
  }
};

export const addGlobalFixedExpense = async (data) => {
  try {
    const response = await api.post("/am-expenses/global-fixed", data);
    return response.data;
  } catch (error) {
    console.error("Error adding global fixed expense:", error);
    throw error;
  }
};

export const updateGlobalFixedExpense = async (id, data) => {
  try {
    const response = await api.put(`/am-expenses/global-fixed/${id}`, data);
    return response.data;
  } catch (error) {
    console.error("Error updating global fixed expense:", error);
    throw error;
  }
};

export const deleteGlobalFixedExpense = async (id) => {
  try {
    const response = await api.delete(`/am-expenses/global-fixed/${id}`);
    return response.data;
  } catch (error) {
    console.error("Error deleting global fixed expense:", error);
    throw error;
  }
};
