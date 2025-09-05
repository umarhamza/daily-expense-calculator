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

  const userContext = sanitizeUserContext(body?.userContext)
  const userText = extractLastUserMessage(history)

  try {
    // AI-1: strict JSON routing with one retry on invalid shape
    let ai1 = await callAi1Strict(userText, history, userContext)
    if (!isValidAi1Response(ai1)) ai1 = await callAi1Strict(userText, history, userContext)
    if (!isValidAi1Response(ai1)) {
      return jsonRes(500, { error: 'Server error', detail: 'AI-1 produced invalid output' })
    }

    if (ai1.action === 'pass_to_AI2') {
      const service = getExpenseService()
      try {
        const ai2Message = await handleAi2(userText, history, userContext, service)
        return jsonRes(200, { handledBy: 'AI-2', message: ai2Message, action: 'pass_to_AI2' })
      } catch (e) {
        return jsonRes(500, { error: 'Server error', detail: String(e?.message || e) })
      }
    }

    return jsonRes(200, { handledBy: 'AI-1', message: ai1.message, action: 'none' })
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
 * AI-1: Talking AI that must return STRICT JSON with shape:
 * { message: string, action: 'none'|'pass_to_AI2' }
 * For now, we simulate a small router with heuristics and keep the API stable.
 */
async function callAi1Strict(userText, history, userContext) {
  const s = String(userText || '').toLowerCase()
  const looksExpensey = /\b(expense|expenses|spend|spent|add|log|record|list|show|update|delete|remove|total|cost|price|purchase|item)\b/.test(s)
  if (looksExpensey) {
    return { message: 'Routing to expenses assistant...', action: 'pass_to_AI2' }
  }
  const msg = s ? 'I can help with expenses: add, list, update, or delete.' : 'Hello! How can I help with your expenses?'
  return { message: msg, action: 'none' }
}

function isValidAi1Response(v) {
  return v && typeof v.message === 'string' && (v.action === 'none' || v.action === 'pass_to_AI2')
}

// ------------------- AI-2 and Expense Domain -------------------

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

