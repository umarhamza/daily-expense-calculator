# Feature Review — 0002 Mobile Chat UI like ChatGPT

This review assesses the implementation of the feature described in `docs/features/0002_PLAN.md` using the project’s code review guidance.

## Summary
- Objective: Deliver a mobile-first chat UI closely resembling ChatGPT’s mobile interface.
- Areas touched: `src/components/ChatPage.vue`, new presentational chat components, scroll utilities, minimal CSS variables.

## Plan adherence
- src/components/ChatPage.vue
  - Full-height column layout: header, scrollable messages, sticky composer.
  - Header: back/close (as needed), single-line title with truncation, overflow menu (New, Rename, Delete chat).
  - Handles orchestration: load messages, send/stop, streaming lifecycle, optimistic updates.
  - State: `isSending`, `isStreaming`, `hasError`, `composerValue`, `atBottom`.
- src/components/chat/MessageItem.vue
  - Props: `role`, `content`, optional `error`, `isStreaming`.
  - Assistant markdown rendering; copy-to-clipboard; long-press menu on mobile.
- src/components/chat/MessageList.vue
  - Props: `messages`, `isLoading`; emits retry for last assistant message when failed.
  - Auto-scroll to bottom with user-overrides; “jump to latest” affordance.
- src/components/chat/Composer.vue
  - Props: `isSending`, `value`; emits `update:value`, `send`, `stop`.
  - Multiline textarea grows up to ~5 lines; Enter to send (Shift+Enter newline).
- src/lib/ui/scroll.js
  - Helpers for auto-stick to bottom, visibility checks, and scroll anchoring.
- src/assets/main.css
  - Minimal variables (e.g., `env(safe-area-inset-bottom)`) and markdown defaults if needed; prefer utilities.

## Obvious bugs or issues to check
- Mobile keyboard/safe-area:
  - Ensure composer avoids being obscured by iOS/Android keyboards; padding with `env(safe-area-inset-bottom)` and viewport unit quirks on mobile browsers.
  - Prevent layout jump when the keyboard opens; avoid 100vh pitfalls, prefer `h-dvh`.
- Input handling:
  - Respect IME composition; don’t send on Enter while composing.
  - Trim-only whitespace disables send; guard against accidental multi-line spam.
- Streaming lifecycle:
  - Toggle Send/Stop reliably; ensure Stop cancels or ignores further tokens.
  - Avoid double-append of assistant message across optimistic/stream completion paths.
- Auto-scroll correctness:
  - Stick to bottom while user is at bottom; don’t yank scroll when user is reading history.
  - “Jump to latest” shows/hides at correct thresholds; no flicker.
- Performance:
  - Token streaming updates batched with `requestAnimationFrame` or minimal reactivity churn.
  - Avoid excessive watchers; prefer computed/refs and small updates.
- Memory/click leaks:
  - Clean up event listeners (resize/scroll/intersection observers) on unmount.
  - Guard copy/long-press handlers to avoid multiple bindings.

## Data alignment and shapes
- Message objects: `{ id?, role: 'user'|'assistant', content: string, error?: string }` with timestamps if available.
- Props and emits are camelCase; presentational components remain stateless regarding network calls.
- Integration with `src/lib/supabase.js` helpers and `/.netlify/functions/chat` respects existing request/response contracts (see 0001).
- Ensure `chatId` is consistently passed through send/stop flows and persisted messages align with DB roles.

## Over-engineering / refactor opportunities
- Keep presentational components pure; lift orchestration to `ChatPage.vue`.
- Extract scrolling logic into `src/lib/ui/scroll.js`; avoid duplicating anchor math in components.
- Prefer lightweight markdown rendering and defer heavy features; avoid blocking main thread.
- Consider splitting large `ChatPage.vue` sections if they grow (header/menu, list, composer) but keep scope minimal.

## Style and consistency
- Follow repo rules: functional patterns, named exports for utilities, early returns, concise block comments above new functions.
- Use `@/` imports; Tailwind utility-first in templates; avoid inline styles.
- Dark mode coverage using provided neutral/primary schemes; no secret logging.

## Accessibility
- Color contrast for bubbles/buttons meets WCAG AA.
- `aria-live="polite"` for streamed assistant content; avoid assertive unless essential.
- Buttons and icons have `aria-label`; focus order and visible focus rings preserved.
- Respect prefers-reduced-motion: disable pulsating typing indicators and heavy animations.
- Textarea labeled, announces send/stop state changes to assistive tech.

## Tailwind utility checks
- Container: `flex flex-col h-dvh bg-neutral-50 dark:bg-neutral-900`.
- Header: `sticky top-0 z-10 backdrop-blur border-b` with neutral colors.
- List: `flex-1 overflow-y-auto px-3 py-2` with responsive gaps.
- Bubbles:
  - User: `self-end max-w-[82%] rounded-2xl rounded-br-sm bg-primary-600 text-white dark:bg-primary-500`.
  - Assistant: `self-start max-w-[88%] rounded-2xl rounded-bl-sm bg-white text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100 border`.
- Composer: `sticky bottom-0 z-10 border-t bg-neutral-50/80 dark:bg-neutral-900/80 backdrop-blur p-2 pb-[env(safe-area-inset-bottom)]`.

## UI behaviors to validate
- Header menu actions: New, Rename, Delete chat with confirmation and optimistic updates.
- Message stream alignment and spacing match ChatGPT-like feel; timestamps shown on long-press/hover.
- Markdown rendering supports code blocks and lists; copy button works on mobile (including iOS).
- Auto-scroll and “jump to latest” affordance function as specified.
- Composer growth to ~5 lines; Enter sends, Shift+Enter inserts newline; disabled state on empty input.
- Error surfacing via toasts; last assistant message shows retry when failed.

## Edge cases
- Very long messages and large code blocks: clamp widths; allow horizontal scroll inside code blocks only.
- Offline/failed requests: preserve user input; enable retry without duplication.
- Orientation changes: maintain scroll anchoring; re-evaluate safe-area and viewport height.
- Theming: dark mode, high contrast displays.
- Mixed input methods (hardware keyboards on mobile, IME composition).

## Testing notes
- Validate on 320–480 px widths and dark mode.
- Confirm auto-scroll behavior when reading older messages.
- Ensure composer focus/keyboard behaviors on iOS and Android (Enter, Shift+Enter, IME).
- Check reduced motion preference disables animated indicators.

## Action items
- Implement `src/lib/ui/scroll.js` utilities with clear, documented helpers.
- Ensure `src/assets/main.css` includes minimal safe-area and markdown defaults if necessary.
- Verify copy-to-clipboard cross-platform behavior; fall back where needed.
- Audit event listener cleanup and streaming cancellation paths.
- Align request/response handling with existing chat function; prevent shape drift.

## Verdict
- Proceed if the above checks pass. Address action items before merging any UI changes that diverge from plan or repository conventions.

