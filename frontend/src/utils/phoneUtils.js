const COUNTRY_CODES = {
  Australia: "+61",
  Canada: "+1",
  Germany: "+49",
  Italy: "+39",
  Poland: "+48",
  "South Africa": "+27",
  Spain: "+34",
  Sweden: "+46",
  "United Kingdom": "+44",
};

export const getCountryCode = (country) => {
  if (!country) return "";
  return COUNTRY_CODES[country] || "";
};

export const formatPhoneWithCountryCode = (phone, country) => {
  if (!phone) return "N/A";
  const code = getCountryCode(country);
  return code ? `${code} ${phone}` : phone;
};
