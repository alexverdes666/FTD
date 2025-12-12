const express = require('express');
const { body, param, query } = require('express-validator');
const { protect, authorize, isAdmin } = require('../middleware/auth');
const {
  getTickets,
  getTicket,
  createTicket,
  updateTicket,
  deleteTicket,
  addComment,
  resolveTicket,
  getTicketStats
} = require('../controllers/tickets');

const router = express.Router();

// All ticket routes require authentication
router.use(protect);

// Validation middleware
const ticketValidation = [
  body('title')
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters')
    .trim(),
  body('description')
    .isLength({ min: 10, max: 2000 })
    .withMessage('Description must be between 10 and 2000 characters')
    .trim(),
  body('category')
    .isIn(['leads_request', 'salary_issue', 'technical_support', 'account_access', 'payment_issue', 'feature_request', 'bug_report', 'other'])
    .withMessage('Invalid category'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority'),
  body('tags')
    .optional()
    .isString()
    .withMessage('Tags must be a comma-separated string'),
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid due date format')
];

const updateTicketValidation = [
  body('title')
    .optional()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters')
    .trim(),
  body('description')
    .optional()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Description must be between 10 and 2000 characters')
    .trim(),
  body('category')
    .optional()
    .isIn(['leads_request', 'salary_issue', 'technical_support', 'account_access', 'payment_issue', 'feature_request', 'bug_report', 'other'])
    .withMessage('Invalid category'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority'),
  body('status')
    .optional()
    .isIn(['open', 'in_progress', 'waiting_response', 'resolved', 'closed'])
    .withMessage('Invalid status'),
  body('tags')
    .optional()
    .isString()
    .withMessage('Tags must be a comma-separated string'),
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid due date format')
  // assignedTo removed - only admins handle tickets
];

const commentValidation = [
  body('message')
    .isLength({ min: 1, max: 1000 })
    .withMessage('Comment must be between 1 and 1000 characters')
    .trim(),
  body('isInternal')
    .optional()
    .isBoolean()
    .withMessage('isInternal must be a boolean')
];

// assignValidation removed - no assignment functionality

const resolveValidation = [
  body('resolutionNote')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Resolution note must not exceed 1000 characters')
    .trim()
];

const paramValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ticket ID')
];

const queryValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('status')
    .optional()
    .isIn(['open', 'in_progress', 'waiting_response', 'resolved', 'closed'])
    .withMessage('Invalid status'),
  query('category')
    .optional()
    .isIn(['leads_request', 'salary_issue', 'technical_support', 'account_access', 'payment_issue', 'feature_request', 'bug_report', 'other'])
    .withMessage('Invalid category'),
  query('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority'),
  // assignedTo filter removed - only admins see all tickets
  query('createdBy')
    .optional()
    .isMongoId()
    .withMessage('Invalid creator ID'),
  query('search')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'title', 'priority', 'status', 'lastActivityAt'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
  query('tags')
    .optional()
    .isString()
    .withMessage('Tags must be a comma-separated string'),
  query('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid due date format')
];

// Routes

// Get ticket statistics (Admin only)
router.get('/stats', 
  isAdmin,
  getTicketStats
);

// Get all tickets with filtering and pagination
router.get('/', 
  queryValidation,
  getTickets
);

// Get single ticket by ID
router.get('/:id', 
  paramValidation,
  getTicket
);

// Create new ticket
router.post('/', 
  ticketValidation,
  createTicket
);

// Update ticket
router.put('/:id', 
  paramValidation,
  updateTicketValidation,
  updateTicket
);

// Delete ticket (Admin only)
router.delete('/:id', 
  paramValidation,
  isAdmin,
  deleteTicket
);

// Add comment to ticket
router.post('/:id/comments', 
  paramValidation,
  commentValidation,
  addComment
);

// Resolve ticket (Admin only)
router.put('/:id/resolve', 
  paramValidation,
  resolveValidation,
  isAdmin,
  resolveTicket
);

module.exports = router;
