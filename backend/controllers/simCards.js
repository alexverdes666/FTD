const SimCard = require("../models/SimCard");
const GatewayDevice = require("../models/GatewayDevice");
const { validationResult } = require("express-validator");
const GoIPGatewayService = require("../services/goipGatewayService");

// Default gateway service instance (for backward compatibility and static methods)
const defaultGatewayService = GoIPGatewayService.default;

/**
 * Get gateway service instance for a SIM card
 * @param {Object} simCard - SIM card object with gateway configuration
 * @returns {Object} Gateway service instance
 */
async function getGatewayServiceForSimCard(simCard) {
  if (!simCard.gateway.gatewayId) {
    // Use default gateway service for SIM cards without specific gateway
    return defaultGatewayService;
  }

  const gateway = await GatewayDevice.findById(simCard.gateway.gatewayId);
  if (!gateway) {
    throw new Error("Gateway device not found");
  }

  if (!gateway.isActive) {
    throw new Error("Gateway device is not active");
  }

  return GoIPGatewayService.createInstance({
    host: gateway.host,
    port: gateway.port,
    username: gateway.username,
    password: gateway.password,
    name: gateway.name,
    _id: gateway._id,
  });
}

// Get all SIM cards with filtering and pagination
exports.getSimCards = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.geo) filter.geo = new RegExp(req.query.geo, "i");
    if (req.query.operator)
      filter.operator = new RegExp(req.query.operator, "i");
    if (req.query.simNumber)
      filter.simNumber = new RegExp(req.query.simNumber, "i");

    // Date range filter
    if (req.query.dateFrom || req.query.dateTo) {
      filter.dateCharged = {};
      if (req.query.dateFrom)
        filter.dateCharged.$gte = new Date(req.query.dateFrom);
      if (req.query.dateTo)
        filter.dateCharged.$lte = new Date(req.query.dateTo);
    }

    const simCards = await SimCard.find(filter)
      .populate("createdBy", "fullName email")
      .populate("lastModifiedBy", "fullName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await SimCard.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: simCards,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get single SIM card by ID
exports.getSimCardById = async (req, res, next) => {
  try {
    const simCard = await SimCard.findById(req.params.id)
      .populate("createdBy", "fullName email")
      .populate("lastModifiedBy", "fullName email");

    if (!simCard) {
      return res.status(404).json({
        success: false,
        message: "SIM card not found",
      });
    }

    res.status(200).json({
      success: true,
      data: simCard,
    });
  } catch (error) {
    next(error);
  }
};

// Create new SIM card
exports.createSimCard = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const {
      geo,
      operator,
      dateCharged,
      simNumber,
      notes,
      status,
      topUpLink,
      credentials,
    } = req.body;

    // Check if SIM number already exists
    const existingSimCard = await SimCard.findOne({ simNumber });
    if (existingSimCard) {
      return res.status(400).json({
        success: false,
        message: "SIM card with this number already exists",
      });
    }

    const simCardData = {
      geo,
      operator,
      dateCharged,
      simNumber,
      notes,
      topUpLink,
      credentials,
      status: status || "inactive",
      createdBy: req.user._id,
      lastModifiedBy: req.user._id,
    };

    const simCard = await SimCard.create(simCardData);
    await simCard.populate("createdBy", "fullName email");
    await simCard.populate("lastModifiedBy", "fullName email");

    res.status(201).json({
      success: true,
      message: "SIM card created successfully",
      data: simCard,
    });
  } catch (error) {
    next(error);
  }
};

