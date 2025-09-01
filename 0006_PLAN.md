## Strict JSON Action Replies Plan

### Goal
Ensure all Gemini replies are strict JSON with exactly one action: `respond_to_user` or `db_query`, and enforce post-query behavior.

### Scope
- Validator for schema and constraints (max 20 words).
- System prompt encoding the rules.
- Whitelist layer translating approved SQL strings to Supabase queries.
- Agent runner to validate, execute whitelisted queries, and summarize results to a single `respond_to_user`.
- Vue composable for UI integration.

### Implementation
- `src/lib/geminiSchema.js`: runtime validator; builders for safe JSON outputs.
- `src/lib/prompts/geminiSystemPrompt.js`: exact instruction text with schema examples.
- `src/lib/dbWhitelist.js`: map exact SQL → Supabase executor; requires `user_id` scoping.
- `src/lib/geminiAgent.js`: orchestrates validation; executes whitelisted queries; handles empty/error → "No results found."; summarizes results.
- `src/lib/useGeminiAgent.js`: exposes `{ isLoading, error, send }` to components.

### Behavior Rules
- Never output prose/markdown outside JSON.
- After any `db_query`, return one `respond_to_user` summarizing results.
- On failure/empty results: `{"action":"respond_to_user","content":"No results found."}`

### Acceptance Criteria
- All outputs parse as JSON and match schema.
- Non-whitelisted SQL is blocked.
- Build succeeds; no console logs of secrets.

### Future Work
- Unit tests for validator and whitelist.
- Expand whitelist with safe parameterized variants.
