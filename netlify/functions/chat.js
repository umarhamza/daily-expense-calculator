import { createClient } from '@supabase/supabase-js'

/**
 * Netlify serverless chat function implementing conversational CRUD for expenses.
 * Inputs: POST body JSON { question, history[], chatId?, title?, confirm? } and Authorization: Bearer <token>.
 * Returns: JSON per docs/features/0009_PLAN.md with answer, chatId?, and optional confirmation/proposal fields.
 * Throws: responds with 4xx/5xx JSON errors on validation or server exceptions.
 */
export async function handler(event) {
  try {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' })

    const token = getBearerToken(event.headers)
    if (!token) return json(401, { error: 'Missing Authorization bearer token' })

    const { question, history, chatId: incomingChatId, title, confirm } = parseJsonBody(event.body)
    if (!question || typeof question !== 'string') return json(400, { error: 'question is required' })
    const normalizedQuestion = String(question || '').trim()

    const supabase = createServerSupabaseClient(token)

    const { data: userRes, error: userErr } = await supabase.auth.getUser(token)
    if (userErr || !userRes?.user?.id) return json(401, { error: 'Invalid or expired token' })
    const userId = userRes.user.id

    // Ensure chat exists
    let chatId = incomingChatId || null
    if (!chatId) {
      const { data: chatRow, error } = await supabase
        .from('chats')
        .insert({ user_id: userId, title: (title || '').slice(0, 120) || null })
        .select('id')
        .single()
      if (error) return json(500, { error: 'Failed to create chat' })
      chatId = chatRow.id
    }

    // Persist user message
    await safeInsertMessage(supabase, userId, chatId, 'user', normalizedQuestion)

    // Intent routing
    let response
    if (confirm && typeof confirm === 'object' && confirm.type) {
      response = await handleConfirm(supabase, userId, chatId, confirm)
    } else {
      response = await routeQuestion(supabase, userId, chatId, normalizedQuestion, history)
    }

    // Persist assistant message
    const assistantAnswer = response?.answer || 'Okay.'
    await safeInsertMessage(supabase, userId, chatId, 'assistant', assistantAnswer)

    return json(200, { chatId, ...response, answer: assistantAnswer })
  } catch (e) {
    return json(500, { error: 'Internal Server Error' })
  }
}

/**
 * Create a Supabase client that runs queries with the provided bearer token under RLS.
 * Inputs: bearer token string from Authorization header.
 * Returns: supabase client configured for server-side usage.
 */
