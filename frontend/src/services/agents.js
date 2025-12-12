import api from "./api";
import { RATE_PER_SECOND, calculateBasePay } from "./payroll/calculations";

const EXTERNAL_API_BASE = "https://agent-report-mfl3.onrender.com/api/mongodb";

/**
 * Fetch agent metrics using the new API format
 * @param {string} agentName - Agent name (e.g., "Ijeoma 600")
 * @param {number} year - Year (e.g., 2025)
 * @param {number} month - Month (e.g., 8)
 * @returns {Promise<Object>} Agent metrics data
 */
export const fetchAgentMetricsByPeriod = async (
  agentName,
  year = null,
  month = null
) => {
  try {
    // Use current date if year/month not provided
    const currentDate = new Date();
    const targetYear = year || currentDate.getFullYear();
    const targetMonth = month || currentDate.getMonth() + 1;

    console.log(
      `🚀 Fetching metrics for agent: ${agentName}, period: ${targetYear}/${targetMonth}`
    );

    const encodedAgentName = encodeURIComponent(agentName);
    const apiUrl = `${EXTERNAL_API_BASE}/agents/${encodedAgentName}/${targetYear}/${targetMonth}`;
    console.log(`📡 API URL: ${apiUrl}`);

    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("📥 Raw API response:", data);

    if (data.success && data.agent) {
      const transformedData = transformNewApiData(data);
      console.log("✅ Transformed data:", transformedData);
      return transformedData;
    }

    throw new Error("No data found for agent");
  } catch (error) {
    console.error("❌ Error fetching agent metrics by period:", error);
    throw error;
  }
};

/**
 * Transform data from new API format to the expected format
 * @param {Object} apiResponse - Response from new API
 * @returns {Object} Transformed data
 */
