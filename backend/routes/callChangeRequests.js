const express = require("express");
const router = express.Router();
const callChangeRequestsController = require("../controllers/callChangeRequests");
const { protect } = require("../middleware/auth");

// All routes require authentication
router.use(protect);

// Get all pending call change requests
router.get("/pending", callChangeRequestsController.getPendingRequests);

// Get pending request for a specific lead/order
router.get("/check", callChangeRequestsController.getPendingRequestForLead);

// Approve a call change request
router.post("/:id/approve", callChangeRequestsController.approveRequest);

// Reject a call change request
router.post("/:id/reject", callChangeRequestsController.rejectRequest);

module.exports = router;

