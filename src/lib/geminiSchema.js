/**
 * Validate Gemini action JSON objects.
 * Inputs: value any JSON-parsed input.
 * Returns: { ok: boolean, error?: Error, action?: 'respond_to_user'|'db_query'|'', content?: string, query?: string }
 * Throws: never. Uses return object for errors.
 */
export function validateGeminiAction(value) {
  const fail = (message) => ({ ok: false, error: new Error(message) })
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return fail('Payload must be a JSON object')
  const action = value.action
  if (action !== 'respond_to_user' && action !== 'db_query') return fail('Invalid or missing action')
  if (action === 'respond_to_user') {
    const content = value.content
    if (typeof content !== 'string') return fail('content must be a string')
    const words = content.trim().split(/\s+/).filter(Boolean)
    if (words.length === 0) return fail('content cannot be empty')
    if (words.length > 20) return fail('content exceeds 20 words')
    return { ok: true, action, content }
  }
  if (action === 'db_query') {
    const query = value.query
    if (typeof query !== 'string' || !query.trim()) return fail('query must be a non-empty string')
    return { ok: true, action, query }
  }
  return fail('Unknown action')
}

/**
 * Normalize and safely stringify the final JSON response.
 * Ensures no extra properties are leaked.
 */
export function buildRespondToUser(content) {
  const text = String(content || '').trim()
  const words = text.split(/\s+/).filter(Boolean)
  const safe = words.slice(0, 20).join(' ')
  return JSON.stringify({ action: 'respond_to_user', content: safe })
}

export function buildDbQuery(query) {
  const q = String(query || '').trim()
  return JSON.stringify({ action: 'db_query', query: q })
}