// Update SIM card
exports.updateSimCard = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const {
      geo,
      operator,
      dateCharged,
      simNumber,
      notes,
      topUpLink,
      credentials,
    } = req.body;

    const simCard = await SimCard.findById(req.params.id);
    if (!simCard) {
      return res.status(404).json({
        success: false,
        message: "SIM card not found",
      });
    }

    // Check if new SIM number conflicts with existing ones
    if (simNumber && simNumber !== simCard.simNumber) {
      const existingSimCard = await SimCard.findOne({ simNumber });
      if (existingSimCard) {
        return res.status(400).json({
          success: false,
          message: "SIM card with this number already exists",
        });
      }
    }

    if (geo !== undefined) simCard.geo = geo;
    if (operator !== undefined) simCard.operator = operator;
    if (dateCharged !== undefined) simCard.dateCharged = dateCharged;
    if (simNumber !== undefined) simCard.simNumber = simNumber;
    if (notes !== undefined) simCard.notes = notes;
    if (topUpLink !== undefined) simCard.topUpLink = topUpLink;
    if (credentials !== undefined) simCard.credentials = credentials;

    simCard.lastModifiedBy = req.user._id;

    await simCard.save();

    const updatedSimCard = await SimCard.findById(simCard._id)
      .populate("createdBy", "fullName email")
      .populate("lastModifiedBy", "fullName email");

    res.status(200).json({
      success: true,
      message: "SIM card updated successfully",
      data: updatedSimCard,
    });
  } catch (error) {
    next(error);
  }
};

// Update SIM card status (active/inactive)
exports.updateSimCardStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be either "active" or "inactive"',
      });
    }

    const simCard = await SimCard.findById(req.params.id);
    if (!simCard) {
      return res.status(404).json({
        success: false,
        message: "SIM card not found",
      });
    }

    const updatedSimCard = await SimCard.findByIdAndUpdate(
      req.params.id,
      {
        status,
        lastModifiedBy: req.user._id,
      },
      { new: true, runValidators: true }
    )
      .populate("createdBy", "fullName email")
      .populate("lastModifiedBy", "fullName email");

    res.status(200).json({
      success: true,
      message: `SIM card status updated to ${status}`,
      data: updatedSimCard,
    });
  } catch (error) {
    next(error);
  }
};

