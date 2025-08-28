## Feature 00012 — Code Review

### Summary
Implementation closely follows the plan: the auth UI is rebuilt with Vuetify (`v-card`, `v-text-field`, `v-btn`, `v-alert`), labels and helper affordances are present, loading state is wired, and the unauthenticated container remains simple and centered. Minor polish is suggested around validation messaging, focus management on errors, and avoiding duplicate feedback.

### Plan adherence
- Auth UI (`src/components/AuthForm.vue`)
  - Switched to `v-card` layout with title/subtitle for context. OK.
  - Inputs use `v-text-field` with explicit `label`, email/password types, and a password visibility toggle. OK.
  - Feedback uses `v-alert` with `aria-live="polite"`. OK.
  - Primary submit `v-btn` is block, disabled while loading, shows progress; secondary `v-btn` toggles modes. OK.
  - State and behavior (`email`, `password`, `mode`, `isLoading`) preserved. OK.
- App container (`src/App.vue`)
  - Unauthenticated view shows a neutral background and centers the content. OK.
  - Flow unchanged; auth screen appears when there is no session. OK.
- Optional layout wrapper (`src/components/AuthLayout.vue`)
  - Not introduced; acceptable per plan (optional).

### Potential issues / risks
- Duplicate feedback channels
  - Errors are surfaced via both `v-alert` and a toast (`showErrorToast`). This can feel repetitive. Consider choosing one primary channel for auth errors (inline `v-alert` is typically sufficient).
- Accessibility: focus management
  - On submit failure, the first invalid field is not focused programmatically. Add focus management to improve keyboard/screen-reader flows.
- Validation messaging
  - Fields are `required`, but no explicit `rules` are provided. Vuetify `rules` can show concise, consistent messages without relying on browser defaults.
- Icon availability
  - Inputs reference `mdi-` icons. Ensure the app’s Vuetify icon set includes MDI so these render in all environments.

### Minor polish
- Avoid nested full-height containers
  - `App.vue` wraps the unauthenticated view in a full-height container; `AuthForm.vue` also adds `min-h-screen`. Keeping the parent responsible for height/centering reduces nested `100vh` wrappers.
- Small UX nits
  - Add `autofocus` on the email field in the initial mode.
  - Consider dynamic `autocomplete` for password: `current-password` for sign-in, `new-password` for sign-up.

### Acceptance criteria
- Convert auth UI to Vuetify components and improve layout/spacing. ✅
- Primary/secondary buttons with clear labels; loading state on submit. ✅
- Replace inline feedback with `v-alert` and `aria-live`. ✅
- Maintain existing auth logic and state; no backend changes. ✅
- Unauthenticated container uses neutral background and centers content. ✅
- Accessibility improvements: labels present ✅; first-invalid focus ◻️ (add programmatic focus).

### Suggested minimal edits (non-blocking)
1) Focus first invalid field on failed submit
   - `src/components/AuthForm.vue`: add `ref` to the email and password fields; on error/invalid, `nextTick(() => emailRef?.focus())` (or password as appropriate).
2) Add Vuetify `rules` for concise validation
   - Email: presence + basic email shape; Password: presence + minimal length.
3) Streamline feedback channel
   - Prefer inline `v-alert` for auth errors; remove the toast call or limit to unexpected exceptions.
4) Avoid nested `min-h-screen`
   - Let `App.vue` own the full-height centering; remove the inner `min-h-screen` wrapper from `AuthForm.vue`.
5) Optional: add a "Forgot password?" text button
   - Non-blocking link/button beneath actions that emits an event for future wiring.
6) Confirm icon set
   - Verify MDI is configured in Vuetify so `mdi-email`/`mdi-eye` variants render reliably.

No blockers; safe to ship after the above small refinements.

