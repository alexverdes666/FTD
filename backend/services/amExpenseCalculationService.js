const Order = require('../models/Order');
const { normalizeCountry, getSimPrice } = require('../utils/countryNormalizer');

// Pricing constants
const FTD_DEPOSIT_RATE = 300;
const FTD_TRANSACTION_COMMISSION_RATE = 0.05; // 5%
const DATA_TRAFFIC_RATE = 1;
const ES_UK_CARDS_RATE = 0.15; // 15% of $300
const CA_CARDS_RATE = 75;

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

      // SIM Cards: leads ordered as "ftd", priced by GEO
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

  // SIM cards breakdown per GEO
  const simCardsBreakdown = [];
  let simCardsTotal = 0;
  for (const [geo, count] of Object.entries(simCardsByGeo)) {
    const price = getSimPrice(geo);
    const total = count * price;
    simCardsTotal += total;
    simCardsBreakdown.push({ geo, count, rate: price, total });
  }

  const dataTrafficTotal = dataTrafficCount * DATA_TRAFFIC_RATE;
  const esUkCardsTotal = esUkCardsCount * FTD_DEPOSIT_RATE * ES_UK_CARDS_RATE;
  const caCardsTotal = caCardsCount * CA_CARDS_RATE;

  const grandTotal =
    ftdDepositTotal +
    ftdTransactionCommissionTotal +
    simCardsTotal +
    dataTrafficTotal +
    esUkCardsTotal +
    caCardsTotal;

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
    ],
    grandTotal,
  };
};

module.exports = { calculateAMExpenses };
