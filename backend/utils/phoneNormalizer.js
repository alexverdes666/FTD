const {
  parsePhoneNumber,
  getCountries,
  getCountryCallingCode,
} = require("libphonenumber-js/max");

// Build lookup maps dynamically from libphonenumber's metadata (245 countries)
const NAME_TO_ISO = {};
const PREFIX_TO_ISO = {};

// Intl.DisplayNames gives us country name -> ISO for every locale
// We build a lowercase name -> ISO map so "canada" -> "CA", "united kingdom" -> "GB", etc.
const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
for (const iso of getCountries()) {
  try {
    const name = displayNames.of(iso);
    if (name) NAME_TO_ISO[name.toLowerCase()] = iso;
  } catch (e) {
    // skip
  }
  const callingCode = "+" + getCountryCallingCode(iso);
  // First country wins for shared prefixes (e.g. +1 -> US)
  if (!PREFIX_TO_ISO[callingCode]) {
    PREFIX_TO_ISO[callingCode] = iso;
  }
}

/**
 * Resolve a country name or phone prefix to an ISO 3166-1 alpha-2 code.
 */
function resolveIso(countryOrPrefix) {
  if (!countryOrPrefix) return null;
  // Direct ISO code (2 uppercase letters)
  if (/^[A-Z]{2}$/.test(countryOrPrefix)) return countryOrPrefix;
  // Prefix like "+34"
  if (countryOrPrefix.startsWith("+")) return PREFIX_TO_ISO[countryOrPrefix] || null;
  // Country name (case-insensitive)
  return NAME_TO_ISO[countryOrPrefix.toLowerCase()] || null;
}

/**
 * Normalizes a phone number by stripping a duplicated country code prefix.
 * Uses Google's libphonenumber metadata to correctly determine whether
 * leading digits are part of the country code or the local number.
 *
 * @param {string} phone - The raw phone number input
 * @param {string} countryOrPrefix - Country name, ISO code, or prefix (e.g. "Canada", "CA", "+1")
 * @returns {string} The national (local) phone number, digits only
 */
function normalizePhone(phone, countryOrPrefix) {
  if (!phone) return "";

  const cleaned = phone.replace(/\D/g, "");
  if (!cleaned) return "";
  if (!countryOrPrefix) return cleaned;

  const isoCode = resolveIso(countryOrPrefix);
  if (!isoCode) return cleaned;

  const prefixDigits = getCountryCallingCode(isoCode);

  try {
    // Try to parse as a national number for the given country
    let nationalParsed;
    try {
      nationalParsed = parsePhoneNumber(cleaned, isoCode);
    } catch (e) {
      // ignore
    }
    const isValidNational = nationalParsed && nationalParsed.isValid();

    // If it starts with the country code digits, also try as international
    if (prefixDigits && cleaned.startsWith(prefixDigits)) {
      let intlParsed;
      try {
        intlParsed = parsePhoneNumber("+" + cleaned);
      } catch (e) {
        // ignore
      }

      // Check the parsed country shares the same calling code (handles +1 -> US/CA/etc.)
      const isValidIntl =
        intlParsed &&
        intlParsed.isValid() &&
        intlParsed.countryCallingCode === prefixDigits;

      if (isValidIntl && !isValidNational) {
        return intlParsed.nationalNumber;
      }

      if (isValidIntl && isValidNational) {
        const natLen = nationalParsed.nationalNumber.length;
        const intlLen = intlParsed.nationalNumber.length;
        if (natLen > intlLen) {
          return intlParsed.nationalNumber;
        }
        return nationalParsed.nationalNumber;
      }
    }

    // Handle "00" international dialing prefix
    if (prefixDigits && cleaned.startsWith("00" + prefixDigits)) {
      try {
        const intlParsed = parsePhoneNumber("+" + cleaned.substring(2));
        if (intlParsed && intlParsed.isValid() && intlParsed.countryCallingCode === prefixDigits) {
          return intlParsed.nationalNumber;
        }
      } catch (e) {
        // Fall through
      }
    }

    if (isValidNational && nationalParsed.nationalNumber) {
      return nationalParsed.nationalNumber;
    }
  } catch (e) {
    // Parse failed entirely, return cleaned digits as fallback
  }

  return cleaned;
}

/**
 * Check if the input is a valid full country name (not an ISO code or abbreviation).
 */
function isValidCountryName(name) {
  if (!name) return false;
  const trimmed = name.trim();
  // Reject ISO codes (2-3 letter codes like "UK", "US", "CA", "GBR")
  if (/^[A-Za-z]{2,3}$/.test(trimmed)) return false;
  return !!NAME_TO_ISO[trimmed.toLowerCase()];
}

/**
 * Get ISO code from a full country name.
 */
function getISOFromCountryName(name) {
  if (!name) return null;
  return NAME_TO_ISO[name.toLowerCase().trim()] || null;
}

/**
 * Validate a phone number (expected national format) for a given country name.
 * Returns { valid: boolean, nationalNumber: string }
 */
function validatePhoneForCountry(phone, countryName) {
  if (!phone || !countryName) return { valid: false, nationalNumber: "" };

  const isoCode = NAME_TO_ISO[countryName.toLowerCase().trim()];
  if (!isoCode) return { valid: false, nationalNumber: "" };

  const cleaned = phone.replace(/\D/g, "");
  if (!cleaned) return { valid: false, nationalNumber: "" };

  try {
    // Try parsing as national number for the country
    const parsed = parsePhoneNumber(cleaned, isoCode);
    if (parsed && parsed.isValid()) {
      return { valid: true, nationalNumber: parsed.nationalNumber };
    }

    // If it starts with country code, try as international (user may have included it)
    const prefixDigits = getCountryCallingCode(isoCode);
    if (prefixDigits && cleaned.startsWith(prefixDigits)) {
      const intlParsed = parsePhoneNumber("+" + cleaned);
      if (intlParsed && intlParsed.isValid() && intlParsed.countryCallingCode === prefixDigits) {
        return { valid: true, nationalNumber: intlParsed.nationalNumber };
      }
    }
  } catch (e) {
    // ignore parse errors
  }

  return { valid: false, nationalNumber: cleaned };
}

module.exports = { normalizePhone, isValidCountryName, getISOFromCountryName, validatePhoneForCountry };
