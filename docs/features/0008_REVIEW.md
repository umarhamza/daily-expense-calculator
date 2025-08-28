## Feature 0008 — Code Review

### Summary
Implementation closely follows the plan. ISO currency code paths were removed, a single symbol input is used, formatting is symbol-prefixed decimal, and DB migration drops `profiles.currency`. A few small improvements are suggested below.

### Plan adherence
- Settings UI (`src/components/SettingsPage.vue`)
  - Currency dropdown/options removed; single symbol text field present with 1–4 char validation.
  - `loadProfile()` uses only `currency_symbol`.
  - `saveSymbol()` persists `currency_symbol`, removes stale `localStorage['currency']`, and stores/removes `currency_symbol` locally. OK.
- App state (`src/App.vue`)
  - No `getDefaultCurrency`; no `localStorage.currency` reads/writes.
  - Tracks only `currencySymbol` and passes to children. OK.
- Amount display
  - `DayView.vue` / `MonthView.vue` accept only `currencySymbol` and use `formatAmount(amount, { symbolOverride })`. OK.
- Currency utilities (`src/lib/currency.js`)
  - Replaced with `formatAmount` using decimal `Intl.NumberFormat`. OK.
- Supabase layer (`src/lib/supabase.js`)
  - `getProfile` selects `currency_symbol` only; `updateProfile` supports any provided partial including `currency_symbol`. Minor doc fix noted below.
- Database schema
  - Migration `20250828100000_profiles_drop_currency.sql` drops `profiles.currency`. OK.
- Leftovers check
  - No usages of `getDefaultCurrency`/`formatCurrency` found. OK.

### Potential issues / risks
- Numeric aggregation may coerce to string
  - Postgres `numeric(12,2)` can be returned as string by PostgREST. In reducers/sums, adding strings leads to concatenation.
  - Instances:
    - `DayView.vue`: `expenses.reduce((s, e) => s + e.cost, 0)`
    - `MonthView.vue`: `bucket.sum += e.cost`
  - Recommendation: coerce to number at usage sites or normalize results when fetching.
    - Example fixes:
      - In `DayView.vue` total: `s + Number(e.cost || 0)`
      - In `MonthView.vue` grouping: `bucket.sum += Number(e.cost || 0)`

### Minor polish
- Avoid passing unused prop
  - `App.vue` passes `:currencySymbol` to all dynamic pages. `SettingsPage` and `ChatPage` don’t declare this prop, which can trigger Vue’s extraneous-prop warnings in dev.
  - Suggestion: pass `currencySymbol` only to `DayView` and `MonthView` cases.
- Docstring accuracy in Supabase lib
  - `updateProfile` JSDoc still references `currency?`; should be `{ display_name?, currency_symbol? }`.

### Acceptance criteria
- Settings shows a single symbol input; no dropdown. ✅
- Database has no `profiles.currency` column. ✅ (migration present)
- No imports/usages of `getDefaultCurrency` or `formatCurrency`. ✅
- All amount displays use symbol-only decimal formatter. ✅

### Suggested minimal edits (non-blocking)
1) Numeric coercion
   - `src/components/DayView.vue`: coerce `e.cost` to number in `total` reducer.
   - `src/components/MonthView.vue`: coerce in `bucket.sum += Number(e.cost || 0)`.
2) Limit prop passing in `App.vue`
   - Only pass `:currencySymbol` for `DayView` and `MonthView` to avoid extraneous props on other pages.
3) Update JSDoc
   - `src/lib/supabase.js` `updateProfile` doc to mention `currency_symbol` instead of `currency`.

No blockers; the feature is safe to ship with the above small refinements.


