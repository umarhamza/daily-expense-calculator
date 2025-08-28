export async function handler(event) {
	if (event.httpMethod !== 'POST') {
		return jsonRes(405, { error: 'Method not allowed' })
	}

	try {
		const apiKey = process.env.GEMINI_API_KEY
		if (!apiKey) return jsonRes(500, { error: 'GEMINI_API_KEY is not set' })

		const supabaseUrl = process.env.VITE_SUPABASE_URL
		const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
		if (!supabaseUrl || !supabaseAnonKey) return jsonRes(500, { error: 'Supabase env vars are not set' })

		const authHeader = event.headers.authorization || event.headers.Authorization
		const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
		if (!token) return jsonRes(401, { error: 'Missing Authorization token' })

		const body = event.body ? JSON.parse(event.body) : {}
		const question = String(body.question || '').trim()
		if (!question) return jsonRes(400, { error: 'Question is required' })

		// Context for smarter, context-aware chat
		const dateIso = toISO(new Date())
		const confirm = body.confirm && typeof body.confirm === 'object' ? body.confirm : null
		const requestedChatId = body.chatId ? String(body.chatId) : null
		const requestedTitle = body.title ? String(body.title) : null

		const { createClient } = await import('@supabase/supabase-js')
		const supabase = createClient(supabaseUrl, supabaseAnonKey, {
			global: { headers: { Authorization: `Bearer ${token}` } },
		})

		// Resolve authenticated user and ensure chat
		const { data: userData, error: userErr } = await supabase.auth.getUser()
		if (userErr || !userData?.user?.id) return jsonRes(401, { error: 'Not authenticated' })
		const userId = userData.user.id
		const chatId = await ensureChat(supabase, userId, requestedChatId, requestedTitle || question.slice(0, 60))
		if (!chatId) {
			return jsonRes(requestedChatId ? 404 : 500, { error: requestedChatId ? 'Chat not found' : 'Could not create chat' })
		}

		// Persist user message
		await insertChatMessage(supabase, userId, chatId, 'user', question)

		// Load DB-backed history for prompt (last N)
		const chatHistory = await fetchChatHistoryForPrompt(supabase, userId, chatId, 20)

		// 0) Confirmation commit path (ADD | MODIFY | DELETE)
		if (confirm && confirm.type) {
			const t = String(confirm.type || '').toUpperCase()
			// Verify proposal token before committing
			const valid = await verifyProposalToken(supabase, confirm)
			if (!valid) return await respondWithAssistantMessage(supabase, userId, chatId, 200, { answer: 'Confirmation expired or invalid. Please try again.', chatId })
			if (t === 'ADD') {
				const res = await commitAddProposal(supabase, confirm.payload)
				if (!res.ok) return await respondWithAssistantMessage(supabase, userId, chatId, 200, { answer: res.message || 'Sorry, I could not save that.', chatId })
				return await respondWithAssistantMessage(supabase, userId, chatId, 200, { answer: res.answer, added: res.added, chatId })
			}
			if (t === 'MODIFY') {
				const res = await commitModifyProposal(supabase, confirm.payload)
				return await respondWithAssistantMessage(supabase, userId, chatId, 200, { answer: res.answer, updated: res.updated, chatId })
			}
			if (t === 'DELETE') {
				const res = await commitDeleteProposal(supabase, confirm.payload)
				return await respondWithAssistantMessage(supabase, userId, chatId, 200, { answer: res.answer, deleted: res.deleted, chatId })
			}
		}

		// 1) Intent detection with history and date (ADD | MODIFY | DELETE | QUERY | CONFIRM | CLARIFY)
		const intent = await detectIntentWithContext(apiKey, { dateIso, history: chatHistory, latest: question })

		// 2) Route by intent
		if (intent === 'ADD') {
			const proposal = await buildAddProposalFromNaturalText(apiKey, supabase, { dateIso, history: chatHistory, latest: question })
			if (proposal.ok) return await respondWithAssistantMessage(supabase, userId, chatId, 200, { answer: proposal.summary, confirmationRequired: true, proposal: { type: 'ADD', date: proposal.date, items: proposal.items, token: proposal.token }, chatId })
			return await respondWithAssistantMessage(supabase, userId, chatId, 200, { answer: 'I couldn\'t understand the items. Try: “add bread 3 at 12 each, eggs 2 at 15 each”.', attemptedAdd: true, chatId })
		}

		if (intent === 'MODIFY') {
			const proposal = await buildModifyProposal(apiKey, supabase, { dateIso, history: chatHistory, latest: question })
			return await respondWithAssistantMessage(supabase, userId, chatId, 200, { ...proposal, chatId })
		}

		if (intent === 'DELETE') {
			const proposal = await buildDeleteProposal(apiKey, supabase, { dateIso, history: chatHistory, latest: question })
			return await respondWithAssistantMessage(supabase, userId, chatId, 200, { ...proposal, chatId })
		}

		if (intent === 'QUERY') {
			const qaAnswer = await answerSpendQuestion(supabase, question)
			return await respondWithAssistantMessage(supabase, userId, chatId, 200, { answer: qaAnswer, chatId })
		}

		// CLARIFY or unknown → self-help and scope reminder
		if (/how\s+do\s+i\s+use\s+this\??/i.test(question)) {
			return await respondWithAssistantMessage(supabase, userId, chatId, 200, { answer: 'I track expenses. Try “add bread 2 at 10”, “edit bread to 12”, “delete bread yesterday”, or ask “total this week vs last week”.', chatId })
		}
		return await respondWithAssistantMessage(supabase, userId, chatId, 200, { answer: 'I can add, modify, delete expenses, or show totals. What would you like?', chatId })
	} catch (err) {
		return jsonRes(500, { error: err?.message || 'Unexpected error' })
	}
}

