import api from "../api";
import { calculateSalary, getSalaryConfigurationByUser } from '../salaryConfiguration';
import { getAggregatedMetrics } from '../affiliateManagerMetrics';
import { getAllAgentCallCounts, calculateBonusFromCallCounts } from '../agentCallCounts';
import { getGlobalBonusRates } from '../systemConfiguration';

// Default bonus rates (fallback if no admin configuration exists)
export const DEFAULT_BONUS_RATES = {
  firstCall: 0.0,
  secondCall: 0.0,
  thirdCall: 0.0,
  fourthCall: 0.0,
  fifthCall: 0.0,
  verifiedAcc: 0.0,
};

export const RATE_PER_SECOND = 0.00278;

// Salary types supported by the system (only for affiliate managers)
export const SALARY_TYPES = {
  FIXED_MONTHLY: 'fixed_monthly'
};

/**
 * Calculate base pay from talk time (for agents only, not part of salary system)
 * @param {number} totalSeconds - Total talk time in seconds
 * @returns {number} Base pay amount
 */
export const calculateBasePay = (totalSeconds) => {
  return totalSeconds * RATE_PER_SECOND;
};

/**
 * Get bonus configuration for an agent using the new call counts system
 * @param {string} agentId - Agent ID
 * @returns {Promise<Object>} Agent bonus configuration with call counts
 */
export const getAgentBonusConfig = async (agentId) => {
  try {
    console.log("📡 Fetching call counts for agent ID:", agentId);
    
    // Get call counts for today (or recent data)
    const today = new Date().toISOString().split('T')[0];
    const callCountsResponse = await getAllAgentCallCounts(today);
    
    // Find the agent's data
    const agentData = callCountsResponse.data.find(agent => agent.agent._id === agentId);
    
    if (!agentData) {
      console.log("🔄 No call counts found for agent, using default");
      return {
        bonusRates: {
          firstCall: 5,
          secondCall: 10,
          thirdCall: 15,
          fourthCall: 20,
          fifthCall: 25,
          verifiedAcc: 50,
        },
        callCounts: {
          firstCalls: 0,
          secondCalls: 0,
          thirdCalls: 0,
          fourthCalls: 0,
          fifthCalls: 0,
          verifiedAccounts: 0,
        },
        totalPotentialBonus: 0,
        isDefault: true,
      };
    }
    
    // Use default bonus rates (since agents don't have admin privileges to fetch global rates)
    let bonusRates = {
      firstCall: 5,
      secondCall: 10,
      thirdCall: 15,
      fourthCall: 20,
      fifthCall: 25,
      verifiedAcc: 50,
    };
    
    // Skip global bonus rates fetch for agents to avoid access denied errors
    // Admin can still configure these through the admin panel
    console.log("Using default bonus rates for agent view");
    
    const callCounts = agentData.callCounts || {
      firstCalls: 0,
      secondCalls: 0,
      thirdCalls: 0,
      fourthCalls: 0,
      fifthCalls: 0,
      verifiedAccounts: 0,
    };
    
    // Calculate total bonus from call counts
    const totalPotentialBonus = 
      (callCounts.firstCalls * bonusRates.firstCall) +
      (callCounts.secondCalls * bonusRates.secondCall) +
      (callCounts.thirdCalls * bonusRates.thirdCall) +
      (callCounts.fourthCalls * bonusRates.fourthCall) +
      (callCounts.fifthCalls * bonusRates.fifthCall) +
      (callCounts.verifiedAccounts * bonusRates.verifiedAcc);
    
    console.log("✅ Call counts fetched successfully:", {
      callCounts,
      bonusRates,
      totalPotentialBonus
    });
    
    return {
      bonusRates,
      callCounts,
      totalPotentialBonus,
      isDefault: false,
    };
  } catch (error) {
    console.error("❌ Error fetching agent call counts:", error);
    console.log("🔄 Falling back to default configuration");
    // Return default configuration if agent config not found
    return {
      bonusRates: {
        firstCall: 5,
        secondCall: 10,
        thirdCall: 15,
        fourthCall: 20,
        fifthCall: 25,
        verifiedAcc: 50,
      },
      callCounts: {
        firstCalls: 0,
        secondCalls: 0,
        thirdCalls: 0,
        fourthCalls: 0,
        fifthCalls: 0,
        verifiedAccounts: 0,
      },
      totalPotentialBonus: 0,
      isDefault: true,
    };
  }
};