const transformNewApiData = (apiResponse) => {
  const { agent, year, month, agent_name } = apiResponse;
  const incomingCalls = agent.incoming_calls || {};
  const outgoingCalls = agent.outgoing_calls || {};
  const callDetails = agent.call_details || {};

  // Parse time strings to seconds
  const parseTimeToSeconds = (timeStr) => {
    if (!timeStr || timeStr === "00:00:00") return 0;
    const [hours, minutes, seconds] = timeStr.split(":").map(Number);
    return hours * 3600 + minutes * 60 + seconds;
  };

  // Calculate actual data from call_details if available (more accurate)
  let actualTotalCalls = 0;
  let actualSuccessfulCalls = 0;
  let actualTotalTalkTimeSeconds = 0;

  console.log("🔍 Analyzing API response for", agent_name);
  console.log("📞 Summary data:", { incomingCalls, outgoingCalls });
  console.log("📋 Call details available:", !!callDetails.incoming_calls);

  if (callDetails.incoming_calls && Array.isArray(callDetails.incoming_calls)) {
    actualTotalCalls = callDetails.incoming_calls.length;
    actualSuccessfulCalls = callDetails.incoming_calls.filter(
      (call) => call.status === "ANSWER"
    ).length;
    actualTotalTalkTimeSeconds = callDetails.incoming_calls.reduce(
      (total, call) => {
        const talkTimeSeconds = parseTimeToSeconds(
          call.talk_time || "00:00:00"
        );
        console.log(
          `📞 Call ${call.call_number}: ${call.talk_time} = ${talkTimeSeconds} seconds`
        );
        return total + talkTimeSeconds;
      },
      0
    );

    console.log("📊 Calculated from call details:", {
      totalCalls: actualTotalCalls,
      successfulCalls: actualSuccessfulCalls,
      totalTalkTimeSeconds: actualTotalTalkTimeSeconds,
    });
  }

  if (callDetails.outgoing_calls && Array.isArray(callDetails.outgoing_calls)) {
    actualTotalCalls += callDetails.outgoing_calls.length;
    actualSuccessfulCalls += callDetails.outgoing_calls.filter(
      (call) => call.status === "ANSWER"
    ).length;
    actualTotalTalkTimeSeconds += callDetails.outgoing_calls.reduce(
      (total, call) => {
        return total + parseTimeToSeconds(call.talk_time || "00:00:00");
      },
      0
    );
  }

  // Fallback to summary data if call_details is not available
  const totalCalls =
    actualTotalCalls ||
    parseInt(incomingCalls.total || 0) + parseInt(outgoingCalls.total || 0);
  const totalSuccessful =
    actualSuccessfulCalls ||
    parseInt(incomingCalls.successful || 0) +
      parseInt(outgoingCalls.successful || 0);
  const totalTalkTimeSeconds =
    actualTotalTalkTimeSeconds ||
    parseTimeToSeconds(incomingCalls.total_time) +
      parseTimeToSeconds(outgoingCalls.total_time);

  console.log("📈 Final calculated values:", {
    totalCalls,
    totalSuccessful,
    totalTalkTimeSeconds,
    totalTalkPay: calculateBasePay(totalTalkTimeSeconds),
    usedCallDetails: actualTotalCalls > 0,
  });

  // Format total talk time for display
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return {
    id: agent.agent_number || String(Date.now()),
    fullName: agent_name,
    period: { year, month },
    metrics: {
      incoming: totalCalls,
      unsuccessful: totalCalls - totalSuccessful,
      successful: totalSuccessful,
      averageTime:
        totalCalls > 0 ? Math.round(totalTalkTimeSeconds / totalCalls) : 0,
      totalTime: totalTalkTimeSeconds,
      minTime: incomingCalls.min_time || "00:00:00",
      maxTime: incomingCalls.max_time || "00:00:00",
      avgWaitTime: incomingCalls.avg_wait || "00:00:00",
      lastUpdated: agent.last_updated,
    },
    stats: {
      id: agent.agent_number || String(Date.now()),
      name: agent_name,
      incoming: totalCalls,
      failed: totalCalls - totalSuccessful,
      successful: totalSuccessful,
      totalTalkTime: formatTime(totalTalkTimeSeconds),
      totalTalkTimeSeconds: totalTalkTimeSeconds,
      ratePerSecond: RATE_PER_SECOND,
      totalTalkPay: calculateBasePay(totalTalkTimeSeconds),
      callCounts: {
        // These would need to come from your internal database
        // as the external API doesn't provide call type breakdown
        firstCalls: 0,
        secondCalls: 0,
        thirdCalls: 0,
        fourthCalls: 0,
        fifthCalls: 0,
        verifiedAccounts: 0,
      },
      fines: 0,
    },
    // Raw data for debugging
    rawApiData: apiResponse,
    // Additional debugging info
    calculatedFromCallDetails: actualTotalCalls > 0,
    callDetailsAvailable: !!(
      callDetails.incoming_calls && callDetails.incoming_calls.length > 0
    ),
  };
};

/**
 * Fetch agent metrics - Updated to use new API format
 * @param {string} agentName - Agent name
 * @param {boolean} forceRefresh - Whether to force refresh (ignored in new API)
 * @returns {Promise<Object>} Agent metrics data
 */
export const fetchAgentMetrics = async (agentName, forceRefresh = false) => {
  try {
    console.log(
      "Fetching metrics for agent:",
      agentName,
      forceRefresh ? "(forced refresh)" : ""
    );

    // Try new API first (current month)
    try {
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;

      return await fetchAgentMetricsByPeriod(
        agentName,
        currentYear,
        currentMonth
      );
    } catch (newApiError) {
      console.warn(
        "New API failed, trying previous month:",
        newApiError.message
      );

      // Try previous month if current month fails
      const currentDate = new Date();
      let prevYear = currentDate.getFullYear();
      let prevMonth = currentDate.getMonth(); // This gives us 0-11, so current month - 1

      if (prevMonth === 0) {
        prevMonth = 12;
        prevYear -= 1;
      }

      try {
        return await fetchAgentMetricsByPeriod(agentName, prevYear, prevMonth);
      } catch (prevMonthError) {
        console.error(
          "Both current and previous month failed:",
          prevMonthError.message
        );

        // Return default data structure to prevent UI breaking
        return {
          id: String(Date.now()),
          fullName: agentName,
          period: {
            year: currentDate.getFullYear(),
            month: currentDate.getMonth() + 1,
          },
          metrics: {
            incoming: 0,
            unsuccessful: 0,
            successful: 0,
            averageTime: 0,
            totalTime: 0,
            minTime: "00:00:00",
            maxTime: "00:00:00",
            avgWaitTime: "00:00:00",
            lastUpdated: new Date().toISOString(),
          },
          stats: {
            id: String(Date.now()),
            name: agentName,
            incoming: 0,
            failed: 0,
            successful: 0,
            totalTalkTime: "00:00:00",
            totalTalkTimeSeconds: 0,
            ratePerSecond: RATE_PER_SECOND,
            totalTalkPay: 0,
            callCounts: {
              firstCalls: 0,
              secondCalls: 0,
              thirdCalls: 0,
              fourthCalls: 0,
              fifthCalls: 0,
              verifiedAccounts: 0,
            },
            fines: 0,
          },
          isDefault: true,
        };
      }
    }
  } catch (error) {
    console.error("Error fetching agent metrics:", error);
    throw error;
  }
};

