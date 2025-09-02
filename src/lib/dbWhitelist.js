import { supabase } from '@/lib/supabase'

/**
 * Execute whitelisted queries mapped from exact SQL strings.
 * Inputs: userId string, sql string
 * Returns: { data: any, error: Error|null }
 * Throws: never. Returns error in object.
 */
export async function executeWhitelistedQuery(userId, sql) {
  const key = String(sql || '').trim()
  if (!key) return { data: null, error: new Error('Empty query') }
  const handler = whitelist.get(key)
  if (!handler) return { data: null, error: new Error('Query not allowed') }
  try {
    return await handler(userId)
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error('Execution error') }
  }
}

const whitelist = new Map()

// Example: SELECT id, item FROM expenses WHERE active = true;
whitelist.set(
  'SELECT id, item FROM expenses WHERE active = true;',
  async function fetchActiveExpenses(userId) {
    if (!userId) return { data: [], error: new Error('Missing userId') }
    const { data, error } = await supabase
      .from('expenses')
      .select('id,item')
      .eq('user_id', userId)
      .eq('active', true)
    return { data: data ?? [], error }
  }
)