/**
 * Calculate bonuses using admin-configured rates (for agents only, not part of salary system)
 * @param {Object} callCounts - Call counts object
 * @param {Object} bonusRates - Admin-configured bonus rates
 * @returns {Object} Calculated bonuses
 */
export const calculateBonuses = (
  callCounts,
  bonusRates = DEFAULT_BONUS_RATES
) => {
  const {
    firstCalls = 0,
    secondCalls = 0,
    thirdCalls = 0,
    fourthCalls = 0,
    fifthCalls = 0,
    verifiedAccounts = 0,
  } = callCounts;

  return {
    firstCallBonus: firstCalls * bonusRates.firstCall,
    secondCallBonus: secondCalls * bonusRates.secondCall,
    thirdCallBonus: thirdCalls * bonusRates.thirdCall,
    fourthCallBonus: fourthCalls * bonusRates.fourthCall,
    fifthCallBonus: fifthCalls * bonusRates.fifthCall,
    verifiedAccBonus: verifiedAccounts * bonusRates.verifiedAcc,
  };
};

/**
 * Calculate bonuses using fixed rates and call counts from the new system
 * @param {Object} callCounts - Call counts object
 * @returns {Object} Calculated bonuses with fixed rates
 */
export const calculateBonusesFromCallCounts = async (callCounts) => {
  // Get global bonus rates
  let FIXED_BONUS_RATES = {
    firstCall: 5.0,
    secondCall: 10.0,
    thirdCall: 15.0,
    fourthCall: 20.0,
    fifthCall: 25.0,
    verifiedAcc: 50.0,
  };
  
  // Skip global bonus rates fetch to avoid access denied errors for agents
  // Use default rates consistently
  console.log("Using default bonus rates for bonus calculations");

  const {
    firstCalls = 0,
    secondCalls = 0,
    thirdCalls = 0,
    fourthCalls = 0,
    fifthCalls = 0,
    verifiedAccounts = 0,
  } = callCounts;

  return {
    firstCallBonus: firstCalls * FIXED_BONUS_RATES.firstCall,
    secondCallBonus: secondCalls * FIXED_BONUS_RATES.secondCall,
    thirdCallBonus: thirdCalls * FIXED_BONUS_RATES.thirdCall,
    fourthCallBonus: fourthCalls * FIXED_BONUS_RATES.fourthCall,
    fifthCallBonus: fifthCalls * FIXED_BONUS_RATES.fifthCall,
    verifiedAccBonus: verifiedAccounts * FIXED_BONUS_RATES.verifiedAcc,
    totalBonus: (firstCalls * FIXED_BONUS_RATES.firstCall) +
                (secondCalls * FIXED_BONUS_RATES.secondCall) +
                (thirdCalls * FIXED_BONUS_RATES.thirdCall) +
                (fourthCalls * FIXED_BONUS_RATES.fourthCall) +
                (fifthCalls * FIXED_BONUS_RATES.fifthCall) +
                (verifiedAccounts * FIXED_BONUS_RATES.verifiedAcc),
    bonusRates: FIXED_BONUS_RATES,
  };
};

/**
 * Calculate bonuses with agent-specific configuration (for agents only, not part of salary system)
 * @param {string} agentId - Agent ID
 * @param {Object} callCounts - Call counts object
 * @returns {Promise<Object>} Calculated bonuses with configuration
 */
