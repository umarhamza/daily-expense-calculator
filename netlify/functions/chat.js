export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return jsonRes(405, { error: 'Method Not Allowed' })
  }

  let body
  try {
    body = event.body ? JSON.parse(event.body) : null
  } catch (_) {
    return jsonRes(400, { error: 'Invalid JSON body' })
  }

  // Backward compatibility: accept {question|message} by converting to history
  const legacyText = String(body?.question || body?.message || '').trim()
  const history = Array.isArray(body?.history) && body.history.length
    ? body.history
    : (legacyText ? [{ role: 'user', content: legacyText }] : [])

  if (!Array.isArray(history) || history.length === 0) {
    return jsonRes(400, { error: 'history (array) is required' })
  }
  if (!isValidHistory(history)) {
    return jsonRes(400, { error: 'Invalid history shape' })
  }

  const userContext = sanitizeUserContext(body?.userContext)
  const userText = extractLastUserMessage(history)

  try {
    const service = getExpenseService()
    const today = getTodayDate()
    const tools = getToolCatalog()

    // Confirmation path: execute proposed tool directly
    const confirmation = normalizeConfirm(body?.confirm)
    if (confirmation) {
      try {
        const executed = await executeTool(confirmation.tool, confirmation.args, userContext, service, today)
        return jsonRes(200, executed)
      } catch (e) {
        const { status, error, detail } = mapDomainErrorToHttp(e)
        return jsonRes(status, { error, detail })
      }
    }

    // Decide next step via strict JSON model contract with single retry
    const modelPayload = buildModelPayload(userText, today, tools, history)
    let decision
    {
      const raw = await callModelStrict(modelPayload)
      decision = safeParseAndValidateModelResult(raw)
      if (!decision) {
        const raw2 = await callModelStrict(modelPayload)
        decision = safeParseAndValidateModelResult(raw2)
        if (!decision) return jsonRes(500, { error: 'Server error', detail: 'Model output invalid' })
      }
    }

    if (decision.type === 'clarify') {
      const res = { answer: decision.question }
      if (decision.attemptedAdd) res.attemptedAdd = true
      return jsonRes(200, res)
    }

    if (decision.type === 'answer') {
      return jsonRes(200, { answer: decision.content })
    }

    if (decision.type === 'tool_call') {
      const validation = validateToolCall(decision.tool, decision.args)
      if (!validation.ok) {
        return jsonRes(400, { error: 'Invalid request', detail: validation.error.message })
      }
      if (decision.confirmationSuggested) {
        const proposal = { tool: decision.tool, args: decision.args, type: decision.tool }
        const msg = decision.confirmationMessage || buildConfirmationMessage(decision.tool, decision.args, today)
        return jsonRes(200, { answer: msg, confirmationRequired: true, proposal })
      }
      try {
        const executed = await executeTool(decision.tool, decision.args, userContext, service, today)
        return jsonRes(200, executed)
      } catch (e) {
        const { status, error, detail } = mapDomainErrorToHttp(e)
        return jsonRes(status, { error, detail })
      }
    }

    return jsonRes(200, { answer: 'Okay.' })
  } catch (e) {
    return jsonRes(500, { error: 'Server error', detail: String(e?.message || e) })
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
 * Returns YYYY-MM-DD tool catalog descriptors.
 */
function getToolCatalog() {
  return [
    { name: 'add_expense', schema: { required: ['item', 'amount'], optional: ['date', 'category'] } },
    { name: 'get_balance', schema: { required: [], optional: ['range'] } },
    { name: 'list_expenses', schema: { required: [], optional: ['range', 'category'] } },
    { name: 'update_expense', schema: { required: ['id'], optional: ['item', 'amount', 'date', 'category'] } },
    { name: 'delete_expense', schema: { required: ['id'], optional: [] } },
  ]
}

function mapDomainErrorToHttp(err) {
  const message = String(err?.message || err || '')
  // RBAC
  if (/insufficient permissions/i.test(message)) {
    return { status: 403, error: 'Forbidden', detail: 'Insufficient permissions' }
  }
  // validation
  if (/invalid (item|amount)/i.test(message)) {
    return { status: 400, error: 'Invalid request', detail: message }
  }
  // not found
  if (/not found/i.test(message)) {
    return { status: 404, error: 'Not Found', detail: message }
  }
  // cross-tenant
  if (/cross-tenant access denied/i.test(message)) {
    return { status: 403, error: 'Forbidden', detail: 'Cross-tenant access denied' }
  }
  // delete failed or generic
  if (/delete failed/i.test(message)) {
    return { status: 409, error: 'Conflict', detail: message }
  }
  return { status: 500, error: 'Server error', detail: message }
}

function getTodayDate() {
  try {
    return new Date().toISOString().slice(0, 10)
  } catch (_) {
    return '1970-01-01'
  }
}

/**
 * Build the strict model payload.
 * Inputs: userText, today (YYYY-MM-DD), tools[], history
 * Returns: object payload
 */
function buildModelPayload(userText, today, tools, history) {
  return {
    message: String(userText || ''),
    today,
    tools: tools.map(t => ({ name: t.name, schema: t.schema })),
    history: Array.isArray(history) ? history.slice(-8) : [],
  }
}

/**
 * Call model provider (shim). Returns raw string from provider.
 * Throws on transport errors.
 */
async function callModelStrict(payload) {
  // Placeholder shim: emulate clarify/tool_call/answer with existing heuristic
  const decision = decideNextStep(payload.message, payload.today)
  return JSON.stringify(decision)
}

/**
 * Validate and normalize model JSON.
 * Returns a valid decision object or null on failure.
 */
function safeParseAndValidateModelResult(raw) {
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!obj || typeof obj !== 'object') return null
    if (obj.type === 'clarify') {
      if (typeof obj.question === 'string') return { type: 'clarify', question: obj.question }
      return null
    }
    if (obj.type === 'answer') {
      if (typeof obj.content === 'string') return { type: 'answer', content: obj.content }
      return null
    }
    if (obj.type === 'tool_call') {
      if (typeof obj.tool !== 'string' || typeof obj.args !== 'object' || obj.args == null) return null
      const res = { type: 'tool_call', tool: obj.tool, args: obj.args }
      if (obj.confirmationSuggested != null) res.confirmationSuggested = Boolean(obj.confirmationSuggested)
      if (obj.confirmationMessage != null) res.confirmationMessage = String(obj.confirmationMessage)
      return res
    }
    return null
  } catch (_) {
    return null
  }
}

