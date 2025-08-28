# Feature Review — 0001 Chat persistence and memory for Gemini

This review assesses the implementation of the feature described in `docs/features/0001_PLAN.md` using the project’s code review guidance.

## Summary
- Objective: Add persistent chats and history-aware prompts to Gemini-backed chat.
- Areas touched: Netlify function `chat`, Supabase data-access, UI for chat list/history, RLS and schema.

## Plan adherence
- netlify/functions/chat.js
  - Accepts `chatId`, optional `title`.
  - Persists user and assistant messages.
  - Loads last N messages for `chatId` and injects into Gemini prompt.
  - Creates new chat and returns `chatId` if absent.
  - Response shape: `{ answer, chatId, messageId?, confirmationRequired?, proposal? }`.
- src/lib/supabase.js
  - Data-access helpers: `createChat`, `listChats`, `deleteChat`, `insertMessage`, `listMessages`.
  - Returns `{ data, error }`, throws only at UI boundaries.
- UI (ChatPage.vue / ChatModal.vue)
  - Chat list: create, select, delete.
  - Load and render message history for selected chat.
  - Send flow: ensure chat exists, persist user msg, call function with `chatId`, persist assistant reply.
  - Deletion confirmation, optimistic UI.
- Routing/App
  - Route/view state supports selecting a chat and passing `chatId`.

## Obvious bugs or issues to check
- Missing auth guard on function; ensure `Authorization: Bearer` enforced and `supabase.auth.getUser()` used.
- Failure paths: user message persisted but assistant fails; ensure UI shows retry and message state.
- Response fields alignment with existing callers (intent/proposal flows).
- Token budget trimming to avoid Gemini errors.
- RLS coverage for all CRUD paths; no leakage across users.

## Data alignment and shapes
- Request body: `{ question, chatId?, title?, history?, confirm? }`.
- Messages persisted with roles `'user'|'assistant'|'system'` and `content` text.
- Ensure `listMessages` ordering asc for prompt transcript; UI may want desc for display.
- Verify camelCase in client code vs any snake_case from database.
- Confirm cascade delete removes `chat_messages` on chat deletion.

## Over-engineering / refactor opportunities
- Keep Netlify function lean; extract prompt building and history loading to small utilities.
- Avoid large single-file UI; split chat list and message view into small components if growing.
- Reuse existing Supabase helper patterns; no duplicate client instantiation.

## Style and consistency
- Follow repo rules: functional, named exports, early returns, concise block comments for new functions.
- Use `@/` import alias; keep Tailwind utility-first style in templates.
- Do not log secrets or Supabase keys; sanitize inputs at lib boundaries.

## Database and RLS checks
- Tables: `chats`, `chat_messages` with described columns and indexes.
- RLS: enable and add policies limiting to `auth.uid()` for select/insert/delete.
- Indexes for `(user_id, created_at)` and `(chat_id, created_at)` present.

## Prompt construction checks
- History transcript built as compact `User:`/`Assistant:` lines.
- System primer prepended, latest question appended.
- Oldest-first truncation to respect token budget.
- Applied across intent router and proposal builders, not only generic Q&A.

## UI behaviors to validate
- Chat list shows titles and relative timestamps.
- New chat auto-creation on first send when no `chatId`.
- Delete chat: confirmation and optimistic removal; navigation reset.
- History view: roles, timestamps, optional retry for last assistant message; virtualize if needed.
- Error surfacing via toasts; no secret leakage in logs.

## Edge cases
- 401 on missing auth; 403/404 on foreign or missing `chatId`.
- Network/API errors: user msg persisted; assistant failure recorded with retry path.
- Pagination: `listMessages` supports `limit` and `beforeId` for older history.

## Action items
- Verify all response shapes match existing consumers; update types/usages if diverged.
- Add unit-level utilities for prompt building with token budgeting.
- Ensure tests or manual checks for RLS policies and cascade deletions.
- Review UI for performance with long histories; add virtualization if necessary.

## Verdict
- Proceed if the above checks pass. Address action items before merging if any discrepancies are found.