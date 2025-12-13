const NetworkAuditLog = require("../models/NetworkAuditLog");

/**
 * Network Audit Service
 * Provides helper functions for logging network and wallet operations
 */
class NetworkAuditService {
  /**
   * Log a network audit event
   * @param {Object} options - Audit log options
   * @param {string} options.networkId - Network ID
   * @param {string} options.networkName - Network name
   * @param {string} options.userId - User ID who performed the action
   * @param {string} options.action - Action type
   * @param {string} options.category - Category of action
   * @param {string} options.description - Human-readable description
   * @param {string} [options.blockchain] - Blockchain type for wallet operations
   * @param {string} [options.walletAddress] - Wallet address for wallet operations
   * @param {*} [options.previousValue] - Previous value
   * @param {*} [options.newValue] - New value
   * @param {Object} [options.metadata] - Additional metadata
   * @param {Object} [options.req] - Express request object for IP/user agent
   */
  static async log(options) {
    try {
      const {
        networkId,
        networkName,
        userId,
        action,
        category,
        description,
        blockchain = null,
        walletAddress = null,
        previousValue = null,
        newValue = null,
        metadata = {},
        req = null,
      } = options;

      const auditLog = new NetworkAuditLog({
        network: networkId,
        networkName,
        performedBy: userId,
        action,
        category,
        description,
        blockchain,
        walletAddress,
        previousValue,
        newValue,
        metadata,
        ipAddress: req ? this.getClientIp(req) : null,
        userAgent: req ? req.headers["user-agent"] : null,
      });

      await auditLog.save();
      return auditLog;
    } catch (error) {
      console.error("Error creating network audit log:", error);
      // Don't throw - audit logging should not break main operations
      return null;
    }
  }

  /**
   * Get client IP address from request
   */
  static getClientIp(req) {
    return (
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.ip ||
      req.connection?.remoteAddress ||
      null
    );
  }

  /**
   * Log network creation
   */
  static async logNetworkCreated(network, user, req) {
    const walletSummary = this.getWalletSummary(network.cryptoWallets);

    await this.log({
      networkId: network._id,
      networkName: network.name,
      userId: user._id,
      action: "NETWORK_CREATED",
      category: "network",
      description: `Created network "${network.name}"${
        walletSummary ? ` with ${walletSummary}` : ""
      }`,
      newValue: {
        name: network.name,
        description: network.description,
        assignedAffiliateManager: network.assignedAffiliateManager,
        cryptoWallets: network.cryptoWallets,
      },
      metadata: {
        hasWallets: !!walletSummary,
      },
      req,
    });

    // Also log individual wallet additions if any
    await this.logWalletChanges(
      network,
      null,
      network.cryptoWallets,
      user,
      req
    );
  }

  /**
   * Log network deletion
   */
  static async logNetworkDeleted(network, user, req) {
    await this.log({
      networkId: network._id,
      networkName: network.name,
      userId: user._id,
      action: "NETWORK_DELETED",
      category: "network",
      description: `Deleted network "${network.name}"`,
      previousValue: {
        name: network.name,
        description: network.description,
        assignedAffiliateManager: network.assignedAffiliateManager,
        cryptoWallets: network.cryptoWallets,
        isActive: network.isActive,
      },
      req,
    });
  }

