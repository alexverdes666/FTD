const { validationResult } = require("express-validator");
const AffiliateManagerTable = require("../models/AffiliateManagerTable");
const AgentCallDeclaration = require("../models/AgentCallDeclaration");
const AMFixedExpense = require("../models/AMFixedExpense");
const User = require("../models/User");
const Order = require("../models/Order");
const Lead = require("../models/Lead");
const { calculateAMExpenses } = require("../services/amExpenseCalculationService");

// Get affiliate manager table data
exports.getAffiliateManagerTable = async (req, res, next) => {
  try {
    const { affiliateManagerId } = req.params;
    const { period = "monthly", date, month, year } = req.query;

    // Validate affiliate manager exists
    const affiliateManager = await User.findById(affiliateManagerId);
    if (!affiliateManager || affiliateManager.role !== "affiliate_manager") {
      return res.status(404).json({
        success: false,
        message: "Affiliate manager not found",
      });
    }

    // Check permissions
    if (
      req.user.role !== "admin" &&
      req.user._id.toString() !== affiliateManagerId
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    let tableDate = date ? new Date(date) : new Date();

    // If month and year are provided, use them to create the date
    if (month && year) {
      tableDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    }

    const table = await AffiliateManagerTable.getOrCreateTable(
      affiliateManagerId,
      period,
      tableDate,
      { month, year }
    );

    res.status(200).json({
      success: true,
      data: table,
    });
  } catch (error) {
    next(error);
  }
};

// Get all affiliate manager tables (Admin only)
exports.getAllAffiliateManagerTables = async (req, res, next) => {
  try {
    const { period = "monthly", date, page = 1, limit = 10, month, year } = req.query;

    // Get all affiliate managers first
    const affiliateManagers = await User.find({
      role: "affiliate_manager",
      isActive: true,
      status: "approved",
    });

    if (affiliateManagers.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        pagination: {
          currentPage: parseInt(page),
          totalPages: 0,
          totalItems: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });
    }

    let targetDate = date ? new Date(date) : new Date();
    
    // If month and year are provided, use them to create the date
    if (month && year) {
      targetDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    }

    // Prepare options for getOrCreateTable to enable proper date filtering
    const options = {};
    if (month && year) {
      options.month = parseInt(month);
      options.year = parseInt(year);
    }

    const tables = [];

    // Get or create table for each affiliate manager
    for (const manager of affiliateManagers) {
      try {
        const table = await AffiliateManagerTable.getOrCreateTable(
          manager._id,
          period,
          targetDate,
          options
        );
        // Manually populate the affiliateManager field
        table.affiliateManager = {
          _id: manager._id,
          fullName: manager.fullName,
          email: manager.email,
        };
        tables.push(table);
      } catch (error) {
        console.error(
          `Error creating table for manager ${manager.fullName}:`,
          error
        );
        // Continue with other managers even if one fails
      }
    }

    // Sort tables by date (newest first)
    tables.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Apply pagination
    const skip = (page - 1) * limit;
    const paginatedTables = tables.slice(skip, skip + limit);

    res.status(200).json({
      success: true,
      data: paginatedTables,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(tables.length / limit),
        totalItems: tables.length,
        hasNextPage: page * limit < tables.length,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Update affiliate manager table data
exports.updateAffiliateManagerTable = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const { affiliateManagerId } = req.params;
    const { tableData, period = "monthly", date, notes } = req.body;

    // Validate affiliate manager exists
    const affiliateManager = await User.findById(affiliateManagerId);
    if (!affiliateManager || affiliateManager.role !== "affiliate_manager") {
      return res.status(404).json({
        success: false,
        message: "Affiliate manager not found",
      });
    }

    // Check permissions
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can update affiliate manager table data",
      });
    }

    const tableDate = date ? new Date(date) : new Date();
    let table = await AffiliateManagerTable.getOrCreateTable(
      affiliateManagerId,
      period,
      tableDate
    );

    // Update table data
    if (tableData) {
      // Validate table data structure
      const validatedTableData = tableData.map((row) => ({
        id: row.id,
        label: row.label,
        value: parseFloat(row.value) || 0,
        quantity: parseFloat(row.quantity) || 1,
        calculationType: row.calculationType || "quantity",
        currency: row.currency || "USD",
        category: row.category,
        isEditable: row.isEditable !== false,
        isCalculated: row.isCalculated || false,
        formula: row.formula || null,
        order: row.order || 0,
      }));

      table.tableData = validatedTableData;
    }

    if (notes !== undefined) {
      table.notes = notes;
    }

    table.lastUpdatedBy = req.user._id;

    await table.save();
    await table.populate("affiliateManager", "fullName email");
    await table.populate("lastUpdatedBy", "fullName email");

    res.status(200).json({
      success: true,
      message: "Affiliate manager table updated successfully",
      data: table,
    });
  } catch (error) {
    next(error);
  }
};

