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

    // Search across sender, recipient, and content
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, "i");
      filter.$or = [
        { sender: searchRegex },
        { recipient: searchRegex },
        { content: searchRegex },
      ];
    }

    // Gateway device filter
    if (req.query.gatewayDevice) {
      filter.gatewayDevice = req.query.gatewayDevice;
    }

    // Port filter
    if (req.query.port) {
      filter.port = req.query.port;
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

    // Sort option
    const sortField = req.query.sortBy || 'timestamp';
    const sortDir = req.query.sortDir === 'asc' ? 1 : -1;
    const allowedSortFields = ['timestamp', 'port', 'sender', 'recipient'];
    const sort = { [allowedSortFields.includes(sortField) ? sortField : 'timestamp']: sortDir };

    const smsMessages = await IncomingSMS.find(filter)
      .populate("simCard", "simNumber geo operator")
      .populate("gatewayDevice", "name")
      .sort(sort)
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
 * Parse raw GoIP SMS response data into a normalized array
 */
function parseGoIPSmsData(data) {
  const smsArray = [];

  if (data.data && Array.isArray(data.data)) {
    for (const item of data.data) {
      if (Array.isArray(item) && item.length >= 6) {
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
          status: item[0],
          port: port,
          slot: slot,
          timestamp: item[2],
          sender: item[3],
          recipient: item[4],
          content: item[5],
        });
      }
    }
  } else if (Array.isArray(data)) {
    smsArray.push(...data);
  } else if (data.smses && Array.isArray(data.smses)) {
    smsArray.push(...data.smses);
  }

  return smsArray;
}

/**
 * Parse a single raw SMS item into a normalized object with decoded content
 */
function parseSmsItem(sms, portSlotToSimCard, portNumbersMap, gatewayId) {
  let content = sms.content || sms.sms || sms.message || "";

  if (content) {
    try {
      const decoded = Buffer.from(content, "base64").toString("utf-8");
      if (decoded) content = decoded;
    } catch (e) {
      // Keep original content if decoding fails
    }
  }

  let timestamp;
  const tsValue = sms.timestamp || sms.time || sms.date;
  try {
    if (typeof tsValue === "number") {
      timestamp = new Date(tsValue * 1000);
    } else {
      timestamp = new Date(tsValue);
    }
    if (isNaN(timestamp.getTime())) timestamp = new Date();
  } catch (e) {
    timestamp = new Date();
  }

  const sender = sms.sender || sms.from || sms.src || "";
  const port = sms.port?.toString() || "";
  const slot = sms.slot?.toString() || "1";

  if (!sender || !content) return null;

  const portSlotKey = `${port}.${parseInt(slot) || 1}`;
  const matchedSimCard = portSlotToSimCard[portSlotKey] || null;

  return {
    timestamp,
    sender,
    recipient: matchedSimCard?.simNumber || portNumbersMap[port] || sms.recipient || sms.to || "",
    content,
    port,
    slot,
    simCard: matchedSimCard?._id || null,
    gatewayDevice: gatewayId,
  };
}

/**
 * Fetch SMS messages from a gateway device and store them in the database.
 * Fetches in batches to avoid timeout on gateways with many messages.
 * Uses bulk DB operations for performance.
 */