function jsonRes(statusCode, obj) {
	return {
		statusCode,
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(obj),
	}
}

// --- Chat persistence helpers ---

async function ensureChat(supabase, userId, maybeChatId, title) {
  try {
    if (maybeChatId) {
      const { data } = await supabase
        .from('chats')
        .select('id')
        .eq('id', maybeChatId)
        .eq('user_id', userId)
        .maybeSingle()
      return data?.id || null
    }
    const ttl = String(title || '').slice(0, 80) || null
    const { data: inserted } = await supabase
      .from('chats')
      .insert({ user_id: userId, title: ttl })
      .select('id')
      .single()
    return inserted?.id || null
  } catch {
    return null
  }
}

async function insertChatMessage(supabase, userId, chatId, role, content) {
  try {
    const c = String(content || '').slice(0, 8000)
    const { data } = await supabase
      .from('chat_messages')
      .insert({ user_id: userId, chat_id: chatId, role, content: c })
      .select('id')
      .single()
    return data?.id || null
  } catch {
    return null
  }
}

async function fetchChatHistoryForPrompt(supabase, userId, chatId, limit) {
  try {
    const count = limit || 20
    const { data } = await supabase
      .from('chat_messages')
      .select('role,content')
      .eq('user_id', userId)
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .limit(count)
    const cleaned = (data || [])
      .map(x => ({ role: String(x.role || '').toLowerCase(), content: String(x.content || '').trim() }))
      .filter(x => (x.role === 'user' || x.role === 'assistant') && x.content)
      .reverse()
    return cleaned.slice(0, count)
  } catch {
    return []
  }
}

async function respondWithAssistantMessage(supabase, userId, chatId, statusCode, payload) {
  let messageId = null
  if (payload && payload.answer) {
    try { messageId = await insertChatMessage(supabase, userId, chatId, 'assistant', payload.answer) } catch {}
  }
  const body = { ...(payload || {}), chatId, messageId }
  return jsonRes(statusCode, body)
}

/**
 * Calls Gemini to obtain a strict JSON search plan for expense retrieval.
 * Returns a plain object with optional keys: { items?: string[], dateRange?: { from: string, to: string }, dates?: string[] }
 */
async function getSearchPlanFromGemini(apiKey, question) {
	const system = [
		'You are a query planner for a personal expense tracker.',
		'Return ONLY valid JSON. No prose. No code fences. No trailing commas.',
		'Match this schema exactly and omit unknown keys:',
		'{"items": string[] optional, "dateRange": {"from": "YYYY-MM-DD", "to": "YYYY-MM-DD"} optional, "dates": string[] optional}',
		'Rules:',
		'- If user mentions items (e.g., bread, taxi) include them in items as lowercase words.',
		'- If user mentions a specific day, put it in dates as YYYY-MM-DD.',
		'- If user mentions a range like "last week", compute a reasonable recent range within the past 90 days.',
		'- If nothing is specified, set dateRange to the last 30 days.',
	].join('\n')

	const prompt = [
		system,
		'',
		'User question:',
		question,
		'',
		'Respond with ONLY the JSON object.'
	].join('\n')

	const res = await callGemini(apiKey, prompt, { temperature: 0, maxOutputTokens: 256 })
	if (!res.ok) return getDefaultPlan()

	const text = (res.text || '').trim()
	try {
		const parsed = JSON.parse(text)
		return sanitizePlan(parsed)
	} catch (_) {
		return getDefaultPlan()
	}
}

function getDefaultPlan() {
	const today = new Date()
	const from = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
	return { dateRange: { from: toISO(from), to: toISO(today) } }
}

function sanitizePlan(plan) {
	const out = {}
	if (Array.isArray(plan.items)) {
		out.items = plan.items
			.map(x => String(x || '').trim())
			.filter(Boolean)
	}
	if (plan.dateRange && typeof plan.dateRange === 'object') {
		const from = String(plan.dateRange.from || '').slice(0, 10)
		const to = String(plan.dateRange.to || '').slice(0, 10)
		if (isISODate(from) && isISODate(to)) out.dateRange = { from, to }
	}
	if (Array.isArray(plan.dates)) {
		const dates = plan.dates
			.map(x => String(x || '').slice(0, 10))
			.filter(isISODate)
		if (dates.length) out.dates = dates
	}
	// Ensure we always have at least a default range
	if (!out.dateRange && !out.dates) return getDefaultPlan()
	return out
}

