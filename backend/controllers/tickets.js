const Ticket = require('../models/Ticket');
const User = require('../models/User');
const TicketImage = require('../models/TicketImage');
const { createTicketNotification } = require('./notifications');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs').promises;

// @desc    Get all tickets with filtering and pagination
// @route   GET /api/tickets
// @access  Private
exports.getTickets = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      category,
      priority,
      assignedTo,
      createdBy,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      tags,
      dueDate
    } = req.query;

    // Build filter object
    const filter = {};
    
    // Role-based filtering - only admins can see all tickets
    if (req.user.role !== 'admin') {
      // Non-admins can see their own tickets OR tickets assigned to them
      filter.$or = [
        { createdBy: req.user._id },
        { assignedTo: req.user._id }
      ];
      // Non-admins should never see deleted tickets
      filter.status = { $ne: 'deleted' };
    }

    // Apply filters
    if (status) {
      // If user explicitly requests a status, use that
      // Only admins can view deleted tickets
      if (status === 'deleted' && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Only admins can view deleted tickets'
        });
      }
      filter.status = status;
    } else if (req.user.role === 'admin') {
      // For admins without status filter, exclude deleted tickets by default
      filter.status = { $ne: 'deleted' };
    }
    if (category) filter.category = category;
    if (priority) filter.priority = priority;
    // Only admins can filter by createdBy (since they see all tickets)
    if (createdBy && req.user.role === 'admin') {
      filter.createdBy = createdBy;
    }
    // Filter by assignee name (admin only, partial match)
    if (assignedTo && req.user.role === 'admin') {
      const matchingUsers = await User.find({
        fullName: { $regex: assignedTo, $options: 'i' },
        isActive: true
      }).select('_id');
      filter.assignedTo = { $in: matchingUsers.map(u => u._id) };
    }
    if (tags) filter.tags = { $in: tags.split(',') };
    
    // Due date filtering
    if (dueDate) {
      const date = new Date(dueDate);
      filter.dueDate = { $lte: date };
    }

    // Text search
    if (search) {
      filter.$text = { $search: search };
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate skip value
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query with population
    const tickets = await Ticket.find(filter)
      .populate('createdBy', 'fullName email role')
      .populate('assignedTo', 'fullName email role')
      .populate('assignedBy', 'fullName email role')
      .populate('comments.user', 'fullName email role')
      .populate('resolution.resolvedBy', 'fullName email')
      .populate('relatedFine', 'status amount reason agent')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await Ticket.countDocuments(filter);

    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));

    res.status(200).json({
      success: true,
      data: tickets,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: totalPages
      }
    });

  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching tickets'
    });
  }
};

// @desc    Get single ticket by ID
// @route   GET /api/tickets/:id
// @access  Private
exports.getTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate('createdBy', 'fullName email role')
      .populate('assignedTo', 'fullName email role')
      .populate('assignedBy', 'fullName email role')
      .populate('comments.user', 'fullName email role')
      .populate('resolution.resolvedBy', 'fullName email')
      .populate('lastActivityBy', 'fullName email')
      .populate({
        path: 'relatedFine',
        populate: [
          { path: 'agent', select: 'fullName email' },
          { path: 'imposedBy', select: 'fullName email' },
          { path: 'adminDecision.decidedBy', select: 'fullName email' }
        ]
      });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Check access permissions - admins see all, others see own or assigned
    const isOwner = ticket.createdBy._id.toString() === req.user._id.toString();
    const isAssignee = ticket.assignedTo && ticket.assignedTo._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isAdmin && !isOwner && !isAssignee) {
      return res.status(403).json({
        success: false,
        message: 'You can only access your own tickets or tickets assigned to you'
      });
    }

    // Filter internal comments for non-admin users (assignees can't see internal comments)
    if (!isAdmin) {
      ticket.comments = ticket.comments.filter(comment => !comment.isInternal);
    }

    res.status(200).json({
      success: true,
      data: ticket
    });

  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching ticket'
    });
  }
};

