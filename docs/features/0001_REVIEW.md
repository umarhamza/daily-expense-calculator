## 0001 Review - Vuetify Install and Today Tab MVP

### 1) Plan implementation status
- Vuetify packages present in `package.json` (`vuetify`, `vite-plugin-vuetify`, `sass`, `@mdi/font`).
- `vite.config.js` includes `vite-plugin-vuetify` and `transformAssetUrls` passed to Vue plugin.
- `src/plugins/vuetify.js` created with MDI icon set; `src/main.js` registers Vuetify.
- `src/App.vue` wrapped with `<v-app>`.
- Today tab (component `src/components/DayView.vue`) and modals (`AddExpenseModal.vue`, `EditExpenseModal.vue`) are not yet converted to Vuetify components. This remains pending.

Conclusion: Bootstrap work complete. Today tab UI conversion pending.

### 2) Obvious bugs or issues
- None observed in config files. App may compile but styling could be mixed (Tailwind + Vuetify) until components are converted. Acceptable per scope.

### 3) Data alignment checks
- Data layer functions (`src/lib/supabase.js`) unchanged; shape `{ id,item,cost,date,created_at }` consistent with existing `DayView.vue` logic. No snake/camel mismatches found.
- Modals and list still rely on Tailwind classes; no data shape change introduced by Vuetify setup.

### 4) Over-engineering / file size
- New plugin file `src/plugins/vuetify.js` is minimal and appropriate.
- `vite.config.js` change is scoped and standard. No over-engineering.

### 5) Style/syntax consistency
- Project uses Vue 3 `<script setup>`, functional pattern; the Vuetify plugin adheres to this.
- `App.vue` now contains a Vuetify root element while rest of app retains Tailwind utilities. Mixed usage is acceptable during migration, but plan states Today tab should use only Vuetify components.

### Actionable follow-ups
- Convert `src/components/DayView.vue` template to Vuetify components only:
  - Header: `v-row`/`v-col`, `v-btn` ("Today").
  - Loading: `v-skeleton-loader` (list style) or repeated skeleton rows.
  - List: `v-list` with `v-list-item`, `v-divider` between items; tap to open edit.
  - Empty state: `v-alert` with neutral tone.
  - Total row: `v-row` with bold text; show skeleton when loading.
  - FAB: `v-btn` with `icon="mdi-plus"`, `color="primary"`, `class="position: fixed"` using Vuetify utility or style bindings.
- Convert `AddExpenseModal.vue` to `v-dialog` + `v-card` with `v-text-field`/`v-autocomplete`, `v-btn` actions.
- Convert `EditExpenseModal.vue` similarly with validation disabling Save button.
- Ensure no other tabs or components are modified.
- Build and run to verify visually and functionally that only Today tab changed.

### 6) Verification checklist
- Dependencies and config match plan:
  - `package.json` contains Vuetify deps; `vite.config.js` uses `vite-plugin-vuetify` with `transformAssetUrls`.
  - `src/plugins/vuetify.js` includes MDI icon set; `src/main.js` registers Vuetify.
  - `src/App.vue` wraps app with `<v-app>`.
- Runtime sanity checks:
  - `npm run dev` launches without compile errors; no runtime console errors.
  - Login/auth flow still renders; PWA registration remains active.
  - Today tab UI unchanged for now (Tailwind), pending conversion.
- Build sanity:
  - `npm run build` succeeds without errors or warnings beyond expected Vuetify/Tailwind info.

### 7) Risks / notes
- Mixed Tailwind + Vuetify styles may look slightly inconsistent until Today tab and modals are converted.
- Keep Vuetify usage scoped to Today tab for this MVP to avoid regressions elsewhere.
- Watch for CSS reset interactions (Tailwind preflight vs Vuetify styles) when converting components; address locally in component scopes if needed.