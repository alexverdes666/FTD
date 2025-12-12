const agentMonthlyHistoryService = require("../services/agentMonthlyHistoryService");

/**
 * Get monthly history for an agent
 */
exports.getAgentMonthlyHistory = async (req, res, next) => {
  try {
    const { agentName } = req.params;
    const { monthsBack = 12 } = req.query;

    // Validate agent name
    if (!agentName) {
      return res.status(400).json({
        success: false,
        message: "Agent name is required",
      });
    }

    // Check permissions - agents can only access their own data
    if (req.user.role === "agent" && req.user.fullName !== agentName) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only view your own monthly history.",
      });
    }

    // Validate monthsBack parameter
    const monthsBackNumber = parseInt(monthsBack);
    if (isNaN(monthsBackNumber) || monthsBackNumber < 1 || monthsBackNumber > 24) {
      return res.status(400).json({
        success: false,
        message: "monthsBack must be a number between 1 and 24",
      });
    }

    console.log(`Fetching monthly history for agent: ${agentName}, months back: ${monthsBackNumber}`);

    // Get monthly history from service
    const monthlyHistory = await agentMonthlyHistoryService.getAgentMonthlyHistory(
      agentName,
      monthsBackNumber
    );

    res.status(200).json({
      success: true,
      data: monthlyHistory,
      message: `Monthly history retrieved successfully for ${agentName}`,
    });
  } catch (error) {
    console.error("Error fetching agent monthly history:", error.message);
    
    // Handle specific error cases
    if (error.message.includes("Invalid response format")) {
      return res.status(502).json({
        success: false,
        message: "Unable to fetch data from external API",
        error: error.message,
      });
    }

    if (error.message.includes("No data found")) {
      return res.status(404).json({
        success: false,
        message: "No historical data found for this agent",
        error: error.message,
      });
    }

    // Generic error handling
    res.status(500).json({
      success: false,
      message: "Failed to fetch monthly history",
      error: error.message,
    });
  }
};

/**
 * Get monthly history for current authenticated agent
 */
exports.getMyMonthlyHistory = async (req, res, next) => {
  try {
    const { monthsBack = 12 } = req.query;

    // Check if user is an agent
    if (req.user.role !== "agent") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Agent role required.",
      });
    }

    if (!req.user.fullName) {
      return res.status(400).json({
        success: false,
        message: "Agent name not found in user profile",
      });
    }

    // Validate monthsBack parameter
    const monthsBackNumber = parseInt(monthsBack);
    if (isNaN(monthsBackNumber) || monthsBackNumber < 1 || monthsBackNumber > 24) {
      return res.status(400).json({
        success: false,
        message: "monthsBack must be a number between 1 and 24",
      });
    }

    console.log(`Fetching monthly history for current agent: ${req.user.fullName}, months back: ${monthsBackNumber}`);

    // Get monthly history from service
    const monthlyHistory = await agentMonthlyHistoryService.getAgentMonthlyHistory(
      req.user.fullName,
      monthsBackNumber
    );

    res.status(200).json({
      success: true,
      data: monthlyHistory,
      message: `Monthly history retrieved successfully`,
    });
  } catch (error) {
    console.error("Error fetching current agent monthly history:", error.message);
    
    // Handle specific error cases
    if (error.message.includes("Invalid response format")) {
      return res.status(502).json({
        success: false,
        message: "Unable to fetch data from external API",
        error: error.message,
      });
    }

    if (error.message.includes("No data found")) {
      return res.status(404).json({
        success: false,
        message: "No historical data found for your agent profile",
        error: error.message,
      });
    }

    // Generic error handling
    res.status(500).json({
      success: false,
      message: "Failed to fetch your monthly history",
      error: error.message,
    });
  }
};

/**
 * Clear cache for agent monthly history
 */
exports.clearMonthlyHistoryCache = async (req, res, next) => {
  try {
    const { agentName } = req.params;

    // Allow agents to clear their own cache, admins can clear any cache
    if (req.user.role === "agent" && agentName && req.user.fullName !== agentName) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only clear your own cache.",
      });
    }

    if (req.user.role !== "admin" && req.user.role !== "agent") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin or Agent role required.",
      });
    }

    if (agentName) {
      agentMonthlyHistoryService.clearCache(agentName);
      console.log(`Cache cleared for agent: ${agentName}`);
    } else {
      // Only admins can clear all cache
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Access denied. Admin role required to clear all cache.",
        });
      }
      agentMonthlyHistoryService.clearCache();
      console.log("All monthly history cache cleared");
    }

    res.status(200).json({
      success: true,
      message: agentName ? 
        `Cache cleared for agent ${agentName}` : 
        "All monthly history cache cleared",
    });
  } catch (error) {
    console.error("Error clearing monthly history cache:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to clear cache",
      error: error.message,
    });
  }
};

/**
 * Get monthly history summary for multiple agents (admin only)
 */
exports.getMultipleAgentsMonthlyHistory = async (req, res, next) => {
  try {
    const { agentNames, monthsBack = 12 } = req.body;

    // Check if user is admin
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin role required.",
      });
    }

    if (!agentNames || !Array.isArray(agentNames) || agentNames.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Agent names array is required",
      });
    }

    const monthsBackNumber = parseInt(monthsBack);
    if (isNaN(monthsBackNumber) || monthsBackNumber < 1 || monthsBackNumber > 24) {
      return res.status(400).json({
        success: false,
        message: "monthsBack must be a number between 1 and 24",
      });
    }

    console.log(`Fetching monthly history for ${agentNames.length} agents`);

    const results = {};
    const errors = {};

    // Fetch data for each agent
    await Promise.allSettled(
      agentNames.map(async (agentName) => {
        try {
          const history = await agentMonthlyHistoryService.getAgentMonthlyHistory(
            agentName,
            monthsBackNumber
          );
          results[agentName] = history;
        } catch (error) {
          console.error(`Error fetching history for ${agentName}:`, error.message);
          errors[agentName] = error.message;
        }
      })
    );

    res.status(200).json({
      success: true,
      data: results,
      errors: Object.keys(errors).length > 0 ? errors : null,
      message: `Monthly history retrieved for ${Object.keys(results).length} out of ${agentNames.length} agents`,
    });
  } catch (error) {
    console.error("Error fetching multiple agents monthly history:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch monthly history for multiple agents",
      error: error.message,
    });
  }
}; 