/**
 * Extracts the most recent user message content from history.
 * Inputs: history: Array<{ role: 'user'|'assistant', content: string }>
 * Returns: string content; falls back to empty string.
 */
function extractLastUserMessage(history) {
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i]
    if (h && h.role === 'user' && typeof h.content === 'string') return h.content
  }
  return ''
}

function isValidHistory(history) {
  if (!Array.isArray(history)) return false
  for (const entry of history) {
    if (!entry || (entry.role !== 'user' && entry.role !== 'assistant')) return false
    if (typeof entry.content !== 'string') return false
  }
  return true
}

/**
 * Normalizes and sanitizes userContext.
 * Inputs: ctx possibly undefined
 * Returns: { userId, tenantId, roles[] }
 */
function sanitizeUserContext(ctx) {
  const userId = String(ctx?.userId || 'unknown-user')
  const tenantId = String(ctx?.tenantId || 'unknown-tenant')
  const roles = Array.isArray(ctx?.roles) ? ctx.roles.map(r => String(r)) : []
  return { userId, tenantId, roles }
}

/**
 * Normalize confirm payload from client.
 * Inputs: any value from body.confirm
 * Returns: { tool: string, args: object } | null
 */
function normalizeConfirm(confirm) {
  if (!confirm || typeof confirm !== 'object') return null
  if (typeof confirm.tool === 'string' && confirm.args && typeof confirm.args === 'object') {
    return { tool: confirm.tool, args: confirm.args }
  }
  if (typeof confirm.type === 'string' && confirm.payload && typeof confirm.payload === 'object') {
    if (confirm.payload.tool && confirm.payload.args) {
      return { tool: String(confirm.type), args: confirm.payload.args }
    }
    return { tool: String(confirm.type), args: confirm.payload }
  }
  return null
}

/**
 * Validate requested tool call against simple schemas.
 * Inputs: tool string, args object
 * Returns: { ok: boolean, error?: Error }
 */
