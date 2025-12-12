import api from './api';

// Get all salary configurations
export const getAllSalaryConfigurations = async (params = {}) => {
  try {
    const response = await api.get('/salary-configuration', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching salary configurations:', error);
    throw error;
  }
};

// Get users with salary configurations
export const getUsersWithSalaryConfigurations = async (roles = []) => {
  try {
    const params = roles.length > 0 ? { roles: roles.join(',') } : {};
    const response = await api.get('/salary-configuration/users', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching users with salary configurations:', error);
    throw error;
  }
};

// Get salary configuration by user ID
export const getSalaryConfigurationByUser = async (userId) => {
  try {
    const response = await api.get(`/salary-configuration/user/${userId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching salary configuration for user:', error);
    throw error;
  }
};

// Calculate salary for a user
export const calculateSalary = async (userId, params = {}) => {
  try {
    const response = await api.get(`/salary-configuration/user/${userId}/calculate`, { params });
    return response.data;
  } catch (error) {
    console.error('Error calculating salary:', error);
    throw error;
  }
};

// Create or update salary configuration
export const createOrUpdateSalaryConfiguration = async (configData) => {
  try {
    const response = await api.post('/salary-configuration', configData);
    return response.data;
  } catch (error) {
    console.error('Error creating/updating salary configuration:', error);
    throw error;
  }
};

// Delete salary configuration
export const deleteSalaryConfiguration = async (userId) => {
  try {
    const response = await api.delete(`/salary-configuration/user/${userId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting salary configuration:', error);
    throw error;
  }
};

// Get salary statistics
export const getSalaryStatistics = async () => {
  try {
    const response = await api.get('/salary-configuration/statistics');
    return response.data;
  } catch (error) {
    console.error('Error fetching salary statistics:', error);
    throw error;
  }
};

// Helper functions for salary calculations
export const calculateAffiliateManagerSalary = (configuration, metrics) => {
  const formula = configuration.affiliateManagerFormula;
  if (!formula) return null;
  
  const baseSalary = formula.baseSalary || 0;
  const commission = (metrics.totalRevenue || 0) * (formula.commissionRate || 0);
  
  const bonuses = {
    orderCompletion: (metrics.ordersCompleted || 0) * (formula.bonusStructure?.orderCompletionBonus || 0)
  };
  
  const totalBonuses = Object.values(bonuses).reduce((sum, bonus) => sum + bonus, 0);
  const totalSalary = baseSalary + commission + totalBonuses;
  
  return {
    baseSalary,
    commission,
    bonuses,
    totalBonuses,
    totalSalary,
    breakdown: {
      base: baseSalary,
      commission,
      bonuses: totalBonuses
    }
  };
};

export const calculateFixedSalary = (configuration, period = 'monthly') => {
  const fixedSalary = configuration.fixedSalary;
  if (!fixedSalary) return null;
  
  let amount = fixedSalary.amount;
  
  // Adjust for payment frequency
  if (period === 'weekly' && fixedSalary.paymentFrequency === 'monthly') {
    amount = amount / 4.33; // Average weeks per month
  } else if (period === 'bi_weekly' && fixedSalary.paymentFrequency === 'monthly') {
    amount = amount / 2.17; // Average bi-weekly periods per month
  }
  
  return {
    amount,
    currency: fixedSalary.currency,
    paymentFrequency: fixedSalary.paymentFrequency,
    adjustedFor: period
  };
};

export const formatSalaryDisplay = (salaryData, salaryType) => {
  if (!salaryData) return null;
  
  const formatCurrency = (amount) => `$${Number(amount).toFixed(2)}`;
  
  switch (salaryType) {
    case 'fixed_monthly':
      return {
        primary: formatCurrency(salaryData.amount),
        secondary: `${salaryData.paymentFrequency} payment`,
        details: [
          { label: 'Amount', value: formatCurrency(salaryData.amount) },
          { label: 'Frequency', value: salaryData.paymentFrequency }
        ]
      };
      

      
    default:
      return {
        primary: 'Unknown',
        secondary: 'Unknown salary type',
        details: []
      };
  }
};

export const validateSalaryConfiguration = (configData) => {
  const errors = [];
  
  if (!configData.userId) {
    errors.push('User ID is required');
  }
  
  if (!configData.salaryType) {
    errors.push('Salary type is required');
  }
  
  if (configData.salaryType === 'fixed_monthly') {
    if (!configData.fixedSalary?.amount || configData.fixedSalary.amount <= 0) {
      errors.push('Fixed salary amount must be greater than 0');
    }
  }
  

  
  return errors;
}; 