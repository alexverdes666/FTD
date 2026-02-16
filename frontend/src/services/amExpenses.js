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
