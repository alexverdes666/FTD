const Order = require('../models/Order');
const AgentCallDeclaration = require('../models/AgentCallDeclaration');
const CallChangeRequest = require('../models/CallChangeRequest');
const SalaryConfiguration = require('../models/SalaryConfiguration');
const { normalizeCountry, getSimPrice } = require('../utils/countryNormalizer');

// Pricing constants
const FTD_DEPOSIT_RATE = 300;
const FTD_TRANSACTION_COMMISSION_RATE = 0.05; // 5%
const DATA_TRAFFIC_RATE = 1;
const ES_UK_CARDS_RATE = 0.15; // 15% of $300
const CA_CARDS_RATE = 75;
const TALKING_TIME_HOURLY_RATE = 10; // $10 per full hour
const VERIFIED_LEAD_RATE = 5; // $5 per verified lead
const DOCUMENTS_RATE = 20; // $20 per FTD ordered

// All supported SIM card geos (always displayed, even with 0 count)
const SIM_CARD_GEOS = ['SE', 'UK', 'CA', 'PL', 'ES'];

// Call expense base rates (matches cdrService BONUS_CONFIG)
const CALL_EXPENSE_RATES = {
  deposit: 10.0,
  first_call: 7.5,
  second_call: 7.5,
  third_call: 5.0,
  fourth_call: 10.0,
};

/**
 * Calculate auto-expenses for a given affiliate manager in a specific month/year.
 *
 * @param {string} affiliateManagerId - The AM's user ID
 * @param {number} month - Month (1-12)
 * @param {number} year - Year
 * @returns {Object} Expense breakdown with per-category details and grandTotal
 */
