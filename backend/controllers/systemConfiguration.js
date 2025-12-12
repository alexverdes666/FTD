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

module.exports = {
  getGlobalBonusRates,
  updateGlobalBonusRates,
};