function isISODate(s) {
	return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

function toISO(d) {
	return new Date(Date.UTC(d.getUTCFullYear?.() ?? d.getFullYear(), (d.getUTCMonth?.() ?? d.getMonth()), (d.getUTCDate?.() ?? d.getDate()))).toISOString().slice(0, 10)
}

/**
 * Builds and runs a Supabase query based on the search plan.
 * Selects item,cost,date for the authenticated user (via RLS) and returns { data, error }.
 */
async function queryExpensesByPlan(supabase, plan) {
	// Resolve authenticated user to scope queries
	const { data: userData, error: userErr } = await supabase.auth.getUser()
	if (userErr) return { data: null, error: userErr }
	const userId = userData?.user?.id
	if (!userId) return { data: null, error: new Error('Not authenticated') }

	let query = supabase
		.from('expenses')
		.select('item,cost,quantity,date')
		.eq('user_id', userId)
		.order('date', { ascending: false })
		.limit(500)

	// Date filters
	if (plan?.dateRange) {
		query = query.gte('date', plan.dateRange.from).lte('date', plan.dateRange.to)
	} else if (plan?.dates?.length) {
		query = query.in('date', plan.dates)
	}

	// Item filters (OR across items, ilike each)
	if (plan?.items?.length) {
		const ors = plan.items
			.map(term => `item.ilike.%${escapeForIlike(term)}%`)
			.join(',')
		if (ors) query = query.or(ors)
	}

	return await query
}

function escapeForIlike(s) {
	return String(s || '')
		.replace(/%/g, '')
		.replace(/,/g, ' ')
}

/**
 * Builds the second-step prompt to answer naturally using fetched expenses.
 */
function buildAnswerPrompt(question, expenses) {
	return [
		'You are an assistant for a personal expense tracker. Answer the user naturally using ONLY the provided expenses JSON.',
		'Amounts are in Gambian Dalasi; format like D123.45. If data is insufficient, say so briefly.',
		'',
		'Expenses JSON:',
		JSON.stringify({ expenses }),
		'',
		'User question:',
		question,
	].join('\n')
}

async function callGemini(apiKey, prompt, config) {
	const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`
	const res = await fetch(url, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			contents: [
				{ role: 'user', parts: [{ text: prompt }] },
			],
			generationConfig: { temperature: config?.temperature ?? 0.2, maxOutputTokens: config?.maxOutputTokens ?? 512 },
		}),
	})

	if (!res.ok) {
		const text = await res.text().catch(() => '')
		return { ok: false, error: `Gemini API error: ${res.status} ${text}` }
	}
	const data = await res.json()
	const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate an answer.'
	return { ok: true, text }
}

/**
 * Uses Gemini to classify the user's message intent.
 * Returns one of: 'ADD' | 'QUERY' | 'CLARIFY'. Defaults to 'CLARIFY' on failure.
 */
async function detectIntent(apiKey, message) {
	const system = [
		'You are an intent classifier for a personal expense tracker chat.',
		'Return ONLY valid JSON. No prose. No code fences. No trailing commas.',
		'Output schema: {"intent":"ADD"|"QUERY"|"CLARIFY"}',
		'Rules:',
		'- intent = "ADD" when the user is describing purchases to record (items/quantities/prices/dates).',
		'- intent = "QUERY" when the user asks about totals, spending by time period, range, or item.',
		'- If uncertain, intent = "CLARIFY".',
	].join('\n')

	const prompt = [
		system,
		'',
		'User message:',
		String(message || ''),
		'',
		'Respond with ONLY the JSON object.'
	].join('\n')

	const res = await callGemini(apiKey, prompt, { temperature: 0, maxOutputTokens: 64 })
	if (!res.ok) return 'CLARIFY'
	try {
		const parsed = JSON.parse((res.text || '').trim())
		const value = String(parsed?.intent || '').toUpperCase()
		if (value === 'ADD' || value === 'QUERY' || value === 'CLARIFY') return value
		return 'CLARIFY'
	} catch {
		return 'CLARIFY'
	}
}

/**
 * Tries to parse a natural sentence describing purchases into structured JSON using Gemini,
 * inserts expense rows for the authenticated user, and returns a summary.
 * If parsing fails or no items found, returns { added: false }.
 */
async function tryAddFromNaturalText(apiKey, supabase, text) {
	const schema = [
		'{',
		'  "items": [',
		'    { "name": string, "quantity": number, "unitPrice": number optional, "total": number optional }',
		'  ],',
		'  "date": string // "today" | "yesterday" | "YYYY-MM-DD"',
		'}',
	].join('\n')

	const prompt = [
		'Extract shopping items from the user message and return ONLY strict JSON. No prose, no code fences, no comments.',
		'Match this schema exactly with lowercase item names and defaults: quantity defaults to 1; if price is missing, set unitPrice to 0 and total to 0; total should equal quantity * unitPrice when prices are present. Quantity is stored in a dedicated DB column, not embedded in the item name.',
		'Schema:',
		schema,
		'',
		'Examples:',
		'{"items":[{"name":"bread","quantity":3,"unitPrice":12,"total":36},{"name":"egg","quantity":2,"unitPrice":15,"total":30},{"name":"potato","quantity":5,"unitPrice":10,"total":50}],"date":"today"}',
		'',
		'User message:',
		text,
	].join('\n')

	const res = await callGemini(apiKey, prompt, { temperature: 0, maxOutputTokens: 256 })
	if (!res.ok) return { added: false, attempted: true }

	let parsed
	try {
		parsed = JSON.parse((res.text || '').trim())
	} catch {
		return { added: false, attempted: true }
	}

	const items = Array.isArray(parsed?.items) ? parsed.items : []
	if (!items.length) {
		return { added: false, attempted: true }
	}

	// Resolve authenticated user
	const { data: userData, error: userErr } = await supabase.auth.getUser()
	if (userErr || !userData?.user?.id) return { added: false, attempted: true }
	const userId = userData.user.id

	// Normalize date
	const isoDate = normalizeDatePhrase(parsed?.date)

	// Build payloads
	const rows = []
	for (const raw of items) {
		const name = String(raw?.name || '').trim().toLowerCase()
		if (!name) continue
		const quantityRaw = Number.parseFloat(raw?.quantity)
		const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? Math.round(quantityRaw) : 1
		const unitPriceRaw = Number.parseFloat(raw?.unitPrice)
		const unitPrice = Number.isFinite(unitPriceRaw) ? unitPriceRaw : 0
		const totalRaw = Number.parseFloat(raw?.total)
		const total = Number.isFinite(totalRaw) ? totalRaw : (quantity * unitPrice)
		rows.push({ user_id: userId, item: name, quantity, cost: total || 0, date: isoDate })
	}

	if (!rows.length) return { added: false, attempted: true }

	const { data: inserted, error } = await supabase
		.from('expenses')
		.insert(rows)
		.select('id,item,cost,quantity,date,created_at')
	if (error) return { added: false, attempted: true }

	// Build summary
	const parts = rows.map(r => `${r.item}${r.quantity && r.quantity > 1 ? ` ×${r.quantity}` : ''} (${Number.isFinite(r.cost) ? String(r.cost) : '0'})`)
	const when = isoDate === toISO(new Date()) ? 'today' : isoDate
	const summary = `Added: ${parts.join(', ')} for ${when}.`
	return { added: true, summary, date: isoDate, items: rows.map(r => ({ item: r.item, quantity: r.quantity, cost: r.cost })), attempted: true }
}

/**
 * Converts common date words or ISO dates to YYYY-MM-DD (UTC) string. Defaults to today.
 */
function normalizeDatePhrase(dateLike) {
	const todayIso = toISO(new Date())
	if (!dateLike) return todayIso
	const s = String(dateLike || '').trim().toLowerCase()
	if (s === 'today') return todayIso
	if (s === 'yesterday') {
		const d = new Date(Date.parse(todayIso))
		const prev = new Date(d.getTime() - 24 * 60 * 60 * 1000)
		return toISO(prev)
	}
	const candidate = s.slice(0, 10)
	return isISODate(candidate) ? candidate : todayIso
}

/**
 * Parses and inserts an expense from an "add ..." chat command.
 * Supported forms:
 * - add noodles 120
 * - add bus fare
 * - add phone credit 50 on 2025-08-24
 * If cost is omitted, defaults to 0. If date is omitted, defaults to today (UTC, YYYY-MM-DD).
 * Returns a short confirmation message string.
 */
async function handleAddCommand(supabase, input) {
	const parsed = parseAddCommand(input)
	if (!parsed.ok) return { answer: parsed.message }

	// Resolve authenticated user
	const { data: userData, error: userErr } = await supabase.auth.getUser()
	if (userErr || !userData?.user?.id) return { answer: 'Sorry, you need to be signed in to add an expense.' }
	const userId = userData.user.id

	const payload = { user_id: userId, item: parsed.item, cost: parsed.cost, date: parsed.date }
	const { data: inserted, error } = await supabase
		.from('expenses')
		.insert(payload)
		.select('id,item,cost,date,created_at')
	if (error) return { answer: `Sorry, I couldn't save that: ${error.message}` }

	const todayIso = toISO(new Date())
	const when = parsed.date === todayIso ? 'today' : parsed.date
	const answer = `Added: ${parsed.item} (${Number.isFinite(parsed.cost) ? String(parsed.cost) : '0'}) for ${when}.`
	return { answer, added: { date: parsed.date, items: [{ item: parsed.item, cost: parsed.cost || 0 }] } }
}

/**
 * Extracts { item, cost, date } from an add command string.
 * Returns { ok: true, item, cost, date } or { ok: false, message }.
 */
function parseAddCommand(input) {
	const trimmed = String(input || '').trim()
	const withoutAdd = trimmed.replace(/^add\s+/i, '').trim()
	if (!withoutAdd) return { ok: false, message: 'Please specify an item to add.' }

	// Extract explicit date if present at the end: "on YYYY-MM-DD"
	let work = withoutAdd
	let date = null
	const onDateRegex = /\s+on\s+(\d{4}-\d{2}-\d{2})\s*$/i
	const onDateMatch = work.match(onDateRegex)
	if (onDateMatch) {
		const candidate = onDateMatch[1]
		if (isISODate(candidate)) date = candidate
		work = work.replace(onDateRegex, '').trim()
	}

	// Extract trailing numeric cost if present
	let cost = 0
	const costMatch = work.match(/(-?\d+(?:\.\d+)?)\s*$/)
	if (costMatch) {
		const parsedNumber = Number.parseFloat(costMatch[1])
		if (Number.isFinite(parsedNumber)) {
			cost = parsedNumber
			work = work.slice(0, work.length - costMatch[0].length).trim()
		}
	}

	const item = work.trim()
	if (!item) return { ok: false, message: 'Please provide an item name.' }

	const finalDate = date || toISO(new Date())
	return { ok: true, item, cost, date: finalDate }
}

/**
 * Returns true if the question is asking for spend totals.
 */
function isSpendQuestion(q) {
	const s = String(q || '').toLowerCase()
	if (!s) return false
	return /how\s+much|total|spend|spent|between\s+\d{4}-\d{2}-\d{2}\s+(?:and|to)\s+\d{4}-\d{2}-\d{2}|this\s+(?:week|month)|today|yesterday/.test(s)
}

/**
 * Parses period and optional item from question and returns an object
 * { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD', label: string, item: string|null }
 */
function parseSpendQuery(question) {
	const s = String(question || '').toLowerCase()
	const today = toISO(new Date())

	// between YYYY-MM-DD and YYYY-MM-DD
	const between = s.match(/between\s+(\d{4}-\d{2}-\d{2})\s+(?:and|to|-)\s+(\d{4}-\d{2}-\d{2})/)
	if (between && isISODate(between[1]) && isISODate(between[2])) {
		const from = between[1]
		const to = between[2]
		const item = extractItemFilter(s)
		return { from, to, label: `between ${from} and ${to}`, item }
	}

	// today / yesterday / this week / this month
	if (s.includes('today')) {
		return { from: today, to: today, label: 'today', item: extractItemFilter(s) }
	}
	if (s.includes('yesterday')) {
		const d = new Date(Date.parse(today))
		const prev = new Date(d.getTime() - 24 * 60 * 60 * 1000)
		const y = toISO(prev)
		return { from: y, to: y, label: 'yesterday', item: extractItemFilter(s) }
	}
	if (s.includes('this week')) {
		const now = new Date(Date.parse(today))
		const day = now.getUTCDay() || 7 // 1..7 with Monday=1
		const monday = new Date(now.getTime() - (day - 1) * 24 * 60 * 60 * 1000)
		const from = toISO(monday)
		const to = today
		return { from, to, label: 'this week', item: extractItemFilter(s) }
	}
	if (s.includes('this month')) {
		const d = new Date(Date.parse(today))
		const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
		const from = toISO(first)
		const to = today
		return { from, to, label: 'this month', item: extractItemFilter(s) }
	}

	// Default last 30 days
	const fromDate = new Date(Date.parse(today) - 30 * 24 * 60 * 60 * 1000)
	return { from: toISO(fromDate), to: today, label: 'last 30 days', item: extractItemFilter(s) }
}

function extractItemFilter(s) {
	const m = s.match(/on\s+([a-z0-9\s\-]+)/)
	if (!m) return null
	return m[1].replace(/\s*(today|yesterday|this week|this month|between.*)$/,'').trim().replace(/[?.!,]+$/,'') || null
}

function getBaseItemName(item) {
	const s = String(item || '').toLowerCase().trim()
	const m = s.match(/^(.*)\s+x\d+$/)
	return (m ? m[1] : s).trim()
}

function formatDalasi(amount) {
	const isInt = Number.isInteger(amount)
	const nf = new Intl.NumberFormat('en-US', { minimumFractionDigits: isInt ? 0 : 2, maximumFractionDigits: isInt ? 0 : 2 })
	return `D${nf.format(amount)}`
}

/**
 * Answers spend questions deterministically using Supabase totals.
 */
async function answerSpendQuestion(supabase, question) {
	// Resolve authenticated user
	const { data: userData, error: userErr } = await supabase.auth.getUser()
	if (userErr || !userData?.user?.id) return 'Sorry, I could not verify your account.'
	const userId = userData.user.id

	// Quick comparison support: this week vs last week
	if (/this\s+week\s+vs\s+last\s+week|last\s+week\s+vs\s+this\s+week/i.test(question)) {
		const totalForRange = async (from, to, itemFilter) => {
			let q = supabase
				.from('expenses')
				.select('item,cost,quantity,date')
				.eq('user_id', userId)
				.gte('date', from)
				.lte('date', to)
			if (itemFilter) q = q.ilike('item', `${itemFilter}%`)
			const { data } = await q
			return (data || []).reduce((sum, row) => sum + (Number.isFinite(Number(row.cost)) ? Number(row.cost) : 0), 0)
		}
		const today = toISO(new Date())
		const now = new Date(Date.parse(today))
		const day = now.getUTCDay() || 7
		const monday = new Date(now.getTime() - (day - 1) * 24 * 60 * 60 * 1000)
		const thisFrom = toISO(monday)
		const thisTo = today
		const lastFrom = toISO(new Date(monday.getTime() - 7 * 24 * 60 * 60 * 1000))
		const lastTo = toISO(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000))
		const tThis = await totalForRange(thisFrom, thisTo)
		const tLast = await totalForRange(lastFrom, lastTo)
		const diff = tThis - tLast
		const abs = Math.abs(diff)
		const sign = diff > 0 ? '+' : (diff < 0 ? '-' : '')
		return `${formatDalasi(tThis)} this week vs ${formatDalasi(tLast)} last week (${sign}${formatDalasi(abs).slice(1)}).`
	}

	const { from, to, label, item } = parseSpendQuery(question)

	let query = supabase
		.from('expenses')
		.select('item,cost,quantity,date')
		.eq('user_id', userId)
		.gte('date', from)
		.lte('date', to)

	// If there is an item, narrow server-side to reduce rows
	if (item) {
		const like = `${item}%`
		query = query.ilike('item', like)
	}

	const { data, error } = await query
	if (error) return 'Sorry, I could not fetch your expenses.'

	const baseFilter = item ? item.toLowerCase().trim() : null
	const total = (data || []).reduce((sum, row) => {
		if (baseFilter) {
			if (getBaseItemName(row.item) !== baseFilter) return sum
		}
		const v = Number.parseFloat(row.cost)
		return sum + (Number.isFinite(v) ? v : 0)
	}, 0)

	const amount = formatDalasi(total)
	const suffix = baseFilter ? ` on ${baseFilter} ${label}.` : ` ${label}.`
	return `${amount}${suffix}`
}

