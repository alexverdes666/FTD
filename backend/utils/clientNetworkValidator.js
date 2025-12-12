const Lead = require('../models/Lead');
const validateClientNetworkAssignment = async (leadId, clientNetwork, orderId = null) => {
  try {
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return {
        canAssign: false,
        reason: 'Lead not found'
      };
    }
    const targetOrderId = orderId || lead.orderId;
    if (!targetOrderId) {
      return { canAssign: true };
    }
    const existingAssignment = lead.clientNetworkHistory.find(history =>
      history.clientNetwork === clientNetwork &&
      history.orderId &&
      history.orderId.toString() === targetOrderId.toString()
    );
    if (existingAssignment) {
      return {
        canAssign: false,
        reason: `Lead has already been assigned to client network "${clientNetwork}" within this order`,
        existingAssignment: existingAssignment
      };
    }
    return { canAssign: true };
  } catch (error) {
    throw new Error(`Error validating client network assignment: ${error.message}`);
  }
};
const validateBulkClientNetworkAssignment = async (leadIds, clientNetwork, orderId) => {
  try {
    const leads = await Lead.find({ _id: { $in: leadIds } });
    const validLeads = [];
    const conflictingLeads = [];
    for (const lead of leads) {
      const validation = await validateClientNetworkAssignment(lead._id, clientNetwork, orderId);
      if (validation.canAssign) {
        validLeads.push(lead);
      } else {
        conflictingLeads.push({
          lead: lead,
          reason: validation.reason,
          existingAssignment: validation.existingAssignment
        });
      }
    }
    return {
      canAssignAll: conflictingLeads.length === 0,
      conflictingLeads,
      validLeads
    };
  } catch (error) {
    throw new Error(`Error validating bulk client network assignment: ${error.message}`);
  }
};
const getLeadClientNetworkSummary = async (leadId) => {
  try {
    const lead = await Lead.findById(leadId).populate('clientNetworkHistory.orderId', 'status createdAt');
    if (!lead) {
      throw new Error('Lead not found');
    }
    const clientNetworkSummary = {};
    lead.clientNetworkHistory.forEach(history => {
      const network = history.clientNetwork;
      if (!clientNetworkSummary[network]) {
        clientNetworkSummary[network] = {
          clientNetwork: network,
          assignmentCount: 0,
          assignments: []
        };
      }
      clientNetworkSummary[network].assignmentCount++;
      clientNetworkSummary[network].assignments.push({
        assignedAt: history.assignedAt,
        orderId: history.orderId ? history.orderId._id : null,
        orderStatus: history.orderId ? history.orderId.status : null,
        orderCreatedAt: history.orderId ? history.orderId.createdAt : null
      });
    });
    return Object.values(clientNetworkSummary);
  } catch (error) {
    throw new Error(`Error getting lead client network summary: ${error.message}`);
  }
};
const checkOrderClientNetworkConflicts = async (orderId) => {
  try {
    const leads = await Lead.find({ orderId: orderId });
    const conflicts = [];
    const networkGroups = {};
    leads.forEach(lead => {
      lead.clientNetworkHistory.forEach(history => {
        if (history.orderId && history.orderId.toString() === orderId) {
          const network = history.clientNetwork;
          if (!networkGroups[network]) {
            networkGroups[network] = [];
          }
          networkGroups[network].push({
            leadId: lead._id,
            leadName: `${lead.firstName} ${lead.lastName}`,
            assignedAt: history.assignedAt
          });
        }
      });
    });
    Object.entries(networkGroups).forEach(([network, assignments]) => {
      if (assignments.length > 1) {
        conflicts.push({
          clientNetwork: network,
          conflictingAssignments: assignments
        });
      }
    });
    return {
      hasConflicts: conflicts.length > 0,
      conflicts
    };
  } catch (error) {
    throw new Error(`Error checking order client network conflicts: ${error.message}`);
  }
};
module.exports = {
  validateClientNetworkAssignment,
  validateBulkClientNetworkAssignment,
  getLeadClientNetworkSummary,
  checkOrderClientNetworkConflicts
};