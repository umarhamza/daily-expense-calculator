## 0006 Review — Chat page, PWA installability, currency symbol “D”, and autocomplete UX

### 1) Plan implementation status
- **ChatPage.vue**: Implemented as a standalone page mirroring `ChatModal.vue` logic without `v-dialog`. Preserves message list, input row, Send button, and STT mic flow via `useSpeechToText`. Emits `added` when backend adds items. Header shows "Chat" and content is scrollable.
- **App.vue**: Adds `'chat'` to the view switch and renders `ChatPage` directly. Removes modal handling. Wires `@added` to refresh data and aligns props (`currency`, `currencySymbol`). Fetches profile on mount and applies `currency` and `currency_symbol` to state.
- **BottomNav.vue**: Chat tab navigates to `'chat'` view via `emit('navigate', 'chat')`.
- **ChatModal.vue**: Still present but effectively deprecated; logic mirrors `ChatPage`. Kept for transition as planned.
- **AddExpenseModal.vue**: Switched to `v-combobox` with suggestions and disabled auto-select-first. Keeps free-form entry and Enter submits typed value; emitted payload remains `{ item, cost, date }`.
- **SettingsPage.vue**: Adds display symbol input with quick picks including `D`, validation (1–4 chars), and independent persistence of `currency` and `currency_symbol`. Uses toasts and updates localStorage.
- **src/lib/supabase.js**: `getProfile`/`updateProfile` include `currency_symbol`. Update falls back to insert when missing. Shapes remain flat with snake_case fields.
- **src/lib/currency.js**: Adds `formatAmount(amount, { code, symbolOverride })` and retains `formatCurrency`. Handles symbol override by prefixing custom symbol, e.g., `D10.00`.
- **DayView.vue / MonthView.vue**: Use `formatAmount` when `currencySymbol` is set; otherwise use `formatCurrency`. Totals and list items updated.
- **PwaInstall.vue**: Improves UX/state: tracks `beforeinstallprompt` to enable install, emits `installed` on success, detects standalone via `(display-mode: standalone)`, and shows guidance when install isn’t available.
- **DB migration**: `supabase/migrations/20250827150000_profiles_add_currency_symbol.sql` adds nullable `currency_symbol` with length check (1–4). Comments included.

Conclusion: The feature appears implemented across UI, lib, and data layers per the plan.

### 2) Obvious bugs or issues
- **ChatPage import for stop icon**: `ChatPage.vue` uses `<component :is="isListening ? IconStop : IconMicrophone" />` but only imports `IconMicrophone`. Importing `IconStop` is required to avoid a runtime reference error.
- **Profiles insert under RLS (carry-over risk)**: `updateProfile()` inserts when no row exists. Without an INSERT RLS policy on `profiles`, legacy users might be blocked on first save. If the project already added this policy in an earlier migration, this is fine; otherwise, add it.

### 3) Data alignment checks
- **Shapes**: UI <-> lib use snake_case (`display_name`, `currency`, `currency_symbol`). Flat objects, no nested `{ data: { ... } }` returns in UI.
- **Amount formatting**: Consumers pass `{ code: currency, symbolOverride: currency_symbol }`. Fallback to `formatCurrency` when override is empty; displays as `D10.00` when `D` used.

### 4) Over-engineering / file size
- Changes are scoped and follow existing patterns. No unnecessary abstractions. `ChatModal.vue` kept for transition, which is acceptable short-term.

### 5) Style/syntax consistency
- Matches repo rules: Vue 3 `<script setup>`, Composition API, `@/` alias, Tailwind/Vuetify usage. Library functions throw/return errors with UI handling via toasts.

### Actionable follow-ups
1. **Fix missing import in `ChatPage.vue`**:
   - Add `import IconStop from './icons/IconStop.vue'` to align with usage.
2. **Profiles INSERT policy (if not already present)**:
   - Add an RLS policy to allow users to insert their own profile row: `for insert with check (auth.uid() = user_id)`.
3. Optional: Add a brief note in `SettingsPage.vue` helper text that empty symbol will use the ISO currency’s default symbol.
4. Optional PWA hardening: On mount, use `{ once: true }` for both `beforeinstallprompt` and `appinstalled` to avoid multiple bindings if the component remounts frequently.

### Verification checklist
- Chat page:
  - BottomNav Chat opens full page (no dialog).
  - Messaging flow works; STT mic toggles; `added` emitted updates parent.
  - No console errors from undefined `IconStop`.
- PWA:
  - Install button enabled when eligible; installs successfully; installed state is detected; guidance shows when not eligible.
- Currency "D":
  - Settings saves `currency_symbol` with validation; `D` selection renders as `D10.00` across Day/Month totals and rows.
  - DB continues enforcing 3-letter `currency` and 1–4 char `currency_symbol`.
- Add Item modal:
  - `v-combobox` allows free text; suggestions don’t auto-select; Enter preserves typed text; emitted payload unchanged.

### Risks / notes
- If no `profiles` INSERT policy exists, settings updates may fail for legacy users under RLS.
- Custom symbol rendering relies on replacing the leading currency sign from Intl output; locale-specific formats are handled, but edge locales may vary. The fallback still produces a readable prefix.

### Verdict
- **Plan implemented correctly overall. One bug to fix**: import `IconStop` in `ChatPage.vue`. Also ensure an INSERT RLS policy exists for `public.profiles` to handle first-time saves where a profile row is missing.