// Delete SIM card
exports.deleteSimCard = async (req, res, next) => {
  try {
    const simCard = await SimCard.findById(req.params.id);
    if (!simCard) {
      return res.status(404).json({
        success: false,
        message: "SIM card not found",
      });
    }

    await SimCard.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "SIM card deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Get SIM card statistics
exports.getSimCardStats = async (req, res, next) => {
  try {
    const stats = await SimCard.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: {
            $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
          },
          inactive: {
            $sum: { $cond: [{ $eq: ["$status", "inactive"] }, 1, 0] },
          },
        },
      },
    ]);

    const geoStats = await SimCard.aggregate([
      {
        $group: {
          _id: "$geo",
          count: { $sum: 1 },
          active: {
            $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
          },
          inactive: {
            $sum: { $cond: [{ $eq: ["$status", "inactive"] }, 1, 0] },
          },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const operatorStats = await SimCard.aggregate([
      {
        $group: {
          _id: "$operator",
          count: { $sum: 1 },
          active: {
            $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
          },
          inactive: {
            $sum: { $cond: [{ $eq: ["$status", "inactive"] }, 1, 0] },
          },
        },
      },
      { $sort: { count: -1 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: stats[0] || { total: 0, active: 0, inactive: 0 },
        byGeo: geoStats,
        byOperator: operatorStats,
      },
    });
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// GATEWAY INTEGRATION ENDPOINTS
// =============================================================================

/**
 * Configure gateway status notifications
 * Sets up the gateway to send status updates to our server
 */
exports.configureGatewayNotifications = async (req, res, next) => {
  try {
    const { callbackUrl, period, allSims } = req.body;

    // Use server URL if not provided
    const serverUrl =
      callbackUrl ||
      `${
        process.env.SERVER_URL || "http://localhost:5000"
      }/api/simcards/gateway/webhook/status`;

    const result = await defaultGatewayService.configureStatusNotification(
      serverUrl,
      period || 60,
      allSims !== undefined ? allSims : 1
    );

    res.status(200).json({
      success: true,
      message: "Gateway notifications configured successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Webhook endpoint to receive device status updates from gateway
 */
exports.receiveDeviceStatus = async (req, res, next) => {
  try {
    const statusData = req.body;

    if (statusData.type === "dev-status") {
      // Process all port statuses
      const updatePromises = statusData.status.map(async (portStatus) => {
        const parsedStatus = defaultGatewayService.parsePortStatus(portStatus);

        // Find SIM card by gateway port
        const simCard = await SimCard.findOne({
          "gateway.port": parsedStatus.port,
        });

        if (simCard && simCard.gateway.enabled) {
          // Update SIM card with latest status
          simCard.gateway.deviceStatus = parsedStatus.deviceStatus;
          simCard.gateway.statusCode = parsedStatus.statusCode;
          simCard.gateway.balance = parsedStatus.balance;
          simCard.gateway.operator = parsedStatus.operator;
          simCard.gateway.imei = parsedStatus.imei || simCard.gateway.imei;
          simCard.gateway.imsi = parsedStatus.imsi || simCard.gateway.imsi;
          simCard.gateway.iccid = parsedStatus.iccid || simCard.gateway.iccid;
          simCard.gateway.lastStatusUpdate = new Date();

          // Update operator field if available
          if (parsedStatus.operator) {
            const operatorMatch = parsedStatus.operator.match(/(\d+)\s+(.+)/);
            if (operatorMatch) {
              simCard.gateway.operatorId = operatorMatch[1];
              simCard.operator = operatorMatch[2];
            }
          }

          // Auto-update status based on device status
          if (["registered", "idle"].includes(parsedStatus.deviceStatus)) {
            simCard.status = "active";
          } else if (
            [
              "no_sim",
              "register_failed",
              "locked_device",
              "locked_operator",
            ].includes(parsedStatus.deviceStatus)
          ) {
            simCard.status = "inactive";
          }

          await simCard.save();
        }
      });

      await Promise.all(updatePromises);

      res.status(200).json({ success: true, message: "Status updated" });
    } else if (statusData.type === "port-status") {
      // Process single port status update
      const parsedStatus = goipGatewayService.parsePortStatus(statusData);

      const simCard = await SimCard.findOne({
        "gateway.port": parsedStatus.port,
      });

      if (simCard && simCard.gateway.enabled) {
        simCard.gateway.deviceStatus = parsedStatus.deviceStatus;
        simCard.gateway.statusCode = parsedStatus.statusCode;
        simCard.gateway.balance = parsedStatus.balance;
        simCard.gateway.operator = parsedStatus.operator;
        simCard.gateway.imei = parsedStatus.imei || simCard.gateway.imei;
        simCard.gateway.imsi = parsedStatus.imsi || simCard.gateway.imsi;
        simCard.gateway.iccid = parsedStatus.iccid || simCard.gateway.iccid;
        simCard.gateway.lastStatusUpdate = new Date();

        if (parsedStatus.operator) {
          const operatorMatch = parsedStatus.operator.match(/(\d+)\s+(.+)/);
          if (operatorMatch) {
            simCard.gateway.operatorId = operatorMatch[1];
            simCard.operator = operatorMatch[2];
          }
        }

        if (["registered", "idle"].includes(parsedStatus.deviceStatus)) {
          simCard.status = "active";
        } else if (
          [
            "no_sim",
            "register_failed",
            "locked_device",
            "locked_operator",
          ].includes(parsedStatus.deviceStatus)
        ) {
          simCard.status = "inactive";
        }

        await simCard.save();
      }

      res.status(200).json({ success: true, message: "Status updated" });
    } else {
      res.status(200).json({ success: true, message: "Unknown status type" });
    }
  } catch (error) {
    console.error("Error processing status update:", error);
    next(error);
  }
};

/**
 * Webhook endpoint to receive SMS from gateway
 */
exports.receiveSMS = async (req, res, next) => {
  try {
    const smsData = req.body;

    if (smsData.type === "recv-sms") {
      // Process received SMS
      const updatePromises = smsData.sms.map(async (smsArray) => {
        const [deliveryReport, port, timestamp, sender, recipient, content] =
          smsArray;

        // Find SIM card by port
        const simCard = await SimCard.findOne({ "gateway.port": port });

        if (simCard && simCard.gateway.enabled) {
          // Update received SMS count
          simCard.smsStats.received += 1;
          await simCard.save();
        }

        // You can store SMS in a separate collection if needed
        // For now, we're just updating the counter
      });

      await Promise.all(updatePromises);

      res.status(200).json({ success: true, message: "SMS received" });
    } else {
      res.status(200).json({ success: true, message: "Unknown SMS type" });
    }
  } catch (error) {
    console.error("Error processing received SMS:", error);
    next(error);
  }
};

/**
 * Lock a SIM card port
 */
exports.lockPort = async (req, res, next) => {
  try {
    const simCard = await SimCard.findById(req.params.id);

    if (!simCard) {
      return res.status(404).json({
        success: false,
        message: "SIM card not found",
      });
    }

    if (!simCard.gateway.enabled || !simCard.gateway.port) {
      return res.status(400).json({
        success: false,
        message: "SIM card is not configured for gateway operations",
      });
    }

    const gatewayService = await getGatewayServiceForSimCard(simCard);
    const result = await gatewayService.lockPort(simCard.gateway.port);

    // Update local status
    simCard.gateway.isLocked = true;
    simCard.gateway.deviceStatus = "locked_device";
    simCard.lastModifiedBy = req.user._id;
    await simCard.save();

    res.status(200).json({
      success: true,
      message: "Port locked successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Unlock a SIM card port
 */
exports.unlockPort = async (req, res, next) => {
  try {
    const simCard = await SimCard.findById(req.params.id);

    if (!simCard) {
      return res.status(404).json({
        success: false,
        message: "SIM card not found",
      });
    }

    if (!simCard.gateway.enabled || !simCard.gateway.port) {
      return res.status(400).json({
        success: false,
        message: "SIM card is not configured for gateway operations",
      });
    }

    const gatewayService = await getGatewayServiceForSimCard(simCard);
    const result = await gatewayService.unlockPort(simCard.gateway.port);

    // Update local status
    simCard.gateway.isLocked = false;
    simCard.lastModifiedBy = req.user._id;
    await simCard.save();

    res.status(200).json({
      success: true,
      message: "Port unlocked successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Switch SIM card slot
 */
exports.switchSlot = async (req, res, next) => {
  try {
    const { targetSlot } = req.body;
    const simCard = await SimCard.findById(req.params.id);

    if (!simCard) {
      return res.status(404).json({
        success: false,
        message: "SIM card not found",
      });
    }

    if (!simCard.gateway.enabled || !simCard.gateway.port) {
      return res.status(400).json({
        success: false,
        message: "SIM card is not configured for gateway operations",
      });
    }

    // Extract port number and construct new port with target slot
    const portMatch = simCard.gateway.port.match(/^(\d+)([A-D])$/);
    if (!portMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid port format",
      });
    }

    const portNumber = portMatch[1];
    const slotLetter = String.fromCharCode(64 + targetSlot); // 1=A, 2=B, 3=C, 4=D
    const newPort = `${portNumber}${slotLetter}`;

    const gatewayService = await getGatewayServiceForSimCard(simCard);
    const result = await gatewayService.switchSimSlot(newPort);

    // Update local slot info
    simCard.gateway.slot = targetSlot;
    simCard.gateway.port = newPort;
    simCard.lastModifiedBy = req.user._id;
    await simCard.save();

    res.status(200).json({
      success: true,
      message: "SIM slot switched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset port/module
 */
exports.resetPort = async (req, res, next) => {
  try {
    const simCard = await SimCard.findById(req.params.id);

    if (!simCard) {
      return res.status(404).json({
        success: false,
        message: "SIM card not found",
      });
    }

    if (!simCard.gateway.enabled || !simCard.gateway.port) {
      return res.status(400).json({
        success: false,
        message: "SIM card is not configured for gateway operations",
      });
    }

    const gatewayService = await getGatewayServiceForSimCard(simCard);
    const result = await gatewayService.resetPort(simCard.gateway.port);

    res.status(200).json({
      success: true,
      message: "Port reset successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send SMS via gateway
 */
exports.sendSMS = async (req, res, next) => {
  try {
    const { to, message, options } = req.body;
    const simCard = await SimCard.findById(req.params.id);

    if (!simCard) {
      return res.status(404).json({
        success: false,
        message: "SIM card not found",
      });
    }

    if (!simCard.gateway.enabled || !simCard.gateway.port) {
      return res.status(400).json({
        success: false,
        message: "SIM card is not configured for gateway operations",
      });
    }

    const taskId = Date.now();
    const smsData = {
      tasks: [
        {
          tid: taskId,
          from: simCard.gateway.port,
          to: Array.isArray(to) ? to.join(",") : to,
          sms: message,
          ...options,
        },
      ],
      options: options || {},
    };

    const gatewayService = await getGatewayServiceForSimCard(simCard);
    const result = await gatewayService.sendSMS(smsData);

    // Update SMS statistics
    const recipients = Array.isArray(to) ? to.length : to.split(",").length;
    simCard.smsStats.sent += recipients;
    await simCard.save();

    res.status(200).json({
      success: true,
      message: "SMS sent successfully",
      data: {
        taskId,
        result,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Query SMS statistics from gateway
 */
exports.getGatewaySMSStats = async (req, res, next) => {
  try {
    const { ports, slots, type } = req.query;

    const result = await defaultGatewayService.querySMSStatistics({
      ports,
      slots,
      type: type ? parseInt(type) : 0,
    });

    res.status(200).json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Query call statistics from gateway
 */
exports.getGatewayCallStats = async (req, res, next) => {
  try {
    const { ports, slots, type } = req.query;

    const result = await defaultGatewayService.queryCallStatistics({
      ports,
      slots,
      type: type ? parseInt(type) : 0,
    });

    res.status(200).json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Enable gateway integration for a SIM card
 */
exports.enableGatewayIntegration = async (req, res, next) => {
  try {
    const { port, slot, gatewayId } = req.body;
    const simCard = await SimCard.findById(req.params.id);

    if (!simCard) {
      return res.status(404).json({
        success: false,
        message: "SIM card not found",
      });
    }

    // Validate gateway if provided
    if (gatewayId) {
      const gateway = await GatewayDevice.findById(gatewayId);
      if (!gateway) {
        return res.status(404).json({
          success: false,
          message: "Gateway device not found",
        });
      }
      if (!gateway.isActive) {
        return res.status(400).json({
          success: false,
          message: "Gateway device is not active",
        });
      }
    }

    simCard.gateway.enabled = true;
    simCard.gateway.gatewayId = gatewayId || null;
    simCard.gateway.port = port;
    simCard.gateway.slot = slot;
    simCard.lastModifiedBy = req.user._id;
    await simCard.save();

    // Populate gateway info for response
    const populatedSimCard = await SimCard.findById(simCard._id)
      .populate("gateway.gatewayId", "name host port")
      .populate("createdBy", "fullName email")
      .populate("lastModifiedBy", "fullName email");

    res.status(200).json({
      success: true,
      message: "Gateway integration enabled",
      data: populatedSimCard,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Disable gateway integration for a SIM card
 */
exports.disableGatewayIntegration = async (req, res, next) => {
  try {
    const simCard = await SimCard.findById(req.params.id);

    if (!simCard) {
      return res.status(404).json({
        success: false,
        message: "SIM card not found",
      });
    }

    simCard.gateway.enabled = false;
    simCard.lastModifiedBy = req.user._id;
    await simCard.save();

    res.status(200).json({
      success: true,
      message: "Gateway integration disabled",
      data: simCard,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get live status of ALL ports from gateway device
 * This queries the gateway directly to see which ports have SIM cards
 */
exports.getLiveGatewayStatus = async (req, res, next) => {
  try {
    const axios = require("axios");

    const gatewayHost = process.env.GOIP_GATEWAY_HOST || "188.126.10.151";
    const gatewayPort = process.env.GOIP_GATEWAY_PORT || "4064";
    const gatewayUsername = process.env.GOIP_GATEWAY_USERNAME || "root";
    const gatewayPassword =
      process.env.GOIP_GATEWAY_PASSWORD || "Greedisgood10!";

    // Query gateway for current status of all ports
    const response = await axios.get(
      `http://${gatewayHost}:${gatewayPort}/goip_get_status.html`,
      {
        params: {
          username: gatewayUsername,
          password: gatewayPassword,
        },
        timeout: 10000,
      }
    );

    // The gateway returns HTML or JSON depending on configuration
    // We need to parse the response and return port statuses

    res.status(200).json({
      success: true,
      message: "Live gateway status retrieved",
      data: {
        gatewayHost,
        gatewayPort,
        timestamp: new Date(),
        rawResponse: response.data,
      },
    });
  } catch (error) {
    console.error("Error querying gateway:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to query gateway",
      error: error.message,
      details: "Make sure gateway is accessible and credentials are correct",
    });
  }
};

/**
 * Check SIM cards for cooldown period and create notifications
 * This is called by the scheduler service
 * @param {Object} io - Socket.io instance for real-time notifications
 */
exports.checkSimCardCooldownAndNotify = async (io = null) => {
  try {
    const User = require("../models/User");
    const Notification = require("../models/Notification");

    const currentDate = new Date();
    // Use UTC to calculate 20 days ago to avoid timezone issues
    const twentyDaysAgo = new Date();
    twentyDaysAgo.setUTCDate(currentDate.getUTCDate() - 20);

    // Find all SIM cards where dateCharged is 20+ days old (10 or fewer days remaining in 30-day cooldown)
    const simCards = await SimCard.find({
      dateCharged: { $lte: twentyDaysAgo },
    }).sort({ dateCharged: 1 }); // Sort by oldest first

    if (simCards.length === 0) {
      console.log("[SIM Card Cooldown Check] No SIM cards need attention");
      return { success: true, count: 0 };
    }

    console.log(
      `[SIM Card Cooldown Check] Found ${simCards.length} SIM card(s) needing attention`
    );

    // Get all inventory managers
    const inventoryManagers = await User.find({
      role: "inventory_manager",
      isActive: true,
    });

    if (inventoryManagers.length === 0) {
      console.log(
        "[SIM Card Cooldown Check] No active inventory managers found"
      );
      return {
        success: true,
        count: 0,
        message: "No inventory managers to notify",
      };
    }

    // Group SIM cards by urgency
    const grouped = {
      overdue: [], // 30+ days
      critical: [], // 1-5 days remaining
      warning: [], // 6-10 days remaining
    };

    simCards.forEach((simCard) => {
      // Use UTC dates to avoid timezone issues
      const chargedDate = new Date(simCard.dateCharged);
      const chargedDateUTC = Date.UTC(
        chargedDate.getUTCFullYear(),
        chargedDate.getUTCMonth(),
        chargedDate.getUTCDate()
      );
      const currentDateUTC = Date.UTC(
        currentDate.getUTCFullYear(),
        currentDate.getUTCMonth(),
        currentDate.getUTCDate()
      );
      const daysSinceCharged = Math.floor(
        (currentDateUTC - chargedDateUTC) / (1000 * 60 * 60 * 24)
      );
      const daysRemaining = 30 - daysSinceCharged;

      if (daysRemaining <= 0) {
        grouped.overdue.push({ simCard, daysSinceCharged, daysRemaining });
      } else if (daysRemaining <= 5) {
        grouped.critical.push({ simCard, daysSinceCharged, daysRemaining });
      } else {
        grouped.warning.push({ simCard, daysSinceCharged, daysRemaining });
      }
    });

    // Create notifications for each inventory manager
    let notificationCount = 0;

    // Helper to format SIM list with truncation
    const formatSimList = (items, getLabel) => {
      const MAX_LENGTH = 800; // Leave buffer for prefix/suffix
      let list = "";
      let count = 0;
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const label = getLabel(item);
        
        // If adding this item would exceed limit (plus ", ... and X more")
        if (list.length + label.length > MAX_LENGTH) {
          const remaining = items.length - i;
          list += `, ... and ${remaining} more`;
          break;
        }
        
        list += (i > 0 ? ", " : "") + label;
        count++;
      }
      return list;
    };

    for (const manager of inventoryManagers) {
      // Create separate notifications for each urgency level
      const notifications = [];

      // Overdue SIM cards (highest priority)
      if (grouped.overdue.length > 0) {
        const simCardsList = formatSimList(grouped.overdue, (item) => 
          `${item.simCard.simNumber} (${item.simCard.geo}/${item.simCard.operator}) - ${Math.abs(item.daysRemaining)} days overdue`
        );

        notifications.push({
          recipient: manager._id,
          sender: null, // System notification
          title: `⚠️ ${grouped.overdue.length} SIM Card(s) Overdue for Recharge`,
          message: `The following SIM card(s) have exceeded their 30-day cooldown period: ${simCardsList}. Please recharge immediately.`,
          type: "sim_card_cooldown",
          priority: "urgent",
          actionUrl: "/simcards",
          relatedEntity: {
            type: "SimCard",
          },
          metadata: {
            simCardCount: grouped.overdue.length,
            urgencyLevel: "overdue",
            simCardIds: grouped.overdue.map((item) => item.simCard._id),
          },
        });
      }

      // Critical SIM cards (1-5 days remaining)
      if (grouped.critical.length > 0) {
        const simCardsList = formatSimList(grouped.critical, (item) => 
          `${item.simCard.simNumber} (${item.simCard.geo}/${item.simCard.operator}) - ${item.daysRemaining} day(s) left`
        );

        notifications.push({
          recipient: manager._id,
          sender: null,
          title: `🔴 ${grouped.critical.length} SIM Card(s) Need Urgent Attention`,
          message: `The following SIM card(s) have 5 or fewer days remaining in their cooldown period: ${simCardsList}.`,
          type: "sim_card_cooldown",
          priority: "high",
          actionUrl: "/simcards",
          relatedEntity: {
            type: "SimCard",
          },
          metadata: {
            simCardCount: grouped.critical.length,
            urgencyLevel: "critical",
            simCardIds: grouped.critical.map((item) => item.simCard._id),
          },
        });
      }

      // Warning SIM cards (6-10 days remaining)
      if (grouped.warning.length > 0) {
        const simCardsList = formatSimList(grouped.warning, (item) => 
          `${item.simCard.simNumber} (${item.simCard.geo}/${item.simCard.operator}) - ${item.daysRemaining} day(s) left`
        );

        notifications.push({
          recipient: manager._id,
          sender: null,
          title: `🟡 ${grouped.warning.length} SIM Card(s) Approaching Recharge`,
          message: `The following SIM card(s) have 10 or fewer days remaining in their cooldown period: ${simCardsList}.`,
          type: "sim_card_cooldown",
          priority: "medium",
          actionUrl: "/simcards",
          relatedEntity: {
            type: "SimCard",
          },
          metadata: {
            simCardCount: grouped.warning.length,
            urgencyLevel: "warning",
            simCardIds: grouped.warning.map((item) => item.simCard._id),
          },
        });
      }

      // Create all notifications
      for (const notificationData of notifications) {
        const notification = await Notification.create(notificationData);
        notificationCount++;

        // Emit real-time notification if socket.io is available
        if (io) {
          const unreadCount = await Notification.getUnreadCount(manager._id);
          const populatedNotification = await Notification.findById(
            notification._id
          ).populate("recipient", "fullName email role");

          io.to(`user:${manager._id}`).emit("new_notification", {
            notification: populatedNotification,
            unreadCount,
          });
        }
      }
    }

    console.log(
      `[SIM Card Cooldown Check] Created ${notificationCount} notification(s) for ${inventoryManagers.length} inventory manager(s)`
    );

    return {
      success: true,
      count: notificationCount,
      simCardsChecked: simCards.length,
      inventoryManagers: inventoryManagers.length,
      breakdown: {
        overdue: grouped.overdue.length,
        critical: grouped.critical.length,
        warning: grouped.warning.length,
      },
    };
  } catch (error) {
    console.error("[SIM Card Cooldown Check] Error:", error);
    throw error;
  }
};
