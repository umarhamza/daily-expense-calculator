exports.handler = async function(event) {
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

		const today = new Date()
		const fromDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
		const fromIso = fromDate.toISOString().slice(0, 10)

		const { data: expenses, error } = await supabase
			.from('expenses')
			.select('item,cost,date')
			.gte('date', fromIso)
			.order('date', { ascending: false })
			.limit(300)

		if (error) return jsonRes(500, { error: error.message })

		const context = buildContext(expenses || [])
		const prompt = buildPrompt(question, context)

		const aiResponse = await callGemini(apiKey, prompt)
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
 * Creates compact aggregates to keep token usage low.
 */
function buildContext(expenses) {
	const totalsByItem = new Map()
	const totalsByDate = new Map()
	let grandTotal = 0

	for (const e of expenses) {
		const itemKey = e.item
		const prevItem = totalsByItem.get(itemKey) || 0
		totalsByItem.set(itemKey, prevItem + Number(e.cost))

		const dateKey = e.date
		const prevDate = totalsByDate.get(dateKey) || 0
		totalsByDate.set(dateKey, prevDate + Number(e.cost))

		grandTotal += Number(e.cost)
	}

	const topItems = Array.from(totalsByItem.entries())
		.sort((a, b) => b[1] - a[1])
		.slice(0, 8)
		.map(([item, sum]) => ({ item, sum: round2(sum) }))

	const daily = Array.from(totalsByDate.entries())
		.sort((a, b) => (a[0] < b[0] ? -1 : 1))
		.map(([date, sum]) => ({ date, sum: round2(sum) }))

	return {
		windowDays: 30,
		grandTotal: round2(grandTotal),
		topItems,
		daily,
	}
}

function round2(n) {
	return Math.round((Number(n) + Number.EPSILON) * 100) / 100
}

function buildPrompt(question, context) {
	return [
		"You are an assistant for a personal expense tracker. Answer the user's question using ONLY the provided data.",
		'Amounts are in Gambian Dalasi and should be formatted with the D prefix (e.g., D123.45).',
		'If the data is insufficient to answer confidently, say so briefly.',
		'',
		'Context JSON (last 30 days):',
		JSON.stringify(context),
		'',
		'User question:',
		question,
	].join('\n')
}

async function callGemini(apiKey, prompt) {
	const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`
	const res = await fetch(url, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			contents: [
				{ role: 'user', parts: [{ text: prompt }] },
			],
			generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
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