const axios = require("axios");
const User = require("../models/User");

const EXTERNAL_API_URL =
  "https://agent-report-1.onrender.com/api/mongodb/agents";

class AgentMonthlyHistoryService {
  constructor() {
    this.cache = new Map();
    this.cacheDuration = 30 * 60 * 1000; // 30 minutes cache
  }

  /**
   * Fetch agent data from external API for a specific period
   */
  async fetchAgentDataForPeriod(agentName, year, month) {
    try {
      console.log(
        `Fetching data for agent: ${agentName}, period: ${year}/${month}`
      );
      const response = await axios.get(
        `${EXTERNAL_API_URL}/${encodeURIComponent(agentName)}/${year}/${month}`,
        {
          timeout: 30000,
          headers: {
            Accept: "application/json",
            "User-Agent": "FTD-Dashboard/1.0",
          },
        }
      );

      if (!response.data || !response.data.success || !response.data.agent) {
        throw new Error("Invalid response format from external API");
      }

      return {
        ...response.data.agent,
        year,
        month,
        agent_name: response.data.agent_name,
      };
    } catch (error) {
      // If no data found for this month, return null instead of throwing
      if (error.response && error.response.status === 404) {
        console.log(`No data found for agent ${agentName} in ${year}/${month}`);
        return null;
      }
      console.error(
        `Error fetching agent data for ${year}/${month}:`,
        error.message
      );
      throw error;
    }
  }