// @desc    Create new ticket
// @route   POST /api/tickets
// @access  Private
exports.createTicket = async (req, res) => {
  try {
    const { title, description, category, priority = 'medium', tags, dueDate, imageIds } = req.body;

    // Validate required fields
    if (!title || !description || !category) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, and category are required'
      });
    }

    // Create ticket
    const ticket = await Ticket.create({
      title,
      description,
      category,
      priority,
      createdBy: req.user._id,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      dueDate: dueDate ? new Date(dueDate) : null,
      lastActivityBy: req.user._id
    });

    // If images were provided, link them to the ticket
    if (imageIds && Array.isArray(imageIds) && imageIds.length > 0) {
      try {
        await TicketImage.updateMany(
          { 
            _id: { $in: imageIds },
            uploadedBy: req.user._id,
            ticketId: null
          },
          { 
            $set: { ticketId: ticket._id }
          }
        );
      } catch (imageError) {
        console.error('Failed to link images to ticket:', imageError);
      }
    }

    // Populate the created ticket
    const populatedTicket = await Ticket.findById(ticket._id)
      .populate('createdBy', 'fullName email role')
      .populate('lastActivityBy', 'fullName email');

    // Notify all admins about the new ticket
    try {
      const admins = await User.find({ role: 'admin', isActive: true });
      for (const admin of admins) {
        if (admin._id.toString() !== req.user._id.toString()) { // Don't notify the creator
          await createTicketNotification(
            'ticket_created',
            populatedTicket,
            admin._id,
            req.user._id,
            req.io
          );
        }
      }
    } catch (notificationError) {
      console.error('Failed to create ticket notifications:', notificationError);
    }

    res.status(201).json({
      success: true,
      data: populatedTicket,
      message: 'Ticket created successfully'
    });

  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating ticket'
    });
  }
};

// @desc    Update ticket
// @route   PUT /api/tickets/:id
// @access  Private
exports.updateTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Check permissions - only ticket owner or admin can update
    const isOwner = ticket.createdBy.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own tickets'
      });
    }

    // Define fields that can be updated by different roles
    const allowedFields = ['title', 'description', 'tags'];
    
    if (isAdmin) {
      allowedFields.push('status', 'priority', 'dueDate', 'category');
    }

    // Build update object
    const updateData = {};
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        if (key === 'tags' && req.body[key]) {
          updateData[key] = req.body[key].split(',').map(tag => tag.trim());
        } else if (key === 'dueDate' && req.body[key]) {
          updateData[key] = new Date(req.body[key]);
        } else {
          updateData[key] = req.body[key];
        }
      }
    });

    // Update last activity
    updateData.lastActivityAt = new Date();
    updateData.lastActivityBy = req.user._id;

    // Update ticket
    const updatedTicket = await Ticket.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'fullName email role')
     .populate('assignedTo', 'fullName email role')
     .populate('lastActivityBy', 'fullName email');

    res.status(200).json({
      success: true,
      data: updatedTicket,
      message: 'Ticket updated successfully'
    });

  } catch (error) {
    console.error('Update ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating ticket'
    });
  }
};

// @desc    Delete ticket (soft delete - sets status to 'deleted')
// @route   DELETE /api/tickets/:id
// @access  Private (Admin only)
exports.deleteTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Only admins can delete tickets
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required to delete tickets'
      });
    }

    // Soft delete - set status to 'deleted' instead of removing from database
    ticket.status = 'deleted';
    ticket.lastActivityAt = new Date();
    ticket.lastActivityBy = req.user._id;
    await ticket.save();

    res.status(200).json({
      success: true,
      message: 'Ticket deleted successfully'
    });

  } catch (error) {
    console.error('Delete ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting ticket'
    });
  }
};

