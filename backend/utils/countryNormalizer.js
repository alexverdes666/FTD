const COUNTRY_MAP = {
  'sweden': 'SE',
  'se': 'SE',
  'united kingdom': 'UK',
  'uk': 'UK',
  'gb': 'UK',
  'great britain': 'UK',
  'canada': 'CA',
  'ca': 'CA',
  'poland': 'PL',
  'pl': 'PL',
  'spain': 'ES',
  'es': 'ES',
};

const SIM_PRICES = {
  SE: 60,
  UK: 35,
  CA: 100,
  PL: 35,
  ES: 40,
};

/**
 * Normalize a country name/code to a standard 2-letter GEO code.
 * Returns null if country is unknown or not in the supported list.
 */
const normalizeCountry = (country) => {
  if (!country) return null;
  const key = country.trim().toLowerCase();
  return COUNTRY_MAP[key] || null;
};

/**
 * Get SIM card price for a given GEO code.
 * Returns null if GEO is not supported.
 */
const getSimPrice = (geoCode) => {
  if (!geoCode) return null;
  return SIM_PRICES[geoCode] || null;
};

module.exports = {
  normalizeCountry,
  getSimPrice,
  SIM_PRICES,
  COUNTRY_MAP,
};
