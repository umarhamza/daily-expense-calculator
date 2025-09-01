# Daily Expense Tracker

## Development

- Install dependencies: `npm install`
- Start dev server: `npm run dev`

## Gemini Strict JSON Agent

Use `useGeminiAgent` to send a message that already contains strict JSON. The agent validates, optionally executes a whitelisted `db_query`, and always returns a final JSON string with `respond_to_user`.

Example input message (must be strict JSON):

```
{"action":"db_query","query":"SELECT id, item FROM expenses WHERE active = true;"}
```

Usage in a component:

```js
import { useGeminiAgent } from '@/lib/useGeminiAgent'

const { isLoading, error, send } = useGeminiAgent()
const result = await send('{"action":"respond_to_user","content":"Hello there."}')
// result is a JSON string like {"action":"respond_to_user","content":"Hello there."}
```

Rules enforced:
- Only one action per response.
- `respond_to_user` content is max 20 words.
- Any `db_query` is executed only if whitelisted; otherwise returns `{"action":"respond_to_user","content":"No results found."}`.