// Update single table row
exports.updateTableRow = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const { affiliateManagerId, rowId } = req.params;
    const { value, label, currency, quantity, calculationType } = req.body;

    // Validate affiliate manager exists
    const affiliateManager = await User.findById(affiliateManagerId);
    if (!affiliateManager || affiliateManager.role !== "affiliate_manager") {
      return res.status(404).json({
        success: false,
        message: "Affiliate manager not found",
      });
    }

    // Check permissions
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can update affiliate manager table data",
      });
    }

    const table = await AffiliateManagerTable.getOrCreateTable(
      affiliateManagerId
    );

    // Find and update the specific row
    const rowIndex = table.tableData.findIndex((row) => row.id === rowId);
    if (rowIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Table row not found",
      });
    }

    // Check if row is editable
    if (!table.tableData[rowIndex].isEditable) {
      return res.status(400).json({
        success: false,
        message: "This row is not editable",
      });
    }

    // Update the row
    if (value !== undefined) {
      table.tableData[rowIndex].value = parseFloat(value) || 0;
    }
    if (quantity !== undefined) {
      table.tableData[rowIndex].quantity = parseFloat(quantity) || 1;
    }
    if (calculationType !== undefined) {
      table.tableData[rowIndex].calculationType = calculationType;
    }
    if (label !== undefined) {
      table.tableData[rowIndex].label = label;
    }
    if (currency !== undefined) {
      table.tableData[rowIndex].currency = currency;
    }

    table.lastUpdatedBy = req.user._id;

    await table.save();
    await table.populate("affiliateManager", "fullName email");
    await table.populate("lastUpdatedBy", "fullName email");

    res.status(200).json({
      success: true,
      message: "Table row updated successfully",
      data: table,
    });
  } catch (error) {
    next(error);
  }
};

