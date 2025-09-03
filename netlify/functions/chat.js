import { createClient } from '@supabase/supabase-js'

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return jsonRes(405, { error: 'Method not allowed' })
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {}
    const question = String(body.question || body.message || '').trim()
    if (!question) return jsonRes(400, { error: 'Message is required' })

    const token = getBearerToken(event.headers?.authorization)
    if (!token) return jsonRes(401, { error: 'Unauthorized' })

    const supabase = createServerSupabaseClient(token)
    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData?.user?.id) return jsonRes(401, { error: 'Invalid session' })
    const userId = userData.user.id

    const { currencySymbol } = await getCurrencySymbol(supabase, userId)

    // Ensure chat exists or create a new one
    let chatId = body.chatId || null
    if (!chatId) {
      const title = sanitizeTitle(String(body.title || question).slice(0, 80))
      const { data: chatRow, error: chatErr } = await supabase
        .from('chats')
        .insert({ user_id: userId, title })
        .select('id')
        .single()
      if (chatErr) return jsonRes(500, { error: 'Failed to create chat' })
      chatId = chatRow.id
    }

    // Persist user message
    await safeInsertMessage(supabase, userId, chatId, 'user', question)

    // Handle confirmation flows
    if (question.toLowerCase() === 'confirm' && body.confirm && body.confirm.type) {
      const result = await handleConfirmation(supabase, userId, currencySymbol, body.confirm)
      await safeInsertMessage(supabase, userId, chatId, 'assistant', result.answer)
      return jsonRes(200, { ...result, chatId })
    }

    // Intent filtering minimal guard
    if (!looksFinanceRelated(question)) {
      const answer = 'I can help with expenses: add purchases, totals, or spending insights.'
      await safeInsertMessage(supabase, userId, chatId, 'assistant', answer)
      return jsonRes(200, { answer, chatId })
    }

    const geminiKey = process.env.GEMINI_API_KEY
    if (!geminiKey) {
      const fallback = 'Ask me about your spending. For example: "Total coffee this month".'
      await safeInsertMessage(supabase, userId, chatId, 'assistant', fallback)
      return jsonRes(200, { answer: fallback, usedGemini: false, chatId })
    }

    const history = Array.isArray(body.history) ? body.history.slice(-20) : []
    const plan = await callGeminiForPlan(geminiKey, question, history)

    if (!plan.ok) {
      const reply = 'Sorry, I had trouble understanding that. Try rephrasing your request.'
      await safeInsertMessage(supabase, userId, chatId, 'assistant', reply)
      return jsonRes(200, { answer: reply, usedGemini: true, chatId })
    }

    const routed = await routePlan(supabase, userId, currencySymbol, plan.data)
    await safeInsertMessage(supabase, userId, chatId, 'assistant', routed.answer)
    return jsonRes(200, { ...routed, usedGemini: true, chatId })
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

function getBearerToken(header) {
  const s = String(header || '')
  const m = /^Bearer\s+(.+)$/i.exec(s)
  return m ? m[1].trim() : ''
}

function createServerSupabaseClient(token) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
  return createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } } })
}

async function safeInsertMessage(supabase, userId, chatId, role, content) {
  try {
    await supabase
      .from('chat_messages')
      .insert({ user_id: userId, chat_id: chatId, role, content })
  } catch (_) {}
}

