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
 * Format amount with optional symbol override.
 * Inputs: amount (number), options: { code?: string, symbolOverride?: string }
 * Returns: string like "$10.00" or "D10.00" when symbol override provided.
 */
function formatAmount(amount, options = {}) {
  const safeAmount = Number.isFinite(amount) ? amount : 0
  const code = typeof options.code === 'string' && options.code.length === 3 ? options.code : 'USD'
  const symbol = typeof options.symbolOverride === 'string' && options.symbolOverride.trim().length >= 1 ? options.symbolOverride.trim() : null
  if (!symbol) return formatCurrency(safeAmount, code)
  // Use Intl for numeric part, then replace currencyDisplay with symbol prefix
  try {
    const formatted = new Intl.NumberFormat(undefined, { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol', maximumFractionDigits: 2 }).format(safeAmount)
    // Replace any leading currency sign/run with our symbol. Fallback to prefix symbol.
    // Common outputs: "$10.00", "US$ 10.00", "10,00 €". We keep spacing minimal.
    const replaced = formatted
      .replace(/^\p{Sc}+\s?/u, '') // remove leading currency sign(s)
      .replace(/^([A-Z]{2}\$)\s?/u, '') // remove things like US$
    return symbol + replaced
  } catch (_) {
    return `${symbol}${safeAmount.toFixed(2)}`
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

export { formatCurrency, formatAmount, getDefaultCurrency }