// Refresh total money from crypto wallet values for affiliate manager table
exports.refreshTotalMoneyFromCrypto = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const { affiliateManagerId } = req.params;
    const { period = "monthly", date, month, year } = req.query;

    // Validate affiliate manager exists
    const affiliateManager = await User.findById(affiliateManagerId);
    if (!affiliateManager || affiliateManager.role !== "affiliate_manager") {
      return res.status(404).json({
        success: false,
        message: "Affiliate manager not found",
      });
    }

    // Check permissions
    if (
      req.user.role !== "admin" &&
      req.user._id.toString() !== affiliateManagerId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Only admins or the affiliate manager themselves can refresh total money",
      });
    }

    let tableDate = date ? new Date(date) : new Date();

    // If month and year are provided, use them to create the date
    if (month && year) {
      tableDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    }

    // Pass month/year options to getOrCreateTable for proper date filtering
    const options = {};
    if (month && year) {
      options.month = parseInt(month);
      options.year = parseInt(year);
    }

    const table = await AffiliateManagerTable.getOrCreateTable(
      affiliateManagerId,
      period,
      tableDate,
      options
    );

    // Refresh total money from crypto wallet values with month/year filtering
    const oldTotalMoney = table.totalMoney;
    await table.updateTotalMoneyFromCrypto(options);
    table.lastUpdatedBy = req.user._id;

    await table.save();
    await table.populate("affiliateManager", "fullName email");
    await table.populate("lastUpdatedBy", "fullName email");

    res.status(200).json({
      success: true,
      message: `Total money refreshed from crypto wallet values. Updated from $${oldTotalMoney.toFixed(
        2
      )} to $${table.totalMoney.toFixed(2)}`,
      data: table,
      cryptoSummary: {
        oldValue: oldTotalMoney,
        newValue: table.totalMoney,
        difference: table.totalMoney - oldTotalMoney,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Add new table row (globally to all affiliate managers)
exports.addTableRow = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const { affiliateManagerId } = req.params;
    const {
      id,
      label,
      value = 0,
      quantity = 1,
      calculationType = "quantity",
      currency = "USD",
      category,
      order = 0,
    } = req.body;

    // Validate affiliate manager exists
    const affiliateManager = await User.findById(affiliateManagerId);
    if (!affiliateManager || affiliateManager.role !== "affiliate_manager") {
      return res.status(404).json({
        success: false,
        message: "Affiliate manager not found",
      });
    }

    // Check permissions
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can add table rows",
      });
    }

    // Get all affiliate managers
    const allAffiliateManagers = await User.find({
      role: "affiliate_manager",
      isActive: true,
      status: "approved",
    });

    if (allAffiliateManagers.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No affiliate managers found",
      });
    }

    // Check if row with same ID already exists in the first table (to avoid duplicates)
    const firstTable = await AffiliateManagerTable.getOrCreateTable(
      affiliateManagerId
    );
    const existingRow = firstTable.tableData.find((row) => row.id === id);
    if (existingRow) {
      return res.status(400).json({
        success: false,
        message: "Row with this ID already exists",
      });
    }

    // Create new row object
    const newRow = {
      id,
      label,
      value: parseFloat(value) || 0,
      quantity: parseFloat(quantity) || 1,
      calculationType: calculationType || "quantity",
      currency,
      category,
      order: parseInt(order) || 0,
      isEditable: true,
      isCalculated: false,
    };

    // Add the row to all affiliate manager tables
    const updatedTables = [];

    for (const manager of allAffiliateManagers) {
      try {
        const table = await AffiliateManagerTable.getOrCreateTable(manager._id);

        // Check if row already exists in this table
        const existingRowInTable = table.tableData.find((row) => row.id === id);
        if (!existingRowInTable) {
          table.tableData.push(newRow);
          table.tableData.sort((a, b) => a.order - b.order);
          table.lastUpdatedBy = req.user._id;

          await table.save();
          await table.populate("affiliateManager", "fullName email");
          await table.populate("lastUpdatedBy", "fullName email");

          updatedTables.push(table);
        }
      } catch (error) {
        console.error(
          `Error adding row to table for manager ${manager.fullName}:`,
          error
        );
        errors.push(
          `Failed to add row to ${manager.fullName}: ${error.message}`
        );
      }
    }

    // Get the updated table for the original affiliate manager
    const originalTable = updatedTables.find(
      (table) => table.affiliateManager._id.toString() === affiliateManagerId
    );

    if (updatedTables.length === 0) {
      return res.status(500).json({
        success: false,
        message: "Failed to add row to any affiliate manager tables",
        errors,
      });
    }

    const successMessage =
      updatedTables.length === allAffiliateManagers.length
        ? `Table row added successfully to all ${updatedTables.length} affiliate managers`
        : `Table row added to ${updatedTables.length}/${allAffiliateManagers.length} affiliate managers`;

    res.status(201).json({
      success: true,
      message: successMessage,
      data: originalTable || updatedTables[0],
      globalUpdate: {
        totalAffiliateManagers: allAffiliateManagers.length,
        updatedTables: updatedTables.length,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Delete table row
exports.deleteTableRow = async (req, res, next) => {
  try {
    const { affiliateManagerId, rowId } = req.params;

    // Validate affiliate manager exists
    const affiliateManager = await User.findById(affiliateManagerId);
    if (!affiliateManager || affiliateManager.role !== "affiliate_manager") {
      return res.status(404).json({
        success: false,
        message: "Affiliate manager not found",
      });
    }

    // Check permissions
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can delete table rows",
      });
    }

    const table = await AffiliateManagerTable.getOrCreateTable(
      affiliateManagerId
    );

    // Find and remove the specific row
    const rowIndex = table.tableData.findIndex((row) => row.id === rowId);
    if (rowIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Table row not found",
      });
    }

    table.tableData.splice(rowIndex, 1);
    table.lastUpdatedBy = req.user._id;

    await table.save();
    await table.populate("affiliateManager", "fullName email");
    await table.populate("lastUpdatedBy", "fullName email");

    res.status(200).json({
      success: true,
      message: "Table row deleted successfully",
      data: table,
    });
  } catch (error) {
    next(error);
  }
};

