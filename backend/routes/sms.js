const express = require("express");
const { getSMSMessages } = require("../controllers/sms");
const { protect, isAdmin } = require("../middleware/auth");

const router = express.Router();

// All SMS routes require admin access
router.use(protect);
router.use(isAdmin);

// Get all SMS messages with pagination and filtering
router.get("/", getSMSMessages);

module.exports = router;
