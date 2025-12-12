const express = require("express");
const { protect, isAdmin } = require("../middleware/auth");
const {
  getFinancialMetrics,
  getFinancialSummary,
} = require("../controllers/financial");

const router = express.Router();

// Get financial metrics for a specific month/year
router.get("/metrics", [protect, isAdmin], getFinancialMetrics);

// Get financial summary for dashboard
router.get("/summary", [protect, isAdmin], getFinancialSummary);

module.exports = router;