// Reset table to default structure
exports.resetTableToDefault = async (req, res, next) => {
  try {
    const { affiliateManagerId } = req.params;

    // Validate affiliate manager exists
    const affiliateManager = await User.findById(affiliateManagerId);
    if (!affiliateManager || affiliateManager.role !== "affiliate_manager") {
      return res.status(404).json({
        success: false,
        message: "Affiliate manager not found",
      });
    }

    // Check permissions
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can reset table structure",
      });
    }

    const table = await AffiliateManagerTable.getOrCreateTable(
      affiliateManagerId
    );

    // Reset to default structure
    table.tableData = AffiliateManagerTable.getDefaultTableStructure();
    table.lastUpdatedBy = req.user._id;

    await table.save();
    await table.populate("affiliateManager", "fullName email");
    await table.populate("lastUpdatedBy", "fullName email");

    res.status(200).json({
      success: true,
      message: "Table reset to default structure successfully",
      data: table,
    });
  } catch (error) {
    next(error);
  }
};

// Get table statistics
exports.getTableStatistics = async (req, res, next) => {
  try {
    const { period = "monthly" } = req.query;

    // Get all affiliate managers first
    const affiliateManagers = await User.find({
      role: "affiliate_manager",
      isActive: true,
      status: "approved",
    });

    if (affiliateManagers.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          overview: {
            totalTables: 0,
            totalProfit: 0,
            totalHyperNet: 0,
            averageProfit: 0,
            averageHyperNet: 0,
          },
          byAffiliateManager: [],
        },
      });
    }

    const targetDate = new Date();
    const tables = [];
    const affiliateManagerStats = [];

    // Get or create table for each affiliate manager
    for (const manager of affiliateManagers) {
      try {
        const table = await AffiliateManagerTable.getOrCreateTable(
          manager._id,
          period,
          targetDate
        );
        tables.push(table);

        // Add to affiliate manager stats
        affiliateManagerStats.push({
          _id: manager._id,
          fullName: manager.fullName,
          email: manager.email,
          totalProfit: table.calculatedTotals.profit || 0,
          totalHyperNet: table.calculatedTotals.hyperNet || 0,
          tableCount: 1,
        });
      } catch (error) {
        console.error(
          `Error getting table for manager ${manager.fullName}:`,
          error
        );
        // Add zero stats for failed managers
        affiliateManagerStats.push({
          _id: manager._id,
          fullName: manager.fullName,
          email: manager.email,
          totalProfit: 0,
          totalHyperNet: 0,
          tableCount: 0,
        });
      }
    }

    // Calculate overall statistics
    const totalTables = tables.length;
    const totalProfit = tables.reduce(
      (sum, table) => sum + (table.calculatedTotals.profit || 0),
      0
    );
    const totalHyperNet = tables.reduce(
      (sum, table) => sum + (table.calculatedTotals.hyperNet || 0),
      0
    );
    const averageProfit = totalTables > 0 ? totalProfit / totalTables : 0;
    const averageHyperNet = totalTables > 0 ? totalHyperNet / totalTables : 0;

    // Sort affiliate managers by profit (descending)
    affiliateManagerStats.sort((a, b) => b.totalProfit - a.totalProfit);

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalTables,
          totalProfit,
          totalHyperNet,
          averageProfit,
          averageHyperNet,
        },
        byAffiliateManager: affiliateManagerStats,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get summary statistics for affiliate managers (FTDs, Shaved, Fillers)