  /**
   * Log network update with detailed changes
   */
  static async logNetworkUpdated(network, previousData, newData, user, req) {
    const changes = [];

    // Check for name change
    if (newData.name !== undefined && newData.name !== previousData.name) {
      changes.push(`name from "${previousData.name}" to "${newData.name}"`);
    }

    // Check for description change
    if (
      newData.description !== undefined &&
      newData.description !== previousData.description
    ) {
      changes.push("description");
    }

    // Log general update if there are non-wallet changes
    if (changes.length > 0) {
      await this.log({
        networkId: network._id,
        networkName: network.name,
        userId: user._id,
        action: "NETWORK_UPDATED",
        category: "network",
        description: `Updated network "${network.name}": changed ${changes.join(
          ", "
        )}`,
        previousValue: {
          name: previousData.name,
          description: previousData.description,
        },
        newValue: {
          name: newData.name ?? previousData.name,
          description: newData.description ?? previousData.description,
        },
        req,
      });
    }

    // Log status changes separately
    if (
      newData.isActive !== undefined &&
      newData.isActive !== previousData.isActive
    ) {
      await this.logStatusChanged(
        network,
        previousData.isActive,
        newData.isActive,
        user,
        req
      );
    }

    // Log manager changes separately
    const prevManagerId =
      previousData.assignedAffiliateManager?.toString() || null;
    const newManagerId = newData.assignedAffiliateManager?.toString() || null;

    if (
      newData.assignedAffiliateManager !== undefined &&
      prevManagerId !== newManagerId
    ) {
      await this.logManagerChanged(
        network,
        prevManagerId,
        newManagerId,
        user,
        req
      );
    }

    // Log wallet changes
    if (newData.cryptoWallets !== undefined) {
      await this.logWalletChanges(
        network,
        previousData.cryptoWallets,
        newData.cryptoWallets,
        user,
        req
      );
    }
  }

  /**
   * Log status change
   */
  static async logStatusChanged(network, previousStatus, newStatus, user, req) {
    await this.log({
      networkId: network._id,
      networkName: network.name,
      userId: user._id,
      action: "STATUS_CHANGED",
      category: "status",
      description: `Changed network "${network.name}" status from ${
        previousStatus ? "Active" : "Inactive"
      } to ${newStatus ? "Active" : "Inactive"}`,
      previousValue: previousStatus,
      newValue: newStatus,
      req,
    });
  }

  /**
   * Log manager assignment/removal
   */
  static async logManagerChanged(
    network,
    previousManagerId,
    newManagerId,
    user,
    req
  ) {
    if (!previousManagerId && newManagerId) {
      await this.log({
        networkId: network._id,
        networkName: network.name,
        userId: user._id,
        action: "MANAGER_ASSIGNED",
        category: "manager",
        description: `Assigned affiliate manager to network "${network.name}"`,
        newValue: newManagerId,
        req,
      });
    } else if (previousManagerId && !newManagerId) {
      await this.log({
        networkId: network._id,
        networkName: network.name,
        userId: user._id,
        action: "MANAGER_REMOVED",
        category: "manager",
        description: `Removed affiliate manager from network "${network.name}"`,
        previousValue: previousManagerId,
        req,
      });
    } else if (previousManagerId !== newManagerId) {
      await this.log({
        networkId: network._id,
        networkName: network.name,
        userId: user._id,
        action: "MANAGER_ASSIGNED",
        category: "manager",
        description: `Changed affiliate manager for network "${network.name}"`,
        previousValue: previousManagerId,
        newValue: newManagerId,
        req,
      });
    }
  }

  /**
   * Log wallet changes (additions, removals, updates)
   */
  static async logWalletChanges(
    network,
    previousWallets,
    newWallets,
    user,
    req
  ) {
    const blockchains = ["ethereum", "bitcoin", "tron"];

    for (const blockchain of blockchains) {
      const prevAddresses = this.normalizeWalletArray(
        previousWallets?.[blockchain]
      );
      const newAddresses = this.normalizeWalletArray(newWallets?.[blockchain]);

      // Find added wallets
      const addedWallets = newAddresses.filter(
        (addr) => !prevAddresses.includes(addr)
      );
      for (const wallet of addedWallets) {
        await this.log({
          networkId: network._id,
          networkName: network.name,
          userId: user._id,
          action: "WALLET_ADDED",
          category: "wallet",
          description: `Added ${this.getBlockchainLabel(
            blockchain
          )} wallet to network "${network.name}": ${this.truncateAddress(
            wallet
          )}`,
          blockchain,
          walletAddress: wallet,
          newValue: wallet,
          req,
        });
      }

      // Find removed wallets
      const removedWallets = prevAddresses.filter(
        (addr) => !newAddresses.includes(addr)
      );
      for (const wallet of removedWallets) {
        await this.log({
          networkId: network._id,
          networkName: network.name,
          userId: user._id,
          action: "WALLET_REMOVED",
          category: "wallet",
          description: `Removed ${this.getBlockchainLabel(
            blockchain
          )} wallet from network "${network.name}": ${this.truncateAddress(
            wallet
          )}`,
          blockchain,
          walletAddress: wallet,
          previousValue: wallet,
          req,
        });
      }
    }
  }

