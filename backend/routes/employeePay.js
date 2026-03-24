const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { protect, isAdmin } = require('../middleware/auth');
const {
  getEmployeeSalary,
  setEmployeeSalary,
  deleteEmployeeSalary,
  getAllEmployeeSalaries,
  getEmployeeBonuses,
  createEmployeeBonus,
  updateEmployeeBonus,
  deleteEmployeeBonus,
  getEmployeePaySummary,
} = require('../controllers/employeePay');

router.use(protect);

// --- Summary ---
router.get('/summary/:employeeId', getEmployeePaySummary);

// --- Salary (fixed per employee) ---
// Get all employee salaries (admin)
router.get('/salaries', isAdmin, getAllEmployeeSalaries);
// Get salary for an employee (admin or own)
router.get('/salary/:employeeId', getEmployeeSalary);
// Set/update salary for an employee (admin only)
router.put('/salary/:employeeId', [
  isAdmin,
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('currency').optional().isString(),
  body('notes').optional().isString().isLength({ max: 500 }),
], setEmployeeSalary);
// Delete salary config (admin only)
router.delete('/salary/:employeeId', isAdmin, deleteEmployeeSalary);

// --- Bonus (per month) ---
router.get('/bonus/:employeeId', getEmployeeBonuses);
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
router.put('/bonus/:id', [
  isAdmin,
  body('amount').optional().isFloat({ min: 0 }),
  body('reason').optional().isString().isLength({ max: 500 }),
  body('notes').optional().isString().isLength({ max: 500 }),
], updateEmployeeBonus);
router.delete('/bonus/:id', isAdmin, deleteEmployeeBonus);

module.exports = router;
