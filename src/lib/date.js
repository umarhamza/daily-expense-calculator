/**
 * Format a YYYY-MM-DD ISO date into a human-friendly full date string.
 * Input: isoDate (e.g., "2025-08-20").
 * Output: string like "Tuesday, August 20, 2025".
 */
export function formatDay(isoDate) {
  const date = new Date(isoDate)
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
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
    month: 'short',
    year: 'numeric'
  }).format(date)
}

/**
 * Format a YYYY-MM-DD ISO date into a compact string like "Sun 12th".
 * Input: isoDate (e.g., "2025-08-20"). Output: e.g., "Wed 20th".
 */
export function formatDayShort(isoDate) {
  const date = new Date(isoDate)
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date)
  const day = date.getUTCDate()
  const suffix = getOrdinalSuffix(day)
  return `${weekday} ${day}${suffix}`
}

/**
 * Return ordinal suffix for a day number (1 -> 'st', 2 -> 'nd', 3 -> 'rd', 4 -> 'th', ...).
 */
function getOrdinalSuffix(day) {
  if (day % 100 >= 11 && day % 100 <= 13) return 'th'
  const last = day % 10
  if (last === 1) return 'st'
  if (last === 2) return 'nd'
  if (last === 3) return 'rd'
  return 'th'
}

/**
 * Return previous day ISO (YYYY-MM-DD) using UTC-safe arithmetic.
 * Input: isoDate (YYYY-MM-DD). Returns: previous day ISO string.
 */
export function getPrevDayIso(isoDate) {
  const date = new Date(isoDate)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

/**
 * Return next day ISO clamped to today (UTC), as YYYY-MM-DD.
 * Input: isoDate (YYYY-MM-DD). Returns: clamped next day ISO string.
 */
export function getNextDayIsoClampedToToday(isoDate) {
  const date = new Date(isoDate)
  date.setUTCDate(date.getUTCDate() + 1)
  const next = date.toISOString().slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)
  return next > today ? today : next
}

/**
 * Return previous month start ISO (YYYY-MM-01) using UTC-safe arithmetic.
 */
export function getPrevMonthStartIso(isoMonthStart) {
  const d = new Date(isoMonthStart)
  const prev = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1))
  return prev.toISOString().slice(0, 10)
}

/**
 * Return next month start ISO (YYYY-MM-01), clamped to the current month start.
 */
export function getNextMonthStartIsoClampedToCurrent(isoMonthStart) {
  const d = new Date(isoMonthStart)
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
  const nextIso = next.toISOString().slice(0, 10)
  const currentMonthStart = new Date().toISOString().slice(0, 7) + '-01'
  return nextIso > currentMonthStart ? currentMonthStart : nextIso
}

