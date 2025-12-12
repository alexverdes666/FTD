const AgentBonus = require("../models/AgentBonus");
const User = require("../models/User");

// Get all agents with their bonus configurations (if any)
const getAllAgentBonuses = async (req, res) => {
  try {
    // Get all agents
    const allAgents = await User.find({ role: "agent" }).select(
      "fullName email"
    );

    // Get all existing bonus configurations
    const bonusConfigs = await AgentBonus.find({ isActive: true })
      .populate("agent", "fullName email")
      .populate("lastUpdatedBy", "fullName email");

    // Create a map of agent IDs to their bonus configurations
    const configMap = new Map();
    bonusConfigs.forEach((config) => {
      // Skip configurations where the agent has been deleted
      if (config.agent && config.agent._id) {
        configMap.set(config.agent._id.toString(), config);
      }
    });

    // Merge all agents with their configurations (if they exist)
    const result = allAgents.map((agent) => {
      const existingConfig = configMap.get(agent._id.toString());

      if (existingConfig) {
        return existingConfig;
      } else {
        // Agent doesn't have a configuration yet
        return {
          _id: null, // No bonus config ID yet
          agent: agent,
          bonusRates: {
            firstCall: 0.0,
            secondCall: 0.0,
            thirdCall: 0.0,
            fourthCall: 0.0,
            fifthCall: 0.0,
            verifiedAcc: 0.0,
          },
          hasConfiguration: false,
          isActive: true,
          notes: "",
          createdAt: null,
          updatedAt: null,
        };
      }
    });

    // Sort by agent name (with safety checks)
    result.sort((a, b) => {
      const nameA = a.agent?.fullName || "";
      const nameB = b.agent?.fullName || "";
      return nameA.localeCompare(nameB);
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error fetching agent bonuses:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch agent bonuses",
      error: error.message,
    });
  }
};

// Get bonus configuration for a specific agent
const getAgentBonus = async (req, res) => {
  try {
    const { agentId } = req.params;
    const bonusConfig = await AgentBonus.getAgentBonusConfig(agentId);

    if (!bonusConfig) {
      // Return default configuration if agent doesn't have one yet
      const agent = await User.findById(agentId).select("fullName email");
      if (!agent) {
        return res.status(404).json({
          success: false,
          message: "Agent not found",
        });
      }

      return res.json({
        success: true,
        data: {
          _id: null,
          agent: agent,
          bonusRates: {
            firstCall: 0.0,
            secondCall: 0.0,
            thirdCall: 0.0,
            fourthCall: 0.0,
            fifthCall: 0.0,
            verifiedAcc: 0.0,
          },
          hasConfiguration: false,
          isActive: true,
          notes: "",
          createdAt: null,
          updatedAt: null,
        },
      });
    }

    res.json({
      success: true,
      data: bonusConfig,
    });
  } catch (error) {
    console.error("Error fetching agent bonus:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch agent bonus configuration",
      error: error.message,
    });
  }
};

// Create or update bonus configuration for an agent
const createOrUpdateAgentBonus = async (req, res) => {
  try {
    const { agentId } = req.params;
    const { bonusRates, notes } = req.body;
    const adminId = req.user.id;

    // Validate that the agent exists
    const agent = await User.findById(agentId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: "Agent not found",
      });
    }

    // Validate bonus rates
    const validRates = [
      "firstCall",
      "secondCall",
      "thirdCall",
      "fourthCall",
      "fifthCall",
      "verifiedAcc",
    ];
    for (const rate of validRates) {
      if (
        bonusRates[rate] !== undefined &&
        (bonusRates[rate] < 0 || isNaN(bonusRates[rate]))
      ) {
        return res.status(400).json({
          success: false,
          message: `Invalid bonus rate for ${rate}. Must be a positive number.`,
        });
      }
    }

    // Find existing configuration or create new one
    let bonusConfig = await AgentBonus.findOne({ agent: agentId });

    if (bonusConfig) {
      // Update existing configuration
      bonusConfig.bonusRates = { ...bonusConfig.bonusRates, ...bonusRates };
      bonusConfig.notes = notes || bonusConfig.notes;
      bonusConfig.lastUpdatedBy = adminId;
      bonusConfig.isActive = true;
      await bonusConfig.save();
    } else {
      // Create new configuration
      bonusConfig = await AgentBonus.create({
        agent: agentId,
        bonusRates,
        notes,
        lastUpdatedBy: adminId,
      });
    }

    // Populate the response
    await bonusConfig.populate("agent", "fullName email");
    await bonusConfig.populate("lastUpdatedBy", "fullName email");

    res.json({
      success: true,
      message: "Agent bonus configuration updated successfully",
      data: bonusConfig,
    });
  } catch (error) {
    console.error("Error updating agent bonus:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update agent bonus configuration",
      error: error.message,
    });
  }
};

// Delete bonus configuration for an agent (set as inactive)
const deleteAgentBonus = async (req, res) => {
  try {
    const { agentId } = req.params;
    const adminId = req.user.id;

    const bonusConfig = await AgentBonus.findOne({ agent: agentId });
    if (!bonusConfig) {
      return res.status(404).json({
        success: false,
        message: "Bonus configuration not found for this agent",
      });
    }

    // Set as inactive instead of deleting
    bonusConfig.isActive = false;
    bonusConfig.lastUpdatedBy = adminId;
    await bonusConfig.save();

    res.json({
      success: true,
      message: "Agent bonus configuration deactivated successfully",
    });
  } catch (error) {
    console.error("Error deleting agent bonus:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete agent bonus configuration",
      error: error.message,
    });
  }
};

// Get bonus summary statistics
const getBonusStats = async (req, res) => {
  try {
    const totalConfigs = await AgentBonus.countDocuments({ isActive: true });
    const totalAgents = await User.countDocuments({ role: "agent" });
    const configsWithCustomRates = await AgentBonus.countDocuments({
      isActive: true,
      $or: [
        { "bonusRates.firstCall": { $ne: 0.0 } },
        { "bonusRates.secondCall": { $ne: 0.0 } },
        { "bonusRates.thirdCall": { $ne: 0.0 } },
        { "bonusRates.fourthCall": { $ne: 0.0 } },
        { "bonusRates.fifthCall": { $ne: 0.0 } },
        { "bonusRates.verifiedAcc": { $ne: 0.0 } },
      ],
    });

    res.json({
      success: true,
      data: {
        totalAgents,
        totalConfigs,
        agentsWithoutConfig: totalAgents - totalConfigs,
        configsWithCustomRates,
        configsWithDefaultRates: totalConfigs - configsWithCustomRates,
      },
    });
  } catch (error) {
    console.error("Error fetching bonus stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bonus statistics",
      error: error.message,
    });
  }
};

module.exports = {
  getAllAgentBonuses,
  getAgentBonus,
  createOrUpdateAgentBonus,
  deleteAgentBonus,
  getBonusStats,
};
