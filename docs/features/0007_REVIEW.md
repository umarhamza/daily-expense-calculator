# Feature Review — 0007 AI‑1/AI‑2 Orchestration and Strict JSON Routing

This review assesses the implementation of the feature described in `0007_PLAN.md` using the project’s code review guidance.

## Summary
- Objective: Enforce strict JSON replies from AI‑1 and route expense intents to AI‑2, which performs CRUD via a scoped service, returning `{ handledBy, message, action }` from the Netlify function.
- Areas touched: `netlify/functions/chat.js` (orchestrator), in‑memory repo + `ExpenseService` seam, minimal model provider stubs.

## Plan adherence
- netlify/functions/chat.js
  - Guards `POST` only and parses JSON body `{ history, userContext }` with clear 4xx errors on invalid input.
  - Calls AI‑1 with a strict JSON system prompt; validates result shape `{ message, action: 'none'|'pass_to_AI2' }`.
  - Retries once on invalid AI‑1 output; returns 500 with `{ error, detail }` if still invalid.
  - When `action === 'pass_to_AI2'`, invokes AI‑2 with `userText`, `history`, and `userContext`, then responds with `{ handledBy:'AI-2', message, action:'pass_to_AI2' }`.
  - Non‑expense queries return AI‑1’s message with `{ handledBy:'AI-1', action:'none' }`.
- ExpenseService and Repo
  - `ExpenseService` exposes `create`, `update`, `delete`, `list`, `getById` with tenant scoping and role checks for writes.
  - Default `InMemoryExpenseRepo` maintains an id sequence and returns lists sorted by `id desc`.
  - Clear seam to replace with Supabase later without altering the service interface.

## Obvious bugs or issues to check
- Strict JSON enforcement (AI‑1):
  - Reject non‑JSON or schema‑mismatched outputs; ensure unknown fields are disallowed.
  - Implement a single retry; do not enter infinite retry loops.
- Request validation:
  - `history` must be a non‑empty array of `{ role, content }`; return 400 on invalid.
  - Default `userContext` if missing, but never crash on `undefined`.
- AI‑2 routing and permissions:
  - Writes require `finance-admin` or `super-admin`; reads allowed when scoped.
  - All service methods enforce `tenantId` scoping; reject cross‑tenant access.
- Error boundaries and response shape:
  - Map validation and service errors to proper 4xx/5xx with `{ error, detail? }`.
  - Success responses always match `{ handledBy, message, action }`.
- In-memory repo safety:
  - Monotonic id generation; no collisions under concurrent requests.
  - Update/delete should error on missing ids and cross‑tenant attempts.

## Data alignment and shapes
- AI‑1 output:
  - `{ message: string, action: 'none'|'pass_to_AI2' }` only; no extra keys.
- Function responses:
  - 200: `{ handledBy:'AI-1'|'AI-2', message:string, action:'none'|'pass_to_AI2' }`.
  - 400: `{ error: 'history (array) is required' | 'Invalid JSON body' }`.
  - 405: `{ error: 'Method Not Allowed' }`.
  - 500: `{ error:'Server error', detail }` (no stack traces).
- Service contracts:
  - Methods return normalized objects; avoid leaking internal shapes to the handler.
  - Lists sorted by `id desc`; ids are numbers; tenant scoped.

## Over‑engineering / refactor opportunities
- Keep orchestration logic small; extract AI‑1 validation to a tiny helper for clarity.
- Keep AI‑2 intent parsing minimal; avoid building a full NLU layer prematurely.
- Keep the in‑memory repo trivial; add a small interface to ease swapping with Supabase.

## Style and consistency
- Follow repo rules: functional modules, named exports, early returns, concise block comments for new functions.
- No DB calls from UI; keep data access in `netlify/functions` or `src/lib` when introduced.
- Do not log secrets; avoid leaking environment details in errors.

## Testing notes
- Handler:
  - `POST` only; other methods return 405.
  - Missing/invalid JSON body yields 400; valid flow yields 200.
- AI‑1 validation:
  - Non‑JSON or wrong shape triggers one retry, then 500.
  - Valid `{ message, action }` returns 200 with `handledBy` set accordingly.
- AI‑2 intents:
  - Create/update/delete require proper roles; unauthorized returns 403/401 style 4xx.
  - List and getById scoped by `tenantId`; cross‑tenant attempts fail.
- Repo:
  - Create increments id; list returns `id desc` ordering.
  - Update/delete missing id returns not‑found error.

## Action items
- Verify AI‑1 strict JSON validation and single retry are implemented exactly.
- Confirm success responses always include `{ handledBy, message, action }`.
- Ensure write operations enforce roles and tenant scoping in `ExpenseService`.
- Check in‑memory repo id sequencing and sorted list behavior.
- Run `npm run build` and smoke test the Netlify function locally.

## Verdict
- Proceed if acceptance criteria are met: strict JSON routing, safe AI‑2 CRUD with permissions and tenant scoping, correct response shapes, and successful build with no secret logging.

