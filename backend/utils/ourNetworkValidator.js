const Lead = require('../models/Lead');

const validateOurNetworkAssignment = async (leadId, ourNetwork, orderId = null) => {
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

    const existingAssignment = lead.ourNetworkHistory.find(history =>
      history.ourNetwork === ourNetwork &&
      history.orderId &&
      history.orderId.toString() === targetOrderId.toString()
    );

    if (existingAssignment) {
      return {
        canAssign: false,
        reason: `Lead has already been assigned to our network "${ourNetwork}" within this order`,
        existingAssignment: existingAssignment
      };
    }

    return { canAssign: true };
  } catch (error) {
    throw new Error(`Error validating our network assignment: ${error.message}`);
  }
};

const validateBulkOurNetworkAssignment = async (leadIds, ourNetwork, orderId) => {
  try {
    const leads = await Lead.find({ _id: { $in: leadIds } });
    const validLeads = [];
    const conflictingLeads = [];

    for (const lead of leads) {
      const validation = await validateOurNetworkAssignment(lead._id, ourNetwork, orderId);
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
    throw new Error(`Error validating bulk our network assignment: ${error.message}`);
  }
};

const getLeadOurNetworkSummary = async (leadId) => {
  try {
    const lead = await Lead.findById(leadId).populate('ourNetworkHistory.orderId', 'status createdAt');
    if (!lead) {
      throw new Error('Lead not found');
    }

    const ourNetworkSummary = {};
    lead.ourNetworkHistory.forEach(history => {
      const network = history.ourNetwork;
      if (!ourNetworkSummary[network]) {
        ourNetworkSummary[network] = {
          ourNetwork: network,
          assignmentCount: 0,
          assignments: []
        };
      }
      ourNetworkSummary[network].assignmentCount++;
      ourNetworkSummary[network].assignments.push({
        assignedAt: history.assignedAt,
        orderId: history.orderId ? history.orderId._id : null,
        orderStatus: history.orderId ? history.orderId.status : null,
        orderCreatedAt: history.orderId ? history.orderId.createdAt : null
      });
    });

    return Object.values(ourNetworkSummary);
  } catch (error) {
    throw new Error(`Error getting lead our network summary: ${error.message}`);
  }
};

const checkOrderOurNetworkConflicts = async (orderId) => {
  try {
    const leads = await Lead.find({ orderId: orderId });
    const conflicts = [];
    const networkGroups = {};

    leads.forEach(lead => {
      lead.ourNetworkHistory.forEach(history => {
        if (history.orderId && history.orderId.toString() === orderId) {
          const network = history.ourNetwork;
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
          ourNetwork: network,
          conflictingAssignments: assignments
        });
      }
    });

    return {
      hasConflicts: conflicts.length > 0,
      conflicts
    };
  } catch (error) {
    throw new Error(`Error checking order our network conflicts: ${error.message}`);
  }
};

module.exports = {
  validateOurNetworkAssignment,
  validateBulkOurNetworkAssignment,
  getLeadOurNetworkSummary,
  checkOrderOurNetworkConflicts
}; 