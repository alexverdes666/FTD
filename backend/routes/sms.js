const express = require("express");
const { getSMSMessages, fetchFromGateway } = require("../controllers/sms");
const { protect, isAdmin } = require("../middleware/auth");

const router = express.Router();

// All SMS routes require admin access
router.use(protect);
router.use(isAdmin);

// Get all SMS messages with pagination and filtering
router.get("/", getSMSMessages);

// Fetch SMS messages from a gateway device
router.post("/fetch-from-gateway/:gatewayId", fetchFromGateway);

module.exports = router;
