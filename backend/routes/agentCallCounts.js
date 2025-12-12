const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getAllAgentCallCounts,
  getAgentCallCounts,
  updateAgentCallCounts,
  getCallCountsInRange,
  getCallCountsStats,
  deleteAgentCallCounts,
  getAllAgentCallCountsMonthly,
} = require('../controllers/agentCallCounts');

// All routes require authentication
router.use(protect);

// GET /api/agent-call-counts - Get all agents with their call counts for a specific date
router.get('/', getAllAgentCallCounts);

// GET /api/agent-call-counts/monthly - Get all agents with their call counts aggregated by month
router.get('/monthly', getAllAgentCallCountsMonthly);

// GET /api/agent-call-counts/stats - Get call counts statistics
router.get('/stats', getCallCountsStats);

// GET /api/agent-call-counts/:agentId - Get call counts for a specific agent
router.get('/:agentId', getAgentCallCounts);

// PUT /api/agent-call-counts/:agentId - Update call counts for a specific agent
router.put('/:agentId', updateAgentCallCounts);

// GET /api/agent-call-counts/:agentId/range - Get call counts for a date range
router.get('/:agentId/range', getCallCountsInRange);

// DELETE /api/agent-call-counts/:agentId - Delete call counts for a specific agent and date
router.delete('/:agentId', deleteAgentCallCounts);

module.exports = router; 