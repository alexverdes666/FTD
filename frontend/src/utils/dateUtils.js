const BG_TIMEZONE = 'Europe/Sofia';

/**
 * Format a date string/Date in Bulgarian timezone (Europe/Sofia)
 * Shows: short month, day, year, hour, minute
 * Example: "Mar 6, 2026, 02:30 PM"
 */
export const formatDateTimeBG = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('en-US', {
    timeZone: BG_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Format a date string/Date in Bulgarian timezone - date only
 * Example: "3/6/2026"
 */
export const formatDateBG = (dateStr) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    timeZone: BG_TIMEZONE,
  });
};

/**
 * Format a date string/Date in Bulgarian timezone - full locale string
 * Example: "3/6/2026, 2:30:00 PM"
 */
export const formatFullDateTimeBG = (dateStr) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleString('en-US', {
    timeZone: BG_TIMEZONE,
  });
};

/**
 * Format a date string/Date in Bulgarian timezone - short date (month, day, year)
 * Example: "Mar 6, 2026"
 */
export const formatShortDateBG = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('en-US', {
    timeZone: BG_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Format time only in Bulgarian timezone
 * Example: "02:30 PM"
 */
export const formatTimeBG = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleTimeString('en-US', {
    timeZone: BG_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  });
};

export { BG_TIMEZONE };