function validateToolCall(tool, args) {
  const fail = (m) => ({ ok: false, error: new Error(m) })
  if (!tool || typeof tool !== 'string') return fail('tool is required')
  if (!args || typeof args !== 'object') return fail('args must be object')

  // Enforce unknown field rejection per tool schema where applicable
  const known = {
    add_expense: ['item', 'amount', 'date', 'category'],
    get_balance: ['range'],
    list_expenses: ['range', 'category'],
    update_expense: ['id', 'item', 'amount', 'date', 'category'],
    delete_expense: ['id'],
  }
  if (known[tool]) {
    for (const k of Object.keys(args)) {
      if (!known[tool].includes(k)) return fail(`unknown field: ${k}`)
    }
  }

  if (tool === 'add_expense') {
    if (typeof args.item !== 'string' || !args.item.trim()) return fail('item is required')
    const n = Number(args.amount)
    if (!Number.isFinite(n) || n <= 0) return fail('amount must be a positive number')
    return { ok: true }
  }
  if (tool === 'get_balance') return { ok: true }
  if (tool === 'list_expenses') return { ok: true }
  if (tool === 'update_expense') {
    const id = Number(args.id)
    if (!Number.isFinite(id) || id <= 0) return fail('id must be a positive number')
    if (args.item == null && args.amount == null) return fail('item or amount is required')
    if (args.amount != null) {
      const n = Number(args.amount)
      if (!Number.isFinite(n) || n <= 0) return fail('amount must be a positive number')
    }
    if (args.item != null && typeof args.item !== 'string') return fail('item must be a string')
    return { ok: true }
  }
  if (tool === 'delete_expense') {
    const id = Number(args.id)
    if (!Number.isFinite(id) || id <= 0) return fail('id must be a positive number')
    return { ok: true }
  }
  return fail('Unknown tool')
}

/**
 * Decide next step based on userText.
 * Returns one of:
 * - { type: 'clarify', question: string, attemptedAdd?: boolean }
 * - { type: 'answer', content: string }
 * - { type: 'tool_call', tool: string, args: object, confirmationSuggested?: boolean, confirmationMessage?: string }
 */