const calculateAMExpenses = async (affiliateManagerId, month, year) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const orders = await Order.find({
    requester: affiliateManagerId,
    plannedDate: { $gte: startDate, $lte: endDate },
    status: { $in: ['fulfilled', 'partial'] },
  }).lean();

  // --- FTDs (Deposit) ---
  let ftdDepositCount = 0;

  // --- SIM Cards ---
  // Track per-GEO: { SE: count, UK: count, ... }
  const simCardsByGeo = {};

  // --- Data Traffic (cold leads) ---
  let dataTrafficCount = 0;

  // --- Documents (all FTD-ordered leads) ---
  let ftdOrderedCount = 0;

  // --- ES/UK Cards & CA Cards (deposit confirmed by GEO) ---
  let esUkCardsCount = 0;
  let caCardsCount = 0;

  for (const order of orders) {
    const geo = normalizeCountry(order.countryFilter);

    if (!order.leadsMetadata || !Array.isArray(order.leadsMetadata)) continue;

    for (const lead of order.leadsMetadata) {
      // FTDs: all confirmed deposits
      if (lead.depositConfirmed === true) {
        ftdDepositCount++;

        // ES/UK Cards: confirmed deposits where GEO is ES or UK
        if (geo === 'ES' || geo === 'UK') {
          esUkCardsCount++;
        }

        // CA Cards: confirmed deposits where GEO is CA
        if (geo === 'CA') {
          caCardsCount++;
        }
      }

      // Documents & SIM Cards: leads ordered as "ftd"
      if (lead.orderedAs === 'ftd') {
        ftdOrderedCount++;
      }
      if (lead.orderedAs === 'ftd' && geo) {
        const simPrice = getSimPrice(geo);
        if (simPrice !== null) {
          simCardsByGeo[geo] = (simCardsByGeo[geo] || 0) + 1;
        }
      }

      // Data Traffic: leads ordered as "cold"
      if (lead.orderedAs === 'cold') {
        dataTrafficCount++;
      }
    }
  }

  // Calculate totals
  const ftdDepositTotal = ftdDepositCount * FTD_DEPOSIT_RATE;
  const ftdTransactionCommissionTotal = ftdDepositTotal * FTD_TRANSACTION_COMMISSION_RATE;

  // SIM cards breakdown per GEO — always show all supported geos, even with 0 count
  const simCardsBreakdown = [];
  let simCardsTotal = 0;
  for (const geo of SIM_CARD_GEOS) {
    const count = simCardsByGeo[geo] || 0;
    const price = getSimPrice(geo);
    const total = count * price;
    simCardsTotal += total;
    simCardsBreakdown.push({ geo, count, rate: price, total });
  }

  const documentsTotal = ftdOrderedCount * DOCUMENTS_RATE;
  const dataTrafficTotal = dataTrafficCount * DATA_TRAFFIC_RATE;
  const esUkCardsTotal = esUkCardsCount * FTD_DEPOSIT_RATE * ES_UK_CARDS_RATE;
  const caCardsTotal = caCardsCount * CA_CARDS_RATE;

  // --- Call Expenses (from approved agent call declarations) ---
  // Note: approved declarations may have isActive=false (processed/completed), so we don't filter on isActive
  const approvedDeclarations = await AgentCallDeclaration.find({
    affiliateManager: affiliateManagerId,
    declarationMonth: month,
    declarationYear: year,
    status: 'approved',
  }).select('callType callCategory callDuration totalBonus').lean();

  let totalTalkingTimeSeconds = 0;
  const callTypeCounts = {};
  const callTypeTotals = {};

  for (const decl of approvedDeclarations) {
    totalTalkingTimeSeconds += decl.callDuration || 0;

    const ct = decl.callType;
    if (ct && CALL_EXPENSE_RATES[ct] !== undefined) {
      callTypeCounts[ct] = (callTypeCounts[ct] || 0) + 1;
      callTypeTotals[ct] = (callTypeTotals[ct] || 0) + (decl.totalBonus || 0);
    }
  }

  const totalTalkingTimeHours = totalTalkingTimeSeconds / 3600;
  const totalTalkingTimeFullHours = Math.floor(totalTalkingTimeHours);
  const totalTalkingTimeExpense = totalTalkingTimeFullHours * TALKING_TIME_HOURLY_RATE;

  const depositCallsCount = callTypeCounts.deposit || 0;
  const depositCallsTotal = callTypeTotals.deposit || 0;
  const firstCallsCount = callTypeCounts.first_call || 0;
  const firstCallsTotal = callTypeTotals.first_call || 0;
  const secondCallsCount = callTypeCounts.second_call || 0;
  const secondCallsTotal = callTypeTotals.second_call || 0;
  const thirdCallsCount = callTypeCounts.third_call || 0;
  const thirdCallsTotal = callTypeTotals.third_call || 0;
  const fourthCallsCount = callTypeCounts.fourth_call || 0;
  const fourthCallsTotal = callTypeTotals.fourth_call || 0;

  const callExpensesTotal =
    depositCallsTotal + firstCallsTotal + secondCallsTotal + thirdCallsTotal + fourthCallsTotal;

  // --- Salary (from SalaryConfiguration) ---
  let salaryTotal = 0;
  const salaryConfig = await SalaryConfiguration.findOne({
    user: affiliateManagerId,
    isActive: true,
  }).select('fixedSalary salaryType').lean();

  if (salaryConfig && salaryConfig.salaryType === 'fixed_monthly' && salaryConfig.fixedSalary) {
    salaryTotal = salaryConfig.fixedSalary.amount || 0;
  }

  // --- Verified Leads (from approved call change requests) ---
  const verifiedLeadsCount = await CallChangeRequest.countDocuments({
    affiliateManagerId: affiliateManagerId,
    requestedVerified: true,
    status: 'approved',
    reviewedAt: { $gte: startDate, $lte: endDate },
  });
  const verifiedLeadsTotal = verifiedLeadsCount * VERIFIED_LEAD_RATE;

  const grandTotal =
    ftdDepositTotal +
    ftdTransactionCommissionTotal +
    simCardsTotal +
    documentsTotal +
    dataTrafficTotal +
    esUkCardsTotal +
    caCardsTotal +
    totalTalkingTimeExpense +
    callExpensesTotal +
    salaryTotal +
    verifiedLeadsTotal;

  return {
    categories: [
      {
        key: 'ftdDeposit',
        label: 'FTDs (Deposit)',
        count: ftdDepositCount,
        rate: FTD_DEPOSIT_RATE,
        rateType: 'fixed',
        total: ftdDepositTotal,
      },
      {
        key: 'ftdTransactionCommission',
        label: 'FTDs Transaction Commission',
        count: ftdDepositCount,
        rate: FTD_TRANSACTION_COMMISSION_RATE,
        rateType: 'percentage',
        base: ftdDepositTotal,
        total: ftdTransactionCommissionTotal,
      },
      {
        key: 'simCards',
        label: 'SIM Cards',
        breakdown: simCardsBreakdown,
        total: simCardsTotal,
      },
      {
        key: 'documents',
        label: 'Documents',
        count: ftdOrderedCount,
        rate: DOCUMENTS_RATE,
        rateType: 'fixed',
        total: documentsTotal,
      },
      {
        key: 'dataTraffic',
        label: 'Data Traffic',
        count: dataTrafficCount,
        rate: DATA_TRAFFIC_RATE,
        rateType: 'fixed',
        total: dataTrafficTotal,
      },
      {
        key: 'esUkCards',
        label: 'ES/UK Cards',
        count: esUkCardsCount,
        rate: ES_UK_CARDS_RATE,
        rateType: 'percentage',
        base: esUkCardsCount * FTD_DEPOSIT_RATE,
        total: esUkCardsTotal,
      },
      {
        key: 'caCards',
        label: 'CA Cards',
        count: caCardsCount,
        rate: CA_CARDS_RATE,
        rateType: 'fixed',
        total: caCardsTotal,
      },
      // --- Call Activities ---
      {
        key: 'totalTalkingTime',
        label: 'Total Talking Time',
        displayType: 'hours',
        value: totalTalkingTimeHours,
        count: approvedDeclarations.length,
        rate: TALKING_TIME_HOURLY_RATE,
        rateType: 'fixed',
        total: totalTalkingTimeExpense,
      },
      {
        key: 'depositCalls',
        label: 'Deposit Calls',
        count: depositCallsCount,
        rate: CALL_EXPENSE_RATES.deposit,
        rateType: 'fixed',
        total: depositCallsTotal,
      },
      {
        key: 'firstCalls',
        label: '1st Calls',
        count: firstCallsCount,
        rate: CALL_EXPENSE_RATES.first_call,
        rateType: 'fixed',
        total: firstCallsTotal,
      },
      {
        key: 'secondCalls',
        label: '2nd Calls',
        count: secondCallsCount,
        rate: CALL_EXPENSE_RATES.second_call,
        rateType: 'fixed',
        total: secondCallsTotal,
      },
      {
        key: 'thirdCalls',
        label: '3rd Calls',
        count: thirdCallsCount,
        rate: CALL_EXPENSE_RATES.third_call,
        rateType: 'fixed',
        total: thirdCallsTotal,
      },
      {
        key: 'fourthCalls',
        label: '4th Calls',
        count: fourthCallsCount,
        rate: CALL_EXPENSE_RATES.fourth_call,
        rateType: 'fixed',
        total: fourthCallsTotal,
      },
      // --- Verified Leads ---
      {
        key: 'verifiedLeads',
        label: 'Verified Leads',
        count: verifiedLeadsCount,
        rate: VERIFIED_LEAD_RATE,
        rateType: 'fixed',
        total: verifiedLeadsTotal,
      },
      // --- Salary ---
      {
        key: 'contractSalary',
        label: 'Contract Salary',
        rateType: 'fixed',
        total: salaryTotal,
      },
    ],
    grandTotal,
  };
};

module.exports = { calculateAMExpenses };