// ---- Context-aware helpers and proposal/confirmation flows ----

function sanitizeHistory(input) {
	const arr = Array.isArray(input) ? input : []
	const cleaned = arr
		.map(x => ({ role: String(x?.role || '').toLowerCase(), content: String(x?.content || '').trim() }))
		.filter(x => (x.role === 'user' || x.role === 'assistant') && x.content)
	// Keep chronological order; last N
	return cleaned.slice(-20)
}

function buildSystemInstructions() {
	return [
		'You are the Expense Tracker Assistant for a Daily Expense Tracker web app.',
		'Only answer questions related to tracking expenses. If unrelated, briefly say you only handle expenses.',
		'Be concise and user-friendly. Do not invent data; use only provided chat history, current date, and backend context.',
		'When adding, modifying, or deleting, ask for user confirmation before saving.',
		'If asked "how do I use this?", explain briefly how to add, modify, delete, and query expenses.',
	].join('\n')
}

function buildPrompt({ title, dateIso, history, latest, body }) {
	const hist = (history || []).map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n')
	return [
		buildSystemInstructions(),
		'',
		`Current date (UTC): ${dateIso}`,
		'',
		title ? `Task: ${title}` : '',
		hist ? 'Chat history:\n' + hist : 'Chat history: (empty)',
		'',
		body || '',
		'',
		'Latest user message:',
		String(latest || ''),
	].filter(Boolean).join('\n')
}

