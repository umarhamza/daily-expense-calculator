## 0005 Review — Settings Page: username, password, currency, and PWA install button

### 1) Plan implementation status
- **SettingsPage.vue**: Exists with sections for Profile (display name), Security (password), Preferences (currency), and PWA. Uses toast helpers for feedback; no emits; calls lib functions directly. Validation matches plan (display name trim/1–64, password >= 6 and confirm, currency from vetted list).
- **PwaInstall.vue**: Encapsulates install prompt lifecycle. Listens to `beforeinstallprompt` (stores deferred event + enables button), calls `prompt()` and respects `userChoice`, listens to `appinstalled`, and hides button when installed. Shows a success toast. Detects standalone mode via `matchMedia('(display-mode: standalone)')` and shows an installed alert.
- **src/lib/currency.js**: Provides `formatCurrency(amount, currencyCode)` with non-finite guard and Intl.NumberFormat; `getDefaultCurrency()` reads from `localStorage` or defaults to `USD`.
- **App.vue**: Adds `'settings'` to view switcher and renders `SettingsPage` when selected. Maintains auth/session. On mount, fetches `profiles` and applies `currency` to state using `getDefaultCurrency()` as initial value. Passes `currency` to `DayView` and `MonthView` via prop.
- **BottomNav.vue**: Adds a Settings button (order: Day, Month, Chat, Settings) and emits `navigate('settings')`.
- **DayView.vue / MonthView.vue**: Accept `currency` prop and replace hardcoded prefix with `formatCurrency(...)` for list items and totals.
- **src/lib/supabase.js**: Adds helpers `getCurrentUser()`, `getProfile(userId)`, `updateProfile(userId, partial)`, and `updateUserPassword(newPassword)` as specified. `updateProfile` attempts update first, then insert if missing.
- **DB migration**: `supabase/migrations/20250827130000_profiles.sql` creates `public.profiles` with checks/defaults, adds `set_updated_at` trigger, enables RLS with select/update policies, and adds `handle_new_user()` trigger (security definer) on `auth.users` to auto-insert profiles. Matches plan.

Conclusion: The feature appears implemented according to the plan across UI, lib, and migration layers.

### 2) Obvious bugs or issues
- **Profiles insert under RLS**: `updateProfile()` falls back to `.insert(...)` when no row exists. The migration does not include an `INSERT` policy, so this insert will be blocked by RLS for existing users created before the migration (who lack a profile row). New sign-ups are covered by the trigger. This can surface as a failure when saving display name or currency for legacy users.
- Minor: `PwaInstall.vue` does not emit the optional `installed` event mentioned in the plan. Functionally fine since it updates UI state and shows a toast.

### 3) Data alignment checks
- **Shapes**: UI and lib consistently use snake_case for profile fields (`display_name`, `currency`) and flat objects. Supabase expense APIs continue to use `user_id` and flat rows.
- **Return envelopes**: Lib functions return `{ data, error }` or `{ error }`; UI checks `.error` and toasts via `showErrorToast`. No `{ data: { data: ... } }` nesting or camel/snake mismatches observed.

### 4) Over-engineering / file size
- Implementations are small and focused. No unnecessary abstractions. Changes to views are localized.

### 5) Style/syntax consistency
- Matches project conventions: Vue 3 `<script setup>`, Composition API, `@/` imports, declarative templates, Tailwind utility classes where applicable, and Vuetify components. Errors thrown/returned in `src/lib`, with messaging surfaced in UI via toasts.

### Actionable follow-ups
1. **Add an INSERT RLS policy for profiles** so legacy users can create their row on first save:
   - Policy example: `for insert with check (auth.uid() = user_id)`.
   - Alternatively, use an Edge Function with service role to upsert profiles, but a scoped insert policy is simpler and sufficient.
2. Update `updateProfile()` to use `.upsert({ onConflict: 'user_id' })` if desired. Note: This still requires the insert policy above under RLS.
3. Optionally emit `installed` from `PwaInstall.vue` after successful install to allow parents to react (the plan mentioned this as optional).
4. After password update, show a brief note that re-login may be required per Supabase policies to set user expectations.
5. Optional PWA hardening: On mount, add a one-time listener (`{ once: true }`) for `beforeinstallprompt` to avoid multiple assignments, and consider `navigator.standalone` for iOS installed detection.

### Verification checklist
- Settings page:
  - Display name validation (trim, 1–64) and save success toast.
  - Password update requires min length and matching confirmation; success toast appears.
  - Currency select restricted to known codes; persists to `localStorage` and DB; reflected in Day and Month views.
  - PWA install button enabled when installable; prompts and hides after accepted; shows installed alert when in standalone.
- App integration:
  - `currentView` toggles include `settings` via `BottomNav`.
  - `currency` flows from `getDefaultCurrency()` then profile fetch override.
- DB:
  - New users receive a `profiles` row via `auth.users` trigger.
  - Legacy users can create a row on first save (after adding insert policy).

### Risks / notes
- Without an insert policy, legacy accounts will fail to save settings due to RLS. Addressing this is the only blocking concern.
- PWA install event timing varies by browser; current logic should handle both prompt and already-installed states.
- `localStorage` currency is a UI optimization; DB remains the source of truth as intended.

### Verdict
- **Plan implemented correctly overall. One important follow-up is required**: add an `INSERT` RLS policy for `public.profiles` (or alternative secure upsert path) to ensure settings save correctly for all users. Other items are minor improvements.