export const calculateAgentBonuses = async (agentId, callCounts) => {
  try {
    const bonusConfig = await getAgentBonusConfig(agentId);
    const bonuses = calculateBonuses(callCounts, bonusConfig.bonusRates);

    return {
      ...bonuses,
      bonusConfig: bonusConfig,
      totalBonus: Object.values(bonuses).reduce((sum, bonus) => sum + bonus, 0),
    };
  } catch (error) {
    console.error("Error calculating agent bonuses:", error);
    // Fallback to default rates
    const bonuses = calculateBonuses(callCounts, DEFAULT_BONUS_RATES);
    return {
      ...bonuses,
      bonusConfig: { bonusRates: DEFAULT_BONUS_RATES, isDefault: true },
      totalBonus: Object.values(bonuses).reduce((sum, bonus) => sum + bonus, 0),
    };
  }
};

/**
 * Calculate total payment (for agents only, not part of salary system)
 * @param {number} basePay - Base pay from talk time
 * @param {Object} bonuses - Calculated bonuses
 * @param {number} fines - Fines to deduct
 * @returns {number} Total payment amount
 */
export const calculateTotalPayment = (basePay, bonuses, fines = 0) => {
  let totalBonuses = 0;

  if (bonuses.totalBonus !== undefined) {
    totalBonuses = bonuses.totalBonus;
  } else if (typeof bonuses === "object") {
    totalBonuses = Object.values(bonuses).reduce(
      (sum, bonus) => sum + bonus,
      0
    );
  }

  return basePay + totalBonuses - fines;
};

/**
 * Complete payment calculation for an agent (for agents only, not part of salary system)
 * @param {string} agentId - Agent ID
 * @param {number} talkTimeSeconds - Talk time in seconds
 * @param {Object} callCounts - Call counts object
 * @param {number} fines - Fines to deduct
 * @returns {Promise<Object>} Complete payment calculation
 */
export const calculateAgentPayment = async (
  agentId,
  talkTimeSeconds,
  callCounts,
  fines = 0
) => {
  try {
    const basePay = calculateBasePay(talkTimeSeconds);
    const bonusCalculation = await calculateAgentBonuses(agentId, callCounts);
    const totalPayment = calculateTotalPayment(
      basePay,
      bonusCalculation,
      fines
    );

    return {
      basePay,
      bonuses: bonusCalculation,
      fines,
      totalPayment,
      bonusConfig: bonusCalculation.bonusConfig,
      talkTimeHours: talkTimeSeconds / 3600,
    };
  } catch (error) {
    console.error("Error calculating agent payment:", error);
    throw error;
  }
};

/**
 * Calculate agent payment using the new call counts system
 * @param {string} agentId - Agent ID
 * @param {number} talkTimeSeconds - Talk time in seconds
 * @param {string} date - Date to get call counts for
 * @param {number} fines - Fines to deduct
 * @returns {Promise<Object>} Complete payment calculation
 */
export const calculateAgentPaymentFromCallCounts = async (
  agentId,
  talkTimeSeconds,
  date = null,
  fines = 0
) => {
  try {
    const basePay = calculateBasePay(talkTimeSeconds);
    
    // Get call counts from the new system
    const callCountsResponse = await getAllAgentCallCounts(date);
    const agentCallCounts = callCountsResponse.data.find(
      agent => agent.agent._id === agentId
    );
    
    const callCounts = agentCallCounts?.callCounts || {
      firstCalls: 0,
      secondCalls: 0,
      thirdCalls: 0,
      fourthCalls: 0,
      fifthCalls: 0,
      verifiedAccounts: 0,
    };

    const bonusCalculation = calculateBonusesFromCallCounts(callCounts);
    const totalPayment = calculateTotalPayment(
      basePay,
      bonusCalculation,
      fines
    );

    return {
      basePay,
      bonuses: bonusCalculation,
      fines,
      totalPayment,
      callCounts,
      talkTimeHours: talkTimeSeconds / 3600,
      date: date || new Date().toISOString().split('T')[0],
    };
  } catch (error) {
    console.error("Error calculating agent payment from call counts:", error);
    throw error;
  }
};