async function detectIntentWithContext(apiKey, ctx) {
	const prompt = buildPrompt({
		title: 'Intent classification',
		dateIso: ctx.dateIso,
		history: ctx.history,
		latest: ctx.latest,
		body: [
			'Return ONLY valid JSON. No prose. No code fences. No trailing commas.',
			'Output schema: {"intent":"ADD"|"MODIFY"|"DELETE"|"QUERY"|"CONFIRM"|"CLARIFY"}',
			'Classify the latest user message using the conversation history if needed.',
			'Respond with ONLY the JSON object.'
		].join('\n')
	})
	const res = await callGemini(apiKey, prompt, { temperature: 0, maxOutputTokens: 64 })
	if (!res.ok) return 'CLARIFY'
	try {
		const parsed = JSON.parse((res.text || '').trim())
		const value = String(parsed?.intent || '').toUpperCase()
		if (value === 'ADD' || value === 'MODIFY' || value === 'DELETE' || value === 'QUERY' || value === 'CONFIRM' || value === 'CLARIFY') return value
		return 'CLARIFY'
	} catch {
		return 'CLARIFY'
	}
}

async function buildAddProposalFromNaturalText(apiKey, supabase, ctx) {
	const schema = [
		'{',
		'  "items": [',
		'    { "name": string, "quantity": number, "unitPrice": number optional, "total": number optional }',
		'  ],',
		'  "date": string // "today" | "yesterday" | "YYYY-MM-DD"',
		'}',
	].join('\n')
	const body = [
		'Extract shopping items from the user message and return ONLY strict JSON. No prose, no code fences, no comments.',
		'Match this schema exactly with lowercase item names and defaults: quantity defaults to 1; if price is missing, set unitPrice to 0 and total to 0; total should equal quantity * unitPrice when prices are present. Quantity is stored in a dedicated DB column, not embedded in the item name.',
		'Schema:',
		schema,
		'Respond with ONLY the JSON object.',
	].join('\n')
	const prompt = buildPrompt({ title: 'Add proposal extraction', dateIso: ctx.dateIso, history: ctx.history, latest: ctx.latest, body })
	const res = await callGemini(apiKey, prompt, { temperature: 0, maxOutputTokens: 256 })
	if (!res.ok) return { ok: false }
	let parsed
	try { parsed = JSON.parse((res.text || '').trim()) } catch { return { ok: false } }
	const items = Array.isArray(parsed?.items) ? parsed.items : []
	if (!items.length) return { ok: false }
	const isoDate = normalizeDatePhrase(parsed?.date)
	const rows = []
	for (const raw of items) {
		const name = String(raw?.name || '').trim().toLowerCase()
		if (!name) continue
		const quantityRaw = Number.parseFloat(raw?.quantity)
		const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? Math.round(quantityRaw) : 1
		const unitPriceRaw = Number.parseFloat(raw?.unitPrice)
		const unitPrice = Number.isFinite(unitPriceRaw) ? unitPriceRaw : 0
		const totalRaw = Number.parseFloat(raw?.total)
		const total = Number.isFinite(totalRaw) ? totalRaw : (quantity * unitPrice)
		rows.push({ item: name, quantity, cost: total || 0 })
	}
	if (!rows.length) return { ok: false }
	const parts = rows.map(r => `${r.item}${r.quantity && r.quantity > 1 ? ` ×${r.quantity}` : ''} (${Number.isFinite(r.cost) ? String(r.cost) : '0'})`)
	const when = isoDate === toISO(new Date()) ? 'today' : isoDate
	const summary = `Add: ${parts.join(', ')} for ${when}. Confirm?`
	// Attach confirmation token bound to user and proposal payload
	const { data: userData } = await supabase.auth.getUser()
	const userId = userData?.user?.id || ''
	const proposal = { type: 'ADD', date: isoDate, items: rows }
	const token = await createProposalToken(userId, proposal)
	return { ok: true, date: isoDate, items: rows, summary, token }
}

