import api from './api';

// Date range utility functions
export const getDateRangePresets = () => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  
  const startOfQuarter = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
  
  const startOfYear = new Date(today.getFullYear(), 0, 1);
  
  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };
  
  const setEndOfDay = (date) => {
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);
    return endDate;
  };
  
  return {
    today: {
      label: 'Today',
      startDate: formatDate(today),
      endDate: formatDate(setEndOfDay(today))
    },
    yesterday: {
      label: 'Yesterday',
      startDate: formatDate(yesterday),
      endDate: formatDate(setEndOfDay(yesterday))
    },
    thisWeek: {
      label: 'This Week',
      startDate: formatDate(startOfWeek),
      endDate: formatDate(setEndOfDay(today))
    },
    thisMonth: {
      label: 'This Month',
      startDate: formatDate(startOfMonth),
      endDate: formatDate(setEndOfDay(today))
    },
    thisQuarter: {
      label: 'This Quarter',
      startDate: formatDate(startOfQuarter),
      endDate: formatDate(setEndOfDay(today))
    },
    thisYear: {
      label: 'This Year',
      startDate: formatDate(startOfYear),
      endDate: formatDate(setEndOfDay(today))
    }
  };
};

// Create withdrawal request
export const createWithdrawalRequest = async (withdrawalData) => {
  try {
    const response = await api.post('/withdrawals', withdrawalData);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Get user's withdrawal requests (agents and affiliate managers)
export const getAgentWithdrawals = async (params = {}) => {
  try {
    const response = await api.get('/withdrawals/me', { params });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Get total completed withdrawals for a user
export const getCompletedWithdrawalsTotal = async (userId = null) => {
  try {
    // If no userId provided, get for current user
    const endpoint = userId ? `/withdrawals/completed-total/${userId}` : '/withdrawals/me/completed-total';
    const response = await api.get(endpoint);
    return response.data;
  } catch (error) {
    console.error('Error fetching completed withdrawals total:', error);
    // Return 0 if there's an error to prevent breaking the withdrawal flow
    return { data: { totalCompleted: 0 } };
  }
};

// Get agent withdrawals by month
export const getAgentWithdrawalsByMonth = async (year, month) => {
  try {
    const response = await api.get(`/withdrawals/me/by-month`, {
      params: { year, month }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching agent withdrawals by month:', error);
    return { data: [] };
  }
};

// Get completed withdrawals total for a specific month
export const getCompletedWithdrawalsByMonth = async (year, month) => {
  try {
    const response = await api.get(`/withdrawals/me/completed-by-month`, {
      params: { year, month }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching completed withdrawals by month:', error);
    return { data: { totalAmount: 0, count: 0 } };
  }
};

// Get specific withdrawal request
export const getWithdrawal = async (withdrawalId) => {
  try {
    const response = await api.get(`/withdrawals/${withdrawalId}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Update withdrawal wallet addresses (for pending withdrawals only)
export const updateWithdrawalWallet = async (withdrawalId, usdtErc20Wallet, usdtTrc20Wallet) => {
  try {
    const response = await api.put(`/withdrawals/${withdrawalId}/wallet`, { usdtErc20Wallet, usdtTrc20Wallet });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Admin functions
export const getAllWithdrawals = async (params = {}) => {
  try {
    const response = await api.get('/withdrawals', { params });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const getWithdrawalStats = async (params = {}) => {
  try {
    const response = await api.get('/withdrawals/stats', { params });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const processWithdrawal = async (withdrawalId, processData) => {
  try {
    const response = await api.put(`/withdrawals/${withdrawalId}/process`, processData);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Helper function to format withdrawal status
export const getWithdrawalStatusColor = (status) => {
  switch (status) {
    case 'pending':
      return 'warning';
    case 'approved':
      return 'info';
    case 'completed':
      return 'success';
    case 'rejected':
      return 'error';
    default:
      return 'default';
  }
};

// Helper function to format withdrawal status text
export const getWithdrawalStatusText = (status) => {
  switch (status) {
    case 'pending':
      return 'Pending Review';
    case 'approved':
      return 'Approved';
    case 'completed':
      return 'Completed';
    case 'rejected':
      return 'Rejected';
    default:
      return status;
  }
}; 