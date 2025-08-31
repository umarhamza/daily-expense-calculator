# Feature Review — 0004 Remove Chat Dark Mode and Fix currencySymbol Error

This review assesses the implementation of the feature described in `docs/features/0004_PLAN.md` using the project’s code review guidance.

## Summary
- Objective: Remove dark mode styling from chat UI components and fix `currencySymbol` being undefined in the Netlify chat function when formatting totals.
- Areas touched: `netlify/functions/chat.js`, `src/components/ChatPage.vue`, `src/components/chat/MessageItem.vue`, `src/components/chat/MessageList.vue`, `src/components/chat/Composer.vue`.

## Plan adherence
- netlify/functions/chat.js
  - Resolve currency symbol once at the start of spend-answering logic via `const currencySymbol = await getCurrencySymbol(supabase)`.
  - Pass `currencySymbol` to all `formatAmount` calls across quick comparison and top items branches.
  - Keep response shapes unchanged; only formatting uses the symbol.
- src/components/ChatPage.vue
  - Remove `dark:bg-neutral-900` from container and `dark:bg-neutral-900/80` from header.
  - Remove `dark:text-neutral-200` from title.
- src/components/chat/MessageItem.vue
  - Remove `dark:bg-neutral-800` and `dark:text-neutral-100` from assistant bubble.
  - Remove `dark:text-neutral-200` and `dark:border-neutral-600` from copy button.
- src/components/chat/MessageList.vue
  - Remove `dark:bg-neutral-200` and `dark:text-neutral-900` from the “Jump to latest” button.
- src/components/chat/Composer.vue
  - Remove `dark:bg-neutral-900/80` from container and `dark:bg-neutral-800` from textarea.

## Obvious bugs or issues to check
- Ensure `currencySymbol` is defined in all paths of `answerSpendQuestion` before any formatting calls.
- Verify `getCurrencySymbol(supabase)` is awaited and handles missing/empty symbols (formatter should render plain numbers without a prefix).
- Confirm all `formatAmount` call sites now pass the symbol consistently; no lingering calls with an undefined variable.
- Removing `dark:` utilities must not also remove required light-mode classes; check for accidental deletions.
- Verify no remaining `dark:` utilities in the affected files; avoid touching unrelated components or global Tailwind config.

## Data alignment and shapes
- Request/response contracts for `/.netlify/functions/chat` remain unchanged (no new fields; shapes align with existing callers).
- Amount formatting: when `currency_symbol` is empty or whitespace, display plain numbers (existing `formatAmount` behavior). No `undefined` or `null` prefixes in UI.
- Maintain camelCase in client and normalize any snake_case at lib boundaries (unchanged by this feature).

## Over-engineering / refactor opportunities
- Keep `chat.js` lean; the symbol lookup should remain a single local variable. Avoid scattering lookups or introducing shared/global state.
- If multiple branches format amounts, consider small helper within the function scope to reduce duplication, but keep scope minimal.

## Style and consistency
- Follow repository rules: functional approach, early returns, concise block comments on new/modified helpers if added.
- Presentational components remain free of direct data access; only class removals were made.
- Use `@/` imports where applicable; no changes to Node engines or dependencies.

## Testing notes
- Build: run `npm run build` to confirm no bundling or syntax errors after UI class edits.
- Backend smoke tests via UI hitting `/.netlify/functions/chat`:
  - "Total this week vs last week" → no ReferenceError; amounts include symbol when available.
  - "Top items this month" → each line formatted correctly with symbol or plain numbers.
- UI checks:
  - Visual parity in light theme on chat pages; no regressions.
  - Inspect DOM/styles to confirm no `dark:` utilities remain in the four modified components.

## Edge cases
- Empty or whitespace user currency symbol → formatter renders plain numbers without prefix.
- Branch coverage: ensure both quick comparison and top items paths use the same local `currencySymbol`.
- Streaming/early-return paths in the function should not bypass the symbol initialization.

## Action items
- Verify `answerSpendQuestion` defines `currencySymbol` once and uses it in every `formatAmount` call.
- Confirm removal of all specified `dark:` class variants in: `ChatPage.vue`, `MessageItem.vue`, `MessageList.vue`, `Composer.vue`.
- Re-run build and perform manual checks outlined above.

## Verdict
- Proceed if the above checks pass and acceptance criteria are met. Address any deviations (missing symbol wiring or leftover `dark:` classes) before merging.

