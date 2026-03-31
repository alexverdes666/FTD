const { validationResult } = require('express-validator');
const User = require('../models/User');
const AMFixedExpense = require('../models/AMFixedExpense');
const GlobalFixedExpense = require('../models/GlobalFixedExpense');
const AMRateOverride = require('../models/AMRateOverride');
const { calculateAMExpenses } = require('../services/amExpenseCalculationService');

let BlockchainScraperService;
try {
  BlockchainScraperService = require('../services/blockchainScraperService');
} catch (error) {
  console.warn('BlockchainScraperService not available:', error.message);
}

// Global Net Agent: cumulative net starting from 26 Feb 2026 (tracked monthly)
const GLOBAL_NET_START = { month: 2, year: 2026 };

function getMonthRange(startMonth, startYear, endMonth, endYear) {
  const months = [];
  let m = startMonth;
  let y = startYear;
  while (y < endYear || (y === endYear && m <= endMonth)) {
    months.push({ month: m, year: y });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

// @desc    Get auto-calculated expenses for ALL AMs
// @route   GET /api/am-expenses/calculate
// @access  Admin
exports.getCalculatedExpenses = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { month, year } = req.query;
    const targetMonth = parseInt(month);
    const targetYear = parseInt(year);

    // Get all affiliate managers
    const managers = await User.find({
      role: 'affiliate_manager',
      isActive: true,
    })
      .select('_id fullName email')
      .lean();

    // Get global fixed expenses (apply to all AMs, all time)
    const globalFixedExpenses = await GlobalFixedExpense.find({ isActive: true }).lean();
    const globalFixedTotal = globalFixedExpenses.reduce((sum, fe) => sum + fe.amount, 0);

    // Check if we need to compute Global Net Agent (cumulative from Feb 2026)
    const computeGlobalNet = targetYear > GLOBAL_NET_START.year ||
      (targetYear === GLOBAL_NET_START.year && targetMonth >= GLOBAL_NET_START.month);
    const priorMonths = computeGlobalNet
      ? getMonthRange(GLOBAL_NET_START.month, GLOBAL_NET_START.year, targetMonth, targetYear)
          .filter(({ month: m, year: y }) => !(m === targetMonth && y === targetYear))
      : [];

    // Create blockchain service once for reuse
    let blockchainService = null;
    if (BlockchainScraperService) {
      try {
        blockchainService = new BlockchainScraperService();
      } catch (err) {
        console.warn('Failed to initialize BlockchainScraperService:', err.message);
      }
    }

    const results = await Promise.all(managers.map(async (manager) => {
      const [expenses, fixedExpenses] = await Promise.all([
        calculateAMExpenses(manager._id, targetMonth, targetYear),
        AMFixedExpense.find({
          affiliateManager: manager._id,
          month: targetMonth,
          year: targetYear,
          isActive: true,
        }).lean(),
      ]);

      const fixedTotal = fixedExpenses.reduce((sum, fe) => sum + fe.amount, 0);

      // Get total money in from blockchain
      let totalMoneyIn = 0;
      if (blockchainService) {
        try {
          const cryptoValues = await blockchainService.getAffiliateManagerTotalValue(manager._id, { month: targetMonth, year: targetYear });
          totalMoneyIn = cryptoValues.totalUsdValue || 0;
        } catch (err) {
          console.warn(`Failed to get crypto values for ${manager.fullName}:`, err.message);
        }
      }

      const currentNet = totalMoneyIn - (expenses.grandTotal + fixedTotal + globalFixedTotal);

      // Compute Global Net Agent (cumulative net from Feb 2026)
      let globalNetAgent = null;
      if (computeGlobalNet && priorMonths.length > 0) {
        const priorResults = await Promise.all(priorMonths.map(async ({ month: m, year: y }) => {
          const [priorExpenses, priorFixed] = await Promise.all([
            calculateAMExpenses(manager._id, m, y),
            AMFixedExpense.find({ affiliateManager: manager._id, month: m, year: y, isActive: true }).lean(),
          ]);
          const priorFixedTotal = priorFixed.reduce((sum, fe) => sum + fe.amount, 0);
          let priorMoneyIn = 0;
          if (blockchainService) {
            try {
              const cryptoValues = await blockchainService.getAffiliateManagerTotalValue(manager._id, { month: m, year: y });
              priorMoneyIn = cryptoValues.totalUsdValue || 0;
            } catch (err) {
              // silently skip failed crypto lookups for prior months
            }
          }
          return priorMoneyIn - (priorExpenses.grandTotal + priorFixedTotal + globalFixedTotal);
        }));
        globalNetAgent = currentNet + priorResults.reduce((sum, net) => sum + net, 0);
      } else if (computeGlobalNet) {
        globalNetAgent = currentNet;
      }

      return {
        managerId: manager._id,
        managerName: manager.fullName,
        managerEmail: manager.email,
        totalMoneyIn,
        autoExpenses: expenses.grandTotal,
        fixedExpenses: fixedTotal + globalFixedTotal,
        totalExpenses: expenses.grandTotal + fixedTotal + globalFixedTotal,
        globalNetAgent,
      };
    }));

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error calculating AM expenses:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get detailed expense breakdown for one AM
// @route   GET /api/am-expenses/calculate/:affiliateManagerId
// @access  Admin
exports.getCalculatedExpensesForAM = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { affiliateManagerId } = req.params;
    const { month, year } = req.query;
    const targetMonth = parseInt(month);
    const targetYear = parseInt(year);

    const manager = await User.findById(affiliateManagerId).select('_id fullName email').lean();
    if (!manager) {
      return res.status(404).json({ success: false, message: 'Affiliate manager not found' });
    }

    const expenses = await calculateAMExpenses(affiliateManagerId, targetMonth, targetYear);

    res.json({
      success: true,
      data: {
        managerId: manager._id,
        managerName: manager.fullName,
        managerEmail: manager.email,
        ...expenses,
      },
    });
  } catch (error) {
    console.error('Error calculating AM expenses:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get fixed expenses for one AM
// @route   GET /api/am-expenses/fixed/:affiliateManagerId
// @access  Admin
exports.getFixedExpenses = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { affiliateManagerId } = req.params;
    const { month, year } = req.query;

    const query = {
      affiliateManager: affiliateManagerId,
      isActive: true,
    };

    if (month) query.month = parseInt(month);
    if (year) query.year = parseInt(year);

    const fixedExpenses = await AMFixedExpense.find(query)
      .populate('createdBy', 'fullName')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: fixedExpenses });
  } catch (error) {
    console.error('Error fetching fixed expenses:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Add fixed expense for one AM
// @route   POST /api/am-expenses/fixed/:affiliateManagerId
// @access  Admin
exports.addFixedExpense = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { affiliateManagerId } = req.params;
    const { month, year, label, amount, category, notes } = req.body;

    const expense = await AMFixedExpense.create({
      affiliateManager: affiliateManagerId,
      month,
      year,
      label,
      amount,
      category: category || 'other',
      notes,
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, data: expense });
  } catch (error) {
    console.error('Error adding fixed expense:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update fixed expense
// @route   PUT /api/am-expenses/fixed/:id
// @access  Admin
exports.updateFixedExpense = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const { label, amount, category, notes } = req.body;

    const expense = await AMFixedExpense.findById(id);
    if (!expense || !expense.isActive) {
      return res.status(404).json({ success: false, message: 'Fixed expense not found' });
    }

    if (label !== undefined) expense.label = label;
    if (amount !== undefined) expense.amount = amount;
    if (category !== undefined) expense.category = category;
    if (notes !== undefined) expense.notes = notes;

    await expense.save();

    res.json({ success: true, data: expense });
  } catch (error) {
    console.error('Error updating fixed expense:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Soft-delete fixed expense
// @route   DELETE /api/am-expenses/fixed/:id
// @access  Admin
exports.deleteFixedExpense = async (req, res) => {
  try {
    const { id } = req.params;

    const expense = await AMFixedExpense.findById(id);
    if (!expense || !expense.isActive) {
      return res.status(404).json({ success: false, message: 'Fixed expense not found' });
    }

    expense.isActive = false;
    await expense.save();

    res.json({ success: true, message: 'Fixed expense deleted' });
  } catch (error) {
    console.error('Error deleting fixed expense:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ==================== Rate Overrides ====================

// @desc    Get global rate overrides for a given month/year
// @route   GET /api/am-expenses/rate-overrides
// @access  Admin
exports.getRateOverrides = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { month, year } = req.query;

    const doc = await AMRateOverride.findOne({
      month: parseInt(month),
      year: parseInt(year),
    }).lean();

    // Convert Map to plain object
    const overrides = doc ? Object.fromEntries(Object.entries(doc.overrides || {})) : {};

    res.json({ success: true, data: overrides });
  } catch (error) {
    console.error('Error fetching rate overrides:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Save global rate overrides for a given month/year (upsert)
// @route   PUT /api/am-expenses/rate-overrides
// @access  Admin
exports.saveRateOverrides = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { month, year, overrides } = req.body;

    const doc = await AMRateOverride.findOneAndUpdate(
      {
        month,
        year,
      },
      {
        overrides,
        updatedBy: req.user._id,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    res.json({ success: true, data: doc });
  } catch (error) {
    console.error('Error saving rate overrides:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ==================== Global Fixed Expenses ====================

// @desc    Get all global fixed expenses
// @route   GET /api/am-expenses/global-fixed
// @access  Admin
exports.getGlobalFixedExpenses = async (req, res) => {
  try {
    const expenses = await GlobalFixedExpense.find({ isActive: true })
      .populate('createdBy', 'fullName')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: expenses });
  } catch (error) {
    console.error('Error fetching global fixed expenses:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Add global fixed expense
// @route   POST /api/am-expenses/global-fixed
// @access  Admin
exports.addGlobalFixedExpense = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { label, amount, category, notes } = req.body;

    const expense = await GlobalFixedExpense.create({
      label,
      amount,
      category: category || 'other',
      notes,
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, data: expense });
  } catch (error) {
    console.error('Error adding global fixed expense:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update global fixed expense
// @route   PUT /api/am-expenses/global-fixed/:id
// @access  Admin
exports.updateGlobalFixedExpense = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const { label, amount, category, notes } = req.body;

    const expense = await GlobalFixedExpense.findById(id);
    if (!expense || !expense.isActive) {
      return res.status(404).json({ success: false, message: 'Global fixed expense not found' });
    }

    if (label !== undefined) expense.label = label;
    if (amount !== undefined) expense.amount = amount;
    if (category !== undefined) expense.category = category;
    if (notes !== undefined) expense.notes = notes;

    await expense.save();

    res.json({ success: true, data: expense });
  } catch (error) {
    console.error('Error updating global fixed expense:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Soft-delete global fixed expense
// @route   DELETE /api/am-expenses/global-fixed/:id
// @access  Admin
exports.deleteGlobalFixedExpense = async (req, res) => {
  try {
    const { id } = req.params;

    const expense = await GlobalFixedExpense.findById(id);
    if (!expense || !expense.isActive) {
      return res.status(404).json({ success: false, message: 'Global fixed expense not found' });
    }

    expense.isActive = false;
    await expense.save();

    res.json({ success: true, message: 'Global fixed expense deleted' });
  } catch (error) {
    console.error('Error deleting global fixed expense:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