  /**
   * Normalize wallet array (handle both array and single value)
   */
  static normalizeWalletArray(wallets) {
    if (!wallets) return [];
    if (Array.isArray(wallets)) {
      return wallets.filter((addr) => addr && addr.trim() !== "");
    }
    return wallets.trim() !== "" ? [wallets] : [];
  }

  /**
   * Get wallet summary for logging
   */
  static getWalletSummary(cryptoWallets) {
    if (!cryptoWallets) return null;

    const counts = [];
    const eth = this.normalizeWalletArray(cryptoWallets.ethereum);
    const btc = this.normalizeWalletArray(cryptoWallets.bitcoin);
    const trx = this.normalizeWalletArray(cryptoWallets.tron);

    if (eth.length)
      counts.push(`${eth.length} ETH wallet${eth.length > 1 ? "s" : ""}`);
    if (btc.length)
      counts.push(`${btc.length} BTC wallet${btc.length > 1 ? "s" : ""}`);
    if (trx.length)
      counts.push(`${trx.length} TRX wallet${trx.length > 1 ? "s" : ""}`);

    return counts.length > 0 ? counts.join(", ") : null;
  }

  /**
   * Get blockchain label
   */
  static getBlockchainLabel(blockchain) {
    const labels = {
      ethereum: "Ethereum (ETH)",
      bitcoin: "Bitcoin (BTC)",
      tron: "TRON (TRX)",
    };
    return labels[blockchain] || blockchain;
  }

  /**
   * Truncate wallet address for display
   */
  static truncateAddress(address) {
    if (!address || address.length < 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  /**
   * Get audit logs for a network with pagination
   */
  static async getNetworkLogs(networkId, options = {}) {
    const {
      page = 1,
      limit = 20,
      category = null,
      action = null,
      startDate = null,
      endDate = null,
    } = options;

    const filter = { network: networkId };

    if (category) filter.category = category;
    if (action) filter.action = action;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      NetworkAuditLog.find(filter)
        .populate("performedBy", "fullName email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      NetworkAuditLog.countDocuments(filter),
    ]);

    return {
      logs,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit,
      },
    };
  }

  /**
   * Get all audit logs with pagination
   */
  static async getAllLogs(options = {}) {
    const {
      page = 1,
      limit = 20,
      networkId = null,
      userId = null,
      category = null,
      action = null,
      blockchain = null,
      startDate = null,
      endDate = null,
      search = null,
    } = options;

    const filter = {};

    if (networkId) filter.network = networkId;
    if (userId) filter.performedBy = userId;
    if (category) filter.category = category;
    if (action) filter.action = action;
    if (blockchain) filter.blockchain = blockchain;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    if (search) {
      filter.$or = [
        { networkName: new RegExp(search, "i") },
        { description: new RegExp(search, "i") },
        { walletAddress: new RegExp(search, "i") },
      ];
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      NetworkAuditLog.find(filter)
        .populate("performedBy", "fullName email role")
        .populate("network", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      NetworkAuditLog.countDocuments(filter),
    ]);

    return {
      logs,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit,
      },
    };
  }
}

module.exports = NetworkAuditService;
