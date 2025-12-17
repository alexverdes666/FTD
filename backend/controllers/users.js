const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Lead = require("../models/Lead");
const AgentPerformance = require("../models/AgentPerformance");
const externalAgentPerformanceService = require("../services/externalAgentPerformanceService");
exports.getUsers = async (req, res, next) => {
  try {
    const { role, isActive, status, search, page = 1, limit = 10 } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (status) {
      filter.status = status;
    } else if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;
    const users = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    const total = await User.countDocuments(filter);
    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalUsers: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getAgentsWithLeadStats = async (req, res, next) => {
  try {
    // Fetch all active, approved agents
    const agents = await User.find({
      role: "agent",
      isActive: true,
      status: "approved"
    })
      .select("-password")
      .sort({ fullName: 1 });

    // Calculate 10-day cooldown threshold
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

    // Aggregate lead stats grouped by assignedAgent
    const leadStats = await Lead.aggregate([
      {
        $match: {
          assignedAgent: { $ne: null },
          leadType: { $in: ["ftd", "filler"] }
        }
      },
      {
        $group: {
          _id: "$assignedAgent",
          total: { $sum: 1 },
          onCooldown: {
            $sum: {
              $cond: [
                { $and: [
                  { $ne: ["$lastUsedInOrder", null] },
                  { $gte: ["$lastUsedInOrder", tenDaysAgo] }
                ]},
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    // Create a map of agentId -> leadStats
    const statsMap = new Map();
    leadStats.forEach((stat) => {
      statsMap.set(stat._id.toString(), {
        total: stat.total,
        onCooldown: stat.onCooldown,
        available: stat.total - stat.onCooldown
      });
    });

    // Attach leadStats to each agent
    const agentsWithStats = agents.map((agent) => {
      const agentObj = agent.toObject();
      const stats = statsMap.get(agent._id.toString());
      agentObj.leadStats = stats || { total: 0, onCooldown: 0, available: 0 };
      return agentObj;
    });

    res.status(200).json({
      success: true,
      data: agentsWithStats
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get agents with lead stats filtered by specific criteria
 * This endpoint returns agents who have leads matching:
 * - Lead type (ftd/filler)
 * - Country filter
 * - NOT assigned to the specified client network
 * - NOT assigned to any of the specified client brokers
 */
exports.getAgentsWithFilteredLeadStats = async (req, res, next) => {
  try {
    const { leadType, country, clientNetwork, clientBrokers = [] } = req.body;

    // Validate required fields
    if (!leadType || !['ftd', 'filler'].includes(leadType)) {
      return res.status(400).json({
        success: false,
        message: "leadType must be 'ftd' or 'filler'",
      });
    }

    if (!country) {
      return res.status(400).json({
        success: false,
        message: "country is required",
      });
    }

    if (!clientNetwork) {
      return res.status(400).json({
        success: false,
        message: "clientNetwork is required",
      });
    }

    // Normalize IDs to strings for consistent comparison
    const clientNetworkStr = clientNetwork.toString();
    const clientBrokersStr = (clientBrokers || []).map(id => id.toString());

    console.log(`[FILTERED-AGENTS] Fetching agents for leadType=${leadType}, country=${country}, clientNetwork=${clientNetworkStr}, clientBrokers=[${clientBrokersStr.join(', ')}]`);

    // Fetch all active, approved agents
    const agents = await User.find({
      role: "agent",
      isActive: true,
      status: "approved"
    })
      .select("-password")
      .sort({ fullName: 1 });

    // Calculate 10-day cooldown threshold
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

    // Fetch all leads matching base criteria (leadType, country, has assigned agent)
    // We'll filter client network and brokers in memory since they use instance methods
    const baseQuery = {
      leadType: leadType,
      country: new RegExp(country, "i"),
      assignedAgent: { $ne: null },
    };

    const leads = await Lead.find(baseQuery).select(
      "assignedAgent lastUsedInOrder clientNetworkHistory assignedClientBrokers"
    );

    console.log(`[FILTERED-AGENTS] Found ${leads.length} total ${leadType} leads with agents for country ${country}`);

    // Filter leads by client network and client brokers criteria
    const filteredLeads = leads.filter((lead) => {
      // Exclude leads already assigned to the selected client network
      // A lead is excluded if it has EVER been sent to this client network
      const assignedToClientNetwork = (lead.clientNetworkHistory || []).some((history) => {
        if (!history.clientNetwork) return false;
        return history.clientNetwork.toString() === clientNetworkStr;
      });
      
      if (assignedToClientNetwork) {
        return false; // Exclude this lead
      }

      // Exclude leads assigned to any of the selected client brokers (if any)
      if (clientBrokersStr.length > 0) {
        const assignedToClientBroker = clientBrokersStr.some((brokerId) =>
          (lead.assignedClientBrokers || []).some(
            (assignedBrokerId) => assignedBrokerId && assignedBrokerId.toString() === brokerId
          )
        );
        if (assignedToClientBroker) {
          return false; // Exclude this lead
        }
      }

      return true; // Include this lead - it meets all criteria
    });

    console.log(`[FILTERED-AGENTS] After filtering: ${filteredLeads.length} leads match criteria (excluded ${leads.length - filteredLeads.length} leads)`);

    // Group leads by agent and calculate stats FROM FILTERED LEADS ONLY
    const agentStatsMap = new Map();
    
    filteredLeads.forEach((lead) => {
      const agentId = lead.assignedAgent.toString();
      
      if (!agentStatsMap.has(agentId)) {
        agentStatsMap.set(agentId, {
          totalMatching: 0,
          onCooldown: 0,
        });
      }

      const stats = agentStatsMap.get(agentId);
      stats.totalMatching++;

      // Check if lead is on cooldown (within last 10 days)
      if (lead.lastUsedInOrder && lead.lastUsedInOrder >= tenDaysAgo) {
        stats.onCooldown++;
      }
    });

    // Also calculate unassigned leads stats (leads without an agent)
    const unassignedQuery = {
      leadType: leadType,
      country: new RegExp(country, "i"),
      assignedAgent: null,
    };

    const unassignedLeads = await Lead.find(unassignedQuery).select(
      "lastUsedInOrder clientNetworkHistory assignedClientBrokers"
    );

    console.log(`[FILTERED-AGENTS] Found ${unassignedLeads.length} total unassigned ${leadType} leads`);

    // Filter unassigned leads by same criteria
    const filteredUnassignedLeads = unassignedLeads.filter((lead) => {
      const assignedToClientNetwork = (lead.clientNetworkHistory || []).some((history) => {
        if (!history.clientNetwork) return false;
        return history.clientNetwork.toString() === clientNetworkStr;
      });
      if (assignedToClientNetwork) return false;

      if (clientBrokersStr.length > 0) {
        const assignedToClientBroker = clientBrokersStr.some((brokerId) =>
          (lead.assignedClientBrokers || []).some(
            (assignedBrokerId) => assignedBrokerId && assignedBrokerId.toString() === brokerId
          )
        );
        if (assignedToClientBroker) return false;
      }

      return true;
    });

    console.log(`[FILTERED-AGENTS] After filtering unassigned: ${filteredUnassignedLeads.length} leads match criteria`);

    // Calculate unassigned leads stats FROM FILTERED LEADS ONLY
    let unassignedTotal = 0;
    let unassignedOnCooldown = 0;
    filteredUnassignedLeads.forEach((lead) => {
      unassignedTotal++;
      if (lead.lastUsedInOrder && lead.lastUsedInOrder >= tenDaysAgo) {
        unassignedOnCooldown++;
      }
    });

    // Attach filtered leadStats to each agent
    const agentsWithFilteredStats = agents.map((agent) => {
      const agentObj = agent.toObject();
      const stats = agentStatsMap.get(agent._id.toString());
      
      if (stats) {
        agentObj.filteredLeadStats = {
          totalMatching: stats.totalMatching,
          onCooldown: stats.onCooldown,
          available: stats.totalMatching - stats.onCooldown,
        };
      } else {
        agentObj.filteredLeadStats = {
          totalMatching: 0,
          onCooldown: 0,
          available: 0,
        };
      }
      
      return agentObj;
    });

    // Filter to only include agents with matching leads (totalMatching > 0)
    const agentsWithAvailableLeads = agentsWithFilteredStats.filter(
      (agent) => agent.filteredLeadStats.totalMatching > 0
    );

    // Log summary for debugging
    console.log(`[FILTERED-AGENTS] Summary: ${agentsWithAvailableLeads.length} agents have matching leads`);
    agentsWithAvailableLeads.forEach(agent => {
      console.log(`[FILTERED-AGENTS]   - ${agent.fullName}: ${agent.filteredLeadStats.available} available, ${agent.filteredLeadStats.onCooldown} on cooldown (${agent.filteredLeadStats.totalMatching} total matching)`);
    });
    console.log(`[FILTERED-AGENTS] Unassigned leads: ${unassignedTotal - unassignedOnCooldown} available, ${unassignedOnCooldown} on cooldown`);

    res.status(200).json({
      success: true,
      data: agentsWithAvailableLeads,
      unassignedLeads: {
        totalMatching: unassignedTotal,
        onCooldown: unassignedOnCooldown,
        available: unassignedTotal - unassignedOnCooldown,
      },
      filterCriteria: {
        leadType,
        country,
        clientNetwork,
        clientBrokers,
      },
    });
  } catch (error) {
    console.error("Error in getAgentsWithFilteredLeadStats:", error);
    next(error);
  }
};

exports.approveUser = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }
    const { role } = req.body;
    const userId = req.params.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    if (user.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `User is not pending approval. Current status: ${user.status}`,
      });
    }
    user.status = "approved";
    user.isActive = true;
    user.role = role;
    if (role === "lead_manager") {
      user.leadManagerStatus = "approved";
      user.leadManagerApprovedBy = req.user._id;
      user.leadManagerApprovedAt = new Date();
      user.permissions.canManageLeads = true;
    }
    if (role === "refunds_manager") {
      user.permissions.canManageRefunds = true;
    }
    if (role === "inventory_manager") {
      user.permissions.canManageSimCards = true;
    }
    if (role === "agent" && !user.fourDigitCode) {
      let code;
      let codeExists = true;
      while (codeExists) {
        code = Math.floor(1000 + Math.random() * 9000).toString();
        codeExists = await User.findOne({ fourDigitCode: code });
      }
      user.fourDigitCode = code;
    }
    const updatedUser = await user.save();
    res.status(200).json({
      success: true,
      message: "User approved and activated successfully",
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};
exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};
exports.createUser = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }
    const { email, password, fullName, role, fourDigitCode, permissions } =
      req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    }
    const defaultPermissions = {
      canCreateOrders: true,
      canManageLeads: role === "lead_manager",
      canManageRefunds: role === "refunds_manager",
      canManageSimCards: role === "inventory_manager",
    };
    const userData = {
      email,
      password,
      fullName,
      role,
      permissions: permissions || defaultPermissions,
      isActive: true,
      status: "approved",
    };
    if (role === "lead_manager") {
      userData.leadManagerStatus = "approved";
      userData.leadManagerApprovedBy = req.user._id;
      userData.leadManagerApprovedAt = new Date();
    } else {
      userData.leadManagerStatus = "not_applicable";
    }
    if (fourDigitCode) {
      const existingCode = await User.findOne({ fourDigitCode });
      if (existingCode) {
        return res.status(400).json({
          success: false,
          message: "Four digit code already in use",
        });
      }
      userData.fourDigitCode = fourDigitCode;
    }
    const user = await User.create(userData);
    user.password = undefined;
    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};
exports.updateUser = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }
    const { fullName, email, role, fourDigitCode, isActive } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Email already in use",
        });
      }
    }
    if (fourDigitCode && fourDigitCode !== user.fourDigitCode) {
      const existingCode = await User.findOne({ fourDigitCode });
      if (existingCode) {
        return res.status(400).json({
          success: false,
          message: "Four digit code already in use",
        });
      }
    }
    const updateData = {};
    if (fullName) updateData.fullName = fullName;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (fourDigitCode) updateData.fourDigitCode = fourDigitCode;
    if (isActive !== undefined) updateData.isActive = isActive;
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

exports.adminChangeUserPassword = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const { newPassword } = req.body;
    const userId = req.params.id;

    // Find the user to update
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update the password - the pre-save hook will handle hashing
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: "User password updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

exports.updateUserPermissions = async (req, res, next) => {
  try {
    const { permissions } = req.body;
    if (!permissions || typeof permissions !== "object") {
      return res.status(400).json({
        success: false,
        message: "Valid permissions object is required",
      });
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { permissions },
      { new: true, runValidators: true }
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    res.status(200).json({
      success: true,
      message: "User permissions updated successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    res.status(200).json({
      success: true,
      message: "User deactivated successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

exports.permanentDeleteUser = async (req, res, next) => {
  try {
    const userId = req.params.id;
    
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Prevent deleting yourself
    if (userId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account",
      });
    }

    // Permanently delete the user from the database
    await User.findByIdAndDelete(userId);

    res.status(200).json({
      success: true,
      message: "User permanently deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
exports.getUserStats = async (req, res, next) => {
  try {
    const userStats = await User.aggregate([
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
          active: {
            $sum: {
              $cond: [{ $eq: ["$isActive", true] }, 1, 0],
            },
          },
        },
      },
    ]);
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const newUsersThisMonth = await User.countDocuments({
      createdAt: {
        $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      },
    });
    const stats = {
      total: totalUsers,
      active: activeUsers,
      inactive: totalUsers - activeUsers,
      newThisMonth: newUsersThisMonth,
      byRole: {},
    };
    userStats.forEach((stat) => {
      stats.byRole[stat._id] = {
        total: stat.count,
        active: stat.active,
        inactive: stat.count - stat.active,
      };
    });

    // Add activeAgents field for dashboard compatibility
    stats.activeAgents = stats.byRole.agent?.active || 0;

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};
exports.getAgentPerformance = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const agentId = req.params.id;
    if (req.user.role !== "admin" && req.user.id !== agentId) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to access this performance data",
      });
    }
    const dateFilter = { agent: agentId };
    if (startDate || endDate) {
      dateFilter.date = {};
      if (startDate) dateFilter.date.$gte = new Date(startDate);
      if (endDate) dateFilter.date.$lte = new Date(endDate);
    }
    const performance = await AgentPerformance.find(dateFilter)
      .populate("agent", "fullName fourDigitCode")
      .sort({ date: -1 });
    res.status(200).json({
      success: true,
      data: performance,
    });
  } catch (error) {
    next(error);
  }
};
exports.updateAgentPerformance = async (req, res, next) => {
  try {
    const { date, metrics } = req.body;
    const agentId = req.params.id;
    if (!date || !metrics) {
      return res.status(400).json({
        success: false,
        message: "Date and metrics are required",
      });
    }
    const agent = await User.findById(agentId);
    if (!agent || agent.role !== "agent") {
      return res.status(404).json({
        success: false,
        message: "Agent not found",
      });
    }
    const performance = await AgentPerformance.findOneAndUpdate(
      { agent: agentId, date: new Date(date) },
      { ...metrics },
      { upsert: true, new: true, runValidators: true }
    ).populate("agent", "fullName fourDigitCode");
    res.status(200).json({
      success: true,
      message: "Agent performance updated successfully",
      data: performance,
    });
  } catch (error) {
    next(error);
  }
};
exports.getTopPerformers = async (req, res, next) => {
  try {
    const { period = "daily", limit = 10, forceRefresh = false } = req.query;

    // Sync data from external API first
    if (forceRefresh === "true") {
      await externalAgentPerformanceService.syncAllAgentPerformance();
    }

    // Get top performers using the new service
    const topPerformers =
      await externalAgentPerformanceService.getTopPerformers(period, limit);

    res.status(200).json({
      success: true,
      data: topPerformers,
      period: period,
      lastSync: externalAgentPerformanceService.lastFetchTime,
    });
  } catch (error) {
    console.error("Error in getTopPerformers:", error.message);
    next(error);
  }
};
exports.getDailyTeamStats = async (req, res, next) => {
  try {
    const { 
      date = new Date().toISOString().split("T")[0],
      month = new Date().getMonth() + 1,
      year = new Date().getFullYear()
    } = req.query;

    // Parse month and year parameters
    const targetMonth = parseInt(month);
    const targetYear = parseInt(year);
    
    // Calculate month date range for performance aggregation
    const startOfMonth = new Date(targetYear, targetMonth - 1, 1);
    const endOfMonth = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

    console.log(`📊 Getting team stats for ${targetMonth}/${targetYear} (${startOfMonth.toISOString()} to ${endOfMonth.toISOString()})`);

    // Get active agents count directly from User model
    const activeAgentsCount = await User.countDocuments({
      role: "agent",
      isActive: true,
      status: "approved"
    });

    // Get monthly agent performance data (aggregated for the selected month)
    const monthlyPerformance = await AgentPerformance.aggregate([
      {
        $match: {
          date: { $gte: startOfMonth, $lte: endOfMonth }
        }
      },
      {
        $group: {
          _id: null,
          totalCalls: { $sum: "$callsCompleted" },
          totalEarnings: { $sum: "$earnings" },
          totalLeadsContacted: { $sum: "$leadsContacted" },
          totalLeadsConverted: { $sum: "$leadsConverted" },
          totalCallTime: { $sum: "$callTimeMinutes" },
          activeAgents: { $addToSet: "$agent" }
        }
      }
    ]);

    const performanceData = monthlyPerformance.length > 0 ? monthlyPerformance[0] : {
      totalCalls: 0,
      totalEarnings: 0,
      totalLeadsContacted: 0,
      totalLeadsConverted: 0,
      totalCallTime: 0,
      activeAgents: []
    };

    // Calculate average call quality
    const averageCallQuality =
      performanceData.totalLeadsContacted > 0
        ? Math.round(
            (performanceData.totalLeadsConverted / performanceData.totalLeadsContacted) *
              100
          ) / 100
        : 0;

    const finalStats = {
      totalAgents: activeAgentsCount,
      totalCalls: performanceData.totalCalls,
      totalEarnings: Math.round(performanceData.totalEarnings * 100) / 100,
      totalLeadsContacted: performanceData.totalLeadsContacted,
      totalLeadsConverted: performanceData.totalLeadsConverted,
      averageCallQuality: averageCallQuality,
      totalCallTime: performanceData.totalCallTime,
      period: {
        month: targetMonth,
        year: targetYear,
        startDate: startOfMonth.toISOString(),
        endDate: endOfMonth.toISOString()
      }
    };

    console.log(`✅ Team stats calculated for ${targetMonth}/${targetYear}:`, {
      totalAgents: finalStats.totalAgents,
      totalCalls: finalStats.totalCalls,
      totalEarnings: finalStats.totalEarnings,
      totalLeadsConverted: finalStats.totalLeadsConverted
    });

    res.status(200).json({
      success: true,
      data: finalStats,
      date: date,
    });
  } catch (error) {
    console.error("Error in getDailyTeamStats:", error);
    next(error);
  }
};

exports.syncAgentPerformance = async (req, res, next) => {
  try {
    const result =
      await externalAgentPerformanceService.syncAllAgentPerformance();
    res.status(200).json({
      success: true,
      message: "Agent performance data synced successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error syncing agent performance:", error.message);
    next(error);
  }
};
exports.assignAsLeadManager = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }
    const { assignAsLeadManager } = req.body;
    const userId = req.params.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    if (assignAsLeadManager) {
      if (user.leadManagerStatus !== "not_applicable") {
        return res.status(400).json({
          success: false,
          message: `User is already ${user.leadManagerStatus} for lead manager role`,
        });
      }
      user.leadManagerStatus = "pending";
    } else {
      user.leadManagerStatus = "not_applicable";
      user.leadManagerApprovedBy = null;
      user.leadManagerApprovedAt = null;
      if (user.role === "lead_manager") {
        user.role = "agent";
      }
      user.permissions.canManageLeads = false;
    }
    const updatedUser = await user.save();
    res.status(200).json({
      success: true,
      message: assignAsLeadManager
        ? "User assigned as pending lead manager"
        : "Lead manager status removed",
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};
exports.approveLeadManager = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }
    const { approved, reason } = req.body;
    const userId = req.params.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    if (user.leadManagerStatus !== "pending") {
      return res.status(400).json({
        success: false,
        message: "User is not pending lead manager approval",
      });
    }
    if (approved) {
      user.leadManagerStatus = "approved";
      user.role = "lead_manager";
      user.permissions.canManageLeads = true;
      user.leadManagerApprovedBy = req.user._id;
      user.leadManagerApprovedAt = new Date();
    } else {
      user.leadManagerStatus = "rejected";
      user.permissions.canManageLeads = false;
      if (reason) {
        user.leadManagerRejectionReason = reason;
      }
    }
    const updatedUser = await user.save();
    res.status(200).json({
      success: true,
      message: approved
        ? "User approved as lead manager"
        : "User rejected as lead manager",
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};
exports.acceptEula = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    user.eulaAccepted = true;
    await user.save({ validateBeforeSave: false });
    res.status(200).json({
      success: true,
      message: "EULA accepted successfully.",
    });
  } catch (error) {
    next(error);
  }
};

exports.kickUserSession = async (req, res, next) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Set the token invalidation timestamp to now
    // Any tokens issued before this time will be rejected
    user.tokenInvalidatedAt = new Date();
    await user.save({ validateBeforeSave: false });

    // Emit force_logout event to the user's socket room
    if (req.io) {
      req.io.to(`user:${userId}`).emit('force_logout', {
        message: 'Your session has been terminated by an administrator.',
        timestamp: new Date().toISOString()
      });
    }

    res.status(200).json({
      success: true,
      message: `Session kicked for user ${user.fullName}. They will need to log in again.`,
    });
  } catch (error) {
    next(error);
  }
};