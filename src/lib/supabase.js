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
 * Update an existing expense by id for the user. Returns { data, error } with the updated row.
 * Expects expense: { item?: string, cost?: number, date?: YYYY-MM-DD }
 */
export async function updateExpense(userId, id, expense) {
  const { data, error } = await supabase
    .from('expenses')
    .update(expense)
    .match({ id, user_id: userId })
    .select('id,item,cost,date,created_at')
    .single()
  return { data, error }
}

/**
 * Delete an expense by id for the user. Returns { error }.
 */
export async function deleteExpense(userId, id) {
  const { error } = await supabase
    .from('expenses')
    .delete()
    .match({ id, user_id: userId })
  return { error }
}

/**
 * Fetch current auth user. Returns { data, error }.
 */
export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser()
  return { data, error }
}

/**
 * Fetch the profile row for a user. Returns { data, error } where data is the row or null.
 */
export async function getProfile(userId) {
  if (!userId) return { data: null, error: new Error('Missing userId') }
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id,display_name,currency,currency_symbol,created_at,updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  return { data, error }
}

/**
 * Update profile for the user. Performs update; if missing, inserts a row. Returns { data, error }.
 * Inputs: partial = { display_name?, currency? }
 */
export async function updateProfile(userId, partial) {
  if (!userId) return { data: null, error: new Error('Missing userId') }
  if (!partial || typeof partial !== 'object') return { data: null, error: new Error('Missing update payload') }
  const { data, error } = await supabase
    .from('profiles')
    .update(partial)
    .eq('user_id', userId)
    .select('user_id,display_name,currency,currency_symbol,created_at,updated_at')
    .maybeSingle()
  if (error) return { data: null, error }
  if (data) return { data, error: null }
  const { data: inserted, error: insertError } = await supabase
    .from('profiles')
    .insert({ user_id: userId, ...partial })
    .select('user_id,display_name,currency,currency_symbol,created_at,updated_at')
    .single()
  return { data: inserted, error: insertError }
}

/**
 * Update the current user's password. Returns { error }.
 */
export async function updateUserPassword(newPassword) {
  if (!newPassword || String(newPassword).length < 6) return { error: new Error('Password must be at least 6 characters') }
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  return { error }
}

/**
 * Autocomplete items based on partial query using ILIKE on item.
 */
export async function fetchAutocompleteItems(partial, userId) {
  if (!partial) return { data: [], error: null }
  if (!userId) return { data: [], error: new Error('Missing userId') }
  const { data, error } = await supabase
    .from('expenses')
    .select('item')
    .eq('user_id', userId)
    .ilike('item', `%${partial}%`)
    .limit(10)
  const unique = Array.from(new Set((data ?? []).map(r => r.item)))
  return { data: unique.map(item => ({ item })), error }
}