async function commitAddProposal(supabase, payload) {
	if (!payload || !Array.isArray(payload.items) || !payload.items.length || !payload.date) return { ok: false, message: 'Missing items to add.' }
	// Validate fields
	for (const it of payload.items) {
		if (!it || !String(it.item || '').trim()) return { ok: false, message: 'Item name is required.' }
		if (it.quantity != null && (!Number.isFinite(Number(it.quantity)) || Number(it.quantity) <= 0)) return { ok: false, message: 'Invalid quantity.' }
		if (it.cost != null && !Number.isFinite(Number(it.cost))) return { ok: false, message: 'Invalid cost.' }
	}
	// Resolve authenticated user
	const { data: userData, error: userErr } = await supabase.auth.getUser()
	if (userErr || !userData?.user?.id) return { ok: false, message: 'Sorry, I could not verify your account.' }
	const userId = userData.user.id
	const rows = payload.items.map(r => ({ user_id: userId, item: String(r.item).toLowerCase(), quantity: Math.max(1, Math.round(Number(r.quantity || 1))), cost: Number(r.cost) || 0, date: normalizeDatePhrase(payload.date) }))
	const { data, error } = await supabase
		.from('expenses')
		.insert(rows)
		.select('id,item,cost,quantity,date,created_at')
	if (error) return { ok: false, message: 'Save failed.' }
	const parts = rows.map(r => `${r.item}${r.quantity && r.quantity > 1 ? ` ×${r.quantity}` : ''} (${Number.isFinite(r.cost) ? String(r.cost) : '0'})`)
	const when = rows[0]?.date === toISO(new Date()) ? 'today' : rows[0]?.date
	return { ok: true, answer: `Added: ${parts.join(', ')} for ${when}.`, added: { date: rows[0]?.date, items: rows.map(r => ({ item: r.item, quantity: r.quantity, cost: r.cost })) } }
}

