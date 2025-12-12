import api from './api';

// Get global bonus rates configuration
export const getGlobalBonusRates = async () => {
  try {
    const response = await api.get('/system-config/bonus-rates');
    return response.data;
  } catch (error) {
    console.error('Error fetching global bonus rates:', error);
    throw error;
  }
};

// Update global bonus rates configuration
export const updateGlobalBonusRates = async (bonusRates, notes = '') => {
  try {
    const response = await api.put('/system-config/bonus-rates', {
      bonusRates,
      notes
    });
    return response.data;
  } catch (error) {
    console.error('Error updating global bonus rates:', error);
    throw error;
  }
};
