const GatewayDevice = require('../models/GatewayDevice');
const { validationResult } = require('express-validator');
const GoIPGatewayService = require('../services/goipGatewayService');
const axios = require('axios');

/**
 * Get all gateway devices
 */
exports.getGatewayDevices = async (req, res, next) => {
  try {
    const { includeInactive } = req.query;
    
    const filter = {};
    if (!includeInactive || includeInactive === 'false') {
      filter.isActive = true;
    }

    const gateways = await GatewayDevice.find(filter)
      .populate('createdBy', 'fullName email')
      .populate('lastModifiedBy', 'fullName email')
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      data: gateways,
      count: gateways.length
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single gateway device by ID
 */
exports.getGatewayDeviceById = async (req, res, next) => {
  try {
    const gateway = await GatewayDevice.findById(req.params.id)
      .populate('createdBy', 'fullName email')
      .populate('lastModifiedBy', 'fullName email');

    if (!gateway) {
      return res.status(404).json({
        success: false,
        message: 'Gateway device not found'
      });
    }

    res.status(200).json({
      success: true,
      data: gateway
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create new gateway device
 */
exports.createGatewayDevice = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { name, host, port, username, password, description } = req.body;

    // Check if gateway with same host:port already exists
    const existingGateway = await GatewayDevice.findOne({ host, port });
    if (existingGateway) {
      return res.status(400).json({
        success: false,
        message: 'Gateway with this host and port already exists'
      });
    }

    // Check if gateway with same name already exists
    const existingName = await GatewayDevice.findOne({ name });
    if (existingName) {
      return res.status(400).json({
        success: false,
        message: 'Gateway with this name already exists'
      });
    }

    const gatewayData = {
      name,
      host,
      port,
      username,
      password,
      description,
      createdBy: req.user._id,
      lastModifiedBy: req.user._id
    };

    const gateway = await GatewayDevice.create(gatewayData);

    // Populate the created gateway
    const populatedGateway = await GatewayDevice.findById(gateway._id)
      .populate('createdBy', 'fullName email')
      .populate('lastModifiedBy', 'fullName email');

    res.status(201).json({
      success: true,
      message: 'Gateway device created successfully',
      data: populatedGateway
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update gateway device
 */
exports.updateGatewayDevice = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const gateway = await GatewayDevice.findById(req.params.id);
    
    if (!gateway) {
      return res.status(404).json({
        success: false,
        message: 'Gateway device not found'
      });
    }

    const { name, host, port, username, password, description, isActive } = req.body;

    // Check if new host:port combination conflicts with another gateway
    if (host && port && (host !== gateway.host || port !== gateway.port)) {
      const existingGateway = await GatewayDevice.findOne({ 
        host, 
        port,
        _id: { $ne: gateway._id }
      });
      if (existingGateway) {
        return res.status(400).json({
          success: false,
          message: 'Another gateway with this host and port already exists'
        });
      }
    }

    // Check if new name conflicts with another gateway
    if (name && name !== gateway.name) {
      const existingName = await GatewayDevice.findOne({
        name,
        _id: { $ne: gateway._id }
      });
      if (existingName) {
        return res.status(400).json({
          success: false,
          message: 'Another gateway with this name already exists'
        });
      }
    }

    // Update fields
    if (name) gateway.name = name;
    if (host) gateway.host = host;
    if (port) gateway.port = port;
    if (username) gateway.username = username;
    if (password) gateway.password = password;
    if (description !== undefined) gateway.description = description;
    if (isActive !== undefined) gateway.isActive = isActive;
    
    gateway.lastModifiedBy = req.user._id;
    await gateway.save();

    const updatedGateway = await GatewayDevice.findById(gateway._id)
      .populate('createdBy', 'fullName email')
      .populate('lastModifiedBy', 'fullName email');

    res.status(200).json({
      success: true,
      message: 'Gateway device updated successfully',
      data: updatedGateway
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete gateway device
 */
exports.deleteGatewayDevice = async (req, res, next) => {
  try {
    const gateway = await GatewayDevice.findById(req.params.id);
    
    if (!gateway) {
      return res.status(404).json({
        success: false,
        message: 'Gateway device not found'
      });
    }

    // Check if any SIM cards are using this gateway
    const SimCard = require('../models/SimCard');
    const simCardsUsingGateway = await SimCard.countDocuments({
      'gateway.gatewayId': gateway._id,
      'gateway.enabled': true
    });

    if (simCardsUsingGateway > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete gateway. ${simCardsUsingGateway} SIM card(s) are currently using this gateway. Please disable gateway integration for these SIM cards first.`
      });
    }

    await GatewayDevice.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Gateway device deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Test connection to gateway device
 */
exports.testGatewayConnection = async (req, res, next) => {
  try {
    const gateway = await GatewayDevice.findById(req.params.id);
    
    if (!gateway) {
      return res.status(404).json({
        success: false,
        message: 'Gateway device not found'
      });
    }

    // Create gateway service instance
    const gatewayService = GoIPGatewayService.createInstance({
      host: gateway.host,
      port: gateway.port,
      username: gateway.username,
      password: gateway.password,
      name: gateway.name,
      _id: gateway._id
    });

    // Test connection
    const testResult = await gatewayService.testConnection();

    // Update gateway with test results
    gateway.lastConnectionTest = new Date();
    gateway.lastConnectionStatus = testResult.success ? 'success' : 'failed';
    if (!testResult.success) {
      gateway.lastConnectionError = testResult.error;
    } else {
      gateway.lastConnectionError = null;
    }
    gateway.lastModifiedBy = req.user._id;
    await gateway.save();

    res.status(200).json({
      success: testResult.success,
      message: testResult.message,
      data: {
        ...testResult,
        gateway: {
          id: gateway._id,
          name: gateway.name,
          host: gateway.host,
          port: gateway.port
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get live status from gateway device
 */
exports.getGatewayLiveStatus = async (req, res, next) => {
  try {
    const gateway = await GatewayDevice.findById(req.params.id);
    
    if (!gateway) {
      return res.status(404).json({
        success: false,
        message: 'Gateway device not found'
      });
    }

    if (!gateway.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Gateway is not active'
      });
    }

    // Create gateway service instance
    const gatewayService = GoIPGatewayService.createInstance({
      host: gateway.host,
      port: gateway.port,
      username: gateway.username,
      password: gateway.password,
      name: gateway.name,
      _id: gateway._id
    });

    // Query gateway for actual status data
    try {
      const response = await axios.get(
        `http://${gateway.host}:${gateway.port}/goip_get_status.html`,
        {
          params: {
            username: gateway.username,
            password: gateway.password
          },
          timeout: 10000
        }
      );

      // Return the gateway status with raw response data
      res.status(200).json({
        success: true,
        message: 'Live gateway status retrieved',
        data: {
          gateway: {
            id: gateway._id,
            name: gateway.name,
            host: gateway.host,
            port: gateway.port,
            baseURL: gateway.baseURL
          },
          timestamp: new Date(),
          rawResponse: response.data
        }
      });
    } catch (error) {
      console.error('Error querying gateway:', error.message);
      res.status(503).json({
        success: false,
        message: 'Failed to query gateway',
        error: error.message,
        details: 'Make sure gateway is accessible and credentials are correct',
        data: {
          gateway: {
            id: gateway._id,
            name: gateway.name,
            host: gateway.host,
            port: gateway.port
          }
        }
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Configure status notifications for gateway
 */
exports.configureGatewayNotifications = async (req, res, next) => {
  try {
    const gateway = await GatewayDevice.findById(req.params.id);
    
    if (!gateway) {
      return res.status(404).json({
        success: false,
        message: 'Gateway device not found'
      });
    }

    const { callbackUrl, period, allSims } = req.body;
    
    // Use server URL from environment if not provided
    const serverUrl = process.env.SERVER_URL || 'http://localhost:5000';
    const notificationUrl = callbackUrl || `${serverUrl}/api/simcards/gateway/webhook/status`;

    // Create gateway service instance
    const gatewayService = GoIPGatewayService.createInstance({
      host: gateway.host,
      port: gateway.port,
      username: gateway.username,
      password: gateway.password,
      name: gateway.name,
      _id: gateway._id
    });

    // Configure notifications
    const result = await gatewayService.configureStatusNotification(
      notificationUrl,
      period || 60,
      allSims !== undefined ? allSims : 1
    );

    // Update gateway configuration
    gateway.statusNotificationEnabled = true;
    gateway.statusNotificationPeriod = period || 60;
    gateway.statusNotificationUrl = notificationUrl;
    gateway.lastModifiedBy = req.user._id;
    await gateway.save();

    res.status(200).json({
      success: true,
      message: 'Status notifications configured successfully',
      data: {
        gateway: {
          id: gateway._id,
          name: gateway.name
        },
        configuration: {
          callbackUrl: notificationUrl,
          period: period || 60,
          allSims: allSims !== undefined ? allSims : 1
        },
        result
      }
    });
  } catch (error) {
    next(error);
  }
};

