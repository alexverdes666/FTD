const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const salaryConfigurationController = require('../controllers/salaryConfiguration');
const { protect, isAdmin } = require('../middleware/auth');

// Validation rules
const salaryConfigurationValidation = [
  body('userId').isMongoId().withMessage('Valid user ID is required'),
  body('salaryType').isIn(['fixed_monthly']).withMessage('Valid salary type is required'),
  
  // Fixed salary validation - only when salaryType is 'fixed_monthly'
  body('fixedSalary.amount').if(body('salaryType').equals('fixed_monthly')).notEmpty().isNumeric().withMessage('Fixed salary amount is required and must be numeric'),
  body('fixedSalary.currency').if(body('salaryType').equals('fixed_monthly')).optional().isString().withMessage('Currency must be a string'),
  body('fixedSalary.paymentFrequency').if(body('salaryType').equals('fixed_monthly')).optional().isIn(['weekly', 'bi_weekly', 'monthly']).withMessage('Valid payment frequency is required'),
  
  body('notes').optional().isString().withMessage('Notes must be a string')
];

// Routes

// Get all salary configurations (Admin only)
router.get('/', protect, isAdmin, salaryConfigurationController.getAllSalaryConfigurations);

// Get users with salary configurations
router.get('/users', protect, isAdmin, salaryConfigurationController.getUsersWithSalaryConfigurations);

// Get salary statistics
router.get('/statistics', protect, isAdmin, salaryConfigurationController.getSalaryStatistics);

// Get salary configuration by user ID
router.get('/user/:userId', protect, salaryConfigurationController.getSalaryConfigurationByUser);

// Calculate salary for a user
router.get('/user/:userId/calculate', protect, salaryConfigurationController.calculateSalary);

// Create or update salary configuration
router.post('/', protect, isAdmin, salaryConfigurationValidation, salaryConfigurationController.createOrUpdateSalaryConfiguration);

// Delete salary configuration
router.delete('/user/:userId', protect, isAdmin, salaryConfigurationController.deleteSalaryConfiguration);

module.exports = router; 