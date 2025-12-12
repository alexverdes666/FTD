import api from './api';

export const blockchainService = {
  // Get blockchain scraper status
  async getScraperStatus() {
    try {
      const response = await api.get('/blockchain/status');
      return response.data;
    } catch (error) {
      console.error('Error fetching blockchain scraper status:', error);
      throw error;
    }
  },

  // Trigger blockchain scrapers
  async triggerScrapers() {
    try {
      const response = await api.post('/blockchain/scrape');
      return response.data;
    } catch (error) {
      console.error('Error triggering blockchain scrapers:', error);
      throw error;
    }
  },

  // Trigger blockchain scrapers for a specific network
  async triggerNetworkScrapers(networkId) {
    try {
      const response = await api.post(`/blockchain/scrape/${networkId}`);
      return response.data;
    } catch (error) {
      console.error('Error triggering network blockchain scrapers:', error);
      throw error;
    }
  },

  // Get recent transactions for all networks
  async getRecentTransactions(limit = 50) {
    try {
      const response = await api.get(`/blockchain/transactions?limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching recent transactions:', error);
      throw error;
    }
  },

  // Get transactions for a specific network with advanced filtering
  async getNetworkTransactions(networkId, filters = {}) {
    try {
      const params = new URLSearchParams();
      
      // Add all filter parameters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, value);
        }
      });
      
      const response = await api.get(`/blockchain/networks/${networkId}/transactions?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching network transactions:', error);
      throw error;
    }
  },

  // Get transaction history with comprehensive filtering
  async getTransactionHistory(networkId, filters = {}) {
    try {
      const defaultFilters = {
        limit: 50,
        page: 1,
        transferType: 'incoming',
        sortBy: 'timestamp',
        sortOrder: 'desc'
      };
      
      const mergedFilters = { ...defaultFilters, ...filters };
      return await this.getNetworkTransactions(networkId, mergedFilters);
    } catch (error) {
      console.error('Error fetching transaction history:', error);
      throw error;
    }
  },

  // Get overall summary statistics
  async getOverallSummary(days = 30) {
    try {
      const response = await api.get(`/blockchain/summary?days=${days}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching overall summary:', error);
      throw error;
    }
  },

  // Get network-specific summary statistics
  async getNetworkSummary(networkId, days = 30, month = null, year = null) {
    try {
      const params = new URLSearchParams();
      
      if (month !== null && year !== null) {
        params.append('month', month.toString());
        params.append('year', year.toString());
      } else {
        const daysParam = days === 0 ? '0' : days.toString();
        params.append('days', daysParam);
      }
      
      const response = await api.get(`/blockchain/networks/${networkId}/summary?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching network summary:', error);
      throw error;
    }
  }
};

export default blockchainService; 