  /**
   * Process a single month's data from external API
   */
  processMonthData(record) {
    if (!record) return null;

    const incomingCallsSummary = record.incoming_calls || {};
    const outgoingCallsSummary = record.outgoing_calls || {};
    const bonusCalculation = record.bonus_calculation || {};
    const callDetails = record.call_details || {};
    const incomingCalls = callDetails.incoming_calls || [];
    const outgoingCalls = callDetails.outgoing_calls || [];

    // Use the year and month from the record (passed from the API response)
    const year = record.year;
    const month = record.month;
    const monthDate = new Date(year, month - 1, 1);
    const monthName = monthDate.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });

    // Calculate totals from call details if available (more accurate)
    let totalCalls = 0;
    let successfulCalls = 0;
    let totalTalkTimeSeconds = 0;
    let longestCall = 0;
    let shortestCall = Number.MAX_SAFE_INTEGER;
    const callsByStatus = {
      ANSWER: 0,
      NOANSWER: 0,
      BUSY: 0,
      FAILED: 0,
    };

    // Process incoming calls
    if (incomingCalls.length > 0) {
      totalCalls += incomingCalls.length;
      incomingCalls.forEach((call) => {
        const status = call.status || "UNKNOWN";
        if (callsByStatus[status] !== undefined) {
          callsByStatus[status]++;
        }

        if (status === "ANSWER") {
          successfulCalls++;
        }

        if (call.talk_time && call.talk_time !== "00:00:00") {
          const talkTimeSeconds = this.timeToSeconds(call.talk_time);
          totalTalkTimeSeconds += talkTimeSeconds;

          if (talkTimeSeconds > longestCall) {
            longestCall = talkTimeSeconds;
          }
          if (talkTimeSeconds < shortestCall && talkTimeSeconds > 0) {
            shortestCall = talkTimeSeconds;
          }
        }
      });
    }

    // Process outgoing calls
    if (outgoingCalls.length > 0) {
      totalCalls += outgoingCalls.length;
      outgoingCalls.forEach((call) => {
        const status = call.status || "UNKNOWN";
        if (callsByStatus[status] !== undefined) {
          callsByStatus[status]++;
        }

        if (status === "ANSWER") {
          successfulCalls++;
        }

        if (call.talk_time && call.talk_time !== "00:00:00") {
          const talkTimeSeconds = this.timeToSeconds(call.talk_time);
          totalTalkTimeSeconds += talkTimeSeconds;

          if (talkTimeSeconds > longestCall) {
            longestCall = talkTimeSeconds;
          }
          if (talkTimeSeconds < shortestCall && talkTimeSeconds > 0) {
            shortestCall = talkTimeSeconds;
          }
        }
      });
    }

    // Fallback to summary data if call details are empty
    if (totalCalls === 0) {
      const incomingTotal = parseInt(incomingCallsSummary.total || "0");
      const outgoingTotal = parseInt(outgoingCallsSummary.total || "0");
      totalCalls = incomingTotal + outgoingTotal;

      const incomingSuccessful = parseInt(
        incomingCallsSummary.successful || "0"
      );
      const outgoingSuccessful = parseInt(
        outgoingCallsSummary.successful || "0"
      );
      successfulCalls = incomingSuccessful + outgoingSuccessful;

      const incomingTalkTime = incomingCallsSummary.total_time || "00:00:00";
      const outgoingTalkTime = outgoingCallsSummary.total_time || "00:00:00";
      totalTalkTimeSeconds =
        this.timeToSeconds(incomingTalkTime) +
        this.timeToSeconds(outgoingTalkTime);

      callsByStatus.ANSWER = successfulCalls;
      callsByStatus.NOANSWER = totalCalls - successfulCalls;
    }

    // Handle edge cases
    if (shortestCall === Number.MAX_SAFE_INTEGER) {
      shortestCall = 0;
    }

    // Calculate derived metrics
    const totalTalkTimeFormatted =
      this.secondsToTimeString(totalTalkTimeSeconds);
    const averageCallDuration =
      successfulCalls > 0
        ? Math.round(totalTalkTimeSeconds / successfulCalls)
        : 0;
    const successRate =
      totalCalls > 0 ? Math.round((successfulCalls / totalCalls) * 100) : 0;
    const totalEarnings = bonusCalculation.total_bonus || 0;
    const earningsPerCall =
      totalCalls > 0 ? (totalEarnings / totalCalls).toFixed(2) : 0;
    const avgTalkTimeMinutes =
      totalCalls > 0 ? Math.round(totalTalkTimeSeconds / totalCalls / 60) : 0;

    console.log(`Processed data for ${year}/${month}:`, {
      totalCalls,
      successfulCalls,
      totalTalkTimeSeconds,
      totalEarnings,
      callsByStatus,
    });

    return {
      year,
      month,
      monthName,
      totalCalls,
      successfulCalls,
      totalTalkTimeSeconds,
      totalTalkTimeFormatted,
      totalEarnings,
      callsByStatus,
      averageCallDuration,
      longestCall,
      shortestCall,
      successRate,
      earningsPerCall,
      avgTalkTimeMinutes,
    };
  }

  /**
   * Convert time string (HH:MM:SS) to seconds
   */
  timeToSeconds(timeString) {
    if (!timeString || timeString === "00:00:00") return 0;
    const [hours, minutes, seconds] = timeString.split(":").map(Number);
    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * Convert seconds to time string (HH:MM:SS)
   */
  secondsToTimeString(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
  }

  /**
   * Get monthly history for an agent
   */
  async getAgentMonthlyHistory(agentName, monthsBack = 12) {
    try {
      const cacheKey = `${agentName}_${monthsBack}`;

      // Check cache first
      if (this.cache.has(cacheKey)) {
        const cachedData = this.cache.get(cacheKey);
        if (Date.now() - cachedData.timestamp < this.cacheDuration) {
          console.log(`Returning cached monthly history for ${agentName}`);
          return cachedData.data;
        }
      }

      console.log(`Fetching ${monthsBack} months of history for ${agentName}`);

      // Calculate the months to fetch
      const currentDate = new Date();
      const monthsToFetch = [];

      for (let i = 0; i < monthsBack; i++) {
        const targetDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() - i,
          1
        );
        monthsToFetch.push({
          year: targetDate.getFullYear(),
          month: targetDate.getMonth() + 1,
        });
      }

      console.log(`Fetching data for months:`, monthsToFetch);

      // Fetch data for each month in parallel
      const monthlyDataPromises = monthsToFetch.map(({ year, month }) =>
        this.fetchAgentDataForPeriod(agentName, year, month).catch((error) => {
          console.warn(
            `Failed to fetch data for ${year}/${month}:`,
            error.message
          );
          return null; // Return null for failed months
        })
      );

      const monthlyDataResults = await Promise.all(monthlyDataPromises);

      // Process each month's data
      const historyArray = monthlyDataResults
        .map((record) => this.processMonthData(record))
        .filter((data) => data !== null); // Remove months with no data

      console.log(
        `Successfully fetched data for ${historyArray.length} out of ${monthsBack} months`
      );

      // Calculate totals and trends
      const totals = this.calculateTotals(historyArray);
      const trends = this.calculateTrends(historyArray);

      const result = {
        agentName,
        monthlyHistory: historyArray,
        totals,
        trends,
        generatedAt: new Date(),
        dataSource: "external_api",
        monthsFetched: historyArray.length,
        monthsRequested: monthsBack,
      };

      // Cache the result
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
      });

      return result;
    } catch (error) {
      console.error("Error getting agent monthly history:", error.message);
      throw error;
    }
  }

  /**
   * Calculate totals across all months
   */
  calculateTotals(historyArray) {
    return historyArray.reduce(
      (totals, month) => {
        return {
          totalCalls: totals.totalCalls + month.totalCalls,
          totalSuccessfulCalls:
            totals.totalSuccessfulCalls + month.successfulCalls,
          totalTalkTimeSeconds:
            totals.totalTalkTimeSeconds + month.totalTalkTimeSeconds,
          totalEarnings: totals.totalEarnings + month.totalEarnings,
          monthsActive: totals.monthsActive + 1,
        };
      },
      {
        totalCalls: 0,
        totalSuccessfulCalls: 0,
        totalTalkTimeSeconds: 0,
        totalEarnings: 0,
        monthsActive: 0,
      }
    );
  }

  /**
   * Calculate trends (comparing latest month vs previous months)
   */
  calculateTrends(historyArray) {
    if (historyArray.length < 2) {
      return {
        callsTrend: 0,
        earningsTrend: 0,
        talkTimeTrend: 0,
        successRateTrend: 0,
      };
    }

    const latest = historyArray[0];
    const previous = historyArray[1];

    return {
      callsTrend: this.calculatePercentageChange(
        previous.totalCalls,
        latest.totalCalls
      ),
      earningsTrend: this.calculatePercentageChange(
        previous.totalEarnings,
        latest.totalEarnings
      ),
      talkTimeTrend: this.calculatePercentageChange(
        previous.totalTalkTimeSeconds,
        latest.totalTalkTimeSeconds
      ),
      successRateTrend: this.calculatePercentageChange(
        previous.successRate,
        latest.successRate
      ),
    };
  }

  /**
   * Calculate percentage change between two values
   */
  calculatePercentageChange(oldValue, newValue) {
    if (oldValue === 0) return newValue > 0 ? 100 : 0;
    return Math.round(((newValue - oldValue) / oldValue) * 100);
  }

  /**
   * Clear cache for specific agent or all agents
   */
  clearCache(agentName = null) {
    if (agentName) {
      const keysToDelete = Array.from(this.cache.keys()).filter((key) =>
        key.startsWith(agentName)
      );
      keysToDelete.forEach((key) => this.cache.delete(key));
    } else {
      this.cache.clear();
    }
  }
}

module.exports = new AgentMonthlyHistoryService();
