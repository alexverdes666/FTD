const SystemConfiguration = require("../models/SystemConfiguration");

// Get global bonus rates configuration
const getGlobalBonusRates = async (req, res) => {
  try {
    let bonusRatesConfig = await SystemConfiguration.getGlobalBonusRates();
    
    if (!bonusRatesConfig) {
      // Create default configuration if none exists
      bonusRatesConfig = await SystemConfiguration.createDefaultGlobalBonusRates(req.user.id);
    }

    res.json({
      success: true,
      data: bonusRatesConfig,
    });
  } catch (error) {
    console.error("Error fetching global bonus rates:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch global bonus rates configuration",
      error: error.message,
    });
  }
};

// Update global bonus rates configuration
const updateGlobalBonusRates = async (req, res) => {
  try {
    const { bonusRates, notes } = req.body;
    const adminId = req.user.id;

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

    // Update the global bonus rates configuration
    const updatedConfig = await SystemConfiguration.updateGlobalBonusRates(
      bonusRates,
      adminId,
      notes || ""
    );

    res.json({
      success: true,
      message: "Global bonus rates updated successfully",
      data: updatedConfig,
    });
  } catch (error) {
    console.error("Error updating global bonus rates:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update global bonus rates configuration",
      error: error.message,
    });
  }
};

// Get superior lead manager configuration
const getSuperiorLeadManager = async (req, res) => {
  try {
    const superiorManager = await SystemConfiguration.getSuperiorLeadManager();

    res.json({
      success: true,
      data: superiorManager,
    });
  } catch (error) {
    console.error("Error fetching superior lead manager:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch superior lead manager configuration",
      error: error.message,
    });
  }
};

// Set superior lead manager configuration (admin only)
const setSuperiorLeadManager = async (req, res) => {
  try {
    const { userId } = req.body;
    const User = require("../models/User");

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required.",
      });
    }

    // Verify the user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (!user.isActive || user.status !== "approved") {
      return res.status(400).json({
        success: false,
        message: "User must be active and approved.",
      });
    }

    const config = await SystemConfiguration.setSuperiorLeadManager(
      userId,
      req.user.id
    );

    res.json({
      success: true,
      message: `${user.fullName} has been set as the superior lead manager.`,
      data: config.superiorLeadManager,
    });
  } catch (error) {
    console.error("Error setting superior lead manager:", error);
    res.status(500).json({
      success: false,
      message: "Failed to set superior lead manager",
      error: error.message,
    });
  }
};

module.exports = {
  getGlobalBonusRates,
  updateGlobalBonusRates,
  getSuperiorLeadManager,
  setSuperiorLeadManager,
};
