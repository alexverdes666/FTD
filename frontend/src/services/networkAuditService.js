import api from "./api";

/**
 * Network Audit Service
 * Provides methods for fetching network audit logs
 */
export const networkAuditService = {
  /**
   * Get audit logs for a specific network
   * @param {string} networkId - Network ID
   * @param {Object} filters - Filter options
   * @param {number} filters.page - Page number (default: 1)
   * @param {number} filters.limit - Results per page (default: 20)
   * @param {string} filters.category - Filter by category (network, wallet, manager, status)
   * @param {string} filters.action - Filter by action type
   * @param {string} filters.startDate - Filter from date
   * @param {string} filters.endDate - Filter to date
   */
  async getNetworkAuditLogs(networkId, filters = {}) {
    try {
      const params = new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          params.append(key, value);
        }
      });

      const response = await api.get(
        `/our-networks/${networkId}/audit-logs?${params.toString()}`
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching network audit logs:", error);
      throw error;
    }
  },

  /**
   * Get all audit logs (admin only)
   * @param {Object} filters - Filter options
   * @param {number} filters.page - Page number (default: 1)
   * @param {number} filters.limit - Results per page (default: 20)
   * @param {string} filters.networkId - Filter by network ID
   * @param {string} filters.userId - Filter by user ID
   * @param {string} filters.category - Filter by category (network, wallet, manager, status)
   * @param {string} filters.action - Filter by action type
   * @param {string} filters.blockchain - Filter by blockchain (ethereum, bitcoin, tron)
   * @param {string} filters.startDate - Filter from date
   * @param {string} filters.endDate - Filter to date
   * @param {string} filters.search - Search query
   */
  async getAllAuditLogs(filters = {}) {
    try {
      const params = new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          params.append(key, value);
        }
      });

      const response = await api.get(
        `/our-networks/audit-logs/all?${params.toString()}`
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching all audit logs:", error);
      throw error;
    }
  },

  /**
   * Get action label for display
   * @param {string} action - Action type
   */
  getActionLabel(action) {
    const actionLabels = {
      NETWORK_CREATED: "Network Created",
      NETWORK_UPDATED: "Network Updated",
      NETWORK_DELETED: "Network Deleted",
      WALLET_ADDED: "Wallet Added",
      WALLET_REMOVED: "Wallet Removed",
      WALLET_UPDATED: "Wallet Updated",
      MANAGER_ASSIGNED: "Manager Assigned",
      MANAGER_REMOVED: "Manager Removed",
      STATUS_CHANGED: "Status Changed",
    };
    return actionLabels[action] || action;
  },

  /**
   * Get category label for display
   * @param {string} category - Category type
   */
  getCategoryLabel(category) {
    const categoryLabels = {
      network: "Network",
      wallet: "Wallet",
      manager: "Manager",
      status: "Status",
    };
    return categoryLabels[category] || category;
  },

  /**
   * Get blockchain label for display
   * @param {string} blockchain - Blockchain type
   */
  getBlockchainLabel(blockchain) {
    const blockchainLabels = {
      ethereum: "Ethereum (ETH)",
      bitcoin: "Bitcoin (BTC)",
      tron: "TRON (TRX)",
    };
    return blockchain ? blockchainLabels[blockchain] : null;
  },

  /**
   * Get action color for display
   * @param {string} action - Action type
   */
  getActionColor(action) {
    const actionColors = {
      NETWORK_CREATED: "success",
      NETWORK_UPDATED: "info",
      NETWORK_DELETED: "error",
      WALLET_ADDED: "success",
      WALLET_REMOVED: "error",
      WALLET_UPDATED: "warning",
      MANAGER_ASSIGNED: "primary",
      MANAGER_REMOVED: "warning",
      STATUS_CHANGED: "info",
    };
    return actionColors[action] || "default";
  },

  /**
   * Get category color for display
   * @param {string} category - Category type
   */
  getCategoryColor(category) {
    const categoryColors = {
      network: "primary",
      wallet: "secondary",
      manager: "info",
      status: "warning",
    };
    return categoryColors[category] || "default";
  },

  /**
   * Get blockchain color for display
   * @param {string} blockchain - Blockchain type
   */
  getBlockchainColor(blockchain) {
    const blockchainColors = {
      ethereum: "#627EEA",
      bitcoin: "#F7931A",
      tron: "#FF0013",
    };
    return blockchain ? blockchainColors[blockchain] : null;
  },

  /**
   * Format wallet address for display
   * @param {string} address - Wallet address
   */
  formatAddress(address) {
    if (!address || address.length < 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  },

  /**
   * Get action icon name
   * @param {string} action - Action type
   */
  getActionIcon(action) {
    const actionIcons = {
      NETWORK_CREATED: "add_circle",
      NETWORK_UPDATED: "edit",
      NETWORK_DELETED: "delete",
      WALLET_ADDED: "account_balance_wallet",
      WALLET_REMOVED: "remove_circle",
      WALLET_UPDATED: "update",
      MANAGER_ASSIGNED: "person_add",
      MANAGER_REMOVED: "person_remove",
      STATUS_CHANGED: "toggle_on",
    };
    return actionIcons[action] || "info";
  },
};

export default networkAuditService;
