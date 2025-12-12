const { validationResult } = require("express-validator");
const Order = require("../models/Order");
const AffiliateManagerTable = require("../models/AffiliateManagerTable");
const Withdrawal = require("../models/Withdrawal");
const AgentPerformance = require("../models/AgentPerformance");
let blockchainScraperService;
try {
  blockchainScraperService = require("../services/blockchainScraperService");
} catch (error) {
  console.warn("Blockchain scraper service not available:", error.message);
  blockchainScraperService = null;
}

/**
 * Get financial metrics for a specific month and year
 */
exports.getFinancialMetrics = async (req, res, next) => {
  const timeoutId = setTimeout(() => {
    if (!res.headersSent) {
      res.status(504).json({
        success: false,
        message:
          "Request timeout - financial metrics calculation took too long",
        data: null,
      });
    }
  }, 60000); // 60 second timeout - increased for production deployment

  try {
    const { month, year } = req.query;

    // Default to current month/year if not provided
    const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1;
    const targetYear = year ? parseInt(year) : new Date().getFullYear();

    console.log(
      `📊 Calculating financial metrics for ${targetMonth}/${targetYear}`
    );
    const startTime = Date.now();

    // Calculate date range for the month
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

    // Execute calculations in parallel for better performance
    const [totalMoneyIn, totalExpenses] = await Promise.all([
      calculateTotalMoneyIn(startDate, endDate),
      calculateTotalExpenses(startDate, endDate),
    ]);

    // Calculate net profit
    const netProfit = totalMoneyIn.total - totalExpenses.total;

    const endTime = Date.now();
    console.log(`⚡ Financial metrics calculated in ${endTime - startTime}ms`);

    // If no data for current month, provide default values
    if (totalMoneyIn.total === 0 && totalExpenses.total === 0) {
      console.log(
        `⚠️  No financial data found for ${targetMonth}/${targetYear}`
      );
    }

    clearTimeout(timeoutId);

    if (!res.headersSent) {
      res.status(200).json({
        success: true,
        data: {
          period: {
            month: targetMonth,
            year: targetYear,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          },
          metrics: {
            totalMoneyIn: totalMoneyIn.total,
            totalExpenses: totalExpenses.total,
            netProfit,
            profitMargin:
              totalMoneyIn.total > 0
                ? (netProfit / totalMoneyIn.total) * 100
                : 0,
          },
          breakdown: {
            moneyIn: {
              affiliateManagerTables: totalMoneyIn.affiliateManagerTables,
              crypto: totalMoneyIn.crypto,
              other: totalMoneyIn.other,
            },
            expenses: {
              affiliateManagerTables: totalExpenses.affiliateManagerTables,
              withdrawals: totalExpenses.withdrawals,
              agentEarnings: totalExpenses.agentEarnings,
              other: totalExpenses.other,
            },
          },
          performance: {
            calculationTime: endTime - startTime,
            timestamp: new Date().toISOString(),
          },
        },
      });
    }
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("Error getting financial metrics:", error);

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Failed to calculate financial metrics",
        error:
          process.env.NODE_ENV === "development"
            ? error.message
            : "Internal server error",
      });
    }
  }
};

/**
 * Calculate total money in from various sources
 */