/**
 * Format bonus breakdown for display (for agents only, not part of salary system)
 * @param {Object} bonuses - Bonus calculation object
 * @returns {Array} Formatted bonus items for UI display
 */
export const formatBonusBreakdown = (bonuses) => {
  const breakdown = [];

  if (!bonuses || typeof bonuses !== "object") {
    return breakdown;
  }

  // Handle the bonus calculation structure
  const bonusTypes = [
    { key: "firstCallBonus", label: "1st Call Bonus" },
    { key: "secondCallBonus", label: "2nd Call Bonus" },
    { key: "thirdCallBonus", label: "3rd Call Bonus" },
    { key: "fourthCallBonus", label: "4th Call Bonus" },
    { key: "fifthCallBonus", label: "5th Call Bonus" },
    { key: "verifiedAccBonus", label: "Verified Account Bonus" },
  ];

  bonusTypes.forEach((bonusType) => {
    if (bonuses[bonusType.key] && bonuses[bonusType.key] > 0) {
      breakdown.push({
        label: bonusType.label,
        amount: bonuses[bonusType.key],
        system: bonuses.bonusRates ? "fixed-rates" : "admin-configured",
      });
    }
  });

  return breakdown;
};

/**
 * Format bonus breakdown with call counts for display
 * @param {Object} bonuses - Bonus calculation object
 * @param {Object} callCounts - Call counts object
 * @returns {Array} Formatted bonus items for UI display with call counts
 */
export const formatBonusBreakdownWithCounts = (bonuses, callCounts) => {
  const breakdown = [];

  if (!bonuses || typeof bonuses !== "object" || !callCounts) {
    return breakdown;
  }

  const bonusTypes = [
    { key: "firstCallBonus", label: "1st Call Monthly Bonus", countKey: "firstCalls" },
    { key: "secondCallBonus", label: "2nd Call Monthly Bonus", countKey: "secondCalls" },
    { key: "thirdCallBonus", label: "3rd Call Monthly Bonus", countKey: "thirdCalls" },
    { key: "fourthCallBonus", label: "4th Call Monthly Bonus", countKey: "fourthCalls" },
    { key: "fifthCallBonus", label: "5th Call Monthly Bonus", countKey: "fifthCalls" },
    { key: "verifiedAccBonus", label: "Verified Account Monthly Bonus", countKey: "verifiedAccounts" },
  ];

  bonusTypes.forEach((bonusType) => {
    const count = callCounts[bonusType.countKey] || 0;
    const amount = bonuses[bonusType.key] || 0;
    
    if (count > 0 || amount > 0) {
      breakdown.push({
        label: bonusType.label,
        amount: amount,
        count: count,
        rate: count > 0 ? amount / count : 0,
        system: "fixed-rates",
      });
    }
  });

  return breakdown;
};

/**
 * Utility functions for time conversion
 */
export const timeToSeconds = (time) => {
  const [hours, minutes, seconds] = time.split(":").map(Number);
  return hours * 3600 + minutes * 60 + seconds;
};

/**
 * Get salary configuration for an affiliate manager
 * @param {string} userId - User ID (must be affiliate manager)
 * @returns {Promise<Object>} User salary configuration
 */
export const getUserSalaryConfig = async (userId) => {
  try {
    console.log("📡 Fetching salary configuration for affiliate manager:", userId);
    const response = await getSalaryConfigurationByUser(userId);
    console.log("✅ Salary configuration fetched successfully:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Error fetching salary configuration:", error);
    return null;
  }
};

/**
 * Calculate salary based on affiliate manager's configuration
 * @param {string} userId - User ID (must be affiliate manager)
 * @param {Object} params - Calculation parameters
 * @returns {Promise<Object>} Calculated salary
 */
