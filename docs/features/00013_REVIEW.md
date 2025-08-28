## Feature 00013 — Code Review: PWA install UX update

### Summary
Implementation aligns with the plan: all native install prompt code is removed, the PWA button opens a modal with platform-specific instructions, and a small platform detection utility powers auto-selection with a manual override. Accessibility is reasonable via `v-dialog`. Only minor polish is suggested (utility usage and a small robustness tweak to installed detection).

### Plan adherence
- Remove install-related code
  - No references to `beforeinstallprompt`, `deferredPrompt`, `.prompt()`, or `.userChoice` in `src/`. ✅
- Modal-based instruction flow
  - `src/components/PwaInstallModal.vue` exists and is opened from `PwaInstall.vue` via `v-model`. ✅
  - Modal includes close control, ARIA label, and instruction content. ✅
- Platform detection utility
  - `src/lib/platform.js` provides `detectPlatform()` returning `{ os, browser, isIos, isAndroid, isDesktop }`. ✅
- Replace PWA button click handler
  - `src/components/PwaInstall.vue` toggles `showModal` to open instructions rather than triggering native prompts. ✅
- Instruction content mapping and manual picker
  - Platform/browser keyed mapping implemented with `options` and conditional blocks; `autoSelect()` sets the initial view; a compact picker allows manual override. ✅
- Non-goals preserved
  - Service worker and manifest untouched; no caching strategy changes observed. ✅

### Potential issues / risks
- Installed-state reactivity
  - `PwaInstall.vue` computes `isStandalone` on mount only. After a fresh install from the browser UI, the alert may not reflect the new state until reload. Consider listening to `(display-mode: standalone)` media query `change` to update reactively.
- Inline style usage
  - `style="gap: 8px"` is used in `PwaInstall.vue`. Prefer utility classes for consistency with the codebase’s utility-first approach.
- Instruction coverage longevity
  - Browser UI labels can evolve. The current text is accurate today; revisit periodically to keep instructions fresh.

### Minor polish
- Replace inline `style="gap: 8px"` with a utility (e.g., `gap-2`) on the button row.
- In `PwaInstallModal.vue`, add an `aria-labelledby` on the dialog tied to the title element’s `id` to strengthen semantics, though `aria-label` is already present.
- Optionally render the currently selected platform label near the chips for clarity when a manual override is chosen.

### Acceptance criteria
- PWA button no longer triggers native prompt/BIP flow. ✅
- Modal opens reliably and displays detected platform instructions. ✅
- Users can manually switch platform instructions. ✅
- No references to `beforeinstallprompt`, `deferredPrompt`, or `.prompt()` remain in code. ✅
- Service worker/manifest unaffected. ✅

### Suggested minimal edits (non-blocking)
1) Make installed detection reactive
   - In `src/components/PwaInstall.vue`, subscribe to `matchMedia('(display-mode: standalone)')` `change` and update `isStandalone` on events.
2) Align spacing utilities
   - Replace inline `gap: 8px;` with an appropriate spacing utility for consistency with existing patterns.
3) Modal a11y enhancement (optional)
   - Tie the dialog to the title with `aria-labelledby` and an `id` on the title span; keep the close button’s `aria-label`.

No blockers; safe to ship as-is. The above refinements improve consistency and resilience without altering behavior.