async function calculateTotalMoneyIn(startDate, endDate) {
  try {
    // Get money from affiliate manager tables (total money from crypto wallets)
    const tableStats = await AffiliateManagerTable.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate },
          isActive: true,
        },
      },
      {
        $group: {
          _id: null,
          totalMoney: { $sum: "$totalMoney" },
          totalTables: { $sum: 1 },
        },
      },
    ]);

    const affiliateManagerMoney =
      tableStats.length > 0 ? tableStats[0].totalMoney : 0;

    // Get money from crypto wallets (using blockchain scraper service with month/year filtering)
    let cryptoValue = 0;
    try {
      if (blockchainScraperService) {
        const service = blockchainScraperService.getInstance();

        // Use month/year filtering for accurate monthly separation
        const targetMonth = startDate.getMonth() + 1; // Convert to 1-based month for service
        const targetYear = startDate.getFullYear();

        // Add timeout wrapper for the blockchain service call
        const cryptoPromise = service.getOverallSummary(
          null,
          targetMonth,
          targetYear
        );

        // Race between the crypto call and a timeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error("Blockchain service timeout")),
            15000
          ); // 15 second timeout
        });

        const cryptoData = await Promise.race([cryptoPromise, timeoutPromise]);
        cryptoValue = cryptoData.summary.totalUsdValue || 0;
      }
    } catch (error) {
      console.warn("Could not fetch crypto data:", error.message);
      cryptoValue = 0; // Ensure we have a fallback value
    }

    // Use crypto value as the actual money in (corrected logic)
    // The crypto value represents actual incoming money for the period
    // Affiliate manager tables are for reference only, not a fallback for money calculation
    const totalCryptoValue = cryptoValue;

    // Other sources (placeholder for future expansion)
    const otherValue = 0;

    return {
      affiliateManagerTables: affiliateManagerMoney,
      crypto: cryptoValue,
      other: otherValue,
      total: totalCryptoValue + otherValue,
    };
  } catch (error) {
    console.error("Error calculating total money in:", error);
    return { affiliateManagerTables: 0, crypto: 0, other: 0, total: 0 };
  }
}

/**
 * Calculate total expenses from various sources
 */
async function calculateTotalExpenses(startDate, endDate) {
  try {
    // Get expenses from affiliate manager tables (sum of all table row values, not profit)
    const tableStats = await AffiliateManagerTable.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate },
          isActive: true,
        },
      },
      {
        $unwind: "$tableData",
      },
      {
        $group: {
          _id: null,
          totalExpenses: {
            $sum: {
              $cond: [
                { $eq: ["$tableData.isCalculated", false] },
                {
                  $multiply: [
                    { $toDouble: "$tableData.value" },
                    { $toDouble: "$tableData.quantity" },
                  ],
                },
                0,
              ],
            },
          },
          totalTables: { $addToSet: "$_id" },
        },
      },
    ]);

    const affiliateManagerExpenses =
      tableStats.length > 0 ? tableStats[0].totalExpenses : 0;

    // Get completed withdrawals (this already represents agent earnings that have been paid out)
    const withdrawalStats = await Withdrawal.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: "completed",
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          totalWithdrawals: { $sum: 1 },
        },
      },
    ]);

    const withdrawalsAmount =
      withdrawalStats.length > 0 ? withdrawalStats[0].totalAmount : 0;

    // Note: Agent earnings are NOT included separately as they are represented by withdrawals
    // Including both would be double-counting the same expense

    // Other expenses (placeholder for future expansion)
    const otherExpenses = 0;

    return {
      affiliateManagerTables: affiliateManagerExpenses,
      withdrawals: withdrawalsAmount,
      agentEarnings: 0, // Not counted separately - represented by withdrawals
      other: otherExpenses,
      total:
        affiliateManagerExpenses +
        withdrawalsAmount +
        otherExpenses,
    };
  } catch (error) {
    console.error("Error calculating total expenses:", error);
    return {
      affiliateManagerTables: 0,
      withdrawals: 0,
      agentEarnings: 0,
      other: 0,
      total: 0,
    };
  }
}

/**
 * Get financial summary for dashboard
 */
exports.getFinancialSummary = async (req, res, next) => {
  try {
    const currentDate = new Date();
    const startOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    );
    const endOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );

    const totalMoneyIn = await calculateTotalMoneyIn(startOfMonth, endOfMonth);
    const totalExpenses = await calculateTotalExpenses(
      startOfMonth,
      endOfMonth
    );
    const netProfit = totalMoneyIn.total - totalExpenses.total;

    res.status(200).json({
      success: true,
      data: {
        currentMonth: {
          totalMoneyIn: totalMoneyIn.total,
          totalExpenses: totalExpenses.total,
          netProfit,
          profitMargin:
            totalMoneyIn.total > 0 ? (netProfit / totalMoneyIn.total) * 100 : 0,
        },
        breakdown: {
          moneyIn: totalMoneyIn,
          expenses: totalExpenses,
        },
      },
    });
  } catch (error) {
    console.error("Error getting financial summary:", error);
    next(error);
  }
};
