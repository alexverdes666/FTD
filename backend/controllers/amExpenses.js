const { validationResult } = require('express-validator');
const User = require('../models/User');
const AMFixedExpense = require('../models/AMFixedExpense');
const { calculateAMExpenses } = require('../services/amExpenseCalculationService');

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

    const results = [];

    for (const manager of managers) {
      const expenses = await calculateAMExpenses(manager._id, targetMonth, targetYear);

      // Get fixed expenses sum
      const fixedExpenses = await AMFixedExpense.find({
        affiliateManager: manager._id,
        month: targetMonth,
        year: targetYear,
        isActive: true,
      }).lean();

      const fixedTotal = fixedExpenses.reduce((sum, fe) => sum + fe.amount, 0);

      results.push({
        managerId: manager._id,
        managerName: manager.fullName,
        managerEmail: manager.email,
        autoExpenses: expenses.grandTotal,
        fixedExpenses: fixedTotal,
        totalExpenses: expenses.grandTotal + fixedTotal,
      });
    }

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
