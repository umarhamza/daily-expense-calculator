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

		const { createClient } = await import('@supabase/supabase-js')
		const supabase = createClient(supabaseUrl, supabaseAnonKey, {
			global: { headers: { Authorization: `Bearer ${token}` } },
		})

		// Step 1: Ask Gemini to return STRICT JSON describing what to search
		const plan = await getSearchPlanFromGemini(apiKey, question)

		// Step 2: Query the user's expenses using the plan (falls back if needed)
		const { data: expenses, error: sbError } = await queryExpensesByPlan(supabase, plan)
		if (sbError) return jsonRes(500, { error: sbError.message })

		// Step 3: Ask Gemini to answer using the original question + fetched expenses
		const answerPrompt = buildAnswerPrompt(question, expenses || [])
		const aiResponse = await callGemini(apiKey, answerPrompt, { temperature: 0.2, maxOutputTokens: 640 })
		if (!aiResponse.ok) return jsonRes(500, { error: aiResponse.error || 'AI request failed' })

		return jsonRes(200, { answer: aiResponse.text })
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
		.select('item,cost,date')
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