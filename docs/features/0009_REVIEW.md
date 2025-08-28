## Feature 0009 — Code Review

### Summary
Implementation aligns with the plan: the Install CTA is mobile-only, desktop shows no CTA or guidance, iOS Safari receives an inline Add to Home Screen tip, and listeners are conditionally attached. Settings integrates `<PwaInstall />` without desktop prompts. PWA config remains unchanged. A couple of optional robustness tweaks are suggested below (iPadOS/iOS standalone detection).

### Plan adherence
- PWA install component (`src/components/PwaInstall.vue`)
  - Mobile detection added via UA regex; `isMobile` and `isIOS` refs set on mount. OK.
  - `beforeinstallprompt` and `appinstalled` listeners are attached only when `isMobile && !isStandalone`. OK (BIP listener uses `{ once: true }`).
  - Install button renders only when `isMobile && canInstall`. OK.
  - iOS Safari guidance: inline tip "On iOS, use Share → Add to Home Screen." shown when BIP won’t fire. OK.
  - Non‑iOS mobile without BIP: inline caption "Install not available yet in this browser. Try again later." OK.
  - Desktop renders no CTA or guidance; standalone shows success alert. OK.
- Settings page (`src/components/SettingsPage.vue`)
  - Embeds `<PwaInstall />`; behavior inherits mobile-only rules. No extra desktop encouragement. OK.
- PWA config (`vite.config.js`)
  - No changes to registration or manifest. OK.

### Potential issues / risks
- iPadOS UA edge cases
  - Newer iPadOS Safari can present a desktop‑class UA (e.g., "Macintosh") with touch support, which may bypass current `isIOS` check. This would suppress the iOS guidance.
- Standalone detection on iOS
  - `matchMedia('(display-mode: standalone)')` may not reliably detect iOS Safari standalone. A `navigator.standalone === true` fallback is often needed.
- Empty container on desktop
  - The Settings "PWA" section renders an empty area on desktop (no CTA/guidance). This is harmless but could be optionally collapsed for polish.

### Acceptance criteria
- Desktop browsers show no Install button or guidance; standalone still shows the success alert. ✅
- Android Chrome (mobile) shows Install button only when BIP fires and installs successfully. ✅
- iOS Safari (mobile) shows concise Add to Home Screen tip, not a button. ✅
- Success toast and `installed` event continue to work. ✅

### Suggested minimal edits (non‑blocking)
1) Broaden iOS/iPadOS detection
   - Consider: `const isiPadOSDesktopUA = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1`
   - Then `isIOS.value = /iPad|iPhone|iPod/i.test(ua) || isiPadOSDesktopUA`
   - Ensures iPadOS with desktop UA gets the iOS guidance.
2) Add iOS standalone fallback
   - When setting `isStandalone`: also check `window.navigator.standalone === true`.
   - Example: `isStandalone.value = mq.matches || window.navigator.standalone === true`
3) Optional UI polish
   - In `SettingsPage.vue`, hide the PWA section on desktop by guarding `<PwaInstall />` with a top‑level mobile check to avoid empty space.

No blockers; feature matches the plan and is safe to ship with the above small robustness improvements.

