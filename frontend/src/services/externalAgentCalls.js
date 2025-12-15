const EXTERNAL_API_BASE = "https://agent-report-1.onrender.com/api/mongodb";

/**
 * Get available months with agent call data
 */
export const getAvailableMonths = async () => {
  try {
    const response = await fetch(`${EXTERNAL_API_BASE}/months`);
    const data = await response.json();

    if (!data.success) {
      throw new Error("Failed to fetch available months");
    }

    return {
      success: true,
      data: data.months || [],
      total: data.total_months || 0,
    };
  } catch (error) {
    console.error("Error fetching available months:", error);
    throw error;
  }
};

/**
 * Get agent call data for a specific year and month
 */
export const getAgentCallsForMonth = async (year, month) => {
  try {
    const response = await fetch(
      `${EXTERNAL_API_BASE}/agents/${year}/${month}`
    );
    const data = await response.json();

    if (!data.success) {
      throw new Error(`Failed to fetch agent calls for ${year}/${month}`);
    }

    return {
      success: true,
      data: data.agents || [],
      total: data.total_agents || 0,
      month: data.month,
      year: data.year,
    };
  } catch (error) {
    console.error(`Error fetching agent calls for ${year}/${month}:`, error);
    throw error;
  }
};

/**
 * Get agent call data for a specific agent, year and month using new API format
 * @param {string} agentName - Agent name (e.g., "Ijeoma 600")
 * @param {number} year - Year (e.g., 2025)
 * @param {number} month - Month (e.g., 8)
 * @returns {Promise<Object>} Agent call data
 */
export const getAgentCallsForPeriod = async (agentName, year, month) => {
  try {
    const encodedAgentName = encodeURIComponent(agentName);
    const response = await fetch(
      `${EXTERNAL_API_BASE}/agents/${encodedAgentName}/${year}/${month}`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(
        `Failed to fetch agent calls for ${agentName} in ${year}/${month}`
      );
    }

    return {
      success: true,
      data: data.agent,
      agent_name: data.agent_name,
      year: data.year,
      month: data.month,
    };
  } catch (error) {
    console.error(
      `Error fetching agent calls for ${agentName} in ${year}/${month}:`,
      error
    );
    throw error;
  }
};

/**
 * Transform external agent data to a simplified format for display
 * Works with both old and new API formats
 */
export const transformAgentCallData = (agentData) => {
  if (!agentData) return null;

  // Handle new API format
  if (agentData.agent_name && agentData.incoming_calls && !agentData._id) {
    const {
      agent_name,
      agent_number,
      incoming_calls,
      outgoing_calls,
      last_updated,
    } = agentData;

    return transformNewFormatData({
      agent_name,
      agent_number,
      incoming_calls,
      outgoing_calls,
      last_updated,
    });
  }

  // Handle old API format
  const {
    _id,
    agent_name,
    agent_number,
    call_details,
    incoming_calls,
    outgoing_calls,
    period,
    last_updated,
    report_timestamp,
  } = agentData;

  // Extract call statistics
  const incomingStats = incoming_calls || {};
  const outgoingStats = outgoing_calls || {};

  // Calculate total calls
  const totalIncomingCalls = parseInt(incomingStats.total) || 0;
  const totalOutgoingCalls = parseInt(outgoingStats.total) || 0;
  const totalCalls = totalIncomingCalls + totalOutgoingCalls;

  // Calculate success metrics
  const successfulIncoming = parseInt(incomingStats.successful) || 0;
  const successfulOutgoing = parseInt(outgoingStats.successful) || 0;
  const totalSuccessful = successfulIncoming + successfulOutgoing;

  // Calculate time metrics
  const parseTimeString = (timeStr) => {
    if (!timeStr || timeStr === "00:00:00") return 0;
    const [hours, minutes, seconds] = timeStr.split(":").map(Number);
    return hours * 3600 + minutes * 60 + seconds; // return in seconds
  };

  const incomingTotalTime = parseTimeString(incomingStats.total_time);
  const outgoingTotalTime = parseTimeString(outgoingStats.total_time);
  const totalTalkTime = incomingTotalTime + outgoingTotalTime;

  // Format time for display
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Calculate averages
  const avgIncomingTime =
    totalIncomingCalls > 0
      ? Math.round(incomingTotalTime / totalIncomingCalls)
      : 0;
  const avgOutgoingTime =
    totalOutgoingCalls > 0
      ? Math.round(outgoingTotalTime / totalOutgoingCalls)
      : 0;

  return {
    id: _id,
    agentName: agent_name,
    agentNumber: agent_number,
    period: period || {},

    // Call counts
    totalCalls,
    incomingCalls: totalIncomingCalls,
    outgoingCalls: totalOutgoingCalls,

    // Success metrics
    successfulCalls: totalSuccessful,
    successfulIncoming: successfulIncoming,
    successfulOutgoing: successfulOutgoing,
    successRate:
      totalCalls > 0
        ? ((totalSuccessful / totalCalls) * 100).toFixed(1)
        : "0.0",

    // Time metrics
    totalTalkTime: formatTime(totalTalkTime),
    incomingTalkTime: formatTime(incomingTotalTime),
    outgoingTalkTime: formatTime(outgoingTotalTime),
    avgIncomingTime: formatTime(avgIncomingTime),
    avgOutgoingTime: formatTime(avgOutgoingTime),

    // Wait times
    avgIncomingWait: incomingStats.avg_wait || "00:00:00",
    maxIncomingWait: incomingStats.max_wait || "00:00:00",
    minIncomingWait: incomingStats.min_wait || "00:00:00",

    // Call details for expanded view
    callDetails: call_details || null,
    hasCallDetails: !!(
      call_details &&
      call_details.incoming_calls &&
      call_details.incoming_calls.length > 0
    ),

    // Metadata
    lastUpdated: last_updated,
    reportTimestamp: report_timestamp,

    // Raw data for debugging
    rawData: agentData,
  };
};

