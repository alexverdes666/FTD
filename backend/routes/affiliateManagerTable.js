const express = require('express');
const { body, param, query } = require('express-validator');
const router = express.Router();

const affiliateManagerTableController = require('../controllers/affiliateManagerTable');
const { protect, isAdmin } = require('../middleware/auth');

// Validation rules
const tableDataValidation = [
  body('tableData').optional().isArray().withMessage('Table data must be an array'),
  body('tableData.*.id').isString().withMessage('Row ID must be a string'),
  body('tableData.*.label').isString().withMessage('Row label must be a string'),
  body('tableData.*.value').isNumeric().withMessage('Row value must be numeric'),
  body('tableData.*.quantity').optional().isNumeric().withMessage('Row quantity must be numeric'),
  body('tableData.*.calculationType').optional().isIn(['quantity', 'percentage']).withMessage('Row calculation type must be either quantity or percentage'),
  body('tableData.*.currency').optional().isString().withMessage('Currency must be a string'),
  body('tableData.*.category').isString().withMessage('Category must be a string'),
  body('period').optional().isIn(['daily', 'weekly', 'monthly', 'yearly']).withMessage('Invalid period'),
  body('date').optional().isISO8601().withMessage('Invalid date format'),
  body('notes').optional().isString().withMessage('Notes must be a string')
];

const rowValidation = [
  body('value').optional().isNumeric().withMessage('Value must be numeric'),
  body('quantity').optional().isNumeric().withMessage('Quantity must be numeric'),
  body('calculationType').optional().isIn(['quantity', 'percentage']).withMessage('Calculation type must be either quantity or percentage'),
  body('label').optional().isString().withMessage('Label must be a string'),
  body('currency').optional().isString().withMessage('Currency must be a string')
];

const addRowValidation = [
  body('id').isString().withMessage('Row ID is required and must be a string'),
  body('label').isString().withMessage('Label is required and must be a string'),
  body('value').optional().isNumeric().withMessage('Value must be numeric'),
  body('quantity').optional().isNumeric().withMessage('Quantity must be numeric'),
  body('calculationType').optional().isIn(['quantity', 'percentage']).withMessage('Calculation type must be either quantity or percentage'),
  body('currency').optional().isString().withMessage('Currency must be a string'),
  body('category').isString().withMessage('Category is required and must be a string'),
  body('order').optional().isInt({ min: 0 }).withMessage('Order must be a non-negative integer')
];

const paramValidation = [
  param('affiliateManagerId').isMongoId().withMessage('Valid affiliate manager ID is required'),
  param('rowId').optional().isString().withMessage('Row ID must be a string')
];

// Routes

// Get all affiliate manager tables (Admin only)
router.get('/all', 
  protect, 
  isAdmin, 
  [
    query('period').optional().isIn(['daily', 'weekly', 'monthly', 'yearly']).withMessage('Invalid period'),
    query('date').optional().isISO8601().withMessage('Invalid date format'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],
  affiliateManagerTableController.getAllAffiliateManagerTables
);

// Get table statistics (Admin only)
router.get('/statistics',
  protect,
  isAdmin,
  [
    query('period').optional().isIn(['daily', 'weekly', 'monthly', 'yearly']).withMessage('Invalid period')
  ],
  affiliateManagerTableController.getTableStatistics
);

// Get specific affiliate manager table
router.get('/:affiliateManagerId',
  protect,
  [
    ...paramValidation,
    query('period').optional().isIn(['daily', 'weekly', 'monthly', 'yearly']).withMessage('Invalid period'),
    query('date').optional().isISO8601().withMessage('Invalid date format')
  ],
  affiliateManagerTableController.getAffiliateManagerTable
);

// Update affiliate manager table
router.put('/:affiliateManagerId',
  protect,
  isAdmin,
  [
    ...paramValidation,
    ...tableDataValidation
  ],
  affiliateManagerTableController.updateAffiliateManagerTable
);

// Refresh total money from crypto wallet values for affiliate manager table
router.post('/:affiliateManagerId/refresh-crypto-total',
  protect,
  [
    ...paramValidation.slice(0, 1) // Only affiliate manager ID validation
  ],
  affiliateManagerTableController.refreshTotalMoneyFromCrypto
);

// Update single table row
router.put('/:affiliateManagerId/row/:rowId',
  protect,
  isAdmin,
  [
    ...paramValidation,
    ...rowValidation
  ],
  affiliateManagerTableController.updateTableRow
);

// Add new table row
router.post('/:affiliateManagerId/row',
  protect,
  isAdmin,
  [
    ...paramValidation.slice(0, 1), // Only affiliate manager ID validation
    ...addRowValidation
  ],
  affiliateManagerTableController.addTableRow
);

// Delete table row
router.delete('/:affiliateManagerId/row/:rowId',
  protect,
  isAdmin,
  paramValidation,
  affiliateManagerTableController.deleteTableRow
);

// Reset table to default structure
router.post('/:affiliateManagerId/reset',
  protect,
  isAdmin,
  paramValidation.slice(0, 1), // Only affiliate manager ID validation
  affiliateManagerTableController.resetTableToDefault
);

module.exports = router; 