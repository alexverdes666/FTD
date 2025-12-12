import api from './api';

// Get affiliate manager metrics
export const getAffiliateManagerMetrics = async (affiliateManagerId, params = {}) => {
  try {
    const response = await api.get(`/affiliate-manager-metrics/${affiliateManagerId}`, { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching affiliate manager metrics:', error);
    throw error;
  }
};

// Get aggregated metrics for affiliate manager
export const getAggregatedMetrics = async (affiliateManagerId, params = {}) => {
  try {
    const response = await api.get(`/affiliate-manager-metrics/${affiliateManagerId}/aggregated`, { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching aggregated metrics:', error);
    throw error;
  }
};

// Calculate and store affiliate manager metrics
export const calculateAndStoreMetrics = async (affiliateManagerId, data) => {
  try {
    const response = await api.post(`/affiliate-manager-metrics/${affiliateManagerId}/calculate`, data);
    return response.data;
  } catch (error) {
    console.error('Error calculating and storing metrics:', error);
    throw error;
  }
};

// Get all affiliate managers with metrics
export const getAllAffiliateManagersWithMetrics = async (params = {}) => {
  try {
    const response = await api.get('/affiliate-manager-metrics/all', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching all affiliate managers with metrics:', error);
    throw error;
  }
};

// Update affiliate manager metrics
export const updateAffiliateManagerMetrics = async (metricsId, data) => {
  try {
    const response = await api.put(`/affiliate-manager-metrics/${metricsId}`, data);
    return response.data;
  } catch (error) {
    console.error('Error updating affiliate manager metrics:', error);
    throw error;
  }
};

// Verify affiliate manager metrics
export const verifyAffiliateManagerMetrics = async (metricsId) => {
  try {
    const response = await api.patch(`/affiliate-manager-metrics/${metricsId}/verify`);
    return response.data;
  } catch (error) {
    console.error('Error verifying affiliate manager metrics:', error);
    throw error;
  }
};

// Delete affiliate manager metrics
export const deleteAffiliateManagerMetrics = async (metricsId) => {
  try {
    const response = await api.delete(`/affiliate-manager-metrics/${metricsId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting affiliate manager metrics:', error);
    throw error;
  }
};

// Helper functions for metrics calculations
export const calculateConversionRate = (leadsConverted, leadsManaged) => {
  if (!leadsManaged || leadsManaged === 0) return 0;
  return (leadsConverted / leadsManaged) * 100;
};

export const calculateAverageOrderValue = (totalRevenue, ordersCompleted) => {
  if (!ordersCompleted || ordersCompleted === 0) return 0;
  return totalRevenue / ordersCompleted;
};

export const calculateNetworkUtilization = (networksActive, networksTotal) => {
  if (!networksTotal || networksTotal === 0) return 0;
  return (networksActive / networksTotal) * 100;
};

export const calculateCampaignROI = (revenue, investment) => {
  if (!investment || investment === 0) return 0;
  return ((revenue - investment) / investment) * 100;
};

export const formatMetricsDisplay = (metrics) => {
  if (!metrics) return null;
  
  const formatCurrency = (amount) => `$${Number(amount || 0).toFixed(2)}`;
  const formatPercentage = (value) => `${Number(value || 0).toFixed(1)}%`;
  const formatNumber = (value) => Number(value || 0).toLocaleString();
  
  return {
    revenue: {
      total: formatCurrency(metrics.totalRevenue),
      orders: formatCurrency(metrics.revenueFromOrders),
      leads: formatCurrency(metrics.revenueFromLeads),
      average: formatCurrency(metrics.averageOrderValue)
    },
    orders: {
      completed: formatNumber(metrics.ordersCompleted),
      created: formatNumber(metrics.ordersCreated),
      completionRate: formatPercentage(
        metrics.ordersCreated > 0 ? (metrics.ordersCompleted / metrics.ordersCreated) * 100 : 0
      )
    },
    leads: {
      managed: formatNumber(metrics.leadsManaged),
      converted: formatNumber(metrics.leadsConverted),
      conversionRate: formatPercentage(metrics.conversionRate * 100)
    },
    networks: {
      managed: formatNumber(metrics.networksManaged),
      performance: formatNumber(metrics.networkPerformance),
      utilization: formatPercentage(metrics.networkUtilization * 100)
    },
    campaigns: {
      managed: formatNumber(metrics.campaignsManaged),
      success: formatNumber(metrics.campaignSuccess),
      roi: formatPercentage(metrics.campaignROI)
    },
    quality: {
      score: formatNumber(metrics.qualityScore),
      satisfaction: `${Number(metrics.clientSatisfaction || 0).toFixed(1)}/10`
    }
  };
};

export const generateMetricsReport = (metrics, period) => {
  const formatted = formatMetricsDisplay(metrics);
  
  return {
    summary: {
      period: period,
      totalRevenue: formatted.revenue.total,
      ordersCompleted: formatted.orders.completed,
      conversionRate: formatted.leads.conversionRate,
      qualityScore: formatted.quality.score
    },
    performance: {
      revenue: {
        label: 'Revenue Performance',
        items: [
          { label: 'Total Revenue', value: formatted.revenue.total },
          { label: 'Order Revenue', value: formatted.revenue.orders },
          { label: 'Lead Revenue', value: formatted.revenue.leads },
          { label: 'Average Order Value', value: formatted.revenue.average }
        ]
      },
      orders: {
        label: 'Order Management',
        items: [
          { label: 'Orders Completed', value: formatted.orders.completed },
          { label: 'Orders Created', value: formatted.orders.created },
          { label: 'Completion Rate', value: formatted.orders.completionRate }
        ]
      },
      leads: {
        label: 'Lead Management',
        items: [
          { label: 'Leads Managed', value: formatted.leads.managed },
          { label: 'Leads Converted', value: formatted.leads.converted },
          { label: 'Conversion Rate', value: formatted.leads.conversionRate }
        ]
      },
      networks: {
        label: 'Network Performance',
        items: [
          { label: 'Networks Managed', value: formatted.networks.managed },
          { label: 'Performance Score', value: formatted.networks.performance },
          { label: 'Utilization Rate', value: formatted.networks.utilization }
        ]
      },
      campaigns: {
        label: 'Campaign Success',
        items: [
          { label: 'Campaigns Managed', value: formatted.campaigns.managed },
          { label: 'Success Rate', value: formatted.campaigns.success },
          { label: 'ROI', value: formatted.campaigns.roi }
        ]
      },
      quality: {
        label: 'Quality Metrics',
        items: [
          { label: 'Quality Score', value: formatted.quality.score },
          { label: 'Client Satisfaction', value: formatted.quality.satisfaction }
        ]
      }
    }
  };
};

export const validateMetricsData = (data) => {
  const errors = [];
  
  if (data.totalRevenue && data.totalRevenue < 0) {
    errors.push('Total revenue cannot be negative');
  }
  
  if (data.ordersCompleted && data.ordersCompleted < 0) {
    errors.push('Orders completed cannot be negative');
  }
  
  if (data.ordersCreated && data.ordersCreated < 0) {
    errors.push('Orders created cannot be negative');
  }
  
  if (data.leadsManaged && data.leadsManaged < 0) {
    errors.push('Leads managed cannot be negative');
  }
  
  if (data.leadsConverted && data.leadsConverted < 0) {
    errors.push('Leads converted cannot be negative');
  }
  
  if (data.leadsConverted && data.leadsManaged && data.leadsConverted > data.leadsManaged) {
    errors.push('Leads converted cannot be greater than leads managed');
  }
  
  if (data.qualityScore && (data.qualityScore < 0 || data.qualityScore > 100)) {
    errors.push('Quality score must be between 0 and 100');
  }
  
  if (data.clientSatisfaction && (data.clientSatisfaction < 0 || data.clientSatisfaction > 10)) {
    errors.push('Client satisfaction must be between 0 and 10');
  }
  
  return errors;
}; 