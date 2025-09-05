# Feature Review — 0008 Chat Backend Clarification Loop

This review assesses the implementation of the feature described in `0008_PLAN.md` using the project’s code review guidance.

## Summary
- Objective: Rewrite `netlify/functions/chat.js` to orchestrate a clarify‑then‑act loop with a strict JSON contract. The backend sends the latest message, today’s date, and a tool catalog to the model; the model responds with `clarify`, `tool_call`, or `answer`. The backend optionally seeks confirmation, executes tools via the existing service, and returns a final answer.
- Areas touched: `netlify/functions/chat.js` (orchestrator + tool schemas/validation + dispatcher), possible reuse of `src/lib/date.js`, `src/lib/supabase.js`, and UI integration with `src/components/ChatPage.vue` / `ChatModal.vue` for `{ answer, confirmationRequired?, proposal? }`.

## Plan adherence
- netlify/functions/chat.js
  - Accepts JSON body `{ history, message?, question?, userContext?, confirm? }`; normalizes to `history + latest user text`.
  - Builds model payload: `{ message, today: YYYY-MM-DD, tools: [...], history: compact }` and calls the provider.
  - Enforces strict JSON from the model with exactly one of:
    - Clarify: `{ type: 'clarify', question: string }`
    - Tool call: `{ type: 'tool_call', tool: string, args: object, confirmationSuggested?: boolean, confirmationMessage?: string }`
    - Answer only: `{ type: 'answer', content: string }`
  - On invalid JSON: retry parse once; on repeated failure, return an error (no infinite retries).
  - When `type='tool_call'` and confirmation is required/suggested: respond with `{ answer, confirmationRequired: true, proposal: { tool, args } }`; when confirmed via `{ confirm: { tool, args } }`, execute immediately.
  - Validates tool names against the catalog and validates `args` by per‑tool schema; rejects unknown fields.
  - Dispatches to the existing in‑memory `ExpenseService` mapping:
    - `add_expense` → `service.create(tenantId, roles, item, amount)` (optionally include `date`/`category` later)
    - `get_balance` → sum of `service.list(tenantId)`
    - `list_expenses` → filtered `service.list(tenantId)`
    - `update_expense` → `service.update(tenantId, roles, id, patch)`
    - `delete_expense` → `service.delete(tenantId, roles, id)`
  - Preserves helper seams: `jsonRes`, `mapDomainErrorToHttp`, `extractLastUserMessage`, service code, and legacy response fields where feasible.

## Obvious bugs or issues to check
- Strict JSON enforcement:
  - Reject non‑JSON outputs or wrong shapes; ensure no extra keys beyond the contract.
  - Implement exactly one retry on parse/shape failure.
- Request normalization & validation:
  - Prefer last user turn from `history` when both `history` and `message` present.
  - Validate input types; return 4xx on malformed body.
- Tool validation & execution:
  - Validate `tool` against catalog; validate `args` per schema; reject unknown fields.
  - Do not execute tools during `clarify` path.
- Confirmation gate:
  - When `confirmationSuggested` is true, return `confirmationRequired: true` and echo a `proposal`.
  - On `{ confirm: { tool, args } }`, bypass re‑asking the model and run execution.
- Service safety & RBAC:
  - Enforce tenant scoping and role checks for writes via `ExpenseService`.
  - Map domain errors to HTTP status with `mapDomainErrorToHttp`.
- Error handling & responses:
  - No infinite loops; guard unexpected model types with a clear 5xx error.
  - Never leak stack traces or secrets in errors.

## Data alignment and shapes
- Model outputs (strict):
  - Clarify: `{ type: 'clarify', question: string }`
  - Tool call: `{ type: 'tool_call', tool: 'add_expense'|'get_balance'|'list_expenses'|'update_expense'|'delete_expense', args: object, confirmationSuggested?: boolean, confirmationMessage?: string }`
  - Answer: `{ type: 'answer', content: string }`
- Handler input contract:
  - Accept `{ history: Turn[], message?: string, question?: string, userContext?, confirm?: { tool, args } }`.
- Handler responses:
  - Clarify: `{ answer: string }` with `confirmationRequired: false` (implicit if absent).
  - Confirm gate: `{ answer: string, confirmationRequired: true, proposal: { tool, args } }`.
  - Final success: `{ answer, added?|updated?|deleted?|listed?|balance? }` (maintain legacy fields when feasible).
- Tool schemas:
  - `add_expense`: `{ item: string, amount: number, date?: ISO string, category?: string }`
  - `get_balance`: `{ range?: string }`
  - `list_expenses`: `{ range?: string, category?: string }`
  - `update_expense`: `{ id: number, item?: string, amount?: number, date?: ISO string, category?: string }`
  - `delete_expense`: `{ id: number }`

## Over‑engineering / refactor opportunities
- Keep orchestrator compact; extract schema validation and result validation to tiny helpers.
- Avoid building a full NLU/intent layer; lean on explicit tool schemas.
- Keep the in‑memory service unchanged; only map tool calls through a thin dispatcher.

## Style and consistency
- Follow repo rules: functional modules, named exports, early returns, concise block comments for new utilities.
- Keep data access in `netlify/functions` or `src/lib`; no direct DB/secret handling in UI components.
- Do not log secrets or full Supabase keys; sanitize error messages.
- Maintain existing formatting; keep edits minimal and scoped to `chat.js` changes.

## Testing notes
- Endpoint behavior:
  - `POST` only; other methods return 405.
  - Invalid/missing JSON body returns 400; valid flows return 200.
- Clarify path:
  - Given ambiguous text, model returns `type='clarify'`; handler returns `{ answer }` with no tool execution.
- Tool path (no confirm):
  - With valid `tool_call` and valid args, execute immediately and return final `{ answer, ... }` fields.
- Confirmation path:
  - When `confirmationSuggested` is true, return `{ confirmationRequired: true, proposal }`.
  - On subsequent call with `{ confirm }`, execute and return final.
- Validation:
  - Unknown tool names or invalid args return 4xx with `{ error, detail? }`.
  - Enforce tenant scoping and write permissions via `ExpenseService`.
- Date handling:
  - `today` is injected as `YYYY-MM-DD` into payload; ensure correctness across timezones.

## Action items
- Verify strict JSON parsing with a single retry and correct type discrimination.
- Confirm tool schemas and per‑tool arg validation reject unknown fields.
- Ensure confirmation gate behavior and `{ confirm }` execution flow match the plan.
- Check dispatcher mappings to `ExpenseService` and RBAC enforcement.
- Preserve legacy response fields (`answer`, `added`, etc.) where feasible for UI compatibility.
- Build and smoke test the Netlify function locally; verify no secret logging.

## Verdict
- Proceed if acceptance criteria are met: strict JSON contract and retry, correct clarify/confirm/execute flows, validated tool schemas, safe `ExpenseService` execution with tenant scoping and RBAC, proper response shapes, and a successful build with clean logs.

