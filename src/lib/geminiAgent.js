import { validateGeminiAction, buildRespondToUser } from '@/lib/geminiSchema'
import { executeWhitelistedQuery } from '@/lib/dbWhitelist'
import { getSystemPrompt } from '@/lib/prompts/geminiSystemPrompt'
import { getCurrentUser } from '@/lib/supabase'

/**
 * Run Gemini with strict JSON action protocol.
 * Inputs: message string.
 * Returns: JSON string with a single action per protocol.
 * Throws: on malformed model output or unexpected internal errors.
 */
export async function runGemini(message) {
  const input = String(message || '').trim()
  if (!input) throw new Error('Message is required')

  // NOTE: Placeholder LLM call. Integrator should replace with actual Gemini API call.
  // For now, we simply forward the message when it already looks like strict JSON.
  // This ensures the pipeline compiles and enforces downstream validation.
  const modelRaw = input

  let parsed
  try {
    parsed = JSON.parse(modelRaw)
  } catch (_) {
    throw new Error('Model output was not valid JSON')
  }
  const validated = validateGeminiAction(parsed)
  if (!validated.ok) throw validated.error

  if (validated.action === 'db_query') {
    const { data, error } = await executeWhitelistedQuery(await getUserId(), validated.query)
    if (error || !data || (Array.isArray(data) && data.length === 0)) {
      return buildRespondToUser('No results found.')
    }
    // Summarize briefly per rules (<=20 words)
    const summary = summarizeDataBrief(data)
    return buildRespondToUser(summary)
  }

  if (validated.action === 'respond_to_user') {
    return buildRespondToUser(validated.content)
  }

  throw new Error('Unsupported action')
}

async function getUserId() {
  const { data } = await getCurrentUser()
  return data?.user?.id || null
}

function summarizeDataBrief(data) {
  if (Array.isArray(data)) {
    const count = data.length
    return `${count} result${count === 1 ? '' : 's'} found.`
  }
  return 'Results available.'
}