/**
 * Legacy function - kept for backward compatibility
 * @deprecated Use fetchAgentMetricsByPeriod instead
 */
export const fetchAgentMetricsLegacy = async (
  agentName,
  forceRefresh = false
) => {
  try {
    console.log(
      "Fetching metrics for agent (legacy):",
      agentName,
      forceRefresh ? "(forced refresh)" : ""
    );
    // Add timestamp to force refresh and bypass any caching
    const timestamp = forceRefresh ? `?t=${Date.now()}` : "";
    const response = await api.get(
      `/mongodb/agents/${encodeURIComponent(agentName)}${timestamp}`
    );
    console.log("Agent metrics response:", response.data);
    if (response.data.success && response.data.data.length > 0) {
      const latestData = response.data.data[0];
      return transformMetricsData(latestData);
    }
    throw new Error("No data found for agent");
  } catch (error) {
    console.error("Error fetching agent metrics:", error);
    throw error;
  }
};
export const fetchAllAgentsMetrics = async (
  startDate = null,
  endDate = null
) => {
  try {
    console.log("Fetching all agents metrics", { startDate, endDate });

    // Build query parameters for date range
    const params = new URLSearchParams();
    if (startDate) {
      params.append("startDate", startDate.toISOString());
    }
    if (endDate) {
      params.append("endDate", endDate.toISOString());
    }

    const queryString = params.toString();
    const performanceUrl = `/mongodb/agents/performance${
      queryString ? `?${queryString}` : ""
    }`;

    const agentsResponse = await api.get("/mongodb/agents");
    console.log("All agents response:", agentsResponse.data);
    if (!agentsResponse.data.success) {
      throw new Error("Failed to fetch agents list");
    }

    const performanceResponse = await api.get(performanceUrl);
    console.log("Performance response:", performanceResponse.data);
    if (!performanceResponse.data.success) {
      throw new Error("Failed to fetch agents performance");
    }

    const agentsData = performanceResponse.data.agents.map((agent) =>
      transformMetricsData(agent)
    );
    return agentsData;
  } catch (error) {
    console.error("Error fetching all agents metrics:", error);
    throw error;
  }
};
const transformMetricsData = (data) => {
  const incomingCalls = data.incoming_calls || {};
  const getId = (data) => {
    if (data._id) {
      return typeof data._id === "object" && data._id.toString
        ? data._id.toString()
        : data._id;
    }
    return data.agent_number || String(Date.now());
  };
  return {
    id: getId(data),
    fullName: data.agent_name,
    metrics: {
      incoming: parseInt(incomingCalls.total) || 0,
      unsuccessful: parseInt(incomingCalls.unsuccessful) || 0,
      successful: parseInt(incomingCalls.successful) || 0,
      averageTime: convertTimeStringToSeconds(incomingCalls.avg_time),
      totalTime: convertTimeStringToSeconds(incomingCalls.total_time),
      minTime: incomingCalls.min_time,
      maxTime: incomingCalls.max_time,
      avgWaitTime: incomingCalls.avg_wait,
      lastUpdated: data.last_updated || data.extracted_at,
    },
    stats: {
      id: getId(data),
      name: data.agent_name,
      incoming: parseInt(incomingCalls.total) || 0,
      failed: parseInt(incomingCalls.unsuccessful) || 0,
      successful: parseInt(incomingCalls.successful) || 0,
      totalTalkTime: incomingCalls.total_time || "00:00:00",
      totalTalkTimeSeconds: convertTimeStringToSeconds(
        incomingCalls.total_time
      ),
      ratePerSecond: RATE_PER_SECOND,
      totalTalkPay: calculateBasePay(
        convertTimeStringToSeconds(incomingCalls.total_time)
      ),
      callCounts: {
        firstCalls: data.call_counts?.firstCalls || 0,
        secondCalls: data.call_counts?.secondCalls || 0,
        thirdCalls: data.call_counts?.thirdCalls || 0,
        fourthCalls: data.call_counts?.fourthCalls || 0,
        fifthCalls: data.call_counts?.fifthCalls || 0,
        verifiedAccounts: data.call_counts?.verifiedAccounts || 0,
      },
      fines: data.fines || 0,
    },
  };
};
const convertTimeStringToSeconds = (timeString) => {
  if (!timeString) return 0;
  const [hours, minutes, seconds] = timeString.split(":").map(Number);
  return hours * 3600 + minutes * 60 + seconds;
};
const calculateTotalPay = (totalSeconds) => {
  return calculateBasePay(totalSeconds);
};

