const AgentCallCounts = require("../models/AgentCallCounts");
const User = require("../models/User");

// Get all agents with their call counts for a specific month
const getAllAgentCallCounts = async (req, res) => {
  try {
    const { year, month } = req.query;
    const targetYear = year ? parseInt(year) : new Date().getFullYear();
    const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1;
    
    // Get all agents first, but filter based on user role
    let agentQuery = { 
      role: "agent",
      isActive: true,
      status: "approved"
    };
    
    // If user is an agent, only show their own data
    if (req.user.role === 'agent') {
      agentQuery._id = req.user._id;
    }
    
    const allAgents = await User.find(agentQuery).select("fullName email fourDigitCode");

    // Get existing call counts for the month
    const existingCounts = await AgentCallCounts.getAllAgentsWithCallCounts(targetYear, targetMonth);
    
    // Create a map of agent IDs to their call counts
    const countsMap = new Map();
    existingCounts.forEach((count) => {
      if (count.agent && count.agent._id) {
        countsMap.set(count.agent._id.toString(), count);
      }
    });

    // Merge all agents with their call counts (if they exist)
    const result = allAgents.map((agent) => {
      const existingCount = countsMap.get(agent._id.toString());

      if (existingCount) {
        return existingCount;
      } else {
        // Agent doesn't have call counts for this month yet
        return {
          _id: null,
          agent: agent,
          year: targetYear,
          month: targetMonth,
          callCounts: {
            firstCalls: 0,
            secondCalls: 0,
            thirdCalls: 0,
            fourthCalls: 0,
            fifthCalls: 0,
            verifiedAccounts: 0,
          },
          bonusRates: {
            firstCall: 5.0,
            secondCall: 10.0,
            thirdCall: 15.0,
            fourthCall: 20.0,
            fifthCall: 25.0,
            verifiedAcc: 50.0,
          },
          hasCallCounts: false,
          isActive: true,
          notes: "",
          createdAt: null,
          updatedAt: null,
        };
      }
    });

    // Sort by agent name
    result.sort((a, b) => {
      const nameA = a.agent?.fullName || "";
      const nameB = b.agent?.fullName || "";
      return nameA.localeCompare(nameB);
    });

    res.json({
      success: true,
      data: result,
      year: targetYear,
      month: targetMonth,
    });
  } catch (error) {
    console.error("Error fetching agent call counts:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch agent call counts",
      error: error.message,
    });
  }
};

// Get call counts for a specific agent
const getAgentCallCounts = async (req, res) => {
  try {
    const { agentId } = req.params;
    const { year, month } = req.query;
    const targetYear = year ? parseInt(year) : new Date().getFullYear();
    const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1;
    
    // If user is an agent, only allow access to their own data
    if (req.user.role === 'agent' && req.user._id.toString() !== agentId) {
      return res.status(403).json({
        success: false,
        message: "Access denied: You can only view your own call counts"
      });
    }
    
    const callCounts = await AgentCallCounts.getAgentCallCounts(agentId, targetYear, targetMonth);

    if (!callCounts) {
      // Return default structure if no call counts exist
      const agent = await User.findById(agentId).select("fullName email fourDigitCode");
      if (!agent) {
        return res.status(404).json({
          success: false,
          message: "Agent not found"
        });
      }

      return res.json({
        success: true,
        data: {
          _id: null,
          agent: agent,
          year: targetYear,
          month: targetMonth,
          callCounts: {
            firstCalls: 0,
            secondCalls: 0,
            thirdCalls: 0,
            fourthCalls: 0,
            fifthCalls: 0,
            verifiedAccounts: 0,
          },
          bonusRates: {
            firstCall: 5.0,
            secondCall: 10.0,
            thirdCall: 15.0,
            fourthCall: 20.0,
            fifthCall: 25.0,
            verifiedAcc: 50.0,
          },
          hasCallCounts: false,
          isActive: true,
          notes: "",
          createdAt: null,
          updatedAt: null,
        },
      });
    }

    res.json({
      success: true,
      data: callCounts,
    });
  } catch (error) {
    console.error("Error fetching agent call counts:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch agent call counts",
      error: error.message,
    });
  }
};