function createServerSupabaseClient(bearerToken) {
  const url = process.env.VITE_SUPABASE_URL || ''
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || ''
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, detectSessionInUrl: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${bearerToken}` } },
  })
  return client
}

/**
 * Insert a chat message and ignore errors to avoid blocking user flow.
 * Inputs: supabase client, userId, chatId, role, content.
 * Returns: void.
 */
async function safeInsertMessage(supabase, userId, chatId, role, content) {
  try {
    await supabase
      .from('chat_messages')
      .insert({ user_id: userId, chat_id: chatId, role, content, token_count: null })
  } catch (_) {}
}

/**
 * Route a question: try CRUD detection (add/delete/edit), else fallback conversational stub.
 * Inputs: supabase, userId, chatId, question string, history array.
 * Returns: response object per contract.
 */
async function routeQuestion(supabase, userId, chatId, question, history) {
  const ql = question.toLowerCase()

  // Add intent
  if (/(^|\s)(add|record|log)\b/.test(ql)) {
    const addParse = parseAddIntent(question)
    if (!addParse.items.length) return { answer: guidanceForAdd(), attemptedAdd: true }
    const incomplete = addParse.items.some(it => !it.item || !isFiniteNumber(it.cost))
    if (incomplete) {
      const proposal = { type: 'add', items: addParse.items, date: addParse.date }
      const answer = buildConfirmAnswerForAdd(addParse)
      return { confirmationRequired: true, proposal, answer }
    }
    // All complete: ask for confirmation by default per policy
    const proposal = { type: 'add', items: addParse.items, date: addParse.date }
    const answer = buildConfirmAnswerForAdd(addParse)
    return { confirmationRequired: true, proposal, answer }
  }

  // Delete intent
  if (/(^|\s)(delete|remove|undo)\b/.test(ql)) {
    const target = await resolveDeleteTarget(supabase, userId, question)
    if (target.ambiguous) {
      const answer = target.candidates.length === 0
        ? 'I could not find any matching expense to delete.'
        : 'I found multiple matches. Please confirm which one to delete.'
      const proposal = { type: 'delete', target: { candidates: target.candidates } }
      return { confirmationRequired: true, proposal, answer }
    }
    const proposal = { type: 'delete', target: { id: target.id } }
    const answer = 'Delete this expense?'
    return { confirmationRequired: true, proposal, answer }
  }

  // Edit intent
  if (/(^|\s)(edit|update|change)\b/.test(ql)) {
    const parsed = await resolveEditProposal(supabase, userId, question)
    const answer = parsed.message
    return { confirmationRequired: true, proposal: { type: 'edit', ...parsed.proposal }, answer }
  }

  // Fallback conversational stub
  const polite = buildConversationalReply(question)
  return { answer: polite }
}

/**
 * Handle confirm payload for add/delete/edit by executing Supabase operations.
 * Inputs: supabase, userId, chatId, confirm object { type, payload }.
 * Returns: response object with acknowledgement and optional added summary.
 */
async function handleConfirm(supabase, userId, chatId, confirm) {
  const type = String(confirm?.type || '').toLowerCase()
  const payload = confirm?.payload || {}
  if (type === 'add') return executeAdd(supabase, userId, payload)
  if (type === 'delete') return executeDelete(supabase, userId, payload)
  if (type === 'edit') return executeEdit(supabase, userId, payload)
  return { answer: 'Nothing to confirm.' }
}

/**
 * Parse add intent from question.
 * Inputs: question string.
 * Returns: { date: YYYY-MM-DD, items: Array<{ item, quantity, cost }> }.
 */
function parseAddIntent(question) {
  const date = extractIsoDate(question)
  const segments = splitIntoSegments(question)
  const items = []
  for (const seg of segments) {
    const parsed = parseItemSegment(seg)
    if (parsed) items.push(parsed)
  }
  return { date, items }
}

/**
 * Execute add operation by inserting each item for given date.
 * Inputs: supabase, userId, payload { items, date }.
 * Returns: response with added summary.
 */
async function executeAdd(supabase, userId, payload) {
  const date = validateIsoDate(payload?.date) ? payload.date : todayIso()
  const srcItems = Array.isArray(payload?.items) ? payload.items : []
  const items = []
  for (const it of srcItems) {
    const item = String(it?.item || '').trim()
    const quantity = clampQuantity(it?.quantity)
    const cost = toNumber(it?.cost)
    if (!item || !isFiniteNumber(cost) || cost <= 0) continue
    const { data, error } = await supabase
      .from('expenses')
      .insert({ user_id: userId, item, quantity, cost, date })
      .select('id,item,quantity,cost,date')
      .single()
    if (!error && data) items.push({ item: data.item, quantity: data.quantity, cost: data.cost })
  }
  const dateText = date
  const answer = items.length
    ? `Added ${items.map(it => `${it.quantity}× ${it.item} at ${formatMoney(it.cost)}`).join(', ')} on ${dateText}.`
    : 'Nothing was added.'
  return { added: { date, items }, answer }
}

/**
 * Resolve delete target from free text.
 * Inputs: supabase, userId, question string.
 * Returns: { ambiguous: boolean, id?: string, candidates: Array<{ id, item, date, cost, quantity }> }.
 */
async function resolveDeleteTarget(supabase, userId, question) {
  const idMatch = question.match(/[\s#]([0-9a-fA-F-]{10,})/)
  if (idMatch) {
    const id = idMatch[1]
    return { ambiguous: false, id, candidates: [] }
  }
  const date = extractIsoDate(question)
  const itemQuery = extractItemNameForTarget(question)
  if (!itemQuery) return { ambiguous: true, candidates: [] }
  let query = supabase
    .from('expenses')
    .select('id,item,date,cost,quantity')
    .eq('user_id', userId)
    .ilike('item', `%${itemQuery}%`)
    .order('date', { ascending: false })
    .limit(5)
  if (date) query = query.eq('date', date)
  const { data, error } = await query
  if (error) return { ambiguous: true, candidates: [] }
  if (!data || data.length !== 1) {
    const candidates = (data || []).map(r => ({ id: r.id, item: r.item, date: r.date, cost: r.cost, quantity: r.quantity }))
    return { ambiguous: true, candidates }
  }
  return { ambiguous: false, id: data[0].id, candidates: [] }
}

/**
 * Execute delete by id from payload.
 * Inputs: supabase, userId, payload { target: { id } } or { target: { candidates[] } }.
 * Returns: response with acknowledgement.
 */
async function executeDelete(supabase, userId, payload) {
  const id = payload?.target?.id
  if (!id) return { answer: 'No item selected to delete.' }
  const { error } = await supabase.from('expenses').delete().match({ id, user_id: userId })
  const answer = error ? 'Failed to delete.' : 'Deleted.'
  return { answer }
}

/**
 * Resolve an edit proposal with potential ambiguity to be confirmed.
 * Inputs: supabase, userId, question string.
 * Returns: { proposal, message } where proposal targets a specific id or candidates, and update fields.
 */
async function resolveEditProposal(supabase, userId, question) {
  const idMatch = question.match(/[\s#]([0-9a-fA-F-]{10,})/)
  const updates = extractUpdateFields(question)
  const date = extractIsoDate(question)
  if (idMatch) {
    const id = idMatch[1]
    return { proposal: { target: { id }, update: updates }, message: 'Apply these changes?' }
  }
  const itemQuery = extractItemNameForTarget(question)
  if (!itemQuery) return { proposal: { target: { candidates: [] }, update: updates }, message: 'What should I update?' }
  let query = supabase
    .from('expenses')
    .select('id,item,date,cost,quantity')
    .eq('user_id', userId)
    .ilike('item', `%${itemQuery}%`)
    .order('date', { ascending: false })
    .limit(5)
  if (date) query = query.eq('date', date)
  const { data, error } = await query
  if (error || !data || data.length !== 1) {
    const candidates = (data || []).map(r => ({ id: r.id, item: r.item, date: r.date, cost: r.cost, quantity: r.quantity }))
    return { proposal: { target: { candidates }, update: updates }, message: candidates.length ? 'I found multiple matches. Please confirm.' : 'I could not find a unique match. Please confirm.' }
  }
  return { proposal: { target: { id: data[0].id }, update: updates }, message: 'Apply these changes?' }
}

/**
 * Execute an edit update.
 * Inputs: supabase, userId, payload { target: { id }, update }.
 * Returns: response with acknowledgement.
 */
async function executeEdit(supabase, userId, payload) {
  const id = payload?.target?.id
  const update = sanitizeUpdate(payload?.update || {})
  if (!id) return { answer: 'No item selected to update.' }
  if (Object.keys(update).length === 0) return { answer: 'No changes to apply.' }
  const { error } = await supabase
    .from('expenses')
    .update(update)
    .match({ id, user_id: userId })
  const answer = error ? 'Failed to update.' : 'Updated.'
  return { answer }
}

/**
 * Parse helpers: dates, segments, item parsing, updates, etc.
 */
function extractIsoDate(text) {
  const explicit = text.match(/\b(\d{4}-\d{2}-\d{2})\b/)
  if (explicit) return explicit[1]
  const lower = text.toLowerCase()
  if (/(^|\s)today(\s|$)/.test(lower)) return todayIso()
  if (/(^|\s)yesterday(\s|$)/.test(lower)) return offsetIso(-1)
  return todayIso()
}

function validateIsoDate(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function offsetIso(days) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + Number(days || 0))
  return d.toISOString().slice(0, 10)
}

function splitIntoSegments(text) {
  const raw = String(text || '')
  return raw
    .split(/\band\b|,/i)
    .map(s => s.trim())
    .filter(Boolean)
}

function parseItemSegment(seg) {
  const s = seg.trim()
  if (!s) return null
  let cost
  const costMatch = s.match(/(?:at\s*)?([0-9]{1,6}(?:[\.,][0-9]{1,2})?)(?:\s*each)?\b/i)
  if (costMatch) cost = toNumber(costMatch[1])

  let quantity = 1
  const q1 = s.match(/(?:x|×)\s*(\d{1,3})\b/i)
  const q2 = s.match(/\b(\d{1,3})\s*(?:x|×)\b/i)
  const q3 = s.match(/^\s*(\d{1,3})\b/)
  const qm = q1 || q2 || q3
  if (qm) quantity = clampQuantity(qm[1])

  let item = s
    .replace(/\b(\d{4}-\d{2}-\d{2})\b/g, '')
    .replace(costMatch ? costMatch[0] : '', '')
    .replace(/(?:^|\s)(?:add|record|log)\b/i, '')
    .replace(/(?:x|×)\s*\d{1,3}\b/i, '')
    .replace(/\b\d{1,3}\s*(?:x|×)\b/i, '')
    .replace(/^\s*\d{1,3}\b/, '')
    .replace(/\band\b/gi, ' ')
    .trim()

  item = item.replace(/\bat\b/gi, ' ').replace(/\s+/g, ' ').trim()
  if (!item) return { item: '', quantity, cost }
  return { item, quantity, cost }
}

function extractItemNameForTarget(text) {
  let s = text
    .replace(/\b(delete|remove|undo|edit|update|change|add|record|log)\b/gi, '')
    .replace(/\b(\d{4}-\d{2}-\d{2})\b/g, '')
    .replace(/[#$]?\b[0-9a-fA-F-]{10,}\b/g, '')
    .replace(/\b(?:on|at|to|cost|price|each)\b/gi, ' ')
    .replace(/\s+\d+(?:[\.,]\d+)?\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  s = s.replace(/^(the|my|a|an)\s+/i, '').trim()
  return s || null
}

function extractUpdateFields(text) {
  const s = text.toLowerCase()
  const update = {}
  const qty = s.match(/\b(quantity|qty)\s*(to|=)?\s*(\d{1,3})\b/)
  if (qty) update.quantity = clampQuantity(qty[3])
  const cost = s.match(/\b(cost|price|to)\s*(=)?\s*(\d{1,6}(?:[\.,]\d{1,2})?)\b/)
  if (cost) update.cost = toNumber(cost[3])
  const date = text.match(/\b(\d{4}-\d{2}-\d{2})\b/)
  if (date) update.date = date[1]
  const rename = text.match(/\b(?:rename|item)\s+.*?\bto\s+([^,]+)$/i)
  if (rename) update.item = rename[1].trim()
  return sanitizeUpdate(update)
}

function sanitizeUpdate(update) {
  const out = {}
  if (typeof update.item === 'string' && update.item.trim()) out.item = update.item.trim()
  if (isFiniteNumber(update.cost) && update.cost > 0) out.cost = toNumber(update.cost)
  if (Number.isInteger(update.quantity) && update.quantity > 0) out.quantity = clampQuantity(update.quantity)
  if (validateIsoDate(update.date)) out.date = update.date
  return out
}

function clampQuantity(q) {
  const n = parseInt(q, 10)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(n, 999)
}

function toNumber(v) {
  if (typeof v === 'number') return v
  const s = String(v || '').replace(',', '.')
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : NaN
}

function isFiniteNumber(v) {
  return Number.isFinite(typeof v === 'number' ? v : toNumber(v))
}

function formatMoney(n) {
  const val = toNumber(n)
  if (!isFiniteNumber(val)) return String(n)
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(val)
}

function buildConfirmAnswerForAdd(parsed) {
  const list = parsed.items.map(it => {
    const item = it.item || 'item'
    const qty = clampQuantity(it.quantity)
    const cost = isFiniteNumber(it.cost) ? formatMoney(it.cost) : '?'
    return `${qty}× ${item} at ${cost}`
  }).join(', ')
  return `Confirm adding ${list} on ${parsed.date}?`
}

function guidanceForAdd() {
  return 'I couldn’t understand the items. Try: “add bread 3 at 12 each, eggs 2 at 15 each”.'
}

function buildConversationalReply(question) {
  const q = question.trim()
  if (/hello|hi|hey/i.test(q)) return 'Hi! I can add or edit expenses. How can I help?'
  if (/help|how/i.test(q)) return 'Try: “add bread 2 at 12 each today” or “delete coffee from yesterday”.'
  return 'I can help record expenses or make quick edits. What would you like to do?'
}

function json(status, body) {
  return {
    statusCode: status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  }
}

function getBearerToken(headers) {
  const h = headers || {}
  const auth = h.authorization || h.Authorization || ''
  const m = /^Bearer\s+(.+)$/i.exec(auth)
  return m ? m[1] : null
}

function parseJsonBody(body) {
  try { return JSON.parse(body || '{}') } catch (_) { return {} }
}
