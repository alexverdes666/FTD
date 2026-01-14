const IncomingSMS = require("../models/IncomingSMS");
const GatewayDevice = require("../models/GatewayDevice");
const SimCard = require("../models/SimCard");
const GoIPGatewayService = require("../services/goipGatewayService");
const axios = require("axios");

/**
 * Get all incoming SMS messages with pagination and filtering
 */
exports.getSMSMessages = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = {};

    // Phone number search (searches both sender and recipient)
    if (req.query.phone) {
      const phoneRegex = new RegExp(req.query.phone, "i");
      filter.$or = [{ sender: phoneRegex }, { recipient: phoneRegex }];
    }

    // SIM card filter
    if (req.query.simCard) {
      filter.simCard = req.query.simCard;
    }

    // Date range filter
    if (req.query.dateFrom || req.query.dateTo) {
      filter.timestamp = {};
      if (req.query.dateFrom) {
        filter.timestamp.$gte = new Date(req.query.dateFrom);
      }
      if (req.query.dateTo) {
        // Set to end of day
        const endDate = new Date(req.query.dateTo);
        endDate.setHours(23, 59, 59, 999);
        filter.timestamp.$lte = endDate;
      }
    }

    const smsMessages = await IncomingSMS.find(filter)
      .populate("simCard", "simNumber geo operator")
      .populate("gatewayDevice", "name")
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    const total = await IncomingSMS.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: smsMessages,
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

/**
 * Fetch SMS messages from a gateway device and store them in the database
 */
exports.fetchFromGateway = async (req, res, next) => {
  try {
    const { gatewayId } = req.params;
    const { startId = 1, count = 0 } = req.query;

    // Find the gateway device
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
        message: "Gateway is not active",
      });
    }

    // Create gateway service instance
    const gatewayService = GoIPGatewayService.createInstance({
      host: gateway.host,
      port: gateway.port,
      username: gateway.username,
      password: gateway.password,
      name: gateway.name,
      _id: gateway._id,
    });

    // Fetch SMS using the GoIP API
    let response;
    try {
      response = await gatewayService.queryReceivedSMS({
        smsId: parseInt(startId),
        smsNum: parseInt(count),
        smsDel: false, // Don't delete after reading
      });
    } catch (error) {
      return res.status(503).json({
        success: false,
        message: "Failed to connect to gateway",
        error: error.message,
      });
    }

    const data = response.data;

    // Log raw response for debugging
    console.log("Gateway SMS response:", JSON.stringify(data).substring(0, 500));

    // GoIP response format: check if we have SMS data
    // The response might be in different formats depending on gateway version
    if (!data) {
      return res.status(200).json({
        success: true,
        message: "No SMS messages found on gateway",
        data: {
          fetched: 0,
          saved: 0,
          duplicates: 0,
        },
      });
    }

    // Get all SIM cards associated with this gateway for mapping
    const simCards = await SimCard.find({
      "gateway.gatewayId": gateway._id,
      "gateway.enabled": true,
    });

    // Create a map of port -> simCard for quick lookup
    const portToSimCard = {};
    simCards.forEach((sim) => {
      if (sim.gateway?.port) {
        portToSimCard[sim.gateway.port] = sim._id;
      }
    });

    let savedCount = 0;
    let duplicateCount = 0;
    let fetchedCount = 0;

    // Parse GoIP response - format varies by version
    // Try to extract SMS array from various possible formats
    let smsArray = [];
    if (Array.isArray(data)) {
      smsArray = data;
    } else if (data.smses && Array.isArray(data.smses)) {
      smsArray = data.smses;
    } else if (data.sms && Array.isArray(data.sms)) {
      smsArray = data.sms;
    } else if (typeof data === "string") {
      // GoIP sometimes returns semicolon-delimited text format
      // Format: port;slot;timestamp;sender;content;...
      const lines = data.split("\n").filter((line) => line.trim());
      for (const line of lines) {
        const parts = line.split(";");
        if (parts.length >= 5) {
          smsArray.push({
            port: parts[0],
            slot: parts[1],
            timestamp: parts[2],
            from: parts[3],
            content: parts[4],
          });
        }
      }
    }

    fetchedCount = smsArray.length;

    if (smsArray.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No SMS messages found on gateway",
        data: {
          fetched: 0,
          saved: 0,
          duplicates: 0,
          rawResponse: typeof data === "string" ? data.substring(0, 200) : JSON.stringify(data).substring(0, 200),
        },
      });
    }

    // Process each SMS message
    for (const sms of smsArray) {
      // Get content - handle different field names and encodings
      let content = sms.content || sms.sms || sms.message || "";

      // Try to decode if it looks like BASE64
      if (content && /^[A-Za-z0-9+/=]+$/.test(content) && content.length > 20) {
        try {
          const decoded = Buffer.from(content, "base64").toString("utf-8");
          if (decoded && !decoded.includes("\ufffd")) {
            content = decoded;
          }
        } catch (e) {
          // Keep original content
        }
      }

      // Parse timestamp
      let timestamp;
      const tsValue = sms.timestamp || sms.time || sms.date;
      try {
        timestamp = new Date(tsValue);
        if (isNaN(timestamp.getTime())) {
          timestamp = new Date();
        }
      } catch (e) {
        timestamp = new Date();
      }

      // Get sender
      const sender = sms.from || sms.sender || sms.src || "";
      const recipient = sms.to || sms.recipient || sms.dst || "";
      const port = sms.port?.toString() || "";

      // Skip if no sender or content
      if (!sender || !content) {
        continue;
      }

      // Find matching SIM card by port
      const simCardId = portToSimCard[port] || null;

      // Check for duplicate (same sender, content, timestamp within 1 minute)
      const duplicateCheck = await IncomingSMS.findOne({
        sender: sender,
        content: content,
        gatewayDevice: gateway._id,
        timestamp: {
          $gte: new Date(timestamp.getTime() - 60000),
          $lte: new Date(timestamp.getTime() + 60000),
        },
      });

      if (duplicateCheck) {
        duplicateCount++;
        continue;
      }

      // Create the SMS record
      await IncomingSMS.create({
        timestamp,
        sender,
        recipient,
        content,
        port,
        simCard: simCardId,
        gatewayDevice: gateway._id,
      });

      savedCount++;
    }

    res.status(200).json({
      success: true,
      message: `Fetched ${fetchedCount} SMS, saved ${savedCount} new messages`,
      data: {
        fetched: fetchedCount,
        saved: savedCount,
        duplicates: duplicateCount,
      },
    });
  } catch (error) {
    next(error);
  }
};
