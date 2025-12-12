const express = require('express');
const { body, param, query } = require('express-validator');
const { protect, isAdmin } = require('../middleware/auth');
const {
  getUsersWithLinkedAccounts,
  getAvailableUsers,
  linkAccounts,
  unlinkAccounts,
  removeAccountFromGroup,
  getAccountGroup,
  debugUserLinks
} = require('../controllers/accountManagement');

const router = express.Router();

// All routes require admin access
router.use(protect);
router.use(isAdmin);

// Get all users with their linked accounts
router.get('/users', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().isString().trim(),
  query('role').optional().isIn(['admin', 'affiliate_manager', 'agent', 'lead_manager', 'refunds_manager', 'inventory_manager', 'all'])
], getUsersWithLinkedAccounts);

// Get available users for linking
router.get('/available-users', getAvailableUsers);

// Get specific account group details
router.get('/account-group/:accountId', [
  param('accountId').isMongoId().withMessage('Invalid account ID')
], getAccountGroup);

// Link accounts together
router.post('/link-accounts', [
  body('primaryAccountId').isMongoId().withMessage('Invalid primary account ID'),
  body('linkedAccountIds').isArray({ min: 1 }).withMessage('Linked account IDs must be a non-empty array'),
  body('linkedAccountIds.*').isMongoId().withMessage('Invalid linked account ID')
], linkAccounts);

// Unlink accounts
router.post('/unlink-accounts', [
  body('accountIds').isArray({ min: 1 }).withMessage('Account IDs must be a non-empty array'),
  body('accountIds.*').isMongoId().withMessage('Invalid account ID')
], unlinkAccounts);

// Remove specific account from group
router.delete('/remove-from-group/:accountId', [
  param('accountId').isMongoId().withMessage('Invalid account ID')
], removeAccountFromGroup);

// Debug endpoint - check user links
router.get('/debug/:userId', [
  param('userId').isMongoId().withMessage('Invalid user ID')
], debugUserLinks);

module.exports = router;