async function buildModifyProposal(apiKey, supabase, ctx) {
	const body = [
		'Return ONLY strict JSON. No prose. No code fences.',
		'Schema:',
		'{',
		'  "target": { "item": string, "date": string },',
		'  "update": { "item"?: string, "cost"?: number, "quantity"?: number, "date"?: string }',
		'}',
		'Rules:',
		'- If multiple changes, include all under update.',
		'- Do not invent values.',
		'Respond with ONLY the JSON object.',
	].join('\n')
	const prompt = buildPrompt({ title: 'Modify proposal extraction', dateIso: ctx.dateIso, history: ctx.history, latest: ctx.latest, body })
	const res = await callGemini(apiKey, prompt, { temperature: 0, maxOutputTokens: 192 })
	if (!res.ok) return { answer: 'Please specify what to change.' }
	let parsed
	try { parsed = JSON.parse((res.text || '').trim()) } catch { return { answer: 'Please specify what to change.' } }
	const item = String(parsed?.target?.item || '').trim().toLowerCase()
	const when = normalizeDatePhrase(parsed?.target?.date)
	if (!item) return { answer: 'Which item should I edit?' }
	// Resolve authenticated user
	const { data: userData, error: userErr } = await supabase.auth.getUser()
	if (userErr || !userData?.user?.id) return { answer: 'Sorry, I could not verify your account.' }
	const userId = userData.user.id
	const { data, error } = await supabase
		.from('expenses')
		.select('id,item,cost,quantity,date')
		.eq('user_id', userId)
		.eq('date', when)
		.ilike('item', item)
		.order('created_at', { ascending: false })
		.limit(5)
	if (error) return { answer: 'Sorry, I could not find that expense.' }
	if (!data || data.length === 0) return { answer: 'I did not find that item on that date.' }
	if (data.length > 1) return { answer: `I found ${data.length} matches. Please be more specific.` }
	const target = data[0]
	const update = {}
	if (parsed?.update) {
		if (parsed.update.item) update.item = String(parsed.update.item).trim().toLowerCase()
		if (Number.isFinite(parsed.update.cost)) update.cost = Number(parsed.update.cost)
		if (Number.isFinite(parsed.update.quantity)) update.quantity = Math.max(1, Math.round(Number(parsed.update.quantity)))
		if (parsed.update.date) update.date = normalizeDatePhrase(parsed.update.date)
	}
	if (!Object.keys(update).length) return { answer: 'What change should I make?' }
	const parts = []
	if (update.item) parts.push(`item → ${update.item}`)
	if (update.cost != null) parts.push(`cost → ${update.cost}`)
	if (update.quantity != null) parts.push(`quantity → ${update.quantity}`)
	if (update.date) parts.push(`date → ${update.date}`)
	const summary = `Edit ${target.item} on ${target.date}: ${parts.join(', ')}. Confirm?`
	const { data: userData2 } = await supabase.auth.getUser()
	const userId2 = userData2?.user?.id || ''
	const proposal = { type: 'MODIFY', id: target.id, update }
	const token = await createProposalToken(userId2, proposal)
	return { answer: summary, confirmationRequired: true, proposal: { ...proposal, token } }
}

