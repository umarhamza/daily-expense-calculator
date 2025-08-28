## Feature 00014 — Code Review

### Summary
The plan introduces a context‑aware chatbot specialized for expense tracking with short, friendly replies, memory of recent history, and explicit two‑step confirmations for add/modify/delete. Back end work centers on a unified system‑instructions builder, enriched Gemini inputs (system instructions, current date, chat history, latest message), expanded intent routing, and confirmation commit handling via Supabase. Front end changes ensure history is sent per request, add a New Chat control, and implement the confirmation UX. Below are adherence checks, risks, and minimal edits to ensure robustness and alignment with constraints (no hallucinations, brief answers, expense‑only scope).

### Plan adherence
- `netlify/functions/chat.js`
  - Centralized system instruction builder that constrains scope to an Expense Tracker Assistant and enforces brevity and confirmations. Expected.
  - Gemini integration refactored to accept `{ systemInstructions, currentDateIso, chatHistory, latestUserMessage }`. Expected.
  - `detectIntent` expanded to `ADD | MODIFY | DELETE | QUERY | CONFIRM | CLARIFY` with routing logic for proposals and commits. Expected.
  - Two‑step flows: propose normalized payloads for add/modify/delete; on confirmation, persist via Supabase. Expected.
  - Deterministic totals via `answerSpendQuestion`; Gemini reserved for intent/extraction. Expected.
  - Prompts updated to refuse unrelated questions and keep answers brief. Expected.
- `src/components/ChatPage.vue`
  - Sends last N messages as `history` along with the latest `question`. Expected.
  - Adds a “New chat” control clearing local `messages` and resetting greeting. Expected.
  - Handles `confirmationRequired` by rendering proposal and awaiting explicit confirmation before sending `confirm`. Expected.
- `src/components/ChatModal.vue`
  - Mirrors `ChatPage.vue` behaviors: `history`, New Chat, confirmation flow. Expected.
- `src/lib/supabase.js`
  - Reuses `insertExpense`, `updateExpense`, `deleteExpense`; optional `fetchRecentExpenses(userId, limit)` for disambiguation. Expected.

### Potential issues / risks
- Chat history ordering and truncation
  - Be consistent (documented) about chronological vs latest‑first. Mismatches can degrade intent detection and confirmations. Truncate strictly to N (e.g., 20) turns.
- Confirmation state linkage
  - Server must bind confirmations to the user/session and recent proposal to prevent committing stale or forged payloads. Include a proposal token or echo‑validation using server‑side cache keyed by user.
- Ambiguity resolution for modify/delete
  - Natural language like “the bread from yesterday” can match multiple rows. Ensure backend returns a short clarifying prompt with minimal options instead of guessing.
- Non‑hallucination guarantees
  - Prompts should explicitly forbid inventing data; all derived values must come from Supabase or provided history. Validate that Gemini output is only used for parsing/planning, not authoritative data.
- RLS and user scoping
  - All Supabase operations must filter by the authenticated `user_id`. Avoid trusting client‑provided IDs without validation.
- Date handling
  - Use UTC (`YYYY-MM-DD`) consistently. Relative ranges (today/yesterday/this week/last week/this month) should be computed UTC‑safely to avoid DST/local offsets.
- Front end confirmation UX
  - Ensure explicit confirmation input (e.g., button or “yes”) is required before commit. Guard against accidental double‑submits and maintain a disabled state during commit.
- Payload shape drift
  - Keep request/response shapes stable: `{ question, history, confirm? }` and proposal/commit responses. Version if changes are needed.

### Minor polish
- Extract prompt builders
  - Keep system instructions and parsing/answer prompts in small helpers with minimal duplication; centralize constants (identity, scope, safety, confirmation policies).
- Normalize proposals
  - Ensure add proposals use `{ date, items: [{ item, quantity, cost }] }`; modify proposals use `{ id, update: { item?, cost?, quantity?, date? } }`; delete proposals `{ id }`.
- Input validation
  - Validate parsed numbers/dates on the server side before proposing/committing; return concise errors when invalid.
- History hygiene
  - Strip transient UI messages like “Thinking…” before sending; limit to recent N turns.
- Short answers
  - Enforce concise summaries in proposals (“Add: bread ×3 (36) today. Confirm?”) and in query results.

### Acceptance criteria
- Memory & chat management: last N messages and current date included; New Chat clears history. ✅
- Gemini calls include system instructions, history, current date, and latest user message. ✅
- Assistant scope and behavior: expense‑only, brief replies, refusal of unrelated topics, short “how to use” guidance. ✅
- Add/Modify/Delete: proposal first, explicit confirmation required; commit persists via Supabase. ✅
- Deterministic calculations for totals/averages/comparisons with relative dates supported. ✅
- No hallucinations; only chat history and backend context used. ✅

### Suggested minimal edits (non‑blocking)
1) Bind confirmations to proposals
   - Include a short‑lived proposal token in the proposal response and require it in the `confirm` payload; validate server‑side against user/session.
2) Standardize history order and docs
   - Choose chronological or latest‑first; document and enforce across front end and back end to keep prompts stable.
3) UTC‑safe date helpers
   - Add small helpers for generating `currentDateIso` and computing relative ranges using UTC to avoid DST issues.
4) Ambiguity prompts
   - When modify/delete targets are ambiguous, return a concise clarification with 2‑3 options rather than failing or guessing.
5) Guard double submissions
   - Disable confirm UI during commit; ignore duplicate commits server‑side by checking proposal token usage.