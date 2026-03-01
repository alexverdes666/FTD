const DeletedLead = require("../models/DeletedLead");
const Order = require("../models/Order");
const DepositCall = require("../models/DepositCall");
const CallChangeRequest = require("../models/CallChangeRequest");
const RefundAssignment = require("../models/RefundAssignment");
/**
 * Create a backup of a lead before deletion
 * @param {Object} lead - The lead document to backup (should be populated)
 * @param {String} userId - ID of the user performing the deletion
 * @param {String} deletionType - 'single' or 'bulk'
 * @param {String} reason - Reason for deletion
 * @param {String} activityLogId - Optional activity log ID reference
 * @returns {Promise<Object>} The created DeletedLead document
 */
const createDeletedLeadBackup = async (lead, userId, deletionType, reason, activityLogId = null) => {
  try {
    // Find all orders using this lead
    const orders = await Order.find({
      leads: lead._id,
    }).select("_id leadsMetadata createdAt");

    // Find traces in other collections
    const [depositCalls, callChangeRequests, refundAssignments] = await Promise.all([
      DepositCall.find({ leadId: lead._id }).lean(),
      CallChangeRequest.find({ leadId: lead._id }).lean(),
      RefundAssignment.find({ leadId: lead._id }).lean(),
    ]);

    // Extract order references
    const orderReferences = orders.map((order) => {
      const metadata = order.leadsMetadata.find(
        (m) => m.leadId && m.leadId.toString() === lead._id.toString()
      );
      return {
        orderId: order._id,
        orderedAs: metadata?.orderedAs || null,
        orderCreatedAt: order.createdAt,
      };
    });

    // Create deleted lead backup
    const deletedLead = await DeletedLead.create({
      leadData: lead.toObject(),
      deletedBy: userId,
      deletionReason: reason,
      deletionType: deletionType,
      orderReferences: orderReferences,
      traces: {
        depositCalls: depositCalls || [],
        callChangeRequests: callChangeRequests || [],
        refundAssignments: refundAssignments || [],
        fingerprints: [],
        clientBrokerAssignments:
          lead.clientBrokerHistory
            ?.map((h) => h.clientBroker?.name || h.clientBroker)
            .filter(Boolean) || [],
      },
      activityLogId: activityLogId,
      searchFields: {
        email: lead.newEmail || lead.email || "",
        phone: lead.newPhone || lead.phone || "",
        firstName: lead.firstName || "",
        lastName: lead.lastName || "",
        originalLeadId: lead._id,
      },
      migrationRecovered: false,
    });

    return deletedLead;
  } catch (error) {
    console.error("Error creating deleted lead backup:", error);
    throw error;
  }
};

module.exports = createDeletedLeadBackup;
