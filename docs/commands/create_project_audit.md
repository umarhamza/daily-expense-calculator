Short answer: almost. It’s structurally similar (concise, sectioned, technical), but to truly match your house style you should (a) specify the output file path, (b) explicitly exclude PM-style sections and any code, and (c) allow up to five clarifying questions before writing, just like your templates.   &#x20;

Here’s a tightened version that mirrors your attached files:

---

# Prompt: Project Technology & Structure Audit (match house style)

**Goal**
Inventory the technologies and structure of an existing codebase, matching the concise style of our internal plan/brief templates.

**Inputs**

* Repository or archive: `{REPO_URL_OR_PATH}`
* Scope hint (optional): `{SCOPE_NOTE}`

**Rules (house style)**

* Don’t include product-manager sections (no success criteria, timelines, migrations).
* Don’t write any code in the document.
* Ask up to **5** clarifying questions only if the repo is unclear; otherwise proceed.
* Be concise and precise.

**What to produce**
A single markdown doc saved to **`docs/PROJECT_AUDIT.md`** (unless a different path is specified) containing:

1. **Overview** (2–3 sentences)
2. **Technology Stack**

   * Languages/runtimes (versions if discoverable)
   * Frameworks/libs (frontend, backend, mobile)
   * Package managers & build tools
3. **Architecture & Modules**

   * App type (monolith/services; SPA/SSR/CSR; API style)
   * Layers/modules and responsibilities
4. **Project Structure (tree)**

   * Directory tree (depth 2–3) highlighting key folders
   * Entry points & routing approach
   * Workspaces/monorepo notes
5. **Data Layer**

   * DBs, ORMs/migrations; caching/queues/search
6. **Auth & Security**

   * Auth approach, roles/permissions, secrets management
7. **Tooling & Quality**

   * Test frameworks, linters/formatters; CI/CD & deployment targets
8. **Config & Environments**

   * Env vars, config files, environment conventions
9. **Integrations**

   * External APIs/SDKs/webhooks
10. **Local Quickstart**

    * Verified setup/run/test commands (quote exact scripts)
11. **Evidence (file paths)**

    * Bullet each claim with the file(s) you inspected (e.g., `package.json`, `*.csproj`, `pom.xml`, `requirements.txt`, `docker-compose.yml`, `appsettings.*.json`, `vite.config.ts`, `pubspec.yaml`)
12. **Risks, Gaps & Follow-ups**

    * Red flags, missing pieces, next checks
    * *If the codebase is very large*, you may add **Phases** (e.g., “Phase 1: data layer”)—keep to essential, technical phases only.

**Constraints**

* State only what’s evidenced in files; mark unknowns and what to check next.
* Use British spelling and tight bullets.

---

Why these tweaks: your **feature plan** template mandates a purely technical deliverable, no PM sections or code, with file/function pointers and optional phases, and emphasises concision and (if needed) limited clarifying questions; your **product brief** template also enforces brevity and a fixed output path—so this audit now follows that same house style.   &#x20;
