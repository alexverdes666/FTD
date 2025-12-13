const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const depositCallsController = require('../controllers/depositCalls');

// All routes require authentication
router.use(protect);

// Get all deposit calls with filters
router.get('/', depositCallsController.getDepositCalls);

// Get calendar appointments
router.get('/calendar', depositCallsController.getCalendarAppointments);

// Get pending approvals
router.get('/pending-approvals', depositCallsController.getPendingApprovals);

// Get single deposit call
router.get('/:id', depositCallsController.getDepositCallById);

// Create deposit call
router.post('/', depositCallsController.createDepositCall);

// Create deposit calls from order (bulk create for all FTDs in order)
router.post('/from-order', depositCallsController.createFromOrder);

// Update deposit call
router.put('/:id', depositCallsController.updateDepositCall);

// Schedule a call
router.post('/:id/schedule', depositCallsController.scheduleCall);

// Bulk schedule calls
router.post('/:id/bulk-schedule', depositCallsController.bulkScheduleCalls);

// Mark call as done
router.post('/:id/mark-done', depositCallsController.markCallDone);

// Approve a call
router.post('/:id/approve', depositCallsController.approveCall);

// Reject a call
router.post('/:id/reject', depositCallsController.rejectCall);

module.exports = router;

