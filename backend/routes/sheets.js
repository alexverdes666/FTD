const express = require('express');
const router = express.Router();
const Sheet = require('../models/Sheet');
const Lead = require('../models/Lead');
const Order = require('../models/Order');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// @route   GET /api/sheets
// @desc    Get all sheets for the current user
// @access  Private
router.get('/', async (req, res) => {
  try {
    const sheets = await Sheet.find({ user: req.user._id })
      .select('name sourceType meta.zoom updatedAt createdAt')
      .sort({ updatedAt: -1 });
    
    res.json({
      success: true,
      count: sheets.length,
      data: sheets
    });
  } catch (error) {
    console.error('Error fetching sheets:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sheets',
      error: error.message
    });
  }
});

// @route   GET /api/sheets/:id
// @desc    Get a single sheet by ID
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const sheet = await Sheet.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!sheet) {
      return res.status(404).json({
        success: false,
        message: 'Sheet not found'
      });
    }

    res.json({
      success: true,
      data: sheet
    });
  } catch (error) {
    console.error('Error fetching sheet:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sheet',
      error: error.message
    });
  }
});

// @route   POST /api/sheets
// @desc    Create a new sheet
// @access  Private
router.post('/', async (req, res) => {
  try {
    const { name, data, columns, styles, meta } = req.body;

    const sheet = new Sheet({
      user: req.user._id,
      name: name || 'Untitled Sheet',
      data,
      columns,
      styles,
      meta
    });

    await sheet.save();

    res.status(201).json({
      success: true,
      data: sheet
    });
  } catch (error) {
    console.error('Error creating sheet:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create sheet',
      error: error.message
    });
  }
});

// @route   PUT /api/sheets/:id
// @desc    Update a sheet
// @access  Private
router.put('/:id', async (req, res) => {
  try {
    const { name, data, columns, styles, meta } = req.body;

    const sheet = await Sheet.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!sheet) {
      return res.status(404).json({
        success: false,
        message: 'Sheet not found'
      });
    }

    // Update fields if provided
    if (name !== undefined) sheet.name = name;
    if (data !== undefined) sheet.data = data;
    if (columns !== undefined) sheet.columns = columns;
    if (styles !== undefined) sheet.styles = styles;
    if (meta !== undefined) {
      sheet.meta = { ...sheet.meta, ...meta };
    }

    await sheet.save();

    res.json({
      success: true,
      data: sheet
    });
  } catch (error) {
    console.error('Error updating sheet:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update sheet',
      error: error.message
    });
  }
});

// @route   DELETE /api/sheets/:id
// @desc    Delete a sheet
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const sheet = await Sheet.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });

    if (!sheet) {
      return res.status(404).json({
        success: false,
        message: 'Sheet not found'
      });
    }

    res.json({
      success: true,
      message: 'Sheet deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting sheet:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete sheet',
      error: error.message
    });
  }
});

// @route   POST /api/sheets/import/leads
// @desc    Import leads data into a new sheet
// @access  Private
router.post('/import/leads', async (req, res) => {
  try {
    const { name, filters = {} } = req.body;

    // Build query based on filters
    const query = {};
    if (filters.leadType) query.leadType = filters.leadType;
    if (filters.status) query.status = filters.status;
    if (filters.country) query.country = filters.country;
    if (filters.assignedAgent) query.assignedAgent = filters.assignedAgent;

    // Fetch leads (limit to prevent huge sheets)
    const leads = await Lead.find(query)
      .limit(filters.limit || 1000)
      .sort({ createdAt: -1 })
      .lean();

    if (leads.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No leads found matching the filters'
      });
    }

    // Define columns for leads
    const columns = [
      { title: 'First Name', width: 120, type: 'text' },
      { title: 'Last Name', width: 120, type: 'text' },
      { title: 'Email', width: 200, type: 'text' },
      { title: 'Phone', width: 150, type: 'text' },
      { title: 'Country', width: 100, type: 'text' },
      { title: 'Lead Type', width: 100, type: 'text' },
      { title: 'Status', width: 100, type: 'text' },
      { title: 'Created At', width: 150, type: 'text' }
    ];

    // Convert leads to 2D array
    const headerRow = columns.map(col => col.title);
    const dataRows = leads.map(lead => [
      lead.firstName || '',
      lead.lastName || '',
      lead.newEmail || '',
      lead.newPhone || '',
      lead.country || '',
      lead.leadType || '',
      lead.status || '',
      lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : ''
    ]);

    const data = [headerRow, ...dataRows];

    // Create sheet
    const sheet = new Sheet({
      user: req.user._id,
      name: name || `Leads Import - ${new Date().toLocaleDateString()}`,
      data,
      columns,
      sourceType: 'leads',
      sourceQuery: filters,
      lastImportedAt: new Date()
    });

    await sheet.save();

    res.status(201).json({
      success: true,
      data: sheet,
      importedCount: leads.length
    });
  } catch (error) {
    console.error('Error importing leads:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to import leads',
      error: error.message
    });
  }
});

// @route   POST /api/sheets/import/orders
// @desc    Import orders data into a new sheet
// @access  Private
router.post('/import/orders', async (req, res) => {
  try {
    const { name, filters = {} } = req.body;

    // Build query based on filters
    const query = {};
    if (filters.status) query.status = filters.status;
    if (filters.orderType) query.orderType = filters.orderType;

    // Fetch orders (limit to prevent huge sheets)
    const orders = await Order.find(query)
      .limit(filters.limit || 500)
      .sort({ createdAt: -1 })
      .populate('assignedAgent', 'fullName')
      .populate('clientNetwork', 'name')
      .lean();

    if (orders.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No orders found matching the filters'
      });
    }

    // Define columns for orders
    const columns = [
      { title: 'Order ID', width: 100, type: 'text' },
      { title: 'Type', width: 100, type: 'text' },
      { title: 'Status', width: 100, type: 'text' },
      { title: 'Agent', width: 150, type: 'text' },
      { title: 'Network', width: 150, type: 'text' },
      { title: 'FTDs Required', width: 100, type: 'numeric' },
      { title: 'FTDs Completed', width: 100, type: 'numeric' },
      { title: 'Created At', width: 150, type: 'text' }
    ];

    // Convert orders to 2D array
    const headerRow = columns.map(col => col.title);
    const dataRows = orders.map(order => [
      order._id?.toString().slice(-8) || '',
      order.orderType || '',
      order.status || '',
      order.assignedAgent?.fullName || '',
      order.clientNetwork?.name || '',
      order.ftdsRequired?.toString() || '0',
      order.ftdsCompleted?.toString() || '0',
      order.createdAt ? new Date(order.createdAt).toLocaleDateString() : ''
    ]);

    const data = [headerRow, ...dataRows];

    // Create sheet
    const sheet = new Sheet({
      user: req.user._id,
      name: name || `Orders Import - ${new Date().toLocaleDateString()}`,
      data,
      columns,
      sourceType: 'orders',
      sourceQuery: filters,
      lastImportedAt: new Date()
    });

    await sheet.save();

    res.status(201).json({
      success: true,
      data: sheet,
      importedCount: orders.length
    });
  } catch (error) {
    console.error('Error importing orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to import orders',
      error: error.message
    });
  }
});

module.exports = router;