exports.fetchFromGateway = async (req, res, next) => {
  try {
    const { gatewayId } = req.params;
    const { startId = 1 } = req.query;
    const BATCH_SIZE = 50;

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

    const gatewayService = GoIPGatewayService.createInstance({
      host: gateway.host,
      port: gateway.port,
      username: gateway.username,
      password: gateway.password,
      name: gateway.name,
      _id: gateway._id,
    });

    // Get all SIM cards associated with this gateway for mapping
    const simCards = await SimCard.find({
      "gateway.gatewayId": gateway._id,
      "gateway.enabled": true,
    });

    const portSlotToSimCard = {};
    simCards.forEach((sim) => {
      if (sim.gateway?.port) {
        const key = `${sim.gateway.port}.${sim.gateway.slot || 1}`;
        portSlotToSimCard[key] = sim;
      }
    });

    // Build port-to-number map from gateway's manual portNumbers
    const portNumbersMap = {};
    if (gateway.portNumbers) {
      for (const [k, v] of gateway.portNumbers) {
        portNumbersMap[k] = v;
      }
    }

    let savedCount = 0;
    let duplicateCount = 0;
    let fetchedCount = 0;
    let currentSmsId = parseInt(startId);
    let totalOnGateway = null;
    let batchCount = 0;
    const MAX_BATCHES = 100;

    // Fetch in batches
    while (batchCount < MAX_BATCHES) {
      batchCount++;
      let response;
      try {
        response = await gatewayService.queryReceivedSMS({
          smsId: currentSmsId,
          smsNum: BATCH_SIZE,
          smsDel: false,
        });
      } catch (error) {
        if (fetchedCount === 0) {
          return res.status(503).json({
            success: false,
            message: "Failed to connect to gateway",
            error: error.message,
          });
        }
        console.error(`Gateway batch fetch error at sms_id ${currentSmsId}:`, error.message);
        break;
      }

      const data = response.data;
      if (!data) break;

      if (totalOnGateway === null && data.sms_num !== undefined) {
        totalOnGateway = data.sms_num;
      }

      const smsArray = parseGoIPSmsData(data);
      if (smsArray.length === 0) break;

      fetchedCount += smsArray.length;

      // Parse all SMS in this batch
      const parsed = smsArray
        .map((sms) => parseSmsItem(sms, portSlotToSimCard, portNumbersMap, gateway._id))
        .filter(Boolean);

      if (parsed.length > 0) {
        // Bulk duplicate check: find any existing SMS from this gateway
        // that match any sender+content combo within timestamp range
        const orConditions = parsed.map((sms) => ({
          sender: sms.sender,
          content: sms.content,
          gatewayDevice: gateway._id,
          timestamp: {
            $gte: new Date(sms.timestamp.getTime() - 60000),
            $lte: new Date(sms.timestamp.getTime() + 60000),
          },
        }));

        const existingDups = await IncomingSMS.find(
          { $or: orConditions },
          { sender: 1, content: 1, timestamp: 1 }
        ).lean();

        // Build a set of duplicate keys for fast lookup
        const dupKeys = new Set();
        for (const dup of existingDups) {
          dupKeys.add(`${dup.sender}|${dup.content}`);
        }

        // Filter out duplicates
        const toInsert = [];
        for (const sms of parsed) {
          const key = `${sms.sender}|${sms.content}`;
          if (dupKeys.has(key)) {
            duplicateCount++;
          } else {
            toInsert.push(sms);
            dupKeys.add(key); // Prevent dupes within same batch
          }
        }

        // Bulk insert
        if (toInsert.length > 0) {
          const inserted = await IncomingSMS.insertMany(toInsert, { ordered: false });
          savedCount += inserted.length;

          // Emit real-time events for this batch
          if (req.io) {
            const ids = inserted.map((doc) => doc._id);
            const populated = await IncomingSMS.find({ _id: { $in: ids } })
              .populate("simCard", "simNumber geo operator")
              .populate("gatewayDevice", "name")
              .lean();
            for (const sms of populated) {
              req.io.emit("new_sms", { sms });
            }
          }
        }
      }

      // Check if there are more SMS to fetch
      const nextSmsId = data.next_sms;
      if (!nextSmsId || nextSmsId <= currentSmsId) break;
      currentSmsId = nextSmsId;
    }

    res.status(200).json({
      success: true,
      message: `Fetched ${fetchedCount} SMS, saved ${savedCount} new messages`,
      data: {
        fetched: fetchedCount,
        saved: savedCount,
        duplicates: duplicateCount,
        nextSmsId: currentSmsId,
        totalOnGateway: totalOnGateway,
        batches: batchCount,
      },
    });
  } catch (error) {
    next(error);
  }
};