export const calculateUserSalary = async (userId, params = {}) => {
  try {
    console.log("💰 Calculating salary for affiliate manager:", userId);
    
    // Get salary configuration
    const config = await getUserSalaryConfig(userId);
    if (!config) {
      console.log("⚠️ No salary configuration found for affiliate manager");
      return null;
    }
    
    console.log("📊 Using salary type:", config.salaryType);
    
    // Calculate based on salary type
    switch (config.salaryType) {
      case SALARY_TYPES.FIXED_MONTHLY:
        return await calculateFixedSalary(userId, params);
      
      default:
        console.warn("Unknown salary type:", config.salaryType);
        return null;
    }
  } catch (error) {
    console.error("Error calculating affiliate manager salary:", error);
    throw error;
  }
};

/**
 * Calculate fixed salary
 * @param {string} userId - User ID (must be affiliate manager)
 * @param {Object} params - Period and other parameters
 * @returns {Promise<Object>} Fixed salary calculation
 */
export const calculateFixedSalary = async (userId, params) => {
  try {
    const { period = 'monthly' } = params;
    
    const response = await calculateSalary(userId, { period });
    
    return {
      salaryType: SALARY_TYPES.FIXED_MONTHLY,
      ...response.data.calculation,
      period: response.data.period,
      calculatedAt: response.data.calculatedAt
    };
  } catch (error) {
    console.error("Error calculating fixed salary:", error);
    throw error;
  }
};



/**
 * Format salary display based on salary type
 * @param {Object} salaryData - Salary calculation data
 * @returns {Object} Formatted salary display
 */
export const formatSalaryDisplay = (salaryData) => {
  if (!salaryData) return null;
  
  const formatCurrency = (amount) => `$${Number(amount).toFixed(2)}`;
  
  switch (salaryData.salaryType) {
    case SALARY_TYPES.FIXED_MONTHLY:
      return {
        type: 'Fixed Salary',
        primary: formatCurrency(salaryData.amount),
        secondary: `${salaryData.paymentFrequency} payment`,
        details: [
          { label: 'Amount', value: formatCurrency(salaryData.amount) },
          { label: 'Frequency', value: salaryData.paymentFrequency },
          { label: 'Currency', value: salaryData.currency }
        ]
      };
    

    
    default:
      return {
        type: 'Unknown',
        primary: 'N/A',
        secondary: 'Unknown salary type',
        details: []
      };
  }
};

export const secondsToTime = (totalSeconds) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((v) => v.toString().padStart(2, "0"))
    .join(":");
};

/**
 * Get all agent bonus configurations (admin only)
 * @returns {Promise<Array>} All agent bonus configurations
 */
export const getAllAgentBonusConfigs = async () => {
  try {
    const response = await api.get("/agent-bonuses");
    return response.data.data;
  } catch (error) {
    console.error("Error fetching all agent bonus configs:", error);
    throw error;
  }
};

/**
 * Update agent bonus configuration (admin only)
 * @param {string} agentId - Agent ID
 * @param {Object} bonusRates - New bonus rates
 * @param {string} notes - Optional notes
 * @returns {Promise<Object>} Updated bonus configuration
 */
export const updateAgentBonusConfig = async (
  agentId,
  bonusRates,
  notes = ""
) => {
  try {
    const response = await api.put(`/agent-bonuses/${agentId}`, {
      bonusRates,
      notes,
    });
    return response.data.data;
  } catch (error) {
    console.error("Error updating agent bonus config:", error);
    throw error;
  }
};

/**
 * Get bonus statistics (admin only)
 * @returns {Promise<Object>} Bonus statistics
 */
export const getBonusStats = async () => {
  try {
    const response = await api.get("/agent-bonuses/stats");
    return response.data.data;
  } catch (error) {
    console.error("Error fetching bonus stats:", error);
    throw error;
  }
};
