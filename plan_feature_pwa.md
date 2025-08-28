## Feature Plan: PWA install UX update

### Summary
Remove in-app PWA installation code. On clicking the PWA button, open a modal with install instructions tailored to the current browser and device (iOS/Android).

### User request (verbatim)
- okay please remove all the code related to installing pwa when you click the pwa button it should open a model showing instructions on how to install the pwa for that browser and iOS or Android device

### Goals
- Replace the direct/native install flow with an instruction-first modal.
- Detect platform and browser to show accurate steps (with a manual picker as fallback).
- Keep manifest, service worker, and icons intact; remove only install/prompt-related code.

### Non-goals
- Changing caching strategy or the service worker runtime behavior.
- Modifying the app manifest, icons, or PWA eligibility.

### UX and Interaction
- The existing PWA button opens a modal instead of attempting installation.
- Auto-detect platform/browser to show relevant instructions, with a tab/dropdown to switch platforms manually.
- Modal includes concise steps, small illustrative icons, and a link to learn more.
- Accessible: focus trap, Escape to close, overlay click to dismiss, ARIA roles/labels.

### Technical Plan
1) Remove install-related code
   - Delete listeners/usages of `beforeinstallprompt`, any `deferredPrompt` storage, `.prompt()` and `.userChoice` calls.
   - Remove install banners or snackbars that trigger native prompts.
   - Keep service worker registration and manifest unchanged.

2) Add a modal-based instruction flow
   - Create `src/components/PwaInstallModal.vue`.
   - Add a small platform detection utility: `src/lib/platform.js` that returns `{ os, browser, isIos, isAndroid, isDesktop }`.
   - Replace the PWA button's click handler to open the modal (`isOpen` state via parent or a store-free local state).

3) Instruction content mapping
   - Maintain a map keyed by platform/browser to render the correct steps.
   - Provide a safe fallback when detection is uncertain.

### Platform-specific Instruction Drafts
- iOS (Safari)
  1. Tap the Share button.
  2. Choose “Add to Home Screen”.
  3. Confirm the name and tap Add.

- iOS (Chrome, Firefox, Edge)
  - iOS restricts Add to Home Screen to Safari. Show:
    - “Open this page in Safari, then use Share → Add to Home Screen.”

- Android (Chrome, Edge, Brave, Opera)
  1. Open browser menu (⋮).
  2. Tap “Install app” or “Add to Home screen”.
  3. Confirm the install.

- Android (Firefox)
  1. Open browser menu.
  2. Tap “Add to Home screen”.
  3. Confirm the add.

- Desktop (Chrome/Edge/Brave)
  1. Click the Install icon in the address bar (if visible), or open browser menu.
  2. Choose “Install app”.
  3. Confirm.

- Desktop (Safari on macOS)
  1. File → Add to Dock… (macOS Sonoma+), or “Share → Add to Dock”.
  2. Confirm the app name and Add.

- Desktop (Firefox)
  - Firefox desktop has limited PWA install support; advise using Chrome/Edge for installation, or use bookmarks.

### Acceptance Criteria
- PWA button no longer triggers any native prompt or `beforeinstallprompt`-driven flow.
- Modal opens reliably and displays instructions tailored to detected platform.
- Users can manually switch platform instructions.
- No references to `beforeinstallprompt`, `deferredPrompt`, or `.prompt()` remain in code.
- Service worker, manifest, and PWA eligibility are unaffected.

### QA Checklist
- iOS Safari: shows correct A2HS steps; no native prompt triggered by app code.
- iOS Chrome/Firefox: shows “Open in Safari” guidance.
- Android Chrome/Edge: shows correct Install/Add to Home Screen steps.
- Android Firefox: shows correct Add to Home Screen steps.
- Desktop Chrome/Edge: shows address bar install steps.
- Desktop Safari: shows Add to Dock steps on supported versions.
- Desktop Firefox: shows limitations message.

### Telemetry (optional)
- Track: PWA button clicked, modal opened, platform detected, manual platform tab viewed.
- Use privacy-safe, non-identifying events.

### Rollout
- Straight replacement (no flag) if current install prompt usage is minimal.
- If risk-averse, hide behind an env-driven feature flag for quick rollback.

