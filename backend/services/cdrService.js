const axios = require("axios");

// CDR API configuration
const CDR_API_URL = "http://188.126.10.151:6680/cdr.php";
const MIN_CALL_DURATION = 900; // 15 minutes in seconds

// Bonus configuration by call type
const BONUS_CONFIG = {
  deposit: 10.0,
  first_call: 7.5,
  second_call: 7.5,
  third_call: 5.0,
  fourth_call: 10.0,
};

// Hourly bonus for calls > 1 hour
const HOURLY_BONUS_RATE = 10.0;
const HOURLY_BONUS_THRESHOLD = 3600; // 1 hour in seconds

/**
 * Extract the 3-digit agent code from the 4-digit code
 * @param {string} fourDigitCode - The agent's 4-digit code
 * @returns {string} - Last 3 digits
 */
const extractAgentCode = (fourDigitCode) => {
  if (!fourDigitCode || fourDigitCode.length < 3) {
    throw new Error("Invalid fourDigitCode");
  }
  return fourDigitCode.slice(-3);
};

/**
 * Fetch CDR calls from external API
 * @param {string} agentCode - 3-digit agent code (last 3 of fourDigitCode)
 * @param {number} months - Number of months to fetch (default 3)
 * @returns {Promise<Array>} - Array of call records
 */
const fetchCDRCalls = async (agentCode, months = 3) => {
  try {
    const url = `${CDR_API_URL}?agent=${agentCode}&m=${months}`;
    console.log(`Fetching CDR data from: ${url}`);

    const response = await axios.get(url, {
      timeout: 30000,
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.data) {
      return [];
    }

    // Handle different response formats
    let calls = response.data;
    if (typeof calls === "string") {
      try {
        calls = JSON.parse(calls);
      } catch (e) {
        console.error("Failed to parse CDR response as JSON:", e);
        return [];
      }
    }

    // Ensure we have an array
    if (!Array.isArray(calls)) {
      if (calls.data && Array.isArray(calls.data)) {
        calls = calls.data;
      } else {
        console.error("CDR response is not an array:", typeof calls);
        return [];
      }
    }

    return calls;
  } catch (error) {
    console.error("Error fetching CDR calls:", error.message);
    throw new Error(`Failed to fetch CDR data: ${error.message}`);
  }
};

/**
 * Filter calls to only include those >= 15 minutes (900 seconds)
 * @param {Array} calls - Array of call records from CDR API
 * @returns {Array} - Filtered array of long calls
 */
const filterLongCalls = (calls) => {
  if (!Array.isArray(calls)) {
    return [];
  }

  return calls.filter((call) => {
    const duration = parseInt(call.billsec || call.duration || 0, 10);
    return duration >= MIN_CALL_DURATION;
  });
};

/**
 * Calculate bonus for a call
 * @param {string} callType - Type of call (deposit, first_call, etc.)
 * @param {number} duration - Duration in seconds
 * @returns {Object} - { baseBonus, hourlyBonus, totalBonus }
 */
const calculateBonus = (callType, duration) => {
  const baseBonus = BONUS_CONFIG[callType] || 0;

  // Calculate hourly bonus for calls > 1 hour
  // For each complete hour beyond the first, add $10
  let hourlyBonus = 0;
  if (duration > HOURLY_BONUS_THRESHOLD) {
    // Calculate additional hours beyond the first hour
    const additionalSeconds = duration - HOURLY_BONUS_THRESHOLD;
    const additionalHours = Math.floor(additionalSeconds / 3600);
    hourlyBonus = additionalHours * HOURLY_BONUS_RATE;
  }

  const totalBonus = baseBonus + hourlyBonus;

  return {
    baseBonus,
    hourlyBonus,
    totalBonus,
  };
};

/**
 * Generate unique CDR call ID for deduplication
 * @param {Object} call - Call record from CDR API
 * @returns {string} - Unique identifier "calldate_src_dst"
 */
const generateCdrCallId = (call) => {
  const calldate = call.calldate || call.call_date || call.start_time || "";
  const src = call.src || call.source || call.from || "";
  const dst = call.dst || call.destination || call.to || "";
  return `${calldate}_${src}_${dst}`;
};

/**
 * Parse call record from CDR API to normalized format
 * @param {Object} call - Raw call record from CDR API
 * @returns {Object} - Normalized call object
 */
const parseCallRecord = (call) => {
  const calldate = call.calldate || call.call_date || call.start_time;
  const src = call.src || call.source || call.from || "";
  const dst = call.dst || call.destination || call.to || "";
  const billsec = parseInt(call.billsec || call.duration || 0, 10);

  return {
    cdrCallId: generateCdrCallId(call),
    callDate: new Date(calldate),
    callDuration: billsec,
    sourceNumber: src,
    destinationNumber: dst,
    lineNumber: call.line || "",
    email: call.email || "",
    recordFile: call.record || "",
    rawData: call, // Keep original data for debugging
  };
};

/**
 * Format duration in seconds to human-readable string
 * @param {number} seconds - Duration in seconds
 * @returns {string} - Formatted duration (HH:MM:SS or MM:SS)
 */
const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
};

/**
 * Get call type display name
 * @param {string} callType - Call type enum value
 * @returns {string} - Display name
 */
const getCallTypeDisplayName = (callType) => {
  const displayNames = {
    deposit: "Deposit Call",
    first_call: "First Call",
    second_call: "Second Call",
    third_call: "3rd Call",
    fourth_call: "4th Call",
  };
  return displayNames[callType] || callType;
};

/**
 * Get all available call types with their bonus values
 * @returns {Array} - Array of { value, label, bonus }
 */
const getCallTypes = () => {
  return [
    { value: "deposit", label: "Deposit Call", bonus: BONUS_CONFIG.deposit },
    { value: "first_call", label: "First Call", bonus: BONUS_CONFIG.first_call },
    { value: "second_call", label: "Second Call", bonus: BONUS_CONFIG.second_call },
    { value: "third_call", label: "3rd Call", bonus: BONUS_CONFIG.third_call },
    { value: "fourth_call", label: "4th Call", bonus: BONUS_CONFIG.fourth_call },
  ];
};

module.exports = {
  fetchCDRCalls,
  filterLongCalls,
  calculateBonus,
  generateCdrCallId,
  parseCallRecord,
  extractAgentCode,
  formatDuration,
  getCallTypeDisplayName,
  getCallTypes,
  BONUS_CONFIG,
  HOURLY_BONUS_RATE,
  HOURLY_BONUS_THRESHOLD,
  MIN_CALL_DURATION,
};
