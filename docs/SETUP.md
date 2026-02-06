# Omni-Model Router — Setup & tools you need

Use this as your single checklist. You’ve **connected Supabase** ✓; below is everything else.

---

## 1. Database (Supabase) — ✅ You have this

- **Get:** Project URL and Service Role key  
  Supabase Dashboard → **Project Settings** → **API**  
  - **Project URL** → `SUPABASE_URL`  
  - **Service role** (secret) → `SUPABASE_SERVICE_KEY`

- **Migrations:** In Supabase → **SQL Editor**, run in order:
  1. `supabase/migrations/001_initial_schema.sql`
  2. `supabase/migrations/002_seed_models_and_dev_user.sql`
  3. `supabase/migrations/003_add_request_token_columns.sql`

- **Dev API key** (from seed): `omni-dev-key-change-in-production` — use this in the dashboard and in `Authorization: Bearer ...` for local testing.

---

## 2. API env (`apps/api/.env`)

Create `apps/api/.env` (copy from `apps/api/.env.example`). Fill at least the **required** ones.

| Variable | Required | Where to get it |
|----------|----------|------------------|
| `PORT` | No (default 3000) | Leave or set for deployment |
| `CORS_ORIGIN` | No | Your dashboard URL when deployed (e.g. `https://you.vercel.app`). Leave empty for local dev. |
| `SUPABASE_URL` | **Yes** | Supabase → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_KEY` | **Yes** | Supabase → Project Settings → API → Service role key |
| `OPENAI_API_KEY` | **Yes** (at least one provider) | [platform.openai.com](https://platform.openai.com/api-keys) |
| `ANTHROPIC_API_KEY` | No | [console.anthropic.com](https://console.anthropic.com) → API keys |
| `OPENROUTER_API_KEY` | No | [openrouter.ai](https://openrouter.ai) → Keys |
| `GROQ_API_KEY` | No | [console.groq.com](https://console.groq.com) |
| `UPSTASH_REDIS_REST_URL` | No | [upstash.com](https://upstash.com) → Create Redis → REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | No | Same Upstash database → REST token |
| `RATE_LIMIT_MAX` | No (default 100) | e.g. `100` |
| `RATE_LIMIT_WINDOW_SEC` | No (default 60) | e.g. `60` |

**Minimal working `.env` for API (with Supabase + OpenAI):**

```env
PORT=3000
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...your-service-role-key
OPENAI_API_KEY=sk-...
```

Add other provider keys and optional vars as needed.

---

## 3. Dashboard env (`apps/dashboard/.env.local`)

Create `apps/dashboard/.env.local`:

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3000` (local) or your API URL in production |
| `NEXT_PUBLIC_API_KEY` | `omni-dev-key-change-in-production` (dev key from seed) or your production API key |

**Example:**

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_API_KEY=omni-dev-key-change-in-production
```

---

## 4. Commands to run

From repo root (after `npm install` at root once):

```bash
# Terminal 1 — API
npm run dev:api

# Terminal 2 — Dashboard
npm run dev:dashboard
```

- API: [http://localhost:3000](http://localhost:3000) — try [http://localhost:3000/health](http://localhost:3000/health)  
- Dashboard: [http://localhost:3001](http://localhost:3001)

---

## 5. Optional / deployment tools

| Tool | Purpose | When you need it |
|------|---------|-------------------|
| **[Vercel](https://vercel.com)** | Host the dashboard | When you deploy the frontend |
| **[Fly.io](https://fly.io)** or **[Railway](https://railway.app)** | Host the API (Node server) | When you deploy the API |
| **[Upstash](https://upstash.com)** (Redis) | Rate limiting across multiple API instances | When you run more than one API instance or want shared rate limits |

---

## 6. Quick test

With API and dashboard running:

1. Open [http://localhost:3001](http://localhost:3001) — you should see the dashboard (overview may show 0 until you send requests).
2. Send a request to the API, e.g.:

```bash
curl -X POST http://localhost:3000/v1/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer omni-dev-key-change-in-production" \
  -d "{\"messages\":[{\"role\":\"user\",\"content\":\"Say hello in one word.\"}]}"
```

3. Refresh the dashboard — you should see request count and cost update.

You now have all the tools and env you need to run and deploy Omni-Model Router.
