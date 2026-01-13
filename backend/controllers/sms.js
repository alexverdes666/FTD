const IncomingSMS = require("../models/IncomingSMS");

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
