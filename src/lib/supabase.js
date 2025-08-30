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
    .select('id,item,cost,quantity,date,created_at')
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
    .select('id,item,cost,quantity,date,created_at')
    .eq('user_id', userId)
    .gte('date', start)
    .lt('date', endExclusive)
    .order('date', { ascending: true })
  return { data: data ?? [], error }
}

/**
 * Insert a new expense for the user. Returns { data, error } with the inserted row.
 * Expects expense: { item: string, cost: number, date: YYYY-MM-DD, quantity?: number }
 */
export async function insertExpense(userId, expense) {
  const q = Number.parseInt(expense.quantity ?? 1, 10)
  const quantity = Number.isFinite(q) && q > 0 ? q : 1
  const payload = { user_id: userId, item: expense.item, cost: expense.cost, date: expense.date, quantity }
  const { data, error } = await supabase
    .from('expenses')
    .insert(payload)
    .select('id,item,cost,quantity,date,created_at')
    .single()
  return { data, error }
}

/**
 * Update an existing expense by id for the user. Returns { data, error } with the updated row.
 * Expects expense: { item?: string, cost?: number, date?: YYYY-MM-DD, quantity?: number }
 */
export async function updateExpense(userId, id, expense) {
  const update = { ...expense }
  if (update.quantity != null) {
    const q = Number.parseInt(update.quantity, 10)
    update.quantity = Number.isFinite(q) && q > 0 ? q : 1
  }
  const { data, error } = await supabase
    .from('expenses')
    .update(update)
    .match({ id, user_id: userId })
    .select('id,item,cost,quantity,date,created_at')
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
    .select('user_id,display_name,currency_symbol,created_at,updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  return { data, error }
}

/**
 * Update profile for the user. Performs update; if missing, inserts a row. Returns { data, error }.
 * Inputs: partial = { display_name?, currency_symbol? }
 */
export async function updateProfile(userId, partial) {
  if (!userId) return { data: null, error: new Error('Missing userId') }
  if (!partial || typeof partial !== 'object') return { data: null, error: new Error('Missing update payload') }
  const { data, error } = await supabase
    .from('profiles')
    .update(partial)
    .eq('user_id', userId)
    .select('user_id,display_name,currency_symbol,created_at,updated_at')
    .maybeSingle()
  if (error) return { data: null, error }
  if (data) return { data, error: null }
  const { data: inserted, error: insertError } = await supabase
    .from('profiles')
    .insert({ user_id: userId, ...partial })
    .select('user_id,display_name,currency_symbol,created_at,updated_at')
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

/**
 * Create a chat row for the user. Returns { data, error } where data contains { id, title, created_at }.
 * Inputs: title? string
 */
export async function createChat(userId, title) {
  if (!userId) return { data: null, error: new Error('Missing userId') }
  const payload = { user_id: userId, title: title || null }
  const { data, error } = await supabase
    .from('chats')
    .insert(payload)
    .select('id,title,created_at')
    .single()
  return { data, error }
}

/**
 * List chats for the user, newest first. Returns { data, error } where data is array of { id, title, created_at }.
 */
export async function listChats(userId) {
  if (!userId) return { data: [], error: new Error('Missing userId') }
  const { data, error } = await supabase
    .from('chats')
    .select('id,title,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return { data: data ?? [], error }
}

/**
 * Delete a chat for the user. Messages are removed via cascade. Returns { error }.
 */
export async function deleteChat(userId, chatId) {
  if (!userId) return { error: new Error('Missing userId') }
  if (!chatId) return { error: new Error('Missing chatId') }
  const { error } = await supabase
    .from('chats')
    .delete()
    .match({ id: chatId, user_id: userId })
  return { error }
}

/**
 * Insert a chat message. Returns { data, error } with { id, role, content, created_at }.
 * Inputs: role in ('user','assistant','system'), content string, meta? ignored for now.
 */
export async function insertMessage(userId, chatId, role, content, meta) {
  if (!userId) return { data: null, error: new Error('Missing userId') }
  if (!chatId) return { data: null, error: new Error('Missing chatId') }
  const payload = { user_id: userId, chat_id: chatId, role, content, token_count: meta?.token_count ?? null }
  const { data, error } = await supabase
    .from('chat_messages')
    .insert(payload)
    .select('id,role,content,created_at')
    .single()
  return { data, error }
}

/**
 * List messages for a chat, ascending by created_at. Supports limit and pagination via beforeId if needed.
 */
export async function listMessages(userId, chatId, limit = 50) {
  if (!userId) return { data: [], error: new Error('Missing userId') }
  if (!chatId) return { data: [], error: new Error('Missing chatId') }
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id,role,content,created_at')
    .eq('user_id', userId)
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })
    .limit(limit)
  return { data: data ?? [], error }
}

/**
 * Compute total spend for a specific item over an optional date range.
 * Inputs: userId string, item string, startDate? YYYY-MM-DD, endDate? YYYY-MM-DD
 * Returns: { data: { total: number }, error }
 */
export async function getTotalForItem(userId, item, startDate, endDate) {
  if (!userId) return { data: { total: 0 }, error: new Error('Missing userId') }
  const name = String(item || '').trim().toLowerCase()
  if (!name) return { data: { total: 0 }, error: new Error('Missing item') }
  const hasStart = typeof startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(startDate)
  const hasEnd = typeof endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(endDate)
  let query = supabase
    .from('expenses')
    .select('item,cost,date')
    .eq('user_id', userId)
    .ilike('item', name)
  if (hasStart) query = query.gte('date', startDate)
  if (hasEnd) query = query.lte('date', endDate)
  const { data, error } = await query
  if (error) return { data: { total: 0 }, error }
  const total = (data || []).reduce((sum, row) => {
    const cost = Number.parseFloat(row?.cost)
    return sum + (Number.isFinite(cost) ? cost : 0)
  }, 0)
  return { data: { total }, error: null }
}

/**
 * Compute total spend for a date window.
 * Inputs: userId string, startDate YYYY-MM-DD, endDate YYYY-MM-DD
 * Returns: { data: { total: number }, error }
 */
export async function getTotalForPeriod(userId, startDate, endDate) {
  if (!userId) return { data: { total: 0 }, error: new Error('Missing userId') }
  const hasStart = typeof startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(startDate)
  const hasEnd = typeof endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(endDate)
  if (!hasStart || !hasEnd) return { data: { total: 0 }, error: new Error('Invalid date range') }
  const { data, error } = await supabase
    .from('expenses')
    .select('cost')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
  if (error) return { data: { total: 0 }, error }
  const total = (data || []).reduce((sum, row) => {
    const cost = Number.parseFloat(row?.cost)
    return sum + (Number.isFinite(cost) ? cost : 0)
  }, 0)
  return { data: { total }, error: null }
}

/**
 * Return top items by spend for an optional date range.
 * Inputs: userId string, startDate? YYYY-MM-DD, endDate? YYYY-MM-DD, limit number (default 5)
 * Returns: { data: Array<{ item: string, total: number }>, error }
 */
export async function getTopItems(userId, startDate, endDate, limit = 5) {
  if (!userId) return { data: [], error: new Error('Missing userId') }
  const hasStart = typeof startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(startDate)
  const hasEnd = typeof endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(endDate)
  let query = supabase
    .from('expenses')
    .select('item,cost,quantity,date')
    .eq('user_id', userId)
  if (hasStart) query = query.gte('date', startDate)
  if (hasEnd) query = query.lte('date', endDate)
  const { data, error } = await query
  if (error) return { data: [], error }
  const totals = new Map()
  for (const row of data || []) {
    const key = String(row?.item || '').toLowerCase().trim()
    if (!key) continue
    const cost = Number.parseFloat(row?.cost)
    const prev = totals.get(key) || 0
    totals.set(key, prev + (Number.isFinite(cost) ? cost : 0))
  }
  const arr = Array.from(totals.entries())
    .map(([item, total]) => ({ item, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, Math.max(1, Number(limit) || 5))
  return { data: arr, error: null }
}