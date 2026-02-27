const express = require("express");
const router = express.Router();
const { protect, isAdmin, isManager } = require("../middleware/auth");
const {
  getAmiAgentStates,
  getAmiStatus,
  reconnectAmi,
} = require("../controllers/amiAgents");

// View routes: admin + affiliate_manager
router.get("/", [protect, isManager], getAmiAgentStates);
router.get("/status", [protect, isManager], getAmiStatus);
// Reconnect: admin only
router.post("/reconnect", [protect, isAdmin], reconnectAmi);

module.exports = router;
