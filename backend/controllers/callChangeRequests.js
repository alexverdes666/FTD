const CallChangeRequest = require("../models/CallChangeRequest");
const Lead = require("../models/Lead");
const Order = require("../models/Order");
const AgentCallCounts = require("../models/AgentCallCounts");
const { validationResult } = require("express-validator");

// Helper function to update agent call bonuses and verification counts
const updateAgentCallBonus = async (agentId, orderDate, oldCallNumber, newCallNumber, oldVerified, newVerified, reviewerId) => {
  try {
    // Validation: Check if required parameters are provided
    if (!agentId) {
      throw new Error('Agent ID is required for call bonus update');
    }

    if (!orderDate) {
      throw new Error('Order date is required for call bonus update');
    }

    if (!reviewerId) {
      throw new Error('Reviewer ID is required for call bonus update');
    }

    // Validate orderDate is a valid date
    const orderDateObj = new Date(orderDate);
    if (isNaN(orderDateObj.getTime())) {
      throw new Error('Invalid order date provided');
    }

    // Extract year and month from order date
    const year = orderDateObj.getFullYear();
    const month = orderDateObj.getMonth() + 1; // JavaScript months are 0-indexed

    // Validate year and month are reasonable
    if (year < 2020 || year > 2100) {
      throw new Error(`Invalid year extracted from order date: ${year}`);
    }

    if (month < 1 || month > 12) {
      throw new Error(`Invalid month extracted from order date: ${month}`);
    }

    // Map call numbers to field names
    const callNumberMap = {
      "1st": "firstCalls",
      "2nd": "secondCalls",
      "3rd": "thirdCalls",
      "4th": "fourthCalls",
      "5th": "fifthCalls",
    };

    // Validate call numbers are valid or null
    if (oldCallNumber && !callNumberMap[oldCallNumber]) {
      console.warn(`⚠️ Invalid old call number: ${oldCallNumber}`);
    }

    if (newCallNumber && !callNumberMap[newCallNumber]) {
      console.warn(`⚠️ Invalid new call number: ${newCallNumber}`);
    }

    // Try to find existing document first (handles both old and new schema)
    let agentCallCounts = await AgentCallCounts.findOne({
      agent: agentId,
      year: year,
      month: month,
    });

    // If not found, try alternative query for old schema (with date field)
    if (!agentCallCounts) {
      console.log(`🔍 Document not found with year/month, checking for old schema documents...`);
      // Check if there's any document for this agent
      const anyDoc = await AgentCallCounts.findOne({ agent: agentId });
      if (anyDoc) {
        console.log(`⚠️ Found document with old schema, deleting it...`);
        await AgentCallCounts.deleteMany({ agent: agentId, year: { $exists: false } });
      }
    }

    // Now create or update using findOneAndUpdate with upsert
    const filter = {
      agent: agentId,
      year: year,
      month: month,
    };

    const update = {
      $setOnInsert: {
        agent: agentId,
        year: year,
        month: month,
        isActive: true,
        'callCounts.firstCalls': 0,
        'callCounts.secondCalls': 0,
        'callCounts.thirdCalls': 0,
        'callCounts.fourthCalls': 0,
        'callCounts.fifthCalls': 0,
        'callCounts.verifiedAccounts': 0,
      },
      $set: {
        addedBy: reviewerId,
      },
    };

    try {
      agentCallCounts = await AgentCallCounts.findOneAndUpdate(
        filter,
        update,
        {
          upsert: true,
          new: true, // Return the new/updated document
          setDefaultsOnInsert: true,
        }
      );
    } catch (updateError) {
      // Handle duplicate key error from old index
      if (updateError.code === 11000 && updateError.message.includes('agent_1_date_1')) {
        console.log(`🔧 Detected old index agent_1_date_1, attempting to drop it...`);
        
        try {
          // Drop the old index
          await AgentCallCounts.collection.dropIndex('agent_1_date_1');
          console.log(`✅ Successfully dropped old index agent_1_date_1`);
          
          // Delete any documents with old schema (no year/month fields)
          const deleteResult = await AgentCallCounts.deleteMany({
            agent: agentId,
            $or: [
              { year: { $exists: false } },
              { month: { $exists: false } }
            ]
          });
          console.log(`🗑️ Deleted ${deleteResult.deletedCount} old schema documents`);
          
          // Retry the operation
          agentCallCounts = await AgentCallCounts.findOneAndUpdate(
            filter,
            update,
            {
              upsert: true,
              new: true,
              setDefaultsOnInsert: true,
            }
          );
          console.log(`✅ Successfully created document after index cleanup`);
        } catch (cleanupError) {
          console.error(`❌ Error during index cleanup:`, cleanupError);
          throw new Error(`Failed to clean up old index: ${cleanupError.message}`);
        }
      } else {
        // Re-throw if it's a different error
        throw updateError;
      }
    }

    if (!agentCallCounts) {
      throw new Error(`Failed to create/update AgentCallCounts for agent ${agentId} (${month}/${year})`);
    }

    console.log(`✓ Found/Created AgentCallCounts document for agent ${agentId} (${month}/${year})`);


    // Double-check we have a valid document
    if (!agentCallCounts) {
      throw new Error(`AgentCallCounts document is null for agent ${agentId} (${month}/${year})`);
    }

    // Ensure callCounts object exists
    if (!agentCallCounts.callCounts) {
      agentCallCounts.callCounts = {
        firstCalls: 0,
        secondCalls: 0,
        thirdCalls: 0,
        fourthCalls: 0,
        fifthCalls: 0,
        verifiedAccounts: 0,
      };
    }

    // Now update the call counts
    let hasChanges = false;

    // Decrement old call type if exists
    if (oldCallNumber && callNumberMap[oldCallNumber]) {
      const fieldName = callNumberMap[oldCallNumber];
      const oldValue = agentCallCounts.callCounts[fieldName] || 0;
      agentCallCounts.callCounts[fieldName] = Math.max(0, oldValue - 1);
      console.log(`  - Decremented ${oldCallNumber}: ${oldValue} -> ${agentCallCounts.callCounts[fieldName]}`);
      hasChanges = true;
    }

    // Increment new call type if exists
    if (newCallNumber && callNumberMap[newCallNumber]) {
      const fieldName = callNumberMap[newCallNumber];
      const oldValue = agentCallCounts.callCounts[fieldName] || 0;
      agentCallCounts.callCounts[fieldName] = oldValue + 1;
      console.log(`  + Incremented ${newCallNumber}: ${oldValue} -> ${agentCallCounts.callCounts[fieldName]}`);
      hasChanges = true;
    }

    // Handle verification status changes
    if (oldVerified !== undefined && newVerified !== undefined && oldVerified !== newVerified) {
      const oldVerifiedCount = agentCallCounts.callCounts.verifiedAccounts || 0;
      
      if (!oldVerified && newVerified) {
        // Changing from No to Yes - increment
        agentCallCounts.callCounts.verifiedAccounts = oldVerifiedCount + 1;
        console.log(`  + Incremented verifiedAccounts: ${oldVerifiedCount} -> ${agentCallCounts.callCounts.verifiedAccounts}`);
        hasChanges = true;
      } else if (oldVerified && !newVerified) {
        // Changing from Yes to No - decrement
        agentCallCounts.callCounts.verifiedAccounts = Math.max(0, oldVerifiedCount - 1);
        console.log(`  - Decremented verifiedAccounts: ${oldVerifiedCount} -> ${agentCallCounts.callCounts.verifiedAccounts}`);
        hasChanges = true;
      }
    }

    // Update addedBy to the reviewer
    agentCallCounts.addedBy = reviewerId;

    // Save if there were changes
    if (hasChanges) {
      await agentCallCounts.save();
      console.log(`✅ Updated call bonuses for agent ${agentId}: ${oldCallNumber || 'None'} -> ${newCallNumber || 'None'}, Verified: ${oldVerified} -> ${newVerified} for ${month}/${year}`);
    }

    console.log(`✅ Updated call bonuses for agent ${agentId}: ${oldCallNumber || 'None'} -> ${newCallNumber || 'None'} for ${month}/${year}`);
    
    return agentCallCounts;
  } catch (error) {
    console.error('❌ Error updating agent call bonus:', error);
    throw error;
  }
};