// @desc    Add comment to ticket
// @route   POST /api/tickets/:id/comments
// @access  Private
exports.addComment = async (req, res) => {
  try {
    const { message, isInternal = false, imageIds } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Comment message is required'
      });
    }

    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Check permissions - ticket owner, admin, or assignee can comment
    const isOwner = ticket.createdBy.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    const isAssignee = ticket.assignedTo && ticket.assignedTo.toString() === req.user._id.toString();

    if (!isOwner && !isAdmin && !isAssignee) {
      return res.status(403).json({
        success: false,
        message: 'You can only comment on your own tickets or tickets assigned to you'
      });
    }

    // Only admins can create internal comments
    const commentIsInternal = isInternal && isAdmin;

    // Add comment using instance method
    await ticket.addComment(req.user._id, message.trim(), commentIsInternal);

    // Get the index of the newly added comment
    const commentIndex = ticket.comments.length - 1;

    // If images were provided, link them to the comment
    if (imageIds && Array.isArray(imageIds) && imageIds.length > 0) {
      try {
        await TicketImage.updateMany(
          { 
            _id: { $in: imageIds },
            uploadedBy: req.user._id,
            ticketId: req.params.id,
            commentIndex: null
          },
          { 
            $set: { commentIndex: commentIndex }
          }
        );
      } catch (imageError) {
        console.error('Failed to link images to comment:', imageError);
      }
    }

    // Get updated ticket with populated data
    const updatedTicket = await Ticket.findById(req.params.id)
      .populate('createdBy', 'fullName email role')
      .populate('assignedTo', 'fullName email role')
      .populate('comments.user', 'fullName email role')
      .populate('lastActivityBy', 'fullName email');

    // Filter internal comments for non-admin users
    if (req.user.role !== 'admin') {
      updatedTicket.comments = updatedTicket.comments.filter(comment => !comment.isInternal);
    }

    // Notify relevant users about the comment (unless it's internal)
    if (!commentIsInternal) {
      try {
        if (isAdmin) {
          // Admin commented - notify the ticket creator
          if (updatedTicket.createdBy._id.toString() !== req.user._id.toString()) {
            await createTicketNotification(
              'ticket_commented',
              updatedTicket,
              updatedTicket.createdBy._id,
              req.user._id,
              req.io
            );
          }
          // Also notify assignee if different from admin and creator
          if (updatedTicket.assignedTo && updatedTicket.assignedTo._id.toString() !== req.user._id.toString() &&
              updatedTicket.assignedTo._id.toString() !== updatedTicket.createdBy._id.toString()) {
            await createTicketNotification(
              'ticket_commented',
              updatedTicket,
              updatedTicket.assignedTo._id,
              req.user._id,
              req.io
            );
          }
        } else {
          // User commented - notify all admins
          const admins = await User.find({ role: 'admin', isActive: true });
          for (const admin of admins) {
            await createTicketNotification(
              'ticket_commented',
              updatedTicket,
              admin._id,
              req.user._id,
              req.io
            );
          }
          // Also notify assignee if different from commenter
          if (updatedTicket.assignedTo && updatedTicket.assignedTo.toString() !== req.user._id.toString()) {
            const assigneeId = updatedTicket.assignedTo._id || updatedTicket.assignedTo;
            await createTicketNotification(
              'ticket_commented',
              updatedTicket,
              assigneeId,
              req.user._id,
              req.io
            );
          }
        }
      } catch (notificationError) {
        console.error('Failed to create comment notifications:', notificationError);
      }
    }

    res.status(200).json({
      success: true,
      data: updatedTicket,
      message: 'Comment added successfully'
    });

  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding comment'
    });
  }
};

// @desc    Get users who can be assigned tickets
// @route   GET /api/tickets/assignable-users
// @access  Private (Admin only)
exports.getAssignableUsers = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const assignableRoles = ['lead_manager', 'inventory_manager', 'affiliate_manager'];
    const users = await User.find({
      role: { $in: assignableRoles },
      isActive: true
    }).select('fullName email role').sort('fullName');

    res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Get assignable users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching assignable users'
    });
  }
};

// @desc    Assign ticket to a manager
// @route   PUT /api/tickets/:id/assign
// @access  Private (Admin only)
exports.assignTicket = async (req, res) => {
  try {
    const { assignedTo } = req.body;

    if (!assignedTo) {
      return res.status(400).json({
        success: false,
        message: 'assignedTo user ID is required'
      });
    }

    // Only admins can assign tickets
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admin can assign tickets'
      });
    }

    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Validate the target user exists and has an assignable role
    const targetUser = await User.findById(assignedTo);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Target user not found'
      });
    }

    if (!targetUser.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Cannot assign ticket to an inactive user'
      });
    }

    const assignableRoles = ['lead_manager', 'inventory_manager', 'affiliate_manager'];
    if (!assignableRoles.includes(targetUser.role)) {
      return res.status(400).json({
        success: false,
        message: 'Tickets can only be assigned to lead managers, inventory managers, or affiliate managers'
      });
    }

    // Use instance method to assign
    await ticket.assignTo(assignedTo, req.user._id);

    // Get updated ticket with populated data
    const updatedTicket = await Ticket.findById(req.params.id)
      .populate('createdBy', 'fullName email role')
      .populate('assignedTo', 'fullName email role')
      .populate('assignedBy', 'fullName email role')
      .populate('comments.user', 'fullName email role')
      .populate('resolution.resolvedBy', 'fullName email')
      .populate('lastActivityBy', 'fullName email');

    // Notify the assignee
    try {
      await createTicketNotification(
        'ticket_assigned',
        updatedTicket,
        assignedTo,
        req.user._id,
        req.io
      );
    } catch (notificationError) {
      console.error('Failed to create assignment notification:', notificationError);
    }

    res.status(200).json({
      success: true,
      data: updatedTicket,
      message: `Ticket assigned to ${targetUser.fullName} successfully`
    });

  } catch (error) {
    console.error('Assign ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while assigning ticket'
    });
  }
};

