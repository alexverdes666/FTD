const axios = require("axios");
const AgentPerformance = require("../models/AgentPerformance");
const User = require("../models/User");

const EXTERNAL_API_URL =
  "https://agent-report-1.onrender.com/api/mongodb/agents/performance";

class ExternalAgentPerformanceService {
  constructor() {
    this.lastFetchTime = null;
    this.cacheDuration = 10 * 60 * 1000; // 10 minutes cache (increased for better performance)
  }

  /**
   * Fetch agent performance data from external API
   */
  async fetchExternalData() {
    try {
      console.log("Fetching agent performance data from external API...");
      const response = await axios.get(EXTERNAL_API_URL, {
        timeout: 30000, // 30 second timeout
        headers: {
          Accept: "application/json",
          "User-Agent": "FTD-Dashboard/1.0",
        },
      });

      if (!response.data || !response.data.agents) {
        throw new Error("Invalid response format from external API");
      }

      console.log(
        `Fetched ${response.data.agents.length} agent records from external API`
      );
      return response.data.agents;
    } catch (error) {
      console.error(
        "Error fetching external agent performance data:",
        error.message
      );
      throw error;
    }
  }

  /**
   * Transform external data to match our AgentPerformance model
   */
  transformAgentData(externalAgent) {
    const {
      agent_name,
      agent_number,
      call_details,
      incoming_calls,
      outgoing_calls,
      bonus_calculation,
      last_updated,
      total_calls,
    } = externalAgent;

    // Parse call details to extract meaningful metrics
    const callsMade = call_details?.total_calls || total_calls || 0;
    const successfulCalls = parseInt(incoming_calls?.successful || "0");
    const totalTime = incoming_calls?.total_time || "00:00:00";

    // Convert time string to minutes
    const timeToMinutes = (timeStr) => {
      if (!timeStr || timeStr === "00:00:00") return 0;
      const [hours, minutes, seconds] = timeStr.split(":").map(Number);
      return hours * 60 + minutes + Math.round(seconds / 60);
    };

    const callTimeMinutes = timeToMinutes(totalTime);

    // Calculate earnings based on bonus calculation
    const earnings = bonus_calculation?.total_bonus || 0;

    // Calculate conversion metrics
    const leadsContacted = callsMade;
    const leadsConverted = successfulCalls;

    return {
      agent_name,
      agent_number,
      callTimeMinutes,
      earnings,
      penalties: 0, // Not provided in external data
      leadsContacted,
      leadsConverted,
      callsCompleted: callsMade,
      breakdown: {
        ftdCalls: 0, // Would need to be calculated from call details
        fillerCalls: 0,
        coldCalls: callsMade,
        ftdConversions: 0,
        fillerConversions: 0,
        coldConversions: leadsConverted,
      },
      callCounts: {
        firstCalls: bonus_calculation?.unique_days || 0,
        secondCalls: 0,
        thirdCalls: 0,
        fourthCalls: 0,
        fifthCalls: 0,
        verifiedAccounts: 0,
      },
      rawData: externalAgent, // Store original data for reference
      lastUpdated: new Date(last_updated || Date.now()),
    };
  }

  /**
   * Find or create user by agent name/number
   */
  async findOrCreateAgent(agentName, agentNumber) {
    try {
      // Pad agent number to 4 digits to match validation requirements
      const paddedAgentNumber = agentNumber.toString().padStart(4, "0");

      // First try to find by agent name
      let user = await User.findOne({
        fullName: { $regex: new RegExp(agentName, "i") },
        role: "agent",
      });

      if (!user) {
        // Try to find by four digit code (padded agent number)
        user = await User.findOne({
          fourDigitCode: paddedAgentNumber,
          role: "agent",
        });
      }

      if (!user) {
        // Also try to find by original agent number (in case it was stored before)
        user = await User.findOne({
          fourDigitCode: agentNumber,
          role: "agent",
        });
      }

      if (!user) {
        // Create a new agent user with padded number
        user = new User({
          fullName: agentName,
          fourDigitCode: paddedAgentNumber,
          email: `agent${paddedAgentNumber}@temp.com`, // Temporary email
          role: "agent",
          status: "approved",
          isActive: true,
          password: "tempPassword123!", // This should be changed on first login
        });
        await user.save();
        console.log(
          `Created new agent user: ${agentName} (${paddedAgentNumber})`
        );
      }

      return user;
    } catch (error) {
      console.error(
        `Error finding/creating agent ${agentName}:`,
        error.message
      );
      throw error;
    }
  }

