/**
 * Format a numeric amount with optional symbol prefix.
 * Inputs: amount (number), options?: { symbolOverride?: string }
 * Returns: decimal-formatted string like "10.00" or "$10.00" when symbol provided.
 * Throws: none.
 */
function formatAmount(amount, options = {}) {
  const safeAmount = Number.isFinite(amount) ? amount : 0
  const symbol =
    typeof options.symbolOverride === 'string' && options.symbolOverride.trim().length >= 1
      ? options.symbolOverride.trim()
      : ''
  const number = new Intl.NumberFormat(undefined, {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeAmount)
  return symbol ? `${symbol}${number}` : number
}

export { formatAmount }