/**
 * Transform data from new API format
 */
const transformNewFormatData = (agentData) => {
  const {
    agent_name,
    agent_number,
    incoming_calls,
    outgoing_calls,
    last_updated,
  } = agentData;

  // Extract call statistics
  const incomingStats = incoming_calls || {};
  const outgoingStats = outgoing_calls || {};

  // Calculate total calls
  const totalIncomingCalls = parseInt(incomingStats.total) || 0;
  const totalOutgoingCalls = parseInt(outgoingStats.total) || 0;
  const totalCalls = totalIncomingCalls + totalOutgoingCalls;

  // Calculate success metrics
  const successfulIncoming = parseInt(incomingStats.successful) || 0;
  const successfulOutgoing = parseInt(outgoingStats.successful) || 0;
  const totalSuccessful = successfulIncoming + successfulOutgoing;

  // Calculate time metrics
  const parseTimeString = (timeStr) => {
    if (!timeStr || timeStr === "00:00:00") return 0;
    const [hours, minutes, seconds] = timeStr.split(":").map(Number);
    return hours * 3600 + minutes * 60 + seconds; // return in seconds
  };

  const incomingTotalTime = parseTimeString(incomingStats.total_time);
  const outgoingTotalTime = parseTimeString(outgoingStats.total_time);
  const totalTalkTime = incomingTotalTime + outgoingTotalTime;

  // Format time for display
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Calculate averages
  const avgIncomingTime =
    totalIncomingCalls > 0
      ? Math.round(incomingTotalTime / totalIncomingCalls)
      : 0;
  const avgOutgoingTime =
    totalOutgoingCalls > 0
      ? Math.round(outgoingTotalTime / totalOutgoingCalls)
      : 0;

  return {
    id: agent_number || String(Date.now()),
    agentName: agent_name,
    agentNumber: agent_number,
    period: {},

    // Call counts
    totalCalls,
    incomingCalls: totalIncomingCalls,
    outgoingCalls: totalOutgoingCalls,

    // Success metrics
    successfulCalls: totalSuccessful,
    successfulIncoming: successfulIncoming,
    successfulOutgoing: successfulOutgoing,
    successRate:
      totalCalls > 0
        ? ((totalSuccessful / totalCalls) * 100).toFixed(1)
        : "0.0",

    // Time metrics
    totalTalkTime: formatTime(totalTalkTime),
    incomingTalkTime: formatTime(incomingTotalTime),
    outgoingTalkTime: formatTime(outgoingTotalTime),
    avgIncomingTime: formatTime(avgIncomingTime),
    avgOutgoingTime: formatTime(avgOutgoingTime),

    // Wait times
    avgIncomingWait: incomingStats.avg_wait || "00:00:00",
    maxIncomingWait: incomingStats.max_wait || "00:00:00",
    minIncomingWait: incomingStats.min_wait || "00:00:00",

    // Call details for expanded view - not available in new API
    callDetails: null,
    hasCallDetails: false,

    // Metadata
    lastUpdated: last_updated,
    reportTimestamp: null,

    // Raw data for debugging
    rawData: agentData,
  };
};

/**
 * Get formatted agent calls data for display
 */
export const getFormattedAgentCalls = async (year, month) => {
  try {
    const response = await getAgentCallsForMonth(year, month);

    if (!response.success) {
      return response;
    }

    const transformedData = response.data
      .map(transformAgentCallData)
      .filter(Boolean);

    // Sort by agent name
    transformedData.sort((a, b) => a.agentName.localeCompare(b.agentName));

    return {
      success: true,
      data: transformedData,
      total: transformedData.length,
      month: response.month,
      year: response.year,
    };
  } catch (error) {
    console.error("Error getting formatted agent calls:", error);
    throw error;
  }
};

/**
 * Helper function to get current month/year
 */
export const getCurrentPeriod = () => {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };
};

/**
 * Helper function to format month name
 */
export const formatMonthYear = (year, month) => {
  const date = new Date(year, month - 1);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long" });
};
