const express = require('express');
const { body, query } = require('express-validator');
const router = express.Router();
const { protect, isAdmin } = require('../middleware/auth');
const {
  getEmployeeSalaries,
  createEmployeeSalary,
  updateEmployeeSalary,
  deleteEmployeeSalary,
  getEmployeeBonuses,
  createEmployeeBonus,
  updateEmployeeBonus,
  deleteEmployeeBonus,
  getEmployeePaySummary,
  getAllEmployeesPaySummary,
} = require('../controllers/employeePay');

router.use(protect);

// --- Summary ---
// Get pay summary for a specific employee (admin or own)
router.get('/summary/:employeeId', getEmployeePaySummary);
// Get all employees pay summary (admin only)
router.get('/summary', isAdmin, getAllEmployeesPaySummary);

// --- Salary ---
// Get salary records for an employee (admin or own)
router.get('/salary/:employeeId', getEmployeeSalaries);

// Create salary record (admin only)
router.post('/salary', [
  isAdmin,
  body('employeeId').isMongoId().withMessage('Valid employee ID is required'),
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('month').isInt({ min: 1, max: 12 }).withMessage('Month must be 1-12'),
  body('year').isInt({ min: 2020 }).withMessage('Valid year is required'),
  body('currency').optional().isString(),
  body('notes').optional().isString().isLength({ max: 500 }),
], createEmployeeSalary);

// Update salary record (admin only)
router.put('/salary/:id', [
  isAdmin,
  body('amount').optional().isFloat({ min: 0 }),
  body('notes').optional().isString().isLength({ max: 500 }),
], updateEmployeeSalary);

// Delete salary record (admin only)
router.delete('/salary/:id', isAdmin, deleteEmployeeSalary);

// --- Bonus ---
// Get bonus records for an employee (admin or own)
router.get('/bonus/:employeeId', getEmployeeBonuses);

// Create bonus record (admin only)
router.post('/bonus', [
  isAdmin,
  body('employeeId').isMongoId().withMessage('Valid employee ID is required'),
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('reason').isString().isLength({ min: 1, max: 500 }).withMessage('Reason is required'),
  body('month').isInt({ min: 1, max: 12 }).withMessage('Month must be 1-12'),
  body('year').isInt({ min: 2020 }).withMessage('Valid year is required'),
  body('currency').optional().isString(),
  body('notes').optional().isString().isLength({ max: 500 }),
], createEmployeeBonus);

// Update bonus record (admin only)
router.put('/bonus/:id', [
  isAdmin,
  body('amount').optional().isFloat({ min: 0 }),
  body('reason').optional().isString().isLength({ max: 500 }),
  body('notes').optional().isString().isLength({ max: 500 }),
], updateEmployeeBonus);

// Delete bonus record (admin only)
router.delete('/bonus/:id', isAdmin, deleteEmployeeBonus);

module.exports = router;
