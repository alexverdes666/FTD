const mongoose = require("mongoose");
const Lead = require("../models/Lead");
const User = require("../models/User");
const ClientBroker = require("../models/ClientBroker");

/**
 * LeadService - Business logic for lead operations
 * Extracted from controllers to improve maintainability and testability
 */
class LeadService {
  /**
   * Assign leads to an agent
   * @param {Array<string>} leadIds - Array of lead IDs to assign
   * @param {string} agentId - Agent ID to assign leads to
   * @param {Object} user - Current user making the request (for access control)
   * @returns {Promise<Object>} Assignment result with count and agent info
   */
  static async assignLeadsToAgent(leadIds, agentId, user) {
    // Verify agent exists and is valid
    const agent = await User.findById(agentId);
    if (
      !agent ||
      agent.role !== "agent" ||
      !agent.isActive ||
      agent.status !== "approved"
    ) {
      throw new Error("Invalid or inactive/unapproved agent selected.");
    }

    // Check if any of the leads are cold leads (cold leads cannot be assigned)
    const leadsToCheck = await Lead.find({ _id: { $in: leadIds } });
    const coldLeads = leadsToCheck.filter((lead) => lead.leadType === "cold");
    if (coldLeads.length > 0) {
      throw new Error(
        "Cold leads cannot be assigned to agents. Only FTD and Filler leads can be assigned."
      );
    }

    let updateCondition = {
      _id: { $in: leadIds },
      leadType: { $in: ["ftd", "filler"] }, // Only allow FTD and Filler to be assigned
    };

    // For affiliate managers, ensure they can only assign leads from their orders
    if (user.role === "affiliate_manager") {
      const accessibleLeadIds = await this._getAccessibleLeadIds(
        leadIds,
        user.id
      );
      updateCondition._id = { $in: accessibleLeadIds };

      if (accessibleLeadIds.length !== leadIds.length) {
        throw new Error(
          "Access denied. You can only assign leads from your orders."
        );
      }
    }

    console.log("Assigning leads with:", {
      updateCondition,
      agentId,
      agentName: agent.fullName,
      agentCode: agent.fourDigitCode,
    });

    const result = await Lead.updateMany(updateCondition, {
      $set: {
        assignedAgent: agentId,
        assignedAgentAt: new Date(),
      },
    });

    console.log("Assignment result:", result);

    // Verify assignment
    const verifyLeads = await Lead.find({ _id: { $in: leadIds } })
      .populate("assignedAgent", "fullName fourDigitCode email")
      .limit(3);

    console.log(
      "Verification - First few assigned leads:",
      verifyLeads.map((lead) => ({
        id: lead._id,
        assignedAgent: lead.assignedAgent
          ? {
              id: lead.assignedAgent._id,
              fullName: lead.assignedAgent.fullName,
              fourDigitCode: lead.assignedAgent.fourDigitCode,
            }
          : null,
      }))
    );

    return {
      assignedCount: result.modifiedCount,
      agentName: agent.fullName,
      agentCode: agent.fourDigitCode,
      agentId: agent._id,
    };
  }

  /**
   * Unassign leads from agents
   * @param {Array<string>} leadIds - Array of lead IDs to unassign
   * @param {Object} user - Current user making the request (for access control)
   * @returns {Promise<Object>} Unassignment result with count
   */
  static async unassignLeads(leadIds, user) {
    let updateCondition = {
      _id: { $in: leadIds },
      assignedAgent: { $ne: null },
    };

    // For affiliate managers, ensure they can only unassign leads from their orders
    if (user.role === "affiliate_manager") {
      const accessibleLeadIds = await this._getAccessibleLeadIds(
        leadIds,
        user.id
      );
      updateCondition._id = { $in: accessibleLeadIds };

      if (accessibleLeadIds.length !== leadIds.length) {
        throw new Error(
          "Access denied. You can only unassign leads from your orders."
        );
      }
    }

    const result = await Lead.updateMany(updateCondition, {
      $set: {
        assignedAgent: null,
        assignedAgentAt: null,
      },
    });

    return {
      unassignedCount: result.modifiedCount,
    };
  }

  /**
   * Assign a client broker to a lead
   * @param {string} leadId - Lead ID
   * @param {string} clientBrokerId - Client broker ID
   * @param {string} assignedBy - User ID who is making the assignment
   * @param {string} orderId - Optional order ID
   * @param {string} intermediaryClientNetwork - Optional intermediary network ID
   * @param {string} domain - Optional domain
   * @param {string} campaign - Optional campaign
   * @returns {Promise<Object>} Updated lead with populated fields
   */
  static async assignClientBrokerToLead(
    leadId,
    clientBrokerId,
    assignedBy,
    orderId = null,
    intermediaryClientNetwork = null,
    domain = null,
    campaign = null
  ) {
    const [lead, clientBroker] = await Promise.all([
      Lead.findById(leadId),
      ClientBroker.findById(clientBrokerId),
    ]);

    if (!lead) {
      throw new Error("Lead not found");
    }

    if (!clientBroker) {
      throw new Error("Client broker not found");
    }

    if (!clientBroker.isActive) {
      throw new Error("Cannot assign lead to inactive client broker");
    }

    if (lead.isAssignedToClientBroker(clientBrokerId)) {
      throw new Error(
        `Lead "${lead.firstName} ${lead.lastName}" is already assigned to client broker "${clientBroker.name}".`
      );
    }

    const finalOrderId = orderId || lead.orderId || null;
    lead.assignClientBroker(
      clientBrokerId,
      assignedBy,
      finalOrderId,
      intermediaryClientNetwork,
      domain
    );

    if (campaign !== undefined) {
      lead.campaign = campaign;
    }

    clientBroker.assignLead(leadId);

    await Promise.all([lead.save(), clientBroker.save()]);

    const updatedLead = await Lead.findById(leadId)
      .populate("assignedAgent", "fullName fourDigitCode email")
      .populate("assignedClientBrokers", "name domain");

    return updatedLead;
  }

  /**
   * Update lead status
   * @param {string} leadId - Lead ID
   * @param {string} status - New status (active, contacted, converted, inactive)
   * @returns {Promise<Object>} Updated lead
   */
  static async updateLeadStatus(leadId, status) {
    const validStatuses = ["active", "contacted", "converted", "inactive"];
    if (!validStatuses.includes(status)) {
      throw new Error(
        `Invalid status. Must be one of: ${validStatuses.join(", ")}`
      );
    }

    const lead = await Lead.findById(leadId);
    if (!lead) {
      throw new Error("Lead not found");
    }

    lead.status = status;
    await lead.save();

    return lead;
  }

  /**
   * Get accessible lead IDs for affiliate managers (leads from their orders)
   * @private
   * @param {Array<string>} leadIds - Lead IDs to check
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of accessible lead IDs
   */
  static async _getAccessibleLeadIds(leadIds, userId) {
    const accessibleLeads = await Lead.aggregate([
      {
        $match: {
          _id: { $in: leadIds.map((id) => new mongoose.Types.ObjectId(id)) },
        },
      },
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "orderDetails",
        },
      },
      {
        $addFields: {
          order: { $arrayElemAt: ["$orderDetails", 0] },
        },
      },
      {
        $match: {
          $or: [
            { "order.requester": new mongoose.Types.ObjectId(userId) },
            { assignedAgent: new mongoose.Types.ObjectId(userId) },
          ],
        },
      },
      { $project: { _id: 1 } },
    ]);

    return accessibleLeads.map((lead) => lead._id);
  }
}

module.exports = LeadService;
