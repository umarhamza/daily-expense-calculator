# Daily Expense Tracker (MVP)

Tech: Vue 3 + Vite, TailwindCSS, VueUse. Supabase client is stubbed for now.

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
VITE_SUPABASE_URL=your-url
VITE_SUPABASE_ANON_KEY=your-key
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
