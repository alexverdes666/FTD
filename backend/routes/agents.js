const express = require("express");
const axios = require("axios");
const { protect } = require("../middleware/auth");
const router = express.Router();
const EXTERNAL_API_BASE = "https://agent-report-mfl3.onrender.com/api/mongodb";
router.get("/", protect, async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin role required.",
      });
    }
    const response = await axios.get(`${EXTERNAL_API_BASE}/agents`);
    res.status(200).json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error("Error fetching agents from external API:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch agents data",
      error: error.message,
    });
  }
});
router.get("/:agentName/performance", protect, async (req, res, next) => {
  try {
    const { agentName } = req.params;
    if (req.user.role !== "admin" && req.user.fullName !== agentName) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only view your own performance data.",
      });
    }
    const response = await axios.get(
      `${EXTERNAL_API_BASE}/agents/${encodeURIComponent(agentName)}`
    );
    if (!response.data.success || response.data.data.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No performance data found for this agent",
      });
    }
    const latestData = response.data.data[0];
    const transformedData = transformAgentData(latestData);
    res.status(200).json({
      success: true,
      data: transformedData,
    });
  } catch (error) {
    console.error("Error fetching agent performance:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch agent performance data",
      error: error.message,
    });
  }
});
router.get("/me/performance", protect, async (req, res, next) => {
  try {
    if (req.user.role !== "agent") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Agent role required.",
      });
    }
    if (!req.user.fullName) {
      return res.status(400).json({
        success: false,
        message: "Agent name not found in user profile",
      });
    }
    const response = await axios.get(
      `${EXTERNAL_API_BASE}/agents/${encodeURIComponent(req.user.fullName)}`
    );
    if (!response.data.success || response.data.data.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No performance data found for your agent profile",
      });
    }
    const latestData = response.data.data[0];
    const transformedData = transformAgentData(latestData);
    res.status(200).json({
      success: true,
      data: transformedData,
    });
  } catch (error) {
    console.error("Error fetching current agent performance:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch your performance data",
      error: error.message,
    });
  }
});
function transformAgentData(data) {
  const incomingCalls = data.incoming_calls || {};
  const outgoingCalls = data.outgoing_calls || {};
  const timeToSeconds = (timeString) => {
    if (!timeString) return 0;
    const [hours, minutes, seconds] = timeString.split(":").map(Number);
    return hours * 3600 + minutes * 60 + seconds;
  };
  const ratePerSecond = 0.00278;
  const totalTimeSeconds = timeToSeconds(incomingCalls.total_time);
  const totalPay = (totalTimeSeconds * ratePerSecond).toFixed(2);
  return {
    id: data._id || data.agent_number,
    agentName: data.agent_name,
    agentNumber: data.agent_number,
    lastUpdated: data.last_updated,
    reportTimestamp: data.report_timestamp,
    taskId: data.task_id,
    incomingCalls: {
      total: parseInt(incomingCalls.total) || 0,
      successful: parseInt(incomingCalls.successful) || 0,
      unsuccessful: parseInt(incomingCalls.unsuccessful) || 0,
      totalTime: incomingCalls.total_time || "00:00:00",
      totalTimeSeconds: totalTimeSeconds,
      averageTime: incomingCalls.avg_time || "00:00:00",
      minTime: incomingCalls.min_time || "00:00:00",
      maxTime: incomingCalls.max_time || "00:00:00",
      averageWait: incomingCalls.avg_wait || "00:00:00",
      maxWait: incomingCalls.max_wait || "00:00:00",
      minWait: incomingCalls.min_wait || "00:00:00",
    },
    outgoingCalls: {
      total: parseInt(outgoingCalls.total) || 0,
      successful: parseInt(outgoingCalls.successful) || 0,
      unsuccessful: parseInt(outgoingCalls.unsuccessful) || 0,
      totalTime: outgoingCalls.total_time || "00:00:00",
      averageTime: outgoingCalls.avg_time || "00:00:00",
      minTime: outgoingCalls.min_time || "00:00:00",
      maxTime: outgoingCalls.max_time || "00:00:00",
    },
    metrics: {
      totalCalls:
        (parseInt(incomingCalls.total) || 0) +
        (parseInt(outgoingCalls.total) || 0),
      successRate: incomingCalls.total
        ? Math.round(
            (parseInt(incomingCalls.successful) /
              parseInt(incomingCalls.total)) *
              100
          )
        : 0,
      totalPay: parseFloat(totalPay),
      ratePerSecond: ratePerSecond,
    },
  };
}

// External bonus routes have been removed
// Admin-controlled bonus system is now handled in /api/agent-bonuses routes

module.exports = router;
