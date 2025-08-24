# Daily Expense Tracker (MVP)

Tech: Vue 3 + Vite, TailwindCSS, VueUse. Supabase client is stubbed for now.

## BMAD-METHOD Integration

BMAD-METHOD is installed via `.bmad-core/` and Cursor rules at `.cursor/rules/bmad`. See `.bmad-core/user-guide.md`.

### Commands

```bash
# Install/Update BMAD core and agents
npm run bmad:install
npm run bmad:update

# Flatten codebase for AI review
npm run bmad:flatten
```

### Workflow Folders

- `docs/stories/`: Sharded user stories used by SM/Dev/QA agents
- `docs/qa/assessments/`, `docs/qa/gates/`: QA outputs and gates

### CI (optional)

Add a job that can run the flattener for artifacts or checks:

```yaml
name: BMAD Utilities
on: [workflow_dispatch]
jobs:
  flatten:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm ci
      - run: npm run bmad:flatten
      - uses: actions/upload-artifact@v4
        with:
          name: flattened-codebase
          path: flattened-codebase.xml
```

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## TailwindCSS

Configured via `tailwind.config.js` and `postcss.config.js` using `@tailwindcss/postcss`.

## Environment Variables (for Supabase)

Create a `.env` file with:

```

```

The client is initialized in `src/lib/supabase.js` and data queries are stubbed.

## Features

- Bottom navigation (Day, Month, Chat)
- Day view: add expenses, see total
- Month view: grouped totals by item (placeholder data)
- Swipe between Day and Month (VueUse `useSwipe`)
- Floating + button to add an expense
- Simple Chat modal placeholder

## Next Steps

- Wire Supabase CRUD for expenses and autocomplete
- Add Auth via Supabase
- Persist/Cache with local storage for offline-first