// @desc    Resolve ticket
// @route   PUT /api/tickets/:id/resolve
// @access  Private (Admin or Assignee)
exports.resolveTicket = async (req, res) => {
  try {
    const { resolutionNote } = req.body;

    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Check permissions - admins or assignees can resolve tickets
    const isAdmin = req.user.role === 'admin';
    const isAssignee = ticket.assignedTo && ticket.assignedTo.toString() === req.user._id.toString();

    if (!isAdmin && !isAssignee) {
      return res.status(403).json({
        success: false,
        message: 'Only admin or the assigned manager can resolve tickets'
      });
    }

    // For fine dispute tickets, require the fine to be decided first
    if (ticket.category === 'fine_dispute' && ticket.relatedFine) {
      const AgentFine = require('../models/AgentFine');
      const relatedFine = await AgentFine.findById(ticket.relatedFine);
      if (relatedFine && !['admin_approved', 'admin_rejected'].includes(relatedFine.status)) {
        return res.status(400).json({
          success: false,
          message: 'Cannot resolve a fine dispute ticket before making a decision on the fine. Please approve or reject the dispute first.'
        });
      }
    }

    // Use instance method to resolve
    await ticket.resolve(req.user._id, resolutionNote);

    // Get updated ticket
    const updatedTicket = await Ticket.findById(req.params.id)
      .populate('createdBy', 'fullName email role')
      .populate('assignedTo', 'fullName email role')
      .populate('assignedBy', 'fullName email role')
      .populate('resolution.resolvedBy', 'fullName email')
      .populate('lastActivityBy', 'fullName email');

    // Notify the ticket creator that their ticket has been resolved
    try {
      if (updatedTicket.createdBy._id.toString() !== req.user._id.toString()) {
        await createTicketNotification(
          'ticket_resolved',
          updatedTicket,
          updatedTicket.createdBy._id,
          req.user._id,
          req.io
        );
      }
      // If resolved by assignee, also notify the admin who assigned it
      if (isAssignee && updatedTicket.assignedBy) {
        const assignedById = updatedTicket.assignedBy._id || updatedTicket.assignedBy;
        if (assignedById.toString() !== req.user._id.toString()) {
          await createTicketNotification(
            'ticket_resolved',
            updatedTicket,
            assignedById,
            req.user._id,
            req.io
          );
        }
      }
    } catch (notificationError) {
      console.error('Failed to create resolution notification:', notificationError);
    }

    res.status(200).json({
      success: true,
      data: updatedTicket,
      message: 'Ticket resolved successfully'
    });

  } catch (error) {
    console.error('Resolve ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while resolving ticket'
    });
  }
};


// @desc    Get ticket statistics
// @route   GET /api/tickets/stats
// @access  Private (Admin only)
exports.getTicketStats = async (req, res) => {
  try {
    // Check permissions - only admins can see stats
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const stats = await Ticket.getTicketStats();

    // Get additional metrics
    const totalTickets = await Ticket.countDocuments();
    const openTickets = await Ticket.countDocuments({ status: 'open' });
    const overDueTickets = await Ticket.countDocuments({
      dueDate: { $lt: new Date() },
      status: { $nin: ['resolved', 'closed'] }
    });

    // Average resolution time for resolved tickets
    const resolvedTickets = await Ticket.aggregate([
      {
        $match: { 
          status: 'resolved',
          'resolution.resolvedAt': { $exists: true }
        }
      },
      {
        $project: {
          resolutionTime: {
            $subtract: ['$resolution.resolvedAt', '$createdAt']
          }
        }
      },
      {
        $group: {
          _id: null,
          avgResolutionTime: { $avg: '$resolutionTime' },
          count: { $sum: 1 }
        }
      }
    ]);

    const avgResolutionTime = resolvedTickets.length > 0 
      ? Math.round(resolvedTickets[0].avgResolutionTime / (1000 * 60 * 60)) // Convert to hours
      : 0;

    res.status(200).json({
      success: true,
      data: {
        ...stats,
        summary: {
          total: totalTickets,
          open: openTickets,
          overdue: overDueTickets,
          avgResolutionTimeHours: avgResolutionTime
        }
      }
    });

  } catch (error) {
    console.error('Get ticket stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching ticket statistics'
    });
  }
};

