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

module.exports = { normalizePhone };