// Get all pending call change requests
exports.getPendingRequests = async (req, res, next) => {
  try {
    // Only admin and affiliate_manager can view pending requests
    if (req.user.role !== "admin" && req.user.role !== "affiliate_manager") {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view call change requests",
      });
    }

    let requests = await CallChangeRequest.find({ status: "pending" })
      .populate("leadId", "firstName lastName")
      .populate({
        path: "orderId",
        select: "status createdAt requester selectedClientNetwork",
        populate: [
          {
            path: "selectedClientNetwork",
            select: "name"
          },
          {
            path: "requester",
            select: "fullName"
          }
        ]
      })
      .populate("requestedBy", "fullName email")
      .sort({ createdAt: -1 });

    // Filter for affiliate_manager: only show requests for orders they requested
    if (req.user.role === "affiliate_manager") {
      requests = requests.filter(request => {
        // Check if order exists and requester matches current user
        // Note: request.orderId is the populated order object
        return request.orderId && 
               request.orderId.requester && 
               request.orderId.requester._id.toString() === req.user.id;
      });
    }

    res.status(200).json({
      success: true,
      data: requests,
      count: requests.length,
    });
  } catch (error) {
    next(error);
  }
};

// Approve a call change request
exports.approveRequest = async (req, res, next) => {
  try {
    // Only admin and affiliate_manager can approve requests
    if (req.user.role !== "admin" && req.user.role !== "affiliate_manager") {
      return res.status(403).json({
        success: false,
        message: "Not authorized to approve call change requests",
      });
    }

    const requestId = req.params.id;

    const request = await CallChangeRequest.findById(requestId);
    
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Call change request not found",
      });
    }

    // Check ownership for affiliate_manager
    if (req.user.role === "affiliate_manager") {
      const order = await Order.findById(request.orderId);
      if (!order || order.requester.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to approve call change requests for this order",
        });
      }
    }

    if (request.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `This request has already been ${request.status}`,
      });
    }

    // Update the lead's call number
    const lead = await Lead.findById(request.leadId);
    
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    lead.updateOrderCallNumber(
      request.orderId,
      request.requestedCallNumber,
      request.requestedBy,
      request.requestedVerified
    );
    await lead.save();

    // Update the request status
    request.status = "approved";
    request.reviewedBy = req.user.id;
    request.reviewedAt = new Date();
    await request.save();

    // Update agent call bonuses and verification counts
    try {
      // Get the order to retrieve its creation date
      const order = await Order.findById(request.orderId);
      
      if (order && order.createdAt) {
        // Update the agent's monthly call bonuses and verification counts
        await updateAgentCallBonus(
          request.requestedBy,  // agentId
          order.createdAt,      // orderDate
          request.currentCallNumber,  // oldCallNumber
          request.requestedCallNumber, // newCallNumber
          request.currentVerified,     // oldVerified
          request.requestedVerified,   // newVerified
          req.user.id           // reviewerId
        );
      } else {
        console.warn(`⚠️ Could not update call bonus: Order ${request.orderId} not found or missing createdAt`);
      }
    } catch (bonusError) {
      // Log the error but don't fail the approval
      console.error('❌ Error updating call bonus:', bonusError);
      // Continue with the response since the main approval succeeded
    }

    res.status(200).json({
      success: true,
      message: "Call change request approved successfully",
      data: {
        requestId: request._id,
        leadId: lead._id,
        callNumber: request.requestedCallNumber,
        verified: request.requestedVerified,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Reject a call change request
exports.rejectRequest = async (req, res, next) => {
  try {
    // Only admin and affiliate_manager can reject requests
    if (req.user.role !== "admin" && req.user.role !== "affiliate_manager") {
      return res.status(403).json({
        success: false,
        message: "Not authorized to reject call change requests",
      });
    }

    const requestId = req.params.id;

    const request = await CallChangeRequest.findById(requestId);
    
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Call change request not found",
      });
    }

    // Check ownership for affiliate_manager
    if (req.user.role === "affiliate_manager") {
      const order = await Order.findById(request.orderId);
      if (!order || order.requester.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to reject call change requests for this order",
        });
      }
    }

    if (request.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `This request has already been ${request.status}`,
      });
    }

    // Update the request status
    request.status = "rejected";
    request.reviewedBy = req.user.id;
    request.reviewedAt = new Date();
    await request.save();

    res.status(200).json({
      success: true,
      message: "Call change request rejected successfully",
      data: {
        requestId: request._id,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get pending requests for a specific lead/order (used by frontend to show pending state)
exports.getPendingRequestForLead = async (req, res, next) => {
  try {
    const { leadId, orderId } = req.query;

    if (!leadId || !orderId) {
      return res.status(400).json({
        success: false,
        message: "leadId and orderId are required",
      });
    }

    const request = await CallChangeRequest.findOne({
      leadId: leadId,
      orderId: orderId,
      status: "pending",
    })
      .populate("requestedBy", "fullName")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

