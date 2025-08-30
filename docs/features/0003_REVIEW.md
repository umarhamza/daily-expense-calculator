# Feature Review — 0003 Conversational Expense Chatbot with Confirmation

This review assesses the implementation of the feature described in `docs/features/0003_PLAN.md` using the project’s code review guidance.

## Summary
- Objective: Expand chat to be conversational and domain‑aware for expense tracking, asking for confirmation before mutations and answering spend queries (totals, periods, top items).
- Areas touched: `netlify/functions/chat.js` (primer, QUERY routing), `src/lib/supabase.js` (aggregate helpers), `src/components/ChatPage.vue`/`ChatModal.vue` (copy/confirmation UX).

## Plan adherence
- netlify/functions/chat.js
  - Adds concise system primer: daily expense tracker scope, conversational tone, confirm before mutations.
  - Retains existing intent router; extends QUERY handling for totals by item/time windows, totals by period, and quick summaries.
  - Uses DB chat history to preserve context (unchanged mechanism).
  - Reuses confirmation flow for ADD/MODIFY/DELETE, returning `{ confirmationRequired, proposal, chatId }` and committing on `confirm`.
  - Response shape remains `{ answer, chatId, messageId?, confirmationRequired?, proposal?, added?, updated?, deleted? }`.
- src/lib/supabase.js
  - Adds named aggregate helpers returning `{ data, error }`:
    - `getTotalForItem(userId, item, startDate?, endDate?)`
    - `getTotalForPeriod(userId, startDate, endDate)`
    - `getTopItems(userId, startDate?, endDate?, limit = 5)`
  - Validates inputs (userId, item, ISO date strings); uses parameterized filters.
- UI (ChatPage.vue / ChatModal.vue)
  - Keeps existing confirmation UI with `pendingProposal` and commit via `confirm` flow.
  - Updates helper/empty state copy to emphasize expense‑tracking examples (add expense, totals, comparisons).

## Obvious bugs or issues to check
- Auth enforcement: server function should require `Authorization: Bearer` and derive `userId` via Supabase auth; no public aggregate endpoints.
- Confirmation lifecycle: ensure proposals persist or compute deterministically; avoid committing on stale proposals; idempotent confirm.
- Error paths: when aggregates fail, return friendly error text while preserving chat continuity; ensure no partial writes on mutations.
- Time windows: ambiguous phrases (e.g., "this month", "last week") mapped correctly with timezone awareness; avoid off‑by‑one on inclusive/exclusive bounds.
- Currency handling: never guess symbols; format raw numbers or use user profile currency if available; avoid locale surprises.
- Numeric precision: totals should avoid float rounding errors; prefer decimal/numeric in DB and safe aggregation.

## Data alignment and shapes
- Request body unchanged: `{ question, chatId?, title?, history?, confirm? }`.
- Aggregate helpers
  - Inputs: `userId` string, `item` string (non‑empty), optional `startDate`/`endDate` in ISO‑8601; `limit` positive integer.
  - Outputs:
    - `getTotalForItem` → `{ data: { total: number } | null, error }`
    - `getTotalForPeriod` → `{ data: { total: number } | null, error }`
    - `getTopItems` → `{ data: Array<{ item: string, total: number }>, error }`
- Role names and casing remain camelCase in client; DB may use snake_case; normalize at the lib boundary.
- Chat function response fields must exactly match existing callers (composer/send flow, confirmation UI).

## Over‑engineering / refactor opportunities
- Keep `chat.js` lean by extracting QUERY sub‑intent parsing and date window resolution into small utilities.
- Centralize date parsing/normalization in a helper to avoid duplicated logic across totals and summaries.
- Ensure aggregate helpers live in `src/lib/supabase.js`; do not instantiate the Supabase client elsewhere.

## Style and consistency
- Follow repo rules: functional approach, named exports, early returns, concise block comments above new functions.
- Use `@/` imports; presentational components should remain free of direct data access.
- Tailwind utility‑first classes in templates; avoid inline styles.
- Never log secrets or full Supabase keys.

## Prompt construction and guardrails
- System primer prepended consistently to model input; short, scope‑setting, and safety‑oriented.
- History: include last N messages oldest‑first for context; maintain token budget trimming.
- For out‑of‑scope requests, brief redirection back to expense tracking per plan.
- Mutations always require confirmation; never commit on speculative or inferred approval.

## UI behaviors to validate
- Conversation: streaming/optimistic updates behave as before; no double‑append of assistant messages.
- Confirmation: `{ confirmationRequired, proposal }` renders summary with clear Confirm/Cancel; commit via existing `confirm` call.
- Answers: QUERY responses display direct numeric totals with a brief next‑step hint (e.g., breakdown prompt).
- Empty state copy updated to domain‑aware examples; no visual regressions.
- Accessibility: maintain labels, focus rings, and reduced‑motion affordances from prior UI review.

## Data access (Supabase) checks
- `getTotalForItem`
  - Case insensitivity for item matching as appropriate (consider `ilike`); avoid accidental collisions.
  - Multiply `cost * quantity`; guard nulls/defaults; respect date filters with inclusive bounds.
- `getTotalForPeriod`
  - Validate ISO dates; compute total across window; handle empty result as `{ total: 0 }` rather than null where appropriate.
- `getTopItems`
  - Group by `item`, order by total desc, limit default 5; ensure stable ordering for ties.
- RLS policies: all selects aggregate within `auth.uid()`; no cross‑user leakage.
- Indexes: verify useful indexes on `(user_id, created_at)` and possibly `(user_id, item)` for aggregates.

## Edge cases
- Ambiguous item names (e.g., "tea" vs "green tea"): ask for clarification or state assumption.
- Open‑ended queries without timeframe: default to a reasonable window (e.g., this month) and state it explicitly.
- Cross‑month/week boundaries and locale timezones; use UTC normalization consistently.
- Very large histories: maintain history cap; ensure prompt fits model limits.
- Network or DB errors: surface non‑technical messages; keep confirmation state consistent after failures.

## Testing notes
- Unit‑level: date window parser and QUERY intent router; aggregate helper input validation and SQL shape.
- Integration: end‑to‑end totals for known seed data across item and period windows.
- UI: confirmation flow from proposal render to commit; empty state copy visibility and dark mode.
- Performance: aggregates over realistic datasets; ensure no N+1 or client‑side heavy work.

## Action items
- Verify response shapes in `chat.js` match existing consumers; avoid breaking the send/confirm flows.
- Implement and document a small date window utility with tests (this week, last month, custom ISO range).
- Ensure aggregate helpers handle decimals precisely and return `{ data, error }` only; no throws in `src/lib`.
- Audit RLS policies and add/confirm indexes to support aggregates efficiently.
- Review UI copy for clarity and localization readiness; avoid currency symbols unless known.

## Verdict
- Proceed if the above checks pass. Address action items before merging any change that diverges from the plan or repository conventions.

