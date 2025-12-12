const axios = require("axios");
const { HttpsProxyAgent } = require("https-proxy-agent");
const COUNTRY_TO_ISO_CODE = {
  "United States": "us",
  "United Kingdom": "gb",
  Canada: "ca",
  Australia: "au",
  Germany: "de",
  France: "fr",
  Italy: "it",
  Spain: "es",
  Netherlands: "nl",
  Belgium: "be",
  Switzerland: "ch",
  Austria: "at",
  Sweden: "se",
  Norway: "no",
  Denmark: "dk",
  Finland: "fi",
  Poland: "pl",
  "Czech Republic": "cz",
  Hungary: "hu",
  Romania: "ro",
  Bulgaria: "bg",
  Greece: "gr",
  Portugal: "pt",
  Ireland: "ie",
  Luxembourg: "lu",
  Malta: "mt",
  Cyprus: "cy",
  Estonia: "ee",
  Latvia: "lv",
  Lithuania: "lt",
  Slovakia: "sk",
  Slovenia: "si",
  Croatia: "hr",
  Serbia: "rs",
  Montenegro: "me",
  "Bosnia and Herzegovina": "ba",
  "North Macedonia": "mk",
  Albania: "al",
  Moldova: "md",
  Ukraine: "ua",
  Belarus: "by",
  Russia: "ru",
  China: "cn",
  Japan: "jp",
  "South Korea": "kr",
  Korea: "kr",
  India: "in",
  Indonesia: "id",
  Thailand: "th",
  Vietnam: "vn",
  Malaysia: "my",
  Singapore: "sg",
  Philippines: "ph",
  Taiwan: "tw",
  "Hong Kong": "hk",
  Macau: "mo",
  Mongolia: "mn",
  Kazakhstan: "kz",
  Uzbekistan: "uz",
  Turkey: "tr",
  Israel: "il",
  Palestine: "ps",
  Lebanon: "lb",
  Syria: "sy",
  Jordan: "jo",
  Iraq: "iq",
  Iran: "ir",
  "Saudi Arabia": "sa",
  Kuwait: "kw",
  Bahrain: "bh",
  Qatar: "qa",
  "United Arab Emirates": "ae",
  UAE: "ae",
  Oman: "om",
  Yemen: "ye",
  Georgia: "ge",
  Armenia: "am",
  Azerbaijan: "az",
  Egypt: "eg",
  Libya: "ly",
  Tunisia: "tn",
  Algeria: "dz",
  Morocco: "ma",
  Sudan: "sd",
  "South Sudan": "ss",
  Ethiopia: "et",
  Eritrea: "er",
  Djibouti: "dj",
  Somalia: "so",
  Kenya: "ke",
  Uganda: "ug",
  Tanzania: "tz",
  Rwanda: "rw",
  Burundi: "bi",
  "Democratic Republic of the Congo": "cd",
  Congo: "cg",
  "Central African Republic": "cf",
  Chad: "td",
  Cameroon: "cm",
  Nigeria: "ng",
  Niger: "ne",
  Mali: "ml",
  "Burkina Faso": "bf",
  "Ivory Coast": "ci",
  "Cote d'Ivoire": "ci",
  Ghana: "gh",
  Togo: "tg",
  Benin: "bj",
  Senegal: "sn",
  Gambia: "gm",
  "Guinea-Bissau": "gw",
  Guinea: "gn",
  "Sierra Leone": "sl",
  Liberia: "lr",
  "Cape Verde": "cv",
  Mauritania: "mr",
  "Western Sahara": "eh",
  "South Africa": "za",
  Namibia: "na",
  Botswana: "bw",
  Zimbabwe: "zw",
  Zambia: "zm",
  Malawi: "mw",
  Mozambique: "mz",
  Madagascar: "mg",
  Mauritius: "mu",
  Seychelles: "sc",
  Comoros: "km",
  Mayotte: "yt",
  Reunion: "re",
  "Saint Helena": "sh",
  Angola: "ao",
  Gabon: "ga",
  "Equatorial Guinea": "gq",
  "Sao Tome and Principe": "st",
  Lesotho: "ls",
  Swaziland: "sz",
  Eswatini: "sz",
  Mexico: "mx",
  Guatemala: "gt",
  Belize: "bz",
  "El Salvador": "sv",
  Honduras: "hn",
  Nicaragua: "ni",
  "Costa Rica": "cr",
  Panama: "pa",
  Cuba: "cu",
  Jamaica: "jm",
  Haiti: "ht",
  "Dominican Republic": "do",
  Bahamas: "bs",
  Barbados: "bb",
  "Trinidad and Tobago": "tt",
  Grenada: "gd",
  "Saint Vincent and the Grenadines": "vc",
  "Saint Lucia": "lc",
  Dominica: "dm",
  "Antigua and Barbuda": "ag",
  "Saint Kitts and Nevis": "kn",
  "Puerto Rico": "pr",
  "United States Virgin Islands": "vi",
  "British Virgin Islands": "vg",
  Anguilla: "ai",
  Montserrat: "ms",
  Guadeloupe: "gp",
  Martinique: "mq",
  "Saint Barthelemy": "bl",
  "Saint Martin": "mf",
  "Sint Maarten": "sx",
  Curacao: "cw",
  Aruba: "aw",
  Bonaire: "bq",
  "Netherlands Antilles": "an",
  "Turks and Caicos Islands": "tc",
  "Cayman Islands": "ky",
  Bermuda: "bm",
  Greenland: "gl",
  "Faroe Islands": "fo",
  Iceland: "is",
  Brazil: "br",
  Argentina: "ar",
  Chile: "cl",
  Peru: "pe",
  Bolivia: "bo",
  Paraguay: "py",
  Uruguay: "uy",
  Colombia: "co",
  Venezuela: "ve",
  Guyana: "gy",
  Suriname: "sr",
  "French Guiana": "gf",
  Ecuador: "ec",
  "Falkland Islands": "fk",
  "Falkland Islands (Malvinas)": "fk",
  "Cook Islands": "ck",
  Niue: "nu",
  Tokelau: "tk",
  "French Polynesia": "pf",
  "Wallis and Futuna": "wf",
  "New Caledonia": "nc",
  "Norfolk Island": "nf",
  "Christmas Island": "cx",
  "Cocos (Keeling) Islands": "cc",
  Gibraltar: "gi",
  "Isle of Man": "im",
  Jersey: "je",
  Guernsey: "gg",
  "Vatican City": "va",
  "San Marino": "sm",
  Monaco: "mc",
  Andorra: "ad",
  Liechtenstein: "li",
};
const PROXY_CONFIG = {
  host: "us.922s5.net",
  port: 6300,
  password: "TPvBwkO8",
  baseUsername: "34998931",
};
async function generateProxyConfig(countryName, countryCode = null) {
  try {
    let isoCode = countryCode;
    if (!isoCode) {
      isoCode = COUNTRY_TO_ISO_CODE[countryName];
      if (!isoCode) {
        console.warn(
          `No ISO code found for '${countryName}'. Defaulting to 'us'.`
        );
        isoCode = "us";
      }
    }
    const sessionId = generateSessionId();
    const username = `${
      PROXY_CONFIG.baseUsername
    }-region-${isoCode.toUpperCase()}-sessid-${sessionId}`;
    const config = {
      server: `http://${PROXY_CONFIG.host}:${PROXY_CONFIG.port}`,
      username,
      password: PROXY_CONFIG.password,
      host: PROXY_CONFIG.host,
      port: PROXY_CONFIG.port,
    };
    console.log(
      `Generated proxy config for ${countryName} (${isoCode}): ${username}`
    );
    return {
      config,
      sessionId,
      originalUsername: username,
      country: countryName,
      countryCode: isoCode,
    };
  } catch (error) {
    console.error(`Error generating proxy config for ${countryName}:`, error);
    throw error;
  }
}
async function testProxyConnection(proxyConfig) {
  const startTime = Date.now();
  try {
    const proxyUrl = `http://${proxyConfig.username}:${proxyConfig.password}@${proxyConfig.host}:${proxyConfig.port}`;
    const testUrls = [
      "https://api.ipify.org",
      "https://ip.oxylabs.io/location",
    ];
    let testResult = null;
    let lastError = null;
    for (const testUrl of testUrls) {
      try {
        const response = await axios.get(testUrl, {
          httpsAgent: new HttpsProxyAgent(proxyUrl),
          timeout: 10000,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
        });
        const responseTime = Date.now() - startTime;
        if (testUrl.includes("ipify")) {
          testResult = {
            success: true,
            ip: response.data.trim(),
            responseTime,
            testUrl,
          };
        } else if (testUrl.includes("oxylabs")) {
          try {
            const locationData = JSON.parse(response.data);
            testResult = {
              success: true,
              ip: locationData.ip || "unknown",
              country: locationData.country || "unknown",
              city: locationData.city || "unknown",
              responseTime,
              testUrl,
              locationData,
            };
          } catch (parseError) {
            testResult = {
              success: true,
              ip: "unknown",
              responseTime,
              testUrl,
              rawResponse: response.data,
            };
          }
        }
        break;
      } catch (error) {
        lastError = error;
        console.warn(`Proxy test failed with ${testUrl}:`, error.message);
        continue;
      }
    }
    if (!testResult) {
      throw lastError || new Error("All proxy test URLs failed");
    }
    console.log(
      `Proxy test successful: ${testResult.ip} (${testResult.responseTime}ms)`
    );
    return testResult;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error("Proxy test failed:", error.message);
    return {
      success: false,
      error: error.message,
      responseTime,
    };
  }
}
function generateSessionId() {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
function getCountryISOCode(countryName) {
  return COUNTRY_TO_ISO_CODE[countryName] || "us";
}
function validateProxyConfig(config) {
  if (!config || typeof config !== "object") {
    return false;
  }
  const requiredFields = ["server", "username", "password", "host", "port"];
  for (const field of requiredFields) {
    if (!config[field]) {
      console.error(`Missing required proxy config field: ${field}`);
      return false;
    }
  }
  if (
    typeof config.port !== "number" ||
    config.port <= 0 ||
    config.port > 65535
  ) {
    console.error(`Invalid proxy port: ${config.port}`);
    return false;
  }
  return true;
}
function createPlaywrightProxyConfig(proxyConfig) {
  if (!validateProxyConfig(proxyConfig)) {
    throw new Error("Invalid proxy configuration");
  }
  return {
    server: proxyConfig.server,
    username: proxyConfig.username,
    password: proxyConfig.password,
  };
}
function getSupportedCountries() {
  return Object.keys(COUNTRY_TO_ISO_CODE);
}
function isCountrySupported(countryName) {
  return countryName in COUNTRY_TO_ISO_CODE;
}
module.exports = {
  generateProxyConfig,
  testProxyConnection,
  generateSessionId,
  getCountryISOCode,
  validateProxyConfig,
  createPlaywrightProxyConfig,
  getSupportedCountries,
  isCountrySupported,
  COUNTRY_TO_ISO_CODE,
  PROXY_CONFIG,
};