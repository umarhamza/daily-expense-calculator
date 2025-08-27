## 0003 Review - Voice-to-Text in Chat (Microphone Trigger)

### 1) Plan implementation status
- New composable `src/lib/useSpeechToText.js` exists and exports: `isSupported`, `isListening`, `transcript`, `errorMessage`, `start(options)`, `stop()`.
- Feature detection implemented via `window.SpeechRecognition || window.webkitSpeechRecognition`; `isSupported` correctly reflects availability.
- `start()` guards on unsupported/already-listening, configures `lang = navigator.language || 'en-US'`, `continuous=false`, `interimResults=false`, binds `onresult`/`onerror`/`onend`, and calls `recognition.start()`.
- `onresult` aggregates final results and updates `transcript` (trims text). Errors set `errorMessage` and stop listening.
- Cleanup stops recognition on unmount.
- UI integration in `src/components/ChatModal.vue`:
  - Imports composable and wires state: `isSttSupported`, `isListening`, `transcript`, `sttError`, `startStt`, `stopStt`.
  - Watchers: set `input` to `transcript` when non-empty; toast on `sttError`.
  - Adds microphone button, shown only when `isSttSupported`, disabled while `isSending`, toggles start/stop, with `aria-pressed` and title.
  - Transcript replaces any prior input; sending remains manual (no auto-send).
- Icons: `src/components/icons/IconMicrophone.vue` added; optional `IconStop.vue` not added (acceptable per plan).

Conclusion: Plan implemented with correct scope and no server changes.

### 2) Obvious bugs or issues
- None blocking found. The feature should work in Chrome/Edge where the API is available.
- Minor: `isListening` flips true on `recognition.onstart` (not immediately in `start()`), which is fine but can delay button state by a tick.
- Minor: When a user is recording and presses Send, recognition may continue until `onend`. Not harmful, but we could proactively stop recognition on send.

### 3) Data alignment checks
- No backend or data shape changes introduced. `ChatModal.vue` continues to send `{ question: string }` to the Netlify function.
- `transcript` is a plain string; it only updates the local `input` model. No snake/camel or `{ data: {} }` alignment concerns.

### 4) Over-engineering / file size
- `useSpeechToText.js` is small and focused. No unnecessary abstraction.
- `ChatModal.vue` changes are minimal and localized to the input row and two watchers.

### 5) Style/syntax consistency
- Matches project patterns: Vue 3 `<script setup>`, named export from composable, `@/` imports, Tailwind utility classes in the template.
- Accessibility considerations present: `aria-pressed`, `aria-label`, and descriptive `title`.

### Actionable follow-ups
1. Show a small inline error under the input for STT errors (in addition to toast), mirroring the existing send error pattern.
2. Make the microphone button `aria-label` dynamic (e.g., "Start voice input" vs "Stop voice input") to complement the `title` attribute.
3. Stop recognition on send and on modal close to avoid capturing stray audio: call `stopStt()` inside `sendMessage()` and when emitting `close`.
4. Optional: Add `IconStop.vue` and swap icons while listening for a clearer state change.
5. Optional hardening: In `stop()`, early-return when not listening; after `onend`, consider clearing the `recognition` reference for a fresh next session (current behavior is safe but this can reduce edge-case leaks).

### Verification checklist
- Composable API matches the plan and returns stable refs and methods.
- Button visibility/disable states:
  - Hidden when `!isSttSupported`.
  - Disabled while `isSending`.
  - Toggled visual state while `isListening`.
- Transcript replaces the input text and does not auto-send.
- Error handling:
  - Toast appears on `sttError`.
  - Inline STT error rendering added (see follow-up 1) if implemented.
- Build remains clean: `npm run build` succeeds without additional dependencies.

### Risks / notes
- Browser support varies; Safari/Firefox are expected to be unsupported. The UI hides the mic when unsupported and continues to function.
- Microphone permissions can fail; toasts surface error codes (e.g., `not-allowed`, `no-speech`). Consider friendlier copy mapping for common codes in a future pass.
