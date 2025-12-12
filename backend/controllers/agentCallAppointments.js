const AgentCallAppointment = require('../models/AgentCallAppointment');
const User = require('../models/User');
const { validationResult } = require('express-validator');

// @desc    Get agent call appointments for a specific month
// @route   GET /api/agent-call-appointments/:agentId/:year/:month
// @access  Private (agent themselves or admin/manager)
exports.getAgentAppointments = async (req, res) => {
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

    // Get all appointments for this agent/month
    const appointments = await AgentCallAppointment.find({
      agentId,
      year: parseInt(year),
      month: parseInt(month)
    })
    .populate('agentId', 'fullName email fourDigitCode')
    .sort({ day: 1, hour: 1 });

    res.status(200).json({
      success: true,
      data: appointments
    });
  } catch (error) {
    console.error('Error in getAgentAppointments:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get all agents' call appointments for a specific month
// @route   GET /api/agent-call-appointments/all/:year/:month
// @access  Private (admin/manager only)
exports.getAllAppointments = async (req, res) => {
  try {
    const { year, month } = req.params;

    // Get all appointments for this month across all agents
    const appointments = await AgentCallAppointment.find({
      year: parseInt(year),
      month: parseInt(month)
    })
    .populate('agentId', 'fullName email fourDigitCode')
    .sort({ agentId: 1, day: 1, hour: 1 });

    res.status(200).json({
      success: true,
      data: appointments
    });
  } catch (error) {
    console.error('Error in getAllAppointments:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Create a new call appointment
// @route   POST /api/agent-call-appointments
// @access  Private (agent for themselves)
exports.createAppointment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { agentId, year, month, day, hour, ftdName } = req.body;

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

    // Agents can only create appointments for themselves
    if (req.user.role === 'agent' && req.user._id.toString() !== agentId) {
      return res.status(403).json({
        success: false,
        message: 'You can only create appointments for yourself'
      });
    }

    // Validate date
    const daysInMonth = new Date(year, month, 0).getDate();
    if (day > daysInMonth) {
      return res.status(400).json({
        success: false,
        message: `Invalid day for the selected month. ${month}/${year} has ${daysInMonth} days.`
      });
    }

    // Check for duplicate appointment at same time
    const existingAppointment = await AgentCallAppointment.findOne({
      agentId,
      year,
      month,
      day,
      hour
    });

    if (existingAppointment) {
      return res.status(400).json({
        success: false,
        message: 'An appointment already exists for this time slot'
      });
    }

    // Create appointment
    const appointment = await AgentCallAppointment.create({
      agentId,
      year,
      month,
      day,
      hour,
      ftdName
    });

    const populatedAppointment = await AgentCallAppointment.findById(appointment._id)
      .populate('agentId', 'fullName email fourDigitCode');

    res.status(201).json({
      success: true,
      message: 'Appointment created successfully',
      data: populatedAppointment
    });
  } catch (error) {
    console.error('Error in createAppointment:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'An appointment already exists for this time slot'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update an existing call appointment
// @route   PUT /api/agent-call-appointments/:id
// @access  Private (owner only)
exports.updateAppointment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { year, month, day, hour, ftdName } = req.body;

    // Find appointment
    const appointment = await AgentCallAppointment.findById(id);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Only the owner can update
    if (appointment.agentId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own appointments'
      });
    }

    // Validate date if provided
    if (year && month && day) {
      const daysInMonth = new Date(year, month, 0).getDate();
      if (day > daysInMonth) {
        return res.status(400).json({
          success: false,
          message: `Invalid day for the selected month. ${month}/${year} has ${daysInMonth} days.`
        });
      }
    }

    // Check for conflicts if time is being changed
    const newYear = year || appointment.year;
    const newMonth = month || appointment.month;
    const newDay = day || appointment.day;
    const newHour = hour !== undefined ? hour : appointment.hour;

    if (newYear !== appointment.year || newMonth !== appointment.month || 
        newDay !== appointment.day || newHour !== appointment.hour) {
      const conflictingAppointment = await AgentCallAppointment.findOne({
        _id: { $ne: id },
        agentId: appointment.agentId,
        year: newYear,
        month: newMonth,
        day: newDay,
        hour: newHour
      });

      if (conflictingAppointment) {
        return res.status(400).json({
          success: false,
          message: 'An appointment already exists for this time slot'
        });
      }
    }

    // Update appointment
    if (year !== undefined) appointment.year = year;
    if (month !== undefined) appointment.month = month;
    if (day !== undefined) appointment.day = day;
    if (hour !== undefined) appointment.hour = hour;
    if (ftdName !== undefined) appointment.ftdName = ftdName;

    await appointment.save();

    const updatedAppointment = await AgentCallAppointment.findById(appointment._id)
      .populate('agentId', 'fullName email fourDigitCode');

    res.status(200).json({
      success: true,
      message: 'Appointment updated successfully',
      data: updatedAppointment
    });
  } catch (error) {
    console.error('Error in updateAppointment:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'An appointment already exists for this time slot'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Delete a call appointment
// @route   DELETE /api/agent-call-appointments/:id
// @access  Private (owner only)
exports.deleteAppointment = async (req, res) => {
  try {
    const { id } = req.params;

    // Find appointment
    const appointment = await AgentCallAppointment.findById(id);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Only the owner can delete
    if (appointment.agentId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own appointments'
      });
    }

    await appointment.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Appointment deleted successfully'
    });
  } catch (error) {
    console.error('Error in deleteAppointment:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

