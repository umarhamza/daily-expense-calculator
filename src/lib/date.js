/**
 * Format a YYYY-MM-DD ISO date into a human-friendly full date string.
 * Input: isoDate (e.g., "2025-08-20").
 * Output: string like "Tuesday, August 20, 2025".
 */
export function formatDay(isoDate) {
  const date = new Date(isoDate)
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(date)
}

/**
 * Format a month start ISO date (YYYY-MM-01) into a human-friendly month string.
 * Input: isoMonthStart (e.g., "2025-08-01").
 * Output: string like "August 2025".
 */
export function formatMonth(isoMonthStart) {
  const date = new Date(isoMonthStart)
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric'
  }).format(date)
}

