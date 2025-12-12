import api from './api';

// Get all agents with their call counts for a specific month
export const getAllAgentCallCounts = async (year = null, month = null) => {
  try {
    const params = {};
    if (year) params.year = year;
    if (month) params.month = month;
    const response = await api.get('/agent-call-counts', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching all agent call counts:', error);
    throw error;
  }
};

// Get call counts for a specific agent
export const getAgentCallCounts = async (agentId, year = null, month = null) => {
  try {
    const params = {};
    if (year) params.year = year;
    if (month) params.month = month;
    const response = await api.get(`/agent-call-counts/${agentId}`, { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching agent call counts:', error);
    throw error;
  }
};

// Update call counts for a specific agent
export const updateAgentCallCounts = async (agentId, callCounts, notes = '', year = null, month = null) => {
  try {
    const response = await api.put(`/agent-call-counts/${agentId}`, {
      callCounts,
      notes,
      year,
      month
    });
    return response.data;
  } catch (error) {
    console.error('Error updating agent call counts:', error);
    throw error;
  }
};

// Get call counts for a year range
export const getCallCountsInRange = async (agentId, startYear, endYear) => {
  try {
    const response = await api.get(`/agent-call-counts/${agentId}/range`, {
      params: { startYear, endYear }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching call counts in range:', error);
    throw error;
  }
};

// Get call counts statistics
export const getCallCountsStats = async (startYear = null, endYear = null) => {
  try {
    const params = {};
    if (startYear) params.startYear = startYear;
    if (endYear) params.endYear = endYear;
    
    const response = await api.get('/agent-call-counts/stats', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching call counts stats:', error);
    throw error;
  }
};

// Delete call counts for a specific agent and month
export const deleteAgentCallCounts = async (agentId, year = null, month = null) => {
  try {
    const params = {};
    if (year) params.year = year;
    if (month) params.month = month;
    const response = await api.delete(`/agent-call-counts/${agentId}`, { params });
    return response.data;
  } catch (error) {
    console.error('Error deleting agent call counts:', error);
    throw error;
  }
};

// Legacy function - now redundant since main function works with monthly data
export const getAllAgentCallCountsMonthly = async (year, month) => {
  // Redirect to the main function
  return getAllAgentCallCounts(year, month);
};

// Helper function to calculate total bonus from call counts
export const calculateBonusFromCallCounts = (callCounts, bonusRates) => {
  if (!callCounts || !bonusRates) return 0;
  
  const bonuses = {
    firstCallBonus: (callCounts.firstCalls || 0) * (bonusRates.firstCall || 0),
    secondCallBonus: (callCounts.secondCalls || 0) * (bonusRates.secondCall || 0),
    thirdCallBonus: (callCounts.thirdCalls || 0) * (bonusRates.thirdCall || 0),
    fourthCallBonus: (callCounts.fourthCalls || 0) * (bonusRates.fourthCall || 0),
    fifthCallBonus: (callCounts.fifthCalls || 0) * (bonusRates.fifthCall || 0),
    verifiedAccBonus: (callCounts.verifiedAccounts || 0) * (bonusRates.verifiedAcc || 0),
  };
  
  return Object.values(bonuses).reduce((sum, bonus) => sum + bonus, 0);
};

// Helper function to format call counts for display
export const formatCallCountsDisplay = (callCounts) => {
  if (!callCounts) return [];
  
  const displayItems = [
    { label: '1st Calls', count: callCounts.firstCalls || 0 },
    { label: '2nd Calls', count: callCounts.secondCalls || 0 },
    { label: '3rd Calls', count: callCounts.thirdCalls || 0 },
    { label: '4th Calls', count: callCounts.fourthCalls || 0 },
    { label: '5th Calls', count: callCounts.fifthCalls || 0 },
    { label: 'Verified Accounts', count: callCounts.verifiedAccounts || 0 },
  ];
  
  return displayItems.filter(item => item.count > 0);
};

// Helper function to get total call count
export const getTotalCallCount = (callCounts) => {
  if (!callCounts) return 0;
  
  return (callCounts.firstCalls || 0) +
         (callCounts.secondCalls || 0) +
         (callCounts.thirdCalls || 0) +
         (callCounts.fourthCalls || 0) +
         (callCounts.fifthCalls || 0) +
         (callCounts.verifiedAccounts || 0);
}; 