export const fetchAgentCallCountsInRange = async (
  agentId,
  startDate,
  endDate
) => {
  console.log(
    "⚠️ fetchAgentCallCountsInRange is deprecated - using new external API data instead"
  );
  console.log("Requested range:", { agentId, startDate, endDate });

  // Return empty data structure to avoid breaking existing code
  return {
    success: true,
    data: [],
    message:
      "Historical range data not available with new API - use period-specific data instead",
  };
};

export const fetchAgentEarningsHistory = async (
  agentId,
  startDate,
  endDate
) => {
  console.log(
    "⚠️ fetchAgentEarningsHistory is deprecated - using new external API data instead"
  );
  console.log("Requested history:", { agentId, startDate, endDate });

  try {
    // Use the new external API data instead of legacy range API
    const callCountsData = await fetchAgentCallCountsInRange(
      agentId,
      startDate,
      endDate
    );

    // Since the legacy API is not available, return empty earnings history
    const dailyEarnings = [];

    return {
      ...callCountsData,
      data: dailyEarnings,
    };
  } catch (error) {
    console.error("Error fetching agent earnings history:", error);
    throw error;
  }
};

/**
 * Fetch monthly history for current authenticated agent
 */
export const fetchAgentMonthlyHistory = async (monthsBack = 12) => {
  try {
    console.log(
      "📅 Fetching monthly history for current agent, monthsBack:",
      monthsBack
    );

    const response = await api.get(
      `/agent-monthly-history/me?monthsBack=${monthsBack}`
    );

    if (response.data.success) {
      console.log(
        "✅ Monthly history fetched successfully:",
        response.data.data
      );
      return response.data.data;
    }

    throw new Error(response.data.message || "Failed to fetch monthly history");
  } catch (error) {
    console.error("❌ Error fetching agent monthly history:", error);
    throw error;
  }
};

/**
 * Fetch monthly history for a specific agent (admin only)
 */
export const fetchAgentMonthlyHistoryByName = async (
  agentName,
  monthsBack = 12
) => {
  try {
    console.log(
      "📅 Fetching monthly history for agent:",
      agentName,
      "monthsBack:",
      monthsBack
    );

    const response = await api.get(
      `/agent-monthly-history/agent/${encodeURIComponent(
        agentName
      )}?monthsBack=${monthsBack}`
    );

    if (response.data.success) {
      console.log(
        "✅ Monthly history fetched successfully for",
        agentName,
        ":",
        response.data.data
      );
      return response.data.data;
    }

    throw new Error(response.data.message || "Failed to fetch monthly history");
  } catch (error) {
    console.error("❌ Error fetching agent monthly history by name:", error);
    throw error;
  }
};
