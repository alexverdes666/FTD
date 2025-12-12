const AMTarget = require('../models/AMTarget');
const User = require('../models/User');

// Get all targets (Admin/Lead Manager)
const getAllTargets = async (req, res) => {
  try {
    const { status, assignedTo, dueDateFrom, dueDateTo, page = 1, limit = 20 } = req.query;

    // Build filter
    const filter = {};
    
    if (status) {
      filter.status = status;
    }
    
    if (assignedTo) {
      filter.assignedTo = assignedTo;
    }
    
    if (dueDateFrom || dueDateTo) {
      filter.dueDate = {};
      if (dueDateFrom) {
        filter.dueDate.$gte = new Date(dueDateFrom);
      }
      if (dueDateTo) {
        filter.dueDate.$lte = new Date(dueDateTo);
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [targets, total] = await Promise.all([
      AMTarget.find(filter)
        .populate('assignedTo', 'fullName email')
        .populate('assignedBy', 'fullName email')
        .sort({ dueDate: 1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      AMTarget.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: targets,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching targets:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch targets',
      error: error.message,
    });
  }
};

// Get own targets (Affiliate Manager)
const getMyTargets = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, dueDateFrom, dueDateTo, page = 1, limit = 20 } = req.query;

    // Build filter
    const filter = { assignedTo: userId };
    
    if (status) {
      filter.status = status;
    }
    
    if (dueDateFrom || dueDateTo) {
      filter.dueDate = {};
      if (dueDateFrom) {
        filter.dueDate.$gte = new Date(dueDateFrom);
      }
      if (dueDateTo) {
        filter.dueDate.$lte = new Date(dueDateTo);
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [targets, total] = await Promise.all([
      AMTarget.find(filter)
        .populate('assignedTo', 'fullName email')
        .populate('assignedBy', 'fullName email')
        .sort({ dueDate: 1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      AMTarget.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: targets,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching my targets:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch targets',
      error: error.message,
    });
  }
};

// Create target (Admin/Lead Manager)
const createTarget = async (req, res) => {
  try {
    const { title, description, assignedTo, dueDate } = req.body;
    const assignedBy = req.user.id;

    // Validate required fields
    if (!title || !assignedTo || !dueDate) {
      return res.status(400).json({
        success: false,
        message: 'Title, assigned affiliate manager, and due date are required',
      });
    }

    // Verify the assigned user exists and is an affiliate manager
    const targetUser = await User.findById(assignedTo);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Assigned user not found',
      });
    }

    if (targetUser.role !== 'affiliate_manager') {
      return res.status(400).json({
        success: false,
        message: 'Targets can only be assigned to affiliate managers',
      });
    }

    const target = await AMTarget.create({
      title,
      description,
      assignedTo,
      assignedBy,
      dueDate: new Date(dueDate),
    });

    // Populate the response
    await target.populate('assignedTo', 'fullName email');
    await target.populate('assignedBy', 'fullName email');

    res.status(201).json({
      success: true,
      message: 'Target created successfully',
      data: target,
    });
  } catch (error) {
    console.error('Error creating target:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create target',
      error: error.message,
    });
  }
};

// Update target
const updateTarget = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, dueDate, status } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    const target = await AMTarget.findById(id);
    if (!target) {
      return res.status(404).json({
        success: false,
        message: 'Target not found',
      });
    }

    // Affiliate managers can only update status of their own targets
    if (userRole === 'affiliate_manager') {
      if (target.assignedTo.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You can only update your own targets',
        });
      }
      // AMs can only update status
      if (status) {
        target.status = status;
      }
    } else {
      // Admin/Lead Manager can update everything
      if (title) target.title = title;
      if (description !== undefined) target.description = description;
      if (dueDate) target.dueDate = new Date(dueDate);
      if (status) target.status = status;
    }

    await target.save();

    // Populate the response
    await target.populate('assignedTo', 'fullName email');
    await target.populate('assignedBy', 'fullName email');

    res.json({
      success: true,
      message: 'Target updated successfully',
      data: target,
    });
  } catch (error) {
    console.error('Error updating target:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update target',
      error: error.message,
    });
  }
};

// Delete target (Admin/Lead Manager)
const deleteTarget = async (req, res) => {
  try {
    const { id } = req.params;

    const target = await AMTarget.findById(id);
    if (!target) {
      return res.status(404).json({
        success: false,
        message: 'Target not found',
      });
    }

    await AMTarget.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Target deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting target:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete target',
      error: error.message,
    });
  }
};

// Get affiliate managers for dropdown
const getAffiliateManagers = async (req, res) => {
  try {
    const affiliateManagers = await User.find({
      role: 'affiliate_manager',
      isActive: true,
      status: 'approved',
    }).select('fullName email');

    res.json({
      success: true,
      data: affiliateManagers,
    });
  } catch (error) {
    console.error('Error fetching affiliate managers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch affiliate managers',
      error: error.message,
    });
  }
};

module.exports = {
  getAllTargets,
  getMyTargets,
  createTarget,
  updateTarget,
  deleteTarget,
  getAffiliateManagers,
};