exports.getAffiliateManagerSummary = async (req, res, next) => {
  try {
    const { month, year } = req.query;

    // Check if we're fetching all-time data (no month/year provided)
    const isAllTime = !month && !year;

    // Parse month and year if provided
    const targetMonth = month ? parseInt(month) : null;
    const targetYear = year ? parseInt(year) : null;

    // Calculate date range for the selected month (only if not all-time)
    let startDate = null;
    let endDate = null;
    if (!isAllTime && targetMonth && targetYear) {
      startDate = new Date(targetYear, targetMonth - 1, 1);
      endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);
    }

    // Get all active affiliate managers
    const affiliateManagers = await User.find({
      role: "affiliate_manager",
      isActive: true,
      status: "approved",
    }).select("_id fullName email");

    if (affiliateManagers.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }

    // Import BlockchainScraperService to get network totals
    let BlockchainScraperService;
    try {
      BlockchainScraperService = require('../services/blockchainScraperService');
    } catch (error) {
      console.warn('BlockchainScraperService not available:', error.message);
    }

    const summaryData = [];

    for (const manager of affiliateManagers) {
      // Get all orders created by this affiliate manager (with date filter if not all-time)
      const orderQuery = { requester: manager._id };
      if (!isAllTime && startDate && endDate) {
        orderQuery.createdAt = { $gte: startDate, $lte: endDate };
      }
      const orders = await Order.find(orderQuery).select("leads leadsMetadata");

      // Count FTDs, Fillers, and Shaved FTDs from orders
      // Shaved status is tracked per-order in leadsMetadata, not on the Lead model
      let totalFTDs = 0;
      let totalFillers = 0;
      let shavedFTDs = 0;

      for (const order of orders) {
        if (order.leadsMetadata && order.leadsMetadata.length > 0) {
          for (const metadata of order.leadsMetadata) {
            if (metadata.orderedAs === "ftd") {
              totalFTDs++;
              // Check if this FTD is marked as shaved in this order
              if (metadata.shaved === true) {
                shavedFTDs++;
              }
            } else if (metadata.orderedAs === "filler") {
              totalFillers++;
            }
          }
        }
      }

      // Get total money in from the network assigned to this affiliate manager
      let totalMoneyIn = 0;
      if (BlockchainScraperService) {
        try {
          const service = new BlockchainScraperService();
          // Pass month/year only if not fetching all-time data
          const cryptoOptions = isAllTime ? {} : { month: targetMonth, year: targetYear };
          const cryptoValues = await service.getAffiliateManagerTotalValue(manager._id, cryptoOptions);
          totalMoneyIn = cryptoValues.totalUsdValue || 0;
        } catch (error) {
          console.warn(`Failed to get crypto values for manager ${manager.fullName}:`, error.message);
        }
      }

      // Get auto-calculated expenses from order data + fixed expenses
      let totalMoneyExpenses = 0;
      if (!isAllTime && targetMonth && targetYear) {
        try {
          const autoExpenses = await calculateAMExpenses(manager._id, targetMonth, targetYear);
          const fixedExpenses = await AMFixedExpense.find({
            affiliateManager: manager._id,
            month: targetMonth,
            year: targetYear,
            isActive: true,
          }).lean();
          const fixedTotal = fixedExpenses.reduce((sum, fe) => sum + fe.amount, 0);
          totalMoneyExpenses = autoExpenses.grandTotal + fixedTotal;
        } catch (error) {
          console.warn(`Failed to calculate expenses for manager ${manager.fullName}:`, error.message);
        }
      }

      // Get call counts from approved declarations
      const callCountQuery = {
        affiliateManager: manager._id,
        status: 'approved',
        isActive: true
      };

      if (!isAllTime && targetMonth && targetYear) {
        callCountQuery.declarationMonth = targetMonth;
        callCountQuery.declarationYear = targetYear;
      }

      const callCounts = await AgentCallDeclaration.aggregate([
        { $match: callCountQuery },
        { $group: { _id: '$callType', count: { $sum: 1 } } }
      ]);

      let firstCalls = 0, secondCalls = 0, thirdCalls = 0, fourthCalls = 0;
      for (const cc of callCounts) {
        switch (cc._id) {
          case 'first_call': firstCalls = cc.count; break;
          case 'second_call': secondCalls = cc.count; break;
          case 'third_call': thirdCalls = cc.count; break;
          case 'fourth_call': fourthCalls = cc.count; break;
        }
      }

      summaryData.push({
        managerId: manager._id,
        managerName: manager.fullName,
        managerEmail: manager.email,
        totalFTDs,
        shavedFTDs,
        totalFillers,
        totalVerifiedFTDs: totalFTDs - shavedFTDs,
        totalMoneyIn,
        totalMoneyExpenses,
        totalCommissionsAM: 0,
        firstCalls,
        secondCalls,
        thirdCalls,
        fourthCalls,
        fifthCalls: 0,
        totalSimCardUsed: 0,
        totalDataUsed: 0,
        otherFixedExpenses: 0,
      });
    }

    res.status(200).json({
      success: true,
      data: summaryData,
      period: {
        isAllTime,
        month: targetMonth,
        year: targetYear,
        startDate,
        endDate,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get per-network audit data for a specific affiliate manager
exports.getAffiliateManagerNetworkAudit = async (req, res, next) => {
  try {
    const { affiliateManagerId } = req.params;
    const { month, year } = req.query;

    // Validate affiliate manager exists
    const affiliateManager = await User.findById(affiliateManagerId);
    if (!affiliateManager || affiliateManager.role !== 'affiliate_manager') {
      return res.status(404).json({
        success: false,
        message: 'Affiliate manager not found',
      });
    }

    const isAllTime = !month && !year;
    const targetMonth = month ? parseInt(month) : null;
    const targetYear = year ? parseInt(year) : null;

    // Calculate date range
    let startDate = null;
    let endDate = null;
    if (!isAllTime && targetMonth && targetYear) {
      startDate = new Date(targetYear, targetMonth - 1, 1);
      endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);
    }

    // Get all networks assigned to this affiliate manager
    const OurNetwork = require('../models/OurNetwork');
    const networks = await OurNetwork.find({
      assignedAffiliateManager: affiliateManagerId,
      isActive: true,
    }).select('_id name description isActive isArchived cryptoWallets createdAt');

    // Import BlockchainScraperService
    let BlockchainScraperService;
    try {
      BlockchainScraperService = require('../services/blockchainScraperService');
    } catch (error) {
      console.warn('BlockchainScraperService not available:', error.message);
    }

    const networkAuditData = [];

    for (const network of networks) {
      // Query orders for this AM + this specific network
      const orderQuery = {
        requester: affiliateManagerId,
        selectedOurNetwork: network._id,
      };
      if (!isAllTime && startDate && endDate) {
        orderQuery.createdAt = { $gte: startDate, $lte: endDate };
      }
      const orders = await Order.find(orderQuery).select('leads leadsMetadata');

      // Count FTDs, fillers, shaved from leadsMetadata
      let totalFTDs = 0;
      let totalFillers = 0;
      let shavedFTDs = 0;

      for (const order of orders) {
        if (order.leadsMetadata && order.leadsMetadata.length > 0) {
          for (const metadata of order.leadsMetadata) {
            if (metadata.orderedAs === 'ftd') {
              totalFTDs++;
              if (metadata.shaved === true) {
                shavedFTDs++;
              }
            } else if (metadata.orderedAs === 'filler') {
              totalFillers++;
            }
          }
        }
      }

      // Get crypto data for this specific network
      let cryptoData = { totalUsdValue: 0, totalTransactions: 0, breakdown: {} };
      if (BlockchainScraperService) {
        try {
          const service = new BlockchainScraperService();
          const networkSummary = await service.getNetworkSummary(
            network._id,
            0,
            isAllTime ? null : targetMonth,
            isAllTime ? null : targetYear
          );
          cryptoData = {
            totalUsdValue: networkSummary.totalUsdValue || 0,
            totalTransactions: networkSummary.totalTransactions || 0,
            breakdown: {
              bitcoin: {
                count: networkSummary.breakdown?.bitcoin?.total?.count || 0,
                totalUsdValue: networkSummary.breakdown?.bitcoin?.total?.totalUsdValue || 0,
              },
              ethereum: {
                count: networkSummary.breakdown?.ethereum?.total?.count || 0,
                totalUsdValue: networkSummary.breakdown?.ethereum?.total?.totalUsdValue || 0,
              },
              tron: {
                count: networkSummary.breakdown?.tron?.total?.count || 0,
                totalUsdValue: networkSummary.breakdown?.tron?.total?.totalUsdValue || 0,
              },
            },
          };
        } catch (err) {
          console.warn(`Failed to get crypto data for network ${network.name}:`, err.message);
        }
      }

      networkAuditData.push({
        networkId: network._id,
        networkName: network.name,
        networkDescription: network.description || '',
        isActive: network.isActive,
        isArchived: network.isArchived,
        createdAt: network.createdAt,
        totalOrders: orders.length,
        totalFTDs,
        shavedFTDs,
        totalVerifiedFTDs: totalFTDs - shavedFTDs,
        totalFillers,
        totalMoneyIn: cryptoData.totalUsdValue,
        totalTransactions: cryptoData.totalTransactions,
        cryptoBreakdown: cryptoData.breakdown,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        affiliateManager: {
          _id: affiliateManager._id,
          fullName: affiliateManager.fullName,
          email: affiliateManager.email,
        },
        networks: networkAuditData,
        totalNetworks: networks.length,
      },
      period: {
        isAllTime,
        month: targetMonth,
        year: targetYear,
      },
    });
  } catch (error) {
    next(error);
  }
};
