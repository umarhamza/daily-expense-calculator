# 📱 Daily Expense Tracker — Vue + Tailwind + Bun + Supabase

## 🔹 Core Features (unchanged from your plan)

✅ Day View
✅ Month View
✅ Autocomplete with Supabase
✅ Chatbot integration (OpenAI API)
✅ Swipe navigation
✅ Floating **+** button

---

## 🔹 UI / UX Design (Vue version)

* **Bottom Navigation Bar**

  * Use a `<nav>` with flexbox and Tailwind classes.
  * Icons from Heroicons (or Lucide for Vue).

* **Day View**

  * Header with date + conditional **Today** button.
  * `v-for` loop for expense items.
  * Add rows inline with input + autocomplete.

* **Month View**

  * Similar to Day View but grouped by item.
  * Use Vue computed properties for sums.

* **Swipe Navigation**

  * Use [VueUse’s `useSwipe`](https://vueuse.org/core/useSwipe/) for simple swipe gestures.

* **Autocomplete Input**

  * Use Headless UI’s **Combobox** component or build your own dropdown.
  * Query Supabase with debounce on input.

---

## 🔹 Tech Stack & Tools

* **Frontend** → Vue 3 (Composition API + `<script setup>`), TailwindCSS, VueUse (for gestures/utilities).
* **Database** → Supabase (Postgres).
* **Auth** → Supabase Auth (magic link, email/password, OAuth).
* **Hosting** → Vercel (Bun runtime) or Netlify.
* **Chatbot** → OpenAI Chat API.

---

## 🔹 Build Roadmap (Vue + Bun)

1. **Setup Project**

   ```bash
   bun create vue ./expense-tracker
   cd expense-tracker
   bun install
   ```

   * Add TailwindCSS (`bun add -D tailwindcss postcss autoprefixer`).
   * Add Supabase client (`bun add @supabase/supabase-js`).

2. **Database schema (Supabase)**

   ```sql
   create table users (
     id uuid primary key default gen_random_uuid(),
     email text unique not null
   );

   create table expenses (
     id uuid primary key default gen_random_uuid(),
     user_id uuid references users(id),
     item text not null,
     cost numeric(10,2) not null,
     date date not null default current_date
   );
   ```

3. **Day View**

   * Fetch expenses for the selected day from Supabase.
   * Display in a list with item + cost.
   * Floating + button to add new row.

4. **Month View**

   * Fetch all expenses for that month.
   * Use `reduce`/SQL `group by` to sum totals.

5. **Autocomplete**

   * On input, query Supabase:

     ```sql
     select distinct item 
     from expenses 
     where item ilike '%bread%'
     order by item;
     ```

6. **Gestures (Navigation)**

   * VueUse `useSwipe` to switch days/months with left/right gestures.
   * Show **Today** button when not on today.

7. **Chatbot Integration**

   * Floating button → opens chat modal.
   * Send structured expenses (JSON) to OpenAI API.
   * Example:

     ```js
     const response = await fetch("/api/chat", {
       method: "POST",
       body: JSON.stringify({ query: "How much do I spend on bread?", data: expenses })
     });
     ```

---

## 🔹 Future Upgrades (Vue tailored)

* **Pinia or Vuex** → for global state (selected day, expenses cache).
* **Offline-first** → use [localForage](https://localforage.github.io/localForage/) to cache locally and sync with Supabase.
* **Vue PDF export** → with `pdfmake` or `jspdf`.
* **Push notifications** → with OneSignal or Supabase Edge Functions.