function decideNextStep(userText, today) {
  const s = String(userText || '').trim()
  const lower = s.toLowerCase()
  if (!s) return { type: 'answer', content: 'Hello! How can I help with your expenses?' }

  // list
  if (/\b(list|show)\b/.test(lower)) {
    return { type: 'tool_call', tool: 'list_expenses', args: {} }
  }

  // balance / total
  if (/\b(balance|total|sum)\b/.test(lower)) {
    return { type: 'tool_call', tool: 'get_balance', args: {} }
  }

  // delete #id
  {
    const m = /(delete|remove)\s*(#|id\s*)?(\d+)/i.exec(s)
    if (m) {
      const id = Number(m[3])
      return { type: 'tool_call', tool: 'delete_expense', args: { id }, confirmationSuggested: true }
    }
  }

  // update #id amount X or update #id item Y
  {
    const m = /update\s*(#|id\s*)?(\d+)\s*(amount|price|cost|item)\s*([^]+)$/i.exec(s)
    if (m) {
      const id = Number(m[2])
      const field = m[3].toLowerCase()
      const rest = m[4].trim()
      const args = { id }
      if (field === 'item') args.item = rest
      else args.amount = parseFirstNumber(rest)
      return { type: 'tool_call', tool: 'update_expense', args, confirmationSuggested: true }
    }
  }

  // add/log/record ITEM AMOUNT
  {
    const m = /(add|log|record)\s+([^\d#]+?)\s+(\d+(?:\.\d+)?)/i.exec(s)
    if (m) {
      const item = m[2].trim()
      const amount = Number(m[3])
      return { type: 'tool_call', tool: 'add_expense', args: { item, amount, date: today } }
    }
  }

  // attempted add but unclear
  if (/\b(add|log|record)\b/.test(lower)) {
    return { type: 'clarify', question: 'What item and amount?', attemptedAdd: true }
  }

  // expense-related generic guidance
  if (/\b(expense|expenses|spend|spent|update|delete|remove|list|show|total|cost|price|purchase|item)\b/.test(lower)) {
    return { type: 'answer', content: 'Try: "add coffee 3.50", "list expenses", "update #12 amount 5", or "delete #12".' }
  }

  return { type: 'answer', content: 'Okay.' }
}

function buildConfirmationMessage(tool, args, today) {
  if (tool === 'delete_expense') return `Would you like me to delete #${Number(args.id)}?`
  if (tool === 'update_expense') {
    if (args.item != null) return `Update #${Number(args.id)} item to "${String(args.item)}"?`
    if (args.amount != null) return `Update #${Number(args.id)} amount to ${formatAmount(args.amount)}?`
  }
  if (tool === 'add_expense') return `Would you like me to add ${String(args.item)} ${formatAmount(args.amount)} for ${today}?`
  return 'Proceed?'
}

/**
 * Execute a validated tool call and return a UI-compatible payload.
 * Returns: { answer, added?/updated?/deleted?/listed?/balance? }
 */
async function executeTool(tool, args, userContext, service, today) {
  const { tenantId, roles } = userContext
  if (tool === 'add_expense') {
    const row = await service.create(tenantId, roles, String(args.item), Number(args.amount))
    const answer = `Added #${row.id}: ${row.item} ${formatAmount(row.amount)} for ${today}.`
    return { answer, added: { items: [row] } }
  }
  if (tool === 'delete_expense') {
    const id = Number(args.id)
    await service.delete(tenantId, roles, id)
    return { answer: `Deleted #${id}.` }
  }
  if (tool === 'update_expense') {
    const id = Number(args.id)
    const patch = {}
    if (args.item != null) patch.item = String(args.item)
    if (args.amount != null) patch.amount = Number(args.amount)
    const updated = await service.update(tenantId, roles, id, patch)
    return { answer: `Updated #${updated.id}: ${updated.item} ${formatAmount(updated.amount)}.` }
  }
  if (tool === 'list_expenses') {
    const rows = await service.list(tenantId)
    if (!rows.length) return { answer: 'No expenses yet.' }
    const msg = rows.slice(0, 10).map(r => `#${r.id} ${r.item} ${formatAmount(r.amount)}`).join(', ')
    return { answer: `Recent: ${msg}` }
  }
  if (tool === 'get_balance') {
    const rows = await service.list(tenantId)
    const total = rows.reduce((sum, r) => sum + Number(r.amount || 0), 0)
    return { answer: `Balance: ${formatAmount(total)}.` }
  }
  throw new Error('Unsupported tool')
}

// ------------------- Orchestrator and Expense Domain -------------------

/**
 * Creates a singleton in-memory expense service.
 * Returns: ExpenseService with methods: create, update, delete, list, getById
 * Throws: on cross-tenant access or missing rows
 */
function getExpenseService() {
  if (!globalThis.__expenseRepo) {
    globalThis.__expenseRepo = createInMemoryExpenseRepo()
  }
  return createExpenseService(globalThis.__expenseRepo)
}

/**
 * In-memory repo with id sequence and basic CRUD.
 * Records: { id:number, tenantId:string, item:string, amount:number }
 */
function createInMemoryExpenseRepo() {
  let nextId = 1
  const rows = []

  return {
    async create(row) {
      const id = nextId++
      const record = { id, tenantId: row.tenantId, item: row.item, amount: row.amount }
      rows.push(record)
      return record
    },
    async update(id, patch) {
      const idx = rows.findIndex(r => r.id === id)
      if (idx === -1) return null
      rows[idx] = { ...rows[idx], ...patch }
      return rows[idx]
    },
    async delete(id) {
      const idx = rows.findIndex(r => r.id === id)
      if (idx === -1) return false
      rows.splice(idx, 1)
      return true
    },
    async listByTenant(tenantId) {
      return rows.filter(r => r.tenantId === tenantId).slice().sort((a, b) => b.id - a.id)
    },
    async getById(id) {
      return rows.find(r => r.id === id) || null
    }
  }
}

/**
 * Service enforcing tenant scoping and basic RBAC for writes.
 * Inputs: repo with CRUD; caller roles.
 * Returns: methods: create, update, delete, list, getById
 */
function createExpenseService(repo) {
  function assertWriteAllowed(roles) {
    const has = Array.isArray(roles) && roles.some(r => r === 'finance-admin' || r === 'super-admin')
    if (!has) throw new Error('Insufficient permissions')
  }

  async function list(tenantId) {
    return repo.listByTenant(tenantId)
  }

  async function create(tenantId, roles, item, amount) {
    assertWriteAllowed(roles)
    if (!item || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      throw new Error('Invalid item or amount')
    }
    return repo.create({ tenantId, item: String(item), amount: Number(amount) })
  }

  async function update(tenantId, roles, id, patch) {
    assertWriteAllowed(roles)
    const row = await repo.getById(Number(id))
    if (!row) throw new Error('Not found')
    if (row.tenantId !== tenantId) throw new Error('Cross-tenant access denied')
    const clean = {}
    if (patch.item != null) clean.item = String(patch.item)
    if (patch.amount != null) {
      const n = Number(patch.amount)
      if (!Number.isFinite(n) || n <= 0) throw new Error('Invalid amount')
      clean.amount = n
    }
    const updated = await repo.update(row.id, clean)
    return updated
  }

  async function remove(tenantId, roles, id) {
    assertWriteAllowed(roles)
    const row = await repo.getById(Number(id))
    if (!row) throw new Error('Not found')
    if (row.tenantId !== tenantId) throw new Error('Cross-tenant access denied')
    const ok = await repo.delete(row.id)
    if (!ok) throw new Error('Delete failed')
    return true
  }

  async function getById(tenantId, id) {
    const row = await repo.getById(Number(id))
    if (!row) throw new Error('Not found')
    if (row.tenantId !== tenantId) throw new Error('Cross-tenant access denied')
    return row
  }

  return { list, create, update, delete: remove, getById }
}

/**
 * AI-2 minimal intent parsing.
 * Supports: create (add/log/record), delete (#id), update (#id), list (list/show)
 * Enforces tenant scoping and write RBAC.
 */
async function handleAi2(userText, history, userContext, service) {
  const s = String(userText || '').trim()
  const lower = s.toLowerCase()
  const { tenantId, roles } = userContext

  // list
  if (/\b(list|show)\b/.test(lower)) {
    const rows = await service.list(tenantId)
    if (!rows.length) return 'No expenses yet.'
    const msg = rows.slice(0, 10).map(r => `#${r.id} ${r.item} ${formatAmount(r.amount)}`).join(', ')
    return `Recent: ${msg}`
  }

  // delete #id or remove #id
  {
    const m = /(delete|remove)\s*(#|id\s*)?(\d+)/i.exec(s)
    if (m) {
      const id = Number(m[3])
      await service.delete(tenantId, roles, id)
      return `Deleted #${id}.`
    }
  }

  // update #id amount X or update #id item Y
  {
    const m = /update\s*(#|id\s*)?(\d+)\s*(amount|price|cost|item)\s*([^]+)$/i.exec(s)
    if (m) {
      const id = Number(m[2])
      const field = m[3].toLowerCase()
      const rest = m[4].trim()
      const patch = {}
      if (field === 'item') patch.item = rest
      else patch.amount = parseFirstNumber(rest)
      const updated = await service.update(tenantId, roles, id, patch)
      return `Updated #${updated.id}: ${updated.item} ${formatAmount(updated.amount)}.`
    }
  }

  // add/log/record ITEM AMOUNT
  {
    const m = /(add|log|record)\s+([^\d#]+?)\s+(\d+(?:\.\d+)?)/i.exec(s)
    if (m) {
      const item = m[2].trim()
      const amount = Number(m[3])
      const row = await service.create(tenantId, roles, item, amount)
      return `Added #${row.id}: ${row.item} ${formatAmount(row.amount)}.`
    }
  }

  // fallback: guide user on expense intents
  if (/\b(expense|expenses|spend|spent|add|log|record|update|delete|remove|list|show|total|cost|price|purchase|item)\b/.test(lower)) {
    return 'I can add like "add coffee 3.50", list expenses, update "update #12 amount 5", or "delete #12".'
  }

  return 'Okay.'
}

function parseFirstNumber(s) {
  const m = /(\d+(?:\.\d+)?)/.exec(String(s || ''))
  return m ? Number(m[1]) : NaN
}

function formatAmount(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '0'
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

