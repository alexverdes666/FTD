const express = require("express");
const router = express.Router();
const Injection = require("../models/Injection");
const Lead = require("../models/Lead");
const { protect, isManager, authorize } = require("../middleware/auth");

// POST /api/injections - Create injection(s)
// Admin and affiliate_manager only
router.post("/", protect, isManager, async (req, res) => {
  try {
    const { leadIds, orderId, injectionType, coldAgentMap, workingHours } = req.body;

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ success: false, message: "leadIds array is required" });
    }

    if (!["self", "agent"].includes(injectionType)) {
      return res.status(400).json({ success: false, message: "injectionType must be 'self' or 'agent'" });
    }

    if (injectionType === "self" && leadIds.length > 1) {
      return res.status(400).json({ success: false, message: "Self injection allows only one lead" });
    }

    const injections = [];

    for (const leadId of leadIds) {
      const lead = await Lead.findById(leadId);
      if (!lead) continue;

      // Skip if this lead already has an active (non-approved) injection for this order
      if (orderId) {
        const existing = await Injection.findOne({
          leadId,
          orderId,
          status: { $in: ["pending", "injected", "rejected"] },
        });
        if (existing) continue;
      }

      // For agent injection: use the lead's assigned agent for FTD/filler,
      // use the manually picked agent from coldAgentMap for colds
      let assignedTo = null;
      if (injectionType === "agent") {
        if (lead.leadType === "cold" && coldAgentMap && coldAgentMap[leadId]) {
          assignedTo = coldAgentMap[leadId];
        } else {
          assignedTo = lead.assignedAgent;
        }
      }

      const injection = await Injection.create({
        leadId,
        orderId: orderId || null,
        assignedBy: req.user._id,
        assignedTo,
        injectionType,
        workingHours: injectionType === "agent" ? (workingHours || null) : null,
        status: "pending",
        statusHistory: [
          {
            status: "pending",
            changedBy: req.user._id,
            changedAt: new Date(),
          },
        ],
      });

      injections.push(injection);
    }

    res.status(201).json({ success: true, data: injections });
  } catch (error) {
    console.error("Error creating injections:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /api/injections - Get injections based on role
// Agents see their own, AMs see ones they assigned, admins see all
router.get("/", protect, async (req, res) => {
  try {
    const { status, orderId, page = 1, limit = 50 } = req.query;
    const query = {};

    if (req.user.role === "agent") {
      query.assignedTo = req.user._id;
    } else if (req.user.role === "affiliate_manager") {
      query.assignedBy = req.user._id;
    }
    // admin sees all

    if (status) {
      query.status = status;
    }

    if (orderId) {
      query.orderId = orderId;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [injections, total] = await Promise.all([
      Injection.find(query)
        .populate("leadId", "firstName lastName newEmail newPhone country leadType assignedAgent documents")
        .populate("assignedBy", "fullName role")
        .populate("assignedTo", "fullName role")
        .populate("orderId", "plannedDate")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Injection.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: injections,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error("Error fetching injections:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /api/injections/by-order/:orderId - Lightweight lookup for leads preview
// Returns a map of leadId -> latest injection status
router.get("/by-order/:orderId", protect, async (req, res) => {
  try {
    const injections = await Injection.find({ orderId: req.params.orderId })
      .select("leadId status")
      .sort({ createdAt: -1 })
      .lean();

    // Build a map: leadId -> status (latest injection per lead)
    const statusMap = {};
    for (const inj of injections) {
      const lid = inj.leadId.toString();
      if (!statusMap[lid]) {
        statusMap[lid] = inj.status;
      }
    }

    res.json({ success: true, data: statusMap });
  } catch (error) {
    console.error("Error fetching injection statuses:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// PATCH /api/injections/:id/status - Update injection status
router.patch("/:id/status", protect, async (req, res) => {
  try {
    const { status, note } = req.body;
    const injection = await Injection.findById(req.params.id);

    if (!injection) {
      return res.status(404).json({ success: false, message: "Injection not found" });
    }

    const userRole = req.user.role;
    const userId = req.user._id.toString();

    // Validate transitions
    if (status === "injected") {
      // Agent marks as injected (or AM for self-injection)
      if (injection.injectionType === "agent") {
        if (userRole === "agent" && injection.assignedTo?.toString() !== userId) {
          return res.status(403).json({ success: false, message: "Not authorized" });
        }
        if (!["pending", "rejected"].includes(injection.status)) {
          return res.status(400).json({ success: false, message: "Can only mark as injected from pending or rejected status" });
        }
      } else {
        // Self injection - only the AM who created it
        if (injection.assignedBy.toString() !== userId && userRole !== "admin") {
          return res.status(403).json({ success: false, message: "Not authorized" });
        }
      }
    } else if (status === "approved" || status === "rejected") {
      // Only the AM who assigned it or admin can approve/reject
      if (injection.assignedBy.toString() !== userId && userRole !== "admin") {
        return res.status(403).json({ success: false, message: "Only the assigning manager can approve/reject" });
      }
      if (injection.status !== "injected") {
        return res.status(400).json({ success: false, message: "Can only approve/reject injected items" });
      }
    } else {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    injection.status = status;
    injection.statusHistory.push({
      status,
      changedBy: req.user._id,
      changedAt: new Date(),
      note: note || undefined,
    });

    await injection.save();

    // Re-populate for response
    await injection.populate("leadId", "firstName lastName newEmail newPhone country leadType assignedAgent documents");
    await injection.populate("assignedBy", "fullName role");
    await injection.populate("assignedTo", "fullName role");
    await injection.populate("orderId", "plannedDate");

    res.json({ success: true, data: injection });
  } catch (error) {
    console.error("Error updating injection status:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
