const express = require("express");
const { getSMSMessages, fetchFromGateway } = require("../controllers/sms");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

// SMS routes accessible by admin, affiliate_manager, lead_manager, and refunds_manager
router.use(protect);
router.use(authorize("admin", "affiliate_manager", "lead_manager", "refunds_manager"));

// Get all SMS messages with pagination and filtering
router.get("/", getSMSMessages);

// Fetch SMS messages from a gateway device
router.post("/fetch-from-gateway/:gatewayId", fetchFromGateway);

module.exports = router;
