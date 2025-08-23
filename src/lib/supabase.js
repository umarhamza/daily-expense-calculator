import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) console.warn('Supabase env vars are not set')

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '')

/**
 * Fetch expenses for a given ISO date (YYYY-MM-DD). Returns { data, error }.
 * Filters by userId and exact date.
 */
export async function fetchExpensesByDate(userId, isoDate) {
  const { data, error } = await supabase
    .from('expenses')
    .select('id,item,cost,date,created_at')
    .eq('user_id', userId)
    .eq('date', isoDate)
    .order('created_at', { ascending: false })
  return { data: data ?? [], error }
}

/**
 * Fetch expenses for a given month based on a Date (string YYYY-MM-01). Returns { data, error }.
 * Filters by userId and date range [monthStart, nextMonthStart).
 */
export async function fetchExpensesByMonth(userId, monthDate) {
  const start = monthDate
  const d = new Date(monthDate)
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
  const endExclusive = next.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('expenses')
    .select('id,item,cost,date,created_at')
    .eq('user_id', userId)
    .gte('date', start)
    .lt('date', endExclusive)
    .order('date', { ascending: true })
  return { data: data ?? [], error }
}

/**
 * Insert a new expense for the user. Returns { data, error } with the inserted row.
 * Expects expense: { item: string, cost: number, date: YYYY-MM-DD }
 */
export async function insertExpense(userId, expense) {
  const payload = { user_id: userId, item: expense.item, cost: expense.cost, date: expense.date }
  const { data, error } = await supabase
    .from('expenses')
    .insert(payload)
    .select('id,item,cost,date,created_at')
    .single()
  return { data, error }
}

/**
 * Autocomplete items based on partial query using ILIKE on item.
 */
export async function fetchAutocompleteItems(partial) {
  if (!partial) return { data: [], error: null }
  const { data, error } = await supabase
    .from('expenses')
    .select('item')
    .ilike('item', `%${partial}%`)
    .limit(10)
  const unique = Array.from(new Set((data ?? []).map(r => r.item)))
  return { data: unique.map(item => ({ item })), error }
}