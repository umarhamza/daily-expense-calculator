# Product Brief — Daily Expense Tracker

## Project overview / description
A mobile‑first web app to quickly record daily expenses and visualize monthly totals. The MVP focuses on ultra‑fast entry (autocomplete, floating + button), swipe navigation between Day and Month views, and a lightweight chat assistant for simple insights. Data is backed by Supabase (Postgres) with a clear path to auth and offline caching.

## Target audience
- Individuals tracking personal spending with minimal overhead
- Students and freelancers needing quick capture and simple summaries
- Mobile‑first users who prefer a snappy, app‑like web experience

## Primary benefits / features
- Fast capture: inline add, autocomplete for items, floating + button
- Day view: list expenses and show daily total
- Month view: grouped totals by item with simple summaries
- Swipe navigation between Day and Month (mobile‑friendly)
- Chat assistant for quick Q&A on spend patterns (Gemini API)
- Supabase‑backed storage; auth and cross‑device sync planned
- Offline‑first caching planned (local storage) for resiliency

## High‑level tech/architecture used
- Frontend: Vue 3 (Composition API, <script setup>) + Vite 7, TailwindCSS 4, VueUse
- Data: Supabase (Postgres). Client in src/lib/supabase.js with CRUD and autocomplete helpers
- Auth: Supabase Auth (planned: magic link, email/password, OAuth)
- Hosting/Runtime: Netlify or Vercel; Bun‑compatible toolchain
- Project structure: UI in src/components; data‑access/utilities in src/lib; alias @ → src; functional, declarative style