// Create or update call counts for an agent
const updateAgentCallCounts = async (req, res) => {
  const { agentId } = req.params;
  const { callCounts, notes, year, month } = req.body;
  
  try {
    const addedBy = req.user.id;
    
    // Validate that the user is an affiliate manager or admin
    if (req.user.role !== 'affiliate_manager' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "Only affiliate managers and admins can update call counts",
      });
    }

    // Validate that the agent exists
    const agent = await User.findById(agentId);
    if (!agent || agent.role !== 'agent') {
      return res.status(404).json({
        success: false,
        message: "Agent not found",
      });
    }

    // Validate call counts
    const validCallTypes = [
      "firstCalls",
      "secondCalls", 
      "thirdCalls",
      "fourthCalls",
      "fifthCalls",
      "verifiedAccounts",
    ];
    
    for (const callType of validCallTypes) {
      if (callCounts[callType] !== undefined) {
        if (callCounts[callType] < 0 || !Number.isInteger(callCounts[callType])) {
          return res.status(400).json({
            success: false,
            message: `Invalid value for ${callType}. Must be a non-negative integer.`,
          });
        }
      }
    }

    // Default to current month if not provided
    const targetYear = year || new Date().getFullYear();
    const targetMonth = month || new Date().getMonth() + 1;
    
    // Update or create call counts
    const updatedCallCounts = await AgentCallCounts.updateCallCounts(
      agentId,
      callCounts,
      addedBy,
      targetYear,
      targetMonth,
      notes
    );

    res.json({
      success: true,
      message: "Agent call counts updated successfully",
      data: updatedCallCounts,
    });
  } catch (error) {
    console.error("Error updating agent call counts:", error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      console.error("Duplicate key error:", {
        agentId,
        year: year || new Date().getFullYear(),
        month: month || new Date().getMonth() + 1,
        error: error.message,
        keyPattern: error.keyPattern,
        keyValue: error.keyValue
      });

      // Check for database corruption (wrong index pattern)
      if (error.keyPattern && error.keyPattern.date !== undefined) {
        console.error("🚨 DATABASE CORRUPTION DETECTED!");
        console.error("The agentcallcounts collection has wrong schema/indexes.");
        console.error("Expected index: {agent: 1, year: 1, month: 1}");
        console.error("Found index:", error.keyPattern);
        console.error("Run: node scripts/fix-agentcallcounts-corruption.js");
        
        return res.status(500).json({
          success: false,
          message: "Database corruption detected. Please contact system administrator.",
          error: "Schema mismatch - wrong indexes in database",
          fix: "Run database repair script: node scripts/fix-agentcallcounts-corruption.js"
        });
      }

      return res.status(409).json({
        success: false,
        message: "Call counts for this agent and month already exist. Please refresh and try again.",
        error: "Duplicate entry",
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Failed to update agent call counts",
      error: error.message,
    });
  }
};

// Get call counts for a year range
const getCallCountsInRange = async (req, res) => {
  try {
    const { agentId } = req.params;
    const { startYear, endYear } = req.query;
    
    // If user is an agent, only allow access to their own data
    if (req.user.role === 'agent' && req.user._id.toString() !== agentId) {
      return res.status(403).json({
        success: false,
        message: "Access denied: You can only view your own call counts"
      });
    }

    const callCounts = await AgentCallCounts.getCallCountsInRange(
      agentId,
      parseInt(startYear),
      parseInt(endYear)
    );

    res.json({
      success: true,
      data: callCounts,
    });
  } catch (error) {
    console.error("Error fetching call counts in range:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch call counts in range",
      error: error.message,
    });
  }
};

// Get call counts statistics
const getCallCountsStats = async (req, res) => {
  try {
    const { startYear, endYear } = req.query;
    const stats = await AgentCallCounts.getCallCountsStats(
      startYear ? parseInt(startYear) : undefined,
      endYear ? parseInt(endYear) : undefined
    );

    res.json({
      success: true,
      data: stats[0] || {
        totalAgents: 0,
        totalFirstCalls: 0,
        totalSecondCalls: 0,
        totalThirdCalls: 0,
        totalFourthCalls: 0,
        totalFifthCalls: 0,
        totalVerifiedAccounts: 0,
        totalRecords: 0,
        totalCalls: 0,
      },
    });
  } catch (error) {
    console.error("Error fetching call counts stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch call counts stats",
      error: error.message,
    });
  }
};

// Delete call counts for a specific agent and month
const deleteAgentCallCounts = async (req, res) => {
  try {
    const { agentId } = req.params;
    const { year, month } = req.query;
    const targetYear = year ? parseInt(year) : new Date().getFullYear();
    const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1;
    
    // Validate that the user is an affiliate manager or admin
    if (req.user.role !== 'affiliate_manager' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "Only affiliate managers and admins can delete call counts",
      });
    }

    const callCounts = await AgentCallCounts.findOne({ 
      agent: agentId, 
      year: targetYear,
      month: targetMonth
    });
    
    if (!callCounts) {
      return res.status(404).json({
        success: false,
        message: "Call counts not found for this agent and month",
      });
    }

    // Set as inactive instead of deleting
    callCounts.isActive = false;
    await callCounts.save();

    res.json({
      success: true,
      message: "Agent call counts deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting agent call counts:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete agent call counts",
      error: error.message,
    });
  }
};

// Legacy function - now redundant since main function works with monthly data
const getAllAgentCallCountsMonthly = async (req, res) => {
  // Redirect to the main function
  return getAllAgentCallCounts(req, res);
};

module.exports = {
  getAllAgentCallCounts,
  getAgentCallCounts,
  updateAgentCallCounts,
  getCallCountsInRange,
  getCallCountsStats,
  deleteAgentCallCounts,
  getAllAgentCallCountsMonthly,
};