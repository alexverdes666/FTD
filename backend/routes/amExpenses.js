const express = require('express');
const { query, param, body } = require('express-validator');
const router = express.Router();

const amExpensesController = require('../controllers/amExpenses');
const { protect, isAdmin } = require('../middleware/auth');

// Validation rules
const monthYearValidation = [
  query('month').isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
  query('year').isInt({ min: 2020, max: 2100 }).withMessage('Invalid year'),
];

const amIdValidation = [
  param('affiliateManagerId').isMongoId().withMessage('Valid affiliate manager ID is required'),
];

const fixedExpenseIdValidation = [
  param('id').isMongoId().withMessage('Valid expense ID is required'),
];

const addFixedExpenseValidation = [
  body('month').isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
  body('year').isInt({ min: 2020, max: 2100 }).withMessage('Invalid year'),
  body('label').isString().trim().notEmpty().withMessage('Label is required'),
  body('amount').isNumeric().withMessage('Amount must be numeric'),
  body('category').optional().isString().withMessage('Category must be a string'),
  body('notes').optional().isString().isLength({ max: 500 }).withMessage('Notes max 500 characters'),
];

const updateFixedExpenseValidation = [
  body('label').optional().isString().trim().notEmpty().withMessage('Label must be a non-empty string'),
  body('amount').optional().isNumeric().withMessage('Amount must be numeric'),
  body('category').optional().isString().withMessage('Category must be a string'),
  body('notes').optional().isString().isLength({ max: 500 }).withMessage('Notes max 500 characters'),
];

// Routes

// Get auto-calculated expenses for ALL AMs
router.get(
  '/calculate',
  protect,
  isAdmin,
  monthYearValidation,
  amExpensesController.getCalculatedExpenses
);

// Get detailed breakdown for one AM
router.get(
  '/calculate/:affiliateManagerId',
  protect,
  isAdmin,
  [...amIdValidation, ...monthYearValidation],
  amExpensesController.getCalculatedExpensesForAM
);

// Get fixed expenses for one AM
router.get(
  '/fixed/:affiliateManagerId',
  protect,
  isAdmin,
  [
    ...amIdValidation,
    query('month').optional().isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
    query('year').optional().isInt({ min: 2020, max: 2100 }).withMessage('Invalid year'),
  ],
  amExpensesController.getFixedExpenses
);

// Add fixed expense
router.post(
  '/fixed/:affiliateManagerId',
  protect,
  isAdmin,
  [...amIdValidation, ...addFixedExpenseValidation],
  amExpensesController.addFixedExpense
);

// Update fixed expense
router.put(
  '/fixed/:id',
  protect,
  isAdmin,
  [...fixedExpenseIdValidation, ...updateFixedExpenseValidation],
  amExpensesController.updateFixedExpense
);

// Soft-delete fixed expense
router.delete(
  '/fixed/:id',
  protect,
  isAdmin,
  fixedExpenseIdValidation,
  amExpensesController.deleteFixedExpense
);

// ==================== Global Fixed Expenses ====================

const globalFixedExpenseValidation = [
  body('label').isString().trim().notEmpty().withMessage('Label is required'),
  body('amount').isNumeric().withMessage('Amount must be numeric'),
  body('category').optional().isString().withMessage('Category must be a string'),
  body('notes').optional().isString().isLength({ max: 500 }).withMessage('Notes max 500 characters'),
];

const globalFixedExpenseUpdateValidation = [
  body('label').optional().isString().trim().notEmpty().withMessage('Label must be a non-empty string'),
  body('amount').optional().isNumeric().withMessage('Amount must be numeric'),
  body('category').optional().isString().withMessage('Category must be a string'),
  body('notes').optional().isString().isLength({ max: 500 }).withMessage('Notes max 500 characters'),
];

// Get all global fixed expenses
router.get(
  '/global-fixed',
  protect,
  isAdmin,
  amExpensesController.getGlobalFixedExpenses
);

// Add global fixed expense
router.post(
  '/global-fixed',
  protect,
  isAdmin,
  globalFixedExpenseValidation,
  amExpensesController.addGlobalFixedExpense
);

// Update global fixed expense
router.put(
  '/global-fixed/:id',
  protect,
  isAdmin,
  [param('id').isMongoId().withMessage('Valid expense ID is required'), ...globalFixedExpenseUpdateValidation],
  amExpensesController.updateGlobalFixedExpense
);

// Delete global fixed expense
router.delete(
  '/global-fixed/:id',
  protect,
  isAdmin,
  [param('id').isMongoId().withMessage('Valid expense ID is required')],
  amExpensesController.deleteGlobalFixedExpense
);

module.exports = router;
