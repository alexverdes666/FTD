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

    // Create a map of port.slot -> simCard for quick lookup
    const portSlotToSimCard = {};
    simCards.forEach((sim) => {
      if (sim.gateway?.port) {
        // Key format: "port.slot" e.g., "23.1"
        const key = `${sim.gateway.port}.${sim.gateway.slot || 1}`;
        portSlotToSimCard[key] = sim;
      }
    });

    let savedCount = 0;
    let duplicateCount = 0;
    let fetchedCount = 0;

    // Parse GoIP response - format: { code, reason, ssrc, sms_num, next_sms, data: [[port, slot, timestamp, sender, recipient, base64_content], ...] }
    let smsArray = [];

    if (data.data && Array.isArray(data.data)) {
      // GoIP format: data is array of arrays [status, port.slot, timestamp, sender, recipient, base64_content]
      // port.slot is like "23.01" meaning port 23, slot 1
      for (const item of data.data) {
        if (Array.isArray(item) && item.length >= 6) {
          // Parse port.slot format (e.g., "23.01" -> port: 23, slot: 1)
          let port = "";
          let slot = "";
          const portSlot = item[1]?.toString() || "";
          if (portSlot.includes(".")) {
            const parts = portSlot.split(".");
            port = parts[0];
            slot = parts[1];
          } else {
            port = portSlot;
          }

          smsArray.push({
            status: item[0], // 0 = received
            port: port,
            slot: slot,
            timestamp: item[2], // Unix timestamp
            sender: item[3],
            recipient: item[4],
            content: item[5], // BASE64 encoded
          });
        }
      }
    } else if (Array.isArray(data)) {
      smsArray = data;
    } else if (data.smses && Array.isArray(data.smses)) {
      smsArray = data.smses;
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
      // Get content and decode from BASE64
      let content = sms.content || sms.sms || sms.message || "";

      // Decode BASE64 content
      if (content) {
        try {
          const decoded = Buffer.from(content, "base64").toString("utf-8");
          if (decoded) {
            content = decoded;
          }
        } catch (e) {
          // Keep original content if decoding fails
        }
      }

      // Parse timestamp (Unix timestamp in seconds)
      let timestamp;
      const tsValue = sms.timestamp || sms.time || sms.date;
      try {
        // Check if it's a Unix timestamp (number)
        if (typeof tsValue === "number") {
          timestamp = new Date(tsValue * 1000); // Convert seconds to milliseconds
        } else {
          timestamp = new Date(tsValue);
        }
        if (isNaN(timestamp.getTime())) {
          timestamp = new Date();
        }
      } catch (e) {
        timestamp = new Date();
      }

      // Get sender
      const sender = sms.sender || sms.from || sms.src || "";
      const port = sms.port?.toString() || "";
      const slot = sms.slot?.toString() || "1";

      // Skip if no sender or content
      if (!sender || !content) {
        continue;
      }

      // Find matching SIM card by port.slot
      const portSlotKey = `${port}.${parseInt(slot) || 1}`;
      const matchedSimCard = portSlotToSimCard[portSlotKey] || null;
      const simCardId = matchedSimCard?._id || null;

      // Set recipient to the SIM card's number if found
      const recipient = matchedSimCard?.simNumber || sms.recipient || sms.to || "";

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
        slot,
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
        nextSmsId: data.next_sms,
        totalOnGateway: data.sms_num,
      },
    });
  } catch (error) {
    next(error);
  }
};