async function commitModifyProposal(supabase, payload) {
	if (!payload || !payload.id || !payload.update) return { answer: 'Missing update details.' }
	// Validate update fields
	if (payload.update.item != null && !String(payload.update.item || '').trim()) return { answer: 'Invalid item.' }
	if (payload.update.cost != null && !Number.isFinite(Number(payload.update.cost))) return { answer: 'Invalid cost.' }
	if (payload.update.quantity != null && (!Number.isFinite(Number(payload.update.quantity)) || Number(payload.update.quantity) <= 0)) return { answer: 'Invalid quantity.' }
	// Resolve authenticated user
	const { data: userData, error: userErr } = await supabase.auth.getUser()
	if (userErr || !userData?.user?.id) return { answer: 'Sorry, I could not verify your account.' }
	const userId = userData.user.id
	const { data, error } = await supabase
		.from('expenses')
		.update(payload.update)
		.match({ id: payload.id, user_id: userId })
		.select('id,item,cost,quantity,date,created_at')
		.single()
	if (error) return { answer: 'Sorry, I could not save that change.' }
	return { answer: 'Updated.', updated: data }
}

async function buildDeleteProposal(apiKey, supabase, ctx) {
	const body = [
		'Return ONLY strict JSON. No prose. No code fences.',
		'Schema:',
		'{ "target": { "item": string, "date": string } }',
		'Respond with ONLY the JSON object.',
	].join('\n')
	const prompt = buildPrompt({ title: 'Delete proposal extraction', dateIso: ctx.dateIso, history: ctx.history, latest: ctx.latest, body })
	const res = await callGemini(apiKey, prompt, { temperature: 0, maxOutputTokens: 128 })
	if (!res.ok) return { answer: 'Which expense should I delete?' }
	let parsed
	try { parsed = JSON.parse((res.text || '').trim()) } catch { return { answer: 'Which expense should I delete?' } }
	const item = String(parsed?.target?.item || '').trim().toLowerCase()
	const when = normalizeDatePhrase(parsed?.target?.date)
	if (!item) return { answer: 'Which item should I delete?' }
	// Resolve authenticated user
	const { data: userData, error: userErr } = await supabase.auth.getUser()
	if (userErr || !userData?.user?.id) return { answer: 'Sorry, I could not verify your account.' }
	const userId = userData.user.id
	const { data, error } = await supabase
		.from('expenses')
		.select('id,item,cost,quantity,date')
		.eq('user_id', userId)
		.eq('date', when)
		.ilike('item', item)
		.order('created_at', { ascending: false })
		.limit(5)
	if (error) return { answer: 'Sorry, I could not find that expense.' }
	if (!data || data.length === 0) return { answer: 'I did not find that item on that date.' }
	if (data.length > 1) return { answer: `I found ${data.length} matches. Please be more specific.` }
	const target = data[0]
	const summary = `Delete ${target.item} (${Number.isFinite(target.cost) ? String(target.cost) : '0'}) on ${target.date}? Confirm?`
	const { data: userData2 } = await supabase.auth.getUser()
	const userId2 = userData2?.user?.id || ''
	const proposal = { type: 'DELETE', id: target.id }
	const token = await createProposalToken(userId2, proposal)
	return { answer: summary, confirmationRequired: true, proposal: { ...proposal, token } }
}

async function commitDeleteProposal(supabase, payload) {
	if (!payload || !payload.id) return { answer: 'Missing delete details.' }
	// Resolve authenticated user
	const { data: userData, error: userErr } = await supabase.auth.getUser()
	if (userErr || !userData?.user?.id) return { answer: 'Sorry, I could not verify your account.' }
	const userId = userData.user.id
	const { error } = await supabase
		.from('expenses')
		.delete()
		.match({ id: payload.id, user_id: userId })
	if (error) return { answer: 'Sorry, I could not delete that.' }
	return { answer: 'Deleted.', deleted: { id: payload.id } }
}

// --- Proposal token helpers ---

/**
 * Creates an HMAC token bound to the user and proposal payload to prevent forged/stale confirmations.
 */
async function createProposalToken(userId, proposal) {
  const secret = process.env.PROPOSAL_TOKEN_SECRET || process.env.GEMINI_API_KEY || 'fallback'
  const data = `${userId}|${JSON.stringify(proposal)}`
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  const b = Buffer.from(sig).toString('base64url')
  return b
}

/**
 * Verifies that the confirmation carries a valid token for the current user and payload.
 */
async function verifyProposalToken(supabase, confirm) {
  try {
    if (!confirm || !confirm.type || !confirm.payload || !confirm.payload.token) return false
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id || ''
    const payloadCopy = { ...confirm.payload }
    const token = String(payloadCopy.token)
    delete payloadCopy.token
    const expected = await createProposalToken(userId, { type: confirm.type, ...payloadCopy })
    return token === expected
  } catch {
    return false
  }
}