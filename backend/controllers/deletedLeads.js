const DeletedLead = require("../models/DeletedLead");
const Lead = require("../models/Lead");

/**
 * @desc    Get all deleted leads with filtering, search, and pagination
 * @route   GET /api/deleted-leads
 * @access  Admin
 */
exports.getDeletedLeads = async (req, res, next) => {
  try {
    const {
      search,
      deletedBy,
      startDate,
      endDate,
      leadType,
      migrationRecovered,
      page = 1,
      limit = 50,
    } = req.query;

    // Build filter
    const filter = {};

    // Search by name, email, or phone
    if (search) {
      filter.$or = [
        { "searchFields.firstName": new RegExp(search, "i") },
        { "searchFields.lastName": new RegExp(search, "i") },
        { "searchFields.email": new RegExp(search, "i") },
        { "searchFields.phone": new RegExp(search, "i") },
      ];
    }

    // Filter by who deleted
    if (deletedBy) {
      filter.deletedBy = deletedBy;
    }

    // Filter by date range
    if (startDate || endDate) {
      filter.deletedAt = {};
      if (startDate) filter.deletedAt.$gte = new Date(startDate);
      if (endDate) filter.deletedAt.$lte = new Date(endDate);
    }

    // Filter by lead type
    if (leadType) {
      filter["leadData.leadType"] = leadType;
    }

    // Filter by migration recovered
    if (migrationRecovered !== undefined) {
      filter.migrationRecovered = migrationRecovered === "true";
    }

    // Count total
    const total = await DeletedLead.countDocuments(filter);

    // Get paginated results
    const deletedLeads = await DeletedLead.find(filter)
      .populate("deletedBy", "fullName email role")
      .populate("restoredBy", "fullName email role")
      .sort({ deletedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    res.status(200).json({
      success: true,
      count: deletedLeads.length,
      total: total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: deletedLeads,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single deleted lead by ID
 * @route   GET /api/deleted-leads/:id
 * @access  Admin
 */
exports.getDeletedLeadById = async (req, res, next) => {
  try {
    const deletedLead = await DeletedLead.findById(req.params.id)
      .populate("deletedBy", "fullName email role")
      .populate("restoredBy", "fullName email role")
      .populate("orderReferences.orderId", "createdAt status requests fulfilled")
      .lean();

    if (!deletedLead) {
      return res.status(404).json({
        success: false,
        message: "Deleted lead not found",
      });
    }

    res.status(200).json({
      success: true,
      data: deletedLead,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get deleted leads for a specific order
 * @route   GET /api/deleted-leads/order/:orderId
 * @access  Admin
 */
exports.getDeletedLeadsForOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const deletedLeads = await DeletedLead.find({
      "orderReferences.orderId": orderId,
    })
      .populate("deletedBy", "fullName email role")
      .sort({ deletedAt: -1 })
      .lean();

    // Extract the orderedAs info for this specific order
    const leadsWithOrderInfo = deletedLeads.map((dl) => {
      const orderRef = dl.orderReferences.find(
        (ref) => ref.orderId && ref.orderId.toString() === orderId
      );
      return {
        ...dl,
        orderedAs: orderRef?.orderedAs || null,
        orderCreatedAt: orderRef?.orderCreatedAt || null,
      };
    });

    res.status(200).json({
      success: true,
      count: leadsWithOrderInfo.length,
      data: leadsWithOrderInfo,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Restore a deleted lead
 * @route   POST /api/deleted-leads/:id/restore
 * @access  Admin
 */
exports.restoreDeletedLead = async (req, res, next) => {
  try {
    const deletedLead = await DeletedLead.findById(req.params.id);

    if (!deletedLead) {
      return res.status(404).json({
        success: false,
        message: "Deleted lead not found",
      });
    }

    // Check if lead with this ID already exists (in case of double restoration)
    const existingLead = await Lead.findById(
      deletedLead.searchFields.originalLeadId
    );

    if (existingLead) {
      return res.status(400).json({
        success: false,
        message: "Lead already exists in the database. Cannot restore duplicate.",
      });
    }

    // Restore the lead with original timestamps
    const restoredLead = new Lead({
      ...deletedLead.leadData,
      _id: deletedLead.searchFields.originalLeadId, // Restore original ID
      restoredAt: new Date(), // Add restoration timestamp
      restoredBy: req.user.id,
    });

    await restoredLead.save();

    // Update the deletedLead record to track restoration
    deletedLead.restoredAt = new Date();
    deletedLead.restoredBy = req.user.id;
    deletedLead.restorationCount += 1;
    await deletedLead.save();

    res.status(200).json({
      success: true,
      message: "Lead restored successfully",
      data: {
        leadId: restoredLead._id,
        restoredAt: deletedLead.restoredAt,
        restoredBy: req.user.id,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Permanently delete a deleted lead
 * @route   DELETE /api/deleted-leads/:id
 * @access  Admin
 */
exports.permanentlyDeleteDeletedLead = async (req, res, next) => {
  try {
    const deletedLead = await DeletedLead.findById(req.params.id);

    if (!deletedLead) {
      return res.status(404).json({
        success: false,
        message: "Deleted lead not found",
      });
    }

    // Permanently delete from DeletedLeads collection
    await deletedLead.deleteOne();

    res.status(200).json({
      success: true,
      message: "Deleted lead permanently removed",
      data: {
        deletedLeadId: req.params.id,
        originalLeadId: deletedLead.searchFields.originalLeadId,
      },
    });
  } catch (error) {
    next(error);
  }
};
