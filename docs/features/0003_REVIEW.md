## 0003 Review — Modernize Modals with Vuetify and Tighten Layout Padding

### Summary
- Implementation largely matches the plan. All three modals are migrated to Vuetify (`v-dialog` + `v-card`). Layout padding in `src/App.vue` is tightened, and Logout is a `v-btn`.
- Build completes cleanly with Vuetify plugins configured.

### Implementation Conformance
- `src/plugins/vuetify.js`
  - Defaults present: `VBtn` density comfortable + rounded, `VTextField` density comfortable/outlined, `VDialog` transition, `VCard` rounded. Matches plan intent.
- `src/App.vue`
  - Main container reduced from `px-4 pt-4` to `px-3 pt-3`. Logout converted to small text `v-btn` in top-right. Meets plan.
- `src/components/AddExpenseModal.vue`
  - Uses `v-dialog` + `v-card`. `v-autocomplete` for item and `v-text-field` for cost with `inputmode="decimal"`. Emits `save({ item, cost, date })` and `close`. Save disabled until valid. Matches plan.
- `src/components/EditExpenseModal.vue`
  - Uses `v-dialog` + `v-card`. Inputs via `v-text-field` including `type="date"` for date. Actions: Save (primary), Delete (outlined error), Cancel (text). Emits preserved. Matches plan.
- `src/components/ChatModal.vue`
  - Uses `v-dialog` + `v-card`. Messages in scrollable `v-sheet`. Input row with `v-text-field` and `v-btn`; error surfaced via `v-alert`. Emits `close`, `added`. Matches plan.
- References: `src/lib/useKeyboardBottomOffset` and `src/lib/useBodyScrollLock` remain in `src/lib`, not referenced by modals. Acceptable per plan note; can remove in a follow-up.

### QA & Build
- `vite build` succeeds with Vuetify plugin configured in `vite.config.js` and Vuetify app wiring in `src/main.js`.
- Dialog behaviors wired: `:model-value` + `@update:model-value` emit `close` on backdrop/ESC; close icon emits `close`.

### Issues / Observations
1. Validation edge case in Add modal
   - Cost parsing uses `Number.parseFloat`. Inputs like `"3."` or locale commas will be treated as NaN; acceptable but consider trimming and enforcing a simple regex if user base expects commas.
2. Minor UX consistency
   - Add modal lacks an explicit Cancel button in actions (Edit has Cancel). Not required by plan, but consistent actions could help UX and accessibility.
3. Chat error handling
   - Both an inline `v-alert` and `showErrorToast` are triggered on error. Duplicated messaging may feel noisy. Consider choosing one surface (inline preferred while dialog is open), while keeping toasts for global errors.
4. Data alignment
   - Supabase layer and views use consistent snake_case column names (`user_id`) and flat objects. Payload shapes from modals match expectations (`{ item, cost, date }` and `{ id, item, cost, date }`). No alignment issues found.
5. Unused utilities
   - `useKeyboardBottomOffset` and `useBodyScrollLock` are no longer used post-migration. Safe to remove to reduce bundle size and surface area.
6. Density/padding
   - `v-card-text` uses `pt-0` class to tighten spacing; overall density aligns with plan. If further tightening is desired, consider adding `class="py-3 px-4"` selectively per plan rather than global defaults to avoid regressions.

### Recommendations
- Optional: Add a Cancel button to `AddExpenseModal` actions for parity with Edit.
- Optional: Consolidate Chat error display to inline `v-alert` and suppress toast while dialog is open.
- Optional cleanup: Remove `src/lib/useKeyboardBottomOffset.js` and `src/lib/useBodyScrollLock.js` if confirmed unused elsewhere.
- Optional: Add simple numeric validation with a rule (e.g., `/^\d+(?:[. ]?\d+)?$/`) if input ambiguity reports arise.

### Verdict
- The plan appears correctly implemented with no blocking bugs found. Only minor UX and cleanup suggestions above.