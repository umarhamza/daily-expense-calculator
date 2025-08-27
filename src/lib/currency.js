/**
 * Currency formatting utilities.
 * Inputs: amount (number), currencyCode (ISO 4217 string like 'USD').
 * Returns: formatted currency string using Intl.NumberFormat.
 * Throws: none.
 */
function formatCurrency(amount, currencyCode) {
  const safeAmount = Number.isFinite(amount) ? amount : 0
  const code = typeof currencyCode === 'string' && currencyCode.length === 3 ? currencyCode : 'USD'
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: code, maximumFractionDigits: 2 }).format(safeAmount)
  } catch (_) {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(safeAmount)
  }
}

/**
 * Returns default currency from localStorage or 'USD'.
 */
function getDefaultCurrency() {
  try {
    const stored = localStorage.getItem('currency')
    if (stored && stored.length === 3) return stored
  } catch (_) {}
  return 'USD'
}

export { formatCurrency, getDefaultCurrency }