function sanitizeTitle(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function getCurrencySymbol(supabase, userId) {
  const { data } = await supabase
    .from('profiles')
    .select('currency_symbol')
    .eq('user_id', userId)
    .maybeSingle()
  const raw = (data?.currency_symbol || '').trim()
  return { currencySymbol: raw || '' }
}

function formatAmount(amount, currencySymbol) {
  const n = Number(amount)
  if (!Number.isFinite(n)) return '0'
  const num = n.toLocaleString(undefined, { maximumFractionDigits: 2 })
  return currencySymbol ? `${currencySymbol}${num}` : `${num}`
}

function looksFinanceRelated(q) {
  const s = String(q || '').toLowerCase()
  return /expense|spend|spent|total|budget|add|purchase|cost|price|receipt|item|top|category|categories|week|month|day/.test(s)
}

async function callGeminiForPlan(apiKey, question, history) {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`
    const system = [
      'You are an assistant for a personal expense tracker app.',
      'Decide ONE action and return STRICT JSON only. No markdown, no prose.',
      'Actions:',
      '- {"action":"propose_add","items":[{"item":"coffee","cost":3.5,"quantity":1,"date":"YYYY-MM-DD"}] }',
      '- {"action":"query_total_item","item":"coffee","startDate":"YYYY-MM-DD?","endDate":"YYYY-MM-DD?"}',
      '- {"action":"query_total_period","startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD"}',
      '- {"action":"top_items","startDate":"YYYY-MM-DD?","endDate":"YYYY-MM-DD?","limit":5 }',
      '- {"action":"respond","content":"short reply"}',
      'Rules:',
      '- Ask for missing fields only if absolutely required; otherwise propose best guess.',
      '- Prefer ISO dates. Quantity defaults to 1 if missing.',
      '- Keep content concise.'
    ].join('\n')

    const parts = []
    parts.push({ text: system })
    if (Array.isArray(history) && history.length) {
      const compact = history.map(h => `${h.role}: ${h.content}`).join('\n')
      parts.push({ text: `History:\n${compact}` })
    }
    parts.push({ text: `User: ${question}` })

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [ { role: 'user', parts } ],
        generationConfig: { temperature: 0.2, maxOutputTokens: 256 }
      })
    })
    if (!resp.ok) {
      return { ok: false, error: `Gemini error ${resp.status}` }
    }
    const data = await resp.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const json = safeJsonParse(text)
    if (!json) return { ok: false, error: 'Non-JSON response' }
    return { ok: true, data: json }
  } catch (e) {
    return { ok: false, error: e?.message || 'Gemini failure' }
  }
}

function safeJsonParse(s) {
  try {
    return JSON.parse(String(s || '').trim())
  } catch (_) {
    return null
  }
}

async function routePlan(supabase, userId, currencySymbol, plan) {
  const action = String(plan?.action || '').toLowerCase()
  if (action === 'propose_add') {
    const items = normalizeItems(plan?.items)
    if (!items.length) {
      return { answer: 'I could not understand the items to add.', attemptedAdd: true }
    }
    const pretty = items.map(i => `${i.quantity}× ${i.item} at ${formatAmount(i.cost, currencySymbol)} (${i.date})`).join(', ')
    return {
      answer: `I can add: ${pretty}. Confirm?`,
      confirmationRequired: true,
      proposal: { type: 'add_expenses', items }
    }
  }

  if (action === 'query_total_item') {
    const item = String(plan?.item || '').trim()
    const { total } = await getTotalForItemServer(supabase, userId, item, plan?.startDate, plan?.endDate)
    const answer = item ? `Total for ${item}${plan?.startDate ? ` between ${plan.startDate} and ${plan.endDate || 'today'}` : ''}: ${formatAmount(total, currencySymbol)}.` : 'Please specify an item.'
    return { answer }
  }

  if (action === 'query_total_period') {
    const { total } = await getTotalForPeriodServer(supabase, userId, plan?.startDate, plan?.endDate)
    return { answer: `Total spend ${plan?.startDate} to ${plan?.endDate}: ${formatAmount(total, currencySymbol)}.` }
  }

  if (action === 'top_items') {
    const limit = clampNumber(plan?.limit, 1, 10, 5)
    const rows = await getTopItemsServer(supabase, userId, plan?.startDate, plan?.endDate, limit)
    if (!rows.length) return { answer: 'No results found.' }
    const msg = rows.map((r, i) => `${i + 1}. ${r.item}: ${formatAmount(r.total, currencySymbol)}`).join(' ')
    return { answer: msg }
  }

  const content = String(plan?.content || '').trim()
  return { answer: content || 'Okay.' }
}

function normalizeItems(arr) {
  if (!Array.isArray(arr)) return []
  const today = new Date()
  const isoToday = today.toISOString().slice(0, 10)
  const result = []
  for (const raw of arr) {
    const item = String(raw?.item || '').trim()
    const cost = Number.parseFloat(raw?.cost)
    const qRaw = raw?.quantity == null ? 1 : Number.parseInt(raw.quantity, 10)
    const quantity = Number.isFinite(qRaw) && qRaw > 0 ? qRaw : 1
    const date = typeof raw?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : isoToday
    if (!item || !Number.isFinite(cost) || cost <= 0) continue
    result.push({ item, cost, quantity, date })
  }
  return result.slice(0, 20)
}

function clampNumber(n, min, max, fallback) {
  const v = Number.parseInt(n, 10)
  if (!Number.isFinite(v)) return fallback
  return Math.min(Math.max(v, min), max)
}

async function handleConfirmation(supabase, userId, currencySymbol, confirm) {
  const type = String(confirm?.type || '').toLowerCase()
  if (type === 'add_expenses') {
    const items = normalizeItems(confirm?.payload?.items || confirm?.items)
    if (!items.length) return { answer: 'Nothing to add.', attemptedAdd: true }
    let total = 0
    const inserted = []
    for (const it of items) {
      total += (it.cost * (it.quantity || 1))
      for (let i = 0; i < (it.quantity || 1); i++) {
        const { error } = await supabase
          .from('expenses')
          .insert({ user_id: userId, item: it.item, cost: it.cost, date: it.date, quantity: 1 })
        if (!error) inserted.push(it)
      }
    }
    const answer = `Added ${inserted.length} item${inserted.length === 1 ? '' : 's'} totaling ${formatAmount(total, currencySymbol)}.`
    return { answer, added: { items: inserted } }
  }
  return { answer: 'Cancelled.' }
}

async function getTotalForItemServer(supabase, userId, item, startDate, endDate) {
  const name = String(item || '').trim()
  if (!name) return { total: 0 }
  let query = supabase
    .from('expenses')
    .select('item,cost,date')
    .eq('user_id', userId)
    .ilike('item', name)
  if (isIsoDate(startDate)) query = query.gte('date', startDate)
  if (isIsoDate(endDate)) query = query.lte('date', endDate)
  const { data, error } = await query
  if (error) return { total: 0 }
  const total = (data || []).reduce((sum, row) => sum + (Number.isFinite(Number(row.cost)) ? Number(row.cost) : 0), 0)
  return { total }
}

async function getTotalForPeriodServer(supabase, userId, startDate, endDate) {
  if (!isIsoDate(startDate) || !isIsoDate(endDate)) return { total: 0 }
  const { data, error } = await supabase
    .from('expenses')
    .select('cost')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
  if (error) return { total: 0 }
  const total = (data || []).reduce((sum, row) => sum + (Number.isFinite(Number(row.cost)) ? Number(row.cost) : 0), 0)
  return { total }
}

async function getTopItemsServer(supabase, userId, startDate, endDate, limit = 5) {
  let query = supabase
    .from('expenses')
    .select('item,cost,date')
    .eq('user_id', userId)
  if (isIsoDate(startDate)) query = query.gte('date', startDate)
  if (isIsoDate(endDate)) query = query.lte('date', endDate)
  const { data, error } = await query
  if (error) return []
  const totals = new Map()
  for (const row of data || []) {
    const key = String(row?.item || '').toLowerCase().trim()
    if (!key) continue
    const cost = Number(row?.cost)
    const prev = totals.get(key) || 0
    totals.set(key, prev + (Number.isFinite(cost) ? cost : 0))
  }
  const arr = Array.from(totals.entries())
    .map(([item, total]) => ({ item, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, Math.max(1, Number(limit) || 5))
  return arr
}

function isIsoDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
}

