const express = require("express");
const router = express.Router();
const { protect, isAdmin } = require("../middleware/auth");
const {
  getAmiAgentStates,
  getAmiStatus,
  reconnectAmi,
} = require("../controllers/amiAgents");

// All routes require admin auth
router.get("/", [protect, isAdmin], getAmiAgentStates);
router.get("/status", [protect, isAdmin], getAmiStatus);
router.post("/reconnect", [protect, isAdmin], reconnectAmi);

module.exports = router;