  /**
   * Save or update agent performance data
   */
  async saveAgentPerformance(transformedData) {
    try {
      const { agent_name, agent_number } = transformedData;

      // Find or create the agent user
      const agent = await this.findOrCreateAgent(agent_name, agent_number);

      // Use today's date for the performance record
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Update or create performance record
      const performanceData = {
        agent: agent._id,
        date: today,
        callTimeMinutes: transformedData.callTimeMinutes,
        earnings: transformedData.earnings,
        penalties: transformedData.penalties,
        leadsContacted: transformedData.leadsContacted,
        leadsConverted: transformedData.leadsConverted,
        callsCompleted: transformedData.callsCompleted,
        breakdown: transformedData.breakdown,
        callCounts: transformedData.callCounts,
        notes: `Updated from external API at ${new Date().toISOString()}`,
        isVerified: false,
      };

      const result = await AgentPerformance.findOneAndUpdate(
        { agent: agent._id, date: today },
        performanceData,
        { upsert: true, new: true, runValidators: true }
      );

      console.log(
        `Updated performance for agent ${agent_name} (${agent_number})`
      );
      return result;
    } catch (error) {
      console.error("Error saving agent performance:", error.message);
      throw error;
    }
  }

  /**
   * Sync all agent performance data from external API
   */
  async syncAllAgentPerformance() {
    try {
      console.log("Starting agent performance sync...");

      const externalAgents = await this.fetchExternalData();
      const results = [];

      for (const externalAgent of externalAgents) {
        try {
          const transformedData = this.transformAgentData(externalAgent);
          const savedPerformance = await this.saveAgentPerformance(
            transformedData
          );
          results.push(savedPerformance);
        } catch (error) {
          console.error(
            `Error processing agent ${externalAgent.agent_name}:`,
            error.message
          );
          // Continue with other agents
        }
      }

      this.lastFetchTime = new Date();

      console.log(
        `Successfully synced ${results.length} agent performance records`
      );
      return {
        success: true,
        processed: results.length,
        total: externalAgents.length,
        lastSync: this.lastFetchTime,
      };
    } catch (error) {
      console.error("Error syncing agent performance:", error.message);
      throw error;
    }
  }

  /**
   * Get cached data or fetch fresh data if cache expired
   */
  async getAgentPerformanceData(forceRefresh = false) {
    const now = new Date();
    const shouldRefresh =
      forceRefresh ||
      !this.lastFetchTime ||
      now - this.lastFetchTime > this.cacheDuration;

    // If we need to refresh, do it but don't wait for it in some cases
    if (shouldRefresh) {
      if (forceRefresh) {
        // If explicitly forced, wait for the sync
        await this.syncAllAgentPerformance();
      } else {
        // If just cache expired, sync in background and return existing data
        this.syncAllAgentPerformance().catch((error) => {
          console.error("Background sync failed:", error.message);
        });
      }
    }

    // Always return data from our database (might be slightly stale if background sync is running)
    return await AgentPerformance.find({
      date: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0)),
      },
    }).populate("agent", "fullName fourDigitCode email");
  }

  /**
   * Get top performers for a specific time period
   */
  async getTopPerformers(period = "daily", limit = 10) {
    try {
      // Ensure we have recent data
      await this.getAgentPerformanceData();

      const now = new Date();
      let startDate;

      switch (period) {
        case "daily":
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case "weekly":
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case "monthly":
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
        case "yearly":
          startDate = new Date(now.setFullYear(now.getFullYear() - 1));
          break;
        case "all":
          startDate = new Date(0); // Beginning of time
          break;
        default:
          startDate = new Date(now.setHours(0, 0, 0, 0));
      }

      const topPerformers = await AgentPerformance.aggregate([
        {
          $match: {
            date: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: "$agent",
            totalCalls: { $sum: "$callsCompleted" },
            totalEarnings: { $sum: "$earnings" },
            totalLeadsConverted: { $sum: "$leadsConverted" },
            totalLeadsContacted: { $sum: "$leadsContacted" },
            totalCallTime: { $sum: "$callTimeMinutes" },
            averageCallQuality: {
              $avg: {
                $cond: {
                  if: { $gt: ["$leadsContacted", 0] },
                  then: { $divide: ["$leadsConverted", "$leadsContacted"] },
                  else: 0,
                },
              },
            },
            recordCount: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "agent",
          },
        },
        {
          $unwind: "$agent",
        },
        {
          $project: {
            agent: {
              id: "$agent._id",
              fullName: "$agent.fullName",
              fourDigitCode: "$agent.fourDigitCode",
            },
            totalCalls: 1,
            totalEarnings: { $round: ["$totalEarnings", 2] },
            totalLeadsConverted: 1,
            totalLeadsContacted: 1,
            totalCallTime: 1,
            averageCallQuality: { $round: ["$averageCallQuality", 3] },
            successRate: {
              $round: [
                {
                  $cond: {
                    if: { $gt: ["$totalLeadsContacted", 0] },
                    then: {
                      $multiply: [
                        {
                          $divide: [
                            "$totalLeadsConverted",
                            "$totalLeadsContacted",
                          ],
                        },
                        100,
                      ],
                    },
                    else: 0,
                  },
                },
                1,
              ],
            },
            recordCount: 1,
          },
        },
        {
          $sort: { totalEarnings: -1 },
        },
        {
          $limit: parseInt(limit),
        },
      ]);

      return topPerformers;
    } catch (error) {
      console.error("Error getting top performers:", error.message);
      return [];
    }
  }
}

module.exports = new ExternalAgentPerformanceService();
