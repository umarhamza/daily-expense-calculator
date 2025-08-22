import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) console.warn('Supabase env vars are not set')

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '')

/**
 * Fetch expenses for a given ISO date (YYYY-MM-DD). Stubbed for MVP.
 */
export async function fetchExpensesByDate(userId, isoDate) {
  // Replace with real Supabase query when env is configured
  return { data: [], error: null }
}

/**
 * Fetch expenses for a given month based on a Date. Stubbed for MVP.
 */
export async function fetchExpensesByMonth(userId, monthDate) {
  return { data: [], error: null }
}

/**
 * Autocomplete items based on partial query using ILIKE on item. Stub for MVP.
 */
export async function fetchAutocompleteItems(partial) {
  if (!partial) return { data: [], error: null }
  return { data: [], error: null }
}