const IncomingSMS = require("../models/IncomingSMS");
const GatewayDevice = require("../models/GatewayDevice");
const SimCard = require("../models/SimCard");
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

    // Fetch SMS from the gateway using Ejoin API
    const gatewayUrl = `http://${gateway.host}:${gateway.port}/get_received_smses`;

    let response;
    try {
      response = await axios.get(gatewayUrl, {
        params: {
          username: gateway.username,
          password: gateway.password,
          id: parseInt(startId),
          num: parseInt(count),
        },
        timeout: 30000,
      });
    } catch (error) {
      return res.status(503).json({
        success: false,
        message: "Failed to connect to gateway",
        error: error.message,
      });
    }

    const data = response.data;
    if (!data || !Array.isArray(data.smses)) {
      return res.status(200).json({
        success: true,
        message: "No SMS messages found on gateway",
        data: {
          fetched: 0,
          saved: 0,
          duplicates: 0,
          nextId: data?.next_id || startId,
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

    // Process each SMS message
    for (const sms of data.smses) {
      // Skip delivery reports
      if (sms.is_report) {
        continue;
      }

      // Decode BASE64 content
      let content = "";
      try {
        content = Buffer.from(sms.sms, "base64").toString("utf-8");
      } catch (e) {
        content = sms.sms; // Use as-is if decoding fails
      }

      // Parse timestamp
      let timestamp;
      try {
        timestamp = new Date(sms.timestamp);
        if (isNaN(timestamp.getTime())) {
          timestamp = new Date();
        }
      } catch (e) {
        timestamp = new Date();
      }

      // Find matching SIM card by port
      const simCardId = portToSimCard[sms.port] || null;

      // Check for duplicate (same sender, content, timestamp within 1 minute)
      const duplicateCheck = await IncomingSMS.findOne({
        sender: sms.from,
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
        sender: sms.from,
        recipient: sms.to,
        content,
        port: sms.port?.toString(),
        simCard: simCardId,
        gatewayDevice: gateway._id,
      });

      savedCount++;
    }

    res.status(200).json({
      success: true,
      message: `Fetched ${data.smses.length} SMS, saved ${savedCount} new messages`,
      data: {
        fetched: data.smses.length,
        saved: savedCount,
        duplicates: duplicateCount,
        nextId: data.next_id,
        ssrc: data.ssrc,
      },
    });
  } catch (error) {
    next(error);
  }
};
