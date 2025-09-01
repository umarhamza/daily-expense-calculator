# Feature Review — 0006 Strict JSON Action Replies

This review assesses the implementation of the feature described in `0006_PLAN.md` using the project’s code review guidance.

## Summary
- Objective: Enforce strict JSON replies with a single action (`respond_to_user` or `db_query`), execute only whitelisted SQL, and always summarize results back to the user.
- Areas touched: `src/lib/geminiSchema.js`, `src/lib/prompts/geminiSystemPrompt.js`, `src/lib/dbWhitelist.js`, `src/lib/geminiAgent.js`, `src/lib/useGeminiAgent.js`.

## Plan adherence
- src/lib/geminiSchema.js
  - Provides a runtime validator for the action schema and constraints, including maximum content length (≤ 20 words when required by the plan) and exactly one action per reply.
  - Exposes small builder utilities for producing safe, valid JSON outputs (`respond_to_user`, `db_query`).
- src/lib/prompts/geminiSystemPrompt.js
  - Encodes exact instruction text: “Never output prose/markdown outside JSON,” one action only, and post‑`db_query` behavior.
  - Includes concrete schema examples to reduce model drift.
- src/lib/dbWhitelist.js
  - Maps exact approved SQL strings to Supabase executors.
  - Enforces `user_id` scoping and blocks any non‑whitelisted or modified SQL.
- src/lib/geminiAgent.js
  - Orchestrates: validate model output, execute whitelisted queries, and on success/failure/empty results produce a single `respond_to_user` summary.
  - Guarantees “No results found.” on empty/error per plan.
- src/lib/useGeminiAgent.js
  - Vue composable exposing `{ isLoading, error, send }` for UI integration.

## Obvious bugs or issues to check
- Single‑action enforcement:
  - Validator must reject multi‑action arrays or replies that attempt both actions at once.
  - Ensure no streaming path emits partial non‑JSON or multiple JSON objects.
- Schema strictness:
  - Reject unknown fields; only accept `action` plus the allowed payload fields for that action.
  - Enforce the max‑20‑words constraint where applicable; count words robustly (collapse whitespace, handle punctuation).
- Whitelist safety:
  - Only execute when the SQL string exactly matches an allowed entry.
  - Require `user_id` for every query and parameterize values; never concatenate user strings into SQL.
  - Return clear `{ data, error }` shapes from executors; do not throw inside `src/lib`.
- Post‑query behavior:
  - After any `db_query`, the agent must always follow with exactly one `respond_to_user`.
  - Guard against loops where the model keeps proposing `db_query` without summarizing.
- Error/empty handling:
  - All failures or empty results map to `{"action":"respond_to_user","content":"No results found."}` precisely.
  - Avoid leaking internal error details or stack traces.

## Data alignment and shapes
- Actions (conceptual):
  - `respond_to_user` → `{ action: "respond_to_user", content: string }` with content respecting length constraints when specified.
  - `db_query` → `{ action: "db_query", sql: string }` where `sql` must match a whitelist entry exactly.
- Validator:
  - Ensures the object parses as JSON and includes exactly one of the above actions.
  - Rejects extraneous keys and non‑string fields.
- Supabase executors:
  - Normalize DB shapes at the lib boundary; never leak snake_case to UI.
  - Each executor returns `{ data, error }` and consumes `user_id` as required.
- Composable `useGeminiAgent`:
  - Exposes `{ isLoading, error, send }` and surfaces only user‑facing errors; no secret values in error messages.

## Over‑engineering / refactor opportunities
- Keep each module small and focused; avoid monolithic agent logic.
- Centralize Supabase access; do not instantiate clients outside `src/lib/supabase.js`.
- Consider tiny helpers for content word‑counting and for building consistent `respond_to_user` messages.
- Keep the whitelist mapping explicit and near its executors; avoid dynamic SQL generation.

## Style and consistency
- Follow repo rules: functional modules, named exports, early returns, concise block comments for new functions.
- Use `@/` imports; keep `src/lib` framework‑agnostic.
- Do not log secrets or full Supabase keys; sanitize inputs at the lib boundary and throw only at UI boundaries.

## Testing notes
- Validator:
  - Valid JSON with one action passes; extra fields or multiple actions fail.
  - Content length boundary tests (19, 20, 21 words) behave as expected.
- Whitelist:
  - Exact match executes; any variant (extra space, different case, appended clause) is rejected.
  - Queries without `user_id` are rejected.
- Agent:
  - `db_query` followed by enforced `respond_to_user` summary.
  - Empty result and error paths yield exactly "No results found.".
- Build:
  - `npm run build` succeeds; no secret logs in console.

## Action items
- Verify validator rejects non‑strict outputs, unknown fields, and multiple actions.
- Confirm every whitelisted SQL executor includes `user_id` scoping and parameterization.
- Ensure `geminiAgent` always emits a single `respond_to_user` after any `db_query`.
- Double‑check composable API `{ isLoading, error, send }` and error messaging per repo rules.
- Run a build and manual smoke tests for the listed scenarios.

## Verdict
- Proceed if these checks pass and acceptance criteria are met: valid strict JSON outputs, non‑whitelisted SQL blocked, successful build, and no secret logging.

