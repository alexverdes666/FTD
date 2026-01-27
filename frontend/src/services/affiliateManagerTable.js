import api from "./api";

// Get affiliate manager table data
export const getAffiliateManagerTable = async (
  affiliateManagerId,
  params = {}
) => {
  try {
    const response = await api.get(
      `/affiliate-manager-table/${affiliateManagerId}`,
      { params }
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching affiliate manager table:", error);
    throw error;
  }
};

// Get all affiliate manager tables (Admin only)
export const getAllAffiliateManagerTables = async (params = {}) => {
  try {
    const response = await api.get("/affiliate-manager-table/all", { params });
    return response.data;
  } catch (error) {
    console.error("Error fetching all affiliate manager tables:", error);
    throw error;
  }
};

// Update affiliate manager table data
export const updateAffiliateManagerTable = async (affiliateManagerId, data) => {
  try {
    const response = await api.put(
      `/affiliate-manager-table/${affiliateManagerId}`,
      data
    );
    return response.data;
  } catch (error) {
    console.error("Error updating affiliate manager table:", error);
    throw error;
  }
};

// Update single table row
export const updateTableRow = async (affiliateManagerId, rowId, data) => {
  try {
    const response = await api.put(
      `/affiliate-manager-table/${affiliateManagerId}/row/${rowId}`,
      data
    );
    return response.data;
  } catch (error) {
    console.error("Error updating table row:", error);
    throw error;
  }
};

// Refresh total money from crypto wallet values for affiliate manager table
export const refreshTotalMoneyFromCrypto = async (
  affiliateManagerId,
  params = {}
) => {
  try {
    const response = await api.post(
      `/affiliate-manager-table/${affiliateManagerId}/refresh-crypto-total`,
      {},
      { params }
    );
    return response.data;
  } catch (error) {
    console.error("Error refreshing total money from crypto:", error);
    throw error;
  }
};

// Add new table row
export const addTableRow = async (affiliateManagerId, data) => {
  try {
    const response = await api.post(
      `/affiliate-manager-table/${affiliateManagerId}/row`,
      data
    );
    return response.data;
  } catch (error) {
    console.error("Error adding table row:", error);
    throw error;
  }
};

// Delete table row
export const deleteTableRow = async (affiliateManagerId, rowId) => {
  try {
    const response = await api.delete(
      `/affiliate-manager-table/${affiliateManagerId}/row/${rowId}`
    );
    return response.data;
  } catch (error) {
    console.error("Error deleting table row:", error);
    throw error;
  }
};

// Reset table to default structure
export const resetTableToDefault = async (affiliateManagerId) => {
  try {
    const response = await api.post(
      `/affiliate-manager-table/${affiliateManagerId}/reset`
    );
    return response.data;
  } catch (error) {
    console.error("Error resetting table to default:", error);
    throw error;
  }
};

// Get table statistics
export const getTableStatistics = async (params = {}) => {
  try {
    const response = await api.get("/affiliate-manager-table/statistics", {
      params,
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching table statistics:", error);
    throw error;
  }
};

// Get affiliate manager summary (FTDs, Shaved, Fillers)
export const getAffiliateManagerSummary = async (params = {}) => {
  try {
    const response = await api.get("/affiliate-manager-table/summary", {
      params,
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching affiliate manager summary:", error);
    throw error;
  }
};

// Helper functions for table data formatting
export const formatCurrency = (amount, currency = "USD") => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
  }).format(amount || 0);
};

export const formatNumber = (value) => {
  return Number(value || 0).toLocaleString();
};

export const formatPercentage = (value) => {
  return `${Number(value || 0).toFixed(2)}%`;
};

// Calculate total value for a single row (value * quantity or value * percentage)
export const calculateRowTotalValue = (row) => {
  const value = parseFloat(row.value) || 0;
  const quantity = parseFloat(row.quantity) || 1;
  const calculationType = row.calculationType || "quantity";

  if (calculationType === "percentage") {
    return (value * quantity) / 100; // percentage calculation
  }
  return value * quantity; // quantity calculation
};

// Validate table row data
export const validateTableRow = (row) => {
  const errors = [];

  if (!row.id || typeof row.id !== "string") {
    errors.push("Row ID is required and must be a string");
  }

  if (!row.label || typeof row.label !== "string") {
    errors.push("Row label is required and must be a string");
  }

  if (row.value !== undefined && (isNaN(row.value) || row.value === null)) {
    errors.push("Row value must be a valid number");
  }

  if (!row.category || typeof row.category !== "string") {
    errors.push("Row category is required and must be a string");
  }

  return errors;
};

// Calculate table totals
export const calculateTotals = (tableData) => {
  if (!Array.isArray(tableData)) {
    return { total: 0, positiveTotal: 0, negativeTotal: 0 };
  }

  const totals = tableData.reduce(
    (acc, row) => {
      const value = parseFloat(row.value) || 0;
      const quantity = parseFloat(row.quantity) || 1;
      const calculationType = row.calculationType || "quantity";

      let totalValue;
      if (calculationType === "percentage") {
        totalValue = (value * quantity) / 100; // percentage calculation
      } else {
        totalValue = value * quantity; // quantity calculation
      }

      acc.total += totalValue;

      if (totalValue > 0) {
        acc.positiveTotal += totalValue;
      } else if (totalValue < 0) {
        acc.negativeTotal += Math.abs(totalValue);
      }

      return acc;
    },
    { total: 0, positiveTotal: 0, negativeTotal: 0 }
  );

  return totals;
};

// Group table data by category
export const groupTableDataByCategory = (tableData) => {
  if (!Array.isArray(tableData)) {
    return {};
  }

  return tableData.reduce((acc, row) => {
    const category = row.category || "uncategorized";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(row);
    return acc;
  }, {});
};

// Sort table data by order
export const sortTableData = (tableData) => {
  if (!Array.isArray(tableData)) {
    return [];
  }

  return [...tableData].sort((a, b) => {
    const orderA = parseInt(a.order) || 0;
    const orderB = parseInt(b.order) || 0;
    return orderA - orderB;
  });
};

// Get default table structure
export const getDefaultTableStructure = () => {
  return [
    // FTD Section
    {
      id: "ftd_deposit_300",
      label: "FTDs (Deposit) avr $300",
      value: 0,
      quantity: 1,
      currency: "USD",
      category: "ftd",
      order: 1,
    },
    {
      id: "ftd_transaction_commission",
      label: "FTDs Transaction Commission",
      value: 0,
      quantity: 1,
      currency: "USD",
      category: "ftd",
      order: 2,
    },

    // Leads + Depositors Section
    {
      id: "au_leads_depositors",
      label: "AU leads + depositors – voip",
      value: 0,
      quantity: 1,
      currency: "USD",
      category: "leads",
      order: 3,
    },
    {
      id: "ca_leads_depositors",
      label: "CA leads + depositors – voip",
      value: 0,
      quantity: 1,
      currency: "USD",
      category: "leads",
      order: 4,
    },
    {
      id: "uk_leads_depositors",
      label: "UK leads + depositors – voip",
      value: 0,
      quantity: 1,
      currency: "USD",
      category: "leads",
      order: 5,
    },

    // SIM Cards Section
    {
      id: "se_sim_cards",
      label: "SE SIM cards",
      value: 0,
      quantity: 1,
      currency: "USD",
      category: "sim_cards",
      order: 6,
    },
    {
      id: "uk_sim_cards",
      label: "UK SIM cards",
      value: 0,
      quantity: 1,
      currency: "USD",
      category: "sim_cards",
      order: 7,
    },
    {
      id: "ca_sim_cards",
      label: "CA SIM cards",
      value: 0,
      quantity: 1,
      currency: "USD",
      category: "sim_cards",
      order: 8,
    },
    {
      id: "es_sim_cards",
      label: "ES SIM cards",
      value: 0,
      quantity: 1,
      currency: "USD",
      category: "sim_cards",
      order: 9,
    },

    // Data Traffic Section
    {
      id: "data_traffic_se",
      label: "Data traffic leads SE",
      value: 0,
      quantity: 1,
      currency: "USD",
      category: "data_traffic",
      order: 10,
    },
    {
      id: "data_traffic_uk",
      label: "Data traffic leads UK",
      value: 0,
      quantity: 1,
      currency: "USD",
      category: "data_traffic",
      order: 11,
    },
    {
      id: "data_traffic_ca",
      label: "Data traffic leads CA",
      value: 0,
      quantity: 1,
      currency: "USD",
      category: "data_traffic",
      order: 12,
    },
    {
      id: "data_traffic_es",
      label: "Data traffic leads ES",
      value: 0,
      quantity: 1,
      currency: "USD",
      category: "data_traffic",
      order: 13,
    },
    {
      id: "data_traffic_it",
      label: "Data traffic leads IT",
      value: 0,
      quantity: 1,
      currency: "USD",
      category: "data_traffic",
      order: 14,
    },

    // Call Activities Section
    {
      id: "total_talking_time",
      label: "Total talking time (hours)",
      value: 0,
      quantity: 1,
      currency: "USD",
      category: "calls",
      order: 15,
    },
    {
      id: "deposit_calls",
      label: "Deposit calls",
      value: 0,
      quantity: 1,
      currency: "USD",
      category: "calls",
      order: 16,
    },
    {
      id: "first_am_call",
      label: "1st AM call",
      value: 0,
      quantity: 1,
      currency: "USD",
      category: "calls",
      order: 17,
    },
    {
      id: "second_am_call",
      label: "2nd AM call",
      value: 0,
      quantity: 1,
      currency: "USD",
      category: "calls",
      order: 18,
    },
    {
      id: "third_am_call",
      label: "3rd AM call",
      value: 0,
      quantity: 1,
      currency: "USD",
      category: "calls",
      order: 19,
    },
    {
      id: "fourth_am_call",
      label: "4th AM call",
      value: 0,
      quantity: 1,
      currency: "USD",
      category: "calls",
      order: 20,
    },

    // Verification Section
    {
      id: "verified_ids",
      label: "Verified IDs",
      value: 0,
      quantity: 1,
      currency: "USD",
      category: "verification",
      order: 21,
    },
    {
      id: "proxies_injection",
      label: "Proxies per injection",
      value: 0,
      quantity: 1,
      currency: "USD",
      category: "verification",
      order: 22,
    },

    // Cards Section
    {
      id: "es_cards",
      label: "ES Cards",
      value: 0,
      quantity: 1,
      currency: "USD",
      category: "cards",
      order: 23,
    },
    {
      id: "ca_cards",
      label: "CA Cards",
      value: 0,
      quantity: 1,
      currency: "USD",
      category: "cards",
      order: 24,
    },
    {
      id: "jimmy_commission",
      label: "Jimmy's Commission per CA ftd",
      value: 0,
      quantity: 1,
      currency: "USD",
      category: "cards",
      order: 25,
    },
    {
      id: "cards_issued",
      label: "CARDS Issued",
      value: 0,
      quantity: 1,
      currency: "USD",
      category: "cards",
      order: 26,
    },

    // Services Section
    {
      id: "documents",
      label: "Documents",
      value: 0,
      quantity: 1,
      currency: "USD",
      category: "services",
      order: 27,
    },
    {
      id: "hosting_services",
      label: "Hosting services",
      value: 0,
      quantity: 1,
      currency: "USD",
      category: "services",
      order: 28,
    },
    {
      id: "office_percentage",
      label: "Office %",
      value: 0,
      quantity: 1,
      currency: "USD",
      category: "services",
      order: 29,
    },
    {
      id: "contract_salary",
      label: "Contract salary",
      value: 0,
      quantity: 1,
      currency: "USD",
      category: "services",
      order: 30,
    },
    {
      id: "insurances",
      label: "Insurances",
      value: 0,
      quantity: 1,
      currency: "USD",
      category: "services",
      order: 31,
    },
  ];
};

// Get category colors for UI display
export const getCategoryColor = (category) => {
  const colors = {
    ftd: "#4CAF50",
    leads: "#2196F3",
    sim_cards: "#FF9800",
    data_traffic: "#9C27B0",
    calls: "#00BCD4",
    verification: "#795548",
    cards: "#E91E63",
    services: "#607D8B",
    uncategorized: "#9E9E9E",
  };

  return colors[category] || colors.uncategorized;
};

// Get category display name
export const getCategoryDisplayName = (category) => {
  const displayNames = {
    ftd: "FTD",
    leads: "Leads & Depositors",
    sim_cards: "SIM Cards",
    data_traffic: "Data Traffic",
    calls: "Call Activities",
    verification: "Verification",
    cards: "Cards",
    services: "Services",
    uncategorized: "Other",
  };

  return displayNames[category] || displayNames.uncategorized;
};
