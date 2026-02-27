const amiService = require("../services/amiService");

// @desc    Get all AMI agent states
// @route   GET /api/ami-agents
// @access  Private (admin)
exports.getAmiAgentStates = async (req, res) => {
  try {
    const agents = amiService.getAgentStates();
    const status = amiService.getStatus();

    res.status(200).json({
      success: true,
      data: agents,
      callHistory: amiService.getCallHistory(),
      connection: status,
    });
  } catch (error) {
    console.error("Error fetching AMI agent states:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get AMI connection status
// @route   GET /api/ami-agents/status
// @access  Private (admin)
exports.getAmiStatus = async (req, res) => {
  try {
    const status = amiService.getStatus();
    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Force reconnect AMI
// @route   POST /api/ami-agents/reconnect
// @access  Private (admin)
exports.reconnectAmi = async (req, res) => {
  try {
    amiService.connect();
    res.status(200).json({
      success: true,
      message: "AMI reconnection initiated",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
