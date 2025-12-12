const AgentSchedule = require('../models/AgentSchedule');
const ScheduleChangeRequest = require('../models/ScheduleChangeRequest');
const User = require('../models/User');
const { validationResult } = require('express-validator');

// @desc    Get agent schedule for a specific month (or create if doesn't exist)
// @route   GET /api/agent-schedule/:agentId/:year/:month
// @access  Private (agent themselves or admin/manager)
exports.getAgentSchedule = async (req, res) => {
  try {
    const { agentId, year, month } = req.params;

    // Verify agent exists and is an agent
    const agent = await User.findById(agentId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    if (agent.role !== 'agent') {
      return res.status(400).json({
        success: false,
        message: 'User is not an agent'
      });
    }

    // Find or create schedule
    let schedule = await AgentSchedule.findOne({
      agentId,
      year: parseInt(year),
      month: parseInt(month)
    }).populate('agentId', 'fullName email fourDigitCode');

    // If schedule doesn't exist, create it with all days available
    if (!schedule) {
      schedule = await AgentSchedule.create({
        agentId,
        year: parseInt(year),
        month: parseInt(month)
      });
      schedule = await AgentSchedule.findById(schedule._id).populate('agentId', 'fullName email fourDigitCode');
    }

    // Get pending requests for this month
    const pendingRequests = await ScheduleChangeRequest.find({
      agentId,
      year: parseInt(year),
      month: parseInt(month),
      status: 'pending'
    });

    res.status(200).json({
      success: true,
      data: {
        schedule,
        pendingRequests
      }
    });
  } catch (error) {
    console.error('Error in getAgentSchedule:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get all agents' schedules for a specific month
// @route   GET /api/agent-schedule/all/:year/:month
// @access  Private (admin/manager only)
exports.getAllAgentsSchedules = async (req, res) => {
  try {
    const { year, month } = req.params;

    // Get all agents
    const agents = await User.find({ role: 'agent', isActive: true }).select('fullName email fourDigitCode');

    // Get or create schedules for all agents
    const schedules = await Promise.all(
      agents.map(async (agent) => {
        let schedule = await AgentSchedule.findOne({
          agentId: agent._id,
          year: parseInt(year),
          month: parseInt(month)
        }).populate('agentId', 'fullName email fourDigitCode');

        // Create if doesn't exist
        if (!schedule) {
          schedule = await AgentSchedule.create({
            agentId: agent._id,
            year: parseInt(year),
            month: parseInt(month)
          });
          schedule = await AgentSchedule.findById(schedule._id).populate('agentId', 'fullName email fourDigitCode');
        }

        // Get pending requests count for this agent/month
        const pendingRequestsCount = await ScheduleChangeRequest.countDocuments({
          agentId: agent._id,
          year: parseInt(year),
          month: parseInt(month),
          status: 'pending'
        });

        return {
          ...schedule.toObject(),
          pendingRequestsCount
        };
      })
    );

    res.status(200).json({
      success: true,
      data: schedules
    });
  } catch (error) {
    console.error('Error in getAllAgentsSchedules:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Request a schedule change
// @route   POST /api/agent-schedule/request
// @access  Private (authenticated users)
exports.requestScheduleChange = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { agentId, year, month, day, requestedAvailability } = req.body;

    // If user is an agent, they can only request for themselves
    if (req.user.role === 'agent' && req.user._id.toString() !== agentId) {
      return res.status(403).json({
        success: false,
        message: 'Agents can only request changes for their own schedule'
      });
    }

    // Verify agent exists
    const agent = await User.findById(agentId);
    if (!agent || agent.role !== 'agent') {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    // Check if there's already a pending request for this day
    const existingRequest = await ScheduleChangeRequest.findOne({
      agentId,
      year,
      month,
      day,
      status: 'pending'
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: 'A pending request already exists for this day'
      });
    }

    // Create the change request
    const changeRequest = await ScheduleChangeRequest.create({
      agentId,
      year,
      month,
      day,
      requestedAvailability
    });

    const populatedRequest = await ScheduleChangeRequest.findById(changeRequest._id)
      .populate('agentId', 'fullName email fourDigitCode');

    res.status(201).json({
      success: true,
      data: populatedRequest
    });
  } catch (error) {
    console.error('Error in requestScheduleChange:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get schedule change requests
// @route   GET /api/agent-schedule/requests
// @access  Private (authenticated users)
exports.getScheduleChangeRequests = async (req, res) => {
  try {
    const { agentId, status } = req.query;

    let query = {};

    // If user is an agent, they can only see their own requests
    if (req.user.role === 'agent') {
      query.agentId = req.user._id;
    } else if (agentId) {
      // Managers can filter by agentId
      query.agentId = agentId;
    }

    // Filter by status if provided
    if (status) {
      query.status = status;
    }

    const requests = await ScheduleChangeRequest.find(query)
      .populate('agentId', 'fullName email fourDigitCode')
      .populate('reviewedBy', 'fullName email')
      .sort({ requestedAt: -1 });

    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests
    });
  } catch (error) {
    console.error('Error in getScheduleChangeRequests:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Approve a schedule change request
// @route   PUT /api/agent-schedule/requests/:id/approve
// @access  Private (admin/manager only)
exports.approveScheduleChange = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the request
    const changeRequest = await ScheduleChangeRequest.findById(id);
    if (!changeRequest) {
      return res.status(404).json({
        success: false,
        message: 'Change request not found'
      });
    }

    // Check if already processed
    if (changeRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Request has already been ${changeRequest.status}`
      });
    }

    // Update the request status
    changeRequest.status = 'approved';
    changeRequest.reviewedBy = req.user._id;
    changeRequest.reviewedAt = new Date();
    await changeRequest.save();

    // Update the actual schedule
    let schedule = await AgentSchedule.findOne({
      agentId: changeRequest.agentId,
      year: changeRequest.year,
      month: changeRequest.month
    });

    // Create schedule if doesn't exist
    if (!schedule) {
      schedule = await AgentSchedule.create({
        agentId: changeRequest.agentId,
        year: changeRequest.year,
        month: changeRequest.month
      });
    }

    // Update the availability for the specific day
    schedule.setAvailability(changeRequest.day, changeRequest.requestedAvailability);
    await schedule.save();

    // Populate and return
    const populatedRequest = await ScheduleChangeRequest.findById(changeRequest._id)
      .populate('agentId', 'fullName email fourDigitCode')
      .populate('reviewedBy', 'fullName email');

    res.status(200).json({
      success: true,
      data: populatedRequest
    });
  } catch (error) {
    console.error('Error in approveScheduleChange:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Bulk approve schedule change requests
// @route   POST /api/agent-schedule/requests/bulk-approve
// @access  Private (admin/manager only)
exports.bulkApproveScheduleChanges = async (req, res) => {
  try {
    const { requestIds } = req.body;

    if (!requestIds || !Array.isArray(requestIds) || requestIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Request IDs array is required'
      });
    }

    const results = {
      success: [],
      failed: [],
      alreadyProcessed: []
    };

    for (const requestId of requestIds) {
      try {
        // Find the request
        const changeRequest = await ScheduleChangeRequest.findById(requestId);
        
        if (!changeRequest) {
          results.failed.push({
            requestId,
            reason: 'Request not found'
          });
          continue;
        }

        // Check if already processed
        if (changeRequest.status !== 'pending') {
          results.alreadyProcessed.push({
            requestId,
            status: changeRequest.status
          });
          continue;
        }

        // Update the request status
        changeRequest.status = 'approved';
        changeRequest.reviewedBy = req.user._id;
        changeRequest.reviewedAt = new Date();
        await changeRequest.save();

        // Update the actual schedule
        let schedule = await AgentSchedule.findOne({
          agentId: changeRequest.agentId,
          year: changeRequest.year,
          month: changeRequest.month
        });

        // Create schedule if doesn't exist
        if (!schedule) {
          schedule = await AgentSchedule.create({
            agentId: changeRequest.agentId,
            year: changeRequest.year,
            month: changeRequest.month
          });
        }

        // Update the availability for the specific day
        schedule.setAvailability(changeRequest.day, changeRequest.requestedAvailability);
        await schedule.save();

        results.success.push({
          requestId,
          agentId: changeRequest.agentId,
          date: `${changeRequest.year}-${changeRequest.month}-${changeRequest.day}`
        });
      } catch (error) {
        results.failed.push({
          requestId,
          reason: error.message
        });
      }
    }

    const totalSuccess = results.success.length;
    const totalFailed = results.failed.length;
    const totalAlreadyProcessed = results.alreadyProcessed.length;

    let message = `Successfully approved ${totalSuccess} request(s).`;
    if (totalAlreadyProcessed > 0) {
      message += ` ${totalAlreadyProcessed} already processed.`;
    }
    if (totalFailed > 0) {
      message += ` ${totalFailed} failed.`;
    }

    res.status(200).json({
      success: true,
      message,
      data: results
    });
  } catch (error) {
    console.error('Error in bulkApproveScheduleChanges:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Reject a schedule change request
// @route   PUT /api/agent-schedule/requests/:id/reject
// @access  Private (admin/manager only)
exports.rejectScheduleChange = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { rejectionReason } = req.body;

    // Find the request
    const changeRequest = await ScheduleChangeRequest.findById(id);
    if (!changeRequest) {
      return res.status(404).json({
        success: false,
        message: 'Change request not found'
      });
    }

    // Check if already processed
    if (changeRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Request has already been ${changeRequest.status}`
      });
    }

    // Update the request status
    changeRequest.status = 'rejected';
    changeRequest.reviewedBy = req.user._id;
    changeRequest.reviewedAt = new Date();
    changeRequest.rejectionReason = rejectionReason || 'No reason provided';
    await changeRequest.save();

    // Populate and return
    const populatedRequest = await ScheduleChangeRequest.findById(changeRequest._id)
      .populate('agentId', 'fullName email fourDigitCode')
      .populate('reviewedBy', 'fullName email');

    res.status(200).json({
      success: true,
      data: populatedRequest
    });
  } catch (error) {
    console.error('Error in rejectScheduleChange:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

